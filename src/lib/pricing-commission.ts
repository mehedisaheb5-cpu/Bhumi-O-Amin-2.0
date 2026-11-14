import {
  MarketplaceService,
  PricingSnapshot,
  PaymentStatus,
  PaymentMethod,
  CustomerBooking,
  Language,
} from '../types';

export interface PricingBreakdown {
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  commissionPercentage: number;
  platformCommission: number;
  aminEarning: number;
  platformEarning: number;
  customerPayable: number;
  totalAmount: number;
  currency: string;
}

export const DEFAULT_PLATFORM_COMMISSION_PERCENT = 10;

/**
 * Automatically calculate customer payable amount, platform commission,
 * Amin earning, and total amount based on base price and commission percentage.
 */
export function calculatePricingBreakdown(
  basePrice: number,
  commissionPercentage: number = DEFAULT_PLATFORM_COMMISSION_PERCENT,
  options?: {
    minPrice?: number;
    maxPrice?: number;
    additionalFee?: number;
    currency?: string;
  }
): PricingBreakdown {
  const cleanBasePrice = Math.max(0, Math.round(Number(basePrice) || 0));
  const cleanCommissionPercent = Math.max(
    0,
    Math.min(100, Number(commissionPercentage) || DEFAULT_PLATFORM_COMMISSION_PERCENT)
  );
  const additionalFee = Math.max(0, Math.round(Number(options?.additionalFee) || 0));
  const currency = options?.currency || 'BDT';

  // Platform commission and earnings
  const platformCommission = Math.round(cleanBasePrice * (cleanCommissionPercent / 100));
  const platformEarning = platformCommission;

  // Amin receives the remainder of the base price
  const aminEarning = Math.max(0, cleanBasePrice - platformCommission);

  // Customer payable is base price + any applicable extra fees
  const customerPayable = cleanBasePrice + additionalFee;
  const totalAmount = customerPayable;

  return {
    basePrice: cleanBasePrice,
    minPrice: options?.minPrice ? Math.max(0, Math.round(options.minPrice)) : undefined,
    maxPrice: options?.maxPrice ? Math.max(cleanBasePrice, Math.round(options.maxPrice)) : undefined,
    commissionPercentage: cleanCommissionPercent,
    platformCommission,
    aminEarning,
    platformEarning,
    customerPayable,
    totalAmount,
    currency,
  };
}

/**
 * Takes a MarketplaceService and ensures all Phase 17A pricing fields are initialized.
 * Maintains complete backwards compatibility with legacy baseFee and platformFee.
 */
export function normalizeServicePricing(service: MarketplaceService): MarketplaceService {
  const basePrice = service.basePrice ?? service.baseFee ?? 2000;
  const commissionPercentage =
    service.commissionPercentage ??
    (service.platformFee && service.baseFee
      ? Math.max(5, Math.min(50, Math.round((service.platformFee / service.baseFee) * 100)))
      : DEFAULT_PLATFORM_COMMISSION_PERCENT);

  const breakdown = calculatePricingBreakdown(basePrice, commissionPercentage, {
    minPrice: service.minPrice,
    maxPrice: service.maxPrice,
  });

  return {
    ...service,
    basePrice: breakdown.basePrice,
    commissionPercentage: breakdown.commissionPercentage,
    minPrice: breakdown.minPrice,
    maxPrice: breakdown.maxPrice,
    aminEarning: breakdown.aminEarning,
    platformEarning: breakdown.platformEarning,
    // Keep backward compatible fee attributes synced
    baseFee: breakdown.basePrice,
    platformFee: breakdown.platformCommission,
  };
}

/**
 * Creates an immutable snapshot of service pricing at the exact time of booking.
 * Preserves the exact price, commission rate, and earnings that existed when the booking was placed.
 */
