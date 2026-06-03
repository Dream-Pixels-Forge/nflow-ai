import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getLocalCommits,
  getLocalTags,
  getLocalBranches,
  isGitRepo,
  getLocalStatus,
  LocalGitIssue,
  LocalGitPR,
  LocalGitRelease
} from '../../../../services/localGitService';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('LocalGitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isGitRepo', () => {
    it('should return true when .git/HEAD is accessible', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const result = await isGitRepo();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/.git/HEAD', { method: 'HEAD' });
    });

    it('should return false when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await isGitRepo();
      expect(result).toBe(false);
    });

    it('should return false when response not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const result = await isGitRepo();
      expect(result).toBe(false);
    });
  });

  describe('getLocalBranches', () => {
    it('should return array of branch names from /api/git/branches', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ branches: ['main', 'develop', 'feature/test'] })
      });
      const branches = await getLocalBranches();
      expect(branches).toEqual(['main', 'develop', 'feature/test']);
      expect(mockFetch).toHaveBeenCalledWith('/api/git/branches');
    });

    it('should return empty array when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const branches = await getLocalBranches();
      expect(branches).toEqual([]);
    });

    it('should return empty array when response not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const branches = await getLocalBranches();
      expect(branches).toEqual([]);
    });
  });

  describe('getLocalTags', () => {
    it('should return array of release objects from /api/git/tags', async () => {
      const tags = [
        {
          tag_name: 'v1.0.0',
          name: 'Release 1.0.0',
          draft: false,
          prerelease: false,
          created_at: '2024-01-01T00:00:00Z',
          body: 'Release notes'
        }
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tags })
      });
      const result = await getLocalTags();
      expect(result).toEqual(tags);
      expect(mockFetch).toHaveBeenCalledWith('/api/git/tags');
    });

    it('should return empty array when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const tags = await getLocalTags();
      expect(tags).toEqual([]);
    });

    it('should return empty array when response not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const tags = await getLocalTags();
      expect(tags).toEqual([]);
    });
  });

  describe('getLocalCommits', () => {
    it('should return array of commit objects from /api/git/log', async () => {
      const commits = [
        { hash: 'abc123', message: 'fix: bug', date: '2024-01-01' },
        { hash: 'def456', message: 'feat: new feature', date: '2024-01-02' }
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ commits })
      });
      const result = await getLocalCommits(5);
      expect(result).toEqual(commits);
      expect(mockFetch).toHaveBeenCalledWith('/api/git/log?count=5');
    });

    it('should default to 20 commits when no count specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ commits: [] })
      });
      await getLocalCommits();
      expect(mockFetch).toHaveBeenCalledWith('/api/git/log?count=20');
    });

    it('should return empty array when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const commits = await getLocalCommits();
      expect(commits).toEqual([]);
    });

    it('should return empty array when response not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const commits = await getLocalCommits();
      expect(commits).toEqual([]);
    });
  });

  describe('getLocalStatus', () => {
    it('should return status object from /api/git/status', async () => {
      const status = { branch: 'main', ahead: 2, behind: 1, dirty: 5 };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(status)
      });
      const result = await getLocalStatus();
      expect(result).toEqual(status);
      expect(mockFetch).toHaveBeenCalledWith('/api/git/status');
    });

    it('should return null when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await getLocalStatus();
      expect(result).toBeNull();
    });

    it('should return null when response not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const result = await getLocalStatus();
      expect(result).toBeNull();
    });
  });

  describe('LocalGitIssue interface', () => {
    it('should define correct structure', () => {
      const issue: LocalGitIssue = {
        number: 1,
        title: 'Test Issue',
        state: 'open',
        labels: [{ name: 'bug', color: '#ff0000' }],
        created_at: '2024-01-01T00:00:00Z',
        user: { login: 'testuser' },
        body: 'Issue body'
      };
      expect(issue.number).toBe(1);
      expect(issue.state).toBe('open');
      expect(issue.labels[0].name).toBe('bug');
    });
  });

  describe('LocalGitPR interface', () => {
    it('should define correct structure', () => {
      const pr: LocalGitPR = {
        number: 1,
        title: 'Test PR',
        state: 'open',
        draft: false,
        head: { ref: 'feature/test' },
        base: { ref: 'main' },
        created_at: '2024-01-01T00:00:00Z',
        user: { login: 'testuser' }
      };
      expect(pr.number).toBe(1);
      expect(pr.state).toBe('open');
      expect(pr.draft).toBe(false);
      expect(pr.head.ref).toBe('feature/test');
    });
  });

  describe('LocalGitRelease interface', () => {
    it('should define correct structure', () => {
      const release: LocalGitRelease = {
        tag_name: 'v1.0.0',
        name: 'Release 1.0.0',
        draft: false,
        prerelease: false,
        created_at: '2024-01-01T00:00:00Z',
        body: 'Release notes'
      };
      expect(release.tag_name).toBe('v1.0.0');
      expect(release.draft).toBe(false);
      expect(release.prerelease).toBe(false);
    });
  });
});