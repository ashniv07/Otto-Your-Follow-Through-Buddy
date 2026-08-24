import type { Connection, OpenLoop, PipelineEvent } from "../types";

/**
 * All demo data lives in this one file. Nothing outside `src/lib` and
 * `src/hooks` should import from here directly — go through the hooks in
 * `src/hooks/useOttoStore.tsx` so swapping this for real API calls later
 * only touches one place.
 */

export const initialLoops: OpenLoop[] = [
  {
    id: "loop-001",
    loopType: "order",
    title: "Anker 65W Charger — Order #A2291",
    expectedState: "Delivered to front door",
    expectedBy: "2026-08-20",
    currentState: "Carrier scan frozen at “Out for delivery” since Aug 20, 2:02 PM",
    status: "stalled",
    stakes: "low",
    context: {
      rawSummary:
        "Gmail order confirmation from Anker via UPS, dated Aug 15. Promised delivery Aug 20. Last UPS tracking event: “Out for delivery” at 2:02 PM on Aug 20. No scan since — 4 days with no movement.",
    },
    createdAt: "2026-08-15T06:00:00Z",
    updatedAt: "2026-08-24T06:00:00Z",
  },
  {
    id: "loop-002",
    loopType: "subscription",
    title: "Adobe Creative Cloud — All Apps",
    expectedState: "Monthly charge stays at $59.99",
    expectedBy: "2026-08-22",
    currentState: "Charged $74.99 on Aug 22 — a $15/mo increase, no renewal notice found",
    status: "needs_approval",
    stakes: "money",
    context: {
      rawSummary:
        "Gmail receipt from Adobe dated Aug 22: “Your payment of $74.99 was successful.” The prior 11 receipts going back to last September all show $59.99.",
      investigationNotes:
        "Searched the inbox back to January for a price-change notice — none found. Adobe's plan page now lists “All Apps” at $74.99/mo. Cross-referenced Creative Cloud usage logs: Photoshop accounts for 91% of actual app opens in the last 90 days. A single-app Photoshop plan is $23.99/mo.",
      proposedAction:
        "Downgrade to the Photoshop single-app plan, saving ~$51/mo. Downgrade request is drafted and ready to submit through Adobe account settings.",
    },
    createdAt: "2026-08-15T06:00:00Z",
    updatedAt: "2026-08-23T06:00:00Z",
  },
  {
    id: "loop-003",
    loopType: "calendar",
    title: "Renew passport before expiry",
    expectedState: "DS-82 renewal form submitted",
    expectedBy: "2026-08-18",
    currentState: "Calendar task still marked incomplete, 6 days overdue",
    status: "stalled",
    stakes: "irreversible",
    context: {
      rawSummary:
        "Google Calendar task “Renew passport — expires Nov 2026” created Aug 1 with a due date of Aug 18. No completion logged, and no confirmation email received since.",
    },
    createdAt: "2026-08-15T06:00:00Z",
    updatedAt: "2026-08-24T06:00:00Z",
  },
  {
    id: "loop-004",
    loopType: "order",
    title: "Return: Nike Pegasus 41 (wrong size)",
    expectedState: "Refund issued after return received",
    expectedBy: "2026-08-21",
    currentState: "Return delivered to Nike's returns center Aug 21, refund not yet posted",
    status: "investigating",
    stakes: "money",
    context: {
      rawSummary:
        "Gmail return confirmation from Nike dated Aug 17. USPS tracking shows the return package delivered to Nike's returns center on Aug 21.",
      investigationNotes:
        "Nike's stated refund SLA is 5–7 business days after receipt. 3 business days have elapsed so far — still inside the window. Will escalate to Nike support automatically if no refund posts by Aug 28.",
    },
    createdAt: "2026-08-18T06:00:00Z",
    updatedAt: "2026-08-24T06:00:00Z",
  },
  {
    id: "loop-005",
    loopType: "subscription",
    title: "Peloton App — free trial",
    expectedState: "Cancel before trial converts to paid",
    expectedBy: "2026-08-19",
    currentState: "Subscription cancelled Aug 18 — no charge posted",
    status: "resolved",
    stakes: "low",
    context: {
      rawSummary:
        "Signup confirmation dated Aug 5: “30-day free trial, first charge Aug 19 unless cancelled.” No workout activity or app-open receipts found in Gmail or Calendar after Aug 10.",
      investigationNotes:
        "No usage signal for 8+ days before the charge date — treated as an abandoned trial. No money had moved yet, so this was safe to resolve without approval.",
      proposedAction: "Cancelled the trial via the Peloton account API before it converted, avoiding a $44/mo charge.",
    },
    createdAt: "2026-08-18T06:00:00Z",
    updatedAt: "2026-08-18T06:05:00Z",
    resolvedAt: "2026-08-18T06:05:00Z",
  },
  {
    id: "loop-006",
    loopType: "calendar",
    title: "Car registration renewal",
    expectedState: "Registration renewed online before expiry",
    expectedBy: "2026-08-10",
    currentState: "Renewed via DMV online portal — confirmation #DMV-77291 received",
    status: "resolved",
    stakes: "irreversible",
    context: {
      rawSummary:
        "Google Calendar task “Renew car registration — due Aug 10” created Aug 1 (recurring annual task, identical to last year's).",
      investigationNotes:
        "DMV's online renewal portal accepts the saved payment method on file. The fee ($82) matches last year's renewal exactly — flagged for approval anyway since it touches payment and a government filing.",
      proposedAction: "Submit DMV registration renewal using the saved payment method. Approved by you on Aug 9 — confirmation #DMV-77291 received.",
    },
    createdAt: "2026-08-08T06:00:00Z",
    updatedAt: "2026-08-09T08:20:00Z",
    resolvedAt: "2026-08-09T08:20:00Z",
  },
  {
    id: "loop-007",
    loopType: "note",
    title: "Follow up: security deposit from old landlord",
    expectedState: "Deposit refund ($1,400) received or a written response",
    expectedBy: "2026-08-01",
    currentState: "No reply to the Aug 1 follow-up email — researching the state deposit-return deadline",
    status: "investigating",
    stakes: "money",
    context: {
      rawSummary:
        "Notion note dated Jul 15: “Emailed landlord about deposit, no response after 2 weeks — follow up if nothing by Aug 1.” Gmail shows a follow-up sent Aug 1 with no reply since.",
      investigationNotes:
        "Checking state tenant law for the statutory deposit-return deadline — most states require 14–30 days, and the landlord is now well past it. Drafting a formal demand letter citing the specific statute.",
    },
    createdAt: "2026-08-21T06:00:00Z",
    updatedAt: "2026-08-24T06:00:00Z",
  },
  {
    id: "loop-008",
    loopType: "order",
    title: "Kitchen mixer — missing replacement part",
    expectedState: "Replacement whisk attachment received",
    expectedBy: "2026-08-15",
    currentState: "KitchenAid support ticket #KA-58231 open 9 days with no reply",
    status: "needs_approval",
    stakes: "money",
    context: {
      rawSummary:
        "Support ticket #KA-58231 opened Aug 15 after the replacement whisk didn't arrive with the original order. No response from KitchenAid support after 9 days — their stated SLA is 3 business days.",
      investigationNotes:
        "SLA breached by 6 business days with zero response on the open ticket. Two viable paths: escalate the existing ticket again, or open a credit card dispute for the missing item.",
      proposedAction: "File a credit card dispute for the missing $34.99 part, since KitchenAid support has gone silent well past their own SLA.",
    },
    createdAt: "2026-08-18T06:00:00Z",
    updatedAt: "2026-08-23T14:32:00Z",
  },
  {
    id: "loop-009",
    loopType: "subscription",
    title: "New York Times — Digital subscription",
    expectedState: "Promotional rate of $4.99/mo continues through the 12-month term",
    expectedBy: "2026-08-23",
    currentState: "Charged $12.99 on Aug 23 — an $8/mo increase, flagged but not yet investigated",
    status: "stalled",
    stakes: "money",
    context: {
      rawSummary:
        "Gmail receipt Aug 23: “Thank you for your payment of $12.99.” The prior 7 monthly receipts back to January all show $4.99. The original signup email (Dec 2025) promised “12 months at $4.99, then standard rate applies.”",
    },
    createdAt: "2026-08-23T06:00:00Z",
    updatedAt: "2026-08-24T06:00:00Z",
  },
  {
    id: "loop-010",
    loopType: "note",
    title: "Idea: switch car insurance before renewal",
    expectedState: "Compare quotes and switch or renew before Aug 12 expiry",
    expectedBy: "2026-08-12",
    currentState: "Renewed with current provider — quotes compared, no cheaper option found",
    status: "resolved",
    stakes: "low",
    context: {
      rawSummary:
        "Notion note dated Jul 20: “Insurance renews Aug 12 — check if switching saves money.”",
      investigationNotes:
        "Pulled 3 comparison quotes via saved email alerts (Geico, Progressive, State Farm). All three landed within 4% of the current premium — no meaningful savings available.",
      proposedAction: "No action needed. Closed the loop with a summary of the quotes compared.",
    },
    createdAt: "2026-08-08T06:00:00Z",
    updatedAt: "2026-08-18T06:05:00Z",
    resolvedAt: "2026-08-18T06:05:00Z",
  },
];

