import { appendDescriptionFileTokens } from './descriptionAttachments';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import api from './api.js';
import { fetchArcgisLegend } from './arcgisDataUtils';
import './Card.css';
import { SHOW_LEGACY_ORGANIZATION_LOGO, isLegacyOrganizationImage, visibleGalleryImages, visibleGallerySelection } from './branding';
import LearnMoreGallery, { MAX_CARD_IMAGES } from './LearnMoreGallery';
import ImageFramingModal from './ImageFramingModal';
import { IMAGE_ACCEPT, galleryFrameAspect, imageUploadError, uploadPercent, uploadToken, validateImage } from './imageUploads';
import { MAX_GALLERY_IMAGES, galleryImageID, selectedGalleryImages, toggleGallerySelection } from './gallerySelection';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart as solidHeart, faMagnifyingGlass, faPenToSquare, faPen, faTrashCan, faDownload, faArrowLeft, faCheck, faUpload, faXmark, faQuestion, faPlay, faTimes } from '@fortawesome/free-solid-svg-icons';
import { jsPDF } from 'jspdf';
import { faHeart as regularHeart } from '@fortawesome/free-regular-svg-icons';
import RichTextEditor from './RichTextEditor';
import RepresentationPreview from './RepresentationPreview';
import { descriptionToHtml, htmlToPlainText } from './richTextUtils';
import PolygonDrawingModal from './PolygonDrawingModal';
import CoordinatesPanel from './CoordinatesPanel';
import { setCardLocationEditing } from './cardLocationEditing';
import { toggleSharedCardLayer } from './sharedCardLayers';
import { resolveLinkedLayerVisibility, saveLinkedLayerVisibility } from './linkedLayerVisibility';
import ArcGISPickerModal from './ArcGISPickerModal';
import { fetchAllArcgisServices } from './arcgisServicesDb';
import CustomLayerPickerModal from './CustomLayerPickerModal';
import LearnMoreOnboarding, { LEARN_MORE_EDIT_MODE_STEP } from './OnboardingLearnMore';

const CARD_CATEGORIES = ['River', 'Watershed', 'Places', 'Other'];

const ARCGIS_STATE_FULL_NAMES = {
    WA: 'Washington State ArcGIS Services',
    ID: 'Idaho ArcGIS Services',
    OR: 'Oregon ArcGIS Services',
};

function parseLinks(link, linkText) {
    if (!link) return [{ url: '', text: '' }];
    try {
        const parsed = JSON.parse(link);
        if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [{ url: '', text: '' }];
    } catch {}
    return [{ url: link, text: linkText || '' }];
}

function serializeLinks(links) {
    const filtered = links.filter(l => l.url.trim() !== '');
    if (filtered.length === 0) return '';
    return JSON.stringify(filtered);
}

// Tags are stored as a comma-separated string (e.g. "river, watershed").
function parseTags(tags) {
    if (!tags) return [];
    return String(tags).split(',').map(t => t.trim()).filter(Boolean);
}

function serializeTags(tagArray) {
    return (tagArray || []).join(', ');
}

