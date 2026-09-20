const QUALIFYING_LIFETIME_POINT_KINDS = [
  "daily",
  "scratcher_win",
  "triple_crown_derby_win",
  "the_big_score_win",
  "crossword_claim",
] as const;

export const LIFETIME_POINT_KINDS = new Set<string>(QUALIFYING_LIFETIME_POINT_KINDS);

type LedgerLikeEntry = {
  kind: string;
  delta: number;
};

type ResolveBackfilledLifetimePointsArgs = {
  existingLifetimePointsEarned: number;
  scratchCoin: number;
  ledgerEntries: LedgerLikeEntry[];
};

export function shouldCountTowardsLifetimePoints(kind: string, delta: number) {
  return delta > 0 && LIFETIME_POINT_KINDS.has(kind);
}

export function sumLifetimeQualifyingPoints(entries: LedgerLikeEntry[]) {
  return entries.reduce((total, entry) => {
    if (!shouldCountTowardsLifetimePoints(entry.kind, entry.delta)) {
      return total;
    }

    return total + entry.delta;
  }, 0);
}

export function resolveBackfilledLifetimePoints({
  existingLifetimePointsEarned,
  scratchCoin,
  ledgerEntries,
}: ResolveBackfilledLifetimePointsArgs) {
  const qualifyingFromLedger = Math.max(0, sumLifetimeQualifyingPoints(ledgerEntries));
  const fallbackFromBalance = qualifyingFromLedger === 0 ? Math.max(0, scratchCoin) : 0;

  return Math.max(0, existingLifetimePointsEarned, qualifyingFromLedger, fallbackFromBalance);
}
