import assert from 'node:assert/strict';
import { BATTLE_PASS, ENEMIES, NPCS, QUESTS, WEAPONS } from '../src/data/content';
import { ITEMS } from '../src/data/items';
import { BUILDINGS, INTERIORS, LOCATIONS, MAP_ROADS, MAP_SHAPES, REGION_ENTRANCES, RIFT_POINTS, WORLD_HEIGHT, WORLD_WIDTH } from '../src/data/world';
import { InventorySystem } from '../src/systems/InventorySystem';
import { QuestSystem } from '../src/systems/QuestSystem';
import { SaveSystem } from '../src/systems/SaveSystem';
import { WeaponShopSystem } from '../src/systems/WeaponShopSystem';
import type { ObjectiveType } from '../src/game/types';

const unique = (values: string[], label: string) => {
  assert.equal(new Set(values).size, values.length, `${label} must contain unique ids`);
};

unique(WEAPONS.map((item) => item.id), 'Weapons');
unique(QUESTS.map((item) => item.id), 'Quests');
unique(NPCS.map((item) => item.id), 'NPCs');
unique(BATTLE_PASS.map((item) => String(item.tier)), 'Battle-pass tiers');
unique(LOCATIONS.map((item) => item.id), 'Locations');
unique(MAP_SHAPES.map((item) => item.id), 'Map shapes');
unique(RIFT_POINTS.map((item) => item.id), 'Rifts');
unique(INTERIORS.map((item) => item.id), 'Interiors');
assert.equal(LOCATIONS.length, 9, 'Expanded world contains nine regions');
assert.equal(INTERIORS.length, 9, 'Nine interiors are available');
assert.ok(WORLD_WIDTH >= 4600 && WORLD_HEIGHT >= 3000, 'World dimensions are expanded');
assert.deepEqual(new Set(MAP_SHAPES.map((shape) => shape.id)), new Set(LOCATIONS.map((location) => location.id)), 'Map and world use the same regions');
for (const [index, location] of LOCATIONS.entries()) {
  for (const other of LOCATIONS.slice(index + 1)) {
    const overlap = location.x < other.x + other.w && location.x + location.w > other.x && location.y < other.y + other.h && location.y + location.h > other.y;
    assert.equal(overlap, false, `Regions ${location.id} and ${other.id} do not overlap`);
  }
}
for (const road of MAP_ROADS) for (const [x, y] of road) assert.ok(x >= 0 && x <= WORLD_WIDTH && y >= 0 && y <= WORLD_HEIGHT, 'Road points stay inside the world');
assert.equal(REGION_ENTRANCES.length, LOCATIONS.length, 'Every region defines an entrance');
const containsPoint = (points: Array<[number, number]>, x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]; const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
for (const entrance of REGION_ENTRANCES) {
  const shape = MAP_SHAPES.find((entry) => entry.id === entrance.id)!;
  const points = shape.points.split(' ').map((pair) => pair.split(',').map(Number) as [number, number]);
  assert.ok(containsPoint(points, entrance.x, entrance.y), `Entrance for ${entrance.id} lies inside its region`);
}
for (const rift of RIFT_POINTS) assert.ok(rift.x >= 0 && rift.x <= WORLD_WIDTH && rift.y >= 0 && rift.y <= WORLD_HEIGHT, `Rift ${rift.id} stays inside the world`);
assert.equal(BUILDINGS.length, 9, 'Nine world buildings are defined');
assert.ok(BUILDINGS.every((building) => Boolean(building.interior)), 'Every visible building is enterable');
for (const building of BUILDINGS) {
  assert.ok(INTERIORS.some((interior) => interior.id === building.interior), `Building ${building.id} points to a valid interior`);
  assert.ok(Math.abs(building.doorX) <= building.w / 2 - 32, `Door for ${building.id} leaves a navigable opening`);
}

const weaponIds = new Set(WEAPONS.map((item) => item.id));
const questIds = new Set(QUESTS.map((item) => item.id));
const npcIds = new Set(NPCS.map((item) => item.id));
const enemyIds = new Set(Object.keys(ENEMIES));
const itemIds = new Set(ITEMS.map((item) => item.id));
unique(ITEMS.map((item) => item.id), 'Items');

