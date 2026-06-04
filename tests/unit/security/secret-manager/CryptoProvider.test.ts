/**
 * CryptoProvider - AES-256-GCM encryption tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateAESKey,
  encryptAES,
  decryptAES,
  deriveKey,
  exportKey,
  importKey,
  storeKeyInDB,
  loadKeyFromDB
} from '../../../../src/security/secret-manager/CryptoProvider';

describe('CryptoProvider', () => {
  describe('generateAESKey', () => {
    it('should generate a CryptoKey for AES-GCM', async () => {
      const key = await generateAESKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toEqual({
        name: 'AES-GCM',
        length: 256
      });
    });

    it('should generate different keys on each call', async () => {
      const key1 = await generateAESKey();
      const key2 = await generateAESKey();
      
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
    });
  });

  describe('encryptAES and decryptAES', () => {
    let testKey: CryptoKey;

    beforeEach(async () => {
      testKey = await generateAESKey();
    });

    it('should encrypt plaintext and return an ArrayBuffer', async () => {
      const plaintext = 'Hello, World!';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const ciphertext = await encryptAES(testKey, iv, plaintext);
      
      expect(ciphertext).toBeInstanceOf(ArrayBuffer);
      expect(ciphertext.byteLength).toBeGreaterThan(0);
    });

    it('should decrypt ciphertext back to original plaintext', async () => {
      const plaintext = 'Secret message 123!@#';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const ciphertext = await encryptAES(testKey, iv, plaintext);
      const decrypted = await decryptAES(testKey, iv, ciphertext);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext with different IVs', async () => {
      const plaintext = 'Same message';
      const iv1 = crypto.getRandomValues(new Uint8Array(12));
      const iv2 = crypto.getRandomValues(new Uint8Array(12));
      
      const cipher1 = await encryptAES(testKey, iv1, plaintext);
      const cipher2 = await encryptAES(testKey, iv2, plaintext);
      
      expect(new Uint8Array(cipher1)).not.toEqual(new Uint8Array(cipher2));
    });

    it('should fail to decrypt with wrong key', async () => {
      const plaintext = 'Protected data';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const wrongKey = await generateAESKey();
      
      const ciphertext = await encryptAES(testKey, iv, plaintext);
      
      await expect(decryptAES(wrongKey, iv, ciphertext)).rejects.toThrow();
    });

    it('should fail to decrypt with wrong IV', async () => {
      const plaintext = 'Protected data';
      const iv1 = crypto.getRandomValues(new Uint8Array(12));
      const iv2 = crypto.getRandomValues(new Uint8Array(12));
      
      const ciphertext = await encryptAES(testKey, iv1, plaintext);
      
      await expect(decryptAES(testKey, iv2, ciphertext)).rejects.toThrow();
    });
  });

  describe('deriveKey', () => {
    it('should derive a CryptoKey from passphrase and salt', async () => {
      const passphrase = 'my-secure-passphrase';
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      const key = await deriveKey(passphrase, salt);
      
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toEqual({
        name: 'AES-GCM',
        length: 256
      });
    });

    it('should derive the same key from same passphrase and salt', async () => {
      const passphrase = 'consistent-passphrase';
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      
      const key1 = await deriveKey(passphrase, salt);
      const key2 = await deriveKey(passphrase, salt);
      
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
    });

    it('should derive different keys from different passphrases', async () => {
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      
      const key1 = await deriveKey('passphrase-one', salt);
      const key2 = await deriveKey('passphrase-two', salt);
      
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
    });
  });

  describe('exportKey and importKey', () => {
    it('should export a key to JWK format', async () => {
      const key = await generateAESKey();
      
      const jwk = await exportKey(key);
      
      expect(jwk).toBeDefined();
      expect(jwk.kty).toBe('oct');
      expect(jwk.k).toBeDefined();
      expect(jwk.alg).toBe('A256GCM');
      expect(jwk.key_ops).toContain('encrypt');
      expect(jwk.key_ops).toContain('decrypt');
    });

    it('should import a JWK back to a CryptoKey', async () => {
      const originalKey = await generateAESKey();
      
      const jwk = await exportKey(originalKey);
      const importedKey = await importKey(jwk);
      
      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('secret');
      expect(importedKey.algorithm).toEqual({
        name: 'AES-GCM',
        length: 256
      });
    });

    it('should encrypt/decrypt with exported and re-imported key', async () => {
      const originalKey = await generateAESKey();
      const plaintext = 'Roundtrip test data';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const ciphertext = await encryptAES(originalKey, iv, plaintext);
      
      const jwk = await exportKey(originalKey);
      const importedKey = await importKey(jwk);
      
      const decrypted = await decryptAES(importedKey, iv, ciphertext);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('storeKeyInDB and loadKeyFromDB', () => {
    it('should store and load a key from IndexedDB', async () => {
      const key = await generateAESKey();
      const keyName = `test-key-${Date.now()}`;
      
      await storeKeyInDB(keyName, key);
      const loadedKey = await loadKeyFromDB(keyName);
      
      expect(loadedKey).toBeDefined();
      expect(loadedKey!.type).toBe('secret');
      
      // Verify the loaded key works for encryption
      const plaintext = 'IndexedDB roundtrip';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await encryptAES(key, iv, plaintext);
      const decrypted = await decryptAES(loadedKey!, iv, ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should return null for non-existent key', async () => {
      const loadedKey = await loadKeyFromDB('non-existent-key-12345');
      expect(loadedKey).toBeNull();
    });

    it('should overwrite existing key with same name', async () => {
      const key1 = await generateAESKey();
      const key2 = await generateAESKey();
      const keyName = `overwrite-test-${Date.now()}`;
      
      await storeKeyInDB(keyName, key1);
      await storeKeyInDB(keyName, key2);
      
      const loadedKey = await loadKeyFromDB(keyName);
      expect(loadedKey).toBeDefined();
      
      // Verify it's the second key
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      const rawLoaded = await crypto.subtle.exportKey('raw', loadedKey!);
      
      expect(new Uint8Array(rawLoaded)).toEqual(new Uint8Array(raw2));
      expect(new Uint8Array(rawLoaded)).not.toEqual(new Uint8Array(raw1));
    });
  });
});
