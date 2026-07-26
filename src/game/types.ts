export type WeaponKind = 'melee' | 'ranged' | 'magic';
export type ObjectiveType = 'collect' | 'kill' | 'purchase' | 'interact' | 'visit';
export type QuestStatus = 'available' | 'active' | 'ready' | 'completed';
export type ItemCategory = 'weapon' | 'armor' | 'amulet' | 'consumable' | 'material' | 'quest';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface InventoryStack {
  itemId: string;
  quantity: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: Exclude<ItemCategory, 'weapon'>;
  rarity: ItemRarity;
  icon: string;
  stackLimit: number;
  value: number;
  heal?: number;
  armor?: number;
  damageBonus?: number;
  speedBonus?: number;
}

export interface EquipmentState {
  weapon: string;
  armor?: string;
  amulet?: string;
  quick: Array<string | null>;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  kind: WeaponKind;
  price: number;
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed?: number;
  requiredRep: number;
  icon: string;
  accent: string;
}

export interface QuestObjective {
  type: ObjectiveType;
  target: string;
  label: string;
  amount: number;
}

export interface QuestReward {
  coins: number;
  xp: number;
  reputation: number;
  potions?: number;
  items?: InventoryStack[];
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  giver: string;
  category: 'main' | 'side';
  prerequisite?: string;
  objectives: QuestObjective[];
  reward: QuestReward;
}

export interface QuestProgress {
  status: Exclude<QuestStatus, 'available'>;
  objectiveIndex: number;
  amount: number;
}

export interface BattlePassTier {
  tier: number;
  reputation: number;
  rewardLabel: string;
  coins?: number;
  potions?: number;
  weapon?: string;
}

export interface PlayerSave {
  version: number;
  coins: number;
  xp: number;
  level: number;
  reputation: number;
  health: number;
  maxHealth: number;
  potions: number;
  ownedWeapons: string[];
  equippedWeapon: string;
  inventory: InventoryStack[];
  chest: InventoryStack[];
  equipment: EquipmentState;
  discoveredLocations: string[];
  currentScene: 'world' | string;
  playerPosition?: { x: number; y: number };
  questProgress: Record<string, QuestProgress>;
  claimedTiers: number[];
  flags: Record<string, boolean>;
  tutorialDone: boolean;
  playtime: number;
  // --- v3 fields. All optional-by-default in the save loader so v2 saves and
  // the v1 migration path keep working without data loss. See SaveSystem.ts. ---
  // Per-weapon upgrade level (blacksmith reinforcement), 0..5. Missing key = +0.
  weaponUpgrades: Record<string, number>;
  // Kills recorded per enemy id for the bestiary. Missing key = 0 kills.
  bestiary: Record<string, number>;
  // Ids of achievements the player has unlocked.
  achievements: string[];
  // Rolling skill counters achievements read from (best combo, no-hit boss kills…).
  stats: PlayerStats;
  // Position in the day/night cycle, 0..1. Persisted so reloading doesn't reset
  // the player to noon and erase the night they were surviving.
  dayProgress: number;
  settings: {
    sound: boolean;
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    ambienceVolume: number;
    reducedMotion: boolean;
    quality: 'auto' | 'high' | 'low';
  };
}

// Aggregate skill/progress counters. Kept separate from questProgress/bestiary so
// achievement rules can read a single flat snapshot without recomputing anything.
export interface PlayerStats {
  totalKills: number;
  bossKills: number;
  flawlessBossKills: number;
  bestCombo: number;
  itemsCrafted: number;
  weaponsUpgraded: number;
  coinsEarned: number;
  questsCompleted: number;
}

export type RecipeKind = 'consumable' | 'equipment';

// A crafting recipe: consume `materials` (+ optional coins) to produce `output`.
export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  kind: RecipeKind;
  station: string; // NPC id where crafting happens (e.g. 'runa').
  materials: InventoryStack[];
  coins?: number;
  output: InventoryStack;
  requiredRep?: number;
}

// One reinforcement level for a weapon at the blacksmith.
export interface WeaponUpgradeTier {
  level: number; // 1..5
  coins: number;
  materials: InventoryStack[];
  damageBonusPct: number; // cumulative percentage added to base damage at this level
}

export interface BestiaryEntry {
  enemyId: string;
  name: string;
  kills: number;
  // Progressive reveal thresholds are reached top-down as kills accrue.
  appearanceRevealed: boolean; // >= 1 kill: name + look
  statsRevealed: boolean; // >= 5 kills: health/damage numbers
  weaknessRevealed: boolean; // >= 15 kills: weakness hint
  lore: string; // always present, but UI may gate it behind appearanceRevealed
  weakness: string;
  stats?: { health: number; damage: number; speed: number };
}

export type AchievementCategory =
  | 'kills'
  | 'exploration'
  | 'crafting'
  | 'quests'
  | 'economy'
  | 'skill'
  | 'secret';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  hidden?: boolean; // secret achievements stay masked until unlocked
  icon: string;
}

export interface AchievementView extends AchievementDefinition {
  unlocked: boolean;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  health: number;
  damage: number;
  speed: number;
  aggro: number;
  rewardCoins: number;
  tint: number;
  scale?: number;
  drops?: Array<{ itemId: string; chance: number; min: number; max: number }>;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  level: number;
  xp: number;
  xpNext: number;
  coins: number;
  reputation: number;
  potions: number;
  equippedWeapon: string;
  ownedWeapons: string[];
  inventory: InventoryStack[];
  chest: InventoryStack[];
  equipment: EquipmentState;
  discoveredLocations: string[];
  /** Ids of hidden places (secrets, shortcut mouths, the ford) already found. */
  discoveredSecrets: string[];
  /** World point of the current quest objective, for the map's objective marker. */
  objectivePoint?: { x: number; y: number };
  currentScene: string;
  settings: PlayerSave['settings'];
  activeQuest?: {
    title: string;
    objective: string;
    amount: number;
    required: number;
    ready: boolean;
  };
  quests: Array<{
    id: string;
    title: string;
    category: 'main' | 'side';
    status: QuestStatus;
    objective?: string;
    amount?: number;
    required?: number;
  }>;
  claimedTiers: number[];
  tutorialDone: boolean;
}

export interface DialogueAction {
  label: string;
  event: string;
  payload?: unknown;
  primary?: boolean;
}

export interface DialoguePayload {
  speaker: string;
  subtitle?: string;
  text: string;
  accent?: string;
  actions: DialogueAction[];
}
