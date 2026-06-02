/**
 * Security: OWASP LLM Top 10 Compliance
 * 
 * Implements security compliance framework for LLM applications.
 * Based on OWASP LLM Top 10 from Obsidian vault.
 */

export type OWASPCategory = 
  | 'prompt-injection'
  | 'sensitive-info-disclosure'
  | 'excessive-agency'
  | 'improper-output-handling'
  | 'supply-chain-vulnerabilities'
  | 'data-poisoning'
  | 'plugin-vulnerabilities'
  | 'excessive-functionality'
  | 'information-leakage'
  | 'insecure-output';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface OWASPRule {
  id: string;
  category: OWASPCategory;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  enabled: boolean;
  
  // Detection patterns
  patterns?: string[];
  keywords?: string[];
  
  // Mitigation
  mitigation: string;
  references: string[];
  
  // Metadata
  owaspId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceCheck {
  id: string;
  ruleId: string;
  category: OWASPCategory;
  status: 'pass' | 'fail' | 'warning' | 'skip';
  riskLevel: RiskLevel;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ComplianceReport {
  id: string;
  timestamp: string;
  checks: ComplianceCheck[];
  
  // Summary
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  
  // Risk assessment
  overallRisk: RiskLevel;
  riskScore: number;
  
  // Category breakdown
  byCategory: Record<OWASPCategory, {
    total: number;
    passed: number;
    failed: number;
    riskLevel: RiskLevel;
  }>;
  
  // Recommendations
  recommendations: string[];
}

export interface OWASPConfig {
  enabled: boolean;
  autoScan: boolean;
  failOnCritical: boolean;
  failOnHigh: boolean;
  maxReportHistory: number;
}

const DEFAULT_CONFIG: OWASPConfig = {
  enabled: true,
  autoScan: true,
  failOnCritical: true,
  failOnHigh: true,
  maxReportHistory: 100
};

/**
 * OWASP LLM Top 10 Compliance System
 */
export class OWASPCompliance {
  private rules: Map<string, OWASPRule> = new Map();
  private reports: ComplianceReport[] = [];
  private config: OWASPConfig;

  constructor(config: Partial<OWASPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultRules();
  }

  /**
   * Initialize default OWASP rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<OWASPRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        category: 'prompt-injection',
        name: 'LLM01: Prompt Injection',
        description: 'Attacker crafts input that causes the LLM to execute unintended actions',
        riskLevel: 'critical',
        enabled: true,
        patterns: [
          'ignore (previous|all) instructions',
          'you are now',
          'act as',
          'pretend to be',
          'override',
          'bypass'
        ],
        mitigation: 'Implement input validation, use allow lists, apply Model Armor filtering',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM01'
      },
      {
        category: 'sensitive-info-disclosure',
        name: 'LLM02: Sensitive Information Disclosure',
        description: 'LLM reveals sensitive data in its responses',
        riskLevel: 'critical',
        enabled: true,
        patterns: [
          'password',
          'api_key',
          'secret',
          'token',
          'credential',
          '\\b\\d{3}-\\d{2}-\\d{4}\\b'
        ],
        mitigation: 'Implement output filtering, redact PII, use Model Armor output scanning',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM02'
      },
      {
        category: 'excessive-agency',
        name: 'LLM03: Excessive Agency',
        description: 'LLM has too many permissions and can perform destructive actions',
        riskLevel: 'high',
        enabled: true,
        keywords: [
          'delete',
          'drop',
          'remove',
          'destroy',
          'execute',
          'admin',
          'root'
        ],
        mitigation: 'Implement least privilege, require human approval for critical ops',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM03'
      },
      {
        category: 'improper-output-handling',
        name: 'LLM04: Improper Output Handling',
        description: 'LLM output is used without proper validation',
        riskLevel: 'high',
        enabled: true,
        patterns: [
          'eval\\(',
          'exec\\(',
          'innerHTML',
          'dangerouslySetInnerHTML',
          '<script'
        ],
        mitigation: 'Validate all LLM outputs, sanitize before use, use parameterized queries',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM04'
      },
      {
        category: 'supply-chain-vulnerabilities',
        name: 'LLM05: Supply Chain Vulnerabilities',
        description: 'Vulnerabilities in LLM dependencies or training data',
        riskLevel: 'medium',
        enabled: true,
        keywords: [
          'npm install',
          'pip install',
          'import',
          'require'
        ],
        mitigation: 'Verify dependencies, use lock files, scan for vulnerabilities',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM05'
      },
      {
        category: 'data-poisoning',
        name: 'LLM06: Data Poisoning',
        description: 'Training data is manipulated to influence LLM behavior',
        riskLevel: 'high',
        enabled: true,
        keywords: [
          'training data',
          'fine-tune',
          'embeddings',
          'vector database'
        ],
        mitigation: 'Validate training data sources, implement data quality checks',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM06'
      },
      {
        category: 'plugin-vulnerabilities',
        name: 'LLM07: Plugin Vulnerabilities',
        description: 'LLM plugins have security vulnerabilities',
        riskLevel: 'high',
        enabled: true,
        keywords: [
          'plugin',
          'extension',
          'tool',
          'function calling'
        ],
        mitigation: 'Validate plugin inputs, sandbox plugin execution, audit plugin behavior',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM07'
      },
      {
        category: 'excessive-functionality',
        name: 'LLM08: Excessive Functionality',
        description: 'LLM has more features than necessary',
        riskLevel: 'medium',
        enabled: true,
        keywords: [
          'admin',
          'debug',
          'test',
          'development'
        ],
        mitigation: 'Disable unnecessary features, implement feature flags',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM08'
      },
      {
        category: 'information-leakage',
        name: 'LLM09: Information Leakage',
        description: 'LLM reveals internal system information',
        riskLevel: 'medium',
        enabled: true,
        patterns: [
          'system prompt',
          'configuration',
          'internal',
          'debug',
          'error.*stack'
        ],
        mitigation: 'Filter internal information, implement response validation',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM09'
      },
      {
        category: 'insecure-output',
        name: 'LLM10: Insecure Output',
        description: 'LLM generates insecure code or configurations',
        riskLevel: 'high',
        enabled: true,
        patterns: [
          'SELECT.*FROM',
          'INSERT.*INTO',
          '<script',
          'javascript:',
          'eval\\('
        ],
        mitigation: 'Scan output for vulnerabilities, use secure coding practices',
        references: ['https://owasp.org/www-project-top-10-for-llm-applications/'],
        owaspId: 'LLM10'
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  /**
   * Add an OWASP rule
   */
  addRule(ruleData: Omit<OWASPRule, 'id' | 'createdAt' | 'updatedAt'>): OWASPRule {
    const rule: OWASPRule = {
      ...ruleData,
      id: `owasp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.rules.set(rule.id, rule);
    return rule;
  }

  /**
   * Run compliance check on content
   */
  runComplianceCheck(content: string): ComplianceReport {
    const checks: ComplianceCheck[] = [];
    const startTime = Date.now();

    // Get enabled rules
    const rules = Array.from(this.rules.values()).filter(r => r.enabled);

    for (const rule of rules) {
      const check = this.checkRule(rule, content);
      checks.push(check);
    }

    // Calculate summary
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warnings = checks.filter(c => c.status === 'warning').length;
    const skipped = checks.filter(c => c.status === 'skip').length;

    // Calculate risk score (0-100, higher is riskier)
    const riskScore = this.calculateRiskScore(checks);

    // Determine overall risk
    const overallRisk = this.determineOverallRisk(checks);

    // Calculate category breakdown
    const byCategory = this.calculateCategoryBreakdown(checks);

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks);

    const report: ComplianceReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      checks,
      totalChecks: checks.length,
      passed,
      failed,
      warnings,
      skipped,
      overallRisk,
      riskScore,
      byCategory,
      recommendations
    };

    // Add to history
    this.reports.push(report);
    if (this.reports.length > this.config.maxReportHistory) {
      this.reports = this.reports.slice(-this.config.maxReportHistory);
    }

    return report;
  }

  /**
   * Check a single rule
   */
  private checkRule(rule: OWASPRule, content: string): ComplianceCheck {
    let status: ComplianceCheck['status'] = 'pass';
    let message = 'Check passed';
    let details: any = undefined;

    // Check patterns
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(content)) {
          status = 'fail';
          message = `Pattern detected: ${pattern}`;
          details = { pattern, matches: content.match(regex) };
          break;
        }
      }
    }

    // Check keywords
    if (status === 'pass' && rule.keywords) {
      const lowerContent = content.toLowerCase();
      for (const keyword of rule.keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          status = 'warning';
          message = `Keyword detected: ${keyword}`;
          details = { keyword };
          break;
        }
      }
    }

    return {
      id: `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      category: rule.category,
      status,
      riskLevel: rule.riskLevel,
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(checks: ComplianceCheck[]): number {
    let score = 0;
    const riskWeights: Record<RiskLevel, number> = {
      critical: 25,
      high: 15,
      medium: 10,
      low: 5,
      info: 1
    };

    checks.forEach(check => {
      if (check.status === 'fail') {
        score += riskWeights[check.riskLevel] || 0;
      } else if (check.status === 'warning') {
        score += (riskWeights[check.riskLevel] || 0) / 2;
      }
    });

    return Math.min(score, 100);
  }

  /**
   * Determine overall risk level
   */
  private determineOverallRisk(checks: ComplianceCheck[]): RiskLevel {
    const failedChecks = checks.filter(c => c.status === 'fail');
    
    if (failedChecks.some(c => c.riskLevel === 'critical')) return 'critical';
    if (failedChecks.some(c => c.riskLevel === 'high')) return 'high';
    if (failedChecks.some(c => c.riskLevel === 'medium')) return 'medium';
    if (failedChecks.some(c => c.riskLevel === 'low')) return 'low';
    return 'info';
  }

  /**
   * Calculate category breakdown
   */
  private calculateCategoryBreakdown(checks: ComplianceCheck[]): ComplianceReport['byCategory'] {
    const breakdown: ComplianceReport['byCategory'] = {} as any;

    const categories: OWASPCategory[] = [
      'prompt-injection', 'sensitive-info-disclosure', 'excessive-agency',
      'improper-output-handling', 'supply-chain-vulnerabilities', 'data-poisoning',
      'plugin-vulnerabilities', 'excessive-functionality', 'information-leakage',
      'insecure-output'
    ];

    categories.forEach(category => {
      const categoryChecks = checks.filter(c => c.category === category);
      const failed = categoryChecks.filter(c => c.status === 'fail');
      
      let riskLevel: RiskLevel = 'info';
      if (failed.some(c => c.riskLevel === 'critical')) riskLevel = 'critical';
      else if (failed.some(c => c.riskLevel === 'high')) riskLevel = 'high';
      else if (failed.some(c => c.riskLevel === 'medium')) riskLevel = 'medium';
      else if (failed.some(c => c.riskLevel === 'low')) riskLevel = 'low';

      breakdown[category] = {
        total: categoryChecks.length,
        passed: categoryChecks.filter(c => c.status === 'pass').length,
        failed: failed.length,
        riskLevel
      };
    });

    return breakdown;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(checks: ComplianceCheck[]): string[] {
    const recommendations: string[] = [];
    const failedChecks = checks.filter(c => c.status === 'fail');

    failedChecks.forEach(check => {
      const rule = this.rules.get(check.ruleId);
      if (rule) {
        recommendations.push(`[${rule.owaspId}] ${rule.mitigation}`);
      }
    });

    return [...new Set(recommendations)];
  }

  /**
   * Get recent reports
   */
  getRecentReports(limit: number = 10): ComplianceReport[] {
    return this.reports.slice(-limit);
  }

  /**
   * Get OWASP compliance stats
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    totalReports: number;
    averageRiskScore: number;
    lastReportRisk: RiskLevel;
  } {
    const rules = Array.from(this.rules.values());
    const enabled = rules.filter(r => r.enabled);

    const totalRiskScore = this.reports.reduce((sum, r) => sum + r.riskScore, 0);
    const lastReport = this.reports[this.reports.length - 1];

    return {
      totalRules: rules.length,
      enabledRules: enabled.length,
      totalReports: this.reports.length,
      averageRiskScore: this.reports.length > 0 ? totalRiskScore / this.reports.length : 0,
      lastReportRisk: lastReport?.overallRisk || 'info'
    };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<OWASPConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): OWASPConfig {
    return { ...this.config };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.rules.clear();
    this.reports = [];
  }
}

// Singleton instance
export const owaspCompliance = new OWASPCompliance();
