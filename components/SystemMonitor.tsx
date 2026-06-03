
import React, { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Zap, 
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  GitBranch,
  MessageSquare,
  Timer
} from 'lucide-react';
import { useAgenticSystems } from '../hooks/useAgenticSystems';
import { AgentStatus, AgentPhase, PHASE_CONFIGS } from '../src/agentic';
import { AgentMode, Message } from '../types';
import { taskManager } from '../src/a2a/TaskManager';
import { contextManager } from '../src/agentic/ContextManager';
import { learningManager } from '../src/agentic/LearningManager';
import { collaborationManager } from '../src/agentic/CollaborationManager';

// Rolling window for throughput tracking
interface ThroughputPoint {
  time: number;
  messages: number;
  tokens: number;
}

const MAX_CHART_POINTS = 20;

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

interface SystemMonitorProps {
  messages?: Message[];
}

export const SystemMonitor: React.FC<SystemMonitorProps> = ({ messages = [] }) => {
  const [throughput, setThroughput] = useState<ThroughputPoint[]>(() => 
    Array.from({ length: MAX_CHART_POINTS }, (_, i) => ({ time: i, messages: 0, tokens: 0 }))
  );
  const [prevMsgCount, setPrevMsgCount] = useState(0);
  const [prevTokenCount, setPrevTokenCount] = useState(0);
  const [osName, setOsName] = useState('UNKNOWN');
  const [memoryMB, setMemoryMB] = useState(0);
  const [memoryLimitMB, setMemoryLimitMB] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [dbName, setDbName] = useState('UNKNOWN');
  const [dbVersion, setDbVersion] = useState(0);
  const [uptime, setUptime] = useState(0);
  
  // Agentic systems
  const [agenticState] = useAgenticSystems();
  const { agentStates, isHalted, driftEvents, emergencyEvents } = agenticState;

  // A2A task stats
  const [a2aStats, setA2aStats] = useState(taskManager.getStats());

  // Context stats across all sessions
  const [contextStats, setContextStats] = useState(() => {
    const sessions = contextManager.getActiveSessions();
    if (sessions.length > 0) {
      // Use the session with most tokens
      return sessions.reduce((best, s) => {
        const stats = contextManager.getContextStats(s.id);
        if (!stats) return best;
        if (!best || stats.tokenCount > best.tokenCount) return stats;
        return best;
      }, null as ReturnType<typeof contextManager.getContextStats>);
    }
    return null;
  });

  // Learning stats
  const [learningStats, setLearningStats] = useState(learningManager.getStats());

  // Collaboration stats
  const [collabStats, setCollabStats] = useState(collaborationManager.getStats());

  // Detect OS and memory on mount
  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (platform.includes('mac') || userAgent.includes('mac')) setOsName('MACOS');
    else if (platform.includes('win') || userAgent.includes('win')) setOsName('WINDOWS');
    else if (platform.includes('linux') || userAgent.includes('linux')) setOsName('LINUX');
    else setOsName('WEB');

    // Check browser memory (Chrome only)
    const perfMemory = (performance as any).memory;
    if (perfMemory) {
      setMemoryMB(Math.round(perfMemory.usedJSHeapSize / 1048576));
      setMemoryLimitMB(Math.round(perfMemory.jsHeapSizeLimit / 1048576));
    }

    // Check IndexedDB asynchronously
    indexedDB.databases?.().then(dbs => {
      if (dbs.length > 0) {
        setDbName(dbs[0].name || 'NEXUS');
        setDbVersion(dbs[0].version || 1);
      } else {
        setDbName('EMPTY');
        setDbVersion(0);
      }
    }).catch(() => {
      setDbName('N/A');
    });

    // Measure a quick fetch to get baseline latency
    const start = performance.now();
    fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' })
      .then(() => setLatencyMs(Math.round(performance.now() - start)))
      .catch(() => setLatencyMs(0));
  }, []);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      // Uptime
      setUptime(prev => prev + 1);

      // Memory (Chrome)
      const perfMemory = (performance as any).memory;
      if (perfMemory) {
        setMemoryMB(Math.round(perfMemory.usedJSHeapSize / 1048576));
        setMemoryLimitMB(Math.round(perfMemory.jsHeapSizeLimit / 1048576));
      }

      // Message throughput
      const totalMsgs = messages.length;
      const totalTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
      const msgsDelta = totalMsgs - prevMsgCount;
      const tokensDelta = totalTokens - prevTokenCount;

      setThroughput(prev => [
        ...prev.slice(1),
        { time: prev[prev.length - 1].time + 1, messages: msgsDelta, tokens: Math.round(tokensDelta / 100) }
      ]);
      setPrevMsgCount(totalMsgs);
      setPrevTokenCount(totalTokens);

      // Context stats
      const sessions = contextManager.getActiveSessions();
      if (sessions.length > 0) {
        const stats = sessions.reduce((best, s) => {
          const sStats = contextManager.getContextStats(s.id);
          if (!sStats) return best;
          if (!best || sStats.tokenCount > best.tokenCount) return sStats;
          return best;
        }, null as ReturnType<typeof contextManager.getContextStats>);
        setContextStats(stats);
      } else {
        setContextStats(null);
      }

      // A2A
      setA2aStats(taskManager.getStats());
      // Learning
      setLearningStats(learningManager.getStats());
      // Collaboration
      setCollabStats(collaborationManager.getStats());

    }, 1000);
    return () => clearInterval(interval);
  }, [messages, prevMsgCount, prevTokenCount]);

  // Calculate context window from messages if no session exists
  const contextWindow = useMemo(() => {
    if (contextStats) {
      return {
        tokenCount: contextStats.tokenCount,
        maxTokens: contextStats.maxTokens,
        usagePct: contextStats.usagePercentage,
        messageCount: contextStats.messageCount
      };
    }
    // Fallback: estimate from messages array
    const charCount = messages.reduce((sum, m) => sum + m.content.length, 0);
    const tokenCount = Math.ceil(charCount / 4);
    const maxTokens = 100000;
    return {
      tokenCount,
      maxTokens,
      usagePct: (tokenCount / maxTokens) * 100,
      messageCount: messages.length
    };
  }, [contextStats, messages]);

  // Get agent status counts
  const agentStatusCounts = Array.from(agentStates.values()).reduce((acc, agent) => {
    acc[agent.status] = (acc[agent.status] || 0) + 1;
    return acc;
  }, {} as Record<AgentStatus, number>);

  // Format uptime
  const formatUptime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

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
          {Object.keys(agentStatusCounts).length === 0 && (
            <div className="col-span-2 text-[10px] text-gray-500">No active agents</div>
          )}
        </div>

        {/* Drift Events */}
        {driftEvents.length > 0 && (
          <div className="border-t border-nexus-border pt-2 mt-2">
            <div className="flex items-center gap-2 text-yellow-500 text-xs mb-1">
              <AlertTriangle size={12} />
              <span className="font-mono">DRIFT: {driftEvents.length}</span>
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
              <span className="font-mono">A2A: {a2aStats.total} tasks</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <span className="text-green-400">Active: {a2aStats.byState.working + a2aStats.byState.submitted}</span>
              <span className="text-blue-400">Done: {a2aStats.byState.completed}</span>
              <span className="text-yellow-400">Pending: {a2aStats.byState['input-required']}</span>
            </div>
          </div>
        )}

        {/* Context Window - Always Visible */}
        <div className="border-t border-nexus-border pt-2 mt-2">
          <div className="flex items-center gap-2 text-purple-500 text-xs mb-1">
            <HardDrive size={12} />
            <span className="font-mono">CONTEXT WINDOW</span>
            {contextStats && (
              <span className="text-[9px] text-gray-500 ml-auto">{contextStats.messageCount} msgs</span>
            )}
          </div>
          <div className="h-1.5 w-full bg-nexus-800 rounded-sm overflow-hidden mb-1">
            <div 
              className={`h-full transition-all duration-300 ${
                contextWindow.usagePct > 80 ? 'bg-red-500' :
                contextWindow.usagePct > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(contextWindow.usagePct, 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-gray-400">Tokens: <span className="text-white font-mono">{(contextWindow.tokenCount / 1000).toFixed(1)}K</span></span>
            <span className="text-gray-400">Usage: <span className={`font-mono ${contextWindow.usagePct > 80 ? 'text-red-400' : 'text-white'}`}>{contextWindow.usagePct.toFixed(0)}%</span></span>
            <span className="text-gray-400">Max: <span className="text-gray-500 font-mono">{(contextWindow.maxTokens / 1000).toFixed(0)}K</span></span>
            <span className="text-gray-400">Compress: <span className="text-green-400 font-mono">AUTO</span></span>
          </div>
        </div>

        {/* Learning System */}
        <div className="border-t border-nexus-border pt-2 mt-2">
          <div className="flex items-center gap-2 text-emerald-500 text-xs mb-1">
            <CheckCircle size={12} />
            <span className="font-mono">LEARNING</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-gray-400">Lessons: <span className="text-white font-mono">{learningStats.activeLessons}</span></span>
            <span className="text-gray-400">Errors: <span className="text-white font-mono">{learningStats.totalEntries}</span></span>
          </div>
          {Object.keys(learningStats.byErrorType).length > 0 && (
            <div className="mt-1 text-[9px] text-gray-500">
              {Object.entries(learningStats.byErrorType).slice(0, 3).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span>{type}:</span>
                  <span className="text-gray-400">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collaboration System */}
        <div className="border-t border-nexus-border pt-2 mt-2">
          <div className="flex items-center gap-2 text-cyan-500 text-xs mb-1">
            <GitBranch size={12} />
            <span className="font-mono">COLLABORATION</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-gray-400">Signals: <span className="text-white font-mono">{collabStats.totalSignals}</span></span>
            <span className="text-gray-400">Suggestions: <span className="text-yellow-400 font-mono">{collabStats.activeSuggestions}</span></span>
          </div>
          {collabStats.activeSuggestions > 0 && (
            <div className="mt-2 p-2 bg-nexus-800/50 border border-cyan-500/30 rounded-sm">
              <div className="text-[9px] text-cyan-400 mb-1">PROACTIVE SUGGESTIONS</div>
              <div className="text-[10px] text-gray-300">
                {collaborationManager.getActiveSuggestions('CHAT' as AgentMode).slice(0, 2).map(s => (
                  <div key={s.id} className="flex items-center gap-1 mb-1">
                    <span className="text-cyan-400">{s.fromAgent}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-green-400">{s.toAgent}</span>
                    <span className="text-gray-500 text-[8px] ml-auto">{s.reason.slice(0, 30)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Throughput Chart */}
      <div className="h-36 w-full bg-nexus-900 border border-nexus-border p-2 rounded-sm relative overflow-hidden shrink-0">
        <div className="absolute top-2 right-2 text-xs font-mono text-green-500 opacity-50 flex items-center gap-1">
          <MessageSquare size={10} /> MSG/S
        </div>
        <div className="absolute top-2 left-2 text-[10px] font-mono text-gray-500">
          {messages.length} total
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={throughput}>
            <Line type="monotone" dataKey="messages" stroke="#00ff9d" strokeWidth={2} dot={false} isAnimationActive={false} />
            <YAxis domain={[0, 'auto']} hide />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Token Throughput Chart */}
      <div className="h-36 w-full bg-nexus-900 border border-nexus-border p-2 rounded-sm relative shrink-0">
        <div className="absolute top-2 right-2 text-xs font-mono text-purple-500 opacity-50 flex items-center gap-1">
          <Timer size={10} /> TOKENS/S (x100)
        </div>
        <div className="absolute top-2 left-2 text-[10px] font-mono text-gray-500">
          {contextWindow.tokenCount > 0 ? `${(contextWindow.tokenCount / 1000).toFixed(1)}K total` : '0'}
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={throughput}>
            <Line type="step" dataKey="tokens" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
            <YAxis domain={[0, 'auto']} hide />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* System Stats Grid */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm col-span-2">
            <div className="flex items-center justify-between text-nexus-dim mb-1">
                <div className="flex items-center gap-2">
                    <Monitor size={14} />
                    <span className="text-[10px] font-mono uppercase">Platform</span>
                </div>
                <div className="text-[10px] font-mono text-white">
                    {formatUptime(uptime)}
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
            <div className="text-xl font-mono text-white">{navigator.hardwareConcurrency || '?'}</div>
        </div>
        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm">
            <div className="flex items-center gap-2 text-nexus-dim mb-1">
                <HardDrive size={14} />
                <span className="text-[10px] font-mono uppercase">IndexedDB</span>
            </div>
            <div className="text-sm font-mono text-nexus-accent">
              {dbName !== 'UNKNOWN' ? dbName : 'N/A'}
              {dbVersion > 0 && <span className="text-gray-500 text-xs ml-1">v{dbVersion}</span>}
            </div>
        </div>
        
        {/* JS Heap Memory */}
        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm col-span-2">
            <div className="flex items-center justify-between text-nexus-dim mb-2">
                <div className="flex items-center gap-2">
                    <Zap size={14} />
                    <span className="text-[10px] font-mono uppercase">JS Heap</span>
                </div>
                <div className="text-[10px] font-mono text-white">
                    {memoryMB > 0 ? `${memoryMB} MB` : 'N/A'}
                    {memoryLimitMB > 0 && <span className="text-nexus-dim"> / {memoryLimitMB} MB</span>}
                </div>
            </div>
            {memoryLimitMB > 0 ? (
              <>
                <div className="h-2 w-full bg-nexus-800 rounded-sm overflow-hidden border border-nexus-border/30 mb-1">
                    <div 
                        className="h-full bg-nexus-accent/80 transition-all duration-1000 ease-in-out" 
                        style={{ width: `${(memoryMB / memoryLimitMB) * 100}%` }}
                    />
                </div>
                <div className="text-[9px] text-right text-nexus-dim font-mono">
                   {(memoryLimitMB - memoryMB)} MB free
                </div>
              </>
            ) : (
              <div className="text-[10px] text-gray-500 italic">
                Chrome DevTools for heap info
              </div>
            )}
        </div>

        {/* Latency */}
        <div className="bg-nexus-900 p-3 border border-nexus-border rounded-sm col-span-2">
            <div className="flex items-center gap-2 text-nexus-dim mb-1">
                <Wifi size={14} />
                <span className="text-[10px] font-mono uppercase">Network Latency</span>
            </div>
            <div className="text-xl font-mono text-white flex justify-between">
                <span>{latencyMs > 0 ? `${latencyMs}ms` : '—'}</span>
                <span className="text-[10px] text-nexus-dim mt-2">
                  {latencyMs > 0 ? 'CONNECTIVITY OK' : 'WAITING'}
                </span>
            </div>
            <div className="text-[9px] text-gray-600 mt-1 font-mono">
              Baseline connectivity check (favicon HEAD)
            </div>
        </div>
      </div>
    </div>
  );
};
