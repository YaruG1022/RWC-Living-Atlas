# Main-page gallery selection

Date: 2026-10-04 (America/Los_Angeles). Baseline: 7bf62b5 plus the working changes
recorded here. Scope: select up to six images for Learn More's main gallery while
retaining eight total images and the separate image-deletion controls.

The all-images page has a labeled checkbox for every image. Edit mode permits
selection changes; view mode displays the saved selection read-only. Multiple
images automatically arranges the selected images; Slideshow uses the same set.
The layout menu contains only these two modes. Old grid/featured values render
as Multiple images without removing records. The initial implementation kept
card-cover identity independent of visibility; the numbered selection refinement
below supersedes that behavior. Preview/reorder callbacks map the
displayed subset back to the full image list.

The user's subsequent Back to Learn More style request is included: a neutral
gray-blue background, border, seven-pixel corners, hover feedback, and visible
keyboard focus replace the bright blue text link. Read-only browser inspection
confirmed the applied colors and border while preserving the user's active draft.
The development server compiled this final CSS-only refinement; the production
build above covers the functional selection changes.

An additive nullable Cards.GalleryImageIDs JSONB column stores selection. NULL
means the first six images in display order, preserving old cards; [] means no
main-page images. uploadForm validates JSON, positive integer IDs, uniqueness,
the six-image cap, and ownership by the edited card. Existing owner/admin checks
still apply. Omitted selection preserves the saved value. API reads expose the
selection to the client. Deleting images is a separate operation; stale IDs are
filtered from the visible set and from subsequent selection saves.

## Verification

- 29 frontend gallery/Card tests pass: automatic layouts, two-mode menu, six-image
  checkbox limit, selecting image seven from an eight-image card, identical subset
  in both modes, JSON save/refresh, cancel restoration, existing upload/deletion,
  reorder, and map-editor behavior.
- 11 backend gallery contract tests pass: selection validation, empty selection,
  foreign/missing image rejection, saved API response, legacy updates, eight-image
  upload limit, and default-cover behavior.
- Frontend production build succeeds with existing lint/dependency warnings.
- Guarded `backend/scripts/check_gallery_selection.py` ran against localhost:8000
  and 127.0.0.1:5433/livingatlas_test with LOCAL_TEST_MODE=1. A uniquely named card
  received seven local PNG uploads plus its default cover (eight total). Selecting
  the final six persisted for both modes, matched the database and both read APIs,
  and survived a metadata-only save. Three invalid requests returned expected
  422s without changing selection. Saving [] retained all eight image records.
  Cleanup confirmed zero fixture cards and removed all owned local files.
- Browser verification in an independent tab unchecked one of test 1's five
  images. Slideshow showed four navigation items and Multiple images used a
  four-cell layout with exactly the remaining images. The selection was restored
  and the temporary tab closed without saving any real user card changes.

Initial frontend runs failed on an ambiguous Back button selector and an assertion
made before asynchronous cancel completed. The selectors/wait were corrected.
The initial backend run incorrectly expected one rollback; uploadForm also rolls
back at transaction start, so the test now checks that rejection rolls back.
All first and final output is retained rather than overwritten.

Evidence directory:
`C:/Users/yarug/.codex/visualizations/2026/10/05/01a109cf-a51e-71e3-9e03-71304bf43699/`

- `gallery-selection-frontend.log`, `gallery-selection-frontend-run2.log`,
  `gallery-selection-frontend-run3.log`
- `gallery-selection-backend.log`, `gallery-selection-backend-run2.log`
- `gallery-selection-integration.log`, `gallery-selection-build.log`
- `gallery-selection-checkboxes.png`, `gallery-selection-main.png`
- `gallery-back-button.png`

Azure storage and production validation are excluded; local uploads use the
existing isolated storage directory. Mapbox remained live in browser checks.
No performance/capacity claim is made. Rollback may leave the nullable additive
column intact; older clients ignore it and display images using their old rules.

Repeat from the backend directory:

