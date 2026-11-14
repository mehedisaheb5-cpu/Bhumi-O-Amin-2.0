import React, { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  Star,
  Award,
  Clock,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  Phone,
  Briefcase,
  UserPlus,
} from 'lucide-react';
import { Language, AminProfile, MarketplaceService } from '../../types';

interface AminDirectoryProps {
  amins: AminProfile[];
  services: MarketplaceService[];
  onOpenRegistration: () => void;
  lang: Language;
}

export const AminDirectory: React.FC<AminDirectoryProps> = ({
  amins,
  services,
  onOpenRegistration,
  lang,
}) => {
  const isBn = lang === 'bn';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');

  const allDistricts = Array.from(
    new Set(amins.flatMap((a) => a.serviceDistricts))
  );

  const filteredAmins = amins.filter((amin) => {
    const matchesSearch =
      amin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      amin.serviceDistricts.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase())) ||
      amin.serviceUpazilas.some((u) => u.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDistrict =
      selectedDistrict === 'all' || amin.serviceDistricts.includes(selectedDistrict);

    return matchesSearch && matchesDistrict;
  });

  return (
    <div id="amin-directory-view" className="space-y-4 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            {isBn ? 'আমিন ডিরেক্টরি' : 'Certified Amin Directory'}
          </span>
          <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
            {isBn ? 'সনদপ্রাপ্ত ও অভিজ্ঞ সার্ভেয়ার তালিকা' : 'Verified Land Surveyors'}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {isBn
              ? 'প্ল্যাটফর্মের তত্ত্বাবধানে সকল কাজের গুণগত মান ও পেশাদারিত্ব সংরক্ষিত থাকে।'
              : 'All surveyors operate under platform supervision ensuring survey quality.'}
          </p>
        </div>

        <button
          onClick={onOpenRegistration}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow transition active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isBn ? 'আমিন হিসেবে যুক্ত হন' : 'Join as an Amin'}</span>
        </button>
      </div>

      {/* Demo Profiles Advisory Banner as requested */}
      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            {isBn
              ? 'বর্তমানে প্রদর্শিত প্রোফাইলগুলো প্ল্যাটফর্ম ডেমো/নমুনা প্রোফাইল (Sample Profile)। নতুন আমিন নিবন্ধনের পর অ্যাডমিন কর্তৃক ভেরিফাই করা হয়।'
              : 'Profiles shown below are sample profiles for UI demonstration. New Amin applicants are manually verified by platform administrators.'}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900 shrink-0">
          Demo Data
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isBn ? 'নাম, জেলা বা উপজেলা দিয়ে খুঁজুন...' : 'Search by name, district, upazila...'}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm outline-none focus:border-emerald-600 transition"
          />
        </div>

        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-700 outline-none focus:border-emerald-600"
        >
          <option value="all">{isBn ? 'সকল জেলা' : 'All Districts'}</option>
          {allDistricts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Amin Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filteredAmins.map((amin) => (
          <div
            key={amin.id}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              {/* Profile Top Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-800 to-teal-700 text-white font-bold text-base flex items-center justify-center shadow-xs">
                    {amin.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                        {amin.name}
                      </h3>
                      {amin.verificationStatus === 'verified' && (
                        <span className="p-0.5 rounded-full bg-emerald-100 text-emerald-800" title="Verified">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    {amin.isDemo && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 mt-0.5 inline-block">
                        {isBn ? 'নমুনা প্রোফাইল (Sample)' : 'Sample Profile'}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    amin.availability === 'available'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {amin.availability === 'available'
                    ? isBn
                      ? 'উপলব্ধ'
                      : 'Available'
                    : isBn
                    ? 'ব্যস্ত'
                    : 'Busy'}
                </span>
              </div>

              {/* Bio */}
              <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                {isBn ? amin.bioBn : amin.bioEn}
              </p>

              {/* Stats: Experience, Rating, Completed Jobs */}
              <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {isBn ? 'অভিজ্ঞতা' : 'Exp'}
                  </span>
                  <span className="font-bold text-slate-800 text-xs">
                    {amin.experienceYears} {isBn ? 'বছর' : 'yrs'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {isBn ? 'রেটিং' : 'Rating'}
                  </span>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                    <span className="font-bold text-slate-800 text-xs">{amin.rating}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {isBn ? 'সম্পন্ন কাজ' : 'Jobs'}
                  </span>
                  <span className="font-bold text-emerald-800 text-xs">
                    {amin.completedJobsCount}+
                  </span>
                </div>
              </div>

              {/* Service Areas */}
              <div className="mt-2.5 space-y-1 text-xs">
                <div className="flex items-start gap-1.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[11px]">
                    <strong className="text-slate-700">{isBn ? 'কার্যপরিধি:' : 'Areas:'}</strong>{' '}
                    {amin.serviceDistricts.join(', ')} ({amin.serviceUpazilas.slice(0, 3).join(', ')}
                    {amin.serviceUpazilas.length > 3 ? '...' : ''})
                  </span>
                </div>
              </div>
            </div>

            {/* Platform Supervision Guarantee */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {isBn ? 'প্ল্যাটফর্ম নিয়ন্ত্রিত' : 'Supervised by Platform'}
              </span>

              <span className="text-slate-400 font-medium">
                {isBn ? 'অ্যাডমিন নির্ধারিত অ্যাসাইনমেন্ট' : 'Admin Assigned'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
