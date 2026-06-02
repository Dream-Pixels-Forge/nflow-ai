/**
 * Security: AP2 Protocol (Agent Payments)
 * 
 * Implements secure agent payment system with cryptographic mandates.
 * Based on AP2 Protocol from Obsidian vault.
 */

export type MandateType = 'intent' | 'cart' | 'payment';
export type MandateStatus = 'pending' | 'signed' | 'authorized' | 'revoked' | 'expired' | 'completed';
export type TransactionStatus = 'pending' | 'authorized' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface SpendingLimit {
  perTransaction?: number;
  daily?: number;
  weekly?: number;
  monthly?: number;
  currency: string;
}

export interface MerchantCategory {
  id: string;
  name: string;
  allowed: boolean;
  spendingLimit?: SpendingLimit;
}

export interface Mandate {
  id: string;
  type: MandateType;
  status: MandateStatus;
  
  // Intent Mandate fields
  userId?: string;
  spendingLimit?: SpendingLimit;
  merchantCategories?: MerchantCategory[];
  ttlMs?: number;
  expiresAt?: string;
  
  // Cart Mandate fields
  transactionId?: string;
  lineItems?: LineItem[];
  totalAmount?: number;
  shippingDestination?: string;
  
  // Payment Mandate fields
  paymentMethodId?: string;
  aiInitiated: boolean;
  
  // Cryptographic fields
  signature?: string;
  signedAt?: string;
  signedBy?: string;
  
  // Metadata
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  merchantId: string;
  category: string;
}

export interface Transaction {
  id: string;
  mandateId: string;
  status: TransactionStatus;
  
  // Transaction details
  amount: number;
  currency: string;
  merchantId: string;
  merchantName: string;
  description: string;
  
  // Agent info
  agentId: string;
  agentName: string;
  aiInitiated: boolean;
  
  // Payment info
  paymentMethodId?: string;
  paymentNetwork?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  authorizedAt?: string;
  completedAt?: string;
  failedAt?: string;
  
  // Error
  error?: string;
  errorCode?: string;
}

export interface MandateExchangeRequest {
  transactionId: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantName: string;
  lineItems: LineItem[];
  agentId: string;
  agentName: string;
}

export interface MandateExchangeResponse {
  success: boolean;
  mandate?: Mandate;
  transaction?: Transaction;
  requiresSignature: boolean;
  signatureUrl?: string;
  error?: string;
}

export interface AP2Config {
  enabled: boolean;
  requireSignature: boolean;
  maxTransactionAmount: number;
  maxDailySpend: number;
  allowAiInitiated: boolean;
  auditLog: boolean;
}

const DEFAULT_CONFIG: AP2Config = {
  enabled: true,
  requireSignature: true,
  maxTransactionAmount: 1000,
  maxDailySpend: 5000,
  allowAiInitiated: true,
  auditLog: true
};

/**
 * AP2 Protocol - Agent Payments System
 */
export class AP2Protocol {
  private mandates: Map<string, Mandate> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private config: AP2Config;
  private auditLog: Array<{
    timestamp: string;
    action: string;
    mandateId?: string;
    transactionId?: string;
    userId?: string;
    details: Record<string, any>;
  }> = [];

