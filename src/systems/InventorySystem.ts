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

  // ---- quick slots ------------------------------------------------------
  // save.equipment.quick is a fixed 3-slot bar of nullable item ids. It is
  // saved/loaded but was never wired to any usage logic; these three methods are
  // that logic. Only *consumables* may be assigned — the bar is for potions and
  // the smoke bomb, not armour or materials.

  /** Number of quick slots. Mirrors the save's fixed-length array. */
  static readonly QUICK_SLOTS = 3;

  /** The current quick bar, always normalised to exactly QUICK_SLOTS entries. */
  quickSlots(save: PlayerSave = this.saves.get()): Array<string | null> {
    const slots = save.equipment.quick ?? [];
    return Array.from({ length: InventorySystem.QUICK_SLOTS }, (_, index) => slots[index] ?? null);
  }

  private isValidSlot(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < InventorySystem.QUICK_SLOTS;
  }

  /**
   * Assign a consumable to a quick slot. Rejects non-consumables and unknown
   * items. Returns true on success. Assigning an item already in another slot
   * moves it there (no duplicate binding), which keeps the small bar tidy.
   */
  setQuickSlot(index: number, itemId: string): boolean {
    if (!this.isValidSlot(index)) return false;
    const item = getItem(itemId);
    if (!item || item.category !== 'consumable') return false;
    this.saves.mutate((state) => {
      const quick = this.quickSlots(state);
      // Remove the item from any other slot so it lives in exactly one place.
      for (let slot = 0; slot < quick.length; slot += 1) {
        if (quick[slot] === itemId) quick[slot] = null;
      }
      quick[index] = itemId;
      state.equipment.quick = quick;
    }, true);
    return true;
  }

  /** Clear a quick slot. Returns true if the index was valid. */
  clearQuickSlot(index: number): boolean {
    if (!this.isValidSlot(index)) return false;
    this.saves.mutate((state) => {
      const quick = this.quickSlots(state);
      quick[index] = null;
      state.equipment.quick = quick;
    }, true);
    return true;
  }

  /**
   * Use the consumable bound to a quick slot. Returns the SAME result shape as
   * `use()` so scenes can treat quick-slot use exactly like any other item use
   * (heal glow, smoke bomb, toast). An empty or invalid slot returns a friendly
   * not-usable result rather than throwing.
   */
  useQuickSlot(index: number): UseItemResult {
    if (!this.isValidSlot(index)) return { used: false, message: 'Ячейка недоступна' };
    const itemId = this.quickSlots()[index];
    if (!itemId) return { used: false, message: 'Ячейка пуста' };
    return this.use(itemId);
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