function Card(props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLearnMoreOnboardingOpen, setIsLearnMoreOnboardingOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [isLearnMoreEditMode, setIsLearnMoreEditMode] = useState(false);
    const [isAllImagesView, setIsAllImagesView] = useState(false);
    const [selectedAllImageIDs, setSelectedAllImageIDs] = useState([]);
    const [pendingDeletedImageIDs, setPendingDeletedImageIDs] = useState([]);
    const [learnMoreBackup, setLearnMoreBackup] = useState(null);
    const [isImageMutationLoading, setIsImageMutationLoading] = useState(false);
    const [pendingImageSlotIndex, setPendingImageSlotIndex] = useState(null);
    const [sessionUploadedImageIDs, setSessionUploadedImageIDs] = useState([]);
    const [framingImage, setFramingImage] = useState(null);
    const [imageUploadJobs, setImageUploadJobs] = useState([]);
    const uploadRunning = useRef(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [failedCardImageUrl, setFailedCardImageUrl] = useState(null);
    const [isEditingPolygon, setIsEditingPolygon] = useState(false);
    // The stored/draft type stays intact until the new map editor is accepted.
    const [conversionTargetType, setConversionTargetType] = useState(null);
    const isConvertingLocationType = conversionTargetType !== null;
    const editorMapHiddenBackupRef = useRef(false);
    const [isEditingCoordinate, setIsEditingCoordinate] = useState(false);
    // True while a coordinate edit is in progress or staged but not yet saved.
    const [hideCardMapRepresentation, setHideCardMapRepresentation] = useState(false);
    const [isLocationTypeMenuOpen, setIsLocationTypeMenuOpen] = useState(false);
    const isEditingRef = useRef(false); // Track editing state across renders
    const learnMoreImageInputRef = useRef(null);
    const locationTypeMenuRef = useRef(null);
    const [formData, setFormData] = useState({
        ...props.formData,
        files: props.formData?.files || [],      // <-- ensure files array always exists
        filesToUpload: [],                       // <-- temp storage for new uploads
        is_public: props.formData?.is_public !== false  // default true
    });
    const [loading, setLoading] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [linkedArcgisItems, setLinkedArcgisItems] = useState([]);
    const [arcgisLegends, setArcgisLegends] = useState({}); // { serviceKey: legendData }
    const [arcgisServiceByKey, setArcgisServiceByKey] = useState({});
    const [isArcgisPickerOpen, setIsArcgisPickerOpen] = useState(false);
    // Track which linked items have their layer shown on the map (keyed by item.id)
    const [linkedArcgisChecked, setLinkedArcgisChecked] = useState({});
    const layerViewerEmail = props.isLoggedIn ? (localStorage.getItem('email') || '').trim().toLowerCase() : '';
    const layerViewerRef = useRef(layerViewerEmail);
    layerViewerRef.current = layerViewerEmail;
    const visibilityRevisionRef = useRef({});
    const linkedArcgisItemsBackupRef = useRef(null); // backup of linkedArcgisItems when edit mode starts
    const [linkedCustomLayerItems, setLinkedCustomLayerItems] = useState([]);
    const [linkedCustomLayerChecked, setLinkedCustomLayerChecked] = useState({});
    const [linkedLayerError, setLinkedLayerError] = useState('');
    const fetchedCardLinksRef = useRef([]);
    const [isCustomLayerPickerOpen, setIsCustomLayerPickerOpen] = useState(false);
    const linkedCustomLayerItemsBackupRef = useRef(null);
    const [learnMoreLinks, setLearnMoreLinks] = useState([{ url: '', text: '' }]);
    const [editFormLinks, setEditFormLinks] = useState([{ url: '', text: '' }]);
    const [tagInput, setTagInput] = useState('');
    const [thumbnail, setThumbnail] = useState(null);
    const [preview, setPreview] = useState(
        formData.thumbnail_link && formData.thumbnail_link.trim() !== ""
            ? formData.thumbnail_link
            : "/CEREO-logo.png"
    );

    useEffect(() => {
        // Completely ignore prop updates while editing
        if (!isEditingRef.current) {
            setFormData((prev) => {
                const incomingCardID = props.formData?.cardID;
                const isSameCard = prev?.cardID === incomingCardID;
                const incomingHasImages = Array.isArray(props.formData?.images) && props.formData.images.length > 0;
                const prevHasImages = Array.isArray(prev?.images) && prev.images.length > 0;

                const mergedImages = (isSameCard && !incomingHasImages && prevHasImages)
                    ? prev.images
                    : (props.formData?.images || []);

                return {
                    ...props.formData,
                    images: mergedImages,
                    gallery_layout: props.formData?.gallery_layout ?? (isSameCard ? prev.gallery_layout : undefined),
                    gallery_image_ids: props.formData?.gallery_image_ids !== undefined ? props.formData.gallery_image_ids : (isSameCard ? prev.gallery_image_ids : undefined),
                    files: props.formData?.files || [],
                    filesToUpload: [],
                    is_public: props.formData?.is_public !== false
                };
            });
            setPreview(
                props.formData?.thumbnail_link && props.formData.thumbnail_link.trim() !== ""
                    ? props.formData.thumbnail_link
                    : "/CEREO-logo.png"
            );
        }
    }, [props.formData]);

    useEffect(() => {
        setIsFavorited(props.isFavorited);
    }, [props.isFavorited]);

    const showLinkedCustomLayer = useCallback((item,checked) => {
        toggleSharedCardLayer(item,checked,undefined,layerViewerEmail).catch(error => {
            if (layerViewerRef.current !== layerViewerEmail || !checked) return;
            console.warn('Linked layer could not be displayed:',error);
            setLinkedCustomLayerChecked(prev => ({...prev,[item.id]:false}));
            setLinkedLayerError('This linked layer could not be displayed. Please reopen the project or try again.');
        });
    }, [layerViewerEmail]);

    const applyFetchedCardLinks = useCallback(all => {
        setLinkedLayerError('');
        fetchedCardLinksRef.current.filter(old => !all.some(item => item.id === old.id && item.is_visible && item.shared_layer_key === old.shared_layer_key)).forEach(old => {
            if (old.item_type === 'uploaded_custom') showLinkedCustomLayer(old,false);
            else window.dispatchEvent(new CustomEvent('arcgis-layer-toggle',{detail:{serviceKey:old.service_key,layerId:old.layer_id,checked:false}}));
        });
        fetchedCardLinksRef.current = all;
        const arcgisItems = all.filter(item => item.item_type !== 'uploaded_custom');
        setLinkedArcgisItems(arcgisItems);
        setLinkedArcgisChecked(Object.fromEntries(arcgisItems.map(item => [item.id,Boolean(item.is_visible)])));
        arcgisItems.forEach(item => window.dispatchEvent(new CustomEvent('arcgis-layer-toggle', {
            detail:{serviceKey:item.service_key,layerId:item.layer_id,checked:Boolean(item.is_visible)},
        })));
        const customItems = all.filter(item => item.item_type === 'uploaded_custom');
        setLinkedCustomLayerItems(customItems);
        setLinkedCustomLayerChecked(Object.fromEntries(customItems.map(item => [item.id,Boolean(item.is_visible)])));
        customItems.forEach(item => showLinkedCustomLayer(item,Boolean(item.is_visible)));
    }, [showLinkedCustomLayer]);

    // Clear the previous account's map layers, including on logout or card unmount.
    useEffect(() => {
        return () => {
            fetchedCardLinksRef.current.forEach(item => {
                if (item.item_type === 'uploaded_custom') toggleSharedCardLayer(item,false,undefined,layerViewerEmail).catch(() => {});
                else window.dispatchEvent(new CustomEvent('arcgis-layer-toggle',{detail:{serviceKey:item.service_key,layerId:item.layer_id,checked:false}}));
            });
            fetchedCardLinksRef.current = [];
        };
    }, [layerViewerEmail]);

    useEffect(() => {
        setLinkedArcgisItems([]);
        setLinkedCustomLayerItems([]);
        setLinkedArcgisChecked({});
        setLinkedCustomLayerChecked({});
        setLinkedLayerError('');
        visibilityRevisionRef.current = {};
    }, [layerViewerEmail]);

    useEffect(() => {
        if (props.forceOpenLearnMoreSignal) {
            setIsModalOpen(true);
            refreshCardImages().catch(() => {});
        }
    }, [props.forceOpenLearnMoreSignal]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isModalOpen || !formData.cardID) return;
        let active = true;
        api.get(`/cardArcGISLinks?card_id=${formData.cardID}&user_email=${encodeURIComponent(layerViewerEmail)}`)
            .then(res => {
                if (active) applyFetchedCardLinks(resolveLinkedLayerVisibility(res.data.data || [],layerViewerEmail));
            })
            .catch(() => {
                if (active) setLinkedLayerError('Linked layer settings could not be loaded. Please reopen the project or try again.');
            });
        return () => { active = false; };
    }, [isModalOpen,formData.cardID,layerViewerEmail,applyFetchedCardLinks]);

    // Resolve linked services from the database when the card details open.
    useEffect(() => {
        if (!isModalOpen) return;
        let active = true;
        setArcgisServiceByKey({});
        fetchAllArcgisServices({ type: 'all' })
            .then(services => {
                if (active) setArcgisServiceByKey(Object.fromEntries(services.map(service => [service.key, service])));
            })
            .catch(error => console.error('Failed to load ArcGIS services from database:', error));
        return () => { active = false; };
    }, [isModalOpen]);

    // Fetch ArcGIS legend data for all service keys in linkedArcgisItems
    useEffect(() => {
        if (linkedArcgisItems.length === 0) return;
        const uniqueKeys = [...new Set(linkedArcgisItems.map(i => i.service_key))];
        uniqueKeys.forEach(key => {
            if (arcgisLegends[key] !== undefined) return;
            const serviceUrl = arcgisServiceByKey[key]?.url;
            if (!serviceUrl) return;
            fetchArcgisLegend(serviceUrl)
                .then(legend => setArcgisLegends(prev => ({ ...prev, [key]: legend || {} })))
                .catch(() => setArcgisLegends(prev => ({ ...prev, [key]: {} })));
        });
    }, [linkedArcgisItems, arcgisServiceByKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const persistLinkedVisibility = (item,checked,previous,apply) => {
        const email = layerViewerEmail;
        const revision = Symbol('visibility-change');
        visibilityRevisionRef.current[item.id] = revision;
        setLinkedLayerError('');
        saveLinkedLayerVisibility(item,checked,email).catch(() => {
            if (layerViewerRef.current !== email || visibilityRevisionRef.current[item.id] !== revision) return;
            apply(previous);
            setLinkedLayerError('Your layer display setting could not be saved. Please try again.');
        });
    };

    const handleToggleArcgisLayer = (item,nowChecked) => {
        const apply = checked => {
            setLinkedArcgisChecked(prev => ({...prev,[item.id]:checked}));
            window.dispatchEvent(new CustomEvent('arcgis-layer-toggle', {
                detail:{serviceKey:item.service_key,layerId:item.layer_id,checked},
            }));
        };
        const previous = !!linkedArcgisChecked[item.id];
        apply(nowChecked);
        persistLinkedVisibility(item,nowChecked,previous,apply);
    };

    const handleToggleCustomLayer = (item,nowChecked) => {
        const apply = checked => {
            setLinkedCustomLayerChecked(prev => ({...prev,[item.id]:checked}));
            showLinkedCustomLayer(item,checked);
        };
        const previous = !!linkedCustomLayerChecked[item.id];
        apply(nowChecked);
        persistLinkedVisibility(item,nowChecked,previous,apply);
    };

    // Ensure username and name always have safe defaults
    // Now handled by handleEdit
    /* useEffect(() => {
        if (props.formData) {
            setFormData({
                ...props.formData,
                username: props.formData.username || '',
                name: props.formData.name || '',
                files: props.formData.files || [],
                filesToUpload: []
            });
        }
    }, [props.formData]); */

    const handleLearnMore = (e) => {
        e.stopPropagation();
        setIsLearnMoreEditMode(false);
        setIsAllImagesView(false);
        setIsModalOpen(true);
        if (props.onLearnMore) props.onLearnMore();
        if (formData.cardID) refreshCardImages().catch(() => {});
    };

    const isLearnMoreModalVisible = isModalOpen && !isEditingPolygon && !isEditingCoordinate;

    // Close the "Change location type" menu on outside click
    useEffect(() => {
        if (!isLocationTypeMenuOpen) return;
        const handleClickOutside = (e) => {
            if (locationTypeMenuRef.current && !locationTypeMenuRef.current.contains(e.target)) {
                setIsLocationTypeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isLocationTypeMenuOpen]);

    useEffect(() => {
        if (!isLearnMoreModalVisible && isLearnMoreOnboardingOpen) {
            setIsLearnMoreOnboardingOpen(false);
        }
    }, [isLearnMoreModalVisible, isLearnMoreOnboardingOpen]);

    const [learnMoreOnboardingStep, setLearnMoreOnboardingStep] = useState(0);
    // True only when edit mode was entered automatically by the learn-more onboarding
    // tour — prevents the onboarding effect from exiting user-initiated edit mode
    // (e.g. when the modal is temporarily hidden during polygon editing).
    const onboardingEditModeRef = useRef(false);

    // Enter edit mode at step 5 (index 4+), exit when onboarding closes
    useEffect(() => {
        if (!isLearnMoreOnboardingOpen || !isLearnMoreModalVisible) {
            // Exit edit mode only if onboarding was the one that enabled it
            if (isLearnMoreEditMode && onboardingEditModeRef.current) {
                onboardingEditModeRef.current = false;
                setIsLearnMoreEditMode(false);
                isEditingRef.current = false;
            }
            return;
        }
        const shouldBeInEditMode = learnMoreOnboardingStep >= LEARN_MORE_EDIT_MODE_STEP;
        if (shouldBeInEditMode && !isLearnMoreEditMode) {
            onboardingEditModeRef.current = true;
            isEditingRef.current = true;
            setLearnMoreBackup({ ...formData });
            setLearnMoreLinks(parseLinks(formData.link, formData.link_text));
            linkedArcgisItemsBackupRef.current = linkedArcgisItems.map(item => ({ ...item }));
            linkedCustomLayerItemsBackupRef.current = linkedCustomLayerItems.map(item => ({ ...item }));
            setEditFormLinks(parseLinks(formData.link, formData.link_text));
            setFormData((prev) => ({
                ...prev,
                original_username: prev.username,
                original_email: prev.email,
                original_title: prev.title,
            }));
            setIsLearnMoreEditMode(true);
        } else if (!shouldBeInEditMode && isLearnMoreEditMode && onboardingEditModeRef.current) {
            onboardingEditModeRef.current = false;
            setIsLearnMoreEditMode(false);
            isEditingRef.current = false;
        }
    }, [isLearnMoreOnboardingOpen, isLearnMoreModalVisible, learnMoreOnboardingStep, isLearnMoreEditMode, formData, linkedArcgisItems, linkedCustomLayerItems]);

    const handleZoom = (e) => {
        e.stopPropagation();
        props.onZoom?.();
    };

    const handleOpenImagePreview = (e) => {
        e.stopPropagation();
        setIsImagePreviewOpen(true);
    };
  
    const handleEdit = (e) => {
        e.stopPropagation();
        isEditingRef.current = true; // Lock editing state
        setEditFormLinks(parseLinks(props.formData.link, props.formData.link_text));
        setFormData({
            ...props.formData,
            original_username: props.formData.username,
            original_email: props.formData.email,
            original_title: props.formData.title,
        });
        /*
        setFormData(prev => ({ 
            ...prev, 
            original_username: prev.username, 
            original_email: prev.email,
            filesToUpload: [] // reset upload buffer when editing
        }));
        */
        setIsEditModalOpen(true);
    };

    const handleDelete = (e) => {
        e.stopPropagation();

        if (!props.isLoggedIn && !isLearnMoreOnboardingOpen) {
            setShowLoginPrompt(true);
            return;
        }

        if (!formData.username || !formData.title) {
            alert("Missing username or title — cannot delete project.");
            return;
        }

        const viewerEmail = localStorage.getItem('email') || '';
        const cardOwnerEmail = formData.email || '';
        const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('isAdmin')); } catch { return false; } })();
        if (!isAdmin && viewerEmail && cardOwnerEmail && viewerEmail !== cardOwnerEmail) {
            alert("You don't have permission to delete this project. Only the project's creator or an admin can delete it.");
            return;
        }

        if (!window.confirm("Are you sure you want to delete this project?")) return;

        api.delete(`/deleteCard`, {
            params: {
                username: formData.username,
                title: formData.title,
                requester_email: viewerEmail,
            }
        })
        .then(() => {
            alert("Project deleted successfully.");
            if (typeof props.onCardDelete === "function") {
                props.onCardDelete(true);
            } else {
                window.location.reload();
            }
        })
        .catch((error) => {
            console.error("Delete failed:", error);
            alert("Failed to delete the project.");
        });
    };

    const handleDownloadPdf = async () => {
        if (!props.isLoggedIn && !isLearnMoreOnboardingOpen) {
            setShowLoginPrompt(true);
            return;
        }
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 40;
        const maxW = pageW - margin * 2;
        let y = margin;

        const addText = (text, opts = {}) => {
            const { fontSize = 12, bold = false, color = [33, 33, 33], wrap = true } = opts;
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.setTextColor(...color);
            if (wrap) {
                const lines = doc.splitTextToSize(String(text || ''), maxW);
                lines.forEach(line => {
                    if (y > doc.internal.pageSize.getHeight() - margin) {
                        doc.addPage();
                        y = margin;
                    }
                    doc.text(line, margin, y);
                    y += fontSize * 1.4;
                });
            } else {
                if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
                doc.text(String(text || ''), margin, y);
                y += fontSize * 1.4;
            }
        };

        const addField = (label, value) => {
            if (!value && value !== 0) return;
            const str = String(value).trim();
            if (!str) return;
            addText(`${label}: ${str}`, { fontSize: 11 });
        };

        const addDivider = () => {
            if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, y, pageW - margin, y);
            y += 10;
        };

        // Title
        addText(formData.title || 'Untitled', { fontSize: 20, bold: true });
        y += 6;
        addDivider();

        // Meta fields
        addField('Uploaded by', formData.username);
        addField('Category', formData.category);
        addField('Organization', formData.org);
        addField('Funding', formData.funding);
        addField('Tags', formData.tags);
        if (formData.created_date) addField('Created', new Date(formData.created_date).toLocaleDateString());

        // Location
        const exportLocationType = formData.location_type;
        if (exportLocationType === 'polygon') {
            addField('Location type', 'Polygon area');
        } else if (exportLocationType === 'image') {
            addField('Location type', 'Image overlay');
        } else if (formData.lat !== undefined && formData.lat !== null && formData.lon !== undefined && formData.lon !== null) {
            addField('Latitude', formData.lat);
            addField('Longitude', formData.lon);
        }

        // Description
        if (formData.description) {
            y += 6;
            addDivider();
            addText('Description', { fontSize: 13, bold: true });
            addText(htmlToPlainText(formData.description), { fontSize: 11 });
        }

        // Links
        const links = parseLinks(formData.link, formData.link_text).filter(l => l.url && l.url.trim());
        if (links.length > 0) {
            y += 6;
            addDivider();
            addText('Links', { fontSize: 13, bold: true });
            links.forEach(l => {
                const label = l.text ? `${l.text} — ${l.url}` : l.url;
                addText(label, { fontSize: 11, color: [37, 99, 235] });
            });
        }

        // Attached files
        if (formData.files && formData.files.length > 0) {
            y += 6;
            addDivider();
            addText('Attached Files', { fontSize: 13, bold: true });
            formData.files.forEach(f => addText(`• ${f.filename || 'File'}`, { fontSize: 11 }));
        }

        // Helper: load an image URL through the backend URL proxy (avoids GCS CORS)
        const loadImageViaUrlProxy = async (url) => {
            const response = await api.get('/imageUrlProxy', {
                params: { url },
                responseType: 'arraybuffer'
            });
            const bytes = new Uint8Array(response.data);
            let binary = '';
            bytes.forEach(b => { binary += String.fromCharCode(b); });
            const base64Str = btoa(binary);
            const contentType = (response.headers['content-type'] || 'image/jpeg').split(';')[0];
            const dataUrl = `data:${contentType};base64,${base64Str}`;
            const imgProps = doc.getImageProperties(dataUrl);
            return {
                dataUrl,
                format: contentType.includes('png') ? 'PNG' : 'JPEG',
                width: imgProps.width,
                height: imgProps.height
            };
        };
        // Helper: embed one image (dataUrl) into the PDF at current y position
        const embedImageInPdf = (dataUrl, format, width, height) => {
            const imgAspect = width / height;
            const imgW = Math.min(maxW, 400);
            const imgH = imgW / imgAspect;
            if (y + imgH > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                y = margin;
            }
            doc.addImage(dataUrl, format, margin, y, imgW, imgH);
            y += imgH + 14;
        };

        // Images — try backend proxy first (avoids CORS), fall back to canvas
        const imageRecords = (formData.images && Array.isArray(formData.images) && formData.images.length > 0)
            ? formData.images.filter(img => img.imageID != null)
            : [];

        // For cards with no CardImages entries, fall back to thumbnail_link
        const thumbnailFallbackUrl = (imageRecords.length === 0 && formData.thumbnail_link
            && formData.thumbnail_link.trim() !== ''
            && !formData.thumbnail_link.includes('CEREO-logo'))
            ? formData.thumbnail_link.trim()
            : null;

        if (imageRecords.length > 0 || thumbnailFallbackUrl) {
            y += 6;
            addDivider();
            addText('Images', { fontSize: 13, bold: true });
            y += 4;

            for (const imgRecord of imageRecords) {
                let embedded = false;
                // 1. Try backend proxy (returns raw bytes, bypasses GCS CORS)
                try {
                    const response = await api.get(`/cardImageProxy/${imgRecord.imageID}`, { responseType: 'arraybuffer' });
                    const bytes = new Uint8Array(response.data);
                    let binary = '';
                    bytes.forEach(b => { binary += String.fromCharCode(b); });
                    const base64Str = btoa(binary);
                    const contentType = (response.headers['content-type'] || 'image/jpeg').split(';')[0];
                    const dataUrl = `data:${contentType};base64,${base64Str}`;
                    const imgProps = doc.getImageProperties(dataUrl);
                    const fmt = contentType.includes('png') ? 'PNG' : 'JPEG';
                    embedImageInPdf(dataUrl, fmt, imgProps.width, imgProps.height);
                    embedded = true;
                } catch (_proxyErr) { /* fall through to canvas */ }

                // 2. Fall back to URL proxy (image ID proxy may have failed; try fetching image URL via backend)
                if (!embedded) {
                    try {
                        const normalized = normalizeImageRecord(imgRecord);
                        const { dataUrl, format, width, height } = await loadImageViaUrlProxy(normalized.url);
                        embedImageInPdf(dataUrl, format, width, height);
                        embedded = true;
                    } catch (_urlProxyErr) { /* fall through */ }
                }

                if (!embedded) {
                    addText('[Image could not be embedded]', { fontSize: 10, color: [150, 150, 150] });
                }
            }

            // Thumbnail fallback for cards without CardImages entries
            if (thumbnailFallbackUrl) {
                try {
                    const { dataUrl, format, width, height } = await loadImageViaUrlProxy(thumbnailFallbackUrl);
                    embedImageInPdf(dataUrl, format, width, height);
                } catch (_err) {
                    addText('[Image could not be embedded]', { fontSize: 10, color: [150, 150, 150] });
                }
            }
        }

        const safeName = (formData.title || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${safeName}.pdf`);
    };

    const handleFavoriteClick = async (e) => {
        e.stopPropagation();

        if (!props.isLoggedIn) {
            setShowLoginPrompt(true);
            return;
        }

        const cardID = formData.cardID || props.cardID;
        const username = formData.viewerUsername || formData.username || props.username;

        console.log("cardID being sent:", cardID);
        console.log("username being sent:", username);

        if (!cardID) {
            console.error("Missing cardID");
            alert("Error: Cannot favorite this project — missing project ID.");
            return;
        }

        if (!username) {
            console.error("Missing username");
            alert("Error: Cannot favorite this project — missing username.");
            return;
        }

        try {
            const endpoint = !isFavorited ? '/bookmarkCard' : '/unbookmarkCard';
            const formData = new FormData();
            formData.append('username', username);
            formData.append('cardID', cardID);

            await api.post(endpoint, formData);

            setIsFavorited(prev => !prev);

            if (props.fetchBookmarks) props.fetchBookmarks();
            if (props.onBookmarkChange) props.onBookmarkChange();

        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    };

    const isPolygonCard = formData.location_type === 'polygon';
    const isImageCard = formData.location_type === 'image';
    const isOverlayCard = isPolygonCard || isImageCard;

    const getRepresentativeImageUrl = useCallback((data = formData) => {
        if (data.location_type === 'image') {
            return resolveImageUrl(data.thumbnail_link || preview || '/CEREO-logo.png');
        }
        const imageRecords = Array.isArray(data.images) ? data.images : [];
        const firstImage = imageRecords[0];
        if (typeof firstImage === 'string') return resolveImageUrl(firstImage);
        if (firstImage?.url || firstImage?.imageURL) {
            return resolveImageUrl(firstImage.url || firstImage.imageURL);
        }
        return resolveImageUrl(data.thumbnail_link || preview || '/CEREO-logo.png');
    }, [formData, preview]);

    const validateForm = () => {
        const requiredFields = isOverlayCard
            ? ['username', 'name', 'email', 'title', 'category']
            : ['username', 'name', 'email', 'title', 'category', 'latitude', 'longitude'];
        for (const field of requiredFields) {
            const value = formData[field];
            if (value === undefined || value === null || value.toString().trim() === '') {
                alert(`Please fill out the ${field} field.`);
                return false;
            }
            if (field === 'latitude' && (Number(value) < -90 || Number(value) > 90)) {
                alert('Latitude must be between -90 and 90.');
                return false;
            }
            if (field === 'longitude' && (Number(value) < -180 || Number(value) > 180)) {
                alert('Longitude must be between -180 and 180.');
                return false;
            }
        }
        if (isPolygonCard && (!Array.isArray(formData.polygon_vertices) || formData.polygon_vertices.length < 3)) {
            alert('Polygon projects must keep at least 3 points.');
            return false;
        }
        if (isImageCard && (!Array.isArray(formData.polygon_vertices) || formData.polygon_vertices.length < 4)) {
            alert('Image projects must keep 4 corner points.');
            return false;
        }
        return true;
    };

    const saveEdits = async (options = {}) => {
     const { skipReload = false, closeEditModal = true, linkOverride } = options;
    if (!validateForm()) return;

    // Extra guard for username and name
    if (!formData.username?.trim() || !formData.name?.trim()) {
        alert("Both Username and name are required.");
        return;
    }

    // Validate username exists if it was changed
    if (formData.original_username && formData.username !== formData.original_username) {
        try {
            await api.get(`/profileAccount?username=${encodeURIComponent(formData.username)}`);
        } catch (error) {
            if (error.response?.status === 404) {
                alert(`Project Creator "${formData.username}" does not exist. Please use a valid username.`);
                return;
            }
        }
    }

    let effectiveThumbnailLink = formData.thumbnail_link || '';
    if (!isImageCard && !thumbnail && Array.isArray(formData.images) && formData.images.length > 0) {
        const firstImage = formData.images[0];
        const firstImageUrl = typeof firstImage === 'string'
            ? firstImage
            : (firstImage?.url || firstImage?.imageURL || '');

        if (firstImageUrl) {
            effectiveThumbnailLink = firstImageUrl;
        }
    }

    const formDataToSend = new FormData();
    Object.keys(formData).forEach((key) => {
        if (
            key !== "files" &&
            key !== "filesToUpload" &&
            key !== "images" &&
            key !== "gallery_image_ids" &&
            key !== "thumbnail_link" &&
            key !== "polygon_vertices" &&
            key !== "category" &&
            formData[key] !== undefined && formData[key] !== null
        ) {
            if (linkOverride && (key === 'link' || key === 'link_text')) return;
            formDataToSend.append(key, formData[key]);
        }
    });
    if (Array.isArray(formData.gallery_image_ids)) {
        const existingIDs = new Set((formData.images || []).map(galleryImageID));
        formDataToSend.append('gallery_image_ids', JSON.stringify(formData.gallery_image_ids.filter(id => existingIDs.has(id)).slice(0, MAX_GALLERY_IMAGES)));
    }
    if (linkOverride) {
        formDataToSend.append('link', linkOverride.link ?? '');
        formDataToSend.append('link_text', linkOverride.link_text ?? '');
    }
    formDataToSend.append('category', formData.category || 'None');
    const imagePresentations = Object.fromEntries((formData.images || [])
        .filter(image => resolveImageServerID(image) && image.presentation)
        .map(image => [resolveImageServerID(image), image.presentation]));
    if (Object.keys(imagePresentations).length) formDataToSend.append('image_presentations', JSON.stringify(imagePresentations));

    // Send polygon vertices as JSON string if polygon card
    if (isOverlayCard && Array.isArray(formData.polygon_vertices) && formData.polygon_vertices.length >= (isImageCard ? 4 : 3)) {
        const pv = formData.polygon_vertices;
        if (isImageCard) {
            // Image overlays use flat 4-corner vertices (no ring concept)
            formDataToSend.append('polygon_coordinates', JSON.stringify({
                vertices: pv,
                fillColor: formData.polygon_fill_color,
                lineStyle: formData.polygon_line_style
            }));
        } else {
            // Polygon cards: build rings from flat array with ring property
            const ringMap = new Map();
            for (const v of pv) {
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
                fillColor: data.style.fillColor || formData.polygon_fill_color,
                fillOpacity: data.style.fillOpacity ?? formData.polygon_fill_opacity ?? 0.2,
                lineStyle: data.style.lineStyle || formData.polygon_line_style,
            }));
            formDataToSend.append('polygon_coordinates', JSON.stringify({
                rings,
                ringStyles,
                fillColor: formData.polygon_fill_color,
                fillOpacity: formData.polygon_fill_opacity,
                lineStyle: formData.polygon_line_style
            }));
        }
    } else if (formData.location_type === 'multipoint' && Array.isArray(formData.polygon_vertices) && formData.polygon_vertices.length > 0) {
        // Multi-point cards store their per-point icon/color/opacity in CardPolygonVertices too.
        // The backend clears and re-inserts that table on every update, so every save must
        // resend the current points here — otherwise a save (e.g. right after linking a custom
        // layer) silently wipes the points and their icons.
        formDataToSend.append('multipoint_coordinates', JSON.stringify(
            formData.polygon_vertices.map(v => ({
                lat: v.lat,
                lng: v.lng,
                icon: v.icon,
                color: v.markerColor,
                opacity: v.markerOpacity,
            }))
        ));
    }

    //Only true if editing an existing card
    formDataToSend.append("update", !!formData.cardID);

    // Always include originals, fallback to current for new cards
    formDataToSend.append(
        "original_username",
        formData.original_username || formData.username
    );
    formDataToSend.append(
        "original_email",
        formData.original_email || formData.email
    );
    formDataToSend.append(
        "original_title",
        formData.original_title || formData.title
    );

    // NEW: If no new thumbnail selected, keep the existing one
    if (effectiveThumbnailLink && !thumbnail) {
        formDataToSend.append("thumbnail_link", effectiveThumbnailLink);
    }

    // If user uploaded a new thumbnail, append it as usual
    if (thumbnail) {
        formDataToSend.append("thumbnail", thumbnail);
    }

    appendDescriptionFileTokens(formDataToSend, formData.filesToUpload);
    // Append multiple files safely
    if (formData.filesToUpload && formData.filesToUpload.length > 0) {
        formData.filesToUpload.forEach((file) => {
            formDataToSend.append("files", file);
        });
    }

    const requesterEmail = localStorage.getItem('email') || '';
    if (requesterEmail) {
        formDataToSend.append('requester_email', requesterEmail);
    }

    setLoading(true);
    try {
        await api.post("/uploadForm", formDataToSend);
        alert("Project Information Saved.");
        isEditingRef.current = !closeEditModal; // Keep learn-more drafts protected through image saves.
        if (closeEditModal) {
            setIsEditModalOpen(false);
        }

        if (typeof props.onCardUpdate === "function") {
            props.onCardUpdate();
        } else if (!skipReload) {
            window.location.reload();
        }
        return true;
    } catch (error) {
        console.error("Failed to save the card:", error);
        
        // Extract detailed error message from backend response
        let errorMessage = "Failed to save the project. Please try again.";
        const detail = error.response?.data?.detail;
        const detailText = typeof detail === "string" ? detail : "";

        if (detailText.includes("Card Creator username does not exist")) {
            errorMessage = "Project Creator does not exist. Please enter an existing username.";
        } else if (detailText.includes("Card not found for update")) {
            errorMessage = "Could not save because the original project was not found. If you changed the Title, close and reopen Edit, then try again.";
        } else if (detailText) {
            errorMessage = `Error: ${detailText}`;
        } else if (error.response?.data?.message) {
            errorMessage = `Error: ${error.response.data.message}`;
        } else if (error.response?.status === 404) {
            errorMessage = "Unable to save: project or project creator was not found.";
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        console.error("Error details:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
        
        alert(errorMessage);
        return false;
    } finally {
        setLoading(false);
    }
};

    // Hide every stored representation until this draft is saved or discarded.
    // The map also reapplies this after marker refreshes and style changes.
    useEffect(() => {
        const cardID = formData.cardID || props.cardID;
        if (!cardID || !hideCardMapRepresentation || !isModalOpen) return undefined;
        setCardLocationEditing(cardID, true);
        return () => setCardLocationEditing(cardID, false);
    }, [hideCardMapRepresentation, isModalOpen, formData.cardID, props.cardID]);

    // Edit an existing point card's coordinate(s): hide the learn-more modal and
    // open the same "Add Points" tool used by the map's "Add card from map" toolbar.
    const handleEditCoordinate = useCallback(() => {
        const map = window.atlasMapInstance;
        if (!map) { console.error('Map not found'); return; }
        setIsLocationTypeMenuOpen(false);
        editorMapHiddenBackupRef.current = hideCardMapRepresentation;
        setHideCardMapRepresentation(true);
        setIsEditingCoordinate(true);
        document.querySelectorAll('.card-pin-rich-popup .mapboxgl-popup-close-button').forEach(button => button.click());
        const lat = parseFloat(formData.latitude);
        const lng = parseFloat(formData.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            map.flyTo({ center: [lng, lat], zoom: 14 });
        }
    }, [formData.latitude, formData.longitude, hideCardMapRepresentation]);

    const handleCoordinateEditSave = useCallback((points) => {
        const first = points?.[0];
        if (!first) return;
        setFormData(prev => {
            const type = points.length > 1 || (!conversionTargetType && prev.location_type === 'multipoint') ? 'multipoint' : 'point';
            return {
                ...prev,
                location_type: type,
                latitude: Number(first.lat).toFixed(6),
                longitude: Number(first.lng).toFixed(6),
                polygon_vertices: type === 'multipoint' ? points.map(p => ({
                    lat: p.lat, lng: p.lng, icon: p.icon,
                    markerColor: p.color, markerOpacity: p.opacity,
                })) : [],
            };
        });
        setConversionTargetType(null);
        setIsEditingCoordinate(false);
        isEditingRef.current = true;
        setIsLearnMoreEditMode(true);
    }, [conversionTargetType]);

    const handleCoordinateEditCancel = useCallback(() => {
        setHideCardMapRepresentation(editorMapHiddenBackupRef.current);
        setConversionTargetType(null);
        setIsEditingCoordinate(false);
    }, []);

    const handleChangeLocationType = useCallback((targetType, event) => {
        event?.stopPropagation();
        const currentType = ['polygon', 'image'].includes(formData.location_type) ? formData.location_type : 'point';
        if (targetType === currentType) return;
        const map = window.atlasMapInstance;
        if (!map) { console.error('Map not found'); return; }
        editorMapHiddenBackupRef.current = hideCardMapRepresentation;
        setIsLocationTypeMenuOpen(false);
        setHideCardMapRepresentation(true);
        setConversionTargetType(targetType);
        if (targetType === 'point') setIsEditingCoordinate(true);
        else setIsEditingPolygon(true);
        const lat = Number(formData.latitude), lng = Number(formData.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) map.flyTo({ center: [lng, lat], zoom: 14 });
    }, [formData.location_type, formData.latitude, formData.longitude, hideCardMapRepresentation]);

    // Edit polygon: hide modal → fly to polygon → open PolygonDrawingModal
    const handleEditPolygon = useCallback(() => {
        const map = window.atlasMapInstance;
        const verts = formData.polygon_vertices;
        const minimumVertices = formData.location_type === 'image' ? 4 : 3;
        if (!map || !Array.isArray(verts) || verts.length < minimumVertices) return;

        editorMapHiddenBackupRef.current = hideCardMapRepresentation;
        setHideCardMapRepresentation(true);

        setIsEditingPolygon(true);

        // Fly to polygon bounds
        const lats = verts.map(v => v.lat);
        const lngs = verts.map(v => v.lng);
        const bounds = [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)]
        ];
        map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    }, [formData.polygon_vertices, formData.location_type, hideCardMapRepresentation]);

    // After polygon/image edit save: update formData and return to learn-more modal (edit mode).
    // PolygonDrawingModal's onSave signature differs by mode: polygon mode passes an
    // array of rings (each an array of vertices) plus per-ring styles; image mode passes
    // a single flat array of the 4 corner vertices plus the placed image slots (not styles).
    const handlePolygonEditSave = useCallback((allRingsOrVerts, centroid, style, ringStylesOrSlots = []) => {
        const targetType = conversionTargetType || formData.location_type;
        const isImageSave = targetType === 'image';
        const imageSlot = isImageSave ? ringStylesOrSlots[0] : null;
        const imageChanged = Boolean(imageSlot?.file) || Boolean(imageSlot?.url && imageSlot.url !== getRepresentativeImageUrl());
        const flatVerts = isImageSave
            ? allRingsOrVerts.map(v => ({ ...v, ring: 0 }))
            : allRingsOrVerts.flatMap((ring, ringIdx) => {
                const rs = ringStylesOrSlots[ringIdx] || {};
                return ring.map(v => ({
                    ...v,
                    ring: ringIdx,
                    fillColor: rs.fillColor,
                    fillOpacity: rs.fillOpacity,
                    lineStyle: rs.lineStyle,
                }));
            });
        // ringStylesOrSlots[0] holds image slot data (not a style object) in image mode,
        // so always fall back to the shared `style` object there.
        const primaryStyle = isImageSave ? (style || {}) : (ringStylesOrSlots[0] || style || {});

        // If nothing actually changed in the polygon editor, return to the
        // learn-more modal without touching formData so the "unsaved changes"
        // badge doesn't light up. Compare geometry + per-ring styles in a
        // normalized form (stored vertices may lack per-vertex style fields
        // and use strings for numeric values).
        const cardFillColor = formData.polygon_fill_color || '#0077c0';
        const cardFillOpacity = formData.polygon_fill_opacity != null ? Number(formData.polygon_fill_opacity) : 0.15;
        const cardLineStyle = formData.polygon_line_style || 'solid';
        const normalizeVertex = (v) => ({
            ring: v.ring ?? 0,
            lat: parseFloat(Number(v.lat).toFixed(6)),
            lng: parseFloat(Number(v.lng).toFixed(6)),
            fillColor: v.fillColor || cardFillColor,
            fillOpacity: v.fillOpacity != null ? Number(v.fillOpacity) : cardFillOpacity,
            lineStyle: v.lineStyle || cardLineStyle,
        });
        const polygonUnchanged = !isConvertingLocationType && !imageChanged &&
            JSON.stringify((formData.polygon_vertices || []).map(normalizeVertex)) ===
            JSON.stringify(flatVerts.map(normalizeVertex));
        if (polygonUnchanged) {
            setIsEditingPolygon(false);
            // Ensure learn-more modal stays in edit mode
            isEditingRef.current = true;
            setIsLearnMoreEditMode(true);
            setHideCardMapRepresentation(editorMapHiddenBackupRef.current);
            return;
        }

        setFormData(prev => ({
            ...prev,
            location_type: targetType,
            polygon_vertices: flatVerts,
            ...(imageSlot?.url && !imageSlot.file ? { thumbnail_link: imageSlot.url } : {}),
            latitude: centroid.lat.toFixed(6),
            longitude: centroid.lng.toFixed(6),
            polygon_fill_color: primaryStyle.fillColor || prev.polygon_fill_color,
            polygon_line_style: primaryStyle.lineStyle || prev.polygon_line_style,
            polygon_fill_opacity: primaryStyle.fillOpacity ?? prev.polygon_fill_opacity,
        }));
        setIsEditingPolygon(false);
        setConversionTargetType(null);
        // Ensure learn-more modal stays in edit mode
        isEditingRef.current = true;
        setIsLearnMoreEditMode(true);

        if (imageSlot?.file) {
            setThumbnail(imageSlot.file);
            setPreview(imageSlot.url);
        }
        // The draft preview uses the new geometry. Content1 renders it after the
        // main Save succeeds, keeping cancel free of persistent map mutations.
    }, [conversionTargetType, formData.location_type, formData.polygon_fill_color, formData.polygon_fill_opacity, formData.polygon_line_style, formData.polygon_vertices, isConvertingLocationType, getRepresentativeImageUrl]);

    const handlePolygonEditCancel = useCallback(() => {
        setConversionTargetType(null);
        setIsEditingPolygon(false);
        setHideCardMapRepresentation(editorMapHiddenBackupRef.current);
    }, []);

    const handleLearnMoreEditStart = (e) => {
        e.stopPropagation();

        if (!props.isLoggedIn && !isLearnMoreOnboardingOpen) {
            setShowLoginPrompt(true);
            return false;
        }

        const _viewerEmail = localStorage.getItem('email') || '';
        const _cardOwnerEmail = formData.email || '';
        const _isAdmin = (() => { try { return JSON.parse(localStorage.getItem('isAdmin')); } catch { return false; } })();
        if (!_isAdmin && _viewerEmail && _cardOwnerEmail && _viewerEmail !== _cardOwnerEmail) {
            alert("You don't have permission to edit this project. Only the project's creator or an admin can edit it.");
            return false;
        }
        setLearnMoreBackup({ ...formData });
        setLearnMoreLinks(parseLinks(formData.link, formData.link_text));
        linkedArcgisItemsBackupRef.current = linkedArcgisItems.map(i => ({ ...i }));
        linkedCustomLayerItemsBackupRef.current = linkedCustomLayerItems.map(i => ({ ...i }));
        setSessionUploadedImageIDs([]);
        setSelectedAllImageIDs([]);
        setPendingDeletedImageIDs([]);
        setFormData((prev) => ({
            ...prev,
            original_username: prev.original_username || prev.username,
            original_email: prev.original_email || prev.email,
            original_title: prev.original_title || prev.title,
        }));
        isEditingRef.current = true;
        setIsLearnMoreEditMode(true);

        if (formData.cardID || props.cardID) {
            refreshCardImages().catch((error) => {
                console.error('Failed to refresh card images:', error);
            });
        }
        return true;
    };

    useEffect(() => {
        if (!props.forceOpenLearnMoreSignal || !props.forceEditLocation) return;
        if (!handleLearnMoreEditStart({ stopPropagation() {} })) return;
        if (formData.location_type === 'polygon' || formData.location_type === 'image') {
            handleEditPolygon();
        } else {
            handleEditCoordinate();
        }
    }, [props.forceOpenLearnMoreSignal]); // eslint-disable-line react-hooks/exhaustive-deps

    const rollbackSessionUploads = async () => {
        if (sessionUploadedImageIDs.length === 0) return;

        for (const imageID of sessionUploadedImageIDs) {
            try {
                await api.delete(`/deleteCardImage/${imageID}`);
            } catch (error) {
                console.error('Failed to rollback uploaded image:', imageID, error);
            }
        }

        setSessionUploadedImageIDs([]);
    };

    const handleLearnMoreEditCancel = async (e) => {
        if (e?.stopPropagation) e.stopPropagation();
        if (isImageMutationLoading) return;

        setImageUploadJobs([]);
        setFramingImage(null);
        setTagInput('');
        // Clean up any active coordinate editing
        setHideCardMapRepresentation(false);
        setIsEditingCoordinate(false);
        setIsEditingPolygon(false);
        setConversionTargetType(null);
        setThumbnail(null);
        setPreview('');

        setIsImageMutationLoading(true);
        await rollbackSessionUploads();

        if (learnMoreBackup) {
            setFormData(learnMoreBackup);
        }
        if (linkedArcgisItemsBackupRef.current !== null) {
            setLinkedArcgisItems(linkedArcgisItemsBackupRef.current);
            linkedArcgisItemsBackupRef.current = null;
        }
        if (linkedCustomLayerItemsBackupRef.current !== null) {
            setLinkedCustomLayerItems(linkedCustomLayerItemsBackupRef.current);
            linkedCustomLayerItemsBackupRef.current = null;
        }

        isEditingRef.current = false;
        setIsLearnMoreEditMode(false);
        setPendingImageSlotIndex(null);
        setSelectedAllImageIDs([]);
        setPendingDeletedImageIDs([]);
        setIsImageMutationLoading(false);
        setLearnMoreBackup(null);
    };

    const applyPendingImageDeletes = async () => {
        if (!pendingDeletedImageIDs.length) return;

        const uniqueIDs = [...new Set(pendingDeletedImageIDs)].filter((id) => Number.isInteger(id) && id > 0);
        if (!uniqueIDs.length) return;

        for (const imageID of uniqueIDs) {
            await api.delete(`/deleteCardImage/${imageID}`);
        }

        setSessionUploadedImageIDs((prev) => prev.filter((id) => !uniqueIDs.includes(id)));
        setPendingDeletedImageIDs([]);
        setSelectedAllImageIDs([]);
    };

    const applyImageReordering = async () => {
        const cardID = formData.cardID || props.cardID;
        const images = formData.images || [];
        
        if (!images.length || !cardID) return;

        // Extract imageIDs in current order, filtering out temporary records
        const imageOrder = images
            .map((img) => resolveImageServerID(img))
            .filter((id) => id !== null);

        if (!imageOrder.length) return;

        try {
            const response = await api.put(`/reorderCardImages?cardID=${cardID}`, imageOrder);
            console.log('Image reordering successful:', response.data);
        } catch (error) {
            const errorMsg = error.response?.data?.detail || error.message || 'Unknown error';
            console.error('Failed to reorder images:', errorMsg);
            throw error;
        }
    };

    const handleLearnMoreEditSave = async (e) => {
        e.stopPropagation();
        if (loading || isImageMutationLoading) return;
        if (imageUploadJobs.some(job => job.status === 'failed')) { alert('Retry or remove failed uploads before saving.'); return; }
        setIsImageMutationLoading(true);
        try {
            const serializedLink = serializeLinks(learnMoreLinks);
            const success = await saveEdits({
                skipReload: true,
                closeEditModal: false,
                linkOverride: { link: serializedLink, link_text: '' },
            });
            if (success) {
                try {
                    await applyPendingImageDeletes();
                } catch (error) {
                    console.error('Failed to apply pending image deletions:', error);
                    alert('Some selected images could not be deleted. Please try saving again.');
                    return;
                }
                try {
                    await applyImageReordering();
                } catch (error) {
                    console.error('Failed to apply image reordering:', error);
                    alert('Image order could not be saved. Please try saving again.');
                    return;
                }
                isEditingRef.current = false;
                await refreshCardRecord();
                await refreshCardImages();
                // This save path skips the page reload, so the map still shows the
                // pre-edit markers and polygons. Ask Content1/Content2 to re-fetch, the
                // same way creating a card from the map does.
                setHideCardMapRepresentation(false);
                setThumbnail(null);
                setPreview('');
                window.dispatchEvent(new CustomEvent('atlas:card-uploaded'));
                setIsLearnMoreEditMode(false);
                setLearnMoreBackup(null);
                setSessionUploadedImageIDs([]);
                setSelectedAllImageIDs([]);
                setPendingDeletedImageIDs([]);
            }
        } finally {
            setIsImageMutationLoading(false);
        }
    };

    // Compare the active draft snapshot, including a draft left after a tutorial.
    const hasUnsavedChanges = useMemo(() => {
        if (!learnMoreBackup) return false;

        // Compare tracked formData fields
        const trackedFields = [
            'title', 'description', 'tags', 'category', 'username', 'name', 'contact_email',
            'funding', 'org', 'is_public',
            'latitude', 'longitude', 'location_type',
            'polygon_vertices', 'polygon_fill_color', 'polygon_line_style', 'polygon_fill_opacity',
            'website_link', 'thumbnail_link', 'files', 'gallery_layout', 'gallery_image_ids',
        ];
        for (const field of trackedFields) {
            if (JSON.stringify(formData[field]) !== JSON.stringify(learnMoreBackup[field])) return true;
        }

        if (formData.filesToUpload?.length || thumbnail || pendingDeletedImageIDs.length || sessionUploadedImageIDs.length) return true;
        if (imageUploadJobs.some(job => job.status !== 'done')) return true;
        // Compare images, including staged framing.
        if (JSON.stringify((formData.images || []).map(image => image.presentation)) !== JSON.stringify((learnMoreBackup.images || []).map(image => image.presentation))) return true;
        // Compare images (order + identity)
        if (JSON.stringify((formData.images || []).map(i => i.imageID ?? i.id)) !==
            JSON.stringify((learnMoreBackup.images || []).map(i => i.imageID ?? i.id))) return true;

        // Compare links
        const backupLinks = parseLinks(learnMoreBackup.link, learnMoreBackup.link_text);
        if (JSON.stringify(learnMoreLinks) !== JSON.stringify(backupLinks)) return true;

        // Compare linked ArcGIS items
        const backup = linkedArcgisItemsBackupRef.current;
        if (backup !== null) {
            const currentIds = linkedArcgisItems.map(i => i.id).sort().join(',');
            const backupIds = backup.map(i => i.id).sort().join(',');
            if (currentIds !== backupIds) return true;
        }

        // Compare linked custom layer items
        const customBackup = linkedCustomLayerItemsBackupRef.current;
        if (customBackup !== null) {
            const currentIds = linkedCustomLayerItems.map(i => i.id).sort().join(',');
            const backupIds = customBackup.map(i => i.id).sort().join(',');
            if (currentIds !== backupIds) return true;
        }

        return false;
    }, [learnMoreBackup, formData, linkedArcgisItems, linkedCustomLayerItems, learnMoreLinks, imageUploadJobs, thumbnail, pendingDeletedImageIDs, sessionUploadedImageIDs]);

    const handleLearnMoreClose = async (e) => {
        if (e?.stopPropagation) e.stopPropagation();
        if (loading || isImageMutationLoading) return false;

        if (hasUnsavedChanges) {
            const confirmed = window.confirm('You have unsaved changes. Discard them and close?');
            if (!confirmed) return false;
        }

        if (isLearnMoreEditMode || hasUnsavedChanges) {
            await handleLearnMoreEditCancel(e);
        }

        setIsAllImagesView(false);
        setIsModalOpen(false);
        return true;
    };


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const addTag = (raw) => {
        const tag = String(raw || '').trim();
        if (!tag) return;
        setFormData((prev) => {
            const existing = parseTags(prev.tags);
            if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev;
            return { ...prev, tags: serializeTags([...existing, tag]) };
        });
    };

    const removeTag = (tagToRemove) => {
        setFormData((prev) => ({
            ...prev,
            tags: serializeTags(parseTags(prev.tags).filter((t) => t !== tagToRemove)),
        }));
    };

    const handleTagInputChange = (e) => setTagInput(e.target.value);

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagInput);
            setTagInput('');
        } else if (e.key === 'Backspace' && !tagInput) {
            const tags = parseTags(formData.tags);
            if (tags.length > 0) removeTag(tags[tags.length - 1]);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setThumbnail(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const resolveImageUrl = (url) => {
        if (!url) return "/CEREO-logo.png";
        if (/^https?:\/\//i.test(url)) return url;

        const baseURL = (api.defaults.baseURL || "").replace(/\/$/, "");
        if (!baseURL) return url;

        return url.startsWith('/') ? `${baseURL}${url}` : `${baseURL}/${url}`;
    };

    const normalizeImageRecord = (image, fallbackId = 0) => {
        if (typeof image === 'string') {
            return {
                id: fallbackId,
                imageID: null,
                url: resolveImageUrl(image),
                alt: ''
            };
        }

        if (!image || typeof image !== 'object') {
            return {
                id: fallbackId,
                imageID: null,
                url: '/CEREO-logo.png',
                alt: ''
            };
        }

        return {
            ...image,
            id: image.id ?? image.imageID ?? image.imageId ?? fallbackId,
            imageID: image.imageID ?? image.imageId ?? image.id ?? null,
            url: resolveImageUrl(image.url || image.imageURL || image.thumbnail_link || ''),
            original_url: resolveImageUrl(image.original_url || image.url || image.imageURL || ''),
            alt: image.alt || image.altText || ''
        };
    };

    const refreshCardImages = async (preferredIndex = null, includeNewUploads = false) => {
        const rawCardID = formData.cardID || props.cardID;
        const cardID = Number(rawCardID);
        if (!Number.isInteger(cardID) || cardID <= 0) return;

        const response = await api.get(`/cardImages/${cardID}`);
        const responseImages = (response.data?.images || []).map((img, idx) => normalizeImageRecord(img, idx));
        const freshImages = visibleGalleryImages(responseImages);

        setFormData((prev) => {
            let images = freshImages;
            if (isEditingRef.current) {
                const remaining = freshImages.filter(image => !pendingDeletedImageIDs.includes(image.imageID));
                const byID = new Map(remaining.map(image => [image.imageID, image]));
                const ordered = (prev.images || []).map(image => {
                    const fresh = byID.get(image.imageID);
                    return fresh ? { ...fresh, presentation: image.presentation ?? fresh.presentation } : null;
                }).filter(Boolean);
                const knownIDs = new Set(ordered.map(image => image.imageID));
                images = [...ordered, ...remaining.filter(image => !knownIDs.has(image.imageID))];
            }
            let selection = isEditingRef.current && prev.gallery_image_ids !== undefined ? prev.gallery_image_ids : response.data?.galleryImageIDs;
            selection = visibleGallerySelection(responseImages, selection);
            if (includeNewUploads && isEditingRef.current && Array.isArray(selection)) {
                const previousIDs = new Set((prev.images || []).map(galleryImageID));
                images.map(galleryImageID).filter(id => !previousIDs.has(id) && !selection.includes(id)).forEach(id => {
                    selection = toggleGallerySelection(selection, id);
                });
            }
            return {
                ...prev,
                images,
                gallery_layout: (isEditingRef.current && prev.gallery_layout) || response.data?.galleryLayout || 'multi',
                gallery_image_ids: selection
            };
        });

        setCurrentImageIndex((prev) => {
            if (freshImages.length === 0) return 0;
            if (typeof preferredIndex === 'number') {
                return Math.max(0, Math.min(preferredIndex, freshImages.length - 1));
            }
            return Math.min(prev, freshImages.length - 1);
        });
    };

    const refreshCardRecord = async () => {
        const rawCardID = formData.cardID || props.cardID;
        const cardID = Number(rawCardID);
        if (!Number.isInteger(cardID) || cardID <= 0) return;

        try {
            const response = await api.get('/allCards');
            const cards = response?.data?.data || [];
            const latestCard = cards.find((card) => Number(card.cardID) === cardID);

            if (!latestCard) return;

            setFormData((prev) => ({
                ...prev,
                ...latestCard,
                files: latestCard.files || [],
                images: latestCard.images || prev.images || [],
                filesToUpload: []
            }));
        } catch (error) {
            console.error('Failed to refresh card data:', error);
        }
    };

    const handleLearnMoreGalleryTileClick = (e, image, slotIndex) => {
        e.stopPropagation();

        if (image) {
            openImagePreviewAtIndex(e, slotIndex);
            return;
        }

        if (!isLearnMoreEditMode || isImageMutationLoading) return;
        if ((formData.images || []).length >= MAX_CARD_IMAGES) {
            alert(`A project can have at most ${MAX_CARD_IMAGES} images.`);
            return;
        }

        setPendingImageSlotIndex(slotIndex);
        if (learnMoreImageInputRef.current) {
            learnMoreImageInputRef.current.click();
        }
    };

    const runImageUploads = async jobs => {
        if (uploadRunning.current) return;
        uploadRunning.current = true;
        setIsImageMutationLoading(true);
        const patchJob = (id, patch) => setImageUploadJobs(prev => prev.map(job => job.id === id ? { ...job, ...patch } : job));
        try {
            for (const job of jobs) {
                patchJob(job.id, { status: 'uploading', error: '', progress: 0 });
                try {
                    validateImage(job.file);
                    if (!job.imageID) {
                        const body = new FormData();
                        body.append('cardID', formData.cardID || props.cardID);
                        body.append('altText', job.file.name);
                        body.append('image', job.file);
                        body.append('upload_token', job.id);
                        const response = await api.post('/uploadCardImage', body, {
                            timeout: 180000, skipRetry: true,
                            onUploadProgress: event => patchJob(job.id, { progress: uploadPercent(event) }),
                        });
                        job.imageID = response.data?.imageID;
                        patchJob(job.id, { imageID: job.imageID });
                        if (job.imageID) setSessionUploadedImageIDs(prev => [...new Set([...prev, job.imageID])]);
                    }
                    await refreshCardImages(pendingImageSlotIndex, true);
                    patchJob(job.id, { status: 'done', progress: 100 });
                } catch (error) {
                    const message = imageUploadError(error);
                    patchJob(job.id, { status: 'failed', error: message });
                    alert(message);
                }
            }
        } finally {
            uploadRunning.current = false;
            setIsImageMutationLoading(false);
            setPendingImageSlotIndex(null);
        }
    };

    const handleLearnMoreImageUpload = async event => {
        event.stopPropagation();
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length || uploadRunning.current) return;
        if (!(formData.cardID || props.cardID)) { alert('Save your project before adding images.'); return; }
        if ((formData.images || []).length + files.length > MAX_CARD_IMAGES) { alert(`A project can have at most ${MAX_CARD_IMAGES} images.`); return; }
        const jobs = files.map(file => ({ id: uploadToken(), file, status: 'queued' }));
        setImageUploadJobs(prev => [...prev.filter(job => job.status !== 'done'), ...jobs]);
        await runImageUploads(jobs);
    };

    const handleLearnMoreImageDelete = async (e, image) => {
        e.stopPropagation();

        if (isImageMutationLoading) return;

        if (!window.confirm('Delete this image?')) return;
        let imageID = resolveImageServerID(image);
        // A modal opened before the cover migration may still hold a fallback.
        if (!imageID) {
            try {
                const response = await api.get(`/cardImages/${formData.cardID || props.cardID}`);
                const record = (response.data?.images || []).find(item => resolveImageUrl(item.url) === image.url);
                imageID = resolveImageServerID(record);
            } catch (error) {
                alert('Could not refresh this image. Please try again.');
                return;
            }
        }
        if (!imageID) {
            alert('This image is no longer available. Please reopen the project.');
            return;
        }
        setPendingDeletedImageIDs(prev => [...new Set([...prev, imageID])]);
        setFormData(prev => ({ ...prev, images: (prev.images || []).filter(item => resolveImageServerID(item) !== imageID) }));
    };

    const displayCardData = isLearnMoreEditMode && learnMoreBackup ? learnMoreBackup : formData;

    const cardThumbnailSrc =
        displayCardData.thumbnail_link === '' ? '' :
        displayCardData.thumbnail_link && displayCardData.thumbnail_link.trim() !== ""
            ? resolveImageUrl(displayCardData.thumbnail_link)
            : "/CEREO-logo.png";

    // Shared geographic appearance preview and details shown in both
    // edit and view modes. The edit/change buttons are only rendered in edit mode.
    const renderRepresentationPreview = () => (
        <>
            <p><strong>Map location:</strong></p>
            <div className="learn-more-representation-preview">
                <RepresentationPreview data={formData} imageSrc={isImageCard ? (thumbnail ? preview : getRepresentativeImageUrl()) : undefined} onLocate={async e => {
                    if (await handleLearnMoreClose(e)) handleZoom(e);
                }} />
                <div className="learn-more-representation-info">
                    <span className="learn-more-representation-type">
                        {isImageCard ? 'Image' : isPolygonCard ? 'Polygon' : (formData.location_type === 'multipoint' ? 'Multi-point' : 'Point')}
                    </span>
                    {(isOverlayCard || formData.location_type === 'multipoint') && <span className="learn-more-representation-detail">
                        {isImageCard
                            ? 'Image overlay'
                            : isPolygonCard
                            ? `${(formData.polygon_vertices || []).length} vertices`
                            : formData.location_type === 'multipoint'
                            ? `${(formData.polygon_vertices || []).length} points`
                            : ''}
                    </span>}
                    {!isOverlayCard && (
                        <span className="learn-more-representation-coordinates">
                            <strong>Latitude:</strong> {formData.latitude ?? 'N/A'}
                            {' | '}
                            <strong>Longitude:</strong> {formData.longitude ?? 'N/A'}
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    const cardImageList = isImageCard
        ? [{ url: cardThumbnailSrc, id: 'card-representation', imageID: null, alt: 'Project representation' }]
        : displayCardData.images && Array.isArray(displayCardData.images) && displayCardData.images.length > 0
        ? (() => {
            const images = visibleGalleryImages(displayCardData.images.map((img, idx) => normalizeImageRecord(img, idx)));
            const selected = selectedGalleryImages(images, visibleGallerySelection(displayCardData.images, displayCardData.gallery_image_ids));
            const selectedIDs = new Set(selected.map(galleryImageID));
            return [...selected, ...images.filter(image => !selectedIDs.has(galleryImageID(image)))];
        })()
        : [{ url: cardThumbnailSrc, id: 0 }];

    // Multi-image support: use images array if available, otherwise fall back to single thumbnail
    const imageList = isImageCard
        ? (formData.images && Array.isArray(formData.images) && formData.images.length > 0
            ? visibleGalleryImages(formData.images.map((img, idx) => normalizeImageRecord(img, idx)))
            : [])
        : formData.images && Array.isArray(formData.images) && formData.images.length > 0
        ? visibleGalleryImages(formData.images.map((img, idx) => normalizeImageRecord(img, idx)))
        : (!pendingDeletedImageIDs.length && formData.thumbnail_link && (SHOW_LEGACY_ORGANIZATION_LOGO || !isLegacyOrganizationImage(formData.thumbnail_link))
            ? [{ url: resolveImageUrl(formData.thumbnail_link), id: 0 }]
            : []);

    const allImagesList = imageList;

    const resolveImageServerID = (image) => {
        const imageID = Number(image?.imageID ?? image?.imageId ?? null);
        return Number.isInteger(imageID) && imageID > 0 ? imageID : null;
    };

    const toggleAllImageSelection = (e, image) => {
        e.stopPropagation();
        const imageID = resolveImageServerID(image);
        if (!imageID) return;

        setSelectedAllImageIDs((prev) =>
            prev.includes(imageID) ? prev.filter((id) => id !== imageID) : [...prev, imageID]
        );
    };

    const handleDeleteSelectedAllImages = (e) => {
        e.stopPropagation();

        if (!selectedAllImageIDs.length) {
            alert('Please select image(s) first.');
            return;
        }

        if (!window.confirm(`Delete ${selectedAllImageIDs.length} selected image(s)?`)) return;

        const selectedSet = new Set(selectedAllImageIDs);
        const isSelectedImage = (img) => {
            const imageID = resolveImageServerID(img);
            return imageID ? selectedSet.has(imageID) : false;
        };

        setPendingDeletedImageIDs((prev) => [...new Set([...prev, ...selectedAllImageIDs])]);

        setFormData((prev) => ({
            ...prev,
            images: (prev.images || []).filter((img) => !isSelectedImage(normalizeImageRecord(img)))
        }));

        setSelectedAllImageIDs([]);
    };

    const currentImage = imageList[currentImageIndex] || imageList[0] || { url: cardThumbnailSrc, id: 'fallback-preview', alt: 'Project preview' };
    const cardCurrentImage = cardImageList[currentImageIndex] || cardImageList[0] || { url: cardThumbnailSrc, id: 'fallback-card', alt: 'Project thumbnail' };
    const hasMultipleImages = cardImageList.length > 1;
    const isCardCurrentImageDefault = (() => {
        const url = cardCurrentImage?.url;
        if (!url || typeof url !== 'string') return true;
        if (isLegacyOrganizationImage(url)) return true;
        return false;
    })();
    const totalIndicatorCount = cardImageList.length;
    const visibleIndicatorCount = Math.min(5, totalIndicatorCount);
    const indicatorWindowStart = Math.max(
        0,
        Math.min(currentImageIndex - 2, totalIndicatorCount - visibleIndicatorCount)
    );
    const visibleIndicatorIndexes = Array.from(
        { length: visibleIndicatorCount },
        (_, idx) => indicatorWindowStart + idx
    );
    const nonActiveVisibleIndexes = visibleIndicatorIndexes.filter((idx) => idx !== currentImageIndex);
    const normalNeighborIndexes = new Set(
        nonActiveVisibleIndexes
            .slice()
            .sort((a, b) => {
                const distanceDiff = Math.abs(a - currentImageIndex) - Math.abs(b - currentImageIndex);
                if (distanceDiff !== 0) return distanceDiff;
                return a - b;
            })
            .slice(0, 2)
    );
    const gallerySelection = visibleGallerySelection(formData.images || [], formData.gallery_image_ids);
    const learnMoreGalleryImages = selectedGalleryImages(allImagesList, gallerySelection);
    const visibleGalleryIDs = learnMoreGalleryImages.map(galleryImageID);
    const gallerySelectionSlots = Array.isArray(gallerySelection)
        ? gallerySelection.map(id => visibleGalleryIDs.includes(id) ? id : null)
        : visibleGalleryIDs;
    const toggleGalleryImage = (image) => {
        const id = galleryImageID(image);
        const next = toggleGallerySelection(gallerySelectionSlots, id);
        setFormData(prev => ({ ...prev, gallery_image_ids: next }));
    };

    const reorderGalleryImages = (from, to) => {
        setFormData(prev => {
            const images = [...(prev.images || [])];
            const fromIndex = images.findIndex(image => galleryImageID(image) === visibleGalleryIDs[from]);
            const toIndex = images.findIndex(image => galleryImageID(image) === visibleGalleryIDs[to]);
            if (fromIndex < 0 || toIndex < 0) return prev;
            const [moved] = images.splice(fromIndex, 1);
            images.splice(toIndex, 0, moved);
            const selection = [...visibleGalleryIDs];
            const [movedID] = selection.splice(from, 1);
            selection.splice(to, 0, movedID);
            return { ...prev, images, gallery_image_ids: selection };
        });
    };

    const goToPrevImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev === 0 ? (isImagePreviewOpen ? imageList.length : cardImageList.length) - 1 : prev - 1));
    };

    const goToNextImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev >= (isImagePreviewOpen ? imageList.length : cardImageList.length) - 1 ? 0 : prev + 1));
    };

    const goToImageByIndex = (e, index) => {
        e.stopPropagation();
        setCurrentImageIndex(index);
    };

    const openImagePreviewAtIndex = (e, index) => {
        e.stopPropagation();
        setCurrentImageIndex(index);
        setIsImagePreviewOpen(true);
    };

    return (
        <div
            className={`card ${props.isSelectedFromMap ? 'card--map-selected' : ''}`}
            data-onboarding-target={props.onboardingTargetPrefix ? props.onboardingTargetPrefix : undefined}
            onClick={handleLearnMore}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLearnMore(e); }}
        >
            {/* Favorite Heart Icon */}
            <span
                className={`favorite-icon ${isFavorited ? 'filled' : ''}`}
                data-onboarding-target={props.onboardingTargetPrefix ? `${props.onboardingTargetPrefix}-actions` : undefined}
                onClick={handleFavoriteClick}
                title={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
                <FontAwesomeIcon icon={isFavorited ? solidHeart : regularHeart} />
            </span>

            <div className="card-thumbnail-container">
                {cardCurrentImage.url && (SHOW_LEGACY_ORGANIZATION_LOGO || !isCardCurrentImageDefault) && failedCardImageUrl !== cardCurrentImage.url ? <img
                    src={cardCurrentImage.url}
                    alt={cardCurrentImage.alt || "Project Thumbnail"}
                    className={`card-thumbnail${isCardCurrentImageDefault ? '' : ' card-thumbnail--cover'}`}
                    onClick={handleOpenImagePreview}
                    onError={() => setFailedCardImageUrl(cardCurrentImage.url)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenImagePreview(e); }}
                    role="button"
                    tabIndex={0}
                /> : <div className="card-thumbnail card-thumbnail--empty">No image</div>}
                
                {/* Navigation arrows (only show if multiple images) */}
                {hasMultipleImages && (
                    <>
                        <button
                            className="card-image-nav card-image-nav-prev"
                            onClick={goToPrevImage}
                            title="Previous image"
                            aria-label="Previous image"
                        >
                            ❮
                        </button>
                        <button
                            className="card-image-nav card-image-nav-next"
                            onClick={goToNextImage}
                            title="Next image"
                            aria-label="Next image"
                        >
                            ❯
                        </button>
                    </>
                )}
                
                {/* Image indicator dots (only show if multiple images) */}
                {hasMultipleImages && (
                    <div className="card-image-indicators">
                        {visibleIndicatorIndexes.map((imageIndex) => (
                            <span
                                key={`dot-${imageIndex}`}
                                className={`card-image-dot ${imageIndex === currentImageIndex ? 'active' : ''} ${imageIndex !== currentImageIndex && !normalNeighborIndexes.has(imageIndex) ? 'small' : ''}`}
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="card-title-row">
                <h2 className="card-title">{displayCardData.title}</h2>
            </div>
            <div className="card-meta-row">
                <p className="card-meta">{parseTags(displayCardData.tags).join(', ') || "No tags"}</p>
                <button
                    className="card-meta-zoom-btn"
                    data-onboarding-target={props.onboardingTargetPrefix ? `${props.onboardingTargetPrefix}-actions` : undefined}
                    onClick={handleZoom}
                    title="Locate on map"
                    aria-label="Locate on map"
                >
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                </button>
            </div>

            {/* Learn More Modal */}
            <Modal
                isOpen={isLearnMoreModalVisible}
                onRequestClose={handleLearnMoreClose}
                shouldCloseOnOverlayClick={!isLearnMoreOnboardingOpen}
                shouldCloseOnEsc={!isLearnMoreOnboardingOpen}
                className="Modal Modal--learn-more"
                overlayClassName="ModalOverlay ModalOverlay--learn-more"
            >
                <div
                    className={`learn-more-modal-shell${isLearnMoreOnboardingOpen ? ' onboarding-locked' : ''}`}
                    data-onboarding-target="learn-more-modal-shell"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Escape' && !event.defaultPrevented && !isLearnMoreOnboardingOpen) {
                            event.preventDefault();
                            handleLearnMoreClose(event);
                        }
                    }}
                    onKeyUp={(e) => e.stopPropagation()}
                >
                <div className="learn-more-modal-toolbar" data-onboarding-target="learn-more-toolbar">
                    <div className="learn-more-modal-toolbar-left">
                        {isLearnMoreEditMode ? (
                            <div className="learn-more-modal-toolbar-actions">
                                <button
                                    className="learn-more-modal-toolbar-btn save"
                                    onClick={handleLearnMoreEditSave}
                                    disabled={loading || isImageMutationLoading}
                                >
                                    {loading ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    className="learn-more-modal-toolbar-btn cancel"
                                    onClick={async (e) => {
                                        if (hasUnsavedChanges) {
                                            const confirmed = window.confirm('You have unsaved changes. Discard them?');
                                            if (!confirmed) return;
                                        }
                                        await handleLearnMoreEditCancel(e);
                                    }}
                                    disabled={loading || isImageMutationLoading}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                className="learn-more-modal-edit-btn learn-more-modal-icon-btn"
                                onClick={handleLearnMoreEditStart}
                                aria-label="Edit project in Learn More modal"
                                title="Edit"
                            >
                                <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                        )}

                        <button
                            className="learn-more-modal-download-btn learn-more-modal-icon-btn"
                            onClick={handleDownloadPdf}
                            aria-label="Download project as PDF"
                            title="Download as PDF"
                        >
                            <FontAwesomeIcon icon={faDownload} />
                        </button>

                        <button
                            className="learn-more-modal-delete-btn learn-more-modal-icon-btn"
                            onClick={handleDelete}
                            aria-label="Delete project"
                            title="Delete project"
                        >
                            <FontAwesomeIcon icon={faTrashCan} />
                        </button>
                        {isLearnMoreEditMode && hasUnsavedChanges && (
                            <span className="learn-more-unsaved-badge">You have unsaved changes</span>
                        )}
                    </div>

                    <div className="learn-more-modal-toolbar-right">
                        <button
                            className="learn-more-modal-help-btn learn-more-modal-icon-btn"
                            onClick={() => window.open('/user-manual?section=detail-view', '_blank')}
                            aria-label="Open project detail help"
                            title="Help"
                        >
                            <FontAwesomeIcon icon={faQuestion} />
                        </button>
                        <button
                            className="learn-more-modal-onboarding-btn learn-more-modal-icon-btn"
                            onClick={() => setIsLearnMoreOnboardingOpen(true)}
                            aria-label="Start detail view onboarding"
                            title="Onboarding"
                        >
                            <FontAwesomeIcon icon={faPlay} />
                        </button>
                        <button
                            className="learn-more-modal-close learn-more-modal-icon-btn"
                            onClick={handleLearnMoreClose}
                            aria-label="Close learn more modal"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                </div>

                <div className="learn-more-modal-body" data-onboarding-target="learn-more-modal-content">
                    <input
                        ref={learnMoreImageInputRef}
                        type="file"
                        accept={IMAGE_ACCEPT}
                        multiple
                        onChange={handleLearnMoreImageUpload}
                        style={{ display: 'none' }}
                    />

                    {isLearnMoreEditMode && <>
                        <p className="image-upload-hint">PNG, JPG, WebP, GIF or BMP · up to 50 MiB / 160 megapixels each. Originals are kept; display images are resized automatically.</p>
                        {imageUploadJobs.map(job => <div className="image-upload-status" role="status" key={job.id}>
                            <strong>{job.file.name}</strong> — {job.status === 'uploading' ? (job.progress === 100 ? 'Processing image…' : `Uploading ${job.progress ?? ''}%`) : job.status === 'done' ? 'Uploaded' : job.status === 'failed' ? job.error : 'Waiting'}
                            {job.status === 'uploading' && <progress max="100" value={job.progress ?? undefined} aria-label={`Uploading ${job.file.name}`} />}
                            {job.status === 'failed' && <>
                                <button type="button" disabled={isImageMutationLoading} onClick={() => runImageUploads([job])}>Retry {job.file.name}</button>
                                <button type="button" disabled={isImageMutationLoading} onClick={() => setImageUploadJobs(prev => prev.filter(item => item.id !== job.id))}>Remove from upload queue</button>
                            </>}
                        </div>)}
                    </>}
                    {isAllImagesView ? (
                        <div className="learn-more-all-images-view">
                            <div className="learn-more-all-images-header">
                                <button
                                    type="button"
                                    className="learn-more-all-images-back-link"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsAllImagesView(false);
                                    }}
                                >
                                    <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" /> Back to Learn More
                                </button>
                                {isLearnMoreEditMode && (
                                    <div className="learn-more-all-images-actions">
                                        <button
                                            type="button"
                                            className="learn-more-all-images-delete-selected-btn"
                                            onClick={handleDeleteSelectedAllImages}
                                            disabled={isImageMutationLoading || selectedAllImageIDs.length === 0}
                                        >
                                            {`Delete Selected (${selectedAllImageIDs.length})`}
                                        </button>
                                        <button
                                            type="button"
                                            className="learn-more-modal-toolbar-btn save"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPendingImageSlotIndex(null);
                                                learnMoreImageInputRef.current?.click();
                                            }}
                                            disabled={isImageMutationLoading || (formData.images || []).length >= MAX_CARD_IMAGES}
                                        >
                                            {isImageMutationLoading ? 'Uploading...' : 'Add New Image'}
                                        </button>
                                    </div>
                                )}
                                <p className="learn-more-all-images-count">
                                    {`Showing ${allImagesList.length} image${allImagesList.length === 1 ? '' : 's'}`}
                                </p>
                            </div>

                            <p className="learn-more-gallery-selection-hint">{`${learnMoreGalleryImages.length} / 6 images selected. Choose up to 6 images here for Multiple images and Slideshow; number 1 is the project cover. Drag images on the main page to change their order. Up to ${MAX_CARD_IMAGES} images total.`}</p>
                            <div className="learn-more-all-images-list">
                                {allImagesList.map((image, index) => (
                                    <div className={`learn-more-all-image-item ${isLearnMoreEditMode && visibleGalleryIDs.includes(galleryImageID(image)) ? 'is-main-selected' : ''}`} key={`all-image-${image.imageID || image.id || index}`}>
                                        {isLearnMoreEditMode && (
                                            <label className="learn-more-gallery-selection" title={gallerySelectionSlots[0] === galleryImageID(image) ? 'Project cover' : 'Show on main page'} onClick={e => e.stopPropagation()}>
                                                <span className="learn-more-gallery-checkbox">
                                                    <input type="checkbox" aria-label={`Show image ${index + 1} on main page`}
                                                        checked={visibleGalleryIDs.includes(galleryImageID(image))}
                                                        disabled={!isLearnMoreEditMode || isImageMutationLoading || !resolveImageServerID(image) || (!visibleGalleryIDs.includes(galleryImageID(image)) && visibleGalleryIDs.length >= MAX_GALLERY_IMAGES)}
                                                        onChange={() => toggleGalleryImage(image)} />
                                                    <span className="learn-more-gallery-order" aria-label={visibleGalleryIDs.includes(galleryImageID(image)) ? `Display order ${gallerySelectionSlots.indexOf(galleryImageID(image)) + 1}` : undefined}>{visibleGalleryIDs.includes(galleryImageID(image)) ? gallerySelectionSlots.indexOf(galleryImageID(image)) + 1 : ''}</span>
                                                </span>
                                            </label>
                                        )}


                                        <button
                                            type="button"
                                            className="learn-more-all-image-btn"
                                            onClick={(e) => openImagePreviewAtIndex(e, index)}
                                            title={`Open image ${index + 1}`}
                                        >
                                            <img
                                                className="learn-more-all-image"
                                                src={image.url}
                                                alt={image.alt || `Project image ${index + 1}`}
                                            />
                                        </button>

                                        {isLearnMoreEditMode && resolveImageServerID(image) && <button type="button" data-gallery-control className="learn-more-all-image-frame" aria-label={`Adjust framing for image ${index + 1}`} title="Adjust framing" disabled={isImageMutationLoading} onClick={event => {
                                            event.stopPropagation();
                                            setFramingImage({ image, ratio: galleryFrameAspect(learnMoreGalleryImages.length, Math.max(0, visibleGalleryIDs.indexOf(galleryImageID(image)))) });
                                        }}><FontAwesomeIcon icon={faPen} aria-hidden="true" /></button>}
                                        {isLearnMoreEditMode && resolveImageServerID(image) && (
                                            <button
                                                type="button"
                                                className={`learn-more-all-image-select ${selectedAllImageIDs.includes(resolveImageServerID(image)) ? 'is-selected' : ''}`}
                                                onClick={(e) => toggleAllImageSelection(e, image)}
                                                title={selectedAllImageIDs.includes(resolveImageServerID(image)) ? 'Unselect image' : 'Select image'}
                                                aria-label={selectedAllImageIDs.includes(resolveImageServerID(image)) ? 'Unselect image' : 'Select image'}
                                                aria-pressed={selectedAllImageIDs.includes(resolveImageServerID(image)) ? 'true' : 'false'}
                                            >
                                                <FontAwesomeIcon icon={faCheck} className="learn-more-all-image-select-mark" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>


                        </div>
                    ) : (
                        <>

                    <div data-onboarding-target="learn-more-image-area" className={isLearnMoreEditMode ? 'learn-more-image-area--editing' : undefined}>

                    <LearnMoreGallery
                        images={learnMoreGalleryImages}
                        totalImageCount={allImagesList.length}
                        layout={formData.gallery_layout || 'featured'}
                        editing={isLearnMoreEditMode}
                        onLayoutChange={gallery_layout => setFormData(prev => ({ ...prev, gallery_layout }))}
                        busy={loading || isImageMutationLoading}
                        coverUrl={isImageCard ? cardThumbnailSrc : learnMoreGalleryImages[0]?.url}
                        onReorder={reorderGalleryImages}
                        onOpen={(event, index) => openImagePreviewAtIndex(event, allImagesList.findIndex(image => galleryImageID(image) === galleryImageID(learnMoreGalleryImages[index])))}
                        onAdd={(event, index) => handleLearnMoreGalleryTileClick(event, null, index)}
                        onDelete={handleLearnMoreImageDelete}
                        onFrame={(image, ratio) => setFramingImage({ image, ratio })}
                        onSeeAll={() => setIsAllImagesView(true)}
                    />
                    </div>

                    <div data-onboarding-target="learn-more-text-area">

                    <div className="learn-more-modal-title-section">
                        {isLearnMoreEditMode ? (
                            <>
                                <input
                                    className="learn-more-inline-input learn-more-inline-title"
                                    type="text"
                                    name="title"
                                    value={formData.title || ''}
                                    onChange={handleInputChange}
                                />
                                <select
                                    className="learn-more-inline-input"
                                    name="category"
                                    value={formData.category || ''}
                                    onChange={handleInputChange}
                                >
                                    {CARD_CATEGORIES.map((categoryOption) => (
                                        <option key={categoryOption} value={categoryOption}>
                                            {categoryOption}
                                        </option>
                                    ))}
                                </select>
                            </>
                        ) : (
                            <>
                                <h2>{formData.title}</h2>
                                <p className="learn-more-modal-subtitle">{formData.category || "Uncategorized"}</p>
                            </>
                        )}
                    </div>

                    {isLearnMoreEditMode ? (
                        <>
                            <div className="learn-more-fields-grid">
                                <div className="learn-more-field-cell">
                                    <p><strong>Author:</strong></p>
                                    <input className="learn-more-inline-input" type="text" name="name" value={formData.name || ''} onChange={handleInputChange} />
                                </div>
                                <div className="learn-more-field-cell">
                                    <p><strong>Project Creator:</strong></p>
                                    <input className="learn-more-inline-input learn-more-inline-readonly" type="text" name="username" value={formData.username || ''} readOnly disabled title="Project Creator cannot be edited" />
                                </div>
                                <div className="learn-more-field-cell">
                                    <p><strong>Contact Email:</strong></p>
                                    <input className="learn-more-inline-input" type="email" name="contact_email" value={formData.contact_email ?? formData.email ?? ''} onChange={handleInputChange} />
                                </div>
                                <div className="learn-more-field-cell">
                                    <p><strong>Funding:</strong></p>
                                    <input className="learn-more-inline-input" type="text" name="funding" value={formData.funding || ''} onChange={handleInputChange} />
                                </div>
                                <div className="learn-more-field-cell">
                                    <p><strong>Organization:</strong></p>
                                    <input className="learn-more-inline-input" type="text" name="org" value={formData.org || ''} onChange={handleInputChange} />
                                </div>
                            </div>

                            <p><strong>Links:</strong></p>
                            {learnMoreLinks.map((linkItem, idx) => (
                                <div key={idx} className="learn-more-link-row">
                                    <input
                                        className="learn-more-inline-input"
                                        type="text"
                                        placeholder="URL"
                                        value={linkItem.url}
                                        onChange={e => setLearnMoreLinks(learnMoreLinks.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))}
                                    />
                                    <input
                                        className="learn-more-inline-input learn-more-link-text-input"
                                        type="text"
                                        placeholder="Display text (optional)"
                                        value={linkItem.text}
                                        onChange={e => setLearnMoreLinks(learnMoreLinks.map((l, i) => i === idx ? { ...l, text: e.target.value } : l))}
                                    />
                                    {learnMoreLinks.length > 1 && (
                                        <button
                                            type="button"
                                            className="learn-more-link-remove-btn"
                                            onClick={() => setLearnMoreLinks(learnMoreLinks.filter((_, i) => i !== idx))}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                className="learn-more-modal-toolbar-btn cancel learn-more-add-link-btn"
                                onClick={() => setLearnMoreLinks([...learnMoreLinks, { url: '', text: '' }])}
                            >
                                + Add More Links
                            </button>

                            <p><strong>Description:</strong></p>
                            <RichTextEditor
                                attachments={formData.files || []}
                                onInsertFiles={files => setFormData(prev => ({ ...prev, filesToUpload: [...(prev.filesToUpload || []), ...files] }))}
                                value={formData.description || ''}
                                onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
                                placeholder="Enter description..."
                                minHeight={110}
                            />

                            <p><strong>Tags:</strong></p>
                            <div className="learn-more-tags-editor">
                                {parseTags(formData.tags).map((tag, idx) => (
                                    <span key={`${tag}-${idx}`} className="learn-more-tag-chip">
                                        {tag}
                                        <button
                                            type="button"
                                            className="learn-more-tag-chip-remove"
                                            aria-label={`Remove tag ${tag}`}
                                            title="Remove tag"
                                            onClick={() => removeTag(tag)}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <input
                                    className="learn-more-tag-input"
                                    type="text"
                                    value={tagInput}
                                    placeholder={parseTags(formData.tags).length === 0 ? 'Add a tag and press Enter' : 'Add another tag'}
                                    onChange={handleTagInputChange}
                                    onKeyDown={handleTagKeyDown}
                                />
                            </div>

                            <p><strong>Visibility:</strong></p>
                            <select
                                className="learn-more-inline-input"
                                value={formData.is_public !== false ? "true" : "false"}
                                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.value !== "false" }))}
                            >
                                <option value="true">Public (visible to everyone)</option>
                                <option value="false">Private (only visible to me)</option>
                            </select>
                            <div className="learn-more-location-section" data-onboarding-target="learn-more-coordinates-polygon">
                                {renderRepresentationPreview()}
                                <div className="learn-more-location-actions">
                                    <div className="learn-more-location-btn-group">
                                        <button type="button" className="learn-more-select-location-btn" onClick={isOverlayCard ? handleEditPolygon : handleEditCoordinate}>
                                            {isImageCard ? 'Edit Image' : isOverlayCard ? 'Edit Polygon' : 'Edit Coordinate'}
                                        </button>
                                        <div className="learn-more-location-type-btn-wrap" ref={locationTypeMenuRef}>
                                            <button type="button" className="learn-more-select-location-btn learn-more-change-to-polygon-btn"
                                                aria-expanded={isLocationTypeMenuOpen} onClick={event => { event.stopPropagation(); setIsLocationTypeMenuOpen(v => !v); }}>
                                                Change location type
                                            </button>
                                            {isLocationTypeMenuOpen && <div className="learn-more-location-type-menu">
                                                {['point', 'polygon', 'image'].map(type => {
                                                    const active = type === (isOverlayCard ? formData.location_type : 'point');
                                                    return <button key={type} type="button"
                                                        className={`learn-more-location-type-menu-item${active ? ' active' : ''}`}
                                                        disabled={active} onClick={event => handleChangeLocationType(type, event)}>
                                                        {type[0].toUpperCase() + type.slice(1)}
                                                    </button>;
                                                })}
                                            </div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="learn-more-fields-grid">
                                <p><strong>Author:</strong> {formData.name}</p>
                                <p><strong>Project Creator:</strong> {formData.username}</p>
                                <p><strong>Contact Email:</strong> {formData.contact_email ?? formData.email}</p>
                                <p><strong>Funding:</strong> {formData.funding || 'N/A'}</p>
                                <p><strong>Organization:</strong> {formData.org || 'N/A'}</p>
                            </div>
                            <div className="learn-more-location-section">
                                {renderRepresentationPreview()}
                            </div>
                            <div className="learn-more-links-view">
                                <strong>Links:</strong>
                                {(() => {
                                    const links = parseLinks(formData.link, formData.link_text).filter(l => l.url.trim() !== '');
                                    if (links.length === 0) return <span> N/A</span>;
                                    return (
                                        <ul className="learn-more-links-list">
                                            {links.map((l, i) => (
                                                <li key={i}>
                                                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                                                        {l.text || l.url}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    );
                                })()}
                            </div>
                            <div className="learn-more-modal-description"><strong>Description:</strong> <span dangerouslySetInnerHTML={{ __html: descriptionToHtml(formData.description) }} /></div>
                            <p><strong>Tags:</strong>{parseTags(formData.tags).length > 0 ? (
                                <span className="learn-more-tags-chips">
                                    {parseTags(formData.tags).map((tag, idx) => (
                                        <span key={`${tag}-${idx}`} className="learn-more-tag-chip learn-more-tag-chip-readonly">{tag}</span>
                                    ))}
                                </span>
                            ) : (
                                ' N/A'
                            )}</p>
                            <p><strong>Visibility:</strong> {formData.is_public !== false ? 'Public' : 'Private (only visible to you)'}</p>
                        </>
                    )}

                    {/* Files Section */}
                    {isLearnMoreEditMode ? (
                        <div className="learn-more-files-edit-section" data-onboarding-target="learn-more-files-section">
                            <p><strong>Attached Files:</strong></p>
                            {formData.files && formData.files.length > 0 ? (
                                <ul className="learn-more-files-edit-list">
                                    {formData.files.map((file, idx) => (
                                        <li key={file.fileid || idx} className="learn-more-file-edit-item">
                                            <span className="learn-more-file-edit-name">
                                                {file.filename || `File ${idx + 1}`}
                                            </span>
                                            <button
                                                type="button"
                                                className="learn-more-file-edit-delete-btn"
                                                onClick={async () => {
                                                    if (!window.confirm(`Delete file "${file.filename}"?`)) return;
                                                    try {
                                                        await api.delete(`/deleteFile?fileID=${file.fileid}`);
                                                        const filterOut = (f) => f.fileid !== file.fileid;
                                                        setFormData((prev) => ({ ...prev, files: prev.files.filter(filterOut) }));
                                                        setLearnMoreBackup((prev) => prev ? { ...prev, files: (prev.files || []).filter(filterOut) } : prev);
                                                    } catch (err) {
                                                        console.error('Error deleting file:', err);
                                                        alert('Failed to delete file.');
                                                    }
                                                }}
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="learn-more-no-files">No files attached.</p>
                            )}
                            <label className="learn-more-add-files-label">
                                <FontAwesomeIcon icon={faUpload} aria-hidden="true" />
                                <span><strong>Choose files</strong><span className="learn-more-add-files-hint">Select one or more files. Uploads start when you save.</span></span>
                                <input
                                    type="file"
                                    aria-label="Add files"
                                    multiple
                                    disabled={loading || isImageMutationLoading}
                                    onChange={(e) => {
                                        const selectedFiles = Array.from(e.target.files || []);
                                        setFormData((prev) => {
                                            const filesToUpload = [...(prev.filesToUpload || [])];
                                            selectedFiles.forEach(file => {
                                                if (!filesToUpload.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) {
                                                    filesToUpload.push(file);
                                                }
                                            });
                                            return { ...prev, filesToUpload };
                                        });
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                            {formData.filesToUpload && formData.filesToUpload.length > 0 && (
                                <div className="learn-more-staged-files">
                                    <p role="status">{formData.filesToUpload.length} file{formData.filesToUpload.length === 1 ? '' : 's'} ready to upload</p>
                                    <ul className="learn-more-staged-files-list">
                                        {formData.filesToUpload.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                                            <span className="learn-more-staged-file-name">{file.name}</span>
                                            <span className="learn-more-staged-file-size">{file.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</span>
                                            <button type="button" aria-label={`Remove ${file.name} from upload`} disabled={loading || isImageMutationLoading} onClick={() => setFormData(prev => ({ ...prev, filesToUpload: prev.filesToUpload.filter((_, fileIndex) => fileIndex !== index) }))}>
                                                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                                            </button>
                                        </li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        formData.files && formData.files.length > 0 && (
                            <div className="file-list learn-more-file-list">
                                <h3>Downloadable Files:</h3>
                                <ul>
                                    {formData.files.map((file, idx) => (
                                        <li key={file.fileid || idx}>
                                            <a
                                                href={`${api.defaults.baseURL}/downloadFile?fileID=${file.fileid}`}
                                                download
                                                rel="noopener noreferrer"
                                            >
                                                {file.filename || `Download ${file.fileextension}`}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    )}

                    {linkedLayerError && <p role="alert">{linkedLayerError}</p>}
                    {/* Linked ArcGIS Services/Layers Section */}
                    {(isLearnMoreEditMode || linkedArcgisItems.length > 0) && (
                    <div className="learn-more-arcgis-links-section" data-onboarding-target="learn-more-arcgis-section">
                        <p><strong>Linked ArcGIS Services/Layers:</strong></p>
                        <p className="image-upload-hint">Display settings are saved for you only.</p>
                        {linkedArcgisItems.length === 0 ? (
                            <p className="learn-more-no-arcgis-links">No linked ArcGIS items.</p>
                        ) : (
                            <ul className="learn-more-arcgis-links-list">
                                {linkedArcgisItems.map(item => {
                                    const stateLabel = ARCGIS_STATE_FULL_NAMES[item.state_code] || item.state_code;
                                    const isServiceLevel = item.item_type === 'service';
                                    const serviceLabel = arcgisServiceByKey[item.service_key]?.label || item.service_key;
                                    const isLayerChecked = !!linkedArcgisChecked[item.id];

                                    // Resolve legend image for this item
                                    const legendImg = (() => {
                                        if (item.layer_id == null) return null;
                                        const legend = arcgisLegends[item.service_key];
                                        if (!legend?.layers) return null;
                                        const legendLayer = legend.layers.find(l => l.layerId === item.layer_id);
                                        if (!legendLayer?.legend?.length) return null;
                                        const entries = legendLayer.legend;
                                        let entry;
                                        if (item.sublayer_index != null && entries[item.sublayer_index]) {
                                            entry = entries[item.sublayer_index];
                                        } else if (entries.length === 1) {
                                            entry = entries[0];
                                        } else {
                                            return null;
                                        }
                                        if (!entry.imageData || !entry.contentType) return null;
                                        return `data:${entry.contentType};base64,${entry.imageData}`;
                                    })();

                                    return (
                                        <li key={item.id} className="learn-more-arcgis-link-item">
                                            <label
                                                className="learn-more-arcgis-layer-toggle-label"
                                                title="Show/hide this layer for you only"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="learn-more-arcgis-layer-toggle-cb"
                                                    checked={isLayerChecked}
                                                    onChange={() => {
                                                        const nowChecked = !isLayerChecked;
                                                        setLinkedArcgisChecked(prev => ({ ...prev, [item.id]: nowChecked }));
                                                        handleToggleArcgisLayer(item, nowChecked);
                                                    }}
                                                />
                                            </label>
                                            <span className="learn-more-arcgis-link-row">
                                                <span className="learn-more-arcgis-row-text">{stateLabel}</span>
                                                <span className="learn-more-arcgis-row-sep"> › </span>
                                                <span className="learn-more-arcgis-row-text">{item.folder_name}</span>
                                                {!isServiceLevel && (
                                                    <>
                                                        <span className="learn-more-arcgis-row-sep"> › </span>
                                                        <span className="learn-more-arcgis-row-text">{serviceLabel}</span>
                                                    </>
                                                )}
                                                <span className="learn-more-arcgis-row-sep"> › </span>
                                                {legendImg && (
                                                    <img
                                                        src={legendImg}
                                                        alt=""
                                                        className="learn-more-arcgis-legend-img"
                                                    />
                                                )}
                                                <span className="learn-more-arcgis-row-text learn-more-arcgis-row-name">{item.display_name}</span>
                                            </span>
                                            <button
                                                type="button"
                                                className="learn-more-arcgis-goto-btn"
                                                onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('open-arcgis-panel', {
                                                        detail: {
                                                            serviceKey: item.service_key,
                                                            layerId: item.layer_id,
                                                            stateCode: item.state_code,
                                                            folderName: item.folder_name,
                                                        }
                                                    }));
                                                }}
                                                title="Open in ArcGIS Upload Panel"
                                            >
                                                ›
                                            </button>
                                            {isLearnMoreEditMode && (
                                                <button
                                                    type="button"
                                                    className="learn-more-arcgis-link-delete-btn"
                                                    title="Remove link"
                                                    onClick={async () => {
                                                        try {
                                                            await api.delete(`/cardArcGISLinks/${item.id}`, {params:{requester_email:localStorage.getItem('email') || ''}});
                                                            setLinkedArcgisItems(prev => prev.filter(i => i.id !== item.id));
                                                        } catch (err) {
                                                            console.error('Failed to remove ArcGIS link:', err);
                                                        }
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {isLearnMoreEditMode && (
                            <button
                                type="button"
                                className="learn-more-add-arcgis-btn"
                                onClick={() => setIsArcgisPickerOpen(true)}
                            >
                                + Add ArcGIS Item
                            </button>
                        )}
                    </div>
                    )}

                    {/* ArcGIS Picker Modal */}
                    {isArcgisPickerOpen && (
                        <ArcGISPickerModal
                            onAdd={async (links) => {
                                const cardId = formData.cardID;
                                if (!cardId) return;
                                const newItems = [];
                                for (const link of links) {
                                    try {
                                        const res = await api.post('/cardArcGISLinks', { card_id: cardId, ...link, requester_email:localStorage.getItem('email') || '' });
                                        newItems.push({ id: res.data.id, card_id: cardId, ...link });
                                    } catch (err) {
                                        console.error('Failed to add ArcGIS link:', err);
                                    }
                                }
                                if (newItems.length > 0) {
                                    setLinkedArcgisItems(prev => [...prev, ...newItems]);
                                }
                                setIsArcgisPickerOpen(false);
                            }}
                            onClose={() => setIsArcgisPickerOpen(false)}
                        />
                    )}

                    {/* Linked Custom Layers Section */}
                    {(isLearnMoreEditMode || linkedCustomLayerItems.length > 0) && (
                    <div className="learn-more-arcgis-links-section">
                        <p><strong>Linked Custom Layers:</strong></p>
                        {linkedCustomLayerItems.length === 0 ? (
                            <p className="learn-more-no-arcgis-links">No linked custom layers.</p>
                        ) : (
                            <ul className="learn-more-arcgis-links-list">
                                {linkedCustomLayerItems.map(item => {
                                    const isChecked = !!linkedCustomLayerChecked[item.id];
                                    const personalSource = item.source_is_personal ?? (props.isLoggedIn && (localStorage.getItem('email') || '').toLowerCase() === (formData.email || '').toLowerCase());
                                    return (
                                        <li key={item.id} className="learn-more-arcgis-link-item">
                                            <label
                                                className="learn-more-arcgis-layer-toggle-label"
                                                title="Show/hide this layer for you only"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="learn-more-arcgis-layer-toggle-cb"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        const nowChecked = !isChecked;
                                                        setLinkedCustomLayerChecked(prev => ({ ...prev, [item.id]: nowChecked }));
                                                        handleToggleCustomLayer(item, nowChecked);
                                                    }}
                                                />
                                            </label>
                                            <span className="learn-more-arcgis-link-row">
                                                <span className="learn-more-arcgis-row-text">Custom</span>
                                                <span className="learn-more-arcgis-row-sep"> › </span>
                                                <span className="learn-more-arcgis-row-text">{item.folder_name || 'Root'}</span>
                                                <span className="learn-more-arcgis-row-sep"> › </span>
                                                <span className="learn-more-arcgis-row-text learn-more-arcgis-row-name">{item.display_name}</span>
                                            </span>
                                            {personalSource && <button
                                                type="button"
                                                className="learn-more-arcgis-goto-btn"
                                                onClick={() => window.dispatchEvent(new CustomEvent('open-custom-layers-panel'))}
                                                title="Open Custom Layers Panel"
                                            >
                                                ›
                                            </button>}
                                            {isLearnMoreEditMode && (
                                                <button
                                                    type="button"
                                                    className="learn-more-arcgis-link-delete-btn"
                                                    title="Remove link"
                                                    onClick={async () => {
                                                        try {
                                                            await api.delete(`/cardArcGISLinks/${item.id}`, {params:{requester_email:localStorage.getItem('email') || ''}});
                                                            setLinkedCustomLayerItems(prev => prev.filter(i => i.id !== item.id));
                                                        } catch (err) {
                                                            console.error('Failed to remove custom layer link:', err);
                                                        }
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {isLearnMoreEditMode && (
                            <button
                                type="button"
                                className="learn-more-add-arcgis-btn"
                                onClick={() => setIsCustomLayerPickerOpen(true)}
                            >
                                + Add Custom Layer
                            </button>
                        )}
                    </div>
                    )}

                    {/* Custom Layer Picker Modal */}
                    {isCustomLayerPickerOpen && (
                        <CustomLayerPickerModal
                            onAdd={async (links) => {
                                const cardId = formData.cardID;
                                if (!cardId) return;
                                const newItems = [];
                                for (const link of links) {
                                    try {
                                        const res = await api.post('/cardArcGISLinks', { card_id: cardId, ...link, requester_email:localStorage.getItem('email') || '' });
                                        newItems.push({ id: res.data.id, card_id: cardId, ...link });
                                    } catch (err) {
                                        console.error('Failed to add custom layer link:', err);
                                    }
                                }
                                if (newItems.length > 0) {
                                    setLinkedCustomLayerItems(prev => [...prev, ...newItems]);
                                }
                                setIsCustomLayerPickerOpen(false);
                            }}
                            onClose={() => setIsCustomLayerPickerOpen(false)}
                        />
                    )}
                    </div>
                        </>
                    )}

                    <p className="learn-more-modal-created-date" style={{ marginTop: '1.5rem', color: '#888', fontSize: '0.9rem', textAlign: 'right' }}>
                        <strong>Created:</strong> {formData.date ? new Date(formData.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                    </p>
                </div>

                </div>
            </Modal>

            {framingImage && <ImageFramingModal key={framingImage.image.imageID} image={framingImage.image} aspectRatio={framingImage.ratio}
                onClose={() => setFramingImage(null)} onSave={presentation => {
                    setFormData(prev => ({ ...prev, images: (prev.images || []).map(image => resolveImageServerID(image) === resolveImageServerID(framingImage.image) ? { ...image, presentation } : image) }));
                    setFramingImage(null);
                }} />}
            <LearnMoreOnboarding
                isOpen={isLearnMoreOnboardingOpen}
                onClose={() => setIsLearnMoreOnboardingOpen(false)}
                isModalOpen={isLearnMoreModalVisible}
                onStepChange={setLearnMoreOnboardingStep}
            />

            <Modal
                isOpen={isImagePreviewOpen}
                onRequestClose={() => setIsImagePreviewOpen(false)}
                shouldCloseOnOverlayClick={false}
                className="Modal Modal--image-preview"
                overlayClassName="ModalOverlay ModalOverlay--image-preview"
            >
              <div
                className="image-preview-shell"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                    className="image-preview-close"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsImagePreviewOpen(false);
                    }}
                    aria-label="Close image preview"
                >
                    ×
                </button>
                {imageList.length > 1 && (
                    <button className="image-preview-nav image-preview-nav-prev" onClick={goToPrevImage} aria-label="Previous image">&#8249;</button>
                )}
                <img src={currentImage.url} alt="Project enlarged preview" className="image-preview-content" onError={(e) => { e.target.onerror = null; e.target.src = '/CEREO-logo.png'; }} />
                {imageList.length > 1 && (
                    <button className="image-preview-nav image-preview-nav-next" onClick={goToNextImage} aria-label="Next image">&#8250;</button>
                )}
                {currentImage.original_url && <a className="image-preview-original" href={currentImage.original_url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>Open original image</a>}
                {imageList.length > 1 && (
                    <div className="image-preview-indicators">
                        {imageList.map((img, idx) => (
                            <button
                                key={img.id ?? idx}
                                className={`image-preview-bar${idx === currentImageIndex ? ' active' : ''}`}
                                onClick={(e) => goToImageByIndex(e, idx)}
                                aria-label={`Go to image ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}
              </div>
            </Modal>

            {/* Edit/Create Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onRequestClose={() => {}}
                shouldCloseOnOverlayClick={false}
                shouldCloseOnEsc={false}
                className="Modal"
            >
                <h2>{formData.cardID ? "Edit Project" : "Create Project"}</h2>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const serializedLink = serializeLinks(editFormLinks);
                    saveEdits({ linkOverride: { link: serializedLink, link_text: '' } });
                }}>
                    <label>Project Creator:
                        <input type="text" name="username" value={formData.username || ''} readOnly required title="Project Creator cannot be edited" />
                    </label>
                    <label>Author:
                        <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} required />
                    </label>
                    <label>
                        Full Name:
                        <input
                            type="text"
                            name="name"
                            value={formData.name || ""}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Contact Email:
                        <input
                            type="email"
                            name="contact_email"
                            value={formData.contact_email ?? formData.email ?? ""}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Title:
                        <input
                            type="text"
                            name="title"
                            value={formData.title || ""}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Description:
                        <RichTextEditor
                            value={formData.description || ""}
                            onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
                            placeholder="Enter description..."
                            minHeight={110}
                        />
                    </label>
                    <label>
                        Organization:
                        <input
                            type="text"
                            name="org"
                            value={formData.org || ""}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Funding:
                        <input
                            type="text"
                            name="funding"
                            value={formData.funding || ""}
                            onChange={handleInputChange}
                        />
                    </label>
                    <div className="edit-form-links-section">
                        <label className="edit-form-links-label">Links:</label>
                        {editFormLinks.map((linkItem, idx) => (
                            <div key={idx} className="learn-more-link-row">
                                <input
                                    type="text"
                                    className="edit-form-link-input"
                                    placeholder="URL"
                                    value={linkItem.url}
                                    onChange={e => setEditFormLinks(editFormLinks.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))}
                                />
                                <input
                                    type="text"
                                    className="edit-form-link-input learn-more-link-text-input"
                                    placeholder="Display text (optional)"
                                    value={linkItem.text}
                                    onChange={e => setEditFormLinks(editFormLinks.map((l, i) => i === idx ? { ...l, text: e.target.value } : l))}
                                />
                                {editFormLinks.length > 1 && (
                                    <button
                                        type="button"
                                        className="learn-more-link-remove-btn"
                                        onClick={() => setEditFormLinks(editFormLinks.filter((_, i) => i !== idx))}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            className="learn-more-modal-toolbar-btn cancel learn-more-add-link-btn"
                            onClick={() => setEditFormLinks([...editFormLinks, { url: '', text: '' }])}
                        >
                            + Add More Links
                        </button>
                    </div>
                    <label>
                        Category:
                        <select
                            name="category"
                            value={formData.category || ""}
                            onChange={handleInputChange}
                        >
                            <option value="">Select a Category</option>
                            {CARD_CATEGORIES.map((categoryOption) => (
                                <option key={categoryOption} value={categoryOption}>
                                    {categoryOption}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Tags:
                        <input
                            type="text"
                            name="tags"
                            value={formData.tags || ""}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Visibility:
                        <select
                            name="is_public"
                            value={formData.is_public !== false ? "true" : "false"}
                            onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.value !== "false" }))}
                        >
                            <option value="true">Public (visible to everyone)</option>
                            <option value="false">Private (only visible to me)</option>
                        </select>
                    </label>
                    <label>
                        Latitude:
                        <input
                            type="number"
                            step="any"
                            name="latitude"
                            value={formData.latitude || ""}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Longitude:
                        <input
                            type="number"
                            step="any"
                            name="longitude"
                            value={formData.longitude || ""}
                            onChange={handleInputChange}
                        />
                    </label>

                    {/* Thumbnail Management */}
                    <div className="thumbnail-section">
                        <label>Thumbnail:</label>
                        {preview && (
                            <div className="thumbnail-preview">
                                <img
                                    src={preview}
                                    alt="Thumbnail Preview"
                                    width="120"
                                    onError={(e) => { e.target.onerror = null; e.target.src = '/CEREO-logo.png'; }}
                                    style={{
                                        marginBottom: "10px",
                                        borderRadius: "6px",
                                    }}
                                />
                                <div className="thumbnail-buttons">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            document
                                                .getElementById(
                                                    `thumbnailInput-${formData.cardID || "new"}`
                                                )
                                                .click()
                                        }
                                    >
                                        Change
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setThumbnail(null);
                                            setPreview("/CEREO-logo.png");
                                            setFormData((prev) => ({
                                                ...prev,
                                                thumbnail_link: "",
                                            }));
                                        }}
                                    >
                                        Delete / Reset to Default
                                    </button>
                                </div>
                            </div>
                        )}
                        <input
                            id={`thumbnailInput-${formData.cardID || "new"}`}
                            type="file"
                            accept="image/png, image/jpeg, image/gif"
                            onChange={handleImageChange}
                            style={{ display: "none" }}
                        />
                    </div>

                    {/* Existing Attached Files */}
                    {formData.files && formData.files.length > 0 && (
                        <div className="attached-files">
                            <h4>Attached Files:</h4>
                            <ul>
                                {formData.files.map((file, idx) => (
                                    <li key={file.fileid || idx}>
                                        <a
                                            href={`${api.defaults.baseURL}/downloadFile?fileID=${file.fileid}`}
                                            download
                                            rel="noopener noreferrer"
                                        >
                                            {file.filename}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (
                                                    window.confirm(
                                                        `Delete file "${file.filename}"?`
                                                    )
                                                ) {
                                                    try {
                                                        await api.delete(
                                                            `/deleteFile?fileID=${file.fileid}`
                                                        );
                                                        alert(`Deleted ${file.filename}`);
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            files: prev.files.filter(
                                                                (f) =>
                                                                    f.fileid !== file.fileid
                                                            ),
                                                        }));
                                                    } catch (err) {
                                                        console.error(
                                                            "Error deleting file:",
                                                            err
                                                        );
                                                        alert("Failed to delete file.");
                                                    }
                                                }
                                            }}
                                            style={{ marginLeft: "10px" }}
                                        >
                                            Delete
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Upload New Files */}
                    <label>
                        Add New Files:
                        <input
                            type="file"
                            name="files"
                            multiple
                            onChange={(e) => {
                                const selectedFiles = Array.from(e.target.files);
                                setFormData((prev) => ({
                                    ...prev,
                                    filesToUpload: selectedFiles,
                                }));
                            }}
                        />
                    </label>

                    {/* Hidden original fields */}
                    <input
                        type="hidden"
                        name="original_username"
                        value={formData.original_username || ""}
                    />
                    <input
                        type="hidden"
                        name="original_email"
                        value={formData.original_email || ""}
                    />

                    <button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save"}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            isEditingRef.current = false; // Unlock editing state
                            setIsEditModalOpen(false);
                        }}
                    >
                        Close
                    </button>
                </form>
            </Modal>

            {/* Login Required Prompt */}
            {showLoginPrompt && ReactDOM.createPortal(
                <div
                    className="login-prompt-overlay"
                    onClick={() => setShowLoginPrompt(false)}
                >
                    <div
                        className="login-prompt-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p>Please log in to use this feature.</p>
                        <div className="login-prompt-actions">
                            <a href="/login" className="login-prompt-btn login-prompt-btn--primary">Log In</a>
                            <button
                                className="login-prompt-btn login-prompt-btn--secondary"
                                onClick={() => setShowLoginPrompt(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Polygon/Image Editing Modal (from learn-more edit) */}
            {/* Wrap in a click-stopper so portal events don't bubble to the card's onClick */}
            <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            {isEditingPolygon && (
                <PolygonDrawingModal
                    mode={conversionTargetType || (isImageCard ? 'image' : 'polygon')}
                    title={(conversionTargetType || formData.location_type) === 'image' ? (isConvertingLocationType ? 'Place Image' : 'Edit Image') : 'Draw Polygon'}
                    initialVertices={isConvertingLocationType ? [] : formData.polygon_vertices}
                    initialLineStyle={isConvertingLocationType ? undefined : formData.polygon_line_style}
                    initialFillColor={isConvertingLocationType ? undefined : formData.polygon_fill_color}
                    initialImageUrl={(isImageCard && !isConvertingLocationType) ? getRepresentativeImageUrl() : undefined}
                    onSave={handlePolygonEditSave}
                    onCancel={handlePolygonEditCancel}
                />
            )}
            {isEditingCoordinate && (
                <CoordinatesPanel
                    initialPoints={(() => {
                        if (isConvertingLocationType) return [];
                        // Multi-point cards keep their real points (and per-point icon /
                        // color / opacity) in polygon_vertices — latitude/longitude is only
                        // the card's representative coordinate, so editing from it alone
                        // would show a phantom default marker instead of the card's points.
                        const verts = formData.polygon_vertices;
                        if (formData.location_type === 'multipoint' && Array.isArray(verts) && verts.length > 0) {
                            return verts.map(v => ({
                                lat: parseFloat(v.lat),
                                lng: parseFloat(v.lng),
                                icon: v.icon,
                                color: v.markerColor,
                                opacity: v.markerOpacity,
                            }));
                        }
                        const lat = parseFloat(formData.latitude);
                        const lng = parseFloat(formData.longitude);
                        return (!isNaN(lat) && !isNaN(lng)) ? [{ lat, lng }] : [];
                    })()}
                    onSave={handleCoordinateEditSave}
                    onCancel={handleCoordinateEditCancel}
                    enableServicePointAutoCorrect
                />
            )}
            </div>
        </div>
    );
}

export default Card;
