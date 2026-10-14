const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { exportManual, loadManual } = require('./export-manual.cjs');

test('the same manual release is reproducible, complete and checksum-verifiable', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-manual-export-'));
  try {
    const first = exportManual(output, 'a'.repeat(40));
    const bytes = fs.readFileSync(path.join(output, 'releases', first.version, 'manual.json'));
    assert.deepEqual(exportManual(output, 'a'.repeat(40)), first);
    assert.equal(first.sectionCount, 21);
    assert.equal(first.blockCount, 346);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), first.files[0].sha256);
    const bundle = JSON.parse(bytes);
    const text = bundle.sections.flatMap(section => section.blocks.map(block => block.text)).join('\n');
    assert(!text.includes('24 all cards'));
    assert(!text.includes('Jane Smith'));
    const manual = loadManual();
    manual.chapters.find(s => s.id === 'add-card').blocks[1].content = [{ type: 'text', text: 'Changed once' }];
    const changed = exportManual(output, 'a'.repeat(40), manual);
    assert.notEqual(changed.version, first.version);
    assert(fs.readFileSync(path.join(output, 'releases', changed.version, 'manual.json'), 'utf8').includes('Changed once'));
    manual.chapters[0].blocks = [];
    assert.throws(() => exportManual(output, 'a'.repeat(40), manual), /missing blocks/);
  } finally { fs.rmSync(output, { recursive: true }); }
});
