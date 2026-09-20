"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  WebGameSplash,
  type WebGameSplashEnabledConfig,
} from "@/app/scratch/_components/WebGameSplash";
import {
  TITANIC_MAIDEN_VOYAGE_ACCENT_CLASS,
  TITANIC_MAIDEN_VOYAGE_BRIDGE_BACKGROUND_SRC,
  TITANIC_MAIDEN_VOYAGE_CTA,
  TITANIC_MAIDEN_VOYAGE_DESCRIPTION,
  TITANIC_MAIDEN_VOYAGE_DRAW_ROUTE_INSTRUCTION,
  TITANIC_MAIDEN_VOYAGE_EYEBROW,
  TITANIC_MAIDEN_VOYAGE_LOGO_ALT,
  TITANIC_MAIDEN_VOYAGE_LOGO_ASSET_SRC,
  TITANIC_MAIDEN_VOYAGE_REVEAL_ICON_SRC_BY_PANEL_ID,
  TITANIC_MAIDEN_VOYAGE_RESULT_MEDIA_BY_TIER,
  TITANIC_MAIDEN_VOYAGE_ROUTE_HERO_SRC,
  TITANIC_MAIDEN_VOYAGE_ROUTE_MAP_SRC,
  TITANIC_RESULT_REVEAL_DELAY_MS,
  type TitanicResultMediaEntry,
  type TitanicResultMediaKey,
  TITANIC_MAIDEN_VOYAGE_SPEED_OPTIONS,
  TITANIC_MAIDEN_VOYAGE_STEAM_OVERLAY_SRC,
  TITANIC_MAIDEN_VOYAGE_TELEGRAPH_DIAL_V3_SRC,
  TITANIC_MAIDEN_VOYAGE_TELEGRAPH_HANDLE_V3_NORMALIZED_SRC,
  TITANIC_MAIDEN_VOYAGE_TICKET_CARD_SRC,
  TITANIC_MAIDEN_VOYAGE_TITLE,
  TITANIC_MAIDEN_VOYAGE_WORDMARK_TRANSPARENT_SRC,
  type TitanicDrawnRouteProfile,
  type TitanicSpeedId,
} from "@/lib/titanic-maiden-voyage/titanicMaidenVoyageConfig";
import {
  createTitanicVoyageOutcome,
  type TitanicVoyageOutcomeTier,
  type TitanicVoyageOutcome,
} from "@/lib/titanic-maiden-voyage/titanicMaidenVoyageOutcome";

const TITANIC_SPLASH_CONFIG: WebGameSplashEnabledConfig = {
  enabled: true,
  heroLabel: "Maiden Voyage",
  interactionMode: "surface",
  playLabel: "Tap To Start",
  showPointsPill: false,
  showSplashCopy: false,
  featureChips: [],
  detailItems: [],
  stageBackdrop: {
    src: TITANIC_MAIDEN_VOYAGE_TICKET_CARD_SRC,
    alt: "Titanic: Maiden Voyage splash artwork with tap to start prompt",
    width: 1672,
    height: 941,
    className: "absolute inset-0",
    imageClassName: "object-cover object-center",
  },
  shellClassName:
    "bg-[radial-gradient(circle_at_18%_18%,rgba(255,211,122,0.18),transparent_0_18%),radial-gradient(circle_at_82%_18%,rgba(107,160,214,0.18),transparent_0_18%),linear-gradient(180deg,#0d1628_0%,#09111f_44%,#05080f_100%)]",
  overlayClassName:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_36%)]",
  orbAClassName: "bg-amber-300/18",
  orbBClassName: "bg-sky-300/16",
  floorGlowClassName:
    "bg-[radial-gradient(circle,rgba(126,180,232,0.2),rgba(126,180,232,0.08)_45%,transparent_70%)]",
  logoWrapClassName: "max-w-[860px] lg:max-w-[980px]",
  logoClassName: "drop-shadow-[0_24px_72px_rgba(126,180,232,0.2)]",
  showPrimaryLogo: false,
  showSoundToggle: false,
};

type TitanicPhase = "splash" | "course" | "speed" | "scratch";
type DrawnRouteDirection = "southampton_to_new_york" | "new_york_to_southampton";
type DrawnRouteStatus = "idle" | "drawing" | "accepted" | "invalid";
type RoutePoint = { xPct: number; yPct: number };
type RouteSummary = {
  title: string;
  directionLabel: string;
  profileLabel: string;
  profile: TitanicDrawnRouteProfile;
};
type RevealRouteTone = "legendary" | "safe" | "warning" | "danger";
type RevealRouteSegment = {
  points: RoutePoint[];
  tone: RevealRouteTone;
  startFraction: number;
  endFraction: number;
};
type RevealRoutePlan = {
  segments: RevealRouteSegment[];
  eventPoint: RoutePoint | null;
  reachedDestination: boolean;
};
type RoutePillMarker = {
  xPct: number;
  yPct: number;
  fraction: number;
};

type TitanicMaidenVoyageGameScreenProps = {
  authoritativeWinAmount?: number | null;
  prizeAmounts?: readonly number[];
  onFinalResultPresented?: (details: { outcome: "win" | "loss" }) => void;
  settlementPending?: boolean;
  buyAgainPending?: boolean;
  onBuyAgain?: () => void;
  initialPhase?: Extract<TitanicPhase, "splash" | "course">;
};

const TELEGRAPH_HANDLE_ANGLE_BY_SPEED: Record<TitanicSpeedId, number> = {
  stop: 188,
  "dead-slow": 225,
  slow: 270,
  half: 315,
  full: 0,
};
const ALL_TELEGRAPH_SPEED_IDS: TitanicSpeedId[] = [
  "stop",
  "dead-slow",
  "slow",
  "half",
  "full",
];

const NEW_YORK_PORT_POINT: RoutePoint = { xPct: 15.1, yPct: 49.3 };
const SOUTHAMPTON_PORT_POINT: RoutePoint = { xPct: 79.5, yPct: 33.2 };
const PORT_CAPTURE_RADIUS = 8.8;
const MIN_ROUTE_SPAN_X = 42;
const MIN_ROUTE_LENGTH = 52;
const MIN_DRAW_POINTS = 10;
const SCRATCH_GRID_COLS = 18;
const SCRATCH_GRID_ROWS = 10;
const SCRATCH_BRUSH_RADIUS = 34;
const SCRATCH_COMPLETE_THRESHOLD = 0.4;
const TITANIC_DEV_FORCED_OUTCOME_TIER_BY_KEY: Record<TitanicResultMediaKey, TitanicVoyageOutcomeTier> = {
  titanic_arrival: "legendary_arrival",
  titanic_slight_damage: "safe_arrival",
  titanic_moderate_damage: "emergency_arrival",
  titanic_sinks: "voyage_lost",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceBetween(left: RoutePoint, right: RoutePoint) {
  return Math.hypot(left.xPct - right.xPct, left.yPct - right.yPct);
}

function simplifyRoutePoints(points: RoutePoint[], minDistance = 1.6) {
  if (points.length <= 2) {
    return points;
  }

  const simplified: RoutePoint[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (distanceBetween(point, simplified[simplified.length - 1]) >= minDistance) {
      simplified.push(point);
    }
  }
  simplified.push(points[points.length - 1]);
  return simplified;
}

function smoothRoutePoints(points: RoutePoint[]) {
  if (points.length <= 2) {
    return points;
  }

  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return point;
    }

    const previous = points[index - 1];
    const next = points[index + 1];
    return {
      xPct: clamp((previous.xPct + point.xPct * 2 + next.xPct) / 4, 0, 100),
      yPct: clamp((previous.yPct + point.yPct * 2 + next.yPct) / 4, 0, 100),
    };
  });
}

function buildSmoothRoutePath(points: RoutePoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].xPct} ${points[0].yPct}`;
  }

  let path = `M ${points[0].xPct} ${points[0].yPct}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const midX = (previous.xPct + point.xPct) / 2;
    const midY = (previous.yPct + point.yPct) / 2;
    path += ` Q ${previous.xPct} ${previous.yPct} ${midX} ${midY}`;
  }

  const lastPoint = points[points.length - 1];
  path += ` T ${lastPoint.xPct} ${lastPoint.yPct}`;
  return path;
}

function resampleRouteByDistance(
  points: RoutePoint[],
  spacing: number,
  startOffset = spacing * 0.5
): RoutePillMarker[] {
  if (points.length < 2 || spacing <= 0) {
    return [];
  }

  const totalLength = getRouteLength(points);
  if (totalLength <= 0) {
    return [];
  }

  const markers: RoutePillMarker[] = [];
  let distanceUntilNextMarker = startOffset;
  let walkedDistance = 0;

  for (let index = 1; index < points.length; index += 1) {
    let segmentStart = points[index - 1];
    const segmentEnd = points[index];
    let segmentLength = distanceBetween(segmentStart, segmentEnd);

    if (segmentLength === 0) {
      continue;
    }

    while (segmentLength >= distanceUntilNextMarker) {
      const progress = distanceUntilNextMarker / segmentLength;
      const insertedPoint = interpolateRoutePoint(segmentStart, segmentEnd, progress);
      const markerDistance = walkedDistance + distanceUntilNextMarker;

      markers.push({
        xPct: insertedPoint.xPct,
        yPct: insertedPoint.yPct,
        fraction: clamp(markerDistance / totalLength, 0, 1),
      });

      segmentStart = insertedPoint;
      walkedDistance = markerDistance;
      segmentLength = distanceBetween(segmentStart, segmentEnd);
      distanceUntilNextMarker = spacing;
    }

    walkedDistance += segmentLength;
    distanceUntilNextMarker -= segmentLength;
  }

  return markers;
}

function getRouteLength(points: RoutePoint[]) {
  return points.slice(1).reduce((total, point, index) => {
    return total + distanceBetween(points[index], point);
  }, 0);
}

