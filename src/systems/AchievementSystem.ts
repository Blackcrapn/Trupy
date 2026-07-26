import { ENEMIES, QUESTS } from '../data/content';
import { LOCATIONS } from '../data/world';
import { ACHIEVEMENTS, getAchievement } from '../data/achievements';
import { MAX_WEAPON_UPGRADE } from '../data/crafting';
import type { AchievementDefinition, AchievementView, PlayerSave } from '../game/types';
import type { SaveSystem } from './SaveSystem';

// Events the rest of the game emits into check(). Kept as a string union so
// callers get autocompletion but new events don't force a data migration.
export type AchievementEvent =
  | 'kill' // payload: { enemyId }
  | 'quest' // payload: { questId }
  | 'discover' // payload: { locationId }
  | 'craft' // crafting a recipe
  | 'upgrade' // payload: { level }
  | 'coins' // payload: { total } — lifetime coins earned
  | 'combo' // payload: { streak } — current uninterrupted hit streak
  | 'boss_flawless' // payload: { enemyId } — boss killed without taking damage
  | 'rift' // payload: { riftId } — a rift was inspected
  | 'flag'; // payload: { flag } — a named story flag was set

export interface AchievementEventPayload {
  enemyId?: string;
  questId?: string;
  locationId?: string;
  level?: number;
  total?: number; // absolute lifetime value (coins) — winner is max()
  amount?: number; // incremental delta (coins just earned) — accumulated
  streak?: number;
  riftId?: string;
  flag?: string;
}

// Story bosses are the large, high-value foes; keep the roster data-driven so a
// new boss automatically counts toward boss-kill achievements.
const BOSS_IDS = Object.values(ENEMIES).filter((e) => (e.scale ?? 1) >= 1.4).map((e) => e.id);
// Story's final beat. Its completion is the whole main chain done, because every
// other main quest is a transitive prerequisite of it (validated in data.test).
const FINAL_MAIN_QUEST = 'ash_crown';
const RIFT_FLAG_PREFIX = 'rift_seen_';

// A rule returns true when its achievement's condition is met for the given save.
// Rules read persisted state only, so check() is idempotent — replaying an event
// never double-unlocks, and a reload re-derives the same answers.
type Rule = (save: PlayerSave, payload: AchievementEventPayload) => boolean;

const questDone = (save: PlayerSave, id: string): boolean => save.questProgress[id]?.status === 'completed';

const RULES: Record<string, Rule> = {
  // kills
  first_blood: (s) => s.stats.totalKills >= 1,
  slayer_25: (s) => s.stats.totalKills >= 25,
  slayer_100: (s) => s.stats.totalKills >= 100,
  nameless_fallen: (s) => (s.bestiary['nameless'] ?? 0) >= 1,
  cinder_fallen: (s) => (s.bestiary['cinderlord'] ?? 0) >= 1,

  // exploration
  wanderer: (s) => s.discoveredLocations.length >= 5,
  cartographer: (s) => LOCATIONS.every((loc) => s.discoveredLocations.includes(loc.id)),
  bestiary_half: (s) => Object.values(s.bestiary).filter((n) => n >= 1).length >= 5,
  bestiary_full: (s) => Object.keys(ENEMIES).every((id) => (s.bestiary[id] ?? 0) >= 1),

  // crafting
  first_craft: (s) => s.stats.itemsCrafted >= 1,
  first_upgrade: (s) => s.stats.weaponsUpgraded >= 1,
  master_smith: (s) => Object.values(s.weaponUpgrades).some((lvl) => lvl >= MAX_WEAPON_UPGRADE),

  // quests
  first_oath_done: (s) => s.stats.questsCompleted >= 1,
  quests_10: (s) => s.stats.questsCompleted >= 10,
  saviour: (s) => questDone(s, FINAL_MAIN_QUEST),

  // economy
  first_coin: (s) => s.stats.coinsEarned >= 100,
  rich: (s) => s.stats.coinsEarned >= 1000,
  armory: (s) => s.ownedWeapons.length >= 5,

  // skill
  flawless_boss: (s) => s.stats.flawlessBossKills >= 1,
  combo_10: (s) => s.stats.bestCombo >= 10,

  // secret
  deserter_truth: (s) => Boolean(s.flags['serah_truth']),
  rift_walker: (s) => ['forest_rift', 'marsh_rift', 'citadel_rift'].every((r) => Boolean(s.flags[`${RIFT_FLAG_PREFIX}${r}`])),
};

