/**
 * Cámara de las escenas (matemática pura, sin DOM).
 *
 * Una sola transformación uniforme para TODA la escena (terreno, edificios, muros, agua y actores):
 *   pantalla = origen_viewport + (escena − centro) · s + (vw/2, vh/2)        (directa)
 *   escena   = centro + (pantalla − (vw/2, vh/2)) / s                         (inversa; la usa el hit-test)
 * `s` es la escala uniforme (px de pantalla por px de escena) y `centro` es el punto de la escena en el centro del viewport.
 * El origen de la escena es la esquina superior izquierda; x crece a la derecha e y hacia abajo.
 */

export interface Camera {
  /** Escala uniforme (px de pantalla por px de escena). */
  s: number;
  /** true solo en «ver toda»: la única vista que puede dejar márgenes (se vuelve a ajustar si cambia el viewport). */
  whole?: boolean;
  /** Centro del encuadre en coordenadas de escena. */
  cx: number;
  cy: number;
}

export interface SceneRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Viewport {
  w: number;
  h: number;
}

export interface SceneSize {
  w: number;
  h: number;
}

/** Escala que hace caber TODA la escena en el viewport («ver toda»). */
export const fitScaleOf = (vp: Viewport, scene: SceneSize): number =>
  vp.w <= 0 || vp.h <= 0 ? 1 : Math.min(vp.w / scene.w, vp.h / scene.h);

/** Escala mínima del encuadre cercano: la escena CUBRE el viewport (sin márgenes vacíos). */
export const coverScaleOf = (vp: Viewport, scene: SceneSize): number =>
  vp.w <= 0 || vp.h <= 0 ? 1 : Math.max(vp.w / scene.w, vp.h / scene.h);

export const clampScale = (s: number, fit: number, max: number): number => Math.min(max, Math.max(fit, s));

/**
 * Limita el centro para que el encuadre no salga de la escena. Si la escena cabe en un eje, se centra en ese eje
 * (márgenes simétricos solo en «ver toda»; en zoom cercano la escena siempre llena el viewport).
 */
export function clampCenter(cam: Camera, vp: Viewport, scene: SceneSize): Camera {
  const halfW = vp.w / (2 * cam.s);
  const halfH = vp.h / (2 * cam.s);
  const cx = scene.w <= 2 * halfW ? scene.w / 2 : Math.min(scene.w - halfW, Math.max(halfW, cam.cx));
  const cy = scene.h <= 2 * halfH ? scene.h / 2 : Math.min(scene.h - halfH, Math.max(halfH, cam.cy));
  return { s: cam.s, cx, cy, whole: cam.whole };
}

/** Posición (px, relativa al viewport) de la esquina superior izquierda del lienzo de la escena. */
export const frameOffset = (cam: Camera, vp: Viewport): { left: number; top: number } => ({
  left: vp.w / 2 - cam.cx * cam.s,
  top: vp.h / 2 - cam.cy * cam.s,
});

/** Escena → viewport. */
export const sceneToViewport = (cam: Camera, vp: Viewport, x: number, y: number) => ({
  x: vp.w / 2 + (x - cam.cx) * cam.s,
  y: vp.h / 2 + (y - cam.cy) * cam.s,
});

/** Viewport → escena (inversa exacta de la anterior). */
export const viewportToScene = (cam: Camera, vp: Viewport, px: number, py: number) => ({
  x: cam.cx + (px - vp.w / 2) / cam.s,
  y: cam.cy + (py - vp.h / 2) / cam.s,
});

/** Encuadre inicial cercano: la zona útil llena el viewport (sin pasar de «ver toda»), centrada en esa zona. */
export function initialCamera(focus: SceneRect, vp: Viewport, scene: SceneSize, max: number): Camera {
  const cover = coverScaleOf(vp, scene);
  const s = clampScale(Math.min(vp.w / (focus.x1 - focus.x0), vp.h / (focus.y1 - focus.y0)), cover, max);
  return clampCenter({ s, cx: (focus.x0 + focus.x1) / 2, cy: (focus.y0 + focus.y1) / 2 }, vp, scene);
}

export const fitCamera = (vp: Viewport, scene: SceneSize): Camera => ({ s: fitScaleOf(vp, scene), cx: scene.w / 2, cy: scene.h / 2, whole: true });

/** Zoom multiplicativo manteniendo FIJO el punto de escena bajo (px, py) del viewport. */
export function zoomAt(cam: Camera, factor: number, px: number, py: number, vp: Viewport, scene: SceneSize, max: number): Camera {
  // Acercar/alejar nunca baja de «cubrir»: los márgenes solo existen en «ver toda» (botón).
  const s = clampScale(cam.s * factor, coverScaleOf(vp, scene), max);
  const p = viewportToScene(cam, vp, px, py);
  return clampCenter({ s, cx: p.x - (px - vp.w / 2) / s, cy: p.y - (py - vp.h / 2) / s }, vp, scene);
}

/** Desplaza el encuadre `dx, dy` píxeles de pantalla (arrastrar el contenido hacia la derecha mueve el centro a la izquierda). */
export const panBy = (cam: Camera, dx: number, dy: number, vp: Viewport, scene: SceneSize): Camera =>
  clampCenter({ s: cam.s, cx: cam.cx - dx / cam.s, cy: cam.cy - dy / cam.s }, vp, scene);

/**
 * Cambio de tamaño del viewport (p. ej. al abrir/cerrar el inspector): conserva la magnificación y el centro; solo se limita a lo válido.
 * Nunca vuelve a «ver toda» por sí mismo; solo sube la escala lo mínimo para no dejar márgenes vacíos (si el viewport se ensancha).
 */
export function resizeCamera(cam: Camera, vp: Viewport, scene: SceneSize, max: number): Camera {
  if (cam.whole) return fitCamera(vp, scene); // «ver toda» sigue siendo «ver toda»
  return clampCenter({ s: clampScale(cam.s, coverScaleOf(vp, scene), max), cx: cam.cx, cy: cam.cy }, vp, scene);
}
