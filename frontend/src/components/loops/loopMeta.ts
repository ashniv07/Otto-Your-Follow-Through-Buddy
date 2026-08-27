import {
  Package,
  CreditCard,
  CalendarClock,
  StickyNote,
  Briefcase,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { LoopStatus, LoopType, Stakes } from "../../types";

export const loopTypeMeta: Record<LoopType, { label: string; icon: LucideIcon }> = {
  order: { label: "Order", icon: Package },
  subscription: { label: "Subscription", icon: CreditCard },
  calendar: { label: "Calendar", icon: CalendarClock },
  note: { label: "Note", icon: StickyNote },
  opportunity: { label: "Opportunity", icon: Briefcase },
  follow_up: { label: "Follow-up", icon: MessageSquare },
};

export const statusMeta: Record<
  LoopStatus,
  { label: string; dot: string; text: string; border: string }
> = {
  pending: {
    label: "Pending",
    dot: "bg-base-500",
    text: "text-base-400",
    border: "border-base-700/30",
  },
  stalled: {
    label: "Stalled",
    dot: "bg-accent-amber",
    text: "text-accent-amber",
    border: "border-accent-amber/30",
  },
  investigating: {
    label: "Investigating",
    dot: "bg-accent-blue",
    text: "text-accent-blue",
    border: "border-accent-blue/30",
  },
  needs_approval: {
    label: "Needs approval",
    dot: "bg-accent-violet",
    text: "text-accent-violet",
    border: "border-accent-violet/30",
  },
  auto_resolving: {
    label: "Auto-resolving",
    dot: "bg-accent-emerald",
    text: "text-accent-emerald",
    border: "border-accent-emerald/30",
  },
  resolved: {
    label: "Resolved",
    dot: "bg-accent-emerald",
    text: "text-accent-emerald",
    border: "border-accent-emerald/30",
  },
};

export const stakesMeta: Record<Stakes, { label: string }> = {
  low: { label: "Low stakes" },
  money: { label: "Money" },
  irreversible: { label: "Irreversible" },
};

// Approval-track statuses — split into two columns by actionSchema.type in LoopsPage.
export const APPROVAL_STATUSES: LoopStatus[] = ["stalled", "investigating", "needs_approval", "auto_resolving"];

export const statusColumns: { id: string; title: string; statuses: LoopStatus[]; dot: string }[] = [
  { id: "watching",       title: "Waiting",          statuses: ["pending"],        dot: "bg-base-500" },
  { id: "approve_action", title: "Stalled",          statuses: APPROVAL_STATUSES,  dot: "bg-accent-violet" },
  { id: "mark_as_done",   title: "Acknowledge",      statuses: APPROVAL_STATUSES,  dot: "bg-accent-amber" },
  { id: "resolved",       title: "Resolved",         statuses: ["resolved"],       dot: "bg-accent-emerald" },
];