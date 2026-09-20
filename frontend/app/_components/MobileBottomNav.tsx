"use client";

import { ReactNode } from "react";

export type MobileBottomNavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
};

export function MobileBottomNav({ items }: { items: MobileBottomNavItem[] }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--panel-border)] bg-[color:var(--panel)]/94 px-4 py-1 shadow-[0_-8px_20px_rgba(15,23,42,0.07)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(0.32rem, env(safe-area-inset-bottom))" }}
      aria-label="Mobile navigation"
    >
      <div className="mx-auto grid w-full max-w-[430px] grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-1 rounded-[18px] border border-[color:var(--panel-border)] bg-[color:var(--panel-strong)] p-1">
        {items.map((item) => (
          <button
            key={item.id}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[14px] px-2 py-0.5 text-[0.66rem] transition ${
              item.active
                ? "bg-[linear-gradient(135deg,rgba(34,230,193,0.14),rgba(115,240,223,0.08))] font-semibold text-[color:var(--teal)] shadow-[0_8px_18px_rgba(34,230,193,0.12)]"
                : "font-medium text-[color:var(--foreground-muted)] hover:bg-[color:var(--panel-soft)]"
            }`}
            onClick={item.onClick}
            type="button"
            aria-current={item.active ? "page" : undefined}
          >
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[color:currentColor]" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function HomeNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}

export function TicketsNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <path d="M9 9h6M9 12h6M9 15h4" />
    </svg>
  );
}

export function RewardsNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 21s-6.5-4.2-8.7-7.7C1.1 9.9 3 6 6.8 6c2 0 3.2 1.1 4 2.2.8-1.1 2-2.2 4-2.2 3.8 0 5.7 3.9 3.5 7.3C18.5 16.8 12 21 12 21Z" />
    </svg>
  );
}
