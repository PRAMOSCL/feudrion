import { useEffect, useMemo, useRef, useState } from 'react';
import { GROUND_SRC, SCENE_H, SCENE_W, SLOTS, SPRITE_SRC, spriteBox } from '../sceneConfig';
import { fmtDuration } from '../format';
import type { BuildingState, BuildingType } from '../types';
import { HammerIcon } from './Icons';

const MASK_SIZE = 160;
const ALPHA_THRESHOLD = 40;

/**
 * Máscaras de silueta: una cuadrícula de opacidad por sprite. El área clicable es la silueta
 * visible (no el rectángulo del PNG), así los márgenes transparentes no interceptan a los vecinos.
 */
function useSilhouetteMasks(): Partial<Record<BuildingType, Uint8Array>> {
  const [masks, setMasks] = useState<Partial<Record<BuildingType, Uint8Array>>>({});
  useEffect(() => {
    let cancelled = false;
    (Object.keys(SPRITE_SRC) as BuildingType[]).forEach((type) => {
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
  onSelect: (type: BuildingType) => void;
}

export function CityScene({ buildings, selected, now, onSelect }: Props) {
  const masks = useSilhouetteMasks();
  const [hover, setHover] = useState<BuildingType | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const byType = useMemo(() => Object.fromEntries(buildings.map((b) => [b.type, b])) as Record<BuildingType, BuildingState>, [buildings]);
  // De delante hacia atrás (mayor y primero) para resolver solapamientos al hacer clic.
  const frontToBack = useMemo(
    () => (Object.keys(SLOTS) as BuildingType[]).sort((a, b) => SLOTS[b].y - SLOTS[a].y),
    [],
  );

  // En pantallas estrechas la escena es más ancha que la vista: se centra al cargar.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  function hitTest(clientX: number, clientY: number): BuildingType | null {
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((clientX - rect.left) / rect.width) * SCENE_W;
    const py = ((clientY - rect.top) / rect.height) * SCENE_H;
    for (const type of frontToBack) {
      const slot = SLOTS[type];
      if (byType[type].level > 0) {
        const box = spriteBox(type);
        const u = (px - box.left) / box.size;
        const v = (py - box.top) / box.size;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const mask = masks[type];
        if (mask && mask[Math.floor(v * MASK_SIZE) * MASK_SIZE + Math.floor(u * MASK_SIZE)]) return type;
      } else {
        const dx = (px - slot.x) / slot.plot.rx;
        const dy = (py - slot.y) / slot.plot.ry;
        if (dx * dx + dy * dy <= 1) return type;
      }
    }
    return null;
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const built = buildings.filter((b) => b.level > 0).sort((a, b) => SLOTS[a.type].y - SLOTS[b.type].y);

  return (
    <div className="scene-scroll" ref={scrollRef}>
      <div
        className="scene"
        ref={sceneRef}
        style={{ aspectRatio: `${SCENE_W} / ${SCENE_H}`, cursor: hover ? 'pointer' : 'default' }}
        onPointerMove={(e) => setHover(hitTest(e.clientX, e.clientY))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = hitTest(e.clientX, e.clientY);
          if (hit) onSelect(hit);
        }}
        data-testid="city-scene"
      >
        <img className="scene-ground" src={GROUND_SRC} alt="Mapa de la villa y sus murallas" draggable={false} />

        {/* Parcelas vacías o en construcción inicial */}
        <svg className="plots" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden>
          {buildings
            .filter((b) => b.level === 0)
            .map((b) => {
              const s = SLOTS[b.type];
              const active = hover === b.type || selected === b.type;
              const progress = b.construction
                ? Math.min(1, Math.max(0, (now - b.construction.startedAt) / (b.construction.finishesAt - b.construction.startedAt)))
                : 0;
              return (
                <g key={b.type} className={`plot ${active ? 'is-active' : ''} ${b.construction ? 'is-building' : ''}`}>
                  <ellipse cx={s.x} cy={s.y} rx={s.plot.rx} ry={s.plot.ry} className="plot-ground" />
                  <ellipse cx={s.x} cy={s.y} rx={s.plot.rx} ry={s.plot.ry} className="plot-edge" />
                  {[
                    [-0.78, 0],
                    [0.78, 0],
                    [0, -0.78],
                    [0, 0.78],
                  ].map(([ox, oy], i) => (
                    <g key={i} transform={`translate(${s.x + ox * s.plot.rx} ${s.y + oy * s.plot.ry})`}>
                      <rect x="-3" y="-16" width="6" height="18" className="stake" />
                      <path d="M-3-16h6l-3-7z" className="stake-tip" />
                    </g>
                  ))}
                  {b.construction ? (
                    <g transform={`translate(${s.x} ${s.y})`}>
                      <circle r="24" className="ring-bg" />
                      <circle r="24" className="ring" strokeDasharray={`${progress * 150.8} 150.8`} transform="rotate(-90)" />
                      <g transform="translate(-14 -14) scale(1.17)">
                        <HammerIcon size={24} />
                      </g>
                    </g>
                  ) : (
                    <g transform={`translate(${s.x} ${s.y})`} className="plot-plus">
                      <circle r="22" />
                      <path d="M-10 0h20M0-10v20" />
                    </g>
                  )}
                </g>
              );
            })}
        </svg>

        {/* Edificios ordenados por profundidad: base más baja = más cerca de la cámara */}
        {built.map((b) => {
          const box = spriteBox(b.type);
          const cls = ['sprite', hover === b.type ? 'is-hover' : '', selected === b.type ? 'is-selected' : '', b.construction ? 'is-upgrading' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <img
              key={b.type}
              className={cls}
              src={SPRITE_SRC[b.type]}
              alt=""
              draggable={false}
              style={{
                left: pct(box.left, SCENE_W),
                top: pct(box.top, SCENE_H),
                width: pct(box.size, SCENE_W),
                zIndex: Math.round(SLOTS[b.type].y),
              }}
            />
          );
        })}

        {/* Etiquetas: nombre, nivel y construcción. Son botones reales (accesibles con teclado). */}
        {buildings.map((b) => {
          const s = SLOTS[b.type];
          const remaining = b.construction ? (b.construction.finishesAt - now) / 1000 : 0;
          const progress = b.construction
            ? Math.min(1, Math.max(0, (now - b.construction.startedAt) / (b.construction.finishesAt - b.construction.startedAt)))
            : 0;
          const active = hover === b.type || selected === b.type;
          return (
            <button
              key={b.type}
              type="button"
              className={`bld-label ${active ? 'is-active' : ''} ${b.level === 0 && !b.construction ? 'is-empty' : ''}`}
              style={{ left: pct(s.x, SCENE_W), top: pct(s.y + s.labelDy, SCENE_H), zIndex: 1000 + Math.round(s.y) }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(b.type);
              }}
              onPointerMove={(e) => e.stopPropagation()}
              aria-label={`${b.name}, ${b.level > 0 ? `nivel ${b.level}` : 'parcela libre'}`}
            >
              <span className="bld-title">
                <span className="bld-name">{b.name}</span>
                <span className="bld-level">{b.level > 0 ? `Nv ${b.level}` : b.construction ? '' : 'Libre'}</span>
              </span>
              {b.construction && (
                <span className="bld-progress">
                  <HammerIcon size={14} />
                  <span>
                    Nv {b.construction.targetLevel} · {fmtDuration(remaining)}
                  </span>
                  <span className="bar">
                    <i style={{ width: `${progress * 100}%` }} />
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
