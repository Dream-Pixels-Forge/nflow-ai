// services/localGitService.ts
// Local git fallback when GitHub API is unavailable
// NOTE: Full local git integration requires a backend proxy (e.g., tools-server.mjs)
// This provides stub data and detection for now

export interface LocalGitIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  user: { login: string };
  body?: string;
}

export interface LocalGitPR {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
  head: { ref: string };
  base: { ref: string };
  created_at: string;
  user: { login: string };
}

export interface LocalGitRelease {
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  body?: string;
}

// Detect if running in a git repo by checking for .git directory
export const isGitRepo = async (): Promise<boolean> => {
  try {
    const response = await fetch('/.git/HEAD', { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

// Get local branches via tools-server proxy
export const getLocalBranches = async (): Promise<string[]> => {
  try {
    const response = await fetch('/api/git/branches');
    if (!response.ok) return [];
    const data = await response.json();
    return data.branches || [];
  } catch {
    return [];
  }
};

// Get local tags via tools-server proxy
export const getLocalTags = async (): Promise<LocalGitRelease[]> => {
  try {
    const response = await fetch('/api/git/tags');
    if (!response.ok) return [];
    const data = await response.json();
    return data.tags || [];
  } catch {
    return [];
  }
};

// Get local commits via tools-server proxy
export const getLocalCommits = async (count: number = 20): Promise<Array<{ hash: string; message: string; date: string }>> => {
  try {
    const response = await fetch(`/api/git/log?count=${count}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.commits || [];
  } catch {
    return [];
  }
};

// Get repo status
export const getLocalStatus = async (): Promise<{ branch: string; ahead: number; behind: number; dirty: number } | null> => {
  try {
    const response = await fetch('/api/git/status');
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};
