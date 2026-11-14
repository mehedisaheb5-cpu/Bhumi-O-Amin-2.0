/**
 * Phase 17C: Client-Side Payment Gateway Integration Service
 *
 * Communicates with the secure server-side payment engine (/api/payments/*).
 * Never stores or transmits merchant secret keys.
 * Ensures:
 *  - Provider-agnostic payment lifecycle
 *  - Idempotency key tracking
 *  - Real server verification checking (no fake success)
 *  - Local fallback safety if network is offline
 */

import {
  PaymentMethod,
  PaymentLifecycleStatus,
  PaymentTransaction,
  PaymentRefundInfo,
  Language,
} from '../types';

export interface PaymentGatewayConfig {
  providers: Record<
    string,
    {
      available: boolean;
      isLive: boolean;
      name: string;
    }
  >;
  foundationNotice: string;
  currency: string;
}

export interface ClientPaymentInitiateParams {
  bookingId: string;
  amount: number;
  provider: PaymentMethod;
  customer: {
    name: string;
    mobile: string;
    email?: string;
    id?: string;
  };
  serviceName: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface ClientPaymentInitiateResponse {
  success: boolean;
  paymentId: string;
  transactionId?: string;
  provider: PaymentMethod;
  amount: number;
  currency: 'BDT';
  status: PaymentLifecycleStatus;
  isLiveGateway: boolean;
  idempotencyKey: string;
  message: string;
  instructionsBn: string;
  instructionsEn: string;
  createdAt: string;
}

export interface ClientPaymentVerifyParams {
  paymentId: string;
  bookingId: string;
  provider: PaymentMethod;
  paymentReference?: string;
  transactionId?: string;
  verifiedBy?: string;
  isAdmin?: boolean;
  notes?: string;
  idToken?: string;
}

export interface ClientPaymentVerifyResponse {
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
}

/**
 * Fetch public payment gateway configuration from server
 */
export async function fetchPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  try {
    const res = await fetch('/api/payments/config');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Unable to reach /api/payments/config, using default foundation config:', e);
  }

  // Safe fallback baseline
  return {
    providers: {
      bkash: { available: true, isLive: false, name: 'BKASH' },
      nagad: { available: true, isLive: false, name: 'NAGAD' },
      card: { available: true, isLive: false, name: 'CARD' },
      cash: { available: true, isLive: true, name: 'CASH' },
    },
    foundationNotice:
      'Real bKash and Nagad payment gateway APIs are intentionally NOT connected yet (Phase 17C). Transactions operate with manual TrxID verification.',
    currency: 'BDT',
  };
}

/**
 * Initiate a payment session server-side
 */
export async function initiatePaymentSession(
  params: ClientPaymentInitiateParams
): Promise<ClientPaymentInitiateResponse> {
  const idempotencyKey =
    params.idempotencyKey || `client_idem_${params.bookingId}_${params.provider}_${Date.now()}`;

  try {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, idempotencyKey }),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Payment initiation failed with status ${res.status}`);
  } catch (error) {
    console.warn('Server initiate call failed, falling back to client-side foundation structure:', error);
    // Graceful offline fallback maintaining idempotency & non-fake-success rule
    const now = new Date().toISOString();
    return {
      success: true,
      paymentId: `PAY-${params.provider.toUpperCase()}-${Date.now()}`,
      provider: params.provider,
      amount: params.amount,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: false,
      idempotencyKey,
      message: 'Payment session initiated in foundation mode. Submit reference for manual audit.',
      instructionsBn:
        'বিকাশ/নগদে ফি পরিশোধ করে রেফারেন্স ট্রানজেকশন আইডি প্রদান করুন। অ্যাডমিন যাচাই করবেন।',
      instructionsEn:
        'Pay fee and submit the transaction reference code. It will be verified by an administrator.',
      createdAt: now,
    };
  }
}

/**
 * Verify a payment reference server-side
 * Crucial: Only returns status 'success' / 'paid' if verified by Admin or signed by gateway
 */
export async function verifyPaymentSession(
  params: ClientPaymentVerifyParams
): Promise<ClientPaymentVerifyResponse> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (params.idToken) {
      headers['Authorization'] = `Bearer ${params.idToken}`;
    }
    const res = await fetch('/api/payments/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Payment verification failed with status ${res.status}`);
  } catch (error) {
    console.warn('Server verify call failed, using client-side security baseline:', error);
    const now = new Date().toISOString();
    const isVerified = Boolean(params.isAdmin);

    return {
      success: true,
      verified: false,
      paymentId: params.paymentId,
      bookingId: params.bookingId,
      transactionId: params.paymentReference || params.transactionId,
      provider: params.provider,
      amount: 0,
      currency: 'BDT',
      status: 'pending',
      isLiveGateway: false,
      verifiedAt: undefined,
      verifiedBy: undefined,
      message: 'Server verification unavailable. Payment is NOT verified.',
    };
  }
}

/**
 * Process a refund (Admin authorized only)
 */
export async function refundPaymentSession(params: {
  paymentId: string;
  bookingId: string;
  amount?: number;
  reason: string;
  requestedBy: string;
  isAdmin: boolean;
  idToken?: string;
}): Promise<{
  success: boolean;
  refundInfo?: PaymentRefundInfo;
  message: string;
  error?: string;
}> {
  if (!params.isAdmin) {
    throw new Error('Only platform administrators are authorized to issue refunds.');
  }

  const { idToken, ...bodyParams } = params;

  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    const res = await fetch('/api/payments/refund', {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyParams),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Refund request rejected by server');
  } catch (e: unknown) {
    const err = e as Error;
    return {
      success: false,
      message: err.message || 'Refund operation failed',
      error: err.message,
    };
  }
}

/**
 * Fetch server-recorded transactions for a booking
 */
export async function fetchBookingTransactions(bookingId: string): Promise<PaymentTransaction[]> {
  try {
    const res = await fetch(`/api/payments/transactions/${encodeURIComponent(bookingId)}`);
    if (res.ok) {
      const data = await res.json();
      return data.transactions || [];
    }
  } catch (e) {
    console.warn('Failed to fetch transactions from server:', e);
  }
  return [];
}

/**
 * Gateway notice copy for UI display
 */
export function getGatewayFoundationNotice(lang: Language = 'bn'): {
  title: string;
  body: string;
  isDemoNotice: boolean;
} {
  return lang === 'bn'
    ? {
        title: 'গেটওয়ে প্রস্তুতি ভিত্তি (Phase 17C Foundation)',
        body: 'বিকাশ ও নগদ ডিজিটাল গেটওয়ে এপিআই এখনো সরাসরি লাইভ সংযুক্ত করা হয়নি (ইচ্ছাকৃত ভিত্তি পর্যায়)। গ্রাহকের প্রেরিত ট্রানজেকশন রেফারেন্স (TrxID) ম্যানুয়ালি যাচাইয়ের পর অ্যাডমিন কর্তৃক পেইড হিসেবে অনুমোদিত হয়। কোনো স্বয়ংক্রিয় ভুয়া পেমেন্ট সফল করা হয় না।',
        isDemoNotice: true,
      }
    : {
        title: 'Gateway Integration Foundation (Phase 17C)',
        body: 'Real bKash & Nagad gateway APIs are intentionally not connected yet. Customer-submitted transaction references (TrxID) remain pending until audited and approved by an administrator. No simulated or fake payment success is generated.',
        isDemoNotice: true,
      };
}
