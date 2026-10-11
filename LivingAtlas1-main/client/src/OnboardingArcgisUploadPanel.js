import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './OnboardingArcgisUploadPanel.css';

const ONBOARDING_STEPS = [
    {
        selector: '.upload-panel',
        title: 'ArcGIS Upload Panel',
        description: 'This panel allows you to browse and add ArcGIS services from Washington, Idaho, and Oregon to your map.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-state-folder"]',
        title: 'State Folders',
        description: 'At the root of the panel, each state appears as a folder. Open Washington, Idaho, Oregon, or Built-in Layers to move into that scope.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-folder-area"]',
        title: 'Folder Navigation',
        description: 'Once you enter a state, this area shows its folders, breadcrumb path, and then services inside the selected folder.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-service-checkbox"]',
        title: 'Services',
        description: 'Open the Washington State folder to see its services. Check the box next to a service name to add it to the map.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="arcgis-search-area"]',
        title: 'Search Services',
        description: 'Use the search bar to find folders, services, or layers inside the current scope. Search results can continue loading additional layer matches in the background.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-service-info-button"]',
        title: 'Service Information',
        description: 'Click the (...) button to view detailed information about a service, including its layers and metadata.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-layer-tree"]',
        title: 'Layer Management',
        description: 'When a service is expanded, you can see its layers. Select individual layers or entire services.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="arcgis-opacity-slider"]',
        title: 'Layer Opacity Control',
        description: 'Adjust the opacity slider to change the transparency of selected layers on the map.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-panel-actions"]',
        title: 'Panel Actions',
        description: 'Use the action row to refresh ArcGIS services from upstream servers, toggle Added to show active layers only, and use Clear to remove active layers from the map. Hover over compact buttons for their full labels.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-service-info-modal"]',
        title: 'Service Info Modal',
        description: 'The tutorial now opens the first available service info modal automatically so you can inspect service metadata, close controls, and the live modal layout.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-service-info-time-filter"]',
        title: 'Historical View Controls',
        description: 'In ArcGIS Upload Panel, Service info includes Historical View tools. Use Date Range or Timeline controls to apply and clear time-based filtering on supported services.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-service-info-actions"]',
        title: 'Save Service and Open Source Page',
        description: 'Use the Save button to store the current service in Custom Layers, or open the ArcGIS service page to verify the source metadata directly.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-layer-info-modal"]',
        title: 'Layer Info Modal',
        description: 'The tutorial also opens a layer info modal automatically. This view contains layer metadata, legend entries, and parent or child layer navigation when those details exist.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-layer-info-filter"]',
        title: 'Field Filter Builder',
        description: 'Build a field filter by choosing a field, operator, and value, then apply it to the map layer. Clear removes the active filter and restores the layer.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="arcgis-layer-info-actions"]',
        title: 'Save Layer and Inspect REST Page',
        description: 'At the bottom of Layer Info you can save the selected layer to Custom Layers or open the upstream ArcGIS layer page for direct REST inspection.',
        placement: 'left',
    },
];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getTooltipLayout(targetRect, preferredPlacement = 'left') {
    const width = 320;
    const height = 190;
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
    const placements = [preferredPlacement, 'left', 'bottom', 'top', 'right'];

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

function ArcgisUploadPanelOnboarding({
    isOpen,
    onClose,
    isPanelCollapsed,
    onStepChange,
}) {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    const activeStep = useMemo(() => {
        return ONBOARDING_STEPS[stepIndex] || ONBOARDING_STEPS[0];
    }, [stepIndex]);

    const updateTargetRect = useCallback(() => {
        if (!isOpen) return;
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
        if (stepIndex >= ONBOARDING_STEPS.length - 1) {
            onClose?.();
            return;
        }
        setStepIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1));
    }, [stepIndex, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        setStepIndex(0);
        setTargetRect(null);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        onStepChange?.(stepIndex);
    }, [isOpen, stepIndex, onStepChange]);

    useEffect(() => {
        if (!isOpen) return;
        if (isPanelCollapsed) onClose?.();
    }, [isOpen, isPanelCollapsed, onClose]);

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
    }, [isOpen, stepIndex, goPrev, goNext, onClose]);

    if (!isOpen) return null;

    const tooltipLayout = getTooltipLayout(targetRect, activeStep.placement);

    return ReactDOM.createPortal(
        <div className="arcgis-upload-onboarding-overlay" role="dialog" aria-modal="true">
            <div className="arcgis-upload-onboarding-dim" />

            {targetRect && (
                <div
                    className="arcgis-upload-onboarding-highlight"
                    style={{
                        top: targetRect.top - 6,
                        left: targetRect.left - 6,
                        width: targetRect.width + 12,
                        height: targetRect.height + 12,
                    }}
                />
            )}

            <div
                className={`arcgis-upload-onboarding-tooltip placement-${tooltipLayout.placement}`}
                style={{ top: tooltipLayout.top, left: tooltipLayout.left }}
            >
                <div className="arcgis-upload-onboarding-progress">
                    Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
                </div>
                <h4>{activeStep.title}</h4>
                <p>{activeStep.description}</p>
                <div className="arcgis-upload-onboarding-actions">
                    <button type="button" onClick={goPrev} disabled={stepIndex === 0}>
                        Previous
                    </button>
                    <button type="button" onClick={onClose}>Close</button>
                    <button type="button" className="primary" onClick={goNext}>
                        {stepIndex === ONBOARDING_STEPS.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ArcgisUploadPanelOnboarding;
