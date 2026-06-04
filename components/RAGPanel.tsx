import React, { useState, useEffect } from 'react';
import { Database, Search, FileText, Code, Trash2 } from 'lucide-react';
import { ragManager } from '../src/rag/RAGManager';

interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface DocEntry {
  id: string;
  text: string;
  vector: [string, number][];
  metadata: Record<string, unknown>;
  indexedAt: string;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 0.7 ? 'text-green-400 bg-green-900/30 border-green-500/30'
    : score >= 0.4 ? 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30'
    : 'text-red-400 bg-red-900/30 border-red-500/30';
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}

export const RAGPanel: React.FC = () => {
  const [stats, setStats] = useState({ totalDocs: 0, vocabSize: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentDocs, setRecentDocs] = useState<DocEntry[]>([]);
  const [indexed, setIndexed] = useState(false);

  useEffect(() => {
    ragManager.init().then(() => refreshStats());
  }, []);

  const refreshStats = () => {
    setStats(ragManager.getStats());
    setRecentDocs(ragManager.getRecentDocuments(10) as unknown as DocEntry[]);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const ctx = ragManager.searchContext(searchQuery, 2000);
    // Parse the context string back into results for display
    const lines = ctx.split('\n\n').filter(Boolean);
    const parsed: SearchResult[] = lines.map((line, i) => {
      const match = line.match(/\[Similarity: ([\d.]+)\] (.+)/);
      return match
        ? { id: `r-${i}`, text: match[2], score: parseFloat(match[1]), metadata: {} }
        : { id: `r-${i}`, text: line, score: 0, metadata: {} };
    });
    setResults(parsed);
  };

  const handleIndexConversation = async (messages: Array<{ role: string; content: string }>) => {
    for (const msg of messages) {
      await ragManager.indexMessage(msg.role, msg.content);
    }
    setIndexed(true);
    refreshStats();
  };

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-mono text-nexus-accent">
        <Database size={14} />
        <span className="font-bold">RAG VECTOR SEARCH</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-nexus-800 border border-nexus-border rounded p-2 text-center">
          <div className="text-lg font-mono font-bold text-nexus-accent">{stats.totalDocs}</div>
          <div className="text-[9px] text-gray-500 font-mono">DOCUMENTS</div>
        </div>
        <div className="bg-nexus-800 border border-nexus-border rounded p-2 text-center">
          <div className="text-lg font-mono font-bold text-white">{stats.vocabSize}</div>
          <div className="text-[9px] text-gray-500 font-mono">VOCABULARY</div>
        </div>
      </div>

      {/* Search */}
      <div>
        <label className="text-[10px] text-gray-500 font-mono uppercase mb-1 block">Semantic Search</label>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search indexed content..."
            className="flex-1 bg-nexus-800 border border-nexus-border rounded px-2 py-1.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-nexus-accent"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 bg-nexus-accent/20 border border-nexus-accent/50 text-nexus-accent rounded text-[10px] font-mono font-bold hover:bg-nexus-accent/30 transition-colors"
          >
            <Search size={12} />
          </button>
        </div>
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-mono uppercase mb-2">Results</div>
          <div className="space-y-1">
            {results.map(r => (
              <div key={r.id} className="px-2 py-1.5 bg-nexus-800 border border-nexus-border rounded text-[10px]">
                <div className="flex items-center gap-2 mb-1">
                  <ScoreBadge score={r.score} />
                  <span className="text-gray-600 font-mono truncate flex-1">{r.text.slice(0, 60)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Documents */}
      <div>
        <div className="text-[10px] text-gray-500 font-mono uppercase mb-2">Recent Documents</div>
        {recentDocs.length > 0 ? (
          <div className="space-y-1">
            {recentDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 px-2 py-1.5 bg-nexus-800 border border-nexus-border rounded text-[10px]">
                {doc.metadata.type === 'code' ? (
                  <Code size={10} className="text-purple-400 flex-shrink-0" />
                ) : (
                  <FileText size={10} className="text-cyan-400 flex-shrink-0" />
                )}
                <span className="text-gray-300 font-mono flex-1 truncate">{doc.text.slice(0, 50)}</span>
                <span className="text-gray-600 font-mono text-[9px]">
                  {new Date(doc.indexedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-600 text-[10px] font-mono">
            No documents indexed yet
          </div>
        )}
      </div>
    </div>
  );
};
