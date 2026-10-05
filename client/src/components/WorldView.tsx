import { useRef, useState } from 'react';
import { ApiError, api } from '../api';
import { ART, EXPECTED_FILE } from '../artManifest';
import { UNIT_NAME, fmtDuration } from '../format';
import type { CampState, ExpeditionState, GameState, UnitType } from '../types';
import { ClockIcon, LineIcon, UnitIcon } from './Icons';
import { ScaledStage } from './ScaledStage';
import { ArtPending, Button, Card, CloseButton, CostChips, ProgressBar, Stepper } from './ui';

import { CAMP_SITES, CITY_SITE, WORLD_H, WORLD_W } from '../worldConfig';

const CITY_POS = CITY_SITE;
const campSite = (c: CampState) => CAMP_SITES[c.key] ?? { x: (c.map.x / 100) * WORLD_W, y: (c.map.y / 100) * WORLD_H, labelDy: 90 };
const campPos = (c: CampState) => campSite(c);

function CampGlyph({ difficulty, size = 30 }: { difficulty: 1 | 2 | 3; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-12 -14 24 24" aria-hidden focusable={false}>
      {difficulty === 1 && (
        <g stroke="#2b1a08" strokeWidth=".8" strokeLinejoin="round">
          <path d="M-8 7 0-8 8 7z" fill="#b8744a" />
          <path d="M0-8v15M-11 8h22" />
        </g>
      )}
      {difficulty === 2 && (
        <g stroke="#2b1a08" strokeWidth=".8">
          <rect x="-10" y="-3" width="20" height="10" fill="#9b6a3a" />
          {[-9, -4.5, 0, 4.5, 9].map((x) => (
            <path key={x} d={`M${x - 2} -3 ${x} -9l2 6z`} fill="#b78249" />
          ))}
          <rect x="-2.2" y="1" width="4.4" height="6" fill="#2b1a08" />
        </g>
      )}
      {difficulty === 3 && (
        <g stroke="#2b2e31" strokeWidth=".8">
          <rect x="-6" y="-9" width="12" height="17" fill="#9aa0a6" />
          <path d="M-7-9h2.300v-3.500h2.400v3.500h2.600v-3.500h2.400v3.500h2.300z" fill="#7d838a" />
          <rect x="-1.600" y="0" width="3.200" height="8" fill="#2b2e31" />
          <path d="M0-12v-6l6 2L0-14z" fill="#a33" stroke="none" />
        </g>
      )}
    </svg>
  );
}

const Stars = ({ n }: { n: number }) => (
  <span className="stars" aria-label={`Dificultad ${n} de 3`}>
    {[1, 2, 3].map((i) => (
      <i key={i} className={i <= n ? 'on' : ''}>★</i>
    ))}
  </span>
);

function routePoint(e: ExpeditionState, camp: CampState, now: number) {
  const from = e.status === 'outbound' ? CITY_POS : campPos(camp);
  const to = e.status === 'outbound' ? campPos(camp) : CITY_POS;
  const start = e.status === 'outbound' ? e.sentAt : e.arriveAt;
  const end = e.status === 'outbound' ? e.arriveAt : e.returnAt;
  const t = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** Mapa de fondo. Mientras no exista `world_map.png` se usa el mapa SVG anterior, marcado como provisional. */
function MapBackdrop({ camps }: { camps: CampState[] }) {
  if (ART.worldMap) return <img className="stage-ground" src={ART.worldMap} width={WORLD_W} height={WORLD_H} alt="" draggable={false} />;
  return (
    <>
      <svg className="stage-ground world-fallback" viewBox="0 0 160 100" width={WORLD_W} height={WORLD_H} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="wm-parch" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4b4128" />
            <stop offset="1" stopColor="#2f2a1b" />
          </linearGradient>
          <radialGradient id="wm-meadow" cx=".5" cy=".5" r=".65">
            <stop offset="0" stopColor="#7d8d49" />
            <stop offset="1" stopColor="#5b6a33" />
          </radialGradient>
        </defs>
        <rect width="160" height="100" fill="url(#wm-parch)" />
        <path d="M6 22C20 6 62 4 92 10s52-2 62 14c6 14-4 30-2 46s-14 24-40 22-34-8-60-4S6 92 4 66 -6 38 6 22z" fill="url(#wm-meadow)" stroke="#3f4b22" strokeWidth=".8" />
        <path d="M60-2C56 20 70 32 62 48s-14 22-4 52" fill="none" stroke="#3f6d8f" strokeWidth="4" strokeLinecap="round" opacity=".9" />
        <path d="M60-2C56 20 70 32 62 48s-14 22-4 52" fill="none" stroke="#8fc0d9" strokeWidth="1.2" strokeLinecap="round" />
        {[[18, 40], [24, 46], [14, 50], [110, 56], [118, 62], [104, 64], [130, 16], [138, 22], [90, 84]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0-6 4 2h-8z" fill="#3f6a2e" stroke="#243a18" strokeWidth=".5" />
            <rect x="-.6" y="2" width="1.2" height="2" fill="#4a2f14" />
          </g>
        ))}
        {[[140, 48], [147, 52], [134, 54]].map(([x, y], i) => (
          <path key={i} d={`M${x - 7} ${y} ${x} ${y - 11} ${x + 7} ${y}z`} fill="#8b857a" stroke="#4a463e" strokeWidth=".6" />
        ))}
        {camps.map((c) => {
          const p = { x: (c.map.x / 100) * 160, y: (c.map.y / 100) * 100 };
          return <path key={c.key} d={`M${CITY_POS.x / 10} ${CITY_POS.y / 10} Q${(CITY_POS.x / 10 + p.x) / 2} ${(CITY_POS.y / 10 + p.y) / 2 + 8} ${p.x} ${p.y}`} fill="none" stroke="#c9a96b" strokeWidth=".7" strokeDasharray="2.2 1.6" opacity=".7" />;
        })}
      </svg>
      <div className="stage-note">
        <ArtPending file={EXPECTED_FILE.worldMap} compact>
          Mapa provisional (SVG)
        </ArtPending>
      </div>
    </>
  );
}

