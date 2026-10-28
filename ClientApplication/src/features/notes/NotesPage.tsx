import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { FiArrowLeft, FiEdit3, FiEye, FiFileText, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { createNote, deleteNote, getNotes, updateNote, type Note } from "./notesRepository";

const ReactMarkdown = lazy(() => import("react-markdown"));

type Draft = { id: number | null; title: string; content: string; originalTitle: string; originalContent: string };
type NoteFilter = "all" | "recent" | "older";
const blankDraft = (): Draft => ({ id: null, title: "", content: "", originalTitle: "", originalContent: "" });
const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const cardDateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};
const plainTextFromMarkdown = (value: string) => value
  .replace(/```[\s\S]*?```/g, (block) => block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, ""))
  .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/^\s{0,3}#{1,6}\s+/gm, "")
  .replace(/^\s*[-+*>]\s+/gm, "")
  .replace(/^\s*\d+\.\s+/gm, "")
  .replace(/[*_~`]/g, "")
  .replace(/\s+/g, " ")
  .trim();

function renderInlineNote(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*.+?\*\*|__.+?__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const token = match[0];
    const content = token.startsWith("**") || token.startsWith("__") ? token.slice(2, -2) : token.slice(1, -1);
    if (token.startsWith("**") || token.startsWith("__")) nodes.push(<strong key={`${keyPrefix}-${index++}`}>{content}</strong>);
    else if (token.startsWith("`")) nodes.push(<code key={`${keyPrefix}-${index++}`}>{content}</code>);
    else nodes.push(<em key={`${keyPrefix}-${index++}`}>{content}</em>);
    cursor = start + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderNoteText(value: string): ReactNode[] {
  const lines = value.split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) codeLines.push(lines[index++]);
      blocks.push(<pre key={`code-${index}`}><code>{codeLines.join("\n")}</code></pre>);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = `h${heading[1].length}` as "h1" | "h2" | "h3";
      blocks.push(<Tag key={`heading-${index}`}>{renderInlineNote(heading[2], `heading-${index}`)}</Tag>);
    } else if (/^>\s?/.test(line)) {
      blocks.push(<blockquote key={`quote-${index}`}>{renderInlineNote(line.replace(/^>\s?/, ""), `quote-${index}`)}</blockquote>);
    } else if (/^[-*+]\s+/.test(line)) {
      blocks.push(<ul key={`list-${index}`}><li>{renderInlineNote(line.replace(/^[-*+]\s+/, ""), `list-${index}`)}</li></ul>);
    } else if (/^\d+\.\s+/.test(line)) {
      blocks.push(<ol key={`ordered-${index}`}><li>{renderInlineNote(line.replace(/^\d+\.\s+/, ""), `ordered-${index}`)}</li></ol>);
    } else if (line.length) {
      blocks.push(<p key={`paragraph-${index}`}>{renderInlineNote(line, `paragraph-${index}`)}</p>);
    } else {
      blocks.push(<p key={`blank-${index}`}><br /></p>);
    }
  }
  return blocks;
}

function serializeNoteNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  const content = Array.from(node.childNodes).map(serializeNoteNode).join("");
  switch (node.tagName) {
    case "STRONG": case "B": return `**${content}**`;
    case "EM": case "I": return `*${content}*`;
    case "CODE": return node.parentElement?.tagName === "PRE" ? content : `\`${content}\``;
    case "PRE": return `\`\`\`\n${content.replace(/\n$/, "")}\n\`\`\`\n`;
    case "H1": return `# ${content.trim()}\n`;
    case "H2": return `## ${content.trim()}\n`;
    case "H3": return `### ${content.trim()}\n`;
    case "LI": return `- ${content.trim()}\n`;
    case "UL": case "OL": return content;
    case "BLOCKQUOTE": return content.split("\n").filter(Boolean).map((line) => `> ${line}\n`).join("");
    case "BR": return "\n";
    case "P": case "DIV": return `${content}\n`;
    case "SPAN":
      if (node.style.fontWeight === "bold" || Number(node.style.fontWeight) >= 600) return `**${content}**`;
      if (node.style.fontStyle === "italic") return `*${content}*`;
      return content;
    default: return content;
  }
}

function serializeNoteEditor(editor: HTMLElement): string {
  return Array.from(editor.childNodes).map(serializeNoteNode).join("").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "");
}

