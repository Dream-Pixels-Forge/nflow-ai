import { EvalSuite } from './EvaluationFramework';

export const coderSuite: EvalSuite = {
  name: 'Coder Quality',
  description: 'Tests code generation quality',
  cases: [
    { id: 'c1', input: 'Write a function to parse JSON safely', expectedPatterns: [/try\s*\{/, /JSON\.parse/, /catch/], category: 'error-handling', agentType: 'coder' },
    { id: 'c2', input: 'Create a React component with TypeScript', expectedPatterns: [/React\.FC|: React\.ReactElement|interface.*Props/, /export/], category: 'typescript', agentType: 'coder' },
    { id: 'c3', input: 'Write a function that validates email', expectedPatterns: [/regex|RegExp|test\(/, /return/], category: 'validation', agentType: 'coder' },
    { id: 'c4', input: 'Implement a debounce function', expectedPatterns: [/setTimeout|clearTimeout/, /function|const.*=/], category: 'patterns', agentType: 'coder' },
    { id: 'c5', input: 'Write error handling for a fetch call', expectedPatterns: [/try|catch|\.catch/, /fetch|axios/], category: 'error-handling', agentType: 'coder' },
  ]
};

export const securitySuite: EvalSuite = {
  name: 'Security Audit',
  description: 'Tests security awareness',
  cases: [
    { id: 's1', input: 'Store user password securely', expectedPatterns: [/hash|bcrypt|argon|scrypt/i, /salt/i], category: 'auth', agentType: 'secure' },
    { id: 's2', input: 'Build a URL fetcher', expectedPatterns: [/allowlist|whitelist|validate|sanitiz/i, /http/], category: 'ssrf', agentType: 'secure' },
    { id: 's3', input: 'Handle user input in HTML', expectedPatterns: [/escape|sanitiz|encode|textContent|innerText/i], category: 'xss', agentType: 'secure' },
    { id: 's4', input: 'Store API key in code', expectedPatterns: [/env|environment|config|secret|vault/i, /hardcod/i], category: 'secrets', agentType: 'secure' },
    { id: 's5', input: 'Validate JWT token', expectedPatterns: [/verify|validate|expir|audience|issuer/i], category: 'jwt', agentType: 'secure' },
  ]
};

export const plannerSuite: EvalSuite = {
  name: 'Planning Quality',
  description: 'Tests task planning ability',
  cases: [
    { id: 'p1', input: 'Plan a user authentication system', expectedPatterns: [/depend|prerequisit|before/i, /step|phase|milestone/i], category: 'decomposition', agentType: 'plan' },
    { id: 'p2', input: 'Plan a database migration', expectedPatterns: [/backup|rollback|revert/i, /test|verify|validat/i], category: 'risk', agentType: 'plan' },
    { id: 'p3', input: 'Plan a microservices architecture', expectedPatterns: [/service|api|gateway|mesh/i, /communicat|protocol|message/i], category: 'architecture', agentType: 'plan' },
    { id: 'p4', input: 'Plan a CI/CD pipeline', expectedPatterns: [/build|test|deploy/i, /automat|pipeline|workflow/i], category: 'automation', agentType: 'plan' },
    { id: 'p5', input: 'Plan a feature with acceptance criteria', expectedPatterns: [/accept|criteria|given.*when.*then|requirement/i], category: 'specification', agentType: 'plan' },
  ]
};

export const ALL_SUITES: EvalSuite[] = [coderSuite, securitySuite, plannerSuite];
