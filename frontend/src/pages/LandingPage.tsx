import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  HandHelping,
  SearchCode,
  Sparkles,
} from "lucide-react";
import { useOtto } from "../hooks/useOttoStore";
import { StackSection } from "../components/landing/StackSection";
import { LandingNav } from "../components/landing/LandingNav";
import { PhoneMockup } from "../components/landing/PhoneMockup";
import { GrowthChart } from "../components/landing/GrowthChart";
import { loopTypeMeta } from "../components/loops/loopMeta";
import { cn } from "../lib/utils";

// Google's own four brand colors — used once, here, as a small authentic
// touch on the numbered steps rather than scattered everywhere.
const GOOGLE_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];

const STEPS = [
  {
    n: "1",
    title: "Connect your tools",
    body: "Gmail, Google Calendar, and your notes. One click each, nothing to configure.",
  },
  {
    n: "2",
    title: "Otto watches",
    body: "Every night, it sweeps for anything that was supposed to move and didn't.",
  },
  {
    n: "3",
    title: "It investigates",
    body: "Pulls the real context — carrier status, SLA terms, price history — before deciding anything.",
  },
  {
    n: "4",
    title: "You decide, or it does",
    body: "Low-stakes loops close themselves. Money or anything irreversible waits for your yes.",
  },
];

const LOOP_TYPES = [
  {
    type: "order" as const,
    example: "A package frozen at “out for delivery” for four days.",
  },
  {
    type: "subscription" as const,
    example: "A quiet $15/mo price hike with no renewal notice.",
  },
  {
    type: "calendar" as const,
    example: "A passport renewal that's six days overdue.",
  },
  {
    type: "note" as const,
    example: "A security deposit nobody followed up on.",
  },
];

