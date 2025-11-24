import { useState, useEffect } from 'react';
import { LocalStorageService } from '../services/config/localStorage';
import { 
  ConfigurationProfile, 
  ConfigurationUpdate, 
  NewProfileRequest 
} from '../types/config';

// Simple hook for accessing configuration without the full context system
// This is an alternative to the context-based approach and can be used in simpler scenarios
export const useConfigHook = () => {
  const [currentProfile, setCurrentProfile] = useState<ConfigurationProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load configuration when the hook is initialized
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const profile = LocalStorageService.loadCurrentProfile();
      setCurrentProfile(profile);
    } catch (err) {
      setError(`Failed to load configuration: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (updates: ConfigurationUpdate) => {
    if (!currentProfile) {
      throw new Error('No current profile to save');
    }

    try {
      setLoading(true);
      setError(null);
      
      const updatedProfile = LocalStorageService.updateProfile(currentProfile.id, updates);
      
      if (updatedProfile) {
        setCurrentProfile(updatedProfile);
      }
    } catch (err) {
      setError(`Failed to save configuration: ${(err as Error).message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    if (!currentProfile) {
      throw new Error('No current profile to update');
    }

    const updates: ConfigurationUpdate = {
      settings: {
        ...currentProfile.settings,
        [key]: value
      }
    };

    await saveConfig(updates);
  };

  const getSetting = <T = any>(key: string): T | undefined => {
    if (!currentProfile) {
      return undefined;
    }
    return currentProfile.settings[key] as T;
  };

  return {
    currentProfile,
    loading,
    error,
    loadConfig,
    saveConfig,
    updateSetting,
    getSetting,
  };
};