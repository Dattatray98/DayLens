import { Capacitor } from "@capacitor/core";
import { initDatabase, persistDatabaseChanges } from "../../database/configDatabase";

export interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  content: string;
}

const validate = (input: NoteInput) => {
  if (!input.title.trim()) throw new Error("A title is required.");
  if (input.title.trim().length > 160) throw new Error("Title must be 160 characters or fewer.");
  if (input.content.length > 100000) throw new Error("Content must be 100,000 characters or fewer.");
  return { title: input.title.trim(), content: input.content };
};

const persist = async () => {
  if (Capacitor.getPlatform() === "web") await persistDatabaseChanges();
};

const mapNote = (row: Record<string, unknown>): Note => ({
  id: Number(row.id),
  title: String(row.title),
  content: String(row.content ?? ""),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

export const getNotes = async (search = ""): Promise<Note[]> => {
  const db = await initDatabase();
  const term = search.trim().replace(/[\\%_]/g, "\\$&");
  const result = await db.query(
    `SELECT id, title, content, created_at, updated_at FROM notes
     ${term ? "WHERE title LIKE ? ESCAPE '\\' COLLATE NOCASE OR content LIKE ? ESCAPE '\\' COLLATE NOCASE" : ""}
     ORDER BY updated_at DESC, id DESC`,
    term ? [`%${term}%`, `%${term}%`] : [],
  );
  return (result.values ?? []).map((row) => mapNote(row as Record<string, unknown>));
};

export const getNote = async (id: number): Promise<Note | null> => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Note not found.");
  const db = await initDatabase();
  const result = await db.query("SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?", [id]);
  const row = result.values?.[0];
  return row ? mapNote(row as Record<string, unknown>) : null;
};

export const createNote = async (input: NoteInput): Promise<number> => {
  const note = validate(input);
  const db = await initDatabase();
  const now = new Date().toISOString();
  const result = await db.run(
    "INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [note.title, note.content, now, now],
  );
  await persist();
  return Number(result.changes?.lastId);
};

export const updateNote = async (id: number, input: NoteInput): Promise<void> => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Note not found.");
  const note = validate(input);
  const db = await initDatabase();
  const result = await db.run("UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?", [
    note.title, note.content, new Date().toISOString(), id,
  ]);
  if (!result.changes?.changes) throw new Error("This note no longer exists.");
  await persist();
};

export const deleteNote = async (id: number): Promise<void> => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Note not found.");
  const db = await initDatabase();
  const result = await db.run("DELETE FROM notes WHERE id = ?", [id]);
  if (!result.changes?.changes) throw new Error("This note no longer exists.");
  await persist();
};
