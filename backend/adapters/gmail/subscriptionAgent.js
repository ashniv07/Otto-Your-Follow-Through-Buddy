const { loadAdk, runLlmAgentJson, runLlmAgent } = require("../../core/adkRunner");

const TODAY = new Date().toISOString().slice(0, 10);

const EXTRACTION_INSTRUCTION = `Today is ${TODAY}.

You are a billing analysis agent. Read the email and determine whether it notifies the user of a subscription price change or an unexpected new charge.

Return ONLY a valid JSON object with no markdown or extra text:
{
  "is_price_change": boolean — true ONLY if this email explicitly shows a price increase or an unexpected new charge the user may not have agreed to,
  "service_name": string — name of the subscription service (e.g. "Netflix", "Spotify", "Adobe Creative Cloud"),
  "old_amount": string or null — previous price with currency symbol (e.g. "₹199/month", "$9.99/month"),
  "new_amount": string or null — new price with currency symbol,
  "effective_date": string — ISO date YYYY-MM-DD when new price takes effect (use today if not mentioned),
  "summary": string — one-line plain-English description (e.g. "Netflix raised price from ₹499 to ₹649/month")
}

Rules:
- Set is_price_change: true for: explicit price increases, new fees added, plan downgrades with same price, surprise charges
- Set is_price_change: false for: regular expected invoices at the same amount, successful payment confirmations at known price, receipts with no price change
- If you cannot determine the old amount, still set is_price_change: true if a price increase is clearly communicated`;

async function buildExtractionAgent() {
  const { LlmAgent } = await loadAdk();
  return new LlmAgent({
    name: "subscription_extraction_agent",
    model: "gemini-3.5-flash",
    description: "Detects subscription price changes in billing emails.",
    instruction: EXTRACTION_INSTRUCTION,
  });
}

async function extractFromBillingEmail(emailData) {
  const agent = await buildExtractionAgent();
  const input = `Subject: ${emailData.subject}
From: ${emailData.from || ""}
Date: ${emailData.date || ""}

${emailData.body}`;
  return await runLlmAgentJson(agent, input);
}

async function buildInvestigatorAgent() {
  const { LlmAgent } = await loadAdk();
  return new LlmAgent({
    name: "subscription_investigator_agent",
    model: "gemini-3.5-flash",
    description: "Drafts a response to a subscription price change.",
    instruction: `Today is ${TODAY}.

You help users respond to unexpected subscription price increases.

Write a short, professional email the user can send to the service's billing support requesting either:
- A revert to the original price (if they've been a long-term subscriber), or
- Cancellation of the subscription if the price is no longer acceptable

The email must:
- Start with "Dear Billing Support,"
- Reference the service name and the specific price change (old → new)
- Mention that the user was not adequately informed
- Request a resolution: revert the price OR process a cancellation and refund
- Be polite but firm (4–5 sentences max)

Respond with ONLY the draft email body — no subject line, no preamble, no explanation.`,
  });
}

async function investigateSubscription(loop) {
  const ctx = loop.context || {};
  const agent = await buildInvestigatorAgent();
  const input = `Service: ${ctx.service_name || "the subscription service"}
Price change: ${ctx.raw_summary || loop.current_state}
Context: ${ctx.investigation_notes || ""}`;
  return await runLlmAgent(agent, input);
}

module.exports = { extractFromBillingEmail, investigateSubscription };
