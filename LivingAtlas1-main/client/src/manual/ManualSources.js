import React from 'react';

export function validSources(sources) {
  if (!Array.isArray(sources)) return [];
  const seen = new Set();
  return sources.filter(source => {
    if (!source || typeof source.url !== 'string' || typeof source.title !== 'string' ||
        !/^[a-z][a-z0-9-]*$/.test(source.section_id || '') ||
        !/^[a-f0-9]{40}-[a-f0-9]{12}$/.test(source.version || '')) return false;
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/user-manual' ||
          url.searchParams.get('section') !== source.section_id || seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    } catch { return false; }
  });
}

export default function ManualSources({ sources }) {
  const references = validSources(sources);
  if (!references.length) return null;
  return <div className="chatbot-widget__manual-sources" aria-label="User Manual references">
    <strong>User Manual</strong>
    <ul>{references.map(source => <li key={source.url}>
      <a href={source.url} target="_blank" rel="noopener noreferrer" data-manual-version={source.version}>
        {source.title}
      </a>
    </li>)}</ul>
  </div>;
}
