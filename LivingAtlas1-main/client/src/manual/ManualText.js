import React from 'react';
import { chapterById } from './catalog';

// Render only the shared prose. Surrounding layout, styles and live demos stay in React.
export function renderContent(nodes, onNavigate) {
  return nodes.map((node, index) => {
    if (node.type === 'text') return node.text;
    if (node.type === 'break') return <br key={index} />;
    const children = renderContent(node.content, onNavigate);
    if (node.type === 'chapter-link') {
      return <button key={index} type="button" className="um-nav-item"
        onClick={() => onNavigate(node.sectionId)}>{children}</button>;
    }
    if (node.type === 'link') {
      return <a key={index} href={node.href} target={node.target}
        rel={node.target === '_blank' ? 'noopener noreferrer' : undefined}>{children}</a>;
    }
    const tags = { strong: 'strong', em: 'em', code: 'code', span: 'span', li: 'li', ul: 'ul', ol: 'ol', kbd: 'kbd' };
    const tag = tags[node.type];
    if (!tag) throw new Error(`Unknown manual content type: ${node.type}`);
    return React.createElement(tag, { key: index }, children);
  });
}

export default function ManualText({ sectionId, blockId, onNavigate }) {
  const block = chapterById[sectionId]?.blocks.find(item => item.id === blockId);
  if (!block) throw new Error(`Missing manual block: ${sectionId}/${blockId}`);
  return <>{renderContent(block.content, onNavigate)}</>;
}
