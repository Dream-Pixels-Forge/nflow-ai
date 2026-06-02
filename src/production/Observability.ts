/**
 * Production: Observability & Tracing
 * 
 * Implements request tracing, span tracking, and performance monitoring.
 * Based on ADK Observability from Obsidian vault (Cloud Trace integration).
 */

export type SpanStatus = 'unspecified' | 'ok' | 'error' | 'timeout' | 'cancelled';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: SpanStatus;
  attributes: Record<string, any>;
  events: TraceEvent[];
  resource: {
    type: string;
    labels: Record<string, string>;
  };
}

export interface TraceEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, any>;
}

export interface Trace {
  traceId: string;
  spans: TraceSpan[];
  startTime: string;
  endTime?: string;
  duration?: number;
  status: SpanStatus;
  resource: {
    type: string;
    labels: Record<string, string>;
  };
}

export interface ObservabilityConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of traces to sample
  maxSpansPerTrace: number;
  maxAttributesPerSpan: number;
  exportEndpoint?: string;
  exportIntervalMs: number;
}

const DEFAULT_CONFIG: ObservabilityConfig = {
  enabled: true,
  sampleRate: 1.0,
  maxSpansPerTrace: 100,
  maxAttributesPerSpan: 50,
  exportIntervalMs: 30000
};

/**
 * Tracer - Manages distributed tracing
 */
export class Tracer {
  private config: ObservabilityConfig;
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private spanCounter = 0;

  constructor(config: Partial<ObservabilityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start a new trace
   */
  startTrace(name: string, attributes: Record<string, any> = {}): string {
    if (!this.config.enabled) return '';
    if (Math.random() > this.config.sampleRate) return '';

    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const trace: Trace = {
      traceId,
      spans: [],
      startTime: new Date().toISOString(),
      status: 'ok',
      resource: {
        type: 'agent',
        labels: {
          service: 'nexusflow',
          version: '1.0.0'
        }
      }
    };

    this.traces.set(traceId, trace);

    // Start root span
    this.startSpan(traceId, name, attributes);

    return traceId;
  }

  /**
   * Start a new span
   */
  startSpan(traceId: string, name: string, attributes: Record<string, any> = {}, parentSpanId?: string): string {
    if (!this.config.enabled) return '';

    const trace = this.traces.get(traceId);
    if (!trace) return '';

    // Check span limit
    if (trace.spans.length >= this.config.maxSpansPerTrace) {
      console.warn(`[Tracer] Span limit reached for trace ${traceId}`);
      return '';
    }

    this.spanCounter++;
    const spanId = `span-${this.spanCounter}`;

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: new Date().toISOString(),
      status: 'ok',
      attributes: this.limitAttributes(attributes),
      events: [],
      resource: trace.resource
    };

    trace.spans.push(span);
    this.activeSpans.set(spanId, span);

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, status: SpanStatus = 'ok', attributes: Record<string, any> = {}): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = new Date().toISOString();
    span.duration = new Date(span.endTime).getTime() - new Date(span.startTime).getTime();
    span.status = status;
    Object.assign(span.attributes, this.limitAttributes(attributes));

    this.activeSpans.delete(spanId);

    // Update trace status if error
    if (status === 'error') {
      const trace = this.traces.get(span.traceId);
      if (trace) {
        trace.status = 'error';
      }
    }
  }

  /**
   * Add event to span
   */
  addEvent(spanId: string, name: string, attributes: Record<string, any> = {}): void {
    const span = this.activeSpans.get(spanId) || this.findSpan(spanId);
    if (!span) return;

    span.events.push({
      name,
      timestamp: new Date().toISOString(),
      attributes
    });
  }

  /**
   * Find span by ID across all traces
   */
  private findSpan(spanId: string): TraceSpan | undefined {
    for (const trace of this.traces.values()) {
      const span = trace.spans.find(s => s.spanId === spanId);
      if (span) return span;
    }
    return undefined;
  }

  /**
   * Limit attributes to max count
   */
  private limitAttributes(attributes: Record<string, any>): Record<string, any> {
    const keys = Object.keys(attributes);
    if (keys.length <= this.config.maxAttributesPerSpan) {
      return attributes;
    }

    const limited: Record<string, any> = {};
    keys.slice(0, this.config.maxAttributesPerSpan).forEach(key => {
      limited[key] = attributes[key];
    });
    return limited;
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces
   */
  getTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit: number = 10): Trace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  /**
   * Get trace by span ID
   */
  getTraceBySpanId(spanId: string): Trace | undefined {
    for (const trace of this.traces.values()) {
      if (trace.spans.some(s => s.spanId === spanId)) {
        return trace;
      }
    }
    return undefined;
  }

  /**
   * Get trace statistics
   */
  getStats(): {
    totalTraces: number;
    totalSpans: number;
    averageSpansPerTrace: number;
    averageDuration: number;
    errorRate: number;
    activeSpans: number;
  } {
    const traces = Array.from(this.traces.values());
    const totalSpans = traces.reduce((sum, t) => sum + t.spans.length, 0);
    const completedTraces = traces.filter(t => t.duration);
    const errorTraces = traces.filter(t => t.status === 'error');

    const totalDuration = completedTraces.reduce((sum, t) => sum + (t.duration || 0), 0);

    return {
      totalTraces: traces.length,
      totalSpans,
      averageSpansPerTrace: traces.length > 0 ? totalSpans / traces.length : 0,
      averageDuration: completedTraces.length > 0 ? totalDuration / completedTraces.length : 0,
      errorRate: traces.length > 0 ? errorTraces.length / traces.length : 0,
      activeSpans: this.activeSpans.size
    };
  }

  /**
   * Export traces as JSON
   */
  exportTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Clear old traces
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    this.traces.forEach((trace, id) => {
      if (new Date(trace.startTime).getTime() < cutoff) {
        this.traces.delete(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear();
    this.activeSpans.clear();
  }
}

/**
 * Metrics Collector - Collects and aggregates metrics
 */
export class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number): void {
    const values = this.metrics.get(name) || [];
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    
    this.metrics.set(name, values);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Decrement a counter
   */
  decrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current - value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Get metric values
   */
  getMetric(name: string): number[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name: string): {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Get counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  /**
   * Get all counters
   */
  getCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  /**
   * Get all gauges
   */
  getGauges(): Record<string, number> {
    return Object.fromEntries(this.gauges);
  }

  /**
   * Get all metrics summary
   */
  getSummary(): {
    metrics: string[];
    counters: Record<string, number>;
    gauges: Record<string, number>;
  } {
    return {
      metrics: Array.from(this.metrics.keys()),
      counters: this.getCounters(),
      gauges: this.getGauges()
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
  }
}

// Singleton instances
export const tracer = new Tracer();
export const metricsCollector = new MetricsCollector();
