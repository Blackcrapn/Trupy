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
  style?: 'home' | 'inn' | 'forge' | 'cottage' | 'chapel' | 'marsh' | 'warehouse' | 'citadel';
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
  ambience: 'home' | 'inn' | 'forge' | 'herbalist' | 'house' | 'chapel' | 'marsh' | 'warehouse' | 'citadel';
  chest?: boolean;
}

export const LOCATIONS: LocationDefinition[] = [
  { id: 'home', name: 'Дом изгнанника', x: 260, y: 250, w: 400, h: 500, color: 0x353745, danger: 0, ambience: 'home' },
  { id: 'village', name: 'Деревня Серый Холм', x: 690, y: 300, w: 760, h: 680, color: 0x3d4039, danger: 0, ambience: 'village' },
  { id: 'cemetery', name: 'Старое кладбище', x: 1500, y: 230, w: 820, h: 720, color: 0x30353a, danger: 1, ambience: 'cemetery' },
  { id: 'forest', name: 'Шепчущий лес', x: 650, y: 1050, w: 1400, h: 1050, color: 0x263b35, danger: 1, ambience: 'forest' },
  { id: 'ruins', name: 'Проклятые руины', x: 2120, y: 1050, w: 770, h: 900, color: 0x342a40, danger: 2, ambience: 'ruins' },
  { id: 'marsh', name: 'Чёрное болото', x: 2780, y: 180, w: 1050, h: 820, color: 0x263a38, danger: 2, ambience: 'marsh' },
  { id: 'mines', name: 'Старые шахты', x: 3240, y: 1130, w: 620, h: 700, color: 0x3a352f, danger: 2, ambience: 'mine' },
  { id: 'docks', name: 'Пристань перевозчика', x: 2700, y: 2020, w: 1050, h: 700, color: 0x303b42, danger: 1, ambience: 'docks' },
  { id: 'citadel', name: 'Пепельная цитадель', x: 3880, y: 1420, w: 620, h: 1280, color: 0x443138, danger: 3, ambience: 'citadel' },
];

export interface MapShape {
  id: string;
  label: string;
  points: string;
  labelX: number;
  labelY: number;
  danger: number;
}

export const MAP_SHAPES: MapShape[] = [
  { id: 'home', label: 'Дом', points: '260,250 620,250 660,310 650,700 280,750 240,520', labelX: 440, labelY: 485, danger: 0 },
  { id: 'village', label: 'Серый Холм', points: '700,300 1400,300 1450,480 1420,930 760,980 680,730', labelX: 1060, labelY: 625, danger: 0 },
  { id: 'cemetery', label: 'Кладбище', points: '1510,230 2250,230 2320,360 2300,900 1570,950 1500,760', labelX: 1900, labelY: 585, danger: 1 },
  { id: 'forest', label: 'Шепчущий лес', points: '650,1050 2000,1050 2050,1230 1980,2000 850,2100 650,1870', labelX: 1340, labelY: 1570, danger: 1 },
  { id: 'ruins', label: 'Проклятые руины', points: '2120,1050 2860,1050 2890,1200 2820,1900 2200,1950 2120,1720', labelX: 2490, labelY: 1495, danger: 2 },
  { id: 'marsh', label: 'Чёрное болото', points: '2780,180 3780,180 3830,350 3780,950 2920,1000 2780,820', labelX: 3300, labelY: 590, danger: 2 },
  { id: 'mines', label: 'Старые шахты', points: '3240,1130 3820,1130 3860,1290 3800,1800 3290,1830 3240,1550', labelX: 3545, labelY: 1480, danger: 2 },
  { id: 'docks', label: 'Пристань', points: '2700,2020 3700,2020 3750,2200 3670,2680 2800,2720 2700,2500', labelX: 3210, labelY: 2380, danger: 1 },
  { id: 'citadel', label: 'Пепельная цитадель', points: '3880,1420 4480,1420 4500,2650 3940,2700 3880,2480', labelX: 4190, labelY: 2080, danger: 3 },
];

export const MAP_ROADS: number[][][] = [
  [[430,590],[980,650],[1770,680],[2400,1280],[3510,1470],[4160,1900]],
  [[980,650],[1150,1190],[1500,1580],[2450,1500]],
  [[2400,1280],[3200,650],[3480,650]],
  [[2450,1500],[3160,2380],[4140,2230]],
];

export const MAP_RIVER = '2480,0 2740,0 2740,3000 2480,3000';

export const REGION_ENTRANCES = [
  { id: 'home', x: 430, y: 620 }, { id: 'village', x: 900, y: 670 }, { id: 'cemetery', x: 1525, y: 650 },
  { id: 'forest', x: 1150, y: 1190 }, { id: 'ruins', x: 2280, y: 1080 }, { id: 'marsh', x: 3030, y: 650 },
  { id: 'mines', x: 3300, y: 1450 }, { id: 'docks', x: 3050, y: 2350 }, { id: 'citadel', x: 3915, y: 1860 },
] as const;

