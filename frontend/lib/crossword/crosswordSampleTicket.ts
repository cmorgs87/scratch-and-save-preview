import type {
  CrosswordBoardCell,
  CrosswordLetterBankCell,
  CrosswordPrizeTier,
  CrosswordTicketData,
  CrosswordTicketTier,
  CrosswordWord,
} from "./crosswordTypes";

const BLOCKED = "#";
const LETTER_BANK_SIZE = 18;

type CrosswordVariantId = "loss" | `words-${number}`;

type CrosswordTemplateDefinition = {
  id: string;
  familyId: string;
  layout: readonly string[];
  wordBlueprints?: ReadonlyArray<{ id: string; text: string; cells: string[] }>;
};

type CrosswordSlotDefinition = {
  id: string;
  cells: ReadonlyArray<readonly [number, number]>;
};

type CrosswordStructureDefinition = {
  id: string;
  rows: number;
  cols: number;
  slots: ReadonlyArray<CrosswordSlotDefinition>;
};

type CrosswordTemplateChoice = {
  id: string;
  familyId: string;
  structureId: string;
  templateSeed: string;
};

type CrosswordVariantLetterSets = {
  loss: readonly string[];
  byCompletedWords: Map<number, readonly string[]>;
};

const BASE_CROSSWORD_STRUCTURES: readonly CrosswordStructureDefinition[] = [
  {
    id: "classic",
    rows: 11,
    cols: 11,
    slots: [
      { id: "across-1", cells: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] },
      { id: "across-2", cells: [[0, 7], [0, 8], [0, 9], [0, 10]] },
      { id: "across-3", cells: [[2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10]] },
      { id: "across-4", cells: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]] },
      { id: "across-5", cells: [[6, 0], [6, 1], [6, 2], [6, 3]] },
      { id: "across-6", cells: [[6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10]] },
      { id: "across-7", cells: [[8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9]] },
      { id: "across-8", cells: [[10, 0], [10, 1], [10, 2], [10, 3], [10, 4], [10, 5]] },
      { id: "down-1", cells: [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]] },
      { id: "down-2", cells: [[0, 10], [1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10]] },
      { id: "down-3", cells: [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3]] },
    ],
  },
  {
    id: "mirror",
    rows: 11,
    cols: 11,
    slots: [
      { id: "across-1", cells: [[0, 5], [0, 6], [0, 7], [0, 8], [0, 9]] },
      { id: "across-2", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
      { id: "across-3", cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7]] },
      { id: "across-4", cells: [[4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10]] },
      { id: "across-5", cells: [[6, 7], [6, 8], [6, 9], [6, 10]] },
      { id: "across-6", cells: [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]] },
      { id: "across-7", cells: [[8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9]] },
      { id: "across-8", cells: [[10, 5], [10, 6], [10, 7], [10, 8], [10, 9], [10, 10]] },
      { id: "down-1", cells: [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]] },
      { id: "down-2", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]] },
      { id: "down-3", cells: [[4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7]] },
    ],
  },
  {
    id: "classic-wide",
    rows: 11,
    cols: 12,
    slots: [
      { id: "across-1", cells: [[0, 2], [0, 3], [0, 4], [0, 5], [0, 6]] },
      { id: "across-2", cells: [[0, 8], [0, 9], [0, 10], [0, 11]] },
      { id: "across-3", cells: [[2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [2, 11]] },
      { id: "across-4", cells: [[4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6]] },
      { id: "across-5", cells: [[6, 1], [6, 2], [6, 3], [6, 4]] },
      { id: "across-6", cells: [[6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [6, 11]] },
      { id: "across-7", cells: [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9], [8, 10]] },
      { id: "across-8", cells: [[10, 1], [10, 2], [10, 3], [10, 4], [10, 5], [10, 6]] },
      { id: "down-1", cells: [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6]] },
      { id: "down-2", cells: [[0, 11], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11]] },
      { id: "down-3", cells: [[4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4]] },
    ],
  },
  {
    id: "mirror-wide",
    rows: 11,
    cols: 12,
    slots: [
      { id: "across-1", cells: [[0, 5], [0, 6], [0, 7], [0, 8], [0, 9]] },
      { id: "across-2", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
      { id: "across-3", cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7]] },
      { id: "across-4", cells: [[4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10]] },
      { id: "across-5", cells: [[6, 7], [6, 8], [6, 9], [6, 10]] },
      { id: "across-6", cells: [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]] },
      { id: "across-7", cells: [[8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9]] },
      { id: "across-8", cells: [[10, 5], [10, 6], [10, 7], [10, 8], [10, 9], [10, 10]] },
      { id: "down-1", cells: [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]] },
      { id: "down-2", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]] },
      { id: "down-3", cells: [[4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7]] },
    ],
  },
  {
    id: "classic-tall",
    rows: 13,
    cols: 11,
    slots: [
      { id: "across-1", cells: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] },
      { id: "across-2", cells: [[0, 7], [0, 8], [0, 9], [0, 10]] },
      { id: "across-3", cells: [[2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10]] },
      { id: "across-4", cells: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]] },
      { id: "across-5", cells: [[6, 0], [6, 1], [6, 2], [6, 3]] },
      { id: "across-6", cells: [[6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10]] },
      { id: "across-7", cells: [[8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9]] },
      { id: "across-8", cells: [[10, 0], [10, 1], [10, 2], [10, 3], [10, 4], [10, 5]] },
      { id: "across-9", cells: [[12, 2], [12, 3], [12, 4], [12, 5], [12, 6], [12, 7], [12, 8]] },
      { id: "down-1", cells: [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]] },
      { id: "down-2", cells: [[0, 10], [1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10]] },
      { id: "down-3", cells: [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3]] },
    ],
  },
  {
    id: "mirror-tall",
    rows: 13,
    cols: 11,
    slots: [
      { id: "across-1", cells: [[0, 5], [0, 6], [0, 7], [0, 8], [0, 9]] },
      { id: "across-2", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
      { id: "across-3", cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7]] },
      { id: "across-4", cells: [[4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10]] },
      { id: "across-5", cells: [[6, 7], [6, 8], [6, 9], [6, 10]] },
      { id: "across-6", cells: [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]] },
      { id: "across-7", cells: [[8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9]] },
      { id: "across-8", cells: [[10, 5], [10, 6], [10, 7], [10, 8], [10, 9], [10, 10]] },
      { id: "across-9", cells: [[12, 2], [12, 3], [12, 4], [12, 5], [12, 6], [12, 7], [12, 8]] },
      { id: "down-1", cells: [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]] },
      { id: "down-2", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]] },
      { id: "down-3", cells: [[4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7]] },
    ],
  },
  {
    id: "classic-flip",
    rows: 11,
    cols: 11,
    slots: [
      { id: "across-1", cells: [[10, 1], [10, 2], [10, 3], [10, 4], [10, 5]] },
      { id: "across-2", cells: [[10, 7], [10, 8], [10, 9], [10, 10]] },
      { id: "across-3", cells: [[8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9], [8, 10]] },
      { id: "across-4", cells: [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]] },
      { id: "across-5", cells: [[4, 0], [4, 1], [4, 2], [4, 3]] },
      { id: "across-6", cells: [[4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10]] },
      { id: "across-7", cells: [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9]] },
      { id: "across-8", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] },
      { id: "down-1", cells: [[6, 5], [7, 5], [8, 5], [9, 5], [10, 5]] },
      { id: "down-2", cells: [[3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10]] },
      { id: "down-3", cells: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]] },
    ],
  },
  {
    id: "mirror-flip",
    rows: 11,
    cols: 11,
    slots: [
      { id: "across-1", cells: [[10, 5], [10, 6], [10, 7], [10, 8], [10, 9]] },
      { id: "across-2", cells: [[10, 0], [10, 1], [10, 2], [10, 3]] },
      { id: "across-3", cells: [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7]] },
      { id: "across-4", cells: [[6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10]] },
      { id: "across-5", cells: [[4, 7], [4, 8], [4, 9], [4, 10]] },
      { id: "across-6", cells: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]] },
      { id: "across-7", cells: [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9]] },
      { id: "across-8", cells: [[0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10]] },
      { id: "down-1", cells: [[6, 5], [7, 5], [8, 5], [9, 5], [10, 5]] },
      { id: "down-2", cells: [[3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0]] },
      { id: "down-3", cells: [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]] },
    ],
  },
] as const;

