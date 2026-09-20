import { REEL_REVEAL_SCRATCH_THRESHOLD } from "./reelRevealAnimations";
import { buildReelRevealPayoutRows } from "./reelRevealPayouts";
import { REEL_REVEAL_SYMBOL_ORDER } from "./reelRevealSymbols";
import type {
  ReelRevealGameState,
  ReelRevealPayoutRow,
  ReelRevealSpinOutcome,
  ReelRevealSymbolId,
  ReelRevealTicketData,
} from "./reelRevealTypes";

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
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pickLossSymbols(random: () => number, payoutRows: readonly ReelRevealPayoutRow[]) {
  const winningPatterns = new Set(payoutRows.map((row) => row.symbols.join("|")));
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const symbols = shuffle(REEL_REVEAL_SYMBOL_ORDER, random).slice(0, 3);
    if (!winningPatterns.has(symbols.join("|"))) {
      return symbols;
    }
  }

  return ["seven", "dice", "grapes"] satisfies ReelRevealSymbolId[];
}

function buildSpinOutcome(rewardAmount: number, payoutRows: readonly ReelRevealPayoutRow[], random: () => number): ReelRevealSpinOutcome {
  if (rewardAmount <= 0 || !payoutRows.length) {
    const symbols = pickLossSymbols(random, payoutRows);
    return {
      payoutRowId: null,
      rewardAmount: 0,
      symbols,
      headline: "No match this round",
      subhead: "Scratch another ticket and line up the reels again.",
      celebration: "none",
    };
  }

  const row = payoutRows.find((entry) => entry.rewardAmount === rewardAmount) ?? payoutRows[payoutRows.length - 1];
  const isJackpot = row === payoutRows[payoutRows.length - 1];
  return {
    payoutRowId: row.id,
    rewardAmount,
    symbols: row.symbols,
    headline: isJackpot ? "Jackpot line locked" : "Winning line revealed",
    subhead: isJackpot ? "The reels landed on the premium combo." : "Spin complete. The payout line connected.",
    celebration: isJackpot ? "jackpot" : "spark",
  };
}

function buildReelStrip(seed: string, reelIndex: number, finalSymbol: ReelRevealSymbolId) {
  const random = createSeededRandom(`${seed}:strip:${reelIndex}`);
  const strip: ReelRevealSymbolId[] = [];
  while (strip.length < 18) {
    strip.push(...shuffle(REEL_REVEAL_SYMBOL_ORDER, random));
  }
  const finalIndex = 12 + reelIndex;
  strip[finalIndex] = finalSymbol;
  strip[finalIndex - 1] = shuffle(REEL_REVEAL_SYMBOL_ORDER.filter((symbol) => symbol !== finalSymbol), random)[0];
  strip[finalIndex + 1] = shuffle(REEL_REVEAL_SYMBOL_ORDER.filter((symbol) => symbol !== finalSymbol), random)[1];
  return { strip, finalIndex };
}

export type CreateReelRevealTicketInput = {
  ticketId: ReelRevealTicketData["ticketId"];
  rewardAmount: number;
  prizeAmounts: readonly number[];
  sessionId: string;
  selectionSeed: string;
};

export function createReelRevealTicket({
  ticketId,
  rewardAmount,
  prizeAmounts,
  sessionId,
  selectionSeed,
}: CreateReelRevealTicketInput): ReelRevealTicketData {
  const payoutRows = buildReelRevealPayoutRows(prizeAmounts);
  const random = createSeededRandom(`${ticketId}:${selectionSeed}:${rewardAmount}:${sessionId}`);
  const spinOutcome = buildSpinOutcome(rewardAmount, payoutRows, random);
  const reelData = spinOutcome.symbols.map((symbol, index) => buildReelStrip(selectionSeed, index, symbol));
  const reelStrips = reelData.map((entry) => entry.strip);
  const finalReelIndexes = reelData.map((entry) => entry.finalIndex);
  const initialReelIndexes = reelStrips.map((strip, reelIndex) => {
    const randomIndex = 2 + Math.floor(random() * (strip.length - 6));
    return randomIndex === finalReelIndexes[reelIndex] ? randomIndex - 2 : randomIndex;
  });

  return {
    mode: "reel_reveal",
    version: 1,
    sessionId,
    seed: selectionSeed,
    ticketId,
    rewardAmount,
    reelCount: 3,
    visibleRows: 3,
    reelStrips,
    initialReelIndexes,
    finalReelIndexes,
    payoutRows,
    spinOutcome,
  };
}

