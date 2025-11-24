// Configuration Profile Entity
export interface ConfigurationProfile {
  id: string;                    // Unique identifier for the profile
  name: string;                  // User-friendly name for the profile
  settings: Record<string, any>; // Key-value pairs of all application settings
  createdAt: string;             // Timestamp when profile was created (ISO string)
  updatedAt: string;             // Timestamp when profile was last modified (ISO string)
  version: number;               // Schema version to handle future changes
}

// Configuration Profile Summary (for listing profiles)
export interface ConfigurationProfileSummary {
  id: string;                    // Unique identifier for the profile
  name: string;                  // User-friendly name for the profile
  updatedAt: string;             // Timestamp when profile was last modified (ISO string)
}

// Configuration Update (for updating settings)
export interface ConfigurationUpdate {
  settings?: Record<string, any>; // Key-value pairs of settings to update
  name?: string;                  // Optional new name for the profile
}

// New Profile Request
export interface NewProfileRequest {
  name: string;             // User-friendly name for the new profile
  copyFromCurrent?: boolean; // Whether to copy settings from current profile (default: true)
}

// Configuration Parameter Entity
export interface ConfigurationParameter {
  key: string;       // Identifier for the setting
  value: any;        // The setting value - can be string, number, boolean, or object
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'; // Type of the setting
  defaultValue: any; // The default value for this setting
  required: boolean; // Whether this setting must have a value
}

// Configuration State for React Context
export interface ConfigurationState {
  currentProfile: ConfigurationProfile | null;
  profiles: ConfigurationProfile[];
  loading: boolean;
  error: string | null;
}

// Configuration Context Type
export interface ConfigurationContextType {
  state: ConfigurationState;
  loadConfig: () => Promise<void>;
  saveConfig: (updates: ConfigurationUpdate) => Promise<void>;
  createProfile: (profileData: NewProfileRequest) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  updateSetting: (key: string, value: any) => void;
  getSetting: <T = any>(key: string) => T | undefined;
}