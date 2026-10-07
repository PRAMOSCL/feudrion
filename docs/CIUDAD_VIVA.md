# Ciudad viva: muralla, guarnición y actividad visual

Implementa `senorios-ciudad-viva.zip` (PROMPT_SONNET.md + preview.html como referencia de comportamiento). El usuario autorizó las nuevas
reglas de muralla, guarnición y trabajadores ligados a la animación. Todo lo demás (economía, combate, API existente, progreso) se conserva.

## Reglas nuevas (servidor) — propuesta CONFIGURABLE en `server/src/config/balance.ts`

| Concepto | Valor elegido | Dónde |
| --- | --- | --- |
| Muralla | edificio `wall`, niveles 1–9, **no ocupa parcela**; comparte la regla de «una obra a la vez» | `BUILDINGS.wall`, `maxLevelOf` |
| Costo nivel 1 | 120 madera · 220 piedra · 60 oro; crecimiento ×1,4 por nivel; 60 s base ×1,38 por nivel | `BUILDINGS.wall` |
| Requisito | Castillo ⌈n/2⌉+1 (mínimo 2) y el almacén que permita guardar el costo (anti-bloqueo existente) | `baseRequirements` |
| Aspecto | 1–3 empalizada · 4–6 piedra · 7–9 reforzada (comparten sprite; las estadísticas son por nivel) | `WALL.stageBreakpoints` |
| Guarnición | 4 × nivel arqueros (0 si no está construida) | `WALL.garrisonPerLevel` |
| Defensa | +5 % por nivel como **multiplicador único** sobre la defensa base del defensor | `WALL.defenseBonusPerLevel` |
| Partidas nuevas | muralla nivel 0, sin guarnición ni bonus | `START.buildings.wall` |

- **Migración aditiva** `002_wall_garrison.sql`: añade `cities.garrison_archers` (por defecto 0) y una fila `wall` nivel 0 por ciudad existente.
  Probada sobre una copia de una partida real (castillo 4): edificios, recursos, población, tropas e informes idénticos.
- **Guarnición** (`POST /api/garrison {archers}`): enteros ≥ 0, capacidad del nivel, arqueros libres reales. Los asignados se **restan** de
  `troops` (no se reclutan de nuevo ni salen en expedición) y se devuelven al liberar. Invariante probado: libres + guarnición + en expedición = total.
- **Mejora**: mientras se mejora, la defensa vigente (nivel actual) no cambia hasta terminar.
- **Defensa del defensor** (`server/src/game/defense.ts`): cálculo puro y verificable (`defenderStrength`). **No se usa todavía en ningún
  combate**: la V1 no tiene ataques a la ciudad. No se añadió PvP, invasiones ni temporizadores de enemigos. La muralla no modifica las
  expediciones ofensivas del jugador. No se declara la defensa «jugable».
- **Trabajadores**: el sistema existente ya asigna trabajadores y calcula la producción como `asignados × rendimiento` (equivale a
  «potencial × asignados/capacidad»). Se conserva; **no se creó un sistema paralelo** ni se cambió la capacidad (3 + 2 × nivel; aserradero nv5 = 13, no 20).
  El snapshot añade `activity` por edificio productivo (`producing`, `reason`: `ok | no_workers | storage_full | not_built`), que usa la misma condición
  que la economía.

## Capas de la escena (cliente, coordenadas 1536×1024)

terreno (`city_ground_open.png`, el anterior queda como respaldo) → agua (canvas, z1) → muralla trasera (z2) → parcelas/portón (z3) →
edificios (z = y de su base) → personajes (canvas, z900) → muralla delantera + portón (z950) → etiquetas HTML (z1000+).
Los canvases no capturan clics; la selección sigue por silueta (la muralla por su portón y por la silueta de su overlay).

- **Registro de la muralla**: sobre el terreno nuevo, los tres overlays encajan con identidad (`WALL_TRANSFORM`); inspeccionado con rejilla
  en cada aspecto. El portón queda alineado con el puente. El recorte trasero/delantero se hace en `y = 470` (`WALL_SPLIT_Y`);
  `WALL_HOLES` admite polígonos de recorte si hiciera falta. **No** se reutilizó `foregroundPatch` de la demo: la muralla pasa por la orilla sin tapar el
  embarcadero ni el barco.