export function createPricingSnapshot(
  service: MarketplaceService,
  options?: {
    customPrice?: number;
    additionalFee?: number;
  }
): PricingSnapshot {
  const basePrice = options?.customPrice ?? service.basePrice ?? service.baseFee;
  const commissionPercentage =
    service.commissionPercentage ?? DEFAULT_PLATFORM_COMMISSION_PERCENT;

  const breakdown = calculatePricingBreakdown(basePrice, commissionPercentage, {
    minPrice: service.minPrice,
    maxPrice: service.maxPrice,
    additionalFee: options?.additionalFee,
  });

  return {
    serviceId: service.id,
    serviceNameBn: service.nameBn,
    serviceNameEn: service.nameEn,
    basePrice: breakdown.basePrice,
    minPrice: breakdown.minPrice,
    maxPrice: breakdown.maxPrice,
    commissionPercentage: breakdown.commissionPercentage,
    platformCommission: breakdown.platformCommission,
    aminEarning: breakdown.aminEarning,
    platformEarning: breakdown.platformEarning,
    customerPayable: breakdown.customerPayable,
    totalAmount: breakdown.totalAmount,
    currency: breakdown.currency,
    snapshotAt: new Date().toISOString(),
  };
}

/**
 * Payment Status UI metadata & configuration.
 * Note: Purely data-structure based; no live payment gateways are processed.
 */
export const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  {
    labelBn: string;
    labelEn: string;
    badgeClass: string;
    descriptionBn: string;
    descriptionEn: string;
  }
> = {
  unpaid: {
    labelBn: 'অপরিশোধিত',
    labelEn: 'Unpaid',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    descriptionBn: 'গ্রাহকের নিকট হতে এখনও পেমেন্ট পাওয়া যায়নি (কাজ শেষে সরাসরি প্রদেয়)।',
    descriptionEn: 'Payment has not been received from customer yet (Payable upon survey completion).',
  },
  payment_pending: {
    labelBn: 'পেমেন্ট প্রক্রিয়াধীন',
    labelEn: 'Payment Pending',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    descriptionBn: 'গ্রাহক বা আমিনের পক্ষ থেকে পেমেন্ট যাচাইকরণের অপেক্ষায় রয়েছে।',
    descriptionEn: 'Payment verification is currently pending verification.',
  },
  pending: {
    labelBn: 'পেমেন্ট প্রক্রিয়াধীন',
    labelEn: 'Payment Pending',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    descriptionBn: 'গ্রাহক বা আমিনের পক্ষ থেকে পেমেন্ট যাচাইকরণের অপেক্ষায় রয়েছে।',
    descriptionEn: 'Payment verification is currently pending verification.',
  },
  paid: {
    labelBn: 'পরিশোধিত',
    labelEn: 'Paid',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    descriptionBn: 'সম্পূর্ণ সার্ভিস ফি সফলভাবে পরিশোধ ও রেকর্ড করা হয়েছে।',
    descriptionEn: 'Full service fee has been successfully paid and recorded.',
  },
  refunded: {
    labelBn: 'রিফান্ডকৃত',
    labelEn: 'Refunded',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    descriptionBn: 'বাতিল বা বিরোধ নিষ্পত্তির কারণে অর্থ গ্রাহককে ফেরত দেওয়া হয়েছে।',
    descriptionEn: 'Payment amount has been refunded due to cancellation or dispute resolution.',
  },
  failed: {
    labelBn: 'ব্যর্থ',
    labelEn: 'Failed',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    descriptionBn: 'পেমেন্ট সম্পন্ন করার চেষ্টা ব্যর্থ হয়েছে।',
    descriptionEn: 'Payment attempt was unsuccessful or invalid.',
  },
};

/**
 * Phase 17B: Payment Methods Configuration (UI Only & Gateway Placeholders)
 */
export interface PaymentMethodConfig {
  id: PaymentMethod;
  nameBn: string;
  nameEn: string;
  tagBn: string;
  tagEn: string;
  isDemoGateway: boolean;
  accentColor: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  instructionsBn: string;
  instructionsEn: string;
}

