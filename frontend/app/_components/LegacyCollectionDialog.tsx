"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatLifetimePoints,
  formatLifetimePointsRemaining,
  getLifetimeStatusProgress,
  getLifetimeStatusRoadmap,
  type LifetimeStatusRoadmapEntry,
} from "@/lib/lifetime-status";
import { LegacyCollectionTrophy } from "@/app/_components/LegacyCollectionTrophy";
import { LifetimeStatusProgressBar } from "@/app/_components/LifetimeStatusProgressBar";

type LegacyCollectionDialogProps = {
  lifetimePointsEarned: number | null;
  open: boolean;
  onClose: () => void;
};

function getRoadmapAriaLabel(entry: LifetimeStatusRoadmapEntry) {
  if (entry.state === "current") {
    return `${entry.tier.name}. Current Legacy at ${formatLifetimePoints(entry.tier.minPoints)} lifetime points.`;
  }

  if (entry.state === "completed") {
    return `${entry.tier.name}. Unlocked at ${formatLifetimePoints(entry.tier.minPoints)} lifetime points.`;
  }

  if (entry.state === "next") {
    return `${entry.tier.name}. Next Legacy at ${formatLifetimePoints(entry.tier.minPoints)} lifetime points. ${formatLifetimePointsRemaining(entry.pointsRemaining)}.`;
  }

  return `${entry.tier.name}. Locked until ${formatLifetimePoints(entry.tier.minPoints)} lifetime points.`;
}

