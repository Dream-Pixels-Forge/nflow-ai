/**
 * Agent OS Index
 * 
 * Exports all 7-Layer Personal Agent OS components
 */

// Layer 1: Identity System
export { IdentityManager, identityManager } from './IdentitySystem';
export type {
  UserIdentity,
  IdentityRule,
  IdentityTemplate
} from './IdentitySystem';

// Layer 2: Context Portfolio
export { ContextPortfolioManager, contextPortfolioManager } from './ContextPortfolio';
export type {
  ContextCategory,
  ContextEntry,
  ContextTemplate
} from './ContextPortfolio';

// Layer 3: Skills Library
export { SkillsLibrary, skillsLibrary } from './SkillsLibrary';
export type {
  SkillCategory,
  SkillParameter,
  SkillStep,
  Skill,
  SkillExecution
} from './SkillsLibrary';

// Layer 7: AgentOS Orchestrator
export { AgentOS, agentOS } from './AgentOS';
export type {
  AgentOSConfig,
  AgentOSState,
  VerificationResult
} from './AgentOS';
