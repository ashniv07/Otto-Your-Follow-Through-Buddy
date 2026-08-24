import { motion } from "framer-motion";
import { Link2Off } from "lucide-react";
import type { Connection } from "../../types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { connectionIcons } from "./connectionMeta";
import { cn } from "../../lib/utils";

interface ConnectionCardProps {
  connection: Connection;
  onToggle: (id: string) => void;
}

export function ConnectionCard({ connection, onToggle }: ConnectionCardProps) {
  const Icon = connectionIcons[connection.id] ?? Link2Off;
  const isConnected = connection.status === "connected";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300">
          <Icon size={17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-base-50">{connection.name}</h3>
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
            {isConnected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>

      <p className="mt-3.5 text-[13px] leading-relaxed text-base-400">
        {connection.description}
      </p>

      <div className="mt-4">
        {isConnected ? (
          <Button
            variant="secondary"
            onClick={() => onToggle(connection.id)}
            className="w-full hover:border-accent-rose/40 hover:text-accent-rose"
          >
            Disconnect
          </Button>
        ) : (
          <Button variant="primary" onClick={() => onToggle(connection.id)} className="w-full">
            Connect
          </Button>
        )}
      </div>
    </Card>
  );
}