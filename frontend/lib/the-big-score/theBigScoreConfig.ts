import type {
  TheBigScoreCrewId,
  TheBigScoreCrewOption,
  TheBigScoreEntranceId,
  TheBigScoreEntranceOption,
  TheBigScoreGetawayId,
  TheBigScoreGetawayOption,
  TheBigScoreToolId,
  TheBigScoreToolOption,
} from "./theBigScoreTypes";

const ASSET_ROOT = "/assets/tickets/the-big-score";

export const THE_BIG_SCORE_LOGO_SRC = `${ASSET_ROOT}/logo.png`;
export const THE_BIG_SCORE_SCRATCH_THRESHOLD = 0.48;

export const THE_BIG_SCORE_CREW: TheBigScoreCrewOption[] = [
  {
    id: "the_ghost",
    title: "The Ghost",
    subtitle: "Stealth specialist",
    role: "Silent entry",
    imageSrc: `${ASSET_ROOT}/crew/the-ghost.png`,
    accentClass: "from-[#5f1119] via-[#af1f2d] to-[#f8a066]",
    glow: "rgba(248,120,102,0.34)",
  },
  {
    id: "the_hacker",
    title: "The Hacker",
    subtitle: "Systems specialist",
    role: "Digital override",
    imageSrc: `${ASSET_ROOT}/crew/the-hacker.png`,
    accentClass: "from-[#062716] via-[#0d7d4a] to-[#7cffb0]",
    glow: "rgba(82,255,171,0.32)",
  },
  {
    id: "the_wheelman",
    title: "The Wheelman",
    subtitle: "Escape driver",
    role: "High-risk exit",
    imageSrc: `${ASSET_ROOT}/crew/the-wheelman.png`,
    accentClass: "from-[#281108] via-[#8d5017] to-[#ffd478]",
    glow: "rgba(255,202,104,0.32)",
  },
  {
    id: "the_inside_man",
    title: "The Inside Man",
    subtitle: "Casino mole",
    role: "Hidden access",
    imageSrc: `${ASSET_ROOT}/crew/the-inside-man.png`,
    accentClass: "from-[#2d0d14] via-[#82422a] to-[#f1c16a]",
    glow: "rgba(255,196,104,0.28)",
  },
  {
    id: "the_safecracker",
    title: "The Safecracker",
    subtitle: "Vault specialist",
    role: "Precision breach",
    imageSrc: `${ASSET_ROOT}/crew/the-safecracker.png`,
    accentClass: "from-[#2b1b0e] via-[#896038] to-[#f6d08a]",
    glow: "rgba(255,219,146,0.32)",
  },
];

export const THE_BIG_SCORE_TOOLS: TheBigScoreToolOption[] = [
  {
    id: "laser_spoofer",
    title: "Laser Spoofer",
    subtitle: "Bypass Lasers",
    colorName: "Red",
    imageSrc: `${ASSET_ROOT}/tools/laser-spoofer.png`,
    accentClass: "from-[#33040a] via-[#9f1025] to-[#ff6f58]",
    glow: "rgba(255,89,89,0.34)",
  },
  {
    id: "blackout_device",
    title: "Blackout Device",
    subtitle: "Cut The Power",
    colorName: "Purple",
    imageSrc: `${ASSET_ROOT}/tools/blackout-device.png`,
    accentClass: "from-[#140520] via-[#5623a5] to-[#ba7cff]",
    glow: "rgba(172,96,255,0.34)",
  },
  {
    id: "emp_charge",
    title: "EMP Charge",
    subtitle: "Disable Systems",
    colorName: "Blue",
    imageSrc: `${ASSET_ROOT}/tools/emp-charge.png`,
    accentClass: "from-[#08162f] via-[#0d53be] to-[#62c5ff]",
    glow: "rgba(88,182,255,0.34)",
  },
  {
    id: "diamond_decoder",
    title: "Diamond Decoder",
    subtitle: "Scan The Vault",
    colorName: "Green",
    imageSrc: `${ASSET_ROOT}/tools/diamond-decoder.png`,
    accentClass: "from-[#05190d] via-[#0b7a3c] to-[#7dff9e]",
    glow: "rgba(111,255,173,0.3)",
  },
  {
    id: "gold_key",
    title: "Gold Key",
    subtitle: "Master Access",
    colorName: "Gold",
    imageSrc: `${ASSET_ROOT}/tools/gold-key.png`,
    accentClass: "from-[#231303] via-[#9f6a16] to-[#ffe089]",
    glow: "rgba(255,216,122,0.34)",
  },
];

