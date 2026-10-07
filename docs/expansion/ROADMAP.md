# Señoríos — Roadmap de ciudad y expansión
Fecha: 6 de octubre de 2026. Versión 1. Documento maestro para Pablo, diseño visual y Sonnet.

## Objetivo acordado
Una ciudad medieval viva formada por fortaleza, villa exterior, distrito de oficios y campo. Recursos, familias, gobierno y tropas pertenecen a una misma ciudad. Cada distrito ofrece espacio y funciones propias. Mantener el estilo pintado isométrico, piedra clara, entramado de madera y teja rojiza del juego.

## Estado y evidencia
Implementación descrita por Sonnet: cuatro vistas, quince PNG integrados, muralla 0–9, guarnición real, trabajadores y habitantes, agua animada. Sonnet reporta 42 tests de servidor y 21 de cliente; no se han ejecutado aquí ni inspeccionado el repo. Pablo ya jugó y observó fallos visuales. La captura recibida confirma conflictos entre muro y embarcadero; las caminatas originales muestran poses demasiado similares. No considerar la ciudad viva visualmente terminada.

## Decisiones de diseño
- Conservar fortaleza actual; no sustituir el terreno real por una ilustración conceptual poblada.
- Añadir villa al otro lado del puente. Oficios y campo son expansiones posteriores.
- Primera versión: selector de distritos, cada uno con cámara propia. No exigir mosaicos unidos píxel a píxel ni scroll continuo. Futuro: panorama conectado si hay terreno y encaje suficientes.
- Un sistema de coordenadas por escena; edificios independientes, parcelas y rutas en configuración. El terreno no debe llevar edificios funcionales, personas, muros construibles o interfaz pintados.
- Las murallas son capas opcionales y deben dejar libre el embarcadero. La fortaleza comienza sin muro. La futura villa también comienza sin muralla exterior.
- Casas contienen familias; solo los integrantes elegibles para trabajar cuentan como trabajadores. La asignación familiar permite seleccionar adultos, sin convertir a todos sus integrantes en trabajadores.
- La fe, la felicidad y la cohesión son conceptos distintos. Servicios religiosos pueden influir en bienestar, sin una bonificación automática por cambiar de fe ni castigos arbitrarios a minorías.
- Lonja = comercio mayorista; impuestos = concejo/tesorería. Se conserva la intención del usuario de controlar el porcentaje de impuestos.
- Balance nuevo es propuesta configurable y requiere prueba; no reutilizar cifras ilustrativas como balance aprobado.

## Distritos
| Distrito | Edificios | Función |
|---|---|---|
| Fortaleza | Castillo, cuartel, almacén, muralla y acceso | Gobierno, ejército, defensa |
| Villa | Casas, plaza del mercado, taberna, iglesia, concejo, embajada | Familias, comercio, satisfacción, servicios, diplomacia |
| Oficios | Forja, talleres y depósitos, lonja | Armas, armaduras y comercio mayorista |
| Campo | Granja, aserradero, cantera; futuras explotaciones | Alimentos y materias primas |
La iglesia pequeña podrá evolucionar; una catedral requiere población, recursos y servicios suficientes y una parcela mayor reservada. Evitar duplicar una iglesia como catedral sin espacio.

## Orden de trabajo y criterios de cierre
### Fase 0 — Registro y diseño territorial (ahora)
Entregables: este roadmap, diseños conceptuales, plano de conexiones, catálogo de edificios y prompt de integración. Identificar claramente concepto, fondo limpio, sprite y animación. Reservar accesos, rutas y superficies para murallas antes de generar su arte final.
Cierre: todos los edificios pedidos tienen distrito, función, dependencia y espacio previsto. Ninguna imagen conceptual se usa como fondo interactivo final.

### Fase 1 — Corrección visual pendiente
- Murallas de piedra/reforzada con huella compatible con empalizada, puente, portón y embarcadero; no cubrir la cabaña.
- Caminatas de ciudadano, ciudadana y transportista: piernas alternadas, apoyos y transiciones. Mantener leñador y guardia que sí animan correctamente según Pablo.
- Rutas terrestres pasan por hueco del portón; edificios y paredes bloquean rutas. No atravesar la pared detrás de la puerta.
- Guardias apoyados en camino de ronda; recorridos por tramos conectados y pasos por torres ocultos. No cruzar almenas o torres dibujando encima.
- Orden de profundidad por pies y máscaras locales. Portón sigue estático hasta tener animación propia.
Cierre: clips de caminatas, entrada/salida, patrulla y cada muralla; capturas en 1672×941, 1920×1080, 1366×768 y 1024×768. No basta con tests o una captura quieta.

