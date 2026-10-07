# CONTEXTO.md — memoria de trabajo del proyecto

> Documento para **recuperar el contexto** (mío, de Claude, y de quien retome el proyecto). Debe leerse al empezar una sesión y
> **actualizarse al terminar cada tarea** (ver «Registro de cambios» y «Estado actual»). Última actualización: 2026-10-06 (Fortaleza v3: arte, patrulla completa, oclusión y río integrados).

## 1. Qué es el proyecto

Juego web de estrategia y construcción de ciudades en la **Baja Edad Media** (sin pólvora ni tecnología moderna), inspirado
funcionalmente en juegos persistentes tipo Ikariam, con código, reglas e interfaz propios. Nombre del juego en la interfaz:
**Señoríos** (la carpeta/repo se llama **Feudrion**; el renombrado del juego en código/UI **no** se ha hecho, se ofreció y está pendiente de decisión).

Alcance V1: un jugador, una ciudad persistente, expediciones contra tres campamentos NPC. Sin PvP, alianzas, pagos ni autenticación.
Perfil local de demostración (*Señor de Robledal*, ciudad *Villa Robledal*) creado automáticamente.

Idea original (`Idea.txt`): multijugador medieval con apocalipsis zombie, y/o versión 2D para Steam. Aún no se ha elegido; la V1 web es independiente de esas ideas.

## 2. Stack y ejecución

- Frontend: React 18 + TypeScript + Vite 6 (`client/`). Backend: Node 20 + TypeScript + Express 4 (`server/`). SQLite con `better-sqlite3`.
- Validación de entradas con `zod`. Tests con Vitest. Fuente local `@fontsource/marcellus`. Sin servicios externos ni CDN.
- Entorno: Windows 10, Node 20.9, npm 10. Repo git en `E:\Github Repo\feudrion` (rama `main`, remoto `origin`).
- **Ejecutar:** doble clic en `iniciar.bat` (instala, enciende backend `127.0.0.1:3001` y frontend `127.0.0.1:5173`, abre el navegador);
  `detener.bat` lo apaga. Equivalente: `npm install` + `npm run dev`.
- Comandos: `npm test` (servidor + geometría del cliente), `npm run typecheck`, `npm run build`, `npm start` (backend compilado que también sirve
  `client/dist`), `npm run db:migrate`, `npm run db:reset` (**borra todo el progreso; solo acción explícita**).
- Base de datos: `server/data/senorios.db` (+ `-wal`, `-shm`), ignorada por git. Variable `DB_PATH` permite otra base (se usa para fixtures de pruebas).

## 3. Arquitectura (resumen)

```
server/migrations/001_init.sql     esquema (índice único parcial: una construcción activa por ciudad)
server/src/config/balance.ts       TODO el balance (costos, tiempos, producción, unidades, campamentos, combate)
server/src/game/                   reglas puras: economy.ts (integración por tramos), combat.ts, simulation.ts (advanceCity)
server/src/db/                     conexión, migraciones, seed, repo.ts (único SQL de juego), cli.ts (migrate/reset)
server/src/services/               commands.ts (validación + transacción), snapshot.ts (estado para la UI)
server/src/api/routes.ts           Express + zod; errores {error:{code,message}} en español
server/test/                       28 pruebas (balance, ausencia, persistencia, concurrencia, expediciones, progresión sin bloqueos)
client/src/                        App, useGame (polling/estimaciones), sceneConfig/sceneGeometry/worldConfig, artManifest, components/, styles/
docs/                              REDISENO.md, ASSETS_PENDIENTES.md, capturas/
scripts/verificacion/              scripts de captura y verificación (ver §8)
```

### Reglas del juego clave
- Recursos: madera, piedra, alimentos, oro (inicio 300/200/250/150). Edificios 1–10: castillo, aserradero, cantera, granja, almacén, cuartel.
  Inicio: castillo, granja y almacén nivel 1; aserradero, cantera y cuartel en parcela (nivel 0).
- Una construcción activa por ciudad; recursos se pagan al empezar; la mejora se aplica una vez al terminar. Requisitos: castillo (nivel−1; cuartel exige castillo 2),
  castillo exige almacén, y toda obra exige el almacén que pueda guardar su costo (anti-bloqueo).
- Población crece 6/min hasta el límite del castillo; trabajadores en aserradero/cantera/granja; habitantes libres dan 1 oro/min; castillo 5·nivel oro/min.
  Un edificio productivo nuevo recibe trabajadores libres automáticamente. Sin hambre/muerte/mantenimiento en V1.
