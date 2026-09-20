"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  TRIPLE_CROWN_DERBY_LOGO_SRC,
  TRIPLE_CROWN_DERBY_SCRATCH_THRESHOLD,
  getTripleCrownDerbyHorse,
} from "@/lib/triple-crown-derby/tripleCrownDerbyConfig";
import {
  assignTripleCrownDerbyPick,
  createTripleCrownDerbyRaceResult,
  createInitialTripleCrownDerbyGameState,
  formatTripleCrownDerbyPickLabel,
  getTripleCrownDerbyWinningTier,
  isTripleCrownDerbyScratchArmed,
  settleTripleCrownDerbyReveal,
  updateTripleCrownDerbyScratchProgress,
} from "@/lib/triple-crown-derby/tripleCrownDerbyEngine";
import type {
  TripleCrownDerbyHorse,
  TripleCrownDerbyHorseId,
  TripleCrownDerbyPickSlot,
  TripleCrownDerbyTicketData,
} from "@/lib/triple-crown-derby/tripleCrownDerbyTypes";

type TripleCrownDerbyGameScreenProps = {
  ticket: TripleCrownDerbyTicketData;
  buyAgainPending: boolean;
  onBuyAgain: () => void;
  onFinalResultPresented?: (details: { outcome: "win" | "loss" }) => void;
};

const SLOT_BADGE: Record<TripleCrownDerbyPickSlot, string> = {
  win: "bg-rose-500 text-white",
  place: "bg-cyan-300 text-slate-950",
  show: "bg-amber-300 text-slate-950",
};

const DERBY_WIN_VIDEO_FULL_SRC: Record<TripleCrownDerbyHorseId, string> = {
  midnight_thunder: "/triple-crown-derby/video/midnight_thunder.mp4",
  blazing_comet: "/triple-crown-derby/video/blazing_comet.mp4",
  silver_phantom: "/triple-crown-derby/video/silver_phantom.mp4",
  golden_stride: "/triple-crown-derby/video/golden_stride.mp4",
  iron_valor: "/triple-crown-derby/video/iron_valor.mp4",
  crimson_dash: "/triple-crown-derby/video/crimson_dash.mp4",
};

const DERBY_WIN_VIDEO_SHORT_SRC: Record<TripleCrownDerbyHorseId, string> = {
  midnight_thunder: "/triple-crown-derby/video/midnight_thunder_short.mp4",
  blazing_comet: "/triple-crown-derby/video/blazing_comet_short.mp4",
  silver_phantom: "/triple-crown-derby/video/silver_phantom_short.mp4",
  golden_stride: "/triple-crown-derby/video/golden_stride_short.mp4",
  iron_valor: "/triple-crown-derby/video/iron_valor_short.mp4",
  crimson_dash: "/triple-crown-derby/video/crimson_dash_short.mp4",
};

const WINNING_SLOT_SEQUENCE: TripleCrownDerbyPickSlot[] = ["show", "place", "win"];
const FEATURED_DERBY_WIN_TIERS = new Set([
  "across_the_board",
  "box_bet_bonus",
  "exacta_win",
  "trifecta_jackpot",
]);

type ScratchInteractionStyle = CSSProperties & {
  WebkitUserDrag?: "none";
};

const DESKTOP_SCRATCH_REGION_STYLE: ScratchInteractionStyle = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitUserDrag: "none",
};

const DESKTOP_SCRATCH_CANVAS_STYLE: ScratchInteractionStyle = {
  ...DESKTOP_SCRATCH_REGION_STYLE,
  touchAction: "none",
};

const TREATMENT_CLASSES = {
  bronze: "from-[#603119] via-[#9b5b2b] to-[#f5c27e]",
  silver: "from-[#506274] via-[#b8d1e7] to-[#f6fbff]",
  gold: "from-[#7b4e13] via-[#ffc857] to-[#fff2bb]",
  violet: "from-[#3f175b] via-[#7f3cff] to-[#f2bdff]",
  jackpot: "from-[#4b1b00] via-[#ffbf47] to-[#fff3b4]",
} as const;

function countAlphaRatio(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const step = 12;
  let cleared = 0;
  let sampled = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      sampled += 1;
      if (ctx.getImageData(x, y, 1, 1).data[3] < 18) {
        cleared += 1;
      }
    }
  }
  return sampled ? cleared / sampled : 0;
}

