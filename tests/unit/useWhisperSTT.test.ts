import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWhisperSTT } from '../../src/hooks/useWhisperSTT';

// Mock whisperService
vi.mock('../../src/services/whisperService', () => ({
  whisperService: {
    loadModel: vi.fn().mockResolvedValue(undefined),
    transcribeAudio: vi.fn().mockResolvedValue({ text: 'Transcribed text' }),
    isLoaded: vi.fn().mockReturnValue(false),
    isLoading: vi.fn().mockReturnValue(false)
  }
}));

// Mock MediaRecorder class
class MockMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);
  ondataavailable: ((event: any) => void) | null = null;
  onstop: (() => void) | null = null;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: any;

  constructor(stream: any) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }
}

describe('useWhisperSTT', () => {
  const originalMediaRecorder = window.MediaRecorder;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up MediaRecorder in global scope
    (window as any).MediaRecorder = MockMediaRecorder;
  });

  afterEach(() => {
    // Restore original MediaRecorder
    if (originalMediaRecorder) {
      (window as any).MediaRecorder = originalMediaRecorder;
    } else {
      delete (window as any).MediaRecorder;
    }
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('should return true when MediaRecorder is available', () => {
      // Act
      const { result } = renderHook(() => useWhisperSTT());

      // Assert
      expect(result.current.isSupported).toBe(true);
    });

    it('should return false when MediaRecorder is not available', () => {
      // Arrange
      delete (window as any).MediaRecorder;

      // Act
      const { result } = renderHook(() => useWhisperSTT());

      // Assert
      expect(result.current.isSupported).toBe(false);
    });
  });

  describe('isModelLoading', () => {
    it('should be false initially', () => {
      // Act
      const { result } = renderHook(() => useWhisperSTT());

      // Assert
      expect(result.current.isModelLoading).toBe(false);
    });
  });

  describe('modelLoadProgress', () => {
    it('should be 0 initially', () => {
      // Act
      const { result } = renderHook(() => useWhisperSTT());

      // Assert
      expect(result.current.modelLoadProgress).toBe(0);
    });
  });

  describe('isRecording', () => {
    it('should be false initially', () => {
      // Act
      const { result } = renderHook(() => useWhisperSTT());

      // Assert
      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('transcribedText', () => {
    it('should be empty initially', () => {
      // Act
      const { result } = renderHook(() => useWhisperSTT());

      // Assert
      expect(result.current.transcribedText).toBe('');
    });
  });

  describe('error', () => {
    it('should be null initially', () => {
      // Act
      const { result } = renderHook(() => useWhisperSTT());

      // Assert
      expect(result.current.error).toBeNull();
    });
  });
});
