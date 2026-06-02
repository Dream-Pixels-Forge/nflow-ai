/**
 * Security Index
 * 
 * Exports all security components
 */

// AP2 Protocol (Agent Payments)
export { AP2Protocol, ap2Protocol } from './AP2Protocol';
export type {
  MandateType,
  MandateStatus,
  TransactionStatus,
  SpendingLimit,
  MerchantCategory,
  Mandate,
  LineItem,
  Transaction,
  MandateExchangeRequest,
  MandateExchangeResponse,
  AP2Config
} from './AP2Protocol';

// Enhanced Emergency Stop
export { EnhancedEmergencyStop, enhancedEmergencyStop } from './EnhancedEmergencyStop';
export type {
  EmergencyLevel,
  EmergencyAction,
  EmergencyEvent,
  EmergencyConfig
} from './EnhancedEmergencyStop';

// Verification System
export { VerificationSystem, verificationSystem } from './VerificationSystem';
export type {
  VerificationType,
  VerificationStatus,
  SeverityLevel,
  VerificationRule,
  VerificationResult,
  VerificationCheck,
  AuditEntry,
  VerificationConfig
} from './VerificationSystem';

// Model Armor (Input/Output Filtering)
export { ModelArmor, modelArmor } from './model-armor/ModelArmor';
export type {
  FilterType,
  FilterAction,
  FilterSeverity,
  FilterRule as ModelArmorFilterRule,
  FilterResult,
  ScanResult,
  ModelArmorConfig
} from './model-armor/ModelArmor';

// Secret Manager
export { SecretManager, secretManager } from './secret-manager/SecretManager';
export type {
  SecretType,
  SecretStatus,
  Secret,
  SecretManagerConfig
} from './secret-manager/SecretManager';

// Circuit Breaker
export { GradientDecayCircuitBreaker, gradientDecayCircuitBreaker } from './circuit-breaker/GradientDecayCircuitBreaker';
export type {
  CircuitBreakerState,
  FailureType,
  CircuitBreakerConfig,
  IterationSnapshot,
  CircuitBreakerEvent,
  CircuitBreaker
} from './circuit-breaker/GradientDecayCircuitBreaker';

// System Prompt Anchor
export { SystemPromptAnchor, systemPromptAnchor } from './circuit-breaker/SystemPromptAnchor';
export type {
  AnchorRule,
  ContextBlock,
  AnchoredPrompt,
  SystemPromptAnchorConfig
} from './circuit-breaker/SystemPromptAnchor';

// OWASP Compliance
export { OWASPCompliance, owaspCompliance } from './owasp/OWASPCompliance';
export type {
  OWASPCategory,
  RiskLevel,
  OWASPRule,
  ComplianceCheck,
  ComplianceReport,
  OWASPConfig
} from './owasp/OWASPCompliance';

// Agent Authentication
export { AgentAuth, agentAuth } from './auth/AgentAuth';
export type {
  AuthMethod,
  AuthStatus,
  AuthCredential,
  AuthChallenge,
  AuthSession,
  AgentDiscovery,
  AgentAuthConfig
} from './auth/AgentAuth';
