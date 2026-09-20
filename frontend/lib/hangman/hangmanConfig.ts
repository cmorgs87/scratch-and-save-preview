export const HANGMAN_THEME_ID = "hangman" as const;

export const HANGMAN_TITLE = "Hangman";
export const HANGMAN_EYEBROW = "Pencil & Paper";
export const HANGMAN_DESCRIPTION = "Scratch reveal cells before the notebook sketch is complete.";
export const HANGMAN_CTA = "Open notebook";
export const HANGMAN_ACCENT_CLASS = "from-amber-200 via-sky-300 to-indigo-400";
export const HANGMAN_NOTEBOOK_ART_SRC = "/assets/tickets/hangman/hangman-notebook-hero.png";
export const HANGMAN_LOGO_ALT = "Hangman pencil and paper word game";
export const HANGMAN_SELECTION_PROMPT = "Choose Hangman to start a fresh scratch-and-reveal puzzle.";
export const HANGMAN_SCRATCH_PROMPT = "Scratch the foil to reveal the word.";

export type HangmanOutcomeTier = "top_win" | "mid_win" | "low_win" | "loss";

export type HangmanOutcomePresentation = {
  title: string;
  message: string;
  tone: "emerald" | "sky" | "amber" | "graphite";
};

export type HangmanWord = {
  id: string;
  phrase: string;
  category: string;
};

export type HangmanRevealTile = {
  id: string;
  letter: string;
  correct: boolean;
};

export const HANGMAN_WORD_BANK: readonly HangmanWord[] = [
  { id: "anchor", phrase: "ANCHOR", category: "Nautical object" },
  { id: "compass", phrase: "COMPASS", category: "Navigation" },
  { id: "lifeboat", phrase: "LIFEBOAT", category: "At sea" },
  { id: "notebook", phrase: "NOTEBOOK", category: "Paper goods" },
  { id: "pencil", phrase: "PENCIL", category: "Desk drawer" },
  { id: "starlight", phrase: "STARLIGHT", category: "Night sky" },
  { id: "sea_glass", phrase: "SEA GLASS", category: "Shoreline find" },
  { id: "ocean_liner", phrase: "OCEAN LINER", category: "On the water" },
  { id: "telescope", phrase: "TELESCOPE", category: "Lookout gear" },
  { id: "harbor", phrase: "HARBOR", category: "Coastal place" },
  { id: "seashell", phrase: "SEASHELL", category: "Shoreline find" },
  { id: "driftwood", phrase: "DRIFTWOOD", category: "Shoreline find" },
  { id: "backpack", phrase: "BACKPACK", category: "School desk" },
  { id: "crayon", phrase: "CRAYON", category: "School desk" },
  { id: "ruler", phrase: "RULER", category: "School desk" },
  { id: "lantern", phrase: "LANTERN", category: "Classic object" },
  { id: "keyhole", phrase: "KEYHOLE", category: "Classic object" },
  { id: "suitcase", phrase: "SUITCASE", category: "Travel" },
  { id: "passport", phrase: "PASSPORT", category: "Travel" },
  { id: "postcard", phrase: "POSTCARD", category: "Travel" },
  { id: "dolphin", phrase: "DOLPHIN", category: "Animal" },
  { id: "penguin", phrase: "PENGUIN", category: "Animal" },
  { id: "seahorse", phrase: "SEAHORSE", category: "Animal" },
  { id: "popcorn", phrase: "POPCORN", category: "Food" },
  { id: "pancake", phrase: "PANCAKE", category: "Food" },
  { id: "lemonade", phrase: "LEMONADE", category: "Food" },
  { id: "starfish", phrase: "STARFISH", category: "Ocean" },
  { id: "coral", phrase: "CORAL", category: "Ocean" },
  { id: "sandcastle", phrase: "SANDCASTLE", category: "Ocean" },
  { id: "baseball", phrase: "BASEBALL", category: "Sports" },
  { id: "skateboard", phrase: "SKATEBOARD", category: "Sports" },
  { id: "badminton", phrase: "BADMINTON", category: "Sports" },
  { id: "rainbow", phrase: "RAINBOW", category: "Lucky word" },
  { id: "fortune", phrase: "FORTUNE", category: "Lucky word" },
  { id: "jackpot", phrase: "JACKPOT", category: "Lucky word" },
  { id: "umbrella", phrase: "UMBRELLA", category: "Everyday thing" },
  { id: "sandwich", phrase: "SANDWICH", category: "Everyday thing" },
  { id: "bicycle", phrase: "BICYCLE", category: "Everyday thing" },
  { id: "moonlight", phrase: "MOONLIGHT", category: "Night sky" },
  { id: "firefly", phrase: "FIREFLY", category: "Night sky" },
  { id: "treasure", phrase: "TREASURE", category: "Lucky word" },
  { id: "paper_plane", phrase: "PAPER PLANE", category: "School desk" },
  { id: "golden_key", phrase: "GOLDEN KEY", category: "Classic object" },
];

