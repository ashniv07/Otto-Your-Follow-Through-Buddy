const geminiClient = require("../../core/geminiClient");

function buildPrompt(rawItem) {
  const isoToday = new Date().toISOString().slice(0, 10);
  const dueDateLine = rawItem.dueDate
    ? `Due date (from Notion): ${rawItem.dueDate}`
    : "Due date: not set.";
  const expectedByInstruction = rawItem.dueDate
    ? `Use ${rawItem.dueDate} exactly.`
    : `The task has no due date set — if the task name mentions a relative date ("by Friday", "next week", "end of month"), resolve it relative to today's date above; otherwise estimate a reasonable deadline no more than 14 days from today.`;

  return `Today's date is ${isoToday}.

You are extracting a personal commitment ("open loop") from a task in someone's Notion to-do list. There is no category/type field on the task, so infer everything from the task name and due date below.

Task: "${rawItem.rawTitle}"
${dueDateLine}

FIRST check: is this task asking to clean up email from a specific sender —
phrases like "clear spam from X", "unsubscribe from X", "clear subscription
emails from X", "stop emails from X"? If so, return ONLY this JSON object:
{
  "loop_type": "unsubscribe",
  "target_company": string — the company/sender name mentioned in the task (e.g. "Netflix", "LinkedIn"),
  "expected_state": "unsubscribed and inbox cleared",
  "expected_by": string — ISO 8601 date. ${expectedByInstruction}
}

Otherwise, return ONLY a JSON object with exactly these fields:
{
  "loop_type": "note",
  "expected_state": string — what "done" looks like for this task, phrased as a short completed-state description (e.g. "task completed", "email sent to landlord", "wish sent"),
  "expected_by": string — an ISO 8601 date (YYYY-MM-DD) by when this should be done. ${expectedByInstruction}
  "stakes": one of "low", "money", "irreversible" — "irreversible" if completing this involves an outbound message or commitment to another person (email, call, text, follow up with, RSVP, etc.), "money" if it involves a payment, purchase, subscription, or other financial commitment, otherwise "low"
}

Do not include any explanation, markdown formatting, or code fences — return the raw JSON object only.`;
}

// Always asks Gemini to classify the task (there's no Type property to map
// deterministically) — returns { loop_type, expected_state, expected_by,
// stakes }. When Notion already has a Due date, it's used as-is rather than
// letting the model guess it.
async function extractFromNotionItem(rawItem) {
  const prompt = buildPrompt(rawItem);
  const result = await geminiClient.generateJson(prompt);

  if (result.loop_type === "unsubscribe") {
    return {
      loop_type: "unsubscribe",
      expected_state: result.expected_state,
      expected_by: rawItem.dueDate || result.expected_by,
      stakes: "low",
      target_company: result.target_company,
    };
  }

  return {
    loop_type: "note",
    expected_state: result.expected_state,
    expected_by: rawItem.dueDate || result.expected_by,
    stakes: result.stakes,
  };
}

module.exports = { extractFromNotionItem };
