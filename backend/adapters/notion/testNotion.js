// Quick manual verification against a real OAuth-connected Notion account:
// loads a connection doc from notion_connections, pulls its open items,
// creates OpenLoop docs in Firestore (deduped by Notion page id, so reruns
// won't create junk), then rechecks every notion-sourced active loop for
// that user and logs the result.
//
// Run with: node backend/adapters/notion/testNotion.js [userId]
// If userId is omitted, uses the first connection found in Firestore that
// has already picked a tracked page (via POST /api/auth/notion/select-page).
require("dotenv").config();
const { getFirestore } = require("firebase-admin/firestore");
const { fetchNewItems, recheck } = require("./adapter");
const { createOpenLoop } = require("../../core/models");
const firestoreClient = require("../../core/firestoreClient");

async function loadConnection(userId) {
  const db = getFirestore();
  const collection = db.collection("notion_connections");

  if (userId) {
    const doc = await collection.doc(userId).get();
    if (!doc.exists) throw new Error(`No notion_connections doc for user "${userId}"`);
    return doc.data();
  }

  const snap = await collection.get();
  const connection = snap.docs.map((d) => d.data()).find((c) => c.access_token && c.tracked_page_id);
  if (!connection) {
    throw new Error(
      "No usable connection found in notion_connections (needs access_token + tracked_page_id). " +
        "Connect via GET /api/auth/notion/connect and pick a page first."
    );
  }
  return connection;
}

async function main() {
  const connection = await loadConnection(process.argv[2]);
  console.log(`Using connection for user "${connection.user_id}" (workspace: ${connection.workspace_name})`);

  console.log("Fetching new items from Notion...");
  const newLoopFields = await fetchNewItems(connection);
  console.log(`Found ${newLoopFields.length} new item(s) to create.`);

  for (const fields of newLoopFields) {
    const loop = createOpenLoop({ status: "pending", ...fields });
    await firestoreClient.createLoop(loop);
    console.log("\nCreated OpenLoop:");
    console.log(JSON.stringify(loop, null, 2));
  }

  console.log("\nRechecking this user's notion-sourced active loops...");
  const activeLoops = await firestoreClient.getAllActiveLoops();
  const notionLoops = activeLoops.filter(
    (l) => l.source?.adapter === "notion" && l.user_id === connection.user_id
  );

  for (const loop of notionLoops) {
    const newState = await recheck(loop, connection);
    console.log(`  ${loop.loop_id} — "${loop.context?.raw_summary}" -> ${newState}`);
    if (newState !== loop.current_state) {
      await firestoreClient.updateLoop(loop.loop_id, { current_state: newState });
    }
  }

  console.log(`\nDone. ${newLoopFields.length} created this run, ${notionLoops.length} rechecked.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("testNotion failed:", err);
  process.exit(1);
});
