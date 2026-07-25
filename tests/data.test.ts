import assert from 'node:assert/strict';
import { BATTLE_PASS, ENEMIES, NPCS, QUESTS, WEAPONS } from '../src/data/content';
import { QuestSystem } from '../src/systems/QuestSystem';
import { SaveSystem } from '../src/systems/SaveSystem';
import type { ObjectiveType } from '../src/game/types';

const unique = (values: string[], label: string) => {
  assert.equal(new Set(values).size, values.length, `${label} must contain unique ids`);
};

unique(WEAPONS.map((item) => item.id), 'Weapons');
unique(QUESTS.map((item) => item.id), 'Quests');
unique(NPCS.map((item) => item.id), 'NPCs');
unique(BATTLE_PASS.map((item) => String(item.tier)), 'Battle-pass tiers');

const weaponIds = new Set(WEAPONS.map((item) => item.id));
const questIds = new Set(QUESTS.map((item) => item.id));
const npcIds = new Set(NPCS.map((item) => item.id));
const enemyIds = new Set(Object.keys(ENEMIES));

for (const quest of QUESTS) {
  assert.ok(npcIds.has(quest.giver), `Quest ${quest.id} has a valid giver`);
  if (quest.prerequisite) assert.ok(questIds.has(quest.prerequisite), `Quest ${quest.id} has a valid prerequisite`);
  assert.ok(quest.objectives.length > 0, `Quest ${quest.id} has objectives`);
  for (const objective of quest.objectives) {
    assert.ok(objective.amount > 0, `Objective ${objective.target} has a positive amount`);
    if (objective.type === 'purchase') assert.ok(weaponIds.has(objective.target), `Purchase target ${objective.target} exists`);
    if (objective.type === 'kill') assert.ok(enemyIds.has(objective.target), `Enemy target ${objective.target} exists`);
  }
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

const saves = new SaveSystem();
const questSystem = new QuestSystem(saves);
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

assert.equal(saves.get().reputation, 12, 'Full quest route reaches the final battle-pass tier');
assert.equal(saves.get().questProgress.heart_of_ruin.status, 'completed', 'Main story can be completed');
assert.ok(saves.get().coins >= 0, 'Economy remains non-negative through the tested route');

console.log(`Data and quest-flow checks passed: ${QUESTS.length} quests, ${WEAPONS.length} weapons, ${NPCS.length} NPCs, ${BATTLE_PASS.length} pass tiers.`);