- Ejército: lancero, arquero, espadachín, ballestero (desbloqueo por nivel de cuartel). Cola de reclutamiento secuencial (máx. 5).
- Expediciones: ida → combate al llegar (determinista, sin azar; fórmula en `balance.ts` y README) → regreso (mismo tiempo). Botín limitado por carga y por espacio del almacén. Informe por expedición.

### Modelo de tiempo y persistencia (decisión central)
- SQLite es la fuente de verdad; el servidor usa **su propio reloj**. No hay temporizadores de juego en servidor ni navegador.
- Cada consulta/acción llama a `advanceCity(db, cityId, now)`: procesa eventos vencidos en orden cronológico e integra la producción **por tramos**
  entre eventos (población lineal, oro exacto con media del tramo). Recursos y población se guardan como REAL.
- Acciones en transacción `BEGIN IMMEDIATE`; eventos consumidos con transiciones condicionadas (`WHERE status=...`); cabecera `Idempotency-Key` por acción.
  El cliente solo envía intención, nunca costos ni resultados.
- Apagar el servidor no pierde nada: al volver a encender, la simulación se pone al día.

## 4. Interfaz (rediseño completado)

Rediseño de Ciudad, Mundo, Ejército e Informes según 4 mockups (≈1672×941) que son el «contrato visual». Detalle y evidencia: `docs/REDISENO.md`.
- **Shell** (`Shell.tsx`, `styles/shell.css`): grid 158px | 1fr | 350px × 70 | 1fr | 40; cabecera con recursos reales y alerta «Lleno»; nav cerrable; footer con datos reales
  (sin clima ni hora simulada). ≤1100 px: nav en iconos e inspector como cajón (Ciudad/Mundo) o apilado (Ejército/Informes).
- **Lienzo escalado** (`ScaledStage`): coordenadas nativas (ciudad 1536×1024, mundo 1600×1000) + un único `scale()` uniforme; etiquetas contraescaladas.
  Silueta clicable por transparencia del PNG (`sceneGeometry.ts`, con tests). Posiciones de edificios en `sceneConfig.ts`; destinos del mapa en `worldConfig.ts`.
- **Sistema compartido** en `components/ui.tsx` y CSS en capas (`tokens, base, shell, ui, city, views`). Marcellus excluye dígitos (`styles/fonts.css`) porque dibuja «1» como «I».
- **Arte**: 15 PNG de `senorios-assets.zip` en `client/public/assets/`, activados en `artManifest.ts` (valor `null` ⇒ marcador explícito «Arte pendiente»).
  Iconos de navegación/acciones siguen siendo SVG propios; iconos de recurso son los PNG (`ResourceIcon`/`PopulationIcon`).
  Sprites originales en `img/` (con erratas `citiy_ground.png`, `swamill.png`); copias correctas en `client/public/assets/` (`city_ground.png`, `sawmill.png`).

## 4b. Ciudad viva (implementada 2026-10-06; detalle en docs/CIUDAD_VIVA.md)

- Servidor: muralla (`wall`, nv 1–9, sin parcela, 4 arqueros/nivel, +5 % defensa/nivel, aspecto 1–3/4–6/7–9), guarnición (`cities.garrison_archers`, `POST /api/garrison`),
  `defense.ts` (cálculo puro, aún sin uso en combate), `activity` por edificio productivo en el snapshot. Migración aditiva `002_wall_garrison.sql`.
- Cliente: `client/src/live/` (renderer de canvas con deltaTime, atlas de sprites, rutas, modelo derivado del estado real), `WallLayers` (overlay trasero/delantero con recorte),
  `GarrisonCard`, botón de animaciones, depuración con `localStorage['senorios.debugLive']='1'`. Coordenadas de rutas/estaciones en `live/liveConfig.ts`.
- Los trabajadores usan el sistema existente (3+2·nivel puestos); no se creó uno paralelo. Granja/cantera usan la hoja de transporte genérica (falta arte de oficio).
- Verificación: `scripts/verificacion/live-verify.mjs` (35 checks), `cycle.mjs`, `scenario.cjs` (escenarios sobre una base TEMPORAL); capturas en `docs/capturas/ciudad-viva/`.
- Técnica de trabajo usada: copia aislada del repo (con junctions a node_modules) + base temporal + backup de la base real con la API de backup de SQLite antes de probar la migración.

