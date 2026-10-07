import type { DistrictDefinition, PlotGeometry, Pt, RouteDef } from './types';

/** Geometría genérica de parcelas y calles: sirve a cualquier distrito, sin conocer ningún edificio concreto. */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function plotRect(p: PlotGeometry): Rect {
  const [x, y] = p.anchor;
  const hx = p.footprint.kind === 'rect' ? p.footprint.hx : p.footprint.rx;
  const hy = p.footprint.kind === 'rect' ? p.footprint.hy : p.footprint.ry;
  return { x0: x - hx, y0: y - hy, x1: x + hx, y1: y + hy };
}

/** Parcela bajo (x, y) de la escena; gana la de mayor profundidad (más cercana a la cámara). */
export function hitTestPlots(x: number, y: number, plots: readonly PlotGeometry[]): PlotGeometry | null {
  let best: PlotGeometry | null = null;
  for (const p of plots) {
    const [ax, ay] = p.anchor;
    let inside: boolean;
    if (p.footprint.kind === 'ellipse') {
      const dx = (x - ax) / p.footprint.rx;
      const dy = (y - ay) / p.footprint.ry;
      inside = dx * dx + dy * dy <= 1;
    } else {
      inside = Math.abs(x - ax) <= p.footprint.hx && Math.abs(y - ay) <= p.footprint.hy;
    }
    if (inside && (!best || p.depth > best.depth)) best = p;
  }
  return best;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function distToPolyline(p: Pt, pts: readonly Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSegment(p, pts[i], pts[i + 1]));
  return d;
}

const orient = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const segmentsIntersect = (p1: Pt, p2: Pt, p3: Pt, p4: Pt) => orient(p1, p2, p3) !== orient(p1, p2, p4) && orient(p3, p4, p1) !== orient(p3, p4, p2);

/** Distancia mínima de un rectángulo a una polilínea (0 si se cortan o la polilínea entra en él). */
export function rectToPolylineDistance(r: Rect, pts: readonly Pt[]): number {
  const inside = (q: Pt) => q[0] >= r.x0 && q[0] <= r.x1 && q[1] >= r.y0 && q[1] <= r.y1;
  const corners: Pt[] = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
  const edges: [Pt, Pt][] = corners.map((c, i) => [c, corners[(i + 1) % 4]]);
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    if (inside(pts[i]) || inside(pts[i + 1])) return 0;
    for (const [a, b] of edges) {
      if (segmentsIntersect(pts[i], pts[i + 1], a, b)) return 0;
      d = Math.min(d, distToSegment(a, pts[i], pts[i + 1]), distToSegment(b, pts[i], pts[i + 1]), distToSegment(pts[i], a, b), distToSegment(pts[i + 1], a, b));
    }
  }
  return d;
}

const circulation = (d: DistrictDefinition): RouteDef[] =>
  d.routes.filter((r) => r.kind === 'street' || r.kind === 'entrance' || r.kind === 'exit' || r.kind === 'open_area');

/**
 * Problemas de una escena (lista vacía = coherente): parcelas duplicadas, superposición con corredores, falta de acceso,
 * corredores desconectados de la entrada e invasión de la franja de muralla futura (`wallMargin`).
 */
export function validateDistrict(d: DistrictDefinition, wallMargin = 0): string[] {
  const issues: string[] = [];
  const routes = circulation(d);
  const ids = new Set<string>();
  for (const p of d.plots) {
    if (ids.has(p.id)) issues.push(`parcela duplicada: ${p.id}`);
    ids.add(p.id);
    const r = plotRect(p);
    for (const rt of routes) {
      const dist = rectToPolylineDistance(r, rt.points);
      if (dist < rt.halfWidth) issues.push(`la parcela ${p.id} invade el corredor ${rt.id} (${dist.toFixed(1)} < ${rt.halfWidth})`);
    }
    if (p.access) {
      const near = Math.min(...routes.map((rt) => distToPolyline(p.access!, rt.points) - rt.halfWidth));
      if (near > 0.5) issues.push(`la parcela ${p.id} no tiene acceso a ninguna calle (a ${near.toFixed(1)})`);
    }
    if (wallMargin > 0 && (r.x0 < wallMargin || r.y0 < wallMargin || r.x1 > d.sceneBounds.w - wallMargin || r.y1 > d.sceneBounds.h - wallMargin)) {
      issues.push(`la parcela ${p.id} invade la franja reservada para la muralla`);
    }
  }
  const touch = (a: RouteDef, b: RouteDef) => {
    const tol = a.halfWidth + b.halfWidth;
    return a.points.some((q) => distToPolyline(q, b.points) <= tol) || b.points.some((q) => distToPolyline(q, a.points) <= tol);
  };
  const entry = routes.find((r) => r.kind === 'entrance');
  if (!entry) issues.push('no hay corredor de entrada');
  else {
    const seen = new Set([entry.id]);
    const queue = [entry];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const o of routes) {
        if (!seen.has(o.id) && touch(cur, o)) {
          seen.add(o.id);
          queue.push(o);
        }
      }
    }
    for (const r of routes) if (!seen.has(r.id)) issues.push(`el corredor ${r.id} no está conectado con la entrada`);
  }
  return issues;
}

/** Formas para dibujar un plano: depende solo de la definición, así que una parcela nueva aparece sin tocar el renderer. */
export function planShapes(d: DistrictDefinition) {
  return {
    plots: d.plots.map((p) => ({ id: p.id, rect: plotRect(p), anchor: p.anchor })),
    corridors: d.routes.filter((r) => r.kind !== 'villagers' && r.kind !== 'patrol'),
    zones: d.exclusions,
  };
}
