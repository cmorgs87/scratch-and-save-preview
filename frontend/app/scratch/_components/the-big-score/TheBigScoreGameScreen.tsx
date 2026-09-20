"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  chooseTheBigScoreVaultNumber,
  confirmTheBigScoreEntrance,
  confirmTheBigScoreGetaway,
  createInitialTheBigScoreGameState,
  getTheBigScoreScratchThreshold,
  isTheBigScoreScratchArmed,
  setTheBigScoreEntrance,
  setTheBigScoreGetaway,
  goToTheBigScoreStep,
  syncTheBigScoreRevealForSelection,
} from "@/lib/the-big-score/theBigScoreLogic";
import type {
  TheBigScoreEntranceId,
  TheBigScoreGetawayId,
  TheBigScoreTicketData,
} from "@/lib/the-big-score/theBigScoreTypes";
import { TheBigScoreScratch } from "./TheBigScoreScratch";
import { TheBigScoreSetup } from "./TheBigScoreSetup";

type TheBigScoreGameScreenProps = {
  ticket: TheBigScoreTicketData;
  buyAgainPending: boolean;
  onBuyAgain: () => void;
  onFinalResultPresented?: (details: { outcome: "win" | "loss" }) => void;
};

const SCRATCH_GRID_COLS = 18;
const SCRATCH_GRID_ROWS = 6;
const SCRATCH_BRUSH_RADIUS = 0.18;

function drawFoil(canvas: HTMLCanvasElement, width: number, height: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const foil = ctx.createLinearGradient(0, 0, width, height);
  foil.addColorStop(0, "#1b1b1c");
  foil.addColorStop(0.42, "#2b2c2f");
  foil.addColorStop(0.7, "#151618");
  foil.addColorStop(1, "#0d0d0e");
  ctx.fillStyle = foil;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#93979d";
  ctx.lineWidth = Math.max(1, width * 0.005);
  for (let x = -height; x < width + height; x += width * 0.2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.55, height);
    ctx.stroke();
  }
  ctx.restore();
}