/**
 * Achievements.
 *
 * Unlocked ids live in save.achievements (v3 field, defaults to []). Progress
 * counters the rules read (kills, crafts, best combo, lifetime coins…) live in
 * save.stats, also v3. check(event, payload) first folds the event into those
 * persisted counters/flags, then re-evaluates every still-locked achievement.
 * This keeps unlocking correct no matter which event fired — e.g. a boss kill
 * updates totalKills AND the boss-specific rules in one pass.
 */
export class AchievementSystem {
  constructor(private readonly saves: SaveSystem) {}

  // Fold an incoming event into persisted counters/flags so the rules can see it.
  // Kill/coin/craft/upgrade tallies are owned by their own systems where those
  // exist, so here we only record the deltas the achievement layer needs and
  // that no other system is guaranteed to have written yet (combos, flawless
  // kills, story flags, rift/quest bookkeeping).
  private ingest(event: AchievementEvent, payload: AchievementEventPayload): void {
    this.saves.mutate((save) => {
      switch (event) {
        case 'combo':
          if (typeof payload.streak === 'number') save.stats.bestCombo = Math.max(save.stats.bestCombo, payload.streak);
          break;
        case 'boss_flawless':
          if (payload.enemyId && BOSS_IDS.includes(payload.enemyId)) save.stats.flawlessBossKills += 1;
          break;
        case 'coins':
          // Two accepted shapes: an incremental `amount` (coins just earned,
          // accumulated) or an absolute lifetime `total` (kept as a max so
          // replays never shrink it). Integrators can use whichever is handier.
          if (typeof payload.amount === 'number' && payload.amount > 0) save.stats.coinsEarned += payload.amount;
          if (typeof payload.total === 'number') save.stats.coinsEarned = Math.max(save.stats.coinsEarned, payload.total);
          break;
        case 'quest':
          if (payload.questId && save.questProgress[payload.questId]?.status === 'completed') {
            // questsCompleted is derived from questProgress to stay replay-safe.
            save.stats.questsCompleted = Object.values(save.questProgress).filter((p) => p.status === 'completed').length;
          }
          break;
        case 'rift':
          if (payload.riftId) save.flags[`${RIFT_FLAG_PREFIX}${payload.riftId}`] = true;
          break;
        case 'flag':
          if (payload.flag) save.flags[payload.flag] = true;
          break;
        default:
          break;
      }
    }, false);
  }

  /**
   * Feed a gameplay event in. Returns any achievements unlocked as a result so
   * the UI can pop a toast. Safe to call on every event; already-unlocked
   * achievements are skipped.
   */
  check(event: AchievementEvent, payload: AchievementEventPayload = {}): AchievementDefinition[] {
    this.ingest(event, payload);
    const save = this.saves.get();
    const unlocked: AchievementDefinition[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (save.achievements.includes(achievement.id)) continue;
      const rule = RULES[achievement.id];
      if (rule && rule(save, payload)) {
        this.unlock(achievement.id);
        unlocked.push(achievement);
      }
    }
    return unlocked;
  }

  // Directly unlock by id (used by check(), and callable for story-scripted
  // grants). No-op if unknown or already unlocked.
  unlock(id: string): boolean {
    if (!getAchievement(id)) return false;
    if (this.saves.get().achievements.includes(id)) return false;
    this.saves.mutate((save) => {
      if (!save.achievements.includes(id)) save.achievements.push(id);
    }, true);
    return true;
  }

  isUnlocked(id: string): boolean {
    return this.saves.get().achievements.includes(id);
  }

  unlockedCount(): number {
    return this.saves.get().achievements.length;
  }

  total(): number {
    return ACHIEVEMENTS.length;
  }

  // Catalogue with unlock state applied. Hidden achievements stay in the list
  // (so counts line up) but callers can mask name/description until unlocked.
  listAchievements(): AchievementView[] {
    const owned = new Set(this.saves.get().achievements);
    return ACHIEVEMENTS.map((achievement) => ({ ...achievement, unlocked: owned.has(achievement.id) }));
  }
}
