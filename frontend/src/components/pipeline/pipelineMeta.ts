import {
  Sparkles,
  AlertTriangle,
  SearchCode,
  CheckCircle2,
  HandHelping,
  ThumbsUp,
  XCircle,
  type LucideIcon,
} from "../../lib/icons";
import type { PipelineEventType } from "../../types";

export const pipelineEventMeta: Record<
  PipelineEventType,
  { label: string; icon: LucideIcon; text: string }
> = {
  new_loop: { label: "New loop", icon: Sparkles, text: "text-accent-blue" },
  stall_detected: { label: "Stall detected", icon: AlertTriangle, text: "text-accent-amber" },
  investigating: { label: "Investigating", icon: SearchCode, text: "text-accent-blue" },
  auto_resolved: { label: "Auto-resolved", icon: CheckCircle2, text: "text-accent-emerald" },
  needs_approval: { label: "Needs approval", icon: HandHelping, text: "text-accent-violet" },
  user_approved: { label: "You approved", icon: ThumbsUp, text: "text-accent-emerald" },
  user_declined: { label: "You declined", icon: XCircle, text: "text-base-400" },
};