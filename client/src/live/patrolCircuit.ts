import { PATROL_CIRCUITS_V3 } from './patrolCircuitsV3';
import { pointAtDistance, type Pt } from './routes';

/**
 * Patrulla COMPLETA: grafo CERRADO de segmentos con dirección. Los datos (19 segmentos por etapa) vienen del paquete de arte v3
 * (`patrolCircuitsV3.ts`, validados por `validateCircuit`). Cada segmento lleva los PIES del guardia (no el centro del sprite), su
 * visibilidad (visible/oculto, p. ej. dentro de una torre), la capa en la que se dibuja y sus conexiones; los cambios de capa ocurren
 * dentro de pasos ocultos. La ruta norte antigua ya no existe.
 */

export type PatrolSide = 'north' | 'east' | 'south' | 'west';

export type SegmentKind =
  /** Tramo recto de camino de ronda sobre el parapeto de un lado de la muralla. */
  | 'wall_walk'
  /** Paso por una torre: el guardia entra y sale; normalmente oculto en el interior. */
  | 'tower_pass'
  /** Plataforma sobre el portón (une dos tramos a ambos lados del arco). */
  | 'gate_platform';

export interface PatrolSegment {
  /** ID estable y único dentro del circuito. */
  id: string;
  side: PatrolSide;
  kind: SegmentKind;
  /** Puntos de apoyo de los PIES en coordenadas de la escena (mínimo 2), en el sentido de marcha. */
  feet: readonly Pt[];
  /** «visible»: se dibuja; «hidden»: el guardia no se ve (interior de torre, tras un parapeto alto). */
  visibility: 'visible' | 'hidden';
  /** Capa en la que se dibuja: «back» (tras edificios/actores) o «front» (sobre ellos, junto al frente de la muralla). */
  layer: 'back' | 'front';
  /** Altura visual del sprite sobre el camino de ronda (px de escena); distinta por etapa/tramo si el parapeto cambia. */
  spriteHeight: number;
  /** IDs de los segmentos a los que se puede pasar al terminar este (en el sentido de marcha). */
  next: readonly string[];
}

export interface PatrolCircuit {
  /** Etapa de muralla a la que pertenece (los caminos de ronda cambian con el aspecto). */
  stage: 1 | 2 | 3;
  segments: readonly PatrolSegment[];
}

/** Circuitos por etapa de muralla (1 empalizada, 2 piedra, 3 reforzada). */
export const PATROL_CIRCUITS: Record<1 | 2 | 3, PatrolCircuit> = PATROL_CIRCUITS_V3;

/** Longitud (px) de un segmento. */
export const segmentLength = (s: PatrolSegment): number => s.feet.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s.feet[i][0], p[1] - s.feet[i][1]), 0);

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Valida un circuito (lista vacía = válido): IDs únicos, ≥ 2 puntos por segmento, conexiones existentes, continuidad de los pies entre
 * segmentos enlazados (tolerancia `joinTolerance`), cobertura de los cuatro lados, un paso por torre entre tramos distintos, plataforma
 * del portón, y que sea CERRADO (todo segmento alcanzable desde el primero y con camino de vuelta a él).
 */
export function validateCircuit(c: PatrolCircuit, joinTolerance = 6): string[] {
  const issues: string[] = [];
  const byId = new Map(c.segments.map((s) => [s.id, s]));
  if (byId.size !== c.segments.length) issues.push('IDs de segmento duplicados');
  for (const s of c.segments) {
    if (s.feet.length < 2) issues.push(`${s.id}: menos de 2 puntos de apoyo`);
    if (s.spriteHeight <= 0) issues.push(`${s.id}: altura visual inválida`);
    if (s.next.length === 0) issues.push(`${s.id}: sin segmento siguiente (el circuito no es cerrado)`);
    for (const n of s.next) {
      const t = byId.get(n);
      if (!t) {
        issues.push(`${s.id}: apunta a «${n}», que no existe`);
        continue;
      }
      const gap = dist(s.feet[s.feet.length - 1], t.feet[0]);
      if (gap > joinTolerance) issues.push(`${s.id} → ${n}: los pies saltan ${gap.toFixed(1)} px entre segmentos`);
    }
  }
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    if (!c.segments.some((s) => s.side === side && s.kind === 'wall_walk')) issues.push(`falta el tramo ${side}`);
  }
  if (!c.segments.some((s) => s.kind === 'gate_platform')) issues.push('falta la plataforma sobre el portón');
  if (!c.segments.some((s) => s.kind === 'tower_pass')) issues.push('faltan pasos por torres');
  for (const s of c.segments) {
    if (s.kind === 'tower_pass' && s.visibility !== 'hidden') issues.push(`${s.id}: el paso por torre debe ser oculto`);
  }
  if (c.segments.length) {
    const reach = (from: string, edges: (s: PatrolSegment) => readonly string[]) => {
      const seen = new Set([from]);
      const queue = [from];
      while (queue.length) {
        const cur = byId.get(queue.shift()!);
        for (const n of cur ? edges(cur) : []) if (byId.has(n) && !seen.has(n)) (seen.add(n), queue.push(n));
      }
      return seen;
    };
    const start = c.segments[0].id;
    const fwd = reach(start, (s) => s.next);
    const rev = new Map<string, string[]>();
    for (const s of c.segments) for (const n of s.next) rev.set(n, [...(rev.get(n) ?? []), s.id]);
    const back = new Set([start]);
    const q = [start];
    while (q.length) for (const p of rev.get(q.shift()!) ?? []) if (!back.has(p)) (back.add(p), q.push(p));
    for (const s of c.segments) {
      if (!fwd.has(s.id)) issues.push(`${s.id}: inalcanzable desde ${start}`);
      if (!back.has(s.id)) issues.push(`${s.id}: no vuelve a ${start} (circuito abierto)`);
    }
  }
  return issues;
}

/** Longitud total de un circuito (suma de segmentos). */
export const circuitLength = (c: PatrolCircuit): number => c.segments.reduce((a, s) => a + segmentLength(s), 0);

/** Longitud total (px) del circuito: la distancia de una vuelta. */
export const circuitTotal = circuitLength;

export interface CircuitSample {
  x: number;
  y: number;
  /** Dirección de marcha del tramo (para el espejo horizontal). */
  dx: number;
  dy: number;
  segment: PatrolSegment;
  /** Distancia recorrida dentro del segmento. */
  inSegment: number;
}

/**
 * Posición de los PIES a la distancia acumulada `d` (px) a lo largo del circuito, siguiendo la polilínea de cada segmento y cerrando la vuelta.
 * Velocidad uniforme: avanzar `d` a razón constante da una marcha continua, sin saltos en las uniones (comparten el mismo punto).
 */
export function sampleCircuit(c: PatrolCircuit, d: number): CircuitSample {
  const total = circuitLength(c);
  let rest = ((d % total) + total) % total;
  for (const s of c.segments) {
    const len = segmentLength(s);
    if (rest < len || s === c.segments[c.segments.length - 1]) {
      const p = pointAtDistance(s.feet, rest);
      const a = s.feet[p.segment];
      const b = s.feet[p.segment + 1];
      return { x: p.x, y: p.y, dx: b[0] - a[0], dy: b[1] - a[1], segment: s, inSegment: rest };
    }
    rest -= len;
  }
  const f = c.segments[0].feet;
  return { x: f[0][0], y: f[0][1], dx: 1, dy: 0, segment: c.segments[0], inSegment: 0 };
}
