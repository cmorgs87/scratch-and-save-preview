"use client";

import type { ResolvedCrosswordLetterBankCell } from "@/lib/crossword/crosswordTypes";

type CrosswordLetterBankProps = {
  cells: ResolvedCrosswordLetterBankCell[];
  disabled?: boolean;
  onRevealLetter: (cellId: string) => void;
};

export function CrosswordLetterBank({ cells, disabled = false, onRevealLetter }: CrosswordLetterBankProps) {
  return (
    <div className="grid grid-cols-9 gap-[3px] sm:gap-1">
      {cells.map((cell, index) => {
        const isDisabled = disabled || cell.revealed;
        return (
          <button
            key={cell.id}
            type="button"
            aria-label={cell.revealed ? `Letter ${cell.letter} revealed` : `Reveal letter ${index + 1}`}
            disabled={isDisabled}
            onClick={() => onRevealLetter(cell.id)}
            onPointerDown={(event) => event.stopPropagation()}
            className={`group relative aspect-square overflow-hidden rounded-[2px] border text-center transition duration-200 ${
              cell.revealed
                ? "border-[#7b7f84] bg-[linear-gradient(180deg,#ffffff,#ececec)] text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                : "border-[#7cc0eb] bg-[linear-gradient(180deg,#3d91ca,#3488c3)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] hover:brightness-105"
            } touch-manipulation disabled:cursor-default disabled:opacity-100`}
          >
            <div
              className={`absolute inset-[6%] rounded-[1px] ${
                cell.revealed ? "border border-black/10 bg-white/55" : "border border-white/25 bg-white/8"
              }`}
            />
            {cell.revealed ? (
              <div className="relative z-10 flex h-full items-center justify-center text-base font-black tracking-[0.16em] text-[#202225] sm:text-xl">
                {cell.letter}
              </div>
            ) : (
              <div className="relative z-10 flex h-full items-center justify-center">
                <div className="h-[58%] w-[58%] rounded-[1px] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
