import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface StackSectionProps {
  children: ReactNode;
  className?: string;
  /** Higher = later in the stack, painted on top. Also sets sticky z-index. */
  index: number;
  rounded?: boolean;
  id?: string;
}

/**
 * Each section is `sticky top-0 min-h-screen`. As the page scrolls, the next
 * section (later in DOM, higher z-index) slides up from below and pins at
 * the top, visually covering the previous one — a stack of cards being
 * dealt on top of each other.
 */
export function StackSection({
  children,
  className,
  index,
  rounded = true,
  id,
}: StackSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "sticky top-0 flex min-h-screen flex-col overflow-hidden",
        rounded && "rounded-t-[2.5rem] sm:rounded-t-[3.5rem]",
        className,
      )}
      style={{ zIndex: 10 + index }}
    >
      {children}
    </section>
  );
}