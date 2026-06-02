/**
 * A2A Protocol - Task Lifecycle
 * 
 * Implements persistent task state management for agent-to-agent communication
 * Based on A2A Protocol specification from Obsidian vault.
 */

export type TaskState = 
  | 'submitted' 
  | 'working' 
  | 'input-required' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts: TaskPart[];
  timestamp: string;
}

export interface TaskPart {
  type: 'text' | 'code' | 'binary' | 'image' | 'audio';
  data: string;
  mimeType?: string;
  metadata?: Record<string, any>;
}

export interface TaskArtifact {
  name: string;
  type: string;
  data: string;
  mimeType?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  state: TaskState;
  agentId: string;
  sessionId?: string;
  priority: TaskPriority;
  input: TaskMessage[];
  output?: TaskMessage[];
  artifacts: TaskArtifact[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timeout?: number;
  retryCount: number;
  maxRetries: number;
}

export interface TaskSubscription {
  taskId: string;
  callback: (task: Task) => void;
  subscribedAt: string;
}

export interface TaskCreateRequest {
  agentId: string;
  input: TaskMessage[];
  priority?: TaskPriority;
  metadata?: Record<string, any>;
  timeout?: number;
  maxRetries?: number;
}

export interface TaskUpdateRequest {
  state?: TaskState;
  output?: TaskMessage[];
  artifacts?: TaskArtifact[];
  error?: Task['error'];
}

/**
 * Task Manager - Handles task lifecycle and state management
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private subscriptions: Map<string, TaskSubscription[]> = new Map();
  private taskCounter = 0;

  /**
   * Create a new task
   */
  createTask(request: TaskCreateRequest): Task {
    this.taskCounter++;
    
    const task: Task = {
      id: `task-${Date.now()}-${this.taskCounter}`,
      state: 'submitted',
      agentId: request.agentId,
      priority: request.priority || 'medium',
      input: request.input,
      artifacts: [],
      metadata: request.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: request.maxRetries || 3,
      timeout: request.timeout || 300000 // 5 minutes default
    };

    this.tasks.set(task.id, task);
    this.notifySubscribers(task.id, task);

    return task;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Update task state
   */
  updateTask(taskId: string, update: TaskUpdateRequest): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Update fields
    if (update.state) {
      task.state = update.state;
      
      // Set completion/failure timestamps
      if (update.state === 'completed') {
        task.completedAt = new Date().toISOString();
      } else if (update.state === 'failed') {
        task.failedAt = new Date().toISOString();
      }
    }

    if (update.output) {
      task.output = update.output;
    }

    if (update.artifacts) {
      task.artifacts = [...task.artifacts, ...update.artifacts];
    }

    if (update.error) {
      task.error = update.error;
    }

    task.updatedAt = new Date().toISOString();

    // Notify subscribers
    this.notifySubscribers(taskId, task);

    return task;
  }

  /**
   * Transition task state
   */
  transitionTask(taskId: string, newState: TaskState): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Validate transition
    if (!this.isValidTransition(task.state, newState)) {
      console.error(`[A2A] Invalid transition: ${task.state} → ${newState}`);
      return null;
    }

