import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './OnboardingGeneral.css';

const STEP_DEFINITIONS = [
    {
        selector: '[data-onboarding-target="navbar-root"]',
        title: 'Top Navbar',
        description: 'Use the top bar to return to the map, learn about the project, find contact information, read updates and the manual, or access your account.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-brand"]',
        title: 'App Title',
        description: 'Click the app title to return to the home map page quickly.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-cereo-link"]',
        title: 'CEREO Website Link',
        description: 'Select the CEREO logo to visit the Center for Environmental Research, Education, and Outreach website.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-home-link"]',
        title: 'Home Link',
        description: 'Go to the main map and panel workspace.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-about-link"]',
        title: 'About Link',
        description: 'Open the About page for project background and context.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-contact-link"]',
        title: 'Contact Link',
        description: 'Open the Contact page for support and communication channels.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-updates-link"]',
        title: 'Updates Link',
        description: 'View product update history and recent feature changes.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-manual-link"]',
        title: 'User Manual Link',
        description: 'Open the full user manual when you need detailed instructions.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-auth-link"][href="/signup"]',
        title: 'Register',
        description: 'Create an account to save favorite cards and access features available to signed-in users.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-auth-link"][href="/login"]',
        title: 'Login',
        description: 'Sign in to your existing account. Your avatar and username will replace Register and Login in the top bar.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="navbar-auth-link"].profile-button',
        title: 'Account Area',
        description: 'Open your avatar menu for Profile, Switch Account, and Logout. Administrators also have an Administration option.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-root"]',
        title: 'Left Sidebar',
        description: 'Open search, Cards, GIS layers, Custom Layers, Basemap, Watershed Delineation, and the chatbot here. The bell and information buttons at the bottom open updates and this app tour.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-search"]',
        title: 'Search Button',
        description: 'Open mini search to quickly find app features by keyword.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-search-panel"]',
        title: 'Search Panel',
        description: 'Type a keyword to find app features, click Search to list matches, and click any result to run that feature directly.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-cards"]',
        title: 'Cards Panel Button',
        description: 'Show or hide data cards. Search, sort, and filter resources, then select a card to explore its details and location. The circular play button in the panel header starts its guided tour.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-gis"]',
        title: 'GIS Services Button',
        description: 'Use the earth button to browse ArcGIS services and add GIS layers to the map. Time-aware layers offer time filters. The circular play button in the panel header starts its guided tour.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-customlayers"]',
        title: 'Custom Layers Button',
        description: 'Manage your saved custom layers with folders, pinning, ordering, and map visibility controls. The circular play button in the panel header starts its guided tour.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-basemap"]',
        title: 'Basemap Button',
        description: 'Choose the background map style for your data. The circular play button in the panel header starts its guided tour.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-watershed"]',
        title: 'Watershed Button',
        description: 'Show StreamStats rivers, delineate a basin, and save it as a custom layer or polygon card. The circular play button in the panel header starts its guided tour; the question mark opens the manual.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-chatbot"]',
        title: 'RWC Living Atlas Helper',
        description: 'Ask the chatbot about data and app features. The speech-bubble button opens the sidebar chat. Switch between Sidebar and Floating in the chat header; in floating mode, use the floating helper handle instead of this disabled button.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="map-control-search"]',
        title: 'Map Search Control',
        description: 'Search for an address, place, or LAT/LONG coordinates directly on the map. Picking a result flies the map there and drops a green location marker.',
        placement: 'bottom',
    },
    {
        selector: '[data-onboarding-target="map-control-fullscreen"]',
        title: 'Fullscreen Control',
        description: 'Enter or exit browser fullscreen mode for the map workspace.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="map-control-navigation"]',
        title: 'Zoom And Compass Controls',
        description: 'Use + and - to change zoom. The compass resets the map bearing back to north after rotation.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="map-control-geolocate"]',
        title: 'Current Location Control',
        description: 'Jump to your current device location and optionally keep tracking your heading when the browser allows location access.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="map-control-z-axis"]',
        title: 'Z-Axis Zoom Control',
        description: 'This custom vertical zoom axis shows the current zoom level and can be dragged directly to change zoom with finer control.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="map-control-add-cards"]',
        title: 'Add Cards From Map',
        description: 'Open the map creation menu for single point, polygon, and image overlay placement. These creation shortcuts require login.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="map-control-visibility"]',
        title: 'Visibility Toggle',
        description: 'Hide or show all card markers, polygon overlays, and image overlays to declutter the map while reviewing basemaps or ArcGIS layers.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="map-control-reset-view"]',
        title: 'Reset Map View',
        description: 'Fly the map back to the default Pacific Northwest overview when you want to quickly reset position and zoom.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="map-control-screenshot"]',
        title: 'Screenshot Tool',
        description: 'Capture the current map canvas as a PNG image. Control overlays are excluded from the downloaded screenshot.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-changelog"]',
        title: 'Changelog Button',
        description: 'Open the What\'s New modal to review recent changes and feature additions.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="left-sidebar-general-onboarding"]',
        title: 'App Onboarding',
        description: 'Open the welcome guide to review app features and panel help. Select Start App Tour to replay this walkthrough anytime.',
        placement: 'right',
    },
];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getTooltipLayout(targetRect, preferredPlacement = 'right') {
    const width = 340;
    const height = 210;
    const gap = 16;
    const edge = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!targetRect) {
        return {
            top: Math.round(vh / 2 - height / 2),
            left: Math.round(vw / 2 - width / 2),
            placement: 'top',
        };
    }

    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;
    const placements = [preferredPlacement, 'right', 'bottom', 'top', 'left'];

    for (const placement of placements) {
        if (placement === 'left') {
            const left = targetRect.left - width - gap;
            const top = clamp(centerY - height / 2, edge, vh - height - edge);
            if (left >= edge) return { top, left, placement };
        }
        if (placement === 'right') {
            const left = targetRect.right + gap;
            const top = clamp(centerY - height / 2, edge, vh - height - edge);
            if (left + width <= vw - edge) return { top, left, placement };
        }
        if (placement === 'top') {
            const top = targetRect.top - height - gap;
            const left = clamp(centerX - width / 2, edge, vw - width - edge);
            if (top >= edge) return { top, left, placement };
        }
        if (placement === 'bottom') {
            const top = targetRect.bottom + gap;
            const left = clamp(centerX - width / 2, edge, vw - width - edge);
            if (top + height <= vh - edge) return { top, left, placement };
        }
    }

    return {
        top: clamp(centerY - height / 2, edge, vh - height - edge),
        left: clamp(centerX - width / 2, edge, vw - width - edge),
        placement: 'top',
    };
}