## 4c. Distritos (fase 2, 2026-10-06; docs/DISTRITOS.md y docs/expansion/ROADMAP.md)

- Servidor: `config/districts.ts` (distritos, parcelas `distrito:ranura`, planificados), migración `003_districts.sql` (aditiva), snapshot `districts`, 409 `PLANNED_ONLY`.
- Cliente: `client/src/districts/` (definiciones, `planGeometry`, validador), `DistrictSelector`, `VillagePlan` (esquema provisional SIN terreno), `PlannedInspector`.
- Villa y todo edificio civil son SOLO planificación. Fase 1 (arte/clips) sigue abierta; fases 3–9 no iniciadas.
- Verificación: `scripts/verificacion/districts-verify.mjs`, `filmstrip.mjs` (tiras de fotogramas, no clips). Backup previo de la partida en `E:Github Repoeudrion-backups`.
- Se pidió trabajar directamente en el repo (no en copia aislada) con el servidor cerrado; la base real NO se tocó en las pruebas.

## 4d. Correcciones v2 (2026-10-06; docs/CORRECCIONES_V2.md)

- Caminatas v2 con rectángulos/pivotes (`live/atlasV2.json`, `loadAtlasV2`), fase por distancia (`Pose.walked`, `CYCLE_HEIGHTS`); murallas 2/3 → `_v2`; Villa con `terrain_village.png` (lienzo 1536×1024, parcelas recolocadas, IDs iguales); `houseStage1` solo registrada.
- [histórico] Defecto de v2 (muralla cortando el aserradero, patrulla solo norte) sustituido por el arte y la patrulla v3 (ver §4e). La migración 003 YA está aplicada en la base real (comprobado en solo lectura).
- Verificadores nuevos: `walk-check.mjs`, `wall-overlap.mjs`; `gate-check.mjs` y `alpha.mjs` se usaron desde el scratchpad.

## 4e. Fortaleza v3: exportación y cámara (2026-10-06; arte y patrulla completa PENDIENTES)

- Flujo acordado con el usuario: (1) Sonnet ejecuta `01_PROMPT_EXPORTAR_Y_CAMARA` [HECHO], (2) el usuario entrega `docs/fortaleza-v3-export.zip` al diseñador para producir terreno/muros v3, (3) Sonnet integra con `02_PROMPT_INTEGRAR_ARTE_Y_PATRULLA` (paquete `senorios-fortaleza-v3-prompts.zip` en `img/`).
- Cámara: `cameraMath.ts` (pura, con tests) + modo `camera` de `ScaledStage` (rueda, arrastre con umbral 6 px, pellizco, teclado, botones Acercar/Alejar/«Ver toda la fortaleza»). Encuadre cercano sobre `CAMERA_FOCUS`; sin márgenes salvo «ver toda»; abrir el inspector no reajusta; cámara recordada por escena.
- `live/patrolCircuit.ts`: tipos y validador del circuito completo; `PATROL_CIRCUITS` VACÍO a propósito (no inventar coordenadas sobre el muro v2). La patrulla activa sigue limitada al tramo norte.
- `WATER_FX` en liveConfig. Exportador reproducible: `scripts/verificacion/export-fortaleza-v3.mjs`; verificador de cámara: `camera-verify.mjs`. El export (56 MB) está en .gitignore.

## 5. Cómo trabajamos (acuerdos con el usuario — respétalos)

- Idioma: **español**. El usuario prefiere resultados implementados y verificados, no solo planes; decisiones rutinarias las resuelvo yo.
- **No hacer commits ni `git init`** salvo instrucción explícita (el usuario commitea él: `7a23233 feat: add v1 Feudrion`, `fbb867c feat: Feudrion V2 - Punta a Punta.`).
- **Nunca reiniciar la base real** ni `db:reset` sin petición explícita. Para capturas con datos o pruebas destructivas usar una base temporal con `DB_PATH` y puertos distintos.
- No regenerar ni alterar imágenes sin autorización. Los mockups completos NO se usan como fondo; la interfaz es HTML/CSS.
- Honestidad: no declarar «pixel-perfect» sin demostrarlo; informar qué se verificó realmente y qué no; si falta arte, decirlo.
- Verificación esperada tras cambios: `npm run typecheck`, `npm run build`, `npm test`, y comprobación en navegador con consola/red sin errores (ni 404).
- Los datos de mockups son ilustrativos: usar siempre datos reales del juego. No inventar registros demo en la base real.
- No añadir mecánicas que la V1 no tiene (cancelar obra, acelerar, clima, PvP…); la referencia las muestra pero se omiten (documentado).
- Cuando algo no se pueda reproducir, decirlo y añadir diagnóstico en vez de adivinar (p. ej. `ErrorBoundary` por vistas).

