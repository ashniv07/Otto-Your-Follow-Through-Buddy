import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  HandHelping,
  Mail,
  SearchCode,
  Sparkles,
} from "../lib/icons";
import { useOtto } from "../hooks/useOttoStore";
import { LandingNav } from "../components/landing/LandingNav";
import { PhoneMockup } from "../components/landing/PhoneMockup";
import { GrowthChart } from "../components/landing/GrowthChart";
import { loopTypeMeta } from "../components/loops/loopMeta";

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
  { type: "order" as const, example: "A package frozen at “out for delivery” for four days." },
  { type: "subscription" as const, example: "A quiet $15/mo price hike with no renewal notice." },
  { type: "calendar" as const, example: "A passport renewal that's six days overdue." },
  { type: "note" as const, example: "A security deposit nobody followed up on." },
];

// Smooth, subtle scroll-reveal — the whole page used to rely on a sticky
// "stack of cards" scroll-jack (each section pinned full-screen and the
// next one slammed on top). That's what read as janky/not-smooth; a normal
// document flow with a gentle fade-and-rise on scroll is the actual
// pattern Google's own marketing pages use.
const REVEAL = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

export function LandingPage() {
  const { loops, connections, signIn } = useOtto();

  const heroLoop = loops.find((l) => l.status === "needs_approval") ?? loops[0];
  const resolvedCount = loops.filter((l) => l.status === "resolved").length;
  const needsApprovalCount = loops.filter((l) => l.status === "needs_approval").length;
  const connectedCount = connections.filter((c) => c.status === "connected").length;

  return (
    <div className="bg-base-950">
      <LandingNav />

      {/* ---------- Hero ---------- */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-16 pt-32 sm:pt-40 lg:flex-row lg:items-center lg:gap-16 lg:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-base-800 bg-base-900 px-3 py-1 text-[12px] font-medium text-base-400">
            <Sparkles size={13} className="text-accent" />
            Built for the Google "All Things Agentic" hackathon
          </span>

          <h1 className="mt-5 text-[clamp(2.25rem,5.5vw,3.75rem)] font-black leading-[1.05] tracking-tight text-base-50">
            Something stopped moving.
            <br />
            <span className="text-accent">Otto noticed.</span>
          </h1>

          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-base-400">
            Otto watches Gmail, Calendar, and your notes for promises that quietly stalled — a
            frozen delivery, a silent price hike, an overdue task — and either fixes them or asks
            before it acts.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={signIn}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-base-900 transition-colors hover:bg-accent-strong"
            >
              Get started free
              <ArrowRight size={16} />
            </button>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-base-800 px-6 py-3 text-[15px] font-semibold text-base-200 transition-colors hover:border-base-600 hover:text-base-50"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-[13px] text-base-500">
            Free to try &middot; No credit card &middot; Disconnect anytime
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto shrink-0 lg:mx-0"
        >
          <PhoneMockup>
            {heroLoop ? (
              <HeroLoopPreview
                title={heroLoop.title}
                note={heroLoop.currentState}
                action={heroLoop.context.proposedAction ?? ""}
              />
            ) : (
              <PipelinePreview />
            )}
          </PhoneMockup>
        </motion.div>
      </section>

      {/* ---------- Trust bar ---------- */}
      <motion.section {...REVEAL} className="border-y border-base-800 bg-base-900">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 px-6 py-8 sm:grid-cols-4">
          <StatCard label="Open loops tracked" value={loops.length} />
          <StatCard label="Resolved so far" value={resolvedCount} />
          <StatCard label="Waiting on your decision" value={needsApprovalCount} />
          <StatCard label="Adapters connected" value={connectedCount} />
        </div>
      </motion.section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
        <motion.div {...REVEAL} className="max-w-xl">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black leading-tight tracking-tight text-base-50">
            How Otto works
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-base-400">
            Four steps, all running quietly in the background — nothing to check, nothing to
            configure beyond connecting your accounts once.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              {...REVEAL}
              transition={{ ...REVEAL.transition, delay: i * 0.08 }}
              className="rounded-2xl border border-base-800 bg-base-900 p-5"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold text-base-900"
                style={{ backgroundColor: GOOGLE_COLORS[i] }}
              >
                {step.n}
              </div>
              <h3 className="mt-4 text-[14px] font-semibold text-base-50">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-base-400">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- Loop types ---------- */}
      <section id="loop-types" className="bg-base-900">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <motion.div {...REVEAL} className="max-w-xl">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black leading-tight tracking-tight text-base-50">
              Built for every kind of loop
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-base-400">
              Delivery tracking, subscription billing, and your own calendar aren't separate
              problems — they're the same event: a promise that quietly stopped moving.
            </p>
          </motion.div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP_TYPES.map(({ type, example }, i) => {
              const meta = loopTypeMeta[type];
              const Icon = meta.icon;
              return (
                <motion.div
                  key={type}
                  {...REVEAL}
                  transition={{ ...REVEAL.transition, delay: i * 0.06 }}
                  className="rounded-2xl border border-base-800 bg-base-950 p-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-base-900 text-accent">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-base-50">{meta.label}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-base-400">{example}</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div {...REVEAL} id="adapters" className="mt-8 flex flex-wrap gap-3">
            <Pill icon={Mail} label="Reads Gmail" />
            <Pill icon={SearchCode} label="Reads Calendar" />
            <Pill icon={HandHelping} label="Reads your notes" />
            <Pill icon={CheckCircle2} label="Acts only when safe" />
          </motion.div>
        </div>
      </section>

      {/* ---------- Impact ---------- */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
        <motion.div {...REVEAL} className="overflow-hidden rounded-3xl border border-base-800 bg-base-900 p-6 sm:p-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-black leading-tight tracking-tight text-base-50">
                What does a loop left alone cost you?
              </h2>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-base-400">
                A subscription price hike nobody caught. A deposit nobody chased. Small amounts,
                quietly compounding for as long as nothing happens — until Otto looks.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <ImpactStat value="$51/mo" label="saved on an Adobe downgrade" />
                <ImpactStat value="$1,400" label="recovered on a chased deposit" />
              </div>
            </div>
            <GrowthChart
              callouts={[
                { label: "$51/mo saved", x: 46, y: 40 },
                { label: "$1,400 recovered", x: 88, y: 8 },
              ]}
            />
          </div>
        </motion.div>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <motion.section {...REVEAL} className="border-t border-base-800">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28">
          <h2 className="text-[clamp(1.75rem,4.5vw,3rem)] font-black leading-tight tracking-tight text-base-50">
            Stop checking. Start knowing.
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-base-400">
            Connect an account and Otto starts watching tonight.
          </p>
          <button
            type="button"
            onClick={signIn}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-[15px] font-semibold text-base-900 transition-colors hover:bg-accent-strong"
          >
            Get started free
            <ArrowRight size={16} />
          </button>
        </div>
      </motion.section>

      <footer className="border-t border-base-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-[12px] text-base-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Otto — built for the Google "All Things Agentic" hackathon, Taskmaster track.</span>
          <span>Not investment, legal, or financial advice. Demo data throughout.</span>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-base-50">{value}</div>
      <div className="mt-1 text-[12px] leading-snug text-base-400">{label}</div>
    </div>
  );
}

function ImpactStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-base-800 bg-base-950 px-4 py-3">
      <div className="text-lg font-bold text-accent">{value}</div>
      <div className="mt-0.5 text-[12px] text-base-400">{label}</div>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
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
      {action && (
        <div className="mt-4 rounded-xl bg-base-950/5 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-base-950/50">
            Proposed action
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-base-950/80">{action}</p>
        </div>
      )}
      <button className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-base-900">
        <Check size={14} />
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
            <p className="text-[12px] leading-snug text-base-950/60">{row.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
