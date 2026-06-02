/**
 * useSecurity - Custom hook for Security features integration
 * 
 * Provides unified interface for AP2 Protocol, Emergency Stop, and Verification
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ap2Protocol,
  enhancedEmergencyStop,
  verificationSystem,
  Mandate,
  Transaction,
  EmergencyEvent,
  VerificationResult,
  AuditEntry,
  EmergencyLevel,
  VerificationType
} from '../src/security';

export interface SecurityState {
  // AP2 Protocol
  mandates: Mandate[];
  transactions: Transaction[];
  ap2Stats: {
    totalMandates: number;
    totalTransactions: number;
    totalVolume: number;
    averageTransactionAmount: number;
  };
  
  // Emergency Stop
  activeEmergencies: EmergencyEvent[];
  pendingResumes: EmergencyEvent[];
  isHalted: boolean;
  emergencyStats: {
    totalEvents: number;
    activeEvents: number;
    resolvedEvents: number;
    pendingResumes: number;
  };
  
  // Verification
  verificationResults: VerificationResult[];
  auditLog: AuditEntry[];
  verificationStats: {
    totalRules: number;
    enabledRules: number;
    totalResults: number;
    failedVerifications: number;
    totalAuditEntries: number;
  };
}

export interface SecurityActions {
  // AP2 Protocol
  createIntentMandate: (userId: string, spendingLimit: any, merchantCategories: any[], ttlMs?: number) => Mandate;
  createCartMandate: (intentMandateId: string, transactionId: string, lineItems: any[], shippingDestination: string) => Mandate | null;
  signMandate: (mandateId: string, signature: string, signedBy: string) => boolean;
  revokeMandate: (mandateId: string, reason: string) => boolean;
  processPayment: (request: any) => Promise<any>;
  
  // Emergency Stop
  triggerEmergency: (level: EmergencyLevel, reason: string, agentId?: string, agentName?: string, affectedAgents?: string[], affectedSessions?: string[], affectedMandates?: string[]) => Promise<EmergencyEvent>;
  requestResume: (eventId: string, requestedBy: string) => boolean;
  resume: (eventId: string, resumedBy: string, notes?: string) => boolean;
  
  // Verification
  verifyOutput: (output: string, targetType: string, targetId?: string) => VerificationResult[];
  addAuditEntry: (action: string, actor: string, targetType: string, targetId?: string, details?: Record<string, any>) => AuditEntry;
}

export function useSecurity(): [SecurityState, SecurityActions] {
  // State
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ap2Stats, setAp2Stats] = useState<SecurityState['ap2Stats']>(ap2Protocol.getStats());
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyEvent[]>([]);
  const [pendingResumes, setPendingResumes] = useState<EmergencyEvent[]>([]);
  const [isHalted, setIsHalted] = useState(false);
  const [emergencyStats, setEmergencyStats] = useState<SecurityState['emergencyStats']>(enhancedEmergencyStop.getStats());
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [verificationStats, setVerificationStats] = useState<SecurityState['verificationStats']>(verificationSystem.getStats());

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setAp2Stats(ap2Protocol.getStats());
      setActiveEmergencies(enhancedEmergencyStop.getActiveEvents());
      setPendingResumes(enhancedEmergencyStop.getPendingResumes());
      setIsHalted(enhancedEmergencyStop.isSystemHalted());
      setEmergencyStats(enhancedEmergencyStop.getStats());
      setVerificationResults(verificationSystem.getResults(20));
      setAuditLog(verificationSystem.getAuditLog(50));
      setVerificationStats(verificationSystem.getStats());
    };

    updateState();
    const interval = setInterval(updateState, 5000);

    return () => clearInterval(interval);
  }, []);

  // AP2 actions
  const createIntentMandate = useCallback((userId: string, spendingLimit: any, merchantCategories: any[], ttlMs?: number) => {
    return ap2Protocol.createIntentMandate(userId, spendingLimit, merchantCategories, ttlMs);
  }, []);

  const createCartMandate = useCallback((intentMandateId: string, transactionId: string, lineItems: any[], shippingDestination: string) => {
    return ap2Protocol.createCartMandate(intentMandateId, transactionId, lineItems, shippingDestination);
  }, []);

  const signMandate = useCallback((mandateId: string, signature: string, signedBy: string) => {
    return ap2Protocol.signMandate(mandateId, signature, signedBy);
  }, []);

  const revokeMandate = useCallback((mandateId: string, reason: string) => {
    return ap2Protocol.revokeMandate(mandateId, reason);
  }, []);

  const processPayment = useCallback(async (request: any) => {
    return ap2Protocol.processMandateExchange(request);
  }, []);

  // Emergency actions
  const triggerEmergency = useCallback(async (
    level: EmergencyLevel,
    reason: string,
    agentId?: string,
    agentName?: string,
    affectedAgents: string[] = [],
    affectedSessions: string[] = [],
    affectedMandates: string[] = []
  ) => {
    return enhancedEmergencyStop.triggerEmergency(
      level,
      reason,
      agentId,
      agentName,
      affectedAgents,
      affectedSessions,
      affectedMandates
    );
  }, []);

  const requestResume = useCallback((eventId: string, requestedBy: string) => {
    return enhancedEmergencyStop.requestResume(eventId, requestedBy);
  }, []);

  const resume = useCallback((eventId: string, resumedBy: string, notes?: string) => {
    return enhancedEmergencyStop.resume(eventId, resumedBy, notes);
  }, []);

  // Verification actions
  const verifyOutput = useCallback((output: string, targetType: string, targetId?: string) => {
    return verificationSystem.verifyOutput(output, targetType, targetId);
  }, []);

  const addAuditEntry = useCallback((action: string, actor: string, targetType: string, targetId?: string, details: Record<string, any> = {}) => {
    return verificationSystem.addAuditEntry({ action, actor, targetType, targetId, details });
  }, []);

  const state: SecurityState = {
    mandates,
    transactions,
    ap2Stats,
    activeEmergencies,
    pendingResumes,
    isHalted,
    emergencyStats,
    verificationResults,
    auditLog,
    verificationStats
  };

  const actions: SecurityActions = {
    createIntentMandate,
    createCartMandate,
    signMandate,
    revokeMandate,
    processPayment,
    triggerEmergency,
    requestResume,
    resume,
    verifyOutput,
    addAuditEntry
  };

  return [state, actions];
}
