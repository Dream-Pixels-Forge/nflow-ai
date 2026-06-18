import express from 'express';
import cors from 'cors';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json());

// Helper: run git command with timeout
async function runGit(command: string, timeout = 10000): Promise<{ success: boolean; output: string; error?: string }> {
  console.log(`[git-bridge] Executing: git ${command}`);
  try {
    const { stdout, stderr } = await execAsync(`git ${command}`, {
      timeout,
      maxBuffer: 1024 * 1024 // 1MB
    });
    return { success: true, output: stdout.trim() || stderr.trim() };
  } catch (err: any) {
    const errorMsg = err.stderr || err.message || 'Unknown error';
    console.error(`[git-bridge] Error: ${errorMsg}`);
    return { success: false, output: '', error: errorMsg };
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Read endpoints (GET, used by localGitService) ──────────────────

// GET /api/git/status — returns { branch, ahead, behind, dirty }
app.get('/api/git/status', async (_req, res) => {
  const branch = await runGit('branch --show-current');
  const status = await runGit('status --porcelain');
  const ahead = await runGit('rev-list --count @{u}..HEAD').catch(() => ({ success: true, output: '0' }));
  const behind = await runGit('rev-list --count HEAD..@{u}').catch(() => ({ success: true, output: '0' }));
  const lines = status.output ? status.output.split('\n').filter(Boolean) : [];
  res.json({ branch: branch.output.trim(), ahead: parseInt(ahead.output) || 0, behind: parseInt(behind.output) || 0, dirty: lines.length });
});

// GET /api/git/log — query ?count=20, returns { commits: Array<{hash, message, date}> }
app.get('/api/git/log', async (req, res) => {
  const count = parseInt(String(req.query.count ?? 20)) || 20;
  const result = await runGit(`log --oneline --format="%H|%s|%ai" -${count}`);
  const commits = result.output.split('\n').filter(Boolean).map(line => {
    const [hash, ...rest] = line.split('|');
    const message = rest.slice(0, -2).join('|') || rest[0] || '';
    const date = rest[rest.length - 1] || '';
    return { hash, message, date };
  });
  res.json({ commits });
});

// GET /api/git/branches — returns { branches: string[] }
app.get('/api/git/branches', async (_req, res) => {
  const result = await runGit('branch -a --format="%(refname:short)"');
  const branches = result.output.split('\n').filter(Boolean);
  res.json({ branches });
});

// GET /api/git/tags — returns { tags: LocalGitRelease[] }
app.get('/api/git/tags', async (_req, res) => {
  const result = await runGit('tag --sort=-creatordate --format="%(refname:short)|%(subject)|%(creatordate:iso)"');
  const tags = result.output.split('\n').filter(Boolean).map(line => {
    const [tag_name, name, created_at] = line.split('|');
    return { tag_name: tag_name || name || '', name: name || tag_name || '', draft: false, prerelease: false, created_at: created_at || '', body: '' };
  });
  res.json({ tags });
});

// ── Write endpoints (POST, mutations) ─────────────────────────────

// POST /api/git/commit
app.post('/api/git/commit', async (req, res) => {
  const { message, files } = req.body;
  if (!message) {
    res.json({ success: false, output: '', error: 'Commit message is required' });
    return;
  }
  const filesArg = files ? `-- ${files}` : '-a';
  const result = await runGit(`commit -m "${message.replace(/"/g, '\\"')}" ${filesArg}`);
  res.json(result);
});

// POST /api/git/push
app.post('/api/git/push', async (_req, res) => {
  const result = await runGit('push');
  res.json(result);
});

// POST /api/git/pull
app.post('/api/git/pull', async (_req, res) => {
  const result = await runGit('pull');
  res.json(result);
});

// POST /api/git/diff
app.post('/api/git/diff', async (req, res) => {
  const { staged } = req.body || {};
  const flag = staged ? '--staged' : '';
  const result = await runGit(`diff ${flag}`);
  res.json(result);
});

// POST /api/git/checkout
app.post('/api/git/checkout', async (req, res) => {
  const { branch } = req.body;
  if (!branch) {
    res.json({ success: false, output: '', error: 'Branch name is required' });
    return;
  }
  const result = await runGit(`checkout ${branch}`);
  res.json(result);
});

// POST /api/git/merge
app.post('/api/git/merge', async (req, res) => {
  const { branch } = req.body;
  if (!branch) {
    res.json({ success: false, output: '', error: 'Branch name is required' });
    return;
  }
  const result = await runGit(`merge ${branch}`);
  res.json(result);
});

// POST /api/git/create-release
app.post('/api/git/create-release', async (req, res) => {
  const { tag, name, body, draft = true, prerelease = false } = req.body;
  if (!tag) {
    res.json({ success: false, output: '', error: 'Tag name is required' });
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    res.json({ success: false, output: '', error: 'GITHUB_TOKEN environment variable not set' });
    return;
  }

  // Get repo info from git remote
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?)\.git$/) || remoteUrl.match(/github\.com\/(.+)/);
    if (!match) {
      res.json({ success: false, output: '', error: 'Could not parse GitHub owner/repo from remote URL' });
      return;
    }
    const [owner, repo] = match[1].split('/');

    // Create release via GitHub API
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tag_name: tag, name: name || tag, body, draft, prerelease })
    });

    const data = await response.json();
    if (response.ok) {
      res.json({ success: true, output: JSON.stringify(data, null, 2) });
    } else {
      res.json({ success: false, output: '', error: data.message || 'GitHub API error' });
    }
  } catch (err: any) {
    res.json({ success: false, output: '', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[git-bridge] Server running on http://localhost:${PORT}`);
  console.log(`[git-bridge] CORS enabled for http://localhost:3000`);
});
