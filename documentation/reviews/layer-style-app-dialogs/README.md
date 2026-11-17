# Layer rows and app dialogs

Date: 2026-11-16 (America/Los_Angeles). Base: `c1de699b11491e6018cd15ad3987d4dbaa48ddac`.
Product commits: `fe9f85d`, `08f7003`, `c4fdc7e`.

## Requested behavior

The browser comments request matching Built-in Layers rows to layers inside state folders, replacing New Folder's browser prompt with a dialog matching the panel, and doing the same for the app's other browser popups. The user authorizes pushing, opening a PR, checking it and merging after checks.

Acceptance criteria:

- Built-in rows use the shared compact layer-row style, preserving checkboxes, legends, loading/retry, search highlighting and information buttons.
- No executable `alert`, `confirm` or `prompt` calls remain in application source.
- Folder creation accepts a unique name only after confirmation. Empty/duplicate names show inline errors. Cancel, close and Escape do not create anything.
- Destructive actions await confirmation and default focus to Cancel. Nested card dialogs remain accessible; closing restores the invoking button's focus.
- Multiple messages retain their order. Manual, onboarding, update dialog and history match the new controls.

## Environment and results

Functional UI change only. No backend, schema, service-address or production-configuration changes. Tests mock writes. Browser checks use `http://localhost:3000`, API `http://localhost:8000`, isolated PostgreSQL `127.0.0.1:5433/livingatlas_test` and `LOCAL_TEST_MODE=1`. The existing five local cards remain unchanged. Browser checks cancel folder creation and destructive actions; no generated records require cleanup.

| Check | Workload and success criterion | Result |
| --- | --- | --- |
| Component regressions | Nine suites, 98 unique assertions: dialog queue/results, validation, nested ReactModal accessibility, folders, cards/gallery/close protection, uploads, layer info, manual and release history | Passed across targeted runs |
| Manual export contract | `node --test scripts/export-manual.test.cjs`; reproducible bundle/checksums | 1 passed |
| Manual export | `node scripts/export-manual.cjs` | 21 chapters, 347 blocks |
| Production bundler | `CI=false node node_modules/react-scripts/bin/react-scripts.js build` | Passed with existing lint/CSS/bundle-size warnings. A new redundant-role warning was removed; the two new modules pass ESLint. Full postbuild manual capture is deferred to CI because local packaged Chromium dependencies are absent. |
| Source audit | Parse every non-test JavaScript file and inspect executable call expressions | Zero native JavaScript dialogs |
| Browser: Built-in Layers | Inspect all six compact rows, labels, checkboxes, swatches and information buttons | Passed; [screenshot](builtin-layers.jpg) |
| Browser: New Folder | Open, submit empty name, inspect error, Shift+Tab, Escape and Cancel | Passed; input initially focused, top-layer modal active, focus restored; [screenshot](new-folder.jpg) |
| Browser: nested confirmation | Open a local card, choose Delete project, then cancel | Passed; Cancel initially focused, card preserved, focus returned to Delete project; no deletion |
| Whitespace | `git diff --check` | Passed |

Targeted test command, from `LivingAtlas1-main/client`:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/AppDialogHost.test.js src/CustomLayersPanel.test.js src/BuiltinLayerRow.test.js src/Card.close.test.js src/Card.gallery.test.js src/Card.location.test.js src/FormModal.test.js src/Changelog.test.js src/UserManual.test.js
```

Raw fixture-only Jest results are ignored under `LivingAtlas1-main/backend/.local-postgres/`: `ui-dialog-tests-first-run.json`, `ui-dialog-manual-tests.json`, `ui-dialog-host-final.json`. CI runs the entire frontend suite and complete production build, including offline manual screenshots, on the PR.

## Failures and corrections

1. Initial run: 87/88 assertions passed. A gallery test expected synchronous removal after confirmation. It now waits for the visible result of the asynchronous dialog; all 37 gallery assertions then passed.
2. The expanded run passed 90 assertions but could not load UserManual: the direct Node command omitted the existing npm script's Axios transformation option. Retrying with `--transformIgnorePatterns` passed all eight manual assertions. No application workaround was added.
3. Browser check: closing a disconnected HTML dialog did not restore focus. The host now closes it before resolving/removing the request. Escape and Cancel were retested.
4. Browser check: rendering inside `#root` inherited ReactModal's `aria-hidden` while a card was open. The host now portals to `document.body`; real-browser cancel and nested-modal regression checks passed.

## Limits and release impact

Mapbox tiles were live during inspection. ArcGIS availability, Azure storage, model-provider calls, load, latency percentiles and production capacity were not evaluated. Performance metrics are not applicable to these assertions. Browser checks used desktop Chromium, not a cross-browser/device matrix. JSDOM shims only the missing HTMLDialogElement `showModal`/`close` methods; real-browser checks cover top-layer behavior, keyboard navigation and focus return.

This frontend change can be reverted without data migration. Complete CI and production publication evidence belong to the linked PR; a local build alone does not establish deployment success.
