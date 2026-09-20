"use client";

import Image from "next/image";

export type WebGameSplashDetailItem = {
  label: string;
  value: string;
};

export type WebGameSplashStageCallout = {
  eyebrow: string;
  title: string;
  note: string;
};

export type WebGameSplashStageArtwork = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className: string;
  imageClassName?: string;
};

export type WebGameSplashStageBackdrop = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  imageClassName?: string;
};

export type WebGameSplashEnabledConfig = {
  enabled: true;
  heroLabel: string;
  interactionMode?: "buttons" | "surface";
  playLabel: string;
  showPointsPill?: boolean;
  showSplashCopy?: boolean;
  featureChips: readonly string[];
  detailItems: readonly WebGameSplashDetailItem[];
  stageCallout?: WebGameSplashStageCallout;
  stageArtwork?: WebGameSplashStageArtwork;
  stageBackdrop?: WebGameSplashStageBackdrop;
  shellClassName: string;
  overlayClassName: string;
  orbAClassName: string;
  orbBClassName: string;
  floorGlowClassName: string;
  logoWrapClassName: string;
  logoClassName: string;
  logoStageClassName?: string;
  infoPanelClassName?: string;
  minHeightClassName?: string;
  showPrimaryLogo?: boolean;
  showSoundToggle: boolean;
};

export type WebGameSplashConfig = WebGameSplashEnabledConfig | { enabled: false };

type WebGameSplashProps = {
  accentClass: string;
  balance: number;
  busy: boolean;
  canPlay: boolean;
  config: WebGameSplashEnabledConfig;
  cta: string;
  description: string;
  eyebrow: string;
  isMuted: boolean;
  logoAlt: string;
  logoSrc: string;
  onPlayNow: () => void;
  onToggleSound: () => void;
  title: string;
};

