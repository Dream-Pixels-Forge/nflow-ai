import { useState, useCallback, useRef } from 'react';
import { whisperService } from '../services/whisperService';

export interface UseWhisperSTTReturn {
  isSupported: boolean;
  isModelLoading: boolean;
  modelLoadProgress: number;
  isRecording: boolean;
  transcribedText: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  loadModel: () => Promise<void>;
}

export function useWhisperSTT(): UseWhisperSTTReturn {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isSupported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const loadModel = useCallback(async () => {
    if (whisperService.isLoaded()) return;
    if (isModelLoading) return;

    setIsModelLoading(true);
    setModelLoadProgress(0);
    setError(null);

    try {
      await whisperService.loadModel(
        'Xenova/whisper-tiny',
        (progress) => {
          setModelLoadProgress(progress);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setIsModelLoading(false);
    }
  }, [isModelLoading]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('MediaRecorder not supported');
      return;
    }

    if (isRecording) return;

    // Load model if not loaded
    if (!whisperService.isLoaded()) {
      await loadModel();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [isSupported, isRecording, loadModel]);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        setError('No active recording');
        resolve('');
        return;
      }

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const result = await whisperService.transcribeAudio(audioBlob);
          setTranscribedText(result.text);
          resolve(result.text);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Transcription failed';
          setError(errorMsg);
          reject(new Error(errorMsg));
        } finally {
          setIsRecording(false);
          // Stop all tracks
          mediaRecorder.stream?.getTracks().forEach(track => track.stop());
          mediaRecorderRef.current = null;
          chunksRef.current = [];
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  return {
    isSupported,
    isModelLoading,
    modelLoadProgress,
    isRecording,
    transcribedText,
    error,
    startRecording,
    stopRecording,
    loadModel
  };
}
