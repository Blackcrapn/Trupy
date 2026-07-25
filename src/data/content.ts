import type { BattlePassTier, EnemyDefinition, QuestDefinition, WeaponDefinition } from '../game/types';

export const WEAPONS: WeaponDefinition[] = [
  {
    id: 'rustblade',
    name: 'Ржавый клинок',
    description: 'Старый меч из дома героя. Надёжнее, чем выглядит.',
    kind: 'melee',
    price: 0,
    damage: 24,
    cooldown: 390,
    range: 54,
    requiredRep: 0,
    icon: '⚔',
    accent: '#a9b1bb',
  },
  {
    id: 'graveaxe',
    name: 'Могильный топор',
    description: 'Тяжёлый удар сбивает плоть и доспехи.',
    kind: 'melee',
    price: 90,
    damage: 38,
    cooldown: 650,
    range: 62,
    requiredRep: 1,
    icon: '◆',
    accent: '#d6a86c',
  },
  {
    id: 'witchbow',
    name: 'Ведьмин арбалет',
    description: 'Нужен, чтобы снимать костяные печати на расстоянии.',
    kind: 'ranged',
    price: 130,
    damage: 27,
    cooldown: 560,
    range: 360,
    projectileSpeed: 430,
    requiredRep: 2,
    icon: '➶',
    accent: '#8fd3b5',
  },
  {
    id: 'ashstaff',
    name: 'Посох пепла',
    description: 'Медленный сгусток огня наносит высокий урон.',
    kind: 'magic',
    price: 240,
    damage: 46,
    cooldown: 760,
    range: 420,
    projectileSpeed: 300,
    requiredRep: 4,
    icon: '✦',
    accent: '#ef7f58',
  },
  {
    id: 'moonblade',
    name: 'Лунный тесак',
    description: 'Быстрый клинок охотников из Серой Стражи.',
    kind: 'melee',
    price: 360,
    damage: 54,
    cooldown: 360,
    range: 68,
    requiredRep: 6,
    icon: '☾',
    accent: '#aebcff',
  },
  {
    id: 'reliquary',
    name: 'Реликварий Бездны',
    description: 'Запретное оружие, открываемое в боевом пропуске.',
    kind: 'magic',
    price: 0,
    damage: 72,
    cooldown: 640,
    range: 480,
    projectileSpeed: 360,
    requiredRep: 9,
    icon: '✺',
    accent: '#c982ff',
  },
];

export const QUESTS: QuestDefinition[] = [
  {
    id: 'first_oath',
    title: 'Первая клятва',
    description: 'Сестра Мора просит вернуть три пучка лунной полыни с окраины деревни.',
    giver: 'mora',
    category: 'main',
    objectives: [
      { type: 'collect', target: 'moonwort', label: 'Соберите лунную полынь', amount: 3 },
    ],
    reward: { coins: 75, xp: 70, reputation: 1, potions: 1 },
  },
  {
    id: 'grave_silence',
    title: 'Тишина на кладбище',
    description: 'Мёртвые поднялись у старых ворот. Смотритель Гран не может покинуть пост.',
    giver: 'gran',
    category: 'main',
    prerequisite: 'first_oath',
    objectives: [
      { type: 'kill', target: 'husk', label: 'Уничтожьте одичалых мертвецов', amount: 4 },
    ],
    reward: { coins: 95, xp: 110, reputation: 1, potions: 1 },
  },
  {
    id: 'iron_answer',
    title: 'Железный ответ',
    description: 'Костяные печати нельзя разбить мечом. Руна продаст подходящий арбалет.',
    giver: 'runa',
    category: 'main',
    prerequisite: 'grave_silence',
    objectives: [
      { type: 'purchase', target: 'witchbow', label: 'Купите Ведьмин арбалет у Руны', amount: 1 },
      { type: 'kill', target: 'boneguard', label: 'Сразите костяных стражей', amount: 3 },
    ],
    reward: { coins: 140, xp: 150, reputation: 2 },
  },
  {
    id: 'witch_trail',
    title: 'След ведьмы',
    description: 'В лесу растут цветы тени. Их сок проявит след хозяйки руин.',
    giver: 'vesna',
    category: 'main',
    prerequisite: 'iron_answer',
    objectives: [
      { type: 'collect', target: 'shadebloom', label: 'Соберите цветы тени в лесу', amount: 4 },
      { type: 'interact', target: 'forest_altar', label: 'Проведите ритуал у лесного алтаря', amount: 1 },
    ],
    reward: { coins: 160, xp: 180, reputation: 2, potions: 1 },
  },
  {
    id: 'heart_of_ruin',
    title: 'Сердце руин',
    description: 'След ведёт к Безымянной, удерживающей проклятие над долиной.',
    giver: 'mora',
    category: 'main',
    prerequisite: 'witch_trail',
    objectives: [
      { type: 'visit', target: 'ruins', label: 'Доберитесь до проклятых руин', amount: 1 },
      { type: 'kill', target: 'nameless', label: 'Победите Безымянную', amount: 1 },
    ],
    reward: { coins: 320, xp: 350, reputation: 3, potions: 2 },
  },
  {
    id: 'lost_charm',
    title: 'Медальон вдовы',
    description: 'Элира потеряла медальон у северных могил.',
    giver: 'elira',
    category: 'side',
    objectives: [
      { type: 'collect', target: 'charm', label: 'Найдите медальон на кладбище', amount: 1 },
    ],
    reward: { coins: 70, xp: 55, reputation: 1 },
  },
  {
    id: 'wolf_debt',
    title: 'Волчий долг',
    description: 'Стая искажённых волков перекрыла дорогу травнице.',
    giver: 'vesna',
    category: 'side',
    prerequisite: 'first_oath',
    objectives: [
      { type: 'kill', target: 'direwolf', label: 'Убейте искажённых волков', amount: 3 },
    ],
    reward: { coins: 105, xp: 90, reputation: 1, potions: 1 },
  },
  {
    id: 'last_lights',
    title: 'Последние огни',
    description: 'Зажгите дорожные фонари, чтобы тьма не дошла до деревни.',
    giver: 'gran',
    category: 'side',
    prerequisite: 'grave_silence',
    objectives: [
      { type: 'interact', target: 'lantern', label: 'Зажгите погасшие фонари', amount: 3 },
    ],
    reward: { coins: 115, xp: 100, reputation: 1 },
  },
];

