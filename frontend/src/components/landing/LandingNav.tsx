import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Menu, X } from "lucide-react";
import { cn } from "../../lib/utils";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#loop-types", label: "Loop types" },
  { href: "#adapters", label: "Adapters" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 top-4 z-[100] px-4">
      <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-base-800/60 bg-base-900/90 px-4 py-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-md sm:px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-base-900">
            <Bot size={16} strokeWidth={2.4} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-base-50">Otto</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-base-400 transition-colors hover:text-base-50"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            to="/app"
            className="text-[13px] font-medium text-base-400 transition-colors hover:text-base-50"
          >
            Sign in
          </Link>
          <Link
            to="/app"
            className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-base-900 transition-colors hover:bg-accent-strong"
          >
            Get started
          </Link>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-base-100 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      <div
        className={cn(
          "mx-auto mt-2 max-w-5xl overflow-hidden rounded-2xl border border-base-800/60 bg-base-900/95 backdrop-blur-md transition-all duration-200 md:hidden",
          open ? "max-h-64 border-opacity-100 py-3 opacity-100" : "max-h-0 border-transparent py-0 opacity-0",
        )}
      >
        <div className="flex flex-col gap-1 px-5">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="py-2 text-[13px] font-medium text-base-300"
            >
              {link.label}
            </a>
          ))}
          <Link to="/app" className="py-2 text-[13px] font-medium text-base-300">
            Sign in
          </Link>
          <Link
            to="/app"
            className="mt-1 rounded-full bg-accent px-4 py-2 text-center text-[13px] font-semibold text-base-900"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}