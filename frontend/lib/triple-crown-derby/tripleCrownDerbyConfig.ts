import type {
  TripleCrownDerbyHorse,
  TripleCrownDerbyHorseId,
  TripleCrownDerbyPrizeTier,
  TripleCrownDerbyPrizeTierId,
  TripleCrownDerbyTicketData,
} from "./tripleCrownDerbyTypes";

const HORSES: TripleCrownDerbyHorse[] = [
  {
    id: "midnight_thunder",
    number: 1,
    name: "Midnight Thunder",
    nickname: "The Favorite",
    rating: 92,
    imageSrc: "/triple-crown-derby/horses/midnight_thunder.png",
    accent: "from-sky-500 via-blue-500 to-slate-800",
    glow: "rgba(90,163,255,0.38)",
  },
  {
    id: "blazing_comet",
    number: 2,
    name: "Blazing Comet",
    nickname: "Speed Burst",
    rating: 88,
    imageSrc: "/triple-crown-derby/horses/blazing_comet.png",
    accent: "from-orange-500 via-red-500 to-amber-300",
    glow: "rgba(255,126,58,0.38)",
  },
  {
    id: "silver_phantom",
    number: 3,
    name: "Silver Phantom",
    nickname: "Cool Closer",
    rating: 84,
    imageSrc: "/triple-crown-derby/horses/silver_phantom.png",
    accent: "from-slate-300 via-zinc-200 to-neutral-500",
    glow: "rgba(226,233,242,0.4)",
  },
  {
    id: "golden_stride",
    number: 4,
    name: "Golden Stride",
    nickname: "Royal Pace",
    rating: 90,
    imageSrc: "/triple-crown-derby/horses/golden_stride.png",
    accent: "from-yellow-300 via-amber-400 to-stone-900",
    glow: "rgba(255,208,92,0.36)",
  },
  {
    id: "iron_valor",
    number: 5,
    name: "Iron Valor",
    nickname: "Underdog Steel",
    rating: 74,
    imageSrc: "/triple-crown-derby/horses/iron_valor.png",
    accent: "from-emerald-600 via-lime-500 to-stone-800",
    glow: "rgba(142,212,126,0.34)",
  },
  {
    id: "crimson_dash",
    number: 6,
    name: "Crimson Dash",
    nickname: "Wild Card",
    rating: 82,
    imageSrc: "/triple-crown-derby/horses/crimson_dash.png",
    accent: "from-rose-600 via-red-500 to-stone-900",
    glow: "rgba(255,98,116,0.36)",
  },
];

const PRIZE_TIER_DEFINITIONS: Array<
  Omit<TripleCrownDerbyPrizeTier, "rewardAmount"> & { id: TripleCrownDerbyPrizeTierId }
> = [
  {
    id: "show_pick",
    label: "Show Pick",
    shortLabel: "Show",
    description: "Your Show horse made the podium.",
    treatment: "bronze",
  },
  {
    id: "place_pick",
    label: "Place Pick",
    shortLabel: "Place",
    description: "Your Place horse finished first or second.",
    treatment: "silver",
  },
  {
    id: "win_pick",
    label: "Win Pick",
    shortLabel: "Win",
    description: "Your Win horse crossed first.",
    treatment: "gold",
  },
  {
    id: "across_the_board",
    label: "Across the Board",
    shortLabel: "Across",
    description: "All three picks hit the board.",
    treatment: "violet",
  },
  {
    id: "box_bet_bonus",
    label: "Box Bet Bonus",
    shortLabel: "Box",
    description: "Your trio swept the podium with the Win horse on top.",
    treatment: "gold",
  },
  {
    id: "exacta_win",
    label: "Exacta Win",
    shortLabel: "Exacta",
    description: "Your Win and Place picks nailed the 1-2 finish.",
    treatment: "violet",
  },
  {
    id: "trifecta_jackpot",
    label: "Trifecta Jackpot",
    shortLabel: "Trifecta",
    description: "Exact ordered 1-2-3 sweep.",
    treatment: "jackpot",
  },
];

