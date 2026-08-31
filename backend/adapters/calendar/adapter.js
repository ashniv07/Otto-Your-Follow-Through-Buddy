const { google } = require("googleapis");
require("../../core/firestoreClient"); // ensure firebase-admin is initialised
const { getClientFromConnection } = require("../google/auth");
const { getCachedResult, setCachedResult } = require("../../core/extractionCache");
const { extractFromCalendarTask, extractFromCalendarEvent } = require("./extractionAgent");
const { investigateCalendarTask } = require("./investigatorAgent");
const { findUnsubscribeCandidates, performUnsubscribe, describeUnsubscribeInvestigation, hasUnsubscribeWork } = require("../gmail/unsubscribeAgent");
const fixtures = require("./fixtures");

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function fetchEventsFromGoogle(oauthClient) {
  const calendarApi = google.calendar({ version: "v3", auth: oauthClient });
  const now = new Date();
  const oneMonthOut = new Date(now.getTime() + ONE_MONTH_MS).toISOString();

  // Upcoming events only, within the next month — nothing before now.
  const res = await calendarApi.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: oneMonthOut,
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
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - ONE_MONTH_MS).toISOString();

  const listRes = await tasksApi.tasklists.list({ maxResults: 10 });
  const taskLists = listRes.data.items || [];

  const allTasks = [];
  for (const taskList of taskLists) {
    try {
      // Overdue tasks only, and only if they went overdue within the last
      // month — anything older than that is too stale to bother surfacing.
      const res = await tasksApi.tasks.list({
        tasklist: taskList.id,
        showCompleted: false,
        showDeleted: false,
        dueMin: oneMonthAgo,
        dueMax: now.toISOString(),
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
      // Tasks stay in this "overdue, last month" window for weeks — cache
      // the extraction per task so it only ever costs one Gemini call, not
      // one per tick for as long as it stays in the window.
      let extracted = await getCachedResult(userId, task.taskId, "task");
      if (!extracted) {
        extracted = await extractFromCalendarTask(task);
        await setCachedResult(userId, task.taskId, "task", extracted);
      }

      if (extracted.loop_type === "unsubscribe") {
        results.push({
          user_id: userId,
          loop_type: "unsubscribe",
          source: { adapter: "calendar", source_id: task.taskId, item_type: "task" },
          expected_state: extracted.expected_state,
          expected_by: extracted.expected_by,
          current_state: "not completed",
          stakes: "low",
          context: {
            raw_title: task.title,
            raw_summary: `Google Task "${task.title}" — find and unsubscribe from ${extracted.target_company}'s emails, then clear existing ones from the inbox.`,
            target_company: extracted.target_company,
            task_list_id: task.taskListId || "@default",
          },
        });
        continue;
      }

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
      // Same reasoning as the task loop above — an event sits in the
      // "next month" window for weeks; cache the extraction so it's only
      // ever run once, surfaced or not.
      let extracted = await getCachedResult(userId, event.eventId, "event");
      if (!extracted) {
        extracted = await extractFromCalendarEvent(event);
        await setCachedResult(userId, event.eventId, "event", extracted);
      }
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

async function investigate(loop, connections = {}) {
  try {
    // Events already got their action_schema (compose/info) drafted at
    // extraction time (extractFromCalendarEvent) — just promote it to
    // proposed_action, same as gmail's general loops. The task investigator
    // below is task-specific ("Otto will mark this complete in Google
    // Tasks") and is wrong for an event, which has no Tasks entry.
    if (loop.source?.item_type === "event") {
      const schema = loop.context?.action_schema;
      if (schema?.type === "compose") return schema.body || "";
      if (schema?.type === "info") return schema.detail || schema.headline || "";
      return null;
    }

    // A Google Task titled like "unsubscribe from X" — same real unsubscribe
    // flow as the Notion adapter's equivalent, just triggered from Tasks
    // instead of a Notion database.
    if (loop.loop_type === "unsubscribe") {
      if (!connections.google?.access_token) return null;
      const targetCompany = loop.context?.target_company;
      if (!targetCompany) return null;
      const client = getClientFromConnection(connections.google);
      const candidates = await findUnsubscribeCandidates(client, targetCompany);
      return describeUnsubscribeInvestigation(candidates, targetCompany);
    }

    return await investigateCalendarTask(loop);
  } catch (err) {
    console.error("[calendar] investigate failed:", err.message);
    return null;
  }
}

// Called by actionAgent for low-stakes loops routed to auto_resolving.
async function execute(loop, connections = {}) {
  // Events don't have a completable status — their action_schema (compose/info)
  // is handled by actionAgent/gmail; nothing extra to do here.
  if (loop.source?.item_type === "event") return;
  const connection = connections.google;
  if (!connection?.access_token) return;

  const schema = loop.context?.action_schema;
  if (hasUnsubscribeWork(schema)) {
    try {
      const client = getClientFromConnection(connection);
      const candidates = await findUnsubscribeCandidates(client, schema.targetCompany);
      const { clicked } = await performUnsubscribe(client, candidates);
      console.log(`[calendar] Unsubscribe from ${schema.targetCompany}: click ${clicked ? "succeeded" : "did not confirm"}; emails trashed and sender blocked regardless.`);
    } catch (err) {
      console.error("[calendar] unsubscribe execution failed:", err.message);
    }
  }

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
