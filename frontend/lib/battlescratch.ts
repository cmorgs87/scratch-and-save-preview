export type TicketId = "bronze" | "silver" | "gold";

export type PrizeTier = "loss" | "small" | "medium" | "premium";
export type ShipType = "patrol_boat" | "submarine" | "destroyer" | "battleship" | "carrier";
export type Orientation = "horizontal" | "vertical";

export type CellCoordinate = {
  row: number;
  col: number;
};

export type Cell = CellCoordinate & {
  key: string;
  shipId: string | null;
  shipType: ShipType | null;
  targeted: boolean;
  revealed: boolean;
  hit: boolean;
  miss: boolean;
};

export type Ship = {
  id: string;
  type: ShipType;
  label: string;
  size: number;
  orientation: Orientation;
  cells: CellCoordinate[];
  payoutValue: number;
};

export type TargetMarker = {
  id: string;
  row: number;
  col: number;
  locked: boolean;
};

export type RevealState = {
  confirmed: boolean;
  completed: boolean;
  autoRevealUnsunk: boolean;
  scratchProgressByCell: Record<string, number>;
  revealedCells: string[];
};

export type TicketOutcome = {
  prizeTier: PrizeTier;
  prizeAmount: number;
  totalHits: number;
  totalMisses: number;
  shipsSunk: string[];
  sunkShips: Ship[];
  hitCells: string[];
  missCells: string[];
};

export type TicketGenerationConfig = {
  rows: number;
  cols: number;
  allowedTargets: number;
  prizeTier: PrizeTier;
  prizeAmount: number;
  shipTypes: ShipBlueprint[];
  seed?: number;
  maxPlacementAttempts?: number;
};

export type ShipBlueprint = {
  type: ShipType;
  label: string;
  size: number;
  payoutValue: number;
};

export type BattlescratchTicket = {
  mode: "battlescratch";
  version: 1;
  seed: number;
  ticketId: TicketId;
  prizeTier: PrizeTier;
  prizeAmount: number;
  rows: number;
  cols: number;
  allowedTargets: number;
  ships: Ship[];
  selectableTargets: CellCoordinate[];
  targetMarkers: TargetMarker[];
  legend: ShipBlueprint[];
};

export type BattlescratchSession = {
  ticket: BattlescratchTicket;
  markers: TargetMarker[];
  revealState: RevealState;
};

export const BATTLESCRATCH_LOGO_SRC = "/battlescratch/logo.png";
export const BATTLESCRATCH_STORAGE_PREFIX = "scratchoff-lite:battlescratch";
export const BATTLESCRATCH_REVEAL_THRESHOLD = 1;

export const BATTLESCRATCH_SHIPS: ShipBlueprint[] = [
  { type: "patrol_boat", label: "Patrol Boat", size: 2, payoutValue: 1 },
  { type: "submarine", label: "Submarine", size: 3, payoutValue: 2 },
  { type: "destroyer", label: "Destroyer", size: 3, payoutValue: 2 },
  { type: "battleship", label: "Battleship", size: 4, payoutValue: 4 },
  { type: "carrier", label: "Carrier", size: 5, payoutValue: 6 },
];

export const BATTLESCRATCH_CONFIG_BY_TICKET: Record<TicketId, Omit<TicketGenerationConfig, "prizeTier" | "prizeAmount" | "seed">> = {
  bronze: {
    rows: 7,
    cols: 7,
    allowedTargets: 12,
    shipTypes: BATTLESCRATCH_SHIPS,
    maxPlacementAttempts: 220,
  },
  silver: {
    rows: 7,
    cols: 7,
    allowedTargets: 12,
    shipTypes: BATTLESCRATCH_SHIPS,
    maxPlacementAttempts: 220,
  },
  gold: {
    rows: 8,
    cols: 8,
    allowedTargets: 12,
    shipTypes: BATTLESCRATCH_SHIPS,
    maxPlacementAttempts: 260,
  },
};

export function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function normalizeCoordinate(cell: CellCoordinate): CellCoordinate {
  return { row: Math.floor(cell.row), col: Math.floor(cell.col) };
}

function cloneCoordinate(cell: CellCoordinate): CellCoordinate {
  return { row: cell.row, col: cell.col };
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function shuffle<T>(items: readonly T[], random: () => number) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function uniqueCoordinates(cells: readonly CellCoordinate[]) {
  const seen = new Set<string>();
  const unique: CellCoordinate[] = [];
  for (const cell of cells) {
    const key = cellKey(cell.row, cell.col);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cloneCoordinate(cell));
  }
  return unique;
}

