"use client";

import { useEffect, useState } from "react";
import { selectCrosswordBoardMatrix, selectResolvedCrosswordLetterBank } from "@/lib/crossword/crosswordSelectors";
import type { CrosswordGameState, CrosswordTicketData } from "@/lib/crossword/crosswordTypes";
import { CrosswordBoard } from "./CrosswordBoard";
import { CrosswordLetterBank } from "./CrosswordLetterBank";

type CrosswordGameScreenProps = {
  ticket: CrosswordTicketData;
  state: CrosswordGameState;
  claimPending?: boolean;
  playAgainPending?: boolean;
  onRevealLetter: (cellId: string) => void;
  onMarkBoardCell: (cellId: string) => void;
  onRevealAll: () => void;
  onCheckTicket: () => void;
  onPlayAgain: () => void;
};

export function CrosswordGameScreen({
  ticket,
  state,
  claimPending = false,
  playAgainPending = false,
  onRevealLetter,
  onMarkBoardCell,
  onRevealAll,
  onCheckTicket,
  onPlayAgain,
}: CrosswordGameScreenProps) {
  const resolvedLetterBank = selectResolvedCrosswordLetterBank(ticket, state);
  const boardMatrix = selectCrosswordBoardMatrix(ticket, state);
  const hasHiddenLetters = resolvedLetterBank.some((cell) => !cell.revealed);
  const hasMarkableCells = boardMatrix.some((row) => row.some((cell) => cell?.markable));
  const completedWordSummary = ticket.words.filter((word) => state.completedWordIds.includes(word.id));
  const showResultCard = state.isComplete && state.rewardGranted;

  return (
    <div
      className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-[18px] border-[2px] border-[#ddc9a3] bg-[#fbf7ec] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-3"
      style={{
        backgroundImage:
          "linear-gradient(rgba(120,95,67,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(120,95,67,0.11) 1px, transparent 1px), linear-gradient(180deg, #fbf7ec 0%, #f5eedf 100%)",
        backgroundSize: "24px 24px, 24px 24px, 100% 100%",
      }}
    >
      <div className="rounded-[12px] border border-black/15 bg-[#fffdf7]/84 p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="text-center">
            <div className="-ml-[0.06em] text-[3rem] font-black uppercase leading-none tracking-[-0.03em] text-[#f4102b] [text-shadow:2px_2px_0_rgba(255,255,255,0.82),5px_5px_0_rgba(30,30,30,0.82)] sm:text-[4.5rem]">
              Crossword
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-[9px] font-black uppercase leading-5 tracking-[0.11em] text-slate-900 sm:text-[10px]">
              Scratch only the letters in the crossword grid that match those in the your letters box. Complete 3 or more
              words and win the prize shown in the prize legend.
            </p>
          </div>

          <section className="rounded-[6px] border-[2px] border-[#2d78aa] bg-[#4ea7dd] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] sm:px-5">
            <div className="text-center text-[1.22rem] font-black uppercase tracking-[0.08em] text-[#ef2339] [text-shadow:1px_1px_0_rgba(255,255,255,0.75),2px_2px_0_rgba(27,72,126,0.34)] sm:text-[1.7rem]">
              Your Letters
            </div>
            <div className="mt-3 rounded-[2px] border-[2px] border-[#dfebf5] bg-[#3f9bd4] p-2 sm:p-3">
              <CrosswordLetterBank cells={resolvedLetterBank} disabled={claimPending} onRevealLetter={onRevealLetter} />
            </div>
          </section>

          <div className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700">
            {state.isComplete
              ? state.finalPayout > 0
                ? `Completed ${state.completedWordCount} words for ${state.finalPayout.toLocaleString()}.`
                : "All letters were revealed, but the completed-word total did not reach a prize tier."
              : completedWordSummary.length
                ? `Completed so far: ${completedWordSummary.map((word) => word.text).join(", ")}.`
                : "Reveal letters, then tap the matching spaces on the board to complete words."}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRevealAll}
              disabled={claimPending || state.isComplete || !hasHiddenLetters}
              className="rounded-[4px] border border-[#b32734] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#b32734] transition hover:bg-[#fff3f4] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Reveal All
            </button>
            <button
              type="button"
              onClick={onCheckTicket}
              disabled={claimPending || state.isComplete || !hasMarkableCells}
              className="rounded-[4px] bg-[#1f8a43] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#187038] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Check Ticket
            </button>
          </div>

          <div className="rounded-[4px] border-[2px] border-neutral-900 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,239,225,0.9))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.66)] sm:p-3">
            <CrosswordBoard
              boardRows={ticket.boardRows}
              boardCols={ticket.boardCols}
              matrix={boardMatrix}
              completedWordIds={state.completedWordIds}
              disabled={claimPending}
              onMarkCell={onMarkBoardCell}
            />
          </div>
        </div>
      </div>

      {showResultCard ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(15,23,42,0.36))]" />
          <div className="relative w-full max-w-[360px] sm:max-w-[420px]">
            <CrosswordResultCard
              key={`${ticket.sessionId}:${ticket.variantId}:${state.finalPayout}`}
              completedWordCount={state.completedWordCount}
              prizeAmount={state.finalPayout}
              playAgainPending={playAgainPending}
              onPlayAgain={onPlayAgain}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CrosswordResultCard({
  completedWordCount,
  prizeAmount,
  playAgainPending,
  onPlayAgain,
}: {
  completedWordCount: number;
  prizeAmount: number;
  playAgainPending: boolean;
  onPlayAgain: () => void;
}) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const isWinner = prizeAmount > 0;
  const shownAmount = isWinner ? displayAmount : 0;

  useEffect(() => {
    if (!isWinner) return;

    const durationMs = 1450;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Math.round(prizeAmount * eased));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isWinner, prizeAmount]);

  return (
    <div
      className={`pointer-events-auto rounded-[8px] border-[2px] px-4 py-4 text-center shadow-[0_12px_24px_rgba(114,72,8,0.18),inset_0_1px_0_rgba(255,255,255,0.72)] ${
        isWinner
          ? "border-[#d7ab2f] bg-[linear-gradient(180deg,#fff8d4,#f7dc75_52%,#f0c53e)]"
          : "border-[#c9c1ad] bg-[linear-gradient(180deg,#fffdf7,#f0eadc_56%,#ddd4bf)]"
      }`}
    >
      <div className={`text-[0.7rem] font-black uppercase tracking-[0.28em] sm:text-[0.78rem] ${isWinner ? "text-[#7a4a07]" : "text-[#575044]"}`}>
        {isWinner ? "Winning Ticket" : "Not A Winner"}
      </div>
      <div
        className={`mt-2 font-black leading-none tracking-[-0.04em] sm:text-[3.3rem] ${
          isWinner
            ? "text-[2.25rem] text-[#b51d1d] [text-shadow:1px_1px_0_rgba(255,255,255,0.75),3px_3px_0_rgba(88,45,0,0.18)]"
            : "text-[1.7rem] text-[#454038]"
        }`}
      >
        {shownAmount.toLocaleString()}
      </div>
      <div className={`mt-2 text-[0.72rem] font-black uppercase tracking-[0.16em] sm:text-[0.8rem] ${isWinner ? "text-[#5d3b08]" : "text-[#625a4f]"}`}>
        {isWinner ? `${completedWordCount} words completed` : "No prize on this ticket"}
      </div>
      <button
        type="button"
        onClick={onPlayAgain}
        disabled={playAgainPending}
        className="mt-4 w-full rounded-[4px] border border-[#b32734] bg-white px-3 py-3 text-xs font-black uppercase tracking-[0.2em] text-[#b32734] transition hover:bg-[#fff3f4] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {playAgainPending ? "Starting..." : "Play Again"}
      </button>
    </div>
  );
}
