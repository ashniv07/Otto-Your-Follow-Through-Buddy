const express = require("express");
const { getFirestore } = require("firebase-admin/firestore");
const firestoreClient = require("../core/firestoreClient");
const { resolveLoop } = require("../core/actionAgent");
const { runSchedulerJob } = require("../core/schedulerJob");

const db = getFirestore();
const router = express.Router();

async function getConnectionsForUser(userId) {
  const [notionSnap, googleSnap] = await Promise.all([
    db.collection("notion_connections").where("user_id", "==", userId).limit(1).get(),
    db.collection("google_connections").where("user_id", "==", userId).limit(1).get(),
  ]);
  return {
    notion: notionSnap.docs.map(d => d.data()).filter(c => c.access_token),
    google: googleSnap.docs.map(d => d.data()).filter(c => c.access_token && c.connected),
  };
}

async function isNotionConnected(userId) {
  const doc = await db.collection("notion_connections").doc(userId).get();
  if (!doc.exists) return false;
  const data = doc.data();
  return Boolean(data.access_token) && !data.disconnected;
}

function isoOrNull(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") return timestamp.toDate().toISOString();
  return new Date(timestamp).toISOString();
}

// Firestore documents stay in the shared snake_case OpenLoop shape (that's
// the contract every adapter writes to) — this reshapes each one into what
// the frontend's OpenLoop type expects: camelCase, ISO date strings, and a
// flat `title` pulled from context.raw_title (falls back to expected_state
// for any loop an adapter created before that field existed).
function serializeLoop(loop) {
  return {
    id: loop.loop_id,
    loopType: loop.loop_type,
    title: loop.context?.raw_title || loop.expected_state,
    expectedState: loop.expected_state,
    expectedBy: isoOrNull(loop.expected_by),
    currentState: loop.current_state,
    status: loop.status,
    stakes: loop.stakes,
    context: {
      rawSummary: loop.context?.raw_summary || "",
      investigationNotes: loop.context?.investigation_notes || undefined,
      proposedAction: loop.context?.proposed_action || undefined,
      actionSchema: loop.context?.action_schema || undefined,
    },
    createdAt: isoOrNull(loop.created_at),
    updatedAt: isoOrNull(loop.updated_at),
    resolvedAt: isoOrNull(loop.resolved_at),
  };
}

router.get("/loops", async (req, res) => {
  try {
    const loops = await firestoreClient.getAllLoops();
    const ownLoops = loops.filter((loop) => loop.user_id === req.userId);

    // A disconnected/never-connected Notion adapter hides its loops rather
    // than just freezing them — they reappear once reconnected (the loops
    // themselves aren't touched, this is purely a visibility filter).
    const notionConnected = await isNotionConnected(req.userId);
    const visibleLoops = notionConnected
      ? ownLoops
      : ownLoops.filter((loop) => loop.source?.adapter !== "notion");

    res.json(visibleLoops.map(serializeLoop));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/loops/:id/approve", async (req, res) => {
  try {
    const loop = await firestoreClient.getLoopById(req.params.id);
    if (!loop) {
      return res.status(404).json({ error: `No loop found with id "${req.params.id}"` });
    }
    if (loop.user_id !== req.userId) {
      return res.status(403).json({ error: "This loop belongs to another user" });
    }

    const updated = await firestoreClient.updateLoop(loop.loop_id, { status: "auto_resolving" });
    const connections = await getConnectionsForUser(req.userId);
    const resolved = await resolveLoop(updated, connections);
    await firestoreClient.createPipelineEvent({ user_id: req.userId, type: "user_approved", loop_id: loop.loop_id, run_id: "run-manual-approval", message: `You approved: ${loop.context?.raw_title || loop.expected_state}` });
    res.json(serializeLoop(resolved));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/loops/:id/decline", async (req, res) => {
  try {
    const loop = await firestoreClient.getLoopById(req.params.id);
    if (!loop) {
      return res.status(404).json({ error: `No loop found with id "${req.params.id}"` });
    }
    if (loop.user_id !== req.userId) {
      return res.status(403).json({ error: "This loop belongs to another user" });
    }

    const resolved = await firestoreClient.updateLoop(loop.loop_id, {
      status: "resolved",
      current_state: "Declined by user — no action taken",
      resolved_at: new Date(),
    });
    await firestoreClient.createPipelineEvent({ user_id: req.userId, type: "user_declined", loop_id: loop.loop_id, run_id: "run-manual-approval", message: `You declined: ${loop.context?.raw_title || loop.expected_state} — no action taken` });
    res.json(serializeLoop(resolved));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lets the approval modal save edits to compose fields before the user clicks Approve.
router.patch("/loops/:id/action-schema", async (req, res) => {
  try {
    const loop = await firestoreClient.getLoopById(req.params.id);
    if (!loop || loop.user_id !== req.userId) return res.status(404).json({ error: "Not found" });
    const { to, cc, subject, body } = req.body;
    const updated = await firestoreClient.updateLoop(loop.loop_id, {
      "context.action_schema": { ...loop.context?.action_schema, to, cc, subject, body },
    });
    res.json(serializeLoop(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/pipeline-events", async (req, res) => {
  try {
    const snap = await db
      .collection("pipeline_events")
      .where("user_id", "==", req.userId)
      .orderBy("timestamp", "desc")
      .limit(200)
      .get();
    const events = snap.docs.map((doc) => {
      const d = doc.data();
      const ts = d.timestamp;
      const iso = ts?.toDate ? ts.toDate().toISOString() : ts ? new Date(ts).toISOString() : new Date().toISOString();
      return {
        id: doc.id,
        timestamp: iso,
        type: d.type,
        message: d.message,
        loopId: d.loop_id ?? undefined,
        runId: d.run_id ?? undefined,
      };
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/run-now", async (req, res) => {
  try {
    const summary = await runSchedulerJob();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