export const PAYMENT_METHODS_CONFIG: Record<PaymentMethod, PaymentMethodConfig> = {
  bkash: {
    id: 'bkash',
    nameBn: 'বিকাশ (bKash)',
    nameEn: 'bKash',
    tagBn: 'আসন্ন / ডেমো গেটওয়ে',
    tagEn: 'Coming Soon / Demo',
    isDemoGateway: true,
    accentColor: 'border-pink-500 bg-pink-50/50',
    textColor: 'text-pink-600',
    badgeBg: 'bg-pink-100',
    badgeBorder: 'border-pink-300',
    badgeText: 'text-pink-800',
    instructionsBn:
      'বিকাশ পেমেন্ট গেটওয়ে API ইন্টিগ্রেশন শীঘ্রই যুক্ত হবে। বর্তমানে গ্রাহক ট্রানজেকশন আইডি (TrxID) দিয়ে ম্যানুয়াল পেমেন্ট জমা দিতে পারেন।',
    instructionsEn:
      'Official bKash payment gateway integration coming soon. Currently, customers can submit their Transaction ID (TrxID) for manual confirmation.',
  },
  nagad: {
    id: 'nagad',
    nameBn: 'নগদ (Nagad)',
    nameEn: 'Nagad',
    tagBn: 'আসন্ন / ডেমো গেটওয়ে',
    tagEn: 'Coming Soon / Demo',
    isDemoGateway: true,
    accentColor: 'border-orange-500 bg-orange-50/50',
    textColor: 'text-orange-600',
    badgeBg: 'bg-orange-100',
    badgeBorder: 'border-orange-300',
    badgeText: 'text-orange-800',
    instructionsBn:
      'নগদ পেমেন্ট গেটওয়ে API ইন্টিগ্রেশন প্রক্রিয়াধীন। ট্রানজেকশন সম্পন্ন হলে নিচের বক্সে TrxID রেফারেন্স লিখুন।',
    instructionsEn:
      'Nagad online gateway integration in progress. If paid manually, enter the TrxID below for verification.',
  },
  card: {
    id: 'card',
    nameBn: 'কার্ড (Visa / Mastercard)',
    nameEn: 'Debit / Credit Card',
    tagBn: 'আসন্ন / ডেমো গেটওয়ে',
    tagEn: 'Coming Soon / Demo',
    isDemoGateway: true,
    accentColor: 'border-blue-600 bg-blue-50/50',
    textColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    badgeText: 'text-blue-800',
    instructionsBn:
      'SSLCommerz / Shurjopay আন্তর্জাতিক কার্ড গেটওয়ে শীঘ্রই চালু হচ্ছে।',
    instructionsEn:
      'Card payment gateway integration (SSLCommerz / Shurjopay) coming soon.',
  },
  cash: {
    id: 'cash',
    nameBn: 'সরাসরি নগদ (Cash on Site)',
    nameEn: 'Cash on Site / Direct',
    tagBn: 'চলমান / অনুমোদিত',
    tagEn: 'Active / Available',
    isDemoGateway: false,
    accentColor: 'border-emerald-600 bg-emerald-50/50',
    textColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    badgeText: 'text-emerald-800',
    instructionsBn:
      'জমি পরিমাপ ও সীমানা নির্ধারণ সম্পন্ন হওয়ার পর সরজমিনে সরাসরি আমিনের কাছে নগদ অর্থ প্রদান করা যাবে।',
    instructionsEn:
      'Payable directly in cash to the certified surveyor on the day of survey completion.',
  },
  bank: {
    id: 'bank',
    nameBn: 'ব্যাংক ট্রান্সফার (Bank Transfer)',
    nameEn: 'Bank Transfer (BEFTN/NPSB)',
    tagBn: 'ম্যানুয়াল ভেরিফিকেশন',
    tagEn: 'Manual Verification',
    isDemoGateway: false,
    accentColor: 'border-indigo-600 bg-indigo-50/50',
    textColor: 'text-indigo-700',
    badgeBg: 'bg-indigo-100',
    badgeBorder: 'border-indigo-300',
    badgeText: 'text-indigo-800',
    instructionsBn:
      'ব্যাংক অ্যাকাউন্টে টাকা পাঠিয়ে ডিপোজিট স্লিপ নম্বর বা রেফারেন্স ট্রানজেকশন কোড উল্লেখ করুন।',
    instructionsEn:
      'Transfer funds to official account and provide the bank deposit slip or transaction reference.',
  },
  manual: {
    id: 'manual',
    nameBn: 'অফিস / ম্যানুয়াল সমন্বয়',
    nameEn: 'Office / Manual Settlement',
    tagBn: 'অ্যাডমিন অনুমোদিত',
    tagEn: 'Admin Authorized',
    isDemoGateway: false,
    accentColor: 'border-slate-600 bg-slate-50/50',
    textColor: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    badgeText: 'text-slate-800',
    instructionsBn:
      'অফিসিয়াল প্রতিনিধির মাধ্যমে সরাসরি বিশেষ ছাড় বা সমন্বয়ের মাধ্যমে পরিশোধ।',
    instructionsEn:
      'Manual settlement processed directly with authorized platform administrative representative.',
  },
};

