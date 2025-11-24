import { renderHook, act } from '@testing-library/react';
import { ConfigurationProvider, useConfig } from '../../../../src/services/config/configStore';
import { LocalStorageService } from '../../../../src/services/config/localStorage';

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
    }
  };
})();

// Replace localStorage with mock for testing
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Configuration Store Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('should initialize with default values', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigurationProvider>{children}</ConfigurationProvider>
    );
    
    const { result } = renderHook(() => useConfig(), { wrapper });
    
    // Wait for the initial loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.currentProfile).toBeNull();
    expect(result.current.state.profiles).toEqual([]);
  });

  it('should load existing configuration from localStorage', async () => {
    // Pre-populate localStorage with a profile
    const mockProfile = {
      id: 'test-id',
      name: 'Test Profile',
      settings: { theme: 'dark', language: 'en' },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1
    };
    
    LocalStorageService.saveCurrentProfile(mockProfile);
    LocalStorageService.saveProfiles([mockProfile]);
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigurationProvider>{children}</ConfigurationProvider>
    );
    
    const { result } = renderHook(() => useConfig(), { wrapper });
    
    // Wait for the initial loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.state.currentProfile).toEqual(mockProfile);
    expect(result.current.state.profiles).toEqual([mockProfile]);
  });

  it('should save configuration changes', async () => {
    const initialProfile = {
      id: 'test-id',
      name: 'Test Profile',
      settings: { theme: 'dark', language: 'en' },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1
    };
    
    LocalStorageService.saveCurrentProfile(initialProfile);
    LocalStorageService.saveProfiles([initialProfile]);
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigurationProvider>{children}</ConfigurationProvider>
    );
    
    const { result } = renderHook(() => useConfig(), { wrapper });
    
    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Update a setting
    await act(async () => {
      await result.current.saveConfig({
        settings: { theme: 'light' }
      });
    });

    // Check that the state was updated
    expect(result.current.state.currentProfile?.settings.theme).toBe('light');
    
    // Check that the profile was saved to localStorage
    const savedProfile = LocalStorageService.loadCurrentProfile();
    expect(savedProfile?.settings.theme).toBe('light');
  });

  it('should update individual settings', async () => {
    const initialProfile = {
      id: 'test-id',
      name: 'Test Profile',
      settings: { theme: 'dark', language: 'en' },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1
    };
    
    LocalStorageService.saveCurrentProfile(initialProfile);
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigurationProvider>{children}</ConfigurationProvider>
    );
    
    const { result } = renderHook(() => useConfig(), { wrapper });
    
    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Update a single setting using the updateSetting method
    await act(async () => {
      result.current.updateSetting('newSetting', 'newValue');
    });

    // Check that the state was updated
    expect(result.current.state.currentProfile?.settings.newSetting).toBe('newValue');
    expect(result.current.state.currentProfile?.settings.theme).toBe('dark'); // Other settings unchanged
  });

  it('should get individual settings', async () => {
    const initialProfile = {
      id: 'test-id',
      name: 'Test Profile',
      settings: { theme: 'dark', language: 'en' },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1
    };
    
    LocalStorageService.saveCurrentProfile(initialProfile);
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigurationProvider>{children}</ConfigurationProvider>
    );
    
    const { result } = renderHook(() => useConfig(), { wrapper });
    
    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Get a setting value
    const theme = result.current.getSetting<string>('theme');
    expect(theme).toBe('dark');
    
    // Get a non-existent setting
    const nonExistent = result.current.getSetting('nonExistent');
    expect(nonExistent).toBeUndefined();
  });
});