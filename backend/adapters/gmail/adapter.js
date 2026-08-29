const { google } = require("googleapis");
require("../../core/firestoreClient"); // ensure firebase-admin is initialised
const { getClientFromConnection } = require("../google/auth");
const { extractFromOrderEmail } = require("./extractionAgent");
const { investigateOrder } = require("./investigatorAgent");
const { classifyEmail } = require("./inboxAgent");
const { searchDriveFile, downloadFileForAttachment, buildRawMessageWithAttachment } = require("./driveShareAgent");
const fixtures = require("./fixtures");

// Excluding spam/trash/promo/social/forums — in:inbox was found to return 0
// results on some accounts, so category exclusions do the pre-filtering
// instead of scoping to inbox. Thread-level dedup inside
// fetchGeneralEmailsFromGmail prevents Sent-copy duplicates. The LLM
// classifier (inboxAgent.js) is still the second line of defense for spam
// that doesn't land in Gmail's own promo/social tabs.
const GENERAL_SEARCH_QUERY =
  "newer_than:7d -in:spam -in:trash -category:promotions -category:social -category:forums";

const SEARCH_QUERY =
  "(subject:(order confirmation OR order shipped OR your order OR has shipped OR order placed OR " +
  "\"order summary\" OR \"delivery update\" OR \"out for delivery\" OR \"shipment\" OR " +
  "\"invoice\" OR \"booking confirmation\" OR \"payment confirmation\") OR " +
  "from:(amazon.com OR amazon.in OR flipkart.com OR myntra.com OR meesho.com OR " +
  "ajio.com OR nykaa.com OR snapdeal.com OR ebay.com OR nike.com OR " +
  "bestbuy.com OR walmart.com OR etsy.com OR swiggy.com OR zomato.com OR " +
  "noreply@flipkart.com OR order-update@amazon.in)) " +
  "newer_than:90d";

function decodeBase64Url(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload) {
  if (payload?.body?.data) return decodeBase64Url(payload.body.data);
  if (payload?.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) return decodeBase64Url(p.body.data);
    }
    for (const p of payload.parts) {
      if (p.mimeType === "text/html" && p.body?.data) {
        return decodeBase64Url(p.body.data)
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    }
    for (const p of payload.parts) {
      if (p.mimeType?.startsWith("multipart/")) {
        const nested = extractBody(p);
        if (nested) return nested;
      }
    }
  }
  return "";
}

function header(headers, name) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

async function fetchEmailsFromGmail(oauthClient) {
  const gmail = google.gmail({ version: "v1", auth: oauthClient });
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: SEARCH_QUERY,
    maxResults: 15,
  });
  const messages = listRes.data.messages || [];
  const emails = [];
  for (const msg of messages.slice(0, 10)) {
    try {
      const detail = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const hdrs = detail.data.payload?.headers || [];
      emails.push({
        threadId: detail.data.threadId,
        subject: header(hdrs, "subject"),
        from: header(hdrs, "from"),
        date: header(hdrs, "date"),
        body: extractBody(detail.data.payload),
      });
    } catch { /* skip malformed messages */ }
  }
  return emails;
}

async function fetchGeneralEmailsFromGmail(oauthClient) {
  const gmail = google.gmail({ version: "v1", auth: oauthClient });
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: GENERAL_SEARCH_QUERY,
    maxResults: 30,
  });
  const messages = listRes.data.messages || [];
  const emails = [];
  const seenThreadIds = new Set(); // deduplicate Sent/Inbox copies of the same thread
  for (const msg of messages.slice(0, 40)) {
    try {
      const detail = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const hdrs = detail.data.payload?.headers || [];
      const threadId = detail.data.threadId;
      if (seenThreadIds.has(threadId)) continue;
      seenThreadIds.add(threadId);
      emails.push({
        threadId,
        subject: header(hdrs, "subject"),
        from: header(hdrs, "from"),
        date: header(hdrs, "date"),
        body: extractBody(detail.data.payload),
      });
      if (emails.length >= 25) break; // cap unique threads at 25
    } catch { /* skip malformed messages */ }
  }
  return emails;
}