function drawFoil(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff4c5");
  gradient.addColorStop(0.18, "#f4cf73");
  gradient.addColorStop(0.36, "#c7c2cb");
  gradient.addColorStop(0.58, "#8e909c");
  gradient.addColorStop(0.82, "#f7d787");
  gradient.addColorStop(1, "#fff5d7");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(3, width * 0.01);
  for (let x = -height; x < width + height; x += width * 0.18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.6, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#6c4110";
  ctx.lineWidth = Math.max(2, width * 0.006);
  const patternGap = width * 0.18;
  for (let y = height * 0.18; y < height; y += patternGap * 0.6) {
    for (let x = width * 0.1; x < width; x += patternGap) {
      ctx.beginPath();
      ctx.arc(x, y, width * 0.03, Math.PI * 0.08, Math.PI * 0.92, false);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.fillStyle = "rgba(41, 18, 6, 0.78)";
  ctx.font = `700 ${Math.max(18, width * 0.046)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Scratch to Reveal the Race Results", width / 2, height * 0.48);
}

function formatAmount(amount: number) {
  return amount.toLocaleString();
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function getHorseById(horses: readonly TripleCrownDerbyHorse[], horseId: TripleCrownDerbyHorseId | null) {
  return horseId ? horses.find((horse) => horse.id === horseId) ?? getTripleCrownDerbyHorse(horseId) : null;
}

function HorseCard({
  horse,
  selectedSlots,
  active,
  disabled,
  onClick,
}: {
  horse: TripleCrownDerbyHorse;
  selectedSlots: TripleCrownDerbyPickSlot[];
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative text-left transition ${
        active ? "scale-[1.02]" : "hover:scale-[1.01]"
      } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <div className="relative">
        <div className="absolute right-1 top-1 z-10 flex flex-col items-end gap-1.5 sm:right-2 sm:top-2">
          {selectedSlots.map((slot) => (
            <span key={`${horse.id}-${slot}`} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] shadow-[0_8px_18px_rgba(0,0,0,0.26)] ${SLOT_BADGE[slot]}`}>
              {formatTripleCrownDerbyPickLabel(slot)}
            </span>
          ))}
        </div>
        <div
          className={`relative overflow-hidden rounded-[20px] transition ${
            active
              ? "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_52%)] shadow-[0_18px_46px_rgba(120,86,255,0.22)]"
              : "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]"
          }`}
        >
          <div className={`absolute inset-0 rounded-[20px] bg-gradient-to-b ${horse.accent} opacity-[0.12] transition group-hover:opacity-[0.18]`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={horse.imageSrc}
            alt={horse.name}
            className="relative z-[1] h-[220px] w-full scale-[1.16] object-contain object-center sm:h-[260px] sm:scale-[1.22] xl:h-[170px] xl:scale-[1.12] 2xl:h-[190px]"
          />
        </div>
      </div>
    </button>
  );
}

