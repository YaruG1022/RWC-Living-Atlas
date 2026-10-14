const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { validateManual, contentText } = require('../src/manual/schema');
const contentRoot = path.resolve(__dirname, '../src/manual');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function loadManual() {
  const index = JSON.parse(fs.readFileSync(path.join(contentRoot, 'index.json')));
  const ids = index.groups.flatMap(group => group.sections.flatMap(section => [section.id, ...(section.children || [])]));
  const chapters = ids.map(id => JSON.parse(fs.readFileSync(path.join(contentRoot, 'sections', `${id}.json`))));
  validateManual(index, chapters);
  // Fail on leftover/unknown chapter files instead of silently indexing extra material.
  const files = fs.readdirSync(path.join(contentRoot, 'sections')).filter(file => file.endsWith('.json'));
  if (files.length !== ids.length || files.some(file => !ids.includes(file.slice(0, -5)))) throw new Error('Unlisted manual chapter file');
  return { index, chapters };
}

function exportManual(output, revision, manual = loadManual()) {
  const { index, chapters } = manual;
  validateManual(index, chapters);
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('A full Git commit SHA is required');
  const bundle = { schemaVersion: 1, revision, sections: chapters.map(section => ({ ...section,
    contentVersion: digest(Buffer.from(JSON.stringify(section))),
    blocks: section.blocks.map(block => ({ ...block, text: contentText(block.content, block.ordered) })) })) };
  const bytes = Buffer.from(`${JSON.stringify(bundle)}\n`);
  const checksum = digest(bytes);
  const version = `${revision}-${checksum.slice(0, 12)}`;
  const manifest = { schemaVersion: 1, version, revision, sectionCount: chapters.length,
    blockCount: chapters.reduce((count, section) => count + section.blocks.length, 0),
    sectionIds: chapters.map(section => section.id),
    files: [{ path: 'manual.json', sha256: checksum, bytes: bytes.length }],
    bundlePath: `/manual/releases/${version}/manual.json`,
    manifestPath: `/manual/releases/${version}/manifest.json` };
  const release = path.join(output, 'releases', version);
  fs.mkdirSync(release, { recursive: true });
  fs.writeFileSync(path.join(release, 'manual.json'), bytes);
  fs.writeFileSync(path.join(release, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(output, 'current.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) {
  const revision = process.env.COMMIT_REF || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: contentRoot, encoding: 'utf8' }).trim();
  const manifest = exportManual(path.resolve(__dirname, '../public/manual'), revision);
  console.log(`Validated/exported ${manifest.sectionCount} chapters, ${manifest.blockCount} blocks; version ${manifest.version}`);
}
module.exports = { loadManual, exportManual };
