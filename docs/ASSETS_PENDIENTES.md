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
- `img/senorios-assets.zip` (≈ 50 MB) sigue en `img/` sin trackear; no hace falta commitearlo.

## Arte aún pendiente

Del alcance pedido, ninguno. Sin ilustración quedan: iconos de navegación/acciones (SVG), el estado vacío de **Informes** (emblema SVG
dentro de un aro) y cualquier arte de batalla específico por informe (por decisión, se reutiliza el del campamento).
