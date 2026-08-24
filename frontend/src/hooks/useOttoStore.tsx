import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Connection, OpenLoop, PipelineEvent } from "../types";
import {
  futureAdapters,
  initialConnections,
  initialLoops,
  initialPipelineEvents,
} from "../lib/mockData";

/**
 * Single data-access layer for the whole app.
 *
 * Every read (`loops`, `pipelineEvents`, `connections`) and every write
 * (`approveLoop`, `declineLoop`, `runCheckNow`, `toggleConnection`) goes
 * through this context. Today the writes just mutate local state; when the
 * backend exists, each action body is the only thing that needs to change
 * to a `fetch('/api/loops/:id/approve', { method: 'POST' })`-style call —
 * nothing that reads from `useOtto()` elsewhere needs to know.
 */

// Pool of scenarios the "Run check now" button cycles through so repeated
// clicks in a demo don't show the exact same result twice.
const CHECK_NOW_TEMPLATES: Array<{
  loop: Omit<OpenLoop, "id" | "createdAt" | "updatedAt">;
  eventMessage: string;
}> = [
  {
    loop: {
      loopType: "order",
      title: "Standing desk — Order #F7738",
      expectedState: "Delivered to office address",
      expectedBy: new Date().toISOString().slice(0, 10),
      currentState: "Freight carrier scan frozen at “Arrived at facility” for 3 days",
      status: "stalled",
      stakes: "low",
      context: {
        rawSummary:
          "Gmail order confirmation from Fully, dated 6 days ago. Freight tracking shows no scan since arriving at the local facility.",
      },
    },
    eventMessage: "New loop created: Standing desk order — freight tracking stalled",
  },
  {
    loop: {
      loopType: "subscription",
      title: "Spotify Premium — Family plan",
      expectedState: "Monthly charge stays at $16.99",
      expectedBy: new Date().toISOString().slice(0, 10),
      currentState: "Charged $19.99 this cycle — a $3/mo increase, not yet investigated",
      status: "stalled",
      stakes: "money",
      context: {
        rawSummary:
          "Gmail receipt shows $19.99 charged this cycle. The previous 9 receipts all show $16.99 — flagged for investigation.",
      },
    },
    eventMessage: "New loop created: Spotify Family plan — price change flagged",
  },
  {
    loop: {
      loopType: "calendar",
      title: "Dentist follow-up booking",
      expectedState: "Follow-up cleaning appointment booked",
      expectedBy: new Date().toISOString().slice(0, 10),
      currentState: "Calendar task overdue, no booking confirmation found in inbox",
      status: "stalled",
      stakes: "low",
      context: {
        rawSummary:
          "Calendar task “Book dentist follow-up” passed its due date with no linked confirmation email since.",
      },
    },
    eventMessage: "New loop created: Dentist follow-up booking — task overdue",
  },
];

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
}

const OttoContext = createContext<OttoContextValue | null>(null);

let uidCounter = 0;
function nextId(prefix: string) {
  uidCounter += 1;
  return `${prefix}-${Date.now()}-${uidCounter}`;
}

export function OttoProvider({ children }: { children: ReactNode }) {
  const [loops, setLoops] = useState<OpenLoop[]>(initialLoops);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>(
    initialPipelineEvents,
  );
  const [connections, setConnections] =
    useState<Connection[]>(initialConnections);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>(
    initialPipelineEvents[initialPipelineEvents.length - 1].timestamp,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);

  const approveLoop = useCallback(
    (id: string) => {
      const loop = loops.find((l) => l.id === id);
      if (!loop || loop.status !== "needs_approval") return;
      const now = new Date().toISOString();
      const summary = loop.context.proposedAction
        ? `Approved — ${loop.context.proposedAction}`
        : "Approved by you";

      setLoops((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, status: "resolved", currentState: summary, updatedAt: now, resolvedAt: now }
            : l,
        ),
      );
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
    (id: string) => {
      const loop = loops.find((l) => l.id === id);
      if (!loop || loop.status !== "needs_approval") return;
      const now = new Date().toISOString();

      setLoops((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: "resolved",
                currentState: "Declined by you — no action taken",
                updatedAt: now,
                resolvedAt: now,
              }
            : l,
        ),
      );
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

  const runCheckNow = useCallback(() => {
    setIsChecking(true);
    window.setTimeout(() => {
      const now = new Date().toISOString();
      const template =
        CHECK_NOW_TEMPLATES[templateIndex % CHECK_NOW_TEMPLATES.length];
      setTemplateIndex((i) => i + 1);
      const newLoopId = nextId("loop");
      const runId = `run-manual-${nextId("chk")}`;

      setLoops((prev) => [
        ...prev,
        {
          ...template.loop,
          id: newLoopId,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      setPipelineEvents((prev) => [
        ...prev,
        {
          id: nextId("evt"),
          runId,
          timestamp: now,
          type: "new_loop",
          message: template.eventMessage,
          loopId: newLoopId,
        },
      ]);
      setLastCheckedAt(now);
      setIsChecking(false);
    }, 1400);
  }, [templateIndex]);

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