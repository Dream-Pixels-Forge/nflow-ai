/**
 * HITL Approval Dialog
 *
 * Modal dialog that shows when the agent needs human approval for a
 * dangerous operation (file write, shell command, etc.).
 */

import React from "react";
import { Shield, Check, X, Terminal, FileText, AlertTriangle } from "lucide-react";
import type { HITLRequest } from "../src/pipelines/HITLManager";
import { hitlManager } from "../src/pipelines/HITLManager";

interface HITLDialogProps {
  request: HITLRequest;
  onResponded: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  approval: <Shield className="w-5 h-5 text-amber-400" />,
  input: <Terminal className="w-5 h-5 text-cyan-400" />,
  selection: <FileText className="w-5 h-5 text-purple-400" />,
};

export const HITLDialog: React.FC<HITLDialogProps> = ({ request, onResponded }) => {
  const handleApprove = () => {
    hitlManager.respond(request.id, true);
    onResponded();
  };

  const handleDeny = () => {
    hitlManager.respond(request.id, false);
    onResponded();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0a0e17] border border-amber-500/30 rounded-lg shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-500/20 bg-amber-500/5">
          {TYPE_ICONS[request.type] ?? <AlertTriangle className="w-5 h-5 text-amber-400" />}
          <div>
            <h3 className="text-amber-300 font-mono text-sm font-bold">{request.title}</h3>
            <p className="text-gray-500 text-xs font-mono">
              Agent: {request.agentName} &middot; {request.type}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-gray-300 text-sm font-mono whitespace-pre-wrap">
            {request.description}
          </p>

          {/* Selection options */}
          {request.type === "selection" && request.options && (
            <div className="mt-4 space-y-2">
              {request.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    hitlManager.respond(request.id, true, undefined, opt);
                    onResponded();
                  }}
                  className="w-full text-left px-3 py-2 bg-gray-800/50 border border-gray-700 rounded font-mono text-sm text-gray-300 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Payload display */}
          {request.payload && (
            <pre className="mt-3 p-3 bg-gray-900/50 border border-gray-800 rounded text-xs text-gray-400 font-mono overflow-x-auto">
              {JSON.stringify(request.payload, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer (approval type only) */}
        {request.type === "approval" && (
          <div className="flex gap-3 px-5 py-4 border-t border-gray-800">
            <button
              onClick={handleDeny}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 font-mono text-sm hover:bg-red-500/20 transition-colors"
            >
              <X className="w-4 h-4" />
              Deny
            </button>
            <button
              onClick={handleApprove}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 font-mono text-sm hover:bg-emerald-500/20 transition-colors"
            >
              <Check className="w-4 h-4" />
              Approve
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div className="px-5 py-2 border-t border-gray-800/50">
          <p className="text-gray-600 text-xs font-mono">
            Requested at {new Date(request.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};
