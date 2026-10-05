import type { BuildingType } from './types';

/**
 * Composición de la ciudad. El escenario (city_ground.png) mide 1536×1024 y todas las
 * posiciones están en píxeles de ese lienzo; el contenedor las convierte a porcentajes,
 * así la escena escala con proporción fija en cualquier pantalla.
 *
 *  x, y  → punto de anclaje en el escenario: el centro de la HUELLA (base) del edificio.
 *  w     → ancho del sprite en el escenario (se conserva la proporción 1:1 del PNG).
 *  anchorY → altura (0..1) dentro del sprite donde está su base; ese punto se coloca en (x, y).
 *  labelDy → desplazamiento vertical de la etiqueta respecto del anclaje.
 *
 * Ajustar aquí cualquier posición o tamaño no requiere tocar el resto del código.
 */
export const SCENE_W = 1536;
export const SCENE_H = 1024;
export const GROUND_SRC = '/assets/city_ground.png';

export interface Slot {
  x: number;
  y: number;
  w: number;
  anchorY: number;
  labelDy: number;
  /** Huella para la parcela vacía (semiejes de la elipse) */
  plot: { rx: number; ry: number };
}

export const SLOTS: Record<BuildingType, Slot> = {
  castle: { x: 835, y: 462, w: 290, anchorY: 0.8, labelDy: 48, plot: { rx: 120, ry: 60 } },
  quarry: { x: 350, y: 292, w: 270, anchorY: 0.8, labelDy: 50, plot: { rx: 105, ry: 52 } },
  warehouse: { x: 700, y: 258, w: 240, anchorY: 0.8, labelDy: 56, plot: { rx: 100, ry: 48 } },
  barracks: { x: 1230, y: 435, w: 310, anchorY: 0.8, labelDy: 66, plot: { rx: 110, ry: 54 } },
  sawmill: { x: 305, y: 520, w: 260, anchorY: 0.8, labelDy: 48, plot: { rx: 105, ry: 52 } },
  farm: { x: 735, y: 672, w: 280, anchorY: 0.8, labelDy: 62, plot: { rx: 115, ry: 56 } },
};

export const SPRITE_SRC: Record<BuildingType, string> = {
  castle: '/assets/castle.png',
  sawmill: '/assets/sawmill.png',
  quarry: '/assets/quarry.png',
  farm: '/assets/farm.png',
  warehouse: '/assets/warehouse.png',
  barracks: '/assets/barracks.png',
};

export const spriteBox = (t: BuildingType) => {
  const s = SLOTS[t];
  return { left: s.x - s.w / 2, top: s.y - s.w * s.anchorY, size: s.w };
};
