/**
 * Definición de DISTRITO para el cliente (geometría, rutas, arte, zonas). Los IDs de distrito y de parcela son los del servidor
 * (`server/src/config/districts.ts`); aquí solo vive lo que el servidor no necesita saber: dónde se dibuja cada cosa.
 *
 * Cada escena tiene su propio sistema de coordenadas (`sceneBounds`) y UNA transformación uniforme (escala) para terreno, edificios y
 * actores; el clic usa la inversa de esa misma transformación (`clientToStage`). No se usan porcentajes CSS independientes.
 */

export type DistrictId = 'fortress' | 'village' | 'crafts' | 'countryside';
export type DistrictStatus = 'active' | 'planning' | 'future';
export type Pt = readonly [number, number];

export type Footprint = { kind: 'ellipse'; rx: number; ry: number } | { kind: 'rect'; hx: number; hy: number };

export interface PlotGeometry {
  /** ID estable: el mismo que usa el servidor (`distrito:ranura`). */
  id: string;
  districtId: DistrictId;
  /** Punto de anclaje en la escena (centro de la huella / base del edificio). */
  anchor: Pt;
  footprint: Footprint;
  allowedTypes: readonly string[];
  /** silhouette = se selecciona por la silueta del sprite; footprint = por su huella. */
  interaction: 'silhouette' | 'footprint';
  /** Punto de la ruta/calle por donde se accede a la parcela (null si no aplica). */
  access: Pt | null;
  /** Prioridad de profundidad: normalmente la `y` de la base. */
  depth: number;
}

export interface RouteDef {
  id: string;
  kind: 'street' | 'villagers' | 'patrol' | 'entrance' | 'exit' | 'open_area';
  points: readonly Pt[];
  /** Semiancho reservado alrededor de la línea (mismas unidades que la escena). */
  halfWidth: number;
}

export interface EntranceDef {
  id: string;
  at: Pt;
  /** Distrito al que conduce. */
  to: DistrictId | null;
}

export interface ZoneDef {
  id: string;
  label: string;
  /** Banda o polígono reservado: no se construye ahí. */
  kind: 'future_wall' | 'exclusion';
  points: readonly Pt[];
}

export interface OcclusionLayer {
  id: string;
  /** Por debajo (back) o por encima (front) de edificios y actores. */
  order: 'back' | 'front';
  note: string;
}

export interface DistrictDefinition {
  id: DistrictId;
  name: string;
  status: DistrictStatus;
  sceneBounds: { w: number; h: number };
  /** Terreno del distrito. `null` = todavía no existe (se muestra un esquema de planificación, no una villa pintada). */
  terrainAsset: string | null;
  /** true si las coordenadas son provisionales (no calibradas sobre un terreno final). */
  provisional: boolean;
  entrances: readonly EntranceDef[];
  plots: readonly PlotGeometry[];
  routes: readonly RouteDef[];
  exclusions: readonly ZoneDef[];
  occlusionLayers: readonly OcclusionLayer[];
}