## 4e. Fortaleza v3 (2026-10-06; paquete `senorios-fortaleza-v3-arte.zip`, truncado: se rescató con un lector de cabeceras locales y se verificaron los hashes de todos los PNG)

- Arte: `terrain_fortress_v3`, `wall_stage_1/2/3_v3`, `river_mask_v3` en `client/public/assets/viva/` (los anteriores se conservan para revertir). `artManifest.ts` apunta a v3 (`cityGround`, `walls`, `riverMask`).
- Datos del paquete en `client/src/live/`: `sceneV3.json` (portón y ruta de ciudadanos), `occlusionV3.json`, `riverV3.json`, `patrolCircuitsV3.ts` (19 tramos por etapa, 9 pasos ocultos por torre).
- Patrulla: `GuardTracker` + `buildLocalMask` en `live/guards.ts`; `sampleCircuit` en `patrolCircuit.ts`. Velocidad uniforme `GUARD_SPEED=15` px/s por distancia; el progreso vive en el tracker (sobrevive a refrescos; al cambiar de etapa se traslada la fracción). Guardias solo con muralla vigente y arqueros reales (`model.guards`). La ruta norte antigua (`PATROL_ROUTES`) se eliminó.
- Capas (`LiveLayer`, 4 canvas): agua z1 → muralla trasera z2 → guardias «back» z3 → edificios/actores z900 → muralla delantera z950 → guardias «front» z960 → etiquetas. Máscara local = polígono del tramo ∩ alfa del PNG de la muralla. Un solo RAF.
- Río: polígonos+flujo de `riverV3.json` recortados con `river_mask_v3` (destination-in); ≤24 fps; respeta el botón de animaciones, reduced-motion y pestaña oculta.
- Ciudadanos: ruta `sceneV3.citizens.feet` (paradas [4,22,27]) y cruce `gate.routeBridgeToInterior`.
- Banderas de depuración: `senorios.debugLive=1` expone `window.__senoriosLive` (snapshot/seek/villagerPoses); `senorios.debugPaths=1` dibuja las rutas.
- Verificador: `scripts/verificacion/fortaleza-v3-verify.mjs` (usa `seek(t)` como aceleración SOLO de prueba). Evidencia en `docs/capturas/fortaleza-v3/`.

## 4f. Parche Fortaleza v3.1: acceso y agua (2026-10-06; `senorios-fortaleza-v3-1-acceso-agua.zip`)

- Arte: `terrain_fortress_v3_1.png` y `river_mask_v3_1.png` en `client/public/assets/viva/` (hashes OK; las 3 murallas v3 sin cambios, hashes OK; arte v3 anterior conservado). `artManifest.ts` apunta a v3.1.
- Agua: `live/waterFlow.ts` (adaptación de `reference/waterFlow.mjs`) dentro del bucle único de `liveRenderer`; textura del terreno recortada a la máscara y desplazada con dos fases cruzadas + espuma advectada (cascadas: caída oblicua). Datos en `riverV31.json` (sustituye a `riverV3.json`, eliminado). Reloj del agua global (`WATER_EPOCH`): conserva la fase entre montajes (cambio de distrito). Con animaciones apagadas/reduced-motion/pestaña oculta no hay bucle ni capa de agua dibujada (queda el terreno estático).
- Ruta de entrada: prefijo exterior de `entryRouteV31.json` + cola interior real; `VILLAGER_ROAD` se compone en `liveConfig.ts`. AJUSTE DEL REPO: los puntos del puente de la propuesta recorrían el parapeto sur; se llevaron al centro del tablero y al centro del paso del arco (medido sobre capturas del terreno v3.1; original guardado en `feetOutsideToInsideOriginal`). Paradas: [5 (fin del puente), 25, 30] (las interiores son los mismos puntos de antes).
- Verificadores: `fortaleza-v31-verify.mjs` (agua a velocidad normal sin seek, espuma, pausa, ruta), `clip31.mjs` + `make_gif.py` (clip). Evidencia: `docs/capturas/fortaleza-v3-1/` (clip GIF de 22 s con encuadre inicial → acercamiento a puente/cascadas → pausa → reanudación; 4 instantes de cascada; ruta por etapa).

