import React from 'react';
import { render, screen } from '@testing-library/react';
import ManualSources from './ManualSources';

const source = { section_id: 'add-card', title: 'Card Creation Form', url: 'https://atlas.example/user-manual?section=add-card', version: `${'a'.repeat(40)}-${'b'.repeat(12)}` };
test('sources are clickable chapter links, with duplicate and unsafe records excluded', () => {
  render(<ManualSources sources={[source, source, { ...source, url: 'javascript:alert(1)' },
    { ...source, url: 'https://atlas.example/user-manual?section=accounts' }]} />);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Card Creation Form' })).toHaveAttribute('href', source.url);
  expect(screen.getByRole('link')).toHaveAttribute('data-manual-version', source.version);
});
test('older responses without structured sources remain usable', () => {
  const { container } = render(<ManualSources />);
  expect(container).toBeEmptyDOMElement();
});
