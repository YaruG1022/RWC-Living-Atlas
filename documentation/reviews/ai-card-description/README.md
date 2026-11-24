# Card description drafting verification

On November 24, 2026, verification used Atlas main at `850004d` as the baseline, Atlas API change `2a80a8d`, Atlas frontend change `daf9a67`, and Helper change `69cb0ca`. The browser used a local frontend build configured for `http://localhost:8000`, with synthetic projects and intercepted API responses. Model calls used test doubles.

| Check | Result |
| --- | --- |
| Create Project and Learn More | Chrome filled a blank description on desktop and previewed the replacement for an existing Learn More description at 375 px. It verified the session header, draft link, card ID, and explicit **Use draft** action. |
| Frontend regression | All 289 tests passed across 44 suites. The focused editor and modal suites covered prepared image uploads, preservation of typed text, and abort on close. |
| Atlas API and source processing | 23 focused tests passed. They covered authorization, selected saved assets, images, files, public link redirects and limits, unreadable sources, and safe provider errors. The simulated route checked that generation did not write card data. |
| Atlas backend regression | In an isolated checkout, 83 passed and 6 skipped. The same 15 gallery tests failed on the baseline and feature branch. |
| Atlas Helper | 56 tests passed, including 13 for the new endpoint. They covered the shared token and configured text and vision request formats. |
| Manual export | The export validated 21 sections and 352 blocks. |
| PostgreSQL | Diagnostic SQL verified `livingatlas_test` on `127.0.0.1:5433`. An existing relation lock blocked the integration smoke test before any fixture insert. |

The first browser attempts timed out because the test initially targeted a collapsed Projects panel and then searched for a list row while the grid was active. The corrected run opened the panel and selected the actual project heading. The first build attempt used a Windows sandbox path containing an exclamation mark. Building into the workspace's ignored local test directory resolved that error. The frontend bundle still reports existing lint and CSS parser warnings.

The initial backend suite loaded the workspace's existing Azure test configuration. Its legacy suite created two synthetic test objects, deleted them, and verified both returned HTTP 404. Two image upload cases rejected the suite's `fake-png` fixture before upload. Both baseline and feature reruns used archive exports without cloud credentials.

The browser script is under `LivingAtlas1-main/backend/.local-postgres/description_browser_smoke.cjs`. To rerun the source tests, use `python -m pytest tests/test_card_description.py tests/test_card_description_links.py` from the Atlas backend and `python -m pytest tests/test_card_description.py` from the Helper. These checks used synthetic data. Hosted storage reads and throughput remain unmeasured.

## Live local verification

On November 24, 2026, Chrome used the Atlas frontend on port 3000 and sent generation requests through the Atlas API on port 8000 to Helper on port 8001. Atlas used PostgreSQL 17 at `127.0.0.1:5433/livingatlas_test` and local attachment storage. Atlas ran at `ee13745`. Helper ran at `70a0172` for the final image runs. The existing DeepSeek credential supplied `deepseek-flash` for both text and images. The browser intercepted unrelated external traffic, including map requests. The Atlas API read the public source page directly. [USGS watershed page](https://www.usgs.gov/water-science-school/science/watersheds-and-drainage-basins)

| Browser scenario | HTTP | Elapsed | Evidence in the draft |
| --- | ---: | ---: | --- |
| Add Card with the public link alone | 200 | 2.41 s | Explained that a watershed drains to a common outlet, with details on drainage divides and surface water. |
| Add Card with the link, a selected PNG and a selected PDF | 200 | 2.38 s | Explained the common outlet, read **Juniper Culvert** from the image, and reported **47 sediment samples** from the PDF. |
| Learn More with the link, a stored PNG and a stored PDF | 200 | 2.27 s | Explained the common outlet, read **Willow Gauge** from the image, and reported **83 sediment samples** from the PDF. |

Each successful response reported zero skipped sources. The Add Card draft filled the blank editor. Learn More kept the existing text during preview, applied the draft after **Use draft**, and the subsequent database-backed API read still returned the saved description. The browser sent no project mutation requests while generating.

The database audit confirmed the original description and the saved image and file IDs. Cleanup verified zero remaining fixture users, sessions, projects, attachments, images, and local blobs.

The first browser script invocation could not resolve its Playwright package. Selecting the installed Playwright runtime fixed the launcher. A minimal real image request then succeeded, but the initial Add Card request with all three sources returned 502 with no draft. DeepSeek vision requests now disable the provider's default thinking mode. Both mixed-source browser cases passed after restarting Helper with that fix. The Helper description suite passed 15 tests.

The temporary browser script and drafts generated from the synthetic inputs are in `LivingAtlas1-main/backend/.local-postgres/description-live/`. Run the script from the backend with `node .\.local-postgres\description-live\browser.cjs` after recreating the fixture account and project. The services read the shared token and existing provider credential from ignored local configuration files.
