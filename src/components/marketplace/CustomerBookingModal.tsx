import React, { useState } from 'react';
import {
  X,
  MapPin,
  Compass,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Phone,
  User,
  FileText,
  Layers,
  ArrowRight,
  ArrowLeft,
  Crosshair,
  Loader2,
} from 'lucide-react';
import { Language, MarketplaceService, CustomerBooking } from '../../types';
import { LocationSelectionValue } from '../../types/administrative-location';
import { BangladeshLocationSelector } from '../common/BangladeshLocationSelector';
import { ProfessionalServiceDisclaimer } from '../common/ProfessionalServiceDisclaimer';
import { generateBookingId } from '../../lib/marketplaceStorage';
import { useAuth } from '../../contexts/AuthContext';
import {
  createPricingSnapshot,
  calculatePricingBreakdown,
  formatBDT,
} from '../../lib/pricing-commission';

interface CustomerBookingModalProps {
  service: MarketplaceService;
  isOpen: boolean;
  onClose: () => void;
  onSuccessBooking: (booking: CustomerBooking) => void;
  existingBookings: CustomerBooking[];
  lang: Language;
}

export const CustomerBookingModal: React.FC<CustomerBookingModalProps> = ({
  service,
  isOpen,
  onClose,
  onSuccessBooking,
  existingBookings,
  lang,
}) => {
  const { currentUser } = useAuth();
  if (!isOpen) return null;

  const isBn = lang === 'bn';

  // Form states
  // 1. Customer
  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerMobile, setCustomerMobile] = useState(currentUser?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');

  // 2. Land
  const [location, setLocation] = useState<LocationSelectionValue>(() => ({
    districtNameBn: currentUser?.district || 'ঢাকা',
    upazilaNameBn: currentUser?.upazila || 'সাভার',
    mouzaNameBn: '',
    jlNo: '',
    surveyType: 'RS',
  }));
  const [union, setUnion] = useState('');
  const [dagNo, setDagNo] = useState('');
  const [khatianNo, setKhatianNo] = useState('');

  // 3. Survey Requirements
  const [landSize, setLandSize] = useState<string>('১০');
  const [landUnit, setLandUnit] = useState<string>('শতাংশ');
  const [preferredDate, setPreferredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState<string>('সকাল ১০:০০ টা');
  const [locationDescription, setLocationDescription] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // 4. GPS Location
  const [gpsLocation, setGpsLocation] = useState<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Stepper / Submitting
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<CustomerBooking | null>(null);

  // GPS Acquisition Handler (Only upon explicit user click)
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError(isBn ? 'আপনার ব্রাউজারে জিপিএস সমর্থিত নয়।' : 'Geolocation not supported by browser.');
      return;
    }
    setIsCapturingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Number(pos.coords.accuracy.toFixed(1)),
        });
        setIsCapturingGps(false);
      },
      (err) => {
        setIsCapturingGps(false);
        setGpsError(
          isBn
            ? 'জিপিএস লোকেশন পাওয়া যায়নি। অনুগ্রহ করে পারমিশন চেক করুন।'
            : 'Could not acquire GPS. Please grant location permissions.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!customerName.trim()) {
      errs.customerName = isBn ? 'আপনার নাম লিখুন' : 'Please enter your name';
    }
    if (!customerMobile.trim() || customerMobile.length < 9) {
      errs.customerMobile = isBn ? 'সঠিক মোবাইল নম্বর লিখুন' : 'Enter valid phone number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!location.districtNameBn?.trim()) errs.district = isBn ? 'জেলা নির্বাচন করুন' : 'District required';
    if (!location.upazilaNameBn?.trim()) errs.upazila = isBn ? 'উপজেলা নির্বাচন করুন' : 'Upazila required';
    if (!location.mouzaNameBn?.trim()) errs.mouza = isBn ? 'মৌজার নাম নির্বাচন বা লিখুন' : 'Mouza name required';
    if (!dagNo.trim()) errs.dagNo = isBn ? 'দাগ নম্বর লিখুন' : 'Dag / Plot no required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // Confirm booking
  const handleConfirmBooking = () => {
    setIsSubmitting(true);

    const bookingId = generateBookingId(existingBookings);
    const nowIso = new Date().toISOString();
    const nowFormatted = isBn
      ? new Date().toLocaleDateString('bn-BD', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleString();

    const newBooking: CustomerBooking = {
      id: bookingId,
      customerId: currentUser?.id,
      serviceId: service.id,
      serviceNameBn: service.nameBn,
      serviceNameEn: service.nameEn,
      customer: {
        name: customerName.trim(),
        mobile: customerMobile.trim(),
        email: customerEmail.trim() || undefined,
      },
      land: {
        district: location.districtNameBn?.trim() || 'ঢাকা',
        upazila: location.upazilaNameBn?.trim() || 'সাভার',
        union: union.trim() || (isBn ? 'সদর' : 'Sadar'),
        mouza: location.mouzaNameBn?.trim() || '',
        jlNo: location.jlNo?.trim() || undefined,
        dagNo: dagNo.trim(),
        khatianNo: khatianNo.trim() || undefined,
      },
      surveyRequirements: {
        approxLandSize: parseFloat(landSize) || 10,
        unit: landUnit,
        preferredDate: preferredDate,
        preferredTime: preferredTime,
        locationDescription: locationDescription.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
      },
      location: {
        manualAddress: `${location.mouzaNameBn ? location.mouzaNameBn + ', ' : ''}${location.upazilaNameBn || ''}, ${location.districtNameBn || ''}`,
        latitude: gpsLocation?.latitude,
        longitude: gpsLocation?.longitude,
        accuracy: gpsLocation?.accuracy,
        hasGps: !!gpsLocation,
      },
      // Phase 17A: Immutable pricing snapshot preserving prices at booking creation
      pricingSnapshot: createPricingSnapshot(service),
      pricing: {
        serviceFee: service.basePrice || service.baseFee,
        additionalFee: 0,
        platformFee: service.platformEarning || service.platformFee || Math.round((service.basePrice || service.baseFee) * ((service.commissionPercentage || 10) / 100)),
        totalFee: (service.basePrice || service.baseFee),
        currency: 'BDT',
        basePrice: service.basePrice || service.baseFee,
        commissionPercentage: service.commissionPercentage || 10,
        platformCommission: service.platformEarning || Math.round((service.basePrice || service.baseFee) * ((service.commissionPercentage || 10) / 100)),
        aminEarning: service.aminEarning || ((service.basePrice || service.baseFee) - Math.round((service.basePrice || service.baseFee) * ((service.commissionPercentage || 10) / 100))),
        platformEarning: service.platformEarning || Math.round((service.basePrice || service.baseFee) * ((service.commissionPercentage || 10) / 100)),
        customerPayable: service.basePrice || service.baseFee,
      },
      paymentStatus: 'unpaid',
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          changedAt: nowFormatted,
          changedBy: customerName.trim(),
          role: 'customer',
          note: isBn
            ? 'গ্রাহক কর্তৃক নতুন সেবার বুকিং অনুরোধ দাখিল করা হয়েছে।'
            : 'New service booking request submitted by customer.',
        },
      ],
      isDemo: false, // Actual customer booking!
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setTimeout(() => {
      setIsSubmitting(false);
      setConfirmedBooking(newBooking);
      onSuccessBooking(newBooking);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {isBn ? service.nameBn : service.nameEn}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {step === 1
                  ? isBn
                    ? 'ধাপ ১: ব্যক্তিগত তথ্য'
                    : 'Step 1: Contact'
                  : step === 2
                  ? isBn
                    ? 'ধাপ ২: জমির বিবরণ'
                    : 'Step 2: Land Details'
                  : isBn
                  ? 'ধাপ ৩: সারসংক্ষেপ ও নিশ্চয়তা'
                  : 'Step 3: Confirmation'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              {isBn ? 'সেবা বুক করুন' : 'Book Professional Service'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        {!confirmedBooking && (
          <div className="w-full bg-slate-100 h-1">
            <div
              className="bg-emerald-600 h-1 transition-all duration-300"
              style={{ width: step === 1 ? '33.3%' : step === 2 ? '66.6%' : '100%' }}
            />
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
          {confirmedBooking ? (
            /* SUCCESS CONFIRMATION SCREEN */
            <div className="text-center py-6 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                  {isBn ? 'বুকিং সফলভাবে সম্পন্ন হয়েছে!' : 'Booking Request Confirmed!'}
                </span>
                <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                  {confirmedBooking.id}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {isBn
                    ? 'আপনার অনুরোধটি প্ল্যাটফর্ম সুপারভাইজারের কাছে পাঠানো হয়েছে। একজন সনদপ্রাপ্ত আমিন নিযুক্ত হলে আপনি নোটিফিকেশন পাবেন।'
                    : 'Your booking has been received by platform supervision. You will be notified once a certified Amin is assigned.'}
                </p>
              </div>

              {/* Booking Quick Receipt */}
              <div className="max-w-sm mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBn ? 'সেবা:' : 'Service:'}</span>
                  <span className="font-bold text-slate-800">
                    {isBn ? confirmedBooking.serviceNameBn : confirmedBooking.serviceNameEn}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBn ? 'মৌজা ও দাগ:' : 'Mouza & Dag:'}</span>
                  <span className="font-bold text-slate-800">
                    {confirmedBooking.land.mouza}, দাগ {confirmedBooking.land.dagNo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBn ? 'প্রাক্কলিত ফি:' : 'Estimated Fee:'}</span>
                  <span className="font-bold text-emerald-800">
                    ৳{confirmedBooking.pricing.totalFee.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-[11px] text-slate-400">
                  <span>{isBn ? 'স্ট্যাটাস:' : 'Status:'}</span>
                  <span className="text-amber-700 font-bold">{isBn ? 'অপেক্ষমাণ (Pending Review)' : 'Pending Review'}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full max-w-sm mx-auto py-3 rounded-xl bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow hover:bg-emerald-900 transition active:scale-95"
                >
                  {isBn ? 'আমার সেবা তালিকায় দেখুন' : 'View in My Bookings'}
                </button>
              </div>
            </div>
          ) : step === 1 ? (
            /* STEP 1: CUSTOMER CONTACT DETAILS */
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-2.5 text-slate-700 text-xs">
                <User className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <p>
                  {isBn
                    ? 'আপনার যোগাযোগের তথ্য সঠিকভাবে দিন যাতে প্ল্যাটফর্ম প্রতিনিধি ও নিযুক্ত আমিন আপনার সাথে যোগাযোগ করতে পারেন।'
                    : 'Provide accurate contact info so our supervision team and assigned surveyor can reach you.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'আপনার পূর্ণ নাম *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={isBn ? 'যেমন: মোঃ তারেক রহমান' : 'e.g. Tarek Rahman'}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition ${
                    errors.customerName ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.customerName && (
                  <span className="text-[11px] text-rose-600 font-medium mt-0.5 block">
                    {errors.customerName}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'সচল মোবাইল নম্বর *' : 'Mobile Phone Number *'}
                </label>
                <input
                  type="tel"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition ${
                    errors.customerMobile ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
                {errors.customerMobile && (
                  <span className="text-[11px] text-rose-600 font-medium mt-0.5 block">
                    {errors.customerMobile}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'ইমেইল অ্যাড্রেস (ঐচ্ছিক)' : 'Email Address (Optional)'}
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm outline-none focus:border-emerald-600 transition"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full py-3 rounded-xl bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-emerald-900 transition active:scale-95"
                >
                  <span>{isBn ? 'পরবর্তী: জমির বিবরণ' : 'Next: Land Details'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            /* STEP 2: LAND INFORMATION */
            <div className="space-y-3.5 animate-fadeIn">
              {/* Automated Bangladesh Location Selector */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800">
                    {isBn ? 'প্রশাসনিক মৌজা ও সার্ভে লোকেশন *' : 'Administrative Location & Survey *'}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-semibold">
                    {isBn ? 'স্বয়ংক্রিয় ক্যাসকেড' : 'Cascade Auto-fill'}
                  </span>
                </div>
                <BangladeshLocationSelector
                  value={location}
                  onChange={setLocation}
                  lang={lang}
                  showSurveyType={true}
                  showJlInput={true}
                />
                {errors.district && (
                  <span className="text-[10px] text-rose-600 font-medium block">{errors.district}</span>
                )}
                {errors.upazila && (
                  <span className="text-[10px] text-rose-600 font-medium block">{errors.upazila}</span>
                )}
                {errors.mouza && (
                  <span className="text-[10px] text-rose-600 font-medium block">{errors.mouza}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'ইউনিয়ন / ওয়ার্ড' : 'Union / Ward'}
                  </label>
                  <input
                    type="text"
                    value={union}
                    onChange={(e) => setUnion(e.target.value)}
                    placeholder={isBn ? 'যেমন: আমিনবাজার' : 'e.g. Aminbazar'}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'দাগ নং *' : 'Dag / Plot *'}
                  </label>
                  <input
                    type="text"
                    value={dagNo}
                    onChange={(e) => setDagNo(e.target.value)}
                    placeholder="৩১২"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                  />
                  {errors.dagNo && (
                    <span className="text-[10px] text-rose-600 font-medium">{errors.dagNo}</span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'খতিয়ান (ঐচ্ছিক)' : 'Khatian'}
                  </label>
                  <input
                    type="text"
                    value={khatianNo}
                    onChange={(e) => setKhatianNo(e.target.value)}
                    placeholder="১৫৪ (RS)"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Land Size & Preferred Schedule */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'আনুমানিক জমির আয়তন' : 'Approx Land Size'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={landSize}
                      onChange={(e) => setLandSize(e.target.value)}
                      className="w-1/2 px-2.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                    />
                    <select
                      value={landUnit}
                      onChange={(e) => setLandUnit(e.target.value)}
                      className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 text-xs bg-white outline-none focus:border-emerald-600"
                    >
                      <option value="শতাংশ">শতাংশ</option>
                      <option value="কাঠা">কাঠা</option>
                      <option value="বিঘা">বিঘা</option>
                      <option value="বর্গফুট">বর্গফুট</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'পছন্দের তারিখ' : 'Preferred Date'}
                  </label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Section 5: Optional GPS Location (explicit click only) */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-800">
                      {isBn ? 'জমির অবস্থান ও জিপিএস' : 'Location & GPS'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isBn ? '(ঐচ্ছিক)' : '(Optional)'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isBn
                    ? 'আপনি বর্তমানে জমিতে অবস্থান করলে জিপিএস কো-অর্ডিনেট যুক্ত করতে পারেন।'
                    : 'If currently on site, you may attach device coordinates.'}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isCapturingGps}
                    className="px-3 py-2 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
                  >
                    {isCapturingGps ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Crosshair className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isCapturingGps
                        ? isBn
                          ? 'জিপিএস খোঁজা হচ্ছে...'
                          : 'Acquiring GPS...'
                        : isBn
                        ? 'বর্তমান GPS লোকেশন ব্যবহার করুন'
                        : 'Use Current GPS Location'}
                    </span>
                  </button>

                  {gpsLocation && (
                    <span className="text-[11px] font-mono text-emerald-700 font-medium">
                      Lat: {gpsLocation.latitude}, Lng: {gpsLocation.longitude} (±{gpsLocation.accuracy}m)
                    </span>
                  )}
                </div>

                {gpsError && (
                  <span className="text-[11px] text-rose-600 block">{gpsError}</span>
                )}

                {/* Explicit Disclaimer as instructed in prompt */}
                <p className="text-[10px] text-slate-400 italic">
                  {isBn
                    ? '“GPS অবস্থান আনুমানিক। আইনগত সীমানা নির্ধারণের জন্য এটি একমাত্র প্রমাণ নয়।”'
                    : '“Device GPS is approximate; not sole proof for legal boundary determination.”'}
                </p>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isBn ? 'পূর্ববর্তী' : 'Back'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 flex items-center gap-1.5"
                >
                  <span>{isBn ? 'পরবর্তী: মূল্য ও নিশ্চয়তা' : 'Next: Price & Confirmation'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* STEP 3: PRICE SUMMARY & CONFIRMATION */
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-900 block mb-1">
                  {isBn ? 'বুকিং সারসংক্ষেপ' : 'Booking Summary'}
                </span>
                <div className="space-y-1 text-xs text-slate-700">
                  <p>
                    <strong className="text-slate-900">{isBn ? 'গ্রাহক:' : 'Customer:'}</strong>{' '}
                    {customerName} ({customerMobile})
                  </p>
                  <p>
                    <strong className="text-slate-900">{isBn ? 'জমি:' : 'Land:'}</strong>{' '}
                    {location.mouzaNameBn || '—'}, দাগ {dagNo}, {location.upazilaNameBn || '—'}, {location.districtNameBn || '—'}
                  </p>
                  <p>
                    <strong className="text-slate-900">{isBn ? 'তারিখ ও সময়:' : 'Schedule:'}</strong>{' '}
                    {preferredDate} ({preferredTime})
                  </p>
                  {gpsLocation && (
                    <p className="text-[11px] text-emerald-800 font-mono">
                      GPS: {gpsLocation.latitude}, {gpsLocation.longitude}
                    </p>
                  )}
                </div>
              </div>

              {/* Price Breakdown */}
              {(() => {
                const breakdown = calculatePricingBreakdown(
                  service.basePrice || service.baseFee,
                  service.commissionPercentage || 10
                );
                return (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                        {isBn ? 'মূল্য ও ফি বিবরণী' : 'Pricing & Fee Breakdown'}
                      </h5>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
                        {isBn ? 'অপরিশোধিত' : 'Unpaid'}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{isBn ? 'মূল সার্ভিস মূল্য (Base Price):' : 'Base Service Price:'}</span>
                      <span className="font-semibold text-slate-900">{formatBDT(breakdown.basePrice)}</span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{isBn ? `প্ল্যাটফর্ম কমিশন (${breakdown.commissionPercentage}%):` : `Platform Commission (${breakdown.commissionPercentage}%):`}</span>
                      <span className="font-medium text-emerald-800">{formatBDT(breakdown.platformCommission)}</span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{isBn ? 'আমিনের প্রাপ্য অংশ (Earning):' : 'Amin Earning:'}</span>
                      <span className="font-medium text-slate-700">{formatBDT(breakdown.aminEarning)}</span>
                    </div>

                    <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-extrabold text-emerald-950">
                      <span>{isBn ? 'গ্রাহকের প্রদেয় মোট পরিমাণ:' : 'Total Customer Payable:'}</span>
                      <span className="text-base text-emerald-800">
                        {formatBDT(breakdown.customerPayable)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Architecture notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <CreditCard className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">
                    {isBn ? 'বর্তমানে অনলাইন পেমেন্ট সংযুক্ত নয়।' : 'Online payment currently disabled.'}
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    {isBn
                      ? 'বিকাশ, নগদ ও কার্ড পেমেন্ট শিগগিরই যুক্ত হবে। বর্তমানে সরজমিনে কাজ সম্পন্ন ও রিপোর্ট পাওয়ার পর চুক্তি অনুযায়ী ফি প্রদান করবেন।'
                      : 'bKash, Nagad and Cards will be enabled in upcoming releases. Currently payable upon field completion.'}
                  </p>
                </div>
              </div>

              {/* Professional Service Disclaimer & Quality Assurance */}
              <ProfessionalServiceDisclaimer lang={lang} variant="compact" />

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isBn ? 'পূর্ববর্তী' : 'Back'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-emerald-800 text-white text-xs sm:text-sm font-extrabold hover:bg-emerald-900 flex items-center gap-2 shadow-sm transition active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isBn ? 'বুকিং তৈরি হচ্ছে...' : 'Processing...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isBn ? 'বুকিং নিশ্চিত করুন' : 'Confirm Booking'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
