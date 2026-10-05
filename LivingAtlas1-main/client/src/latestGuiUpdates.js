// Shared release notes keep the update dialog and history page in sync.
export const latestGuiUpdateDate = '10/5/2026';

export const latestGuiUpdates = [
    {
        title: 'Card Images and Gallery Management',
        items: [
            'Raised the image limit from 8 to 30 per card. Choose up to 6 images for the main gallery and slideshow; number 1 sets the card cover.',
            'See all images now uses smaller square thumbnails, four per row on desktop. Numbered checkboxes appear over images only in edit mode, and selected gallery images have a matching border. A new selection reuses the lowest vacant number.',
            'Moved Add New Image and Delete Selected beside Back to Learn More at the top. Refined bulk-selection circles and removed up/down sorting buttons from this screen; reorder images in the main gallery instead.',
            'Moved Image layout beside See all N images, placed gallery instructions in the all-images screen, and increased main gallery image height. Updated arrow and drag controls to Font Awesome icons and made cover badges neutral and visible only while editing.',
        ],
    },
    {
        title: 'Cards Panel and Filtering',
        items: [
            'Added an Add Card label and removed the separate marker toggle from the Cards toolbar. Map visibility remains available from the map controls.',
            'Moved Favorites into Filter By. Apply confirms category, tag, and favorites choices together; Clear resets them all.',
            'List view now has a fixed 310-pixel width with no resize handle. Grid view keeps its adjustable width, and switching repeatedly between views now restores the correct width.',
        ],
    },
    {
        title: 'Panel Headers and Chatbot',
        items: [
            'Reduced vertical space in panel headers and made their circular action buttons smaller.',
            'Resized the floating Atlas Helper window to 400 × 500 pixels, removed the beta notice paragraph, and replaced the Sidebar/Floating text button with a circular icon button.',
        ],
    },
    {
        title: 'Map Card Popups and Location Details',
        items: [
            'Resized map card popups to 275 × 250 pixels and reduced spacing around the Edit action.',
            'Moved point and multi-point coordinates into Representation. Removed coordinate input boxes from the metadata area; use Edit Coordinate in Representation to change the location.',
        ],
    },
    {
        title: 'Onboarding and User Manual',
        items: [
            'Updated guided tours, instructions, and gallery examples to match the current image, filter, panel, coordinate, and chatbot controls. Added an Atlas Helper guide and simplified the Overview label.',
            'Corrected the feature-search marker shortcut to use the current map visibility control, and added guide-navigation regression checks.',
        ],
    },
];
