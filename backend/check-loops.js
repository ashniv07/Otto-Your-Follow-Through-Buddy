require("dotenv").config({ path: "../.env" });
const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT });
}

const db = getFirestore();
db.collection("open_loops").get().then(snap => {
  console.log("Total loops:", snap.size);
  snap.docs.forEach(d => {
    const l = d.data();
    const schema = l.context?.action_schema?.type || "none";
    const uid = l.user_id?.slice(0, 8);
    const eb = l.expected_by?.toDate?.()?.toISOString?.()?.slice(0,10) || l.expected_by;
    if (["opportunity","follow_up","subscription"].includes(l.loop_type)) {
      console.log(`${l.loop_type} | ${l.status} | schema=${schema} | uid=${uid} | eb=${eb} | ${l.context?.raw_title?.slice(0,35)}`);
    }
  });
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
