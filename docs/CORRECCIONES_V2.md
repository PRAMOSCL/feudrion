# Correcciones visuales y terreno de la Villa (paquete `senorios-correcciones-villa-v2`)

Integra los 7 PNG de `assets/` (a `client/public/assets/viva/`, conservando los `*_v2`; los anteriores siguen en la carpeta). No se copió `previews/`. No hay cambios de reglas,
servidor, SQLite ni migraciones (no hace falta copia previa; la migración 003 de la fase 2 sigue **pendiente** en la partida real).

## Qué se integró
- **Caminatas v2** (ciudadano, ciudadana, transportista): 8 poses con **rectángulos y pivotes** de `client/src/live/atlasV2.json` (no la rejilla 3×2); una sola escala (altura / `referenceHeight`),
  pies apoyados en el pivote. La fase depende de la **distancia caminada** (`floor(distancia / (altura×1,1) × 8) % 8`, `Pose.walked`); al detenerse (paradas, giros) la pose se congela.
  Leñador y guardia conservan su hoja de 6 poses. El retorno es el espejo horizontal (aproximación, no hay 8 direcciones).
- **Murallas**: `wall_stage_2_v2` (niveles 4–6) y `wall_stage_3_v2` (7–9); nivel 0 sin muro y empalizada 1–3.
- **Villa**: `terrain_village.png` conectado como terreno; ya no se muestra «terreno inexistente». Parcelas y calles **recolocadas** sobre los claros/empedrado (IDs y contratos sin cambios).
- **Casa**: `house_stage_1.png` registrada en `artManifest.ts` (`houseStage1`). **No** se coloca en la partida ni define capacidad, residentes o familias.

## Posiciones finales de la Villa (lienzo 1536×1024, provisionales)
casas_oeste (330,400) · casas_sur (505,625) · mercado/plaza (770,500) · taberna (205,655) · iglesia (860,268) · catedral_reserva (1150,290, parcela amplia) · concejo (1090,455) · embajada (1215,700).
Calles: entrada (puente → plaza), anillo de plaza, calle norte, calle oeste, calle suroeste, calle sur (→ Campo), ramal este (→ Oficios) y un corredor reservado a la catedral. Franja de muralla futura: 60 px.
Validado por tests: ninguna parcela invade un corredor ni la franja, todas tienen acceso y todo conecta con la entrada. Las líneas dibujadas siguen el empedrado **aproximadamente** (no al píxel).

## Fase 1: qué se cierra y qué sigue abierto
- **Cerrado (con evidencia):** hojas de caminata sin recorte (comprobado por programa con los rectángulos reales: ningún píxel opaco en el borde de las 24 poses; tira a 36 px y ×4 en `docs/capturas/v2/caminatas-v2-36px-x4.png`);
  cabaña y embarcadero libres en las etapas 2 y 3 (la muralla v2 ya no entra en su rectángulo: 0 px en la etapa 2 y 125 px de borde en la 3; ver zooms).
- **Puerta recalibrada** contra el alfa v2 (`GATE_CROSSING`): 0 píxeles opacos cruzados en las etapas 1 y 2; en la etapa 3 el portón tiene **rastrillo**, así que el actor queda oculto desde y ≈ 744 (oclusión real, no error).
- **Patrulla:** sigue limitada al tramo norte visible (x ≈ 860–1080). **No** hay patrulla completa ni paso por torres.
- **DEFECTO ABIERTO (no se oculta):** las murallas de piedra y reforzada v2 **cortan la base del aserradero** (≈ 8 000 px de su silueta quedan bajo la muralla delantera) y rozan la granja (≈ 1 000–1 800 px); ver `zoom-aserradero-muralla-nivel4.png`.
  La empalizada (1–3) no solapa nada. Hace falta arte de muralla con otro trazado o recolocar el aserradero (decisión de diseño; no se trasladó).
- Caminatas: no puedo juzgar la fluidez sin verlas moverse; **no se grabaron clips** (sin captura de vídeo aquí). Hay tiras de fotogramas. Pablo debe comprobar el movimiento jugando; ajustar `CYCLE_HEIGHTS` (liveRenderer.ts) si el paso parece resbalar.

## Verificación ejecutada
- Typecheck y build sin errores; tests: 52 de servidor y 37 de cliente (nuevos: atlas v2 y distancia caminada).
- Navegador (base temporal): Ciudad viva 35/35 PASS, distritos 39 PASS (Villa con terreno, clic por parcela, selector, tablet, 4 viewports), gate-check y wall-overlap (scripts en `scripts/verificacion/`), sin errores ni 404.
- Fortaleza con muralla de nivel 0, 1, 4 y 7 (capturas `fortaleza-nivel*`). No se reejecutó el ciclo económico por API (no cambió el servidor).

## Arte aún pendiente
Terrenos de Oficios y Campo; casas de niveles superiores y demás edificios civiles; ocho orientaciones de caminata; trabajo específico de granja/cantera; muralla corregida frente al aserradero; animación de portón.
