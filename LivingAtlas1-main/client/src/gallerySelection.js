export const MAX_GALLERY_IMAGES = 6;
export const galleryImageID = image => image.imageID ?? image.imageId ?? image.id;

export function selectedGalleryImages(images, selection) {
    const selected = Array.isArray(selection) ? new Set(selection) : null;
    return images.filter(image => !selected || selected.has(galleryImageID(image))).slice(0, MAX_GALLERY_IMAGES);
}