async function fetchNewItems(connection) {
  if (!connection?.access_token) return [];
  const userId = connection.user_id;
  const client = getClientFromConnection(connection);
  const results = [];

  // --- Specialized order scan (keeps delivery-tracking recheck logic) ---
  try {
    const emails = await fetchEmailsFromGmail(client);
    for (const email of emails) {
      try {
        const extracted = await extractFromOrderEmail(email);
        if (extracted?.skip) {
          console.log(`[gmail] Skipping food/service order: ${email.subject}`);
          continue;
        }
        results.push({
          user_id: userId,
          loop_type: "order",
          source: { adapter: "gmail", source_id: email.threadId },
          expected_state: "delivered",
          expected_by: extracted.expected_delivery_date,
          current_state: "not yet delivered",
          stakes: extracted.stakes || "money",
          context: {
            raw_title: `Order from ${extracted.merchant}`,
            raw_summary:
              `Order #${extracted.order_id} from ${extracted.merchant} for ${extracted.item_summary}` +
              ` | Expected: ${extracted.expected_delivery_date}` +
              ` | Tracking: ${extracted.tracking_number || "none"}` +
              ` | Carrier: ${extracted.carrier || "unknown"}`,
          },
        });
      } catch (err) {
        console.error("[gmail] extractFromOrderEmail failed:", err.message);
      }
    }
  } catch (err) {
    console.warn("[gmail] Order scan failed:", err.message);
  }

  // --- General inbox scan (subscriptions, opportunities, follow-ups, anything else) ---
  try {
    const generalEmails = await fetchGeneralEmailsFromGmail(client);
    for (const email of generalEmails) {
      try {
        const classified = await classifyEmail(email);
        console.log(`[gmail:classify] subject="${email.subject}" from="${email.from}" → should_surface=${classified?.should_surface} loop_type=${classified?.loop_type}`);
        if (!classified?.should_surface) continue;
        // Only skip order-type if it came from a known retailer domain — self-sent test orders
        // won't match the specialized scanner's FROM filter and would otherwise be orphaned.
        if (classified.loop_type === "order") {
          const fromLower = (email.from || "").toLowerCase();
          const knownRetailer = ["amazon", "flipkart", "myntra", "ajio", "nykaa", "swiggy", "zomato", "meesho"].some(d => fromLower.includes(d));
          if (knownRetailer) continue;
        }
        const today = new Date().toISOString().slice(0, 10);
        const schema = classified.action_schema || {};
        results.push({
          user_id: userId,
          loop_type: classified.loop_type || "follow_up",
          source: { adapter: "gmail", source_id: `gen-${email.threadId}` },
          expected_state: classified.expected_state || "resolved",
          expected_by: classified.expected_by || today,
          current_state: classified.loop_type === "subscription"
            ? (schema.headline || "billing change detected")
            : classified.loop_type === "opportunity"
              ? "not yet responded"
              : "awaiting action",
          stakes: classified.stakes || "low",
          context: {
            raw_title: classified.title || email.subject,
            raw_summary: classified.summary || email.subject,
            action_schema: schema.type ? schema : undefined,
          },
        });
        console.log(`[gmail] Surfaced ${classified.loop_type}: ${classified.title}`);
      } catch (err) {
        console.error("[gmail] classifyEmail failed:", err.message);
      }
    }
  } catch (err) {
    console.warn("[gmail] General inbox scan failed:", err.message);
  }

  return results;
}

async function recheck(loop, connection) {
  if (!connection?.access_token || !loop.source?.source_id) return loop.current_state;
  try {
    const client = getClientFromConnection(connection);
    const gmail = google.gmail({ version: "v1", auth: client });
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: loop.source.source_id,
      format: "metadata",
      metadataHeaders: ["Subject"],
    });
    const subjects = (thread.data.messages || [])
      .map(m => header(m.payload?.headers || [], "subject").toLowerCase());
    const delivered = subjects.some(s =>
      s.includes("delivered") || s.includes("out for delivery complete") || s.includes("arrived")
    );
    if (delivered) return loop.expected_state;
  } catch { /* ignore — thread may have been deleted */ }
  return loop.current_state;
}

