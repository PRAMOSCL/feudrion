# Rediseño visual: qué se hizo, cómo se verificó y qué falta

Referencia: las cuatro imágenes de Ciudad, Ejército, Informes y Mundo (≈ 1672×941). El rediseño es solo presentación e
interacción: backend, SQLite, reglas, fórmulas, API y progreso no se tocaron.

## Arquitectura de la interfaz

- **Shell** (`components/Shell.tsx`, `styles/shell.css`): CSS grid `158px | minmax(0,1fr) | 350px` × `70px | 1fr | 40px`.
  Cabecera con recursos reales (cantidad/capacidad/tasa y alerta «Lleno»), navegación lateral cerrable, barra inferior con datos reales
  (expediciones en marcha y hora del servidor). No hay clima ni hora simulada.
- **Sistema compartido** (`components/ui.tsx`, `styles/tokens.css`, `ui.css`): botones, tarjetas, barras de progreso, selector de
  cantidad validado, chips de costo, estado vacío, retratos. Estilos en capas (`@layer tokens, base, shell, ui, city, views`).
- **Lienzo escalado** (`ScaledStage.tsx`, `sceneGeometry.ts`, `sceneConfig.ts`): la escena se dibuja en coordenadas nativas del
  terreno (1536×1024) y se escala con un único `transform: scale()` uniforme. Arte, sprites, parcelas y anclas comparten ese sistema,
  de modo que cambiar el tamaño de la ventana o abrir/cerrar el inspector solo cambia la escala. Las etiquetas se contraescalan para
  mantener el tamaño en pantalla. Cuando la proporción no coincide, el margen se integra con el propio terreno difuminado (sin franjas
  verdes y sin deformar).
- **Interacción**: silueta clicable por transparencia del PNG (de delante hacia atrás), parcelas libres con elipse de huella,
  etiquetas compactas en selección/hover/foco de teclado, indicador de obra siempre visible.
- **Responsive**: a `≤ 1100 px` la navegación pasa a iconos y el inspector de Ciudad/Mundo a cajón sobre la escena; en Ejército e
  Informes se apila bajo el contenido.
- **Tipografía**: Marcellus (paquete npm local `@fontsource/marcellus`, sin CDN) para títulos, excluyendo los dígitos (Marcellus
  dibuja «1» como «I»; las cifras usan la fuente de interfaz). Texto descriptivo en Palatino/Georgia.
- **Arte**: `artManifest.ts` activa los 15 PNG del paquete (ver `ASSETS_PENDIENTES.md`); los iconos de recurso pasan por el
  componente compartido `ResourceIcon` / `PopulationIcon`.

## Mundo con el mapa ilustrado

- `worldConfig.ts` fija los destinos sobre `world_map.png` (1600×1000), partiendo de los centros orientativos de `LEEME_SONNET.md`
  (bandidos 300,215 · fortín 1210,255 · bastión 1300,700 · villa 350,680; el LEEME sugería 260,225 para bandidos y se ajustó mirando el
  mapa). Las posiciones del servidor (`camp.map`, en %) ya no se usan en el cliente.
- Cada destino es un círculo pulsable de radio constante en pantalla (104 px) centrado en el sitio pintado, más una etiqueta aparte con
  su propio desplazamiento (`labelDy`) para no tapar edificios. Imagen, marcadores y rutas de expedición comparten el mismo sistema de
  coordenadas y la misma escala uniforme.

## Verificación realizada

- `npm run typecheck`, `npm run build`, `npm test` (28 pruebas del servidor + 4 de geometría del cliente).
- **Hotspots del mapa** (Edge headless, clic real con ratón en el centro de cada destino): los tres abren su inspector en 1672×941,
  1920×1080, 1366×768 y 1024×768 (en tablet cerrando antes el cajón, que tapa parte del mapa). Posición relativa constante en todas
  las escalas (0,188/0,215 · 0,756/0,255 · 0,813/0,700), **0 solapes entre etiquetas** y todas dentro del mapa.
- **Consola y red:** sin errores ni respuestas ≥ 400 (no hay 404 de assets) en esos viewports y en las capturas.
- Capturas con Edge headless: `docs/capturas/` (instancia real, estados vacíos), `docs/capturas/poblado/` (**base temporal de
  fixture**, no la real), `docs/capturas/comparacion/` (referencia | implementación) y `docs/capturas/flujo/` (recorrido completo).
  Viewports: 1672×941, 1920×1080, 1366×768, 1024×768 (tablet), navegación colapsada y foco de teclado.
- Recorrido de interfaz automatizado sobre la base temporal (todo PASS): clic por silueta y por parcela → construir (obra en servidor,
  costos descontados, segunda obra bloqueada) → reclutar con selector validado → enviar expedición → combate y regreso → informe único,
  entregado una vez, visible tras recargar. Sin errores de consola.
- La base real no se tocó (sigue en el estado de demostración inicial: 0 informes, 0 expediciones, cuartel sin construir).

## Diferencias visuales pendientes (honestas)

- **No es pixel-perfect.** Se compararon capturas lado a lado (`docs/capturas/comparacion/`). El shell, la composición de cada vista y
  el arte integrado son muy cercanos; no se midió diferencia píxel a píxel.
- El arte del paquete está generado a partir de los mockups y **no es idéntico** a ellos (retratos y mapa distintos; el mapa no incluye
  la «Vigía del norte» del mockup, por indicación del LEEME).
- La referencia recorta el terreno para llenar el área central; aquí la escena se escala completa (sin recortar edificios ni parcelas),
  así que quedan márgenes integrados con terreno difuminado en Ciudad y franjas oscuras en Mundo cuando el área no coincide con la proporción.
- Iconos de navegación y acciones: SVG propios, no ilustrados como en la referencia. Los de recurso sí son los PNG del paquete.
- Controles de la referencia sin mecánica en el juego (ajustes, cancelar obra/reclutamiento, acelerar, clima): no se implementaron.
- Tablet: con el cajón del inspector abierto tapa parte del mapa; hay que cerrarlo (X) para elegir un destino cubierto.
- La duración del informe se deriva (2 × (regreso − llegada)) y solo se muestra cuando las tropas ya regresaron.
