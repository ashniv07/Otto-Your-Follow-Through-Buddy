const { google } = require("googleapis");
require("../../core/firestoreClient"); // ensure firebase-admin is initialised
const { getClientFromConnection } = require("../google/auth");
const { loadAdk, runLlmAgentJson } = require("../../core/adkRunner");

// Scoped to Docs/Sheets/Slides — the file types the demo and Connections copy
// both promise ("comments on your Docs/Slides"). Bounded to the last 30 days
// so this stays a cheap recency scan, same reasoning as gmail's newer_than
// windows, rather than walking a user's entire Drive on every tick.
const RECENT_WINDOW_DAYS = 30;
const FILE_QUERY_BASE =
  "trashed=false and (mimeType='application/vnd.google-apps.document' or " +
  "mimeType='application/vnd.google-apps.spreadsheet' or " +
  "mimeType='application/vnd.google-apps.presentation')";

const REPLY_INSTRUCTION = `You are Otto's Google Docs comment-reply agent. You're shown a comment
someone left on a document (any quoted text it's attached to, and any prior
replies already on the thread) and must draft Otto's reply on behalf of the
document's owner/collaborator.

Return ONLY valid JSON (no markdown, no code blocks, no extra text):
{
  "can_answer": boolean,
  "reply_text": string,
  "question": string
}

Field rules:
- can_answer: true only if you can draft a specific, useful reply directly
  from the comment + quoted text + prior replies (answering a question the
  context already answers, acknowledging a suggestion, confirming a change).
  false if it asks for information, a decision, or content only the actual
  document owner would know (a number, a personal opinion, approval of
  something specific, anything you'd be guessing at).
- reply_text: when can_answer is true, a short (1-3 sentence) natural reply
  that references the actual comment content — never generic filler like
  "Thanks for your comment." Empty string when can_answer is false.
- question: when can_answer is false, one short question asking the user
  what Otto should reply with. Empty string when can_answer is true.`;

function commentSourceId(fileId, commentId) {
  return `${fileId}:${commentId}`;
}

function parseSourceId(sourceId) {
  const [fileId, commentId] = (sourceId || "").split(":");
  return { fileId, commentId };
}

// True once there's nothing left for Otto to do on this comment — either the
// user themself wrote it, they've already replied, or someone (any
// collaborator) has marked it resolved.
function isHandled(comment, email) {
  if (comment.resolved) return true;
  const authorEmail = (comment.author?.emailAddress || "").toLowerCase();
  if (email && authorEmail === email) return true;
  return (comment.replies || []).some(
    (r) => (r.author?.emailAddress || "").toLowerCase() === email,
  );
}

async function fetchNewItems(connection) {
  if (!connection?.access_token || !connection.email) return [];
  const userId = connection.user_id;
  const email = connection.email.toLowerCase();
  const client = getClientFromConnection(connection);
  const drive = google.drive({ version: "v3", auth: client });
  const results = [];

  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const filesRes = await drive.files.list({
      q: `${FILE_QUERY_BASE} and modifiedTime > '${since}'`,
      orderBy: "modifiedTime desc",
      pageSize: 15,
      fields: "files(id,name)",
    });
    const files = filesRes.data.files || [];

    for (const file of files) {
      try {
        const commentsRes = await drive.comments.list({
          fileId: file.id,
          pageSize: 20,
          fields:
            "comments(id,content,resolved,createdTime,quotedFileContent,author(displayName,emailAddress)," +
            "replies(content,author(emailAddress)))",
        });
        const comments = commentsRes.data.comments || [];
        for (const comment of comments) {
          if (isHandled(comment, email)) continue;

          results.push({
            user_id: userId,
            loop_type: "docs",
            source: { adapter: "docs", source_id: commentSourceId(file.id, comment.id), file_id: file.id },
            expected_state: "replied",
            expected_by: new Date().toISOString().slice(0, 10),
            current_state: "awaiting reply",
            stakes: "low",
            context: {
              raw_title: `Comment on "${file.name}"`,
              raw_summary:
                `${comment.author?.displayName || "Someone"} commented on "${file.name}": ` +
                `"${(comment.content || "").slice(0, 200)}"`,
            },
          });
        }
      } catch (err) {
        console.warn(`[docs] Comment scan failed for file ${file.id}:`, err.message);
      }
    }
  } catch (err) {
    console.warn("[docs] File scan failed:", err.message);
  }

  return results;
}

