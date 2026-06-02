import React from 'react';
import { 
  User, 
  Loader2, 
  Globe, 
  ExternalLink, 
  AlertTriangle,
  MessageSquare,
  Map as MapIcon,
  Cpu,
  Code,
  FlaskConical,
  ShieldAlert,
  Rocket,
  Activity
} from 'lucide-react';
import { AGENTS, AgentMode, Message } from '../types';

// Icon Mapping to prevent undefined render errors
const AGENT_ICONS: Record<string, React.ElementType> = {
  'MessageSquare': MessageSquare,
  'Map': MapIcon,
  'Cpu': Cpu,
  'Code': Code,
  'FlaskConical': FlaskConical,
  'ShieldAlert': ShieldAlert,
  'Rocket': Rocket,
  'Activity': Activity
};

interface MessageListProps {
  messages: Message[];
  activeAgent: AgentMode;
  isProcessing: boolean;
  aiProvider: 'gemini' | 'ollama';
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  activeAgent, 
  isProcessing, 
  aiProvider 
}) => {
  return (
    <>
      {messages.length === 0 && (
         <div className="flex flex-col items-center justify-center h-full text-nexus-dim opacity-50">
            <MessageSquare size={48} />
            <p className="mt-4 font-mono text-sm">CHANNEL EMPTY</p>
            <p className="text-xs">Type to initialize {AGENTS[activeAgent].name}</p>
         </div>
      )}

      {messages.map((msg) => {
         // Safe Icon Rendering using Map
         const AgentIcon = AGENT_ICONS[AGENTS[msg.agent].icon] || MessageSquare;

         const isUser = msg.role === 'user';
         const isSystem = msg.role === 'system';

         if (isSystem) {
            return (
                <div key={msg.id} className="flex justify-center my-4 animate-fade-in">
                    <span className={`text-xs font-mono px-3 py-1 border ${msg.isError ? 'border-red-900 text-red-500 bg-red-900/10' : 'border-nexus-border text-nexus-dim bg-nexus-800/50'}`}>
                         {msg.isError && <AlertTriangle size={12} className="inline mr-2 mb-0.5"/>}
                         {msg.content}
                    </span>
                </div>
            )
         }

         return (
            <div key={msg.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} group animate-fade-in`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${isUser ? 'bg-nexus-dim text-white' : `${AGENTS[msg.agent].color} bg-nexus-800 border border-nexus-border`}`}>
                    {isUser ? <User size={16} /> : <AgentIcon size={16} />}
                </div>

                <div className={`max-w-[80%] space-y-1`}>
                    <div className={`flex items-center gap-2 text-[10px] uppercase ${isUser ? 'justify-end text-nexus-dim' : AGENTS[msg.agent].color}`}>
                        {isUser ? 'YOU' : msg.agent} <span className="opacity-50">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className={`p-4 rounded-sm text-sm leading-relaxed whitespace-pre-wrap font-mono shadow-lg
                        ${isUser
                            ? 'bg-nexus-800 text-gray-200 border border-nexus-border'
                            : 'bg-black text-gray-300 border-l-2 border-nexus-border ' + AGENTS[msg.agent].color.replace('text-', 'border-')
                        }`}>
                        {msg.content}

                        {/* Render Grounding Sources if present */}
                        {msg.grounding && msg.grounding.urls.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-nexus-border/50">
                            <div className="text-[10px] text-nexus-dim mb-1 flex items-center gap-1">
                              <Globe size={10} />
                              <span>VERIFIED SOURCES</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {msg.grounding.urls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 bg-nexus-900/80 border border-nexus-border hover:border-nexus-accent text-[10px] text-nexus-accent rounded transition-colors truncate max-w-[200px]"
                                >
                                  <ExternalLink size={8} />
                                  {new URL(url).hostname}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                </div>
            </div>
         );
      })}
      {isProcessing && (
        <div className="flex gap-4 animate-pulse">
             <div className={`w-8 h-8 rounded bg-nexus-800 border border-nexus-border flex items-center justify-center ${AGENTS[activeAgent].color}`}>
                 <Loader2 size={16} className="animate-spin" />
             </div>
             <div className="flex items-center text-xs text-nexus-dim font-mono">
                {activeAgent} IS THINKING ({aiProvider === 'ollama' ? 'LOCAL' : 'CLOUD'})...
             </div>
        </div>
      )}
    </>
  );
};
