import type { PlayerSave } from '../game/types';

const STORAGE_KEY = 'trupy-save-v1';

export const DEFAULT_SAVE: PlayerSave = {
  version: 2,
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
      const stored = localStorage.getItem(STORAGE_KEY);
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
        version: 2,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
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