export const RIFT_POINTS = [
  { id: 'forest_rift', name: 'Лесной разлом', x: 1180, y: 1880, reward: 'moon_charm' },
  { id: 'marsh_rift', name: 'Разлом Чёрной топи', x: 3540, y: 820, reward: 'bogreaper' },
  { id: 'citadel_rift', name: 'Пепельный разлом', x: 4200, y: 2220, reward: 'ember_eye' },
] as const;

export const BUILDINGS: BuildingDefinition[] = [
  { id: 'player_home', name: 'ДОМ ИЗГНАННИКА', x: 430, y: 420, w: 240, h: 170, wall: 0x4c4651, roof: 0x342d3b, doorX: 0, style: 'home', interior: 'player_home' },
  { id: 'inn', name: 'ПОСТОЯЛЫЙ ДВОР', x: 930, y: 465, w: 210, h: 145, wall: 0x5c5545, roof: 0x40382f, doorX: -28, style: 'inn', interior: 'inn' },
  { id: 'forge', name: 'КУЗНИЦА РУНЫ', x: 1210, y: 520, w: 220, h: 155, wall: 0x5a493c, roof: 0x522e2b, doorX: 28, style: 'forge', interior: 'forge' },
  { id: 'elira_house', name: 'ДОМ ЭЛИРЫ', x: 790, y: 820, w: 170, h: 120, wall: 0x504c43, roof: 0x35332f, doorX: 0, style: 'cottage', interior: 'elira_house' },
  { id: 'herbalist', name: 'ЛАВКА ТРАВНИЦЫ', x: 1100, y: 820, w: 190, h: 130, wall: 0x4b513f, roof: 0x313a2f, doorX: 12, style: 'cottage', interior: 'herbalist' },
  { id: 'chapel', name: 'ЧАСОВНЯ ПЕПЛА', x: 1820, y: 510, w: 220, h: 180, wall: 0x47484c, roof: 0x292a31, doorX: 0, style: 'chapel', interior: 'chapel' },
  { id: 'marsh_hut', name: 'ХИЖИНА ТОПИ', x: 3270, y: 530, w: 190, h: 135, wall: 0x3e4a43, roof: 0x28332f, doorX: -15, style: 'marsh', interior: 'marsh_hut' },
  { id: 'dock_house', name: 'СКЛАД ПРИСТАНИ', x: 3020, y: 2290, w: 250, h: 155, wall: 0x46515a, roof: 0x29323a, doorX: 34, style: 'warehouse', interior: 'dock_house' },
  { id: 'citadel_gatehouse', name: 'ВРАТА ЦИТАДЕЛИ', x: 4130, y: 1770, w: 320, h: 200, wall: 0x5a3e42, roof: 0x38252d, doorX: 0, style: 'citadel', interior: 'citadel_gatehouse' },
];

export const INTERIORS: InteriorDefinition[] = [
  { id: 'player_home', name: 'Дом изгнанника', width: 900, height: 620, floor: 0x4b4146, wall: 0x272431, accent: 0x9b5a72, ambience: 'home', chest: true },
  { id: 'inn', name: 'Постоялый двор', width: 980, height: 680, floor: 0x55483b, wall: 0x2b2524, accent: 0xd19a58, ambience: 'inn', chest: true },
  { id: 'forge', name: 'Кузница Руны', width: 900, height: 620, floor: 0x493c37, wall: 0x2b2223, accent: 0xee7654, ambience: 'forge', chest: true },
  { id: 'herbalist', name: 'Лавка травницы', width: 860, height: 600, floor: 0x3f493a, wall: 0x242d27, accent: 0x79bd75, ambience: 'herbalist', chest: true },
  { id: 'elira_house', name: 'Дом Элиры', width: 820, height: 570, floor: 0x494044, wall: 0x29242b, accent: 0xc98fa8, ambience: 'house', chest: true },
  { id: 'chapel', name: 'Часовня и склеп', width: 980, height: 760, floor: 0x3d3e43, wall: 0x202127, accent: 0x9b88be, ambience: 'chapel', chest: true },
  { id: 'marsh_hut', name: 'Хижина Чёрной топи', width: 880, height: 620, floor: 0x35473f, wall: 0x1f2b27, accent: 0x73c69d, ambience: 'marsh', chest: true },
  { id: 'dock_house', name: 'Склад пристани', width: 980, height: 650, floor: 0x3c4850, wall: 0x202931, accent: 0x7eabc5, ambience: 'warehouse', chest: true },
  { id: 'citadel_gatehouse', name: 'Караульня цитадели', width: 1040, height: 720, floor: 0x4a3337, wall: 0x251a1e, accent: 0xe16d54, ambience: 'citadel', chest: true },
];

export const getBuildingDoor = (building: BuildingDefinition) => ({
  x: building.x + building.doorX,
  y: building.y + building.h / 2 + 22,
});

export const getInterior = (id: string): InteriorDefinition | undefined => INTERIORS.find((interior) => interior.id === id);
