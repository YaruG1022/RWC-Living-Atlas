import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeart as solidHeart,
  faMagnifyingGlass,
  faPlus,
  faMapMarkerAlt,
  faSort,
  faFilter,
  faThumbtack,
  faSearch,
  faTimes,
  faList,
  faGrip,
  faRightLeft,
  faPenToSquare,
  faTrashCan,
  faDownload,
  faSync,
  faChevronUp,
  faChevronDown,
  faArrowLeft,
  faFolderPlus,
  faMap,
  faCamera,
  faEye,
  faEyeSlash,
  faDrawPolygon,
  faExpand,
  faCompress,
  faMinus,
  faLocationCrosshairs,
  faLocationDot,
  faImage,
  faRotate,
  faShapes,
  faPalette,
  faHand,
  faUpRightAndDownLeftFromCenter,
  faRotateLeft,
  faRotateRight,
  faTrash,
  faEllipsisV,
  faQuestion,
  faPlay,
  faCircleQuestion,
  faCirclePlay,
  faFloppyDisk,
  faUpload,
  faArrowsToCircle,
} from '@fortawesome/free-solid-svg-icons';
import { faHeart as regularHeart, faFolder } from '@fortawesome/free-regular-svg-icons';
import LearnMoreGallery from './LearnMoreGallery';
import ManualGalleryDemo from './manual/ManualGalleryDemo';
import RepresentationPreview from './RepresentationPreview';
import InfoPage from './InfoPage';
import './Card.css';
import './Content2.css';
import './SortDropdown.css';
import './FilterDropdown.css';
import './UserManual.css';
import ManualText from './manual/ManualText';
import { chapterById, sectionGroups } from './manual/catalog';

import './FormModal.css';
import './ArcGISPickerModal.css';
import './ArcgisUploadPanel.css';
import './CustomLayersPanel.css';
import './LayerContextMenu.css';
import './BasemapSwitcher.css';
import './Content1.css';
import './PolygonDrawingModal.css';

const SECTION_GROUPS = sectionGroups;
const ADD_CARDS_FROM_MAP_SECTIONS = chapterById['add-card']
  ? sectionGroups.find(group => group.id === 'card-creation').sections.find(section => section.id === 'add-card').children
  : [];

const flattenSections = (sections) => sections.flatMap((section) => [
  { id: section.id, label: section.label },
  ...(section.children || []),
]);

const ALL_SECTIONS = SECTION_GROUPS.flatMap((group) => flattenSections(group.sections));
const HOME_CARD_SECTIONS = ALL_SECTIONS.filter((section) => section.id !== 'home');

const findGroupForSection = (sectionId) => {
  return SECTION_GROUPS.find((group) => group.sections.some((section) => {
    if (section.id === sectionId) return true;
    return (section.children || []).some((child) => child.id === sectionId);
  })) || null;
};

