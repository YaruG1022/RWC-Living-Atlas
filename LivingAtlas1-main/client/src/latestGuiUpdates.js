// Shared release notes keep the update dialog and history page in sync.
export const earlierGuiUpdateDate = '10/5/2026';

export const earlierGuiUpdates = [
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

export const previousGuiUpdateDate = '10/11/2026';

export const previousGuiUpdates = [
    {
        title: 'Project Cards and Panel Controls',
        items: [
            'Renamed the panel to Project Cards and simplified action buttons across panels. List results now sit flush with the toolbar, with square corners and a temporary card preview on hover.',
            'Pinned cards now stay in the order they were pinned, with newer pins following earlier ones.',
        ],
    },
    {
        title: 'Card Details, Images and Attachments',
        items: [
            'Moved gallery controls inside the image area: See all images sits at the bottom left, and Image layout appears at the top right while editing. Both become clearer on hover.',
            'Added multiple-file selection and review before saving, fixed attachment downloads including text files, and added Link and File tools to the description editor.',
            'Map location now previews the actual markers, polygon or image. Click the preview to close details and locate the card on the map.',
        ],
    },
    {
        title: 'Map Tools and Basemaps',
        items: [
            'Refined map search, toolbars, zoom controls and the Z axis with compact sizing and consistent styling. Map editors sit beside the toolbar, share the same layout, and use neutral outlined marker defaults. Reduced coordinate-display height and clarified the reset-view icon.',
            'Added OpenStreetMap and USGS topographic, aerial imagery and shaded-relief basemaps without an additional API key.',
        ],
    },
    {
        title: 'User Manual and Onboarding',
        items: [
            'Updated instructions, examples and guided tours for the new card, gallery, attachment and map workflows, including multi-point creation and file insertion.',
        ],
    },
];

export const contactGuiUpdateDate = '10/13/2026';

export const contactGuiUpdates = [
    {
        title: 'Contact and RWC Branding',
        items: [
            'Updated Contact to Paccar Room 360 and j.boll@wsu.edu; removed the phone number and renamed the section Email.',
            'Replaced CEREO display text with Rivers, Watersheds, Communities (RWC) across the app, onboarding and user manual.',
            'Temporarily hid the top navigation logo link and default card logos. Cards without uploaded images show "No image"; logo assets remain available for future replacement.',
        ],
    },
];

export const manualGuiUpdateDate = '10/14/2026';
export const manualGuiUpdates = [
    {
        title: 'User Manual and Atlas Helper',
        items: [
            'Expanded manual guides and added interactive gallery layout previews, with clearer editing, deletion and slideshow instructions.',
            'Atlas Helper now follows the published manual, refreshes automatically and links to relevant chapters. Failed updates retain the last verified instructions.',
            'For icon, position and layout questions, the helper can consult matching manual screenshots when available, with text fallback. Plain-text questions avoid image calls.',
            'Improved multi-step guidance for permissions, required fields and saving changes; questions about current public Atlas data still use live data.',
        ],
    },
];

export const latestGuiUpdateDate = '10/18/2026';
export const latestGuiUpdates = [
    {
        title: 'Consistent Information Pages',
        items: [
            'Unified About, Contact, Update History and User Manual with matching headings, typography, dividers and content spacing.',
            'Refined Contact form styling and keyboard focus states, and made the manual section navigator scroll within the page on smaller screens.',
        ],
    },
];
