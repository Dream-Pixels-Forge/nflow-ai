/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectManager } from '../../../components/ProjectManager';

describe('ProjectManager', () => {
  const mockProps = {
    onClose: () => {},
    tasks: [],
    agentHistories: {},
    files: []
  };

  it('should display "IDE BRIDGE" as the sidebar header', () => {
    render(<ProjectManager {...mockProps} />);
    expect(screen.getByText('IDE BRIDGE')).toBeInTheDocument();
  });

  it('should display "Connect to any IDE" as the subtitle', () => {
    render(<ProjectManager {...mockProps} />);
    expect(screen.getByText('Connect to any IDE')).toBeInTheDocument();
  });

  it('should NOT display "Nexus Bridge"', () => {
    render(<ProjectManager {...mockProps} />);
    expect(screen.queryByText('Nexus Bridge')).not.toBeInTheDocument();
  });
});
