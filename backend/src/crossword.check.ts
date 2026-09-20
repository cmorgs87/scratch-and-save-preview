import assert from "node:assert/strict";

import { pickWeightedPayout, resolveCrosswordClaim, type CrosswordClaimSnapshot } from "./crossword";

function runChecks() {
  assert.equal(
    pickWeightedPayout(
      [
        { amount: 0, weight: 2 },
        { amount: 10, weight: 1 },
      ],
      0
    ),
    0
  );
  assert.equal(
    pickWeightedPayout(
      [
        { amount: 0, weight: 2 },
        { amount: 10, weight: 1 },
      ],
      0.95
    ),
    10
  );

  const session: CrosswordClaimSnapshot = {
    id: "cw-session",
    ticketId: "silver",
    cost: 20,
    rewardAmount: 50,
    claimedAt: null,
  };

  const firstClaim = resolveCrosswordClaim(session);
  assert.equal(firstClaim.alreadyClaimed, false);
  assert.equal(firstClaim.claimDelta, 50);

  const secondClaim = resolveCrosswordClaim({
    ...session,
    claimedAt: new Date("2026-04-18T12:00:00.000Z"),
  });
  assert.equal(secondClaim.alreadyClaimed, true);
  assert.equal(secondClaim.claimDelta, 0);
}

runChecks();
console.log("Crossword backend checks passed");
