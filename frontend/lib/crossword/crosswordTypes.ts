export type CrosswordTicketTier = "bronze" | "silver" | "gold";

export type CrosswordBoardCell = {
  id: string;
  row: number;
  col: number;
  letter: string;
  isPlayable: boolean;
  matched: boolean;
  revealedByMatch: boolean;
  wordIds: string[];
};

export type CrosswordWord = {
  id: string;
  text: string;
  cellIds: string[];
  isComplete: boolean;
};

export type CrosswordLetterBankCell = {
  id: string;
  letter: string;
  revealed: boolean;
};

export type CrosswordPrizeTier = {
  completedWords: number;
  rewardAmount: number;
  label: string;
};

export type CrosswordSkin = {
  title: string;
  eyebrow: string;
  subtitle: string;
  boardLabel: string;
  lettersLabel: string;
  legendLabel: string;
  resultLabel: string;
};

export type CrosswordTicketData = {
  ticketId: CrosswordTicketTier;
  sessionId: string;
  gameType: "crossword";
  displayName: "Crossword";
  variantId: string;
  boardRows: number;
  boardCols: number;
  letterBank: CrosswordLetterBankCell[];
  boardCells: CrosswordBoardCell[];
  words: CrosswordWord[];
  prizeTiers: CrosswordPrizeTier[];
  skin: CrosswordSkin;
};

export type CrosswordGameState = {
  version: 1;
  revealedLetterBankCellIds: string[];
  revealedLetters: string[];
  matchedCellIds: string[];
  completedWordIds: string[];
  completedWordCount: number;
  isComplete: boolean;
  rewardGranted: boolean;
  finalPayout: number;
  finalPrizeTier: CrosswordPrizeTier | null;
  lastRevealedLetterCellId: string | null;
  lastMatchedCellIds: string[];
  newlyCompletedWordIds: string[];
};

export type CrosswordSession = {
  version: 1;
  ticket: CrosswordTicketData;
  state: CrosswordGameState;
};

export type ResolvedCrosswordBoardCell = CrosswordBoardCell & {
  matched: boolean;
  revealedByMatch: boolean;
  markable: boolean;
};

export type ResolvedCrosswordWord = CrosswordWord & {
  isComplete: boolean;
};

export type ResolvedCrosswordLetterBankCell = CrosswordLetterBankCell & {
  revealed: boolean;
};
