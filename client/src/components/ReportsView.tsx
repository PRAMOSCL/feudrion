import { RESOURCE_LABEL, RESOURCE_ORDER, UNIT_NAME, fmt, fmtDateTime } from '../format';
import type { GameState, ReportState, UnitType } from '../types';
import { ResourceIcon, UnitIcon } from './Icons';

const UNITS: UnitType[] = ['lancero', 'arquero', 'espadachin', 'ballestero'];

function UnitRow({ title, counts, strong }: { title: string; counts: Record<UnitType, number>; strong?: boolean }) {
  return (
    <div className="rep-row">
      <span className="rep-title">{title}</span>
      <span className="rep-items">
        {UNITS.filter((u) => counts[u] > 0).map((u) => (
          <span key={u} className={`chip ${strong ? 'strong' : ''}`} title={UNIT_NAME[u]}>
            <UnitIcon unit={u} size={16} /> {counts[u]}
          </span>
        ))}
        {UNITS.every((u) => counts[u] === 0) && <span className="muted">—</span>}
      </span>
    </div>
  );
}

function Report({ r, campName }: { r: ReportState; campName: string }) {
  const lootTotal = RESOURCE_ORDER.reduce((s, k) => s + r.loot[k], 0);
  return (
    <article className={`report ${r.result}`}>
      <header>
        <h3>
          {r.result === 'victory' ? 'Victoria' : 'Derrota'} en {campName}
        </h3>
        <small className="muted">{fmtDateTime(r.createdAt)}</small>
      </header>
      <UnitRow title="Enviadas" counts={r.sent} />
      <UnitRow title="Bajas" counts={r.lost} />
      <UnitRow title="Supervivientes" counts={r.survivors} strong />
      <div className="rep-row">
        <span className="rep-title">Botín</span>
        <span className="rep-items">
          {lootTotal === 0 ? (
            <span className="muted">Sin botín</span>
          ) : (
            RESOURCE_ORDER.filter((k) => r.loot[k] > 0).map((k) => (
              <span key={k} className="chip" title={RESOURCE_LABEL[k]}>
                <ResourceIcon resource={k} size={16} /> {fmt(r.loot[k])}
                {r.delivered && r.delivered[k] < r.loot[k] && <small className="lost-note"> (entregado {fmt(r.delivered[k])}: almacén lleno)</small>}
              </span>
            ))
          )}
        </span>
      </div>
      <p className="muted rep-foot">
        Ataque {r.details.ourAttack} vs defensa {r.details.campDefense} (razón {r.details.ratio.toFixed(2)}) · bajas {Math.round(r.details.lossFraction * 100)} % ·{' '}
        {r.deliveredAt ? `tropas y botín entregados ${fmtDateTime(r.deliveredAt)}` : 'las tropas aún regresan a la ciudad'}
      </p>
    </article>
  );
}

export function ReportsView({ state }: { state: GameState }) {
  return (
    <div className="view reports">
      <section className="card">
        <h2>Informes de batalla</h2>
        {state.reports.length === 0 ? (
          <p className="muted">Todavía no hay informes. Envía una expedición desde el mapa del Mundo.</p>
        ) : (
          <div className="report-list">
            {state.reports.map((r) => (
              <Report key={r.id} r={r} campName={state.camps.find((c) => c.key === r.camp)?.name ?? r.camp} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
