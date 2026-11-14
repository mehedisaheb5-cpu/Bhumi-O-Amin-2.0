import React from 'react';
import {
  X,
  Clock,
  Calendar,
  MapPin,
  CheckCircle2,
  FileText,
  AlertTriangle,
  User,
  Phone,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  Star,
  MessageSquare,
  AlertCircle,
  Ban,
  ArrowRight,
} from 'lucide-react';
import { Language, CustomerBooking, MarketplaceRole } from '../../types';
import { STATUS_CONFIG } from '../../lib/marketplaceStorage';
import { getPaymentStatusMeta, formatBDT } from '../../lib/pricing-commission';

interface BookingDetailsModalProps {
  booking: CustomerBooking | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelBooking?: (bookingId: string) => void;
  onOpenReport?: (surveyId?: string, reportId?: string) => void;
  onOpenComplaint?: (booking: CustomerBooking) => void;
  onOpenRating?: (booking: CustomerBooking) => void;
  onOpenPayment?: (booking: CustomerBooking) => void;
  userRole?: MarketplaceRole;
  lang: Language;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  booking,
  isOpen,
  onClose,
  onCancelBooking,
  onOpenReport,
  onOpenComplaint,
  onOpenRating,
  onOpenPayment,
  userRole = 'customer',
  lang,
}) => {
  if (!isOpen || !booking) return null;

  const isBn = lang === 'bn';
  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

  const canCancel =
    booking.status === 'pending' ||
    booking.status === 'under_review';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                {booking.id}
              </span>
              {booking.isDemo && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  {isBn ? 'নমুনা বুকিং (Demo)' : 'Sample Booking'}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              {isBn ? booking.serviceNameBn : booking.serviceNameEn}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-slate-700">
          {/* Current Status Badge Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${statusCfg.badgeBg} ${statusCfg.badgeBorder}`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className={`w-5 h-5 ${statusCfg.badgeText} shrink-0`} />
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold opacity-75 block">
                  {isBn ? 'বর্তমান স্ট্যাটাস' : 'Current Status'}
                </span>
                <span className={`text-sm sm:text-base font-extrabold ${statusCfg.badgeText}`}>
                  {isBn ? statusCfg.labelBn : statusCfg.labelEn}
                </span>
              </div>
            </div>

            {booking.scheduledDate && (
              <div className="text-right text-xs">
                <span className="text-slate-500 block text-[10px]">
                  {isBn ? 'নির্ধারিত তারিখ' : 'Scheduled Date'}
                </span>
                <span className="font-bold text-slate-800">{booking.scheduledDate}</span>
              </div>
            )}
          </div>

          {/* Survey Report Available (Phase 6 Integration) */}
          {(booking.linkedReportId || booking.linkedSurveyId || booking.status === 'completed') && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    {isBn ? 'সার্ভে রিপোর্ট ও ডিজিটাল নকশা প্রস্তুত' : 'Official Survey Report Available'}
                  </h4>
                  <p className="text-[11px] text-emerald-200">
                    {isBn
                      ? 'এ৪ প্রিন্টযোগ্য সার্টিফিকেট ও ডিজিটাল ২ডি প্লট ড্রয়িং দেখতে ট্যাপ করুন।'
                      : 'View printable A4 survey certificate and digital 2D vector plot map.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenReport) {
                    onOpenReport(booking.linkedSurveyId || 'srv-001', booking.linkedReportId);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-white text-emerald-950 font-bold text-xs hover:bg-emerald-50 shrink-0 flex items-center gap-1.5 shadow-2xs transition active:scale-95"
              >
                <span>{isBn ? 'রিপোর্ট দেখুন' : 'View Report'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Assigned Amin Information */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>{isBn ? 'নিযুক্ত সার্ভেয়ার / আমিন:' : 'Assigned Surveyor / Amin:'}</span>
            </h4>

            {booking.assignedAminName ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <span className="font-bold text-slate-900 text-sm block">
                    {booking.assignedAminName}
                  </span>
                  {booking.assignedAminPhone && (
                    <span className="text-xs text-slate-500 font-mono">
                      📞 {booking.assignedAminPhone}
                    </span>
                  )}
                  {booking.assignedAt && (
                    <span className="text-[10px] text-slate-400 block">
                      {isBn ? `বরাদ্দের তারিখ: ${booking.assignedAt}` : `Assigned: ${booking.assignedAt}`}
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isBn ? 'সনদপ্রাপ্ত' : 'Verified'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                {isBn
                  ? 'এখনও আমিন বরাদ্দ করা হয়নি। সুপারভাইজার পর্যালোচনা শেষে উপযুক্ত আমিন নিয়োগ করবেন।'
                  : 'No Amin assigned yet. Supervision team is reviewing the plot requirements.'}
              </p>
            )}

            {booking.aminNotes && (
              <div className="mt-2 p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700">
                <span className="font-semibold text-slate-800 block text-[11px] mb-0.5">
                  {isBn ? 'আমিনের ফিল্ড নোট:' : 'Amin Field Notes:'}
                </span>
                <p>{booking.aminNotes}</p>
              </div>
            )}
          </div>

          {/* Land Information Details */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-700" />
              <span>{isBn ? 'জমির অবস্থান ও পরিমাপ বিবরণ:' : 'Land & Measurement Details:'}</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">{isBn ? 'জেলা / উপজেলা' : 'District/Upazila'}</span>
                <span className="font-bold text-slate-800">
                  {booking.land.district}, {booking.land.upazila}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">{isBn ? 'মৌজা ও জে.এল.' : 'Mouza & J.L.'}</span>
                <span className="font-bold text-slate-800">
                  {booking.land.mouza} {booking.land.jlNo ? `(JL ${booking.land.jlNo})` : ''}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">{isBn ? 'দাগ ও খতিয়ান' : 'Dag & Khatian'}</span>
                <span className="font-bold text-slate-800">
                  দাগ: {booking.land.dagNo} {booking.land.khatianNo ? `| খতিয়ান: ${booking.land.khatianNo}` : ''}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">{isBn ? 'জমির আয়তন' : 'Land Size'}</span>
                <span className="font-bold text-slate-800">
                  {booking.surveyRequirements.approxLandSize} {booking.surveyRequirements.unit || 'শতাংশ'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white border border-slate-100 col-span-2">
                <span className="text-[10px] text-slate-400 block">{isBn ? 'লোকেশন বিবরণ' : 'Location Note'}</span>
                <span className="font-medium text-slate-800">
                  {booking.surveyRequirements.locationDescription || (isBn ? 'নির্দিষ্ট নেই' : 'Not specified')}
                </span>
              </div>
            </div>

            {/* GPS Location (if provided) */}
            {booking.location.hasGps && booking.location.latitude && (
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-900 block">
                    {isBn ? 'জিপিএস স্থানাঙ্ক (GPS Coordinates):' : 'Attached GPS Coordinates:'}
                  </span>
                  <span className="font-mono text-[11px] text-slate-700">
                    Latitude: {booking.location.latitude}, Longitude: {booking.location.longitude} (±{booking.location.accuracy || 3}m)
                  </span>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">
                    {isBn
                      ? '“GPS অবস্থান আনুমানিক। আইনগত সীমানা নির্ধারণের জন্য এটি একমাত্র প্রমাণ নয়।”'
                      : '“Device GPS is approximate; not sole proof for legal boundary determination.”'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pricing Details & Payment Status (Phase 17A & 17B) */}
          {(() => {
            const payMeta = getPaymentStatusMeta(booking.paymentStatus, lang);
            const snapshot = booking.pricingSnapshot;
            const basePrice = snapshot?.basePrice ?? booking.pricing.basePrice ?? booking.pricing.serviceFee;
            const commPercent = snapshot?.commissionPercentage ?? booking.pricing.commissionPercentage ?? 10;
            const platformCommission = snapshot?.platformCommission ?? booking.pricing.platformCommission ?? booking.pricing.platformFee;
            const aminEarning = snapshot?.aminEarning ?? booking.pricing.aminEarning ?? (basePrice - platformCommission);
            const customerPayable = snapshot?.customerPayable ?? booking.pricing.customerPayable ?? booking.pricing.totalFee;

            return (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-700" />
                    <span>{isBn ? 'ফি, কমিশন ও পেমেন্ট বিবরণ:' : 'Pricing, Commission & Payment:'}</span>
                  </h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${payMeta.badgeClass}`}
                    title={payMeta.description}
                  >
                    {payMeta.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-600">{isBn ? 'মূল সার্ভিস মূল্য (Base Price):' : 'Base Service Price:'}</span>
                    <span className="font-semibold text-slate-800">{formatBDT(basePrice)}</span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-600">
                      {isBn ? `প্ল্যাটফর্ম কমিশন (${commPercent}%):` : `Platform Commission (${commPercent}%):`}
                    </span>
                    <span className="font-semibold text-emerald-800">{formatBDT(platformCommission)}</span>
                  </div>

                  {(userRole === 'admin' || userRole === 'amin') && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>{isBn ? 'আমিনের প্রাপ্য পারিশ্রমিক:' : 'Amin Net Earning:'}</span>
                      <span className="font-semibold text-slate-800">{formatBDT(aminEarning)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline font-bold pt-2 border-t border-slate-200 text-emerald-950">
                    <div>
                      <span>{isBn ? 'গ্রাহকের প্রদেয় মোট মূল্য:' : 'Total Customer Payable:'}</span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {isBn ? 'অন-সাইট বা ডিজিটাল মাধ্যমে প্রদেয়' : 'Payable on-site or digital reference'}
                      </span>
                    </div>
                    <span className="text-base font-extrabold text-emerald-900 font-mono">
                      {formatBDT(customerPayable)}
                    </span>
                  </div>
                </div>

                {/* Existing Payment Transaction Details if recorded */}
                {(booking.paymentReference || booking.paymentMethod || booking.paymentVerifiedBy) && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 text-xs space-y-1 text-slate-700">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">{isBn ? 'পেমেন্ট মাধ্যম:' : 'Payment Method:'}</span>
                      <span className="font-bold text-slate-800 uppercase">
                        {booking.paymentMethod === 'bkash'
                          ? 'bKash'
                          : booking.paymentMethod === 'nagad'
                          ? 'Nagad'
                          : booking.paymentMethod === 'card'
                          ? 'Card'
                          : isBn
                          ? 'সরাসরি নগদ (Cash)'
                          : 'Cash'}
                      </span>
                    </div>
                    {booking.paymentReference && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{isBn ? 'রেফারেন্স / TrxID:' : 'Reference ID:'}</span>
                        <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {booking.paymentReference}
                        </span>
                      </div>
                    )}
                    {booking.paymentPaidAt && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{isBn ? 'তারিখ ও সময়:' : 'Recorded At:'}</span>
                        <span>{new Date(booking.paymentPaidAt).toLocaleString()}</span>
                      </div>
                    )}
                    {booking.paymentVerifiedBy && (
                      <div className="text-[10px] text-emerald-700 font-semibold pt-0.5">
                        ✓ {isBn ? 'যাচাইকারী অ্যাডমিন:' : 'Verified by:'} {booking.paymentVerifiedBy}
                      </div>
                    )}
                  </div>
                )}

                {snapshot && (
                  <div className="pt-1 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{isBn ? 'বুকিংকালীন প্রিজার্ভড প্রাইসিং স্ন্যাপশট' : 'Preserved Pricing Snapshot at Booking Time'}</span>
                    <span className="font-mono">{new Date(snapshot.snapshotAt).toLocaleDateString()}</span>
                  </div>
                )}

                {/* Open Payment Flow Button */}
                {onOpenPayment && (
                  <button
                    type="button"
                    onClick={() => onOpenPayment(booking)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {userRole === 'admin'
                        ? isBn
                          ? 'পেমেন্ট যাচাই ও পরিবর্তন করুন (Admin)'
                          : 'Verify & Manage Payment (Admin)'
                        : isBn
                        ? 'পেমেন্ট স্ক্রিন ও মাধ্যমসমূহ দেখুন'
                        : 'Open Payment Flow & Methods'}
                    </span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* Status Timeline / Audit History */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <span>{isBn ? 'অডিট টাইমলাইন ও স্ট্যাটাস হিস্ট্রি:' : 'Audit Timeline & Status History:'}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {isBn ? 'প্রতিটি পরিবর্তনের রেকর্ড' : 'Audited Activity Log'}
              </span>
            </h4>

            {/* Visual Workflow Steps */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-[480px] text-[10px]">
                {[
                  { id: 'pending', labelBn: 'আবেদন', labelEn: 'Pending' },
                  { id: 'assigned', labelBn: 'বরাদ্দ', labelEn: 'Assigned' },
                  { id: 'scheduled', labelBn: 'শিডিউল', labelEn: 'Scheduled' },
                  { id: 'field_work', labelBn: 'ফিল্ড কাজ', labelEn: 'Field' },
                  { id: 'processing', labelBn: 'প্রসেসিং', labelEn: 'Processing' },
                  { id: 'quality_check', labelBn: 'মান যাচাই', labelEn: 'QC' },
                  { id: 'completed', labelBn: 'সম্পন্ন', labelEn: 'Completed' },
                ].map((step, sIdx, arr) => {
                  const stepIndex = arr.findIndex((x) => x.id === step.id);
                  const currentStepKey =
                    booking.status === 'amin_accepted' ? 'assigned' : booking.status;
                  const currentIdx = arr.findIndex((x) => x.id === currentStepKey);
                  const isDone = currentIdx >= stepIndex && booking.status !== 'cancelled' && booking.status !== 'rejected';
                  const isCurrent = currentStepKey === step.id;

                  return (
                    <React.Fragment key={step.id}>
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-md font-semibold ${
                          isCurrent
                            ? 'bg-emerald-800 text-white shadow-2xs'
                            : isDone
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
                        <span>{isBn ? step.labelBn : step.labelEn}</span>
                      </div>
                      {sIdx < arr.length - 1 && (
                        <div
                          className={`h-0.5 w-2 shrink-0 ${
                            currentIdx > stepIndex ? 'bg-emerald-600' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Detailed History Log */}
            <div className="space-y-2.5 pt-1 pl-1">
              {booking.statusHistory && booking.statusHistory.length > 0 ? (
                booking.statusHistory.map((entry, idx) => {
                  const sCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
                  const prevCfg = entry.previousStatus ? (STATUS_CONFIG[entry.previousStatus] || null) : null;
                  return (
                    <div key={idx} className="flex items-start gap-2.5 text-xs relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0 ring-2 ring-emerald-100" />
                      <div className="flex-1 pb-1">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            {prevCfg && (
                              <>
                                <span className="text-slate-500 font-normal text-[11px]">
                                  {isBn ? prevCfg.labelBn : prevCfg.labelEn}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                              </>
                            )}
                            <span className={sCfg.badgeText}>
                              {isBn ? sCfg.labelBn : sCfg.labelEn}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">{entry.changedAt}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {entry.changedBy} ({entry.role})
                        </span>
                        {entry.note && (
                          <p className="text-[11px] text-slate-700 mt-1 bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">{isBn ? 'কোনো হিস্ট্রি নেই' : 'No history yet'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between flex-wrap gap-2">
          {/* Digital Survey Report & Certificate (If completed or report linked) */}
          {(booking.status === 'completed' || booking.linkedReportId) && onOpenReport && (
            <button
              onClick={() => {
                onClose();
                onOpenReport(booking.linkedSurveyId || 'srv-001', booking.linkedReportId);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isBn ? 'রিপোর্ট ও সার্টিফিকেট দেখুন' : 'View Report & Certificate'}</span>
            </button>
          )}

          {/* Customer Rating Option (If completed) */}
          {booking.status === 'completed' && onOpenRating && (
            <button
              onClick={() => onOpenRating(booking)}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 border border-amber-200 transition active:scale-95"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>{isBn ? 'রেটিং ও রিভিউ দিন' : 'Rate & Review'}</span>
            </button>
          )}

          {/* Customer Complaint Option */}
          {onOpenComplaint && (
            <button
              onClick={() => onOpenComplaint(booking)}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1.5 border border-rose-200 transition active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{isBn ? 'অভিযোগ জানান' : 'File Complaint'}</span>
            </button>
          )}

          {/* Cancel Option (Only allowed if pending or under_review) */}
          {canCancel && onCancelBooking && (
            <button
              onClick={() => onCancelBooking(booking.id)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Ban className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? 'বুকিং বাতিল করুন' : 'Cancel Booking'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition active:scale-95"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
