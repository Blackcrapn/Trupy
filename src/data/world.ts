export const WORLD_WIDTH = 4600;
export const WORLD_HEIGHT = 3000;

export interface LocationDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  danger: number;
  ambience: 'home' | 'village' | 'cemetery' | 'forest' | 'ruins' | 'marsh' | 'mine' | 'docks' | 'citadel';
}

export interface BuildingDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  wall: number;
  roof: number;
  doorX: number;
  interior?: string;
}

export interface InteriorDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  floor: number;
  wall: number;
  accent: number;
  ambience: 'home' | 'inn' | 'forge' | 'herbalist' | 'house' | 'chapel';
  chest?: boolean;
}

export const LOCATIONS: LocationDefinition[] = [
  { id: 'home', name: 'Дом изгнанника', x: 260, y: 250, w: 560, h: 500, color: 0x353745, danger: 0, ambience: 'home' },
  { id: 'village', name: 'Деревня Серый Холм', x: 690, y: 300, w: 760, h: 680, color: 0x3d4039, danger: 0, ambience: 'village' },
  { id: 'cemetery', name: 'Старое кладбище', x: 1500, y: 230, w: 820, h: 720, color: 0x30353a, danger: 1, ambience: 'cemetery' },
  { id: 'forest', name: 'Шепчущий лес', x: 650, y: 1050, w: 1450, h: 1050, color: 0x263b35, danger: 1, ambience: 'forest' },
  { id: 'ruins', name: 'Проклятые руины', x: 2050, y: 1050, w: 850, h: 900, color: 0x342a40, danger: 2, ambience: 'ruins' },
  { id: 'marsh', name: 'Чёрное болото', x: 2780, y: 180, w: 1050, h: 920, color: 0x263a38, danger: 2, ambience: 'marsh' },
  { id: 'mines', name: 'Старые шахты', x: 3240, y: 1130, w: 760, h: 700, color: 0x3a352f, danger: 2, ambience: 'mine' },
  { id: 'docks', name: 'Пристань перевозчика', x: 2700, y: 2020, w: 1050, h: 700, color: 0x303b42, danger: 1, ambience: 'docks' },
  { id: 'citadel', name: 'Пепельная цитадель', x: 3820, y: 1420, w: 700, h: 1280, color: 0x443138, danger: 3, ambience: 'citadel' },
];

export const BUILDINGS: BuildingDefinition[] = [
  { id: 'player_home', name: 'ДОМ ИЗГНАННИКА', x: 430, y: 420, w: 240, h: 170, wall: 0x4c4651, roof: 0x342d3b, doorX: 0, interior: 'player_home' },
  { id: 'inn', name: 'ПОСТОЯЛЫЙ ДВОР', x: 930, y: 465, w: 190, h: 135, wall: 0x5c5545, roof: 0x40382f, doorX: -28, interior: 'inn' },
  { id: 'forge', name: 'КУЗНИЦА РУНЫ', x: 1210, y: 520, w: 210, h: 150, wall: 0x5a493c, roof: 0x522e2b, doorX: 28, interior: 'forge' },
  { id: 'elira_house', name: 'ДОМ ЭЛИРЫ', x: 780, y: 820, w: 155, h: 110, wall: 0x504c43, roof: 0x35332f, doorX: 0, interior: 'elira_house' },
  { id: 'herbalist', name: 'ЛАВКА ТРАВНИЦЫ', x: 1090, y: 820, w: 180, h: 125, wall: 0x4b513f, roof: 0x313a2f, doorX: 12, interior: 'herbalist' },
  { id: 'chapel', name: 'ЧАСОВНЯ ПЕПЛА', x: 1820, y: 510, w: 220, h: 175, wall: 0x47484c, roof: 0x292a31, doorX: 0, interior: 'chapel' },
  { id: 'marsh_hut', name: 'ХИЖИНА ТОПИ', x: 3270, y: 530, w: 180, h: 125, wall: 0x3e4a43, roof: 0x28332f, doorX: -15 },
  { id: 'dock_house', name: 'СКЛАД ПРИСТАНИ', x: 3020, y: 2290, w: 240, h: 150, wall: 0x46515a, roof: 0x29323a, doorX: 34 },
  { id: 'citadel_gatehouse', name: 'ВРАТА ЦИТАДЕЛИ', x: 4130, y: 1770, w: 310, h: 190, wall: 0x5a3e42, roof: 0x38252d, doorX: 0 },
];

export const INTERIORS: InteriorDefinition[] = [
  { id: 'player_home', name: 'Дом изгнанника', width: 900, height: 620, floor: 0x4b4146, wall: 0x272431, accent: 0x9b5a72, ambience: 'home', chest: true },
  { id: 'inn', name: 'Постоялый двор', width: 980, height: 680, floor: 0x55483b, wall: 0x2b2524, accent: 0xd19a58, ambience: 'inn', chest: true },
  { id: 'forge', name: 'Кузница Руны', width: 900, height: 620, floor: 0x493c37, wall: 0x2b2223, accent: 0xee7654, ambience: 'forge', chest: true },
  { id: 'herbalist', name: 'Лавка травницы', width: 860, height: 600, floor: 0x3f493a, wall: 0x242d27, accent: 0x79bd75, ambience: 'herbalist', chest: true },
  { id: 'elira_house', name: 'Дом Элиры', width: 820, height: 570, floor: 0x494044, wall: 0x29242b, accent: 0xc98fa8, ambience: 'house', chest: true },
  { id: 'chapel', name: 'Часовня и склеп', width: 980, height: 760, floor: 0x3d3e43, wall: 0x202127, accent: 0x9b88be, ambience: 'chapel', chest: true },
];

export const getBuildingDoor = (building: BuildingDefinition) => ({
  x: building.x + building.doorX,
  y: building.y + building.h / 2 + 22,
});

export const getInterior = (id: string): InteriorDefinition | undefined => INTERIORS.find((interior) => interior.id === id);
