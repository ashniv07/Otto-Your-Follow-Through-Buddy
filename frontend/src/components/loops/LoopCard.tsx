import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import type { OpenLoop } from "../../types";
import { Card } from "../ui/Card";
import { loopTypeMeta, statusMeta } from "./loopMeta";
import { formatDateShort, timeAgo, daysOverdue } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { ApproveDeclineRow } from "./ApproveDeclineRow";

interface LoopCardProps {
  loop: OpenLoop;
  onOpen: (id: string) => void;
}

export function LoopCard({ loop, onOpen }: LoopCardProps) {
  const type = loopTypeMeta[loop.loopType];
  const status = statusMeta[loop.status];
  const Icon = type.icon;
  const overdue = daysOverdue(loop.expectedBy);
  const isInvestigating = loop.status === "investigating";
  const isNeedsApproval = loop.status === "needs_approval";

  return (
    <motion.div
      layout
      layoutId={`loop-card-${loop.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        onClick={() => onOpen(loop.id)}
        className="cursor-pointer p-3.5 hover:border-base-600 hover:bg-base-850"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-base-400">
            <Icon size={13} className="text-base-400" />
            {type.label}
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              status.text,
            )}
          >
            {isInvestigating ? (
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    status.dot,
                  )}
                />
                <span
                  className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", status.dot)}
                />
              </span>
            ) : (
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            )}
            {status.label}
          </span>
        </div>

        <h3 className="mt-2 text-sm font-semibold leading-snug text-base-50">
          {loop.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-base-300">
          {loop.currentState}
        </p>

        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-base-500">
          <CalendarClock size={12} />
          <span>Expected {formatDateShort(loop.expectedBy)}</span>
          {loop.status !== "resolved" && overdue > 0 && (
            <span className="ml-1 rounded-md bg-accent-rose/10 px-1.5 py-0.5 font-medium text-accent-rose">
              {overdue}d overdue
            </span>
          )}
        </div>

        {isNeedsApproval && loop.context.proposedAction && (
          <div className="mt-3 rounded-lg border-l-2 border-accent-violet/60 bg-base-800/60 py-2 pl-3 pr-2.5">
            <p className="text-[11px] font-medium text-accent-violet">Proposed action</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] text-base-200">
              {loop.context.proposedAction}
            </p>
            <ApproveDeclineRow loopId={loop.id} />
          </div>
        )}

        <div className="mt-2.5 text-[11px] text-base-500">
          Updated {timeAgo(loop.updatedAt)}
        </div>
      </Card>
    </motion.div>
  );
}