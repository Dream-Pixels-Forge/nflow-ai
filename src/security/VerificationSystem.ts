/**
 * Security: Verification System
 * 
 * Implements output verification, quality checks, and audit trails.
 * Based on Agent OS Layer 6 (Verification) from Obsidian vault.
 */

export type VerificationType = 'output' | 'input' | 'action' | 'code' | 'security' | 'compliance';
export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'warning' | 'skipped';
export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface VerificationRule {
  id: string;
  name: string;
  description: string;
  type: VerificationType;
  severity: SeverityLevel;
  
  // Rule definition
  pattern?: string; // Regex pattern
  keywords?: string[];
  customCheck?: (input: any) => { valid: boolean; message?: string };
  
  // Metadata
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VerificationResult {
  id: string;
  ruleId: string;
  ruleName: string;
  status: VerificationStatus;
  severity: SeverityLevel;
  
  // Result details
  message: string;
  details?: any;
  
  // Context
  targetType: string;
  targetId?: string;
  verifiedBy?: string;
  
  // Timestamps
  verifiedAt: string;
  duration?: number;
}

export interface VerificationCheck {
  id: string;
  name: string;
  description: string;
  type: VerificationType;
  
  // Rules to apply
  ruleIds: string[];
  
  // Config
  continueOnFailure: boolean;
  maxRetries: number;
  
  // Metadata
  enabled: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  targetType: string;
  targetId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerificationConfig {
  enabled: boolean;
  autoVerify: boolean;
  failOnWarning: boolean;
  maxAuditEntries: number;
  retentionDays: number;
}

const DEFAULT_CONFIG: VerificationConfig = {
  enabled: true,
  autoVerify: true,
  failOnWarning: false,
  maxAuditEntries: 100000,
  retentionDays: 90
};

/**
 * Verification System
 */
export class VerificationSystem {
  private rules: Map<string, VerificationRule> = new Map();
  private checks: Map<string, VerificationCheck> = new Map();
  private results: Map<string, VerificationResult> = new Map();
  private auditLog: AuditEntry[] = [];
  private config: VerificationConfig;

  constructor(config: Partial<VerificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultRules();
  }

  /**
   * Initialize default verification rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<VerificationRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'No Sensitive Data',
        description: 'Check for sensitive data in output',
        type: 'security',
        severity: 'critical',
        pattern: '(password|api_key|secret|token|credential)',
        enabled: true,
        tags: ['security', 'pii']
      },
      {
        name: 'No Hardcoded Secrets',
        description: 'Check for hardcoded secrets',
        type: 'security',
        severity: 'critical',
        pattern: '["\'][A-Za-z0-9+/]{40,}["\']',
        enabled: true,
        tags: ['security', 'secrets']
      },
      {
        name: 'Email Validation',
        description: 'Validate email format',
        type: 'output',
        severity: 'medium',
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        enabled: true,
        tags: ['validation', 'email']
      },
      {
        name: 'URL Validation',
        description: 'Validate URL format',
        type: 'output',
        severity: 'low',
        pattern: '^https?:\\/\\/[^\\s]+$',
        enabled: true,
        tags: ['validation', 'url']
      },
      {
        name: 'No SQL Injection',
        description: 'Check for SQL injection patterns',
        type: 'security',
        severity: 'critical',
        pattern: '(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\\b)',
        enabled: true,
        tags: ['security', 'sql']
      },
      {
        name: 'No XSS Patterns',
        description: 'Check for XSS patterns',
        type: 'security',
        severity: 'high',
        pattern: '(<script|javascript:|on\\w+\\s*=)',
        enabled: true,
        tags: ['security', 'xss']
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  /**
   * Add verification rule
   */
  addRule(ruleData: Omit<VerificationRule, 'id' | 'createdAt' | 'updatedAt'>): VerificationRule {
    const rule: VerificationRule = {
      ...ruleData,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.rules.set(rule.id, rule);
    return rule;
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): VerificationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get rules by type
   */
  getRulesByType(type: VerificationType): VerificationRule[] {
    return Array.from(this.rules.values()).filter(r => r.type === type);
  }

  /**
   * Add verification check
   */
  addCheck(checkData: Omit<VerificationCheck, 'id' | 'createdAt'>): VerificationCheck {
    const check: VerificationCheck = {
      ...checkData,
      id: `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };

    this.checks.set(check.id, check);
    return check;
  }

  /**
   * Verify output against rules
   */
  verifyOutput(output: string, targetType: string, targetId?: string): VerificationResult[] {
    if (!this.config.enabled) return [];

    const results: VerificationResult[] = [];
    const startTime = Date.now();

    // Get applicable rules
    const rules = Array.from(this.rules.values()).filter(r => r.enabled);

    for (const rule of rules) {
      const result = this.verifyAgainstRule(rule, output, targetType, targetId);
      results.push(result);

      // Add to results map
      this.results.set(result.id, result);

      // Log audit entry
      if (result.status === 'failed' || result.severity === 'critical') {
        this.addAuditEntry({
          action: 'verification_failed',
          actor: 'system',
          targetType,
          targetId,
          details: {
            ruleId: rule.id,
            ruleName: rule.name,
            message: result.message
          }
        });
      }
    }

    return results;
  }

  /**
   * Verify against a specific rule
   */
  private verifyAgainstRule(
    rule: VerificationRule,
    input: string,
    targetType: string,
    targetId?: string
  ): VerificationResult {
    const startTime = Date.now();
    let status: VerificationStatus = 'passed';
    let message = 'Verification passed';

    // Check pattern
    if (rule.pattern) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(input)) {
        status = 'failed';
        message = `Pattern match detected: ${rule.pattern}`;
      }
    }

    // Check keywords
    if (rule.keywords && rule.keywords.length > 0) {
      const lowerInput = input.toLowerCase();
      const foundKeyword = rule.keywords.find(kw => lowerInput.includes(kw.toLowerCase()));
      if (foundKeyword) {
        status = 'failed';
        message = `Keyword detected: ${foundKeyword}`;
      }
    }

    // Custom check
    if (rule.customCheck) {
      const customResult = rule.customCheck(input);
      if (!customResult.valid) {
        status = 'failed';
        message = customResult.message || 'Custom check failed';
      }
    }

    const duration = Date.now() - startTime;

    return {
      id: `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      status,
      severity: rule.severity,
      message,
      targetType,
      targetId,
      verifiedAt: new Date().toISOString(),
      duration
    };
  }

  /**
   * Add audit entry
   */
  addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const auditEntry: AuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    this.auditLog.push(auditEntry);

    // Trim audit log if needed
    if (this.auditLog.length > this.config.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.config.maxAuditEntries);
    }

    return auditEntry;
  }

  /**
   * Get audit log
   */
  getAuditLog(limit: number = 100, filters?: {
    action?: string;
    actor?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
  }): AuditEntry[] {
    let entries = [...this.auditLog];

    // Apply filters
    if (filters) {
      if (filters.action) {
        entries = entries.filter(e => e.action === filters.action);
      }
      if (filters.actor) {
        entries = entries.filter(e => e.actor === filters.actor);
      }
      if (filters.targetType) {
        entries = entries.filter(e => e.targetType === filters.targetType);
      }
      if (filters.startDate) {
        entries = entries.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        entries = entries.filter(e => e.timestamp <= filters.endDate!);
      }
    }

    return entries.slice(-limit);
  }

  /**
   * Get verification results
   */
  getResults(limit: number = 100): VerificationResult[] {
    return Array.from(this.results.values())
      .sort((a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get verification stats
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    rulesByType: Record<VerificationType, number>;
    totalResults: number;
    resultsByStatus: Record<VerificationStatus, number>;
    totalAuditEntries: number;
    failedVerifications: number;
  } {
    const rules = Array.from(this.rules.values());
    const results = Array.from(this.results.values());

    const rulesByType: Record<VerificationType, number> = {
      output: 0,
      input: 0,
      action: 0,
      code: 0,
      security: 0,
      compliance: 0
    };

    const resultsByStatus: Record<VerificationStatus, number> = {
      pending: 0,
      passed: 0,
      failed: 0,
      warning: 0,
      skipped: 0
    };

    rules.forEach(r => rulesByType[r.type]++);
    results.forEach(r => resultsByStatus[r.status]++);

    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      rulesByType,
      totalResults: results.length,
      resultsByStatus,
      totalAuditEntries: this.auditLog.length,
      failedVerifications: resultsByStatus.failed
    };
  }

  /**
   * Clear old audit entries
   */
  cleanupAuditLog(): number {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const initialCount = this.auditLog.length;

    this.auditLog = this.auditLog.filter(e => 
      new Date(e.timestamp).getTime() > cutoff
    );

    return initialCount - this.auditLog.length;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.rules.clear();
    this.checks.clear();
    this.results.clear();
    this.auditLog = [];
  }
}

// Singleton instance
export const verificationSystem = new VerificationSystem();