### Fase 2 — Distritos y construcción extensible
Agregar registro de escenas, selector Fortaleza/Villa y parcelas configurables. Misma ciudad, recursos, cola de construcción y tropas. Reservar Oficios/Campo como futuras zonas sin simular que ya existen. No reubicar los edificios productivos actuales todavía: los cambios de ubicación deben conservar IDs, niveles y trabajadores.
Cierre: añadir una parcela o edificio mediante configuración sin cambiar geometría central; regresar entre distritos conserva selección válida y partida; teclado y tablet funcionan.

### Fase 3 — Casas, familias y empleo
Casas con nivel/capacidad; familias con identificadores persistentes, integrantes, vínculos y residencia. Adultos disponibles, dependientes y ocupados se muestran por separado. Una familia puede aportar varios adultos al mismo edificio o repartirlos.
Migración: convertir población existente de manera determinista y reversible, conservando total y asignaciones reales; hogares iniciales o alojamiento provisional explícito, nunca eliminar población por falta de casas. No inventar edades exactas existentes. Evitar introducir envejecimiento, nacimientos y mortalidad hasta la fase 9.
Cierre: suma de integrantes = población; un adulto no trabaja en dos sitios; desempleo y capacidad coherentes; cero trabajadores detiene animación y producción conforme a reglas existentes. Familias no sustituyen el invariante de tropas/guarnición.

### Fase 4 — Satisfacción, mercado e impuestos
Descomponer felicidad en alimentos, vivienda, carga fiscal y acceso a servicios. Mercado con puestos y compradores dinámicos según abastecimiento, población, felicidad y nivel del castillo; actividad visual representa datos reales sin crear recursos.
Concejo: tasa impositiva configurable, recaudación por periodo y desglose visible. Probar tasas altas/bajas, evitar beneficios ilimitados, impuestos duplicados o cobros por fotograma. Lonja futura para excedentes y pedidos mayoristas. Primero comercio interno; comercio entre jugadores depende de multijugador.
Taberna: empleados, capacidad, suministros y satisfacción acotada. No acumular bonos ilimitados construyendo muchas.
Cierre: producción offline y en línea coherentes; tick servidor; cantidades y animación relacionadas; demanda y satisfacción explicables en inspector.

### Fase 5 — Iglesia, fe y catedral
Definir fe elegida, cobertura de servicios, celebraciones y cohesión. Mecánica legible, sin presentar creencias reales como superiores. Iglesia con trabajadores/capacidad/costos; catedral como proyecto avanzado con parcela y requisitos propios. Permitir ausencia de cobertura y diversidad sin forzar penalizaciones arbitrarias.
Cierre: efecto acotado y explicado; cambiar fe no genera oro ni felicidad instantáneos; iglesia cerrada o sin personal no muestra actividad ficticia.

### Fase 6 — Forja y equipo militar
Recetas, materiales, cola de fabricación, artesanos y almacén de armas/armaduras. Desbloqueos por nivel; tipos compatibles con lancero, arquero, espadachín y ballestero. Investigar metales: el juego actual tiene madera/piedra/alimentos/oro; no fabricar acero solo con piedra sin definir compra de metal o extracción futura.
Primera versión: equipo agregado por tipo de unidad con stock, consumo y efecto claro. Reservar equipo de expedición y guarnición para evitar doble uso; definir recuperación/pérdida después del combate. No asumir que el sistema actual de combate ya lo soporta.
Cierre: materias primas descontadas una vez; equipo no duplicado; resultados comprobables; recetas y bonos configurables.

### Fase 7 — Oficios y campo
Nuevos terrenos y edificios independientes. Traslado opcional de explotaciones conservando progreso, no demolición automática. Accesos, tránsito de transportistas y comercio mayorista. Reservar futuro molino, mina y otros talleres sin añadirlos al alcance implementado actual.
Cierre: producción única por edificio, persistencia de IDs y rutas coherentes; sectores no se consideran terrenos perfectamente unidos sin comprobar bordes.

### Fase 8 — Defensa exterior y diplomacia
Segunda muralla para villa, accesos y guarnición; definir si defensa es por distrito o global. Mantener defensa actual como estadística mientras no haya ataques a ciudades. No afirmar que protege en combate cuando V1 solo tiene expediciones.
Embajada: edificio visible y preparación de datos; alianzas reales necesitan cuentas, ciudades por jugador, servidor autoritativo y permisos. Implementar en una etapa multijugador dedicada; no simular otros jugadores como funcionalidad real.
Cierre: sin arqueros duplicados, invasiones inventadas ni alianzas falsas. Diplomacia real con autenticación y reglas solo cuando exista infraestructura.