for (const quest of QUESTS) {
  assert.ok(npcIds.has(quest.giver), `Quest ${quest.id} has a valid giver`);
  if (quest.prerequisite) assert.ok(questIds.has(quest.prerequisite), `Quest ${quest.id} has a valid prerequisite`);
  assert.ok(quest.objectives.length > 0, `Quest ${quest.id} has objectives`);
  for (const objective of quest.objectives) {
    assert.ok(objective.amount > 0, `Objective ${objective.target} has a positive amount`);
    if (objective.type === 'purchase') assert.ok(weaponIds.has(objective.target), `Purchase target ${objective.target} exists`);
    if (objective.type === 'kill') assert.ok(enemyIds.has(objective.target), `Enemy target ${objective.target} exists`);
  }
  for (const reward of quest.reward.items ?? []) assert.ok(itemIds.has(reward.itemId), `Quest reward ${reward.itemId} exists`);
}
for (const enemy of Object.values(ENEMIES)) {
  for (const drop of enemy.drops ?? []) assert.ok(itemIds.has(drop.itemId), `Enemy drop ${drop.itemId} exists`);
}

for (const tier of BATTLE_PASS) {
  if (tier.weapon) assert.ok(weaponIds.has(tier.weapon), `Tier ${tier.tier} weapon exists`);
}

const totalReputation = QUESTS.reduce((sum, quest) => sum + quest.reward.reputation, 0);
assert.ok(Math.max(...BATTLE_PASS.map((tier) => tier.reputation)) <= totalReputation, 'Every battle-pass tier is reachable');

const witchbow = WEAPONS.find((weapon) => weapon.id === 'witchbow')!;
const prePurchaseGold = 35 + QUESTS.filter((quest) => ['first_oath', 'grave_silence'].includes(quest.id)).reduce((sum, quest) => sum + quest.reward.coins, 0);
assert.ok(prePurchaseGold >= witchbow.price, 'The required Witch Crossbow is affordable before its quest');

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
});
Object.defineProperty(globalThis, 'window', { value: globalThis });

storage.set('trupy-save-v1', JSON.stringify({ version: 1, coins: 777, potions: 4, ownedWeapons: ['rustblade', 'witchbow'], equippedWeapon: 'witchbow', questProgress: { first_oath: { status: 'completed', objectiveIndex: 0, amount: 3 } }, settings: { sound: true, reducedMotion: false } }));
const migrated = new SaveSystem().get();
assert.equal(migrated.version, 3, 'Version 1 save migrates to the current schema version');
assert.equal(migrated.coins, 777, 'Migration preserves currency');
assert.equal(migrated.equippedWeapon, 'witchbow', 'Migration preserves equipped weapon');
assert.equal(migrated.inventory.find((stack) => stack.itemId === 'blood_vial')?.quantity, 4, 'Migration converts potions into inventory stacks');
assert.equal(migrated.questProgress.first_oath.status, 'completed', 'Migration preserves quest progress');
// v3 fields backfill from defaults when absent in an older save.
assert.deepEqual(migrated.weaponUpgrades, {}, 'Migration backfills weapon upgrades');
assert.deepEqual(migrated.bestiary, {}, 'Migration backfills the bestiary');
assert.deepEqual(migrated.achievements, [], 'Migration backfills achievements');
assert.equal(migrated.stats.totalKills, 0, 'Migration backfills skill stats');
storage.clear();

// A v2 save (no crafting/bestiary/achievement keys) also upgrades cleanly and
// keeps its existing data, proving the v2 -> v3 path loses nothing.
storage.set('trupy-save-v1', JSON.stringify({ version: 2, coins: 210, reputation: 6, ownedWeapons: ['rustblade', 'graveaxe'], equippedWeapon: 'graveaxe', inventory: [{ itemId: 'ash_crystal', quantity: 5 }], claimedTiers: [1, 2] }));
const migratedV2 = new SaveSystem().get();
assert.equal(migratedV2.version, 3, 'Version 2 save migrates to version 3');
assert.equal(migratedV2.coins, 210, 'v2 migration preserves currency');
assert.equal(migratedV2.equippedWeapon, 'graveaxe', 'v2 migration preserves equipped weapon');
assert.equal(migratedV2.inventory.find((stack) => stack.itemId === 'ash_crystal')?.quantity, 5, 'v2 migration preserves inventory materials');
assert.deepEqual(migratedV2.claimedTiers, [1, 2], 'v2 migration preserves claimed tiers');
assert.deepEqual(migratedV2.weaponUpgrades, {}, 'v2 migration backfills weapon upgrades');
storage.clear();