const CROSSWORD_STRUCTURES: readonly CrosswordStructureDefinition[] = BASE_CROSSWORD_STRUCTURES.filter((structure) =>
  ["classic", "mirror", "classic-wide", "classic-tall", "mirror-tall"].includes(structure.id)
);

// Offline curation guard: we keep the crossword pool to standalone English words
// and explicitly block typo/prefix-only entries instead of relying on a runtime dictionary.
const DISALLOWED_CROSSWORD_WORDS = new Set(["AERO", "NOTEWORTH"]);

const WORD_POOLS_BY_LENGTH: Record<number, readonly string[]> = {
  4: [
    "ABLE", "ACID", "ACRE", "AIDE", "ALTO", "AREA", "ARID", "ATOM", "AUNT", "AUTO", "AXLE", "BASE", "BEAR",
    "BELL", "BIRD", "BLUE", "BOAT", "BODY", "BOLT", "BOOK", "BOWL", "CAFE", "CAKE", "CAMP", "CARD", "CARE",
    "CART", "CAVE", "CELL", "COIN", "COLD", "COVE", "DAWN", "DEER", "DICE", "DIME", "DINE", "DOVE", "DRAW",
    "DUNE", "EARN", "EASE", "ECHO", "EDGE", "EDIT", "FACE", "FAIR", "FARM", "FATE", "FERN", "FIRE", "FIRM",
    "FISH", "FIVE", "FLAG", "FLOW", "FOAM", "FOLD", "FONT", "GAME", "GATE", "GLOW", "GOAL", "GOLD", "HAND",
    "HARE", "HARP", "HERO", "HILL", "HOME", "HOPE", "HOUR", "IDEA", "INTO", "IRON", "ISLE", "ITEM", "JOIN",
    "JOKE", "JUMP", "KEEP", "KITE", "LACE", "LAMB", "LAND", "LARK", "LENS", "LIME", "LION", "LOFT", "MAIN",
    "MARK", "MASS", "MATH", "MEAL", "MILE", "MINT", "MOON", "MOSS", "NAME", "NAVY", "NOTE", "OATH", "OVAL",
    "PACE", "PARK", "PATH", "PEAR", "PINE", "ROAD", "SAGE", "SEAM", "STAR", "STEM", "TEAM", "TEAR", "TIDE",
    "TONE", "TREE", "TUNE", "UNIT", "WAVE", "YARD",
  ],
  5: [
    "ABIDE", "ABODE", "ACORN", "ADOBE", "ADORE", "AFTER", "AGENT", "AGILE", "AISLE", "ALBUM", "ALERT", "ALIVE",
    "ALLEY", "ALLOW", "AMBER", "ANGEL", "APPLE", "APRON", "ARENA", "ARROW", "ATLAS", "AUDIO", "AWARE", "BASIC",
    "BEACH", "BEGAN", "BLEND", "BLISS", "BOARD", "BRAIN", "BRAVE", "BREAD", "BRICK", "BRIDE", "BRINE", "BRUSH",
    "CABLE", "CANDY", "CHAIN", "CHAIR", "CHALK", "CHARM", "CHASE", "CHEER", "CHEST", "CHIME", "CHORD", "CIDER",
    "CIVIC", "CLOUD", "COAST", "COBRA", "CORAL", "CRANE", "CROWD", "CROWN", "CYCLE", "DANCE", "DELTA", "DREAM",
    "DRIVE", "EARTH", "ELITE", "FAITH", "FIELD", "FLAME", "FLEET", "FLOOD", "FORGE", "FRAME", "FRESH", "GIANT",
    "GLASS", "GLOBE", "GRACE", "GRADE", "GRAIN", "GRAND", "GRASS", "GREEN", "GROVE", "GUARD", "GUIDE", "HEART",
    "HONOR", "HORSE", "HOUSE", "INDEX", "IVORY", "JEWEL", "JOLLY", "JUICE", "KNIFE", "LADLE", "LASER", "LAYER",
    "LEMON", "LIGHT", "LUNAR", "MAGIC", "MAPLE", "MARCH", "MERCY", "METAL", "MIGHT", "MORAL", "MOTOR", "MOUSE",
    "MUSIC", "NOBLE", "NORTH", "OCEAN", "OPERA", "ORBIT", "PAINT", "PALMS", "PANEL", "PEACE", "PEARL", "PHONE",
    "PIANO", "PILOT", "PLAIN", "PLANT", "PLATE", "POINT", "POWER", "PRIDE", "QUEST", "QUILT", "RANCH", "RANGE",
    "REACH", "REACT", "RHYME", "RIDER", "RIVER", "ROBOT", "ROYAL", "SAFER", "SAINT", "SCALE", "SCENE", "SCOPE",
    "SHELF", "SHINE", "SHORE", "SMILE", "SOLAR", "SOLVE", "SOUND", "SPACE", "SPARE", "SPRAY", "STONE", "STORE",
    "STORM", "SUGAR", "SWEET", "TABLE", "TEACH", "TIGER", "TOAST", "TOPIC", "TOTAL", "TOUCH", "TOWER", "TRACK",
    "TRAIL", "TRIAL", "TRUST", "UNION", "VALUE", "VOICE", "WAGON", "WATER", "WHALE", "WORLD", "WORTH",
  ],
  6: [
    "ABSENT", "ACTIVE", "ADMIRE", "ADVENT", "ANCHOR", "ANIMAL", "ANSWER", "AVENUE", "BANANA", "BANNER", "BATTLE",
    "BEACON", "BOTTLE", "BREEZE", "BRIDGE", "BRIGHT", "BUTTON", "CANDLE", "CANYON", "CARBON", "CASTLE", "CIRCLE",
    "COFFEE", "CORNER", "CREATE", "CRUISE", "DANGER", "DESERT", "DRAGON", "DRAWER", "EDITOR", "ENGINE", "FAMILY",
    "FAMOUS", "FUTURE", "GARDEN", "GENTLE", "GLOBAL", "GOLDEN", "GUITAR", "HARBOR", "HIDDEN", "HONEST", "ISLAND",
    "JACKET", "JUNGLE", "KITTEN", "MARKET", "MEADOW", "MEMORY", "MIDDLE", "MINUTE", "MIRROR", "MOBILE", "MODERN",
    "MONKEY", "NOTICE", "OBJECT", "ORANGE", "PACKET", "PLANET", "POCKET", "RABBIT", "RANGER", "REMOTE", "ROCKET",
    "SADDLE", "SAFETY", "SCHOOL", "SILVER", "SPIRIT", "SPRING", "STREAM", "STREET", "SUMMER", "SYSTEM", "THREAD",
    "THRONE", "TUNNEL", "UNIQUE", "VALLEY", "VISION", "WINTER",
  ],
  7: [
    "ACCOUNT", "ANCIENT", "BALANCE", "CAPTAIN", "CAPTURE", "CENTURY", "CRYSTAL", "DIAMOND", "EMERALD", "FANTASY",
    "FREEDOM", "GALLERY", "HARVEST", "HEALTHY", "HORIZON", "IMAGINE", "IMMENSE", "INSPIRE", "JOURNEY", "KINGDOM",
    "LIBERTY", "MEADOWS", "MEETING", "MILLION", "MIRACLE", "MONSTER", "MUSEUMS", "ORCHARD", "OUTDOOR", "PICTURE",
    "PIONEER", "QUALITY", "RAILWAY", "RAINBOW", "RECOVER", "REFLECT", "RETREAT", "ROMANCE", "SCARLET", "SINCERE",
    "SUNRISE", "TEACHER", "THUNDER", "UPGRADE", "VICTORY", "VILLAGE", "WINDOWS",
  ],
  8: [
    "AIRPLANE", "BASEBALL", "BIRTHDAY", "BUILDING", "ELEPHANT", "FOOTBALL", "HOSPITAL", "KEYBOARD", "LANGUAGE",
    "MOUNTAIN", "NOTEBOOK", "PAINTING", "PLATFORM", "SAPPHIRE", "SEASHORE", "SIDEWALK", "SUNLIGHT", "SUNSHINE",
    "TREASURE", "TROPICAL", "UNIVERSE", "WILDLIFE",
  ],
  9: [
    "ADVENTURE", "BLUEPRINT", "CHOCOLATE", "CROSSWORD", "DREAMLAND", "EVERYBODY", "HAPPINESS", "HEARTLAND",
    "IMPORTANT", "MOONLIGHT", "NIGHTFALL", "PINEAPPLE", "PLAYHOUSE", "RIVERBANK", "STAIRCASE", "STARLIGHT",
    "SUNFLOWER", "WATERFALL", "WONDERFUL",
  ],
};

