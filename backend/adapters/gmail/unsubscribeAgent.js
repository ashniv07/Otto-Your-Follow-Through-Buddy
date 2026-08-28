const { google } = require("googleapis");

function header(headers, name) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

// Parses a List-Unsubscribe header like:
// "<https://example.com/unsub?id=123>, <mailto:unsub@example.com?subject=unsubscribe>"
function parseListUnsubscribe(value) {
  const uris = [...(value || "").matchAll(/<([^>]+)>/g)].map((m) => m[1]);
  return {
    url: uris.find((u) => u.startsWith("http")),
    mailto: uris.find((u) => u.startsWith("mailto:")),
  };
}

// Searches Gmail for messages from targetCompany and reads the newest one's
// List-Unsubscribe headers (consistent per sender/campaign, so one message is
// enough to determine how to unsubscribe from all of them).
async function findUnsubscribeCandidates(oauthClient, targetCompany) {
  const gmail = google.gmail({ version: "v1", auth: oauthClient });
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: `from:(${targetCompany}) newer_than:180d -in:trash`,
    maxResults: 25,
  });
  const messages = listRes.data.messages || [];
  if (messages.length === 0) {
    return { matchCount: 0, messageIds: [], method: "not_found" };
  }

  const messageIds = messages.map((m) => m.id);
  const newest = await gmail.users.messages.get({
    userId: "me",
    id: messageIds[0],
    format: "metadata",
    metadataHeaders: ["List-Unsubscribe", "List-Unsubscribe-Post", "From"],
  });
  const hdrs = newest.data.payload?.headers || [];
  const { url, mailto } = parseListUnsubscribe(header(hdrs, "List-Unsubscribe"));
  const isOneClick = header(hdrs, "List-Unsubscribe-Post").toLowerCase().includes("one-click");

  let method = "not_found";
  if (url && isOneClick) method = "one_click"; // RFC 8058
  else if (url) method = "link";
  else if (mailto) method = "mailto";

  return {
    matchCount: messageIds.length,
    messageIds,
    method,
    unsubscribeUrl: url,
    unsubscribeMailto: mailto,
    fromHeader: header(hdrs, "From"),
  };
}

// Pulls the bare email address out of a "From" header like
// `Netflix <info@mailer.netflix.com>` (or returns it as-is if it's already bare).
function extractEmailAddress(fromHeader) {
  const match = (fromHeader || "").match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader || "").trim();
}

// Creates a Gmail filter that auto-deletes any future email from this sender
// — this is what makes the unsubscribe "stick" even if the sender ignores
// the unsubscribe request or keeps sending under the same address. Silently
// no-ops if an identical filter already exists (Gmail rejects duplicates).
async function createBlockFilter(oauthClient, fromHeader) {
  const fromAddress = extractEmailAddress(fromHeader);
  if (!fromAddress) return;

  const gmail = google.gmail({ version: "v1", auth: oauthClient });
  try {
    await gmail.users.settings.filters.create({
      userId: "me",
      requestBody: {
        criteria: { from: fromAddress },
        action: { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX", "UNREAD"] },
      },
    });
  } catch (err) {
    // Gmail 400s on an exact-duplicate filter — not worth surfacing as an error.
    console.warn(`[unsubscribe] Could not create block filter for ${fromAddress}:`, err.message);
  }
}

// Performs the actual unsubscribe (RFC 8058 one-click POST, plain link GET, or
// a mailto request), moves the matched messages to Trash, and creates a
// standing filter so any future email from this sender is auto-deleted too —
// a one-time unsubscribe isn't enough on its own if the sender doesn't honor it.
async function performUnsubscribe(oauthClient, candidates) {
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  try {
    if (candidates.method === "one_click") {
      await fetch(candidates.unsubscribeUrl, { method: "POST" });
    } else if (candidates.method === "link") {
      await fetch(candidates.unsubscribeUrl, { method: "GET" });
    } else if (candidates.method === "mailto") {
      const target = candidates.unsubscribeMailto.replace(/^mailto:/, "");
      const [to, queryString] = target.split("?");
      const params = new URLSearchParams(queryString || "");
      const subject = params.get("subject") || "unsubscribe";
      const lines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        "Please unsubscribe me from this mailing list.",
      ];
      const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    }
  } catch (err) {
    console.error("[unsubscribe] Failed to action the unsubscribe request:", err.message);
  }

  if (candidates.messageIds?.length) {
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: { ids: candidates.messageIds, addLabelIds: ["TRASH"] },
    });
  }

  await createBlockFilter(oauthClient, candidates.fromHeader);
}

// Shared by every adapter that can surface an unsubscribe loop (Notion,
// Calendar/Tasks) — turns a candidates result into the proposed_action text
// and action_schema for the approval card. Kept in one place so "found
// emails but no unsubscribe method on them" doesn't get misreported as "no
// emails found" (matchCount and method are independent — a sender can have
// matching emails with no List-Unsubscribe header at all).
function describeUnsubscribeInvestigation(candidates, targetCompany) {
  let proposedAction;
  if (candidates.matchCount === 0) {
    proposedAction = `Couldn't find any emails from ${targetCompany} to unsubscribe from.`;
  } else if (candidates.method === "not_found") {
    proposedAction = `Found ${candidates.matchCount} email${candidates.matchCount === 1 ? "" : "s"} from ${targetCompany}, but couldn't find an unsubscribe link on them. Approving will still move them to Trash and block future emails from this sender.`;
  } else {
    proposedAction = `Found ${candidates.matchCount} email${candidates.matchCount === 1 ? "" : "s"} from ${targetCompany}. Will unsubscribe (${candidates.method.replace("_", " ")}), move them to Trash, and block any future emails from this sender so they stop coming for good.`;
  }

  return {
    proposedAction,
    actionSchema: {
      type: "unsubscribe",
      targetCompany,
      matchCount: candidates.matchCount,
      method: candidates.method,
    },
  };
}

// Whether execute() has anything to actually do — true whenever matching
// emails exist, even without a formal unsubscribe method (trashing +
// blocking future mail is still worthwhile on its own).
function hasUnsubscribeWork(schema) {
  return schema?.type === "unsubscribe" && (schema.matchCount || 0) > 0;
}

module.exports = {
  findUnsubscribeCandidates,
  performUnsubscribe,
  describeUnsubscribeInvestigation,
  hasUnsubscribeWork,
};
