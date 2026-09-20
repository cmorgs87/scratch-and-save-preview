import assert from "node:assert/strict";

import {
  BATTLESCRATCH_SHIPS,
  buildCompletedMarkers,
  cellKey,
  completeReveal,
  createInitialRevealState,
  deserializeSession,
  detectSunkShips,
  generateTicketForTier,
  placeShips,
  resolvePrizeTier,
  resolveTicketOutcome,
  serializeSession,
  upsertMarker,
  validateNoOverlap,
  validateWithinBounds,
} from "./battlescratch";

function runChecks() {
  const ships = placeShips(BATTLESCRATCH_SHIPS, 7, 7, 42);
  assert.equal(validateNoOverlap(ships), true);
  assert.equal(ships.every((ship) => validateWithinBounds(ship.cells, 7, 7)), true);

  const patrol = ships.find((ship) => ship.type === "patrol_boat");
  assert.ok(patrol);
  const partialHit = [cellKey(patrol.cells[0].row, patrol.cells[0].col)];
  assert.equal(detectSunkShips(ships, partialHit).length, 0);
  const fullHit = patrol.cells.map((cell) => cellKey(cell.row, cell.col));
  assert.equal(detectSunkShips(ships, fullHit)[0]?.id, patrol.id);

  const destroyer = ships.find((ship) => ship.type === "destroyer");
  const carrier = ships.find((ship) => ship.type === "carrier");
  assert.ok(destroyer);
  assert.ok(carrier);
  assert.equal(resolvePrizeTier([]), "loss");
  assert.equal(resolvePrizeTier([patrol]), "small");
  assert.equal(resolvePrizeTier([destroyer]), "medium");
  assert.equal(resolvePrizeTier([carrier]), "premium");

  const tierCases = [
    { tier: "loss" as const, amount: 0 },
    { tier: "small" as const, amount: 5 },
    { tier: "medium" as const, amount: 25 },
    { tier: "premium" as const, amount: 150 },
  ];
  tierCases.forEach(({ tier, amount }, index) => {
    const ticket = generateTicketForTier("gold", amount, tier, 500 + index);
    const outcome = resolveTicketOutcome(ticket, buildCompletedMarkers(ticket));
    assert.equal(outcome.prizeTier, tier);
    assert.equal(outcome.prizeAmount, tier === "loss" ? 0 : amount);
  });

  const mediumTicket = generateTicketForTier("silver", 20, "medium", 720);
  const [first, second] = mediumTicket.selectableTargets;
  assert.ok(first);
  assert.ok(second);
  let markers = upsertMarker([], first, mediumTicket);
  markers = upsertMarker(markers, second, mediumTicket);
  markers = upsertMarker(markers, first, mediumTicket);
  assert.equal(markers.length, 1);

  const lossTicket = generateTicketForTier("bronze", 0, "loss", 910);
  const session = {
    ticket: lossTicket,
    markers: buildCompletedMarkers(lossTicket),
    revealState: createInitialRevealState(),
  };
  const restored = deserializeSession(serializeSession(session));
  assert.ok(restored);
  assert.equal(restored?.ticket.seed, lossTicket.seed);

  const completed = completeReveal(createInitialRevealState(), lossTicket, resolveTicketOutcome(lossTicket, session.markers));
  assert.equal(completed.completed, true);
  assert.equal(completed.revealedCells.length, lossTicket.rows * lossTicket.cols);
}

runChecks();
console.log("Battlescratch checks passed");
