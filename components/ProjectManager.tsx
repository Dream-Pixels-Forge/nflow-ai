
import React, { useState, useEffect } from 'react';
import { X, GitBranch, GitCommit, Folder, FileCode, FileJson, FileText, ChevronRight, ChevronDown, Play, Check, AlertTriangle, Laptop } from 'lucide-react';
import { Task, AgentMode, VirtualFile, GitState } from '../types';

interface ProjectManagerProps {
  onClose: () => void;
  tasks: Task[];
  agentHistories: any; 
  files: VirtualFile[]; // Receive dynamic files
  onCommit?: (committedFiles: string[]) => void;
  onMerge?: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onClose, tasks, agentHistories, files, onCommit, onMerge }) => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'git'>('git');
  const [selectedFile, setSelectedFile] = useState<VirtualFile | null>(files[0] || null);
  const [gitState, setGitState] = useState<GitState>({
    branch: 'feature/nexus-update-v1',
    commitHistory: [
      { id: 'a1b2c3d', message: 'Initial commit', timestamp: Date.now() - 100000 }
    ],
    pendingChanges: []
  });
  const [commitMsg, setCommitMsg] = useState('');

  // Effect: Sync external files to Git Pending Changes
  useEffect(() => {
     const changes = files.filter(f => f.status !== 'unmodified');
     setGitState(prev => ({
         ...prev,
         pendingChanges: changes
     }));
     // Also update selected file if it was updated in the background
     if (selectedFile) {
        const updated = files.find(f => f.name === selectedFile.name);
        if (updated) setSelectedFile(updated);
     } else if (files.length > 0) {
        setSelectedFile(files[0]);
     }
  }, [files]);
  
  // Logic to check gatekeepers
  const pendingTests = tasks.filter(t => t.agent === AgentMode.TEST && t.status !== 'done');
  const pendingSecurity = tasks.filter(t => t.agent === AgentMode.SECURE && t.status !== 'done');
  const canMerge = pendingTests.length === 0 && pendingSecurity.length === 0;

  const handleCommit = () => {
    if (!commitMsg) return;
    
    const committedFiles = gitState.pendingChanges.map(c => c.name);
    
    const newCommit = {
      id: Math.random().toString(16).substr(2, 7),
      message: commitMsg,
      timestamp: Date.now()
    };

    setGitState(prev => ({
      ...prev,
      commitHistory: [newCommit, ...prev.commitHistory],
      pendingChanges: []
    }));
    setCommitMsg('');
    onCommit?.(committedFiles);
  };

  const renderFileIcon = (name: string) => {
    if (name.endsWith('json')) return <FileJson size={14} className="text-yellow-400" />;
    if (name.endsWith('ts') || name.endsWith('tsx')) return <FileCode size={14} className="text-blue-400" />;
    return <FileText size={14} className="text-gray-400" />;
  };

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-6xl h-[85vh] bg-[#1e1e1e] border border-nexus-border shadow-2xl flex rounded-lg overflow-hidden font-sans text-sm">
        
        {/* Sidebar */}
        <div className="w-64 bg-[#252526] flex flex-col border-r border-[#333]">
          {/* Sidebar Header */}
          <div className="h-10 flex items-center px-4 text-gray-400 text-xs tracking-wider font-bold uppercase">
            IDE BRIDGE
            <div className="text-[10px] text-gray-500 mt-1">Connect to any IDE</div>
          </div>
          
          {/* IDE Navigation */}
          <div className="flex bg-[#333333] py-1">
             <button 
                onClick={() => setActiveTab('explorer')}
                className={`flex-1 flex justify-center py-2 border-l-2 ${activeTab === 'explorer' ? 'border-nexus-accent text-white' : 'border-transparent text-gray-500'}`}
             >
                <Folder size={20} />
             </button>
             <button 
                onClick={() => setActiveTab('git')}
                className={`flex-1 flex justify-center py-2 border-l-2 ${activeTab === 'git' ? 'border-nexus-accent text-white' : 'border-transparent text-gray-500'}`}
             >
                <div className="relative">
                    <GitBranch size={20} />
                    {gitState.pendingChanges.length > 0 && (
                        <span className="absolute -top-1 -right-2 bg-blue-500 text-white text-[9px] px-1 rounded-full">
                            {gitState.pendingChanges.length}
                        </span>
                    )}
                </div>
             </button>
          </div>

          {/* Explorer Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {activeTab === 'explorer' && (
                <div className="space-y-1">
                    <div className="flex items-center gap-1 text-gray-300 font-bold px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer">
                        <ChevronDown size={14} />
                        <span className="uppercase text-xs">NEXUS-PROJECT</span>
                    </div>
                    {files.map((file, i) => (
                        <div 
                            key={i}
                            onClick={() => setSelectedFile(file)}
                            className={`flex items-center gap-2 px-6 py-1 cursor-pointer hover:bg-[#2a2d2e] ${selectedFile?.name === file.name ? 'bg-[#37373d] text-white' : 'text-gray-400'}`}
                        >
                            {renderFileIcon(file.name)}
                            <span>{file.name}</span>
                            {file.status !== 'unmodified' && (
                                <span className={`ml-auto text-[10px] ${file.status === 'new' ? 'text-green-500' : 'text-yellow-500'}`}>
                                    {file.status === 'new' ? 'U' : 'M'}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'git' && (
                <div className="p-2 space-y-4">
                    <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-2">
                        <GitBranch size={12} />
                        Source Control
                    </div>
                    
                    {/* Commit Input */}
                    <div className="space-y-2">
                        <textarea 
                            value={commitMsg}
                            onChange={(e) => setCommitMsg(e.target.value)}
                            className="w-full bg-[#3c3c3c] text-gray-200 p-2 rounded border border-[#333] focus:border-nexus-accent outline-none resize-none h-20 text-xs font-mono"
                            placeholder="Message (Enter to commit)"
                        />
                        <button 
                            onClick={handleCommit}
                            disabled={gitState.pendingChanges.length === 0 || !commitMsg}
                            className={`w-full py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors
                                ${gitState.pendingChanges.length === 0 || !commitMsg ? 'bg-[#333] text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}
                            `}
                        >
                            <Check size={14} /> Commit
                        </button>
                    </div>

                    {/* Changes List */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400 px-1">
                            <span>Changes</span>
                            <span className="bg-gray-700 px-1.5 rounded-full">{gitState.pendingChanges.length}</span>
                        </div>
                        {gitState.pendingChanges.length === 0 ? (
                            <div className="text-[10px] text-gray-500 italic px-2">No pending changes. Working tree clean.</div>
                        ) : (
                            gitState.pendingChanges.map((file, i) => (
                                <div key={i} className="flex items-center gap-2 px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer text-gray-300">
                                    {renderFileIcon(file.name)}
                                    <span className="truncate text-xs">{file.name}</span>
                                    <span className="ml-auto text-[10px] text-nexus-accent">
                                        {file.status === 'new' ? 'A' : 'M'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
            {/* Tabs */}
            <div className="flex bg-[#252526]">
                {selectedFile && (
                    <div className="px-4 py-2 bg-[#1e1e1e] text-gray-200 text-xs flex items-center gap-2 border-t-2 border-nexus-accent">
                        {renderFileIcon(selectedFile.name)}
                        {selectedFile.name}
                        <X size={12} className="ml-2 hover:text-white cursor-pointer" />
                    </div>
                )}
            </div>

            {/* Code View */}
            <div className="flex-1 p-0 overflow-hidden relative">
                {selectedFile ? (
                    <div className="h-full w-full p-4 font-mono text-sm text-gray-300 overflow-auto">
                        <pre>
                            <code>{selectedFile.content}</code>
                        </pre>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                        <Laptop size={64} className="mb-4 opacity-20" />
                        <p>Select a file to view contents</p>
                    </div>
                )}

                {/* Bottom Panel: Merge Control */}
                <div className="absolute bottom-0 left-0 right-0 bg-[#252526] border-t border-[#333] p-2">
                    <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs text-white">
                                <GitBranch size={14} />
                                <span>{gitState.branch}</span>
                            </div>
                            <div className="h-4 w-px bg-gray-700"></div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className={pendingTests.length > 0 ? 'text-yellow-500' : 'text-green-500'}>
                                    {pendingTests.length} Tests Pending
                                </span>
                                <span className="text-gray-600">|</span>
                                <span className={pendingSecurity.length > 0 ? 'text-red-500' : 'text-green-500'}>
                                    {pendingSecurity.length} Security Flags
                                </span>
                            </div>
                        </div>
                        
                        <button 
                            disabled={!canMerge}
                            onClick={() => { if (canMerge) { handleCommit(); onMerge?.(); } }}
                            className={`
                                px-4 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all
                                ${canMerge 
                                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                                    : 'bg-[#333] text-gray-500 cursor-not-allowed border border-red-900/30'
                                }
                            `}
                        >
                            {!canMerge && <AlertTriangle size={14} />}
                            {canMerge ? 'MERGE TO MAIN' : 'MERGE BLOCKED'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white bg-black/50 p-1 rounded z-50"
        >
            <X size={20} />
        </button>

      </div>
    </div>
  );
};
