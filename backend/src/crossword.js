"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTicketEconomyConfig = parseTicketEconomyConfig;
exports.pickWeightedPayout = pickWeightedPayout;
exports.resolveCrosswordClaim = resolveCrosswordClaim;
function parseTicketEconomyConfig(raw) {
    const parsed = JSON.parse(raw);
    return {
        bronze: normalizeTicketEconomyConfig(parsed.bronze),
        silver: normalizeTicketEconomyConfig(parsed.silver),
        gold: normalizeTicketEconomyConfig(parsed.gold),
    };
}
function normalizeTicketEconomyConfig(entry) {
    const payouts = Array.isArray(entry?.payouts)
        ? entry.payouts
            .map((payout) => ({
            amount: Number(payout?.amount ?? 0),
            weight: Number(payout?.weight ?? 0),
        }))
            .filter((payout) => Number.isFinite(payout.amount) && Number.isFinite(payout.weight) && payout.weight >= 0)
        : [];
    return {
        cost: Number(entry?.cost ?? 0),
        payouts,
    };
}
function pickWeightedPayout(payouts, randomValue = Math.random()) {
    const totalWeight = payouts.reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0);
    let roll = Math.max(0, randomValue) * (totalWeight || 1);
    let selectedAmount = 0;
    for (const entry of payouts) {
        roll -= Number(entry.weight) || 0;
        selectedAmount = Number(entry.amount) || 0;
        if (roll <= 0)
            return selectedAmount;
    }
    return selectedAmount;
}
function resolveCrosswordClaim(snapshot) {
    if (snapshot.claimedAt) {
        return {
            alreadyClaimed: true,
            claimDelta: 0,
        };
    }
    return {
        alreadyClaimed: false,
        claimDelta: Math.max(0, snapshot.rewardAmount),
    };
}
