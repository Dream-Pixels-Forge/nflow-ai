import React from 'react';
import { AGENTS, AgentMode, Task, VirtualFile } from '../types';
import { FolderOpen, ListTodo, Check, ArrowRightLeft } from 'lucide-react';
import { AgentGrid } from './AgentGrid';
import { SystemMonitor } from './SystemMonitor';
import { ToolsPanel } from './ToolsPanel';
import { ToolState } from '../types';

interface SidebarProps {
  activeAgent: AgentMode;
  pendingSwitch: AgentMode | null;
  tasks: Task[];
  sidebarTab: 'telemetry' | 'tools';
  toolState: ToolState;
  onSetSidebarTab: (tab: 'telemetry' | 'tools') => void;
  onSwitchAgent: (agent: AgentMode) => void;
  onDismissPendingSwitch: () => void;
  onShowTaskDashboard: () => void;
  onSetToolState: React.Dispatch<React.SetStateAction<ToolState>>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeAgent,
  pendingSwitch,
  tasks,
  sidebarTab,
  toolState,
  onSetSidebarTab,
  onSwitchAgent,
  onDismissPendingSwitch,
  onShowTaskDashboard,
  onSetToolState
}) => {
  return (
    <div className="w-80 bg-nexus-900 border-r border-nexus-border flex flex-col z-10 shadow-xl">
      <div className={`p-4 border-b border-nexus-border flex items-center gap-3 transition-all duration-300 ${pendingSwitch ? 'bg-nexus-900' : 'bg-nexus-800/30'}`}>
        {pendingSwitch ? (
          <>
             <div className={`p-1.5 rounded-sm border animate-pulse ${AGENTS[pendingSwitch].color.replace('text-', 'border-')} bg-opacity-10`}>
                <ArrowRightLeft size={18} className={AGENTS[pendingSwitch].color} />
             </div>
             <div className="flex-1 min-w-0">
                <h1 className={`font-bold text-xs tracking-wider mb-0.5 ${AGENTS[pendingSwitch].color} truncate`}>
                    SUGGESTION: {AGENTS[pendingSwitch].id}
                </h1>
                 <div className="flex items-center gap-2">
                    <button
                        onClick={() => onSwitchAgent(pendingSwitch)}
                        className="text-[10px] bg-nexus-800 hover:bg-nexus-700 text-nexus-accent px-2 py-0.5 rounded border border-nexus-border hover:border-nexus-accent transition-colors flex items-center gap-1"
                    >
                        <Check size={10} /> ACCEPT
                    </button>
                    <button
                        onClick={onDismissPendingSwitch}
                        className="text-[10px] text-nexus-dim hover:text-gray-300 px-1 py-0.5 transition-colors"
                    >
                        DISMISS
                    </button>
                </div>
             </div>
          </>
        ) : (
          <>
            <div className="bg-nexus-accent text-black p-1 rounded-sm">
              <FolderOpen size={20} />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-white tracking-wider text-sm">PROJECT ROOT</h1>
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-nexus-accent">
                      <span className="w-1.5 h-1.5 bg-nexus-accent rounded-full animate-pulse"></span>
                      ACTIVE
                  </div>
                  {tasks.length > 0 && (
                      <button
                          onClick={onShowTaskDashboard}
                          className="text-[9px] bg-nexus-800 px-1.5 rounded border border-nexus-border hover:text-white transition-colors flex items-center gap-1"
                      >
                          <ListTodo size={9} />
                          {tasks.filter(t => t.status !== 'done').length} TASKS
                      </button>
                  )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AgentGrid activeAgent={activeAgent} />
      </div>

      <div className="h-[400px] border-t border-nexus-border flex flex-col bg-nexus-900">
         <div className="flex border-b border-nexus-border">
            <button
              onClick={() => onSetSidebarTab('telemetry')}
              className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                sidebarTab === 'telemetry'
                  ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
                  : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
              }`}
            >
              Telemetry
            </button>
            <button
              onClick={() => onSetSidebarTab('tools')}
              className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                sidebarTab === 'tools'
                  ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
                  : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
              }`}
            >
              Tools
            </button>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {sidebarTab === 'telemetry'
              ? <SystemMonitor />
              : <ToolsPanel toolState={toolState} setToolState={onSetToolState} />
            }
         </div>
      </div>
    </div>
  );
};
