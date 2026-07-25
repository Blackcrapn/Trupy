import type { InventoryStack, ItemDefinition, ItemRarity } from '../game/types';

export const ITEMS: ItemDefinition[] = [
  { id: 'blood_vial', name: 'Зелье крови', description: 'Восстанавливает 48 здоровья.', category: 'consumable', rarity: 'common', icon: '♥', stackLimit: 9, value: 24, heal: 48 },
  { id: 'greater_vial', name: 'Большое зелье', description: 'Восстанавливает 90 здоровья.', category: 'consumable', rarity: 'rare', icon: '✚', stackLimit: 5, value: 68, heal: 90 },
  { id: 'smoke_bomb', name: 'Дымная сфера', description: 'Отталкивает ближайших врагов и даёт передышку.', category: 'consumable', rarity: 'uncommon', icon: '●', stackLimit: 6, value: 45 },
  { id: 'traveler_coat', name: 'Плащ странника', description: 'Плотная ткань смягчает слабые удары.', category: 'armor', rarity: 'common', icon: '♜', stackLimit: 1, value: 55, armor: 2 },
  { id: 'grave_warden_mail', name: 'Кольчуга смотрителя', description: 'Старая кольчуга с кладбищенскими печатями.', category: 'armor', rarity: 'rare', icon: '▦', stackLimit: 1, value: 180, armor: 5 },
  { id: 'cinder_plate', name: 'Пепельный панцирь', description: 'Тяжёлая броня павших стражей цитадели.', category: 'armor', rarity: 'epic', icon: '▣', stackLimit: 1, value: 390, armor: 8 },
  { id: 'wolf_fang', name: 'Клык искажённого волка', description: 'Ускоряет шаги владельца.', category: 'amulet', rarity: 'uncommon', icon: '⌁', stackLimit: 1, value: 90, speedBonus: 10 },
  { id: 'moon_charm', name: 'Лунный оберег', description: 'Добавляет силу атакам в темноте.', category: 'amulet', rarity: 'rare', icon: '☾', stackLimit: 1, value: 180, damageBonus: 5 },
  { id: 'ember_eye', name: 'Око углей', description: 'Редкая печать, усиливающая любое оружие.', category: 'amulet', rarity: 'legendary', icon: '◉', stackLimit: 1, value: 600, damageBonus: 11 },
  { id: 'bone_shard', name: 'Осколок кости', description: 'Материал для усиления оружия.', category: 'material', rarity: 'common', icon: '⌇', stackLimit: 30, value: 8 },
  { id: 'wolf_pelt', name: 'Шкура волка', description: 'Тёплая и всё ещё пахнет лесом.', category: 'material', rarity: 'common', icon: '≈', stackLimit: 20, value: 12 },
  { id: 'bog_reed', name: 'Болотный тростник', description: 'Ингредиент для сильных зелий.', category: 'material', rarity: 'uncommon', icon: '⌇', stackLimit: 20, value: 18 },
  { id: 'glowcap', name: 'Светогриб', description: 'Холодно светится даже в закрытой сумке.', category: 'material', rarity: 'rare', icon: '♠', stackLimit: 20, value: 28 },
  { id: 'ash_crystal', name: 'Пепельный кристалл', description: 'Горячий осколок из глубин цитадели.', category: 'material', rarity: 'rare', icon: '♦', stackLimit: 15, value: 38 },
  { id: 'mine_ore', name: 'Чёрная руда', description: 'Тяжёлый металл из Старых шахт.', category: 'material', rarity: 'uncommon', icon: '◆', stackLimit: 20, value: 24 },
  { id: 'moonwort', name: 'Лунная полынь', description: 'Светящаяся трава для ритуалов.', category: 'quest', rarity: 'uncommon', icon: '♧', stackLimit: 20, value: 0 },
  { id: 'shadebloom', name: 'Цветок тени', description: 'На лепестках выступает холодный иней.', category: 'quest', rarity: 'rare', icon: '✿', stackLimit: 20, value: 0 },
  { id: 'widow_charm', name: 'Медальон Элиры', description: 'Семейная реликвия с выцветшим портретом.', category: 'quest', rarity: 'rare', icon: '◈', stackLimit: 1, value: 0 },
  { id: 'ferryman_cargo', name: 'Запечатанный груз', description: 'Ящик перевозчика, который не стоит открывать.', category: 'quest', rarity: 'epic', icon: '▤', stackLimit: 3, value: 0 },
  { id: 'miner_tools', name: 'Инструменты шахтёра', description: 'Кирка и лампа, покрытые чёрной пылью.', category: 'quest', rarity: 'uncommon', icon: '⚒', stackLimit: 1, value: 0 },
  { id: 'citadel_seal', name: 'Печать цитадели', description: 'Открывает ворота Пепельной цитадели.', category: 'quest', rarity: 'epic', icon: '✹', stackLimit: 1, value: 0 },
];

export const RARITY_LABEL: Record<ItemRarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

export const RARITY_COLOR: Record<ItemRarity, string> = {
  common: '#a9adb8',
  uncommon: '#78bf91',
  rare: '#72a5e8',
  epic: '#bc7ae8',
  legendary: '#e9b85e',
};

export const getItem = (id: string): ItemDefinition | undefined => ITEMS.find((item) => item.id === id);

export function addStack(stacks: InventoryStack[], itemId: string, quantity = 1): InventoryStack[] {
  if (quantity <= 0) return stacks;
  const item = getItem(itemId);
  if (!item) return stacks;
  const result = stacks.map((stack) => ({ ...stack }));
  let remaining = quantity;
  for (const stack of result) {
    if (stack.itemId !== itemId || stack.quantity >= item.stackLimit) continue;
    const added = Math.min(remaining, item.stackLimit - stack.quantity);
    stack.quantity += added;
    remaining -= added;
    if (remaining <= 0) return result;
  }
  while (remaining > 0) {
    const added = Math.min(remaining, item.stackLimit);
    result.push({ itemId, quantity: added });
    remaining -= added;
  }
  return result;
}

export function removeStack(stacks: InventoryStack[], itemId: string, quantity = 1): InventoryStack[] {
  let remaining = quantity;
  const result: InventoryStack[] = [];
  for (const source of stacks) {
    const stack = { ...source };
    if (stack.itemId === itemId && remaining > 0) {
      const removed = Math.min(stack.quantity, remaining);
      stack.quantity -= removed;
      remaining -= removed;
    }
    if (stack.quantity > 0) result.push(stack);
  }
  return result;
}

export function stackQuantity(stacks: InventoryStack[], itemId: string): number {
  return stacks.filter((stack) => stack.itemId === itemId).reduce((sum, stack) => sum + stack.quantity, 0);
}
