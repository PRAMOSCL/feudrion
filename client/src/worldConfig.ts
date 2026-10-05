/**
 * Destinos sobre `world_map.png` (lienzo de 1600×1000). Los centros salen de LEEME_SONNET.md del paquete de arte y
 * se afinaron mirando el mapa en el navegador. Son puntos de anclaje de los marcadores DOM, no polígonos de
 * hit-testing: el área pulsable es un círculo de `HIT_RADIUS` px de pantalla centrado en cada punto.
 *
 * `labelDy` desplaza la etiqueta respecto del punto para no tapar el edificio pintado en el mapa.
 */
export const WORLD_W = 1600;
export const WORLD_H = 1000;
export const HIT_RADIUS = 52;

export interface WorldSite {
  x: number;
  y: number;
  labelDy: number;
}

export const CITY_SITE: WorldSite = { x: 350, y: 680, labelDy: 120 };

/** Por clave de campamento (coincide con `CampDef.key` del servidor). */
export const CAMP_SITES: Record<string, WorldSite> = {
  bandidos: { x: 300, y: 215, labelDy: 90 },
  fortin: { x: 1210, y: 255, labelDy: 95 },
  bastion: { x: 1300, y: 700, labelDy: 120 },
};
