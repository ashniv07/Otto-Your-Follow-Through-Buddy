import type { PipelineEvent } from "../../types";
import { pipelineEventMeta } from "./pipelineMeta";
import { formatDateTime, formatDate, timeAgo } from "../../lib/utils";
import { cn } from "../../lib/utils";

interface RunGroup {
  runId: string;
  timestamp: string;
  events: PipelineEvent[];
}

interface DateGroup {
  dateKey: string;
  label: string;
  runs: RunGroup[];
}

interface PipelineTimelineProps {
  runs: RunGroup[];
  onViewLoop: (loopId: string) => void;
}

function groupByDate(runs: RunGroup[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const run of runs) {
    const dateKey = run.timestamp.slice(0, 10);
    if (!map.has(dateKey)) {
      map.set(dateKey, { dateKey, label: formatDate(run.timestamp), runs: [] });
    }
    map.get(dateKey)!.runs.push(run);
  }
  return Array.from(map.values());
}

export function PipelineTimeline({ runs, onViewLoop }: PipelineTimelineProps) {
  const dateGroups = groupByDate(runs);

  return (
    <div className="space-y-3">
      {dateGroups.length === 0 && (
        <div className="dot-grid rounded-xl border border-base-800 bg-base-900/70 px-4 py-10 text-center text-[13px] text-base-500">
          No activity yet — click <span className="text-base-300">Run check now</span> to start tracking.
        </div>
      )}
      {dateGroups.map((group, groupIdx) => (
        <div
          key={group.dateKey}
          className={cn(
            "rounded-xl border p-4",
            groupIdx % 2 === 0
              ? "border-base-800 bg-base-900/70"
              : "border-transparent bg-transparent",
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-base-300">
              {group.label}
            </h3>
            <span className="h-px flex-1 bg-base-800" />
          </div>

          <div className="space-y-5">
            {group.runs.map((run) => (
              <div key={run.runId}>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="text-[11px] font-medium text-base-500">
                    {formatDateTime(run.timestamp)}
                  </span>
                  <span className="text-[11px] text-base-600">&middot;</span>
                  <span className="text-[11px] text-base-500">{timeAgo(run.timestamp)}</span>
                </div>

                <div className="space-y-0">
                  {run.events.map((event, i) => {
                    const meta = pipelineEventMeta[event.type];
                    const Icon = meta.icon;
                    const isLast = i === run.events.length - 1;
                    return (
                      <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {!isLast && (
                          <span className="absolute left-[13px] top-7 h-[calc(100%-1rem)] border-l-2 border-dashed border-base-700" />
                        )}
                        <span className="z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-base-800 bg-base-950">
                          <Icon size={13} className={meta.text} />
                        </span>
                        <div className="flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("text-[12px] font-medium", meta.text)}>
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-base-500">
                              {timeAgo(event.timestamp)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[13px] text-base-200">
                            {event.message}
                            {event.loopId && (
                              <button
                                onClick={() => onViewLoop(event.loopId!)}
                                className="ml-2 text-[12px] font-medium text-accent-blue hover:underline"
                              >
                                View loop &rarr;
                              </button>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}