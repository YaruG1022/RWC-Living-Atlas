# Entorno de pruebas local

[en-US](LOCAL_TESTING.md) · [es-ES](LOCAL_TESTING.es-ES.md) · [zh-CN](LOCAL_TESTING.zh-CN.md)

Use este entorno aislado antes de las pruebas de registro o de carga de datos. La base de datos de pruebas es `livingatlas_test` en `127.0.0.1:5433`. Git ignora los archivos de la base de datos local y las contraseñas.

## Configuración inicial (Windows PowerShell)

Desde la raíz del repositorio, ejecute:

```powershell
& .\LivingAtlas1-main\backend\scripts\create_local_postgres.ps1
```

Esto crea un clúster vacío de PostgreSQL 17, la base de datos y su esquema, `backend/.env.local` y `client/.env.development.local`. El script se niega a reemplazar datos o ajustes locales existentes. Si PostgreSQL está instalado en otra ubicación, edite `$pgBin` en el script antes de ejecutarlo.

El entorno de desarrollo del frontend establece `REACT_APP_API_URL=http://localhost:8000`. El backend carga `backend/.env.local` antes de conectarse y comprueba que el modo de pruebas local apunte únicamente a la dirección de bucle local y a `livingatlas_test`.

## Iniciar el backend

Desde `LivingAtlas1-main/backend`, cree un entorno virtual con Python 3.12, instale las dependencias e inicie la API:

```powershell
py -3.12 -m venv .venv-local
& .\.venv-local\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Compruebe `http://127.0.0.1:8000/` y `http://127.0.0.1:8000/allCards`. La ruta raíz por sí sola no verifica la base de datos; `/allCards` ejecuta una consulta.

## Iniciar el frontend

Desde `LivingAtlas1-main/client`, ejecute `npm start` y abra `http://localhost:3000`. Reinicie el servidor de desarrollo después de modificar un archivo de entorno.

El chatbot usa un servicio independiente y queda fuera de esta configuración de base de datos local. Las funciones del mapa todavía pueden contactar con servicios externos de ArcGIS y Mapbox.

## Detener y reiniciar PostgreSQL

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data stop
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data -l .\LivingAtlas1-main\backend\.local-postgres\server.log -o '-p 5433 -h 127.0.0.1' -w start
```

No dirija los scripts de carga a producción. Los registros de prueba permanecerán en esta base de datos local hasta que se eliminen expresamente.
