<div align="center">

# Otto

**The agent that finishes what you forgot.**

An open-loop tracking agent built for Google's **"All Things Agentic" Hackathon** (Taskmaster
track). Otto watches Gmail, Google Calendar/Tasks, Drive/Docs, and Notion for personal
commitments that quietly stalled, tracks them as **Open Loops** in Firestore, and either finishes
them for real or asks for your approval first — depending on how risky the action is.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Hackathon](https://img.shields.io/badge/Google-All%20Things%20Agentic%20Hackathon-1a73e8)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)

[Live Demo](#) · [Demo Video](#) · [Report an Issue](../../issues)

</div>

> Every adapter is real — no mock data, no stubs. All four (Notion, Gmail, Calendar, Docs) read
> and write against live, OAuth-connected accounts.

> [!NOTE]
> The **Live Demo** and **Demo Video** links above are placeholders — swap them for the real
> Cloud Run URL and recorded video link before submitting.

## Contents

- [Layout](#layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [What's built](#whats-built)
- [The lifecycle, concretely](#the-lifecycle-concretely)
- [Deploying](#deploying)
- [Reproducible testing](#reproducible-testing)
- [License](#license)

## Layout

```
/backend
  /core                shared infra — schema, Firestore, Gemini/ADK, stall detection, policy,
                        the always-on scheduler, and the per-item extraction cache
  /adapters
    /notion             Notion tasks — including the shared unsubscribe flow
    /gmail               order tracking, general inbox triage, unsubscribe, file requests
    /calendar           Calendar events + Google Tasks — including unsubscribe from a task
    /docs                Drive/Docs comment threads — reads + replies via the real Drive API
    /google              shared OAuth client (sign-in + data-access grant)
  /api                 Express routes — dashboard (loops/pipeline) + auth (Notion/Google OAuth)
  server.js             entry point — API + the automatic scheduler
/frontend               React/Vite/TypeScript — Google Material theme, real backend, no mock data
Dockerfile, .dockerignore, .gcloudignore   Cloud Run deployment
```

## Getting started

Two commands, both from this directory (`Otto-Your-Follow-Through-Buddy`) — no need to `cd` into
`frontend/` or `backend/`:

```bash
npm install                      # once, at the repo root
npm install --prefix frontend    # once, for the frontend

npm run backend    # starts the API on http://localhost:8080
npm run frontend   # starts the dashboard on http://localhost:5173 (open it, then sign in)
```

**Restart `npm run backend` after any backend code change.** Node doesn't hot-reload — a running
server keeps executing whatever was on disk when it started. The frontend (Vite) hot-reloads on
save automatically; the backend does not.

## Environment variables

`.env`, repo root, gitignored:

```
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global
VERTEX_AI_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=1

# Leave unset if you've run `gcloud auth application-default login` — Firestore's
# applicationDefault() picks those credentials up automatically, no key file needed
# for local dev. Only set this if you have a real service-account key file.
# GOOGLE_APPLICATION_CREDENTIALS=./path-to-key.json

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
GOOGLE_SIGNIN_REDIRECT_URI=http://localhost:8080/api/auth/google/signin/callback

NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
NOTION_REDIRECT_URI=http://localhost:8080/api/auth/notion/callback

FRONTEND_URL=http://localhost:5173
COOKIE_SECRET=any-random-string   # generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Optional overrides: `PORT` (default 8080), `SCHEDULER_INTERVAL_MS` (default 60000 — how often the
backend sweeps every connected account on its own).

## What's built

**Core infra** (`backend/core/`) — the shared contract every adapter plugs into:
- `models.js` — the `OpenLoop` shape + a validating `createOpenLoop()` helper (loop types:
  `order`, `subscription`, `calendar`, `note`, `opportunity`, `follow_up`, `docs`, `unsubscribe`,
  `file_request`)
- `firestoreClient.js` — reads/writes `open_loops` and `pipeline_events`
- `geminiClient.js` / `adkRunner.js` — Gemini 3.5 via Vertex AI, both a direct call path and
  Google's Agent Development Kit (classify/investigate/draft as separate `LlmAgent` steps).
  `adkRunner.js` surfaces the model's real `errorCode`/`errorMessage` on failure (a rate limit, a
  billing issue, anything) instead of silently returning empty text
- `extractionCache.js` — caches each adapter's classify/extract result per item (Gmail thread id,
  Calendar task/event id) so a scheduler tick never re-spends a Gemini call on something it's
  already seen — every fetch window re-scans the same items on every tick, so without this an
  unchanged email got reclassified by Gemini on *every single tick* for its entire time in the
  scan window
- `stallDetector.js` — pure logic: a loop is stalled once `expected_by` has passed and
  `current_state ≠ expected_state`
- `policyEngine.js` — every stalled loop surfaces for approval. Otto never auto-executes anything
  on its own; the only path to `execute()` running is you clicking Approve
- `actionAgent.js` — resolves a loop: calls the owning adapter's `execute()`, then marks it resolved
- `adapterRegistry.js` — maps adapter name → module (`notion`, `gmail`, `calendar`, `docs`)
- `schedulerJob.js` — fetch new items → recheck active loops → stall-detect → investigate → surface
  for approval. Runs from `server.js` on startup and every `SCHEDULER_INTERVAL_MS`, and on demand
  via `POST /run-now`. A run-overlap guard in `server.js` means a new tick never starts while the
  previous one is still mid-flight — real ticks (Gmail + Calendar + Drive + Notion, all with
  Gemini calls) can take minutes, and without the guard they'd stack up running concurrently

**Notion adapter** (`backend/adapters/notion/`) — queries a tracked database (schema resolved by
property *type*, not hardcoded names), dedupes by page id, rechecks status/title every pass, and
writes back to Notion on resolve. A task titled like "unsubscribe from X" routes into the same
real unsubscribe flow the Gmail/Calendar adapters use (see below).

**Gmail adapter** (`backend/adapters/gmail/`):
- Order tracking — extracts merchant/tracking/expected-delivery from real order-confirmation
  emails, rechecks the thread for a "delivered" signal
- General inbox triage — an LLM classifier surfaces anything that needs a reply, a subscription
  price change, a job/opportunity email, or a file request; explicitly ignores newsletters,
  receipts, OTPs, and Docs/Sheets/Slides comment-notification emails (the Docs adapter handles
  those for real, so the notification itself doesn't also surface as a second, wrong loop)
- **Unsubscribe** (`unsubscribeAgent.js`) — reads the sender's actual `List-Unsubscribe` /
  `List-Unsubscribe-Post` headers, fires the real RFC 8058 one-click POST (or a plain link/mailto
  fallback), moves every matching message to Trash, and creates a standing Gmail filter so the
  sender can't come back — even if the click itself doesn't confirm. The click's real HTTP
  response is checked and logged (not assumed to have worked)
- File requests — searches the real connected Drive for a matching file, exports native Docs/
  Sheets/Slides to a real PDF/xlsx, and attaches it to a drafted reply

**Calendar adapter** (`backend/adapters/calendar/`) — surfaces overdue Google Tasks and upcoming
events worth prepping for; a task titled like "unsubscribe from X" routes into the same
unsubscribe flow as Notion/Gmail.

**Docs adapter** (`backend/adapters/docs/`) — reads unresolved comments across recently-modified
Docs/Sheets/Slides via the real Drive Comments API, drafts a reply with Gemini, and — once
approved — posts it with `drive.replies.create`: a genuine threaded reply on the comment thread
itself, not an email.

**Google OAuth** (`backend/adapters/google/auth.js`) — two separate grants: an identity-only
sign-in (`openid`/`userinfo.email`/`userinfo.profile`) to establish an Otto account, and a
broader data-access "Connect" grant (`gmail.modify`, `gmail.compose`, `gmail.settings.basic`,
`calendar.readonly`, `tasks`, `drive`) requested only when you connect on the Connections tab.

**API** (`backend/api/`):
- `dashboardRoutes.js` — `GET /loops`, `POST /loops/:id/approve`, `POST /loops/:id/decline`,
  `PATCH /loops/:id/action-schema` (saves edits to a drafted action before approving),
  `GET /pipeline-events`, `POST /run-now`
- `authRoutes.js` — Notion connect/callback/status/pages/select-page/disconnect, Google
  connect/callback/status/disconnect, Google sign-in/callback, session, sign-out

**Frontend** (`frontend/`) — fully wired to the real backend (`useOttoStore.tsx` polls
`GET /loops` and calls the real approve/decline/action-schema/run-now endpoints; connections and
pipeline events are real too, not mock). Google Material visual theme throughout (Roboto,
Material Symbols icons, Google's own neutral/status color scale) — landing page uses a
scattered-icon-card/dotted-grid layout language carried lightly into the dashboard's empty states
and connection cards for visual continuity.

## The lifecycle, concretely

1. Every tick, `recheck()` asks each adapter "what's the current state now?" (Notion: is Status
   Done? Gmail order: did it deliver? Calendar task: is it completed? Docs: has this comment been
   replied to or resolved?).
2. `isStalled()` — true once `expected_by` has passed and the state still doesn't match what was
   expected. Some loop types (`docs`, `unsubscribe`, `file_request`, `subscription`,
   `opportunity`, `follow_up`, plus calendar events) are investigated immediately on creation
   instead of waiting for a due date — they can't resolve themselves by waiting.
3. Once stalled, the loop is always investigated (draft an action / gather context) and then
   surfaced as `needs_approval`. **Nothing auto-executes** — the only way a loop reaches
   `auto_resolving` → `execute()` is you clicking Approve, whether the stakes are `low`, `money`,
   or `irreversible`.

**Known gap:** once a loop is `resolved`, it's permanently done as far as Otto is concerned —
`recheck()` never runs on resolved loops again, and dedupe-by-source-id means a new loop won't be
created for that item either. Reverting the upstream source after Otto has already resolved it
will not reopen the loop.

## Deploying

Builds to a single Cloud Run service (`Dockerfile` builds the frontend, then serves it from the
same Express server as the API — see `backend/server.js`'s static-file block). The scheduler needs
`--no-cpu-throttling --min-instances=1` to keep running in the background with zero incoming
requests — Cloud Run's default scale-to-zero/CPU-throttling behavior would otherwise pause it.

## Reproducible testing

There's no automated test suite — every adapter talks to a real external API (Gmail, Calendar,
Drive, Notion, Vertex AI), so "testing" here means verifying the real, end-to-end behavior against
a real connected account. Steps to independently reproduce and verify each claim above:

1. **Confirm it's actually reaching Vertex AI, not mocked.** Start the backend
   (`npm run backend`) and watch the console. Within a few seconds you should see
   `Otto backend listening on port 8080`, then a line containing `backend: VERTEX_AI` for every
   Gemini call, then a `[scheduler] {"newLoops":...}` summary with no errors. Any failure here
   prints the real underlying reason (a 403, a quota error, a permission error) rather than a
   generic failure — that's the first thing to check if something looks broken.
2. **Sign in and connect real accounts.** `npm run frontend`, open `http://localhost:5173`, sign
   in with Google, then connect Gmail/Calendar and Notion from the Connections tab. Loops should
   start appearing on the Loops tab within one scheduler tick (or click "Run check now" on the
   Pipeline tab to force one immediately).
3. **Verify the unsubscribe flow for real.** Send yourself (or find) an email from a sender with a
   working `List-Unsubscribe` header, then create a Notion task or Google Task titled
   `unsubscribe from <sender>`. Once it's stalled and you approve it, check: the sender's messages
   moved to Trash, a new filter exists under Gmail Settings → Filters, and the backend log shows
   `[unsubscribe] ... succeeded` or a clear reason it didn't.
4. **Verify a Doc comment reply is a real threaded reply, not an email.** Leave a comment on a Doc
   the connected account can access from a *different* account. Otto should surface a `docs`-type
   loop with a drafted reply; approving it should post the reply visibly on that same comment
   thread in the Doc itself (check the Doc directly, not the inbox).
5. **Verify a file request.** Email the connected account asking for a document you know exists in
   its Drive (e.g. "can you send me the Q3 budget deck"). Approve the resulting `file_request` loop
   and confirm the sent reply has a real PDF/xlsx attached — open the attachment, it should be the
   actual exported file, not a placeholder.
6. **Verify the always-on scheduler behavior.** With the backend running and the browser tab
   closed, wait one `SCHEDULER_INTERVAL_MS` interval (60s by default) and confirm a new
   `[scheduler] {...}` summary line appears in the console with zero incoming HTTP requests in
   between — the scheduler runs on its own, it isn't triggered by page loads.
7. **Verify a tick can't overlap itself.** Set `SCHEDULER_INTERVAL_MS=1000` temporarily (an
   interval far shorter than a real tick takes) and confirm the console logs
   `[scheduler] Previous tick still running — skipping this interval to avoid overlap.` instead of
   multiple ticks running concurrently.

## License

MIT — see [LICENSE](LICENSE).
