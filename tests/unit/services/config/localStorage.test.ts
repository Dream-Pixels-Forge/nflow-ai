import { LocalStorageService } from '../../../../src/services/config/localStorage';
import { ConfigurationProfile, NewProfileRequest } from '../../../../src/types/config';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    getAll: () => ({ ...store })
  };
})();

// Replace localStorage with mock for testing
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('LocalStorageService', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('saveCurrentProfile and loadCurrentProfile', () => {
    it('should save and load a configuration profile correctly', () => {
      const profile: ConfigurationProfile = {
        id: 'test-id',
        name: 'Test Profile',
        settings: { theme: 'dark', language: 'en' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        version: 1
      };

      LocalStorageService.saveCurrentProfile(profile);
      const loadedProfile = LocalStorageService.loadCurrentProfile();

      expect(loadedProfile).toEqual(profile);
    });

    it('should return null when no profile is saved', () => {
      const profile = LocalStorageService.loadCurrentProfile();
      expect(profile).toBeNull();
    });

    it('should update updatedAt when saving', () => {
      const profile: ConfigurationProfile = {
        id: 'test-id',
        name: 'Test Profile',
        settings: { theme: 'dark', language: 'en' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        version: 1
      };

      LocalStorageService.saveCurrentProfile(profile);
      const loadedProfile = LocalStorageService.loadCurrentProfile();

      // The updatedAt should be updated to current time
      expect(loadedProfile?.updatedAt).not.toEqual(profile.updatedAt);
    });
  });

  describe('saveProfiles and loadProfiles', () => {
    it('should save and load multiple profiles correctly', () => {
      const profiles: ConfigurationProfile[] = [
        {
          id: 'profile1',
          name: 'Profile 1',
          settings: { theme: 'dark' },
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          version: 1
        },
        {
          id: 'profile2',
          name: 'Profile 2',
          settings: { theme: 'light' },
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          version: 1
        }
      ];

      LocalStorageService.saveProfiles(profiles);
      const loadedProfiles = LocalStorageService.loadProfiles();

      expect(loadedProfiles).toEqual(profiles);
    });

    it('should return empty array when no profiles are saved', () => {
      const profiles = LocalStorageService.loadProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('createProfile', () => {
    it('should create a new profile and add it to the list', () => {
      const profileData: NewProfileRequest = {
        name: 'New Profile',
        copyFromCurrent: false
      };

      const newProfile = LocalStorageService.createProfile(profileData);
      const profiles = LocalStorageService.loadProfiles();

      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toEqual(newProfile);
      expect(newProfile.name).toBe('New Profile');
      expect(newProfile.settings).toEqual({});
    });

    it('should copy settings from current profile when copyFromCurrent is true', () => {
      // Save a current profile with settings
      const currentProfile: ConfigurationProfile = {
        id: 'current-id',
        name: 'Current Profile',
        settings: { theme: 'dark', language: 'en' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        version: 1
      };
      LocalStorageService.saveCurrentProfile(currentProfile);

      const profileData: NewProfileRequest = {
        name: 'New Profile',
        copyFromCurrent: true
      };

      const newProfile = LocalStorageService.createProfile(profileData);

      expect(newProfile.settings).toEqual(currentProfile.settings);
    });

    it('should set created profile as current if it is the first one', () => {
      const profileData: NewProfileRequest = {
        name: 'First Profile',
        copyFromCurrent: false
      };

      LocalStorageService.createProfile(profileData);
      const currentProfile = LocalStorageService.loadCurrentProfile();

      expect(currentProfile?.name).toBe('First Profile');
    });
  });

  describe('updateProfile', () => {
    it('should update an existing profile', () => {
      // Create an initial profile
      const profileData: NewProfileRequest = {
        name: 'Original Profile',
        copyFromCurrent: false
      };
      const originalProfile = LocalStorageService.createProfile(profileData);

      // Update the profile
      const updatedData = LocalStorageService.updateProfile(originalProfile.id, {
        name: 'Updated Profile',
        settings: { newSetting: 'value' }
      });

      expect(updatedData?.name).toBe('Updated Profile');
      expect(updatedData?.settings).toEqual({ newSetting: 'value' });
    });

    it('should return null if profile does not exist', () => {
      const result = LocalStorageService.updateProfile('non-existent-id', {
        name: 'Updated Name'
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteProfile', () => {
    it('should delete an existing profile', () => {
      const profileData: NewProfileRequest = {
        name: 'Profile to Delete',
        copyFromCurrent: false
      };
      const profileToDelete = LocalStorageService.createProfile(profileData);
      const profileToKeep = LocalStorageService.createProfile({
        name: 'Profile to Keep',
        copyFromCurrent: false
      });

      const success = LocalStorageService.deleteProfile(profileToDelete.id);
      
      expect(success).toBe(true);
      const remainingProfiles = LocalStorageService.loadProfiles();
      expect(remainingProfiles).toHaveLength(1);
      expect(remainingProfiles[0].id).toBe(profileToKeep.id);
    });

    it('should return false if profile does not exist', () => {
      const success = LocalStorageService.deleteProfile('non-existent-id');
      
      expect(success).toBe(false);
    });
  });

  describe('getProfileSummaries', () => {
    it('should return profile summaries', () => {
      const profileData1: NewProfileRequest = { name: 'Profile 1', copyFromCurrent: false };
      const profileData2: NewProfileRequest = { name: 'Profile 2', copyFromCurrent: false };
      
      LocalStorageService.createProfile(profileData1);
      LocalStorageService.createProfile(profileData2);
      
      const summaries = LocalStorageService.getProfileSummaries();
      
      expect(summaries).toHaveLength(2);
      expect(summaries[0].name).toBe('Profile 1');
      expect(summaries[1].name).toBe('Profile 2');
    });
  });

  describe('autoSave functionality', () => {
    it('should debounce save calls to approximately 5 seconds', () => {
      const profile: ConfigurationProfile = {
        id: 'test-id',
        name: 'Test Profile',
        settings: { theme: 'dark', language: 'en' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        version: 1
      };

      // Call autoSave multiple times in quick succession
      LocalStorageService.autoSaveCurrentProfile(profile);
      LocalStorageService.autoSaveCurrentProfile({ ...profile, settings: { theme: 'light' } });
      LocalStorageService.autoSaveCurrentProfile({ ...profile, settings: { theme: 'auto' } });

      // Advance timers by less than 5 seconds - no save should occur yet
      jest.advanceTimersByTime(3000);
      
      // The profile should still be the original one
      const currentProfile = LocalStorageService.loadCurrentProfile();
      expect(currentProfile).toBeNull();

      // Advance timers to complete the debounce period
      jest.advanceTimersByTime(2000);
      
      // Now the last value should be saved
      const updatedProfile = LocalStorageService.loadCurrentProfile();
      expect(updatedProfile?.settings.theme).toBe('auto');
    });
  });
});