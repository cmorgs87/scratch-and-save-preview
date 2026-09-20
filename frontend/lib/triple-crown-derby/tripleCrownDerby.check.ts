import { createTripleCrownDerbyTicket } from "./tripleCrownDerbyConfig";
import {
  assignTripleCrownDerbyPick,
  createInitialTripleCrownDerbyGameState,
  createTripleCrownDerbyRaceResult,
  evaluateTripleCrownDerbyRace,
} from "./tripleCrownDerbyEngine";
import type { TripleCrownDerbyHorseId, TripleCrownDerbyPrizeTierId } from "./tripleCrownDerbyTypes";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const prizeAmounts = [0, 10, 20, 40, 75, 150, 300, 600, 1200, 2500];
const ticket = createTripleCrownDerbyTicket({
  ticketId: "gold",
  rewardAmount: 150,
  prizeAmounts,
  sessionId: "tcd-check",
  selectionSeed: "seed-check",
});

assert(ticket.payoutLadder.length === 7, "Triple Crown Derby should expose seven prize tiers.");
assert(ticket.payoutLadder[0].rewardAmount <= ticket.payoutLadder[ticket.payoutLadder.length - 1].rewardAmount, "Prize ladder should be ordered.");

let state = createInitialTripleCrownDerbyGameState();
state = assignTripleCrownDerbyPick(state, "win", "midnight_thunder");
state = assignTripleCrownDerbyPick(state, "place", "golden_stride");
const beforeDuplicate = state;
state = assignTripleCrownDerbyPick(state, "show", "golden_stride");
assert(state === beforeDuplicate, "Duplicate horse assignment should be ignored.");
state = assignTripleCrownDerbyPick(state, "show", "silver_phantom");
assert(state.phase === "ready", "Ticket should arm when all three picks are set.");

const picks = {
  win: "midnight_thunder",
  place: "golden_stride",
  show: "silver_phantom",
} as const;

const expectations: Array<[TripleCrownDerbyPrizeTierId, TripleCrownDerbyHorseId[]]> = [
  ["trifecta_jackpot", ["midnight_thunder", "golden_stride", "silver_phantom"]],
  ["exacta_win", ["midnight_thunder", "golden_stride", "blazing_comet"]],
  ["box_bet_bonus", ["midnight_thunder", "silver_phantom", "golden_stride"]],
  ["across_the_board", ["golden_stride", "midnight_thunder", "silver_phantom"]],
  ["win_pick", ["midnight_thunder", "blazing_comet", "crimson_dash"]],
  ["place_pick", ["blazing_comet", "golden_stride", "iron_valor"]],
  ["show_pick", ["blazing_comet", "iron_valor", "silver_phantom"]],
];

for (const [expectedTierId, finishOrder] of expectations) {
  const result = evaluateTripleCrownDerbyRace(ticket, picks, finishOrder);
  assert(result.prizeTierId === expectedTierId, `Expected ${expectedTierId}, received ${result.prizeTierId ?? "no win"}.`);
}

const generated = createTripleCrownDerbyRaceResult(ticket, picks);
assert(generated.prizeTierId === "across_the_board", "Generated race should honor the reserved tier id.");
assert(new Set(generated.finishOrder).size === 6, "Generated race order should not repeat horses.");

console.log("tripleCrownDerby.check.ts passed");
