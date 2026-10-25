import React, { useState } from 'react';
import LearnMoreGallery from '../LearnMoreGallery';
import ImageFramingModal from '../ImageFramingModal';

// Local sample state only: demonstrates the same gallery controls as real cards.
export default function ManualGalleryDemo() {
  const [layout, setLayout] = useState('multi');
  const [images, setImages] = useState(() => [1, 2, 3, 4].map(id => ({ id, url: '/manual-sample-image.svg' })));
  const [framing, setFraming] = useState(null);
  return <div className="um-gallery-controls-preview"><LearnMoreGallery images={images}
    editing layout={layout} coverUrl="/manual-sample-image.svg" onOpen={() => {}}
    onReorder={() => {}} onDelete={() => {}} onLayoutChange={setLayout} onSeeAll={() => {}}
    onFrame={(image, aspectRatio) => setFraming({ image, aspectRatio })} />
    {framing && <ImageFramingModal image={framing.image} aspectRatio={framing.aspectRatio}
      onClose={() => setFraming(null)} onSave={presentation => {
        setImages(previous => previous.map(image => image.id === framing.image.id ? { ...image, presentation } : image));
        setFraming(null);
      }} />}
  </div>;
}
