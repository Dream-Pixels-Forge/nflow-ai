/**
 * VectorStore - In-memory vector store with IndexedDB persistence
 */

import { EmbeddingService } from './EmbeddingService';

export interface StoredDocument {
  id: string;
  text: string;
  vector: [string, number][];
  metadata: Record<string, unknown>;
  indexedAt: string;
}

const DB_NAME = 'nflow-rag';
const DB_VERSION = 1;
const STORE_NAME = 'rag-store';

export class VectorStore {
  private docs: Map<string, StoredDocument> = new Map();
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  async init(): Promise<void> {
    await this.loadFromDB();
    this.rebuildVocab();
  }

  private rebuildVocab(): void {
    const texts = Array.from(this.docs.values()).map(d => d.text);
    if (texts.length > 0) {
      this.embeddingService.buildVocabulary(texts);
    }
  }

  async addDocument(id: string, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
    // Add to vocabulary
    this.embeddingService.buildVocabulary([
      ...Array.from(this.docs.values()).map(d => d.text),
      text,
    ]);

    const vector = this.embeddingService.embed(text);
    const vectorArr: [string, number][] = [];
    for (const [k, v] of vector) vectorArr.push([k, v]);

    this.docs.set(id, {
      id,
      text,
      vector: vectorArr,
      metadata,
      indexedAt: new Date().toISOString(),
    });

    await this.persist();
  }

  search(query: string, topK: number = 5): Array<{ id: string; text: string; score: number; metadata: Record<string, unknown> }> {
    const queryVector = this.embeddingService.embed(query);
    const results: Array<{ id: string; text: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const doc of this.docs.values()) {
      const docVector = new Map(doc.vector);
      const score = EmbeddingService.cosineSimilarity(queryVector, docVector);
      if (score > 0.05) {
        results.push({ id: doc.id, text: doc.text, score, metadata: doc.metadata });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  removeDocument(id: string): void {
    this.docs.delete(id);
    this.rebuildVocab();
    this.persist();
  }

  getStats(): { totalDocs: number; vocabSize: number } {
    return { totalDocs: this.docs.size, vocabSize: this.embeddingService.getVocabSize() };
  }

  getRecentDocuments(limit: number = 10): StoredDocument[] {
    return Array.from(this.docs.values())
      .sort((a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime())
      .slice(0, limit);
  }

  private async persist(): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key: 'documents', value: Array.from(this.docs.entries()) });
      store.put({ key: 'vocabulary', value: this.embeddingService.toSerializable() });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch { /* IndexedDB unavailable */ }
  }

  private async loadFromDB(): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const docsReq = store.get('documents');
      const vocabReq = store.get('vocabulary');
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          if (docsReq.result) this.docs = new Map(docsReq.result.value);
          if (vocabReq.result) this.embeddingService.fromSerializable(vocabReq.result.value);
          db.close();
          resolve();
        };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch { /* first run */ }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
    });
  }
}
