export type LifetimeStatusTier = {
  key: string;
  name: string;
  description: string;
  minPoints: number;
  statusIconAsset: string;
  badgeKey?: string;
  accentToken?: string;
  trophyAsset?: string;
  trophyThumbnailAsset?: string;
  trophySilhouetteAsset?: string;
  materialKey?: string;
  pedestalStyle?: string;
  spotlightStyle?: string;
  designConcept?: string;
};

export const LIFETIME_STATUS_TIERS: LifetimeStatusTier[] = [
  {
    key: "rookie",
    name: "Rookie",
    description: "Just getting started",
    minPoints: 0,
    statusIconAsset: "/legacy/status/rookie.png",
    badgeKey: "R",
    accentToken: "mint",
    materialKey: "silver",
    pedestalStyle: "clean-plinth",
    spotlightStyle: "soft-mint",
    designConcept: "Polished silver Scratch & Save ticket on a small pedestal",
  },
  {
    key: "collector",
    name: "Collector",
    description: "Learning the ropes",
    minPoints: 5_000,
    statusIconAsset: "/legacy/status/collector.png",
    badgeKey: "C",
    accentToken: "gold",
    materialKey: "bronze",
    pedestalStyle: "vault-base",
    spotlightStyle: "warm-gold",
    designConcept: "Bronze vault filled with collectible tickets",
  },
  {
    key: "explorer",
    name: "Explorer",
    description: "Discovering new games",
    minPoints: 20_000,
    statusIconAsset: "/legacy/status/explorer.png",
    badgeKey: "E",
    accentToken: "cyan",
    materialKey: "emerald-crystal",
    pedestalStyle: "map-plinth",
    spotlightStyle: "cool-cyan",
    designConcept: "Emerald crystal compass with gold trim",
  },
  {
    key: "adventurer",
    name: "Adventurer",
    description: "Regular player",
    minPoints: 50_000,
    statusIconAsset: "/legacy/status/adventurer.png",
    badgeKey: "A",
    accentToken: "teal",
    materialKey: "relic-gold",
    pedestalStyle: "treasure-plinth",
    spotlightStyle: "teal-gold",
    designConcept: "Ornate chest glowing with tickets, gold, and crystal light",
  },
  {
    key: "treasure_hunter",
    name: "Treasure Hunter",
    description: "Finds the big wins",
    minPoints: 100_000,
    statusIconAsset: "/legacy/status/treasure-hunter.png",
    badgeKey: "T",
    accentToken: "amber",
    materialKey: "vault-gold",
    pedestalStyle: "ancient-lock",
    spotlightStyle: "amber-beam",
    designConcept: "Floating golden key before an ancient vault mechanism",
  },
  {
    key: "high_roller",
    name: "High Roller",
    description: "Chasing jackpots",
    minPoints: 250_000,
    statusIconAsset: "/legacy/status/high-roller.png",
    badgeKey: "H",
    accentToken: "ruby",
    materialKey: "crown-gold",
    pedestalStyle: "velvet-plinth",
    spotlightStyle: "ruby-gold",
    designConcept: "Luxury gold crown set with ruby gemstones",
  },
  {
    key: "elite",
    name: "Elite",
    description: "Top-tier player",
    minPoints: 500_000,
    statusIconAsset: "/legacy/status/elite.png",
    badgeKey: "E",
    accentToken: "sapphire",
    materialKey: "sapphire-crystal",
    pedestalStyle: "shield-plinth",
    spotlightStyle: "cool-sapphire",
    designConcept: "Sapphire crystal shield with polished silver edges",
  },
  {
    key: "champion",
    name: "Champion",
    description: "Serious competitor",
    minPoints: 1_000_000,
    statusIconAsset: "/legacy/status/champion.png",
    badgeKey: "C",
    accentToken: "violet",
    materialKey: "crystal-gold",
    pedestalStyle: "winged-stage",
    spotlightStyle: "hero-violet",
    designConcept: "Championship sculpture with crystal S, gold wings, and spotlight",
  },
  {
    key: "legend",
    name: "Legend",
    description: "Widely recognized",
    minPoints: 2_500_000,
    statusIconAsset: "/legacy/status/legend.png",
    badgeKey: "L",
    accentToken: "magenta",
    materialKey: "molten-gold",
    pedestalStyle: "phoenix-base",
    spotlightStyle: "ember-magenta",
    designConcept: "Phoenix sculpture formed from molten gold and crystal feathers",
  },
  {
    key: "grand_legend",
    name: "Grand Legend",
    description: "Among the best",
    minPoints: 5_000_000,
    statusIconAsset: "/legacy/status/grand-legend.png",
    badgeKey: "G",
    accentToken: "purple",
    materialKey: "royal-gold",
    pedestalStyle: "throne-dais",
    spotlightStyle: "royal-purple",
    designConcept: "Regal throne with a hovering illuminated crown",
  },
  {
    key: "hall_of_fame",
    name: "Hall of Fame",
    description: "Permanent elite",
    minPoints: 10_000_000,
    statusIconAsset: "/legacy/status/hall-of-fame.png",
    badgeKey: "H",
    accentToken: "platinum",
    materialKey: "marble-gold",
    pedestalStyle: "monument-base",
    spotlightStyle: "museum-white",
    designConcept: "Monumental marble pedestal with a floating legacy emblem",
  },
  {
    key: "master_collector",
    name: "Master Collector",
    description: "Incredible dedication",
    minPoints: 25_000_000,
    statusIconAsset: "/legacy/status/master-collector.png",
    badgeKey: "M",
    accentToken: "copper",
    materialKey: "vault-relic",
    pedestalStyle: "gallery-vault",
    spotlightStyle: "vault-copper",
    designConcept: "Grand vault displaying miniature relics from previous tiers",
  },
  {
    key: "diamond_status",
    name: "Diamond Status",
    description: "Rare achievement",
    minPoints: 50_000_000,
    statusIconAsset: "/legacy/status/diamond-status.png",
    badgeKey: "D",
    accentToken: "ice",
    materialKey: "diamond",
    pedestalStyle: "prism-plinth",
    spotlightStyle: "diamond-white",
    designConcept: "Sculpture carved from flawless prismatic diamond",
  },
  {
    key: "mythic",
    name: "Mythic",
    description: "Legendary",
    minPoints: 100_000_000,
    statusIconAsset: "/legacy/status/mythic.png",
    badgeKey: "M",
    accentToken: "aurora",
    materialKey: "aurora-crystal",
    pedestalStyle: "mythic-halo",
    spotlightStyle: "aurora-spectrum",
    designConcept: "Aurora crystal monument with shifting spectral material",
  },
  {
    key: "immortal",
    name: "Immortal",
    description: "Almost unreachable",
    minPoints: 250_000_000,
    statusIconAsset: "/legacy/status/immortal.png",
    badgeKey: "I",
    accentToken: "celestial",
    materialKey: "celestial-gold",
    pedestalStyle: "cosmic-pedestal",
    spotlightStyle: "celestial-aura",
    designConcept: "Celestial monument with energy rings, stars, gold, diamond, and aurora crystal",
  },
];