### Fase 9 — Profundidad y evolución visual
Casas y edificios con variantes por nivel, familias con llegadas/nacimientos/envejecimiento si se aprueba su diseño, mercado estacional, animaciones específicas de granja/cantera/forja, puertas móviles, humo/fuego local, celebraciones y vida cotidiana. Balance y rendimiento antes de añadir más efectos.
Cierre: animaciones vinculadas a estado real, pausa en pestaña oculta, modo reducido, sprites de pocas figuras representan población sin dibujar cada persona.

## Catálogo mínimo de mecánicas
| Construcción | Datos necesarios | Actividad visible | Dependencia |
|---|---|---|---|
| Casa | Capacidad, familia residente, satisfacción habitacional | Entradas/salidas, habitantes | Familias |
| Mercado | Puestos, demanda, oferta, actividad | Comerciantes y compradores | Economía/satisfacción |
| Concejo | Tasa fiscal, base imponible, periodos | Atención ciudadana | Impuestos |
| Taberna | Capacidad, personal y suministros | Clientes atendidos | Satisfacción |
| Iglesia | Cobertura, personal, servicios, fe | Visitas/servicios | Familias/satisfacción |
| Catedral | Parcela mayor, requisitos, obra y servicios | Actividad religiosa avanzada | Iglesia/población |
| Forja | Recetas, metal, artesanos, cola, stock | Martillo, horno y transporte | Equipo/economía |
| Lonja | Excedentes, pedidos y stock | Carga/descarga | Comercio |
| Embajada | Diplomacia, permisos y jugadores | Recepción de delegaciones | Multijugador |

## Inventario visual que aún deberá producirse
Terrenos limpios de Villa/Oficios/Campo; casas y edificios transparentes individuales; niveles de muralla corregidos; caminatas completas; rutas/máscaras calibradas; estados de construcción; variantes por nivel; animaciones propias de granja/cantera/forja/mercado/portón. Los diseños de esta entrega orientan la composición: no reemplazan esos activos de producción.

## Reglas de trabajo y verificación
Migraciones aditivas; copia consistente de SQLite antes de probar; no resetear partida real, no commits sin petición. Auditar repo actual antes de editar. Probar contra base temporal y copia de partida; documentar diferencias. No crear multijugador, invasiones ni demografía completa como consecuencia implícita de poner un edificio.
Cada fase actualiza este archivo con estado (pendiente/en curso/verificado), evidencia, decisiones y faltantes. Mantener separado reporte de Sonnet de comprobación visual por Pablo. Ninguna fase está verificada por el mero diseño.

## Estado actual (2026-10-06)
- **Fase 2: implementada y verificada** (tests de servidor/cliente, 40 comprobaciones de navegador, migración probada en copia de la partida real; ver `docs/DISTRITOS.md`). La migración 003 está **pendiente de aplicar a la partida real** (se aplica sola al arrancar el servidor; hay copia previa en `E:Github Repoeudrion-backups`).
- **Parche v3.1 (acceso y agua) integrado y verificado con datos temporales y clip GIF (`docs/capturas/fortaleza-v3-1/`); aprobación visual pendiente de Pablo.**
- **Fase 1: arte v3 integrado, cierre pendiente de Pablo.** Terreno/muros v3, patrulla completa (3 etapas, 19 tramos, oclusión local), río con máscara y ciudadanos por el portón verificados con datos temporales (`docs/capturas/fortaleza-v3/`, `scripts/verificacion/fortaleza-v3-verify.mjs`). Faltan: clips y revisión visual de Pablo; no se declara pixel-perfect.
- Fases 3–9: pendientes (no iniciadas).

- **Correcciones v2 integradas** (ver `docs/CORRECCIONES_V2.md`): caminatas de 8 poses, murallas v2, terreno de la Villa, casa nivel 1 registrada. Fase 1: cabaña/embarcadero y caminatas sin recorte cerrados; **abierto**: muralla v2 cortando el aserradero, patrulla solo en el tramo norte, sin clips.

- **Fortaleza v3: cámara, arte, patrulla completa, oclusión y río integrados (ver arriba).** Histórico del paso previo: Cámara con zoom/desplazamiento hecha y verificada; exportación de la escena en `docs/fortaleza-v3-export.zip`; registro de patrulla completa preparado (sin geometría). Siguiente: recibir terreno/muros v3 y ejecutar `02_PROMPT_INTEGRAR_ARTE_Y_PATRULLA.md`.

## Estado inicial
Fase 0: roadmap, diseños conceptuales y prompt entregados; arte de producción pendiente. Fases 1–9: pendientes. Ciudad viva anterior: implementada según Sonnet, con correcciones visuales abiertas.
