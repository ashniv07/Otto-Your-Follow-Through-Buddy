const { Client } = require("@notionhq/client");
const firestoreClient = require("../../core/firestoreClient");
const { extractFromNotionItem } = require("./extractionAgent");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();
const CONNECTIONS_COLLECTION = "notion_connections";

// Multi-tenant now: every function that talks to Notion takes a
// `connection` (a doc from notion_connections: { user_id, access_token,
// tracked_page_id, workspace_name, ... }) instead of reading a single
// global NOTION_TOKEN/NOTION_PAGE_ID from process.env. schedulerJob.js
// fetches all connections and calls fetchNewItems/recheck once per user.
const schemaCache = new Map(); // tracked_page_id (data_source_id) -> schema

async function resolveSchema(notion, dataSourceId) {
  if (schemaCache.has(dataSourceId)) return schemaCache.get(dataSourceId);

  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const entries = Object.entries(dataSource.properties);

  const titleProp = entries.find(([, p]) => p.type === "title")?.[0];
  const dateProp = entries.find(([, p]) => p.type === "date")?.[0];
  const statusEntry = entries.find(([, p]) => p.type === "status" || p.type === "select");

  if (!titleProp || !statusEntry) {
    throw new Error(
      `Notion data source "${dataSource.title?.map((t) => t.plain_text).join("") || dataSourceId}" is missing a title or status/select property Otto can use.`
    );
  }

  const schema = {
    dataSourceId,
    titleProp,
    dateProp,
    statusProp: statusEntry[0],
    statusType: statusEntry[1].type,
  };
  schemaCache.set(dataSourceId, schema);
  return schema;
}

function getTitle(page, titleProp) {
  return page.properties[titleProp]?.title?.map((t) => t.plain_text).join("") || "Untitled";
}

function getDate(page, dateProp) {
  if (!dateProp) return null;
  return page.properties[dateProp]?.date?.start || null;
}

function getStatusName(page, statusProp, statusType) {
  return page.properties[statusProp]?.[statusType]?.name || null;
}

function isDone(statusName) {
  return (statusName || "").trim().toLowerCase() === "done";
}

function toIsoDate(value) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function getConnectionForUser(userId) {
  const doc = await db.collection(CONNECTIONS_COLLECTION).doc(userId).get();
  return doc.exists ? doc.data() : null;
}

// Called once per connected user per tick (schedulerJob iterates
// notion_connections and passes each one in). Returns [] for a connection
// that hasn't picked a page yet.
async function fetchNewItems(connection) {
  if (!connection?.access_token || !connection?.tracked_page_id) return [];

  const notion = new Client({ auth: connection.access_token });
  const schema = await resolveSchema(notion, connection.tracked_page_id);

  const response = await notion.dataSources.query({
    data_source_id: schema.dataSourceId,
    filter: {
      property: schema.statusProp,
      [schema.statusType]: { does_not_equal: "Done" },
    },
  });

  const newLoopFields = [];

  for (const page of response.results) {
    const sourceId = page.id;
    const existing = await firestoreClient.getLoopBySourceId("notion", sourceId, connection.user_id);
    if (existing) continue;

    const rawTitle = getTitle(page, schema.titleProp);
    const dueDate = getDate(page, schema.dateProp);

    const extracted = await extractFromNotionItem({ rawTitle, dueDate, sourceId });

    newLoopFields.push({
      user_id: connection.user_id,
      ...extracted,
      source: { adapter: "notion", source_id: sourceId },
      current_state: "task open",
      context: {
        raw_title: rawTitle,
        raw_summary: `Notion task "${rawTitle}"${dueDate ? `, due ${dueDate}` : " (no due date set)"}.`,
        proposed_action: "Approving marks this task Done in Notion and closes the loop in Otto.",
      },
    });
  }

  return newLoopFields;
}

// schedulerJob looks up the right connection for this loop's user_id and
// passes it in — current_state is returned per the shared adapter contract;
// title and due-date changes aren't part of that contract, so they're
// synced straight to Firestore here instead.
async function recheck(loop, connection) {
  if (!connection?.access_token) return loop.current_state;

  const notion = new Client({ auth: connection.access_token });
  const schema = await resolveSchema(notion, connection.tracked_page_id);
  const page = await notion.pages.retrieve({ page_id: loop.source.source_id });
  const statusName = getStatusName(page, schema.statusProp, schema.statusType);
  const currentTitle = getTitle(page, schema.titleProp);
  const currentDueDate = getDate(page, schema.dateProp);

  const patch = {};
  if (currentTitle && currentTitle !== loop.context?.raw_title) {
    patch["context.raw_title"] = currentTitle;
  }
  if (currentDueDate && currentDueDate !== toIsoDate(loop.expected_by)) {
    patch.expected_by = new Date(currentDueDate);
  }
  if (Object.keys(patch).length > 0) {
    await firestoreClient.updateLoop(loop.loop_id, patch);
  }

  // Match expected_state exactly (not a generic "task completed" string) so
  // stallDetector's current_state === expected_state check actually
  // recognizes completion — otherwise a genuinely-done task still gets
  // flagged stalled the moment its due date passes.
  return isDone(statusName) ? loop.expected_state : "task open";
}

// Called by actionAgent.resolveLoop() whenever a loop actually resolves.
// Unlike fetchNewItems/recheck, actionAgent only ever passes the loop
// itself — so the right connection is looked up here by loop.user_id.
async function execute(loop) {
  const connection = await getConnectionForUser(loop.user_id);
  if (!connection?.access_token) {
    throw new Error(`No Notion connection found for user "${loop.user_id}"`);
  }

  const notion = new Client({ auth: connection.access_token });
  const schema = await resolveSchema(notion, connection.tracked_page_id);
  await notion.pages.update({
    page_id: loop.source.source_id,
    properties: {
      [schema.statusProp]: { [schema.statusType]: { name: "Done" } },
    },
  });
}

module.exports = { fetchNewItems, recheck, execute };
