"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  REEL_REVEAL_COUNT_UP_MS,
  REEL_REVEAL_REEL_SPIN_INTERVAL_MS,
  REEL_REVEAL_REEL_STOP_DELAYS_MS,
  REEL_REVEAL_SYMBOLS,
  createInitialReelRevealGameState,
} from "@/lib/reel-reveal/reelRevealConfig";
import {
  beginReelRevealSpin,
  completeReelRevealGame,
  stopReelRevealReel,
  updateReelRevealReelIndex,
  updateReelRevealScratchProgress,
} from "@/lib/reel-reveal/reelRevealEngine";
import type { ReelRevealSymbolId, ReelRevealTicketData } from "@/lib/reel-reveal/reelRevealTypes";

type ReelRevealGameScreenProps = {
  ticket: ReelRevealTicketData;
  buyAgainPending: boolean;
  onBuyAgain: () => void;
  onFinalResultPresented?: (details: { outcome: "win" | "loss" }) => void;
};

const SCRATCH_GRID_COLS = 24;
const SCRATCH_GRID_ROWS = 14;
const SCRATCH_BRUSH_RADIUS = 0.12;
const REEL_REVEAL_SCRATCH_FOIL_SRC = "/reel-reveal/reel_reveal_scratch_foil.png";
const REEL_REVEAL_SCRATCH_FOIL_ALPHA_THRESHOLD = 8;

type ReelRevealFoilBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US");
}

function getVisibleSymbols(strip: ReelRevealSymbolId[], index: number) {
  const length = strip.length;
  const current = ((index % length) + length) % length;
  const previous = (current - 1 + length) % length;
  const next = (current + 1) % length;
  return [strip[previous], strip[current], strip[next]] as const;
}

function getPayoutRowClasses(style: string, highlighted: boolean) {
  const base =
    style === "jackpot"
      ? "from-[#fed95a] via-[#ffba23] to-[#ff7e21] text-[#1a1325]"
      : style === "ruby"
        ? "from-[#ff4d7f] via-[#ff315d] to-[#cf173e] text-white"
        : style === "gold"
          ? "from-[#f7d46b] via-[#efb635] to-[#c57a11] text-[#1b1321]"
          : style === "violet"
            ? "from-[#6848ff] via-[#8948ff] to-[#b447ff] text-white"
            : "from-[#53d7ff] via-[#3ca7ff] to-[#2f6eff] text-white";

  return `${base} ${highlighted ? "ring-2 ring-white/80 shadow-[0_0_24px_rgba(255,255,255,0.28)]" : "opacity-95"}`;
}

function getOpaqueImageBounds(image: HTMLImageElement) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < REEL_REVEAL_SCRATCH_FOIL_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  } satisfies ReelRevealFoilBounds;
}

