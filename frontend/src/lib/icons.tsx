import type { CSSProperties } from "react";

/**
 * Drop-in replacement for the lucide-react icons this app used to import —
 * same names, same `size`/`className`/`strokeWidth` props — but backed by
 * Google's own Material Symbols Outlined font instead of lucide's SVGs, so
 * the icon language actually matches the rest of the Google theme (see
 * index.css's `.material-symbols-outlined` rule and index.html's font
 * link). Swapping a file over is just changing the import path; no JSX at
 * any call site needs to change.
 */
export interface IconProps {
  size?: number;
  className?: string;
  /** Accepted for lucide-prop compatibility; nudges the variable font's
      weight axis heavier, since Material Symbols has no literal stroke. */
  strokeWidth?: number;
  /** Solid/flat variant (Material Symbols' FILL axis) instead of outline —
      reads closer to a flat icon set, better weight for sitting inside a
      tinted chip/circle than the thin outline default. */
  filled?: boolean;
  /** Escape hatch for per-instance styling (e.g. a dynamic brand color) that
      doesn't warrant its own prop. Merged over the icon's own sizing/font
      styles, so it can override color but not size. */
  style?: CSSProperties;
}

export type LucideIcon = (props: IconProps) => React.JSX.Element;

function makeIcon(symbolName: string): LucideIcon {
  function IconComponent({ size = 16, className, strokeWidth, filled, style: styleOverride }: IconProps) {
    const weight = strokeWidth ? Math.round(300 + strokeWidth * 100) : 400;
    const style: CSSProperties = {
      fontSize: size,
      width: size,
      height: size,
      fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" ${weight}, "GRAD" 0, "opsz" ${size}`,
      ...styleOverride,
    };
    return (
      <span
        className={["material-symbols-outlined", className].filter(Boolean).join(" ")}
        style={style}
        aria-hidden="true"
      >
        {symbolName}
      </span>
    );
  }
  IconComponent.displayName = symbolName;
  return IconComponent;
}

export const AlertCircle = makeIcon("error");
export const AlertTriangle = makeIcon("warning");
export const ArrowLeft = makeIcon("arrow_back");
export const ArrowRight = makeIcon("arrow_forward");
export const Bell = makeIcon("notifications");
export const Bot = makeIcon("smart_toy");
export const Briefcase = makeIcon("work");
export const CalendarClock = makeIcon("event");
export const Check = makeIcon("check");
export const CheckCircle2 = makeIcon("check_circle");
export const ChevronLeft = makeIcon("chevron_left");
export const CreditCard = makeIcon("credit_card");
export const FileSearch = makeIcon("find_in_page");
export const FileText = makeIcon("description");
export const HandHelping = makeIcon("volunteer_activism");
export const Link2Off = makeIcon("link_off");
export const Loader2 = makeIcon("progress_activity");
export const LogOut = makeIcon("logout");
export const Mail = makeIcon("mail");
export const MailX = makeIcon("unsubscribe");
export const Menu = makeIcon("menu");
export const MessageSquare = makeIcon("chat");
export const NotebookText = makeIcon("note_alt");
export const Package = makeIcon("package_2");
export const Plug = makeIcon("power");
export const Plus = makeIcon("add");
export const Radio = makeIcon("sensors");
export const RotateCw = makeIcon("refresh");
export const Search = makeIcon("search");
export const SearchCode = makeIcon("manage_search");
export const Sparkles = makeIcon("auto_awesome");
export const Star = makeIcon("star");
export const StickyNote = makeIcon("sticky_note_2");
export const ThumbsUp = makeIcon("thumb_up");
export const Unplug = makeIcon("power_off");
export const X = makeIcon("close");
export const XCircle = makeIcon("cancel");
