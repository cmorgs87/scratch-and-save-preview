"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const crossword_1 = require("./crossword");
function runChecks() {
    strict_1.default.equal((0, crossword_1.pickWeightedPayout)([
        { amount: 0, weight: 2 },
        { amount: 10, weight: 1 },
    ], 0), 0);
    strict_1.default.equal((0, crossword_1.pickWeightedPayout)([
        { amount: 0, weight: 2 },
        { amount: 10, weight: 1 },
    ], 0.95), 10);
    const session = {
        id: "cw-session",
        ticketId: "silver",
        cost: 20,
        rewardAmount: 50,
        claimedAt: null,
    };
    const firstClaim = (0, crossword_1.resolveCrosswordClaim)(session);
    strict_1.default.equal(firstClaim.alreadyClaimed, false);
    strict_1.default.equal(firstClaim.claimDelta, 50);
    const secondClaim = (0, crossword_1.resolveCrosswordClaim)({
        ...session,
        claimedAt: new Date("2026-04-18T12:00:00.000Z"),
    });
    strict_1.default.equal(secondClaim.alreadyClaimed, true);
    strict_1.default.equal(secondClaim.claimDelta, 0);
}
runChecks();
console.log("Crossword backend checks passed");
