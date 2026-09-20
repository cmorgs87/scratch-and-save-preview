import {
  THE_BIG_SCORE_ENTRANCES,
  THE_BIG_SCORE_GETAWAYS,
  THE_BIG_SCORE_SCRATCH_THRESHOLD,
} from "./theBigScoreConfig";
import type {
  TheBigScoreEntranceId,
  TheBigScoreGameState,
  TheBigScoreGetawayId,
  TheBigScorePrizeTier,
  TheBigScorePrizeTierId,
  TheBigScoreTicketData,
  TheBigScoreTicketTier,
  TheBigScoreVaultCode,
  TheBigScoreVaultOffer,
} from "./theBigScoreTypes";

const THE_BIG_SCORE_PRIZE_TIERS: Array<
  Omit<TheBigScorePrizeTier, "rewardAmount"> & { id: TheBigScorePrizeTierId }
> = [
  {
    id: "show_pick",
    label: "Show Crack",
    shortLabel: "Show",
    description: "Third tumbler cracked.",
    treatment: "bronze",
  },
  {
    id: "place_pick",
    label: "Place Crack",
    shortLabel: "Place",
    description: "Second tumbler cracked.",
    treatment: "silver",
  },
  {
    id: "win_pick",
    label: "Win Crack",
    shortLabel: "Win",
    description: "First tumbler cracked.",
    treatment: "gold",
  },
  {
    id: "across_the_board",
    label: "Across the Board",
    shortLabel: "Across",
    description: "All three called numbers hit the vault.",
    treatment: "violet",
  },
  {
    id: "box_bet_bonus",
    label: "Box Bet Bonus",
    shortLabel: "Box",
    description: "All three numbers hit and your first tumbler led the crack.",
    treatment: "gold",
  },
  {
    id: "exacta_win",
    label: "Clean Opening Sequence",
    shortLabel: "Exacta",
    description: "First two tumblers matched.",
    treatment: "violet",
  },
  {
    id: "trifecta_jackpot",
    label: "Perfect Crack",
    shortLabel: "Trifecta",
    description: "Vault combination matched exactly.",
    treatment: "jackpot",
  },
];

