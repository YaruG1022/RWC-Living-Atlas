# Informe de pruebas locales de Living Atlas

[en-US](TEST_REPORT.md) · [es-ES](TEST_REPORT.es-ES.md) · [zh-CN](TEST_REPORT.zh-CN.md)

Fecha: 2026-09-26. Rama del código: `codex/local-test-suite`.

## Entorno y alcance

- Frontend: servidor local de desarrollo React en `localhost:3000`.
- Backend: FastAPI local; las pruebas de registro concurrente usaron dos procesos Uvicorn.
- Base de datos: PostgreSQL 17 aislado, `livingatlas_test`, en `127.0.0.1:5433`.
- Las pruebas locales comprobaron la corrección y detectaron cuellos de botella. Sus tiempos de respuesta y rendimiento no se pueden extrapolar a la capacidad de producción.
- Los datos generados tenían un prefijo único por ejecución; se comprobaron y eliminaron después.

## 1. Corrección y concurrencia del registro

Script: `01_registration_concurrency.py`. Primero se enviaron solicitudes concurrentes con correos distintos y después con el mismo correo. Se comprobaron las respuestas HTTP, el número de filas, la unicidad de `SignupID` y la limpieza.

| Etapa | Condiciones | Resultado |
|---|---|---|
| Primera ejecución con dos procesos | 50 correos distintos y 20 solicitudes con el mismo correo | Las 50 solicitudes de correos distintos indicaron éxito, pero aparecieron valores `SignupID` duplicados en la base de datos; la prueba falló. |
| Corrección intermedia | Adquirir un bloqueo consultivo de PostgreSQL a nivel de transacción antes de calcular `MAX(SignupID)+1`; revertir las rutas de correo duplicado y error. | La asignación de ID y la comprobación de correos quedaron serializadas entre procesos. Después se sustituyó por una secuencia de la base de datos. |
| Ejecución tras la corrección intermedia | 100 correos distintos y 30 solicitudes con el mismo correo | Los 100 correos distintos se registraron con ID únicos; una solicitud de correo repetido tuvo éxito y 29 se rechazaron como se esperaba; p95: 52,1 ms; se eliminaron las 101 filas de prueba. |
| Repetición final de esta etapa | 50 correos distintos y 20 solicitudes con el mismo correo | Los 50 correos distintos se registraron con ID únicos; una solicitud de correo repetido tuvo éxito y 19 se rechazaron como se esperaba; p95: 57,4 ms; se eliminaron las 51 filas. |

Conclusión de esta etapa: el registro local con dos procesos fue correcto. La prueba no midió el rendimiento máximo de registro. El esquema original carecía de una restricción única para `SignupID`, por lo que la corrección intermedia dependía de que todos los escritores usaran el mismo bloqueo. La mejora posterior de restricciones se documenta más abajo.

## 2. Carga de referencia

Script: `02_baseline_load.py`. El backend con dos procesos atendió 5, 10 y 20 usuarios virtuales concurrentes, cada uno con 20 solicitudes secuenciales. El 10 % correspondía a registros; el resto alternaba entre `/allCards`, `/getMarkers`, `/searchBar` y `/arcgis/services`. La base de datos estaba vacía, por lo que las lecturas comprobaron sobre todo el comportamiento de las interfaces y la concurrencia, no un volumen realista de datos del mapa.

| Ejecución | Solicitudes y resultado | Observación |
|---|---|---|
| Primera ejecución | No terminó | Las rutas de lectura del mapa ejecutaban `ALTER TABLE` durante las solicitudes, lo que causó esperas por bloqueos entre procesos; se detuvo la ejecución. |
| Primera ejecución tras las correcciones | 5 usuarios: 100/100; 10: 200/200; 20: 399/400 | Un cursor compartido de ArcGIS devolvió `no results to fetch` y se sustituyó por un cursor propio de cada solicitud. Una solicitud a `/searchBar` agotó el tiempo de espera de 15 segundos con 20 usuarios; no se reprodujo de forma constante. |
| Repetición final | 5 usuarios: 100/100; 10: 200/200; 20: 400/400 | Con 20 usuarios, p95 global: 32,0 ms y p99: 36,1 ms. Se conciliaron y eliminaron las 70 filas de registro. |

El DDL de estilos de polígonos pasó a las migraciones de inicio; se corrigió la consulta de `/searchBar`; las listas de ArcGIS ahora usan cursores independientes. La primera ejecución detenida dejó 10 registros con un prefijo único: la auditoría final los eliminó y confirmó cero registros `load0%`. Conclusión: la repetición local de referencia pasó, aunque quedó sin explicar un tiempo de espera intermitente. Los tiempos y el rendimiento solo sirven para comparaciones locales; no se fijó un SLO de producción.

