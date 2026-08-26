const { loadAdk, runLlmAgentJson } = require("../../core/adkRunner");

const TODAY = new Date().toISOString().slice(0, 10);

const INSTRUCTION = `Today's date is ${TODAY}.

You are an extraction agent. Given a Google Calendar task or reminder that is overdue, classify it and return ONLY a valid JSON object with no markdown or extra text.

Return exactly these fields:
{
  "expected_state": string — what "done" looks like for this task, phrased as a completed-state description (e.g. "car registration renewed", "bill paid", "expense report submitted to finance"),
  "expected_by": string — ISO date YYYY-MM-DD. Use the task's due date if provided; otherwise infer a reasonable deadline from the task title,
  "stakes": one of "low" | "money" | "irreversible" —
    "irreversible" if the task involves sending a message, email, or commitment to another person (follow up, RSVP, notify, contact),
    "money" if it involves payment, a bill, a subscription, a purchase, or a financial decision,
    "low" otherwise (purely personal to-do with no external commitment or financial impact)
}`;

async function buildAgent() {
  const { LlmAgent } = await loadAdk();
  return new LlmAgent({
    name: "calendar_task_extraction_agent",
    model: "gemini-2.5-flash",
    description: "Classifies overdue Google Calendar tasks and infers loop metadata.",
    instruction: INSTRUCTION,
  });
}

async function extractFromCalendarTask(taskData) {
  const agent = await buildAgent();
  const dueLine = taskData.due ? `Due date: ${taskData.due}` : "Due date: not set";
  const input = `Task title: "${taskData.title}"
${dueLine}
Notes: ${taskData.notes || "none"}
Task list: ${taskData.taskListTitle || "My Tasks"}`;
  return await runLlmAgentJson(agent, input);
}

module.exports = { extractFromCalendarTask };
