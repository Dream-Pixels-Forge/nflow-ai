/**
 * Persistence Layer
 *
 * IndexedDB-backed storage for messages, settings, tasks, memory, and files.
 */

export {
  loadMessages,
  saveMessage,
  saveMessages,
  deleteMessage,
  clearMessages,
  loadSettings,
  saveSettings,
  loadTasks,
  saveTasks,
  loadMemory,
  saveMemoryEntry,
  deleteMemoryEntry,
  clearMemory,
  loadFiles,
  saveFiles,
  clearAll,
  getStorageEstimate,
} from "./db";
export type {
  StoredMessage,
  StoredMemoryEntry,
} from "./db";
