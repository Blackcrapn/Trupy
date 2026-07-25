import type { PlayerSave } from '../game/types';

const STORAGE_KEY = 'trupy-save-v1';

export const DEFAULT_SAVE: PlayerSave = {
  version: 1,
  coins: 35,
  xp: 0,
  level: 1,
  reputation: 0,
  health: 100,
  maxHealth: 100,
  potions: 2,
  ownedWeapons: ['rustblade'],
  equippedWeapon: 'rustblade',
  questProgress: {},
  claimedTiers: [],
  flags: {},
  tutorialDone: false,
  playtime: 0,
  settings: {
    sound: true,
    reducedMotion: false,
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
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
        flags: { ...parsed.flags },
        questProgress: { ...parsed.questProgress },
        ownedWeapons: parsed.ownedWeapons?.length ? [...parsed.ownedWeapons] : ['rustblade'],
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
