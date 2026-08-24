import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, FileText, Search, Sparkles, X } from "lucide-react";
import type { OpenLoop } from "../../types";
import { loopTypeMeta, stakesMeta, statusMeta } from "./loopMeta";
import { formatDate, formatDateTime, cn } from "../../lib/utils";
import { ApproveDeclineRow } from "./ApproveDeclineRow";

interface LoopDetailModalProps {
  loop: OpenLoop | null;
  onClose: () => void;
}

export function LoopDetailModal({ loop, onClose }: LoopDetailModalProps) {
  return (
    <AnimatePresence>
      {loop && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10 sm:py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="fixed inset-0 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            layoutId={`loop-card-${loop.id}`}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-base-700 bg-base-900 shadow-2xl shadow-black/50"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <ModalBody loop={loop} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModalBody({ loop, onClose }: { loop: OpenLoop; onClose: () => void }) {
  const type = loopTypeMeta[loop.loopType];
  const status = statusMeta[loop.status];
  const Icon = type.icon;

  return (
    <div>
      <div className="relative border-b border-base-800 p-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-base-400 transition-colors hover:bg-base-800 hover:text-base-100"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 pr-8 text-[11px] font-medium uppercase tracking-wide text-base-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-base-800 text-base-300">
            <Icon size={13} />
          </span>
          {type.label}
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              status.text,
              status.border,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          <span className="ml-auto rounded-md bg-base-800 px-1.5 py-0.5 text-[11px] font-medium text-base-400">
            {stakesMeta[loop.stakes].label}
          </span>
        </div>

        <h2 className="mt-2.5 pr-8 text-base font-semibold text-base-50">{loop.title}</h2>
        <p className="mt-1 text-[13px] text-base-300">{loop.currentState}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-3.5 text-[11px] text-base-500">
          <span className="flex items-center gap-1.5">
            <CalendarClock size={12} /> Expected: {formatDate(loop.expectedBy)}
          </span>
          <span>Created {formatDate(loop.createdAt)}</span>
          {loop.resolvedAt && <span>Resolved {formatDateTime(loop.resolvedAt)}</span>}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <Section icon={FileText} label="Source summary">
          <p className="text-[13px] leading-relaxed text-base-300">{loop.context.rawSummary}</p>
        </Section>

        {loop.context.investigationNotes && (
          <Section icon={Search} label="Investigation notes">
            <p className="text-[13px] leading-relaxed text-base-300">
              {loop.context.investigationNotes}
            </p>
          </Section>
        )}

        {loop.context.proposedAction && (
          <Section icon={Sparkles} label="Proposed action" accent>
            <p className="text-[13px] leading-relaxed text-base-100">
              {loop.context.proposedAction}
            </p>
            {loop.status === "needs_approval" && (
              <ApproveDeclineRow loopId={loop.id} className="mt-3.5" />
            )}
          </Section>
        )}

        <p className="text-right text-[11px] text-base-500">
          Expected state: {loop.expectedState}
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
  accent,
}: {
  icon: typeof FileText;
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3.5",
        accent ? "border-base-700 bg-base-800/50" : "border-base-800 bg-base-850/60",
      )}
    >
      <div
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide",
          accent ? "text-accent-violet" : "text-base-400",
        )}
      >
        <Icon size={12} />
        {label}
      </div>
      {children}
    </div>
  );
}