/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubPanel } from '../../../components/GitHubPanel';
import { AppSettings } from '../../../types';

describe('GitHubPanel', () => {
  const defaultSettings: AppSettings = {
    suggestionLevel: 'medium',
    soundEnabled: true,
    autoScroll: true,
    animations: true,
    chatMode: 'agent',
    aiProvider: 'gemini',
    ollamaUrl: 'http://localhost:11434',
    ollamaGeneralModel: 'llama2',
    ollamaCodingModel: 'codellama',
    githubToken: undefined,
    githubOwner: undefined,
    githubRepo: undefined
  };

  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when not connected', () => {
    it('should render the local git fallback section', () => {
      render(<GitHubPanel settings={defaultSettings} onUpdate={onUpdate} />);
      expect(screen.getByText('Or Use Local Git')).toBeInTheDocument();
    });

    it('should render the USE LOCAL GIT button', () => {
      render(<GitHubPanel settings={defaultSettings} onUpdate={onUpdate} />);
      expect(screen.getByText('USE LOCAL GIT')).toBeInTheDocument();
    });

    it('should call onUpdate with local settings when USE LOCAL GIT is clicked', () => {
      render(<GitHubPanel settings={defaultSettings} onUpdate={onUpdate} />);
      fireEvent.click(screen.getByText('USE LOCAL GIT'));
      expect(onUpdate).toHaveBeenCalledWith({
        ...defaultSettings,
        githubOwner: 'local',
        githubRepo: 'repository'
      });
    });
  });

  describe('when connected', () => {
    const connectedSettings: AppSettings = {
      ...defaultSettings,
      githubToken: 'ghp_test',
      githubOwner: 'testowner',
      githubRepo: 'testrepo'
    };

    it('should not render the local git fallback section', () => {
      render(<GitHubPanel settings={connectedSettings} onUpdate={onUpdate} />);
      expect(screen.queryByText('Or Use Local Git')).not.toBeInTheDocument();
    });
  });
});