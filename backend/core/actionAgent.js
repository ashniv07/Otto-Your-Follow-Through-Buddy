const { updateLoop } = require("./firestoreClient");
const adapters = require("./adapterRegistry");

// connections: { google: [...], notion: [...] } — passed through so
// adapters like calendar can call their Google API during execute().
async function resolveLoop(loop, connections = {}) {
  if (loop.status !== "auto_resolving") {
    return loop;
  }

  const adapter = adapters[loop.source?.adapter];
  if (adapter && typeof adapter.execute === "function") {
    const adapterName = loop.source?.adapter;
    let connection;
    if (adapterName === "notion") {
      connection = (connections.notion || []).find(c => c.user_id === loop.user_id);
    } else if (adapterName === "gmail" || adapterName === "calendar") {
      connection = (connections.google || []).find(c => c.user_id === loop.user_id);
    }
    await adapter.execute(loop, connection);
  }

  return updateLoop(loop.loop_id, {
    status: "resolved",
    resolved_at: new Date(),
  });
}

module.exports = { resolveLoop };
