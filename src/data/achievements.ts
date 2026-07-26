import type { AchievementDefinition } from '../game/types';

// ~20 achievements. Names/descriptions are Russian (player-facing); ids and the
// event names they react to are English. The AchievementSystem matches these by
// id in its rule table — this array is the display/source-of-truth catalogue.
// Categories cover the full brief: kills, exploration, crafting, quests,
// economy, skill, secrets.
export const ACHIEVEMENTS: AchievementDefinition[] = [
  // --- kills ---
  { id: 'first_blood', name: 'Первая кровь', description: 'Уничтожьте первого врага долины.', category: 'kills', icon: '⚔' },
  { id: 'slayer_25', name: 'Охотник', description: 'Уничтожьте 25 врагов.', category: 'kills', icon: '☠' },
  { id: 'slayer_100', name: 'Жнец Серого Холма', description: 'Уничтожьте 100 врагов.', category: 'kills', icon: '☠' },
  { id: 'nameless_fallen', name: 'Тишина руин', description: 'Победите Безымянную.', category: 'kills', icon: '◈' },
  { id: 'cinder_fallen', name: 'Конец пепла', description: 'Свергните Владыку углей.', category: 'kills', icon: '✹' },

  // --- exploration ---
  { id: 'wanderer', name: 'Странник', description: 'Откройте пять уголков долины.', category: 'exploration', icon: '✦' },
  { id: 'cartographer', name: 'Картограф', description: 'Откройте все девять земель долины.', category: 'exploration', icon: '❖' },
  { id: 'bestiary_half', name: 'Летописец', description: 'Занесите пять существ в бестиарий.', category: 'exploration', icon: '❦' },
  { id: 'bestiary_full', name: 'Хранитель бестиария', description: 'Изучите всех существ долины.', category: 'exploration', icon: '❦' },

  // --- crafting ---
  { id: 'first_craft', name: 'Ремесленник', description: 'Создайте первый предмет у мастера.', category: 'crafting', icon: '⚒' },
  { id: 'first_upgrade', name: 'Кузнечное дело', description: 'Усильте оружие впервые.', category: 'crafting', icon: '⚒' },
  { id: 'master_smith', name: 'Мастер-оружейник', description: 'Доведите оружие до +5.', category: 'crafting', icon: '✷' },

  // --- quests ---
  { id: 'first_oath_done', name: 'Данная клятва', description: 'Выполните первое поручение.', category: 'quests', icon: '✎' },
  { id: 'quests_10', name: 'Верное слово', description: 'Завершите десять поручений.', category: 'quests', icon: '✎' },
  { id: 'saviour', name: 'Спаситель долины', description: 'Завершите основную историю.', category: 'quests', icon: '♛' },

  // --- economy ---
  { id: 'first_coin', name: 'Звон монет', description: 'Заработайте первую сотню золота.', category: 'economy', icon: '◉' },
  { id: 'rich', name: 'Сундук изгнанника', description: 'Накопите 1000 золота за игру.', category: 'economy', icon: '◉' },
  { id: 'armory', name: 'Оружейная', description: 'Соберите пять видов оружия.', category: 'economy', icon: '⚔' },

  // --- skill ---
  { id: 'flawless_boss', name: 'Без единой царапины', description: 'Одолейте босса, не получив урона.', category: 'skill', icon: '✧', },
  { id: 'combo_10', name: 'Вихрь клинка', description: 'Наберите серию из 10 ударов без промаха.', category: 'skill', icon: '➶' },

  // --- secret ---
  { id: 'deserter_truth', name: 'Правда дезертира', description: 'Узнайте, от чего бежала капитан Сера.', category: 'secret', hidden: true, icon: '✹' },
  { id: 'rift_walker', name: 'Идущий сквозь разломы', description: 'Загляните за все три разлома долины.', category: 'secret', hidden: true, icon: '❂' },
];

export const getAchievement = (id: string): AchievementDefinition | undefined =>
  ACHIEVEMENTS.find((achievement) => achievement.id === id);
