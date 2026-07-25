import { WEAPONS } from '../data/content';
import { addStack, getItem, removeStack, stackQuantity } from '../data/items';
import type { InventoryStack, ItemCategory, PlayerSave } from '../game/types';
import type { SaveSystem } from './SaveSystem';

export interface UseItemResult {
  used: boolean;
  message: string;
  effect?: 'heal' | 'smoke';
}

export class InventorySystem {
  constructor(private readonly saves: SaveSystem) {}

  add(itemId: string, quantity = 1, immediate = false): void {
    const weapon = WEAPONS.find((entry) => entry.id === itemId);
    this.saves.mutate((save) => {
      if (weapon) {
        if (!save.ownedWeapons.includes(itemId)) save.ownedWeapons.push(itemId);
      } else {
        save.inventory = addStack(save.inventory, itemId, quantity);
        if (itemId === 'blood_vial') save.potions = stackQuantity(save.inventory, 'blood_vial');
      }
    }, immediate);
  }

  remove(itemId: string, quantity = 1, immediate = false): boolean {
    const save = this.saves.get();
    if (stackQuantity(save.inventory, itemId) < quantity) return false;
    this.saves.mutate((state) => {
      state.inventory = removeStack(state.inventory, itemId, quantity);
      if (itemId === 'blood_vial') state.potions = stackQuantity(state.inventory, 'blood_vial');
    }, immediate);
    return true;
  }

  quantity(itemId: string): number {
    return stackQuantity(this.saves.get().inventory, itemId);
  }

  equip(itemId: string): boolean {
    const weapon = WEAPONS.find((entry) => entry.id === itemId);
    const item = getItem(itemId);
    const save = this.saves.get();
    if (weapon) {
      if (!save.ownedWeapons.includes(itemId)) return false;
      this.saves.mutate((state) => {
        state.equippedWeapon = itemId;
        state.equipment.weapon = itemId;
      }, true);
      return true;
    }
    if (!item || this.quantity(itemId) < 1) return false;
    if (item.category !== 'armor' && item.category !== 'amulet') return false;
    this.saves.mutate((state) => {
      if (item.category === 'armor') state.equipment.armor = itemId;
      else state.equipment.amulet = itemId;
    }, true);
    return true;
  }

  use(itemId: string): UseItemResult {
    const item = getItem(itemId);
    const save = this.saves.get();
    if (!item || item.category !== 'consumable' || this.quantity(itemId) < 1) return { used: false, message: 'Предмет нельзя использовать' };
    if (item.heal && save.health >= this.maxHealth()) return { used: false, message: 'Здоровье уже полное' };
    this.saves.mutate((state) => {
      state.inventory = removeStack(state.inventory, itemId, 1);
      if (item.heal) state.health = Math.min(this.maxHealth(state), state.health + item.heal);
      state.potions = stackQuantity(state.inventory, 'blood_vial');
    }, true);
    return { used: true, message: item.heal ? `Восстановлено ${item.heal} здоровья` : 'Дым скрывает ваш след', effect: item.heal ? 'heal' : 'smoke' };
  }

  transfer(itemId: string, quantity: number, direction: 'toChest' | 'toInventory'): boolean {
    const save = this.saves.get();
    const from = direction === 'toChest' ? save.inventory : save.chest;
    if (stackQuantity(from, itemId) < quantity) return false;
    this.saves.mutate((state) => {
      if (direction === 'toChest') {
        state.inventory = removeStack(state.inventory, itemId, quantity);
        state.chest = addStack(state.chest, itemId, quantity);
      } else {
        state.chest = removeStack(state.chest, itemId, quantity);
        state.inventory = addStack(state.inventory, itemId, quantity);
      }
      state.potions = stackQuantity(state.inventory, 'blood_vial');
    }, true);
    return true;
  }

  stacks(category?: ItemCategory): InventoryStack[] {
    const save = this.saves.get();
    if (!category) return save.inventory;
    if (category === 'weapon') return save.ownedWeapons.map((itemId) => ({ itemId, quantity: 1 }));
    return save.inventory.filter((stack) => getItem(stack.itemId)?.category === category);
  }

  armor(save: PlayerSave = this.saves.get()): number {
    return getItem(save.equipment.armor ?? '')?.armor ?? 0;
  }

  damageBonus(save: PlayerSave = this.saves.get()): number {
    return getItem(save.equipment.amulet ?? '')?.damageBonus ?? 0;
  }

  speedBonus(save: PlayerSave = this.saves.get()): number {
    return getItem(save.equipment.amulet ?? '')?.speedBonus ?? 0;
  }

  maxHealth(save: PlayerSave = this.saves.get()): number {
    return save.maxHealth + this.armor(save) * 4;
  }
}
