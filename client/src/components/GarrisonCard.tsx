import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import { LineIcon, UnitIcon } from './Icons';
import { Button, Card, Stepper } from './ui';

/**
 * Guarnición de arqueros de la muralla. La asignación la valida el servidor (enteros, capacidad del nivel, arqueros libres reales):
 * los asignados se RESTAN de los disponibles y no pueden reclutarse de nuevo ni salir en expedición.
 */
export function GarrisonCard({ state, wallLevel, busy, onApply }: { state: GameState; wallLevel: number; busy: boolean; onApply: (archers: number) => void }) {
  const { archers, capacity, availableArchers } = state.garrison;
  const [target, setTarget] = useState(archers);
  useEffect(() => setTarget(archers), [archers]);
  // Se puede llegar hasta lo que ya está asignado + lo libre, sin pasar de la capacidad del nivel.
  const max = Math.min(capacity, archers + availableArchers);

  if (wallLevel <= 0) {
    return (
      <Card title="Guarnición" icon={<LineIcon name="shield" size={20} />}>
        <p className="insp-note">Sin muralla no hay guarnición ni patrullas. Constrúyela para asignar arqueros.</p>
      </Card>
    );
  }
  return (
    <Card title="Guarnición" icon={<LineIcon name="shield" size={20} />} aside={`${archers} / ${capacity}`}>
      <div className="garrison-row">
        <UnitIcon unit="arquero" size={24} />
        <span className="grow">
          Arqueros <small>({availableArchers} libres)</small>
        </span>
        <Stepper label="Arqueros de guarnición" value={target} min={0} max={max} disabled={busy} onChange={setTarget} />
      </div>
      <Button variant="primary" block disabled={busy || target === archers} onClick={() => onApply(target)}>
        Asignar guarnición
      </Button>
      <p className="insp-note">
        Los arqueros asignados quedan reservados (no se reclutan de nuevo ni salen en expedición). En los parapetos solo se
        representan unos pocos; la defensa cuenta los efectivos reales.
      </p>
      <p className="insp-note">
        <b>Aún sin uso en combate:</b> la V1 no tiene ataques a la ciudad. La defensa y la guarnición quedan registradas para una
        futura integración de invasiones.
      </p>
    </Card>
  );
}
