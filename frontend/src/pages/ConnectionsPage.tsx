import { useState } from "react";
import { Plus } from "../lib/icons";
import { useOtto } from "../hooks/useOttoStore";
import { ConnectionCard } from "../components/connections/ConnectionCard";
import { NotionConnectionCard } from "../components/connections/NotionConnectionCard";
import { GoogleConnectionCard } from "../components/connections/GoogleConnectionCard";
import { AddConnectionModal } from "../components/connections/AddConnectionModal";

export function ConnectionsPage() {
  const { connections, futureAdapters, toggleConnection } = useOtto();
  const [addOpen, setAddOpen] = useState(false);

  // Exclude Notion (real card) and google adapters (real card) from mock list
  const mockConnections = connections.filter(
    (c) => c.id !== "conn-notes" && c.id !== "conn-gmail" && c.id !== "conn-calendar",
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-base-50">Connections</h1>
          <p className="mt-0.5 text-[13px] text-base-400">
            The adapters Otto watches to notice when a loop stalls.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NotionConnectionCard />
        <GoogleConnectionCard />

        <button
          onClick={() => setAddOpen(true)}
          className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-base-700 text-base-500 transition-colors hover:border-base-500 hover:text-base-300"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800">
            <Plus size={18} />
          </span>
          <span className="text-[13px] font-medium">Add connection</span>
        </button>
      </div>

      <AddConnectionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        adapters={futureAdapters}
      />
    </div>
  );
}