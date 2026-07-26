import { WEAPONS } from '../data/content';
import {
  MAX_WEAPON_UPGRADE,
  RECIPES,
  WEAPON_UPGRADE_TIERS,
  getRecipe,
  upgradeDamagePct,
} from '../data/crafting';
import { getItem } from '../data/items';
import type { CraftingRecipe, InventoryStack, WeaponUpgradeTier } from '../game/types';
import type { InventorySystem } from './InventorySystem';
import type { SaveSystem } from './SaveSystem';

export interface CraftResult {
  ok: boolean;
  message: string;
}

export interface UpgradeCost {
  level: number; // the level this cost buys (current + 1)
  coins: number;
  materials: InventoryStack[];
  damageBonusPct: number;
}

// Re-exported so callers (and tests) can pull recipe/upgrade data straight from
// the system module without also reaching into data/crafting.
export { RECIPES, WEAPON_UPGRADE_TIERS, MAX_WEAPON_UPGRADE } from '../data/crafting';

/**
 * Crafting + weapon reinforcement.
 *
 * The system owns two related loops that both consume the six material types:
 *  - recipes (materials + coins -> a consumable/equipment item), and
 *  - weapon upgrades (materials + coins -> +1 reinforcement, persisted per weapon).
 *
 * It reads the player's material stock through InventorySystem so it shares the
 * exact same stacking/removal rules as the rest of the game, and it writes
 * upgrade levels into save.weaponUpgrades (a v3 field defaulted to {}).
 */
export class CraftingSystem {
  constructor(
    private readonly saves: SaveSystem,
    private readonly inventory: InventorySystem,
  ) {}

  // ---- recipes ----------------------------------------------------------

  listRecipes(): CraftingRecipe[] {
    return RECIPES;
  }

  getRecipe(recipeId: string): CraftingRecipe | undefined {
    return getRecipe(recipeId);
  }

  // Does the player currently have the materials, coins and reputation for it?
  canCraft(recipeId: string): boolean {
    const recipe = getRecipe(recipeId);
    if (!recipe) return false;
    const save = this.saves.get();
    if (recipe.requiredRep && save.reputation < recipe.requiredRep) return false;
    if (recipe.coins && save.coins < recipe.coins) return false;
    return recipe.materials.every((mat) => this.inventory.quantity(mat.itemId) >= mat.quantity);
  }

  // Human-readable reason crafting is blocked (or empty string if craftable).
  private craftBlockReason(recipe: CraftingRecipe): string {
    const save = this.saves.get();
    if (recipe.requiredRep && save.reputation < recipe.requiredRep) return `Нужна репутация ${recipe.requiredRep}`;
    if (recipe.coins && save.coins < recipe.coins) return `Не хватает ${recipe.coins - save.coins} золота`;
    const missing = recipe.materials.find((mat) => this.inventory.quantity(mat.itemId) < mat.quantity);
    if (missing) {
      const item = getItem(missing.itemId);
      const have = this.inventory.quantity(missing.itemId);
      return `Нужно ещё ${missing.quantity - have} — ${item?.name ?? missing.itemId}`;
    }
    return '';
  }

  craft(recipeId: string): CraftResult {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { ok: false, message: 'Неизвестный рецепт' };
    const blocked = this.craftBlockReason(recipe);
    if (blocked) return { ok: false, message: blocked };

    // Spend materials + coins, then grant the output. Weapons are never recipe
    // outputs (only items in items.ts are), so inventory.add handles everything.
    for (const mat of recipe.materials) this.inventory.remove(mat.itemId, mat.quantity, false);
    if (recipe.coins) this.saves.mutate((state) => { state.coins -= recipe.coins!; }, false);
    this.inventory.add(recipe.output.itemId, recipe.output.quantity, false);
    this.saves.mutate((state) => { state.stats.itemsCrafted += 1; }, true);

    const item = getItem(recipe.output.itemId);
    return { ok: true, message: `Создано: ${item?.name ?? recipe.output.itemId}` };
  }

  // ---- weapon upgrades --------------------------------------------------

  // Current reinforcement level for a weapon (0 if never upgraded / unknown key).
  upgradeLevel(weaponId: string): number {
    return this.saves.get().weaponUpgrades[weaponId] ?? 0;
  }

  private tierFor(level: number): WeaponUpgradeTier | undefined {
    return WEAPON_UPGRADE_TIERS.find((tier) => tier.level === level);
  }

  // Cost of the NEXT upgrade for a weapon, or undefined at max level / unknown weapon.
  upgradeCost(weaponId: string): UpgradeCost | undefined {
    const weapon = WEAPONS.find((entry) => entry.id === weaponId);
    if (!weapon) return undefined;
    const next = this.upgradeLevel(weaponId) + 1;
    if (next > MAX_WEAPON_UPGRADE) return undefined;
    const tier = this.tierFor(next);
    if (!tier) return undefined;
    return {
      level: next,
      coins: tier.coins,
      materials: tier.materials.map((mat) => ({ ...mat })),
      damageBonusPct: tier.damageBonusPct,
    };
  }

  canUpgrade(weaponId: string): boolean {
    const save = this.saves.get();
    // The weapon must actually be owned before it can be reinforced.
    if (!save.ownedWeapons.includes(weaponId)) return false;
    const cost = this.upgradeCost(weaponId);
    if (!cost) return false; // at max, or unknown weapon
    if (save.coins < cost.coins) return false;
    return cost.materials.every((mat) => this.inventory.quantity(mat.itemId) >= mat.quantity);
  }

  upgradeWeapon(weaponId: string): CraftResult {
    const weapon = WEAPONS.find((entry) => entry.id === weaponId);
    if (!weapon) return { ok: false, message: 'Неизвестное оружие' };
    const save = this.saves.get();
    if (!save.ownedWeapons.includes(weaponId)) return { ok: false, message: 'Сначала нужно владеть оружием' };
    const cost = this.upgradeCost(weaponId);
    if (!cost) return { ok: false, message: `${weapon.name} уже усилено до предела` };
    if (save.coins < cost.coins) return { ok: false, message: `Не хватает ${cost.coins - save.coins} золота` };
    const missing = cost.materials.find((mat) => this.inventory.quantity(mat.itemId) < mat.quantity);
    if (missing) {
      const item = getItem(missing.itemId);
      const have = this.inventory.quantity(missing.itemId);
      return { ok: false, message: `Нужно ещё ${missing.quantity - have} — ${item?.name ?? missing.itemId}` };
    }

    for (const mat of cost.materials) this.inventory.remove(mat.itemId, mat.quantity, false);
    this.saves.mutate((state) => {
      state.coins -= cost.coins;
      state.weaponUpgrades[weaponId] = cost.level;
      state.stats.weaponsUpgraded += 1;
    }, true);

    return { ok: true, message: `${weapon.name} усилено до +${cost.level}` };
  }

  // Effective damage of a weapon = base damage + reinforcement percentage.
  // Rounded so combat maths stays on whole numbers like the base values.
  weaponDamage(weaponId: string): number {
    const weapon = WEAPONS.find((entry) => entry.id === weaponId);
    if (!weapon) return 0;
    const pct = upgradeDamagePct(this.upgradeLevel(weaponId));
    return Math.round(weapon.damage * (1 + pct / 100));
  }

  // Convenience for UI: how much raw damage the reinforcement adds on its own.
  upgradeDamageBonus(weaponId: string): number {
    return this.weaponDamage(weaponId) - (WEAPONS.find((entry) => entry.id === weaponId)?.damage ?? 0);
  }
}