## 3. Pico de tráfico

Script: `03_spike.py`. Con dos procesos, la carga pasó de 5 usuarios de calentamiento a 50 usuarios iniciados a la vez y volvió a 5 usuarios de recuperación. Cada usuario hizo 10 solicitudes: un registro y nueve lecturas.

| Etapa | Solicitudes correctas | Duración | p95 | p99 |
|---|---:|---:|---:|---:|
| Calentamiento | 50/50 | 0,12 s | 28,6 ms | 30,1 ms |
| Pico | 500/500 | 0,46 s | 70,5 ms | 77,7 ms |
| Recuperación | 50/50 | 0,11 s | 25,0 ms | 29,4 ms |

Estos percentiles proceden de la repetición final tras corregir el cálculo de percentiles; la ejecución original tampoco tuvo errores de solicitud. Las 60 filas de registro coincidieron con las respuestas y se eliminaron. Conclusión: el pico local breve y la recuperación pasaron. Un pico de 0,46 segundos no representa una carga máxima sostenida ni la capacidad de producción.

## 4. Volumen de datos

Script: `04_data_volume.py`. La base aislada se pobló por etapas con 100, 1.000 y 5.000 tarjetas públicas de tipo punto. En cada tamaño se solicitaron cinco veces `/allCards`, `/getMarkers` y `/searchBar`, y se verificó el número de resultados. La tabla muestra el p95 local; con solo cinco muestras por grupo, p95 equivale al máximo del grupo.

| Tarjetas | `/allCards` | `/getMarkers` | `/searchBar` | Corrección |
|---:|---:|---:|---:|---|
| 100 | 35,2 ms | 33,9 ms | 36,5 ms | 15/15 solicitudes correctas |
| 1.000 | 105,6 ms | 107,6 ms | 108,3 ms | 15/15 solicitudes correctas |
| 5.000 | 419,9 ms | 339,2 ms | 378,0 ms | 15/15 solicitudes correctas |

Se eliminaron las 5.000 tarjetas y un usuario de prueba sin dejar residuos. Conclusión: la prueba local de volumen de API pasó, pero el tiempo de respuesta aumentó de forma notable con el número de tarjetas. No se probaron el renderizado del mapa en el navegador, las cargas de archivos, las capas complejas ni datos a escala de producción. El pequeño conjunto de muestras p95 solo describe esta ejecución.

## 5. Ejecución sostenida y recuperación ante fallos

Scripts: `05a_soak.py` y `05b_connection_recovery.py`. Dos procesos atendieron cinco usuarios virtuales durante 300 segundos, con aproximadamente una solicitud por usuario cada 0,5 segundos. La mezcla incluía registro, lecturas de tarjetas y mapas, búsqueda y listas de ArcGIS.

| Comprobación | Resultado |
|---|---|
| Ejecución sostenida de cinco minutos | 2.858/2.858 solicitudes correctas; p50: 26,3 ms, p95: 32,7 ms, p99: 69,9 ms, máximo: 354,0 ms. |
| Datos y conexiones | Las 145 filas de registro coincidieron con las respuestas y se eliminaron; se observaron dos conexiones del backend en cada comprobación por minuto. |
| Desconexión antes de la corrección | Tras terminar dos sesiones específicas del backend, las 12 lecturas devolvieron 500 y fallaron cuatro registros; el backend no se reconectó por sí solo. |
| Desconexión después de la corrección | Tras terminar de nuevo dos sesiones, las primeras dos lecturas devolvieron 500 y las 10 siguientes tuvieron éxito. Las cuatro rutas clave de lectura devolvieron 200; cuatro registros tuvieron éxito y coincidieron con la base de datos; la limpieza no dejó filas; las conexiones volvieron a dos. |

La corrección intermedia reconectaba al detectar una conexión cerrada y hacía que cada registro obtuviera la conexión y el cursor actuales. Después se repitió la prueba 1: pasaron los controles concurrentes de 50 correos distintos y 20 solicitudes con el mismo correo. Conclusión: la ejecución local sostenida de cinco minutos pasó. Las rutas probadas se recuperaron de la pérdida de conexiones, aunque la primera solicitud de cada proceso todavía podía devolver un 500. La inyección de fallos terminó sesiones del backend; no detuvo PostgreSQL, no duró horas ni cubrió otras rutas que aún usan conexiones y cursores a nivel de módulo. Las mejoras posteriores del pool se detallan abajo.

## Seguimiento: restricciones del registro

