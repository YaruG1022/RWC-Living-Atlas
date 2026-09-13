import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './OnboardingBasemapPanel.css';

const ONBOARDING_STEPS = [
    {
        selector: '.basemap-switcher-panel',
        title: 'Basemap Panel',
        description: 'This panel lets you switch the map style used by the application.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="basemap-help-button"]',
        title: 'Help Button',
        description: 'Click here to open the Basemap Panel section in the user manual.',
        placement: 'right',
    },
    {
        selector: '.basemap-switcher-icon-btn--play',
        title: 'Tutorial Button',
        description: 'Click here to start this guided walkthrough for the Basemap Panel.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="basemap-search-row"]',
        title: 'Search Map Styles',
        description: 'Use this search row to find map styles by name or description, then click Search or press Enter.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="basemap-list"]',
        title: 'Basemap List',
        description: 'All available map styles are listed here, including satellite, navigation, outdoors, streets, light, and dark styles.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="basemap-item"]',
        title: 'Basemap Item',
        description: 'Each basemap item shows a preview thumbnail, style name, and a short description. Click one to apply it to the map.',
        placement: 'right',
    },
    {
        selector: '[data-onboarding-target="basemap-active-item"]',
        title: 'Current Basemap',
        description: 'The currently active basemap is highlighted so you can quickly see which style is in use.',
        placement: 'right',
    },
];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getTooltipLayout(targetRect, preferredPlacement = 'right') {
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

export function PanelOnboarding({ isOpen, onClose, isPanelCollapsed, steps = ONBOARDING_STEPS }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    const activeStep = useMemo(() => steps[stepIndex] || steps[0], [stepIndex, steps]);

    const updateTargetRect = useCallback(() => {
        if (!isOpen) return;
        const target = document.querySelector(activeStep.selector)
            || (activeStep.fallbackSelector && document.querySelector(activeStep.fallbackSelector));
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
    }, [stepIndex, onClose, steps]);

    useEffect(() => {
        if (!isOpen) return;
        setStepIndex(0);
        setTargetRect(null);
    }, [isOpen]);

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
    }, [isOpen, goPrev, goNext, onClose]);

    if (!isOpen) return null;

    const tooltipLayout = getTooltipLayout(targetRect, activeStep.placement);

    return ReactDOM.createPortal(
        <div className="basemap-onboarding-overlay" role="dialog" aria-modal="true" aria-label={steps[0].title}>
            <div className="basemap-onboarding-dim" />

            {targetRect && (
                <div
                    className="basemap-onboarding-highlight"
                    style={{
                        top: targetRect.top - 6,
                        left: targetRect.left - 6,
                        width: targetRect.width + 12,
                        height: targetRect.height + 12,
                    }}
                />
            )}

            <div
                className={`basemap-onboarding-tooltip placement-${tooltipLayout.placement}`}
                style={{ top: tooltipLayout.top, left: tooltipLayout.left }}
            >
                <div className="basemap-onboarding-progress">
                    Step {stepIndex + 1} of {steps.length}
                </div>
                <h4>{activeStep.title}</h4>
                <p>{activeStep.description}</p>
                <div className="basemap-onboarding-actions">
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

export default PanelOnboarding;