interface StageProps {
  state: GameState;
  now: number;
  selected: string | null;
  onSelect: (key: string) => void;
}

export function WorldStage({ state, now, selected, onSelect }: StageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  return (
    <ScaledStage width={WORLD_W} height={WORLD_H} minScale={0.5} frameRef={frameRef} backdropColor="#14120d" label="Mapa regional">
      <MapBackdrop camps={state.camps} />

      <svg className="stage-plots" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} width={WORLD_W} height={WORLD_H} aria-hidden>
        {state.expeditions.map((e) => {
          const c = state.camps.find((x) => x.key === e.camp)!;
          const p = campPos(c);
          return <line key={e.id} x1={CITY_POS.x} y1={CITY_POS.y} x2={p.x} y2={p.y} className="route" />;
        })}
      </svg>

      {/* Villa Robledal: etiqueta bajo el poblado (no es un destino) */}
      <div className="anchor" style={{ left: CITY_SITE.x, top: CITY_SITE.y + CITY_SITE.labelDy, zIndex: 20 }}>
        <span className="chip-label is-city">
          <LineIcon name="city" size={18} />
          <span className="chip-name">{state.city.name}</span>
        </span>
      </div>

      {state.camps.map((c) => {
        const site = campSite(c);
        const active = selected === c.key;
        return (
          <div key={c.key}>
            <div className="anchor" style={{ left: site.x, top: site.y, zIndex: 30 }}>
              <button type="button" className={`site-hit ${active ? 'is-active' : ''}`} aria-pressed={active} aria-label={`${c.name}, dificultad ${c.difficulty} de 3`} onClick={() => onSelect(c.key)} />
            </div>
            <div className="anchor" style={{ left: site.x, top: site.y + site.labelDy, zIndex: 31 }}>
              <span className={`chip-label is-site ${active ? 'is-active' : ''}`} onClick={() => onSelect(c.key)} aria-hidden>
                <CampGlyph difficulty={c.difficulty} size={22} />
                <span className="chip-name">{c.name}</span>
              </span>
            </div>
          </div>
        );
      })}

      {state.expeditions.map((e) => {
        const c = state.camps.find((x) => x.key === e.camp)!;
        const p = routePoint(e, c, now);
        return (
          <div key={e.id} className="anchor" style={{ left: p.x, top: p.y, zIndex: 50 }}>
            <span className={`marcher ${e.status}`} title={e.status === 'outbound' ? 'Tropas en camino' : 'Tropas de regreso'}>
              <LineIcon name="army" size={16} />
            </span>
          </div>
        );
      })}
    </ScaledStage>
  );
}

interface InspectorProps {
  camp: CampState;
  state: GameState;
  now: number;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onGoReports: () => void;
}

