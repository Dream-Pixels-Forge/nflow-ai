/**
 * useAgentOS - Custom hook for Personal Agent OS integration
 * 
 * Provides unified interface for all 7 layers of the Agent OS
 */

import { useState, useEffect, useCallback } from 'react';
import {
  agentOS,
  identityManager,
  contextPortfolioManager,
  skillsLibrary,
  UserIdentity,
  IdentityRule,
  ContextEntry,
  ContextCategory,
  Skill,
  SkillCategory,
  SkillExecution,
  AgentOSState,
  VerificationResult
} from '../src/agent-os';
import { MemoryEntry } from '../src/agentic';

export interface AgentOSHookState {
  // Identity
  identity: UserIdentity | null;
  
  // Context
  contextEntries: ContextEntry[];
  contextStats: { totalEntries: number; byCategory: Record<ContextCategory, number> };
  
  // Skills
  skills: Skill[];
  popularSkills: Skill[];
  recentExecutions: SkillExecution[];
  
  // Overall
  state: AgentOSState;
  health: {
    identityHealth: 'healthy' | 'warning' | 'critical';
    contextHealth: 'healthy' | 'warning' | 'critical';
    skillsHealth: 'healthy' | 'warning' | 'critical';
    memoryHealth: 'healthy' | 'warning' | 'critical';
    overallHealth: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  };
}

export interface AgentOSHookActions {
  // Identity
  setIdentity: (identity: Partial<UserIdentity>) => UserIdentity;
  loadIdentityTemplate: (templateName: string) => UserIdentity | null;
  addIdentityRule: (rule: Omit<IdentityRule, 'id'>) => IdentityRule | null;
  validateAction: (action: string) => VerificationResult;
  
  // Context
  addContext: (entry: Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed' | 'accessCount'>) => ContextEntry;
  getContextByCategory: (category: ContextCategory) => ContextEntry[];
  searchContext: (query: string) => ContextEntry[];
  
  // Skills
  addSkill: (skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'averageRating' | 'ratings'>) => Skill;
  findSkillByTrigger: (trigger: string) => Skill | undefined;
  executeSkill: (skillId: string, parameters: Record<string, any>, input: string) => SkillExecution;
  
  // Memory
  addDecision: (content: string, tags?: string[], importance?: MemoryEntry['importance']) => MemoryEntry;
  addLearning: (content: string, tags?: string[], importance?: MemoryEntry['importance']) => MemoryEntry;
  
  // Utilities
  exportConfig: () => object;
  importConfig: (config: any) => void;
}

export function useAgentOS(): [AgentOSHookState, AgentOSHookActions] {
  // State
  const [identity, setIdentityState] = useState<UserIdentity | null>(null);
  const [contextEntries, setContextEntries] = useState<ContextEntry[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [popularSkills, setPopularSkills] = useState<Skill[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<SkillExecution[]>([]);
  const [state, setState] = useState<AgentOSState>(agentOS.getState());
  const [health, setHealth] = useState<AgentOSHookState['health']>(agentOS.auditHealth());

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setIdentityState(agentOS.getIdentity());
      setSkills(skillsLibrary.exportSkills());
      setPopularSkills(skillsLibrary.getPopularSkills(5));
      setRecentExecutions(skillsLibrary.getRecentExecutions(5));
      setState(agentOS.getState());
      setHealth(agentOS.auditHealth());
    };

    updateState();
    const interval = setInterval(updateState, 10000);

    return () => clearInterval(interval);
  }, []);

  // Identity actions
  const setIdentity = useCallback((identity: Partial<UserIdentity>) => {
    const result = agentOS.setIdentity(identity);
    setIdentityState(result);
    return result;
  }, []);

  const loadIdentityTemplate = useCallback((templateName: string) => {
    const result = agentOS.loadIdentityTemplate(templateName);
    setIdentityState(result);
    return result;
  }, []);

  const addIdentityRule = useCallback((rule: Omit<IdentityRule, 'id'>) => {
    return agentOS.addIdentityRule(rule);
  }, []);

  const validateAction = useCallback((action: string) => {
    return agentOS.validateAction(action);
  }, []);

  // Context actions
  const addContext = useCallback((entry: Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessed' | 'accessCount'>) => {
    return agentOS.addContext(entry);
  }, []);

  const getContextByCategory = useCallback((category: ContextCategory) => {
    return agentOS.getContextByCategory(category);
  }, []);

  const searchContext = useCallback((query: string) => {
    return agentOS.searchContext(query);
  }, []);

  // Skills actions
  const addSkill = useCallback((skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'averageRating' | 'ratings'>) => {
    return agentOS.addSkill(skill);
  }, []);

  const findSkillByTrigger = useCallback((trigger: string) => {
    return agentOS.findSkillByTrigger(trigger);
  }, []);

  const executeSkill = useCallback((skillId: string, parameters: Record<string, any>, input: string) => {
    return agentOS.executeSkill(skillId, parameters, input);
  }, []);

  // Memory actions
  const addDecision = useCallback((content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'medium') => {
    return agentOS.addDecision(content, tags, importance);
  }, []);

  const addLearning = useCallback((content: string, tags: string[] = [], importance: MemoryEntry['importance'] = 'medium') => {
    return agentOS.addLearning(content, tags, importance);
  }, []);

  // Utilities
  const exportConfig = useCallback(() => {
    return agentOS.exportConfig();
  }, []);

  const importConfig = useCallback((config: any) => {
    agentOS.importConfig(config);
  }, []);

  const hookState: AgentOSHookState = {
    identity,
    contextEntries,
    contextStats: state.contextStats,
    skills,
    popularSkills,
    recentExecutions,
    state,
    health
  };

  const hookActions: AgentOSHookActions = {
    setIdentity,
    loadIdentityTemplate,
    addIdentityRule,
    validateAction,
    addContext,
    getContextByCategory,
    searchContext,
    addSkill,
    findSkillByTrigger,
    executeSkill,
    addDecision,
    addLearning,
    exportConfig,
    importConfig
  };

  return [hookState, hookActions];
}
