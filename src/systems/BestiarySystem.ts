import { ENEMIES } from '../data/content';
import { getBestiaryLore } from '../data/bestiary';
import type { BestiaryEntry } from '../game/types';
import type { SaveSystem } from './SaveSystem';

// Progressive reveal thresholds (kills). Kept as named constants so UI copy and
// the reveal logic never drift apart.
export const BESTIARY_APPEARANCE_AT = 1; // name + appearance
export const BESTIARY_STATS_AT = 5; // health/damage numbers
export const BESTIARY_WEAKNESS_AT = 15; // weakness hint

/**
 * Bestiary progression.
 *
 * Kills are counted per enemy id in save.bestiary (v3 field, defaults to {}).
 * Lore is fixed data (data/bestiary.ts); the *reveal* of name/stats/weakness is
 * derived purely from the kill count, so nothing extra needs persisting. Only
 * enemies that exist in ENEMIES are tracked — an unknown id is ignored, so the
 * data tests' enemy-id invariants are never violated by this system.
 */
export class BestiarySystem {
  constructor(private readonly saves: SaveSystem) {}

  // Record one (or more) kills of an enemy. Returns the new kill total. Unknown
  // enemy ids are a no-op and return 0 rather than polluting the save.
  recordKill(enemyId: string, amount = 1): number {
    if (!ENEMIES[enemyId] || amount <= 0) return 0;
    let total = 0;
    this.saves.mutate((save) => {
      total = (save.bestiary[enemyId] ?? 0) + amount;
      save.bestiary[enemyId] = total;
      save.stats.totalKills += amount;
      const enemy = ENEMIES[enemyId];
      // A "boss" here is a large, high-value foe. Both story bosses use scale,
      // so that's the cheapest reliable signal without new data.
      if (enemy.scale && enemy.scale >= 1.4) save.stats.bossKills += amount;
    }, true);
    return total;
  }

  kills(enemyId: string): number {
    return this.saves.get().bestiary[enemyId] ?? 0;
  }

  totalKills(): number {
    // Prefer the flat counter, but fall back to summing the map for safety on
    // saves migrated before stats existed.
    const save = this.saves.get();
    if (save.stats.totalKills > 0) return save.stats.totalKills;
    return Object.values(save.bestiary).reduce((sum, n) => sum + n, 0);
  }

  // Number of enemy types with at least one kill (i.e. discovered entries).
  discoveredCount(): number {
    const save = this.saves.get();
    return Object.keys(ENEMIES).filter((id) => (save.bestiary[id] ?? 0) >= BESTIARY_APPEARANCE_AT).length;
  }

  totalSpecies(): number {
    return Object.keys(ENEMIES).length;
  }

  // Build a display entry for one enemy with progressive reveal applied.
  getEntry(enemyId: string): BestiaryEntry | undefined {
    const enemy = ENEMIES[enemyId];
    if (!enemy) return undefined;
    const kills = this.kills(enemyId);
    const lore = getBestiaryLore(enemyId) ?? { lore: '', weakness: '' };
    const statsRevealed = kills >= BESTIARY_STATS_AT;
    return {
      enemyId,
      // Name is masked until the first kill, matching a classic bestiary tease.
      name: kills >= BESTIARY_APPEARANCE_AT ? enemy.name : '???',
      kills,
      appearanceRevealed: kills >= BESTIARY_APPEARANCE_AT,
      statsRevealed,
      weaknessRevealed: kills >= BESTIARY_WEAKNESS_AT,
      lore: lore.lore,
      weakness: lore.weakness,
      // Stats are only attached once earned; UI decides how to show the rest.
      stats: statsRevealed ? { health: enemy.health, damage: enemy.damage, speed: enemy.speed } : undefined,
    };
  }

  // All entries in the fixed ENEMIES order, each with reveal state applied.
  listEntries(): BestiaryEntry[] {
    return Object.keys(ENEMIES)
      .map((id) => this.getEntry(id))
      .filter((entry): entry is BestiaryEntry => Boolean(entry));
  }
}
