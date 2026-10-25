import { isLegacyOrganizationImage, visibleGalleryImages, visibleGallerySelection } from './branding';

test('default branding is hidden while actual uploads, including uploaded logo photos, remain visible', () => {
    const images = [
        {imageID:1,url:'/CEREO-logo.png?old=1'},
        {imageID:2,url:'https://example.invalid/images/thumbnails/default_cereo_thumbnail.png'},
        {imageID:3,url:'/card_images/user_CEREO-logo.png'},
        {imageID:4,url:'/photo.webp'},
    ];
    expect(visibleGalleryImages(images).map(image => image.imageID)).toEqual([3,4]);
    expect(isLegacyOrganizationImage(images[2])).toBe(false);
    expect(visibleGallerySelection(images,[1])).toBeUndefined();
    expect(visibleGallerySelection(images,[1,4])).toEqual([null,4]);
    expect(visibleGallerySelection(images,[])).toEqual([]);
});
