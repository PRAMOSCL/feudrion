# Fase 2 — Distritos y parcelas

Infraestructura extensible; **no** añade mecánicas nuevas. Una sola ciudad, un solo estado y los mismos recursos para todos los distritos.

## Arquitectura
- **Servidor** `server/src/config/districts.ts`: distritos (`fortress` activo, `village` planificación, `crafts`/`countryside` futuros), parcelas con ID estable `distrito:ranura`
  y tipos permitidos, y `PLANNED_BUILDINGS` (casa, mercado, taberna, iglesia, catedral, concejo, embajada) con su fase y requisitos pendientes.
- **Migración aditiva** `003_districts.sql`: `buildings.district_id` y `plot_id` (los edificios existentes pasan a `fortress:<tipo>`) + índice único por parcela.
  Los IDs lógicos (`type`), niveles, trabajadores, recursos, tropas, guarnición e informes no se tocan. El snapshot expone `districts` y `districtId/plotId` por edificio.
- Los edificios planificados **no se pueden construir**: `POST /api/buildings/<planificado>/upgrade` → 409 `PLANNED_ONLY`; no existen filas, costos ni efectos.
- **Cliente** `client/src/districts/`: `DistrictDefinition`/`PlotGeometry` (anchor, huella, tipos, interacción, acceso, profundidad), rutas, entradas, exclusiones y capas;
  `planGeometry.ts` (hit-test, validación de corredores/accesos/conectividad/franja de muralla, `planShapes`) y `districtConfig.ts` (Fortaleza y Villa).
  Añadir una parcela = datos en `districtConfig.ts` + su ID en el servidor; selector, plano y validador no cambian (probado).
- Selector accesible (`DistrictSelector`, rol tab, flechas/Inicio/Fin) en Ciudad: Fortaleza y Villa; Oficios y Campo son notas «futuro» no interactivas.
  Cambiar de escena desmonta la anterior (un solo bucle de agua/personajes); se respetan animaciones desactivables, reduced-motion y pestaña oculta.
  El distrito elegido se recuerda en `localStorage`.
- **Villa = esquema de planificación provisional** (sin terreno: no existe `terrain_village.png`). Coordenadas normalizadas de DISENO.md convertidas a un lienzo 1600×1000, **sin calibrar**.
  Reserva corredor de entrada continuo, calles, salidas a Oficios/Campo y franja de muralla futura; ninguna parcela las invade (validado por tests). Etiqueta: «Planificado · mecánica pendiente».
- Las imágenes de `docs/expansion/disenos/` son conceptos poblados: **no** se usan en la escena, ni recortadas ni como atlas.

## Qué es solo planificación
Casas/familias, mercado, concejo/impuestos, taberna, iglesia/fe, catedral, forja, lonja, embajada, Oficios, Campo, muralla exterior de la Villa. Nada de esto concede oro, felicidad, población ni defensa.

## Fase 1 (sigue ABIERTA)
- Hecho (acotado): ruta puente → centro del hueco del portón → interior calibrada contra el **alfa real** de los 3 overlays (0 píxeles opacos cruzados en la zona visible; en el último punto la pared cubre al actor);
  patrulla limitada al tramo norte visible (x ≈ 860–1080) sin cruzar torres. Capturas: tiras de fotogramas `docs/capturas/distritos/fase1-tira-*` (**no son clips**).
- NO resuelto: el muro de piedra/reforzada sigue invadiendo la zona del embarcadero/cabaña (ver `fase1-defecto-muralla-embarcadero-piedra.png`); caminatas con poses casi iguales (necesitan nuevo arte);
  guardias solo en un tramo (sin corredor calibrado en el resto ni paso por torres). **No se grabaron clips** (no hay captura de vídeo en este entorno).

## Arte faltante (exacto)
`terrain_village.png` (terreno limpio de la Villa); sprites transparentes de casa, mercado/puestos, taberna, iglesia, catedral, concejo, embajada, forja, lonja (+ obra y niveles); terrenos de Oficios y Campo;
murallas de piedra/reforzada corregidas; caminatas completas de ciudadano/ciudadana/transportista; máscaras y rutas calibradas.

## Verificación
Ver `docs/expansion/ROADMAP.md` (estado) y `scripts/verificacion/districts-verify.mjs`.
