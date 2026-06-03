/**
 * Human-in-the-Loop (HITL) Manager
 *
 * Provides pause/resume mechanism for workflows that need human approval
 * or input. Inspired by ADK 2.0's `request_input` / `ctx.resume()` pattern.
 *
 * Usage:
 *   1. Agent calls `hitl.requestInput(...)` → workflow pauses
 *   2. UI shows approval dialog to user
 *   3. User approves/denies → `hitl.respond(requestId, response)`
 *   4. Workflow resumes with the human's answer
 */

// ── Request types ───────────────────────────────────────────────────

export interface HITLRequest {
  id: string;
  type: "approval" | "input" | "selection";
  title: string;
  description: string;
  /** For 'selection' type: available options */
  options?: string[];
  /** Context about what the agent was doing */
  agentName: string;
  workflowId: string;
  createdAt: string;
  /** Requested data the agent needs */
  payload?: Record<string, unknown>;
}

export interface HITLResponse {
  requestId: string;
  approved: boolean;
  /** For 'input' type: the text the user typed */
  input?: string;
  /** For 'selection' type: the selected option */
  selectedOption?: string;
  respondedAt: string;
}

// ── Pending request state ───────────────────────────────────────────

interface PendingRequest {
  request: HITLRequest;
  promise: PromiseWithResolvers<HITLResponse>;
}

// ── HITL Manager ────────────────────────────────────────────────────

export class HITLManager {
  #pending: Map<string, PendingRequest> = new Map();
  #history: Array<{ request: HITLRequest; response: HITLResponse }> = [];
  #requestIdCounter = 0;

  /** Callback fired when a new request needs human attention */
  onRequest?: (request: HITLRequest) => void;

  /**
   * Pause workflow and wait for human input.
   * Returns the human's response when they provide it.
   */
  requestInput(params: {
    type: HITLRequest["type"];
    title: string;
    description: string;
    agentName: string;
    workflowId: string;
    options?: string[];
    payload?: Record<string, unknown>;
  }): Promise<HITLResponse> {
    const id = `hitl-${Date.now()}-${++this.#requestIdCounter}`;
    const request: HITLRequest = {
      id,
      type: params.type,
      title: params.title,
      description: params.description,
      options: params.options,
      agentName: params.agentName,
      workflowId: params.workflowId,
      createdAt: new Date().toISOString(),
      payload: params.payload,
    };

    const { promise, resolve, reject } = Promise.withResolvers<HITLResponse>();

    this.#pending.set(id, {
      request,
      promise: { promise, resolve, reject },
    });

    // Notify UI
    this.onRequest?.(request);

    return promise;
  }

  /**
   * Convenience: request approval for a dangerous action.
   */
  requestApproval(
    agentName: string,
    workflowId: string,
    title: string,
    description: string,
  ): Promise<HITLResponse> {
    return this.requestInput({
      type: "approval",
      title,
      description,
      agentName,
      workflowId,
    });
  }

  /**
   * Convenience: pause and ask the user a question.
   */
  askUser(
    agentName: string,
    workflowId: string,
    question: string,
    context?: string,
  ): Promise<HITLResponse> {
    return this.requestInput({
      type: "input",
      title: "Input Required",
      description: question,
      agentName,
      workflowId,
      payload: context ? { context } : undefined,
    });
  }

  /**
   * Convenience: present options for the user to choose from.
   */
  presentOptions(
    agentName: string,
    workflowId: string,
    title: string,
    description: string,
    options: string[],
  ): Promise<HITLResponse> {
    return this.requestInput({
      type: "selection",
      title,
      description,
      agentName,
      workflowId,
      options,
    });
  }

  /**
   * Respond to a pending request (called by UI when user acts).
   */
  respond(
    requestId: string,
    approved: boolean,
    input?: string,
    selectedOption?: string,
  ): boolean {
    const pending = this.#pending.get(requestId);
    if (!pending) return false;

    const response: HITLResponse = {
      requestId,
      approved,
      input,
      selectedOption,
      respondedAt: new Date().toISOString(),
    };

    this.#history.push({ request: pending.request, response });
    pending.promise.resolve(response);
    this.#pending.delete(requestId);
    return true;
  }

  /**
   * Deny all pending requests (e.g., on workflow cancellation).
   */
  denyAll(): void {
    for (const [id, pending] of this.#pending) {
      const response: HITLResponse = {
        requestId: id,
        approved: false,
        respondedAt: new Date().toISOString(),
      };
      this.#history.push({ request: pending.request, response });
      pending.promise.resolve(response);
    }
    this.#pending.clear();
  }

  // ── Accessors ─────────────────────────────────────────────────

  getPendingRequests(): HITLRequest[] {
    return [...this.#pending.values()].map((p) => p.request);
  }

  getPendingForWorkflow(workflowId: string): HITLRequest[] {
    return this.getPendingRequests().filter(
      (r) => r.workflowId === workflowId,
    );
  }

  getHistory(): Array<{ request: HITLRequest; response: HITLResponse }> {
    return [...this.#history];
  }

  hasPending(): boolean {
    return this.#pending.size > 0;
  }
}

// ── Singleton ───────────────────────────────────────────────────────

export const hitlManager = new HITLManager();
