require("dotenv").config({ path: "../.env" });
const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT });
}

// Delete noisy loops that slipped past the inbox filter.
const NOISE_KEYWORDS = [
  "notion", "kaggle", "claude", "slack confirmation", "shared with you",
  "confirmation code", "verification code", "otp",
];

const db = getFirestore();
db.collection("open_loops").get().then(async snap => {
  const toDelete = snap.docs.filter(d => {
    const title = (d.data().context?.raw_title || "").toLowerCase();
    return NOISE_KEYWORDS.some(kw => title.includes(kw));
  });
  console.log(`Deleting ${toDelete.length} noisy loops...`);
  for (const doc of toDelete) {
    const l = doc.data();
    console.log(`  del | ${l.context?.raw_title?.slice(0, 60)}`);
    await doc.ref.delete();
  }
  console.log("Done.");
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

