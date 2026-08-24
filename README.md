# Otto

An open-loop tracking agent — built for the Google "All Things Agentic" hackathon (Taskmaster track).

## Layout

- `frontend/` — the React/Vite/TypeScript app (landing page + dashboard). See `frontend/README.md`.
- `backend/` — not yet built. Will house the TypeScript + LangGraph agent pipeline.

The frontend currently runs entirely on mock data behind a single data-access layer
(`frontend/src/hooks/useOttoStore.tsx` and `frontend/src/lib/mockData.ts`), so wiring in the
backend later should mean editing that one file rather than touching the UI.