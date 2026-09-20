import type {
  CrosswordGameState,
  CrosswordTicketData,
  ResolvedCrosswordBoardCell,
  ResolvedCrosswordLetterBankCell,
  ResolvedCrosswordWord,
} from "./crosswordTypes";

export function selectResolvedCrosswordLetterBank(
  ticket: CrosswordTicketData,
  state: CrosswordGameState
): ResolvedCrosswordLetterBankCell[] {
  const revealedIds = new Set(state.revealedLetterBankCellIds);
  return ticket.letterBank.map((cell) => ({
    ...cell,
    revealed: revealedIds.has(cell.id),
  }));
}

export function selectResolvedCrosswordBoardCells(
  ticket: CrosswordTicketData,
  state: CrosswordGameState
): ResolvedCrosswordBoardCell[] {
  const matchedIds = new Set(state.matchedCellIds);
  const revealedLetters = new Set(state.revealedLetters);
  return ticket.boardCells.map((cell) => ({
    ...cell,
    matched: matchedIds.has(cell.id),
    revealedByMatch: matchedIds.has(cell.id),
    markable: cell.isPlayable && revealedLetters.has(cell.letter) && !matchedIds.has(cell.id),
  }));
}

export function selectResolvedCrosswordWords(
  ticket: CrosswordTicketData,
  state: CrosswordGameState
): ResolvedCrosswordWord[] {
  const completedWordIds = new Set(state.completedWordIds);
  return ticket.words.map((word) => ({
    ...word,
    isComplete: completedWordIds.has(word.id),
  }));
}

export function selectCrosswordBoardMatrix(ticket: CrosswordTicketData, state: CrosswordGameState) {
  const resolvedBoard = selectResolvedCrosswordBoardCells(ticket, state);
  const cellByCoordinate = new Map<string, ResolvedCrosswordBoardCell>(
    resolvedBoard.map((cell) => [`${cell.row}:${cell.col}`, cell])
  );

  return Array.from({ length: ticket.boardRows }, (_, row) =>
    Array.from({ length: ticket.boardCols }, (_, col) => cellByCoordinate.get(`${row}:${col}`) ?? null)
  );
}

export function selectCompletedWordTexts(ticket: CrosswordTicketData, state: CrosswordGameState) {
  const completedWordIds = new Set(state.completedWordIds);
  return ticket.words.filter((word) => completedWordIds.has(word.id)).map((word) => word.text);
}