const PRIZE_TIER_MULTIPLIER: Record<TheBigScorePrizeTierId, number> = {
  show_pick: 1,
  place_pick: 1,
  win_pick: 1,
  across_the_board: 3,
  box_bet_bonus: 3,
  exacta_win: 2,
  trifecta_jackpot: 3,
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function spreadPrizeAmounts(prizeAmounts: readonly number[]) {
  const positive = [...new Set(prizeAmounts.filter((amount) => amount > 0))].sort((left, right) => left - right);
  if (!positive.length) {
    return THE_BIG_SCORE_PRIZE_TIERS.map(() => 0);
  }

  return THE_BIG_SCORE_PRIZE_TIERS.map((_, index) => {
    const sourceIndex = Math.round((index * (positive.length - 1)) / (THE_BIG_SCORE_PRIZE_TIERS.length - 1));
    return positive[sourceIndex] ?? positive[positive.length - 1];
  });
}

function resolveTargetPrizeTierId(rewardAmount: number, payoutLadder: readonly TheBigScorePrizeTier[], seed: string) {
  if (rewardAmount <= 0) return null;

  const exactMatches = payoutLadder.filter((tier) => tier.rewardAmount === rewardAmount);
  if (exactMatches.length) {
    const index = hashSeed(seed) % exactMatches.length;
    return exactMatches[index]?.id ?? exactMatches[0]?.id ?? null;
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

export function generateTheBigScoreVaultNumbers(seed: string): TheBigScoreVaultOffer {
  const random = createSeededRandom(seed);
  const chosen = new Set<number>();
  while (chosen.size < 6) {
    chosen.add(Math.floor(random() * 99) + 1);
  }
  return [...chosen] as TheBigScoreVaultOffer;
}

export function appendVaultCodeSelection(currentOrder: readonly number[], value: number) {
  if (currentOrder.includes(value)) {
    return [...currentOrder];
  }
  if (currentOrder.length >= 3) {
    return [...currentOrder.slice(1), value];
  }
  return [...currentOrder, value];
}

export function undoVaultCodeSelection(currentOrder: readonly number[]) {
  return currentOrder.slice(0, -1);
}

export function resetVaultCodeSelection() {
  return [] as number[];
}

function getUnpickedVaultNumbers(offeredVaultNumbers: readonly number[], selectedOrder: readonly number[]) {
  return offeredVaultNumbers.filter((value) => !selectedOrder.includes(value));
}

function pickRemainingVaultNumber(remaining: readonly number[], random: () => number, exclude: readonly number[] = []) {
  const available = remaining.filter((value) => !exclude.includes(value));
  if (!available.length) {
    throw new Error("No remaining vault numbers available for reveal.");
  }
  return available[Math.floor(random() * available.length)] ?? available[0];
}

function buildVaultCombinationForTier(
  targetPrizeTierId: TheBigScorePrizeTierId | null,
  offeredVaultNumbers: TheBigScoreVaultOffer,
  selectedOrder: TheBigScoreVaultCode,
  seed: string
): TheBigScoreVaultCode {
  const random = createSeededRandom(seed);
  const [first, second, third] = selectedOrder;
  const remaining = getUnpickedVaultNumbers(offeredVaultNumbers, selectedOrder);

  switch (targetPrizeTierId) {
    case "trifecta_jackpot":
      return [first, second, third];
    case "exacta_win":
      return [first, second, pickRemainingVaultNumber(remaining, random)];
    case "box_bet_bonus":
      return [first, third, second];
    case "across_the_board": {
      const patterns: TheBigScoreVaultCode[] = [
        [second, first, third],
        [third, first, second],
        [second, third, first],
      ];
      return patterns[Math.floor(random() * patterns.length)] ?? patterns[0];
    }
    case "win_pick": {
      const revealedSecond = pickRemainingVaultNumber(remaining, random);
      const revealedThird = pickRemainingVaultNumber(remaining, random, [revealedSecond]);
      return [first, revealedSecond, revealedThird];
    }
    case "place_pick": {
      const revealedFirst = pickRemainingVaultNumber(remaining, random);
      const revealedThird = pickRemainingVaultNumber(remaining, random, [revealedFirst]);
      return [revealedFirst, second, revealedThird];
    }
    case "show_pick": {
      const revealedFirst = pickRemainingVaultNumber(remaining, random);
      const revealedSecond = pickRemainingVaultNumber(remaining, random, [revealedFirst]);
      return [revealedFirst, revealedSecond, third];
    }
    default:
      return remaining as TheBigScoreVaultCode;
  }
}

export function calculateTheBigScorePayoutMatches(
  selectedOrder: readonly number[],
  revealedCombination: readonly number[]
): TheBigScorePrizeTierId[] {
  if (selectedOrder.length !== 3 || revealedCombination.length !== 3) return [];

  const [selectedFirst, selectedSecond, selectedThird] = selectedOrder;
  const [revealedFirst, revealedSecond, revealedThird] = revealedCombination;
  const topThreeMatch =
    revealedCombination.includes(selectedFirst) &&
    revealedCombination.includes(selectedSecond) &&
    revealedCombination.includes(selectedThird);

  if (revealedFirst === selectedFirst && revealedSecond === selectedSecond && revealedThird === selectedThird) {
    return ["trifecta_jackpot"];
  }
  if (revealedFirst === selectedFirst && revealedSecond === selectedSecond) {
    return ["exacta_win"];
  }
  if (topThreeMatch && revealedFirst === selectedFirst) {
    return ["box_bet_bonus"];
  }
  if (topThreeMatch) {
    return ["across_the_board"];
  }
  if (revealedFirst === selectedFirst) {
    return ["win_pick"];
  }
  if (revealedFirst === selectedSecond || revealedSecond === selectedSecond) {
    return ["place_pick"];
  }
  if (revealedCombination.includes(selectedThird)) {
    return ["show_pick"];
  }
  return [];
}

export function resolveTheBigScoreWinningTierId(matches: readonly TheBigScorePrizeTierId[]) {
  if (matches.includes("trifecta_jackpot")) return "trifecta_jackpot";
  if (matches.includes("exacta_win")) return "exacta_win";
  if (matches.includes("box_bet_bonus")) return "box_bet_bonus";
  if (matches.includes("across_the_board")) return "across_the_board";
  if (matches.includes("win_pick")) return "win_pick";
  if (matches.includes("place_pick")) return "place_pick";
  if (matches.includes("show_pick")) return "show_pick";
  return null;
}

export function createInitialTheBigScoreGameState(ticket: TheBigScoreTicketData): TheBigScoreGameState {
  return {
    selectedEntrance: null,
    selectedGetaway: null,
    offeredVaultNumbers: generateTheBigScoreVaultNumbers(`${ticket.sessionId}:${ticket.seed}:vault-options`),
    selectedVaultCodeOrder: [],
    revealedVaultCombination: null,
    payoutMatches: [],
    totalWinnings: 0,
    currentStep: 1,
  };
}

export function setTheBigScoreEntrance(state: TheBigScoreGameState, entranceId: TheBigScoreEntranceId): TheBigScoreGameState {
  return {
    ...state,
    selectedEntrance: entranceId,
  };
}

export function confirmTheBigScoreEntrance(state: TheBigScoreGameState): TheBigScoreGameState {
  if (!state.selectedEntrance) return state;
  return {
    ...state,
    currentStep: 2,
  };
}

export function setTheBigScoreGetaway(state: TheBigScoreGameState, getawayId: TheBigScoreGetawayId): TheBigScoreGameState {
  return {
    ...state,
    selectedGetaway: getawayId,
  };
}

export function confirmTheBigScoreGetaway(state: TheBigScoreGameState): TheBigScoreGameState {
  if (!state.selectedGetaway) return state;
  return {
    ...state,
    currentStep: 3,
  };
}

export function chooseTheBigScoreVaultNumber(state: TheBigScoreGameState, value: number): TheBigScoreGameState {
  if (state.currentStep !== 3) return state;
  return {
    ...state,
    selectedVaultCodeOrder: appendVaultCodeSelection(state.selectedVaultCodeOrder, value),
  };
}

export function undoTheBigScoreVaultNumber(state: TheBigScoreGameState): TheBigScoreGameState {
  if (state.currentStep !== 3) return state;
  return {
    ...state,
    selectedVaultCodeOrder: undoVaultCodeSelection(state.selectedVaultCodeOrder),
  };
}

export function resetTheBigScoreVaultCode(state: TheBigScoreGameState): TheBigScoreGameState {
  if (state.currentStep !== 3) return state;
  return {
    ...state,
    selectedVaultCodeOrder: resetVaultCodeSelection(),
  };
}

export function confirmTheBigScoreVaultCode(state: TheBigScoreGameState): TheBigScoreGameState {
  if (state.currentStep !== 3 || state.selectedVaultCodeOrder.length !== 3) return state;
  return {
    ...state,
    currentStep: 4,
  };
}

export function goToTheBigScoreStep(state: TheBigScoreGameState, step: 1 | 2 | 3): TheBigScoreGameState {
  if (step === 1) {
    return {
      ...state,
      currentStep: 1,
    };
  }
  if (step === 2 && state.selectedEntrance) {
    return {
      ...state,
      currentStep: 2,
    };
  }
  if (step === 3 && state.selectedEntrance && state.selectedGetaway) {
    return {
      ...state,
      currentStep: 3,
    };
  }
  return state;
}

export function syncTheBigScoreRevealForSelection(ticket: TheBigScoreTicketData, state: TheBigScoreGameState): TheBigScoreGameState {
  if (state.selectedVaultCodeOrder.length !== 3) {
    return {
      ...state,
      revealedVaultCombination: null,
      payoutMatches: [],
      totalWinnings: 0,
    };
  }

  const selectedOrder = state.selectedVaultCodeOrder as TheBigScoreVaultCode;
  const revealedVaultCombination = buildVaultCombinationForTier(
    ticket.targetPrizeTierId,
    state.offeredVaultNumbers,
    selectedOrder,
    `${ticket.sessionId}:${ticket.seed}:${ticket.targetPrizeTierId ?? "loss"}:${selectedOrder.join("-")}`
  );
  const payoutMatches = calculateTheBigScorePayoutMatches(selectedOrder, revealedVaultCombination);
  const winningTier = findPrizeTier(ticket, resolveTheBigScoreWinningTierId(payoutMatches));

  return {
    ...state,
    revealedVaultCombination,
    payoutMatches,
    totalWinnings: winningTier?.rewardAmount ?? 0,
  };
}

function findPrizeTier(ticket: TheBigScoreTicketData, prizeTierId: TheBigScorePrizeTierId | null) {
  if (!prizeTierId) return null;
  return ticket.payoutLadder.find((tier) => tier.id === prizeTierId) ?? null;
}

export function revealTheBigScoreVault(ticket: TheBigScoreTicketData, state: TheBigScoreGameState): TheBigScoreGameState {
  if (state.currentStep !== 3 || state.selectedVaultCodeOrder.length !== 3) return state;
  return syncTheBigScoreRevealForSelection(ticket, state);
}

export function getTheBigScoreWinningTier(ticket: TheBigScoreTicketData, state: TheBigScoreGameState) {
  return findPrizeTier(ticket, resolveTheBigScoreWinningTierId(state.payoutMatches));
}

export function getTheBigScoreResultCopy(ticket: TheBigScoreTicketData, state: TheBigScoreGameState) {
  const winningTier = getTheBigScoreWinningTier(ticket, state);
  switch (winningTier?.id) {
    case "trifecta_jackpot":
      return {
        eyebrow: "Trifecta Crack",
        headline: "Perfect Crack!",
        subhead: "Vault combination matched exactly. The Big Score is yours.",
      };
    case "exacta_win":
      return {
        eyebrow: "Exacta Crack",
        headline: "Clean Opening Sequence!",
        subhead: "First two tumblers matched. The vault nearly opened clean.",
      };
    case "box_bet_bonus":
      return {
        eyebrow: "Box Bet Bonus",
        headline: "Boxed The Vault!",
        subhead: "All three tumblers hit, and your opening number led the crack home.",
      };
    case "across_the_board":
      return {
        eyebrow: "Across The Board",
        headline: "All Three Tumblers Hit!",
        subhead: "Your whole call landed in the vault, just not in the clean crack order.",
      };
    case "win_pick":
      return {
        eyebrow: "Win Crack",
        headline: "First Tumbler Cracked.",
        subhead: "You hit the opening position and put the lock on notice.",
      };
    case "place_pick":
      return {
        eyebrow: "Place Crack",
        headline: "Second Tumbler Cracked.",
        subhead: "The middle tumbler clicked, but the sequence slipped away.",
      };
    case "show_pick":
      return {
        eyebrow: "Show Crack",
        headline: "Third Tumbler Cracked.",
        subhead: "You caught the tail of the combination, but the vault stayed stubborn.",
      };
    default:
      return {
        eyebrow: "Vault Locked",
        headline: "Wrong Combination.",
        subhead: "Vault remains sealed. The casino floor stays dark tonight.",
      };
  }
}

export function formatTheBigScoreVaultNumber(value: number) {
  return value.toString().padStart(2, "0");
}

export function isTheBigScoreScratchArmed(state: TheBigScoreGameState) {
  return state.currentStep === 3 && state.selectedVaultCodeOrder.length === 3;
}

export function getTheBigScoreScratchThreshold() {
  return THE_BIG_SCORE_SCRATCH_THRESHOLD;
}

export function createTheBigScoreLoadoutCallsign(state: Pick<TheBigScoreGameState, "selectedEntrance" | "selectedGetaway" | "offeredVaultNumbers">) {
  if (!state.selectedEntrance || !state.selectedGetaway) return "Vault Pending";
  const entrance = THE_BIG_SCORE_ENTRANCES.find((entry) => entry.id === state.selectedEntrance);
  const getaway = THE_BIG_SCORE_GETAWAYS.find((entry) => entry.id === state.selectedGetaway);
  const seed = `${state.selectedEntrance}:${state.selectedGetaway}:${state.offeredVaultNumbers.join("-")}`;
  const random = createSeededRandom(seed);
  const callsigns = [
    `${entrance?.title ?? "Vault"} Run`,
    `${getaway?.title ?? "Exit"} Exit`,
    `Code ${state.offeredVaultNumbers.map((value) => formatTheBigScoreVaultNumber(value)).join("-")}`,
  ];
  return callsigns[Math.floor(random() * callsigns.length)] ?? callsigns[0];
}

export type CreateTheBigScoreTicketInput = {
  ticketId: TheBigScoreTicketTier;
  rewardAmount: number;
  prizeAmounts: readonly number[];
  sessionId: string;
  selectionSeed: string;
};

export function createTheBigScoreTicket({
  ticketId,
  rewardAmount,
  prizeAmounts,
  sessionId,
  selectionSeed,
}: CreateTheBigScoreTicketInput): TheBigScoreTicketData {
  const distributedAmounts = spreadPrizeAmounts(prizeAmounts);
  const payoutLadder = THE_BIG_SCORE_PRIZE_TIERS.map((tier, index) => ({
    ...tier,
    rewardAmount: (distributedAmounts[index] ?? 0) * PRIZE_TIER_MULTIPLIER[tier.id],
  }));

  return {
    mode: "the_big_score",
    version: 3,
    sessionId,
    seed: selectionSeed,
    ticketId,
    rewardAmount,
    prizeAmounts: [...prizeAmounts],
    payoutLadder,
    targetPrizeTierId: resolveTargetPrizeTierId(rewardAmount, payoutLadder, `${sessionId}:${selectionSeed}:${rewardAmount}`),
  };
}