export function LandingPage() {
  const { loops, connections } = useOtto();

  const heroLoop = loops.find((l) => l.id === "loop-002");
  const resolvedCount = loops.filter((l) => l.status === "resolved").length;
  const needsApprovalCount = loops.filter((l) => l.status === "needs_approval").length;
  const connectedCount = connections.filter((c) => c.status === "connected").length;

  return (
    <div className="google-theme bg-base-950">
      <LandingNav />

      {/* ---------- 1. Hero ---------- */}
      <StackSection index={0} rounded={false} className="bg-base-950">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-10 pt-32 sm:pt-40">
          <div className="max-w-[220px] text-[13px] leading-snug text-base-400">
            <p>Trust Otto to handle it, or step in yourself — the choice stays yours.</p>
            <p className="mt-3">Take the first step toward a life with no dropped threads.</p>
          </div>

          <div className="relative mt-8 flex-1">
            <h1
              className="select-none text-[15vw] font-black leading-[0.82] tracking-tight text-base-50 sm:text-[9rem] lg:text-[10.5rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              SOMETHING
              <br />
              STOPPED
              <br />
              MOVING
            </h1>

            <div className="mt-8 flex justify-end sm:mt-0 sm:absolute sm:bottom-[-2.5rem] sm:right-0 lg:right-10">
              <PhoneMockup>
                {heroLoop && <HeroLoopPreview title={heroLoop.title} note={heroLoop.currentState} action={heroLoop.context.proposedAction ?? ""} />}
              </PhoneMockup>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-6 border-t border-base-800 pt-6 sm:mt-24 sm:flex-row sm:items-start sm:justify-between">
            <svg width="28" height="20" viewBox="0 0 28 20" fill="none" className="shrink-0 text-base-50">
              <path d="M0 0L14 20L28 0H20L14 9L8 0H0Z" fill="currentColor" />
            </svg>
            <p className="max-w-xs text-[13px] leading-relaxed text-base-400">
              Every stalled order, price hike, and overdue task caught automatically — across
              Gmail, Calendar, and your notes.
            </p>
            <p className="max-w-xs text-[13px] leading-relaxed text-base-400">
              Low-stakes fixes happen on their own. Anything with money or an irreversible step
              waits for your approval.
            </p>
          </div>
        </div>
      </StackSection>

      {/* ---------- 2. How it reads your life ---------- */}
      <StackSection index={1} id="how-it-works" className="bg-base-900">
        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-6 py-20 sm:py-28 lg:grid-cols-2">
          <div>
            <h2
              className="text-[13vw] font-black leading-[0.9] tracking-tight text-base-50 sm:text-[4.5rem] lg:text-[5rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              WATCHES
              <br />
              EVERYTHING
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-base-400">
              Otto reads Gmail receipts, Calendar tasks, and your notes — the same way you would,
              just every night instead of never. No new app to obsessively check, no inbox
              filters to maintain.
            </p>

            <h3
              className="mt-14 text-[9vw] font-black leading-[0.9] tracking-tight text-base-700 sm:text-[3rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              INVESTIGATES QUIETLY
            </h3>
          </div>

          <div className="flex justify-center lg:justify-end">
            <PhoneMockup>
              <PipelinePreview />
            </PhoneMockup>
          </div>
        </div>
      </StackSection>

      {/* ---------- 3. Steps + live stats ---------- */}
      <StackSection index={2} className="bg-base-950">
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-20 sm:py-28">
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.n}>
                <div
                  className="text-[4rem] font-black leading-none sm:text-[5rem]"
                  style={{ fontFamily: "var(--font-display)", color: GOOGLE_COLORS[i] }}
                >
                  {step.n}
                </div>
                <h3 className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-base-100">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-base-400">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-20">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-base-400">
              What Otto is watching right now
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Open loops tracked" value={loops.length} />
              <StatCard label="Resolved so far" value={resolvedCount} />
              <StatCard label="Waiting on your decision" value={needsApprovalCount} />
              <StatCard label="Adapters connected" value={connectedCount} />
            </div>
          </div>
        </div>
      </StackSection>

      {/* ---------- 4. Cost of a silent loop (dark break) ---------- */}
      <StackSection index={3} className="bg-base-50">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-20 sm:py-28">
          <h2
            className="max-w-3xl text-[9vw] font-black leading-[0.95] tracking-tight text-accent sm:text-[3.5rem] lg:text-[4rem]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            WHAT DOES A LOOP LEFT ALONE COST YOU?
          </h2>
          <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-base-500">
            A subscription price hike nobody caught. A deposit nobody chased. Small amounts,
            quietly compounding for as long as nothing happens — until Otto looks.
          </p>

          <div className="mt-14">
            <GrowthChart
              callouts={[
                { label: "$51/mo saved — Adobe downgrade", x: 46, y: 40 },
                { label: "$1,400 recovered — deposit chased", x: 88, y: 8 },
              ]}
            />
          </div>
        </div>
      </StackSection>

      {/* ---------- 5. Loop types ---------- */}
      <StackSection index={4} id="loop-types" className="bg-base-900">
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-20 sm:py-28">
          <h2
            className="max-w-2xl text-[10vw] font-black leading-[0.9] tracking-tight text-base-50 sm:text-[4rem]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            BUILT FOR EVERY KIND OF LOOP
          </h2>
          <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-base-400">
            Delivery tracking, subscription billing, expense reimbursement, and your own calendar
            aren't four separate problems. They're the same event: a promise that quietly
            stopped moving.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP_TYPES.map(({ type, example }) => {
              const meta = loopTypeMeta[type];
              const Icon = meta.icon;
              return (
                <div key={type} className="rounded-2xl border border-base-800 bg-base-850 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-base-950 text-base-100">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-base-50">{meta.label}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-base-400">{example}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 flex flex-wrap gap-3" id="adapters">
            <Pill icon={SearchCode} label="Reads Gmail" />
            <Pill icon={Sparkles} label="Reads Calendar" />
            <Pill icon={HandHelping} label="Reads your notes" />
            <Pill icon={CheckCircle2} label="Acts only when safe" />
          </div>
        </div>
      </StackSection>

      {/* ---------- 6. Closing CTA ---------- */}
      <StackSection index={5} className="bg-base-50">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-between px-6 py-20 sm:py-28">
          <div>
            <h2
              className="text-[13vw] font-black leading-[0.88] tracking-tight text-base-950 sm:text-[6.5rem] lg:text-[7.5rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              STOP CHECKING.
              <br />
              START KNOWING.
            </h2>
            <Link
              to="/app"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[15px] font-semibold text-base-900 transition-colors hover:bg-accent-strong"
            >
              Get started free
              <ArrowRight size={16} />
            </Link>
          </div>

          <footer className="mt-24 flex flex-col gap-4 border-t border-base-800 pt-6 text-[12px] text-base-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Otto — built for the Google “All Things Agentic” hackathon, Taskmaster track.</span>
            <span>Not investment, legal, or financial advice. Demo data throughout.</span>
          </footer>
        </div>
      </StackSection>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-base-800 bg-base-900 p-4">
      <div className="text-2xl font-semibold text-base-50">{value}</div>
      <div className="mt-1 text-[12px] leading-snug text-base-400">{label}</div>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof SearchCode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-base-800 bg-base-950 px-3 py-1.5 text-[12px] font-medium text-base-400">
      <Icon size={13} />
      {label}
    </span>
  );
}

function HeroLoopPreview({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-base-950/50">
            Needs approval
          </p>
          <p className="text-[15px] font-semibold text-base-950">{title}</p>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-base-950/60">{note}</p>
      <div className="mt-4 rounded-xl bg-base-950/5 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-base-950/50">
          Proposed action
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-base-950/80">{action}</p>
      </div>
      <button className="mt-4 w-full rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-base-900">
        Approve
      </button>
    </div>
  );
}

function PipelinePreview() {
  const rows = [
    { icon: Sparkles, label: "New loop", text: "NYT subscription — price change flagged" },
    { icon: SearchCode, label: "Investigating", text: "Nike return — refund timeline" },
    { icon: CheckCircle2, label: "Auto-resolved", text: "Peloton trial cancelled, $44 avoided" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-base-950/50">
        Tonight&apos;s run
      </p>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-base-950/8 text-base-950/70">
            <row.icon size={12} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-base-950/70">{row.label}</p>
            <p className={cn("text-[12px] leading-snug text-base-950/60")}>{row.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}