export const BATTLE_PASS: BattlePassTier[] = [
  { tier: 1, reputation: 1, rewardLabel: '40 золота', coins: 40 },
  { tier: 2, reputation: 2, rewardLabel: 'Зелье крови', potions: 1 },
  { tier: 3, reputation: 3, rewardLabel: '80 золота', coins: 80 },
  { tier: 4, reputation: 5, rewardLabel: '2 зелья крови', potions: 2 },
  { tier: 5, reputation: 7, rewardLabel: '150 золота', coins: 150 },
  { tier: 6, reputation: 9, rewardLabel: 'Реликварий Бездны', weapon: 'reliquary' },
  { tier: 7, reputation: 11, rewardLabel: '250 золота', coins: 250 },
  { tier: 8, reputation: 12, rewardLabel: 'Печать Долины', coins: 400, potions: 3 },
];

export const ENEMIES: Record<string, EnemyDefinition> = {
  husk: {
    id: 'husk', name: 'Одичалый', health: 62, damage: 10, speed: 58, aggro: 210, rewardCoins: 8, tint: 0x9ca87c,
  },
  boneguard: {
    id: 'boneguard', name: 'Костяной страж', health: 90, damage: 14, speed: 48, aggro: 240, rewardCoins: 14, tint: 0xd7c9aa,
  },
  direwolf: {
    id: 'direwolf', name: 'Искажённый волк', health: 54, damage: 12, speed: 92, aggro: 260, rewardCoins: 11, tint: 0x7d708a,
  },
  wraith: {
    id: 'wraith', name: 'Теневик', health: 74, damage: 16, speed: 72, aggro: 280, rewardCoins: 18, tint: 0x796aab,
  },
  nameless: {
    id: 'nameless', name: 'Безымянная', health: 460, damage: 22, speed: 64, aggro: 420, rewardCoins: 100, tint: 0xb25987, scale: 1.45,
  },
};

export const NPCS = [
  { id: 'mora', name: 'Сестра Мора', role: 'Хранительница клятвы', x: 660, y: 500, accent: 0xb78cff },
  { id: 'runa', name: 'Руна', role: 'Кузнец и оружейник', x: 1010, y: 610, accent: 0xe3a560 },
  { id: 'gran', name: 'Смотритель Гран', role: 'Страж кладбища', x: 1770, y: 690, accent: 0x9fc6b4 },
  { id: 'vesna', name: 'Весна', role: 'Травница', x: 980, y: 1050, accent: 0x81c784 },
  { id: 'elira', name: 'Элира', role: 'Вдова', x: 770, y: 740, accent: 0xd3a1b1 },
  { id: 'orrin', name: 'Оррин', role: 'Охотник', x: 1450, y: 1250, accent: 0xc5a47e },
  { id: 'ferryman', name: 'Перевозчик', role: 'Молчаливый проводник', x: 2240, y: 1240, accent: 0x88a7c2 },
] as const;

export const LOCATIONS = [
  { id: 'home', name: 'Дом изгнанника', x: 360, y: 320, w: 460, h: 390, color: 0x353745 },
  { id: 'village', name: 'Деревня Серый Холм', x: 690, y: 340, w: 650, h: 570, color: 0x3d4039 },
  { id: 'cemetery', name: 'Старое кладбище', x: 1480, y: 260, w: 720, h: 630, color: 0x30353a },
  { id: 'forest', name: 'Шепчущий лес', x: 760, y: 930, w: 1050, h: 800, color: 0x263b35 },
  { id: 'ruins', name: 'Проклятые руины', x: 1910, y: 900, w: 760, h: 760, color: 0x342a40 },
] as const;

export const XP_FOR_LEVEL = (level: number) => 100 + (level - 1) * 85;
