import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { cn } from "../../lib/utils";

export type TabKey = "loops" | "pipeline" | "connections";

const TABS: { key: TabKey; label: string }[] = [
  { key: "loops", label: "Loops" },
  { key: "pipeline", label: "Pipeline" },
  { key: "connections", label: "Connections" },
];

interface HeaderProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function Header({ active, onChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-base-800 bg-base-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-2.5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-base-50 text-base-950">
            <Bot size={15} strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-tight text-base-50">Otto</p>
          </div>
        </Link>

        <nav className="flex items-center gap-0.5 rounded-lg border border-base-800 bg-base-900 p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "relative rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                active === tab.key ? "text-base-950" : "text-base-400 hover:text-base-100",
              )}
            >
              {active === tab.key && (
                <motion.span
                  layoutId="active-tab-pill"
                  className="absolute inset-0 rounded-md bg-base-50"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <span className="relative">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 text-[12px] font-medium text-base-400 sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-emerald opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-emerald" />
          </span>
          Agent online
        </div>
      </div>
    </header>
  );
}