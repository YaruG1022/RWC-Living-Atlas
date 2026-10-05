export const MAX_GALLERY_IMAGES = 6;
export const galleryImageID = image => image.imageID ?? image.imageId ?? image.id;

export function selectedGalleryImages(images, selection) {
    if (!Array.isArray(selection)) return images.slice(0, MAX_GALLERY_IMAGES);
    const byID = new Map(images.map(image => [galleryImageID(image), image]));
    return [...new Set(selection)].map(id => byID.get(id)).filter(Boolean).slice(0, MAX_GALLERY_IMAGES);
}

export function toggleGallerySelection(slots, id) {
    const next = [...slots];
    const selectedIndex = next.indexOf(id);
    if (selectedIndex >= 0) next[selectedIndex] = null;
    else {
        const vacantIndex = next.indexOf(null);
        if (vacantIndex >= 0) next[vacantIndex] = id;
        else if (next.length < MAX_GALLERY_IMAGES) next.push(id);
    }
    return next;
}
