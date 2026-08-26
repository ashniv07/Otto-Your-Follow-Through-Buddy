// Pure logic: all stalled loops surface to the user for approval — Otto never acts autonomously.
function decide(loop) {
  return "needs_approval";
}

module.exports = { decide };
