import type { ReactNode } from "react";
import { ArrowLeft, Bell, Star } from "lucide-react";

export function PhoneMockup({ children }: { children: ReactNode }) {
  return (
    <div className="w-[280px] rounded-[2.25rem] border-[6px] border-base-50 bg-base-50 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.35)] sm:w-[300px]">
      <div className="flex items-center justify-between px-4 pb-3 pt-3 text-base-950/70">
        <ArrowLeft size={16} />
        <div className="flex items-center gap-3">
          <Bell size={15} />
          <Star size={15} />
        </div>
      </div>
      <div className="rounded-[1.75rem] rounded-b-none bg-base-100 px-4 pb-5 pt-1">
        {children}
      </div>
    </div>
  );
}