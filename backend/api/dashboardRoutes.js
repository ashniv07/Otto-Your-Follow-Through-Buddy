const express = require("express");
const firestoreClient = require("../core/firestoreClient");
const { resolveLoop } = require("../core/actionAgent");
const { runSchedulerJob } = require("../core/schedulerJob");

const router = express.Router();

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
    },
    createdAt: isoOrNull(loop.created_at),
    updatedAt: isoOrNull(loop.updated_at),
    resolvedAt: isoOrNull(loop.resolved_at),
  };
}

router.get("/loops", async (req, res) => {
  try {
    const loops = await firestoreClient.getAllLoops();
    res.json(loops.map(serializeLoop));
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

    const updated = await firestoreClient.updateLoop(loop.loop_id, { status: "auto_resolving" });
    const resolved = await resolveLoop(updated);
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

    const resolved = await firestoreClient.updateLoop(loop.loop_id, {
      status: "resolved",
      current_state: "Declined by user — no action taken",
      resolved_at: new Date(),
    });
    res.json(serializeLoop(resolved));
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
