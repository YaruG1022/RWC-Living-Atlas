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

// Release dates are editorial dates, shared by both update surfaces.
export const latestGuiUpdateDate = '11/6/2026';
export const latestGuiUpdates = [
    {
        title: 'Administration and User Management',
        items: [
            'Admin pages now restore the signed-in session after a refresh. Improved User Management with search, clearer loading and error messages, and reliable role changes and user deletion.',
            'Added confirmation and safeguards for administrative actions, including protecting the last administrator account.',
        ],
    },
    {
        title: 'Built-in Layers and Layer Information',
        items: [
            'Added National Forests, Lakes & Reservoirs, Major Roads and Rivers. All six built-in overlays now load regional snapshots from the site, with no separate map-data hosting service required.',
            'Hydrological Boundaries now shows USGS HUC8 drainage areas, and City Limits shows Census incorporated cities and towns across Washington, Oregon and Idaho. Rivers separately shows major river lines and lake connections.',
            'Unified color legends, map styling, opacity, feature popups, searching, Added and Clear. Selected overlays return after switching basemaps, including raster basemaps.',
            'Replaced inline layer descriptions with small circular question-mark buttons. Information dialogs open nearby with coverage, source links and Zoom to region; they fit smaller screens and support Escape, outside-click closing and keyboard navigation.',
        ],
    },
    {
        title: 'GIS Uploads in Custom Layers',
        items: [
            'Added an Upload menu for GIS ZIP files containing a File Geodatabase or Shapefile, and StreamStats data in GeoJSON/JSON, KML or Shapefile ZIP format.',
            'Imported GIS features retain their attributes and are converted to map coordinates. Uploaded layers are saved in Custom Layers, display on the map and return after reloading.',
            'Added upload progress, actionable errors and attribute popups. Updated the manual and guided instructions for the new layer and upload workflows.',
        ],
    },
];

// Newest first. Earlier September releases remain in their existing sections.
export const guiReleases = [
    { date: latestGuiUpdateDate, groups: latestGuiUpdates },
    {
        date: '10/26/2026',
        groups: [
            {
                title: 'Azure Services and Automatic Deployment',
                items: [
                    'Moved the main backend and Atlas Helper chatbot from Render to Azure, and updated the Netlify frontend to use the Azure services.',
                    'Set up GitHub Actions to deploy each service automatically when relevant changes reach main.',
                    'Fixed the main backend’s API documentation error and made the chatbot report the deployed version correctly.',
                ],
            },
        ],
    },
    {
        date: '10/24/2026',
        groups: [
            {
                title: 'Project Contacts and Image Uploads',
                items: [
                    'Fixed contact-email upload failures. Project contacts can use an email different from the signed-in account while ownership remains with the creator.',
                    'Improved large-image uploads with resized display copies, progress tracking and retries that keep completed uploads. Originals are preserved; supported images can be up to 50 MiB and 160 megapixels.',
                    'Added image framing, drag and zoom controls, fixed the dragging crash, and cleaned up image placeholders, upload instructions and controls.',
                ],
            },
            {
                title: 'Project Editing and Custom Layers',
                items: [
                    'Improved Custom Layers saving, library-load error messages and retry controls.',
                    'Enabled switching between Point, Polygon and Image locations in project details. Cancel restores the previous location, and Save commits the new one.',
                    'Added unsaved-change warnings when leaving project editing through Close, an outside click or Escape, including pending files and metadata edits.',
                    'Each viewer now has independent linked-layer display settings. Signed-in choices are saved per account, visitor choices stay in the browser, and one viewer’s selection does not change another’s.',
                ],
            },
            {
                title: 'Updated Guides',
                items: [
                    'Updated guided tours and manual examples for contacts, larger image uploads, framing, retries, location conversion, unsaved changes and personal linked-layer display settings.',
                ],
            },
        ],
    },
    {
        date: '10/18/2026',
        groups: [
            {
                title: 'Consistent Pages and Project Panels',
                items: [
                    'Unified account and information pages with the User Manual’s typography, blue headings, light panels and consistent controls.',
                    'Improved project panels, filters and scrollbars, with consistent Project terminology, compact actions and a Filter menu that stays visible beside narrow panels.',
                ],
            },
            {
                title: 'Watershed and Detail Controls',
                items: [
                    'Improved watershed tools with an immediate pour-point preview, coordinates, cancellation and clearing, and a compact menu for saving basins as custom layers or polygons.',
                    'Refined project-detail controls and unsaved-change notices, and matched Help, Tutorial and Close buttons to the rest of the interface.',
                ],
            },
            {
                title: 'Release Notes, Guides and Atlas Helper',
                items: [
                    'Updated release notes, guided tours and the user manual to match the interface changes, and confirmed Atlas Helper uses the latest published manual.',
                ],
            },
        ],
    },
    { date: manualGuiUpdateDate, groups: manualGuiUpdates },
    { date: contactGuiUpdateDate, groups: contactGuiUpdates },
    { date: previousGuiUpdateDate, groups: previousGuiUpdates },
    { date: earlierGuiUpdateDate, groups: earlierGuiUpdates },
];
