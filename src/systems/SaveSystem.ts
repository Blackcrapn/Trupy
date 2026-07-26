import type { PlayerSave, PlayerStats } from '../game/types';

const STORAGE_KEY = 'trupy-save-v1';

/**
 * localStorage is not always reachable: private browsing, strict cookie
 * policies, sandboxed iframes and quota-exceeded all throw on access — and a
 * throw here used to take the whole game down before the first frame.
 *
 * Storage is a convenience, not a requirement, so every access is guarded and
 * falls back to an in-memory map. The player can still play a full session; only
 * persistence between sessions is lost, and `storageAvailable` lets the UI say so.
 */
const memoryFallback = new Map<string, string>();
let storageWarned = false;

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    if (!storageWarned) {
      storageWarned = true;
      console.warn('Trupy: localStorage unavailable — progress will not persist between sessions.');
    }
    return memoryFallback.get(key) ?? null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    if (!storageWarned) {
      storageWarned = true;
      console.warn('Trupy: localStorage unavailable — progress will not persist between sessions.');
    }
    memoryFallback.set(key, value);
  }
}

/** True when progress will actually survive a reload. */
export function storageAvailable(): boolean {
  try {
    const probe = '__trupy_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

// Save schema version. Bumped to 3 when crafting/bestiary/achievement state was
// added. v1 and v2 saves upgrade in-place via load() below; every new field is
// backfilled from a default so no existing data is lost.
export const SAVE_VERSION = 3;

export const DEFAULT_SAVE: PlayerSave = {
  version: SAVE_VERSION,
  coins: 35,
  xp: 0,
  level: 1,
  reputation: 0,
  health: 100,
  maxHealth: 100,
  potions: 2,
  ownedWeapons: ['rustblade'],
  equippedWeapon: 'rustblade',
  inventory: [
    { itemId: 'blood_vial', quantity: 2 },
    { itemId: 'traveler_coat', quantity: 1 },
  ],
  chest: [
    { itemId: 'bone_shard', quantity: 3 },
    { itemId: 'smoke_bomb', quantity: 1 },
  ],
  equipment: { weapon: 'rustblade', armor: 'traveler_coat', quick: ['blood_vial', null, null] },
  discoveredLocations: ['home', 'village'],
  currentScene: 'world',
  playerPosition: { x: 430, y: 585 },
  questProgress: {},
  claimedTiers: [],
  flags: {},
  tutorialDone: false,
  playtime: 0,
  // v3 additions — empty by default so a brand-new game starts with no upgrades,
  // no discovered lore and no achievements.
  weaponUpgrades: {},
  bestiary: {},
  achievements: [],
  stats: {
    totalKills: 0,
    bossKills: 0,
    flawlessBossKills: 0,
    bestCombo: 0,
    itemsCrafted: 0,
    weaponsUpgraded: 0,
    coinsEarned: 0,
    questsCompleted: 0,
  },
  // Start mid-morning: a new player should see the world clearly before night.
  dayProgress: 0.34,
  settings: {
    sound: true,
    masterVolume: 0.85,
    musicVolume: 0.55,
    sfxVolume: 0.8,
    ambienceVolume: 0.5,
    reducedMotion: false,
    quality: 'auto',
  },
};

export class SaveSystem {
  private data: PlayerSave;
  private timer?: number;

  constructor() {
    this.data = this.load();
  }

  private load(): PlayerSave {
    try {
      const stored = storageGet(STORAGE_KEY);
      if (!stored) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(stored) as Partial<PlayerSave>;
      const migratedInventory = parsed.inventory?.length
        ? parsed.inventory.map((stack) => ({ ...stack }))
        : [
            { itemId: 'blood_vial', quantity: parsed.potions ?? 2 },
            { itemId: 'traveler_coat', quantity: 1 },
          ];
      const equippedWeapon = parsed.equippedWeapon ?? parsed.equipment?.weapon ?? 'rustblade';
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        // Always normalise to the current schema version regardless of the
        // stored value (covers v1 and v2 -> v3).
        version: SAVE_VERSION,
        potions: migratedInventory.find((stack) => stack.itemId === 'blood_vial')?.quantity ?? 0,
        inventory: migratedInventory,
        chest: parsed.chest?.map((stack) => ({ ...stack })) ?? structuredClone(DEFAULT_SAVE.chest),
        equipment: {
          ...DEFAULT_SAVE.equipment,
          ...parsed.equipment,
          weapon: equippedWeapon,
          quick: [...(parsed.equipment?.quick ?? DEFAULT_SAVE.equipment.quick)],
        },
        settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
        flags: { ...parsed.flags },
        questProgress: { ...parsed.questProgress },
        discoveredLocations: [...(parsed.discoveredLocations ?? DEFAULT_SAVE.discoveredLocations)],
        playerPosition: parsed.playerPosition ? { ...parsed.playerPosition } : { ...DEFAULT_SAVE.playerPosition! },
        ownedWeapons: parsed.ownedWeapons?.length ? [...parsed.ownedWeapons] : ['rustblade'],
        equippedWeapon,
        claimedTiers: [...(parsed.claimedTiers ?? [])],
        // --- v3 fields. Each falls back to a fresh default so pre-v3 saves,
        // which lack these keys entirely, load cleanly. Records/arrays are
        // shallow-copied to avoid sharing references with the parsed object. ---
        weaponUpgrades: { ...(parsed.weaponUpgrades ?? {}) },
        bestiary: { ...(parsed.bestiary ?? {}) },
        achievements: [...(parsed.achievements ?? [])],
        stats: { ...DEFAULT_SAVE.stats, ...(parsed.stats as Partial<PlayerStats> | undefined) },
        // Clamp to 0..1: a corrupted or out-of-range value would otherwise leave
        // the day/night cycle stuck outside its keyframe table.
        dayProgress: typeof parsed.dayProgress === 'number' && Number.isFinite(parsed.dayProgress)
          ? ((parsed.dayProgress % 1) + 1) % 1
          : DEFAULT_SAVE.dayProgress,
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  get(): PlayerSave {
    return this.data;
  }

  patch(update: Partial<PlayerSave>, immediate = false): PlayerSave {
    this.data = { ...this.data, ...update };
    if (immediate) this.flush();
    else this.queueSave();
    return this.data;
  }

  mutate(callback: (save: PlayerSave) => void, immediate = false): PlayerSave {
    callback(this.data);
    if (immediate) this.flush();
    else this.queueSave();
    return this.data;
  }

  flush(): void {
    window.clearTimeout(this.timer);
    storageSet(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset(): PlayerSave {
    this.data = structuredClone(DEFAULT_SAVE);
    this.flush();
    return this.data;
  }

  private queueSave(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), 180);
  }
}
