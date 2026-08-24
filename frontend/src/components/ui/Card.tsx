import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** A plain, flat surface: subtle border, subtle hover — no glow, no gradient. */
export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-base-800 bg-base-900 transition-colors duration-150",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}