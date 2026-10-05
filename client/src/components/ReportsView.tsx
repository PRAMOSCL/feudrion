import { useEffect, useMemo, useState } from 'react';
import { ART, EXPECTED_FILE } from '../artManifest';
import { RESOURCE_LABEL, RESOURCE_ORDER, UNIT_NAME, fmt, fmtDuration } from '../format';
import type { CampState, GameState, ReportState, UnitType } from '../types';
import { LineIcon } from './Icons';
import { ArtPending, Button, Card, EmptyState, ResultBadge, UnitPortrait } from './ui';
import { ResourceIcon } from './Icons';

const UNITS: UnitType[] = ['lancero', 'arquero', 'espadachin', 'ballestero'];
type Filter = 'all' | 'victory' | 'defeat';

const sum = (c: Record<UnitType, number>) => UNITS.reduce((s, u) => s + c[u], 0);

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Hoy · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ayer · ${time}`;
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · ${time}`;
}

/** Duración total de la expedición, derivada de datos existentes: el regreso dura lo mismo que la ida. */
export function expeditionDuration(r: ReportState): number | null {
  return r.deliveredAt ? ((r.deliveredAt - r.createdAt) * 2) / 1000 : null;
}

interface Props {
  state: GameState;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onGoWorld: () => void;
}

export function useSelectedReport(state: GameState, selectedId: number | null) {
  return useMemo(() => state.reports.find((r) => r.id === selectedId) ?? state.reports[0] ?? null, [state.reports, selectedId]);
}

const backdropStyle = ART.reportsBackdrop ? ({ '--backdrop': `url(${ART.reportsBackdrop})` } as React.CSSProperties) : undefined;

