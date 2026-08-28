const crypto = require("crypto");
const { google } = require("googleapis");

// Escapes single quotes for Drive's query-string mini-language ('...' string literals).
function escapeQueryTerm(term) {
  return term.replace(/'/g, "\\'");
}

const MAX_ATTACHABLE_BYTES = 20 * 1024 * 1024; // Gmail's raw-send limit is ~25MB total; leave headroom.

// Native Google file types have to be exported to a real file format before
// they can be attached to an email — Drive can't hand out their internal
// representation directly.
const EXPORT_TARGETS = {
  "application/vnd.google-apps.document": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: "pptx",
  },
};

// Finds the best-matching Drive file for a "please send me X" request. Scoped
// to Docs/Sheets/Slides/PDFs — the kinds of files someone would realistically
// ask to be sent. Picks the most recently modified match, a reasonable proxy
// for "the current version".
async function searchDriveFile(oauthClient, searchQuery) {
  if (!searchQuery) return null;
  const drive = google.drive({ version: "v3", auth: oauthClient });
  const term = escapeQueryTerm(searchQuery);
  const mimeTypes = [
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/pdf",
  ];
  const mimeFilter = mimeTypes.map((m) => `mimeType='${m}'`).join(" or ");

  const res = await drive.files.list({
    q: `trashed=false and (${mimeFilter}) and (name contains '${term}' or fullText contains '${term}')`,
    orderBy: "modifiedTime desc",
    pageSize: 1,
    fields: "files(id,name,mimeType,size,webViewLink)",
  });

  const file = res.data.files?.[0];
  if (!file) return null;
  return {
    fileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink,
  };
}

// Downloads the file's bytes ready to attach to an email — exporting native
// Google Docs/Sheets/Slides to a real format, or downloading raw bytes for
// anything already binary (PDF, uploaded docx, etc). Returns null if the
// file is too large to safely attach.
async function downloadFileForAttachment(oauthClient, { fileId, fileName, mimeType, size }) {
  const drive = google.drive({ version: "v3", auth: oauthClient });
  const exportTarget = EXPORT_TARGETS[mimeType];

  if (!exportTarget && size && size > MAX_ATTACHABLE_BYTES) {
    return null;
  }

  let res;
  let attachmentMimeType;
  let attachmentName = fileName;

  if (exportTarget) {
    res = await drive.files.export(
      { fileId, mimeType: exportTarget.mimeType },
      { responseType: "arraybuffer" },
    );
    attachmentMimeType = exportTarget.mimeType;
    if (!attachmentName.toLowerCase().endsWith(`.${exportTarget.ext}`)) {
      attachmentName = `${fileName}.${exportTarget.ext}`;
    }
  } else {
    res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
    attachmentMimeType = mimeType || "application/octet-stream";
  }

  const base64Content = Buffer.from(res.data).toString("base64");
  if (base64Content.length > MAX_ATTACHABLE_BYTES * 1.4) return null; // base64 inflates size ~1.37x

  return { fileName: attachmentName, mimeType: attachmentMimeType, base64Content };
}

// Builds a raw RFC 2822 multipart/mixed message (base64url-encoded, ready for
// gmail.users.messages.send) with a text body plus one file attachment.
function buildRawMessageWithAttachment({ to, cc, subject, bodyText, attachment }) {
  const boundary = `otto_${crypto.randomBytes(12).toString("hex")}`;
  const headerLines = [
    to ? `To: ${to}` : "",
    cc ? `Cc: ${cc}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);

  const textPart = [`--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "", bodyText].join("\r\n");

  // RFC 2045 recommends wrapping base64 content at 76 characters per line.
  const wrappedContent = attachment.base64Content.replace(/(.{76})/g, "$1\r\n");
  const attachmentPart = [
    `--${boundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.fileName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.fileName}"`,
    "",
    wrappedContent,
  ].join("\r\n");

  const message = [...headerLines, "", textPart, attachmentPart, `--${boundary}--`].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

module.exports = { searchDriveFile, downloadFileForAttachment, buildRawMessageWithAttachment };
