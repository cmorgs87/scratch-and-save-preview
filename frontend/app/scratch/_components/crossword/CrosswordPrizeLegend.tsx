"use client";

import type { CrosswordPrizeTier } from "@/lib/crossword/crosswordTypes";

type CrosswordPrizeLegendProps = {
  prizeTiers: CrosswordPrizeTier[];
  completedWords: number;
  highlightedCompletedWords: number | null;
};

export function CrosswordPrizeLegend({
  prizeTiers,
  completedWords,
  highlightedCompletedWords,
}: CrosswordPrizeLegendProps) {
  const rowPalette = [
    "bg-[#56b7ea]",
    "bg-[#151515]",
    "bg-[#ff2240]",
    "bg-[#151515]",
    "bg-[#56b7ea]",
    "bg-[#151515]",
    "bg-[#ff2240]",
    "bg-[#151515]",
    "bg-[#56b7ea]",
  ];

  return (
    <div className="overflow-hidden rounded-[4px] border-[2px] border-neutral-900 bg-[#ffe129] shadow-[0_10px_20px_rgba(0,0,0,0.14)]">
      {prizeTiers.map((tier, index) => {
        const isReached = completedWords >= tier.completedWords;
        const isHighlighted = highlightedCompletedWords === tier.completedWords;
        return (
          <div
            key={`legend-${tier.completedWords}`}
            className={`flex items-center justify-between gap-2 border-b border-black/20 px-2 py-1.5 text-white transition ${
              rowPalette[index % rowPalette.length]
            } ${isHighlighted ? "ring-4 ring-inset ring-yellow-300" : ""} ${isReached ? "brightness-110" : ""}`}
          >
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.04em] sm:text-[0.88rem]">{tier.completedWords} Words</div>
            </div>
            <div className="text-[0.95rem] font-black sm:text-[1.2rem]">{tier.rewardAmount.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}
