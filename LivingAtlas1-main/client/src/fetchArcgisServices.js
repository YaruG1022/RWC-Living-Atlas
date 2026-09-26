// Node script to crawl ArcGIS REST "services" directories and save MapServer/FeatureServer endpoints
// Usage (from client/src): node fetchArcgisServices.js

const fs = require('fs');
const path = require('path');

// Lazy import to work in Node without ESM
const fetchDynamic = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Basic sleep
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Resilient fetch with retries/backoff and timeout
async function resilientFetch(url, opts = {}, { retries = 5, baseDelay = 500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout
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

      // Retry on 429/5xx
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
      // Retry on network errors/aborts
      if (attempt < retries && (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
        const backoff = baseDelay * Math.pow(2, attempt);
        await delay(backoff);
        continue;
      }
      throw err;
    }
  }
  // Should not reach here
  throw new Error(`Failed to fetch ${url} after retries`);
}

// REST server roots
const SERVERS = {
  WA: 'https://gis.ecology.wa.gov/serverext/rest/services/',
  ID: 'https://gis.idwr.idaho.gov/hosting/rest/services/',
  OR: 'https://navigator.state.or.us/arcgis/rest/services/'
};

// Human-readable state names to embed in records
const STATE_NAMES = {
  WA: 'washington',
  ID: 'idaho',
  OR: 'oregon'
};

// Output files for one-time database seeding and maintenance
const OUTPUT_FILES = {
  WA: path.join(__dirname, 'arcgis_services_wa.json'),
  ID: path.join(__dirname, 'arcgis_services_id.json'),
  OR: path.join(__dirname, 'arcgis_services_or.json')
};

// Supported service types
const SUPPORTED_TYPES = [
  'MapServer',
  'FeatureServer',
  'GeometryServer',
  'GPServer',
  'GeocodeServer'
];

// Recursively fetch folders/services under a base URL
async function fetchServicesRecursive(baseUrl, currentPath = '', stateName) {
  const url = baseUrl + currentPath + (currentPath.endsWith('/') ? '' : '') + '?f=json';
  const res = await resilientFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  let services = [];

  // Recurse into subfolders
  if (Array.isArray(data.folders)) {
    for (const sub of data.folders) {
      const subPath = (currentPath ? currentPath : '') + sub + '/';
      const subServices = await fetchServicesRecursive(baseUrl, subPath, stateName);
      services = services.concat(subServices);
    }
  }

  // Collect services in this folder
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

async function fetchAndSave(serverKey) {
  const baseUrl = SERVERS[serverKey];
  const outFile = OUTPUT_FILES[serverKey];
  const stateName = STATE_NAMES[serverKey];

  console.log(`[fetchArcgisServices] Fetching ${serverKey} from ${baseUrl}`);
  const list = await fetchServicesRecursive(baseUrl, '', stateName);
  // Sort for stable diffs
  list.sort((a, b) => a.folder.localeCompare(b.folder) || a.label.localeCompare(b.label));

  fs.writeFileSync(outFile, JSON.stringify(list, null, 2));
  console.log(`[fetchArcgisServices] Saved ${list.length} services to ${path.basename(outFile)}`);
}

(async () => {
  try {
    await fetchAndSave('WA'); // Washington
    await fetchAndSave('ID'); // Idaho
    await fetchAndSave('OR'); // Oregon

    console.log('[fetchArcgisServices] Done.');
    console.log('Outputs:');
    console.log(' - arcgis_services_wa.json (Washington)');
    console.log(' - arcgis_services_id.json (Idaho)');
    console.log(' - arcgis_services_or.json (Oregon)');
  } catch (err) {
    console.error('[fetchArcgisServices] Error:', err);
    process.exit(1);
  }
})();
