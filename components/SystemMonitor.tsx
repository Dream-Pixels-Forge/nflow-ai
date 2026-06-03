
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Zap, 
  Monitor,
  Heart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  GitBranch
} from 'lucide-react';
import { useAgenticSystems } from '../hooks/useAgenticSystems';
import { AgentStatus, AgentPhase, PHASE_CONFIGS } from '../src/agentic';
import { taskManager } from '../src/a2a/TaskManager';
import { contextManager } from '../src/agentic/ContextManager';

const generateData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    time: i,
    cpu: 20 + Math.random() * 30,
    mem: 40 + Math.random() * 20,
    net: 10 + Math.random() * 50
  }));
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
    case 'HEALTHY': return <CheckCircle size={12} />;
    case 'DRIFTING': return <AlertTriangle size={12} />;
    case 'STALLED': return <AlertTriangle size={12} />;
    case 'CRASHED': return <XCircle size={12} />;
    case 'IDLE': return <Activity size={12} />;
    default: return <Activity size={12} />;
  }
};

const getPhaseColor = (phase: AgentPhase): string => {
  const colors: Record<AgentPhase, string> = {
    P: 'text-purple-500',
    R: 'text-blue-500',
    I: 'text-green-500',
    D: 'text-orange-500',
    E: 'text-cyan-500',
    S: 'text-red-500'
  };
  return colors[phase] || 'text-gray-500';
};

