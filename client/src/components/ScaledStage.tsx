import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { clampCenter, coverScaleOf, fitCamera, frameOffset, initialCamera, panBy, resizeCamera, zoomAt, type Camera, type SceneRect } from '../cameraMath';
import { fitScale } from '../sceneGeometry';
import { LineIcon } from './Icons';

/** Opciones de cámara con zoom y desplazamiento (solo la Fortaleza las usa de momento). */
export interface CameraOptions {
  /** Clave para recordar la cámara al cambiar de escena y volver. */
  key: string;
  /** Zona útil (edificios completos): el encuadre inicial cercano la centra y la hace llenar el viewport. */
  focus: SceneRect;
  /** Escala máxima absoluta (px de pantalla por px de escena). */
  maxScale: number;
  /** Texto del botón «ver toda». */
  fitLabel: string;
}

interface Props {
  width: number;
  height: number;
  minScale?: number;
  /** Imagen de fondo difuminada que integra el margen cuando la proporción no coincide (nunca se deforma). */
  backdropSrc?: string | null;
  backdropColor?: string;
  frameRef: RefObject<HTMLDivElement>;
  cursor?: CSSProperties['cursor'];
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: () => void;
  onClick?: (e: PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => void;
  camera?: CameraOptions;
  children: ReactNode;
  label: string;
}

const DRAG_THRESHOLD = 6; // px de pantalla: por debajo es un clic (selección de edificio), por encima un arrastre
const ZOOM_STEP = 1.25;
const memory = new Map<string, Camera>();

/**
 * Lienzo de tamaño fijo (coordenadas nativas) con UNA transformación uniforme: terreno, edificios, muros, agua y actores
 * viven dentro del mismo `.stage`, y los elementos que deben mantener su tamaño en pantalla (etiquetas) se contraescalan con `--s`.
 *
 * Sin `camera`: la escena se escala para caber (comportamiento anterior, con desplazamiento nativo si no cabe).
 * Con `camera`: zoom (rueda, botones, teclado, pellizco) y desplazamiento (arrastre, teclado) con límites; encuadre inicial cercano.
 */
export function ScaledStage({ width, height, minScale = 0.55, backdropSrc, backdropColor = '#14120d', frameRef, cursor, onPointerMove, onPointerLeave, onClick, camera: cameraOpts, children, label }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera>({ s: 1, cx: width / 2, cy: height / 2 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const scene = { w: width, h: height };
  const dragged = useRef(false);

  const commit = useCallback(
    (next: Camera) => {
      setCam(next);
      if (cameraOpts) memory.set(cameraOpts.key, next);
    },
    [cameraOpts],
  );

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const size = { w: el.clientWidth, h: el.clientHeight };
      if (!cameraOpts) {
        setScale(fitScale(size.w, size.h, width, height, minScale));
        return;
      }
      if (size.w <= 0 || size.h <= 0) return;
      setVp(size);
      const saved = memory.get(cameraOpts.key);
      // Primera vez: encuadre cercano. Después: se conservan magnificación y centro (solo se limita a lo válido).
      const next = saved ? resizeCamera(saved, size, scene, cameraOpts.maxScale) : initialCamera(cameraOpts.focus, size, scene, cameraOpts.maxScale);
      memory.set(cameraOpts.key, next);
      setCam(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, minScale, cameraOpts?.key]);

  // Modo sin cámara: si el lienzo no cabe (pantallas muy pequeñas) se centra el desplazamiento horizontal inicial.
  useEffect(() => {
    const el = viewportRef.current;
    if (!cameraOpts && el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [scale, cameraOpts]);

  /* ---------- Cámara: rueda, arrastre, pellizco y teclado ---------- */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; moved: boolean; dist: number } | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !cameraOpts) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      commit(zoomAt(camRef.current, factor, e.clientX - r.left, e.clientY - r.top, { w: el.clientWidth, h: el.clientHeight }, scene, cameraOpts.maxScale));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpts?.key, commit, width, height]);

