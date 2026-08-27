const { loadAdk, runLlmAgentJson } = require("../../core/adkRunner");

const TODAY = new Date().toISOString().slice(0, 10);

const TASK_INSTRUCTION = `Today's date is ${TODAY}.

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

const EVENT_INSTRUCTION = `Today's date is ${TODAY}.

You are Otto's calendar intelligence agent. Given a Google Calendar event, decide if it needs action and draft that action.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "should_surface": boolean,
  "title": string,
  "expected_state": string,
  "expected_by": string,
  "stakes": "low" | "money" | "irreversible",
  "action_schema": {
    "type": "compose" | "info",
    "to": string,
    "cc": string,
    "subject": string,
    "body": string,
    "headline": string,
    "detail": string
  }
}

Set should_surface: true for events that require the user to DO something:
- Social gestures: "Wish Milad birthday", "Send anniversary message", "Congratulate John on new job"
- Personal reminders: "Call dentist", "Pay rent", "Submit report", "Renew passport"
- Follow-ups: "Follow up with recruiter", "Reply to client", "Send proposal"
- Deadlines with implied action: "Project submission", "Application deadline"

Set should_surface: false for:
- Scheduled appointments the user will just attend (doctor visit, meeting, interview)
- Recurring blocking events (standup, focus time, out of office, working location)
- All-day date-marker events (public holidays, imported birthday calendars)
- Social plans that need no digital action (lunch, dinner, hangout)
- Events created by Google or other apps automatically

action_schema rules:
- "compose" when the right response is sending an email/message (wishing someone, following up, RSVPing, sending something)
- "info" when the user takes a personal offline action (pay bill at ATM, renew a document in person)
- For "compose": fill to (leave "" if unknown), subject, body (3–5 sentences, warm and personal for wishes; professional for work)
- For "info": fill headline (one punchy reminder line) and detail (full context with date/amount if known)
- Leave unused fields as ""

stakes:
- "irreversible" = message/commitment sent to another person
- "money" = payment, bill, financial transaction
- "low" = personal task with no external impact`;

async function buildTaskAgent() {
  const { LlmAgent } = await loadAdk();
  return new LlmAgent({
    name: "calendar_task_extraction_agent",
    model: "gemini-2.5-flash",
    description: "Classifies overdue Google Calendar tasks and infers loop metadata.",
    instruction: TASK_INSTRUCTION,
  });
}

async function buildEventAgent() {
  const { LlmAgent } = await loadAdk();
  return new LlmAgent({
    name: "calendar_event_extraction_agent",
    model: "gemini-2.5-flash",
    description: "Classifies Google Calendar events and decides if they require action.",
    instruction: EVENT_INSTRUCTION,
  });
}

async function extractFromCalendarTask(taskData) {
  const agent = await buildTaskAgent();
  const dueLine = taskData.due ? `Due date: ${taskData.due}` : "Due date: not set";
  const input = `Task title: "${taskData.title}"
${dueLine}
Notes: ${taskData.notes || "none"}
Task list: ${taskData.taskListTitle || "My Tasks"}`;
  return await runLlmAgentJson(agent, input);
}

async function extractFromCalendarEvent(eventData) {
  const agent = await buildEventAgent();
  const input = `Event title: "${eventData.title}"
Start: ${eventData.start}
All-day: ${eventData.isAllDay}
Description: ${eventData.description || "none"}
Other attendees: ${eventData.attendeeCount}`;
  return await runLlmAgentJson(agent, input);
}

module.exports = { extractFromCalendarTask, extractFromCalendarEvent };
