import { pipeline, AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

export interface WhisperTranscriptionResult {
  text: string;
}

class WhisperService {
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null;
  private loading = false;

  async loadModel(
    modelName: string = 'Xenova/whisper-tiny',
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (this.transcriber) return;
    if (this.loading) return;

    this.loading = true;
    try {
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        modelName,
        {
          progress_callback: onProgress ? (progress: any) => {
            if (progress.status === 'progress' && progress.progress !== undefined) {
              onProgress(progress.progress);
            }
          } : undefined
        }
      ) as AutomaticSpeechRecognitionPipeline;
    } finally {
      this.loading = false;
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<WhisperTranscriptionResult> {
    if (!this.transcriber) {
      throw new Error('Whisper model not loaded');
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioData = new Float32Array(arrayBuffer);

    const result = await this.transcriber(audioData as any);
    
    return {
      text: (result as any).text || ''
    };
  }

  isLoaded(): boolean {
    return this.transcriber !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }
}

export const whisperService = new WhisperService();
