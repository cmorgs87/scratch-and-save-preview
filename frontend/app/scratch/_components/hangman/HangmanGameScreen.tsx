"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createHangmanRevealPlan,
  HANGMAN_NOTEBOOK_ART_SRC,
  HANGMAN_OUTCOME_PRESENTATION,
  HANGMAN_TITLE,
  resolveHangmanOutcomeTier,
  type HangmanOutcomeTier,
  type HangmanRevealTile,
  selectHangmanWord,
} from "@/lib/hangman/hangmanConfig";

type HangmanPhase = "splash" | "play" | "result";

type HangmanGameScreenProps = {
  authoritativeWinAmount?: number | null;
  prizeAmounts?: readonly number[];
  initialPhase?: Extract<HangmanPhase, "splash" | "play">;
  sessionId?: number;
  buyAgainPending?: boolean;
  onBuyAgain?: () => void;
};

const DRAW_DELAY_MS = 440;
const FOIL_REVEAL_THRESHOLD = 0.38;
const FOIL_CELL_COLUMNS = 8;
const FOIL_CELL_ROWS = 6;
const RESULT_TITLE_DELAY_MS = 1350;
const RESULT_AWARD_DELAY_MS = 1900;
const RESULT_CTA_DELAY_MS = 2500;
const FORCED_OUTCOMES = new Set<HangmanOutcomeTier>(["top_win", "mid_win", "low_win", "loss"]);

