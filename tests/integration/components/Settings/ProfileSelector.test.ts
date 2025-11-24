import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigurationProvider, useConfig } from '../../../../src/services/config/configStore';
import { LocalStorageService } from '../../../../src/services/config/localStorage';
import ProfileSelector from '../../../../src/components/Settings/ProfileSelector';
import { NewProfileRequest } from '../../../../src/types/config';

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

// Test utility component to access config context
const TestComponent: React.FC = () => {
  const { createProfile, switchProfile, deleteProfile } = useConfig();
  
  const handleCreate = async () => {
    try {
      await createProfile({
        name: "Test Profile",
        copyFromCurrent: false
      });
    } catch (e) {
      console.error('Error creating profile:', e);
    }
  };
  
  const handleSwitch = async () => {
    try {
      await switchProfile('existing-profile-id');
    } catch (e) {
      console.error('Error switching profile:', e);
    }
  };
  
  const handleDelete = async () => {
    try {
      await deleteProfile('existing-profile-id');
    } catch (e) {
      console.error('Error deleting profile:', e);
    }
  };
  
  return (
    <div>
      <button onClick={handleCreate} data-testid="create-btn">Create</button>
      <button onClick={handleSwitch} data-testid="switch-btn">Switch</button>
      <button onClick={handleDelete} data-testid="delete-btn">Delete</button>
      <ProfileSelector />
    </div>
  );
};

describe('ProfileSelector Integration', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConfigurationProvider>{children}</ConfigurationProvider>
  );

  beforeEach(() => {
    mockLocalStorage.clear();
    // Add a default profile
    const defaultProfile = {
      id: 'existing-profile-id',
      name: 'Default Profile',
      settings: { theme: 'dark' },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1
    };
    LocalStorageService.saveCurrentProfile(defaultProfile);
    LocalStorageService.saveProfiles([defaultProfile]);
  });

  it('should display existing profiles', async () => {
    render(<TestComponent />, { wrapper });
    
    // Wait for the component to load and render profiles
    await waitFor(() => {
      expect(screen.getByText('Default Profile (active)')).toBeInTheDocument();
    });
  });

  it('should create a new profile when form is submitted', async () => {
    render(<TestComponent />, { wrapper });
    
    // Click the create button
    fireEvent.click(screen.getByText('+ New Profile'));
    
    // Enter a profile name
    const input = screen.getByPlaceholderText('Profile name');
    fireEvent.change(input, { target: { value: 'New Test Profile' } });
    
    // Click the create button
    fireEvent.click(screen.getByText('Create'));
    
    // Wait for the new profile to appear in the list
    await waitFor(() => {
      expect(screen.getByText('New Test Profile')).toBeInTheDocument();
    });
  });

  it('should switch to a different profile', async () => {
    // First, create an additional profile to switch to
    const newProfile = {
      id: 'new-profile-id',
      name: 'New Profile',
      settings: { theme: 'light' },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1
    };
    LocalStorageService.saveProfiles([
      {
        id: 'existing-profile-id',
        name: 'Default Profile',
        settings: { theme: 'dark' },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        version: 1
      },
      newProfile
    ]);
    
    render(<TestComponent />, { wrapper });
    
    // Wait for profiles to be loaded
    await waitFor(() => {
      expect(screen.getByText('Default Profile (active)')).toBeInTheDocument();
      expect(screen.getByText('New Profile')).toBeInTheDocument();
    });
    
    // Click on the new profile to switch to it
    fireEvent.click(screen.getByText('New Profile'));
    
    // Wait for the active profile to update
    await waitFor(() => {
      expect(screen.getByText('New Profile (active)')).toBeInTheDocument();
    });
  });

  it('should delete a profile', async () => {
    render(<TestComponent />, { wrapper });
    
    // Wait for profiles to be loaded
    await waitFor(() => {
      expect(screen.getByText('Default Profile (active)')).toBeInTheDocument();
    });
    
    // Create another profile to delete
    const anotherProfile = {
      id: 'another-profile-id',
      name: 'To Be Deleted',
      settings: { theme: 'light' },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1
    };
    
    const profiles = LocalStorageService.loadProfiles();
    LocalStorageService.saveProfiles([...profiles, anotherProfile]);
    
    // Re-render to pick up the new profile
    render(<TestComponent />, { wrapper });
    
    // Wait for the new profile to appear
    await waitFor(() => {
      expect(screen.getByText('To Be Deleted')).toBeInTheDocument();
    });
    
    // Click delete button for the new profile
    fireEvent.click(screen.getByText('Delete'));
    
    // Confirm deletion in modal
    fireEvent.click(screen.getByText('Delete')); // The delete button in the modal
    
    // Wait for the profile to be removed
    await waitFor(() => {
      expect(screen.queryByText('To Be Deleted')).not.toBeInTheDocument();
    });
  });
});