  constructor(config: Partial<AP2Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create Intent Mandate (Human-Not-Present)
   */
  createIntentMandate(
    userId: string,
    spendingLimit: SpendingLimit,
    merchantCategories: MerchantCategory[],
    ttlMs: number = 30 * 24 * 60 * 60 * 1000 // 30 days
  ): Mandate {
    const mandate: Mandate = {
      id: `mandate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'intent',
      status: 'pending',
      userId,
      spendingLimit,
      merchantCategories,
      ttlMs,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      aiInitiated: false,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.mandates.set(mandate.id, mandate);
    this.logAudit('create_intent_mandate', mandate.id, undefined, userId, { spendingLimit, merchantCategories });

    return mandate;
  }

  /**
   * Create Cart Mandate (Human-Present)
   */
  createCartMandate(
    intentMandateId: string,
    transactionId: string,
    lineItems: LineItem[],
    shippingDestination: string
  ): Mandate | null {
    const intentMandate = this.mandates.get(intentMandateId);
    if (!intentMandate || intentMandate.type !== 'intent') {
      return null;
    }

    // Validate spending limit
    const totalAmount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    if (intentMandate.spendingLimit?.perTransaction && totalAmount > intentMandate.spendingLimit.perTransaction) {
      console.error('[AP2] Transaction exceeds per-transaction spending limit');
      return null;
    }

    // Validate merchant categories
    for (const item of lineItems) {
      const category = intentMandate.merchantCategories?.find(c => c.id === item.category);
      if (category && !category.allowed) {
        console.error(`[AP2] Merchant category not allowed: ${item.category}`);
        return null;
      }
    }

    const mandate: Mandate = {
      id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'cart',
      status: 'pending',
      userId: intentMandate.userId,
      transactionId,
      lineItems,
      totalAmount,
      shippingDestination,
      aiInitiated: true,
      metadata: { intentMandateId },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.mandates.set(mandate.id, mandate);
    this.logAudit('create_cart_mandate', mandate.id, transactionId, intentMandate.userId, { totalAmount, lineItems: lineItems.length });

    return mandate;
  }

  /**
   * Create Payment Mandate
   */
  createPaymentMandate(
    cartMandateId: string,
    paymentMethodId: string,
    paymentNetwork: string
  ): Mandate | null {
    const cartMandate = this.mandates.get(cartMandateId);
    if (!cartMandate || cartMandate.type !== 'cart') {
      return null;
    }

    const mandate: Mandate = {
      id: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'payment',
      status: 'authorized',
      userId: cartMandate.userId,
      transactionId: cartMandate.transactionId,
      totalAmount: cartMandate.totalAmount,
      paymentMethodId,
      aiInitiated: true,
      metadata: { cartMandateId, paymentNetwork },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.mandates.set(mandate.id, mandate);
    this.logAudit('create_payment_mandate', mandate.id, cartMandate.transactionId, cartMandate.userId, { paymentNetwork });

    return mandate;
  }

  /**
   * Sign mandate (user biometric signature)
   */
  signMandate(mandateId: string, signature: string, signedBy: string): boolean {
    const mandate = this.mandates.get(mandateId);
    if (!mandate) return false;

    mandate.status = 'signed';
    mandate.signature = signature;
    mandate.signedAt = new Date().toISOString();
    mandate.signedBy = signedBy;
    mandate.updatedAt = new Date().toISOString();

    this.logAudit('sign_mandate', mandateId, mandate.transactionId, mandate.userId, { signedBy });

    return true;
  }

  /**
   * Revoke mandate
   */
  revokeMandate(mandateId: string, reason: string): boolean {
    const mandate = this.mandates.get(mandateId);
    if (!mandate) return false;

    mandate.status = 'revoked';
    mandate.metadata.revokedAt = new Date().toISOString();
    mandate.metadata.revocationReason = reason;
    mandate.updatedAt = new Date().toISOString();

    this.logAudit('revoke_mandate', mandateId, mandate.transactionId, mandate.userId, { reason });

    return true;
  }

  /**
   * Revoke all mandates for a user
   */
  revokeAllMandates(userId: string, reason: string): number {
    let revoked = 0;

    this.mandates.forEach((mandate) => {
      if (mandate.userId === userId && mandate.status !== 'revoked') {
        this.revokeMandate(mandate.id, reason);
        revoked++;
      }
    });

    return revoked;
  }

  /**
   * Process mandate exchange flow
   */
  async processMandateExchange(request: MandateExchangeRequest): Promise<MandateExchangeResponse> {
    if (!this.config.enabled) {
      return { success: false, requiresSignature: false, error: 'AP2 not enabled' };
    }

    // Check if AI-initiated is allowed
    if (!this.config.allowAiInitiated) {
      return { success: false, requiresSignature: false, error: 'AI-initiated transactions not allowed' };
    }

    // Check spending limit
    if (request.amount > this.config.maxTransactionAmount) {
      return { success: false, requiresSignature: false, error: 'Amount exceeds maximum transaction limit' };
    }

    // Create transaction
    const transaction: Transaction = {
      id: request.transactionId,
      mandateId: '',
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      merchantId: request.merchantId,
      merchantName: request.merchantName,
      description: request.lineItems.map(i => i.name).join(', '),
      agentId: request.agentId,
      agentName: request.agentName,
      aiInitiated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.transactions.set(transaction.id, transaction);

    // Create cart mandate
    const cartMandate = this.createCartMandate(
      '', // Will be linked later
      transaction.id,
      request.lineItems,
      ''
    );

    if (!cartMandate) {
      transaction.status = 'failed';
      transaction.error = 'Failed to create cart mandate';
      transaction.failedAt = new Date().toISOString();
      return { success: false, requiresSignature: false, error: 'Failed to create cart mandate' };
    }

    transaction.mandateId = cartMandate.id;

    // Check if signature is required
    if (this.config.requireSignature) {
      return {
        success: true,
        mandate: cartMandate,
        transaction,
        requiresSignature: true,
        signatureUrl: `/sign/${cartMandate.id}`
      };
    }

    // Auto-authorize if signature not required
    cartMandate.status = 'authorized';
    transaction.status = 'authorized';
    transaction.authorizedAt = new Date().toISOString();

    this.logAudit('auto_authorize', cartMandate.id, transaction.id, request.agentId, { amount: request.amount });

    return {
      success: true,
      mandate: cartMandate,
      transaction,
      requiresSignature: false
    };
  }

  /**
   * Complete transaction
   */
  completeTransaction(transactionId: string): Transaction | null {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;

    transaction.status = 'completed';
    transaction.completedAt = new Date().toISOString();
    transaction.updatedAt = new Date().toISOString();

    this.logAudit('complete_transaction', transaction.mandateId, transactionId, transaction.agentId, { amount: transaction.amount });

    return transaction;
  }

  /**
   * Fail transaction
   */
  failTransaction(transactionId: string, error: string, errorCode?: string): Transaction | null {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;

    transaction.status = 'failed';
    transaction.error = error;
    transaction.errorCode = errorCode;
    transaction.failedAt = new Date().toISOString();
    transaction.updatedAt = new Date().toISOString();

    this.logAudit('fail_transaction', transaction.mandateId, transactionId, transaction.agentId, { error, errorCode });

    return transaction;
  }

  /**
   * Get mandate by ID
   */
  getMandate(mandateId: string): Mandate | undefined {
    return this.mandates.get(mandateId);
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * Get active mandates for user
   */
  getActiveMandates(userId: string): Mandate[] {
    return Array.from(this.mandates.values()).filter(m => 
      m.userId === userId && 
      m.status !== 'revoked' && 
      m.status !== 'expired'
    );
  }

  /**
   * Get transactions for user
   */
  getUserTransactions(userId: string, limit: number = 10): Transaction[] {
    return Array.from(this.transactions.values())
      .filter(t => {
        const mandate = this.mandates.get(t.mandateId);
        return mandate?.userId === userId;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Log audit event
   */
  private logAudit(
    action: string,
    mandateId?: string,
    transactionId?: string,
    userId?: string,
    details: Record<string, any> = {}
  ): void {
    if (!this.config.auditLog) return;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      mandateId,
      transactionId,
      userId,
      details
    });
  }

  /**
   * Get audit log
   */
  getAuditLog(limit: number = 100): typeof this.auditLog {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get AP2 stats
   */
  getStats(): {
    totalMandates: number;
    mandatesByType: Record<MandateType, number>;
    mandatesByStatus: Record<MandateStatus, number>;
    totalTransactions: number;
    transactionsByStatus: Record<TransactionStatus, number>;
    totalVolume: number;
    averageTransactionAmount: number;
  } {
    const mandates = Array.from(this.mandates.values());
    const transactions = Array.from(this.transactions.values());

    const mandatesByType: Record<MandateType, number> = {
      intent: 0,
      cart: 0,
      payment: 0
    };

    const mandatesByStatus: Record<MandateStatus, number> = {
      pending: 0,
      signed: 0,
      authorized: 0,
      revoked: 0,
      expired: 0,
      completed: 0
    };

    const transactionsByStatus: Record<TransactionStatus, number> = {
      pending: 0,
      authorized: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      refunded: 0
    };

    mandates.forEach(m => {
      mandatesByType[m.type]++;
      mandatesByStatus[m.status]++;
    });

    transactions.forEach(t => {
      transactionsByStatus[t.status]++;
    });

    const totalVolume = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const completedTransactions = transactions.filter(t => t.status === 'completed');

    return {
      totalMandates: mandates.length,
      mandatesByType,
      mandatesByStatus,
      totalTransactions: transactions.length,
      transactionsByStatus,
      totalVolume,
      averageTransactionAmount: completedTransactions.length > 0 ? totalVolume / completedTransactions.length : 0
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.mandates.clear();
    this.transactions.clear();
    this.auditLog = [];
  }
}

// Singleton instance
export const ap2Protocol = new AP2Protocol();
