import React from 'react';
import { Send, Command } from 'lucide-react';
import { AGENTS, AgentMode } from '../types';

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
  return (
    <div className="p-4 bg-nexus-900 border-t border-nexus-border z-50">
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
                disabled={!!transitionTarget}
            />
            <div className="flex items-center gap-2">
                 <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-nexus-800 rounded text-[10px] text-gray-500 border border-nexus-border">
                    <Command size={10} />
                    <span>ENTER</span>
                 </div>
                <button
                    onClick={onSendMessage}
                    disabled={isProcessing || !!transitionTarget}
                    className={`p-2 rounded hover:bg-nexus-800 transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'text-nexus-accent'}`}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    </div>
  );
};
