import { WEAPONS } from '../data/content';
import type { WeaponDefinition } from '../game/types';
import type { SaveSystem } from './SaveSystem';

export interface PurchaseResult {
  ok: boolean;
  message: string;
  weapon?: WeaponDefinition;
}

export class WeaponShopSystem {
  constructor(private readonly saves: SaveSystem) {}

  purchase(weaponId: string): PurchaseResult {
    const weapon = WEAPONS.find((entry) => entry.id === weaponId);
    const save = this.saves.get();
    if (!weapon || weapon.price <= 0) return { ok: false, message: 'Это оружие нельзя купить' };
    if (save.ownedWeapons.includes(weaponId)) return { ok: false, message: 'Оружие уже принадлежит вам', weapon };
    if (save.reputation < weapon.requiredRep) return { ok: false, message: `Нужна репутация ${weapon.requiredRep}`, weapon };
    if (save.coins < weapon.price) return { ok: false, message: `Не хватает ${weapon.price - save.coins} золота`, weapon };
    this.saves.mutate((state) => {
      state.coins -= weapon.price;
      state.ownedWeapons.push(weaponId);
      state.equippedWeapon = weaponId;
      state.equipment.weapon = weaponId;
    }, true);
    return { ok: true, message: `Куплено за ${weapon.price} золота: ${weapon.name}`, weapon };
  }

  purchasable(): WeaponDefinition[] {
    return WEAPONS.filter((weapon) => weapon.price > 0);
  }
}
