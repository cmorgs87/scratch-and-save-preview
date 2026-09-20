import assert from "node:assert/strict";

import {
  applyCrosswordRewardGrant,
  checkCrosswordTicket,
  createInitialCrosswordGameState,
  markCrosswordBoardCell,
  revealAllCrosswordLetterCells,
  revealCrosswordLetterCell,
} from "./crosswordEngine";
import { createCrosswordTicket } from "./crosswordConfig";
import { selectCompletedWordTexts, selectResolvedCrosswordBoardCells } from "./crosswordSelectors";

function playTicketToEnd(ticket: ReturnType<typeof createCrosswordTicket>) {
  let state = createInitialCrosswordGameState();

  ticket.letterBank.forEach((letterCell) => {
    state = revealCrosswordLetterCell(ticket, state, letterCell.id);
    ticket.boardCells
      .filter((cell) => cell.isPlayable && cell.letter === letterCell.letter)
      .forEach((cell) => {
        state = markCrosswordBoardCell(ticket, state, cell.id);
      });
  });

  return state;
}

function assertTicketWordsConnected(ticket: ReturnType<typeof createCrosswordTicket>) {
  if (ticket.words.length <= 1) return;

  const cellToWordIds = new Map<string, string[]>();
  ticket.words.forEach((word) => {
    word.cellIds.forEach((cellId) => {
      const current = cellToWordIds.get(cellId) ?? [];
      cellToWordIds.set(cellId, [...current, word.id]);
    });
  });

  const neighbors = new Map<string, Set<string>>();
  ticket.words.forEach((word) => {
    neighbors.set(word.id, new Set());
  });

  cellToWordIds.forEach((wordIds) => {
    wordIds.forEach((wordId) => {
      const linked = neighbors.get(wordId)!;
      wordIds.forEach((candidateId) => {
        if (candidateId !== wordId) {
          linked.add(candidateId);
        }
      });
    });
  });

  const visited = new Set<string>();
  const queue = [ticket.words[0]!.id];
  while (queue.length > 0) {
    const wordId = queue.shift()!;
    if (visited.has(wordId)) continue;
    visited.add(wordId);
    neighbors.get(wordId)?.forEach((neighborId) => {
      if (!visited.has(neighborId)) {
        queue.push(neighborId);
      }
    });
  }

  assert.equal(visited.size, ticket.words.length);
}

function getTicketStructureSignature(ticket: ReturnType<typeof createCrosswordTicket>) {
  return ticket.boardCells
    .map((cell) => `${cell.row},${cell.col}`)
    .sort()
    .join("|");
}

