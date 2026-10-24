# Local test environment

[en-US](LOCAL_TESTING.md) · [es-ES](LOCAL_TESTING.es-ES.md) · [zh-CN](LOCAL_TESTING.zh-CN.md)

Use this isolated setup before registration or data-load tests. The test database
is `livingatlas_test` on `127.0.0.1:5433`. The local database files and passwords
are ignored by Git.

## Initial setup (Windows PowerShell)

From the repository root, run:

```powershell
& .\LivingAtlas1-main\backend\scripts\create_local_postgres.ps1
```

This creates an empty PostgreSQL 17 cluster, the test database and schema,
`backend/.env.local`, and `client/.env.development.local`. It refuses to replace
existing local data or settings. If PostgreSQL is installed elsewhere, edit
`$pgBin` in the script before running it.

The frontend development environment sets `REACT_APP_API_URL=http://localhost:8000`.
The backend loads `backend/.env.local` before connecting and checks that local
test mode targets only the loopback host and `livingatlas_test` database.

## Start the backend

From `LivingAtlas1-main/backend`, create a Python 3.12 virtual environment,
install the backend dependencies, and start the API:

```powershell
py -3.12 -m venv .venv-local
& .\.venv-local\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv-local\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/` and `http://127.0.0.1:8000/allCards`.
The root route alone does not verify the database; `/allCards` exercises a query.

## Start the frontend

From `LivingAtlas1-main/client`, run `npm start`, then open
`http://localhost:3000`. Restart the dev server after editing an env file.

The chatbot uses a separate service and is outside this local database setup.
External ArcGIS and Mapbox services may still be contacted by map features.

## Local uploaded images and files

With `LOCAL_TEST_MODE=1`, images, thumbnails and attachments are stored under
`backend/uploads/local_test/` and served by the local backend at `/uploads/local_test/`.
No Azure connection string is needed for local uploads. This directory is ignored
by Git. Local deletion removes only files in this directory; referenced remote
Azure files are left untouched. Hosted mode continues to use Azure Blob Storage.
Restart the backend after changing storage code or environment settings.

## Stop and restart PostgreSQL

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data stop
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D .\LivingAtlas1-main\backend\.local-postgres\data -l .\LivingAtlas1-main\backend\.local-postgres\server.log -o '-p 5433 -h 127.0.0.1' -w start
```

Do not point load scripts at production. Test registrations will remain in this
local database until the test data is deliberately cleared.

## Large images and display framing

Install the backend requirements, including `Pillow` and `pyvips[binary]`. The
binary extra bundles libvips, so no system libvips package is required on supported
Linux/macOS/Windows wheels. Restart the backend to apply migration
`010_add_image_presentation.sql` before deploying the new client.

Gallery images accept originals up to **50 MiB / 160 megapixels**. A streaming
libvips pipeline generates an uncropped, EXIF-oriented WebP display image with a
maximum edge of 4096 pixels. Originals are retained byte-for-byte under a separate
URL. BMP uses a bounded Pillow fallback (40 MP for compressed BMPs). Animated
GIF originals remain available; the gallery derivative represents the first frame.
These are application limits, not a guarantee about a hosting provider's request
limits. Files are uploaded sequentially to avoid enormous multipart batches.

`POST /imagePreview` generates a transient display image without saving blobs or
creating a project. Modest PNG/JPEG originals (up to 12 MP with bounded dimensions)
can generate a local preview on a small canvas. Create Project sends larger or
unfamiliar images to this endpoint, avoiding original-sized browser decoding. `POST /uploadCardImage` stores the original and derivative and
accepts an optional `upload_token`; retries with that token return the existing
image. Preview and image uploads disable the Axios automatic network retry;
explicit per-image retries retain their token. Failed files remain in the UI.
Creating a project with images uses `defer_images=true`, then uploads each file;
retrying a failed image does not create another project.

Per-image `presentation` stores `fit` (`cover` / `contain`), normalized `x` and `y`
(0–100), and `zoom` (1–3). Adjustments stay in the edit draft until Save. The
`image_presentations` field on `/uploadForm` validates that every image belongs to
the current project and commits framing with its metadata. Existing images
without metadata default to centered Fill. The full-image viewer ignores framing
and offers an original-file link. Deleting an image removes both files.

Local checks (no Azure credentials):

```sh
python -m pytest tests/test_image_processing.py tests/test_gallery_layout.py -q
python -m scripts.check_image_workflow
```

The processor regressions include a 50,000px-wide image, a 144 MP RGB image,
files over the previous 10 MiB cap, all advertised formats, transparency, EXIF
orientation, and clear rejection of corrupt or over-limit originals. The workflow
check uses only the guarded local test database and cleans up all its fixtures.