const WRONG_REVEALS_BY_TIER: Record<HangmanOutcomeTier, number> = {
  top_win: 0,
  mid_win: 2,
  low_win: 4,
  loss: 6,
};

const DECOY_LETTERS = "BDFGIJKLMPQSTUVWXYZ";

function wordSeed(wordId: string) {
  return [...wordId].reduce((total, character) => total + character.charCodeAt(0), 0);
}

export function selectHangmanWord(sessionId: number, forcedWordId?: string | null): HangmanWord {
  const forcedWord = forcedWordId ? HANGMAN_WORD_BANK.find((word) => word.id === forcedWordId) : undefined;
  if (forcedWord) return forcedWord;
  return HANGMAN_WORD_BANK[Math.abs(sessionId) % HANGMAN_WORD_BANK.length] ?? HANGMAN_WORD_BANK[0];
}

export function createHangmanRevealPlan(word: HangmanWord, outcomeTier: HangmanOutcomeTier): HangmanRevealTile[] {
  const correctLetters = [...new Set(word.phrase.replaceAll(" ", "").split(""))];
  const wrongRevealCount = WRONG_REVEALS_BY_TIER[outcomeTier];
  const visibleCorrectLetters = outcomeTier === "loss"
    ? correctLetters.slice(0, Math.max(1, Math.ceil(correctLetters.length / 3)))
    : correctLetters;
  const availableDecoys = [...DECOY_LETTERS].filter((letter) => !correctLetters.includes(letter));
  const seed = wordSeed(word.id);
  const wrongLetters = Array.from({ length: wrongRevealCount }, (_, index) => (
    availableDecoys[(seed + index * 5) % availableDecoys.length] ?? "X"
  ));
  const tiles: HangmanRevealTile[] = [];
  let correctIndex = 0;
  let wrongIndex = 0;

  while (correctIndex < visibleCorrectLetters.length || wrongIndex < wrongLetters.length) {
    const shouldRevealWrong = wrongIndex < wrongLetters.length
      && (correctIndex === visibleCorrectLetters.length || tiles.length % 3 === 1);
    if (shouldRevealWrong) {
      tiles.push({ id: `miss-${wrongIndex + 1}`, letter: wrongLetters[wrongIndex] ?? "X", correct: false });
      wrongIndex += 1;
    } else if (correctIndex < visibleCorrectLetters.length) {
      tiles.push({ id: `letter-${correctIndex + 1}`, letter: visibleCorrectLetters[correctIndex] ?? "", correct: true });
      correctIndex += 1;
    }
  }

  return tiles;
}

export const HANGMAN_OUTCOME_PRESENTATION: Record<HangmanOutcomeTier, HangmanOutcomePresentation> = {
  top_win: {
    title: "Lucky Break",
    message: "The doodle slipped away in time.",
    tone: "emerald",
  },
  mid_win: {
    title: "Close Call",
    message: "That was a near miss, but the doodle made it through.",
    tone: "sky",
  },
  low_win: {
    title: "Last Chance",
    message: "The final pencil mark found its way home.",
    tone: "amber",
  },
  loss: {
    title: "So Close",
    message: "The doodle got the better of this one.",
    tone: "graphite",
  },
};

export function resolveHangmanOutcomeTier(
  authoritativeWinAmount: number | null | undefined,
  prizeAmounts: readonly number[] = []
): HangmanOutcomeTier {
  const winAmount = Math.max(0, authoritativeWinAmount ?? 0);
  if (winAmount <= 0) return "loss";

  const highestPrize = Math.max(winAmount, ...prizeAmounts.filter((amount) => amount > 0));
  if (winAmount >= highestPrize) return "top_win";
  if (winAmount >= highestPrize * 0.6) return "mid_win";
  return "low_win";
}