type RichEditorProps = { value: string; editorRef: RefObject<HTMLDivElement | null>; onChange: (value: string) => void };
const RichNoteEditor = memo(function RichNoteEditor({ value, editorRef, onChange }: RichEditorProps) {
  return <div ref={editorRef} className="notes-detail-content notes-rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Note content" aria-multiline="true" data-placeholder="Write something worth remembering…" onInput={(event) => onChange(serializeNoteEditor(event.currentTarget))} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); onChange(serializeNoteEditor(event.currentTarget)); }}>{renderNoteText(value)}</div>;
}, (previous, next) => previous.editorRef === next.editorRef && previous.onChange === next.onChange);

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

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

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const discardOrStay = () => !dirty || window.confirm("Discard your unsaved changes?");
  const openNote = (note: Note) => {
    if (!discardOrStay()) return;
    setDraft({ id: note.id, title: note.title, content: note.content, originalTitle: note.title, originalContent: note.content });
    setPreviewMode(false);
    setSaveError(""); setNotice("");
  };
  const startNew = () => {
    if (!discardOrStay()) return;
    setDraft(blankDraft()); setPreviewMode(false); setSaveError(""); setNotice("");
  };
  const closeEditor = () => {
    if (!discardOrStay()) return;
    setDraft(null); setSaveError(""); setNotice("");
  };

  const setEditorContent = useCallback((content: string) => {
    setDraft((current) => current ? { ...current, content } : current);
  }, []);

  const runEditorCommand = (command: string, value?: string) => {
    const editor = editorRef.current;
    if (!draft || !editor) return;
    editor.focus();
    document.execCommand(command, false, value);
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

  const remove = async () => {
    if (!draft?.id || !window.confirm("Delete this note? This cannot be undone.")) return;
    setSaving(true); setSaveError(""); setNotice("");
    try { await deleteNote(draft.id); setDraft(null); setNotes(await getNotes(search)); setNotice("Note deleted."); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Could not delete this note."); }
    finally { setSaving(false); }
  };

  const activeNote = draft?.id == null ? undefined : notes.find((note) => note.id === draft.id);

  return <section className={`notes-page ${draft ? "notes-is-editing" : ""}`} aria-label="Notes">
    {!draft && <div className="page-heading notes-page-heading"><div><span className="section-kicker">YOUR THOUGHTS</span><h1>Notes</h1><p>Keep a thought close.</p></div><button className="primary-button notes-new-desktop" onClick={startNew}><FiPlus /> New note</button></div>}
    {notice && !draft && <p className="notes-page-notice" role="status">{notice}</p>}

    {draft ? <article className="content-panel notes-editor-panel notes-detail-screen">
      <form className="notes-editor" onSubmit={save}>
        <div className="notes-detail-toolbar">
          <button type="button" className="notes-back-button" onClick={closeEditor} aria-label="Back to notes"><FiArrowLeft /><span>Notes</span></button>
          <div className="notes-editor-actions">
            <button type="button" className="icon-button notes-markdown-toggle" title={previewMode ? "Edit note" : "Preview note"} aria-label={previewMode ? "Edit note" : "Preview note"} aria-pressed={previewMode} onClick={() => setPreviewMode((value) => !value)}>{previewMode ? <FiEdit3 /> : <FiEye />}</button>
            {draft.id !== null && <button type="button" className="icon-button notes-delete" title="Delete note" aria-label="Delete note" disabled={saving} onClick={() => void remove()}><FiTrash2 /></button>}
            <button type="submit" className="primary-button" disabled={saving || !dirty}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
        <div className="notes-detail-meta"><span>{activeNote ? `Updated ${dateLabel(activeNote.updatedAt)}` : "New note"}</span><span>{plainTextFromMarkdown(draft.content).length.toLocaleString()} characters</span></div>
        <input className="notes-detail-title" aria-label="Note title" autoFocus={false} maxLength={160} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Title" />
        {!previewMode && <div className="notes-markdown-toolbar" role="toolbar" aria-label="Text formatting">
          <button type="button" title="Bold" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("bold")}>B</button>
          <button type="button" title="Italic" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("italic")}><i>I</i></button>
          <button type="button" title="Heading" aria-label="Heading" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("formatBlock", "h2")}>H</button>
          <button type="button" title="Bullet list" aria-label="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("insertUnorderedList")}>•</button>
          <button type="button" title="Code block" aria-label="Code block" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("formatBlock", "pre")}>{"</>"}</button>
        </div>}
        {previewMode ? <div className="notes-detail-content notes-markdown-preview" aria-label="Note preview"><Suspense fallback={<p role="status">Loading preview…</p>}><ReactMarkdown>{draft.content || "_Nothing to preview yet._"}</ReactMarkdown></Suspense></div> : <RichNoteEditor key={draft.id ?? "new-note"} editorRef={editorRef} value={draft.content} onChange={setEditorContent} />}
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

      {loading ? <div className="notes-state content-panel" role="status">Loading notes…</div> : loadError ? <div className="notes-state content-panel"><p className="form-error" role="alert">{loadError}</p><button className="secondary-button" onClick={() => void load()}>Try again</button></div> : visibleNotes.length ? <div className="notes-card-list" aria-label="Note results">{visibleNotes.map((note) => <button type="button" key={note.id} className="notes-card" onClick={() => openNote(note)}><strong>{note.title}</strong><span>{plainTextFromMarkdown(note.content).slice(0, 150) || "No additional text"}</span><small>{cardDateLabel(note.updatedAt)}</small></button>)}</div> : <div className="notes-state notes-empty-card content-panel"><span className="empty-symbol"><FiFileText /></span><strong>{search ? "No matching notes" : filter === "all" ? "No notes yet" : "No notes in this filter"}</strong><p>{search ? "Try another title or phrase." : filter === "all" ? "Create a note to keep an idea close." : "Try another filter or create a new note."}</p></div>}
      <button className="notes-fab" type="button" onClick={startNew} aria-label="Create a note"><FiPlus /></button>
    </>}
  </section>;
}
