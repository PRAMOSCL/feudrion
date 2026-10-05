import { describe, expect, it } from 'vitest';
import { MASK_SIZE, clientToStage, fitScale, hitTestBuildings, type Masks } from './sceneGeometry';
import { SCENE_H, SCENE_W, SLOTS, spriteBox } from './sceneConfig';
import type { BuildingType } from './types';

const levels = (over: Partial<Record<BuildingType, number>> = {}) =>
  ({ castle: 1, sawmill: 0, quarry: 0, farm: 1, warehouse: 1, barracks: 0, ...over }) as Record<BuildingType, number>;

const solid = () => new Uint8Array(MASK_SIZE * MASK_SIZE).fill(1);
const empty = () => new Uint8Array(MASK_SIZE * MASK_SIZE);

describe('geometría de la escena', () => {
  it('la escala es uniforme y nunca deforma: depende solo del lado más restrictivo', () => {
    expect(fitScale(1536, 1024)).toBe(1);
    expect(fitScale(768, 2000)).toBe(0.55); // mínimo de legibilidad
    expect(fitScale(3072, 1024)).toBe(1); // alto restrictivo
    expect(fitScale(1164, 790)).toBeCloseTo(Math.min(1164 / SCENE_W, 790 / SCENE_H), 6);
  });

  it('convierte puntos de pantalla a coordenadas del lienzo con cualquier escala', () => {
    for (const s of [0.55, 0.8, 1, 1.25]) {
      const rect = { left: 200, top: 90, width: SCENE_W * s, height: SCENE_H * s };
      const p = clientToStage(rect, 200 + 790 * s, 90 + 470 * s);
      expect(p.x).toBeCloseTo(790, 6);
      expect(p.y).toBeCloseTo(470, 6);
    }
  });

  it('las parcelas libres responden dentro de su elipse y no fuera', () => {
    const s = SLOTS.quarry;
    expect(hitTestBuildings(s.x, s.y, levels(), {})).toBe('quarry');
    expect(hitTestBuildings(s.x + s.plot.rx + 5, s.y, levels(), {})).not.toBe('quarry');
  });

  it('la silueta transparente de un edificio no intercepta al que tiene detrás', () => {
    // Punto dentro del cuadro del castillo (delante) pero en un píxel transparente, sobre el almacén (detrás).
    const w = SLOTS.warehouse;
    const castleBox = spriteBox('castle');
    const x = w.x + 20;
    const y = w.y - 10;
    expect(x).toBeGreaterThan(castleBox.left);
    expect(y).toBeGreaterThan(castleBox.top);
    const masks: Masks = { castle: empty(), warehouse: solid(), farm: empty() };
    expect(hitTestBuildings(x, y, levels(), masks)).toBe('warehouse');
    // si el castillo fuera opaco en ese punto, ganaría por estar delante
    expect(hitTestBuildings(x, y, levels(), { ...masks, castle: solid() })).toBe('castle');
  });
});
