"use client";

import { ReactNode } from "react";
import { GlobalBalanceAudioHud } from "@/app/_components/AppChromeControls";
import { MobileBottomNav, type MobileBottomNavItem } from "@/app/_components/MobileBottomNav";

type MobileAppShellProps = {
  header?: ReactNode;
  children: ReactNode;
  navItems?: MobileBottomNavItem[];
  contentClassName?: string;
};

type MobilePageHeaderProps = {
  title: ReactNode;
  balance: number;
  isMuted?: boolean;
  onToggleAudio?: () => void;
  onBack?: () => void;
  leading?: ReactNode;
  sticky?: boolean;
};

export function MobileAppShell({ header, children, navItems, contentClassName = "" }: MobileAppShellProps) {
  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden bg-[color:var(--background)] lg:hidden"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className={`mx-auto w-full max-w-[430px] px-4 ${contentClassName}`.trim()}>
        {header ? <div className="mb-4">{header}</div> : null}
        {children}
      </div>
      {navItems ? <MobileBottomNav items={navItems} /> : null}
    </main>
  );
}

export function MobilePageHeader({ title, balance, isMuted, onToggleAudio, onBack, leading, sticky = false }: MobilePageHeaderProps) {
  const leftSlot = leading ?? (
    onBack ? (
      <button
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] text-lg font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel)]"
        onClick={onBack}
        type="button"
        aria-label="Go back"
      >
        <span aria-hidden="true">&larr;</span>
      </button>
    ) : (
      <div className="h-11 w-11" aria-hidden="true" />
    )
  );

  return (
    <header
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[24px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.06)] ${
        sticky ? "sticky top-0 z-20" : ""
      }`}
    >
      {leftSlot}
      <div className="min-w-0 text-center">
        <div className="truncate text-xl font-semibold text-[color:var(--foreground-strong)]">{title}</div>
      </div>
      <div className="justify-self-end">
        <GlobalBalanceAudioHud balance={balance} isMuted={isMuted} onToggleAudio={onToggleAudio} compact />
      </div>
    </header>
  );
}

export function MobileSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[24px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}
