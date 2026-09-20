import type {
  CrosswordGameState,
  CrosswordPrizeTier,
  CrosswordTicketData,
} from "./crosswordTypes";

export function createInitialCrosswordGameState(): CrosswordGameState {
  return {
    version: 1,
    revealedLetterBankCellIds: [],
    revealedLetters: [],
    matchedCellIds: [],
    completedWordIds: [],
    completedWordCount: 0,
    isComplete: false,
    rewardGranted: false,
    finalPayout: 0,
    finalPrizeTier: null,
    lastRevealedLetterCellId: null,
    lastMatchedCellIds: [],
    newlyCompletedWordIds: [],
  };
}

export function resolveCrosswordPrizeTier(
  prizeTiers: readonly CrosswordPrizeTier[],
  completedWords: number
): CrosswordPrizeTier | null {
  return (
    [...prizeTiers]
      .sort((left, right) => left.completedWords - right.completedWords)
      .filter((tier) => completedWords >= tier.completedWords)
      .at(-1) ?? null
  );
}

function computeCompletedWordIds(ticket: CrosswordTicketData, matchedCellIds: readonly string[]) {
  return ticket.words
    .filter((word) => word.cellIds.every((cellId) => matchedCellIds.includes(cellId)))
    .map((word) => word.id);
}

function hasUnmarkedAvailableCells(ticket: CrosswordTicketData, revealedLetters: readonly string[], matchedCellIds: readonly string[]) {
  return ticket.boardCells.some(
    (cell) => cell.isPlayable && revealedLetters.includes(cell.letter) && !matchedCellIds.includes(cell.id)
  );
}

function recomputeCrosswordProgress(
  ticket: CrosswordTicketData,
  state: CrosswordGameState,
  nextState: CrosswordGameState
): CrosswordGameState {
  const nextCompletedWordIds = computeCompletedWordIds(ticket, nextState.matchedCellIds);
  const previousCompletedWordIdSet = new Set(state.completedWordIds);
  const newlyCompletedWordIds = nextCompletedWordIds.filter((wordId) => !previousCompletedWordIdSet.has(wordId));
  const isComplete =
    nextState.revealedLetterBankCellIds.length === ticket.letterBank.length &&
    !hasUnmarkedAvailableCells(ticket, nextState.revealedLetters, nextState.matchedCellIds);
  const finalPrizeTier = isComplete ? resolveCrosswordPrizeTier(ticket.prizeTiers, nextCompletedWordIds.length) : null;

  return {
    ...nextState,
    completedWordIds: nextCompletedWordIds,
    completedWordCount: nextCompletedWordIds.length,
    isComplete,
    finalPrizeTier,
    finalPayout: isComplete ? finalPrizeTier?.rewardAmount ?? 0 : 0,
    newlyCompletedWordIds,
    rewardGranted: isComplete ? nextState.rewardGranted : false,
  };
}

export function revealCrosswordLetterCell(
  ticket: CrosswordTicketData,
  state: CrosswordGameState,
  letterBankCellId: string
): CrosswordGameState {
  const letterBankCell = ticket.letterBank.find((cell) => cell.id === letterBankCellId);
  if (!letterBankCell) return state;
  if (state.revealedLetterBankCellIds.includes(letterBankCellId)) return state;

  return recomputeCrosswordProgress(ticket, state, {
    ...state,
    revealedLetterBankCellIds: [...state.revealedLetterBankCellIds, letterBankCellId],
    revealedLetters: Array.from(new Set([...state.revealedLetters, letterBankCell.letter])),
    lastRevealedLetterCellId: letterBankCellId,
    lastMatchedCellIds: [],
  });
}

export function markCrosswordBoardCell(
  ticket: CrosswordTicketData,
  state: CrosswordGameState,
  boardCellId: string
): CrosswordGameState {
  const boardCell = ticket.boardCells.find((cell) => cell.id === boardCellId);
  if (!boardCell || !boardCell.isPlayable) return state;
  if (state.matchedCellIds.includes(boardCellId)) return state;
  if (!state.revealedLetters.includes(boardCell.letter)) return state;

  return recomputeCrosswordProgress(ticket, state, {
    ...state,
    matchedCellIds: [...state.matchedCellIds, boardCellId],
    lastMatchedCellIds: [boardCellId],
  });
}

export function revealAllCrosswordLetterCells(ticket: CrosswordTicketData, state: CrosswordGameState): CrosswordGameState {
  return ticket.letterBank.reduce((current, cell) => revealCrosswordLetterCell(ticket, current, cell.id), state);
}

export function checkCrosswordTicket(ticket: CrosswordTicketData, state: CrosswordGameState): CrosswordGameState {
  const nextMatchedCellIds = Array.from(
    new Set([
      ...state.matchedCellIds,
      ...ticket.boardCells
        .filter((cell) => cell.isPlayable && state.revealedLetters.includes(cell.letter))
        .map((cell) => cell.id),
    ])
  );

  if (nextMatchedCellIds.length === state.matchedCellIds.length) {
    return state;
  }

  const lastMatchedCellIds = nextMatchedCellIds.filter((cellId) => !state.matchedCellIds.includes(cellId));

  return recomputeCrosswordProgress(ticket, state, {
    ...state,
    matchedCellIds: nextMatchedCellIds,
    lastMatchedCellIds,
  });
}

export function applyCrosswordRewardGrant(
  state: CrosswordGameState,
  rewardAmount = state.finalPayout
): CrosswordGameState {
  if (state.rewardGranted) return state;

  return {
    ...state,
    rewardGranted: true,
    finalPayout: rewardAmount,
  };
}
