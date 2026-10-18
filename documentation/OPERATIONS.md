# Deployment and maintenance runbook

Use this runbook for planned releases, recovery, and maintainer handoff. Record
the actual hosting resources and evidence in the release or a restricted operator
record. Configuration in Git describes intent; it does not prove what is deployed
or which backup features a hosting plan includes.

## Service inventory and access

| Component | Repository evidence | Verify before operating |
| --- | --- | --- |
| Frontend | Root [`netlify.toml`](../netlify.toml): React build in `LivingAtlas1-main/client`, Node 22.17.0, SPA routing | Netlify team/site ID, production domain, deployment branch, deploy ID and full Git SHA |
| Atlas API | [`backend/main.py`](../LivingAtlas1-main/backend/main.py): FastAPI/Uvicorn, port from `PORT`; [`src/api.js`](../LivingAtlas1-main/client/src/api.js): `REACT_APP_API_URL` or the default Render origin | Actual Render service ID, root directory, Python build/start commands, health check, deployed SHA and API origin |
| Database | [`backend/database.py`](../LivingAtlas1-main/backend/database.py): PostgreSQL connection and startup schema changes | Provider/resource ID, PostgreSQL version, region, storage, connection limit, backup retention and recovery access |
| Uploaded assets | [`azure_storage.py`](../LivingAtlas1-main/backend/endpoint_files/azure_storage.py): hosted Azure Blob Storage; default container `images` | Account/container, protection settings, backup destination, retention, and all images/files referenced by the database |
| Chatbot | `REACT_APP_CHATBOT_API_URL` in Netlify config; separate [chatbot repository](https://github.com/YaruG1022/RWC-Living-Atlas-Chatbot) | Render service/SHA, Pinecone index and active manual version; use its own release process |

The root [`render.yaml`](../render.yaml) currently describes a generic Node service
and free database, while the Atlas API is Python. Do not apply that Blueprint as a
production recovery procedure. Reconcile it with the actual services in a separate
reviewed change before relying on it for provisioning.

Keep a restricted access register with primary and backup maintainers, account
ownership, recovery methods, secret-store locations, and permissions for GitHub,
Netlify, Render, PostgreSQL, Azure, email, Mapbox, and chatbot providers. Record
variable names and rotation dates rather than secret values. Frontend `REACT_APP_*`
values are public build inputs; never put privileged credentials there.

The API uses `DATABASE_URL`, or `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`,
`DB_PORT` and `DB_SSLMODE`. Hosted storage needs `AZURE_STORAGE_CONNECTION_STRING`
and optionally `AZURE_CONTAINER`/`AZURE_ACCOUNT`. Account email integration uses
Resend/SendGrid configuration in [`backend/account.py`](../LivingAtlas1-main/backend/account.py).
Check the deployed configuration before changing providers or rotating credentials.

## Release preparation

1. Select the release commit and tag. Record frontend, API, and chatbot SHAs
   separately if they do not deploy together. A GitHub Release does not confirm a
   successful deployment.
2. Pass the required PR checks and review the release notes, known limitations,
   configuration changes, schema changes, and rollback target.
3. Test on isolated staging resources: a separate database, asset container and
   integration credentials. A Netlify preview must point to staging through
   `REACT_APP_API_URL` and, if enabled, `REACT_APP_CHATBOT_API_URL`; rebuild after
   changing those values. Verify CORS for the intended origin.
4. Confirm a restorable database backup and matching asset protection before an
   API deployment that changes schema or stored data. Record backup time and ID,
   recovery owner, expected data-loss window (RPO), and expected restoration time
   (RTO). These targets must be agreed and measured; none is guaranteed by Git.
5. Check provider deployment settings. If merges auto-deploy, complete backup and
   schema preflight **before** merging the API change. When independently deploying
   components, establish compatible versions and deploy in the reviewed order.

## Database migrations

Importing `database.py` connects to PostgreSQL and runs `_ensure_schema()`; starting
the API can change schema and backfill data. Schema history also exists in
[`database/migrations`](../LivingAtlas1-main/database/migrations), and
[`migrate_to_multi_image.py`](../LivingAtlas1-main/backend/migrate_to_multi_image.py)
is a separate data migration. These are not a single versioned migration runner.
Do not run every historical SQL file or initialize production with the local-test
schema.

For a schema-changing release:

1. Review the exact SQL in the candidate commit, including startup changes. Check
   required tables/columns, constraints, historical duplicates, lock duration,
   data volume, privileges, and compatibility with the previous API.
2. Restore a recent backup to an isolated database and rehearse the candidate
   startup and any explicitly required script. Check row counts, relationships,
   card galleries, attachments, and existing accounts; record duration and logs.
3. Plan a maintenance window or write pause if locks, backfills or backup
   consistency require it. Capture the production backup reference before rollout.
4. Start the candidate against the intended database only. Review startup logs
   for `[MIGRATIONS] Schema is up-to-date.`, errors, and warnings about deferred
   signup unique indexes. A running HTTP process alone does not verify the schema.
5. Run the read checks below and close the migration record with results. Prefer
   additive schema changes; remove old columns only after all deployed code and
   the rollback target no longer need them.

## Backups and restore drills

Agree a backup schedule and retention based on RPO/RTO. Check provider dashboard
settings and successful backup history regularly. Enable point-in-time recovery
where the selected plan supports it, and document its actual retention window;
do not assume a free database includes it. Retain encrypted logical backups in a
separate access-controlled location as appropriate to the recovery plan.

Example logical backup using an operator-configured PostgreSQL service entry
(`PGSERVICE`/`.pg_service.conf` and a protected password file, outside Git):

```bash
pg_dump --dbname='service=atlas_backup' --format=custom --no-owner --no-acl --file=atlas-backup.dump
pg_restore --list atlas-backup.dump > atlas-backup.contents.txt
```

Use PostgreSQL client tools compatible with the server. Protect dumps as production
data; an archive listing confirms readability, not restorability. Record completion,
size, checksum, storage location and retention without exposing connection strings
or user data in public Issues/Actions artifacts.

Back up uploaded Azure blobs independently: database dumps contain URLs, not image
or attachment bytes. Verify supported blob versioning, soft delete and independent
copies against the recovery plan. Record container paths and a reference inventory
so restored database URLs can resolve to the matching assets. Protect configuration
and deployment metadata separately; rotate credentials through the secret store.

At least before relying on a new backup mechanism, and thereafter on the agreed
schedule, perform a restore drill:

1. Provision an empty isolated PostgreSQL database and separate asset container.
   Disable outgoing account email and other production writes in the drill setup.
2. Restore the selected archive or provider recovery point there. Recreate required
   roles/extensions separately as needed; the example dump omits owners and ACLs.
   For an operator-configured service pointing **only** at that empty database:

   ```bash
   pg_restore --dbname='service=atlas_restore_drill' --no-owner --no-acl --exit-on-error atlas-backup.dump
   ```

3. Restore matching assets, configure the isolated API, then verify counts,
   representative cards, polygon coordinates, galleries and attachment checksums.
   Inspect startup migrations before launching a newer API against the restored DB.
4. Measure achieved RPO/RTO, record failures and follow-up Issues, and clean up only
   the temporary resources identified for that drill. Never rehearse restoration
   by overwriting the live database.

## Deployment verification

Record UTC deployment time, release tag, full commit SHA, frontend deploy ID,
API deploy ID, schema/backup references, operator and results in the release record.
Confirm the SHA in each provider dashboard rather than inferring it from `main`.

Use a few read requests and normal browsing for production smoke checks:

- Open the frontend `/`, `/user-manual` and `/update-history`, including direct
  navigation to verify SPA routing. Confirm map/card browsing and an existing
  public gallery or attachment without submitting changes.
- Request API `/`, then `/allCards?limit=1` and `/getMarkers?limit=1`; check HTTP
  status, expected JSON structure and application logs. The API root returns a
  static response and does not prove database readiness. The mounted Atlas API
  does not currently define a dedicated `/health` route.
- Fetch frontend `/manual/current.json` as JSON. Compare its `revision` with the
  deployed frontend SHA, then verify the referenced manifest/checksums using the
  existing manual pipeline. An HTTP 200 containing SPA HTML is a failure.
- Verify the separate chatbot service and active manual version using its runbook.
  Chatbot health does not prove the correct manual has been indexed. Real model
  evaluation consumes provider quota; keep it separate from basic HTTP checks.

Run registration, reset-email, upload/edit/delete and load tests only in the
isolated test/staging environment with disposable data. Do not use production
smoke checks to create accounts, send notifications or alter existing cards.

## Manual/chatbot synchronization failures

The workflow [`notify-chatbot-docs.yml`](../.github/workflows/notify-chatbot-docs.yml)
validates/builds the app, then waits for the exact deployed manual before dispatching
chatbot sync. Inspect the latest run and its failing step; record its URL in a
maintenance Issue. A green build with a failed `notify` job means deployment or
synchronization still needs investigation.

Check that Netlify published the expected SHA, `ATLAS_MANUAL_BASE_URL` is the correct
HTTPS origin, and `/manual/current.json` matches the candidate. Then rerun the
appropriate workflow for that commit. Do not edit the marker to force a match.
`CHATBOT_DISPATCH_TOKEN` is optional: without it, the workflow verifies publication
only and the chatbot's separate scheduled sync must be checked. A successful
dispatch is not proof of completed import. Follow
[`MANUAL_KNOWLEDGE_PIPELINE.zh-CN.md`](MANUAL_KNOWLEDGE_PIPELINE.zh-CN.md) to inspect
the chatbot workflow and active pointer; failed imports retain the previous one.

## Rollback and incidents

1. Record symptoms, start time, affected versions and provider/Actions log links.
   Avoid copying personal data or secrets into public Issues. Establish one operator
   for deployment and manual-pointer changes to avoid concurrent recovery actions.
2. For a frontend-only regression, publish the previous known-good Netlify deploy
   or a reviewed Git revert. Verify its API and manual compatibility and record the
   actual deployed SHA; do not retarget an existing release tag.
3. For an API regression, redeploy the previous known-good commit **only after**
   checking it supports the current schema and data. Reverting source does not undo
   startup DDL or data migrations. Prefer a compatible forward fix when rollback
   would require data loss or destructive schema reversal.
4. If data restoration is necessary, pause application writes, preserve the failed
   state for diagnosis, restore to a new isolated resource first, verify DB/assets,
   and plan a controlled connection switch with the recovery owner. Account for
   writes since the recovery point and reconcile them before resuming service.
5. Coordinate app/manual rollback with the chatbot's serialized rollback procedure
   in the linked pipeline guide; never switch its active pointer concurrently.
6. Repeat smoke checks, record recovery time and remaining data impact, then create
   follow-up Issues with owners and acceptance criteria.

## Maintainer handoff

Demonstrate a staging deployment, backup restore and rollback with the incoming
maintainer. Transfer access through provider invitations and the secret manager,
verify billing/recovery ownership and MFA, and rotate or revoke credentials when
access changes. Keep the service inventory, tested recovery dates, open incidents,
release instructions and dependency-update responsibilities current.
