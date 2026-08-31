import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  FileText,
  Mail,
  NotebookText,
  Package,
  SearchCode,
  Sparkles,
} from "../lib/icons";
import { useOtto } from "../hooks/useOttoStore";
import { LandingNav } from "../components/landing/LandingNav";
import { PhoneMockup } from "../components/landing/PhoneMockup";
import { GrowthChart } from "../components/landing/GrowthChart";
import { FloatingIconCard } from "../components/ui/FloatingIconCard";
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

// The six real, OAuth-backed connections Otto reads from — laid out as a
// web radiating from Otto's own mark, angle in degrees clockwise from
// "up" (SVG/CSS y-down convention: 0 = top, 90 = right, 180 = bottom).
const INTEGRATIONS = [
  { icon: Mail, label: "Gmail", color: "#4285F4", angle: -60 },
  { icon: CalendarClock, label: "Calendar", color: "#EA4335", angle: 0 },
  { icon: Package, label: "Drive", color: "#FBBC05", angle: 60 },
  { icon: CheckCircle2, label: "Tasks", color: "#34A853", angle: 120 },
  { icon: FileText, label: "Docs", color: "#1a73e8", angle: 180 },
  { icon: NotebookText, label: "Notion", color: "#5f6368", angle: -120 },
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
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 overflow-x-clip px-6 pb-16 pt-32 sm:pt-40 lg:flex-row lg:items-center lg:gap-16 lg:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-base-800 bg-base-900 px-3 py-1 text-[12px] font-medium text-base-400">
            <motion.span
              className="flex text-accent"
              animate={{ opacity: [1, 0.45, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles size={13} filled />
            </motion.span>
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
            <motion.button
              type="button"
              onClick={signIn}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-base-900 shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-colors hover:bg-accent-strong hover:shadow-[0_4px_14px_-2px_var(--color-accent)]"
            >
              Get started free
              <ArrowRight size={16} />
            </motion.button>
            <motion.a
              href="#how-it-works"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-full border border-base-800 px-6 py-3 text-[15px] font-semibold text-base-200 transition-colors hover:border-base-600 hover:text-base-50"
            >
              See how it works
            </motion.a>
          </div>

          <p className="mt-5 text-[13px] text-base-500">
            Free to try &middot; No credit card &middot; Disconnect anytime
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto shrink-0 lg:mx-0"
        >
          {/* Soft ambient glow — same accent blue at low opacity, no new
              color introduced, just gives the mockup some depth instead of
              sitting flat on the page. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-12 -z-10 rounded-full opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%)",
            }}
          />

          {/* Dotted-grid textured frame around the phone, with a scatter of
              tilted icon cards overlapping its edges — the reference
              template's "app screenshot collaged with floating badges"
              device, built from Otto's own colors and Material Symbols. */}
          <div className="dot-grid relative rounded-[2rem] border border-base-800 bg-base-900/60 p-9 sm:p-11">
            <FloatingIconCard
              icon={Mail}
              color="#4285F4"
              rotate={-9}
              size={50}
              delay={0}
              className="absolute -left-5 top-8 sm:-left-9"
            />
            <FloatingIconCard
              icon={CalendarClock}
              color="#EA4335"
              rotate={8}
              size={46}
              delay={0.5}
              className="absolute -right-4 top-2 sm:-right-8"
            />
            <FloatingIconCard
              icon={FileText}
              color="#FBBC05"
              rotate={-6}
              size={44}
              delay={1}
              className="absolute -left-4 bottom-24 sm:-left-9"
            />
            <FloatingIconCard
              icon={CheckCircle2}
              color="#34A853"
              rotate={10}
              size={50}
              delay={1.5}
              className="absolute -right-5 bottom-10 sm:-right-9"
            />
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}>
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
          </div>
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

        <div className="relative mt-12">
          {/* Dotted connector spanning the row, threaded behind each opaque
              card — it only reads in the gaps between them, which is what
              actually gives the "these steps connect" cue without a fussy
              per-card SVG. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-[38px] hidden border-t-2 border-dashed border-base-700 lg:block"
          />
          <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                {...REVEAL}
                transition={{ ...REVEAL.transition, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-base-800 bg-base-900 p-5 transition-colors hover:border-base-600"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold text-base-900"
                  style={{
                    backgroundColor: GOOGLE_COLORS[i],
                    boxShadow: `0 4px 12px -2px ${GOOGLE_COLORS[i]}66`,
                  }}
                >
                  {step.n}
                </div>
                <h3 className="mt-4 text-[14px] font-semibold text-base-50">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-base-400">{step.body}</p>
              </motion.div>
            ))}
          </div>
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
              const color = GOOGLE_COLORS[i];
              return (
                <motion.div
                  key={type}
                  {...REVEAL}
                  transition={{ ...REVEAL.transition, delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  className="group rounded-2xl border border-base-800 bg-base-950 p-5 transition-colors hover:border-base-600"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 ease-out group-hover:scale-110"
                    style={{ backgroundColor: `${color}1f`, color }}
                  >
                    <Icon size={20} filled />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-base-50">{meta.label}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-base-400">{example}</p>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ---------- Integrations web ---------- */}
      <section id="adapters" className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
        <motion.div {...REVEAL} className="mx-auto max-w-xl text-center">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black leading-tight tracking-tight text-base-50">
            One agent, the whole suite
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-base-400">
            One sign-in connects everything Otto reads from — real OAuth, native Google APIs, no
            middleman.
          </p>
        </motion.div>

        <motion.div {...REVEAL} transition={{ ...REVEAL.transition, delay: 0.1 }}>
          <IntegrationsWeb />
        </motion.div>
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
          <motion.button
            type="button"
            onClick={signIn}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-[15px] font-semibold text-base-900 shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-colors hover:bg-accent-strong hover:shadow-[0_4px_14px_-2px_var(--color-accent)]"
          >
            Get started free
            <ArrowRight size={16} />
          </motion.button>
        </div>
      </motion.section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);

  // Counts up from 0 to the real value the first time it scrolls into
  // view — the numbers are live app data, so the motion is tied to
  // something true rather than decorative.
  useEffect(() => {
    if (!inView || value === 0) {
      if (value === 0) setDisplay(0);
      return;
    }
    let start: number | null = null;
    const duration = 700;
    let frame: number;
    function step(ts: number) {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplay(Math.round(progress * value));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  return (
    <div ref={ref}>
      <div className="text-2xl font-semibold tabular-nums text-base-50">{display}</div>
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

// The "integrations grid radiating from a central logo mark" motif from the
// reference — six satellite nodes on a circle around Otto's own mark, each
// joined to the center by a dashed line. Positions are computed once from
// INTEGRATIONS' angles rather than hand-placed, so adding a 7th connection
// later is a one-line change, not a layout redo. Below `lg` this collapses
// to a plain wrapped row — a radial layout has no good small-screen form.
function IntegrationsWeb() {
  const size = 420;
  const center = size / 2;
  const radius = 168;

  const points = INTEGRATIONS.map((item) => {
    const rad = ((item.angle - 90) * Math.PI) / 180;
    return { ...item, x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  });

  return (
    <>
      <div className="relative mx-auto mt-14 hidden lg:block" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
          {points.map((p) => (
            <line
              key={p.label}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="var(--color-base-700)"
              strokeWidth={2}
              strokeDasharray="3 7"
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Center mark */}
        <div
          className="absolute flex flex-col items-center justify-center gap-0.5 rounded-full bg-accent text-base-900 shadow-[0_8px_24px_-6px_var(--color-accent)]"
          style={{ left: center, top: center, width: 84, height: 84, transform: "translate(-50%, -50%)" }}
        >
          <Sparkles size={22} filled />
          <span className="text-[11px] font-bold">Otto</span>
        </div>

        {points.map((p, i) => (
          <div
            key={p.label}
            className="absolute flex flex-col items-center gap-2"
            style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
          >
            <FloatingIconCard
              icon={p.icon}
              color={p.color}
              rotate={i % 2 === 0 ? -7 : 7}
              size={54}
              delay={i * 0.25}
            />
            <span className="text-[12px] font-semibold text-base-300">{p.label}</span>
          </div>
        ))}
      </div>

      {/* Small-screen fallback: a simple wrapped row, same nodes, no radius math. */}
      <div className="mt-10 flex flex-wrap justify-center gap-4 lg:hidden">
        {INTEGRATIONS.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <FloatingIconCard icon={item.icon} color={item.color} rotate={-4} size={48} delay={0} />
            <span className="text-[12px] font-semibold text-base-300">{item.label}</span>
          </div>
        ))}
      </div>
    </>
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
    { icon: Sparkles, color: "#1a73e8", label: "New loop", text: "NYT subscription — price change flagged" },
    { icon: SearchCode, color: "#b06000", label: "Investigating", text: "Nike return — refund timeline" },
    { icon: CheckCircle2, color: "#188038", label: "Auto-resolved", text: "Peloton trial cancelled, $44 avoided" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-base-950/50">
        Tonight&apos;s run
      </p>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2.5">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${row.color}1f`, color: row.color }}
          >
            <row.icon size={12} filled />
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
