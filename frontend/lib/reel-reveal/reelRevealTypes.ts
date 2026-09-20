export type ReelRevealTicketTier = "bronze" | "silver" | "gold";

export type ReelRevealSymbolId = "clover" | "seven" | "bell" | "cherries" | "dice" | "grapes";

export type ReelRevealPhase =
  | "idle"
  | "scratching"
  | "revealed"
  | "readyToSpin"
  | "spinning"
  | "win"
  | "lose"
  | "complete";

export type ReelRevealPayoutStyle = "sky" | "violet" | "gold" | "ruby" | "jackpot";

export type ReelRevealSymbol = {
  id: ReelRevealSymbolId;
  label: string;
  src: string;
  accent: string;
  glow: string;
  frame: string;
};

export type ReelRevealPayoutRow = {
  id: string;
  label: string;
  symbols: ReelRevealSymbolId[];
  rewardAmount: number;
  style: ReelRevealPayoutStyle;
};

export type ReelRevealSpinOutcome = {
  payoutRowId: string | null;
  rewardAmount: number;
  symbols: ReelRevealSymbolId[];
  headline: string;
  subhead: string;
  celebration: "none" | "spark" | "jackpot";
};

export type ReelRevealTicketData = {
  mode: "reel_reveal";
  version: 1;
  sessionId: string;
  seed: string;
  ticketId: ReelRevealTicketTier;
  rewardAmount: number;
  reelCount: number;
  visibleRows: number;
  reelStrips: ReelRevealSymbolId[][];
  initialReelIndexes: number[];
  finalReelIndexes: number[];
  payoutRows: ReelRevealPayoutRow[];
  spinOutcome: ReelRevealSpinOutcome;
};

export type ReelRevealGameState = {
  phase: ReelRevealPhase;
  scratchedRatio: number;
  scratchComplete: boolean;
  spinStarted: boolean;
  spinResolved: boolean;
  reelIndexes: number[];
  stoppedReels: boolean[];
  visibleSymbols: ReelRevealSymbolId[];
  finalSymbols: ReelRevealSymbolId[] | null;
};
