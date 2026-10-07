/** Utilidades puras de rutas (sin DOM) para actores de la ciudad viva. */

export type Pt = readonly [number, number];

export interface Pose {
  x: number;
  y: number;
  /** true si el actor camina hacia la izquierda (espejo horizontal). */
  flip: boolean;
  /** false mientras espera (parada o pausa de giro). */
  moving: boolean;
  /** Distancia total recorrida caminando (px, acumulada en ida y vuelta; no cuenta esperas): gobierna la fase de la caminata. */
  walked: number;
}

export function segmentLengths(points: readonly Pt[]): number[] {
  return points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
}

export const routeLength = (points: readonly Pt[]): number => segmentLengths(points).reduce((a, b) => a + b, 0);

/** Punto a distancia `d` (px) del inicio, recorriendo la ruta en un sentido. */
export function pointAtDistance(points: readonly Pt[], d: number): { x: number; y: number; segment: number; flip: boolean } {
  const lengths = segmentLengths(points);
  let left = Math.max(0, d);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const u = lengths[i] === 0 ? 0 : Math.min(1, left / lengths[i]);
      const a = points[i];
      const b = points[i + 1];
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, segment: i, flip: b[0] < a[0] };
    }
    left -= lengths[i];
  }
  return { x: points[0][0], y: points[0][1], segment: 0, flip: false };
}

/**
 * Ida y vuelta por la ruta a `speed` px/s con una pausa breve (`turnPause` s) en cada extremo y paradas opcionales
 * (`stops`: índices de punto donde espera `dwell` s en cada pasada). Determinista: depende solo de `time`.
 * No hay sprites de giro: el cambio de rumbo se resuelve con la pausa y el espejo horizontal.
 */
export function pingPong(
  points: readonly Pt[],
  time: number,
  speed: number,
  opts: { stops?: readonly number[]; dwell?: number; turnPause?: number } = {},
): Pose {
  const dwell = opts.dwell ?? 0;
  const turnPause = opts.turnPause ?? 0.6;
  const stops = (opts.stops ?? []).filter((s) => s > 0 && s < points.length - 1);
  const lengths = segmentLengths(points);
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total === 0 || speed <= 0) return { x: points[0][0], y: points[0][1], flip: false, moving: false, walked: 0 };

  const cumulative = [0];
  for (const l of lengths) cumulative.push(cumulative[cumulative.length - 1] + l);
  const stopDistances = stops.map((s) => cumulative[s]);

  // Una pasada completa: marcha + esperas en paradas + pausa final.
  const pass = total / speed + stopDistances.length * dwell + turnPause;
  const cycle = pass * 2;
  let t = ((time % cycle) + cycle) % cycle;
  const reverse = t >= pass;
  if (reverse) t -= pass;

  // Recorre la pasada en orden (ida) o con las paradas en orden inverso (vuelta).
  const ordered = (reverse ? [...stopDistances].reverse().map((d) => total - d) : stopDistances).sort((a, b) => a - b);
  let walked = 0; // distancia ya avanzada en esta pasada
  let remaining = t;
  for (const stopAt of ordered) {
    const toStop = (stopAt - walked) / speed;
    if (remaining <= toStop) {
      walked += remaining * speed;
      return withPose(points, walked, reverse, true);
    }
    remaining -= toStop;
    walked = stopAt;
    if (remaining <= dwell) return withPose(points, walked, reverse, false);
    remaining -= dwell;
  }
  const toEnd = (total - walked) / speed;
  if (remaining <= toEnd) {
    walked += remaining * speed;
    return withPose(points, walked, reverse, true);
  }
  return withPose(points, total, reverse, false); // pausa de giro al final
}

function withPose(points: readonly Pt[], distance: number, reverse: boolean, moving: boolean): Pose {
  const total = routeLength(points);
  const d = reverse ? total - distance : distance;
  const p = pointAtDistance(points, d);
  return { x: p.x, y: p.y, flip: reverse ? !p.flip : p.flip, moving, walked: reverse ? total + distance : distance };
}
