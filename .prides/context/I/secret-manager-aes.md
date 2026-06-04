# SecretManager AES-GCM Encryption

## Task
Replace the placeholder base64 encryption in `SecretManager` with real AES-256-GCM encryption using the Web Crypto API (browser-native, no dependencies).

## Existing Code
- `src/security/secret-manager/SecretManager.ts`: Has `encrypt()` and `decrypt()` methods that currently use `Buffer.from().toString('base64')` — not real encryption.

## Requirements
1. Replace `encrypt()` with AES-256-GCM using Web Crypto API:
   - Generate random 256-bit key on first use
   - Store key in IndexedDB (not localStorage for security)
   - Each encryption uses random 96-bit IV
   - Output: `iv:ciphertext` both base64-encoded
   - Key derivation: PBKDF2 from a master passphrase if provided, else random key

2. Replace `decrypt()` with matching AES-256-GCM decryption

3. Add key management:
   - `generateKey()`: create new AES-256 key
   - `exportKey()` / `importKey()`: serialize key for backup
   - `rotateKey()`: re-encrypt all secrets with new key

4. Update `encryptionEnabled` default to `true`

5. Keep the existing interface (`createSecret`, `getSecret`, etc.) unchanged

6. Add `src/security/secret-manager/CryptoProvider.ts`:
   - `generateAESKey()`: returns CryptoKey
   - `encryptAES(key, iv, plaintext)`: returns ArrayBuffer
   - `decryptAES(key, iv, ciphertext)`: returns string
   - `deriveKey(passphrase, salt)`: PBKDF2 key derivation

## Constraints
- Browser-only (Web Crypto API, not Node crypto)
- No npm dependencies
- Must handle key storage in IndexedDB
- Graceful fallback if Web Crypto unavailable (log warning, use base64)
