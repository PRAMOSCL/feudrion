# Diseño territorial y visual — Señoríos

## Dirección artística
Mantener el juego existente: pintura isométrica con volumen legible, piedra clara, madera oscura, tejas rojizas y prados verdes. Cámara elevada constante, luz cálida. No introducir edificios gigantes ni cambiar a estilo pixel art. Estas composiciones son concepto: no son activos listos para conectar al juego.

## Organización
Fortaleza actual = núcleo militar. Villa al otro lado del puente = vida civil. Oficios y campo = expansiones. Todas comparten ciudad y recursos. El selector de distritos es la primera solución; unión panorámica continua se reserva para cuando bordes/cámaras/terrenos se diseñen con precisión.

El diseño maestro ilustra relaciones y ambiente. La geometría de implementación se define por configuración, NO midiendo distancias en el concepto general.

## Villa: plano lógico
Escena conceptual con ejes x/y normalizados 0..1. Entrada norte-oeste desde puente de Fortaleza. Carretera principal baja hacia plaza central y continúa al sureste hacia Campo. Ramal este hacia Oficios. No son coordenadas finales de sprites.

| Área | Centro aproximado | Reserva |
|---|---|---|
| Entrada Fortaleza | (0.12, 0.18) | Acceso + carretera, sin construcción |
| Viviendas oeste | (0.23, 0.42) | Bloque de varias parcelas pequeñas |
| Viviendas sur | (0.39, 0.77) | Segundo bloque ampliable |
| Plaza del mercado | (0.50, 0.49) | Gran espacio abierto con puestos independientes |
| Iglesia | (0.65, 0.26) | Edificio + atrio |
| Catedral futura | (0.80, 0.23) | Parcela mayor, sin ocupar al inicio |
| Taberna | (0.35, 0.57) | Edificio + patio fuera de calzada |
| Concejo | (0.68, 0.49) | Fachada al borde de plaza |
| Embajada | (0.79, 0.61) | Casa señorial + patio |
| Salida Oficios | (0.94, 0.51) | Camino y área libre |
| Salida Campo | (0.75, 0.92) | Camino y área libre |

Reservar franja periférica para muralla exterior futura. No dividir la plaza con muros ni ubicar viviendas en el recorrido principal. El puente real de Fortaleza no debe sustituirse por el dibujado en un concepto.

## Construcciones y siluetas
- Casa familiar: pequeña, entramado y zócalo de piedra, una puerta reconocible, huerto/patio. Niveles: vivienda modesta, casa ampliada, hogar de dos pisos. No confundir capacidad con cantidad visible de ventanas.
- Mercado: plaza despejada; puestos de paño en módulos separados. No una única imagen poblada: base/pavimento, tiendas, comerciantes y clientes son capas distintas.
- Taberna: dos pisos compactos, patio de mesas, barriles y entrada visible; actividad depende de servicio real.
- Iglesia: nave pequeña de piedra y campanario. Catedral: edificio mayor distinto, necesita parcela grande; no concederla gratis dentro del terreno.
- Concejo/tesorería: edificio cívico sobrio, fachada a plaza y pequeño balcón; controla fiscalidad.
- Embajada: casa señorial moderada, patio y sala de recepción; no banderas de países modernos.
- Forja: taller bajo, patio, chimenea y cobertizo. Horno, humo y herreros son capas animadas cuando haya producción.
- Lonja: nave comercial con porche, zona de carga y acceso para carros. Impuestos no se gestionan aquí.

## Capas finales necesarias
1. Terreno limpio sin construcciones jugables, personas o interfaces.
2. Cada construcción como PNG transparente independiente, con puerta y pivote de pies documentados.
3. Obra y variantes por nivel, sin desplazar huella ni puerta.
4. Actores/sprites y efectos locales, condicionados a estado del servidor.
5. Zonas de interacción, rutas terrestres, rondas y máscaras de ocultación calibradas.

## Correcciones aún pendientes
El paquete anterior conserva problemas: muralla piedra/reforzada invade cabaña del río; ciudadano/ciudadana/transportista necesitan nuevas piernas; rutas de portón y apoyo de guardias necesitan calibración. Esta entrega territorial NO sustituye esas correcciones. Leñador se conserva. No dar por cerrado el defecto con un concepto bonito.

## Alcance de esta entrega
Roadmap, composición territorial y estudios visuales de Villa/edificios, plano lógico y prompt de fase 2. No incluye nuevo repo, terreno limpio calibrado, sprites de todos los edificios, caminatas corregidas ni murallas finales. El diseño guía su producción posterior, en el orden del roadmap.

## Lectura del catálogo 3×3
Fila superior: casa, mercado, taberna. Fila central: iglesia, catedral, concejo. Fila inferior: forja, lonja, embajada. Las personas pintadas son referencia de escala, no animaciones.
