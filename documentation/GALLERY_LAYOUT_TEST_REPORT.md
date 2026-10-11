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

## Explicit default-cover deletion (2026-10-04)

Default covers now have a Delete image button in edit mode. Uploads append to the
gallery and preserve its first image as the card cover. Deletion is staged until
Save; Cancel restores the previous gallery. Removing the final image persists an
empty thumbnail, including after subsequent metadata-only saves.

New cards store the default cover as a CardImages row. Startup backfills nonempty
legacy thumbnails only when the card has no gallery rows; image-overlay cards
are excluded. Intentionally empty thumbnails are excluded, so restart does not
restore a deleted cover. Shared default assets are retained when their card image
record is deleted. The default cover counts toward the eight-image limit.

All 22 frontend gallery/Card tests and eight backend gallery contract tests pass.
The production frontend build succeeds with existing lint/dependency warnings;
its output is recorded in `default-cover-build.log`.
The guarded `scripts/check_default_cover.py` verified actual creation, upload,
cover preservation, explicit deletion, final-image deletion, and metadata save
against the dedicated local database. Cleanup verified zero fixture cards and
removed owned local files. The adjacent local single/batch upload check also
passes. Browser inspection confirmed the default cover's delete button while
preserving the user's active draft.

The first integration run failed creating its fixture because this local database
does not contain category River (ID 1). The fixture was changed to the existing
Other category and rerun successfully; no product category changes were made.
Both failure and success output are preserved as `default-cover-integration.log`
and `default-cover-integration-run2.log`. Other evidence: `default-cover-frontend.log`,
`default-cover-backend.log`, and `default-cover-delete-button.png` in the evidence
directory above. External storage and production were excluded.

Repeat from the backend directory:

```powershell
./.venv-local/Scripts/python.exe scripts/check_default_cover.py
```

Rollback may leave the additional default-cover rows intact; they contain existing
thumbnail references and preserve image ordering. Older deletion behavior would
restore a logo after final-image deletion, so rollback changes that user behavior.

## Six-image display limit (2026-10-04)

The layout selector now offers grids of one through six images, alongside featured
and slideshow layouts. Previously saved grid-7/grid-8 settings display as grid-6.
The total storage/upload limit remains eight; additional images remain available
in slideshow and See all images, with no records removed. Backend acceptance of
legacy layout values is retained for compatibility with existing drafts/clients.

All 22 gallery/Card tests pass, including legacy layout fallback, eight-image
slideshow access, and saving/canceling a six-image layout. The initial run failed
three older Card tests because they selected the removed grid-8 option; those
tests now select grid-6. Both runs are preserved in `gallery-six-display-tests.log`
and `gallery-six-display-tests-run2.log` in the evidence directory above.

## Follow-up: edit-only layout selector inside the gallery

Date: 2026-10-10 (America/Los_Angeles). Baseline `aa53c91`.
Moved the existing layout selector from the actions row into LearnMoreGallery,
inside its top right corner. It renders only in edit mode with a layout change
handler. The overlay uses opacity 0.72 and a translucent background; hover and
focus-within use opacity 1 and solid white. Busy state still disables selection.
The Card passes its existing draft setter, preserving save/cancel behavior.
Updated the tutorial text and manual's gallery demonstration to the new location.

Scope: visual placement, opacity, edit/view mode and existing layout/save/cancel
regressions. No new database data, API changes, external services or migrations.
Actual browser inspection preserved the user's open unsaved edit without saving,
canceling, changing the selected layout or reloading the page.

