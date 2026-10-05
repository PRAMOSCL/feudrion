import type { ResourceKey, UnitType } from './types';

/**
 * Arte opcional del rediseño. Un valor `null` significa "el asset todavía no existe": la interfaz
 * muestra entonces un marcador EXPLÍCITO (con el nombre del archivo esperado) en lugar de pedir un
 * archivo inexistente. Para activarlo basta copiar el PNG a `client/public/assets/` y poner aquí su ruta.
 *
 * Lista de faltantes y medidas recomendadas: ver `docs/ASSETS_PENDIENTES.md`.
 */
export const ART: {
  worldMap: string | null;
  portraits: Record<UnitType, string | null>;
  camps: Record<string, string | null>;
  armyBanner: string | null;
  reportsBackdrop: string | null;
  /** Iconos de recurso (64×64 con transparencia). `null` = se usa el SVG provisional. */
  resourceIcons: Record<ResourceKey | 'population', string | null>;
} = {
  worldMap: '/assets/world_map.png', // 1600×1000, sin marcadores ni texto
  portraits: {
    lancero: '/assets/portrait_lancero.png', // 480×360 (4:3)
    arquero: '/assets/portrait_arquero.png',
    espadachin: '/assets/portrait_espadachin.png',
    ballestero: '/assets/portrait_ballestero.png',
  },
  camps: {
    bandidos: '/assets/camp_bandidos.png', // 640×360
    fortin: '/assets/camp_fortin.png',
    bastion: '/assets/camp_bastion.png',
  },
  armyBanner: '/assets/army_banner.png', // 1600×240
  reportsBackdrop: '/assets/reports_backdrop.png', // 1920×1080
  resourceIcons: {
    wood: '/assets/resource_wood.png',
    stone: '/assets/resource_stone.png',
    food: '/assets/resource_food.png',
    gold: '/assets/resource_gold.png',
    population: '/assets/resource_population.png',
  },
};

/** Nombre de archivo esperado, para los marcadores explícitos. */
export const EXPECTED_FILE = {
  worldMap: 'world_map.png',
  portrait: (u: UnitType) => `portrait_${u}.png`,
  camp: (key: string) => `camp_${key}.png`,
  armyBanner: 'army_banner.png',
  reportsBackdrop: 'reports_backdrop.png',
};
