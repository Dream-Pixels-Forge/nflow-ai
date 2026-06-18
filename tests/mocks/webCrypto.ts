/**
 * Web Crypto API mock for jsdom test environments.
 * Supports key generation, raw/JWK export, deterministic deriveKey,
 * and encrypt/decrypt that verifies key identity and IV via key fingerprint.
 */

import { pbkdf2Sync, randomBytes } from 'node:crypto';

const keyStore = new Map<symbol, Uint8Array>();
const deriveCache = new Map<string, symbol>();
let keyId = 0;

function makeRaw(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

function makeKey(raw: Uint8Array, extractable: boolean, usages: KeyUsage[]): CryptoKey {
  const sym = Symbol(`k${++keyId}`);
  keyStore.set(sym, raw);
  return {
    type: 'secret', extractable,
    algorithm: { name: 'AES-GCM', length: 256 },
    usages,
    _sym: sym,
  } as unknown as CryptoKey;
}

function getRaw(key: CryptoKey): Uint8Array {
  const k = key as unknown as { _sym: symbol };
  const raw = keyStore.get(k._sym);
  if (!raw) throw new Error('Key not found');
  return raw;
}

/** Deterministic fingerprint of key bytes */
function keyFingerprint(raw: Uint8Array): Uint8Array {
  let h = 0;
  for (const b of raw) h = ((h << 5) - h + b) | 0;
  for (const b of raw) h = ((h << 3) + h + b) | 0;
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt.asIntN(64, BigInt(h)), false);
  return buf;
}

function checkKeyMatch(storedFingerprint: Uint8Array, key: CryptoKey): boolean {
  try {
    const raw = getRaw(key);
    const fp = keyFingerprint(raw);
    for (let i = 0; i < 8; i++) {
      if (fp[i] !== storedFingerprint[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function ivCheck(iv: Uint8Array): Uint8Array {
  let h = 0;
  for (const b of iv) h = ((h << 5) - h + b) | 0;
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setInt32(0, h, false);
  return buf;
}

export function createMockSubtle(): SubtleCrypto {
  return {
    async generateKey(
      _algorithm: Algorithm,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey | CryptoKeyPair> {
      return makeKey(makeRaw(), extractable, keyUsages);
    },

    async encrypt(
      algorithm: Algorithm,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const alg = algorithm as AesGcmParams;
      const iv = new Uint8Array(alg.iv as ArrayBuffer);
      const plain = new Uint8Array(data as ArrayBuffer);
      const fp = keyFingerprint(getRaw(key));
      // Format: [key_fingerprint(8)][iv_check(4)][plaintext]
      const out = new Uint8Array(8 + 4 + plain.length);
      out.set(fp, 0);
      out.set(ivCheck(iv), 8);
      out.set(plain, 12);
      return out.buffer;
    },

    async decrypt(
      algorithm: Algorithm,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const ciphertext = new Uint8Array(data as ArrayBuffer);
      if (ciphertext.length < 12) throw new Error('Decrypt error: malformed data');
      if (!checkKeyMatch(ciphertext.slice(0, 8), key)) {
        throw new Error('Decrypt error: key mismatch');
      }
      const alg = algorithm as AesGcmParams;
      const iv = new Uint8Array(alg.iv as ArrayBuffer);
      const storedIvCheck = ciphertext.slice(8, 12);
      const expectedIvCheck = ivCheck(iv);
      if (storedIvCheck[0] !== expectedIvCheck[0] || storedIvCheck[1] !== expectedIvCheck[1] ||
          storedIvCheck[2] !== expectedIvCheck[2] || storedIvCheck[3] !== expectedIvCheck[3]) {
        throw new Error('Decrypt error: IV mismatch');
      }
      return ciphertext.slice(12).buffer;
    },

    async exportKey(format: string, key: CryptoKey): Promise<ArrayBuffer | JsonWebKey> {
      const raw = getRaw(key);
      if (format === 'raw') return raw.slice().buffer;
      return {
        kty: 'oct', k: Buffer.from(raw).toString('base64url'),
        alg: 'A256GCM', ext: true,
        key_ops: ['encrypt', 'decrypt'],
      };
    },

    async importKey(
      _format: string,
      keyData: BufferSource | JsonWebKey,
      _algorithm: Algorithm,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey> {
      let raw: Uint8Array;
      if ('k' in (keyData as JsonWebKey)) {
        raw = new Uint8Array(Buffer.from((keyData as JsonWebKey).k ?? '', 'base64url'));
      } else {
        raw = new Uint8Array(keyData as ArrayBuffer);
      }
      return makeKey(raw, extractable, keyUsages);
    },

    async deriveKey(
      algorithm: Algorithm,
      baseKey: CryptoKey,
      _derivedKeyType: Algorithm,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey> {
      const alg = algorithm as Pbkdf2Params;
      const baseRaw = getRaw(baseKey);
      const salt = new Uint8Array(alg.salt as ArrayBuffer);
      const iterations = alg.iterations;
      const hashName = typeof alg.hash === 'string' ? alg.hash : (alg.hash as { name: string }).name;
      const cacheKey = `${[...baseRaw].join(',')}:${[...salt].join(',')}:${iterations}:${hashName}`;
      const cached = deriveCache.get(cacheKey);
      if (cached) {
        const raw = keyStore.get(cached);
        if (raw) return makeKey(raw, extractable, keyUsages);
      }
      const derived = pbkdf2Sync(baseRaw, salt, iterations, 32, hashName.replace('-', '').toLowerCase());
      const raw = new Uint8Array(derived);
      const sym = Symbol(`d${++keyId}`);
      keyStore.set(sym, raw);
      deriveCache.set(cacheKey, sym);
      return makeKey(raw, extractable, keyUsages);
    },

    async digest(): Promise<ArrayBuffer> {
      return new Uint8Array(32).buffer;
    },
  } as unknown as SubtleCrypto;
}
