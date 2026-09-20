"use client";

import { useEffect, useId, useRef, type PointerEventHandler, type RefObject } from "react";
import Image from "next/image";
import {
  formatTheBigScoreVaultNumber,
  getTheBigScoreResultCopy,
  getTheBigScoreWinningTier,
} from "@/lib/the-big-score/theBigScoreLogic";
import type { TheBigScoreGameState, TheBigScoreTicketData } from "@/lib/the-big-score/theBigScoreTypes";
import { TheBigScoreBoardHeader } from "./TheBigScoreBoardHeader";

type TheBigScoreScratchProps = {
  ticket: TheBigScoreTicketData;
  state: TheBigScoreGameState;
  scratchedRatio: number;
  scratchComplete: boolean;
  displayedReward: number;
  buyAgainPending: boolean;
  isDesktopViewport: boolean;
  scratchWrapRef: RefObject<HTMLDivElement | null>;
  scratchCanvasRef: RefObject<HTMLCanvasElement | null>;
  onChooseVaultNumber: (value: number) => void;
  onScratchPointerDown: PointerEventHandler<HTMLDivElement>;
  onScratchPointerMove: PointerEventHandler<HTMLDivElement>;
  onScratchPointerUp: PointerEventHandler<HTMLDivElement>;
  onScratchPointerCancel: PointerEventHandler<HTMLDivElement>;
  onScratchPointerLeave: PointerEventHandler<HTMLDivElement>;
  onBuyAgain: () => void;
  onFinalResultPresented?: (details: { outcome: "win" | "loss" }) => void;
};

const VAULT_CODE_BASE_SRC = "/assets/tickets/the-big-score/screens/vault_code2.png";
const VAULT_CODE_SELECTED_SRC = "/assets/tickets/the-big-score/screens/vault_code5.png";
const THE_BIG_SCORE_VAULT_LOGO_HEADER_HEIGHT = 164;
const BOARD_WIDTH = 1024;
const BOARD_HEIGHT = 1536;
const BEZEL_OUTER_RADIUS = 116;
const BEZEL_INNER_RADIUS = 78;
const GOLD_BEZEL_SOURCE = { x: 264, y: 427 } as const;
const GOLD_BEZEL_OFFSET = { x: 1, y: 3 } as const;
const GOLD_BEZEL_BOTTOM_ROW_OFFSET_Y = -12;

const NUMBER_POSITIONS = [
  { left: "25.8%", top: "27.8%", x: 264, y: 427 },
  { left: "50.1%", top: "27.8%", x: 513, y: 427 },
  { left: "74.4%", top: "27.8%", x: 762, y: 427 },
  { left: "25.8%", top: "44.7%", x: 264, y: 687 },
  { left: "50.1%", top: "44.7%", x: 513, y: 687 },
  { left: "74.4%", top: "44.7%", x: 762, y: 687 },
] as const;
const CODE_WINDOW = { left: "13.2%", top: "61.5%", width: "73.6%", height: "18.8%" } as const;

function getWinningNumberStatus(selectedValues: readonly number[], revealedValues: readonly number[] | null, index: number) {
  if (!revealedValues) return "hidden" as const;
  return selectedValues.includes(revealedValues[index]) ? "hit" : "miss";
}

