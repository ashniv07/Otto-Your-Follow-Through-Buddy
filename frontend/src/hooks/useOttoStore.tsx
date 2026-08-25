import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Connection, OpenLoop, PipelineEvent } from "../types";
import { futureAdapters, initialConnections, initialPipelineEvents } from "../lib/mockData";

/**
 * Single data-access layer for the whole app.
 *
 * Every read (`loops`, `pipelineEvents`, `connections`, `notionConnection`)
 * and every write (`approveLoop`, `declineLoop`, `runCheckNow`,
 * `toggleConnection`, Notion OAuth actions) goes through this context.
 * `loops` and the Notion connection are backed by the real Express API;
 * `pipelineEvents` and the gmail/calendar `connections` still come from
 * mock data — no backend event log or OAuth flow exists for those yet.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// The backend's own scheduler already polls adapters on an interval — this
// just keeps the dashboard's view of Firestore fresh without a manual
// refresh.
const POLL_INTERVAL_MS = 15_000;

// Every call needs `credentials: "include"` — the backend's anonymous
// session lives in an httpOnly cookie (see backend/server.js), and a
// cross-origin fetch (5173 -> 8080) neither sends nor stores cookies
// without it.
async function fetchLoops(): Promise<OpenLoop[]> {
  const res = await fetch(`${API_BASE}/loops`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /loops failed: ${res.status}`);
  return res.json();
}

export interface NotionPage {
  id: string;
  title: string;
}

export interface NotionConnectionState {
  connected: boolean;
  workspaceName?: string;
  trackedPageId?: string | null;
}

async function fetchNotionStatus(): Promise<NotionConnectionState> {
  const res = await fetch(`${API_BASE}/api/auth/notion/status`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/auth/notion/status failed: ${res.status}`);
  return res.json();
}

interface OttoContextValue {
  loops: OpenLoop[];
  pipelineEvents: PipelineEvent[];
  connections: Connection[];
  futureAdapters: typeof futureAdapters;
  lastCheckedAt: string;
  isChecking: boolean;
  approveLoop: (id: string) => void;
  declineLoop: (id: string) => void;
  runCheckNow: () => void;
  toggleConnection: (id: string) => void;
  notionConnection: NotionConnectionState | null;
  notionPages: NotionPage[] | null;
  notionPagesLoading: boolean;
  connectNotion: () => void;
  refreshNotionStatus: () => void;
  loadNotionPages: () => void;
  selectNotionPage: (pageId: string) => void;
  disconnectNotion: () => void;
}

const OttoContext = createContext<OttoContextValue | null>(null);

let uidCounter = 0;
function nextId(prefix: string) {
  uidCounter += 1;
  return `${prefix}-${Date.now()}-${uidCounter}`;
}

export function OttoProvider({ children }: { children: ReactNode }) {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>(
    initialPipelineEvents,
  );
  const [connections, setConnections] =
    useState<Connection[]>(initialConnections);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>(
    initialPipelineEvents[initialPipelineEvents.length - 1].timestamp,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [notionConnection, setNotionConnection] = useState<NotionConnectionState | null>(null);
  const [notionPages, setNotionPages] = useState<NotionPage[] | null>(null);
  const [notionPagesLoading, setNotionPagesLoading] = useState(false);

  const refreshLoops = useCallback(async () => {
    try {
      setLoops(await fetchLoops());
    } catch (err) {
      console.error("Failed to load loops from backend:", err);
    }
  }, []);

  useEffect(() => {
    refreshLoops();
    const interval = window.setInterval(refreshLoops, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshLoops]);

  const refreshNotionStatus = useCallback(async () => {
    try {
      setNotionConnection(await fetchNotionStatus());
    } catch (err) {
      console.error("Failed to load Notion connection status:", err);
    }
  }, []);

  useEffect(() => {
    refreshNotionStatus();
  }, [refreshNotionStatus]);

  const connectNotion = useCallback(() => {
    window.location.href = `${API_BASE}/api/auth/notion/connect`;
  }, []);

  const loadNotionPages = useCallback(async () => {
    setNotionPagesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/notion/pages`, { credentials: "include" });
      if (!res.ok) throw new Error(`GET /api/auth/notion/pages failed: ${res.status}`);
      const data: { pages: NotionPage[] } = await res.json();
      setNotionPages(data.pages);
    } catch (err) {
      console.error("Failed to load Notion pages:", err);
    } finally {
      setNotionPagesLoading(false);
    }
  }, []);

  const selectNotionPage = useCallback(
    async (pageId: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/notion/select-page`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId }),
        });
        if (!res.ok) throw new Error(`POST /api/auth/notion/select-page failed: ${res.status}`);
        await refreshNotionStatus();
      } catch (err) {
        console.error("Failed to select Notion page:", err);
      }
    },
    [refreshNotionStatus],
  );

  const disconnectNotion = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/notion/disconnect`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`DELETE /api/auth/notion/disconnect failed: ${res.status}`);
      setNotionPages(null);
      await refreshNotionStatus();
    } catch (err) {
      console.error("Failed to disconnect Notion:", err);
    }
  }, [refreshNotionStatus]);

  const approveLoop = useCallback(
    async (id: string) => {
      const loop = loops.find((l) => l.id === id);
      if (!loop || loop.status !== "needs_approval") return;

      const res = await fetch(`${API_BASE}/loops/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        console.error(`POST /loops/${id}/approve failed: ${res.status}`);
        return;
      }
      const updated: OpenLoop = await res.json();
      setLoops((prev) => prev.map((l) => (l.id === id ? updated : l)));

      const now = new Date().toISOString();
      setPipelineEvents((events) => [
        ...events,
        {
          id: nextId("evt"),
          runId: "run-manual-approval",
          timestamp: now,
          type: "user_approved",
          message: `You approved: ${loop.title} — ${loop.context.proposedAction ?? "action taken"}`,
          loopId: id,
        },
      ]);
    },
    [loops],
  );

  const declineLoop = useCallback(
    async (id: string) => {
      const loop = loops.find((l) => l.id === id);
      if (!loop || loop.status !== "needs_approval") return;

      const res = await fetch(`${API_BASE}/loops/${id}/decline`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        console.error(`POST /loops/${id}/decline failed: ${res.status}`);
        return;
      }
      const updated: OpenLoop = await res.json();
      setLoops((prev) => prev.map((l) => (l.id === id ? updated : l)));

      const now = new Date().toISOString();
      setPipelineEvents((events) => [
        ...events,
        {
          id: nextId("evt"),
          runId: "run-manual-approval",
          timestamp: now,
          type: "user_declined",
          message: `You declined: ${loop.title} — no action taken`,
          loopId: id,
        },
      ]);
    },
    [loops],
  );

  const runCheckNow = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch(`${API_BASE}/run-now`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`POST /run-now failed: ${res.status}`);
      const summary: { newLoops: number; rechecked: number; autoResolved: number; needsApproval: number } =
        await res.json();

      await refreshLoops();

      const now = new Date().toISOString();
      setPipelineEvents((prev) => [
        ...prev,
        {
          id: nextId("evt"),
          runId: `run-manual-${nextId("chk")}`,
          timestamp: now,
          type: "new_loop",
          message: `Manual check: ${summary.newLoops} new, ${summary.rechecked} rechecked, ${summary.autoResolved} auto-resolved, ${summary.needsApproval} need approval`,
        },
      ]);
      setLastCheckedAt(now);
    } catch (err) {
      console.error("Run check now failed:", err);
    } finally {
      setIsChecking(false);
    }
  }, [refreshLoops]);

  const toggleConnection = useCallback((id: string) => {
    setConnections((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: c.status === "connected" ? "not_connected" : "connected",
            }
          : c,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      loops,
      pipelineEvents,
      connections,
      futureAdapters,
      lastCheckedAt,
      isChecking,
      approveLoop,
      declineLoop,
      runCheckNow,
      toggleConnection,
      notionConnection,
      notionPages,
      notionPagesLoading,
      connectNotion,
      refreshNotionStatus,
      loadNotionPages,
      selectNotionPage,
      disconnectNotion,
    }),
    [
      loops,
      pipelineEvents,
      connections,
      lastCheckedAt,
      isChecking,
      approveLoop,
      declineLoop,
      runCheckNow,
      toggleConnection,
      notionConnection,
      notionPages,
      notionPagesLoading,
      connectNotion,
      refreshNotionStatus,
      loadNotionPages,
      selectNotionPage,
      disconnectNotion,
    ],
  );

  return (
    <OttoContext.Provider value={value}>{children}</OttoContext.Provider>
  );
}

export function useOtto() {
  const ctx = useContext(OttoContext);
  if (!ctx) throw new Error("useOtto must be used within an OttoProvider");
  return ctx;
}