function ScratchFoilBoard({
  revealPlan,
  revealedTileIds,
  onReveal,
}: {
  revealPlan: readonly HangmanRevealTile[];
  revealedTileIds: readonly string[];
  onReveal: (tile: HangmanRevealTile) => void;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchingRef = useRef(false);
  const [hasStartedScratching, setHasStartedScratching] = useState(false);
  const lastScratchPointRef = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const cellCoverageRef = useRef(new Map<string, Set<string>>());
  const resolvedTileIdsRef = useRef(new Set<string>());

  const clearResolvedCell = (cellBounds: DOMRect, boardBounds: DOMRect) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pixelRatio = window.devicePixelRatio || 1;
    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.globalCompositeOperation = "destination-out";
    context.fillRect(
      cellBounds.left - boardBounds.left,
      cellBounds.top - boardBounds.top,
      cellBounds.width,
      cellBounds.height
    );
    context.restore();
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paintFoil = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const foil = context.createLinearGradient(0, 0, bounds.width, bounds.height);
      foil.addColorStop(0, "#e9e8e0");
      foil.addColorStop(0.26, "#9da4a3");
      foil.addColorStop(0.5, "#d2d5cf");
      foil.addColorStop(0.74, "#798184");
      foil.addColorStop(1, "#c5c9c4");
      context.fillStyle = foil;
      context.fillRect(0, 0, bounds.width, bounds.height);
      const sheen = context.createLinearGradient(0, 0, bounds.width, 0);
      sheen.addColorStop(0, "rgba(255,255,255,0.2)");
      sheen.addColorStop(0.42, "rgba(255,255,255,0)");
      sheen.addColorStop(0.72, "rgba(255,255,255,0.1)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = sheen;
      context.fillRect(0, 0, bounds.width, bounds.height);
      context.globalAlpha = 0.16;
      context.strokeStyle = "#fbf8ed";
      context.lineWidth = 1;
      for (let offset = -bounds.height; offset < bounds.width; offset += 12) {
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset + bounds.height, bounds.height);
        context.stroke();
      }
      context.globalAlpha = 0.2;
      context.strokeStyle = "#f8f3e6";
      context.lineWidth = 1;
      context.strokeRect(2.5, 2.5, Math.max(0, bounds.width - 5), Math.max(0, bounds.height - 5));
      context.globalAlpha = 1;
    };

    paintFoil();
    const observer = new ResizeObserver(paintFoil);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const boardBounds = board.getBoundingClientRect();
    revealedTileIds.forEach((tileId) => {
      const cell = board.querySelector<HTMLElement>(`[data-hangman-reveal-cell="${tileId}"]`);
      if (cell) clearResolvedCell(cell.getBoundingClientRect(), boardBounds);
    });
  }, [revealedTileIds]);

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;
    const bounds = canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const brushRadius = Math.max(16, Math.min(bounds.width, bounds.height) * 0.065);
    const previousPoint = lastScratchPointRef.current;
    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.globalCompositeOperation = "destination-out";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = brushRadius * 2;
    context.beginPath();
    if (previousPoint) {
      context.moveTo(previousPoint.x, previousPoint.y);
      context.lineTo(x, y);
      context.stroke();
    } else {
      context.arc(x, y, brushRadius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();

    const boardBounds = board.getBoundingClientRect();
    const trackCoverageAt = (sampleClientX: number, sampleClientY: number) => {
      board.querySelectorAll<HTMLElement>("[data-hangman-reveal-cell]").forEach((cell) => {
        const tileId = cell.dataset.hangmanRevealCell;
        const tile = revealPlan.find((candidate) => candidate.id === tileId);
        if (!tile || resolvedTileIdsRef.current.has(tile.id)) return;

        const cellBounds = cell.getBoundingClientRect();
        const closestX = Math.max(cellBounds.left, Math.min(sampleClientX, cellBounds.right));
        const closestY = Math.max(cellBounds.top, Math.min(sampleClientY, cellBounds.bottom));
        if (Math.hypot(sampleClientX - closestX, sampleClientY - closestY) > brushRadius) return;

        const localX = Math.max(0, Math.min(cellBounds.width - 1, sampleClientX - cellBounds.left));
        const localY = Math.max(0, Math.min(cellBounds.height - 1, sampleClientY - cellBounds.top));
        const column = Math.min(FOIL_CELL_COLUMNS - 1, Math.floor((localX / cellBounds.width) * FOIL_CELL_COLUMNS));
        const row = Math.min(FOIL_CELL_ROWS - 1, Math.floor((localY / cellBounds.height) * FOIL_CELL_ROWS));
        const coveredCells = cellCoverageRef.current.get(tile.id) ?? new Set<string>();
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            const nextColumn = column + columnOffset;
            const nextRow = row + rowOffset;
            if (nextColumn >= 0 && nextColumn < FOIL_CELL_COLUMNS && nextRow >= 0 && nextRow < FOIL_CELL_ROWS) {
              coveredCells.add(`${nextColumn}:${nextRow}`);
            }
          }
        }
        cellCoverageRef.current.set(tile.id, coveredCells);
        if (coveredCells.size / (FOIL_CELL_COLUMNS * FOIL_CELL_ROWS) >= FOIL_REVEAL_THRESHOLD) {
          resolvedTileIdsRef.current.add(tile.id);
          clearResolvedCell(cellBounds, boardBounds);
          onReveal(tile);
        }
      });
    };

    const segmentLength = previousPoint ? Math.hypot(clientX - previousPoint.clientX, clientY - previousPoint.clientY) : 0;
    const sampleCount = Math.max(1, Math.ceil(segmentLength / Math.max(8, brushRadius * 0.45)));
    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
      const progress = sampleIndex / sampleCount;
      trackCoverageAt(
        previousPoint ? previousPoint.clientX + (clientX - previousPoint.clientX) * progress : clientX,
        previousPoint ? previousPoint.clientY + (clientY - previousPoint.clientY) * progress : clientY
      );
    }
    lastScratchPointRef.current = { x, y, clientX, clientY };
  };

  const revealWithKeyboard = (tile: HangmanRevealTile) => {
    if (resolvedTileIdsRef.current.has(tile.id)) return;
    const board = boardRef.current;
    const cell = board?.querySelector<HTMLElement>(`[data-hangman-reveal-cell="${tile.id}"]`);
    if (board && cell) clearResolvedCell(cell.getBoundingClientRect(), board.getBoundingClientRect());
    resolvedTileIdsRef.current.add(tile.id);
    onReveal(tile);
  };

  return (
    <div className="relative mt-6 overflow-hidden rounded-[24px] border border-[#8a8c82]/20 bg-[#94958e] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_16px_rgba(39,43,40,0.09)] sm:mt-7 sm:p-3 lg:mt-3 lg:h-[184px] lg:p-2">
      <div ref={boardRef} className="relative h-full overflow-hidden rounded-[18px] border border-[#9a927f]/26 bg-[linear-gradient(135deg,#f8f0df_0%,#ece1cc_52%,#faf3e4_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.62),inset_0_0_0_1px_rgba(93,83,66,0.04)] sm:p-[1.125rem] lg:p-3.5">
        <div className="pointer-events-none absolute inset-[10px] rounded-[11px] border border-[#9f947d]/10" />
        <div className="relative grid h-full content-center grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-3 lg:gap-y-2.5">
          {revealPlan.map((tile) => {
            const revealed = revealedTileIds.includes(tile.id);
            return (
              <div
                key={tile.id}
                data-hangman-reveal-cell={tile.id}
                role="button"
                tabIndex={revealed ? -1 : 0}
                aria-label={revealed ? `${tile.letter} ${tile.correct ? "found" : "miss"}` : "Scratch foil reveal"}
                onKeyDown={(event) => {
                  if (!revealed && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    revealWithKeyboard(tile);
                  }
                }}
                className={`relative flex min-h-[4.25rem] w-full max-w-[120px] justify-self-center items-center justify-center overflow-visible rounded-[3px] border border-dashed bg-[#fbf4e5]/34 px-3 font-black outline-none transition focus-visible:ring-2 focus-visible:ring-amber-100 sm:min-h-[4.5rem] sm:max-w-[132px] lg:min-h-0 lg:max-w-[112px] ${
                  tile.correct
                    ? "border-[#718264]/40 text-[#263b2e] shadow-none"
                    : "border-[#9c7467]/38 text-[#47362f] shadow-none"
                }`}
              >
                <span className="font-serif text-3xl font-black leading-none text-[#27352e] sm:text-4xl lg:text-2xl">{tile.letter}</span>
                <span aria-hidden="true" className={`absolute right-1.5 top-1 font-serif text-[8px] font-black opacity-35 ${tile.correct ? "text-[#4d6b46]" : "text-[#8f5a52]"}`}>{tile.correct ? "+" : "x"}</span>
              </div>
            );
          })}
        </div>
        <canvas
        ref={canvasRef}
        aria-label="Scratch the reveal board"
        className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
        onPointerDown={(event) => {
          event.preventDefault();
          scratchingRef.current = true;
          setHasStartedScratching(true);
          lastScratchPointRef.current = null;
          event.currentTarget.setPointerCapture(event.pointerId);
          scratchAt(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (scratchingRef.current) scratchAt(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          scratchingRef.current = false;
          lastScratchPointRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          scratchingRef.current = false;
          lastScratchPointRef.current = null;
        }}
        />
        <div className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${hasStartedScratching ? "opacity-0" : "opacity-100"}`} aria-hidden="true">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[#273039]/55">Scratch</span>
        </div>
      </div>
    </div>
  );
}

function PencilSketch({ drawnParts, animatingPart }: { drawnParts: number; animatingPart: number | null }) {
  const visible = (part: number) => drawnParts >= part;
  const animatedClass = (part: number) => animatingPart === part ? "hangman-pencil-stroke" : "";
  return (
    <svg viewBox="0 0 240 230" className="h-full w-full drop-shadow-[0_2px_0_rgba(255,255,255,0.4)]" aria-label="Pencil hangman sketch">
      <g fill="none" stroke="#4a4b4b" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 202H188M58 201V26H166M58 58L91 26M164 27V51" strokeWidth="4.5" opacity="0.9" />
        {visible(1) ? <circle cx="164" cy="71" r="18" strokeWidth="4" className={animatedClass(1)} /> : null}
        {visible(2) ? <path d="M164 89V133" strokeWidth="4" className={animatedClass(2)} /> : null}
        {visible(3) ? <path d="M164 102L136 120" strokeWidth="4" className={animatedClass(3)} /> : null}
        {visible(4) ? <path d="M164 102L192 120" strokeWidth="4" className={animatedClass(4)} /> : null}
        {visible(5) ? <path d="M164 132L141 165" strokeWidth="4" className={animatedClass(5)} /> : null}
        {visible(6) ? <path d="M164 132L187 165" strokeWidth="4" className={animatedClass(6)} /> : null}
      </g>
      <g fill="none" stroke="#8c8276" strokeLinecap="round" opacity="0.34">
        <path d="M24 207H194M62 205V23H170" strokeWidth="1.3" />
      </g>
      {animatingPart !== null ? <path d="M202 180l22-28-8 31z" fill="#d19b3b" opacity="0.9" className="hangman-pencil-nib" /> : null}
    </svg>
  );
}

function NotebookResultDoodle({ outcomeTier }: { outcomeTier: HangmanOutcomeTier }) {
  const isLoss = outcomeTier === "loss";
  const isTopWin = outcomeTier === "top_win";
  const isMidWin = outcomeTier === "mid_win";
  const isLowWin = outcomeTier === "low_win";

  return (
    <svg viewBox="0 0 680 330" className={`h-full w-full overflow-visible hangman-result-${outcomeTier}`} aria-label="Animated hangman notebook doodle">
      <g className="hangman-result-gallows" fill="none" stroke="#293442" strokeLinecap="round" strokeLinejoin="round">
        <path d="M108 276H470M154 274V48H388M154 94L202 48M384 49V92" strokeWidth="7" opacity="0.92" />
        <path d="M370 92V119" strokeWidth="4" strokeDasharray={isTopWin ? "8 8" : undefined} className={isTopWin ? "hangman-result-rope-snap" : "hangman-result-rope-swing"} />
      </g>

      {isTopWin ? <g className="hangman-result-escape" fill="none" stroke="#293442" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6"><circle cx="474" cy="139" r="24" /><path d="M474 163V217M474 182L440 154M474 182L508 153M474 217L445 254M474 217L509 242" /><path d="M463 135q10 10 21 0" strokeWidth="3" /><path d="M434 111l-13-10M513 112l16-10" stroke="#d89b20" strokeWidth="4" /></g> : null}
      {isMidWin ? <g className="hangman-result-duck" fill="none" stroke="#293442" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6"><circle cx="460" cy="164" r="24" /><path d="M443 154q15-12 30 0" strokeWidth="3" /><path d="M460 188L486 226M476 204L444 218M476 204L508 211M486 226L451 252M486 226L516 246" /></g> : null}
      {isLowWin ? <g className="hangman-result-climb" fill="none" stroke="#293442" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6"><circle cx="465" cy="205" r="23" /><path d="M453 204q12 11 23 0" strokeWidth="3" /><path d="M465 228L450 260M457 241L428 250M457 241L482 233M450 260L425 280M450 260L480 280" /></g> : null}
      {isLoss ? <g className="hangman-result-wobble" fill="none" stroke="#293442" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6"><circle cx="469" cy="180" r="24" /><path d="M469 204L445 243M453 224L424 236M453 224L484 238M445 243L414 261M445 243L476 261" /><path d="m455 171 8 8m0-8-8 8m20-8 8 8m0-8-8 8M458 194q11-8 22 0" strokeWidth="3" /></g> : null}

      {isTopWin ? <g className="hangman-result-scribbles" fill="none" stroke="#d89b20" strokeLinecap="round" strokeWidth="5"><path d="M512 92l18-21M538 126l24-6M532 185l23 11" /></g> : null}
      {isMidWin ? <g className="hangman-result-eraser"><rect x="356" y="84" width="50" height="27" rx="6" fill="#eddcb6" stroke="#a86e4b" strokeWidth="3" /><path d="M385 85v25" stroke="#d88b74" strokeWidth="6" /></g> : null}
      {isLowWin ? <g fill="none" stroke="#b87920" strokeLinecap="round" strokeWidth="6" className="hangman-result-ladder"><path d="M361 274L330 180M399 274L368 180M338 203H376M345 226H384M353 249H392" /></g> : null}
      {isLoss ? <g className="hangman-result-sigh" fill="none" stroke="#69717a" strokeLinecap="round" strokeWidth="4"><path d="M510 198q16 8 1 18M530 215q14 8-1 18" /></g> : null}
    </svg>
  );
}

export function HangmanGameScreen({
  authoritativeWinAmount,
  prizeAmounts,
  initialPhase = "splash",
  sessionId = 0,
  buyAgainPending = false,
  onBuyAgain,
}: HangmanGameScreenProps) {
  const searchParams = useSearchParams();
  const forcedOutcome =
    process.env.NODE_ENV !== "production" && FORCED_OUTCOMES.has(searchParams.get("hangmanOutcome") as HangmanOutcomeTier)
      ? (searchParams.get("hangmanOutcome") as HangmanOutcomeTier)
      : null;
  const forcedWordId = process.env.NODE_ENV !== "production" ? searchParams.get("hangmanWord") : null;
  const slowResultAnimation = process.env.NODE_ENV !== "production" && searchParams.get("hangmanResultSlow") === "1";
  const resultTimingScale = slowResultAnimation ? 2.5 : 1;
  const resultAnimation = (name: string, duration: number, delay = 0, easing = "ease-out") => (
    `${name} ${Math.round(duration * resultTimingScale)}ms ${Math.round(delay * resultTimingScale)}ms ${easing} both`
  );
  const resultAnimationStyle = {
    "--hangman-stage-animation": resultAnimation("hangman-result-stage-enter", 440, 0, "cubic-bezier(.18,.88,.25,1)"),
    "--hangman-gallows-animation": resultAnimation("hangman-result-gallows-draw", 620, 100),
    "--hangman-rope-swing-animation": resultAnimation("hangman-result-rope-swing", 720, 250, "cubic-bezier(.3,.8,.4,1)"),
    "--hangman-rope-break-animation": resultAnimation("hangman-result-rope-break", 720, 410),
    "--hangman-escape-animation": resultAnimation("hangman-result-big-escape", 920, 520, "cubic-bezier(.18,.9,.28,1)"),
    "--hangman-eraser-animation": resultAnimation("hangman-result-eraser-swipe", 760, 340, "cubic-bezier(.18,.86,.34,1)"),
    "--hangman-duck-animation": resultAnimation("hangman-result-duck-hop", 830, 610, "cubic-bezier(.2,.9,.3,1)"),
    "--hangman-ladder-animation": resultAnimation("hangman-result-ladder-draw", 830, 330),
    "--hangman-climb-animation": resultAnimation("hangman-result-climb-away", 840, 720, "cubic-bezier(.18,.9,.3,1)"),
    "--hangman-loss-animation": resultAnimation("hangman-result-loss-slump", 900, 480, "cubic-bezier(.2,.85,.3,1)"),
    "--hangman-scribble-animation": resultAnimation("hangman-result-scribble-pop", 430, 1050, "cubic-bezier(.2,.9,.3,1)"),
    "--hangman-sigh-animation": resultAnimation("hangman-result-scribble-pop", 450, 940),
    "--hangman-title-animation": resultAnimation("hangman-result-title-arrive", 520, 0, "cubic-bezier(.18,.85,.24,1)"),
    "--hangman-award-animation": resultAnimation("hangman-result-award-arrive", 500, 0, "cubic-bezier(.18,.88,.25,1)"),
    "--hangman-cta-animation": resultAnimation("hangman-result-cta-arrive", 460, 0, "cubic-bezier(.18,.88,.25,1)"),
  } as CSSProperties;
  const [word] = useState(() => selectHangmanWord(sessionId, forcedWordId));
  const outcomeTier = forcedOutcome ?? resolveHangmanOutcomeTier(authoritativeWinAmount, prizeAmounts);
  const revealPlan = useMemo(() => createHangmanRevealPlan(word, outcomeTier), [outcomeTier, word]);
  const outcome = HANGMAN_OUTCOME_PRESENTATION[outcomeTier];
  const displayPrize = Math.max(0, authoritativeWinAmount ?? 0);
  const [phase, setPhase] = useState<HangmanPhase>(initialPhase);
  const [resultBeat, setResultBeat] = useState<"doodle" | "title" | "award" | "cta">("doodle");
  const [revealedTileIds, setRevealedTileIds] = useState<string[]>([]);
  const [pendingDraws, setPendingDraws] = useState(0);
  const [drawnParts, setDrawnParts] = useState(0);
  const [animatingPart, setAnimatingPart] = useState<number | null>(null);
  const [countUpValue, setCountUpValue] = useState(0);
  const resultScheduledRef = useRef(false);
  const pendingDrawsRef = useRef(0);
  const drawnPartsRef = useRef(0);
  const drawingActiveRef = useRef(false);
  const drawTimersRef = useRef<number[]>([]);
  const processNextDrawRef = useRef<() => void>(() => {});

  const revealedTiles = useMemo(
    () => revealPlan.filter((tile) => revealedTileIds.includes(tile.id)),
    [revealPlan, revealedTileIds]
  );
  const revealedCorrectLetters = useMemo(
    () => new Set(revealedTiles.filter((tile) => tile.correct).map((tile) => tile.letter)),
    [revealedTiles]
  );
  const wrongRevealCount = revealPlan.filter((tile) => !tile.correct).length;
  const complete = revealedTileIds.length === revealPlan.length && drawnParts === wrongRevealCount && pendingDraws === 0 && animatingPart === null;

  useEffect(() => {
    processNextDrawRef.current = () => {
      if (drawingActiveRef.current || pendingDrawsRef.current === 0) return;

      drawingActiveRef.current = true;
      const nextPart = drawnPartsRef.current + 1;
      const startTimer = window.setTimeout(() => setAnimatingPart(nextPart), 16);
      const finishTimer = window.setTimeout(() => {
        drawnPartsRef.current = nextPart;
        pendingDrawsRef.current = Math.max(0, pendingDrawsRef.current - 1);
        drawingActiveRef.current = false;
        setDrawnParts(nextPart);
        setPendingDraws(pendingDrawsRef.current);
        setAnimatingPart(null);
        processNextDrawRef.current();
      }, DRAW_DELAY_MS);
      drawTimersRef.current.push(startTimer, finishTimer);
    };

    return () => {
      drawTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      drawTimersRef.current = [];
      processNextDrawRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    if (!complete || phase !== "play" || resultScheduledRef.current) return;
    resultScheduledRef.current = true;
    const timer = window.setTimeout(() => {
      setResultBeat("doodle");
      setCountUpValue(0);
      setPhase("result");
    }, 420);
    return () => window.clearTimeout(timer);
  }, [complete, phase]);

  useEffect(() => {
    if (phase !== "result") return;
    const titleTimer = window.setTimeout(() => setResultBeat("title"), RESULT_TITLE_DELAY_MS * resultTimingScale);
    const awardTimer = window.setTimeout(() => setResultBeat("award"), RESULT_AWARD_DELAY_MS * resultTimingScale);
    const ctaTimer = window.setTimeout(() => setResultBeat("cta"), RESULT_CTA_DELAY_MS * resultTimingScale);
    return () => {
      window.clearTimeout(titleTimer);
      window.clearTimeout(awardTimer);
      window.clearTimeout(ctaTimer);
    };
  }, [phase, resultTimingScale]);

  useEffect(() => {
    if (phase !== "result" || resultBeat !== "award" || displayPrize <= 0) return;
    const startedAt = performance.now();
    const duration = 700 * resultTimingScale;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setCountUpValue(Math.round(displayPrize * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [displayPrize, phase, resultBeat, resultTimingScale]);

  const revealTile = (tile: HangmanRevealTile) => {
    if (phase !== "play" || revealedTileIds.includes(tile.id)) return;
    setRevealedTileIds((current) => [...current, tile.id]);
    if (!tile.correct) {
      pendingDrawsRef.current += 1;
      setPendingDraws(pendingDrawsRef.current);
      processNextDrawRef.current();
    }
  };

  if (phase === "splash") {
    return (
      <section className="relative mx-auto min-h-[620px] w-full max-w-[1120px] overflow-hidden rounded-[36px] border border-slate-700 bg-[#111317] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <Image src={HANGMAN_NOTEBOOK_ART_SRC} alt="Ruled notebook and pencil" fill priority sizes="(max-width: 1120px) 100vw, 1120px" className="object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,18,0.88),rgba(8,12,18,0.26)_55%,rgba(8,12,18,0.56))]" />
        <div className="relative flex min-h-[620px] max-w-[650px] flex-col justify-center px-7 py-12 sm:px-14">
          <div className="mb-4 inline-flex w-fit rounded-full border border-amber-200/25 bg-black/25 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.34em] text-amber-100/75">Pencil & Paper</div>
          <h1 className="font-serif text-6xl font-black tracking-tight text-[#fff3d3] drop-shadow-[0_5px_0_rgba(33,27,18,0.6)] sm:text-8xl">{HANGMAN_TITLE}</h1>
          <div className="mt-3 h-px w-56 bg-gradient-to-r from-amber-200 via-amber-50 to-transparent" />
          <p className="mt-7 max-w-lg text-xl leading-relaxed text-slate-100/85">Scratch the notebook. Reveal the clue before the pencil finishes its sketch.</p>
          <button onClick={() => setPhase("play")} className="mt-10 w-fit rounded-full border border-amber-100/40 bg-[linear-gradient(180deg,#d4a84d,#79500e)] px-7 py-4 text-sm font-black uppercase tracking-[0.28em] text-[#fff4d9] shadow-[0_16px_32px_rgba(0,0,0,0.35)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-100">Scratch ticket</button>
        </div>
      </section>
    );
  }

  if (phase === "result") {
    const isWinner = outcomeTier !== "loss";
    return (
      <section style={resultAnimationStyle} className="relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-[36px] border border-slate-700 bg-[#171a1d] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <style>{`@keyframes hangman-result-escape { 0% { transform: translate(0, 14px) rotate(4deg); opacity: 0; } 52% { transform: translate(-14px, -5px) rotate(-7deg); opacity: 1; } 100% { transform: translate(0, 0) rotate(0); opacity: 1; } } @keyframes hangman-result-rope-snap { 0%,52% { opacity: 1; } 64%,100% { opacity: .18; } } @keyframes hangman-result-pencil-line { from { stroke-dasharray: 80; stroke-dashoffset: 80; } to { stroke-dasharray: 80; stroke-dashoffset: 0; } } @keyframes hangman-result-eraser { 0%,35% { transform: translateX(34px) rotate(9deg); opacity: 0; } 62% { opacity: 1; } 100% { transform: translateX(0) rotate(0); opacity: 1; } } @keyframes hangman-result-duck { 0%,34% { transform: translate(12px, 10px) rotate(6deg); opacity: 0; } 62% { transform: translate(-8px, -7px) rotate(-6deg); opacity: 1; } 100% { transform: translate(0, 0) rotate(0); opacity: 1; } } @keyframes hangman-result-climb { 0%,36% { transform: translateY(19px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } } @keyframes hangman-result-ladder { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } @keyframes hangman-result-wobble { 0%,42% { transform: rotate(0deg); } 53% { transform: rotate(5deg); } 64% { transform: rotate(-5deg); } 76%,100% { transform: rotate(0deg); } } @keyframes hangman-result-sigh { 0%,48% { opacity: 0; transform: translateY(-5px); } 100% { opacity: .72; transform: translateY(0); } } @keyframes hangman-result-scribbles { 0%,45% { opacity: 0; } 100% { opacity: 1; } } .hangman-result-escape { transform-origin: 474px 216px; animation: hangman-result-escape 1.2s cubic-bezier(.2,.8,.2,1) both; } .hangman-result-rope-snap { animation: hangman-result-rope-snap 1.15s ease-out both; } .hangman-result-pencil-line { animation: hangman-result-pencil-line 1.1s ease-out both; } .hangman-result-eraser { transform-origin: 381px 97px; animation: hangman-result-eraser 1.1s ease-out both; } .hangman-result-duck { transform-origin: 470px 210px; animation: hangman-result-duck 1.1s cubic-bezier(.2,.8,.2,1) both; } .hangman-result-climb { transform-origin: 426px 205px; animation: hangman-result-climb 1.1s ease-out both; } .hangman-result-ladder { animation: hangman-result-ladder 1.1s ease-out both; } .hangman-result-wobble { transform-origin: 469px 225px; animation: hangman-result-wobble 1.1s ease-out both; } .hangman-result-sigh { animation: hangman-result-sigh 1.1s ease-out both; } .hangman-result-scribbles { animation: hangman-result-scribbles .9s ease-out both; } @media (prefers-reduced-motion: reduce) { .hangman-result-escape,.hangman-result-rope-snap,.hangman-result-pencil-line,.hangman-result-eraser,.hangman-result-duck,.hangman-result-climb,.hangman-result-ladder,.hangman-result-wobble,.hangman-result-sigh,.hangman-result-scribbles { animation: none; } }`}</style>
        <style>{`@keyframes hangman-result-paper-enter { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes hangman-result-loss-wobble { 0%,20% { opacity: 0; transform: rotate(0deg) translateY(-4px); } 48% { opacity: 1; transform: rotate(5deg); } 62% { transform: rotate(-5deg); } 76%,100% { opacity: 1; transform: rotate(0deg); } } .hangman-result-paper-enter { animation: hangman-result-paper-enter 380ms cubic-bezier(.2,.8,.2,1) both; } .hangman-result-escape,.hangman-result-rope-snap,.hangman-result-pencil-line,.hangman-result-eraser,.hangman-result-duck,.hangman-result-climb,.hangman-result-ladder,.hangman-result-sigh,.hangman-result-scribbles { animation-delay: 250ms; } .hangman-result-wobble { animation: hangman-result-loss-wobble 1.1s 250ms ease-out both; } @media (prefers-reduced-motion: reduce) { .hangman-result-paper-enter,.hangman-result-escape,.hangman-result-rope-snap,.hangman-result-pencil-line,.hangman-result-eraser,.hangman-result-duck,.hangman-result-climb,.hangman-result-ladder,.hangman-result-wobble,.hangman-result-sigh,.hangman-result-scribbles { animation: none; } }`}</style>
        <style>{`@keyframes hangman-result-gallows-draw { from { stroke-dashoffset: 900; opacity: .12; } to { stroke-dashoffset: 0; opacity: .92; } } @keyframes hangman-result-rope-swing { 0% { transform: rotate(-22deg); } 40% { transform: rotate(19deg); } 68% { transform: rotate(-11deg); } 100% { transform: rotate(0deg); } } @keyframes hangman-result-rope-break { 0%,48% { opacity: 1; transform: translateY(0); } 58% { opacity: 1; transform: translate(8px,8px) rotate(18deg); } 72%,100% { opacity: 0; transform: translate(28px,37px) rotate(44deg); } } @keyframes hangman-result-big-escape { 0% { opacity: 0; transform: translate(8px,38px) rotate(12deg); } 20% { opacity: 1; transform: translate(0,6px) rotate(-8deg); } 47% { transform: translate(-22px,-30px) rotate(-16deg); } 70% { transform: translate(-43px,6px) rotate(10deg); } 100% { opacity: 1; transform: translate(-67px,-7px) rotate(-4deg); } } @keyframes hangman-result-eraser-swipe { 0% { opacity: 0; transform: translate(130px,-18px) rotate(30deg); } 18% { opacity: 1; } 60% { transform: translate(-24px,10px) rotate(-14deg); } 100% { opacity: 1; transform: translate(0,0) rotate(0); } } @keyframes hangman-result-duck-hop { 0% { opacity: 0; transform: translate(38px,43px) rotate(15deg); } 36% { opacity: 1; transform: translate(15px,0) rotate(-8deg); } 65% { transform: translate(-28px,-31px) rotate(-14deg); } 100% { opacity: 1; transform: translate(-10px,0) rotate(0); } } @keyframes hangman-result-ladder-draw { from { stroke-dashoffset: 680; opacity: 0; } to { stroke-dashoffset: 0; opacity: 1; } } @keyframes hangman-result-climb-away { 0% { opacity: 0; transform: translate(12px,63px) rotate(8deg); } 45% { opacity: 1; transform: translate(3px,24px) rotate(-8deg); } 72% { transform: translate(-16px,-8px) rotate(6deg); } 100% { opacity: 1; transform: translate(-34px,-19px) rotate(-5deg); } } @keyframes hangman-result-loss-slump { 0% { opacity: 0; transform: translateY(-35px) rotate(-9deg); } 38% { opacity: 1; transform: translateY(2px) rotate(9deg); } 54% { transform: translateY(9px) rotate(-8deg); } 70% { transform: translateY(13px) rotate(6deg); } 100% { opacity: 1; transform: translateY(18px) rotate(0); } } @keyframes hangman-result-scribble-pop { 0% { opacity: 0; transform: scale(.18) rotate(-18deg); } 62% { opacity: 1; transform: scale(1.22) rotate(7deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } } @keyframes hangman-result-handwriting-pop { from { opacity: 0; transform: translateY(15px) rotate(-8deg); } to { opacity: 1; transform: translateY(0) rotate(0); } } @keyframes hangman-result-pencil-fall { from { opacity: 0; transform: translate(38px,-45px) rotate(-24deg); } to { opacity: 1; transform: translate(0,0) rotate(0); } } .hangman-result-gallows path { stroke-dasharray: 900; stroke-dashoffset: 900; animation: hangman-result-gallows-draw calc(620ms * var(--hangman-result-scale)) 100ms ease-out both; } .hangman-result-rope-swing { transform-origin: 370px 92px; animation: hangman-result-rope-swing calc(720ms * var(--hangman-result-scale)) calc(250ms * var(--hangman-result-scale)) cubic-bezier(.3,.8,.4,1) both; } .hangman-result-top_win .hangman-result-rope-snap { transform-origin: 370px 92px; animation: hangman-result-rope-break calc(720ms * var(--hangman-result-scale)) calc(410ms * var(--hangman-result-scale)) ease-out both; } .hangman-result-top_win .hangman-result-escape { transform-origin: 474px 216px; animation: hangman-result-big-escape calc(920ms * var(--hangman-result-scale)) calc(520ms * var(--hangman-result-scale)) cubic-bezier(.18,.9,.28,1) both; } .hangman-result-mid_win .hangman-result-eraser { transform-origin: 381px 97px; animation: hangman-result-eraser-swipe calc(760ms * var(--hangman-result-scale)) calc(340ms * var(--hangman-result-scale)) cubic-bezier(.18,.86,.34,1) both; } .hangman-result-mid_win .hangman-result-duck { transform-origin: 470px 210px; animation: hangman-result-duck-hop calc(830ms * var(--hangman-result-scale)) calc(610ms * var(--hangman-result-scale)) cubic-bezier(.2,.9,.3,1) both; } .hangman-result-low_win .hangman-result-ladder path { stroke-dasharray: 680; stroke-dashoffset: 680; animation: hangman-result-ladder-draw calc(830ms * var(--hangman-result-scale)) calc(330ms * var(--hangman-result-scale)) ease-out both; } .hangman-result-low_win .hangman-result-climb { transform-origin: 426px 205px; animation: hangman-result-climb-away calc(840ms * var(--hangman-result-scale)) calc(720ms * var(--hangman-result-scale)) cubic-bezier(.18,.9,.3,1) both; } .hangman-result-loss .hangman-result-wobble { transform-origin: 469px 225px; animation: hangman-result-loss-slump calc(900ms * var(--hangman-result-scale)) calc(480ms * var(--hangman-result-scale)) cubic-bezier(.2,.85,.3,1) both; } .hangman-result-loss .hangman-result-broken-pencil { transform-origin: 556px 255px; animation: hangman-result-pencil-fall calc(520ms * var(--hangman-result-scale)) calc(880ms * var(--hangman-result-scale)) ease-out both; } .hangman-result-scribbles { transform-origin: center; animation: hangman-result-scribble-pop calc(430ms * var(--hangman-result-scale)) calc(1050ms * var(--hangman-result-scale)) cubic-bezier(.2,.9,.3,1) both; } .hangman-result-sigh { animation: hangman-result-scribble-pop calc(450ms * var(--hangman-result-scale)) calc(940ms * var(--hangman-result-scale)) ease-out both; } .hangman-result-handwriting { transform-box: fill-box; transform-origin: center; animation: hangman-result-handwriting-pop calc(420ms * var(--hangman-result-scale)) calc(1110ms * var(--hangman-result-scale)) cubic-bezier(.2,.85,.25,1) both; } @media (prefers-reduced-motion: reduce) { .hangman-result-gallows path,.hangman-result-rope-swing,.hangman-result-top_win .hangman-result-rope-snap,.hangman-result-top_win .hangman-result-escape,.hangman-result-mid_win .hangman-result-eraser,.hangman-result-mid_win .hangman-result-duck,.hangman-result-low_win .hangman-result-ladder path,.hangman-result-low_win .hangman-result-climb,.hangman-result-loss .hangman-result-wobble,.hangman-result-loss .hangman-result-broken-pencil,.hangman-result-scribbles,.hangman-result-sigh,.hangman-result-handwriting { animation: none; opacity: 1; stroke-dashoffset: 0; } }`}</style>
        <style>{`@keyframes hangman-result-stage-enter { 0% { opacity: 0; transform: translateY(26px) scale(.84); } 58% { opacity: 1; transform: translateY(-4px) scale(1.045); } 100% { opacity: 1; transform: translateY(0) scale(1); } } @keyframes hangman-result-title-arrive { 0% { opacity: 0; transform: translateY(26px) scale(.78); letter-spacing: .08em; } 70% { opacity: 1; transform: translateY(-3px) scale(1.055); } 100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0; } } @keyframes hangman-result-award-arrive { 0% { opacity: 0; transform: translateY(20px) scale(.65); } 72% { opacity: 1; transform: translateY(-2px) scale(1.08); } 100% { opacity: 1; transform: translateY(0) scale(1); } } @keyframes hangman-result-cta-arrive { 0% { opacity: 0; transform: translateY(22px) scale(.82); } 72% { opacity: 1; transform: translateY(-2px) scale(1.035); } 100% { opacity: 1; transform: translateY(0) scale(1); } } .hangman-result-stage { animation: hangman-result-stage-enter calc(440ms * var(--hangman-result-scale)) cubic-bezier(.18,.88,.25,1) both; } .hangman-result-title-beat { animation: hangman-result-title-arrive calc(520ms * var(--hangman-result-scale)) cubic-bezier(.18,.85,.24,1) both; } .hangman-result-award-beat { animation: hangman-result-award-arrive calc(500ms * var(--hangman-result-scale)) cubic-bezier(.18,.88,.25,1) both; } .hangman-result-cta-beat { animation: hangman-result-cta-arrive calc(460ms * var(--hangman-result-scale)) cubic-bezier(.18,.88,.25,1) both; } @media (prefers-reduced-motion: reduce) { .hangman-result-stage,.hangman-result-title-beat,.hangman-result-award-beat,.hangman-result-cta-beat { animation: none; } }`}</style>
        <style>{`.hangman-result-stage { animation: var(--hangman-stage-animation); } .hangman-result-gallows path { animation: var(--hangman-gallows-animation); } .hangman-result-rope-swing { animation: var(--hangman-rope-swing-animation); } .hangman-result-top_win .hangman-result-rope-snap { animation: var(--hangman-rope-break-animation); } .hangman-result-top_win .hangman-result-escape { animation: var(--hangman-escape-animation); } .hangman-result-mid_win .hangman-result-eraser { animation: var(--hangman-eraser-animation); } .hangman-result-mid_win .hangman-result-duck { animation: var(--hangman-duck-animation); } .hangman-result-low_win .hangman-result-ladder path { animation: var(--hangman-ladder-animation); } .hangman-result-low_win .hangman-result-climb { animation: var(--hangman-climb-animation); } .hangman-result-loss .hangman-result-wobble { animation: var(--hangman-loss-animation); } .hangman-result-loss .hangman-result-broken-pencil { animation: var(--hangman-pencil-animation); } .hangman-result-scribbles { animation: var(--hangman-scribble-animation); } .hangman-result-sigh { animation: var(--hangman-sigh-animation); } .hangman-result-handwriting { animation: var(--hangman-handwriting-animation); } .hangman-result-title-beat { animation: var(--hangman-title-animation); } .hangman-result-award-beat { animation: var(--hangman-award-animation); } .hangman-result-cta-beat { animation: var(--hangman-cta-animation); } @media (prefers-reduced-motion: reduce) { .hangman-result-stage,.hangman-result-gallows path,.hangman-result-rope-swing,.hangman-result-top_win .hangman-result-rope-snap,.hangman-result-top_win .hangman-result-escape,.hangman-result-mid_win .hangman-result-eraser,.hangman-result-mid_win .hangman-result-duck,.hangman-result-low_win .hangman-result-ladder path,.hangman-result-low_win .hangman-result-climb,.hangman-result-loss .hangman-result-wobble,.hangman-result-loss .hangman-result-broken-pencil,.hangman-result-scribbles,.hangman-result-sigh,.hangman-result-handwriting,.hangman-result-title-beat,.hangman-result-award-beat,.hangman-result-cta-beat { animation: none; } }`}</style>
        <style>{`@keyframes hangman-result-big-escape { 0% { opacity: 0; transform: translate(-105px,-26px) rotate(-12deg); } 16% { opacity: 1; transform: translate(-98px,-20px) rotate(8deg); } 38% { transform: translate(-58px,35px) rotate(18deg); } 56% { transform: translate(-25px,12px) rotate(-8deg); } 76% { transform: translate(45px,24px) rotate(9deg); } 100% { opacity: 1; transform: translate(112px,18px) rotate(0deg); } } @keyframes hangman-result-duck-hop { 0% { opacity: 0; transform: translate(-75px,-35px) rotate(-12deg); } 20% { opacity: 1; transform: translate(-68px,-28px) rotate(8deg); } 46% { transform: translate(-36px,26px) rotate(17deg); } 68% { transform: translate(22px,8px) rotate(-9deg); } 100% { opacity: 1; transform: translate(92px,18px) rotate(0deg); } } @keyframes hangman-result-climb-away { 0% { opacity: 0; transform: translate(-90px,-100px) rotate(-9deg); } 18% { opacity: 1; transform: translate(-84px,-88px) rotate(7deg); } 43% { transform: translate(-60px,-42px) rotate(-9deg); } 66% { transform: translate(-37px,22px) rotate(8deg); } 82% { transform: translate(-12px,10px) rotate(-5deg); } 100% { opacity: 1; transform: translate(40px,0) rotate(0deg); } } @keyframes hangman-result-rope-break { 0%,42% { opacity: 1; transform: translate(0,0) rotate(0deg); } 55% { opacity: 1; transform: translate(10px,13px) rotate(22deg); } 72%,100% { opacity: 0; transform: translate(46px,60px) rotate(66deg); } }`}</style>
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(66,126,176,0.1)_0_1px,transparent_1px_34px),linear-gradient(90deg,transparent_0_9%,rgba(212,86,86,0.18)_9%_9.2%,transparent_9.2%)]" />
        <div className="relative min-h-[610px] p-4 sm:p-7 lg:h-[clamp(660px,calc(100vh-194px),760px)] lg:min-h-0 lg:p-5">
          <div className="hangman-result-paper-enter relative isolate mx-auto flex min-h-[570px] w-full max-w-[900px] flex-col overflow-hidden rounded-[32px] border border-[#8e7041]/40 bg-[#e9ddbd]/95 px-5 py-6 shadow-[inset_0_0_70px_rgba(104,77,39,0.22),0_22px_46px_rgba(0,0,0,0.3)] sm:px-10 sm:py-8 lg:h-full lg:min-h-0 lg:px-8 lg:py-5">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_31px,rgba(74,111,146,0.12)_32px,transparent_33px),radial-gradient(circle_at_16%_7%,rgba(255,255,255,0.5),transparent_27%)]" />
            <div className="pointer-events-none absolute bottom-0 left-[9%] top-0 w-px bg-[rgba(179,71,71,0.28)]" />
            <div className="relative flex items-center justify-between border-b border-slate-700/20 pb-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">
              <span>{word.category}</span><span>Notebook result</span>
            </div>
            <div className="relative flex flex-1 flex-col items-center justify-center py-4 text-center lg:py-2">
              <div className="hangman-result-stage relative h-[252px] w-full max-w-[590px] sm:h-[300px] sm:max-w-[700px] lg:h-[min(330px,42vh)] lg:max-w-[760px]">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] bottom-[7%] top-[9%] rounded-[46%] bg-[radial-gradient(ellipse_at_center,rgba(218,163,45,0.16),rgba(218,163,45,0.03)_46%,transparent_72%)]" />
                <NotebookResultDoodle outcomeTier={outcomeTier} />
              </div>
              <div className={`mt-1 transition-all duration-500 ${resultBeat === "doodle" ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"} ${resultBeat !== "doodle" ? "hangman-result-title-beat" : ""}`}>
                <h2 className="font-serif text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">{outcome.title}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-600 sm:text-base">{outcome.message}</p>
              </div>
              <div className={`mt-5 transition-all duration-500 ${resultBeat === "award" || resultBeat === "cta" ? "translate-y-0 opacity-100 hangman-result-award-beat" : "translate-y-2 opacity-0"}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-600">Award</div>
                <div className="mt-1 font-serif text-4xl font-black tracking-[0.06em] text-slate-800 sm:text-5xl">{isWinner ? `${countUpValue} PTS` : "NO PRIZE"}</div>
              </div>
            </div>
            <div className={`relative flex justify-center pt-2 transition-all duration-500 ${resultBeat === "cta" ? "translate-y-0 opacity-100 hangman-result-cta-beat" : "pointer-events-none translate-y-2 opacity-0"}`}>
              <button disabled={buyAgainPending} onClick={onBuyAgain} className="w-full max-w-[390px] rounded-full border border-[#855b1c]/45 bg-[linear-gradient(180deg,#d7ae57,#81540e)] px-8 py-3.5 text-sm font-black uppercase tracking-[0.24em] text-[#fff5dc] shadow-[0_10px_18px_rgba(76,49,9,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{buyAgainPending ? "Preparing New Ticket" : isWinner ? "Scratch Another Word" : "Try Another Word"}</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-[36px] border border-slate-700 bg-[#171a1d] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      <style>{`@keyframes hangman-pencil-line { from { stroke-dashoffset: 170; opacity: .15; } to { stroke-dashoffset: 0; opacity: 1; } } @keyframes hangman-pencil-nib { 0% { transform: translate(-12px, 12px); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(0, 0); opacity: .2; } } .hangman-pencil-stroke { stroke-dasharray: 170; animation: hangman-pencil-line ${DRAW_DELAY_MS}ms ease-out both; } .hangman-pencil-nib { animation: hangman-pencil-nib ${DRAW_DELAY_MS}ms ease-out both; } @media (prefers-reduced-motion: reduce) { .hangman-pencil-stroke,.hangman-pencil-nib { animation: none; } }`}</style>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(66,126,176,0.11)_0_1px,transparent_1px_34px),linear-gradient(90deg,transparent_0_9%,rgba(212,86,86,0.19)_9%_9.2%,transparent_9.2%)]" />
      <div className="relative min-h-[610px] p-4 sm:p-7 lg:h-[clamp(660px,calc(100vh-194px),760px)] lg:min-h-0 lg:p-5">
        <div className="relative isolate mx-auto flex min-h-[570px] w-full max-w-[900px] flex-col rounded-[32px] border border-[#8e7041]/45 bg-[#e9ddbd]/95 px-5 py-6 shadow-[inset_0_0_70px_rgba(104,77,39,0.26),0_22px_46px_rgba(0,0,0,0.34)] sm:px-10 sm:py-8 lg:h-full lg:min-h-0 lg:px-8 lg:py-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden rounded-[32px]" aria-hidden="true">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_31px,rgba(74,111,146,0.13)_32px,transparent_33px)] opacity-70" />
            <div className="absolute bottom-0 left-[9%] top-0 w-px bg-[rgba(179,71,71,0.34)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_7%,rgba(255,255,255,0.5),transparent_27%),radial-gradient(circle_at_86%_94%,rgba(110,80,39,0.1),transparent_32%)]" />
          </div>
          <div className="relative flex items-center justify-between gap-3 border-b border-slate-700/25 pb-4 text-slate-700 lg:pb-3">
            <div className="text-[10px] font-black uppercase tracking-[0.3em]">{word.category}</div>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
              <span>{drawnParts}/6 marks</span>
              <span className="rounded-full border border-slate-700/25 bg-white/35 px-3 py-1">{revealedTileIds.length}/{revealPlan.length}</span>
            </div>
          </div>
          <div className="relative mx-auto mt-2 h-[220px] w-full max-w-[300px] sm:h-[255px] sm:max-w-[340px] lg:h-[178px] lg:max-w-[260px]">
            <PencilSketch drawnParts={drawnParts} animatingPart={animatingPart} />
          </div>
          <div className="relative mt-2 text-center lg:mt-0">
            <h1 className="font-serif text-2xl font-black tracking-tight text-slate-800 sm:text-3xl lg:text-[1.55rem]">Reveal the letters</h1>
            <p className="mt-1 text-xs font-semibold text-slate-600 lg:text-[11px]">Scratch to uncover the word.</p>
          </div>
          <div className="relative mx-auto mt-5 flex max-w-[720px] flex-wrap justify-center gap-x-3 gap-y-5 sm:mt-6 sm:gap-x-5 lg:mt-2.5 lg:gap-y-2">
            {word.phrase.split("").map((letter, index) => letter === " " ? <div key={`space-${index}`} className="h-16 w-5 sm:h-20 sm:w-8 lg:h-[3.75rem]" aria-hidden="true" /> : <div key={`${letter}-${index}`} className="flex h-16 w-11 items-end justify-center border-b-[2px] border-slate-700/65 pb-1 font-serif text-4xl font-black text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.45)] sm:h-20 sm:w-14 sm:text-5xl lg:h-[3.75rem] lg:w-12 lg:text-4xl">{revealedCorrectLetters.has(letter) ? letter : ""}</div>)}
          </div>
          <div className="relative mx-auto w-full max-w-[720px]">
            <ScratchFoilBoard revealPlan={revealPlan} revealedTileIds={revealedTileIds} onReveal={revealTile} />
          </div>
          {pendingDraws > 0 ? <div className="relative mt-5 text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 lg:mt-3">Pencil is catching up...</div> : null}
        </div>
      </div>
    </section>
  );
}
