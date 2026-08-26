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

    // Email is display-only — if userinfo fails, still save the connection.
    let userEmail = null;
    try {
      const { google } = require("googleapis");
      const client = googleAuth.createOAuth2Client();
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const info = await oauth2.userinfo.get();
      userEmail = info.data.email;
    } catch (emailErr) {
      console.warn("[google] userinfo fetch failed (non-fatal):", emailErr.message);
    }

    await googleAuth.saveConnection(req.userId, tokens, userEmail);
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

module.exports = router;
