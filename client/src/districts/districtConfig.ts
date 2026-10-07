import { ART } from '../artManifest';
import { VILLAGER_ROAD, WALL_SPLIT_Y } from '../live/liveConfig';
import { PATROL_CIRCUITS_V3 } from '../live/patrolCircuitsV3';
import { GROUND_SRC, SCENE_H, SCENE_W, SLOTS } from '../sceneConfig';
import type { BuildingType } from '../types';
import type { DistrictDefinition, DistrictId, PlotGeometry, Pt, RouteDef } from './types';

/**
 * Registro de escenas (distritos). Añadir una parcela o una calle a un distrito es añadir datos aquí (y su ID en el servidor):
 * el selector, el plano de planificación y los tests de coherencia no cambian.
 */

/* ------------------------------------------------------------------ */
/* Fortaleza (escena real: terreno limpio, sprites y animaciones actuales)  */
/* ------------------------------------------------------------------ */

const FORTRESS_TYPES = Object.keys(SLOTS) as BuildingType[];

const fortressPlots: PlotGeometry[] = FORTRESS_TYPES.map((type) => {
  const s = SLOTS[type];
  return {
    id: `fortress:${type}`,
    districtId: 'fortress',
    anchor: [s.x, s.y],
    footprint: { kind: 'ellipse', rx: s.plot.rx, ry: s.plot.ry },
    allowedTypes: [type],
    // La muralla no ocupa suelo: su «parcela» es el portón; el resto se selecciona por la silueta del sprite.
    interaction: type === 'wall' ? 'footprint' : 'silhouette',
    access: null,
    depth: s.y,
  };
});

export const FORTRESS: DistrictDefinition = {
  id: 'fortress',
  name: 'Fortaleza',
  status: 'active',
  sceneBounds: { w: SCENE_W, h: SCENE_H },
  terrainAsset: GROUND_SRC,
  provisional: false,
  // El puente conduce a la Villa. En coordenadas de esta escena: el extremo oriental del puente real.
  entrances: [{ id: 'puente', at: [1450, 855], to: 'village' }],
  plots: fortressPlots,
  routes: [
    { id: 'habitantes', kind: 'villagers', points: VILLAGER_ROAD, halfWidth: 8 },
    ...([1, 2, 3] as const).map((s): RouteDef => ({ id: `ronda-${s}`, kind: 'patrol', points: PATROL_CIRCUITS_V3[s].segments.flatMap((seg) => seg.feet), halfWidth: 4 })),
  ],
  exclusions: [],
  occlusionLayers: [
    { id: 'muralla-trasera', order: 'back', note: `Overlay de muralla por encima del terreno y por debajo de edificios (y < ${WALL_SPLIT_Y}).` },
    { id: 'muralla-delantera', order: 'front', note: `Overlay de muralla y portón por encima de edificios y actores (y ≥ ${WALL_SPLIT_Y}).` },
  ],
};

/* ------------------------------------------------------------------ */
/* Villa: terreno limpio v2 + parcelas PLANIFICADAS (sin construcciones)    */
/* ------------------------------------------------------------------ */

/**
 * Lienzo = terreno `terrain_village.png` (1536×1024). Las parcelas están ajustadas a los CLAROS de tierra del PNG y las calles siguen el
 * empedrado visible (calibrado mirando el terreno con rejilla). Siguen siendo PLANIFICACIÓN: no hay construcciones ni mecánicas.
 * Todo lo no pintado en el terreno (p. ej. el acceso de la catedral) es un corredor RESERVADO, no un camino existente.
 */
export const VILLAGE_W = 1536;
export const VILLAGE_H = 1024;
/** Franja periférica reservada para la muralla exterior futura (px del lienzo). */
export const VILLAGE_WALL_MARGIN = 60;

const rect = (id: string, types: string[], cx: number, cy: number, hx: number, hy: number, access: Pt | null): PlotGeometry => ({
  id: `village:${id}`,
  districtId: 'village',
  anchor: [cx, cy],
  footprint: { kind: 'rect', hx, hy },
  allowedTypes: types,
  interaction: 'footprint',
  access,
  depth: cy,
});

const street = (id: string, kind: RouteDef['kind'], pts: Pt[], halfWidth: number): RouteDef => ({ id, kind, points: pts, halfWidth });

export const VILLAGE: DistrictDefinition = {
  id: 'village',
  name: 'Villa',
  status: 'planning',
  sceneBounds: { w: VILLAGE_W, h: VILLAGE_H },
  terrainAsset: ART.villageGround,
  provisional: true, // parcelas/calles provisionales sobre un terreno ya real; aún sin construcciones ni mecánicas
  entrances: [{ id: 'entrada', at: [255, 150], to: 'fortress' }],
  plots: [
    rect('casas_oeste', ['house'], 330, 400, 85, 36, [420, 500]),
    rect('casas_sur', ['house'], 505, 625, 110, 50, [430, 715]),
    rect('mercado', ['market'], 770, 500, 105, 55, null),
    rect('taberna', ['tavern'], 205, 655, 70, 28, [330, 655]),
    rect('iglesia', ['church'], 860, 268, 70, 34, [755, 350]),
    rect('catedral_reserva', ['cathedral'], 1150, 290, 115, 55, [1060, 365]),
    rect('concejo', ['town_hall'], 1090, 455, 85, 38, [1100, 535]),
    rect('embajada', ['embassy'], 1215, 700, 95, 48, [1140, 890]),
  ],
  routes: [
    street('entrada', 'entrance', [[255, 150], [300, 190], [340, 235], [400, 300], [470, 365], [525, 420], [590, 465]], 12),
    street('anillo_plaza', 'street', [[600, 440], [700, 400], [860, 405], [940, 470], [930, 540], [840, 595], [700, 590], [600, 520], [600, 440]], 8),
    street('calle_norte', 'street', [[640, 262], [720, 330], [755, 350], [800, 402]], 8),
    street('ramal_catedral', 'street', [[940, 470], [1000, 410], [1060, 365]], 8),
    street('calle_oeste', 'street', [[600, 480], [500, 490], [420, 500], [330, 520], [250, 565], [150, 520], [100, 515]], 8),
    street('calle_suroeste', 'street', [[250, 565], [330, 655], [430, 715], [540, 745], [700, 748], [760, 745]], 8),
    street('ramal_este', 'exit', [[935, 535], [1100, 535], [1260, 580], [1340, 545], [1450, 520], [1520, 490]], 8),
    street('calle_sur', 'street', [[765, 595], [768, 690], [760, 745], [850, 790], [960, 805], [1040, 830], [1140, 890], [1250, 935], [1290, 1010]], 12),
  ],
  exclusions: [
    // Franja periférica: reserva para la muralla exterior futura (se dibuja como banda, sin muralla).
    { id: 'reserva_muralla', label: 'Reserva · muralla exterior futura', kind: 'future_wall', points: [[0, 0], [VILLAGE_W, 0], [VILLAGE_W, VILLAGE_H], [0, VILLAGE_H]] },
  ],
  occlusionLayers: [],
};

/* ------------------------------------------------------------------ */

export const DISTRICT_DEFINITIONS: Partial<Record<DistrictId, DistrictDefinition>> = {
  fortress: FORTRESS,
  village: VILLAGE,
};

export const getDistrictDefinition = (id: DistrictId): DistrictDefinition | null => DISTRICT_DEFINITIONS[id] ?? null;