  const zoomButton = (factor: number) => {
    if (!cameraOpts) return;
    commit(zoomAt(camRef.current, factor, vp.w / 2, vp.h / 2, vp, scene, cameraOpts.maxScale));
  };
  const viewAll = () => commit(fitCamera(vp, scene));

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!cameraOpts || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest('.cam-controls')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current = { x: e.clientX, y: e.clientY, moved: false, dist: 0 };
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { x: 0, y: 0, moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!cameraOpts || !pointers.current.has(e.pointerId) || !gesture.current) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist > 0 && dist > 0) {
        const r = viewportRef.current!.getBoundingClientRect();
        commit(zoomAt(camRef.current, dist / g.dist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, vp, scene, cameraOpts.maxScale));
      }
      g.dist = dist;
      dragged.current = true;
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < DRAG_THRESHOLD) return;
    if (!g.moved) {
      g.moved = true;
      viewportRef.current?.setPointerCapture(e.pointerId);
    }
    dragged.current = true;
    commit(panBy(camRef.current, e.clientX - prev.x, e.clientY - prev.y, vp, scene));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    // El clic que sigue a un arrastre se descarta (capturado más abajo) para no seleccionar un edificio sin querer.
    if (dragged.current) setTimeout(() => (dragged.current = false), 0);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!cameraOpts || (e.target as HTMLElement).tagName === 'INPUT') return;
    const step = 80;
    let handled = true;
    if (e.key === 'ArrowLeft') commit(panBy(camRef.current, step, 0, vp, scene));
    else if (e.key === 'ArrowRight') commit(panBy(camRef.current, -step, 0, vp, scene));
    else if (e.key === 'ArrowUp') commit(panBy(camRef.current, 0, step, vp, scene));
    else if (e.key === 'ArrowDown') commit(panBy(camRef.current, 0, -step, vp, scene));
    else if (e.key === '+' || e.key === '=') zoomButton(ZOOM_STEP);
    else if (e.key === '-' || e.key === '_') zoomButton(1 / ZOOM_STEP);
    else if (e.key === '0') viewAll();
    else handled = false;
    if (handled && e.target === e.currentTarget) e.preventDefault();
  };

  const cover = coverScaleOf(vp, scene);
  const clamped = cameraOpts && vp.w > 0 ? clampCenter(cam, vp, scene) : cam;
  const s = cameraOpts ? clamped.s : scale;
  const off = cameraOpts ? frameOffset(clamped, vp) : null;
  const atFit = !!cameraOpts && (cam.s <= cover + 1e-6 || !!cam.whole);
  const atMax = !!cameraOpts && cam.s >= cameraOpts.maxScale - 1e-6;

  return (
    <div
      className={`stage-viewport ${cameraOpts ? 'has-camera' : ''}`}
      ref={viewportRef}
      style={{ background: backdropColor }}
      tabIndex={cameraOpts ? 0 : undefined}
      aria-label={cameraOpts ? `${label}. Flechas para desplazar, más y menos para acercar, 0 para ver toda la escena.` : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
      onClickCapture={(e) => {
        if (dragged.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {backdropSrc && (
        <div className="stage-backdrop-clip" aria-hidden>
          <div className="stage-backdrop" style={{ backgroundImage: `url(${backdropSrc})` }} />
        </div>
      )}
      <div
        className="stage-frame"
        ref={frameRef}
        style={{
          width: width * s,
          height: height * s,
          ['--s' as string]: s,
          cursor: gesture.current?.moved ? 'grabbing' : cursor,
          ...(off ? { position: 'absolute', left: off.left, top: off.top, margin: 0 } : null),
        }}
        data-camera-scale={cameraOpts ? s.toFixed(4) : undefined}
        data-camera-cx={cameraOpts ? clamped.cx.toFixed(1) : undefined}
        data-camera-cy={cameraOpts ? clamped.cy.toFixed(1) : undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        role="group"
        aria-label={label}
      >
        <div className="stage" style={{ width, height, transform: `scale(${s})` }}>
          {children}
        </div>
      </div>

      {cameraOpts && (
        <div className="cam-controls" role="group" aria-label="Cámara">
          <button type="button" className="cam-btn" aria-label="Acercar" title="Acercar (+)" disabled={atMax} onClick={() => zoomButton(ZOOM_STEP)}>
            <LineIcon name="plus" size={20} />
          </button>
          <button type="button" className="cam-btn" aria-label="Alejar" title="Alejar (−)" disabled={atFit} onClick={() => zoomButton(1 / ZOOM_STEP)}>
            <LineIcon name="minus" size={20} />
          </button>
          <button type="button" className="cam-btn cam-fit" aria-label={cameraOpts.fitLabel} title={`${cameraOpts.fitLabel} (0)`} onClick={viewAll}>
            <LineIcon name="expand" size={18} /> {cameraOpts.fitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