assertCuratedCrosswordWordPools(WORD_POOLS_BY_LENGTH);

const LETTER_BANK_FILLERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as readonly string[];
const VARIANT_LETTER_CACHE = new Map<string, CrosswordVariantLetterSets>();
const GENERATED_TEMPLATE_CACHE = new Map<string, CrosswordTemplateDefinition>();
const CROSSWORD_TEMPLATE_CHOICES: readonly CrosswordTemplateChoice[] = CROSSWORD_STRUCTURES.flatMap((structure) =>
  Array.from({ length: 14 }, (_, index) => ({
    id: `${structure.id}-pool-${index + 1}`,
    familyId: structure.id,
    structureId: structure.id,
    templateSeed: `pool:${structure.id}:${index + 1}`,
  }))
);

const SKIN = {
  title: "Crossword",
  eyebrow: "Premium Letter Draw",
  subtitle: "Reveal your letter bank, tap matching cells on the board, and complete words to lock the prize.",
  boardLabel: "Crossword Board",
  lettersLabel: "Your Letters",
  legendLabel: "Prize Legend",
  resultLabel: "Payout",
} as const;

export function createCrosswordPrizeTiers(ticketId: CrosswordTicketTier, maxCompletedWords: number): CrosswordPrizeTier[] {
  if (ticketId === "bronze") {
    return buildPrizeLegend(
      [
        [3, 10],
        [4, 20],
        [5, 40],
        [6, 75],
        [7, 150],
        [8, 300],
        [9, 600],
        [10, 1200],
        [11, 2500],
      ],
      maxCompletedWords
    );
  }

  if (ticketId === "silver") {
    return buildPrizeLegend(
      [
        [3, 20],
        [4, 40],
        [5, 80],
        [6, 160],
        [7, 320],
        [8, 640],
        [9, 1250],
        [10, 2500],
        [11, 5000],
      ],
      maxCompletedWords
    );
  }

  return buildPrizeLegend(
    [
      [3, 50],
      [4, 100],
      [5, 250],
      [6, 500],
      [7, 1000],
      [8, 2500],
      [9, 5000],
      [10, 10000],
      [11, 25000],
    ],
    maxCompletedWords
  );
}

