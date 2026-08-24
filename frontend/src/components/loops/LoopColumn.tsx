import { AnimatePresence } from "framer-motion";
import type { LoopStatus, OpenLoop } from "../../types";
import { LoopCard } from "./LoopCard";
import { statusMeta } from "./loopMeta";
import { cn } from "../../lib/utils";

interface LoopColumnProps {
  status: LoopStatus;
  title: string;
  loops: OpenLoop[];
  onOpen: (id: string) => void;
}

export function LoopColumn({ status, title, loops, onOpen }: LoopColumnProps) {
  const meta = statusMeta[status];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-2.5 flex items-center gap-2 px-0.5 py-0.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        <h2 className="text-[13px] font-semibold text-base-200">{title}</h2>
        <span className="rounded-md bg-base-800 px-1.5 py-0.5 text-[11px] font-medium text-base-400">
          {loops.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5">
        <AnimatePresence mode="popLayout">
          {loops.map((loop) => (
            <LoopCard key={loop.id} loop={loop} onOpen={onOpen} />
          ))}
        </AnimatePresence>
        {loops.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-base-800 py-8 text-center text-xs text-base-500">
            Nothing here right now
          </div>
        )}
      </div>
    </div>
  );
}