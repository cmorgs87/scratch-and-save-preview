import type { ReelRevealSymbol, ReelRevealSymbolId } from "./reelRevealTypes";

export const REEL_REVEAL_SYMBOLS: Record<ReelRevealSymbolId, ReelRevealSymbol> = {
  clover: {
    id: "clover",
    label: "Lucky Clover",
    src: "/shared/classic-symbols/color/01_clover.png",
    accent: "#72ff59",
    glow: "rgba(114,255,89,0.38)",
    frame: "linear-gradient(180deg,#f3ffdf 0%,#d1ff95 100%)",
  },
  seven: {
    id: "seven",
    label: "Lucky 7",
    src: "/shared/classic-symbols/color/02_777.png",
    accent: "#ff5a60",
    glow: "rgba(255,92,106,0.42)",
    frame: "linear-gradient(180deg,#fff7f2 0%,#ffe4d7 100%)",
  },
  bell: {
    id: "bell",
    label: "Bell",
    src: "/shared/classic-symbols/color/03_bell.png",
    accent: "#f2b72a",
    glow: "rgba(242,183,42,0.34)",
    frame: "linear-gradient(180deg,#fff8e5 0%,#ffe2a1 100%)",
  },
  cherries: {
    id: "cherries",
    label: "Cherries",
    src: "/shared/classic-symbols/color/05_cherries.png",
    accent: "#ff4766",
    glow: "rgba(255,71,102,0.34)",
    frame: "linear-gradient(180deg,#fff8fb 0%,#ffe0ea 100%)",
  },
  dice: {
    id: "dice",
    label: "Dice",
    src: "/shared/classic-symbols/color/09_dice.png",
    accent: "#67e7ff",
    glow: "rgba(103,231,255,0.35)",
    frame: "linear-gradient(180deg,#effcff 0%,#d2f1ff 100%)",
  },
  grapes: {
    id: "grapes",
    label: "Grapes",
    src: "/shared/classic-symbols/color/11_grapes.png",
    accent: "#d86eff",
    glow: "rgba(216,110,255,0.34)",
    frame: "linear-gradient(180deg,#f9eeff 0%,#efd2ff 100%)",
  },
};

export const REEL_REVEAL_SYMBOL_ORDER: ReelRevealSymbolId[] = ["clover", "seven", "bell", "cherries", "dice", "grapes"];