export type LifetimeStatusRoadmapEntry = {
  tier: LifetimeStatusTier;
  state: "completed" | "current" | "next" | "locked";
  pointsRemaining: number;
};

export type LifetimeStatusProgress = {
  totalPoints: number;
  currentTier: LifetimeStatusTier;
  nextTier: LifetimeStatusTier | null;
  progress: number;
  pointsIntoTier: number;
  pointsSpan: number;
  pointsRemaining: number;
  isMaxTier: boolean;
};

const lifetimePointsFormatter = new Intl.NumberFormat("en-US");

function normalizeLifetimePoints(points: unknown): number {
  if (typeof points !== "number" || !Number.isFinite(points)) {
    return 0;
  }

  return Math.max(0, Math.floor(points));
}

export function formatLifetimePoints(points: unknown): string {
  return lifetimePointsFormatter.format(normalizeLifetimePoints(points));
}

export function formatLifetimePointsRemaining(points: unknown): string {
  const normalizedPoints = normalizeLifetimePoints(points);
  return `${formatLifetimePoints(normalizedPoints)} ${normalizedPoints === 1 ? "point" : "points"} remaining`;
}

export function getLifetimeStatus(points: unknown): LifetimeStatusTier {
  const normalizedPoints = normalizeLifetimePoints(points);

  for (let index = LIFETIME_STATUS_TIERS.length - 1; index >= 0; index -= 1) {
    const tier = LIFETIME_STATUS_TIERS[index];
    if (normalizedPoints >= tier.minPoints) {
      return tier;
    }
  }

  return LIFETIME_STATUS_TIERS[0];
}

