import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileCheck2,
  Coins,
  Settings2,
  UserCheck,
  UserX,
  Search,
  Filter,
  ArrowRight,
  Eye,
  RefreshCw,
  Award,
  DollarSign,
  MessageSquare,
  FileText,
  Plus,
  Percent,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Save,
  AlertCircle,
  Check,
  HelpCircle,
  CreditCard,
  RotateCcw,
  Banknote,
  Smartphone,
} from 'lucide-react';
import {
  Language,
  CustomerBooking,
  AminProfile,
  AminApplication,
  MarketplaceService,
  CustomerComplaint,
  BookingStatus,
} from '../../types';
import { STATUS_CONFIG } from '../../lib/marketplaceStorage';
import {
  calculatePricingBreakdown,
  normalizeServicePricing,
  formatBDT,
  getPaymentStatusMeta,
  getPaymentMethodMeta,
  getPaymentSummary,
  PAYMENT_METHODS_CONFIG,
} from '../../lib/pricing-commission';

interface AdminDashboardProps {
  bookings: CustomerBooking[];
  amins: AminProfile[];
  applications: AminApplication[];
  services: MarketplaceService[];
  complaints: CustomerComplaint[];
  onAssignAmin: (bookingId: string, aminId: string, aminName: string, aminPhone: string) => void;
  onAdminChangeStatus: (bookingId: string, newStatus: BookingStatus, note: string) => void;
  onApproveQualityCheck: (bookingId: string) => void;
  onRequestCorrection: (bookingId: string, note: string) => void;
  onApproveAminApplication: (applicationId: string) => void;
  onRejectAminApplication: (applicationId: string) => void;
  onUpdateServiceFee: (serviceId: string, newBaseFee: number, newPlatformFee: number) => void;
  onSaveServicePricing?: (updatedService: MarketplaceService) => void;
  onToggleServiceStatus?: (serviceId: string, active: boolean) => void;
  onAddNewService?: (newService: MarketplaceService) => void;
  onResolveComplaint: (complaintId: string, resolutionNotes: string) => void;
  onOpenReport?: (surveyId?: string, reportId?: string) => void;
  onOpenPayment?: (booking: CustomerBooking) => void;
  lang: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  bookings,
  amins,
  applications,
  services,
  complaints,
  onAssignAmin,
  onAdminChangeStatus,
  onApproveQualityCheck,
  onRequestCorrection,
  onApproveAminApplication,
  onRejectAminApplication,
  onUpdateServiceFee,
  onSaveServicePricing,
  onToggleServiceStatus,
  onAddNewService,
  onResolveComplaint,
  onOpenReport,
  onOpenPayment,
  lang,
}) => {
  const isBn = lang === 'bn';

  const [activeTab, setActiveTab] = useState<
    'bookings' | 'qc' | 'amins' | 'services' | 'complaints' | 'finance'
  >('bookings');

  // Booking filtering
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBookingForAssign, setSelectedBookingForAssign] = useState<CustomerBooking | null>(
    null
  );
  const [selectedAminId, setSelectedAminId] = useState<string>('');

  // QC modal
  const [qcCorrectionModal, setQcCorrectionModal] = useState<CustomerBooking | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');

  // Complaint resolution modal
  const [resolvingComplaint, setResolvingComplaint] = useState<CustomerComplaint | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  // Phase 17A: Pricing & Commission Administration State
  const [editingService, setEditingService] = useState<MarketplaceService | null>(null);
  const [isAddingNewService, setIsAddingNewService] = useState(false);

  const [formBasePrice, setFormBasePrice] = useState<number>(2000);
  const [formMinPrice, setFormMinPrice] = useState<string>('');
  const [formMaxPrice, setFormMaxPrice] = useState<string>('');
  const [formCommissionPercentage, setFormCommissionPercentage] = useState<number>(10);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formNameBn, setFormNameBn] = useState<string>('');
  const [formNameEn, setFormNameEn] = useState<string>('');
  const [formShortDescBn, setFormShortDescBn] = useState<string>('');
  const [formShortDescEn, setFormShortDescEn] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('measurement');
  const [pricingFormError, setPricingFormError] = useState<string>('');
  const [pricingSuccessNotice, setPricingSuccessNotice] = useState<string>('');

  // Service list filter & search
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Metric counts
  const pendingCount = bookings.filter((b) => b.status === 'pending' || b.status === 'under_review').length;
  const inProgressCount = bookings.filter(
    (b) =>
      b.status === 'assigned' ||
      b.status === 'amin_accepted' ||
      b.status === 'scheduled' ||
      b.status === 'field_work' ||
      b.status === 'processing'
  ).length;
  const qcCount = bookings.filter((b) => b.status === 'quality_check').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const openComplaintsCount = complaints.filter(
    (c) => c.status === 'submitted' || c.status === 'under_investigation'
  ).length;

  const totalGrossValue = bookings.reduce(
    (sum, b) => sum + (b.pricing.customerPayable ?? b.pricing.totalFee),
    0
  );
  const totalPlatformFees = bookings.reduce(
    (sum, b) => sum + (b.pricing.platformCommission ?? b.pricing.platformFee),
    0
  );
  const totalAminEarnings = bookings.reduce(
    (sum, b) =>
      sum +
      (b.pricing.aminEarning ??
        Math.max(
          0,
          (b.pricing.customerPayable ?? b.pricing.totalFee) -
            (b.pricing.platformCommission ?? b.pricing.platformFee)
        )),
    0
  );

  const paidBookingsCount = bookings.filter((b) => b.paymentStatus === 'paid').length;
  const unpaidBookingsCount = bookings.filter((b) => b.paymentStatus !== 'paid').length;

  // Phase 17B: Comprehensive Payment Summary & Ledger State
  const paymentSummary = getPaymentSummary(bookings);
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<string>('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState<string>('');

  const filteredPaymentBookings = bookings.filter((b) => {
    const pStatus = b.paymentStatus || 'unpaid';
    const statusMatch =
      paymentFilterStatus === 'all'
        ? true
        : paymentFilterStatus === 'pending'
        ? pStatus === 'payment_pending' || pStatus === 'pending'
        : pStatus === paymentFilterStatus;

    if (!statusMatch) return false;
    if (!paymentSearchQuery.trim()) return true;

    const query = paymentSearchQuery.toLowerCase().trim();
    const idMatch = b.id.toLowerCase().includes(query);
    const nameMatch = b.customer.name.toLowerCase().includes(query);
    const phoneMatch = b.customer.mobile.includes(query);
    const refMatch = (b.paymentReference || '').toLowerCase().includes(query);
    return idMatch || nameMatch || phoneMatch || refMatch;
  });

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  const verifiedAmins = amins.filter((a) => a.verificationStatus === 'verified');
  const pendingApplications = applications.filter((app) => app.status === 'pending');

  // Pricing Handlers
  const handleOpenEditPricing = (s: MarketplaceService) => {
    setEditingService(s);
    setIsAddingNewService(false);
    setFormBasePrice(s.basePrice || s.baseFee || 2000);
    setFormMinPrice(s.minPrice ? s.minPrice.toString() : '');
    setFormMaxPrice(s.maxPrice ? s.maxPrice.toString() : '');
    setFormCommissionPercentage(s.commissionPercentage ?? 10);
    setFormActive(s.active !== false);
    setFormNameBn(s.nameBn);
    setFormNameEn(s.nameEn);
    setFormShortDescBn(s.shortDescBn || '');
    setFormShortDescEn(s.shortDescEn || '');
    setFormCategory(s.category || 'measurement');
    setPricingFormError('');
  };

  const handleOpenAddNewService = () => {
    setEditingService(null);
    setIsAddingNewService(true);
    setFormBasePrice(2500);
    setFormMinPrice('2000');
    setFormMaxPrice('5000');
    setFormCommissionPercentage(10);
    setFormActive(true);
    setFormNameBn('');
    setFormNameEn('');
    setFormShortDescBn('');
    setFormShortDescEn('');
    setFormCategory('measurement');
    setPricingFormError('');
  };

  const handleSavePricingConfig = () => {
    if (formBasePrice <= 0 || isNaN(formBasePrice)) {
      setPricingFormError(
        isBn
          ? 'সঠিক মূল সার্ভিস মূল্য দিন (শূন্যের বেশি হতে হবে)।'
          : 'Please enter valid positive base price.'
      );
      return;
    }
    if (
      formCommissionPercentage < 0 ||
      formCommissionPercentage > 100 ||
      isNaN(formCommissionPercentage)
    ) {
      setPricingFormError(
        isBn
          ? 'কমিশন শতকরা ০ থেকে ১০০ এর মধ্যে হতে হবে।'
          : 'Commission must be between 0% and 100%.'
      );
      return;
    }

    const minNum = formMinPrice.trim() ? parseFloat(formMinPrice) : undefined;
    const maxNum = formMaxPrice.trim() ? parseFloat(formMaxPrice) : undefined;

    if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
      setPricingFormError(
        isBn
          ? 'সর্বনিম্ন মূল্য সর্বোচ্চ মূল্যের চেয়ে বেশি হতে পারে না।'
          : 'Minimum price cannot exceed maximum price.'
      );
      return;
    }

    const breakdown = calculatePricingBreakdown(formBasePrice, formCommissionPercentage);

    if (isAddingNewService) {
      if (!formNameBn.trim() || !formNameEn.trim()) {
        setPricingFormError(
          isBn
            ? 'সার্ভিসের বাংলা ও ইংরেজি নাম লিখুন।'
            : 'Service name (BN & EN) is required.'
        );
        return;
      }
      const newService: MarketplaceService = normalizeServicePricing({
        id: `srvc-custom-${Date.now()}`,
        nameBn: formNameBn.trim(),
        nameEn: formNameEn.trim(),
        category: (formCategory as any) || 'survey',
        shortDescBn: formShortDescBn.trim() || formNameBn.trim(),
        shortDescEn: formShortDescEn.trim() || formNameEn.trim(),
        descriptionBn: formShortDescBn.trim() || formNameBn.trim(),
        descriptionEn: formShortDescEn.trim() || formNameEn.trim(),
        includedBn: ['জরিপ রিপোর্ট', 'ডিজিটাল নকশা'],
        includedEn: ['Survey Report', 'Digital Map'],
        requiredCustomerInfoBn: ['নাম', 'মোবাইল নম্বর'],
        requiredCustomerInfoEn: ['Name', 'Mobile Number'],
        requiredLandInfoBn: ['মৌজা', 'দাগ নম্বর'],
        requiredLandInfoEn: ['Mouza', 'Dag Number'],
        disclaimerBn: 'প্রস্তুতকৃত রিপোর্ট প্রাথমিক যাচাইয়ের জন্য প্রযোজ্য।',
        disclaimerEn: 'Prepared report is subject to standard surveyor verification.',
        estimatedDays: '১-২ দিন',
        iconName: 'Compass',
        basePrice: breakdown.basePrice,
        baseFee: breakdown.basePrice,
        minPrice: minNum,
        maxPrice: maxNum,
        commissionPercentage: breakdown.commissionPercentage,
        platformCommission: breakdown.platformCommission,
        aminEarning: breakdown.aminEarning,
        platformEarning: breakdown.platformEarning,
        customerPayable: breakdown.customerPayable,
        platformFee: breakdown.platformCommission,
        currency: 'BDT',
        active: formActive,
      });

      if (onAddNewService) {
        onAddNewService(newService);
      } else if (onSaveServicePricing) {
        onSaveServicePricing(newService);
      } else {
        onUpdateServiceFee(newService.id, newService.baseFee, newService.platformFee);
      }
      setIsAddingNewService(false);
      setPricingSuccessNotice(
        isBn
          ? `“${newService.nameBn}” সেবা যুক্ত ও মূল্য কনফিগারেশন সংরক্ষিত হয়েছে।`
          : `Service "${newService.nameEn}" added and pricing saved.`
      );
    } else if (editingService) {
      const updated: MarketplaceService = normalizeServicePricing({
        ...editingService,
        basePrice: breakdown.basePrice,
        baseFee: breakdown.basePrice,
        minPrice: minNum,
        maxPrice: maxNum,
        commissionPercentage: breakdown.commissionPercentage,
        platformCommission: breakdown.platformCommission,
        aminEarning: breakdown.aminEarning,
        platformEarning: breakdown.platformEarning,
        customerPayable: breakdown.customerPayable,
        platformFee: breakdown.platformCommission,
        active: formActive,
        nameBn: formNameBn.trim() || editingService.nameBn,
        nameEn: formNameEn.trim() || editingService.nameEn,
        shortDescBn: formShortDescBn.trim() || editingService.shortDescBn,
        shortDescEn: formShortDescEn.trim() || editingService.shortDescEn,
      });

      if (onSaveServicePricing) {
        onSaveServicePricing(updated);
      } else {
        onUpdateServiceFee(updated.id, updated.baseFee, updated.platformFee);
      }
      setEditingService(null);
      setPricingSuccessNotice(
        isBn
          ? `“${updated.nameBn}” সেবার মূল্য ও কমিশন সফলভাবে সংরক্ষিত হয়েছে।`
          : `Pricing configuration updated for "${updated.nameEn}".`
      );
    }

    setTimeout(() => {
      setPricingSuccessNotice('');
    }, 4500);
  };

  const handleToggleActiveState = (s: MarketplaceService) => {
    const nextActive = s.active === false;
    const updated: MarketplaceService = { ...s, active: nextActive };
    if (onToggleServiceStatus) {
      onToggleServiceStatus(s.id, nextActive);
    } else if (onSaveServicePricing) {
      onSaveServicePricing(updated);
    }
    setPricingSuccessNotice(
      isBn
        ? `“${s.nameBn}” সেবা ${nextActive ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয় (Disabled)'} করা হয়েছে।`
        : `Service "${s.nameEn}" set to ${nextActive ? 'Active' : 'Disabled'}.`
    );
    setTimeout(() => setPricingSuccessNotice(''), 3500);
  };

  return (
    <div id="admin-supervision-view" className="space-y-4 animate-fadeIn">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              {isBn ? 'সুপারভিশন কন্ট্রোল প্যানেল' : 'Platform Supervision Center'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
            {isBn ? 'ভূমি ও আমিন — কেন্দ্রীয় প্রশাসন' : 'Bhumi & Amin — Central Admin'}
          </h2>
          <p className="text-xs text-slate-300">
            {isBn
              ? 'সার্ভিস বরাদ্দ, আমিন ভেরিফিকেশন, কোয়ালিটি কন্ট্রোল ও বিরোধ নিষ্পত্তি পরিচালনা করুন।'
              : 'Dispatch bookings, verify surveyors, audit quality check, and resolve complaints.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-1 rounded-xl bg-white/10 text-white font-mono">
            {isBn ? 'মোট বুকিং:' : 'Total:'} {bookings.length}
          </span>
          {openComplaintsCount > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-rose-500/30 text-rose-200 border border-rose-400/40 font-bold">
              {isBn ? 'অভিযোগ:' : 'Disputes:'} {openComplaintsCount}
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80">
          <span className="text-[10px] text-amber-700 block font-bold uppercase">
            {isBn ? 'পর্যালোচনা অপেক্ষমাণ' : 'Pending Review'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-900">{pendingCount}</span>
        </div>

        <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200/80">
          <span className="text-[10px] text-blue-700 block font-bold uppercase">
            {isBn ? 'চলমান ফিল্ড কাজ' : 'In Progress'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-blue-900">{inProgressCount}</span>
        </div>

        <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200/80">
          <span className="text-[10px] text-orange-700 block font-bold uppercase">
            {isBn ? 'কোয়ালিটি চেক' : 'Quality Check'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-orange-900">{qcCount}</span>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80">
          <span className="text-[10px] text-emerald-700 block font-bold uppercase">
            {isBn ? 'সম্পন্ন ও প্রদত্ত' : 'Completed'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-900">{completedCount}</span>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'bookings', labelBn: 'বুকিং ব্যবস্থাপনা', labelEn: 'Bookings', count: bookings.length },
          { id: 'qc', labelBn: 'কোয়ালিটি কন্ট্রোল', labelEn: 'Quality Control', count: qcCount },
          {
            id: 'amins',
            labelBn: 'আমিন যাচাই ও তালিকা',
            labelEn: 'Amins & Applicants',
            count: pendingApplications.length > 0 ? `${amins.length} (${pendingApplications.length} New)` : amins.length,
          },
          { id: 'services', labelBn: 'সেবা ও মূল্য কনফিগারেশন', labelEn: 'Services & Fees', count: services.length },
          { id: 'complaints', labelBn: 'অভিযোগ ও নিষ্পত্তি', labelEn: 'Complaints', count: complaints.length },
          { id: 'finance', labelBn: 'আর্থিক ওভারভিউ', labelEn: 'Financials', count: '৳' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{isBn ? tab.labelBn : tab.labelEn}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BOOKING MANAGEMENT */}
      {activeTab === 'bookings' && (
        <div className="space-y-3">
          {/* Filter by status */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 font-medium shrink-0">{isBn ? 'ফিল্টার:' : 'Filter:'}</span>
            {[
              { id: 'all', labelBn: 'সকল', labelEn: 'All' },
              { id: 'pending', labelBn: 'অপেক্ষমাণ', labelEn: 'Pending' },
              { id: 'assigned', labelBn: 'বরাদ্দকৃত', labelEn: 'Assigned' },
              { id: 'field_work', labelBn: 'ফিল্ড কাজ', labelEn: 'Field Work' },
              { id: 'quality_check', labelBn: 'QC চেক', labelEn: 'QC' },
              { id: 'completed', labelBn: 'সম্পন্ন', labelEn: 'Completed' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  statusFilter === f.id
                    ? 'bg-emerald-850 text-white'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {isBn ? f.labelBn : f.labelEn}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredBookings.map((b) => {
              const sCfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {b.id}
                      </span>
                      {b.isDemo && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Demo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${sCfg.badgeBg} ${sCfg.badgeText} ${sCfg.badgeBorder}`}
                      >
                        {isBn ? sCfg.labelBn : sCfg.labelEn}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          b.paymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {b.paymentStatus === 'paid' ? (isBn ? 'পরিশোধিত' : 'Paid') : (isBn ? 'নগদ প্রদেয়' : 'Cash Payable')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {isBn ? b.serviceNameBn : b.serviceNameEn}
                      </h4>
                      <p className="text-slate-600 mt-0.5">
                        মৌজা: {b.land.mouza}, দাগ: {b.land.dagNo} ({b.land.upazila}, {b.land.district})
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        গ্রাহক: {b.customer.name} (📞 {b.customer.mobile})
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">{isBn ? 'নিযুক্ত আমিন:' : 'Assigned Amin:'}</span>
                        <span className="font-bold text-slate-800">
                          {b.assignedAminName || (isBn ? 'বরাদ্দ নেই' : 'Unassigned')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-slate-500">{isBn ? 'গ্রাহকের প্রদেয়:' : 'Customer Payable:'}</span>
                        <span className="font-extrabold text-emerald-850 font-mono">
                          {formatBDT(b.pricing.customerPayable ?? b.pricing.totalFee)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5 border-t border-slate-200/60 pt-0.5 font-mono">
                        <span>{isBn ? 'আমিন অংশ: ' : 'Amin: '}{formatBDT(b.pricing.aminEarning ?? Math.max(0, (b.pricing.customerPayable ?? b.pricing.totalFee) - (b.pricing.platformCommission ?? b.pricing.platformFee)))}</span>
                        <span>{isBn ? 'কমিশন: ' : 'Comm: '}{formatBDT(b.pricing.platformCommission ?? b.pricing.platformFee)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Admin */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Assign Amin Button */}
                      <button
                        onClick={() => {
                          setSelectedBookingForAssign(b);
                          setSelectedAminId(b.assignedAminId || (verifiedAmins[0]?.id || ''));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center gap-1 border border-indigo-200 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-indigo-700" />
                        <span>{b.assignedAminId ? (isBn ? 'পুনর্বরাদ্দ' : 'Reassign') : isBn ? 'আমিন বরাদ্দ করুন' : 'Assign Amin'}</span>
                      </button>

                      {/* Payment Management Button (Phase 17B) */}
                      {onOpenPayment && (
                        <button
                          onClick={() => onOpenPayment(b)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-950 font-bold text-xs flex items-center gap-1 border border-slate-200 hover:border-emerald-300 transition"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{isBn ? 'পেমেন্ট পরিচালনা' : 'Payment'}</span>
                        </button>
                      )}

                      {/* Status Override */}
                      <button
                        onClick={() =>
                          onAdminChangeStatus(
                            b.id,
                            'completed',
                            isBn ? 'অ্যাডমিন কর্তৃক চূড়ান্ত অনুমোদন' : 'Admin final approval'
                          )
                        }
                        disabled={b.status === 'completed'}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1 border border-emerald-200 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{isBn ? 'সম্পন্ন ঘোষণা' : 'Complete'}</span>
                      </button>
                    </div>

                    {/* View Certificate */}
                    {(b.linkedReportId || b.status === 'completed') && (
                      <button
                        onClick={() => onOpenReport && onOpenReport(b.linkedSurveyId || 'srv-001', b.linkedReportId)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isBn ? 'রিপোর্ট' : 'Report'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: QUALITY CONTROL (QC) */}
      {activeTab === 'qc' && (
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs">
            <span className="font-bold block">
              {isBn ? 'সার্ভে মান নিয়ন্ত্রণ ও সার্টিফিকেশন ডেস্ক' : 'Quality Control Audit Desk'}
            </span>
            <p className="text-[11px] mt-0.5">
              {isBn
                ? 'আমিনের জমা দেওয়া পরিমাপ, জিওমেট্রি ও ফিল্ড নোট যাচাই করে অনুমোদন দিন। অনুমোদনের পরই গ্রাহকের কাছে চূড়ান্ত ডিজিটাল রিপোর্ট পৌঁছাবে।'
                : 'Inspect field measurements and notes. Approving will generate the official survey certificate for the customer.'}
            </p>
          </div>

          {bookings.filter((b) => b.status === 'quality_check').length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              {isBn ? 'বর্তমানে কোনো কাজ কোয়ালিটি চেকে অপেক্ষমাণ নেই।' : 'No submissions awaiting QC.'}
            </div>
          ) : (
            bookings
              .filter((b) => b.status === 'quality_check')
              .map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white border-2 border-orange-300 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-700">{b.id}</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300">
                      {isBn ? 'যাচাই অপেক্ষমাণ' : 'Pending Audit'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {isBn ? b.serviceNameBn : b.serviceNameEn}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      মৌজা: {b.land.mouza}, দাগ: {b.land.dagNo} ({b.land.upazila}, {b.land.district})
                    </p>
                    <p className="text-xs text-slate-700 mt-1">
                      আমিন: <strong>{b.assignedAminName}</strong> (📞 {b.assignedAminPhone})
                    </p>
                    {b.aminNotes && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 text-xs text-slate-700 border">
                        <strong className="block text-[11px] text-slate-900 mb-0.5">
                          আমিনের ফিল্ড পর্যবেক্ষণ:
                        </strong>
                        {b.aminNotes}
                      </div>
                    )}
                  </div>

                  {/* Actions for QC */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setQcCorrectionModal(b);
                          setCorrectionNote('');
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1.5 border border-rose-200 transition"
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>{isBn ? 'সংশোধনের নির্দেশ' : 'Request Revision'}</span>
                      </button>

                      {onOpenReport && (
                        <button
                          onClick={() => onOpenReport(b.linkedSurveyId, b.linkedReportId)}
                          className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center gap-1.5 border border-blue-200 transition"
                        >
                          <FileText className="w-4 h-4 text-blue-700" />
                          <span>{isBn ? 'রিপোর্ট পর্যালোচনা' : 'Review Report'}</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => onApproveQualityCheck(b.id)}
                      className="px-5 py-2 rounded-xl bg-emerald-850 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isBn ? 'অনুমোদন ও সার্টিফিকেট ইস্যু' : 'Approve & Issue Certificate'}</span>
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* TAB 3: AMINS & APPLICANTS */}
      {activeTab === 'amins' && (
        <div className="space-y-4">
          {/* Pending Applications */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>{isBn ? 'নতুন আমিন আবেদনপত্র (অপেক্ষমাণ)' : 'Pending Amin Applications'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
                {pendingApplications.length}
              </span>
            </h3>

            {pendingApplications.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-white rounded-xl border">
                {isBn ? 'নতুন কোনো আবেদন অপেক্ষমাণ নেই।' : 'No pending applications.'}
              </p>
            ) : (
              pendingApplications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">{app.applicantName}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {isBn ? 'যাচাই প্রয়োজন' : 'Verification Required'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    📞 {app.mobile} | {app.district}, {app.upazila} | অভিজ্ঞতা: {app.experienceYears} বছর
                  </p>
                  <p className="text-xs text-slate-500">
                    সনদ: {app.credentials} | এলাকা: {app.serviceAreas}
                  </p>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onApproveAminApplication(app.id)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isBn ? 'অনুমোদন ও অ্যাক্টিভ' : 'Approve & Verify'}</span>
                    </button>

                    <button
                      onClick={() => onRejectAminApplication(app.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1 border border-rose-200 transition"
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-600" />
                      <span>{isBn ? 'বাতিল' : 'Reject'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Active Verified Amins List */}
          <div className="space-y-2 pt-3 border-t">
            <h3 className="font-bold text-slate-900 text-sm">
              {isBn ? 'বর্তমানে তালিকাভুক্ত সার্টিফাইড আমিন' : 'Active Verified Amins'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {verifiedAmins.map((amin) => (
                <div
                  key={amin.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{amin.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      📞 {amin.mobile} | {amin.serviceDistricts.join(', ')}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
                      <span>রেটিং: ★ {amin.rating}</span>
                      <span>কাজ: {amin.completedJobsCount}টি</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {isBn ? 'ভেরিফাইড' : 'Active'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SERVICES & PRICING CONTROLS (Phase 17A) */}
      {activeTab === 'services' && (
        <div className="space-y-3.5">
          {/* Success Banner */}
          {pricingSuccessNotice && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-2xs">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{pricingSuccessNotice}</span>
            </div>
          )}

          {/* Top Info & Action Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-emerald-800" />
                <span>{isBn ? 'সার্ভিস প্রাইসিং ও কমিশন কন্ট্রোল' : 'Service Pricing & Commission Controls'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isBn
                  ? 'প্রতিটি সার্ভিসের মূল দাম, রেঞ্জ, কমিশন শতকরা হার নির্ধারণ করুন। হিসাব স্বয়ংক্রিয়ভাবে কার্যকর হবে।'
                  : 'Configure base prices, min/max range, and commission rates with automatic calculation.'}
              </p>
            </div>

            <button
              onClick={handleOpenAddNewService}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? 'নতুন সার্ভিস যোগ করুন' : 'Add New Service'}</span>
            </button>
          </div>

          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
                placeholder={isBn ? 'সার্ভিসের নাম লিখে খুঁজুন...' : 'Search services by name...'}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-emerald-700"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(['all', 'active', 'inactive'] as const).map((filterVal) => (
                <button
                  key={filterVal}
                  onClick={() => setServiceStatusFilter(filterVal)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition ${
                    serviceStatusFilter === filterVal
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {filterVal === 'all'
                    ? isBn ? `সকল (${services.length})` : `All (${services.length})`
                    : filterVal === 'active'
                    ? isBn ? `সক্রিয় (${services.filter((s) => s.active !== false).length})` : `Active (${services.filter((s) => s.active !== false).length})`
                    : isBn ? `নিষ্ক্রিয় (${services.filter((s) => s.active === false).length})` : `Disabled (${services.filter((s) => s.active === false).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Services Cards List */}
          <div className="space-y-3">
            {services
              .filter((s) => {
                if (serviceStatusFilter === 'active' && s.active === false) return false;
                if (serviceStatusFilter === 'inactive' && s.active !== false) return false;
                if (!serviceSearchQuery.trim()) return true;
                const query = serviceSearchQuery.toLowerCase();
                return (
                  s.nameBn.toLowerCase().includes(query) ||
                  s.nameEn.toLowerCase().includes(query)
                );
              })
              .map((s) => {
                const normalized = normalizeServicePricing(s);
                const isActive = normalized.active !== false;

                return (
                  <div
                    key={normalized.id}
                    className={`p-4 rounded-2xl border transition shadow-2xs ${
                      isActive ? 'bg-white border-slate-200' : 'bg-slate-50/80 border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                            {isBn ? normalized.nameBn : normalized.nameEn}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                          >
                            {isActive ? (isBn ? 'সক্রিয় (Active)' : 'Active') : (isBn ? 'নিষ্ক্রিয় (Disabled)' : 'Disabled')}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                            {normalized.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {isBn ? normalized.shortDescBn : normalized.shortDescEn}
                        </p>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => handleToggleActiveState(normalized)}
                          title={isActive ? (isBn ? 'সার্ভিস বন্ধ করুন' : 'Disable Service') : (isBn ? 'সার্ভিস চালু করুন' : 'Enable Service')}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition ${
                            isActive
                              ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-emerald-700" />
                              <span>{isBn ? 'বন্ধ করুন' : 'Disable'}</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-slate-400" />
                              <span>{isBn ? 'চালু করুন' : 'Enable'}</span>
                            </>
                          )}
                        </button>

                        {/* Edit Pricing Configuration Modal trigger */}
                        <button
                          onClick={() => handleOpenEditPricing(normalized)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isBn ? 'প্রাইসিং কনফিগার' : 'Edit Pricing'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Pricing Breakdown Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">{isBn ? 'মূল সার্ভিস মূল্য' : 'Base Price'}</span>
                        <span className="font-bold text-slate-900 text-sm font-mono">
                          {formatBDT(normalized.basePrice)}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">{isBn ? 'মূল্য সীমা' : 'Price Range'}</span>
                        <span className="font-semibold text-slate-700 text-xs font-mono">
                          {normalized.minPrice || normalized.maxPrice
                            ? `৳${normalized.minPrice || 0} - ৳${normalized.maxPrice || '∞'}`
                            : isBn ? 'ফিক্সড রেট' : 'Fixed'}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 block font-semibold">
                          {isBn ? `প্ল্যাটফর্ম কমিশন (${normalized.commissionPercentage}%)` : `Commission (${normalized.commissionPercentage}%)`}
                        </span>
                        <span className="font-bold text-emerald-900 text-sm font-mono">
                          {formatBDT(normalized.platformEarning)}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100">
                        <span className="text-[10px] text-blue-700 block font-semibold">
                          {isBn ? 'আমিনের প্রাপ্য আয়' : 'Amin Earning'}
                        </span>
                        <span className="font-bold text-blue-900 text-sm font-mono">
                          {formatBDT(normalized.aminEarning)}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900 text-white col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-300 block">{isBn ? 'গ্রাহকের প্রদেয়' : 'Customer Payable'}</span>
                        <span className="font-black text-emerald-400 text-sm font-mono">
                          {formatBDT(normalized.customerPayable)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 5: COMPLAINTS & DISPUTES */}
      {activeTab === 'complaints' && (
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
            <span className="font-bold block">
              {isBn ? 'গ্রাহক অভিযোগ ও বিরোধ নিষ্পত্তি ডায়েরি' : 'Customer Complaints & Grievance Redressal'}
            </span>
            <p className="text-[11px] mt-0.5">
              {isBn
                ? 'জরিপের নিরপেক্ষতা ও গ্রাহক সন্তুষ্টি নিশ্চিতে সকল অভিযোগ তদন্ত সাপেক্ষে নিরপেক্ষ নোটসহ নিষ্পত্তি করুন।'
                : 'Platform supervision investigates customer issues and ensures neutral dispute resolution.'}
            </p>
          </div>

          {complaints.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              {isBn ? 'কোনো সক্রিয় অভিযোগ নেই।' : 'No customer complaints on record.'}
            </div>
          ) : (
            complaints.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-700">
                    বুকিং #{c.bookingId}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      c.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {c.customerName} (📞 {c.customerMobile})
                  </h4>
                  <p className="text-xs text-rose-800 font-semibold mt-0.5">
                    ধরণ: {c.issueType}
                  </p>
                  <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2 rounded-xl">
                    {c.description}
                  </p>
                </div>

                {c.resolutionNotes && (
                  <div className="p-2 rounded-xl bg-emerald-50 text-xs text-emerald-900">
                    <strong>নিষ্পত্তি নোট:</strong> {c.resolutionNotes}
                  </div>
                )}

                {c.status !== 'resolved' && (
                  <div className="pt-2 border-t flex justify-end">
                    <button
                      onClick={() => {
                        setResolvingComplaint(c);
                        setResolutionText('');
                      }}
                      className="px-4 py-1.5 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition"
                    >
                      {isBn ? 'অভিযোগ নিষ্পত্তি করুন' : 'Resolve Issue'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 6: FINANCIALS & COMMISSION BREAKDOWN (Phase 17A & 17B) */}
      {activeTab === 'finance' && (
        <div className="space-y-5">
          {/* Top High-Level Volume Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-900 to-teal-800 text-white shadow-xs">
              <span className="text-xs uppercase font-bold text-emerald-200">
                {isBn ? 'গ্রাহকদের মোট প্রদেয় মূল্য' : 'Total Customer Payable'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black mt-1 font-mono">
                {formatBDT(paymentSummary.totalPayable)}
              </h3>
              <p className="text-xs text-emerald-100/80 mt-1">
                {isBn
                  ? `সর্বমোট ${paymentSummary.counts.total} টি বুকিংয়ের সর্বমোট আর্থিক মূল্য`
                  : `Total financial volume across ${paymentSummary.counts.total} bookings.`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-tr from-indigo-950 to-slate-900 text-white shadow-xs">
              <span className="text-xs uppercase font-bold text-indigo-300">
                {isBn ? 'প্ল্যাটফর্ম মোট কমিশন আয়' : 'Platform Total Commission'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black mt-1 font-mono text-emerald-400">
                {formatBDT(totalPlatformFees)}
              </h3>
              <p className="text-xs text-indigo-200 mt-1">
                {isBn
                  ? 'মান নিশ্চিতকরণ, ভেরিফিকেশন ও তদারকি কমিশন'
                  : 'Total quality control & platform fee.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-tr from-blue-950 to-slate-900 text-white shadow-xs">
              <span className="text-xs uppercase font-bold text-blue-300">
                {isBn ? 'আমিনদের প্রাপ্য মোট পারিশ্রমিক' : 'Total Amin Earnings'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black mt-1 font-mono text-blue-400">
                {formatBDT(totalAminEarnings)}
              </h3>
              <p className="text-xs text-blue-200 mt-1">
                {isBn ? 'সার্ভেয়ারদের নেট প্রাপ্য অর্থ' : 'Net payable earnings to surveyors.'}
              </p>
            </div>
          </div>

          {/* Phase 17B: 5-State Payment Summary Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <span>
                  {isBn
                    ? 'পেমেন্ট অবস্থাভিত্তিক পরিসংখ্যান (Payment Summary)'
                    : 'Payment Status Breakdown & Volume'}
                </span>
              </h4>
              <span className="text-xs font-mono text-slate-500">
                {isBn ? 'বাস্তব বুকিং ভিত্তিক হিসাব' : 'Real Booking Data Driven'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* 1. Paid */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{isBn ? 'পরিশোধিত' : 'Paid'}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg sm:text-xl font-black font-mono">
                  {formatBDT(paymentSummary.paidAmount)}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold">
                  {paymentSummary.counts.paid} {isBn ? 'টি বুকিং' : 'bookings'}
                </div>
              </div>

              {/* 2. Pending */}
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{isBn ? 'পেন্ডিং / অপেক্ষমান' : 'Pending'}</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg sm:text-xl font-black font-mono">
                  {formatBDT(paymentSummary.pendingAmount)}
                </div>
                <div className="text-[11px] text-blue-700 font-semibold">
                  {paymentSummary.counts.pending} {isBn ? 'টি বুকিং' : 'bookings'}
                </div>
              </div>

              {/* 3. Unpaid / Cash */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{isBn ? 'অপরিশোধিত / নগদ' : 'Unpaid'}</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-lg sm:text-xl font-black font-mono">
                  {formatBDT(paymentSummary.unpaidAmount)}
                </div>
                <div className="text-[11px] text-amber-700 font-semibold">
                  {paymentSummary.counts.unpaid} {isBn ? 'টি বুকিং' : 'bookings'}
                </div>
              </div>

              {/* 4. Failed */}
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{isBn ? 'ব্যর্থ' : 'Failed'}</span>
                  <XCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-lg sm:text-xl font-black font-mono">
                  {formatBDT(paymentSummary.failedAmount)}
                </div>
                <div className="text-[11px] text-rose-700 font-semibold">
                  {paymentSummary.counts.failed} {isBn ? 'টি বুকিং' : 'bookings'}
                </div>
              </div>

              {/* 5. Refunded */}
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 space-y-1 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{isBn ? 'রিফান্ড' : 'Refunded'}</span>
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-lg sm:text-xl font-black font-mono">
                  {formatBDT(paymentSummary.refundedAmount)}
                </div>
                <div className="text-[11px] text-purple-700 font-semibold">
                  {paymentSummary.counts.refunded} {isBn ? 'টি বুকিং' : 'bookings'}
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Readiness Notice */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 space-y-1.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                {isBn
                  ? 'পেমেন্ট গেটওয়ে স্টেটাস ও আর্কিটেকচার (Phase 17B)'
                  : 'Payment Gateway Architecture Readiness'}
              </h4>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {isBn
                ? 'বর্তমানে বিকাশ, নগদ, কার্ড ও ক্যাশ অন-সাইট মেথডসমূহ UI এবং বুকিং ডাটা স্ট্রাকচারে সম্পূর্ণ প্রস্তুত। কোনো রিয়েল পেমেন্ট গেটওয়ে API (বিকাশ বা SSLCommerz) এখনো যুক্ত করা হয়নি (Coming Soon / Demo)। গ্রাহকদের জমা দেওয়া ট্রানজেকশন রেফারেন্স এবং ক্যাশ পেমেন্ট অ্যাডমিন কর্তৃক যাচাই (Manual Verification) ও পরিচালনা করা যায়।'
                : 'Payment methods (bKash, Nagad, Card, Cash) are connected to the booking data architecture. Real gateway APIs are not connected yet (Coming Soon / Demo). All transactions are managed through manual verification and audit logging.'}
            </p>
          </div>

          {/* Payment Transactions & Verification Ledger */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                  {isBn ? 'বুকিং পেমেন্ট ও ভেরিফিকেশন লেজার' : 'Booking Payment & Verification Ledger'}
                </h4>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'প্রতিটি বুকিংয়ের মূল্য, পেমেন্ট মেথড ও ভেরিফিকেশন ব্যবস্থাপনা'
                    : 'Manage payments, reference IDs, and verification statuses'}
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  placeholder={isBn ? 'বুকিং আইডি, নাম, TrxID...' : 'Search ID, name, TrxID...'}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', labelBn: `সকল (${bookings.length})`, labelEn: `All (${bookings.length})` },
                { id: 'paid', labelBn: `পরিশোধিত (${paymentSummary.counts.paid})`, labelEn: `Paid (${paymentSummary.counts.paid})` },
                { id: 'pending', labelBn: `পেন্ডিং (${paymentSummary.counts.pending})`, labelEn: `Pending (${paymentSummary.counts.pending})` },
                { id: 'unpaid', labelBn: `অপরিশোধিত (${paymentSummary.counts.unpaid})`, labelEn: `Unpaid (${paymentSummary.counts.unpaid})` },
                { id: 'failed', labelBn: `ব্যর্থ (${paymentSummary.counts.failed})`, labelEn: `Failed (${paymentSummary.counts.failed})` },
                { id: 'refunded', labelBn: `রিফান্ড (${paymentSummary.counts.refunded})`, labelEn: `Refunded (${paymentSummary.counts.refunded})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPaymentFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                    paymentFilterStatus === f.id
                      ? 'bg-emerald-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isBn ? f.labelBn : f.labelEn}
                </button>
              ))}
            </div>

            {/* Bookings List in Ledger */}
            <div className="space-y-2.5">
              {filteredPaymentBookings.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {isBn ? 'কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।' : 'No payment records match your filter.'}
                </div>
              ) : (
                filteredPaymentBookings.map((b) => {
                  const payMeta = getPaymentStatusMeta(b.paymentStatus, lang);
                  const methodMeta = getPaymentMethodMeta(b.paymentMethod || 'cash', lang);
                  const payable =
                    b.pricing?.customerPayable ??
                    b.pricingSnapshot?.customerPayable ??
                    b.pricing?.totalFee ??
                    2000;

                  return (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/90 hover:border-emerald-300 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      {/* Left: Booking ID, Customer & Service */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {b.id}
                          </span>
                          <span className="font-bold text-slate-800">
                            {isBn ? b.serviceNameBn : b.serviceNameEn}
                          </span>
                          {b.isDemo && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 flex items-center gap-2 text-[11px] flex-wrap">
                          <span>👤 {b.customer.name} (📞 {b.customer.mobile})</span>
                          <span>•</span>
                          <span>
                            📍 {b.land.mouza}, দাগ: {b.land.dagNo} ({b.land.upazila})
                          </span>
                        </div>
                      </div>

                      {/* Middle: Method & Reference Details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${methodMeta.badgeClass}`}
                          >
                            {methodMeta.name}
                          </span>
                          {b.paymentReference ? (
                            <span className="font-mono text-[11px] font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              TrxID: {b.paymentReference}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {isBn ? 'রেফারেন্স নেই' : 'No TrxID'}
                            </span>
                          )}
                        </div>

                        {b.paymentVerifiedBy && (
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            ✓ {isBn ? 'অনুমোদিত:' : 'Verified:'} {b.paymentVerifiedBy}
                          </div>
                        )}
                      </div>

                      {/* Right: Amount, Status Badge & Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-200">
                        <div className="text-right">
                          <span className="font-mono font-black text-sm text-emerald-950 block">
                            {formatBDT(payable)}
                          </span>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${payMeta.badgeClass}`}
                          >
                            {payMeta.label}
                          </span>
                        </div>

                        {onOpenPayment && (
                          <button
                            type="button"
                            onClick={() => onOpenPayment(b)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow-2xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{isBn ? 'যাচাই / পরিচালনা' : 'Manage'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN AMIN MODAL */}
      {selectedBookingForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-slate-900 text-base">
                {isBn ? 'আমিন নির্বাচন ও বরাদ্দ' : 'Assign Certified Amin'}
              </h4>
              <button
                onClick={() => setSelectedBookingForAssign(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600">
              <p>
                বুকিং: <strong className="font-mono">{selectedBookingForAssign.id}</strong>
              </p>
              <p>
                এলাকা: {selectedBookingForAssign.land.upazila}, {selectedBookingForAssign.land.district}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'উপলব্ধ সার্টিফাইড আমিন নির্বাচন করুন:' : 'Select Verified Amin:'}
              </label>
              <select
                value={selectedAminId}
                onChange={(e) => setSelectedAminId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white outline-none focus:border-indigo-600"
              >
                {verifiedAmins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.serviceDistricts.join(', ')}) - রেটিং ★{a.rating}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setSelectedBookingForAssign(null)}
                className="px-4 py-2 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const targetAmin = verifiedAmins.find((a) => a.id === selectedAminId);
                  if (targetAmin) {
                    onAssignAmin(
                      selectedBookingForAssign.id,
                      targetAmin.id,
                      targetAmin.name,
                      targetAmin.mobile
                    );
                  }
                  setSelectedBookingForAssign(null);
                }}
                className="px-5 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold shadow"
              >
                {isBn ? 'বরাদ্দ নিশ্চিত করুন' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QC CORRECTION MODAL */}
      {qcCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-3 shadow-2xl border">
            <h4 className="font-bold text-slate-900 text-base">
              {isBn ? 'আমিনের কাছে সংশোধনের নির্দেশ পাঠান' : 'Request QC Correction'}
            </h4>
            <p className="text-xs text-slate-500">
              {isBn
                ? 'পরিমাপ বা ড্রয়িংয়ে কোনো অসংগতি থাকলে নোট লিখে পাঠান। কাজটি আমিনের কাছে পুনরায় প্রসেসিংয়ে ফেরত যাবে।'
                : 'Specify what needs to be fixed. The job will return to processing status for the surveyor.'}
            </p>
            <textarea
              rows={3}
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder={isBn ? 'যেমন: উত্তর বাহুর সীমানা পরিমাপ পুনরায় যাচাই করুন...' : 'e.g. Please recheck boundary measurement...'}
              className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-rose-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setQcCorrectionModal(null)}
                className="px-4 py-2 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  onRequestCorrection(
                    qcCorrectionModal.id,
                    correctionNote || (isBn ? 'পরিমাপ পুনরায় যাচাই প্রয়োজন' : 'Measurement revision required')
                  );
                  setQcCorrectionModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                {isBn ? 'সংশোধন পাঠান' : 'Send Revision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE COMPLAINT MODAL */}
      {resolvingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-3 shadow-2xl border">
            <h4 className="font-bold text-slate-900 text-base">
              {isBn ? 'অভিযোগের আনুষ্ঠানিক নিষ্পত্তি' : 'Resolve Customer Dispute'}
            </h4>
            <textarea
              rows={3}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder={isBn ? 'তদন্ত সাপেক্ষে নেওয়া সিদ্ধান্তের বিবরণ লিখুন...' : 'Write resolution explanation...'}
              className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-emerald-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResolvingComplaint(null)}
                className="px-4 py-2 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  onResolveComplaint(
                    resolvingComplaint.id,
                    resolutionText || (isBn ? 'উভয় পক্ষের সাথে কথা বলে সমাধান করা হয়েছে।' : 'Resolved after verification.')
                  );
                  setResolvingComplaint(null);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900"
              >
                {isBn ? 'নিষ্পত্তি সম্পন্ন' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SERVICE PRICING & COMMISSION CONFIGURATION MODAL (Phase 17A) */}
      {(editingService || isAddingNewService) && (() => {
        const liveBreakdown = calculatePricingBreakdown(
          formBasePrice || 0,
          formCommissionPercentage || 0
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <Settings2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {isAddingNewService
                        ? isBn ? 'নতুন সেবা ও প্রাইসিং কনফিগারেশন' : 'Add New Service & Pricing'
                        : isBn ? 'সার্ভিস প্রাইসিং ও কমিশন কনফিগারেশন' : 'Configure Service Pricing & Commission'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isAddingNewService
                        ? isBn ? 'নতুন সেবার নাম, রেট ও কমিশন হার নির্ধারণ করুন' : 'Define service details, rates, and platform commission'
                        : isBn ? `সম্পাদনা: ${editingService?.nameBn}` : `Edit: ${editingService?.nameEn}`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingService(null);
                    setIsAddingNewService(false);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <div className="space-y-3.5 text-xs">
                {/* Service Names (editable for all or new) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn ? 'সেবার নাম (বাংলা):' : 'Service Name (Bangla):'}
                    </label>
                    <input
                      type="text"
                      value={formNameBn}
                      onChange={(e) => setFormNameBn(e.target.value)}
                      placeholder="যেমন: সীমানা বিরোধ নিষ্পত্তি জরিপ"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-700 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn ? 'সেবার নাম (ইংরেজি):' : 'Service Name (English):'}
                    </label>
                    <input
                      type="text"
                      value={formNameEn}
                      onChange={(e) => setFormNameEn(e.target.value)}
                      placeholder="e.g. Boundary Demarcation Survey"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-700 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'সংক্ষিপ্ত বিবরণ:' : 'Short Description:'}
                  </label>
                  <input
                    type="text"
                    value={formShortDescBn}
                    onChange={(e) => setFormShortDescBn(e.target.value)}
                    placeholder={isBn ? 'সেবার সংক্ষিপ্ত লক্ষ্য ও আউটপুট...' : 'Short service description...'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-700 outline-none text-xs"
                  />
                </div>

                {/* Price Fields */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'মূল্য ও রেঞ্জ নির্ধারণ (BDT):' : 'Pricing & Range Configuration (BDT):'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {isBn ? 'বেস প্রাইস *' : 'Base Price *'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                        <input
                          type="number"
                          value={formBasePrice || ''}
                          onChange={(e) => setFormBasePrice(Math.max(0, Number(e.target.value)))}
                          placeholder="2500"
                          className="w-full pl-6 pr-2 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs outline-none focus:border-emerald-700 font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {isBn ? 'সর্বনিম্ন মূল্য (ঐচ্ছিক)' : 'Min Price (Optional)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                        <input
                          type="number"
                          value={formMinPrice}
                          onChange={(e) => setFormMinPrice(e.target.value)}
                          placeholder="2000"
                          className="w-full pl-6 pr-2 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs outline-none focus:border-emerald-700 text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {isBn ? 'সর্বোচ্চ মূল্য (ঐচ্ছিক)' : 'Max Price (Optional)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                        <input
                          type="number"
                          value={formMaxPrice}
                          onChange={(e) => setFormMaxPrice(e.target.value)}
                          placeholder="5000"
                          className="w-full pl-6 pr-2 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs outline-none focus:border-emerald-700 text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Commission Percentage & Presets */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-slate-700 text-xs flex items-center gap-1">
                        <Percent className="w-3 h-3 text-emerald-800" />
                        <span>{isBn ? 'প্ল্যাটফর্ম কমিশন শতকরা হার (%):' : 'Platform Commission (%):'}</span>
                      </label>
                      <span className="font-mono font-black text-emerald-800 text-sm">
                        {formCommissionPercentage}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formCommissionPercentage}
                          onChange={(e) =>
                            setFormCommissionPercentage(
                              Math.min(100, Math.max(0, Number(e.target.value)))
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold outline-none focus:border-emerald-700"
                        />
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1">
                        {[5, 8, 10, 12, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setFormCommissionPercentage(pct)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                              formCommissionPercentage === pct
                                ? 'bg-emerald-800 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Auto-Calculation Breakdown */}
                <div className="p-3.5 rounded-2xl bg-emerald-950 text-white space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                    <span>{isBn ? 'স্বয়ংক্রিয় হিসাব ক্যালকুলেশন প্রিভিউ' : 'Automatic Calculation Preview'}</span>
                    <span className="font-mono text-emerald-400">Live</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-xl bg-white/10">
                      <span className="text-[10px] text-emerald-200 block">{isBn ? 'গ্রাহকের প্রদেয়' : 'Customer Payable'}</span>
                      <span className="font-black text-sm font-mono text-emerald-300">
                        {formatBDT(liveBreakdown.customerPayable)}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white/10">
                      <span className="text-[10px] text-emerald-200 block">
                        {isBn ? `প্ল্যাটফর্ম কমিশন (${liveBreakdown.commissionPercentage}%)` : `Commission (${liveBreakdown.commissionPercentage}%)`}
                      </span>
                      <span className="font-black text-sm font-mono text-amber-300">
                        {formatBDT(liveBreakdown.platformCommission)}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white/10">
                      <span className="text-[10px] text-emerald-200 block">{isBn ? 'আমিনের আয়' : 'Amin Earning'}</span>
                      <span className="font-black text-sm font-mono text-teal-200">
                        {formatBDT(liveBreakdown.aminEarning)}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white/10">
                      <span className="text-[10px] text-emerald-200 block">{isBn ? 'সর্বমোট লেনদেন' : 'Total Amount'}</span>
                      <span className="font-black text-sm font-mono text-white">
                        {formatBDT(liveBreakdown.totalAmount)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-emerald-200/80 pt-1 border-t border-emerald-900">
                    {isBn
                      ? '✓ বুকিং করার সময় এই প্রাইসিং অনুযায়ী অপরিবর্তনীয় স্ন্যাপশট (Pricing Snapshot) সংরক্ষিত হবে।'
                      : '✓ Immutable pricing snapshot will be captured at booking time.'}
                  </p>
                </div>

                {/* Service Active / Disabled Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      {isBn ? 'সেবার প্রাপ্যতা (Service Status):' : 'Service Availability Status:'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formActive
                        ? isBn ? 'সেবাটি গ্রাহকদের জন্য বুকিংয়ের উন্মুক্ত থাকবে।' : 'Service will be visible and open for booking.'
                        : isBn ? 'সেবাটি বর্তমানে সাময়িকভাবে বন্ধ থাকবে।' : 'Service is currently disabled from customer view.'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFormActive(!formActive)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                      formActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {formActive ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{isBn ? 'সক্রিয় (Active)' : 'Active'}</span>
                      </>
                    ) : (
                      <span>{isBn ? 'নিষ্ক্রিয় (Disabled)' : 'Disabled'}</span>
                    )}
                  </button>
                </div>

                {/* Error Banner */}
                {pricingFormError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{pricingFormError}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingService(null);
                    setIsAddingNewService(false);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSavePricingConfig}
                  className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isBn ? 'কনফিগারেশন সংরক্ষণ করুন' : 'Save Configuration'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
