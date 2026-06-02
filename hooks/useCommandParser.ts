import { AGENTS, AgentMode } from '../types';

interface UseCommandParserProps {
  activeAgent: AgentMode;
  onSwitchAgent: (agent: AgentMode) => void;
  onShowTaskDashboard: () => void;
}

interface UseCommandParserReturn {
  parseCommand: (input: string) => boolean;
}

export const useCommandParser = ({
  activeAgent,
  onSwitchAgent,
  onShowTaskDashboard
}: UseCommandParserProps): UseCommandParserReturn => {
  
  const parseCommand = (input: string): boolean => {
    if (!input.startsWith('/')) return false;

    const command = input.slice(1).toUpperCase();
    
    if (command === 'TASKS') {
      onShowTaskDashboard();
      return true;
    }

    // Check if command matches an agent ID or Name
    const targetAgent = Object.values(AgentMode).find(
      a => a === command || AGENTS[a].name.toUpperCase().includes(command) || a.includes(command)
    );

    if (targetAgent) {
      onSwitchAgent(targetAgent);
      return true;
    }

    return false;
  };

  return { parseCommand };
};