export function createInitialReelRevealGameState(ticket: ReelRevealTicketData): ReelRevealGameState {
  return {
    phase: "idle",
    scratchedRatio: 0,
    scratchComplete: false,
    spinStarted: false,
    spinResolved: false,
    reelIndexes: [...ticket.initialReelIndexes],
    stoppedReels: Array.from({ length: ticket.reelCount }, () => false),
    visibleSymbols: ticket.initialReelIndexes.map((index, reelIndex) => ticket.reelStrips[reelIndex][index]),
    finalSymbols: null,
  };
}

export function updateReelRevealScratchProgress(state: ReelRevealGameState, scratchedRatio: number): ReelRevealGameState {
  const clamped = Math.max(0, Math.min(1, scratchedRatio));
  if (clamped >= REEL_REVEAL_SCRATCH_THRESHOLD) {
    return {
      ...state,
      phase: "readyToSpin",
      scratchedRatio: 1,
      scratchComplete: true,
    };
  }

  return {
    ...state,
    phase: clamped > 0 ? "scratching" : "idle",
    scratchedRatio: clamped,
  };
}

export function completeReelRevealScratch(state: ReelRevealGameState): ReelRevealGameState {
  return {
    ...state,
    phase: "readyToSpin",
    scratchedRatio: 1,
    scratchComplete: true,
  };
}

export function beginReelRevealSpin(state: ReelRevealGameState): ReelRevealGameState {
  if (!state.scratchComplete || state.spinStarted) return state;
  return {
    ...state,
    phase: "spinning",
    spinStarted: true,
    stoppedReels: state.stoppedReels.map(() => false),
  };
}

export function updateReelRevealReelIndex(
  state: ReelRevealGameState,
  ticket: ReelRevealTicketData,
  reelIndex: number,
  nextIndex: number
): ReelRevealGameState {
  if (reelIndex < 0 || reelIndex >= ticket.reelCount) return state;
  const reelLength = ticket.reelStrips[reelIndex].length;
  const normalizedIndex = ((nextIndex % reelLength) + reelLength) % reelLength;
  const reelIndexes = [...state.reelIndexes];
  reelIndexes[reelIndex] = normalizedIndex;
  const visibleSymbols = [...state.visibleSymbols];
  visibleSymbols[reelIndex] = ticket.reelStrips[reelIndex][normalizedIndex];
  return { ...state, reelIndexes, visibleSymbols };
}

export function stopReelRevealReel(
  state: ReelRevealGameState,
  ticket: ReelRevealTicketData,
  reelIndex: number
): ReelRevealGameState {
  const next = updateReelRevealReelIndex(state, ticket, reelIndex, ticket.finalReelIndexes[reelIndex]);
  const stoppedReels = [...next.stoppedReels];
  stoppedReels[reelIndex] = true;
  const allStopped = stoppedReels.every(Boolean);
  return {
    ...next,
    stoppedReels,
    phase: allStopped ? (ticket.rewardAmount > 0 ? "win" : "lose") : next.phase,
    spinResolved: allStopped,
    finalSymbols: allStopped ? [...ticket.spinOutcome.symbols] : next.finalSymbols,
  };
}

export function completeReelRevealGame(state: ReelRevealGameState): ReelRevealGameState {
  if (state.phase !== "win" && state.phase !== "lose") return state;
  return { ...state, phase: "complete" };
}
