const { Client } = require("@notionhq/client");
const firestoreClient = require("../../core/firestoreClient");
const { extractFromNotionItem } = require("./extractionAgent");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "demo-user";

// Notion's 2025-09-03 API separates "database" (container) from "data
// source" (the actual queryable table) — client.databases.query no longer
// exists, you query a data source instead. Property names also aren't
// guaranteed (this workspace uses Notion's default "Todo List" template:
// "Task name" / "Status" / "Due date", not "Title" / "Status" / "Due Date"),
// so the schema is resolved by property *type* instead of hardcoded names.
let cachedSchema = null;

async function resolveDataSourceId() {
  if (process.env.NOTION_DATA_SOURCE_ID) return process.env.NOTION_DATA_SOURCE_ID;

  const results = await notion.search({ filter: { property: "object", value: "data_source" } });
  if (results.results.length === 0) {
    throw new Error(
      "No Notion data sources are visible to this integration. Share your to-do/Commitments database with it from Notion (••• menu -> Connections)."
    );
  }
  return results.results[0].id;
}

async function resolveSchema() {
  if (cachedSchema) return cachedSchema;

  const dataSourceId = await resolveDataSourceId();
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

  cachedSchema = {
    dataSourceId,
    titleProp,
    dateProp,
    statusProp: statusEntry[0],
    statusType: statusEntry[1].type,
  };
  return cachedSchema;
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

// Queries the to-do database for open items, skips ones we already have a
// Firestore loop for (dedupe by Notion page id), and returns OpenLoop-ready
// field objects (source/current_state/context filled in here, loop_type/
// expected_state/expected_by/stakes from extractionAgent).
async function fetchNewItems() {
  const schema = await resolveSchema();

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
    const existing = await firestoreClient.getLoopBySourceId("notion", sourceId);
    if (existing) continue;

    const rawTitle = getTitle(page, schema.titleProp);
    const dueDate = getDate(page, schema.dateProp);

    const extracted = await extractFromNotionItem({ rawTitle, dueDate, sourceId });

    newLoopFields.push({
      user_id: DEFAULT_USER_ID,
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

// current_state is returned for schedulerJob to write (per the shared
// adapter contract); title isn't part of that contract, so a change is
// synced straight to Firestore here rather than only on initial fetch.
async function recheck(loop) {
  const schema = await resolveSchema();
  const page = await notion.pages.retrieve({ page_id: loop.source.source_id });
  const statusName = getStatusName(page, schema.statusProp, schema.statusType);
  const currentTitle = getTitle(page, schema.titleProp);

  if (currentTitle && currentTitle !== loop.context?.raw_title) {
    await firestoreClient.updateLoop(loop.loop_id, { "context.raw_title": currentTitle });
  }

  return isDone(statusName) ? "task completed" : "task open";
}

// Called by actionAgent.resolveLoop() whenever a loop actually resolves —
// both a manual dashboard approve and an automatic low-stakes resolution
// end up here, so either path checks the task off in Notion for real.
async function execute(loop) {
  const schema = await resolveSchema();
  await notion.pages.update({
    page_id: loop.source.source_id,
    properties: {
      [schema.statusProp]: { [schema.statusType]: { name: "Done" } },
    },
  });
}

module.exports = { fetchNewItems, recheck, execute };
