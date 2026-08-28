const { updateLoop } = require("./firestoreClient");
const adapters = require("./adapterRegistry");

// connections: { google: [...], notion: [...] } — the FULL map is passed
// through to adapter.execute() (not just the connection matching the loop's
// own source adapter) so a loop can act across adapters, e.g. a Notion-
// sourced "unsubscribe" loop calling Gmail APIs. Each adapter picks what it
// needs via connections.google / connections.notion for loop.user_id.
async function resolveLoop(loop, connections = {}) {
  if (loop.status !== "auto_resolving") {
    return loop;
  }

  const adapter = adapters[loop.source?.adapter];
  if (adapter && typeof adapter.execute === "function") {
    const scoped = {
      google: (connections.google || []).find(c => c.user_id === loop.user_id),
      notion: (connections.notion || []).find(c => c.user_id === loop.user_id),
    };
    await adapter.execute(loop, scoped);
  }

  return updateLoop(loop.loop_id, {
    status: "resolved",
    resolved_at: new Date(),
  });
}

module.exports = { resolveLoop };
