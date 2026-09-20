import Image from "next/image";

import type { LifetimeStatusTier } from "@/lib/lifetime-status";
import { getLifetimeStatusIconAsset } from "@/lib/lifetime-status";

type LegacyCollectionTrophyProps = {
  tier: LifetimeStatusTier;
  state: "current" | "earned" | "next" | "locked";
  size?: "summary" | "hero" | "tile";
  presentation?: "default" | "showcase" | "unlockHero";
  className?: string;
};

const sizeMap = {
  summary: "h-[56px] w-[56px]",
  hero: "h-[240px] w-[240px] sm:h-[280px] sm:w-[280px]",
  tile: "h-[100px] w-[100px]",
} as const;

const showcaseSizeMap = {
  summary: sizeMap.summary,
  hero: "h-[260px] w-[260px] sm:h-[320px] sm:w-[320px]",
  tile: sizeMap.tile,
} as const;

const unlockHeroSizeMap = {
  summary: sizeMap.summary,
  hero: "h-[300px] w-[300px] sm:h-[336px] sm:w-[336px]",
  tile: sizeMap.tile,
} as const;

const accentMap: Record<string, string> = {
  mint: "from-[rgba(86,230,213,0.44)] via-[rgba(142,255,239,0.2)] to-transparent",
  gold: "from-[rgba(255,209,107,0.44)] via-[rgba(255,241,199,0.18)] to-transparent",
  cyan: "from-[rgba(96,188,255,0.42)] via-[rgba(180,228,255,0.16)] to-transparent",
  teal: "from-[rgba(64,205,181,0.42)] via-[rgba(151,255,237,0.16)] to-transparent",
  amber: "from-[rgba(255,180,67,0.42)] via-[rgba(255,236,192,0.16)] to-transparent",
  ruby: "from-[rgba(255,118,146,0.42)] via-[rgba(255,215,224,0.14)] to-transparent",
  sapphire: "from-[rgba(85,142,255,0.42)] via-[rgba(211,223,255,0.16)] to-transparent",
  violet: "from-[rgba(161,110,255,0.42)] via-[rgba(232,219,255,0.14)] to-transparent",
  magenta: "from-[rgba(255,102,188,0.42)] via-[rgba(255,214,240,0.14)] to-transparent",
  purple: "from-[rgba(145,102,255,0.42)] via-[rgba(235,223,255,0.16)] to-transparent",
  platinum: "from-[rgba(222,232,243,0.42)] via-[rgba(255,255,255,0.16)] to-transparent",
  copper: "from-[rgba(220,145,98,0.42)] via-[rgba(255,223,206,0.15)] to-transparent",
  ice: "from-[rgba(184,241,255,0.42)] via-[rgba(232,249,255,0.18)] to-transparent",
  aurora: "from-[rgba(115,255,220,0.36)] via-[rgba(176,153,255,0.2)] to-transparent",
  celestial: "from-[rgba(255,226,150,0.4)] via-[rgba(179,226,255,0.18)] to-transparent",
};

const stateLabelMap: Record<LegacyCollectionTrophyProps["state"], string> = {
  current: "Current Legacy",
  earned: "Unlocked Legacy",
  next: "Next Legacy",
  locked: "Legacy Locked",
};

function getAccentClasses(accentToken?: string) {
  return accentMap[accentToken ?? "mint"] ?? accentMap.mint;
}

