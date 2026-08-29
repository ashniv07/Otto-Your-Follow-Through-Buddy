import { useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "../../lib/icons";
import { useOtto } from "../../hooks/useOttoStore";
import { cn } from "../../lib/utils";

interface ApproveDeclineRowProps {
  loopId: string;
  approveLabel?: string;
  className?: string;
}

type Phase = "idle" | "approving" | "declining";

export function ApproveDeclineRow({ loopId, approveLabel = "Approve", className }: ApproveDeclineRowProps) {
  const { approveLoop, declineLoop } = useOtto();
  const [phase, setPhase] = useState<Phase>("idle");

  function handleApprove(e: MouseEvent) {
    e.stopPropagation();
    if (phase !== "idle") return;
    setPhase("approving");
    window.setTimeout(() => approveLoop(loopId), 600);
  }

  function handleDecline(e: MouseEvent) {
    e.stopPropagation();
    if (phase !== "idle") return;
    setPhase("declining");
    window.setTimeout(() => declineLoop(loopId), 350);
  }

  return (
    <div
      className={cn("mt-2.5 flex items-center gap-2", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.button
        type="button"
        onClick={handleApprove}
        disabled={phase !== "idle"}
        whileTap={{ scale: 0.97 }}
        animate={
          phase === "approving"
            ? { scale: [1, 1.04, 1], boxShadow: "0 0 0 6px rgba(26,156,103,0)" }
            : {}
        }
        transition={{ duration: 0.4 }}
        className={cn(
          "relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
          phase === "approving"
            ? "bg-accent-emerald text-white"
            : "bg-accent-emerald/12 text-accent-emerald hover:bg-accent-emerald/20",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {phase === "approving" ? (
            <motion.span
              key="check"
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              className="flex items-center gap-1.5"
            >
              <Check size={14} strokeWidth={3} />
              Done
            </motion.span>
          ) : (
            <motion.span
              key="label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              {approveLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <button
        type="button"
        onClick={handleDecline}
        disabled={phase !== "idle"}
        className="flex items-center justify-center gap-1.5 rounded-md border border-base-700 bg-base-850 px-2.5 py-1.5 text-[13px] font-medium text-base-300 transition-colors hover:border-accent-rose/40 hover:text-accent-rose disabled:opacity-60"
      >
        {phase === "declining" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <X size={14} />
        )}
        Decline
      </button>
    </div>
  );
}