export function CampInspector({ camp, state, now, onClose, onChanged, onGoReports }: InspectorProps) {
  const [sel, setSel] = useState<Partial<Record<UnitType, number>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const chosen = state.units.filter((u) => (sel[u.type] ?? 0) > 0);
  const attack = chosen.reduce((s, u) => s + u.attack * (sel[u.type] ?? 0), 0);
  const total = chosen.reduce((s, u) => s + (sel[u.type] ?? 0), 0);
  const slowest = chosen.length ? Math.min(...chosen.map((u) => u.speed)) : 1;
  const travel = Math.round(camp.travelSeconds / slowest);
  const ratio = attack / camp.defense;
  const art = ART.camps[camp.key];

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      await api.expedition(camp.key, Object.fromEntries(chosen.map((u) => [u.type, sel[u.type]!])));
      setSel({});
      setMsg({ kind: 'ok', text: 'Expedición en marcha. Las tropas no estarán disponibles hasta su regreso.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : 'Error inesperado.' });
    } finally {
      await onChanged();
      setBusy(false);
    }
  }

  return (
    <div className="inspector" role="dialog" aria-label={`Inspector: ${camp.name}`}>
      <header className="insp-head">
        <div>
          <h2>{camp.name}</h2>
          <p>
            Dificultad <Stars n={camp.difficulty} />
          </p>
        </div>
        <CloseButton onClick={onClose} label="Cerrar inspector" />
      </header>

      {art ? <img className="portrait-camp" src={art} alt="" /> : (
        <ArtPending file={EXPECTED_FILE.camp(camp.key)}>
          <CampGlyph difficulty={camp.difficulty} size={64} />
        </ArtPending>
      )}
      <p className="insp-text">{camp.description}</p>

      <Card title="Fuerzas conocidas" icon={<LineIcon name="shield" size={20} />}>
        <dl className="kv-grid">
          <div><dt>Ataque</dt><dd>{camp.attack}</dd></div>
          <div><dt>Defensa</dt><dd>{camp.defense}</dd></div>
          <div><dt>Viaje (ida)</dt><dd>{fmtDuration(camp.travelSeconds)}</dd></div>
        </dl>
      </Card>

      <Card title="Botín estimado" icon={<LineIcon name="flag" size={20} />}>
        <CostChips cost={camp.loot} />
        <p className="insp-note">Máximo del campamento; el botín real depende de la carga de los supervivientes y del espacio del almacén.</p>
      </Card>

      <Card title="Preparar expedición" icon={<LineIcon name="army" size={20} />}>
        <ul className="troop-rows">
          {state.units.map((u) => (
            <li key={u.type} className={u.home === 0 ? 'is-empty' : ''}>
              <UnitIcon unit={u.type} size={24} />
              <span className="grow">
                {UNIT_NAME[u.type]} <small>({u.home})</small>
              </span>
              <Stepper label={`Enviar ${UNIT_NAME[u.type]}`} value={sel[u.type] ?? 0} min={0} max={u.home} disabled={u.home === 0 || busy} onChange={(n) => setSel((s) => ({ ...s, [u.type]: n }))} />
            </li>
          ))}
        </ul>
        <div className="kv-row">
          <span><ClockIcon size={18} /> Tiempo de viaje (ida)</span>
          <b>{total === 0 ? '—' : fmtDuration(travel)}</b>
        </div>
        <p className={`forecast ${total === 0 ? '' : ratio >= 1 ? 'good' : 'bad'}`}>
          {total === 0 ? 'Elige las unidades que enviarás.' : `Ataque ${attack} frente a defensa ${camp.defense}: ${ratio >= 1 ? 'victoria segura (el combate no tiene azar).' : 'derrota segura; perderías gran parte de las tropas.'}`}
        </p>
      </Card>

      <Card title="Expediciones activas" icon={<LineIcon name="flag" size={20} />}>
        {state.expeditions.length === 0 ? (
          <p className="insp-note center">Sin expediciones activas.</p>
        ) : (
          <ul className="exp-list">
            {state.expeditions.map((e) => {
              const c = state.camps.find((x) => x.key === e.camp)!;
              const start = e.status === 'outbound' ? e.sentAt : e.arriveAt;
              const end = e.status === 'outbound' ? e.arriveAt : e.returnAt;
              return (
                <li key={e.id}>
                  <div className="exp-top">
                    <b>{c.name}</b>
                    <span>{e.status === 'outbound' ? 'Ida' : 'Regreso'} · {fmtDuration((end - now) / 1000)}</span>
                  </div>
                  <ProgressBar value={(now - start) / (end - start)} label={`Progreso hacia ${c.name}`} />
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="ghost" size="sm" onClick={onGoReports}>Ver informes</Button>
      </Card>

      <div className="insp-sticky">
        {msg && <p className={`msg ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
        <Button variant="primary" block disabled={busy || total === 0} onClick={send}>
          Enviar expedición{total > 0 ? ` (${total})` : ''}
        </Button>
      </div>
    </div>
  );
}
