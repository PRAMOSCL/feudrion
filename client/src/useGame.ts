import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import type { GameState, ResourceKey } from './types';

const POLL_MS = 10_000;

/**
 * Estado del juego: el servidor manda, el cliente solo estima.
 * - `now` es la hora estimada del servidor (serverTime + tiempo transcurrido localmente).
 * - Se vuelve a consultar cada pocos segundos y justo después de que venza una cuenta regresiva.
 */
export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const fetchedAt = useRef({ server: 0, perf: 0 });
  const lastFetch = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const s = await api.state();
      fetchedAt.current = { server: s.serverTime, perf: performance.now() };
      lastFetch.current = performance.now();
      setState(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión.');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), POLL_MS);
    const tick = setInterval(() => setTick((t) => t + 1), 500);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  const now = state ? fetchedAt.current.server + (performance.now() - fetchedAt.current.perf) : 0;

  // Refresca poco después de que venza cualquier evento conocido (construcción, reclutamiento, expedición).
  const nextEvent = useMemo(() => {
    if (!state) return Infinity;
    const times: number[] = [];
    for (const b of state.buildings) if (b.construction) times.push(b.construction.finishesAt);
    for (const q of state.recruitQueue) times.push(q.finishesAt);
    for (const e of state.expeditions) times.push(e.status === 'outbound' ? e.arriveAt : e.returnAt);
    return Math.min(...times, Infinity);
  }, [state]);
  useEffect(() => {
    if (state && now >= nextEvent + 300 && performance.now() - lastFetch.current > 1500) void refresh();
  });

  /** Recursos estimados ahora mismo (el servidor es quien decide el valor real). */
  const estimate = useCallback(
    (r: ResourceKey) => {
      if (!state) return 0;
      const res = state.resources[r];
      const dt = Math.max(0, (now - state.serverTime) / 60000);
      let gain = res.ratePerMinute * dt;
      if (r === 'gold') gain += 0.5 * state.population.growthPerMinute * state.rules.goldPerFreeInhabitantPerMinute * dt * dt;
      return Math.max(res.amount, Math.min(res.capacity, res.amount + gain));
    },
    [state, now],
  );

  return { state, error, now, refresh, estimate };
}
