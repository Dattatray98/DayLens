import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FiFileText, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { createNote, deleteNote, getNotes, updateNote, type Note } from "./notesRepository";

type Draft = { id: number | null; title: string; content: string; originalTitle: string; originalContent: string };
const blankDraft = (): Draft => ({ id: null, title: "", content: "", originalTitle: "", originalContent: "" });
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
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

  return <>
    <div className="page-heading notes-page-heading"><div><span className="section-kicker">YOUR THOUGHTS</span><h1>Notes</h1><p>A quiet place to keep useful thoughts.</p></div><button className="primary-button" onClick={startNew}><FiPlus /> New note</button></div>
    <section className="notes-layout" aria-label="Notes">
      <aside className="content-panel notes-list-panel">
        <label className="notes-search"><FiSearch aria-hidden="true" /><input aria-label="Search notes" placeholder="Search notes" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {loading ? <p className="notes-state" role="status">Loading notes…</p> : loadError ? <div className="notes-state"><p className="form-error" role="alert">{loadError}</p><button className="secondary-button" onClick={() => void load()}>Try again</button></div> : notes.length ? <div className="notes-list" aria-label="Note results">{notes.map((note) => <button type="button" key={note.id} className={`notes-list-item ${draft?.id === note.id ? "selected" : ""}`} onClick={() => openNote(note)}><strong>{note.title}</strong><span>{note.content.trim().replace(/\s+/g, " ").slice(0, 100) || "No additional text"}</span><small>Updated {dateLabel(note.updatedAt)}</small></button>)}</div> : <div className="notes-state"><span className="empty-symbol"><FiFileText /></span><strong>{search ? "No matching notes" : "No notes yet"}</strong><p>{search ? "Try another title or phrase." : "Create a note to keep an idea close."}</p></div>}
      </aside>
      <article className="content-panel notes-editor-panel">
        {!draft ? <div className="notes-state notes-start-state"><span className="module-icon"><FiFileText /></span><h2>Make room for a thought</h2><p>Choose a note to read or start a new one.</p><button className="secondary-button" onClick={startNew}><FiPlus /> New note</button></div> : <form className="notes-editor" onSubmit={save}>
          <div className="notes-editor-top"><span className="section-kicker">{draft.id === null ? "NEW NOTE" : "NOTE"}</span><div className="notes-editor-actions">{draft.id !== null && <button type="button" className="icon-button notes-delete" title="Delete note" aria-label="Delete note" disabled={saving} onClick={() => void remove()}><FiTrash2 /></button>}<button type="submit" className="primary-button" disabled={saving || !dirty}>{saving ? "Saving…" : "Save note"}</button></div></div>
          {draft.id !== null && <div className="notes-dates"><span>Created {dateLabel(notes.find((note) => note.id === draft.id)?.createdAt ?? "")}</span><span>Updated {dateLabel(notes.find((note) => note.id === draft.id)?.updatedAt ?? "")}</span></div>}
          <label className="notes-title-label">Title<input autoFocus maxLength={160} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="A clear title" /></label>
          <label className="notes-content-label">Content<textarea maxLength={100000} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Write in plain text…" /></label>
          <div className="notes-editor-foot"><span>{draft.content.length.toLocaleString()} / 100,000 characters · Plain text</span>{saveError && <span className="form-error" role="alert">{saveError}</span>}{notice && <span className="form-success" role="status">{notice}</span>}</div>
        </form>}
      </article>
    </section>
  </>;
}
