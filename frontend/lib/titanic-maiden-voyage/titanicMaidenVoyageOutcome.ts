import {
  TITANIC_MAIDEN_VOYAGE_SPEED_OPTIONS,
  type TitanicDrawnRouteProfile,
  type TitanicRouteNode,
  type TitanicSpeedId,
} from "./titanicMaidenVoyageConfig";

export type TitanicReportPanelId = "weather" | "ice_conditions" | "hull_status" | "voyage_outcome";

export type TitanicVoyageOutcomeTier =
  | "legendary_arrival"
  | "safe_arrival"
  | "emergency_arrival"
  | "voyage_lost";

export type TitanicReportPanel = {
  id: TitanicReportPanelId;
  label: string;
  value: string;
  note: string;
};

export type TitanicVoyageOutcome = {
  tier: TitanicVoyageOutcomeTier;
  title: string;
  summary: string;
  payoutPreview: string;
  reportPanels: TitanicReportPanel[];
};

type WeightedTier = {
  tier: TitanicVoyageOutcomeTier;
  weight: number;
};

const REPORT_PANEL_LABELS: Record<TitanicReportPanelId, string> = {
  weather: "Weather",
  ice_conditions: "Ice Conditions",
  hull_status: "Hull Status",
  voyage_outcome: "Voyage Outcome",
};

const TITANIC_REPORT_PANEL_IDS: TitanicReportPanelId[] = [
  "weather",
  "ice_conditions",
  "hull_status",
  "voyage_outcome",
];

const TITANIC_ROUTE_RISK_BY_NODE_ID: Record<string, number> = {
  solent_fairway: 0,
  needles_channel: 1,
  channel_south_lane: 2,
  cherbourg_lane: 0,
  queenstown_arc: 1,
  celtic_current: 2,
  northern_stars: 1,
  mid_atlantic_ribbon: 2,
  gulf_stream_edge: 3,
  newfoundland_pass: 2,
  nantucket_run: 1,
  hudson_approach: 0,
};

const TITANIC_SPEED_RISK_BY_ID: Record<TitanicSpeedId, number> = {
  stop: 0,
  "dead-slow": -2,
  slow: -1,
  half: 1,
  full: 3,
};

const TITANIC_OUTCOME_BLUEPRINTS: Record<
  TitanicVoyageOutcomeTier,
  {
    title: string;
    payoutPreview: string;
    summary: string;
    panelValues: Record<TitanicReportPanelId, string>;
    panelNotes: Record<TitanicReportPanelId, string>;
  }
> = {
  legendary_arrival: {
    title: "Legendary Arrival",
    payoutPreview: "Jackpot Preview",
    summary: "A flawless crossing reaches New York.",
    panelValues: {
      weather: "Clear Night",
      ice_conditions: "Open Water",
      hull_status: "Optimal",
      voyage_outcome: "Legendary Arrival",
    },
    panelNotes: {
      weather: "Cold clear night.",
      ice_conditions: "Open water ahead.",
      hull_status: "Hull remains perfect.",
      voyage_outcome: "Arrival secured.",
    },
  },
  safe_arrival: {
    title: "Safe Arrival",
    payoutPreview: "Strong Win Preview",
    summary: "The voyage reaches New York safely.",
    panelValues: {
      weather: "Clear Night",
      ice_conditions: "Near Ice Field",
      hull_status: "Stable",
      voyage_outcome: "Safe Arrival",
    },
    panelNotes: {
      weather: "Bridge watches stay calm.",
      ice_conditions: "Ice stays off route.",
      hull_status: "Hull remains secure.",
      voyage_outcome: "Harbor reached cleanly.",
    },
  },
  emergency_arrival: {
    title: "Emergency Arrival",
    payoutPreview: "Small Win Preview",
    summary: "The ship reaches harbor under strain.",
    panelValues: {
      weather: "Cold Clear Night",
      ice_conditions: "Heavy Ice Field",
      hull_status: "Forward Compartments Flooded",
      voyage_outcome: "Emergency Arrival",
    },
    panelNotes: {
      weather: "Cold clear night.",
      ice_conditions: "Heavy ice field ahead.",
      hull_status: "Forward compartments flooded.",
      voyage_outcome: "Harbor reached under strain.",
    },
  },
  voyage_lost: {
    title: "Voyage Lost",
    payoutPreview: "No Win",
    summary: "The voyage fails to reach New York.",
    panelValues: {
      weather: "Clear Night",
      ice_conditions: "Fatal Ice Strike",
      hull_status: "Critical Flooding",
      voyage_outcome: "Voyage Lost",
    },
    panelNotes: {
      weather: "Visibility stays sharp.",
      ice_conditions: "A fatal ice strike.",
      hull_status: "Critical flooding spreads.",
      voyage_outcome: "The crossing is lost.",
    },
  },
};

function getRouteRisk(selectedRouteNodes: TitanicRouteNode[]) {
  return selectedRouteNodes.reduce(
    (totalRisk, node) => totalRisk + (TITANIC_ROUTE_RISK_BY_NODE_ID[node.id] ?? 1),
    0
  );
}

function getDrawnRouteRisk(routeProfile: TitanicDrawnRouteProfile | null | undefined) {
  switch (routeProfile) {
    case "northern":
      return 4;
    case "southern":
      return 2;
    case "erratic":
      return 5;
    case "central":
    default:
      return 3;
  }
}

