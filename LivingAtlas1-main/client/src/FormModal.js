import { appendDescriptionFileTokens } from './descriptionAttachments';
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import './FormModal.css';
import api from './api.js';
import ImageFramingModal from './ImageFramingModal';
import { IMAGE_ACCEPT, defaultPresentation, galleryFrameAspect, framingStyle, imageUploadError, prepareImagePreview, uploadPercent, uploadToken, validateImage } from './imageUploads';
import RichTextEditor from './RichTextEditor';
import { htmlToPlainText } from './richTextUtils';
import PolygonDrawingModal from './PolygonDrawingModal';
import CoordinatesPanel from './CoordinatesPanel';
import ArcGISPickerModal from './ArcGISPickerModal';
import CustomLayerPickerModal from './CustomLayerPickerModal';
import CreateCardModalOnboarding from './OnboardingCreateCardModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion, faPlay, faPen } from '@fortawesome/free-solid-svg-icons';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function serializeLinks(links) {
    const filtered = links.filter(l => l.url.trim() !== '');
    if (filtered.length === 0) return '';
    return JSON.stringify(filtered);
}

const FormModal = (props) => {
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
    const [isPlacingImageOverlay, setIsPlacingImageOverlay] = useState(false);
    const [isPlacingMultipoint, setIsPlacingMultipoint] = useState(false);
    const [isCreateCardOnboardingOpen, setIsCreateCardOnboardingOpen] = useState(false);
    const [locationType, setLocationType] = useState('point'); // 'point' (1+ coordinates) | 'polygon' | 'image'
    const [multiPoints, setMultiPoints] = useState([]); // [{ lat, lng, icon, color, opacity }]
    const [polygonVertices, setPolygonVertices] = useState([]);
    const [polygonFillColor, setPolygonFillColor] = useState('#0077c0');
    const [polygonLineStyle, setPolygonLineStyle] = useState('solid');
    const isModalOpen = modalIsOpen || props.isOpen;
    const lastPointToolSignalRef = useRef(null);
    const shouldCloseOnPointCancelRef = useRef(false);

    // Apply initial polygon data from Polygon Tool flow
    useEffect(() => {
        if (props.initialPolygonData) {
            const { vertices, centroid, fillColor, lineStyle } = props.initialPolygonData;
            setLocationType('polygon');
            setPolygonVertices(vertices);
            if (fillColor) setPolygonFillColor(fillColor);
            if (lineStyle) setPolygonLineStyle(lineStyle);
            setFormData(prev => ({
                ...prev,
                latitude: centroid.lat.toFixed(6),
                longitude: centroid.lng.toFixed(6),
            }));
        }
    }, [props.initialPolygonData]);

    useEffect(() => {
        if (props.initialImageOverlayData) {
            const { vertices, centroid, imageFile, previewUrl, imageSlots, style } = props.initialImageOverlayData;
            setLocationType('image');
            setPolygonVertices(vertices || []);
            setOverlayImageFile(imageFile || null);
            setOverlayImagePreview(previewUrl || '');
            setIsPlacingImageOverlay(false);
            setOverlayImageSlots(imageSlots || []);
            if (style?.imageOpacity !== undefined) setOverlayImageOpacity(style.imageOpacity);
            setFormData(prev => ({
                ...prev,
                latitude: centroid?.lat?.toFixed(6) || prev.latitude,
                longitude: centroid?.lng?.toFixed(6) || prev.longitude,
            }));
        }
    }, [props.initialImageOverlayData]);

    useEffect(() => {
        const handleImageToolCancel = () => {
            setIsPlacingImageOverlay(false);
        };

        window.addEventListener('map-image-tool-cancel', handleImageToolCancel);
        return () => window.removeEventListener('map-image-tool-cancel', handleImageToolCancel);
    }, []);

    // Fired by the map "Add card from map" button: close any placement panel
    // this modal launched (add points / draw polygon / place image) so the
    // options menu can take over.
    useEffect(() => {
        const handler = () => {
            if (isPlacingMultipoint) handleMultipointCancel();
            if (isDrawingPolygon) setIsDrawingPolygon(false);
            if (isPlacingImageOverlay) setIsPlacingImageOverlay(false);
        };
        window.addEventListener('map-add-tools-cancel-placement', handler);
        return () => window.removeEventListener('map-add-tools-cancel-placement', handler);
    });

    // Clear all card-creation input so the next time this (always-mounted) modal
    // opens it doesn't show data left over from the last card — e.g. points placed
    // via the Add Points tool, a drawn polygon, or typed-in fields.
    const resetFormState = () => {
        setLocationType('point');
        setMultiPoints([]);
        setPolygonVertices([]);
        setPolygonFillColor('#0077c0');
        setPolygonLineStyle('solid');
        setFormData({
            name: '',
            contact_email: props.email || '',
            title: '',
            category: '',
            description: '',
            funding: '',
            org: '',
            link: '',
            tags: '',
            latitude: '',
            longitude: '',
            is_public: true,
        });
        setLinks([{ url: '', text: '' }]);
        setSelectedFiles([]);
        previewGeneration.current += 1;
        imageJobs.forEach(job => { if (job.url) URL.revokeObjectURL(job.url); });
        setImageJobs([]);
        createdCardRef.current = null;
        setCreatedCardID(null);
        setUploadMessage('');
        setFramingJob(null);
        setOverlayImageFile(null);
        setOverlayImagePreview('');
        setOverlayImageSlots([]);
        setOverlayImageOpacity(0.85);
        setPendingArcgisItems([]);
        setPendingCustomLayerItems([]);
    };

    const handleCloseModal = () => {
        setModalIsOpen(false);
        setIsDrawingPolygon(false);
        setIsPlacingImageOverlay(false);
        setIsPlacingMultipoint(false);
        setIsCreateCardOnboardingOpen(false);
        resetFormState();
        if (props.onRequestClose) {
            props.onRequestClose();
        }
    };

    const handleOpenCreateCardHelp = () => {
        window.open('/user-manual?section=add-card', '_blank');
    };

    const handleStartCreateCardOnboarding = () => {
        setIsCreateCardOnboardingOpen(true);
    };

    const isCreateCardModalVisible = isModalOpen && !isDrawingPolygon && !isPlacingImageOverlay && !isPlacingMultipoint;

    useEffect(() => {
        if (!isCreateCardModalVisible && isCreateCardOnboardingOpen) {
            setIsCreateCardOnboardingOpen(false);
        }
    }, [isCreateCardModalVisible, isCreateCardOnboardingOpen]);

    const [formData, setFormData] = useState({
        name: '',                         // display name
        contact_email: props.email || '',
        title: '',
        category: '',
        description: '',
        funding: '',
        org: '',
        link: '',
        tags: '',
        latitude: '',
        longitude: '',
        is_public: true,                  // visibility: public by default
    });

    // Login can finish after this always-mounted modal has initialized. Only
    // replace the default contact address; preserve a contact the user entered.
    const previousAccountEmail = useRef(props.email || '');
    useEffect(() => {
        const previousEmail = previousAccountEmail.current;
        setFormData(prev => prev.contact_email === previousEmail
            ? { ...prev, contact_email: props.email || '' }
            : prev);
        previousAccountEmail.current = props.email || '';
    }, [props.email]);

    const [links, setLinks] = useState([{ url: '', text: '' }]);

    const [selectedFiles, setSelectedFiles] = useState([]);   // <-- multiple files
    const [imageJobs, setImageJobs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitRunning = useRef(false);
    const [createdCardID, setCreatedCardID] = useState(null);
    const createdCardRef = useRef(null);
    const previewGeneration = useRef(0);
    const removedImageIDs = useRef(new Set());
    const [uploadMessage, setUploadMessage] = useState('');
    const [framingJob, setFramingJob] = useState(null);
    const updateImageJob = (id, patch) => setImageJobs(prev => prev.map(job => job.id === id ? { ...job, ...patch } : job));
    const [overlayImageFile, setOverlayImageFile] = useState(null);
    const [overlayImagePreview, setOverlayImagePreview] = useState('');
    const [overlayImageSlots, setOverlayImageSlots] = useState([]);
    const [overlayImageOpacity, setOverlayImageOpacity] = useState(0.85);
    const [pendingArcgisItems, setPendingArcgisItems] = useState([]);
    const [isArcgisPickerOpen, setIsArcgisPickerOpen] = useState(false);
    const [pendingCustomLayerItems, setPendingCustomLayerItems] = useState([]);
    const [isCustomLayerPickerOpen, setIsCustomLayerPickerOpen] = useState(false);
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleFileInput = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = [];

        for (let file of files) {
            if (file.size > MAX_FILE_SIZE) {
                alert(`File "${file.name}" exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB`);
                continue;
            }
            validFiles.push(file);
        }
        setSelectedFiles(prev => [...prev, ...validFiles]);
        e.target.value = '';
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const prepareJob = async job => {
        const generation = previewGeneration.current;
        updateImageJob(job.id, { status: 'preparing', error: '' });
        try {
            const url = await prepareImagePreview(job.file);
            if (generation !== previewGeneration.current || removedImageIDs.current.has(job.id)) { URL.revokeObjectURL(url); return; }
            updateImageJob(job.id, { url, status: 'ready' });
        } catch (error) {
            if (generation === previewGeneration.current) updateImageJob(job.id, { status: 'preview-failed', error: imageUploadError(error) });
        }
    };

    const handleImageInput = async event => {
        const generation = previewGeneration.current;
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (imageJobs.length + files.length > 30) { alert('A project can have at most 30 images.'); return; }
        const jobs = [];
        for (const file of files) {
            try { validateImage(file); }
            catch (error) { alert(`${file.name}: ${error.message}`); continue; }
            jobs.push({ id: uploadToken(), file, url: '', status: 'queued', presentation: defaultPresentation() });
        }
        setImageJobs(prev => [...prev, ...jobs]);
        for (const job of jobs) {
            if (generation !== previewGeneration.current) break;
            if (!removedImageIDs.current.has(job.id)) await prepareJob(job);
        }
    };

    const removeImage = index => {
        const job = imageJobs[index];
        removedImageIDs.current.add(job.id);
        if (job.url) URL.revokeObjectURL(job.url);
        setImageJobs(prev => prev.filter(item => item.id !== job.id));
    };

    const validateForm = () => {
        const errors = [];
        if (!props.username?.trim() || !props.email?.trim()) errors.push("Your account information is missing. Please sign in again before uploading.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email.trim()) || formData.contact_email.trim().length > 255) errors.push("Enter a valid contact email (up to 255 characters).");
        if (!formData.name.trim()) errors.push("Name is required.");
        if (!formData.title.trim() || formData.title.length > 255) errors.push("Title is required and must be <256 chars.");
        if (locationType === 'polygon') {
            if (polygonVertices.length < 3) errors.push("Polygon must have at least 3 points.");
        } else if (locationType === 'image') {
            const placedSlots = overlayImageSlots.filter(s => s.vertices && s.vertices.length >= 4);
            if (placedSlots.length === 0 && polygonVertices.length < 4) errors.push("Image overlay must have at least one placed image.");
            if (!overlayImageFile && !overlayImagePreview && placedSlots.length === 0) errors.push("At least one image is required for the map overlay.");
        } else {
            // 'point' tab: when coordinates were placed via the Add Points panel it's a
            // multi-point card; otherwise validate the manually-typed single coordinate.
            if (multiPoints.length < 1) {
                if (!/^(-?\d+(\.\d{1,8})?)$/.test(formData.latitude)) errors.push("Latitude format is invalid.");
                if (!/^(-?\d+(\.\d{1,8})?)$/.test(formData.longitude)) errors.push("Longitude format is invalid.");
            }
        }
        if (formData.description && htmlToPlainText(formData.description).length > 2000) errors.push("Description must be <2001 chars.");
        if (formData.org && formData.org.length > 255) errors.push("Org must be <256 chars.");
        if (formData.funding && formData.funding.length > 255) errors.push("Funding must be <256 chars.");
        const serializedLink = serializeLinks(links);
        if (serializedLink.length > 2000) errors.push("Links text is too long.");
        return errors;
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (submitRunning.current || imageJobs.some(job => ['queued', 'preparing', 'preview-failed'].includes(job.status))) return;
        const wasCreated = Boolean(createdCardRef.current);
        const formErrors = validateForm();
        if (formErrors.length > 0) {
            alert(formErrors.join("\n"));
            return;
        }

        // Always use current props.username to avoid stale state
        const payload = {
            ...formData,
            username: props.username,
            email: props.email,
            contact_email: formData.contact_email.trim(),
            category: formData.category || 'None',
            is_public: formData.is_public !== false ? 'true' : 'false',
        };

        const formData2 = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (key === 'link') return; // handled separately via links state
            if (value !== undefined && value !== null && value !== '') {
                formData2.append(key, value);
            }
        });
        const serializedLink = serializeLinks(links);
        formData2.append('link', serializedLink);
        formData2.append('link_text', '');

        // Add location type and polygon data. A 'point' card whose coordinates were
        // placed via the Add Points panel is stored as a multi-point card.
        const effectiveLocationType = (locationType === 'point' && multiPoints.length >= 1) ? 'multipoint' : locationType;
        formData2.append('location_type', effectiveLocationType);
        if ((locationType === 'polygon' && polygonVertices.length >= 3) || (locationType === 'image' && polygonVertices.length >= 4)) {
            if (locationType === 'image') {
                // Image overlays use flat vertices (4 corners, no ring concept)
                formData2.append('polygon_coordinates', JSON.stringify({
                    vertices: polygonVertices,
                    fillColor: polygonFillColor,
                    lineStyle: polygonLineStyle,
                    imageOpacity: overlayImageOpacity
                }));
            } else {
                // Polygon cards: build rings from flat array with ring property
                const ringMap = new Map();
                for (const v of polygonVertices) {
                    const r = v.ring ?? 0;
                    if (!ringMap.has(r)) {
                        ringMap.set(r, {
                            vertices: [],
                            style: {
                                fillColor: undefined,
                                fillOpacity: undefined,
                                lineStyle: undefined,
                            }
                        });
                    }
                    const ringData = ringMap.get(r);
                    ringData.vertices.push({ lat: v.lat, lng: v.lng });
                    if (v.fillColor !== undefined && v.fillColor !== null && v.fillColor !== '') {
                        ringData.style.fillColor = v.fillColor;
                    }
                    if (v.fillOpacity !== undefined && v.fillOpacity !== null && v.fillOpacity !== '') {
                        ringData.style.fillOpacity = v.fillOpacity;
                    }
                    if (v.lineStyle !== undefined && v.lineStyle !== null && v.lineStyle !== '') {
                        ringData.style.lineStyle = v.lineStyle;
                    }
                }
                const ordered = [...ringMap.entries()].sort(([a], [b]) => a - b).map(([, data]) => data);
                const rings = ordered.map(data => data.vertices);
                const ringStyles = ordered.map(data => ({
                    fillColor: data.style.fillColor || polygonFillColor,
                    fillOpacity: data.style.fillOpacity ?? 0.2,
                    lineStyle: data.style.lineStyle || polygonLineStyle,
                }));
                formData2.append('polygon_coordinates', JSON.stringify({
                    rings,
                    ringStyles,
                    fillColor: polygonFillColor,
                    fillOpacity: 0.2,
                    lineStyle: polygonLineStyle,
                }));
            }
            formData2.append('polygon_fill_color', polygonFillColor);
            formData2.append('polygon_line_style', polygonLineStyle);
        }
        if (effectiveLocationType === 'multipoint' && multiPoints.length > 0) {
            formData2.append('multipoint_coordinates', JSON.stringify(
                multiPoints.map(p => ({ lat: p.lat, lng: p.lng, icon: p.icon, color: p.color, opacity: p.opacity }))
            ));
        }

        appendDescriptionFileTokens(formData2, selectedFiles);
        // append multiple files
        if (selectedFiles.length > 0) {
            selectedFiles.forEach((file) => {
                formData2.append('files', file);
            });
        }
        
        if (locationType === 'image') {
            if (overlayImageFile) formData2.append('thumbnail', overlayImageFile);
            overlayImageSlots.slice(1).filter(slot => slot.file).forEach(slot => formData2.append('images', slot.file));
        } else if (imageJobs.length) {
            formData2.append('defer_images', 'true');
        }

        submitRunning.current = true;
        setIsSubmitting(true);
        setUploadMessage(wasCreated ? 'Retrying remaining images…' : 'Creating project…');
        console.log("Uploading FormData:", [...formData2.entries()]);

        (createdCardRef.current ? Promise.resolve({ data: { card_id: createdCardRef.current } }) : api.post('/uploadForm', formData2, {
            headers: { 'Content-Type': 'multipart/form-data' }, skipRetry: true, timeout: 180000,
        }))
        .then(async response => {
            const newCardId = response.data?.card_id;
            if (!newCardId && imageJobs.length) throw new Error('The server did not return a project ID.');
            createdCardRef.current = newCardId;
            setCreatedCardID(newCardId);
            if (!wasCreated && newCardId && pendingArcgisItems.length > 0) {
                for (const item of pendingArcgisItems) {
                    try {
                        await api.post('/cardArcGISLinks', {
                            card_id: newCardId,
                            service_key: item.service_key,
                            layer_id: item.layer_id ?? null,
                            sublayer_index: item.sublayer_index ?? null,
                            display_name: item.display_name,
                            item_type: item.item_type,
                            state_code: item.state_code,
                            folder_name: item.folder_name,
                        });
                    } catch (linkErr) {
                        console.error('Failed to link ArcGIS item:', linkErr);
                    }
                }
            }
            if (!wasCreated && newCardId && pendingCustomLayerItems.length > 0) {
                for (const item of pendingCustomLayerItems) {
                    try {
                        await api.post('/cardArcGISLinks', {
                            card_id: newCardId,
                            service_key: item.service_key,
                            layer_id: null,
                            sublayer_index: null,
                            display_name: item.display_name,
                            item_type: item.item_type,
                            state_code: '',
                            folder_name: item.folder_name,
                        });
                    } catch (linkErr) {
                        console.error('Failed to link custom layer:', linkErr);
                    }
                }
            }
            let failed = false;
            for (const job of imageJobs.filter(item => item.status !== 'done')) {
                updateImageJob(job.id, { status: 'uploading', progress: 0, error: '' });
                setUploadMessage(`Uploading ${job.file.name}…`);
                try {
                    const body = new FormData();
                    body.append('cardID', newCardId);
                    body.append('image', job.file);
                    body.append('altText', job.file.name);
                    body.append('presentation', JSON.stringify(job.presentation));
                    body.append('upload_token', job.id);
                    await api.post('/uploadCardImage', body, { timeout: 180000, skipRetry: true,
                        onUploadProgress: event => updateImageJob(job.id, { progress: uploadPercent(event) }),
                    });
                    updateImageJob(job.id, { status: 'done', progress: 100 });
                } catch (error) {
                    failed = true;
                    updateImageJob(job.id, { status: 'failed', error: imageUploadError(error) });
                }
            }
            if (failed) {
                setUploadMessage('Project created. Some images failed. Retry remaining images; completed uploads will be kept.');
                window.dispatchEvent(new CustomEvent('atlas:card-uploaded'));
                return;
            }
            handleCloseModal();
            alert("Upload Successful");
            window.dispatchEvent(new CustomEvent('atlas:card-uploaded'));
        })
        .catch(error => {
            console.error("Upload error:", error.response?.data || error.message);
            const detail = error.response?.data?.detail;
            let message;
            if (typeof detail === 'string') {
                message = detail;
            } else if (Array.isArray(detail)) {
                message = detail.map(item => `${item.loc?.slice(1).join('.') || 'Form'}: ${item.msg || 'Invalid value'}`).join('\n');
            }
            message = message || (error.response
                ? 'Please try again. If the problem continues, contact support.'
                : 'Unable to reach the server. Check your connection and try again.');
            setUploadMessage(message);
            alert(`Upload failed: ${message}`);
        }).finally(() => { submitRunning.current = false; setIsSubmitting(false); });
    };

    const handleStartPolygonDraw = () => {
        setIsDrawingPolygon(true);
    };

    const handleStartImageOverlayPlacement = () => {
        setIsPlacingImageOverlay(true);
        window.dispatchEvent(new CustomEvent('map-image-tool-start'));
    };

    const handlePolygonSave = (allRings, centroid, style, ringStyles = []) => {
        // Flatten array-of-rings into a flat array with `ring` index property and
        // per-ring style fields so each polygon keeps its own color/opacity/line style.
        const flatVerts = allRings.flatMap((ring, ringIdx) => {
            const rs = ringStyles[ringIdx] || {};
            return ring.map(v => ({
                ...v,
                ring: ringIdx,
                fillColor: rs.fillColor,
                fillOpacity: rs.fillOpacity,
                lineStyle: rs.lineStyle,
            }));
        });
        setPolygonVertices(flatVerts);
        const primaryStyle = ringStyles[0] || style || {};
        if (primaryStyle.fillColor) setPolygonFillColor(primaryStyle.fillColor);
        if (primaryStyle.lineStyle) setPolygonLineStyle(primaryStyle.lineStyle);
        setFormData(prev => ({
            ...prev,
            latitude: centroid.lat.toFixed(6),
            longitude: centroid.lng.toFixed(6),
        }));
        setIsDrawingPolygon(false);
    };

    const handlePolygonCancel = () => {
        setIsDrawingPolygon(false);
    };

    const handleLocationTypeChange = (type) => {
        setLocationType(type);
        if (type === 'point') {
            setPolygonVertices([]);
        }
    };

    const handleStartMultipointPlacement = () => {
        if (!window.atlasMapInstance) {
            console.error('Map not found');
            return;
        }
        setIsPlacingMultipoint(true);
    };

    const handleMultipointSave = (points) => {
        setMultiPoints(points);
        setIsPlacingMultipoint(false);
        if (points.length > 0) {
            setFormData(prev => ({
                ...prev,
                latitude: Number(points[0].lat).toFixed(6),
                longitude: Number(points[0].lng).toFixed(6),
            }));
        }
        // Launched from the map "Coordinate" tool: notify parent the placement finished.
        if (shouldCloseOnPointCancelRef.current) {
            shouldCloseOnPointCancelRef.current = false;
            if (typeof props.onPointLocationSelected === 'function') {
                props.onPointLocationSelected();
            }
        }
    };

    const handleMultipointCancel = () => {
        setIsPlacingMultipoint(false);
        // Cancelling the map-tool launch with no points should close the whole flow.
        if (shouldCloseOnPointCancelRef.current) {
            shouldCloseOnPointCancelRef.current = false;
            handleCloseModal();
        }
    };

    useEffect(() => {
        const signal = props.initialPointToolSignal;
        if (!signal || signal === lastPointToolSignalRef.current) return;
        if (isPlacingMultipoint || isDrawingPolygon) return;

        lastPointToolSignalRef.current = signal;
        shouldCloseOnPointCancelRef.current = true;
        setLocationType('point');
        setPolygonVertices([]);
        setMultiPoints([]);
        setIsPlacingMultipoint(true);
    }, [props.initialPointToolSignal, isPlacingMultipoint, isDrawingPolygon]);

    return (
        <div>
            {/* Polygon drawing flow */}
            {isDrawingPolygon && (
                <PolygonDrawingModal
                    onSave={handlePolygonSave}
                    onCancel={handlePolygonCancel}
                />
            )}

            {/* Coordinate placement flow (one or many points) */}
            {isPlacingMultipoint && (
                <CoordinatesPanel
                    initialPoints={
                        multiPoints.length > 0
                            ? multiPoints
                            : (() => {
                                const lat = parseFloat(formData.latitude);
                                const lng = parseFloat(formData.longitude);
                                return (!isNaN(lat) && !isNaN(lng)) ? [{ lat, lng }] : [];
                            })()
                    }
                    onSave={handleMultipointSave}
                    onCancel={handleMultipointCancel}
                />
            )}

            <Modal
                isOpen={isCreateCardModalVisible}
                onRequestClose={handleCloseModal}
                className="form-modal"
                overlayClassName="form-modal-overlay"
                ariaHideApp={false}
            >
                <div className="form-modal-top-actions" data-onboarding-target="create-card-top-actions">
                    <button
                        type="button"
                        className="form-modal-top-action-btn form-modal-top-action-btn--onboarding card-panel-titlebar-btn card-panel-titlebar-btn--onboarding"
                        title="Help"
                        onClick={handleOpenCreateCardHelp}
                    >
                        <FontAwesomeIcon icon={faQuestion} />
                    </button>
                    <button
                        type="button"
                        className="form-modal-top-action-btn form-modal-top-action-btn--onboarding card-panel-titlebar-btn card-panel-titlebar-btn--onboarding"
                        title="Start onboarding"
                        data-onboarding-target="create-card-onboarding-button"
                        onClick={handleStartCreateCardOnboarding}
                    >
                        <FontAwesomeIcon icon={faPlay} />
                    </button>
                </div>
                <button className="close-modal-button" onClick={handleCloseModal}>
                    &times;
                </button>
                <div data-onboarding-target="create-card-modal-root">
                <h2 data-onboarding-target="create-card-title">Create Project</h2>
                <form onSubmit={handleSubmit}>
                    {uploadMessage && <div className="image-upload-status" role="status">{uploadMessage}</div>}
                    <fieldset className="create-project-fields" disabled={isSubmitting || Boolean(createdCardID)}>
                    <label>Author Name <span className="form-modal-required-star">*</span>:</label>
                    <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange} 
                        required 
                    />

                    <label htmlFor="project-contact-email">Contact Email <span className="form-modal-required-star">*</span>:</label>
                    <input id="project-contact-email" type="email" name="contact_email" value={formData.contact_email} onChange={handleInputChange} maxLength={255} required />

                    <label>Title <span className="form-modal-required-star">*</span>:</label>
                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />

                    <label>Category (optional):</label>
                    <select name="category" value={formData.category} onChange={handleInputChange}>
                        <option value="">Select a Category</option>
                        <option value="River">River</option>
                        <option value="Watershed">Watershed</option>
                        <option value="Places">Places</option>
                        <option value="Other">Other</option>
                    </select>

                    <label>Description (optional):</label>
                    <RichTextEditor
                        onInsertFiles={files => setSelectedFiles(prev => [...prev, ...files])}
                        value={formData.description || ''}
                        onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
                        placeholder="Enter description..."
                        minHeight={110}
                    />

                    <label>Funding (optional):</label>
                    <input type="text" name="funding" value={formData.funding} onChange={handleInputChange} />

                    <label>Organization (optional):</label>
                    <input type="text" name="org" value={formData.org} onChange={handleInputChange} />

                    <div className="form-modal-links-section">
                        <label className="form-modal-links-label">Links (optional):</label>
                        {links.map((linkItem, idx) => (
                            <div key={idx} className="form-modal-link-row">
                                <input
                                    type="text"
                                    className="form-modal-link-input"
                                    placeholder="URL"
                                    value={linkItem.url}
                                    onChange={e => setLinks(links.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))}
                                />
                                <input
                                    type="text"
                                    className="form-modal-link-input form-modal-link-text-input"
                                    placeholder="Display text (optional)"
                                    value={linkItem.text}
                                    onChange={e => setLinks(links.map((l, i) => i === idx ? { ...l, text: e.target.value } : l))}
                                />
                                {links.length > 1 && (
                                    <button
                                        type="button"
                                        className="form-modal-link-remove-btn"
                                        onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                                    >&times;</button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            className="form-modal-add-link-btn"
                            onClick={() => setLinks([...links, { url: '', text: '' }])}
                        >+ Add More Links</button>
                    </div>

                    <label>Location Type (choose map placement mode) <span className="form-modal-required-star">*</span>:</label>
                    <div className="form-modal-location-tabs" data-onboarding-target="create-card-location-tabs">
                        <button
                            type="button"
                            className={`form-modal-location-tab ${locationType === 'point' ? 'active' : ''}`}
                            onClick={() => handleLocationTypeChange('point')}
                        >
                            Single Point
                        </button>
                        <button
                            type="button"
                            className={`form-modal-location-tab ${locationType === 'polygon' ? 'active' : ''}`}
                            onClick={() => handleLocationTypeChange('polygon')}
                        >
                            Polygon Area
                        </button>
                        <button
                            type="button"
                            className={`form-modal-location-tab ${locationType === 'image' ? 'active' : ''}`}
                            onClick={() => handleLocationTypeChange('image')}
                        >
                            Image Overlay
                        </button>
                    </div>

                    {locationType === 'point' && (
                        <div className="form-modal-location-content form-modal-location-content--point">
                            <p className="form-modal-location-description">Pin this project at one or more coordinate points. Add points on the map, fine-tune each by latitude/longitude, and choose an icon per point.</p>
                            <button type="button" className="location_button" onClick={handleStartMultipointPlacement}>
                                {multiPoints.length > 0 ? 'Edit Points on Map' : 'Add Points on Map'}
                            </button>

                            {multiPoints.length > 0 ? (
                                <div className="form-modal-polygon-summary">
                                    <span className="form-modal-polygon-check">&#10003;</span>
                                    {multiPoints.length} point{multiPoints.length > 1 ? 's' : ''} added
                                </div>
                            ) : (
                                <div className="form-modal-lat-lng-row">
                                    <div className="form-modal-lat-lng-field">
                                        <label>Latitude <span className="form-modal-required-star">*</span>:</label>
                                        <input
                                            type="text"
                                            name="latitude"
                                            value={formData.latitude}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-modal-lat-lng-field">
                                        <label>Longitude <span className="form-modal-required-star">*</span>:</label>
                                        <input
                                            type="text"
                                            name="longitude"
                                            value={formData.longitude}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {locationType === 'polygon' && (
                        <div className="form-modal-location-content form-modal-polygon-section">
                            <p className="form-modal-location-description">Draw a polygon area on the map to represent a region instead of a single point.</p>
                            <button type="button" className="location_button" onClick={handleStartPolygonDraw}>
                                {polygonVertices.length >= 3 ? 'Redraw Polygon' : 'Draw Polygon on Map'}
                            </button>
                            {polygonVertices.length >= 3 && (
                                <div className="form-modal-polygon-summary">
                                    <span className="form-modal-polygon-check">&#10003;</span>
                                    Polygon saved: {polygonVertices.length} points
                                </div>
                            )}
                        </div>
                    )}

                    {locationType === 'image' && (
                        <div className="form-modal-location-content form-modal-polygon-section">
                            <p className="form-modal-location-description">Place a georeferenced image overlay (PNG, JPG/JPEG, GIF, WebP) onto the map using four corner points.</p>
                            <button type="button" className="location_button" onClick={handleStartImageOverlayPlacement}>
                                {overlayImageSlots.some(s => s.vertices && s.vertices.length >= 4) || polygonVertices.length >= 4
                                    ? 'Edit Image Placement'
                                    : 'Add Image to Map'}
                            </button>
                            {(() => {
                                const placedCount = overlayImageSlots.filter(s => s.vertices && s.vertices.length >= 4).length;
                                if (placedCount > 0) {
                                    return (
                                        <div className="form-modal-polygon-summary">
                                            <span className="form-modal-polygon-check">&#10003;</span>
                                            {placedCount} image{placedCount > 1 ? 's' : ''} placed
                                        </div>
                                    );
                                }
                                if (polygonVertices.length >= 4) {
                                    const cLat = polygonVertices.reduce((s, v) => s + v.lat, 0) / polygonVertices.length;
                                    const cLng = polygonVertices.reduce((s, v) => s + v.lng, 0) / polygonVertices.length;
                                    return (
                                        <div className="form-modal-polygon-summary">
                                            <span className="form-modal-polygon-check">&#10003;</span>
                                            Image placed (center: {cLat.toFixed(4)}, {cLng.toFixed(4)})
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    )}

                    <label>Tags (comma-separated) (optional):</label>
                    <input type="text" name="tags" value={formData.tags} onChange={handleInputChange} />

                    <label>Visibility:</label>
                    <select
                        name="is_public"
                        value={formData.is_public !== false ? "true" : "false"}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.value !== "false" }))}
                    >
                        <option value="true">Public (visible to everyone)</option>
                        <option value="false">Private (only visible to me)</option>
                    </select>

                    <label>Attach Images (optional):</label>
                    <div
                        className="form-modal-image-upload-area"
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => {
                            event.preventDefault();
                            if (!isSubmitting && !createdCardID) handleImageInput({ target: { files: event.dataTransfer.files, value: '' } });
                        }}
                        data-onboarding-target="create-card-image-upload"
                        onClick={() => imageInputRef.current?.click()}
                    >
                        <p>{locationType === 'image' ? 'Click or drag to add optional gallery images for the project details view' : 'Click or drag to add images (PNG, JPG, GIF, WebP)'}</p>
                        <span className="form-modal-image-upload-btn">Choose Images</span>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept={IMAGE_ACCEPT}
                            multiple
                            onChange={handleImageInput}
                        />
                    </div>
                    <p className="image-upload-hint">Up to 50 MiB / 160 megapixels per image. We keep originals and prepare smaller display images automatically.</p>
                    {imageJobs.length > 0 && <div className="form-modal-image-previews">
                        {imageJobs.map((job, i) => <div key={job.id} className="form-modal-image-preview-item">
                            {job.url && <img src={job.url} alt={job.file.name} style={framingStyle(job)} />}
                            <button type="button" className="form-modal-image-preview-remove" aria-label={`Remove ${job.file.name}`} onClick={() => removeImage(i)}>×</button>
                            {job.url && <button type="button" className="form-modal-frame" aria-label="Adjust framing" title="Adjust framing" onClick={() => setFramingJob(job)}><FontAwesomeIcon icon={faPen} aria-hidden="true" /></button>}
                        </div>)}
                    </div>}

                    <label>Upload Files (optional):</label>
                    <div
                        className="form-modal-file-upload-area"
                        data-onboarding-target="create-card-file-upload"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <p>Click to add files (max 5 MB each)</p>
                        <span className="form-modal-image-upload-btn">Choose Files</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileInput}
                        />
                    </div>
                    {selectedFiles.length > 0 && (
                        <div className="form-modal-file-list">
                            {selectedFiles.map((file, i) => (
                                <div key={i} className="form-modal-file-item">
                                    <span>{file.name}</span>
                                    <button type="button" onClick={() => removeFile(i)}>&times;</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <label>Linked ArcGIS Services (optional):</label>
                    <button
                        type="button"
                        className="location_button"
                        onClick={() => setIsArcgisPickerOpen(true)}
                    >
                        + Link ArcGIS Service / Layer
                    </button>
                    {pendingArcgisItems.length > 0 && (
                        <div className="form-modal-file-list" style={{marginTop:'6px'}}>
                            {pendingArcgisItems.map((item, i) => (
                                <div key={i} className="form-modal-file-item">
                                    <span>{item.display_name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setPendingArcgisItems(prev => prev.filter((_, j) => j !== i))}
                                    >&times;</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <label style={{ marginTop: '10px' }}>Linked Custom Layers (optional):</label>
                    <button
                        type="button"
                        className="location_button"
                        onClick={() => setIsCustomLayerPickerOpen(true)}
                    >
                        + Link Custom Layer
                    </button>
                    {pendingCustomLayerItems.length > 0 && (
                        <div className="form-modal-file-list" style={{marginTop:'6px'}}>
                            {pendingCustomLayerItems.map((item, i) => (
                                <div key={i} className="form-modal-file-item">
                                    <span>{item.display_name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setPendingCustomLayerItems(prev => prev.filter((_, j) => j !== i))}
                                    >&times;</button>
                                </div>
                            ))}
                        </div>
                    )}

                    </fieldset>
                    {imageJobs.map(job => <div className="image-upload-status" role="status" key={job.id}>
                        <strong>{job.file.name}</strong> — {job.status === 'preparing' ? 'Preparing preview…' : job.status === 'uploading' ? (job.progress === 100 ? 'Processing image…' : `Uploading ${job.progress ?? ''}%`) : job.status === 'done' ? 'Uploaded' : job.error || 'Ready'}
                        {job.status === 'uploading' && <progress max="100" value={job.progress ?? undefined} aria-label={`Uploading ${job.file.name}`} />}
                        {job.status === 'preview-failed' && <button type="button" disabled={isSubmitting} onClick={() => prepareJob(job)}>Retry preview</button>}
                        {['failed', 'preview-failed'].includes(job.status) && <button type="button" disabled={isSubmitting} onClick={() => removeImage(imageJobs.indexOf(job))}>Remove from upload queue</button>}
                    </div>)}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }} data-onboarding-target="create-card-submit-actions">
                        <button type="submit" disabled={isSubmitting || imageJobs.some(job => ['queued', 'preparing', 'preview-failed'].includes(job.status))}>{isSubmitting ? 'Uploading…' : createdCardID ? 'Retry remaining images' : 'Submit'}</button>
                        <button type="button" className="cancel_button" disabled={isSubmitting} onClick={handleCloseModal}>{createdCardID ? 'Close' : 'Cancel'}</button>
                    </div>
                </form>
                </div>
            </Modal>

            {framingJob && <ImageFramingModal key={framingJob.id} image={{ url: framingJob.url, presentation: framingJob.presentation }} aspectRatio={galleryFrameAspect(imageJobs.length, imageJobs.findIndex(job => job.id === framingJob.id))}
                onClose={() => setFramingJob(null)} onSave={presentation => { updateImageJob(framingJob.id, { presentation }); setFramingJob(null); }} />}
            <CreateCardModalOnboarding
                isOpen={isCreateCardOnboardingOpen}
                onClose={() => setIsCreateCardOnboardingOpen(false)}
            />

            {isArcgisPickerOpen && ReactDOM.createPortal(
                <ArcGISPickerModal
                    onAdd={(items) => {
                        setPendingArcgisItems(prev => {
                            const existingKeys = new Set(prev.map(i => `${i.service_key}__${i.layer_id ?? ''}__${i.sublayer_index ?? ''}`));
                            const newItems = items.filter(i => !existingKeys.has(`${i.service_key}__${i.layer_id ?? ''}__${i.sublayer_index ?? ''}`));
                            return [...prev, ...newItems];
                        });
                        setIsArcgisPickerOpen(false);
                    }}
                    onClose={() => setIsArcgisPickerOpen(false)}
                />,
                document.body
            )}
            {isCustomLayerPickerOpen && ReactDOM.createPortal(
                <CustomLayerPickerModal
                    onAdd={(items) => {
                        setPendingCustomLayerItems(prev => {
                            const existingKeys = new Set(prev.map(i => i.service_key));
                            const newItems = items.filter(i => !existingKeys.has(i.service_key));
                            return [...prev, ...newItems];
                        });
                        setIsCustomLayerPickerOpen(false);
                    }}
                    onClose={() => setIsCustomLayerPickerOpen(false)}
                />,
                document.body
            )}
        </div>
    );
};

export default FormModal;