    return this.updateTask(taskId, { state: newState });
  }

  /**
   * Check if state transition is valid
   */
  private isValidTransition(from: TaskState, to: TaskState): boolean {
    const validTransitions: Record<TaskState, TaskState[]> = {
      'submitted': ['working', 'cancelled'],
      'working': ['input-required', 'completed', 'failed', 'cancelled'],
      'input-required': ['working', 'cancelled'],
      'completed': [],
      'failed': ['submitted'], // Can retry
      'cancelled': []
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Add message to task
   */
  addMessage(taskId: string, message: TaskMessage): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.input.push(message);
    task.updatedAt = new Date().toISOString();

    this.notifySubscribers(taskId, task);

    return task;
  }

  /**
   * Add artifact to task
   */
  addArtifact(taskId: string, artifact: TaskArtifact): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.artifacts.push(artifact);
    task.updatedAt = new Date().toISOString();

    this.notifySubscribers(taskId, task);

    return task;
  }

  /**
   * Request input from user
   */
  requestInput(taskId: string, prompt: string): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const inputMessage: TaskMessage = {
      role: 'system',
      content: prompt,
      parts: [{ type: 'text', data: prompt }],
      timestamp: new Date().toISOString()
    };

    task.output = [inputMessage];
    task.updatedAt = new Date().toISOString();

    // Transition to input-required
    return this.transitionTask(taskId, 'input-required');
  }

  /**
   * Complete task with result
   */
  completeTask(taskId: string, result: TaskMessage): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.output = [result];
    task.updatedAt = new Date().toISOString();

    return this.transitionTask(taskId, 'completed');
  }

  /**
   * Fail task with error
   */
  failTask(taskId: string, error: Task['error']): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.error = error;
    task.updatedAt = new Date().toISOString();

    // Check if we should retry
    if (task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.state = 'failed';
      task.updatedAt = new Date().toISOString();
      this.notifySubscribers(taskId, task);
      
      // Auto-retry after delay
      setTimeout(() => {
        this.transitionTask(taskId, 'submitted');
      }, 1000 * task.retryCount);
      
      return task;
    }

    return this.transitionTask(taskId, 'failed');
  }

  /**
   * Cancel task
   */
  cancelTask(taskId: string): Task | null {
    return this.transitionTask(taskId, 'cancelled');
  }

  /**
   * Subscribe to task updates
   */
  subscribe(taskId: string, callback: (task: Task) => void): TaskSubscription {
    const subscription: TaskSubscription = {
      taskId,
      callback,
      subscribedAt: new Date().toISOString()
    };

    const existing = this.subscriptions.get(taskId) || [];
    existing.push(subscription);
    this.subscriptions.set(taskId, existing);

    return subscription;
  }

  /**
   * Unsubscribe from task updates
   */
  unsubscribe(subscription: TaskSubscription): boolean {
    const subscriptions = this.subscriptions.get(subscription.taskId);
    if (!subscriptions) return false;

    const index = subscriptions.findIndex(s => s === subscription);
    if (index > -1) {
      subscriptions.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Notify subscribers of task update
   */
  private notifySubscribers(taskId: string, task: Task): void {
    const subscriptions = this.subscriptions.get(taskId) || [];
    subscriptions.forEach(sub => {
      try {
        sub.callback(task);
      } catch (error) {
        console.error('[A2A] Error notifying subscriber:', error);
      }
    });
  }

  /**
   * Get all tasks for an agent
   */
  getAgentTasks(agentId: string): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.agentId === agentId);
  }

  /**
   * Get tasks by state
   */
  getTasksByState(state: TaskState): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.state === state);
  }

  /**
   * Get tasks by priority
   */
  getTasksByPriority(priority: TaskPriority): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.priority === priority);
  }

  /**
   * Get active tasks (submitted or working)
   */
  getActiveTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      t => t.state === 'submitted' || t.state === 'working'
    );
  }

  /**
   * Get task statistics
   */
  getStats(): {
    total: number;
    byState: Record<TaskState, number>;
    byPriority: Record<TaskPriority, number>;
    activeSubscriptions: number;
  } {
    const tasks = Array.from(this.tasks.values());
    
    const byState = {
      submitted: 0,
      working: 0,
      'input-required': 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    const byPriority = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    tasks.forEach(t => {
      byState[t.state]++;
      byPriority[t.priority]++;
    });

    const activeSubscriptions = Array.from(this.subscriptions.values())
      .reduce((sum, subs) => sum + subs.length, 0);

    return {
      total: tasks.length,
      byState,
      byPriority,
      activeSubscriptions
    };
  }

  /**
   * Clean up completed/cancelled tasks older than specified time
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    this.tasks.forEach((task, id) => {
      if (
        (task.state === 'completed' || task.state === 'cancelled') &&
        new Date(task.updatedAt).getTime() < cutoff
      ) {
        this.tasks.delete(id);
        this.subscriptions.delete(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.subscriptions.clear();
    this.taskCounter = 0;
  }
}

// Singleton instance
export const taskManager = new TaskManager();
