import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { OpenLoop } from "../../types";
import { LoopCard } from "./LoopCard";
import { statusMeta } from "./loopMeta";
import { cn } from "../../lib/utils";

interface ResolvedDrawerProps {
  open: boolean;
  onClose: () => void;
  loops: OpenLoop[];
  onOpenLoop: (id: string) => void;
}

export function ResolvedDrawer({ open, onClose, loops, onOpenLoop }: ResolvedDrawerProps) {
  const meta = statusMeta.resolved;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-base-800 bg-base-900 shadow-2xl shadow-black/20"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <div className="flex items-center gap-2 border-b border-base-800 px-5 py-4">
              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
              <h2 className="text-[15px] font-semibold text-base-50">Resolved</h2>
              <span className="rounded-md bg-base-800 px-1.5 py-0.5 text-[11px] font-medium text-base-400">
                {loops.length}
              </span>
              <button
                onClick={onClose}
                className="ml-auto rounded-md p-1.5 text-base-400 transition-colors hover:bg-base-800 hover:text-base-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-2.5">
                <AnimatePresence mode="popLayout">
                  {loops.map((loop) => (
                    <LoopCard key={loop.id} loop={loop} onOpen={onOpenLoop} />
                  ))}
                </AnimatePresence>
                {loops.length === 0 && (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-base-800 py-10 text-center text-xs text-base-500">
                    Nothing resolved yet
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}