## 6. Estado actual (2026-10-06)

- V1 jugable completa y rediseño visual completo integrado (incluye arte final). `npm run typecheck` sin errores, `npm test` 28+4 pasan, build correcto.
- Fase 2 (distritos) en el repo; migraciones 002 y 003 ya aplicadas en la base real. Fortaleza v3 integrada (§4e): typecheck, 52 tests servidor + 60 cliente y build correctos; verificación de navegador con base temporal (puertos 3101/5273, ya detenidos) OK. Sin commit.
- [histórico] Ciudad viva integrada en el repo. La base real aún NO tenía aplicada la migración 002: se aplicará sola al arrancar el servidor (aditiva; hay copia de seguridad previa en el scratchpad de la sesión).
- Último commit del usuario: `fbb867c`. Cambios posteriores sin commit: `CONTEXTO.md`, `CLAUDE.md`, `scripts/verificacion/`, ajustes de docs/.gitignore (`img/*.zip`).
- El usuario está **jugando** (castillo nivel 4) sobre `server/data/senorios.db`: no tocar esa base.
- Bug reportado por el usuario (la app «se cae» al entrar a otras vistas): **no se pudo reproducir**; se añadió `ErrorBoundary` que muestra el error real.
  Si vuelve a ocurrir, pedir el mensaje que muestra la pantalla de error o el texto de la ventana «Senorios (servidor)».

## 7. Pendiente / limitaciones conocidas

- v3.1: el clip es un GIF a 8 fps grabado con la captura de CDP (no hay ffmpeg); movimiento verificado con medidas (≈2,5 niveles de gris/0,2 s en el agua corriendo, 0 en pausa), pero la aprobación de que la corriente se ve bien es de Pablo. En el encuadre inicial a 1672×941 las cascadas quedan fuera de pantalla (solo se ve el río de los bordes inferiores); hay que acercar/desplazar. El desplazamiento de textura es modesto (ciclo de 16–22 px).

- Cuartel reubicado (2026-10-06, a petición de Pablo): slot de (1230,435) a (1215,460) en `sceneConfig.ts`. Su base queda sobre el claro de tierra del terreno v3 (x≈1100–1340, y≈370–500), como almacén y cantera, fuera de la ruta de habitantes; el techo se dibuja delante del muro este (profundidad normal). Intentos descartados: (1290,600) y (1190,545) pisaban/rozaban la ruta o la muralla.

- Fortaleza v3: no se grabaron clips (solo capturas y comprobaciones numéricas; los recorridos completos se probaron con `seek`). El paso de guardias por torres es instantáneo-oculto por diseño del paquete. Pendiente la revisión visual de Pablo antes de cerrar la fase 1; `export-fortaleza-v3.mjs` quedó obsoleto (usa `PATROL_ROUTES`). Fase 3 sigue pendiente.

- Decidir si renombrar «Señoríos» → «Feudrion» en UI, README, `package.json` y archivo de BD (cambiar el nombre de la BD haría que la partida no se encuentre).
- No es pixel-perfect respecto a los mockups (arte del paquete generado, no idéntico; la escena no se recorta; sin iconos ilustrados de navegación).
- Botín de NPC repetible sin enfriamiento; sin ilustración de nivel por edificio; sin pruebas automáticas de componentes del cliente (solo geometría).
- Tablet: el cajón del inspector tapa parte del mapa; hay que cerrarlo para elegir otro destino cubierto.
- Idea futura (`Idea.txt`): multijugador, mundo zombie, versión 2D/Steam — no iniciada.

## 8. Herramientas de verificación (reproducibles)

El panel del navegador integrado de la app falla a ratos al capturar; se usa **Edge headless con `puppeteer-core`** (no es dependencia del repo):
instalar en una carpeta aparte `npm i puppeteer-core` y ejecutar los scripts de `scripts/verificacion/` (rutas de Edge y salida están al inicio de cada script; ajustarlas).
- `fixture.cjs <db>`: puebla una **base temporal** (cuartel, tropas, cola, informes, una expedición) con SQL. Crear antes la base con
  `DB_PATH=<db> node server/dist/db/cli.js reset` (requiere `npm run build -w server`).