La base de prueba ya tenía un índice único para correo electrónico, pero `SignupID` no tenía restricción única ni valor predeterminado generado por la base. Ahora una secuencia de PostgreSQL asigna los ID; el registro conserva su formato original de respuesta para correos duplicados. La migración comprueba por separado los valores existentes de `SignupID` y `Email`. Crea cada índice único cuando los valores son distintos; si hay duplicados históricos, registra una advertencia y aplaza ese índice para permitir el arranque del backend. Tras el despliegue hay que revisar los registros de migración y los posibles duplicados históricos.

Repetición local final con dos procesos en el puerto 8001: los 50 correos distintos se registraron con ID únicos; de 20 solicitudes con el mismo correo, una tuvo éxito y 19 se rechazaron como se esperaba. El p95 de correos distintos fue 27,2 ms. Se eliminaron las 51 filas de prueba. El script comprobó el índice único de ID y el valor predeterminado de la secuencia en la base local; la revisión del PR también verificó la existencia del índice único de correo. Esto cubre la base local, no los registros existentes en producción.

## Seguimiento: aislamiento y recuperación de conexiones en rutas principales

El registro y `/allCards`, `/getMarkers`, `/searchBar` y `/arcgis/services` ahora usan un pool acotado de conexiones por proceso. Las conexiones prestadas se comprueban antes de usarse y las transacciones terminan antes de devolverlas. El valor predeterminado es una conexión por proceso; `DB_REQUEST_POOL_SIZE` permite aumentarlo hasta 10. No se cambiaron las demás rutas que aún usan conexiones o cursores a nivel de módulo.

En una repetición local con dos procesos se terminaron cuatro sesiones etiquetadas del backend de prueba. Las 12 lecturas consecutivas tuvieron éxito, las cuatro rutas clave devolvieron 200 y los cuatro registros tuvieron éxito y coincidieron con las filas. Con 20 usuarios, la carga de referencia fue 400/400, con p95 de 47,7 ms. Dos conexiones estaban `idle` y ninguna `idle in transaction`. La primera repetición del pico de 50 usuarios tuvo dos tiempos de espera de 15 segundos; una segunda completó 500/500 solicitudes de pico y 50/50 de recuperación, con p95 del pico de 101,2 ms. La causa de los tiempos de espera intermitentes sigue sin explicarse. Esta prueba de fallo no cubrió la desconexión durante una transacción activa ni la caída completa de la base.

## Seguimiento: paginación y eliminación de duplicados en frontend

`/allCards`, `/getMarkers` y `/searchBar` ahora aceptan parámetros opcionales `limit` (1–500) y `offset` no negativo. Sin `limit`, se conserva la respuesta completa. Cuatro rutas de eliminación de duplicados en listas de tarjetas del frontend cambiaron los escaneos repetidos con `findIndex` por un recorrido único con `Set`, y sus resultados se guardan durante el renderizado.

Con 5.000 tarjetas locales, cada ruta de respuesta completa se ejecutó cinco veces y las dos primeras páginas de 100 tarjetas de cada ruta se ejecutaron cinco veces. Todos los números de resultados fueron correctos, las dos primeras páginas no tenían ID duplicados y se eliminó toda la información de prueba. Las muestras p95 siguientes son cinco para respuestas completas y 10 para páginas; solo permiten comparaciones locales.

| Ruta | p95 de 5.000 tarjetas completas | p95 de página de 100 tarjetas |
|---|---:|---:|
| `/allCards` | 429,0 ms | 127,2 ms |
| `/getMarkers` | 383,3 ms | 92,6 ms |
| `/searchBar` | 433,3 ms | 133,5 ms |

El frontend sigue solicitando conjuntos completos para los recorridos existentes de tarjetas y mapas, por lo que persisten los costes de transferencia y consulta completa. No se midió el tiempo de renderizado en navegador después de eliminar duplicados. La carga de listas paginadas requeriría desplazamiento, paginación posterior al filtrado, consultas por área visible del mapa y verificación E2E en navegador.

La compilación de producción del frontend tuvo éxito, con advertencias existentes de ESLint, minificación CSS y tamaño del bundle. Una compilación correcta no demuestra cobertura E2E en navegador.

## Seguimiento: regresión combinada

Después de los cambios de pool y paginación, cinco usuarios virtuales enviaron solicitudes mixtas durante 60 segundos: 573/573 correctas, con p95 de 32,7 ms y p99 de 94,5 ms. Las 30 filas de registro coincidieron con las respuestas y se eliminaron. Permanecieron cuatro conexiones del backend con la misma etiqueta de aplicación en la base de prueba, pero había otro proceso antiguo del backend ejecutándose localmente, por lo que no se pueden atribuir todas a esta ejecución. La prueba sostenida anterior de 300 segundos cubrió la implementación previa de conexiones; esta versión solo recibió una regresión de 60 segundos.
