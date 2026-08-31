import { motion } from "framer-motion";
import { Mail, CalendarClock } from "../../lib/icons";
import { useOtto } from "../../hooks/useOttoStore";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

// Gmail and Google Calendar share the same Google OAuth token — one Connect
// flow covers both adapters simultaneously.
export function GoogleConnectionCard() {
  const { googleConnection, connectGoogle, disconnectGoogle } = useOtto();
  const isConnected = googleConnection?.connected ?? false;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span
          className="floating-card flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ "--rot": "-6deg", backgroundColor: "#4285F41f", color: "#4285F4" } as React.CSSProperties}
        >
          <Mail size={18} filled />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-base-50">Gmail, Calendar &amp; Drive</h3>
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
            {isConnected
              ? `Connected${googleConnection?.email ? ` · ${googleConnection.email}` : ""}`
              : "Not connected"}
          </span>
        </div>
      </div>

      <p className="mt-3.5 text-[13px] leading-relaxed text-base-400">
        Watches order confirmations and shipping emails for stalled deliveries, tracks overdue
        Google Tasks for completion, and reads unresolved comments on your Docs/Slides and
        requests to share a file from Drive — all still gated behind your approval.
      </p>

      {isConnected && (
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-base-500">
          <CalendarClock size={13} />
          <span>Google Calendar &amp; Tasks also connected</span>
        </div>
      )}

      <div className="mt-4">
        {isConnected ? (
          <Button
            variant="secondary"
            onClick={disconnectGoogle}
            className="w-full hover:border-accent-rose/40 hover:text-accent-rose"
          >
            Disconnect
          </Button>
        ) : (
          <Button variant="primary" onClick={connectGoogle} className="w-full">
            Connect
          </Button>
        )}
      </div>
    </Card>
  );
}
