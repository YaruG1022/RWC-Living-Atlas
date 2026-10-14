import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ManualText from './ManualText';
import { chapters, chapterById } from './catalog';
import index from './index.json';
import { validateManual, contentText } from './schema';

test('chapter catalog rejects missing content, duplicate IDs, and invalid references', () => {
  expect(validateManual(index, chapters)).toBe(true);
  const copy = () => JSON.parse(JSON.stringify(chapters));
  const duplicate = copy(); duplicate[1].id = duplicate[0].id;
  expect(() => validateManual(index, duplicate)).toThrow(/duplicate/);
  const empty = copy(); empty[0].blocks = [];
  expect(() => validateManual(index, empty)).toThrow(/missing blocks/);
  const link = copy(); link[0].blocks[0].content = [{ type: 'chapter-link', sectionId: 'missing', content: [{ type: 'text', text: 'Open' }] }];
  expect(() => validateManual(index, link)).toThrow(/unknown chapter/);
  const unsafe = copy(); unsafe[0].blocks[0].content = [{ type: 'link', href: 'javascript:alert(1)', content: [{ type: 'text', text: 'Open' }] }];
  expect(() => validateManual(index, unsafe)).toThrow(/unsafe link/);
});

test('editing one prose block changes rendering and exported text together', () => {
  const block = chapterById['add-card'].blocks[1];
  const old = block.content;
  try {
    block.content = [{ type: 'text', text: 'Updated card creation instruction.' }];
    render(<ManualText sectionId="add-card" blockId={block.id} />);
    expect(screen.getByText('Updated card creation instruction.')).toBeInTheDocument();
    expect(contentText(block.content)).toBe('Updated card creation instruction.');
  } finally { block.content = old; }
});

test('chapter links keep their navigation action and ordered steps keep numbering', () => {
  const chapter = chapters.find(section => section.blocks.some(block => block.content.some(node => node.type === 'chapter-link')));
  const block = chapter.blocks.find(item => item.content.some(node => node.type === 'chapter-link'));
  const link = block.content.find(node => node.type === 'chapter-link');
  const navigate = jest.fn();
  render(<ManualText sectionId={chapter.id} blockId={block.id} onNavigate={navigate} />);
  fireEvent.click(screen.getByRole('button'));
  expect(navigate).toHaveBeenCalledWith(link.sectionId);
  expect(contentText([{ type: 'li', content: [{ type: 'text', text: 'First' }] },
    { type: 'li', content: [{ type: 'text', text: 'Second' }] }], true)).toBe('\n1. First\n2. Second');
});