```powershell
./.venv-local/Scripts/python.exe scripts/check_gallery_selection.py
```

## Main-page Add image removal

The subsequent user request removes the separate Add image button below the main
gallery in both modes. Add New Image remains on the all-images page; the existing
empty-gallery tile is unchanged. Obsolete button CSS was removed.

The first 29-test run passed 28 cases but exceeded Jest's five-second timeout in
the existing eight-image selection/cancel case (30.814 seconds total). An unchanged
rerun passed all 29 in under ten seconds. Both outputs are retained as
`gallery-remove-main-add.log` and `gallery-remove-main-add-run2.log`. The timeout's
cause was not established; it is recorded as test-timing variability, not evidence
of a product failure or performance compliance. No new API/database changes.

## Numbered selection and cover (2026-10-04)

Selected images now have consecutive numbers inside the checkbox square itself,
as requested in the follow-up sketch. Unselected squares are empty. The real
checkbox remains keyboard accessible with visible focus and a labeled checked
state. View mode keeps the number visible while disabling changes.

GalleryImageIDs array order is authoritative for both gallery modes. Main-page
dragging and all-images arrows update those IDs and their displayed ranks.
Number 1 is labeled Card cover. Ordinary card thumbnails are synchronized to the
first surviving selected ID on selection saves and subsequent image mutations;
image-overlay cards retain their separate map representation. NULL remains the
legacy first-six selection, and empty selection retains existing image records.
New uploads append to an explicit selection when space remains.

Verification: 30 frontend tests and 11 backend contract tests pass. The new case
checks deselection, numbering inside the checkbox, main-page drag/drop, Slideshow
order, all-images arrows, cover labeling, and ordered JSON save. The guarded local
integration script saves a non-natural six-image order in both modes and checks
the database thumbnail, preservation after full-list reordering, invalid requests,
empty selection, and cleanup. No fixture records or uploaded files remain.
Read-only browser inspection confirmed five 24-by-24 pixel checkbox squares with
numbers inside matching input bounds; the user's existing page/draft was preserved.

The first new frontend case clicked a detached gallery node after returning from
all-images and failed; it now queries the rendered gallery after navigation.
An initial CI=true build rejected existing lint and postcss-calc warnings; the
normal local build rerun uses CI=false. Existing warnings remain outside this
change. Evidence: gallery-order-frontend.log, gallery-numbered-checkbox-frontend.log,
gallery-order-final-frontend.log, gallery-order-integration.log,
gallery-order-build.log, gallery-order-build-run2.log, and
gallery-numbered-checkbox.png in the evidence directory above.

## Compact all-images grid and sorting removal (2026-10-04)

The latest request removes all-images up/down controls and their handlers/styles.
The corresponding user-manual description/demo no longer advertises that feature.
Main-gallery dragging remains the ordering control and still updates checkbox
numbers. The all-images list uses an adaptive grid with 260-pixel minimum columns
and 190-pixel image regions; images remain contained and open the existing preview.
Numbered selection is placed below each thumbnail, preserving cover visibility
and separate bulk-deletion selection.

Thirty frontend gallery/Card checks pass, including absence of all-images sorting
buttons and preservation of main-gallery drag ordering and selection saves.
The first run began before the handler removal completed (the default python
command was unavailable); its new removal assertion failed. After executing the
removal with the existing backend Python runtime, the full rerun passed.
Both runs remain in gallery-compact-grid-tests.log and
gallery-compact-grid-tests-run2.log. Read-only browser measurement confirmed
three columns, approximately 304 pixels each, and five 190-pixel image regions.
gallery-compact-grid.png shows the user's existing editing page without changing
its draft. This is a frontend-only change; no database/storage mutation or new
backend test run was necessary. Development compilation and diff checks pass.

## Total image cap raised to 30 (2026-10-04)

The latest request increases the per-card total from eight to thirty, while
preserving the six-image main-page selection cap. Frontend upload availability
and help text use MAX_CARD_IMAGES=30. Backend creation validation uses the same
backend constant as single/batch upload reservation, including the row lock and
updated overflow message. No schema migration is needed. The local backend was
restarted so the running app enforces the updated limit immediately.

