# Otto

An open-loop tracking agent — built for the Google "All Things Agentic" hackathon (Taskmaster track).

Otto watches personal commitments (Notion tasks today; Gmail and Calendar are stubbed in for
teammates), tracks them as **Open Loops** in Firestore, detects when they've stalled, and either
resolves them on its own or asks for your approval — depending on how risky the action is.

## Layout

```
/backend
  /core            shared infra — schema, Firestore, Gemini, stall detection, policy, scheduler
  /adapters
    /notion        built — real Notion integration
    /gmail         stub — Person 2's work
    /calendar      stub — Person 3's work
  /api             Express routes the frontend calls
  server.js        entry point — starts the API + the automatic scheduler
/frontend           React/Vite/TypeScript dashboard
/docs                architecture notes
```

## Run it

Two commands, both from this directory (`Otto-Your-Follow-Through-Buddy`) — no need to `cd` into
`frontend/` or `backend/`:

```bash
npm install                # once, at the repo root
npm install --prefix frontend   # once, for the frontend

npm run backend    # starts the API on http://localhost:8080
npm run frontend   # starts the dashboard on http://localhost:5173 (open /app)
```

**Restart `npm run backend` after any backend code change.** Node doesn't hot-reload — a running
server keeps executing whatever was on disk when it started. The frontend (Vite) hot-reloads on
save automatically; the backend does not.

### `.env` (repo root, gitignored)

```
GOOGLE_APPLICATION_CREDENTIALS=./otto-backend-key.json
GOOGLE_CLOUD_PROJECT=otto-506606
GOOGLE_CLOUD_LOCATION=global
NOTION_TOKEN=...
NOTION_PAGE_ID=...          # actually the Notion database/data-source id
```

Optional overrides: `PORT` (default 8080), `SCHEDULER_INTERVAL_MS` (default 60000 — how often the
backend polls Notion on its own), `DEFAULT_USER_ID` (default `demo-user`),
`NOTION_DATA_SOURCE_ID` (skips the auto-search if you want to pin a specific database).

## What's built

**Core infra** (`backend/core/`) — the shared contract every adapter plugs into:
- `models.js` — the `OpenLoop` shape + a validating `createOpenLoop()` helper
- `firestoreClient.js` — reads/writes the `open_loops` Firestore collection
- `geminiClient.js` — thin wrapper around `@google/genai` (`gemini-2.5-flash`) that forces JSON-only output
- `stallDetector.js` — pure logic: a loop is stalled once `expected_by` has passed and `current_state ≠ expected_state`
- `policyEngine.js` — pure logic: `stakes: low` → auto-resolve, `money`/`irreversible` → needs approval
- `actionAgent.js` — resolves a loop: calls the owning adapter's `execute()` (if it has one), then marks it resolved
- `adapterRegistry.js` — maps adapter name → module (`notion`, `gmail`, `calendar`)
- `schedulerJob.js` — the actual job: fetch new items → recheck active loops → stall-detect + apply policy. Runs automatically from `server.js` every `SCHEDULER_INTERVAL_MS`, and on demand via `POST /run-now`.

**Notion adapter** (`backend/adapters/notion/`):
- `adapter.js` — queries your Notion "to-do" database (schema resolved by property *type*, not hardcoded names, so it isn't brittle to your exact property labels), dedupes by page id, rechecks status/title on every pass, and **writes back to Notion** on resolve (`execute()` flips the task's Status to Done for real)
- `extractionAgent.js` — asks Gemini to infer `expected_state` / `expected_by` / `stakes` from the task title (there's no "Type" property in this workspace to map deterministically, so it's always AI-driven; an explicit Notion due date is used as-is rather than guessed)
- `testNotion.js` — manual verification script (dedupe-safe to rerun)

**API** (`backend/api/dashboardRoutes.js`), wired into `server.js` with `cors` + `dotenv`:
- `GET /loops` — flat array of loops, shaped for the frontend (camelCase, ISO dates)
- `POST /loops/:id/approve` — resolves a loop for real (Firestore + Notion)
- `POST /loops/:id/decline` — resolves the loop in Otto only, touches nothing upstream
- `POST /run-now` — triggers a scheduler pass immediately (used by the dashboard's "Run check now" button, and handy for demos)

**Frontend** (`frontend/`) — no longer running on mock data. `useOttoStore.tsx` polls `GET /loops`
every 15s and calls the real approve/decline/run-now endpoints. `pipelineEvents` and `connections`
are still mock data — there's no backend event log or OAuth-connections model built yet.

`gmail/adapter.js` and `calendar/adapter.js` are empty stubs (`fetchNewItems` returns `[]`,
`recheck` is a no-op passthrough) — same shape as Notion's, ready for teammates to fill in.

## The lifecycle, concretely

1. Every tick, `recheck()` asks the adapter "what's the current state?" (for Notion: is Status = Done?).
2. `isStalled()` — true only once `expected_by` has passed **and** the state still doesn't match what was expected. Nothing happens before the due date.
3. If stalled, `policyEngine` routes by `stakes`:
   - `low` → **auto-resolves in the same tick** — Firestore goes straight to `resolved` and the adapter's `execute()` runs unattended (for Notion: the box gets checked automatically, whether or not anything was actually verified done — worth knowing before a demo).
   - `money` / `irreversible` → **needs_approval**, and sits there indefinitely until you click Approve or Decline. There's no timeout that auto-resolves these.

**Known gap:** once a loop is `resolved`, it's permanently done as far as Otto is concerned —
`recheck()` never runs on resolved loops again, and dedupe-by-source-id means a new loop won't be
created for that item either. Unchecking a task back to "not done" in Notion after Otto has
already resolved it will *not* reopen the loop.

## Not built yet

- Gmail and Calendar adapters (stubs only)
- A real pipeline/event log backing the "Pipeline" tab (currently synthetic client-side events)
- OAuth-based Connections (currently mock)
- Reopening a resolved loop if the upstream source reverts