async function investigate(loop, connections = {}) {
  try {
    if (loop.loop_type === "order") {
      return await investigateOrder(loop);
    }

    // file_request loops carry a placeholder action_schema from extraction
    // (searchQuery/to/subject only) — the actual Drive search happens here,
    // lazily, once the loop is stalled, same reasoning as calendar tasks:
    // don't spend a Drive call on every candidate email every tick.
    if (loop.loop_type === "file_request") {
      const draft = loop.context?.action_schema || {};
      if (!connections.google?.access_token) return null;
      const client = getClientFromConnection(connections.google);
      const match = await searchDriveFile(client, draft.searchQuery);

      if (!match) {
        return {
          proposedAction: `Couldn't find a file matching "${draft.searchQuery || "the request"}" in Drive.`,
          actionSchema: {
            type: "info",
            headline: "No matching file found",
            detail: `Otto searched Drive for "${draft.searchQuery || "a matching file"}" but didn't find anything to attach — you'll need to send this one manually.`,
          },
        };
      }

      return {
        proposedAction: `Found "${match.fileName}" in Drive — approving will draft a reply to ${draft.to || "the requester"} with it attached.`,
        actionSchema: {
          type: "file_share",
          to: draft.to,
          subject: draft.subject || `Re: ${loop.context?.raw_title || "your request"}`,
          body: `Hi,\n\nPlease find the attached file — ${match.fileName}.`,
          fileId: match.fileId,
          fileName: match.fileName,
          fileMimeType: match.mimeType,
          fileSize: match.size,
          webViewLink: match.webViewLink,
        },
      };
    }

    // General loops already have action_schema from extraction — just promote to proposed_action.
    const schema = loop.context?.action_schema;
    if (schema?.type === "compose") return schema.body || "";
    if (schema?.type === "info") return schema.detail || schema.headline || "";
    return null;
  } catch (err) {
    console.error("[gmail] investigate failed:", err.message);
    return null;
  }
}

async function execute(loop, connections = {}) {
  const connection = connections.google;
  if (!connection?.access_token) return;
  const schema = loop.context?.action_schema;

  // Info-only loops are acknowledged by the user — no email to send.
  if (schema?.type === "info") return;

  const client = getClientFromConnection(connection);
  const gmail = google.gmail({ version: "v1", auth: client });

  // file_share: download the matched file and send it as an attachment —
  // handled entirely separately from the generic plain-text send path below,
  // since it needs a multipart MIME message rather than a plain text one.
  if (schema?.type === "file_share" && schema.fileId && schema.to) {
    try {
      const attachment = await downloadFileForAttachment(client, {
        fileId: schema.fileId,
        fileName: schema.fileName,
        mimeType: schema.fileMimeType,
        size: schema.fileSize,
      });
      if (!attachment) {
        console.error(`[gmail] "${schema.fileName}" is too large to attach — skipping send for loop ${loop.loop_id}`);
        return;
      }
      const raw = buildRawMessageWithAttachment({
        to: schema.to,
        subject: schema.subject || `Re: ${loop.context?.raw_title || "your request"}`,
        bodyText: schema.body || `Hi,\n\nPlease find the attached file — ${schema.fileName}.`,
        attachment,
      });
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      console.log(`[gmail] Sent "${attachment.fileName}" as attachment for loop ${loop.loop_id}`);
    } catch (err) {
      console.error("[gmail] file_share send failed:", err.message);
    }
    return;
  }

  // Resolve To/Subject: prefer action_schema fields, fall back to thread lookup for orders.
  let toAddress = schema?.to || "";
  let subject = schema?.subject || `Re: ${loop.context?.raw_title || "Follow-up"}`;
  const rawThreadId = loop.source?.source_id?.startsWith("gen-")
    ? loop.source.source_id.slice(4)
    : loop.source?.source_id;

  if (!toAddress && rawThreadId) {
    try {
      const thread = await gmail.users.threads.get({ userId: "me", id: rawThreadId, format: "metadata", metadataHeaders: ["From", "Subject"] });
      const firstMsg = thread.data.messages?.[0];
      toAddress = header(firstMsg?.payload?.headers || [], "from");
      const origSubject = header(firstMsg?.payload?.headers || [], "subject");
      if (!schema?.subject && origSubject) subject = origSubject.startsWith("Re:") ? origSubject : `Re: ${origSubject}`;
    } catch { /* fall through */ }
  }

  const rawBody = schema?.body || loop.context?.proposed_action || "";
  if (!rawBody) return;

  // Strip any LLM-generated generic sign-off, replace with the real sender's name.
  const senderName = connection?.display_name || connection?.email?.split("@")[0] || "Me";
  const strippedBody = rawBody
    .replace(/\n+(?:Best(?: regards)?|Regards|Sincerely|Thanks|Thank you)[,.]?\s*\n+.*$/i, "")
    .trimEnd();
  const body = `${strippedBody}\n\nBest regards,\n${senderName}`;

  const lines = [
    toAddress ? `To: ${toAddress}` : "",
    schema?.cc ? `Cc: ${schema.cc}` : "",
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].filter(l => l !== "");

  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  const requestBody = { raw };
  if (rawThreadId) requestBody.threadId = rawThreadId;
  await gmail.users.messages.send({ userId: "me", requestBody });
  console.log(`[gmail] Email sent for loop ${loop.loop_id}`);
}

module.exports = { fetchNewItems, recheck, investigate, execute };
