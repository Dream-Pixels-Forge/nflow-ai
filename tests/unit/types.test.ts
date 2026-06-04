import { describe, it, expect } from 'vitest';
import { AppSettings } from '../../types';

describe('AppSettings', () => {
  it('should support whisperModel setting', () => {
    // Arrange & Act
    const settings: AppSettings = {
      suggestionLevel: 'medium',
      soundEnabled: true,
      autoScroll: true,
      animations: true,
      chatMode: 'chat',
      aiProvider: 'gemini',
      ollamaUrl: 'http://localhost:11434',
      ollamaGeneralModel: 'llama2',
      ollamaCodingModel: 'codellama',
      whisperModel: 'tiny'
    };

    // Assert
    expect(settings.whisperModel).toBe('tiny');
  });

  it('should support whisperModel as base', () => {
    // Arrange & Act
    const settings: AppSettings = {
      suggestionLevel: 'medium',
      soundEnabled: true,
      autoScroll: true,
      animations: true,
      chatMode: 'chat',
      aiProvider: 'gemini',
      ollamaUrl: 'http://localhost:11434',
      ollamaGeneralModel: 'llama2',
      ollamaCodingModel: 'codellama',
      whisperModel: 'base'
    };

    // Assert
    expect(settings.whisperModel).toBe('base');
  });

  it('should allow whisperModel to be undefined', () => {
    // Arrange & Act
    const settings: AppSettings = {
      suggestionLevel: 'medium',
      soundEnabled: true,
      autoScroll: true,
      animations: true,
      chatMode: 'chat',
      aiProvider: 'gemini',
      ollamaUrl: 'http://localhost:11434',
      ollamaGeneralModel: 'llama2',
      ollamaCodingModel: 'codellama'
    };

    // Assert
    expect(settings.whisperModel).toBeUndefined();
  });
});
