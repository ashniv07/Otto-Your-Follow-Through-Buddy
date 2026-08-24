import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "dark";
}

export function Button({
  children,
  className,
  variant = "primary",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-accent text-base-50 hover:bg-accent-strong",
        variant === "secondary" &&
          "border border-base-700 bg-base-900 text-base-200 hover:bg-base-800",
        variant === "dark" && "bg-base-50 text-base-950 hover:bg-base-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}