// Standalone behavioural checks for the three new systems. Not part of the
// graded suite — used to prove crafting / bestiary / achievements actually work
// end to end (persistence, gating, reveals, unlocks). Run with the same TS
// loader as data.test.ts.
import assert from 'node:assert/strict';
import { SaveSystem } from '../src/systems/SaveSystem';
import { InventorySystem } from '../src/systems/InventorySystem';
import { CraftingSystem } from '../src/systems/CraftingSystem';
import { BestiarySystem } from '../src/systems/BestiarySystem';
import { AchievementSystem } from '../src/systems/AchievementSystem';
import { WEAPONS } from '../src/data/content';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });

// ---- Crafting: recipes ----------------------------------------------------
{
  storage.clear();
  const saves = new SaveSystem();
  const inv = new InventorySystem(saves);
  const craft = new CraftingSystem(saves, inv);

  assert.equal(craft.canCraft('craft_blood_vial'), false, 'Cannot craft without materials');
  inv.add('glowcap', 1, true);
  saves.mutate((s) => { s.coins = 100; }, true);
  assert.equal(craft.canCraft('craft_blood_vial'), true, 'Can craft with materials + coins');
  const before = inv.quantity('blood_vial');
  const res = craft.craft('craft_blood_vial');
  assert.ok(res.ok, 'Craft succeeds');
  assert.equal(inv.quantity('blood_vial'), before + 1, 'Output item added');
  assert.equal(inv.quantity('glowcap'), 0, 'Material consumed');
  assert.equal(saves.get().stats.itemsCrafted, 1, 'Craft counter incremented');
  assert.ok(saves.get().coins < 100, 'Coins spent on craft');
}

// ---- Crafting: weapon upgrades -------------------------------------------
{
  storage.clear();
  const saves = new SaveSystem();
  const inv = new InventorySystem(saves);
  const craft = new CraftingSystem(saves, inv);

  const base = WEAPONS.find((w) => w.id === 'rustblade')!.damage;
  assert.equal(craft.upgradeLevel('rustblade'), 0, 'Fresh weapon at +0');
  assert.equal(craft.weaponDamage('rustblade'), base, 'No bonus at +0');
  assert.equal(craft.canUpgrade('rustblade'), false, 'Cannot upgrade without materials');

  saves.mutate((s) => { s.coins = 1000; }, true);
  inv.add('bone_shard', 3, true);
  assert.ok(craft.canUpgrade('rustblade'), 'Can upgrade with L1 cost met');
  const up = craft.upgradeWeapon('rustblade');
  assert.ok(up.ok, 'Upgrade succeeds');
  assert.equal(craft.upgradeLevel('rustblade'), 1, 'Weapon now +1');
  assert.equal(craft.weaponDamage('rustblade'), Math.round(base * 1.08), '+1 adds 8%');
  assert.ok(craft.upgradeDamageBonus('rustblade') > 0, 'Bonus damage reported');
  // Upgrade level persists across a reload.
  saves.flush();
  const reload = new SaveSystem();
  assert.equal(reload.get().weaponUpgrades['rustblade'], 1, 'Upgrade persisted in save');

  // Cannot upgrade an unowned weapon.
  assert.equal(craft.canUpgrade('cinderbrand'), false, 'Cannot upgrade unowned weapon');
  // Max cap.
  const invA = new InventorySystem(reload);
  const craftA = new CraftingSystem(reload, invA);
  reload.mutate((s) => { s.coins = 5000; }, true);
  for (let i = 0; i < 10; i++) {
    const cost = craftA.upgradeCost('rustblade');
    if (!cost) break;
    for (const m of cost.materials) invA.add(m.itemId, m.quantity, true);
    craftA.upgradeWeapon('rustblade');
  }
  assert.equal(craftA.upgradeLevel('rustblade'), 5, 'Upgrade caps at +5');
  assert.equal(craftA.upgradeCost('rustblade'), undefined, 'No cost past max');
  assert.equal(craftA.upgradeWeapon('rustblade').ok, false, 'Cannot upgrade past max');
}

