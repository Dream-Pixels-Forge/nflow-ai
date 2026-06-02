import React, { useState } from 'react';
import { 
  Send, 
  Command, 
  XCircle, 
  AlertTriangle,
  CheckCircle
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

  return (
    <div className="p-4 bg-nexus-900 border-t border-nexus-border z-50">
        {/* Emergency Panel */}
        {showEmergencyPanel && (
          <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded-sm">
            <div className="flex items-center gap-2 text-red-400 text-xs font-mono mb-2">
              <AlertTriangle size={14} />
              <span>EMERGENCY STOP</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                placeholder="Reason for emergency stop..."
                className="flex-1 bg-black border border-red-500/30 rounded-sm px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                onKeyDown={(e) => e.key === 'Enter' && handleEmergencyStop()}
              />
              <button
                onClick={handleEmergencyStop}
                disabled={!emergencyReason.trim()}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white text-xs font-mono rounded-sm transition-colors"
              >
                HALT
              </button>
              <button
                onClick={() => setShowEmergencyPanel(false)}
                className="px-3 py-1.5 bg-nexus-800 hover:bg-nexus-700 text-gray-400 text-xs font-mono rounded-sm transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* System Halted Banner */}
        {isHalted && (
          <div className="mb-3 p-3 bg-red-900/30 border border-red-500/50 rounded-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 text-xs font-mono">
                <XCircle size={14} />
                <span>SYSTEM HALTED - EMERGENCY STOP ACTIVE</span>
              </div>
              <button
                onClick={handleResolveEmergency}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-mono rounded-sm transition-colors flex items-center gap-1"
              >
                <CheckCircle size={12} />
                RESUME
              </button>
            </div>
          </div>
        )}

        {/* Context Status */}
        {currentSession && (
          <div className="mb-2 flex items-center gap-4 text-[10px] font-mono text-gray-500">
            <span>SESSION: {currentSession.id.slice(0, 12)}...</span>
            <span className={
              contextStatus === 'OPTIMAL' ? 'text-green-500' :
              contextStatus === 'WARNING' ? 'text-yellow-500' :
              contextStatus === 'CRITICAL' ? 'text-orange-500' :
              'text-red-500'
            }>
              CONTEXT: {contextStatus}
            </span>
            <span>{Math.round((currentSession.tokenCount / currentSession.maxTokens) * 100)}% USED</span>
          </div>
        )}

        {/* Main Input */}
        <div className="flex items-center gap-2 bg-black border border-nexus-border p-3 rounded-sm focus-within:border-nexus-accent transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <span className={`${AGENTS[activeAgent].color} font-bold text-lg`}>›</span>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`/${activeAgent.toLowerCase()}, /tasks or message...`}
                className="flex-1 bg-transparent border-none outline-none text-gray-200 font-mono placeholder-gray-700"
                autoComplete="off"
                disabled={!!transitionTarget || isHalted}
            />
            <div className="flex items-center gap-2">
                 <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-nexus-800 rounded text-[10px] text-gray-500 border border-nexus-border">
                    <Command size={10} />
                    <span>ENTER</span>
                 </div>
                 
                 {/* Emergency Stop Button */}
                 <button
                    onClick={() => setShowEmergencyPanel(!showEmergencyPanel)}
                    className={`p-2 rounded transition-colors ${
                      showEmergencyPanel 
                        ? 'bg-red-600 text-white' 
                        : 'hover:bg-red-900/50 text-red-400 hover:text-red-300'
                    }`}
                    title="Emergency Stop"
                    disabled={isHalted}
                 >
                    <XCircle size={18} />
                 </button>

                <button
                    onClick={onSendMessage}
                    disabled={isProcessing || !!transitionTarget || isHalted}
                    className={`p-2 rounded hover:bg-nexus-800 transition-colors ${isProcessing || isHalted ? 'opacity-50 cursor-not-allowed' : 'text-nexus-accent'}`}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    </div>
  );
};
