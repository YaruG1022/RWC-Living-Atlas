import React, { useState } from 'react';
import LearnMoreGallery from '../LearnMoreGallery';

// Local sample state only: demonstrates the same gallery controls as real cards.
export default function ManualGalleryDemo() {
  const [layout, setLayout] = useState('multi');
  return <div className="um-gallery-controls-preview"><LearnMoreGallery images={[1, 2, 3, 4, 5].map(id => ({ id, url: '/manual-sample-image.svg' }))}
    editing layout={layout} coverUrl="/manual-sample-image.svg" onOpen={() => {}}
    onReorder={() => {}} onDelete={() => {}} onLayoutChange={setLayout} onSeeAll={() => {}} /></div>;
}
