import { SCENE_H, SCENE_W, SLOTS, spriteBox } from './sceneConfig';
import type { BuildingType, PlotBuilding } from './types';

/**
 * Geometría de la escena de la ciudad. Todo se expresa en el sistema de coordenadas del lienzo
 * original (1536×1024). El escalado visual es un único `transform: scale()` uniforme del lienzo
 * completo, así que las anclas nunca dependen del tamaño de la ventana.
 */

export const MASK_SIZE = 160;

/** Escala uniforme que hace caber el lienzo en el área disponible (con un mínimo de legibilidad). */
export function fitScale(availW: number, availH: number, w = SCENE_W, h = SCENE_H, minScale = 0.55): number {
  if (availW <= 0 || availH <= 0) return minScale;
  return Math.max(minScale, Math.min(availW / w, availH / h));
}

/** Convierte un punto de pantalla a coordenadas del lienzo usando el rectángulo ya escalado del mismo. */
export function clientToStage(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  w = SCENE_W,
  h = SCENE_H,
): { x: number; y: number } {
  return { x: ((clientX - rect.left) / rect.width) * w, y: ((clientY - rect.top) / rect.height) * h };
}

/** Orden de hit-test: de delante hacia atrás (mayor y de anclaje primero). */
export const frontToBackOrder = (): PlotBuilding[] =>
  (Object.keys(SLOTS) as BuildingType[]).filter((t): t is PlotBuilding => t !== 'wall').sort((a, b) => SLOTS[b].y - SLOTS[a].y);

/** Máscara de opacidad de un overlay de muralla (resolución propia, no la de los edificios). */
export interface WallMask {
  data: Uint8Array;
  w: number;
  h: number;
}

export type Masks = Partial<Record<BuildingType, Uint8Array>>;

/**
 * Edificio bajo el punto (x, y) del lienzo. Los construidos responden por su silueta (máscara de
 * opacidad del PNG, sin márgenes transparentes); las parcelas libres por su elipse de huella.
 */
export function hitTestBuildings(x: number, y: number, levels: Record<BuildingType, number>, masks: Masks, wallMask?: WallMask | null): BuildingType | null {
  for (const type of frontToBackOrder()) {
    const slot = SLOTS[type];
    if (levels[type] > 0) {
      const box = spriteBox(type);
      const u = (x - box.left) / box.size;
      const v = (y - box.top) / box.size;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const mask = masks[type];
      if (mask && mask[Math.floor(v * MASK_SIZE) * MASK_SIZE + Math.floor(u * MASK_SIZE)]) return type;
    } else {
      const dx = (x - slot.x) / slot.plot.rx;
      const dy = (y - slot.y) / slot.plot.ry;
      if (dx * dx + dy * dy <= 1) return type;
    }
  }
  // La muralla va después de los edificios: el portón (siempre) y, ya construida, la silueta de su overlay.
  const gate = SLOTS.wall;
  const gx = (x - gate.x) / gate.plot.rx;
  const gy = (y - gate.y) / gate.plot.ry;
  if (gx * gx + gy * gy <= 1) return 'wall';
  if (levels.wall > 0 && wallMask) {
    const mx = Math.floor((x / SCENE_W) * wallMask.w);
    const my = Math.floor((y / SCENE_H) * wallMask.h);
    if (mx >= 0 && mx < wallMask.w && my >= 0 && my < wallMask.h && wallMask.data[my * wallMask.w + mx]) return 'wall';
  }
  return null;
}
