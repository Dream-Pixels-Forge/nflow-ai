/**
 * useProduction - Custom hook for Production features integration
 * 
 * Provides unified interface for observability, persistent services, and deployment
 */

import { useState, useEffect, useCallback } from 'react';
import {
  tracer,
  metricsCollector,
  sessionService,
  artifactService,
  memoryBank,
  deploymentManager,
  Trace,
  TraceSpan,
  Session,
  Artifact,
  MemoryBankEntry,
  Deployment,
  DeploymentConfig,
  DeploymentStatus,
  DeploymentPlatform
} from '../src/production';

export interface ProductionState {
  // Observability
  traces: Trace[];
  traceStats: {
    totalTraces: number;
    totalSpans: number;
    averageSpansPerTrace: number;
    averageDuration: number;
    errorRate: number;
    activeSpans: number;
  };
  metrics: {
    metrics: string[];
    counters: Record<string, number>;
    gauges: Record<string, number>;
  };
  
  // Persistent Services
  sessions: Session[];
  sessionStats: {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    averageAccessCount: number;
  };
  artifacts: Artifact[];
  artifactStats: {
    totalArtifacts: number;
    totalSize: number;
    byType: Record<string, number>;
    byMimeType: Record<string, number>;
  };
  memoryEntries: MemoryBankEntry[];
  memoryStats: {
    totalEntries: number;
    byType: Record<string, number>;
    averageImportance: number;
    totalAccessCount: number;
  };
  
  // Deployment
  deployments: Deployment[];
  deploymentStats: {
    totalDeployments: number;
    byStatus: Record<DeploymentStatus, number>;
    byPlatform: Record<DeploymentPlatform, number>;
    totalRequests: number;
    totalErrors: number;
    averageLatency: number;
  };
  environments: Array<{
    name: string;
    description: string;
    platform: DeploymentPlatform;
    isActive: boolean;
  }>;
}

export interface ProductionActions {
  // Observability
  startTrace: (name: string, attributes?: Record<string, any>) => string;
  startSpan: (traceId: string, name: string, attributes?: Record<string, any>, parentSpanId?: string) => string;
  endSpan: (spanId: string, status?: 'unspecified' | 'ok' | 'error' | 'timeout' | 'cancelled', attributes?: Record<string, any>) => void;
  addEvent: (spanId: string, name: string, attributes?: Record<string, any>) => void;
  recordMetric: (name: string, value: number) => void;
  incrementCounter: (name: string, value?: number) => void;
  setGauge: (name: string, value: number) => void;
  
  // Sessions
  createSession: (userId: string, agentId: string, initialState?: Record<string, any>) => Session;
  getSession: (sessionId: string) => Session | undefined;
  updateSessionState: (sessionId: string, state: Record<string, any>) => boolean;
  deleteSession: (sessionId: string) => boolean;
  
  // Artifacts
  storeArtifact: (sessionId: string, name: string, type: string, mimeType: string, data: string | Buffer, metadata?: Record<string, any>) => Artifact;
  getArtifact: (artifactId: string) => Artifact | undefined;
  deleteArtifact: (artifactId: string) => boolean;
  
  // Memory
  addMemory: (userId: string, type: MemoryBankEntry['type'], content: string, metadata?: Record<string, any>, importance?: number, sessionId?: string) => MemoryBankEntry;
  searchMemories: (userId: string, query: string, limit?: number) => MemoryBankEntry[];
  deleteMemory: (memoryId: string) => boolean;
  
  // Deployment
  createDeployment: (config: DeploymentConfig) => Deployment;
  deploy: (deploymentId: string) => Promise<Deployment>;
  stopDeployment: (deploymentId: string) => Promise<Deployment>;
  deleteDeployment: (deploymentId: string) => boolean;
}

