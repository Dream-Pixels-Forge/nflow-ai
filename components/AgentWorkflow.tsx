/**
 * AgentWorkflow - Visual agent status matrix and task flow
 * 
 * Shows real-time agent relationships, active tasks, and handoffs.
 */

import React, { useState, useEffect } from 'react';
import { AgentMode, AGENTS } from '../types';
import { useAgenticSystems } from '../hooks/useAgenticSystems';
import { AgentStatus, AgentPhase } from '../src/agentic';
import { taskManager, Task } from '../src/a2a/TaskManager';
import { GitBranch, ArrowRight, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface AgentWorkflowProps {
  activeAgent: AgentMode;
}

// Status symbols for terminal aesthetic
const STATUS_SYMBOLS: Record<AgentStatus, string> = {
  'HEALTHY': '●',
  'DRIFTING': '◐',
  'STALLED': '○',
  'CRASHED': '✕',
  'IDLE': '·'
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  'HEALTHY': 'text-green-400',
  'DRIFTING': 'text-yellow-400',
  'STALLED': 'text-orange-400',
  'CRASHED': 'text-red-400',
  'IDLE': 'text-gray-600'
};

// Agent flow connections (who hands off to whom)
const AGENT_FLOWS: Partial<Record<AgentMode, AgentMode[]>> = {
  [AgentMode.CHAT]: [AgentMode.PLAN, AgentMode.CODER],
  [AgentMode.PLAN]: [AgentMode.ARCHITECT, AgentMode.CODER],
  [AgentMode.ARCHITECT]: [AgentMode.CODER, AgentMode.TEST],
  [AgentMode.CODER]: [AgentMode.TEST, AgentMode.SECURE],
  [AgentMode.TEST]: [AgentMode.DEPLOY, AgentMode.CODER],
  [AgentMode.SECURE]: [AgentMode.DEPLOY],
  [AgentMode.DEPLOY]: [AgentMode.MONITOR],
  [AgentMode.MONITOR]: []
};

export const AgentWorkflow: React.FC<AgentWorkflowProps> = ({ activeAgent }) => {
  const [agenticState] = useAgenticSystems();
  const { agentStates } = agenticState;
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [recentHandoffs, setRecentHandoffs] = useState<Array<{from: string, to: string, time: string}>>([]);

  // Refresh A2A tasks periodically
  useEffect(() => {
    const refresh = () => {
      const tasks = taskManager.getActiveTasks();
      setActiveTasks(tasks);
      
      // Extract recent handoffs from task metadata
      const handoffs: Array<{from: string, to: string, time: string}> = [];
      tasks.forEach(task => {
        if (task.metadata?.sourceAgent && task.metadata?.handoffReason) {
          handoffs.push({
            from: task.metadata.sourceAgent,
            to: task.agentId,
            time: task.createdAt
          });
        }
      });
      setRecentHandoffs(handoffs.slice(-5)); // Last 5 handoffs
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  // Get agent status from agentic system
  const getAgentStatus = (agentMode: AgentMode): { status: AgentStatus; phase: AgentPhase } => {
    const agentId = agentMode.toUpperCase();
    const state = agentStates.get(agentId);
    return {
      status: state?.status || 'IDLE',
      phase: state?.phase || 'P'
    };
  };

  // Get agent color class
  const getAgentColorClass = (agentMode: AgentMode, isActive: boolean): string => {
    if (isActive) return AGENTS[agentMode].color;
    return 'text-gray-600';
  };

  return (
    <div className="bg-nexus-900 border border-nexus-border rounded-sm p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <GitBranch size={14} className="text-nexus-accent" />
        <span className="text-[10px] font-mono uppercase text-nexus-dim">Agent Workflow</span>
      </div>

      {/* Agent Status Matrix */}
      <div className="mb-4">
        <div className="text-[9px] font-mono text-gray-500 mb-2">STATUS MATRIX</div>
        <div className="grid grid-cols-4 gap-1">
          {Object.values(AgentMode).map(mode => {
            const { status } = getAgentStatus(mode);
            const isActive = activeAgent === mode;
            const shortName = mode.slice(0, 4); // First 4 chars
            
            return (
              <div 
                key={mode}
                className={`flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-mono ${
                  isActive ? 'bg-nexus-800 border border-nexus-accent/30' : 'bg-nexus-900/50'
                }`}
              >
                <span className={STATUS_COLORS[status]}>{STATUS_SYMBOLS[status]}</span>
                <span className={getAgentColorClass(mode, isActive)}>{shortName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="mb-4">
        <div className="text-[9px] font-mono text-gray-500 mb-2">FLOW PATH</div>
        <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono">
          {Object.entries(AGENT_FLOWS).map(([from, tos]) => {
            if (!tos || tos.length === 0) return null;
            const isActive = activeAgent === from;
            return (
              <div key={from} className={`flex items-center gap-1 ${isActive ? 'text-nexus-accent' : 'text-gray-600'}`}>
                <span>{from.slice(0, 4)}</span>
                <ArrowRight size={8} />
                <span>{tos.map(t => t.slice(0, 4)).join(',')}</span>
                {isActive && <span className="text-nexus-accent animate-pulse">◄</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active A2A Tasks */}
      {activeTasks.length > 0 && (
        <div className="mb-3">
          <div className="text-[9px] font-mono text-gray-500 mb-2">ACTIVE TASKS</div>
          <div className="space-y-1">
            {activeTasks.slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center gap-2 text-[9px] font-mono px-2 py-1 bg-nexus-800/50 rounded">
                <Clock size={10} className="text-cyan-400 shrink-0" />
                <span className="text-cyan-400">{task.agentId.slice(0, 4)}</span>
                <span className="text-gray-500 truncate flex-1">{task.state}</span>
                <span className="text-gray-600">{new Date(task.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Handoffs */}
      {recentHandoffs.length > 0 && (
        <div>
          <div className="text-[9px] font-mono text-gray-500 mb-2">RECENT HANDOFFS</div>
          <div className="space-y-1">
            {recentHandoffs.map((handoff, i) => (
              <div key={i} className="flex items-center gap-1 text-[9px] font-mono">
                <span className="text-yellow-400">{handoff.from.slice(0, 4)}</span>
                <ArrowRight size={8} className="text-yellow-500" />
                <span className="text-green-400">{handoff.to.slice(0, 4)}</span>
                <span className="text-gray-600 ml-auto">{new Date(handoff.time).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-nexus-border">
        <div className="flex flex-wrap gap-2 text-[8px] font-mono text-gray-600">
          <span><span className="text-green-400">●</span> Healthy</span>
          <span><span className="text-yellow-400">◐</span> Drifting</span>
          <span><span className="text-orange-400">○</span> Stalled</span>
          <span><span className="text-red-400">✕</span> Crashed</span>
          <span><span className="text-gray-600">·</span> Idle</span>
        </div>
      </div>
    </div>
  );
};
