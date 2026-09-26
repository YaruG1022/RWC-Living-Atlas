# Local test environment

Use this isolated setup before registration or data-load tests. The test database
is `livingatlas_test` on `127.0.0.1:5433`. The local database files and passwords
are ignored by Git.

## Initial setup (Windows PowerShell)

From the repository root, run:

```powershell
& .\LivingAtlas1-main\backend\scripts\create_local_postgres.ps1
```

This creates an empty PostgreSQL 17 cluster, the test database and schema,
`backend/.env.local`, and `client/.env.development.local`. It refuses to replace
existing local data or settings. If PostgreSQL is installed elsewhere, edit
`$pgBin` in the script before running it.

The frontend development environment sets `REACT_APP_API_URL=http://localhost:8000`.
The backend loads `backend/.env.local` before connecting and checks that local
test mode targets only the loopback host and `livingatlas_test` database.

## Start the backend

From `LivingAtlas1-main/backend`, create a Python 3.12 virtual environment,
install the backend dependencies, and start the API:

```powershell
py -3.12 -m venv .venv-local
& .\.venv-local\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/` and `http://127.0.0.1:8000/allCards`.
The root route alone does not verify the database; `/allCards` exercises a query.

## Start the frontend

From `LivingAtlas1-main/client`, run `npm start`, then open
`http://localhost:3000`. Restart the dev server after editing an env file.

The chatbot uses a separate service and is outside this local database setup.
External ArcGIS and Mapbox services may still be contacted by map features.

## Stop and restart PostgreSQL

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data stop
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data -l .\LivingAtlas1-main\backend\.local-postgres\server.log -o '-p 5433 -h 127.0.0.1' -w start
```

Do not point load scripts at production. Test registrations will remain in this
local database until the test data is deliberately cleared.
