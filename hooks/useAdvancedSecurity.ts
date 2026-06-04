/**
 * useAdvancedSecurity - Custom hook for Advanced Security features
 * 
 * Provides unified interface for Model Armor, Secret Manager, Circuit Breaker,
 * System Prompt Anchor, OWASP Compliance, and Agent Authentication
 */

import { useState, useEffect, useCallback } from 'react';
import {
  // Model Armor
  modelArmor,
  ScanResult,
  ModelArmorFilterRule,
  
  // Secret Manager
  secretManager,
  Secret,
  SecretType,
  
  // Circuit Breaker
  gradientDecayCircuitBreaker,
  CircuitBreaker,
  IterationSnapshot,
  
  // System Prompt Anchor
  systemPromptAnchor,
  AnchorRule,
  AnchoredPrompt,
  
  // OWASP Compliance
  owaspCompliance,
  ComplianceReport,
  RiskLevel,
  
  // Agent Auth
  agentAuth,
  AuthCredential,
  AuthSession,
  AgentDiscovery
} from '../src/security';

export interface AdvancedSecurityState {
  // Model Armor
  scanHistory: ScanResult[];
  blockedScans: number;
  flaggedScans: number;
  modelArmorStats: {
    totalScans: number;
    blockedScans: number;
    flaggedScans: number;
    cleanScans: number;
  };
  
  // Secret Manager
  secrets: Omit<Secret, 'value' | 'accessLog'>[];
  secretStats: {
    totalSecrets: number;
    byType: Record<SecretType, number>;
    byStatus: Record<string, number>;
    expiringSoon: number;
    needingRotation: number;
    totalAccesses: number;
  };
  
  // Circuit Breaker
  circuitBreakers: CircuitBreaker[];
  openCircuitBreakers: number;
  circuitBreakerStats: {
    totalCircuitBreakers: number;
    byState: Record<string, number>;
    totalFailures: number;
    totalSuccesses: number;
    averageSnapshots: number;
  };
  
  // System Prompt Anchor
  anchorRules: AnchorRule[];
  anchorStats: {
    totalRules: number;
    enabledRules: number;
  };
  
  // OWASP Compliance
  complianceReports: ComplianceReport[];
  lastComplianceRisk: RiskLevel;
  complianceStats: {
    totalReports: number;
    averageRiskScore: number;
    lastReportRisk: RiskLevel;
  };
  
  // Agent Auth
  agentDiscoveries: AgentDiscovery[];
  activeSessions: AuthSession[];
  authStats: {
    totalCredentials: number;
    activeSessions: number;
    onlineAgents: number;
  };
}

export interface AdvancedSecurityActions {
  // Model Armor
  scanInput: (content: string) => ScanResult;
  scanOutput: (content: string) => ScanResult;
  addModelArmorRule: (rule: Omit<ModelArmorFilterRule, 'id' | 'createdAt' | 'updatedAt'>) => ModelArmorFilterRule;
  
  // Secret Manager
  createSecret: (name: string, type: SecretType, value: string, options?: any) => Promise<Secret>;
  getSecretValue: (secretId: string, accessedBy: string) => Promise<string | null>;
  rotateSecret: (secretId: string, newValue: string, rotatedBy: string) => Promise<Secret | null>;
  revokeSecret: (secretId: string, revokedBy: string) => boolean;
  
  // Circuit Breaker
  createCircuitBreaker: (name: string, config?: any) => CircuitBreaker;
  recordSnapshot: (circuitBreakerId: string, state: any, cost: number, duration: number) => IterationSnapshot | null;
  canExecute: (circuitBreakerId: string) => boolean;
  resetCircuitBreaker: (circuitBreakerId: string) => boolean;
  
  // System Prompt Anchor
  addAnchorRule: (rule: Omit<AnchorRule, 'id' | 'createdAt' | 'updatedAt'>) => AnchorRule;
  buildAnchoredPrompt: (userPrompt: string, ragContext?: string[], customAnchors?: string[]) => AnchoredPrompt;
  checkModularity: (fileContent: string) => { compliant: boolean; lineCount: number; limit: number; excess: number };
  
  // OWASP Compliance
  runComplianceCheck: (content: string) => ComplianceReport;
  
  // Agent Auth
  registerAgent: (discovery: Omit<AgentDiscovery, 'lastSeen'>) => AgentDiscovery;
  discoverAgents: (capabilities?: string[]) => AgentDiscovery[];
  authenticateAgent: (agentId: string, credentialId: string) => AuthSession | null;
  createCredential: (agentId: string, method: any, options?: any) => AuthCredential;
}

