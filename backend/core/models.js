const { Timestamp } = require("firebase-admin/firestore");
const { randomUUID } = require("crypto");

const LOOP_TYPES = ["note", "subscription", "calendar"];
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
    source: {
      adapter: fields.source?.adapter,
      source_id: fields.source?.source_id,
    },
    expected_state: fields.expected_state,
    expected_by: toTimestamp(fields.expected_by),
    current_state: fields.current_state ?? "",
    status: fields.status || "pending",
    context: {
      raw_title: fields.context?.raw_title || "",
      raw_summary: fields.context?.raw_summary || "",
      investigation_notes: fields.context?.investigation_notes || "",
      proposed_action: fields.context?.proposed_action || "",
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
  STATUSES,
  STAKES,
  toTimestamp,
  createOpenLoop,
  validateOpenLoop,
};