function UserManual() {
  const [activeSection, setActiveSection] = useState('home');
  const [openGroups, setOpenGroups] = useState(() => (
    Object.fromEntries(SECTION_GROUPS.map((group) => [group.id, true]))
  ));
  const [isAddCardsFromMapOpen, setIsAddCardsFromMapOpen] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('section');
    if (sec && ALL_SECTIONS.some(s => s.id === sec)) {
      setActiveSection(sec);
      const owningGroup = findGroupForSection(sec);
      if (owningGroup) {
        setOpenGroups((prev) => ({ ...prev, [owningGroup.id]: true }));
      }
      if (ADD_CARDS_FROM_MAP_SECTIONS.some(s => s.id === sec)) {
        setIsAddCardsFromMapOpen(true);
      }
    }
  }, []);
  const navTo = (id) => {
    setActiveSection(id);
    const owningGroup = findGroupForSection(id);
    if (owningGroup) {
      setOpenGroups((prev) => ({ ...prev, [owningGroup.id]: true }));
    }
    if (ADD_CARDS_FROM_MAP_SECTIONS.some(section => section.id === id)) {
      setIsAddCardsFromMapOpen(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <InfoPage title="User Manual" className="user-manual">

      <div className="um-layout">
        <nav className="um-nav-sidebar" aria-label="User manual sections">
          <span className="um-nav-heading">Sections</span>
          {SECTION_GROUPS.map((group) => {
            const isGroupActive = group.sections.some((section) => {
              if (activeSection === section.id) return true;
              return (section.children || []).some((child) => child.id === activeSection);
            });
            return (
              <React.Fragment key={group.id}>
                <button
                  className={`um-nav-item um-nav-item--group${isGroupActive ? ' active' : ''}`}
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  aria-expanded={openGroups[group.id]}
                >
                  <span>{group.label}</span>
                  <FontAwesomeIcon icon={openGroups[group.id] ? faChevronDown : faChevronUp} />
                </button>

                {openGroups[group.id] && group.sections.map((section) => (
                  <React.Fragment key={section.id}>
                    <button
                      className={`um-nav-item um-nav-item--child${activeSection === section.id ? ' active' : ''}`}
                      onClick={() => navTo(section.id)}
                    >
                      {section.label}
                    </button>

                    {section.children && (
                      <>
                        <button
                          className={`um-nav-item um-nav-item--subgroup${isAddCardsFromMapOpen ? ' active' : ''}`}
                          onClick={() => setIsAddCardsFromMapOpen((prev) => !prev)}
                          aria-expanded={isAddCardsFromMapOpen}
                        >
                          <span>Add Cards from Map</span>
                          <FontAwesomeIcon icon={isAddCardsFromMapOpen ? faChevronDown : faChevronUp} />
                        </button>

                        {isAddCardsFromMapOpen && section.children.map((childSection) => (
                          <button
                            key={childSection.id}
                            className={`um-nav-item um-nav-item--grandchild${activeSection === childSection.id ? ' active' : ''}`}
                            onClick={() => navTo(childSection.id)}
                          >
                            {childSection.label}
                          </button>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="um-content-area">

      {activeSection === 'home' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="home" blockId="home-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="home" blockId="home-002" onNavigate={navTo} /></p>

        <p className="um-section-desc"><ManualText sectionId="home" blockId="home-003" onNavigate={navTo} /></p>

        <div className="um-home-cards">
          {HOME_CARD_SECTIONS.map(s => (
            <button
              key={s.id}
              className="um-home-card"
              onClick={() => navTo(s.id)}
            >
              <span className="um-home-card-title">{s.label}</span>
              {chapterById[s.id].summary}
            </button>
          ))}
        </div>
      </section>
      )}

      {activeSection === 'navigation' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="navigation" blockId="navigation-001" onNavigate={navTo} /></h2>
        <h3 className="info-page__subheading"><ManualText sectionId="navigation" blockId="navigation-002" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="navigation" blockId="navigation-003" onNavigate={navTo} /></p>
        <p><ManualText sectionId="navigation" blockId="navigation-004" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="navigation" blockId="navigation-005" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="navigation" blockId="navigation-006" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="navigation" blockId="navigation-007" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="navigation" blockId="navigation-008" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="navigation" blockId="navigation-009" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="navigation" blockId="navigation-010" onNavigate={navTo} /></p>
      </section>
      )}

      {activeSection === 'accounts' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="accounts" blockId="accounts-001" onNavigate={navTo} /></h2>
        <h3 className="info-page__subheading"><ManualText sectionId="accounts" blockId="accounts-002" onNavigate={navTo} /></h3>
        <ol><ManualText sectionId="accounts" blockId="accounts-003" onNavigate={navTo} /></ol>
        <h3 className="info-page__subheading"><ManualText sectionId="accounts" blockId="accounts-004" onNavigate={navTo} /></h3>
        <ol><ManualText sectionId="accounts" blockId="accounts-005" onNavigate={navTo} /></ol>
        <h3 className="info-page__subheading"><ManualText sectionId="accounts" blockId="accounts-006" onNavigate={navTo} /></h3>
        <ol><ManualText sectionId="accounts" blockId="accounts-007" onNavigate={navTo} /></ol>
        <h3 className="info-page__subheading"><ManualText sectionId="accounts" blockId="accounts-008" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="accounts" blockId="accounts-009" onNavigate={navTo} /></p>
      </section>
      )}

      {activeSection === 'profile-admin' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="profile-admin" blockId="profile-admin-001" onNavigate={navTo} /></h2>
        <h3 className="info-page__subheading"><ManualText sectionId="profile-admin" blockId="profile-admin-002" onNavigate={navTo} /></h3>
        <ol><ManualText sectionId="profile-admin" blockId="profile-admin-003" onNavigate={navTo} /></ol>
        <p><ManualText sectionId="profile-admin" blockId="profile-admin-004" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="profile-admin" blockId="profile-admin-005" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="profile-admin" blockId="profile-admin-006" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="profile-admin" blockId="profile-admin-007" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="profile-admin" blockId="profile-admin-008" onNavigate={navTo} /></p>
        <p><ManualText sectionId="profile-admin" blockId="profile-admin-009" onNavigate={navTo} /></p>
      </section>
      )}

      {activeSection === 'tutorials-updates' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="tutorials-updates" blockId="tutorials-updates-001" onNavigate={navTo} /></h2>
        <h3 className="info-page__subheading"><ManualText sectionId="tutorials-updates" blockId="tutorials-updates-002" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="tutorials-updates" blockId="tutorials-updates-003" onNavigate={navTo} /></p>
        <p><ManualText sectionId="tutorials-updates" blockId="tutorials-updates-004" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="tutorials-updates" blockId="tutorials-updates-005" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="tutorials-updates" blockId="tutorials-updates-006" onNavigate={navTo} /></p>
      </section>
      )}

      {activeSection === 'feature-search-panel' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-002" onNavigate={navTo} /></p>

        <div className="um-feature-list">

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="feature-search-panel-example-01">
              <div className="um-isolated-demo" style={{ alignItems: 'stretch', minWidth: '280px' }}>
                <div style={{
                  background: 'linear-gradient(180deg, #f4f6f9 0%, #eceff4 100%)',
                  border: '1px solid #d8e1ea',
                  borderRadius: '10px',
                  padding: '10px',
                  width: '100%',
                  boxShadow: '0 6px 18px rgba(16, 33, 54, 0.15)'
                }}>
                  <div className="search-mini-form" style={{ marginBottom: '8px' }}>
                    <input className="search-mini-input" value="add" readOnly />
                    <button type="button" className="search-mini-button" style={{ pointerEvents: 'none' }}>
                      <FontAwesomeIcon icon={faSearch} />
                    </button>
                    <button type="button" className="search-mini-clear-button" style={{ pointerEvents: 'none' }}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                  <div className="search-mini-results">
                    <button type="button" className="search-mini-result-item" style={{ pointerEvents: 'none' }}>
                      Add Card
                    </button>
                    <button type="button" className="search-mini-result-item" style={{ pointerEvents: 'none' }}>
                      Add Points / Coordinates
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-004" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="feature-search-panel-example-02">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px' }}>
                <div className="search-mini-results" style={{ maxHeight: 'none' }}>
                  <button type="button" className="search-mini-result-item" style={{ pointerEvents: 'none' }}>View All Cards</button>
                  <button type="button" className="search-mini-result-item" style={{ pointerEvents: 'none' }}>Upload Panel Search</button>
                  <button type="button" className="search-mini-result-item" style={{ pointerEvents: 'none' }}>Basemap: streets-v12</button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-006" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="feature-search-panel-example-03">
              <div className="um-isolated-demo" style={{ gap: '10px' }}>
                <button type="button" className="search-mini-result-item" style={{ pointerEvents: 'none' }}>
                  Add Card
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="feature-search-panel" blockId="feature-search-panel-008" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'card-container' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="card-container" blockId="card-container-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="card-container" blockId="card-container-002" onNavigate={navTo} /></p>

        {/* ---- Full annotated demo card ---- */}
        <div className="um-card-demo-wrapper" data-manual-example="card-container-example-01">
          <span className="um-card-demo-label">Demo card — hover to explore</span>
          <div className="um-card-container" style={{ position: 'relative' }}>
            <button className="card-grid-pin-btn" title="Pin to top" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faThumbtack} />
            </button>
            <div className="card">
              {/* Favorite icon */}
              <span
                className="favorite-icon"
                title="Favorite / Bookmark"
                aria-label="Favorite"
              >
                <FontAwesomeIcon icon={regularHeart} />
              </span>

              {/* Thumbnail container with nav arrows + dots */}
              <div className="card-thumbnail-container">
                <img
                  src="/manual-sample-image.svg"
                  alt="Demo thumbnail"
                  className="card-thumbnail"
                />
                <button
                  className="card-image-nav card-image-nav-prev"
                  aria-label="Previous image"
                  tabIndex={-1}
                >
                  ❮
                </button>
                <button
                  className="card-image-nav card-image-nav-next"
                  aria-label="Next image"
                  tabIndex={-1}
                >
                  ❯
                </button>
                <div className="card-image-indicators">
                  <span className="card-image-dot active" />
                  <span className="card-image-dot" />
                  <span className="card-image-dot small" />
                </div>
              </div>

              {/* Title */}
              <div className="card-title-row">
                <h2 className="card-title">Sample Dataset Title</h2>
              </div>

              {/* Tags + zoom */}
              <div className="card-meta-row">
                <p className="card-meta">river, watershed</p>
                <button
                  className="card-meta-zoom-btn"
                  title="Locate on map"
                  aria-label="Locate on map"
                  tabIndex={-1}
                >
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Thumbnail */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-02">
              <div className="card-thumbnail-container um-thumb-demo">
                <div className="card-thumbnail card-thumbnail--empty">No image</div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-004" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Multi-image navigation */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-03">
              <div className="card-thumbnail-container um-thumb-demo">
                <img src="/manual-sample-image.svg" alt="Demo thumbnail" className="card-thumbnail" />
                <button
                  className="card-image-nav card-image-nav-prev"
                  aria-label="Previous image"
                  tabIndex={-1}
                >
                  ❮
                </button>
                <button
                  className="card-image-nav card-image-nav-next"
                  aria-label="Next image"
                  tabIndex={-1}
                >
                  ❯
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-006" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="card-container" blockId="card-container-007" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 3. Indicator dots */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-04">
              <div className="um-dots-demo">
                <div className="card-image-indicators">
                  <span className="card-image-dot active" />
                  <span className="card-image-dot" />
                  <span className="card-image-dot small" />
                  <span className="card-image-dot small" />
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-008" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-009" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Full-size preview */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-05">
              <div className="card-thumbnail-container um-thumb-demo">
                <img
                  src="/manual-sample-image.svg"
                  alt="Demo thumbnail"
                  className="card-thumbnail"
                  style={{ cursor: 'zoom-in' }}
                />
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-010" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-011" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="card-container" blockId="card-container-012" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 5. Favorite */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-06">
              <div className="um-isolated-demo">
                <span
                  className="favorite-icon"
                  title="Unfavorited"
                  style={{ position: 'static' }}
                  aria-label="Unfavorited heart"
                >
                  <FontAwesomeIcon icon={regularHeart} />
                </span>
                <span
                  className="favorite-icon filled"
                  title="Favorited"
                  style={{ position: 'static' }}
                  aria-label="Favorited heart"
                >
                  <FontAwesomeIcon icon={solidHeart} />
                </span>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-013" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-014" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="card-container" blockId="card-container-015" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 6. Pin to Top */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-07">
              <div className="um-isolated-demo" style={{ gap: '14px' }}>
                <button className="card-grid-pin-btn" style={{ position: 'static', pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faThumbtack} />
                </button>
                <button className="card-grid-pin-btn active" style={{ position: 'static', pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faThumbtack} />
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-016" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-017" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="card-container" blockId="card-container-018" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 7. Card title */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-08">
              <div className="um-meta-row-demo">
                <div className="card" style={{ pointerEvents: 'none' }}>
                  <div style={{ width: '100%', height: 0 }} />
                  <div className="card-title-row">
                    <h2 className="card-title">Long Sample Dataset Title That Gets Truncated</h2>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-019" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-020" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 7. Tags */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-09">
              <div className="um-meta-row-demo">
                <div className="card" style={{ pointerEvents: 'none' }}>
                  <div style={{ width: '100%', height: 0 }} />
                  <div className="card-title-row">
                    <h2 className="card-title">Sample Title</h2>
                  </div>
                  <div className="card-meta-row">
                    <p className="card-meta">river, watershed</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-021" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-022" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Zoom to map */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-10">
              <div className="um-meta-row-demo">
                <div className="card" style={{ pointerEvents: 'none' }}>
                  <div style={{ width: '100%', height: 0 }} />
                  <div className="card-title-row">
                    <h2 className="card-title">Sample Title</h2>
                  </div>
                  <div className="card-meta-row">
                    <p className="card-meta">River</p>
                    <button
                      className="card-meta-zoom-btn"
                      title="Locate on map"
                      aria-label="Locate on map"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-023" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-024" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 9. Open details */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-11">
              <div className="um-card-container">
                <div className="card" style={{ cursor: 'pointer' }}>
                  <div className="card-thumbnail-container" style={{ aspectRatio: '280/100' }}>
                    <img src="/manual-sample-image.svg" alt="Demo thumbnail" className="card-thumbnail" />
                  </div>
                  <div className="card-title-row">
                    <h2 className="card-title">Click anywhere to open</h2>
                  </div>
                  <div className="card-meta-row">
                    <p className="card-meta">Places</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-025" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-026" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-027" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="card-container" blockId="card-container-028" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 10. Map-selected highlight */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="card-container-example-12">
              <div className="um-card-container">
                <div className="card card--map-selected" style={{ pointerEvents: 'none' }}>
                  <div className="card-thumbnail-container" style={{ aspectRatio: '280/100' }}>
                    <img src="/manual-sample-image.svg" alt="Demo thumbnail" className="card-thumbnail" />
                  </div>
                  <div className="card-title-row">
                    <h2 className="card-title">Map-Selected Card</h2>
                  </div>
                  <div className="card-meta-row">
                    <p className="card-meta">Other</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="card-container" blockId="card-container-029" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="card-container" blockId="card-container-030" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'chatbot' && (
        <section className="um-section">
          <h2 className="info-page__section-title"><ManualText sectionId="chatbot" blockId="chatbot-001" onNavigate={navTo} /></h2>
          <p className="um-section-desc"><ManualText sectionId="chatbot" blockId="chatbot-002" onNavigate={navTo} /></p>
          <div className="um-isolated-demo" data-manual-example="chatbot-example-01"><FontAwesomeIcon icon={faRightLeft} /> Switch to sidebar panel / Switch to floating widget</div>
          <p><ManualText sectionId="chatbot" blockId="chatbot-003" onNavigate={navTo} /></p>
          <h3 className="info-page__subheading"><ManualText sectionId="chatbot" blockId="chatbot-004" onNavigate={navTo} /></h3>
          <p><ManualText sectionId="chatbot" blockId="chatbot-005" onNavigate={navTo} /></p>
          <p><ManualText sectionId="chatbot" blockId="chatbot-006" onNavigate={navTo} /></p>
          <h3 className="info-page__subheading"><ManualText sectionId="chatbot" blockId="chatbot-007" onNavigate={navTo} /></h3>
          <p><ManualText sectionId="chatbot" blockId="chatbot-008" onNavigate={navTo} /></p>
        </section>
      )}

      {activeSection === 'toolbar' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="toolbar" blockId="toolbar-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="toolbar" blockId="toolbar-002" onNavigate={navTo} /></p>
        <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-003" onNavigate={navTo} /></p>

        {/* Full toolbar demo */}
        <div className="um-toolbar-demo-wrapper" data-manual-example="toolbar-example-01">
          <div className="card-panel-top" style={{ borderRadius: '8px', border: '1px solid #d8e1ea' }}>
            <div className="card-panel-titlebar">
              <span className="card-panel-title">Project Cards</span>
              <span className="card-panel-subtitle">24 all cards</span>
            </div>
            <div className="card-panel-toolbar">
              <button type="button" className="card-toolbar-button" title="Add Card">
                <FontAwesomeIcon icon={faPlus} /> Add Card
              </button>
              <div className="sort-dropdown" style={{ width: 'auto' }}>
                <button type="button" className="sort-dropdown-trigger" title="Sort cards">
                  <FontAwesomeIcon icon={faSort} />
                  <span>Sort By</span>
                </button>
              </div>
              <div className="filter-dropdown">
                <button type="button" className="filter-dropdown-trigger" title="Filter">
                  <FontAwesomeIcon icon={faFilter} />
                  <span>Filter By</span>
                </button>
              </div>
              <button type="button" className="card-toolbar-button card-toolbar-button--scope all-cards" title="Scope">
                All Cards
              </button>
              <button type="button" className="card-toolbar-button card-toolbar-button--icon" title="List View">
                <FontAwesomeIcon icon={faList} />
              </button>
              <button type="button" className="card-toolbar-button card-toolbar-button--icon" title="Move panel to left">
                <FontAwesomeIcon icon={faRightLeft} />
              </button>
            </div>
            <div className="card-panel-searchbar">
              <input type="text" placeholder="Search cards..." readOnly />
              <button type="button" className="card-panel-searchbar-btn search" title="Search">
                <FontAwesomeIcon icon={faSearch} />
              </button>
              <button type="button" className="card-panel-searchbar-btn clear" title="Clear Search">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

          </div>
        </div>

        <div className="um-feature-list">

          {/* 1. Add Card */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-02">
              <div className="um-isolated-demo">
                <button type="button" className="card-toolbar-button" title="Add Card" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faPlus} /> Add Card
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-004" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-005" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Sort Dropdown */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-03">
              <div className="um-isolated-demo">
                <div className="sort-dropdown" style={{ width: 'auto' }}>
                  <button type="button" className="sort-dropdown-trigger" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faSort} />
                    <span>Newest First</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-006" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-007" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Filter Dropdown */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-04">
              <div className="um-isolated-demo" style={{ display: 'flex', gap: '8px' }}>
                <div className="filter-dropdown">
                  <button type="button" className="filter-dropdown-trigger" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faFilter} />
                    <span>Filter By</span>
                  </button>
                </div>
                <div className="filter-dropdown">
                  <button type="button" className="filter-dropdown-trigger active" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faFilter} />
                    <span>Filter By</span>
                    <span className="filter-dropdown-badge">2</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-008" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-009" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-05"><div className="um-isolated-demo">
              <label><input type="checkbox" defaultChecked readOnly /> Show only favorited cards</label>
            </div></div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-010" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-011" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 6. Scope toggle */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-06">
              <div className="um-isolated-demo" style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="card-toolbar-button card-toolbar-button--scope all-cards" style={{ pointerEvents: 'none' }}>
                  All Cards
                </button>
                <button type="button" className="card-toolbar-button card-toolbar-button--scope in-view" style={{ pointerEvents: 'none' }}>
                  In View
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-012" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-013" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 7. Grid / List toggle */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-07">
              <div className="um-isolated-demo" style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="card-toolbar-button card-toolbar-button--icon" title="List View" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faList} />
                </button>
                <button type="button" className="card-toolbar-button card-toolbar-button--icon active" title="Grid View" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faGrip} />
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-014" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-015" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Move Panel */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-08">
              <div className="um-isolated-demo">
                <button type="button" className="card-toolbar-button card-toolbar-button--icon" title="Move panel to left" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faRightLeft} />
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-016" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-017" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 9. Search bar */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-09">
              <div className="um-searchbar-demo">
                <div className="card-panel-searchbar">
                  <input type="text" defaultValue="watershed" readOnly />
                  <button type="button" className="card-panel-searchbar-btn search" title="Search" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                  <button type="button" className="card-panel-searchbar-btn clear" title="Clear Search" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-018" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-019" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 10. Info bar */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="toolbar-example-10">
              <div className="um-isolated-demo">
                <div className="card-panel-info-bar">
                  <span className="card-panel-title">Project Cards</span>
                  <span className="card-panel-subtitle">12 in view</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="toolbar" blockId="toolbar-020" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="toolbar" blockId="toolbar-021" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'add-card' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="add-card" blockId="add-card-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="add-card" blockId="add-card-002" onNavigate={navTo} /></p>

        {/* ---- Overview demo: compact scrollable form ---- */}
        <div className="um-form-demo-wrapper" data-manual-example="add-card-example-01">
          <div className="um-form-demo-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>Create Card</h2>
              <button className="close-modal-button" style={{ position: 'static', fontSize: '20px', pointerEvents: 'none' }}>&times;</button>
            </div>
            <label>Author Name (required):</label>
            <input type="text" readOnly placeholder="Jane Doe" className="um-form-input-mock" />
            <label>Email (required):</label>
            <input type="text" readOnly placeholder="jane@example.com" className="um-form-input-mock" />
            <label>Title (required):</label>
            <input type="text" readOnly placeholder="WA Watershed Study 2024" className="um-form-input-mock" />
            <label>Category:</label>
            <select disabled className="um-form-input-mock">
              <option>Select a Category</option>
              <option>River</option>
            </select>
            <label>Description:</label>
            <textarea readOnly rows={2} placeholder="A brief summary of the dataset…" className="um-form-input-mock" style={{ resize: 'none' }} />
            <label>Links:</label>
            <div className="form-modal-link-row" style={{ pointerEvents: 'none' }}>
              <input type="text" readOnly placeholder="URL" className="form-modal-link-input" />
              <input type="text" readOnly placeholder="Display text" className="form-modal-link-input form-modal-link-text-input" />
            </div>
            <label style={{ marginTop: '8px' }}>Location Type:</label>
            <div className="form-modal-location-tabs" style={{ pointerEvents: 'none', marginBottom: '10px' }}>
              <button type="button" className="form-modal-location-tab active">Single Point</button>
              <button type="button" className="form-modal-location-tab">Polygon Area</button>
              <button type="button" className="form-modal-location-tab">Image Overlay</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button type="button" style={{ background: '#0077c0', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', fontWeight: 600, fontSize: '13px', cursor: 'default' }}>Submit</button>
              <button type="button" className="cancel_button" style={{ pointerEvents: 'none', fontSize: '13px' }}>Cancel</button>
            </div>
          </div>
        </div>

        {/* ---- Feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Opening the Form */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-02">
              <div className="um-isolated-demo">
                <button type="button" className="card-toolbar-button" title="Add Card" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faPlus} /> Add Card
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-004" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Required Fields */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-03">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374957', marginBottom: '3px' }}>Author Name <span style={{ color: '#e05' }}>*</span></label>
                <input type="text" readOnly defaultValue="Jane Doe" className="um-form-input-mock" style={{ marginBottom: '8px' }} />
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374957', marginBottom: '3px' }}>Title <span style={{ color: '#e05' }}>*</span></label>
                <input type="text" readOnly defaultValue="WA Watershed Study 2024" className="um-form-input-mock" style={{ marginBottom: '8px' }} />
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374957', marginBottom: '3px' }}>Category</label>
                <select disabled className="um-form-input-mock">
                  <option>River</option>
                </select>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-006" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Optional Info Fields */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-04">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374957', marginBottom: '3px' }}>Description</label>
                <textarea readOnly rows={2} defaultValue="Longitudinal stream temperature data…" className="um-form-input-mock" style={{ resize: 'none', marginBottom: '8px' }} />
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374957', marginBottom: '3px' }}>Funding</label>
                <input type="text" readOnly defaultValue="NSF Grant #1234567" className="um-form-input-mock" style={{ marginBottom: '8px' }} />
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374957', marginBottom: '3px' }}>Tags (comma-separated)</label>
                <input type="text" readOnly defaultValue="river, temperature, salmon" className="um-form-input-mock" />
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-008" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Links */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-05">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '280px' }}>
                <div className="form-modal-link-row" style={{ pointerEvents: 'none' }}>
                  <input type="text" readOnly defaultValue="https://example.gov/data" className="form-modal-link-input" />
                  <input type="text" readOnly defaultValue="Dataset Portal" className="form-modal-link-input form-modal-link-text-input" />
                </div>
                <div className="form-modal-link-row" style={{ pointerEvents: 'none' }}>
                  <input type="text" readOnly placeholder="URL" className="form-modal-link-input" />
                  <input type="text" readOnly placeholder="Display text (optional)" className="form-modal-link-input form-modal-link-text-input" />
                </div>
                <button type="button" className="form-modal-add-link-btn" style={{ pointerEvents: 'none', alignSelf: 'flex-start', marginTop: '4px' }}>+ Add More Links</button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-009" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-010" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5. Location */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-06">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', gap: '8px' }}>
                <div className="form-modal-location-tabs" style={{ pointerEvents: 'none' }}>
                  <button type="button" className="form-modal-location-tab active">Single Point</button>
                  <button type="button" className="form-modal-location-tab">Polygon Area</button>
                  <button type="button" className="form-modal-location-tab">Image Overlay</button>
                </div>
                <button type="button" className="location_button" style={{ pointerEvents: 'none', marginBottom: 0 }}>
                  <FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: '6px' }} />
                  Select a Location
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" readOnly placeholder="Latitude" className="um-form-input-mock" style={{ margin: 0 }} />
                  <input type="text" readOnly placeholder="Longitude" className="um-form-input-mock" style={{ margin: 0 }} />
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-011" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-012" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5b. Polygon Area sub-options */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-07">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '240px', gap: '10px', pointerEvents: 'none' }}>
                {/* tabs — polygon active */}
                <div className="form-modal-location-tabs">
                  <button type="button" className="form-modal-location-tab">Single Point</button>
                  <button type="button" className="form-modal-location-tab active">Polygon Area</button>
                  <button type="button" className="form-modal-location-tab">Image Overlay</button>
                </div>
                {/* polygon section */}
                <div className="form-modal-polygon-section">
                  <button type="button" className="location_button" style={{ marginBottom: 0 }}>
                    <FontAwesomeIcon icon={faDrawPolygon} style={{ marginRight: '6px' }} />
                    Draw Polygon on Map
                  </button>
                  <div className="form-modal-polygon-summary">
                    <span className="form-modal-polygon-check">&#10003;</span>
                    Polygon saved: 5 points
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-013" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-014" onNavigate={navTo} /></p>
              <p className="um-feature-desc" style={{ marginTop: '8px' }}><ManualText sectionId="add-card" blockId="add-card-015" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5c. Image Overlay sub-options */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-08">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '240px', gap: '10px', pointerEvents: 'none' }}>
                <div className="form-modal-location-tabs">
                  <button type="button" className="form-modal-location-tab">Single Point</button>
                  <button type="button" className="form-modal-location-tab">Polygon Area</button>
                  <button type="button" className="form-modal-location-tab active">Image Overlay</button>
                </div>
                <div className="form-modal-polygon-section">
                  <button type="button" className="location_button" style={{ marginBottom: 0 }}>
                    <FontAwesomeIcon icon={faImage} style={{ marginRight: '6px' }} />
                    Add Image to Map
                  </button>
                  <div className="form-modal-polygon-summary">
                    <span className="form-modal-polygon-check">&#10003;</span>
                    Overlay saved: 4 corners
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-016" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-017" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 6. Images & Files */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-09">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '240px', gap: '8px' }}>
                <div className="form-modal-image-upload-area" style={{ pointerEvents: 'none', padding: '12px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#666' }}>Click or drag to add images</p>
                  <span className="form-modal-image-upload-btn" style={{ fontSize: '12px', padding: '4px 10px' }}>Choose Images</span>
                </div>
                <div className="form-modal-file-upload-area" style={{ pointerEvents: 'none', padding: '12px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#666' }}>Click to add files (max 5 MB)</p>
                  <span className="form-modal-image-upload-btn" style={{ fontSize: '12px', padding: '4px 10px' }}>Choose Files</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-018" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-019" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 7. Linked ArcGIS Services */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-10">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <button type="button" className="location_button" style={{ pointerEvents: 'none', marginBottom: 0 }}>
                  + Link ArcGIS Service / Layer
                </button>
                <div className="form-modal-file-list" style={{ width: '100%' }}>
                  <div className="form-modal-file-item" style={{ pointerEvents: 'none' }}>
                    <span>WA Streams and Rivers — Stream Layer</span>
                    <button type="button">&times;</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-020" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-021" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Card marker / polygon map popup */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-card-example-11">
              <div className="um-isolated-demo" style={{ padding: 0, minWidth: '260px', maxWidth: '300px', alignItems: 'stretch' }}>
                <div className="um-card-popup-demo-wrapper">
                  <div className="card-pin-popup-panel">
                    {/* thumbnail area */}
                    <div className="card-pin-popup-media">
                      <div style={{ width: '100%', height: '120px', background: '#d9dde3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>Card thumbnail</span>
                      </div>
                    </div>
                    {/* info panel */}
                    <div className="card-pin-popup-info-panel" style={{ cursor: 'default' }}>
                      <h3 className="card-pin-popup-title">Palouse Riparian Study</h3>
                      <p className="card-pin-popup-category">Hydrology</p>
                      <p className="card-pin-popup-tags">Tags: riparian, stream, ecology</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-card" blockId="add-card-022" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-card" blockId="add-card-023" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'arcgis-picker' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-002" onNavigate={navTo} /></p>

        {/* ---- Overview demo ---- */}
        <div className="um-picker-demo-wrapper" data-manual-example="arcgis-picker-example-01">
          {/* Header */}
          <div className="arcgis-picker-header" style={{ borderBottom: '1px solid #e0e0e0' }}>
            <div className="arcgis-picker-search-row">
              <input type="text" className="arcgis-picker-search-input" readOnly placeholder="Search folders, services, or layers…" />
              <select className="arcgis-picker-search-type-select" defaultValue="any" style={{ pointerEvents: 'none' }}>
                <option value="any">Any</option>
              </select>
              <button type="button" className="arcgis-picker-search-btn" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faSearch} />
              </button>
              <button type="button" className="arcgis-picker-clear-btn" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
          {/* Body */}
          <div style={{ borderBottom: '1px solid #f0f0f0' }}>
            <div className="arcgis-picker-nav-state-row" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faFolder} className="arcgis-picker-nav-folder-icon" />
              Washington State ArcGIS Services
            </div>
            <div className="arcgis-picker-nav-state-row" style={{ pointerEvents: 'none', opacity: 0.65 }}>
              <FontAwesomeIcon icon={faFolder} className="arcgis-picker-nav-folder-icon" />
              Idaho ArcGIS Services
            </div>
            <div className="arcgis-picker-nav-state-row" style={{ pointerEvents: 'none', opacity: 0.65 }}>
              <FontAwesomeIcon icon={faFolder} className="arcgis-picker-nav-folder-icon" />
              Oregon ArcGIS Services
            </div>
          </div>
          {/* Footer */}
          <div className="arcgis-picker-footer">
            <span className="arcgis-picker-count">0 items selected</span>
            <div className="arcgis-picker-footer-btns">
              <button type="button" className="arcgis-picker-cancel-btn" style={{ pointerEvents: 'none' }}>Cancel</button>
              <button type="button" className="arcgis-picker-add-btn" disabled style={{ pointerEvents: 'none' }}>Add</button>
            </div>
          </div>
        </div>

        {/* ---- Feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Opening */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-picker-example-02">
              <div className="um-isolated-demo">
                <button type="button" className="location_button" style={{ pointerEvents: 'none', marginBottom: 0 }}>
                  + Link ArcGIS Service / Layer
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-004" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Search */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-picker-example-03">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '280px' }}>
                <div className="arcgis-picker-search-row" style={{ pointerEvents: 'none' }}>
                  <input type="text" className="arcgis-picker-search-input" readOnly defaultValue="streams" />
                  <select className="arcgis-picker-search-type-select" defaultValue="layer" style={{ pointerEvents: 'none' }}>
                    <option value="layer">Layer</option>
                  </select>
                  <button type="button" className="arcgis-picker-search-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                  <button type="button" className="arcgis-picker-clear-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '6px', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#444', minWidth: '46px', textAlign: 'center' }}>2 / 7</span>
                  <button type="button" className="arcgis-picker-nav-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faChevronUp} />
                  </button>
                  <button type="button" className="arcgis-picker-nav-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faChevronDown} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-006" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Drill-down Navigation */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-picker-example-04">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', padding: 0, gap: 0 }}>
                {/* breadcrumb */}
                <div className="arcgis-picker-breadcrumb" style={{ pointerEvents: 'none' }}>
                  <button type="button" className="arcgis-picker-back-btn" style={{ pointerEvents: 'none' }}>←</button>
                  <span style={{ fontSize: '13px', color: '#2a4d7a' }}>Washington State ArcGIS Services <span style={{ color: '#999', margin: '0 4px' }}>/</span> Hydrology</span>
                </div>
                {/* folder rows */}
                <div className="arcgis-picker-nav-folder-row" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faFolder} className="arcgis-picker-nav-folder-icon" style={{ marginRight: '6px' }} />
                  Streams and Rivers
                </div>
                <div className="arcgis-picker-nav-folder-row" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faFolder} className="arcgis-picker-nav-folder-icon" style={{ marginRight: '6px' }} />
                  Watershed Boundaries
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-008" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Service rows */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-picker-example-05">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', padding: 0, gap: 0 }}>
                <div className="arcgis-picker-service-row" style={{ pointerEvents: 'none' }}>
                  <input type="checkbox" className="arcgis-picker-checkbox" readOnly />
                  <span className="arcgis-picker-arrow">►</span>
                  <span className="arcgis-picker-service-label">WA Streams and Rivers</span>
                </div>
                <div className="arcgis-picker-service-row" style={{ pointerEvents: 'none', background: '#f0f4fa' }}>
                  <input type="checkbox" className="arcgis-picker-checkbox" defaultChecked readOnly style={{ accentColor: '#1d4ed8' }} />
                  <span className="arcgis-picker-arrow">▼</span>
                  <span className="arcgis-picker-service-label">Watershed Boundaries</span>
                </div>
                <div className="arcgis-picker-layers-content" style={{ pointerEvents: 'none' }}>
                  <div className="upload-layer-row" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
                    <input type="checkbox" defaultChecked readOnly style={{ marginRight: '4px', accentColor: '#1d4ed8' }} />
                    <span className="upload-layer-name" style={{ fontSize: '0.82rem' }}>HUC 8 Boundaries</span>
                  </div>
                  <div className="upload-layer-row" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
                    <input type="checkbox" readOnly style={{ marginRight: '4px' }} />
                    <span className="upload-layer-name" style={{ fontSize: '0.82rem' }}>HUC 12 Boundaries</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-009" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-010" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5. Footer */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-picker-example-06">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', padding: 0 }}>
                <div className="arcgis-picker-footer" style={{ pointerEvents: 'none' }}>
                  <span className="arcgis-picker-count">3 items selected</span>
                  <div className="arcgis-picker-footer-btns">
                    <button type="button" className="arcgis-picker-cancel-btn" style={{ pointerEvents: 'none' }}>Cancel</button>
                    <button type="button" className="arcgis-picker-add-btn" style={{ pointerEvents: 'none' }}>Add</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-011" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-picker" blockId="arcgis-picker-012" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'detail-view' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="detail-view" blockId="detail-view-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="detail-view" blockId="detail-view-002" onNavigate={navTo} /></p>

        {/* Full static mock of the modal shell */}
        <div className="um-modal-demo-wrapper" data-manual-example="detail-view-example-01">
          <div className="learn-more-modal-shell" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
            <div className="learn-more-modal-toolbar">
              <div className="learn-more-modal-toolbar-left">
                <button className="learn-more-modal-edit-btn" title="Edit" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faPenToSquare} />
                </button>
                <button className="learn-more-modal-download-btn" title="Download as PDF" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button className="learn-more-modal-delete-btn" title="Delete card" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faTrashCan} />
                </button>
              </div>
              <div className="learn-more-modal-toolbar-right">
                <button className="learn-more-modal-close" style={{ pointerEvents: 'none' }}>×</button>
              </div>
            </div>
            <div className="learn-more-modal-body um-modal-body-preview">
              <LearnMoreGallery images={[1, 2, 3, 4, 5].map(id => ({ id, url: '/manual-sample-image.svg' }))} editing={false} onOpen={() => {}} onSeeAll={() => {}} />
              <div className="learn-more-modal-title-section">
                <h2>Yakima River Basin Watershed Study</h2>
                <p className="learn-more-modal-subtitle">Watershed</p>
              </div>
              <div className="learn-more-fields-grid">
                <p><strong>Author:</strong> Jane Smith</p>
                <p><strong>Card Creator:</strong> jsmith</p>
                <p><strong>Email:</strong> j.smith@cereo.edu</p>
                <p><strong>Funding:</strong> NSF Grant #12345</p>
                <p><strong>Organization:</strong> Rivers, Watersheds, Communities (RWC)</p>
              </div>
              <div className="learn-more-location-section">
                <p><strong>Map location:</strong></p>
                <div className="learn-more-representation-preview">
                  <RepresentationPreview data={{ location_type: 'point', latitude: 46.6, longitude: -120.5 }} />
                  <div className="learn-more-representation-info">
                    <span className="learn-more-representation-type">Point</span>
                    <span className="learn-more-representation-detail">46.6, -120.5</span>
                  </div>
                </div>
              </div>
              <div className="learn-more-links-view">
                <strong>Links:</strong>
                <ul className="learn-more-links-list">
                  <li><a href="#um" onClick={e => e.preventDefault()}>Rivers, Watersheds, Communities (RWC) Homepage</a></li>
                </ul>
              </div>
              <p className="learn-more-modal-description"><strong>Description:</strong> A comprehensive study of the Yakima River Basin watershed covering hydrology, ecology, and land-use patterns over a 10-year period.</p>
              <p><strong>Tags:</strong>
                <span className="learn-more-tags-chips">
                  <span className="learn-more-tag-chip learn-more-tag-chip-readonly">hydrology</span>
                  <span className="learn-more-tag-chip learn-more-tag-chip-readonly">ecology</span>
                  <span className="learn-more-tag-chip learn-more-tag-chip-readonly">yakima</span>
                  <span className="learn-more-tag-chip learn-more-tag-chip-readonly">land-use</span>
                </span>
              </p>
              <p><strong>Visibility:</strong> Public</p>
              <div className="file-list learn-more-file-list">
                <h3>Downloadable Files:</h3>
                <ul><li><a href="#um" onClick={e => e.preventDefault()}>yakima_study_2023.pdf</a></li></ul>
              </div>
              <div className="learn-more-arcgis-links-section">
                <p><strong>Linked ArcGIS Services/Layers:</strong></p>
                <ul className="learn-more-arcgis-links-list">
                  <li className="learn-more-arcgis-link-item">
                    <label className="learn-more-arcgis-layer-toggle-label">
                      <input type="checkbox" className="learn-more-arcgis-layer-toggle-cb" defaultChecked readOnly />
                    </label>
                    <span className="learn-more-arcgis-link-row">
                      <span className="learn-more-arcgis-row-text">Washington State ArcGIS Services</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text">Hydrology</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text learn-more-arcgis-row-name">Streams &amp; Rivers</span>
                    </span>
                    <button type="button" className="learn-more-arcgis-goto-btn" style={{ pointerEvents: 'none' }}>›</button>
                  </li>
                </ul>
              </div>
              <div className="learn-more-arcgis-links-section">
                <p><strong>Linked Custom Layers:</strong></p>
                <ul className="learn-more-arcgis-links-list">
                  <li className="learn-more-arcgis-link-item">
                    <label className="learn-more-arcgis-layer-toggle-label">
                      <input type="checkbox" className="learn-more-arcgis-layer-toggle-cb" defaultChecked readOnly />
                    </label>
                    <span className="learn-more-arcgis-link-row">
                      <span className="learn-more-arcgis-row-text">Custom</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text">My Hydrology Layers</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text learn-more-arcgis-row-name">WA Streams and Rivers</span>
                    </span>
                    <button type="button" className="learn-more-arcgis-goto-btn" style={{ pointerEvents: 'none' }}>›</button>
                  </li>
                </ul>
              </div>
              <p style={{ marginTop: '1.5rem', color: '#888', fontSize: '0.9rem', textAlign: 'right' }}>
                <strong>Created:</strong> January 15, 2024
              </p>
            </div>
          </div>
        </div>

        <div className="um-feature-list">

          {/* 1. Toolbar — view mode */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-02">
              <div className="um-isolated-demo" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', minWidth: '220px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="learn-more-modal-edit-btn" title="Edit" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faPenToSquare} />
                  </button>
                  <button className="learn-more-modal-download-btn" title="Download as PDF" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faDownload} />
                  </button>
                  <button className="learn-more-modal-delete-btn" title="Delete card" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                  <button className="learn-more-modal-help-btn" title="Help" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faCircleQuestion} />
                  </button>
                  <button className="learn-more-modal-onboarding-btn" title="Onboarding" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faCirclePlay} />
                  </button>
                </div>
                <button className="learn-more-modal-close" style={{ pointerEvents: 'none' }}>×</button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-004" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Toolbar — edit mode */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-03">
              <div className="um-isolated-demo" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="learn-more-modal-toolbar-actions">
                  <button className="learn-more-modal-toolbar-btn save" style={{ pointerEvents: 'none' }}>Save</button>
                  <button className="learn-more-modal-toolbar-btn cancel" style={{ pointerEvents: 'none' }}>Cancel</button>
                  <span className="learn-more-unsaved-badge">You have unsaved changes</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-006" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Image Gallery */}
          <div className="um-feature-row um-feature-row--gallery">
            <div className="um-feature-demo" data-manual-example="detail-view-example-04">
              <div className="um-isolated-demo um-gallery-demo um-gallery-demo--interactive">
                <ManualGalleryDemo />
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-008" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. All Images view */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-05">
              <div className="um-isolated-demo um-all-images-demo">
                <div className="learn-more-all-images-view">
                  <div className="learn-more-all-images-header">
                    <button type="button" className="learn-more-all-images-back-link" style={{ pointerEvents: 'none' }}><FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" /> Back to Learn More</button>
                  <div className="learn-more-all-images-actions">
                    <button type="button" className="learn-more-all-images-delete-selected-btn" style={{ pointerEvents: 'none' }}>Delete Selected (1)</button>
                    <button type="button" className="learn-more-modal-toolbar-btn save" style={{ pointerEvents: 'none' }}>Add New Image</button>
                  </div>
                    <p className="learn-more-all-images-count">Showing 1 image</p>
                  </div>
                  <div className="learn-more-all-images-list">
                    <div className="learn-more-all-image-item is-main-selected">
                      <button type="button" className="learn-more-all-image-btn" style={{ pointerEvents: 'none' }}>
                        <img className="learn-more-all-image" src="/manual-sample-image.svg" alt="Image 1" />
                      </button>
                      <label className="learn-more-gallery-selection"><span className="learn-more-gallery-checkbox"><input type="checkbox" defaultChecked readOnly aria-label="Main gallery image 1" /><span className="learn-more-gallery-order">1</span></span></label>
                      <button type="button" className="learn-more-all-image-select is-selected" style={{ pointerEvents: 'none' }}>
                        <span className="learn-more-all-image-select-mark">✓</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-009" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-010" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5. Title & Category */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-06">
              <div className="um-isolated-demo">
                <div className="learn-more-modal-title-section" style={{ margin: 0 }}>
                  <h2 style={{ margin: '0 0 6px' }}>Sample Dataset Title</h2>
                  <p className="learn-more-modal-subtitle" style={{ margin: 0 }}>Watershed</p>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-011" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-012" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 6. Info fields — view mode */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-07">
              <div className="um-isolated-demo um-fields-demo">
                <div className="learn-more-fields-grid">
                  <p><strong>Author:</strong> Jane Smith</p>
                  <p><strong>Card Creator:</strong> jsmith</p>
                  <p><strong>Email:</strong> j.smith@cereo.edu</p>
                  <p><strong>Funding:</strong> NSF Grant #12345</p>
                  <p><strong>Organization:</strong> Rivers, Watersheds, Communities (RWC)</p>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-013" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-014" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 7. Info fields — edit mode inputs */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-08">
              <div className="um-isolated-demo um-fields-demo">
                <div className="learn-more-fields-grid">
                  <div className="learn-more-field-cell">
                    <p><strong>Author:</strong></p>
                    <input className="learn-more-inline-input" type="text" defaultValue="Jane Smith" readOnly style={{ marginBottom: 0 }} />
                  </div>
                  <div className="learn-more-field-cell">
                    <p><strong>Card Creator:</strong></p>
                    <input className="learn-more-inline-input learn-more-inline-readonly" type="text" defaultValue="jsmith" readOnly disabled style={{ marginBottom: 0 }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-015" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-016" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Links — view mode */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-09">
              <div className="um-isolated-demo">
                <div className="learn-more-links-view">
                  <strong>Links:</strong>
                  <ul className="learn-more-links-list">
                    <li><a href="#um" onClick={e => e.preventDefault()}>Rivers, Watersheds, Communities (RWC) Homepage</a></li>
                    <li><a href="#um" onClick={e => e.preventDefault()}>https://doi.org/10.xxxx/sample</a></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-017" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-018" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 9. Links — edit mode rows */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-10">
              <div className="um-isolated-demo" style={{ minWidth: '280px' }}>
                <div className="learn-more-link-row">
                  <input className="learn-more-inline-input" type="text" placeholder="URL" defaultValue="https://cereo.wsu.edu" readOnly style={{ marginBottom: 0 }} />
                  <input className="learn-more-inline-input learn-more-link-text-input" type="text" placeholder="Display text (optional)" defaultValue="Rivers, Watersheds, Communities (RWC)" readOnly style={{ marginBottom: 0 }} />
                  <button type="button" className="learn-more-link-remove-btn" style={{ pointerEvents: 'none' }}>×</button>
                </div>
                <button type="button" className="learn-more-modal-toolbar-btn cancel learn-more-add-link-btn" style={{ pointerEvents: 'none' }}>+ Add More Links</button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-019" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-020" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 10. Downloadable Files */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-11">
              <div className="um-isolated-demo">
                <div className="file-list learn-more-file-list" style={{ margin: 0, paddingTop: 0, borderTop: 'none' }}>
                  <h3>Downloadable Files:</h3>
                  <ul>
                    <li><a href="#um" onClick={e => e.preventDefault()}>yakima_study_2023.pdf</a></li>
                    <li><a href="#um" onClick={e => e.preventDefault()}>dataset_shapefile.zip</a></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-021" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-022" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 11. ArcGIS Linked Layers */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-12">
              <div className="um-isolated-demo um-arcgis-demo">
                <p style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#374151' }}><strong>Linked ArcGIS Services/Layers:</strong></p>
                <ul className="learn-more-arcgis-links-list">
                  <li className="learn-more-arcgis-link-item">
                    <label className="learn-more-arcgis-layer-toggle-label">
                      <input type="checkbox" className="learn-more-arcgis-layer-toggle-cb" defaultChecked readOnly />
                    </label>
                    <span className="learn-more-arcgis-link-row">
                      <span className="learn-more-arcgis-row-text">Washington State</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text">Hydrology</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text learn-more-arcgis-row-name">Streams &amp; Rivers</span>
                    </span>
                    <button type="button" className="learn-more-arcgis-goto-btn" style={{ pointerEvents: 'none' }}>›</button>
                  </li>
                  <li className="learn-more-arcgis-link-item">
                    <label className="learn-more-arcgis-layer-toggle-label">
                      <input type="checkbox" className="learn-more-arcgis-layer-toggle-cb" readOnly />
                    </label>
                    <span className="learn-more-arcgis-link-row">
                      <span className="learn-more-arcgis-row-text">Idaho</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text">Boundaries</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text learn-more-arcgis-row-name">County Lines</span>
                    </span>
                    <button type="button" className="learn-more-arcgis-goto-btn" style={{ pointerEvents: 'none' }}>›</button>
                  </li>
                </ul>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-023" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-024" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 11b. Rich Text Description */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-13">
              <div className="um-isolated-demo um-fields-demo">
                <p style={{ margin: '0 0 6px' }}><strong>Description:</strong></p>
                <div style={{ border: '1px solid #d8e1ea', borderRadius: '6px', padding: '6px 8px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '6px' }}>
                    {['B', 'I', 'U', 'S', '• 1.', '• •', '↶', '↷', '¶', 'Link', 'File'].map((t, i) => (
                      <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: '#374957', padding: '2px 5px', borderRadius: '3px', border: '1px solid #d8e1ea', background: '#f4f6f9' }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: '13px', color: '#374957', minHeight: '40px' }}><strong>Bold</strong>, <em>italic</em>, <u>underlined</u>, and lists…</div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-025" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-026" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 11c. Tags & Visibility */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-14">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px' }}><strong>Tags:</strong></p>
                  <div className="learn-more-tags-editor">
                    <span className="learn-more-tag-chip">hydrology<button type="button" className="learn-more-tag-chip-remove" style={{ pointerEvents: 'none' }}>×</button></span>
                    <span className="learn-more-tag-chip">ecology<button type="button" className="learn-more-tag-chip-remove" style={{ pointerEvents: 'none' }}>×</button></span>
                    <input className="learn-more-tag-input" type="text" placeholder="Add another tag" readOnly />
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px' }}><strong>Visibility:</strong></p>
                  <select className="learn-more-inline-input" style={{ pointerEvents: 'none' }}>
                    <option>Public (visible to everyone)</option>
                    <option>Private (only visible to me)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-027" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-028" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 11d. Representation */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-15">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                <div className="learn-more-location-section" style={{ margin: 0 }}>
                  <p style={{ margin: '0 0 6px' }}><strong>Map location:</strong></p>
                  <div className="learn-more-representation-preview">
                    <RepresentationPreview data={{ location_type: 'polygon', polygon_vertices: [{lat: 47, lng: -120}, {lat: 46, lng: -121}, {lat: 46, lng: -119}] }} />
                    <div className="learn-more-representation-info">
                      <span className="learn-more-representation-type">Polygon</span>
                      <span className="learn-more-representation-detail">3 vertices</span>
                    </div>
                  </div>
                </div>
                <div className="learn-more-location-actions" style={{ margin: 0 }}>
                  <button type="button" className="learn-more-select-location-btn" style={{ pointerEvents: 'none' }}>Edit Polygon</button>
                  <button type="button" className="learn-more-select-location-btn" style={{ pointerEvents: 'none' }}>Change location type</button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-029" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-030" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 11e. Linked Custom Layers */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-16">
              <div className="um-isolated-demo um-arcgis-demo">
                <p style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#374151' }}><strong>Linked Custom Layers:</strong></p>
                <ul className="learn-more-arcgis-links-list">
                  <li className="learn-more-arcgis-link-item">
                    <label className="learn-more-arcgis-layer-toggle-label">
                      <input type="checkbox" className="learn-more-arcgis-layer-toggle-cb" defaultChecked readOnly />
                    </label>
                    <span className="learn-more-arcgis-link-row">
                      <span className="learn-more-arcgis-row-text">Custom</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text">My Hydrology Layers</span>
                      <span className="learn-more-arcgis-row-sep"> › </span>
                      <span className="learn-more-arcgis-row-text learn-more-arcgis-row-name">WA Streams and Rivers</span>
                    </span>
                    <button type="button" className="learn-more-arcgis-goto-btn" style={{ pointerEvents: 'none' }}>›</button>
                  </li>
                </ul>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-031" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-032" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 12. Image Preview lightbox */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="detail-view-example-17">
              <div className="um-isolated-demo um-image-preview-demo">
                <div style={{ position: 'relative', background: '#111', borderRadius: '6px', overflow: 'hidden', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/manual-sample-image.svg" alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  <span style={{ position: 'absolute', top: '6px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', lineHeight: 1 }}>×</span>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '36px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px' }}>‹</span>
                  <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '36px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px' }}>›</span>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '2px' }}>
                    <span style={{ flex: 1, height: '4px', background: '#fff' }} />
                    <span style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.35)' }} />
                    <span style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.35)' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="detail-view" blockId="detail-view-033" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="detail-view" blockId="detail-view-034" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'arcgis-panel' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-002" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-003" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-004" onNavigate={navTo} /></p>
        <p><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-005" onNavigate={navTo} /></p>
        <h3 className="info-page__subheading"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-006" onNavigate={navTo} /></h3>
        <ul><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-007" onNavigate={navTo} /></ul>
        <p><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-008" onNavigate={navTo} /></p>
        <p><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-009" onNavigate={navTo} /></p>
        <p><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-010" onNavigate={navTo} /></p>

        {/* ---- Panel shell demo ---- */}
        <div className="um-arcgis-panel-mock" data-manual-example="arcgis-panel-example-01">
          <div className="upload-panel-header">
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#223244' }}>Browse ArcGIS Services</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button className="upload-panel-header-close-btn upload-panel-header-close-btn--help" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faQuestion} />
              </button>
              <button className="upload-panel-header-close-btn upload-panel-header-close-btn--play" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faPlay} />
              </button>
              <button className="upload-panel-header-close-btn" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
          <div style={{ padding: '6px 10px 8px' }}>
            <div className="upload-panel-searchbar">
              <input type="text" placeholder="Search layers, folders, services..." readOnly />
              <button className="upload-panel-searchbar-btn search" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faSearch} />
              </button>
              <button className="upload-panel-searchbar-btn clear" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="upload-panel-opacity-slider-row">
              <label>Layer Opacity:</label>
              <input
                type="range"
                className="upload-panel-opacity-slider"
                defaultValue="70"
                min="0"
                max="100"
                readOnly
                style={{ background: 'linear-gradient(to right, #1976d2 70%, #d0d0d0 70%)' }}
              />
              <span className="upload-panel-opacity-value">70%</span>
            </div>
          </div>
          <div className="upload-panel-folder-area" style={{ maxHeight: '170px', margin: '0 10px 10px' }}>
            <div className="upload-state-folder">
              <FontAwesomeIcon icon={faFolder} style={{ marginRight: '6px', color: '#5a7fa8' }} />
              Washington State ArcGIS Services
            </div>
            <div className="upload-state-folder-content">
              <div className="upload-folder" style={{ margin: '2px 0', pointerEvents: 'none' }}>
                <span>Hydrology</span>
              </div>
              <div className="upload-folder" style={{ margin: '2px 0', pointerEvents: 'none' }}>
                <span>Boundaries</span>
              </div>
            </div>
            <div className="upload-state-folder" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faFolder} style={{ marginRight: '6px', color: '#5a7fa8' }} />
              Idaho ArcGIS Services
            </div>
            <div className="upload-state-folder" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faFolder} style={{ marginRight: '6px', color: '#5a7fa8' }} />
              Oregon ArcGIS Services
            </div>
          </div>
        </div>

        {/* ---- Feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Opening the Panel */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-02">
              <div className="um-isolated-demo">
                <button type="button" className="card-toolbar-button" title="Toggle ArcGIS Layers" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faGrip} />
                  <span>Layers</span>
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-011" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-012" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Panel Header */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-03">
              <div className="um-isolated-demo" style={{ minWidth: '260px', padding: 0 }}>
                <div className="upload-panel-header" style={{ border: '1px solid #d8e1ea', borderRadius: '6px', padding: '8px 12px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#223244' }}>Browse ArcGIS Services</h3>
                  <button className="upload-panel-header-close-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-013" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-014" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Search Bar */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-04">
              <div className="um-isolated-demo" style={{ minWidth: '280px' }}>
                <div className="upload-panel-searchbar">
                  <input type="text" defaultValue="Hydrology" readOnly />
                  <button className="upload-panel-searchbar-btn search" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                  <button className="upload-panel-searchbar-btn clear" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-015" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-016" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-017" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 4. Show Added Only */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-05">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <button type="button" className="clear-all-layers-btn clear-all-layers-btn--toggle is-active" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faEye} />
                  <span>Showing Added Only</span>
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-018" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-019" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5. Layer Opacity */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-06">
              <div className="um-isolated-demo" style={{ minWidth: '240px' }}>
                <div className="upload-panel-opacity-slider-row">
                  <label>Layer Opacity:</label>
                  <input
                    type="range"
                    className="upload-panel-opacity-slider"
                    defaultValue="70"
                    min="0"
                    max="100"
                    readOnly
                    style={{ background: 'linear-gradient(to right, #1976d2 70%, #d0d0d0 70%)' }}
                  />
                  <span className="upload-panel-opacity-value">70%</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-020" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-021" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 6. Update & Clear Controls */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-07">
              <div className="um-isolated-demo" style={{ gap: '8px' }}>
                <button className="upload-panel-update-btn" title="Update services" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faSync} />
                </button>
                <button type="button" className="clear-all-layers-btn" title="Clear All Layers" style={{ pointerEvents: 'none' }}>
                  <span>Clear</span>
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-022" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-023" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-024" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 7. Service Tree Hierarchy */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-08">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', padding: 0, gap: 0 }}>
                <div className="upload-state-folder" style={{ borderRadius: '4px 4px 0 0' }}>
                  <FontAwesomeIcon icon={faFolder} style={{ marginRight: '6px', color: '#5a7fa8' }} />
                  Washington State ArcGIS Services
                </div>
                <div className="upload-state-folder-content" style={{ paddingBottom: '4px' }}>
                  <div className="upload-folder" style={{ margin: '2px 0', pointerEvents: 'none' }}>
                    <span>
                      <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '10px', marginRight: '6px', color: '#5a7fa8' }} />
                      Hydrology
                    </span>
                  </div>
                  <div style={{ paddingLeft: '16px' }}>
                    <label className="upload-item" style={{ pointerEvents: 'none' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                        <input type="checkbox" readOnly />
                        WA Streams and Rivers
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-025" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-026" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Layer Rows & Right-Click Menu */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-09">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                {/* Service row */}
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#5c6f82', fontWeight: 600 }}>Right-click a service:</p>
                  <div className="layer-context-menu" style={{ position: 'static', boxShadow: 'none' }}>
                    <button style={{ pointerEvents: 'none' }}>Learn More</button>
                    <button style={{ pointerEvents: 'none' }}>Save to Custom Layers</button>
                    <button style={{ pointerEvents: 'none' }}>Pin (Auto-load)</button>
                  </div>
                </div>
                {/* Layer row */}
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#5c6f82', fontWeight: 600 }}>Right-click a layer:</p>
                  <div className="layer-context-menu" style={{ position: 'static', boxShadow: 'none' }}>
                    <button style={{ pointerEvents: 'none' }}>Learn More</button>
                    <button style={{ pointerEvents: 'none' }}>Pin (Auto-load)</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-027" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-028" onNavigate={navTo} /></p>
              <p className="um-feature-desc" style={{ marginTop: '8px' }}><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-029" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-030" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 9. Search Result Navigation */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-10">
              <div className="um-isolated-demo">
                <div className="panel-nav-mini" style={{ position: 'static' }}>
                  <span className="panel-nav-mini-counter">2 / 7</span>
                  <button className="panel-nav-mini-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faChevronUp} />
                  </button>
                  <button className="panel-nav-mini-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faChevronDown} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-031" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-032" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 10. Map click popup */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-11">
              <div className="um-isolated-demo" style={{ padding: 0, minWidth: '260px', alignItems: 'stretch' }}>
                <div className="arcgis-popup-wrapper" style={{ border: '1px solid #d0d7e2', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                  <div className="arcgis-popup-header">
                    <h3 style={{ margin: 0, fontSize: '0.95em' }}>WA Rivers and Streams</h3>
                  </div>
                  <div className="arcgis-popup-body" style={{ pointerEvents: 'none', fontSize: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <tbody>
                        {[['GNIS_NAME','Palouse River'],['LENGTHKM','42.3'],['FTYPE','StreamRiver'],['FCODE','46006']].map(([k,v]) => (
                          <tr key={k}>
                            <td style={{ fontWeight: 700, paddingRight: '6px', verticalAlign: 'top', whiteSpace: 'nowrap', color: '#333' }}>{k}</td>
                            <td style={{ wordBreak: 'break-word', color: '#555' }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-033" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-034" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 11. Service / Layer info modal */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="arcgis-panel-example-12">
              <div className="um-isolated-demo" style={{ padding: 0, minWidth: '260px', alignItems: 'stretch' }}>
                <div className="um-svcinfo-demo-wrapper">
                  <div className="arcgis-service-info-modal">
                    <div className="arcgis-service-info-modal-header">
                      <strong style={{ fontSize: '13px' }}>Service info</strong>
                      <button type="button" className="arcgis-service-info-modal-close" style={{ pointerEvents: 'none' }}>&times;</button>
                    </div>
                    <div className="arcgis-service-info-modal-content" style={{ pointerEvents: 'none' }}>
                      <div className="arcgis-service-info-row"><strong>Service Description:</strong>
                        <div className="arcgis-service-info-description">WA Dept of Ecology hydrography layer.</div>
                      </div>
                      <div className="arcgis-service-info-row"><strong>Service Item Id:</strong> 8f6b3e4f2a1c</div>
                      <div className="arcgis-service-info-row"><strong>Copyright Text:</strong> © WA Ecology 2024</div>
                      <div className="arcgis-service-info-row"><strong>Spatial Reference:</strong> WKID 4326</div>
                      <div className="arcgis-service-info-row"><strong>Service Opacity:</strong> 70%</div>
                      <div className="arcgis-service-info-row"><strong>Historical View:</strong> Date Range / Timeline</div>
                      <div className="arcgis-service-info-row"><strong>Layers / Sublayers:</strong> clickable layer links</div>
                      <div style={{ marginTop: '10px', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className="arcgis-service-info-save-btn"
                          style={{
                            pointerEvents: 'none',
                            padding: '6px 10px',
                            backgroundColor: '#1976d2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <FontAwesomeIcon icon={faFloppyDisk} style={{ fontSize: '12px' }} />
                          Save
                        </button>
                      </div>
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #ddd', fontSize: '12px', color: '#1976d2' }}>View ArcGIS Service Page →</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-035" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-036" onNavigate={navTo} /></p>
              <p className="um-feature-desc" style={{ marginTop: '8px' }}><ManualText sectionId="arcgis-panel" blockId="arcgis-panel-037" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'service-layer-info' && (
      <section className="um-section um-section--service-layer-info">
        <h2 className="info-page__section-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-002" onNavigate={navTo} /></p>

        <div className="um-feature-list">

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-01">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <div className="layer-context-menu" style={{ position: 'static', boxShadow: 'none' }}>
                  <button style={{ pointerEvents: 'none' }}>Learn More</button>
                </div>
                <button className="arcgis-service-row-action-btn" style={{ pointerEvents: 'none' }} title="Learn more">
                  <FontAwesomeIcon icon={faEllipsisV} />
                </button>
                <button className="arcgis-service-info-layer-link" style={{ pointerEvents: 'none' }}>
                  WA Major Rivers (Layer 2)
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-004" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-02">
              <div className="um-isolated-demo" style={{ padding: 0, minWidth: '280px', alignItems: 'stretch' }}>
                <div className="arcgis-service-info-modal" style={{ position: 'static' }}>
                  <div className="arcgis-service-info-modal-header">
                    <strong style={{ fontSize: '13px' }}>Service info</strong>
                    <button type="button" className="arcgis-service-info-modal-close" style={{ pointerEvents: 'none' }}>&times;</button>
                  </div>
                  <div className="arcgis-service-info-modal-content" style={{ pointerEvents: 'none' }}>
                    <div className="arcgis-service-info-row"><strong>Loading state:</strong> Loading service info…</div>
                    <div className="arcgis-service-info-row"><strong>Empty state:</strong> No information available.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-006" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-03">
              <div className="um-isolated-demo" style={{ padding: 0, minWidth: '280px', alignItems: 'stretch' }}>
                <div className="arcgis-service-info-modal" style={{ position: 'static' }}>
                  <div className="arcgis-service-info-modal-content" style={{ pointerEvents: 'none' }}>
                    <div className="arcgis-service-info-row"><strong>Service Description:</strong> Hydrography base service.</div>
                    <div className="arcgis-service-info-row"><strong>Service Item Id:</strong> 8f6b3e4f2a1c</div>
                    <div className="arcgis-service-info-row"><strong>Copyright Text:</strong> © WA Ecology 2024</div>
                    <div className="arcgis-service-info-row"><strong>Spatial Reference:</strong> WKID 4326</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-008" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-04">
              <div className="um-isolated-demo" style={{ minWidth: '280px' }}>
                <div className="arcgis-service-info-row service-info-opacity-row" style={{ width: '100%' }}>
                  <strong>Service Opacity:</strong>
                  <div className="service-info-opacity-controls" style={{ flex: 1 }}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value="0.7"
                      readOnly
                      className="service-info-opacity-slider"
                      style={{ background: 'linear-gradient(to right, #27425d 70%, #d8e1ea 70%)' }}
                    />
                    <span className="service-info-opacity-value">70%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-009" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-010" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-05">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '280px', gap: '8px' }}>
                <div className="service-info-time-tabs" style={{ pointerEvents: 'none' }}>
                  <button className="service-info-time-tab active">Date Range</button>
                  <button className="service-info-time-tab">Timeline</button>
                </div>
                <div className="service-info-time-row" style={{ pointerEvents: 'none' }}>
                  <label className="service-info-time-label">From</label>
                  <input type="date" className="service-info-time-input" readOnly />
                  <label className="service-info-time-label">To</label>
                  <input type="date" className="service-info-time-input" readOnly />
                </div>
                <div className="service-info-time-actions" style={{ pointerEvents: 'none' }}>
                  <button className="service-info-time-btn">Apply</button>
                  <button className="service-info-time-btn service-info-time-btn-clear">Clear</button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-011" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-012" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-06">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', minWidth: '280px', gap: '8px' }}>
                <div className="arcgis-service-info-row" style={{ width: '100%' }}>
                  <strong>Layers / Sublayers:</strong>
                  <div className="arcgis-service-info-layer-links" style={{ marginTop: '6px' }}>
                    <div className="arcgis-service-info-layer-link-row">
                      <button className="arcgis-service-info-layer-link" style={{ pointerEvents: 'none' }}>Hydrology</button>
                    </div>
                    <div className="arcgis-service-info-layer-link-row" style={{ marginLeft: 12 }}>
                      <button className="arcgis-service-info-layer-link" style={{ pointerEvents: 'none' }}>Rivers</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-013" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-014" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-07">
              <div className="um-isolated-demo" style={{ padding: 0, minWidth: '280px', alignItems: 'stretch' }}>
                <div className="arcgis-service-info-modal" style={{ position: 'static' }}>
                  <div className="arcgis-service-info-modal-header">
                    <strong style={{ fontSize: '13px' }}>Layer Info: WA Rivers</strong>
                    <button type="button" className="arcgis-service-info-modal-close" style={{ pointerEvents: 'none' }}>&times;</button>
                  </div>
                  <div className="arcgis-service-info-modal-content" style={{ pointerEvents: 'none' }}>
                    <div className="arcgis-service-info-row"><strong>Layer Name:</strong> WA Rivers</div>
                    <div className="arcgis-service-info-row"><strong>Geometry Type:</strong> esriGeometryPolyline</div>
                    <div className="arcgis-service-info-row"><strong>Min Scale:</strong> 24,000</div>
                    <div className="arcgis-service-info-row"><strong>Max Scale:</strong> 1,000,000</div>
                    <div className="arcgis-service-info-row"><strong>Default Visibility:</strong> Visible</div>
                    <div className="arcgis-service-info-row"><strong>Has Attachments:</strong> No</div>
                    <div className="arcgis-service-info-row"><strong>Fields:</strong> 18 field(s)</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-015" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-016" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-08">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#1976d2' }}>View ArcGIS Service Page →</div>
                <div style={{ fontSize: '12px', color: '#1976d2' }}>View ArcGIS Layer Page →</div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-017" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-018" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-09">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '280px', gap: '10px' }}>
                <button
                  type="button"
                  className="arcgis-service-info-save-btn"
                  style={{
                    pointerEvents: 'none',
                    padding: '6px 10px',
                    backgroundColor: '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FontAwesomeIcon icon={faFloppyDisk} style={{ fontSize: '12px' }} />
                  Save
                </button>
                <div style={{ fontSize: '12px', color: '#1976d2' }}>Saved into Custom Layers for later reuse</div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-019" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-020" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-10">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '280px', gap: '10px' }}>
                <div className="arcgis-service-info-row" style={{ width: '100%' }}>
                  <strong>Legend:</strong>
                  <div style={{ marginTop: '8px', paddingLeft: '12px' }}>
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '20px', height: '20px', background: '#78a9d4', borderRadius: '3px', display: 'inline-block' }} />
                      <span style={{ fontSize: '13px' }}>Perennial river</span>
                    </div>
                  </div>
                </div>
                <div className="arcgis-service-info-row" style={{ width: '100%' }}>
                  <strong>Parent Layer:</strong>
                  <button className="arcgis-service-info-layer-link" style={{ pointerEvents: 'none', marginLeft: '8px' }}>Hydrology</button>
                </div>
                <div className="arcgis-service-info-row" style={{ width: '100%' }}>
                  <strong>Child Layers:</strong>
                  <div style={{ marginTop: '8px', border: '1px solid #eee', borderRadius: '4px', padding: '8px 8px 2px 12px' }}>
                    <div style={{ marginBottom: '6px' }}>
                      <button className="arcgis-service-info-layer-link" style={{ pointerEvents: 'none' }}>Streams</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-021" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-022" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="service-layer-info-example-11">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '280px', gap: '8px' }}>
                <select style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }} defaultValue="OBJECTID" disabled>
                  <option value="OBJECTID">OBJECTID (esriFieldTypeOID)</option>
                </select>
                <select style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }} defaultValue="= " disabled>
                  <option value="= ">=</option>
                </select>
                <input type="text" value="42" readOnly style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" style={{ flex: 1, padding: '6px 10px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', pointerEvents: 'none' }}>Apply Filter</button>
                  <button type="button" style={{ flex: 1, padding: '6px 10px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', pointerEvents: 'none' }}>Clear</button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="service-layer-info" blockId="service-layer-info-023" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="service-layer-info" blockId="service-layer-info-024" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'custom-layers' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="custom-layers" blockId="custom-layers-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-002" onNavigate={navTo} /></p>
        <p><ManualText sectionId="custom-layers" blockId="custom-layers-003" onNavigate={navTo} /></p>
        <p className="um-section-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-004" onNavigate={navTo} /></p>

        {/* ---- Panel shell demo ---- */}
        <div className="um-arcgis-panel-mock" data-manual-example="custom-layers-example-01">
          <div className="custom-layers-panel-header" style={{ padding: '2px 12px', borderBottom: '1px solid #d8e1ea' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#223244', flex: 1 }}>Custom Layers</h3>
            <button className="custom-layers-panel-close-btn custom-layers-panel-close-btn--help" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faQuestion} />
            </button>
            <button className="custom-layers-panel-close-btn custom-layers-panel-close-btn--play" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faPlay} />
            </button>
            <button className="custom-layers-panel-close-btn" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div style={{ padding: '6px 10px 8px' }}>
            <div className="upload-panel-searchbar">
              <input type="text" placeholder="Search folders, services, or layers…" readOnly />
              <button className="upload-panel-searchbar-btn search" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faSearch} />
              </button>
              <button className="upload-panel-searchbar-btn clear" style={{ pointerEvents: 'none' }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
          <div className="upload-panel-folder-area" style={{ maxHeight: '160px', margin: '0 10px 10px' }}>
            <div className="custom-layers-folder">
              <FontAwesomeIcon icon={faFolder} style={{ color: '#5a7fa8', fontSize: '12px' }} />
              My Hydrology Layers
            </div>
            <div className="custom-layers-folder-content">
              <div className="custom-layers-item" style={{ pointerEvents: 'none' }}>
                <input type="checkbox" defaultChecked readOnly style={{ marginRight: '4px', accentColor: '#1976d2' }} />
                <span className="custom-layers-item-label">WA Streams and Rivers</span>
              </div>
              <div className="custom-layers-item" style={{ pointerEvents: 'none' }}>
                <input type="checkbox" readOnly style={{ marginRight: '4px' }} />
                <span className="custom-layers-item-label">Watershed Boundaries</span>
              </div>
            </div>
            <div className="custom-layers-folder" style={{ pointerEvents: 'none' }}>
              <FontAwesomeIcon icon={faFolder} style={{ color: '#5a7fa8', fontSize: '12px' }} />
              Boundaries
            </div>
          </div>
        </div>

        {/* ---- Feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Opening the Panel */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-02">
              <div className="um-isolated-demo">
                <button type="button" className="card-toolbar-button" title="Custom Layers" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faFolderPlus} />
                  <span>Custom Layers</span>
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-006" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Panel Header */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-03">
              <div className="um-isolated-demo" style={{ padding: 0, minWidth: '260px' }}>
                <div className="custom-layers-panel-header" style={{ border: '1px solid #d8e1ea', borderRadius: '6px', padding: '8px 12px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#223244', flex: 1 }}>Custom Layers</h3>
                  <button className="custom-layers-panel-close-btn custom-layers-panel-close-btn--help" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faQuestion} />
                  </button>
                  <button className="custom-layers-panel-close-btn custom-layers-panel-close-btn--play" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faPlay} />
                  </button>
                  <button className="custom-layers-panel-close-btn" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-008" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="custom-layers" blockId="custom-layers-009" onNavigate={navTo} /></span>
            </div>
          </div>

          {/* 3. Search Bar */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-04">
              <div className="um-isolated-demo" style={{ minWidth: '280px' }}>
                <div className="upload-panel-searchbar">
                  <input type="text" defaultValue="streams" readOnly />
                  <button className="upload-panel-searchbar-btn search" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                  <button className="upload-panel-searchbar-btn clear" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-010" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-011" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Layer Opacity */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-05">
              <div className="um-isolated-demo" style={{ minWidth: '240px' }}>
                <div className="upload-panel-opacity-slider-row">
                  <label>Layer Opacity:</label>
                  <input
                    type="range"
                    className="upload-panel-opacity-slider"
                    defaultValue="70"
                    min="0"
                    max="100"
                    readOnly
                    style={{ background: 'linear-gradient(to right, #1976d2 70%, #d0d0d0 70%)' }}
                  />
                  <span className="upload-panel-opacity-value">70%</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-012" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-013" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5. Show Added / Clear All */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-06">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <button type="button" className="clear-all-layers-btn custom-layers-panel-new-folder-btn" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faFolderPlus} />
                  <span>Folder</span>
                </button>
                <button type="button" className="clear-all-layers-btn custom-layers-panel-upload-btn" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faUpload} />
                  <span>Upload</span>
                </button>
                <button type="button" className="clear-all-layers-btn clear-all-layers-btn--toggle is-active" style={{ pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faEye} />
                  <span>Showing Added Only</span>
                </button>
                <button type="button" className="clear-all-layers-btn" style={{ pointerEvents: 'none' }}>
                  <span>Clear</span>
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-014" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-015" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 6. Folder Structure */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-07">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', padding: 0, gap: 0 }}>
                <div className="custom-layers-folder" style={{ borderRadius: '4px 4px 0 0' }}>
                  <FontAwesomeIcon icon={faFolder} style={{ color: '#5a7fa8', fontSize: '12px' }} />
                  My Hydrology Layers
                </div>
                <div className="custom-layers-folder-content" style={{ paddingBottom: '4px' }}>
                  <div className="custom-layers-item" style={{ pointerEvents: 'none' }}>
                    <input type="checkbox" defaultChecked readOnly style={{ marginRight: '4px', accentColor: '#1976d2' }} />
                    <span className="custom-layers-item-label">WA Streams and Rivers</span>
                  </div>
                </div>
                <div className="custom-layers-folder" style={{ borderRadius: '0 0 4px 4px', borderBottom: '1px solid #d8e1ea', pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={faFolder} style={{ color: '#5a7fa8', fontSize: '12px' }} />
                  Boundaries
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-016" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-017" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 7. Drag-and-Drop Reordering */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-08">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', padding: 0, gap: '3px' }}>
                <div className="custom-layers-item" style={{ background: '#e3eef9', borderRadius: '4px', cursor: 'grab' }}>
                  <span style={{ fontSize: '11px', color: '#5c6f82', marginRight: '6px' }}>⠿</span>
                  <input type="checkbox" defaultChecked readOnly style={{ marginRight: '4px', accentColor: '#1976d2' }} />
                  <span className="custom-layers-item-label" style={{ fontSize: '12px' }}>WA Streams and Rivers</span>
                </div>
                <div className="custom-layers-item" style={{ borderRadius: '4px', cursor: 'grab' }}>
                  <span style={{ fontSize: '11px', color: '#5c6f82', marginRight: '6px' }}>⠿</span>
                  <input type="checkbox" readOnly style={{ marginRight: '4px' }} />
                  <span className="custom-layers-item-label" style={{ fontSize: '12px' }}>Watershed Boundaries</span>
                </div>
                <div className="custom-layers-item" style={{ borderRadius: '4px', cursor: 'grab', opacity: 0.5, border: '2px dashed #bfd0e2' }}>
                  <span style={{ fontSize: '11px', color: '#5c6f82', marginRight: '6px' }}>⠿</span>
                  <input type="checkbox" readOnly style={{ marginRight: '4px' }} />
                  <span className="custom-layers-item-label" style={{ fontSize: '12px' }}>County Lines</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-018" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-019" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Right-Click Menu */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-09">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#5c6f82', fontWeight: 600 }}>Right-click a service:</p>
                  <div className="layer-context-menu" style={{ position: 'static', boxShadow: 'none' }}>
                    <button style={{ pointerEvents: 'none' }}>Rename</button>
                    <button style={{ pointerEvents: 'none' }}>Learn More</button>
                    <button style={{ pointerEvents: 'none' }}>Remove from Custom Layers</button>
                    <button style={{ pointerEvents: 'none' }}>Pin (Auto-load)</button>
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#5c6f82', fontWeight: 600 }}>Right-click a folder:</p>
                  <div className="layer-context-menu" style={{ position: 'static', boxShadow: 'none' }}>
                    <button style={{ pointerEvents: 'none' }}>Rename</button>
                    <button style={{ pointerEvents: 'none' }}>Delete Folder</button>
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#5c6f82', fontWeight: 600 }}>Right-click a layer:</p>
                  <div className="layer-context-menu" style={{ position: 'static', boxShadow: 'none' }}>
                    <button style={{ pointerEvents: 'none' }}>Learn More</button>
                    <button style={{ pointerEvents: 'none' }}>Pin (Auto-load)</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-020" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-021" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 9. Adding Layers from Upload Panel */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="custom-layers-example-10">
              <div className="um-isolated-demo">
                <div className="layer-context-menu" style={{ position: 'static', boxShadow: 'none' }}>
                  <button style={{ pointerEvents: 'none' }}>Rename</button>
                  <button style={{ pointerEvents: 'none' }}>Learn More</button>
                  <button style={{ pointerEvents: 'none', fontWeight: 700, color: '#1a6b2a !important' }}>Save to Custom Layers</button>
                  <button style={{ pointerEvents: 'none' }}>Pin (Auto-load)</button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="custom-layers" blockId="custom-layers-022" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="custom-layers" blockId="custom-layers-023" onNavigate={navTo} /></p>
              <span className="um-feature-note"><ManualText sectionId="custom-layers" blockId="custom-layers-024" onNavigate={navTo} /></span>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'watershed-panel' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="watershed-panel" blockId="watershed-panel-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="watershed-panel" blockId="watershed-panel-002" onNavigate={navTo} /></p>

        <h3 className="info-page__subheading"><ManualText sectionId="watershed-panel" blockId="watershed-panel-003" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="watershed-panel" blockId="watershed-panel-004" onNavigate={navTo} /></p>
        <ul><ManualText sectionId="watershed-panel" blockId="watershed-panel-005" onNavigate={navTo} /></ul>

        <h3 className="info-page__subheading"><ManualText sectionId="watershed-panel" blockId="watershed-panel-006" onNavigate={navTo} /></h3>
        <ol><ManualText sectionId="watershed-panel" blockId="watershed-panel-007" onNavigate={navTo} /></ol>
        <p><ManualText sectionId="watershed-panel" blockId="watershed-panel-008" onNavigate={navTo} /></p>

        <h3 className="info-page__subheading"><ManualText sectionId="watershed-panel" blockId="watershed-panel-009" onNavigate={navTo} /></h3>
        <ol><ManualText sectionId="watershed-panel" blockId="watershed-panel-010" onNavigate={navTo} /></ol>
        <p><ManualText sectionId="watershed-panel" blockId="watershed-panel-011" onNavigate={navTo} /></p>
        <button type="button" className="um-nav-item" onClick={() => navTo('custom-layers')}>Read about Custom Layers</button>

        <h3 className="info-page__subheading"><ManualText sectionId="watershed-panel" blockId="watershed-panel-012" onNavigate={navTo} /></h3>
        <ol><ManualText sectionId="watershed-panel" blockId="watershed-panel-013" onNavigate={navTo} /></ol>
        <p><ManualText sectionId="watershed-panel" blockId="watershed-panel-014" onNavigate={navTo} /></p>
        <button type="button" className="um-nav-item" onClick={() => navTo('add-card')}>Read about the Card Creation Form</button>

        <h3 className="info-page__subheading"><ManualText sectionId="watershed-panel" blockId="watershed-panel-015" onNavigate={navTo} /></h3>
        <p><ManualText sectionId="watershed-panel" blockId="watershed-panel-016" onNavigate={navTo} /></p>
        <p><ManualText sectionId="watershed-panel" blockId="watershed-panel-017" onNavigate={navTo} /></p>
      </section>
      )}

      {activeSection === 'basemap-panel' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="basemap-panel" blockId="basemap-panel-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="basemap-panel" blockId="basemap-panel-002" onNavigate={navTo} /></p>
        <p><ManualText sectionId="basemap-panel" blockId="basemap-panel-003" onNavigate={navTo} /></p>

        {/* ---- Overview demo ---- */}
        <div className="um-basemap-demo-wrapper" data-manual-example="basemap-panel-example-01">
          <div className="basemap-switcher-header">
            <span className="basemap-switcher-title">Map Style</span>
            <button className="basemap-switcher-close" style={{ pointerEvents: 'none' }}>✕</button>
          </div>
          <div className="basemap-switcher-list" style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {[
              { id: 'streets-v12',         label: 'Streets',         bg: '#c8d8e8', active: true },
              { id: 'outdoors-v12',        label: 'Outdoors',        bg: '#c3d9be' },
              { id: 'satellite-v9',        label: 'Satellite (Imagery)',        bg: '#3a4a3a' },
              { id: 'satellite-streets-v12', label: 'Satellite + Streets', bg: '#4a5a4a' },
              { id: 'navigation-day-v1',   label: 'Navigation Day',   bg: '#dce8f2' },
              { id: 'navigation-night-v1', label: 'Navigation Night', bg: '#1e2433' },
              { id: 'light-v11',           label: 'Light',           bg: '#eef2f6' },
              { id: 'dark-v11',            label: 'Dark',            bg: '#141a24' },
              { id: 'openstreetmap', label: 'OpenStreetMap', bg: '#e3ebde' },
              { id: 'usgs-topo', label: 'USGS Topographic', bg: '#eadfc7' },
              { id: 'usgs-imagery', label: 'USGS Aerial Imagery', bg: '#5b6850' },
              { id: 'usgs-relief', label: 'USGS Shaded Relief', bg: '#d9d6cc' },
            ].map(bm => (
              <div
                key={bm.id}
                className={`basemap-switcher-item${bm.active ? ' basemap-switcher-item--active' : ''}`}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="basemap-switcher-thumb"
                  style={{ background: bm.bg }}
                />
                <span className="basemap-switcher-label">{bm.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Opening */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="basemap-panel-example-02">
              <div className="um-isolated-demo">
                <button
                  type="button"
                  style={{
                    pointerEvents: 'none', background: '#fff', border: '1px solid #ccc',
                    borderRadius: '6px', padding: '8px 14px', fontSize: '14px',
                    color: '#1976d2', display: 'flex', alignItems: 'center', gap: '8px',
                    cursor: 'default',
                  }}
                >
                  <FontAwesomeIcon icon={faMap} />
                  <span>Change Basemap</span>
                </button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="basemap-panel" blockId="basemap-panel-004" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="basemap-panel" blockId="basemap-panel-005" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Available styles */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="basemap-panel-example-03">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, minWidth: '240px' }}>
                {[
                  { label: 'Streets',  bg: '#c8d8e8' },
                  { label: 'Outdoors', bg: '#c3d9be' },
                  { label: 'Satellite (Imagery)', bg: '#3a4a3a' },
                ].map(bm => (
                  <div key={bm.label} className="basemap-switcher-item" style={{ pointerEvents: 'none' }}>
                    <div style={{ width: '72px', height: '48px', borderRadius: '4px', border: '1px solid #ddd', background: bm.bg, flexShrink: 0 }} />
                    <span className="basemap-switcher-label">{bm.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="basemap-panel" blockId="basemap-panel-006" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="basemap-panel" blockId="basemap-panel-007" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Search map styles */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="basemap-panel-example-04">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '260px', gap: '8px' }}>
                <div className="upload-panel-searchbar" style={{ pointerEvents: 'none' }}>
                  <input type="text" readOnly defaultValue="satellite" />
                  <button type="button" className="upload-panel-searchbar-btn search" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                  <button type="button" className="upload-panel-searchbar-btn clear" style={{ pointerEvents: 'none' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="basemap-panel" blockId="basemap-panel-008" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="basemap-panel" blockId="basemap-panel-009" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Active selection */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="basemap-panel-example-05">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, minWidth: '240px' }}>
                <div className="basemap-switcher-item" style={{ pointerEvents: 'none', opacity: 0.55 }}>
                  <div style={{ width: '72px', height: '48px', borderRadius: '4px', border: '1px solid #ddd', background: '#c8d8e8', flexShrink: 0 }} />
                  <span className="basemap-switcher-label">streets-v12</span>
                </div>
                <div className="basemap-switcher-item basemap-switcher-item--active" style={{ pointerEvents: 'none' }}>
                  <div style={{ width: '72px', height: '48px', borderRadius: '4px', border: '1px solid #ddd', background: '#c3d9be', flexShrink: 0 }} />
                  <span className="basemap-switcher-label">outdoors-v12</span>
                </div>
                <div className="basemap-switcher-item" style={{ pointerEvents: 'none', opacity: 0.55 }}>
                  <div style={{ width: '72px', height: '48px', borderRadius: '4px', border: '1px solid #ddd', background: '#3a4a3a', flexShrink: 0 }} />
                  <span className="basemap-switcher-label">satellite-v9</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="basemap-panel" blockId="basemap-panel-010" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="basemap-panel" blockId="basemap-panel-011" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Layer & state preservation */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="basemap-panel-example-06">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', gap: '8px', minWidth: '190px' }}>
                {[
                  'ArcGIS layers preserved',
                  'Zoom & position kept',
                  'Bearing & pitch restored',
                ].map(txt => (
                  <div key={txt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#2a6b2a' }}>
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>✓</span>
                    {txt}
                  </div>
                ))}
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="basemap-panel" blockId="basemap-panel-012" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="basemap-panel" blockId="basemap-panel-013" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'map-controls' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="map-controls" blockId="map-controls-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="map-controls" blockId="map-controls-002" onNavigate={navTo} /></p>

        {/* ---- overview layout ---- */}
        <div className="um-mapctrl-overview">
          <div className="um-mapctrl-corner um-mapctrl-tl">
            <div className="um-mapctrl-label">Top-left</div>
            <div className="um-mapctrl-group">
              <button className="um-mapctrl-btn" title="Enter Fullscreen"><FontAwesomeIcon icon={faExpand} /></button>
            </div>
            <div className="um-mapctrl-group">
              <button className="um-mapctrl-btn" title="Zoom In"><strong>+</strong></button>
              <button className="um-mapctrl-btn um-mapctrl-btn--sep" title="Zoom Out"><strong>−</strong></button>
              <button className="um-mapctrl-btn um-mapctrl-btn--sep" title="Reset Bearing / Compass">
                <FontAwesomeIcon icon={faRotate} style={{ fontSize: '13px' }} />
              </button>
            </div>
            <div className="um-mapctrl-group">
              <button className="um-mapctrl-btn" title="Geolocate"><FontAwesomeIcon icon={faLocationCrosshairs} /></button>
            </div>
            <div className="um-mapctrl-zaxis" aria-hidden="true">
              <div className="um-mapctrl-zaxis__scale">
                <div className="um-mapctrl-zaxis__spine" />
                <div className="um-mapctrl-zaxis__pointer" />
              </div>
              <div className="um-mapctrl-zaxis__value">5.5</div>
            </div>
          </div>

          <div className="um-mapctrl-corner um-mapctrl-tr">
            <div className="um-mapctrl-label">Top-right</div>
            <div className="um-mapctrl-geocoder-mock">
              <FontAwesomeIcon icon={faSearch} style={{ color: '#aaa', marginRight: 6 }} />
              <span style={{ color: '#aaa', fontSize: '12px' }}>Address or LAT, LONG</span>
            </div>
            <div className="um-mapctrl-group">
              <button className="um-mapctrl-btn" title="Add cards from map"><FontAwesomeIcon icon={faPenToSquare} /></button>
              <button className="um-mapctrl-btn um-mapctrl-btn--sep" title="Toggle Markers"><FontAwesomeIcon icon={faEye} /></button>
              <button className="um-mapctrl-btn um-mapctrl-btn--sep" title="Reset View">
                <FontAwesomeIcon icon={faArrowsToCircle} />
              </button>
              <button className="um-mapctrl-btn um-mapctrl-btn--sep" title="Screenshot"><FontAwesomeIcon icon={faCamera} /></button>
            </div>
          </div>
        </div>

        {/* ---- feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Geocoder search */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-01">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-geocoder-mock" style={{ minWidth: '220px' }}>
                  <FontAwesomeIcon icon={faSearch} style={{ color: '#aaa', marginRight: 6 }} />
                  <span style={{ color: '#aaa', fontSize: '12px' }}>Address or LAT, LONG</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-004" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Fullscreen */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-02">
              <div className="um-isolated-demo" style={{ gap: '6px' }}>
                <div className="um-mapctrl-group">
                  <button className="um-mapctrl-btn" style={{ pointerEvents: 'none' }} title="Enter Fullscreen">
                    <FontAwesomeIcon icon={faExpand} />
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: '#888' }}>→</span>
                <div className="um-mapctrl-group">
                  <button className="um-mapctrl-btn" style={{ pointerEvents: 'none' }} title="Exit Fullscreen">
                    <FontAwesomeIcon icon={faCompress} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-006" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Zoom & compass */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-03">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Zoom In"><strong>+</strong></button>
                  <button className="um-mapctrl-btn um-mapctrl-btn--sep" title="Zoom Out"><strong>−</strong></button>
                  <button className="um-mapctrl-btn um-mapctrl-btn--sep" title="Reset Bearing">
                    <FontAwesomeIcon icon={faRotate} style={{ fontSize: '13px' }} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-008" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Geolocate */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-04">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Geolocate">
                    <FontAwesomeIcon icon={faLocationCrosshairs} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-009" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-010" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5. Add cards from map */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-05">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Add cards from map">
                    <FontAwesomeIcon icon={faPenToSquare} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-011" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-012" onNavigate={navTo} /></p>
              <p className="um-feature-desc" style={{ marginTop: '8px' }}><ManualText sectionId="map-controls" blockId="map-controls-013" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5b. Z-axis */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-06">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-zaxis" aria-hidden="true">
                  <div className="um-mapctrl-zaxis__scale">
                    <div className="um-mapctrl-zaxis__spine" />
                    <div className="um-mapctrl-zaxis__pointer" />
                  </div>
                  <div className="um-mapctrl-zaxis__value">8.0</div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-014" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-015" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 6. Toggle markers */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-07">
              <div className="um-isolated-demo" style={{ gap: '10px' }}>
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Markers visible (active)">
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: '#888' }}>↔</span>
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none', opacity: 0.45 }}>
                  <button className="um-mapctrl-btn" title="Markers hidden">
                    <FontAwesomeIcon icon={faEyeSlash} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-016" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-017" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 7. Reset view */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-08">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Reset Map View">
                    <FontAwesomeIcon icon={faArrowsToCircle} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-018" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-019" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Screenshot */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="map-controls-example-09">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Screenshot Map">
                    <FontAwesomeIcon icon={faCamera} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="map-controls" blockId="map-controls-020" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="map-controls" blockId="map-controls-021" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

      {activeSection === 'add-single-point' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="add-single-point" blockId="add-single-point-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="add-single-point" blockId="add-single-point-002" onNavigate={navTo} /></p>

        <div className="um-feature-list">
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-single-point-example-01">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Add cards from map"><FontAwesomeIcon icon={faPenToSquare} /></button>
                </div>
                <span style={{ fontSize: '11px', color: '#888' }}>→</span>
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Add single point card"><FontAwesomeIcon icon={faLocationDot} /></button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-single-point" blockId="add-single-point-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-single-point" blockId="add-single-point-004" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-single-point-example-02">
              <div className="um-isolated-demo" style={{ gap: '8px' }}>
                <input className="polygon-draw-vertex-input" aria-label="Example latitude" readOnly value="47.612300" />
                <input className="polygon-draw-vertex-input" aria-label="Example longitude" readOnly value="-122.335500" />
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-single-point" blockId="add-single-point-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-single-point" blockId="add-single-point-006" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-single-point-example-03">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#3f536a' }}>Result after Save:</span>
                <span style={{ fontSize: '12px', color: '#1f7a45', fontWeight: 600 }}>Point locations are transferred to the creation form</span>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-single-point" blockId="add-single-point-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-single-point" blockId="add-single-point-008" onNavigate={navTo} /></p>
            </div>
          </div>
        </div>
      </section>
      )}

      {activeSection === 'add-png' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="add-png" blockId="add-png-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="add-png" blockId="add-png-002" onNavigate={navTo} /></p>

        <div className="um-feature-list">
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-png-example-01">
              <div className="um-isolated-demo">
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Add cards from map"><FontAwesomeIcon icon={faPenToSquare} /></button>
                </div>
                <span style={{ fontSize: '11px', color: '#888' }}>→</span>
                <div className="um-mapctrl-group" style={{ pointerEvents: 'none' }}>
                  <button className="um-mapctrl-btn" title="Add image to map"><FontAwesomeIcon icon={faImage} /></button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-png" blockId="add-png-003" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-png" blockId="add-png-004" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-png-example-02">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'stretch', minWidth: '250px', gap: '8px', pointerEvents: 'none' }}>
                <div className="polygon-draw-modal" style={{ position: 'static', top: 'auto', right: 'auto', width: '100%', maxHeight: 'none' }}>
                  <div className="polygon-draw-modal-header">
                    <h3>Place Image</h3>
                    <span className="polygon-draw-modal-hint">Click and drag on the map to place the image</span>
                  </div>

                  <div className="polygon-draw-style-toolbar">
                    <div className="polygon-draw-style-btn-wrap">
                      <button type="button" className="polygon-draw-style-btn polygon-draw-drag-active" title="Move">
                        <FontAwesomeIcon icon={faHand} style={{ fontSize: 14 }} />
                      </button>
                    </div>
                    <div className="polygon-draw-style-btn-wrap">
                      <button type="button" className="polygon-draw-style-btn" title="Rotate">
                        <FontAwesomeIcon icon={faRotate} style={{ fontSize: 14 }} />
                      </button>
                    </div>
                    <div className="polygon-draw-style-btn-wrap">
                      <button type="button" className="polygon-draw-style-btn" title="Resize">
                        <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} style={{ fontSize: 13 }} />
                      </button>
                    </div>
                    <div className="polygon-draw-style-btn-wrap">
                      <button type="button" className="polygon-draw-style-btn" title="Undo (Ctrl+Z)">
                        <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 13 }} />
                      </button>
                    </div>
                    <div className="polygon-draw-style-btn-wrap">
                      <button type="button" className="polygon-draw-style-btn" title="Redo (Ctrl+Y)">
                        <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 13 }} />
                      </button>
                    </div>
                    <div className="polygon-draw-style-btn-wrap">
                      <button type="button" className="polygon-draw-style-btn polygon-draw-clear-btn" title="Clear All">
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  </div>

                  <div className="polygon-draw-modal-vertices">
                    <div className="polygon-draw-modal-vertex-row">
                      <span className="polygon-draw-modal-vertex-num">1</span>
                      <div className="polygon-draw-modal-vertex-coords">47.620100, -122.349300</div>
                    </div>
                    <div className="polygon-draw-modal-vertex-row">
                      <span className="polygon-draw-modal-vertex-num">2</span>
                      <div className="polygon-draw-modal-vertex-coords">47.620100, -122.342000</div>
                    </div>
                    <div className="polygon-draw-modal-vertex-row">
                      <span className="polygon-draw-modal-vertex-num">3</span>
                      <div className="polygon-draw-modal-vertex-coords">47.615900, -122.342000</div>
                    </div>
                    <div className="polygon-draw-modal-vertex-row">
                      <span className="polygon-draw-modal-vertex-num">4</span>
                      <div className="polygon-draw-modal-vertex-coords">47.615900, -122.349300</div>
                    </div>
                  </div>

                  <div className="polygon-draw-modal-actions">
                    <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-save">Save</button>
                    <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-cancel">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-png" blockId="add-png-005" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-png" blockId="add-png-006" onNavigate={navTo} /></p>
              <p className="um-feature-desc" style={{ marginTop: '8px' }}><ManualText sectionId="add-png" blockId="add-png-007" onNavigate={navTo} /></p>
              <p className="um-feature-desc" style={{ marginTop: '8px' }}><ManualText sectionId="add-png" blockId="add-png-008" onNavigate={navTo} /></p>
            </div>
          </div>

          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="add-png-example-03">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#3f536a' }}>Saved data:</span>
                <span style={{ fontSize: '12px', color: '#1f7a45', fontWeight: 600 }}>4 corner vertices + overlay image</span>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="add-png" blockId="add-png-009" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="add-png" blockId="add-png-010" onNavigate={navTo} /></p>
            </div>
          </div>
        </div>
      </section>
      )}

      {activeSection === 'polygon-tools' && (
      <section className="um-section">
        <h2 className="info-page__section-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-001" onNavigate={navTo} /></h2>
        <p className="um-section-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-002" onNavigate={navTo} /></p>
        <p className="um-section-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-003" onNavigate={navTo} /></p>

        {/* ---- Overview demo ---- */}
        <div className="um-polydraw-demo-wrapper" data-manual-example="polygon-tools-example-01">
          {/* Header */}
          <div className="polygon-draw-modal-header">
            <h3>Draw Polygon</h3>
            <span className="polygon-draw-modal-hint">Click on the map to add points</span>
          </div>

          {/* Style toolbar */}
          <div className="polygon-draw-style-toolbar" style={{ pointerEvents: 'none' }}>
            {/* Line style */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Line Style">
                <svg width="18" height="10" viewBox="0 0 18 10"><line x1="0" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth="2"/></svg>
              </button>
            </div>
            {/* Curve mode */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Curve Mode">
                <svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1,10 C5,1.5 13,1.5 17,10"/></svg>
              </button>
            </div>
            {/* Fill color */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Fill Color">
                <FontAwesomeIcon icon={faPalette} style={{ fontSize: 14, width: 16, height: 16 }} />
              </button>
            </div>
            {/* Opacity */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Fill Opacity">
                <span className="polygon-draw-opacity-swatch" style={{ opacity: 0.65 }} />
              </button>
            </div>
            {/* Shapes */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Shape Presets">
                <FontAwesomeIcon icon={faShapes} style={{ fontSize: 14, width: 16, height: 16 }} />
              </button>
            </div>
            {/* Move */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Move Polygon">
                <FontAwesomeIcon icon={faHand} style={{ fontSize: 16, width: 16, height: 16 }} />
              </button>
            </div>
            {/* Rotate */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Rotate Polygon">
                <FontAwesomeIcon icon={faRotate} style={{ fontSize: 16, width: 16, height: 16 }} />
              </button>
            </div>
            {/* Resize */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Resize Polygon">
                <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} style={{ fontSize: 14, width: 16, height: 16 }} />
              </button>
            </div>
            {/* Undo */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Undo">
                <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 14, width: 16, height: 16 }} />
              </button>
            </div>
            {/* Redo */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn" title="Redo">
                <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 14, width: 16, height: 16 }} />
              </button>
            </div>
            {/* Clear */}
            <div className="polygon-draw-style-btn-wrap">
              <button type="button" className="polygon-draw-style-btn polygon-draw-clear-btn" title="Clear All">
                <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13, width: 15, height: 15 }} />
              </button>
            </div>
          </div>

          {/* Vertex list */}
          <div className="polygon-draw-modal-vertices" style={{ pointerEvents: 'none' }}>
            {[{ lat: '47.6062', lng: '-122.3321' }, { lat: '47.5112', lng: '-122.2572' }, { lat: '47.4829', lng: '-122.4194' }].map((v, i) => (
              <div key={i} className="polygon-draw-modal-vertex-row">
                <span className="polygon-draw-modal-vertex-num">{i + 1}</span>
                <div className="polygon-draw-modal-vertex-coords polygon-draw-modal-vertex-inputs">
                  <input type="text" className="polygon-draw-vertex-input" readOnly defaultValue={v.lat} title="Latitude" />
                  <span className="polygon-draw-vertex-comma">,</span>
                  <input type="text" className="polygon-draw-vertex-input" readOnly defaultValue={v.lng} title="Longitude" />
                </div>
                <button type="button" className="polygon-draw-modal-vertex-remove" style={{ pointerEvents: 'none' }}>×</button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="polygon-draw-modal-actions" style={{ pointerEvents: 'none' }}>
            <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-finish">Finish Drawing</button>
            <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-save">Save</button>
            <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-cancel">Cancel</button>
          </div>
        </div>

        {/* ---- Feature rows ---- */}
        <div className="um-feature-list">

          {/* 1. Freehand drawing */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-02">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#444' }}>
                  <FontAwesomeIcon icon={faDrawPolygon} style={{ color: '#1d4ed8', fontSize: '16px' }} />
                  <span>Click map → add vertex</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#444' }}>
                  <span style={{ width: 16, textAlign: 'center', fontWeight: 700, color: '#27ae60' }}>3+</span>
                  <span>Points → "Finish Drawing"</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-004" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-005" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 2. Shape presets */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-03">
              <div className="um-isolated-demo" style={{ flexDirection: 'column', gap: 0, padding: 0, minWidth: '140px' }}>
                <div className="polygon-draw-style-toolbar" style={{ pointerEvents: 'none', borderBottom: 'none', padding: '5px 6px' }}>
                  <div className="polygon-draw-style-btn-wrap">
                    <button type="button" className="polygon-draw-style-btn polygon-draw-shape-active" title="Shape Presets">
                      <FontAwesomeIcon icon={faShapes} style={{ fontSize: 14 }} />
                    </button>
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: '4px', boxShadow: '0 0 0 2px rgba(0,0,0,.1)', padding: '4px', width: '110px', marginLeft: '6px' }}>
                  {[
                    { label: 'Triangle', svg: <svg width="20" height="18" viewBox="0 0 20 18" fill="none" stroke="currentColor" strokeWidth="1.4"><polygon points="10,1 1,17 19,17"/></svg> },
                    { label: 'Square',   svg: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="16" height="16"/></svg> },
                    { label: 'Circle',   svg: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="9" cy="9" r="8"/></svg> },
                  ].map(s => (
                    <div key={s.label} className="polygon-draw-dropdown-item" style={{ pointerEvents: 'none', fontSize: '11px' }}>
                      {s.svg}<span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-006" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-007" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 3. Styling */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-04">
              <div className="um-isolated-demo" style={{ pointerEvents: 'none', gap: '6px', flexWrap: 'wrap', maxWidth: '220px' }}>
                {/* line style swatches */}
                {['solid','dashed','dotted'].map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}>
                    <svg width="32" height="8" viewBox="0 0 32 8">
                      {s === 'solid'  && <line x1="0" y1="4" x2="32" y2="4" stroke="#333" strokeWidth="2"/>}
                      {s === 'dashed' && <line x1="0" y1="4" x2="32" y2="4" stroke="#333" strokeWidth="2" strokeDasharray="6 3"/>}
                      {s === 'dotted' && <line x1="0" y1="4" x2="32" y2="4" stroke="#333" strokeWidth="2" strokeDasharray="1.5 3" strokeLinecap="round"/>}
                    </svg>
                    <span style={{ fontSize: '11px', color: '#555' }}>{s}</span>
                  </div>
                ))}
                {/* color swatches */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {['#0077c0','#e74c3c','#27ae60','#f39c12','#8e44ad','#1abc9c'].map(c => (
                    <div key={c} style={{ width: 18, height: 18, borderRadius: 3, background: c, border: '2px solid transparent' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-008" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-009" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 4. Curve mode */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-05">
              <div className="um-isolated-demo" style={{ pointerEvents: 'none', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <svg width="50" height="36" viewBox="0 0 50 36" fill="none" stroke="#0077c0" strokeWidth="2">
                    <polyline points="5,30 25,5 45,30 5,30"/>
                  </svg>
                  <span style={{ fontSize: '10px', color: '#888' }}>Straight</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <svg width="50" height="36" viewBox="0 0 50 36" fill="none" stroke="#0077c0" strokeWidth="2">
                    <path d="M5,30 C15,5 35,5 45,30 C35,38 15,38 5,30"/>
                  </svg>
                  <span style={{ fontSize: '10px', color: '#888' }}>Curved</span>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-010" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-011" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 5. Transform: move / rotate / resize */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-06">
              <div className="um-isolated-demo" style={{ pointerEvents: 'none', gap: '10px' }}>
                {[
                  { icon: faHand,                         label: 'Move',   active: true },
                  { icon: faRotate,                        label: 'Rotate', active: false },
                  { icon: faUpRightAndDownLeftFromCenter,   label: 'Resize', active: false },
                ].map(({ icon: ic, label, active }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <div className="polygon-draw-style-btn-wrap">
                      <button type="button" className={`polygon-draw-style-btn${active ? ' polygon-draw-drag-active' : ''}`} title={label}>
                        <FontAwesomeIcon icon={ic} style={{ fontSize: 15 }} />
                      </button>
                    </div>
                    <span style={{ fontSize: '10px', color: '#666' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-012" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-013" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 6. Undo / Redo */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-07">
              <div className="um-isolated-demo" style={{ pointerEvents: 'none', gap: '10px' }}>
                <div className="polygon-draw-style-btn-wrap">
                  <button type="button" className="polygon-draw-style-btn" title="Undo (Ctrl+Z)">
                    <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 14 }} />
                  </button>
                </div>
                <div className="polygon-draw-style-btn-wrap">
                  <button type="button" className="polygon-draw-style-btn" title="Redo (Ctrl+Y)">
                    <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-014" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-015" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 7. Vertex list */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-08">
              <div className="um-isolated-demo" style={{ pointerEvents: 'none', padding: 0, minWidth: '210px' }}>
                <div className="polygon-draw-modal-vertices" style={{ maxHeight: 'unset' }}>
                  {[{ lat: '47.6062', lng: '-122.332' }, { lat: '47.5112', lng: '-122.257' }].map((v, i) => (
                    <div key={i} className="polygon-draw-modal-vertex-row">
                      <span className="polygon-draw-modal-vertex-num">{i + 1}</span>
                      <div className="polygon-draw-modal-vertex-coords polygon-draw-modal-vertex-inputs">
                        <input type="text" className="polygon-draw-vertex-input" readOnly defaultValue={v.lat} />
                        <span className="polygon-draw-vertex-comma">,</span>
                        <input type="text" className="polygon-draw-vertex-input" readOnly defaultValue={v.lng} />
                      </div>
                      <button type="button" className="polygon-draw-modal-vertex-remove">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-016" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-017" onNavigate={navTo} /></p>
            </div>
          </div>

          {/* 8. Save / Cancel / Clear */}
          <div className="um-feature-row">
            <div className="um-feature-demo" data-manual-example="polygon-tools-example-09">
              <div className="um-isolated-demo" style={{ pointerEvents: 'none', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
                <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-finish" style={{ flex: '1 1 90px' }}>Finish Drawing</button>
                <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-resume" style={{ flex: '1 1 90px' }}>Add More Points</button>
                <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-save" style={{ flex: '1 1 60px' }}>Save</button>
                <button type="button" className="polygon-draw-modal-btn polygon-draw-modal-btn-cancel" style={{ flex: '1 1 60px' }}>Cancel</button>
              </div>
            </div>
            <div className="um-feature-info">
              <p className="um-feature-title"><ManualText sectionId="polygon-tools" blockId="polygon-tools-018" onNavigate={navTo} /></p>
              <p className="um-feature-desc"><ManualText sectionId="polygon-tools" blockId="polygon-tools-019" onNavigate={navTo} /></p>
            </div>
          </div>

        </div>
      </section>
      )}

        </div>{/* um-content-area */}
      </div>{/* um-layout */}
    </InfoPage>
  );
}

export default UserManual;

