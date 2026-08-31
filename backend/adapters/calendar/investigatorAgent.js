const { loadAdk, runLlmAgent } = require("../../core/adkRunner");

const TODAY = new Date().toISOString().slice(0, 10);

async function buildAgent() {
  const { LlmAgent } = await loadAdk();
  return new LlmAgent({
    name: "calendar_task_investigator_agent",
    model: "gemini-3.5-flash",
    description: "Investigates overdue calendar tasks and determines the best next action.",
    instruction: `Today is ${TODAY}.

You help users understand what will happen when they approve an overdue task in Otto.

When the user clicks Approve, Otto will mark this task as complete in their Google Tasks / Google To Do app.

Write ONE sentence (max 20 words) that:
- Confirms what Otto will do: mark the task complete in Google Tasks
- Gently reminds the user to make sure they've actually done the work first

Example: "Approving marks 'Sign the lease' as complete in Google Tasks — confirm you've already signed it."

Respond with ONLY that one sentence, nothing else.`,
  });
}

/**
 * Returns null if the task should be auto-resolved (low stakes, no external action needed).
 * Returns a proposed action string otherwise.
 */
async function investigateCalendarTask(loop) {
  const ctx = loop.context || {};

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

  const input = `Task: "${ctx.raw_title || "Unknown task"}"
Details: ${ctx.raw_summary || "No additional details"}
Stakes: ${loop.stakes}
Expected completion: ${expectedBy} (${daysLate} days overdue)
Current state: ${loop.current_state || "not completed"}`;

  const agent = await buildAgent();
  const response = await runLlmAgent(agent, input);
  return response.trim();
}

module.exports = { investigateCalendarTask };