function classifyRouteProfile(points: RoutePoint[]): TitanicDrawnRouteProfile {
  if (points.length === 0) {
    return "central";
  }

  const averageY =
    points.reduce((total, point) => total + point.yPct, 0) / points.length;
  const verticalSpread =
    Math.max(...points.map((point) => point.yPct)) -
    Math.min(...points.map((point) => point.yPct));
  const directionChanges = points.slice(2).reduce((total, point, index) => {
    const prevDelta = points[index + 1].yPct - points[index].yPct;
    const nextDelta = point.yPct - points[index + 1].yPct;
    return prevDelta === 0 || nextDelta === 0 || Math.sign(prevDelta) === Math.sign(nextDelta)
      ? total
      : total + 1;
  }, 0);

  if (verticalSpread > 34 || directionChanges >= 4) {
    return "erratic";
  }

  if (averageY < 37) {
    return "northern";
  }

  if (averageY > 63) {
    return "southern";
  }

  return "central";
}

function interpolateRoutePoint(left: RoutePoint, right: RoutePoint, progress: number): RoutePoint {
  return {
    xPct: left.xPct + (right.xPct - left.xPct) * progress,
    yPct: left.yPct + (right.yPct - left.yPct) * progress,
  };
}

function getPointAlongRoute(points: RoutePoint[], fraction: number) {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return points[0];
  }

  const routeLength = getRouteLength(points);
  if (routeLength === 0) {
    return points[0];
  }

  const targetDistance = clamp(fraction, 0, 1) * routeLength;
  let walked = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const segmentLength = distanceBetween(previous, point);
    if (walked + segmentLength >= targetDistance) {
      const segmentProgress = segmentLength === 0 ? 0 : (targetDistance - walked) / segmentLength;
      return interpolateRoutePoint(previous, point, segmentProgress);
    }
    walked += segmentLength;
  }

  return points[points.length - 1];
}

function getRouteSlice(points: RoutePoint[], startFraction: number, endFraction: number) {
  if (points.length <= 1) {
    return points;
  }

  const routeLength = getRouteLength(points);
  if (routeLength === 0) {
    return points;
  }

  const startDistance = clamp(startFraction, 0, 1) * routeLength;
  const endDistance = clamp(endFraction, 0, 1) * routeLength;
  const sliceStart = Math.min(startDistance, endDistance);
  const sliceEnd = Math.max(startDistance, endDistance);
  const slicedPoints: RoutePoint[] = [];
  let walked = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const segmentLength = distanceBetween(previous, point);
    const segmentStart = walked;
    const segmentEnd = walked + segmentLength;

    if (sliceEnd < segmentStart || sliceStart > segmentEnd) {
      walked = segmentEnd;
      continue;
    }

    const clampedStart = clamp((sliceStart - segmentStart) / segmentLength, 0, 1);
    const clampedEnd = clamp((sliceEnd - segmentStart) / segmentLength, 0, 1);
    const startPoint = interpolateRoutePoint(previous, point, clampedStart);
    const endPoint = interpolateRoutePoint(previous, point, clampedEnd);

    if (
      slicedPoints.length === 0 ||
      distanceBetween(slicedPoints[slicedPoints.length - 1], startPoint) > 0.05
    ) {
      slicedPoints.push(startPoint);
    }
    if (distanceBetween(slicedPoints[slicedPoints.length - 1], endPoint) > 0.05) {
      slicedPoints.push(endPoint);
    }
    walked = segmentEnd;
  }

  if (slicedPoints.length === 0) {
    const fallbackStart = getPointAlongRoute(points, startFraction);
    const fallbackEnd = getPointAlongRoute(points, endFraction);
    return fallbackStart && fallbackEnd ? [fallbackStart, fallbackEnd] : points;
  }

  return smoothRoutePoints(slicedPoints);
}

function buildRevealRoutePlan(
  points: RoutePoint[],
  tier: TitanicVoyageOutcome["tier"]
): RevealRoutePlan {
  if (points.length <= 1) {
    return {
      segments: [],
      eventPoint: null,
      reachedDestination: false,
    };
  }

  if (tier === "legendary_arrival") {
    return {
      segments: [{ points, tone: "legendary", startFraction: 0, endFraction: 1 }],
      eventPoint: null,
      reachedDestination: true,
    };
  }

  if (tier === "safe_arrival") {
    return {
      segments: [{ points, tone: "safe", startFraction: 0, endFraction: 1 }],
      eventPoint: null,
      reachedDestination: true,
    };
  }

  if (tier === "emergency_arrival") {
    const strikeFraction = 0.58;
    const strikePoint = getPointAlongRoute(points, strikeFraction);
    return {
      segments: [
        {
          points: getRouteSlice(points, 0, strikeFraction),
          tone: "safe",
          startFraction: 0,
          endFraction: strikeFraction,
        },
        {
          points: getRouteSlice(points, strikeFraction, 1),
          tone: "warning",
          startFraction: strikeFraction,
          endFraction: 1,
        },
      ],
      eventPoint: strikePoint,
      reachedDestination: true,
    };
  }

  const sinkingFraction = 0.62;
  return {
    segments: [
      {
        points: getRouteSlice(points, 0, sinkingFraction),
        tone: "danger",
        startFraction: 0,
        endFraction: sinkingFraction,
      },
    ],
    eventPoint: getPointAlongRoute(points, sinkingFraction),
    reachedDestination: false,
  };
}

function validateDrawnRoute(points: RoutePoint[]) {
  if (points.length < MIN_DRAW_POINTS) {
    return {
      accepted: false as const,
      message: "Draw from port to port.",
    };
  }

  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const nearNewYorkStart = distanceBetween(startPoint, NEW_YORK_PORT_POINT) <= PORT_CAPTURE_RADIUS;
  const nearSouthamptonStart =
    distanceBetween(startPoint, SOUTHAMPTON_PORT_POINT) <= PORT_CAPTURE_RADIUS;
  const nearNewYorkEnd = distanceBetween(endPoint, NEW_YORK_PORT_POINT) <= PORT_CAPTURE_RADIUS;
  const nearSouthamptonEnd =
    distanceBetween(endPoint, SOUTHAMPTON_PORT_POINT) <= PORT_CAPTURE_RADIUS;

  let direction: DrawnRouteDirection | null = null;
  if (nearSouthamptonStart && nearNewYorkEnd) {
    direction = "southampton_to_new_york";
  } else if (nearNewYorkStart && nearSouthamptonEnd) {
    direction = "new_york_to_southampton";
  }

  if (!direction) {
    return {
      accepted: false as const,
      message: "Course must connect Southampton and New York.",
    };
  }

  const spanX =
    Math.max(...points.map((point) => point.xPct)) -
    Math.min(...points.map((point) => point.xPct));
  const routeLength = getRouteLength(points);

  if (spanX < MIN_ROUTE_SPAN_X || routeLength < MIN_ROUTE_LENGTH) {
    return {
      accepted: false as const,
      message: "Draw from port to port.",
    };
  }

  const canonicalInputPoints =
    direction === "new_york_to_southampton" ? [...points].reverse() : [...points];
  const snappedPoints = [...canonicalInputPoints];
  snappedPoints[0] = SOUTHAMPTON_PORT_POINT;
  snappedPoints[snappedPoints.length - 1] = NEW_YORK_PORT_POINT;

  const simplifiedPoints = simplifyRoutePoints(snappedPoints);
  const polishedPoints = smoothRoutePoints(simplifiedPoints);
  const profile = classifyRouteProfile(polishedPoints);

  return {
    accepted: true as const,
    direction,
    profile,
    polishedPoints,
  };
}

function getPointFromPointerEvent(
  event: React.PointerEvent<HTMLDivElement>,
  bounds: DOMRect
): RoutePoint {
  const xPct = clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100);
  const yPct = clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100);
  return { xPct, yPct };
}

const TELEGRAPH_SPEED_HIT_ZONES: Array<{
  speedId: Exclude<TitanicSpeedId, "stop">;
  label: string;
  className: string;
}> = [
  {
    speedId: "dead-slow",
    label: "Dead Slow",
    className: "left-[11%] top-[27%]",
  },
  {
    speedId: "slow",
    label: "Slow",
    className: "left-[32%] top-[8%]",
  },
  {
    speedId: "half",
    label: "Half",
    className: "right-[17%] top-[12%]",
  },
  {
    speedId: "full",
    label: "Full",
    className: "right-[8%] top-[31%]",
  },
];

const VALID_VOYAGE_SPEED_IDS: TitanicSpeedId[] = ["dead-slow", "slow", "half", "full"];

function normalizeTelegraphAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function getCircularAngleDistance(left: number, right: number) {
  const rawDiff = Math.abs(left - right);
  return Math.min(rawDiff, 360 - rawDiff);
}

function getTelegraphPointerAngle(event: React.PointerEvent<Element>, bounds: DOMRect) {
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const angle = normalizeTelegraphAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  const radius = Math.hypot(dx, dy);

  return {
    angle,
    radius,
    centerX,
    centerY,
  };
}

function getNearestTelegraphSpeedId(
  angle: number,
  speedIds: readonly TitanicSpeedId[] = VALID_VOYAGE_SPEED_IDS
) {
  return speedIds.reduce((nearestSpeedId, speedId) => {
    const nearestDistance = getCircularAngleDistance(
      angle,
      TELEGRAPH_HANDLE_ANGLE_BY_SPEED[nearestSpeedId]
    );
    const candidateDistance = getCircularAngleDistance(
      angle,
      TELEGRAPH_HANDLE_ANGLE_BY_SPEED[speedId]
    );

    return candidateDistance < nearestDistance ? speedId : nearestSpeedId;
  }, VALID_VOYAGE_SPEED_IDS[0]);
}

