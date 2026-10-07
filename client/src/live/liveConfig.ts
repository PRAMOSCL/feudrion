import type { PlotBuilding } from '../types';
import entryV31 from './entryRouteV31.json';
import sceneV3 from './sceneV3.json';

/**
 * Configuración de la «ciudad viva». Todo está en coordenadas del lienzo de la ciudad (1536×1024), el mismo sistema que
 * `sceneConfig.ts`. Las rutas y posiciones son una propuesta calibrada mirando el terreno `city_ground_open.png`; se verifican
 * en el navegador con el modo depuración (`localStorage['senorios.debugLive'] = '1'`), que dibuja rutas y estaciones.
 */

/* ---------- Muralla ---------- */

/** Frente/fondo de la muralla: lo que está por encima de esta y se dibuja ANTES que edificios y personajes; lo demás, después. */
export const WALL_SPLIT_Y = 470;

/**
 * Transformación explícita del overlay por aspecto (los tres PNG son imágenes generadas independientes: pequeñas diferencias de
 * registro). Verificado sobre el terreno: los tres encajan con identidad y el portón queda alineado con el puente (≈ 1290, 760).
 */
export const WALL_TRANSFORM: Record<1 | 2 | 3, { dx: number; dy: number; scale: number }> = {
  1: { dx: 0, dy: 0, scale: 1 },
  2: { dx: 0, dy: 0, scale: 1 },
  3: { dx: 0, dy: 0, scale: 1 },
};

/**
 * Regiones que se RECORTAN del overlay (polígonos «hueco») para dejar elementos del terreno por delante de la muralla
 * (equivale al `foregroundPatch` de la demo, pero sin pintar nada: solo se oculta el overlay en esa región).
 * El frente izquierdo de la demo se descartó: la muralla pasa por la orilla sin tapar el embarcadero ni el barco, así que no hace falta.
 */
export const WALL_HOLES: Record<1 | 2 | 3, [number, number][][]> = { 1: [], 2: [], 3: [] };

/** Construcción visible: el overlay se revela por tramos verticales de izquierda a derecha según el progreso de la obra. */
export const WALL_REVEAL_SECTIONS = 6;

/** Visibilidad máxima de guardias en los parapetos por aspecto (representación, no efectivos reales). */
export const GUARDS_VISIBLE_BY_STAGE = [0, 2, 4, 6] as const;

/**
 * Patrulla: ahora es el circuito COMPLETO por etapa de `patrolCircuitsV3.ts` (norte, este, sur, oeste, torres y plataforma del portón).
 * La ruta norte antigua (`PATROL_ROUTES`) fue ELIMINADA: no debe volver a usarse.
 */
/** Velocidad de juego de los guardias (px de escena/s). La velocidad ×10 de la demo del paquete NO es la del juego. Configurable. */
export const GUARD_SPEED = 15;
/** Distancia (en alturas del sprite) de un ciclo de 6 poses del guardia: la fase de la caminata depende de la distancia recorrida. */
export const GUARD_CYCLE_HEIGHTS = 0.9;

/* ---------- Trabajadores ---------- */

/** Una figura visible por cada 7 trabajadores asignados (máximo 3): 20 trabajadores → 3 figuras. No es una figura por trabajador. */
export const WORKERS_PER_FIGURE = 7;
export const MAX_FIGURES_PER_BUILDING = 3;
/** Secuencia de hacha sugerida (índices cero-indexados de las seis poses). */
export const CHOP_ORDER = [1, 4, 2, 3, 5, 0] as const;

export interface FigureSpec {
  /** Hoja de sprites: tala (solo aserradero) o transporte (genérico). */
  kind: 'chop' | 'carry';
  height: number;
  /** Posición fija (tala). */
  at?: [number, number];
  /** Ruta de ida y vuelta (transporte). */
  path?: [number, number][];
  speed?: number;
  flip?: boolean;
}

/**
 * Estaciones de trabajo por edificio, en el orden en que aparecen figuras. Solo el aserradero tiene secuencia propia (hacha).
 * Granja y cantera usan `worker_carry_sheet` como tarea genérica de transporte: FALTA arte específico de cosechar y picar piedra
 * (no se muestra un hacha talando piedra).
 */
