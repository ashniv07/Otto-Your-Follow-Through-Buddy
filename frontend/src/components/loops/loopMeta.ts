import {
  Package,
  CreditCard,
  CalendarClock,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { LoopStatus, LoopType, Stakes } from "../../types";

export const loopTypeMeta: Record<LoopType, { label: string; icon: LucideIcon }> = {
  order: { label: "Order", icon: Package },
  subscription: { label: "Subscription", icon: CreditCard },
  calendar: { label: "Calendar", icon: CalendarClock },
  note: { label: "Note", icon: StickyNote },
};

export const statusMeta: Record<
  LoopStatus,
  { label: string; dot: string; text: string; border: string }
> = {
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

export const statusColumns: { status: LoopStatus; title: string }[] = [
  { status: "stalled", title: "Stalled" },
  { status: "investigating", title: "Investigating" },
  { status: "needs_approval", title: "Needs approval" },
  { status: "resolved", title: "Resolved" },
];