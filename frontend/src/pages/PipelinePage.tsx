import { useEffect, useMemo, useState } from "react";
import { RotateCw, Radio } from "lucide-react";
import { useOtto } from "../hooks/useOttoStore";
import { PipelineTimeline } from "../components/pipeline/PipelineTimeline";
import { Button } from "../components/ui/Button";
import { timeAgo } from "../lib/utils";

interface PipelinePageProps {
  onViewLoop: (loopId: string) => void;
}

export function PipelinePage({ onViewLoop }: PipelinePageProps) {
  const { pipelineEvents, lastCheckedAt, isChecking, runCheckNow } = useOtto();
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const runs = useMemo(() => {
    const byRun = new Map<string, typeof pipelineEvents>();
    for (const event of pipelineEvents) {
      const key = event.runId ?? "unknown";
      if (!byRun.has(key)) byRun.set(key, []);
      byRun.get(key)!.push(event);
    }
    return Array.from(byRun.entries())
      .map(([runId, events]) => ({
        runId,
        timestamp: events[0].timestamp,
        events: [...events].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [pipelineEvents]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-base-50">Pipeline</h1>
          <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-base-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-emerald opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-emerald" />
            </span>
            Last checked {lastCheckedAt ? timeAgo(lastCheckedAt) : "never"}
          </div>
        </div>

        <Button onClick={runCheckNow} disabled={isChecking} variant="secondary">
          {isChecking ? (
            <>
              <RotateCw size={14} className="animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <Radio size={14} />
              Run check now
            </>
          )}
        </Button>
      </div>

      {isChecking && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-base-800 bg-base-900 px-3.5 py-2.5 text-[13px] text-base-300">
          <RotateCw size={14} className="animate-spin text-base-300" />
          Sweeping Gmail, Calendar, and Notes for new stalls…
        </div>
      )}

      <PipelineTimeline runs={runs} onViewLoop={onViewLoop} />
    </div>
  );
}