function VaultDial({
  value,
  style,
  onClick,
}: {
  value: number;
  style: { left: string; top: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute z-[4] aspect-square w-[22.2%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent touch-manipulation"
      style={style}
      aria-pressed={undefined}
    >
      <span className="sr-only">{`Select vault number ${value}`}</span>
      <span className="pointer-events-none absolute inset-[17%] rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(4,12,3,0.98)_0%,rgba(1,8,1,0.94)_40%,rgba(0,0,0,0.995)_84%)] shadow-[inset_0_0_28px_rgba(0,0,0,0.9)]" />
      <span className="pointer-events-none absolute inset-[19%] flex items-center justify-center">
        <span className="-translate-y-[10%] font-mono text-[clamp(2.05rem,4.7vw,3.2rem)] font-black leading-none tracking-[0.04em] text-[#56ef38] [text-shadow:0_0_10px_rgba(110,255,74,0.5)]">
          {formatTheBigScoreVaultNumber(value)}
        </span>
      </span>
    </button>
  );
}

function ControlPanelVaultButton({
  value,
  selected,
  locked,
  onClick,
}: {
  value: number;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative h-full min-h-0 w-full overflow-hidden rounded-[999px] border transition focus-visible:outline-none ${
        selected
          ? "border-[#edcb87]/54 bg-[linear-gradient(180deg,rgba(108,79,43,0.48),rgba(11,9,8,0.97))] shadow-[0_14px_28px_rgba(255,186,73,0.1),inset_0_1px_0_rgba(255,239,194,0.22)] focus-visible:border-[#f2d89e]/60 focus-visible:shadow-[0_0_0_1px_rgba(242,216,158,0.3),0_14px_28px_rgba(255,186,73,0.12)]"
          : locked
            ? "border-[#8b6d3d]/14 bg-[linear-gradient(180deg,rgba(34,27,20,0.74),rgba(10,9,9,0.99))] opacity-[0.88] shadow-[0_8px_16px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,239,194,0.07)] focus-visible:border-[#c9a15d]/24 focus-visible:shadow-[0_0_0_1px_rgba(201,161,93,0.18),0_10px_22px_rgba(0,0,0,0.18)]"
            : "border-[#ab8447]/16 bg-[linear-gradient(180deg,rgba(43,33,24,0.78),rgba(11,9,9,0.985))] shadow-[0_9px_18px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,239,194,0.08)] hover:border-[#d0a863]/24 hover:shadow-[0_12px_22px_rgba(255,186,73,0.06),inset_0_1px_0_rgba(255,239,194,0.12)] focus-visible:border-[#dcbc77]/32 focus-visible:shadow-[0_0_0_1px_rgba(220,188,119,0.2),0_12px_24px_rgba(255,186,73,0.08)]"
      }`}
    >
      <span className="pointer-events-none absolute inset-[4.5%] rounded-full bg-[linear-gradient(180deg,rgba(206,163,95,0.76),rgba(112,81,44,0.98)_34%,rgba(28,21,16,0.995)_72%,rgba(10,9,8,1))] shadow-[inset_0_1px_0_rgba(255,245,214,0.18),inset_0_-12px_26px_rgba(0,0,0,0.34)] transition duration-200 group-hover:shadow-[inset_0_1px_0_rgba(255,245,214,0.2),inset_0_-12px_26px_rgba(0,0,0,0.32)]" />
      <span className="pointer-events-none absolute inset-[6.1%] rounded-full border border-[#2f2012]/52 bg-[linear-gradient(180deg,rgba(139,103,57,0.28),rgba(14,11,9,0.1))]" />
      <span className="pointer-events-none absolute inset-[8.8%] rounded-full border border-[#f0d69e]/7 shadow-[inset_0_1px_0_rgba(255,238,188,0.08)]" />
      <span className="pointer-events-none absolute inset-[12.3%] rounded-full border border-[#f6dfb0]/7 bg-[radial-gradient(circle_at_50%_45%,rgba(14,42,16,0.22),rgba(7,23,8,0.2)_20%,rgba(2,11,5,0.985)_42%,rgba(0,0,0,1)_76%)] shadow-[inset_0_0_34px_rgba(0,0,0,0.86),inset_0_10px_18px_rgba(95,255,110,0.03)]" />
      <span className="pointer-events-none absolute inset-x-[22%] top-[15%] h-[9%] rounded-full bg-[linear-gradient(180deg,rgba(242,205,129,0.24),rgba(242,205,129,0.015))]" />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className={`font-mono text-[clamp(1.8rem,2.35vw,2.55rem)] font-black tracking-[0.08em] ${
          selected
            ? "text-[#9aff7c] [text-shadow:0_0_5px_rgba(110,255,74,0.18)]"
            : locked
              ? "text-[#4ab838] [text-shadow:0_0_4px_rgba(110,255,74,0.1)]"
              : "text-[#5df144] [text-shadow:0_0_5px_rgba(110,255,74,0.13)] group-hover:text-[#71f458]"
        }`}>
          {formatTheBigScoreVaultNumber(value)}
        </span>
      </span>
    </button>
  );
}

function VaultCodeDigit({
  value,
  status,
}: {
  value: number | undefined;
  status: "hidden" | "hit" | "miss";
}) {
  const isHidden = status === "hidden";
  const isHit = status === "hit";

  return (
    <div className="relative flex h-full items-center justify-center">
      <span className="absolute inset-[10%] rounded-[18px] bg-black/55 shadow-[inset_0_0_22px_rgba(0,0,0,0.58)]" />
      <span
        className={`relative font-mono text-[clamp(2.6rem,6vw,5rem)] font-black tracking-[0.08em] ${
          isHidden
            ? "text-[#222924]"
            : isHit
              ? "text-[#58ef39] [text-shadow:0_0_16px_rgba(104,255,74,0.48)]"
              : "text-[#ff3a34] [text-shadow:0_0_16px_rgba(255,82,82,0.42)]"
        }`}
      >
        {isHidden ? "88" : value ? formatTheBigScoreVaultNumber(value) : "--"}
      </span>
    </div>
  );
}

function ResultOverlay({
  ticket,
  state,
  displayedReward,
  scratchComplete,
  buyAgainPending,
  onBuyAgain,
}: {
  ticket: TheBigScoreTicketData;
  state: TheBigScoreGameState;
  displayedReward: number;
  scratchComplete: boolean;
  buyAgainPending: boolean;
  onBuyAgain: () => void;
}) {
  if (!scratchComplete || !state.revealedVaultCombination) return null;

  const resultCopy = getTheBigScoreResultCopy(ticket, state);
  const winningTier = getTheBigScoreWinningTier(ticket, state);
  const isLoss = state.totalWinnings <= 0;
  const amount = isLoss ? "0" : displayedReward.toLocaleString("en-US");

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[linear-gradient(180deg,rgba(8,7,8,0.16),rgba(8,7,8,0.74))] p-3">
      <div
        className={`pointer-events-auto w-full max-w-[438px] rounded-[28px] border px-4 py-4 text-center shadow-[0_30px_90px_rgba(0,0,0,0.5)] sm:px-5 sm:py-5 ${
          isLoss
            ? "border-white/12 bg-[linear-gradient(180deg,rgba(25,15,15,0.96),rgba(10,8,8,0.98))]"
            : winningTier?.id === "trifecta_jackpot"
              ? "border-[#ffe09a]/34 bg-[linear-gradient(180deg,rgba(52,28,11,0.98),rgba(18,10,8,0.98))]"
              : "border-[#ffb871]/28 bg-[linear-gradient(180deg,rgba(46,24,11,0.98),rgba(14,10,8,0.98))]"
        }`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f2d59a]/62">{resultCopy.eyebrow}</div>
        <div className="mt-2 text-[2rem] font-black uppercase leading-[0.92] tracking-[0.06em] text-white sm:text-[2.5rem]">
          {resultCopy.headline}
        </div>
        <div className="mt-2 text-sm leading-5 text-white/62 sm:leading-6">{resultCopy.subhead}</div>

        <div className={`mt-4 rounded-[22px] border px-4 py-4 ${isLoss ? "border-white/10 bg-white/[0.03]" : "border-[#ffe09a]/24 bg-[#ffe09a]/10"}`}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/46">Total Winnings</div>
          <div className="mt-2 text-4xl font-black text-[#fff0bc] sm:text-5xl">{amount}</div>
          <div className="mt-2 text-sm text-white/58">{winningTier ? winningTier.description : "Vault remains sealed."}</div>
        </div>

        <button
          type="button"
          onClick={onBuyAgain}
          disabled={buyAgainPending}
          className="mt-4 w-full rounded-[18px] border border-[#ffe09a]/34 bg-[linear-gradient(135deg,#fff2ba_0%,#ffc65c_38%,#f08d2f_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#26160d] shadow-[0_16px_36px_rgba(255,186,73,0.24)] transition hover:brightness-105 disabled:cursor-default disabled:opacity-45"
        >
          {buyAgainPending ? "Starting..." : "Play Again"}
        </button>
      </div>
    </div>
  );
}

export function TheBigScoreScratch({
  ticket,
  state,
  scratchedRatio,
  scratchComplete,
  displayedReward,
  buyAgainPending,
  isDesktopViewport,
  scratchWrapRef,
  scratchCanvasRef,
  onChooseVaultNumber,
  onScratchPointerDown,
  onScratchPointerMove,
  onScratchPointerUp,
  onScratchPointerCancel,
  onScratchPointerLeave,
  onBuyAgain,
  onFinalResultPresented,
}: TheBigScoreScratchProps) {
  const selectedOrder = state.selectedVaultCodeOrder;
  const scratchArmed = selectedOrder.length === 3;
  const bezelMaskPrefix = useId().replace(/:/g, "-");
  const pickSlots = [selectedOrder[0], selectedOrder[1], selectedOrder[2]];
  const resultPresentedRef = useRef(false);

  useEffect(() => {
    resultPresentedRef.current = false;
  }, [ticket.sessionId]);

  useEffect(() => {
    const resultActive = scratchComplete && Boolean(state.revealedVaultCombination);
    if (!resultActive) {
      resultPresentedRef.current = false;
      return;
    }
    if (resultPresentedRef.current) return;
    resultPresentedRef.current = true;
    onFinalResultPresented?.({ outcome: state.totalWinnings > 0 ? "win" : "loss" });
  }, [onFinalResultPresented, scratchComplete, state.revealedVaultCombination, state.totalWinnings]);

  if (isDesktopViewport) {
    return (
      <section
        className="relative rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_50%_34%,rgba(255,206,108,0.05),transparent_28%),radial-gradient(circle_at_50%_9%,rgba(255,188,79,0.07),transparent_22%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.015),transparent_44%),linear-gradient(180deg,rgba(20,15,13,0.98),rgba(11,9,9,0.992)_54%,rgba(7,7,8,1))] p-4 shadow-[0_24px_84px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,232,183,0.04)] sm:p-5 xl:grid xl:h-[calc(100dvh-6.25rem)] xl:px-2.5 xl:pt-2 xl:pb-2"
        style={{ gridTemplateRows: `${THE_BIG_SCORE_VAULT_LOGO_HEADER_HEIGHT}px minmax(0, 42fr) minmax(0, 8fr) minmax(0, 35fr)` }}
      >
        <div className="flex min-h-0 items-start justify-center">
          <TheBigScoreBoardHeader />
        </div>

        <div className="flex min-h-0 items-stretch justify-center pt-2">
          <div className="flex w-full max-w-[760px] min-h-0 flex-col items-center xl:w-[74%] xl:min-h-0">
            <div className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[#f1d79b]/78 [text-shadow:0_1px_0_rgba(0,0,0,0.35)]">
              Crack the Vault
            </div>
            <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-[#b38b4d]/8 bg-[linear-gradient(180deg,rgba(32,25,20,0.46),rgba(14,10,10,0.76))] px-5 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.14),0_0_10px_rgba(255,194,92,0.018),inset_0_1px_0_rgba(255,235,192,0.04)] xl:px-6 xl:py-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(255,214,122,0.045),transparent_30%),radial-gradient(circle_at_50%_64%,rgba(92,255,110,0.018),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0))]" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.016]">
                <Image
                  src={VAULT_CODE_BASE_SRC}
                  alt=""
                  fill
                  sizes="760px"
                  className="object-cover object-[center_31%] scale-[1.38]"
                  aria-hidden="true"
                />
              </div>

              <div className="relative text-center text-sm font-medium tracking-[0.15em] text-[#f7e1ae]/72 [text-shadow:0_1px_0_rgba(0,0,0,0.34)] xl:text-[0.95rem]">
                Choose 3 Numbers
              </div>

              <div className="relative mt-3 grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-3 xl:gap-3">
                {state.offeredVaultNumbers.map((value) => (
                  <ControlPanelVaultButton
                    key={`desktop-vault-${value}`}
                    value={value}
                    selected={selectedOrder.includes(value)}
                    locked={selectedOrder.length === 3 && !selectedOrder.includes(value)}
                    onClick={() => onChooseVaultNumber(value)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 items-center justify-center pt-3">
          <div className="w-full max-w-[640px] xl:w-[62%] xl:min-h-0">
            <div className="flex h-full min-h-0 flex-col justify-center">
              <div className="grid grid-cols-3 gap-3">
                {pickSlots.map((value, index) => (
                  <div
                    key={`desktop-pick-${index}`}
                    className={`relative flex h-[52px] items-center justify-center overflow-hidden rounded-[18px] border bg-[linear-gradient(180deg,rgba(50,38,27,0.82),rgba(10,9,9,0.98))] shadow-[0_10px_20px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,239,194,0.12),inset_0_0_20px_rgba(0,0,0,0.3)] ${
                      value !== undefined
                        ? scratchArmed
                          ? "border-[#e0bc73]/34"
                          : "border-[#d0a864]/26"
                        : "border-[#c8a25a]/16"
                    }`}
                  >
                    <span className="pointer-events-none absolute inset-x-[17%] top-[12%] h-[13%] rounded-full bg-[linear-gradient(180deg,rgba(235,192,112,0.32),rgba(235,192,112,0.03))]" />
                    <span className="pointer-events-none absolute inset-[7%] rounded-[14px] border border-white/5 bg-[radial-gradient(circle_at_50%_42%,rgba(34,70,30,0.18),rgba(0,0,0,0)_60%)] shadow-[inset_0_0_18px_rgba(0,0,0,0.4)]" />
                    <span className={`font-mono text-[1.82rem] font-black tracking-[0.08em] ${value === undefined ? "text-white/10" : scratchArmed ? "text-[#96ff7e] [text-shadow:0_0_7px_rgba(110,255,74,0.16)]" : "text-[#78f361] [text-shadow:0_0_6px_rgba(110,255,74,0.14)]"}`}>
                      {value === undefined ? "--" : formatTheBigScoreVaultNumber(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 items-stretch justify-center pt-4">
          <div className="w-full min-h-0 max-w-[760px] xl:w-[74%] xl:min-h-0">
            <div className="flex h-full min-h-0 flex-col">
              <div className="relative mt-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[#ddb96f]/22 bg-[linear-gradient(180deg,rgba(52,38,27,0.9),rgba(11,10,10,0.988))] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.22),0_0_18px_rgba(255,194,92,0.022),inset_0_1px_0_rgba(255,232,183,0.14),inset_0_0_18px_rgba(0,0,0,0.34)] xl:min-h-0 xl:flex-1 xl:p-2">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-7 bg-[linear-gradient(180deg,rgba(255,235,192,0.12),rgba(255,235,192,0))]" />
                <div className="pointer-events-none absolute inset-[6px] rounded-[18px] border border-white/5 shadow-[inset_0_0_20px_rgba(0,0,0,0.22)]" />
                <div className="pointer-events-none absolute left-3 top-3 h-2.5 w-2.5 rounded-full border border-[#e7c17b]/40 bg-[radial-gradient(circle_at_35%_35%,rgba(255,238,194,0.9),rgba(191,132,49,0.95)_55%,rgba(70,43,14,1)_100%)] shadow-[0_0_8px_rgba(255,194,92,0.15)]" />
                <div className="pointer-events-none absolute right-3 top-3 h-2.5 w-2.5 rounded-full border border-[#e7c17b]/40 bg-[radial-gradient(circle_at_35%_35%,rgba(255,238,194,0.9),rgba(191,132,49,0.95)_55%,rgba(70,43,14,1)_100%)] shadow-[0_0_8px_rgba(255,194,92,0.15)]" />
                <div className="pointer-events-none absolute bottom-3 left-3 h-2.5 w-2.5 rounded-full border border-[#e7c17b]/40 bg-[radial-gradient(circle_at_35%_35%,rgba(255,238,194,0.9),rgba(191,132,49,0.95)_55%,rgba(70,43,14,1)_100%)] shadow-[0_0_8px_rgba(255,194,92,0.15)]" />
                <div className="pointer-events-none absolute bottom-3 right-3 h-2.5 w-2.5 rounded-full border border-[#e7c17b]/40 bg-[radial-gradient(circle_at_35%_35%,rgba(255,238,194,0.9),rgba(191,132,49,0.95)_55%,rgba(70,43,14,1)_100%)] shadow-[0_0_8px_rgba(255,194,92,0.15)]" />

                <div className="pointer-events-none relative grid min-h-0 flex-1 grid-cols-3 gap-4 xl:gap-4">
                  {[0, 1, 2].map((index) => (
                    <VaultCodeDigit
                      key={`desktop-winning-${index}`}
                      value={state.revealedVaultCombination?.[index]}
                      status={scratchArmed ? getWinningNumberStatus(selectedOrder, state.revealedVaultCombination, index) : "hidden"}
                    />
                  ))}
                </div>

                {!scratchComplete ? (
                  <div
                    ref={scratchWrapRef}
                    className={`absolute inset-x-2 bottom-2 top-2 z-[5] overflow-hidden rounded-[18px] xl:inset-x-2 xl:bottom-2 xl:top-2 ${scratchArmed ? "cursor-crosshair" : "cursor-not-allowed"}`}
                    onPointerDown={onScratchPointerDown}
                    onPointerMove={onScratchPointerMove}
                    onPointerUp={onScratchPointerUp}
                    onPointerCancel={onScratchPointerCancel}
                    onPointerLeave={onScratchPointerLeave}
                  >
                    <canvas ref={scratchCanvasRef} className="absolute inset-0 z-[5] touch-none rounded-[18px]" aria-label="Scratch foil armed for vault code reveal" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <ResultOverlay
          ticket={ticket}
          state={state}
          displayedReward={displayedReward}
          scratchComplete={scratchComplete}
          buyAgainPending={buyAgainPending}
          onBuyAgain={onBuyAgain}
        />
      </section>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-[#f0c66c]/14 bg-[radial-gradient(circle_at_top,rgba(255,217,124,0.18),transparent_30%),radial-gradient(circle_at_100%_0%,rgba(255,77,77,0.12),transparent_26%),linear-gradient(180deg,#090606_0%,#120907_42%,#0b090c_100%)] p-4 shadow-[0_36px_120px_rgba(0,0,0,0.5)] sm:p-5">
      <div className="flex min-h-full items-center justify-center">
        <div className="relative mx-auto w-full max-w-[420px] sm:max-w-[460px] lg:max-w-[480px]">
          <div className="relative aspect-[2/3] overflow-hidden rounded-[30px] border border-[#f0c66c]/16 bg-[#090909] shadow-[0_28px_84px_rgba(0,0,0,0.38)]">
            <Image
              src={VAULT_CODE_BASE_SRC}
              alt="Vault console scratch board"
              fill
              priority
              sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 560px, 600px"
              className="object-contain"
            />

            <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                {NUMBER_POSITIONS.map((position, index) => (
                  <mask key={`bezel-mask-${index}`} id={`${bezelMaskPrefix}-${index}`}>
                    <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="black" />
                    <circle cx={position.x} cy={position.y} r={BEZEL_OUTER_RADIUS} fill="white" />
                    <circle cx={position.x} cy={position.y} r={BEZEL_INNER_RADIUS} fill="black" />
                  </mask>
                ))}
              </defs>

              {state.offeredVaultNumbers.map((value, index) =>
                selectedOrder.includes(value) ? (
                  <image
                    key={`selected-bezel-${value}`}
                    href={VAULT_CODE_SELECTED_SRC}
                    x={NUMBER_POSITIONS[index]!.x - GOLD_BEZEL_SOURCE.x + GOLD_BEZEL_OFFSET.x}
                    y={
                      NUMBER_POSITIONS[index]!.y -
                      GOLD_BEZEL_SOURCE.y +
                      GOLD_BEZEL_OFFSET.y +
                      (index >= 3 ? GOLD_BEZEL_BOTTOM_ROW_OFFSET_Y : 0)
                    }
                    width={BOARD_WIDTH}
                    height={BOARD_HEIGHT}
                    preserveAspectRatio="none"
                    mask={`url(#${bezelMaskPrefix}-${index})`}
                  />
                ) : null
              )}
            </svg>

            {state.offeredVaultNumbers.map((value, index) => (
              <VaultDial
                key={value}
                value={value}
                style={NUMBER_POSITIONS[index]!}
                onClick={() => onChooseVaultNumber(value)}
              />
            ))}

            <div className="pointer-events-none absolute z-[2] grid grid-cols-3 gap-[2.6%]" style={CODE_WINDOW}>
              {[0, 1, 2].map((index) => (
                <VaultCodeDigit
                  key={`winning-${index}`}
                  value={state.revealedVaultCombination?.[index]}
                  status={scratchArmed ? getWinningNumberStatus(selectedOrder, state.revealedVaultCombination, index) : "hidden"}
                />
              ))}
            </div>

            {!scratchComplete ? (
              <div
                ref={scratchWrapRef}
                className={`absolute z-[5] overflow-hidden rounded-[22px] ${scratchArmed ? "cursor-crosshair" : "cursor-not-allowed"}`}
                style={CODE_WINDOW}
                onPointerDown={onScratchPointerDown}
                onPointerMove={onScratchPointerMove}
                onPointerUp={onScratchPointerUp}
                onPointerCancel={onScratchPointerCancel}
                onPointerLeave={onScratchPointerLeave}
              >
                <canvas ref={scratchCanvasRef} className="absolute inset-0 z-[5] touch-none rounded-[22px]" aria-label="Scratch foil armed for vault code reveal" />
              </div>
            ) : null}

            <div className="absolute left-[14.5%] top-[58.6%] z-[3] rounded-full border border-[#c38d42]/18 bg-black/28 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#f0d7a3]/58 sm:text-[10px]">
              {scratchArmed ? `${Math.round(scratchedRatio * 100)}% scratched` : "Pick 3 Numbers"}
            </div>

            <ResultOverlay
              ticket={ticket}
              state={state}
              displayedReward={displayedReward}
              scratchComplete={scratchComplete}
              buyAgainPending={buyAgainPending}
              onBuyAgain={onBuyAgain}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
