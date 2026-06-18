import { AgentPhase } from './agentic';

/**
 * Returns Tailwind CSS classes for the PRIDES phase badge color.
 */
export const getPhaseColor = (phase: AgentPhase): string => {
  const colors: Record<AgentPhase, string> = {
    P: 'bg-purple-900/50 border-purple-500/50 text-purple-400',
    R: 'bg-blue-900/50 border-blue-500/50 text-blue-400',
    I: 'bg-green-900/50 border-green-500/50 text-green-400',
    D: 'bg-orange-900/50 border-orange-500/50 text-orange-400',
    E: 'bg-cyan-900/50 border-cyan-500/50 text-cyan-400',
    S: 'bg-red-900/50 border-red-500/50 text-red-400',
  };
  return colors[phase] || 'bg-gray-900/50 border-gray-500/50 text-gray-400';
};
