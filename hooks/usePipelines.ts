/**
 * usePipelines - Custom hook for Pipeline Orchestrator integration
 * 
 * Provides unified interface for sequential/loop pipelines
 */

import { useState, useEffect, useCallback } from 'react';
import {
  pipelineOrchestrator,
  SequentialAgent,
  LoopAgent,
  PipelineInfo,
  PipelineExecution,
  LoopExecution,
  PipelineAgent,
  PipelineContext,
  OrchestratorStats
} from '../src/pipelines';

export interface PipelinesState {
  // Pipelines
  pipelines: PipelineInfo[];
  
  // Executions
  recentExecutions: (PipelineExecution | LoopExecution)[];
  
  // Stats
  stats: OrchestratorStats;
  
  // Currently running
  runningPipeline: string | null;
  executionProgress: number;
}

export interface PipelinesActions {
  // Pipeline creation
  createSequentialPipeline: (config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    continueOnError?: boolean;
    timeout?: number;
  }) => SequentialAgent;
  
  createLoopPipeline: (config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    maxIterations: number;
    exitCondition?: (context: PipelineContext, iteration: number) => boolean;
    exitTool?: string;
    continueOnError?: boolean;
    timeout?: number;
  }) => LoopAgent;
  
  // Execution
  executePipeline: (name: string, input: any, initialState?: Record<string, any>) => Promise<PipelineExecution | LoopExecution>;
  
  // Management
  deletePipeline: (name: string) => boolean;
  
  // Utilities
  getInstruction: (agentId: string, context: PipelineContext) => string;
}

export function usePipelines(): [PipelinesState, PipelinesActions] {
  // State
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<(PipelineExecution | LoopExecution)[]>([]);
  const [stats, setStats] = useState<OrchestratorStats>(pipelineOrchestrator.getStats());
  const [runningPipeline, setRunningPipeline] = useState<string | null>(null);
  const [executionProgress, setExecutionProgress] = useState(0);

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setPipelines(pipelineOrchestrator.getPipelines());
      setRecentExecutions(pipelineOrchestrator.getExecutionHistory().slice(-10));
      setStats(pipelineOrchestrator.getStats());
    };

    updateState();
    const interval = setInterval(updateState, 5000);

    return () => clearInterval(interval);
  }, []);

  // Pipeline creation
  const createSequentialPipeline = useCallback((config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    continueOnError?: boolean;
    timeout?: number;
  }) => {
    return pipelineOrchestrator.createSequentialPipeline(config);
  }, []);

  const createLoopPipeline = useCallback((config: {
    name: string;
    description: string;
    agents: PipelineAgent[];
    maxIterations: number;
    exitCondition?: (context: PipelineContext, iteration: number) => boolean;
    exitTool?: string;
    continueOnError?: boolean;
    timeout?: number;
  }) => {
    return pipelineOrchestrator.createLoopPipeline(config);
  }, []);

  // Execution
  const executePipeline = useCallback(async (
    name: string, 
    input: any, 
    initialState?: Record<string, any>
  ) => {
    setRunningPipeline(name);
    setExecutionProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExecutionProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const execution = await pipelineOrchestrator.executePipeline(name, input, initialState);

      clearInterval(progressInterval);
      setExecutionProgress(100);

      // Update state
      setPipelines(pipelineOrchestrator.getPipelines());
      setRecentExecutions(pipelineOrchestrator.getExecutionHistory().slice(-10));
      setStats(pipelineOrchestrator.getStats());

      return execution;
    } finally {
      setRunningPipeline(null);
      setExecutionProgress(0);
    }
  }, []);

  // Management
  const deletePipeline = useCallback((name: string) => {
    const result = pipelineOrchestrator.deletePipeline(name);
    setPipelines(pipelineOrchestrator.getPipelines());
    return result;
  }, []);

  // Utilities
  const getInstruction = useCallback((agentId: string, context: PipelineContext) => {
    return pipelineOrchestrator.getInstruction(agentId, context);
  }, []);

  const state: PipelinesState = {
    pipelines,
    recentExecutions,
    stats,
    runningPipeline,
    executionProgress
  };

  const actions: PipelinesActions = {
    createSequentialPipeline,
    createLoopPipeline,
    executePipeline,
    deletePipeline,
    getInstruction
  };

  return [state, actions];
}
