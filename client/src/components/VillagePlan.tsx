import { useMemo, useRef, useState } from 'react';
import { VILLAGE, VILLAGE_H, VILLAGE_W } from '../districts/districtConfig';
import { hitTestPlots, planShapes } from '../districts/planGeometry';
import { clientToStage } from '../sceneGeometry';
import type { DistrictState } from '../types';
import { ScaledStage } from './ScaledStage';

const TERRAIN = VILLAGE.terrainAsset;

interface Props {
  district: DistrictState;
  selectedPlotId: string | null;
  onSelect: (plotId: string) => void;
}

const d = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

/**
 * Villa: terreno limpio real (`terrain_village.png`) con las parcelas y calles PLANIFICADAS dibujadas encima como plano.
 * No hay construcciones ni casas: las parcelas son reservas sin mecánica y no pueden construirse. Si el terreno no estuviera disponible
 * se dibuja el esquema oscuro anterior. La escena usa la misma transformación uniforme que la Fortaleza.
 */
export function VillagePlan({ district, selectedPlotId, onSelect }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const shapes = useMemo(() => planShapes(VILLAGE), []);
  const planned = useMemo(() => new Map(district.planned.map((p) => [p.plotId, p])), [district.planned]);

  const hitAt = (x: number, y: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const p = clientToStage(rect, x, y, VILLAGE_W, VILLAGE_H);
    return hitTestPlots(p.x, p.y, VILLAGE.plots)?.id ?? null;
  };

  return (
    <ScaledStage
      width={VILLAGE_W}
      height={VILLAGE_H}
      minScale={0.5}
      backdropColor="#14120d"
      backdropSrc={TERRAIN}
      frameRef={frameRef}
      cursor={hover ? 'pointer' : 'default'}
      label="Villa: terreno con parcelas planificadas"
      onPointerMove={(e) => setHover(hitAt(e.clientX, e.clientY))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const id = hitAt(e.clientX, e.clientY);
        if (id) onSelect(id);
      }}
    >
      {TERRAIN && <img className="stage-ground" src={TERRAIN} width={VILLAGE_W} height={VILLAGE_H} alt="" draggable={false} />}
      <svg className={`plan-svg ${TERRAIN ? "on-terrain" : ""}`} viewBox={`0 0 ${VILLAGE_W} ${VILLAGE_H}`} width={VILLAGE_W} height={VILLAGE_H} aria-hidden>
        <defs>
          <pattern id="plan-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M80 0H0V80" fill="none" stroke="rgba(198,164,93,0.10)" strokeWidth="1" />
          </pattern>
          <pattern id="plan-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0V14" stroke="rgba(167,95,78,0.35)" strokeWidth="3" />
          </pattern>
        </defs>
        {!TERRAIN && <rect width={VILLAGE_W} height={VILLAGE_H} fill="#1b180f" />}
        {!TERRAIN && <rect width={VILLAGE_W} height={VILLAGE_H} fill="url(#plan-grid)" />}

        {/* Franja reservada para la muralla exterior futura (no hay muralla) */}
        {shapes.zones.map((z) => (
          <g key={z.id}>
            <path d={`${d(z.points)} Z M60 60 H${VILLAGE_W - 60} V${VILLAGE_H - 60} H60 Z`} fillRule="evenodd" fill="url(#plan-hatch)" opacity={TERRAIN ? 0.55 : 1} />
            <rect x="60" y="60" width={VILLAGE_W - 120} height={VILLAGE_H - 120} fill="none" stroke="rgba(167,95,78,0.6)" strokeDasharray="14 10" strokeWidth="2" />
          </g>
        ))}

        {/* Calles y accesos reservados */}
        {shapes.corridors.map((c) => (
          <g key={c.id}>
            <path className="plan-corridor-wide" d={d(c.points)} fill="none" strokeWidth={c.halfWidth * 2} strokeLinecap="round" strokeLinejoin="round" />
            <path className="plan-corridor-line" d={d(c.points)} fill="none" strokeWidth="3" strokeDasharray="10 8" strokeLinecap="round" />
          </g>
        ))}

        {/* Parcelas planificadas */}
        {shapes.plots.map((p) => {
          const active = hover === p.id || selectedPlotId === p.id;
          return (
            <rect
              key={p.id}
              x={p.rect.x0}
              y={p.rect.y0}
              width={p.rect.x1 - p.rect.x0}
              height={p.rect.y1 - p.rect.y0}
              rx="6"
              className={`plan-plot ${active ? 'is-active' : ''} ${selectedPlotId === p.id ? 'is-selected' : ''}`}
            />
          );
        })}
      </svg>

      {/* Etiquetas y accesos por teclado: mismo sistema de coordenadas (anclas contraescaladas) */}
      {VILLAGE.plots.map((p) => {
        const pb = planned.get(p.id);
        const active = hover === p.id || selectedPlotId === p.id;
        return (
          <div key={p.id} className="anchor" style={{ left: p.anchor[0], top: p.anchor[1], zIndex: 10 + Math.round(p.depth / 10) }}>
            <button type="button" className={`anchor-btn plan-anchor ${active ? 'is-active' : ''}`} aria-pressed={selectedPlotId === p.id} aria-label={`${pb?.name ?? p.id}, planificado, mecánica pendiente`} onClick={(e) => (e.stopPropagation(), onSelect(p.id))}>
              <span className="chip-label plan-chip">
                <span className="chip-name">{pb?.name ?? p.id}</span>
                <span className="plan-state">Planificado · mecánica pendiente</span>
              </span>
            </button>
          </div>
        );
      })}

      <div className="stage-note"><div className="plan-banner">
        <b>Villa · parcelas planificadas</b>
        <span>Terreno limpio. Las parcelas y calles dibujadas son un plano provisional: no hay construcciones ni mecánicas.</span>
      </div></div>
    </ScaledStage>
  );
}
