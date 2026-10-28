import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { FiArrowLeft, FiFileText, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import { createNote, deleteNote, getNotes, updateNote, type Note } from "./notesRepository";
import ConfirmDialog from "../../Components/Common/ConfirmDialog";


type Draft = { id: number | null; title: string; content: string; originalTitle: string; originalContent: string };
type NoteFilter = "all" | "recent" | "older";
const blankDraft = (): Draft => ({ id: null, title: "", content: "", originalTitle: "", originalContent: "" });
const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const richNoteFormat = "daylens-rich-v1";
const getStoredRichHtml = (value: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "format" in parsed && parsed.format === richNoteFormat && "html" in parsed && typeof parsed.html === "string") return parsed.html;
  } catch { /* Existing notes use Markdown text. */ }
  return null;
};
const safeNoteUrl = (value: string) => /^(https?:|mailto:|tel:|\/|#|\.?\.?\/)/i.test(value.trim());
function cleanRichHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const cleanTags = new Set(["P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "A", "IMG", "DEL", "S", "SPAN"]);
  const output = document.createElement("div");
  const appendClean = (parent: Node, source: Node) => {
    if (source.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(source.textContent ?? "")); return; }
    if (!(source instanceof HTMLElement)) return;
    if (!cleanTags.has(source.tagName)) { Array.from(source.childNodes).forEach(child => appendClean(parent, child)); return; }
    const tagName = source.tagName === "SPAN"
      ? source.style.fontWeight === "bold" || Number(source.style.fontWeight) >= 600 ? "STRONG"
        : source.style.fontStyle === "italic" ? "EM"
          : source.style.textDecorationLine.includes("underline") ? "U" : "SPAN"
      : source.tagName;
    const safe = document.createElement(tagName.toLowerCase());
    if (source.tagName === "OL") {
      const start = source.getAttribute("start");
      if (start && /^-?\d+$/.test(start)) safe.setAttribute("start", start);
    }
    if (source.tagName === "A") {
      const href = source.getAttribute("href");
      if (href && safeNoteUrl(href)) safe.setAttribute("href", href);
      const title = source.getAttribute("title");
      if (title) safe.setAttribute("title", title);
    } else if (source.tagName === "IMG") {
      const src = source.getAttribute("src");
      if (src && safeNoteUrl(src)) safe.setAttribute("src", src);
      safe.setAttribute("alt", source.getAttribute("alt") ?? "");
      const title = source.getAttribute("title");
      if (title) safe.setAttribute("title", title);
    }
    Array.from(source.childNodes).forEach(child => appendClean(safe, child));
    parent.appendChild(safe);
  };
  Array.from(document.body.childNodes).forEach(child => appendClean(output, child));
  return output.innerHTML;
}
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const cardDateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};
const plainTextFromMarkdown = (value: string) => {
  const html = getStoredRichHtml(value);
  if (html !== null) return new DOMParser().parseFromString(cleanRichHtml(html), "text/html").body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return value
  .replace(/```[\s\S]*?```/g, (block) => block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, ""))
  .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/^\s{0,3}#{1,6}\s+/gm, "")
  .replace(/^\s*[-+*>]\s+/gm, "")
  .replace(/^\s*\d+\.\s+/gm, "")
  .replace(/[*_~`]/g, "")
  .replace(/\s+/g, " ")
  .trim();
};
const legacyMarkdownForEditor = (value: string) => value
  .replace(/^[ \t]*\*{4,}[ \t]*$/gm, "")
  .split(/(```[\s\S]*?```)/g)
  .map((part, index) => index % 2 ? part : part.replace(/([^\n])\n(?!\n)/g, "$1  \n"))
  .join("");

function serializeNoteEditor(editor: HTMLElement): string {
  return JSON.stringify({ format: richNoteFormat, html: cleanRichHtml(editor.innerHTML) });
}

type RichEditorProps = { value: string; editorRef: RefObject<HTMLDivElement | null>; onChange: (value: string) => void };
const RichNoteEditor = memo(function RichNoteEditor({ value, editorRef, onChange }: RichEditorProps) {
  const savedHtml = getStoredRichHtml(value);
  useLayoutEffect(() => {
    if (savedHtml !== null && editorRef.current) editorRef.current.innerHTML = cleanRichHtml(savedHtml);
  }, [editorRef, savedHtml]);
  return <div ref={editorRef} className="notes-detail-content notes-rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Note content" aria-multiline="true" data-placeholder="Write something worth remembering…" onInput={(event) => onChange(serializeNoteEditor(event.currentTarget))} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) event.preventDefault(); }} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); onChange(serializeNoteEditor(event.currentTarget)); }}>{savedHtml === null && <ReactMarkdown>{legacyMarkdownForEditor(value)}</ReactMarkdown>}</div>;
}, (previous, next) => previous.editorRef === next.editorRef && previous.onChange === next.onChange);

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorSelectionRef = useRef<Range | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; confirmLabel: string; action: () => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try { setNotes(await getNotes(search)); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "Could not load notes."); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, search ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const dirty = useMemo(() => Boolean(draft && (draft.title !== draft.originalTitle || draft.content !== draft.originalContent)), [draft]);
  const editorOpen = draft !== null;

  useEffect(() => {
    document.documentElement.classList.toggle("notes-editor-open", editorOpen);
    document.body.classList.toggle("notes-editor-open", editorOpen);
    return () => {
      document.documentElement.classList.remove("notes-editor-open");
      document.body.classList.remove("notes-editor-open");
    };
  }, [editorOpen]);
  const visibleNotes = useMemo(() => {
    if (filter === "all") return notes;
    return notes.filter((note) => {
      const updated = new Date(note.updatedAt).getTime();
      if (!Number.isFinite(updated)) return filter === "older";
      return filter === "recent" ? updated >= recentCutoff : updated < recentCutoff;
    });
  }, [filter, notes]);

  const discardOrStay = (action: () => void) => {
    if (!dirty) { action(); return; }
    setConfirmation({ title: "Discard unsaved changes?", message: "Your changes have not been saved. Discard them?", confirmLabel: "Discard", action: () => { setConfirmation(null); action(); } });
  };
  const openNote = (note: Note) => {
    discardOrStay(() => {
      setDraft({ id: note.id, title: note.title, content: note.content, originalTitle: note.title, originalContent: note.content });
      setSaveError(""); setNotice("");
    });
  };
  const startNew = () => {
    discardOrStay(() => { setDraft(blankDraft()); setSaveError(""); setNotice(""); });
  };
  const closeEditor = () => {
    discardOrStay(() => { setDraft(null); setSaveError(""); setNotice(""); });
  };

  const setEditorContent = useCallback((content: string) => {
    setDraft((current) => current ? { ...current, content } : current);
  }, []);

  const rememberEditorSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) editorSelectionRef.current = range.cloneRange();
    }
  };
  const keepEditorSelection = (event: { preventDefault: () => void }) => {
    rememberEditorSelection();
    event.preventDefault();
  };

  const restoreEditorSelection = (editor: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection) return null;
    const remembered = editorSelectionRef.current;
    if (remembered && editor.contains(remembered.commonAncestorContainer)) {
      editor.focus();
      selection.removeAllRanges();
      selection.addRange(remembered);
      return remembered;
    }
    if (selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const activeRange = selection.getRangeAt(0).cloneRange();
      editor.focus();
      selection.removeAllRanges(); selection.addRange(activeRange);
      return activeRange;
    }
    editor.focus();
    return null;
  };

  const toggleUnorderedList = (editor: HTMLElement, range: Range | null) => {
    const selection = window.getSelection();
    let block: HTMLElement | null = range?.startContainer instanceof HTMLElement
      ? range.startContainer
      : range?.startContainer.parentElement ?? null;
    while (block && block !== editor && !/^(P|DIV|H[1-6]|PRE|LI)$/.test(block.tagName)) block = block.parentElement;
    if (!selection) return;
    if (!block || block === editor) {
      const list = document.createElement("ul");
      const item = document.createElement("li");
      item.appendChild(document.createElement("br"));
      list.appendChild(item);
      editor.appendChild(list);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(item);
      nextRange.collapse(true);
      selection.removeAllRanges(); selection.addRange(nextRange);
      return;
    }

    if (block.tagName === "LI" && block.parentElement?.tagName === "OL") {
      const orderedList = block.parentElement;
      const unorderedList = document.createElement("ul");
      while (orderedList.firstChild) unorderedList.appendChild(orderedList.firstChild);
      orderedList.replaceWith(unorderedList);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(block);
      nextRange.collapse(false);
      selection.removeAllRanges(); selection.addRange(nextRange);
      return;
    }

    if (block.tagName === "LI" && block.parentElement?.tagName === "UL") {
      const list = block.parentElement;
      const items = Array.from(list.children);
      const selectedIndex = items.indexOf(block);
      const paragraphs = items.map(item => {
        const paragraph = document.createElement("p");
        while (item.firstChild) paragraph.appendChild(item.firstChild);
        return paragraph;
      });
      const fragment = document.createDocumentFragment();
      paragraphs.forEach(paragraph => fragment.appendChild(paragraph));
      list.replaceWith(fragment);
      const selectedParagraph = paragraphs[selectedIndex];
      if (!selectedParagraph) return;
      const nextRange = document.createRange();
      nextRange.selectNodeContents(selectedParagraph);
      nextRange.collapse(false);
      selection.removeAllRanges(); selection.addRange(nextRange);
      return;
    }

    const list = document.createElement("ul");
    const item = document.createElement("li");
    while (block.firstChild) item.appendChild(block.firstChild);
    if (!item.firstChild) item.appendChild(document.createElement("br"));
    list.appendChild(item);
    block.replaceWith(list);
    const nextRange = document.createRange();
    nextRange.selectNodeContents(item);
    nextRange.collapse(false);
    selection.removeAllRanges(); selection.addRange(nextRange);
  };

  const runEditorCommand = (command: string, value?: string) => {
    const editor = editorRef.current;
    if (!draft || !editor) return;
    const range = restoreEditorSelection(editor);
    if (command === "insertUnorderedList") {
      toggleUnorderedList(editor, range);
      rememberEditorSelection();
      setEditorContent(serializeNoteEditor(editor));
      return;
    }
    let commandValue = value;
    if (command === "formatBlock" && value && range) {
      let block = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
      while (block && block !== editor && !/^(P|DIV|H[1-6]|PRE)$/.test(block.tagName)) block = block.parentElement;
      if (block?.tagName.toLowerCase() === value.toLowerCase()) commandValue = "p";
    }
    document.execCommand(command, false, commandValue);
    rememberEditorSelection();
    setEditorContent(serializeNoteEditor(editor));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true); setSaveError(""); setNotice("");
    try {
      if (draft.id === null) {
        const id = await createNote({ title: draft.title, content: draft.content });
        const saved = await getNotes(search);
        setNotes(saved);
        const created = saved.find((note) => note.id === id);
        if (created) setDraft({ id: created.id, title: created.title, content: created.content, originalTitle: created.title, originalContent: created.content });
        else setDraft(null);
      } else {
        await updateNote(draft.id, { title: draft.title, content: draft.content });
        const saved = await getNotes(search); setNotes(saved);
        const updated = saved.find((note) => note.id === draft.id);
        if (updated) setDraft({ id: updated.id, title: updated.title, content: updated.content, originalTitle: updated.title, originalContent: updated.content }); else setDraft(null);
      }
      setNotice("Note saved.");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save this note."); }
    finally { setSaving(false); }
  };

  const requestDelete = (note: Pick<Note, "id" | "title">) => {
    setConfirmation({ title: "Delete note?", message: `“${note.title}” will be permanently deleted. This cannot be undone.`, confirmLabel: "Delete", action: () => { void confirmRemove(note.id); } });
  };

  const confirmRemove = async (noteId: number) => {
    setSaving(true); setSaveError(""); setNotice("");
    try { await deleteNote(noteId); setConfirmation(null); setDraft(current => current?.id === noteId ? null : current); setNotes(await getNotes(search)); setNotice("Note deleted."); }
    catch (error) {
      setConfirmation(null);
      const message = error instanceof Error ? error.message : "Could not delete this note.";
      if (draft?.id === noteId) setSaveError(message); else setLoadError(message);
    }
    finally { setSaving(false); }
  };

  const activeNote = draft?.id == null ? undefined : notes.find((note) => note.id === draft.id);

  return <section className={`notes-page ${draft ? "notes-is-editing" : ""}`} aria-label="Notes">
    {confirmation && <ConfirmDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.confirmLabel} busy={saving} onCancel={() => setConfirmation(null)} onConfirm={confirmation.action} />}
    {!draft && <div className="page-heading notes-page-heading"><div><span className="section-kicker">YOUR THOUGHTS</span><h1>Notes</h1><p>Keep a thought close.</p></div><button className="primary-button notes-new-desktop" onClick={startNew}><FiPlus /> New note</button></div>}
    {notice && !draft && <p className="notes-page-notice" role="status">{notice}</p>}

    {draft ? <article className="content-panel notes-editor-panel notes-detail-screen">
      <form className="notes-editor" onSubmit={save}>
        <div className="notes-detail-toolbar">
          <button type="button" className="notes-back-button" onClick={closeEditor} aria-label="Back to notes"><FiArrowLeft /><span>Notes</span></button>
          <div className="notes-editor-actions">
            {draft.id !== null && <button type="button" className="icon-button notes-delete" title="Delete note" aria-label="Delete note" disabled={saving} onClick={() => requestDelete({ id: draft.id as number, title: draft.title })}><FiTrash2 /></button>}
            <button type="submit" className="primary-button" disabled={saving || !dirty}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
        <div className="notes-detail-meta"><span>{activeNote ? `Updated ${dateLabel(activeNote.updatedAt)}` : "New note"}</span><span>{plainTextFromMarkdown(draft.content).length.toLocaleString()} characters</span></div>
        <input className="notes-detail-title" aria-label="Note title" autoFocus={false} maxLength={160} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Title" />
        <div className="notes-markdown-toolbar" role="toolbar" aria-label="Text formatting">
          <button type="button" title="Bold" aria-label="Bold" onPointerDown={rememberEditorSelection} onMouseDown={keepEditorSelection} onClick={() => runEditorCommand("bold")}>B</button>
          <button type="button" title="Italic" aria-label="Italic" onPointerDown={rememberEditorSelection} onMouseDown={keepEditorSelection} onClick={() => runEditorCommand("italic")}><i>I</i></button>
          <button type="button" title="Heading" aria-label="Heading" onPointerDown={rememberEditorSelection} onMouseDown={keepEditorSelection} onClick={() => runEditorCommand("formatBlock", "h2")}>H</button>
          <button type="button" title="Bullet list" aria-label="Bullet list" onPointerDown={rememberEditorSelection} onMouseDown={keepEditorSelection} onClick={() => runEditorCommand("insertUnorderedList")}>•</button>
          <button type="button" title="Code block" aria-label="Code block" onPointerDown={rememberEditorSelection} onMouseDown={keepEditorSelection} onClick={() => runEditorCommand("formatBlock", "pre")}>{"</>"}</button>
        </div>
        <RichNoteEditor key={draft.id ?? "new-note"} editorRef={editorRef} value={draft.content} onChange={setEditorContent} />
        <div className="notes-detail-footer">
          {activeNote && <span>Created {dateLabel(activeNote.createdAt)}</span>}
          {saveError && <span className="form-error" role="alert">{saveError}</span>}
          {notice && <span className="form-success" role="status">{notice}</span>}
        </div>
      </form>
    </article> : <>
      <div className="notes-toolbar">
        <label className="notes-search"><FiSearch aria-hidden="true" /><input aria-label="Search notes" placeholder="Search your notes" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="notes-filter-row" role="group" aria-label="Filter notes">
          {([ ["all", "All"], ["recent", "Last 30 days"], ["older", "Older"] ] as const).map(([value, label]) => <button key={value} type="button" className={`notes-filter-chip ${filter === value ? "active" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>

      {loading ? <div className="notes-state content-panel" role="status">Loading notes…</div> : loadError ? <div className="notes-state content-panel"><p className="form-error" role="alert">{loadError}</p><button className="secondary-button" onClick={() => void load()}>Try again</button></div> : visibleNotes.length ? <div className="notes-card-list" aria-label="Note results">{visibleNotes.map((note) => <article key={note.id} className="notes-card"><button type="button" className="notes-card-open" onClick={() => openNote(note)}><strong>{note.title}</strong><small>{cardDateLabel(note.updatedAt)}</small></button><button type="button" className="icon-button danger-icon notes-card-delete" aria-label={`Delete ${note.title}`} title="Delete note" disabled={saving} onClick={() => requestDelete(note)}><FiTrash2 /></button></article>)}</div> : <div className="notes-state notes-empty-card content-panel"><span className="empty-symbol"><FiFileText /></span><strong>{search ? "No matching notes" : filter === "all" ? "No notes yet" : "No notes in this filter"}</strong><p>{search ? "Try another title or phrase." : filter === "all" ? "Create a note to keep an idea close." : "Try another filter or create a new note."}</p></div>}
      <button className="notes-fab" type="button" onClick={startNew} aria-label="Create a note"><FiPlus /></button>
    </>}
  </section>;
}
