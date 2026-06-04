/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProjectManager } from '../../../components/ProjectManager';
import { Task, VirtualFile, AgentMode } from '../../../types';

describe('ProjectManager - Commit', () => {
  const mockFiles: VirtualFile[] = [
    { name: 'test.ts', content: 'const x = 1;', language: 'typescript', status: 'modified' },
    { name: 'new.ts', content: 'const y = 2;', language: 'typescript', status: 'new' },
  ];

  const mockProps = {
    onClose: vi.fn(),
    tasks: [],
    agentHistories: {},
    files: mockFiles,
    onCommit: vi.fn(),
  };

  it('should call onCommit with committed file names when commit is made', () => {
    render(<ProjectManager {...mockProps} />);
    
    // Find the commit textarea and enter a message
    const textarea = screen.getByPlaceholderText('Message (Enter to commit)');
    fireEvent.change(textarea, { target: { value: 'Initial commit message' } });
    
    // Find the commit button by looking for the Check icon container
    // The commit button is the one that contains "Commit" text and is not disabled
    const buttons = screen.getAllByRole('button');
    const commitButton = buttons.find(btn => 
      btn.textContent?.includes('Commit') && !(btn as HTMLButtonElement).disabled
    );
    expect(commitButton).toBeTruthy();
    fireEvent.click(commitButton!);
    
    // onCommit should be called with the file names
    expect(mockProps.onCommit).toHaveBeenCalledWith(['test.ts', 'new.ts']);
  });

  it('should not call onCommit when commit message is empty', () => {
    render(<ProjectManager {...mockProps} />);
    
    const buttons = screen.getAllByRole('button');
    const commitButton = buttons.find(btn => 
      btn.textContent?.includes('Commit') && !(btn as HTMLButtonElement).disabled
    );
    // Button should be disabled when no commit message
    expect(commitButton).toBeFalsy();
  });
});
