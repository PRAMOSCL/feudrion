import { describe, expect, it } from 'vitest';
import { DISTRICTS, PLANNED_BUILDINGS, PLOTS } from '../../../server/src/config/districts';
import { BUILDING_TYPES } from '../../../server/src/config/balance';
import { DISTRICT_DEFINITIONS, FORTRESS, VILLAGE, VILLAGE_H, VILLAGE_W, VILLAGE_WALL_MARGIN } from './districtConfig';
import { hitTestPlots, planShapes, plotRect, rectToPolylineDistance, validateDistrict } from './planGeometry';
import type { DistrictDefinition, PlotGeometry } from './types';

describe('coherencia cliente ↔ servidor (IDs estables)', () => {
  it('toda parcela del servidor de un distrito con escena tiene geometría, y viceversa', () => {
    for (const def of Object.values(DISTRICT_DEFINITIONS)) {
      const server = PLOTS.filter((p) => p.districtId === def!.id).map((p) => p.id).sort();
      expect(def!.plots.map((p) => p.id).sort(), def!.id).toEqual(server);
    }
  });
  it('los tipos permitidos de cada parcela coinciden con los del servidor', () => {
    for (const def of Object.values(DISTRICT_DEFINITIONS)) {
      for (const p of def!.plots) expect([...p.allowedTypes].sort(), p.id).toEqual([...PLOTS.find((q) => q.id === p.id)!.allowedTypes].sort());
    }
  });
  it('estado y nombre de los distritos coinciden con el servidor', () => {
    for (const def of Object.values(DISTRICT_DEFINITIONS)) {
      const s = DISTRICTS.find((d) => d.id === def!.id)!;
      expect([def!.name, def!.status]).toEqual([s.name, s.status]);
    }
  });
  it('Oficios y Campo no tienen escena (no se simulan)', () => {
    expect(DISTRICT_DEFINITIONS.crafts).toBeUndefined();
    expect(DISTRICT_DEFINITIONS.countryside).toBeUndefined();
  });
  it('cada edificio planificado tiene su parcela en la Villa', () => {
    for (const b of PLANNED_BUILDINGS) expect(VILLAGE.plots.some((p) => p.id === b.plotId)).toBe(true);
  });
  it('la Fortaleza tiene una parcela por edificio existente y conserva sus anclas', () => {
    expect(FORTRESS.plots.map((p) => p.id).sort()).toEqual(BUILDING_TYPES.map((t) => `fortress:${t}`).sort());
  });
});

describe('plano de la Villa (provisional)', () => {
  it('usa el terreno limpio de la Villa y sigue marcado como provisional (parcelas planificadas)', () => {
    expect(VILLAGE.provisional).toBe(true);
    expect(VILLAGE.terrainAsset).toMatch(/terrain_village.png$/);
  });
  it('ninguna parcela invade un corredor, todas tienen acceso, todo está conectado a la entrada y respeta la franja de muralla', () => {
    expect(validateDistrict(VILLAGE, VILLAGE_WALL_MARGIN)).toEqual([]);
  });
  it('hay un corredor continuo de entrada y salidas hacia Oficios y Campo', () => {
    const kinds = VILLAGE.routes.map((r) => r.kind);
    expect(kinds).toContain('entrance');
    expect(kinds).toContain('exit');
    const last = (id: string) => VILLAGE.routes.find((r) => r.id === id)!.points.at(-1)!;
    expect(last('ramal_este')[0]).toBeGreaterThan(VILLAGE_W * 0.94);
    expect(last('calle_sur')[1]).toBeGreaterThan(VILLAGE_H * 0.94);
  });
  it('ninguna parcela se superpone con otra', () => {
    for (const a of VILLAGE.plots) {
      for (const b of VILLAGE.plots) {
        if (a.id >= b.id) continue;
        const r = plotRect(a);
        const s = plotRect(b);
        const overlap = r.x0 < s.x1 && s.x0 < r.x1 && r.y0 < s.y1 && s.y0 < r.y1;
        expect(overlap, `${a.id} vs ${b.id}`).toBe(false);
      }
    }
  });
  it('el clic (inversa de la transformación) elige la parcela correcta y no una calle', () => {
    for (const p of VILLAGE.plots) expect(hitTestPlots(p.anchor[0], p.anchor[1], VILLAGE.plots)?.id).toBe(p.id);
    expect(hitTestPlots(VILLAGE_W * 0.12, VILLAGE_H * 0.18, VILLAGE.plots)).toBeNull(); // la entrada no es una parcela
  });
});

describe('añadir una parcela sin tocar el renderer ni la geometría central', () => {
  const extra: PlotGeometry = {
    id: 'village:casas_este',
    districtId: 'village',
    anchor: [1180, 800],
    footprint: { kind: 'rect', hx: 60, hy: 50 },
    allowedTypes: ['house'],
    interaction: 'footprint',
    access: [1180, 740],
    depth: 800,
  };
  it('la parcela nueva se dibuja (planShapes), se selecciona (hitTest) y se valida con las mismas funciones', () => {
    const extended: DistrictDefinition = { ...VILLAGE, plots: [...VILLAGE.plots, extra] };
    expect(planShapes(extended).plots.some((s) => s.id === extra.id)).toBe(true);
    expect(hitTestPlots(1180, 800, extended.plots)?.id).toBe(extra.id);
    // sin calle cercana, el validador lo detecta (no se acepta una parcela inaccesible)
    expect(validateDistrict(extended, VILLAGE_WALL_MARGIN).some((m) => m.includes(extra.id))).toBe(true);
  });
  it('una parcela puesta sobre una calle se rechaza', () => {
    const bad: PlotGeometry = { ...extra, id: 'village:mala', anchor: [800, 200], access: null };
    const bandit = validateDistrict({ ...VILLAGE, plots: [...VILLAGE.plots, { ...bad, anchor: [VILLAGE.routes.find((r) => r.id === 'calle_oeste')!.points[3][0], VILLAGE.routes.find((r) => r.id === 'calle_oeste')!.points[3][1]] }] }, VILLAGE_WALL_MARGIN);
    expect(bandit.some((m) => m.includes('invade el corredor'))).toBe(true);
  });
  it('rectToPolylineDistance mide bien', () => {
    expect(rectToPolylineDistance({ x0: 0, y0: 0, x1: 10, y1: 10 }, [[20, 5], [20, 50]])).toBe(10);
    expect(rectToPolylineDistance({ x0: 0, y0: 0, x1: 10, y1: 10 }, [[5, -5], [5, 20]])).toBe(0);
  });
});
