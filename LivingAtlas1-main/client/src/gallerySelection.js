export const MAX_GALLERY_IMAGES = 6;
export const galleryImageID = image => image.imageID ?? image.imageId ?? image.id;

export function selectedGalleryImages(images, selection) {
    if (!Array.isArray(selection)) return images.slice(0, MAX_GALLERY_IMAGES);
    const byID = new Map(images.map(image => [galleryImageID(image), image]));
    return [...new Set(selection)].map(id => byID.get(id)).filter(Boolean).slice(0, MAX_GALLERY_IMAGES);
}

export function gallerySelectionAfterReorder(images, selection) {
    if (!Array.isArray(selection)) return selection;
    const selected = new Set(selection);
    return images.map(galleryImageID).filter(id => selected.has(id));
}
