/**
 * AdaptivePanel - Generative UI that adapts to agent activity
 * 
 * Dynamically shows relevant panels, tools, and information
 * based on what the active agent is currently doing.
 */

import React, { useEffect, useState } from 'react';
import { AgentMode } from '../types';
import { useAgenticSystems } from '../hooks/useAgenticSystems';
import { AgentStatus } from '../src/agentic';
import { collaborationManager } from '../src/agentic/CollaborationManager';
import { learningManager } from '../src/agentic/LearningManager';
import { 
  Code, 
  Shield, 
  TestTube, 
  Rocket, 
  Activity, 
  Map, 
  Cpu, 
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  GitBranch
} from 'lucide-react';

interface AdaptivePanelProps {
  activeAgent: AgentMode;
  isProcessing: boolean;
  onAction?: (action: string, agent: string) => void;
}

interface AgentContext {
  agent: AgentMode;
  status: AgentStatus;
  isBusy: boolean;
  recentErrors: number;
  suggestions: number;
  activeLessons: number;
}

// Panel configurations per agent
const AGENT_PANELS: Record<AgentMode, {
  icon: React.ReactNode;
  label: string;
  color: string;
  metrics: string[];
  actions: string[];
}> = {
  [AgentMode.CHAT]: {
    icon: <MessageSquare size={16} />,
    label: 'Coordination Hub',
    color: 'text-gray-300',
    metrics: ['Active agents', 'Pending tasks', 'Recent handoffs'],
    actions: ['Route to specialist', 'Create task', 'View status']
  },
  [AgentMode.PLAN]: {
    icon: <Map size={16} />,
    label: 'Planning Dashboard',
    color: 'text-blue-400',
    metrics: ['Tasks defined', 'Completion rate', 'Blocked items'],
    actions: ['Add task', 'Update roadmap', 'Review criteria']
  },
  [AgentMode.ARCHITECT]: {
    icon: <Cpu size={16} />,
    label: 'Architecture View',
    color: 'text-purple-400',
    metrics: ['Components', 'Dependencies', 'Complexity'],
    actions: ['View diagram', 'Add component', 'Review patterns']
  },
  [AgentMode.CODER]: {
    icon: <Code size={16} />,
    label: 'Code Editor',
    color: 'text-cyan-400',
    metrics: ['Files changed', 'Lines added', 'Tests needed'],
    actions: ['Generate code', 'Run tests', 'Commit changes']
  },
  [AgentMode.TEST]: {
    icon: <TestTube size={16} />,
    label: 'Test Runner',
    color: 'text-yellow-400',
    metrics: ['Tests passed', 'Coverage', 'Failures'],
    actions: ['Run tests', 'View coverage', 'Fix failures']
  },
  [AgentMode.SECURE]: {
    icon: <Shield size={16} />,
    label: 'Security Scanner',
    color: 'text-red-500',
    metrics: ['Vulnerabilities', 'Risk level', 'Fixes applied'],
    actions: ['Scan code', 'Review OWASP', 'Apply fixes']
  },
  [AgentMode.DEPLOY]: {
    icon: <Rocket size={16} />,
    label: 'Deployment Pipeline',
    color: 'text-orange-400',
    metrics: ['Build status', 'Deploy target', 'Health'],
    actions: ['Build', 'Deploy', 'Rollback']
  },
  [AgentMode.MONITOR]: {
    icon: <Activity size={16} />,
    label: 'Monitoring Center',
    color: 'text-emerald-500',
    metrics: ['Uptime', 'Errors', 'Performance'],
    actions: ['View logs', 'Check metrics', 'Set alerts']
  }
};

