/**
 * useMemory - Custom hook for Persistent Memory System
 * 
 * Provides unified interface for memory storage and retrieval
 */

import { useState, useEffect, useCallback } from 'react';
import {
  memoryManager,
  MemoryEntry,
  MemoryType,
  MemoryQuery,
  MemoryStats
} from '../src/agentic';

export interface MemoryState {
  // Entries
  recentMemories: MemoryEntry[];
  importantMemories: MemoryEntry[];
  
  // Search
  searchResults: MemoryEntry[];
  
  // Stats
  stats: MemoryStats;
  
  // Query state
  lastQuery: MemoryQuery | null;
}

export interface MemoryActions {
  // CRUD
  addMemory: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount'>) => MemoryEntry;
  getMemory: (id: string) => MemoryEntry | undefined;
  updateMemory: (id: string, updates: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>) => MemoryEntry | null;
  deleteMemory: (id: string) => boolean;
  
  // Search
  searchMemories: (query: MemoryQuery) => MemoryEntry[];
  getMemoriesByType: (type: MemoryType) => MemoryEntry[];
  getMemoriesByTag: (tag: string) => MemoryEntry[];
  
  // Convenience
  addDecision: (content: string, tags?: string[], importance?: MemoryEntry['importance']) => MemoryEntry;
  addLearning: (content: string, tags?: string[], importance?: MemoryEntry['importance']) => MemoryEntry;
  addPreference: (content: string, tags?: string[], importance?: MemoryEntry['importance']) => MemoryEntry;
  addError: (content: string, tags?: string[], importance?: MemoryEntry['importance']) => MemoryEntry;
  addSuccess: (content: string, tags?: string[], importance?: MemoryEntry['importance']) => MemoryEntry;
  
  // Export/Import
  exportMemories: () => MemoryEntry[];
  importMemories: (memories: MemoryEntry[]) => number;
  
  // Maintenance
  cleanup: () => number;
  clear: () => void;
}

export function useMemory(): [MemoryState, MemoryActions] {
  // State
  const [recentMemories, setRecentMemories] = useState<MemoryEntry[]>([]);
  const [importantMemories, setImportantMemories] = useState<MemoryEntry[]>([]);
  const [searchResults, setSearchResults] = useState<MemoryEntry[]>([]);
  const [lastQuery, setLastQuery] = useState<MemoryQuery | null>(null);

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setRecentMemories(memoryManager.getRecentMemories(10));
      setImportantMemories(memoryManager.getImportantMemories(10));
    };

    updateState();
    const interval = setInterval(updateState, 10000);

    return () => clearInterval(interval);
  }, []);

  // CRUD actions
  const addMemory = useCallback((entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount'>) => {
    const memory = memoryManager.addMemory(entry);
    setRecentMemories(memoryManager.getRecentMemories(10));
    setImportantMemories(memoryManager.getImportantMemories(10));
    return memory;
  }, []);

  const getMemory = useCallback((id: string) => {
    return memoryManager.getMemory(id);
  }, []);

  const updateMemory = useCallback((id: string, updates: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>) => {
    const memory = memoryManager.updateMemory(id, updates);
    setRecentMemories(memoryManager.getRecentMemories(10));
    setImportantMemories(memoryManager.getImportantMemories(10));
    return memory;
  }, []);

  const deleteMemory = useCallback((id: string) => {
    const result = memoryManager.deleteMemory(id);
    setRecentMemories(memoryManager.getRecentMemories(10));
    setImportantMemories(memoryManager.getImportantMemories(10));
    return result;
  }, []);

  // Search actions
  const searchMemories = useCallback((query: MemoryQuery) => {
    setLastQuery(query);
    const results = memoryManager.searchMemories(query);
    setSearchResults(results);
    return results;
  }, []);

  const getMemoriesByType = useCallback((type: MemoryType) => {
    return memoryManager.getMemoriesByType(type);
  }, []);

  const getMemoriesByTag = useCallback((tag: string) => {
    return memoryManager.getMemoriesByTag(tag);
  }, []);

  // Convenience actions
  const addDecision = useCallback((content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'medium') => {
    return addMemory({ type: 'decision', content, tags, importance, metadata: {}, relatedEntries: [] });
  }, [addMemory]);

  const addLearning = useCallback((content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'medium') => {
    return addMemory({ type: 'learning', content, tags, importance, metadata: {}, relatedEntries: [] });
  }, [addMemory]);

  const addPreference = useCallback((content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'low') => {
    return addMemory({ type: 'preference', content, tags, importance, metadata: {}, relatedEntries: [] });
  }, [addMemory]);

  const addError = useCallback((content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'high') => {
    return addMemory({ type: 'error', content, tags, importance, metadata: {}, relatedEntries: [] });
  }, [addMemory]);

  const addSuccess = useCallback((content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'medium') => {
    return addMemory({ type: 'success', content, tags, importance, metadata: {}, relatedEntries: [] });
  }, [addMemory]);

  // Export/Import
  const exportMemories = useCallback(() => {
    return memoryManager.exportMemories();
  }, []);

  const importMemories = useCallback((memories: MemoryEntry[]) => {
    const imported = memoryManager.importMemories(memories);
    setRecentMemories(memoryManager.getRecentMemories(10));
    setImportantMemories(memoryManager.getImportantMemories(10));
    return imported;
  }, []);

  // Maintenance
  const cleanup = useCallback(() => {
    const cleaned = memoryManager.cleanup();
    setRecentMemories(memoryManager.getRecentMemories(10));
    setImportantMemories(memoryManager.getImportantMemories(10));
    return cleaned;
  }, []);

  const clear = useCallback(() => {
    memoryManager.clear();
    setRecentMemories([]);
    setImportantMemories([]);
    setSearchResults([]);
  }, []);

  const state: MemoryState = {
    recentMemories,
    importantMemories,
    searchResults,
    stats: memoryManager.getStats(),
    lastQuery
  };

  const actions: MemoryActions = {
    addMemory,
    getMemory,
    updateMemory,
    deleteMemory,
    searchMemories,
    getMemoriesByType,
    getMemoriesByTag,
    addDecision,
    addLearning,
    addPreference,
    addError,
    addSuccess,
    exportMemories,
    importMemories,
    cleanup,
    clear
  };

  return [state, actions];
}
