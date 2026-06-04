/**
 * RAGManager - Singleton for Retrieval Augmented Generation
 */

import { VectorStore } from './VectorStore';

class RAGManagerImpl {
  private store: VectorStore;
  private initialized = false;

  constructor() {
    this.store = new VectorStore();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.store.init();
    this.initialized = true;
  }

  async indexMessage(role: string, content: string, agentType?: string): Promise<void> {
    await this.init();
    if (content.length < 10) return;
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.store.addDocument(id, content, {
      type: 'message',
      role,
      agentType,
      indexedAt: new Date().toISOString(),
    });
  }

  async indexCode(filePath: string, content: string): Promise<void> {
    await this.init();
    const id = `code-${filePath}-${Date.now()}`;
    await this.store.addDocument(id, content, {
      type: 'code',
      filePath,
      indexedAt: new Date().toISOString(),
    });
  }

  searchContext(query: string, maxTokens: number = 500): string {
    const results = this.store.search(query, 5);
    if (results.length === 0) return '';

    let context = '';
    let tokenEstimate = 0;
    for (const r of results) {
      const docTokens = Math.ceil(r.text.length / 4);
      if (tokenEstimate + docTokens > maxTokens) break;
      context += `[Similarity: ${r.score.toFixed(2)}] ${r.text.slice(0, 200)}\n\n`;
      tokenEstimate += docTokens;
    }
    return context.trim();
  }

  buildAugmentedPrompt(query: string, basePrompt: string, maxContextTokens: number = 500): string {
    const ragContext = this.searchContext(query, maxContextTokens);
    if (!ragContext) return basePrompt;

    const contextSection = `\n\n## Relevant History\n${ragContext}\n\n`;
    const insertPoint = basePrompt.lastIndexOf('## Current Task');
    if (insertPoint > -1) {
      return basePrompt.slice(0, insertPoint) + contextSection + basePrompt.slice(insertPoint);
    }
    return basePrompt + contextSection;
  }

  getStats() { return this.store.getStats(); }
  getRecentDocuments(limit?: number) { return this.store.getRecentDocuments(limit); }
  async removeDocument(id: string) { this.store.removeDocument(id); }
}

export const ragManager = new RAGManagerImpl();
