"use client";

import { useEffect, useRef, useState } from "react";

type BalancePillProps = {
  balance: number;
  compact?: boolean;
  inlineLabel?: boolean;
  embedded?: boolean;
  className?: string;
};

type BalanceDeltaState = {
  amount: number;
  visible: boolean;
  id: number;
} | null;

export function BalancePill({ balance, compact = false, inlineLabel = true, embedded = false, className = "" }: BalancePillProps) {
  const [displayBalance, setDisplayBalance] = useState(balance);
  const displayBalanceRef = useRef(balance);
  const previousBalanceRef = useRef(balance);
  const animationFrameRef = useRef<number | null>(null);
  const deltaTimeoutRef = useRef<number | null>(null);
  const cleanupTimeoutRef = useRef<number | null>(null);
  const [delta, setDelta] = useState<BalanceDeltaState>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (deltaTimeoutRef.current !== null) {
        window.clearTimeout(deltaTimeoutRef.current);
      }
      if (cleanupTimeoutRef.current !== null) {
        window.clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (balance === previousBalanceRef.current && balance === displayBalanceRef.current) {
      return;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    const startValue = displayBalanceRef.current;
    const targetValue = balance;
    const deltaAmount = targetValue - previousBalanceRef.current;
    const start = performance.now();
    const duration = 620;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + (targetValue - startValue) * eased);
      displayBalanceRef.current = nextValue;
      setDisplayBalance(nextValue);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        displayBalanceRef.current = targetValue;
        setDisplayBalance(targetValue);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(step);

    if (deltaAmount !== 0) {
      if (deltaTimeoutRef.current !== null) {
        window.clearTimeout(deltaTimeoutRef.current);
      }
      if (cleanupTimeoutRef.current !== null) {
        window.clearTimeout(cleanupTimeoutRef.current);
      }

      const nextId = Date.now();
      setDelta({ amount: deltaAmount, visible: false, id: nextId });
      deltaTimeoutRef.current = window.setTimeout(() => {
        setDelta((current) => (current && current.id === nextId ? { ...current, visible: true } : current));
      }, 16);
      cleanupTimeoutRef.current = window.setTimeout(() => {
        setDelta((current) => (current && current.id === nextId ? null : current));
      }, 760);
    }

    previousBalanceRef.current = balance;
  }, [balance]);

  return (
    <div
      aria-label={`${displayBalance.toLocaleString()} Scratch & Save Points`}
      className={`relative inline-flex min-w-0 items-center overflow-visible ${
        embedded
          ? "bg-transparent px-0 py-0 shadow-none backdrop-blur-0"
          : "rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,31,0.88),rgba(8,15,27,0.76))] px-2.5 py-2 shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl"
      } ${embedded ? "" : compact ? "min-h-[46px]" : "min-h-[54px] px-3 py-2.5"} ${className}`.trim()}
    >
      {embedded ? null : <span className="pointer-events-none absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_38%,rgba(255,255,255,0))]" />}
      {embedded ? null : <span className="pointer-events-none absolute inset-y-[20%] left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(255,214,111,0.42),transparent)]" />}
      {delta ? (
        <span
          className={`pointer-events-none absolute right-3 top-0 rounded-full border border-[#ffd77a]/18 bg-[rgba(22,16,8,0.88)] px-2.5 py-1 text-[0.68rem] font-black tracking-[0.12em] text-[#ffe29b] shadow-[0_10px_22px_rgba(0,0,0,0.22)] transition-all duration-700 ${
            delta.visible ? "-translate-y-7 opacity-100" : "-translate-y-3 opacity-0"
          }`}
        >
          {delta.amount > 0 ? `+${delta.amount.toLocaleString()}` : delta.amount.toLocaleString()}
        </span>
      ) : null}

      <span className={`balance-pill relative flex min-w-0 flex-col ${compact ? "gap-0.5" : "gap-1"}`}>
        <span className={`balance-pill-value font-semibold leading-none text-white ${compact ? "text-[0.97rem]" : "text-[1.12rem]"}`}>
          {displayBalance.toLocaleString()}
        </span>
        {inlineLabel ? (
          <span className={`balance-pill-label font-semibold uppercase tracking-[0.24em] text-white/58 ${compact ? "text-[0.53rem]" : "text-[0.6rem]"}`}>
            Points
          </span>
        ) : (
          <span className={`balance-pill-label font-medium text-white/65 ${compact ? "text-[0.68rem]" : "text-[0.78rem]"}`}>Points</span>
        )}
      </span>
    </div>
  );
}

function AudioOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[1.1rem] w-[1.1rem]">
      <path d="M5 14.5v-5h3.5L13 6v12l-4.5-3.5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 9.5a4.5 4.5 0 0 1 0 5" strokeLinecap="round" />
      <path d="M18.75 7a8 8 0 0 1 0 10" strokeLinecap="round" />
    </svg>
  );
}

function AudioOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[1.1rem] w-[1.1rem]">
      <path d="M5 14.5v-5h3.5L13 6v12l-4.5-3.5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m16.25 9.75 4.5 4.5" strokeLinecap="round" />
      <path d="m20.75 9.75-4.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

type GlobalAudioToggleProps = {
  isMuted: boolean;
  onToggle: () => void;
  embedded?: boolean;
  className?: string;
};

export function GlobalAudioToggle({ isMuted, onToggle, embedded = false, className = "" }: GlobalAudioToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isMuted}
      aria-label={isMuted ? "Unmute audio" : "Mute audio"}
      className={`global-audio-toggle group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-white transition duration-300 hover:text-[#ffe7a9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd77a]/60 ${
        embedded
          ? "border border-white/0 bg-transparent shadow-none backdrop-blur-0 hover:border-[#ffd77a]/14"
          : "border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,31,0.88),rgba(8,15,27,0.76))] shadow-[0_14px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl hover:border-[#ffd77a]/28"
      } ${className}`.trim()}
    >
      {embedded ? null : <span className="pointer-events-none absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_42%,rgba(255,255,255,0))]" />}
      <span className={`pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,212,104,0.18),transparent_48%)] transition duration-300 group-hover:opacity-100 ${embedded ? "opacity-55" : "opacity-80"}`} />
      <span className="relative inline-flex h-5 w-5 items-center justify-center">
        <span className={`absolute inset-0 transition-opacity duration-200 ${isMuted ? "opacity-0" : "opacity-100"}`}>
          <AudioOnIcon />
        </span>
        <span className={`absolute inset-0 transition-opacity duration-200 ${isMuted ? "opacity-100" : "opacity-0"}`}>
          <AudioOffIcon />
        </span>
      </span>
    </button>
  );
}

type GlobalBalanceAudioHudProps = {
  balance: number;
  isMuted?: boolean;
  onToggleAudio?: () => void;
  compact?: boolean;
  className?: string;
};

type AppTopBarProps = GlobalBalanceAudioHudProps;

export function GlobalBalanceAudioHud({
  balance,
  isMuted,
  onToggleAudio,
  compact = false,
  className = "",
}: GlobalBalanceAudioHudProps) {
  const showAudioToggle = typeof isMuted === "boolean" && typeof onToggleAudio === "function";

  return (
    <div
      className={`app-hud relative inline-flex min-w-0 items-center gap-2 overflow-visible rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,31,0.88),rgba(8,15,27,0.76))] text-white shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl ${
        compact ? "min-h-[44px] px-2.5 py-1.5" : "min-h-[50px] px-3 py-2"
      } ${className}`.trim()}
    >
      <span className="pointer-events-none absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_42%,rgba(255,255,255,0))]" />
      <span className="pointer-events-none absolute inset-y-[18%] left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(255,214,111,0.42),transparent)]" />
      <div className="relative flex min-w-0 items-center">
        <BalancePill balance={balance} compact={compact} embedded inlineLabel className="min-w-0" />
      </div>
      {showAudioToggle ? (
        <>
          <span className="pointer-events-none h-7 w-px shrink-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.16),transparent)]" />
          <GlobalAudioToggle isMuted={isMuted} onToggle={onToggleAudio} embedded className={compact ? "h-9 w-9" : "h-10 w-10"} />
        </>
      ) : null}
    </div>
  );
}

export function AppTopBar({
  balance,
  isMuted,
  onToggleAudio,
  compact = false,
  className = "",
}: AppTopBarProps) {
  const showAudioToggle = typeof isMuted === "boolean" && typeof onToggleAudio === "function";

  return (
    <div
      className={`app-hud relative flex w-full min-w-0 items-center justify-between gap-3 overflow-visible rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,31,0.88),rgba(8,15,27,0.76))] text-white shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl ${
        compact ? "min-h-[44px] px-3 py-1.5" : "min-h-[48px] px-3.5 py-2"
      } ${className}`.trim()}
    >
      <span className="pointer-events-none absolute inset-[1px] rounded-[21px] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_42%,rgba(255,255,255,0))]" />
      <span className="pointer-events-none absolute inset-y-[16%] left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(255,214,111,0.42),transparent)]" />
      <div className="relative min-w-0 flex-1">
        <BalancePill balance={balance} compact={compact} embedded inlineLabel className="min-w-0" />
      </div>
      {showAudioToggle ? (
        <div className="relative flex shrink-0 items-center gap-3">
          <span className="pointer-events-none h-7 w-px shrink-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.16),transparent)]" />
          <GlobalAudioToggle
            isMuted={isMuted}
            onToggle={onToggleAudio}
            embedded
            className={compact ? "h-9 w-9" : "h-10 w-10"}
          />
        </div>
      ) : null}
    </div>
  );
}
