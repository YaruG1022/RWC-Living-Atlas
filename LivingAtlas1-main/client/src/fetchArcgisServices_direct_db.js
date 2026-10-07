/* Direct-ingest ArcGIS services into Azure PostgreSQL (no backend HTTP)
   Usage (Windows CMD from client/src):
     1) npm i pg node-fetch@2
     2) set DATABASE_URL=postgres://<USER>:<PASS>@<HOST>:5432/<DB>?sslmode=require
        - or set PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT and PGSSLMODE=require
     3) node fetchArcgisServices_direct_db.js
*/

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Lazy import for node-fetch@2
const fetchDynamic = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function resilientFetch(url, opts = {}, { retries = 5, baseDelay = 500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetchDynamic(url, {
        ...opts,
        signal: controller.signal,
        headers: {
          'User-Agent': 'LivingAtlasFetcher/1.0 (+https://example.org)',
          'Accept': 'application/json',
          ...(opts.headers || {})
        }
      });
      clearTimeout(timeout);
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt < retries) {
          const backoff = baseDelay * Math.pow(2, attempt);
          await delay(backoff);
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt < retries && (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
        const backoff = baseDelay * Math.pow(2, attempt);
        await delay(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to fetch ${url} after retries`);
}

// REST server roots
const SERVERS = {
  WA: 'https://gis.ecology.wa.gov/serverext/rest/services/',
  ID: 'https://gis.idwr.idaho.gov/hosting/rest/services/',
  OR: 'https://navigator.state.or.us/arcgis/rest/services/'
};

const STATE_NAMES = { WA: 'washington', ID: 'idaho', OR: 'oregon' };

const OUTPUT_FILES = {
  WA: path.join(__dirname, 'arcgis_services_wa.json'),
  ID: path.join(__dirname, 'arcgis_services_id.json'),
  OR: path.join(__dirname, 'arcgis_services_or.json')
};

const SUPPORTED_TYPES = ['MapServer', 'FeatureServer', 'GeometryServer', 'GPServer', 'GeocodeServer'];

async function fetchServicesRecursive(baseUrl, currentPath = '', stateName) {
  const url = baseUrl + currentPath + (currentPath.endsWith('/') ? '' : '') + '?f=json';
  const res = await resilientFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const data = await res.json();

  let services = [];

  if (Array.isArray(data.folders)) {
    for (const sub of data.folders) {
      const subPath = (currentPath ? currentPath : '') + sub + '/';
      const subServices = await fetchServicesRecursive(baseUrl, subPath, stateName);
      services = services.concat(subServices);
    }
  }

  if (Array.isArray(data.services)) {
    for (const svc of data.services) {
      const nameParts = (svc.name || '').split('/');
      const serviceName = nameParts[nameParts.length - 1];
      const folderLabel = currentPath ? currentPath.replace(/\/$/, '') : (nameParts.length > 1 ? nameParts.slice(0, -1).join('/') : 'Root');

      if (SUPPORTED_TYPES.includes(svc.type) && serviceName) {
        services.push({
          key: `${(folderLabel || 'Root')}_${serviceName}_${svc.type}`.replace(/[^\w]/g, '_'),
          label: `${serviceName} (${svc.type})`,
          url: `${baseUrl}${currentPath}${serviceName}/${svc.type}`,
          folder: folderLabel || 'Root',
          type: svc.type,
          state: stateName
        });
      }
    }
  }

  return services;
}

// ---- DB logic (no schema creation) ----

function getPool() {
  const hasDbUrl = !!process.env.DATABASE_URL;

  if (hasDbUrl) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  const fromEnv =
    process.env.PGHOST &&
    process.env.PGUSER &&
    process.env.PGPASSWORD &&
    process.env.PGDATABASE
      ? {
          host: process.env.PGHOST,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE,
          port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
          ssl: { rejectUnauthorized: false }
        }
      : null;

  if (fromEnv) return new Pool(fromEnv);

  throw new Error("Set DATABASE_URL or PGHOST, PGUSER, PGPASSWORD, and PGDATABASE before running this tool.");
}

async function assertTableExists(client) {
  const { rows } = await client.query(`SELECT to_regclass('public.arcgis_services') AS t`);
  if (!rows[0] || !rows[0].t) {
    throw new Error(
      "Table 'arcgis_services' does not exist. Create it first using backend/sql/create_arcgis_services.sql"
    );
  }
}

async function bulkReplaceDirectDB(client, stateName, items) {
  const state = stateName; // 'washington' | 'idaho' | 'oregon'
  await client.query('BEGIN');
  try {
    await assertTableExists(client);

    await client.query('DELETE FROM arcgis_services WHERE state = $1', [state]);

    const chunkSize = 800;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      const values = [];
      const placeholders = chunk
        .map((it, idx) => {
          const base = idx * 6;
          values.push(it.key, it.label, it.url, it.folder || 'Root', it.type, it.state);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
        })
        .join(',');

      const insertSQL = `
        INSERT INTO arcgis_services (service_key, label, url, folder, type, state)
        VALUES ${placeholders}
        ON CONFLICT (service_key, state, type) DO UPDATE
          SET label = EXCLUDED.label,
              url   = EXCLUDED.url,
              folder= EXCLUDED.folder
      `;
      await client.query(insertSQL, values);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function fetchAndPush(serverKey) {
  const baseUrl = SERVERS[serverKey];
  const outFile = OUTPUT_FILES[serverKey];
  const stateName = STATE_NAMES[serverKey];

  console.log(`[direct-db] Fetching ${serverKey} from ${baseUrl}`);
  const list = await fetchServicesRecursive(baseUrl, '', stateName);
  list.sort((a, b) => a.folder.localeCompare(b.folder) || a.label.localeCompare(b.label));

  // Optional local debug
  fs.writeFileSync(outFile, JSON.stringify(list, null, 2));
  console.log(`[direct-db] Saved ${list.length} services to ${path.basename(outFile)} (debug)`);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await bulkReplaceDirectDB(client, stateName, list);
    console.log(`[direct-db] Upserted ${list.length} rows for state='${stateName}'`);
  } finally {
    client.release();
    await pool.end();
  }
}

(async () => {
  try {
    await fetchAndPush('WA');
    await fetchAndPush('ID');
    await fetchAndPush('OR');
    console.log('[direct-db] Done.');
  } catch (err) {
    console.error('[direct-db] Error:', err);
    process.exit(1);
  }
})();