import { createContext, useContext, useReducer, useEffect } from 'react';
import { LocalStorageService } from './localStorage';
import {
  ConfigurationContextType,
  ConfigurationState,
  ConfigurationUpdate,
  NewProfileRequest,
} from '../../types/config';

// Define action types
type ConfigurationAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: { currentProfile: any; profiles: any[] } }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: any }
  | { type: 'SAVE_ERROR'; payload: string }
  | { type: 'CREATE_PROFILE_SUCCESS'; payload: any }
  | { type: 'SWITCH_PROFILE_SUCCESS'; payload: any }
  | { type: 'DELETE_PROFILE_SUCCESS'; payload: string }
  | { type: 'UPDATE_SETTING'; payload: { key: string; value: any } };

// Initial state
const initialState: ConfigurationState = {
  currentProfile: null,
  profiles: [],
  loading: false,
  error: null,
};

// Reducer function
const configurationReducer = (state: ConfigurationState, action: ConfigurationAction): ConfigurationState => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        currentProfile: action.payload.currentProfile,
        profiles: action.payload.profiles
      };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SAVE_START':
      return { ...state, loading: true };
    case 'SAVE_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        currentProfile: action.payload,
        profiles: state.profiles.map(p => 
          p.id === action.payload.id ? action.payload : p
        )
      };
    case 'SAVE_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'CREATE_PROFILE_SUCCESS':
      return { 
        ...state, 
        profiles: [...state.profiles, action.payload],
        currentProfile: state.profiles.length === 0 ? action.payload : state.currentProfile
      };
    case 'SWITCH_PROFILE_SUCCESS':
      return { 
        ...state, 
        currentProfile: action.payload
      };
    case 'DELETE_PROFILE_SUCCESS':
      return { 
        ...state,
        profiles: state.profiles.filter(p => p.id !== action.payload),
        currentProfile: state.currentProfile?.id === action.payload ? null : state.currentProfile
      };
    case 'UPDATE_SETTING':
      if (!state.currentProfile) return state;
      const updatedSettings = {
        ...state.currentProfile.settings,
        [action.payload.key]: action.payload.value
      };
      return {
        ...state,
        currentProfile: {
          ...state.currentProfile,
          settings: updatedSettings,
          updatedAt: new Date().toISOString()
        }
      };
    default:
      return state;
  }
};

// Create context
const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

// Provider component
export const ConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(configurationReducer, initialState);

  // Load configuration on initial render
  useEffect(() => {
    loadConfig();
  }, []);

  // Load configuration from storage
  const loadConfig = async () => {
    try {
      dispatch({ type: 'LOAD_START' });
      
      const currentProfile = LocalStorageService.loadCurrentProfile();
      const profiles = LocalStorageService.loadProfiles();
      
      dispatch({ 
        type: 'LOAD_SUCCESS', 
        payload: { 
          currentProfile,
          profiles
        } 
      });
    } catch (error) {
      dispatch({ 
        type: 'LOAD_ERROR', 
        payload: `Failed to load configuration: ${(error as Error).message}` 
      });
    }
  };

  // Save configuration to storage
  const saveConfig = async (updates: ConfigurationUpdate) => {
    try {
      dispatch({ type: 'SAVE_START' });
      
      if (!state.currentProfile) {
        throw new Error('No current profile to save');
      }
      
      const updatedProfile = LocalStorageService.updateProfile(state.currentProfile.id, updates);
      
      if (!updatedProfile) {
        throw new Error('Failed to update profile');
      }
      
      dispatch({ 
        type: 'SAVE_SUCCESS', 
        payload: updatedProfile 
      });
    } catch (error) {
      dispatch({ 
        type: 'SAVE_ERROR', 
        payload: `Failed to save configuration: ${(error as Error).message}` 
      });
      throw error;
    }
  };

  // Create a new profile
  const createProfile = async (profileData: NewProfileRequest) => {
    try {
      const newProfile = LocalStorageService.createProfile(profileData);

      dispatch({
        type: 'CREATE_PROFILE_SUCCESS',
        payload: newProfile
      });
    } catch (error) {
      dispatch({
        type: 'LOAD_ERROR',
        payload: `Failed to create profile: ${(error as Error).message}`
      });
      throw error;
    }
  };

  // Switch to a different profile
  const switchProfile = async (profileId: string) => {
    try {
      const profiles = LocalStorageService.loadProfiles();
      const profileToSwitch = profiles.find(p => p.id === profileId);

      if (!profileToSwitch) {
        throw new Error(`Profile with id ${profileId} not found`);
      }

      // Save the current profile before switching
      if (state.currentProfile) {
        LocalStorageService.saveCurrentProfile(state.currentProfile);
      }

      // Update the current profile in storage
      LocalStorageService.saveCurrentProfile(profileToSwitch);

      dispatch({
        type: 'SWITCH_PROFILE_SUCCESS',
        payload: profileToSwitch
      });
    } catch (error) {
      dispatch({
        type: 'LOAD_ERROR',
        payload: `Failed to switch profile: ${(error as Error).message}`
      });
      throw error;
    }
  };

  // Delete a profile
  const deleteProfile = async (profileId: string) => {
    try {
      const success = LocalStorageService.deleteProfile(profileId);

      if (!success) {
        throw new Error(`Failed to delete profile with id ${profileId}`);
      }

      dispatch({
        type: 'DELETE_PROFILE_SUCCESS',
        payload: profileId
      });
    } catch (error) {
      dispatch({
        type: 'LOAD_ERROR',
        payload: `Failed to delete profile: ${(error as Error).message}`
      });
      throw error;
    }
  };

  // Update a single setting
  const updateSetting = (key: string, value: any) => {
    dispatch({
      type: 'UPDATE_SETTING',
      payload: { key, value }
    });

    // Auto-save the updated profile
    if (state.currentProfile) {
      LocalStorageService.autoSaveCurrentProfile({
        ...state.currentProfile,
        settings: {
          ...state.currentProfile.settings,
          [key]: value
        }
      });
    }
  };

  // Get a setting value
  const getSetting = <T = any>(key: string): T | undefined => {
    if (!state.currentProfile) {
      return undefined;
    }
    return state.currentProfile.settings[key] as T;
  };

  const value = {
    state,
    loadConfig,
    saveConfig,
    createProfile,
    switchProfile,
    deleteProfile,
    updateSetting,
    getSetting
  };

  return (
    <ConfigurationContext.Provider value={value}>
      {children}
    </ConfigurationContext.Provider>
  );
};

// Custom hook to use the configuration context
export const useConfig = () => {
  const context = useContext(ConfigurationContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigurationProvider');
  }
  return context;
};