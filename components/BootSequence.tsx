import React from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

export const BootSequence: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center font-mono text-nexus-accent overflow-hidden">
      <div className="animate-pulse-fast mb-4">
        <TerminalIcon size={64} />
      </div>
      <h1 className="text-3xl font-bold tracking-[0.5em] mb-2">NEXUSFLOW</h1>
      <div className="flex flex-col items-center gap-1 text-xs text-nexus-dim">
        <p>INITIALIZING PROJECT DIRECTORY...</p>
        <p>LOADING AGENT SUBSYSTEMS...</p>
        <p>ESTABLISHING ORCHESTRATOR LINK...</p>
      </div>
      <div className="w-64 h-1 bg-nexus-900 mt-8 rounded overflow-hidden">
         <div className="h-full bg-nexus-accent animate-[width_2s_ease-in-out_forwards]" style={{ width: '0%' }} />
      </div>
    </div>
  );
};
