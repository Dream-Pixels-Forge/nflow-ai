/**
 * useAgenticSystems - Custom hook for integrating agentic systems with NexusFlow
 * 
 * Provides unified interface for heartbeat monitoring, emergency stop,
 * behavioral drift detection, phase gates, and context management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  agentOrchestrator,
  emergencyStop,
  behavioralDrift,
  phaseGate,
  contextManager,
  AgentPhase,
  AgentStatus,
  HeartbeatPulse,
  EmergencyEvent,
  DriftEvent,
  PhaseGateEvent,
  ContextSession,
  ContextStatus
} from '../src/agentic';

export interface AgenticState {
  // Orchestrator state
  agentStates: Map<string, any>;
  currentPhase: AgentPhase;
  
  // Emergency stop state
  isHalted: boolean;
  emergencyEvents: EmergencyEvent[];
  
  // Drift detection state
  driftEvents: DriftEvent[];
  driftEnabled: boolean;
  
  // Phase gate state
  gateEvents: PhaseGateEvent[];
  lastGateStatus: 'PASS' | 'FAIL' | null;
  
  // Context management state
  activeSessions: ContextSession[];
  currentSession: ContextSession | null;
  contextStatus: ContextStatus;
}

export interface AgenticActions {
  // Orchestrator actions
  startHeartbeat: (agentId: string) => void;
  stopHeartbeat: (agentId: string) => void;
  recordPulse: (pulse: HeartbeatPulse) => void;
  
  // Emergency stop actions
  triggerEmergencyStop: (agentId: string, severity: 'low' | 'medium' | 'high' | 'critical', reason: string) => Promise<EmergencyEvent>;
  resolveEmergency: (eventId: string) => boolean;
  haltAll: () => void;
  
  // Drift detection actions
  toggleDriftDetection: (enabled: boolean) => void;
  resolveDriftEvent: (eventId: string, resolution: string) => boolean;
  
  // Phase gate actions
  attemptPhaseTransition: (agentId: string, toPhase: AgentPhase) => Promise<{ success: boolean; event: PhaseGateEvent }>;
  
  // Context management actions
  createSession: (agentId: string) => ContextSession;
  addMessage: (sessionId: string, role: 'user' | 'assistant' | 'system', content: string) => boolean;
  compressSession: (sessionId: string) => boolean;
  toggleMCPServer: (sessionId: string, serverName: string, enabled: boolean) => boolean;
}

export function useAgenticSystems(): [AgenticState, AgenticActions] {
  // State
  const [agentStates, setAgentStates] = useState<Map<string, any>>(new Map());
  const [currentPhase, setCurrentPhase] = useState<AgentPhase>('P');
  const [isHalted, setIsHalted] = useState(false);
  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEvent[]>([]);
  const [driftEvents, setDriftEvents] = useState<DriftEvent[]>([]);
  const [driftEnabled, setDriftEnabled] = useState(true);
  const [gateEvents, setGateEvents] = useState<PhaseGateEvent[]>([]);
  const [lastGateStatus, setLastGateStatus] = useState<'PASS' | 'FAIL' | null>(null);
  const [activeSessions, setActiveSessions] = useState<ContextSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ContextSession | null>(null);
  const [contextStatus, setContextStatus] = useState<ContextStatus>('OPTIMAL');

  // Refs for callbacks
  const stateUpdateInterval = useRef<NodeJS.Timeout>();

  // Initialize systems
  useEffect(() => {
    // Set up callbacks
    agentOrchestrator.onPulse((pulse) => {
      // Update agent states
      const states = agentOrchestrator.getAgentStates();
      setAgentStates(new Map(states));
    });

    agentOrchestrator.onDrift((_agentId, _drift) => {
      // Drift events are handled via state updates
    });

    agentOrchestrator.onTimeout((_agentId, _phase) => {
      // Timeout events are handled via state updates
    });

    emergencyStop.onEmergency((event) => {
      setEmergencyEvents(prev => [...prev, event]);
      if (event.actions.includes('HALT_ALL_OPERATIONS')) {
        setIsHalted(true);
      }
    });

    emergencyStop.onHalt((halted) => {
      setIsHalted(halted);
    });

    behavioralDrift.onDrift((event) => {
      setDriftEvents(prev => [...prev, event]);
    });

    phaseGate.onGate((event) => {
      setGateEvents(prev => [...prev, event]);
      setLastGateStatus(event.status === 'PASS' ? 'PASS' : 'FAIL');
    });

    contextManager.onStatus((sessionId, status) => {
      setContextStatus(status);
    });

    // Start drift monitoring
    if (driftEnabled) {
      behavioralDrift.startMonitoring();
    }

    // Update states periodically
    stateUpdateInterval.current = setInterval(() => {
      const states = agentOrchestrator.getAgentStates();
      setAgentStates(new Map(states));
      
      const sessions = contextManager.getActiveSessions();
      setActiveSessions(sessions);
    }, 5000);

    // Cleanup
    return () => {
      if (stateUpdateInterval.current) {
        clearInterval(stateUpdateInterval.current);
      }
      agentOrchestrator.destroy();
      emergencyStop.destroy();
      behavioralDrift.destroy();
      phaseGate.destroy();
      contextManager.destroy();
    };
  }, []);

  // Update drift monitoring when enabled state changes
  useEffect(() => {
    if (driftEnabled) {
      behavioralDrift.startMonitoring();
    } else {
      behavioralDrift.stopMonitoring();
    }
  }, [driftEnabled]);

  // Actions
  const startHeartbeat = useCallback((agentId: string) => {
    agentOrchestrator.startHeartbeat(agentId);
  }, []);

  const stopHeartbeat = useCallback((agentId: string) => {
    agentOrchestrator.stopHeartbeat(agentId);
  }, []);

  const recordPulse = useCallback((pulse: HeartbeatPulse) => {
    agentOrchestrator.recordPulse(pulse);
  }, []);

  const triggerEmergencyStop = useCallback(async (
    agentId: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    reason: string
  ) => {
    return emergencyStop.triggerEmergencyStop(agentId, severity, reason);
  }, []);

  const resolveEmergency = useCallback((eventId: string) => {
    return emergencyStop.resolveEmergency(eventId, 'user');
  }, []);

  const toggleDriftDetection = useCallback((enabled: boolean) => {
    setDriftEnabled(enabled);
  }, []);

  const resolveDriftEvent = useCallback((eventId: string, resolution: string) => {
    return behavioralDrift.resolveDriftEvent(eventId, resolution);
  }, []);

  const attemptPhaseTransition = useCallback(async (agentId: string, toPhase: AgentPhase) => {
    return phaseGate.attemptTransition(agentId, toPhase);
  }, []);

  const createSession = useCallback((agentId: string) => {
    const session = contextManager.createSession(agentId);
    setCurrentSession(session);
    return session;
  }, []);

  const addMessage = useCallback((sessionId: string, role: 'user' | 'assistant' | 'system', content: string) => {
    return contextManager.addMessage(sessionId, { role, content });
  }, []);

  const compressSession = useCallback((sessionId: string) => {
    return contextManager.compressSession(sessionId);
  }, []);

  const toggleMCPServer = useCallback((sessionId: string, serverName: string, enabled: boolean) => {
    return contextManager.toggleMCPServer(sessionId, serverName, enabled);
  }, []);

  const state: AgenticState = {
    agentStates,
    currentPhase,
    isHalted,
    emergencyEvents,
    driftEvents,
    driftEnabled,
    gateEvents,
    lastGateStatus,
    activeSessions,
    currentSession,
    contextStatus
  };

  const actions: AgenticActions = {
    startHeartbeat,
    stopHeartbeat,
    recordPulse,
    triggerEmergencyStop,
    resolveEmergency,
    haltAll: () => {
      // Trigger emergency stop for all agents
      const agents = ['CHAT', 'PLAN', 'ARCHITECT', 'CODER', 'TEST', 'SECURE', 'DEPLOY', 'MONITOR'];
      agents.forEach(agentId => {
        emergencyStop.triggerEmergencyStop(agentId, 'critical', 'User triggered emergency halt');
      });
      setIsHalted(true);
    },
    toggleDriftDetection,
    resolveDriftEvent,
    attemptPhaseTransition,
    createSession,
    addMessage,
    compressSession,
    toggleMCPServer
  };

  return [state, actions];
}
