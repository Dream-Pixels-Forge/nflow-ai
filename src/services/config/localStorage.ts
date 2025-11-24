import { ConfigurationProfile, ConfigurationProfileSummary, ConfigurationUpdate, NewProfileRequest } from '../../types/config';

const CONFIG_STORAGE_KEY = 'nexusflow-config';
const PROFILES_STORAGE_KEY = 'nexusflow-profiles';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export class LocalStorageService {
  // Debounced save function to implement auto-save within 5 seconds
  static debouncedSaveCurrentProfile = debounce((profile: ConfigurationProfile) => {
    try {
      // Update the timestamp
      const updatedProfile = {
        ...profile,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updatedProfile));
    } catch (error) {
      console.error('Failed to save configuration to localStorage:', error);
      throw new Error(`Failed to save configuration: ${(error as Error).message}`);
    }
  }, 5000); // 5 seconds debounce

  /**
   * Save the current configuration profile to localStorage immediately
   */
  static saveCurrentProfile(profile: ConfigurationProfile): void {
    try {
      // Update the timestamp
      const updatedProfile = {
        ...profile,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updatedProfile));
    } catch (error) {
      console.error('Failed to save configuration to localStorage:', error);
      throw new Error(`Failed to save configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Debounced save of the current configuration profile to localStorage
   * This will automatically save the profile within 5 seconds of the last change
   */
  static autoSaveCurrentProfile(profile: ConfigurationProfile): void {
    this.debouncedSaveCurrentProfile(profile);
  }

  /**
   * Load the current configuration profile from localStorage
   */
  static loadCurrentProfile(): ConfigurationProfile | null {
    try {
      const profileData = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!profileData) {
        return null;
      }

      const profile: ConfigurationProfile = JSON.parse(profileData);
      return profile;
    } catch (error) {
      console.error('Failed to load configuration from localStorage:', error);
      // Return null instead of throwing to allow fallback to defaults
      return null;
    }
  }

  /**
   * Save multiple configuration profiles to localStorage
   */
  static saveProfiles(profiles: ConfigurationProfile[]): void {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch (error) {
      console.error('Failed to save profiles to localStorage:', error);
      throw new Error(`Failed to save profiles: ${(error as Error).message}`);
    }
  }

  /**
   * Load multiple configuration profiles from localStorage
   */
  static loadProfiles(): ConfigurationProfile[] {
    try {
      const profilesData = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (!profilesData) {
        return [];
      }

      const profiles: ConfigurationProfile[] = JSON.parse(profilesData);
      return profiles;
    } catch (error) {
      console.error('Failed to load profiles from localStorage:', error);
      // Return empty array instead of throwing to allow fallback to defaults
      return [];
    }
  }

  /**
   * Create a new configuration profile
   */
  static createProfile(profileData: NewProfileRequest): ConfigurationProfile {
    const id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newProfile: ConfigurationProfile = {
      id,
      name: profileData.name,
      settings: profileData.copyFromCurrent !== false ?
        (this.loadCurrentProfile()?.settings || {}) : {},
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    // Add the new profile to the list of profiles
    const existingProfiles = this.loadProfiles();
    const updatedProfiles = [...existingProfiles, newProfile];
    this.saveProfiles(updatedProfiles);

    // If this is the first profile, make it the current one
    if (existingProfiles.length === 0) {
      this.saveCurrentProfile(newProfile);
    }

    return newProfile;
  }

  /**
   * Update an existing configuration profile
   */
  static updateProfile(profileId: string, updates: ConfigurationUpdate): ConfigurationProfile | null {
    const profiles = this.loadProfiles();
    const profileIndex = profiles.findIndex(profile => profile.id === profileId);

    if (profileIndex === -1) {
      return null;
    }

    const updatedProfile = {
      ...profiles[profileIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
      settings: updates.settings
        ? { ...profiles[profileIndex].settings, ...updates.settings }
        : profiles[profileIndex].settings
    };

    profiles[profileIndex] = updatedProfile;
    this.saveProfiles(profiles);

    // If this is the current profile, update the current profile as well
    const currentProfile = this.loadCurrentProfile();
    if (currentProfile && currentProfile.id === profileId) {
      this.saveCurrentProfile(updatedProfile);
    }

    return updatedProfile;
  }

  /**
   * Delete a configuration profile
   */
  static deleteProfile(profileId: string): boolean {
    let profiles = this.loadProfiles();
    const profileIndex = profiles.findIndex(profile => profile.id === profileId);

    if (profileIndex === -1) {
      return false;
    }

    profiles = profiles.filter(profile => profile.id !== profileId);
    this.saveProfiles(profiles);

    // If we deleted the current profile, switch to another one or reset
    const currentProfile = this.loadCurrentProfile();
    if (currentProfile && currentProfile.id === profileId) {
      if (profiles.length > 0) {
        // Set the first available profile as current
        this.saveCurrentProfile(profiles[0]);
      } else {
        // No profiles left, remove the current profile reference
        localStorage.removeItem(CONFIG_STORAGE_KEY);
      }
    }

    return true;
  }

  /**
   * Get all configuration profile summaries
   */
  static getProfileSummaries(): ConfigurationProfileSummary[] {
    const profiles = this.loadProfiles();

    return profiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      updatedAt: profile.updatedAt
    }));
  }
}