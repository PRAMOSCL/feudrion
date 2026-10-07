import type { ResourceKey, UnitType } from './types';

/**
 * Arte opcional del rediseño. Un valor `null` significa "el asset todavía no existe": la interfaz
 * muestra entonces un marcador EXPLÍCITO (con el nombre del archivo esperado) en lugar de pedir un
 * archivo inexistente. Para activarlo basta copiar el PNG a `client/public/assets/` y poner aquí su ruta.
 *
 * Lista de faltantes y medidas recomendadas: ver `docs/ASSETS_PENDIENTES.md`.
 */
export const ART: {
  /** Terreno sin defensas (Ciudad viva), 1536×1024. `null` = terreno anterior con la muralla pintada. */
  cityGround: string | null;
  /** Overlays transparentes de muralla por aspecto: 1 empalizada, 2 piedra, 3 reforzada (1536×1024, portón abierto). */
  walls: Record<1 | 2 | 3, string | null>;
  /** Hojas de 3×2 poses (celdas de 512×512): flipbooks de seis poses, no animación en 8 direcciones. */
  sheets: Record<'chop' | 'carry' | 'archer' | 'villager' | 'villagerWoman', string | null>;
  /** Caminatas v2 (8 poses con rectángulos y pivotes en `live/atlasV2.json`). Si hay entrada, sustituye a la hoja de 6 poses de la misma clave. */
  sheetsV2: Partial<Record<'carry' | 'villager' | 'villagerWoman', string>>;
  /** Terreno limpio de la Villa (1536×1024). */
  villageGround: string | null;
  /** Casa nivel 1: arte disponible para la fase 3. NO se coloca en la partida ni define capacidad ni reglas. */
  houseStage1: string | null;
  /** Máscara técnica del río v3 (RGBA blanco, alfa binario). NO se dibuja como imagen: recorta el efecto de agua. */
  riverMask: string | null;
  worldMap: string | null;
  portraits: Record<UnitType, string | null>;
  camps: Record<string, string | null>;
  armyBanner: string | null;
  reportsBackdrop: string | null;
  /** Iconos de recurso (64×64 con transparencia). `null` = se usa el SVG provisional. */
  resourceIcons: Record<ResourceKey | 'population', string | null>;
} = {
  // Fortaleza v3 (terreno sin casucha/embarcadero/barca). Los PNG anteriores siguen en la carpeta para comparar o revertir.
  cityGround: '/assets/viva/terrain_fortress_v3_1.png',
  riverMask: '/assets/viva/river_mask_v3_1.png',
  walls: {
    1: '/assets/viva/wall_stage_1_v3.png',
    2: '/assets/viva/wall_stage_2_v3.png',
    3: '/assets/viva/wall_stage_3_v3.png',
  },
  sheets: {
    chop: '/assets/viva/worker_chop_sheet.png',
    carry: '/assets/viva/worker_carry_sheet.png',
    archer: '/assets/viva/archer_patrol_sheet.png',
    villager: '/assets/viva/villager_walk_sheet.png',
    villagerWoman: '/assets/viva/villager_woman_sheet.png',
  },
  sheetsV2: {
    carry: '/assets/viva/worker_carry_sheet_v2.png',
    villager: '/assets/viva/villager_walk_sheet_v2.png',
    villagerWoman: '/assets/viva/villager_woman_sheet_v2.png',
  },
  villageGround: '/assets/viva/terrain_village.png',
  houseStage1: '/assets/viva/house_stage_1.png',
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
