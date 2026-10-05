import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { EXPECTED_FILE } from '../artManifest';
import { RESOURCE_LABEL, costEntries, fmt } from '../format';
import { GROUND_SRC, SCENE_H, SCENE_W, SLOTS, SPRITE_SRC } from '../sceneConfig';
import type { BuildingType, Cost, ResourceKey, UnitType } from '../types';
import { CrossIcon, LineIcon, ResourceIcon, UnitIcon } from './Icons';

/* Componentes compartidos del sistema visual: botones, tarjetas, barras, estados vacíos y retratos. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  block?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'secondary', size = 'md', block, icon, className = '', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${block ? 'btn-block' : ''} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Card({ title, icon, aside, children, className = '' }: { title?: ReactNode; icon?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-head">
          {icon}
          <h3>{title}</h3>
          {aside && <span className="card-aside">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Selector de cantidad entero con validación: nunca emite valores fuera de [min, max]. */
export function Stepper({ value, min = 0, max, onChange, disabled, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; disabled?: boolean; label: string }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(Number.isFinite(n) ? n : min)));
  const id = useId();
  return (
    <div className={`stepper ${disabled ? 'is-disabled' : ''}`} role="group" aria-label={label}>
      <button type="button" className="step-btn" aria-label={`Quitar uno: ${label}`} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))}>
        −
      </button>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} step={1} value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      <button type="button" className="step-btn" aria-label={`Añadir uno: ${label}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))}>
        +
      </button>
    </div>
  );
}

export function CostChips({ cost, estimate, multiplier = 1 }: { cost: Cost; estimate?: (r: ResourceKey) => number; multiplier?: number }) {
  return (
    <ul className="cost-grid" aria-label="Costo">
      {costEntries(cost).map(([r, v]) => {
        const need = v * multiplier;
        const short = estimate ? estimate(r) < need : false;
        return (
          <li key={r} className={short ? 'is-short' : ''} title={`${RESOURCE_LABEL[r]}${short ? ': recursos insuficientes' : ''}`}>
            <ResourceIcon resource={r} size={22} />
            <b>{fmt(need)}</b>
            <span className="sr-only">{RESOURCE_LABEL[r]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyState({ art, title, children, action, inline }: { art?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; inline?: boolean }) {
  return (
    <div className={`empty-state ${inline ? 'is-inline' : ''}`}>
      {art}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Marcador EXPLÍCITO de arte pendiente: nombra el archivo esperado; no finge ser el arte final. */
export function ArtPending({ file, children, compact }: { file: string; children?: ReactNode; compact?: boolean }) {
  return (
    <div className={`art-pending ${compact ? 'is-compact' : ''}`} role="img" aria-label={`Arte pendiente: ${file}`}>
      {children}
      <small>Arte pendiente · {file}</small>
    </div>
  );
}

/**
 * Retrato de un edificio construido con los assets reales: recorte del terreno original alrededor
 * de su parcela y el sprite encima, a escala uniforme (sin estirar). Las parcelas libres muestran
 * solo el terreno (y, opcionalmente, el edificio "fantasma" que se construiría).
 */
export function BuildingPortrait({ type, built, ghost, height = 180, width = 322, k = 0.5, className = '' }: { type: BuildingType; built: boolean; ghost?: boolean; height?: number; width?: number; k?: number; className?: string }) {
  const s = SLOTS[type];
  const ax = 0.5; // el anclaje de la base cae al 50 % del ancho…
  const ay = 0.66; // …y al 66 % del alto
  const boxW = width;
  const bgX = boxW * ax - s.x * k;
  const bgY = height * ay - s.y * k;
  const sprite = s.w * k;
  return (
    <div
      className={`portrait-building ${className}`}
      style={{
        height,
        width: width === 322 ? undefined : width,
        backgroundImage: `url(${GROUND_SRC})`,
        backgroundSize: `${SCENE_W * k}px ${SCENE_H * k}px`,
        backgroundPosition: `${bgX}px ${bgY}px`,
      }}
    >
      {(built || ghost) && (
        <img
          src={SPRITE_SRC[type]}
          alt=""
          draggable={false}
          className={ghost && !built ? 'is-ghost' : ''}
          style={{ width: sprite, height: sprite, left: `calc(${ax * 100}% - ${sprite / 2}px)`, top: height * ay - s.anchorY * sprite }}
        />
      )}
    </div>
  );
}

/**
 * Retrato de unidad. Mientras no exista el retrato ilustrado se muestra un marcador explícito con el
 * símbolo SVG provisional de la unidad (ver ART.portraits).
 */
export function UnitPortrait({ unit, src, locked, size = 'card' }: { unit: UnitType; src: string | null; locked?: boolean; size?: 'card' | 'row' }) {
  if (src) return <img className={`portrait-unit portrait-${size} ${locked ? 'is-locked' : ''}`} src={src} alt="" draggable={false} />;
  return (
    <div className={`portrait-unit portrait-${size} is-pending ${locked ? 'is-locked' : ''}`} role="img" aria-label={`Retrato pendiente: ${EXPECTED_FILE.portrait(unit)}`}>
      <UnitIcon unit={unit} size={size === 'card' ? 54 : 26} />
      {size === 'card' && <small>Retrato pendiente · {EXPECTED_FILE.portrait(unit)}</small>}
    </div>
  );
}

export function ResultBadge({ result }: { result: 'victory' | 'defeat' }) {
  return (
    <span className={`result-badge ${result}`} aria-label={result === 'victory' ? 'Victoria' : 'Derrota'}>
      <LineIcon name="shield" size={22} />
    </span>
  );
}

export function CloseButton({ onClick, label = 'Cerrar' }: { onClick: () => void; label?: string }) {
  return (
    <IconButton label={label} onClick={onClick}>
      <CrossIcon size={18} />
    </IconButton>
  );
}
