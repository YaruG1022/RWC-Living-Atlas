# Description link and attachment insertion

Date: 2026-10-11. Baseline: `e5cc3c8`, branch `codex/compact-card-list`.

Scope: the shared TipTap description toolbar, create/edit draft attachments, persisted description file references and download responses. Exit criteria: links insert/edit/remove without losing text; multiple selected files retain distinct references and order; saved references resolve to the uploaded file IDs; existing attachment links use the configured API host; fixture data is removed. No performance claims or load tests.

Implementation: StarterKit's existing Link extension supplies link formatting; the inline panel preserves the text selection while its inputs have focus. New attachments remain in the card's normal draft upload queue. A per-file token manifest accompanies `/uploadForm`, which validates missing/duplicate tokens before database writes and resolves draft links after upload. Saved relative download references are expanded to the current backend only at display time. No dependency or database migration was added.

Environment: Windows; frontend `http://localhost:3000`, development API `http://localhost:8000`; backend `LOCAL_TEST_MODE=1`, PostgreSQL `127.0.0.1:5433/livingatlas_test`. The integration script asserted isolation and queried the database. Storage used local files; Azure was excluded. Mapbox remained live during browser inspection and is outside this change's assertions.

## Evidence

- Frontend: `node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/RichTextEditor.test.js --silent`: 4 passed. Covers unsafe URL rejection, insertion, editing/reopening/removal, existing attachments, multiple file order and token serialization. Adjacent `Card.gallery.test.js` and `LearnMoreGallery.test.js`: 40 passed in the combined run.
- Backend: `.venv-local/Scripts/python.exe -m unittest discover -s tests -p 'test_description_attachments.py'`: 4 passed; `test_attachment_download.py`: 5 passed. Includes missing/duplicate/malformed manifests, backward compatibility and download responses.
- Integration: with `PYTHONPATH=.`, `.venv-local/Scripts/python.exe scripts/check_attachment_download.py`: passed. Two uniquely prefixed TXT files, including a Unicode filename, uploaded into one temporary card; the database held two correct download references and no draft tokens. Both downloads returned attachment responses and ZIP contents matched the original bytes. Legacy storage-link recovery and missing-file 404 also passed. Cleanup queried zero fixture card/file rows and confirmed local fixture blobs were removed.
- Browser: a separate localhost tab's create-card form visibly showed Link/File toolbar controls, inserted `Example reference`, and displayed the multiple-file panel. No card was submitted and the user's original edit tab was preserved. Screenshot: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/description-insert-toolbar.png`.
- Frontend optimized build passed with the existing lint, Browserslist, bundle-size and `cqw` minimizer warnings. `git diff --check` passed.

## Failures and corrections

The first editor run failed because Jest's environment lacked `crypto`; the test fixture now supplies UUID generation. The next run exposed that `unsetLink()` removed the inserted link itself; clearing only future stored marks fixed it. The expanded edit test exposed that selection JSON uses anchor/head while `setTextSelection` expects from/to; preserving the latter fixed replacement and file insertion order. The removal test was adjusted to reopen the saved editor, since insertion deliberately clears future link marks at the end cursor. Final editor assertions passed, including absence of the replaced original text.

Limits: browser file chooser upload was not repeated; selection and draft queuing were exercised with real TipTap component tests, then storage/persistence/download with the local integration script. Hosted Azure, preview and production validation were not performed. Existing uploads remain ZIP downloads. Removing a queued file while retaining its description link produces a recoverable 422 until the stale link is removed or the file is selected again. Existing attachment deletion can invalidate a description reference, as with other previously saved links.
