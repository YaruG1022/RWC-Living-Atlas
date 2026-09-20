import React from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlay,
    faMapLocationDot,
    faClone,
    faSearch,
    faWater,
    faCommentDots,
    faBell,
    faObjectGroup,
    faMap,
    faUser,
    faEarthAmericas,
    faQuestion,
    faChevronDown,
    faTimes,
    faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';

// Visual examples of the app controls; they do not navigate away from the guide.
const SidebarIcon = ({ icon }) => (
    <span className="onboarding-sidebar-icon" aria-hidden="true">
        <FontAwesomeIcon icon={icon} />
    </span>
);

const PanelIcon = ({ icon }) => (
    <span className={`onboarding-panel-icon${icon === faPlay ? " onboarding-panel-icon--play" : ""}`} aria-hidden="true">
        <FontAwesomeIcon icon={icon} />
    </span>
);

const GuideSection = ({ title, initiallyOpen = false, children }) => (
    <details className="onboarding-section" open={initiallyOpen}>
        <summary>
            <h3>{title}</h3>
            <FontAwesomeIcon icon={faChevronDown} className="onboarding-section-chevron" />
        </summary>
        <div className="onboarding-section-content">{children}</div>
    </details>
);

function GeneralOnboardingModal({ isOpen, onClose, onPlay }) {
    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            className="onboarding-modal"
            overlayClassName="onboarding-modal-overlay"
            contentLabel="Welcome to Living Atlas"
        >
            <div className="onboarding-modal-header">
                <div>
                    <h2>Welcome to Living Atlas</h2>
                    <p className="onboarding-modal-subtitle">Explore the guide at your own pace, or take a guided app tour.</p>
                </div>
                <button className="onboarding-modal-close" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <div className="onboarding-modal-body">
                <GuideSection title="What is the Living Atlas?" initiallyOpen>
                    <p>The CEREO Living Atlas is a web-based, map-focused platform for gathering, viewing, and sharing environmental research and stories about the Pacific Northwest, with a focus on water quality in the Columbia River Basin. Built with the <strong>Center for Environmental Research, Education, and Outreach (CEREO)</strong> at Washington State University, it brings fragmented environmental datasets together into one interactive, public-facing map.</p>
                </GuideSection>

                <GuideSection title="What Can You Do Here?">
                    <ul className="onboarding-feature-list">
                        <li><SidebarIcon icon={faMapLocationDot} /><span><strong>Explore the interactive map</strong>: pan, zoom, and click markers, polygons, and image overlays to discover environmental resources.</span></li>
                        <li><SidebarIcon icon={faSearch} /><span><strong>Find app features</strong>: use the sidebar search to find tools by keyword and open them from the results. Use the search on the map to find places, addresses, or coordinates.</span></li>
                        <li><SidebarIcon icon={faClone} /><span><strong>Browse data cards</strong>: each card is a geographically located resource (e.g., a monitoring station or dataset) with descriptions, images, files, and links. Search, sort, and filter cards by category, tag, or keyword.</span></li>
                        <li><SidebarIcon icon={faEarthAmericas} /><span><strong>Load GIS layers</strong>: browse ArcGIS services, add layers to the map, and filter time-aware layers.</span></li>
                        <li><SidebarIcon icon={faObjectGroup} /><span><strong>Add custom layers</strong>: organize and render your own layers with folders, pinning, and ordering.</span></li>
                        <li><SidebarIcon icon={faMap} /><span><strong>Switch basemaps</strong>: choose the background map style that best suits your needs.</span></li>
                        <li><SidebarIcon icon={faWater} /><span><strong>Delineate watersheds</strong>: show StreamStats rivers, delineate a basin, and save it as a custom layer or polygon card.</span></li>
                        <li><SidebarIcon icon={faUser} /><span><strong>Sign in for more</strong>: bookmark (favorite) cards, and if authorized, create and manage your own cards.</span></li>
                        <li><SidebarIcon icon={faCommentDots} /><span><strong>Ask the AI chatbot</strong>: open RWC Living Atlas Helper from the sidebar to ask about data and app features. Switch between Sidebar and Floating in the chat header. In floating mode, open the helper from its floating handle; the sidebar chatbot button is disabled.</span></li>
                        <li><SidebarIcon icon={faBell} /><span><strong>See what's new</strong>: open the latest changes and feature announcements.</span></li>
                    </ul>
                </GuideSection>

                <GuideSection title="Navigate with the Top Bar">
                    <ul>
                        <li><strong>RWC Living Atlas / Home</strong>: return to the map workspace.</li>
                        <li><strong>CEREO logo</strong>: visit the CEREO website.</li>
                        <li><strong>About</strong>: learn about the project and its background.</li>
                        <li><strong>Contact</strong>: find project contact information.</li>
                        <li><strong>Updates</strong>: browse the full update history.</li>
                        <li><strong>User Manual</strong>: read detailed instructions for the app's tools.</li>
                        <li><strong>Register / Login</strong>: create an account or sign in. Once signed in, open your avatar menu for Profile, Switch Account, and Logout; administrators also see Administration.</li>
                    </ul>
                </GuideSection>

                <GuideSection title="How to Start Onboarding in Each Panel">
                    <p>Open a panel, then click the circular <strong>play</strong> button <PanelIcon icon={faPlay} /> in its upper-right corner to start that panel's guided tour, where available.</p>
                </GuideSection>

                <GuideSection title="Quick Help Tip">
                    <p>The <strong>question mark</strong> <PanelIcon icon={faQuestion} /> button in a panel opens its detailed user manual. You can also ask the chatbot for help using the app.</p>
                </GuideSection>

                <GuideSection title="Take a Guided App Tour">
                    <p>Select <strong>Start App Tour</strong> below for a walkthrough of the top bar, sidebar, chatbot, and map controls. To take the tour again, click <strong>App onboarding</strong> <SidebarIcon icon={faInfoCircle} /> at the bottom of the left sidebar and select <strong>Start App Tour</strong>.</p>
                </GuideSection>
            </div>
            <div className="onboarding-modal-footer">
                <button className="onboarding-modal-play" onClick={onPlay}>
                    <FontAwesomeIcon icon={faPlay} />
                    <span>Start App Tour</span>
                </button>
                <button className="onboarding-modal-dismiss" onClick={onClose}>Got it</button>
            </div>
        </Modal>
    );
}

export default GeneralOnboardingModal;
