import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputArea } from '../../components/InputArea';
import { AgentMode } from '../../types';

// Mock the useWhisperSTT hook
vi.mock('../../src/hooks/useWhisperSTT', () => ({
  useWhisperSTT: vi.fn(() => ({
    isSupported: true,
    isModelLoading: false,
    modelLoadProgress: 0,
    isRecording: false,
    transcribedText: '',
    error: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    loadModel: vi.fn()
  }))
}));

// Mock useAgenticSystems
vi.mock('../hooks/useAgenticSystems', () => ({
  useAgenticSystems: vi.fn(() => [
    {
      isHalted: false,
      contextStatus: 'OPTIMAL',
      currentSession: null,
      emergencyEvents: []
    },
    {
      triggerEmergencyStop: vi.fn(),
      resolveEmergency: vi.fn()
    }
  ])
}));

// Mock getOllamaModels
vi.mock('../services/ollamaService', () => ({
  getOllamaModels: vi.fn().mockResolvedValue([])
}));

describe('InputArea', () => {
  const defaultProps = {
    input: '',
    setInput: vi.fn(),
    activeAgent: AgentMode.CHAT,
    isProcessing: false,
    transitionTarget: null,
    onKeyDown: vi.fn(),
    onSendMessage: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Microphone button', () => {
    it('should render microphone button when supported', () => {
      // Act
      render(<InputArea {...defaultProps} />);

      // Assert
      expect(screen.getByTitle('Voice input')).toBeInTheDocument();
    });

    it('should show recording state when recording', async () => {
      // Arrange
      const { useWhisperSTT } = await import('../../src/hooks/useWhisperSTT');
      (useWhisperSTT as any).mockReturnValue({
        isSupported: true,
        isModelLoading: false,
        modelLoadProgress: 0,
        isRecording: true,
        transcribedText: '',
        error: null,
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        loadModel: vi.fn()
      });

      // Act
      render(<InputArea {...defaultProps} />);

      // Assert
      expect(screen.getByTitle('Stop recording')).toBeInTheDocument();
    });

    it('should show loading state when model is loading', async () => {
      // Arrange
      const { useWhisperSTT } = await import('../../src/hooks/useWhisperSTT');
      (useWhisperSTT as any).mockReturnValue({
        isSupported: true,
        isModelLoading: true,
        modelLoadProgress: 50,
        isRecording: false,
        transcribedText: '',
        error: null,
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        loadModel: vi.fn()
      });

      // Act
      render(<InputArea {...defaultProps} />);

      // Assert
      expect(screen.getByText(/Loading Whisper model/)).toBeInTheDocument();
    });
  });
});
