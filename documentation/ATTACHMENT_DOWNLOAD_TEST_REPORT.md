# Attachment download fix and verification

Date: 2026-10-11, America/Los_Angeles. Baseline `43548ad`, branch
`codex/compact-card-list`.

## Defect and resulting behavior

Local attachment upload discarded the URL returned by the storage adapter and
instead persisted an Azure URL, although the bytes lived under local_test. The
frontend opened that nonexistent cloud object, displaying an XML storage error.
The previous download route redirected and put Content-Disposition on the
redirect response, which did not control the destination's response.

Uploads now persist the actual adapter URL. Both card attachment link surfaces
use `/downloadFile?fileID=...`. The route reads metadata through the request
connection pool and returns actual attachment bytes with Content-Disposition,
including Unicode names. Local mode supports existing erroneous owned Azure
links by resolving their corresponding local file; no user rows are rewritten.
Hosted Azure downloads use SDK streaming instead of redirecting. Missing files
return 404, and unavailable cloud storage returns 502. URLs and local paths are
restricted to owned storage/container paths. Existing ZIP packaging is retained:
the archive contains the original TXT filename and bytes.

## Scope, environment and exit criteria

Windows; existing Python 3.12 local virtual environment, React/Mapbox client.
Frontend `http://localhost:3000`, API `127.0.0.1:8000`, guarded configuration
`LOCAL_TEST_MODE=1`, `127.0.0.1:5433/livingatlas_test`, no DATABASE_URL.
Backend restarted to load the fix. No migrations/configuration/dependencies were
changed. Exit: offline storage/response tests, local real upload/DB/download
reconciliation and zero residue, frontend regressions/build, and a browser download.
No production writes/load tests/deployment; Azure networking is mocked.

## Verification

From `LivingAtlas1-main/backend`:

```powershell
& ./.venv-local/Scripts/python.exe -m unittest tests.test_attachment_download tests.test_local_storage
$env:PYTHONPATH='.'
& ./.venv-local/Scripts/python.exe scripts/check_attachment_download.py
```

From `LivingAtlas1-main/client`:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/Card.gallery.test.js src/LearnMoreGallery.test.js --silent
node node_modules/react-scripts/bin/react-scripts.js build
```

- Offline backend tests: 10/10 passed. Actual in-process HTTP responses cover
  byte content, Unicode attachment names, no redirects, local legacy URL fallback,
  missing/unowned/traversal locations, simulated Azure streaming and storage errors.
- Integration script: two synthetic TXT attachments uploaded through uploadForm,
  two Files records with local URLs, download ZIP member contents match input;
  one fixture row changed to a legacy cloud URL also downloads correctly. Missing
  ID returns 404. Each run uses a UUID title/filename prefix. Finally removes the
  fixture's Files/Card rows and local files, then asserts zero rows and no files.
  Final script ran successfully twice, including explicit disk-residue assertions.
- Existing user files 1 and 2: read-only download probes returned HTTP 200,
  Content-Disposition present, 1142 and 1622 bytes respectively. Their local copies
  were already present; original records/files were preserved.
- Frontend: two suites, 40/40 tests passed. Build exited 0 with existing ESLint,
  Browserslist, bundle size and Card.css container-unit minimizer warnings.
  `git diff --check` passed.
- Browser: click on the original Chinese-named attachment raised the actual
  download event and saved `Transformers重要话题.zip` in the user's Downloads.
  Detail view stayed open. Screenshot artifact: `attachment-download-fixed.png`
  in this chat's local visualization directory. No draft save/cancel was performed.

## Initial failures and limits

1. Starlette TestClient initialization failed in all five new tests because the
   installed httpx version no longer accepts its `app` argument. Switched the
   test harness to the installed AsyncClient/ASGITransport without dependencies
   changes. Next combined offline run passed 10 tests.
2. Integration fixture first omitted required coordinates (HTTP 400), then used
   River/category ID 1 (HTTP 500 foreign-key rejection). Local category IDs are
   only 4 and 5. Added coordinates and selected existing Other/category ID 5;
   subsequent runs passed. These fixture failures left zero fixture rows/files.
   The upload endpoint's fixed category mapping is a pre-existing limitation.

Hosted streaming was verified only with mocks, not a deployed Azure account.
Streaming routes backend bandwidth through the API and was not load tested;
mid-stream service failures remain outside these smoke tests. Only owned Azure
and local_test attachment storage are supported by the new download resolver.
No content authorization change was introduced. Rollback is reverting the code
commit; newly correct local URLs remain valid local assets and no schema rollback
is required.
