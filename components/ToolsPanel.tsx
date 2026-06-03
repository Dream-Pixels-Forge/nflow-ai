import React, { useState, useRef } from 'react';
import { 
  Database,
  Globe, 
  FileText, 
  Server, 
  Workflow, 
  ChevronDown, 
  ChevronRight, 
  Power, 
  Upload, 
  Trash2, 
  X, 
  Link,
  Users,
  Clock,
  Brain,
  Loader2
} from 'lucide-react';
import { ToolState, Message } from '../types';
import { useMCP } from '../hooks/useMCP';
import { useA2A } from '../hooks/useA2A';
import { useMemory } from '../hooks/useMemory';

interface ToolsPanelProps {
  toolState: ToolState;
  setToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  messages?: Message[];
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ toolState, setToolState, messages }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // A2A, MCP, Memory hooks
  const [mcpState, mcpActions] = useMCP();
  const [a2aState, a2aActions] = useA2A();
  const [memoryState, memoryActions] = useMemory();

  const toggleExpand = (id: string) => {
    setExpanded(expanded === id ? null : id);
  };

  const toggleTool = (id: keyof ToolState) => {
    setToolState(prev => ({
      ...prev,
      [id]: { ...prev[id], active: !prev[id].active }
    }));
  };

  const handleClearContext = () => {
    setToolState(prev => ({
      ...prev,
      rag: { ...prev.rag, content: [] },
      doc: { ...prev.doc, files: [] }
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setToolState(prev => ({
          ...prev,
          doc: { ...prev.doc, files: [...prev.doc.files, file.name] },
          rag: { ...prev.rag, content: [...prev.rag.content, `FILE: ${file.name}\nCONTENT:\n${text}`], active: true }
        }));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const tools = [
    { 
      id: 'mcp' as const, 
      name: 'MCP BRIDGE', 
      icon: Server, 
      description: 'Model Context Protocol',
      badge: mcpState.stats.connectedServers > 0 ? `${mcpState.stats.connectedServers} connected` : null,
      renderDetails: () => (
        <div className="mt-3 space-y-2">
           <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={toolState.mcp.port}
                onChange={(e) => setToolState(prev => ({ ...prev, mcp: { ...prev.mcp, port: e.target.value } }))}
                className="bg-nexus-900 border border-nexus-border text-xs p-1 font-mono w-24 text-nexus-accent focus:outline-none focus:border-nexus-accent"
                placeholder="PORT"
              />
              <span className="text-[10px] text-nexus-dim">LOCALHOST</span>
           </div>
           
           {/* MCP Servers List */}
           {mcpState.servers.length > 0 && (
             <div className="mt-2">
               <div className="text-[10px] text-nexus-dim uppercase mb-1">Registered Servers</div>
               <div className="max-h-24 overflow-y-auto custom-scrollbar border border-nexus-dim/20 p-2 bg-nexus-900/50">
                 {mcpState.servers.map((server, i) => (
                   <div key={i} className="flex items-center justify-between text-[9px] border-b border-nexus-dim/10 pb-1 mb-1">
                     <div className="flex items-center gap-1">
                       <span className={server.status === 'connected' ? 'text-green-500' : 'text-gray-500'}>
                         <Server size={8} />
                       </span>
                       <span className="text-gray-400">{server.name}</span>
                     </div>
                     <span className={server.status === 'connected' ? 'text-green-500' : 'text-red-500'}>
                       {server.status}
                     </span>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* MCP Tools */}
           {mcpState.allTools.length > 0 && (
             <div className="mt-2">
               <div className="text-[10px] text-nexus-dim uppercase mb-1">Available Tools ({mcpState.allTools.length})</div>
               <div className="max-h-24 overflow-y-auto custom-scrollbar border border-nexus-dim/20 p-2 bg-nexus-900/50">
                 {mcpState.allTools.slice(0, 5).map((item, i) => (
                   <div key={i} className="text-[9px] text-gray-400 border-b border-nexus-dim/10 pb-1 mb-1">
                     <span className="text-nexus-accent">{item.tool.name}</span>
                     <span className="text-gray-500 ml-1">({item.server})</span>
                   </div>
                 ))}
               </div>
             </div>
           )}

           <div className="text-[10px] text-gray-500">
              Enables generic connection to local MCP servers for tool execution.
           </div>
        </div>
      )
    },
    { 
      id: 'rag' as const, 
      name: 'RAG ENGINE', 
      icon: Database, 
      description: 'Vector Knowledge Base',
      renderDetails: () => (
        <div className="mt-3 space-y-2">
           <div className="flex flex-col gap-2">
             <div className="text-[10px] text-nexus-dim uppercase flex justify-between">
                <span>Active Context</span>
                <span className="text-nexus-dim">{toolState.rag.content.length} snippets</span>
             </div>
             <div className="max-h-24 overflow-y-auto custom-scrollbar border border-nexus-dim/20 p-2 bg-nexus-900/50">
                {toolState.rag.content.length === 0 ? (
                  <span className="text-nexus-dim italic text-[10px]">No context loaded...</span>
                ) : (
                  toolState.rag.content.map((c, i) => (
                    <div key={i} className="text-[9px] text-gray-400 border-b border-nexus-dim/10 pb-1 mb-1 truncate">
                      {c.substring(0, 50)}...
                    </div>
                  ))
                )}
             </div>
             <button 
                onClick={handleClearContext}
                className="text-[9px] text-red-400 hover:text-red-300 text-left flex items-center gap-1 transition-colors"
             >
               <Trash2 size={10} /> CLEAR CONTEXT
             </button>
           </div>
        </div>
      )
    },
    { 
      id: 'fetch' as const, 
      name: 'WEB FETCH', 
      icon: Globe, 
      description: 'External Resource Proxy',
      renderDetails: () => (
        <div className="mt-3 space-y-2">
            <input 
              type="text" 
              value={toolState.fetch.targetUrl}
              onChange={(e) => setToolState(prev => ({ ...prev, fetch: { ...prev.fetch, targetUrl: e.target.value } }))}
              className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 font-mono text-gray-300 focus:outline-none focus:border-nexus-accent"
              placeholder="https://api.example.com/v1..."
            />
            <button
              onClick={async () => {
                const url = toolState.fetch.targetUrl.trim();
                if (!url) return;
                // SSRF protection: block internal IPs and non-http protocols
                try {
                  const parsed = new URL(url);
                  const hostname = parsed.hostname;
                  const isInternal = (
                    hostname === 'localhost' ||
                    hostname === '127.0.0.1' ||
                    hostname === '::1' ||
                    /^10\./.test(hostname) ||
                    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
                    /^192\.168\./.test(hostname) ||
                    /^169\.254\./.test(hostname)
                  );
                  if (isInternal) {
                    setFetchError('Blocked: Cannot fetch internal/private network addresses');
                    return;
                  }
                  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    setFetchError('Blocked: Only HTTP and HTTPS URLs are allowed');
                    return;
                  }
                } catch {
                  setFetchError('Invalid URL format');
                  return;
                }
                setFetchLoading(true);
                setFetchResult(null);
                setFetchError(null);
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 10000);
                  const response = await fetch(url, { signal: controller.signal });
                  clearTimeout(timeoutId);
                  if (!response.ok) {
                    setFetchError(`HTTP ${response.status}: ${response.statusText}`);
                  } else {
                    const text = await response.text();
                    setFetchResult(text.substring(0, 2000) + (text.length > 2000 ? '\n... (truncated)' : ''));
                  }
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Fetch failed';
                  setFetchError(err instanceof Error && err.name === 'AbortError' ? 'Request timed out (10s)' : message);
                } finally {
                  setFetchLoading(false);
                }
              }}
              disabled={fetchLoading || !toolState.fetch.targetUrl.trim()}
              className="w-full flex items-center justify-center gap-2 bg-nexus-900 hover:bg-nexus-800 border border-nexus-border text-xs py-2 text-nexus-dim hover:text-nexus-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fetchLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>FETCHING...</span>
                </>
              ) : (
                <>
                  <Globe size={12} />
                  <span>FETCH</span>
                </>
              )}
            </button>
            {fetchError && (
              <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-500/30 p-2 rounded">
                {fetchError}
              </div>
            )}
            {fetchResult && (
              <div className="max-h-32 overflow-y-auto custom-scrollbar border border-nexus-dim/20 p-2 bg-nexus-900/50">
                <pre className="text-[9px] text-gray-400 whitespace-pre-wrap break-words font-mono">{fetchResult}</pre>
              </div>
            )}
        </div>
      )
    },
    { 
      id: 'doc' as const, 
      name: 'DOC LOADER', 
      icon: FileText, 
      description: 'File System Watcher',
      renderDetails: () => (
        <div className="mt-3 space-y-2">
           <input 
             type="file" 
             ref={fileInputRef}
             className="hidden" 
             onChange={handleFileUpload}
             accept=".txt,.md,.json,.js,.ts,.tsx,.css"
           />
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="flex items-center gap-2 w-full justify-center bg-nexus-900 hover:bg-nexus-800 border border-nexus-border border-dashed text-xs py-2 text-nexus-dim hover:text-nexus-accent transition-colors"
           >
             <Upload size={12} />
             <span>LOAD FILE</span>
           </button>
           <div className="space-y-1">
             {toolState.doc.files.map((f, i) => (
               <div key={i} className="flex items-center gap-1 text-[9px] text-nexus-accent">
                 <FileText size={8} /> {f}
               </div>
             ))}
             {toolState.doc.files.length > 0 && (
                <div className="pt-2 mt-2 border-t border-nexus-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[9px] text-nexus-dim">
                        <Link size={8} />
                        <span>SYNCED TO RAG</span>
                    </div>
                    <button 
                        onClick={handleClearContext}
                        className="text-[9px] text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                        <X size={10} /> UNLOAD
                    </button>
                </div>
             )}
           </div>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-3 p-4 bg-nexus-800/50 border-l border-nexus-border min-h-full">
        <h3 className="text-nexus-accent font-mono text-sm uppercase tracking-wider flex items-center gap-2 mb-2">
        <Workflow className="w-4 h-4" /> Tool Configuration
      </h3>
      
      {tools.map((tool) => {
        const isActive = toolState[tool.id].active;
        const isExpanded = expanded === tool.id;

        return (
          <div key={tool.id} className={`bg-nexus-900 border transition-all duration-300 overflow-hidden ${isActive ? 'border-nexus-accent/40' : 'border-nexus-border'}`}>
            <div 
              className="p-3 cursor-pointer hover:bg-nexus-800/50 flex items-center justify-between"
              onClick={() => toggleExpand(tool.id)}
            >
              <div className="flex items-center gap-3">
                 <div className={`${isActive ? 'text-nexus-accent' : 'text-gray-600'}`}>
                   <tool.icon size={16} />
                 </div>
                 <div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold font-mono text-gray-200">{tool.name}</div>
                      {tool.badge && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-nexus-accent/20 text-nexus-accent rounded">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-gray-500 font-mono">{tool.description}</div>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleTool(tool.id); }}
                  className={`p-1 rounded transition-colors ${isActive ? 'text-nexus-accent bg-nexus-accent/10' : 'text-gray-600 hover:text-gray-400'}`}
                >
                  <Power size={14} />
                </button>
                {isExpanded ? <ChevronDown size={14} className="text-gray-600"/> : <ChevronRight size={14} className="text-gray-600"/>}
              </div>
            </div>

            {/* Expansion Panel */}
            <div className={`transition-all duration-300 ease-in-out px-3 bg-black/20 ${isExpanded ? 'max-h-64 py-3 border-t border-nexus-border overflow-y-auto' : 'max-h-0 py-0'}`}>
               {tool.renderDetails()}
            </div>
          </div>
        );
      })}

      {/* A2A Protocol Section */}
      <div className="bg-nexus-900 border border-nexus-border p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} className="text-nexus-accent" />
          <span className="text-xs font-bold font-mono text-gray-200">A2A PROTOCOL</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-nexus-800/50 p-2 rounded border border-nexus-border">
            <div className="text-[9px] text-nexus-dim uppercase">Agents</div>
            <div className="text-sm font-mono text-nexus-accent">{a2aState.stats.agents}</div>
          </div>
          <div className="bg-nexus-800/50 p-2 rounded border border-nexus-border">
            <div className="text-[9px] text-nexus-dim uppercase">Tasks</div>
            <div className="text-sm font-mono text-nexus-accent">{a2aState.stats.tasks}</div>
          </div>
        </div>

        {/* Active Tasks */}
        {a2aState.activeTasks.length > 0 && (
          <div className="mt-2">
            <div className="text-[9px] text-nexus-dim uppercase mb-1">Active Tasks</div>
            <div className="max-h-20 overflow-y-auto custom-scrollbar border border-nexus-dim/20 p-1 bg-nexus-900/50">
              {a2aState.activeTasks.slice(0, 3).map((task, i) => (
                <div key={i} className="flex items-center justify-between text-[8px] border-b border-nexus-dim/10 pb-1 mb-1">
                  <div className="flex items-center gap-1">
                    <Clock size={8} className="text-yellow-500" />
                    <span className="text-gray-400">{task.id.slice(0, 15)}...</span>
                  </div>
                  <span className="text-yellow-500">{task.state}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Memory Section */}
      <div className="bg-nexus-900 border border-nexus-border p-3">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-nexus-accent" />
          <span className="text-xs font-bold font-mono text-gray-200">PERSISTENT MEMORY</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-nexus-800/50 p-2 rounded border border-nexus-border">
            <div className="text-[9px] text-nexus-dim uppercase">Entries</div>
            <div className="text-sm font-mono text-nexus-accent">{memoryState.stats.totalEntries}</div>
          </div>
          <div className="bg-nexus-800/50 p-2 rounded border border-nexus-border">
            <div className="text-[9px] text-nexus-dim uppercase">Accesses</div>
            <div className="text-sm font-mono text-nexus-accent">{memoryState.stats.totalAccessCount}</div>
          </div>
        </div>

        {/* Recent Memories */}
        {memoryState.recentMemories.length > 0 && (
          <div className="mt-2">
            <div className="text-[9px] text-nexus-dim uppercase mb-1">Recent Memories</div>
            <div className="max-h-20 overflow-y-auto custom-scrollbar border border-nexus-dim/20 p-1 bg-nexus-900/50">
              {memoryState.recentMemories.slice(0, 3).map((mem, i) => (
                <div key={i} className="text-[8px] text-gray-400 border-b border-nexus-dim/10 pb-1 mb-1 truncate">
                  <span className="text-nexus-accent">[{mem.type}]</span> {mem.content.substring(0, 30)}...
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-auto pt-4">
        <div className="p-2 rounded border border-nexus-dim/20 bg-nexus-900/50">
          {(() => {
            // Estimate tokens from messages + RAG content
            const msgChars = (messages || []).reduce((sum, m) => sum + m.content.length, 0);
            const ragChars = toolState.rag.content.reduce((sum, c) => sum + c.length, 0);
            const totalChars = msgChars + ragChars;
            const tokenCount = Math.ceil(totalChars / 4);
            const maxTokens = 100000;
            const usagePct = Math.min(100, Math.round((tokenCount / maxTokens) * 100));
            return (
              <>
                <div className="flex justify-between text-[10px] font-mono text-nexus-dim mb-1">
                    <span>CONTEXT</span>
                    <span>{usagePct}% ({(tokenCount / 1000).toFixed(1)}K tokens)</span>
                </div>
                <div className="h-1 bg-nexus-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-nexus-accent transition-all duration-500" 
                      style={{ width: `${usagePct}%` }}
                    />
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
