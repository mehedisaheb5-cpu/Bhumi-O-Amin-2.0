import React, { useState } from 'react';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Calendar,
  MapPin,
  User,
  Copy,
  Check,
  Lock,
  Info,
  DollarSign,
} from 'lucide-react';
import {
  CustomerBooking,
  PaymentMethod,
  PaymentStatus,
  MarketplaceRole,
  Language,
} from '../../types';
import {
  formatBDT,
  getPaymentStatusMeta,
  getPaymentMethodMeta,
  PAYMENT_METHODS_CONFIG,
  PAYMENT_STATUS_CONFIG,
} from '../../lib/pricing-commission';
import {
  initiatePaymentSession,
  verifyPaymentSession,
  getGatewayFoundationNotice,
} from '../../lib/payment-gateway';
import { auth } from '../../lib/firebase';

interface PaymentModalProps {
  booking: CustomerBooking | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (
    bookingId: string,
    paymentData: {
      paymentStatus: PaymentStatus;
      paymentMethod: PaymentMethod;
      paymentReference?: string;
      paymentPaidAt?: string;
      paymentNotes?: string;
      paymentVerifiedBy?: string;
      paymentVerifiedAt?: string;
    }
  ) => void;
  currentUserRole: MarketplaceRole;
  currentUserName?: string;
  lang: Language;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSavePayment,
  currentUserRole,
  currentUserName,
  lang,
}) => {
  if (!isOpen || !booking) return null;

  const isBn = lang === 'bn';
  const isAdmin = currentUserRole === 'admin';
  const isCustomer = currentUserRole === 'customer';
  const isAmin = currentUserRole === 'amin';

  // Read pricing breakdown values safely from snapshot or pricing object
  const snapshot = booking.pricingSnapshot;
  const baseServicePrice =
    snapshot?.basePrice ??
    booking.pricing?.basePrice ??
    booking.pricing?.serviceFee ??
    2000;

  const platformCharge =
    snapshot?.platformCommission ??
    booking.pricing?.platformCommission ??
    booking.pricing?.platformFee ??
    0;

  const customerPayable =
    snapshot?.customerPayable ??
    booking.pricing?.customerPayable ??
    booking.pricing?.totalFee ??
    baseServicePrice + platformCharge;

  const aminShare =
    snapshot?.aminEarning ??
    booking.pricing?.aminEarning ??
    Math.max(0, customerPayable - platformCharge);

  const commissionPercent =
    snapshot?.commissionPercentage ??
    booking.pricing?.commissionPercentage ??
    10;

  // Form State
  const initialStatus = booking.paymentStatus || 'unpaid';
  const initialMethod = booking.paymentMethod || 'cash';

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(initialMethod);
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus>(initialStatus);
  const [trxReference, setTrxReference] = useState<string>(booking.paymentReference || '');
  const [notes, setNotes] = useState<string>(booking.paymentNotes || '');
  const [paidAtDate, setPaidAtDate] = useState<string>(
    booking.paymentPaidAt
      ? booking.paymentPaidAt.substring(0, 16)
      : new Date().toISOString().substring(0, 16)
  );
  const [copiedId, setCopiedId] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const statusMeta = getPaymentStatusMeta(booking.paymentStatus, lang);
  const currentMethodMeta = getPaymentMethodMeta(selectedMethod, lang);

  const handleCopyBookingId = () => {
    navigator.clipboard.writeText(booking.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };


  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback(null);
    let serverVerified = false;
    
    // Get ID Token
    let idToken = '';
    if (auth?.currentUser) {
        idToken = await auth.currentUser.getIdToken();
    }
    
    // Business Logic / Security Rule (Phase 17C):
    let statusToSave: PaymentStatus = selectedStatus;

    if (isCustomer) {
      if (selectedMethod === 'cash') {
        statusToSave = 'unpaid'; // Remains cash on completion
      } else {
        // Customer provided a transaction reference
        statusToSave = 'payment_pending';
      }
    }

    const payload = {
      paymentStatus: statusToSave,
      paymentMethod: selectedMethod,
      paymentReference: trxReference.trim() || undefined,
      paymentPaidAt:
        statusToSave === 'paid' || statusToSave === 'payment_pending'
          ? new Date(paidAtDate).toISOString()
          : undefined,
      paymentNotes: notes.trim() || undefined,
      paymentVerifiedBy:
        isAdmin && statusToSave === 'paid'
          ? currentUserName || 'সুপারভাইজার অ্যাডমিন'
          : booking.paymentVerifiedBy,
      paymentVerifiedAt:
        isAdmin && statusToSave === 'paid'
          ? new Date().toISOString()
          : booking.paymentVerifiedAt,
    };

    // Phase 17C: Notify server payment engine with idempotency tracking
    try {
      if (isAdmin && statusToSave === 'paid') {
        const result = await verifyPaymentSession({
          paymentId: `PAY-${selectedMethod.toUpperCase()}-${booking.id}`,
          bookingId: booking.id,
          provider: selectedMethod,
          paymentReference: trxReference.trim() || undefined,
          verifiedBy: currentUserName || 'সুপারভাইজার অ্যাডমিন',
          isAdmin: true,
          notes: notes.trim() || undefined,
          idToken,
        });
        serverVerified = Boolean(result?.verified);
      } else if (trxReference.trim()) {
        await verifyPaymentSession({
          paymentId: `PAY-${selectedMethod.toUpperCase()}-${booking.id}`,
          bookingId: booking.id,
          provider: selectedMethod,
          paymentReference: trxReference.trim(),
          isAdmin: false,
          notes: notes.trim() || undefined,
          idToken,
        });
      }
    } catch (err) {
      console.warn('Server payment engine sync warning:', err);
    }
    onSavePayment(booking.id, payload);

    setFormFeedback({
      type: 'success',
      message: isAdmin
        ? (statusToSave === 'paid' && !serverVerified)
          ? isBn
            ? 'পেমেন্ট স্ট্যাটাস সংরক্ষিত হয়েছে, কিন্তু সার্ভার যাচাই সম্পন্ন হয়নি।'
            : 'Payment status saved, but server verification was not completed.'
          : isBn
            ? 'পেমেন্ট স্ট্যাটাস ও রেফারেন্স সফলভাবে হালনাগাদ ও অডিট যাচাই সম্পন্ন হয়েছে।'
            : 'Payment record successfully audited, verified and updated.'
        : isBn
          ? 'আপনার পেমেন্ট রেফারেন্স জমা দেওয়া হয়েছে। অফিস/অ্যাডমিন যাচাই করার পর স্ট্যাটাস অনুমোদিত হবে।'
          : 'Payment reference submitted. An admin will verify and confirm the transaction.',
    });

    setTimeout(() => {
      setSubmitting(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      id="payment-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="payment-modal-content"
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                {isBn ? 'পেমেন্ট ব্যবস্থাপনা ও বিবরণ' : 'Payment Flow & Details'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">
                {booking.id}
              </h3>
              <button
                type="button"
                onClick={handleCopyBookingId}
                title={isBn ? 'বুকিং আইডি কপি করুন' : 'Copy Booking ID'}
                className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 transition"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            id="close-payment-modal-button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Booking Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  {isBn ? 'অনুরোধকৃত সেবা' : 'Service Requested'}
                </p>
                <h4 className="font-bold text-slate-900 text-sm">
                  {isBn ? booking.serviceNameBn : booking.serviceNameEn}
                </h4>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-500">
                  {isBn ? 'গ্রাহকের তথ্য' : 'Customer'}
                </p>
                <p className="font-bold text-slate-800 flex items-center justify-end gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{booking.customer.name}</span>
                </p>
                <p className="text-slate-500 text-[11px]">📞 {booking.customer.mobile}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {booking.land.mouza}, দাগ: {booking.land.dagNo} ({booking.land.upazila},{' '}
                  {booking.land.district})
                </span>
              </span>
              {booking.scheduledDate && (
                <span className="flex items-center gap-1 font-mono text-slate-500">
                  <Calendar className="w-3 h-3" />
                  <span>{booking.scheduledDate}</span>
                </span>
              )}
            </div>
          </div>

          {/* Pricing Snapshot Breakdown Box */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-800" />
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                  {isBn ? 'মূল্য ও ফি ব্রেকডাউন (সংরক্ষিত স্ন্যাপশট)' : 'Pricing Snapshot Breakdown'}
                </h4>
              </div>
              {snapshot?.snapshotAt && (
                <span className="text-[10px] font-mono text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
                  {new Date(snapshot.snapshotAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">{isBn ? 'মূল সেবা ফি:' : 'Base Service Fee:'}</span>
                <span className="font-mono font-semibold">{formatBDT(baseServicePrice)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>
                  {isBn
                    ? `প্ল্যাটফর্ম সুপারভিশন চার্জ (${commissionPercent}%):`
                    : `Platform Charge (${commissionPercent}%):`}
                </span>
                <span className="font-mono">{formatBDT(platformCharge)}</span>
              </div>

              {/* Show Amin earning to Amin or Admin */}
              {(isAmin || isAdmin) && (
                <div className="flex justify-between items-center text-emerald-800 text-[11px] pt-1 border-t border-emerald-100">
                  <span>{isBn ? 'আমিনের প্রাপ্য অংশ (Earning):' : 'Amin Share:'}</span>
                  <span className="font-mono font-bold">{formatBDT(aminShare)}</span>
                </div>
              )}

              {/* Customer Payable Final Amount */}
              <div className="pt-2 border-t border-emerald-200 flex justify-between items-baseline">
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    {isBn ? 'গ্রাহকের সর্বমোট প্রদেয় মূল্য:' : 'Total Customer Payable:'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {isBn ? 'কোনো লুকায়িত চার্জ নেই' : 'No hidden fees'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-emerald-900 font-mono">
                    {formatBDT(customerPayable)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Payment Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
              booking.paymentStatus === 'paid'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : booking.paymentStatus === 'payment_pending' || booking.paymentStatus === 'pending'
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : booking.paymentStatus === 'refunded'
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : booking.paymentStatus === 'failed'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {booking.paymentStatus === 'paid' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              ) : booking.paymentStatus === 'payment_pending' || booking.paymentStatus === 'pending' ? (
                <Clock className="w-5 h-5 text-blue-700" />
              ) : booking.paymentStatus === 'refunded' ? (
                <RotateCcw className="w-5 h-5 text-purple-700" />
              ) : booking.paymentStatus === 'failed' ? (
                <XCircle className="w-5 h-5 text-rose-700" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              )}
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="font-bold text-xs">
                  {isBn ? 'বর্তমান পেমেন্ট স্থিতি:' : 'Payment Status:'}{' '}
                  {statusMeta.label}
                </span>
                {booking.paymentReference && (
                  <span className="font-mono text-[11px] bg-white/80 px-2 py-0.5 rounded border">
                    TrxID: {booking.paymentReference}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {statusMeta.description}
              </p>
              {booking.paymentVerifiedBy && (
                <p className="text-[10px] font-semibold text-slate-600 mt-1">
                  ✓ {isBn ? 'অনুমোদনকারী:' : 'Verified by:'} {booking.paymentVerifiedBy} (
                  {booking.paymentVerifiedAt
                    ? new Date(booking.paymentVerifiedAt).toLocaleString()
                    : 'রেকর্ডকৃত'}
                  )
                </p>
              )}
            </div>
          </div>

          {/* Form for Customer Reference Submission OR Admin Verification */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Payment Method Selector (UI Only) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                {isBn ? 'পেমেন্ট মাধ্যম নির্বাচন করুন:' : 'Select Payment Method:'}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['cash', 'bkash', 'nagad', 'card'] as PaymentMethod[]).map((methodId) => {
                  const cfg = PAYMENT_METHODS_CONFIG[methodId];
                  const isSelected = selectedMethod === methodId;

                  return (
                    <button
                      key={methodId}
                      type="button"
                      disabled={isAmin}
                      onClick={() => setSelectedMethod(methodId)}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between gap-1.5 transition-all relative ${
                        isSelected
                          ? `${cfg.accentColor} ring-2 ring-emerald-600/40 shadow-xs`
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {methodId === 'cash' ? (
                          <Banknote className="w-4 h-4 text-emerald-700" />
                        ) : methodId === 'bkash' ? (
                          <Smartphone className="w-4 h-4 text-pink-600" />
                        ) : methodId === 'nagad' ? (
                          <Smartphone className="w-4 h-4 text-orange-600" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-blue-700" />
                        )}

                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeText}`}
                        >
                          {isBn ? cfg.tagBn : cfg.tagEn}
                        </span>
                      </div>

                      <div>
                        <span className="font-bold text-xs text-slate-900 block leading-tight">
                          {isBn ? cfg.nameBn : cfg.nameEn}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Method Instruction / Coming Soon Warning */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    {currentMethodMeta.name} {isBn ? 'নির্দেশনা' : 'Instructions'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {currentMethodMeta.instructions}
                </p>
                {currentMethodMeta.isDemoGateway && (
                  <div className="pt-1 text-[10px] text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200/70 space-y-0.5">
                    <span className="font-bold flex items-center gap-1 text-amber-800">
                      <span>🛡️</span>
                      <span>
                        {isBn
                          ? 'পেমেন্ট গেটওয়ে ভিত্তি (Phase 17C Foundation)'
                          : 'Payment Gateway Foundation (Phase 17C)'}
                      </span>
                    </span>
                    <p className="text-[10.5px] leading-relaxed text-amber-900/90">
                      {isBn
                        ? 'বিকাশ ও নগদ ডিজিটাল গেটওয়ে এপিআই এখনো সরাসরি লাইভ সংযুক্ত করা হয়নি (ইচ্ছাকৃত ভিত্তি পর্যায়)। গ্রাহকের ট্রানজেকশন রেফারেন্স (TrxID) ম্যানুয়ালি যাচাইয়ের পর অ্যাডমিন কর্তৃক পেইড হিসেবে অনুমোদিত হয়। কোনো স্বয়ংক্রিয় ভুয়া পেমেন্ট সফল করা হয় না।'
                        : 'Real bKash & Nagad gateway APIs are intentionally not connected yet. Customer transaction references (TrxID) remain pending until audited and approved by an administrator. No fake payment success is generated.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Admin-Only Payment Status Control */}
            {isAdmin && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-800" />
                    <span className="font-bold text-xs text-indigo-950">
                      {isBn
                        ? 'অ্যাডমিন কন্ট্রোল: পেমেন্ট স্ট্যাটাস নির্ধারণ'
                        : 'Admin Control: Update Payment Status'}
                    </span>
                  </div>
                  <span className="text-[10px] bg-indigo-200 text-indigo-900 font-bold px-2 py-0.5 rounded-full">
                    {isBn ? 'অনুমোদিত প্রশাসক' : 'Admin Only'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'unpaid', labelBn: 'অপরিশোধিত', labelEn: 'Unpaid' },
                      { id: 'payment_pending', labelBn: 'পেন্ডিং', labelEn: 'Pending' },
                      { id: 'paid', labelBn: 'পরিশোধিত', labelEn: 'Paid' },
                      { id: 'failed', labelBn: 'ব্যর্থ', labelEn: 'Failed' },
                      { id: 'refunded', labelBn: 'রিফান্ড', labelEn: 'Refunded' },
                    ] as { id: PaymentStatus; labelBn: string; labelEn: string }[]
                  ).map((s) => {
                    const isCurrent = selectedStatus === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStatus(s.id)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition border text-center ${
                          isCurrent
                            ? 'bg-indigo-900 text-white border-indigo-950 shadow-xs'
                            : 'bg-white text-slate-700 border-indigo-200/80 hover:bg-indigo-100/50'
                        }`}
                      >
                        {isBn ? s.labelBn : s.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual Payment Fields: Transaction ID, Date, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn
                    ? 'ট্রানজেকশন রেফারেন্স / TrxID (যদি থাকে):'
                    : 'Transaction Reference / TrxID:'}
                </label>
                <input
                  type="text"
                  disabled={isAmin}
                  value={trxReference}
                  onChange={(e) => setTrxReference(e.target.value)}
                  placeholder={
                    selectedMethod === 'cash'
                      ? isBn
                        ? 'যেমন: CASH-ON-SITE'
                        : 'e.g. CASH-ON-SITE'
                      : isBn
                      ? 'যেমন: 8N7A29KX'
                      : 'e.g. 8N7A29KX'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn ? 'পেমেন্টের সময় / তারিখ:' : 'Payment Timestamp:'}
                </label>
                <input
                  type="datetime-local"
                  disabled={isAmin}
                  value={paidAtDate}
                  onChange={(e) => setPaidAtDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn ? 'পেমেন্ট সংক্রান্ত নোট বা মন্তব্য:' : 'Payment Notes / Instructions:'}
                </label>
                <input
                  type="text"
                  disabled={isAmin}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isBn
                      ? 'যেমন: কাজ সম্পন্ন শেষে সরাসরি আমিনের নিকট নগদ প্রদান করা হবে'
                      : 'e.g. Payable upon survey completion'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
            </div>

            {/* Role Notice */}
            {isCustomer && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                ℹ️ {isBn
                  ? 'গ্রাহক হিসেবে আপনি ট্রানজেকশন আইডি বা রেফারেন্স জমা দিলে তা "Pending" অবস্থায় সংরক্ষিত হবে। কোনো গ্রাহক সরাসরি পেমেন্ট পেইড করতে পারেন না; অফিস কর্তৃপক্ষ যাচাই করে চূড়ান্ত অনুমোদন প্রদান করবেন।'
                  : 'As a customer, submitting your reference will set status to Pending. Customers cannot self-mark as Paid; an authorized admin will verify and confirm.'}
              </div>
            )}

            {isAmin && (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
                🔒 {isBn
                  ? 'নিরাপত্তা নীতি: আমিন শুধুমাত্র পেমেন্ট বিবরণ ও তাদের প্রাপ্য অংশ দেখতে পারেন, পেমেন্ট স্ট্যাটাস পরিবর্তনের ক্ষমতা শুধুমাত্র কেন্দ্রীয় অ্যাডমিনের জন্য সংরক্ষিত।'
                  : 'Security policy: Surveyors can view payment status and net earnings only. Status modification is restricted to authorized Admins.'}
              </div>
            )}

            {/* Form Feedback */}
            {formFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                {formFeedback.message}
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                id="cancel-payment-modal-button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>

              {!isAmin && (
                <button
                  type="submit"
                  id="submit-payment-record-button"
                  disabled={submitting}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs ${
                    isAdmin
                      ? 'bg-indigo-900 hover:bg-indigo-950'
                      : 'bg-emerald-800 hover:bg-emerald-900'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {submitting
                      ? isBn
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : isAdmin
                      ? isBn
                        ? 'পেমেন্ট যাচাই ও সংরক্ষণ করুন'
                        : 'Verify & Save Payment'
                      : isBn
                      ? 'পেমেন্ট রেফারেন্স জমা দিন'
                      : 'Submit Payment Reference'}
                  </span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
