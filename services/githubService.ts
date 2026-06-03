import { GitHubIssue, GitHubPR, GitHubRelease, GitHubRepo } from '../types';

const GITHUB_API = 'https://api.github.com';

const getHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'NexusFlow'
});

export const fetchUserRepos = async (token: string): Promise<GitHubRepo[]> => {
  const response = await fetch(`${GITHUB_API}/user/repos?sort=updated&per_page=20`, {
    headers: getHeaders(token)
  });
  if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
  return response.json();
};

export const fetchRepoIssues = async (
  token: string, owner: string, repo: string, state: 'open' | 'closed' = 'open'
): Promise<GitHubIssue[]> => {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues?state=${state}&per_page=20`,
    { headers: getHeaders(token) }
  );
  if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
  return response.json();
};

export const fetchRepoPRs = async (
  token: string, owner: string, repo: string, state: 'open' | 'closed' = 'open'
): Promise<GitHubPR[]> => {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`,
    { headers: getHeaders(token) }
  );
  if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
  return response.json();
};

export const fetchRepoReleases = async (
  token: string, owner: string, repo: string
): Promise<GitHubRelease[]> => {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=10`,
    { headers: getHeaders(token) }
  );
  if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
  return response.json();
};

export const createIssue = async (
  token: string, owner: string, repo: string, title: string, body?: string
): Promise<GitHubIssue> => {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ title, body })
    }
  );
  if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
  return response.json();
};

export const createDraftRelease = async (
  token: string, owner: string, repo: string, tagName: string, name: string, body?: string
): Promise<GitHubRelease> => {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/releases`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ tag_name: tagName, name, body, draft: true })
    }
  );
  if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
  return response.json();
};
