import assert from "node:assert/strict";

import {
  resolveBackfilledLifetimePoints,
  shouldCountTowardsLifetimePoints,
  sumLifetimeQualifyingPoints,
} from "./lifetimePoints";

assert.equal(shouldCountTowardsLifetimePoints("scratcher_win", 25), true);
assert.equal(shouldCountTowardsLifetimePoints("daily", 25), true);
assert.equal(shouldCountTowardsLifetimePoints("signup", 100), false);
assert.equal(shouldCountTowardsLifetimePoints("scratcher_win", 0), false);
assert.equal(shouldCountTowardsLifetimePoints("scratcher_win", -25), false);

assert.equal(
  sumLifetimeQualifyingPoints([
    { kind: "signup", delta: 100 },
    { kind: "daily", delta: 25 },
    { kind: "scratcher_win", delta: 50 },
    { kind: "the_big_score_win", delta: 150 },
    { kind: "ticket_spend", delta: -20 },
  ]),
  225
);

assert.equal(
  resolveBackfilledLifetimePoints({
    existingLifetimePointsEarned: 0,
    scratchCoin: 340,
    ledgerEntries: [
      { kind: "daily", delta: 25 },
      { kind: "scratcher_win", delta: 75 },
      { kind: "signup", delta: 100 },
    ],
  }),
  100
);

assert.equal(
  resolveBackfilledLifetimePoints({
    existingLifetimePointsEarned: 0,
    scratchCoin: 180,
    ledgerEntries: [],
  }),
  180
);

assert.equal(
  resolveBackfilledLifetimePoints({
    existingLifetimePointsEarned: 600,
    scratchCoin: 180,
    ledgerEntries: [{ kind: "daily", delta: 25 }],
  }),
  600
);

console.log("Lifetime points checks passed.");
