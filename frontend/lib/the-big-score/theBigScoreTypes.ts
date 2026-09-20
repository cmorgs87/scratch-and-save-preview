export type TheBigScoreTicketTier = "bronze" | "silver" | "gold";

export type TheBigScoreCrewId =
  | "the_ghost"
  | "the_hacker"
  | "the_wheelman"
  | "the_inside_man"
  | "the_safecracker";

export type TheBigScoreToolId =
  | "laser_spoofer"
  | "blackout_device"
  | "emp_charge"
  | "diamond_decoder"
  | "gold_key";

export type TheBigScoreEntranceId =
  | "vip_lounge"
  | "rooftop_break_in"
  | "underground_tunnel"
  | "security_room"
  | "high_roller_suite";

export type TheBigScoreGetawayId =
  | "helicopter"
  | "armored_vehicle"
  | "speedboat"
  | "railway"
  | "hot_pursuit";

export type TheBigScoreStep = 1 | 2 | 3 | 4;

export type TheBigScorePrizeTierId =
  | "show_pick"
  | "place_pick"
  | "win_pick"
  | "across_the_board"
  | "box_bet_bonus"
  | "exacta_win"
  | "trifecta_jackpot";

export type TheBigScoreSelectionCard = {
  id: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  accentClass: string;
  glow: string;
};

export type TheBigScoreCrewOption = TheBigScoreSelectionCard & {
  id: TheBigScoreCrewId;
  role: string;
};

export type TheBigScoreToolOption = TheBigScoreSelectionCard & {
  id: TheBigScoreToolId;
  colorName: string;
};

export type TheBigScoreEntranceOption = TheBigScoreSelectionCard & {
  id: TheBigScoreEntranceId;
};

export type TheBigScoreGetawayOption = TheBigScoreSelectionCard & {
  id: TheBigScoreGetawayId;
};

export type TheBigScorePrizeTier = {
  id: TheBigScorePrizeTierId;
  label: string;
  shortLabel: string;
  rewardAmount: number;
  description: string;
  treatment: "bronze" | "silver" | "gold" | "violet" | "jackpot";
};

export type TheBigScoreVaultCode = [number, number, number];
export type TheBigScoreVaultOffer = [number, number, number, number, number, number];

export type TheBigScoreTicketData = {
  mode: "the_big_score";
  version: 3;
  sessionId: string;
  seed: string;
  ticketId: TheBigScoreTicketTier;
  rewardAmount: number;
  prizeAmounts: number[];
  payoutLadder: TheBigScorePrizeTier[];
  targetPrizeTierId: TheBigScorePrizeTierId | null;
};

export type TheBigScoreGameState = {
  selectedEntrance: TheBigScoreEntranceId | null;
  selectedGetaway: TheBigScoreGetawayId | null;
  offeredVaultNumbers: TheBigScoreVaultOffer;
  selectedVaultCodeOrder: number[];
  revealedVaultCombination: TheBigScoreVaultCode | null;
  payoutMatches: TheBigScorePrizeTierId[];
  totalWinnings: number;
  currentStep: TheBigScoreStep;
};