export const SystemMonitor: React.FC = () => {
  const [data, setData] = useState(generateData());
  const [vram, setVram] = useState(12.4);
  const [osName, setOsName] = useState('UNKNOWN');
  
  // Agentic systems
  const [agenticState] = useAgenticSystems();
  const { agentStates, isHalted, driftEvents, emergencyEvents } = agenticState;

  // A2A task stats
  const [a2aStats, setA2aStats] = useState(taskManager.getStats());

  // Context compression stats
  const [contextStats, setContextStats] = useState(() => {
    const sessions = contextManager.getActiveSessions();
    return sessions.length > 0 ? contextManager.getContextStats(sessions[0].id) : null;
  });

  useEffect(() => {
    // Detect OS
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (platform.includes('mac') || userAgent.includes('mac')) setOsName('MACOS KERNEL');
    else if (platform.includes('win') || userAgent.includes('win')) setOsName('WINDOWS NT');
    else if (platform.includes('linux') || userAgent.includes('linux')) setOsName('LINUX KERNEL');
    else setOsName('WEB ASSEMBLY');

    const interval = setInterval(() => {
      setData(prev => {
        const next = [...prev.slice(1), {
          time: prev[prev.length - 1].time + 1,
          cpu: 20 + Math.random() * 40,
          mem: 40 + Math.random() * 10,
          net: Math.random() * 80
        }];
        return next;
      });

      setVram(prev => {
        const change = (Math.random() - 0.5) * 1.5;
        let next = prev + change;
        if (next < 6) next = 6;
        if (next > 23.5) next = 23.5;
        return next;
      });

      // Refresh A2A stats
      setA2aStats(taskManager.getStats());

      // Refresh context stats
      const sessions = contextManager.getActiveSessions();
      if (sessions.length > 0) {
        setContextStats(contextManager.getContextStats(sessions[0].id));
      }

    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get agent status counts
  const agentStatusCounts = Array.from(agentStates.values()).reduce((acc, agent) => {
    acc[agent.status] = (acc[agent.status] || 0) + 1;
    return acc;
  }, {} as Record<AgentStatus, number>);

  return (
    <div className="flex flex-col gap-4 p-4 bg-nexus-800/50 border-l border-nexus-border min-h-full">
      <h3 className="text-nexus-accent font-mono text-sm uppercase tracking-wider flex items-center gap-2">
        <Activity className="w-4 h-4" /> System Telemetry
      </h3>

      {/* Agentic System Status */}
      <div className="bg-nexus-900 border border-nexus-border rounded-sm p-3">
        <div className="flex items-center gap-2 text-nexus-dim mb-2">
          <Shield size={14} />
          <span className="text-[10px] font-mono uppercase">Agentic System</span>
        </div>
        
        {/* System Halt Status */}
        {isHalted && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-sm p-2 mb-2">
            <div className="flex items-center gap-2 text-red-500 text-xs font-mono">
              <XCircle size={12} />
              <span>SYSTEM HALTED - EMERGENCY STOP ACTIVE</span>
            </div>
          </div>
        )}

        {/* Agent Status Grid */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {Object.entries(agentStatusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 text-xs">
              <span className={getStatusColor(status as AgentStatus)}>
                {getStatusIcon(status as AgentStatus)}
              </span>
              <span className="text-gray-400">{status}:</span>
              <span className="text-white font-mono">{count as number}</span>
            </div>
          ))}
        </div>

        {/* Drift Events */}
        {driftEvents.length > 0 && (
          <div className="border-t border-nexus-border pt-2 mt-2">
            <div className="flex items-center gap-2 text-yellow-500 text-xs mb-1">
              <AlertTriangle size={12} />
              <span className="font-mono">DRIFT EVENTS: {driftEvents.length}</span>
            </div>
            <div className="text-[10px] text-gray-500">
              {driftEvents.slice(-2).map((event, i) => (
                <div key={i} className="truncate">
                  {event.type}: {event.description}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Events */}
        {emergencyEvents.length > 0 && (
          <div className="border-t border-nexus-border pt-2 mt-2">
            <div className="flex items-center gap-2 text-red-500 text-xs mb-1">
              <XCircle size={12} />
              <span className="font-mono">EMERGENCIES: {emergencyEvents.length}</span>
            </div>
          </div>
        )}

        {/* A2A Task Stats */}
        {a2aStats.total > 0 && (
          <div className="border-t border-nexus-border pt-2 mt-2">
            <div className="flex items-center gap-2 text-cyan-500 text-xs mb-1">
              <GitBranch size={12} />
              <span className="font-mono">A2A TASKS: {a2aStats.total}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <span className="text-green-400">Active: {a2aStats.byState.working + a2aStats.byState.submitted}</span>
              <span className="text-blue-400">Done: {a2aStats.byState.completed}</span>
              <span className="text-yellow-400">Pending: {a2aStats.byState['input-required']}</span>
            </div>
          </div>
        )}

        {/* Context Health */}
        {contextStats && (
          <div className="border-t border-nexus-border pt-2 mt-2">
            <div className="flex items-center gap-2 text-purple-500 text-xs mb-1">
              <HardDrive size={12} />
              <span className="font-mono">CONTEXT WINDOW</span>
            </div>
            <div className="h-1.5 w-full bg-nexus-800 rounded-sm overflow-hidden mb-1">
              <div 
                className={`h-full transition-all duration-300 ${
                  contextStats.usagePercentage > 80 ? 'bg-red-500' :
                  contextStats.usagePercentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(contextStats.usagePercentage, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <span className="text-gray-400">Tokens: <span className="text-white font-mono">{(contextStats.tokenCount / 1000).toFixed(1)}K</span></span>
              <span className="text-gray-400">Usage: <span className={`font-mono ${contextStats.usagePercentage > 80 ? 'text-red-400' : 'text-white'}`}>{contextStats.usagePercentage.toFixed(0)}%</span></span>
              <span className="text-gray-400">Messages: <span className="text-white font-mono">{contextStats.messageCount}</span></span>
              <span className="text-gray-400">Auto-compress: <span className="text-green-400 font-mono">ON</span></span>
            </div>
          </div>
        )}
      </div>

      {/* CPU Chart */}
      <div className="h-40 w-full bg-nexus-900 border border-nexus-border p-2 rounded-sm relative overflow-hidden shrink-0">
         <div className="absolute top-2 right-2 text-xs font-mono text-green-500 opacity-50">CPU_LOAD_AVG</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="cpu" stroke="#00ff9d" strokeWidth={2} dot={false} isAnimationActive={false} />
            <YAxis domain={[0, 100]} hide />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Memory Chart */}
      <div className="h-40 w-full bg-nexus-900 border border-nexus-border p-2 rounded-sm relative shrink-0">
         <div className="absolute top-2 right-2 text-xs font-mono text-purple-500 opacity-50">MEM_ALLOC</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="step" dataKey="mem" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
             <YAxis domain={[0, 100]} hide />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* System Stats Grid */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm col-span-2">
            <div className="flex items-center justify-between text-nexus-dim mb-1">
                <div className="flex items-center gap-2">
                    <Monitor size={14} />
                    <span className="text-[10px] font-mono uppercase">Host OS</span>
                </div>
                <div className="text-[10px] font-mono text-white animate-pulse">
                    ONLINE
                </div>
            </div>
            <div className="text-lg font-mono text-nexus-accent tracking-wider">
                {osName}
            </div>
        </div>

        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm">
            <div className="flex items-center gap-2 text-nexus-dim mb-1">
                <Cpu size={14} />
                <span className="text-[10px] font-mono uppercase">Threads</span>
            </div>
            <div className="text-xl font-mono text-white">{navigator.hardwareConcurrency || 8}</div>
        </div>
        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm">
            <div className="flex items-center gap-2 text-nexus-dim mb-1">
                <HardDrive size={14} />
                <span className="text-[10px] font-mono uppercase">Local DB</span>
            </div>
            <div className="text-xl font-mono text-nexus-accent">ACTIVE</div>
        </div>
        
        {/* VRAM / GPU Section */}
        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm col-span-2">
            <div className="flex items-center justify-between text-nexus-dim mb-2">
                <div className="flex items-center gap-2">
                    <Zap size={14} />
                    <span className="text-[10px] font-mono uppercase">VRAM Usage</span>
                </div>
                <div className="text-[10px] font-mono text-white">
                    {vram.toFixed(1)} <span className="text-nexus-dim">/ 24 GB</span>
                </div>
            </div>
            <div className="h-2 w-full bg-nexus-800 rounded-sm overflow-hidden border border-nexus-border/30 mb-1">
                <div 
                    className="h-full bg-nexus-accent/80 transition-all duration-1000 ease-in-out" 
                    style={{ width: `${(vram / 24) * 100}%` }}
                />
            </div>
            <div className="text-[9px] text-right text-nexus-dim font-mono">
               {(24 - vram).toFixed(1)} GB AVAILABLE
            </div>
        </div>

         <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm col-span-2">
            <div className="flex items-center gap-2 text-nexus-dim mb-1">
                <Wifi size={14} />
                <span className="text-[10px] font-mono uppercase">Latency</span>
            </div>
            <div className="text-xl font-mono text-white flex justify-between">
                <span>12ms</span>
                <span className="text-[10px] text-nexus-dim mt-2">LOCALHOST</span>
            </div>
        </div>
      </div>
    </div>
  );
};
