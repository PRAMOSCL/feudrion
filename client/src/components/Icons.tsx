import { ART } from '../artManifest';
import type { ResourceKey, UnitType } from '../types';

/** Iconos SVG sencillos (dibujados aquí, sin dependencias). */

interface P {
  size?: number;
  className?: string;
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const });

export function WoodIcon({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2.5" y="6" width="19" height="5" rx="2.5" fill="#a9733a" stroke="#4a2f14" strokeWidth="1.2" />
      <rect x="2.5" y="12.5" width="19" height="5" rx="2.5" fill="#bd8545" stroke="#4a2f14" strokeWidth="1.2" />
      <circle cx="5" cy="8.5" r="1.3" fill="#e2b678" stroke="#4a2f14" strokeWidth=".8" />
      <circle cx="5" cy="15" r="1.3" fill="#e2b678" stroke="#4a2f14" strokeWidth=".8" />
    </svg>
  );
}
export function StoneIcon({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 17 6.5 8l5-3 6 2.5L21 16l-4 3.5H7z" fill="#9aa0a6" stroke="#3b3f44" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6.5 8l4 3.5L17.5 7.5M10.5 11.5 12 19.5" fill="none" stroke="#3b3f44" strokeWidth="1" />
    </svg>
  );
}
export function FoodIcon({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 21V8" stroke="#6b4a12" strokeWidth="1.5" strokeLinecap="round" />
      {[4, 8, 12].map((y) => (
        <g key={y}>
          <ellipse cx="9.2" cy={y + 1} rx="2.2" ry="1.2" transform={`rotate(-35 9.2 ${y + 1})`} fill="#e0b23b" stroke="#6b4a12" strokeWidth=".8" />
          <ellipse cx="14.8" cy={y + 1} rx="2.2" ry="1.2" transform={`rotate(35 14.8 ${y + 1})`} fill="#e0b23b" stroke="#6b4a12" strokeWidth=".8" />
        </g>
      ))}
      <ellipse cx="12" cy="3.6" rx="1.2" ry="2" fill="#e0b23b" stroke="#6b4a12" strokeWidth=".8" />
    </svg>
  );
}
export function GoldIcon({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" fill="#e3b53a" stroke="#6b4a12" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="5.6" fill="none" stroke="#a9781a" strokeWidth="1" />
      <path d="M12 8v8M9.8 10.2c0-1 .9-1.5 2.2-1.5s2.2.5 2.2 1.4c0 2-4.4 1-4.4 3.2 0 .9 1 1.5 2.2 1.5s2.2-.6 2.2-1.5" fill="none" stroke="#6b4a12" strokeWidth="1" />
    </svg>
  );
}
export function PeopleIcon({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="9" cy="8" r="3" fill="#c79b73" stroke="#4a2f14" strokeWidth="1.1" />
      <path d="M3.5 19c0-3.4 2.4-5.5 5.5-5.5s5.5 2.1 5.5 5.5z" fill="#7a5a3a" stroke="#4a2f14" strokeWidth="1.1" />
      <circle cx="16.5" cy="9" r="2.4" fill="#c79b73" stroke="#4a2f14" strokeWidth="1" />
      <path d="M15 14c3.6-.4 5.8 1.4 5.8 5H16z" fill="#8c6a47" stroke="#4a2f14" strokeWidth="1" />
    </svg>
  );
}
export function HammerIcon({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M13 9 4.5 17.5a1.6 1.6 0 0 0 2.2 2.2L15 11.5" fill="#8a5a2b" stroke="#3b230d" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11 4.5 15.5 3l5 5-1.5 4.5-3-.5-4-4z" fill="#a7adb3" stroke="#383c41" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
export function ClockIcon({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" fill="#f2e4bd" stroke="#4a2f14" strokeWidth="1.3" />
      <path d="M12 7v5l3.2 2" fill="none" stroke="#4a2f14" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
export function CheckIcon({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function CrossIcon({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
export function BookIcon({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 5.5C7 4 10 4.3 12 6c2-1.7 5-2 8-.5V19c-3-1.5-6-1.2-8 .5-2-1.7-5-2-8-.5z" fill="#f2e4bd" stroke="#4a2f14" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 6v13.5" stroke="#4a2f14" strokeWidth="1.1" />
    </svg>
  );
}

/** Icono ilustrado (PNG 64×64 transparente) de un recurso; si no hay arte, cae al SVG provisional. */
function ArtIcon({ src, label, size }: { src: string; label?: string; size: number }) {
  return <img className="res-icon" src={src} width={size} height={size} alt={label ?? ''} draggable={false} />;
}

export function PopulationIcon({ size = 24 }: { size?: number }) {
  const src = ART.resourceIcons.population;
  return src ? <ArtIcon src={src} size={size} /> : <PeopleIcon size={size} />;
}

export function ResourceIcon({ resource, size = 20 }: { resource: ResourceKey; size?: number }) {
  const art = ART.resourceIcons[resource];
  if (art) return <ArtIcon src={art} size={size} />;
  switch (resource) {
    case 'wood':
      return <WoodIcon size={size} />;
    case 'stone':
      return <StoneIcon size={size} />;
    case 'food':
      return <FoodIcon size={size} />;
    case 'gold':
      return <GoldIcon size={size} />;
  }
}

/** Símbolos provisionales de unidades hasta que existan sus ilustraciones. */
export function UnitIcon({ unit, size = 22 }: { unit: UnitType; size?: number }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...base(size)} className="unit-icon">
      {unit === 'lancero' && (
        <>
          <path d="M5 20 19 5" {...stroke} />
          <path d="m19 5-.4 4.2M19 5l-4.2.4M14.6 5.4 18.6 9.4" {...stroke} fill="#a7adb3" />
        </>
      )}
      {unit === 'arquero' && (
        <>
          <path d="M7 4c8 3 8 13 0 16" {...stroke} />
          <path d="M7 4v16M4 12h14m0 0-3-2.6M18 12l-3 2.6" {...stroke} />
        </>
      )}
      {unit === 'espadachin' && (
        <>
          <path d="M18.5 4.5 8 15" {...stroke} strokeWidth={2.4} />
          <path d="m6.5 12.5 5 5M5 19l2.5-2.5" {...stroke} />
        </>
      )}
      {unit === 'ballestero' && (
        <>
          <path d="M4 9c4-2 12-2 16 0M12 8v12" {...stroke} />
          <path d="M6 9.5 12 17l6-7.5" {...stroke} />
        </>
      )}
    </svg>
  );
}

/* ---------- Iconos de navegación y estadísticas (trazo de latón, familia única) ---------- */

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export type NavIconName = 'city' | 'world' | 'army' | 'reports' | 'rules' | 'menu' | 'help' | 'lock' | 'flag' | 'skull' | 'pin' | 'people' | 'shield' | 'fleur';

export function LineIcon({ name, size = 22, className }: { name: NavIconName; size?: number; className?: string }) {
  return (
    <svg {...base(size)} className={className}>
      {name === 'city' && (
        <g {...line}>
          <path d="M5 20V9h3V6h2v3h4V6h2v3h3v11z" />
          <path d="M10 20v-5a2 2 0 0 1 4 0v5M5 9h14" />
        </g>
      )}
      {name === 'world' && (
        <g {...line}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" fillOpacity=".25" />
          <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
        </g>
      )}
      {name === 'army' && (
        <g {...line}>
          <path d="M5 19 17.5 6.5M17.5 6.5 19 5l-.2 3.2L15.5 5.4zM6.5 14.5l3 3M4 20l2-2" />
          <path d="M19 19 6.5 6.5M6.5 6.5 5 5l.2 3.2L8.5 5.4zM17.5 14.5l-3 3M20 20l-2-2" />
        </g>
      )}
      {name === 'reports' && (
        <g {...line}>
          <path d="M7 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
        </g>
      )}
      {name === 'rules' && (
        <g {...line}>
          <path d="M3.5 5.5C6.5 4 9.5 4.2 12 6c2.5-1.8 5.5-2 8.5-.5V19c-3-1.5-6-1.3-8.5.5-2.5-1.8-5.5-2-8.5-.5z" />
          <path d="M12 6v13.5" />
        </g>
      )}
      {name === 'menu' && (
        <g {...line} strokeWidth={2}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </g>
      )}
      {name === 'help' && (
        <g {...line}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8M12 16.6v.1" />
        </g>
      )}
      {name === 'lock' && (
        <g {...line}>
          <rect x="6" y="11" width="12" height="9" rx="2" />
          <path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" />
        </g>
      )}
      {name === 'flag' && (
        <g {...line}>
          <path d="M6 20V4M6 5h11l-2.5 3.5L17 12H6" />
        </g>
      )}
      {name === 'skull' && (
        <g {...line}>
          <path d="M12 4a7 7 0 0 0-4 12.7V19h8v-2.3A7 7 0 0 0 12 4z" />
          <circle cx="9.5" cy="11.5" r="1.3" fill="currentColor" />
          <circle cx="14.5" cy="11.5" r="1.3" fill="currentColor" />
          <path d="M10.5 19v-2M13.5 19v-2" />
        </g>
      )}
      {name === 'pin' && (
        <g {...line}>
          <path d="M12 21s6-5.6 6-10.5A6 6 0 0 0 6 10.5C6 15.4 12 21 12 21z" />
          <circle cx="12" cy="10.5" r="2.2" />
        </g>
      )}
      {name === 'people' && (
        <g {...line}>
          <circle cx="9" cy="8.5" r="3" />
          <path d="M3.5 19c0-3.3 2.4-5.3 5.5-5.3s5.5 2 5.5 5.3M16 11.5a2.5 2.5 0 1 0 0-5M17 14c2.2.4 3.5 2 3.5 5" />
        </g>
      )}
      {name === 'shield' && (
        <g {...line}>
          <path d="M12 3.5 5 6v5.5c0 4.4 2.9 7.4 7 9 4.1-1.6 7-4.6 7-9V6z" />
        </g>
      )}
      {name === 'fleur' && (
        <g {...line}>
          <path d="M12 4c2 2.4 2 5.4 0 8 -2-2.6-2-5.6 0-8zM12 12v8M7 20h10M12 12C9 9 5.5 10 5.5 13.2 5.5 15 7 16 9 15.5M12 12c3-3 6.5-2 6.5 1.2 0 1.8-1.5 2.8-3.5 2.3" />
        </g>
      )}
    </svg>
  );
}

export type StatIconName = 'attack' | 'defense' | 'carry' | 'speed';
export function StatIcon({ name, size = 18 }: { name: StatIconName; size?: number }) {
  return (
    <svg {...base(size)} className="stat-icon">
      <g {...line}>
        {name === 'attack' && <path d="M5 19 17 7M17 7l2-2 .2 3.4L16 5M6.5 14.5l3 3M4 20l2-2" />}
        {name === 'defense' && <path d="M12 3.5 5.5 6v5.3c0 4 2.6 6.9 6.5 8.4 3.9-1.5 6.5-4.4 6.5-8.400V6z" />}
        {name === 'carry' && <path d="M7 9h10l1.5 10h-13zM9 9V7a3 3 0 0 1 6 0v2" />}
        {name === 'speed' && <path d="M5 17h4l2-4 3 2 1.5-4M14 6.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M5 20h14" />}
      </g>
    </svg>
  );
}

export function CrestIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 40 44" aria-hidden focusable={false}>
      <path d="M3 3h34v22c0 8-7 13.5-17 17C10 38.5 3 33 3 25z" fill="#8f1f1b" stroke="#c6a45d" strokeWidth="2.2" />
      <path d="M20 9c3 3.5 3 8 0 12-3-4-3-8.5 0-12zM20 21v11M14 32h12M20 21c-5-4-9.5-2.5-9.5 1.5 0 2.5 2.5 3.5 5 2.5M20 21c5-4 9.5-2.5 9.5 1.5 0 2.5-2.5 3.5-5 2.5" fill="none" stroke="#e5c77a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
