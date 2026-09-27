# Living Atlas Local Test Report

[en-US](TEST_REPORT.md) · [es-ES](TEST_REPORT.es-ES.md) · [zh-CN](TEST_REPORT.zh-CN.md)

Test date: 2026-09-26. Code branch: `codex/local-test-suite`.

## Environment and scope

- Frontend: local React development server at `localhost:3000`.
- Backend: local FastAPI; concurrent-signup tests used two Uvicorn workers.
- Database: isolated PostgreSQL 17 database `livingatlas_test` at `127.0.0.1:5433`.
- Local tests checked correctness and located bottlenecks. Their latency and throughput cannot be extrapolated to production capacity.
- Generated data used a unique prefix for each run and was checked and removed afterward.

## 1. Registration correctness and concurrency

Script: `01_registration_concurrency.py`. Concurrent requests first used distinct emails and then the same email. Checks covered HTTP responses, database row count, `SignupID` uniqueness, and cleanup.

| Stage | Conditions | Result |
|---|---|---|
| Initial two-worker run | 50 distinct emails and 20 duplicate-email requests | All 50 distinct-email requests reported success, but duplicate `SignupID` values appeared in the database; the test failed. |
| Intermediate fix | Acquire a PostgreSQL transaction-level advisory lock before computing `MAX(SignupID)+1`; roll back duplicate-email and error paths. | ID allocation and email checks were serialized across processes. This was later replaced by a database sequence. |
| Run after intermediate fix | 100 distinct emails and 30 duplicate-email requests | All 100 distinct emails succeeded with unique IDs; one duplicate-email request succeeded and 29 were rejected as expected; p95 was 52.1 ms; all 101 test rows were removed. |
| Final retest at this stage | 50 distinct emails and 20 duplicate-email requests | All 50 distinct emails succeeded with unique IDs; one duplicate-email request succeeded and 19 were rejected as expected; p95 was 57.4 ms; all 51 rows were removed. |

Conclusion at this stage: local two-worker signup correctness passed. The test did not measure maximum signup throughput. The original schema had no `SignupID` unique constraint, so the intermediate fix depended on every writer using the same transaction lock. The later database constraint work is documented below.

## 2. Baseline load

Script: `02_baseline_load.py`. The two-worker backend handled 5, 10, and 20 concurrent virtual users, each making 20 sequential requests. The mix was 10% signup; the rest rotated through `/allCards`, `/getMarkers`, `/searchBar`, and `/arcgis/services`. The database was empty, so reads mainly checked interface behavior and concurrency, not realistic map-data volume.

| Run | Requests and result | Observation |
|---|---|---|
| First run | Not completed | Map read endpoints executed `ALTER TABLE` during requests, causing database lock waits across processes; the run was stopped. |
| First run after fixes | 5 users: 100/100; 10 users: 200/200; 20 users: 399/400 | An ArcGIS shared cursor returned `no results to fetch` and was replaced with a request-local cursor. One `/searchBar` request timed out at 15 seconds at the 20-user level; this did not reproduce consistently. |
| Final retest | 5 users: 100/100; 10 users: 200/200; 20 users: 400/400 | At 20 users, overall p95 was 32.0 ms and p99 was 36.1 ms. All 70 signup rows were reconciled and removed. |

Polygon-style DDL moved to startup migrations; `/searchBar` query code was corrected; ArcGIS list requests now use independent cursors. The stopped first run left 10 signup rows with a unique run prefix; the final audit removed them and confirmed zero remaining `load0%` signup rows. Conclusion: the local baseline retest passed, while one intermittent timeout remained unexplained. Latency and throughput are local comparisons only; no production SLO was set.

## 3. Traffic spike

Script: `03_spike.py`. With two backend workers, the workload went from 5 warm-up users to 50 users starting together and back to 5 recovery users. Each user made 10 requests: one signup and nine reads.

| Stage | Successful requests | Duration | p95 | p99 |
|---|---:|---:|---:|---:|
| Warm-up | 50/50 | 0.12 s | 28.6 ms | 30.1 ms |
| Spike | 500/500 | 0.46 s | 70.5 ms | 77.7 ms |
| Recovery | 50/50 | 0.11 s | 25.0 ms | 29.4 ms |

These percentiles are from the final retest after a percentile-calculation correction; the original run also had no request errors. All 60 signup rows matched responses and were removed. Conclusion: the brief local spike and recovery passed. A 0.46-second spike does not represent a sustained peak or production capacity.

## 4. Data volume

Script: `04_data_volume.py`. The isolated database was populated in stages with 100, 1,000, and 5,000 public point cards. At each size, `/allCards`, `/getMarkers`, and `/searchBar` were requested five times each and response counts were checked. The table shows local p95 response time; with only five samples per group, p95 equals the group's maximum.

| Cards | `/allCards` | `/getMarkers` | `/searchBar` | Correctness |
|---:|---:|---:|---:|---|
| 100 | 35.2 ms | 33.9 ms | 36.5 ms | 15/15 correct requests |
| 1,000 | 105.6 ms | 107.6 ms | 108.3 ms | 15/15 correct requests |
| 5,000 | 419.9 ms | 339.2 ms | 378.0 ms | 15/15 correct requests |

