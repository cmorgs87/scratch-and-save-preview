"use client";

import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { BrandLogo } from "@/app/_components/BrandLogo";
import { MobileGameFlowShell, type MobileGameStage } from "@/app/_components/MobileGameFlowShell";
import { MobileAppShell, MobilePageHeader } from "@/app/_components/MobileAppShell";
import { HomeNavIcon, MobileBottomNav, RewardsNavIcon, TicketsNavIcon } from "@/app/_components/MobileBottomNav";
import { ThemeToggle } from "@/app/_components/ThemeToggle";
import { CrosswordGameScreen } from "@/app/scratch/_components/crossword/CrosswordGameScreen";
import { ReelRevealGameScreen } from "@/app/scratch/_components/reel-reveal/ReelRevealGameScreen";
import {
  WebGameSplash,
  type WebGameSplashConfig,
  type WebGameSplashEnabledConfig,
} from "@/app/scratch/_components/WebGameSplash";
import { TheBigScoreGameScreen } from "@/app/scratch/_components/the-big-score/TheBigScoreGameScreen";
import { TripleCrownDerbyGameScreen } from "@/app/scratch/_components/triple-crown-derby/TripleCrownDerbyGameScreen";
import {
  BATTLESCRATCH_CONFIG_BY_TICKET,
  BATTLESCRATCH_LOGO_SRC,
  applyScratchToCell,
  buildCellMap,
  cellKey,
  completeReveal,
  createInitialRevealState,
  deserializeSession,
  generateBattlescratchTicket,
  generateTicketForExactMarkers,
  getStorageKey,
  resolveTicketOutcome as resolveBattlescratchTicketOutcome,
  serializeSession,
  setMarkerLocked,
  upsertMarker,
  type BattlescratchTicket,
  type RevealState as BattlescratchRevealState,
  type TargetMarker as BattlescratchTargetMarker,
  type TicketOutcome as BattlescratchOutcome,
} from "@/lib/battlescratch";
import { createCrosswordTicket } from "@/lib/crossword/crosswordConfig";
import {
  applyCrosswordRewardGrant,
  checkCrosswordTicket,
  createInitialCrosswordGameState,
  markCrosswordBoardCell,
  revealAllCrosswordLetterCells,
  revealCrosswordLetterCell,
} from "@/lib/crossword/crosswordEngine";
import { deserializeCrosswordSession, getCrosswordStorageKey, serializeCrosswordSession } from "@/lib/crossword/crosswordStorage";
import type { CrosswordGameState, CrosswordTicketData, CrosswordTicketTier } from "@/lib/crossword/crosswordTypes";
import { createReelRevealTicket } from "@/lib/reel-reveal/reelRevealConfig";
import type { ReelRevealTicketData } from "@/lib/reel-reveal/reelRevealTypes";
import { THE_BIG_SCORE_LOGO_SRC } from "@/lib/the-big-score/theBigScoreConfig";
import { createTheBigScoreTicket } from "@/lib/the-big-score/theBigScoreLogic";
import type { TheBigScoreTicketData } from "@/lib/the-big-score/theBigScoreTypes";
import {
  createTripleCrownDerbyTicket,
} from "@/lib/triple-crown-derby/tripleCrownDerbyConfig";
import type { TripleCrownDerbyTicketData } from "@/lib/triple-crown-derby/tripleCrownDerbyTypes";

type TicketId = "bronze" | "silver" | "gold";
type ThemeId =
  | "close_encounters"
  | "flamingo_frenzy"
  | "steam_barons_bounty"
  | "steam_barons_bounty_west"
  | "battlescratch"
  | "crossword"
  | "reel_reveal"
  | "the_big_score"
  | "triple_crown_derby";
type TicketOutcome = "win" | "nearMiss" | "lose";
type SymbolId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
type ScratchView = "tickets" | "play";

type MeResponse =
  | { ok: true; user: { id: string; email: string; scratchCoin: number; lastDailyClaimAt: string | null } }
  | { ok: false; error?: string };

type TicketCatalogItem = {
  id: TicketId;
  title: string;
  costCoin: number;
  prizes: number[];
};

type TicketCatalogResponse = { ok: true; tickets: TicketCatalogItem[] };

type PlayScratchResponse = {
  ok: true;
  ticketId: TicketId;
  cost: number;
  winAmount: number;
  net: number;
  newBalance: number;
};

type StartCrosswordResponse = {
  ok: true;
  sessionId: string;
  ticketId: CrosswordTicketTier;
  cost: number;
  winAmount: number;
  net: number;
  newBalance: number;
};

type ClaimCrosswordResponse = {
  ok: true;
  sessionId: string;
  rewardAmount: number;
  alreadyClaimed: boolean;
  newBalance: number;
  net: number;
};

type TicketVisual = {
  ids: SymbolId[];
  outcome: TicketOutcome;
  winIndices: number[];
};

type CellRect = { x: number; y: number; size: number };
type ScratchZoneLayout = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  cornerRadiusPct: number;
};
type BoardLayout = {
  zone: ScratchZoneLayout;
  innerGrid: {
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
  };
  symbolScale: number;
  cockpit?: {
    shellLeftOffsetPct: number;
    shellTopOffsetPct: number;
    shellWidthExpandPct: number;
    shellHeightExpandPct: number;
    hoodLeftOffsetPct: number;
    hoodTopOffsetPct: number;
    hoodWidthExpandPct: number;
    hoodHeightPct: number;
  };
};
type ThemeOption = {
  id: ThemeId;
  title: string;
  eyebrow: string;
  description: string;
  cta: string;
  accentClass: string;
  logoSrc: string;
  logoAlt: string;
  hubArtMode: "cover" | "contain";
  hubArtPosition: string;
  hubArtScale: number;
  mobileTileScale?: number;
};
type SpaceSymbol = {
  label: string;
  src: string;
  glow: string;
};

const GRID_SIZE = 16 as const;
const TICKET_ORDER: TicketId[] = ["gold"];
const CLASSIC_SYMBOLS: SymbolId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const CLOSE_ENCOUNTERS_SYMBOL_POOL: SymbolId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
type ThemeWebSplashSkin = {
  shell: string;
  overlay: string;
  orbA: string;
  orbB: string;
  floorGlow: string;
  logoWrap: string;
  logoClass: string;
  playLabel: string;
};

const FLAMINGO_FRENZY_SYMBOL_POOL: SymbolId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEAM_BARONS_BOUNTY_SYMBOL_POOL: SymbolId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEAM_BARONS_BOUNTY_WEST_SYMBOL_POOL: SymbolId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const BATTLESCRATCH_SINK_VIDEO_ORDER = ["patrol_boat", "submarine", "destroyer", "battleship", "carrier"] as const;
const BATTLESCRATCH_SINK_VIDEO_BY_TYPE: Record<(typeof BATTLESCRATCH_SINK_VIDEO_ORDER)[number], string> = {
  patrol_boat: "/battlescratch/patrol_boat.mp4",
  submarine: "/battlescratch/submarine.mp4",
  destroyer: "/battlescratch/destroyer.mp4",
  battleship: "/battlescratch/battleship.mp4",
  carrier: "/battlescratch/carrier.mp4",
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "close_encounters",
    title: "Close Encounters",
    eyebrow: "Cosmic Event",
    description: "Alien symbols, neon starfields, and synthy space audio built for a more game-like feel.",
    cta: "Launch mission",
    accentClass: "from-fuchsia-500 via-violet-400 to-cyan-300",
    logoSrc: "/close-encounters/close_encounters_logo.png",
    logoAlt: "Close Encounters",
    hubArtMode: "contain",
    hubArtPosition: "center top",
    hubArtScale: 1.06,
    mobileTileScale: 1.02,
  },
  {
    id: "flamingo_frenzy",
    title: "Flamingo Frenzy",
    eyebrow: "Tropical Splash",
    description: "Sunset boardwalk color, beach-party symbols, and a glossy island reveal built as its own ticket world.",
    cta: "Catch the wave",
    accentClass: "from-pink-500 via-orange-300 to-cyan-300",
    logoSrc: "/flamingo-frenzy/flamingo_frenzy_logo_transparent_v4.png?v=20260513-1",
    logoAlt: "Flamingo Frenzy",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.04,
    mobileTileScale: 1.02,
  },
  {
    id: "steam_barons_bounty",
    title: "Pirates Buried Treasure",
    eyebrow: "Brass Tide",
    description: "Brass-rimmed pirate relics, lantern-lit waters, and a clockwork treasure hunt built as a standalone scratch world.",
    cta: "Chart the haul",
    accentClass: "from-amber-500 via-yellow-300 to-sky-300",
    logoSrc: "/steam-barons-bounty/steam_barons_bounty_logo.png",
    logoAlt: "Pirates Buried Treasure",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.08,
    mobileTileScale: 0.92,
  },
  {
    id: "steam_barons_bounty_west",
    title: "Steam Baron's Bounty",
    eyebrow: "Frontier Steam",
    description: "Wild-west riverboat brass, boiler pressure, and frontier relics built as a separate scratch world.",
    cta: "Board the barge",
    accentClass: "from-amber-400 via-yellow-300 to-stone-300",
    logoSrc: "/steam-barons-bounty-west/steam_barons_bounty_logo.png",
    logoAlt: "Steam Baron's Bounty",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.02,
    mobileTileScale: 0.92,
  },
  {
    id: "battlescratch",
    title: "Battlescratch",
    eyebrow: "Naval Strike",
    description: "Plot a premium strike package, lock your targets, scratch through the ocean foil, and sink a hidden fleet for the payout.",
    cta: "Launch strike",
    accentClass: "from-sky-400 via-cyan-300 to-orange-300",
    logoSrc: BATTLESCRATCH_LOGO_SRC,
    logoAlt: "Battlescratch",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.04,
    mobileTileScale: 0.98,
  },
  {
    id: "crossword",
    title: "Crossword",
    eyebrow: "Premium Letters",
    description: "Tap to reveal 18 letters, mark the matching crossword cells yourself, and finish completed words for a premium lottery-style payout.",
    cta: "Deal puzzle",
    accentClass: "from-amber-300 via-cyan-200 to-emerald-200",
    logoSrc: "/crossword/crossword_logo.png",
    logoAlt: "Crossword",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.02,
    mobileTileScale: 0.84,
  },
  {
    id: "reel_reveal",
    title: "Reel Reveal",
    eyebrow: "Premium Slots",
    description: "Scratch through a metallic premium foil, uncover live slot reels, and spin them for a casino-style premium payout.",
    cta: "Spin to win",
    accentClass: "from-fuchsia-500 via-violet-400 to-amber-300",
    logoSrc: "/reel-reveal/reel_reveal_logo.png",
    logoAlt: "Reel Reveal",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.04,
    mobileTileScale: 0.98,
  },
  {
    id: "the_big_score",
    title: "The Big Score",
    eyebrow: "Vegas Heist",
    description: "Choose a vault entrance, lock a getaway route, call a 3-number code, and scratch open the winning combination.",
    cta: "Plan the job",
    accentClass: "from-[#ffe09a] via-[#ffb347] to-[#ff6a3d]",
    logoSrc: THE_BIG_SCORE_LOGO_SRC,
    logoAlt: "The Big Score",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.02,
    mobileTileScale: 0.88,
  },
  {
    id: "triple_crown_derby",
    title: "Triple Crown Derby",
    eyebrow: "Premier Stakes",
    description: "Pick your Win, Place, and Show horses, then scratch through the premium race foil to reveal the final finish.",
    cta: "Pick the board",
    accentClass: "from-amber-300 via-violet-400 to-fuchsia-500",
    logoSrc: "/triple-crown-derby/logo.png",
    logoAlt: "Triple Crown Derby",
    hubArtMode: "contain",
    hubArtPosition: "center center",
    hubArtScale: 1.06,
    mobileTileScale: 0.9,
  },
];

function getThemeLaunchSkin(themeId: ThemeId) {
  switch (themeId) {
    case "flamingo_frenzy":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(255,180,118,0.26),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,91,164,0.24),transparent_34%),linear-gradient(180deg,#49204a_0%,#20112b_48%,#0d1529_100%)]",
      };
    case "close_encounters":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(77,228,255,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(191,94,255,0.22),transparent_34%),linear-gradient(180deg,#12243f_0%,#0a1630_45%,#060d1c_100%)]",
      };
    case "steam_barons_bounty":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(255,207,118,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(100,197,255,0.14),transparent_34%),linear-gradient(180deg,#3a2418_0%,#171010_46%,#0c1220_100%)]",
      };
    case "steam_barons_bounty_west":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(255,205,122,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(167,123,78,0.18),transparent_34%),linear-gradient(180deg,#362416_0%,#171010_44%,#0d1423_100%)]",
      };
    case "battlescratch":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(112,198,255,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,150,82,0.18),transparent_34%),linear-gradient(180deg,#132d48_0%,#0a1b31_46%,#06101e_100%)]",
      };
    case "crossword":
      return {
        shell:
          "bg-[linear-gradient(180deg,#102238_0%,#0d1d31_38%,#091522_100%)]",
      };
    case "reel_reveal":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(255,86,243,0.18),transparent_35%),linear-gradient(180deg,#250f48_0%,#120724_42%,#08121f_100%)]",
      };
    case "the_big_score":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(255,210,120,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,128,64,0.18),transparent_36%),linear-gradient(180deg,#23140c_0%,#0f1019_54%,#08121f_100%)]",
      };
    case "triple_crown_derby":
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(255,206,94,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(165,98,255,0.18),transparent_36%),linear-gradient(180deg,#2f153e_0%,#171228_48%,#0a1320_100%)]",
      };
    default:
      return {
        shell:
          "bg-[radial-gradient(circle_at_top,rgba(103,224,255,0.16),transparent_30%),linear-gradient(180deg,#11233f_0%,#0a162d_44%,#07111e_100%)]",
      };
  }
}

function getThemeWebSplashSkin(themeId: ThemeId): ThemeWebSplashSkin {
  switch (themeId) {
    case "close_encounters":
      return {
        shell:
          "bg-[radial-gradient(circle_at_18%_22%,rgba(255,120,223,0.28),transparent_0_18%),radial-gradient(circle_at_82%_18%,rgba(88,154,255,0.26),transparent_0_20%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.08),transparent_0_34%),linear-gradient(180deg,#090f2b_0%,#111b4a_36%,#15104a_68%,#0a132e_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_12%_34%,rgba(160,108,255,0.22),transparent_0_18%),radial-gradient(circle_at_74%_32%,rgba(57,199,255,0.18),transparent_0_22%),radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.12)_0_1px,transparent_1.2px),radial-gradient(circle_at_68%_22%,rgba(255,255,255,0.1)_0_1px,transparent_1.2px),radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.08)_0_1px,transparent_1.2px)]",
        orbA: "bg-fuchsia-500/34",
        orbB: "bg-cyan-400/28",
        floorGlow: "bg-[radial-gradient(circle,rgba(95,255,190,0.42),rgba(95,255,190,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[860px] lg:max-w-[980px]",
        logoClass: "drop-shadow-[0_28px_80px_rgba(103,245,255,0.28)]",
        playLabel: "Tap to Start",
      };
    case "flamingo_frenzy":
      return {
        shell:
          "bg-[radial-gradient(circle_at_20%_18%,rgba(255,108,173,0.28),transparent_0_18%),radial-gradient(circle_at_82%_16%,rgba(255,198,110,0.22),transparent_0_18%),linear-gradient(180deg,#542144_0%,#2b1640_42%,#101834_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_16%_56%,rgba(255,169,112,0.22),transparent_0_16%),radial-gradient(circle_at_84%_56%,rgba(96,221,255,0.18),transparent_0_18%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_36%)]",
        orbA: "bg-pink-400/32",
        orbB: "bg-amber-300/24",
        floorGlow: "bg-[radial-gradient(circle,rgba(112,240,255,0.28),rgba(112,240,255,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[860px] lg:max-w-[940px]",
        logoClass: "drop-shadow-[0_24px_72px_rgba(255,112,167,0.24)]",
        playLabel: "Play Now",
      };
    case "steam_barons_bounty":
      return {
        shell:
          "bg-[radial-gradient(circle_at_20%_22%,rgba(255,209,120,0.18),transparent_0_18%),radial-gradient(circle_at_82%_18%,rgba(65,145,255,0.14),transparent_0_18%),linear-gradient(180deg,#3d2816_0%,#1f1618_48%,#0c1830_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_18%_68%,rgba(255,229,165,0.18),transparent_0_18%),radial-gradient(circle_at_78%_56%,rgba(97,205,255,0.14),transparent_0_22%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_34%)]",
        orbA: "bg-amber-300/28",
        orbB: "bg-sky-400/16",
        floorGlow: "bg-[radial-gradient(circle,rgba(255,198,112,0.28),rgba(255,198,112,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[900px] lg:max-w-[1020px]",
        logoClass: "drop-shadow-[0_26px_72px_rgba(255,179,98,0.22)]",
        playLabel: "Play Now",
      };
    case "steam_barons_bounty_west":
      return {
        shell:
          "bg-[radial-gradient(circle_at_18%_20%,rgba(255,207,128,0.2),transparent_0_18%),radial-gradient(circle_at_82%_16%,rgba(189,133,86,0.16),transparent_0_18%),linear-gradient(180deg,#3b281a_0%,#1f1611_46%,#11192d_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_22%_62%,rgba(255,218,152,0.16),transparent_0_18%),radial-gradient(circle_at_74%_50%,rgba(199,146,104,0.12),transparent_0_18%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_34%)]",
        orbA: "bg-amber-300/24",
        orbB: "bg-orange-300/18",
        floorGlow: "bg-[radial-gradient(circle,rgba(255,214,136,0.24),rgba(255,214,136,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[860px] lg:max-w-[980px]",
        logoClass: "drop-shadow-[0_24px_68px_rgba(255,201,127,0.22)]",
        playLabel: "Play Now",
      };
    case "battlescratch":
      return {
        shell:
          "bg-[radial-gradient(circle_at_18%_18%,rgba(96,187,255,0.18),transparent_0_18%),radial-gradient(circle_at_82%_16%,rgba(255,148,91,0.16),transparent_0_18%),linear-gradient(180deg,#123055_0%,#0d1d39_42%,#081120_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_20%_62%,rgba(110,199,255,0.16),transparent_0_18%),radial-gradient(circle_at_80%_54%,rgba(255,181,96,0.12),transparent_0_18%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_36%)]",
        orbA: "bg-sky-400/26",
        orbB: "bg-orange-300/18",
        floorGlow: "bg-[radial-gradient(circle,rgba(112,198,255,0.24),rgba(112,198,255,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[860px] lg:max-w-[980px]",
        logoClass: "drop-shadow-[0_24px_68px_rgba(112,198,255,0.24)]",
        playLabel: "Play Now",
      };
    case "crossword":
      return {
        shell:
          "bg-[radial-gradient(circle_at_18%_16%,rgba(255,221,134,0.14),transparent_0_18%),radial-gradient(circle_at_82%_16%,rgba(115,218,255,0.14),transparent_0_18%),linear-gradient(180deg,#11243d_0%,#0b1730_44%,#08111f_100%)]",
        overlay:
          "bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:54px_54px]",
        orbA: "bg-amber-300/18",
        orbB: "bg-cyan-300/16",
        floorGlow: "bg-[radial-gradient(circle,rgba(255,214,117,0.2),rgba(255,214,117,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[760px] lg:max-w-[860px]",
        logoClass: "drop-shadow-[0_22px_64px_rgba(255,214,117,0.16)]",
        playLabel: "Play Now",
      };
    case "reel_reveal":
      return {
        shell:
          "bg-[radial-gradient(circle_at_22%_18%,rgba(255,88,233,0.2),transparent_0_18%),radial-gradient(circle_at_82%_18%,rgba(255,204,94,0.18),transparent_0_18%),linear-gradient(180deg,#2a0f4d_0%,#160a2f_44%,#0a1222_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_16%_68%,rgba(255,100,238,0.16),transparent_0_16%),radial-gradient(circle_at_82%_56%,rgba(255,200,82,0.12),transparent_0_18%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_36%)]",
        orbA: "bg-fuchsia-400/26",
        orbB: "bg-amber-300/20",
        floorGlow: "bg-[radial-gradient(circle,rgba(203,94,255,0.24),rgba(203,94,255,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[900px] lg:max-w-[1020px]",
        logoClass: "drop-shadow-[0_24px_76px_rgba(203,94,255,0.24)]",
        playLabel: "Spin to Start",
      };
    case "the_big_score":
      return {
        shell:
          "bg-[radial-gradient(circle_at_18%_18%,rgba(255,211,122,0.24),transparent_0_18%),radial-gradient(circle_at_82%_18%,rgba(255,123,58,0.18),transparent_0_18%),linear-gradient(180deg,#25150d_0%,#15131f_46%,#081120_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_18%_64%,rgba(255,214,144,0.18),transparent_0_18%),radial-gradient(circle_at_80%_54%,rgba(255,126,74,0.12),transparent_0_18%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_36%)]",
        orbA: "bg-amber-300/28",
        orbB: "bg-orange-400/22",
        floorGlow: "bg-[radial-gradient(circle,rgba(255,195,110,0.26),rgba(255,195,110,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[860px] lg:max-w-[980px]",
        logoClass: "drop-shadow-[0_24px_72px_rgba(255,180,112,0.24)]",
        playLabel: "Play Now",
      };
    case "triple_crown_derby":
      return {
        shell:
          "bg-[radial-gradient(circle_at_18%_18%,rgba(255,211,122,0.18),transparent_0_18%),radial-gradient(circle_at_82%_18%,rgba(165,103,255,0.2),transparent_0_18%),linear-gradient(180deg,#2e1541_0%,#1b1531_48%,#0a1220_100%)]",
        overlay:
          "bg-[radial-gradient(circle_at_18%_62%,rgba(255,212,122,0.16),transparent_0_18%),radial-gradient(circle_at_78%_54%,rgba(158,102,255,0.14),transparent_0_18%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_34%)]",
        orbA: "bg-amber-300/22",
        orbB: "bg-violet-400/22",
        floorGlow: "bg-[radial-gradient(circle,rgba(181,130,255,0.22),rgba(181,130,255,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[860px] lg:max-w-[980px]",
        logoClass: "drop-shadow-[0_24px_72px_rgba(181,130,255,0.24)]",
        playLabel: "Start Race",
      };
    default:
      return {
        shell:
          "bg-[radial-gradient(circle_at_18%_18%,rgba(103,224,255,0.16),transparent_0_18%),linear-gradient(180deg,#11233f_0%,#0a162d_44%,#07111e_100%)]",
        overlay:
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_34%)]",
        orbA: "bg-cyan-300/22",
        orbB: "bg-cyan-400/18",
        floorGlow: "bg-[radial-gradient(circle,rgba(103,224,255,0.22),rgba(103,224,255,0.08)_45%,transparent_70%)]",
        logoWrap: "max-w-[780px] lg:max-w-[900px]",
        logoClass: "drop-shadow-[0_24px_68px_rgba(103,224,255,0.22)]",
        playLabel: "Play Now",
      };
  }
}

function buildWebGameSplashConfig(
  themeId: ThemeId,
  overrides: Partial<Omit<WebGameSplashEnabledConfig, "enabled">>
): WebGameSplashEnabledConfig {
  const skin = getThemeWebSplashSkin(themeId);

  return {
    enabled: true,
    heroLabel: "Web Premiere",
    playLabel: skin.playLabel,
    featureChips: [],
    detailItems: [],
    showPrimaryLogo: true,
    shellClassName: skin.shell,
    overlayClassName: skin.overlay,
    orbAClassName: skin.orbA,
    orbBClassName: skin.orbB,
    floorGlowClassName: skin.floorGlow,
    logoWrapClassName: skin.logoWrap,
    logoClassName: skin.logoClass,
    showSoundToggle: true,
    ...overrides,
  };
}

const WEB_GAME_SPLASH_CONFIG_BY_THEME = {
  close_encounters: buildWebGameSplashConfig("close_encounters", {
    heroLabel: "Signal Locked",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Alien symbols", "Neon motel glow", "Synth stings", "UFO contact"],
    detailItems: [
      { label: "Entry", value: "Classic scratch board" },
      { label: "Mood", value: "Late-night cosmic contact" },
      { label: "Setting", value: "Stardust Motel roadside beacon" },
    ],
    stageBackdrop: {
      src: "/close-encounters/close_encounters_splash_screen.png",
      alt: "Close Encounters splash screen art with UFO beam above the Stardust Motel",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    stageCallout: {
      eyebrow: "Roadside Signal",
      title: "Desktop Launch",
      note: "Shared Splash",
    },
    logoStageClassName:
      "bg-black/20 after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(4,8,24,0.08),rgba(4,8,24,0.34)_40%,rgba(4,8,24,0.72)_100%)] after:content-['']",
    infoPanelClassName:
      "bg-[linear-gradient(180deg,rgba(15,11,36,0.86),rgba(5,10,23,0.96))] border-fuchsia-300/12 shadow-[0_24px_90px_rgba(0,0,0,0.34)]",
    showPrimaryLogo: false,
    showSoundToggle: false,
    minHeightClassName: "min-h-[760px] lg:min-h-[820px]",
  }),
  flamingo_frenzy: buildWebGameSplashConfig("flamingo_frenzy", {
    heroLabel: "Boardwalk Lights",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Sunset foil", "Party symbols", "Glossy island reveal"],
    detailItems: [
      { label: "Entry", value: "Classic scratch board" },
      { label: "Mood", value: "Warm tropical afterglow" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/flamingo-frenzy/flamingo_frenzy_splash_screen.png",
      alt: "Flamingo Frenzy splash screen art with tropical sunset and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[radial-gradient(circle_at_22%_20%,rgba(255,166,124,0.18),transparent_0_24%),linear-gradient(180deg,rgba(45,14,44,0.22),rgba(16,22,52,0.56))]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
  steam_barons_bounty: buildWebGameSplashConfig("steam_barons_bounty", {
    heroLabel: "Treasure Charted",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Pirate relics", "Lantern haze", "Clockwork tide"],
    detailItems: [
      { label: "Entry", value: "Classic scratch board" },
      { label: "Mood", value: "Brass-rimmed treasure hunt" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/steam-barons-bounty/pirates_buried_treasure_splash_screen.png",
      alt: "Pirates Buried Treasure splash screen art with pirate ship and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[radial-gradient(circle_at_18%_20%,rgba(255,220,145,0.16),transparent_0_22%),linear-gradient(180deg,rgba(39,24,12,0.24),rgba(12,24,48,0.58))]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
  steam_barons_bounty_west: buildWebGameSplashConfig("steam_barons_bounty_west", {
    heroLabel: "Frontier Steam",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Riverboat brass", "Boiler pressure", "Western relics"],
    detailItems: [
      { label: "Entry", value: "Classic scratch board" },
      { label: "Mood", value: "Dusty river frontier" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/steam-barons-bounty/steam_barons_bounty_splash_screen.png",
      alt: "The Steam Baron's Bounty splash screen art with steamboat and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(255,221,158,0.14),transparent_0_22%),linear-gradient(180deg,rgba(50,31,18,0.22),rgba(17,25,45,0.58))]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
  battlescratch: buildWebGameSplashConfig("battlescratch", {
    heroLabel: "Strike Briefing",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Target planning", "Ship hunt", "Ocean foil reveal"],
    detailItems: [
      { label: "Entry", value: "Premium battle layout" },
      { label: "Mood", value: "Command deck pressure" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/battlescratch/battlescratch_splash_screen.png",
      alt: "Battlescratch splash screen art with battleship, submarine, and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(112,198,255,0.16),transparent_0_22%),linear-gradient(180deg,rgba(10,30,58,0.28),rgba(7,18,34,0.62))]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
  crossword: buildWebGameSplashConfig("crossword", {
    heroLabel: "Letter Bank Ready",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["18 reveals", "Word hunt", "Premium puzzle card"],
    detailItems: [
      { label: "Entry", value: "Crossword ticket flow" },
      { label: "Mood", value: "Premium letter challenge" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/crossword/crossword_splash_screen.png",
      alt: "Crossword Puzzle splash screen art with crossword board, city skyline, and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(180deg,rgba(11,23,48,0.32),rgba(8,17,31,0.62))] bg-[size:42px_42px,42px_42px,100%_100%]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
  reel_reveal: buildWebGameSplashConfig("reel_reveal", {
    heroLabel: "Neon Reels",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Slot foil", "Live reels", "Casino finish"],
    detailItems: [
      { label: "Entry", value: "Premium reel ticket" },
      { label: "Mood", value: "Midnight arcade glow" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/reel-reveal/reel_reveal_splash_screen.png",
      alt: "Reel Reveal splash screen art with slot machine, casino lights, and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[radial-gradient(circle_at_20%_18%,rgba(255,106,238,0.16),transparent_0_20%),linear-gradient(180deg,rgba(36,12,70,0.28),rgba(10,18,34,0.62))]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
  the_big_score: buildWebGameSplashConfig("the_big_score", {
    heroLabel: "Vault Briefing",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Choose the entry", "Lock the route", "Call the code"],
    detailItems: [
      { label: "Entry", value: "Premium heist ticket" },
      { label: "Mood", value: "Casino back-room pressure" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/assets/tickets/the-big-score/the_big_score_splash_screen.png",
      alt: "The Big Score splash screen art with casino skyline, vault crew, and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(255,208,120,0.16),transparent_0_20%),linear-gradient(180deg,rgba(37,21,13,0.3),rgba(12,17,32,0.64))]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
  triple_crown_derby: buildWebGameSplashConfig("triple_crown_derby", {
    heroLabel: "Post Parade",
    interactionMode: "surface",
    showPointsPill: false,
    showSplashCopy: false,
    featureChips: ["Win Place Show", "Race foil", "Prestige payout"],
    detailItems: [
      { label: "Entry", value: "Premium race ticket" },
      { label: "Mood", value: "Evening stakes energy" },
      { label: "Desktop", value: "Shared web splash system" },
    ],
    stageBackdrop: {
      src: "/triple-crown-derby/triple_crown_derby_splash_screen.png",
      alt: "Triple Crown Derby splash screen art with horses, racetrack, and tap to start prompt",
      width: 1680,
      height: 945,
      className: "absolute inset-0",
      imageClassName: "object-cover object-center",
    },
    logoStageClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(255,210,122,0.15),transparent_0_20%),linear-gradient(180deg,rgba(46,21,65,0.28),rgba(10,18,32,0.62))]",
    showPrimaryLogo: false,
    showSoundToggle: false,
  }),
} satisfies Record<ThemeId, WebGameSplashConfig>;

const SYMBOL_KEYS: Record<SymbolId, string> = {
  1: "clover",
  2: "777",
  3: "bell",
  4: "blackjack",
  5: "cherries",
  6: "coins",
  7: "crown",
  8: "diamond",
  9: "dice",
  10: "fireworks",
  11: "grapes",
  12: "horseshoe",
  13: "martini",
  14: "pot_of_gold",
  15: "roulette",
  16: "scratch_bucks",
};

const ASSETS = {
  symbolBW: (id: SymbolId) =>
    `/shared/classic-symbols/bw/${String(id).padStart(2, "0")}_${SYMBOL_KEYS[id]}.png`,
  symbolColor: (id: SymbolId) =>
    `/shared/classic-symbols/color/${String(id).padStart(2, "0")}_${SYMBOL_KEYS[id]}.png`,
};
const CLOSE_ENCOUNTERS_LOGO_SRC = "/close-encounters/close_encounters_logo.png";
const CLOSE_ENCOUNTERS_SCRATCH_FOIL_SRC = "/close-encounters/close_encounters_scratch_foil.png";
const CLOSE_ENCOUNTERS_WIN_UFO_SRC = "/close-encounters/win_ufo_cutout_v3.png?v=20260408-2019";
const FLAMINGO_FRENZY_LOGO_SRC = "/flamingo-frenzy/flamingo_frenzy_logo_transparent_v3.png?v=20260410-1";
const FLAMINGO_FRENZY_SCRATCH_FOIL_SRC = "/flamingo-frenzy/flamingo_frenzy_scratch_foil.png";
const FLAMINGO_FRENZY_WIN_FLAMINGO_SRC = "/flamingo-frenzy/ff_win_flamingo.png";
const STEAM_BARONS_BOUNTY_LOGO_SRC = "/steam-barons-bounty/steam_barons_bounty_logo.png";
const PIRATES_BURIED_TREASURE_SCRATCH_FOIL_SRC = "/steam-barons-bounty/pirates_buried_treasure_scratch_foil.png";
const STEAM_BARONS_BOUNTY_WIN_VIDEO_SRC = "/steam-barons-bounty/steamboat.mp4";
const STEAM_BARONS_BOUNTY_WIN_SHIP_SRC = "/steam-barons-bounty/sbb_win_ship_v2.png";
const STEAM_BARONS_BOUNTY_WEST_LOGO_SRC = "/steam-barons-bounty-west/steam_barons_bounty_logo.png";
const STEAM_BARONS_BOUNTY_WEST_SCRATCH_FOIL_SRC =
  "/steam-barons-bounty-west/steam_barons_bounty_scratch_foil.png";
const BATTLESCRATCH_SHIP_ART = {
  patrol_boat: { src: "/battlescratch/ships/patrol-boat.png", nativeOrientation: "vertical" as const },
  submarine: { src: "/battlescratch/ships/submarine.png", nativeOrientation: "horizontal" as const },
  destroyer: { src: "/battlescratch/ships/destroyer.png", nativeOrientation: "vertical" as const },
  battleship: { src: "/battlescratch/ships/battleship.png", nativeOrientation: "horizontal" as const },
  carrier: { src: "/battlescratch/ships/carrier.png", nativeOrientation: "horizontal" as const },
} as const;
const TRIPLE_CROWN_DERBY_PAYOUT_MULTIPLIER = 3;
const SCRATCH_FOIL_ALPHA_THRESHOLD = 8;

type ScratchFoilBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getDisplayedTicketPrizes(themeId: ThemeId, prizes: readonly number[]) {
  if (themeId !== "triple_crown_derby") return [...prizes];
  return prizes.map((amount) => amount * TRIPLE_CROWN_DERBY_PAYOUT_MULTIPLIER);
}

const AUTO_FINISH_THRESHOLD = 0.42;
const BOARD_LAYOUTS: Record<ThemeId, BoardLayout> = {
  close_encounters: {
    zone: {
      leftPct: 0.022,
      topPct: 0.508,
      widthPct: 0.95,
      heightPct: 0.49,
      cornerRadiusPct: 0.06,
    },
    innerGrid: {
      xPct: 0.018,
      yPct: 0.03,
      widthPct: 0.964,
      heightPct: 0.94,
    },
    symbolScale: 1.08,
    cockpit: {
      shellLeftOffsetPct: -0.008,
      shellTopOffsetPct: -0.016,
      shellWidthExpandPct: 0.016,
      shellHeightExpandPct: 0.018,
      hoodLeftOffsetPct: -0.006,
      hoodTopOffsetPct: -0.046,
      hoodWidthExpandPct: 0.012,
      hoodHeightPct: 0.05,
    },
  },
  flamingo_frenzy: {
    zone: {
      leftPct: 0.045,
      topPct: 0.495,
      widthPct: 0.91,
      heightPct: 0.455,
      cornerRadiusPct: 0.06,
    },
    innerGrid: {
      xPct: 0.04,
      yPct: 0.045,
      widthPct: 0.92,
      heightPct: 0.9,
    },
    symbolScale: 1.05,
  },
  steam_barons_bounty: {
    zone: {
      leftPct: 0.046,
      topPct: 0.504,
      widthPct: 0.908,
      heightPct: 0.446,
      cornerRadiusPct: 0.058,
    },
    innerGrid: {
      xPct: 0.038,
      yPct: 0.05,
      widthPct: 0.924,
      heightPct: 0.89,
    },
    symbolScale: 1.02,
  },
  steam_barons_bounty_west: {
    zone: {
      leftPct: 0.045,
      topPct: 0.512,
      widthPct: 0.91,
      heightPct: 0.44,
      cornerRadiusPct: 0.056,
    },
    innerGrid: {
      xPct: 0.045,
      yPct: 0.055,
      widthPct: 0.91,
      heightPct: 0.88,
    },
    symbolScale: 1.02,
  },
  battlescratch: {
    zone: {
      leftPct: 0.07,
      topPct: 0.36,
      widthPct: 0.86,
      heightPct: 0.56,
      cornerRadiusPct: 0.06,
    },
    innerGrid: {
      xPct: 0.024,
      yPct: 0.03,
      widthPct: 0.952,
      heightPct: 0.948,
    },
    symbolScale: 1,
  },
  crossword: {
    zone: {
      leftPct: 0.06,
      topPct: 0.14,
      widthPct: 0.88,
      heightPct: 0.74,
      cornerRadiusPct: 0.06,
    },
    innerGrid: {
      xPct: 0.04,
      yPct: 0.04,
      widthPct: 0.92,
      heightPct: 0.92,
    },
    symbolScale: 1,
  },
  reel_reveal: {
    zone: {
      leftPct: 0.06,
      topPct: 0.14,
      widthPct: 0.88,
      heightPct: 0.74,
      cornerRadiusPct: 0.06,
    },
    innerGrid: {
      xPct: 0.04,
      yPct: 0.04,
      widthPct: 0.92,
      heightPct: 0.92,
    },
    symbolScale: 1,
  },
  the_big_score: {
    zone: {
      leftPct: 0.06,
      topPct: 0.14,
      widthPct: 0.88,
      heightPct: 0.74,
      cornerRadiusPct: 0.06,
    },
    innerGrid: {
      xPct: 0.04,
      yPct: 0.04,
      widthPct: 0.92,
      heightPct: 0.92,
    },
    symbolScale: 1,
  },
  triple_crown_derby: {
    zone: {
      leftPct: 0.06,
      topPct: 0.14,
      widthPct: 0.88,
      heightPct: 0.74,
      cornerRadiusPct: 0.06,
    },
    innerGrid: {
      xPct: 0.04,
      yPct: 0.04,
      widthPct: 0.92,
      heightPct: 0.92,
    },
    symbolScale: 1,
  },
};

function getZoneMetricsForLayout(rect: Pick<DOMRect, "width" | "height">, zone: ScratchZoneLayout) {
  return {
    x: rect.width * zone.leftPct,
    y: rect.height * zone.topPct,
    w: rect.width * zone.widthPct,
    h: rect.height * zone.heightPct,
    radius: Math.min(rect.width, rect.height) * zone.cornerRadiusPct,
  };
}

function getOpaqueImageBounds(image: HTMLImageElement) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < SCRATCH_FOIL_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  } satisfies ScratchFoilBounds;
}

function getCrosswordTemplateFamilyId(variantId: string) {
  const templateId = variantId.split(":")[0] ?? "";
  return templateId.replace(/-(left|right|center)$/, "");
}

const CLOSE_ENCOUNTERS_SYMBOLS: Record<SymbolId, SpaceSymbol> = {
  1: { label: "Alien", src: "/close-encounters/symbols/alien.png", glow: "rgba(123,255,145,0.36)" },
  2: { label: "UFO", src: "/close-encounters/symbols/ufo.png", glow: "rgba(105,223,255,0.38)" },
  3: { label: "Planet", src: "/close-encounters/symbols/planet.png", glow: "rgba(255,194,98,0.34)" },
  4: { label: "Rocketship", src: "/close-encounters/symbols/rocketship.png", glow: "rgba(255,154,86,0.36)" },
  5: { label: "Comet", src: "/close-encounters/symbols/comet.png", glow: "rgba(255,170,95,0.36)" },
  6: { label: "Antenna", src: "/close-encounters/symbols/antenna.png", glow: "rgba(100,255,194,0.38)" },
  7: { label: "Earth", src: "/close-encounters/symbols/earth.png", glow: "rgba(104,220,255,0.36)" },
  8: { label: "Alien Points", src: "/close-encounters/symbols/alien_coins.png", glow: "rgba(255,223,101,0.36)" },
  9: { label: "Golden Alien", src: "/close-encounters/symbols/golden_alien.png", glow: "rgba(255,209,82,0.4)" },
  10: { label: "Containment", src: "/close-encounters/symbols/containment.png", glow: "rgba(124,255,188,0.36)" },
  11: { label: "Area 51", src: "/close-encounters/symbols/area51.png", glow: "rgba(255,209,90,0.34)" },
  12: { label: "Astronaut", src: "/close-encounters/symbols/astronaut.png", glow: "rgba(176,221,255,0.36)" },
  13: { label: "Landing Pad", src: "/close-encounters/symbols/landing_pad.png", glow: "rgba(111,247,255,0.36)" },
  14: { label: "Abducted Cow", src: "/close-encounters/symbols/abducted_cow.png", glow: "rgba(159,255,130,0.38)" },
  15: { label: "Peace", src: "/close-encounters/symbols/peace.png", glow: "rgba(255,151,216,0.34)" },
  16: { label: "UFO Barn", src: "/close-encounters/symbols/ufo_barn.png", glow: "rgba(135,255,146,0.36)" },
};

const FLAMINGO_FRENZY_SYMBOLS: Record<SymbolId, SpaceSymbol> = {
  1: { label: "Beach Ball", src: "/flamingo-frenzy/symbols/beach_ball.png", glow: "rgba(255,133,214,0.36)" },
  2: { label: "Coconut", src: "/flamingo-frenzy/symbols/coconut.png", glow: "rgba(255,198,101,0.34)" },
  3: { label: "Crab", src: "/flamingo-frenzy/symbols/crab.png", glow: "rgba(255,143,105,0.36)" },
  4: { label: "Fish", src: "/flamingo-frenzy/symbols/fish.png", glow: "rgba(102,220,255,0.36)" },
  5: { label: "Flamingo", src: "/flamingo-frenzy/symbols/flamingo.png", glow: "rgba(255,120,198,0.38)" },
  6: { label: "Lei", src: "/flamingo-frenzy/symbols/lei.png", glow: "rgba(255,178,98,0.34)" },
  7: { label: "Palm Tree", src: "/flamingo-frenzy/symbols/palm_tree.png", glow: "rgba(133,255,145,0.32)" },
  8: { label: "Pineapple", src: "/flamingo-frenzy/symbols/pineapple.png", glow: "rgba(255,210,101,0.36)" },
  9: { label: "Sandcastle", src: "/flamingo-frenzy/symbols/sandcastle.png", glow: "rgba(255,188,120,0.32)" },
  10: { label: "Seahorse", src: "/flamingo-frenzy/symbols/seahorse.png", glow: "rgba(255,137,196,0.34)" },
  11: { label: "Starfish", src: "/flamingo-frenzy/symbols/starfish.png", glow: "rgba(255,157,86,0.34)" },
  12: { label: "Sun", src: "/flamingo-frenzy/symbols/sun.png", glow: "rgba(255,215,110,0.38)" },
  13: { label: "Surfboard", src: "/flamingo-frenzy/symbols/surfboard.png", glow: "rgba(111,223,255,0.34)" },
  14: { label: "Tiki", src: "/flamingo-frenzy/symbols/tiki_transparent_v2.png", glow: "rgba(255,161,95,0.34)" },
  15: { label: "Toucan", src: "/flamingo-frenzy/symbols/toucan.png", glow: "rgba(255,178,86,0.34)" },
  16: { label: "Umbrella", src: "/flamingo-frenzy/symbols/umbrella.png", glow: "rgba(113,210,255,0.34)" },
};

const STEAM_BARONS_BOUNTY_SYMBOLS: Record<SymbolId, SpaceSymbol> = {
  1: { label: "Anchor", src: "/steam-barons-bounty/symbols/anchor.png", glow: "rgba(255,205,124,0.38)" },
  2: { label: "Cannon", src: "/steam-barons-bounty/symbols/cannon.png", glow: "rgba(255,169,108,0.36)" },
  3: { label: "Hook", src: "/steam-barons-bounty/symbols/hook.png", glow: "rgba(232,194,138,0.34)" },
  4: { label: "Chest", src: "/steam-barons-bounty/symbols/chest.png", glow: "rgba(255,211,107,0.38)" },
  5: { label: "Compass", src: "/steam-barons-bounty/symbols/compass.png", glow: "rgba(255,230,154,0.36)" },
  6: { label: "Sextant", src: "/steam-barons-bounty/symbols/sextant.png", glow: "rgba(205,176,118,0.34)" },
  7: { label: "Hat", src: "/steam-barons-bounty/symbols/hat.png", glow: "rgba(255,158,96,0.34)" },
  8: { label: "Skull Island", src: "/steam-barons-bounty/symbols/island.png", glow: "rgba(255,191,103,0.34)" },
  9: { label: "Jewels", src: "/steam-barons-bounty/symbols/jewels.png", glow: "rgba(138,227,255,0.36)" },
  10: { label: "Kraken", src: "/steam-barons-bounty/symbols/kraken.png", glow: "rgba(101,207,255,0.34)" },
  11: { label: "Map", src: "/steam-barons-bounty/symbols/map.png", glow: "rgba(255,214,138,0.34)" },
  12: { label: "Message Bottle", src: "/steam-barons-bounty/symbols/message.png", glow: "rgba(145,220,255,0.34)" },
  13: { label: "Parrot", src: "/steam-barons-bounty/symbols/parrot.png", glow: "rgba(255,164,98,0.34)" },
  14: { label: "Ship", src: "/steam-barons-bounty/symbols/ship.png", glow: "rgba(255,195,114,0.36)" },
  15: { label: "Skull", src: "/steam-barons-bounty/symbols/skull.png", glow: "rgba(255,224,166,0.34)" },
  16: { label: "Wheel", src: "/steam-barons-bounty/symbols/wheel.png", glow: "rgba(255,188,120,0.36)" },
};
const STEAM_BARONS_BOUNTY_WEST_SYMBOLS: Record<SymbolId, SpaceSymbol> = {
  1: { label: "Badge", src: "/steam-barons-bounty-west/symbols/badge.png", glow: "rgba(255,214,147,0.38)" },
  2: { label: "Boiler", src: "/steam-barons-bounty-west/symbols/boiler.png", glow: "rgba(255,190,112,0.34)" },
  3: { label: "Cards", src: "/steam-barons-bounty-west/symbols/cards.png", glow: "rgba(239,213,172,0.34)" },
  4: { label: "Chest", src: "/steam-barons-bounty-west/symbols/chest.png", glow: "rgba(255,206,116,0.38)" },
  5: { label: "Cog", src: "/steam-barons-bounty-west/symbols/cog.png", glow: "rgba(233,191,119,0.34)" },
  6: { label: "Dynamite", src: "/steam-barons-bounty-west/symbols/dynamite.png", glow: "rgba(255,171,103,0.36)" },
  7: { label: "Gauge", src: "/steam-barons-bounty-west/symbols/gauge.png", glow: "rgba(255,219,161,0.34)" },
  8: { label: "Hat", src: "/steam-barons-bounty-west/symbols/hat.png", glow: "rgba(216,188,139,0.34)" },
  9: { label: "Lantern", src: "/steam-barons-bounty-west/symbols/lantern.png", glow: "rgba(255,208,126,0.36)" },
  10: { label: "Map", src: "/steam-barons-bounty-west/symbols/map.png", glow: "rgba(247,217,158,0.34)" },
  11: { label: "Revolver", src: "/steam-barons-bounty-west/symbols/revolver_v2.png", glow: "rgba(236,193,132,0.34)" },
  12: { label: "Safe", src: "/steam-barons-bounty-west/symbols/safe.png", glow: "rgba(255,214,131,0.36)" },
  13: { label: "Steamboat", src: "/steam-barons-bounty-west/symbols/steamboat.png", glow: "rgba(255,200,121,0.36)" },
  14: { label: "Ticket", src: "/steam-barons-bounty-west/symbols/ticket.png", glow: "rgba(250,220,173,0.34)" },
  15: { label: "Watch", src: "/steam-barons-bounty-west/symbols/watch.png", glow: "rgba(255,218,162,0.34)" },
  16: { label: "Whiskey", src: "/steam-barons-bounty-west/symbols/whiskey.png", glow: "rgba(255,167,95,0.34)" },
};

function getThemeSymbolPool(themeId: ThemeId): readonly SymbolId[] {
  switch (themeId) {
    case "close_encounters":
      return CLOSE_ENCOUNTERS_SYMBOL_POOL;
    case "flamingo_frenzy":
      return FLAMINGO_FRENZY_SYMBOL_POOL;
    case "steam_barons_bounty":
      return STEAM_BARONS_BOUNTY_SYMBOL_POOL;
    case "steam_barons_bounty_west":
      return STEAM_BARONS_BOUNTY_WEST_SYMBOL_POOL;
    default:
      return CLASSIC_SYMBOLS;
  }
}

function getThemeScratchPrompt(themeId: ThemeId) {
  switch (themeId) {
    case "close_encounters":
      return "Sweep the scanner field to reveal your cosmic contacts.";
    case "flamingo_frenzy":
      return "Scratch through the tropical shimmer to reveal your beach-party symbols.";
    case "steam_barons_bounty":
      return "Scratch through the brass sea-foam to reveal your treasure relics.";
    case "steam_barons_bounty_west":
      return "Scratch through the soot and steam to reveal your frontier bounty symbols.";
    case "battlescratch":
      return "Place every strike marker, confirm the launch, then scratch through the ocean foil to reveal your naval hits.";
    case "crossword":
      return "Tap each hidden letter to reveal it, then tap the matching cells on the crossword to complete words for the payout.";
    case "reel_reveal":
      return "Scratch through the metallic foil to uncover the slot reels, then spin them to reveal the premium line.";
    case "the_big_score":
      return "Choose your entrance, getaway, and vault code, then scratch through the heist foil to reveal the real combination.";
    case "triple_crown_derby":
      return "Pick one horse each for Win, Place, and Show, then scratch through the race foil to reveal the final order.";
    default:
      return "Scratch the play area to reveal the result.";
  }
}

function getThemeSelectionPrompt(themeId: ThemeId) {
  switch (themeId) {
    case "close_encounters":
      return "Close Encounters selected. Launch your next mission whenever you're ready.";
    case "flamingo_frenzy":
      return "Flamingo Frenzy selected. Dive into the beach party whenever you're ready.";
    case "steam_barons_bounty":
      return "Pirates Buried Treasure selected. Chart your next brass-bound treasure run whenever you're ready.";
    case "steam_barons_bounty_west":
      return "Steam Baron's Bounty selected. Ride into your next frontier haul whenever you're ready.";
    case "battlescratch":
      return "Battlescratch selected. Arm your strike markers and hunt the hidden fleet.";
    case "crossword":
      return "Crossword selected. Reveal your letters and build completed words for the prize.";
    case "reel_reveal":
      return "Reel Reveal selected. Uncover the slot window and spin for the premium payout line.";
    case "the_big_score":
      return "The Big Score selected. Assemble the loadout and scratch open the heist result.";
    case "triple_crown_derby":
      return "Triple Crown Derby selected. Lock your Win, Place, and Show horses and scratch open the race result.";
    default:
      return "Ticket selected. Start scratching whenever you're ready.";
  }
}

function ticketLetterProgress(revealed: number, total: number) {
  return `${revealed}/${total} letters revealed.`;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: readonly T[]) {
  return items[randInt(0, items.length - 1)];
}

function shuffle<T>(items: readonly T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function analyze(ids: readonly SymbolId[]) {
  const positions = new Map<SymbolId, number[]>();
  ids.forEach((id, index) => {
    const list = positions.get(id) ?? [];
    list.push(index);
    positions.set(id, list);
  });

  for (const [id, indices] of positions.entries()) {
    if (indices.length === 3) return { outcome: "win" as const, winSymbol: id, winIndices: indices };
  }
  for (const indices of positions.values()) {
    if (indices.length === 2) return { outcome: "nearMiss" as const, winSymbol: null, winIndices: [] };
  }
  return { outcome: "lose" as const, winSymbol: null, winIndices: [] };
}

function generateWinningTicket(symbolPool: readonly SymbolId[]): TicketVisual {
  const winner = pickOne(symbolPool);
  const ids: SymbolId[] = [winner, winner, winner];
  const counts = new Map<SymbolId, number>([[winner, 3]]);

  while (ids.length < GRID_SIZE) {
    const next = pickOne(symbolPool);
    if (next === winner) continue;
    const count = counts.get(next) ?? 0;
    if (count >= 2) continue;
    counts.set(next, count + 1);
    ids.push(next);
  }

  const shuffled = shuffle(ids);
  const result = analyze(shuffled);
  return { ids: shuffled, outcome: "win", winIndices: result.winIndices };
}

function generateLosingTicket(target: "nearMiss" | "lose", symbolPool: readonly SymbolId[]): TicketVisual {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const ids: SymbolId[] = [];
    const counts = new Map<SymbolId, number>();
    if (target === "nearMiss") {
      const pair = pickOne(symbolPool);
      ids.push(pair, pair);
      counts.set(pair, 2);
    }

    while (ids.length < GRID_SIZE) {
      const next = pickOne(symbolPool);
      const count = counts.get(next) ?? 0;
      if (count >= 2) continue;
      counts.set(next, count + 1);
      ids.push(next);
    }

    const shuffled = shuffle(ids);
    const result = analyze(shuffled);
    if (result.outcome === target) {
      return { ids: shuffled, outcome: target, winIndices: [] };
    }
  }

  const ids: SymbolId[] = [];
  const counts = new Map<SymbolId, number>();
  let cursor = 0;
  if (target === "nearMiss") {
    ids.push(symbolPool[0], symbolPool[0]);
    counts.set(symbolPool[0], 2);
  }

  while (ids.length < GRID_SIZE) {
    const next = symbolPool[cursor % symbolPool.length];
    cursor += 1;
    const count = counts.get(next) ?? 0;
    const limit = target === "lose" ? 1 : 2;
    if (count >= limit) continue;
    counts.set(next, count + 1);
    ids.push(next);
  }

  return {
    ids: shuffle(ids),
    outcome: target,
    winIndices: [],
  };
}

function generateTicketVisual(winAmount: number, symbolPool: readonly SymbolId[]) {
  if (winAmount > 0) return generateWinningTicket(symbolPool);
  return Math.random() < 0.38 ? generateLosingTicket("nearMiss", symbolPool) : generateLosingTicket("lose", symbolPool);
}

function ScratchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeEncountersFoilImageRef = useRef<HTMLImageElement | null>(null);
  const closeEncountersFoilBoundsRef = useRef<ScratchFoilBounds | null>(null);
  const flamingoFrenzyFoilImageRef = useRef<HTMLImageElement | null>(null);
  const flamingoFrenzyFoilBoundsRef = useRef<ScratchFoilBounds | null>(null);
  const steamBaronsBountyFoilImageRef = useRef<HTMLImageElement | null>(null);
  const steamBaronsBountyFoilBoundsRef = useRef<ScratchFoilBounds | null>(null);
  const steamBaronsBountyWestFoilImageRef = useRef<HTMLImageElement | null>(null);
  const steamBaronsBountyWestFoilBoundsRef = useRef<ScratchFoilBounds | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const sparkleSoundRef = useRef<HTMLAudioElement | null>(null);
  const isDownRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const canvasMetricsRef = useRef<{ rect: DOMRect; dpr: number } | null>(null);
  const lastScratchPointRef = useRef<{ x: number; y: number } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastScratchFxAtRef = useRef(0);
  const ceWinFxTimeoutsRef = useRef<number[]>([]);
  const ceWinFxRafRef = useRef<number | null>(null);
  const ffWinFxTimeoutsRef = useRef<number[]>([]);
  const ffWinFxRafRef = useRef<number | null>(null);
  const sbbWinFxTimeoutsRef = useRef<number[]>([]);
  const sbbWinFxRafRef = useRef<number | null>(null);
  const sbwWinFxTimeoutsRef = useRef<number[]>([]);
  const sbwWinFxRafRef = useRef<number | null>(null);
  const sbwWinVideoRef = useRef<HTMLVideoElement | null>(null);
  const bsWinFxTimeoutsRef = useRef<number[]>([]);
  const bsWinFxRafRef = useRef<number | null>(null);
  const battleSinkVideoRef = useRef<HTMLVideoElement | null>(null);
  const battleSessionRestoreCheckedRef = useRef(false);
  const crosswordSessionRestoreCheckedRef = useRef(false);

  const [tickets, setTickets] = useState<TicketCatalogItem[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<TicketId>("gold");
  const [boardTicketId, setBoardTicketId] = useState<TicketId>("gold");
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>("flamingo_frenzy");
  const [boardThemeId, setBoardThemeId] = useState<ThemeId>("flamingo_frenzy");
  const [balance, setBalance] = useState(0);
  const [playerId, setPlayerId] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [, setStatusMessage] = useState("Loading scratch ticket data...");
  const [busy, setBusy] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const [ticketIds, setTicketIds] = useState<SymbolId[]>([]);
  const [outcome, setOutcome] = useState<TicketOutcome>("lose");
  const [winIndices, setWinIndices] = useState<number[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [currentCost, setCurrentCost] = useState(0);
  const [currentWinAmount, setCurrentWinAmount] = useState(0);
  const [, setCurrentNet] = useState(0);
  const [isTicketMenuOpen, setIsTicketMenuOpen] = useState(false);
  const [isReplaySheetOpen, setIsReplaySheetOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [activeScratchView, setActiveScratchView] = useState<ScratchView>("tickets");
  const [ceWinFxPhase, setCeWinFxPhase] = useState<"idle" | "hoverIn" | "hoverPause" | "beamIn" | "countUp" | "beamOff" | "exit" | "done">("idle");
  const [ceWinFxValue, setCeWinFxValue] = useState(0);
  const [ffWinFxPhase, setFfWinFxPhase] = useState<"idle" | "splashIn" | "countUp" | "hero" | "done">("idle");
  const [ffWinFxValue, setFfWinFxValue] = useState(0);
  const [sbbWinFxPhase, setSbbWinFxPhase] = useState<"idle" | "intro" | "countUp" | "hero" | "done">("idle");
  const [sbbWinFxValue, setSbbWinFxValue] = useState(0);
  const [sbwWinFxPhase, setSbwWinFxPhase] = useState<"idle" | "intro" | "countUp" | "done">("idle");
  const [sbwWinFxValue, setSbwWinFxValue] = useState(0);
  const [sbwWinVideoEnded, setSbwWinVideoEnded] = useState(false);
  const [battleTicket, setBattleTicket] = useState<BattlescratchTicket | null>(null);
  const [battleMarkers, setBattleMarkers] = useState<BattlescratchTargetMarker[]>([]);
  const [battleRevealState, setBattleRevealState] = useState<BattlescratchRevealState>(createInitialRevealState());
  const [battleOutcome, setBattleOutcome] = useState<BattlescratchOutcome | null>(null);
  const [, setBsWinFxPhase] = useState<"idle" | "intro" | "countUp" | "done">("idle");
  const [bsWinFxValue, setBsWinFxValue] = useState(0);
  const [battleSinkVideoQueue, setBattleSinkVideoQueue] = useState<Array<{ id: string; label: string; src: string }>>([]);
  const [battleSinkVideoIndex, setBattleSinkVideoIndex] = useState(0);
  const [crosswordTicket, setCrosswordTicket] = useState<CrosswordTicketData | null>(null);
  const [crosswordState, setCrosswordState] = useState<CrosswordGameState>(createInitialCrosswordGameState());
  const [crosswordClaimPending, setCrosswordClaimPending] = useState(false);
  const [reelRevealTicket, setReelRevealTicket] = useState<ReelRevealTicketData | null>(null);
  const [theBigScoreTicket, setTheBigScoreTicket] = useState<TheBigScoreTicketData | null>(null);
  const [tripleCrownDerbyTicket, setTripleCrownDerbyTicket] = useState<TripleCrownDerbyTicketData | null>(null);
  const lastCrosswordTemplateIdRef = useRef<string | null>(null);
  const getErrorMessage = useCallback((error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback), []);
  const resolvedBoardThemeId: ThemeId = BOARD_LAYOUTS[boardThemeId]
    ? boardThemeId
    : BOARD_LAYOUTS[selectedThemeId]
      ? selectedThemeId
      : "flamingo_frenzy";
  const boardLayout = BOARD_LAYOUTS[resolvedBoardThemeId];
  const boardZone = boardLayout.zone;

  const getZoneMetrics = useCallback(
    (rect: Pick<DOMRect, "width" | "height">, themeId: ThemeId = resolvedBoardThemeId) =>
      getZoneMetricsForLayout(rect, (BOARD_LAYOUTS[themeId] ?? boardLayout).zone),
    [boardLayout, resolvedBoardThemeId]
  );

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );
  const browseCatalogTicket = useMemo(() => selectedTicket ?? tickets[0] ?? null, [selectedTicket, tickets]);
  const boardTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === boardTicketId) ?? null,
    [boardTicketId, tickets]
  );
  const selectedTheme = useMemo(
    () => THEME_OPTIONS.find((theme) => theme.id === selectedThemeId) ?? THEME_OPTIONS[0],
    [selectedThemeId]
  );
  const boardTheme = useMemo(
    () => THEME_OPTIONS.find((theme) => theme.id === boardThemeId) ?? THEME_OPTIONS[0],
    [boardThemeId]
  );
  const requestedThemeId = searchParams.get("theme");
  const requestedView = searchParams.get("view");

  useEffect(() => {
    if (requestedThemeId && THEME_OPTIONS.some((theme) => theme.id === requestedThemeId)) {
      setSelectedThemeId((current) => (current === requestedThemeId ? current : (requestedThemeId as ThemeId)));
      setStatusMessage(getThemeSelectionPrompt(requestedThemeId as ThemeId));
    }

    if (requestedView === "play" || requestedView === "tickets") {
      setActiveScratchView(requestedView);
    }
  }, [requestedThemeId, requestedView]);
  const boardRectCss = (() => {
    const wrap = containerRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  })();
  const boardZoneCss = (() => {
    if (!boardRectCss) return null;
    return getZoneMetricsForLayout(boardRectCss, boardLayout.zone);
  })();

  const promptTicket = selectedTicket ?? boardTicket;
  const canReplayTicket = Boolean(promptTicket);
  const promptTheme = isRevealed ? boardTheme : selectedTheme;
  const showCloseEncountersWinFx =
    boardThemeId === "close_encounters" && isRevealed && outcome === "win" && currentWinAmount > 0;
  const showCloseEncountersResultCard =
    boardThemeId === "close_encounters" &&
    isRevealed &&
    outcome !== "win";
  const showFlamingoFrenzyWinFx =
    boardThemeId === "flamingo_frenzy" && isRevealed && outcome === "win" && currentWinAmount > 0;
  const showFlamingoFrenzyLoseCard =
    boardThemeId === "flamingo_frenzy" && isRevealed && outcome !== "win";
  const showSteamBaronsBountyWinFx =
    boardThemeId === "steam_barons_bounty" && isRevealed && outcome === "win" && currentWinAmount > 0;
  const showSteamBaronsBountyLoseCard =
    boardThemeId === "steam_barons_bounty" && isRevealed && outcome !== "win";
  const showSteamBaronsBountyWestWinFx =
    boardThemeId === "steam_barons_bounty_west" && isRevealed && outcome === "win" && currentWinAmount > 0;
  const showSteamBaronsBountyWestLoseCard =
    boardThemeId === "steam_barons_bounty_west" && isRevealed && outcome !== "win";
  const activeBattlescratchSinkVideo = battleSinkVideoQueue[battleSinkVideoIndex] ?? null;
  const showBattlescratchSinkVideo =
    boardThemeId === "battlescratch" && isRevealed && Boolean(activeBattlescratchSinkVideo) && battleSinkVideoQueue.length > 0;
  const showBattlescratchWinFx =
    boardThemeId === "battlescratch" &&
    isRevealed &&
    outcome === "win" &&
    currentWinAmount > 0 &&
    Boolean(battleOutcome) &&
    !showBattlescratchSinkVideo;
  const isBattlescratchBoard = boardThemeId === "battlescratch" && battleTicket !== null;
  const isCrosswordBoard = boardThemeId === "crossword" && crosswordTicket !== null;
  const isReelRevealBoard = boardThemeId === "reel_reveal" && reelRevealTicket !== null;
  const isTheBigScoreBoard = boardThemeId === "the_big_score" && theBigScoreTicket !== null;
  const isTripleCrownDerbyBoard = boardThemeId === "triple_crown_derby" && tripleCrownDerbyTicket !== null;
  const isClassicBoard =
    ticketIds.length === GRID_SIZE && !isBattlescratchBoard && !isCrosswordBoard && !isReelRevealBoard && !isTheBigScoreBoard && !isTripleCrownDerbyBoard;
  const showSelectedBattlescratchBoard = selectedThemeId === "battlescratch" && isBattlescratchBoard;
  const showSelectedCrosswordBoard = selectedThemeId === "crossword" && isCrosswordBoard;
  const showSelectedReelRevealBoard = selectedThemeId === "reel_reveal" && isReelRevealBoard;
  const showSelectedTheBigScoreBoard = selectedThemeId === "the_big_score" && isTheBigScoreBoard;
  const showSelectedTripleCrownDerbyBoard = selectedThemeId === "triple_crown_derby" && isTripleCrownDerbyBoard;
  const showSelectedClassicBoard = selectedThemeId === boardThemeId && isClassicBoard;
  const isCrosswordThemeActive = selectedThemeId === "crossword" || boardThemeId === "crossword";
  const isReelRevealThemeActive = selectedThemeId === "reel_reveal" || boardThemeId === "reel_reveal";
  const isTheBigScoreThemeActive = selectedThemeId === "the_big_score" || boardThemeId === "the_big_score";
  const isTripleCrownDerbyThemeActive = selectedThemeId === "triple_crown_derby" || boardThemeId === "triple_crown_derby";
  const isBattlescratchTargeting = isBattlescratchBoard && !battleRevealState.confirmed;
  const isBattlescratchScratching = isBattlescratchBoard && battleRevealState.confirmed && !battleRevealState.completed;
  const isBattlescratchComplete = isBattlescratchBoard && battleRevealState.completed;
  const showBattlescratchResultCard =
    isBattlescratchBoard && isBattlescratchComplete && Boolean(battleOutcome) && !showBattlescratchSinkVideo;
  const resultTone =
    outcome === "win"
      ? "Winner. Keep the streak going."
      : outcome === "nearMiss"
        ? "So close. Want another ticket?"
        : "Fresh ticket, fresh shot.";

  function hasActiveBoardForTheme(themeId: ThemeId) {
    switch (themeId) {
      case "battlescratch":
        return showSelectedBattlescratchBoard;
      case "crossword":
        return showSelectedCrosswordBoard;
      case "reel_reveal":
        return showSelectedReelRevealBoard;
      case "the_big_score":
        return showSelectedTheBigScoreBoard;
      case "triple_crown_derby":
        return showSelectedTripleCrownDerbyBoard;
      default:
        return showSelectedClassicBoard && boardThemeId === themeId;
    }
  }

  const shouldShowThemeHome = !hasActiveBoardForTheme(selectedThemeId);
  const hasAnyActiveBoard =
    showSelectedBattlescratchBoard ||
    showSelectedCrosswordBoard ||
    showSelectedReelRevealBoard ||
    showSelectedTheBigScoreBoard ||
    showSelectedTripleCrownDerbyBoard ||
    showSelectedClassicBoard;
  const showBrowseView = activeScratchView === "tickets";
  const showCompactBrowseLayout = isCompactViewport && showBrowseView;
  const showCompactPlayLayout = isCompactViewport && !showBrowseView;
  const showRevealAllControl =
    !isCrosswordThemeActive &&
    !isReelRevealThemeActive &&
    !isTheBigScoreThemeActive &&
    !isTripleCrownDerbyThemeActive &&
    (showSelectedClassicBoard || showSelectedBattlescratchBoard);
  const showMobileScratchActions = showCompactPlayLayout && (showSelectedClassicBoard || showSelectedBattlescratchBoard);
  const showMobileSoundControl = showCompactPlayLayout && !showBrowseView && hasAnyActiveBoard;
  const showDesktopScratchSupport = !showCompactPlayLayout && !showBrowseView;
  const mobileNavItems = [
    {
      id: "home",
      label: "Home",
      icon: <HomeNavIcon />,
      onClick: () => router.push("/home"),
    },
    {
      id: "tickets",
      label: "Tickets",
      icon: <TicketsNavIcon />,
      active: true,
      onClick: () => openTicketBrowse(),
    },
    {
      id: "rewards",
      label: "Rewards",
      icon: <RewardsNavIcon />,
      onClick: () => router.push("/home?tab=rewards"),
    },
  ];
  const revealAllLabel = isBattlescratchBoard ? "Reveal Battle" : "Reveal All";
  const revealAllDisabled =
    (ticketIds.length !== GRID_SIZE && !isBattlescratchBoard) ||
    (isBattlescratchBoard && !battleRevealState.confirmed) ||
    isRevealed;
  const launchSkin = getThemeLaunchSkin(selectedThemeId);
  const mobileGameFlowTimersRef = useRef<number[]>([]);
  const compactLaunchCounterRef = useRef(0);
  const [mobileGameStage, setMobileGameStage] = useState<MobileGameStage>("splash");
  const [activeCompactLaunchId, setActiveCompactLaunchId] = useState<number | null>(null);
  const lastPreparedCompactLaunchIdRef = useRef(0);
  const showMountedClassicScratchBoard = showSelectedClassicBoard || showSelectedBattlescratchBoard;
  const showGameLaunchOverlay = isCompactViewport && activeCompactLaunchId !== null && mobileGameStage !== "playing";

  const updateMobileGameStage = useCallback((stage: MobileGameStage) => {
    setMobileGameStage((currentStage) => (currentStage === stage ? currentStage : stage));
  }, []);

  const clearMobileGameFlowTimers = useCallback(() => {
    mobileGameFlowTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    mobileGameFlowTimersRef.current = [];
  }, []);

  const queueMobileGameStage = useCallback((delay: number, stage: MobileGameStage) => {
    const timer = window.setTimeout(() => {
      updateMobileGameStage(stage);
      mobileGameFlowTimersRef.current = mobileGameFlowTimersRef.current.filter((entry) => entry !== timer);
    }, delay);
    mobileGameFlowTimersRef.current.push(timer);
  }, [updateMobileGameStage]);

  const beginCompactGameplay = useCallback(() => {
    setActiveCompactLaunchId(null);
    updateMobileGameStage("playing");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        setLayoutVersion((value) => value + 1);
      });
    }
  }, [updateMobileGameStage]);

  useEffect(() => {
    battleSessionRestoreCheckedRef.current = false;
    crosswordSessionRestoreCheckedRef.current = false;
  }, [playerId]);

  useEffect(() => () => clearMobileGameFlowTimers(), [clearMobileGameFlowTimers]);

  useEffect(() => {
    if (showBrowseView) {
      clearMobileGameFlowTimers();
      setActiveCompactLaunchId(null);
      updateMobileGameStage("splash");
      return;
    }

    clearMobileGameFlowTimers();

    if (busy) {
      if (activeCompactLaunchId !== null) {
        updateMobileGameStage("splash");
        queueMobileGameStage(260, "loading");
      }
      return;
    }

    if (hasAnyActiveBoard) {
      if (activeCompactLaunchId === null) {
        updateMobileGameStage("playing");
        return;
      }

      if (lastPreparedCompactLaunchIdRef.current !== activeCompactLaunchId) {
        lastPreparedCompactLaunchIdRef.current = activeCompactLaunchId;
        updateMobileGameStage("ready");
        return;
      }

      if (mobileGameStage !== "playing") {
        updateMobileGameStage("ready");
        return;
      }

      updateMobileGameStage("playing");
      return;
    }

    updateMobileGameStage("splash");
  }, [
    busy,
    clearMobileGameFlowTimers,
    activeCompactLaunchId,
    hasAnyActiveBoard,
    mobileGameStage,
    queueMobileGameStage,
    showBrowseView,
    updateMobileGameStage,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const [me, catalog] = await Promise.all([
          apiGet<MeResponse>("/me"),
          apiGet<TicketCatalogResponse>("/scratchers/tickets"),
        ]);

        if (!me.ok) {
          router.replace("/login");
          return;
        }

        const orderedTickets = [...catalog.tickets].sort(
          (left, right) => TICKET_ORDER.indexOf(left.id) - TICKET_ORDER.indexOf(right.id)
        );

        setPlayerId(me.user.id);
        setPlayerEmail(me.user.email);
        setBalance(me.user.scratchCoin);
        setTickets(orderedTickets);
        setSelectedTicketId(orderedTickets[0]?.id ?? "gold");
        setBoardTicketId(orderedTickets[0]?.id ?? "gold");
        setStatusMessage("Choose a ticket world and start scratching.");
      } catch {
        router.replace("/login");
      } finally {
        setBusy(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    const win = winSoundRef.current;
    const sparkle = sparkleSoundRef.current;
    if (win) {
      win.muted = isMuted;
      win.volume = volume;
    }
    if (sparkle) {
      sparkle.muted = isMuted;
      sparkle.volume = volume;
    }
  }, [isMuted, volume]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 1279px)");
    const syncViewportMode = (event?: MediaQueryListEvent) => {
      setIsCompactViewport(event ? event.matches : media.matches);
    };

    syncViewportMode();
    media.addEventListener("change", syncViewportMode);
    return () => {
      media.removeEventListener("change", syncViewportMode);
    };
  }, []);

  useEffect(() => {
    if (isCompactViewport) return;
    setIsTicketMenuOpen(false);
    setIsReplaySheetOpen(false);
  }, [isCompactViewport]);

  useEffect(() => {
    if (isRevealed) return;
    setIsReplaySheetOpen(false);
  }, [isRevealed]);

  const clearCloseEncountersWinFx = useCallback(() => {
    ceWinFxTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    ceWinFxTimeoutsRef.current = [];
    if (ceWinFxRafRef.current !== null) {
      window.cancelAnimationFrame(ceWinFxRafRef.current);
      ceWinFxRafRef.current = null;
    }
  }, []);

  const clearFlamingoFrenzyWinFx = useCallback(() => {
    ffWinFxTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    ffWinFxTimeoutsRef.current = [];
    if (ffWinFxRafRef.current !== null) {
      window.cancelAnimationFrame(ffWinFxRafRef.current);
      ffWinFxRafRef.current = null;
    }
  }, []);

  const clearSteamBaronsBountyWinFx = useCallback(() => {
    sbbWinFxTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    sbbWinFxTimeoutsRef.current = [];
    if (sbbWinFxRafRef.current !== null) {
      window.cancelAnimationFrame(sbbWinFxRafRef.current);
      sbbWinFxRafRef.current = null;
    }
  }, []);

  const clearSteamBaronsBountyWestWinFx = useCallback(() => {
    sbwWinFxTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    sbwWinFxTimeoutsRef.current = [];
    if (sbwWinFxRafRef.current !== null) {
      window.cancelAnimationFrame(sbwWinFxRafRef.current);
      sbwWinFxRafRef.current = null;
    }
  }, []);

  const clearBattlescratchWinFx = useCallback(() => {
    bsWinFxTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    bsWinFxTimeoutsRef.current = [];
    if (bsWinFxRafRef.current !== null) {
      window.cancelAnimationFrame(bsWinFxRafRef.current);
      bsWinFxRafRef.current = null;
    }
  }, []);

  const clearBattlescratchSinkVideoSequence = useCallback(() => {
    const video = battleSinkVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setBattleSinkVideoQueue([]);
    setBattleSinkVideoIndex(0);
  }, []);

  useEffect(() => {
    return () => {
      clearCloseEncountersWinFx();
      clearFlamingoFrenzyWinFx();
      clearSteamBaronsBountyWinFx();
      clearSteamBaronsBountyWestWinFx();
      clearBattlescratchWinFx();
      clearBattlescratchSinkVideoSequence();
    };
  }, [clearBattlescratchSinkVideoSequence, clearBattlescratchWinFx, clearCloseEncountersWinFx, clearFlamingoFrenzyWinFx, clearSteamBaronsBountyWinFx, clearSteamBaronsBountyWestWinFx]);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;

    const AudioCtor =
      window.AudioContext ??
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }

    return audioContextRef.current;
  }, []);

  const playCloseEncountersCue = useCallback(
    (cue: "scratch" | "buy" | "win" | "nearMiss" | "lose") => {
      if (isMuted || volume <= 0) return;

      const ctx = ensureAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime + 0.01;
      const master = ctx.createGain();
      master.gain.value = Math.max(0.001, 0.06 * volume);
      master.connect(ctx.destination);

      const playTone = (
        type: OscillatorType,
        start: number,
        duration: number,
        from: number,
        to: number,
        level: number
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(50, to), start + duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + duration + 0.03);
      };

      if (cue === "scratch") {
        playTone("triangle", now, 0.08, 900, 620, 0.2);
        playTone("sine", now + 0.03, 0.09, 660, 420, 0.12);
      } else if (cue === "buy") {
        playTone("sawtooth", now, 0.12, 220, 420, 0.16);
        playTone("triangle", now + 0.08, 0.16, 420, 780, 0.18);
        playTone("sine", now + 0.18, 0.22, 780, 1240, 0.14);
      } else if (cue === "win") {
        playTone("triangle", now, 0.18, 360, 720, 0.16);
        playTone("triangle", now + 0.12, 0.18, 540, 1080, 0.18);
        playTone("sine", now + 0.28, 0.4, 880, 1480, 0.14);
        playTone("sine", now + 0.34, 0.48, 1180, 1760, 0.12);
      } else if (cue === "nearMiss") {
        playTone("triangle", now, 0.12, 520, 700, 0.12);
        playTone("sine", now + 0.11, 0.18, 700, 560, 0.1);
      } else {
        playTone("sine", now, 0.16, 420, 180, 0.09);
      }

      window.setTimeout(() => {
        master.disconnect();
      }, 1200);
    },
    [ensureAudioContext, isMuted, volume]
  );

  const drawCloseEncountersFoil = useCallback((ctx: CanvasRenderingContext2D, rect: DOMRect) => {
    const zone = getZoneMetricsForLayout(rect, BOARD_LAYOUTS.close_encounters.zone);

    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius);
    ctx.clip();

    const foilImage = closeEncountersFoilImageRef.current;
    const foilBounds = closeEncountersFoilBoundsRef.current;
    if (foilImage?.complete && foilImage.naturalWidth > 0 && foilBounds) {
      ctx.drawImage(foilImage, foilBounds.x, foilBounds.y, foilBounds.width, foilBounds.height, zone.x, zone.y, zone.w, zone.h);
      ctx.restore();
      return;
    }

    const foil = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
    foil.addColorStop(0, "#05030d");
    foil.addColorStop(0.28, "#120f2b");
    foil.addColorStop(0.58, "#07182b");
    foil.addColorStop(1, "#03050b");
    ctx.fillStyle = foil;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const auroraA = ctx.createRadialGradient(
      zone.x + zone.w * 0.2,
      zone.y + zone.h * 0.16,
      0,
      zone.x + zone.w * 0.2,
      zone.y + zone.h * 0.16,
      zone.w * 0.5
    );
    auroraA.addColorStop(0, "rgba(95,255,191,0.26)");
    auroraA.addColorStop(0.5, "rgba(95,255,191,0.09)");
    auroraA.addColorStop(1, "rgba(95,255,191,0)");
    ctx.fillStyle = auroraA;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const auroraB = ctx.createRadialGradient(
      zone.x + zone.w * 0.82,
      zone.y + zone.h * 0.2,
      0,
      zone.x + zone.w * 0.82,
      zone.y + zone.h * 0.2,
      zone.w * 0.44
    );
    auroraB.addColorStop(0, "rgba(196,114,255,0.2)");
    auroraB.addColorStop(0.56, "rgba(196,114,255,0.07)");
    auroraB.addColorStop(1, "rgba(196,114,255,0)");
    ctx.fillStyle = auroraB;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    ctx.globalAlpha = 0.16;
    const sweep = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.45, "rgba(255,255,255,0.75)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(zone.x - zone.w * 0.25, zone.y, zone.w * 1.5, zone.h);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(98, 232, 255, 0.12)";
    ctx.lineWidth = Math.max(1.5, rect.width * 0.0022);
    for (let offset = -zone.h; offset < zone.w; offset += zone.w / 8) {
      ctx.beginPath();
      ctx.moveTo(zone.x + offset, zone.y);
      ctx.lineTo(zone.x + offset + zone.h * 0.9, zone.y + zone.h);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    for (let i = 0; i < 68; i += 1) {
      const starX = zone.x + ((i * 97) % 1000) / 1000 * zone.w;
      const starY = zone.y + ((i * 59) % 1000) / 1000 * zone.h;
      const starSize = 0.7 + (i % 3) * 0.6;
      ctx.beginPath();
      ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(205,255,248,0.9)";
    ctx.font = `700 ${Math.max(18, rect.width * 0.036)}px "Segoe UI"`;
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH TO MAKE CONTACT", zone.x + zone.w / 2, zone.y + zone.h * 0.54);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const foilImage = new window.Image();
    foilImage.src = CLOSE_ENCOUNTERS_SCRATCH_FOIL_SRC;
    foilImage.onload = () => {
      closeEncountersFoilImageRef.current = foilImage;
      closeEncountersFoilBoundsRef.current = getOpaqueImageBounds(foilImage);
      const canvas = canvasRef.current;
      const wrap = containerRef.current;
      if (!canvas || !wrap || boardThemeId !== "close_encounters" || !showMountedClassicScratchBoard || isRevealed) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawCloseEncountersFoil(ctx, rect);
    };
    closeEncountersFoilImageRef.current = foilImage;

    return () => {
      if (closeEncountersFoilImageRef.current === foilImage) {
        closeEncountersFoilImageRef.current = null;
        closeEncountersFoilBoundsRef.current = null;
      }
    };
  }, [boardThemeId, drawCloseEncountersFoil, isRevealed, showMountedClassicScratchBoard]);

  const drawFlamingoFrenzyFoil = useCallback((ctx: CanvasRenderingContext2D, rect: DOMRect) => {
    const zone = getZoneMetricsForLayout(rect, BOARD_LAYOUTS.flamingo_frenzy.zone);

    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius);
    ctx.clip();

    const foilImage = flamingoFrenzyFoilImageRef.current;
    const foilBounds = flamingoFrenzyFoilBoundsRef.current;
    if (foilImage?.complete && foilImage.naturalWidth > 0 && foilBounds) {
      ctx.drawImage(foilImage, foilBounds.x, foilBounds.y, foilBounds.width, foilBounds.height, zone.x, zone.y, zone.w, zone.h);
      ctx.restore();
      return;
    }

    const foil = ctx.createLinearGradient(zone.x, zone.y, zone.x, zone.y + zone.h);
    foil.addColorStop(0, "#fff0fa");
    foil.addColorStop(0.22, "#ffd8ef");
    foil.addColorStop(0.48, "#ffd6a1");
    foil.addColorStop(0.74, "#a3f4ff");
    foil.addColorStop(1, "#79d9ff");
    ctx.fillStyle = foil;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const sunsetGlow = ctx.createRadialGradient(
      zone.x + zone.w * 0.52,
      zone.y + zone.h * 0.08,
      0,
      zone.x + zone.w * 0.52,
      zone.y + zone.h * 0.08,
      zone.w * 0.5
    );
    sunsetGlow.addColorStop(0, "rgba(255,255,255,0.9)");
    sunsetGlow.addColorStop(0.16, "rgba(255,245,157,0.62)");
    sunsetGlow.addColorStop(0.42, "rgba(255,163,119,0.24)");
    sunsetGlow.addColorStop(1, "rgba(255,163,119,0)");
    ctx.fillStyle = sunsetGlow;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const lagoonGlow = ctx.createRadialGradient(
      zone.x + zone.w * 0.24,
      zone.y + zone.h * 0.86,
      0,
      zone.x + zone.w * 0.24,
      zone.y + zone.h * 0.86,
      zone.w * 0.56
    );
    lagoonGlow.addColorStop(0, "rgba(108,244,255,0.34)");
    lagoonGlow.addColorStop(0.48, "rgba(108,244,255,0.12)");
    lagoonGlow.addColorStop(1, "rgba(108,244,255,0)");
    ctx.fillStyle = lagoonGlow;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    ctx.globalAlpha = 0.18;
    const sweep = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.45, "rgba(255,255,255,0.92)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(zone.x - zone.w * 0.18, zone.y, zone.w * 1.36, zone.h);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = Math.max(1.2, rect.width * 0.002);
    for (let offset = -zone.h; offset < zone.w; offset += zone.w / 7) {
      ctx.beginPath();
      ctx.moveTo(zone.x + offset, zone.y);
      ctx.lineTo(zone.x + offset + zone.h * 0.88, zone.y + zone.h);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let i = 0; i < 48; i += 1) {
      const sparkleX = zone.x + (((i * 73) % 1000) / 1000) * zone.w;
      const sparkleY = zone.y + (((i * 47) % 1000) / 1000) * zone.h;
      const sparkleSize = 0.8 + (i % 3) * 0.55;
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = `700 ${Math.max(18, rect.width * 0.048)}px "Segoe UI"`;
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH HERE TO REVEAL", zone.x + zone.w / 2, zone.y + zone.h * 0.48);
    ctx.fillStyle = "rgba(255,138,195,0.9)";
    ctx.font = `700 ${Math.max(17, rect.width * 0.03)}px "Segoe UI"`;
    ctx.fillText("MATCH 3 SYMBOLS TO WIN!", zone.x + zone.w / 2, zone.y + zone.h * 0.57);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const foilImage = new window.Image();
    foilImage.src = FLAMINGO_FRENZY_SCRATCH_FOIL_SRC;
    foilImage.onload = () => {
      flamingoFrenzyFoilImageRef.current = foilImage;
      flamingoFrenzyFoilBoundsRef.current = getOpaqueImageBounds(foilImage);
      const canvas = canvasRef.current;
      const wrap = containerRef.current;
      if (!canvas || !wrap || boardThemeId !== "flamingo_frenzy" || !showMountedClassicScratchBoard || isRevealed) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawFlamingoFrenzyFoil(ctx, rect);
    };
    flamingoFrenzyFoilImageRef.current = foilImage;

    return () => {
      if (flamingoFrenzyFoilImageRef.current === foilImage) {
        flamingoFrenzyFoilImageRef.current = null;
        flamingoFrenzyFoilBoundsRef.current = null;
      }
    };
  }, [boardThemeId, drawFlamingoFrenzyFoil, isRevealed, showMountedClassicScratchBoard]);

  const drawSteamBaronsBountyFoil = useCallback((ctx: CanvasRenderingContext2D, rect: DOMRect) => {
    const zone = getZoneMetricsForLayout(rect, BOARD_LAYOUTS.steam_barons_bounty.zone);

    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius);
    ctx.clip();

    const foilImage = steamBaronsBountyFoilImageRef.current;
    const foilBounds = steamBaronsBountyFoilBoundsRef.current;
    if (foilImage?.complete && foilImage.naturalWidth > 0 && foilBounds) {
      ctx.drawImage(
        foilImage,
        foilBounds.x,
        foilBounds.y,
        foilBounds.width,
        foilBounds.height,
        zone.x,
        zone.y,
        zone.w,
        zone.h
      );
      ctx.restore();
      return;
    }

    const foil = ctx.createLinearGradient(zone.x, zone.y, zone.x, zone.y + zone.h);
    foil.addColorStop(0, "#28150b");
    foil.addColorStop(0.18, "#50301b");
    foil.addColorStop(0.45, "#0f2845");
    foil.addColorStop(0.74, "#0a1d35");
    foil.addColorStop(1, "#081428");
    ctx.fillStyle = foil;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const lanternGlow = ctx.createRadialGradient(
      zone.x + zone.w * 0.5,
      zone.y + zone.h * 0.12,
      0,
      zone.x + zone.w * 0.5,
      zone.y + zone.h * 0.12,
      zone.w * 0.52
    );
    lanternGlow.addColorStop(0, "rgba(255,230,155,0.48)");
    lanternGlow.addColorStop(0.22, "rgba(255,194,93,0.22)");
    lanternGlow.addColorStop(0.58, "rgba(255,194,93,0.04)");
    lanternGlow.addColorStop(1, "rgba(255,194,93,0)");
    ctx.fillStyle = lanternGlow;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const seaGlow = ctx.createRadialGradient(
      zone.x + zone.w * 0.18,
      zone.y + zone.h * 0.92,
      0,
      zone.x + zone.w * 0.18,
      zone.y + zone.h * 0.92,
      zone.w * 0.54
    );
    seaGlow.addColorStop(0, "rgba(96,193,255,0.28)");
    seaGlow.addColorStop(0.42, "rgba(96,193,255,0.1)");
    seaGlow.addColorStop(1, "rgba(96,193,255,0)");
    ctx.fillStyle = seaGlow;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    ctx.strokeStyle = "rgba(240,210,159,0.16)";
    ctx.lineWidth = Math.max(1.2, rect.width * 0.0019);
    for (let x = zone.x + zone.w * 0.08; x < zone.x + zone.w; x += zone.w / 6.2) {
      ctx.beginPath();
      ctx.moveTo(x, zone.y + zone.h * 0.04);
      ctx.lineTo(x, zone.y + zone.h * 0.96);
      ctx.stroke();
    }
    for (let y = zone.y + zone.h * 0.08; y < zone.y + zone.h; y += zone.h / 5.2) {
      ctx.beginPath();
      ctx.moveTo(zone.x + zone.w * 0.04, y);
      ctx.lineTo(zone.x + zone.w * 0.96, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,244,210,0.12)";
    ctx.lineWidth = Math.max(1, rect.width * 0.0016);
    for (let offset = -zone.h; offset < zone.w; offset += zone.w / 7) {
      ctx.beginPath();
      ctx.moveTo(zone.x + offset, zone.y);
      ctx.lineTo(zone.x + offset + zone.h * 0.92, zone.y + zone.h);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,245,214,0.88)";
    for (let i = 0; i < 52; i += 1) {
      const sparkX = zone.x + (((i * 71) % 1000) / 1000) * zone.w;
      const sparkY = zone.y + (((i * 43) % 1000) / 1000) * zone.h;
      const sparkSize = 0.8 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,235,197,0.94)";
    ctx.font = `700 ${Math.max(18, rect.width * 0.047)}px "Segoe UI"`;
    ctx.textAlign = "center";
    ctx.fillText("CHART THE BOUNTY", zone.x + zone.w / 2, zone.y + zone.h * 0.48);
    ctx.fillStyle = "rgba(255,197,105,0.86)";
    ctx.font = `600 ${Math.max(12, rect.width * 0.02)}px "Segoe UI"`;
    ctx.fillText("MATCH 3 RELICS TO CLAIM THE HAUL", zone.x + zone.w / 2, zone.y + zone.h * 0.57);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const foilImage = new window.Image();
    foilImage.src = PIRATES_BURIED_TREASURE_SCRATCH_FOIL_SRC;
    foilImage.onload = () => {
      steamBaronsBountyFoilImageRef.current = foilImage;
      steamBaronsBountyFoilBoundsRef.current = getOpaqueImageBounds(foilImage);
      const canvas = canvasRef.current;
      const wrap = containerRef.current;
      if (!canvas || !wrap || boardThemeId !== "steam_barons_bounty" || !showMountedClassicScratchBoard || isRevealed) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawSteamBaronsBountyFoil(ctx, rect);
    };
    steamBaronsBountyFoilImageRef.current = foilImage;

    return () => {
      if (steamBaronsBountyFoilImageRef.current === foilImage) {
        steamBaronsBountyFoilImageRef.current = null;
        steamBaronsBountyFoilBoundsRef.current = null;
      }
    };
  }, [boardThemeId, drawSteamBaronsBountyFoil, isRevealed, showMountedClassicScratchBoard]);

  const drawSteamBaronsBountyWestFoil = useCallback((ctx: CanvasRenderingContext2D, rect: DOMRect) => {
    const zone = getZoneMetricsForLayout(rect, BOARD_LAYOUTS.steam_barons_bounty_west.zone);

    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius);
    ctx.clip();

    const foilImage = steamBaronsBountyWestFoilImageRef.current;
    const foilBounds = steamBaronsBountyWestFoilBoundsRef.current;
    if (foilImage?.complete && foilImage.naturalWidth > 0 && foilBounds) {
      ctx.drawImage(
        foilImage,
        foilBounds.x,
        foilBounds.y,
        foilBounds.width,
        foilBounds.height,
        zone.x,
        zone.y,
        zone.w,
        zone.h
      );
      ctx.restore();
      return;
    }

    const foil = ctx.createLinearGradient(zone.x, zone.y, zone.x, zone.y + zone.h);
    foil.addColorStop(0, "#efe0bf");
    foil.addColorStop(0.22, "#d7b685");
    foil.addColorStop(0.56, "#8e6332");
    foil.addColorStop(1, "#3e2918");
    ctx.fillStyle = foil;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const glow = ctx.createRadialGradient(
      zone.x + zone.w * 0.52,
      zone.y + zone.h * 0.18,
      0,
      zone.x + zone.w * 0.52,
      zone.y + zone.h * 0.18,
      zone.w * 0.6
    );
    glow.addColorStop(0, "rgba(255,245,213,0.7)");
    glow.addColorStop(0.32, "rgba(255,221,154,0.26)");
    glow.addColorStop(1, "rgba(255,221,154,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    ctx.strokeStyle = "rgba(84, 53, 24, 0.16)";
    ctx.lineWidth = Math.max(1, rect.width * 0.0018);
    for (let offset = -zone.h; offset < zone.w; offset += zone.w / 6.5) {
      ctx.beginPath();
      ctx.moveTo(zone.x + offset, zone.y);
      ctx.lineTo(zone.x + offset + zone.h * 0.9, zone.y + zone.h);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(79,46,21,0.82)";
    for (let i = 0; i < 42; i += 1) {
      const x = zone.x + (((i * 61) % 1000) / 1000) * zone.w;
      const y = zone.y + (((i * 43) % 1000) / 1000) * zone.h;
      const size = 0.7 + (i % 3) * 0.45;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(59,35,17,0.92)";
    ctx.font = `700 ${Math.max(18, rect.width * 0.047)}px "Segoe UI"`;
    ctx.textAlign = "center";
    ctx.fillText("RAISE THE STEAM", zone.x + zone.w / 2, zone.y + zone.h * 0.48);
    ctx.fillStyle = "rgba(104,64,26,0.8)";
    ctx.font = `600 ${Math.max(12, rect.width * 0.02)}px "Segoe UI"`;
    ctx.fillText("MATCH 3 FRONTIER RELICS TO WIN", zone.x + zone.w / 2, zone.y + zone.h * 0.57);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const foilImage = new window.Image();
    foilImage.src = STEAM_BARONS_BOUNTY_WEST_SCRATCH_FOIL_SRC;
    foilImage.onload = () => {
      steamBaronsBountyWestFoilImageRef.current = foilImage;
      steamBaronsBountyWestFoilBoundsRef.current = getOpaqueImageBounds(foilImage);
      const canvas = canvasRef.current;
      const wrap = containerRef.current;
      if (!canvas || !wrap || boardThemeId !== "steam_barons_bounty_west" || !showMountedClassicScratchBoard || isRevealed) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawSteamBaronsBountyWestFoil(ctx, rect);
    };
    steamBaronsBountyWestFoilImageRef.current = foilImage;

    return () => {
      if (steamBaronsBountyWestFoilImageRef.current === foilImage) {
        steamBaronsBountyWestFoilImageRef.current = null;
        steamBaronsBountyWestFoilBoundsRef.current = null;
      }
    };
  }, [boardThemeId, drawSteamBaronsBountyWestFoil, isRevealed, showMountedClassicScratchBoard]);

  const drawBattlescratchFoil = useCallback((ctx: CanvasRenderingContext2D, rect: DOMRect) => {
    const zone = getZoneMetricsForLayout(rect, BOARD_LAYOUTS.battlescratch.zone);
    const layout = BOARD_LAYOUTS.battlescratch;
    const rows = battleTicket?.rows ?? 7;
    const cols = battleTicket?.cols ?? 7;
    const innerX = zone.x + zone.w * layout.innerGrid.xPct;
    const innerY = zone.y + zone.h * layout.innerGrid.yPct;
    const innerW = zone.w * layout.innerGrid.widthPct;
    const innerH = zone.h * layout.innerGrid.heightPct;
    const cellSize = Math.min(innerW / cols, innerH / rows);
    const startX = innerX + (innerW - cellSize * cols) / 2;
    const startY = innerY + (innerH - cellSize * rows) / 2;

    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius);
    ctx.clip();

    const foil = ctx.createLinearGradient(zone.x, zone.y, zone.x, zone.y + zone.h);
    foil.addColorStop(0, "#dcf2ff");
    foil.addColorStop(0.26, "#7fc7ff");
    foil.addColorStop(0.58, "#1f6cb6");
    foil.addColorStop(1, "#072a57");
    ctx.fillStyle = foil;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const radarGlow = ctx.createRadialGradient(
      zone.x + zone.w * 0.5,
      zone.y + zone.h * 0.22,
      0,
      zone.x + zone.w * 0.5,
      zone.y + zone.h * 0.22,
      zone.w * 0.46
    );
    radarGlow.addColorStop(0, "rgba(222,249,255,0.92)");
    radarGlow.addColorStop(0.2, "rgba(163,227,255,0.34)");
    radarGlow.addColorStop(0.54, "rgba(57,176,255,0.12)");
    radarGlow.addColorStop(1, "rgba(57,176,255,0)");
    ctx.fillStyle = radarGlow;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    const plate = ctx.createLinearGradient(zone.x, startY, zone.x, startY + cellSize * rows);
    plate.addColorStop(0, "rgba(221,244,255,0.14)");
    plate.addColorStop(0.48, "rgba(84,167,245,0.08)");
    plate.addColorStop(1, "rgba(10,43,86,0.18)");
    ctx.fillStyle = plate;
    ctx.fillRect(startX, startY, cellSize * cols, cellSize * rows);

    ctx.strokeStyle = "rgba(222,245,255,0.12)";
    ctx.lineWidth = Math.max(1, rect.width * 0.0016);
    for (let x = zone.x + zone.w * 0.02; x < zone.x + zone.w; x += zone.w / 9) {
      ctx.beginPath();
      ctx.moveTo(x, zone.y);
      ctx.lineTo(x, zone.y + zone.h);
      ctx.stroke();
    }
    for (let y = zone.y + zone.h * 0.02; y < zone.y + zone.h; y += zone.h / 9) {
      ctx.beginPath();
      ctx.moveTo(zone.x, y);
      ctx.lineTo(zone.x + zone.w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(1, rect.width * 0.0014);
    for (let offset = -zone.h; offset < zone.w; offset += zone.w / 7.5) {
      ctx.beginPath();
      ctx.moveTo(zone.x + offset, zone.y);
      ctx.lineTo(zone.x + offset + zone.h * 0.9, zone.y + zone.h);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(214,243,255,0.34)";
    ctx.lineWidth = Math.max(1.2, rect.width * 0.002);
    for (let col = 0; col <= cols; col += 1) {
      const x = startX + col * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + cellSize * rows);
      ctx.stroke();
    }
    for (let row = 0; row <= rows; row += 1) {
      const y = startY + row * cellSize;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + cellSize * cols, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(226,246,255,0.78)";
    ctx.font = `700 ${Math.max(10, rect.width * 0.016)}px "Segoe UI"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let col = 0; col < cols; col += 1) {
      ctx.fillText(String(col + 1), startX + cellSize * (col + 0.5), Math.max(zone.y + cellSize * 0.28, startY - cellSize * 0.24));
    }
    ctx.textAlign = "right";
    for (let row = 0; row < rows; row += 1) {
      ctx.fillText(String.fromCharCode(65 + row), Math.max(zone.x + cellSize * 0.18, startX - cellSize * 0.12), startY + cellSize * (row + 0.5));
    }
    ctx.restore();
  }, [battleTicket]);

  useEffect(() => {
    if (!isRevealed) return;
    if (boardThemeId === "close_encounters") {
      playCloseEncountersCue(outcome === "win" ? "win" : outcome === "nearMiss" ? "nearMiss" : "lose");
      return;
    }
    if (outcome !== "win") return;
    if (isMuted || volume <= 0) return;

    const win = winSoundRef.current;
    const sparkle = sparkleSoundRef.current;
    if (win) {
      win.currentTime = 0;
      win.play().catch(() => {});
    }
    if (sparkle) {
      sparkle.currentTime = 0;
      window.setTimeout(() => sparkle.play().catch(() => {}), 90);
    }
  }, [boardThemeId, isMuted, isRevealed, outcome, playCloseEncountersCue, volume]);

  useEffect(() => {
    clearCloseEncountersWinFx();

    if (!showCloseEncountersWinFx) {
      setCeWinFxPhase("idle");
      setCeWinFxValue(0);
      return;
    }

    setCeWinFxValue(0);
    setCeWinFxPhase("hoverIn");

    ceWinFxTimeoutsRef.current.push(
      window.setTimeout(() => {
        setCeWinFxPhase("hoverPause");

        ceWinFxTimeoutsRef.current.push(
          window.setTimeout(() => {
            setCeWinFxPhase("beamIn");

            ceWinFxTimeoutsRef.current.push(
              window.setTimeout(() => {
                setCeWinFxPhase("countUp");

                const start = performance.now();
                const duration = 2200;
                const target = currentWinAmount;

                const step = (now: number) => {
                  const progress = Math.min(1, (now - start) / duration);
                  const eased = 1 - Math.pow(1 - progress, 3);
                  setCeWinFxValue(Math.max(0, Math.round(target * eased)));

                  if (progress < 1) {
                    ceWinFxRafRef.current = window.requestAnimationFrame(step);
                    return;
                  }

                  ceWinFxRafRef.current = null;
                  setCeWinFxValue(target);
                  setCeWinFxPhase("beamOff");

                  ceWinFxTimeoutsRef.current.push(
                    window.setTimeout(() => {
                      setCeWinFxPhase("exit");

                      ceWinFxTimeoutsRef.current.push(
                        window.setTimeout(() => {
                          setCeWinFxPhase("done");
                        }, 900)
                      );
                    }, 1200)
                  );
                };

                ceWinFxRafRef.current = window.requestAnimationFrame(step);
              }, 380)
            );
          }, 420)
        );
      }, 1850)
    );
  }, [clearCloseEncountersWinFx, currentWinAmount, showCloseEncountersWinFx]);

  useEffect(() => {
    clearFlamingoFrenzyWinFx();

    if (!showFlamingoFrenzyWinFx) {
      setFfWinFxPhase("idle");
      setFfWinFxValue(0);
      return;
    }

    setFfWinFxValue(0);
    setFfWinFxPhase("splashIn");

    ffWinFxTimeoutsRef.current.push(
      window.setTimeout(() => {
        setFfWinFxPhase("countUp");

        const start = performance.now();
        const duration = 1650;
        const target = currentWinAmount;

        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setFfWinFxValue(Math.max(0, Math.round(target * eased)));

          if (progress < 1) {
            ffWinFxRafRef.current = window.requestAnimationFrame(step);
            return;
          }

          ffWinFxRafRef.current = null;
          setFfWinFxValue(target);
          setFfWinFxPhase("hero");

          ffWinFxTimeoutsRef.current.push(
            window.setTimeout(() => {
              setFfWinFxPhase("done");
            }, 900)
          );
        };

        ffWinFxRafRef.current = window.requestAnimationFrame(step);
      }, 420)
    );
  }, [clearFlamingoFrenzyWinFx, currentWinAmount, showFlamingoFrenzyWinFx]);

  useEffect(() => {
    clearSteamBaronsBountyWinFx();

    if (!showSteamBaronsBountyWinFx) {
      setSbbWinFxPhase("idle");
      setSbbWinFxValue(0);
      return;
    }

    setSbbWinFxValue(0);
    setSbbWinFxPhase("intro");

    sbbWinFxTimeoutsRef.current.push(
      window.setTimeout(() => {
        setSbbWinFxPhase("countUp");

        const start = performance.now();
        const duration = 1500;
        const target = currentWinAmount;

        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setSbbWinFxValue(Math.max(0, Math.round(target * eased)));

          if (progress < 1) {
            sbbWinFxRafRef.current = window.requestAnimationFrame(step);
            return;
          }

          sbbWinFxRafRef.current = null;
          setSbbWinFxValue(target);
          setSbbWinFxPhase("hero");

          sbbWinFxTimeoutsRef.current.push(
            window.setTimeout(() => {
              setSbbWinFxPhase("done");
            }, 900)
          );
        };

        sbbWinFxRafRef.current = window.requestAnimationFrame(step);
      }, 280)
    );
  }, [clearSteamBaronsBountyWinFx, currentWinAmount, showSteamBaronsBountyWinFx]);

  useEffect(() => {
    clearSteamBaronsBountyWestWinFx();

    if (!showSteamBaronsBountyWestWinFx) {
      setSbwWinFxPhase("idle");
      setSbwWinFxValue(0);
      setSbwWinVideoEnded(false);
      return;
    }

    setSbwWinFxValue(0);
    setSbwWinVideoEnded(false);
    setSbwWinFxPhase("intro");

    sbwWinFxTimeoutsRef.current.push(
      window.setTimeout(() => {
        setSbwWinFxPhase("countUp");

        const start = performance.now();
        const duration = 1500;
        const target = currentWinAmount;

        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setSbwWinFxValue(Math.max(0, Math.round(target * eased)));

          if (progress < 1) {
            sbwWinFxRafRef.current = window.requestAnimationFrame(step);
            return;
          }

          sbwWinFxRafRef.current = null;
          setSbwWinFxValue(target);
          setSbwWinFxPhase("done");
        };

        sbwWinFxRafRef.current = window.requestAnimationFrame(step);
      }, 1000)
    );
  }, [clearSteamBaronsBountyWestWinFx, currentWinAmount, showSteamBaronsBountyWestWinFx]);

  useEffect(() => {
    const video = sbwWinVideoRef.current;
    if (!video) return;

    if (!showSteamBaronsBountyWestWinFx) {
      video.pause();
      video.currentTime = 0;
      return;
    }

    if (sbwWinFxPhase === "intro" || sbwWinFxPhase === "idle") {
      video.pause();
      video.currentTime = 0;
      return;
    }

    if (sbwWinFxPhase !== "countUp") {
      return;
    }

    const playVideo = async () => {
      try {
        video.currentTime = 0;
        await video.play();
      } catch {
        // Ignore autoplay failures; the rest of the win flow should still run.
      }
    };

    void playVideo();
  }, [sbwWinFxPhase, showSteamBaronsBountyWestWinFx]);

  useEffect(() => {
    clearBattlescratchWinFx();

    if (!showBattlescratchWinFx) {
      setBsWinFxPhase("idle");
      setBsWinFxValue(0);
      return;
    }

    setBsWinFxValue(0);
    setBsWinFxPhase("intro");

    bsWinFxTimeoutsRef.current.push(
      window.setTimeout(() => {
        setBsWinFxPhase("countUp");

        const start = performance.now();
        const duration = 1900;
        const target = currentWinAmount;

        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setBsWinFxValue(Math.max(0, Math.round(target * eased)));

          if (progress < 1) {
            bsWinFxRafRef.current = window.requestAnimationFrame(step);
            return;
          }

          bsWinFxRafRef.current = null;
          setBsWinFxValue(target);
          setBsWinFxPhase("done");
        };

        bsWinFxRafRef.current = window.requestAnimationFrame(step);
      }, 300)
    );
  }, [clearBattlescratchWinFx, currentWinAmount, showBattlescratchWinFx]);

  useEffect(() => {
    if (!showBattlescratchSinkVideo) return;
    const video = battleSinkVideoRef.current;
    if (!video) return;

    video.currentTime = 0;
    const attemptPlay = async () => {
      try {
        await video.play();
      } catch {
        // Autoplay can be picky across browsers; the scratching gesture usually unlocks it.
      }
    };

    void attemptPlay();
  }, [activeBattlescratchSinkVideo?.id, showBattlescratchSinkVideo]);

  const getBattlescratchGridMetrics = useCallback(() => {
    if (!battleTicket) return null;
    const wrap = containerRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const zone = getZoneMetrics(rect, "battlescratch");
    const layout = BOARD_LAYOUTS.battlescratch;
    const innerX = zone.x + zone.w * layout.innerGrid.xPct;
    const innerY = zone.y + zone.h * layout.innerGrid.yPct;
    const innerW = zone.w * layout.innerGrid.widthPct;
    const innerH = zone.h * layout.innerGrid.heightPct;
    const cellSize = Math.min(innerW / battleTicket.cols, innerH / battleTicket.rows);
    const startX = innerX + (innerW - cellSize * battleTicket.cols) / 2;
    const startY = innerY + (innerH - cellSize * battleTicket.rows) / 2;
    return { cellSize, startX, startY, rows: battleTicket.rows, cols: battleTicket.cols };
  }, [battleTicket, getZoneMetrics]);

  const getBattlescratchCellFromPoint = useCallback((x: number, y: number) => {
    const metrics = getBattlescratchGridMetrics();
    if (!metrics) return null;

    const col = Math.floor((x - metrics.startX) / metrics.cellSize);
    const row = Math.floor((y - metrics.startY) / metrics.cellSize);
    if (row < 0 || row >= metrics.rows || col < 0 || col >= metrics.cols) return null;
    return { row, col };
  }, [getBattlescratchGridMetrics]);

  const toggleBattlescratchMarker = useCallback((cell: { row: number; col: number }) => {
    if (!battleTicket || battleRevealState.confirmed) return;
    setBattleMarkers((current) => {
      const next = upsertMarker(current, cell, battleTicket);
      const remaining = Math.max(0, battleTicket.allowedTargets - next.length);
      setStatusMessage(
        remaining === 0
          ? "Strike package ready. Confirm launch to begin scratching."
          : `${remaining} strike marker${remaining === 1 ? "" : "s"} remaining before launch.`
      );
      return next;
    });
  }, [battleRevealState.confirmed, battleTicket]);

  const finalizeBattlescratchReveal = useCallback(() => {
    if (!battleTicket || battleRevealState.completed) return;

    const lockedMarkers = setMarkerLocked(battleMarkers, true);
    const resolved = resolveBattlescratchTicketOutcome(battleTicket, lockedMarkers);
    const sinkVideoQueue =
      resolved.sunkShips.length > 0
        ? [...resolved.sunkShips]
            .sort(
              (left, right) =>
                BATTLESCRATCH_SINK_VIDEO_ORDER.indexOf(left.type as (typeof BATTLESCRATCH_SINK_VIDEO_ORDER)[number]) -
                BATTLESCRATCH_SINK_VIDEO_ORDER.indexOf(right.type as (typeof BATTLESCRATCH_SINK_VIDEO_ORDER)[number])
            )
            .map((ship) => ({
              id: ship.id,
              label: ship.label,
              src: BATTLESCRATCH_SINK_VIDEO_BY_TYPE[ship.type as keyof typeof BATTLESCRATCH_SINK_VIDEO_BY_TYPE],
            }))
        : [];

    setBattleMarkers(lockedMarkers);
    setBattleOutcome(resolved);
    setBattleRevealState((current) => completeReveal({ ...current, confirmed: true }, battleTicket, resolved));
    setBattleSinkVideoQueue(sinkVideoQueue);
    setBattleSinkVideoIndex(0);
    setOutcome(resolved.prizeAmount > 0 ? "win" : "lose");
    setWinIndices([]);
    setIsRevealed(true);
    setStatusMessage(
      resolved.prizeAmount > 0
        ? `Strike complete. ${resolved.sunkShips.length} ship${resolved.sunkShips.length === 1 ? "" : "s"} sunk.`
        : "Strike complete. Enemy fleet escaped this round."
    );
  }, [battleMarkers, battleRevealState.completed, battleTicket]);

  const confirmBattlescratchTargets = useCallback(() => {
    if (!battleTicket) return;
    if (battleMarkers.length !== battleTicket.allowedTargets) {
      setStatusMessage(`Arm all ${battleTicket.allowedTargets} strike markers before launch.`);
      return;
    }

    try {
      const lockedMarkers = setMarkerLocked(battleMarkers, true);
      const finalizedTicket = generateTicketForExactMarkers(
        battleTicket.ticketId,
        battleTicket.prizeAmount,
        battleTicket.prizeTier,
        lockedMarkers,
        battleTicket.seed
      );

      setBattleTicket(finalizedTicket);
      setBattleMarkers(lockedMarkers);
      setBattleRevealState((current) => ({ ...current, confirmed: true }));
      setStatusMessage("Strike package locked. Scratch through the foil to reveal hits, misses, and sinking blows.");
    } catch (error: unknown) {
      setStatusMessage(error instanceof Error ? error.message : "Strike package failed validation. Adjust the markers and try again.");
    }
  }, [battleMarkers, battleTicket]);

  useEffect(() => {
    if (!isBattlescratchScratching || !battleTicket || battleMarkers.length !== battleTicket.allowedTargets) return;
    const revealed = new Set(battleRevealState.revealedCells);
    const allMarkersRevealed = battleMarkers.every((marker) => revealed.has(cellKey(marker.row, marker.col)));
    if (allMarkersRevealed) {
      finalizeBattlescratchReveal();
    }
  }, [battleMarkers, battleRevealState.revealedCells, battleTicket, finalizeBattlescratchReveal, isBattlescratchScratching]);

  useEffect(() => {
    if (typeof window === "undefined" || !playerId) return;
    if (!battleTicket) return;
    if (!battleRevealState.completed) {
      window.localStorage.setItem(
        getStorageKey(playerId),
        serializeSession({
          ticket: battleTicket,
          markers: battleMarkers,
          revealState: battleRevealState,
        })
      );
      return;
    }

    window.localStorage.removeItem(getStorageKey(playerId));
  }, [battleMarkers, battleRevealState, battleTicket, playerId]);

  useEffect(() => {
    if (typeof window === "undefined" || !playerId || !tickets.length || battleTicket) return;
    if (battleSessionRestoreCheckedRef.current) return;
    battleSessionRestoreCheckedRef.current = true;
    const storageKey = getStorageKey(playerId);
    const session = deserializeSession(window.localStorage.getItem(storageKey));
    if (!session) return;

    const currentConfig = BATTLESCRATCH_CONFIG_BY_TICKET[session.ticket.ticketId];
    const sessionMatchesCurrentConfig =
      session.ticket.allowedTargets === currentConfig.allowedTargets &&
      session.ticket.rows === currentConfig.rows &&
      session.ticket.cols === currentConfig.cols;

    if (!sessionMatchesCurrentConfig) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    const resumedTicket = tickets.find((ticket) => ticket.id === session.ticket.ticketId);
    setSelectedThemeId("battlescratch");
    setBoardThemeId("battlescratch");
    setSelectedTicketId(session.ticket.ticketId);
    setBoardTicketId(session.ticket.ticketId);
    setBattleTicket(session.ticket);
    setBattleMarkers(session.markers);
    setBattleRevealState(session.revealState);
    setTicketIds([]);
    setWinIndices([]);
    setCurrentCost(resumedTicket?.costCoin ?? currentCost);
    setCurrentWinAmount(session.ticket.prizeAmount);
    setCurrentNet(session.ticket.prizeAmount);
    setOutcome(session.ticket.prizeAmount > 0 ? "win" : "lose");
    setIsRevealed(session.revealState.completed);
    setActiveScratchView("play");
    setStatusMessage(
      session.revealState.completed
        ? "Battlescratch restored. Review the final strike report."
        : session.revealState.confirmed
          ? "Battlescratch restored. Scratch the battle grid to reveal your strike results."
          : "Battlescratch restored. Finish arming your strike markers."
    );
    if (session.revealState.completed) {
      setBattleOutcome(resolveBattlescratchTicketOutcome(session.ticket, setMarkerLocked(session.markers, true)));
    }
  }, [battleTicket, currentCost, playerId, tickets]);

  const revealCrosswordLetter = useCallback(
    (letterBankCellId: string) => {
      if (!crosswordTicket || crosswordClaimPending) return;

      setCrosswordState((current) => {
        const revealed = revealCrosswordLetterCell(crosswordTicket, current, letterBankCellId);
        if (revealed === current) return current;
        const next =
          revealed.revealedLetterBankCellIds.length === crosswordTicket.letterBank.length
            ? checkCrosswordTicket(crosswordTicket, revealed)
            : revealed;
        const revealedLetter = crosswordTicket.letterBank.find((cell) => cell.id === letterBankCellId)?.letter ?? "?";
        const unlockCount = crosswordTicket.boardCells.filter(
          (cell) => cell.isPlayable && cell.letter === revealedLetter && !current.matchedCellIds.includes(cell.id)
        ).length;

        if (next.isComplete) {
          setStatusMessage(
            next.finalPayout > 0
              ? `Crossword complete. ${next.completedWordCount} word${next.completedWordCount === 1 ? "" : "s"} finished. Finalizing payout...`
              : `Crossword complete. ${next.completedWordCount} word${next.completedWordCount === 1 ? "" : "s"} finished.`
          );
        } else if (unlockCount > 0) {
          setStatusMessage(
            `Letter ${revealedLetter} revealed. Tap ${unlockCount} matching ${revealedLetter} cell${
              unlockCount === 1 ? "" : "s"
            } on the board. ${ticketLetterProgress(next.revealedLetterBankCellIds.length, crosswordTicket.letterBank.length)}`
          );
        } else {
          setStatusMessage(
            `Letter ${revealedLetter} revealed. No new ${revealedLetter} spaces are available. ${ticketLetterProgress(
              next.revealedLetterBankCellIds.length,
              crosswordTicket.letterBank.length
            )}`
          );
        }

        return next;
      });
    },
    [crosswordClaimPending, crosswordTicket]
  );

  const markCrosswordCell = useCallback(
    (boardCellId: string) => {
      if (!crosswordTicket || crosswordClaimPending) return;

      setCrosswordState((current) => {
        const next = markCrosswordBoardCell(crosswordTicket, current, boardCellId);
        if (next === current) return current;

        const markedCell = crosswordTicket.boardCells.find((cell) => cell.id === boardCellId);
        const markedLetter = markedCell?.letter ?? "?";

        if (next.isComplete) {
          setStatusMessage(
            next.finalPayout > 0
              ? `Crossword complete. ${next.completedWordCount} word${next.completedWordCount === 1 ? "" : "s"} finished. Finalizing payout...`
              : `Crossword complete. ${next.completedWordCount} word${next.completedWordCount === 1 ? "" : "s"} finished.`
          );
        } else if (next.newlyCompletedWordIds.length) {
          const completedLabels = crosswordTicket.words
            .filter((word) => next.newlyCompletedWordIds.includes(word.id))
            .map((word) => word.text)
            .join(", ");
          setStatusMessage(`Marked ${markedLetter}. Completed ${completedLabels}.`);
        } else {
          setStatusMessage(`Marked ${markedLetter}. ${ticketLetterProgress(next.revealedLetterBankCellIds.length, crosswordTicket.letterBank.length)}`);
        }

        return next;
      });
    },
    [crosswordClaimPending, crosswordTicket]
  );

  const revealAllCrosswordLetters = useCallback(() => {
    if (!crosswordTicket || crosswordClaimPending) return;

    setCrosswordState((current) => {
      const next = revealAllCrosswordLetterCells(crosswordTicket, current);
      if (next === current) return current;

      setStatusMessage(
        next.isComplete
          ? next.finalPayout > 0
            ? `Crossword complete. ${next.completedWordCount} words found. Finalizing payout...`
            : `Crossword complete. ${next.completedWordCount} words found.`
          : `All letters revealed. Tap remaining matches or press Check Ticket to score the board.`
      );

      return next;
    });
  }, [crosswordClaimPending, crosswordTicket]);

  const checkCrosswordBoard = useCallback(() => {
    if (!crosswordTicket || crosswordClaimPending) return;

    setCrosswordState((current) => {
      const next = checkCrosswordTicket(crosswordTicket, current);
      if (next === current) {
        setStatusMessage("No additional completed words were found on this ticket.");
        return current;
      }

      if (next.isComplete) {
        setStatusMessage(
          next.finalPayout > 0
            ? `Ticket checked. ${next.completedWordCount} completed words found. Finalizing payout...`
            : `Ticket checked. ${next.completedWordCount} completed words found.`
        );
      } else if (next.newlyCompletedWordIds.length) {
        const completedLabels = crosswordTicket.words
          .filter((word) => next.newlyCompletedWordIds.includes(word.id))
          .map((word) => word.text)
          .join(", ");
        setStatusMessage(`Ticket checked. Completed ${completedLabels}. ${next.completedWordCount}/${crosswordTicket.words.length} words found.`);
      } else {
        setStatusMessage(`Ticket checked. ${next.completedWordCount}/${crosswordTicket.words.length} words found.`);
      }

      return next;
    });
  }, [crosswordClaimPending, crosswordTicket]);

  useEffect(() => {
    if (!crosswordTicket || !crosswordState.isComplete || crosswordState.rewardGranted || crosswordClaimPending) return;

    setCrosswordClaimPending(true);

    // Assumption: the crossword endpoint reserves the reward on ticket start, then finalizes it here exactly once.
    (async () => {
      try {
        const claim = await apiPost<ClaimCrosswordResponse>("/crossword/claim", {
          sessionId: crosswordTicket.sessionId,
        });

        setCrosswordState((current) => applyCrosswordRewardGrant(current, claim.rewardAmount));
        setBalance(claim.newBalance);
        setCurrentWinAmount(claim.rewardAmount);
        setCurrentNet(claim.net);
        setOutcome(claim.rewardAmount > 0 ? "win" : "lose");
        setIsRevealed(true);
        setStatusMessage(
          claim.rewardAmount > 0
            ? `Crossword locked ${crosswordState.completedWordCount} completed word${crosswordState.completedWordCount === 1 ? "" : "s"} for +${claim.rewardAmount} Points.`
            : `Crossword finished with ${crosswordState.completedWordCount} completed word${crosswordState.completedWordCount === 1 ? "" : "s"}. No prize this round.`
        );
      } catch (error: unknown) {
        setStatusMessage(getErrorMessage(error, "Unable to finalize crossword payout."));
      } finally {
        setCrosswordClaimPending(false);
      }
    })();
  }, [crosswordClaimPending, crosswordState.completedWordCount, crosswordState.isComplete, crosswordState.rewardGranted, crosswordTicket, getErrorMessage]);

  useEffect(() => {
    if (typeof window === "undefined" || !playerId) return;
    if (!crosswordTicket) {
      window.localStorage.removeItem(getCrosswordStorageKey(playerId));
      return;
    }

    if (!crosswordState.rewardGranted) {
      window.localStorage.setItem(
        getCrosswordStorageKey(playerId),
        serializeCrosswordSession({
          version: 1,
          ticket: crosswordTicket,
          state: crosswordState,
        })
      );
      return;
    }

    window.localStorage.removeItem(getCrosswordStorageKey(playerId));
  }, [crosswordState, crosswordTicket, playerId]);

  useEffect(() => {
    if (typeof window === "undefined" || !playerId || !tickets.length || battleTicket || crosswordTicket || reelRevealTicket || theBigScoreTicket || tripleCrownDerbyTicket) return;
    if (crosswordSessionRestoreCheckedRef.current) return;
    crosswordSessionRestoreCheckedRef.current = true;
    const session = deserializeCrosswordSession(window.localStorage.getItem(getCrosswordStorageKey(playerId)));
    if (!session) return;

    const resumedTicket = tickets.find((ticket) => ticket.id === session.ticket.ticketId);
    setSelectedThemeId("crossword");
    setBoardThemeId("crossword");
    setSelectedTicketId(session.ticket.ticketId);
    setBoardTicketId(session.ticket.ticketId);
    lastCrosswordTemplateIdRef.current = getCrosswordTemplateFamilyId(session.ticket.variantId) || null;
    setCrosswordTicket(session.ticket);
    setCrosswordState(session.state);
    setBattleTicket(null);
    setBattleMarkers([]);
    setBattleRevealState(createInitialRevealState());
    setBattleOutcome(null);
    setReelRevealTicket(null);
    setTheBigScoreTicket(null);
    setTripleCrownDerbyTicket(null);
    setTicketIds([]);
    setWinIndices([]);
    setCurrentCost(resumedTicket?.costCoin ?? currentCost);
    setCurrentWinAmount(session.state.rewardGranted ? session.state.finalPayout : 0);
    setCurrentNet(session.state.rewardGranted ? session.state.finalPayout : 0);
    setOutcome(session.state.finalPayout > 0 ? "win" : "lose");
    setIsRevealed(session.state.isComplete && session.state.rewardGranted);
    setActiveScratchView("play");
    setStatusMessage(
      session.state.isComplete
        ? "Crossword restored. Final payout is being confirmed."
        : `Crossword restored. ${ticketLetterProgress(
            session.state.revealedLetterBankCellIds.length,
            session.ticket.letterBank.length
          )} Tap matching letters on the board to claim them.`
    );
  }, [battleTicket, crosswordTicket, currentCost, playerId, reelRevealTicket, theBigScoreTicket, tickets, tripleCrownDerbyTicket]);

  async function dealReelRevealTicket(ticketToBuy: TicketCatalogItem) {
    const selectionSeed =
      typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const result = await apiPost<PlayScratchResponse>("/scratchers/play", { ticketId: ticketToBuy.id });
    const ticket = createReelRevealTicket({
      ticketId: ticketToBuy.id,
      rewardAmount: result.winAmount,
      prizeAmounts: ticketToBuy.prizes,
      sessionId: selectionSeed,
      selectionSeed,
    });
    setSelectedThemeId("reel_reveal");
    setBoardThemeId("reel_reveal");
    setBoardTicketId(ticketToBuy.id);
    setReelRevealTicket(ticket);
    setCrosswordTicket(null);
    setCrosswordState(createInitialCrosswordGameState());
    setCrosswordClaimPending(false);
    setBattleTicket(null);
    setBattleMarkers([]);
    setBattleRevealState(createInitialRevealState());
    setBattleOutcome(null);
    setBattleSinkVideoQueue([]);
    setBattleSinkVideoIndex(0);
    setTheBigScoreTicket(null);
    setTripleCrownDerbyTicket(null);
    setTicketIds([]);
    setWinIndices([]);
    setCurrentCost(result.cost);
    setCurrentWinAmount(result.winAmount);
    setCurrentNet(result.net);
    setBalance(result.newBalance);
    setOutcome(result.winAmount > 0 ? "win" : "lose");
    setIsRevealed(false);
    setCeWinFxPhase("idle");
    setCeWinFxValue(0);
    setFfWinFxPhase("idle");
    setFfWinFxValue(0);
    setSbbWinFxPhase("idle");
    setSbbWinFxValue(0);
    setSbwWinFxPhase("idle");
    setSbwWinFxValue(0);
    setBsWinFxPhase("idle");
    setBsWinFxValue(0);
    setStatusMessage(getThemeScratchPrompt("reel_reveal"));
  }

  async function dealTheBigScoreTicket(ticketToBuy: TicketCatalogItem) {
    const selectionSeed =
      typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const result = await apiPost<PlayScratchResponse>("/the-big-score/play", { ticketId: ticketToBuy.id });
    const ticket = createTheBigScoreTicket({
      ticketId: ticketToBuy.id,
      rewardAmount: result.winAmount,
      prizeAmounts: ticketToBuy.prizes,
      sessionId: selectionSeed,
      selectionSeed,
    });
    setSelectedThemeId("the_big_score");
    setBoardThemeId("the_big_score");
    setBoardTicketId(ticketToBuy.id);
    setTheBigScoreTicket(ticket);
    setReelRevealTicket(null);
    setCrosswordTicket(null);
    setCrosswordState(createInitialCrosswordGameState());
    setCrosswordClaimPending(false);
    setBattleTicket(null);
    setBattleMarkers([]);
    setBattleRevealState(createInitialRevealState());
    setBattleOutcome(null);
    setBattleSinkVideoQueue([]);
    setBattleSinkVideoIndex(0);
    setTripleCrownDerbyTicket(null);
    setTicketIds([]);
    setWinIndices([]);
    setCurrentCost(result.cost);
    setCurrentWinAmount(result.winAmount);
    setCurrentNet(result.net);
    setBalance(result.newBalance);
    setOutcome(result.winAmount > 0 ? "win" : "lose");
    setIsRevealed(false);
    setCeWinFxPhase("idle");
    setCeWinFxValue(0);
    setFfWinFxPhase("idle");
    setFfWinFxValue(0);
    setSbbWinFxPhase("idle");
    setSbbWinFxValue(0);
    setSbwWinFxPhase("idle");
    setSbwWinFxValue(0);
    setBsWinFxPhase("idle");
    setBsWinFxValue(0);
    setStatusMessage(getThemeScratchPrompt("the_big_score"));
  }

  async function dealTripleCrownDerbyTicket(ticketToBuy: TicketCatalogItem) {
    const selectionSeed =
      typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const result = await apiPost<PlayScratchResponse>("/triple-crown-derby/play", { ticketId: ticketToBuy.id });
    const ticket = createTripleCrownDerbyTicket({
      ticketId: ticketToBuy.id,
      rewardAmount: result.winAmount,
      prizeAmounts: getDisplayedTicketPrizes("triple_crown_derby", ticketToBuy.prizes),
      sessionId: selectionSeed,
      selectionSeed,
    });
    setSelectedThemeId("triple_crown_derby");
    setBoardThemeId("triple_crown_derby");
    setBoardTicketId(ticketToBuy.id);
    setTripleCrownDerbyTicket(ticket);
    setReelRevealTicket(null);
    setCrosswordTicket(null);
    setCrosswordState(createInitialCrosswordGameState());
    setCrosswordClaimPending(false);
    setBattleTicket(null);
    setBattleMarkers([]);
    setBattleRevealState(createInitialRevealState());
    setBattleOutcome(null);
    setBattleSinkVideoQueue([]);
    setBattleSinkVideoIndex(0);
    setTheBigScoreTicket(null);
    setTicketIds([]);
    setWinIndices([]);
    setCurrentCost(result.cost);
    setCurrentWinAmount(result.winAmount);
    setCurrentNet(result.net);
    setBalance(result.newBalance);
    setOutcome(result.winAmount > 0 ? "win" : "lose");
    setIsRevealed(false);
    setCeWinFxPhase("idle");
    setCeWinFxValue(0);
    setFfWinFxPhase("idle");
    setFfWinFxValue(0);
    setSbbWinFxPhase("idle");
    setSbbWinFxValue(0);
    setSbwWinFxPhase("idle");
    setSbwWinFxValue(0);
    setBsWinFxPhase("idle");
    setBsWinFxValue(0);
    setStatusMessage(getThemeScratchPrompt("triple_crown_derby"));
  }

  async function buyReelRevealAgain() {
    if (!selectedTicket || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);
    try {
      await dealReelRevealTicket(selectedTicket);
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start Reel Reveal."));
    } finally {
      setBusy(false);
    }
  }

  async function buyTripleCrownDerbyAgain() {
    if (!selectedTicket || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);
    try {
      await dealTripleCrownDerbyTicket(selectedTicket);
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start Triple Crown Derby."));
    } finally {
      setBusy(false);
    }
  }

  async function buyTheBigScoreAgain() {
    if (!selectedTicket || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);
    try {
      await dealTheBigScoreTicket(selectedTicket);
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start The Big Score."));
    } finally {
      setBusy(false);
    }
  }

  async function buyBattlescratchAgain() {
    const ticketToBuy = selectedTicket ?? tickets.find((ticket) => ticket.id === boardTicketId) ?? null;
    if (!ticketToBuy || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);

    try {
      const result = await apiPost<PlayScratchResponse>("/scratchers/play", { ticketId: ticketToBuy.id });
      const ticket = generateBattlescratchTicket(ticketToBuy.id, result.winAmount);
      setSelectedThemeId("battlescratch");
      setBoardThemeId("battlescratch");
      setBoardTicketId(ticketToBuy.id);
      setBattleTicket(ticket);
      setBattleMarkers([]);
      setBattleRevealState(createInitialRevealState());
      setBattleOutcome(null);
      setBattleSinkVideoQueue([]);
      setBattleSinkVideoIndex(0);
      setTicketIds([]);
      setWinIndices([]);
      setCrosswordTicket(null);
      setCrosswordState(createInitialCrosswordGameState());
      setCrosswordClaimPending(false);
      setReelRevealTicket(null);
      setTheBigScoreTicket(null);
      setTripleCrownDerbyTicket(null);
      setCurrentCost(result.cost);
      setCurrentWinAmount(result.winAmount);
      setCurrentNet(result.net);
      setBalance(result.newBalance);
      setOutcome(result.winAmount > 0 ? "win" : "lose");
      setIsRevealed(false);
      setCeWinFxPhase("idle");
      setCeWinFxValue(0);
      setFfWinFxPhase("idle");
      setFfWinFxValue(0);
      setSbbWinFxPhase("idle");
      setSbbWinFxValue(0);
      setSbwWinFxPhase("idle");
      setSbwWinFxValue(0);
      setBsWinFxPhase("idle");
      setBsWinFxValue(0);
      setStatusMessage(getThemeScratchPrompt("battlescratch"));
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start Battlescratch."));
    } finally {
      setBusy(false);
    }
  }

  async function buySteamBaronsBountyWestAgain() {
    const ticketToBuy = selectedTicket ?? tickets.find((ticket) => ticket.id === boardTicketId) ?? null;
    if (!ticketToBuy || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);

    try {
      const result = await apiPost<PlayScratchResponse>("/scratchers/play", { ticketId: ticketToBuy.id });
      const visual = generateTicketVisual(result.winAmount, getThemeSymbolPool("steam_barons_bounty_west"));
      setSelectedThemeId("steam_barons_bounty_west");
      setBoardThemeId("steam_barons_bounty_west");
      setBoardTicketId(ticketToBuy.id);
      setTicketIds(visual.ids);
      setOutcome(visual.outcome);
      setWinIndices(visual.winIndices);
      setBattleTicket(null);
      setBattleMarkers([]);
      setBattleRevealState(createInitialRevealState());
      setBattleOutcome(null);
      setCrosswordTicket(null);
      setCrosswordState(createInitialCrosswordGameState());
      setCrosswordClaimPending(false);
      setReelRevealTicket(null);
      setTheBigScoreTicket(null);
      setTripleCrownDerbyTicket(null);
      setCurrentCost(result.cost);
      setCurrentWinAmount(result.winAmount);
      setCurrentNet(result.net);
      setBalance(result.newBalance);
      setIsRevealed(false);
      setCeWinFxPhase("idle");
      setCeWinFxValue(0);
      setFfWinFxPhase("idle");
      setFfWinFxValue(0);
      setSbbWinFxPhase("idle");
      setSbbWinFxValue(0);
      setSbwWinFxPhase("idle");
      setSbwWinFxValue(0);
      setSbwWinVideoEnded(false);
      setBsWinFxPhase("idle");
      setBsWinFxValue(0);
      setStatusMessage(getThemeScratchPrompt("steam_barons_bounty_west"));
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start Steam Baron's Bounty."));
    } finally {
      setBusy(false);
    }
  }

  async function buySteamBaronsBountyAgain() {
    const ticketToBuy = selectedTicket ?? tickets.find((ticket) => ticket.id === boardTicketId) ?? null;
    if (!ticketToBuy || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);

    try {
      const result = await apiPost<PlayScratchResponse>("/scratchers/play", { ticketId: ticketToBuy.id });
      const visual = generateTicketVisual(result.winAmount, getThemeSymbolPool("steam_barons_bounty"));
      setSelectedThemeId("steam_barons_bounty");
      setBoardThemeId("steam_barons_bounty");
      setBoardTicketId(ticketToBuy.id);
      setTicketIds(visual.ids);
      setOutcome(visual.outcome);
      setWinIndices(visual.winIndices);
      setBattleTicket(null);
      setBattleMarkers([]);
      setBattleRevealState(createInitialRevealState());
      setBattleOutcome(null);
      setBattleSinkVideoQueue([]);
      setBattleSinkVideoIndex(0);
      setCrosswordTicket(null);
      setCrosswordState(createInitialCrosswordGameState());
      setCrosswordClaimPending(false);
      setReelRevealTicket(null);
      setTheBigScoreTicket(null);
      setTripleCrownDerbyTicket(null);
      setCurrentCost(result.cost);
      setCurrentWinAmount(result.winAmount);
      setCurrentNet(result.net);
      setBalance(result.newBalance);
      setIsRevealed(false);
      setCeWinFxPhase("idle");
      setCeWinFxValue(0);
      setFfWinFxPhase("idle");
      setFfWinFxValue(0);
      setSbbWinFxPhase("idle");
      setSbbWinFxValue(0);
      setSbwWinFxPhase("idle");
      setSbwWinFxValue(0);
      setBsWinFxPhase("idle");
      setBsWinFxValue(0);
      setStatusMessage(getThemeScratchPrompt("steam_barons_bounty"));
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start Pirates Buried Treasure."));
    } finally {
      setBusy(false);
    }
  }

  async function buyCloseEncountersAgain() {
    if (!selectedTicket || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);
    try {
      const result = await apiPost<PlayScratchResponse>("/scratchers/play", { ticketId: selectedTicket.id });
      const visual = generateTicketVisual(result.winAmount, getThemeSymbolPool("close_encounters"));
      setSelectedThemeId("close_encounters");
      setBoardThemeId("close_encounters");
      setBoardTicketId(selectedTicket.id);
      setTicketIds(visual.ids);
      setOutcome(visual.outcome);
      setWinIndices(visual.winIndices);
      setBattleTicket(null);
      setBattleMarkers([]);
      setBattleRevealState(createInitialRevealState());
      setBattleOutcome(null);
      setBattleSinkVideoQueue([]);
      setBattleSinkVideoIndex(0);
      setCrosswordTicket(null);
      setCrosswordState(createInitialCrosswordGameState());
      setCrosswordClaimPending(false);
      setReelRevealTicket(null);
      setTheBigScoreTicket(null);
      setTripleCrownDerbyTicket(null);
      setCurrentCost(result.cost);
      setCurrentWinAmount(result.winAmount);
      setCurrentNet(result.net);
      setBalance(result.newBalance);
      setIsRevealed(false);
      setCeWinFxPhase("idle");
      setCeWinFxValue(0);
      setFfWinFxPhase("idle");
      setFfWinFxValue(0);
      setSbbWinFxPhase("idle");
      setSbbWinFxValue(0);
      setSbwWinFxPhase("idle");
      setSbwWinFxValue(0);
      setBsWinFxPhase("idle");
      setBsWinFxValue(0);
      playCloseEncountersCue("buy");
      setStatusMessage(getThemeScratchPrompt("close_encounters"));
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start Close Encounters."));
    } finally {
      setBusy(false);
    }
  }

  async function buyFlamingoFrenzyAgain() {
    if (!selectedTicket || busy) return;

    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    clearBattlescratchSinkVideoSequence();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setStatusMessage(`Opening ${selectedTheme.title}...`);
    try {
      const result = await apiPost<PlayScratchResponse>("/scratchers/play", { ticketId: selectedTicket.id });
      const visual = generateTicketVisual(result.winAmount, getThemeSymbolPool("flamingo_frenzy"));
      setSelectedThemeId("flamingo_frenzy");
      setBoardThemeId("flamingo_frenzy");
      setBoardTicketId(selectedTicket.id);
      setTicketIds(visual.ids);
      setOutcome(visual.outcome);
      setWinIndices(visual.winIndices);
      setBattleTicket(null);
      setBattleMarkers([]);
      setBattleRevealState(createInitialRevealState());
      setBattleOutcome(null);
      setBattleSinkVideoQueue([]);
      setBattleSinkVideoIndex(0);
      setCrosswordTicket(null);
      setCrosswordState(createInitialCrosswordGameState());
      setCrosswordClaimPending(false);
      setReelRevealTicket(null);
      setTheBigScoreTicket(null);
      setTripleCrownDerbyTicket(null);
      setCurrentCost(result.cost);
      setCurrentWinAmount(result.winAmount);
      setCurrentNet(result.net);
      setBalance(result.newBalance);
      setIsRevealed(false);
      setCeWinFxPhase("idle");
      setCeWinFxValue(0);
      setFfWinFxPhase("idle");
      setFfWinFxValue(0);
      setSbbWinFxPhase("idle");
      setSbbWinFxValue(0);
      setSbwWinFxPhase("idle");
      setSbwWinFxValue(0);
      setBsWinFxPhase("idle");
      setBsWinFxValue(0);
      setStatusMessage(getThemeScratchPrompt("flamingo_frenzy"));
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start Flamingo Frenzy."));
    } finally {
      setBusy(false);
    }
  }

  const getScratchZoneCss = useCallback(() => {
    const wrap = containerRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    return getZoneMetricsForLayout(rect, BOARD_LAYOUTS[boardThemeId].zone);
  }, [boardThemeId]);

  function getCtxCss() {
    const canvas = canvasRef.current;
    const wrap = containerRef.current;
    if (!canvas || !wrap) return null;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const metrics = canvasMetricsRef.current;
    if (!metrics) return null;

    return { ctx, rect: metrics.rect, dpr: metrics.dpr };
  }

  function syncCanvasMetrics() {
    const canvas = canvasRef.current;
    const wrap = containerRef.current;
    if (!canvas || !wrap) return null;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasMetricsRef.current = { rect, dpr };

    return { ctx, rect, dpr };
  }

  function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function getLocalPoint(event: PointerEvent) {
    const wrap = containerRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  const eraseScratchPath = useCallback((x: number, y: number) => {
    const hasClassicTicket = ticketIds.length === GRID_SIZE;
    const canScratchBattlescratch = Boolean(battleTicket) && battleRevealState.confirmed && !battleRevealState.completed;
    if (isRevealed || (!hasClassicTicket && !canScratchBattlescratch)) return;
    const zone = getScratchZoneCss();
    const got = getCtxCss();
    if (!zone || !got) return;

    const { ctx, rect } = got;
    const radius = Math.max(18, rect.width * 0.035);
    const from = lastScratchPointRef.current ?? { x, y };

    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius);
    ctx.clip();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = radius * 2;
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    lastScratchPointRef.current = { x, y };
    if (canScratchBattlescratch) {
      const cell = getBattlescratchCellFromPoint(x, y);
      if (cell) {
        setBattleRevealState((current) => applyScratchToCell(current, cell));
      }
    }
  }, [battleRevealState.completed, battleRevealState.confirmed, battleTicket, getBattlescratchCellFromPoint, getScratchZoneCss, isRevealed, ticketIds.length]);

  const estimateScratchedRatioInZone = useCallback(() => {
    const zone = getScratchZoneCss();
    const got = getCtxCss();
    if (!zone || !got) return 0;

    const { ctx, dpr } = got;
    const sx = Math.max(0, Math.floor(zone.x * dpr));
    const sy = Math.max(0, Math.floor(zone.y * dpr));
    const sw = Math.max(1, Math.floor(zone.w * dpr));
    const sh = Math.max(1, Math.floor(zone.h * dpr));
    const imageData = ctx.getImageData(sx, sy, sw, sh).data;

    let transparent = 0;
    const step = 16;
    for (let i = 3; i < imageData.length; i += 4 * step) {
      if (imageData[i] === 0) transparent += 1;
    }

    const total = Math.floor(imageData.length / (4 * step));
    return total ? transparent / total : 0;
  }, [getScratchZoneCss]);

  const finishScratch = useCallback(() => {
    const hasClassicTicket = ticketIds.length === GRID_SIZE;
    const hasBattlescratchTicket = Boolean(battleTicket);
    if (isRevealed || (!hasClassicTicket && !hasBattlescratchTicket)) return;
    const zone = getScratchZoneCss();
    const got = getCtxCss();
    if (!zone || !got) return;

    const { ctx } = got;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    roundedRectPath(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius);
    ctx.fill();
    ctx.restore();
    if (hasBattlescratchTicket) {
      finalizeBattlescratchReveal();
      return;
    }
    setIsRevealed(true);
  }, [battleTicket, finalizeBattlescratchReveal, getScratchZoneCss, isRevealed, ticketIds.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateCanvasMetrics = () => {
      syncCanvasMetrics();
      setLayoutVersion((value) => value + 1);
    };

    updateCanvasMetrics();
    window.addEventListener("resize", updateCanvasMetrics);
    return () => {
      window.removeEventListener("resize", updateCanvasMetrics);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !showMountedClassicScratchBoard &&
      !showSelectedCrosswordBoard &&
      !showSelectedReelRevealBoard &&
      !showSelectedTripleCrownDerbyBoard
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!containerRef.current) return;
      syncCanvasMetrics();
      setLayoutVersion((value) => value + 1);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    boardThemeId,
    showMountedClassicScratchBoard,
    showSelectedCrosswordBoard,
    showSelectedReelRevealBoard,
    showSelectedTripleCrownDerbyBoard,
    ticketIds.length,
    battleTicket?.ticketId,
    crosswordTicket?.ticketId,
    reelRevealTicket?.ticketId,
    tripleCrownDerbyTicket?.ticketId,
  ]);

  useEffect(() => {
    if (!showMountedClassicScratchBoard) return;

    const canvas = canvasRef.current;
    const wrap = containerRef.current;
    if (!canvas || !wrap) return;

    const got = syncCanvasMetrics();
    if (!got) return;
    const { ctx, rect } = got;
    ctx.clearRect(0, 0, rect.width, rect.height);
    if ((ticketIds.length !== GRID_SIZE && !isBattlescratchBoard) || isRevealed) return;

    if (boardThemeId === "close_encounters") {
      drawCloseEncountersFoil(ctx, rect);
      return;
    }
    if (boardThemeId === "flamingo_frenzy") {
      drawFlamingoFrenzyFoil(ctx, rect);
      return;
    }
    if (boardThemeId === "steam_barons_bounty") {
      drawSteamBaronsBountyFoil(ctx, rect);
      return;
    }
    if (boardThemeId === "steam_barons_bounty_west") {
      drawSteamBaronsBountyWestFoil(ctx, rect);
      return;
    }
    if (boardThemeId === "battlescratch") {
      drawBattlescratchFoil(ctx, rect);
      return;
    }

    return undefined;
  }, [
    boardThemeId,
    drawBattlescratchFoil,
    drawCloseEncountersFoil,
    drawFlamingoFrenzyFoil,
    drawSteamBaronsBountyFoil,
    drawSteamBaronsBountyWestFoil,
    isBattlescratchBoard,
    isRevealed,
    layoutVersion,
    showMountedClassicScratchBoard,
    ticketIds.length,
  ]);

  useEffect(() => {
    if (!showMountedClassicScratchBoard) return;

    const wrap = containerRef.current;
    if (!wrap) return;

    const onDown = (event: PointerEvent) => {
      if (!audioUnlockedRef.current) {
        audioUnlockedRef.current = true;
        ensureAudioContext();
        const win = winSoundRef.current;
        const sparkle = sparkleSoundRef.current;
        if (win) {
          win.muted = true;
          win.play().then(() => {
            win.pause();
            win.currentTime = 0;
            win.muted = isMuted;
            win.volume = volume;
          }).catch(() => {});
        }
        if (sparkle) {
          sparkle.muted = true;
          sparkle.play().then(() => {
            sparkle.pause();
            sparkle.currentTime = 0;
            sparkle.muted = isMuted;
            sparkle.volume = volume;
          }).catch(() => {});
        }
      }

      const point = getLocalPoint(event);
      if (ticketIds.length !== GRID_SIZE && !isBattlescratchScratching) return;

      isDownRef.current = true;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      lastScratchPointRef.current = point;
      if (boardThemeId === "close_encounters") {
        const now = Date.now();
        if (now - lastScratchFxAtRef.current > 120) {
          playCloseEncountersCue("scratch");
          lastScratchFxAtRef.current = now;
        }
      }
      eraseScratchPath(point.x, point.y);
    };

    const onMove = (event: PointerEvent) => {
      if (!isDownRef.current) return;
      const point = getLocalPoint(event);
      eraseScratchPath(point.x, point.y);
      if (estimateScratchedRatioInZone() >= AUTO_FINISH_THRESHOLD) finishScratch();
    };

    const onUp = () => {
      isDownRef.current = false;
      lastScratchPointRef.current = null;
    };

    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [battleRevealState.confirmed, battleTicket, boardThemeId, ensureAudioContext, eraseScratchPath, estimateScratchedRatioInZone, finishScratch, getBattlescratchCellFromPoint, isBattlescratchScratching, isMuted, playCloseEncountersCue, showMountedClassicScratchBoard, ticketIds.length, toggleBattlescratchMarker, volume]);

  async function buyTicket(themeIdOverride?: ThemeId, options?: { launchFlow?: boolean }) {
    if (!selectedTicket) return false;

    const themeIdToPlay = themeIdOverride ?? selectedThemeId;
    const themeToPlay = THEME_OPTIONS.find((theme) => theme.id === themeIdToPlay) ?? selectedTheme;
    const launchFlow = Boolean(options?.launchFlow);

    if (launchFlow) {
      const nextLaunchId = compactLaunchCounterRef.current + 1;
      compactLaunchCounterRef.current = nextLaunchId;
      setActiveCompactLaunchId(nextLaunchId);
      updateMobileGameStage("splash");
    } else {
      setActiveCompactLaunchId(null);
    }
    setBusy(true);
    clearCloseEncountersWinFx();
    clearFlamingoFrenzyWinFx();
    clearSteamBaronsBountyWinFx();
    clearSteamBaronsBountyWestWinFx();
    clearBattlescratchWinFx();
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("play");
    setSelectedThemeId(themeIdToPlay);
    setStatusMessage(`Opening ${themeToPlay.title}...`);
    try {
      if (themeIdToPlay === "crossword") {
        const selectionSeed =
          typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        const result = await apiPost<StartCrosswordResponse>("/crossword/start", { ticketId: selectedTicket.id });
        const ticket = createCrosswordTicket({
          ticketId: result.ticketId,
          rewardAmount: result.winAmount,
          sessionId: result.sessionId,
          selectionSeed,
          avoidTemplateFamilyId: lastCrosswordTemplateIdRef.current,
        });
        lastCrosswordTemplateIdRef.current = getCrosswordTemplateFamilyId(ticket.variantId) || null;
        setBoardThemeId(themeIdToPlay);
        setBoardTicketId(selectedTicket.id);
        setCrosswordTicket(ticket);
        setCrosswordState(createInitialCrosswordGameState());
        setCrosswordClaimPending(false);
        setReelRevealTicket(null);
        setTheBigScoreTicket(null);
        setTripleCrownDerbyTicket(null);
        setTicketIds([]);
        setWinIndices([]);
        setBattleTicket(null);
        setBattleMarkers([]);
        setBattleRevealState(createInitialRevealState());
        setBattleOutcome(null);
        setBattleSinkVideoQueue([]);
        setBattleSinkVideoIndex(0);
        setCurrentCost(result.cost);
        setCurrentWinAmount(0);
        setCurrentNet(result.net);
        setBalance(result.newBalance);
        setOutcome(result.winAmount > 0 ? "win" : "lose");
        setIsRevealed(false);
        setCeWinFxPhase("idle");
        setCeWinFxValue(0);
        setFfWinFxPhase("idle");
        setFfWinFxValue(0);
        setSbbWinFxPhase("idle");
        setSbbWinFxValue(0);
        setSbwWinFxPhase("idle");
        setSbwWinFxValue(0);
        setBsWinFxPhase("idle");
        setBsWinFxValue(0);
        setStatusMessage(getThemeScratchPrompt(themeIdToPlay));
        return true;
      }

      if (themeIdToPlay === "reel_reveal") {
        await dealReelRevealTicket(selectedTicket);
        return true;
      }

      if (themeIdToPlay === "the_big_score") {
        await dealTheBigScoreTicket(selectedTicket);
        return true;
      }

      if (themeIdToPlay === "triple_crown_derby") {
        await dealTripleCrownDerbyTicket(selectedTicket);
        return true;
      }

      const result = await apiPost<PlayScratchResponse>("/scratchers/play", { ticketId: selectedTicket.id });
      setBoardThemeId(themeIdToPlay);
      setBoardTicketId(selectedTicket.id);
      if (themeIdToPlay === "battlescratch") {
        const ticket = generateBattlescratchTicket(selectedTicket.id, result.winAmount);
        setBattleTicket(ticket);
        setBattleMarkers([]);
        setBattleRevealState(createInitialRevealState());
        setBattleOutcome(null);
        setBattleSinkVideoQueue([]);
        setBattleSinkVideoIndex(0);
        setTicketIds([]);
        setWinIndices([]);
        setOutcome(result.winAmount > 0 ? "win" : "lose");
        setCrosswordTicket(null);
        setCrosswordState(createInitialCrosswordGameState());
        setCrosswordClaimPending(false);
        setReelRevealTicket(null);
        setTheBigScoreTicket(null);
        setTripleCrownDerbyTicket(null);
      } else {
        const visual = generateTicketVisual(result.winAmount, getThemeSymbolPool(themeIdToPlay));
        setTicketIds(visual.ids);
        setOutcome(visual.outcome);
        setWinIndices(visual.winIndices);
        setBattleTicket(null);
        setBattleMarkers([]);
        setBattleRevealState(createInitialRevealState());
        setBattleOutcome(null);
        setBattleSinkVideoQueue([]);
        setBattleSinkVideoIndex(0);
        setCrosswordTicket(null);
        setCrosswordState(createInitialCrosswordGameState());
        setCrosswordClaimPending(false);
        setReelRevealTicket(null);
        setTheBigScoreTicket(null);
        setTripleCrownDerbyTicket(null);
      }
      setCurrentCost(result.cost);
      setCurrentWinAmount(result.winAmount);
      setCurrentNet(result.net);
      setBalance(result.newBalance);
      setIsRevealed(false);
      setCeWinFxPhase("idle");
      setCeWinFxValue(0);
      setFfWinFxPhase("idle");
      setFfWinFxValue(0);
      setSbbWinFxPhase("idle");
      setSbbWinFxValue(0);
      setSbwWinFxPhase("idle");
      setSbwWinFxValue(0);
      setBsWinFxPhase("idle");
      setBsWinFxValue(0);
      if (themeIdToPlay === "close_encounters") {
        playCloseEncountersCue("buy");
      }
      setStatusMessage(getThemeScratchPrompt(themeIdToPlay));
      return true;
    } catch (error: unknown) {
      setStatusMessage(getErrorMessage(error, "Unable to start ticket."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function chooseTicket(ticketId: TicketId) {
    setSelectedTicketId(ticketId);
    setIsTicketMenuOpen(false);
  }

  function openTicketBrowse(themeId?: ThemeId) {
    if (themeId) {
      setSelectedThemeId(themeId);
      setStatusMessage(getThemeSelectionPrompt(themeId));
    }
    setIsReplaySheetOpen(false);
    setIsTicketMenuOpen(false);
    setActiveScratchView("tickets");
  }

  function renderTicketBrowseCard(theme: ThemeOption) {
    const active = theme.id === selectedThemeId;

    return (
      <div
        key={`browse-${theme.id}`}
        className={`group rounded-[28px] border p-4 transition ${
          active
            ? "border-[color:var(--panel-border-strong)] bg-[color:var(--panel)] shadow-[var(--shadow-md)]"
            : "border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] hover:bg-[color:var(--panel)]"
        }`}
      >
        <button
          type="button"
          onClick={() => openTicketBrowse(theme.id)}
          className="block w-full text-left"
          aria-label={`Preview ${theme.title}`}
        >
          <div className="relative aspect-[1.26/0.84] w-full overflow-hidden rounded-[22px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)]">
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.accentClass} opacity-[0.1] transition group-hover:opacity-[0.16]`} />
            <Image
              src={theme.logoSrc}
              alt={theme.title}
              fill
              unoptimized
              sizes="420px"
              className="object-contain p-4"
              style={{
                objectPosition: theme.hubArtPosition,
                transform: `scale(${theme.hubArtScale})`,
              }}
            />
          </div>
          <div className="mt-4 text-xl font-semibold text-[color:var(--foreground-strong)]">{theme.title}</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setIsReplaySheetOpen(false);
            setIsTicketMenuOpen(false);
            setActiveCompactLaunchId(null);
            setSelectedThemeId(theme.id);
            setStatusMessage(getThemeSelectionPrompt(theme.id));
            setActiveScratchView("play");
          }}
          className={`mt-4 w-full rounded-[18px] bg-gradient-to-r ${theme.accentClass} px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_50px_rgba(87,236,214,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          Play Now
        </button>
      </div>
    );
  }

  function renderCompactTicketBrowseCard(theme: ThemeOption) {
    const active = theme.id === selectedThemeId;

    return (
      <div
        key={`mobile-browse-${theme.id}`}
        className={`min-w-0 rounded-[22px] border p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition ${
          active
            ? "border-[color:var(--panel-border-strong)] bg-[color:var(--panel)]"
            : "border-[color:var(--panel-border)] bg-[color:var(--panel-strong)]"
        }`}
      >
        <button
          type="button"
          onClick={() => void buyTicket(theme.id, { launchFlow: true })}
          disabled={busy || !browseCatalogTicket}
          className={`group relative block w-full overflow-hidden rounded-[16px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] text-left transition hover:border-[color:var(--panel-border-strong)] hover:bg-[color:var(--panel)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)] disabled:cursor-not-allowed disabled:opacity-60 ${
            active ? "ring-1 ring-[color:var(--panel-border-strong)]" : ""
          }`}
          aria-label={`Play ${theme.title}`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${theme.accentClass} opacity-[0.12] transition group-hover:opacity-[0.18]`} />
          <div className="relative aspect-[1.08/0.82] w-full">
            <Image
              src={theme.logoSrc}
              alt={theme.title}
              fill
              unoptimized
              sizes="180px"
              className="object-contain p-2"
              style={{
                objectPosition: theme.hubArtPosition,
                transform: `scale(${theme.mobileTileScale ?? 1})`,
              }}
            />
          </div>
        </button>
      </div>
    );
  }

  function renderThemeHomeScreen(theme: ThemeOption) {
    const splashConfig = WEB_GAME_SPLASH_CONFIG_BY_THEME[theme.id];

    if (!splashConfig.enabled || isCompactViewport) {
      return null;
    }

    if (splashConfig.enabled) {
      return (
        <WebGameSplash
          accentClass={theme.accentClass}
          balance={balance}
          busy={busy}
          canPlay={Boolean(promptTicket) && canReplayTicket}
          config={splashConfig}
          cta={theme.cta}
          description={theme.description}
          eyebrow={theme.eyebrow}
          isMuted={isMuted}
          logoAlt={theme.logoAlt}
          logoSrc={theme.logoSrc}
          onPlayNow={() => {
            void buyTicket();
          }}
          onToggleSound={() => setIsMuted((value) => !value)}
          title={theme.title}
        />
      );
    }

    return null;
  }

  const resultBanner = useMemo(() => {
    if (!isRevealed) return null;
    if (boardThemeId === "battlescratch") return null;
    if (boardThemeId === "crossword") return null;
    if (boardThemeId === "reel_reveal") return null;
    if (boardThemeId === "triple_crown_derby") return null;
    if (showCloseEncountersResultCard) return null;
    if (showFlamingoFrenzyWinFx) return null;
    if (showFlamingoFrenzyLoseCard) return null;
    if (showSteamBaronsBountyWinFx) return null;
    if (showSteamBaronsBountyLoseCard) return null;
    if (showSteamBaronsBountyWestWinFx) return null;
    if (showSteamBaronsBountyWestLoseCard) return null;
    if (showBattlescratchWinFx) return null;
    if (outcome === "win") return `Winner! +${currentWinAmount} Points.`;
    if (outcome === "nearMiss") return "Close call. No prize on this ticket.";
    return "Not a winner this time.";
  }, [boardThemeId, currentWinAmount, isRevealed, outcome, showBattlescratchWinFx, showCloseEncountersResultCard, showFlamingoFrenzyLoseCard, showFlamingoFrenzyWinFx, showSteamBaronsBountyLoseCard, showSteamBaronsBountyWinFx, showSteamBaronsBountyWestLoseCard, showSteamBaronsBountyWestWinFx]);

  const cellRects = (() => {
    const wrap = containerRef.current;
    if (!wrap) return [] as CellRect[];
    const rect = wrap.getBoundingClientRect();
    const zone = getZoneMetrics(rect);
    const innerX = zone.x + zone.w * boardLayout.innerGrid.xPct;
    const innerY = zone.y + zone.h * boardLayout.innerGrid.yPct;
    const innerW = zone.w * boardLayout.innerGrid.widthPct;
    const innerH = zone.h * boardLayout.innerGrid.heightPct;
    const cellW = innerW / 4;
    const cellH = innerH / 4;
    const size = Math.min(cellW, cellH);

    return Array.from({ length: GRID_SIZE }, (_, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      return {
        x: innerX + col * cellW + (cellW - size) / 2,
        y: innerY + row * cellH + (cellH - size) / 2,
        size,
      };
    });
  })();

  const battleCellRects = (() => {
    if (!battleTicket) return [] as Array<CellRect & { row: number; col: number; key: string }>;
    const wrap = containerRef.current;
    if (!wrap) return [] as Array<CellRect & { row: number; col: number; key: string }>;
    const rect = wrap.getBoundingClientRect();
    const zone = getZoneMetrics(rect, "battlescratch");
    const layout = BOARD_LAYOUTS.battlescratch;
    const innerX = zone.x + zone.w * layout.innerGrid.xPct;
    const innerY = zone.y + zone.h * layout.innerGrid.yPct;
    const innerW = zone.w * layout.innerGrid.widthPct;
    const innerH = zone.h * layout.innerGrid.heightPct;
    const cellSize = Math.min(innerW / battleTicket.cols, innerH / battleTicket.rows);
    const startX = innerX + (innerW - cellSize * battleTicket.cols) / 2;
    const startY = innerY + (innerH - cellSize * battleTicket.rows) / 2;

    return Array.from({ length: battleTicket.rows * battleTicket.cols }, (_, index) => {
      const row = Math.floor(index / battleTicket.cols);
      const col = index % battleTicket.cols;
      return {
        row,
        col,
        key: cellKey(row, col),
        x: startX + col * cellSize,
        y: startY + row * cellSize,
        size: cellSize,
      };
    });
  })();

  const battleCells = useMemo(
    () => (battleTicket ? buildCellMap(battleTicket, battleMarkers, battleRevealState) : []),
    [battleMarkers, battleRevealState, battleTicket]
  );
  const battleSunkShipIds = useMemo(() => new Set(battleOutcome?.shipsSunk ?? []), [battleOutcome]);
  const battleTargetKeys = useMemo(
    () => new Set(battleMarkers.map((marker) => cellKey(marker.row, marker.col))),
    [battleMarkers]
  );
  const battleShipById = useMemo(
    () => new Map((battleTicket?.ships ?? []).map((ship) => [ship.id, ship])),
    [battleTicket]
  );
  const battlescratchWinTitle = useMemo(() => {
    if (!battleOutcome || battleOutcome.prizeAmount <= 0) return "Victory Transmission";
    if (battleOutcome.sunkShips.length >= 2) return "Fleet Neutralized";
    if (battleOutcome.sunkShips.length === 1) return `${battleOutcome.sunkShips[0].label} Sunk`;
    return "Strike Confirmed";
  }, [battleOutcome]);

  if (showCompactBrowseLayout) {
    return (
      <MobileAppShell
        navItems={mobileNavItems}
        contentClassName="pb-[max(6.75rem,calc(5.75rem+env(safe-area-inset-bottom)))]"
        header={<MobilePageHeader title="Tickets" balance={balance} onBack={() => router.push("/home")} />}
      >
        <div className="mt-1 grid gap-3">
          {THEME_OPTIONS.map((theme) => renderCompactTicketBrowseCard(theme))}
        </div>
      </MobileAppShell>
    );
  }
  const renderBattlescratchTargetMarker = (isLocked: boolean, isTopLayer = false) => (
    <div className={`bs-target-marker ${isTopLayer ? "bs-target-marker-top" : ""} ${isLocked ? "bs-target-marker-locked" : ""}`}>
      <div className="bs-target-shadow" />
      <div className="bs-target-piece-base" />
      <div className="bs-target-piece-rim" />
      <div className="bs-target-piece-face">
        <div className="bs-target-piece-groove bs-target-piece-groove-x" />
        <div className="bs-target-piece-groove bs-target-piece-groove-y" />
        <div className="bs-target-piece-core" />
        <div className="bs-target-piece-cap" />
        <div className="bs-target-piece-spec" />
      </div>
    </div>
  );
  const renderBattlescratchShipArt = (
    ship: NonNullable<BattlescratchTicket["ships"]>[number],
    isSunk: boolean,
    segmentIndex: number
  ) => {
    const art = BATTLESCRATCH_SHIP_ART[ship.type];
    const rotate = art.nativeOrientation !== ship.orientation;
    const trackWidth = ship.orientation === "horizontal" ? `${ship.size * 100}%` : "100%";
    const trackHeight = ship.orientation === "vertical" ? `${ship.size * 100}%` : "100%";
    const rotatedWidth = ship.orientation === "horizontal" ? `${100 / ship.size}%` : `${ship.size * 100}%`;
    const rotatedHeight = ship.orientation === "horizontal" ? `${ship.size * 100}%` : `${100 / ship.size}%`;
    const offsetStyle =
      ship.orientation === "horizontal"
        ? { transform: `translateX(-${segmentIndex * 100}%)` }
        : { transform: `translateY(-${segmentIndex * 100}%)` };

    return (
      <div
        className={`bs-ship-art ${isSunk ? "bs-ship-art-sunk" : ""}`}
        style={offsetStyle}
      >
        <div
          className="bs-ship-art-track"
          style={{
            width: trackWidth,
            height: trackHeight,
          }}
        >
          <div
            className={`bs-ship-art-inner ${rotate ? "bs-ship-art-inner-rotated" : ""}`}
          style={
            rotate
              ? {
                  width: rotatedWidth,
                  height: rotatedHeight,
                }
              : undefined
          }
        >
            <Image
              src={art.src}
              alt=""
              fill
              unoptimized
              sizes="320px"
              className="bs-ship-art-image"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden px-3 py-3 sm:px-6 sm:py-5 lg:px-8"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: isCompactViewport
          ? "max(5.75rem, calc(5rem + env(safe-area-inset-bottom)))"
          : "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <audio ref={winSoundRef} src="/sfx/win.mp3" preload="auto" />
      <audio ref={sparkleSoundRef} src="/sfx/slot-win-sparkle.mp3" preload="auto" />

      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden rounded-[34px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-start justify-between gap-3">
            <BrandLogo href="/home" className="max-w-[220px]" />
            <ThemeToggle compact />
          </div>

          <nav className="mt-8 grid gap-3">
            <button
              className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] px-4 py-3 text-left text-sm font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--panel)]"
              onClick={() => router.push("/home")}
              type="button"
            >
              Home
            </button>
            <button
              className={`rounded-[20px] border px-4 py-3 text-left text-sm font-semibold transition ${
                showBrowseView
                  ? "border-[color:var(--panel-border-strong)] bg-[linear-gradient(135deg,rgba(86,230,213,0.18),rgba(96,188,255,0.08))] text-[color:var(--foreground-strong)]"
                  : "border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] text-[color:var(--foreground-muted)] hover:bg-[color:var(--panel)]"
              }`}
              onClick={() => openTicketBrowse()}
              type="button"
            >
              Tickets
            </button>
          </nav>

          <div className="mt-8 rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-5">
            <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">Your Balance</div>
            <div className="mt-3 text-4xl font-semibold text-[color:var(--foreground-strong)]">{balance.toLocaleString()}</div>
            <div className="mt-1 text-sm text-[color:var(--foreground-muted)]">Points</div>
            <div className="mt-4 rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3 text-sm text-[color:var(--foreground-muted)]">
              {playerEmail || "Loading player..."}
            </div>
          </div>

          {showDesktopScratchSupport && showRevealAllControl ? (
            <div className="mt-5 rounded-[24px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">Scratch Action</div>
              <button
                className="mt-3 w-full rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={finishScratch}
                disabled={revealAllDisabled}
                type="button"
              >
                {showSelectedClassicBoard ? "Instant Reveal" : revealAllLabel}
              </button>
            </div>
          ) : null}

          <div className="mt-5 rounded-[24px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">Audio</div>
            <div className="mt-3 flex items-center gap-3">
              <button
                className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-3 py-2 text-sm font-semibold text-[color:var(--foreground-strong)]"
                onClick={() => setIsMuted((value) => !value)}
                type="button"
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <input className="w-full" type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            </div>
          </div>
        </aside>

        <section
          className={`${
            isCompactViewport
              ? "mx-auto w-full max-w-[430px] rounded-none border-0 bg-transparent p-0 shadow-none"
              : "rounded-[34px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-4 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-6"
          }`}
        >
          {showBrowseView ? (
            showCompactBrowseLayout ? (
              <MobilePageHeader
                title="Tickets"
                balance={balance}
                onBack={() => router.push("/home")}
              />
            ) : null
          ) : null}

          {showBrowseView ? (
            showCompactBrowseLayout ? (
              <div className="mt-4 grid grid-cols-2 items-start gap-3">
                {THEME_OPTIONS.map((theme) => renderCompactTicketBrowseCard(theme))}
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{THEME_OPTIONS.map((theme) => renderTicketBrowseCard(theme))}</div>
            )
          ) : (
            <section
              className={`${
                showCompactPlayLayout
                  ? "mt-2 rounded-[28px] border-0 bg-transparent p-0"
                  : "mt-5 rounded-[30px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-4"
              }`}
            >
            {showCompactPlayLayout ? (
              <div className="mb-3 flex justify-end lg:hidden">
                <div className="inline-flex items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-strong)] px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                  <div className="text-right">
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground-faint)]">Points</div>
                    <div className="mt-0.5 text-sm font-semibold leading-none text-[color:var(--foreground-strong)]">{balance.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={showCompactPlayLayout ? "mx-auto w-full max-w-[420px]" : ""}>
            {showSelectedReelRevealBoard ? (
                <div className="relative mx-auto w-full max-w-[920px] xl:-mt-6">
                  <ReelRevealGameScreen
                    key={reelRevealTicket!.sessionId}
                    ticket={reelRevealTicket!}
                    buyAgainPending={busy}
                  onBuyAgain={buyReelRevealAgain}
                />
              </div>
            ) : showSelectedTheBigScoreBoard ? (
              <div className="relative">
                <TheBigScoreGameScreen
                  key={theBigScoreTicket!.sessionId}
                  ticket={theBigScoreTicket!}
                  buyAgainPending={busy}
                  onBuyAgain={buyTheBigScoreAgain}
                />
              </div>
            ) : showSelectedTripleCrownDerbyBoard ? (
              <div className="relative">
                <TripleCrownDerbyGameScreen
                  key={tripleCrownDerbyTicket!.sessionId}
                  ticket={tripleCrownDerbyTicket!}
                  buyAgainPending={busy}
                  onBuyAgain={buyTripleCrownDerbyAgain}
                />
              </div>
            ) : showSelectedCrosswordBoard ? (
              <div className="relative mx-auto w-full max-w-[520px]">
                <CrosswordGameScreen
                  ticket={crosswordTicket!}
                  state={crosswordState}
                  claimPending={crosswordClaimPending}
                  playAgainPending={busy}
                  onRevealLetter={revealCrosswordLetter}
                  onMarkBoardCell={markCrosswordCell}
                  onRevealAll={revealAllCrosswordLetters}
                  onCheckTicket={checkCrosswordBoard}
                  onPlayAgain={() => {
                    void buyTicket("crossword");
                  }}
                />
              </div>
            ) : shouldShowThemeHome ? (
              <div className="relative">
                {renderThemeHomeScreen(selectedTheme)}
              </div>
              ) : (
                <div
                  ref={containerRef}
                  className={`relative mx-auto w-full overflow-hidden rounded-[30px] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.35)] ${
                    isCompactViewport ? "" : "max-w-[min(100%,calc((100dvh-7rem)*0.75))]"
                  }`}
                  style={{ aspectRatio: "3 / 4" }}
                >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_45%),linear-gradient(180deg,#0f1728_0%,#09121f_100%)]" />

              {showSelectedClassicBoard || showSelectedBattlescratchBoard ? (
                <>
                  {boardThemeId === "close_encounters" ? (
                    <div className="ce-board absolute inset-0 overflow-hidden">
                      <div className="ce-stars" />
                      <div className="ce-horizon-glow" />
                      <div className="ce-nebula ce-nebula-a" />
                      <div className="ce-nebula ce-nebula-b" />
                      <div className="ce-planet ce-planet-a" />
                      <div className="ce-planet ce-planet-b" />
                      <div className="ce-signal-beam" />
                      <div className="ce-logo-stage">
                        <div className="ce-logo-bleed ce-logo-bleed-back">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={CLOSE_ENCOUNTERS_LOGO_SRC} alt="" className="ce-logo-bleed-img" aria-hidden="true" />
                        </div>
                        <div className="ce-logo-bleed ce-logo-bleed-front">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={CLOSE_ENCOUNTERS_LOGO_SRC} alt="" className="ce-logo-bleed-img" aria-hidden="true" />
                        </div>
                        <div className="ce-logo-halo ce-logo-halo-a" />
                        <div className="ce-logo-halo ce-logo-halo-b" />
                        <div className="ce-logo-frame ce-logo-frame-main">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={CLOSE_ENCOUNTERS_LOGO_SRC}
                            alt="Close Encounters"
                            className="ce-logo-main-img drop-shadow-[0_24px_56px_rgba(77,228,255,0.32)]"
                          />
                        </div>
                      </div>
                    </div>
                  ) : boardThemeId === "flamingo_frenzy" ? (
                    <div className="ff-board absolute inset-0 overflow-hidden">
                      <div className="ff-sky-glow ff-sky-glow-a" />
                      <div className="ff-sky-glow ff-sky-glow-b" />
                      <div className="ff-sun-halo" />
                      <div className="ff-sun-disc" />
                      <div className="ff-waterline" />
                      <div className="ff-ocean" />
                      <div className="ff-shimmer ff-shimmer-a" />
                      <div className="ff-shimmer ff-shimmer-b" />
                      <div className="ff-island ff-island-left" />
                      <div className="ff-island ff-island-right" />
                      <div className="ff-logo-stage">
                        <div className="ff-logo-glow ff-logo-glow-a" />
                        <div className="ff-logo-glow ff-logo-glow-b" />
                        <div className="ff-logo-frame">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={FLAMINGO_FRENZY_LOGO_SRC} alt="Flamingo Frenzy" className="ff-logo-main-img" />
                        </div>
                      </div>
                    </div>
                  ) : boardThemeId === "steam_barons_bounty" ? (
                    <div className="sbb-board absolute inset-0 overflow-hidden">
                      <div className="sbb-sky-glow sbb-sky-glow-a" />
                      <div className="sbb-sky-glow sbb-sky-glow-b" />
                      <div className="sbb-chart-lines" />
                      <div className="sbb-sea-band" />
                      <div className="sbb-water-glow" />
                      <div className="sbb-coins sbb-coins-left" />
                      <div className="sbb-coins sbb-coins-right" />
                      <div className="sbb-logo-stage">
                        <div className="sbb-logo-halo sbb-logo-halo-a" />
                        <div className="sbb-logo-halo sbb-logo-halo-b" />
                        <div className="sbb-logo-frame">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={STEAM_BARONS_BOUNTY_LOGO_SRC} alt="Pirates Buried Treasure" className="sbb-logo-main-img" />
                        </div>
                      </div>
                    </div>
                  ) : boardThemeId === "steam_barons_bounty_west" ? (
                    <div className="sbw-board absolute inset-0 overflow-hidden">
                      <div className="sbw-smoke sbw-smoke-a" />
                      <div className="sbw-smoke sbw-smoke-b" />
                      <div className="sbw-lightshaft sbw-lightshaft-a" />
                      <div className="sbw-lightshaft sbw-lightshaft-b" />
                      <div className="sbw-river-band" />
                      <div className="sbw-river-glow" />
                      <div className="sbw-cogs sbw-cogs-left" />
                      <div className="sbw-cogs sbw-cogs-right" />
                      <div className="sbw-logo-stage">
                        <div className="sbw-logo-halo sbw-logo-halo-a" />
                        <div className="sbw-logo-halo sbw-logo-halo-b" />
                        <div className="sbw-logo-frame">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={STEAM_BARONS_BOUNTY_WEST_LOGO_SRC} alt="Steam Baron's Bounty" className="sbw-logo-main-img" />
                        </div>
                      </div>
                    </div>
                  ) : boardThemeId === "battlescratch" ? (
                    <div className="bs-board absolute inset-0 overflow-hidden">
                      <div className="bs-board-glow bs-board-glow-a" />
                      <div className="bs-board-glow bs-board-glow-b" />
                      <div className="bs-radar-grid" />
                      <div className="bs-sea-band" />
                      <div className="bs-sea-band bs-sea-band-b" />
                      <div className="bs-fleet-shadow bs-fleet-shadow-left" />
                      <div className="bs-fleet-shadow bs-fleet-shadow-right" />
                      <div className="bs-logo-stage">
                        <div className="bs-logo-halo bs-logo-halo-a" />
                        <div className="bs-logo-halo bs-logo-halo-b" />
                        <div className="bs-logo-frame">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={BATTLESCRATCH_LOGO_SRC} alt="Battlescratch" className="bs-logo-main-img" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="absolute inset-0">
                    {boardThemeId === "close_encounters" ? (
                      <>
                        <div
                          className="ce-cockpit absolute"
                          style={{
                            left: `${(boardZone.leftPct + (boardLayout.cockpit?.shellLeftOffsetPct ?? 0)) * 100}%`,
                            top: `${(boardZone.topPct + (boardLayout.cockpit?.shellTopOffsetPct ?? 0)) * 100}%`,
                            width: `${(boardZone.widthPct + (boardLayout.cockpit?.shellWidthExpandPct ?? 0)) * 100}%`,
                            height: `${(boardZone.heightPct + (boardLayout.cockpit?.shellHeightExpandPct ?? 0)) * 100}%`,
                          }}
                        >
                          <div className="ce-cockpit-canopy" />
                          <div className="ce-cockpit-rib ce-cockpit-rib-left" />
                          <div className="ce-cockpit-rib ce-cockpit-rib-right" />
                          <div className="ce-cockpit-rib ce-cockpit-rib-mid" />
                          <div className="ce-console ce-console-left" />
                          <div className="ce-console ce-console-right" />
                          <div className="ce-dashboard" />
                          <div className="ce-indicators ce-indicators-left" />
                          <div className="ce-indicators ce-indicators-center" />
                          <div className="ce-indicators ce-indicators-right" />
                        </div>
                        <div
                          className="ce-screen-hood absolute"
                          style={{
                            left: `${(boardZone.leftPct + (boardLayout.cockpit?.hoodLeftOffsetPct ?? 0)) * 100}%`,
                            top: `${(boardZone.topPct + (boardLayout.cockpit?.hoodTopOffsetPct ?? 0)) * 100}%`,
                            width: `${(boardZone.widthPct + (boardLayout.cockpit?.hoodWidthExpandPct ?? 0)) * 100}%`,
                            height: `${((boardLayout.cockpit?.hoodHeightPct ?? 0) || 0.05) * 100}%`,
                          }}
                        />
                        <div
                          className="ce-zone-frame absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        />
                        <div
                          className="ce-zone absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        />
                        {showCloseEncountersWinFx ? (
                          <div
                            className={`ce-win-fx ce-win-fx-${ceWinFxPhase}`}
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${(boardZone.topPct - 0.055) * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${(boardZone.heightPct + 0.075) * 100}%`,
                            }}
                          >
                            <div className="ce-win-ufo" aria-hidden="true">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={CLOSE_ENCOUNTERS_WIN_UFO_SRC} alt="" className="ce-win-ufo-img" aria-hidden="true" />
                            </div>
                            <div className="ce-win-beam-cap" aria-hidden="true" />
                            <div className="ce-win-beam" aria-hidden="true" />
                            <div className="ce-win-beam-target" aria-hidden="true" />
                            <div className="ce-win-amount">
                              <div className="ce-win-amount-value">+{ceWinFxValue}</div>
                              {ceWinFxPhase === "done" ? (
                                <button
                                  type="button"
                                  onClick={buyCloseEncountersAgain}
                                  disabled={busy}
                                  className="ce-win-buy-again"
                                >
                                  {busy ? "Starting..." : "Play Ticket"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {showCloseEncountersResultCard ? (
                          <div
                            className="absolute inset-0 z-[10] flex items-center justify-center p-4"
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${boardZone.topPct * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${boardZone.heightPct * 100}%`,
                            }}
                          >
                            <div className="pointer-events-auto w-full max-w-[420px] rounded-[30px] border border-cyan-200/30 bg-[linear-gradient(180deg,rgba(5,16,31,0.92),rgba(7,18,35,0.96))] px-6 py-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.5),0_0_48px_rgba(111,255,191,0.18)]">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100/64">Close Encounters</div>
                              <div className="mt-3 text-3xl font-black uppercase tracking-[0.1em] text-white">Not A Winner</div>
                              <button
                                type="button"
                                onClick={buyCloseEncountersAgain}
                                disabled={busy}
                                className="mt-5 w-full rounded-[18px] border border-[#8cfff0]/45 bg-[linear-gradient(180deg,#b9fff5_0%,#57e8c5_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#07131d] shadow-[0_16px_32px_rgba(87,232,197,0.28)] transition hover:brightness-105 disabled:cursor-default disabled:opacity-45"
                              >
                                {busy ? "Starting..." : "Play Again"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : boardThemeId === "flamingo_frenzy" ? (
                      <>
                        <div
                          className="ff-zone-shell absolute"
                          style={{
                            left: `${(boardZone.leftPct - 0.008) * 100}%`,
                            top: `${(boardZone.topPct - 0.008) * 100}%`,
                            width: `${(boardZone.widthPct + 0.016) * 100}%`,
                            height: `${(boardZone.heightPct + 0.016) * 100}%`,
                            borderRadius:
                              boardZoneCss && boardRectCss
                                ? `${boardZoneCss.radius + Math.min(boardRectCss.width, boardRectCss.height) * 0.014}px`
                                : `${(boardZone.cornerRadiusPct + 0.014) * 100}%`,
                          }}
                        />
                        <div
                          className="ff-zone-frame absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        />
                        <div
                          className="ff-zone absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        >
                          <div className="ff-bubbles ff-bubbles-a" />
                          <div className="ff-bubbles ff-bubbles-b" />
                        </div>
                        {showFlamingoFrenzyWinFx ? (
                          <div
                            className={`ff-win-fx ff-win-fx-${ffWinFxPhase} absolute`}
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${boardZone.topPct * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${boardZone.heightPct * 100}%`,
                              borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                            }}
                          >
                            <div className="ff-win-burst" aria-hidden="true" />
                            <div className="ff-win-splash" aria-hidden="true" />
                            <div className="ff-win-sparkles" aria-hidden="true" />
                            <Image
                              className="ff-win-flamingo"
                              src={FLAMINGO_FRENZY_WIN_FLAMINGO_SRC}
                              alt=""
                              width={736}
                              height={736}
                              aria-hidden="true"
                            />
                            {winIndices.map((index, rippleIndex) => {
                              const rect = cellRects[index];
                              if (!rect) return null;
                              const zoneOffsetX = boardZoneCss?.x ?? 0;
                              const zoneOffsetY = boardZoneCss?.y ?? 0;
                              return (
                                <div
                                  key={`ff-ripple-${index}`}
                                  className="ff-win-ripple"
                                  style={{
                                    left: rect.x - zoneOffsetX + rect.size * 0.1,
                                    top: rect.y - zoneOffsetY + rect.size * 0.1,
                                    width: rect.size * 0.8,
                                    height: rect.size * 0.8,
                                    animationDelay: `${rippleIndex * 120}ms`,
                                  }}
                                  aria-hidden="true"
                                />
                              );
                            })}
                            <div className="ff-win-amount-pill">
                              <div className="ff-win-amount">+{ffWinFxValue}</div>
                            </div>
                            <div className="ff-win-badge">
                              {ffWinFxPhase === "done" ? (
                                <button
                                  type="button"
                                  onClick={buyFlamingoFrenzyAgain}
                                  disabled={busy}
                                  className="ff-win-buy-again"
                                >
                                  {busy ? "Starting..." : "Play Again"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {showFlamingoFrenzyLoseCard ? (
                          <div
                            className="ff-lose-fx absolute"
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${boardZone.topPct * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${boardZone.heightPct * 100}%`,
                              borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                            }}
                          >
                            <div className="ff-lose-card">
                              <div className="ff-lose-title">Not A Winner</div>
                              <button
                                type="button"
                                onClick={buyFlamingoFrenzyAgain}
                                disabled={busy}
                                className="ff-win-buy-again"
                              >
                                {busy ? "Starting..." : "Play Again"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : boardThemeId === "steam_barons_bounty" ? (
                      <>
                        <div
                          className="sbb-zone-shell absolute"
                          style={{
                            left: `${(boardZone.leftPct - 0.014) * 100}%`,
                            top: `${(boardZone.topPct - 0.02) * 100}%`,
                            width: `${(boardZone.widthPct + 0.028) * 100}%`,
                            height: `${(boardZone.heightPct + 0.03) * 100}%`,
                            borderRadius:
                              boardZoneCss && boardRectCss
                                ? `${boardZoneCss.radius + Math.min(boardRectCss.width, boardRectCss.height) * 0.024}px`
                                : `${(boardZone.cornerRadiusPct + 0.022) * 100}%`,
                          }}
                        />
                        <div
                          className="sbb-zone-frame absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        />
                        <div
                          className="sbb-zone absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        >
                          <div className="sbb-zone-glow sbb-zone-glow-a" />
                          <div className="sbb-zone-glow sbb-zone-glow-b" />
                          <div className="sbb-zone-rivets" />
                        </div>
                        {showSteamBaronsBountyWinFx ? (
                          <div
                            className={`sbb-win-fx sbb-win-fx-${sbbWinFxPhase} absolute`}
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${boardZone.topPct * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${boardZone.heightPct * 100}%`,
                              borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                            }}
                          >
                            <div className="sbb-win-bloom" aria-hidden="true" />
                            <div className="sbb-win-spark" aria-hidden="true" />
                            {winIndices.map((index, sparkleIndex) => {
                              const rect = cellRects[index];
                              if (!rect) return null;
                              const zoneOffsetX = boardZoneCss?.x ?? 0;
                              const zoneOffsetY = boardZoneCss?.y ?? 0;
                              return (
                                <div
                                  key={`sbb-glint-${index}`}
                                  className="sbb-win-glint"
                                  style={{
                                    left: rect.x - zoneOffsetX + rect.size * 0.12,
                                    top: rect.y - zoneOffsetY + rect.size * 0.12,
                                    width: rect.size * 0.76,
                                    height: rect.size * 0.76,
                                    animationDelay: `${sparkleIndex * 140}ms`,
                                  }}
                                  aria-hidden="true"
                                />
                              );
                            })}
                            <div className="sbb-win-wake" aria-hidden="true" />
                            <div className="sbb-win-spray" aria-hidden="true" />
                            <Image
                              className="sbb-win-ship"
                              src={STEAM_BARONS_BOUNTY_WIN_SHIP_SRC}
                              alt=""
                              width={1024}
                              height={1168}
                              aria-hidden="true"
                            />
                            <div className="pbt-win-card">
                              <div className="pbt-win-card-amount">+{sbbWinFxValue} Points</div>
                              {sbbWinFxPhase === "done" ? (
                                <button
                                  type="button"
                                  onClick={buySteamBaronsBountyAgain}
                                  disabled={busy}
                                  className="sbw-win-buy-again"
                                >
                                  {busy ? "Starting..." : "Play Again"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {showSteamBaronsBountyLoseCard ? (
                          <div
                            className="sbw-lose-fx absolute"
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${boardZone.topPct * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${boardZone.heightPct * 100}%`,
                              borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                            }}
                          >
                            <div className="sbw-lose-card">
                              <div className="sbw-win-label">Ticket Result</div>
                              <div className="sbw-lose-title">Not A Winner</div>
                              <button
                                type="button"
                                onClick={buySteamBaronsBountyAgain}
                                disabled={busy}
                                className="sbw-win-buy-again"
                              >
                                {busy ? "Starting..." : "Play Again"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : boardThemeId === "steam_barons_bounty_west" ? (
                      <>
                        <div
                          className="sbw-zone-shell absolute"
                          style={{
                            left: `${(boardZone.leftPct - 0.014) * 100}%`,
                            top: `${(boardZone.topPct - 0.016) * 100}%`,
                            width: `${(boardZone.widthPct + 0.028) * 100}%`,
                            height: `${(boardZone.heightPct + 0.026) * 100}%`,
                            borderRadius:
                              boardZoneCss && boardRectCss
                                ? `${boardZoneCss.radius + Math.min(boardRectCss.width, boardRectCss.height) * 0.018}px`
                                : `${(boardZone.cornerRadiusPct + 0.018) * 100}%`,
                          }}
                        />
                        <div
                          className="sbw-zone-frame absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        />
                        <div
                          className="sbw-zone absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        >
                          <div className="sbw-zone-steam sbw-zone-steam-a" />
                          <div className="sbw-zone-steam sbw-zone-steam-b" />
                          <div className="sbw-zone-rivets" />
                        </div>
                        {showSteamBaronsBountyWestWinFx ? (
                          <div
                            className={`sbw-win-fx sbw-win-fx-${sbwWinFxPhase} absolute`}
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${boardZone.topPct * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${boardZone.heightPct * 100}%`,
                              borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                            }}
                          >
                            <div className="sbw-win-halo" aria-hidden="true" />
                            <div className="sbw-win-video-wrap" aria-hidden="true">
                              <video
                                ref={sbwWinVideoRef}
                                className="sbw-win-video"
                                playsInline
                                muted
                                preload="auto"
                                onEnded={() => setSbwWinVideoEnded(true)}
                              >
                                <source src={STEAM_BARONS_BOUNTY_WIN_VIDEO_SRC} type="video/mp4" />
                              </video>
                            </div>
                            <div className={`sbw-win-card ${sbwWinVideoEnded ? "sbw-win-card-expanded" : ""}`}>
                              <div className="sbw-win-label">Prize Revealed</div>
                              <div className="sbw-win-amount">+{sbwWinFxValue}</div>
                              {sbwWinVideoEnded ? (
                                <button
                                  type="button"
                                  onClick={buySteamBaronsBountyWestAgain}
                                  disabled={busy}
                                  className="sbw-win-buy-again"
                                >
                                  {busy ? "Starting..." : "Play Again"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {showSteamBaronsBountyWestLoseCard ? (
                          <div
                            className="sbw-lose-fx absolute"
                            style={{
                              left: `${boardZone.leftPct * 100}%`,
                              top: `${boardZone.topPct * 100}%`,
                              width: `${boardZone.widthPct * 100}%`,
                              height: `${boardZone.heightPct * 100}%`,
                              borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                            }}
                          >
                            <div className="sbw-lose-card">
                              <div className="sbw-win-label">Ticket Result</div>
                              <div className="sbw-lose-title">Not A Winner</div>
                              <button
                                type="button"
                                onClick={buySteamBaronsBountyWestAgain}
                                disabled={busy}
                                className="sbw-win-buy-again"
                              >
                                {busy ? "Starting..." : "Play Again"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : boardThemeId === "battlescratch" ? (
                      <>
                        <div
                          className="bs-zone-shell absolute"
                          style={{
                            left: `${(boardZone.leftPct - 0.012) * 100}%`,
                            top: `${(boardZone.topPct - 0.014) * 100}%`,
                            width: `${(boardZone.widthPct + 0.024) * 100}%`,
                            height: `${(boardZone.heightPct + 0.028) * 100}%`,
                            borderRadius:
                              boardZoneCss && boardRectCss
                                ? `${boardZoneCss.radius + Math.min(boardRectCss.width, boardRectCss.height) * 0.02}px`
                                : `${(boardZone.cornerRadiusPct + 0.02) * 100}%`,
                          }}
                        />
                        <div
                          className="bs-zone-frame absolute"
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        />
                        <div
                          className={`bs-zone absolute ${isBattlescratchScratching || isBattlescratchComplete ? "bs-zone-revealed" : ""}`}
                          style={{
                            left: `${boardZone.leftPct * 100}%`,
                            top: `${boardZone.topPct * 100}%`,
                            width: `${boardZone.widthPct * 100}%`,
                            height: `${boardZone.heightPct * 100}%`,
                            borderRadius: boardZoneCss ? `${boardZoneCss.radius}px` : `${boardZone.cornerRadiusPct * 100}%`,
                          }}
                        >
                          <div className="bs-zone-radar" />
                          <div className="bs-zone-swell bs-zone-swell-a" />
                          <div className="bs-zone-swell bs-zone-swell-b" />
                        </div>
                        {showBattlescratchSinkVideo && activeBattlescratchSinkVideo ? (
                          <div className="absolute inset-[3.6%] z-[9] overflow-hidden rounded-[28px] border border-orange-200/30 bg-[#06111f]/92 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
                            <div className="absolute inset-x-0 top-0 z-[1] bg-[linear-gradient(180deg,rgba(5,16,31,0.88),rgba(5,16,31,0))] px-5 py-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/62">Confirmed Strike</div>
                              <div className="mt-1 text-2xl font-black uppercase tracking-[0.12em] text-white">
                                {activeBattlescratchSinkVideo.label} Sunk
                              </div>
                            </div>
                            <video
                              key={activeBattlescratchSinkVideo.id}
                              ref={battleSinkVideoRef}
                              className="h-full w-full bg-black object-cover"
                              playsInline
                              preload="auto"
                              onEnded={() => {
                                setBattleSinkVideoIndex((current) => {
                                  if (current < battleSinkVideoQueue.length - 1) {
                                    return current + 1;
                                  }
                                  setBattleSinkVideoQueue([]);
                                  return 0;
                                });
                              }}
                              onError={() => {
                                setBattleSinkVideoIndex((current) => {
                                  if (current < battleSinkVideoQueue.length - 1) {
                                    return current + 1;
                                  }
                                  setBattleSinkVideoQueue([]);
                                  return 0;
                                });
                              }}
                            >
                              <source src={activeBattlescratchSinkVideo.src} type="video/mp4" />
                            </video>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div
                        className="absolute bg-[linear-gradient(180deg,#fffdfa_0%,#f5efe5_100%)]"
                        style={{
                          left: `${boardZone.leftPct * 100}%`,
                          top: `${boardZone.topPct * 100}%`,
                          width: `${boardZone.widthPct * 100}%`,
                          height: `${boardZone.heightPct * 100}%`,
                          borderRadius: `${boardZone.cornerRadiusPct * 100}%`,
                          boxShadow: "inset 0 0 0 1px rgba(64,40,8,0.12), inset 0 18px 36px rgba(255,255,255,0.32)",
                        }}
                      />
                    )}
                    {cellRects.length === GRID_SIZE &&
                      ticketIds.map((id, index) => {
                        const rect = cellRects[index];
                        const isWinningCell = outcome === "win" && winIndices.includes(index);
                        const useColor = isRevealed && isWinningCell;
                        const showWinAccent = isRevealed && isWinningCell;
                        const spaceSymbol = CLOSE_ENCOUNTERS_SYMBOLS[id];
                        const flamingoSymbol = FLAMINGO_FRENZY_SYMBOLS[id];
                        const steamSymbol = STEAM_BARONS_BOUNTY_SYMBOLS[id];
                        const steamWestSymbol = STEAM_BARONS_BOUNTY_WEST_SYMBOLS[id];
                        const symbolScale = boardLayout.symbolScale;
                        return (
                          <div
                            key={`${id}-${index}`}
                            className="absolute"
                            style={{
                              left: rect.x,
                              top: rect.y,
                              width: rect.size,
                              height: rect.size,
                              display: "grid",
                              placeItems: "center",
                              pointerEvents: "none",
                              zIndex:
                                boardThemeId === "close_encounters" ||
                                boardThemeId === "flamingo_frenzy" ||
                                boardThemeId === "steam_barons_bounty" ||
                                boardThemeId === "steam_barons_bounty_west"
                                  ? 3
                                  : undefined,
                            }}
                          >
                            {boardThemeId === "close_encounters" ? (
                              <div
                                className={showWinAccent ? "ce-symbol-card ce-symbol-card-win sb-bounce" : "ce-symbol-card"}
                                style={
                                  {
                                    width: `${symbolScale * 100}%`,
                                    height: `${symbolScale * 100}%`,
                                    "--ce-glow": spaceSymbol.glow,
                                  } as React.CSSProperties
                                }
                              >
                                <Image
                                  src={spaceSymbol.src}
                                  alt={spaceSymbol.label}
                                  fill
                                  sizes="96px"
                                  className={`ce-symbol-img ${showWinAccent ? "ce-symbol-img-win" : ""} object-contain`}
                                />
                                {showWinAccent ? <div className="ce-symbol-pulse" aria-hidden="true" /> : null}
                              </div>
                            ) : boardThemeId === "flamingo_frenzy" ? (
                              <div
                                className={showWinAccent ? "ff-symbol-card ff-symbol-card-win sb-bounce" : "ff-symbol-card"}
                                style={
                                  {
                                    width: `${symbolScale * 100}%`,
                                    height: `${symbolScale * 100}%`,
                                    "--ff-glow": flamingoSymbol.glow,
                                  } as React.CSSProperties
                                }
                              >
                                <Image
                                  src={flamingoSymbol.src}
                                  alt={flamingoSymbol.label}
                                  fill
                                  sizes="96px"
                                  className={`ff-symbol-img ${showWinAccent ? "ff-symbol-img-win" : ""} object-contain`}
                                />
                                {showWinAccent ? <div className="ff-symbol-pulse" aria-hidden="true" /> : null}
                              </div>
                            ) : boardThemeId === "steam_barons_bounty" ? (
                              <div
                                className={showWinAccent ? "sbb-symbol-card sbb-symbol-card-win sb-bounce" : "sbb-symbol-card"}
                                style={
                                  {
                                    width: `${symbolScale * 100}%`,
                                    height: `${symbolScale * 100}%`,
                                    "--sbb-glow": steamSymbol.glow,
                                  } as React.CSSProperties
                                }
                              >
                                <Image
                                  src={steamSymbol.src}
                                  alt={steamSymbol.label}
                                  fill
                                  sizes="96px"
                                  className={`sbb-symbol-img ${showWinAccent ? "sbb-symbol-img-win" : ""} object-contain`}
                                />
                                {showWinAccent ? <div className="sbb-symbol-pulse" aria-hidden="true" /> : null}
                              </div>
                            ) : boardThemeId === "steam_barons_bounty_west" ? (
                              <div
                                className={showWinAccent ? "sbw-symbol-card sbw-symbol-card-win sb-bounce" : "sbw-symbol-card"}
                                style={
                                  {
                                    width: `${symbolScale * 100}%`,
                                    height: `${symbolScale * 100}%`,
                                    "--sbw-glow": steamWestSymbol.glow,
                                  } as React.CSSProperties
                                }
                              >
                                <Image
                                  src={steamWestSymbol.src}
                                  alt={steamWestSymbol.label}
                                  fill
                                  unoptimized
                                  sizes="96px"
                                  className={`sbw-symbol-img ${showWinAccent ? "sbw-symbol-img-win" : ""} object-contain`}
                                />
                                {showWinAccent ? <div className="sbw-symbol-pulse" aria-hidden="true" /> : null}
                              </div>
                            ) : (
                              <div
                                className={showWinAccent ? "sb-bounce sb-symbol-focus relative" : "relative"}
                                style={{ width: `${symbolScale * 100}%`, height: `${symbolScale * 100}%` }}
                              >
                                <Image
                                  src={useColor ? ASSETS.symbolColor(id) : ASSETS.symbolBW(id)}
                                  alt={SYMBOL_KEYS[id]}
                                  fill
                                  sizes="72px"
                                  className={
                                    useColor
                                      ? "sb-symbol-img sb-symbol-img-color object-contain"
                                      : "sb-symbol-img sb-symbol-img-bw object-contain"
                                  }
                                />
                                {showWinAccent ? <div className="sb-win-ring" aria-hidden="true" /> : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {isBattlescratchBoard &&
                      battleCellRects.map((rect) => {
                        const cell = battleCells.find((entry) => entry.key === rect.key);
                        if (!cell) return null;
                        const ship = cell.shipId ? battleShipById.get(cell.shipId) ?? null : null;
                        const isSunk = ship ? battleSunkShipIds.has(ship.id) : false;
                        const shipSegmentIndex = ship
                          ? ship.cells.findIndex((entry) => entry.row === cell.row && entry.col === cell.col)
                          : -1;
                        return (
                          <div
                            key={`battle-cell-${rect.key}`}
                            className="absolute"
                            style={{
                              left: rect.x,
                              top: rect.y,
                              width: rect.size,
                              height: rect.size,
                              pointerEvents: "none",
                              zIndex: 3,
                            }}
                          >
                            <div
                              className={`bs-cell ${cell.revealed ? "bs-cell-revealed" : "bs-cell-unrevealed"} ${
                                cell.revealed
                                  ? cell.shipId
                                    ? isSunk
                                      ? "bs-cell-sunk"
                                      : "bs-cell-ship"
                                    : "bs-cell-water"
                                  : "bs-cell-hidden"
                              }`}
                            >
                              <div className="bs-cell-grid" />
                              {cell.revealed && ship && shipSegmentIndex >= 0 ? renderBattlescratchShipArt(ship, isSunk, shipSegmentIndex) : null}
                              {cell.targeted && !cell.revealed ? renderBattlescratchTargetMarker(battleRevealState.confirmed) : null}
                              {cell.revealed && cell.hit ? (
                                <>
                                  <div className="bs-hit-glow" />
                                  <div className="bs-hit-flash" />
                                  <div className="bs-hit-label">HIT</div>
                                </>
                              ) : null}
                              {cell.revealed && cell.miss ? (
                                <>
                                  <div className="bs-miss-ripple" />
                                  <div className="bs-miss-label">MISS</div>
                                </>
                              ) : null}
                              {cell.revealed && isSunk && ship && ship.cells[0] && ship.cells[0].row === cell.row && ship.cells[0].col === cell.col ? (
                                <div className="bs-sunk-banner">SUNK</div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <canvas ref={canvasRef} className="absolute inset-0 z-[4] touch-none" />

                  {isBattlescratchTargeting ? (
                    <div className="pointer-events-none absolute inset-0 z-[5]">
                      {battleCellRects.map((rect) => {
                        const isTargeted = battleTargetKeys.has(rect.key);

                        return (
                          <div
                            key={`battle-target-overlay-${rect.key}`}
                            className="absolute"
                            style={{
                              left: rect.x,
                              top: rect.y,
                              width: rect.size,
                              height: rect.size,
                            }}
                          >
                            <div className={`bs-grid-overlay-cell ${isTargeted ? "bs-grid-overlay-cell-targeted" : ""}`} />
                            {isTargeted ? renderBattlescratchTargetMarker(battleRevealState.confirmed, true) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {isBattlescratchTargeting ? (
                    <div className="absolute inset-0 z-[6]">
                      {battleCellRects.map((rect) => {
                        const label = `${String.fromCharCode(65 + rect.row)}${rect.col + 1}`;
                        const isTargeted = battleTargetKeys.has(rect.key);
                        return (
                          <div
                            key={`battle-hitbox-${rect.key}`}
                            className="absolute"
                            style={{
                              left: rect.x,
                              top: rect.y,
                              width: rect.size,
                              height: rect.size,
                            }}
                          >
                            <button
                              type="button"
                              className={`bs-grid-hitbox ${isTargeted ? "bs-grid-hitbox-targeted" : ""}`}
                              aria-label={`${isTargeted ? "Remove" : "Place"} strike marker at ${label}`}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleBattlescratchMarker({ row: rect.row, col: rect.col });
                              }}
                              onClick={(event) => {
                                // Preserve keyboard activation without double-toggling pointer presses.
                                if (event.detail !== 0) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  return;
                                }
                                toggleBattlescratchMarker({ row: rect.row, col: rect.col });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {isBattlescratchBoard ? (
                    isBattlescratchComplete && !showBattlescratchResultCard ? (
                      <div className="pointer-events-none absolute inset-x-[8%] bottom-[1.2%] z-[7] flex justify-center">
                        <div className="bs-status-chip">
                          <div className="bs-status-chip-label">After Action</div>
                          <div className="bs-status-chip-value">
                            {battleOutcome?.prizeAmount ? battlescratchWinTitle : "Report Filed"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bs-command-bar pointer-events-none absolute inset-x-[3.2%] bottom-[0.9%] z-[7] flex items-end justify-between gap-2">
                        <div className="bs-hud bs-hud-left">
                          <div className="bs-hud-label">Strike Markers</div>
                          <div className="bs-hud-value">
                            {battleMarkers.length}/{battleTicket?.allowedTargets ?? 0}
                          </div>
                        </div>
                        {isBattlescratchTargeting ? (
                          <button
                            className="bs-confirm-btn pointer-events-auto rounded-[18px] bg-gradient-to-r from-cyan-300 via-sky-300 to-orange-300 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_16px_40px_rgba(76,196,255,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!battleTicket || battleMarkers.length !== battleTicket.allowedTargets}
                            onClick={confirmBattlescratchTargets}
                            type="button"
                          >
                            Confirm Launch
                          </button>
                        ) : null}
                        <div className="bs-hud bs-hud-right">
                          <div className="bs-hud-label">Phase</div>
                          <div className="bs-hud-value">
                            {isBattlescratchTargeting ? "Targeting" : isBattlescratchScratching ? "Scratch Reveal" : "Standby"}
                          </div>
                        </div>
                      </div>
                    )
                  ) : null}

                  {showBattlescratchResultCard && battleOutcome ? (
                    <div className="pointer-events-none absolute inset-0 z-[10] flex items-center justify-center p-4">
                      <div className="pointer-events-auto w-full max-w-[420px] rounded-[30px] border border-[#8fd9ff]/35 bg-[linear-gradient(180deg,rgba(10,25,46,0.96),rgba(5,14,28,0.98))] px-6 py-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.5),0_0_48px_rgba(90,198,255,0.18)]">
                        <div className="text-3xl font-black uppercase tracking-[0.1em] text-white">
                          {battleOutcome.prizeAmount > 0 ? "Winning Ticket" : "Not A Winner"}
                        </div>
                        {battleOutcome.prizeAmount > 0 ? (
                          <div className="mt-5 rounded-[24px] border border-[#ffcf52]/35 bg-[#ffcf52]/10 px-4 py-5">
                            <div className="text-5xl font-black text-[#fff2bd]">
                              {(showBattlescratchWinFx ? bsWinFxValue : battleOutcome.prizeAmount).toLocaleString("en-US")}
                            </div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={buyBattlescratchAgain}
                          disabled={busy}
                          className="mt-5 w-full rounded-[18px] border border-[#ffcb4a]/55 bg-[linear-gradient(180deg,#ffd95c_0%,#ffad2f_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.28em] text-[#230f00] shadow-[0_16px_32px_rgba(255,175,43,0.35)] transition hover:brightness-105 disabled:cursor-default disabled:opacity-45"
                        >
                          {busy ? "Starting..." : "Play Again"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {resultBanner ? (
                    <div
                      className={`absolute bottom-[3%] left-1/2 z-[5] w-[92%] -translate-x-1/2 rounded-2xl bg-black/80 p-3 text-center text-white ${
                        outcome === "win" ? "sb-banner-win" : ""
                      }`}
                      style={{
                        bottom:
                          boardThemeId === "close_encounters"
                            ? "1.2%"
                            : boardThemeId === "flamingo_frenzy"
                              ? "2.1%"
                              : boardThemeId === "steam_barons_bounty"
                                ? "2.4%"
                                : boardThemeId === "steam_barons_bounty_west"
                                  ? "2.3%"
                                  : "3%",
                      }}
                    >
                      <div
                        className={`text-sm font-extrabold ${
                          outcome === "win" ? "text-green-300" : outcome === "nearMiss" ? "text-yellow-200" : "text-red-200"
                        }`}
                      >
                        {resultBanner}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="absolute inset-0 grid place-items-center px-8 text-center">
                  <div>
                    <div className="text-xs uppercase tracking-[0.38em] text-white/42">Scratch Stage</div>
                    <div className="mt-4 text-3xl font-semibold text-white">Buy a ticket to begin</div>
                    <p className="mt-3 text-sm leading-6 text-white/56">
                      Ticket art and reveal logic are loaded. The board will populate as soon as you purchase a scratcher.
                    </p>
                  </div>
                </div>
              )}
              </div>
              )}
              </div>

            {showDesktopScratchSupport ? (
              <div className="mt-4" />
            ) : null}

            {showMobileScratchActions || showMobileSoundControl ? (
              <div className="mt-4 grid gap-3 lg:hidden">
                {showMobileScratchActions && showRevealAllControl ? (
                  <button
                    className={`w-full rounded-[22px] bg-gradient-to-r ${selectedTheme.accentClass} px-4 py-4 text-base font-semibold text-slate-950 shadow-[0_18px_50px_rgba(87,236,214,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60`}
                    onClick={finishScratch}
                    disabled={revealAllDisabled}
                    type="button"
                  >
                    {showSelectedClassicBoard ? "Instant Reveal" : revealAllLabel}
                  </button>
                ) : null}
                <div className="flex justify-center">
                  <button
                    className="min-w-[220px] rounded-full border border-[color:var(--panel-border-strong)] bg-white/90 px-5 py-3 text-sm font-semibold text-[color:var(--foreground-strong)] shadow-[0_14px_30px_rgba(0,0,0,0.08)] transition hover:bg-white"
                    onClick={() => setIsMuted((value) => !value)}
                    type="button"
                  >
                    {isMuted ? "Sound Off" : "Sound On"}
                  </button>
                </div>
              </div>
            ) : null}

          </section>
          )}
      </section>
    </div>

      {isCompactViewport && isTicketMenuOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Close ticket access panel"
            className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
            onClick={() => setIsTicketMenuOpen(false)}
            type="button"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[30px] border border-white/10 bg-[#081527] px-4 pb-6 pt-5 shadow-[0_-30px_90px_rgba(0,0,0,0.45)] md:left-1/2 md:bottom-6 md:w-[min(720px,calc(100vw-2rem))] md:max-h-[80vh] md:-translate-x-1/2 md:overflow-y-auto md:rounded-[30px] md:px-6">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/18" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.32em] text-cyan-200/58">Ticket Access</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Free play is unlocked</h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Every ticket now launches for free and uses the current gold payout table.
                </p>
              </div>
              <div className="rounded-[20px] border border-cyan-300/15 bg-cyan-400/8 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/55">Balance</div>
                <div className="mt-2 text-3xl font-semibold text-white">{balance}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {tickets.map((ticket) => {
                const active = ticket.id === selectedTicketId;
                return (
                  <button
                    key={`sheet-${ticket.id}`}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      active
                        ? "border-cyan-300/35 bg-cyan-400/12 shadow-[0_18px_40px_rgba(96,188,255,0.16)]"
                        : "border-white/8 bg-white/4 hover:bg-white/7"
                    }`}
                    onClick={() => chooseTicket(ticket.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-white">{ticket.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.24em] text-white/42">Gold payout table</div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-semibold text-white">
                        Free
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/55">
                      <span>Possible prizes: {getDisplayedTicketPrizes(selectedThemeId, ticket.prizes).join(", ")}</span>
                      <span className="text-teal-200">Ready to play</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {showGameLaunchOverlay ? (
        <MobileGameFlowShell
          stage={mobileGameStage}
          balance={balance}
          logoSrc={selectedTheme.logoSrc}
          logoAlt={selectedTheme.logoAlt}
          accentClass={selectedTheme.accentClass}
          backgroundClass={launchSkin.shell}
          isMuted={isMuted}
          onPlayNow={beginCompactGameplay}
          onToggleSound={() => setIsMuted((value) => !value)}
          gameplay={null}
        />
      ) : null}

      {isCompactViewport && (!showCompactPlayLayout || showGameLaunchOverlay || mobileGameStage === "playing") ? (
        <MobileBottomNav items={mobileNavItems} />
      ) : null}

      {isCompactViewport && isReplaySheetOpen && isRevealed ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close next ticket prompt"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setIsReplaySheetOpen(false)}
            type="button"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[30px] border border-white/10 bg-[#081527] px-4 pb-6 pt-5 shadow-[0_-30px_90px_rgba(0,0,0,0.45)] md:left-1/2 md:bottom-6 md:w-[min(760px,calc(100vw-2rem))] md:-translate-x-1/2 md:rounded-[30px] md:px-6">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/18" />
            <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/60">Next Ticket</div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{resultTone}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Jump straight into another free {promptTheme.title} ticket whenever you&apos;re ready.
                    </p>
                  </div>
                <div className="rounded-[20px] border border-cyan-300/15 bg-cyan-400/8 px-4 py-3 text-right">
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/55">Balance</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{balance}</div>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/18 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/58">{promptTheme.title}</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="mt-2 text-xs uppercase tracking-[0.24em] text-white/42">Ticket Access</div>
                    <div className="mt-2 text-xl font-semibold text-white">Unlimited free play</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-white/58">
                  Every ticket launches for free and pays out on the current gold table.
                </div>
              </div>

              <div className="mt-4">
                <button
                  className={`rounded-[22px] bg-gradient-to-r ${promptTheme.accentClass} px-4 py-3 font-semibold text-slate-950 shadow-[0_18px_50px_rgba(87,236,214,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60`}
                  onClick={() => {
                    void buyTicket(undefined, { launchFlow: true });
                  }}
                  disabled={busy || !promptTicket || !canReplayTicket}
                  type="button"
                >
                  {busy ? "Working..." : "Play Again"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .sb-win-ring {
          position: absolute;
          inset: -10%;
          border-radius: 9999px;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.55), 0 0 24px rgba(255, 215, 0, 0.45);
          animation: sbPulse 900ms ease-in-out infinite;
        }
        .sb-symbol-focus {
          border-radius: 9999px;
          background:
            radial-gradient(circle at 32% 28%, rgba(255,255,255,0.82), rgba(255,255,255,0.44) 40%, rgba(227,220,209,0.12) 72%, transparent 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.62),
            0 4px 14px rgba(28, 20, 8, 0.1);
        }
        .sb-symbol-img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          transform: translateZ(0);
        }
        .sb-symbol-img-color {
          filter: drop-shadow(0 2px 5px rgba(0,0,0,0.22)) contrast(1.12) brightness(0.98) saturate(1.08);
        }
        .sb-symbol-img-bw {
          filter: grayscale(1) drop-shadow(0 2px 5px rgba(0,0,0,0.24)) contrast(1.65) brightness(0.68);
        }
        .sb-bounce {
          animation: sbBounce 700ms cubic-bezier(0.28, 0.84, 0.42, 1) both;
        }
        .sb-banner-win {
          animation: sbPop 260ms ease-out 1;
          transform-origin: 50% 100%;
        }
        .sbb-board {
          background:
            radial-gradient(circle at 50% 12%, rgba(255,215,124,0.26), transparent 24%),
            radial-gradient(circle at 14% 20%, rgba(255,173,84,0.18), transparent 18%),
            radial-gradient(circle at 86% 18%, rgba(104,201,255,0.14), transparent 20%),
            linear-gradient(180deg, #3b2415 0%, #7d4b22 18%, #143657 45%, #0d2340 66%, #071323 100%);
        }
        .sbb-sky-glow,
        .sbb-chart-lines,
        .sbb-sea-band,
        .sbb-water-glow,
        .sbb-coins,
        .sbb-logo-stage,
        .sbb-logo-halo,
        .sbb-zone-glow,
        .sbb-zone-rivets {
          position: absolute;
          pointer-events: none;
        }
        .sbb-sky-glow {
          border-radius: 9999px;
          filter: blur(28px);
          mix-blend-mode: screen;
          opacity: 0.72;
        }
        .sbb-sky-glow-a {
          inset: 6% 14% auto 14%;
          height: 18%;
          background: radial-gradient(circle at center, rgba(255,224,156,0.54), rgba(255,224,156,0));
        }
        .sbb-sky-glow-b {
          inset: 18% 6% auto auto;
          width: 22%;
          height: 14%;
          background: radial-gradient(circle at center, rgba(124,218,255,0.24), rgba(124,218,255,0));
        }
        .sbb-chart-lines {
          inset: 0;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 24%) top / 100% 18% no-repeat,
            repeating-linear-gradient(90deg, rgba(255,238,198,0.06) 0 1px, transparent 1px 56px),
            repeating-linear-gradient(180deg, rgba(255,238,198,0.05) 0 1px, transparent 1px 44px),
            repeating-linear-gradient(135deg, rgba(255,220,168,0.04) 0 2px, transparent 2px 74px);
          opacity: 0.78;
        }
        .sbb-sea-band {
          left: 0;
          right: 0;
          bottom: 0;
          height: 40%;
          background:
            linear-gradient(180deg, rgba(34,130,198,0.12), rgba(13,72,130,0.28) 22%, rgba(7,36,72,0.84) 100%),
            repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0 1px, rgba(255,255,255,0) 1px 16px);
        }
        .sbb-water-glow {
          left: 14%;
          right: 14%;
          bottom: 15%;
          height: 16%;
          border-radius: 9999px;
          background: radial-gradient(circle at center, rgba(99,214,255,0.3), rgba(99,214,255,0));
          filter: blur(18px);
          opacity: 0.72;
        }
        .sbb-coins {
          width: 18%;
          height: 14%;
          border-radius: 9999px;
          filter: blur(0.2px);
          opacity: 0.84;
          background:
            radial-gradient(circle at 12% 52%, rgba(255,227,143,0.94) 0 11%, transparent 12%),
            radial-gradient(circle at 32% 26%, rgba(255,211,92,0.94) 0 10%, transparent 11%),
            radial-gradient(circle at 54% 64%, rgba(255,229,147,0.94) 0 11%, transparent 12%),
            radial-gradient(circle at 76% 34%, rgba(255,210,98,0.94) 0 10%, transparent 11%),
            radial-gradient(circle at 88% 70%, rgba(255,234,160,0.9) 0 9%, transparent 10%);
        }
        .sbb-coins-left {
          left: 4%;
          top: 18%;
          transform: rotate(-8deg);
        }
        .sbb-coins-right {
          right: 4%;
          top: 23%;
          transform: rotate(8deg);
        }
        .sbb-logo-stage {
          inset: 0 0 auto;
          height: 54%;
        }
        .sbb-logo-halo {
          border-radius: 9999px;
          filter: blur(20px);
          mix-blend-mode: screen;
        }
        .sbb-logo-halo-a {
          inset: 7% 8% 18%;
          background: radial-gradient(circle at center, rgba(255,218,134,0.34), rgba(255,218,134,0));
        }
        .sbb-logo-halo-b {
          inset: 16% 14% 8%;
          background: radial-gradient(circle at center, rgba(122,214,255,0.18), rgba(122,214,255,0));
        }
        .sbb-logo-frame {
          position: absolute;
          inset: -0.8% 1.4% -0.8%;
          overflow: hidden;
        }
        .sbb-logo-main-img {
          position: absolute;
          left: 50%;
          top: -1.6%;
          width: 108%;
          height: auto;
          max-width: none;
          transform: translateX(-50%);
          filter: drop-shadow(0 20px 44px rgba(0,0,0,0.28));
        }
        .sbb-zone-shell {
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(circle at 50% -12%, rgba(255,240,194,0.34), rgba(255,240,194,0) 52%),
            linear-gradient(180deg, rgba(191,132,62,0.94), rgba(112,66,27,0.96));
          border: 1px solid rgba(255,224,169,0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,245,217,0.28),
            0 18px 32px rgba(18,10,4,0.22);
        }
        .sbb-zone-frame {
          pointer-events: none;
          z-index: 3;
          border: none;
          background:
            linear-gradient(180deg, rgba(255,225,164,0.18), rgba(255,225,164,0.02)),
            linear-gradient(135deg, #e2bb73 0%, #8f5d2a 42%, #4f3017 100%);
          box-shadow:
            inset 0 0 0 2px rgba(255,232,191,0.2),
            inset 0 0 0 10px rgba(42,22,10,0.48),
            0 0 0 1px rgba(255,214,147,0.12);
        }
        .sbb-zone-frame::before,
        .sbb-zone-frame::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }
        .sbb-zone-frame::before {
          inset: 2.2%;
          background:
            linear-gradient(180deg, rgba(255,244,214,0.3), rgba(255,244,214,0) 16%) top / 100% 18% no-repeat,
            linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.24)) bottom / 100% 28% no-repeat;
          opacity: 0.9;
        }
        .sbb-zone-frame::after {
          inset: -1.1%;
          background:
            radial-gradient(circle at 4% 50%, rgba(255,226,160,0.84) 0 4px, rgba(86,52,22,0.94) 4.5px 8px, transparent 8.5px) 0 0 / 11.2% 100% repeat-y,
            radial-gradient(circle at 96% 50%, rgba(255,226,160,0.84) 0 4px, rgba(86,52,22,0.94) 4.5px 8px, transparent 8.5px) 100% 0 / 11.2% 100% repeat-y,
            radial-gradient(circle at 50% 6%, rgba(255,226,160,0.84) 0 4px, rgba(86,52,22,0.94) 4.5px 8px, transparent 8.5px) 0 0 / 100% 16% repeat-x,
            radial-gradient(circle at 50% 94%, rgba(255,226,160,0.84) 0 4px, rgba(86,52,22,0.94) 4.5px 8px, transparent 8.5px) 0 100% / 100% 16% repeat-x;
          opacity: 0.74;
        }
        .sbb-zone {
          position: absolute;
          z-index: 1;
          overflow: hidden;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,235,193,0.16), rgba(255,235,193,0) 24%),
            radial-gradient(circle at 18% 16%, rgba(255,174,98,0.12), rgba(255,174,98,0) 20%),
            radial-gradient(circle at 82% 14%, rgba(108,208,255,0.12), rgba(108,208,255,0) 22%),
            linear-gradient(180deg, rgba(30,55,92,0.96), rgba(13,34,62,0.98) 46%, rgba(7,19,36,1) 100%);
          border: 1px solid rgba(255,223,170,0.12);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.04),
            inset 0 18px 34px rgba(255,255,255,0.06);
        }
        .sbb-zone::before,
        .sbb-zone::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }
        .sbb-zone::before {
          background:
            repeating-linear-gradient(90deg, rgba(255,240,211,0.05) 0 1px, transparent 1px 54px),
            repeating-linear-gradient(180deg, rgba(255,240,211,0.04) 0 1px, transparent 1px 42px),
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 18%);
          opacity: 0.8;
        }
        .sbb-zone::after {
          background:
            radial-gradient(circle, rgba(255,245,219,0.82) 0 1.2px, transparent 1.8px),
            radial-gradient(circle, rgba(138,220,255,0.76) 0 1.1px, transparent 1.7px);
          background-size: 200px 200px, 260px 260px;
          background-position: 0 0, 54px 62px;
          opacity: 0.42;
        }
        .sbb-zone-glow {
          border-radius: 9999px;
          filter: blur(22px);
          mix-blend-mode: screen;
          opacity: 0.54;
        }
        .sbb-zone-glow-a {
          inset: 2% auto auto 10%;
          width: 34%;
          height: 14%;
          background: radial-gradient(circle at center, rgba(255,193,106,0.34), rgba(255,193,106,0));
        }
        .sbb-zone-glow-b {
          inset: auto 8% 8% auto;
          width: 26%;
          height: 12%;
          background: radial-gradient(circle at center, rgba(97,203,255,0.28), rgba(97,203,255,0));
        }
        .sbb-zone-rivets {
          inset: 0;
          background:
            radial-gradient(circle, rgba(255,224,162,0.86) 0 2.6px, rgba(76,48,22,0.94) 2.8px 5.2px, transparent 5.4px) 2.4% 50% / 100% 24% repeat-y,
            radial-gradient(circle, rgba(255,224,162,0.86) 0 2.6px, rgba(76,48,22,0.94) 2.8px 5.2px, transparent 5.4px) 97.6% 50% / 100% 24% repeat-y,
            radial-gradient(circle, rgba(255,224,162,0.86) 0 2.6px, rgba(76,48,22,0.94) 2.8px 5.2px, transparent 5.4px) 50% 2.2% / 16% 100% repeat-x,
            radial-gradient(circle, rgba(255,224,162,0.86) 0 2.6px, rgba(76,48,22,0.94) 2.8px 5.2px, transparent 5.4px) 50% 97.8% / 16% 100% repeat-x;
          opacity: 0.32;
        }
        .sbb-symbol-card {
          position: relative;
          border-radius: 28px;
          background: transparent;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }
        .sbb-symbol-card::before {
          content: "";
          position: absolute;
          inset: 7% 12% auto;
          height: 14%;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0));
          filter: blur(4px);
          opacity: 0;
        }
        .sbb-symbol-card-win {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 18%, rgba(12,25,42,0.12) 100%);
          border: 1px solid rgba(234,210,167,0.16);
          border-color: color-mix(in srgb, var(--sbb-glow) 58%, #ffd28c 42%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 -12px 22px rgba(0,0,0,0.14),
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -18px 28px rgba(0,0,0,0.18),
            0 0 0 1px color-mix(in srgb, var(--sbb-glow) 54%, #ffe1a6 46%),
            0 0 20px var(--sbb-glow),
            0 12px 18px rgba(0,0,0,0.14);
          backdrop-filter: blur(1.5px);
        }
        .sbb-symbol-card-win::before {
          opacity: 0.75;
        }
        .sbb-symbol-img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          transform: translateZ(0);
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.2));
        }
        .sbb-symbol-img-win {
          filter:
            drop-shadow(0 0 18px color-mix(in srgb, var(--sbb-glow) 58%, white 42%))
            drop-shadow(0 10px 18px rgba(0,0,0,0.22));
        }
        .sbb-symbol-pulse {
          position: absolute;
          inset: -8%;
          border-radius: 30px;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--sbb-glow) 66%, #ffd9a5 34%), 0 0 24px var(--sbb-glow);
          animation: sbPulse 900ms ease-in-out infinite;
        }
        .sbb-win-fx {
          position: absolute;
          z-index: 5;
          overflow: hidden;
          pointer-events: none;
        }
        .sbb-win-bloom,
        .sbb-win-spark,
        .sbb-win-glint,
        .sbb-win-wake,
        .sbb-win-spray,
        .sbb-win-ship,
        .sbb-win-video-wrap,
        .sbb-win-video,
        .sbb-win-badge,
        .pbt-win-card {
          position: absolute;
          pointer-events: none;
        }
        .sbb-win-bloom {
          inset: 10% 12% 20%;
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(255,229,164,0.42), rgba(255,188,86,0.14) 34%, rgba(255,188,86,0) 70%);
          filter: blur(22px);
          opacity: 0;
          transform: scale(0.82);
        }
        .sbb-win-spark {
          inset: 0;
          background:
            radial-gradient(circle, rgba(255,248,224,0.9) 0 1.5px, transparent 1.9px) 18% 32% / 22% 22% no-repeat,
            radial-gradient(circle, rgba(255,208,117,0.92) 0 1.8px, transparent 2.2px) 76% 28% / 18% 18% no-repeat,
            radial-gradient(circle, rgba(255,248,224,0.9) 0 1.4px, transparent 1.8px) 28% 72% / 20% 20% no-repeat,
            radial-gradient(circle, rgba(122,215,255,0.86) 0 1.6px, transparent 2px) 68% 70% / 24% 24% no-repeat,
            radial-gradient(circle, rgba(255,248,224,0.92) 0 1.6px, transparent 2px) 88% 54% / 18% 18% no-repeat;
          opacity: 0;
        }
        .sbb-win-glint {
          border-radius: 9999px;
          border: 2px solid rgba(255,223,164,0.7);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.18) inset,
            0 0 18px rgba(255,196,109,0.24);
          opacity: 0;
          transform: scale(0.62);
        }
        .pbt-win-card {
          left: 50%;
          bottom: -1.8%;
          width: min(40%, 300px);
          padding: 16px 18px 15px;
          transform: translate(-50%, 10px) scale(0.92);
          transform-origin: 50% 100%;
          border-radius: 26px;
          background:
            radial-gradient(circle at 18% 20%, rgba(255,233,196,0.16), rgba(255,233,196,0) 28%),
            linear-gradient(180deg, rgba(57,29,14,0.95), rgba(24,12,6,0.97) 58%, rgba(14,8,4,0.99) 100%);
          border: 1px solid rgba(255,202,118,0.28);
          box-shadow:
            inset 0 1px 0 rgba(255,248,230,0.1),
            inset 0 -14px 24px rgba(0,0,0,0.18),
            0 18px 36px rgba(14,8,3,0.28),
            0 0 18px rgba(255,187,84,0.1);
          opacity: 0;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          z-index: 8;
          pointer-events: auto;
        }
        .pbt-win-card::before {
          content: "";
          position: absolute;
          inset: 10px 12px auto;
          height: 1px;
          background: linear-gradient(90deg, rgba(255,196,103,0), rgba(255,196,103,0.55), rgba(255,196,103,0));
          opacity: 0.72;
        }
        .pbt-win-card-label {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(255,216,156,0.74);
          text-align: center;
        }
        .pbt-win-card-amount {
          font-size: clamp(1.4rem, 3.2vw, 2.35rem);
          font-weight: 900;
          line-height: 1.02;
          color: #fff8ea;
          text-align: center;
          text-shadow:
            0 2px 0 rgba(84,45,17,0.3),
            0 0 16px rgba(255,238,194,0.38);
        }
        .sbb-win-video-wrap {
          left: 8%;
          right: 8%;
          top: 10%;
          bottom: 12%;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(255,216,142,0.22);
          background:
            linear-gradient(180deg, rgba(5,13,24,0.55), rgba(5,13,24,0.2)),
            rgba(6,14,26,0.18);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.04),
            0 18px 48px rgba(0,0,0,0.26);
          transform: scale(0.96) translateY(2%);
          transform-origin: 50% 50%;
          opacity: 0;
          z-index: 3;
        }
        .sbb-win-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter:
            saturate(1.08)
            contrast(1.04)
            drop-shadow(0 12px 28px rgba(43, 20, 6, 0.22));
        }
        .sbb-win-wake {
          left: 12%;
          right: 12%;
          bottom: 5.2%;
          width: auto;
          height: 8%;
          transform: translateX(-50%) scale(0.86);
          border-radius: 9999px;
          background:
            radial-gradient(ellipse at center, rgba(208,246,255,0.72) 0 18%, rgba(208,246,255,0.22) 35%, rgba(208,246,255,0) 68%),
            linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.72), rgba(255,255,255,0));
          filter: blur(7px);
          opacity: 0;
          z-index: 1;
        }
        .sbb-win-spray {
          left: 10%;
          right: 10%;
          bottom: 4.5%;
          width: auto;
          height: 14%;
          transform: none;
          background:
            radial-gradient(circle at 18% 78%, rgba(255,255,255,0.86) 0 3px, transparent 4px),
            radial-gradient(circle at 26% 46%, rgba(214,245,255,0.78) 0 2.5px, transparent 3.5px),
            radial-gradient(circle at 36% 72%, rgba(255,255,255,0.82) 0 2px, transparent 3px),
            radial-gradient(circle at 64% 74%, rgba(255,255,255,0.84) 0 3px, transparent 4px),
            radial-gradient(circle at 72% 42%, rgba(214,245,255,0.76) 0 2.5px, transparent 3.5px),
            radial-gradient(circle at 82% 76%, rgba(255,255,255,0.82) 0 2.5px, transparent 3.5px),
            radial-gradient(ellipse at center, rgba(112,196,255,0.3), rgba(112,196,255,0) 62%);
          filter: blur(1.8px);
          opacity: 0;
          z-index: 2;
        }
        .sbb-win-ship {
          left: 50%;
          bottom: 15.2%;
          width: min(52%, 306px);
          height: auto;
          transform: translate(-50%, 26%) scale(0.42);
          transform-origin: 50% 100%;
          filter:
            drop-shadow(0 16px 30px rgba(27, 12, 2, 0.28))
            drop-shadow(0 0 22px rgba(255, 199, 109, 0.18));
          opacity: 0;
          z-index: 7;
        }
        .sbb-win-fx-intro .sbb-win-bloom,
        .sbb-win-fx-countUp .sbb-win-bloom,
        .sbb-win-fx-hero .sbb-win-bloom,
        .sbb-win-fx-done .sbb-win-bloom {
          opacity: 1;
        }
        .sbb-win-fx-intro .sbb-win-bloom {
          animation: sbbWinBloomIn 380ms ease-out forwards;
        }
        .sbb-win-fx-countUp .sbb-win-bloom,
        .sbb-win-fx-hero .sbb-win-bloom,
        .sbb-win-fx-done .sbb-win-bloom {
          transform: scale(1);
        }
        .sbb-win-fx-intro .sbb-win-spark,
        .sbb-win-fx-countUp .sbb-win-spark,
        .sbb-win-fx-hero .sbb-win-spark,
        .sbb-win-fx-done .sbb-win-spark {
          opacity: 1;
          animation: sbbWinSparkle 1400ms ease-in-out infinite;
        }
        .sbb-win-fx-intro .sbb-win-glint,
        .sbb-win-fx-countUp .sbb-win-glint,
        .sbb-win-fx-hero .sbb-win-glint,
        .sbb-win-fx-done .sbb-win-glint {
          animation: sbbWinGlint 1200ms ease-out infinite;
        }
        .sbb-win-fx-hero .sbb-win-wake,
        .sbb-win-fx-done .sbb-win-wake,
        .sbb-win-fx-hero .sbb-win-spray,
        .sbb-win-fx-done .sbb-win-spray {
          opacity: 1;
        }
        .sbb-win-fx-hero .sbb-win-wake,
        .sbb-win-fx-done .sbb-win-wake {
          animation: sbbWakePulse 1600ms ease-in-out infinite;
        }
        .sbb-win-fx-hero .sbb-win-spray,
        .sbb-win-fx-done .sbb-win-spray {
          animation: sbbSprayPulse 1100ms ease-in-out infinite;
        }
        .sbb-win-fx-countUp .sbb-win-ship,
        .sbb-win-fx-hero .sbb-win-ship,
        .sbb-win-fx-done .sbb-win-ship {
          opacity: 1;
        }
        .sbb-win-fx-countUp .sbb-win-ship {
          animation: sbbWinShipPop 680ms cubic-bezier(0.18, 0.88, 0.24, 1) forwards;
        }
        .sbb-win-fx-hero .sbb-win-ship,
        .sbb-win-fx-done .sbb-win-ship {
          transform: translate(-50%, 0%) scale(1);
          animation: sbbShipSway 2400ms ease-in-out infinite;
        }
        .sbb-win-fx-countUp .sbb-win-video-wrap,
        .sbb-win-fx-hero .sbb-win-video-wrap,
        .sbb-win-fx-done .sbb-win-video-wrap {
          opacity: 1;
        }
        .sbb-win-fx-countUp .sbb-win-video-wrap {
          transform: scale(1) translateY(0);
        }
        .sbb-win-fx-hero .sbb-win-video-wrap,
        .sbb-win-fx-done .sbb-win-video-wrap {
          transform: scale(1) translateY(0);
        }
        .sbb-win-fx-intro .pbt-win-card,
        .sbb-win-fx-countUp .pbt-win-card,
        .sbb-win-fx-hero .pbt-win-card,
        .sbb-win-fx-done .pbt-win-card {
          opacity: 1;
        }
        .sbb-win-fx-intro .pbt-win-card {
          animation: pbtWinCardIn 360ms ease-out forwards;
        }
        .sbb-win-fx-countUp .pbt-win-card,
        .sbb-win-fx-hero .pbt-win-card,
        .sbb-win-fx-done .pbt-win-card {
          transform: translate(-50%, 0) scale(1);
        }
        @media (min-width: 641px) {
          .sbb-win-fx {
            overflow: visible;
          }
          .sbb-win-ship {
            width: min(41%, 238px);
            bottom: 36.2%;
          }
          .pbt-win-card {
            bottom: -0.8%;
            width: min(39%, 276px);
            padding: 10px 14px 10px;
            gap: 5px;
          }
          .pbt-win-card-amount {
            margin-top: 8px;
            font-size: clamp(0.96rem, 2vw, 1.5rem);
          }
          .pbt-win-card .sbw-win-buy-again {
            margin-top: 6px;
            padding: 9px 14px;
            font-size: 0.74rem;
            letter-spacing: 0.22em;
            white-space: nowrap;
          }
        }
        @keyframes sbbWinBloomIn {
          0% {
            transform: scale(0.82);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pbtWinCardIn {
          0% {
            transform: translate(-50%, 10px) scale(0.9);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
        }
        @keyframes sbbWinSparkle {
          0%, 100% {
            opacity: 0.34;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.88;
            transform: scale(1.02);
          }
        }
        @keyframes sbbWinGlint {
          0% {
            transform: scale(0.62);
            opacity: 0;
          }
          22% {
            opacity: 0.78;
          }
          100% {
            transform: scale(1.22);
            opacity: 0;
          }
        }
        @keyframes sbbShipSway {
          0% {
            transform: translate(-50%, 0%) rotate(-1.2deg) translateY(0) scale(1);
          }
          20% {
            transform: translate(-50%, -1.6%) rotate(1.1deg) translateY(-1px) scale(1.01);
          }
          42% {
            transform: translate(-50%, -0.2%) rotate(-0.5deg) translateY(1px) scale(1.005);
          }
          68% {
            transform: translate(-50%, -1.2%) rotate(1.4deg) translateY(-2px) scale(1.012);
          }
          100% {
            transform: translate(-50%, 0%) rotate(-1.2deg) translateY(0) scale(1);
          }
        }
        @keyframes sbbWakePulse {
          0%, 100% {
            transform: translateX(-50%) scale(0.88, 0.94);
            opacity: 0.52;
          }
          50% {
            transform: translateX(-50%) scale(1.02, 1.08);
            opacity: 0.86;
          }
        }
        @keyframes sbbSprayPulse {
          0%, 100% {
            transform: translateX(-50%) scale(0.84) translateY(0);
            opacity: 0.4;
          }
          50% {
            transform: translateX(-50%) scale(1) translateY(-1.2%);
            opacity: 0.78;
          }
        }
        @keyframes sbbWinShipPop {
          0% {
            opacity: 0;
            transform: translate(-50%, 26%) scale(0.42);
          }
          42% {
            opacity: 1;
            transform: translate(-50%, -8%) scale(1.06);
          }
          68% {
            transform: translate(-50%, 3%) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0%) scale(1);
          }
        }
        @media (max-width: 640px) {
          .sbb-win-ship {
            width: min(40%, 188px);
            bottom: 24%;
          }
          .sbb-win-wake {
            left: 16%;
            right: 16%;
            bottom: 6%;
            height: 6%;
          }
          .sbb-win-spray {
            left: 14%;
            right: 14%;
            bottom: 5.2%;
            height: 9%;
          }
          .pbt-win-card {
            left: 50%;
            bottom: -3.2%;
            width: min(58%, 252px);
            padding: 9px 12px 8px;
            border-radius: 20px;
            gap: 4px;
          }
          .pbt-win-card::before {
            inset: 8px 10px auto;
          }
          .pbt-win-card-label {
            font-size: 0.54rem;
            letter-spacing: 0.16em;
          }
          .pbt-win-card-amount {
            font-size: clamp(0.96rem, 4vw, 1.38rem);
            line-height: 1;
          }
          .pbt-win-card .sbw-win-buy-again {
            margin-top: 7px;
            padding: 9px 12px;
            font-size: 0.64rem;
            letter-spacing: 0.1em;
            line-height: 1;
            white-space: nowrap;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
        @media (max-width: 480px) {
          .sbb-win-ship {
            width: min(38%, 154px);
            bottom: 25.8%;
          }
          .pbt-win-card {
            left: 50%;
            bottom: -4.2%;
            width: min(58%, 208px);
            padding: 8px 10px 8px;
            border-radius: 18px;
          }
          .pbt-win-card-label {
            font-size: 0.48rem;
            letter-spacing: 0.12em;
          }
          .pbt-win-card-amount {
            font-size: clamp(0.9rem, 3.8vw, 1.18rem);
          }
          .pbt-win-card .sbw-win-buy-again {
            margin-top: 6px;
            padding: 8px 10px;
            font-size: 0.6rem;
            letter-spacing: 0.08em;
            line-height: 1;
            white-space: nowrap;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
        .sbw-board {
          background:
            radial-gradient(circle at 50% 10%, rgba(255,236,184,0.26), transparent 24%),
            radial-gradient(circle at 18% 16%, rgba(255,207,124,0.16), transparent 18%),
            radial-gradient(circle at 84% 18%, rgba(215,207,183,0.14), transparent 20%),
            linear-gradient(180deg, #4b3a27 0%, #705233 16%, #6a4d2d 24%, #34404e 48%, #1b2c44 74%, #0a1730 100%);
        }
        .sbw-smoke,
        .sbw-lightshaft,
        .sbw-river-band,
        .sbw-river-glow,
        .sbw-cogs,
        .sbw-logo-stage,
        .sbw-logo-halo,
        .sbw-zone-steam,
        .sbw-zone-rivets {
          position: absolute;
          pointer-events: none;
        }
        .sbw-smoke {
          border-radius: 9999px;
          filter: blur(18px);
          background: radial-gradient(circle at center, rgba(240,240,240,0.72), rgba(240,240,240,0));
          opacity: 0.74;
        }
        .sbw-smoke-a {
          left: 9%;
          top: 5%;
          width: 34%;
          height: 12%;
        }
        .sbw-smoke-b {
          right: 8%;
          top: 8%;
          width: 28%;
          height: 11%;
          opacity: 0.56;
        }
        .sbw-lightshaft {
          top: 0;
          bottom: 56%;
          width: 18%;
          background: linear-gradient(180deg, rgba(255,245,208,0.18), rgba(255,245,208,0));
          filter: blur(10px);
          opacity: 0.7;
        }
        .sbw-lightshaft-a {
          left: 28%;
          transform: skewX(-6deg);
        }
        .sbw-lightshaft-b {
          right: 24%;
          transform: skewX(6deg);
        }
        .sbw-river-band {
          left: 0;
          right: 0;
          bottom: 0;
          height: 40%;
          background:
            linear-gradient(180deg, rgba(106,165,214,0.08), rgba(31,87,150,0.24) 22%, rgba(10,34,72,0.84) 100%),
            repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0 1px, rgba(255,255,255,0) 1px 20px);
        }
        .sbw-river-glow {
          left: 18%;
          right: 18%;
          bottom: 14%;
          height: 14%;
          border-radius: 9999px;
          background: radial-gradient(circle at center, rgba(123,212,255,0.22), rgba(123,212,255,0));
          filter: blur(14px);
          opacity: 0.72;
        }
        .sbw-cogs {
          width: 14%;
          aspect-ratio: 1;
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(255,220,151,0.96) 0 10%, transparent 11%),
            radial-gradient(circle at center, transparent 0 33%, rgba(98,65,30,0.88) 34% 42%, transparent 43%),
            repeating-conic-gradient(from 0deg, rgba(202,154,78,0.9) 0 12deg, rgba(110,73,36,0.96) 12deg 24deg);
          box-shadow: inset 0 0 0 2px rgba(255,226,173,0.24), 0 8px 20px rgba(0,0,0,0.18);
          opacity: 0.48;
        }
        .sbw-cogs-left {
          left: 3%;
          bottom: 18%;
        }
        .sbw-cogs-right {
          right: 4%;
          bottom: 22%;
          transform: scale(0.84);
        }
        .sbw-logo-stage {
          inset: 0 0 auto;
          height: 54%;
        }
        .sbw-logo-halo {
          border-radius: 9999px;
          filter: blur(18px);
          mix-blend-mode: screen;
        }
        .sbw-logo-halo-a {
          inset: 4% 10% 18%;
          background: radial-gradient(circle at center, rgba(255,225,151,0.34), rgba(255,225,151,0));
        }
        .sbw-logo-halo-b {
          inset: 14% 14% 6%;
          background: radial-gradient(circle at center, rgba(255,255,255,0.16), rgba(255,255,255,0));
        }
        .sbw-logo-frame {
          position: absolute;
          inset: 0% 1.5% 1%;
          overflow: hidden;
        }
        .sbw-logo-main-img {
          position: absolute;
          left: 50%;
          top: -0.5%;
          width: 116%;
          height: auto;
          max-width: none;
          transform: translateX(-50%);
          filter: drop-shadow(0 18px 42px rgba(0,0,0,0.26));
        }
        .sbw-zone-shell {
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(circle at 50% -10%, rgba(255,238,201,0.22), rgba(255,238,201,0) 48%),
            linear-gradient(180deg, rgba(181,140,81,0.94), rgba(94,65,33,0.96));
          border: 1px solid rgba(255,230,184,0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,245,222,0.24),
            0 18px 34px rgba(18,10,4,0.22);
        }
        .sbw-zone-frame {
          pointer-events: none;
          z-index: 3;
          background:
            linear-gradient(180deg, rgba(255,237,198,0.16), rgba(255,237,198,0.02)),
            linear-gradient(135deg, #dbbb7d 0%, #7f562c 42%, #412814 100%);
          box-shadow:
            inset 0 0 0 2px rgba(255,233,193,0.18),
            inset 0 0 0 9px rgba(40,23,12,0.42),
            0 0 0 1px rgba(255,214,147,0.1);
        }
        .sbw-zone-frame::before {
          content: "";
          position: absolute;
          inset: 2%;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,247,227,0.18), rgba(255,247,227,0) 16%) top / 100% 18% no-repeat,
            linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.2)) bottom / 100% 28% no-repeat;
          opacity: 0.9;
        }
        .sbw-zone {
          z-index: 1;
          overflow: hidden;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 8%, rgba(255,236,189,0.18), rgba(255,236,189,0) 22%),
            linear-gradient(180deg, rgba(92,72,47,0.95), rgba(46,36,26,0.98) 38%, rgba(18,33,54,0.98) 100%);
          border: 1px solid rgba(255,225,171,0.1);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.03),
            inset 0 18px 32px rgba(255,255,255,0.04);
        }
        .sbw-zone::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            repeating-linear-gradient(90deg, rgba(255,239,206,0.05) 0 1px, transparent 1px 52px),
            repeating-linear-gradient(180deg, rgba(255,239,206,0.04) 0 1px, transparent 1px 40px),
            linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 18%);
          opacity: 0.78;
        }
        .sbw-zone-steam {
          border-radius: 9999px;
          filter: blur(18px);
          mix-blend-mode: screen;
        }
        .sbw-zone-steam-a {
          inset: 4% auto auto 8%;
          width: 36%;
          height: 12%;
          background: radial-gradient(circle at center, rgba(255,240,224,0.22), rgba(255,240,224,0));
        }
        .sbw-zone-steam-b {
          inset: auto 8% 8% auto;
          width: 28%;
          height: 10%;
          background: radial-gradient(circle at center, rgba(108,188,255,0.18), rgba(108,188,255,0));
        }
        .sbw-zone-rivets {
          inset: 0;
          background:
            radial-gradient(circle, rgba(255,226,160,0.78) 0 2.4px, rgba(76,48,22,0.9) 2.6px 5px, transparent 5.2px) 2.4% 50% / 100% 24% repeat-y,
            radial-gradient(circle, rgba(255,226,160,0.78) 0 2.4px, rgba(76,48,22,0.9) 2.6px 5px, transparent 5.2px) 97.6% 50% / 100% 24% repeat-y,
            radial-gradient(circle, rgba(255,226,160,0.78) 0 2.4px, rgba(76,48,22,0.9) 2.6px 5px, transparent 5.2px) 50% 2.4% / 16% 100% repeat-x,
            radial-gradient(circle, rgba(255,226,160,0.78) 0 2.4px, rgba(76,48,22,0.9) 2.6px 5px, transparent 5.2px) 50% 97.6% / 16% 100% repeat-x;
          opacity: 0.28;
        }
        .sbw-symbol-card {
          position: relative;
          border-radius: 28px;
          background: transparent;
          border: none;
          box-shadow: none;
        }
        .sbw-symbol-card-win {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 18%, rgba(24,20,16,0.12) 100%);
          border: 1px solid color-mix(in srgb, var(--sbw-glow) 56%, #f4d59f 44%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 -12px 22px rgba(0,0,0,0.14),
            0 0 0 1px color-mix(in srgb, var(--sbw-glow) 54%, #ffe1a6 46%),
            0 0 18px var(--sbw-glow),
            0 12px 18px rgba(0,0,0,0.14);
          backdrop-filter: blur(1.2px);
        }
        .sbw-symbol-img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          transform: translateZ(0);
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.22));
        }
        .sbw-symbol-img-win {
          filter:
            drop-shadow(0 0 16px color-mix(in srgb, var(--sbw-glow) 58%, white 42%))
            drop-shadow(0 10px 18px rgba(0,0,0,0.24));
        }
        .sbw-symbol-pulse {
          position: absolute;
          inset: -8%;
          border-radius: 30px;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--sbw-glow) 66%, #f9e0b2 34%), 0 0 22px var(--sbw-glow);
          animation: sbPulse 900ms ease-in-out infinite;
        }
        .sbw-win-fx {
          position: absolute;
          z-index: 5;
          overflow: hidden;
          pointer-events: none;
        }
        .sbw-lose-fx {
          position: absolute;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .sbw-win-halo,
        .sbw-win-video-wrap,
        .sbw-win-video,
        .sbw-win-card,
        .sbw-lose-card {
          position: absolute;
          pointer-events: none;
        }
        .sbw-win-halo {
          left: 50%;
          top: 54%;
          width: 64%;
          height: 32%;
          transform: translate(-50%, -50%) scale(0.82);
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(255,236,180,0.42), rgba(255,210,136,0.16) 36%, rgba(255,210,136,0) 72%);
          filter: blur(18px);
          opacity: 0;
        }
        .sbw-win-video-wrap {
          left: 6%;
          right: 6%;
          top: 8%;
          bottom: 10%;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(255,230,184,0.18);
          background:
            linear-gradient(180deg, rgba(19,12,7,0.26), rgba(19,12,7,0.08)),
            rgba(12,8,6,0.2);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.04),
            0 18px 42px rgba(0,0,0,0.24);
          transform: scale(0.96) translateY(2%);
          transform-origin: 50% 50%;
          opacity: 0;
          z-index: 1;
        }
        .sbw-win-video {
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.04) contrast(1.03);
        }
        .sbw-win-card {
          left: 5%;
          top: 7%;
          min-width: 28%;
          max-width: 38%;
          padding: 16px 20px;
          transform: scale(0.82);
          transform-origin: 0% 0%;
          border-radius: 24px;
          background:
            radial-gradient(circle at 20% 18%, rgba(255,255,255,0.14), rgba(255,255,255,0) 26%),
            linear-gradient(180deg, rgba(34,23,14,0.94), rgba(17,11,7,0.97) 100%);
          border: 1px solid rgba(255,236,201,0.22);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 -14px 24px rgba(0,0,0,0.16),
            0 18px 32px rgba(0,0,0,0.26),
            0 0 24px rgba(255,206,116,0.12);
          opacity: 0;
          text-align: left;
          backdrop-filter: blur(1.5px);
          z-index: 3;
          transition:
            right 420ms ease,
            bottom 420ms ease,
            min-width 420ms ease,
            max-width 420ms ease,
            padding 420ms ease,
            border-radius 420ms ease,
            transform 420ms ease,
            box-shadow 420ms ease,
            background 420ms ease;
        }
        .sbw-lose-card {
          left: 50%;
          top: 50%;
          min-width: min(74%, 420px);
          max-width: min(74%, 420px);
          padding: 24px 24px 20px;
          border-radius: 28px;
          transform: translate(-50%, -50%);
          background:
            radial-gradient(circle at 20% 18%, rgba(255,255,255,0.18), rgba(255,255,255,0) 26%),
            linear-gradient(180deg, rgba(28,18,11,0.96), rgba(12,8,5,0.98) 100%);
          border: 1px solid rgba(255,236,201,0.22);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -14px 24px rgba(60,34,13,0.18),
            0 26px 48px rgba(0,0,0,0.34),
            0 0 44px rgba(255,225,151,0.12);
          text-align: center;
          backdrop-filter: blur(1.5px);
          z-index: 3;
          pointer-events: auto;
        }
        .sbw-win-label {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255,220,162,0.7);
          margin-bottom: 8px;
        }
        .sbw-lose-title {
          font-size: clamp(1.7rem, 3.6vw, 2.6rem);
          font-weight: 900;
          line-height: 1.05;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #fff8ea;
          text-shadow:
            0 2px 0 rgba(84,45,17,0.28),
            0 0 16px rgba(255,238,194,0.18);
          margin-bottom: 16px;
        }
        .sbw-win-amount {
          font-size: clamp(1.4rem, 3.2vw, 2.3rem);
          font-weight: 900;
          line-height: 1;
          color: #fff8ea;
          text-shadow:
            0 2px 0 rgba(84,45,17,0.28),
            0 0 16px rgba(255,238,194,0.28);
        }
        .sbw-win-card-expanded {
          left: 50%;
          right: auto;
          bottom: 50%;
          min-width: min(74%, 420px);
          max-width: min(74%, 420px);
          padding: 24px 24px 20px;
          border-radius: 28px;
          transform: translate(-50%, 50%) scale(1.02);
          background:
            radial-gradient(circle at 20% 18%, rgba(255,255,255,0.18), rgba(255,255,255,0) 26%),
            linear-gradient(180deg, rgba(28,18,11,0.96), rgba(12,8,5,0.98) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -14px 24px rgba(60,34,13,0.18),
            0 26px 48px rgba(0,0,0,0.34),
            0 0 44px rgba(255,225,151,0.18);
          text-align: center;
          pointer-events: auto;
        }
        .sbw-win-card-expanded .sbw-win-label {
          text-align: center;
        }
        .sbw-win-card-expanded .sbw-win-amount {
          font-size: clamp(2rem, 4vw, 3rem);
        }
        .sbw-win-buy-again {
          margin-top: 16px;
          width: 100%;
          border-radius: 18px;
          border: 1px solid rgba(255,203,74,0.55);
          background: linear-gradient(180deg,#ffd95c 0%,#ffad2f 100%);
          padding: 12px 20px;
          font-size: 0.82rem;
          font-weight: 900;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #230f00;
          box-shadow: 0 16px 32px rgba(255,175,43,0.35);
          transition: filter 180ms ease, opacity 180ms ease;
          pointer-events: auto;
        }
        .sbw-win-buy-again:hover {
          filter: brightness(1.05);
        }
        .sbw-win-buy-again:disabled {
          cursor: default;
          opacity: 0.45;
        }
        .sbw-win-fx-intro .sbw-win-halo,
        .sbw-win-fx-countUp .sbw-win-halo,
        .sbw-win-fx-done .sbw-win-halo {
          opacity: 1;
        }
        .sbw-win-fx-intro .sbw-win-halo {
          animation: sbwWinHaloIn 340ms ease-out forwards;
        }
        .sbw-win-fx-countUp .sbw-win-halo {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.82;
        }
        .sbw-win-fx-done .sbw-win-halo {
          transform: translate(-50%, -50%) scale(1.08);
          opacity: 0.92;
        }
        .sbw-win-fx-countUp .sbw-win-video-wrap,
        .sbw-win-fx-done .sbw-win-video-wrap {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        .sbw-win-fx-intro .sbw-win-card,
        .sbw-win-fx-countUp .sbw-win-card,
        .sbw-win-fx-done .sbw-win-card {
          opacity: 1;
        }
        .sbw-win-fx-intro .sbw-win-card {
          animation: sbwWinCardIn 360ms ease-out forwards;
        }
        .sbw-win-fx-countUp .sbw-win-card {
          transform: scale(1);
        }
        .sbw-win-fx-done .sbw-win-card {
          transform: scale(1.06);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.1),
            inset 0 -14px 24px rgba(60,34,13,0.18),
            0 20px 34px rgba(0,0,0,0.24),
            0 0 34px rgba(255,225,151,0.16);
        }
        .sbw-win-fx-done .sbw-win-card-expanded {
          transform: translate(-50%, 50%) scale(1.02);
        }
        @keyframes sbwWinHaloIn {
          0% {
            transform: translate(-50%, -50%) scale(0.82);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.82;
          }
        }
        @keyframes sbwWinCardIn {
          0% {
            transform: scale(0.82);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .bs-board {
          background:
            radial-gradient(circle at 50% 8%, rgba(210,239,255,0.18), transparent 22%),
            radial-gradient(circle at 18% 18%, rgba(69,175,255,0.18), transparent 18%),
            radial-gradient(circle at 82% 16%, rgba(255,171,97,0.12), transparent 20%),
            linear-gradient(180deg, #081427 0%, #0d2743 32%, #0b3056 54%, #082341 100%);
        }
        .bs-board-glow,
        .bs-radar-grid,
        .bs-sea-band,
        .bs-fleet-shadow,
        .bs-logo-stage,
        .bs-logo-halo,
        .bs-zone-radar,
        .bs-zone-swell {
          position: absolute;
          pointer-events: none;
        }
        .bs-board-glow {
          border-radius: 9999px;
          filter: blur(24px);
          mix-blend-mode: screen;
        }
        .bs-board-glow-a {
          inset: 4% 14% auto;
          height: 16%;
          background: radial-gradient(circle at center, rgba(183,239,255,0.3), rgba(183,239,255,0));
        }
        .bs-board-glow-b {
          inset: auto 10% 14%;
          height: 12%;
          background: radial-gradient(circle at center, rgba(112,196,255,0.2), rgba(112,196,255,0));
        }
        .bs-radar-grid {
          left: 50%;
          top: 6%;
          width: 46%;
          aspect-ratio: 1 / 1;
          transform: translateX(-50%);
          border-radius: 50%;
          border: 2px solid rgba(150,226,255,0.18);
          background:
            radial-gradient(circle at center, transparent 0 24%, rgba(140,224,255,0.14) 24.5% 25.5%, transparent 26% 49%, rgba(140,224,255,0.12) 49.5% 50.5%, transparent 51%),
            repeating-linear-gradient(90deg, rgba(171,234,255,0.12) 0 1px, transparent 1px 10.5%),
            repeating-linear-gradient(180deg, rgba(171,234,255,0.12) 0 1px, transparent 1px 10.5%);
          box-shadow: 0 0 42px rgba(77,186,255,0.14);
          opacity: 0.9;
        }
        .bs-sea-band {
          left: -10%;
          right: -10%;
          bottom: -2%;
          height: 28%;
          background:
            radial-gradient(circle at 30% 36%, rgba(255,255,255,0.16), rgba(255,255,255,0) 20%),
            linear-gradient(180deg, rgba(29,112,181,0.1), rgba(10,45,86,0.72));
          filter: blur(4px);
        }
        .bs-sea-band-b {
          bottom: 10%;
          height: 12%;
          opacity: 0.5;
        }
        .bs-fleet-shadow {
          bottom: 20%;
          width: 24%;
          height: 7%;
          border-radius: 9999px;
          background: radial-gradient(circle at center, rgba(0,0,0,0.36), rgba(0,0,0,0));
          filter: blur(10px);
        }
        .bs-fleet-shadow-left {
          left: 12%;
        }
        .bs-fleet-shadow-right {
          right: 12%;
        }
        .bs-logo-stage {
          inset: 0 0 auto;
          height: 54%;
        }
        .bs-logo-halo {
          border-radius: 9999px;
          filter: blur(18px);
        }
        .bs-logo-halo-a {
          inset: 4% 16% 20%;
          background: radial-gradient(circle at center, rgba(110,194,255,0.28), rgba(110,194,255,0));
        }
        .bs-logo-halo-b {
          inset: 12% 20% 2%;
          background: radial-gradient(circle at center, rgba(255,167,90,0.18), rgba(255,167,90,0));
        }
        .bs-logo-frame {
          position: absolute;
          inset: -3.8% -3.2% auto;
          height: 100%;
          overflow: hidden;
        }
        .bs-logo-main-img {
          width: 100%;
          height: auto;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 16px 34px rgba(0,0,0,0.3));
        }
        .bs-zone-shell {
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(circle at 50% -10%, rgba(216,244,255,0.18), rgba(216,244,255,0) 46%),
            linear-gradient(180deg, rgba(53,114,173,0.96), rgba(11,48,90,0.98));
          border: 1px solid rgba(176,231,255,0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.16),
            0 16px 32px rgba(0,0,0,0.24);
        }
        .bs-zone-frame {
          pointer-events: none;
          z-index: 3;
          background:
            linear-gradient(180deg, rgba(213,246,255,0.16), rgba(213,246,255,0.04)),
            linear-gradient(135deg, #cdeeff 0%, #478bca 44%, #0f3d6f 100%);
          box-shadow:
            inset 0 0 0 2px rgba(224,247,255,0.18),
            inset 0 0 0 8px rgba(4,24,46,0.46),
            0 0 0 1px rgba(162,229,255,0.12);
        }
        .bs-zone {
          z-index: 1;
          overflow: hidden;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 8%, rgba(218,244,255,0.08), rgba(218,244,255,0) 22%),
            linear-gradient(180deg, rgba(13,56,102,0.96), rgba(9,40,76,0.98) 44%, rgba(6,23,47,0.98) 100%);
          border: 1px solid rgba(182,231,255,0.1);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.03),
            inset 0 18px 28px rgba(255,255,255,0.03);
        }
        .bs-zone::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            repeating-linear-gradient(90deg, rgba(170,233,255,0.06) 0 1px, transparent 1px 30px),
            repeating-linear-gradient(180deg, rgba(170,233,255,0.06) 0 1px, transparent 1px 30px),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 18%);
          opacity: 0.68;
        }
        .bs-zone-revealed {
          background:
            radial-gradient(ellipse at 24% 20%, rgba(227,246,255,0.18), rgba(227,246,255,0) 20%),
            radial-gradient(ellipse at 76% 26%, rgba(160,222,255,0.14), rgba(160,222,255,0) 22%),
            radial-gradient(ellipse at 50% 78%, rgba(58,146,218,0.26), rgba(58,146,218,0) 40%),
            linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 24%),
            linear-gradient(180deg, rgba(77,160,221,0.98) 0%, rgba(34,112,177,0.98) 36%, rgba(11,71,128,1) 68%, rgba(4,39,88,1) 100%);
        }
        .bs-zone-revealed::before {
          opacity: 0;
        }
        .bs-zone-revealed::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(ellipse at 30% 22%, rgba(255,255,255,0.12), rgba(255,255,255,0) 22%),
            radial-gradient(ellipse at 68% 60%, rgba(159,223,255,0.14), rgba(159,223,255,0) 26%),
            linear-gradient(155deg, rgba(255,255,255,0.08) 8%, rgba(255,255,255,0) 24%, rgba(164,222,255,0.08) 44%, rgba(164,222,255,0) 60%, rgba(255,255,255,0.06) 76%, rgba(255,255,255,0) 90%);
          opacity: 0.86;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .bs-zone-radar {
          inset: 6% 10% auto;
          height: 22%;
          border-radius: 9999px;
          background: radial-gradient(circle at center, rgba(182,240,255,0.12), rgba(182,240,255,0));
          filter: blur(12px);
        }
        .bs-zone-swell {
          left: -8%;
          right: -8%;
          bottom: 10%;
          height: 12%;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(130,202,255,0.08), rgba(130,202,255,0));
          filter: blur(8px);
        }
        .bs-zone-swell-b {
          bottom: 2%;
          opacity: 0.55;
        }
        .bs-cell {
          position: relative;
          width: 100%;
          height: 100%;
          border: 1px solid rgba(190,235,255,0.1);
          overflow: hidden;
        }
        .bs-cell-revealed {
          border: 0;
        }
        .bs-cell-hidden {
          background: rgba(4,30,56,0.02);
        }
        .bs-cell-water {
          background:
            radial-gradient(ellipse at 52% 50%, rgba(232,248,255,0.1), rgba(232,248,255,0.04) 18%, rgba(232,248,255,0) 48%),
            linear-gradient(155deg, rgba(255,255,255,0.08) 8%, rgba(255,255,255,0) 26%, rgba(168,226,255,0.08) 44%, rgba(168,226,255,0) 60%, rgba(255,255,255,0.05) 76%, rgba(255,255,255,0) 92%);
          background-blend-mode: screen;
        }
        .bs-cell-ship {
          background:
            radial-gradient(ellipse at 50% 50%, rgba(239,249,255,0.12), rgba(239,249,255,0.04) 16%, rgba(239,249,255,0) 44%),
            linear-gradient(155deg, rgba(255,255,255,0.1) 8%, rgba(255,255,255,0) 24%, rgba(173,231,255,0.08) 42%, rgba(173,231,255,0) 58%, rgba(255,255,255,0.05) 76%, rgba(255,255,255,0) 92%);
          background-blend-mode: screen;
        }
        .bs-cell-sunk {
          background:
            radial-gradient(ellipse at 50% 44%, rgba(255,188,102,0.34), rgba(255,188,102,0.1) 24%, rgba(255,188,102,0) 54%),
            linear-gradient(155deg, rgba(255,255,255,0.08) 8%, rgba(255,255,255,0) 24%, rgba(165,222,255,0.06) 42%, rgba(165,222,255,0) 58%, rgba(255,255,255,0.04) 76%, rgba(255,255,255,0) 92%);
          background-blend-mode: screen;
        }
        .bs-cell-grid {
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 22%),
            linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 30%);
          opacity: 0.38;
        }
        .bs-cell-revealed .bs-cell-grid {
          opacity: 0;
        }
        .bs-cell-revealed.bs-cell-water,
        .bs-cell-revealed.bs-cell-ship {
          background: transparent;
        }
        .bs-cell-revealed.bs-cell-sunk {
          background:
            radial-gradient(ellipse at 50% 44%, rgba(255,188,102,0.34), rgba(255,188,102,0.12) 22%, rgba(255,188,102,0) 52%);
        }
        .bs-grid-overlay-cell {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(221,244,255,0.22);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01) 32%, rgba(255,255,255,0) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            inset 0 0 0 1px rgba(14,58,110,0.12);
        }
        .bs-grid-overlay-cell-targeted {
          border-color: rgba(255,210,129,0.34);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 0 0 0 1px rgba(255,176,92,0.14),
            0 0 12px rgba(255,176,92,0.12);
        }
        .bs-grid-hitbox {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
          border-radius: 0;
          padding: 0;
          background: transparent;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .bs-grid-hitbox-targeted {
          background: radial-gradient(circle at center, rgba(255,214,140,0.05), rgba(255,214,140,0) 72%);
        }
        .bs-grid-hitbox:focus-visible {
          outline: 2px solid rgba(175,231,255,0.9);
          outline-offset: -2px;
        }
        .bs-target-marker {
          position: absolute;
          inset: 12%;
          display: grid;
          place-items: center;
          pointer-events: none;
          z-index: 5;
        }
        .bs-target-marker-top {
          inset: 10%;
        }
        .bs-target-shadow,
        .bs-target-piece-base,
        .bs-target-piece-rim,
        .bs-target-piece-face,
        .bs-target-piece-groove,
        .bs-target-piece-core,
        .bs-target-piece-cap,
        .bs-target-piece-spec {
          position: absolute;
          border-radius: 9999px;
        }
        .bs-target-shadow {
          inset: 22% 18% 8%;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(3,15,30,0.42), rgba(3,15,30,0) 72%);
          filter: blur(5px);
          transform: translateY(12%);
          opacity: 0.9;
        }
        .bs-target-piece-base {
          inset: 14% 12% 10%;
          background:
            linear-gradient(180deg, rgba(9,35,58,0.96), rgba(4,17,31,0.98));
          box-shadow:
            inset 0 2px 2px rgba(196,241,255,0.08),
            0 8px 10px rgba(1,9,21,0.34);
        }
        .bs-target-piece-rim {
          inset: 8%;
          background:
            linear-gradient(180deg, #d8fbff 0%, #8ce3ff 18%, #2c8fcd 50%, #0f426f 100%);
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,0.62),
            inset 0 -4px 8px rgba(4,18,36,0.42),
            0 4px 8px rgba(16,88,132,0.3);
        }
        .bs-target-marker-locked .bs-target-piece-rim {
          background:
            linear-gradient(180deg, #fff2d1 0%, #ffd791 18%, #ffab52 48%, #8d4311 100%);
          box-shadow:
            inset 0 1px 1px rgba(255,249,236,0.72),
            inset 0 -4px 8px rgba(58,18,2,0.36),
            0 4px 10px rgba(255,142,52,0.24);
        }
        .bs-target-piece-face {
          inset: 19%;
          overflow: hidden;
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,0.52), rgba(255,255,255,0.08) 28%, rgba(255,255,255,0) 46%),
            linear-gradient(180deg, #2e6ea3 0%, #173e63 58%, #0b223a 100%);
          box-shadow:
            inset 0 1px 1px rgba(240,252,255,0.18),
            inset 0 -4px 7px rgba(2,9,19,0.44);
        }
        .bs-target-marker-locked .bs-target-piece-face {
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,0.48), rgba(255,255,255,0.08) 28%, rgba(255,255,255,0) 46%),
            linear-gradient(180deg, #855a23 0%, #5b3112 56%, #2b1308 100%);
        }
        .bs-target-piece-groove {
          background: rgba(214,242,255,0.14);
          box-shadow:
            0 0 6px rgba(186,241,255,0.08);
        }
        .bs-target-marker-locked .bs-target-piece-groove {
          background: rgba(255,232,193,0.16);
          box-shadow: 0 0 6px rgba(255,215,148,0.08);
        }
        .bs-target-piece-groove-x {
          left: 21%;
          right: 21%;
          top: 47%;
          height: 6%;
          transform: translateY(-50%);
        }
        .bs-target-piece-groove-y {
          top: 21%;
          bottom: 21%;
          left: 47%;
          width: 6%;
          transform: translateX(-50%);
        }
        .bs-target-piece-core {
          inset: 33%;
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,0.72), rgba(255,255,255,0.08) 34%, rgba(255,255,255,0) 48%),
            linear-gradient(180deg, #b4f4ff 0%, #5bc9ec 52%, #1e6fa4 100%);
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,0.6),
            inset 0 -2px 5px rgba(8,37,62,0.4);
        }
        .bs-target-marker-locked .bs-target-piece-core {
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,0.72), rgba(255,255,255,0.08) 34%, rgba(255,255,255,0) 48%),
            linear-gradient(180deg, #ffe8bc 0%, #ffbd66 52%, #c96e1e 100%);
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,0.56),
            inset 0 -2px 5px rgba(87,32,6,0.34);
        }
        .bs-target-piece-cap {
          inset: 39%;
          background: rgba(246,252,255,0.94);
          box-shadow:
            0 0 0 1px rgba(197,241,255,0.24),
            0 0 10px rgba(139,232,255,0.16);
        }
        .bs-target-marker-locked .bs-target-piece-cap {
          background: rgba(255,249,236,0.94);
          box-shadow:
            0 0 0 1px rgba(255,228,188,0.22),
            0 0 10px rgba(255,184,105,0.18);
        }
        .bs-target-piece-spec {
          inset: 25% 24% 50% 24%;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0));
          opacity: 0.78;
          transform: rotate(-18deg);
        }
        .bs-target-marker-top .bs-target-shadow {
          opacity: 0.72;
          filter: blur(7px);
        }
        .bs-target-marker-top .bs-target-piece-rim {
          box-shadow:
            inset 0 1px 1px rgba(255,255,255,0.66),
            inset 0 -4px 8px rgba(4,18,36,0.38),
            0 0 22px rgba(110,219,255,0.22),
            0 6px 12px rgba(16,88,132,0.26);
        }
        .bs-target-marker-top.bs-target-marker-locked .bs-target-piece-rim {
          box-shadow:
            inset 0 1px 1px rgba(255,249,236,0.7),
            inset 0 -4px 8px rgba(58,18,2,0.34),
            0 0 24px rgba(255,171,82,0.18),
            0 6px 12px rgba(112,54,16,0.22);
        }
        .bs-hit-glow,
        .bs-hit-flash,
        .bs-miss-ripple,
        .bs-hit-label,
        .bs-miss-label,
        .bs-sunk-banner {
          position: absolute;
          z-index: 6;
        }
        .bs-hit-glow {
          inset: 9%;
          border-radius: 18px;
          background:
            radial-gradient(circle at center, rgba(255,244,190,0.34) 0 12%, rgba(255,176,92,0.24) 28%, rgba(255,116,72,0.12) 48%, rgba(255,116,72,0) 76%);
          box-shadow:
            inset 0 0 18px rgba(255,232,177,0.12),
            0 0 18px rgba(255,164,92,0.18);
          opacity: 0.88;
        }
        .bs-hit-flash {
          inset: 6%;
          border-radius: 18px;
          background:
            radial-gradient(circle at center, rgba(255,244,190,0.98) 0 12%, rgba(255,160,70,0.88) 24%, rgba(255,90,54,0.44) 44%, rgba(255,90,54,0) 72%);
          filter: blur(1px);
          animation: bsHitBurst 960ms ease-out both;
        }
        .bs-hit-label,
        .bs-miss-label {
          left: 50%;
          bottom: 10%;
          transform: translateX(-50%);
          padding: 0.15rem 0.35rem;
          border-radius: 9999px;
          font-size: clamp(0.38rem, 0.36vw + 0.28rem, 0.62rem);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .bs-hit-label {
          background: rgba(65,21,11,0.72);
          color: #fff0d0;
        }
        .bs-miss-ripple {
          inset: 16%;
          border-radius: 9999px;
          border: 2px solid rgba(182,234,255,0.72);
          animation: bsMissRipple 900ms ease-out both;
        }
        .bs-miss-label {
          background: rgba(5,28,52,0.76);
          color: #d8f4ff;
        }
        .bs-ship-art {
          position: absolute;
          left: -1px;
          top: -1px;
          width: calc(100% + 2px);
          height: calc(100% + 2px);
          z-index: 1;
          pointer-events: none;
        }
        .bs-ship-art-track {
          position: absolute;
          left: 0;
          top: 0;
          overflow: hidden;
        }
        .bs-ship-art-inner {
          position: absolute;
          inset: 0;
        }
        .bs-ship-art-inner-rotated {
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(90deg);
          transform-origin: center;
        }
        .bs-ship-art-image {
          width: 100%;
          height: 100%;
          object-fit: fill;
          user-select: none;
          filter:
            drop-shadow(0 4px 8px rgba(3, 13, 28, 0.22))
            saturate(0.96)
            contrast(1.04);
        }
        .bs-ship-art-sunk .bs-ship-art-image {
          filter:
            drop-shadow(0 0 10px rgba(255, 173, 92, 0.22))
            sepia(0.26)
            saturate(1.05)
            contrast(1.02);
          opacity: 0.92;
        }
        .bs-sunk-banner {
          left: 50%;
          top: 6%;
          transform: translateX(-50%);
          padding: 0.18rem 0.42rem;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(255,230,182,0.98), rgba(255,168,92,0.96));
          color: #3b170a;
          font-size: clamp(0.36rem, 0.3vw + 0.24rem, 0.56rem);
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          box-shadow: 0 8px 18px rgba(0,0,0,0.2);
        }
        .bs-hud {
          min-width: 112px;
          padding: 0.52rem 0.78rem;
          border-radius: 18px;
          border: 1px solid rgba(182,236,255,0.18);
          background: rgba(6,20,39,0.72);
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 22px rgba(0,0,0,0.2);
        }
        .bs-hud-right {
          text-align: right;
        }
        .bs-status-chip {
          max-width: min(68%, 340px);
          padding: 0.56rem 0.95rem;
          border-radius: 18px;
          border: 1px solid rgba(182,236,255,0.16);
          background: rgba(6,20,39,0.74);
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 22px rgba(0,0,0,0.2);
          text-align: center;
        }
        .bs-status-chip-label {
          font-size: 0.56rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(202,241,255,0.54);
        }
        .bs-status-chip-value {
          margin-top: 0.28rem;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(245,251,255,0.98);
        }
        .bs-hud-label {
          font-size: 0.56rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(202,241,255,0.58);
        }
        .bs-hud-value {
          margin-top: 0.24rem;
          font-size: 0.8rem;
          font-weight: 900;
          color: rgba(245,251,255,0.98);
        }
        .bs-confirm-btn {
          min-width: 176px;
        }
        .bs-win-fx {
          position: absolute;
          z-index: 6;
          pointer-events: none;
          overflow: visible;
        }
        .bs-win-flare,
        .bs-win-ribbon {
          position: absolute;
          pointer-events: none;
        }
        .bs-win-flare {
          left: 50%;
          bottom: 5.2%;
          width: 32%;
          height: 5%;
          transform: translateX(-50%) scale(0.8);
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(94,231,255,0.14), rgba(94,231,255,0.05) 34%, rgba(94,231,255,0) 72%),
            radial-gradient(circle at center, rgba(255,184,92,0.14), rgba(255,184,92,0.05) 28%, rgba(255,184,92,0) 68%);
          filter: blur(16px);
          opacity: 0;
        }
        .bs-win-ribbon {
          left: 50%;
          bottom: 1.05%;
          width: min(36%, 260px);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 8px 11px;
          transform: translateX(-50%) scale(0.82);
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(7,28,50,0.95), rgba(9,38,66,0.95) 52%, rgba(14,58,94,0.94) 100%);
          border: 1px solid rgba(148,223,255,0.22);
          box-shadow:
            inset 0 1px 0 rgba(214,244,255,0.16),
            inset 0 -8px 14px rgba(2,12,24,0.22),
            0 14px 24px rgba(0,0,0,0.18),
            0 0 14px rgba(112,220,255,0.06);
          opacity: 0;
        }
        .bs-win-ribbon-ping,
        .bs-win-ribbon-copy {
          position: relative;
          z-index: 1;
        }
        .bs-win-ribbon-ping {
          flex: 0 0 auto;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9), rgba(255,255,255,0.24) 34%, rgba(255,255,255,0) 52%),
            linear-gradient(180deg, rgba(255,202,124,0.98), rgba(230,122,48,0.98));
          box-shadow:
            0 0 0 4px rgba(255,177,82,0.14),
            0 0 16px rgba(255,173,92,0.22);
        }
        .bs-win-ribbon-copy {
          min-width: 0;
          text-align: left;
        }
        .bs-win-kicker {
          font-size: 0.5rem;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(157,228,255,0.72);
        }
        .bs-win-title {
          margin-top: 0.16rem;
          font-size: clamp(0.76rem, 0.46vw + 0.74rem, 0.92rem);
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #f7fcff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .bs-win-amount {
          margin-top: 0;
          font-size: clamp(1.18rem, 1.8vw, 1.7rem);
          font-weight: 900;
          color: #fff8ea;
          line-height: 1;
          text-shadow: 0 2px 0 rgba(84,45,17,0.28), 0 0 16px rgba(255,238,194,0.28);
          white-space: nowrap;
        }
        .bs-win-fx-intro .bs-win-flare,
        .bs-win-fx-countUp .bs-win-flare,
        .bs-win-fx-done .bs-win-flare {
          opacity: 1;
        }
        .bs-win-fx-intro .bs-win-flare {
          animation: bsWinFlareIn 360ms ease-out forwards;
        }
        .bs-win-fx-countUp .bs-win-flare {
          transform: translateX(-50%) scale(1);
          opacity: 0.84;
        }
        .bs-win-fx-done .bs-win-flare {
          transform: translateX(-50%) scale(1.08);
          opacity: 0.94;
        }
        .bs-win-fx-intro .bs-win-ribbon,
        .bs-win-fx-countUp .bs-win-ribbon,
        .bs-win-fx-done .bs-win-ribbon {
          opacity: 1;
        }
        .bs-win-fx-intro .bs-win-ribbon {
          animation: bsWinCardIn 380ms ease-out forwards;
        }
        .bs-win-fx-countUp .bs-win-ribbon {
          transform: translateX(-50%) scale(1);
        }
        .bs-win-fx-done .bs-win-ribbon {
          transform: translateX(-50%) scale(1.02);
        }
        @media (max-width: 640px) {
          .bs-command-bar {
            display: grid;
            grid-template-columns: minmax(72px, 90px) minmax(112px, 1fr) minmax(72px, 90px);
            align-items: end;
            gap: 0.45rem;
            inset-inline: 3.8%;
            bottom: 1.2%;
          }
          .bs-hud {
            min-width: 0;
            padding: 0.38rem 0.48rem 0.44rem;
            border-radius: 16px;
            backdrop-filter: blur(8px);
          }
          .bs-hud-label {
            font-size: 0.46rem;
            letter-spacing: 0.14em;
          }
          .bs-hud-value {
            margin-top: 0.14rem;
            font-size: 0.68rem;
            line-height: 1.1;
          }
          .bs-hud-right {
            text-align: center;
          }
          .bs-confirm-btn {
            min-width: 0;
            width: 100%;
            padding: 0.66rem 0.6rem 0.7rem;
            border-radius: 16px;
            font-size: 0.68rem;
            line-height: 1.05;
            letter-spacing: 0.12em;
            box-shadow: 0 10px 26px rgba(76,196,255,0.26);
          }
          .bs-win-ribbon {
            width: min(34%, 200px);
            gap: 0.4rem;
            padding: 7px 9px;
          }
          .bs-win-title {
            font-size: 0.68rem;
          }
        }
        @media (max-width: 480px) {
          .bs-command-bar {
            grid-template-columns: 74px minmax(104px, 1fr) 74px;
            gap: 0.38rem;
            inset-inline: 4%;
          }
          .bs-hud {
            padding: 0.34rem 0.38rem 0.38rem;
            border-radius: 14px;
          }
          .bs-hud-label {
            font-size: 0.42rem;
            letter-spacing: 0.12em;
          }
          .bs-hud-value {
            font-size: 0.62rem;
          }
          .bs-confirm-btn {
            padding: 0.58rem 0.5rem 0.62rem;
            font-size: 0.6rem;
            letter-spacing: 0.1em;
          }
        }
        @keyframes bsHitBurst {
          0% { transform: scale(0.6); opacity: 0; }
          35% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1.24); opacity: 0; }
        }
        @keyframes bsContactPulse {
          0%, 100% { transform: scale(0.92); opacity: 0.48; }
          50% { transform: scale(1.06); opacity: 0.98; }
        }
        @keyframes bsMissRipple {
          0% { transform: scale(0.36); opacity: 0; }
          28% { opacity: 0.88; }
          100% { transform: scale(1.18); opacity: 0; }
        }
        @keyframes bsWinFlareIn {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.84; }
        }
        @keyframes bsWinCardIn {
          0% { transform: translate(-50%, -46%) scale(0.82); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .ff-board {
          background:
            linear-gradient(180deg, #ffbdd8 0%, #ff9bb9 18%, #ff9d62 36%, #ffce67 48%, #13b6ff 66%, #0079c4 100%);
        }
        .ff-sky-glow,
        .ff-sun-halo,
        .ff-sun-disc,
        .ff-waterline,
        .ff-ocean,
        .ff-shimmer,
        .ff-island {
          position: absolute;
          pointer-events: none;
        }
        .ff-sky-glow {
          border-radius: 9999px;
          filter: blur(38px);
          mix-blend-mode: screen;
          opacity: 0.75;
        }
        .ff-sky-glow-a {
          inset: 8% auto auto 4%;
          width: 38%;
          height: 16%;
          background: radial-gradient(circle at center, rgba(255,255,255,0.46), rgba(255,255,255,0));
        }
        .ff-sky-glow-b {
          inset: 10% 6% auto auto;
          width: 34%;
          height: 18%;
          background: radial-gradient(circle at center, rgba(255,170,216,0.46), rgba(255,170,216,0));
        }
        .ff-sun-halo {
          left: 50%;
          top: 8%;
          width: 48%;
          height: 25%;
          transform: translateX(-50%);
          border-radius: 9999px;
          background: radial-gradient(circle at center, rgba(255,248,190,0.62), rgba(255,248,190,0.14) 42%, rgba(255,248,190,0) 74%);
          filter: blur(18px);
        }
        .ff-sun-disc {
          left: 50%;
          top: 11%;
          width: 30%;
          aspect-ratio: 1;
          transform: translateX(-50%);
          border-radius: 9999px;
          background:
            radial-gradient(circle at 35% 28%, rgba(255,255,255,0.94), rgba(255,247,154,0.98) 28%, rgba(255,187,83,0.98) 62%, rgba(255,123,115,0.94) 100%);
          box-shadow: 0 0 34px rgba(255,206,116,0.44);
        }
        .ff-sun-disc::before {
          content: "";
          position: absolute;
          inset: 10%;
          border-radius: inherit;
          border: 2px solid rgba(255,250,191,0.42);
        }
        .ff-waterline {
          left: 0;
          right: 0;
          top: 33%;
          height: 7%;
          background:
            linear-gradient(180deg, rgba(255,247,188,0.7), rgba(255,247,188,0)),
            linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.5), rgba(255,255,255,0.06));
          box-shadow: 0 0 28px rgba(255,230,138,0.28);
        }
        .ff-ocean {
          left: 0;
          right: 0;
          top: 32%;
          bottom: 0;
          background:
            linear-gradient(180deg, rgba(40,210,255,0.08), rgba(4,137,212,0.18) 20%, rgba(2,91,164,0.48) 48%, rgba(3,48,98,0.84) 100%),
            repeating-linear-gradient(180deg, rgba(255,255,255,0.14) 0 1px, rgba(255,255,255,0) 1px 18px);
        }
        .ff-shimmer {
          height: 18%;
          border-radius: 9999px;
          filter: blur(18px);
          opacity: 0.45;
        }
        .ff-shimmer-a {
          inset: auto auto 18% 8%;
          width: 40%;
          background: radial-gradient(circle at center, rgba(111,242,255,0.54), rgba(111,242,255,0));
        }
        .ff-shimmer-b {
          inset: auto 4% 12% auto;
          width: 46%;
          background: radial-gradient(circle at center, rgba(255,145,209,0.34), rgba(255,145,209,0));
        }
        .ff-island {
          bottom: 33%;
          width: 24%;
          height: 10%;
          border-radius: 9999px 9999px 24px 24px;
          background:
            linear-gradient(180deg, rgba(28,108,48,0.9), rgba(17,60,33,0.96)),
            radial-gradient(circle at 50% 100%, rgba(43,144,79,0.4), rgba(43,144,79,0));
          box-shadow: 0 0 28px rgba(0,0,0,0.18);
        }
        .ff-island-left {
          left: 5%;
          transform: skewX(-14deg);
        }
        .ff-island-right {
          right: 6%;
          width: 20%;
          transform: skewX(14deg);
        }
        .ff-logo-stage {
          position: absolute;
          inset: 0 0 auto;
          height: 48%;
          pointer-events: none;
        }
        .ff-logo-glow {
          position: absolute;
          border-radius: 9999px;
          filter: blur(22px);
          mix-blend-mode: screen;
        }
        .ff-logo-glow-a {
          inset: 7% 9% 18%;
          background: radial-gradient(circle at center, rgba(255,242,162,0.4), rgba(255,242,162,0));
        }
        .ff-logo-glow-b {
          inset: 14% 14% 8%;
          background: radial-gradient(circle at center, rgba(255,133,214,0.34), rgba(255,133,214,0));
        }
        .ff-logo-frame {
          position: absolute;
          inset: 0.5% 0 0.8%;
          overflow: hidden;
        }
        .ff-logo-stage-intro {
          height: 60%;
        }
        .ff-logo-frame-intro {
          inset: 5% 0 -6%;
        }
        .ff-logo-main-img-intro {
          width: 72%;
          bottom: -6%;
        }
        .ff-logo-main-img {
          position: absolute;
          left: 50%;
          bottom: -1.5%;
          width: 84%;
          height: auto;
          max-width: none;
          transform: translateX(-50%);
          filter: drop-shadow(0 16px 40px rgba(255,116,172,0.22));
        }
        .ff-zone-shell {
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,249,227,0.3), rgba(255,249,227,0) 62%),
            radial-gradient(circle at 18% 16%, rgba(255,173,202,0.18), rgba(255,173,202,0) 24%),
            radial-gradient(circle at 82% 18%, rgba(111,227,255,0.16), rgba(111,227,255,0) 26%),
            linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,235,212,0.08) 36%, rgba(255,187,122,0.06) 100%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.24),
            0 12px 22px rgba(102,81,55,0.08);
        }
        .ff-zone-frame {
          pointer-events: none;
          z-index: 3;
          border: none;
          background: transparent;
          box-shadow:
            none;
        }
        .ff-zone-frame::before,
        .ff-zone-frame::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }
        .ff-zone-frame::before {
          inset: -2%;
          border-radius: inherit;
          padding: 15px;
          background:
            radial-gradient(circle at 18% 16%, rgba(255,255,255,0.92), rgba(255,255,255,0) 18%),
            radial-gradient(circle at 84% 18%, rgba(255,255,255,0.7), rgba(255,255,255,0) 16%),
            linear-gradient(135deg, rgba(255,143,196,0.98) 0%, rgba(255,171,104,0.98) 26%, rgba(255,227,116,0.98) 48%, rgba(108,229,255,0.98) 72%, rgba(87,177,255,0.98) 100%);
          opacity: 1;
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          filter:
            drop-shadow(0 8px 14px rgba(74,88,130,0.16))
            drop-shadow(0 0 12px rgba(255,198,120,0.2));
        }
        .ff-zone-frame::after {
          inset: -1.5%;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.48), rgba(255,255,255,0) 24%) top / 100% 22% no-repeat,
            radial-gradient(circle at 14% 24%, rgba(255,255,255,0.56), rgba(255,255,255,0) 18%),
            radial-gradient(circle at 84% 20%, rgba(255,255,255,0.4), rgba(255,255,255,0) 16%);
          opacity: 0.9;
          filter:
            blur(0.2px);
        }
        .ff-zone {
          position: absolute;
          z-index: 1;
          pointer-events: none;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% -8%, rgba(255,255,255,0.35), rgba(255,255,255,0) 26%),
            radial-gradient(circle at 18% 16%, rgba(255,182,218,0.14), rgba(255,182,218,0) 22%),
            radial-gradient(circle at 78% 14%, rgba(255,235,151,0.16), rgba(255,235,151,0) 24%),
            radial-gradient(circle at 50% 88%, rgba(94,223,255,0.22), rgba(94,223,255,0) 34%),
            linear-gradient(180deg, rgba(67,171,245,0.88), rgba(17,117,212,0.92) 26%, rgba(8,73,160,0.96) 58%, rgba(5,42,108,0.98) 100%);
          border: 1px solid rgba(255,247,238,0.18);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.07),
            inset 0 22px 36px rgba(255,255,255,0.08),
            0 0 18px rgba(130,220,255,0.08);
        }
        .ff-zone::before,
        .ff-zone::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }
        .ff-zone::before {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 18%) top / 100% 20% no-repeat,
            radial-gradient(ellipse at 50% 18%, rgba(255,255,255,0.18), rgba(255,255,255,0) 52%) top / 100% 32% no-repeat,
            linear-gradient(115deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 18%, rgba(255,255,255,0.08) 34%, rgba(255,255,255,0) 52%, rgba(255,255,255,0.1) 70%, rgba(255,255,255,0) 86%);
          background-size: 100% 20%, 100% 32%, 180px 180px;
          background-position: top, top, 0 0;
          opacity: 0.62;
        .ff-zone::after {
          background:
            radial-gradient(circle, rgba(255,255,255,0.82) 0 1.2px, transparent 1.8px),
            radial-gradient(circle, rgba(180,244,255,0.8) 0 1.1px, transparent 1.8px),
            linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 20%, transparent 48%, rgba(170,241,255,0.08) 72%, rgba(170,241,255,0) 88%);
          background-size: 160px 160px, 240px 240px, 100% 100%;
          background-position: 0 0, 36px 52px, center;
          mix-blend-mode: screen;
          opacity: 0.58;
        }
        .ff-bubbles {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .ff-bubbles-a {
          opacity: 0.5;
          background:
            radial-gradient(circle, rgba(255,255,255,0.54) 0 33%, rgba(202,244,255,0.2) 34% 58%, transparent 59%) 6% 112% / 18px 18px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.46) 0 34%, rgba(202,244,255,0.18) 35% 58%, transparent 59%) 18% 118% / 12px 12px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.52) 0 33%, rgba(202,244,255,0.2) 34% 58%, transparent 59%) 32% 109% / 20px 20px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.42) 0 33%, rgba(202,244,255,0.16) 34% 58%, transparent 59%) 39% 116% / 9px 9px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.46) 0 33%, rgba(202,244,255,0.18) 34% 58%, transparent 59%) 48% 120% / 14px 14px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.44) 0 33%, rgba(202,244,255,0.18) 34% 58%, transparent 59%) 57% 114% / 11px 11px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.56) 0 33%, rgba(202,244,255,0.22) 34% 58%, transparent 59%) 66% 113% / 24px 24px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.4) 0 33%, rgba(202,244,255,0.16) 34% 58%, transparent 59%) 76% 121% / 8px 8px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.48) 0 33%, rgba(202,244,255,0.2) 34% 58%, transparent 59%) 84% 117% / 16px 16px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.42) 0 33%, rgba(202,244,255,0.16) 34% 58%, transparent 59%) 93% 110% / 10px 10px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.38) 0 33%, rgba(202,244,255,0.14) 34% 58%, transparent 59%) 12% 124% / 7px 7px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.4) 0 33%, rgba(202,244,255,0.16) 34% 58%, transparent 59%) 88% 126% / 9px 9px no-repeat;
          animation: ffBubbleRiseA 10s linear infinite;
        }
        .ff-bubbles-b {
          opacity: 0.34;
          background:
            radial-gradient(circle, rgba(255,255,255,0.44) 0 33%, rgba(169,231,255,0.18) 34% 58%, transparent 59%) 12% 126% / 10px 10px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.5) 0 33%, rgba(169,231,255,0.18) 34% 58%, transparent 59%) 26% 122% / 16px 16px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.38) 0 33%, rgba(169,231,255,0.14) 34% 58%, transparent 59%) 34% 130% / 8px 8px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.4) 0 33%, rgba(169,231,255,0.16) 34% 58%, transparent 59%) 41% 128% / 12px 12px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.46) 0 33%, rgba(169,231,255,0.2) 34% 58%, transparent 59%) 58% 124% / 18px 18px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.36) 0 33%, rgba(169,231,255,0.14) 34% 58%, transparent 59%) 67% 131% / 7px 7px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.42) 0 33%, rgba(169,231,255,0.16) 34% 58%, transparent 59%) 74% 129% / 12px 12px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.48) 0 33%, rgba(169,231,255,0.18) 34% 58%, transparent 59%) 88% 123% / 15px 15px no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.38) 0 33%, rgba(169,231,255,0.14) 34% 58%, transparent 59%) 95% 127% / 8px 8px no-repeat;
          animation: ffBubbleRiseB 13s linear infinite;
        }
        .ff-symbol-card {
          position: relative;
          border-radius: 28px;
          background: transparent;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }
        .ff-symbol-card::before {
          content: "";
          position: absolute;
          inset: 7% 12% auto;
          height: 14%;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0));
          filter: blur(5px);
          opacity: 0;
        }
        .ff-symbol-card-win {
          background:
            radial-gradient(circle at 32% 18%, rgba(255,255,255,0.3), rgba(255,255,255,0.08) 24%, transparent 52%),
            radial-gradient(circle at 50% 100%, rgba(79,225,255,0.12), rgba(79,225,255,0) 52%),
            linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08) 16%, rgba(39,129,214,0.24) 52%, rgba(8,36,93,0.2) 100%);
          border: 1px solid rgba(213, 246, 255, 0.34);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.22),
            inset 0 -16px 28px rgba(0,58,121,0.12),
            inset 0 1px 0 rgba(255,255,255,0.2),
            inset 0 -16px 28px rgba(0,0,0,0.12),
            0 0 0 1px color-mix(in srgb, var(--ff-glow) 62%, white 38%),
            0 0 18px var(--ff-glow),
            0 10px 18px rgba(0,0,0,0.14);
          backdrop-filter: blur(2px);
        }
        .ff-symbol-card-win::before {
          opacity: 1;
        }
        .ff-symbol-img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          transform: translateZ(0);
          filter: drop-shadow(0 10px 18px rgba(0,0,0,0.18));
        }
        .ff-symbol-img-win {
          filter:
            drop-shadow(0 0 16px color-mix(in srgb, var(--ff-glow) 62%, white 38%))
            drop-shadow(0 10px 18px rgba(0,0,0,0.18));
        }
        .ff-symbol-pulse {
          position: absolute;
          inset: -8%;
          border-radius: 30px;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--ff-glow) 72%, white 28%), 0 0 22px var(--ff-glow);
          animation: sbPulse 900ms ease-in-out infinite;
        }
        @keyframes ffBubbleRiseA {
          0% {
            background-position: 6% 112%, 18% 118%, 32% 109%, 39% 116%, 48% 120%, 57% 114%, 66% 113%, 76% 121%, 84% 117%, 93% 110%, 12% 124%, 88% 126%;
          }
          100% {
            background-position: 9% -12%, 21% 6%, 35% -18%, 42% -4%, 51% 0%, 60% -10%, 69% -14%, 79% -1%, 87% 8%, 96% -10%, 15% 2%, 91% -2%;
          }
        }
        @keyframes ffBubbleRiseB {
          0% {
            background-position: 12% 126%, 26% 122%, 34% 130%, 41% 128%, 58% 124%, 67% 131%, 74% 129%, 88% 123%, 95% 127%;
          }
          100% {
            background-position: 14% 8%, 29% -14%, 37% 2%, 44% 4%, 61% -18%, 70% -2%, 77% 2%, 91% -10%, 98% 0%;
          }
        }
        .ff-win-fx {
          position: absolute;
          z-index: 5;
          overflow: hidden;
          pointer-events: none;
        }
        .ff-win-burst,
        .ff-win-splash,
        .ff-win-sparkles,
        .ff-win-ripple,
        .ff-win-flamingo,
        .ff-win-badge,
        .ff-win-amount-pill {
          position: absolute;
          pointer-events: none;
        }
        .ff-win-burst {
          left: 50%;
          top: 4%;
          bottom: 50%;
          width: 66%;
          height: auto;
          transform: translateX(-50%) scale(0.74);
          overflow: hidden;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          background:
            radial-gradient(ellipse at 50% 100%, rgba(255,229,170,0.34), rgba(255,197,122,0.16) 34%, rgba(255,176,110,0.04) 58%, rgba(255,176,110,0) 78%);
          filter: drop-shadow(0 0 14px rgba(255,196,108,0.12));
          opacity: 0;
        }
        .ff-win-burst::before,
        .ff-win-burst::after {
          content: "";
          position: absolute;
          pointer-events: none;
        }
        .ff-win-burst::before {
          left: 50%;
          bottom: -118%;
          width: 88%;
          aspect-ratio: 1;
          transform: translateX(-50%);
          border-radius: 9999px;
          background:
            radial-gradient(circle at 50% 42%, rgba(255,255,243,1) 0 8%, rgba(255,248,212,1) 14%, rgba(255,232,162,1) 30%, rgba(255,204,115,1) 48%, rgba(255,168,87,1) 66%, rgba(255,141,77,1) 82%, rgba(255,141,77,0.94) 92%, rgba(255,141,77,0) 99%);
          box-shadow:
            0 0 22px rgba(255,238,184,0.34),
            0 0 68px rgba(255,178,112,0.22);
          transition: bottom 1650ms cubic-bezier(0.2, 0.74, 0.22, 1);
        }
        .ff-win-burst::after {
          left: 50%;
          bottom: 0%;
          width: 100%;
          height: 18%;
          transform: translateX(-50%);
          border-radius: 9999px;
          background:
            radial-gradient(ellipse at center, rgba(255,246,198,0.54), rgba(255,220,152,0.2) 42%, rgba(255,172,122,0.06) 64%, rgba(255,172,122,0) 82%);
          filter: blur(12px);
          opacity: 0.74;
        }
        .ff-win-splash {
          left: 50%;
          top: 58%;
          width: 62%;
          height: 28%;
          transform: translate(-50%, -50%) scale(0.8);
          border-radius: 50%;
          background:
            radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0 16%, rgba(255,255,255,0) 17%),
            radial-gradient(ellipse at center, rgba(114,235,255,0.32) 0 31%, rgba(114,235,255,0) 32%),
            radial-gradient(ellipse at 10% 48%, rgba(255,255,255,0.62) 0 2.2%, rgba(255,255,255,0) 2.4%),
            radial-gradient(ellipse at 22% 18%, rgba(255,255,255,0.58) 0 2.4%, rgba(255,255,255,0) 2.6%),
            radial-gradient(ellipse at 36% 66%, rgba(255,255,255,0.48) 0 2.2%, rgba(255,255,255,0) 2.4%),
            radial-gradient(ellipse at 64% 20%, rgba(255,255,255,0.58) 0 2.4%, rgba(255,255,255,0) 2.6%),
            radial-gradient(ellipse at 78% 58%, rgba(255,255,255,0.52) 0 2.2%, rgba(255,255,255,0) 2.4%),
            radial-gradient(ellipse at 90% 40%, rgba(255,255,255,0.6) 0 2.4%, rgba(255,255,255,0) 2.6%);
          filter: drop-shadow(0 0 14px rgba(126,244,255,0.2));
          opacity: 0;
        }
        .ff-win-sparkles {
          inset: 0;
          background:
            radial-gradient(circle, rgba(255,255,255,0.92) 0 1.6px, transparent 2px) 18% 36% / 22% 22% no-repeat,
            radial-gradient(circle, rgba(255,238,149,0.92) 0 1.8px, transparent 2.2px) 74% 28% / 18% 18% no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.92) 0 1.4px, transparent 1.8px) 30% 66% / 20% 20% no-repeat,
            radial-gradient(circle, rgba(255,180,212,0.9) 0 1.6px, transparent 2px) 64% 70% / 24% 24% no-repeat,
            radial-gradient(circle, rgba(255,255,255,0.92) 0 1.6px, transparent 2px) 84% 52% / 18% 18% no-repeat;
          opacity: 0;
        }
        .ff-win-ripple {
          border-radius: 9999px;
          border: 2px solid rgba(182,250,255,0.72);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.2) inset,
            0 0 18px rgba(109,233,255,0.18);
          opacity: 0;
          transform: scale(0.6);
        }
        .ff-win-flamingo {
          left: 34%;
          bottom: 48%;
          width: clamp(136px, 29%, 230px);
          height: auto;
          transform: translate(-50%, 24%) scale(0.46);
          transform-origin: 50% 100%;
          filter:
            drop-shadow(0 10px 24px rgba(181, 55, 108, 0.22))
            drop-shadow(0 0 18px rgba(255, 178, 210, 0.16));
          opacity: 0;
          z-index: 2;
        }
        .ff-win-badge {
          left: 50%;
          top: 65%;
          width: min(78%, 420px);
          max-width: calc(100% - 2rem);
          padding: 18px 24px;
          transform: translate(-50%, -50%) scale(0.82);
          border-radius: 9999px;
          background:
            radial-gradient(circle at 20% 20%, rgba(255,255,255,0.46), rgba(255,255,255,0) 26%),
            linear-gradient(135deg, rgba(255,122,193,0.96) 0%, rgba(255,172,109,0.98) 30%, rgba(255,231,133,0.98) 52%, rgba(98,236,255,0.98) 76%, rgba(107,179,255,0.98) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.36),
            0 18px 42px rgba(0,72,124,0.24),
            0 0 24px rgba(255,205,121,0.3);
          opacity: 0;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          gap: 0;
          pointer-events: auto;
          z-index: 4;
        }
        .ff-win-amount-pill {
          left: 62%;
          top: 37%;
          width: min(30%, 170px);
          min-width: 120px;
          padding: 16px 14px;
          transform: translate(-50%, -50%) scale(0.82);
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 20% 20%, rgba(255,255,255,0.46), rgba(255,255,255,0) 26%),
            linear-gradient(135deg, rgba(255,122,193,0.96) 0%, rgba(255,172,109,0.98) 30%, rgba(255,231,133,0.98) 52%, rgba(98,236,255,0.98) 76%, rgba(107,179,255,0.98) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.36),
            0 18px 42px rgba(0,72,124,0.24),
            0 0 24px rgba(255,205,121,0.3);
          opacity: 0;
          text-align: center;
          pointer-events: none;
          z-index: 4;
        }
        .ff-win-kicker {
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: rgba(110,48,16,0.8);
        }
        .ff-win-amount {
          font-size: clamp(2rem, 4.8vw, 3rem);
          font-weight: 900;
          line-height: 1;
          color: #fffef8;
          text-shadow:
            0 2px 0 rgba(125,57,13,0.28),
          0 0 14px rgba(255,244,186,0.42);
          white-space: nowrap;
          text-align: center;
        }
        .ff-win-buy-again {
          border: 1px solid rgba(255,255,255,0.44);
          background: linear-gradient(180deg, #fff4a9 0%, #ffcf63 38%, #ff8db8 100%);
          border-radius: 9999px;
          padding: 1rem 1.9rem;
          width: min(100%, 380px);
          align-self: center;
          color: #4b1f15;
          font-size: 0.98rem;
          font-weight: 900;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          box-shadow: 0 14px 28px rgba(255,145,169,0.24);
          transition: filter 180ms ease, opacity 180ms ease;
        }
        .ff-win-buy-again:hover {
          filter: brightness(1.05);
        }
        .ff-win-buy-again:disabled {
          cursor: default;
          opacity: 0.45;
          filter: none;
        }
        .ff-lose-fx {
          position: absolute;
          z-index: 7;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: linear-gradient(180deg, rgba(8,18,43,0.18), rgba(8,18,43,0.38));
        }
        .ff-lose-card {
          width: min(100%, 420px);
          border-radius: 30px;
          border: 1px solid rgba(255,244,193,0.24);
          background: linear-gradient(180deg, rgba(27,11,34,0.92), rgba(12,10,36,0.96));
          padding: 1.5rem;
          text-align: center;
          box-shadow: 0 30px 90px rgba(0,0,0,0.46), 0 0 48px rgba(255,145,169,0.18);
        }
        .ff-lose-title {
          font-size: 2rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #fffaf4;
        }
        @media (max-width: 640px) {
          .ff-win-flamingo {
            left: 32%;
            bottom: 52%;
            width: 32%;
            min-width: 86px;
            max-width: 122px;
            transform: translate(-50%, 16%) scale(0.38);
          }
          .ff-win-amount-pill {
            left: 64%;
            top: 40%;
            width: min(34%, 122px);
            min-width: 88px;
            padding: 10px 8px;
            transform: translate(-50%, -50%) scale(0.78);
          }
          .ff-win-amount {
            font-size: clamp(1.45rem, 7vw, 2rem);
          }
          .ff-win-badge {
            top: 68%;
            width: min(82%, 280px);
            max-width: calc(100% - 1.25rem);
            padding: 12px 14px;
            transform: translate(-50%, -50%) scale(0.92);
          }
          .ff-win-buy-again {
            width: 100%;
            max-width: 240px;
            padding: 0.78rem 1rem;
            font-size: 0.84rem;
            letter-spacing: 0.2em;
          }
        }
        .ff-win-fx-splashIn .ff-win-burst,
        .ff-win-fx-countUp .ff-win-burst,
        .ff-win-fx-hero .ff-win-burst,
        .ff-win-fx-done .ff-win-burst {
          opacity: 1;
        }
        .ff-win-fx-splashIn .ff-win-burst {
          animation: ffWinBurstIn 520ms ease-out forwards;
        }
        .ff-win-fx-countUp .ff-win-burst {
          transform: translateX(-50%) scale(1);
          opacity: 0.95;
        }
        .ff-win-fx-hero .ff-win-burst,
        .ff-win-fx-done .ff-win-burst {
          transform: translateX(-50%) scale(1.04);
          opacity: 0.98;
        }
        .ff-win-fx-splashIn .ff-win-burst::before {
          bottom: -116%;
        }
        .ff-win-fx-countUp .ff-win-burst::before,
        .ff-win-fx-hero .ff-win-burst::before,
        .ff-win-fx-done .ff-win-burst::before {
          bottom: -70%;
        }
        .ff-win-fx-splashIn .ff-win-splash,
        .ff-win-fx-countUp .ff-win-splash,
        .ff-win-fx-hero .ff-win-splash,
        .ff-win-fx-done .ff-win-splash {
          opacity: 1;
        }
        .ff-win-fx-splashIn .ff-win-splash {
          animation: ffWinSplashIn 520ms ease-out forwards;
        }
        .ff-win-fx-countUp .ff-win-splash,
        .ff-win-fx-hero .ff-win-splash,
        .ff-win-fx-done .ff-win-splash {
          transform: translate(-50%, -50%) scale(1);
        }
        .ff-win-fx-splashIn .ff-win-sparkles,
        .ff-win-fx-countUp .ff-win-sparkles,
        .ff-win-fx-hero .ff-win-sparkles,
        .ff-win-fx-done .ff-win-sparkles {
          opacity: 1;
          animation: ffWinSparkles 1400ms ease-in-out infinite;
        }
        .ff-win-fx-splashIn .ff-win-ripple,
        .ff-win-fx-countUp .ff-win-ripple,
        .ff-win-fx-hero .ff-win-ripple,
        .ff-win-fx-done .ff-win-ripple {
          animation: ffWinRipple 1200ms ease-out infinite;
        }
        .ff-win-fx-hero .ff-win-flamingo,
        .ff-win-fx-done .ff-win-flamingo {
          opacity: 1;
        }
        .ff-win-fx-hero .ff-win-flamingo {
          animation:
            ffWinFlamingoPop 820ms cubic-bezier(0.18, 0.88, 0.24, 1) forwards,
            ffWinFlamingoOutlineShimmer 1450ms ease-in-out 220ms infinite;
        }
        .ff-win-fx-done .ff-win-flamingo {
          transform: translate(-50%, 0%) scale(0.94);
          animation: ffWinFlamingoOutlineShimmer 1450ms ease-in-out infinite;
        }
        .ff-win-fx-splashIn .ff-win-badge,
        .ff-win-fx-countUp .ff-win-badge,
        .ff-win-fx-hero .ff-win-badge,
        .ff-win-fx-done .ff-win-badge {
          opacity: 1;
        }
        .ff-win-fx-splashIn .ff-win-amount-pill,
        .ff-win-fx-countUp .ff-win-amount-pill,
        .ff-win-fx-hero .ff-win-amount-pill,
        .ff-win-fx-done .ff-win-amount-pill {
          opacity: 1;
        }
        .ff-win-fx-splashIn .ff-win-badge {
          animation: ffWinBadgeIn 480ms ease-out forwards;
        }
        .ff-win-fx-splashIn .ff-win-amount-pill {
          animation: ffWinBadgeIn 480ms ease-out forwards;
        }
        .ff-win-fx-countUp .ff-win-badge {
          transform: translate(-50%, -50%) scale(1);
        }
        .ff-win-fx-countUp .ff-win-amount-pill {
          transform: translate(-50%, -50%) scale(1);
        }
        .ff-win-fx-hero .ff-win-badge {
          animation: ffWinHeroPop 760ms ease-in-out infinite alternate;
        }
        .ff-win-fx-hero .ff-win-amount-pill {
          animation: ffWinHeroPop 760ms ease-in-out infinite alternate;
        }
        .ff-win-fx-done .ff-win-badge {
          transform: translate(-50%, -50%) scale(1);
          gap: 0;
        }
        .ff-win-fx-done .ff-win-amount-pill {
          transform: translate(-50%, -50%) scale(1);
        }
        .ff-win-fx-hero .ff-win-amount,
        .ff-win-fx-done .ff-win-amount {
          text-shadow:
            0 2px 0 rgba(125,57,13,0.28),
            0 0 18px rgba(255,244,186,0.58),
            0 0 34px rgba(255,168,102,0.3);
        }
        @keyframes ffWinBurstIn {
          0% {
            transform: translateX(-50%) scale(0.68);
            opacity: 0;
          }
          100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.92;
          }
        }
        @keyframes ffWinSplashIn {
          0% {
            transform: translate(-50%, -50%) scale(0.72);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        @keyframes ffWinBadgeIn {
          0% {
            transform: translate(-50%, -46%) scale(0.68);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        @keyframes ffWinRipple {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          20% {
            opacity: 0.82;
          }
          100% {
            transform: scale(1.34);
            opacity: 0;
          }
        }
        @keyframes ffWinSparkles {
          0%, 100% {
            opacity: 0.36;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.82;
            transform: scale(1.02);
          }
        }
        @keyframes ffWinHeroPop {
          0% {
            transform: translate(-50%, -50%) scale(1.02);
          }
          100% {
            transform: translate(-50%, -50%) scale(1.16);
          }
        }
        @keyframes ffWinFlamingoPop {
          0% {
            opacity: 0;
            transform: translate(-50%, 26%) scale(0.36);
          }
          42% {
            opacity: 1;
            transform: translate(-50%, -6%) scale(1.06);
          }
          68% {
            transform: translate(-50%, 2%) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0%) scale(0.98);
          }
        }
        @keyframes ffWinFlamingoOutlineShimmer {
          0%, 100% {
            filter:
              drop-shadow(0 10px 24px rgba(181, 55, 108, 0.22))
              drop-shadow(0 0 14px rgba(255, 212, 230, 0.16))
              drop-shadow(0 0 0 rgba(255, 255, 255, 0));
          }
          35% {
            filter:
              drop-shadow(0 10px 24px rgba(181, 55, 108, 0.24))
              drop-shadow(0 0 18px rgba(232, 236, 244, 0.28))
              drop-shadow(0 0 4px rgba(255, 255, 255, 0.2));
          }
          55% {
            filter:
              drop-shadow(0 10px 24px rgba(181, 55, 108, 0.24))
              drop-shadow(0 0 26px rgba(236, 240, 248, 0.38))
              drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
          }
          75% {
            filter:
              drop-shadow(0 10px 24px rgba(181, 55, 108, 0.24))
              drop-shadow(0 0 18px rgba(220, 226, 236, 0.24))
              drop-shadow(0 0 4px rgba(255, 255, 255, 0.18));
          }
        }
        .ce-board {
          background:
            radial-gradient(circle at 50% 4%, rgba(133, 255, 240, 0.34), transparent 24%),
            radial-gradient(circle at 18% 20%, rgba(118, 255, 148, 0.28), transparent 22%),
            radial-gradient(circle at 84% 18%, rgba(244, 116, 255, 0.24), transparent 24%),
            radial-gradient(circle at 50% 62%, rgba(54, 128, 255, 0.12), transparent 34%),
            linear-gradient(180deg, #04020f 0%, #120d2c 36%, #0b1130 63%, #060812 100%);
        }
        .ce-horizon-glow {
          position: absolute;
          inset: 18% 2% auto;
          height: 22%;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 50% 50%, rgba(104,255,223,0.42), rgba(104,255,223,0.14) 34%, transparent 70%);
          filter: blur(26px);
          opacity: 0.88;
        }
        .ce-stars,
        .ce-stars::before,
        .ce-stars::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.95) 0 1px, transparent 1.8px),
            radial-gradient(circle, rgba(108,255,240,0.95) 0 1px, transparent 1.8px),
            radial-gradient(circle, rgba(183,137,255,0.9) 0 1px, transparent 1.8px);
          background-size: 180px 180px, 230px 230px, 310px 310px;
          background-position: 0 0, 38px 54px, 84px 112px;
        }
        .ce-stars {
          opacity: 0.72;
        }
        .ce-stars::before {
          opacity: 0.45;
          transform: scale(1.08);
          animation: ceDrift 24s linear infinite;
        }
        .ce-stars::after {
          opacity: 0.3;
          transform: scale(1.16);
          animation: ceDriftReverse 30s linear infinite;
        }
        .ce-nebula {
          position: absolute;
          border-radius: 9999px;
          filter: blur(28px);
          opacity: 0.75;
          mix-blend-mode: screen;
        }
        .ce-nebula-a {
          inset: 15% auto auto 8%;
          width: 42%;
          height: 18%;
          background: radial-gradient(circle at 35% 50%, rgba(58,255,181,0.38), rgba(58,255,181,0));
          animation: ceFloat 8s ease-in-out infinite;
        }
        .ce-nebula-b {
          inset: auto 6% 8% auto;
          width: 46%;
          height: 22%;
          background: radial-gradient(circle at 50% 50%, rgba(214,87,255,0.4), rgba(214,87,255,0));
          animation: ceFloat 10s ease-in-out infinite reverse;
        }
        .ce-planet {
          position: absolute;
          border-radius: 9999px;
          box-shadow: inset -18px -24px 38px rgba(0,0,0,0.28), 0 0 40px rgba(255,255,255,0.1);
        }
        .ce-planet-a {
          top: 12%;
          right: 7%;
          width: 16%;
          aspect-ratio: 1;
          background:
            radial-gradient(circle at 32% 28%, rgba(255,238,195,0.9), rgba(255,179,71,0.92) 48%, rgba(131,74,255,0.7) 100%);
        }
        .ce-planet-a::after {
          content: "";
          position: absolute;
          inset: 38% -18% auto -18%;
          height: 14%;
          border-radius: 9999px;
          border: 2px solid rgba(255,226,137,0.8);
          transform: rotate(-12deg);
          box-shadow: 0 0 22px rgba(255,214,95,0.35);
        }
        .ce-planet-b {
          top: 14%;
          left: 4%;
          width: 11%;
          aspect-ratio: 1;
          background:
            radial-gradient(circle at 35% 32%, rgba(187,255,128,0.92), rgba(54,214,117,0.88) 58%, rgba(12,95,84,0.75) 100%);
        }
        .ce-signal-beam {
          position: absolute;
          left: 50%;
          top: 8%;
          width: 32%;
          height: 44%;
          transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(116,255,241,0.1), rgba(116,255,241,0.38) 38%, rgba(116,255,241,0));
          clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
          filter: blur(2px);
          opacity: 0.9;
        }
        .ce-logo-stage {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 47%;
          pointer-events: none;
        }
        .ce-logo-frame {
          position: absolute;
          overflow: hidden;
        }
        .ce-logo-frame-main {
          inset: 0 -1.5% 1.2% -1.5%;
        }
        .ce-logo-bleed {
          position: absolute;
          overflow: hidden;
          inset: 0;
        }
        .ce-logo-bleed-back {
          inset: -6% -8% 10% -8%;
          opacity: 0.46;
          filter: blur(38px) saturate(1.28) brightness(0.88);
          transform: scale(1.18);
          mix-blend-mode: screen;
        }
        .ce-logo-bleed-front {
          inset: -3% -5% 10% -5%;
          opacity: 0.28;
          filter: blur(14px) saturate(1.04) brightness(0.84);
          transform: scale(1.08);
        }
        .ce-logo-bleed-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 10%;
        }
        .ce-logo-main-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center top;
          transform: scaleX(1.16) scaleY(1.02);
          transform-origin: center top;
        }
        .ce-logo-halo {
          position: absolute;
          border-radius: 9999px;
          filter: blur(20px);
          mix-blend-mode: screen;
        }
        .ce-logo-halo-a {
          inset: 3% 1% 16%;
          background:
            radial-gradient(circle at 50% 50%, rgba(116,255,241,0.36), rgba(116,255,241,0.12) 42%, transparent 72%);
        }
        .ce-logo-halo-b {
          inset: 10% 5% 8%;
          background:
            radial-gradient(circle at 50% 45%, rgba(184,118,255,0.3), rgba(184,118,255,0.1) 42%, transparent 74%);
        }
        .ce-cockpit {
          pointer-events: none;
          z-index: 0;
        }
        .ce-cockpit-canopy {
          position: absolute;
          inset: 0;
          border-radius: 32px 32px 36px 36px;
          background:
            radial-gradient(circle at 50% -18%, rgba(136,255,241,0.18), rgba(136,255,241,0.02) 36%, transparent 60%),
            linear-gradient(180deg, rgba(122,139,182,0.18), rgba(38,48,78,0.42) 22%, rgba(9,13,24,0.86) 50%, rgba(6,8,14,0.96) 100%);
          border: 1px solid rgba(150, 231, 255, 0.2);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.16),
            inset 0 -24px 48px rgba(0,0,0,0.5),
            0 -12px 40px rgba(86,184,255,0.08);
        }
        .ce-cockpit-canopy::before {
          content: "";
          position: absolute;
          left: 3%;
          right: 3%;
          top: 0;
          height: 20%;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(170,217,255,0.2), rgba(170,217,255,0));
          filter: blur(4px);
        }
        .ce-cockpit-rib {
          position: absolute;
          top: 7%;
          bottom: 9%;
          width: 4.2%;
          border-radius: 9999px;
          background:
            linear-gradient(180deg, rgba(184,225,255,0.28), rgba(79,117,161,0.28) 18%, rgba(15,24,40,0.9) 55%, rgba(4,7,12,0.96) 100%);
          border: 1px solid rgba(143, 222, 255, 0.16);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.18),
            0 0 18px rgba(88,194,255,0.08);
        }
        .ce-cockpit-rib-left {
          left: 5.5%;
          transform: rotate(6deg);
        }
        .ce-cockpit-rib-right {
          right: 5.5%;
          transform: rotate(-6deg);
        }
        .ce-cockpit-rib-mid {
          left: 50%;
          width: 3%;
          transform: translateX(-50%);
          opacity: 0.82;
        }
        .ce-console {
          position: absolute;
          bottom: 6%;
          width: 17%;
          height: 15%;
          border-radius: 24px;
          background:
            radial-gradient(circle at 50% 0%, rgba(124,255,214,0.16), transparent 44%),
            linear-gradient(180deg, rgba(60,74,110,0.58), rgba(14,18,30,0.92));
          border: 1px solid rgba(145, 228, 255, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.14),
            inset 0 -8px 20px rgba(0,0,0,0.32);
        }
        .ce-console-left {
          left: 4%;
          transform: skewX(-12deg);
        }
        .ce-console-right {
          right: 4%;
          transform: skewX(12deg);
        }
        .ce-dashboard {
          position: absolute;
          left: 11%;
          right: 11%;
          bottom: 2.2%;
          height: 14%;
          border-radius: 24px 24px 30px 30px;
          background:
            linear-gradient(180deg, rgba(82,95,132,0.74), rgba(16,20,32,0.96)),
            radial-gradient(circle at 50% 0%, rgba(109,255,227,0.16), transparent 48%);
          border: 1px solid rgba(149, 231, 255, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.14),
            inset 0 -12px 24px rgba(0,0,0,0.36),
            0 -10px 30px rgba(38,116,174,0.12);
        }
        .ce-dashboard::before {
          content: "";
          position: absolute;
          left: 7%;
          right: 7%;
          top: 22%;
          height: 18%;
          border-radius: 9999px;
          background: linear-gradient(90deg, rgba(93,255,187,0.45), rgba(111,230,255,0.56), rgba(206,118,255,0.45));
          box-shadow: 0 0 16px rgba(108,241,255,0.22);
        }
        .ce-indicators {
          position: absolute;
          bottom: 9.5%;
          height: 4%;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 10% 50%, rgba(101,255,184,0.95) 0 16%, transparent 17%),
            radial-gradient(circle at 30% 50%, rgba(120,225,255,0.95) 0 16%, transparent 17%),
            radial-gradient(circle at 50% 50%, rgba(255,220,111,0.95) 0 16%, transparent 17%),
            radial-gradient(circle at 70% 50%, rgba(208,122,255,0.95) 0 16%, transparent 17%),
            radial-gradient(circle at 90% 50%, rgba(101,255,184,0.95) 0 16%, transparent 17%);
          filter: drop-shadow(0 0 6px rgba(127,239,255,0.28));
          opacity: 0.88;
        }
        .ce-indicators-left {
          left: 8%;
          width: 12%;
        }
        .ce-indicators-center {
          left: 50%;
          width: 22%;
          transform: translateX(-50%);
        }
        .ce-indicators-right {
          right: 8%;
          width: 12%;
        }
        .ce-screen-hood {
          pointer-events: none;
          z-index: 2;
          border-radius: 26px 26px 16px 16px;
          background:
            radial-gradient(circle at 50% 0%, rgba(140,255,241,0.22), rgba(140,255,241,0.03) 42%, transparent 68%),
            linear-gradient(180deg, rgba(34,45,69,0.94), rgba(9,14,25,0.96));
          border: 1px solid rgba(129, 234, 255, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -1px 0 rgba(0,0,0,0.36),
            0 10px 24px rgba(0,0,0,0.3);
        }
        .ce-screen-hood::before {
          content: "";
          position: absolute;
          left: 8%;
          right: 8%;
          bottom: 16%;
          height: 34%;
          border-radius: 9999px 9999px 12px 12px;
          color: rgba(111,255,106,0.98);
          background:
            radial-gradient(circle, rgba(255,255,255,0.98) 0 1px, currentColor 1.8px, rgba(255,255,255,0.28) 3px, transparent 4.2px) center 26% / 7% 14px repeat-x,
            linear-gradient(90deg, rgba(87,255,188,0.12), rgba(113,234,255,0.78), rgba(198,116,255,0.12)) center 24% / 48% 2px no-repeat;
          opacity: 1;
          box-shadow:
            inset 0 0 20px rgba(255,255,255,0.04),
            0 0 10px currentColor,
            0 0 22px currentColor,
            0 0 40px color-mix(in srgb, currentColor 62%, white 38%);
          filter: saturate(1.35) brightness(1.15);
          animation: ceConsoleLights 7s linear infinite;
        }
        .ce-screen-hood::after {
          content: "";
          position: absolute;
          left: 8%;
          right: 8%;
          bottom: 16%;
          height: 34%;
          border-radius: 9999px 9999px 12px 12px;
          background:
            linear-gradient(180deg, rgba(14,20,34,0.98), rgba(14,20,34,0.98)) left 0.8% top 26% / 7% 12px no-repeat,
            linear-gradient(180deg, rgba(14,20,34,0.98), rgba(14,20,34,0.98)) right 0.8% top 26% / 7% 12px no-repeat,
            linear-gradient(180deg, rgba(14,20,34,0.98), rgba(14,20,34,0.98)) left 9.5% top 26% / 12% 12px no-repeat,
            linear-gradient(180deg, rgba(14,20,34,0.98), rgba(14,20,34,0.98)) right 9.5% top 26% / 12% 12px no-repeat,
            linear-gradient(90deg, rgba(104,244,255,0.96), rgba(104,244,255,0.96)) left 0 top 50% / 12% 2px no-repeat,
            linear-gradient(90deg, rgba(104,244,255,0.96), rgba(104,244,255,0.96)) right 0 top 50% / 12% 2px no-repeat,
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0));
          border: 1px solid rgba(110, 240, 255, 0.12);
          box-shadow:
            inset 0 0 18px rgba(79, 255, 126, 0.05),
            0 0 14px rgba(113,234,255,0.08);
        }
        .ce-zone-frame {
          pointer-events: none;
          z-index: 3;
          border: 1px solid rgba(146, 234, 255, 0.16);
          background:
            linear-gradient(180deg, rgba(18,25,40,0.92), rgba(7,11,18,0.96));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 0 -1px 0 rgba(0,0,0,0.42),
            0 0 0 6px rgba(6,10,18,0.86),
            0 0 0 8px rgba(112, 231, 255, 0.04),
            0 16px 26px rgba(0,0,0,0.22);
        }
        .ce-zone-frame::before,
        .ce-zone-frame::after {
          content: "";
          position: absolute;
          pointer-events: none;
        }
        .ce-zone-frame::before {
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(90deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) left 16px top 14px / 28px 2px no-repeat,
            linear-gradient(180deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) left 14px top 16px / 2px 28px no-repeat,
            linear-gradient(90deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) right 16px top 14px / 28px 2px no-repeat,
            linear-gradient(180deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) right 14px top 16px / 2px 28px no-repeat,
            linear-gradient(90deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) left 16px bottom 14px / 28px 2px no-repeat,
            linear-gradient(180deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) left 14px bottom 16px / 2px 28px no-repeat,
            linear-gradient(90deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) right 16px bottom 14px / 28px 2px no-repeat,
            linear-gradient(180deg, rgba(109,245,255,0.98), rgba(109,245,255,0.98)) right 14px bottom 16px / 2px 28px no-repeat,
            linear-gradient(90deg, rgba(109,245,255,0), rgba(109,245,255,0.6), rgba(109,245,255,0)) center top 10px / 30% 1px no-repeat,
            linear-gradient(90deg, rgba(202,119,255,0), rgba(202,119,255,0.44), rgba(202,119,255,0)) center bottom 10px / 20% 1px no-repeat;
          filter: drop-shadow(0 0 8px rgba(104,241,255,0.18));
        }
        .ce-zone-frame::after {
          inset: 1.9%;
          border-radius: inherit;
          border: 1px solid rgba(98, 234, 255, 0.16);
          background:
            linear-gradient(180deg, rgba(186,232,255,0.08), rgba(186,232,255,0) 14%) top / 100% 16% no-repeat,
            repeating-linear-gradient(90deg, rgba(100,244,255,0.06) 0 1px, transparent 1px 36px),
            repeating-linear-gradient(180deg, rgba(120,219,255,0.025) 0 1px, transparent 1px 28px);
          box-shadow:
            inset 0 0 20px rgba(94,198,255,0.08),
            inset 0 0 0 1px rgba(255,255,255,0.03);
        }
        .ce-zone {
          position: absolute;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(circle at 18% 12%, rgba(103,255,180,0.16), rgba(103,255,180,0.03) 26%, transparent 46%),
            radial-gradient(circle at 82% 16%, rgba(198,110,255,0.16), rgba(198,110,255,0.03) 26%, transparent 48%),
            radial-gradient(circle at 52% 72%, rgba(71,120,255,0.12), rgba(71,120,255,0.02) 26%, transparent 46%),
            linear-gradient(180deg, #020207 0%, #060714 38%, #060912 100%);
          border: 1px solid rgba(130, 245, 255, 0.16);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.05),
            inset 0 18px 42px rgba(125,178,255,0.05),
            0 0 32px rgba(55, 204, 255, 0.14);
        }
        .ce-zone::before,
        .ce-zone::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }
        .ce-zone::before {
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.96) 0 1px, transparent 1.8px),
            radial-gradient(circle, rgba(100,255,229,0.9) 0 1px, transparent 1.8px),
            radial-gradient(circle, rgba(205,140,255,0.84) 0 1px, transparent 1.8px);
          background-size: 138px 138px, 196px 196px, 260px 260px;
          background-position: 0 0, 32px 40px, 72px 98px;
          opacity: 0.62;
        }
        .ce-zone::after {
          background:
            radial-gradient(circle at 14% 8%, rgba(101,255,176,0.18), transparent 26%),
            radial-gradient(circle at 86% 12%, rgba(205,117,255,0.18), transparent 24%),
            linear-gradient(130deg, rgba(84,255,191,0.12), rgba(84,255,191,0) 22%, transparent 44%, rgba(199,112,255,0.1) 70%, rgba(199,112,255,0) 88%);
          opacity: 0.9;
          mix-blend-mode: screen;
        }
        .ce-win-fx {
          position: absolute;
          z-index: 5;
          pointer-events: none;
          overflow: visible;
        }
        .ce-win-ufo {
          position: absolute;
          left: 50%;
          top: -3.2%;
          width: 69%;
          transform: translateX(-50%) translateY(20%) scale(0.45);
          opacity: 0;
          transition:
            transform 520ms cubic-bezier(0.2, 0.9, 0.28, 1),
            opacity 300ms ease,
            filter 520ms ease;
        }
        .ce-win-fx-hoverIn .ce-win-ufo,
        .ce-win-fx-hoverPause .ce-win-ufo,
        .ce-win-fx-beamIn .ce-win-ufo,
        .ce-win-fx-countUp .ce-win-ufo,
        .ce-win-fx-beamOff .ce-win-ufo {
          opacity: 1;
          filter:
            drop-shadow(0 0 18px rgba(138,255,176,0.42))
            drop-shadow(0 18px 28px rgba(0,0,0,0.44));
        }
        .ce-win-fx-hoverIn .ce-win-ufo {
          animation: ceWinUfoApproach 1800ms cubic-bezier(0.22, 0.78, 0.22, 1) both;
        }
        .ce-win-fx-hoverPause .ce-win-ufo,
        .ce-win-fx-beamIn .ce-win-ufo,
        .ce-win-fx-countUp .ce-win-ufo,
        .ce-win-fx-beamOff .ce-win-ufo {
          transform: translateX(-50%) translateY(-6.8%) scale(1.24);
        }
        .ce-win-fx-exit .ce-win-ufo {
          transform: translateX(-50%) translateY(-170%) scale(0.42);
          opacity: 0;
          filter:
            drop-shadow(0 0 30px rgba(152,255,208,0.52))
            drop-shadow(0 0 56px rgba(123,215,255,0.3));
        }
        .ce-win-ufo-img {
          width: 100%;
          height: auto;
          object-fit: contain;
          display: block;
          filter:
            drop-shadow(0 0 30px rgba(138,255,176,0.36))
            drop-shadow(0 0 68px rgba(119,231,255,0.2))
            drop-shadow(0 24px 32px rgba(0,0,0,0.46));
        }
        .ce-win-beam {
          position: absolute;
          left: 50%;
          top: 23.5%;
          width: 40%;
          height: 46.7%;
          transform: translateX(-50%) scaleY(0.15);
          transform-origin: center top;
          opacity: 0;
          clip-path: polygon(50% 0%, 78% 14%, 92% 52%, 100% 100%, 0% 100%, 8% 52%, 22% 14%);
          background:
            linear-gradient(
              180deg,
              rgba(252,255,251,0.98) 0%,
              rgba(206,255,228,0.95) 8%,
              rgba(128,255,196,0.78) 24%,
              rgba(86,255,175,0.46) 56%,
              rgba(86,255,175,0.16) 82%,
              rgba(86,255,175,0.04) 100%
            );
          filter:
            blur(0.6px)
            drop-shadow(0 0 34px rgba(113,255,191,0.82))
            drop-shadow(0 0 84px rgba(113,255,191,0.46));
          transition:
            opacity 260ms ease,
            transform 520ms cubic-bezier(0.2, 0.9, 0.28, 1),
            filter 420ms ease;
        }
        .ce-win-beam-cap {
          position: absolute;
          left: 50%;
          top: 21.4%;
          width: 18.5%;
          height: 7.4%;
          transform: translateX(-50%) scale(0.72);
          transform-origin: center center;
          opacity: 0;
          border-radius: 50% 50% 58% 58%;
          background:
            radial-gradient(circle at 50% 34%, rgba(255,255,253,1) 0 18%, rgba(220,255,232,0.98) 34%, rgba(132,255,199,0.86) 56%, rgba(117,255,192,0.18) 80%, rgba(117,255,192,0) 100%),
            linear-gradient(180deg, rgba(194,255,230,0.9), rgba(82,255,171,0.24));
          filter:
            blur(0.6px)
            drop-shadow(0 0 24px rgba(121,255,187,0.86))
            drop-shadow(0 0 56px rgba(121,255,187,0.4));
          transition:
            opacity 220ms ease,
            transform 360ms ease,
            filter 360ms ease;
          z-index: 1;
        }
        .ce-win-beam-cap::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -48%;
          width: 48%;
          height: 82%;
          transform: translateX(-50%);
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(218,255,236,0.98), rgba(112,255,186,0));
          filter: blur(1.8px);
        }
        .ce-win-beam::before {
          content: "";
          position: absolute;
          inset: 0;
          clip-path: inherit;
          background:
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.34) 0 8%,
              rgba(255,255,255,0.07) 8% 16%
            );
          opacity: 0.96;
          mix-blend-mode: screen;
        }
        .ce-win-beam::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -7%;
          width: 82%;
          height: 22%;
          transform: translateX(-50%);
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(252,255,248,1) 0 14%, rgba(176,255,214,0.9) 24%, rgba(118,255,191,0.52) 50%, rgba(102,255,187,0) 100%);
          filter: blur(4px);
        }
        .ce-win-fx-beamIn .ce-win-beam,
        .ce-win-fx-countUp .ce-win-beam {
          opacity: 1;
          transform: translateX(-50%) scaleY(1);
        }
        .ce-win-fx-beamIn .ce-win-beam-cap,
        .ce-win-fx-countUp .ce-win-beam-cap {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }
        .ce-win-fx-beamOff .ce-win-beam {
          opacity: 0;
          transform: translateX(-50%) scaleY(0.2);
        }
        .ce-win-fx-beamOff .ce-win-beam-cap {
          opacity: 0.28;
          transform: translateX(-50%) scale(0.88);
        }
        .ce-win-fx-exit .ce-win-beam,
        .ce-win-fx-done .ce-win-beam {
          opacity: 0;
          transform: translateX(-50%) scaleY(0.1);
        }
        .ce-win-fx-exit .ce-win-beam-cap,
        .ce-win-fx-done .ce-win-beam-cap {
          opacity: 0;
          transform: translateX(-50%) scale(0.1);
        }
        .ce-win-beam-target {
          position: absolute;
          left: 50%;
          top: 55.8%;
          width: 54%;
          height: 18%;
          transform: translate(-50%, -50%) scale(0.72);
          opacity: 0;
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(248,255,249,0.94) 0 12%, rgba(170,255,215,0.72) 24%, rgba(112,255,188,0.32) 54%, rgba(100,255,184,0) 100%);
          filter:
            blur(10px)
            drop-shadow(0 0 24px rgba(111,255,175,0.56))
            drop-shadow(0 0 58px rgba(111,255,175,0.34));
          transition:
            opacity 220ms ease,
            transform 320ms ease;
        }
        .ce-win-fx-beamIn .ce-win-beam-target,
        .ce-win-fx-countUp .ce-win-beam-target {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        .ce-win-fx-beamOff .ce-win-beam-target {
          opacity: 0.42;
          transform: translate(-50%, -50%) scale(0.96);
        }
        .ce-win-fx-exit .ce-win-beam-target,
        .ce-win-fx-done .ce-win-beam-target {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.88);
        }
        .ce-win-amount {
          position: absolute;
          left: 50%;
          top: 56%;
          transform: translate(-50%, -50%) scale(0.76);
          opacity: 0;
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          background: rgba(5,12,22,0.74);
          border: 1px solid rgba(122,247,255,0.34);
          color: rgba(201,255,208,0.98);
          font-size: clamp(1rem, 1.2vw + 0.85rem, 1.7rem);
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          pointer-events: auto;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            0 0 24px rgba(111,255,175,0.24),
            0 12px 22px rgba(0,0,0,0.34);
          transition:
            opacity 240ms ease,
            top 520ms cubic-bezier(0.2, 0.9, 0.28, 1),
            transform 520ms cubic-bezier(0.2, 0.9, 0.28, 1),
            padding 520ms ease,
            box-shadow 420ms ease,
            background 420ms ease,
            border-color 420ms ease,
            color 320ms ease;
        }
        .ce-win-amount-value {
          line-height: 1;
          white-space: nowrap;
        }
        .ce-win-fx-countUp .ce-win-amount,
        .ce-win-fx-beamOff .ce-win-amount {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        .ce-win-fx-beamIn .ce-win-amount,
        .ce-win-fx-countUp .ce-win-amount {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.18),
            0 0 18px rgba(214,255,229,0.42),
            0 0 44px rgba(111,255,175,0.3),
            0 14px 24px rgba(0,0,0,0.34);
          border-color: rgba(170,255,212,0.56);
          animation: ceWinAmountHero 960ms ease-in-out infinite;
        }
        .ce-win-fx-exit .ce-win-amount {
          top: 36%;
          opacity: 1;
          padding: 0.72rem 1.6rem;
          transform: translate(-50%, -50%) scale(1.62);
          background: rgba(6,18,30,0.9);
          border-color: rgba(196,255,220,0.76);
          color: rgba(235,255,240,1);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.24),
            0 0 28px rgba(229,255,238,0.54),
            0 0 72px rgba(111,255,175,0.46),
            0 18px 34px rgba(0,0,0,0.42);
          animation: ceWinAmountHero 720ms ease-in-out infinite;
        }
        .ce-win-fx-done .ce-win-amount {
          top: 34%;
          opacity: 1;
          padding: 0.86rem 1.95rem;
          transform: translate(-50%, -50%) scale(1.94);
          gap: 0.9rem;
          white-space: normal;
          background: linear-gradient(180deg, rgba(13,28,46,0.96), rgba(5,12,22,0.96));
          border-color: rgba(232,255,198,0.94);
          color: rgba(246,255,210,1);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.24),
            0 0 34px rgba(255,255,232,0.6),
            0 0 88px rgba(150,255,136,0.48),
            0 18px 36px rgba(0,0,0,0.44);
          animation: ceWinAmountJackpot 520ms ease-in-out infinite;
        }
        .ce-win-buy-again {
          border: 1px solid rgba(186,255,239,0.55);
          background: linear-gradient(180deg, #b9fff5 0%, #57e8c5 100%);
          border-radius: 9999px;
          padding: 0.56rem 1.05rem;
          min-width: 164px;
          color: #07131d;
          font-size: 0.74rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          box-shadow: 0 16px 32px rgba(87,232,197,0.28);
          transition: filter 180ms ease, opacity 180ms ease;
        }
        .ce-win-buy-again:hover {
          filter: brightness(1.05);
        }
        .ce-win-buy-again:disabled {
          cursor: default;
          opacity: 0.45;
          filter: none;
        }
        @media (max-width: 640px) {
          .ce-win-fx-done .ce-win-amount {
            top: 39%;
            max-width: min(82vw, 320px);
            padding: 0.68rem 1rem;
            transform: translate(-50%, -50%) scale(1.28);
            gap: 0.55rem;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 0 24px rgba(255,255,232,0.46),
              0 0 56px rgba(150,255,136,0.34),
              0 14px 28px rgba(0,0,0,0.4);
          }
          .ce-win-buy-again {
            min-width: 0;
            width: 100%;
            padding: 0.72rem 1rem;
            font-size: 0.74rem;
            letter-spacing: 0.18em;
          }
        }
        @media (max-width: 480px) {
          .ce-win-fx-done .ce-win-amount {
            top: 40.5%;
            max-width: min(84vw, 286px);
            padding: 0.58rem 0.82rem;
            transform: translate(-50%, -50%) scale(1.08);
            gap: 0.42rem;
          }
          .ce-win-amount-value {
            font-size: 0.92em;
          }
          .ce-win-buy-again {
            padding: 0.64rem 0.8rem;
            font-size: 0.66rem;
            letter-spacing: 0.12em;
          }
        }
        .ce-symbol-card {
          position: relative;
          display: grid;
          place-items: center;
          border-radius: 32%;
          padding: 0.14rem;
          overflow: visible;
          background: transparent;
          border: none;
          box-shadow: none;
          transform: translateZ(0);
        }
        .ce-symbol-card::before {
          content: none;
        }
        .ce-symbol-card-win {
          padding: 0.45rem;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 30%, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 32%, transparent 58%),
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 1px solid rgba(201, 245, 255, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.18),
            0 0 0 1px rgba(123,246,255,0.36),
            0 0 32px var(--ce-glow),
            0 12px 28px rgba(0,0,0,0.22);
          backdrop-filter: blur(8px);
        }
        .ce-symbol-card-win::before {
          content: "";
          position: absolute;
          inset: 8%;
          border-radius: 28%;
          background: radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%);
          pointer-events: none;
        }
        .ce-symbol-img {
          position: relative;
          z-index: 1;
          inset: 10%;
          filter: drop-shadow(0 6px 16px rgba(0,0,0,0.22));
        }
        .ce-symbol-img-win {
          filter: drop-shadow(0 6px 16px rgba(0,0,0,0.22)) drop-shadow(0 0 12px var(--ce-glow));
        }
        .ce-symbol-pulse {
          position: absolute;
          inset: -6%;
          border-radius: 30%;
          border: 1px solid rgba(124, 246, 255, 0.55);
          box-shadow: 0 0 26px var(--ce-glow);
          animation: cePulse 900ms ease-in-out infinite;
        }
        @keyframes ceConsoleLights {
          0% { color: rgba(111,255,106,0.98); opacity: 0.96; }
          12% { color: rgba(255,255,255,1); opacity: 1; }
          24% { color: rgba(210,122,255,0.98); opacity: 0.97; }
          36% { color: rgba(111,255,106,0.98); opacity: 0.96; }
          48% { color: rgba(255,164,88,0.98); opacity: 0.98; }
          60% { color: rgba(255,233,108,1); opacity: 1; }
          72% { color: rgba(255,255,255,1); opacity: 1; }
          84% { color: rgba(115,214,255,0.98); opacity: 0.98; }
          92% { color: rgba(210,122,255,0.98); opacity: 0.97; }
          100% { color: rgba(111,255,106,0.98); opacity: 0.96; }
        }
        @keyframes sbPulse {
          0% { transform: scale(0.98); opacity: 0.55; }
          50% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(0.98); opacity: 0.55; }
        }
        @keyframes sbBounce {
          0% { transform: scale(0.9) translateY(6px); }
          40% { transform: scale(1.18) translateY(-10px); }
          65% { transform: scale(0.96) translateY(4px); }
          85% { transform: scale(1.05) translateY(-2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes sbPop {
          0% { transform: translateX(-50%) scale(0.92); }
          100% { transform: translateX(-50%) scale(1); }
        }
        @keyframes ceFloat {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(1.5%, -3%, 0) scale(1.04); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes ceDrift {
          0% { transform: translate3d(0, 0, 0) scale(1.08); }
          100% { transform: translate3d(-3%, 4%, 0) scale(1.14); }
        }
        @keyframes ceDriftReverse {
          0% { transform: translate3d(0, 0, 0) scale(1.16); }
          100% { transform: translate3d(4%, -3%, 0) scale(1.22); }
        }
        @keyframes cePulse {
          0% { transform: scale(0.98); opacity: 0.46; }
          50% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(0.98); opacity: 0.46; }
        }
        @keyframes ceWinUfoApproach {
          0% {
            transform: translateX(-50%) translateY(18%) scale(0.48);
          }
          14% {
            transform: translateX(-50%) translateY(2%) scale(0.84);
          }
          28% {
            transform: translateX(-50%) translateY(-4.2%) scale(0.96);
          }
          42% {
            transform: translateX(-50%) translateY(-1.6%) scale(1.02);
          }
          58% {
            transform: translateX(-50%) translateY(-5.8%) scale(1.08);
          }
          74% {
            transform: translateX(-50%) translateY(-2.4%) scale(1.12);
          }
          88% {
            transform: translateX(-50%) translateY(-7.2%) scale(1.22);
          }
          100% {
            transform: translateX(-50%) translateY(-6.8%) scale(1.24);
          }
        }
        @keyframes ceWinAmountHero {
          0% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.18),
              0 0 18px rgba(214,255,229,0.42),
              0 0 44px rgba(111,255,175,0.3),
              0 14px 24px rgba(0,0,0,0.34);
          }
          50% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 0 26px rgba(228,255,239,0.58),
              0 0 64px rgba(111,255,175,0.42),
              0 16px 28px rgba(0,0,0,0.38);
          }
          100% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.18),
              0 0 18px rgba(214,255,229,0.42),
              0 0 44px rgba(111,255,175,0.3),
              0 14px 24px rgba(0,0,0,0.34);
          }
        }
        @keyframes ceWinAmountJackpot {
          0% {
            filter: brightness(1) saturate(1);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.24),
              0 0 34px rgba(255,255,232,0.6),
              0 0 88px rgba(150,255,136,0.48),
              0 18px 36px rgba(0,0,0,0.44);
          }
          50% {
            filter: brightness(1.18) saturate(1.18);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.3),
              0 0 42px rgba(255,255,245,0.84),
              0 0 112px rgba(188,255,120,0.72),
              0 20px 38px rgba(0,0,0,0.48);
          }
          100% {
            filter: brightness(1) saturate(1);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.24),
              0 0 34px rgba(255,255,232,0.6),
              0 0 88px rgba(150,255,136,0.48),
              0 18px 36px rgba(0,0,0,0.44);
          }
        }
      `}</style>
    </main>
  );
}

export default function ScratchPage() {
  return (
    <Suspense fallback={null}>
      <ScratchPageContent />
    </Suspense>
  );
}
