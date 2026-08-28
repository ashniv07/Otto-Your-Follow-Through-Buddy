const express = require("express");
const { Client } = require("@notionhq/client");
require("../core/firestoreClient"); // ensures firebase-admin is initialized
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();
const CONNECTIONS_COLLECTION = "notion_connections";

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const router = express.Router();

const { requireSession } = require("../core/sessionMiddleware");
const PUBLIC_PATHS = new Set(["/google/signin", "/google/signin/callback", "/session", "/signout"]);
router.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  requireSession(req, res, next);
});

router.get("/notion/connect", (req, res) => {
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", NOTION_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", NOTION_REDIRECT_URI);
  res.redirect(url.toString());
});

router.get("/notion/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/app?connected=notion&error=missing_code`);
  }

  try {
    const basicAuth = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString("base64");
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: NOTION_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Notion token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json();

    const docRef = db.collection(CONNECTIONS_COLLECTION).doc(req.userId);
    const existingDoc = await docRef.get();
    const existing = existingDoc.exists ? existingDoc.data() : null;

    // Reconnecting to the SAME workspace (including after a disconnect,
    // which only soft-deletes — see /notion/disconnect below) carries the
    // previously tracked page forward, so the user isn't asked to pick
    // their database again. A different workspace starts fresh.
    const trackedPageId =
      existing && existing.workspace_id === tokenData.workspace_id
        ? existing.tracked_page_id || null
        : null;

    await docRef.set({
      user_id: req.userId,
      access_token: tokenData.access_token,
      workspace_id: tokenData.workspace_id,
      workspace_name: tokenData.workspace_name,
      bot_id: tokenData.bot_id,
      tracked_page_id: trackedPageId,
      disconnected: false,
      connected_at: FieldValue.serverTimestamp(),
    });

    res.redirect(`${FRONTEND_URL}/app?connected=notion`);
  } catch (err) {
    console.error("Notion OAuth callback failed:", err.message);
    res.redirect(`${FRONTEND_URL}/app?connected=notion&error=oauth_failed`);
  }
});

router.get("/notion/status", async (req, res) => {
  try {
    const doc = await db.collection(CONNECTIONS_COLLECTION).doc(req.userId).get();
    const data = doc.exists ? doc.data() : null;
    if (!data || !data.access_token || data.disconnected) {
      return res.json({ connected: false });
    }
    res.json({
      connected: true,
      workspaceName: data.workspace_name,
      trackedPageId: data.tracked_page_id || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft-delete only: clears the access token and flags the doc
// disconnected, but keeps workspace_id/tracked_page_id — that's what lets
// /notion/callback carry the tracked page forward on a later reconnect to
// the same workspace, instead of making the user pick their database again.
router.delete("/notion/disconnect", async (req, res) => {
  try {
    const docRef = db.collection(CONNECTIONS_COLLECTION).doc(req.userId);
    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.update({ access_token: null, disconnected: true });
    }
    res.json({ disconnected: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/notion/pages", async (req, res) => {
  try {
    const doc = await db.collection(CONNECTIONS_COLLECTION).doc(req.userId).get();
    if (!doc.exists || !doc.data().access_token || doc.data().disconnected) {
      return res.status(404).json({ error: "Not connected to Notion" });
    }

    const notion = new Client({ auth: doc.data().access_token });
    // Notion's 2025-09-03 API returns queryable "data sources", not raw
    // "database" objects (see backend/adapters/notion/adapter.js) — the
    // search filter value has to match that, not "database".
    const results = await notion.search({ filter: { property: "object", value: "data_source" } });

    res.json({
      pages: results.results.map((r) => ({
        id: r.id,
        title: r.title?.map((t) => t.plain_text).join("") || "Untitled",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/notion/select-page", async (req, res) => {
  const { pageId } = req.body;
  if (!pageId) return res.status(400).json({ error: "pageId is required" });

  try {
    await db.collection(CONNECTIONS_COLLECTION).doc(req.userId).update({
      tracked_page_id: pageId,
    });
    res.json({ trackedPageId: pageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Google OAuth (Gmail + Calendar + Tasks) ──────────────────────────────────
const googleAuth = require("../adapters/google/auth");

router.get("/google/connect", (req, res) => {
  const url = googleAuth.getAuthUrl();
  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/app?connected=google&error=access_denied`);
  }
  try {
    const tokens = await googleAuth.exchangeCode(code);

    let userEmail = null;
    let userName = null;
    try {
      const { google } = require("googleapis");
      const client = googleAuth.createOAuth2Client();
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const info = await oauth2.userinfo.get();
      userEmail = info.data.email;
      userName = info.data.name || null;
    } catch (emailErr) {
      console.warn("[google] userinfo fetch failed (non-fatal):", emailErr.message);
    }

    await googleAuth.saveConnection(req.userId, tokens, userEmail, userName);
    res.redirect(`${FRONTEND_URL}/app?connected=google`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err.message);
    res.redirect(`${FRONTEND_URL}/app?connected=google&error=oauth_failed`);
  }
});

router.get("/google/status", async (req, res) => {
  try {
    const status = await googleAuth.getConnectionStatus(req.userId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/google/disconnect", async (req, res) => {
  try {
    await googleAuth.disconnectUser(req.userId);
    res.json({ disconnected: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sign-in (identity only — separate from the "connect Google" grant above) ─
const SESSION_COOKIE = "otto_session";
const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

router.get("/google/signin", (req, res) => {
  res.redirect(googleAuth.getSignInAuthUrl());
});

router.get("/google/signin/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/?error=signin_denied`);
  }
  try {
    const tokens = await googleAuth.exchangeCode(code, process.env.GOOGLE_SIGNIN_REDIRECT_URI);

    const { google } = require("googleapis");
    const client = googleAuth.createOAuth2Client(process.env.GOOGLE_SIGNIN_REDIRECT_URI);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const info = await oauth2.userinfo.get();

    if (!info.data.id || !info.data.email) {
      throw new Error("Google sign-in did not return an account id/email");
    }

    await googleAuth.upsertUser(info.data.id, {
      email: info.data.email,
      name: info.data.name,
      picture: info.data.picture,
    });

    res.cookie(SESSION_COOKIE, info.data.id, {
      httpOnly: true,
      sameSite: "lax",
      signed: true,
      maxAge: SESSION_MAX_AGE_MS,
      // Without an explicit path, the browser defaults it to the directory
      // of the URL that set it (/api/auth/google/signin) — the cookie would
      // never be sent to /api/auth/session, /loops, etc. Must be site-wide.
      path: "/",
    });
    res.redirect(`${FRONTEND_URL}/app`);
  } catch (err) {
    console.error("Google sign-in callback failed:", err.message);
    res.redirect(`${FRONTEND_URL}/?error=signin_failed`);
  }
});

router.get("/session", async (req, res) => {
  try {
    const userId = req.signedCookies?.[SESSION_COOKIE];
    if (!userId) return res.json({ authenticated: false });
    const user = await googleAuth.getUserById(userId);
    if (!user) return res.json({ authenticated: false });
    res.json({ authenticated: true, user: { email: user.email, name: user.name, picture: user.picture } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/signout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ signedOut: true });
});

module.exports = router;
