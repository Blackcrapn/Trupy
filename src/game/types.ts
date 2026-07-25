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
