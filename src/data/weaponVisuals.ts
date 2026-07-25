export interface WeaponVisualDefinition {
  id: string;
  primary: string;
  secondary: string;
  glow: string;
  bonusVs: string[];
  bonusLabel: string;
}

export const WEAPON_VISUALS: WeaponVisualDefinition[] = [
  { id: 'rustblade', primary: '#c5cbd3', secondary: '#79563a', glow: '#e7ebef', bonusVs: ['husk', 'bogling'], bonusLabel: 'Плоть +20%' },
  { id: 'graveaxe', primary: '#d3a05d', secondary: '#6f4a31', glow: '#f4c77f', bonusVs: ['boneguard', 'cavecrawler'], bonusLabel: 'Броня +25%' },
  { id: 'witchbow', primary: '#76c4a4', secondary: '#4e6f61', glow: '#b7ffe0', bonusVs: ['wraith', 'bogling'], bonusLabel: 'Тени +25%' },
  { id: 'ashstaff', primary: '#e56a48', secondary: '#684031', glow: '#ffca72', bonusVs: ['direwolf', 'cavecrawler'], bonusLabel: 'Звери +25%' },
  { id: 'moonblade', primary: '#a8b8ee', secondary: '#555d79', glow: '#e2e8ff', bonusVs: ['wraith', 'nameless'], bonusLabel: 'Нежить +30%' },
  { id: 'reliquary', primary: '#bf78e2', secondary: '#59406c', glow: '#f1bdff', bonusVs: ['nameless', 'cinderlord'], bonusLabel: 'Боссы +20%' },
  { id: 'bogreaper', primary: '#6fc79b', secondary: '#476a53', glow: '#b5ffd5', bonusVs: ['bogling', 'ashborn'], bonusLabel: 'Порча +30%' },
  { id: 'cinderbrand', primary: '#f2774c', secondary: '#713c31', glow: '#ffd07a', bonusVs: ['boneguard', 'cinderlord'], bonusLabel: 'Стражи +30%' },
];

export const getWeaponVisual = (id: string): WeaponVisualDefinition => WEAPON_VISUALS.find((visual) => visual.id === id) ?? WEAPON_VISUALS[0];
