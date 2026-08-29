const { Timestamp } = require("firebase-admin/firestore");
const { randomUUID } = require("crypto");

const LOOP_TYPES = ["note", "subscription", "calendar", "order", "opportunity", "follow_up", "docs", "unsubscribe", "file_request"];

// Loop types that can never resolve on their own before their due date — a
// Docs comment doesn't get answered by waiting, a file request doesn't send
// itself, an unsubscribe task doesn't unsubscribe itself, and a subscription/
// opportunity/follow-up email is inherently "waiting on you" from the moment
// it's spotted. schedulerJob investigates and surfaces these immediately on
// creation instead of sitting in "pending" until expected_by passes — unlike
// order/calendar/note loops, which genuinely might resolve themselves (the
// package arrives, the task gets done manually) and so are worth waiting on.
const IMMEDIATE_LOOP_TYPES = ["docs", "unsubscribe", "file_request", "subscription", "opportunity", "follow_up"];
const STATUSES = [
  "pending",
  "stalled",
  "investigating",
  "needs_approval",
  "auto_resolving",
  "resolved",
];
const STAKES = ["low", "money", "irreversible"];

function toTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Cannot convert string to Timestamp, invalid date: "${value}"`);
    }
    return Timestamp.fromDate(date);
  }
  if (typeof value === "number") return Timestamp.fromMillis(value);
  throw new Error(`Cannot convert value to Timestamp: ${JSON.stringify(value)}`);
}

// Builds a full OpenLoop document from partial fields, filling in
// loop_id/timestamps/defaults, then validates the result.
function createOpenLoop(fields = {}) {
  const now = Timestamp.now();

  const loop = {
    loop_id: fields.loop_id || randomUUID(),
    user_id: fields.user_id,
    loop_type: fields.loop_type,
    // Preserve every field an adapter puts on source (adapter, source_id,
    // plus extras like calendar's item_type or docs' file_id) — a previous
    // whitelist here silently dropped item_type, which broke event-vs-task
    // handling downstream (schedulerJob's immediate-investigation check
    // depends on source.item_type actually surviving to Firestore).
    source: {
      ...fields.source,
    },
    expected_state: fields.expected_state,
    expected_by: toTimestamp(fields.expected_by),
    current_state: fields.current_state ?? "",
    status: fields.status || "pending",
    // Same reasoning as source above — spread rather than whitelist, so
    // adapter-specific extras (e.g. unsubscribe loops' target_company)
    // survive. A whitelist here previously forced adapters to smuggle extra
    // data through raw_title/raw_summary text, which broke when something
    // else (recheck() syncing a renamed Notion page title) legitimately
    // overwrote that same field.
    context: {
      raw_title: "",
      raw_summary: "",
      investigation_notes: "",
      proposed_action: "",
      ...fields.context,
    },
    stakes: fields.stakes,
    created_at: fields.created_at ? toTimestamp(fields.created_at) : now,
    updated_at: now,
    resolved_at: fields.resolved_at ? toTimestamp(fields.resolved_at) : null,
  };

  validateOpenLoop(loop);
  return loop;
}

function validateOpenLoop(loop) {
  const errors = [];

  if (!loop.user_id) errors.push("user_id is required");
  if (!LOOP_TYPES.includes(loop.loop_type)) {
    errors.push(`loop_type must be one of ${LOOP_TYPES.join(", ")}, got "${loop.loop_type}"`);
  }
  if (!loop.source?.adapter) errors.push("source.adapter is required");
  if (!loop.source?.source_id) errors.push("source.source_id is required");
  if (!loop.expected_state) errors.push("expected_state is required");
  if (!loop.expected_by) errors.push("expected_by is required");
  if (!STATUSES.includes(loop.status)) {
    errors.push(`status must be one of ${STATUSES.join(", ")}, got "${loop.status}"`);
  }
  if (!STAKES.includes(loop.stakes)) {
    errors.push(`stakes must be one of ${STAKES.join(", ")}, got "${loop.stakes}"`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid OpenLoop: ${errors.join("; ")}`);
  }

  return true;
}

module.exports = {
  LOOP_TYPES,
  IMMEDIATE_LOOP_TYPES,
  STATUSES,
  STAKES,
  toTimestamp,
  createOpenLoop,
  validateOpenLoop,
};