export function ReelRevealGameScreen({
  ticket,
  buyAgainPending,
  onBuyAgain,
  onFinalResultPresented,
}: ReelRevealGameScreenProps) {
  const [gameState, setGameState] = useState(() => createInitialReelRevealGameState(ticket));
  const [countUpValue, setCountUpValue] = useState(0);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchWrapRef = useRef<HTMLDivElement | null>(null);
  const scratchFoilImageRef = useRef<HTMLImageElement | null>(null);
  const scratchFoilBoundsRef = useRef<ReelRevealFoilBounds | null>(null);
  const scratchingRef = useRef(false);
  const scratchedCellsRef = useRef<Set<string>>(new Set());
  const reelIntervalsRef = useRef<Array<number | null>>([]);
  const reelStopTimeoutsRef = useRef<number[]>([]);
  const settleTimeoutRef = useRef<number | null>(null);
  const autoSpinTimeoutRef = useRef<number | null>(null);
  const resultPresentedRef = useRef(false);

  const winningRowId = ticket.spinOutcome.payoutRowId;
  const isWin = ticket.rewardAmount > 0;
  const showResultOverlay = gameState.phase === "win" || gameState.phase === "lose" || gameState.phase === "complete";
  const canScratch = !gameState.scratchComplete && !gameState.spinStarted;
  const canSpin = gameState.scratchComplete && !gameState.spinStarted;
  const isSpinning = gameState.phase === "spinning";

  const clearSpinTimers = useCallback(() => {
    reelIntervalsRef.current.forEach((intervalId) => {
      if (intervalId !== null) window.clearInterval(intervalId);
    });
    reelIntervalsRef.current = [];
    reelStopTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    reelStopTimeoutsRef.current = [];
    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    if (autoSpinTimeoutRef.current !== null) {
      window.clearTimeout(autoSpinTimeoutRef.current);
      autoSpinTimeoutRef.current = null;
    }
  }, []);

  const drawFoil = useCallback(() => {
    const canvas = scratchCanvasRef.current;
    const wrap = scratchWrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const foilImage = scratchFoilImageRef.current;
    const foilBounds = scratchFoilBoundsRef.current;
    if (foilImage?.complete && foilImage.naturalWidth > 0 && foilBounds) {
      ctx.drawImage(foilImage, foilBounds.x, foilBounds.y, foilBounds.width, foilBounds.height, 0, 0, rect.width, rect.height);
      return;
    }

    const foil = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    foil.addColorStop(0, "#f8f1ff");
    foil.addColorStop(0.18, "#dbd0f3");
    foil.addColorStop(0.48, "#a7aec9");
    foil.addColorStop(0.82, "#5b557d");
    foil.addColorStop(1, "#2a2344");
    ctx.fillStyle = foil;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const shimmer = ctx.createLinearGradient(-rect.width * 0.3, 0, rect.width * 1.2, rect.height);
    shimmer.addColorStop(0, "rgba(255,255,255,0)");
    shimmer.addColorStop(0.45, "rgba(255,255,255,0.58)");
    shimmer.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 1.25;
    for (let index = 1; index < 4; index += 1) {
      const x = (rect.width / 4) * index;
      ctx.beginPath();
      ctx.moveTo(x, rect.height * 0.1);
      ctx.lineTo(x, rect.height * 0.9);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "700 14px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH TO REVEAL THE REELS", rect.width / 2, rect.height / 2 + 6);
  }, []);

  useEffect(() => {
    resultPresentedRef.current = false;
  }, [ticket.sessionId]);

  useEffect(() => {
    if (!showResultOverlay) {
      resultPresentedRef.current = false;
      return;
    }
    if (resultPresentedRef.current) return;
    resultPresentedRef.current = true;
    onFinalResultPresented?.({ outcome: isWin ? "win" : "loss" });
  }, [isWin, onFinalResultPresented, showResultOverlay]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const foilImage = new window.Image();
    foilImage.src = REEL_REVEAL_SCRATCH_FOIL_SRC;
    foilImage.onload = () => {
      scratchFoilImageRef.current = foilImage;
      scratchFoilBoundsRef.current = getOpaqueImageBounds(foilImage);
      drawFoil();
    };
    scratchFoilImageRef.current = foilImage;

    return () => {
      if (scratchFoilImageRef.current === foilImage) {
        scratchFoilImageRef.current = null;
        scratchFoilBoundsRef.current = null;
      }
    };
  }, [drawFoil]);

  useEffect(() => {
    if (gameState.scratchComplete) {
      const canvas = scratchCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    drawFoil();
    const handleResize = () => drawFoil();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [drawFoil, gameState.scratchComplete]);

  useEffect(() => {
    clearSpinTimers();
    return () => clearSpinTimers();
  }, [clearSpinTimers]);

  useEffect(() => {
    if ((gameState.phase !== "win" && gameState.phase !== "complete") || ticket.rewardAmount <= 0) return;

    let rafId = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / REEL_REVEAL_COUNT_UP_MS);
      setCountUpValue(Math.round(ticket.rewardAmount * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    rafId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(rafId);
  }, [gameState.phase, ticket.rewardAmount]);

  const scratchAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = scratchWrapRef.current;
      const canvas = scratchCanvasRef.current;
      if (!wrap || !canvas) return;

      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const normalizedX = x / rect.width;
      const normalizedY = y / rect.height;
      const radiusCellsX = Math.max(1, Math.ceil(SCRATCH_BRUSH_RADIUS * SCRATCH_GRID_COLS));
      const radiusCellsY = Math.max(1, Math.ceil(SCRATCH_BRUSH_RADIUS * SCRATCH_GRID_ROWS));
      const centerCol = Math.floor(normalizedX * SCRATCH_GRID_COLS);
      const centerRow = Math.floor(normalizedY * SCRATCH_GRID_ROWS);

      for (let row = centerRow - radiusCellsY; row <= centerRow + radiusCellsY; row += 1) {
        if (row < 0 || row >= SCRATCH_GRID_ROWS) continue;
        for (let col = centerCol - radiusCellsX; col <= centerCol + radiusCellsX; col += 1) {
          if (col < 0 || col >= SCRATCH_GRID_COLS) continue;
          scratchedCellsRef.current.add(`${row}:${col}`);
        }
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(rect.width, rect.height) * SCRATCH_BRUSH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const scratchedRatio = scratchedCellsRef.current.size / (SCRATCH_GRID_COLS * SCRATCH_GRID_ROWS);
      setGameState((current) => updateReelRevealScratchProgress(current, scratchedRatio));
    },
    []
  );

  const handleScratchPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canScratch) return;
      event.preventDefault();
      event.stopPropagation();
      scratchingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      scratchAtPoint(event.clientX, event.clientY);
    },
    [canScratch, scratchAtPoint]
  );

  const handleScratchPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!scratchingRef.current || !canScratch) return;
      event.preventDefault();
      scratchAtPoint(event.clientX, event.clientY);
    },
    [canScratch, scratchAtPoint]
  );

  const stopScratch = useCallback(() => {
    scratchingRef.current = false;
  }, []);

  const startSpin = useCallback(() => {
    if (!canSpin) return;

    setGameState((current) => beginReelRevealSpin(current));

    reelIntervalsRef.current = ticket.reelStrips.map((strip, reelIndex) =>
      window.setInterval(() => {
        setGameState((current) => updateReelRevealReelIndex(current, ticket, reelIndex, current.reelIndexes[reelIndex] + 1));
      }, REEL_REVEAL_REEL_SPIN_INTERVAL_MS + reelIndex * 12)
    );

    reelStopTimeoutsRef.current = REEL_REVEAL_REEL_STOP_DELAYS_MS.map((delay, reelIndex) =>
      window.setTimeout(() => {
        const intervalId = reelIntervalsRef.current[reelIndex];
        if (intervalId !== null && intervalId !== undefined) {
          window.clearInterval(intervalId);
          reelIntervalsRef.current[reelIndex] = null;
        }
        setGameState((current) => stopReelRevealReel(current, ticket, reelIndex));
      }, delay)
    );

    settleTimeoutRef.current = window.setTimeout(() => {
      setGameState((current) => completeReelRevealGame(current));
    }, REEL_REVEAL_REEL_STOP_DELAYS_MS[REEL_REVEAL_REEL_STOP_DELAYS_MS.length - 1] + 900);
  }, [canSpin, ticket]);

  useEffect(() => {
    if (!canSpin) return;

    autoSpinTimeoutRef.current = window.setTimeout(() => {
      startSpin();
    }, 520);

    return () => {
      if (autoSpinTimeoutRef.current !== null) {
        window.clearTimeout(autoSpinTimeoutRef.current);
        autoSpinTimeoutRef.current = null;
      }
    };
  }, [canSpin, startSpin]);

  const payoutRows = useMemo(
    () =>
      ticket.payoutRows.map((row) => ({
        ...row,
        isWinner: row.id === winningRowId && gameState.spinResolved && isWin,
      })),
    [gameState.spinResolved, isWin, ticket.payoutRows, winningRowId]
  );

  const resultSymbols = gameState.finalSymbols ?? ticket.spinOutcome.symbols;

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,103,240,0.25),transparent_35%),linear-gradient(180deg,#170126_0%,#0c0219_28%,#12072a_100%)] px-4 pb-5 pt-0 shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:px-6 sm:pb-6 sm:pt-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,212,71,0.16),transparent_22%),radial-gradient(circle_at_80%_5%,rgba(143,76,255,0.35),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_32%)]" />
      <div className="relative">
        <div className="relative -mx-4 overflow-hidden rounded-[28px] border border-[#ffcb4a]/35 bg-[linear-gradient(180deg,rgba(13,2,24,0.96),rgba(16,4,32,0.96))] px-1 py-2 shadow-[0_24px_80px_rgba(157,57,255,0.35)] sm:-mx-6 sm:px-2 xl:py-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,79,232,0.28),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%)]" />
          <div className="relative w-full overflow-hidden rounded-[22px] border border-[#ffcb4a]/12 bg-black/12">
            <div className="relative mx-auto aspect-[1691/930] w-full px-[2px] py-[2px] xl:max-w-[840px] xl:aspect-[1691/560]">
              <Image
                src="/reel-reveal/reel_reveal_logo.png"
                alt="Reel Reveal"
                fill
                sizes="100vw"
                className="object-contain object-center xl:scale-[1.24]"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4 xl:mt-3 xl:grid xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start xl:gap-3 xl:space-y-0">
          <div className="relative rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,10,43,0.94),rgba(11,7,28,0.95))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-5">
            <div
              ref={scratchWrapRef}
              className="relative overflow-hidden rounded-[28px] border border-[#ffcb4a]/28 bg-[linear-gradient(180deg,#1f123b_0%,#130622_100%)] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.34)] sm:p-4"
              onPointerDown={handleScratchPointerDown}
              onPointerMove={handleScratchPointerMove}
              onPointerUp={stopScratch}
              onPointerCancel={stopScratch}
              onPointerLeave={stopScratch}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_bottom,rgba(112,224,255,0.1),transparent_32%)]" />
              <div className="relative grid grid-cols-3 gap-3 sm:gap-4">
                {ticket.reelStrips.map((strip, reelIndex) => {
                  const visibleSymbols = getVisibleSymbols(strip, gameState.reelIndexes[reelIndex]);
                  return (
                    <div
                      key={`reel-${reelIndex}`}
                      className="relative overflow-hidden rounded-[24px] border border-[#fff2cc]/28 bg-[linear-gradient(180deg,#fbfcff_0%,#edf0f8_20%,#cdd5e6_52%,#b0b9cf_100%)] px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.76),inset_0_-18px_30px_rgba(37,45,78,0.34),0_16px_28px_rgba(0,0,0,0.24)] sm:px-3 sm:py-4"
                    >
                      <div className="absolute inset-y-0 left-0 w-[14%] bg-[linear-gradient(90deg,rgba(53,61,90,0.3),rgba(53,61,90,0))]" />
                      <div className="absolute inset-y-0 right-0 w-[14%] bg-[linear-gradient(270deg,rgba(53,61,90,0.34),rgba(53,61,90,0))]" />
                      <div className="absolute inset-x-2 top-0 h-6 rounded-b-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0))]" />
                      <div className="absolute inset-x-0 bottom-0 h-7 bg-[linear-gradient(180deg,rgba(18,25,44,0),rgba(18,25,44,0.32))]" />
                      <div className={`relative grid gap-2.5 transition ${isSpinning && !gameState.stoppedReels[reelIndex] ? "blur-[1.7px]" : ""}`}>
                        {visibleSymbols.map((symbolId, rowIndex) => {
                          const symbol = REEL_REVEAL_SYMBOLS[symbolId];
                          const isCenter = rowIndex === 1;
                          return (
                            <div
                              key={`${reelIndex}-${rowIndex}-${symbolId}`}
                              className={`relative flex aspect-[0.98/0.8] items-center justify-center rounded-[18px] border transition ${
                                isCenter
                                  ? "border-[#ffd979]/68 bg-[linear-gradient(180deg,#fff8e6_0%,#fff0c8_100%)] shadow-[0_0_28px_rgba(255,209,84,0.32),inset_0_0_0_1px_rgba(255,255,255,0.54)]"
                                  : "border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(226,232,244,0.95))] opacity-82 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
                              }`}
                              style={{ background: symbol.frame }}
                            >
                              <div className={`absolute inset-x-[10%] top-0 h-3 rounded-b-[12px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))] ${isCenter ? "opacity-100" : "opacity-70"}`} />
                              <div
                                className={`relative ${isCenter ? "h-[88%] w-[88%]" : "h-[80%] w-[80%]"} ${isCenter ? "scale-100" : "scale-95"}`}
                                style={{ filter: `drop-shadow(0 0 12px ${symbol.glow})` }}
                              >
                                <Image src={symbol.src} alt={symbol.label} fill sizes="160px" className="object-contain" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[2] h-[31%] -translate-y-1/2 rounded-[24px] border border-[#ffcf52]/75 bg-[linear-gradient(180deg,rgba(255,222,132,0.14),rgba(255,143,31,0.05))] shadow-[0_0_24px_rgba(255,195,61,0.25)]" />
              <canvas
                ref={scratchCanvasRef}
                className={`absolute inset-0 z-[3] touch-none transition-opacity duration-300 ${gameState.scratchComplete ? "opacity-0" : "opacity-100"}`}
              />
              {isWin && (gameState.phase === "win" || gameState.phase === "complete") ? (
                <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
                  <div className="absolute inset-x-[10%] top-[14%] h-24 rounded-full bg-[radial-gradient(circle,rgba(255,242,168,0.8),rgba(255,242,168,0))] blur-2xl" />
                  <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_center,rgba(255,87,250,0.12),transparent_42%)]" />
                </div>
              ) : null}
            </div>

            {showResultOverlay ? (
              <div className="pointer-events-none absolute inset-4 z-[10] flex items-center justify-center sm:inset-5">
                <div className="pointer-events-auto w-full max-w-[420px] rounded-[30px] border border-[#ffcf52]/55 bg-[linear-gradient(180deg,rgba(18,5,37,0.96),rgba(10,2,20,0.98))] px-6 py-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.5),0_0_48px_rgba(255,78,245,0.32)]">
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      {isWin ? (
                        <>
                          <div className="pointer-events-none absolute inset-x-[8%] inset-y-[14%] rounded-full bg-[radial-gradient(circle,rgba(255,216,108,0.34),rgba(255,216,108,0.08)_42%,rgba(255,216,108,0))] blur-xl" />
                          <div className="pointer-events-none absolute -left-1 top-[18%] h-3.5 w-3.5 opacity-80 [animation-duration:2.8s] animate-pulse">
                            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#fff6cc] to-transparent shadow-[0_0_6px_rgba(255,241,187,0.85)]" />
                            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[#ffd873] to-transparent shadow-[0_0_6px_rgba(255,216,115,0.8)]" />
                          </div>
                          <div className="pointer-events-none absolute -right-1 top-[10%] h-4 w-4 opacity-75 [animation-duration:3.4s] animate-pulse">
                            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white to-transparent shadow-[0_0_7px_rgba(255,255,255,0.92)]" />
                            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[#ffe19a] to-transparent shadow-[0_0_7px_rgba(255,225,154,0.86)]" />
                            <span className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gradient-to-b from-transparent via-[#fff2be] to-transparent opacity-70" />
                            <span className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-gradient-to-b from-transparent via-[#fff2be] to-transparent opacity-70" />
                          </div>
                          <div className="pointer-events-none absolute right-[6%] top-[72%] h-3 w-3 opacity-70 [animation-duration:3.1s] animate-pulse">
                            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#fff4d6] to-transparent shadow-[0_0_5px_rgba(255,244,214,0.85)]" />
                            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[#ffcf62] to-transparent shadow-[0_0_5px_rgba(255,207,98,0.78)]" />
                          </div>
                          <div className="pointer-events-none absolute left-[56%] top-[44%] h-2.5 w-2.5 opacity-85 [animation-duration:2.6s] animate-pulse">
                            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#fff8df] to-transparent shadow-[0_0_5px_rgba(255,248,223,0.82)]" />
                            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[#ffe79a] to-transparent shadow-[0_0_5px_rgba(255,231,154,0.82)]" />
                          </div>
                        </>
                      ) : null}
                      <div className="relative flex items-center gap-2 rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-3 py-2">
                        {resultSymbols.map((symbolId, index) => {
                          const symbol = REEL_REVEAL_SYMBOLS[symbolId];
                          return (
                            <div
                              key={`result-symbol-${index}-${symbolId}`}
                              className={`relative flex h-16 w-16 items-center justify-center rounded-[16px] border px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_12px_24px_rgba(0,0,0,0.22)] sm:h-[4.5rem] sm:w-[4.5rem] ${
                                isWin
                                  ? "border-[#ffd979]/68 bg-[linear-gradient(180deg,#fff8e6_0%,#fff0c8_100%)]"
                                  : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(226,232,244,0.95))]"
                              }`}
                              style={{
                                background: symbol.frame,
                                filter: isWin ? `drop-shadow(0 0 12px ${symbol.glow})` : `drop-shadow(0 0 8px ${symbol.glow})`,
                              }}
                            >
                              <div className={`absolute inset-x-[12%] top-0 h-3 rounded-b-[10px] bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(255,255,255,0))] ${isWin ? "opacity-100" : "opacity-70"}`} />
                              <div className={`relative ${isWin ? "h-[84%] w-[84%]" : "h-[78%] w-[78%]"}`}>
                                <Image src={symbol.src} alt={symbol.label} fill sizes="72px" className="object-contain" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div
                      className={`max-w-[15ch] text-balance font-black uppercase leading-[1.02] ${isWin ? "mt-1" : "mt-4"} ${
                        isWin
                          ? "text-[clamp(1.7rem,4vw,2.4rem)] tracking-[0.12em] text-white drop-shadow-[0_0_14px_rgba(255,210,96,0.32)]"
                          : "text-[clamp(1.15rem,3vw,1.9rem)] tracking-[0.08em] text-white"
                      }`}
                    >
                      {isWin ? "JACKPOT!" : "BETTER LUCK NEXT TIME!"}
                    </div>
                  </div>
                  {isWin ? (
                    <div className="mt-5 rounded-[24px] border border-[#ffcf52]/35 bg-[#ffcf52]/10 px-4 py-5 shadow-[0_0_20px_rgba(255,207,82,0.1)]">
                      <div className="text-5xl font-black text-[#fff2bd]">{formatAmount(countUpValue)}</div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onBuyAgain}
                    disabled={buyAgainPending}
                    className="mt-5 w-full rounded-[18px] border border-[#ffcb4a]/55 bg-[linear-gradient(180deg,#ffd95c_0%,#ffad2f_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#230f00] shadow-[0_16px_32px_rgba(255,175,43,0.35)] transition hover:brightness-105 disabled:cursor-default disabled:opacity-45"
                  >
                    {buyAgainPending ? "Starting..." : "Spin Again!"}
                  </button>
                </div>
              </div>
            ) : null}

          </div>

          <div className="rounded-[28px] border border-[#ffcf52]/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5 xl:sticky xl:top-4 xl:p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#e6dcff]/72">Payout Lines</div>
            <div className="mt-4 hidden gap-2 xl:grid">
              {payoutRows.length ? (
                payoutRows.map((row) => (
                  <div
                    key={`${row.id}-compact`}
                    className={`flex items-center justify-between rounded-[16px] border border-black/10 bg-gradient-to-r px-3 py-2.5 transition ${getPayoutRowClasses(row.style, row.isWinner)}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {row.symbols.map((symbolId, index) => (
                        <div key={`${row.id}-compact-${index}-${symbolId}`} className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-black/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
                          <Image
                            src={REEL_REVEAL_SYMBOLS[symbolId].src}
                            alt={REEL_REVEAL_SYMBOLS[symbolId].label}
                            fill
                            sizes="36px"
                            className="object-contain p-1"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="pl-3 text-2xl font-black">{formatAmount(row.rewardAmount)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-5 text-sm leading-6 text-white/70">
                  This ticket has no configured premium payout rows yet.
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3 xl:hidden">
              {payoutRows.length ? (
                payoutRows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-[22px] border border-black/10 bg-gradient-to-r px-4 py-4 transition ${getPayoutRowClasses(row.style, row.isWinner)}`}
                  >
                    <div className="text-xs font-black uppercase tracking-[0.22em]">{row.label}</div>
                    <div className="mt-3 flex items-center gap-2">
                      {row.symbols.map((symbolId, index) => (
                        <div key={`${row.id}-${index}-${symbolId}`} className="relative flex h-10 w-10 items-center justify-center rounded-[12px] bg-black/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
                          <Image
                            src={REEL_REVEAL_SYMBOLS[symbolId].src}
                            alt={REEL_REVEAL_SYMBOLS[symbolId].label}
                            fill
                            sizes="40px"
                            className="object-contain p-1"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] opacity-70">Prize</div>
                      <div className="text-2xl font-black">{formatAmount(row.rewardAmount)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-5 text-sm leading-6 text-white/70">
                  This ticket has no configured premium payout rows yet.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
