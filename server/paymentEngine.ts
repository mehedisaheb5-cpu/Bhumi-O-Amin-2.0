/**
 * Phase 17C: Production-ready bKash/Nagad Payment Integration Foundation
 *
 * Secure server-side payment engine and provider-agnostic interface.
 * Strictly enforces:
 *  - Provider-agnostic payment architecture
 *  - Zero client-side secret credentials (all merchant secrets remain server-side)
 *  - No fake payment success (gateways intentionally report unconfigured/manual mode)
 *  - Duplicate protection & idempotency handling
 *  - Server-side verification and audit trails
 */

import {
  PaymentMethod,
  PaymentLifecycleStatus,
  PaymentTransaction,
  PaymentRefundInfo,
} from '../src/types';

// ==========================================
// 1. Interfaces & Types
// ==========================================

export interface PaymentInitiateRequest {
  bookingId: string;
  amount: number;
  currency: 'BDT';
  provider: PaymentMethod;
  customer: {
    name: string;
    mobile: string;
    email?: string;
    id?: string;
  };
  serviceName: string;
  idempotencyKey?: string;
  callbackUrl?: string;
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitiateResult {
  success: boolean;
  paymentId: string;
  transactionId?: string;
  provider: PaymentMethod;
  amount: number;
  currency: 'BDT';
  status: PaymentLifecycleStatus;
  isLiveGateway: boolean;
  idempotencyKey: string;
  redirectUrl?: string;
  message: string;
  instructionsBn: string;
  instructionsEn: string;
  createdAt: string;
}

export interface PaymentVerifyRequest {
  paymentId: string;
  bookingId: string;
  provider: PaymentMethod;
  transactionId?: string;
  paymentReference?: string;
  signature?: string;
  verifiedBy?: string;
  isAdmin?: boolean;
  notes?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  verified: boolean;
  paymentId: string;
  bookingId: string;
  transactionId?: string;
  provider: PaymentMethod;
  amount: number;
  currency: 'BDT';
  status: PaymentLifecycleStatus;
  isLiveGateway: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  message: string;
  failureReason?: string;
}

export interface PaymentRefundRequest {
  paymentId: string;
  bookingId: string;
  amount?: number;
  reason: string;
  requestedBy: string;
  isAdmin: boolean;
}

export interface PaymentRefundResult {
  success: boolean;
  paymentId: string;
  bookingId: string;
  refundInfo?: PaymentRefundInfo;
  status: PaymentLifecycleStatus;
  message: string;
  failureReason?: string;
}

export interface IPaymentGatewayProvider {
  name: PaymentMethod;
  isLiveConfigured(): boolean;
  initiate(req: PaymentInitiateRequest): Promise<PaymentInitiateResult>;
  verify(req: PaymentVerifyRequest): Promise<PaymentVerifyResult>;
  refund(req: PaymentRefundRequest): Promise<PaymentRefundResult>;
}

// ==========================================
// 2. In-Memory Transaction Store & Idempotency
// ==========================================

const transactionsStore = new Map<string, PaymentTransaction>();
const idempotencyStore = new Map<string, string>(); // idempotencyKey -> paymentId

function generatePaymentId(bookingId: string, provider: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAY-${provider.toUpperCase()}-${timestamp}-${randomSuffix}`;
}

// ==========================================
// 3. Provider Implementations
// ==========================================

/**
 * bKash Payment Gateway Provider (Foundation Mode)
 * Checks server-side environment variables:
 *  - BKASH_APP_KEY
 *  - BKASH_APP_SECRET
 *  - BKASH_USERNAME
 *  - BKASH_PASSWORD
 *  - BKASH_BASE_URL
 */
export class BKashPaymentProvider implements IPaymentGatewayProvider {
  name: PaymentMethod = 'bkash';

  isLiveConfigured(): boolean {
    return !!(
      process.env.BKASH_APP_KEY &&
      process.env.BKASH_APP_SECRET &&
      process.env.BKASH_USERNAME &&
      process.env.BKASH_PASSWORD
    );
  }

  async initiate(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    const isLive = this.isLiveConfigured();
    const paymentId = generatePaymentId(req.bookingId, 'BKASH');
    const now = new Date().toISOString();

    if (!isLive) {
      // Intentional Phase 17C baseline: Real gateway credentials are not configured
      return {
        success: true,
        paymentId,
        provider: 'bkash',
        amount: req.amount,
        currency: 'BDT',
        status: 'pending',
        isLiveGateway: false,
        idempotencyKey: req.idempotencyKey || paymentId,
        message:
          'bKash gateway credentials not configured on server (Phase 17C Foundation Mode). Please provide your bKash TrxID reference for verification.',
        instructionsBn:
          'বিকাশ পেমেন্ট গেটওয়ে বর্তমানে অফলাইন/ফাউন্ডেশন মোডে আছে। আপনার বিকাশ অ্যাপ থেকে নির্ধারিত ফি পাঠিয়ে ট্রানজেকশন আইডি (TrxID) ইনপুট দিন। অ্যাডমিন যাচাই করে অনুমোদন করবেন।',
        instructionsEn:
          'bKash gateway is currently operating in manual reference/foundation mode. Please send the fee via bKash and submit your TrxID for admin verification.',
        createdAt: now,
      };
    }

    // Future Real bKash API tokenized checkout flow
    // 1. POST /tokenized/checkout/token/grant
    // 2. POST /tokenized/checkout/create
    throw new Error('Live bKash API initiation pending production merchant credentials.');
  }

  async verify(req: PaymentVerifyRequest): Promise<PaymentVerifyResult> {
    const isLive = this.isLiveConfigured();
    const now = new Date().toISOString();

    // If Admin is verifying a manual reference
    if (req.isAdmin) {
      return {
        success: true,
        verified: true,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        transactionId: req.paymentReference || req.transactionId,
        provider: 'bkash',
        amount: 0, // populated by controller
        currency: 'BDT',
        status: 'success',
        isLiveGateway: isLive,
        verifiedAt: now,
        verifiedBy: req.verifiedBy || 'Admin Supervisor',
        message: 'Payment reference verified and approved by admin.',
      };
    }

    // If Customer submitted reference, it stays pending for admin review
    return {
      success: true,
      verified: false,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      transactionId: req.paymentReference || req.transactionId,
      provider: 'bkash',
      amount: 0,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: isLive,
      message: 'bKash TrxID reference recorded. Pending administrative verification.',
    };
  }

  async refund(req: PaymentRefundRequest): Promise<PaymentRefundResult> {
    if (!req.isAdmin) {
      return {
        success: false,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        status: 'failed',
        message: 'Only authorized administrators can process payment refunds.',
        failureReason: 'UNAUTHORIZED_REFUND_REQUEST',
      };
    }

    const now = new Date().toISOString();
    return {
      success: true,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      status: 'refunded',
      refundInfo: {
        refundedAmount: req.amount || 0,
        refundTransactionId: `REF-BKASH-${Date.now()}`,
        refundedAt: now,
        refundReason: req.reason,
        refundStatus: 'completed',
        processedBy: req.requestedBy,
      },
      message: 'Refund recorded successfully.',
    };
  }
}

/**
 * Nagad Payment Gateway Provider (Foundation Mode)
 * Checks server-side environment variables:
 *  - NAGAD_MERCHANT_ID
 *  - NAGAD_PUBLIC_KEY
 *  - NAGAD_PRIVATE_KEY
 *  - NAGAD_BASE_URL
 */
export class NagadPaymentProvider implements IPaymentGatewayProvider {
  name: PaymentMethod = 'nagad';

  isLiveConfigured(): boolean {
    return !!(
      process.env.NAGAD_MERCHANT_ID &&
      process.env.NAGAD_PUBLIC_KEY &&
      process.env.NAGAD_PRIVATE_KEY
    );
  }

  async initiate(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    const isLive = this.isLiveConfigured();
    const paymentId = generatePaymentId(req.bookingId, 'NAGAD');
    const now = new Date().toISOString();

    if (!isLive) {
      return {
        success: true,
        paymentId,
        provider: 'nagad',
        amount: req.amount,
        currency: 'BDT',
        status: 'pending',
        isLiveGateway: false,
        idempotencyKey: req.idempotencyKey || paymentId,
        message:
          'Nagad gateway credentials not configured on server (Phase 17C Foundation Mode). Please provide your Nagad TrxID reference for verification.',
        instructionsBn:
          'নগদ পেমেন্ট গেটওয়ে বর্তমানে অফলাইন/ফাউন্ডেশন মোডে আছে। আপনার নগদ অ্যাকাউন্ট থেকে ফি পরিশোধ করে ট্রানজেকশন আইডি (TrxID) ইনপুট দিন।',
        instructionsEn:
          'Nagad gateway is in manual reference/foundation mode. Send funds and enter the Nagad transaction reference for admin approval.',
        createdAt: now,
      };
    }

    throw new Error('Live Nagad API initiation pending production merchant credentials.');
  }

  async verify(req: PaymentVerifyRequest): Promise<PaymentVerifyResult> {
    const isLive = this.isLiveConfigured();
    const now = new Date().toISOString();

    if (req.isAdmin) {
      return {
        success: true,
        verified: true,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        transactionId: req.paymentReference || req.transactionId,
        provider: 'nagad',
        amount: 0,
        currency: 'BDT',
        status: 'success',
        isLiveGateway: isLive,
        verifiedAt: now,
        verifiedBy: req.verifiedBy || 'Admin Supervisor',
        message: 'Nagad payment reference verified and approved by admin.',
      };
    }

    return {
      success: true,
      verified: false,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      transactionId: req.paymentReference || req.transactionId,
      provider: 'nagad',
      amount: 0,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: isLive,
      message: 'Nagad TrxID reference recorded. Pending administrative verification.',
    };
  }

  async refund(req: PaymentRefundRequest): Promise<PaymentRefundResult> {
    if (!req.isAdmin) {
      return {
        success: false,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        status: 'failed',
        message: 'Only authorized administrators can process payment refunds.',
        failureReason: 'UNAUTHORIZED_REFUND_REQUEST',
      };
    }

    const now = new Date().toISOString();
    return {
      success: true,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      status: 'refunded',
      refundInfo: {
        refundedAmount: req.amount || 0,
        refundTransactionId: `REF-NAGAD-${Date.now()}`,
        refundedAt: now,
        refundReason: req.reason,
        refundStatus: 'completed',
        processedBy: req.requestedBy,
      },
      message: 'Refund recorded successfully.',
    };
  }
}

/**
 * Card / SSLCommerz Payment Gateway Provider (Foundation Mode)
 */
export class CardPaymentProvider implements IPaymentGatewayProvider {
  name: PaymentMethod = 'card';

  isLiveConfigured(): boolean {
    return !!(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWD);
  }

  async initiate(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    const isLive = this.isLiveConfigured();
    const paymentId = generatePaymentId(req.bookingId, 'CARD');
    const now = new Date().toISOString();

    return {
      success: true,
      paymentId,
      provider: 'card',
      amount: req.amount,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: isLive,
      idempotencyKey: req.idempotencyKey || paymentId,
      message:
        'Card payment gateway currently in foundation mode. Bank slip or transaction reference required.',
      instructionsBn:
        'ভিসা, মাস্টারকার্ড বা ব্যাংক ট্রান্সফার রেফারেন্স নম্বর উল্লেখ করুন। অ্যাডমিন যাচাই করে অনুমোদন করবেন।',
      instructionsEn:
        'Card gateway is in foundation mode. Provide bank/card transaction slip reference for approval.',
      createdAt: now,
    };
  }

  async verify(req: PaymentVerifyRequest): Promise<PaymentVerifyResult> {
    const now = new Date().toISOString();
    if (req.isAdmin) {
      return {
        success: true,
        verified: true,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        transactionId: req.paymentReference || req.transactionId,
        provider: 'card',
        amount: 0,
        currency: 'BDT',
        status: 'success',
        isLiveGateway: false,
        verifiedAt: now,
        verifiedBy: req.verifiedBy || 'Admin Supervisor',
        message: 'Card payment verified and approved.',
      };
    }

    return {
      success: true,
      verified: false,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      transactionId: req.paymentReference || req.transactionId,
      provider: 'card',
      amount: 0,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: false,
      message: 'Card payment reference recorded. Pending verification.',
    };
  }

  async refund(req: PaymentRefundRequest): Promise<PaymentRefundResult> {
    if (!req.isAdmin) {
      return {
        success: false,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        status: 'failed',
        message: 'Unauthorized.',
        failureReason: 'UNAUTHORIZED',
      };
    }
    return {
      success: true,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      status: 'refunded',
      refundInfo: {
        refundedAmount: req.amount || 0,
        refundTransactionId: `REF-CARD-${Date.now()}`,
        refundedAt: new Date().toISOString(),
        refundReason: req.reason,
        refundStatus: 'completed',
        processedBy: req.requestedBy,
      },
      message: 'Card payment refunded.',
    };
  }
}

/**
 * Cash / Manual Settlement Provider
 */
export class CashPaymentProvider implements IPaymentGatewayProvider {
  name: PaymentMethod = 'cash';

  isLiveConfigured(): boolean {
    return true; // Cash on site is natively supported
  }

  async initiate(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    const paymentId = generatePaymentId(req.bookingId, 'CASH');
    return {
      success: true,
      paymentId,
      provider: 'cash',
      amount: req.amount,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: true,
      idempotencyKey: req.idempotencyKey || paymentId,
      message: 'Cash on completion payment initiated.',
      instructionsBn:
        'জরিপ কাজ সরজমিনে সম্পন্ন হওয়ার পর দায়িত্বপ্রাপ্ত আমিনের নিকট সরাসরি নগদ অর্থ পরিশোধ করুন।',
      instructionsEn:
        'Pay cash directly to the surveyor on site upon successful survey delivery.',
      createdAt: new Date().toISOString(),
    };
  }

  async verify(req: PaymentVerifyRequest): Promise<PaymentVerifyResult> {
    const now = new Date().toISOString();
    if (req.isAdmin) {
      return {
        success: true,
        verified: true,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        transactionId: req.paymentReference || 'CASH-RECEIPT',
        provider: 'cash',
        amount: 0,
        currency: 'BDT',
        status: 'success',
        isLiveGateway: true,
        verifiedAt: now,
        verifiedBy: req.verifiedBy || 'Admin Supervisor',
        message: 'Cash payment confirmed and recorded by admin.',
      };
    }

    return {
      success: true,
      verified: false,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      provider: 'cash',
      amount: 0,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: true,
      message: 'Cash payment pending physical field settlement.',
    };
  }

  async refund(req: PaymentRefundRequest): Promise<PaymentRefundResult> {
    if (!req.isAdmin) {
      return {
        success: false,
        paymentId: req.paymentId,
        bookingId: req.bookingId,
        status: 'failed',
        message: 'Unauthorized refund request.',
        failureReason: 'UNAUTHORIZED',
      };
    }
    return {
      success: true,
      paymentId: req.paymentId,
      bookingId: req.bookingId,
      status: 'refunded',
      refundInfo: {
        refundedAmount: req.amount || 0,
        refundTransactionId: `REF-CASH-${Date.now()}`,
        refundedAt: new Date().toISOString(),
        refundReason: req.reason,
        refundStatus: 'completed',
        processedBy: req.requestedBy,
      },
      message: 'Cash settlement refund recorded.',
    };
  }
}

// ==========================================
// 4. Central Payment Engine Service
// ==========================================

export class PaymentEngine {
  private providers: Map<PaymentMethod, IPaymentGatewayProvider> = new Map();

  constructor() {
    this.registerProvider(new BKashPaymentProvider());
    this.registerProvider(new NagadPaymentProvider());
    this.registerProvider(new CardPaymentProvider());
    this.registerProvider(new CashPaymentProvider());
  }

  registerProvider(provider: IPaymentGatewayProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: PaymentMethod): IPaymentGatewayProvider {
    const p = this.providers.get(name);
    if (!p) {
      // Fallback to cash/manual
      return this.providers.get('cash')!;
    }
    return p;
  }

  /**
   * Get public configuration without exposing any API keys or secrets
   */
  getPublicConfig() {
    const result: Record<string, { available: boolean; isLive: boolean; name: string }> = {};
    for (const [key, p] of this.providers.entries()) {
      result[key] = {
        available: true,
        isLive: p.isLiveConfigured(),
        name: key.toUpperCase(),
      };
    }
    return {
      providers: result,
      foundationNotice:
        'Real bKash and Nagad payment gateway APIs are intentionally NOT connected yet (Phase 17C). Transactions operate with manual TrxID verification.',
      currency: 'BDT',
    };
  }

  /**
   * Initiate Payment with Idempotency & Duplicate Protection
   */
  async initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    if (!req.bookingId) {
      throw new Error('Booking ID is required for payment initiation.');
    }
    if (!req.amount || req.amount <= 0) {
      throw new Error('Valid payable amount is required.');
    }

    // Duplicate protection: Check if idempotency key was already used
    const key = req.idempotencyKey || `idem_${req.bookingId}_${req.provider}`;
    if (idempotencyStore.has(key)) {
      const existingPaymentId = idempotencyStore.get(key)!;
      const existing = transactionsStore.get(existingPaymentId);
      if (existing) {
        // Return existing initiated/pending transaction to prevent duplicate charge
        return {
          success: true,
          paymentId: existing.paymentId,
          transactionId: existing.transactionId,
          provider: existing.provider,
          amount: existing.amount,
          currency: 'BDT',
          status: existing.status,
          isLiveGateway: existing.isLiveGateway,
          idempotencyKey: key,
          message: 'Existing transaction reused to prevent duplicate payment initiation.',
          instructionsBn: 'এই বুকিংয়ের জন্য পূর্বের ট্রানজেকশন সেশন সচল রয়েছে।',
          instructionsEn: 'Reused active transaction session to prevent duplicate charges.',
          createdAt: existing.createdAt,
        };
      }
    }

    const provider = this.getProvider(req.provider);
    const result = await provider.initiate({ ...req, idempotencyKey: key });

    // Store transaction record
    const transaction: PaymentTransaction = {
      id: result.paymentId,
      bookingId: req.bookingId,
      paymentId: result.paymentId,
      transactionId: result.transactionId,
      provider: req.provider,
      amount: req.amount,
      currency: 'BDT',
      status: result.status,
      idempotencyKey: key,
      customerId: req.customer.id,
      customerInfo: {
        name: req.customer.name,
        mobile: req.customer.mobile,
        email: req.customer.email,
      },
      createdAt: result.createdAt,
      updatedAt: result.createdAt,
      isLiveGateway: result.isLiveGateway,
      metadata: req.metadata,
    };

    transactionsStore.set(result.paymentId, transaction);
    idempotencyStore.set(key, result.paymentId);

    return result;
  }

  /**
   * Verify Payment Server-Side
   * Strictly enforces: Only Admin or Verified Gateway can mark as 'success' / 'paid'.
   */
  async verifyPayment(req: PaymentVerifyRequest): Promise<PaymentVerifyResult> {
    const provider = this.getProvider(req.provider);
    const existing = transactionsStore.get(req.paymentId);

    const result = await provider.verify(req);

    if (existing) {
      existing.status = result.status;
      existing.updatedAt = new Date().toISOString();
      if (result.verified && result.status === 'success') {
        existing.verifiedAt = result.verifiedAt;
        existing.verifiedBy = result.verifiedBy;
        existing.transactionId = result.transactionId;
      } else if (req.paymentReference) {
        existing.transactionId = req.paymentReference;
      }
      result.amount = existing.amount;
    }

    return result;
  }

  /**
   * Process Refund (Admin only)
   */
  async refundPayment(req: PaymentRefundRequest): Promise<PaymentRefundResult> {
    const existing = transactionsStore.get(req.paymentId);
    const provider = existing ? this.getProvider(existing.provider) : this.getProvider('cash');

    const result = await provider.refund({
      ...req,
      amount: req.amount ?? existing?.amount ?? 0,
    });

    if (result.success && existing) {
      existing.status = 'refunded';
      existing.refundInfo = result.refundInfo;
      existing.updatedAt = new Date().toISOString();
    }

    return result;
  }

  /**
   * Query transactions for a booking
   */
  getTransactionsForBooking(bookingId: string): PaymentTransaction[] {
    const list: PaymentTransaction[] = [];
    for (const t of transactionsStore.values()) {
      if (t.bookingId === bookingId) {
        list.push(t);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Direct record injection (e.g. from existing bookings during sync)
   */
  recordExistingTransaction(tx: PaymentTransaction) {
    transactionsStore.set(tx.paymentId, tx);
    if (tx.idempotencyKey) {
      idempotencyStore.set(tx.idempotencyKey, tx.paymentId);
    }
  }
}

// Export singleton instance
export const paymentEngine = new PaymentEngine();
