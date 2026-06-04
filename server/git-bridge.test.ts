import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SERVER_URL = 'http://localhost:3001';

let serverProcess: any;

describe('Git Bridge Server', () => {
  beforeAll(async () => {
    // Start the server in background
    serverProcess = exec('npx tsx git-bridge.ts', { cwd: __dirname });
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to health check', async () => {
    const response = await fetch(`${SERVER_URL}/api/health`);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
