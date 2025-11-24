import React, { useState } from 'react';
import { useConfig } from '../../services/config/configStore';
import { NewProfileRequest } from '../../types/config';

const ProfileSelector: React.FC = () => {
  const { state, switchProfile, createProfile, deleteProfile } = useConfig();
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;

    try {
      const profileData: NewProfileRequest = {
        name: newProfileName.trim(),
        copyFromCurrent: true
      };
      
      await createProfile(profileData);
      setNewProfileName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert(`Failed to create profile: ${(error as Error).message}`);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      await deleteProfile(profileId);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert(`Failed to delete profile: ${(error as Error).message}`);
    }
  };

  return (
    <div className="mb-6 p-4 bg-gray-800 rounded border border-green-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-green-300">Configuration Profiles</h3>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-600 text-sm"
        >
          {isCreating ? 'Cancel' : '+ New Profile'}
        </button>
      </div>

      {isCreating && (
        <div className="mb-4 p-3 bg-gray-700 rounded flex">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Profile name"
            className="flex-1 p-2 bg-gray-600 text-green-400 border border-green-700 rounded-l focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
          />
          <button
            onClick={handleCreateProfile}
            disabled={!newProfileName.trim()}
            className={`px-4 py-2 rounded-r ${
              newProfileName.trim()
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Create
          </button>
        </div>
      )}

      <div className="space-y-2">
        {state.profiles.map((profile) => (
          <div 
            key={profile.id} 
            className={`flex items-center justify-between p-2 rounded ${
              state.currentProfile?.id === profile.id
                ? 'bg-green-900/30 border border-green-700'
                : 'bg-gray-700/50 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center">
              <button
                onClick={() => switchProfile(profile.id)}
                className={`text-left px-3 py-2 rounded ${
                  state.currentProfile?.id === profile.id
                    ? 'text-green-300 font-bold'
                    : 'text-gray-300 hover:text-green-300'
                }`}
              >
                {profile.name}
                {state.currentProfile?.id === profile.id && ' (active)'}
              </button>
            </div>
            
            {profile.id !== state.currentProfile?.id && (
              <button
                onClick={() => setShowDeleteConfirm(profile.id)}
                className="text-red-400 hover:text-red-300 px-2 py-1 text-sm"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded border border-red-700 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-red-300 mb-3">Confirm Deletion</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete this profile? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProfile(showDeleteConfirm)}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSelector;