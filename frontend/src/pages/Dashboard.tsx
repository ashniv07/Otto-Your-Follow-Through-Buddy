import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageBackground } from "../components/ui/PageBackground";
import { Header, type TabKey } from "../components/layout/Header";
import { useOtto } from "../hooks/useOttoStore";
import { LoopsPage } from "./LoopsPage";
import { PipelinePage } from "./PipelinePage";
import { ConnectionsPage } from "./ConnectionsPage";

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cameFromNotionOAuth = searchParams.get("connected") === "notion";
  const [activeTab, setActiveTab] = useState<TabKey>(cameFromNotionOAuth ? "connections" : "loops");
  const [openLoopId, setOpenLoopId] = useState<string | null>(null);
  const { refreshNotionStatus } = useOtto();

  // Lands here after the Notion OAuth redirect (backend/api/authRoutes.js's
  // /callback) — jump to Connections and pull the freshly-created
  // connection, then drop the query params so this doesn't refire on a
  // later manual visit.
  useEffect(() => {
    if (!cameFromNotionOAuth) return;
    refreshNotionStatus();
    setSearchParams({}, { replace: true });
  }, [cameFromNotionOAuth, refreshNotionStatus, setSearchParams]);

  function viewLoopFromPipeline(loopId: string) {
    setActiveTab("loops");
    setOpenLoopId(loopId);
  }

  return (
    <>
      <PageBackground />
      <Header active={activeTab} onChange={setActiveTab} />

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "loops" && (
              <LoopsPage openId={openLoopId} onOpenChange={setOpenLoopId} />
            )}
            {activeTab === "pipeline" && (
              <PipelinePage onViewLoop={viewLoopFromPipeline} />
            )}
            {activeTab === "connections" && <ConnectionsPage />}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}