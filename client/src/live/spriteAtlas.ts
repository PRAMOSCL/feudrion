/**
 * Hojas de sprites de 3 columnas × 2 filas (6 poses). Se mide el alfa REAL de cada pose para fijar el pivote
 * (centro horizontal y pies de la figura opaca) y se normaliza la altura sin escalar cada cuerpo por separado,
 * así los pies no «bailan» entre poses.
 */

export interface Frame {
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** Centro horizontal de la figura opaca dentro de la celda. */
  cx: number;
  /** Fila del píxel más bajo opaco (los pies). */
  bottom: number;
  top: number;
}

export interface Atlas {
  img: HTMLImageElement;
  items: Frame[];
  /** Altura de la pose más alta: referencia común de escala. */
  maxHeight: number;
}

import atlasV2 from './atlasV2.json';

const ALPHA_THRESHOLD = 160;
const cache = new Map<string, Promise<Atlas>>();

export function loadAtlas(src: string): Promise<Atlas> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise<Atlas>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ img, ...measure(img) });
      img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

function measure(img: HTMLImageElement): { items: Frame[]; maxHeight: number } {
  const cw = img.width / 3;
  const ch = img.height / 2;
  const tmp = document.createElement('canvas');
  tmp.width = cw;
  tmp.height = ch;
  const tc = tmp.getContext('2d', { willReadFrequently: true })!;
  const items: Frame[] = [];
  for (let i = 0; i < 6; i++) {
    tc.clearRect(0, 0, cw, ch);
    const sx = (i % 3) * cw;
    const sy = Math.floor(i / 3) * ch;
    tc.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
    const data = tc.getImageData(0, 0, cw, ch).data;
    let l = cw;
    let r = 0;
    let top = ch;
    let bottom = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (data[(y * cw + x) * 4 + 3] > ALPHA_THRESHOLD) {
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    items.push({ sx, sy, w: cw, h: ch, cx: (l + r) / 2, bottom, top });
  }
  return { items, maxHeight: Math.max(...items.map((f) => f.bottom - f.top)) };
}

export interface ScaledFrame {
  canvas: HTMLCanvasElement;
  /** Pivote (pies) dentro del canvas reducido. */
  px: number;
  py: number;
}

const scaledCache = new Map<string, ScaledFrame>();

/**
 * Pose reducida al tamaño de pantalla con reducción progresiva a la mitad (mucho más limpia que un único drawImage 10:1),
 * guardada en caché por hoja/pose/altura. La escala la fija la pose más alta de la hoja, así los cuerpos no cambian de tamaño entre poses.
 */
export function scaledFrame(atlas: Atlas, key: string, index: number, height: number): ScaledFrame {
  const id = `${key}:${index}:${Math.round(height)}`;
  const hit = scaledCache.get(id);
  if (hit) return hit;
  const f = atlas.items[index];
  const s = height / atlas.maxHeight;
  const outW = Math.max(1, Math.round(f.w * s));
  const outH = Math.max(1, Math.round(f.h * s));
  let cur = document.createElement('canvas');
  cur.width = f.w;
  cur.height = f.h;
  cur.getContext('2d')!.drawImage(atlas.img, f.sx, f.sy, f.w, f.h, 0, 0, f.w, f.h);
  while (cur.width / 2 > outW) {
    const next = document.createElement('canvas');
    next.width = Math.ceil(cur.width / 2);
    next.height = Math.ceil(cur.height / 2);
    const nc = next.getContext('2d')!;
    nc.imageSmoothingQuality = 'high';
    nc.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const oc = out.getContext('2d')!;
  oc.imageSmoothingQuality = 'high';
  oc.drawImage(cur, 0, 0, outW, outH);
  const frame = { canvas: out, px: f.cx * s, py: f.bottom * s };
  scaledCache.set(id, frame);
  return frame;
}

export type SheetV2Key = keyof typeof atlasV2.sheets;

/**
 * Hojas de caminata v2: ocho figuras con RECTÁNGULOS explícitos y pivotes (atlas-v2.json), NO una cuadrícula 3×2.
 * El pivote es relativo al rectángulo (centro de los pies). Todas las poses comparten una única escala
 * (altura pedida / referenceHeight); nunca se normaliza cada pose por separado.
 */
export function loadAtlasV2(src: string, key: SheetV2Key): Promise<Atlas> {
  const id = 'v2:' + src;
  let p = cache.get(id);
  if (!p) {
    const def = atlasV2.sheets[key];
    p = new Promise<Atlas>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const items: Frame[] = def.order.map((i) => {
          const f = def.frames[i];
          const [sx, sy, w, h] = f.rect;
          return { sx, sy, w, h, cx: f.pivot[0], bottom: f.pivot[1], top: 0 };
        });
        resolve({ img, items, maxHeight: def.referenceHeight });
      };
      img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      img.src = src;
    });
    cache.set(id, p);
  }
  return p;
}
