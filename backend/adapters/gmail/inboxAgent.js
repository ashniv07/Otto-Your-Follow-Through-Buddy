const { loadAdk, runLlmAgentJson } = require("../../core/adkRunner");

const TODAY = new Date().toISOString().slice(0, 10);

const INSTRUCTION = `Today is ${TODAY}.

You are Otto's inbox intelligence agent. Your job is to scan emails and surface anything that needs the user's attention — anything at all. Be a proactive assistant, not a filter that only knows about orders.

Read the email and return ONLY valid JSON (no markdown, no code blocks, no extra text):
{
  "should_surface": boolean,
  "loop_type": "order" | "subscription" | "opportunity" | "follow_up" | "file_request",
  "title": string,
  "summary": string,
  "expected_state": string,
  "expected_by": string,
  "stakes": "money" | "irreversible" | "low",
  "action_schema": {
    "type": "compose" | "info" | "file_request",
    "to": string,
    "cc": string,
    "subject": string,
    "body": string,
    "headline": string,
    "detail": string,
    "searchQuery": string
  }
}

Field rules:
- title: 5–8 words, capitalized like a headline (e.g. "Netflix Price Increased ₹150/Month")
- summary: 1–2 sentences explaining what Otto noticed and why it matters
- expected_state: what "done" or "resolved" looks like (e.g. "replied to recruiter", "acknowledged price change")
- expected_by: ISO date YYYY-MM-DD — use today if urgent/already past due, today+3 if soon, today+7 if unclear
- stakes: money = financial impact; irreversible = career/contracts/legal; low = social/casual

Loop type classification:
- order: package orders, delivery confirmations, shipping updates
- subscription: billing changes, price increases, unexpected charges, plan changes
- opportunity: job offers, internship invites, partnership proposals, scholarship or grant notifications, event invitations worth acting on
- follow_up: emails clearly waiting for a reply or decision from the user (unanswered questions, pending approvals, interview scheduling, client requests)
- file_request: someone is asking the user to send/share a specific document, deck, resume, report, or spreadsheet they already have

file_request spam/phishing caution: an unsolicited request for a sensitive
document (financial records, credentials, IDs, contracts) from a sender you
don't recognize as a known contact is a classic pretexting pattern — still
set should_surface: true so the user sees it (nothing here ever auto-sends
anything), but keep stakes at "money" or "irreversible" rather than "low" so
it's clear extra scrutiny is warranted before approving. A casual, plausible
request from an apparent colleague/contact for an ordinary document (resume,
slide deck, notes) is "low" stakes as normal.

Set should_surface: false for:
- Newsletters, marketing emails, promotional discount emails
- Social media notifications (Twitter/LinkedIn/Instagram activity)
- ANY food payment receipt (Swiggy, Zomato, restaurant, dine-in, UPI payment to food merchant) — these are instant transactions, never surface them
- ANY successful payment receipt or "payment processed" notification where no action is needed
- Automated system alerts with no user action required
- Spam
- "X shared Y with you" notifications — access-grant emails where someone shares a document, dataset, spreadsheet, link, or file (Google Docs/Sheets, Notion, Kaggle, Claude, Dropbox, etc.) — the resource is already accessible, no reply needed
- OTP, verification code, confirmation code, login code, 2FA code, or one-time password emails — these are transient security codes, never surface them
- Notification-only emails from apps/services (e.g. Notion mentions, Slack codes, GitHub activity digests) where the email is purely informational and no email reply is expected

Set should_surface: true for:
- Job offers, internship invites, partnership proposals — even if they look like outreach
- Follow-up emails waiting for a reply — even if they look like sales emails
- Subscription price changes or unexpected billing changes
- Anything the user would regret ignoring

action_schema rules:
- Use "compose" when the right response is an email (reply, inquiry, complaint, job application, etc.)
- Use "info" when the user just needs to be made aware (price change alert, billing notice, deadline warning)
- Use "file_request" (matching loop_type "file_request") when the email asks for a document to be sent
- For "compose": fill ALL four fields (to, cc, subject, body) — body should be 3–5 sentences, professional, ready to send with minimal edits
- For "info": fill headline (one punchy line) and detail (full explanation with numbers/dates)
- For "file_request": fill "to" (the requester's email address), "subject" (a reply subject), and "searchQuery" — your best guess at the filename/keywords to search Drive for (e.g. "resume", "Q3 budget deck", "project proposal"), based on what they described
- Leave unused fields as empty string ""
- For "compose" to address: use the sender's email if replying; use a support email if escalating; infer from context`;

async function classifyEmail(emailData) {
  const { LlmAgent } = await loadAdk();
  const agent = new LlmAgent({
    name: "inbox_intelligence_agent",
    model: "gemini-2.5-flash",
    description: "Classifies any email and determines if it needs user attention or action.",
    instruction: INSTRUCTION,
  });

  const input = `Subject: ${emailData.subject}
From: ${emailData.from || ""}
Date: ${emailData.date || ""}

${emailData.body.slice(0, 3000)}`;

  return await runLlmAgentJson(agent, input);
}

module.exports = { classifyEmail };
