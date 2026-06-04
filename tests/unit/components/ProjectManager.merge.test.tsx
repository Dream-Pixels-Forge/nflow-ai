/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectManager } from '../../../components/ProjectManager';
import { Task, VirtualFile, AgentMode } from '../../../types';

describe('ProjectManager - Merge to Main', () => {
  const mockFiles: VirtualFile[] = [
    { name: 'test.ts', content: 'const x = 1;', language: 'typescript', status: 'modified' },
  ];

  it('should call onMerge when MERGE TO MAIN is clicked and canMerge is true', () => {
    const onMerge = vi.fn();
    render(
      <ProjectManager
        onClose={vi.fn()}
        tasks={[]}
        agentHistories={{}}
        files={mockFiles}
        onMerge={onMerge}
      />
    );
    
    // When no pending tests/security tasks, MERGE TO MAIN should be visible
    const buttons = screen.getAllByRole('button');
    const mergeButton = buttons.find(btn => btn.textContent?.includes('MERGE TO MAIN'));
    expect(mergeButton).toBeTruthy();
    expect((mergeButton as HTMLButtonElement).disabled).toBe(false);
    
    fireEvent.click(mergeButton!);
    expect(onMerge).toHaveBeenCalledTimes(1);
  });

  it('should show MERGE BLOCKED when there are pending tests', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Run tests', status: 'idle', agent: AgentMode.TEST },
    ];
    render(
      <ProjectManager
        onClose={vi.fn()}
        tasks={tasks}
        agentHistories={{}}
        files={mockFiles}
        onMerge={vi.fn()}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const blockedButton = buttons.find(btn => btn.textContent?.includes('MERGE BLOCKED'));
    expect(blockedButton).toBeTruthy();
    expect((blockedButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('should show MERGE BLOCKED when there are pending security tasks', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Security review', status: 'in-progress', agent: AgentMode.SECURE },
    ];
    render(
      <ProjectManager
        onClose={vi.fn()}
        tasks={tasks}
        agentHistories={{}}
        files={mockFiles}
        onMerge={vi.fn()}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const blockedButton = buttons.find(btn => btn.textContent?.includes('MERGE BLOCKED'));
    expect(blockedButton).toBeTruthy();
    expect((blockedButton as HTMLButtonElement).disabled).toBe(true);
  });
});