export function getNextLifetimeStatus(points: unknown): LifetimeStatusTier | null {
  const currentTier = getLifetimeStatus(points);
  const currentIndex = LIFETIME_STATUS_TIERS.findIndex((tier) => tier.key === currentTier.key);
  return LIFETIME_STATUS_TIERS[currentIndex + 1] ?? null;
}

export function getLifetimePointsRemaining(points: unknown): number {
  const normalizedPoints = normalizeLifetimePoints(points);
  const nextTier = getNextLifetimeStatus(normalizedPoints);
  if (!nextTier) return 0;
  return Math.max(0, nextTier.minPoints - normalizedPoints);
}

export function getLifetimeStatusProgress(points: unknown): LifetimeStatusProgress {
  const totalPoints = normalizeLifetimePoints(points);
  const currentTier = getLifetimeStatus(totalPoints);
  const nextTier = getNextLifetimeStatus(totalPoints);

  if (!nextTier) {
    return {
      totalPoints,
      currentTier,
      nextTier: null,
      progress: 1,
      pointsIntoTier: totalPoints - currentTier.minPoints,
      pointsSpan: 0,
      pointsRemaining: 0,
      isMaxTier: true,
    };
  }

  const pointsSpan = nextTier.minPoints - currentTier.minPoints;
  const pointsIntoTier = Math.max(0, totalPoints - currentTier.minPoints);
  const progress = Math.min(1, Math.max(0, pointsIntoTier / pointsSpan));

  return {
    totalPoints,
    currentTier,
    nextTier,
    progress,
    pointsIntoTier,
    pointsSpan,
    pointsRemaining: Math.max(0, nextTier.minPoints - totalPoints),
    isMaxTier: false,
  };
}

export function getLifetimeStatusRoadmap(points: unknown): LifetimeStatusRoadmapEntry[] {
  const totalPoints = normalizeLifetimePoints(points);
  const currentTier = getLifetimeStatus(totalPoints);
  const nextTier = getNextLifetimeStatus(totalPoints);

  return LIFETIME_STATUS_TIERS.map((tier) => {
    let state: LifetimeStatusRoadmapEntry["state"] = "locked";

    if (tier.key === currentTier.key) {
      state = "current";
    } else if (nextTier && tier.key === nextTier.key) {
      state = "next";
    } else if (tier.minPoints < currentTier.minPoints) {
      state = "completed";
    }

    return {
      tier,
      state,
      pointsRemaining: Math.max(0, tier.minPoints - totalPoints),
    };
  });
}

export function getLifetimeStatusUnlocksCrossed(
  previousPoints: unknown,
  nextPoints: unknown,
): LifetimeStatusTier[] {
  const previousTotal = normalizeLifetimePoints(previousPoints);
  const nextTotal = normalizeLifetimePoints(nextPoints);

  if (nextTotal <= previousTotal) {
    return [];
  }

  return LIFETIME_STATUS_TIERS.filter(
    (tier) => tier.minPoints > previousTotal && tier.minPoints <= nextTotal,
  );
}

export function getLifetimeStatusIconAsset(tier: LifetimeStatusTier): string {
  return tier.statusIconAsset;
}
