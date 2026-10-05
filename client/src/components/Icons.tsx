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

export function ResourceIcon({ resource, size = 20 }: { resource: ResourceKey; size?: number }) {
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
  const stroke = { fill: 'none', stroke: '#3b230d', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
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
