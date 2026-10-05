import { useState } from 'react';
import { ApiError, api } from '../api';
import { UNIT_NAME, costEntries, fmt, fmtDuration } from '../format';
import type { CampState, ExpeditionState, GameState, UnitType } from '../types';
import { ClockIcon, CrossIcon, ResourceIcon, UnitIcon } from './Icons';

const CITY = { x: 36, y: 70 };
const VIEW_W = 160;
const VIEW_H = 100;
const campPos = (c: CampState) => ({ x: (c.map.x / 100) * VIEW_W, y: (c.map.y / 100) * VIEW_H });

function CampGlyph({ difficulty }: { difficulty: 1 | 2 | 3 }) {
  if (difficulty === 1)
    return (
      <g>
        <path d="M-6 4 0-7 6 4z" fill="#b8744a" stroke="#4a2410" strokeWidth=".8" />
        <path d="M0-7v11" stroke="#4a2410" strokeWidth=".6" />
        <path d="M-9 5h18" stroke="#4a2410" strokeWidth=".8" />
      </g>
    );
  if (difficulty === 2)
    return (
      <g stroke="#3b230d" strokeWidth=".7">
        <rect x="-9" y="-3" width="18" height="8" fill="#9b6a3a" />
        {[-8, -4, 0, 4, 8].map((x) => (
          <path key={x} d={`M${x - 1.6} -3 ${x} -8l1.6 5z`} fill="#b78249" />
        ))}
        <rect x="-2" y="0" width="4" height="5" fill="#3b230d" />
      </g>
    );
  return (
    <g stroke="#2f3236" strokeWidth=".8">
      <rect x="-5" y="-9" width="10" height="14" fill="#9aa0a6" />
      <path d="M-6-9h2v-3h2v3h2v-3h2v3h2v-3h2v3z" fill="#7d838a" />
      <rect x="-1.4" y="-2" width="2.8" height="7" fill="#2f3236" />
      <path d="M0-12v-5l5 1.5L0-13z" fill="#a33" stroke="none" />
    </g>
  );
}

