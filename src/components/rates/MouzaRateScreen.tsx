import React, { useState, useMemo } from 'react';
import {
  Banknote,
  Search,
  Calculator,
  Building2,
  MapPin,
  FileText,
  Info,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Language } from '../../types';
import { formatNumberByLang } from '../../lib/land-units';

interface MouzaRateScreenProps {
  lang: Language;
  onBack?: () => void;
}

interface LandClassRate {
  id: string;
  nameBn: string;
  nameEn: string;
  category: 'agri' | 'residential' | 'commercial' | 'water' | 'other';
  ratePerDecimal: number; // Taka per decimal (শতক)
  descriptionBn: string;
}

interface MouzaData {
  id: string;
  districtBn: string;
  districtEn: string;
  upazilaBn: string;
  upazilaEn: string;
  mouzaBn: string;
  mouzaEn: string;
  jlNo: string;
  effectiveYear: string;
  rates: LandClassRate[];
}

// Representative authentic sub-registry mouza rates across Bangladesh
const SAMPLE_MOUZA_RATES: MouzaData[] = [
  {
    id: 'm-1',
    districtBn: 'ঢাকা',
    districtEn: 'Dhaka',
    upazilaBn: 'সাভার',
    upazilaEn: 'Savar',
    mouzaBn: 'বিরুলিয়া',
    mouzaEn: 'Birulia',
    jlNo: '২৭',
    effectiveYear: '২০২৪-২০২৬',
    rates: [
      { id: 'nal', nameBn: 'নাল (কৃষি জমি)', nameEn: 'Nal (Agricultural)', category: 'agri', ratePerDecimal: 180000, descriptionBn: 'চাষাবাদযোগ্য সমতল জমি' },
      { id: 'viti', nameBn: 'ভিটি / চালা', nameEn: 'Viti (High Land)', category: 'residential', ratePerDecimal: 320000, descriptionBn: 'উঁচু ভিটি বা বসতভিটার পার্শ্ববর্তী জমি' },
      { id: 'bari', nameBn: 'বাড়ি / বাস্তু', nameEn: 'Bari (Residential)', category: 'residential', ratePerDecimal: 450000, descriptionBn: 'বসতবাড়ি ও আবাসিক প্লট' },
      { id: 'commercial', nameBn: 'দোকান / বাণিজ্যিক', nameEn: 'Commercial / Shop', category: 'commercial', ratePerDecimal: 850000, descriptionBn: 'প্রধান রাস্তার পার্শ্ববর্তী বা বাজার এলাকা' },
      { id: 'pukur', nameBn: 'পুকুর / ডোবা', nameEn: 'Pond / Waterbody', category: 'water', ratePerDecimal: 140000, descriptionBn: 'জলাশয় বা মাছ চাষের ডোবা' },
      { id: 'bagan', nameBn: 'বাগান', nameEn: 'Garden / Orchard', category: 'other', ratePerDecimal: 220000, descriptionBn: 'ফলবাগান বা বৃক্ষরোপিত জমি' },
    ],
  },
  {
    id: 'm-2',
    districtBn: 'ঢাকা',
    districtEn: 'Dhaka',
    upazilaBn: 'কেরানীগঞ্জ',
    upazilaEn: 'Keraniganj',
    mouzaBn: 'জিনজিরা',
    mouzaEn: 'Jinjira',
    jlNo: '১২',
    effectiveYear: '২০২৪-২০২৬',
    rates: [
      { id: 'nal', nameBn: 'নাল (কৃষি জমি)', nameEn: 'Nal (Agricultural)', category: 'agri', ratePerDecimal: 250000, descriptionBn: 'ফসলী জমি' },
      { id: 'viti', nameBn: 'ভিটি / চালা', nameEn: 'Viti (High Land)', category: 'residential', ratePerDecimal: 480000, descriptionBn: 'আবাসিক ভিটি' },
      { id: 'bari', nameBn: 'বাড়ি / বাস্তু', nameEn: 'Bari (Residential)', category: 'residential', ratePerDecimal: 650000, descriptionBn: 'বাস্তুভিটা' },
      { id: 'commercial', nameBn: 'দোকান / বাণিজ্যিক', nameEn: 'Commercial / Shop', category: 'commercial', ratePerDecimal: 1200000, descriptionBn: 'বাণিজ্যিক এলাকা' },
      { id: 'pukur', nameBn: 'পুকুর / ডোবা', nameEn: 'Pond / Waterbody', category: 'water', ratePerDecimal: 190000, descriptionBn: 'পুকুর ও জলাশয়' },
    ],
  },
  {
    id: 'm-3',
    districtBn: 'চট্টগ্রাম',
    districtEn: 'Chattogram',
    upazilaBn: 'সীতাকুণ্ড',
    upazilaEn: 'Sitakunda',
    mouzaBn: 'কুমিরা',
    mouzaEn: 'Kumira',
    jlNo: '১৫',
    effectiveYear: '২০২৪-২০২৬',
    rates: [
      { id: 'nal', nameBn: 'নাল (কৃষি জমি)', nameEn: 'Nal (Agricultural)', category: 'agri', ratePerDecimal: 150000, descriptionBn: 'কৃষি জমি' },
      { id: 'viti', nameBn: 'ভিটি / চালা', nameEn: 'Viti (High Land)', category: 'residential', ratePerDecimal: 280000, descriptionBn: 'ভিটি জমি' },
      { id: 'bari', nameBn: 'বাড়ি / বাস্তু', nameEn: 'Bari (Residential)', category: 'residential', ratePerDecimal: 380000, descriptionBn: 'আবাসিক বাড়ি' },
      { id: 'commercial', nameBn: 'দোকান / বাণিজ্যিক', nameEn: 'Commercial / Shop', category: 'commercial', ratePerDecimal: 750000, descriptionBn: 'হাইওয়ে বা বাজার এলাকা' },
      { id: 'industrial', nameBn: 'কারখানা / শিল্প', nameEn: 'Industrial', category: 'commercial', ratePerDecimal: 900000, descriptionBn: 'শিল্পপ্রতিষ্ঠান ও শিপইয়ার্ড সংলগ্ন' },
      { id: 'pukur', nameBn: 'পুকুর / ডোবা', nameEn: 'Pond / Waterbody', category: 'water', ratePerDecimal: 120000, descriptionBn: 'পুকুর' },
    ],
  },
  {
    id: 'm-4',
    districtBn: 'ফেনী',
    districtEn: 'Feni',
    upazilaBn: 'ফেনী সদর',
    upazilaEn: 'Feni Sadar',
    mouzaBn: 'ধর্মপুর',
    mouzaEn: 'Dharmapur',
    jlNo: '০৮',
    effectiveYear: '২০২৪-২০২৬',
    rates: [
      { id: 'nal', nameBn: 'নাল (কৃষি জমি)', nameEn: 'Nal (Agricultural)', category: 'agri', ratePerDecimal: 110000, descriptionBn: 'আমন ও বোরো ফসলী জমি' },
      { id: 'viti', nameBn: 'ভিটি / চালা', nameEn: 'Viti (High Land)', category: 'residential', ratePerDecimal: 190000, descriptionBn: 'উঁচু চালা জমি' },
      { id: 'bari', nameBn: 'বাড়ি / বাস্তু', nameEn: 'Bari (Residential)', category: 'residential', ratePerDecimal: 290000, descriptionBn: 'আবাসিক বাস্তু' },
      { id: 'commercial', nameBn: 'দোকান / বাণিজ্যিক', nameEn: 'Commercial / Shop', category: 'commercial', ratePerDecimal: 520000, descriptionBn: 'দোকান বা ব্যবসা কেন্দ্র' },
      { id: 'pukur', nameBn: 'পুকুর / ডোবা', nameEn: 'Pond / Waterbody', category: 'water', ratePerDecimal: 90000, descriptionBn: 'পুকুর' },
    ],
  },
  {
    id: 'm-5',
    districtBn: 'কুমিল্লা',
    districtEn: 'Cumilla',
    upazilaBn: 'আদর্শ সদর',
    upazilaEn: 'Adarsha Sadar',
    mouzaBn: 'জগন্নাথপুর',
    mouzaEn: 'Jagannathpur',
    jlNo: '১৮',
    effectiveYear: '২০২৪-২০২৬',
    rates: [
      { id: 'nal', nameBn: 'নাল (কৃষি জমি)', nameEn: 'Nal (Agricultural)', category: 'agri', ratePerDecimal: 160000, descriptionBn: 'কৃষি নাল' },
      { id: 'viti', nameBn: 'ভিটি / চালা', nameEn: 'Viti (High Land)', category: 'residential', ratePerDecimal: 290000, descriptionBn: 'উঁচু জমি' },
      { id: 'bari', nameBn: 'বাড়ি / বাস্তু', nameEn: 'Bari (Residential)', category: 'residential', ratePerDecimal: 420000, descriptionBn: 'বসতবাড়ি' },
      { id: 'commercial', nameBn: 'দোকান / বাণিজ্যিক', nameEn: 'Commercial / Shop', category: 'commercial', ratePerDecimal: 700000, descriptionBn: 'বাণিজ্যিক প্লট' },
      { id: 'pukur', nameBn: 'পুকুর / ডোবা', nameEn: 'Pond / Waterbody', category: 'water', ratePerDecimal: 130000, descriptionBn: 'পুকুর' },
    ],
  },
];

