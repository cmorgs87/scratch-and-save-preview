export type TicketId = "bronze" | "silver" | "gold";

export type WeightedPayout = {
  amount: number;
  weight: number;
};

export type TicketEconomyConfig = {
  cost: number;
  payouts: WeightedPayout[];
};

export type TicketEconomyByTier = Record<TicketId, TicketEconomyConfig>;

export type CrosswordClaimSnapshot = {
  id: string;
  ticketId: string;
  cost: number;
  rewardAmount: number;
  claimedAt: Date | null;
};

export type CrosswordClaimResolution = {
  alreadyClaimed: boolean;
  claimDelta: number;
};

export function parseTicketEconomyConfig(raw: string): TicketEconomyByTier {
  const parsed = JSON.parse(raw) as Partial<Record<TicketId, Partial<TicketEconomyConfig>>>;

  return {
    bronze: normalizeTicketEconomyConfig(parsed.bronze),
    silver: normalizeTicketEconomyConfig(parsed.silver),
    gold: normalizeTicketEconomyConfig(parsed.gold),
  };
}

function normalizeTicketEconomyConfig(entry?: Partial<TicketEconomyConfig>): TicketEconomyConfig {
  const payouts = Array.isArray(entry?.payouts)
    ? entry!.payouts
        .map((payout) => ({
          amount: Number(payout?.amount ?? 0),
          weight: Number(payout?.weight ?? 0),
        }))
        .filter((payout) => Number.isFinite(payout.amount) && Number.isFinite(payout.weight) && payout.weight >= 0)
    : [];

  return {
    cost: Number(entry?.cost ?? 0),
    payouts,
  };
}

export function pickWeightedPayout(payouts: readonly WeightedPayout[], randomValue = Math.random()): number {
  const totalWeight = payouts.reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0);
  let roll = Math.max(0, randomValue) * (totalWeight || 1);
  let selectedAmount = 0;

  for (const entry of payouts) {
    roll -= Number(entry.weight) || 0;
    selectedAmount = Number(entry.amount) || 0;
    if (roll <= 0) return selectedAmount;
  }

  return selectedAmount;
}

export function resolveCrosswordClaim(snapshot: CrosswordClaimSnapshot): CrosswordClaimResolution {
  if (snapshot.claimedAt) {
    return {
      alreadyClaimed: true,
      claimDelta: 0,
    };
  }

  return {
    alreadyClaimed: false,
    claimDelta: Math.max(0, snapshot.rewardAmount),
  };
}
