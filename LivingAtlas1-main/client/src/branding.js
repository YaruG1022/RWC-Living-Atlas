// Keep the legacy logo and its references available for a future replacement.
export const SHOW_LEGACY_ORGANIZATION_LOGO = false;

export function isLegacyOrganizationImage(image) {
    const url = typeof image === 'string' ? image : image?.url || image?.imageURL || image?.thumbnail_link;
    return typeof url === 'string' && /(?:^|\/)(?:CEREO-logo|default_cereo_thumbnail)\.png(?:[?#].*)?$/i.test(url);
}

export function visibleGalleryImages(images) {
    return images.filter(image => image?.url && (SHOW_LEGACY_ORGANIZATION_LOGO || !isLegacyOrganizationImage(image)));
}

export function visibleGallerySelection(images, selection) {
    if (SHOW_LEGACY_ORGANIZATION_LOGO || !Array.isArray(selection)) return selection;
    const hiddenIDs = new Set(images.filter(isLegacyOrganizationImage).map(image => String(image.imageID ?? image.imageId ?? image.id)));
    if (!selection.some(id => hiddenIDs.has(String(id)))) return selection;
    const visible = selection.map(id => hiddenIDs.has(String(id)) ? null : id);
    return visible.some(id => id !== null) ? visible : undefined;
}