export function useProduction(): [ProductionState, ProductionActions] {
  // State
  const [traces, setTraces] = useState<Trace[]>([]);
  const [traceStats, setTraceStats] = useState<ProductionState['traceStats']>(tracer.getStats());
  const [metrics, setMetrics] = useState<ProductionState['metrics']>(metricsCollector.getSummary());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionStats, setSessionStats] = useState<ProductionState['sessionStats']>(sessionService.getStats());
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactStats, setArtifactStats] = useState<ProductionState['artifactStats']>(artifactService.getStats());
  const [memoryEntries, setMemoryEntries] = useState<MemoryBankEntry[]>([]);
  const [memoryStats, setMemoryStats] = useState<ProductionState['memoryStats']>(memoryBank.getStats());
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [deploymentStats, setDeploymentStats] = useState<ProductionState['deploymentStats']>(deploymentManager.getStats());
  const [environments, setEnvironments] = useState<ProductionState['environments']>([]);

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setTraces(tracer.getRecentTraces(20));
      setTraceStats(tracer.getStats());
      setMetrics(metricsCollector.getSummary());
      setSessions(sessionService.getActiveSessions());
      setSessionStats(sessionService.getStats());
      const artifactTypes = Object.keys(artifactService.getStats().byType);
      setArtifacts(artifactTypes.flatMap(type => artifactService.getArtifactsByType(type)).slice(0, 20));
      setArtifactStats(artifactService.getStats());
      setMemoryStats(memoryBank.getStats());
      setDeployments(deploymentManager.getDeployments());
      setDeploymentStats(deploymentManager.getStats());
      setEnvironments(deploymentManager.getEnvironments().map(e => ({
        name: e.name,
        description: e.description,
        platform: e.platform,
        isActive: e.isActive
      })));
    };

    updateState();
    const interval = setInterval(updateState, 5000);

    return () => clearInterval(interval);
  }, []);

  // Observability actions
  const startTrace = useCallback((name: string, attributes: Record<string, any> = {}) => {
    return tracer.startTrace(name, attributes);
  }, []);

  const startSpan = useCallback((traceId: string, name: string, attributes: Record<string, any> = {}, parentSpanId?: string) => {
    return tracer.startSpan(traceId, name, attributes, parentSpanId);
  }, []);

  const endSpan = useCallback((spanId: string, status: 'unspecified' | 'ok' | 'error' | 'timeout' | 'cancelled' = 'ok', attributes: Record<string, any> = {}) => {
    tracer.endSpan(spanId, status, attributes);
  }, []);

  const addEvent = useCallback((spanId: string, name: string, attributes: Record<string, any> = {}) => {
    tracer.addEvent(spanId, name, attributes);
  }, []);

  const recordMetric = useCallback((name: string, value: number) => {
    metricsCollector.recordMetric(name, value);
  }, []);

  const incrementCounter = useCallback((name: string, value: number = 1) => {
    metricsCollector.incrementCounter(name, value);
  }, []);

  const setGauge = useCallback((name: string, value: number) => {
    metricsCollector.setGauge(name, value);
  }, []);

  // Session actions
  const createSession = useCallback((userId: string, agentId: string, initialState?: Record<string, any>) => {
    return sessionService.createSession(userId, agentId, initialState);
  }, []);

  const getSession = useCallback((sessionId: string) => {
    return sessionService.getSession(sessionId);
  }, []);

  const updateSessionState = useCallback((sessionId: string, state: Record<string, any>) => {
    return sessionService.updateSessionState(sessionId, state);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    return sessionService.deleteSession(sessionId);
  }, []);

  // Artifact actions
  const storeArtifact = useCallback((sessionId: string, name: string, type: string, mimeType: string, data: string | Buffer, metadata: Record<string, any> = {}) => {
    return artifactService.storeArtifact(sessionId, name, type, mimeType, data, metadata);
  }, []);

  const getArtifact = useCallback((artifactId: string) => {
    return artifactService.getArtifact(artifactId);
  }, []);

  const deleteArtifact = useCallback((artifactId: string) => {
    return artifactService.deleteArtifact(artifactId);
  }, []);

  // Memory actions
  const addMemory = useCallback((userId: string, type: MemoryBankEntry['type'], content: string, metadata: Record<string, any> = {}, importance: number = 0.5, sessionId?: string) => {
    return memoryBank.addMemory(userId, type, content, metadata, importance, sessionId);
  }, []);

  const searchMemories = useCallback((userId: string, query: string, limit: number = 10) => {
    return memoryBank.searchMemories(userId, query, limit);
  }, []);

  const deleteMemory = useCallback((memoryId: string) => {
    return memoryBank.deleteMemory(memoryId);
  }, []);

  // Deployment actions
  const createDeployment = useCallback((config: DeploymentConfig) => {
    return deploymentManager.createDeployment(config);
  }, []);

  const deploy = useCallback(async (deploymentId: string) => {
    return deploymentManager.deploy(deploymentId);
  }, []);

  const stopDeployment = useCallback(async (deploymentId: string) => {
    return deploymentManager.stop(deploymentId);
  }, []);

  const deleteDeployment = useCallback((deploymentId: string) => {
    return deploymentManager.deleteDeployment(deploymentId);
  }, []);

  const state: ProductionState = {
    traces,
    traceStats,
    metrics,
    sessions,
    sessionStats,
    artifacts,
    artifactStats,
    memoryEntries,
    memoryStats,
    deployments,
    deploymentStats,
    environments
  };

  const actions: ProductionActions = {
    startTrace,
    startSpan,
    endSpan,
    addEvent,
    recordMetric,
    incrementCounter,
    setGauge,
    createSession,
    getSession,
    updateSessionState,
    deleteSession,
    storeArtifact,
    getArtifact,
    deleteArtifact,
    addMemory,
    searchMemories,
    deleteMemory,
    createDeployment,
    deploy,
    stopDeployment,
    deleteDeployment
  };

  return [state, actions];
}