export function LegacyCollectionDialog({
  lifetimePointsEarned,
  open,
  onClose,
}: LegacyCollectionDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isLoading = lifetimePointsEarned === null;
  const progress = useMemo(
    () => (isLoading ? null : getLifetimeStatusProgress(lifetimePointsEarned)),
    [isLoading, lifetimePointsEarned],
  );
  const roadmap = useMemo(
    () => (isLoading ? [] : getLifetimeStatusRoadmap(lifetimePointsEarned)),
    [isLoading, lifetimePointsEarned],
  );
  const [selectedTierKey, setSelectedTierKey] = useState<string | null>(null);
  const handleClose = useCallback(() => {
    setSelectedTierKey(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const selectedEntry =
    roadmap.find((entry) => entry.tier.key === selectedTierKey) ??
    roadmap.find((entry) => entry.state === "current") ??
    roadmap[0] ??
    null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/56 px-4 py-6">
      <div className="absolute inset-0" aria-hidden="true" onClick={handleClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="legacy-collection-title"
        className="relative z-[1] flex max-h-[min(92vh,980px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-[30px] border border-[color:var(--panel-border)] bg-[linear-gradient(180deg,var(--panel-strong),var(--panel))] shadow-[0_36px_90px_rgba(2,6,23,0.34)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--panel-border)] px-6 py-5 sm:px-8">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">
              Collection Gallery
            </div>
            <h2
              id="legacy-collection-title"
              className="mt-2 text-2xl font-semibold text-[color:var(--foreground-strong)]"
            >
              Legacy Collection
            </h2>
            <p className="mt-2 max-w-[52ch] text-sm leading-6 text-[color:var(--foreground-muted)]">
              Track your permanent Scratch &amp; Save milestones, preview the next collectible
              legacy, and see how each tier builds toward the full trophy gallery.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] text-xl text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-border-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel)]"
            aria-label="Close Legacy Collection"
          >
            &times;
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-8">
          {isLoading || !progress ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-6">
                <div className="h-5 w-40 animate-pulse rounded-full bg-[color:var(--panel-border)]/80" />
                <div className="mt-5 h-[220px] animate-pulse rounded-[28px] bg-[color:var(--background-muted)]" />
                <div className="mt-5 h-8 w-48 animate-pulse rounded-full bg-[color:var(--panel-border)]/70" />
                <div className="mt-3 h-5 w-56 animate-pulse rounded-full bg-[color:var(--panel-border)]/60" />
                <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-[color:var(--panel-border)]/60" />
              </div>
              <div className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-6">
                <div className="h-5 w-32 animate-pulse rounded-full bg-[color:var(--panel-border)]/80" />
                <div className="mt-4 grid gap-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-[20px] bg-[color:var(--background-muted)]"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
              <div className="space-y-6">
                <div className="rounded-[30px] border border-[color:var(--panel-border)] bg-[radial-gradient(circle_at_50%_18%,rgba(86,230,213,0.12),rgba(139,92,246,0.08),rgba(255,255,255,0)_54%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-6 sm:p-8">
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-[color:var(--foreground-faint)]">
                    Current Legacy
                  </div>
                  <div className="mt-6 flex flex-col items-center text-center">
                    <LegacyCollectionTrophy tier={progress.currentTier} state="current" size="hero" />
                    <div className="mt-6 text-3xl font-semibold text-[color:var(--foreground-strong)]">
                      {progress.currentTier.name}
                    </div>
                    <div className="mt-2 text-base text-[color:var(--foreground-muted)]">
                      {progress.currentTier.description}
                    </div>
                    <div className="mt-4 text-lg font-semibold text-[color:var(--foreground-strong)]">
                      {formatLifetimePoints(progress.totalPoints)} Lifetime Points
                    </div>
                    <LifetimeStatusProgressBar
                      progress={progress.progress}
                      label={`${progress.currentTier.name} status. ${Math.round(progress.progress * 100)} percent progress toward ${progress.nextTier?.name ?? "the highest tier"}. ${progress.nextTier ? formatLifetimePointsRemaining(progress.pointsRemaining) : "Highest Legacy Reached."}`}
                      className="mt-6 w-full max-w-[420px]"
                    />
                    {progress.nextTier ? (
                      <div className="mt-4 space-y-1 text-sm text-[color:var(--foreground-muted)]">
                        <div className="font-medium text-[color:var(--foreground-strong)]">
                          {progress.pointsRemaining === 0
                            ? `Ready to unlock ${progress.nextTier.name}`
                            : `${formatLifetimePoints(progress.pointsRemaining)} to ${progress.nextTier.name}`}
                        </div>
                        <div>
                          {progress.currentTier.name} &middot;{" "}
                          {formatLifetimePoints(progress.currentTier.minPoints)} to{" "}
                          {formatLifetimePoints(progress.nextTier.minPoints)}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-2 text-sm font-medium text-[color:var(--foreground-strong)]">
                        Highest Legacy Reached
                      </div>
                    )}
                  </div>
                </div>

                {progress.nextTier ? (
                  <div className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-6">
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">
                      Next Legacy
                    </div>
                    <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                      <LegacyCollectionTrophy tier={progress.nextTier} state="next" size="tile" />
                      <div className="min-w-0">
                        <div className="text-xl font-semibold text-[color:var(--foreground-strong)]">
                          {progress.nextTier.name}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-[color:var(--foreground-muted)]">
                          {progress.nextTier.description}
                        </div>
                        <div className="mt-3 text-sm font-medium text-[color:var(--foreground-strong)]">
                          Unlocks at {formatLifetimePoints(progress.nextTier.minPoints)} Lifetime Points
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--foreground-muted)]">
                          {formatLifetimePointsRemaining(progress.pointsRemaining)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-6">
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">
                    Collection Ladder
                  </div>
                  <div className="mt-4 grid gap-3">
                    {roadmap.map((entry) => {
                      const isSelected = selectedEntry?.tier.key === entry.tier.key;
                      const trophyState =
                        entry.state === "current"
                          ? "current"
                          : entry.state === "completed"
                            ? "earned"
                            : entry.state === "next"
                              ? "next"
                              : "locked";

                      return (
                        <button
                          key={entry.tier.key}
                          type="button"
                          onClick={() => setSelectedTierKey(entry.tier.key)}
                          aria-label={getRoadmapAriaLabel(entry)}
                          className={`flex items-center gap-4 rounded-[22px] border px-4 py-3 text-left transition ${
                            isSelected
                              ? "border-[color:var(--panel-border-strong)] bg-[linear-gradient(135deg,rgba(86,230,213,0.12),rgba(139,92,246,0.12))]"
                              : "border-[color:var(--panel-border)] bg-[color:var(--background-muted)] hover:bg-[color:var(--panel)]"
                          }`}
                        >
                          <LegacyCollectionTrophy tier={entry.tier} state={trophyState} size="tile" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-base font-semibold text-[color:var(--foreground-strong)]">
                                {entry.tier.name}
                              </span>
                              <span className="rounded-full border border-[color:var(--panel-border)] px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--foreground-faint)]">
                                {entry.state === "completed"
                                  ? "Unlocked"
                                  : entry.state === "current"
                                    ? "Current"
                                    : "Locked"}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-[color:var(--foreground-muted)]">
                              {formatLifetimePoints(entry.tier.minPoints)} Lifetime Points
                            </div>
                            {entry.state === "next" ? (
                              <div className="mt-1 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[color:var(--foreground-faint)]">
                                Next to unlock
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedEntry ? (
                  <div className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-6">
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">
                      Legacy Detail
                    </div>
                    <div className="mt-5 flex items-center gap-4">
                      <LegacyCollectionTrophy
                        tier={selectedEntry.tier}
                        state={
                          selectedEntry.state === "current"
                            ? "current"
                            : selectedEntry.state === "completed"
                              ? "earned"
                              : selectedEntry.state === "next"
                                ? "next"
                                : "locked"
                        }
                        size="tile"
                      />
                      <div className="min-w-0">
                        <div className="text-xl font-semibold text-[color:var(--foreground-strong)]">
                          {selectedEntry.tier.name}
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--foreground-muted)]">
                          {selectedEntry.tier.description}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 rounded-[22px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] p-4">
                      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground-faint)]">
                        Trophy Roadmap
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">
                        {selectedEntry.tier.designConcept ??
                          "Legacy artwork placeholder ready for final trophy direction."}
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-[color:var(--foreground-muted)]">
                      {selectedEntry.state === "current"
                        ? "This is your current permanent account legacy."
                        : selectedEntry.state === "completed"
                          ? "This legacy has already been earned and remains part of your collection."
                          : selectedEntry.state === "next"
                            ? `${formatLifetimePointsRemaining(selectedEntry.pointsRemaining)} until this legacy unlocks.`
                            : `Locked until ${formatLifetimePoints(selectedEntry.tier.minPoints)} Lifetime Points.`}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
