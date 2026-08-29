interface Callout {
  label: string;
  x: number;
  y: number;
}

interface GrowthChartProps {
  callouts: Callout[];
}

/** Decorative hand-authored line chart — two lime curves on a dark panel. */
export function GrowthChart({ callouts }: GrowthChartProps) {
  return (
    <div className="relative">
      <svg viewBox="0 0 1000 360" className="w-full" fill="none">
        <line x1="0" y1="120" x2="1000" y2="120" stroke="#3c4043" strokeDasharray="4 6" />
        <line x1="0" y1="240" x2="1000" y2="240" stroke="#3c4043" strokeDasharray="4 6" />
        <path
          d="M0 330 C 120 320, 200 300, 260 250 S 400 140, 480 150 S 620 260, 700 230 S 900 40, 1000 10"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M0 340 C 140 335, 220 320, 300 300 S 460 220, 560 225 S 700 280, 780 260 S 920 140, 1000 110"
          stroke="var(--color-accent)"
          strokeOpacity="0.4"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line x1="0" y1="356" x2="1000" y2="356" stroke="#5f6368" strokeWidth="1.5" />
      </svg>

      {callouts.map((c) => (
        <span
          key={c.label}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-3 py-1.5 text-[13px] font-semibold text-base-900 shadow-lg"
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}