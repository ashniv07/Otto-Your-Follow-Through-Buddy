const { google } = require("googleapis");
const { getFirestore } = require("firebase-admin/firestore");

const COLLECTION = "google_connections";

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/tasks",
];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

async function exchangeCode(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Returns an OAuth2 client pre-loaded with the stored tokens for a connection.
// Auto-refresh is handled transparently by googleapis when a refresh_token exists.
function getClientFromConnection(connection) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
  });
  // Persist refreshed tokens back to Firestore
  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      const db = getFirestore();
      const snap = await db
        .collection(COLLECTION)
        .where("user_id", "==", connection.user_id)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          access_token: tokens.access_token,
          ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        });
      }
    }
  });
  return client;
}

async function saveConnection(userId, tokens, userEmail) {
  const db = getFirestore();
  const existing = await db
    .collection(COLLECTION)
    .where("user_id", "==", userId)
    .limit(1)
    .get();

  const data = {
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    email: userEmail || null,
    scopes: SCOPES,
    connected: true,
    updated_at: new Date(),
  };

  if (!existing.empty) {
    await existing.docs[0].ref.update(data);
  } else {
    await db.collection(COLLECTION).add({ ...data, created_at: new Date() });
  }
}

async function getConnectionStatus(userId) {
  const db = getFirestore();
  const snap = await db
    .collection(COLLECTION)
    .where("user_id", "==", userId)
    .limit(1)
    .get();
  if (snap.empty) return { connected: false };
  const data = snap.docs[0].data();
  return { connected: !!data.connected, email: data.email || null };
}

async function disconnectUser(userId) {
  const db = getFirestore();
  const snap = await db
    .collection(COLLECTION)
    .where("user_id", "==", userId)
    .limit(1)
    .get();
  if (!snap.empty) {
    await snap.docs[0].ref.update({ connected: false, access_token: null, refresh_token: null });
  }
}

module.exports = {
  COLLECTION,
  SCOPES,
  createOAuth2Client,
  getAuthUrl,
  exchangeCode,
  getClientFromConnection,
  saveConnection,
  getConnectionStatus,
  disconnectUser,
};
