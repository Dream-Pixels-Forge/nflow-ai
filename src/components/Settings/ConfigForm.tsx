import React, { useState, useEffect } from 'react';
import { useConfig } from '../../services/config/configStore';
import { LocalStorageService } from '../../services/config/localStorage';

interface ConfigFormProps {}

const ConfigForm: React.FC<ConfigFormProps> = () => {
  const { state, saveConfig, updateSetting, getSetting } = useConfig();
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const [backendType, setBackendType] = useState<string>('');

  // Initialize local settings when the current profile changes
  useEffect(() => {
    if (state.currentProfile) {
      setLocalSettings({ ...state.currentProfile.settings });
      setBackendType(state.currentProfile.settings.backendType || '');
    }
  }, [state.currentProfile]);

  // Handle changes to individual settings with auto-save
  const handleSettingChange = (key: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));

    // Update the setting in the global state
    updateSetting(key, value);

    // Use auto-save to save changes within 5 seconds of modification
    if (state.currentProfile) {
      const updatedProfile = {
        ...state.currentProfile,
        settings: { ...state.currentProfile.settings, [key]: value }
      };
      LocalStorageService.autoSaveCurrentProfile(updatedProfile);
    }
  };

  // Handle backend type change specifically
  const handleBackendTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setBackendType(value);
    handleSettingChange('backendType', value);
  };

  // Handle saving all settings
  const handleSave = async () => {
    if (state.currentProfile) {
      try {
        await saveConfig({
          settings: localSettings
        });
        alert('Settings saved successfully!');
      } catch (error) {
        alert(`Failed to save settings: ${(error as Error).message}`);
      }
    }
  };

  // Handle changes to text inputs
  const handleTextChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingChange(key, e.target.value);
  };

  // Handle changes to number inputs
  const handleNumberChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingChange(key, Number(e.target.value));
  };

  // Handle changes to checkbox inputs
  const handleCheckboxChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingChange(key, e.target.checked);
  };

  if (!state.currentProfile) {
    return <div>No profile loaded</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend Type Selection */}
        <div className="mb-4">
          <label className="block text-green-300 mb-2">Backend Type</label>
          <select
            value={backendType}
            onChange={handleBackendTypeChange}
            className="w-full p-2 bg-gray-800 text-green-400 border border-green-700 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="ollama">Ollama (Local)</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        {/* Ollama Server URL */}
        {backendType === 'ollama' && (
          <div className="mb-4">
            <label className="block text-green-300 mb-2">Ollama Server URL</label>
            <input
              type="text"
              value={localSettings.ollamaServerUrl || 'http://localhost:11434'}
              onChange={handleTextChange('ollamaServerUrl')}
              className="w-full p-2 bg-gray-800 text-green-400 border border-green-700 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., http://localhost:11434"
            />
          </div>
        )}

        {/* Gemini API Key */}
        {backendType === 'gemini' && (
          <div className="mb-4">
            <label className="block text-green-300 mb-2">Gemini API Key</label>
            <input
              type="password"
              value={localSettings.geminiApiKey || ''}
              onChange={handleTextChange('geminiApiKey')}
              className="w-full p-2 bg-gray-800 text-green-400 border border-green-700 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter your Gemini API key"
            />
          </div>
        )}

        {/* Theme Selection */}
        <div className="mb-4">
          <label className="block text-green-300 mb-2">UI Theme</label>
          <select
            value={localSettings.theme || 'cyberpunk'}
            onChange={(e) => handleSettingChange('theme', e.target.value)}
            className="w-full p-2 bg-gray-800 text-green-400 border border-green-700 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="cyberpunk">Cyberpunk</option>
            <option value="terminal">Terminal</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        {/* Refresh Interval */}
        <div className="mb-4">
          <label className="block text-green-300 mb-2">Refresh Interval (ms)</label>
          <input
            type="number"
            value={localSettings.refreshInterval || 5000}
            onChange={handleNumberChange('refreshInterval')}
            className="w-full p-2 bg-gray-800 text-green-400 border border-green-700 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            min="1000"
            max="60000"
          />
        </div>

        {/* Enable Telemetry */}
        <div className="mb-4 flex items-center">
          <input
            type="checkbox"
            id="enableTelemetry"
            checked={localSettings.enableTelemetry || false}
            onChange={handleCheckboxChange('enableTelemetry')}
            className="h-5 w-5 text-green-500 rounded focus:ring-green-400"
          />
          <label htmlFor="enableTelemetry" className="ml-2 text-green-300">
            Enable Telemetry
          </label>
        </div>

        {/* Auto-save Changes */}
        <div className="mb-4 flex items-center">
          <input
            type="checkbox"
            id="autoSave"
            checked={localSettings.autoSave || true}
            onChange={handleCheckboxChange('autoSave')}
            className="h-5 w-5 text-green-500 rounded focus:ring-green-400"
          />
          <label htmlFor="autoSave" className="ml-2 text-green-300">
            Auto-save Changes
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={state.loading}
          className={`px-6 py-2 rounded font-mono ${
            state.loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-green-700 hover:bg-green-600 text-white'
          }`}
        >
          {state.loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Debug Info */}
      <div className="mt-6 p-4 bg-gray-800 rounded border border-green-800 text-xs text-green-300">
        <h3 className="font-bold mb-2">Current Settings (Debug)</h3>
        <pre className="whitespace-pre-wrap break-words">
          {JSON.stringify(localSettings, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default ConfigForm;