# Otto — frontend

React + TypeScript + Vite + Tailwind CSS frontend for Otto, an open-loop tracking agent.

## Run it

```bash
npm install
npm run dev
```

- `/` — marketing landing page
- `/app` — the dashboard (Loops, Pipeline, Connections)

## Structure

- `src/pages/` — route-level pages (`LandingPage`, `Dashboard`, `LoopsPage`, `PipelinePage`, `ConnectionsPage`)
- `src/components/` — UI, grouped by feature (`loops/`, `pipeline/`, `connections/`, `landing/`, `layout/`, `ui/`)
- `src/hooks/useOttoStore.tsx` — the single data-access layer. All reads (`loops`, `pipelineEvents`, `connections`) and writes (`approveLoop`, `declineLoop`, `runCheckNow`, `toggleConnection`) go through this context.
- `src/lib/mockData.ts` — all hardcoded demo data. This is the only file that needs to change when the backend is wired in — swap its exports (or the bodies of the actions in `useOttoStore.tsx`) for real `fetch` calls against `../backend`.
- `src/types/index.ts` — shared types (`OpenLoop`, `PipelineEvent`, `Connection`).

## Notes

- No backend is wired up yet — everything is mock data held in React state.
- Dark-mode-only is not the theme here; the app uses a light cream/black/lime palette shared between the landing page and the dashboard.