const saves = new SaveSystem();
const questSystem = new QuestSystem(saves);
const inventory = new InventorySystem(saves);
inventory.add('grave_warden_mail', 1, true);
assert.ok(inventory.equip('grave_warden_mail'), 'Armor can be equipped');
assert.equal(inventory.armor(), 5, 'Equipped armor affects defense');
assert.ok(inventory.transfer('bone_shard', 2, 'toInventory'), 'Items can move from the home chest');
assert.equal(inventory.quantity('bone_shard'), 2, 'Transferred items reach the inventory');
saves.mutate((save) => { save.health = 40; }, true);
assert.ok(inventory.use('blood_vial').used, 'Consumables can be used');
assert.ok(saves.get().health > 40, 'Healing consumable restores health');
const shop = new WeaponShopSystem(saves);
saves.mutate((save) => { save.coins = 1000; save.reputation = 20; }, true);
const coinsBeforePurchase = saves.get().coins;
const purchase = shop.purchase('graveaxe');
assert.ok(purchase.ok, 'Weapon can be purchased with earned gold');
assert.equal(saves.get().coins, coinsBeforePurchase - 90, 'Purchase deducts the exact gold price');
assert.ok(saves.get().ownedWeapons.includes('graveaxe'), 'Purchased weapon is added to the collection');
assert.equal(saves.get().equippedWeapon, 'graveaxe', 'Purchased weapon is equipped immediately');
assert.equal(shop.purchase('graveaxe').ok, false, 'A weapon cannot be purchased twice');
saves.mutate((save) => { save.reputation = 0; }, true);
const finish = (id: string, events: Array<[ObjectiveType, string, number]>) => {
  assert.ok(questSystem.accept(id), `Quest ${id} can be accepted`);
  for (const [type, target, amount] of events) questSystem.record(type, target, amount);
  assert.equal(saves.get().questProgress[id]?.status, 'ready', `Quest ${id} becomes ready`);
  assert.ok(questSystem.turnIn(id), `Quest ${id} can be turned in`);
};

finish('first_oath', [['collect', 'moonwort', 3]]);
finish('lost_charm', [['collect', 'charm', 1]]);
finish('grave_silence', [['kill', 'husk', 4]]);
finish('wolf_debt', [['kill', 'direwolf', 3]]);
finish('last_lights', [['interact', 'lantern', 3]]);
saves.mutate((save) => save.ownedWeapons.push('witchbow'), true);
finish('iron_answer', [['purchase', 'witchbow', 1], ['kill', 'boneguard', 3]]);
finish('witch_trail', [['collect', 'shadebloom', 4], ['interact', 'forest_altar', 1]]);
finish('heart_of_ruin', [['visit', 'ruins', 1], ['kill', 'nameless', 1]]);
finish('ferryman_cargo', [['collect', 'ferryman_cargo', 3]]);
finish('bog_brew', [['collect', 'glowcap', 5]]);
finish('blackwater_call', [['collect', 'bog_reed', 4], ['kill', 'bogling', 4]]);
finish('lost_tools', [['collect', 'miner_tools', 1]]);
finish('mine_echo', [['visit', 'mines', 1], ['kill', 'cavecrawler', 4], ['interact', 'mine_lift', 1]]);
finish('ash_crown', [['visit', 'citadel', 1], ['kill', 'cinderlord', 1]]);

assert.equal(saves.get().reputation, 22, 'Full quest route reaches the final battle-pass tier');
assert.equal(saves.get().questProgress.ash_crown.status, 'completed', 'Expanded main story can be completed');
assert.ok(saves.get().coins >= 0, 'Economy remains non-negative through the tested route');

console.log(`Data and quest-flow checks passed: ${QUESTS.length} quests, ${WEAPONS.length} weapons, ${NPCS.length} NPCs, ${BATTLE_PASS.length} pass tiers.`);