function GeneralOnboarding({ isOpen, onClose }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [steps, setSteps] = useState(STEP_DEFINITIONS);

    const activeStep = useMemo(() => steps[stepIndex] || steps[0], [steps, stepIndex]);

    const updateTargetRect = useCallback(() => {
        if (!isOpen || !activeStep) return;
        const target = document.querySelector(activeStep.selector);
        if (!target) {
            setTargetRect(null);
            return;
        }
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        setTargetRect(target.getBoundingClientRect());
    }, [isOpen, activeStep]);

    const goPrev = useCallback(() => setStepIndex((prev) => Math.max(0, prev - 1)), []);
    const goNext = useCallback(() => {
        if (stepIndex >= steps.length - 1) {
            onClose?.();
            return;
        }
        setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
    }, [stepIndex, steps.length, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const availableSteps = STEP_DEFINITIONS.filter((step) => document.querySelector(step.selector));
        setSteps(availableSteps.length > 0 ? availableSteps : STEP_DEFINITIONS);
        setStepIndex(0);
        setTargetRect(null);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        updateTargetRect();
        const timer = window.setTimeout(updateTargetRect, 350);
        window.addEventListener('resize', updateTargetRect);
        window.addEventListener('scroll', updateTargetRect, true);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', updateTargetRect);
            window.removeEventListener('scroll', updateTargetRect, true);
        };
    }, [isOpen, stepIndex, updateTargetRect]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goPrev();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                goNext();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, goPrev, goNext, onClose]);

    useEffect(() => {
        if (!activeStep) return;
        window.dispatchEvent(new CustomEvent('atlas:general-onboarding-step-change', {
            detail: {
                selector: activeStep.selector,
                isOpen,
            },
        }));
    }, [activeStep, isOpen]);

    if (!isOpen || !activeStep) return null;

    const tooltipLayout = getTooltipLayout(targetRect, activeStep.placement);

    return ReactDOM.createPortal(
        <div className="general-onboarding-overlay" role="dialog" aria-modal="true">
            <div className="general-onboarding-dim" />

            {targetRect && (
                <div
                    className="general-onboarding-highlight"
                    style={{
                        top: targetRect.top - 6,
                        left: targetRect.left - 6,
                        width: targetRect.width + 12,
                        height: targetRect.height + 12,
                    }}
                />
            )}

            <div
                className={`general-onboarding-tooltip placement-${tooltipLayout.placement}`}
                style={{ top: tooltipLayout.top, left: tooltipLayout.left }}
            >
                <div className="general-onboarding-progress">
                    Step {stepIndex + 1} of {steps.length}
                </div>
                <h4>{activeStep.title}</h4>
                <p>{activeStep.description}</p>
                <div className="general-onboarding-actions">
                    <button type="button" onClick={goPrev} disabled={stepIndex === 0}>
                        Previous
                    </button>
                    <button type="button" onClick={onClose}>Close</button>
                    <button type="button" className="primary" onClick={goNext}>
                        {stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default GeneralOnboarding;
