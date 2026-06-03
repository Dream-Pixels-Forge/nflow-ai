/**
 * Security: Secret Manager
 * 
 * Implements secure API key storage with rotation and audit logging.
 * Based on Google ADK Security Deep Dive from Obsidian vault.
 */

export type SecretType = 'api-key' | 'token' | 'password' | 'certificate' | 'custom';
export type SecretStatus = 'active' | 'rotating' | 'expired' | 'revoked';

export interface Secret {
  id: string;
  name: string;
  type: SecretType;
  status: SecretStatus;
  
  // Secret value (encrypted in production)
  value: string;
  
  // Metadata
  description?: string;
  tags: string[];
  
  // Rotation
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  lastRotatedAt?: string;
  rotationIntervalMs?: number;
  
  // Access control
  createdBy: string;
  accessCount: number;
  lastAccessedBy?: string;
  lastAccessedAt?: string;
  
  // Audit
  accessLog: Array<{
    timestamp: string;
    accessedBy: string;
    action: 'read' | 'rotate' | 'revoke' | 'create';
  }>;
}

export interface SecretManagerConfig {
  enabled: boolean;
  defaultRotationIntervalMs: number;
  maxSecretAge: number;
  requireDescription: boolean;
  auditAllAccess: boolean;
  encryptionEnabled: boolean;
}

const DEFAULT_CONFIG: SecretManagerConfig = {
  enabled: true,
  defaultRotationIntervalMs: 90 * 24 * 60 * 60 * 1000, // 90 days
  maxSecretAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  requireDescription: false,
  auditAllAccess: true,
  encryptionEnabled: false // In production, use proper encryption
};

/**
 * Secret Manager - Secure credential storage
 */
export class SecretManager {
  private secrets: Map<string, Secret> = new Map();
  private config: SecretManagerConfig;

