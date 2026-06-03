/**
 * A2A Protocol - SSE (Server-Sent Events)
 * 
 * Implements real-time task state updates via Server-Sent Events
 * Based on A2A Protocol specification from Obsidian vault.
 */

import { Task, TaskManager, taskManager } from './TaskManager';

export interface SSEConnection {
  id: string;
  taskId: string;
  agentId: string;
  connectedAt: string;
  lastHeartbeat: string;
  eventSource?: EventSource;
  callback: (event: SSEEvent) => void;
}

export interface SSEEvent {
  type: 'state-change' | 'output' | 'artifact' | 'error' | 'heartbeat' | 'connected' | 'disconnected';
  taskId: string;
  data: any;
  timestamp: string;
}

export interface SSEConfig {
  heartbeatIntervalMs: number;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: SSEConfig = {
  heartbeatIntervalMs: 30000,
  reconnectIntervalMs: 5000,
  maxReconnectAttempts: 5,
  timeoutMs: 300000
};

/**
 * SSE Manager - Handles real-time task updates
 */
export class SSEManager {
  private connections: Map<string, SSEConnection> = new Map();
  private taskManager: TaskManager;
  private config: SSEConfig;
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(taskManager: TaskManager, config: Partial<SSEConfig> = {}) {
    this.taskManager = taskManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to task updates via SSE
   */
  connect(taskId: string, agentId: string, callback: (event: SSEEvent) => void): SSEConnection {
    const connectionId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const connection: SSEConnection = {
      id: connectionId,
      taskId,
      agentId,
      connectedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      callback
    };

    this.connections.set(connectionId, connection);

    // Subscribe to task updates
    const subscription = this.taskManager.subscribe(taskId, (task) => {
      this.emitEvent(connectionId, {
        type: 'state-change',
        taskId: task.id,
        data: {
          state: task.state,
          output: task.output,
          artifacts: task.artifacts,
          error: task.error
        },
        timestamp: new Date().toISOString()
      });
    });

    // Store subscription reference for cleanup
    (connection as any).subscription = subscription;

    // Start heartbeat
    this.startHeartbeat(connectionId);

    // Emit connected event
    this.emitEvent(connectionId, {
      type: 'connected',
      taskId,
      data: { connectionId, agentId },
      timestamp: new Date().toISOString()
    });

    return connection;
  }

  /**
   * Connect to remote agent's SSE endpoint
   */
  async connectToRemote(
    remoteAgentUrl: string,
    taskId: string,
    callback: (event: SSEEvent) => void
  ): Promise<SSEConnection | null> {
    try {
      const sseUrl = `${remoteAgentUrl}/sse?taskId=${taskId}`;
      
      // Create EventSource for SSE
      const eventSource = new EventSource(sseUrl);
      
      const connectionId = `sse-remote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const connection: SSEConnection = {
        id: connectionId,
        taskId,
        agentId: 'remote',
        connectedAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        eventSource,
        callback
      };

      this.connections.set(connectionId, connection);

      // Handle SSE events
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emitEvent(connectionId, {
            type: data.type || 'state-change',
            taskId: data.taskId || taskId,
            data: data.data || data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } catch (error) {
          console.error('[SSE] Failed to parse event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        this.handleReconnection(connectionId);
      };

      // Start heartbeat
      this.startHeartbeat(connectionId);

      return connection;
    } catch (error) {
      console.error('[SSE] Failed to connect to remote:', error);
      return null;
    }
  }

  /**
   * Disconnect from task updates
   */
  disconnect(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    // Stop heartbeat
    const heartbeatTimer = this.heartbeatTimers.get(connectionId);
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      this.heartbeatTimers.delete(connectionId);
    }

    // Close EventSource if exists
    if (connection.eventSource) {
      connection.eventSource.close();
    }

    // Unsubscribe from task updates
    if ((connection as any).subscription) {
      this.taskManager.unsubscribe((connection as any).subscription);
    }

    // Emit disconnected event
    this.emitEvent(connectionId, {
      type: 'disconnected',
      taskId: connection.taskId,
      data: { connectionId },
      timestamp: new Date().toISOString()
    });

    this.connections.delete(connectionId);

    return true;
  }

  /**
   * Start heartbeat for connection
   */
  private startHeartbeat(connectionId: string): void {
    const timer = setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        clearInterval(timer);
        return;
      }

      connection.lastHeartbeat = new Date().toISOString();

      this.emitEvent(connectionId, {
        type: 'heartbeat',
        taskId: connection.taskId,
        data: { connectionId, timestamp: connection.lastHeartbeat },
        timestamp: new Date().toISOString()
      });
    }, this.config.heartbeatIntervalMs);

    this.heartbeatTimers.set(connectionId, timer);
  }

  /**
   * Handle reconnection
   */
  private handleReconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Check if we should reconnect
    if (connection.eventSource?.readyState === EventSource.CLOSED) {
      // Attempt reconnection
      setTimeout(() => {
        this.connectToRemote(
          connection.eventSource?.url?.replace('/sse', '') || '',
          connection.taskId,
          connection.callback
        );
      }, this.config.reconnectIntervalMs);
    }
  }

  /**
   * Emit SSE event
   */
  private emitEvent(connectionId: string, event: SSEEvent): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      connection.callback(event);
    } catch (error) {
      console.error('[SSE] Error emitting event:', error);
    }
  }

  /**
   * Broadcast event to all connections for a task
   */
  broadcastToTask(taskId: string, event: Omit<SSEEvent, 'taskId'>): void {
    this.connections.forEach((connection) => {
      if (connection.taskId === taskId) {
        this.emitEvent(connection.id, {
          ...event,
          taskId
        });
      }
    });
  }

  /**
   * Broadcast event to all connections
   */
  broadcastAll(event: Omit<SSEEvent, 'taskId'>): void {
    this.connections.forEach((connection) => {
      this.emitEvent(connection.id, {
        ...event,
        taskId: connection.taskId
      });
    });
  }

  /**
   * Get all active connections
   */
  getConnections(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections for a specific task
   */
  getTaskConnections(taskId: string): SSEConnection[] {
    return Array.from(this.connections.values()).filter(c => c.taskId === taskId);
  }

  /**
   * Get connection stats
   */
  getStats(): {
    totalConnections: number;
    taskConnections: Record<string, number>;
    agentConnections: Record<string, number>;
  } {
    const connections = Array.from(this.connections.values());
    
    const taskConnections: Record<string, number> = {};
    const agentConnections: Record<string, number> = {};

    connections.forEach(c => {
      taskConnections[c.taskId] = (taskConnections[c.taskId] || 0) + 1;
      agentConnections[c.agentId] = (agentConnections[c.agentId] || 0) + 1;
    });

    return {
      totalConnections: connections.length,
      taskConnections,
      agentConnections
    };
  }

  /**
   * Cleanup stale connections
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    this.connections.forEach((connection, id) => {
      if (new Date(connection.lastHeartbeat).getTime() < cutoff) {
        this.disconnect(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.connections.forEach((_, id) => {
      this.disconnect(id);
    });
    this.connections.clear();
    this.heartbeatTimers.clear();
  }
}

// Singleton instance
export const sseManager = new SSEManager(taskManager);
