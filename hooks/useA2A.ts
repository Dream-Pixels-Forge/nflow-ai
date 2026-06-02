/**
 * useA2A - Custom hook for A2A Protocol integration
 * 
 * Provides unified interface for agent cards, task lifecycle, and SSE
 */

import { useState, useEffect, useCallback } from 'react';
import {
  agentCardManager,
  taskManager,
  sseManager,
  AgentCard,
  Task,
  TaskCreateRequest,
  TaskMessage,
  SSEEvent
} from '../src/agentic';

export interface A2AState {
  // Agent Cards
  registeredAgents: AgentCard[];
  discoveredAgents: AgentCard[];
  
  // Tasks
  activeTasks: Task[];
  completedTasks: Task[];
  failedTasks: Task[];
  
  // SSE
  activeConnections: number;
  lastEvent: SSEEvent | null;
  
  // Stats
  stats: {
    agents: number;
    tasks: number;
    connections: number;
  };
}

export interface A2AActions {
  // Agent Cards
  registerAgent: (config: Parameters<typeof agentCardManager.createAgentCard>[0]) => AgentCard;
  discoverAgents: (capability: string) => AgentCard[];
  negotiateCapabilities: (url: string, capabilities: string[], modalities: string[]) => Promise<any>;
  
  // Tasks
  createTask: (request: TaskCreateRequest) => Task;
  updateTask: (taskId: string, update: any) => Task | null;
  completeTask: (taskId: string, result: TaskMessage) => Task | null;
  failTask: (taskId: string, error: any) => Task | null;
  cancelTask: (taskId: string) => Task | null;
  
  // SSE
  connectToTask: (taskId: string, callback: (event: SSEEvent) => void) => any;
  disconnectFromTask: (connectionId: string) => boolean;
}

export function useA2A(): [A2AState, A2AActions] {
  // State
  const [registeredAgents, setRegisteredAgents] = useState<AgentCard[]>([]);
  const [discoveredAgents, setDiscoveredAgents] = useState<AgentCard[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [failedTasks, setFailedTasks] = useState<Task[]>([]);
  const [activeConnections, setActiveConnections] = useState(0);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setRegisteredAgents(agentCardManager.getRegisteredAgents());
      setActiveTasks(taskManager.getActiveTasks());
      setCompletedTasks(taskManager.getTasksByState('completed'));
      setFailedTasks(taskManager.getTasksByState('failed'));
      setActiveConnections(sseManager.getConnections().length);
    };

    updateState();
    const interval = setInterval(updateState, 5000);

    return () => clearInterval(interval);
  }, []);

  // Agent Card actions
  const registerAgent = useCallback((config: Parameters<typeof agentCardManager.createAgentCard>[0]) => {
    const card = agentCardManager.createAgentCard(config);
    setRegisteredAgents(agentCardManager.getRegisteredAgents());
    return card;
  }, []);

  const discoverAgents = useCallback((capability: string) => {
    const agents = agentCardManager.discoverByCapability(capability);
    setDiscoveredAgents(agents);
    return agents;
  }, []);

  const negotiateCapabilities = useCallback(async (url: string, capabilities: string[], modalities: string[]) => {
    return agentCardManager.negotiateCapabilities(url, capabilities, modalities);
  }, []);

  // Task actions
  const createTask = useCallback((request: TaskCreateRequest) => {
    const task = taskManager.createTask(request);
    setActiveTasks(taskManager.getActiveTasks());
    return task;
  }, []);

  const updateTask = useCallback((taskId: string, update: any) => {
    const task = taskManager.updateTask(taskId, update);
    setActiveTasks(taskManager.getActiveTasks());
    setCompletedTasks(taskManager.getTasksByState('completed'));
    setFailedTasks(taskManager.getTasksByState('failed'));
    return task;
  }, []);

  const completeTask = useCallback((taskId: string, result: TaskMessage) => {
    const task = taskManager.completeTask(taskId, result);
    setActiveTasks(taskManager.getActiveTasks());
    setCompletedTasks(taskManager.getTasksByState('completed'));
    return task;
  }, []);

  const failTask = useCallback((taskId: string, error: any) => {
    const task = taskManager.failTask(taskId, error);
    setActiveTasks(taskManager.getActiveTasks());
    setFailedTasks(taskManager.getTasksByState('failed'));
    return task;
  }, []);

  const cancelTask = useCallback((taskId: string) => {
    const task = taskManager.cancelTask(taskId);
    setActiveTasks(taskManager.getActiveTasks());
    return task;
  }, []);

  // SSE actions
  const connectToTask = useCallback((taskId: string, callback: (event: SSEEvent) => void) => {
    const wrappedCallback = (event: SSEEvent) => {
      setLastEvent(event);
      callback(event);
    };
    
    const connection = sseManager.connect(taskId, 'local', wrappedCallback);
    setActiveConnections(sseManager.getConnections().length);
    return connection;
  }, []);

  const disconnectFromTask = useCallback((connectionId: string) => {
    const result = sseManager.disconnect(connectionId);
    setActiveConnections(sseManager.getConnections().length);
    return result;
  }, []);

  const state: A2AState = {
    registeredAgents,
    discoveredAgents,
    activeTasks,
    completedTasks,
    failedTasks,
    activeConnections,
    lastEvent,
    stats: {
      agents: registeredAgents.length,
      tasks: activeTasks.length + completedTasks.length + failedTasks.length,
      connections: activeConnections
    }
  };

  const actions: A2AActions = {
    registerAgent,
    discoverAgents,
    negotiateCapabilities,
    createTask,
    updateTask,
    completeTask,
    failTask,
    cancelTask,
    connectToTask,
    disconnectFromTask
  };

  return [state, actions];
}
