import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic,
  MicOff,
  StopCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  FileText,
  Image,
  File
} from 'lucide-react';
import { AGENTS, AgentMode } from '../types';
import { useAgenticSystems } from '../hooks/useAgenticSystems';

interface AttachedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'text' | 'image' | 'other';
}

interface InputAreaProps {
  input: string;
  setInput: (input: string) => void;
  activeAgent: AgentMode;
  isProcessing: boolean;
  transitionTarget: AgentMode | null;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSendMessage: () => void;
  onFilesAttached?: (files: File[]) => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  activeAgent,
  isProcessing,
  transitionTarget,
  onKeyDown,
  onSendMessage,
  onFilesAttached
}) => {
  // Agentic systems
  const [agenticState, agenticActions] = useAgenticSystems();
  const { isHalted, contextStatus, currentSession } = agenticState;
  
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleEmergencyStop = async () => {
    if (!emergencyReason.trim()) return;
    
    await agenticActions.triggerEmergencyStop(
      activeAgent,
      'critical',
      emergencyReason
    );
    
    setEmergencyReason('');
    setShowEmergencyPanel(false);
  };

  const handleResolveEmergency = () => {
    const unresolved = agenticState.emergencyEvents.find(e => !e.resolved);
    if (unresolved) {
      agenticActions.resolveEmergency(unresolved.id);
    }
  };

  // File attachment handlers
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachedFiles: AttachedFile[] = [];
    
    Array.from(files).forEach(file => {
      const attachedFile: AttachedFile = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|js|ts|tsx|css|html|py|java|cpp|c|h|hpp|rb|go|rs|swift|kt|sql|yaml|yml|xml|csv|log)$/i) ? 'text' : 'other'
      };

      // Create preview for images
      if (attachedFile.type === 'image') {
        const reader = new FileReader();
        reader.onload = (event) => {
          attachedFile.preview = event.target?.result as string;
          setAttachedFiles(prev => [...prev, attachedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        newAttachedFiles.push(attachedFile);
      }
    });

    if (newAttachedFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachedFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Microphone/Speech-to-text handlers
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    // Check for Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      // Fallback: Use MediaRecorder for audio recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          // You could send this to a speech-to-text API
          console.log('Audio recorded:', audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (error) {
        console.error('Microphone access denied:', error);
        alert('Microphone access denied. Please allow microphone access to use voice input.');
      }
    } else {
      // Use Web Speech API for speech-to-text
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = input;

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            setInput(finalTranscript.trim());
          } else {
            interimTranscript += transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine if input should be disabled
  const isInputDisabled = !!transitionTarget || isHalted;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isInputDisabled && !isProcessing && (input.trim() || attachedFiles.length > 0)) {
        handleSendWithFiles();
      }
    }
  };

  const handleSendWithFiles = () => {
    if (attachedFiles.length > 0 && onFilesAttached) {
      onFilesAttached(attachedFiles.map(af => af.file));
      setAttachedFiles([]);
    }
    onSendMessage();
  };

  const getFileIcon = (type: AttachedFile['type']) => {
    switch (type) {
      case 'image': return <Image size={12} />;
      case 'text': return <FileText size={12} />;
      default: return <File size={12} />;
    }
  };

  return (
    <div className="px-4 pb-4 pt-2 flex justify-center">
      <div className="w-full max-w-[1000px]">
      {/* Emergency Panel */}
      {showEmergencyPanel && (
        <div className="mb-3 p-4 bg-red-950/50 border border-red-500/30 rounded-sm">
          <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-3">
            <AlertTriangle size={16} />
            <span>Emergency Stop</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              placeholder="Reason for emergency stop..."
              className="flex-1 bg-black/50 border border-red-500/20 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleEmergencyStop()}
            />
            <button
              onClick={handleEmergencyStop}
              disabled={!emergencyReason.trim()}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-sm transition-colors"
            >
              HALT
            </button>
            <button
              onClick={() => setShowEmergencyPanel(false)}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-400 text-sm rounded-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* System Halted Banner */}
      {isHalted && (
        <div className="mb-3 p-4 bg-red-950/50 border border-red-500/30 rounded-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
              <XCircle size={16} />
              <span>System Halted - Emergency Stop Active</span>
            </div>
            <button
              onClick={handleResolveEmergency}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-sm transition-colors flex items-center gap-2"
            >
              <CheckCircle size={14} />
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Context Status */}
      {currentSession && (
        <div className="mb-2 flex items-center gap-4 text-xs text-gray-500">
          <span>Session: {currentSession.id.slice(0, 12)}...</span>
          <span className={
            contextStatus === 'OPTIMAL' ? 'text-green-500' :
            contextStatus === 'WARNING' ? 'text-yellow-500' :
            contextStatus === 'CRITICAL' ? 'text-orange-500' :
            'text-red-500'
          }>
            Context: {contextStatus}
          </span>
          <span>{Math.round((currentSession.tokenCount / currentSession.maxTokens) * 100)}% used</span>
        </div>
      )}

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachedFiles.map((af) => (
            <div
              key={af.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-sm text-xs"
            >
              {af.preview ? (
                <img src={af.preview} alt="" className="w-8 h-8 object-cover rounded" />
              ) : (
                <span className="text-gray-400">{getFileIcon(af.type)}</span>
              )}
              <span className="text-gray-300 max-w-[120px] truncate">{af.file.name}</span>
              <button
                onClick={() => removeAttachedFile(af.id)}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modern Input Container */}
      <div className={`relative bg-zinc-900 border rounded-sm shadow-lg transition-all duration-200 ${
        isInputDisabled 
          ? 'border-red-500/30 opacity-60' 
          : 'border-zinc-700/50 focus-within:border-zinc-500 focus-within:shadow-zinc-500/10'
      }`}>
        {/* Textarea - Top */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isHalted ? 'System halted - resume to continue' : `Message ${AGENTS[activeAgent].name}...`}
            className="w-full bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none px-4 pt-4 pb-2 text-sm leading-relaxed"
            rows={2}
            disabled={isInputDisabled}
            autoFocus
          />
          
          {/* Agent Indicator */}
          <div className="absolute top-4 left-0 pointer-events-none">
            <span className={`text-sm font-bold ${AGENTS[activeAgent].color}`}>›</span>
          </div>
        </div>

        {/* Action Buttons - Bottom */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {/* Left Actions */}
          <div className="flex items-center gap-1">
            {/* Attach File Button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept=".txt,.md,.json,.js,.ts,.tsx,.css,.html,.py,.java,.cpp,.c,.h,.hpp,.rb,.go,.rs,.swift,.kt,.sql,.yaml,.yml,.xml,.csv,.log,.png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx"
            />
            <button
              onClick={handleFileClick}
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-zinc-800 rounded-sm transition-colors"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            
            {/* Microphone Button */}
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-sm transition-colors ${
                isRecording 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-zinc-800'
              }`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            
            {/* Recording Indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-mono">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>{formatRecordingTime(recordingTime)}</span>
              </div>
            )}
            
            {/* Emergency Stop */}
            <button
              onClick={() => setShowEmergencyPanel(!showEmergencyPanel)}
              className={`p-2 rounded-sm transition-colors ${
                showEmergencyPanel 
                  ? 'bg-red-600 text-white' 
                  : 'text-red-400 hover:text-red-300 hover:bg-red-900/30'
              }`}
              title="Emergency Stop"
              disabled={isHalted}
            >
              <StopCircle size={18} />
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Keyboard Shortcut Hint */}
            <span className="text-xs text-gray-600 hidden sm:block">
              ⌘ Enter
            </span>

            {/* Send Button */}
            <button
              onClick={handleSendWithFiles}
              disabled={isProcessing || isInputDisabled || (!input.trim() && attachedFiles.length === 0)}
              className={`p-2.5 rounded-sm transition-all duration-200 ${
                isProcessing || isInputDisabled || (!input.trim() && attachedFiles.length === 0)
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-gray-200 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Helper Text */}
      <div className="mt-2 text-center">
        <span className="text-xs text-gray-600">
          Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-gray-400 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-gray-400 font-mono text-[10px]">Shift + Enter</kbd> for new line
        </span>
      </div>
      </div>
    </div>
  );
};
