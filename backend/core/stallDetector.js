function toMillis(value) {
  if (value == null) return NaN;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

// Pure logic, no LLM call: a loop is stalled once its deadline has passed
// and its current state still doesn't match what was expected.
function isStalled(loop) {
  if (!loop || loop.status === "resolved") return false;

  const expectedByMs = toMillis(loop.expected_by);
  if (Number.isNaN(expectedByMs)) return false;

  const isPastDue = Date.now() > expectedByMs;
  const stateMismatch = loop.current_state !== loop.expected_state;

  return isPastDue && stateMismatch;
}

module.exports = { isStalled };