function marker(e: ExpeditionState, camp: CampState, now: number) {
  const from = e.status === 'outbound' ? CITY : campPos(camp);
  const to = e.status === 'outbound' ? campPos(camp) : CITY;
  const start = e.status === 'outbound' ? e.sentAt : e.arriveAt;
  const end = e.status === 'outbound' ? e.arriveAt : e.returnAt;
  const t = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

interface Props {
  state: GameState;
  now: number;
  onChanged: () => Promise<void>;
  onViewReports: () => void;
}

export function WorldView({ state, now, onChanged, onViewReports }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const camp = state.camps.find((c) => c.key === selected) ?? null;

  return (
    <div className="view world">
      <div className="map-wrap">
        <svg className="world-map" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Mapa regional">
          <defs>
            <linearGradient id="parch" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ecd9a8" />
              <stop offset="1" stopColor="#d9bd82" />
            </linearGradient>
            <radialGradient id="meadow" cx=".5" cy=".5" r=".6">
              <stop offset="0" stopColor="#a8b86a" />
              <stop offset="1" stopColor="#8c9d55" />
            </radialGradient>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#parch)" />
          <path d="M6 22C20 6 62 4 92 10s52-2 62 14c6 14-4 30-2 46s-14 24-40 22-34-8-60-4S6 92 4 66 -6 38 6 22z" fill="url(#meadow)" stroke="#6f7c3d" strokeWidth=".8" />
          {/* río */}
          <path d="M60-2C56 20 70 32 62 48s-14 22-4 52" fill="none" stroke="#6fa2c4" strokeWidth="4" strokeLinecap="round" opacity=".85" />
          <path d="M60-2C56 20 70 32 62 48s-14 22-4 52" fill="none" stroke="#a9d0e6" strokeWidth="1.2" strokeLinecap="round" />
          {/* bosques */}
          {[[18, 40], [24, 46], [14, 50], [110, 56], [118, 62], [104, 64], [130, 16], [138, 22], [90, 84]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M0-6 4 2h-8z" fill="#4f7a3a" stroke="#2f4d22" strokeWidth=".5" />
              <rect x="-.6" y="2" width="1.2" height="2" fill="#4a2f14" />
            </g>
          ))}
          {/* montañas */}
          {[[140, 48], [147, 52], [134, 54]].map(([x, y], i) => (
            <path key={i} d={`M${x - 7} ${y} ${x} ${y - 11} ${x + 7} ${y}z`} fill="#a79f94" stroke="#5e574d" strokeWidth=".6" />
          ))}
          {/* caminos */}
          {state.camps.map((c) => {
            const p = campPos(c);
            return <path key={c.key} d={`M${CITY.x} ${CITY.y} Q${(CITY.x + p.x) / 2} ${(CITY.y + p.y) / 2 + 8} ${p.x} ${p.y}`} fill="none" stroke="#7a5a32" strokeWidth=".9" strokeDasharray="2.2 1.6" />;
          })}

          {/* nuestra ciudad */}
          <g transform={`translate(${CITY.x} ${CITY.y})`}>
            <circle r="9" fill="#f2e4bd" stroke="#4a2f14" strokeWidth=".8" />
            <path d="M-6 4V-3l2 1v-3l2 1v-3l2 1 2-1v3l2-1v3l2-1v7z" fill="#b9892f" stroke="#4a2f14" strokeWidth=".6" />
            <text y="15" textAnchor="middle" className="map-label">{state.city.name}</text>
          </g>

          {/* campamentos */}
          {state.camps.map((c) => {
            const p = campPos(c);
            const active = selected === c.key;
            return (
              <g
                key={c.key}
                transform={`translate(${p.x} ${p.y})`}
                className={`camp ${active ? 'is-active' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${c.name}, dificultad ${c.difficulty}`}
                onClick={() => setSelected(c.key)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(c.key)}
              >
                <circle r="11" className="camp-halo" />
                <CampGlyph difficulty={c.difficulty} />
                <text y="17" textAnchor="middle" className="map-label">{c.name}</text>
                <text y="22" textAnchor="middle" className="map-stars">{'★'.repeat(c.difficulty)}{'☆'.repeat(3 - c.difficulty)}</text>
              </g>
            );
          })}

          {/* expediciones en marcha */}
          {state.expeditions.map((e) => {
            const c = state.camps.find((x) => x.key === e.camp)!;
            const m = marker(e, c, now);
            return (
              <g key={e.id} transform={`translate(${m.x} ${m.y})`} className={`marcher ${e.status}`}>
                <circle r="2.6" />
                <path d="M-1 1.4 1 -1.6M-1 -1 1 1" />
              </g>
            );
          })}
        </svg>
      </div>

      <aside className="side-card">
        {camp ? (
          <CampPanel key={camp.key} camp={camp} state={state} now={now} onClose={() => setSelected(null)} onChanged={onChanged} />
        ) : (
          <div className="empty">
            <h3>Mapa regional</h3>
            <p>Selecciona un campamento para ver su fuerza, el botín posible y organizar una expedición.</p>
          </div>
        )}
        {state.expeditions.length > 0 && (
          <div className="active-expeditions">
            <h3>Expediciones en marcha</h3>
            <ul>
              {state.expeditions.map((e) => {
                const c = state.camps.find((x) => x.key === e.camp)!;
                const target = e.status === 'outbound' ? e.arriveAt : e.returnAt;
                return (
                  <li key={e.id}>
                    <span>{c.name}</span>
                    <span className="muted">
                      {e.status === 'outbound' ? 'Ida: llega en ' : 'Regreso: llega en '}
                      <b>{fmtDuration((target - now) / 1000)}</b>
                    </span>
                  </li>
                );
              })}
            </ul>
            <button className="btn small ghost" onClick={onViewReports}>Ver informes</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function CampPanel({ camp, state, now: _now, onClose, onChanged }: { camp: CampState; state: GameState; now: number; onClose: () => void; onChanged: () => Promise<void> }) {
  const [sel, setSel] = useState<Partial<Record<UnitType, number>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const chosen = state.units.filter((u) => (sel[u.type] ?? 0) > 0);
  const attack = chosen.reduce((s, u) => s + u.attack * (sel[u.type] ?? 0), 0);
  const total = chosen.reduce((s, u) => s + (sel[u.type] ?? 0), 0);
  const slowest = chosen.length ? Math.min(...chosen.map((u) => u.speed)) : 1;
  const travel = Math.round(camp.travelSeconds / slowest);
  const ratio = attack / camp.defense;

  function setUnit(type: UnitType, v: number, max: number) {
    setSel((s) => ({ ...s, [type]: Math.max(0, Math.min(max, Math.floor(Number.isFinite(v) ? v : 0))) }));
  }

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const units = Object.fromEntries(chosen.map((u) => [u.type, sel[u.type]!]));
      await api.expedition(camp.key, units);
      setSel({});
      setMsg({ kind: 'ok', text: 'Expedición en marcha. Las tropas ya no están disponibles hasta su regreso.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : 'Error inesperado.' });
    } finally {
      await onChanged();
      setBusy(false);
    }
  }

  return (
    <div className="camp-panel">
      <header className="panel-head">
        <div>
          <h2>{camp.name}</h2>
          <p className="level-line">Dificultad {'★'.repeat(camp.difficulty)}{'☆'.repeat(3 - camp.difficulty)}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><CrossIcon /></button>
      </header>
      <p className="fn-text">{camp.description}</p>
      <dl className="stats">
        <div><dt>Ataque enemigo</dt><dd>{camp.attack}</dd></div>
        <div><dt>Defensa enemiga</dt><dd>{camp.defense}</dd></div>
        <div><dt>Viaje (ida)</dt><dd><ClockIcon size={14} /> {fmtDuration(camp.travelSeconds)}</dd></div>
      </dl>
      <div className="cost-row" aria-label="Botín posible">
        <span className="muted">Botín posible:</span>
        {costEntries(camp.loot).map(([r, v]) => (
          <span key={r} className="cost"><ResourceIcon resource={r} size={16} /> {v}</span>
        ))}
      </div>

      <h3>Tropas disponibles</h3>
      <ul className="troop-pick">
        {state.units.map((u) => (
          <li key={u.type} className={u.home === 0 ? 'is-empty' : ''}>
            <UnitIcon unit={u.type} />
            <span className="grow">{UNIT_NAME[u.type]} <small className="muted">({u.home})</small></span>
            <input
              type="number"
              min={0}
              max={u.home}
              step={1}
              value={sel[u.type] ?? 0}
              disabled={u.home === 0 || busy}
              onChange={(e) => setUnit(u.type, Number(e.target.value), u.home)}
              aria-label={`Cantidad de ${UNIT_NAME[u.type]}`}
            />
            <button className="btn small ghost" disabled={u.home === 0 || busy} onClick={() => setUnit(u.type, u.home, u.home)}>Todos</button>
          </li>
        ))}
      </ul>

      <p className={`forecast ${total === 0 ? '' : ratio >= 1 ? 'good' : 'bad'}`}>
        {total === 0
          ? 'Elige las unidades que enviarás.'
          : `Ataque ${attack} frente a defensa ${camp.defense}: ${ratio >= 1 ? 'victoria segura (el combate no tiene azar)' : 'derrota segura; perderías gran parte de las tropas'}. Viaje de ida ≈ ${fmtDuration(travel)}.`}
      </p>
      <button className="btn primary wide" disabled={busy || total === 0} onClick={send}>
        Enviar expedición ({fmt(total)} unidades)
      </button>
      {msg && <p className={`msg ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
    </div>
  );
}
