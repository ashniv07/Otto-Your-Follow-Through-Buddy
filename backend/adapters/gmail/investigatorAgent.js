const { loadAdk, runLlmAgent } = require("../../core/adkRunner");

const TODAY = new Date().toISOString().slice(0, 10);

async function buildAgent() {
  const { LlmAgent, FunctionTool } = await loadAdk();
  const { z } = await import("zod");

  // Custom tool: fetch carrier tracking status.
  // Production: call carrier APIs. Hackathon: realistic mock showing a stalled shipment.
  const fetchTrackingStatus = new FunctionTool({
    name: "fetch_tracking_status",
    description:
      "Fetches the current tracking status for a shipment given the carrier and tracking number. Returns status, last scan location, and whether the shipment is stalled.",
    parameters: z.object({
      carrier: z
        .string()
        .describe("Shipping carrier name: UPS, FedEx, USPS, DHL, or unknown"),
      trackingNumber: z
        .string()
        .describe("The tracking number for the shipment"),
    }),
    execute: async ({ carrier, trackingNumber }) => ({
      carrier,
      trackingNumber,
      status: "In Transit — Delayed",
      lastScan: new Date(Date.now() - 72 * 3600 * 1000).toISOString().slice(0, 10),
      lastLocation: "Regional Distribution Center",
      estimatedDelivery: "No updated estimate available",
      stalledDays: 3,
      message:
        "Package has not moved in 3 days. Last scanned at regional distribution center. No further updates from carrier.",
    }),
  });

  return new LlmAgent({
    name: "gmail_order_investigator_agent",
    model: "gemini-3.5-flash",
    description: "Investigates stalled deliveries and drafts a complaint or refund request message.",
    instruction: `Today is ${TODAY}.

You are investigating a stalled package delivery on behalf of a user.

Step 1: Call fetch_tracking_status with the carrier and tracking number from the order details.
Step 2: Based on the tracking result and order information, write a short, professional complaint or refund request that the user can send to the merchant.

The message must:
- Be addressed to "Customer Service"
- Reference the order ID and tracking number
- State that the package is overdue and has not moved in several days
- Request either a confirmed delivery date or a full refund
- Be polite and concise (3–4 sentences)

Respond with ONLY the draft message — no preamble, no subject line, no explanation.`,
    tools: [fetchTrackingStatus],
  });
}

async function investigateOrder(loop) {
  const ctx = loop.context || {};
  const rawSummary = ctx.raw_summary || "";

  // Parse tracking info embedded in raw_summary by the extraction step
  const trackingMatch = rawSummary.match(/Tracking:\s*([^\s|]+)/);
  const carrierMatch = rawSummary.match(/Carrier:\s*([^\s|]+)/);
  const orderIdMatch = rawSummary.match(/Order #([^\s|]+)/);

  const tracking = trackingMatch?.[1] || "not available";
  const carrier = carrierMatch?.[1] || "unknown";
  const orderId = orderIdMatch?.[1] || loop.source?.source_id || "unknown";

  const expectedBy =
    loop.expected_by?.toDate?.()?.toISOString?.()?.slice(0, 10) ||
    loop.expected_by ||
    "unknown";

  const daysLate = loop.expected_by
    ? Math.max(
        0,
        Math.floor(
          (Date.now() -
            (loop.expected_by.toDate?.() || new Date(loop.expected_by)).getTime()) /
            86400000
        )
      )
    : 0;

  const input = `Order details:
- Merchant: ${ctx.raw_title?.replace("Order from ", "") || "Unknown merchant"}
- Order ID: ${orderId}
- Expected delivery: ${expectedBy} (${daysLate} days ago)
- Tracking number: ${tracking}
- Carrier: ${carrier}

Please investigate and draft a complaint/refund message.`;

  const agent = await buildAgent();
  return await runLlmAgent(agent, input);
}

module.exports = { investigateOrder };
