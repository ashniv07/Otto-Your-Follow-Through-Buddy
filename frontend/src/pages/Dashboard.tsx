import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageBackground } from "../components/ui/PageBackground";
import { Header, type TabKey } from "../components/layout/Header";
import { LoopsPage } from "./LoopsPage";
import { PipelinePage } from "./PipelinePage";
import { ConnectionsPage } from "./ConnectionsPage";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("loops");
  const [openLoopId, setOpenLoopId] = useState<string | null>(null);

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