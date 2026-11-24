import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';

export const DEFAULT_USER_FILTERS = {
    role: 'all',
    lastSignIn: 'any',
    dateJoined: 'any',
    startDate: '',
    endDate: '',
};

const NARROW_TOOLBAR = '(max-width: 880px)';
const FILTER_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const FILTERS = {
    role: {
        label: 'Role',
        options: [['all', 'All roles'], ['admin', 'Admin'], ['regular', 'Regular User']],
    },
    lastSignIn: {
        label: 'Last sign-in',
        options: [
            ['any', 'Any time'], ['7', 'Within 7 days'], ['30', 'Within 30 days'],
            ['older', 'Over 30 days ago'], ['missing', 'No sign-in recorded'],
        ],
    },
    dateJoined: {
        label: 'Date joined',
        options: [
            ['any', 'Any time'], ['7', 'Within 7 days'], ['30', 'Within 30 days'],
            ['90', 'Within 90 days'], ['custom', 'Custom range'],
        ],
    },
};

function FilterSelect({ field, id, value, onChange }) {
    const { label, options } = FILTERS[field];
    return (
        <div className="admin-user-field">
            <label htmlFor={id}>{label}</label>
            <select id={id} className="account-control" value={value} onChange={event => onChange(field, event.target.value)}>
                {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
        </div>
    );
}

export function hasUserFilters(filters) {
    return Object.keys(FILTERS).some(field => filters[field] !== DEFAULT_USER_FILTERS[field]);
}

function formatDateRange(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    return FILTER_DATE_FORMAT.formatRange?.(start, end)
        ?? `${FILTER_DATE_FORMAT.format(start)} – ${FILTER_DATE_FORMAT.format(end)}`;
}

export default function AdminUserFilters({
    search, searchRef, setSearch, filters, setFilters, onRefresh, isLoading, listAvailable, total, matches,
}) {
    const [narrow, setNarrow] = useState(() => Boolean(window.matchMedia?.(NARROW_TOOLBAR)?.matches));
    const [draft, setDraft] = useState(null);
    const [rangeError, setRangeError] = useState(null);
    const filterButton = useRef(null);
    const startDateInput = useRef(null);
    const endDateInput = useRef(null);

    useEffect(() => {
        const media = window.matchMedia?.(NARROW_TOOLBAR);
        const sync = () => setNarrow(Boolean(media?.matches));
        sync();
        media?.addEventListener?.('change', sync);
        return () => media?.removeEventListener?.('change', sync);
    }, []);

    const appliedFields = Object.keys(FILTERS).filter(field => filters[field] !== DEFAULT_USER_FILTERS[field]);
    const panelCount = narrow ? appliedFields.length : Number(appliedFields.includes('dateJoined'));
    const appRoot = document.getElementById('root');

    const changeFilter = (field, value) => setFilters(previous => ({ ...previous, [field]: value }));
    const changeDraft = (field, value) => {
        setRangeError(null);
        setDraft(previous => ({ ...previous, [field]: value }));
    };

    const openPanel = () => {
        setRangeError(null);
        setDraft({ ...filters });
    };

    const applyPanel = event => {
        event.preventDefault();
        if (draft.dateJoined === 'custom') {
            const start = Date.parse(`${draft.startDate}T00:00:00`);
            const end = Date.parse(`${draft.endDate}T00:00:00`);
            if (!Number.isFinite(start)) {
                setRangeError({ field: 'startDate', message: 'Enter a valid start date.' });
                startDateInput.current?.focus();
                return;
            }
            if (!Number.isFinite(end) || end < start) {
                setRangeError({
                    field: 'endDate',
                    message: Number.isFinite(end) ? 'End date must be on or after start date.' : 'Enter a valid end date.',
                });
                endDateInput.current?.focus();
                return;
            }
        }
        setFilters(draft);
        setDraft(null);
    };

    const removeFilter = field => {
        filterButton.current?.focus();
        setFilters(previous => field === 'dateJoined'
            ? { ...previous, dateJoined: 'any', startDate: '', endDate: '' }
            : { ...previous, [field]: DEFAULT_USER_FILTERS[field] });
    };

    return (
        <>
            <div className="admin-user-toolbar">
                <div className="admin-user-field">
                    <label htmlFor="admin-user-search">Search users</label>
                    <input ref={searchRef} id="admin-user-search" className="account-control" type="search" placeholder="Name or email" value={search} onChange={event => setSearch(event.target.value)} />
                </div>
                {!narrow && (
                    <>
                        <FilterSelect field="role" id="admin-user-role" value={filters.role} onChange={changeFilter} />
                        <FilterSelect field="lastSignIn" id="admin-user-sign-in" value={filters.lastSignIn} onChange={changeFilter} />
                    </>
                )}
                <div className="admin-user-toolbar-actions">
                    <button ref={filterButton} className="account-button account-button--secondary" type="button" aria-haspopup="dialog" onClick={openPanel}>
                        {narrow ? 'Filters' : 'More filters'}{panelCount > 0 && ` (${panelCount})`}
                    </button>
                    <button className="account-button account-button--secondary" type="button" disabled={isLoading} onClick={onRefresh}>Refresh users</button>
                </div>
            </div>
            <div className="admin-user-results">
                <p className="admin-user-count" role="status">
                    {isLoading ? 'Loading users...' : listAvailable ? `Showing ${matches} of ${total} users` : ''}
                </p>
                {appliedFields.length > 0 && (
                    <div className="admin-user-filter-tags" role="group" aria-label="Applied filters">
                        {appliedFields.map(field => {
                            const { label, options } = FILTERS[field];
                            const value = field === 'dateJoined' && filters.dateJoined === 'custom'
                                ? formatDateRange(filters.startDate, filters.endDate)
                                : options.find(([key]) => key === filters[field])[1];
                            return (
                                <button key={field} type="button" className="admin-user-filter-tag" aria-label={`Remove ${label} filter: ${value}`} onClick={() => removeFilter(field)}>
                                    {label}: {value} <span aria-hidden="true">×</span>
                                </button>
                            );
                        })}
                        <button className="account-link admin-user-clear" type="button" onClick={() => {
                            filterButton.current?.focus();
                            setFilters(DEFAULT_USER_FILTERS);
                        }}>Clear filters</button>
                    </div>
                )}
            </div>
            <Modal
                isOpen={draft !== null}
                overlayClassName="admin-modal-overlay admin-page"
                className="admin-modal account-dialog"
                aria={{ labelledby: 'admin-filters-title', modal: true }}
                ariaHideApp={Boolean(appRoot)}
                appElement={appRoot || undefined}
                onRequestClose={() => setDraft(null)}
                onAfterClose={() => filterButton.current?.focus()}
            >
                {draft && (
                    <form onSubmit={applyPanel} noValidate>
                        <h2 id="admin-filters-title" className="admin-modal-title">Filter users</h2>
                        <div className="admin-filter-fields">
                            {narrow && (
                                <>
                                    <FilterSelect field="role" id="admin-filter-role" value={draft.role} onChange={changeDraft} />
                                    <FilterSelect field="lastSignIn" id="admin-filter-sign-in" value={draft.lastSignIn} onChange={changeDraft} />
                                </>
                            )}
                            <div>
                                <FilterSelect field="dateJoined" id="admin-filter-date-joined" value={draft.dateJoined} onChange={changeDraft} />
                                <p className="admin-filter-hint">For some older accounts, the date reflects when this field was added.</p>
                            </div>
                            {draft.dateJoined === 'custom' && (
                                <div className="admin-filter-date-range">
                                    <div className="admin-user-field">
                                        <label htmlFor="admin-filter-start-date">Start date</label>
                                        <input
                                            ref={startDateInput}
                                            id="admin-filter-start-date"
                                            className="account-control"
                                            type="date"
                                            required
                                            value={draft.startDate}
                                            onChange={event => changeDraft('startDate', event.target.value)}
                                            aria-invalid={rangeError?.field === 'startDate'}
                                            aria-describedby={rangeError?.field === 'startDate' ? 'admin-filter-range-error' : undefined}
                                        />
                                    </div>
                                    <div className="admin-user-field">
                                        <label htmlFor="admin-filter-end-date">End date</label>
                                        <input
                                            ref={endDateInput}
                                            id="admin-filter-end-date"
                                            className="account-control"
                                            type="date"
                                            required
                                            value={draft.endDate}
                                            onChange={event => changeDraft('endDate', event.target.value)}
                                            aria-invalid={rangeError?.field === 'endDate'}
                                            aria-describedby={rangeError?.field === 'endDate' ? 'admin-filter-range-error' : undefined}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        {rangeError && <p id="admin-filter-range-error" role="alert" className="admin-error admin-modal-error">{rangeError.message}</p>}
                        <div className="admin-modal-actions">
                            <button className="account-button account-button--secondary" type="button" onClick={() => setDraft(null)}>Cancel</button>
                            <button className="account-button" type="submit">Apply filters</button>
                        </div>
                    </form>
                )}
            </Modal>
        </>
    );
}
