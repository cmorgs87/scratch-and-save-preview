export type TripleCrownDerbyTicketTier = "bronze" | "silver" | "gold";

export type TripleCrownDerbyHorseId =
  | "midnight_thunder"
  | "blazing_comet"
  | "silver_phantom"
  | "golden_stride"
  | "iron_valor"
  | "crimson_dash";

export type TripleCrownDerbyPickSlot = "win" | "place" | "show";

export type TripleCrownDerbyPrizeTierId =
  | "show_pick"
  | "place_pick"
  | "win_pick"
  | "across_the_board"
  | "box_bet_bonus"
  | "exacta_win"
  | "trifecta_jackpot";

export type TripleCrownDerbyPhase = "selection" | "ready" | "scratching" | "photo_finish" | "revealed";

export type TripleCrownDerbyHorse = {
  id: TripleCrownDerbyHorseId;
  number: number;
  name: string;
  nickname: string;
  rating: number;
  imageSrc: string;
  accent: string;
  glow: string;
};

export type TripleCrownDerbyPrizeTier = {
  id: TripleCrownDerbyPrizeTierId;
  label: string;
  shortLabel: string;
  rewardAmount: number;
  description: string;
  treatment: "bronze" | "silver" | "gold" | "violet" | "jackpot";
};

export type TripleCrownDerbyPickState = Record<TripleCrownDerbyPickSlot, TripleCrownDerbyHorseId | null>;

export type TripleCrownDerbyTicketData = {
  mode: "triple_crown_derby";
  version: 1;
  sessionId: string;
  seed: string;
  ticketId: TripleCrownDerbyTicketTier;
  rewardAmount: number;
  horses: TripleCrownDerbyHorse[];
  payoutLadder: TripleCrownDerbyPrizeTier[];
  targetPrizeTierId: TripleCrownDerbyPrizeTierId | null;
};

export type TripleCrownDerbyRaceResult = {
  finishOrder: TripleCrownDerbyHorseId[];
  podium: TripleCrownDerbyHorseId[];
  prizeTierId: TripleCrownDerbyPrizeTierId | null;
  rewardAmount: number;
  headline: string;
  subhead: string;
  matchedHorseIds: TripleCrownDerbyHorseId[];
  winningPickSlots: TripleCrownDerbyPickSlot[];
  isJackpot: boolean;
};

export type TripleCrownDerbyGameState = {
  phase: TripleCrownDerbyPhase;
  activeSlot: TripleCrownDerbyPickSlot;
  picks: TripleCrownDerbyPickState;
  scratchedRatio: number;
  scratchComplete: boolean;
  raceResult: TripleCrownDerbyRaceResult | null;
};
