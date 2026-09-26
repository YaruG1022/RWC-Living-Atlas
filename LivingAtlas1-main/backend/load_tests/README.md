# Test 1: registration correctness under concurrency

This stage sends simultaneous signup requests, checks the resulting rows in the
isolated `livingatlas_test` database, and deletes only rows created by its run.
It refuses nonlocal API targets and databases other than `livingatlas_test`.

From `LivingAtlas1-main/backend`, start the local backend with two workers in
one terminal:

```powershell
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8002 --workers 2
```

Then run the test in another terminal:

```powershell
$env:TEST_API_BASE = 'http://127.0.0.1:8002'
& .\.venv-local\Scripts\python.exe .\load_tests\01_registration_concurrency.py --distinct 50 --duplicates 20
Remove-Item Env:TEST_API_BASE
```

Passing means all different-email requests succeed, each receives a distinct
`SignupID`, exactly one same-email request succeeds, the others report the
expected duplicate-email response, and the database row counts match.

This is a correctness check on a local two-worker server. It does not establish
production throughput or capacity; those require later load tests in a
representative environment.
