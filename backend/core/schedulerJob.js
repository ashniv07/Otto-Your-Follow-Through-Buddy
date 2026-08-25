const adapters = require("./adapterRegistry");
const { createLoop, updateLoop, getLoopBySourceId, getAllActiveLoops } = require("./firestoreClient");
const { createOpenLoop } = require("./models");
const { isStalled } = require("./stallDetector");
const { decide } = require("./policyEngine");
const { resolveLoop } = require("./actionAgent");

// Adapter contract: fetchNewItems() returns an array of partial OpenLoop
// field objects (everything except loop_id/status/timestamps — each
// adapter's own extractionAgent fills in loop_type/expected_state/
// expected_by/stakes/source/context). recheck(loop) returns a string: the
// loop's up-to-date current_state.
async function runSchedulerJob() {
  const summary = { newLoops: 0, rechecked: 0, completed: 0, autoResolved: 0, needsApproval: 0, errors: [] };

  for (const [adapterName, adapter] of Object.entries(adapters)) {
    try {
      const newLoopFields = await adapter.fetchNewItems();
      for (const fields of newLoopFields) {
        try {
          const sourceId = fields.source?.source_id;
          const existing = sourceId ? await getLoopBySourceId(adapterName, sourceId) : null;
          if (existing) continue;

          const loop = createOpenLoop({ status: "pending", ...fields });
          await createLoop(loop);
          summary.newLoops += 1;
        } catch (err) {
          summary.errors.push({ adapter: adapterName, phase: "createLoop", message: err.message });
        }
      }
    } catch (err) {
      summary.errors.push({ adapter: adapterName, phase: "fetchNewItems", message: err.message });
    }
  }

  const loopsToRecheck = await getAllActiveLoops();
  for (const loop of loopsToRecheck) {
    const adapter = adapters[loop.source?.adapter];
    if (!adapter) continue;
    try {
      const newState = await adapter.recheck(loop);
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
  for (const loop of loopsToEvaluate) {
    try {
      // Genuinely done (e.g. checked off in Notion) — close the loop
      // immediately regardless of the due date, no policy decision needed
      // since nothing is being auto-executed on the user's behalf.
      if (loop.current_state === loop.expected_state) {
        await updateLoop(loop.loop_id, { status: "resolved", resolved_at: new Date() });
        summary.completed += 1;
        continue;
      }

      if (!isStalled(loop)) continue;

      const decision = decide(loop);
      if (decision === "auto_resolving") {
        const updated = await updateLoop(loop.loop_id, { status: "auto_resolving" });
        await resolveLoop(updated);
        summary.autoResolved += 1;
      } else {
        await updateLoop(loop.loop_id, { status: "needs_approval" });
        summary.needsApproval += 1;
      }
    } catch (err) {
      summary.errors.push({ loopId: loop.loop_id, phase: "policy", message: err.message });
    }
  }

  return summary;
}

module.exports = { runSchedulerJob };
