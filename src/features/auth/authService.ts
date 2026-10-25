import { Capacitor } from "@capacitor/core";
import { initDatabase } from "../../database/configDatabase";

const SESSION_KEY = "personal-os.account-id";
const PBKDF2_ITERATIONS = 310_000;
const SESSION_EVENT = "personal-os:session-change";

export interface LocalAccount {
  id: number;
  email: string;
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
};

const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const derivePasswordHash = async (password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Password protection requires a secure browser context (HTTPS or localhost).");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    256,
  );
  return new Uint8Array(result);
};

const setSession = (account: LocalAccount | null) => {
  if (account) sessionStorage.setItem(SESSION_KEY, String(account.id));
  else sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
};

const persistWebStore = async () => {
  if (Capacitor.getPlatform() === "web") {
    const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
    await new SQLiteConnection(CapacitorSQLite).saveToStore("index");
  }
};

const toAccount = (row?: Record<string, unknown>): LocalAccount | null => {
  if (!row) return null;
  return { id: Number(row.id), email: String(row.email) };
};

export const registerAccount = async (emailInput: string, password: string) => {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (password.length < 10) throw new Error("Use a password with at least 10 characters.");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  const db = await initDatabase();
  try {
    const result = await db.run(
      `INSERT INTO local_accounts (email, password_hash, password_salt, password_iterations, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [email, bytesToBase64(hash), bytesToBase64(salt), PBKDF2_ITERATIONS, new Date().toISOString()],
    );
    await persistWebStore();
    const account = { id: Number(result.changes?.lastId), email };
    if (!account.id) throw new Error("The local database did not return an account ID.");
    setSession(account);
    return account;
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      throw new Error("An account with this email already exists.", { cause: error });
    }
    throw error;
  }
};

export const loginAccount = async (emailInput: string, password: string) => {
  const db = await initDatabase();
  const result = await db.query(
    `SELECT id, email, password_hash, password_salt, password_iterations
     FROM local_accounts WHERE email = ? COLLATE NOCASE LIMIT 1`,
    [emailInput.trim()],
  );
  const row = result.values?.[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error("Email or password is incorrect.");
  const iterations = Number(row.password_iterations);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) {
    throw new Error("Email or password is incorrect.");
  }
  const hash = await derivePasswordHash(password, base64ToBytes(String(row.password_salt)), iterations);
  const expected = base64ToBytes(String(row.password_hash));
  if (hash.length !== expected.length || !hash.every((byte, index) => byte === expected[index])) {
    throw new Error("Email or password is incorrect.");
  }
  const account = toAccount(row);
  if (!account) throw new Error("Email or password is incorrect.");
  setSession(account);
  return account;
};

export const restoreLocalSession = async (): Promise<LocalAccount | null> => {
  const storedId = sessionStorage.getItem(SESSION_KEY);
  if (!storedId) return null;
  const id = Number(storedId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    setSession(null);
    return null;
  }
  const db = await initDatabase();
  const result = await db.query("SELECT id, email FROM local_accounts WHERE id = ?", [id]);
  const account = toAccount(result.values?.[0] as Record<string, unknown> | undefined);
  if (!account) setSession(null);
  return account;
};

export const logoutAccount = () => setSession(null);
export const sessionChangeEvent = SESSION_EVENT;
