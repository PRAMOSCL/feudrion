import occlusionV3 from './occlusionV3.json';
import { circuitLength, sampleCircuit, type PatrolCircuit, type PatrolSegment } from './patrolCircuit';
import type { Pt } from './routes';

/**
 * Guardias del circuito completo: estado de progreso y máscaras de oclusión locales. Lógica sin dibujo (el renderer solo pinta).
 */

export interface GuardPose {
  /** PIES del guardia (nunca el centro del sprite). */
  x: number;
  y: number;
  /** true si camina hacia la izquierda (espejo horizontal). */
  flip: boolean;
  /** false en tramos ocultos (torres): no se dibuja, pero SU DISTANCIA SIGUE AVANZANDO. */
  visible: boolean;
  layer: 'back' | 'front';
  segment: PatrolSegment;
  height: number;
  /** Distancia total recorrida (sin módulo): gobierna la fase de la caminata. */
  distance: number;
}

/**
 * Progreso de los guardias. Cada uno avanza a velocidad uniforme: d_i(t) = base_i + velocidad·t (px a lo largo de la polilínea del circuito).
 * - Al refrescar el estado del servidor NO se reinicia: el progreso vive aquí, no en el estado.
 * - Al cambiar de etapa se traslada la FRACCIÓN recorrida al nuevo circuito (longitudes ligeramente distintas).
 * - Si cambia el número de guardias, el primero conserva su progreso y los demás se reparten por igual a lo largo del perímetro.
 */
export class GuardTracker {
  private bases: number[] = [];
  private stage = 0;
  private total = 0;

  get count(): number {
    return this.bases.length;
  }

  /** Sincroniza con el modelo (etapa 0 o sin guardias → ninguno). `t` = reloj de la escena (s), `speed` = px/s. */
  sync(stage: 0 | 1 | 2 | 3, count: number, circuits: Record<1 | 2 | 3, PatrolCircuit>, t: number, speed: number): void {
    if (stage === 0 || count <= 0) {
      this.bases = [];
      this.stage = stage;
      this.total = 0;
      return;
    }
    const total = circuitLength(circuits[stage]);
    if (this.bases.length === 0) {
      this.bases = Array.from({ length: count }, (_, i) => (i * total) / count - speed * t);
    } else {
      if (this.stage !== stage && this.total > 0) {
        // misma fracción de vuelta en el circuito nuevo (sin salto visible de posición relativa)
        this.bases = this.bases.map((b) => {
          const frac = ((((b + speed * t) % this.total) + this.total) % this.total) / this.total;
          return frac * total - speed * t;
        });
      }
      if (this.bases.length !== count) {
        const first = this.bases[0];
        this.bases = Array.from({ length: count }, (_, i) => first + (i * total) / count);
      }
    }
    this.stage = stage;
    this.total = total;
  }

  poses(circuit: PatrolCircuit, t: number, speed: number): GuardPose[] {
    return this.bases.map((b) => {
      const distance = b + speed * t;
      const s = sampleCircuit(circuit, distance);
      return { x: s.x, y: s.y, flip: s.dx < 0, visible: s.segment.visibility === 'visible', layer: s.segment.layer, segment: s.segment, height: s.segment.spriteHeight, distance };
    });
  }
}

/* ---------- Máscaras de oclusión locales ---------- */

export interface LocalMask {
  canvas: HTMLCanvasElement;
  /** Esquina superior izquierda de la máscara en coordenadas de escena. */
  x: number;
  y: number;
}

type OcclusionEntry = { polygon: Pt[]; operation: string };
export const OCCLUSION = occlusionV3 as unknown as Record<string, Record<string, OcclusionEntry>>;

/** bbox entero de un polígono, recortado a la escena. */
export function polygonBox(poly: readonly Pt[], w: number, h: number) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.max(0, Math.floor(Math.min(...xs)));
  const y = Math.max(0, Math.floor(Math.min(...ys)));
  return { x, y, w: Math.min(w, Math.ceil(Math.max(...xs)) + 1) - x, h: Math.min(h, Math.ceil(Math.max(...ys)) + 1) - y };
}

/**
 * Máscara de UN tramo: polígono local ∩ alfa del PNG exacto de esa muralla, recortada a su bounding box (como `demo-core.mjs`),
 * así no hay treinta canvases de escena completa ni se lee el alfa en cada fotograma.
 */
export function buildLocalMask(wall: CanvasImageSource, poly: readonly Pt[], sceneW: number, sceneH: number): LocalMask {
  const b = polygonBox(poly, sceneW, sceneH);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, b.w);
  canvas.height = Math.max(1, b.h);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(-b.x, -b.y);
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(wall, 0, 0);
  return { canvas, x: b.x, y: b.y };
}

/** Los guardias visibles de un circuito necesitan máscara en todos sus tramos `wall_walk` y `gate_platform`. */
export const maskedSegmentIds = (stage: 1 | 2 | 3): string[] => Object.keys(OCCLUSION[String(stage)] ?? {});