export function TripleCrownDerbyGameScreen({
  ticket,
  buyAgainPending,
  onBuyAgain,
  onFinalResultPresented,
}: TripleCrownDerbyGameScreenProps) {
  const [state, setState] = useState(() => createInitialTripleCrownDerbyGameState());
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [displayedReward, setDisplayedReward] = useState(0);
  const [prizeLadderOpen, setPrizeLadderOpen] = useState(false);
  const [winVideoIndex, setWinVideoIndex] = useState(0);
  const [winVideoSequenceComplete, setWinVideoSequenceComplete] = useState(false);
  const [winVideoNeedsTap, setWinVideoNeedsTap] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const foilHostRef = useRef<HTMLDivElement | null>(null);
  const scratchRowRef = useRef<HTMLDivElement | null>(null);
  const winVideoRef = useRef<HTMLVideoElement | null>(null);
  const resultPresentedRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const picksComplete = isTripleCrownDerbyScratchArmed(state);
  const authoritativeRewardAmount = ticket.rewardAmount;
  const winningTier = getTripleCrownDerbyWinningTier(ticket, state.raceResult);
  const armedRaceResult = useMemo(() => {
    if (!picksComplete) return null;
    return createTripleCrownDerbyRaceResult(ticket, state.picks as { win: TripleCrownDerbyHorseId; place: TripleCrownDerbyHorseId; show: TripleCrownDerbyHorseId });
  }, [picksComplete, state.picks, ticket]);
  const visibleRaceResult = state.raceResult ?? armedRaceResult;
  const topThree = useMemo(() => visibleRaceResult?.podium.map((horseId) => getTripleCrownDerbyHorse(horseId)) ?? [], [visibleRaceResult]);
  const finishOrder = useMemo(() => visibleRaceResult?.finishOrder.map((horseId) => getTripleCrownDerbyHorse(horseId)) ?? [], [visibleRaceResult]);
  const winningVideoQueue = useMemo(() => {
    if (state.phase !== "revealed" || authoritativeRewardAmount <= 0) return [];
    const baseQueue = WINNING_SLOT_SEQUENCE.map((slot) => {
      if (!state.raceResult?.winningPickSlots.includes(slot)) return null;
      const horse = getHorseById(ticket.horses, state.picks[slot]);
      if (!horse) return null;
      return {
        slot,
        horse,
      };
    }).filter(
      (
        entry
      ): entry is {
        slot: TripleCrownDerbyPickSlot;
        horse: TripleCrownDerbyHorse;
      } => Boolean(entry)
    );

    if (baseQueue.length <= 1) {
      return baseQueue.map((entry) => ({
        ...entry,
        src: DERBY_WIN_VIDEO_FULL_SRC[entry.horse.id],
      }));
    }

    return baseQueue.map((entry, index) => ({
      ...entry,
      src:
        index === baseQueue.length - 1
          ? DERBY_WIN_VIDEO_FULL_SRC[entry.horse.id]
          : DERBY_WIN_VIDEO_SHORT_SRC[entry.horse.id] ?? DERBY_WIN_VIDEO_FULL_SRC[entry.horse.id],
    }));
  }, [authoritativeRewardAmount, state.phase, state.picks, state.raceResult, ticket.horses]);
  const activeWinningVideo = winningVideoQueue[winVideoIndex] ?? null;
  const showWinningVideoOverlay = Boolean(activeWinningVideo) && !winVideoSequenceComplete;
  const showWinningResultCard =
    state.phase === "revealed" && authoritativeRewardAmount > 0 && (winningVideoQueue.length === 0 || winVideoSequenceComplete);
  const showLosingResultCard = state.phase === "revealed" && Boolean(state.raceResult) && authoritativeRewardAmount <= 0;
  const winHitMultiplier = winningVideoQueue.length > 1 ? winningVideoQueue.length : 1;
  const showFeaturedWinTreatment = Boolean(winningTier && FEATURED_DERBY_WIN_TIERS.has(winningTier.id));
  const getScratchHost = useCallback(
    () => (isDesktopViewport ? scratchRowRef.current : foilHostRef.current),
    [isDesktopViewport]
  );

  useEffect(() => {
    resultPresentedRef.current = false;
  }, [ticket.sessionId]);

  useEffect(() => {
    const outcome = showWinningResultCard ? "win" : showLosingResultCard ? "loss" : null;
    if (!outcome) {
      resultPresentedRef.current = false;
      return;
    }
    if (resultPresentedRef.current) return;
    resultPresentedRef.current = true;
    onFinalResultPresented?.({ outcome });
  }, [onFinalResultPresented, showLosingResultCard, showWinningResultCard]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(min-width: 1280px)");
    const syncViewport = (event?: MediaQueryListEvent) => {
      setIsDesktopViewport(event ? event.matches : media.matches);
    };

    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const playActiveWinningVideo = useCallback(async () => {
    const video = winVideoRef.current;
    if (!video || !activeWinningVideo || winVideoSequenceComplete || state.phase !== "revealed" || authoritativeRewardAmount <= 0) {
      return;
    }

    try {
      video.currentTime = 0;
      video.muted = false;
      video.volume = 1;
      await video.play();
      setWinVideoNeedsTap(false);
    } catch {
      setWinVideoNeedsTap(true);
    }
  }, [activeWinningVideo, authoritativeRewardAmount, state.phase, winVideoSequenceComplete]);

  const updateDisplayedRewardProgress = useCallback(
    (progress: number) => {
      const target = authoritativeRewardAmount;
      const normalizedProgress = Math.min(1, Math.max(0, progress));
      setDisplayedReward(Math.round(target * easeOutCubic(normalizedProgress)));
    },
    [authoritativeRewardAmount]
  );

  const handleWinningVideoTimeUpdate = useCallback(() => {
    const video = winVideoRef.current;
    const target = authoritativeRewardAmount;
    if (!video || target <= 0 || winningVideoQueue.length === 0) return;

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const clipProgress = Math.min(1, Math.max(0, video.currentTime / duration));
    const overallProgress = (winVideoIndex + clipProgress) / winningVideoQueue.length;
    updateDisplayedRewardProgress(overallProgress);
  }, [authoritativeRewardAmount, updateDisplayedRewardProgress, winVideoIndex, winningVideoQueue.length]);

  const advanceWinningVideoSequence = useCallback(() => {
    setWinVideoNeedsTap(false);

    if (winVideoIndex < winningVideoQueue.length - 1) {
      setWinVideoIndex((current) => current + 1);
      return;
    }

    setDisplayedReward(authoritativeRewardAmount);
    setWinVideoSequenceComplete(true);
  }, [authoritativeRewardAmount, winVideoIndex, winningVideoQueue.length]);

  useEffect(() => {
    const host = getScratchHost();
    if (!host || state.scratchComplete || !picksComplete) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      drawFoil(canvas);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [getScratchHost, picksComplete, state.scratchComplete, ticket.sessionId]);

  useEffect(() => {
    if (state.phase !== "photo_finish") return;
    const timeoutId = window.setTimeout(() => {
      setState((current) => settleTripleCrownDerbyReveal(current));
    }, 950);
    return () => window.clearTimeout(timeoutId);
  }, [state.phase]);

  useEffect(() => {
    if (authoritativeRewardAmount <= 0) {
      if (state.phase !== "revealed") {
        const resetFrame = window.requestAnimationFrame(() => {
          setDisplayedReward(0);
        });
        return () => window.cancelAnimationFrame(resetFrame);
      }
      return;
    }

    if (winningVideoQueue.length > 0) {
      if (showWinningResultCard) {
        const settleFrame = window.requestAnimationFrame(() => {
          setDisplayedReward(authoritativeRewardAmount);
        });
        return () => window.cancelAnimationFrame(settleFrame);
      }
      return;
    }

    if (!showWinningResultCard) {
      return;
    }

    let frameId = 0;
    const startedAt = performance.now();
    const duration = 950;
    const target = authoritativeRewardAmount;

    const tick = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      setDisplayedReward(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [authoritativeRewardAmount, showWinningResultCard, state.phase, state.raceResult, winVideoSequenceComplete, winningVideoQueue.length]);

  useEffect(() => {
    const resetFrame = window.requestAnimationFrame(() => {
      if (state.phase !== "revealed" || authoritativeRewardAmount <= 0) {
        setWinVideoIndex(0);
        setWinVideoSequenceComplete(false);
        setWinVideoNeedsTap(false);
        setDisplayedReward(0);
        return;
      }
      setWinVideoIndex(0);
      setWinVideoSequenceComplete(winningVideoQueue.length === 0);
      setWinVideoNeedsTap(false);
      setDisplayedReward(0);
    });

    return () => window.cancelAnimationFrame(resetFrame);
  }, [authoritativeRewardAmount, state.phase, ticket.sessionId, winningVideoQueue.length]);

  useEffect(() => {
    if (state.phase !== "revealed" || authoritativeRewardAmount <= 0 || winVideoNeedsTap) {
      return;
    }
    const playFrame = window.requestAnimationFrame(() => {
      void playActiveWinningVideo();
    });
    return () => window.cancelAnimationFrame(playFrame);
  }, [authoritativeRewardAmount, playActiveWinningVideo, state.phase, winVideoNeedsTap]);

  useEffect(() => {
    if (!showWinningVideoOverlay || authoritativeRewardAmount <= 0 || winningVideoQueue.length === 0) {
      return;
    }
    const syncFrame = window.requestAnimationFrame(() => {
      updateDisplayedRewardProgress(winVideoIndex / winningVideoQueue.length);
    });
    return () => window.cancelAnimationFrame(syncFrame);
  }, [authoritativeRewardAmount, showWinningVideoOverlay, updateDisplayedRewardProgress, winVideoIndex, winningVideoQueue.length]);

  function scratchAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const host = getScratchHost();
    if (!canvas || !host || state.scratchComplete || !picksComplete) return;

    const rect = host.getBoundingClientRect();
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = Math.max(rect.width * 0.08, 32);
    const last = lastPointRef.current;
    ctx.beginPath();
    if (last) {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.001, y + 0.001);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(rect.width * 0.035, 18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    lastPointRef.current = { x, y };
    const scratchedRatio = countAlphaRatio(ctx, canvas.width, canvas.height);
    setState((current) => updateTripleCrownDerbyScratchProgress(ticket, current, scratchedRatio));
  }

  const activePickHorse = getHorseById(ticket.horses, state.picks[state.activeSlot]);
  const selectedHorseIds = useMemo(
    () => new Set((["win", "place", "show"] as const).map((slot) => state.picks[slot]).filter((horseId): horseId is TripleCrownDerbyHorseId => Boolean(horseId))),
    [state.picks]
  );

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,225,132,0.14),transparent_32%),radial-gradient(circle_at_50%_0%,rgba(143,76,255,0.18),transparent_40%),linear-gradient(180deg,#120916,#0b0610_68%,#100a17)] p-4 shadow-[0_36px_110px_rgba(0,0,0,0.42)] sm:p-6 xl:p-2">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:34px_34px] opacity-20" />
      <div className="relative">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,11,27,0.96),rgba(7,5,13,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6 xl:relative xl:px-2 xl:pt-2.5 xl:pb-2">
          <div className="mx-auto max-w-[520px] xl:flex xl:h-[224px] xl:max-w-[500px] xl:items-center xl:justify-center xl:overflow-visible 2xl:h-[236px] 2xl:max-w-[540px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={TRIPLE_CROWN_DERBY_LOGO_SRC}
              alt="Triple Crown Derby"
              className="mx-auto w-full object-contain xl:h-[252px] xl:w-auto xl:max-w-none xl:translate-y-2 2xl:h-[264px]"
            />
          </div>
          <div className="mt-2 hidden text-center text-sm font-semibold text-[#f6e7ba]/82 xl:block">
            Place your bets! Pick 3 horses, one to win, one to place and one to show!
          </div>
          <div className="mt-3 hidden items-center justify-between gap-3 xl:absolute xl:inset-x-4 xl:bottom-3 xl:mt-0">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f2d59a]/64">Race Board</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.26em] text-white/55">
              {state.scratchComplete ? "Race posted" : picksComplete ? `${Math.round(state.scratchedRatio * 100)}% cleared` : `Active: ${formatTripleCrownDerbyPickLabel(state.activeSlot)}`}
            </div>
          </div>
          <div className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f3d89a]/70 xl:hidden">Premium Race Ticket</div>
          <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-6 text-white/72 sm:text-[15px] xl:hidden">
            Pick 3 horses: one to Win, one to Place, and one to Show. Scratch the race results to reveal the final finish.
          </p>
        </div>

        <div className="mt-5 space-y-5 xl:mt-0 xl:space-y-0">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,15,22,0.98),rgba(9,7,13,0.98))] p-4 shadow-[0_26px_80px_rgba(0,0,0,0.3)] sm:p-5 xl:p-4">
              <div className="flex items-center justify-between gap-3 xl:hidden">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f2d59a]/64">Race Board</div>
                  <div className="mt-2 text-lg font-semibold text-white xl:mt-1 xl:text-base">
                    {state.phase === "photo_finish"
                      ? "Photo Finish..."
                      : state.phase === "revealed"
                        ? state.raceResult?.headline ?? "Race Results"
                        : picksComplete
                          ? "Scratch to reveal the podium"
                        : activePickHorse
                          ? `Assigning ${activePickHorse.name} to ${formatTripleCrownDerbyPickLabel(state.activeSlot)}`
                          : `Tap a horse to lock your ${formatTripleCrownDerbyPickLabel(state.activeSlot)} pick`}
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/55 xl:px-2.5 xl:py-1.5 xl:text-[9px]">
                  {state.scratchComplete ? "Race posted" : picksComplete ? `${Math.round(state.scratchedRatio * 100)}% cleared` : `Active: ${formatTripleCrownDerbyPickLabel(state.activeSlot)}`}
                </div>
              </div>

              <div
                ref={foilHostRef}
                className={`relative mt-4 overflow-hidden rounded-[24px] border border-[#e2bd72]/28 bg-[radial-gradient(circle_at_top,rgba(255,229,162,0.18),transparent_32%),linear-gradient(180deg,#221218,#0b0811)] xl:h-[420px] ${
                  state.scratchComplete ? "aspect-[1.04/1] xl:aspect-auto" : ""
                }`}
                onPointerDown={(event) => {
                  if (isDesktopViewport || !picksComplete || state.scratchComplete) return;
                  isPointerDownRef.current = true;
                  activePointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  scratchAt(event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  if (isDesktopViewport || !isPointerDownRef.current || !picksComplete || state.scratchComplete) return;
                  scratchAt(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  isPointerDownRef.current = false;
                  if (activePointerIdRef.current === event.pointerId) {
                    activePointerIdRef.current = null;
                  }
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  lastPointRef.current = null;
                }}
                onPointerCancel={(event) => {
                  isPointerDownRef.current = false;
                  if (activePointerIdRef.current === event.pointerId) {
                    activePointerIdRef.current = null;
                  }
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  lastPointRef.current = null;
                }}
                onPointerLeave={() => {
                  if (activePointerIdRef.current !== null) return;
                  lastPointRef.current = null;
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(162,109,255,0.22),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_22%)]" />
                <div className="relative flex h-full flex-col overflow-y-auto p-4 sm:p-5 xl:p-3">
                  {picksComplete ? (
                    <>
                      <div
                        ref={scratchRowRef}
                        className={`relative overflow-hidden rounded-[22px] ${
                          !state.scratchComplete ? "xl:cursor-[crosshair] xl:select-none" : ""
                        }`}
                        onDragStart={(event) => {
                          if (!isDesktopViewport || !picksComplete || state.scratchComplete) return;
                          event.preventDefault();
                        }}
                        style={
                          isDesktopViewport && picksComplete && !state.scratchComplete
                            ? DESKTOP_SCRATCH_REGION_STYLE
                            : undefined
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-3 xl:gap-2.5">
                        {["1st", "2nd", "3rd"].map((label, index) => {
                          const horse = topThree[index];
                          const pickSlots = horse ? (["win", "place", "show"] as const).filter((slot) => state.picks[slot] === horse.id) : [];
                          return (
                            <div key={label} className={`relative overflow-hidden rounded-[22px] border px-3 py-3 transition ${horse ? "border-white/14 bg-white/[0.06] shadow-[0_16px_40px_rgba(0,0,0,0.22)]" : "border-white/8 bg-white/[0.03]"}`}>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/48">{label}</div>
                              {horse ? (
                                <>
                                  <div className="mt-3 overflow-hidden rounded-[18px] border border-white/10 bg-black/18">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={horse.imageSrc}
                                      alt={horse.name}
                                      draggable={isDesktopViewport ? false : undefined}
                                      className="h-[108px] w-full object-contain object-center xl:h-[88px]"
                                      onDragStart={(event) => {
                                        if (!isDesktopViewport || state.scratchComplete) return;
                                        event.preventDefault();
                                      }}
                                    />
                                  </div>
                                  <div className="mt-3 text-base font-semibold text-white xl:mt-2 xl:text-sm">{horse.name}</div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.22em] text-white/42 xl:text-[10px]">Horse {horse.number}</div>
                                  <div className="mt-3 flex items-center gap-2 xl:mt-2">
                                    <span
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-base font-black shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
                                        selectedHorseIds.has(horse.id)
                                          ? "border-emerald-300/50 bg-emerald-400/18 text-emerald-200"
                                          : "border-rose-300/40 bg-rose-500/14 text-rose-200"
                                      }`}
                                      aria-label={selectedHorseIds.has(horse.id) ? "Picked horse" : "Not picked"}
                                    >
                                      {selectedHorseIds.has(horse.id) ? "✓" : "✕"}
                                    </span>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/48">
                                      {selectedHorseIds.has(horse.id) ? "Your Pick" : "Missed Pick"}
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {pickSlots.map((slot) => (
                                      <span key={`${horse.id}-${slot}`} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${SLOT_BADGE[slot]}`}>
                                        {formatTripleCrownDerbyPickLabel(slot)}
                                      </span>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="mt-3 flex h-[176px] items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-black/16 text-sm uppercase tracking-[0.24em] text-white/24 xl:h-[132px]">
                                  Hidden
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                        {!state.scratchComplete && picksComplete && isDesktopViewport ? (
                          <canvas
                            ref={canvasRef}
                            className="absolute inset-0 z-20 cursor-[crosshair] touch-none select-none"
                            aria-label={`Scratch foil armed at ${Math.round(TRIPLE_CROWN_DERBY_SCRATCH_THRESHOLD * 100)} percent`}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              isPointerDownRef.current = true;
                              activePointerIdRef.current = event.pointerId;
                              event.currentTarget.setPointerCapture(event.pointerId);
                              scratchAt(event.clientX, event.clientY);
                            }}
                            onPointerMove={(event) => {
                              if (!isPointerDownRef.current || state.scratchComplete || !picksComplete) return;
                              event.preventDefault();
                              scratchAt(event.clientX, event.clientY);
                            }}
                            onPointerUp={(event) => {
                              event.preventDefault();
                              isPointerDownRef.current = false;
                              if (activePointerIdRef.current === event.pointerId) {
                                activePointerIdRef.current = null;
                              }
                              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                event.currentTarget.releasePointerCapture(event.pointerId);
                              }
                              lastPointRef.current = null;
                            }}
                            onPointerCancel={(event) => {
                              event.preventDefault();
                              isPointerDownRef.current = false;
                              if (activePointerIdRef.current === event.pointerId) {
                                activePointerIdRef.current = null;
                              }
                              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                event.currentTarget.releasePointerCapture(event.pointerId);
                              }
                              lastPointRef.current = null;
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onDragStart={(event) => {
                              event.preventDefault();
                            }}
                            style={DESKTOP_SCRATCH_CANVAS_STYLE}
                          />
                        ) : null}
                      </div>
                      {state.scratchComplete ? (
                        <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 px-4 py-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/50">Full Running Order</div>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                            {finishOrder.map((horse, index) => {
                              const selectedSlots = (["win", "place", "show"] as const).filter((slot) => state.picks[slot] === horse.id);
                              return (
                                <div key={`${horse.id}-${index}`} className="rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/46">{index + 1}</div>
                                  <div className="mt-1 text-sm font-semibold text-white">{horse.name}</div>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {selectedSlots.map((slot) => (
                                      <span key={`${horse.id}-${slot}-finish`} className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${SLOT_BADGE[slot]}`}>
                                        {formatTripleCrownDerbyPickLabel(slot)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:gap-2.5">
                      {ticket.horses.map((horse) => {
                        const selectedSlots = (["win", "place", "show"] as const).filter((slot) => state.picks[slot] === horse.id);
                        return (
                          <HorseCard
                            key={horse.id}
                            horse={horse}
                            selectedSlots={selectedSlots}
                            active={selectedSlots.includes(state.activeSlot)}
                            disabled={false}
                            onClick={() => setState((current) => assignTripleCrownDerbyPick(current, current.activeSlot, horse.id))}
                          />
                        );
                      })}
                    </div>
                  )}

                  {state.phase === "photo_finish" ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(8,5,12,0.3),rgba(8,5,12,0.66))]">
                      <div className="rounded-[24px] border border-[#f2d59a]/28 bg-[linear-gradient(180deg,rgba(38,20,33,0.9),rgba(18,8,16,0.95))] px-8 py-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#f2d59a]/72">Photo Finish</div>
                        <div className="mt-3 text-3xl font-black uppercase tracking-[0.12em] text-white">And They Hit the Wire</div>
                        <div className="mt-3 text-sm text-white/66">Hold tight while the stewards post the result.</div>
                      </div>
                    </div>
                  ) : null}

                  {showWinningVideoOverlay ? (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[linear-gradient(180deg,rgba(8,5,12,0.2),rgba(8,5,12,0.6))] p-4">
                      <div className="relative w-full overflow-hidden rounded-[24px] border border-[#f2d59a]/28 bg-[linear-gradient(180deg,rgba(33,16,30,0.92),rgba(14,7,16,0.96))] shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
                        <video
                          key={activeWinningVideo?.horse.id}
                          ref={winVideoRef}
                          className="aspect-[16/9] w-full bg-black object-cover"
                          playsInline
                          preload="auto"
                          onTimeUpdate={handleWinningVideoTimeUpdate}
                          onEnded={advanceWinningVideoSequence}
                          onError={advanceWinningVideoSequence}
                        >
                          {activeWinningVideo ? <source src={activeWinningVideo.src} type="video/mp4" /> : null}
                        </video>
                        <div className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,rgba(8,5,12,0.84),rgba(8,5,12,0))] px-5 py-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#f2d59a]/72">
                            {activeWinningVideo ? formatTripleCrownDerbyPickLabel(activeWinningVideo.slot) : "Winner"}
                          </div>
                          <div className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-white">
                            {activeWinningVideo?.horse.name}
                          </div>
                        </div>
                        <div className="pointer-events-none absolute bottom-5 right-5 z-10">
                          <div
                            className={`rounded-[16px] border border-white/12 bg-gradient-to-r px-4 py-3 text-right shadow-[0_18px_42px_rgba(0,0,0,0.34)] ${
                              TREATMENT_CLASSES[winningTier?.treatment ?? "silver"]
                            }`}
                          >
                            <div className="text-2xl font-black tabular-nums text-slate-950">{formatAmount(displayedReward)}</div>
                          </div>
                        </div>
                        {winVideoNeedsTap ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(8,5,12,0.26),rgba(8,5,12,0.72))] p-4">
                            <button
                              type="button"
                              onClick={() => {
                                void playActiveWinningVideo();
                              }}
                              className="rounded-full bg-[linear-gradient(135deg,#fff0a9,#ffc65c)] px-7 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#201108] shadow-[0_18px_48px_rgba(255,184,72,0.28)] transition hover:brightness-105"
                            >
                              Tap for Sound
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {showWinningResultCard ? (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[linear-gradient(180deg,rgba(8,5,12,0.2),rgba(8,5,12,0.6))] p-4">
                      <div
                        className={`relative w-full overflow-hidden rounded-[30px] px-6 py-6 text-center ${
                          showFeaturedWinTreatment
                            ? "max-w-[440px] border border-[#f5d58a]/35 bg-[linear-gradient(180deg,rgba(61,31,10,0.98),rgba(24,10,5,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.5),0_0_44px_rgba(255,196,82,0.12)]"
                            : `max-w-[420px] border border-white/12 bg-gradient-to-r shadow-[0_24px_80px_rgba(0,0,0,0.38)] ${TREATMENT_CLASSES[winningTier?.treatment ?? "silver"]}`
                        }`}
                      >
                        {showFeaturedWinTreatment ? (
                          <>
                            <div className="pointer-events-none absolute inset-x-10 top-0 h-28 bg-[radial-gradient(circle,rgba(255,216,124,0.34),rgba(255,190,74,0.08)_58%,transparent_76%)] blur-3xl" />
                            <div className="pointer-events-none absolute inset-x-12 bottom-0 h-24 bg-[radial-gradient(circle,rgba(255,213,120,0.16),rgba(255,190,74,0.04)_56%,transparent_78%)] blur-3xl" />
                          </>
                        ) : null}
                        {showFeaturedWinTreatment ? (
                          <div className="mb-5 flex justify-center">
                            <div className="inline-flex min-w-[280px] max-w-full flex-col items-center justify-center rounded-[22px] border border-[#f5d58a]/28 bg-[linear-gradient(180deg,rgba(255,239,187,0.98),rgba(255,205,94,0.94))] px-8 py-5 shadow-[0_20px_48px_rgba(166,104,8,0.22)]">
                              <div className="text-[31px] font-black uppercase tracking-[0.08em] text-[#4d2900] drop-shadow-[0_2px_0_rgba(255,246,214,0.38)]">
                                {winningTier?.label ?? "Payout"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-950/70">
                            {winningTier?.label ?? "Payout"}
                          </div>
                        )}
                        {winHitMultiplier > 1 ? (
                          <div className="mt-4 flex justify-center">
                            <div
                              className={`inline-flex items-center rounded-full border px-5 py-2 text-[13px] font-black uppercase tracking-[0.28em] shadow-[0_14px_34px_rgba(0,0,0,0.18)] ${
                                showFeaturedWinTreatment
                                  ? "border-[#f5d58a]/38 bg-[linear-gradient(180deg,rgba(255,237,176,0.22),rgba(255,198,88,0.12))] text-[#fff0bc]"
                                  : "border-slate-950/12 bg-white/38 text-slate-950/78"
                              }`}
                            >
                              x{winHitMultiplier} Multi-Win
                            </div>
                          </div>
                        ) : null}
                        <div className={`${showFeaturedWinTreatment ? "mt-5 text-6xl text-[#fff0c2] drop-shadow-[0_3px_14px_rgba(255,210,88,0.2)]" : "mt-3 text-5xl text-slate-950"} font-black`}>
                          {formatAmount(displayedReward)}
                        </div>
                        <button
                          type="button"
                          onClick={onBuyAgain}
                          disabled={buyAgainPending}
                          className="mt-5 w-full rounded-full bg-[linear-gradient(135deg,#fff0a9,#ffc65c)] px-6 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#201108] shadow-[0_18px_48px_rgba(255,184,72,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {buyAgainPending ? "Starting..." : "Play Again"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {showLosingResultCard ? (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[linear-gradient(180deg,rgba(8,5,12,0.2),rgba(8,5,12,0.6))] p-4">
                      <div className="w-full max-w-[420px] rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(31,18,33,0.94),rgba(11,7,16,0.97))] px-6 py-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f2d59a]/64">Ticket Result</div>
                        <div className="mt-3 text-4xl font-black uppercase tracking-[0.08em] text-white">Not A Winner</div>
                        <button
                          type="button"
                          onClick={onBuyAgain}
                          disabled={buyAgainPending}
                          className="mt-5 w-full rounded-full bg-[linear-gradient(135deg,#fff0a9,#ffc65c)] px-6 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#201108] shadow-[0_18px_48px_rgba(255,184,72,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {buyAgainPending ? "Starting..." : "Play Again"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                </div>

                {!state.scratchComplete && picksComplete && !isDesktopViewport ? (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 z-20 cursor-[crosshair] touch-none"
                    aria-label={`Scratch foil armed at ${Math.round(TRIPLE_CROWN_DERBY_SCRATCH_THRESHOLD * 100)} percent`}
                  />
                ) : null}
              </div>

              {state.raceResult && !showWinningResultCard && !showWinningVideoOverlay ? (
                <div className="mt-4 flex justify-end xl:mt-3">
                  <div
                    className={`rounded-[18px] border border-white/12 bg-gradient-to-r px-4 py-3 text-right shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${
                      TREATMENT_CLASSES[winningTier?.treatment ?? "silver"]
                    } ${
                      showWinningVideoOverlay && authoritativeRewardAmount > 0
                        ? "border-[#f5d58a]/35 shadow-[0_0_22px_rgba(255,213,120,0.14),0_16px_40px_rgba(0,0,0,0.28)]"
                        : ""
                    }`}
                  >
                    <div className="text-xl font-black tabular-nums text-slate-950">
                      {authoritativeRewardAmount > 0
                        ? formatAmount(showWinningVideoOverlay ? displayedReward : authoritativeRewardAmount)
                        : "No Win"}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,11,27,0.96),rgba(8,6,12,0.96))] shadow-[0_20px_60px_rgba(0,0,0,0.24)] xl:hidden">
            <button
              type="button"
              onClick={() => setPrizeLadderOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f2d59a]/64">Prize Ladder</div>
                <div className="mt-1 text-sm text-white/56">Optional payout table</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/46">{prizeLadderOpen ? "Hide" : "Show"}</div>
                <div className={`text-xl text-[#f5d58a] transition ${prizeLadderOpen ? "rotate-180" : ""}`}>⌄</div>
              </div>
            </button>
            {prizeLadderOpen ? (
              <div className="border-t border-white/8 px-4 pb-4 pt-2 sm:px-5">
                <div className="space-y-3">
                  {ticket.payoutLadder
                    .slice()
                    .reverse()
                    .map((tier) => {
                      const active = state.raceResult?.prizeTierId === tier.id;
                      return (
                        <div key={tier.id} className={`rounded-[20px] border px-4 py-4 transition ${active ? "border-[#ffe09a]/60 bg-[linear-gradient(135deg,rgba(255,210,100,0.22),rgba(122,56,255,0.18))] shadow-[0_18px_48px_rgba(255,200,90,0.18)]" : "border-white/10 bg-white/[0.04]"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white">{tier.label}</div>
                              <div className="mt-1 text-xs leading-5 text-white/54">{tier.description}</div>
                            </div>
                            <div className="text-2xl font-black text-[#ffe4a6]">{formatAmount(tier.rewardAmount)}</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
