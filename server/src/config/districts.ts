import { BUILDING_TYPES, type BuildingType } from './balance.js';

/**
 * Registro de DISTRITOS y PARCELAS (fase 2 del roadmap). Es la fuente de verdad de IDs y de qué se puede poner dónde;
 * la geometría (coordenadas, rutas, arte) vive en el cliente (`client/src/districts/`), referenciada por estos mismos IDs.
 *
 * Una única ciudad, un único estado y los mismos recursos para todos los distritos: un distrito es solo un lugar.
 * Los edificios existentes conservan su ID (`buildings.type`) y su fila; `district_id` y `plot_id` los sitúan explícitamente.
 */

export const DISTRICT_IDS = ['fortress', 'village', 'crafts', 'countryside'] as const;
export type DistrictId = (typeof DISTRICT_IDS)[number];

/** active = jugable · planning = esquema de planificación, sin mecánicas · future = reservado, sin escena. */
export type DistrictStatus = 'active' | 'planning' | 'future';

export interface DistrictDef {
  id: DistrictId;
  name: string;
  status: DistrictStatus;
  description: string;
}

export const DISTRICTS: DistrictDef[] = [
  { id: 'fortress', name: 'Fortaleza', status: 'active', description: 'Núcleo militar y de gobierno: castillo, cuartel, almacén, muralla y las explotaciones actuales.' },
  { id: 'village', name: 'Villa', status: 'planning', description: 'Vida civil al otro lado del puente: casas, plaza, taberna, iglesia, concejo y embajada. Solo hay un plano de planificación.' },
  { id: 'crafts', name: 'Oficios', status: 'future', description: 'Expansión futura: forja, talleres, depósitos y lonja. Sin escena ni mecánicas.' },
  { id: 'countryside', name: 'Campo', status: 'future', description: 'Expansión futura: explotaciones de alimentos y materias primas. Sin escena ni mecánicas.' },
];

/** Edificios YA implementados (tienen reglas, costos y cola de obra). */
export type ImplementedType = BuildingType;
/** Edificios solo PLANIFICADOS: no existen como mecánica y no pueden construirse ni consumir recursos. */
export const PLANNED_TYPES = ['house', 'market', 'tavern', 'church', 'cathedral', 'town_hall', 'embassy'] as const;
export type PlannedType = (typeof PLANNED_TYPES)[number];

export interface PlotDef {
  /** ID estable (no cambia aunque cambie la geometría o el arte). Formato `distrito:ranura`. */
  id: string;
  districtId: DistrictId;
  /** Tipos que esta parcela podrá albergar. */
  allowedTypes: (ImplementedType | PlannedType)[];
}

const fortressPlot = (type: BuildingType): PlotDef => ({ id: `fortress:${type}`, districtId: 'fortress', allowedTypes: [type] });

export const PLOTS: PlotDef[] = [
  // Fortaleza: una parcela por edificio existente (el portón es la «parcela» de la muralla, que no ocupa suelo).
  ...BUILDING_TYPES.map(fortressPlot),
  // Villa (solo planificación): reservas del plano lógico de DISENO.md.
  { id: 'village:casas_oeste', districtId: 'village', allowedTypes: ['house'] },
  { id: 'village:casas_sur', districtId: 'village', allowedTypes: ['house'] },
  { id: 'village:mercado', districtId: 'village', allowedTypes: ['market'] },
  { id: 'village:taberna', districtId: 'village', allowedTypes: ['tavern'] },
  { id: 'village:iglesia', districtId: 'village', allowedTypes: ['church'] },
  { id: 'village:catedral_reserva', districtId: 'village', allowedTypes: ['cathedral'] },
  { id: 'village:concejo', districtId: 'village', allowedTypes: ['town_hall'] },
  { id: 'village:embajada', districtId: 'village', allowedTypes: ['embassy'] },
];

export interface PlannedBuildingDef {
  type: PlannedType;
  name: string;
  plotId: string;
  /** Fase del roadmap que definirá su mecánica. */
  phase: 3 | 4 | 5 | 8;
  /** Requisitos pendientes de definir (texto para el inspector). Ninguno concede nada hoy. */
  pending: string[];
}

export const PLANNED_BUILDINGS: PlannedBuildingDef[] = [
  { type: 'house', name: 'Casas (bloque oeste)', plotId: 'village:casas_oeste', phase: 3, pending: ['Familias y residencia (fase 3)', 'Capacidad y niveles'] },
  { type: 'house', name: 'Casas (bloque sur)', plotId: 'village:casas_sur', phase: 3, pending: ['Familias y residencia (fase 3)', 'Capacidad y niveles'] },
  { type: 'market', name: 'Plaza del mercado', plotId: 'village:mercado', phase: 4, pending: ['Demanda, abastecimiento y satisfacción (fase 4)'] },
  { type: 'tavern', name: 'Taberna', plotId: 'village:taberna', phase: 4, pending: ['Personal, suministros y satisfacción acotada (fase 4)'] },
  { type: 'church', name: 'Iglesia', plotId: 'village:iglesia', phase: 5, pending: ['Servicios y fe, independientes de la felicidad (fase 5)'] },
  { type: 'cathedral', name: 'Catedral (reserva)', plotId: 'village:catedral_reserva', phase: 5, pending: ['Iglesia previa, población y servicios suficientes (fase 5)', 'Parcela mayor reservada'] },
  { type: 'town_hall', name: 'Concejo', plotId: 'village:concejo', phase: 4, pending: ['Fiscalidad por tick de servidor (fase 4)'] },
  { type: 'embassy', name: 'Embajada', plotId: 'village:embajada', phase: 8, pending: ['Multijugador real: cuentas, ciudades y permisos (fase 8)'] },
];

export const isPlannedType = (t: string): t is PlannedType => (PLANNED_TYPES as readonly string[]).includes(t);

/** Parcela y distrito de un edificio implementado (relación 1:1 hoy). */
export const plotOfBuilding = (type: BuildingType) => ({ districtId: 'fortress' as DistrictId, plotId: `fortress:${type}` });
