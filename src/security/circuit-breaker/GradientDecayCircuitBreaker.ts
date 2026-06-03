/**
 * Security: Gradient-Decay Circuit Breaker
 * 
 * Prevents infinite debugging loops and detects stagnant iterations.
 * Based on PRIDES Framework Paper Part 3 from Obsidian vault.
 */

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';
export type FailureType = 'stagnation' | 'convergence-failure' | 'cost-limit' | 'time-limit' | 'custom';

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxAttempts: number;
  monitoringWindowMs: number;
  gradientDecayThreshold: number;
  hammingDistanceThreshold: number;
  maxIterations: number;
  maxCost: number;
  maxRuntimeMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 3,
  recoveryTimeoutMs: 60000,
  halfOpenMaxAttempts: 1,
  monitoringWindowMs: 300000,
  gradientDecayThreshold: 0.1,
  hammingDistanceThreshold: 0.05,
  maxIterations: 10,
  maxCost: 100,
  maxRuntimeMs: 300000
};

export interface IterationSnapshot {
  iteration: number;
  timestamp: string;
  state: any;
  hammingDistance: number;
  gradient: number;
  cost: number;
  duration: number;
}

export interface CircuitBreakerEvent {
  id: string;
  type: FailureType;
  state: CircuitBreakerState;
  message: string;
  snapshot?: IterationSnapshot;
  timestamp: string;
}

export interface CircuitBreaker {
  id: string;
  name: string;
  state: CircuitBreakerState;
  config: CircuitBreakerConfig;
  
  // Statistics
  failureCount: number;
  successCount: number;
  lastFailureTime?: string;
  lastSuccessTime?: string;
  
  // Monitoring
  snapshots: IterationSnapshot[];
  events: CircuitBreakerEvent[];
  
