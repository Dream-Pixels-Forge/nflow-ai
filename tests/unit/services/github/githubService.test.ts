import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchUserRepos,
  fetchRepoIssues,
  fetchRepoPRs,
  fetchRepoReleases,
  createIssue,
  createDraftRelease
} from '../../../../services/githubService';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GitHubService', () => {
  const mockToken = 'ghp_test123';
  const mockOwner = 'test-owner';
  const mockRepo = 'test-repo';

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchUserRepos', () => {
    it('should fetch user repositories with correct headers', async () => {
      const mockRepos = [
        { full_name: 'test-owner/repo1', name: 'repo1', description: 'Test repo' }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      });

      const result = await fetchUserRepos(mockToken);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user/repos?sort=updated&per_page=20',
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'NexusFlow'
          }
        })
      );
      expect(result).toEqual(mockRepos);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(fetchUserRepos(mockToken)).rejects.toThrow('GitHub API Error: 401');
    });
  });

  describe('fetchRepoIssues', () => {
    it('should fetch issues with correct parameters', async () => {
      const mockIssues = [
        { number: 1, title: 'Test Issue', state: 'open' }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssues
      });

      const result = await fetchRepoIssues(mockToken, mockOwner, mockRepo, 'open');

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${mockOwner}/${mockRepo}/issues?state=open&per_page=20`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );
      expect(result).toEqual(mockIssues);
    });

    it('should default to open issues', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await fetchRepoIssues(mockToken, mockOwner, mockRepo);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('state=open'),
        expect.any(Object)
      );
    });
  });

  describe('fetchRepoPRs', () => {
    it('should fetch pull requests with correct parameters', async () => {
      const mockPRs = [
        { number: 1, title: 'Test PR', state: 'open', draft: false }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPRs
      });

      const result = await fetchRepoPRs(mockToken, mockOwner, mockRepo, 'open');

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${mockOwner}/${mockRepo}/pulls?state=open&per_page=20`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );
      expect(result).toEqual(mockPRs);
    });
  });

  describe('fetchRepoReleases', () => {
    it('should fetch releases with correct parameters', async () => {
      const mockReleases = [
        { tag_name: 'v1.0.0', name: 'Release 1.0.0', draft: false }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleases
      });

      const result = await fetchRepoReleases(mockToken, mockOwner, mockRepo);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${mockOwner}/${mockRepo}/releases?per_page=10`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );
      expect(result).toEqual(mockReleases);
    });
  });

  describe('createIssue', () => {
    it('should create an issue with correct payload', async () => {
      const mockIssue = { number: 1, title: 'New Issue', state: 'open' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue
      });

      const result = await createIssue(mockToken, mockOwner, mockRepo, 'New Issue', 'Issue body');

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${mockOwner}/${mockRepo}/issues`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          }),
          body: JSON.stringify({ title: 'New Issue', body: 'Issue body' })
        })
      );
      expect(result).toEqual(mockIssue);
    });
  });

  describe('createDraftRelease', () => {
    it('should create a draft release with correct payload', async () => {
      const mockRelease = { tag_name: 'v1.0.0', name: 'Release 1.0.0', draft: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRelease
      });

      const result = await createDraftRelease(mockToken, mockOwner, mockRepo, 'v1.0.0', 'Release 1.0.0', 'Release notes');

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${mockOwner}/${mockRepo}/releases`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          }),
          body: JSON.stringify({
            tag_name: 'v1.0.0',
            name: 'Release 1.0.0',
            body: 'Release notes',
            draft: true
          })
        })
      );
      expect(result).toEqual(mockRelease);
    });
  });
});
