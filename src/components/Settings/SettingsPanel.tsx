import React, { useEffect } from 'react';
import { useConfig } from '../../services/config/configStore';
import ConfigForm from './ConfigForm';
import ProfileSelector from './ProfileSelector';

interface SettingsPanelProps {
  className?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ className = '' }) => {
  const { state, loadConfig } = useConfig();

  useEffect(() => {
    // Load configuration when the component mounts
    loadConfig();
  }, [loadConfig]);

  if (state.loading) {
    return (
      <div className={`flex justify-center items-center h-64 ${className}`}>
        <div className="text-lg text-gray-600">Loading settings...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`p-4 bg-red-100 text-red-700 rounded-lg ${className}`}>
        <h3 className="font-bold">Error Loading Settings</h3>
        <p>{state.error}</p>
        <button
          onClick={() => loadConfig()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 text-green-400 p-6 rounded-lg border border-green-500 font-mono ${className}`}>
      <h2 className="text-xl font-bold mb-4 text-green-300 border-b border-green-700 pb-2">
        Configuration Settings
        {state.currentProfile && (
          <span className="text-sm ml-2 text-green-500">
            ({state.currentProfile.name})
          </span>
        )}
      </h2>

      <ProfileSelector />

      {state.currentProfile ? (
        <ConfigForm />
      ) : (
        <div className="text-center py-8">
          <p className="mb-4">No configuration profile loaded.</p>
          <button
            onClick={() => loadConfig()}
            className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600"
          >
            Load Settings
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;