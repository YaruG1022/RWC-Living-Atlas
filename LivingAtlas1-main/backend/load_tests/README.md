# Local integration and load tests

These scripts target only the isolated `livingatlas_test` database and a local
HTTP backend. Test-created rows are checked and removed at the end of each run.
Measured results and limitations are in `TEST_REPORT.md`.

From `LivingAtlas1-main/backend`, start the local backend with two workers in
one terminal:

```powershell
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
```

## Test 1: concurrent registration

In another terminal:

```powershell
& .\.venv-local\Scripts\python.exe .\load_tests\01_registration_concurrency.py --distinct 50 --duplicates 20
```

Passing means all different-email requests succeed with distinct `SignupID`
values; one same-email request succeeds and the others receive the expected
duplicate-email response; database row counts match.

## Tests 2–5

Run the later stages in order:

```powershell
& .\.venv-local\Scripts\python.exe .\load_tests\02_baseline_load.py
& .\.venv-local\Scripts\python.exe .\load_tests\03_spike.py
& .\.venv-local\Scripts\python.exe .\load_tests\04_data_volume.py
& .\.venv-local\Scripts\python.exe .\load_tests\05a_soak.py --duration 300
& .\.venv-local\Scripts\python.exe .\load_tests\05b_connection_recovery.py
```

The connection-recovery script intentionally terminates only PostgreSQL
sessions tagged `livingatlas_backend` in `livingatlas_test`; it does not stop the
PostgreSQL service. Run it only when other local work is not using this test
backend. The soak test lasts five minutes by default. Local results do not
establish production throughput or capacity; those require a representative
environment and agreed service targets.
