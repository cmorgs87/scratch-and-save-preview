import {
  formatLifetimePoints,
  getLifetimeStatusProgress,
} from "@/lib/lifetime-status";
import { LegacyCollectionTrophy } from "@/app/_components/LegacyCollectionTrophy";
import { LifetimeStatusProgressBar } from "@/app/_components/LifetimeStatusProgressBar";

type LifetimeStatusSummaryProps = {
  lifetimePointsEarned: number | null;
  className?: string;
  onOpenCollection?: () => void;
};

export function LifetimeStatusSummary({
  lifetimePointsEarned,
  className = "",
  onOpenCollection,
}: LifetimeStatusSummaryProps) {
  const isLoading = lifetimePointsEarned === null;
  const progress = isLoading ? null : getLifetimeStatusProgress(lifetimePointsEarned);
  const remainingCopy =
    progress && progress.nextTier
      ? `${formatLifetimePoints(progress.pointsRemaining)} ${progress.pointsRemaining === 1 ? "point" : "points"} to ${progress.nextTier.name}`
      : "Highest Legacy Reached";
  const progressSummary =
    progress && progress.nextTier
      ? `${progress.currentTier.name} status. ${formatLifetimePoints(progress.totalPoints)} Lifetime Points. ${remainingCopy}.`
      : progress
        ? `${progress.currentTier.name} status. ${formatLifetimePoints(progress.totalPoints)} Lifetime Points. Highest Legacy Reached.`
        : undefined;

  return (
    <section
      className={className}
      aria-live="polite"
      aria-busy={isLoading}
      aria-label={progressSummary}
    >
      {isLoading || !progress ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-[56px] w-[56px] animate-pulse rounded-[20px] bg-[color:var(--panel-border)]/70" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-5 w-28 animate-pulse rounded-full bg-[color:var(--panel-border)]/80" />
              <div className="h-4 w-36 animate-pulse rounded-full bg-[color:var(--panel-border)]/70" />
            </div>
          </div>
          <div className="h-2 w-full animate-pulse rounded-full bg-[color:var(--panel-border)]/70" />
          <div className="h-4 w-full max-w-[15rem] animate-pulse rounded-full bg-[color:var(--panel-border)]/60" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            {onOpenCollection ? (
              <button
                type="button"
                onClick={onOpenCollection}
                aria-label="View Legacy Collection"
                title="View Legacy Collection"
                className="group -m-1 inline-flex rounded-[24px] p-1 transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-border-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background-muted)]"
              >
                <div className="rounded-[22px] transition group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_22px_rgba(86,230,213,0.14)]">
                  <LegacyCollectionTrophy tier={progress.currentTier} state="current" size="summary" />
                </div>
              </button>
            ) : (
              <LegacyCollectionTrophy tier={progress.currentTier} state="current" size="summary" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.98rem] font-semibold uppercase tracking-[0.02em] leading-tight text-[color:var(--foreground-strong)]">
                {progress.currentTier.name}
              </div>
              <div className="mt-0.5 text-[0.96rem] leading-[1.3] text-[color:var(--foreground-muted)]">
                {formatLifetimePoints(progress.totalPoints)} Lifetime Points
              </div>
            </div>
          </div>

          <LifetimeStatusProgressBar
            progress={progress.progress}
            label={`${progress.currentTier.name} progress. ${Math.round(progress.progress * 100)} percent complete toward ${progress.nextTier?.name ?? "the highest tier"}.`}
            className="mt-2"
          />

          <div className="mt-2 min-w-0 text-left text-[0.9rem] leading-[1.36] text-[color:var(--foreground-muted)]">
            {progress.nextTier ? (
              <span className="block max-w-full whitespace-normal break-words text-balance">
                {formatLifetimePoints(progress.pointsRemaining)} {progress.pointsRemaining === 1 ? "point" : "points"} to{" "}
                <span className="font-medium text-[color:var(--foreground-strong)]">{progress.nextTier.name}</span>
              </span>
            ) : (
              <span className="block font-medium text-[color:var(--foreground-strong)]">{remainingCopy}</span>
            )}
          </div>

          {onOpenCollection ? (
            <button
              type="button"
              onClick={onOpenCollection}
              className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-border-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background-muted)]"
            >
              View Collection
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
