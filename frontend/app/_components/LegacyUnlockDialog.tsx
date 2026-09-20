"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  formatLifetimePoints,
  getLifetimeStatusIconAsset,
  type LifetimeStatusTier,
} from "@/lib/lifetime-status";

type LegacyUnlockDialogProps = {
  tier: LifetimeStatusTier | null;
  open: boolean;
  onContinue: () => void;
};

function getUnlockHeroObjectPosition(): string {
  return "50% 50%";
}

function getUnlockHeroArtTransform(tier: LifetimeStatusTier): string {
  switch (tier.key) {
    case "treasure_hunter":
      return "translate3d(2.5%, 0.5%, 0)";
    case "high_roller":
      return "translate3d(-1.5%, 1.25%, 0)";
    default:
      return "translate3d(0, 0, 0)";
  }
}

export function LegacyUnlockDialog({
  tier,
  open,
  onContinue,
}: LegacyUnlockDialogProps) {
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    if (!open || !tier) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleContinue();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, tier, handleContinue]);

  useEffect(() => {
    if (!open || !tier) {
      return;
    }

    continueButtonRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open, tier]);

  if (!open || !tier) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const isDebugMode =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("legacyUnlockDebug") === "1";
  const trophyObjectPosition = getUnlockHeroObjectPosition();
  const trophyArtTransform = getUnlockHeroArtTransform(tier);

  return createPortal(
    <div className="legacy-unlock-backdrop fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-[10px]">
      <div className="absolute inset-0" aria-hidden="true" onClick={handleContinue} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="legacy-unlock-title"
        aria-describedby="legacy-unlock-description"
        className="legacy-unlock-panel relative z-[1] flex max-h-[min(92vh,760px)] w-full max-w-[680px] flex-col overflow-hidden rounded-[34px] border border-[color:var(--panel-border)] bg-[linear-gradient(180deg,var(--panel-strong),var(--panel))] shadow-[0_36px_90px_rgba(2,6,23,0.38)]"
      >
        <div className="border-b border-[color:var(--panel-border)] px-6 py-5 sm:px-8">
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">
            New Legacy Unlocked
          </div>
          <h2
            id="legacy-unlock-title"
            className="mt-2 text-2xl font-semibold text-[color:var(--foreground-strong)] sm:text-[2rem]"
          >
            {tier.name}
          </h2>
        </div>

        <div className="px-6 py-4 sm:px-8 sm:py-5">
          <div className="flex flex-col items-center text-center">
            <div className="legacy-unlock-trophy-stage relative flex items-center justify-center">
              <div className="absolute inset-[15%] rounded-full bg-[radial-gradient(circle,rgba(255,215,126,0.14),rgba(126,223,255,0.06)_42%,transparent_72%)]" />
              <div className="legacy-unlock-trophy-frame relative flex h-[300px] w-[300px] items-center justify-center overflow-visible rounded-[38px] border border-[rgba(168,196,228,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(12,20,36,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_18px_40px_rgba(2,6,23,0.16)] sm:h-[336px] sm:w-[336px]">
                <div className="absolute inset-[7.5%] rounded-[31px] bg-[radial-gradient(circle_at_50%_42%,rgba(255,239,194,0.12),rgba(130,212,255,0.05)_30%,rgba(12,18,34,0.14)_58%,rgba(8,14,28,0.04)_76%,transparent_100%)]" />
                <div className="absolute inset-[3.5%] rounded-[34px] border border-white/4" />
                {isDebugMode ? (
                  <>
                    <div className="pointer-events-none absolute inset-[3.5%] rounded-[34px] border border-emerald-400/60" />
                    <div className="pointer-events-none absolute inset-[12%] rounded-[28px] border border-yellow-300/60" />
                    <div className="pointer-events-none absolute inset-y-[10%] left-1/2 w-px -translate-x-1/2 bg-cyan-300/70" />
                    <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-px -translate-y-1/2 bg-cyan-300/70" />
                    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-200">
                      {tier.key} | {trophyObjectPosition} | {trophyArtTransform}
                    </div>
                  </>
                ) : null}
                <div
                  className={`absolute inset-[12%] z-[2] flex items-center justify-center ${
                    isDebugMode ? "border border-fuchsia-400/60" : ""
                  }`}
                >
                  {/* TODO(2026-08-30): These shared status-icon PNGs are usable for the unlock modal,
                      but they are not ideal hero assets. Replace them in a future pass with
                      unlock-specific transparent trophy renders that have cleaner composition and
                      consistent padding. Until those replacement assets exist, keep this modal's
                      trophy presentation stable and avoid over-tuning CSS around the current files. */}
                  <Image
                    src={getLifetimeStatusIconAsset(tier)}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(min-width: 640px) 240px, 220px"
                    className="object-contain opacity-100 mix-blend-normal"
                    style={{
                      objectPosition: trophyObjectPosition,
                      transform: trophyArtTransform,
                    }}
                  />
                </div>
              </div>
            </div>
            <p
              id="legacy-unlock-description"
              className="mt-1 max-w-[28ch] text-base leading-7 text-[color:var(--foreground-muted)]"
            >
              {tier.description}
            </p>
            <div className="mt-2.5 rounded-full border border-[color:var(--panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-5 py-2 text-sm font-medium text-[color:var(--foreground-strong)] shadow-[0_14px_28px_rgba(2,6,23,0.2)]">
              Unlocked at {formatLifetimePoints(tier.minPoints)} Lifetime Points
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--panel-border)] px-6 py-5 sm:px-8">
          <button
            ref={continueButtonRef}
            type="button"
            onClick={handleContinue}
            className="legacy-unlock-button inline-flex w-full items-center justify-center rounded-[20px] border border-[color:var(--panel-border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] px-4 py-3 text-sm font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-border-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel)]"
          >
            Continue
          </button>
        </div>
      </section>
      <style jsx global>{`
        .legacy-unlock-backdrop {
          animation: legacyUnlockBackdropIn 220ms ease-out both;
        }
        .legacy-unlock-panel {
          animation: legacyUnlockPanelIn 380ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
          transform-origin: 50% 52%;
        }
        .legacy-unlock-trophy-stage {
          animation: legacyUnlockTrophyIn 560ms cubic-bezier(0.2, 0.9, 0.24, 1.02) 220ms both;
          transform-origin: 50% 54%;
          margin-bottom: 0.1rem;
        }
        .legacy-unlock-trophy-frame {
          animation: legacyUnlockFrameIn 480ms cubic-bezier(0.16, 1, 0.3, 1) 180ms both;
        }
        .legacy-unlock-button {
          animation: legacyUnlockButtonIn 260ms ease-out 180ms both;
        }
        @keyframes legacyUnlockBackdropIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes legacyUnlockPanelIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes legacyUnlockTrophyIn {
          0% {
            opacity: 0;
            transform: scale(0.88);
          }
          72% {
            opacity: 1;
            transform: scale(1.035);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes legacyUnlockFrameIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes legacyUnlockButtonIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .legacy-unlock-backdrop,
          .legacy-unlock-panel,
          .legacy-unlock-trophy-stage,
          .legacy-unlock-trophy-frame,
          .legacy-unlock-button {
            animation: legacyUnlockReducedFade 160ms ease-out both !important;
            transform: none !important;
            filter: none !important;
          }
        }
        @keyframes legacyUnlockReducedFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