function OptionalAssetImage({
  src,
  alt,
  className,
  fallback = null,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return fallback;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}

function TitanicHeaderWordmark() {
  return (
    <div className="pointer-events-none flex min-w-0 items-center justify-center">
      <OptionalAssetImage
        src={TITANIC_MAIDEN_VOYAGE_WORDMARK_TRANSPARENT_SRC}
        alt={TITANIC_MAIDEN_VOYAGE_LOGO_ALT}
        className="h-[6.1rem] w-full max-w-[42rem] object-contain drop-shadow-[0_8px_22px_rgba(0,0,0,0.42)] sm:h-[6.8rem] sm:max-w-[48rem] lg:h-[7.6rem] lg:max-w-[52rem] xl:h-[8rem] xl:max-w-[56rem]"
        fallback={
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-[3rem] font-semibold uppercase tracking-[0.08em] text-[#f5deb0] [font-family:Georgia,serif] leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.4)] sm:text-[3.5rem] lg:text-[4.15rem]">
              Titanic
            </div>
            <div className="mt-1 text-[1.05rem] font-semibold uppercase tracking-[0.34em] text-[#f1d08a] [font-family:Georgia,serif] sm:text-[1.18rem] lg:text-[1.3rem]">
              Maiden Voyage
            </div>
          </div>
        }
      />
    </div>
  );
}

function TitanicHeroHeader({ phaseLabel }: { phaseLabel: string }) {
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-[22px] border border-[#d7af64]/16 bg-[linear-gradient(180deg,rgba(19,15,12,0.9),rgba(7,9,15,0.96))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-5 sm:py-4.5 lg:px-6 lg:py-5">
      <OptionalAssetImage
        src={TITANIC_MAIDEN_VOYAGE_ROUTE_HERO_SRC}
        alt="Moonlit North Atlantic hero backdrop"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-[0.72]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,243,204,0.14),transparent_16%),linear-gradient(180deg,rgba(3,6,12,0.14),rgba(4,8,15,0.32)_52%,rgba(5,8,14,0.7)_100%)]" />
      <div className="pointer-events-none absolute bottom-3 left-4 text-[9px] font-semibold uppercase tracking-[0.26em] text-[#e6c887]/72 sm:left-5 lg:left-6">
        {phaseLabel}
      </div>
      <TitanicHeaderWordmark />
    </div>
  );
}

