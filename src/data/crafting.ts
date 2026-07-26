import type { CraftingRecipe, WeaponUpgradeTier } from '../game/types';

// ---------------------------------------------------------------------------
// Weapon reinforcement (blacksmith Runa).
//
// Balance intent: upgrades are a *supplementary* sink for the six material
// types, not a gate in front of weapon purchases. Fully maxing ONE weapon costs
// 410 coins total (25+45+70+110+160) — cheaper than the second-tier Graveaxe
// (90) is deliberately NOT true; instead the coin cost is deliberately kept
// well below the ~1915 total quest gold so a player can still afford new
// weapons. The real cost is materials, which otherwise pile up as dead weight.
//
// Damage bonus is a *cumulative* percentage of the weapon's base damage, so the
// same tier ladder feels proportional on a 24-damage Rustblade and an 86-damage
// Cinderbrand. +5 caps at +50% (e.g. Rustblade 24 -> 36, Cinderbrand 86 -> 129).
// The percentage is intentionally below what a full weapon-tier jump gives, so
// buying the next weapon stays the stronger play — upgrading smooths the gap.
// ---------------------------------------------------------------------------
export const WEAPON_UPGRADE_TIERS: WeaponUpgradeTier[] = [
  { level: 1, coins: 25, damageBonusPct: 8, materials: [{ itemId: 'bone_shard', quantity: 3 }] },
  { level: 2, coins: 45, damageBonusPct: 16, materials: [{ itemId: 'bone_shard', quantity: 4 }, { itemId: 'mine_ore', quantity: 2 }] },
  { level: 3, coins: 70, damageBonusPct: 25, materials: [{ itemId: 'mine_ore', quantity: 3 }, { itemId: 'wolf_pelt', quantity: 2 }] },
  { level: 4, coins: 110, damageBonusPct: 35, materials: [{ itemId: 'mine_ore', quantity: 3 }, { itemId: 'ash_crystal', quantity: 2 }] },
  { level: 5, coins: 160, damageBonusPct: 50, materials: [{ itemId: 'ash_crystal', quantity: 3 }, { itemId: 'glowcap', quantity: 2 }] },
];

export const MAX_WEAPON_UPGRADE = WEAPON_UPGRADE_TIERS.length;

// Cumulative damage percentage granted by owning `level` reinforcements.
export const upgradeDamagePct = (level: number): number => {
  if (level <= 0) return 0;
  const tier = WEAPON_UPGRADE_TIERS[Math.min(level, MAX_WEAPON_UPGRADE) - 1];
  return tier ? tier.damageBonusPct : 0;
};

// ---------------------------------------------------------------------------
// Recipes.
//
// These turn materials into consumables and equipment so every material type
// has a real drain:
//   - glowcap -> blood_vial / greater_vial (potions from foraged mushrooms)
//   - bog_reed + glowcap -> greater_vial   (the "strong potion" the reeds hint at)
//   - wolf_pelt -> traveler_coat            (light armour from pelts)
//   - ash_crystal + mine_ore + bone_shard -> grave_warden_mail (mid armour)
//   - ash_crystal x + mine_ore -> cinder_plate is intentionally NOT craftable
//     (that stays a boss drop / late reward) to protect progression.
//
// Coin costs are token amounts — the recipes are meant to be reachable from
// farmed materials, not a second economy. Every output item already exists in
// items.ts, so the data tests' item-id checks pass unchanged.
// ---------------------------------------------------------------------------
export const RECIPES: CraftingRecipe[] = [
  {
    id: 'craft_blood_vial',
    name: 'Зелье крови',
    description: 'Светогриб растереть в кровяную взвесь — простейшее лечебное зелье.',
    kind: 'consumable',
    station: 'runa',
    materials: [{ itemId: 'glowcap', quantity: 1 }],
    coins: 6,
    output: { itemId: 'blood_vial', quantity: 1 },
  },
  {
    id: 'craft_greater_vial',
    name: 'Большое зелье',
    description: 'Болотный тростник со светогрибом дают густой отвар, что затягивает даже глубокие раны.',
    kind: 'consumable',
    station: 'iva',
    materials: [{ itemId: 'bog_reed', quantity: 2 }, { itemId: 'glowcap', quantity: 1 }],
    coins: 14,
    output: { itemId: 'greater_vial', quantity: 1 },
  },
  {
    id: 'craft_smoke_bomb',
    name: 'Дымная сфера',
    description: 'Осколок кости и щепоть чёрной руды — хлопок дыма, чтобы уйти от беды.',
    kind: 'consumable',
    station: 'iva',
    materials: [{ itemId: 'bone_shard', quantity: 2 }, { itemId: 'mine_ore', quantity: 1 }],
    coins: 10,
    output: { itemId: 'smoke_bomb', quantity: 1 },
  },
  {
    id: 'craft_traveler_coat',
    name: 'Плащ странника',
    description: 'Две волчьи шкуры сшиваются в плотный дорожный плащ.',
    kind: 'equipment',
    station: 'runa',
    materials: [{ itemId: 'wolf_pelt', quantity: 2 }],
    coins: 20,
    output: { itemId: 'traveler_coat', quantity: 1 },
  },
  {
    id: 'craft_grave_mail',
    name: 'Кольчуга смотрителя',
    description: 'Пепельный кристалл, чёрная руда и кости — кузнец Руна куёт тяжёлую кольчугу.',
    kind: 'equipment',
    station: 'runa',
    materials: [
      { itemId: 'ash_crystal', quantity: 2 },
      { itemId: 'mine_ore', quantity: 3 },
      { itemId: 'bone_shard', quantity: 4 },
    ],
    coins: 90,
    requiredRep: 5,
    output: { itemId: 'grave_warden_mail', quantity: 1 },
  },
  {
    id: 'craft_wolf_fang',
    name: 'Клык искажённого волка',
    description: 'Клык и шкура волка на костяной оправе — оберег, ускоряющий шаг.',
    kind: 'equipment',
    station: 'runa',
    materials: [{ itemId: 'wolf_pelt', quantity: 3 }, { itemId: 'bone_shard', quantity: 2 }],
    coins: 45,
    requiredRep: 2,
    output: { itemId: 'wolf_fang', quantity: 1 },
  },
];

export const getRecipe = (id: string): CraftingRecipe | undefined => RECIPES.find((recipe) => recipe.id === id);
