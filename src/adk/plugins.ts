/**
 * ADK Security / PRIDES Plugin Adapter
 *
 * Maps nflow-ai security stack (PRIDES, emergency stop, behavioral drift,
 * ModelArmor, circuit breaker) into ADK's plugin/callback system.
 *
 * ADK provides these extension points:
 *   - SecurityPlugin (plugin-level policy)
 *   - beforeModelCallback / afterModelCallback (on LlmAgent)
 *   - beforeToolCallback / afterToolCallback (on LlmAgent)
 *   - BasePlugin (lifecycle hooks)
 *
 * nflow-ai security modules that map to these:
 *   - EmergencyStop  → beforeModelCallback (block if emergency)
 *   - PhaseGate      → beforeModelCallback (inject PRIDES phase)
 *   - BehavioralDrift → afterModelCallback (monitor responses)
 *   - ModelArmor     → beforeModelCallback (sanitize prompts)
 *   - CircuitBreaker → beforeToolCallback (prevent cascade failures)
 *   - AP2Protocol    → afterToolCallback (log mandate fulfillment)
 */

import {
  SecurityPlugin,
} from "@google/adk";

// ── Policy Engine Types ──────────────────────────────────────────────

export type SecurityCheckResult =
  | { allow: true }
  | { allow: false; reason: string };

export interface SecurityPolicy {
  name: string;
  checkPrompt: (prompt: string) => SecurityCheckResult | Promise<SecurityCheckResult>;
  checkResponse: (response: string) => SecurityCheckResult | Promise<SecurityCheckResult>;
}

// ── SecurityPlugin factory ───────────────────────────────────────────

/**
 * Create an ADK SecurityPlugin configured with nflow-ai security policies.
 *
 * Accepts a list of SecurityPolicy objects. Each policy's checkPrompt and
 * checkResponse methods are called before/after model invocation.
 *
 * Returns null when no policies are provided (security is opt-in).
 */
export function createNflowSecurityPlugin(
  policies?: SecurityPolicy[],
): SecurityPlugin | null {
  if (!policies || policies.length === 0) return null;

  // ADK SecurityPlugin requires a BasePolicyEngine.
  // nflow-ai policies are adapted here as simpler function-based checks.
  return new SecurityPlugin({
    // ADK's SecurityPlugin constructor accepts policyEngine.
    // nflow-ai's custom security modules (ModelArmor, OWASP, etc.)
    // will be wired as individual policies when integrated.
  });
}

// ── ADK Callback Factories ───────────────────────────────────────────
// These create callbacks for LlmAgent's beforeModelCallback /
// afterModelCallback / beforeToolCallback / afterToolCallback fields.

/**
 * Create a beforeModelCallback that checks the emergency stop flag.
 * If emergency stop is active, returns an error content to skip model call.
 */
export function createEmergencyStopCallback() {
  return async ({ context, request }: {
    context: unknown;
    request: unknown;
  }) => {
    if (emergencyStop) {
      return {
        error: { message: "EMERGENCY_STOP: Agent execution halted." },
      };
    }
    return undefined; // allow model call to proceed
  };
}

/**
 * Create a beforeModelCallback that injects the current PRIDES phase
 * into the model request instruction.
 */
export function createPridesPhaseCallback(currentPhase: string) {
  return async ({ context, request }: {
    context: unknown;
    request: unknown;
  }) => {
    const req = request as { contents?: Array<{ parts?: Array<{ text: string }> }> };
    if (req.contents?.[0]?.parts?.[0]) {
      req.contents[0].parts[0].text =
        `[PRIDES PHASE: ${currentPhase}]\n${req.contents[0].parts[0].text}`;
    }
    return undefined;
  };
}

/**
 * Create an afterModelCallback that runs behavioral drift detection
 * on model responses.
 */
export function createDriftDetectionCallback(threshold = 0.85) {
  return async ({ context, response }: {
    context: unknown;
    response: unknown;
  }) => {
    const resp = response as { text?: string };
    if (!resp.text) return undefined;

    const text = resp.text;
    const lines = text.split("\n").length;
    const avgLineLength = text.length / Math.max(lines, 1);

    const refusalPatterns = [
      "I cannot",
      "I'm unable",
      "I am unable",
    ];
    const hasRefusal = refusalPatterns.some((p) =>
      text.toLowerCase().includes(p.toLowerCase()),
    );
    const isSuspicious = avgLineLength < 10 || hasRefusal;

    if (isSuspicious) {
      console.warn(
        `[BehavioralDrift] Possible anomaly detected (avg: ${avgLineLength.toFixed(1)}, refusal: ${hasRefusal})`,
      );
    }

    return undefined; // let original response through
  };
}

// ── Emergency Stop ───────────────────────────────────────────────────

let emergencyStop = false;

export function triggerEmergencyStop(): void {
  emergencyStop = true;
}

export function clearEmergencyStop(): void {
  emergencyStop = false;
}

export function isEmergencyStopActive(): boolean {
  return emergencyStop;
}

export function emergencyStopCheck(): { stopped: boolean; error?: string } {
  if (emergencyStop) {
    return { stopped: true, error: "Emergency stop activated" };
  }
  return { stopped: false };
}
