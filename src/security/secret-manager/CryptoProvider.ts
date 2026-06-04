/**
 * CryptoProvider - AES-256-GCM encryption using Web Crypto API
 * 
 * Browser-native encryption with no external dependencies.
 * Handles key generation, encryption, decryption, and key storage.
 */

const DB_NAME = 'nflow-secret-manager';
const DB_VERSION = 1;
const STORE_NAME = 'encryption-keys';

/**
 * Check if Web Crypto API is available
 */
function isWebCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Generate a new AES-256-GCM CryptoKey
 */
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param key - CryptoKey for encryption
 * @param iv - 12-byte initialization vector
 * @param plaintext - Text to encrypt
 * @returns ArrayBuffer containing ciphertext
 */
export async function encryptAES(
  key: CryptoKey,
  iv: Uint8Array,
  plaintext: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  return crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource
    },
    key,
    data
  );
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param key - CryptoKey for decryption
 * @param iv - 12-byte initialization vector
 * @param ciphertext - ArrayBuffer containing ciphertext
 * @returns Decrypted plaintext string
 */
export async function decryptAES(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: ArrayBuffer
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource
    },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Derive an AES-256-GCM key from a passphrase using PBKDF2
 * @param passphrase - Password to derive key from
 * @param salt - Salt for key derivation (16 bytes recommended)
 * @returns CryptoKey derived from passphrase
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passphraseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to JWK format
 * @param key - CryptoKey to export
 * @returns JsonWebKey in JWK format
 */
export async function exportKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

/**
 * Import a JWK back to a CryptoKey
 * @param jwk - JsonWebKey to import
 * @returns CryptoKey
 */
export async function importKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Store a CryptoKey in IndexedDB
 * @param keyName - Name/key for the stored key
 * @param key - CryptoKey to store
 */
export async function storeKeyInDB(
  keyName: string,
  key: CryptoKey
): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(key, keyName);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Load a CryptoKey from IndexedDB
 * @param keyName - Name/key of the stored key
 * @returns CryptoKey or null if not found
 */
export async function loadKeyFromDB(keyName: string): Promise<CryptoKey | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(keyName);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result || null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Check if Web Crypto is available, with fallback warning
 */
export function checkWebCryptoSupport(): boolean {
  if (!isWebCryptoAvailable()) {
    console.warn(
      '[CryptoProvider] Web Crypto API not available. ' +
      'Encryption will fall back to base64 encoding (not secure).'
    );
    return false;
  }
  return true;
}
