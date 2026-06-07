export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type RacePartSlot =
  | 'Engine'
  | 'Tire'
  | 'Gearbox'
  | 'Body'
  | 'Intake'
  | 'Exhaust'
  | 'Turbo'
  | 'Stability';

export type RacePartStatKey = 'hp' | 'engine' | 'tire' | 'gearbox' | 'stability' | 'weight';

export type MythicUpgradeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type MythicUpgradeInputLevel = Exclude<MythicUpgradeLevel, 10>;

export interface RacePart {
  id: number;
  templateId?: string;
  name: string;
  type: RacePartSlot;
  slot?: RacePartSlot;
  rarity: Rarity;
  price: number;
  effectText?: string;
  changes: Partial<Record<RacePartStatKey, number>>;
  horsepower?: number;
  engine?: number;
  tire?: number;
  transmission?: number;
  stability?: number;
  weight?: number;
  risk?: number;
  [key: string]: unknown;
}

export interface GameSettings {
  soundEnabled: boolean;
  telemetryEnabled: boolean;
}

export interface AchievementState {
  completed: Record<string, string>;
  lastUnlocked: string[];
}

export interface RaceStats {
  totalRaces: number;
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  bestStreak: number;
  falseStartCount: number;
  practiceRaces: number;
  partsPurchasedCount: number;
  highestCash: number;
  winsByDifficulty: Record<string, number>;
  bestStreakByDifficulty: Record<string, number>;
  wonWithBuildAchievements: string[];
  wonWithSpecialParts: string[];
  [key: string]: unknown;
}

export interface RaceSaveData {
  cash: number;
  raceCount: number;
  lastRank: string;
  inventory: RacePart[];
  equippedParts: Record<RacePartSlot, number | null>;
  mythicUpgrades: Record<string, MythicUpgradeLevel>;
  settings: GameSettings;
  achievements: AchievementState;
  stats: RaceStats;
  nextPartId: number;
  [key: string]: unknown;
}

export interface GameState extends RaceSaveData {
  phase: string;
  ready: boolean;
  shopItems: RacePart[];
  activePage: 'race' | 'shop' | 'tuning' | 'profile' | 'atlas' | string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  check: string;
  flavor?: string;
  hidden?: boolean;
}

export interface FinishedRaceTelemetry {
  difficulty: string;
  rank: string;
  reactionTime: number | null;
  opponentReactionTime: number | null;
  raceCount: number;
  isPractice: boolean;
  isAiAssist: boolean;
  money: number;
  winStreak: number;
  version: string;
}

export interface MythicUpgradeConfig {
  maxLevel: 10;
  bonusPerLevel: number;
  statKeys: readonly Extract<RacePartStatKey, 'hp' | 'engine' | 'tire' | 'gearbox' | 'stability'>[];
  successRates: Record<MythicUpgradeInputLevel, number>;
}

export interface MythicUpgradeResultTelemetry {
  partId: string;
  templateId: string;
  slot: RacePartSlot;
  fromLevel: MythicUpgradeInputLevel;
  toLevel: MythicUpgradeLevel;
  success: boolean;
  cost: number;
  money: number;
  version: string;
}

export const DEFAULT_SETTINGS_CONTRACT = {
  soundEnabled: true,
  telemetryEnabled: true,
} as const satisfies GameSettings;

export const MYTHIC_UPGRADE_CONTRACT = {
  maxLevel: 10,
  bonusPerLevel: 0.025,
  statKeys: ['hp', 'engine', 'tire', 'gearbox', 'stability'],
  successRates: {
    0: 1,
    1: 0.95,
    2: 0.9,
    3: 0.82,
    4: 0.74,
    5: 0.65,
    6: 0.55,
    7: 0.45,
    8: 0.35,
    9: 0.25,
  },
} as const satisfies MythicUpgradeConfig;
