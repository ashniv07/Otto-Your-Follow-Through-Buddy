const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
}

const db = getFirestore();
const COLLECTION = "open_loops";

function docToLoop(doc) {
  return { loop_id: doc.id, ...doc.data() };
}

async function createLoop(loop) {
  await db.collection(COLLECTION).doc(loop.loop_id).set(loop);
  return loop;
}

async function updateLoop(loopId, fields) {
  const ref = db.collection(COLLECTION).doc(loopId);
  await ref.update({ ...fields, updated_at: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  return docToLoop(snap);
}

async function getLoopById(loopId) {
  const snap = await db.collection(COLLECTION).doc(loopId).get();
  return snap.exists ? docToLoop(snap) : null;
}

// Used by adapters to dedupe before creating a new loop for the same
// upstream item (e.g. the same Notion page, Gmail thread, Calendar event).
// Scoped per user — two different Otto accounts tracking the same
// underlying item (e.g. a shared Notion workspace) each get their own loop,
// rather than the second account's item silently never appearing.
async function getLoopBySourceId(adapterName, sourceId, userId) {
  const snap = await db
    .collection(COLLECTION)
    .where("source.adapter", "==", adapterName)
    .where("source.source_id", "==", sourceId)
    .where("user_id", "==", userId)
    .limit(1)
    .get();
  return snap.empty ? null : docToLoop(snap.docs[0]);
}

async function getLoopsByStatus(status) {
  const snap = await db.collection(COLLECTION).where("status", "==", status).get();
  return snap.docs.map(docToLoop);
}

async function getAllLoops() {
  const snap = await db.collection(COLLECTION).get();
  return snap.docs.map(docToLoop);
}

async function getAllActiveLoops() {
  const loops = await getAllLoops();
  return loops.filter((loop) => loop.status !== "resolved");
}

async function createPipelineEvent(event) {
  await db.collection("pipeline_events").add({
    ...event,
    timestamp: FieldValue.serverTimestamp(),
  });
}

module.exports = {
  COLLECTION,
  createLoop,
  updateLoop,
  getLoopById,
  getLoopBySourceId,
  getLoopsByStatus,
  getAllLoops,
  getAllActiveLoops,
  createPipelineEvent,
};
