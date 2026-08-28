const { google } = require("googleapis");
const { getFirestore } = require("firebase-admin/firestore");

const COLLECTION = "google_connections";

// Full data-access grant — Gmail/Calendar/Tasks/Docs/Drive. Requested only when
// the user opts in on the Connections page (separate from signing in — see
// SIGNIN_SCOPES below). `drive` (not `drive.readonly`/`drive.file`) is required
// because the docs adapter reads/replies to comments on files it didn't create,
// and the gmail file_request flow searches + shares arbitrary existing files.
// `gmail.modify` (not just `readonly`) is required for the unsubscribe flow to
// trash matched emails.
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/drive",
];

// Identity-only grant used purely to sign in and establish an Otto account —
// deliberately excludes Gmail/Calendar/Drive access, which stays a separate
// opt-in step (see SCOPES above / getAuthUrl below).
const SIGNIN_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function createOAuth2Client(redirectUri = process.env.GOOGLE_REDIRECT_URI) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
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

function getSignInAuthUrl() {
  const client = createOAuth2Client(process.env.GOOGLE_SIGNIN_REDIRECT_URI);
  return client.generateAuthUrl({
    access_type: "online",
    scope: SIGNIN_SCOPES,
    prompt: "select_account",
  });
}

async function exchangeCode(code, redirectUri = process.env.GOOGLE_REDIRECT_URI) {
  const client = createOAuth2Client(redirectUri);
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

async function saveConnection(userId, tokens, userEmail, userName) {
  const db = getFirestore();
  const existing = await db
    .collection(COLLECTION)
    .where("user_id", "==", userId)
    .limit(1)
    .get();

  // Switching to a different Google account — wipe the old Gmail loops so
  // stale loops from the previous account don't bleed through.
  if (!existing.empty && userEmail && existing.docs[0].data().email &&
      existing.docs[0].data().email !== userEmail) {
    const loopsSnap = await db.collection("open_loops")
      .where("user_id", "==", userId)
      .where("source.adapter", "==", "gmail")
      .get();
    for (const doc of loopsSnap.docs) await doc.ref.delete();
    console.log(`[google] Email changed for ${userId} — wiped ${loopsSnap.size} old Gmail loops`);
  }

  const data = {
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    email: userEmail || null,
    display_name: userName || null,
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
  // Delete all Gmail/Calendar/Docs loops so they don't linger after disconnect.
  for (const adapterName of ["gmail", "calendar", "docs"]) {
    const loopsSnap = await db.collection("open_loops")
      .where("user_id", "==", userId)
      .where("source.adapter", "==", adapterName)
      .get();
    for (const doc of loopsSnap.docs) await doc.ref.delete();
  }
  const connSnap = await db
    .collection(COLLECTION)
    .where("user_id", "==", userId)
    .limit(1)
    .get();
  if (!connSnap.empty) {
    await connSnap.docs[0].ref.update({ connected: false, access_token: null, refresh_token: null });
  }
}

const USERS_COLLECTION = "users";

// Called after the sign-in (identity-only) OAuth callback. `googleUserId` is
// the stable Google account id ("sub") — that's what becomes the Otto
// user_id, so the same Google account always maps to the same Otto account.
async function upsertUser(googleUserId, { email, name, picture }) {
  const db = getFirestore();
  const ref = db.collection(USERS_COLLECTION).doc(googleUserId);
  const existing = await ref.get();
  const data = { user_id: googleUserId, email, name: name || null, picture: picture || null, updated_at: new Date() };
  if (existing.exists) {
    await ref.update(data);
  } else {
    await ref.set({ ...data, created_at: new Date() });
  }
  return { ...(existing.exists ? existing.data() : {}), ...data };
}

async function getUserById(userId) {
  const db = getFirestore();
  const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
  return doc.exists ? doc.data() : null;
}

module.exports = {
  COLLECTION,
  SCOPES,
  SIGNIN_SCOPES,
  createOAuth2Client,
  getAuthUrl,
  getSignInAuthUrl,
  exchangeCode,
  getClientFromConnection,
  saveConnection,
  getConnectionStatus,
  disconnectUser,
  upsertUser,
  getUserById,
};
