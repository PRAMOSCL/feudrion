import { useRef, type KeyboardEvent } from 'react';
import type { DistrictState } from '../types';
import { LineIcon } from './Icons';

interface Props {
  districts: DistrictState[];
  active: 'fortress' | 'village';
  onChange: (id: 'fortress' | 'village') => void;
}

/**
 * Selector de distritos en el área de Ciudad. Fortaleza y Villa son pestañas reales (teclado: flechas, Inicio, Fin).
 * Oficios y Campo son expansiones FUTURAS: se muestran como notas no interactivas (no son botones ni parecen funcionales).
 */
export function DistrictSelector({ districts, active, onChange }: Props) {
  const tabs = districts.filter((d) => d.status !== 'future') as (DistrictState & { id: 'fortress' | 'village' })[];
  const future = districts.filter((d) => d.status === 'future');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div className="district-bar">
      <div className="district-tabs" role="tablist" aria-label="Distritos de la ciudad">
        {tabs.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => (refs.current[d.id] = el)}
            type="button"
            role="tab"
            id={`district-tab-${d.id}`}
            aria-selected={active === d.id}
            aria-controls="district-scene"
            tabIndex={active === d.id ? 0 : -1}
            className={`district-tab ${active === d.id ? 'is-active' : ''}`}
            onClick={() => onChange(d.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <LineIcon name={d.id === 'fortress' ? 'shield' : 'city'} size={18} />
            {d.name}
            {d.status === 'planning' && <small>planificación</small>}
          </button>
        ))}
      </div>
      <ul className="district-future" aria-label="Expansiones futuras (no disponibles)">
        {future.map((d) => (
          <li key={d.id} title={`${d.name}: ${d.description}`}>
            {d.name} <small>· futuro</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
