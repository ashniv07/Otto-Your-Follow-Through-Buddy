const { loadAdk, runLlmAgentJson } = require("../../core/adkRunner");

const TODAY = new Date().toISOString().slice(0, 10);

const INSTRUCTION = `Today's date is ${TODAY}.

You are an extraction agent. Given an order confirmation or shipping email, extract the order details and return ONLY a valid JSON object with no markdown or extra text.

FIRST — if this email is any of the following, return ONLY {"skip": true} and nothing else:
- A food/restaurant order (dine-in confirmation, meal delivery, Swiggy, Zomato, food court, cloud kitchen, any restaurant)
- A service booking (cab, salon, spa, hotel check-in/check-out)
- A payment receipt for a service already rendered
- A UPI/bank transaction notification
These are fulfilled instantly and need no tracking.

Otherwise, return exactly these fields:
{
  "merchant": string — company or store name (e.g. "Amazon", "Nike", "Best Buy"),
  "item_summary": string — 1-line description of what was ordered,
  "order_id": string — order number or ID found in the email (use "unknown" if not present),
  "expected_delivery_date": string — ISO date YYYY-MM-DD for expected delivery. Use the later date if a range is given. Infer from context if not explicit,
  "tracking_number": string or null — tracking or shipment number if present,
  "carrier": string or null — shipping carrier name: UPS, FedEx, USPS, DHL, or null if unknown,
  "stakes": "money"
}`;

async function buildAgent() {
  const { LlmAgent } = await loadAdk();
  return new LlmAgent({
    name: "gmail_order_extraction_agent",
    model: "gemini-2.5-flash",
    description: "Extracts structured order data from order confirmation or shipping emails.",
    instruction: INSTRUCTION,
  });
}

async function extractFromOrderEmail(emailData) {
  const agent = await buildAgent();
  const input = `Subject: ${emailData.subject}
From: ${emailData.from || ""}
Date: ${emailData.date || ""}

${emailData.body}`;
  return await runLlmAgentJson(agent, input);
}

module.exports = { extractFromOrderEmail };
