import React, { useEffect, useState } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

const BOOT_DURATION_MS = 2000;
const TICK_MS = 50;

export const BootSequence: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / BOOT_DURATION_MS) * 100, 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

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
         <div className="h-full bg-nexus-accent transition-none" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};
