const { Client } = require("@notionhq/client");
const firestoreClient = require("../../core/firestoreClient");
const { extractFromNotionItem } = require("./extractionAgent");
const { getClientFromConnection } = require("../google/auth");
const { findUnsubscribeCandidates, performUnsubscribe, describeUnsubscribeInvestigation, hasUnsubscribeWork } = require("../gmail/unsubscribeAgent");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();
const CONNECTIONS_COLLECTION = "notion_connections";

// Multi-tenant now: every function that talks to Notion takes a
// `connection` (a doc from notion_connections: { user_id, access_token,
// tracked_page_id, workspace_name, ... }) instead of reading a single
// global NOTION_TOKEN/NOTION_PAGE_ID from process.env. schedulerJob.js
// fetches all connections and calls fetchNewItems/recheck once per user.
const schemaCache = new Map(); // tracked_page_id (data_source_id) -> schema

// Notion's select/status filters and updates require the option's exact
// stored name (case-sensitive) — a database using "done"/"not done" rejects
// a query or update sent with "Done". Finds whichever option actually means
// "done" so the rest of the adapter never has to guess at capitalization or
// wording.
function findDoneOptionName(options) {
  if (!options?.length) return "Done";
  const exact = options.find((o) => o.name.trim().toLowerCase() === "done");
  if (exact) return exact.name;
  const fuzzy = options.find((o) => /^(complete|completed|closed|finished)$/i.test(o.name.trim()));
  if (fuzzy) return fuzzy.name;
  return options[0]?.name || "Done"; // last resort — better than a guaranteed-wrong hardcoded value
}

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

  const statusType = statusEntry[1].type;
  const options = statusEntry[1][statusType]?.options || [];

  const schema = {
    dataSourceId,
    titleProp,
    dateProp,
    statusProp: statusEntry[0],
    statusType,
    doneOptionName: findDoneOptionName(options),
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

function isDone(statusName, doneOptionName) {
  return (statusName || "").trim().toLowerCase() === (doneOptionName || "done").trim().toLowerCase();
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
      [schema.statusType]: { does_not_equal: schema.doneOptionName },
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
    const { target_company, ...loopFields } = extracted;

    newLoopFields.push({
      user_id: connection.user_id,
      ...loopFields,
      source: { adapter: "notion", source_id: sourceId },
      current_state: "task open",
      context:
        extracted.loop_type === "unsubscribe"
          ? {
              // Keep the real Notion title here — recheck() below syncs this
              // field from the live page on every tick to catch renames, so
              // anything encoded into it (the old approach) gets silently
              // clobbered before investigate() ever reads it. target_company
              // is its own field instead.
              raw_title: rawTitle,
              raw_summary: `Notion task "${rawTitle}" — find and unsubscribe from ${target_company}'s emails, then clear existing ones from the inbox.`,
              target_company,
            }
          : {
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
  return isDone(statusName, schema.doneOptionName) ? loop.expected_state : "task open";
}

// Only "unsubscribe" loops need investigation — a plain "note" task has
// nothing to draft, approving it just marks the Notion page Done (see
// execute() below). Runs once the task is overdue (schedulerJob only calls
// investigate() on stalled loops), so a task that gets completed in Notion
// before its due date never triggers a Gmail search.
async function investigate(loop, connections = {}) {
  if (loop.loop_type !== "unsubscribe") return null;
  if (!connections.google?.access_token) return null;

  const targetCompany = loop.context?.target_company;
  if (!targetCompany) return null;
  try {
    const client = getClientFromConnection(connections.google);
    const candidates = await findUnsubscribeCandidates(client, targetCompany);
    return describeUnsubscribeInvestigation(candidates, targetCompany);
  } catch (err) {
    console.error("[notion] unsubscribe investigation failed:", err.message);
    return null;
  }
}

// Called by actionAgent.resolveLoop() whenever a loop actually resolves.
// Receives the full { notion, google } connections map (scoped to this
// loop's user) since an "unsubscribe" loop, though notion-sourced, needs
// Gmail access to actually clear the sender's emails before the Notion task
// is marked Done.
async function execute(loop, connections = {}) {
  const schema = loop.context?.action_schema;
  if (hasUnsubscribeWork(schema) && connections.google?.access_token) {
    try {
      const client = getClientFromConnection(connections.google);
      const targetCompany = schema.targetCompany;
      // Re-run the search rather than trusting stale message ids from
      // investigate() time — the inbox may have changed since then.
      const candidates = await findUnsubscribeCandidates(client, targetCompany);
      const { clicked } = await performUnsubscribe(client, candidates);
      console.log(`[notion] Unsubscribe from ${targetCompany}: click ${clicked ? "succeeded" : "did not confirm"}; emails trashed and sender blocked regardless.`);
    } catch (err) {
      console.error("[notion] unsubscribe execution failed:", err.message);
    }
  }

  const connection = connections.notion || (await getConnectionForUser(loop.user_id));
  if (!connection?.access_token) {
    throw new Error(`No Notion connection found for user "${loop.user_id}"`);
  }

  const notion = new Client({ auth: connection.access_token });
  const notionSchema = await resolveSchema(notion, connection.tracked_page_id);
  await notion.pages.update({
    page_id: loop.source.source_id,
    properties: {
      [notionSchema.statusProp]: { [notionSchema.statusType]: { name: notionSchema.doneOptionName } },
    },
  });
}

module.exports = { fetchNewItems, recheck, investigate, execute };
