import assert from 'node:assert/strict';
import { BATTLE_PASS, ENEMIES, NPCS, QUESTS, WEAPONS } from '../src/data/content';

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

console.log(`Data checks passed: ${QUESTS.length} quests, ${WEAPONS.length} weapons, ${NPCS.length} NPCs, ${BATTLE_PASS.length} pass tiers.`);
