import type { DistrictState } from '../types';
import { LineIcon } from './Icons';
import { Card, CloseButton } from './ui';

interface Props {
  district: DistrictState;
  plotId: string;
  onClose: () => void;
}

/**
 * Inspector de una parcela PLANIFICADA. No hay botón de construir, costos ni efectos: la mecánica no existe todavía y
 * este panel solo explica qué falta definir (ver ROADMAP.md).
 */
export function PlannedInspector({ district, plotId, onClose }: Props) {
  const plot = district.plots.find((p) => p.id === plotId);
  const planned = district.planned.find((p) => p.plotId === plotId);
  if (!plot || !planned) return null;
  return (
    <div className="inspector" role="dialog" aria-label={`Inspector: ${planned.name}`}>
      <header className="insp-head">
        <div>
          <h2>{planned.name}</h2>
          <p>{district.name} · parcela {plot.id.split(':')[1]}</p>
        </div>
        <CloseButton onClick={onClose} label="Cerrar inspector" />
      </header>

      <p className="planned-badge" role="status">
        <LineIcon name="lock" size={16} /> Planificado · mecánica pendiente
      </p>
      <p className="insp-text">
        Esta parcela está <b>reservada en el plano</b>, pero el edificio todavía no existe como mecánica: no se puede construir, no consume
        recursos y no aporta oro, felicidad, población ni defensa.
      </p>

      <Card title="Requisitos pendientes de definir" icon={<LineIcon name="rules" size={20} />}>
        <ul className="lines">
          {planned.pending.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="insp-note">Fase {planned.phase} del roadmap. Las cifras de costo, tiempo y efecto se definirán con su mecánica.</p>
      </Card>

      <Card title="Tipos admitidos" icon={<LineIcon name="city" size={20} />}>
        <p className="insp-note">{plot.allowedTypes.join(', ')}</p>
      </Card>

      <p className="insp-note">Las coordenadas del plano son provisionales y se ajustarán cuando exista el terreno de la Villa.</p>
    </div>
  );
}
