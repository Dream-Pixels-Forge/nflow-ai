/**
 * IndexedDB Persistence Layer
 *
 * Provides persistent storage for messages, settings, memory entries,
 * and task history. Survives page refreshes and browser restarts.
 *
 * Uses raw IndexedDB API (no external dependencies).
 */

import type { AgentMode, Message, Task, AppSettings, VirtualFile } from "../../types";

// ── Database schema ─────────────────────────────────────────────────

const DB_NAME = "nexusflow";
const DB_VERSION = 1;

const STORES = {
  messages: "messages",
  settings: "settings",
  tasks: "tasks",
  memory: "memory",
  files: "files",
} as const;

// ── Stored message (extends Message with agent key) ─────────────────

export interface StoredMessage extends Message {
  agentMode: AgentMode;
}

// ── Memory entry ────────────────────────────────────────────────────

export interface StoredMemoryEntry {
  id: string;
  type: string;
  content: string;
  tags: string[];
  importance: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string>;
}

// ── DB singleton ────────────────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();

  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = (event) => {
    const db = (event.target as IDBOpenDBRequest).result;

    // Messages store: indexed by agent mode
    if (!db.objectStoreNames.contains(STORES.messages)) {
      const msgStore = db.createObjectStore(STORES.messages, { keyPath: "id" });
      msgStore.createIndex("agentMode", "agentMode", { unique: false });
      msgStore.createIndex("timestamp", "timestamp", { unique: false });
    }

    // Settings store: single key-value
    if (!db.objectStoreNames.contains(STORES.settings)) {
      db.createObjectStore(STORES.settings, { keyPath: "key" });
    }

    // Tasks store
    if (!db.objectStoreNames.contains(STORES.tasks)) {
      db.createObjectStore(STORES.tasks, { keyPath: "id" });
    }

    // Memory store
    if (!db.objectStoreNames.contains(STORES.memory)) {
      const memStore = db.createObjectStore(STORES.memory, { keyPath: "id" });
      memStore.createIndex("type", "type", { unique: false });
      memStore.createIndex("importance", "importance", { unique: false });
    }

    // Virtual files store
    if (!db.objectStoreNames.contains(STORES.files)) {
      db.createObjectStore(STORES.files, { keyPath: "name" });
    }
  };

  request.onsuccess = (event) => {
    const db = (event.target as IDBOpenDBRequest).result;
    dbInstance = db;
    resolve(db);
  };

  request.onerror = (event) => {
    const error = (event.target as IDBOpenDBRequest).error;
    reject(error ?? new Error("Failed to open IndexedDB"));
  };

  return promise;
}

// ── Generic helpers ─────────────────────────────────────────────────

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  const { promise, resolve, reject } = Promise.withResolvers<T[]>();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const request = store.getAll();
  request.onsuccess = () => resolve(request.result as T[]);
  request.onerror = () => reject(request.error);
  return promise;
}

async function getByKey<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  const { promise, resolve, reject } = Promise.withResolvers<T | undefined>();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const request = store.get(key);
  request.onsuccess = () => resolve(request.result as T | undefined);
  request.onerror = () => reject(request.error);
  return promise;
}

async function put<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const request = store.put(value);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
  return promise;
}

async function putAll<T>(storeName: string, values: T[]): Promise<void> {
  const db = await openDB();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const value of values) {
    store.put(value);
  }
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  return promise;
}

async function deleteKey(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const request = store.delete(key);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
  return promise;
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const request = store.clear();
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
  return promise;
}

// ── Messages API ────────────────────────────────────────────────────

export async function loadMessages(agentMode: AgentMode): Promise<Message[]> {
  const all = await getAll<StoredMessage>(STORES.messages);
  return all
    .filter((m) => m.agentMode === agentMode)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function saveMessage(agentMode: AgentMode, message: Message): Promise<void> {
  const stored: StoredMessage = { ...message, agentMode };
  await put(STORES.messages, stored);
}

export async function saveMessages(
  agentMode: AgentMode,
  messages: Message[],
): Promise<void> {
  const stored: StoredMessage[] = messages.map((m) => ({ ...m, agentMode }));
  await putAll(STORES.messages, stored);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await deleteKey(STORES.messages, messageId);
}

export async function clearMessages(agentMode: AgentMode): Promise<void> {
  const all = await getAll<StoredMessage>(STORES.messages);
  const toDelete = all.filter((m) => m.agentMode === agentMode);
  for (const msg of toDelete) {
    await deleteKey(STORES.messages, msg.id);
  }
}

// ── Settings API ────────────────────────────────────────────────────

interface SettingsRow {
  key: string;
  value: AppSettings;
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const row = await getByKey<SettingsRow>(STORES.settings, "app");
  return row?.value;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await put(STORES.settings, { key: "app", value: settings });
}

// ── Tasks API ───────────────────────────────────────────────────────

export async function loadTasks(): Promise<Task[]> {
  return getAll<Task>(STORES.tasks);
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await clearStore(STORES.tasks);
  await putAll(STORES.tasks, tasks);
}

// ── Memory API ──────────────────────────────────────────────────────

export async function loadMemory(): Promise<StoredMemoryEntry[]> {
  return getAll<StoredMemoryEntry>(STORES.memory);
}

export async function saveMemoryEntry(entry: StoredMemoryEntry): Promise<void> {
  await put(STORES.memory, entry);
}

export async function deleteMemoryEntry(id: string): Promise<void> {
  await deleteKey(STORES.memory, id);
}

export async function clearMemory(): Promise<void> {
  await clearStore(STORES.memory);
}

// ── Virtual Files API ───────────────────────────────────────────────

export async function loadFiles(): Promise<VirtualFile[]> {
  return getAll<VirtualFile>(STORES.files);
}

export async function saveFiles(files: VirtualFile[]): Promise<void> {
  await clearStore(STORES.files);
  await putAll(STORES.files, files);
}

// ── Maintenance ─────────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  const db = await openDB();
  const storeNames = Object.values(STORES);
  for (const name of storeNames) {
    await clearStore(name);
  }
}

export async function getStorageEstimate(): Promise<{
  used: number;
  quota: number;
} | null> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    };
  }
  return null;
}
