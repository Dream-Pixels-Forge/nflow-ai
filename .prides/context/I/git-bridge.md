# LocalGitService Backend Bridge

## Task
Create a local Express.js server that bridges the browser frontend to actual git operations on the local filesystem, since the Vite browser app cannot run Node.js child_process directly.

## Requirements
1. Create `server/git-bridge.ts`:
   - Express server on port 3001
   - Endpoints:
     - `POST /api/git/status` — run `git status`
     - `POST /api/git/commit` — run `git commit -m "message" --files`
     - `POST /api/git/push` — run `git push`
     - `POST /api/git/pull` — run `git pull`
     - `POST /api/git/log` — run `git log --oneline -20`
     - `POST /api/git/diff` — run `git diff`
     - `POST /api/git/branch` — run `git branch`
     - `POST /api/git/checkout` — run `git checkout <branch>`
     - `POST /api/git/merge` — run `git merge <branch>`
     - `POST /api/git/create-release` — create draft release via GitHub API
   - CORS enabled for localhost:3000
   - Uses `child_process.exec` with timeout
   - Returns JSON `{ success, output, error }`

2. Update `src/services/localGitService.ts`:
   - Currently uses fetch to `/api/git/*` — verify these proxy routes work
   - Add error handling for server not running
   - Add retry logic (1 retry after 1s)

3. Create `server/package.json`:
   - Dependencies: express, cors, @types/express, @types/cors
   - Scripts: `start`, `dev` (with tsx)

4. Create `server/tsconfig.json`:
   - Target ES2020, module CommonJS

5. Update root `package.json`:
   - Add script: `"server": "cd server && pnpm start"`
   - Add script: `"dev:all": "pnpm dev & pnpm server"`

## Constraints
- Server runs alongside Vite dev server
- No external git libraries (use raw git CLI)
- Handle git not installed gracefully
- Log all git commands for debugging
