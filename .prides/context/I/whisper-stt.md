# Whisper STT for Voice Input

## Task
Replace the Web Speech API (Chrome-only) with local Whisper model for speech-to-text, making voice input work cross-browser.

## Existing Code
- `components/InputArea.tsx`: Currently uses `window.SpeechRecognition` / `webkitSpeechRecognition` — Chrome/Edge only.
- Voice button is disabled on non-Chrome browsers with tooltip.

## Requirements
1. Create `src/services/whisperService.ts`:
   - Use Transformers.js (`@huggingface/transformers`) for local Whisper inference
   - Load `WhisperModel` with `quantized: true` for small bundle
   - `transcribe(audioBlob: Blob)`: returns `{ text, segments, language }`
   - Model loading: lazy, show loading state
   - Support for WebM/OGG audio formats (from MediaRecorder API)

2. Create `src/hooks/useWhisperSTT.ts`:
   - `isSupported`: true if MediaRecorder available (all modern browsers)
   - `isModelLoading`: true while Whisper model loads
   - `isRecording`: currently recording
   - `transcribedText`: latest transcription result
   - `startRecording()`: begin capturing audio via MediaRecorder
   - `stopRecording()`: stop capture, send to Whisper, return text
   - `loadModel()`: manually trigger model preload

3. Update `components/InputArea.tsx`:
   - Replace `SpeechRecognitionAPI` with `useWhisperSTT` hook
   - Remove Chrome-only restriction
   - Show "Loading model..." state while Whisper loads
   - Show recording timer with waveform visualization (simple CSS)
   - Append transcribed text to input (same as current behavior)

4. Add model caching:
   - Cache Whisper model in browser cache (Transformers.js handles this)
   - Show model size (~150MB for tiny model, ~300MB for base)
   - Let user choose model size in settings: tiny (fast) / base (accurate)

## Audio Capture Flow
```
MediaRecorder.start() → collect chunks → MediaRecorder.stop()
→ Blob → whisperService.transcribe() → text
```

## Settings Update
Add to `AppSettings`:
```typescript
whisperModel: 'tiny' | 'base';
```

## Constraints
- No server required (runs entirely in browser via WASM)
- Must handle model download progress
- Graceful fallback to Web Speech API if available
- Show clear UI feedback during model load
