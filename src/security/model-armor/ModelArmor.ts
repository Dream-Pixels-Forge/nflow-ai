/**
 * Security: Model Armor (Input/Output Filtering)
 * 
 * Implements prompt injection detection, PII filtering, and jailbreak detection.
 * Based on Google ADK Security Deep Dive from Obsidian vault.
 */

export type FilterType = 'prompt-injection' | 'pii' | 'jailbreak' | 'custom';
export type FilterAction = 'block' | 'flag' | 'redact' | 'log';
export type FilterSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FilterRule {
  id: string;
  name: string;
  type: FilterType;
  action: FilterAction;
  severity: FilterSeverity;
  enabled: boolean;
  
  // Pattern-based detection
  patterns?: string[];
  keywords?: string[];
  
  // Threshold-based detection
  threshold?: number;
  
  // Custom filter function
  customFilter?: (input: string) => { detected: boolean; score: number; details?: string };
  
  // Metadata
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterResult {
  id: string;
  ruleId: string;
  ruleName: string;
  type: FilterType;
  action: FilterAction;
  severity: FilterSeverity;
  
  // Detection details
  detected: boolean;
  score: number;
  details?: string;
  
  // Original and filtered content
  originalContent: string;
  filteredContent?: string;
  
  // Metadata
  timestamp: string;
  duration: number;
}

export interface ScanResult {
  id: string;
  content: string;
  results: FilterResult[];
  blocked: boolean;
  flagged: boolean;
  redactedContent?: string;
  timestamp: string;
  duration: number;
}

export interface ModelArmorConfig {
  enabled: boolean;
  defaultAction: FilterAction;
  logAllScans: boolean;
  maxScanHistory: number;
  autoUpdateRules: boolean;
}

const DEFAULT_CONFIG: ModelArmorConfig = {
  enabled: true,
  defaultAction: 'flag',
  logAllScans: true,
  maxScanHistory: 1000,
  autoUpdateRules: true
};

/**
 * Model Armor - Input/Output Filtering System
 */
export class ModelArmor {
  private rules: Map<string, FilterRule> = new Map();
  private scanHistory: ScanResult[] = [];
  private config: ModelArmorConfig;

  constructor(config: Partial<ModelArmorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultRules();
  }

  /**
   * Initialize default security rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // Prompt Injection Detection
      {
        name: 'Direct Prompt Injection',
        type: 'prompt-injection',
        action: 'block',
        severity: 'critical',
        enabled: true,
        patterns: [
          'ignore (previous|all) instructions',
          'ignore (previous|all) prompts',
          'disregard (previous|all)',
          'forget (previous|all)',
          'override (previous|all)',
          'new instructions:',
          'system prompt:',
          'you are now',
          'act as',
          'pretend to be',
          'roleplay as'
        ],
        keywords: [
          'reveal secrets',
          'show api keys',
          'print passwords',
          'output credentials',
          'bypass security',
          'jailbreak',
          'dan mode',
          'developer mode'
        ],
        description: 'Detects direct attempts to manipulate the LLM'
      },
      {
        name: 'Indirect Prompt Injection',
        type: 'prompt-injection',
        action: 'flag',
        severity: 'high',
        enabled: true,
        patterns: [
          '<script',
          'javascript:',
          'on\\w+=',
          'eval\\(',
          'exec\\(',
          'import\\(',
          'require\\('
        ],
        description: 'Detects indirect injection via retrieved content'
      },
      
      // PII Detection
      {
        name: 'Email Address',
        type: 'pii',
        action: 'redact',
        severity: 'medium',
        enabled: true,
        patterns: [
          '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'
        ],
        description: 'Detects email addresses'
      },
      {
        name: 'Phone Number',
        type: 'pii',
        action: 'redact',
        severity: 'medium',
        enabled: true,
        patterns: [
          '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b',
          '\\b\\+\\d{1,3}[-.]?\\d{3,4}[-.]?\\d{3,4}[-.]?\\d{3,4}\\b'
        ],
        description: 'Detects phone numbers'
      },
      {
        name: 'SSN',
        type: 'pii',
        action: 'redact',
        severity: 'critical',
        enabled: true,
        patterns: [
          '\\b\\d{3}-\\d{2}-\\d{4}\\b',
          '\\b\\d{9}\\b'
        ],
        description: 'Detects Social Security Numbers'
      },
      {
        name: 'Credit Card',
        type: 'pii',
        action: 'redact',
        severity: 'critical',
        enabled: true,
        patterns: [
          '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b'
        ],
        description: 'Detects credit card numbers'
      },
      {
        name: 'API Key',
        type: 'pii',
        action: 'redact',
        severity: 'critical',
        enabled: true,
        patterns: [
          'sk-[a-zA-Z0-9]{20,}',
          'api[_-]?key[_-]?[a-zA-Z0-9]{20,}',
          '[a-zA-Z0-9]{32,}'
        ],
        keywords: [
          'api key',
          'secret key',
          'access token',
          'bearer token'
        ],
        description: 'Detects API keys and tokens'
      },
      
      // Jailbreak Detection
      {
        name: 'Jailbreak Attempt',
        type: 'jailbreak',
        action: 'block',
        severity: 'critical',
        enabled: true,
        keywords: [
          'do anything now',
          'dan',
          'developer mode',
          'god mode',
          'unrestricted',
          'no rules',
          'no limits',
          'bypass filters',
          'ignore safety',
          'ignore guidelines'
        ],
        description: 'Detects jailbreak attempts'
      },
      {
        name: 'Role Manipulation',
        type: 'jailbreak',
        action: 'flag',
        severity: 'high',
        enabled: true,
        patterns: [
          'you are now',
          'from now on',
          'new persona',
          'alternate personality',
          'evil ai',
          'unrestricted ai'
        ],
        description: 'Detects attempts to change AI persona'
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  /**
   * Add a filter rule
   */
  addRule(ruleData: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>): FilterRule {
    const rule: FilterRule = {
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
  getRule(ruleId: string): FilterRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get rules by type
   */
  getRulesByType(type: FilterType): FilterRule[] {
    return Array.from(this.rules.values()).filter(r => r.type === type);
  }

  /**
   * Scan input content
   */
  scanInput(content: string): ScanResult {
    if (!this.config.enabled) {
      return this.createScanResult(content, [], false, false);
    }

    const startTime = Date.now();
    const results: FilterResult[] = [];

    // Get enabled rules
    const rules = Array.from(this.rules.values()).filter(r => r.enabled);

    for (const rule of rules) {
      const result = this.applyRule(rule, content);
      if (result.detected) {
        results.push(result);
      }
    }

    // Determine if blocked or flagged
    const blocked = results.some(r => r.action === 'block');
    const flagged = results.some(r => r.action === 'flag');

    const scanResult = this.createScanResult(content, results, blocked, flagged);
    scanResult.duration = Date.now() - startTime;

    // Add to history
    this.addToHistory(scanResult);

    return scanResult;
  }

  /**
   * Scan output content
   */
  scanOutput(content: string): ScanResult {
    if (!this.config.enabled) {
      return this.createScanResult(content, [], false, false);
    }

    const startTime = Date.now();
    const results: FilterResult[] = [];
    let filteredContent = content;

    // Get enabled rules for output
    const rules = Array.from(this.rules.values()).filter(r => r.enabled);

    for (const rule of rules) {
      const result = this.applyRule(rule, content);
      if (result.detected) {
        results.push(result);
        
        // Apply redaction if needed
        if (rule.action === 'redact') {
          filteredContent = this.redactContent(filteredContent, rule);
        }
      }
    }

    const blocked = results.some(r => r.action === 'block');
    const flagged = results.some(r => r.action === 'flag');
    const redacted = filteredContent !== content;

    const scanResult = this.createScanResult(content, results, blocked, flagged);
    scanResult.redactedContent = redacted ? filteredContent : undefined;
    scanResult.duration = Date.now() - startTime;

    this.addToHistory(scanResult);

    return scanResult;
  }

  /**
   * Apply a filter rule to content
   */
  private applyRule(rule: FilterRule, content: string): FilterResult {
    const startTime = Date.now();
    let detected = false;
    let score = 0;
    let details = '';

    // Check patterns
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(content)) {
          detected = true;
          score += 0.3;
          details = `Pattern matched: ${pattern}`;
          break;
        }
      }
    }

    // Check keywords
    if (rule.keywords) {
      const lowerContent = content.toLowerCase();
      for (const keyword of rule.keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          detected = true;
          score += 0.4;
          details = `Keyword detected: ${keyword}`;
          break;
        }
      }
    }

    // Custom filter
    if (rule.customFilter) {
      const customResult = rule.customFilter(content);
      if (customResult.detected) {
        detected = true;
        score += customResult.score;
        details = customResult.details || 'Custom filter detected';
      }
    }

    // Normalize score
    score = Math.min(score, 1.0);

    return {
      id: `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      action: rule.action,
      severity: rule.severity,
      detected,
      score,
      details,
      originalContent: content,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    };
  }

  /**
   * Redact content based on rule
   */
  private redactContent(content: string, rule: FilterRule): string {
    let redacted = content;

    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        const regex = new RegExp(pattern, 'gi');
        redacted = redacted.replace(regex, '[REDACTED]');
      }
    }

    return redacted;
  }

  /**
   * Create scan result
   */
  private createScanResult(
    content: string,
    results: FilterResult[],
    blocked: boolean,
    flagged: boolean
  ): ScanResult {
    return {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      results,
      blocked,
      flagged,
      timestamp: new Date().toISOString(),
      duration: 0
    };
  }

  /**
   * Add scan result to history
   */
  private addToHistory(result: ScanResult): void {
    this.scanHistory.push(result);

    // Trim history if needed
    if (this.scanHistory.length > this.config.maxScanHistory) {
      this.scanHistory = this.scanHistory.slice(-this.config.maxScanHistory);
    }
  }

  /**
   * Get scan history
   */
  getScanHistory(limit: number = 100): ScanResult[] {
    return this.scanHistory.slice(-limit);
  }

  /**
   * Get blocked scans
   */
  getBlockedScans(): ScanResult[] {
    return this.scanHistory.filter(s => s.blocked);
  }

  /**
   * Get flagged scans
   */
  getFlaggedScans(): ScanResult[] {
    return this.scanHistory.filter(s => s.flagged && !s.blocked);
  }

  /**
   * Get Model Armor stats
   */
  getStats(): {
    totalScans: number;
    blockedScans: number;
    flaggedScans: number;
    cleanScans: number;
    byType: Record<FilterType, number>;
    bySeverity: Record<FilterSeverity, number>;
    averageScanDuration: number;
  } {
    const scans = this.scanHistory;
    const blocked = scans.filter(s => s.blocked);
    const flagged = scans.filter(s => s.flagged && !s.blocked);
    const clean = scans.filter(s => !s.blocked && !s.flagged);

    const byType: Record<FilterType, number> = {
      'prompt-injection': 0,
      'pii': 0,
      'jailbreak': 0,
      'custom': 0
    };

    const bySeverity: Record<FilterSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    scans.forEach(scan => {
      scan.results.forEach(result => {
        if (result.detected) {
          byType[result.type]++;
          bySeverity[result.severity]++;
        }
      });
    });

    const totalDuration = scans.reduce((sum, s) => sum + s.duration, 0);

    return {
      totalScans: scans.length,
      blockedScans: blocked.length,
      flaggedScans: flagged.length,
      cleanScans: clean.length,
      byType,
      bySeverity,
      averageScanDuration: scans.length > 0 ? totalDuration / scans.length : 0
    };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<ModelArmorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): ModelArmorConfig {
    return { ...this.config };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.scanHistory = [];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.rules.clear();
    this.scanHistory = [];
  }
}

// Singleton instance
export const modelArmor = new ModelArmor();
