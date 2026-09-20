import type { ReelRevealPayoutRow, ReelRevealPayoutStyle, ReelRevealSymbolId } from "./reelRevealTypes";

const PAYOUT_PATTERNS: Array<{ label: string; symbols: ReelRevealSymbolId[]; style: ReelRevealPayoutStyle }> = [
  { label: "Triple Clovers", symbols: ["clover", "clover", "clover"], style: "sky" },
  { label: "Triple Cherries", symbols: ["cherries", "cherries", "cherries"], style: "violet" },
  { label: "Triple Bells", symbols: ["bell", "bell", "bell"], style: "gold" },
  { label: "Triple Grapes", symbols: ["grapes", "grapes", "grapes"], style: "ruby" },
  { label: "Triple Sevens", symbols: ["seven", "seven", "seven"], style: "jackpot" },
];

export function buildReelRevealPayoutRows(prizeAmounts: readonly number[]) {
  const positivePrizes = [...new Set(prizeAmounts.filter((amount) => amount > 0))].sort((left, right) => left - right);

  if (!positivePrizes.length) {
    return [] as ReelRevealPayoutRow[];
  }

  return positivePrizes.map((rewardAmount, index) => {
    const patternIndex = Math.min(index, PAYOUT_PATTERNS.length - 1);
    const pattern = PAYOUT_PATTERNS[patternIndex];
    return {
      id: `payout-${patternIndex + 1}-${rewardAmount}`,
      label: pattern.label,
      symbols: pattern.symbols,
      rewardAmount,
      style: pattern.style,
    } satisfies ReelRevealPayoutRow;
  });
}
