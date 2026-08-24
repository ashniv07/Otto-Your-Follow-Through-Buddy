import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { useOtto } from "../hooks/useOttoStore";
import { LoopColumn } from "../components/loops/LoopColumn";
import { LoopDetailModal } from "../components/loops/LoopDetailModal";
import { LoopFilterBar } from "../components/loops/LoopFilterBar";
import { ResolvedDrawer } from "../components/loops/ResolvedDrawer";
import { statusColumns } from "../components/loops/loopMeta";
import type { LoopType } from "../types";

interface LoopsPageProps {
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}

const BOARD_COLUMNS = statusColumns.filter((c) => c.status !== "resolved");

export function LoopsPage({ openId, onOpenChange }: LoopsPageProps) {
  const { loops } = useOtto();
  const [typeFilter, setTypeFilter] = useState<LoopType | null>(null);
  const [resolvedOpen, setResolvedOpen] = useState(false);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const loop of loops) {
      counts[loop.loopType] = (counts[loop.loopType] ?? 0) + 1;
    }
    return counts as Record<LoopType, number>;
  }, [loops]);

  const filteredLoops = useMemo(
    () => (typeFilter ? loops.filter((l) => l.loopType === typeFilter) : loops),
    [loops, typeFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map(BOARD_COLUMNS.map((c) => [c.status, [] as typeof loops]));
    for (const loop of filteredLoops) {
      map.get(loop.status)?.push(loop);
    }
    return map;
  }, [filteredLoops]);

  const resolvedLoops = useMemo(
    () => filteredLoops.filter((l) => l.status === "resolved"),
    [filteredLoops],
  );

  const openLoop = loops.find((l) => l.id === openId) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-base-50">Open loops</h1>
          <p className="mt-0.5 text-[13px] text-base-400">
            Every obligation Otto is tracking on your behalf — {loops.length} total.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setResolvedOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-base-800 bg-base-900 px-3 py-2 text-[13px] font-medium text-base-300 transition-colors hover:border-base-700 hover:text-base-100"
        >
          <CheckCircle2 size={14} className="text-accent-emerald" />
          Resolved
          <span className="rounded bg-base-800 px-1.5 py-0.5 text-[11px] text-base-400">
            {resolvedLoops.length}
          </span>
          <ChevronLeft size={13} className="text-base-500" />
        </button>
      </div>

      <div className="mb-5">
        <LoopFilterBar active={typeFilter} onChange={setTypeFilter} counts={typeCounts} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {BOARD_COLUMNS.map((col) => (
          <LoopColumn
            key={col.status}
            status={col.status}
            title={col.title}
            loops={grouped.get(col.status) ?? []}
            onOpen={onOpenChange}
          />
        ))}
      </div>

      <ResolvedDrawer
        open={resolvedOpen}
        onClose={() => setResolvedOpen(false)}
        loops={resolvedLoops}
        onOpenLoop={onOpenChange}
      />

      <LoopDetailModal loop={openLoop} onClose={() => onOpenChange(null)} />
    </div>
  );
}