// Shared validation/text conversion used by the content exporter and regression tests.
const ID = /^[a-z][a-z0-9-]*$/;
const TYPES = new Set(['text', 'break', 'strong', 'em', 'code', 'span', 'link', 'chapter-link', 'li', 'ul', 'ol', 'kbd']);

function safeUrl(value) {
  return typeof value === 'string' && (/^https?:\/\/[^\s]+$/.test(value) || /^\/(?!\/)[^\s]*$/.test(value));
}

function validateManual(index, chapters) {
  const fail = message => { throw new Error(`Invalid manual: ${message}`); };
  if (index.schemaVersion !== 1 || !Array.isArray(index.groups) || !Array.isArray(chapters)) fail('schema version or catalog');
  const ids = new Set();
  for (const section of chapters) {
    if (!ID.test(section.id) || ids.has(section.id)) fail(`duplicate/invalid chapter ${section.id}`);
    ids.add(section.id);
  }
  const referenceIds = index.groups.flatMap(group => group.sections.flatMap(section => [section.id, ...(section.children || [])]));
  if (new Set(referenceIds).size !== referenceIds.length || referenceIds.length !== ids.size || referenceIds.some(id => !ids.has(id))) fail('catalog references do not match chapters');
  const allBlockIds = new Set();
  for (const section of chapters) {
    if (section.schemaVersion !== 1 || !section.title?.trim() || !section.navigationLabel?.trim() || !section.summary?.trim()) fail(`missing metadata for ${section.id}`);
    if (section.manualPath !== `/user-manual?section=${section.id}`) fail(`chapter link for ${section.id}`);
    if (!Array.isArray(section.blocks) || !section.blocks.length) fail(`missing blocks for ${section.id}`);
    const contextIds = section.contextBlockIds || [];
    if (!Array.isArray(contextIds) || new Set(contextIds).size !== contextIds.length || contextIds.some(id => !section.blocks.some(block => block.id === id))) fail(`context references in ${section.id}`);
    const examples = new Set();
    for (const example of section.examples) {
      if (!ID.test(example.id) || examples.has(example.id) || example.kind !== 'react-demo' || !example.caption) fail(`example in ${section.id}`);
      examples.add(example.id);
    }
    const images = new Set();
    for (const image of section.images) {
      if (!ID.test(image.id) || images.has(image.id) || !safeUrl(image.url) || !image.caption || (image.exampleId && !examples.has(image.exampleId))) fail(`image in ${section.id}`);
      images.add(image.id);
    }
    const walk = nodes => {
      if (!Array.isArray(nodes) || !nodes.length) fail(`empty content in ${section.id}`);
      for (const node of nodes) {
        if (!TYPES.has(node.type)) fail(`node type ${node.type}`);
        if (node.type === 'text') { if (typeof node.text !== 'string' || !node.text) fail('text'); }
        else if (node.type !== 'break') {
          if (node.type === 'link' && !safeUrl(node.href)) fail(`unsafe link ${node.href}`);
          if (node.type === 'link' && node.target && !['_blank', '_self'].includes(node.target)) fail('link target');
          if (node.type === 'chapter-link' && !ids.has(node.sectionId)) fail(`unknown chapter ${node.sectionId}`);
          walk(node.content);
        }
      }
    };
    for (const block of section.blocks) {
      if (!ID.test(block.id) || allBlockIds.has(block.id) || !['paragraph', 'heading', 'note', 'list'].includes(block.type)) fail(`block ${block.id}`);
      allBlockIds.add(block.id);
      if (block.type === 'heading' && ![2, 3].includes(block.level)) fail(`heading ${block.id}`);
      walk(block.content);
    }
  }
  return true;
}

function contentText(nodes, ordered = false) {
  let item = 0;
  return nodes.map(node => {
    if (node.type === 'text') return node.text;
    if (node.type === 'break') return '\n';
    if (node.type === 'li') return `\n${ordered ? `${++item}.` : '-'} ${contentText(node.content)}`;
    if (node.type === 'ol') return contentText(node.content, true);
    return contentText(node.content);
  }).join('');
}

module.exports = { validateManual, contentText, safeUrl };
