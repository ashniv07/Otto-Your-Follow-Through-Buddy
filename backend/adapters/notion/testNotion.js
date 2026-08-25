// Quick manual verification: pulls open items from the real Notion
// "Commitments" database, creates OpenLoop docs in Firestore (deduped by
// Notion page id, so reruns won't create junk), then rechecks every
// notion-sourced active loop and logs the result.
// Run with: node backend/adapters/notion/testNotion.js
require("dotenv").config();
const { fetchNewItems, recheck } = require("./adapter");
const { createOpenLoop } = require("../../core/models");
const firestoreClient = require("../../core/firestoreClient");

async function main() {
  console.log("Fetching new items from Notion...");
  const newLoopFields = await fetchNewItems();
  console.log(`Found ${newLoopFields.length} new item(s) to create.`);

  for (const fields of newLoopFields) {
    const loop = createOpenLoop({ status: "pending", ...fields });
    await firestoreClient.createLoop(loop);
    console.log("\nCreated OpenLoop:");
    console.log(JSON.stringify(loop, null, 2));
  }

  console.log("\nRechecking all notion-sourced active loops...");
  const activeLoops = await firestoreClient.getAllActiveLoops();
  const notionLoops = activeLoops.filter((l) => l.source?.adapter === "notion");

  for (const loop of notionLoops) {
    const newState = await recheck(loop);
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