33 frontend checks and 11 backend contract checks pass. Frontend cases confirm
upload availability at eight and twenty-nine, disabled at thirty, and six selected
images regardless of total count. Backend cases cover the thirtieth image, a batch
reaching thirty, and single/batch rejection before storage at thirty-one.

The guarded local integration script creates a dedicated fixture with eight
images, uploads one more through the single endpoint and twenty-one through the
batch endpoint, and verifies thirty records. Both endpoints reject image 31 with
422 and the updated message. Existing selection/order/cover checks pass with all
thirty images; cleanup confirms no fixture records/files remain. Evidence:
gallery-30-limit-frontend.log and gallery-30-limit-integration.log in the existing
evidence directory. No production storage, deployment, or load test was used.

## Selection overlay, vacant ranks, and back icon (2026-10-04)

The Back button uses Font Awesome's arrow-left at one em, with its icon hidden
from the accessibility name. Its user-manual demo uses the same icon.
Numbered selection labels now overlay the thumbnail at its bottom, using a 65%
opaque background and 72% opaque text. They no longer consume an extra footer row.

Editing keeps vacant rank slots: clearing number five leaves number six intact,
and the next newly selected image occupies five. Multiple vacancies fill from
the lowest available number. Main-gallery dragging defines a new consecutive
ordering. Save sends only selected image IDs, removing unfilled slots; saved
rank numbers are consecutive. Cancel restores the saved selection. Uploads fill
available slots without displacing selected images or exceeding six.

34 frontend checks pass, including the exact five-to-new-image scenario, unchanged
six, icon rendering, main-gallery order, ordered JSON save, cancel, and uploads.
Read-only browser measurements confirm all seven labels fit inside 190-pixel
image regions; the entire tile is approximately 192 pixels high including its
border. The screenshot preserves the user's current draft and shows the changed
icon and transparent overlays. Evidence: gallery-overlay-vacancy-tests.log and
gallery-overlay-vacancy.png. Backend selection validation is unchanged; null
vacancies exist only in the editing draft and are excluded from saved JSON.

## Square thumbnails and top actions (2026-10-04)

All-images tiles now have a 1:1 aspect ratio and contain each image without
cropping. The bottom overlay contains only the numbered checkbox. Cover context
remains in its tooltip; the selected tile uses a gray-blue border and soft outer
ring, while an unselected tile retains the ordinary border. Main selection remains
separate from bulk-deletion selection.

Bulk-selection buttons use a light circular surface, subtle border/shadow, faint
check icon when unselected, and a filled gray-blue state with a visible check when
selected. Hover/focus and opacity/scale transitions replace the plain dark dot.
Delete Selected and Add New Image moved into the header alongside Back to Learn
More. The header wraps on narrower windows. A specific margin override removes
the generic modal button rule's five-pixel top margin so all three align exactly.

34 frontend checks pass, including selection-border state changes, number-only
labels, bulk-selection check/pressed state, enabled delete count, and both action
buttons within the header. Browser measurements show seven square tiles at
approximately 304x304 pixels, six selected borders and one ordinary border, and
identical header-button vertical centers. The user's draft was preserved; only
keyboard focus was moved to bring the header into view. Evidence:
gallery-square-tests.log, gallery-square-tests-run2.log, gallery-square-controls.png.
This change does not modify backend/database behavior. Development compilation
and diff checks pass.

## Edit-only indicators and Font Awesome tile tools

All-images numbered checkboxes and selected borders now render only in edit mode.
Main-gallery cover border/badge also render only in edit mode, for both Multiple
images and Slideshow. Both pages share one CSS rule for the gray-blue border,
ten-pixel corners, and soft outer ring. Selection/order persistence is unchanged.

Main-gallery tile tools use Font Awesome arrow-left, grip-vertical, arrow-right,
and xmark icons at 12 pixels, preserving button labels, disabled states, drag
behavior, and deletion handlers. Browser inspection confirmed all four SVG icons
and no character text in each of five toolbars. The user's existing draft was
preserved. The computed cover border, radius, and shadow match the shared rule.

