const { getFirestore } = require("firebase-admin/firestore");
const adapters = require("./adapterRegistry");
const { createLoop, updateLoop, getLoopBySourceId, getAllActiveLoops, createPipelineEvent } = require("./firestoreClient");
const { createOpenLoop, IMMEDIATE_LOOP_TYPES } = require("./models");
const { isStalled } = require("./stallDetector");
const { decide } = require("./policyEngine");
const { resolveLoop } = require("./actionAgent");

const db = getFirestore();

async function getNotionConnections() {
  const snap = await db.collection("notion_connections").get();
  return snap.docs
    .map((d) => d.data())
    .filter((c) => c.access_token && c.tracked_page_id);
}

async function getGoogleConnections() {
  const snap = await db.collection("google_connections").get();
  return snap.docs
    .map((d) => d.data())
    .filter((c) => c.access_token && c.connected);
}

// Adapter contract: fetchNewItems([connection]) returns an array of partial
// OpenLoop field objects (everything except loop_id/status/timestamps —
// each adapter's own extractionAgent fills in loop_type/expected_state/
// expected_by/stakes/source/context). recheck(loop, [connection]) returns a
// string: the loop's up-to-date current_state.
async function runSchedulerJob() {
  const runId = `run-${Date.now()}`;
  const summary = { newLoops: 0, rechecked: 0, completed: 0, autoResolved: 0, needsApproval: 0, errors: [] };
  const notionConnections = await getNotionConnections();
  const googleConnections = await getGoogleConnections();
  const allConnections = { notion: notionConnections, google: googleConnections };

  for (const [adapterName, adapter] of Object.entries(adapters)) {
    const connections =
      adapterName === "notion" ? notionConnections
      : adapterName === "gmail" || adapterName === "calendar" || adapterName === "docs" ? googleConnections
      : [undefined];

    for (const connection of connections) {
      try {
        const newLoopFields = await adapter.fetchNewItems(connection);
        // Deduplicate by source_id within this batch before hitting Firestore.
        const seen = new Set();
        const dedupedFields = newLoopFields.filter(f => {
          const key = f.source?.source_id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        for (const fields of dedupedFields) {
          try {
            const sourceId = fields.source?.source_id;
            const existing = sourceId
              ? await getLoopBySourceId(adapterName, sourceId, fields.user_id)
              : null;
            if (existing) {
              console.log(`[scheduler] Dedup skip: ${sourceId} (user=${fields.user_id})`);
              continue;
            }

            // Reject loops where the extraction agent returned a nonsensical date.
            if (fields.expected_by && new Date(fields.expected_by) < new Date("2020-01-01")) {
              console.warn(`[scheduler] Skipping loop with implausible expected_by: ${fields.expected_by}`);
              continue;
            }

            const loop = createOpenLoop({ status: "pending", ...fields });
            await createLoop(loop);
            console.log(`[scheduler] Created loop: ${sourceId} title="${fields.context?.raw_title}" user=${fields.user_id}`);
            await createPipelineEvent({ user_id: fields.user_id, type: "new_loop", run_id: runId, loop_id: loop.loop_id, message: `New loop detected: ${fields.context?.raw_title || fields.expected_state || "unknown"}` });
            summary.newLoops += 1;
          } catch (err) {
            console.error(`[scheduler] createLoop error: ${err.message}`);
            summary.errors.push({ adapter: adapterName, phase: "createLoop", message: err.message });
          }
        }
      } catch (err) {
        summary.errors.push({ adapter: adapterName, phase: "fetchNewItems", message: err.message });
      }
    }
  }

  const loopsToRecheck = await getAllActiveLoops();
  for (const loop of loopsToRecheck) {
    const adapter = adapters[loop.source?.adapter];
    if (!adapter) continue;
    try {
      const adp = loop.source?.adapter;
      const connection =
        adp === "notion" ? notionConnections.find((c) => c.user_id === loop.user_id)
        : adp === "gmail" || adp === "calendar" || adp === "docs" ? googleConnections.find((c) => c.user_id === loop.user_id)
        : undefined;
      const newState = await adapter.recheck(loop, connection);
      if (newState && newState !== loop.current_state) {
        loop.current_state = newState;
        await updateLoop(loop.loop_id, { current_state: newState });
      }
      summary.rechecked += 1;
    } catch (err) {
      summary.errors.push({
        adapter: loop.source?.adapter,
        phase: "recheck",
        loopId: loop.loop_id,
        message: err.message,
      });
    }
  }

  const loopsToEvaluate = await getAllActiveLoops();
  for (let loop of loopsToEvaluate) {
    try {
      // Genuinely done (e.g. checked off in Notion) — close the loop
      // immediately regardless of the due date, no policy decision needed
      // since nothing is being auto-executed on the user's behalf.
      if (loop.current_state === loop.expected_state) {
        await updateLoop(loop.loop_id, { status: "resolved", resolved_at: new Date() });
        await createPipelineEvent({ user_id: loop.user_id, type: "auto_resolved", run_id: runId, loop_id: loop.loop_id, message: `Completed: ${loop.context?.raw_title || loop.expected_state}` });
        summary.completed += 1;
        continue;
      }

      // Already sitting in front of the user (or already being resolved) —
      // nothing left for the scheduler to do until they act. Without this,
      // every tick would re-fire a duplicate "needs approval" pipeline event
      // for anything still unapproved, forever.
      if (loop.status === "needs_approval" || loop.status === "auto_resolving") continue;

      // Loop types that can't resolve themselves by waiting (see
      // IMMEDIATE_LOOP_TYPES) get investigated the moment they're created,
      // regardless of expected_by — everything else waits until stalled.
      // Calendar EVENTS are the same story even though "calendar" the loop
      // type isn't in that list: their recheck() never changes current_state
      // (there's no "mark done" concept for an event), so waiting for
      // expected_by would mean only ever looking at an event after its start
      // time — too late for prep/decline actions. Calendar TASKS stay
      // gated on isStalled() since those genuinely can get completed
      // manually in Google Tasks before their due date.
      const isImmediate =
        IMMEDIATE_LOOP_TYPES.includes(loop.loop_type) || loop.source?.item_type === "event";
      if (!isImmediate && !isStalled(loop)) continue;

      // Run adapter's investigate() to populate proposed_action (and, for
      // adapters that need structured fields, context.action_schema) before
      // routing. Skip if already investigated to avoid redundant ADK calls
      // every tick. investigate() may return either a plain string (legacy
      // contract: stored as-is in proposed_action) or
      // { proposedAction, actionSchema } for adapters whose drafted action
      // needs more than free text (unsubscribe match counts, doc replies,
      // file-share candidates, etc).
      const stalledAdapter = adapters[loop.source?.adapter];
      if (stalledAdapter?.investigate && !loop.context?.proposed_action) {
        try {
          const scopedConnections = {
            notion: notionConnections.find(c => c.user_id === loop.user_id),
            google: googleConnections.find(c => c.user_id === loop.user_id),
          };
          const investigation = await stalledAdapter.investigate(loop, scopedConnections);
          if (investigation) {
            const isStructured = typeof investigation === "object";
            const proposedAction = isStructured ? investigation.proposedAction : investigation;
            const actionSchema = isStructured ? investigation.actionSchema : undefined;

            const patch = {};
            if (proposedAction) patch["context.proposed_action"] = proposedAction;
            if (actionSchema) patch["context.action_schema"] = actionSchema;

            if (Object.keys(patch).length > 0) {
              await updateLoop(loop.loop_id, patch);
              loop = {
                ...loop,
                context: {
                  ...loop.context,
                  ...(proposedAction ? { proposed_action: proposedAction } : {}),
                  ...(actionSchema ? { action_schema: actionSchema } : {}),
                },
              };
            }
          }
        } catch (err) {
          summary.errors.push({ loopId: loop.loop_id, phase: "investigate", message: err.message });
        }
      }

      // decide() always returns needs_approval now — no auto-execution.
      await updateLoop(loop.loop_id, { status: "needs_approval" });
      await createPipelineEvent({ user_id: loop.user_id, type: "needs_approval", run_id: runId, loop_id: loop.loop_id, message: `Needs your approval: ${loop.context?.raw_title || loop.expected_state}` });
      summary.needsApproval += 1;
    } catch (err) {
      summary.errors.push({ loopId: loop.loop_id, phase: "policy", message: err.message });
    }
  }

  return summary;
}

module.exports = { runSchedulerJob };
