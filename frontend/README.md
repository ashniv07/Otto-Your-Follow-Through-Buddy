# Otto — frontend

React + TypeScript + Vite + Tailwind CSS frontend for Otto, an open-loop tracking agent.

## Run it

Needs the backend running too — see the repo root [README.md](../README.md) for both commands.
From this directory alone:

```bash
npm install
npm run dev
```

- `/` — marketing landing page
- `/app` — the dashboard (Loops, Pipeline, Connections)

## Structure

- `src/pages/` — route-level pages (`LandingPage`, `Dashboard`, `LoopsPage`, `PipelinePage`, `ConnectionsPage`)
- `src/components/` — UI, grouped by feature (`loops/`, `pipeline/`, `connections/`, `landing/`, `layout/`, `ui/`)
- `src/hooks/useOttoStore.tsx` — the single data-access layer. `loops` polls the real backend (`GET /loops` every 15s) and `approveLoop`/`declineLoop`/`runCheckNow` call the real endpoints. `pipelineEvents` and `connections` are still mock data (`src/lib/mockData.ts`) — no backend event log or OAuth-connections model exists yet.
- `src/types/index.ts` — shared types (`OpenLoop`, `PipelineEvent`, `Connection`).

## Notes

- Backend base URL defaults to `http://localhost:8080`; override with `VITE_API_URL`.
- Dark-mode-only is not the theme here; the app uses a light cream/black/lime palette shared between the landing page and the dashboard.