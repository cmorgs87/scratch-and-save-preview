"use client";

import Image from "next/image";
import { THE_BIG_SCORE_LOGO_SRC } from "@/lib/the-big-score/theBigScoreConfig";

type TheBigScoreBoardHeaderProps = {
  subtitle?: string;
  size?: "large" | "medium";
};

export function TheBigScoreBoardHeader({ subtitle, size = "large" }: TheBigScoreBoardHeaderProps) {
  const logoClass =
    size === "medium"
      ? "relative h-[112px] w-[654px] max-w-full drop-shadow-[0_14px_30px_rgba(255,186,73,0.22)]"
      : "relative h-[150px] w-[876px] max-w-full drop-shadow-[0_16px_34px_rgba(255,186,73,0.24)]";
  const logoSizes = size === "medium" ? "654px" : "876px";

  return (
    <div className="mb-1 flex flex-col items-center text-center xl:mb-0.5">
      <div className={logoClass}>
        <Image src={THE_BIG_SCORE_LOGO_SRC} alt="The Big Score" fill sizes={logoSizes} className="object-contain object-center" />
      </div>
      {subtitle ? <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f3d89a]/68">{subtitle}</div> : null}
    </div>
  );
}
