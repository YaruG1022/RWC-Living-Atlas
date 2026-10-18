# Repository workflows

`ci.yml` runs on every pull request, on pushes to `main`, and manually. Its stable
checks are `Frontend regression`, `Backend offline regression`, and
`PostgreSQL integration`; use these names in the `main` branch protection rule.
The frontend check runs every Jest suite, the manual exporter contract, and the
production build (including offline manual screenshots). Existing CRA lint
warnings remain visible; compilation errors fail the check.

The backend check installs the declared Python 3.12 dependencies and explicitly
runs the offline storage, download, description-attachment, and gallery suites.
It does not discover historical live-database or Azure integration tests. The
PostgreSQL check creates a fresh PostgreSQL 17 service, initializes the same base
schema as local testing, and exercises actual startup migrations, public/private
card reads, concurrent signup ID allocation, duplicate-email handling, and repeat
migration safety. It needs no repository secrets and forbids outbound HTTP.

To reproduce the database check, start an **empty, disposable** PostgreSQL 17
database named `livingatlas_test` on a loopback port, then run from
`LivingAtlas1-main/backend` after installing `requirements.txt`:

```sh
CI_POSTGRES_TEST=1 LOCAL_TEST_MODE=1 DATABASE_URL='' \
DB_HOST=127.0.0.1 DB_PORT=5433 DB_NAME=livingatlas_test \
DB_USER=postgres DB_PASSWORD=ci-local-only DB_SSLMODE=disable \
DB_REQUEST_POOL_SIZE=4 python scripts/check_ci_postgres.py
```

Use your disposable instance's password/port. The script rejects populated
databases and leaves synthetic fixtures behind; discard the instance afterwards.
The former nested `LivingAtlas1-main/.github/workflows/main.yml` was removed:
GitHub only discovers workflows in the repository-root `.github/workflows`.

## Manual publication

`notify-chatbot-docs.yml` validates the shared manual, component regressions and production build on PRs and main. The build captures versioned manual screenshots; artifacts contain both the release marker and full generated package.

Only main/manual publication runs wait for the exact deployed app/text revision and matching screenshot inventory. The importer validates the deployed content-addressed image catalog, so browser/font differences between builds do not masquerade as an app revision mismatch. Failed/cancelled app deploys never dispatch.

`CHATBOT_DISPATCH_TOKEN` (target repository Contents write) enables immediate `atlas-manual-published` dispatch. Without that optional secret, publication is still verified and the chatbot’s serialized scheduled sync reconciles the published marker. Override `ATLAS_MANUAL_BASE_URL` / `CHATBOT_REPO` repository variables for forks. Do not put tokens in files or event payloads.

Legacy `atlas-docs-changed` notifications and handwritten-document drift issues are retired. Maintenance/configuration/recovery: [manual pipeline](../../documentation/MANUAL_KNOWLEDGE_PIPELINE.zh-CN.md).
