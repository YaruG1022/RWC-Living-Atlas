const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { chromium: playwright } = require('playwright-core');
const chromium = require('@sparticuz/chromium').default;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const build = path.resolve(__dirname, '../build');

function serveBuild(root) {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    fs.createReadStream(target).pipe(res);
  });
}

async function captureManual({ root = build, sectionIds } = {}) {
  const manualRoot = path.join(root, 'manual');
  const marker = JSON.parse(fs.readFileSync(path.join(manualRoot, 'current.json')));
  const release = path.join(manualRoot, 'releases', marker.version);
  const bundle = JSON.parse(fs.readFileSync(path.join(release, 'manual.json')));
  const server = serveBuild(root);
  let browser;
  const entries = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await playwright.launch({ executablePath: process.env.MANUAL_CHROMIUM_PATH || await chromium.executablePath(), args: chromium.args, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light' });
    // No account storage, real data, maps, analytics or remote image downloads.
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    fs.mkdirSync(path.join(release, 'images'), { recursive: true });
    async function save(section, locator, id, state, exampleId = '') {
      const overview = state === 'chapter-overview';
      let blockIds = await locator.locator('[data-manual-block]').evaluateAll((elements, overview) => elements.filter(element => {
        if (!overview) return true;
        const range = document.createRange(); range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      }).map(element => element.dataset.manualBlock), overview);
      if (!blockIds.length) blockIds = section.blocks.slice(0, 2).map(block => block.id);
      const blocks = section.blocks.filter(block => blockIds.includes(block.id));
      const bytes = overview ? await page.screenshot({ type: 'png', animations: 'disabled' }) : await locator.screenshot({ type: 'png', animations: 'disabled' });
      if (bytes.length > 2 * 1024 * 1024) throw new Error(`Screenshot too large: ${id}`);
      const checksum = digest(bytes);
      const imagePath = `images/${checksum}.png`;
      fs.writeFileSync(path.join(release, imagePath), bytes);
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      const controls = await locator.evaluate((root, overview) => {
        const area = overview ? { x: 0, y: 0, width: innerWidth, height: innerHeight } : root.getBoundingClientRect();
        return [...root.querySelectorAll('button, select, [role="button"]')].flatMap(element => {
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height || rect.right <= area.x || rect.bottom <= area.y || rect.left >= area.x + area.width || rect.top >= area.y + area.height) return [];
          const label = element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent.trim();
          if (!label) return [];
          return [{ role: element.tagName === 'SELECT' ? 'combobox' : 'button', label: label.slice(0, 160),
            icon: element.querySelector('svg[data-icon]')?.getAttribute('data-icon') || '',
            bounds: [rect.x - area.x, rect.y - area.y, rect.width, rect.height].map(value => Math.round(value)),
            disabled: Boolean(element.disabled) }];
        }).slice(0, 120);
      }, overview);
      entries.push({ id, sectionId: section.id, exampleId, state, version: marker.version,
        revision: marker.revision, blockIds, stepIds: blocks.flatMap(block => block.stepIds || []),
        caption: blocks.filter(block => block.type === 'heading' || block.role === 'feature-title').map(block => block.text).join(' / ') || section.title,
        path: imagePath, sha256: checksum, bytes: bytes.length, width, height, controls });
    }
    for (const section of bundle.sections.filter(section => !sectionIds || sectionIds.includes(section.id))) {
      await page.goto(`${origin}${section.manualPath}`, { waitUntil: 'networkidle' });
      const content = page.locator('.um-content-area');
      await content.locator('[data-manual-block]').first().waitFor();
      const visibleIds = await content.locator('[data-manual-block]').evaluateAll(elements => elements.map(element => element.dataset.manualBlock));
      if (visibleIds.length !== section.blocks.length || section.blocks.some(block => !visibleIds.includes(block.id))) throw new Error(`Missing rendered chapter prose: ${section.id}`);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = img.onerror = resolve; }))); });
      const broken = await content.locator('img').evaluateAll(images => images.filter(img => !img.naturalWidth).map(img => img.getAttribute('src')));
      if (broken.length) throw new Error(`Broken manual images: ${section.id}: ${broken.join(', ')}`);
      // A chapter overview supplies location/context, while crops keep controls readable.
      await page.evaluate(() => window.scrollTo(0, 0));
      await save(section, page.locator('body'), `${section.id}-overview`, 'chapter-overview');
      for (const example of section.examples) {
        const demo = page.locator(`[data-manual-example="${example.id}"]`);
        if (await demo.count() !== 1) throw new Error(`Missing/duplicate example: ${example.id}`);
        const row = demo.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " um-feature-row ")][1]');
        const target = await row.count() ? row : demo;
        await save(section, target, `${example.id}-default`, 'default', example.id);
        const layout = demo.getByRole('combobox', { name: 'Image layout', exact: true });
        if (await layout.count()) {
          await layout.selectOption('slideshow');
          await save(section, target, `${example.id}-slideshow`, 'slideshow', example.id);
          await demo.getByRole('button', { name: 'Next gallery image', exact: true }).click();
          await save(section, target, `${example.id}-slideshow-next`, 'slideshow-next', example.id);
          await layout.selectOption('multi');
        }
      }
      if (errors.length) throw new Error(`Manual runtime errors: ${errors.join('; ')}`);
      console.log(`Captured ${section.id}: ${section.examples.length} examples`);
    }
    const catalog = { schemaVersion: 1, version: marker.version, revision: marker.revision,
      viewport: { width: 1440, height: 1000 }, entries };
    const bytes = Buffer.from(`${JSON.stringify(catalog)}\n`);
    const checksum = digest(bytes);
    const catalogPath = `visuals/${checksum}.json`;
    fs.mkdirSync(path.join(release, 'visuals'), { recursive: true });
    fs.writeFileSync(path.join(release, catalogPath), bytes);
    // Images/catalog are content addressed; a different browser build cannot silently
    // reuse another image's URL. Text release identity remains reproducible everywhere.
    marker.visuals = { schemaVersion: 1, path: catalogPath, sha256: checksum, bytes: bytes.length, count: entries.length };
    fs.writeFileSync(path.join(release, 'manifest.json'), `${JSON.stringify(marker, null, 2)}\n`);
    fs.writeFileSync(path.join(manualRoot, 'current.json'), `${JSON.stringify(marker, null, 2)}\n`);
    console.log(`Captured ${entries.length} versioned manual screenshots (${entries.reduce((sum, item) => sum + item.bytes, 0)} bytes)`);
    return catalog;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
if (require.main === module) captureManual().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { captureManual, serveBuild };
