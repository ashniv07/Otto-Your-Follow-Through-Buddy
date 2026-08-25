// Pure logic, no LLM call: routes a stalled loop based on how risky it is
// to act on automatically.
function decide(loop) {
  if (loop.stakes === "low") return "auto_resolving";
  if (loop.stakes === "money" || loop.stakes === "irreversible") return "needs_approval";
  throw new Error(`Unknown stakes value: "${loop.stakes}"`);
}

module.exports = { decide };
