import React, { useState } from 'react';
import {
  X,
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  Phone,
  User,
  Briefcase,
  FileCheck2,
  MapPin,
  Clock,
  Loader2,
} from 'lucide-react';
import { Language, AminApplication, MarketplaceService } from '../../types';

interface AminRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitApplication: (app: AminApplication) => void;
  services: MarketplaceService[];
  lang: Language;
}

export const AminRegistrationModal: React.FC<AminRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSubmitApplication,
  services,
  lang,
}) => {
  if (!isOpen) return null;

  const isBn = lang === 'bn';

  const [applicantName, setApplicantName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('ঢাকা');
  const [upazila, setUpazila] = useState('সাভার');
  const [experienceYears, setExperienceYears] = useState<number>(5);
  const [serviceAreas, setServiceAreas] = useState('ঢাকা, সাভার, ধামরাই');
  const [selectedServices, setSelectedServices] = useState<string[]>([
    'srvc-land-meas',
    'srvc-possession',
    'srvc-boundary',
  ]);
  const [description, setDescription] = useState('');
  const [credentials, setCredentials] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const toggleService = (srvcId: string) => {
    setSelectedServices((prev) =>
      prev.includes(srvcId) ? prev.filter((id) => id !== srvcId) : [...prev, srvcId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!applicantName.trim()) errs.name = isBn ? 'আপনার নাম লিখুন' : 'Name is required';
    if (!mobile.trim() || mobile.length < 9) {
      errs.mobile = isBn ? 'সঠিক মোবাইল নম্বর লিখুন' : 'Valid mobile number required';
    }
    if (!district.trim()) errs.district = isBn ? 'জেলা লিখুন' : 'District required';
    if (!upazila.trim()) errs.upazila = isBn ? 'উপজেলা লিখুন' : 'Upazila required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    const newApp: AminApplication = {
      id: `app-${Date.now()}`,
      applicantName: applicantName.trim(),
      mobile: mobile.trim(),
      email: email.trim() || undefined,
      district: district.trim(),
      upazila: upazila.trim(),
      experienceYears: Number(experienceYears) || 1,
      serviceAreas: serviceAreas.trim(),
      services: selectedServices,
      description: description.trim(),
      credentials: credentials.trim() || (isBn ? 'ডিপ্লোমা / সার্টিফিকেট সনদ' : 'Surveyor Certificate'),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      onSubmitApplication(newApp);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              {isBn ? 'পেশাদার নেটওয়ার্ক' : 'Surveyor Network'}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              {isBn ? 'আমিন হিসেবে যুক্ত হন' : 'Register as a Certified Amin'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
          {isSuccess ? (
            <div className="text-center py-8 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-bold text-slate-900">
                {isBn ? 'আবেদন সফলভাবে গৃহীত হয়েছে!' : 'Application Submitted!'}
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {isBn
                  ? 'আপনার আবেদনটি প্ল্যাটফর্ম অ্যাডমিনের যাচাইকরণ তালিকায় সংরক্ষিত হয়েছে। আপনার অভিজ্ঞতা ও সনদপত্র পর্যালোচনার পর প্রোফাইল অনুমোদন করা হবে।'
                  : 'Your application has been received for platform verification. An admin will review your credentials before approving your profile.'}
              </p>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs max-w-sm mx-auto">
                <span className="font-bold block">
                  {isBn ? 'স্ট্যাটাস: অপেক্ষমাণ (Pending Verification)' : 'Status: Pending Verification'}
                </span>
                <p className="text-[11px] mt-0.5">
                  {isBn ? 'স্বয়ংক্রিয়ভাবে কাউকে ভেরিফাইড করা হয় না।' : 'Profiles require manual admin review.'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                {isBn ? 'ঠিক আছে' : 'Done'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Notice */}
              <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-start gap-2.5 text-blue-900 text-xs">
                <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p>
                  {isBn
                    ? 'ভূমি ও আমিন প্ল্যাটফর্মে নিবন্ধনের পর প্রতিটি আমিনের জাতীয় পরিচয়পত্র ও প্রফেশনাল সনদপত্র অ্যাডমিন কর্তৃক যাচাই করা হয়।'
                    : 'All surveyor applications are audited by platform administrators prior to assignment dispatch.'}
                </p>
              </div>

              {/* Personal Info */}
              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 text-xs sm:text-sm border-b pb-1">
                  {isBn ? 'ব্যক্তিগত তথ্য' : 'Personal Details'}
                </h5>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'পূর্ণ নাম *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder={isBn ? 'যেমন: মোঃ আব্দুর রহমান' : 'e.g. Md. Abdur Rahman'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                  />
                  {errors.name && <span className="text-[10px] text-rose-600">{errors.name}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? 'মোবাইল নম্বর *' : 'Mobile *'}
                    </label>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                    />
                    {errors.mobile && (
                      <span className="text-[10px] text-rose-600">{errors.mobile}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? 'ইমেইল (ঐচ্ছিক)' : 'Email'}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="amin@example.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? 'নিজ জেলা *' : 'District *'}
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder={isBn ? 'ঢাকা' : 'Dhaka'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? 'নিজ উপজেলা *' : 'Upazila *'}
                    </label>
                    <input
                      type="text"
                      value={upazila}
                      onChange={(e) => setUpazila(e.target.value)}
                      placeholder={isBn ? 'সাভার' : 'Savar'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Professional Experience */}
              <div className="space-y-3 pt-2">
                <h5 className="font-bold text-slate-900 text-xs sm:text-sm border-b pb-1">
                  {isBn ? 'পেশাদার অভিজ্ঞতা ও এলাকা' : 'Professional Background & Coverage'}
                </h5>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? 'অভিজ্ঞতার বছর' : 'Years of Experience'}
                    </label>
                    <input
                      type="number"
                      value={experienceYears}
                      min={1}
                      max={50}
                      onChange={(e) => setExperienceYears(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? 'সেবা প্রদানের এলাকা' : 'Service Coverage Areas'}
                    </label>
                    <input
                      type="text"
                      value={serviceAreas}
                      onChange={(e) => setServiceAreas(e.target.value)}
                      placeholder={isBn ? 'যেমন: সাভার, ধামরাই, আশুলিয়া' : 'e.g. Savar, Dhamrai'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Services Checkboxes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    {isBn ? 'প্রস্তাবিত সেবাসমূহ নির্বাচন করুন' : 'Offered Services'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {services.map((s) => {
                      const isChecked = selectedServices.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className={`p-2 rounded-xl text-left border text-xs flex items-center gap-2 transition ${
                            isChecked
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                              isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                            }`}
                          >
                            {isChecked && <CheckCircle2 className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{isBn ? s.nameBn : s.nameEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'সনদ ও শিক্ষাগত যোগ্যতা' : 'Certificates & Credentials'}
                  </label>
                  <input
                    type="text"
                    value={credentials}
                    onChange={(e) => setCredentials(e.target.value)}
                    placeholder={isBn ? 'যেমন: বাংলাদেশ সার্ভে ইনস্টিটিউট ডিপ্লোমা' : 'e.g. Survey Institute Diploma'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'সংক্ষিপ্ত আত্মবিবরণী' : 'Brief Bio'}
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isBn ? 'আপনার অভিজ্ঞতা ও বিশেষজ্ঞতা সম্পর্কে লিখুন...' : 'Write about your background...'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-emerald-800 text-white font-bold text-xs sm:text-sm hover:bg-emerald-900 transition flex items-center justify-center gap-2 shadow"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isBn ? 'জমা দেওয়া হচ্ছে...' : 'Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isBn ? 'আবেদন জমা দিন' : 'Submit Application'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
