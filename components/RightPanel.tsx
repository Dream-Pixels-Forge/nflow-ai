import React from 'react';
import { ToolState, AppSettings, Message, AgentMode } from '../types';
import { SystemMonitor } from './SystemMonitor';
import { ToolsPanel } from './ToolsPanel';
import { GitHubPanel } from './GitHubPanel';
import { AgentWorkflow } from './AgentWorkflow';
import { AdaptivePanel } from './AdaptivePanel';
import { Activity, Wrench, Github, GitBranch, Layers, PanelRightClose } from 'lucide-react';

interface RightPanelProps {
  rightPanelTab: 'telemetry' | 'tools' | 'github' | 'workflow' | 'adaptive';
  toolState: ToolState;
  settings: AppSettings;
  onSetRightPanelTab: (tab: 'telemetry' | 'tools' | 'github' | 'workflow' | 'adaptive') => void;
  onSetToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  onUpdateSettings: (newSettings: AppSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
  messages?: Message[];
  activeAgent?: AgentMode;
  isProcessing?: boolean;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  rightPanelTab,
  toolState,
  settings,
  onSetRightPanelTab,
  onSetToolState,
  onUpdateSettings,
  isOpen,
  onToggle,
  messages,
  activeAgent,
  isProcessing
}) => {
  if (!isOpen) return null;

  return (
    <div className="w-80 bg-nexus-900 border-l border-nexus-border flex flex-col z-10 shadow-xl">
      {/* Tab Buttons with Toggle */}
      <div className="flex border-b border-nexus-border">
        <button
          onClick={() => onSetRightPanelTab('telemetry')}
          className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'telemetry'
              ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
              : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
          }`}
        >
          <Activity size={12} />
          Telemetry
        </button>
        <button
          onClick={() => onSetRightPanelTab('tools')}
          className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'tools'
              ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
              : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
          }`}
        >
          <Wrench size={12} />
          Tools
        </button>
        <button
          onClick={() => onSetRightPanelTab('github')}
          className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'github'
              ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
              : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
          }`}
        >
          <Github size={12} />
          GitHub
        </button>
        <button
          onClick={() => onSetRightPanelTab('workflow')}
          className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'workflow'
              ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
              : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
          }`}
        >
          <GitBranch size={12} />
          Flow
        </button>
        <button
          onClick={() => onSetRightPanelTab('adaptive')}
          className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'adaptive'
              ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
              : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
          }`}
        >
          <Layers size={12} />
          Adaptive
        </button>
        <button
          onClick={onToggle}
          className="px-2 py-2.5 bg-nexus-800 hover:bg-nexus-700 border-l border-nexus-border text-gray-500 hover:text-white transition-colors"
          title="Collapse Panel"
        >
          <PanelRightClose size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {rightPanelTab === 'telemetry' && <SystemMonitor />}
        {rightPanelTab === 'tools' && <ToolsPanel toolState={toolState} setToolState={onSetToolState} messages={messages} />}
        {rightPanelTab === 'github' && <GitHubPanel settings={settings} onUpdate={onUpdateSettings} />}
        {rightPanelTab === 'workflow' && <AgentWorkflow activeAgent={activeAgent || 'CHAT' as AgentMode} />}
        {rightPanelTab === 'adaptive' && (
          <AdaptivePanel 
            activeAgent={activeAgent || 'CHAT' as AgentMode} 
            isProcessing={isProcessing || false} 
          />
        )}
      </div>
    </div>
  );
};