export const TRIPLE_CROWN_DERBY_LOGO_SRC = "/triple-crown-derby/logo.png";
export const TRIPLE_CROWN_DERBY_SCRATCH_THRESHOLD = 0.5;
export const TRIPLE_CROWN_DERBY_HORSES = HORSES;
export const TRIPLE_CROWN_DERBY_PRIZE_TIERS = PRIZE_TIER_DEFINITIONS;
export const TRIPLE_CROWN_DERBY_PICK_SLOTS = ["win", "place", "show"] as const;

const PRIZE_TIER_MULTIPLIER: Record<TripleCrownDerbyPrizeTierId, number> = {
  show_pick: 1,
  place_pick: 1,
  win_pick: 1,
  across_the_board: 3,
  box_bet_bonus: 3,
  exacta_win: 2,
  trifecta_jackpot: 3,
};

export function getTripleCrownDerbyHorse(horseId: TripleCrownDerbyHorseId) {
  const horse = HORSES.find((entry) => entry.id === horseId);
  if (!horse) {
    throw new Error(`Unknown Triple Crown Derby horse: ${horseId}`);
  }
  return horse;
}

function spreadPrizeAmounts(prizeAmounts: readonly number[]) {
  const positive = [...new Set(prizeAmounts.filter((amount) => amount > 0))].sort((left, right) => left - right);
  if (!positive.length) {
    return PRIZE_TIER_DEFINITIONS.map(() => 0);
  }

  return PRIZE_TIER_DEFINITIONS.map((_, index) => {
    const sourceIndex = Math.round((index * (positive.length - 1)) / (PRIZE_TIER_DEFINITIONS.length - 1));
    return positive[sourceIndex] ?? positive[positive.length - 1];
  });
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveTargetPrizeTierId(rewardAmount: number, payoutLadder: readonly TripleCrownDerbyPrizeTier[], seed: string) {
  if (rewardAmount <= 0) return null;

  const exactMatches = payoutLadder.filter((tier) => tier.rewardAmount === rewardAmount);
  if (exactMatches.length) {
    const index = hashSeed(seed) % exactMatches.length;
    return exactMatches[index]?.id ?? exactMatches[0].id;
  }

  let nearest = payoutLadder[0] ?? null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const tier of payoutLadder) {
    const distance = Math.abs(tier.rewardAmount - rewardAmount);
    if (distance < nearestDistance) {
      nearest = tier;
      nearestDistance = distance;
    }
  }
  return nearest?.id ?? null;
}

export type CreateTripleCrownDerbyTicketInput = {
  ticketId: TripleCrownDerbyTicketData["ticketId"];
  rewardAmount: number;
  prizeAmounts: readonly number[];
  sessionId: string;
  selectionSeed: string;
};

export function createTripleCrownDerbyTicket({
  ticketId,
  rewardAmount,
  prizeAmounts,
  sessionId,
  selectionSeed,
}: CreateTripleCrownDerbyTicketInput): TripleCrownDerbyTicketData {
  const distributedAmounts = spreadPrizeAmounts(prizeAmounts);
  const payoutLadder = PRIZE_TIER_DEFINITIONS.map((tier, index) => ({
    ...tier,
    rewardAmount: (distributedAmounts[index] ?? 0) * PRIZE_TIER_MULTIPLIER[tier.id],
  }));

  return {
    mode: "triple_crown_derby",
    version: 1,
    sessionId,
    seed: selectionSeed,
    ticketId,
    rewardAmount,
    horses: HORSES,
    payoutLadder,
    targetPrizeTierId: resolveTargetPrizeTierId(rewardAmount, payoutLadder, `${sessionId}:${selectionSeed}:${rewardAmount}`),
  };
}
