import {
  beginReelRevealSpin,
  completeReelRevealGame,
  completeReelRevealScratch,
  createInitialReelRevealGameState,
  createReelRevealTicket,
  stopReelRevealReel,
} from "./reelRevealEngine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const prizeAmounts = [0, 10, 25, 75, 150, 300];

const losingTicket = createReelRevealTicket({
  ticketId: "bronze",
  rewardAmount: 0,
  prizeAmounts,
  sessionId: "loss-session",
  selectionSeed: "loss-seed",
});

assert(losingTicket.spinOutcome.rewardAmount === 0, "Loss ticket should resolve to zero reward.");
assert(losingTicket.spinOutcome.payoutRowId === null, "Loss ticket should not point at a payout row.");

const winningTicket = createReelRevealTicket({
  ticketId: "gold",
  rewardAmount: 150,
  prizeAmounts,
  sessionId: "win-session",
  selectionSeed: "win-seed",
});

assert(
  winningTicket.payoutRows.every((row, index, rows) => index === 0 || row.rewardAmount > rows[index - 1].rewardAmount),
  "Payout rows should increase in reward order."
);
assert(winningTicket.spinOutcome.rewardAmount === 150, "Winning ticket should preserve the reserved reward amount.");
assert(winningTicket.spinOutcome.symbols.length === 3, "Winning ticket should resolve exactly three reel symbols.");

let state = createInitialReelRevealGameState(winningTicket);
state = completeReelRevealScratch(state);
assert(state.scratchComplete, "Scratch completion should unlock the spin.");
state = beginReelRevealSpin(state);
assert(state.phase === "spinning", "Spin should enter the spinning phase.");
state = stopReelRevealReel(state, winningTicket, 0);
state = stopReelRevealReel(state, winningTicket, 1);
state = stopReelRevealReel(state, winningTicket, 2);
assert(state.phase === "win", "Winning ticket should enter the win phase after all reels stop.");
assert(state.finalSymbols?.join("|") === winningTicket.spinOutcome.symbols.join("|"), "Final symbols should match the reserved outcome.");
state = completeReelRevealGame(state);
assert(state.phase === "complete", "Completed win should settle into the complete phase.");

console.log("reelReveal.check.ts passed");
