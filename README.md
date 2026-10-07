# Señoríos (nombre provisional) — V1

Juego de estrategia y construcción de ciudades en la Baja Edad Media, con una ciudad ilustrada,
producción de recursos, construcciones por tiempo, reclutamiento y expediciones contra campamentos NPC.
Un jugador, una ciudad persistente, sin autenticación ni PvP.

- **Frontend:** React + TypeScript + Vite (`client/`)
- **Backend:** Node.js + TypeScript + Express (`server/`)
- **Persistencia:** SQLite (`better-sqlite3`) con migraciones SQL. La base de datos es la fuente de verdad.

## Requisitos

- Node.js 20 o superior y npm 10 o superior (probado con Node 20.9 / npm 10.1 en Windows).
- No hay servicios externos. `better-sqlite3` descarga un binario precompilado al instalar.

## Puesta en marcha

```bash
npm install
npm run dev
```

`npm run dev` levanta a la vez el backend (`http://127.0.0.1:3001`) y el frontend (`http://127.0.0.1:5173`).
Abre **http://127.0.0.1:5173**. Al primer arranque se aplican las migraciones y se crea el perfil local de demostración
(*Señor de Robledal*, ciudad *Villa Robledal*). Los arranques siguientes **nunca** reinician el progreso.

El servidor escucha por defecto solo en `127.0.0.1`. Variables opcionales: `HOST`, `PORT` (3001), `DB_PATH`
(por defecto `server/data/senorios.db`).

### Otros comandos

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Compila backend (`server/dist`) y frontend (`client/dist`) |
| `npm start` | Arranca el backend compilado; si existe `client/dist`, también lo sirve en `http://127.0.0.1:3001` |
| `npm test` | Pruebas del backend (Vitest) y de la geometría de la escena del cliente |
| `npm run typecheck` | Comprueba tipos de backend y frontend |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:reset` | **Acción explícita de desarrollo:** borra todo el progreso y recrea el perfil de demostración |

## Estructura

```
img/                      Recursos gráficos originales entregados (sin tocar)
client/public/assets/     Copia de los recursos con los nombres que usa el juego
client/src/
  App.tsx, useGame.ts     Estado de la interfaz y estimaciones/cuentas regresivas
  sceneConfig.ts          Posiciones, tamaños y anclajes de edificios en la ciudad (coordenadas del terreno 1536×1024)
  sceneGeometry.ts        Escala uniforme, conversión pantalla→lienzo y hit-test por silueta (con pruebas)
  artManifest.ts          Arte opcional pendiente (null = marcador explícito)
  components/             Shell, ScaledStage, ui (sistema compartido), CityScene, BuildingInspector, WorldView, ArmyView, ReportsView…
  styles/                 Tokens y capas CSS (tokens, base, shell, ui, city, views)
server/
  migrations/             Esquema SQL versionado (001_init.sql)
  src/config/balance.ts   TODO el balance: costos, tiempos, producción, capacidades, unidades, campamentos
  src/game/               Reglas puras: economía (integración por intervalos), combate, simulación de eventos
  src/db/                 Conexión, migraciones, datos iniciales, repositorio (único módulo con SQL de juego)
  src/services/           Comandos del jugador (validación + transacción) y fotografía del estado
  src/api/routes.ts       API HTTP y validación de entradas (zod)
  test/                   Pruebas