export const STATIONS: Partial<Record<PlotBuilding, FigureSpec[]>> = {
  sawmill: [
    { kind: 'chop', height: 40, at: [318, 532] },
    { kind: 'carry', height: 34, path: [[250, 516], [300, 534], [384, 526]], speed: 18 },
    { kind: 'chop', height: 38, at: [376, 544], flip: true },
  ],
  farm: [
    { kind: 'carry', height: 34, path: [[650, 692], [705, 704], [765, 698], [820, 686]], speed: 17 },
    { kind: 'carry', height: 32, path: [[812, 684], [765, 696], [705, 702]], speed: 15 },
    { kind: 'carry', height: 32, path: [[660, 686], [725, 706], [800, 692]], speed: 13 },
  ],
  quarry: [
    { kind: 'carry', height: 32, path: [[300, 326], [360, 338], [430, 328]], speed: 16 },
    { kind: 'carry', height: 30, path: [[420, 322], [360, 334], [305, 322]], speed: 14 },
    { kind: 'carry', height: 30, path: [[312, 332], [380, 342], [440, 332]], speed: 12 },
  ],
};

/* ---------- Habitantes ambientales ---------- */

/**
 * Habitantes decorativos: pocos actores (2–10), NO uno por habitante y sin efecto en recursos ni población.
 * Su número crece con la población real solo como ambiente.
 */
export const AMBIENT = { min: 2, max: 10, inhabitantsPerFigure: 3 };

/**
 * Camino de los habitantes, calibrado sobre el empedrado REAL del terreno (no sobre el suelo del patio ni sobre parcelas edificadas):
 * entran por el puente y el portón, suben por el anillo este, recorren la calzada norte (junto al almacén y la cantera) y bajan por la
 * calzada oeste hasta cerca de la granja. Ida y vuelta.
 */
/**
 * Entrada de ciudadanos v3 (de `scene-v3.json`): puente (1530,865) → rellano → centro del hueco del portón (x = 1280, y = 740…780, libre de
 * pared en las tres etapas) → interior (el último tramo queda oculto tras el cuerpo del portón por el muro delantero, no por transparencia),
 * enlazada con el resto de la calzada. La MISMA ruta sirve para volver (ida y vuelta).
 */
/**
 * Parche v3.1: el prefijo EXTERIOR (llegada por el puente y el arco) viene de `entryRouteV31.json` hasta el punto común (1236,705); la cola
 * INTERIOR es la del repo (`sceneV3.citizens.feet`) sin duplicar el punto de unión. Los índices de las paradas interiores se desplazan
 * por la diferencia de longitud del prefijo; la parada exterior (rellano antes del arco) pasa a ser el último punto del puente.
 */
const OLD_JOIN = sceneV3.citizens.feet.findIndex((p) => p[0] === entryV31.joinInteriorAt[0] && p[1] === entryV31.joinInteriorAt[1]);
const NEW_JOIN = entryV31.feetOutsideToInside.length - 1;
export const VILLAGER_ROAD: [number, number][] = [...(entryV31.feetOutsideToInside as [number, number][]), ...(sceneV3.citizens.feet.slice(OLD_JOIN + 1) as [number, number][])];
export const GATE_CROSSING: [number, number][] = entryV31.feetOutsideToInside as [number, number][];
/** Paradas: rellano exterior (fin del puente, antes del arco), almacén y cantera (índices interiores desplazados). */
export const VILLAGER_STOPS: number[] = sceneV3.citizens.stopsIndexes.map((i, k) => (k === 0 ? entryV31.stopOutsideIndex : i + (NEW_JOIN - OLD_JOIN)));
export const VILLAGER_DWELL_SECONDS = 2.4;

/* ---------- Agua ---------- */

/**
 * El río v3.1 usa `riverV31.json` (regiones y cascadas con polígono y flujo) y la máscara `river_mask_v3_1.png`: textura de agua desplazada
 * con dos fases cruzadas y espuma descendente en las cascadas. Ver `waterFlow.ts` y liveRenderer.
 */
