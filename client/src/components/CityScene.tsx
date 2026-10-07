import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDuration } from '../format';
import { LiveLayer } from '../live/LiveLayer';
import { wallVisual, type LiveModel } from '../live/liveModel';
import { WallLayers, useWallMask } from '../live/WallLayers';
import { MASK_SIZE, clientToStage, hitTestBuildings, type Masks } from '../sceneGeometry';
import { CAMERA_FOCUS, CAMERA_MAX_SCALE, GROUND_SRC, SCENE_H, SCENE_W, SLOTS, SPRITE_SRC, spriteBox } from '../sceneConfig';
import type { BuildingState, BuildingType, PlotBuilding } from '../types';
import { HammerIcon } from './Icons';
import { ScaledStage } from './ScaledStage';

const ALPHA_THRESHOLD = 40;

/** Máscaras de silueta a partir de la transparencia real de cada PNG (sin márgenes que intercepten). */
function useSilhouetteMasks(): Masks {
  const [masks, setMasks] = useState<Masks>({});
  useEffect(() => {
    let cancelled = false;
    (Object.keys(SPRITE_SRC) as PlotBuilding[]).forEach((type) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = MASK_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, MASK_SIZE, MASK_SIZE);
        const data = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
        const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
        for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
        if (!cancelled) setMasks((m) => ({ ...m, [type]: mask }));
      };
      img.src = SPRITE_SRC[type];
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return masks;
}

interface Props {
  buildings: BuildingState[];
  selected: BuildingType | null;
  now: number;
  /** Modelo visual derivado del estado real (trabajadores activos, guarnición, población, muralla). */
  live: LiveModel;
  /** Animaciones activadas por el usuario y sin prefers-reduced-motion. */
  animate: boolean;
  onSelect: (type: BuildingType) => void;
}

export function CityScene({ buildings, selected, now, live, animate, onSelect }: Props) {
  const masks = useSilhouetteMasks();
  const [hover, setHover] = useState<BuildingType | null>(null);
  const [focus, setFocus] = useState<BuildingType | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const levels = useMemo(() => Object.fromEntries(buildings.map((b) => [b.type, b.level])) as Record<BuildingType, number>, [buildings]);
  const wall = buildings.find((b) => b.type === 'wall');
  const visual = wallVisual(wall, now);
  const wallMask = useWallMask(visual.stage);

  const hitAt = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const { x, y } = clientToStage(rect, clientX, clientY);
    return hitTestBuildings(x, y, levels, masks, wallMask);
  };

  const plots = buildings.filter((b) => b.type !== 'wall') as (BuildingState & { type: PlotBuilding })[];
  const built = plots.filter((b) => b.level > 0).sort((a, b) => SLOTS[a.type].y - SLOTS[b.type].y);
  const wallActive = !!wall && (hover === 'wall' || selected === 'wall' || focus === 'wall');

  return (
    <ScaledStage
      width={SCENE_W}
      height={SCENE_H}
      backdropSrc={GROUND_SRC}
      frameRef={frameRef}
      cursor={hover ? 'pointer' : 'default'}
      label="Ciudad: terreno, muralla y edificios"
      camera={{ key: 'fortress', focus: CAMERA_FOCUS, maxScale: CAMERA_MAX_SCALE, fitLabel: 'Ver toda la fortaleza' }}
      onPointerMove={(e) => setHover(hitAt(e.clientX, e.clientY))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const hit = hitAt(e.clientX, e.clientY);
        if (hit) onSelect(hit);
      }}
    >
      <img className="stage-ground" src={GROUND_SRC} width={SCENE_W} height={SCENE_H} alt="" draggable={false} />

      {/* Capas dinámicas: agua (sobre el terreno) y personajes (bajo el frente de la muralla). La muralla va en dos recortes. */}
      <LiveLayer model={live} animate={animate} />
      <WallLayers visual={visual} highlighted={wallActive} />

      {/* Parcelas, portón de la muralla y anillos de selección (SVG en el mismo sistema de coordenadas) */}
      <svg className="stage-plots" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden>
        {buildings.map((b) => {
          const s = SLOTS[b.type];
          const active = hover === b.type || selected === b.type || focus === b.type;
          if (b.level === 0) {
            const progress = b.construction ? Math.min(1, Math.max(0, (now - b.construction.startedAt) / (b.construction.finishesAt - b.construction.startedAt))) : 0;
            return (
              <g key={b.type} className={`plot ${active ? 'is-active' : ''} ${b.construction ? 'is-building' : ''} ${b.type === 'wall' ? 'is-gate' : ''}`}>
                <ellipse cx={s.x} cy={s.y} rx={s.plot.rx} ry={s.plot.ry} className="plot-fill" />
                <ellipse cx={s.x} cy={s.y} rx={s.plot.rx} ry={s.plot.ry} className="plot-edge" />
                {b.construction ? (
                  <g transform={`translate(${s.x} ${s.y})`}>
                    <circle r="26" className="ring-bg" />
                    <circle r="26" className="ring" strokeDasharray={`${progress * 163.4} 163.4`} transform="rotate(-90)" />
                  </g>
                ) : (
                  <g transform={`translate(${s.x} ${s.y})`} className="plot-plus">
                    <circle r="20" />
                    <path d="M-8 0h16M0-8v16" />
                  </g>
                )}
              </g>
            );
          }
          if (b.type === 'wall') {
            // Muralla construida: aro del portón al seleccionar; si se está mejorando, anillo de progreso (la defensa vigente no cambia).
            const up = b.construction ? Math.min(1, Math.max(0, (now - b.construction.startedAt) / (b.construction.finishesAt - b.construction.startedAt))) : null;
            return (
              <g key={b.type}>
                {selected === 'wall' && <ellipse cx={s.x} cy={s.y} rx={s.plot.rx} ry={s.plot.ry} className="select-ring" />}
                {up !== null && (
                  <g transform={`translate(${s.x} ${s.y - 70})`}>
                    <circle r="20" className="ring-bg" />
                    <circle r="20" className="ring" strokeDasharray={`${up * 125.7} 125.7`} transform="rotate(-90)" />
                  </g>
                )}
              </g>
            );
          }
          return selected === b.type ? <ellipse key={b.type} cx={s.x} cy={s.y} rx={s.plot.rx * 0.95} ry={s.plot.ry * 0.95} className="select-ring" /> : null;
        })}
      </svg>

      {built.map((b) => {
        const box = spriteBox(b.type);
        const cls = ['sprite', hover === b.type ? 'is-hover' : '', selected === b.type ? 'is-selected' : '', b.construction ? 'is-upgrading' : ''].filter(Boolean).join(' ');
        return <img key={b.type} className={cls} src={SPRITE_SRC[b.type]} alt="" draggable={false} style={{ left: box.left, top: box.top, width: box.size, height: box.size, zIndex: Math.round(SLOTS[b.type].y) }} />;
      })}

      {/* Anclas: etiqueta compacta (selección/hover/foco) e indicador de obra siempre visible */}
      {buildings.map((b) => {
        const s = SLOTS[b.type];
        const active = hover === b.type || selected === b.type || focus === b.type;
        const remaining = b.construction ? (b.construction.finishesAt - now) / 1000 : 0;
        const stateLabel = b.type === 'wall' ? (b.level > 0 ? `Nivel ${b.level}` : b.construction ? 'En obra' : 'Sin construir') : b.level > 0 ? `Nivel ${b.level}` : 'Parcela libre';
        return (
          <div key={b.type} className="anchor" style={{ left: s.x, top: s.y + s.labelDy, zIndex: 1000 + Math.round(s.y) }}>
            <button
              type="button"
              className={`anchor-btn ${active ? 'is-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(b.type);
              }}
              onFocus={() => setFocus(b.type)}
              onBlur={() => setFocus((f) => (f === b.type ? null : f))}
              aria-label={`${b.name}, ${b.type === 'wall' ? (b.level > 0 ? `nivel ${b.level}` : 'sin construir') : b.level > 0 ? `nivel ${b.level}` : 'parcela libre'}${b.construction ? `, en obra: nivel ${b.construction.targetLevel}` : ''}`}
            >
              {(active || b.construction) && (
                <span className="chip-label">
                  <span className="chip-name">
                    {b.name}
                    {active && <span className="chip-level"> · {stateLabel}</span>}
                  </span>
                  {b.construction && (
                    <span className="chip-build">
                      <HammerIcon size={14} /> {b.type === 'wall' && b.level === 0 ? 'Construyendo' : 'Mejorando'} Nv {b.construction.targetLevel} · {fmtDuration(remaining)}
                    </span>
                  )}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </ScaledStage>
  );
}
