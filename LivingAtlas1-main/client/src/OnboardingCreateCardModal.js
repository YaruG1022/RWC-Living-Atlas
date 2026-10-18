import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './OnboardingCardPanel.css';

const ONBOARDING_STEPS = [
    {
        selector: '[data-onboarding-target="create-card-modal-root"]',
        title: 'Create Project Modal',
        description: 'This modal is where you create a new project with metadata, location, media, and optional links.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="create-card-top-actions"]',
        title: 'Top-Right Actions',
        description: 'Use Help to open the project creation guide in the user manual, and Play to replay this onboarding.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="create-card-location-tabs"]',
        title: 'Location Type Tabs',
        description: 'Choose between Single Point, Polygon Area, and Image Overlay to define project location behavior.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="create-card-image-upload"]',
        title: 'Image Upload Area',
        description: 'Upload gallery images used by the project detail view. For image overlay projects, these are optional Learn More images.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="create-card-file-upload"]',
        title: 'File Upload Area',
        description: 'Attach supporting files (for example PDFs, datasets, or documents) to this project.',
        placement: 'left',
    },
    {
        selector: '[data-onboarding-target="create-card-submit-actions"]',
        title: 'Submit and Cancel',
        description: 'Use Submit to create the project after required fields are complete, or Cancel to close without saving.',
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

function CreateCardModalOnboarding({ isOpen, onClose }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    const activeStep = useMemo(() => ONBOARDING_STEPS[stepIndex] || ONBOARDING_STEPS[0], [stepIndex]);

    const updateTargetRect = useCallback(() => {
        if (!isOpen) return;
        const target = document.querySelector(activeStep.selector);
        if (!target) {
            setTargetRect(null);
            return;
        }
        setTargetRect(target.getBoundingClientRect());
    }, [isOpen, activeStep]);

    const scrollToActiveTarget = useCallback(() => {
        if (!isOpen) return;
        const target = document.querySelector(activeStep.selector);
        if (!target) {
            setTargetRect(null);
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.setTimeout(() => {
            const refreshed = document.querySelector(activeStep.selector);
            if (refreshed) {
                setTargetRect(refreshed.getBoundingClientRect());
            }
        }, 220);
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
        scrollToActiveTarget();
    }, [isOpen, stepIndex, scrollToActiveTarget]);

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

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, goPrev, goNext, onClose]);

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
            >
                <div className="card-onboarding-progress">
                    Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
                </div>
                <h4>{activeStep.title}</h4>
                <p>{activeStep.description}</p>
                <div className="card-onboarding-actions">
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

export default CreateCardModalOnboarding;