function getSpeedRisk(selectedSpeed: TitanicSpeedId) {
  return TITANIC_SPEED_RISK_BY_ID[selectedSpeed] ?? 0;
}

function weightedPick<T extends string>(weights: Array<{ tier: T; weight: number }>): T {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weights) {
    roll -= item.weight;
    if (roll <= 0) return item.tier;
  }
  return weights[weights.length - 1].tier;
}

function buildOutcomeWeights(riskScore: number): WeightedTier[] {
  const clampedRisk = Math.max(0, Math.min(12, riskScore));
  return [
    {
      tier: "legendary_arrival",
      weight: Math.max(6, 34 - clampedRisk * 2.4),
    },
    {
      tier: "safe_arrival",
      weight: Math.max(22, 52 - clampedRisk * 1.2),
    },
    {
      tier: "emergency_arrival",
      weight: Math.max(10, 10 + clampedRisk * 1.7),
    },
    {
      tier: "voyage_lost",
      weight: Math.max(4, 4 + clampedRisk * 1.5),
    },
  ];
}

function resolveAuthoritativeTitanicTier(
  authoritativeWinAmount: number | null | undefined,
  prizeAmounts: readonly number[] | undefined
): TitanicVoyageOutcomeTier {
  if (!authoritativeWinAmount || authoritativeWinAmount <= 0) {
    return "voyage_lost";
  }

  const positiveBuckets = [...new Set((prizeAmounts ?? []).filter((amount) => amount > 0))].sort((left, right) => left - right);
  if (positiveBuckets.length === 0) {
    return "safe_arrival";
  }

  if (positiveBuckets.length === 1) {
    return "legendary_arrival";
  }

  const lowestBucket = positiveBuckets[0];
  const highestBucket = positiveBuckets[positiveBuckets.length - 1];

  if (authoritativeWinAmount <= lowestBucket) {
    return "emergency_arrival";
  }

  if (authoritativeWinAmount >= highestBucket) {
    return "legendary_arrival";
  }

  return "safe_arrival";
}

export function createTitanicVoyageOutcome({
  selectedRouteNodes,
  selectedSpeed,
  authoritativeWinAmount,
  prizeAmounts,
  drawnRouteProfile,
  forcedTier,
}: {
  selectedRouteNodes: TitanicRouteNode[];
  selectedSpeed: TitanicSpeedId;
  authoritativeWinAmount?: number | null;
  prizeAmounts?: readonly number[];
  drawnRouteProfile?: TitanicDrawnRouteProfile | null;
  forcedTier?: TitanicVoyageOutcomeTier | null;
}): TitanicVoyageOutcome {
  const routeRisk =
    selectedRouteNodes.length > 0
      ? getRouteRisk(selectedRouteNodes)
      : getDrawnRouteRisk(drawnRouteProfile);
  const speedRisk = getSpeedRisk(selectedSpeed);
  const riskScore = routeRisk + speedRisk;
  const speedOption = TITANIC_SPEED_OPTIONS.find((option) => option.id === selectedSpeed) ?? TITANIC_SPEED_OPTIONS[0];
  const tier =
    forcedTier ??
    (typeof authoritativeWinAmount === "number"
      ? resolveAuthoritativeTitanicTier(authoritativeWinAmount, prizeAmounts)
      : weightedPick(buildOutcomeWeights(riskScore)));
  const blueprint = TITANIC_OUTCOME_BLUEPRINTS[tier];
  const weatherNoteSuffix =
    riskScore <= 3
      ? "Calm watch."
      : riskScore <= 7
        ? "Lookouts alert."
        : "Bridge on alert.";
  const iceNoteSuffix =
    routeRisk <= 3
      ? "Lane clear."
      : routeRisk <= 6
        ? "Ice nearby."
        : "Ice pressure rising.";
  const hullNoteSuffix =
    selectedSpeed === "full"
      ? "Full speed strains the hull."
      : selectedSpeed === "dead-slow"
        ? "Dead slow eases strain."
        : `${speedOption.shortLabel} holds steady.`;
  const outcomeNoteSuffix =
    selectedSpeed === "full"
      ? "Full speed defines the run."
      : `${speedOption.shortLabel} carries the run.`;

  const reportPanels: TitanicReportPanel[] = TITANIC_REPORT_PANEL_IDS.map((panelId) => ({
    id: panelId,
    label: REPORT_PANEL_LABELS[panelId],
    value: blueprint.panelValues[panelId],
    note:
      panelId === "weather"
        ? `${blueprint.panelNotes[panelId]} ${weatherNoteSuffix}`
        : panelId === "ice_conditions"
          ? `${blueprint.panelNotes[panelId]} ${iceNoteSuffix}`
          : panelId === "hull_status"
            ? `${blueprint.panelNotes[panelId]} ${hullNoteSuffix}`
            : `${blueprint.panelNotes[panelId]} ${outcomeNoteSuffix}`,
  }));

  return {
    tier,
    title: blueprint.title,
    summary: blueprint.summary,
    payoutPreview: blueprint.payoutPreview,
    reportPanels,
  };
}

export function getTitanicSpeedRiskSummary(selectedSpeed: TitanicSpeedId) {
  return TITANIC_SPEED_OPTIONS.find((option) => option.id === selectedSpeed)?.detail ?? "";
}

const TITANIC_SPEED_OPTIONS = TITANIC_MAIDEN_VOYAGE_SPEED_OPTIONS;