export const THE_BIG_SCORE_ENTRANCES: TheBigScoreEntranceOption[] = [
  {
    id: "vip_lounge",
    title: "VIP Lounge",
    subtitle: "Velvet access",
    imageSrc: `${ASSET_ROOT}/entrances/vip-lounge.png`,
    accentClass: "from-[#25110d] via-[#7b3113] to-[#ffc673]",
    glow: "rgba(255,195,108,0.28)",
  },
  {
    id: "rooftop_break_in",
    title: "Rooftop Break-In",
    subtitle: "Topside breach",
    imageSrc: `${ASSET_ROOT}/entrances/rooftop-break-in.png`,
    accentClass: "from-[#090d18] via-[#405882] to-[#aacbff]",
    glow: "rgba(150,195,255,0.28)",
  },
  {
    id: "underground_tunnel",
    title: "Underground Tunnel",
    subtitle: "Hidden route",
    imageSrc: `${ASSET_ROOT}/entrances/underground-tunnel.png`,
    accentClass: "from-[#16120d] via-[#5f5034] to-[#c8b27a]",
    glow: "rgba(215,187,123,0.28)",
  },
  {
    id: "high_roller_suite",
    title: "High Roller Suite",
    subtitle: "Private vault line",
    imageSrc: `${ASSET_ROOT}/entrances/high-roller-suite.png`,
    accentClass: "from-[#221104] via-[#83531a] to-[#f2cf8c]",
    glow: "rgba(255,214,147,0.28)",
  },
];

export const THE_BIG_SCORE_GETAWAYS: TheBigScoreGetawayOption[] = [
  {
    id: "helicopter",
    title: "Helicopter",
    subtitle: "Sky exit",
    imageSrc: `${ASSET_ROOT}/getaways/helicopter.png`,
    accentClass: "from-[#08131d] via-[#395d77] to-[#92d3ff]",
    glow: "rgba(136,204,255,0.28)",
  },
  {
    id: "armored_vehicle",
    title: "Armored Vehicle",
    subtitle: "Heavy cover",
    imageSrc: `${ASSET_ROOT}/getaways/armored-vehicle.png`,
    accentClass: "from-[#1a1008] via-[#66503b] to-[#d6ba8d]",
    glow: "rgba(214,188,141,0.28)",
  },
  {
    id: "speedboat",
    title: "Speedboat",
    subtitle: "Water route",
    imageSrc: `${ASSET_ROOT}/getaways/speedboat.png`,
    accentClass: "from-[#071321] via-[#1c5b8f] to-[#73d6ff]",
    glow: "rgba(109,210,255,0.28)",
  },
  {
    id: "hot_pursuit",
    title: "Hot Pursuit",
    subtitle: "Strip chase",
    imageSrc: `${ASSET_ROOT}/getaways/hot-pursuit.png`,
    accentClass: "from-[#200710] via-[#73252f] to-[#ff9368]",
    glow: "rgba(255,135,101,0.32)",
  },
];

export function getTheBigScoreCrew(crewId: TheBigScoreCrewId) {
  const option = THE_BIG_SCORE_CREW.find((entry) => entry.id === crewId);
  if (!option) {
    throw new Error(`Unknown Big Score crew option: ${crewId}`);
  }
  return option;
}

export function getTheBigScoreTool(toolId: TheBigScoreToolId) {
  const option = THE_BIG_SCORE_TOOLS.find((entry) => entry.id === toolId);
  if (!option) {
    throw new Error(`Unknown Big Score tool option: ${toolId}`);
  }
  return option;
}

export function getTheBigScoreEntrance(entranceId: TheBigScoreEntranceId) {
  const option = THE_BIG_SCORE_ENTRANCES.find((entry) => entry.id === entranceId);
  if (!option) {
    throw new Error(`Unknown Big Score entrance option: ${entranceId}`);
  }
  return option;
}

export function getTheBigScoreGetaway(getawayId: TheBigScoreGetawayId) {
  const option = THE_BIG_SCORE_GETAWAYS.find((entry) => entry.id === getawayId);
  if (!option) {
    throw new Error(`Unknown Big Score getaway option: ${getawayId}`);
  }
  return option;
}
