"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { AppTopBar } from "@/app/_components/AppChromeControls";

export type MobileGameStage = "splash" | "loading" | "ready" | "playing";

type MobileGameFlowShellProps = {
  stage: MobileGameStage;
  balance: number;
  logoSrc: string;
  logoAlt: string;
  accentClass: string;
  backgroundClass: string;
  loadingLabel?: string;
  playLabel?: string;
  revealLabel?: string;
  showRevealAction?: boolean;
  revealDisabled?: boolean;
  isMuted: boolean;
  onPlayNow?: () => void;
  onRevealAll?: () => void;
  onToggleSound: () => void;
  readyPreview?: ReactNode;
  gameplay: ReactNode;
};

export function MobileGameFlowShell({
  stage,
  balance,
  logoSrc,
  logoAlt,
  accentClass,
  backgroundClass,
  loadingLabel = "Loading your ticket...",
  playLabel = "Play Now",
  isMuted,
  onPlayNow,
  onToggleSound,
}: MobileGameFlowShellProps) {
  if (stage === "playing") {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-40 overflow-x-hidden ${backgroundClass}`}
      style={{
        paddingTop: "max(0.2rem, calc(env(safe-area-inset-top) + 0.1rem))",
        paddingBottom: "max(1.5rem, calc(6rem + env(safe-area-inset-bottom)))",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/66 backdrop-blur-md" />
      <div className="relative mx-auto flex min-h-full w-full max-w-[430px] flex-col px-4 md:max-w-[680px]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end"
          style={{
            paddingTop: "max(0.6rem, calc(env(safe-area-inset-top) + 0.3rem))",
            paddingRight: "max(0.5rem, calc(0.25rem + env(safe-area-inset-right)))",
          }}
        >
          <AppTopBar
            balance={balance}
            isMuted={isMuted}
            onToggleAudio={onToggleSound}
            compact
            className="pointer-events-auto w-auto min-w-[224px] border-white/14 bg-[rgba(11,18,32,0.82)]"
          />
        </div>

        <section className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px] md:max-w-[560px]">
            <div className="relative overflow-hidden rounded-[34px] border border-white/14 bg-[rgba(10,18,32,0.24)] px-8 py-10 shadow-[0_36px_90px_rgba(0,0,0,0.32)] backdrop-blur-sm md:px-12 md:py-14">
              <div className={`absolute inset-0 bg-gradient-to-br ${accentClass} opacity-[0.18]`} />
              <div className="relative flex min-h-[520px] flex-col items-center justify-center md:min-h-[640px]">
                <div className="relative h-72 w-full md:h-[24rem]">
                  <Image src={logoSrc} alt={logoAlt} fill unoptimized sizes="420px" className="object-contain" />
                </div>

                {stage === "loading" ? (
                  <>
                    <div className="mt-8 text-lg font-semibold text-white">{loadingLabel}</div>
                    <div className="mt-2 text-sm text-white/72">Getting everything ready to play!</div>
                    <div className="mt-6 h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-white/12">
                      <div className={`h-full w-2/3 rounded-full bg-gradient-to-r ${accentClass}`} />
                    </div>
                  </>
                ) : null}

                {stage === "ready" ? (
                  <div className="mt-10 flex w-full max-w-[300px] flex-col items-center gap-3 md:mt-12 md:max-w-[340px]">
                    <button
                      className={`w-full rounded-[24px] bg-gradient-to-r ${accentClass} px-5 py-4 text-base font-semibold text-slate-950 shadow-[0_18px_50px_rgba(87,236,214,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60`}
                      onClick={onPlayNow}
                      type="button"
                    >
                      {playLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
