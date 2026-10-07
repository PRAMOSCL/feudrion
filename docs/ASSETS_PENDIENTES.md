# Estado del arte del rediseño

Los 15 PNG del paquete `senorios-assets.zip` (carpeta `assets/`, según su `LEEME_SONNET.md`) están copiados a
`client/public/assets/` y activados en `client/src/artManifest.ts`. No se copió `originals/` (versiones de mayor resolución) ni se
regeneró ni retocó ninguna imagen.

| Archivo | Medidas | Dónde se usa | Estado |
| --- | --- | --- | --- |
| `world_map.png` | 1600×1000 | Fondo de **Mundo** (lienzo 1600×1000 escalado de forma uniforme) | Integrado |
| `army_banner.png` | 1600×240 | Cabecera de **Ejército** (recorte central con `cover`, sin estirar) | Integrado |
| `reports_backdrop.png` | 1920×1080 | Fondo ambiental de **Informes** (con velo oscuro para legibilidad) | Integrado |
| `portrait_lancero/arquero/espadachin/ballestero.png` | 480×360 (4:3) | Tarjetas de Ejército (4:3), «Tus tropas», cola, tablas de Informes (44×44, `object-position: 50% 30%`) | Integrado |
| `camp_bandidos/fortin/bastion.png` | 640×360 | Inspector de campamento (Mundo) y cabecera del detalle de Informes (se reutilizan; no hay arte de batalla) | Integrado |
| `resource_wood/stone/food/gold/population.png` | 64×64 transparente | Cabecera, costos, producción, botín, mediante `ResourceIcon` / `PopulationIcon` | Integrado |

Notas:

- El paquete indica que es arte generado a partir de los mockups: respeta el estilo pero **no es una extracción pixel-perfect**.
- La corrección de la nota original: los retratos son 4:3 (480×360), no 16:10.
- Solo se sustituyeron los glifos de **recursos**. Los iconos de navegación y acciones siguen siendo SVG propios (`LineIcon`).
- El mapa incluye decorados adicionales (p. ej. una casa en el bosque y otras aldeas); **no** se añadieron destinos para ellos.
- Si un valor de `artManifest.ts` vuelve a `null`, la interfaz muestra de nuevo el marcador explícito «Arte pendiente · archivo»
  (con el fallback anterior) sin pedir archivos inexistentes.
- El ZIP del paquete (≈ 50 MB) queda fuera del repositorio (`img/*.zip` está en `.gitignore`); basta conservar los PNG usados en
  `client/public/assets/` y esta documentación.

## Arte aún pendiente

Del alcance pedido, ninguno. Sin ilustración quedan: iconos de navegación/acciones (SVG), el estado vacío de **Informes** (emblema SVG
dentro de un aro) y cualquier arte de batalla específico por informe (por decisión, se reutiliza el del campamento).

## Ciudad viva (senorios-ciudad-viva.zip)

Copiados a `client/public/assets/viva/` (9 PNG; el `sawmill.png` del zip no se copió: ya existe el del proyecto): `city_ground_open.png`, `wall_stage_1/2/3.png`,
`worker_chop_sheet.png`, `worker_carry_sheet.png`, `archer_patrol_sheet.png`, `villager_walk_sheet.png`, `villager_woman_sheet.png`. Activados en `artManifest.ts`.
Se conserva `city_ground.png` como terreno de respaldo. Faltan: oficios específicos de granja (cosechar) y cantera (picar piedra), y animación de abrir/cerrar el portón.

## Expansión por distritos

Ver lista exacta en `docs/DISTRITOS.md` (terreno de Villa, sprites de edificios civiles, murallas corregidas, caminatas). Los conceptos de `docs/expansion/disenos/` no son activos de juego.

## Paquete correcciones v2

Integrados en `client/public/assets/viva/`: `terrain_village`, `house_stage_1` (solo registrada), `wall_stage_2_v2`, `wall_stage_3_v2`, `villager_walk_sheet_v2`, `villager_woman_sheet_v2`, `worker_carry_sheet_v2`. Pendiente: ver `docs/CORRECCIONES_V2.md`.

## Fortaleza v3 (integrado)

Copiados a `client/public/assets/viva/`: `terrain_fortress_v3.png`, `wall_stage_1/2/3_v3.png`, `river_mask_v3.png` (hashes verificados; el ZIP llegó truncado y se rescató). Datos en `client/src/live/` (`sceneV3.json`, `occlusionV3.json`, `riverV3.json`, `patrolCircuitsV3.ts`). Parche v3.1 integrado: `terrain_fortress_v3_1.png` y `river_mask_v3_1.png` (hashes verificados); datos `riverV31.json`, `entryRouteV31.json`. Pendiente de arte: animación del portón, oficios de granja/cantera, clips de validación.