export function LegacyCollectionTrophy({
  tier,
  state,
  size = "summary",
  presentation = "default",
  className = "",
}: LegacyCollectionTrophyProps) {
  if (size === "summary") {
    return (
      <div
        className={`relative inline-flex ${sizeMap.summary} items-center justify-center overflow-hidden rounded-[20px] border border-[color:var(--panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(6,10,20,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_22px_rgba(3,9,20,0.22)] ${className}`.trim()}
        aria-hidden="true"
      >
        <div className="absolute inset-[9%] rounded-[17px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(8,14,28,0.88))]" />
        <div className="absolute inset-x-[20%] bottom-[10%] h-[12%] rounded-full bg-black/30 blur-[6px]" />
        <div className="relative flex h-full w-full items-center justify-center p-[3px]">
          <Image
            src={getLifetimeStatusIconAsset(tier)}
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
            className="h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(4,10,22,0.34)]"
          />
        </div>
      </div>
    );
  }

  const frameRadius = size === "hero" ? "rounded-[34px]" : "rounded-[26px]";
  const artRadius = size === "hero" ? "rounded-[28px]" : "rounded-[20px]";
  const paddingClass = size === "hero" ? "p-4 sm:p-5" : "p-3";
  const imageSize = size === "hero" ? 360 : 176;
  const isLocked = state === "locked";
  const isCurrent = state === "current";
  const isNext = state === "next";
  const isShowcase = presentation === "showcase";
  const isUnlockHero = presentation === "unlockHero";
  const accentClasses = getAccentClasses(tier.accentToken);
  const surfaceToneClass = isLocked
    ? "border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_32px_rgba(2,6,23,0.18)]"
    : isCurrent
      ? "border-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_44px_rgba(2,6,23,0.28)]"
      : "border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_36px_rgba(2,6,23,0.22)]";
  const imageToneClass = isLocked
    ? "brightness-75 saturate-50 opacity-80"
    : isNext
      ? "brightness-95 saturate-[0.9] opacity-95"
      : "brightness-100 saturate-100 opacity-100";
  const haloOpacityClass = isLocked ? "opacity-40" : isCurrent ? "opacity-100" : "opacity-80";
  const activeSizeMap = isUnlockHero ? unlockHeroSizeMap : isShowcase ? showcaseSizeMap : sizeMap;
  const rootOverflowClass = isShowcase || isUnlockHero ? "overflow-visible" : "overflow-hidden";
  const outerPaddingClass = isUnlockHero ? "p-3.5 sm:p-4.5" : isShowcase ? "p-6 sm:p-7" : paddingClass;
  const imageInsetClass = isUnlockHero ? "inset-[8.5%]" : isShowcase ? "inset-[11%]" : "inset-[7%]";
  const imageDropShadowClass = isUnlockHero
    ? "drop-shadow-[0_18px_34px_rgba(3,9,20,0.24)]"
    : isShowcase
    ? "drop-shadow-[0_24px_48px_rgba(3,9,20,0.36)]"
    : "drop-shadow-[0_18px_34px_rgba(3,9,20,0.42)]";
  const imageScaleClass = isUnlockHero ? "" : isShowcase ? "scale-[0.92]" : "";
  const artWrapperOverflowClass = isShowcase || isUnlockHero ? "overflow-visible" : "overflow-hidden";
  const artSurfaceInsetClass = isUnlockHero ? "inset-[11%]" : isShowcase ? "inset-[12%]" : "inset-[10%]";
  const outerHaloBlurClass = isUnlockHero ? "blur-[36px]" : isShowcase ? "blur-[34px]" : "blur-[24px]";
  const innerShadowInsetClass = isUnlockHero ? "bottom-[9%] h-[4.5%]" : isShowcase ? "bottom-[5%] h-[8%]" : "bottom-[7%] h-[10%]";
  const frameOverlayClass = isUnlockHero
    ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.008))]"
    : "bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]";
  const innerBorderInsetClass = isUnlockHero ? "inset-[3.6%]" : "inset-[5%]";
  const rootBackgroundClass = isUnlockHero
    ? "bg-[radial-gradient(circle_at_50%_34%,rgba(255,226,156,0.09),rgba(116,214,255,0.035)_32%,rgba(255,255,255,0.012)_56%,rgba(255,255,255,0.004))]"
    : "bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]";
  const artSurfaceClass = isUnlockHero
    ? "border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_24px_rgba(2,6,23,0.08)] bg-[radial-gradient(circle_at_50%_44%,rgba(255,244,211,0.08),rgba(125,213,255,0.03)_26%,rgba(10,16,30,0.08)_54%,rgba(7,12,24,0.02)_78%,transparent_100%)]"
    : `${surfaceToneClass} bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,0.12),rgba(255,255,255,0)_40%),linear-gradient(180deg,rgba(6,10,18,0.96),rgba(12,21,38,0.92))]`;
  const innerBorderClass = isUnlockHero ? "border-white/4" : "border-white/8";
  const imageWrapExtraClass = isUnlockHero ? "legacy-unlock-hero-art" : "";
  const imagePositionClass =
    isUnlockHero && tier.key === "treasure_hunter"
      ? "object-[58%_50%]"
      : isUnlockHero && tier.key === "high_roller"
        ? "object-[50%_48%]"
        : "object-center";

  return (
    <div
      className={`relative inline-flex ${activeSizeMap[size]} items-center justify-center ${rootOverflowClass} ${frameRadius} border border-[color:var(--panel-border)] ${rootBackgroundClass} shadow-[0_24px_54px_rgba(2,6,23,0.16)] ${className}`.trim()}
      aria-hidden="true"
    >
      <div className={`absolute inset-[8%] rounded-full bg-gradient-to-br ${accentClasses} ${outerHaloBlurClass} ${haloOpacityClass}`} />
      <div className={`absolute inset-[1px] ${frameRadius} ${frameOverlayClass}`} />
      <div className={`absolute ${artSurfaceInsetClass} ${artRadius} ${artSurfaceClass}`} />
      <div className={`relative z-[1] flex h-full w-full items-center justify-center ${outerPaddingClass}`}>
        <div className={`relative h-full w-full ${artWrapperOverflowClass} ${artRadius}`}>
          <div className={`absolute inset-x-[18%] ${innerShadowInsetClass} rounded-full bg-black/35 blur-md`} />
          <div className={`absolute ${imageInsetClass} z-[2] flex items-center justify-center ${imageWrapExtraClass}`}>
            <Image
              src={getLifetimeStatusIconAsset(tier)}
              alt=""
              aria-hidden="true"
              width={imageSize}
              height={imageSize}
              className={`h-full w-full object-contain ${imagePositionClass} ${imageDropShadowClass} transition ${imageToneClass} ${imageScaleClass}`}
            />
          </div>
          <div className={`absolute ${innerBorderInsetClass} rounded-[inherit] border ${innerBorderClass}`} />
          {isLocked ? (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,9,14,0.10),rgba(4,7,12,0.34))]" />
              <div className="absolute bottom-[10%] right-[10%] inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/12 bg-[rgba(5,8,13,0.72)] px-2 text-[0.68rem] font-semibold text-white/82 shadow-[0_10px_22px_rgba(0,0,0,0.26)]">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 10V8a4 4 0 1 1 8 0v2" />
                  <rect x="6" y="10" width="12" height="10" rx="2" />
                </svg>
                <span className="sr-only">{stateLabelMap[state]}</span>
              </div>
            </>
          ) : null}
          {isCurrent ? (
            <div className="absolute inset-[5%] rounded-[inherit] border border-white/12 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_24px_rgba(86,230,213,0.14)]" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