```

## Reglas implementadas

- **Recursos:** madera, piedra, alimentos y oro. Inicio: 300 / 200 / 250 / 150. Comienzas con Castillo, Granja y Almacén en nivel 1;
  Aserradero, Cantera y Cuartel se construyen desde nivel 0 en sus parcelas.
- **Niveles 1–10** por edificio. Los costos y los tiempos crecen con el nivel (primeras obras de 30 a ~120 s).
  Una construcción activa por ciudad; los recursos se descuentan al empezar y la mejora se aplica una sola vez al terminar.
- **Requisitos:** los edificios exigen un nivel de castillo (nivel − 1; el cuartel exige castillo 2); el castillo exige almacén;
  y toda obra exige el almacén necesario para poder *guardar* su costo, de modo que nunca se bloquea el progreso.
- **Población:** crece 6 habitantes/min hasta el límite del castillo (30 + 30 por nivel adicional).
  Se asignan trabajadores a aserradero, cantera y granja (puestos = 3 + 2 × nivel). Los habitantes libres generan 1 de oro/min
  y el castillo aporta 5 de oro/min por nivel. Sin hambre, muerte ni mantenimiento militar en V1.
- **Almacén:** capacidad 500 × 1,5^(nivel−1) por recurso. La producción topa en la capacidad; el botín que no cabe se pierde.
- **Ejército:** lancero (cuartel 1), arquero (2), espadachín (3), ballestero (4). Reclutamiento en cola (máx. 5 pedidos),
  con el tiempo reducido un 5 % por nivel de cuartel.
- **Expediciones:** tres campamentos NPC de dificultad creciente. Ida, combate al llegar, regreso (misma duración).
  Las tropas enviadas no están disponibles hasta volver.
- **Combate determinista** (sin azar): ataque propio = Σ n·ataque; razón r = ataque propio / defensa del campamento.
  `r ≥ 1` → victoria con bajas = clamp(0,9·A_npc / (A_npc + D_propia) / r^1,5; 3 %; 90 %).
  `r < 1` → derrota con bajas = clamp(0,5 + 0,5·(1 − r); 50 %; 95 %). Bajas por tipo = redondeo(n · fracción).
  El botín (solo en victoria) es el del campamento limitado por la capacidad de carga de los supervivientes
  y, al regresar, por el espacio libre del almacén.

Todos los números están en [`server/src/config/balance.ts`](server/src/config/balance.ts).

## Tiempo y persistencia

- El servidor es la única autoridad sobre el tiempo (`Date.now()` del servidor). El navegador solo muestra estimaciones y cuentas
  regresivas; vuelve a consultar cada 10 s y justo al vencer un contador.
- No hay temporizadores de juego en el servidor ni en el navegador. Cada consulta o acción llama a `advanceCity(...)`, que procesa
  los eventos vencidos **en orden cronológico** (fin de obra, fin de reclutamiento, llegada y regreso de expediciones) e integra la
  producción **por tramos** entre eventos, con las tasas vigentes en cada tramo. Una mejora que termina durante una ausencia cambia la
  producción exactamente desde su instante de finalización.
- Recursos y población se guardan como números reales (no se pierden fracciones); la interfaz muestra la parte entera.
- Cada acción se ejecuta en una transacción `BEGIN IMMEDIATE`: actualización de la simulación, validación, cobro e inicio de la acción
  son atómicos. Los eventos se consumen con transiciones condicionadas (`WHERE status = …`) y un índice único parcial garantiza
  una sola construcción activa por ciudad, así que ni las solicitudes simultáneas ni las repetidas duplican gastos o recompensas.
  Además, el cliente envía un `Idempotency-Key` por acción: una repetición devuelve la respuesta original sin ejecutarse otra vez.
- El cliente nunca envía costos, resultados ni cantidades de recursos: solo la intención (edificio, unidad y cantidad, campamento y tropas).

## API (resumen)

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/state` | Pone la ciudad al día y devuelve el estado completo (recursos, edificios, unidades, expediciones, informes, mapa) |
| `POST /api/buildings/:tipo/upgrade` | Construye o mejora un edificio |
| `POST /api/workers` | `{ sawmill?, quarry?, farm? }` fija trabajadores asignados |
| `POST /api/recruit` | `{ unit, quantity }` encola reclutamiento |
| `POST /api/expeditions` | `{ camp, units: { lancero: n, … } }` envía una expedición |

Los errores devuelven `{ "error": { "code", "message" } }` con el mensaje en español.

## Arte

Se usan exclusivamente los siete recursos de `img/`. Los archivos originales `citiy_ground.png` y `swamill.png` tienen erratas en el
nombre; se copian a `client/public/assets/` como `city_ground.png` y `sawmill.png`. Cada edificio usa una única imagen para todos
sus niveles (el nivel se muestra con la interfaz). Las unidades usan símbolos SVG provisionales hasta que existan sus ilustraciones.

## Rediseño visual

Ver [`docs/REDISENO.md`](docs/REDISENO.md) (arquitectura de interfaz, verificación y diferencias pendientes) y
[`docs/ASSETS_PENDIENTES.md`](docs/ASSETS_PENDIENTES.md) (arte que falta). Capturas en `docs/capturas/`.

## Ciudad viva

Muralla construible (niveles 1–9, sin parcela), guarnición de arqueros, trabajadores/habitantes animados y agua: ver [`docs/CIUDAD_VIVA.md`](docs/CIUDAD_VIVA.md).
La migración `002_wall_garrison.sql` es aditiva y se aplica sola al arrancar el servidor (no reinicia el progreso).

## Composición de la ciudad

`client/src/sceneConfig.ts` define, en píxeles del escenario (1536 × 1024), el punto de anclaje de la base de cada edificio, su ancho y la
posición de su etiqueta. El área clicable no es el rectángulo del PNG: se calcula una máscara de silueta a partir de la transparencia de cada sprite,
y los solapamientos se resuelven de delante hacia atrás. Las parcelas libres usan una elipse de huella.

## Limitaciones conocidas de la V1

Ver la sección final del informe de entrega; en resumen: un solo jugador, sin autenticación, botín de NPC repetible sin enfriamiento,
sin ilustraciones de unidades ni de niveles de edificio, y sin pruebas automáticas del frontend.
