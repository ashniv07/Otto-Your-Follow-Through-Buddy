const { getFirestore } = require("firebase-admin/firestore");

const COLLECTION = "extraction_cache";

// Every adapter's fetchNewItems() re-scans the same rolling window (Gmail's
// 7d/90d searches, Calendar's "overdue last month"/"next month" windows) on
// every scheduler tick, forever — an email/task/event's content is static
// once fetched, so re-running the LLM classify/extract call on an item
// already seen is pure waste. This caches that result by (userId, itemId,
// kind) so each item only ever pays for one Gemini call for its entire time
// in the scan window, whether it ends up surfaced or rejected. `kind` keeps
// each adapter's/scan's cache namespace separate (a gmail thread id and a
// calendar task id could theoretically collide otherwise).
function cacheKey(userId, itemId, kind) {
  return `${userId}_${kind}_${itemId}`;
}

async function getCachedResult(userId, itemId, kind) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION).doc(cacheKey(userId, itemId, kind)).get();
  return doc.exists ? doc.data().result : null;
}

async function setCachedResult(userId, itemId, kind, result) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(cacheKey(userId, itemId, kind)).set({
    result,
    cached_at: new Date(),
  });
}

module.exports = { getCachedResult, setCachedResult };