export function ReportsMain({ state, selectedId, onSelect, onGoWorld }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const campName = (key: string) => state.camps.find((c) => c.key === key)?.name ?? key;
  const list = state.reports.filter((r) => filter === 'all' || r.result === filter);
  const current = useSelectedReport(state, selectedId);
  const wins = state.reports.filter((r) => r.result === 'victory').length;

  // Si el filtro oculta el informe seleccionado, se selecciona el primero visible.
  useEffect(() => {
    if (list.length > 0 && !list.some((r) => r.id === current?.id)) onSelect(list[0].id);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.reports.length === 0) {
    return (
      <div className="page reports-page" style={backdropStyle}>
        <h1 className="page-title">Informes</h1>
        <EmptyState
          art={
            <div className="empty-art-ring" aria-hidden>
              <LineIcon name="reports" size={64} />
            </div>
          }
          title="Todavía no hay informes"
          action={<Button variant="primary" onClick={onGoWorld}>Explorar el Mundo</Button>}
        >
          Cuando tus expediciones lleguen a un campamento, el resultado del combate quedará registrado aquí.
        </EmptyState>
      </div>
    );
  }

  const camp = state.camps.find((c) => c.key === current?.camp);
  return (
    <div className="page reports-page" style={backdropStyle}>
      <h1 className="page-title">Informes</h1>
      <div className="reports-grid">
        <div className="reports-list-col">
          <div className="filter-tabs" role="tablist" aria-label="Filtrar informes">
            {([['all', `Todos`], ['victory', 'Victorias'], ['defeat', 'Derrotas']] as [Filter, string][]).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
                {label}
                <small>{id === 'all' ? state.reports.length : id === 'victory' ? wins : state.reports.length - wins}</small>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="insp-note center">No hay informes con este filtro.</p>
          ) : (
            <ul className="report-list">
              {list.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`report-item ${current?.id === r.id ? 'is-active' : ''}`} aria-current={current?.id === r.id} onClick={() => onSelect(r.id)}>
                    <ResultBadge result={r.result} />
                    <span className="grow">
                      <b>{campName(r.camp)}</b>
                      <span className={`res-text-${r.result}`}>{r.result === 'victory' ? 'Victoria' : 'Derrota'}</span>
                    </span>
                    <time>{dayLabel(r.createdAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {current && <ReportDetail r={current} camp={camp} onGoWorld={onGoWorld} />}
      </div>
    </div>
  );
}

function ReportDetail({ r, camp, onGoWorld }: { r: ReportState; camp?: CampState; onGoWorld: () => void }) {
  const art = camp ? ART.camps[camp.key] : null;
  const lostTotal = sum(r.lost);
  const gain = RESOURCE_ORDER.filter((k) => r.loot[k] > 0);
  return (
    <article className="report-detail" aria-label="Detalle del informe">
      <h2>
        {r.result === 'victory' ? 'Victoria' : 'Derrota'} en {camp?.name ?? r.camp}
      </h2>
      {art ? <img className="portrait-camp" src={art} alt="" /> : camp && <ArtPending file={EXPECTED_FILE.camp(camp.key)} />}

      <div className="troops-split">
        <Card title="Tropas enviadas" icon={<LineIcon name="army" size={20} />}>
          <UnitTable counts={r.sent} />
        </Card>
        <div className="losses" aria-label="Bajas">
          <LineIcon name="skull" size={30} />
          <small>Bajas</small>
          <b>{lostTotal}</b>
        </div>
        <Card title="Supervivientes" icon={<LineIcon name="people" size={20} />}>
          <UnitTable counts={r.survivors} />
        </Card>
      </div>

      <Card title="Botín obtenido" icon={<LineIcon name="flag" size={20} />}>
        {gain.length === 0 ? (
          <p className="insp-note">{r.result === 'defeat' ? 'Una derrota no deja botín.' : 'Sin botín.'}</p>
        ) : (
          <ul className="loot-grid">
            {gain.map((k) => {
              const got = r.delivered ? r.delivered[k] : null;
              return (
                <li key={k}>
                  <ResourceIcon resource={k} size={30} />
                  <span>{RESOURCE_LABEL[k]}</span>
                  <b>{fmt(got ?? r.loot[k])}</b>
                  {got === null && <small>en camino</small>}
                  {got !== null && got < r.loot[k] && <small className="warn">almacén lleno: se perdieron {fmt(r.loot[k] - got)}</small>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <div className="detail-actions">
        <Button variant="primary" onClick={onGoWorld}>Volver al mundo</Button>
      </div>
    </article>
  );
}

function UnitTable({ counts }: { counts: Record<UnitType, number> }) {
  const rows = UNITS.filter((u) => counts[u] > 0);
  if (rows.length === 0) return <p className="insp-note">Ninguna.</p>;
  return (
    <ul className="unit-table">
      {rows.map((u) => (
        <li key={u}>
          <UnitPortrait unit={u} src={ART.portraits[u]} size="row" />
          <span className="grow">{UNIT_NAME[u].replace(/s$/, '').replace('Espadachine', 'Espadachín')}</span>
          <b>{counts[u]}</b>
        </li>
      ))}
    </ul>
  );
}

export function ReportsInspector({ state, report }: { state: GameState; report: ReportState | null }) {
  if (!report) {
    return (
      <div className="inspector">
        <Card title="Resumen" icon={<LineIcon name="reports" size={20} />}>
          <p className="insp-note">Aquí verás el resumen del informe seleccionado.</p>
        </Card>
      </div>
    );
  }
  const camp = state.camps.find((c) => c.key === report.camp);
  const duration = expeditionDuration(report);
  return (
    <div className="inspector">
      <Card title="Resumen" icon={<LineIcon name="reports" size={20} />}>
        <dl className="summary-list">
          <div>
            <dt><LineIcon name="pin" size={18} /> Destino</dt>
            <dd>{camp?.name ?? report.camp}</dd>
          </div>
          <div>
            <dt><LineIcon name="army" size={18} /> Resultado</dt>
            <dd className={`res-text-${report.result}`}>{report.result === 'victory' ? 'Victoria' : 'Derrota'}</dd>
          </div>
          <div>
            <dt><LineIcon name="flag" size={18} /> Combate</dt>
            <dd>{dayLabel(report.createdAt)}</dd>
          </div>
          <div>
            <dt><LineIcon name="shield" size={18} /> Fuerzas</dt>
            <dd>
              Ataque {report.details.ourAttack} vs defensa {report.details.campDefense}
              <small> · razón {report.details.ratio.toFixed(2)} · bajas {Math.round(report.details.lossFraction * 100)} %</small>
            </dd>
          </div>
          <div>
            <dt><LineIcon name="rules" size={18} /> Duración</dt>
            <dd>{duration === null ? 'Las tropas aún regresan' : fmtDuration(duration)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
