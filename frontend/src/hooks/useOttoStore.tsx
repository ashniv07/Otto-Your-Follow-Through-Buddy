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
import { futureAdapters, initialConnections } from "../lib/mockData";

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
async function fetchPipelineEvents(): Promise<PipelineEvent[]> {
  const res = await fetch(`${API_BASE}/api/pipeline-events`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/pipeline-events failed: ${res.status}`);
  return res.json();
}

async function fetchLoops(): Promise<OpenLoop[]> {
  const res = await fetch(`${API_BASE}/api/loops`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/loops failed: ${res.status}`);
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

export interface GoogleConnectionState {
  connected: boolean;
  email?: string | null;
}

async function fetchGoogleStatus(): Promise<GoogleConnectionState> {
  const res = await fetch(`${API_BASE}/api/auth/google/status`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/auth/google/status failed: ${res.status}`);
  return res.json();
}

export interface SessionUser {
  email: string;
  name: string | null;
  picture: string | null;
}

export interface SessionState {
  authenticated: boolean;
  user?: SessionUser;
}

async function fetchSession(): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/api/auth/session`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/auth/session failed: ${res.status}`);
  return res.json();
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
  googleConnection: GoogleConnectionState | null;
  connectGoogle: () => void;
  disconnectGoogle: () => void;
  refreshGoogleStatus: () => void;
  session: SessionState | null;
  signIn: () => void;
  signOut: () => void;
}

const OttoContext = createContext<OttoContextValue | null>(null);

export function OttoProvider({ children }: { children: ReactNode }) {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [connections, setConnections] =
    useState<Connection[]>(initialConnections);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [notionConnection, setNotionConnection] = useState<NotionConnectionState | null>(null);
  const [notionPages, setNotionPages] = useState<NotionPage[] | null>(null);
  const [notionPagesLoading, setNotionPagesLoading] = useState(false);
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionState | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      setSession(await fetchSession());
    } catch (err) {
      console.error("Failed to load session:", err);
      setSession({ authenticated: false });
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(() => {
    window.location.href = `${API_BASE}/api/auth/google/signin`;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/auth/signout`, { method: "POST", credentials: "include" });
    } finally {
      setSession({ authenticated: false });
      window.location.href = "/";
    }
  }, []);

  const refreshLoops = useCallback(async () => {
    try {
      setLoops(await fetchLoops());
    } catch (err) {
      console.error("Failed to load loops from backend:", err);
    }
  }, []);

  const refreshPipelineEvents = useCallback(async () => {
    try {
      const events = await fetchPipelineEvents();
      setPipelineEvents(events);
      if (events.length > 0) setLastCheckedAt(events[0].timestamp);
    } catch (err) {
      console.error("Failed to load pipeline events:", err);
    }
  }, []);

  // These endpoints require a signed-in session — wait for it before polling,
  // otherwise every unauthenticated page load (e.g. the landing page) spams
  // the backend with 401s.
  useEffect(() => {
    if (!session?.authenticated) return;
    refreshLoops();
    refreshPipelineEvents();
    const interval = window.setInterval(() => {
      refreshLoops();
      refreshPipelineEvents();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [session?.authenticated, refreshLoops, refreshPipelineEvents]);

  const refreshNotionStatus = useCallback(async () => {
    try {
      setNotionConnection(await fetchNotionStatus());
    } catch (err) {
      console.error("Failed to load Notion connection status:", err);
    }
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    refreshNotionStatus();
  }, [session?.authenticated, refreshNotionStatus]);

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

  const refreshGoogleStatus = useCallback(async () => {
    try {
      setGoogleConnection(await fetchGoogleStatus());
    } catch (err) {
      console.error("Failed to load Google connection status:", err);
    }
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    refreshGoogleStatus();
  }, [session?.authenticated, refreshGoogleStatus]);

  const connectGoogle = useCallback(() => {
    window.location.href = `${API_BASE}/api/auth/google/connect`;
  }, []);

  const disconnectGoogle = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/disconnect`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`DELETE /api/auth/google/disconnect failed: ${res.status}`);
      await refreshGoogleStatus();
    } catch (err) {
      console.error("Failed to disconnect Google:", err);
    }
  }, [refreshGoogleStatus]);

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

      const res = await fetch(`${API_BASE}/api/loops/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        console.error(`POST /api/loops/${id}/approve failed: ${res.status}`);
        return;
      }
      const updated: OpenLoop = await res.json();
      setLoops((prev) => prev.map((l) => (l.id === id ? updated : l)));
      await refreshPipelineEvents();
    },
    [loops, refreshPipelineEvents],
  );

  const declineLoop = useCallback(
    async (id: string) => {
      const loop = loops.find((l) => l.id === id);
      if (!loop || loop.status !== "needs_approval") return;

      const res = await fetch(`${API_BASE}/api/loops/${id}/decline`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        console.error(`POST /api/loops/${id}/decline failed: ${res.status}`);
        return;
      }
      const updated: OpenLoop = await res.json();
      setLoops((prev) => prev.map((l) => (l.id === id ? updated : l)));
      await refreshPipelineEvents();
    },
    [loops, refreshPipelineEvents],
  );

  const runCheckNow = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/run-now`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`POST /api/run-now failed: ${res.status}`);
      await refreshLoops();
      await refreshPipelineEvents();
    } catch (err) {
      console.error("Run check now failed:", err);
    } finally {
      setIsChecking(false);
    }
  }, [refreshLoops, refreshPipelineEvents]);

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
      googleConnection,
      connectGoogle,
      disconnectGoogle,
      refreshGoogleStatus,
      session,
      signIn,
      signOut,
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
      googleConnection,
      connectGoogle,
      disconnectGoogle,
      refreshGoogleStatus,
      session,
      signIn,
      signOut,
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
