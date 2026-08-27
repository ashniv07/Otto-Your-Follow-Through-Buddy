const { google } = require("googleapis");
require("../../core/firestoreClient"); // ensure firebase-admin is initialised
const { getClientFromConnection } = require("../google/auth");
const { extractFromCalendarTask, extractFromCalendarEvent } = require("./extractionAgent");
const { investigateCalendarTask } = require("./investigatorAgent");
const fixtures = require("./fixtures");

async function fetchEventsFromGoogle(oauthClient) {
  const calendarApi = google.calendar({ version: "v3", auth: oauthClient });
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const res = await calendarApi.events.list({
    calendarId: "primary",
    timeMin: threeDaysAgo,
    timeMax: tomorrow,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 30,
  });

  return (res.data.items || [])
    .filter((e) => e.status !== "cancelled" && e.summary)
    .map((e) => ({
      eventId: e.id,
      title: e.summary,
      description: e.description || "",
      start: e.start?.dateTime || e.start?.date || "",
      isAllDay: !!e.start?.date && !e.start?.dateTime,
      attendeeCount: (e.attendees || []).filter((a) => !a.self).length,
    }));
}

async function fetchTasksFromGoogle(oauthClient) {
  const tasksApi = google.tasks({ version: "v1", auth: oauthClient });
  const now = new Date().toISOString();

  const listRes = await tasksApi.tasklists.list({ maxResults: 10 });
  const taskLists = listRes.data.items || [];

  const allTasks = [];
  for (const taskList of taskLists) {
    try {
      const res = await tasksApi.tasks.list({
        tasklist: taskList.id,
        showCompleted: false,
        showDeleted: false,
        dueMax: now,
        maxResults: 20,
      });
      for (const task of res.data.items || []) {
        if (task.due) {
          allTasks.push({
            taskId: task.id,
            taskListId: taskList.id,
            title: task.title || "Untitled task",
            notes: task.notes || "",
            due: task.due.slice(0, 10),
            taskListTitle: taskList.title || "My Tasks",
          });
        }
      }
    } catch { /* skip inaccessible task lists */ }
  }
  return allTasks;
}

async function fetchNewItems(connection) {
  let tasks;
  let userId;

  if (!connection?.access_token) return [];
  userId = connection.user_id;
  const client = getClientFromConnection(connection);

  // ── Tasks ──────────────────────────────────────────────────────────────────
  try {
    tasks = await fetchTasksFromGoogle(client);
    if (!tasks.length) console.log("[calendar] No overdue tasks found.");
  } catch (err) {
    console.warn("[calendar] Tasks API failed:", err.message);
    tasks = [];
  }

  const results = [];
  for (const task of tasks) {
    try {
      const extracted = await extractFromCalendarTask(task);
      results.push({
        user_id: userId,
        loop_type: "calendar",
        source: { adapter: "calendar", source_id: task.taskId, item_type: "task" },
        expected_state: extracted.expected_state,
        expected_by: extracted.expected_by,
        current_state: "not completed",
        stakes: extracted.stakes,
        context: {
          raw_title: task.title,
          raw_summary: task.notes || task.title,
          task_list_id: task.taskListId || "@default",
        },
      });
    } catch (err) {
      console.error("[calendar] extractFromCalendarTask failed:", err.message);
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  let events = [];
  try {
    events = await fetchEventsFromGoogle(client);
  } catch (err) {
    console.warn("[calendar] Calendar Events API failed:", err.message);
  }

  for (const event of events) {
    try {
      const extracted = await extractFromCalendarEvent(event);
      if (!extracted.should_surface) {
        console.log(`[calendar:event] skip "${event.title}"`);
        continue;
      }
      console.log(`[calendar:event] surface "${event.title}"`);
      results.push({
        user_id: userId,
        loop_type: "calendar",
        source: { adapter: "calendar", source_id: event.eventId, item_type: "event" },
        expected_state: extracted.expected_state,
        expected_by: extracted.expected_by,
        current_state: "not actioned",
        stakes: extracted.stakes,
        context: {
          raw_title: extracted.title || event.title,
          raw_summary: event.description || event.title,
          ...(extracted.action_schema ? { action_schema: extracted.action_schema } : {}),
        },
      });
    } catch (err) {
      console.error("[calendar] extractFromCalendarEvent failed:", err.message);
    }
  }

  return results;
}

async function recheck(loop, connection) {
  // Events have no completable status in the Calendar API — nothing to recheck.
  if (loop.source?.item_type === "event") return loop.current_state;
  if (!connection?.access_token) return loop.current_state;
  try {
    const client = getClientFromConnection(connection);
    const tasksApi = google.tasks({ version: "v1", auth: client });
    const taskListId = loop.context?.task_list_id || "@default";
    const task = await tasksApi.tasks.get({
      tasklist: taskListId,
      task: loop.source.source_id,
    });
    if (task.data.status === "completed") return loop.expected_state;
  } catch { /* ignore — task may not be accessible */ }
  return loop.current_state;
}

async function investigate(loop, connection) {
  try {
    return await investigateCalendarTask(loop);
  } catch (err) {
    console.error("[calendar] investigate failed:", err.message);
    return null;
  }
}

// Called by actionAgent for low-stakes loops routed to auto_resolving.
async function execute(loop, connection) {
  // Events don't have a completable status — their action_schema (compose/info)
  // is handled by actionAgent/gmail; nothing extra to do here.
  if (loop.source?.item_type === "event") return;
  if (!connection?.access_token) return;
  try {
    const client = getClientFromConnection(connection);
    const tasksApi = google.tasks({ version: "v1", auth: client });
    const taskListId = loop.context?.task_list_id || "@default";
    await tasksApi.tasks.patch({
      tasklist: taskListId,
      task: loop.source.source_id,
      requestBody: { status: "completed", completed: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[calendar] execute failed:", err.message);
  }
}

module.exports = { fetchNewItems, recheck, investigate, execute };
