import { AnimatePresence, motion } from "framer-motion";
import { Plug, X } from "lucide-react";
import type { futureAdapters as FutureAdapters } from "../../lib/mockData";

interface AddConnectionModalProps {
  open: boolean;
  onClose: () => void;
  adapters: typeof FutureAdapters;
}

export function AddConnectionModal({ open, onClose, adapters }: AddConnectionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
            className="relative z-10 w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5 shadow-2xl shadow-black/50"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1.5 text-base-400 transition-colors hover:bg-base-800 hover:text-base-100"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-base-100">
              <Plug size={16} />
              <h2 className="text-[15px] font-semibold text-base-50">More adapters</h2>
            </div>
            <p className="mt-1 text-[13px] text-base-400">
              More sources for Otto to watch, on the way.
            </p>

            <div className="mt-4 space-y-2">
              {adapters.map((adapter) => (
                <div
                  key={adapter.name}
                  className="flex items-center justify-between rounded-lg border border-base-800 bg-base-850/60 px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-medium text-base-100">{adapter.name}</p>
                    <p className="text-[12px] text-base-400">{adapter.description}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-base-700 px-1.5 py-0.5 text-[11px] font-medium text-base-400">
                    Coming soon
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}