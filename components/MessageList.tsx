import React, { useState } from 'react';
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
  Activity,
  Copy,
  Check,
  Download,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { AGENTS, AgentMode, Message, AIProvider } from '../types';
import { stripAgentSwitchTags } from '../services/promptUtils';

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
  aiProvider: AIProvider;
  onDeleteMessage?: (messageId: string) => void;
  onRerunMessage?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  activeAgent, 
  isProcessing, 
  aiProvider,
  onDeleteMessage,
  onRerunMessage
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = (text: string, msg: Message) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${msg.agent.toLowerCase()}-${msg.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

                 <div className={`max-w-[1000px] space-y-1`}>
                     <div className={`flex items-center gap-2 text-[10px] uppercase ${isUser ? 'justify-end text-nexus-dim' : AGENTS[msg.agent].color}`}>
                         {isUser ? 'YOU' : msg.agent} <span className="opacity-50">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                     </div>
                      <div className={`p-4 rounded-sm text-sm leading-relaxed whitespace-pre-wrap font-mono shadow-lg relative
                          ${isUser
                              ? 'bg-nexus-800 text-gray-200 border border-nexus-border'
                              : 'bg-black text-gray-300 border-l-2 border-nexus-border ' + AGENTS[msg.agent].color.replace('text-', 'border-')
                          }`}>
                          {stripAgentSwitchTags(msg.content)}
                          {/* Streaming cursor */}
                          {msg.isStreaming && (
                            <span className="inline-block w-2 h-4 bg-nexus-accent ml-0.5 animate-pulse" />
                          )}

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

                     {/* Action Buttons */}
                     <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
                         {/* Copy Button */}
                         <button
                           onClick={() => handleCopy(msg.content, msg.id)}
                           className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-nexus-800 rounded-sm transition-colors"
                           title="Copy message"
                         >
                           {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                         </button>

                         {/* Download Button */}
                         <button
                           onClick={() => handleDownload(msg.content, msg)}
                           className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-nexus-800 rounded-sm transition-colors"
                           title="Download as text"
                         >
                           <Download size={14} />
                         </button>

                         {/* Rerun Button (only for user messages) */}
                         {isUser && onRerunMessage && (
                           <button
                             onClick={() => onRerunMessage(msg.id)}
                             className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-nexus-800 rounded-sm transition-colors"
                             title="Rerun message"
                           >
                             <RefreshCw size={14} />
                           </button>
                         )}

                         {/* Delete Button */}
                         {onDeleteMessage && (
                           <button
                             onClick={() => onDeleteMessage(msg.id)}
                             className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-sm transition-colors"
                             title="Delete message"
                           >
                             <Trash2 size={14} />
                           </button>
                         )}
                     </div>
                 </div>
             </div>
         );
      })}
      {/* Thinking Indicator - Shows immediately when processing, hides when streaming */}
      {isProcessing && !messages.some(m => m.isStreaming) && (
        <div className="flex gap-3 items-start animate-fade-in">
          <div className={`w-8 h-8 rounded bg-nexus-800 border border-nexus-border flex items-center justify-center ${AGENTS[activeAgent].color}`}>
            <Loader2 size={16} className="animate-spin" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-nexus-dim font-mono">
              <span className={`${AGENTS[activeAgent].color} font-bold`}>{AGENTS[activeAgent].name}</span>
              <span className="text-gray-400">IS THINKING</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-nexus-800 border border-nexus-border rounded text-gray-500">
                {aiProvider === 'ollama' ? 'LOCAL' : 'CLOUD'}
              </span>
            </div>
            {/* Animated thinking indicator */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-nexus-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-nexus-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-nexus-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Processing request...</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
