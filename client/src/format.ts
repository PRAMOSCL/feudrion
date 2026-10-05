import type { Cost, ResourceKey, UnitType } from './types';

export const RESOURCE_LABEL: Record<ResourceKey, string> = {
  wood: 'Madera',
  stone: 'Piedra',
  food: 'Alimentos',
  gold: 'Oro',
};
export const RESOURCE_ORDER: ResourceKey[] = ['wood', 'stone', 'food', 'gold'];

export const UNIT_NAME: Record<UnitType, string> = {
  lancero: 'Lanceros',
  arquero: 'Arqueros',
  espadachin: 'Espadachines',
  ballestero: 'Ballesteros',
};

const nf = new Intl.NumberFormat('es-ES');
export const fmt = (n: number) => nf.format(Math.floor(n + 1e-9));
export const fmt1 = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n);

/** 83 → "1:23", 3700 → "1:01:40" */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const costEntries = (cost: Cost) =>
  RESOURCE_ORDER.filter((r) => (cost[r] ?? 0) > 0).map((r) => [r, cost[r]!] as const);

export function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