export function createCrosswordSampleTicket(args: {
  ticketId: CrosswordTicketTier;
  rewardAmount: number;
  sessionId: string;
  selectionSeed?: string;
  avoidTemplateId?: string | null;
  avoidTemplateFamilyId?: string | null;
}): CrosswordTicketData {
  const { ticketId, rewardAmount, sessionId, selectionSeed, avoidTemplateId, avoidTemplateFamilyId } = args;
  const template = selectCrosswordTemplate(selectionSeed ?? sessionId, avoidTemplateId, avoidTemplateFamilyId);
  const layout = template.layout;
  const wordBlueprints = template.wordBlueprints ?? createWordBlueprints(layout);
  assertConnectedWordBlueprints(template.id, wordBlueprints);
  const words = createWords(wordBlueprints);
  const prizeTiers = createCrosswordPrizeTiers(ticketId, words.length);
  const targetCompletedWords = resolveTargetCompletedWords(prizeTiers, rewardAmount);
  const variant = targetCompletedWords === null ? "loss" : `words-${targetCompletedWords}`;
  const boardCells = createBoardCells(layout, words);
  const variantLetters = resolveVariantLetterSets(template.id, layout, words, prizeTiers);

  return {
    ticketId,
    sessionId,
    gameType: "crossword",
    displayName: "Crossword",
    variantId: `${template.familyId}:${template.id}:${variant}`,
    boardRows: layout.length,
    boardCols: layout[0]?.length ?? 0,
    letterBank: createLetterBankCells(
      shuffleLetters(
        buildLetterBank(targetCompletedWords === null ? variantLetters.loss : variantLetters.byCompletedWords.get(targetCompletedWords)!, layout),
        `${sessionId}:${template.id}:${variant}`
      )
    ),
    boardCells,
    words,
    prizeTiers,
    skin: { ...SKIN },
  };
}

function resolveTargetCompletedWords(prizeTiers: readonly CrosswordPrizeTier[], rewardAmount: number) {
  if (rewardAmount <= 0) return null;

  const matchingTier = prizeTiers.find((tier) => tier.rewardAmount === rewardAmount);
  if (!matchingTier) {
    throw new Error(`No crossword prize tier matches reward amount ${rewardAmount}`);
  }

  return matchingTier.completedWords;
}

