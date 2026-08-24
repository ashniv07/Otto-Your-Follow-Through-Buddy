export type LoopType = "order" | "subscription" | "calendar" | "note";

export type LoopStatus =
  | "stalled"
  | "investigating"
  | "needs_approval"
  | "resolved";

export type Stakes = "low" | "money" | "irreversible";

export interface OpenLoop {
  id: string;
  loopType: LoopType;
  title: string;
  expectedState: string;
  expectedBy: string; // ISO date
  currentState: string;
  status: LoopStatus;
  stakes: Stakes;
  context: {
    rawSummary: string;
    investigationNotes?: string;
    proposedAction?: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export type PipelineEventType =
  | "new_loop"
  | "stall_detected"
  | "investigating"
  | "auto_resolved"
  | "needs_approval"
  | "user_approved"
  | "user_declined";

export interface PipelineEvent {
  id: string;
  timestamp: string;
  type: PipelineEventType;
  message: string;
  loopId?: string;
  runId?: string;
}

export type ConnectionStatus = "connected" | "not_connected";

export interface Connection {
  id: string;
  name: string;
  description: string;
  status: ConnectionStatus;
  icon?: string;
}