36 frontend gallery/Card checks pass. New cases exercise viewing/editing cover
visibility in both modes, absence of all-images checkboxes after save, and the
four icons alongside existing reorder behavior. Initial runs failed because the
test treated disappearance of Save during an asynchronous save as completion;
it now waits for checkbox removal after saving finishes. Failure logs remain
gallery-edit-only-tests.log and gallery-edit-only-icons-tests.log. Passing output
is gallery-edit-only-icons-tests-run2.log, and browser evidence is gallery-fa-tools.png.
No backend/database changes or production calls were needed.

## Main-gallery corner consistency

Removed the shared selected-state border-radius override. The main-gallery cover
now inherits the same zero-pixel corner radius as its neighboring tiles, while
all-images tiles retain their existing ten-pixel base radius. Selected border
color and shadow remain shared. Read-only browser measurement confirmed all five
main tiles have radius 0px. Evidence: gallery-matching-corners.png. This CSS-only
refinement passed diff checks and development rendering; no new logic tests were
needed.

## Layout controls below the gallery (2026-10-05)

Removed the gallery's upper editor panel. A small GalleryLayoutSelector component
now appears in the row with See all N images, only in edit mode. It preserves the
legacy-layout normalization, two available modes, busy state, and saved callback.
The six-image selection, cover, drag, and thirty-image-total instructions now
appear in the all-images page's existing hint rather than above the main gallery.
The responsive gallery/slideshow height increases from a 240–340px range to
280–380px, giving each two-row tile approximately twenty extra pixels on desktop.

36 frontend checks pass, including mode switching, saved layout, cancel, legacy
mode handling, and standalone selector options. Browser verification confirmed
the old editor is absent, gallery height is 380px, and See all/selector centers
align. It also confirmed the instructions in all-images. The existing card was
not saved; browser verification returned to its original viewing state.
Evidence: gallery-bottom-layout-tests.log and gallery-bottom-layout.png.
Development rendering and diff checks pass; backend behavior is unchanged.

## Four-column refinement (2026-10-04)

The latest CSS-only request sets four equal columns in the all-images grid.
Square aspect ratios and existing selection controls are preserved. Viewports
below 800/600/380 pixels use three/two/one columns respectively. Read-only browser
measurement confirmed four tiles on the first row, each approximately 225x225
pixels (previously approximately 304x304). Development rendering and diff checks
pass. Evidence: gallery-four-columns.png in the existing evidence directory.

## Neutral card-cover badge (2026-10-05)

Changed the Learn More card-cover badge from blue/white to the modal's slate
palette: background #e2e8f0, text #334155, border #cbd5e1. The existing `editing`
condition remains authoritative for badge visibility. All 18 LearnMoreGallery
tests passed, including multi-image and slideshow cases that verify the cover
mark is present only while editing. `git diff --check` passed. Browser inspection
did not reach the modal during this follow-up, so visual verification of the new
badge color is not claimed. No card data was saved.

## Point coordinates in Representation (2026-10-05)

Removed point/multipoint latitude and longitude inputs from the Learn More edit
fields grid. Moved the read-only coordinate display into the shared Representation
preview, including view mode, with explicit Latitude/Longitude labels. Point-count
details and the existing Edit Coordinate tool remain. Nullish values display N/A;
zero coordinates remain visible. Polygon/image previews are unaffected.

Added point and multipoint component checks for the new location, zero latitude,
absence of inline coordinate inputs, and retained Edit Coordinate button. All 20
Card.gallery tests passed, including existing point/multipoint/polygon/image editor
regressions. Existing asynchronous React `act` warnings appeared in the suite.
Browser confirmed zero coordinate inputs and correct values in Representation;
reviewed `representation-coordinates.png` in the task evidence directory. No draft
was saved or canceled. `git diff --check` passed; no backend changes or deployment.
