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
  File,
  Command,
  ChevronUp,
  MessageSquare,
  Code
} from 'lucide-react';
import { AGENTS, AgentMode, AppSettings, AIProvider, ChatMode, PROVIDER_NAMES } from '../types';
import { useAgenticSystems } from '../hooks/useAgenticSystems';
import { useWhisperSTT } from '../src/hooks/useWhisperSTT';
import { getOllamaModels } from '../services/ollamaService';

const SLASH_COMMANDS = [
  { cmd: '/chat', desc: 'Switch to Chat agent', agent: AgentMode.CHAT },
  { cmd: '/plan', desc: 'Switch to Plan agent', agent: AgentMode.PLAN },
  { cmd: '/architect', desc: 'Switch to Architect agent', agent: AgentMode.ARCHITECT },
  { cmd: '/coder', desc: 'Switch to Coder agent', agent: AgentMode.CODER },
  { cmd: '/test', desc: 'Switch to Test agent', agent: AgentMode.TEST },
  { cmd: '/secure', desc: 'Switch to Secure agent', agent: AgentMode.SECURE },
  { cmd: '/deploy', desc: 'Switch to Deploy agent', agent: AgentMode.DEPLOY },
  { cmd: '/monitor', desc: 'Switch to Monitor agent', agent: AgentMode.MONITOR },
];

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
  settings?: AppSettings;
  onSettingsChange?: (settings: Partial<AppSettings>) => void;
  onChatModeChange?: (mode: ChatMode) => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  activeAgent,
  isProcessing,
  transitionTarget,
  onKeyDown,
  onSendMessage,
  onFilesAttached,
  settings,
  onSettingsChange,
  onChatModeChange
}) => {
  // Agentic systems
  const [agenticState, agenticActions] = useAgenticSystems();
  const { isHalted, contextStatus, currentSession } = agenticState;

  // Whisper STT hook
  const {
    isSupported: isWhisperSupported,
    isModelLoading,
    modelLoadProgress,
    isRecording: isWhisperRecording,
    transcribedText,
    error: whisperError,
    startRecording: startWhisperRecording,
    stopRecording: stopWhisperRecording
  } = useWhisperSTT();
  
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS);
  
  // Dropdown states
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch Ollama models when provider is ollama
  useEffect(() => {
    const fetchModels = async () => {
      if (settings?.aiProvider === 'ollama') {
        setLoadingModels(true);
        try {
          const models = await getOllamaModels(settings.ollamaUrl);
          setAvailableModels(models);
        } catch (err) {
          console.warn('Failed to fetch Ollama models:', err);
          setAvailableModels([]);
        }
        setLoadingModels(false);
      }
    };
    fetchModels();
  }, [settings?.aiProvider, settings?.ollamaUrl]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setShowProviderDropdown(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // Command palette handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Show command palette when typing /
    if (value.startsWith('/')) {
      const query = value.toLowerCase();
      const filtered = SLASH_COMMANDS.filter(cmd => 
        cmd.cmd.toLowerCase().startsWith(query)
      );
      setFilteredCommands(filtered);
      setShowCommandPalette(filtered.length > 0);
    } else {
      setShowCommandPalette(false);
    }
  };

  const selectCommand = (cmd: string) => {
    setInput(cmd + ' ');
    setShowCommandPalette(false);
    textareaRef.current?.focus();
  };

  // Microphone/Speech-to-text handlers
  const toggleRecording = async () => {
    if (isWhisperRecording) {
      // Stop recording and get transcribed text
      const text = await stopWhisperRecording();
      if (text) {
        setInput(input + (input ? ' ' : '') + text);
      }
    } else {
      // Start recording (will load model if needed)
      await startWhisperRecording();
    }
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
      <div className={`relative bg-zinc-900 border rounded-md shadow-lg transition-all duration-200 ${
        isInputDisabled 
          ? 'border-red-500/30 opacity-60' 
          : 'border-zinc-700/50 focus-within:border-zinc-500 focus-within:shadow-zinc-500/10'
      }`}>
        {/* Textarea - Top */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isHalted ? 'System halted - resume to continue' : `Message ${AGENTS[activeAgent].name}... (type / for commands)`}
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

        {/* Slash Command Palette */}
        {showCommandPalette && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-nexus-800 border border-nexus-border rounded-sm shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-nexus-border flex items-center gap-2">
              <Command size={12} className="text-nexus-accent" />
              <span className="text-[10px] text-gray-400 font-mono">COMMANDS</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.cmd}
                  onClick={() => selectCommand(cmd.cmd)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-nexus-700 transition-colors text-left"
                >
                  <span className="text-nexus-accent font-mono text-xs font-bold min-w-[80px]">{cmd.cmd}</span>
                  <span className="text-[10px] text-gray-400">{cmd.desc}</span>
                </button>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t border-nexus-border text-[8px] text-gray-500 font-mono">
              ↑↓ Navigate • Enter Select • Esc Close
            </div>
          </div>
        )}

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
              disabled={!isWhisperSupported}
              className={`p-2 rounded-sm transition-colors ${
                isWhisperRecording 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : isWhisperSupported
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-zinc-800'
                    : 'text-gray-600 cursor-not-allowed opacity-50'
              }`}
              title={isWhisperSupported
                ? (isWhisperRecording ? 'Stop recording' : 'Voice input')
                : 'Voice input requires MediaRecorder support'}
            >
              {isWhisperRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            
            {/* Recording Indicator */}
            {isWhisperRecording && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-mono">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>Recording</span>
              </div>
            )}

            {/* Model Loading Indicator */}
            {isModelLoading && (
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-mono">
                <Loader2 size={12} className="animate-spin" />
                <span>Loading Whisper model... {Math.round(modelLoadProgress)}%</span>
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

            {/* Chat/Agent Mode Toggle */}
            {/* Chat/Agent Mode Buttons - Side by Side */}
            {settings && onChatModeChange && (
              <div className="flex items-center gap-1 p-0.5 bg-zinc-800 border border-zinc-700 rounded">
                <button
                  onClick={() => onChatModeChange('chat')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all ${
                    settings.chatMode === 'chat'
                      ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title="Chat Mode: Deep brainstorming, no code generation"
                >
                  <MessageSquare size={10} />
                  CHAT
                </button>
                <button
                  onClick={() => onChatModeChange('agent')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all ${
                    settings.chatMode === 'agent'
                      ? 'bg-nexus-accent/20 border border-nexus-accent/50 text-nexus-accent'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title="Agent Mode: Working mode with code generation"
                >
                  <Code size={10} />
                  AGENT
                </button>
              </div>
            )}

            {/* Provider Drop-up */}
            {settings && (
              <div className="relative" ref={providerDropdownRef}>
                <button
                  onClick={() => {
                    setShowProviderDropdown(!showProviderDropdown);
                    setShowModelDropdown(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono hover:border-zinc-600 transition-colors"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    settings.aiProvider === 'ollama' ? 'bg-green-500' :
                    settings.aiProvider === 'gemini' ? 'bg-blue-500' :
                    settings.aiProvider === 'openrouter' ? 'bg-purple-500' :
                    'bg-orange-500'
                  }`} />
                  <span className="text-gray-400">{PROVIDER_NAMES[settings.aiProvider]}</span>
                  <ChevronUp size={10} className={`text-gray-500 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showProviderDropdown && (
                  <div className="absolute bottom-full left-0 mb-1 w-40 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl overflow-hidden z-50">
                    {([
                      { id: 'ollama' as AIProvider, name: 'Ollama (Local)', color: 'bg-green-500' },
                      { id: 'gemini' as AIProvider, name: 'Google Gemini', color: 'bg-blue-500' },
                      { id: 'openrouter' as AIProvider, name: 'OpenRouter', color: 'bg-purple-500' },
                      { id: 'nvidia' as AIProvider, name: 'NVIDIA NIM', color: 'bg-orange-500' }
                    ]).map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => {
                          onSettingsChange?.({ aiProvider: provider.id });
                          setShowProviderDropdown(false);
                        }}
                        className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors text-left ${
                          settings.aiProvider === provider.id ? 'bg-zinc-700' : ''
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${provider.color}`} />
                        <span className="text-xs text-gray-300">{provider.name}</span>
                        {settings.aiProvider === provider.id && (
                          <CheckCircle size={12} className="text-green-500 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Model Drop-up */}
            {settings && (
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => {
                    setShowModelDropdown(!showModelDropdown);
                    setShowProviderDropdown(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono hover:border-zinc-600 transition-colors max-w-[140px]"
                >
                  <span className="text-gray-400 truncate">
                    {loadingModels ? 'Loading...' :
                     settings.aiProvider === 'ollama' ? (settings.ollamaGeneralModel || 'Select model') :
                     settings.aiProvider === 'openrouter' ? (settings.openrouterModel?.split('/').pop() || 'Select model') :
                     settings.aiProvider === 'gemini' ? (settings.geminiModel || 'gemini-2.0-flash') :
                     settings.nvidiaModel?.split('/').pop() || 'Select model'}
                  </span>
                  <ChevronUp size={10} className={`text-gray-500 transition-transform flex-shrink-0 ${showModelDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showModelDropdown && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
                    {settings.aiProvider === 'ollama' ? (
                      availableModels.length > 0 ? (
                        availableModels.map((model) => (
                          <button
                            key={model}
                            onClick={() => {
                              onSettingsChange?.({ ollamaGeneralModel: model });
                              setShowModelDropdown(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors text-left ${
                              settings.ollamaGeneralModel === model ? 'bg-zinc-700' : ''
                            }`}
                          >
                            <span className="text-xs text-gray-300 truncate">{model}</span>
                            {settings.ollamaGeneralModel === model && (
                              <CheckCircle size={12} className="text-green-500 ml-auto flex-shrink-0" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center text-xs text-gray-500">
                          {loadingModels ? 'Loading models...' : 'No models found'}
                        </div>
                      )
                    ) : settings.aiProvider === 'openrouter' ? (
                      // Common OpenRouter models
                      ['anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash', 'meta-llama/llama-3.1-405b-instruct', 'mistralai/mixtral-8x7b-instruct'].map((model) => (
                        <button
                          key={model}
                          onClick={() => {
                            onSettingsChange?.({ openrouterModel: model });
                            setShowModelDropdown(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors text-left ${
                            settings.openrouterModel === model ? 'bg-zinc-700' : ''
                          }`}
                        >
                          <span className="text-xs text-gray-300 truncate">{model.split('/').pop()}</span>
                          <span className="text-[9px] text-gray-500 truncate">{model.split('/')[0]}</span>
                          {settings.openrouterModel === model && (
                            <CheckCircle size={12} className="text-green-500 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      ))
                    ) : settings.aiProvider === 'gemini' ? (
                      ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'].map((model) => (
                        <button
                          key={model}
                          onClick={() => {
                            onSettingsChange?.({ geminiModel: model });
                            setShowModelDropdown(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors text-left ${
                            settings.geminiModel === model ? 'bg-zinc-700' : ''
                          }`}
                        >
                          <span className="text-xs text-gray-300">{model}</span>
                          {settings.geminiModel === model && (
                            <CheckCircle size={12} className="text-green-500 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      ))
                    ) : (
                      // NVIDIA models
                      ['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct', 'mistralai/mistral-7b-instruct', 'google/gemma-2-9b-it'].map((model) => (
                        <button
                          key={model}
                          onClick={() => {
                            onSettingsChange?.({ nvidiaModel: model });
                            setShowModelDropdown(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors text-left ${
                            settings.nvidiaModel === model ? 'bg-zinc-700' : ''
                          }`}
                        >
                          <span className="text-xs text-gray-300 truncate">{model.split('/').pop()}</span>
                          <span className="text-[9px] text-gray-500 truncate">{model.split('/')[0]}</span>
                          {settings.nvidiaModel === model && (
                            <CheckCircle size={12} className="text-green-500 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Keyboard Shortcut Hint */}
            <span className="text-xs text-gray-600 hidden sm:block">
              Enter
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
