import React, { useState } from 'react';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  MapPin,
  FileText,
  ShieldCheck,
  Compass,
  ArrowRight,
  ExternalLink,
  Phone,
  User,
  Plus,
  ChevronRight,
  Save,
  AlertTriangle,
} from 'lucide-react';
import {
  Language,
  CustomerBooking,
  AminProfile,
  BookingStatus,
  SurveyRecord,
} from '../../types';
import { STATUS_CONFIG } from '../../lib/marketplaceStorage';

interface AminDashboardProps {
  currentAmin: AminProfile;
  assignedBookings: CustomerBooking[];
  onUpdateBookingStatus: (
    bookingId: string,
    newStatus: BookingStatus,
    note?: string,
    linkedSurveyId?: string,
    scheduledDate?: string
  ) => void;
  onRejectAssignment: (bookingId: string, reason: string) => void;
  onOpenReport?: (surveyId?: string, reportId?: string) => void;
  onOpenSurvey?: (surveyId?: string, bookingId?: string) => void;
  surveys?: SurveyRecord[];
  lang: Language;
}

export const AminDashboard: React.FC<AminDashboardProps> = ({
  currentAmin,
  assignedBookings,
  onUpdateBookingStatus,
  onRejectAssignment,
  onOpenReport,
  onOpenSurvey,
  surveys = [],
  lang,
}) => {
  const isBn = lang === 'bn';

  // Sub-tab
  const [activeTab, setActiveTab] = useState<'assignments' | 'active' | 'qc' | 'completed'>(
    'assignments'
  );

  // Field notes editing state
  const [selectedBookingForUpdate, setSelectedBookingForUpdate] = useState<CustomerBooking | null>(
    null
  );
  const [fieldNote, setFieldNote] = useState('');
  const [scheduledDateInput, setScheduledDateInput] = useState('');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<CustomerBooking | null>(null);

  // Filter groups
  const newAssignments = assignedBookings.filter((b) => b.status === 'assigned');
  const activeJobs = assignedBookings.filter(
    (b) =>
      b.status === 'amin_accepted' ||
      b.status === 'scheduled' ||
      b.status === 'field_work' ||
      b.status === 'processing'
  );
  const qcJobs = assignedBookings.filter((b) => b.status === 'quality_check');
  const completedJobs = assignedBookings.filter((b) => b.status === 'completed');

  const handleOpenUpdateModal = (b: CustomerBooking) => {
    setSelectedBookingForUpdate(b);
    setFieldNote(b.aminNotes || '');
    setScheduledDateInput(b.scheduledDate || '');
    setSelectedSurveyId(b.linkedSurveyId || (surveys[0]?.id || ''));
  };

  const handleSaveProgress = (nextStatus: BookingStatus) => {
    if (!selectedBookingForUpdate) return;
    onUpdateBookingStatus(
      selectedBookingForUpdate.id,
      nextStatus,
      fieldNote.trim() || undefined,
      selectedSurveyId || undefined,
      scheduledDateInput || undefined
    );
    setSelectedBookingForUpdate(null);
  };

  return (
    <div id="amin-dashboard-view" className="space-y-4 animate-fadeIn">
      {/* Amin Profile Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white font-bold text-lg flex items-center justify-center shadow-xs">
            {currentAmin.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                {isBn ? 'আমিন ওয়ার্কস্পেস' : 'Amin Workspace'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                {isBn ? 'সনদপ্রাপ্ত' : 'Verified'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
              {currentAmin.name}
            </h2>
            <p className="text-xs text-slate-300">
              📞 {currentAmin.mobile} | {isBn ? 'অভিজ্ঞতা:' : 'Exp:'} {currentAmin.experienceYears}{' '}
              {isBn ? 'বছর' : 'years'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-xl bg-white/10 text-emerald-200 font-semibold">
            {isBn ? 'মোট কাজ:' : 'Total:'} {assignedBookings.length}
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-200 font-bold border border-amber-400/30">
            {isBn ? 'নতুন অ্যাসাইনমেন্ট:' : 'New:'} {newAssignments.length}
          </span>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          {
            id: 'assignments',
            labelBn: 'নতুন অ্যাসাইনমেন্ট',
            labelEn: 'New Offers',
            count: newAssignments.length,
          },
          {
            id: 'active',
            labelBn: 'চলমান ফিল্ড কাজ',
            labelEn: 'Active Jobs',
            count: activeJobs.length,
          },
          {
            id: 'qc',
            labelBn: 'মান যাচাইয়ে জমা',
            labelEn: 'Quality Check',
            count: qcJobs.length,
          },
          {
            id: 'completed',
            labelBn: 'সম্পন্ন রেকর্ড',
            labelEn: 'Completed',
            count: completedJobs.length,
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

      {/* Content Area */}
      {activeTab === 'assignments' && (
        <div className="space-y-3">
          {newAssignments.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">
                {isBn ? 'নতুন কোনো অ্যাসাইনমেন্ট অপেক্ষমাণ নেই।' : 'No pending new assignments.'}
              </h4>
              <p className="text-xs text-slate-500">
                {isBn
                  ? 'সুপারভাইজার অ্যাডমিন আপনার এলাকায় নতুন বুকিং নির্ধারণ করলে এখানে দেখা যাবে।'
                  : 'New customer bookings dispatched by admin will appear here.'}
              </p>
            </div>
          ) : (
            newAssignments.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white border-2 border-emerald-500/80 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                    {b.id}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                    {isBn ? 'সুপারভাইজার দ্বারা বরাদ্দকৃত' : 'Offered by Admin'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {isBn ? b.serviceNameBn : b.serviceNameEn}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    মৌজা: <strong>{b.land.mouza}</strong>, দাগ: <strong>{b.land.dagNo}</strong> ({b.land.upazila}, {b.land.district})
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    গ্রাহক: {b.customer.name} (📞 {b.customer.mobile})
                  </p>
                  <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2 rounded-xl">
                    প্রস্তাবিত তারিখ: <strong>{b.surveyRequirements.preferredDate || 'দ্রুততম সময়ে'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() =>
                      onUpdateBookingStatus(
                        b.id,
                        'amin_accepted',
                        isBn ? 'আমিন কাজ গ্রহণ করেছেন' : 'Amin accepted job assignment'
                      )
                    }
                    className="flex-1 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isBn ? 'কাজ গ্রহণ করুন' : 'Accept Assignment'}</span>
                  </button>

                  <button
                    onClick={() => setShowRejectModal(b)}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{isBn ? 'প্রত্যাখ্যান' : 'Reject'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Jobs */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {activeJobs.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-slate-500 text-xs">
              {isBn ? 'চলমান কোনো কাজ নেই।' : 'No active field jobs.'}
            </div>
          ) : (
            activeJobs.map((b) => {
              const sCfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      {b.id}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${sCfg.badgeBg} ${sCfg.badgeText} ${sCfg.badgeBorder}`}
                    >
                      {isBn ? sCfg.labelBn : sCfg.labelEn}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {isBn ? b.serviceNameBn : b.serviceNameEn}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      মৌজা: {b.land.mouza}, দাগ: {b.land.dagNo} ({b.land.upazila}, {b.land.district})
                    </p>
                    <p className="text-xs text-slate-700 mt-0.5 font-medium">
                      গ্রাহক: {b.customer.name} | 📞 {b.customer.mobile}
                    </p>
                    {b.scheduledDate && (
                      <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                        নির্ধারিত ফিল্ড তারিখ: {b.scheduledDate}
                      </p>
                    )}
                  </div>

                  {/* Admin QC Correction Notes if returned */}
                  {b.qualityCheckNotes && (
                    <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs text-amber-900 space-y-1 shadow-2xs">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{isBn ? 'সংশোধন আবশ্যক (সুপারভাইজার অডিট নির্দেশনা):' : 'Correction Requested (Admin QC):'}</span>
                      </div>
                      <p className="font-medium text-slate-800 bg-white/80 p-2 rounded-xl border border-amber-200">
                        {b.qualityCheckNotes}
                      </p>
                    </div>
                  )}

                  {b.aminNotes && (
                    <div className="p-2 rounded-xl bg-slate-50 text-[11px] text-slate-600">
                      <strong>নোট:</strong> {b.aminNotes}
                    </div>
                  )}

                  {/* Actions for Amin */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    {/* Launch or Link Survey (Phase 3-5) */}
                    {onOpenSurvey && (
                      <button
                        onClick={() => onOpenSurvey(b.linkedSurveyId, b.id)}
                        className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold text-xs flex items-center gap-1.5 border border-teal-200 transition"
                      >
                        <Compass className="w-3.5 h-3.5 text-teal-700" />
                        <span>
                          {b.linkedSurveyId
                            ? (isBn ? 'জিপিএস পরিমাপ দেখুন / সংশোধন' : 'View / Edit GPS Survey')
                            : (isBn ? 'জিপিএস পরিমাপ শুরু করুন' : 'Start GPS Survey')}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenUpdateModal(b)}
                      className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
                    >
                      <span>{isBn ? 'কাজের অগ্রগতি আপডেট' : 'Update Status / Notes'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* QC Submissions */}
      {activeTab === 'qc' && (
        <div className="space-y-3">
          {qcJobs.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-slate-500 text-xs">
              {isBn ? 'কোয়ালিটি চেকে কোনো কাজ জমা নেই।' : 'No submissions under quality check.'}
            </div>
          ) : (
            qcJobs.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white border border-orange-200 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-700">{b.id}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
                    {isBn ? 'অ্যাডমিন মান যাচাই অপেক্ষমাণ' : 'Pending Admin QC'}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {isBn ? b.serviceNameBn : b.serviceNameEn}
                </h4>
                <p className="text-xs text-slate-600">
                  মৌজা: {b.land.mouza}, দাগ: {b.land.dagNo}
                </p>
                <p className="text-xs text-slate-500 italic">
                  {isBn
                    ? 'আপনার জমা দেওয়া ফিল্ড ডাটা ও নকশা অ্যাডমিন পর্যালোচনা করছেন। অনুমোদিত হলে গ্রাহকের কাছে সার্টিফিকেট পৌঁছে যাবে।'
                    : 'Field data and survey certificate submitted for platform supervision approval.'}
                </p>

                {onOpenReport && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => onOpenReport(b.linkedSurveyId, b.linkedReportId)}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs flex items-center gap-1.5 border border-purple-200 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-purple-700" />
                      <span>{isBn ? 'জমা দেওয়া রিপোর্ট প্রিভিউ' : 'Preview Submitted Report'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Completed Jobs */}
      {activeTab === 'completed' && (
        <div className="space-y-3">
          {completedJobs.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-slate-500 text-xs">
              {isBn ? 'সম্পন্ন কোনো রেকর্ড নেই।' : 'No completed jobs yet.'}
            </div>
          ) : (
            completedJobs.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-slate-500">{b.id}</span>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                    {isBn ? b.serviceNameBn : b.serviceNameEn}
                  </h4>
                  <p className="text-xs text-slate-600">
                    মৌজা {b.land.mouza}, দাগ {b.land.dagNo} (৳{b.pricing.totalFee.toLocaleString()})
                  </p>
                </div>

                <button
                  onClick={() => onOpenReport && onOpenReport(b.linkedSurveyId || 'srv-001', b.linkedReportId)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1.5 border border-emerald-200 transition"
                >
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>{isBn ? 'সার্টিফিকেট' : 'Report'}</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* UPDATE STATUS MODAL FOR AMIN */}
      {selectedBookingForUpdate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono text-xs text-slate-500">
                  {selectedBookingForUpdate.id}
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  {isBn ? 'কাজের অগ্রগতি ও স্ট্যাটাস পরিবর্তন' : 'Update Job Progress'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBookingForUpdate(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Schedule Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'সরজমিনে পরিমাপের তারিখ' : 'Scheduled Field Date'}
              </label>
              <input
                type="date"
                value={scheduledDateInput}
                onChange={(e) => setScheduledDateInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
              />
            </div>

            {/* Link Existing Survey Record */}
            {surveys.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'সংরক্ষিত জিপিএস সার্ভে রেকর্ড লিংক করুন' : 'Link GPS Survey Record'}
                </label>
                <select
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600 bg-white"
                >
                  <option value="">{isBn ? '-- সার্ভে নির্বাচন করুন --' : '-- Select Survey --'}</option>
                  {surveys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.mouza}, দাগ {s.dagNo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Field Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'আমিনের ফিল্ড নোট ও মন্তব্য' : 'Field Notes & Observations'}
              </label>
              <textarea
                rows={3}
                value={fieldNote}
                onChange={(e) => setFieldNote(e.target.value)}
                placeholder={isBn ? 'পরিমাপের অবস্থা, সীমানা খুঁটি বা প্রতিবেশীদের উপস্থিতি...' : 'Field observations...'}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
              />
            </div>

            {/* Change Status Buttons */}
            <div className="space-y-1.5 pt-2 border-t">
              <span className="text-[11px] font-bold text-slate-500 block">
                {isBn ? 'পরবর্তী ধাপে অগ্রগতি নির্বাচন করুন:' : 'Select Next Workflow Step:'}
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveProgress('scheduled')}
                  className="py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs border border-sky-200 text-center transition"
                >
                  {isBn ? '১. তারিখ চূড়ান্ত (Scheduled)' : '1. Scheduled'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProgress('field_work')}
                  className="py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200 text-center transition"
                >
                  {isBn ? '২. ফিল্ডে কাজ চলছে' : '2. Field Work'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProgress('processing')}
                  className="py-2.5 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold text-xs border border-cyan-200 text-center transition"
                >
                  {isBn ? '৩. ডাটা প্রসেসিং' : '3. Processing'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProgress('quality_check')}
                  className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs text-center transition active:scale-95"
                >
                  {isBn ? '৪. মান যাচাইয়ে জমা দিন' : '4. Submit for QC'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 shadow-2xl border">
            <h4 className="font-bold text-slate-900 text-sm">
              {isBn ? 'অ্যাসাইনমেন্ট প্রত্যাখ্যানের কারণ' : 'Reason for Rejection'}
            </h4>
            <p className="text-xs text-slate-500">
              {isBn
                ? 'প্রত্যাখ্যান করলে অনুরোধটি সুপারভাইজার অ্যাডমিনের কাছে অন্য আমিনকে বরাদ্দের জন্য ফেরত যাবে।'
                : 'Rejecting will return the booking to the admin for reassignment.'}
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={isBn ? 'কারণ লিখুন (যেমন: এলাকা দূরে, সময় অনুপলব্ধ)...' : 'State reason...'}
              className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-rose-600"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowRejectModal(null)}
                className="px-4 py-2 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  onRejectAssignment(showRejectModal.id, rejectReason || 'আমিন অনুপলব্ধ');
                  setShowRejectModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                {isBn ? 'প্রত্যাখ্যান নিশ্চিত করুন' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
