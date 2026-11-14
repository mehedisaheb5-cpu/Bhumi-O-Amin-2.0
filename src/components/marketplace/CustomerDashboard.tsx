import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  Calendar,
  FileText,
  AlertCircle,
  ExternalLink,
  Ban,
  Star,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  PlusCircle,
  CreditCard,
} from 'lucide-react';
import { Language, CustomerBooking } from '../../types';
import { STATUS_CONFIG } from '../../lib/marketplaceStorage';
import { getPaymentStatusMeta, formatBDT } from '../../lib/pricing-commission';

interface CustomerDashboardProps {
  bookings: CustomerBooking[];
  onSelectBooking: (booking: CustomerBooking) => void;
  onCancelBooking: (bookingId: string) => void;
  onOpenReport: (surveyId?: string, reportId?: string) => void;
  onOpenRating: (booking: CustomerBooking) => void;
  onOpenComplaint: (booking: CustomerBooking) => void;
  onOpenPayment?: (booking: CustomerBooking) => void;
  onNewBookingClick: () => void;
  lang: Language;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  bookings,
  onSelectBooking,
  onCancelBooking,
  onOpenReport,
  onOpenRating,
  onOpenComplaint,
  onOpenPayment,
  onNewBookingClick,
  lang,
}) => {
  const isBn = lang === 'bn';
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  const filteredBookings = bookings.filter((b) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'completed') return b.status === 'completed';
    if (activeFilter === 'cancelled') return b.status === 'cancelled' || b.status === 'rejected';
    if (activeFilter === 'active') {
      return (
        b.status !== 'completed' &&
        b.status !== 'cancelled' &&
        b.status !== 'rejected'
      );
    }
    return true;
  });

  return (
    <div id="customer-dashboard-view" className="space-y-4 animate-fadeIn">
      {/* Top Banner with Quick Stats & New Booking Action */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            {isBn ? 'গ্রাহক ড্যাশবোর্ড' : 'Customer Workspace'}
          </span>
          <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
            {isBn ? 'আমার সেবা ও বুকিং রেকর্ড' : 'My Land Survey Bookings'}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            {isBn
              ? 'আপনার সকল আবেদনের বর্তমান অগ্রগতি ও চূড়ান্ত সার্ভে সার্টিফিকেট ট্র্যাক করুন।'
              : 'Track status, assigned surveyor progress, and official PDF survey certificates.'}
          </p>
        </div>

        <button
          onClick={onNewBookingClick}
          className="px-4 py-2.5 rounded-xl bg-white text-emerald-950 font-bold text-xs hover:bg-emerald-50 shrink-0 flex items-center gap-1.5 shadow-xs transition active:scale-95"
        >
          <PlusCircle className="w-4 h-4 text-emerald-700" />
          <span>{isBn ? 'নতুন সেবা নিন' : 'New Service Booking'}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'all', labelBn: 'সকল আবেদন', labelEn: 'All Requests', count: bookings.length },
          {
            id: 'active',
            labelBn: 'চলমান / প্রসেসিং',
            labelEn: 'In Progress',
            count: bookings.filter(
              (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'rejected'
            ).length,
          },
          {
            id: 'completed',
            labelBn: 'সম্পন্ন ও সার্টিফিকেট',
            labelEn: 'Completed',
            count: bookings.filter((b) => b.status === 'completed').length,
          },
          {
            id: 'cancelled',
            labelBn: 'বাতিলকৃত',
            labelEn: 'Cancelled',
            count: bookings.filter((b) => b.status === 'cancelled' || b.status === 'rejected').length,
          },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-emerald-850 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{isBn ? tab.labelBn : tab.labelEn}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">
            {isBn ? 'এই তালিকায় কোনো আবেদন পাওয়া যায়নি।' : 'No bookings found in this category.'}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isBn
              ? 'অভিজ্ঞ আমিনদের মাধ্যমে জমি মাপজোক, দখল নির্ধারণ বা ডিজিটাল নকশা তৈরি করতে নতুন বুকিং করুন।'
              : 'Book professional land survey, boundary demarcation, or digital CAD drawings.'}
          </p>
          <button
            onClick={onNewBookingClick}
            className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs inline-flex items-center gap-1.5 transition"
          >
            <span>{isBn ? 'আমিন সেবা দেখুন' : 'Explore Amin Services'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const sCfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
            const canCancel = b.status === 'pending' || b.status === 'under_review';

            return (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/60 shadow-xs hover:shadow-md transition-all space-y-3"
              >
                {/* Card Top Row: ID, Demo Badge, Status, Payment Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                      {b.id}
                    </span>
                    {b.isDemo && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        {isBn ? 'নমুনা' : 'Demo'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Payment Status Badge */}
                    {(() => {
                      const payMeta = getPaymentStatusMeta(b.paymentStatus, lang);
                      return (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${payMeta.badgeClass}`}
                          title={payMeta.description}
                        >
                          {payMeta.label}
                        </span>
                      );
                    })()}

                    {/* Booking Status Badge */}
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${sCfg.badgeBg} ${sCfg.badgeText} ${sCfg.badgeBorder}`}
                    >
                      {isBn ? sCfg.labelBn : sCfg.labelEn}
                    </span>
                  </div>
                </div>

                {/* Service Name & Land Location */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {isBn ? b.serviceNameBn : b.serviceNameEn}
                    </h3>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        মৌজা: <strong>{b.land.mouza}</strong>, দাগ: <strong>{b.land.dagNo}</strong> ({b.land.upazila}, {b.land.district})
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {isBn ? 'গ্রাহকের প্রদেয় মূল্য' : 'Payable'}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-900 font-mono">
                      {formatBDT(
                        b.pricing?.customerPayable ??
                          b.pricingSnapshot?.customerPayable ??
                          b.pricing.totalFee
                      )}
                    </span>
                  </div>
                </div>

                {/* Assigned Amin & Schedule Info */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>
                      {b.assignedAminName ? (
                        <>
                          আমিন: <strong className="text-slate-800">{b.assignedAminName}</strong>
                        </>
                      ) : (
                        <span className="italic text-slate-400">
                          {isBn ? 'আমিন বরাদ্দ প্রক্রিয়াধীন' : 'Assigning surveyor...'}
                        </span>
                      )}
                    </span>
                  </div>

                  {b.scheduledDate && (
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{b.scheduledDate}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Payment Button */}
                    {onOpenPayment && (
                      <button
                        onClick={() => onOpenPayment(b)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1 border border-emerald-200 transition active:scale-95"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{isBn ? 'পেমেন্ট' : 'Payment'}</span>
                      </button>
                    )}

                    {/* View Report (Phase 6) */}
                    {(b.linkedReportId || b.status === 'completed') && (
                      <button
                        onClick={() => onOpenReport(b.linkedSurveyId || 'srv-001', b.linkedReportId)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1 border border-slate-200 transition active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>{isBn ? 'রিপোর্ট দেখুন' : 'View Report'}</span>
                      </button>
                    )}

                    {/* Rate Amin (Completed) */}
                    {b.status === 'completed' && (
                      <button
                        onClick={() => onOpenRating(b)}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1 border border-amber-200 transition"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span>{isBn ? 'রেটিং' : 'Rate'}</span>
                      </button>
                    )}

                    {/* Complaint */}
                    <button
                      onClick={() => onOpenComplaint(b)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-800 text-slate-600 font-medium text-[11px] flex items-center gap-1 transition"
                    >
                      <AlertTriangle className="w-3 h-3 text-slate-400" />
                      <span>{isBn ? 'অভিযোগ' : 'Issue'}</span>
                    </button>

                    {/* Cancel (Only when allowed) */}
                    {canCancel && (
                      <button
                        onClick={() => onCancelBooking(b.id)}
                        className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-700 font-medium text-[11px] transition"
                      >
                        {isBn ? 'বাতিল' : 'Cancel'}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onSelectBooking(b)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-850 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95"
                  >
                    <span>{isBn ? 'বিস্তারিত' : 'Details'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
