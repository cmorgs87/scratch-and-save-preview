"use client";

import Image from "next/image";
import { THE_BIG_SCORE_ENTRANCES, THE_BIG_SCORE_GETAWAYS } from "@/lib/the-big-score/theBigScoreConfig";
import type {
  TheBigScoreEntranceOption,
  TheBigScoreGameState,
  TheBigScoreGetawayOption,
  TheBigScoreSelectionCard,
} from "@/lib/the-big-score/theBigScoreTypes";
import { TheBigScoreBoardHeader } from "./TheBigScoreBoardHeader";

type TheBigScoreSetupProps = {
  state: TheBigScoreGameState;
  onSelectEntrance: (entranceId: TheBigScoreEntranceOption["id"]) => void;
  onChooseEntrance: (entranceId: TheBigScoreEntranceOption["id"]) => void;
  onConfirmEntrance: () => void;
  onSelectGetaway: (getawayId: TheBigScoreGetawayOption["id"]) => void;
  onChooseGetaway: (getawayId: TheBigScoreGetawayOption["id"]) => void;
  onConfirmGetaway: () => void;
  onGoToStep: (step: 1 | 2 | 3) => void;
  instantCommitSelections?: boolean;
  showSelectionHeader?: boolean;
  compactSelectionSizing?: boolean;
  selectionDisabled?: boolean;
};

function SelectionCard({
  option,
  active,
  disabled,
  compactLayout,
  compactSelectionSizing,
  onClick,
}: {
  option: TheBigScoreSelectionCard;
  active: boolean;
  disabled?: boolean;
  compactLayout?: boolean;
  compactSelectionSizing?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative overflow-hidden rounded-[26px] border text-left transition ${
        active
          ? "scale-[1.01] border-[#ffe09a]/60 bg-[linear-gradient(180deg,rgba(255,238,180,0.08),rgba(255,238,180,0.02))]"
          : "border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
      } ${compactLayout ? "xl:h-full" : ""} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      style={{
        boxShadow: active ? `0 22px 54px ${option.glow}` : undefined,
      }}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${option.accentClass} opacity-90`} />
      <div
        className={
          compactLayout
            ? compactSelectionSizing
              ? "relative px-2.5 pb-2.5 pt-2.5 xl:flex xl:h-full xl:flex-col xl:px-1 xl:pb-1 xl:pt-1"
              : "relative px-2 pb-2 pt-2 xl:flex xl:h-full xl:flex-col xl:px-1 xl:pb-1 xl:pt-1"
            : "relative px-3 pb-4 pt-4"
        }
      >
        <div className="overflow-hidden rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] xl:min-h-0 xl:flex-1">
          <div
            className={
              compactLayout
                ? compactSelectionSizing
                  ? "relative aspect-[1.02/0.94] w-full xl:h-full xl:aspect-auto"
                  : "relative aspect-[1.08/0.84] w-full xl:h-full xl:aspect-auto"
                : "relative aspect-[1/1] w-full"
            }
          >
            <Image
              src={option.imageSrc}
              alt={option.title}
              fill
              sizes="(max-width: 768px) 50vw, 20vw"
              className={`object-contain transition duration-300 group-hover:scale-[1.02] ${
                compactLayout ? "object-top" : "object-center"
              }`}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

function ActionBar({
  onBack,
  onConfirm,
  confirmLabel,
  confirmDisabled,
}: {
  onBack?: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-[22px] border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-white/72 transition hover:bg-white/[0.08]"
        >
          Back
        </button>
      ) : null}
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="rounded-[22px] border border-[#ffe09a]/26 bg-[linear-gradient(135deg,#fff2ba_0%,#ffc65c_38%,#f08d2f_100%)] px-8 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#26160d] shadow-[0_18px_48px_rgba(255,186,73,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

export function TheBigScoreSetup({
  state,
  onSelectEntrance,
  onChooseEntrance,
  onConfirmEntrance,
  onSelectGetaway,
  onChooseGetaway,
  onConfirmGetaway,
  onGoToStep,
  instantCommitSelections = false,
  showSelectionHeader = instantCommitSelections,
  compactSelectionSizing = false,
  selectionDisabled = false,
}: TheBigScoreSetupProps) {
  const isEntranceStep = state.currentStep === 1;
  const options = isEntranceStep ? THE_BIG_SCORE_ENTRANCES : THE_BIG_SCORE_GETAWAYS;
  const activeId = isEntranceStep ? state.selectedEntrance : state.selectedGetaway;
  const selectionSubtitle = isEntranceStep ? "Choose Your Entrance" : "Choose Your Getaway";

  return (
    <div className="space-y-4">
      <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,10,9,0.95),rgba(10,8,9,0.98))] p-4 shadow-[0_22px_72px_rgba(0,0,0,0.28)] sm:p-5 xl:flex xl:h-[calc(100dvh-6.25rem)] xl:flex-col xl:px-2.5 xl:pt-2 xl:pb-2">
        {showSelectionHeader ? <TheBigScoreBoardHeader subtitle={selectionSubtitle} /> : null}
        <div className={`grid grid-cols-2 ${compactSelectionSizing ? "gap-3 sm:gap-3.5" : "gap-2.5"} xl:min-h-0 xl:flex-1 xl:grid-rows-2`}>
          {options.map((option) => (
            <SelectionCard
              key={option.id}
              option={option}
              active={activeId === option.id}
              disabled={selectionDisabled}
              compactLayout={instantCommitSelections}
              compactSelectionSizing={compactSelectionSizing}
              onClick={() =>
                instantCommitSelections
                  ? isEntranceStep
                    ? onChooseEntrance(option.id as TheBigScoreEntranceOption["id"])
                    : onChooseGetaway(option.id as TheBigScoreGetawayOption["id"])
                  : isEntranceStep
                    ? onSelectEntrance(option.id as TheBigScoreEntranceOption["id"])
                    : onSelectGetaway(option.id as TheBigScoreGetawayOption["id"])
              }
            />
          ))}
        </div>
      </section>

      {!instantCommitSelections ? (
        <ActionBar
          onBack={state.currentStep === 2 ? () => onGoToStep(1) : undefined}
          onConfirm={isEntranceStep ? onConfirmEntrance : onConfirmGetaway}
          confirmLabel={isEntranceStep ? "Confirm Entrance" : "Confirm Getaway"}
          confirmDisabled={!activeId}
        />
      ) : null}
    </div>
  );
}
