import {
  TRIPLE_CROWN_DERBY_HORSES,
  TRIPLE_CROWN_DERBY_PICK_SLOTS,
  TRIPLE_CROWN_DERBY_SCRATCH_THRESHOLD,
  getTripleCrownDerbyHorse,
} from "./tripleCrownDerbyConfig";
import type {
  TripleCrownDerbyGameState,
  TripleCrownDerbyHorseId,
  TripleCrownDerbyPickSlot,
  TripleCrownDerbyPickState,
  TripleCrownDerbyPrizeTierId,
  TripleCrownDerbyRaceResult,
  TripleCrownDerbyTicketData,
} from "./tripleCrownDerbyTypes";

type LockedPicks = {
  win: TripleCrownDerbyHorseId;
  place: TripleCrownDerbyHorseId;
  show: TripleCrownDerbyHorseId;
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

function pickFromWeightedSet(horseIds: readonly TripleCrownDerbyHorseId[], random: () => number) {
  const scored = horseIds.map((horseId) => {
    const rating = getTripleCrownDerbyHorse(horseId).rating;
    return {
      horseId,
      score: rating + random() * 36 - 18 + random() * 24,
    };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.horseId ?? horseIds[0];
}

function findPrizeTier(ticket: TripleCrownDerbyTicketData, prizeTierId: TripleCrownDerbyPrizeTierId | null) {
  if (!prizeTierId) return null;
  return ticket.payoutLadder.find((tier) => tier.id === prizeTierId) ?? null;
}

function createEmptyPicks(): TripleCrownDerbyPickState {
  return {
    win: null,
    place: null,
    show: null,
  };
}

function getUnpickedHorses(picks: TripleCrownDerbyPickState) {
  const picked = new Set(Object.values(picks).filter(Boolean));
  return TRIPLE_CROWN_DERBY_HORSES.map((horse) => horse.id).filter((horseId) => !picked.has(horseId));
}

function getNextOpenSlot(picks: TripleCrownDerbyPickState) {
  return TRIPLE_CROWN_DERBY_PICK_SLOTS.find((slot) => !picks[slot]) ?? "show";
}

function arePicksComplete(picks: TripleCrownDerbyPickState) {
  return Boolean(picks.win && picks.place && picks.show);
}

function buildTopThreeForTarget(
  targetPrizeTierId: TripleCrownDerbyPrizeTierId | null,
  picks: LockedPicks,
  random: () => number
) {
  const openHorses = getUnpickedHorses(picks);

  const pickOpen = (exclude: readonly TripleCrownDerbyHorseId[] = []) =>
    pickFromWeightedSet(
      openHorses.filter((horseId) => !exclude.includes(horseId)),
      random
    );

  switch (targetPrizeTierId) {
    case "trifecta_jackpot":
      return [picks.win, picks.place, picks.show];
    case "exacta_win": {
      const third = pickOpen([]);
      return [picks.win, picks.place, third];
    }
    case "box_bet_bonus":
      return [picks.win, picks.show, picks.place];
    case "across_the_board": {
      const patterns: Array<[TripleCrownDerbyHorseId, TripleCrownDerbyHorseId, TripleCrownDerbyHorseId]> = [
        [picks.place, picks.win, picks.show],
        [picks.show, picks.win, picks.place],
        [picks.place, picks.show, picks.win],
      ];
      return patterns[Math.floor(random() * patterns.length)] ?? patterns[0];
    }
    case "win_pick": {
      const second = pickOpen([]);
      const third = pickOpen([second]);
      return [picks.win, second, third];
    }
    case "place_pick": {
      const first = pickOpen([]);
      const third = pickOpen([first]);
      return [first, picks.place, third];
    }
    case "show_pick": {
      const first = pickOpen([]);
      const second = pickOpen([first]);
      return [first, second, picks.show];
    }
    default: {
      const first = pickOpen([]);
      const second = pickOpen([first]);
      const third = pickOpen([first, second]);
      return [first, second, third];
    }
  }
}

function buildRemainingOrder(topThree: readonly TripleCrownDerbyHorseId[], random: () => number) {
  const remaining = TRIPLE_CROWN_DERBY_HORSES.map((horse) => horse.id).filter((horseId) => !topThree.includes(horseId));
  const scored = remaining.map((horseId) => ({
    horseId,
    score: getTripleCrownDerbyHorse(horseId).rating + random() * 44 - 22 + random() * 28,
  }));
  scored.sort((left, right) => right.score - left.score);
  return scored.map((entry) => entry.horseId);
}

function getTopThreeSet(order: readonly TripleCrownDerbyHorseId[]) {
  return new Set(order.slice(0, 3));
}

function topThreeContainsAllPicks(order: readonly TripleCrownDerbyHorseId[], picks: LockedPicks) {
  const set = getTopThreeSet(order);
  return set.has(picks.win) && set.has(picks.place) && set.has(picks.show);
}

export function evaluateTripleCrownDerbyRace(
  ticket: TripleCrownDerbyTicketData,
  picks: LockedPicks,
  finishOrder: readonly TripleCrownDerbyHorseId[]
): TripleCrownDerbyRaceResult {
  const [first, second, third] = finishOrder;
  const topThreeMatch = topThreeContainsAllPicks(finishOrder, picks);

  let tierId: TripleCrownDerbyPrizeTierId | null = null;
  let winningPickSlots: TripleCrownDerbyPickSlot[] = [];

  if (first === picks.win && second === picks.place && third === picks.show) {
    tierId = "trifecta_jackpot";
    winningPickSlots = ["win", "place", "show"];
  } else if (first === picks.win && second === picks.place) {
    tierId = "exacta_win";
    winningPickSlots = ["win", "place"];
  } else if (topThreeMatch && first === picks.win) {
    // Assumption: Box Bet outranks Across the Board when the player still gets the
    // Win horse home first while the selected trio sweeps the podium.
    tierId = "box_bet_bonus";
    winningPickSlots = ["win", "place", "show"];
  } else if (topThreeMatch) {
    tierId = "across_the_board";
    winningPickSlots = ["win", "place", "show"];
  } else if (first === picks.win) {
    tierId = "win_pick";
    winningPickSlots = ["win"];
  } else if (first === picks.place || second === picks.place) {
    tierId = "place_pick";
    winningPickSlots = ["place"];
  } else if (finishOrder.slice(0, 3).includes(picks.show)) {
    tierId = "show_pick";
    winningPickSlots = ["show"];
  }

  const tier = findPrizeTier(ticket, tierId);
  const matchedHorseIds = winningPickSlots
    .map((slot) => picks[slot])
    .filter((horseId): horseId is TripleCrownDerbyHorseId => Boolean(horseId));

  if (!tier) {
    return {
      finishOrder: [...finishOrder],
      podium: finishOrder.slice(0, 3),
      prizeTierId: null,
      rewardAmount: 0,
      headline: "Photo Finish",
      subhead: "Try another ticket and chase the next podium.",
      matchedHorseIds,
      winningPickSlots,
      isJackpot: false,
    };
  }

  return {
    finishOrder: [...finishOrder],
    podium: finishOrder.slice(0, 3),
    prizeTierId: tier.id,
    rewardAmount: tier.rewardAmount,
    headline: tier.label,
    subhead: tier.description,
    matchedHorseIds,
    winningPickSlots,
    isJackpot: tier.id === "trifecta_jackpot",
  };
}

export function createTripleCrownDerbyRaceResult(
  ticket: TripleCrownDerbyTicketData,
  picks: LockedPicks
): TripleCrownDerbyRaceResult {
  const random = createSeededRandom(`${ticket.sessionId}:${ticket.seed}:${ticket.targetPrizeTierId ?? "loss"}:${picks.win}:${picks.place}:${picks.show}`);
  const topThree = buildTopThreeForTarget(ticket.targetPrizeTierId, picks, random);
  const finishOrder = [...topThree, ...buildRemainingOrder(topThree, random)];
  return evaluateTripleCrownDerbyRace(ticket, picks, finishOrder);
}

export function createInitialTripleCrownDerbyGameState(): TripleCrownDerbyGameState {
  return {
    phase: "selection",
    activeSlot: "win",
    picks: createEmptyPicks(),
    scratchedRatio: 0,
    scratchComplete: false,
    raceResult: null,
  };
}

export function setTripleCrownDerbyActiveSlot(state: TripleCrownDerbyGameState, slot: TripleCrownDerbyPickSlot): TripleCrownDerbyGameState {
  if (state.scratchComplete) return state;
  return { ...state, activeSlot: slot };
}

export function assignTripleCrownDerbyPick(
  state: TripleCrownDerbyGameState,
  slot: TripleCrownDerbyPickSlot,
  horseId: TripleCrownDerbyHorseId
): TripleCrownDerbyGameState {
  if (state.scratchComplete) return state;
  const duplicateSlot = TRIPLE_CROWN_DERBY_PICK_SLOTS.find((entry) => entry !== slot && state.picks[entry] === horseId);
  if (duplicateSlot) return state;

  const picks = { ...state.picks, [slot]: horseId };
  const complete = arePicksComplete(picks);
  return {
    ...state,
    picks,
    activeSlot: complete ? slot : getNextOpenSlot(picks),
    phase: complete ? "ready" : "selection",
  };
}

export function clearTripleCrownDerbyPick(state: TripleCrownDerbyGameState, slot: TripleCrownDerbyPickSlot): TripleCrownDerbyGameState {
  if (state.scratchComplete) return state;
  const picks = { ...state.picks, [slot]: null };
  return {
    ...state,
    picks,
    activeSlot: slot,
    phase: arePicksComplete(picks) ? "ready" : "selection",
  };
}

export function updateTripleCrownDerbyScratchProgress(
  ticket: TripleCrownDerbyTicketData,
  state: TripleCrownDerbyGameState,
  scratchedRatio: number
): TripleCrownDerbyGameState {
  if (!arePicksComplete(state.picks)) return state;

  const clamped = Math.max(0, Math.min(1, scratchedRatio));
  if (clamped >= TRIPLE_CROWN_DERBY_SCRATCH_THRESHOLD) {
    return completeTripleCrownDerbyScratch(ticket, state);
  }

  return {
    ...state,
    scratchedRatio: clamped,
    phase: clamped > 0 ? "scratching" : "ready",
  };
}

export function completeTripleCrownDerbyScratch(ticket: TripleCrownDerbyTicketData, state: TripleCrownDerbyGameState): TripleCrownDerbyGameState {
  if (!arePicksComplete(state.picks)) return state;
  if (state.scratchComplete && state.raceResult) return state;

  const picks = state.picks as LockedPicks;
  return {
    ...state,
    scratchedRatio: 1,
    scratchComplete: true,
    phase: "photo_finish",
    raceResult: createTripleCrownDerbyRaceResult(ticket, picks),
  };
}

export function settleTripleCrownDerbyReveal(state: TripleCrownDerbyGameState): TripleCrownDerbyGameState {
  if (state.phase !== "photo_finish") return state;
  return {
    ...state,
    phase: "revealed",
  };
}

export function isTripleCrownDerbyScratchArmed(state: TripleCrownDerbyGameState) {
  return arePicksComplete(state.picks);
}

export function getTripleCrownDerbyWinningTier(ticket: TripleCrownDerbyTicketData, result: TripleCrownDerbyRaceResult | null) {
  if (!result?.prizeTierId) return null;
  return findPrizeTier(ticket, result.prizeTierId);
}

export function formatTripleCrownDerbyPickLabel(slot: TripleCrownDerbyPickSlot) {
  switch (slot) {
    case "win":
      return "Win";
    case "place":
      return "Place";
    case "show":
      return "Show";
  }
}
