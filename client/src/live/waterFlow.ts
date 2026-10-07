import riverData from './riverV31.json';

/**
 * Corriente y espuma del río (adaptación de `reference/waterFlow.mjs` del parche v3.1). Sin bucle propio: el renderer lo llama con el
 * tiempo en SEGUNDOS desde su único RAF. Fuente estable = terreno original recortado a la máscara (nunca los fotogramas ya dibujados).
 *
 * - Textura en desplazamiento: cada región dibuja el agua del terreno desplazada a lo largo de `flow` con DOS fases cruzadas (0 y 0,5),
 *   ponderadas triangularmente, para que no haya salto al reiniciar el ciclo.
 * - Espuma: trazos advectados por `flow`; en las cascadas caen continuamente (flujo vertical/oblicuo).
 * - El alfa de la máscara es el recorte final: nada se dibuja fuera del cauce.
 */

type Pt = [number, number];
interface Region {
  polygon: Pt[];
  flow: [number, number];
  cascade: boolean;
  particleCount: number;
  box: { x0: number; y0: number; w: number; h: number };
}

const W = 1536;
const H = 1024;
const frac = (n: number) => n - Math.floor(n);

export const WATER_MAX_FPS: number = riverData.maxFps;

function tracePolygon(ctx: CanvasRenderingContext2D, pts: readonly Pt[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

const makeCanvas = () => {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
};

export interface WaterFlow {
  /** Dibuja la capa de agua en el instante `time` (s) sobre `target` (lienzo 1536×1024, sin transformación). */
  draw(target: CanvasRenderingContext2D, time: number): void;
}

export function makeWaterFlow(terrain: CanvasImageSource, mask: CanvasImageSource): WaterFlow {
  const source = makeCanvas();
  const sc = source.getContext('2d')!;
  sc.drawImage(terrain, 0, 0);
  sc.globalCompositeOperation = 'destination-in';
  sc.drawImage(mask, 0, 0);
  const layer = makeCanvas();
  const lc = layer.getContext('2d')!;

  const regions: Region[] = [
    ...riverData.patches.map((p) => ({ polygon: p.polygon as Pt[], flow: p.flow as [number, number], cascade: false, particleCount: p.particleCount })),
    ...riverData.falls.map((p) => ({ polygon: p.polygon as Pt[], flow: p.flow as [number, number], cascade: true, particleCount: 34 })),
  ].map((r) => {
    const xs = r.polygon.map((v) => v[0]);
    const ys = r.polygon.map((v) => v[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return { ...r, box: { x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 } };
  });

  function render(time: number): void {
    lc.clearRect(0, 0, W, H);
    regions.forEach((p, index) => {
      const { x0, y0, w, h } = p.box;
      const len = Math.hypot(p.flow[0], p.flow[1]);
      const vx = p.flow[0] / len;
      const vy = p.flow[1] / len;
      const period = p.cascade ? 22 : 16;
      const speed = p.cascade ? 38 : 18;
      lc.save();
      tracePolygon(lc, p.polygon);
      lc.clip();
      const pad = 14;
      const sx = Math.max(0, x0 - pad);
      const sy = Math.max(0, y0 - pad);
      const sw = Math.min(W, sx + w + pad * 2) - sx;
      const sh = Math.min(H, sy + h + pad * 2) - sy;
      for (const offset of [0, 0.5]) {
        const phase = frac((time * speed) / period + index * 0.173 + offset);
        const weight = 1 - Math.abs(phase * 2 - 1);
        const distance = (phase - 0.5) * period;
        const dx = vx * distance + Math.sin(time * 3 + index) * 0.75;
        const dy = vy * distance;
        lc.globalAlpha = weight * (p.cascade ? 0.86 : 0.72);
        lc.drawImage(source, sx, sy, sw, sh, sx + dx, sy + dy, sw, sh);
      }
      lc.globalAlpha = 1;
      lc.lineCap = 'round';
      const n = p.cascade ? 34 : Math.max(10, p.particleCount);
      for (let k = 0; k < n; k++) {
        const x = x0 + frac(k * 0.618 + (time * speed * vx) / w + index * 0.27) * w;
        const y = y0 + frac(k * 0.381 + (time * speed * vy) / h + index * 0.19) * h;
        const alpha = (p.cascade ? 0.62 : 0.35) * (0.55 + 0.45 * Math.sin(time * 2 + k) ** 2);
        lc.strokeStyle = `rgba(239,255,254,${alpha})`;
        lc.lineWidth = p.cascade ? 1.8 : 1.3;
        const l = p.cascade ? 9 + (k % 9) : 5 + (k % 5);
        lc.beginPath();
        lc.moveTo(x, y);
        lc.lineTo(x + vx * l, y + vy * l);
        lc.stroke();
      }
      lc.restore();
    });
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(mask, 0, 0);
    lc.globalCompositeOperation = 'source-over';
  }

  return {
    draw(target, time) {
      render(time);
      target.drawImage(layer, 0, 0);
    },
  };
}
