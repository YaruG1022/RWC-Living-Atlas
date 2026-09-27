# Pruebas locales de integración y carga

[en-US](README.md) · [es-ES](README.es-ES.md) · [zh-CN](README.zh-CN.md)

Estos scripts solo usan la base de datos aislada `livingatlas_test` y un backend HTTP local. Al final de cada ejecución se comprueban y eliminan las filas creadas. Los resultados y sus límites figuran en [TEST_REPORT.es-ES.md](TEST_REPORT.es-ES.md).

Desde `LivingAtlas1-main/backend`, inicie el backend local con dos procesos worker en una terminal:

```powershell
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
```

## Prueba 1: registros simultáneos

En otra terminal:

```powershell
& .\.venv-local\Scripts\python.exe .\load_tests\01_registration_concurrency.py --distinct 50 --duplicates 20
```

La prueba pasa si todas las solicitudes con correos distintos tienen éxito y reciben valores `SignupID` diferentes; una solicitud con el mismo correo tiene éxito y las demás reciben el rechazo esperado; los recuentos de filas coinciden.

## Pruebas 2–5

Ejecute las siguientes fases en orden:

```powershell
& .\.venv-local\Scripts\python.exe .\load_tests\02_baseline_load.py
& .\.venv-local\Scripts\python.exe .\load_tests\03_spike.py
& .\.venv-local\Scripts\python.exe .\load_tests\04_data_volume.py
& .\.venv-local\Scripts\python.exe .\load_tests\05a_soak.py --duration 300
& .\.venv-local\Scripts\python.exe .\load_tests\05b_connection_recovery.py
```

El script de recuperación solo termina sesiones PostgreSQL marcadas como `livingatlas_backend` dentro de `livingatlas_test`; no detiene el servicio PostgreSQL. Ejecútelo únicamente cuando ningún otro trabajo local use este backend. La prueba de duración prolongada dura cinco minutos de forma predeterminada. Los resultados locales no establecen el rendimiento ni la capacidad de producción; para ello se necesitan un entorno representativo y objetivos de servicio acordados.

De forma predeterminada, las rutas principales de lectura y registro usan una conexión agrupada por worker. Tras medir un despliegue representativo, `DB_REQUEST_POOL_SIZE` permite ajustar el valor entre 1 y 10. Otras rutas heredadas siguen usando objetos de base de datos a nivel de módulo y quedan fuera de la prueba de recuperación.

Con al menos 1.000 tarjetas, el script de volumen también verifica las dos primeras páginas de `/allCards`, `/getMarkers` y `/searchBar`. Solicite `limit=100&offset=0` y después `offset=100`; sin `limit` se conserva la respuesta completa actual.
