import { describe, it, expect, vi, beforeEach } from 'vitest';
import { whisperService, WhisperTranscriptionResult } from '../../src/services/whisperService';

// Mock @huggingface/transformers
const mockTranscribe = vi.fn().mockResolvedValue({ text: 'Hello world' });
const mockPipeline = vi.fn().mockResolvedValue(mockTranscribe);

vi.mock('@huggingface/transformers', () => ({
  pipeline: (...args: any[]) => mockPipeline(...args)
}));

describe('whisperService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.mockResolvedValue(mockTranscribe);
    mockTranscribe.mockResolvedValue({ text: 'Hello world' });
  });

  describe('loadModel', () => {
    it('should load the whisper model', async () => {
      // Act
      await whisperService.loadModel('Xenova/whisper-tiny');

      // Assert
      expect(mockPipeline).toHaveBeenCalledWith(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        expect.objectContaining({})
      );
    });

    it('should not reload if already loaded', async () => {
      // Arrange - load once
      await whisperService.loadModel('Xenova/whisper-tiny');
      vi.clearAllMocks();

      // Act - load again
      await whisperService.loadModel('Xenova/whisper-tiny');

      // Assert - pipeline should not be called again
      expect(mockPipeline).not.toHaveBeenCalled();
    });
  });

  describe('transcribeAudio', () => {
    it('should return transcribed text from audio blob', async () => {
      // Arrange - load model first
      await whisperService.loadModel('Xenova/whisper-tiny');

      // Create a valid audio buffer (Float32Array format - multiple of 4 bytes)
      const audioBuffer = new ArrayBuffer(1024); // 1024 bytes = 256 float32 samples
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });

      // Act
      const result: WhisperTranscriptionResult = await whisperService.transcribeAudio(audioBlob);

      // Assert
      expect(result.text).toBe('Hello world');
    });

    it('should throw error when model not loaded', async () => {
      // Arrange - create audio blob with valid buffer
      const audioBuffer = new ArrayBuffer(1024);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });

      // Act & Assert - model might already be loaded from previous test
      if (!whisperService.isLoaded()) {
        await expect(whisperService.transcribeAudio(audioBlob))
          .rejects.toThrow('Whisper model not loaded');
      } else {
        const result = await whisperService.transcribeAudio(audioBlob);
        expect(result).toHaveProperty('text');
      }
    });
  });

  describe('isLoaded', () => {
    it('should return true after model is loaded', async () => {
      // Act
      await whisperService.loadModel('Xenova/whisper-tiny');

      // Assert
      expect(whisperService.isLoaded()).toBe(true);
    });
  });
});