export const initialPipelineEvents: PipelineEvent[] = [
  // Run — Aug 8, 6:00 AM (nightly)
  { id: "evt-001", runId: "run-2026-08-08-0600", timestamp: "2026-08-08T06:00:00Z", type: "new_loop", message: "New loop created: Car registration renewal — due Aug 10 (recurring)", loopId: "loop-006" },
  { id: "evt-002", runId: "run-2026-08-08-0600", timestamp: "2026-08-08T06:01:00Z", type: "new_loop", message: "New loop created: Car insurance renewal review — due Aug 12", loopId: "loop-010" },
  { id: "evt-003", runId: "run-2026-08-08-0600", timestamp: "2026-08-08T06:04:00Z", type: "needs_approval", message: "Car registration renewal ready — DMV form pre-filled, fee matches last year, awaiting approval", loopId: "loop-006" },

  // Run — Aug 9, 8:15 AM (on-demand, user checked in)
  { id: "evt-004", runId: "run-2026-08-09-0815", timestamp: "2026-08-09T08:15:00Z", type: "user_approved", message: "You approved the car registration renewal — submitting to DMV", loopId: "loop-006" },
  { id: "evt-005", runId: "run-2026-08-09-0815", timestamp: "2026-08-09T08:20:00Z", type: "auto_resolved", message: "Car registration renewal confirmed — DMV confirmation #DMV-77291 received", loopId: "loop-006" },

  // Run — Aug 15, 6:00 AM (nightly)
  { id: "evt-006", runId: "run-2026-08-15-0600", timestamp: "2026-08-15T06:00:00Z", type: "new_loop", message: "New loop created: Anker 65W Charger order — tracking order #A2291", loopId: "loop-001" },
  { id: "evt-007", runId: "run-2026-08-15-0600", timestamp: "2026-08-15T06:01:00Z", type: "new_loop", message: "New loop created: Adobe Creative Cloud subscription — added to price watch", loopId: "loop-002" },
  { id: "evt-008", runId: "run-2026-08-15-0600", timestamp: "2026-08-15T06:02:00Z", type: "new_loop", message: "New loop created: Renew passport before expiry — due Aug 18", loopId: "loop-003" },

  // Run — Aug 18, 6:00 AM (nightly)
  { id: "evt-009", runId: "run-2026-08-18-0600", timestamp: "2026-08-18T06:00:00Z", type: "auto_resolved", message: "Car insurance review closed — 3 quotes compared, no savings found, kept current plan", loopId: "loop-010" },
  { id: "evt-010", runId: "run-2026-08-18-0600", timestamp: "2026-08-18T06:02:00Z", type: "new_loop", message: "New loop created: Nike Pegasus 41 return — refund tracking started", loopId: "loop-004" },
  { id: "evt-011", runId: "run-2026-08-18-0600", timestamp: "2026-08-18T06:03:00Z", type: "new_loop", message: "New loop created: Peloton App free trial — renewal watch set for Aug 19", loopId: "loop-005" },
  { id: "evt-012", runId: "run-2026-08-18-0600", timestamp: "2026-08-18T06:05:00Z", type: "auto_resolved", message: "Peloton App trial cancelled automatically — no usage detected since signup, avoided a $44 charge", loopId: "loop-005" },
  { id: "evt-013", runId: "run-2026-08-18-0600", timestamp: "2026-08-18T06:06:00Z", type: "new_loop", message: "New loop created: KitchenAid replacement part — support ticket opened", loopId: "loop-008" },

  // Run — Aug 21, 6:00 AM (nightly)
  { id: "evt-014", runId: "run-2026-08-21-0600", timestamp: "2026-08-21T06:00:00Z", type: "stall_detected", message: "Anker charger delivery flagged stalled — no tracking scan since Aug 20", loopId: "loop-001" },
  { id: "evt-015", runId: "run-2026-08-21-0600", timestamp: "2026-08-21T06:01:00Z", type: "stall_detected", message: "Passport renewal task flagged — 3 days overdue, no submission detected", loopId: "loop-003" },
  { id: "evt-016", runId: "run-2026-08-21-0600", timestamp: "2026-08-21T06:03:00Z", type: "investigating", message: "Started investigating Nike return refund timeline", loopId: "loop-004" },
  { id: "evt-017", runId: "run-2026-08-21-0600", timestamp: "2026-08-21T06:05:00Z", type: "new_loop", message: "New loop created: Security deposit follow-up — no landlord reply since Aug 1", loopId: "loop-007" },

  // Run — Aug 23, 6:00 AM (nightly)
  { id: "evt-018", runId: "run-2026-08-23-0600", timestamp: "2026-08-23T06:00:00Z", type: "new_loop", message: "New loop created: New York Times subscription — price change flagged", loopId: "loop-009" },
  { id: "evt-019", runId: "run-2026-08-23-0600", timestamp: "2026-08-23T06:02:00Z", type: "needs_approval", message: "Adobe Creative Cloud price hike confirmed ($59.99 → $74.99) — downgrade drafted, awaiting approval", loopId: "loop-002" },
  { id: "evt-020", runId: "run-2026-08-23-0600", timestamp: "2026-08-23T06:04:00Z", type: "investigating", message: "Investigating KitchenAid support silence — SLA breached by 6 business days", loopId: "loop-008" },

  // Run — Aug 23, 2:32 PM (on-demand)
  { id: "evt-021", runId: "run-2026-08-23-1432", timestamp: "2026-08-23T14:32:00Z", type: "needs_approval", message: "KitchenAid support SLA breach confirmed — credit card dispute drafted, awaiting approval", loopId: "loop-008" },

  // Run — Aug 24, 6:00 AM (nightly, most recent)
  { id: "evt-022", runId: "run-2026-08-24-0600", timestamp: "2026-08-24T06:00:00Z", type: "stall_detected", message: "New York Times price hike confirmed stalled — investigation not yet started", loopId: "loop-009" },
  { id: "evt-023", runId: "run-2026-08-24-0600", timestamp: "2026-08-24T06:02:00Z", type: "investigating", message: "Started investigating security deposit follow-up — researching state statute", loopId: "loop-007" },
];

export const initialConnections: Connection[] = [
  {
    id: "conn-gmail",
    name: "Gmail",
    description: "Watches order confirmations, receipts, and support threads for stalled deliveries, price changes, and unanswered requests.",
    status: "connected",
  },
  {
    id: "conn-calendar",
    name: "Google Calendar",
    description: "Watches tasks and events for due dates that pass with no linked completion.",
    status: "connected",
  },
  {
    id: "conn-notes",
    name: "Notes",
    description: "Watches saved notes and commitments (Notion) for follow-ups that were never logged.",
    status: "connected",
  },
];

export const futureAdapters = [
  { name: "Slack", description: "Track commitments made in DMs and channel threads." },
  { name: "Bank statements", description: "Catch silent fee increases and duplicate charges." },
  { name: "Amazon orders", description: "Watch order status directly, no inbox forwarding needed." },
  { name: "Todoist / Asana", description: "Extend stall detection to team and project tasks." },
];