  constructor(config: Partial<SecretManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new secret
   */
  createSecret(
    name: string,
    type: SecretType,
    value: string,
    options?: {
      description?: string;
      tags?: string[];
      expiresAt?: string;
      rotationIntervalMs?: number;
      createdBy?: string;
    }
  ): Secret {
    // Check if secret already exists
    if (Array.from(this.secrets.values()).some(s => s.name === name)) {
      throw new Error(`Secret with name '${name}' already exists`);
    }

    const secret: Secret = {
      id: `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      status: 'active',
      value: this.config.encryptionEnabled ? this.encrypt(value) : value,
      description: options?.description,
      tags: options?.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: options?.expiresAt,
      lastRotatedAt: new Date().toISOString(),
      rotationIntervalMs: options?.rotationIntervalMs || this.config.defaultRotationIntervalMs,
      createdBy: options?.createdBy || 'system',
      accessCount: 0,
      accessLog: []
    };

    this.secrets.set(secret.id, secret);
    this.logAccess(secret.id, 'system', 'create');

    return secret;
  }

  /**
   * Get a secret value
   */
  getSecret(secretId: string, accessedBy: string): string | null {
    const secret = this.secrets.get(secretId);
    if (!secret) return null;

    // Check if expired
    if (secret.expiresAt && new Date(secret.expiresAt) < new Date()) {
      secret.status = 'expired';
      return null;
    }

    // Update access info
    secret.accessCount++;
    secret.lastAccessedBy = accessedBy;
    secret.lastAccessedAt = new Date().toISOString();

    // Log access
    this.logAccess(secretId, accessedBy, 'read');

    return this.config.encryptionEnabled ? this.decrypt(secret.value) : secret.value;
  }

  /**
   * Get secret by name
   */
  getSecretByName(name: string, accessedBy: string): Secret | undefined {
    const secret = Array.from(this.secrets.values()).find(s => s.name === name);
    if (secret) {
      // Update access
      secret.accessCount++;
      secret.lastAccessedBy = accessedBy;
      secret.lastAccessedAt = new Date().toISOString();
      this.logAccess(secret.id, accessedBy, 'read');
    }
    return secret;
  }

  /**
   * Rotate a secret
   */
  rotateSecret(secretId: string, newValue: string, rotatedBy: string): Secret | null {
    const secret = this.secrets.get(secretId);
    if (!secret) return null;

    secret.status = 'rotating';
    secret.value = this.config.encryptionEnabled ? this.encrypt(newValue) : newValue;
    secret.status = 'active';
    secret.lastRotatedAt = new Date().toISOString();
    secret.updatedAt = new Date().toISOString();

    // Log rotation
    this.logAccess(secretId, rotatedBy, 'rotate');

    return secret;
  }

  /**
   * Revoke a secret
   */
  revokeSecret(secretId: string, revokedBy: string): boolean {
    const secret = this.secrets.get(secretId);
    if (!secret) return false;

    secret.status = 'revoked';
    secret.updatedAt = new Date().toISOString();

    // Log revocation
    this.logAccess(secretId, revokedBy, 'revoke');

    return true;
  }

  /**
   * Delete a secret
   */
  deleteSecret(secretId: string): boolean {
    return this.secrets.delete(secretId);
  }

  /**
   * Get all secrets (without values)
   */
  listSecrets(): Omit<Secret, 'value' | 'accessLog'>[] {
    return Array.from(this.secrets.values()).map(s => {
      const { value, accessLog, ...rest } = s;
      return rest;
    });
  }

  /**
   * Get secrets by type
   */
  getSecretsByType(type: SecretType): Omit<Secret, 'value' | 'accessLog'>[] {
    return this.listSecrets().filter(s => s.type === type);
  }

  /**
   * Get secrets by status
   */
  getSecretsByStatus(status: SecretStatus): Omit<Secret, 'value' | 'accessLog'>[] {
    return this.listSecrets().filter(s => s.status === status);
  }

  /**
   * Get expiring secrets
   */
  getExpiringSecrets(withinMs: number = 30 * 24 * 60 * 60 * 1000): Omit<Secret, 'value' | 'accessLog'>[] {
    const cutoff = Date.now() + withinMs;
    return this.listSecrets().filter(s => 
      s.expiresAt && new Date(s.expiresAt).getTime() < cutoff
    );
  }

  /**
   * Check if secret needs rotation
   */
  needsRotation(secretId: string): boolean {
    const secret = this.secrets.get(secretId);
    if (!secret || !secret.rotationIntervalMs || !secret.lastRotatedAt) {
      return false;
    }

    const lastRotated = new Date(secret.lastRotatedAt).getTime();
    return Date.now() - lastRotated > secret.rotationIntervalMs;
  }

  /**
   * Get secrets needing rotation
   */
  getSecretsNeedingRotation(): Omit<Secret, 'value' | 'accessLog'>[] {
    return this.listSecrets().filter(s => this.needsRotation(s.id));
  }

  /**
   * Get access log for a secret
   */
  getAccessLog(secretId: string): Secret['accessLog'] {
    const secret = this.secrets.get(secretId);
    return secret?.accessLog || [];
  }

  /**
   * Log access to a secret
   */
  private logAccess(secretId: string, accessedBy: string, action: 'read' | 'rotate' | 'revoke' | 'create'): void {
    const secret = this.secrets.get(secretId);
    if (!secret) return;

    secret.accessLog.push({
      timestamp: new Date().toISOString(),
      accessedBy,
      action
    });

    // Keep only last 100 access logs
    if (secret.accessLog.length > 100) {
      secret.accessLog = secret.accessLog.slice(-100);
    }
  }

  /**
   * Encrypt secret value (placeholder - use proper encryption in production)
   */
  private encrypt(value: string): string {
    // In production, use AES-256 or similar
    return `encrypted:${Buffer.from(value).toString('base64')}`;
  }

  /**
   * Decrypt secret value (placeholder - use proper decryption in production)
   */
  private decrypt(encryptedValue: string): string {
    // In production, use proper decryption
    if (encryptedValue.startsWith('encrypted:')) {
      return Buffer.from(encryptedValue.slice(10), 'base64').toString();
    }
    return encryptedValue;
  }

  /**
   * Get Secret Manager stats
   */
  getStats(): {
    totalSecrets: number;
    byType: Record<SecretType, number>;
    byStatus: Record<SecretStatus, number>;
    expiringSoon: number;
    needingRotation: number;
    totalAccesses: number;
  } {
    const secrets = Array.from(this.secrets.values());

    const byType: Record<SecretType, number> = {
      'api-key': 0,
      'token': 0,
      'password': 0,
      'certificate': 0,
      'custom': 0
    };

    const byStatus: Record<SecretStatus, number> = {
      active: 0,
      rotating: 0,
      expired: 0,
      revoked: 0
    };

    secrets.forEach(s => {
      byType[s.type]++;
      byStatus[s.status]++;
    });

    const expiringSoon = this.getExpiringSecrets().length;
    const needingRotation = this.getSecretsNeedingRotation().length;
    const totalAccesses = secrets.reduce((sum, s) => sum + s.accessCount, 0);

    return {
      totalSecrets: secrets.length,
      byType,
      byStatus,
      expiringSoon,
      needingRotation,
      totalAccesses
    };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<SecretManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): SecretManagerConfig {
    return { ...this.config };
  }

  /**
   * Clear all secrets
   */
  clear(): void {
    this.secrets.clear();
  }
}

// Singleton instance
export const secretManager = new SecretManager();
