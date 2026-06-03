import React from 'react';
import { AgentMode, AGENTS } from '../types';
import { 
  MessageSquare, 
  Map as MapIcon, 
  Cpu, 
  Code, 
  FlaskConical, 
  ShieldAlert, 
  Rocket, 
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { useAgenticSystems } from '../hooks/useAgenticSystems';
import { AgentStatus, AgentPhase, PHASE_CONFIGS } from '../src/agentic';

interface AgentGridProps {
  activeAgent: AgentMode;
}

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

const getStatusColor = (status: AgentStatus): string => {
  switch (status) {
    case 'HEALTHY': return 'text-green-500';
    case 'DRIFTING': return 'text-yellow-500';
    case 'STALLED': return 'text-orange-500';
    case 'CRASHED': return 'text-red-500';
    case 'IDLE': return 'text-gray-500';
    default: return 'text-gray-500';
  }
};

const getStatusIcon = (status: AgentStatus) => {
  switch (status) {
    case 'HEALTHY': return <CheckCircle size={10} />;
    case 'DRIFTING': return <AlertTriangle size={10} />;
    case 'STALLED': return <AlertTriangle size={10} />;
    case 'CRASHED': return <XCircle size={10} />;
    case 'IDLE': return <Activity size={10} />;
    default: return <Activity size={10} />;
  }
};

const getPhaseColor = (phase: AgentPhase): string => {
  const colors: Record<AgentPhase, string> = {
    P: 'bg-purple-900/50 text-purple-400',
    R: 'bg-blue-900/50 text-blue-400',
    I: 'bg-green-900/50 text-green-400',
    D: 'bg-orange-900/50 text-orange-400',
    E: 'bg-cyan-900/50 text-cyan-400',
    S: 'bg-red-900/50 text-red-400'
  };
  return colors[phase] || 'bg-gray-900/50 text-gray-400';
};

// Map AgentMode to agent ID for agentic system lookup
const AGENT_MODE_TO_ID: Record<AgentMode, string> = {
  [AgentMode.CHAT]: 'CHAT',
  [AgentMode.PLAN]: 'PLAN',
  [AgentMode.ARCHITECT]: 'ARCHITECT',
  [AgentMode.CODER]: 'CODER',
  [AgentMode.TEST]: 'TEST',
  [AgentMode.SECURE]: 'SECURE',
  [AgentMode.DEPLOY]: 'DEPLOY',
  [AgentMode.MONITOR]: 'MONITOR'
};

export const AgentGrid: React.FC<AgentGridProps> = ({ activeAgent }) => {
  // Agentic systems
  const [agenticState] = useAgenticSystems();
  const { agentStates } = agenticState;

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {Object.values(AGENTS).map((agent) => {
        // Safe check for icon existence to prevent runtime errors
        const IconComponent = AGENT_ICONS[agent.icon] || MessageSquare;
        const isActive = activeAgent === agent.id;
        
        // Get agent health from agentic system
        const agentId = AGENT_MODE_TO_ID[agent.id as AgentMode];
        const agentHealth = agentStates.get(agentId);
        const status = agentHealth?.status || 'IDLE';
        const phase = agentHealth?.phase || 'P';

        return (
          <div
            key={agent.id}
            className={`
              relative group p-3 border rounded-sm transition-all duration-200
              ${isActive 
                ? 'bg-nexus-800 border-nexus-accent shadow-[0_0_10px_rgba(0,255,157,0.2)]' 
                : 'bg-nexus-900/50 border-nexus-border opacity-60 hover:opacity-100'
              }
            `}
          >
            {isActive && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nexus-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-nexus-accent"></span>
                </span>
            )}
            
            <div className="flex items-start gap-3">
              <div className={`${isActive ? agent.color : 'text-gray-500'}`}>
                <IconComponent size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={`font-mono text-xs font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {agent.name}
                  </h4>
                  {/* Status Indicator */}
                  <span className={`flex items-center gap-1 text-[8px] font-mono ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight mt-1">
                  {agent.description}
                </p>
                {/* Phase Badge */}
                <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-mono ${getPhaseColor(phase)}`}>
                  <span>PHASE: {phase}</span>
                </div>
              </div>
            </div>
            
            {/* Flip Card Container */}
            <div className="absolute inset-0 perspective-[1000px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 pointer-events-none overflow-hidden">
              <div className="absolute inset-0 transform-style-preserve-3d transition-transform duration-500 group-hover:rotate-y-180">
                {/* Front Face */}
                <div className="absolute inset-0 backface-hidden bg-nexus-800 border border-nexus-accent p-2 rounded-sm overflow-hidden">
                  <div className="flex items-start gap-2">
                    <div className={`${isActive ? agent.color : 'text-gray-500'} shrink-0`}>
                      <IconComponent size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`font-mono text-[11px] font-bold truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                          {agent.name}
                        </h4>
                        <span className={`shrink-0 flex items-center gap-1 text-[8px] font-mono ${getStatusColor(status)}`}>
                          {getStatusIcon(status)}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-500 leading-tight mt-0.5 truncate">
                        {agent.id} MODULE
                      </p>
                      <div className={`inline-flex items-center gap-1 mt-1 px-1 py-0.5 rounded text-[7px] font-mono ${getPhaseColor(phase)}`}>
                        <span>PHASE: {phase}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back Face - Flipped content */}
                <div className="absolute inset-0 backface-hidden bg-nexus-800 border border-nexus-accent p-2 rounded-sm rotate-y-180 overflow-hidden flex flex-col">
                  <p className="text-[9px] text-gray-300 leading-snug mb-1.5 line-clamp-3">
                    {agent.description}
                  </p>
                  <div className="border-t border-nexus-border pt-1.5 mt-auto">
                    <div className="text-[8px] text-nexus-accent font-bold uppercase mb-1">Quick Commands</div>
                    <div className="space-y-0.5">
                      <div className="text-[8px] text-gray-400 truncate">
                        <span className="bg-nexus-900 px-1 rounded text-nexus-accent">/{agent.id.toLowerCase()}</span> Switch agent
                      </div>
                      <div className="text-[8px] text-gray-400 truncate">
                        <span className="bg-nexus-900 px-1 rounded text-nexus-accent">/tasks</span> View tasks
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      <div className="col-span-2 mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded text-[10px] text-blue-300 font-mono">
        <span className="font-bold">TIP:</span> Use <span className="bg-blue-900 px-1 rounded border border-blue-700">/chat</span>, <span className="bg-blue-900 px-1 rounded border border-blue-700">/coder</span> to jump channels, or <span className="bg-blue-900 px-1 rounded border border-blue-700">TAB</span> to cycle.
      </div>

      <style>{`
        .perspective-\[1000px\] { perspective: 1000px; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .group:hover .group-hover\\:rotate-y-180 { transform: rotateY(180deg); }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
};
