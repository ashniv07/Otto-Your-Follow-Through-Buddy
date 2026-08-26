const { google } = require("googleapis");
require("../../core/firestoreClient"); // ensure firebase-admin is initialised
const { getClientFromConnection } = require("../google/auth");
const { extractFromCalendarTask } = require("./extractionAgent");
const { investigateCalendarTask } = require("./investigatorAgent");
const fixtures = require("./fixtures");

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
  try {
    const client = getClientFromConnection(connection);
    tasks = await fetchTasksFromGoogle(client);
    if (!tasks.length) {
      console.log("[calendar] No overdue tasks found for this account.");
      return [];
    }
  } catch (err) {
    console.warn("[calendar] Tasks API failed:", err.message);
    return [];
  }

  const results = [];
  for (const task of tasks) {
    try {
      const extracted = await extractFromCalendarTask(task);
      results.push({
        user_id: userId,
        loop_type: "calendar",
        source: { adapter: "calendar", source_id: task.taskId },
        expected_state: extracted.expected_state,
        expected_by: extracted.expected_by,
        current_state: "not completed",
        stakes: extracted.stakes,
        context: {
          raw_title: task.title,
          raw_summary: task.notes || task.title,
          // task_list_id stored here so execute() can target the right list
          task_list_id: task.taskListId || "@default",
        },
      });
    } catch (err) {
      console.error("[calendar] extractFromCalendarTask failed:", err.message);
    }
  }
  return results;
}

async function recheck(loop, connection) {
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
