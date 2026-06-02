import React from 'react';
import { ToolState } from '../types';
import { SystemMonitor } from './SystemMonitor';
import { ToolsPanel } from './ToolsPanel';
import { Activity, Wrench, X } from 'lucide-react';

interface RightPanelProps {
  rightPanelTab: 'telemetry' | 'tools';
  toolState: ToolState;
  onSetRightPanelTab: (tab: 'telemetry' | 'tools') => void;
  onSetToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  isOpen: boolean;
  onClose: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  rightPanelTab,
  toolState,
  onSetRightPanelTab,
  onSetToolState,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="w-80 bg-nexus-900 border-l border-nexus-border flex flex-col z-10 shadow-xl">
      {/* Header */}
      <div className="p-3 border-b border-nexus-border flex items-center justify-between bg-nexus-800/30">
        <div className="flex items-center gap-2">
          <div className="bg-nexus-accent text-black p-1 rounded-sm">
            {rightPanelTab === 'telemetry' ? <Activity size={16} /> : <Wrench size={16} />}
          </div>
          <span className="text-xs font-mono font-bold text-white tracking-wider uppercase">
            {rightPanelTab === 'telemetry' ? 'System Monitor' : 'Tools'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-nexus-700 rounded-sm text-gray-500 hover:text-white transition-colors"
          title="Close Panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab Buttons */}
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {rightPanelTab === 'telemetry'
          ? <SystemMonitor />
          : <ToolsPanel toolState={toolState} setToolState={onSetToolState} />
        }
      </div>
    </div>
  );
};
