import type { BuildingState, GameState, PlotBuilding } from '../types';
import {
  AMBIENT,
  GUARDS_VISIBLE_BY_STAGE,
  MAX_FIGURES_PER_BUILDING,
  STATIONS,
  WALL_REVEAL_SECTIONS,
  WORKERS_PER_FIGURE,
} from './liveConfig';

/**
 * Modelo visual derivado del estado REAL del servidor (puro, sin DOM). La animación nunca decide nada: solo representa
 * lo que el servidor ya calculó (asignados, actividad productiva, muralla, guarnición, población).
 */

export type WallStage = 0 | 1 | 2 | 3;

export interface LiveModel {
  /** Figuras de trabajo visibles por edificio (solo si la producción está realmente activa). */
  workers: { building: PlotBuilding; figures: number }[];
  /** Guardias visibles en los parapetos (no son los efectivos reales de la guarnición). */
  guards: number;
  /** Habitantes decorativos: no generan recursos ni alteran la población. */
  ambient: number;
  /** Aspecto de la muralla construida (0 = ninguna). */
  wallStage: WallStage;
  /** Edificios construidos (ocluyen a los actores situados detrás de su base). */
  built: PlotBuilding[];
}

/** Figuras representativas: 1 por cada `WORKERS_PER_FIGURE` asignados (máx. 3); 0 si no hay trabajo real. */
export function figuresFor(workers: number, producing: boolean): number {
  if (!producing || workers <= 0) return 0;
  return Math.min(MAX_FIGURES_PER_BUILDING, Math.ceil(workers / WORKERS_PER_FIGURE));
}

export const ambientCount = (population: number): number =>
  Math.max(AMBIENT.min, Math.min(AMBIENT.max, Math.floor(population / AMBIENT.inhabitantsPerFigure)));

export const guardsVisible = (garrisonArchers: number, stage: WallStage): number =>
  stage === 0 ? 0 : Math.min(Math.max(0, Math.floor(garrisonArchers)), GUARDS_VISIBLE_BY_STAGE[stage]);

export function wallStageOf(buildings: BuildingState[]): WallStage {
  const wall = buildings.find((b) => b.type === 'wall');
  return (wall && wall.level > 0 ? (wall.effect.wallStage ?? 0) : 0) as WallStage;
}

export interface WallVisual {
  /** Overlay completo vigente (la defensa construida). */
  stage: WallStage;
  /** Obra inicial: revela por tramos el aspecto 1 mientras no hay muralla. Las mejoras NO cambian el overlay hasta terminar. */
  reveal: { stage: 1; sections: number } | null;
}

/**
 * Estados claramente separados: sin construir → construyendo (primer nivel, tramos revelados) → construida →
 * mejorando (se conserva el overlay vigente; el nuevo aspecto aparece al terminar).
 */
export function wallVisual(wall: BuildingState | undefined, now: number): WallVisual {
  if (!wall) return { stage: 0, reveal: null };
  const stage = (wall.level > 0 ? (wall.effect.wallStage ?? 0) : 0) as WallStage;
  if (wall.level === 0 && wall.construction) {
    const c = wall.construction;
    const progress = Math.min(1, Math.max(0, (now - c.startedAt) / (c.finishesAt - c.startedAt)));
    return { stage: 0, reveal: { stage: 1, sections: Math.min(WALL_REVEAL_SECTIONS, Math.floor(progress * WALL_REVEAL_SECTIONS)) } };
  }
  return { stage, reveal: null };
}

export function buildLiveModel(state: GameState): LiveModel {
  const workers: LiveModel['workers'] = [];
  for (const b of state.buildings) {
    if (b.type === 'wall' || !STATIONS[b.type as PlotBuilding]) continue;
    const figures = figuresFor(b.workers, !!b.activity?.producing && b.level > 0);
    if (figures > 0) workers.push({ building: b.type as PlotBuilding, figures });
  }
  const stage = wallStageOf(state.buildings);
  return {
    workers,
    guards: guardsVisible(state.garrison.archers, stage),
    ambient: ambientCount(state.population.current),
    wallStage: stage,
    built: state.buildings.filter((b) => b.type !== 'wall' && b.level > 0).map((b) => b.type as PlotBuilding),
  };
}
