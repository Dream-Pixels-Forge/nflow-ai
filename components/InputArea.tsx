import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic,
  StopCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { AGENTS, AgentMode } from '../types';
import { useAgenticSystems } from '../hooks/useAgenticSystems';

interface InputAreaProps {
  input: string;
  setInput: (input: string) => void;
  activeAgent: AgentMode;
  isProcessing: boolean;
  transitionTarget: AgentMode | null;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSendMessage: () => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  activeAgent,
  isProcessing,
  transitionTarget,
  onKeyDown,
  onSendMessage
}) => {
  // Agentic systems
  const [agenticState, agenticActions] = useAgenticSystems();
  const { isHalted, contextStatus, currentSession } = agenticState;
  
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Determine if input should be disabled
  const isInputDisabled = !!transitionTarget || isHalted;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isInputDisabled && !isProcessing && input.trim()) {
        onSendMessage();
      }
    }
  };

  return (
    <div className="px-4 pb-4 pt-2">
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
            <button
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-zinc-800 rounded-sm transition-colors"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <button
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-zinc-800 rounded-sm transition-colors"
              title="Voice input"
            >
              <Mic size={18} />
            </button>
            
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
              onClick={onSendMessage}
              disabled={isProcessing || isInputDisabled || !input.trim()}
              className={`p-2.5 rounded-sm transition-all duration-200 ${
                isProcessing || isInputDisabled || !input.trim()
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
  );
};
