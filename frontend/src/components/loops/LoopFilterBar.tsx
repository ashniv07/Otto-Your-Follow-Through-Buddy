import type { LoopType } from "../../types";
import { loopTypeMeta } from "./loopMeta";
import { cn } from "../../lib/utils";

interface LoopFilterBarProps {
  active: LoopType | null;
  onChange: (type: LoopType | null) => void;
  counts: Record<LoopType, number>;
}

const TYPES = Object.keys(loopTypeMeta) as LoopType[];

export function LoopFilterBar({ active, onChange, counts }: LoopFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip label="All" isActive={active === null} onClick={() => onChange(null)} />
      {TYPES.map((type) => {
        const meta = loopTypeMeta[type];
        const Icon = meta.icon;
        return (
          <FilterChip
            key={type}
            label={meta.label}
            icon={Icon}
            count={counts[type]}
            isActive={active === type}
            onClick={() => onChange(active === type ? null : type)}
          />
        );
      })}
    </div>
  );
}

function FilterChip({
  label,
  icon: Icon,
  count,
  isActive,
  onClick,
}: {
  label: string;
  icon?: typeof loopTypeMeta.order.icon;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        isActive
          ? "border-base-50 bg-base-50 text-base-950"
          : "border-base-800 bg-base-900 text-base-400 hover:border-base-700 hover:text-base-200",
      )}
    >
      {Icon && <Icon size={13} />}
      {label}
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded px-1 text-[11px]",
            isActive ? "text-base-950/60" : "text-base-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}