export function getPaymentMethodMeta(method?: PaymentMethod, lang: Language = 'bn') {
  const currentMethod: PaymentMethod = method || 'cash';
  const config = PAYMENT_METHODS_CONFIG[currentMethod] || PAYMENT_METHODS_CONFIG.cash;
  return {
    id: currentMethod,
    name: lang === 'bn' ? config.nameBn : config.nameEn,
    tag: lang === 'bn' ? config.tagBn : config.tagEn,
    instructions: lang === 'bn' ? config.instructionsBn : config.instructionsEn,
    isDemoGateway: config.isDemoGateway,
    accentColor: config.accentColor,
    textColor: config.textColor,
    badgeBg: config.badgeBg,
    badgeBorder: config.badgeBorder,
    badgeText: config.badgeText,
    badgeClass: `${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`,
  };
}

/**
 * Phase 17B: Future Gateway Ready Intent Schema
 */
export interface PaymentGatewayIntent {
  bookingId: string;
  amount: number;
  currency: 'BDT';
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  serviceName: string;
  method: PaymentMethod;
  callbackUrl?: string;
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Phase 17B: Compute Admin Payment Summary
 * Uses only existing booking payment state — no fake transactions created.
 */
export function getPaymentSummary(bookings: CustomerBooking[]) {
  let totalPayable = 0;
  let paidAmount = 0;
  let pendingAmount = 0;
  let unpaidAmount = 0;
  let failedAmount = 0;
  let refundedAmount = 0;

  let paidCount = 0;
  let pendingCount = 0;
  let unpaidCount = 0;
  let failedCount = 0;
  let refundedCount = 0;

  let totalPlatformCommission = 0;
  let totalAminEarnings = 0;

  bookings.forEach((b) => {
    const payable =
      b.pricing?.customerPayable ??
      b.pricingSnapshot?.customerPayable ??
      b.pricing?.totalFee ??
      b.pricing?.serviceFee ??
      2000;

    const comm =
      b.pricing?.platformCommission ??
      b.pricingSnapshot?.platformCommission ??
      b.pricing?.platformFee ??
      Math.round(payable * 0.1);

    const aminEarn =
      b.pricing?.aminEarning ??
      b.pricingSnapshot?.aminEarning ??
      Math.max(0, payable - comm);

    totalPayable += payable;
    totalPlatformCommission += comm;
    totalAminEarnings += aminEarn;

    const status = b.paymentStatus || 'unpaid';
    if (status === 'paid') {
      paidAmount += payable;
      paidCount++;
    } else if (status === 'payment_pending' || status === 'pending') {
      pendingAmount += payable;
      pendingCount++;
    } else if (status === 'refunded') {
      refundedAmount += payable;
      refundedCount++;
    } else if (status === 'failed') {
      failedAmount += payable;
      failedCount++;
    } else {
      unpaidAmount += payable;
      unpaidCount++;
    }
  });

  return {
    totalPayable,
    paidAmount,
    pendingAmount,
    unpaidAmount,
    failedAmount,
    refundedAmount,
    totalPlatformCommission,
    totalAminEarnings,
    counts: {
      total: bookings.length,
      paid: paidCount,
      pending: pendingCount,
      unpaid: unpaidCount,
      failed: failedCount,
      refunded: refundedCount,
    },
  };
}

export function getPaymentStatusMeta(status?: PaymentStatus, lang: Language = 'bn') {
  const currentStatus: PaymentStatus = status || 'unpaid';
  const config = PAYMENT_STATUS_CONFIG[currentStatus] || PAYMENT_STATUS_CONFIG.unpaid;
  return {
    status: currentStatus,
    label: lang === 'bn' ? config.labelBn : config.labelEn,
    description: lang === 'bn' ? config.descriptionBn : config.descriptionEn,
    badgeClass: config.badgeClass,
  };
}

export function formatBDT(amount?: number): string {
  const val = Math.round(Number(amount) || 0);
  return `৳${val.toLocaleString('en-US')}`;
}