function runChecks() {
  const sampledTickets = Array.from({ length: 12 }, (_, index) =>
    createCrosswordTicket({
      ticketId: "bronze",
      rewardAmount: 0,
      sessionId: `session-${index + 1}`,
    })
  );
  const sampledFamilyIds = new Set(sampledTickets.map((ticket) => ticket.variantId.split(":")[0]));
  const sampledStructureSignatures = new Set(sampledTickets.map(getTicketStructureSignature));
  const sampledWordSignatures = new Set(sampledTickets.map((ticket) => ticket.words.map((word) => word.text).join("|")));
  assert.ok(sampledFamilyIds.size >= 4);
  assert.ok(sampledStructureSignatures.size >= 4);
  assert.ok(sampledWordSignatures.size >= 8);

  Array.from({ length: 3 }, (_, index) => `dedupe-${index + 1}`).forEach((sessionId) => {
    const ticket = createCrosswordTicket({
      ticketId: "bronze",
      rewardAmount: 0,
      sessionId,
    });
    const wordTexts = ticket.words.map((word) => word.text);
    assert.equal(new Set(wordTexts).size, wordTexts.length);
    assertTicketWordsConnected(ticket);
  });

  const repeatedSeedTicket = createCrosswordTicket({
    ticketId: "bronze",
    rewardAmount: 0,
    sessionId: "session-repeat-check",
    selectionSeed: "seed-repeat-check",
  });
  const noRepeatTicket = createCrosswordTicket({
    ticketId: "bronze",
    rewardAmount: 0,
    sessionId: "session-repeat-check",
    selectionSeed: "seed-repeat-check",
    avoidTemplateFamilyId: repeatedSeedTicket.variantId.split(":")[0],
  });
  assert.notEqual(noRepeatTicket.variantId.split(":")[0], repeatedSeedTicket.variantId.split(":")[0]);

  const premiumTicket = createCrosswordTicket({
    ticketId: "gold",
    rewardAmount: 25000,
    sessionId: "crossword-check-premium",
  });
  const premiumTargetCompletedWords = premiumTicket.prizeTiers.at(-1)?.completedWords ?? premiumTicket.words.length;
  assert.equal(new Set(premiumTicket.letterBank.map((cell) => cell.letter)).size, premiumTicket.letterBank.length);
  assert.equal(premiumTicket.prizeTiers.at(-1)?.completedWords, Math.min(11, premiumTicket.words.length));
  assert.equal(premiumTicket.prizeTiers[0]?.label, "Free Ticket");
  premiumTicket.prizeTiers.forEach((tier, index) => {
    if (index === 0) return;
    assert.equal(tier.rewardAmount > premiumTicket.prizeTiers[index - 1]!.rewardAmount, true);
  });
  const firstPlayableLetterCell = premiumTicket.letterBank.find((letterCell) =>
    premiumTicket.boardCells.some((cell) => cell.isPlayable && cell.letter === letterCell.letter)
  )!;

  let state = createInitialCrosswordGameState();
  state = revealCrosswordLetterCell(premiumTicket, state, firstPlayableLetterCell.id);
  assert.equal(state.revealedLetterBankCellIds.length, 1);
  assert.equal(state.revealedLetters.length, 1);
  assert.equal(state.matchedCellIds.length, 0);

  const boardAfterFirstReveal = selectResolvedCrosswordBoardCells(premiumTicket, state);
  assert.equal(boardAfterFirstReveal.some((cell) => cell.letter === firstPlayableLetterCell.letter && cell.markable), true);

  const lockedBoardCell = premiumTicket.boardCells.find(
    (cell) => cell.isPlayable && cell.letter !== firstPlayableLetterCell.letter
  )!;
  const unchangedFromInvalidMark = markCrosswordBoardCell(premiumTicket, state, lockedBoardCell.id);
  assert.equal(unchangedFromInvalidMark, state);

  const firstAvailableBoardCell = premiumTicket.boardCells.find(
    (cell) => cell.isPlayable && cell.letter === firstPlayableLetterCell.letter
  )!;
  state = markCrosswordBoardCell(premiumTicket, state, firstAvailableBoardCell.id);
  assert.equal(state.matchedCellIds.includes(firstAvailableBoardCell.id), true);

  const revealedAllState = revealAllCrosswordLetterCells(premiumTicket, createInitialCrosswordGameState());
  assert.equal(revealedAllState.revealedLetterBankCellIds.length, premiumTicket.letterBank.length);
  assert.equal(revealedAllState.completedWordCount, 0);

  const checkedAfterRevealAll = checkCrosswordTicket(premiumTicket, revealedAllState);
  assert.equal(checkedAfterRevealAll.completedWordCount, premiumTargetCompletedWords);
  assert.equal(checkedAfterRevealAll.finalPayout, 25000);

  state = playTicketToEnd(premiumTicket);

  assert.equal(state.isComplete, true);
  assert.equal(state.completedWordCount, premiumTargetCompletedWords);
  assert.equal(state.finalPayout, 25000);
  assert.ok(selectCompletedWordTexts(premiumTicket, state).length >= 8);

  const payoutCases = [
    { ticketId: "bronze" as const, rewardAmount: 0, expectedPayout: 0 },
    { ticketId: "bronze" as const, rewardAmount: 10, expectedPayout: 10 },
    { ticketId: "bronze" as const, rewardAmount: 75, expectedPayout: 75 },
    { ticketId: "bronze" as const, rewardAmount: 2500, expectedPayout: 2500 },
    { ticketId: "silver" as const, rewardAmount: 320, expectedPayout: 320 },
    { ticketId: "gold" as const, rewardAmount: 1000, expectedPayout: 1000 },
  ];

  payoutCases.forEach(({ ticketId, rewardAmount, expectedPayout }) => {
    Array.from({ length: 1 }, (_, index) => `${ticketId}-${rewardAmount}-${index + 1}`).forEach((sessionId) => {
      const ticket = createCrosswordTicket({
        ticketId,
        rewardAmount,
        sessionId,
      });
      assert.equal(new Set(ticket.letterBank.map((cell) => cell.letter)).size, ticket.letterBank.length);

      const ticketState = checkCrosswordTicket(ticket, revealAllCrosswordLetterCells(ticket, createInitialCrosswordGameState()));
      assert.equal(ticketState.finalPayout, expectedPayout);

      if (expectedPayout === 0) {
        assert.equal(ticketState.completedWordCount < 3, true);
      } else {
        assert.equal(ticketState.completedWordCount >= 3, true);
      }
      assert.equal(ticketState.completedWordCount <= ticket.words.length, true);
    });
  });

  const rewarded = applyCrosswordRewardGrant(state);
  assert.equal(rewarded.rewardGranted, true);
  const rewardedAgain = applyCrosswordRewardGrant(rewarded, 999);
  assert.equal(rewardedAgain.rewardGranted, true);
  assert.equal(rewardedAgain.finalPayout, rewarded.finalPayout);
}

runChecks();
console.log("Crossword frontend checks passed");