Commands from `LivingAtlas1-main/client`:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/LearnMoreGallery.test.js src/Card.gallery.test.js
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/LearnMoreGallery.test.js
node node_modules/react-scripts/bin/react-scripts.js build
```

First combined run: Card's 20 tests passed, but four gallery tests failed because
they assumed the selector was still external or mounted a duplicate external
selector. Updated those existing expectations and fixtures for the requested
internal edit control, with explicit view-mode hiding assertions. Gallery rerun:
18/18 tests passed. Thus both suites passed across the recorded runs, totaling 38
tests; the combined command was not rerun after these expectation-only edits.
Card tests emit existing React act warnings. Build exited 0 with the existing
ESLint, Browserslist, bundle size and Card.css container-unit minimizer warnings.
`git diff --check` passed.

Actual localhost browser at 1242x764: control rectangle entirely inside the gallery,
top inset 10px and right inset 12px; computed resting opacity 0.72. After hovering,
computed opacity was 1 and background rgb(255,255,255). The See all images button
remains below the gallery. Screenshot saved as this chat's local visualization
artifact `gallery-layout-overlay.png`. No mobile browser or deployed preview was
tested in this follow-up. Rollback requires reverting only the frontend change.

## Follow-up: See all images inside the bottom left corner

Date: 2026-10-10 (America/Los_Angeles). Baseline `1f23373`.
Moved the existing See all images action into LearnMoreGallery, visible in both
viewing and editing modes. Removed the now-empty external actions row. The button
uses 12px left/bottom insets, opacity 0.72 at rest and opacity 1 with a solid white
background on hover or keyboard focus. Slideshow pagination moves above the bottom
controls to avoid overlap at narrow widths. Manual examples/text use the same
component. No API, schema or dependency changes.

Verification: the preceding combined Jest command for LearnMoreGallery.test.js and
Card.gallery.test.js passed 2 suites / 38 tests on its first run. Existing act
warnings remain. Frontend build exited 0 with the previously recorded warnings;
`git diff --check` passed.

Actual localhost browser at 1242x764: button bounds were entirely inside the
gallery, with left and bottom inset 12px and resting computed opacity 0.72. The
normal-mode hover matched `:hover` and computed opacity 1. Clicking opened the
existing all-images screen and Back to Learn More returned correctly. Entering
edit mode retained the button alongside the top-right layout control; no fields
were modified or saved. Cancel restored normal viewing. No database records were
created or changed. Screenshot: local chat artifact `gallery-see-all-overlay.png`.
No deployed preview, mobile browser or third-party performance checks were run.

## Follow-up: styled multiple attachment selection

Date: 2026-10-10 through 2026-10-11 (America/Los_Angeles). Baseline `0fcdee6`.
The existing learn-more attachment input already had `multiple`, but each selection
replaced the earlier batch. Restyled it as a labelled, keyboard-accessible picker
with an upload icon and explicit save timing. Selections now accumulate; identical
name/size/lastModified entries are skipped. Resetting the native input allows
reselecting a removed file. Each queued file has its name, displayed size and a
draft-only remove button. Choosing/removing files is disabled during saving.
The existing multipart save appends every queued file under the `files` field;
no backend endpoint or upload protocol changed.

Scope: frontend selection, queue mutation, multipart payload, failure retention
and cancel semantics. No live upload to the user's card, database writes, migrations,
cloud storage calls, load tests or production deployment were performed.

Using the preceding combined Jest command, the first run passed 39/40 tests. The
new failed-save/cancel test tried reopening edit mode before asynchronous cancel
had completed, matching unrelated Edit controls. It now waits for save controls to
be enabled and for the exact learn-more Edit button after cancel. The next run
passed 2 suites / 40 tests. New cases verify two-file selection, a subsequent batch,
duplicate suppression, removal and the remaining multipart filenames, plus a
simulated server error retaining the batch and cancel clearing it. Existing React
act warnings remain. Frontend build exited 0 with the previously recorded warnings;
`git diff --check` passed.

Actual local browser: native file chooser confirmed multiple selection and accepted
two synthetic local fixtures in one operation. Both filenames, sizes and the
two-file count appeared in the draft. Screenshot artifact:
`multiple-attachments-control.png`. Both synthetic entries were removed afterward
using their draft remove buttons; no Save or Cancel was pressed and other current
user edits were preserved. The browser selection operation took an unusually long
time to return; this is not an application upload latency measurement. Live
attachment persistence/download and mobile appearance were not exercised here.
