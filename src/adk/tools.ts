/**
 * ADK Tool Adapter
 *
 * Pre-built FunctionTool instances are created in src/agents/agents.ts.
 * This module re-exports them for convenient access.
 */

import { FunctionTool } from "@google/adk";

// ── Pre-built FunctionTool instances (from agents.ts) ────────────────
export {
  readFileTool as adkReadFileTool,
  writeFileTool as adkWriteFileTool,
  runTestsTool as adkRunTestsTool,
  scanSecurityTool as adkScanSecurityTool,
  deployTool as adkDeployTool,
  checkMetricsTool as adkCheckMetricsTool,
  ALL_TOOLS as ADK_BUILTIN_TOOLS,
} from "../agents/agents";
