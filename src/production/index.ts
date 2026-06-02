/**
 * Production Index
 * 
 * Exports all production components
 */

// Observability & Tracing
export { Tracer, tracer, MetricsCollector, metricsCollector } from './Observability';
export type {
  SpanStatus,
  TraceSpan,
  TraceEvent,
  Trace,
  ObservabilityConfig
} from './Observability';

// Persistent Services
export {
  SessionService,
  sessionService,
  ArtifactService,
  artifactService,
  MemoryBank,
  memoryBank
} from './PersistentServices';
export type {
  Session,
  Artifact,
  MemoryBankEntry,
  PersistentServiceConfig
} from './PersistentServices';

// Deployment Manager
export { DeploymentManager, deploymentManager } from './DeploymentManager';
export type {
  DeploymentPlatform,
  DeploymentStatus,
  DeploymentConfig,
  Deployment,
  DeploymentEnvironment
} from './DeploymentManager';
