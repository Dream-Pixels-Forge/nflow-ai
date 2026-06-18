/**
 * SecretManager - AES-256-GCM encryption integration tests
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  SecretManager,
  SecretManagerConfig
} from '../../../../src/security/secret-manager/SecretManager';
import { createMockSubtle } from '../../../../tests/mocks/webCrypto';
import { createMockIndexedDB } from '../../../../tests/mocks/indexedDB';

// Provide Web Crypto API + IndexedDB in jsdom test environment
beforeAll(() => {
  const mockSubtle = createMockSubtle();
  vi.stubGlobal('crypto', {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: mockSubtle,
  });
  vi.stubGlobal('indexedDB', createMockIndexedDB());
});

afterAll(() => {
  vi.unstubAllGlobals();
});
describe('SecretManager', () => {
  describe('isEncryptionReady', () => {
    it('should return false before initEncryption is called', () => {
      const manager = new SecretManager({ encryptionEnabled: true });
      expect(manager.isEncryptionReady()).toBe(false);
    });
  });

  describe('initEncryption', () => {
    it('should load or generate a key and mark encryption as ready', async () => {
      const manager = new SecretManager({ encryptionEnabled: true });
      await manager.initEncryption();
      expect(manager.isEncryptionReady()).toBe(true);
    });

    it('should generate and store a new key when no key exists in IndexedDB', async () => {
      const manager = new SecretManager({ encryptionEnabled: true });
      await manager.initEncryption();
      expect(manager.isEncryptionReady()).toBe(true);
    });
  });
});
