import React, { useState, useEffect } from 'react';
import {
  Github,
  GitPullRequest,
  CircleDot,
  Tag,
  Plus,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader,
  X
} from 'lucide-react';
import { AppSettings, GitHubIssue, GitHubPR, GitHubRelease } from '../types';
import {
  fetchRepoIssues,
  fetchRepoPRs,
  fetchRepoReleases,
  createIssue,
  createDraftRelease
} from '../services/githubService';

interface GitHubPanelProps {
  settings: AppSettings;
  onUpdate: (newSettings: AppSettings) => void;
}

type GitHubTab = 'issues' | 'prs' | 'releases';

export const GitHubPanel: React.FC<GitHubPanelProps> = ({ settings, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<GitHubTab>('issues');
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [prs, setPrs] = useState<GitHubPR[]>([]);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [showCreateRelease, setShowCreateRelease] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueBody, setNewIssueBody] = useState('');
  const [newReleaseTag, setNewReleaseTag] = useState('');
  const [newReleaseName, setNewReleaseName] = useState('');
  const [newReleaseBody, setNewReleaseBody] = useState('');

  const isConnected = !!settings.githubToken && !!settings.githubOwner && !!settings.githubRepo;

  const loadData = async () => {
    if (!isConnected || !settings.githubToken || !settings.githubOwner || !settings.githubRepo) return;

    setIsLoading(true);
    setError(null);

    try {
      const [issuesData, prsData, releasesData] = await Promise.all([
        fetchRepoIssues(settings.githubToken, settings.githubOwner, settings.githubRepo),
        fetchRepoPRs(settings.githubToken, settings.githubOwner, settings.githubRepo),
        fetchRepoReleases(settings.githubToken, settings.githubOwner, settings.githubRepo)
      ]);
      setIssues(issuesData);
      setPrs(prsData);
      setReleases(releasesData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load GitHub data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [isConnected, settings.githubToken, settings.githubOwner, settings.githubRepo]);

  const handleConnect = () => {
    if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) return;
    loadData();
  };

  const handleCreateIssue = async () => {
    if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo || !newIssueTitle) return;

    setIsLoading(true);
    try {
      await createIssue(settings.githubToken, settings.githubOwner, settings.githubRepo, newIssueTitle, newIssueBody);
      setShowCreateIssue(false);
      setNewIssueTitle('');
      setNewIssueBody('');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create issue';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRelease = async () => {
    if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo || !newReleaseTag || !newReleaseName) return;

    setIsLoading(true);
    try {
      await createDraftRelease(settings.githubToken, settings.githubOwner, settings.githubRepo, newReleaseTag, newReleaseName, newReleaseBody);
      setShowCreateRelease(false);
      setNewReleaseTag('');
      setNewReleaseName('');
      setNewReleaseBody('');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create release';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-nexus-800/50 border-l border-nexus-border min-h-full">
        <h3 className="text-nexus-accent font-mono text-sm uppercase tracking-wider flex items-center gap-2 mb-2">
          <Github className="w-4 h-4" /> GitHub Integration
        </h3>

        <div className="bg-nexus-900 border border-nexus-border p-3 space-y-3">
          <div className="text-[10px] text-nexus-dim uppercase font-bold">Connection Settings</div>
          
          <div className="space-y-2">
            <div>
              <label className="text-[9px] text-nexus-dim uppercase">Personal Access Token</label>
              <input
                type="password"
                value={settings.githubToken || ''}
                onChange={(e) => onUpdate({ ...settings, githubToken: e.target.value })}
                className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono"
                placeholder="ghp_..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-nexus-dim uppercase">Owner</label>
                <input
                  type="text"
                  value={settings.githubOwner || ''}
                  onChange={(e) => onUpdate({ ...settings, githubOwner: e.target.value })}
                  className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono"
                  placeholder="owner"
                />
              </div>
              <div>
                <label className="text-[9px] text-nexus-dim uppercase">Repository</label>
                <input
                  type="text"
                  value={settings.githubRepo || ''}
                  onChange={(e) => onUpdate({ ...settings, githubRepo: e.target.value })}
                  className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono"
                  placeholder="repo"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={!settings.githubToken || !settings.githubOwner || !settings.githubRepo}
            className="w-full py-2 bg-nexus-accent/20 border border-nexus-accent/50 text-nexus-accent text-[10px] font-bold uppercase tracking-wider rounded hover:bg-nexus-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CONNECT
          </button>

          <div className="text-[9px] text-nexus-dim">
            Create a <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-nexus-accent hover:underline">Personal Access Token</a> with repo permissions.
          </div>

          {/* Local Git Fallback */}
          <div className="border-t border-nexus-border pt-3 mt-3">
            <div className="text-[10px] text-nexus-dim uppercase font-bold mb-2">Or Use Local Git</div>
            <p className="text-[9px] text-gray-500 mb-2">
              Connect to your local git repository without a GitHub token.
            </p>
            <button
              onClick={() => {
                onUpdate({ ...settings, githubOwner: 'local', githubRepo: 'repository' });
              }}
              className="w-full py-2 bg-nexus-800 border border-nexus-border text-nexus-dim text-[10px] font-bold uppercase tracking-wider rounded hover:bg-nexus-700 hover:text-gray-300 transition-colors"
            >
              USE LOCAL GIT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-nexus-800/50 border-l border-nexus-border min-h-full">
      <h3 className="text-nexus-accent font-mono text-sm uppercase tracking-wider flex items-center gap-2 mb-2">
        <Github className="w-4 h-4" /> GitHub Integration
      </h3>

      {/* Connection Info */}
      <div className="bg-nexus-900 border border-nexus-border p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle size={12} className="text-green-500" />
          <span className="text-[10px] text-gray-300 font-mono">
            {settings.githubOwner}/{settings.githubRepo}
          </span>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-1 text-nexus-dim hover:text-nexus-accent transition-colors"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-2 rounded flex items-center gap-2">
          <AlertTriangle size={12} className="text-red-500" />
          <span className="text-[10px] text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-400">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border border-nexus-border rounded overflow-hidden">
        <button
          onClick={() => setActiveTab('issues')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'issues'
              ? 'bg-nexus-accent/20 text-nexus-accent'
              : 'bg-nexus-900 text-nexus-dim hover:bg-nexus-800/50'
          }`}
        >
          <CircleDot size={12} />
          Issues
          <span className="text-[8px] opacity-60">({issues.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('prs')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'prs'
              ? 'bg-nexus-accent/20 text-nexus-accent'
              : 'bg-nexus-900 text-nexus-dim hover:bg-nexus-800/50'
          }`}
        >
          <GitPullRequest size={12} />
          PRs
          <span className="text-[8px] opacity-60">({prs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('releases')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'releases'
              ? 'bg-nexus-accent/20 text-nexus-accent'
              : 'bg-nexus-900 text-nexus-dim hover:bg-nexus-800/50'
          }`}
        >
          <Tag size={12} />
          Releases
          <span className="text-[8px] opacity-60">({releases.length})</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-nexus-900 border border-nexus-border rounded p-3 flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader size={20} className="text-nexus-accent animate-spin" />
          </div>
        ) : (
          <>
            {/* Issues Tab */}
            {activeTab === 'issues' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-nexus-dim uppercase">Open Issues</span>
                  <button
                    onClick={() => setShowCreateIssue(true)}
                    className="flex items-center gap-1 text-[9px] text-nexus-accent hover:text-white transition-colors"
                  >
                    <Plus size={10} />
                    NEW
                  </button>
                </div>
                {showCreateIssue && (
                  <div className="bg-nexus-800/50 border border-nexus-accent/30 p-2 rounded space-y-2 mb-3">
                    <input
                      type="text"
                      value={newIssueTitle}
                      onChange={(e) => setNewIssueTitle(e.target.value)}
                      className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono"
                      placeholder="Issue title"
                    />
                    <textarea
                      value={newIssueBody}
                      onChange={(e) => setNewIssueBody(e.target.value)}
                      className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono h-16 resize-none"
                      placeholder="Issue body (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateIssue}
                        disabled={!newIssueTitle}
                        className="px-3 py-1 bg-nexus-accent/20 border border-nexus-accent/50 text-nexus-accent text-[9px] font-bold rounded hover:bg-nexus-accent/30 transition-colors disabled:opacity-50"
                      >
                        CREATE
                      </button>
                      <button
                        onClick={() => { setShowCreateIssue(false); setNewIssueTitle(''); setNewIssueBody(''); }}
                        className="px-3 py-1 text-nexus-dim text-[9px] hover:text-white transition-colors"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}
                {issues.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-nexus-dim">No open issues</div>
                ) : (
                  issues.map((issue) => (
                    <div key={issue.number} className="border-b border-nexus-border/30 pb-2 mb-2 last:border-0">
                      <div className="flex items-start gap-2">
                        <CircleDot size={12} className="text-green-500 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-300 font-mono">#{issue.number}</span>
                            <span className="text-[10px] text-gray-400 truncate">{issue.title}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] text-nexus-dim">{issue.user.login}</span>
                            <span className="text-[8px] text-nexus-dim">•</span>
                            <span className="text-[8px] text-nexus-dim">{new Date(issue.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className="text-nexus-dim hover:text-nexus-accent transition-colors">
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* PRs Tab */}
            {activeTab === 'prs' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-nexus-dim uppercase">Open Pull Requests</span>
                </div>
                {prs.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-nexus-dim">No open pull requests</div>
                ) : (
                  prs.map((pr) => (
                      <div key={pr.number} className="border-b border-nexus-border/30 pb-2 mb-2 last:border-0">
                      <div className="flex items-start gap-2">
                        <GitPullRequest size={12} className={`mt-0.5 ${pr.draft ? 'text-yellow-500' : 'text-purple-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-300 font-mono">#{pr.number}</span>
                            <span className="text-[10px] text-gray-400 truncate">{pr.title}</span>
                            {pr.draft && (
                              <span className="text-[8px] px-1 py-0.5 bg-yellow-500/20 text-yellow-500 rounded">DRAFT</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] text-nexus-dim">{pr.head.ref}</span>
                            <span className="text-[8px] text-nexus-dim">→</span>
                            <span className="text-[8px] text-nexus-dim">{pr.base.ref}</span>
                          </div>
                        </div>
                        <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="text-nexus-dim hover:text-nexus-accent transition-colors">
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Releases Tab */}
            {activeTab === 'releases' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-nexus-dim uppercase">Releases</span>
                  <button
                    onClick={() => setShowCreateRelease(true)}
                    className="flex items-center gap-1 text-[9px] text-nexus-accent hover:text-white transition-colors"
                  >
                    <Plus size={10} />
                    NEW DRAFT
                  </button>
                </div>
                {showCreateRelease && (
                  <div className="bg-nexus-800/50 border border-nexus-accent/30 p-2 rounded space-y-2 mb-3">
                    <input
                      type="text"
                      value={newReleaseTag}
                      onChange={(e) => setNewReleaseTag(e.target.value)}
                      className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono"
                      placeholder="Tag name (e.g., v1.0.0)"
                    />
                    <input
                      type="text"
                      value={newReleaseName}
                      onChange={(e) => setNewReleaseName(e.target.value)}
                      className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono"
                      placeholder="Release name"
                    />
                    <textarea
                      value={newReleaseBody}
                      onChange={(e) => setNewReleaseBody(e.target.value)}
                      className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono h-16 resize-none"
                      placeholder="Release notes (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateRelease}
                        disabled={!newReleaseTag || !newReleaseName}
                        className="px-3 py-1 bg-nexus-accent/20 border border-nexus-accent/50 text-nexus-accent text-[9px] font-bold rounded hover:bg-nexus-accent/30 transition-colors disabled:opacity-50"
                      >
                        CREATE DRAFT
                      </button>
                      <button
                        onClick={() => { setShowCreateRelease(false); setNewReleaseTag(''); setNewReleaseName(''); setNewReleaseBody(''); }}
                        className="px-3 py-1 text-nexus-dim text-[9px] hover:text-white transition-colors"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}
                {releases.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-nexus-dim">No releases</div>
                ) : (
                  releases.map((release) => (
                      <div key={release.tag_name} className="border-b border-nexus-border/30 pb-2 mb-2 last:border-0">
                        <div className="flex items-start gap-2">
                          <Tag size={12} className={`mt-0.5 ${release.draft ? 'text-yellow-500' : 'text-green-500'}`} />
                          <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-300 font-mono">{release.tag_name}</span>
                            {release.draft && (
                              <span className="text-[8px] px-1 py-0.5 bg-yellow-500/20 text-yellow-500 rounded">DRAFT</span>
                            )}
                            {release.prerelease && (
                              <span className="text-[8px] px-1 py-0.5 bg-orange-500/20 text-orange-500 rounded">PRE</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">{release.name}</div>
                          <div className="text-[8px] text-nexus-dim mt-1">
                            {new Date(release.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
