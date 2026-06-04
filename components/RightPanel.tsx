import React from 'react';
import { ToolState, AppSettings, Message, AgentMode } from '../types';
import { SystemMonitor } from './SystemMonitor';
import { ToolsPanel } from './ToolsPanel';
import { GitHubPanel } from './GitHubPanel';
import { AgentWorkflow } from './AgentWorkflow';
import { GraphWorkflowPanel } from './GraphWorkflowPanel';
import { EvaluationPanel } from './EvaluationPanel';
import { RAGPanel } from './RAGPanel';
import { AdaptivePanel } from './AdaptivePanel';
import { Activity, Wrench, Github, GitBranch, Layers, PanelRightClose, Network, TestTube, Database } from 'lucide-react';

type TabType = 'telemetry' | 'tools' | 'github' | 'workflow' | 'graph' | 'eval' | 'rag' | 'adaptive';

interface RightPanelProps {
  rightPanelTab: TabType;
  toolState: ToolState;
  settings: AppSettings;
  onSetRightPanelTab: (tab: TabType) => void;
  onSetToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  onUpdateSettings: (newSettings: AppSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
  messages?: Message[];
  activeAgent?: AgentMode;
  isProcessing?: boolean;
  onAdaptiveAction?: (action: string, agent: string) => void;
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
  isProcessing,
  onAdaptiveAction,
}) => {
  if (!isOpen) return null;

  // Determine which content to show
  const isMainTab = ['telemetry', 'tools', 'github'].includes(rightPanelTab);
  const isSecondaryTab = ['workflow', 'graph', 'eval', 'rag', 'adaptive'].includes(rightPanelTab);

  return (
    <div className="w-80 bg-nexus-900 border-l border-nexus-border flex flex-col z-10 shadow-xl">
      {/* Primary Tabs Row */}
      <div className="flex border-b border-nexus-border">
        <button
          onClick={() => onSetRightPanelTab('telemetry')}
          className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
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
          className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
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
          className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'github'
              ? 'bg-nexus-800/50 text-nexus-accent border-b-2 border-nexus-accent'
              : 'bg-nexus-900 text-gray-500 hover:bg-nexus-800/50 hover:text-gray-300'
          }`}
        >
          <Github size={12} />
          GitHub
        </button>
        <button
          onClick={onToggle}
          className="px-2 py-2 bg-nexus-800 hover:bg-nexus-700 border-l border-nexus-border text-gray-500 hover:text-white transition-colors"
          title="Collapse Panel"
        >
          <PanelRightClose size={12} />
        </button>
      </div>

      {/* Secondary Tabs Row - Flow, Graph & Adaptive */}
      <div className="flex border-b border-nexus-border bg-nexus-800/30">
        <button
          onClick={() => onSetRightPanelTab('workflow')}
          className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'workflow'
              ? 'text-cyan-400 border-b border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <GitBranch size={10} />
          Flow
        </button>
        <button
          onClick={() => onSetRightPanelTab('graph')}
          className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'graph'
              ? 'text-cyan-400 border-b border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Network size={10} />
          Graph
        </button>
        <button
          onClick={() => onSetRightPanelTab('adaptive')}
          className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'adaptive'
              ? 'text-cyan-400 border-b border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Layers size={10} />
          Adaptive
        </button>
        <button
          onClick={() => onSetRightPanelTab('eval')}
          className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'eval'
              ? 'text-cyan-400 border-b border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <TestTube size={10} />
          Eval
        </button>
        <button
          onClick={() => onSetRightPanelTab('rag')}
          className={`flex-1 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            rightPanelTab === 'rag'
              ? 'text-cyan-400 border-b border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Database size={10} />
          RAG
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {rightPanelTab === 'telemetry' && <SystemMonitor messages={messages} />}
        {rightPanelTab === 'tools' && <ToolsPanel toolState={toolState} setToolState={onSetToolState} messages={messages} />}
        {rightPanelTab === 'github' && <GitHubPanel settings={settings} onUpdate={onUpdateSettings} />}
        {rightPanelTab === 'workflow' && <AgentWorkflow activeAgent={activeAgent || 'CHAT' as AgentMode} />}
        {rightPanelTab === 'graph' && (
          <GraphWorkflowPanel
            activeAgent={activeAgent || 'CHAT' as AgentMode}
            isProcessing={isProcessing || false}
          />
        )}
        {rightPanelTab === 'adaptive' && (
          <AdaptivePanel 
            activeAgent={activeAgent || 'CHAT' as AgentMode} 
            isProcessing={isProcessing || false}
            onAction={onAdaptiveAction}
          />
        )}
        {rightPanelTab === 'eval' && <EvaluationPanel />}
        {rightPanelTab === 'rag' && <RAGPanel />}
      </div>
    </div>
  );
};