export function validateWithinBounds(cells: readonly CellCoordinate[], rows: number, cols: number) {
  return cells.every((cell) => cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols);
}

export function validateNoOverlap(ships: readonly Pick<Ship, "cells">[]) {
  const occupied = new Set<string>();
  for (const ship of ships) {
    for (const cell of ship.cells) {
      const key = cellKey(cell.row, cell.col);
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return true;
}

export function placeShips(
  shipTypes: readonly ShipBlueprint[],
  rows: number,
  cols: number,
  seed = 1,
  maxPlacementAttempts = 220
) {
  const random = createSeededRandom(seed);
  const ships: Ship[] = [];
  const occupied = new Set<string>();

  const orderedBlueprints = [...shipTypes].sort((left, right) => right.size - left.size);

  for (const blueprint of orderedBlueprints) {
    let placed = false;

    for (let attempt = 0; attempt < maxPlacementAttempts; attempt += 1) {
      const orientation: Orientation = random() > 0.5 ? "horizontal" : "vertical";
      const maxRow = orientation === "vertical" ? rows - blueprint.size : rows - 1;
      const maxCol = orientation === "horizontal" ? cols - blueprint.size : cols - 1;
      const startRow = randInt(random, 0, Math.max(0, maxRow));
      const startCol = randInt(random, 0, Math.max(0, maxCol));
      const cells = Array.from({ length: blueprint.size }, (_, offset) =>
        orientation === "horizontal"
          ? { row: startRow, col: startCol + offset }
          : { row: startRow + offset, col: startCol }
      );

      if (!validateWithinBounds(cells, rows, cols)) continue;
      if (cells.some((cell) => occupied.has(cellKey(cell.row, cell.col)))) continue;

      const ship: Ship = {
        id: `${blueprint.type}-${ships.length + 1}`,
        type: blueprint.type,
        label: blueprint.label,
        size: blueprint.size,
        orientation,
        cells,
        payoutValue: blueprint.payoutValue,
      };

      ship.cells.forEach((cell) => occupied.add(cellKey(cell.row, cell.col)));
      ships.push(ship);
      placed = true;
      break;
    }

    if (!placed) {
      throw new Error(`Unable to place ${blueprint.label} after ${maxPlacementAttempts} attempts`);
    }
  }

  if (!validateNoOverlap(ships)) {
    throw new Error("Generated ships overlapped");
  }

  return ships;
}

function getShipByType(ships: readonly Ship[], type: ShipType) {
  return ships.find((ship) => ship.type === type) ?? null;
}

function takeMissCells(
  rows: number,
  cols: number,
  ships: readonly Ship[],
  count: number,
  random: () => number,
  blocked = new Set<string>()
) {
  const shipCells = new Set(ships.flatMap((ship) => ship.cells.map((cell) => cellKey(cell.row, cell.col))));
  const candidates: CellCoordinate[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = cellKey(row, col);
      if (shipCells.has(key) || blocked.has(key)) continue;
      candidates.push({ row, col });
    }
  }

  return shuffle(candidates, random).slice(0, Math.max(0, count));
}

function chooseShipComboForTier(ships: readonly Ship[], prizeTier: PrizeTier, allowedTargets: number, random: () => number) {
  if (prizeTier === "small") {
    return [getShipByType(ships, "patrol_boat")].filter(Boolean) as Ship[];
  }

  if (prizeTier === "medium") {
    const mediumShips = ships.filter(
      (ship) => ship.type !== "carrier" && ship.size >= 3 && ship.size <= Math.min(4, allowedTargets - 2)
    );
    return mediumShips.length ? [shuffle(mediumShips, random)[0]] : [shuffle([...ships], random)[0]];
  }

  if (prizeTier === "premium") {
    const combos = [
      ["carrier", "destroyer"],
      ["carrier", "patrol_boat"],
      ["battleship", "destroyer"],
      ["battleship", "submarine"],
      ["battleship", "patrol_boat"],
    ] as const;

    for (const combo of combos) {
      const selected = combo
        .map((type) => getShipByType(ships, type))
        .filter(Boolean) as Ship[];
      if (selected.length !== combo.length) continue;
      const totalCells = selected.reduce((sum, ship) => sum + ship.size, 0);
      if (totalCells <= allowedTargets) return selected;
    }

    return [shuffle([...ships].sort((left, right) => right.size - left.size), random)[0]];
  }

  return [];
}

function planTargetCells(
  config: TicketGenerationConfig,
  ships: readonly Ship[],
  random: () => number
) {
  const mustHit = new Set<string>();
  const selectedTargets: CellCoordinate[] = [];
  const combo = chooseShipComboForTier(ships, config.prizeTier, config.allowedTargets, random);

  if (config.prizeTier !== "loss") {
    combo.forEach((ship) => {
      ship.cells.forEach((cell) => {
        mustHit.add(cellKey(cell.row, cell.col));
        selectedTargets.push(cloneCoordinate(cell));
      });
    });
  }

  const remaining = Math.max(0, config.allowedTargets - selectedTargets.length);

  if (config.prizeTier === "loss") {
    const nearMissShip = shuffle(
      ships.filter((ship) => ship.size > 2),
      random
    )[0] ?? shuffle(ships, random)[0];
    const hitCount = Math.min(Math.max(1, nearMissShip.size - 1), Math.max(1, config.allowedTargets - 2));
    const hitCells = shuffle(nearMissShip.cells, random).slice(0, hitCount);
    hitCells.forEach((cell) => {
      mustHit.add(cellKey(cell.row, cell.col));
      selectedTargets.push(cloneCoordinate(cell));
    });
  } else if (config.prizeTier === "small" || config.prizeTier === "medium") {
    const unsunkCandidates = ships.filter((ship) => !combo.some((selected) => selected.id === ship.id) && ship.size > 2);
    const nearMissShip = shuffle(unsunkCandidates, random)[0];
    if (nearMissShip && remaining > 1) {
      const extraHits = Math.min(nearMissShip.size - 1, remaining - 1);
      shuffle(nearMissShip.cells, random)
        .slice(0, extraHits)
        .forEach((cell) => {
          mustHit.add(cellKey(cell.row, cell.col));
          selectedTargets.push(cloneCoordinate(cell));
        });
    }
  }

  const blocked = new Set(selectedTargets.map((cell) => cellKey(cell.row, cell.col)));
  const misses = takeMissCells(config.rows, config.cols, ships, config.allowedTargets - selectedTargets.length, random, blocked);
  const allTargets = uniqueCoordinates([...selectedTargets, ...misses]);

  if (allTargets.length !== config.allowedTargets) {
    throw new Error(`Expected ${config.allowedTargets} target cells, generated ${allTargets.length}`);
  }

  return allTargets;
}

export function resolvePrizeTier(sunkShips: readonly Ship[]) {
  if (!sunkShips.length) return "loss" as const;
  const totalSize = sunkShips.reduce((sum, ship) => sum + ship.size, 0);
  const largestShip = Math.max(...sunkShips.map((ship) => ship.size));
  if (sunkShips.length >= 2 || totalSize >= 6 || sunkShips.some((ship) => ship.type === "carrier")) return "premium" as const;
  if (largestShip >= 3) return "medium" as const;
  return "small" as const;
}

export function detectSunkShips(ships: readonly Ship[], hitCellKeys: readonly string[]) {
  const hits = new Set(hitCellKeys);
  return ships.filter((ship) => ship.cells.every((cell) => hits.has(cellKey(cell.row, cell.col))));
}

export function resolveTicketOutcome(ticket: BattlescratchTicket, markers: readonly TargetMarker[]): TicketOutcome {
  const markerKeys = new Set(markers.map((marker) => cellKey(marker.row, marker.col)));
  const shipCellIndex = new Map<string, Ship>();
  for (const ship of ticket.ships) {
    for (const cell of ship.cells) {
      shipCellIndex.set(cellKey(cell.row, cell.col), ship);
    }
  }

  const hitCells = [...markerKeys].filter((key) => shipCellIndex.has(key));
  const missCells = [...markerKeys].filter((key) => !shipCellIndex.has(key));
  const sunkShips = detectSunkShips(ticket.ships, hitCells);

  return {
    prizeTier: resolvePrizeTier(sunkShips),
    prizeAmount: sunkShips.length ? ticket.prizeAmount : 0,
    totalHits: hitCells.length,
    totalMisses: missCells.length,
    shipsSunk: sunkShips.map((ship) => ship.id),
    sunkShips,
    hitCells,
    missCells,
  };
}

function buildTargetMarkers(selectableTargets: readonly CellCoordinate[]) {
  return selectableTargets.map((cell, index) => ({
    id: `marker-${index + 1}`,
    row: cell.row,
    col: cell.col,
    locked: false,
  }));
}

function makeTicketConfig(ticketId: TicketId, prizeTier: PrizeTier, prizeAmount: number, seed?: number): TicketGenerationConfig {
  const base = BATTLESCRATCH_CONFIG_BY_TICKET[ticketId];
  return {
    ...base,
    prizeTier,
    prizeAmount,
    seed,
  };
}

export function derivePrizeTierFromAmount(ticketId: TicketId, prizeAmount: number): PrizeTier {
  if (prizeAmount <= 0) return "loss";
  if (ticketId === "bronze") return prizeAmount >= 25 ? "medium" : "small";
  if (ticketId === "silver") return prizeAmount >= 50 ? "premium" : prizeAmount >= 20 ? "medium" : "small";
  return prizeAmount >= 100 ? "premium" : prizeAmount >= 25 ? "medium" : "small";
}

export function generateTicketForTier(ticketId: TicketId, prizeAmount: number, desiredPrizeTier: PrizeTier, seed = Date.now()) {
  const config = makeTicketConfig(ticketId, desiredPrizeTier, prizeAmount, seed);
  const random = createSeededRandom(seed);
  const shipSeed = Math.floor(random() * 1_000_000_000);
  const ships = placeShips(config.shipTypes, config.rows, config.cols, shipSeed, config.maxPlacementAttempts ?? 220);
  const selectableTargets = planTargetCells(config, ships, random);
  const markers = buildTargetMarkers(selectableTargets);

  const ticket: BattlescratchTicket = {
    mode: "battlescratch",
    version: 1,
    seed,
    ticketId,
    prizeTier: desiredPrizeTier,
    prizeAmount,
    rows: config.rows,
    cols: config.cols,
    allowedTargets: config.allowedTargets,
    ships,
    selectableTargets,
    targetMarkers: markers,
    legend: config.shipTypes,
  };

  const outcome = resolveTicketOutcome(
    ticket,
    markers.map((marker) => ({ ...marker, locked: true }))
  );

  if (outcome.prizeTier !== desiredPrizeTier) {
    throw new Error(`Generated ticket tier ${outcome.prizeTier} did not match desired ${desiredPrizeTier}`);
  }

  if ((desiredPrizeTier === "loss" ? outcome.prizeAmount !== 0 : outcome.prizeAmount !== prizeAmount)) {
    throw new Error("Generated ticket payout did not match requested amount");
  }

  return ticket;
}

export function generateBattlescratchTicket(ticketId: TicketId, prizeAmount: number, seed = Date.now()) {
  return generateTicketForTier(ticketId, prizeAmount, derivePrizeTierFromAmount(ticketId, prizeAmount), seed);
}

export function generateTicketForExactMarkers(
  ticketId: TicketId,
  prizeAmount: number,
  desiredPrizeTier: PrizeTier,
  markers: readonly TargetMarker[],
  seed = Date.now()
) {
  const config = makeTicketConfig(ticketId, desiredPrizeTier, prizeAmount, seed);
  const lockedMarkers = setMarkerLocked(markers, true);

  if (lockedMarkers.length !== config.allowedTargets) {
    throw new Error(`Expected ${config.allowedTargets} markers before generating the battle plan`);
  }

  const random = createSeededRandom(seed);
  for (let attempt = 0; attempt < 2400; attempt += 1) {
    const shipSeed = Math.floor(random() * 1_000_000_000);
    const ships = placeShips(config.shipTypes, config.rows, config.cols, shipSeed, config.maxPlacementAttempts ?? 220);
    const ticket: BattlescratchTicket = {
      mode: "battlescratch",
      version: 1,
      seed: shipSeed,
      ticketId,
      prizeTier: desiredPrizeTier,
      prizeAmount,
      rows: config.rows,
      cols: config.cols,
      allowedTargets: config.allowedTargets,
      ships,
      selectableTargets: [],
      targetMarkers: lockedMarkers,
      legend: config.shipTypes,
    };

    const outcome = resolveTicketOutcome(ticket, lockedMarkers);
    const prizeMatches = desiredPrizeTier === "loss" ? outcome.prizeAmount === 0 : outcome.prizeAmount === prizeAmount;
    if (outcome.prizeTier === desiredPrizeTier && prizeMatches) {
      return ticket;
    }
  }

  throw new Error("That strike pattern cannot lock a matching fleet. Regroup the markers and try again.");
}

export function createInitialRevealState(): RevealState {
  return {
    confirmed: false,
    completed: false,
    autoRevealUnsunk: false,
    scratchProgressByCell: {},
    revealedCells: [],
  };
}

export function buildCellMap(
  ticket: BattlescratchTicket,
  markers: readonly TargetMarker[],
  revealState: RevealState
) {
  const markerKeys = new Set(markers.map((marker) => cellKey(marker.row, marker.col)));
  const revealedKeys = new Set(revealState.revealedCells);
  const shipIndex = new Map<string, Ship>();
  for (const ship of ticket.ships) {
    for (const cell of ship.cells) {
      shipIndex.set(cellKey(cell.row, cell.col), ship);
    }
  }

  const cells: Cell[] = [];
  for (let row = 0; row < ticket.rows; row += 1) {
    for (let col = 0; col < ticket.cols; col += 1) {
      const key = cellKey(row, col);
      const ship = shipIndex.get(key) ?? null;
      const targeted = markerKeys.has(key);
      const revealed = revealedKeys.has(key);
      const hit = revealed && targeted && Boolean(ship);
      const miss = revealed && targeted && !ship;
      cells.push({
        row,
        col,
        key,
        shipId: ship?.id ?? null,
        shipType: ship?.type ?? null,
        targeted,
        revealed,
        hit,
        miss,
      });
    }
  }

  return cells;
}

export function applyScratchToCell(
  revealState: RevealState,
  cell: CellCoordinate,
  delta = 1,
  threshold = BATTLESCRATCH_REVEAL_THRESHOLD
) {
  const key = cellKey(cell.row, cell.col);
  const nextProgress = Math.min(threshold, (revealState.scratchProgressByCell[key] ?? 0) + delta);
  const nextRevealed = new Set(revealState.revealedCells);
  if (nextProgress >= threshold) nextRevealed.add(key);

  return {
    ...revealState,
    scratchProgressByCell: {
      ...revealState.scratchProgressByCell,
      [key]: nextProgress,
    },
    revealedCells: [...nextRevealed],
  };
}

export function completeReveal(revealState: RevealState, ticket: BattlescratchTicket, outcome?: TicketOutcome): RevealState {
  const next = new Set(revealState.revealedCells);
  if (outcome) {
    outcome.hitCells.forEach((key) => next.add(key));
    outcome.missCells.forEach((key) => next.add(key));
  }

  for (let row = 0; row < ticket.rows; row += 1) {
    for (let col = 0; col < ticket.cols; col += 1) {
      next.add(cellKey(row, col));
    }
  }

  return {
    ...revealState,
    completed: true,
    autoRevealUnsunk: true,
    revealedCells: [...next],
  };
}

export function serializeSession(session: BattlescratchSession) {
  return JSON.stringify(session);
}

export function deserializeSession(raw: string | null): BattlescratchSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BattlescratchSession;
    if (!parsed || parsed.ticket?.mode !== "battlescratch" || parsed.ticket?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getStorageKey(userId: string) {
  return `${BATTLESCRATCH_STORAGE_PREFIX}:${userId}`;
}

export function createSession(ticket: BattlescratchTicket): BattlescratchSession {
  return {
    ticket,
    markers: [],
    revealState: createInitialRevealState(),
  };
}

export function setMarkerLocked(markers: readonly TargetMarker[], locked: boolean) {
  return markers.map((marker) => ({ ...marker, locked }));
}

export function isSelectableTarget(ticket: BattlescratchTicket, cell: CellCoordinate) {
  const key = cellKey(cell.row, cell.col);
  return ticket.selectableTargets.some((target) => cellKey(target.row, target.col) === key);
}

export function upsertMarker(markers: readonly TargetMarker[], cell: CellCoordinate, ticket: BattlescratchTicket) {
  const normalized = normalizeCoordinate(cell);
  const key = cellKey(normalized.row, normalized.col);
  if (!validateWithinBounds([normalized], ticket.rows, ticket.cols)) return [...markers];

  const existing = markers.find((marker) => cellKey(marker.row, marker.col) === key);
  if (existing) {
    return markers.filter((marker) => marker.id !== existing.id);
  }

  if (markers.length >= ticket.allowedTargets) return [...markers];

  return [
    ...markers,
    {
      id: `marker-${markers.length + 1}`,
      row: normalized.row,
      col: normalized.col,
      locked: false,
    },
  ];
}

export function buildCompletedMarkers(ticket: BattlescratchTicket) {
  return setMarkerLocked(buildTargetMarkers(ticket.selectableTargets), true);
}
