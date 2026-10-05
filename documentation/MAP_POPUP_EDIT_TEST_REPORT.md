# Map popup editing verification

Date: 2026-10-04 (America/Los_Angeles).

Scope: add an Edit action to the shared card popup used by point, multipoint,
polygon, and image-overlay representations. Open the existing matching map tool
with the card's data, preserving owner/admin checks and the existing Save/Cancel
workflow. No backend changes, database writes, deployment, or load tests.

The popup action uses the existing card-open event with an explicit edit-location
flag. The Card initializes its protected draft before opening CoordinatesPanel or
PolygonDrawingModal. Stable card-ID React keys preserve the draft if closing a
popup changes list order. The Edit action is a sibling of the details action, so
it does not create nested interactive elements.

27 gallery/Card tests pass. New cases cover all four representation types,
existing vertices and multipoint marker styles, cancel returning to an editable
card, and rejection for a non-owner. They assert no save requests during opening
or cancellation. Geometry editor internals are mocked in these component tests.

Actual browser verification used a separate local tab with the card panel hidden:
clicking the test 2 multipoint popup's Edit action opened Add Points with its
existing coordinates (46.397308, -117.017935). Cancel returned to Learn More edit
mode. No card fields were changed or saved. The first browser attempt exposed
request clearing when the popup was closed before dispatch; dispatch now occurs
first, and the editor closes the popup after its draft has opened. The final
browser run passed. Polygon/image routing was verified by component tests, not
by writing new real shape fixtures. Mapbox remained live; cloud storage excluded.

Evidence directory:
`C:/Users/yarug/.codex/visualizations/2026/10/05/01a109cf-a51e-71e3-9e03-71304bf43699/`

- `map-popup-edit-tests.log`, `map-popup-edit-tests-run2.log`: 27 passing tests.
- `map-popup-edit-button.png`: popup action.
- `map-popup-coordinate-edit.png`: populated coordinate tool.
- `map-popup-edit-build.log`, `map-popup-edit-build-run2.log`: frontend builds.

The dedicated local app uses localhost:3000 and localhost:8000 with
LOCAL_TEST_MODE=1 and the existing livingatlas_test database on 127.0.0.1:5433.
This frontend-only verification created no test rows or uploaded files.
