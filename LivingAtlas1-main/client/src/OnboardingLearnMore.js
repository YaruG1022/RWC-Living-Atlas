import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import './OnboardingCardPanel.css';

// Steps at this index and beyond require edit mode in Card.js
export const LEARN_MORE_EDIT_MODE_STEP = 4;

const LEARN_MORE_STEPS = [
    {
        selector: '[data-onboarding-target="learn-more-text-area"]',
        title: 'Text and Data Area',
        description: 'Browse card metadata, description, tags, and linked layers here. Coordinates and location editing are in the Representation section.',
        placement: 'left',
        scrollTo: '[data-onboarding-target="learn-more-text-area"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-image-area"]',
        title: 'Image Area',
        description: 'View up to six selected images in Multiple images or Slideshow mode. Click an image to preview it, or See all N images below the gallery to browse every image.',
        placement: 'left',
        scrollTo: '[data-onboarding-target="learn-more-image-area"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-toolbar"]',
        title: 'Top Toolbar',
        description: 'This toolbar contains actions to edit, export, delete, open help, start onboarding, and close the Detail View.',
        placement: 'bottom',
        scrollTo: '[data-onboarding-target="learn-more-toolbar"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-toolbar"]',
        title: 'Edit Mode - Enter',
        description: 'Click the Edit button to enter edit mode. This allows you to make changes to the card details. Edit mode will now be entered for the following demonstration steps.',
        placement: 'bottom',
        scrollTo: '[data-onboarding-target="learn-more-toolbar"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-image-area"]',
        title: 'Edit Mode - Image Layout and Order',
        description: 'Choose Image layout beside See all N images. Drag gallery images or use the arrow icons to reorder them. The first selected image is the card cover; its badge and border appear only in edit mode.',
        placement: 'left',
        scrollTo: '[data-onboarding-target="learn-more-image-area"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-image-area"]',
        title: 'Edit Mode - See All Images',
        description: 'Open See all N images. Numbered checkboxes choose up to six main images; a new selection fills the lowest vacant number. The separate top-right circles select images for Delete Selected. Add New Image is at the top; a card holds up to 30 images.',
        placement: 'left',
        scrollTo: '[data-onboarding-target="learn-more-image-area"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-text-area"]',
        title: 'Edit Mode - Fields Editing',
        description: 'Edit fields and metadata such as title, author, category, and links directly in this area. Description uses a rich text toolbar, tags are added as removable chips, and Visibility sets the card to Public or Private.',
        placement: 'left',
        scrollTo: '[data-onboarding-target="learn-more-text-area"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-coordinates-polygon"]',
        title: 'Edit Mode - Representation',
        description: 'Representation shows point coordinates, multi-point count, or polygon/image details. Use Edit Coordinate for points, Edit Polygon / Edit Image for areas, or Change location type. Point coordinates are edited here rather than in metadata fields.',
        placement: 'left',
        scrollTo: '[data-onboarding-target="learn-more-coordinates-polygon"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-arcgis-section"]',
        title: 'Edit Mode - ArcGIS & Custom Layers',
        description: 'Link your card to ArcGIS services/layers or custom layers. Each linked item has a visibility checkbox, a jump-to-panel button, and a remove button in edit mode.',
        placement: 'left',
        scrollTo: '[data-onboarding-target="learn-more-arcgis-section"]',
    },
    {
        selector: '[data-onboarding-target="learn-more-toolbar"]',
        title: 'Edit Mode - Save or Cancel',
        description: 'After making edits, click the Save button to commit your changes. Click Cancel or Close to discard any unsaved changes.',
        placement: 'bottom',
        scrollTo: '[data-onboarding-target="learn-more-toolbar"]',
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

function LearnMoreOnboarding({ isOpen, onClose, isModalOpen, onStepChange }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    const activeStep = useMemo(() => LEARN_MORE_STEPS[stepIndex] || LEARN_MORE_STEPS[0], [stepIndex]);

    const updateTargetRect = useCallback(() => {
        if (!isOpen) return;
        const target = document.querySelector(activeStep.selector);
        if (!target) {
            setTargetRect(null);
            return;
        }
        setTargetRect(target.getBoundingClientRect());
    }, [isOpen, activeStep]);

    const goPrev = useCallback(() => setStepIndex((prev) => Math.max(0, prev - 1)), []);
    const goNext = useCallback(() => {
        if (stepIndex >= LEARN_MORE_STEPS.length - 1) {
            onClose?.();
            return;
        }
        setStepIndex((prev) => Math.min(LEARN_MORE_STEPS.length - 1, prev + 1));
    }, [stepIndex, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        setStepIndex(0);
        setTargetRect(null);
    }, [isOpen]);

    // Notify parent of step changes
    useEffect(() => {
        if (!isOpen) return;
        onStepChange?.(stepIndex);
    }, [isOpen, stepIndex, onStepChange]);

    useEffect(() => {
        if (!isOpen) return;
        if (!isModalOpen) onClose?.();
    }, [isOpen, isModalOpen, onClose]);

    // Scroll the target element into view, then re-measure its rect
    useEffect(() => {
        if (!isOpen) return;
        const scrollSelector = activeStep.scrollTo || activeStep.selector;
        const el = document.querySelector(scrollSelector);
        if (el) {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        // Delay rect measurement to allow scroll to settle
        const timer = window.setTimeout(updateTargetRect, 350);
        return () => window.clearTimeout(timer);
    }, [isOpen, stepIndex, activeStep, updateTargetRect]);

    useEffect(() => {
        if (!isOpen) return;
        updateTargetRect();
        window.addEventListener('resize', updateTargetRect);
        window.addEventListener('scroll', updateTargetRect, true);
        return () => {
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

        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, stepIndex, goPrev, goNext, onClose]);

    if (!isOpen) return null;

    const tooltipLayout = getTooltipLayout(targetRect, activeStep.placement);

    return ReactDOM.createPortal(
        <div className="card-onboarding-overlay" role="dialog" aria-modal="true">
            <div className="card-onboarding-dim" />

            {targetRect && (
                <div
                    className="card-onboarding-highlight"
                    style={{
                        top: targetRect.top - 6,
                        left: targetRect.left - 6,
                        width: targetRect.width + 12,
                        height: targetRect.height + 12,
                    }}
                />
            )}

            <div
                className={`card-onboarding-tooltip placement-${tooltipLayout.placement}`}
                style={{ top: tooltipLayout.top, left: tooltipLayout.left }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="card-onboarding-progress">
                    Step {stepIndex + 1} of {LEARN_MORE_STEPS.length}
                </div>
                <h4>{activeStep.title}</h4>
                <p>{activeStep.description}</p>
                <div className="card-onboarding-actions">
                    <button type="button" onClick={goPrev} disabled={stepIndex === 0}>Previous</button>
                    <button type="button" onClick={onClose}>Close</button>
                    <button type="button" className="primary" onClick={goNext}>
                        {stepIndex === LEARN_MORE_STEPS.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default LearnMoreOnboarding;