- **Construcción visible**: la primera obra revela el aspecto 1 por 6 tramos verticales según el progreso real; no hay defensa hasta terminar.
- **Personajes** (`client/src/live/`): flipbooks de 6 poses (alfa real medido, pies como pivote, reducción progresiva en caché, canvas a 2×).
  Rutas de ida y vuelta con pausa de giro y espejo (no hay animación de giro ni 8 direcciones). Oclusión por silueta con los edificios cuya base está delante.
  - Trabajadores: 1 figura por cada 7 asignados (máx. 3): 20 asignados → 3 figuras. Solo si `activity.producing`; con 0 asignados, almacén lleno o edificio sin construir no hay figuras.
  - Aserradero: hacha (secuencia [1,4,2,3,5,0]) + transporte. **Granja y cantera usan `worker_carry_sheet` como tarea genérica: FALTA arte de cosechar y de picar piedra.**
  - Guardias: solo con muralla y guarnición > 0; 2/4/6 visibles según aspecto, independientes de los efectivos reales. Patrullan por rutas separadas por aspecto.
  - Habitantes: 2–10 figuras decorativas por la calzada real (calibrada sobre el empedrado), con paradas en el portón, el almacén y la cantera. Son ambiente: **no generan recursos ni alteran la población**.
- **Agua**: brillos móviles y espuma en trayectorias dentro del cauce y la cascada del puente (no deforma el agua). Puente, piedras, barco y tierra estáticos.
- **Rendimiento**: un bucle con `deltaTime` acotado; personajes ≤ 30 fps y agua ≤ 24 fps; sin React ni consultas al servidor por fotograma; se detiene con la pestaña oculta;
  respeta `prefers-reduced-motion` (escena estática) y hay un botón para desactivar las animaciones (preferencia guardada).
- **Depuración**: `localStorage['senorios.debugLive']='1'` dibuja rutas y estaciones y expone `window.__senoriosLive.snapshot()`.
- La puerta está abierta de forma estática: **no hay animación de abrir/cerrar** (no existe el asset).

## Verificación (instancia de trabajo con base temporal; la base real no se tocó)

- `npm run typecheck`, `npm run build`, `npm test`: 42 pruebas de servidor (14 nuevas de muralla, guarnición, actividad, migración) y 21 del cliente (17 nuevas).
- `scripts/verificacion/live-verify.mjs`: 35 comprobaciones en navegador, todas PASS (nivel 0 sin muros, construcción, subida de aspecto, guarnición 0 sin arqueros,
  límites, trabajadores 0/almacén lleno sin trabajo, 20 → 3 representantes, clic en portón/muralla/edificios en 4 viewports, bucle/reduced-motion/botón/pestaña oculta, ≤ 30 fps,
  0 peticiones a /api por fotograma, sin errores de consola ni 404).
- `scripts/verificacion/cycle.mjs`: producir → construir muralla → reclutar → guarnición → expedición → informe (entregado una vez; invariante de arqueros intacto).
- Capturas en `docs/capturas/ciudad-viva/` (1672×941, 1920×1080, 1366×768, 1024×768, cajón de tablet, zooms de trabajadores y de agua activa/inactiva).

## Limitaciones reales

- Las murallas y personajes son imágenes generadas: el registro es bueno a simple vista pero **no está garantizado píxel a píxel**; las poses son flipbooks de pocas poses (no animación profesional).
- No hay clips de vídeo: se verificó con capturas y con comprobaciones programáticas del bucle.
- Rutas de patrulla y estaciones son propuestas calibradas visualmente en 1672×941; los guardias son muy pequeños (~25 px) a escalas bajas.
- Sin arte de oficios de granja y cantera, sin animación de portón, sin ataques a la ciudad (la defensa solo se expone como cálculo y estadísticas).
- El agua es un efecto de brillo/espuma sobre un PNG estático, no una simulación.
