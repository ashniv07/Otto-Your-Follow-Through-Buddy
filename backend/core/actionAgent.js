const { updateLoop } = require("./firestoreClient");
const adapters = require("./adapterRegistry");

// For "auto_resolving" loops: runs the owning adapter's execute() if it has
// one (e.g. Calendar's sendWish), then marks the loop resolved in Firestore.
// For "needs_approval" loops: does nothing — left for the approve endpoint.
async function resolveLoop(loop) {
  if (loop.status !== "auto_resolving") {
    return loop;
  }

  const adapter = adapters[loop.source?.adapter];
  if (adapter && typeof adapter.execute === "function") {
    await adapter.execute(loop);
  }

  return updateLoop(loop.loop_id, {
    status: "resolved",
    resolved_at: new Date(),
  });
}

module.exports = { resolveLoop };