function selectCrosswordTemplate(seed: string, avoidTemplateId?: string | null, avoidTemplateFamilyId?: string | null) {
  const filteredPool =
    avoidTemplateFamilyId && CROSSWORD_TEMPLATE_CHOICES.some((template) => template.familyId === avoidTemplateFamilyId)
      ? CROSSWORD_TEMPLATE_CHOICES.filter((template) => template.familyId !== avoidTemplateFamilyId)
      : avoidTemplateId && CROSSWORD_TEMPLATE_CHOICES.some((template) => template.id === avoidTemplateId)
        ? CROSSWORD_TEMPLATE_CHOICES.filter((template) => template.id !== avoidTemplateId)
        : CROSSWORD_TEMPLATE_CHOICES;
  const orderedPool = [...filteredPool].sort((left, right) => {
    const leftScore = hashString(`${seed}:${left.id}`) / getTemplateChoicePriority(left.familyId);
    const rightScore = hashString(`${seed}:${right.id}`) / getTemplateChoicePriority(right.familyId);
    return leftScore - rightScore || left.id.localeCompare(right.id);
  });

  for (const templateChoice of orderedPool) {
    try {
      return resolveTemplateChoice(templateChoice);
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to resolve a valid crossword template for seed ${seed}`);
}

function getTemplateChoicePriority(familyId: string) {
  if (familyId.includes("tall")) return 4;
  if (familyId.includes("wide")) return 3;
  if (familyId.includes("flip")) return 2;
  return 1;
}

function createBoardCells(layout: readonly string[], words: CrosswordWord[]): CrosswordBoardCell[] {
  const wordMembership = new Map<string, string[]>();
  words.forEach((word) => {
    word.cellIds.forEach((cellId) => {
      const current = wordMembership.get(cellId) ?? [];
      wordMembership.set(cellId, [...current, word.id]);
    });
  });

  const cells: CrosswordBoardCell[] = [];
  layout.forEach((rowValue, row) => {
    rowValue.split("").forEach((character, col) => {
      if (character === BLOCKED) return;
      const id = cellId(row, col);
      cells.push({
        id,
        row,
        col,
        letter: character,
        isPlayable: true,
        matched: false,
        revealedByMatch: false,
        wordIds: wordMembership.get(id) ?? [],
      });
    });
  });

  return cells;
}

function createWords(
  blueprints: ReadonlyArray<{ id: string; text: string; cells: string[] }>
): CrosswordWord[] {
  return blueprints.map((word) => ({
    id: word.id,
    text: word.text,
    cellIds: [...word.cells],
    isComplete: false,
  }));
}

function createLetterBankCells(letters: readonly string[]): CrosswordLetterBankCell[] {
  if (letters.length !== LETTER_BANK_SIZE) {
    throw new Error(`Expected ${LETTER_BANK_SIZE} letter bank cells, received ${letters.length}`);
  }
  if (new Set(letters).size !== letters.length) {
    throw new Error("Crossword letter bank entries must be unique per ticket");
  }

  return letters.map((letter, index) => ({
    id: `letter-bank-${index + 1}`,
    letter,
    revealed: false,
  }));
}

function buildPrizeLegend(entries: ReadonlyArray<readonly [number, number]>, maxCompletedWords: number): CrosswordPrizeTier[] {
  const visibleEntries = entries.filter(([completedWords]) => completedWords <= maxCompletedWords);
  const topCompletedWords = visibleEntries.at(-1)?.[0] ?? maxCompletedWords;
  const ticketCostCompletedWords = visibleEntries[0]?.[0];

  return visibleEntries.map(([completedWords, rewardAmount]) => ({
    completedWords,
    rewardAmount,
    label:
      completedWords === topCompletedWords
        ? "Jackpot"
        : completedWords === ticketCostCompletedWords
          ? "Free Ticket"
          : `${completedWords} words`,
  }));
}

function assertCuratedCrosswordWordPools(wordPoolsByLength: Record<number, readonly string[]>) {
  Object.entries(wordPoolsByLength).forEach(([lengthKey, words]) => {
    const expectedLength = Number(lengthKey);
    const seenWords = new Set<string>();

    words.forEach((word) => {
      if (!/^[A-Z]+$/.test(word)) {
        throw new Error(`Crossword word pool contains a non-uppercase entry: ${word}`);
      }

      if (word.length !== expectedLength) {
        throw new Error(`Crossword word pool entry ${word} does not match expected length ${expectedLength}`);
      }

      if (seenWords.has(word)) {
        throw new Error(`Crossword word pool contains a duplicate ${expectedLength}-letter entry: ${word}`);
      }

      if (DISALLOWED_CROSSWORD_WORDS.has(word)) {
        throw new Error(`Crossword word pool contains a disallowed entry: ${word}`);
      }

      seenWords.add(word);
    });
  });
}

function buildLetterBank(coreLetters: readonly string[], layout: readonly string[]) {
  const boardLetters = new Set(layout.join("").replaceAll(BLOCKED, "").split(""));
  const fillerLetters = LETTER_BANK_FILLERS.filter((letter) => !boardLetters.has(letter));
  return [...coreLetters, ...fillerLetters].slice(0, LETTER_BANK_SIZE);
}

function resolveTemplateChoice(templateChoice: CrosswordTemplateChoice) {
  const structure = CROSSWORD_STRUCTURES.find((candidate) => candidate.id === templateChoice.structureId);
  if (!structure) {
    throw new Error(`Unknown crossword structure ${templateChoice.structureId}`);
  }

  const baseTemplate = createGeneratedTemplate(
    structure,
    templateChoice.templateSeed,
    templateChoice.id
  );

  return {
    ...baseTemplate,
    id: templateChoice.id,
    familyId: templateChoice.familyId,
  };
}

function createGeneratedTemplate(
  structure: CrosswordStructureDefinition,
  seed: string,
  templateId = `${structure.id}-${seed}`
): CrosswordTemplateDefinition {
  const cacheKey = `${structure.id}:${templateId}:${seed}`;
  const cached = GENERATED_TEMPLATE_CACHE.get(cacheKey);
  if (cached) return cached;

  const effectiveStructure = deriveCompleteCrosswordStructure(structure);
  const solved = solveCrosswordStructure(effectiveStructure, seed);
  const matrix = Array.from({ length: structure.rows }, () => Array.from({ length: structure.cols }, () => BLOCKED));
  const wordBlueprints = effectiveStructure.slots.map((slot, index) => {
    const text = solved[index]!;

    slot.cells.forEach(([row, col], letterIndex) => {
      const nextLetter = text[letterIndex]!;
      const currentLetter = matrix[row]![col]!;
      if (currentLetter !== BLOCKED && currentLetter !== nextLetter) {
        throw new Error(`Generated crossword ${structure.id} has conflicting letters at row ${row}, col ${col}`);
      }
      matrix[row]![col] = nextLetter;
    });

    return {
      id: `${slot.id}-${text.toLowerCase()}`,
      text,
      cells: slot.cells.map(([row, col]) => cellId(row, col)),
    };
  });

  const template = {
    id: templateId,
    familyId: structure.id,
    layout: matrix.map((row) => row.join("")),
    wordBlueprints,
  } satisfies CrosswordTemplateDefinition;

  GENERATED_TEMPLATE_CACHE.set(cacheKey, template);
  return template;
}
function solveCrosswordStructure(structure: CrosswordStructureDefinition, seed: string) {
  const assignedWords = Array<string | null>(structure.slots.length).fill(null);
  const usedWords = new Set<string>();
  const intersectionMap = buildSlotIntersections(structure.slots);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    assignedWords.fill(null);
    usedWords.clear();

    if (fillCrosswordSlots(structure, intersectionMap, assignedWords, usedWords, `${seed}:${attempt}`)) {
      const solvedWords = assignedWords.map((word) => word!);
      if (countUniqueLetters(solvedWords) <= LETTER_BANK_SIZE) {
        return solvedWords;
      }
    }
  }

  throw new Error(`Unable to generate a valid crossword fill for structure ${structure.id}`);
}

function deriveCompleteCrosswordStructure(structure: CrosswordStructureDefinition): CrosswordStructureDefinition {
  const occupancy = Array.from({ length: structure.rows }, () => Array.from({ length: structure.cols }, () => false));

  structure.slots.forEach((slot) => {
    slot.cells.forEach(([row, col]) => {
      occupancy[row]![col] = true;
    });
  });

  return {
    ...structure,
    slots: deriveSlotsFromOccupancy(occupancy),
  };
}

function deriveSlotsFromOccupancy(occupancy: boolean[][]): CrosswordSlotDefinition[] {
  const rows = occupancy.length;
  const cols = occupancy[0]?.length ?? 0;
  const slots: CrosswordSlotDefinition[] = [];
  let acrossCount = 1;
  let downCount = 1;

  for (let row = 0; row < rows; row += 1) {
    let col = 0;
    while (col < cols) {
      if (!occupancy[row]?.[col]) {
        col += 1;
        continue;
      }

      const startsAcross = !occupancy[row]?.[col - 1] && !!occupancy[row]?.[col + 1];
      if (!startsAcross) {
        col += 1;
        continue;
      }

      const cells: Array<readonly [number, number]> = [];
      let nextCol = col;
      while (nextCol < cols && occupancy[row]?.[nextCol]) {
        cells.push([row, nextCol]);
        nextCol += 1;
      }

      if (cells.length >= 2) {
        slots.push({ id: `across-${acrossCount}`, cells });
        acrossCount += 1;
      }

      col = nextCol;
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let row = 0;
    while (row < rows) {
      if (!occupancy[row]?.[col]) {
        row += 1;
        continue;
      }

      const startsDown = !occupancy[row - 1]?.[col] && !!occupancy[row + 1]?.[col];
      if (!startsDown) {
        row += 1;
        continue;
      }

      const cells: Array<readonly [number, number]> = [];
      let nextRow = row;
      while (nextRow < rows && occupancy[nextRow]?.[col]) {
        cells.push([nextRow, col]);
        nextRow += 1;
      }

      if (cells.length >= 2) {
        slots.push({ id: `down-${downCount}`, cells });
        downCount += 1;
      }

      row = nextRow;
    }
  }

  return slots;
}

function fillCrosswordSlots(
  structure: CrosswordStructureDefinition,
  intersectionMap: Map<number, Array<{ otherSlotIndex: number; letterIndex: number; otherLetterIndex: number }>>,
  assignedWords: Array<string | null>,
  usedWords: Set<string>,
  seed: string,
): boolean {
  if (assignedWords.every((word) => word !== null)) {
    return true;
  }

  const slotIndex = chooseNextSlotIndex(structure, intersectionMap, assignedWords, usedWords, seed);
  if (slotIndex === null) {
    return false;
  }
  const slot = structure.slots[slotIndex]!;
  const candidates = getCandidateWordsForSlot(slot, slotIndex, intersectionMap, assignedWords, usedWords, `${seed}:${structure.id}:${slot.id}`);

  for (const word of candidates) {
    assignedWords[slotIndex] = word;
    usedWords.add(word);

    if (fillCrosswordSlots(structure, intersectionMap, assignedWords, usedWords, seed)) {
      return true;
    }

    usedWords.delete(word);
    assignedWords[slotIndex] = null;
  }

  return false;
}

function countUniqueLetters(words: readonly string[]) {
  return new Set(words.join("").split("")).size;
}

function chooseNextSlotIndex(
  structure: CrosswordStructureDefinition,
  intersectionMap: Map<number, Array<{ otherSlotIndex: number; letterIndex: number; otherLetterIndex: number }>>,
  assignedWords: Array<string | null>,
  usedWords: Set<string>,
  seed: string
) {
  let bestSlotIndex: number | null = null;
  let bestCandidates: string[] | null = null;

  structure.slots.forEach((slot, slotIndex) => {
    if (assignedWords[slotIndex]) return;

    const candidates = getCandidateWordsForSlot(
      slot,
      slotIndex,
      intersectionMap,
      assignedWords,
      usedWords,
      `${seed}:${structure.id}:${slot.id}`
    );

    if (candidates.length === 0) {
      bestSlotIndex = slotIndex;
      bestCandidates = candidates;
      return;
    }

    if (
      bestSlotIndex === null ||
      candidates.length < bestCandidates!.length ||
      (candidates.length === bestCandidates!.length &&
        (intersectionMap.get(slotIndex)?.length ?? 0) > (intersectionMap.get(bestSlotIndex)?.length ?? 0))
    ) {
      bestSlotIndex = slotIndex;
      bestCandidates = candidates;
    }
  });

  return bestSlotIndex;
}

function getOrderedWordCandidates(length: number, seed: string) {
  const pool = WORD_POOLS_BY_LENGTH[length];
  if (!pool || pool.length === 0) {
    throw new Error(`No crossword word pool is defined for ${length}-letter slots`);
  }

  return [...pool].sort((left, right) => {
    const leftHash = hashString(`${seed}:${left}`);
    const rightHash = hashString(`${seed}:${right}`);
    return leftHash - rightHash || left.localeCompare(right);
  });
}

function getCandidateWordsForSlot(
  slot: CrosswordSlotDefinition,
  slotIndex: number,
  intersectionMap: Map<number, Array<{ otherSlotIndex: number; letterIndex: number; otherLetterIndex: number }>>,
  assignedWords: Array<string | null>,
  usedWords: Set<string>,
  seed: string
) {
  return getOrderedWordCandidates(slot.cells.length, seed).filter(
    (candidate) => !usedWords.has(candidate) && wordFitsAssignedCrossings(candidate, slotIndex, intersectionMap, assignedWords)
  );
}

function wordFitsAssignedCrossings(
  word: string,
  slotIndex: number,
  intersectionMap: Map<number, Array<{ otherSlotIndex: number; letterIndex: number; otherLetterIndex: number }>>,
  assignedWords: Array<string | null>
) {
  return (intersectionMap.get(slotIndex) ?? []).every(({ otherSlotIndex, letterIndex, otherLetterIndex }) => {
    const otherWord = assignedWords[otherSlotIndex];
    return !otherWord || otherWord[otherLetterIndex] === word[letterIndex];
  });
}

function buildSlotIntersections(slots: ReadonlyArray<CrosswordSlotDefinition>) {
  const intersections = new Map<number, Array<{ otherSlotIndex: number; letterIndex: number; otherLetterIndex: number }>>();

  slots.forEach((slot, slotIndex) => {
    const entries: Array<{ otherSlotIndex: number; letterIndex: number; otherLetterIndex: number }> = [];

    slot.cells.forEach(([row, col], letterIndex) => {
      slots.forEach((otherSlot, otherSlotIndex) => {
        if (slotIndex === otherSlotIndex) return;

        otherSlot.cells.forEach(([otherRow, otherCol], otherLetterIndex) => {
          if (row === otherRow && col === otherCol) {
            entries.push({ otherSlotIndex, letterIndex, otherLetterIndex });
          }
        });
      });
    });

    intersections.set(slotIndex, entries);
  });

  return intersections;
}

function assertConnectedWordBlueprints(
  templateId: string,
  blueprints: ReadonlyArray<{ id: string; text: string; cells: string[] }>
) {
  if (blueprints.length <= 1) return;

  const cellToWordIds = new Map<string, string[]>();
  blueprints.forEach((blueprint) => {
    blueprint.cells.forEach((cell) => {
      const current = cellToWordIds.get(cell) ?? [];
      cellToWordIds.set(cell, [...current, blueprint.id]);
    });
  });

  const neighbors = new Map<string, Set<string>>();
  blueprints.forEach((blueprint) => {
    neighbors.set(blueprint.id, new Set());
  });

  cellToWordIds.forEach((wordIds) => {
    wordIds.forEach((wordId) => {
      const linked = neighbors.get(wordId)!;
      wordIds.forEach((candidateId) => {
        if (candidateId !== wordId) {
          linked.add(candidateId);
        }
      });
    });
  });

  const visited = new Set<string>();
  const queue = [blueprints[0]!.id];
  while (queue.length > 0) {
    const wordId = queue.shift()!;
    if (visited.has(wordId)) continue;
    visited.add(wordId);
    neighbors.get(wordId)?.forEach((neighborId) => {
      if (!visited.has(neighborId)) {
        queue.push(neighborId);
      }
    });
  }

  if (visited.size !== blueprints.length) {
    throw new Error(`Crossword template ${templateId} must stay fully connected like a real crossword`);
  }
}

function resolveVariantLetterSets(
  templateId: string,
  layout: readonly string[],
  words: readonly CrosswordWord[],
  prizeTiers: readonly CrosswordPrizeTier[]
) {
  const cached = VARIANT_LETTER_CACHE.get(templateId);
  if (cached) return cached;

  const boardLetters = Array.from(new Set(layout.join("").replaceAll(BLOCKED, "").split("")));
  const minimumCoreLetterCount = Math.max(1, LETTER_BANK_SIZE - (LETTER_BANK_FILLERS.length - boardLetters.length));
  const letterIndex = new Map(boardLetters.map((letter, index) => [letter, index]));
  const wordMasks = words.map((word) => {
    const uniqueLetters = new Set(word.text.split(""));
    let mask = 0;
    uniqueLetters.forEach((letter) => {
      const index = letterIndex.get(letter);
      if (index === undefined) {
        throw new Error(`Missing board letter "${letter}" in crossword template ${templateId}`);
      }
      mask |= 1 << index;
    });
    return mask;
  });

  const subsets = Array.from({ length: 1 << boardLetters.length }, (_, mask) => {
    const letters = boardLetters.filter((_, index) => ((mask >> index) & 1) === 1);
    const completedWordCount = wordMasks.reduce(
      (count, wordMask) => count + (((wordMask & ~mask) === 0 && mask !== 0) || wordMask === 0 ? 1 : 0),
      0
    );
    return {
      mask,
      letters,
      letterCount: letters.length,
      completedWordCount,
      lexicalKey: letters.join(""),
    };
  });

  const result = {
    loss: pickVariantLetters(templateId, "loss", subsets, (count) => count < 3, minimumCoreLetterCount),
    byCompletedWords: new Map(
      prizeTiers.map((tier) => [
        tier.completedWords,
        pickVariantLetters(
          templateId,
          `words-${tier.completedWords}`,
          subsets,
          (count) => count === tier.completedWords,
          minimumCoreLetterCount
        ),
      ])
    ),
  };

  VARIANT_LETTER_CACHE.set(templateId, result);
  return result;
}

function pickVariantLetters(
  templateId: string,
  variantId: CrosswordVariantId,
  subsets: Array<{ letters: string[]; letterCount: number; completedWordCount: number; lexicalKey: string }>,
  matcher: (completedWordCount: number) => boolean,
  minimumLetterCount: number
) {
  const candidates = subsets.filter(
    (subset) => subset.letterCount >= minimumLetterCount && matcher(subset.completedWordCount)
  );
  if (candidates.length === 0) {
    throw new Error(`Unable to derive a ${variantId} crossword letter set for template ${templateId}`);
  }

  candidates.sort((left, right) => {
    if (left.letterCount !== right.letterCount) {
      return left.letterCount - right.letterCount;
    }

    return left.lexicalKey.localeCompare(right.lexicalKey);
  });

  return candidates[0]!.letters;
}

function cellId(row: number, col: number) {
  return `r${row}c${col}`;
}

function createWordBlueprints(layout: readonly string[]) {
  const blueprints: Array<{ id: string; text: string; cells: string[] }> = [];

  layout.forEach((rowValue, row) => {
    let col = 0;
    while (col < rowValue.length) {
      if (rowValue[col] === BLOCKED) {
        col += 1;
        continue;
      }

      const startCol = col;
      let text = "";
      while (col < rowValue.length && rowValue[col] !== BLOCKED) {
        text += rowValue[col];
        col += 1;
      }

      if (text.length > 1) {
        blueprints.push({
          id: `across-${blueprints.length + 1}-${text.toLowerCase()}`,
          text,
          cells: text.split("").map((_, offset) => cellId(row, startCol + offset)),
        });
      }
    }
  });

  const colCount = layout[0]?.length ?? 0;
  for (let col = 0; col < colCount; col += 1) {
    let row = 0;
    while (row < layout.length) {
      if ((layout[row]?.[col] ?? BLOCKED) === BLOCKED) {
        row += 1;
        continue;
      }

      const startRow = row;
      let text = "";
      while (row < layout.length && (layout[row]?.[col] ?? BLOCKED) !== BLOCKED) {
        text += layout[row]![col]!;
        row += 1;
      }

      if (text.length > 1) {
        blueprints.push({
          id: `down-${blueprints.length + 1}-${text.toLowerCase()}`,
          text,
          cells: text.split("").map((_, offset) => cellId(startRow + offset, col)),
        });
      }
    }
  }

  if (blueprints.length < 8) {
    throw new Error(`Expected at least 8 crossword words in the sample layout, received ${blueprints.length}`);
  }

  return blueprints;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashString(seed) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
}

function shuffleLetters(letters: readonly string[], seed: string) {
  const random = createSeededRandom(seed);
  const copy = [...letters];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}
