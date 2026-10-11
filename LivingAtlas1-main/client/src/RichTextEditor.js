import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Fragment, Slice } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { attachmentHref, pendingAttachmentHref } from './descriptionAttachments';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBold,
    faItalic,
    faUnderline,
    faStrikethrough,
    faListUl,
    faListOl,
    faCheck,
    faChevronDown,
    faHeading,
    faUndo,
    faRedo,
    faRemoveFormat,
    faLink,
    faPaperclip,
} from '@fortawesome/free-solid-svg-icons';
import './RichTextEditor.css';

// Text-style options shown in the toolbar's heading dropdown (0 = paragraph).
const HEADING_OPTIONS = [
    { level: 0, label: 'Paragraph' },
    { level: 1, label: 'Heading 1' },
    { level: 2, label: 'Heading 2' },
    { level: 3, label: 'Heading 3' },
    { level: 4, label: 'Heading 4' },
    { level: 5, label: 'Heading 5' },
    { level: 6, label: 'Heading 6' },
];

// A small Word-like rich text editor (TipTap) used for card descriptions.
// Controlled component: `value` is an HTML string, `onChange` fires with the
// new HTML whenever the user edits.
function RichTextEditor({ value, onChange, placeholder, id, className, minHeight, attachments = [], onInsertFiles }) {
    const lastEmittedRef = useRef(value);
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4, 5, 6] },
                link: { openOnClick: false },
            }),
            // StarterKit v3 already bundles Underline + UndoRedo, so we must NOT
            // add Underline again here (would cause a duplicate-extension warning).
            Placeholder.configure({
                placeholder: placeholder || 'Enter description...',
            }),
        ],
        content: value || '',
        onUpdate: ({ editor: ed }) => {
            const html = ed.getHTML();
            // Normalize TipTap's empty-content markup to an empty string.
            const normalized = html === '<p></p>' ? '' : html;
            lastEmittedRef.current = normalized;
            onChange(normalized);
        },
        editorProps: {
            attributes: {
                class: 'rich-text-editor-content',
                ...(minHeight ? { style: `min-height:${minHeight}px;` } : {}),
            },
            // Pasted plain text with line breaks becomes soft line breaks (<br>)
            // within ONE paragraph, instead of TipTap's default of splitting each
            // line into a separate <p>. Without this, pasting multi-line text
            // produces separate paragraphs (and empty paragraphs for blank lines),
            // which is what makes text look "split into its own lines", hard to
            // merge, and with inconsistent paragraph spacing.
            clipboardTextParser: (text, $context, plainText, view) => {
                const { schema } = view.state;
                const marks = $context.marks();
                const nodes = [];
                text.split(/\r\n?|\n/).forEach((line, i) => {
                    if (i > 0) nodes.push(schema.nodes.hardBreak.create());
                    if (line) nodes.push(schema.text(line, marks));
                });
                return new Slice(Fragment.fromArray(nodes), 0, 0);
            },
        },
    });

    // Sync when the value changes externally (cancel/restore, switching cards).
    // Compare against the last value we emitted (not editor.getHTML()) to avoid
    // re-parsing mid-edit, which can reset the selection/restructure the DOM.
    useEffect(() => {
        if (editor && value !== lastEmittedRef.current) {
            editor.commands.setContent(value || '', false);
            lastEmittedRef.current = value || '';
        }
    }, [value, editor]);

    const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);
    const headingMenuRef = useRef(null);
    const [insertPanel, setInsertPanel] = useState(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkText, setLinkText] = useState('');
    const [insertError, setInsertError] = useState('');
    const selectionRef = useRef(null);
    const fileInputRef = useRef(null);

    // Close the heading dropdown when clicking outside or pressing Escape.
    useEffect(() => {
        if (!isHeadingMenuOpen) return;
        const handlePointerDown = (e) => {
            if (headingMenuRef.current && !headingMenuRef.current.contains(e.target)) {
                setIsHeadingMenuOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsHeadingMenuOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isHeadingMenuOpen]);

    if (!editor) return null;

    const openInsertPanel = kind => {
        if (kind === 'link' && editor.isActive('link')) editor.commands.extendMarkRange('link');
        const { from, to } = editor.state.selection;
        selectionRef.current = { from, to };
        setLinkText(editor.state.doc.textBetween(from, to, ' '));
        setLinkUrl(editor.getAttributes('link').href || '');
        setInsertError('');
        setIsHeadingMenuOpen(false);
        setInsertPanel(kind);
    };
    const insertAnchor = (href, text) => {
        const chain = editor.chain().focus();
        if (selectionRef.current) chain.setTextSelection(selectionRef.current);
        chain.insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }] }).command(({ tr }) => { tr.setStoredMarks([]); return true; }).run();
        selectionRef.current = { from: editor.state.selection.from, to: editor.state.selection.to };
        setInsertPanel(null);
    };
    const applyLink = () => {
        let href = linkUrl.trim();
        if (/^\/downloadFile\?fileID=\d+$/.test(href) && linkText.trim()) {
            insertAnchor(href, linkText.trim());
            return;
        }
        if (!/^[a-z][a-z\d+.-]*:/i.test(href)) href = `https://${href}`;
        try {
            const url = new URL(href);
            if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) throw new Error();
            if (!linkUrl.trim() || !linkText.trim()) throw new Error();
        } catch {
            setInsertError('Enter a valid web, email or telephone link and display text.');
            return;
        }
        insertAnchor(href, linkText.trim());
    };

    const buttons = [
        { label: 'Bold', icon: faBold, active: editor.isActive('bold'), action: () => editor.chain().focus().toggleBold().run() },
        { label: 'Italic', icon: faItalic, active: editor.isActive('italic'), action: () => editor.chain().focus().toggleItalic().run() },
        { label: 'Underline', icon: faUnderline, active: editor.isActive('underline'), action: () => editor.chain().focus().toggleUnderline().run() },
        { label: 'Strikethrough', icon: faStrikethrough, active: editor.isActive('strike'), action: () => editor.chain().focus().toggleStrike().run() },
        { label: 'Bullet List', icon: faListUl, active: editor.isActive('bulletList'), action: () => editor.chain().focus().toggleBulletList().run() },
        { label: 'Ordered List', icon: faListOl, active: editor.isActive('orderedList'), action: () => editor.chain().focus().toggleOrderedList().run() },
        { label: 'Undo', icon: faUndo, active: false, action: () => editor.chain().focus().undo().run() },
        { label: 'Redo', icon: faRedo, active: false, action: () => editor.chain().focus().redo().run() },
        { label: 'Clear Formatting', icon: faRemoveFormat, active: false, action: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
    ];

    const activeHeadingLevel = [1, 2, 3, 4, 5, 6].find((l) => editor.isActive('heading', { level: l })) || 0;
    const activeHeadingLabel = activeHeadingLevel
        ? (HEADING_OPTIONS.find((o) => o.level === activeHeadingLevel) || {}).label
        : 'Paragraph';

    const applyHeading = (level) => {
        setIsHeadingMenuOpen(false);
        if (level === 0) {
            editor.chain().focus().setParagraph().run();
        } else {
            editor.chain().focus().toggleHeading({ level }).run();
        }
    };

    return (
        <div
            className={`rich-text-editor${className ? ` ${className}` : ''}`}
            id={id}
        >
            <div className="rich-text-editor-toolbar">
                <div className="rich-text-editor-heading-menu" ref={headingMenuRef}>
                    <button
                        type="button"
                        className={`rich-text-editor-btn rich-text-editor-heading-toggle${activeHeadingLevel > 0 ? ' active' : ''}`}
                        title={`Text style: ${activeHeadingLabel}`}
                        aria-label="Text style"
                        aria-haspopup="menu"
                        aria-expanded={isHeadingMenuOpen}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setIsHeadingMenuOpen(v => !v)}
                    >
                        <FontAwesomeIcon icon={faHeading} />
                        <FontAwesomeIcon icon={faChevronDown} className="rich-text-editor-heading-caret" />
                    </button>
                    {isHeadingMenuOpen && (
                        <div className="rich-text-editor-heading-dropdown" role="menu">
                            {HEADING_OPTIONS.map((opt) => (
                                <button
                                    key={opt.level}
                                    type="button"
                                    role="menuitem"
                                    className={`rich-text-editor-heading-option rich-text-editor-heading-opt-${opt.level}${opt.level === activeHeadingLevel ? ' active' : ''}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => applyHeading(opt.level)}
                                >
                                    <span className="rich-text-editor-heading-option-check">
                                        {opt.level === activeHeadingLevel && <FontAwesomeIcon icon={faCheck} />}
                                    </span>
                                    <span className="rich-text-editor-heading-option-label">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {buttons.map((b) => (
                    <button
                        key={b.label}
                        type="button"
                        title={b.label}
                        aria-label={b.label}
                        className={`rich-text-editor-btn${b.active ? ' active' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={b.action}
                    >
                        <FontAwesomeIcon icon={b.icon} />
                    </button>
                ))}
                <span className="rich-text-editor-toolbar-divider" />
                <button type="button" className={`rich-text-editor-btn${editor.isActive('link') ? ' active' : ''}`} aria-label="Insert link" title="Insert or edit link" onMouseDown={e => e.preventDefault()} onClick={() => openInsertPanel('link')}><FontAwesomeIcon icon={faLink} /> Link</button>
                <button type="button" className="rich-text-editor-btn" aria-label="Insert file" title="Insert attachment" onMouseDown={e => e.preventDefault()} onClick={() => openInsertPanel('file')}><FontAwesomeIcon icon={faPaperclip} /> File</button>
            </div>
            {insertPanel && <div className="rich-text-editor-insert-panel" role="dialog" aria-label={insertPanel === 'link' ? 'Insert link' : 'Insert file'} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setInsertPanel(null); editor.commands.focus(); } }}>
                {insertPanel === 'link' ? <>
                    <label>Display text<input autoFocus value={linkText} onChange={e => setLinkText(e.target.value)} /></label>
                    <label>Link address<input type="url" placeholder="https://example.com" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} /></label>
                    {insertError && <p role="alert">{insertError}</p>}
                    <button type="button" onClick={applyLink}>Insert link</button>
                    {editor.isActive('link') && <button type="button" onClick={() => { editor.chain().focus().setTextSelection(selectionRef.current).extendMarkRange('link').unsetLink().run(); setInsertPanel(null); }}>Remove link</button>}
                </> : <>
                    <strong>Insert an attachment</strong>
                    {attachments.map(file => <button type="button" key={file.fileid} onClick={() => insertAnchor(attachmentHref(file.fileid), file.filename || 'Download file')}><FontAwesomeIcon icon={faPaperclip} /> {file.filename}</button>)}
                    {onInsertFiles && <>
                        <button type="button" onClick={() => fileInputRef.current.click()}>Choose files…</button>
                        <input ref={fileInputRef} type="file" multiple hidden aria-label="Insert files into description" onChange={e => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = '';
                            if (!files.length) return;
                            if (files.some(file => file.size > 5 * 1024 * 1024)) { setInsertError('Each file must be 5 MB or smaller.'); return; }
                            files.forEach(file => { file.descriptionToken = crypto.randomUUID(); });
                            onInsertFiles(files);
                            files.forEach((file, index) => {
                                if (index) editor.chain().focus().insertContent(' ').run();
                                selectionRef.current = index ? { from: editor.state.selection.from, to: editor.state.selection.to } : selectionRef.current;
                                insertAnchor(pendingAttachmentHref(file.descriptionToken), file.name);
                            });
                        }} />
                        <small>Multiple files supported, up to 5 MB each. Files upload when you save the card.</small>
                    </>}
                    {!attachments.length && !onInsertFiles && <p>No attached files available.</p>}
                    {insertError && <p role="alert">{insertError}</p>}
                </>}
                <button type="button" onClick={() => { setInsertPanel(null); editor.commands.focus(); }}>Close</button>
            </div>}
            <EditorContent editor={editor} />
        </div>
    );
}

export default RichTextEditor;