export function TheBigScoreGameScreen({
  ticket,
  buyAgainPending,
  onBuyAgain,
  onFinalResultPresented,
}: TheBigScoreGameScreenProps) {
  const [state, setState] = useState(() => createInitialTheBigScoreGameState(ticket));
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [selectionAdvanceStep, setSelectionAdvanceStep] = useState<1 | 2 | null>(null);
  const [displayedReward, setDisplayedReward] = useState(0);
  const [scratchedRatio, setScratchedRatio] = useState(0);
  const [scratchComplete, setScratchComplete] = useState(false);
  const scratchWrapRef = useRef<HTMLDivElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchedCellsRef = useRef<Set<string>>(new Set());
  const scratchingRef = useRef(false);
  const selectionAdvanceLockRef = useRef(false);
  const selectionAdvanceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(min-width: 1280px)");
    const syncViewportMode = (event?: MediaQueryListEvent) => {
      setIsDesktopViewport(event ? event.matches : media.matches);
    };

    syncViewportMode();
    media.addEventListener("change", syncViewportMode);
    return () => media.removeEventListener("change", syncViewportMode);
  }, []);

  useEffect(() => {
    selectionAdvanceLockRef.current = false;
  }, [state.currentStep]);

  useEffect(() => {
    return () => {
      if (selectionAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(selectionAdvanceTimeoutRef.current);
      }
    };
  }, []);

  const drawScratchFoil = useCallback(() => {
    const wrap = scratchWrapRef.current;
    const canvas = scratchCanvasRef.current;
    if (!wrap || !canvas) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFoil(canvas, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (state.currentStep !== 3 || scratchComplete) return;
    scratchedCellsRef.current = new Set();
    drawScratchFoil();
    const handleResize = () => drawScratchFoil();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawScratchFoil, scratchComplete, state.currentStep, ticket.sessionId, state.selectedVaultCodeOrder]);

  useEffect(() => {
    if (!scratchComplete || !state.revealedVaultCombination || state.totalWinnings <= 0) return;

    let rafId = 0;
    const start = performance.now();
    const duration = 980;
    const target = state.totalWinnings;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplayedReward(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    rafId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(rafId);
  }, [scratchComplete, state.revealedVaultCombination, state.totalWinnings]);

  const scratchAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = scratchWrapRef.current;
      const canvas = scratchCanvasRef.current;
      if (!wrap || !canvas || state.currentStep !== 3 || scratchComplete || !isTheBigScoreScratchArmed(state)) return;

      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const normalizedX = x / rect.width;
      const normalizedY = y / rect.height;
      const radiusCols = Math.max(1, Math.ceil(SCRATCH_BRUSH_RADIUS * SCRATCH_GRID_COLS));
      const radiusRows = Math.max(1, Math.ceil(SCRATCH_BRUSH_RADIUS * SCRATCH_GRID_ROWS));
      const centerCol = Math.floor(normalizedX * SCRATCH_GRID_COLS);
      const centerRow = Math.floor(normalizedY * SCRATCH_GRID_ROWS);

      for (let row = centerRow - radiusRows; row <= centerRow + radiusRows; row += 1) {
        if (row < 0 || row >= SCRATCH_GRID_ROWS) continue;
        for (let col = centerCol - radiusCols; col <= centerCol + radiusCols; col += 1) {
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

      const nextRatio = scratchedCellsRef.current.size / (SCRATCH_GRID_COLS * SCRATCH_GRID_ROWS);
      setScratchedRatio(nextRatio);

      if (nextRatio >= getTheBigScoreScratchThreshold()) {
        setScratchComplete(true);
        setDisplayedReward(0);
      }
    },
    [scratchComplete, state]
  );

  const handleScratchPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (state.currentStep !== 3 || scratchComplete || !isTheBigScoreScratchArmed(state)) return;
      scratchingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      scratchAtPoint(event.clientX, event.clientY);
    },
    [scratchAtPoint, scratchComplete, state]
  );

  const handleScratchPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!scratchingRef.current || state.currentStep !== 3 || scratchComplete) return;
      scratchAtPoint(event.clientX, event.clientY);
    },
    [scratchAtPoint, scratchComplete, state.currentStep]
  );

  const stopScratch = useCallback(() => {
    scratchingRef.current = false;
  }, []);

  const handleChooseVaultNumber = useCallback((value: number) => {
    setScratchComplete(false);
    setDisplayedReward(0);
    setScratchedRatio(0);
    scratchedCellsRef.current = new Set();
    setState((current) => syncTheBigScoreRevealForSelection(ticket, chooseTheBigScoreVaultNumber(current, value)));
  }, [ticket]);

  const handleSelectEntrance = useCallback((entranceId: TheBigScoreEntranceId) => {
    setState((current) => setTheBigScoreEntrance(current, entranceId));
  }, []);

  const handleSelectGetaway = useCallback((getawayId: TheBigScoreGetawayId) => {
    setState((current) => setTheBigScoreGetaway(current, getawayId));
  }, []);

  const handleChooseEntrance = useCallback((entranceId: TheBigScoreEntranceId) => {
    if (selectionAdvanceLockRef.current) return;
    selectionAdvanceLockRef.current = true;
    setSelectionAdvanceStep(1);
    setState((current) => setTheBigScoreEntrance(current, entranceId));

    if (isDesktopViewport) {
      setState((current) => confirmTheBigScoreEntrance(setTheBigScoreEntrance(current, entranceId)));
      return;
    }

    if (selectionAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(selectionAdvanceTimeoutRef.current);
    }

    selectionAdvanceTimeoutRef.current = window.setTimeout(() => {
      setState((current) => confirmTheBigScoreEntrance(setTheBigScoreEntrance(current, entranceId)));
      selectionAdvanceTimeoutRef.current = null;
    }, 180);
  }, [isDesktopViewport]);

  const handleChooseGetaway = useCallback((getawayId: TheBigScoreGetawayId) => {
    if (selectionAdvanceLockRef.current) return;
    selectionAdvanceLockRef.current = true;
    setSelectionAdvanceStep(2);
    setState((current) => setTheBigScoreGetaway(current, getawayId));

    if (isDesktopViewport) {
      setState((current) => confirmTheBigScoreGetaway(setTheBigScoreGetaway(current, getawayId)));
      return;
    }

    if (selectionAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(selectionAdvanceTimeoutRef.current);
    }

    selectionAdvanceTimeoutRef.current = window.setTimeout(() => {
      setState((current) => confirmTheBigScoreGetaway(setTheBigScoreGetaway(current, getawayId)));
      selectionAdvanceTimeoutRef.current = null;
    }, 180);
  }, [isDesktopViewport]);

  if (state.currentStep < 3) {
    return (
      <div className="mx-auto w-full max-w-[620px] xl:w-[calc(100%-2rem)] xl:max-w-none">
        <TheBigScoreSetup
          state={state}
          onSelectEntrance={handleSelectEntrance}
          onChooseEntrance={handleChooseEntrance}
          onConfirmEntrance={() => setState((current) => confirmTheBigScoreEntrance(current))}
          onSelectGetaway={handleSelectGetaway}
          onChooseGetaway={handleChooseGetaway}
          onConfirmGetaway={() => setState((current) => confirmTheBigScoreGetaway(current))}
          onGoToStep={(step) => setState((current) => goToTheBigScoreStep(current, step))}
          instantCommitSelections
          showSelectionHeader={isDesktopViewport}
          compactSelectionSizing={!isDesktopViewport}
          selectionDisabled={selectionAdvanceStep === state.currentStep}
        />
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full max-w-[620px] ${isDesktopViewport ? "xl:w-[calc(100%-2rem)] xl:max-w-none" : ""}`}>
      <TheBigScoreScratch
        ticket={ticket}
        state={state}
        scratchedRatio={scratchedRatio}
        scratchComplete={scratchComplete}
        displayedReward={displayedReward}
        buyAgainPending={buyAgainPending}
        isDesktopViewport={isDesktopViewport}
        scratchWrapRef={scratchWrapRef}
        scratchCanvasRef={scratchCanvasRef}
        onChooseVaultNumber={handleChooseVaultNumber}
        onScratchPointerDown={handleScratchPointerDown}
        onScratchPointerMove={handleScratchPointerMove}
        onScratchPointerUp={stopScratch}
        onScratchPointerCancel={stopScratch}
        onScratchPointerLeave={stopScratch}
        onBuyAgain={onBuyAgain}
        onFinalResultPresented={onFinalResultPresented}
      />
    </div>
  );
}
