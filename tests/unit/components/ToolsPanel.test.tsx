/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolsPanel } from '../../../components/ToolsPanel';
import { ToolState, Message, AgentMode } from '../../../types';

// Mock hooks used by ToolsPanel
vi.mock('../../../hooks/useMCP', () => ({
  useMCP: () => [
    {
      servers: [],
      connectedServers: [],
      allTools: [],
      connections: [],
      stats: { totalServers: 0, connectedServers: 0, totalTools: 0, totalConnections: 0, totalRequests: 0, totalErrors: 0 }
    },
    { registerServer: vi.fn(), connectToServer: vi.fn(), disconnectFromServer: vi.fn(), discoverTools: vi.fn(), callTool: vi.fn(), findServersByCapability: vi.fn(), findServersWithTool: vi.fn() }
  ]
}));

vi.mock('../../../hooks/useA2A', () => ({
  useA2A: () => [
    {
      registeredAgents: [],
      discoveredAgents: [],
      activeTasks: [],
      completedTasks: [],
      failedTasks: [],
      activeConnections: 0,
      lastEvent: null,
      stats: { agents: 0, tasks: 0, connections: 0 }
    },
    { registerAgent: vi.fn(), discoverAgents: vi.fn(), negotiateCapabilities: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), completeTask: vi.fn(), failTask: vi.fn(), cancelTask: vi.fn(), connectToTask: vi.fn(), disconnectFromTask: vi.fn() }
  ]
}));

vi.mock('../../../hooks/useMemory', () => ({
  useMemory: () => [
    {
      recentMemories: [],
      importantMemories: [],
      searchResults: [],
      stats: { totalEntries: 0, totalAccessCount: 0, entriesByType: {}, entriesByImportance: {} },
      lastQuery: null
    },
    { addMemory: vi.fn(), getMemory: vi.fn(), updateMemory: vi.fn(), deleteMemory: vi.fn(), searchMemories: vi.fn(), getMemoriesByType: vi.fn(), getMemoriesByTag: vi.fn(), addDecision: vi.fn(), addLearning: vi.fn(), addPreference: vi.fn(), addError: vi.fn(), addSuccess: vi.fn(), exportMemories: vi.fn(), importMemories: vi.fn(), cleanup: vi.fn(), clear: vi.fn() }
  ]
}));

const defaultToolState: ToolState = {
  mcp: { active: false, port: '8080' },
  rag: { active: true, content: [] },
  fetch: { active: false, targetUrl: '' },
  doc: { active: false, files: [] }
};

const makeMessages = (texts: string[]): Message[] =>
  texts.map((content, i) => ({
    id: `msg-${i}`,
    role: 'user' as const,
    content,
    timestamp: Date.now(),
    agent: AgentMode.CHAT
  }));

describe('ToolsPanel - Context Window', () => {
  const setToolState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows 0% when no messages and no RAG content', () => {
    render(
      <ToolsPanel
        toolState={defaultToolState}
        setToolState={setToolState}
        messages={[]}
      />
    );
    expect(screen.getByText('0% (0K chars)')).toBeTruthy();
  });

  it('tracks message content in context calculation', () => {
    // 3000 chars of messages should show ~9% (3000 / 32000 * 100)
    const messages = makeMessages(['x'.repeat(3000)]);
    render(
      <ToolsPanel
        toolState={defaultToolState}
        setToolState={setToolState}
        messages={messages}
      />
    );
    // 3000 / 32000 = 0.09375 -> 9%
    expect(screen.getByText('9% (3K chars)')).toBeTruthy();
  });

  it('includes RAG content in context calculation', () => {
    const toolStateWithRag: ToolState = {
      ...defaultToolState,
      rag: { active: true, content: ['x'.repeat(10000)] }
    };
    render(
      <ToolsPanel
        toolState={toolStateWithRag}
        setToolState={setToolState}
        messages={[]}
      />
    );
    // 10000 / 32000 = 0.3125 -> 31%
    expect(screen.getByText('31% (10K chars)')).toBeTruthy();
  });

  it('combines messages and RAG content for total context', () => {
    const toolStateWithRag: ToolState = {
      ...defaultToolState,
      rag: { active: true, content: ['x'.repeat(10000)] }
    };
    const messages = makeMessages(['x'.repeat(6000)]);
    render(
      <ToolsPanel
        toolState={toolStateWithRag}
        setToolState={setToolState}
        messages={messages}
      />
    );
    // (6000 + 10000) / 32000 = 0.5 -> 50%
    expect(screen.getByText('50% (16K chars)')).toBeTruthy();
  });

  it('caps at 100% when context exceeds limit', () => {
    const toolStateWithRag: ToolState = {
      ...defaultToolState,
      rag: { active: true, content: ['x'.repeat(30000)] }
    };
    const messages = makeMessages(['x'.repeat(10000)]);
    render(
      <ToolsPanel
        toolState={toolStateWithRag}
        setToolState={setToolState}
        messages={messages}
      />
    );
    // (10000 + 30000) / 32000 = 1.25 -> capped at 100%
    expect(screen.getByText('100% (40K chars)')).toBeTruthy();
  });

  it('falls back gracefully when messages prop is not provided', () => {
    render(
      <ToolsPanel
        toolState={defaultToolState}
        setToolState={setToolState}
      />
    );
    expect(screen.getByText('0% (0K chars)')).toBeTruthy();
  });
});
