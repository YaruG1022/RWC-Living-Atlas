# Main-page gallery selection

Date: 2026-10-04 (America/Los_Angeles). Baseline: 7bf62b5 plus the working changes
recorded here. Scope: select up to six images for Learn More's main gallery while
retaining eight total images and the separate image-deletion controls.

The all-images page has a labeled checkbox for every image. Edit mode permits
selection changes; view mode displays the saved selection read-only. Multiple
images automatically arranges the selected images; Slideshow uses the same set.
The layout menu contains only these two modes. Old grid/featured values render
as Multiple images without removing records. Saved order and card-cover identity
remain independent of main-page visibility. Preview/reorder callbacks map the
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
