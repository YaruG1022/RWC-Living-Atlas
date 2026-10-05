# Learn More gallery layout verification

Date: 2026-10-04 (America/Los_Angeles). Branch: `codex/learn-more-gallery-layouts`.
Baseline: `866e7b50ae0a8178f4d15d18205b8cb7918727f7`.

## Scope and acceptance

Preserve the existing featured layout and add 1–8 image grids plus a slideshow.
Eight images use four columns and two rows. Editors can drag or use buttons to
reorder images, identify the card cover, save presentation and order, and cancel
draft changes. New uploads must not push a card beyond eight gallery records;
existing records are retained. Image-overlay cards retain their separate representation.

Acceptance: each layout shows its requested slot count, navigation wraps and
jumps correctly, draft order survives upload, cancel restores the draft, failed
order saves remain retryable, and upload limits reject overflow before storage.
Non-functional checks cover keyboard controls, desktop/narrow-screen presentation,
and the production frontend build. No latency or capacity target is asserted.

## Environment and results

Node 24.19.0, React 18.2.0, react-scripts 5.0.1; backend local Python environment
with FastAPI 0.95.0. Jest/jsdom tests mock APIs, map services, and storage. Backend
unittest tests replace the database and cloud modules before importing routes.
No real database rows, storage blobs, or external service requests are created.
There is no test-data cleanup or database reconciliation requirement for these mocks.

| Check | Workload and oracle | Result |
|---|---|---|
| Gallery component | 0–8 synthetic images; slot counts, callbacks, cover identity, drag, arrows, navigation, busy state, upload cap | 14 passed |
| Card integration | Three initial records and one mock upload; cancel, saved layout/IDs, draft preservation, failed order save | 4 passed |
| Backend contract | All ten layouts through create/update, omitted-field compatibility, invalid layout, eighth/ninth image boundary, single/batch rejection, response and 404 | 6 passed; create/update includes 20 subcases |
| Browser component preview | Eight synthetic SVG images, actual gallery component and modal CSS; default desktop and 390 × 844 viewport | 4 × 2 grid, slideshow jump to image 8, and updated cover visually verified; viewport reset |
| Frontend production build | Complete client | Passed with existing repository warnings |
| Python parsing and Git whitespace | Changed backend modules; `git diff --check` | Passed |

Commands, from the respective client/backend directories:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --runTestsByPath src/Card.gallery.test.js src/LearnMoreGallery.test.js
$env:CI='false'
node node_modules/react-scripts/bin/react-scripts.js build
./.venv-local/Scripts/python.exe -m unittest discover -s tests -p test_gallery_layout.py -v
```

Local raw output and screenshot directory:
`C:/Users/yarug/.codex/visualizations/2026/10/05/01a109cf-a51e-71e3-9e03-71304bf43699/`.
Final logs: `gallery-frontend-tests-run4.log`, `gallery-backend-tests.log`,
`gallery-build.log`; screenshot: `gallery-eight.png`.

## First failures and repairs

- Initial backend test harness unpacked every SQL call as two arguments, including
  parameter-free queries. Twenty subcases errored in the harness. Filter relevant
  statements before unpacking; rerun passed. No product defect was involved.
- Initial Card harness loaded the PDF library, whose Node build requires
  `TextEncoder` absent in jsdom. Mock the out-of-scope PDF dependency.
- `gallery-frontend-tests.log` records missing Axios defaults in the mock.
  `gallery-frontend-tests-run2.log` records CRA resetting default mock
  implementations. Supply defaults and reinstall async mock behavior before
  each test. `run3` and final `run4` pass.

## Persistence and release limits

The additive startup migration adds `Cards.GalleryLayout` with default `featured`.
Existing cards retain their layout. Updates that omit the field preserve its value;
invalid values return 422. The images response carries the saved layout so cards
opened through legacy search/map responses can obtain it without changing every
read endpoint. Image order still uses the existing reorder endpoint.

Upload checks lock the card row and count images within the upload transaction;
overflow releases the lock by rollback. Real multi-worker upload races and actual
database migration/persistence have not been exercised in this cycle. Pending
deletions must be saved before uploads can reuse slots at the server limit.
Older cards above the cap remain readable but cannot upload additional images.

Production fallback URLs and database environment precedence were not changed.
No deployment, preview release, production load, or migration against a live
database was performed. Application rollback can leave the additive column in
place. Deploy backend support before relying on saved frontend layout choices.

## Single-image display correction (2026-10-04)

User browser feedback on the local `test 1` card reproduced two defects: a
325 × 87 logo was enlarged and cropped by `object-fit: cover`, and the featured
layout rendered four empty cells around its only image. The actual DOM confirmed
five cells and `object-fit: cover` before the fix.

A single image now occupies the full grid in both view and edit modes, regardless
of the saved layout. The saved multi-image layout is retained for future uploads.
All gallery images use `scale-down`: large images fit proportionally, small images
remain at native size, and their contents are not cropped. Edit mode has a separate
Add image button so a full-width single image does not prevent further uploads.

Two new single-image regression cases failed before the fix (five cells instead of
one), then passed. All 20 gallery/Card tests pass. The development server rebuilt
the changes; no additional production build was needed for this focused correction.
Local browser verification on the user's open card found one cell, zero empty
cells, `scale-down`, and equal grid/cell dimensions of approximately 985 × 340.
The user's active editor was left intact and no card data was saved or changed.

Raw evidence in the directory above: `gallery-single-before.log`,
`gallery-single-after.log`, and `gallery-single-fixed.png`.

## Local image upload correction (2026-10-04)

The user reproduced `Azure upload failed: AZURE_STORAGE_CONNECTION_STRING is not
set` using Add image. Storage helpers unconditionally selected Azure despite
`LOCAL_TEST_MODE=1`. Offline tests reproduced the missing-credentials error and
incorrect Azure calls before the fix (`local-storage-before.log`).

Storage helpers now use `uploads/local_test/` exclusively in local test mode.
Uploads return relative URLs served by the backend's existing static mount;
thumbnails and attachments use the same routing. Local deletion cannot remove
referenced remote Azure blobs, and resolved local paths must remain within their
container. Hosted mode continues to call Azure. Uploaded local files are ignored
by Git. Five offline storage tests and six gallery contract tests pass.

The local backend was restarted and `scripts/check_local_upload.py` ran against
the verified `127.0.0.1:5433/livingatlas_test` database and local port 8000.
One uniquely prefixed fixture card received one single upload and a two-image
batch. All three returned 200, matched the three persisted rows and display
orders, served identical PNG bytes via both static and proxy routes, and were
deleted successfully. Their former static URLs returned 404. Cleanup confirmed
zero fixture card/image records and zero fixture files. Existing cards, uploads,
and the user's frontend draft were preserved. Azure and other external storage
were excluded. Raw output: `local-upload-integration.log` in the directory above.

Repeat from the backend directory:

```powershell
./.venv-local/Scripts/python.exe -m unittest discover -s tests -p test_local_storage.py -v
./.venv-local/Scripts/python.exe scripts/check_local_upload.py
```

This verifies local storage; no Azure credential or production storage integration
was tested. Rollback to Azure-only helpers prevents future local uploads without
credentials, but the existing static mount can still serve already uploaded files.
