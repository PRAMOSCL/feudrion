import { describe, expect, it } from 'vitest';
import { clampCenter, coverScaleOf, fitCamera, frameOffset, initialCamera, panBy, resizeCamera, sceneToViewport, viewportToScene, zoomAt } from './cameraMath';

const scene = { w: 1536, h: 1024 };
const vp = { w: 1164, h: 821 };
const MAX = 2.4;

describe('cámara: transformación directa e inversa', () => {
  it('escena → viewport → escena es la identidad con cualquier cámara', () => {
    for (const cam of [{ s: 0.76, cx: 768, cy: 512 }, { s: 1.4, cx: 700, cy: 400 }, { s: 2.4, cx: 1200, cy: 800 }]) {
      for (const [x, y] of [[0, 0], [305, 440], [1292, 800], [1536, 1024]]) {
        const v = sceneToViewport(cam, vp, x, y);
        const back = viewportToScene(cam, vp, v.x, v.y);
        expect(back.x).toBeCloseTo(x, 8);
        expect(back.y).toBeCloseTo(y, 8);
      }
    }
  });
  it('el desfase del lienzo coincide con la transformación (misma geometría para el DOM y el clic)', () => {
    const cam = { s: 1.3, cx: 900, cy: 450 };
    const off = frameOffset(cam, vp);
    const v = sceneToViewport(cam, vp, 0, 0);
    expect([off.left, off.top]).toEqual([v.x, v.y]);
  });
});

describe('cámara: encuadre, zoom y límites', () => {
  it('«ver toda» contiene la escena entera y la centra', () => {
    const c = fitCamera(vp, scene);
    const tl = sceneToViewport(c, vp, 0, 0);
    const br = sceneToViewport(c, vp, scene.w, scene.h);
    expect(tl.x).toBeGreaterThanOrEqual(-1e-9);
    expect(tl.y).toBeGreaterThanOrEqual(-1e-9);
    expect(br.x).toBeLessThanOrEqual(vp.w + 1e-9);
    expect(br.y).toBeLessThanOrEqual(vp.h + 1e-9);
  });
  it('el encuadre inicial cercano es más cercano que «ver toda» y llena el viewport sin márgenes', () => {
    const focus = { x0: 150, y0: 60, x1: 1440, y1: 900 };
    const c = initialCamera(focus, vp, scene, MAX);
    expect(c.s).toBeGreaterThan(fitCamera(vp, scene).s);
    const tl = sceneToViewport(c, vp, 0, 0);
    const br = sceneToViewport(c, vp, scene.w, scene.h);
    expect(tl.x).toBeLessThanOrEqual(1e-9);
    expect(tl.y).toBeLessThanOrEqual(1e-9);
    expect(br.x).toBeGreaterThanOrEqual(vp.w - 1e-9);
    expect(br.y).toBeGreaterThanOrEqual(vp.h - 1e-9);
  });
  it('el zoom mantiene fijo el punto bajo el cursor', () => {
    const cam = { s: 1.2, cx: 800, cy: 520 };
    const before = viewportToScene(cam, vp, 400, 300);
    const z = zoomAt(cam, 1.25, 400, 300, vp, scene, MAX);
    const after = viewportToScene(z, vp, 400, 300);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
  it('la escala se limita entre «cubrir» (sin márgenes) y el máximo', () => {
    const cover = coverScaleOf(vp, scene);
    expect(zoomAt({ s: 1, cx: 768, cy: 512 }, 0.01, 10, 10, vp, scene, MAX).s).toBeCloseTo(cover, 9);
    expect(zoomAt({ s: 1, cx: 768, cy: 512 }, 100, 10, 10, vp, scene, MAX).s).toBe(MAX);
  });
  it('el desplazamiento nunca saca el encuadre de la escena', () => {
    let cam = { s: 1.6, cx: 768, cy: 512 };
    cam = panBy(cam, -99999, -99999, vp, scene);
    const br = sceneToViewport(cam, vp, scene.w, scene.h);
    expect(br.x).toBeCloseTo(vp.w, 6);
    expect(br.y).toBeCloseTo(vp.h, 6);
    cam = panBy(cam, 99999, 99999, vp, scene);
    const tl = sceneToViewport(cam, vp, 0, 0);
    expect(tl.x).toBeCloseTo(0, 6);
    expect(tl.y).toBeCloseTo(0, 6);
  });
  it('arrastrar el contenido a la derecha mueve el centro a la izquierda', () => {
    const cam = { s: 1.5, cx: 768, cy: 512 };
    expect(panBy(cam, 100, 0, vp, scene).cx).toBeCloseTo(768 - 100 / 1.5, 9);
  });
  it('si la escena cabe en un eje se centra en ese eje', () => {
    const wide = { w: 3000, h: 600 };
    const c = clampCenter({ s: 1, cx: 100, cy: 100 }, vp, wide);
    expect(c.cy).toBe(300);
  });
});

describe('cámara: cambio de tamaño del viewport (inspector abierto/cerrado)', () => {
  it('conserva la magnificación y el centro, sin volver a «ver toda»', () => {
    const cam = { s: 1.3, cx: 800, cy: 500 };
    const narrower = { w: vp.w - 350, h: vp.h };
    const r = resizeCamera(cam, narrower, scene, MAX);
    expect(r.s).toBeGreaterThanOrEqual(1.3);
    expect(r.cx).toBeCloseTo(800, 6);
    expect(r.cy).toBeCloseTo(500, 6);
    const back = resizeCamera(r, vp, scene, MAX);
    expect(back.s).toBe(1.3);
    expect(back.cx).toBeCloseTo(800, 6);
  });
  it('al ensanchar el viewport (inspector cerrado) sube la escala solo lo necesario para no dejar márgenes', () => {
    const narrow = { w: 800, h: 821 };
    const cam = { s: 0.9, cx: 768, cy: 512 };
    const wide = resizeCamera(cam, { w: 1514, h: 821 }, scene, MAX);
    expect(wide.s).toBeCloseTo(coverScaleOf({ w: 1514, h: 821 }, scene), 9);
    expect(wide.s).toBeGreaterThan(cam.s);
    expect(resizeCamera(cam, narrow, scene, MAX).s).toBe(0.9);
  });
  it('«ver toda» sigue siendo «ver toda» al cambiar el viewport', () => {
    const w = resizeCamera(fitCamera(vp, scene), { w: 1514, h: 821 }, scene, MAX);
    expect(w.whole).toBe(true);
    expect(w.s).toBeCloseTo(fitCamera({ w: 1514, h: 821 }, scene).s, 9);
  });
  it('solo corrige lo imposible (escala por debajo de «ver toda» o centro fuera de límites)', () => {
    const small = { w: 600, h: 400 };
    const r = resizeCamera({ s: 0.2, cx: 0, cy: 0 }, small, scene, MAX);
    expect(r.s).toBeCloseTo(coverScaleOf(small, scene), 9);
  });
});