export function useAdvancedSecurity(): [AdvancedSecurityState, AdvancedSecurityActions] {
  // State
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [modelArmorStats, setModelArmorStats] = useState<AdvancedSecurityState['modelArmorStats']>(modelArmor.getStats());
  const [secrets, setSecrets] = useState<Omit<Secret, 'value' | 'accessLog'>[]>([]);
  const [secretStats, setSecretStats] = useState<AdvancedSecurityState['secretStats']>(secretManager.getStats());
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreaker[]>([]);
  const [circuitBreakerStats, setCircuitBreakerStats] = useState<AdvancedSecurityState['circuitBreakerStats']>(gradientDecayCircuitBreaker.getStats());
  const [anchorRules, setAnchorRules] = useState<AnchorRule[]>([]);
  const [anchorStats, setAnchorStats] = useState<AdvancedSecurityState['anchorStats']>(systemPromptAnchor.getStats());
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);
  const [complianceStats, setComplianceStats] = useState<AdvancedSecurityState['complianceStats']>(owaspCompliance.getStats());
  const [agentDiscoveries, setAgentDiscoveries] = useState<AgentDiscovery[]>([]);
  const [activeSessions, setActiveSessions] = useState<AuthSession[]>([]);
  const [authStats, setAuthStats] = useState<AdvancedSecurityState['authStats']>(agentAuth.getStats());

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setScanHistory(modelArmor.getScanHistory(20));
      setModelArmorStats(modelArmor.getStats());
      setSecrets(secretManager.listSecrets());
      setSecretStats(secretManager.getStats());
      setCircuitBreakers(gradientDecayCircuitBreaker.getCircuitBreakers());
      setCircuitBreakerStats(gradientDecayCircuitBreaker.getStats());
      setAnchorRules(systemPromptAnchor.getEnabledRules());
      setAnchorStats(systemPromptAnchor.getStats());
      setComplianceReports(owaspCompliance.getRecentReports(10));
      setComplianceStats(owaspCompliance.getStats());
      setAgentDiscoveries(agentAuth.discoverAgents());
      setActiveSessions(agentAuth.getActiveSessions());
      setAuthStats(agentAuth.getStats());
    };

    updateState();
    const interval = setInterval(updateState, 10000);

    return () => clearInterval(interval);
  }, []);

  // Model Armor actions
  const scanInput = useCallback((content: string) => {
    return modelArmor.scanInput(content);
  }, []);

  const scanOutput = useCallback((content: string) => {
    return modelArmor.scanOutput(content);
  }, []);

  const addModelArmorRule = useCallback((rule: Omit<ModelArmorFilterRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    return modelArmor.addRule(rule);
  }, []);

  // Secret Manager actions
  const createSecret = useCallback((name: string, type: SecretType, value: string, options?: any) => {
    return secretManager.createSecret(name, type, value, options);
  }, []);

  const getSecretValue = useCallback((secretId: string, accessedBy: string) => {
    return secretManager.getSecret(secretId, accessedBy);
  }, []);

  const rotateSecret = useCallback((secretId: string, newValue: string, rotatedBy: string) => {
    return secretManager.rotateSecret(secretId, newValue, rotatedBy);
  }, []);

  const revokeSecret = useCallback((secretId: string, revokedBy: string) => {
    return secretManager.revokeSecret(secretId, revokedBy);
  }, []);

  // Circuit Breaker actions
  const createCircuitBreaker = useCallback((name: string, config?: any) => {
    return gradientDecayCircuitBreaker.createCircuitBreaker(name, config);
  }, []);

  const recordSnapshot = useCallback((circuitBreakerId: string, state: any, cost: number, duration: number) => {
    return gradientDecayCircuitBreaker.recordSnapshot(circuitBreakerId, state, cost, duration);
  }, []);

  const canExecute = useCallback((circuitBreakerId: string) => {
    return gradientDecayCircuitBreaker.canExecute(circuitBreakerId);
  }, []);

  const resetCircuitBreaker = useCallback((circuitBreakerId: string) => {
    return gradientDecayCircuitBreaker.reset(circuitBreakerId);
  }, []);

  // System Prompt Anchor actions
  const addAnchorRule = useCallback((rule: Omit<AnchorRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    return systemPromptAnchor.addRule(rule);
  }, []);

  const buildAnchoredPrompt = useCallback((userPrompt: string, ragContext?: string[], customAnchors?: string[]) => {
    return systemPromptAnchor.buildAnchoredPrompt(userPrompt, ragContext, customAnchors);
  }, []);

  const checkModularity = useCallback((fileContent: string) => {
    return systemPromptAnchor.checkModularity(fileContent);
  }, []);

  // OWASP Compliance actions
  const runComplianceCheck = useCallback((content: string) => {
    return owaspCompliance.runComplianceCheck(content);
  }, []);

  // Agent Auth actions
  const registerAgent = useCallback((discovery: Omit<AgentDiscovery, 'lastSeen'>) => {
    return agentAuth.registerAgent(discovery);
  }, []);

  const discoverAgents = useCallback((capabilities?: string[]) => {
    return agentAuth.discoverAgents(capabilities);
  }, []);

  const authenticateAgent = useCallback((agentId: string, credentialId: string) => {
    return agentAuth.authenticate(agentId, credentialId);
  }, []);

  const createCredential = useCallback((agentId: string, method: any, options?: any) => {
    return agentAuth.createCredential(agentId, method, options);
  }, []);

  const state: AdvancedSecurityState = {
    scanHistory,
    blockedScans: modelArmorStats.blockedScans,
    flaggedScans: modelArmorStats.flaggedScans,
    modelArmorStats,
    secrets,
    secretStats,
    circuitBreakers,
    openCircuitBreakers: circuitBreakerStats.byState?.['open'] || 0,
    circuitBreakerStats,
    anchorRules,
    anchorStats,
    complianceReports,
    lastComplianceRisk: complianceStats.lastReportRisk,
    complianceStats,
    agentDiscoveries,
    activeSessions,
    authStats
  };

  const actions: AdvancedSecurityActions = {
    scanInput,
    scanOutput,
    addModelArmorRule,
    createSecret,
    getSecretValue,
    rotateSecret,
    revokeSecret,
    createCircuitBreaker,
    recordSnapshot,
    canExecute,
    resetCircuitBreaker,
    addAnchorRule,
    buildAnchoredPrompt,
    checkModularity,
    runComplianceCheck,
    registerAgent,
    discoverAgents,
    authenticateAgent,
    createCredential
  };

  return [state, actions];
}