export function WebGameSplash({
  accentClass,
  busy,
  canPlay,
  config,
  cta,
  description,
  eyebrow,
  logoAlt,
  logoSrc,
  onPlayNow,
  title,
}: WebGameSplashProps) {
  const isSurfaceLaunch = config.interactionMode === "surface";
  const showSplashCopy = config.showSplashCopy !== false;
  const canLaunch = canPlay && !busy;
  const useMinimalChrome = isSurfaceLaunch && !showSplashCopy;

  return (
    <div
      aria-disabled={!canLaunch}
      aria-label={isSurfaceLaunch ? `Open ${title}` : undefined}
      className={`fixed inset-0 z-[80] overflow-hidden ${config.shellClassName} ${isSurfaceLaunch ? "cursor-pointer" : ""}`}
      onClick={isSurfaceLaunch && canLaunch ? onPlayNow : undefined}
      onKeyDown={
        isSurfaceLaunch
          ? (event) => {
              if (!canLaunch) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPlayNow();
              }
            }
          : undefined
      }
      role={isSurfaceLaunch ? "button" : undefined}
      tabIndex={isSurfaceLaunch ? 0 : undefined}
    >
      {config.stageBackdrop ? (
        <div className={`absolute inset-0 ${config.stageBackdrop.className ?? ""}`}>
          <Image
            src={config.stageBackdrop.src}
            alt={config.stageBackdrop.alt}
            width={config.stageBackdrop.width}
            height={config.stageBackdrop.height}
            className={`h-full w-full object-cover ${config.stageBackdrop.imageClassName ?? ""}`}
            priority
          />
        </div>
      ) : null}
      <div className={`absolute inset-0 ${config.overlayClassName}`} />
      <div className={`pointer-events-none absolute left-[6%] top-[14%] h-56 w-56 rounded-full blur-3xl ${config.orbAClassName}`} />
      <div className={`pointer-events-none absolute right-[10%] top-[12%] h-64 w-64 rounded-full blur-3xl ${config.orbBClassName}`} />
      <div className={`pointer-events-none absolute bottom-[-12%] left-1/2 h-80 w-[68vw] -translate-x-1/2 rounded-full blur-3xl ${config.floorGlowClassName}`} />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[36vh] ${
          useMinimalChrome
            ? "bg-[radial-gradient(circle_at_50%_100%,rgba(96,218,255,0.28)_0%,rgba(96,218,255,0.12)_26%,transparent_56%),linear-gradient(180deg,rgba(4,8,20,0)_0%,rgba(4,8,20,0.03)_18%,rgba(4,8,20,0.28)_100%)]"
            : "bg-[radial-gradient(circle_at_50%_100%,rgba(96,218,255,0.2)_0%,rgba(96,218,255,0.08)_24%,transparent_52%),linear-gradient(180deg,rgba(4,8,20,0)_0%,rgba(4,8,20,0.08)_18%,rgba(4,8,20,0.56)_100%)]"
        }`}
      />
      <div
        className={`pointer-events-none absolute left-0 top-0 h-full ${
          useMinimalChrome
            ? "w-[18vw] bg-[linear-gradient(90deg,rgba(4,8,20,0.28)_0%,rgba(4,8,20,0.06)_42%,transparent_100%)]"
            : "w-[28vw] bg-[linear-gradient(90deg,rgba(4,8,20,0.72)_0%,rgba(4,8,20,0.18)_48%,transparent_100%)]"
        }`}
      />

      {showSplashCopy ? (
        <div className="absolute left-10 top-8 flex items-center gap-3">
          <div className="inline-flex rounded-full border border-white/14 bg-white/8 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.34em] text-white/68 backdrop-blur-xl">
            {eyebrow}
          </div>
          <div className="inline-flex rounded-full border border-white/12 bg-black/18 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/52 backdrop-blur-xl">
            {config.heroLabel}
          </div>
        </div>
      ) : null}

      {showSplashCopy && config.stageCallout ? (
        <div className="absolute left-10 top-24 z-10 max-w-[240px] text-white drop-shadow-[0_14px_34px_rgba(0,0,0,0.42)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/52">{config.stageCallout.eyebrow}</div>
          <div className="mt-2 text-[1.35rem] font-black uppercase leading-none tracking-[0.08em] text-white">
            {config.stageCallout.title}
          </div>
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/44">{config.stageCallout.note}</div>
        </div>
      ) : null}

      {config.stageArtwork ? (
        <div className={`pointer-events-none absolute z-10 ${config.stageArtwork.className}`}>
          <Image
            src={config.stageArtwork.src}
            alt={config.stageArtwork.alt}
            width={config.stageArtwork.width}
            height={config.stageArtwork.height}
            className={`h-auto w-full object-contain ${config.stageArtwork.imageClassName ?? ""}`}
            unoptimized
            priority
          />
        </div>
      ) : null}

      {config.showPrimaryLogo === false ? null : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 pb-16">
          <div className={`flex w-full items-center justify-center ${config.logoWrapClassName}`}>
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={1200}
              height={560}
              sizes="100vw"
              className={`h-auto w-full object-contain ${config.logoClassName}`}
              unoptimized
              priority
            />
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto flex max-w-[1440px] items-end justify-between gap-8 px-10 pb-10">
          {showSplashCopy ? (
            <div className="max-w-[440px] text-white drop-shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-white/48">{cta}</div>
              <h1 className="mt-4 text-[2.4rem] font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-4 text-sm leading-6 text-white/72">{description}</p>

              <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
                {config.featureChips.map((chip) => (
                  <div
                    key={chip}
                    className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/68"
                  >
                    {chip}
                  </div>
                ))}
              </div>
            </div>
          ) : <div />}

          {isSurfaceLaunch ? <div /> : (
            <div className="w-full max-w-[420px]">
              <div className="drop-shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
                {showSplashCopy ? (
                  <div className="grid gap-3">
                    {config.detailItems.map((item) => (
                      <div
                        key={`${item.label}-${item.value}`}
                        className="border-b border-white/12 pb-3"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/42">{item.label}</div>
                        <div className="mt-2 text-base font-semibold text-white">{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className={`${showSplashCopy ? "mt-5" : ""} flex flex-col gap-4`}>
                  <button
                    className={`w-full rounded-[24px] bg-gradient-to-r ${accentClass} px-8 py-4 text-base font-semibold text-slate-950 shadow-[0_20px_54px_rgba(87,236,214,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60`}
                    onClick={onPlayNow}
                    disabled={busy || !canPlay}
                    type="button"
                  >
                    {busy ? "Working..." : config.playLabel}
                  </button>

                  {showSplashCopy ? (
                    <div className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                      Desktop web intro
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