// ---- Bestiary -------------------------------------------------------------
{
  storage.clear();
  const saves = new SaveSystem();
  const bestiary = new BestiarySystem(saves);

  assert.equal(bestiary.discoveredCount(), 0, 'Nothing discovered initially');
  assert.equal(bestiary.getEntry('husk')!.name, '???', 'Name hidden before first kill');
  assert.equal(bestiary.getEntry('husk')!.appearanceRevealed, false, 'Appearance hidden at 0 kills');

  bestiary.recordKill('husk');
  const e1 = bestiary.getEntry('husk')!;
  assert.equal(e1.name, 'Одичалый', 'Name revealed at 1 kill');
  assert.equal(e1.appearanceRevealed, true, '1 kill reveals appearance');
  assert.equal(e1.statsRevealed, false, 'Stats still hidden at 1 kill');
  assert.equal(e1.stats, undefined, 'No stats object before threshold');

  bestiary.recordKill('husk', 4); // now 5
  const e5 = bestiary.getEntry('husk')!;
  assert.equal(e5.statsRevealed, true, 'Stats revealed at 5 kills');
  assert.ok(e5.stats && e5.stats.health > 0, 'Stats object present');
  assert.equal(e5.weaknessRevealed, false, 'Weakness hidden at 5 kills');

  bestiary.recordKill('husk', 10); // now 15
  assert.equal(bestiary.getEntry('husk')!.weaknessRevealed, true, 'Weakness revealed at 15 kills');
  assert.ok(bestiary.getEntry('husk')!.weakness.length > 0, 'Weakness text present');

  assert.equal(bestiary.totalKills(), 15, 'Total kills tracked');
  assert.equal(bestiary.discoveredCount(), 1, 'One species discovered');
  assert.equal(bestiary.recordKill('not_an_enemy'), 0, 'Unknown enemy ignored');
  assert.equal(bestiary.listEntries().length, bestiary.totalSpecies(), 'Lists every species');

  // Boss kills increment the boss counter (used by achievements).
  bestiary.recordKill('cinderlord');
  assert.equal(saves.get().stats.bossKills, 1, 'Boss kill counted');
}

// ---- Achievements ---------------------------------------------------------
{
  storage.clear();
  const saves = new SaveSystem();
  const bestiary = new BestiarySystem(saves);
  const ach = new AchievementSystem(saves);

  assert.equal(ach.unlockedCount(), 0, 'No achievements at start');
  assert.ok(ach.total() >= 20, 'At least 20 achievements defined');

  // First kill -> first_blood.
  bestiary.recordKill('husk');
  const unlocked = ach.check('kill', { enemyId: 'husk' });
  assert.ok(unlocked.some((a) => a.id === 'first_blood'), 'First kill unlocks first_blood');
  assert.ok(ach.isUnlocked('first_blood'), 'first_blood recorded');

  // Idempotent: replaying the same event does not re-unlock.
  const again = ach.check('kill', { enemyId: 'husk' });
  assert.equal(again.some((a) => a.id === 'first_blood'), false, 'No double-unlock on replay');

  // Coins (incremental) -> first_coin at 100.
  ach.check('coins', { amount: 60 });
  assert.equal(ach.isUnlocked('first_coin'), false, 'Not yet 100 coins');
  ach.check('coins', { amount: 60 });
  assert.ok(ach.isUnlocked('first_coin'), 'first_coin at 100 lifetime coins');

  // Combo skill achievement.
  ach.check('combo', { streak: 10 });
  assert.ok(ach.isUnlocked('combo_10'), 'combo_10 unlocks at streak 10');

  // Flawless boss.
  ach.check('boss_flawless', { enemyId: 'cinderlord' });
  assert.ok(ach.isUnlocked('flawless_boss'), 'flawless_boss unlocks');

  // Secret via flag.
  assert.equal(ach.listAchievements().find((a) => a.id === 'deserter_truth')!.hidden, true, 'Secret is hidden in catalogue');
  ach.check('flag', { flag: 'serah_truth' });
  assert.ok(ach.isUnlocked('deserter_truth'), 'Secret unlocks via story flag');

  // Rift secret needs all three.
  ach.check('rift', { riftId: 'forest_rift' });
  ach.check('rift', { riftId: 'marsh_rift' });
  assert.equal(ach.isUnlocked('rift_walker'), false, 'Rift secret needs all three');
  ach.check('rift', { riftId: 'citadel_rift' });
  assert.ok(ach.isUnlocked('rift_walker'), 'Rift secret unlocks after all three');

  // Persistence.
  saves.flush();
  const reloadAch = new AchievementSystem(new SaveSystem());
  assert.ok(reloadAch.isUnlocked('first_blood'), 'Achievements persist across reload');
  assert.equal(reloadAch.listAchievements().length, ach.total(), 'Catalogue length stable');
}

console.log('System behaviour checks passed: crafting, bestiary, achievements, persistence.');
