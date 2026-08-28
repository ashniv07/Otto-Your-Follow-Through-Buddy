export type LoopType =
  | "order"
  | "subscription"
  | "calendar"
  | "note"
  | "opportunity"
  | "follow_up"
  | "docs"
  | "unsubscribe"
  | "file_request";

export type LoopStatus =
  | "pending"
  | "stalled"
  | "investigating"
  | "needs_approval"
  | "auto_resolving"
  | "resolved";

export type Stakes = "low" | "money" | "irreversible";

export interface ActionSchema {
  type: "compose" | "info" | "doc_reply" | "needs_resource" | "unsubscribe" | "file_share";
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  headline?: string;
  detail?: string;
  // doc_reply
  replyText?: string;
  // needs_resource
  question?: string;
  resourceAnswer?: string;
  // unsubscribe
  targetCompany?: string;
  matchCount?: number;
  method?: "one_click" | "link" | "mailto" | "not_found";
  // file_share
  fileId?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  webViewLink?: string;
}

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
    actionSchema?: ActionSchema;
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