"use client";

import type { ResolvedCrosswordBoardCell } from "@/lib/crossword/crosswordTypes";

type CrosswordBoardProps = {
  boardRows: number;
  boardCols: number;
  matrix: Array<Array<ResolvedCrosswordBoardCell | null>>;
  completedWordIds: string[];
  disabled?: boolean;
  onMarkCell: (cellId: string) => void;
};

export function CrosswordBoard({
  boardRows,
  boardCols,
  matrix,
  completedWordIds,
  disabled = false,
  onMarkCell,
}: CrosswordBoardProps) {
  const completedWordIdSet = new Set(completedWordIds);
  const compactSquareBoard = boardCols <= 5 && boardRows <= 5;
  const denseBoard = boardCols >= 7 || boardRows >= 6;
  const tallBoard = boardRows >= 13;
  const boardWidthClass = tallBoard
    ? "max-w-[760px]"
    : denseBoard
      ? "max-w-[720px]"
      : compactSquareBoard
        ? "max-w-[620px]"
        : "max-w-[500px]";
  const letterClass = denseBoard
    ? "text-[0.84rem] sm:text-[1rem]"
    : compactSquareBoard
      ? "text-[1.08rem] sm:text-[1.28rem]"
      : "text-[0.98rem] sm:text-[1.08rem]";
  const clueNumbers = buildClueNumbers(matrix, boardRows, boardCols);

  return (
    <div
      className={`mx-auto grid w-full ${boardWidthClass} gap-px rounded-[2px] border-[2px] border-[#111111] bg-[#111111] p-px shadow-[0_10px_18px_rgba(0,0,0,0.16)]`}
      style={{ gridTemplateColumns: `repeat(${boardCols}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Crossword board"
    >
      {Array.from({ length: boardRows * boardCols }, (_, index) => {
        const row = Math.floor(index / boardCols);
        const col = index % boardCols;
        const cell = matrix[row]?.[col] ?? null;

        if (!cell) {
          return (
            <div
              key={`blocked-${row}-${col}`}
              className="aspect-square bg-[#121212] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
              aria-hidden="true"
            />
          );
        }

        const partOfCompletedWord = cell.wordIds.some((wordId) => completedWordIdSet.has(wordId));
        const isDisabled = disabled || cell.matched || !cell.markable;
        const clueNumber = clueNumbers.get(`${row}:${col}`);
        const cellLabel = cell.matched
          ? `Row ${row + 1}, column ${col + 1}, letter ${cell.letter}, marked`
          : cell.markable
            ? `Row ${row + 1}, column ${col + 1}, letter ${cell.letter}, tap to mark`
            : `Row ${row + 1}, column ${col + 1}, letter ${cell.letter}, locked until revealed`;

        return (
          <button
            key={cell.id}
            type="button"
            role="gridcell"
            aria-label={cellLabel}
            disabled={isDisabled}
            onClick={() => onMarkCell(cell.id)}
            onPointerDown={(event) => event.stopPropagation()}
            className={`relative aspect-square transition ${
              cell.matched
                ? "bg-[linear-gradient(180deg,#f8e09a,#efc54e)] text-slate-950"
                : "bg-[linear-gradient(180deg,#fcfcfc,#e1e1e1)] text-slate-800"
            } ${
              partOfCompletedWord
                ? "shadow-[inset_0_0_0_2px_rgba(39,160,74,0.95),0_0_0_1px_rgba(39,160,74,0.35)]"
                : ""
            } ${
              cell.markable ? "cursor-pointer active:brightness-95" : "cursor-default"
            } disabled:opacity-100`}
          >
            <div className="absolute inset-[7%] border border-black/8 bg-white/10" />
            {clueNumber ? (
              <div className="absolute left-[8%] top-[7%] z-10 text-[0.43rem] font-bold leading-none text-[#60646c] sm:text-[0.5rem]">
                {clueNumber}
              </div>
            ) : null}
            <div className={`relative z-10 flex h-full items-center justify-center font-serif font-black tracking-[0.06em] text-[#1f2328] ${letterClass}`}>
              {cell.letter}
            </div>
            {cell.matched ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.36),transparent_58%)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function buildClueNumbers(
  matrix: Array<Array<ResolvedCrosswordBoardCell | null>>,
  boardRows: number,
  boardCols: number
) {
  const numbers = new Map<string, number>();
  let nextNumber = 1;

  for (let row = 0; row < boardRows; row += 1) {
    for (let col = 0; col < boardCols; col += 1) {
      const cell = matrix[row]?.[col] ?? null;
      if (!cell) continue;

      const startsAcross = isWordStart(matrix, row, col, 0, 1);
      const startsDown = isWordStart(matrix, row, col, 1, 0);

      if (startsAcross || startsDown) {
        numbers.set(`${row}:${col}`, nextNumber);
        nextNumber += 1;
      }
    }
  }

  return numbers;
}

function isWordStart(
  matrix: Array<Array<ResolvedCrosswordBoardCell | null>>,
  row: number,
  col: number,
  rowStep: number,
  colStep: number
) {
  const previousCell = matrix[row - rowStep]?.[col - colStep] ?? null;
  const nextCell = matrix[row + rowStep]?.[col + colStep] ?? null;
  return !previousCell && !!nextCell;
}
