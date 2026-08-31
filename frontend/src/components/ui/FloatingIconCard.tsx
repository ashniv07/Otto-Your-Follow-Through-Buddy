import { motion } from "framer-motion";
import type { LucideIcon } from "../../lib/icons";

interface FloatingIconCardProps {
  icon: LucideIcon;
  color: string;
  rotate?: number;
  size?: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The scattered-sticky-note motif from the reference template — a small
 * tilted white card with one icon, floating gently, straightening and
 * lifting on hover. Colors are always passed in from Otto's own Google
 * palette (see call sites); this component just handles the physical
 * "card" treatment (tilt, shadow, motion), not the visual language.
 */
export function FloatingIconCard({
  icon: Icon,
  color,
  rotate = -6,
  size = 52,
  delay = 0,
  className = "",
  style,
}: FloatingIconCardProps) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay }}
      className={`floating-card flex shrink-0 items-center justify-center rounded-2xl border border-base-800 bg-base-900 ${className}`}
      style={{ width: size, height: size, "--rot": `${rotate}deg`, ...style } as React.CSSProperties}
    >
      <Icon size={Math.round(size * 0.42)} filled style={{ color }} />
    </motion.div>
  );
}
