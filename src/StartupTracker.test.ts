import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  getStartupStatus, 
  setStartupStatus, 
  initializeStartupTracking, 
  completeStartup, 
  reportStartupError,
  setStartupStatusCallback
} from './utils/StartupTracker';

describe('StartupTracker', () => {
  beforeEach(() => {
    // Initialize tracking before each test
    initializeStartupTracking();
  });

  it('should initialize with correct default values', () => {
    const status = getStartupStatus();
    
    expect(status.status).toBe('not-started');
    expect(status.message).toBe('Application has not begun startup');
    expect(status.dependenciesVerified).toBe(false);
    expect(status.startTime).toBeInstanceOf(Date);
    expect(typeof status.elapsedTime).toBe('number');
  });

  it('should update status correctly', () => {
    setStartupStatus({
      status: 'starting',
      message: 'Application is starting',
      dependenciesVerified: true,
      startTime: new Date()
    });

    const status = getStartupStatus();
    expect(status.status).toBe('starting');
    expect(status.message).toBe('Application is starting');
    expect(status.dependenciesVerified).toBe(true);
  });

  it('should mark startup as complete', () => {
    completeStartup();
    const status = getStartupStatus();
    
    expect(status.status).toBe('ready');
    expect(status.message).toBe('Application is running and ready');
    expect(status.dependenciesVerified).toBe(true);
  });

  it('should report startup errors', () => {
    reportStartupError('Test error message');
    const status = getStartupStatus();
    
    expect(status.status).toBe('error');
    expect(status.message).toBe('Test error message');
  });

  it('should track elapsed time', async () => {
    // Set a status with a past start time
    const pastDate = new Date(Date.now() - 5000); // 5 seconds ago
    setStartupStatus({
      status: 'starting',
      message: 'Starting with delay',
      dependenciesVerified: true,
      startTime: pastDate
    });

    const status = getStartupStatus();
    expect(status.elapsedTime).toBeGreaterThanOrEqual(5000);
  });

  it('should execute callback when status updates', () => {
    const mockCallback = vi.fn();
    setStartupStatusCallback(mockCallback);

    setStartupStatus({
      status: 'dependencies-ok',
      message: 'Dependencies verified',
      dependenciesVerified: true,
      startTime: new Date()
    });

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'dependencies-ok',
        message: 'Dependencies verified'
      })
    );
  });
});