export const AdaptivePanel: React.FC<AdaptivePanelProps> = ({ 
  activeAgent, 
  isProcessing,
  onAction
}) => {
  const [agenticState] = useAgenticSystems();
  const { agentStates } = agenticState;
  const [context, setContext] = useState<AgentContext | null>(null);

  // Update context when agent or state changes
  useEffect(() => {
    const agentState = agentStates.get(activeAgent.toUpperCase());
    const suggestions = collaborationManager.getActiveSuggestions(activeAgent);
    const learning = learningManager.getLearnedPatterns(activeAgent);
    
    setContext({
      agent: activeAgent,
      status: agentState?.status || 'IDLE',
      isBusy: isProcessing,
      recentErrors: learning.totalErrors,
      suggestions: suggestions.length,
      activeLessons: learning.patterns.length
    });
  }, [activeAgent, agentStates, isProcessing]);

  if (!context) return null;

  const panelConfig = AGENT_PANELS[context.agent];
  const statusColor = context.status === 'HEALTHY' ? 'text-green-400' :
                      context.status === 'DRIFTING' ? 'text-yellow-400' :
                      context.status === 'STALLED' ? 'text-orange-400' :
                      context.status === 'CRASHED' ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="bg-nexus-900 border border-nexus-border rounded-sm p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={panelConfig.color}>{panelConfig.icon}</span>
          <span className="text-[10px] font-mono uppercase text-nexus-dim">
            {panelConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {context.isBusy && (
            <span className="text-[9px] font-mono text-cyan-400 animate-pulse">BUSY</span>
          )}
          <span className={`text-[9px] font-mono ${statusColor}`}>
            {context.status}
          </span>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {panelConfig.metrics.map((metric, i) => (
          <div key={i} className="bg-nexus-800/50 p-2 rounded-sm text-center">
            <div className="text-[8px] text-gray-500 mb-1">{metric}</div>
            <div className="text-sm font-mono text-white">
              {i === 0
                ? agentStates.size
                : i === 1
                  ? agenticState.activeSessions?.length ?? 0
                  : agenticState.isHalted
                    ? 'DEGRADED'
                    : 'OK'}
            </div>
          </div>
        ))}
      </div>

      {/* Context-Aware Actions */}
      <div className="mb-3">
        <div className="text-[9px] font-mono text-gray-500 mb-2">QUICK ACTIONS</div>
        <div className="flex flex-wrap gap-1">
          {panelConfig.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction?.(action, activeAgent)}
              className="px-2 py-1 text-[9px] font-mono bg-nexus-800 hover:bg-nexus-700 
                         border border-nexus-border rounded-sm transition-colors
                         text-gray-400 hover:text-white"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Adaptive Insights */}
      {(context.suggestions > 0 || context.activeLessons > 0) && (
        <div className="border-t border-nexus-border pt-2">
          <div className="text-[9px] font-mono text-gray-500 mb-2">INSIGHTS</div>
          
          {context.suggestions > 0 && (
            <div className="flex items-center gap-2 text-[10px] mb-1">
              <GitBranch size={10} className="text-cyan-400" />
              <span className="text-cyan-400">{context.suggestions} collaboration suggestions</span>
            </div>
          )}
          
          {context.activeLessons > 0 && (
            <div className="flex items-center gap-2 text-[10px] mb-1">
              <Lightbulb size={10} className="text-yellow-400" />
              <span className="text-yellow-400">{context.activeLessons} learned patterns active</span>
            </div>
          )}
          
          {context.recentErrors > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <AlertTriangle size={10} className="text-orange-400" />
              <span className="text-orange-400">{context.recentErrors} recent errors tracked</span>
            </div>
          )}
        </div>
      )}

      {/* Agent-Specific Hints */}
      {context.agent === AgentMode.CODER && (
        <div className="mt-2 p-2 bg-cyan-900/20 border border-cyan-500/30 rounded-sm">
          <div className="text-[9px] text-cyan-400 font-mono">
            💡 Tip: Use FILE: format for code generation
          </div>
        </div>
      )}
      
      {context.agent === AgentMode.TEST && (
        <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded-sm">
          <div className="text-[9px] text-yellow-400 font-mono">
            💡 Tip: Check PROJECT TASK BOARD for features to test
          </div>
        </div>
      )}
      
      {context.agent === AgentMode.SECURE && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-sm">
          <div className="text-[9px] text-red-400 font-mono">
            💡 Tip: Review OWASP Top 10 for vulnerabilities
          </div>
        </div>
      )}
    </div>
  );
};
