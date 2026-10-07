import { useEffect, useState } from 'react';
import { ART } from '../artManifest';
import { SCENE_H, SCENE_W } from '../sceneConfig';
import type { WallMask } from '../sceneGeometry';
import { WALL_HOLES, WALL_REVEAL_SECTIONS, WALL_SPLIT_Y, WALL_TRANSFORM } from './liveConfig';
import type { WallVisual } from './liveModel';

/** Ruta `clip-path` (evenodd) de una banda horizontal del overlay, limitada a `maxX` y con los huecos configurados. */
export function bandPath(y0: number, y1: number, maxX: number, holes: [number, number][][]): string {
  const rect = `M0 ${y0} H${maxX} V${y1} H0 Z`;
  const cut = holes.map((poly) => poly.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + ' Z').join(' ');
  return `path(evenodd, '${rect} ${cut}')`;
}

interface Props {
  visual: WallVisual;
  highlighted: boolean;
}

/**
 * Overlays de muralla. Dos capas con el mismo PNG y distinto recorte: el FONDO (por encima del terreno y por DEBAJO de edificios y
 * personajes) y el FRENTE (por encima de todo, con el portón abierto). Se dibujan en el mismo sistema de coordenadas que el resto
 * de la escena y con una transformación explícita por aspecto (`WALL_TRANSFORM`).
 */
export function WallLayers({ visual, highlighted }: Props) {
  const stage = visual.stage || visual.reveal?.stage || 0;
  const src = stage ? ART.walls[stage as 1 | 2 | 3] : null;
  if (!stage || !src) return null;
  const t = WALL_TRANSFORM[stage as 1 | 2 | 3];
  const holes = WALL_HOLES[stage as 1 | 2 | 3];
  const building = !!visual.reveal;
  const maxX = visual.reveal ? Math.round((visual.reveal.sections / WALL_REVEAL_SECTIONS) * SCENE_W) : SCENE_W;
  const style = { transform: `translate(${t.dx}px, ${t.dy}px) scale(${t.scale})`, transformOrigin: '0 0' } as const;
  const cls = `wall-layer ${building ? 'is-building' : ''} ${highlighted ? 'is-highlighted' : ''}`;
  return (
    <>
      <img className={`${cls} wall-back`} src={src} width={SCENE_W} height={SCENE_H} alt="" draggable={false} style={{ ...style, clipPath: bandPath(0, WALL_SPLIT_Y, maxX, holes) }} />
      <img className={`${cls} wall-front`} src={src} width={SCENE_W} height={SCENE_H} alt="" draggable={false} style={{ ...style, clipPath: bandPath(WALL_SPLIT_Y, SCENE_H, maxX, holes) }} />
    </>
  );
}

const MASK_W = 384;
const MASK_H = 256;
const maskCache = new Map<string, Promise<WallMask>>();

/** Máscara de la silueta del overlay vigente (resolución 4× la de los edificios: los muros son estrechos). */
export function useWallMask(stage: number): WallMask | null {
  const [mask, setMask] = useState<WallMask | null>(null);
  useEffect(() => {
    const src = stage ? ART.walls[stage as 1 | 2 | 3] : null;
    if (!src) {
      setMask(null);
      return;
    }
    let cancelled = false;
    let p = maskCache.get(src);
    if (!p) {
      p = new Promise<WallMask>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = MASK_W;
          c.height = MASK_H;
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, MASK_W, MASK_H);
          const d = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
          const data = new Uint8Array(MASK_W * MASK_H);
          for (let i = 0; i < data.length; i++) data[i] = d[i * 4 + 3] > 40 ? 1 : 0;
          resolve({ data, w: MASK_W, h: MASK_H });
        };
        img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        img.src = src;
      });
      maskCache.set(src, p);
    }
    p.then((m) => !cancelled && setMask(m)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [stage]);
  return mask;
}
