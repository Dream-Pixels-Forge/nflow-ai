import React, { useState } from 'react';
import { DependencyError } from '../models';

interface DependencyErrorDisplayProps {
  error: DependencyError;
  onRetry?: () => void;
}

const DependencyErrorDisplay: React.FC<DependencyErrorDisplayProps> = ({ error, onRetry }) => {
  const [showDetails, setShowDetails] = useState(false);

  const severityStyles: Record<string, { text: string; border: string }> = {
    critical: { text: 'text-red-500', border: 'border-red-500' },
    warning: { text: 'text-yellow-500', border: 'border-yellow-500' },
    info: { text: 'text-blue-500', border: 'border-blue-500' },
  };

  const styles = severityStyles[error.severity] || { text: 'text-gray-500', border: 'border-gray-500' };

  return (
    <div className={`p-4 rounded border-l-4 ${styles.text} ${styles.border} bg-red-900/20`}>
      <h3 className={`font-bold ${styles.text}`}>Dependency Error: {error.dependencyName}</h3>
      <p className="mt-2 text-gray-300">{error.userMessage}</p>
      <p className="mt-2 text-gray-400 text-sm">{error.suggestedSolution}</p>
      <div className="mt-4 flex gap-2">
        {onRetry && (
          <button 
            onClick={onRetry}
            className="px-3 py-1 bg-nexus-accent text-black rounded hover:bg-opacity-80 transition-colors"
          >
            Retry
          </button>
        )}
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="px-3 py-1 bg-nexus-800 rounded border border-nexus-border hover:bg-nexus-700 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>
      </div>
      {showDetails && (
        <div className="mt-3 p-3 bg-black/60 border border-nexus-border rounded overflow-x-auto">
          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-words">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DependencyErrorDisplay;