async function recheck(loop, connection) {
  if (!connection?.access_token) return loop.current_state;
  const { fileId, commentId } = parseSourceId(loop.source?.source_id);
  if (!fileId || !commentId) return loop.current_state;
  try {
    const client = getClientFromConnection(connection);
    const drive = google.drive({ version: "v3", auth: client });
    const res = await drive.comments.get({
      fileId,
      commentId,
      fields: "resolved,replies(author(emailAddress))",
    });
    if (isHandled(res.data, (connection.email || "").toLowerCase())) return loop.expected_state;
  } catch { /* comment or file may have been deleted */ }
  return loop.current_state;
}

async function investigate(loop, connections = {}) {
  if (!connections.google?.access_token) return null;
  const { fileId, commentId } = parseSourceId(loop.source?.source_id);
  if (!fileId || !commentId) return null;

  try {
    const client = getClientFromConnection(connections.google);
    const drive = google.drive({ version: "v3", auth: client });
    const res = await drive.comments.get({
      fileId,
      commentId,
      fields: "content,quotedFileContent,author(displayName),replies(author(displayName),content)",
    });
    const comment = res.data;

    const { LlmAgent } = await loadAdk();
    const agent = new LlmAgent({
      name: "docs_reply_agent",
      model: "gemini-3.5-flash",
      description: "Drafts a short reply to a Google Docs/Sheets/Slides comment.",
      instruction: REPLY_INSTRUCTION,
    });

    const priorReplies = (comment.replies || [])
      .map((r) => `${r.author?.displayName || "Someone"}: ${r.content}`)
      .join("\n");
    const input = `Document: ${loop.context?.raw_title || ""}
Quoted text: ${comment.quotedFileContent?.value || "(none)"}
Comment from ${comment.author?.displayName || "someone"}: ${comment.content}
${priorReplies ? `Prior replies on this thread:\n${priorReplies}` : "No prior replies."}`;

    const draft = await runLlmAgentJson(agent, input);

    if (draft?.can_answer === false) {
      return {
        proposedAction: draft.question || "Otto isn't sure how to answer this comment — what should it reply?",
        actionSchema: {
          type: "needs_resource",
          question: draft.question || "What should Otto reply with?",
        },
      };
    }

    return {
      proposedAction: draft?.reply_text || "",
      actionSchema: { type: "doc_reply", replyText: draft?.reply_text || "" },
    };
  } catch (err) {
    console.error("[docs] investigate failed:", err.message);
    return null;
  }
}

// Posts the reply as a genuine threaded comment reply via the Drive API
// (drive.replies.create) — not an email, so it lands directly on the
// comment thread the same way replying in the Docs UI would.
async function execute(loop, connections = {}) {
  const connection = connections.google;
  if (!connection?.access_token) return;
  const { fileId, commentId } = parseSourceId(loop.source?.source_id);
  if (!fileId || !commentId) return;

  const schema = loop.context?.action_schema;
  const replyText =
    schema?.type === "doc_reply" ? schema.replyText
    : schema?.type === "needs_resource" ? schema.resourceAnswer
    : null;
  if (!replyText) return;

  try {
    const client = getClientFromConnection(connection);
    const drive = google.drive({ version: "v3", auth: client });
    await drive.replies.create({
      fileId,
      commentId,
      fields: "id",
      requestBody: { content: replyText },
    });
    console.log(`[docs] Posted reply to comment ${commentId} on file ${fileId}`);
  } catch (err) {
    console.error("[docs] Failed to post comment reply:", err.message);
  }
}

module.exports = { fetchNewItems, recheck, investigate, execute };
