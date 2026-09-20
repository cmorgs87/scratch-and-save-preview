import {
  LIFETIME_STATUS_TIERS,
  formatLifetimePoints,
  formatLifetimePointsRemaining,
  getLifetimePointsRemaining,
  getLifetimeStatus,
  getLifetimeStatusUnlocksCrossed,
  getLifetimeStatusRoadmap,
  getLifetimeStatusProgress,
  getNextLifetimeStatus,
} from "./lifetime-status";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertTier(points: unknown, expectedName: string) {
  assert(getLifetimeStatus(points).name === expectedName, `Expected ${String(points)} to resolve to ${expectedName}.`);
}

function assertProgress(points: unknown, expectedCurrent: string, expectedNext: string | null, expectedRemaining: number) {
  const progress = getLifetimeStatusProgress(points);
  assert(progress.currentTier.name === expectedCurrent, `Expected ${String(points)} current tier ${expectedCurrent}.`);
  assert(progress.nextTier?.name ?? null === expectedNext, `Expected ${String(points)} next tier ${String(expectedNext)}.`);
  assert(progress.pointsRemaining === expectedRemaining, `Expected ${String(points)} to have ${expectedRemaining} remaining.`);
}

assert(LIFETIME_STATUS_TIERS.length === 15, "Expected every approved lifetime status tier.");
assert(
  LIFETIME_STATUS_TIERS.every((tier) => typeof tier.designConcept === "string" && tier.designConcept.length > 0),
  "Expected every tier to include a design concept placeholder.",
);

assertTier(0, "Rookie");
assertTier(4_999, "Rookie");
assertTier(5_000, "Collector");
assertTier(19_999, "Collector");
assertTier(20_000, "Explorer");
assertTier(49_999, "Explorer");
assertTier(50_000, "Adventurer");
assertTier(99_999, "Adventurer");
assertTier(100_000, "Treasure Hunter");
assertTier(249_999, "Treasure Hunter");
assertTier(250_000, "High Roller");
assertTier(499_999, "High Roller");
assertTier(500_000, "Elite");
assertTier(999_999, "Elite");
assertTier(1_000_000, "Champion");
assertTier(2_499_999, "Champion");
assertTier(2_500_000, "Legend");
assertTier(4_999_999, "Legend");
assertTier(5_000_000, "Grand Legend");
assertTier(9_999_999, "Grand Legend");
assertTier(10_000_000, "Hall of Fame");
assertTier(24_999_999, "Hall of Fame");
assertTier(25_000_000, "Master Collector");
assertTier(49_999_999, "Master Collector");
assertTier(50_000_000, "Diamond Status");
assertTier(99_999_999, "Diamond Status");
assertTier(100_000_000, "Mythic");
assertTier(249_999_999, "Mythic");
assertTier(250_000_000, "Immortal");
assertTier(250_000_001, "Immortal");

assertTier(-1, "Rookie");
assertTier(undefined, "Rookie");
assertTier(Number.NaN, "Rookie");
assertTier(5_000.9, "Collector");

assertProgress(0, "Rookie", "Collector", 5_000);
assertProgress(75_000, "Adventurer", "Treasure Hunter", 25_000);
assertProgress(250_000_000, "Immortal", null, 0);

const rookieProgress = getLifetimeStatusProgress(2_500);
assert(rookieProgress.progress === 0.5, "Expected 2,500 points to be halfway to Collector.");

const collectorProgress = getLifetimeStatusProgress(12_500);
assert(collectorProgress.progress === 0.5, "Expected 12,500 points to be halfway through Collector.");

const treasureHunterThresholdProgress = getLifetimeStatusProgress(99_999);
assert(
  treasureHunterThresholdProgress.progress > 0.9999 && treasureHunterThresholdProgress.progress < 1,
  "Expected one point before Treasure Hunter to be almost complete without reaching 100 percent.",
);

const treasureHunterEntryProgress = getLifetimeStatusProgress(100_000);
assert(treasureHunterEntryProgress.progress === 0, "Expected exact Treasure Hunter entry to reset tier-relative progress.");

const immortalProgress = getLifetimeStatusProgress(300_000_000);
assert(immortalProgress.progress === 1, "Expected Immortal progress to be complete.");
assert(immortalProgress.isMaxTier, "Expected Immortal to be the max tier.");
assert(immortalProgress.nextTier === null, "Expected no next tier for Immortal.");
assert(getLifetimePointsRemaining(300_000_000) === 0, "Expected no remaining points for Immortal.");
assert(getNextLifetimeStatus(300_000_000) === null, "Expected no next tier beyond Immortal.");
assert(formatLifetimePoints(1_000_000) === "1,000,000", "Expected lifetime points to use en-US formatting.");
assert(formatLifetimePoints(-5) === "0", "Expected negative points to format as zero.");
assert(formatLifetimePointsRemaining(1) === "1 point remaining", "Expected singular remaining-points copy.");
assert(formatLifetimePointsRemaining(2_500) === "2,500 points remaining", "Expected plural remaining-points copy.");

const roadmap = getLifetimeStatusRoadmap(75_000);
assert(roadmap.find((entry) => entry.tier.name === "Rookie")?.state === "completed", "Expected Rookie to be marked completed at 75,000 points.");
assert(roadmap.find((entry) => entry.tier.name === "Adventurer")?.state === "current", "Expected Adventurer to be current at 75,000 points.");
assert(roadmap.find((entry) => entry.tier.name === "Treasure Hunter")?.state === "next", "Expected Treasure Hunter to be the next tier at 75,000 points.");
assert(roadmap.find((entry) => entry.tier.name === "High Roller")?.state === "locked", "Expected High Roller to remain locked at 75,000 points.");

const noUnlocks = getLifetimeStatusUnlocksCrossed(98_000, 98_500);
assert(noUnlocks.length === 0, "Expected no unlocks when lifetime points do not cross a threshold.");

const treasureHunterUnlock = getLifetimeStatusUnlocksCrossed(99_950, 100_025);
assert(treasureHunterUnlock.length === 1, "Expected Treasure Hunter to unlock once.");
assert(treasureHunterUnlock[0]?.name === "Treasure Hunter", "Expected Treasure Hunter unlock at 100,000 points.");

const thresholdUnlock = getLifetimeStatusUnlocksCrossed(99_999, 100_000);
assert(thresholdUnlock.length === 1, "Expected exact-threshold unlock to be detected.");
assert(thresholdUnlock[0]?.name === "Treasure Hunter", "Expected exact-threshold unlock to be Treasure Hunter.");

const multiUnlock = getLifetimeStatusUnlocksCrossed(95_000, 250_000);
assert(multiUnlock.length === 2, "Expected two unlocks when jumping from 95,000 to 250,000 points.");
assert(multiUnlock[0]?.name === "Treasure Hunter", "Expected Treasure Hunter to unlock first.");
assert(multiUnlock[1]?.name === "High Roller", "Expected High Roller to unlock second.");

console.log("lifetime-status.check.ts passed");
