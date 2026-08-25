import { useEffect } from "react";
import { motion } from "framer-motion";
import { NotebookText } from "lucide-react";
import { useOtto } from "../../hooks/useOttoStore";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

/**
 * The real Notion connection — OAuth connect, then pick which database to
 * track. Everything else in the Connections tab (Gmail, Calendar) is still
 * mock data via `connections`/`toggleConnection`; this one talks to the
 * actual backend (`notionConnection`, `notionPages`, and the OAuth actions
 * in useOttoStore).
 */
export function NotionConnectionCard() {
  const {
    notionConnection,
    notionPages,
    notionPagesLoading,
    connectNotion,
    loadNotionPages,
    selectNotionPage,
    disconnectNotion,
  } = useOtto();

  const isConnected = notionConnection?.connected ?? false;
  const needsPageSelection = isConnected && !notionConnection?.trackedPageId;

  useEffect(() => {
    if (needsPageSelection && notionPages === null && !notionPagesLoading) {
      loadNotionPages();
    }
  }, [needsPageSelection, notionPages, notionPagesLoading, loadNotionPages]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300">
          <NotebookText size={17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-base-50">Notion</h3>
          <span
            className={cn(
              "mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium",
              isConnected ? "text-accent-emerald" : "text-base-500",
            )}
          >
            <span className="relative flex h-1.5 w-1.5">
              {isConnected && (
                <motion.span
                  className="absolute inline-flex h-full w-full rounded-full bg-accent-emerald"
                  animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.8, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  isConnected ? "bg-accent-emerald" : "bg-base-600",
                )}
              />
            </span>
            {isConnected ? `Connected to ${notionConnection?.workspaceName ?? "Notion"}` : "Not connected"}
          </span>
        </div>
      </div>

      <p className="mt-3.5 text-[13px] leading-relaxed text-base-400">
        Watches a Notion database for follow-ups and to-dos that were never logged.
      </p>

      {needsPageSelection && (
        <div className="mt-3.5 rounded-lg border border-base-800 bg-base-850/60 p-3">
          <p className="text-[12px] font-medium text-base-300">Which database should Otto track?</p>
          {notionPagesLoading && <p className="mt-2 text-[13px] text-base-500">Loading pages…</p>}
          {!notionPagesLoading && notionPages?.length === 0 && (
            <p className="mt-2 text-[13px] text-base-500">
              No databases found — share one with the integration in Notion first.
            </p>
          )}
          {!notionPagesLoading && notionPages && notionPages.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {notionPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => selectNotionPage(page.id)}
                  className="w-full rounded-md border border-base-800 bg-base-900 px-2.5 py-1.5 text-left text-[13px] text-base-200 transition-colors hover:border-base-600 hover:bg-base-800"
                >
                  {page.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        {isConnected ? (
          <Button
            variant="secondary"
            onClick={disconnectNotion}
            className="w-full hover:border-accent-rose/40 hover:text-accent-rose"
          >
            Disconnect
          </Button>
        ) : (
          <Button variant="primary" onClick={connectNotion} className="w-full">
            Connect
          </Button>
        )}
      </div>
    </Card>
  );
}