function ChartPortMarker({
  label,
  align,
  className,
  style,
}: {
  label: string;
  align: "left" | "right";
  className: string;
  style?: React.CSSProperties;
}) {
  const markerDot = (
    <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e8c778]/28 bg-[radial-gradient(circle_at_30%_30%,rgba(255,231,176,0.18),rgba(10,13,20,0.92)_74%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className="h-2.5 w-2.5 rounded-full border border-[#f5ddb0]/48 bg-[radial-gradient(circle_at_30%_30%,#ffeebf_0%,#c9973d_55%,#6d4318_100%)]" />
      <span className="absolute inset-[-2px] rounded-full border border-[#f0d7a2]/10" />
    </span>
  );

  return (
    <div className={`pointer-events-none absolute z-10 ${className}`} style={style}>
      {align === "left" ? (
        <div className="relative flex items-center">
          <div className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            {markerDot}
          </div>
          <div className="ml-3.5 rounded-full border border-[#dcb96d]/18 bg-[linear-gradient(180deg,rgba(8,13,21,0.84),rgba(5,8,14,0.94))] px-3 py-1.5 text-[#f6dfb0]/72 shadow-[0_10px_20px_rgba(0,0,0,0.24)]">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#fff0cb]">
              {label}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex items-center justify-end">
          <div className="mr-3.5 rounded-full border border-[#dcb96d]/18 bg-[linear-gradient(180deg,rgba(8,13,21,0.84),rgba(5,8,14,0.94))] px-3 py-1.5 text-right text-[#f6dfb0]/72 shadow-[0_10px_20px_rgba(0,0,0,0.24)]">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#fff0cb]">
              {label}
            </div>
          </div>
          <div className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2">
            {markerDot}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-full border px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
        active
          ? "border-[#f0d7a2]/32 bg-[linear-gradient(180deg,rgba(76,55,21,0.9),rgba(22,17,13,0.96))] text-[#f7e7c3]"
          : "border-white/8 bg-[rgba(255,255,255,0.03)] text-white/50"
      }`}
    >
      {children}
    </div>
  );
}

function getRevealStageClass(visible: boolean, prefersReducedMotion: boolean, hiddenTransform: string) {
  if (prefersReducedMotion) {
    return visible ? "opacity-100" : "opacity-0";
  }

  return visible
    ? "translate-y-0 scale-100 opacity-100"
    : `${hiddenTransform} scale-[0.985] opacity-0`;
}

function TitanicRevealResultHero({
  resultMedia,
  resultVideoRef,
  resultVideoFailed,
  onVideoError,
  suspenseVisible,
  awardText,
  awardFootnote,
  onPlayAgain,
  buyAgainPending,
  settlementPending,
  prefersReducedMotion,
  overlayVisible,
  textVisible,
  awardVisible,
  ctaVisible,
}: {
  resultMedia: TitanicResultMediaEntry;
  resultVideoRef: React.RefObject<HTMLVideoElement | null>;
  resultVideoFailed: boolean;
  onVideoError: () => void;
  suspenseVisible: boolean;
  awardText: string;
  awardFootnote: string;
  onPlayAgain: () => void;
  buyAgainPending: boolean;
  settlementPending?: boolean;
  prefersReducedMotion: boolean;
  overlayVisible: boolean;
  textVisible: boolean;
  awardVisible: boolean;
  ctaVisible: boolean;
}) {
  return (
    <div className="absolute inset-0 z-50 overflow-hidden rounded-[22px]">
      {!resultVideoFailed ? (
        <video
          ref={resultVideoRef}
          key={resultMedia.videoSrc}
          src={resultMedia.videoSrc}
          className="absolute inset-0 h-full w-full bg-black object-cover object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={onVideoError}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(40,58,78,0.28),transparent_34%),linear-gradient(180deg,#060a10_0%,#02050a_100%)]"
        />
      )}

        <div
          className={`absolute inset-0 transition-all duration-500 ${getRevealStageClass(
            overlayVisible,
            prefersReducedMotion,
            "translate-y-0"
          )}`}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-[linear-gradient(180deg,rgba(3,6,12,0),rgba(3,6,12,0.08)_28%,rgba(3,6,12,0.22)_68%,rgba(3,6,12,0.44)_100%)] sm:h-[22%] lg:h-[20%]" />
          <div className="pointer-events-none absolute left-1/2 top-[58%] h-[15rem] w-[min(78vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-[999px] bg-[radial-gradient(circle_at_center,rgba(4,8,15,0.24),rgba(4,8,15,0.08)_42%,transparent_72%)] blur-3xl sm:top-[60%] sm:h-[16rem] lg:h-[17rem] lg:w-[min(60vw,34rem)]" />
          <div className="flex h-full items-end justify-center p-3 sm:p-4 lg:p-6">
          <div className="flex w-full max-w-[23rem] flex-col items-center justify-end gap-3 pb-3 text-center sm:max-w-[24rem] sm:gap-3.5 sm:pb-5 lg:max-w-[26rem] lg:gap-4 lg:pb-8">
            {suspenseVisible ? (
              <div className="rounded-full border border-[#f0d7a2]/12 bg-[rgba(8,12,19,0.16)] px-3.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.26em] text-[#f5ddb0]/76 backdrop-blur-[3px] sm:px-4 sm:text-[10px]">
                Crossing the ice field...
              </div>
            ) : null}

            <div
              className={`w-full px-2 py-1 transition-all duration-500 sm:px-3 lg:px-4 ${
                prefersReducedMotion ? "" : "will-change-transform"
              } ${getRevealStageClass(textVisible || awardVisible, prefersReducedMotion, "translate-y-6")}`}
            >
              <h2 className="text-[clamp(1.52rem,2.8vw,2.3rem)] font-semibold leading-[1.06] tracking-[0.015em] text-[#fff2d0] drop-shadow-[0_6px_18px_rgba(0,0,0,0.48)]">
                {resultMedia.displayTitle}
              </h2>
              <div
                className={`mt-1.5 text-[clamp(1.95rem,4vw,2.95rem)] font-black tracking-[0.05em] text-[#fff3d3] transition-all duration-500 drop-shadow-[0_8px_20px_rgba(0,0,0,0.56)] ${
                  prefersReducedMotion ? "" : "will-change-transform"
                } ${getRevealStageClass(awardVisible, prefersReducedMotion, "translate-y-4")}`}
              >
                {awardText}
              </div>
              {awardFootnote ? (
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-white/50">
                  {awardFootnote}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onPlayAgain}
              disabled={buyAgainPending || settlementPending}
              className={`w-full max-w-[18rem] rounded-full border border-[#f0d7a2]/22 bg-[linear-gradient(180deg,rgba(122,87,31,0.9),rgba(43,27,13,0.96))] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#fff1cb] shadow-[0_14px_30px_rgba(0,0,0,0.22)] transition-all duration-500 hover:border-[#f6ddb0]/30 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 sm:max-w-[19rem] sm:py-2.75 sm:text-[11px] lg:max-w-[20rem] lg:py-3 ${
                prefersReducedMotion ? "" : "will-change-transform"
              } ${getRevealStageClass(ctaVisible, prefersReducedMotion, "translate-y-7")}`}
            >
              {buyAgainPending || settlementPending ? "Starting..." : resultMedia.ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TelegraphDialHandleLayer({
  angle,
  isDragging,
}: {
  angle: number;
  isDragging: boolean;
}) {
  const handleBaseAngle = 315;
  const rotation = angle - handleBaseAngle;

  return (
    <div
      data-testid="titanic-telegraph-real-handle"
      className="pointer-events-none absolute inset-[8%] z-30"
      aria-hidden="true"
    >
      <div
        className={`absolute inset-0 ${isDragging ? "transition-none" : "transition-transform duration-200 ease-out"}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        <OptionalAssetImage
          src={TITANIC_MAIDEN_VOYAGE_TELEGRAPH_HANDLE_V3_NORMALIZED_SRC}
          alt=""
          className="h-full w-full object-contain drop-shadow-[0_20px_22px_rgba(0,0,0,0.42)]"
        />
      </div>
    </div>
  );
}

function getSpeedOption(speedId: TitanicSpeedId) {
  return (
    TITANIC_MAIDEN_VOYAGE_SPEED_OPTIONS.find((option) => option.id === speedId) ??
    TITANIC_MAIDEN_VOYAGE_SPEED_OPTIONS[0]
  );
}

function formatPointAward(points: number) {
  return `${Math.max(0, Math.round(points)).toLocaleString()} PTS`;
}

function getDevForcedTitanicOutcomeTier(
  queryValue: string | null
): TitanicVoyageOutcomeTier | null {
  if (process.env.NODE_ENV === "production" || !queryValue) {
    return null;
  }

  return TITANIC_DEV_FORCED_OUTCOME_TIER_BY_KEY[queryValue as TitanicResultMediaKey] ?? null;
}

function getTitanicDisplayAwardPoints({
  tier,
  authoritativeWinAmount,
  prizeAmounts,
}: {
  tier: TitanicVoyageOutcome["tier"];
  authoritativeWinAmount?: number | null;
  prizeAmounts?: readonly number[];
}) {
  if (typeof authoritativeWinAmount === "number") {
    return {
      points: Math.max(0, authoritativeWinAmount),
      placeholder: false,
    };
  }

  const positivePrizeAmounts = [...new Set((prizeAmounts ?? []).filter((amount) => amount > 0))].sort(
    (left, right) => left - right
  );
  if (positivePrizeAmounts.length === 0) {
    return {
      points:
        tier === "legendary_arrival"
          ? 5000
          : tier === "safe_arrival"
            ? 2400
            : tier === "emergency_arrival"
              ? 900
              : 0,
      placeholder: true,
    };
  }

  if (tier === "voyage_lost") {
    return { points: 0, placeholder: false };
  }

  if (tier === "legendary_arrival") {
    return {
      points: positivePrizeAmounts[positivePrizeAmounts.length - 1],
      placeholder: true,
    };
  }

  if (tier === "safe_arrival") {
    return {
      points:
        positivePrizeAmounts.length >= 2
          ? positivePrizeAmounts[positivePrizeAmounts.length - 2]
          : positivePrizeAmounts[positivePrizeAmounts.length - 1],
      placeholder: true,
    };
  }

  return {
    points: positivePrizeAmounts[0],
    placeholder: true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FinalOutcomePanel({
  voyageOutcome,
  allPanelsRevealed,
  authoritativeWinAmount,
  isRewardedPlay,
  selectedSpeedLabel,
  routeSummary,
}: {
  voyageOutcome: TitanicVoyageOutcome;
  allPanelsRevealed: boolean;
  authoritativeWinAmount?: number | null;
  isRewardedPlay: boolean;
  selectedSpeedLabel: string;
  routeSummary: RouteSummary;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col rounded-[26px] border border-[#d9b874]/18 bg-[linear-gradient(180deg,rgba(18,11,8,0.9),rgba(7,8,12,0.96))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#f1d8a0]/62">
          Final Outcome
        </div>
        <StatusPill active={allPanelsRevealed}>{allPanelsRevealed ? "Unlocked" : "Locked"}</StatusPill>
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[22px] border border-[#e7c57b]/18 bg-[linear-gradient(180deg,rgba(24,18,14,0.98),rgba(9,10,16,0.98))] p-3.5 shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
        {allPanelsRevealed ? (
          <>
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#f0d7a2]/18 bg-[radial-gradient(circle_at_30%_30%,rgba(248,228,188,0.16),rgba(10,13,20,0.98)_72%)] shadow-[0_18px_34px_rgba(0,0,0,0.28)]">
                <OptionalAssetImage
                  src={TITANIC_MAIDEN_VOYAGE_REVEAL_ICON_SRC_BY_PANEL_ID.voyage_outcome}
                  alt=""
                  className="h-full w-full scale-[1.2] object-cover object-center opacity-95"
                />
              </div>
            </div>
            <div className="mt-3 text-center text-[1.22rem] font-semibold tracking-[0.04em] text-[#fff1cb]">
              {voyageOutcome.title}
            </div>
            <div className="mt-1.5 text-center text-[12px] leading-4 text-white/62">{voyageOutcome.summary}</div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <StatusPill active>{selectedSpeedLabel}</StatusPill>
              <StatusPill>{routeSummary.profileLabel}</StatusPill>
            </div>
            <div className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-white/48">
              {routeSummary.directionLabel}
            </div>
            <div className="mt-auto pt-3">
              {isRewardedPlay ? (
                <>
                  <div className="flex items-center justify-center rounded-[18px] border border-[#f0d7a2]/18 bg-[linear-gradient(180deg,rgba(95,69,25,0.7),rgba(22,16,12,0.94))] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f7e7c3]">
                    {authoritativeWinAmount && authoritativeWinAmount > 0
                      ? `Winner +${authoritativeWinAmount}`
                      : "No Prize"}
                  </div>
                  <div className="mt-2 text-center text-[10px] uppercase tracking-[0.18em] text-white/44">
                    Settles after final reveal
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center rounded-[18px] border border-[#f0d7a2]/18 bg-[linear-gradient(180deg,rgba(95,69,25,0.7),rgba(22,16,12,0.94))] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f7e7c3]">
                  {voyageOutcome.payoutPreview}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="flex h-22 w-22 items-center justify-center rounded-full border border-[#f0d7a2]/18 bg-[radial-gradient(circle_at_30%_30%,rgba(248,228,188,0.12),rgba(10,13,20,0.98)_72%)] shadow-[0_18px_34px_rgba(0,0,0,0.28)]">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d7af64]/22 bg-[linear-gradient(180deg,rgba(37,28,18,0.9),rgba(11,12,18,0.98))] text-2xl text-[#f7e7c3]/82">
                  ▣
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-[1.08rem] font-semibold tracking-[0.04em] text-[#fff1cb]">
              Outcome Locked
            </div>
            <div className="mt-1.5 text-center text-[12px] leading-4 text-white/54">Reveal all four reports.</div>
            <div className="mt-3 rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f7e7c3]/72">
              Potential Reward
              <div className="mt-1.5 text-base tracking-[0.34em] text-white/42">---</div>
            </div>
            <div className="mt-auto pt-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/44">
              Settles after final reveal
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export function TitanicMaidenVoyageGameScreen({
  authoritativeWinAmount,
  prizeAmounts = [],
  onFinalResultPresented,
  settlementPending,
  buyAgainPending = false,
  onBuyAgain,
  initialPhase = "splash",
}: TitanicMaidenVoyageGameScreenProps) {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<TitanicPhase>(() => initialPhase);
  const [selectedSpeed, setSelectedSpeed] = useState<TitanicSpeedId>("stop");
  const [previewSpeed, setPreviewSpeed] = useState<TitanicSpeedId | null>(null);
  const [isDraggingTelegraph, setIsDraggingTelegraph] = useState(false);
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const [voyageOutcome, setVoyageOutcome] = useState<TitanicVoyageOutcome | null>(null);
  const [, setScratchRevealRatio] = useState(0);
  const [scratchRevealComplete, setScratchRevealComplete] = useState(false);
  const [displayedAwardPoints, setDisplayedAwardPoints] = useState(0);
  const [resultVideoFailed, setResultVideoFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [resultSuspenseResolved, setResultSuspenseResolved] = useState(false);
  const [resultSequenceStage, setResultSequenceStage] = useState(0);
  const [drawingPoints, setDrawingPoints] = useState<RoutePoint[]>([]);
  const [acceptedRoutePoints, setAcceptedRoutePoints] = useState<RoutePoint[]>([]);
  const [drawnRouteStatus, setDrawnRouteStatus] = useState<DrawnRouteStatus>("idle");
  const [routeProfile, setRouteProfile] = useState<TitanicDrawnRouteProfile>("central");
  const [routeValidationMessage, setRouteValidationMessage] = useState<string | null>(null);
  const [pendingCourseAdvance, setPendingCourseAdvance] = useState(false);
  const resultPresentedRef = useRef(false);
  const drawingPointsRef = useRef<RoutePoint[]>([]);
  const telegraphDialRef = useRef<HTMLDivElement | null>(null);
  const resultVideoRef = useRef<HTMLVideoElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchWrapRef = useRef<HTMLDivElement | null>(null);
  const scratchFallbackCoverRef = useRef<HTMLDivElement | null>(null);
  const scratchingRef = useRef(false);
  const scratchedCellsRef = useRef<Set<string>>(new Set());

  const canConfirmSpeed = selectedSpeed !== "stop";
  const forcedOutcomeTier = useMemo(
    () => getDevForcedTitanicOutcomeTier(searchParams.get("titanicOutcome")),
    [searchParams]
  );
  const displayAuthoritativeWinAmount =
    forcedOutcomeTier !== null ? null : authoritativeWinAmount;
  const effectiveSpeed = previewSpeed ?? selectedSpeed;
  const renderedTelegraphAngle =
    isDraggingTelegraph && dragAngle !== null
      ? dragAngle
      : TELEGRAPH_HANDLE_ANGLE_BY_SPEED[selectedSpeed];
  const selectedSpeedOption = getSpeedOption(effectiveSpeed);
  const isRewardedPlay = typeof authoritativeWinAmount === "number";
  const revealPresentationReady = voyageOutcome !== null && scratchRevealComplete;
  const routeAutoAdvanceActive = phase === "course" && pendingCourseAdvance;
  const speedAutoAdvanceActive = phase === "speed" && canConfirmSpeed && !isDraggingTelegraph;
  const liveRoutePath = useMemo(
    () => buildSmoothRoutePath(simplifyRoutePoints(drawingPoints, 0.8)),
    [drawingPoints]
  );
  const acceptedRoutePath = useMemo(
    () => buildSmoothRoutePath(acceptedRoutePoints),
    [acceptedRoutePoints]
  );
  const revealRoutePlan = useMemo(
    () =>
      voyageOutcome
        ? buildRevealRoutePlan(acceptedRoutePoints, voyageOutcome.tier)
        : { segments: [], eventPoint: null, reachedDestination: false },
    [acceptedRoutePoints, voyageOutcome]
  );
  const revealRouteMarkers = useMemo(
    () => resampleRouteByDistance(acceptedRoutePoints, 3.35),
    [acceptedRoutePoints]
  );
  const resultMedia = useMemo(
    () => (voyageOutcome ? TITANIC_MAIDEN_VOYAGE_RESULT_MEDIA_BY_TIER[voyageOutcome.tier] : null),
    [voyageOutcome]
  );
  const displayAward = useMemo(
    () =>
      voyageOutcome
        ? getTitanicDisplayAwardPoints({
            tier: voyageOutcome.tier,
            authoritativeWinAmount: displayAuthoritativeWinAmount,
            prizeAmounts,
          })
        : { points: 0, placeholder: false },
    [displayAuthoritativeWinAmount, prizeAmounts, voyageOutcome]
  );
  const suspenseVisible = revealPresentationReady && !resultSuspenseResolved;
  const overlayVisible = resultSequenceStage >= 1;
  const textVisible = resultSequenceStage >= 2;
  const awardVisible = resultSequenceStage >= 3;
  const ctaVisible = resultSequenceStage >= 4;

  function resetVoyageReveal() {
    setVoyageOutcome(null);
    setScratchRevealRatio(0);
    setScratchRevealComplete(false);
    setDisplayedAwardPoints(0);
    setResultVideoFailed(false);
    setResultSuspenseResolved(false);
    setResultSequenceStage(0);
    scratchedCellsRef.current = new Set();
    scratchingRef.current = false;
    if (resultVideoRef.current) {
      resultVideoRef.current.pause();
      resultVideoRef.current.currentTime = 0;
    }
    if (scratchFallbackCoverRef.current) {
      scratchFallbackCoverRef.current.style.opacity = "1";
      scratchFallbackCoverRef.current.style.visibility = "visible";
    }
  }

  function clearDrawnRoute() {
    setDrawingPoints([]);
    setAcceptedRoutePoints([]);
    setDrawnRouteStatus("idle");
    setRouteValidationMessage(null);
    setPendingCourseAdvance(false);
    setRouteProfile("central");
  }

  function restartVoyage() {
    resultPresentedRef.current = false;
    setSelectedSpeed("stop");
    setPreviewSpeed(null);
    setIsDraggingTelegraph(false);
    setDragAngle(null);
    clearDrawnRoute();
    resetVoyageReveal();
    setPhase("course");
  }

  const handlePlayAgain = onBuyAgain ?? restartVoyage;

  useEffect(() => {
    resultPresentedRef.current = false;
  }, [authoritativeWinAmount]);

  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener?.("change", syncPreference);
    return () => mediaQuery.removeEventListener?.("change", syncPreference);
  }, []);

  useEffect(() => {
    if (!resultMedia || typeof document === "undefined") return;

    // Prime only the resolved outcome while the player scratches, so the reveal
    // can cut directly to video instead of showing a static poster frame.
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "video";
    preload.type = "video/mp4";
    preload.href = resultMedia.videoSrc;
    document.head.appendChild(preload);

    return () => preload.remove();
  }, [resultMedia]);

  useEffect(() => {
    if (!resultSuspenseResolved || !resultMedia) return;

    const baseTimer = window.setTimeout(() => {
      setResultSequenceStage(prefersReducedMotion ? 4 : 1);
    }, 0);
    const textTimer = prefersReducedMotion
      ? null
      : window.setTimeout(() => setResultSequenceStage(2), 220);
    const awardTimer = prefersReducedMotion
      ? null
      : window.setTimeout(() => setResultSequenceStage(3), 520);
    const ctaTimer = prefersReducedMotion
      ? null
      : window.setTimeout(() => setResultSequenceStage(4), 860);

    return () => {
      window.clearTimeout(baseTimer);
      if (textTimer !== null) window.clearTimeout(textTimer);
      if (awardTimer !== null) window.clearTimeout(awardTimer);
      if (ctaTimer !== null) window.clearTimeout(ctaTimer);
    };
  }, [prefersReducedMotion, resultMedia, resultSuspenseResolved]);

  useEffect(() => {
    if (!revealPresentationReady || !resultMedia) return;

    let resolved = false;
    const unlockReveal = () => {
      if (resolved) return;
      resolved = true;
      setResultSuspenseResolved(true);
    };

    const fallbackTimer = window.setTimeout(unlockReveal, TITANIC_RESULT_REVEAL_DELAY_MS);
    const video = resultVideoRef.current;

    if (video && !resultVideoFailed) {
      const handleTimeUpdate = () => {
        if (video.currentTime * 1000 >= TITANIC_RESULT_REVEAL_DELAY_MS) {
          unlockReveal();
        }
      };

      handleTimeUpdate();
      video.addEventListener("timeupdate", handleTimeUpdate);

      return () => {
        window.clearTimeout(fallbackTimer);
        video.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [resultMedia, resultVideoFailed, revealPresentationReady]);

  useEffect(() => {
    if (!revealPresentationReady || !voyageOutcome) {
      resultPresentedRef.current = false;
      return;
    }
    if (!isRewardedPlay || resultPresentedRef.current) return;
    resultPresentedRef.current = true;
    onFinalResultPresented?.({
      outcome: (authoritativeWinAmount ?? 0) > 0 ? "win" : "loss",
    });
  }, [
    authoritativeWinAmount,
    isRewardedPlay,
    onFinalResultPresented,
    revealPresentationReady,
    voyageOutcome,
  ]);

  useEffect(() => {
    if (!awardVisible || !voyageOutcome || displayAward.points <= 0) return;

    let frameId = 0;
    const durationMs = 1400;
    const startTime = performance.now();

    const animate = (timestamp: number) => {
      const progress = clamp((timestamp - startTime) / durationMs, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayedAwardPoints(Math.round(displayAward.points * eased));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame((timestamp) => {
      setDisplayedAwardPoints(0);
      animate(timestamp);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [awardVisible, displayAward.points, voyageOutcome]);

  useEffect(() => {
    if (!revealPresentationReady || !resultMedia || resultVideoFailed) {
      return;
    }

    const video = resultVideoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.muted = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }, [resultMedia, resultVideoFailed, revealPresentationReady]);

  useEffect(() => {
    if (!routeAutoAdvanceActive) return;
    const timerId = window.setTimeout(() => {
      setSelectedSpeed("stop");
      resetVoyageReveal();
      setPendingCourseAdvance(false);
      setPhase("speed");
    }, 850);
    return () => window.clearTimeout(timerId);
  }, [routeAutoAdvanceActive]);

  useEffect(() => {
    if (!speedAutoAdvanceActive) return;
    const timerId = window.setTimeout(() => {
      setVoyageOutcome(
        createTitanicVoyageOutcome({
          selectedRouteNodes: [],
          selectedSpeed,
          authoritativeWinAmount,
          prizeAmounts,
          drawnRouteProfile: routeProfile,
          forcedTier: forcedOutcomeTier,
        })
      );
      setScratchRevealRatio(0);
      setScratchRevealComplete(false);
      setResultSuspenseResolved(false);
      setResultSequenceStage(0);
      scratchedCellsRef.current = new Set();
      if (scratchFallbackCoverRef.current) {
        scratchFallbackCoverRef.current.style.opacity = "1";
        scratchFallbackCoverRef.current.style.visibility = "visible";
      }
      setPhase("scratch");
    }, 850);
    return () => window.clearTimeout(timerId);
  }, [
    authoritativeWinAmount,
    prizeAmounts,
    selectedSpeed,
    speedAutoAdvanceActive,
    forcedOutcomeTier,
    routeProfile,
  ]);

  const initializeScratchCanvas = useCallback(() => {
    const canvas = scratchCanvasRef.current;
    const wrap = scratchWrapRef.current;
    if (!canvas || !wrap) return false;

    const bounds = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    canvas.style.width = `${bounds.width}px`;
    canvas.style.height = `${bounds.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return false;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    // The foil must start fully opaque so the hidden route cannot leak through
    // before the player scratches away any pixels.
    const overlay = context.createLinearGradient(0, 0, 0, bounds.height);
    overlay.addColorStop(0, "#171310");
    overlay.addColorStop(0.45, "#201912");
    overlay.addColorStop(1, "#090b12");
    context.fillStyle = overlay;
    context.fillRect(0, 0, bounds.width, bounds.height);

    const shimmer = context.createLinearGradient(0, 0, bounds.width, bounds.height);
    shimmer.addColorStop(0, "rgba(244, 214, 150, 0.08)");
    shimmer.addColorStop(0.3, "rgba(255,255,255,0.02)");
    shimmer.addColorStop(0.55, "rgba(255,255,255,0)");
    shimmer.addColorStop(1, "rgba(212, 171, 98, 0.06)");
    context.fillStyle = shimmer;
    context.fillRect(0, 0, bounds.width, bounds.height);

    context.strokeStyle = "rgba(243, 218, 168, 0.06)";
    context.lineWidth = 1;
    for (let x = 24; x < bounds.width; x += 42) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, bounds.height);
      context.stroke();
    }
    for (let y = 24; y < bounds.height; y += 42) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(bounds.width, y);
      context.stroke();
    }

    context.fillStyle = "rgba(255, 239, 203, 0.18)";
    context.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("Scratch to reveal the voyage", bounds.width / 2, bounds.height * 0.18);
    if (scratchFallbackCoverRef.current) {
      scratchFallbackCoverRef.current.style.opacity = "0";
      scratchFallbackCoverRef.current.style.visibility = "hidden";
    }
    return true;
  }, []);

  useLayoutEffect(() => {
    if (phase !== "scratch" || !voyageOutcome) return;
    initializeScratchCanvas();

    const handleResize = () => {
      if (scratchFallbackCoverRef.current) {
        scratchFallbackCoverRef.current.style.opacity = "1";
        scratchFallbackCoverRef.current.style.visibility = "visible";
      }
      initializeScratchCanvas();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initializeScratchCanvas, phase, voyageOutcome]);

  useEffect(() => {
    if (!scratchRevealComplete) return;
    const canvas = scratchCanvasRef.current;
    const wrap = scratchWrapRef.current;
    if (!canvas || !wrap) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const bounds = wrap.getBoundingClientRect();
    context.clearRect(0, 0, bounds.width, bounds.height);
  }, [scratchRevealComplete]);

  function recordScratchProgress(localX: number, localY: number, width: number, height: number) {
    const cellWidth = width / SCRATCH_GRID_COLS;
    const cellHeight = height / SCRATCH_GRID_ROWS;
    const minColumn = Math.max(0, Math.floor((localX - SCRATCH_BRUSH_RADIUS) / cellWidth));
    const maxColumn = Math.min(
      SCRATCH_GRID_COLS - 1,
      Math.floor((localX + SCRATCH_BRUSH_RADIUS) / cellWidth)
    );
    const minRow = Math.max(0, Math.floor((localY - SCRATCH_BRUSH_RADIUS) / cellHeight));
    const maxRow = Math.min(
      SCRATCH_GRID_ROWS - 1,
      Math.floor((localY + SCRATCH_BRUSH_RADIUS) / cellHeight)
    );
    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        scratchedCellsRef.current.add(`${column}:${row}`);
      }
    }
    const ratio = scratchedCellsRef.current.size / (SCRATCH_GRID_COLS * SCRATCH_GRID_ROWS);
    setScratchRevealRatio(ratio);
    if (ratio >= SCRATCH_COMPLETE_THRESHOLD) {
      setScratchRevealComplete(true);
    }
  }

  function scratchAtPoint(clientX: number, clientY: number) {
    const canvas = scratchCanvasRef.current;
    const wrap = scratchWrapRef.current;
    if (!canvas || !wrap) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const bounds = wrap.getBoundingClientRect();
    const localX = clamp(clientX - bounds.left, 0, bounds.width);
    const localY = clamp(clientY - bounds.top, 0, bounds.height);
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(localX, localY, SCRATCH_BRUSH_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.restore();

    recordScratchProgress(localX, localY, bounds.width, bounds.height);
  }

  function beginScratchReveal(event: React.PointerEvent<HTMLCanvasElement>) {
    if (scratchRevealComplete) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scratchingRef.current = true;
    scratchAtPoint(event.clientX, event.clientY);
  }

  function continueScratchReveal(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!scratchingRef.current || scratchRevealComplete) return;
    event.preventDefault();
    scratchAtPoint(event.clientX, event.clientY);
  }

  function endScratchReveal(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    scratchingRef.current = false;
  }

  function selectSpeed(speedId: TitanicSpeedId) {
    if (phase !== "speed") return;
    if (speedId === "stop") return;
    setPreviewSpeed(null);
    setIsDraggingTelegraph(false);
    setDragAngle(null);
    setSelectedSpeed(speedId);
  }

  function beginTelegraphDrag(event: React.PointerEvent<Element>) {
    if (phase !== "speed") return;
    const dialElement = telegraphDialRef.current;
    if (!dialElement) return;
    event.preventDefault();
    event.stopPropagation();

    const bounds = dialElement.getBoundingClientRect();
    const pointer = getTelegraphPointerAngle(event, bounds);
    const maxRadius = Math.min(bounds.width, bounds.height) * 0.52;
    if (pointer.radius > maxRadius) {
      return;
    }

    (
      event.currentTarget as Element & {
        setPointerCapture?: (pointerId: number) => void;
      }
    ).setPointerCapture?.(event.pointerId);
    setIsDraggingTelegraph(true);
    setDragAngle(pointer.angle);
    setPreviewSpeed(getNearestTelegraphSpeedId(pointer.angle, ALL_TELEGRAPH_SPEED_IDS));
  }

  function continueTelegraphDrag(event: React.PointerEvent<Element>) {
    if (!isDraggingTelegraph) return;
    const dialElement = telegraphDialRef.current;
    if (!dialElement) return;
    event.preventDefault();
    event.stopPropagation();

    const bounds = dialElement.getBoundingClientRect();
    const pointer = getTelegraphPointerAngle(event, bounds);
    const maxRadius = Math.min(bounds.width, bounds.height) * 0.56;
    if (pointer.radius > maxRadius) {
      return;
    }

    setDragAngle(pointer.angle);
    setPreviewSpeed(getNearestTelegraphSpeedId(pointer.angle, ALL_TELEGRAPH_SPEED_IDS));
  }

  function endTelegraphDrag(event: React.PointerEvent<Element>) {
    if (!isDraggingTelegraph) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerTarget = event.currentTarget as Element & {
      hasPointerCapture?: (pointerId: number) => boolean;
      releasePointerCapture?: (pointerId: number) => void;
    };
    if (pointerTarget.hasPointerCapture?.(event.pointerId)) {
      pointerTarget.releasePointerCapture?.(event.pointerId);
    }

    const dialElement = telegraphDialRef.current;
    let speedToCommit: TitanicSpeedId =
      previewSpeed ?? getNearestTelegraphSpeedId(dragAngle ?? TELEGRAPH_HANDLE_ANGLE_BY_SPEED.stop, ALL_TELEGRAPH_SPEED_IDS);
    if (dialElement) {
      const bounds = dialElement.getBoundingClientRect();
      const pointer = getTelegraphPointerAngle(event, bounds);
      const maxRadius = Math.min(bounds.width, bounds.height) * 0.56;
      if (pointer.radius <= maxRadius) {
        speedToCommit = getNearestTelegraphSpeedId(pointer.angle, ALL_TELEGRAPH_SPEED_IDS);
      }
    }
    setIsDraggingTelegraph(false);
    setPreviewSpeed(null);
    setDragAngle(null);
    setSelectedSpeed(speedToCommit);
  }

  function cancelTelegraphDrag(event: React.PointerEvent<Element>) {
    if (!isDraggingTelegraph) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerTarget = event.currentTarget as Element & {
      hasPointerCapture?: (pointerId: number) => boolean;
      releasePointerCapture?: (pointerId: number) => void;
    };
    if (pointerTarget.hasPointerCapture?.(event.pointerId)) {
      pointerTarget.releasePointerCapture?.(event.pointerId);
    }

    setIsDraggingTelegraph(false);
    setPreviewSpeed(null);
    setDragAngle(null);
  }

  function beginCourseDrawing(event: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "course") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = getPointFromPointerEvent(event, bounds);
    event.currentTarget.setPointerCapture(event.pointerId);
    setPendingCourseAdvance(false);
    setRouteValidationMessage(null);
    setAcceptedRoutePoints([]);
    setDrawnRouteStatus("drawing");
    setDrawingPoints([point]);
  }

  function continueCourseDrawing(event: React.PointerEvent<HTMLDivElement>) {
    if (drawnRouteStatus !== "drawing") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = getPointFromPointerEvent(event, bounds);
    setDrawingPoints((currentPoints) => {
      const lastPoint = currentPoints[currentPoints.length - 1];
      if (lastPoint && distanceBetween(lastPoint, point) < 0.45) {
        return currentPoints;
      }
      return [...currentPoints, point];
    });
  }

  function finishCourseDrawing(event: React.PointerEvent<HTMLDivElement>) {
    if (drawnRouteStatus !== "drawing") return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const finalPoint = getPointFromPointerEvent(event, bounds);
    const completedPoints = (() => {
      const currentPoints = drawingPointsRef.current;
      const lastPoint = currentPoints[currentPoints.length - 1];
      return lastPoint && distanceBetween(lastPoint, finalPoint) < 0.45
        ? currentPoints
        : [...currentPoints, finalPoint];
    })();
    setDrawingPoints(completedPoints);

    const validation = validateDrawnRoute(completedPoints);
    if (!validation.accepted) {
      setAcceptedRoutePoints([]);
      setDrawnRouteStatus("invalid");
      setRouteValidationMessage(validation.message);
      return;
    }

    setAcceptedRoutePoints(validation.polishedPoints);
    setRouteProfile(validation.profile);
    setDrawnRouteStatus("accepted");
    setRouteValidationMessage(null);
    setPendingCourseAdvance(true);
  }

  if (phase === "splash") {
    return (
      <WebGameSplash
        accentClass={TITANIC_MAIDEN_VOYAGE_ACCENT_CLASS}
        balance={0}
        busy={false}
        canPlay
        config={TITANIC_SPLASH_CONFIG}
        cta={TITANIC_MAIDEN_VOYAGE_CTA}
        description={TITANIC_MAIDEN_VOYAGE_DESCRIPTION}
        eyebrow={TITANIC_MAIDEN_VOYAGE_EYEBROW}
        isMuted={false}
        logoAlt={TITANIC_MAIDEN_VOYAGE_LOGO_ALT}
        logoSrc={TITANIC_MAIDEN_VOYAGE_LOGO_ASSET_SRC}
        onPlayNow={() => setPhase("course")}
        onToggleSound={() => {}}
        title={TITANIC_MAIDEN_VOYAGE_TITLE}
      />
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-[#e6c98b]/22 bg-[radial-gradient(circle_at_top,rgba(244,218,165,0.18),transparent_26%),radial-gradient(circle_at_100%_0%,rgba(76,124,176,0.18),transparent_28%),linear-gradient(180deg,#04070d_0%,#09131f_46%,#120b08_100%)] p-3 shadow-[0_36px_120px_rgba(0,0,0,0.48)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />
      <div className="pointer-events-none absolute inset-x-[8%] bottom-[-16%] h-[42%] rounded-full bg-[radial-gradient(circle,rgba(212,169,90,0.24)_0%,rgba(212,169,90,0.08)_36%,rgba(212,169,90,0)_74%)] blur-3xl" />
      <div className="relative rounded-[30px] border border-[#f0d7a2]/18 bg-[radial-gradient(circle_at_top,rgba(255,233,183,0.08),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(82,131,183,0.1),transparent_32%),linear-gradient(180deg,rgba(9,13,24,0.98),rgba(5,8,15,0.99))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(211,166,82,0.08)] sm:p-4">
        <div className="mx-auto grid max-w-[1160px] grid-rows-[auto_minmax(0,1fr)] gap-2.5 lg:h-[clamp(660px,calc(100vh-194px),760px)]">
          {phase === "course" ? <TitanicHeroHeader phaseLabel="PLOT COURSE" /> : null}
          {phase === "speed" ? <TitanicHeroHeader phaseLabel="SET SPEED" /> : null}
          {phase === "scratch" ? <TitanicHeroHeader phaseLabel="REVEAL REPORT" /> : null}

          {phase === "course" ? (
            <div className="flex min-h-0">
              <div className="flex min-h-0 flex-1 flex-col rounded-[26px] border border-[#d9b874]/18 bg-[linear-gradient(180deg,rgba(18,25,39,0.96),rgba(7,12,20,0.98))] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-2">
                <div className="min-h-0 flex-1">
                  <div className="h-full overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,31,0.96),rgba(4,8,15,0.98))]">
                  <div
                      className="relative h-full min-h-[320px] w-full overflow-hidden"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle_at_18%_16%,rgba(248,227,182,0.12),transparent_14%), radial-gradient(circle_at_76%_18%,rgba(102,152,204,0.08),transparent_16%), radial-gradient(circle_at_50%_112%,rgba(49,105,160,0.12),transparent_34%), linear-gradient(180deg,rgba(4,8,16,0.18),rgba(4,9,17,0.42)_38%,rgba(3,7,14,0.72)_100%)",
                      }}
                    >
                      <OptionalAssetImage
                        src={TITANIC_MAIDEN_VOYAGE_ROUTE_MAP_SRC}
                        alt="North Atlantic route chart background"
                        className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-[0.97]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,14,0.12),rgba(4,8,14,0.2)_38%,rgba(4,8,14,0.48)_100%)]" />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.013)_1px,transparent_1px)] bg-[size:46px_46px] opacity-11" />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(220,184,109,0.03)_22%,transparent_38%,transparent_62%,rgba(220,184,109,0.025)_78%,transparent_100%)] opacity-45" />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_70%,rgba(255,255,255,0.04)_0%,transparent_10%),radial-gradient(circle_at_82%_22%,rgba(255,255,255,0.035)_0%,transparent_10%),radial-gradient(circle_at_64%_78%,rgba(255,255,255,0.02)_0%,transparent_12%)] opacity-40" />
                      <div className="pointer-events-none absolute inset-x-[8%] bottom-[11%] h-[24%] rounded-full bg-[radial-gradient(circle,rgba(54,116,176,0.18)_0%,rgba(54,116,176,0.06)_44%,rgba(54,116,176,0)_74%)] blur-3xl" />
                      <ChartPortMarker
                        label="NEW YORK"
                        align="left"
                        className="-translate-y-1/2"
                        style={{
                          left: `${NEW_YORK_PORT_POINT.xPct}%`,
                          top: `${NEW_YORK_PORT_POINT.yPct}%`,
                        }}
                      />
                      <ChartPortMarker
                        label="SOUTHAMPTON"
                        align="left"
                        className="-translate-y-1/2"
                        style={{
                          left: `${SOUTHAMPTON_PORT_POINT.xPct}%`,
                          top: `${SOUTHAMPTON_PORT_POINT.yPct}%`,
                        }}
                      />
                      <div className="pointer-events-none absolute left-1/2 top-[8.2%] -translate-x-1/2 rounded-full border border-white/8 bg-[rgba(6,10,16,0.42)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-white/54 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                        {TITANIC_MAIDEN_VOYAGE_DRAW_ROUTE_INSTRUCTION}
                      </div>
                      {routeValidationMessage ? (
                        <div className="pointer-events-none absolute right-[4.2%] top-[8.2%] rounded-full border border-[#f0d7a2]/18 bg-[rgba(15,12,10,0.8)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#f7e7c3] shadow-[0_10px_22px_rgba(0,0,0,0.22)]">
                          {routeValidationMessage}
                        </div>
                      ) : null}

                      <div
                        className="absolute inset-0 z-20 touch-none"
                        onPointerDown={beginCourseDrawing}
                        onPointerMove={continueCourseDrawing}
                        onPointerUp={finishCourseDrawing}
                        onPointerCancel={finishCourseDrawing}
                      >
                        <svg
                          className="absolute inset-0 h-full w-full"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          {acceptedRoutePath ? (
                            <>
                              <path
                                d={acceptedRoutePath}
                                fill="none"
                                stroke="rgba(255,225,158,0.12)"
                                strokeWidth="3.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d={acceptedRoutePath}
                                fill="none"
                                stroke="rgba(248,215,137,0.88)"
                                strokeWidth="1.55"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </>
                          ) : null}
                          {!acceptedRoutePath && liveRoutePath ? (
                            <>
                              <path
                                d={liveRoutePath}
                                fill="none"
                                stroke="rgba(255,225,158,0.12)"
                                strokeWidth="3.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d={liveRoutePath}
                                fill="none"
                                stroke="rgba(248,215,137,0.72)"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </>
                          ) : null}
                          {acceptedRoutePoints.length > 0 ? (
                            <>
                              <circle
                                cx={acceptedRoutePoints[0].xPct}
                                cy={acceptedRoutePoints[0].yPct}
                                r="2.8"
                                fill="rgba(250,224,161,0.18)"
                              />
                              <circle
                                cx={acceptedRoutePoints[acceptedRoutePoints.length - 1].xPct}
                                cy={acceptedRoutePoints[acceptedRoutePoints.length - 1].yPct}
                                r="2.8"
                                fill="rgba(250,224,161,0.18)"
                              />
                            </>
                          ) : null}
                        </svg>
                      </div>

                      {acceptedRoutePoints.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearDrawnRoute}
                          className="absolute bottom-[9%] right-[4.2%] z-30 rounded-full border border-[#f0d7a2]/18 bg-[rgba(12,10,10,0.78)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#f7e7c3] transition hover:border-[#f0d7a2]/36 hover:text-[#fff5dc]"
                        >
                          Redraw Course
                        </button>
                      ) : null}
                      <div className="pointer-events-none absolute bottom-[4%] left-1/2 -translate-x-1/2 rounded-full border border-[#d7af64]/14 bg-[rgba(5,8,14,0.58)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-[#d9b874]/74">
                        North Atlantic Ocean
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {phase === "speed" ? (
            <div className="flex min-h-0">
              <div className="relative isolate z-0 flex min-w-0 min-h-0 flex-1 flex-col rounded-[26px] border border-[#d9b874]/18 bg-[linear-gradient(180deg,rgba(20,16,14,0.96),rgba(8,10,16,0.98))] p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-4">
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,14,12,0.96),rgba(6,8,15,0.98))]">
                    <div
                      className="relative flex h-full min-h-[320px] items-center justify-center overflow-hidden px-4 py-5 sm:px-6"
                      style={{
                        backgroundImage: `radial-gradient(circle_at_50%_18%,rgba(249,225,169,0.16),transparent_22%), radial-gradient(circle_at_20%_100%,rgba(78,112,164,0.18),transparent_26%), linear-gradient(180deg,rgba(11,10,15,0.8),rgba(5,8,13,0.95)), url(${TITANIC_MAIDEN_VOYAGE_BRIDGE_BACKGROUND_SRC})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center 34%",
                      }}
                  >
                    <div className="absolute left-3 top-3 z-20 flex items-center gap-2 sm:left-4 sm:top-4">
                      <StatusPill active={effectiveSpeed !== "stop"}>
                        {isDraggingTelegraph
                          ? selectedSpeedOption.shortLabel
                          : selectedSpeed === "stop"
                          ? "Awaiting Order"
                          : selectedSpeedOption.shortLabel}
                      </StatusPill>
                    </div>
                    <div className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
                      <button
                        type="button"
                        onClick={() => {
                          resetVoyageReveal();
                          setPendingCourseAdvance(false);
                          setPhase("course");
                        }}
                        className="rounded-full border border-white/8 bg-[rgba(7,9,15,0.62)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/52 transition hover:border-[#e7c57b]/18 hover:text-[#f6dfb0]/72"
                      >
                        Back
                      </button>
                    </div>
                    <OptionalAssetImage
                      src={TITANIC_MAIDEN_VOYAGE_STEAM_OVERLAY_SRC}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-18 mix-blend-screen"
                    />

                      <div className="relative flex w-full max-w-[780px] flex-col items-center justify-center pt-12 sm:pt-14">
                        <div className="pointer-events-none mb-3 text-center sm:mb-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#d7b46d]/72">
                            Set Speed
                          </div>
                        </div>
                        <div
                          ref={telegraphDialRef}
                          className="relative h-[260px] w-[260px] rounded-full border border-[#e7c57b]/18 bg-[radial-gradient(circle_at_50%_32%,rgba(246,223,176,0.08),rgba(37,24,12,0.08)_38%,rgba(7,11,18,0.4)_74%)] shadow-[0_34px_84px_rgba(0,0,0,0.42)] sm:h-[320px] sm:w-[320px] lg:h-[380px] lg:w-[380px]"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at 50% 32%, rgba(246,223,176,0.1), rgba(37,24,12,0.08) 38%, rgba(7,11,18,0.3) 74%)",
                            touchAction: "none",
                          }}
                          onPointerDown={beginTelegraphDrag}
                          onPointerMove={continueTelegraphDrag}
                          onPointerUp={endTelegraphDrag}
                          onPointerCancel={cancelTelegraphDrag}
                        >
                          <OptionalAssetImage
                            src={TITANIC_MAIDEN_VOYAGE_TELEGRAPH_DIAL_V3_SRC}
                            alt=""
                            className="pointer-events-none absolute inset-[4.5%] h-[91%] w-[91%] object-contain"
                          />
                        {TELEGRAPH_SPEED_HIT_ZONES.map((zone) => {
                          const active = selectedSpeed === zone.speedId;
                          return (
                            <button
                              key={zone.speedId}
                              type="button"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                selectSpeed(zone.speedId);
                              }}
                              className={`absolute z-20 h-[18%] w-[23%] -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${
                                active
                                  ? "border-transparent bg-transparent shadow-none"
                                  : "border-transparent bg-transparent hover:border-[#f0d7a2]/12 hover:bg-[rgba(255,228,166,0.03)]"
                              } ${zone.className}`}
                              aria-pressed={active}
                            >
                              <span className="sr-only">{zone.label}</span>
                            </button>
                          );
                        })}
                        <div
                          className={`absolute inset-0 z-40 rounded-full bg-transparent ${
                            isDraggingTelegraph ? "cursor-grabbing" : "cursor-grab"
                          }`}
                          style={{ touchAction: "none", userSelect: "none" }}
                          onPointerDown={beginTelegraphDrag}
                          onPointerMove={continueTelegraphDrag}
                          onPointerUp={endTelegraphDrag}
                          onPointerCancel={cancelTelegraphDrag}
                        />
                        <TelegraphDialHandleLayer
                          angle={renderedTelegraphAngle}
                          isDragging={isDraggingTelegraph}
                        />
                      </div>

                        <div className="mt-5 w-full max-w-[340px] rounded-[20px] border border-[#d7af64]/14 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#d5aa5c]/68">
                          Selected Speed
                        </div>
                        <div className="mt-1.5 text-[1.35rem] font-semibold tracking-[0.12em] text-[#fff2cf]">
                          {selectedSpeedOption.label}
                        </div>
                      </div>

                      <div className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7b46d]/68">
                        {isDraggingTelegraph
                          ? "Release to set speed"
                          : speedAutoAdvanceActive
                            ? "Order locked"
                            : "Tap or drag the telegraph"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {phase === "scratch" && voyageOutcome ? (
            <div className="flex min-h-0">
              <div className="flex min-h-0 flex-1 flex-col rounded-[26px] border border-[#d9b874]/18 bg-[linear-gradient(180deg,rgba(18,25,39,0.96),rgba(7,12,20,0.98))] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-2">
                <div className="min-h-0 flex-1">
                  <div className="relative h-full overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,31,0.96),rgba(4,8,15,0.98))]">
                    <div
                      ref={scratchWrapRef}
                      className="relative h-full min-h-[320px] w-full overflow-hidden"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle_at_18%_16%,rgba(248,227,182,0.12),transparent_14%), radial-gradient(circle_at_76%_18%,rgba(102,152,204,0.08),transparent_16%), radial-gradient(circle_at_50%_112%,rgba(49,105,160,0.12),transparent_34%), linear-gradient(180deg,rgba(4,8,16,0.18),rgba(4,9,17,0.42)_38%,rgba(3,7,14,0.72)_100%)",
                      }}
                    >
                      <OptionalAssetImage
                        src={TITANIC_MAIDEN_VOYAGE_ROUTE_MAP_SRC}
                        alt="North Atlantic reveal chart"
                        className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-[0.97]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,14,0.12),rgba(4,8,14,0.2)_38%,rgba(4,8,14,0.48)_100%)]" />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.013)_1px,transparent_1px)] bg-[size:46px_46px] opacity-11" />
                      <div className="pointer-events-none absolute inset-x-[8%] bottom-[11%] h-[24%] rounded-full bg-[radial-gradient(circle,rgba(54,116,176,0.18)_0%,rgba(54,116,176,0.06)_44%,rgba(54,116,176,0)_74%)] blur-3xl" />

                      <ChartPortMarker
                        label="NEW YORK"
                        align="left"
                        className="-translate-y-1/2"
                        style={{
                          left: `${NEW_YORK_PORT_POINT.xPct}%`,
                          top: `${NEW_YORK_PORT_POINT.yPct}%`,
                        }}
                      />
                      <ChartPortMarker
                        label="SOUTHAMPTON"
                        align="left"
                        className="-translate-y-1/2"
                        style={{
                          left: `${SOUTHAMPTON_PORT_POINT.xPct}%`,
                          top: `${SOUTHAMPTON_PORT_POINT.yPct}%`,
                        }}
                      />

                      <svg
                        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {revealRoutePlan.segments.map((segment, index) => {
                          const pillMarkers = revealRouteMarkers.filter(
                            (marker) =>
                              marker.fraction >= segment.startFraction - 0.0001 &&
                              marker.fraction <= segment.endFraction + 0.0001
                          );
                          const routeTone =
                            segment.tone === "legendary"
                              ? {
                                  glow: "rgba(191, 255, 126, 0.16)",
                                  fill: "#c0ff73",
                                  highlight: "rgba(248,255,229,0.88)",
                                }
                              : segment.tone === "safe"
                                ? {
                                    glow: "rgba(170, 255, 92, 0.15)",
                                    fill: "#a9ff4b",
                                    highlight: "rgba(242,255,220,0.86)",
                                  }
                                : segment.tone === "warning"
                                  ? {
                                      glow: "rgba(255, 196, 72, 0.15)",
                                      fill: "#ffc337",
                                      highlight: "rgba(255,241,202,0.84)",
                                    }
                                  : {
                                      glow: "rgba(255, 88, 88, 0.15)",
                                      fill: "#ff5252",
                                      highlight: "rgba(255,228,228,0.82)",
                                    };

                          return pillMarkers.length > 0 ? (
                            <g key={`${segment.tone}-${index}`}>
                              {pillMarkers.map((marker, markerIndex) => (
                                <g
                                  key={`${segment.tone}-${index}-${markerIndex}`}
                                  transform={`translate(${marker.xPct} ${marker.yPct})`}
                                >
                                  <circle
                                    cx="0"
                                    cy="0"
                                    r="0.5"
                                    fill={routeTone.glow}
                                  />
                                  <circle
                                    cx="0"
                                    cy="0"
                                    r="0.34"
                                    fill={routeTone.fill}
                                  />
                                  <circle
                                    cx="-0.11"
                                    cy="-0.11"
                                    r="0.12"
                                    fill={routeTone.highlight}
                                    opacity="0.78"
                                  />
                                </g>
                              ))}
                            </g>
                          ) : null;
                        })}
                        {revealRoutePlan.reachedDestination ? (
                          <>
                            <circle
                              cx={NEW_YORK_PORT_POINT.xPct}
                              cy={NEW_YORK_PORT_POINT.yPct}
                              r={voyageOutcome.tier === "legendary_arrival" ? "2.6" : "2.15"}
                              fill={
                                voyageOutcome.tier === "legendary_arrival"
                                  ? "rgba(237,255,193,0.18)"
                                  : "rgba(202,244,146,0.14)"
                              }
                            />
                            <circle
                              cx={NEW_YORK_PORT_POINT.xPct}
                              cy={NEW_YORK_PORT_POINT.yPct}
                              r={voyageOutcome.tier === "legendary_arrival" ? "1.35" : "1.1"}
                              fill={
                                voyageOutcome.tier === "legendary_arrival"
                                  ? "rgba(244,255,218,0.98)"
                                  : "rgba(217,255,176,0.94)"
                              }
                            />
                          </>
                        ) : null}
                        {revealRoutePlan.eventPoint ? (
                          <>
                            <circle
                              cx={revealRoutePlan.eventPoint.xPct}
                              cy={revealRoutePlan.eventPoint.yPct}
                              r={voyageOutcome.tier === "voyage_lost" ? "2.35" : "2.1"}
                              fill={
                                voyageOutcome.tier === "voyage_lost"
                                  ? "rgba(255,116,116,0.18)"
                                  : "rgba(255,212,122,0.16)"
                              }
                            />
                            {voyageOutcome.tier === "voyage_lost" ? (
                              <circle
                                cx={revealRoutePlan.eventPoint.xPct}
                                cy={revealRoutePlan.eventPoint.yPct}
                                r="1.15"
                                fill="rgba(255,122,122,0.98)"
                              />
                            ) : (
                              <polygon
                                points={(() => {
                                  const x = revealRoutePlan.eventPoint?.xPct ?? 0;
                                  const y = revealRoutePlan.eventPoint?.yPct ?? 0;
                                  return `${x - 0.95},${y + 1.15} ${x - 0.22},${y - 1.35} ${x + 0.42},${y - 0.42} ${x + 1.02},${y + 1.25}`;
                                })()}
                                fill="rgba(255,244,205,0.94)"
                                stroke="rgba(255,220,134,0.84)"
                                strokeWidth="0.18"
                                strokeLinejoin="round"
                              />
                            )}
                          </>
                        ) : null}
                      </svg>

                      {revealRoutePlan.eventPoint ? (
                        <div
                          className="pointer-events-none absolute z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f0d7a2]/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,236,192,0.12),rgba(10,13,20,0.92)_72%)] p-1 shadow-[0_12px_24px_rgba(0,0,0,0.2)]"
                          style={{
                            left: `${revealRoutePlan.eventPoint.xPct}%`,
                            top: `${revealRoutePlan.eventPoint.yPct}%`,
                          }}
                        >
                          <div
                            className={`h-full w-full rounded-full ${
                              voyageOutcome.tier === "voyage_lost"
                                ? "bg-[radial-gradient(circle_at_30%_30%,rgba(255,145,145,0.4),rgba(119,16,16,0.86)_72%)]"
                                : "bg-[radial-gradient(circle_at_30%_30%,rgba(255,240,198,0.24),rgba(84,95,120,0.88)_72%)]"
                            }`}
                          />
                        </div>
                      ) : null}

                      {revealRoutePlan.reachedDestination ? (
                        <div
                          className="pointer-events-none absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#dff7b0]/12 bg-[radial-gradient(circle_at_32%_32%,rgba(250,255,224,0.16),rgba(10,13,20,0.9)_72%)] p-1 shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
                          style={{
                            left: `${NEW_YORK_PORT_POINT.xPct}%`,
                            top: `${NEW_YORK_PORT_POINT.yPct}%`,
                          }}
                        >
                          <div
                            className={`h-full w-full rounded-full ${
                              voyageOutcome.tier === "legendary_arrival"
                                ? "bg-[radial-gradient(circle_at_30%_30%,rgba(237,255,193,0.26),rgba(113,156,86,0.8)_72%)]"
                                : "bg-[radial-gradient(circle_at_30%_30%,rgba(220,255,187,0.2),rgba(72,112,88,0.8)_72%)]"
                            }`}
                          />
                        </div>
                      ) : null}

                      {!scratchRevealComplete ? (
                        <>
                          <canvas
                            ref={scratchCanvasRef}
                            className="absolute inset-0 z-30 h-full w-full touch-none"
                            onPointerDown={beginScratchReveal}
                            onPointerMove={continueScratchReveal}
                            onPointerUp={endScratchReveal}
                            onPointerCancel={endScratchReveal}
                          />
                          <div
                            ref={scratchFallbackCoverRef}
                            className="pointer-events-none absolute inset-0 z-35 bg-[linear-gradient(180deg,#171310_0%,#201912_45%,#090b12_100%)] transition-none"
                          />
                        </>
                      ) : null}

                      <div className="pointer-events-none absolute bottom-[4%] left-1/2 z-40 -translate-x-1/2 rounded-full border border-[#d7af64]/14 bg-[rgba(5,8,14,0.58)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-[#d9b874]/74">
                        North Atlantic Ocean
                      </div>

                      {revealPresentationReady && resultMedia ? (
                        <TitanicRevealResultHero
                          resultMedia={resultMedia}
                          resultVideoRef={resultVideoRef}
                          resultVideoFailed={resultVideoFailed}
                          onVideoError={() => setResultVideoFailed(true)}
                          suspenseVisible={suspenseVisible}
                          awardText={
                            displayAward.points > 0 ? formatPointAward(displayedAwardPoints) : "NO PRIZE"
                          }
                          awardFootnote={
                            displayAward.points > 0 && displayAward.placeholder
                              ? "Dev preview award"
                              : ""
                          }
                          onPlayAgain={handlePlayAgain}
                          buyAgainPending={buyAgainPending}
                          settlementPending={settlementPending}
                          prefersReducedMotion={prefersReducedMotion}
                          overlayVisible={overlayVisible}
                          textVisible={textVisible}
                          awardVisible={awardVisible}
                          ctaVisible={ctaVisible}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
