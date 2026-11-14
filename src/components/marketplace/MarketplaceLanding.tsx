import React, { useState } from 'react';
import {
  Compass,
  Ruler,
  ShieldCheck,
  PenTool,
  Layers,
  FileCheck,
  FileText,
  Wrench,
  Clock,
  ArrowRight,
  CheckCircle2,
  Users,
  Search,
  Sparkles,
  Award,
  BookOpen,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { Language, MarketplaceService, MarketplaceRole } from '../../types';

interface MarketplaceLandingProps {
  services: MarketplaceService[];
  onSelectService: (service: MarketplaceService) => void;
  onBookService: (service: MarketplaceService) => void;
  onOpenAminDirectory: () => void;
  onOpenCustomerDashboard: () => void;
  onOpenAminRegistration: () => void;
  activeRole: MarketplaceRole;
  onChangeRole: (role: MarketplaceRole) => void;
  customerBookingsCount: number;
  lang: Language;
}

export const MarketplaceLanding: React.FC<MarketplaceLandingProps> = ({
  services,
  onSelectService,
  onBookService,
  onOpenAminDirectory,
  onOpenCustomerDashboard,
  onOpenAminRegistration,
  activeRole,
  onChangeRole,
  customerBookingsCount,
  lang,
}) => {
  const isBn = lang === 'bn';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const renderServiceIcon = (iconName: string) => {
    const props = { className: 'w-5 h-5 text-emerald-800' };
    switch (iconName) {
      case 'Compass':
        return <Compass {...props} />;
      case 'Ruler':
        return <Ruler {...props} />;
      case 'ShieldCheck':
        return <ShieldCheck {...props} />;
      case 'PenTool':
        return <PenTool {...props} />;
      case 'Layers':
        return <Layers {...props} />;
      case 'FileCheck':
        return <FileCheck {...props} />;
      case 'FileText':
        return <FileText {...props} />;
      case 'Wrench':
      default:
        return <Wrench {...props} />;
    }
  };

  const filteredServices = services.filter((s) => {
    const matchesCat =
      selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch =
      s.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shortDescBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shortDescEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const scrollToServices = () => {
    const el = document.getElementById('services-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Demo Role Switcher Bar */}
      <div className="p-2.5 rounded-2xl bg-slate-900 text-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5 border border-slate-800">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {isBn ? 'ডেমো টেস্ট মোড' : 'Demo Test Mode'}
          </span>
          <span className="text-slate-300 font-medium">
            {isBn ? 'ব্যবহারকারী ভূমিকা নির্বাচন করুন:' : 'Switch Active Perspective:'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-800/90 rounded-xl border border-slate-700/60 w-full sm:w-auto justify-center">
          {[
            { id: 'customer', labelBn: 'গ্রাহক (Customer)', labelEn: 'Customer' },
            { id: 'amin', labelBn: 'আমিন (Amin Workspace)', labelEn: 'Surveyor' },
            { id: 'admin', labelBn: 'সুপারভাইজার (Admin)', labelEn: 'Admin' },
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => onChangeRole(role.id as MarketplaceRole)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeRole === role.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isBn ? role.labelBn : role.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* HERO SECTION */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-950 text-white p-6 sm:p-8 shadow-xl border border-emerald-800/40">
        <div className="relative z-10 max-w-2xl space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 backdrop-blur-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isBn ? 'ভূমি ও আমিন • জমি বুঝুন, ঝুঁকি কমান।' : 'Bhumi & Amin • Safe Land Measurement'}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
            {isBn ? 'বিশ্বস্ত আমিন সেবা এখন এক প্ল্যাটফর্মে' : 'Trusted Land Surveyor Services on One Platform'}
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
            {isBn
              ? 'জমি মাপজোক, দাগ নির্ধারণ, নকশা, দখল পরিমাপ ও অন্যান্য পেশাদার সার্ভে সেবা। প্ল্যাটফর্মের তত্ত্বাবধানে প্রতিটি কাজের সঠিকতা ও নিরপেক্ষতা নিশ্চিত করা হয়।'
              : 'Professional land surveying, boundary demarcation, digital plotting, and partition services under verified supervisor quality control.'}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              onClick={scrollToServices}
              className="px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition active:scale-95"
            >
              <span>{isBn ? 'সেবা নিন' : 'Book a Service'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenAminRegistration}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-white/20 transition active:scale-95"
            >
              <UserPlus className="w-4 h-4 text-emerald-300" />
              <span>{isBn ? 'আমিন হিসেবে যুক্ত হন' : 'Join as an Amin'}</span>
            </button>

            {customerBookingsCount > 0 && (
              <button
                onClick={onOpenCustomerDashboard}
                className="px-4 py-3 rounded-2xl bg-teal-800/80 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-teal-600/40 transition"
              >
                <span>{isBn ? `আমার আবেদন (${customerBookingsCount})` : `My Bookings (${customerBookingsCount})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative Background Glow */}
        <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Trust & Guarantee Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">
              {isBn ? '১০০% প্ল্যাটফর্ম তদারকি' : 'Supervised Quality'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {isBn ? 'অ্যাডমিন মান যাচাই সাপেক্ষে রিপোর্ট' : 'Admin quality check before delivery'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center text-teal-800 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">
              {isBn ? 'সনদপ্রাপ্ত পেশাদার আমিন' : 'Certified Surveyors'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {isBn ? 'যাচাইকৃত অভিজ্ঞতা ও ডিপ্লোমা সনদ' : 'Verified credentials & experience'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-800 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">
              {isBn ? 'ডিজিটাল নকশা ও এ৪ রিপোর্ট' : 'CAD Map & A4 Certificate'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {isBn ? 'ভেক্টর প্লট ড্রয়িং ও অফিসিয়াল রিপোর্ট' : 'Printable survey reports'}
            </p>
          </div>
        </div>
      </div>

      {/* SERVICES GRID & CATEGORY FILTER */}
      <div id="services-grid" className="space-y-3.5 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>{isBn ? 'পেশাদার আমিন সেবাসমূহ' : 'Professional Survey Services'}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {isBn ? 'আপনার প্রয়োজন অনুযায়ী সেবাটি নির্বাচন করুন:' : 'Choose from our 8 verified survey services:'}
            </p>
          </div>

          {/* Quick Nav to Amin Directory */}
          <button
            onClick={onOpenAminDirectory}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 self-start sm:self-auto"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isBn ? 'সকল আমিন দেখুন →' : 'View Amin Directory →'}</span>
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', labelBn: 'সকল সেবা (৮টি)', labelEn: 'All Services (8)' },
            { id: 'boundary', labelBn: 'সীমানা ও মাপজোক', labelEn: 'Survey & Boundary' },
            { id: 'drawing', labelBn: 'ডিজিটাল নকশা', labelEn: 'Digital Drawings' },
            { id: 'dispute', labelBn: 'আইনি ও বিরোধ', labelEn: 'Dispute & Demarcation' },
            { id: 'partition', labelBn: 'বণ্টন ও রেকর্ড', labelEn: 'Partition & Records' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-emerald-850 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {isBn ? cat.labelBn : cat.labelEn}
            </button>
          ))}
        </div>

        {/* Service Cards Grid (8 Services) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="p-4 rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-500/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
            >
              <div>
                {/* Card Top: Icon & Duration */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 group-hover:bg-emerald-200/80 flex items-center justify-center transition">
                    {renderServiceIcon(service.iconName)}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{service.estimatedDays}</span>
                  </div>
                </div>

                {/* Title & Short Description */}
                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-emerald-900 transition">
                    {isBn ? service.nameBn : service.nameEn}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {isBn ? service.shortDescBn : service.shortDescEn}
                  </p>
                </div>

                {/* Included Keypoints preview */}
                <div className="mt-2.5 space-y-1">
                  {(isBn ? service.includedBn : service.includedEn).slice(0, 2).map((inc, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate">{inc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price & Action Buttons */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isBn ? 'প্রাক্কলিত ফি' : 'Est. Fee'}
                  </span>
                  <div>
                    <span className="text-sm font-extrabold text-emerald-900">
                      ৳{service.baseFee.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block text-right">
                      + ৳{service.platformFee} ফি
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onSelectService(service)}
                    className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs text-center transition"
                  >
                    {isBn ? 'বিস্তারিত' : 'Details'}
                  </button>

                  <button
                    onClick={() => onBookService(service)}
                    className="py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs text-center transition active:scale-95 shadow-2xs"
                  >
                    {isBn ? 'বুক করুন' : 'Book'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mandatory Legal Disclaimer Banner as requested */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 text-xs leading-relaxed space-y-1">
        <span className="font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{isBn ? 'আইনি ও পেশাদার সতর্কতা:' : 'Legal & Professional Notice:'}</span>
        </span>
        <p className="text-slate-700">
          {isBn
            ? '“ভূমি ও আমিন” একটি সুপারভাইজড সার্ভিস প্ল্যাটফর্ম। প্রযোজ্য সরকারি রেকর্ড (CS/SA/RS/City Survey) ও পেশাদার জরিপ পদ্ধতির ভিত্তিতে সেবা প্রদান করা হয়। আদালতের রায় বা আইনি বিরোধের ক্ষেত্রে আদালতের নির্ধারিত জরিপকারী কর্তৃপক্ষের নির্দেশ প্রযোজ্য।'
            : 'Bhumi & Amin is a supervised service platform. Services are executed based on official government records and professional surveying standards.'}
        </p>
      </div>
    </div>
  );
};