- Instancia de fixture: backend `DB_PATH=<db> PORT=3002 node server/dist/index.js` y frontend `cd client && API_PORT=3002 npx vite --port 5174 --strictPort`.
- `shot.mjs <url> escenario@WxH …` (capturas por vista/viewport), `e2e.mjs <url>` (recorrido construir→reclutar→expedición→informe→recarga; ~2 min),
  `hotspots.mjs <url>` (clic real en los 3 destinos del mapa en 4 viewports, solapes de etiquetas y errores/404), `compare.mjs` (referencia | implementación).
- Salidas en `docs/capturas/` (`poblado/` = fixture, no la base real; `flujo/`; `comparacion/`).

## 9. Trampas conocidas (evitarlas)

- En Bash, los `node -e "…"` con backticks o `$` se corrompen: para editar código con plantillas usar la herramienta Edit/Write.
- Windows no deja renombrar una carpeta usada como directorio actual de un proceso (p. ej. una sesión de Claude).
- `Start-Process cmd` desde PowerShell: usar ruta completa del `.bat` (el directorio de trabajo no se respeta).
- Marcellus dibuja los dígitos como numerales romanos; por eso `fonts.css` los excluye.
- La base usa WAL: para respaldar, apagar el servidor y copiar `.db`, `.db-wal` y `.db-shm` juntos.
- Vite 7 exige Node ≥ 20.19; con Node 20.9 se usa Vite 6.
- `git`/`.gitignore`: `server/data/`, `*.db*`, `dist/`, `node_modules/`, `img/*.zip` están ignorados.

## 10. Registro de cambios (más reciente primero)

- 2026-10-06 — Parche Fortaleza v3.1: terreno/máscara v3.1, agua con corriente y espuma (waterFlow.ts), ruta de entrada por el centro del puente y el arco. Sin cambios de servidor/reglas/migraciones. Fase 1 sigue ABIERTA (revisión visual de Pablo).

- 2026-10-06 — Cuartel reubicado a (1215,460) sobre el claro de tierra (ver §7). Fortaleza v3 (paso 2): arte v3, patrulla completa por las 3 etapas, oclusión por máscaras locales, río con máscara, ciudadanos por el portón v3; tests nuevos y `fortaleza-v3-verify.mjs`. Sin cambios de servidor ni migraciones. Fase 1 NO se cierra (ver §7: falta revisión visual de Pablo y clips).

- 2026-10-06 — Fortaleza v3 (paso 1): cámara con zoom/desplazamiento, registro de patrulla completa, exportación de escena + diagnósticos; arte v3 pendiente.
- 2026-10-06 — Correcciones v2: caminatas 8 poses, murallas v2, terreno de la Villa, ruta del portón recalibrada; defecto del aserradero documentado.
- 2026-10-06 — Fase 2 distritos: registro server/cliente, migración 003, selector Fortaleza/Villa, plano de Villa provisional, planificados bloqueados; ruta del portón y patrulla acotadas; fase 1 abierta.
- 2026-10-06 — Ciudad viva: muralla, guarnición, actividad visual ligada a datos reales, agua; 42+21 tests, 35 checks de navegador, ciclo completo; docs/CIUDAD_VIVA.md.
- 2026-10-06 — Creado `CONTEXTO.md` y `CLAUDE.md`; scripts de verificación copiados a `scripts/verificacion/`. Aclarado: el usuario puede apagar el servidor sin perder progreso.
- 2026-10-05/06 — Integrado el paquete de arte (15 PNG): mapa, banner, fondo de Informes, retratos, campamentos, iconos de recurso; recalibrados destinos del mapa
  (`worldConfig.ts`); hotspots verificados en 4 viewports; docs actualizadas. Aclaración del usuario: «Vigía del norte» era un nombre del generador, el destino correcto es «Fortín de saqueadores»;
  el ZIP queda fuera del repo.
- 2026-10-05 — Rediseño visual de Ciudad/Mundo/Ejército/Informes (shell, lienzo escalado, inspectores, sistema compartido, tablet); `ErrorBoundary`; `iniciar.bat`/`detener.bat`.
- 2026-10-05 — V1 completa: backend con simulación temporal, SQLite + migraciones, 28 pruebas, frontend con ciudad ilustrada, mapa, ejército e informes; verificación del ciclo completo en navegador.
- 2026-10-05 — Carpeta renombrada a `feudrion` por el usuario; proyecto inicial a partir de `Idea.txt` e imágenes en `img/`.
