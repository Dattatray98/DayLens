import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FiArrowLeft, FiFileText, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { createNote, deleteNote, getNotes, updateNote, type Note } from "./notesRepository";

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

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
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
    setSaveError(""); setNotice("");
  };
  const startNew = () => {
    if (!discardOrStay()) return;
    setDraft(blankDraft()); setSaveError(""); setNotice("");
  };
  const closeEditor = () => {
    if (!discardOrStay()) return;
    setDraft(null); setSaveError(""); setNotice("");
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
            {draft.id !== null && <button type="button" className="icon-button notes-delete" title="Delete note" aria-label="Delete note" disabled={saving} onClick={() => void remove()}><FiTrash2 /></button>}
            <button type="submit" className="primary-button" disabled={saving || !dirty}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
        <div className="notes-detail-meta"><span>{activeNote ? `Updated ${dateLabel(activeNote.updatedAt)}` : "New note"}</span><span>{draft.content.length.toLocaleString()} characters</span></div>
        <input className="notes-detail-title" aria-label="Note title" autoFocus={false} maxLength={160} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Title" />
        <textarea className="notes-detail-content" aria-label="Note content" maxLength={100000} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Write something worth remembering…" />
        <div className="notes-detail-footer">
          {activeNote && <span>Created {dateLabel(activeNote.createdAt)}</span>}
          <span>Plain text · {draft.content.length.toLocaleString()} / 100,000 characters</span>
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

      {loading ? <div className="notes-state content-panel" role="status">Loading notes…</div> : loadError ? <div className="notes-state content-panel"><p className="form-error" role="alert">{loadError}</p><button className="secondary-button" onClick={() => void load()}>Try again</button></div> : visibleNotes.length ? <div className="notes-card-list" aria-label="Note results">{visibleNotes.map((note) => <button type="button" key={note.id} className="notes-card" onClick={() => openNote(note)}><strong>{note.title}</strong><span>{note.content.trim().replace(/\s+/g, " ").slice(0, 150) || "No additional text"}</span><small>{cardDateLabel(note.updatedAt)}</small></button>)}</div> : <div className="notes-state notes-empty-card content-panel"><span className="empty-symbol"><FiFileText /></span><strong>{search ? "No matching notes" : filter === "all" ? "No notes yet" : "No notes in this filter"}</strong><p>{search ? "Try another title or phrase." : filter === "all" ? "Create a note to keep an idea close." : "Try another filter or create a new note."}</p></div>}
      <button className="notes-fab" type="button" onClick={startNew} aria-label="Create a note"><FiPlus /></button>
    </>}
  </section>;
}