export const MouzaRateScreen: React.FC<MouzaRateScreenProps> = ({ lang, onBack }) => {
  const isBn = lang === 'bn';

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ঢাকা');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMouzaId, setSelectedMouzaId] = useState<string>(SAMPLE_MOUZA_RATES[0].id);

  // Deed Cost Calculator State
  const [calcDecimal, setCalcDecimal] = useState<string>('5');
  const [selectedClassId, setSelectedClassId] = useState<string>('bari');
  const [isInsideCity, setIsInsideCity] = useState<boolean>(false);

  // Available districts
  const districts = useMemo(() => {
    const list = Array.from(new Set(SAMPLE_MOUZA_RATES.map((m) => m.districtBn)));
    return list;
  }, []);

  // Filtered mouzas by district & search
  const filteredMouzas = useMemo(() => {
    return SAMPLE_MOUZA_RATES.filter((m) => {
      const matchDistrict = selectedDistrict === 'all' || m.districtBn === selectedDistrict;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.mouzaBn.toLowerCase().includes(q) ||
        m.mouzaEn.toLowerCase().includes(q) ||
        m.upazilaBn.toLowerCase().includes(q) ||
        m.jlNo.includes(q);
      return matchDistrict && matchSearch;
    });
  }, [selectedDistrict, searchQuery]);

  // Active selected Mouza
  const activeMouza = useMemo(() => {
    return (
      SAMPLE_MOUZA_RATES.find((m) => m.id === selectedMouzaId) ||
      filteredMouzas[0] ||
      SAMPLE_MOUZA_RATES[0]
    );
  }, [selectedMouzaId, filteredMouzas]);

  // Selected land class for calculator
  const activeClass = useMemo(() => {
    return activeMouza.rates.find((r) => r.id === selectedClassId) || activeMouza.rates[0];
  }, [activeMouza, selectedClassId]);

  // Registration & Deed Cost Computations (Based on Bangladesh Registration Dept. Schedule)
  const deedCostBreakdown = useMemo(() => {
    const decimal = parseFloat(calcDecimal) || 0;
    const ratePerDecimal = activeClass ? activeClass.ratePerDecimal : 0;
    const totalDeedValue = decimal * ratePerDecimal;

    // Govt Fees:
    // 1. Stamp Duty (স্ট্যাম্প শুল্ক): 1.5%
    const stampDuty = Math.round(totalDeedValue * 0.015);

    // 2. Registration Fee (নিবন্ধন ফি): 1%
    const registrationFee = Math.round(totalDeedValue * 0.01);

    // 3. Local Govt Tax (স্থানীয় সরকার কর): 2% (outside city) or 3% (inside city/paurashava)
    const localGovtTaxRate = isInsideCity ? 0.03 : 0.02;
    const localGovtTax = Math.round(totalDeedValue * localGovtTaxRate);

    // 4. Source Tax (উৎস কর / AIT Sec 53C): Approx 3% to 5% based on location
    const sourceTaxRate = isInsideCity ? 0.04 : 0.03;
    const sourceTax = Math.round(totalDeedValue * sourceTaxRate);

    // 5. Affidavit & N-fee (হলফনামা ও এন ফি): Fixed ~350 + 200 tk
    const affidavitAndFees = 550;

    const totalGovtCost = stampDuty + registrationFee + localGovtTax + sourceTax + affidavitAndFees;

    return {
      totalDeedValue,
      stampDuty,
      registrationFee,
      localGovtTax,
      sourceTax,
      affidavitAndFees,
      totalGovtCost,
      effectiveGovtPercentage: totalDeedValue > 0 ? ((totalGovtCost / totalDeedValue) * 100).toFixed(1) : '0',
    };
  }, [calcDecimal, activeClass, isInsideCity]);

  return (
    <div id="mouza-rate-screen" className="space-y-4 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isBn ? 'হোম' : 'Home'}</span>
            </button>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Banknote className="w-6 h-6 text-orange-800" />
              <span>{isBn ? 'মৌজা রেট ও দলিল খরচ' : 'Mouza Rates & Deed Valuation'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn
                ? 'সাব-রেজিস্ট্রি অফিসের সরকারি সর্বনিম্ন বাজারমূল্য তালিকা ও রেজিস্ট্রেশন খরচ ক্যালকুলেটর'
                : 'Official Sub-Registry minimum land market rates and deed registration fee estimator'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* District Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isBn ? 'জেলা নির্বাচন করুন:' : 'Select District:'}
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-orange-500"
            >
              <option value="all">{isBn ? 'সকল জেলা' : 'All Districts'}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isBn ? 'মৌজা বা জেএল নম্বর খুঁজুন:' : 'Search Mouza or JL No:'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'উদা: বিরুলিয়া, জিনজিরা বা জেএল নম্বর...' : 'e.g. Birulia, Jinjira...'}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-orange-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Quick Mouza Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
          <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">
            {isBn ? 'উপলব্ধ মৌজা:' : 'Available:'}
          </span>
          {filteredMouzas.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMouzaId(m.id)}
              className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                selectedMouzaId === m.id
                  ? 'bg-orange-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              {m.mouzaBn} (জেএল {m.jlNo})
            </button>
          ))}
        </div>
      </div>

      {/* ACTIVE MOUZA RATE TABLE */}
      {activeMouza && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-950 text-[11px] font-extrabold">
                  {isBn ? 'জেএল নং: ' : 'JL No: '} {activeMouza.jlNo}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {activeMouza.mouzaBn} মৌজা ({activeMouza.upazilaBn}, {activeMouza.districtBn})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isBn
                  ? `কার্যকরী মেয়াদকাল: ${activeMouza.effectiveYear} (সাব-রেজিস্ট্রি অনুমোদিত সর্বনিম্ন সরকারি রেট)`
                  : `Effective Period: ${activeMouza.effectiveYear} (Govt. Sub-Registry Minimum Schedule)`}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">
                {isBn ? 'সর্বশেষ হালনাগাদ' : 'Updated'}
              </span>
              <span className="text-xs font-bold text-orange-900 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                {isBn ? '২০২৪-২৬ গ্যাজেট' : '2024-26 Gazette'}
              </span>
            </div>
          </div>

          {/* Rates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeMouza.rates.map((rate) => (
              <div
                key={rate.id}
                onClick={() => setSelectedClassId(rate.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedClassId === rate.id
                    ? 'bg-orange-50/70 border-orange-400 shadow-2xs ring-1 ring-orange-400'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{rate.nameBn}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase">
                    {rate.category}
                  </span>
                </div>

                <div className="mt-2.5">
                  <span className="text-[10px] text-slate-500 block">
                    {isBn ? 'শতক প্রতি রেট:' : 'Per Decimal:'}
                  </span>
                  <p className="text-lg font-black text-orange-950">
                    ৳ {formatNumberByLang(rate.ratePerDecimal, lang)}
                  </p>
                  <span className="text-[10px] text-slate-600 font-medium block mt-0.5">
                    {isBn ? 'কাঠা প্রতি (প্রায়): ' : 'Per Katha (approx): '} ৳{' '}
                    {formatNumberByLang(Math.round(rate.ratePerDecimal * 1.65), lang)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mt-2 line-clamp-1">
                  {rate.descriptionBn}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGISTRATION & DEED COST ESTIMATOR */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-orange-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-900 flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              {isBn ? 'দলিল রেজিস্ট্রেশন ও সরকারি খরচ হিসাব' : 'Deed Registration & Govt Fee Estimator'}
            </h3>
            <p className="text-xs text-slate-500">
              {isBn
                ? 'নির্বাচিত মৌজা রেটের ভিত্তিতে মোট দলিলের মূল্য ও সরকারি শুল্ক-কর গণনা'
                : 'Calculates total stamp duty, registration fees, and local govt taxes'}
            </p>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Decimal Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'জমির পরিমাণ (শতক):' : 'Land Size (Decimal):'}
            </label>
            <input
              type="number"
              step="any"
              value={calcDecimal}
              onChange={(e) => setCalcDecimal(e.target.value)}
              placeholder="5"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:border-orange-500"
            />
          </div>

          {/* Land Class Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'জমির শ্রেণী:' : 'Land Classification:'}
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:border-orange-500"
            >
              {activeMouza?.rates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameBn} (৳ {formatNumberByLang(r.ratePerDecimal, lang)}/শতক)
                </option>
              ))}
            </select>
          </div>

          {/* City / Paurashava toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'এলাকার ধরণ:' : 'Jurisdiction:'}
            </label>
            <button
              type="button"
              onClick={() => setIsInsideCity(!isInsideCity)}
              className={`w-full px-3 py-2 text-xs font-bold rounded-xl border transition flex items-center justify-between ${
                isInsideCity
                  ? 'bg-orange-50 text-orange-950 border-orange-300'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <span>{isInsideCity ? (isBn ? 'সিটি / পৌরসভা এলাকা' : 'City / Paurashava') : (isBn ? 'ইউনিয়ন পরিষদ এলাকা' : 'Union Parishad')}</span>
              <span className="text-[10px] font-normal text-slate-500">
                {isInsideCity ? 'ট্যাক্স ৩%' : 'ট্যাক্স ২%'}
              </span>
            </button>
          </div>
        </div>

        {/* Cost Summary Results */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          {/* Total Value */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-600 block">
                {isBn ? 'মোট দলিলের সর্বনিম্ন সরকারি মূল্য:' : 'Minimum Total Deed Value:'}
              </span>
              <span className="text-[11px] text-slate-400">
                {calcDecimal} শতক × ৳ {formatNumberByLang(activeClass?.ratePerDecimal || 0, lang)}
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              ৳ {formatNumberByLang(deedCostBreakdown.totalDeedValue, lang)}
            </p>
          </div>

          {/* Itemized Govt Fees */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] text-slate-500 block">স্ট্যাম্প শুল্ক (১.৫%):</span>
              <p className="font-bold text-slate-900 mt-0.5">
                ৳ {formatNumberByLang(deedCostBreakdown.stampDuty, lang)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] text-slate-500 block">রেজিস্ট্রেশন ফি (১%):</span>
              <p className="font-bold text-slate-900 mt-0.5">
                ৳ {formatNumberByLang(deedCostBreakdown.registrationFee, lang)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] text-slate-500 block">
                স্থানীয় সরকার কর ({isInsideCity ? '৩%' : '২%'}):
              </span>
              <p className="font-bold text-slate-900 mt-0.5">
                ৳ {formatNumberByLang(deedCostBreakdown.localGovtTax, lang)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] text-slate-500 block">
                উৎস কর / এআইটি ({isInsideCity ? '৪%' : '৩%'}):
              </span>
              <p className="font-bold text-slate-900 mt-0.5">
                ৳ {formatNumberByLang(deedCostBreakdown.sourceTax, lang)}
              </p>
            </div>
          </div>

          {/* Grand Total Estimated Cost */}
          <div className="p-3 rounded-xl bg-orange-900 text-white flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-orange-100 block">
                {isBn ? 'আনুমানিক সর্বমোট সরকারি খরচ:' : 'Estimated Total Govt Cost:'}
              </span>
              <span className="text-[10px] text-orange-200">
                (মোট মূল্যের প্রায় {deedCostBreakdown.effectiveGovtPercentage}%)
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black">
              ৳ {formatNumberByLang(deedCostBreakdown.totalGovtCost, lang)}
            </p>
          </div>
        </div>

        {/* Legal Advisory Note */}
        <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200/80 text-slate-700 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-orange-800 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-bold text-orange-950 mb-0.5">
              {isBn ? 'অফিসিয়াল আইনি পরামর্শ:' : 'Official Legal Advisory:'}
            </p>
            {isBn
              ? 'সাব-রেজিস্ট্রি অফিসে জমি রেজিস্ট্রেশনের ক্ষেত্রে সরকারি নির্ধারিত মৌজা রেটের চেয়ে কম মূল্য দেখিয়ে দলিল করা আইনত দণ্ডনীয়। বাস্তব বাজারমূল্য মৌজা রেটের চেয়ে বেশি হলে প্রকৃত মূল্যে দলিল সম্পাদন করা সমীচীন।'
              : 'Under the Registration Act, registering land below the official Mouza Rate is not permitted. If the actual market transaction exceeds the Mouza Rate, deed valuation must reflect the actual consideration.'}
          </div>
        </div>
      </div>
    </div>
  );
};
