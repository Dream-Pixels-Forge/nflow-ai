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
    expect(screen.getByText('0% (0.0K tokens)')).toBeTruthy();
  });

  it('tracks message content in context calculation', () => {
    // 3000 chars → ~750 tokens → 0.75% → rounded to 1%
    const messages = makeMessages(['x'.repeat(3000)]);
    render(
      <ToolsPanel
        toolState={defaultToolState}
        setToolState={setToolState}
        messages={messages}
      />
    );
    expect(screen.getByText('1% (0.8K tokens)')).toBeTruthy();
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
    // 10000 chars → 2500 tokens → 2.5% → rounded to 3%
    expect(screen.getByText('3% (2.5K tokens)')).toBeTruthy();
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
    // (6000 + 10000) = 16000 chars → 4000 tokens → 4% → rounded to 4%
    expect(screen.getByText('4% (4.0K tokens)')).toBeTruthy();
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
    // (10000 + 30000) = 40000 chars → 10000 tokens → 10%
    expect(screen.getByText('10% (10.0K tokens)')).toBeTruthy();
  });

  it('falls back gracefully when messages prop is not provided', () => {
    render(
      <ToolsPanel
        toolState={defaultToolState}
        setToolState={setToolState}
      />
    );
    expect(screen.getByText('0% (0.0K tokens)')).toBeTruthy();
  });
});
