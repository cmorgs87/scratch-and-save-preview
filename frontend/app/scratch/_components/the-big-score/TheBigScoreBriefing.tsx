"use client";

import { createTheBigScoreLoadoutCallsign, formatTheBigScoreVaultNumber } from "@/lib/the-big-score/theBigScoreLogic";
import type { TheBigScoreGameState } from "@/lib/the-big-score/theBigScoreTypes";

type TheBigScoreBriefingProps = {
  state: TheBigScoreGameState;
  onBack: () => void;
  onStartHeist: () => void;
};

export function TheBigScoreBriefing({ state, onBack, onStartHeist }: TheBigScoreBriefingProps) {
  const callsign = createTheBigScoreLoadoutCallsign(state);

  return (
    <div className="space-y-5">
      <div className="rounded-[30px] border border-[#f0c66c]/14 bg-[radial-gradient(circle_at_top,rgba(255,225,130,0.12),transparent_34%),linear-gradient(180deg,rgba(18,11,8,0.98),rgba(9,8,8,0.98))] p-5 shadow-[0_24px_84px_rgba(0,0,0,0.34)] sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#f2d59a]/66">Heist Briefing</div>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-3xl font-semibold text-white sm:text-[2.2rem]">Vault code queued.</div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62 sm:text-[15px]">
              This legacy briefing component is no longer part of the live Big Score flow, but it still reflects the current heist state for compatibility.
            </p>
          </div>
          <div className="rounded-[22px] border border-[#ffe09a]/18 bg-[linear-gradient(180deg,rgba(255,231,174,0.08),rgba(255,231,174,0.03))] px-4 py-3 text-right shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f2d59a]/58">Callsign</div>
            <div className="mt-2 text-lg font-semibold text-white">{callsign}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {state.offeredVaultNumbers.map((value, index) => (
          <div key={value} className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,11,8,0.96),rgba(8,7,7,0.98))] p-5 text-center shadow-[0_20px_56px_rgba(0,0,0,0.28)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/42">{`Vault Number ${index + 1}`}</div>
            <div className="mt-3 text-4xl font-black text-[#fff0bc]">{formatTheBigScoreVaultNumber(value)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[22px] border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-white/72 transition hover:bg-white/[0.08]"
        >
          Back to Setup
        </button>
        <button
          type="button"
          onClick={onStartHeist}
          className="rounded-[22px] border border-[#ffe09a]/26 bg-[linear-gradient(135deg,#fff2ba_0%,#ffc65c_38%,#f08d2f_100%)] px-8 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#26160d] shadow-[0_18px_48px_rgba(255,186,73,0.24)] transition hover:brightness-105"
        >
          Start Heist
        </button>
      </div>
    </div>
  );
}
