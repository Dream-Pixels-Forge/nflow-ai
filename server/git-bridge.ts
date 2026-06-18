import express from 'express';
import cors from 'cors';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json());

/** Validate a git branch/tag name (alphanumeric, dots, slashes, hyphens, underscores) */
function isValidRef(name: string): boolean {
  return /^[\w.\-/]+$/.test(name) && name.length > 0 && name.length <= 256;
}

/** Validate a commit message (printable ASCII, <= 1 KB, no control chars except newline) */
function isValidMessage(msg: string): boolean {
  return msg.length > 0 && msg.length <= 1024 && /^[\x20-\x7E\n\r\t]+$/.test(msg);
}

// Helper: run git command with timeout using raw string (safe for hardcoded commands)
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

// Helper: run git with args array (no shell, safe for user-supplied values)
async function runGitSafe(args: string[], timeout = 10000): Promise<{ success: boolean; output: string; error?: string }> {
  console.log(`[git-bridge] Executing: git ${args.join(' ')}`);
  return new Promise((resolve) => {
    const child = spawn('git', args, { timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout.trim() || stderr.trim() });
      } else {
        resolve({ success: false, output: stdout.trim(), error: stderr.trim() || `Exit code ${code}` });
      }
    });
    child.on('error', (err) => {
      resolve({ success: false, output: '', error: err.message });
    });
  });
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
  if (!message || !isValidMessage(message)) {
    res.json({ success: false, output: '', error: 'Invalid commit message' });
    return;
  }
  // Validate all file paths if provided
  if (files) {
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) {
      if (!isValidRef(f)) {
        res.json({ success: false, output: '', error: `Invalid file path: ${f}` });
        return;
      }
    }
  }
  const args = ['commit', '-m', message, ...(files ? ['--', ...(Array.isArray(files) ? files : [files])] : ['-a'])];
  const result = await runGitSafe(args);
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
  if (!branch || !isValidRef(branch)) {
    res.json({ success: false, output: '', error: 'Invalid branch name' });
    return;
  }
  const result = await runGitSafe(['checkout', branch]);
  res.json(result);
});

// POST /api/git/merge
app.post('/api/git/merge', async (req, res) => {
  const { branch } = req.body;
  if (!branch || !isValidRef(branch)) {
    res.json({ success: false, output: '', error: 'Invalid branch name' });
    return;
  }
  const result = await runGitSafe(['merge', branch]);
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