The 5,000 cards and one test user were removed with no residue. Conclusion: the local API volume test passed, but response time rose noticeably with card count. Browser map rendering, uploads, complex layers, and production-scale data were not tested. The small p95 sample describes this run only.

## 5. Soak and fault recovery

Scripts: `05a_soak.py` and `05b_connection_recovery.py`. Two backend workers served five virtual users for 300 seconds, each sending roughly one request every 0.5 seconds. The mix included signup, card and map reads, search, and ArcGIS lists.

| Check | Result |
|---|---|
| Five-minute soak | 2,858/2,858 requests succeeded; p50 26.3 ms, p95 32.7 ms, p99 69.9 ms, maximum 354.0 ms. |
| Data and connections | 145 signup rows matched successful responses and were removed; two backend DB connections were observed at each minute check. |
| Disconnection before fix | After terminating two targeted backend DB sessions, all 12 reads returned 500 and four signups failed; the backend did not reconnect by itself. |
| Disconnection after fix | After terminating two sessions again, the first two reads returned 500 and the next 10 succeeded. All four key read endpoints returned 200; four signups succeeded and matched the database; cleanup left no rows; connection count returned to two. |

The intermediate fix reconnected when a closed connection was detected and made signup obtain the current connection and cursor for each request. Test 1 was rerun afterward: 50 distinct-email and 20 duplicate-email concurrent checks passed. Conclusion: the five-minute local soak passed. The tested endpoints recovered after lost connections, although the first request in each process could still return one 500. Fault injection terminated backend DB sessions; it did not stop PostgreSQL, run for hours, or cover other endpoints still using module-level connections/cursors. Later pooling improvements are below.

## Follow-up: signup constraints

The test database already had an email unique index, but `SignupID` had neither a unique constraint nor a database-generated default. A PostgreSQL sequence now assigns IDs; signup retains its original duplicate-email response format. The migration checks existing `SignupID` and `Email` values separately. It creates each unique index when values are distinct; otherwise it logs a warning and defers that index so historical duplicates do not prevent backend startup. After deployment, migration logs and any historical duplicates still need review.

Final local retest with two backend processes on port 8001: all 50 distinct-email requests succeeded with unique IDs; of 20 same-email requests, one succeeded and 19 were rejected as expected. Distinct-email p95 was 27.2 ms. All 51 test rows were removed. The script checked the local ID unique index and sequence default; PR review also verified that the email unique index exists. This covers the local test database, not existing production records.

## Follow-up: core-route connection isolation and recovery

Signup plus `/allCards`, `/getMarkers`, `/searchBar`, and `/arcgis/services` now use a bounded request connection pool per process. Borrowed connections are checked before use, and transactions end before return. The default is one connection per process; `DB_REQUEST_POOL_SIZE` can raise it to at most 10. Other endpoints still using module-level connections or cursors were not changed.

In a local two-process retest, four tagged test-backend sessions were terminated. All 12 consecutive reads succeeded, the four key read endpoints returned 200, and all four signups succeeded and matched database rows. At 20 users, baseline load was 400/400 with p95 47.7 ms. Two backend connections were `idle`, with none `idle in transaction`. The first 50-user spike retest had two 15-second timeouts; a second run completed 500/500 spike and 50/50 recovery requests with spike p95 101.2 ms. The intermittent timeouts remain unexplained. This fault test did not cover disconnection during an active transaction or a full database outage.

## Follow-up: pagination and frontend deduplication

`/allCards`, `/getMarkers`, and `/searchBar` now accept optional `limit` (1–500) and nonnegative `offset` parameters. Without `limit`, the full response remains available. Four frontend card-list deduplication paths changed from repeated `findIndex` scans to one-pass `Set` traversal, with results cached during rendering.

With 5,000 local test cards, each full-response endpoint ran five times and the first two 100-card pages of each endpoint ran five times. Every response count was correct, the first two pages had no duplicate IDs, and all test data was removed. The p95 sample counts below are five for full responses and 10 for paged responses; these are local comparisons only.

| Endpoint | Full 5,000-card p95 | 100-card page p95 |
|---|---:|---:|
| `/allCards` | 429.0 ms | 127.2 ms |
| `/getMarkers` | 383.3 ms | 92.6 ms |
| `/searchBar` | 433.3 ms | 133.5 ms |

The frontend still requests full datasets for the existing card and map journeys, so their network transfer and full-query costs remain. Browser rendering time after deduplication was not measured. Paged list loading would require scrolling, post-filter pagination, map viewport queries, and browser E2E verification.

The frontend production build succeeded with existing ESLint, CSS minification, and bundle-size warnings. A successful build does not establish browser E2E coverage.

## Follow-up: combined regression

After pooling and pagination changes, five virtual users ran mixed requests for 60 seconds: 573/573 succeeded, with p95 32.7 ms and p99 94.5 ms. All 30 signup rows matched responses and were removed. Four backend connections carrying the same application tag remained in the test database, but another older backend process was running locally, so that number cannot be attributed solely to this run. The earlier 300-second soak covered the previous connection implementation; this version received only a 60-second regression.