  // State
  openedAt?: string;
  halfOpenAttempts: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Gradient-Decay Circuit Breaker
 */
export class GradientDecayCircuitBreaker {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private globalConfig: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.globalConfig = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a circuit breaker
   */
  createCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const circuitBreaker: CircuitBreaker = {
      id: `cb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      state: 'closed',
      config: { ...this.globalConfig, ...config },
      failureCount: 0,
      successCount: 0,
      snapshots: [],
      events: [],
      halfOpenAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.circuitBreakers.set(circuitBreaker.id, circuitBreaker);
    return circuitBreaker;
  }

  /**
   * Record an iteration snapshot
   */
  recordSnapshot(
    circuitBreakerId: string,
    state: any,
    cost: number,
    duration: number
  ): IterationSnapshot | null {
    const cb = this.circuitBreakers.get(circuitBreakerId);
    if (!cb) return null;

    const iteration = cb.snapshots.length + 1;
    const hammingDistance = this.calculateHammingDistance(
      cb.snapshots.length > 0 ? cb.snapshots[cb.snapshots.length - 1].state : null,
      state
    );
    const gradient = this.calculateGradient(cb.snapshots, hammingDistance);

    const snapshot: IterationSnapshot = {
      iteration,
      timestamp: new Date().toISOString(),
      state,
      hammingDistance,
      gradient,
      cost,
      duration
    };

    cb.snapshots.push(snapshot);
    cb.updatedAt = new Date().toISOString();

    // Check for failures
    this.checkForFailures(cb, snapshot);

    return snapshot;
  }

  /**
   * Calculate Hamming distance between states
   */
  private calculateHammingDistance(prevState: any, currentState: any): number {
    if (!prevState) return 1;

    // Simple string comparison for demonstration
    const prevStr = JSON.stringify(prevState);
    const currStr = JSON.stringify(currentState);

    let matches = 0;
    const maxLen = Math.max(prevStr.length, currStr.length);

    for (let i = 0; i < Math.min(prevStr.length, currStr.length); i++) {
      if (prevStr[i] === currStr[i]) {
        matches++;
      }
    }

    return 1 - (matches / maxLen);
  }

  /**
   * Calculate gradient (rate of change)
   */
  private calculateGradient(snapshots: IterationSnapshot[], currentHamming: number): number {
    if (snapshots.length < 2) return 0;

    const recentSnapshots = snapshots.slice(-5);
    const hammingValues = recentSnapshots.map(s => s.hammingDistance);
    hammingValues.push(currentHamming);

    // Calculate average gradient
    let totalGradient = 0;
    for (let i = 1; i < hammingValues.length; i++) {
      totalGradient += hammingValues[i] - hammingValues[i - 1];
    }

    return totalGradient / (hammingValues.length - 1);
  }

  /**
   * Check for failures based on snapshot
   */
  private checkForFailures(cb: CircuitBreaker, snapshot: IterationSnapshot): void {
    const config = cb.config;

    // Check stagnation (gradient decay)
    if (cb.snapshots.length >= 3) {
      const recentGradients = cb.snapshots.slice(-3).map(s => s.gradient);
      const avgGradient = recentGradients.reduce((a, b) => a + b, 0) / recentGradients.length;

      if (Math.abs(avgGradient) < config.gradientDecayThreshold) {
        this.recordFailure(cb, 'stagnation', 'Gradient decay detected - iterations not improving');
      }
    }

    // Check Hamming distance convergence
    if (cb.snapshots.length >= 2) {
      const lastHamming = snapshot.hammingDistance;
      if (lastHamming < config.hammingDistanceThreshold) {
        this.recordFailure(cb, 'convergence-failure', 'Hamming distance too low - possible limit cycle');
      }
    }

    // Check iteration limit
    if (snapshot.iteration >= config.maxIterations) {
      this.recordFailure(cb, 'cost-limit', 'Maximum iterations reached');
    }

    // Check cost limit
    const totalCost = cb.snapshots.reduce((sum, s) => sum + s.cost, 0);
    if (totalCost >= config.maxCost) {
      this.recordFailure(cb, 'cost-limit', 'Maximum cost reached');
    }

    // Check runtime limit
    const startTime = new Date(cb.snapshots[0]?.timestamp || cb.createdAt).getTime();
    const currentTime = Date.now();
    if (currentTime - startTime >= config.maxRuntimeMs) {
      this.recordFailure(cb, 'time-limit', 'Maximum runtime reached');
    }
  }

  /**
   * Record a failure
   */
  recordFailure(cb: CircuitBreaker, type: FailureType, message: string): void {
    cb.failureCount++;
    cb.lastFailureTime = new Date().toISOString();
    cb.updatedAt = new Date().toISOString();

    const event: CircuitBreakerEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      state: cb.state,
      message,
      snapshot: cb.snapshots[cb.snapshots.length - 1],
      timestamp: new Date().toISOString()
    };

    cb.events.push(event);

    // Check if we should open the circuit
    if (cb.failureCount >= cb.config.failureThreshold && cb.state === 'closed') {
      this.openCircuit(cb);
    }
  }

  /**
   * Record a success
   */
  recordSuccess(cb: CircuitBreaker): void {
    cb.successCount++;
    cb.lastSuccessTime = new Date().toISOString();
    cb.failureCount = 0;
    cb.updatedAt = new Date().toISOString();

    // If half-open and success, close the circuit
    if (cb.state === 'half-open') {
      this.closeCircuit(cb);
    }
  }

  /**
   * Open the circuit
   */
  private openCircuit(cb: CircuitBreaker): void {
    cb.state = 'open';
    cb.openedAt = new Date().toISOString();
    cb.updatedAt = new Date().toISOString();

    const event: CircuitBreakerEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'stagnation',
      state: 'open',
      message: 'Circuit breaker opened due to failures',
      timestamp: new Date().toISOString()
    };

    cb.events.push(event);

    console.error(`[CircuitBreaker] ${cb.name}: OPENED - Too many failures`);
  }

  /**
   * Close the circuit
   */
  private closeCircuit(cb: CircuitBreaker): void {
    cb.state = 'closed';
    cb.failureCount = 0;
    cb.halfOpenAttempts = 0;
    cb.openedAt = undefined;
    cb.updatedAt = new Date().toISOString();

    const event: CircuitBreakerEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'stagnation',
      state: 'closed',
      message: 'Circuit breaker closed - recovery successful',
      timestamp: new Date().toISOString()
    };

    cb.events.push(event);
  }

  /**
   * Check if circuit should transition to half-open
   */
  checkRecovery(cb: CircuitBreaker): boolean {
    if (cb.state !== 'open' || !cb.openedAt) return false;

    const openedAt = new Date(cb.openedAt).getTime();
    const now = Date.now();

    if (now - openedAt >= cb.config.recoveryTimeoutMs) {
      cb.state = 'half-open';
      cb.halfOpenAttempts = 0;
      cb.updatedAt = new Date().toISOString();

      const event: CircuitBreakerEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'stagnation',
        state: 'half-open',
        message: 'Circuit breaker transitioning to half-open',
        timestamp: new Date().toISOString()
      };

      cb.events.push(event);

      return true;
    }

    return false;
  }

  /**
   * Check if execution is allowed
   */
  canExecute(circuitBreakerId: string): boolean {
    const cb = this.circuitBreakers.get(circuitBreakerId);
    if (!cb || !cb.config.enabled) return true;

    // Check recovery
    this.checkRecovery(cb);

    switch (cb.state) {
      case 'closed':
        return true;
      case 'open':
        return false;
      case 'half-open':
        return cb.halfOpenAttempts < cb.config.halfOpenMaxAttempts;
      default:
        return true;
    }
  }

  /**
   * Reset circuit breaker
   */
  reset(circuitBreakerId: string): boolean {
    const cb = this.circuitBreakers.get(circuitBreakerId);
    if (!cb) return false;

    cb.state = 'closed';
    cb.failureCount = 0;
    cb.successCount = 0;
    cb.halfOpenAttempts = 0;
    cb.openedAt = undefined;
    cb.lastFailureTime = undefined;
    cb.lastSuccessTime = undefined;
    cb.snapshots = [];
    cb.events = [];
    cb.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * Get circuit breaker by ID
   */
  getCircuitBreaker(id: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(id);
  }

  /**
   * Get all circuit breakers
   */
  getCircuitBreakers(): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Get open circuit breakers
   */
  getOpenCircuitBreakers(): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values()).filter(cb => cb.state === 'open');
  }

  /**
   * Get circuit breaker stats
   */
  getStats(): {
    totalCircuitBreakers: number;
    byState: Record<CircuitBreakerState, number>;
    totalFailures: number;
    totalSuccesses: number;
    averageSnapshots: number;
  } {
    const cbs = Array.from(this.circuitBreakers.values());

    const byState: Record<CircuitBreakerState, number> = {
      closed: 0,
      open: 0,
      'half-open': 0
    };

    cbs.forEach(cb => byState[cb.state]++);

    const totalFailures = cbs.reduce((sum, cb) => sum + cb.failureCount, 0);
    const totalSuccesses = cbs.reduce((sum, cb) => sum + cb.successCount, 0);
    const totalSnapshots = cbs.reduce((sum, cb) => sum + cb.snapshots.length, 0);

    return {
      totalCircuitBreakers: cbs.length,
      byState,
      totalFailures,
      totalSuccesses,
      averageSnapshots: cbs.length > 0 ? totalSnapshots / cbs.length : 0
    };
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.circuitBreakers.clear();
  }
}

// Singleton instance
export const gradientDecayCircuitBreaker = new GradientDecayCircuitBreaker();
