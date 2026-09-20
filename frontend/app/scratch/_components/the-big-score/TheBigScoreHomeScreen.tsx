"use client";

import Image from "next/image";
import { THE_BIG_SCORE_LOGO_SRC } from "@/lib/the-big-score/theBigScoreConfig";

type TheBigScoreHomeScreenProps = {
  busy: boolean;
  canPlay: boolean;
  balance: number;
  onPlayNow: () => void;
};

export function TheBigScoreHomeScreen({
  busy,
  canPlay,
  balance,
  onPlayNow,
}: TheBigScoreHomeScreenProps) {
  return (
    <div className="relative overflow-hidden rounded-[34px] border border-[#f0c66c]/14 bg-[radial-gradient(circle_at_top,rgba(255,217,124,0.18),transparent_30%),radial-gradient(circle_at_100%_0%,rgba(255,77,77,0.14),transparent_26%),linear-gradient(180deg,#090606_0%,#120907_42%,#0b090c_100%)] p-4 shadow-[0_36px_120px_rgba(0,0,0,0.5)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:38px_38px] opacity-25" />
      <div className="relative rounded-[28px] border border-[#f2cf83]/12 bg-[linear-gradient(180deg,rgba(20,12,8,0.96),rgba(8,7,8,0.98))] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-8">
        <div className="mx-auto max-w-[720px]">
          <div className="relative aspect-[16/9] w-full">
            <Image src={THE_BIG_SCORE_LOGO_SRC} alt="The Big Score" fill sizes="100vw" className="object-contain object-center" />
          </div>
        </div>
        <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.42em] text-[#f3d89a]/62">Premium Heist Ticket</div>
        <div className="mt-4 text-3xl font-semibold text-white sm:text-[2.2rem]">Pick the entrance, lock the getaway, and call 3 of 6 vault numbers.</div>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-white/68 sm:text-[15px]">
          Choose your vault entrance, choose your getaway route, then pick three numbers from a six-number vault board before you scratch open the real combination.
        </p>
        <button
          type="button"
          onClick={onPlayNow}
          disabled={busy || !canPlay}
          className="mt-8 rounded-[22px] border border-[#ffe09a]/28 bg-[linear-gradient(135deg,#fff2ba_0%,#ffc65c_38%,#f08d2f_100%)] px-8 py-3 font-semibold text-[#241208] shadow-[0_18px_50px_rgba(255,185,72,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Working..." : "Play Now"}
        </button>
        <div className="mt-3 text-xs uppercase tracking-[0.24em] text-white/42">
          Free entry. Winnings bank to your balance: {balance}
        </div>
      </div>
    </div>
  );
}
