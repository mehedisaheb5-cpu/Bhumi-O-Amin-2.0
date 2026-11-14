import React, { useState, useMemo } from 'react';
import { LandAreaUnit } from '../../types';
import {
  calculateLandUnits,
  convertAreaToSqFt,
  formatNumberByLang,
  getAreaUnitLabel,
  roundClean,
} from '../../lib/land-units';
import { saveCalculationToHistory } from '../../lib/land-calculations';
import {
  calculateInheritanceDistribution,
  HeirCategoryType,
  HeirItemInput,
  HeirPresetDefinition,
  InheritanceLawType,
  INHERITANCE_PRESETS,
  RuleVerificationStatus,
} from '../../lib/inheritance-calculations';
import {
  Users,
  Plus,
  Trash2,
  Scale,
  Copy,
  Check,
  RotateCcw,
  ShieldAlert,
  BookmarkPlus,
  AlertTriangle,
  FileCheck,
  Info,
  DollarSign,
  HeartHandshake,
  Layers,
  Sparkles,
} from 'lucide-react';

interface InheritanceCalculatorProps {
  lang: 'bn' | 'en';
}

export const InheritanceCalculator: React.FC<InheritanceCalculatorProps> = ({ lang }) => {
  const isBn = lang === 'bn';

  // Law Type: Muslim or Hindu
  const [lawType, setLawType] = useState<InheritanceLawType>('muslim');

  // Estate Inputs
  const [totalLandInput, setTotalLandInput] = useState<string>('100');
  const [areaUnit, setAreaUnit] = useState<LandAreaUnit>('decimal');
  const [estateValueInput, setEstateValueInput] = useState<string>('');

  // Heirs List
  const [heirs, setHeirs] = useState<HeirItemInput[]>([
    {
      id: '1',
      relation: isBn ? 'স্ত্রী (সন্তান থাকিলে)' : 'Wife (with children)',
      gender: 'female',
      category: 'sharer_quranic',
      count: 1,
      allocationMode: 'preset_standard',
      numerator: 1,
      denominator: 8,
      percent: 12.5,
      ratioWeight: 1,
      ruleStatus: 'verified_standard_reference',
      note: isBn
        ? 'সন্তান থাকায় স্ত্রী ১/৮ অংশ (সূরা নিসা: ১২)'
        : 'Wife gets 1/8 share due to children',
    },
    {
      id: '2',
      relation: isBn ? 'পুত্র (আসাবা)' : 'Son (Residuary)',
      gender: 'male',
      category: 'residuary_asaba',
      count: 2,
      allocationMode: 'residuary_ratio',
      numerator: 0,
      denominator: 1,
      percent: 0,
      ratioWeight: 2,
      ruleStatus: 'verified_standard_reference',
      note: isBn
        ? 'কন্যা থাকায় পুত্র ২:১ অনুপাতে অবশিষ্টাংশ আসাবা ভোগী'
        : 'Son inherits 2:1 residuary alongside daughter',
    },
    {
      id: '3',
      relation: isBn ? 'কন্যা (আসাবা)' : 'Daughter (Residuary)',
      gender: 'female',
      category: 'residuary_asaba',
      count: 1,
      allocationMode: 'residuary_ratio',
      numerator: 0,
      denominator: 1,
      percent: 0,
      ratioWeight: 1,
      ruleStatus: 'verified_standard_reference',
      note: isBn
        ? 'পুত্র থাকায় কন্যা আসাবা হিসেবে ১ অংশ পায়'
        : 'Daughter inherits 1 share in 2:1 residuary',
    },
  ]);

  // Selected Preset to Add
  const availablePresets = useMemo(() => {
    return INHERITANCE_PRESETS.filter((p) => p.law === lawType);
  }, [lawType]);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    availablePresets[0]?.id || 'muslim_wife_with_children'
  );
  const [newHeirCount, setNewHeirCount] = useState<number>(1);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Safe numerical calculations
  const totalLandNum = Math.max(0, parseFloat(totalLandInput) || 0);
  const estateValueNum = parseFloat(estateValueInput) > 0 ? parseFloat(estateValueInput) : undefined;

  // Calculation Results via Modular Engine
  const calculationResult = useMemo(() => {
    return calculateInheritanceDistribution(
      lawType,
      totalLandNum,
      areaUnit,
      estateValueNum,
      heirs,
      lang
    );
  }, [lawType, totalLandNum, areaUnit, estateValueNum, heirs, lang]);

  // Handler: Change Law Type
  const handleLawTypeChange = (newLaw: InheritanceLawType) => {
    setLawType(newLaw);
    const presetsForLaw = INHERITANCE_PRESETS.filter((p) => p.law === newLaw);
    if (presetsForLaw.length > 0) {
      setSelectedPresetId(presetsForLaw[0].id);
    }

    if (newLaw === 'hindu') {
      // Default initial heirs for Hindu
      setHeirs([
        {
          id: '1',
          relation: isBn ? 'পুত্র (দায়ভাগ প্রথম শ্রেণি)' : 'Son (Dayabhaga Class 1)',
          gender: 'male',
          category: 'hindu_dayabhaga_1',
          count: 2,
          allocationMode: 'residuary_ratio',
          numerator: 0,
          denominator: 1,
          percent: 0,
          ratioWeight: 1,
          ruleStatus: 'requires_legal_verification',
          note: isBn ? 'দায়ভাগ আইনে পুত্রদের মধ্যে সমান অংশ বণ্টন' : 'Equal division among sons',
        },
      ]);
    } else {
      // Default initial heirs for Muslim
      setHeirs([
        {
          id: '1',
          relation: isBn ? 'স্ত্রী (সন্তান থাকিলে)' : 'Wife (with children)',
          gender: 'female',
          category: 'sharer_quranic',
          count: 1,
          allocationMode: 'preset_standard',
          numerator: 1,
          denominator: 8,
          percent: 12.5,
          ratioWeight: 1,
          ruleStatus: 'verified_standard_reference',
          note: isBn ? 'সন্তান থাকায় স্ত্রী ১/৮ অংশ (সূরা নিসা: ১২)' : 'Wife gets 1/8 share',
        },
        {
          id: '2',
          relation: isBn ? 'পুত্র (আসাবা)' : 'Son (Residuary)',
          gender: 'male',
          category: 'residuary_asaba',
          count: 2,
          allocationMode: 'residuary_ratio',
          numerator: 0,
          denominator: 1,
          percent: 0,
          ratioWeight: 2,
          ruleStatus: 'verified_standard_reference',
          note: isBn ? 'পুত্র ২:১ অনুপাতে অবশিষ্টাংশ পায়' : 'Son 2:1 residuary',
        },
        {
          id: '3',
          relation: isBn ? 'কন্যা (আসাবা)' : 'Daughter (Residuary)',
          gender: 'female',
          category: 'residuary_asaba',
          count: 1,
          allocationMode: 'residuary_ratio',
          numerator: 0,
          denominator: 1,
          percent: 0,
          ratioWeight: 1,
          ruleStatus: 'verified_standard_reference',
          note: isBn ? 'কন্যা পুত্রের সাথে ১ অংশ পায়' : 'Daughter 1 share in 2:1',
        },
      ]);
    }
  };

  // Handler: Add Heir from Preset
  const handleAddHeirFromPreset = () => {
    const preset = availablePresets.find((p) => p.id === selectedPresetId) || availablePresets[0];
    if (!preset) return;

    const newHeir: HeirItemInput = {
      id: Date.now().toString(),
      relation: isBn ? preset.relationBn : preset.relationEn,
      gender: preset.gender,
      category: preset.category,
      count: Math.max(1, newHeirCount || 1),
      allocationMode: preset.defaultAllocationMode,
      numerator: preset.defaultNumerator || 0,
      denominator: preset.defaultDenominator || 1,
      percent:
        preset.defaultNumerator && preset.defaultDenominator
          ? roundClean((preset.defaultNumerator / preset.defaultDenominator) * 100, 2)
          : 0,
      ratioWeight: preset.ratioWeight || 1,
      ruleStatus: preset.ruleStatus,
      note: isBn ? preset.conditionNoteBn : preset.conditionNoteEn,
    };

    setHeirs([...heirs, newHeir]);
  };

  // Handler: Remove Heir
  const handleRemoveHeir = (id: string) => {
    setHeirs(heirs.filter((h) => h.id !== id));
  };

  // Handler: Update Heir Fields
  const handleUpdateHeir = (id: string, updates: Partial<HeirItemInput>) => {
    setHeirs((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        return { ...h, ...updates };
      })
    );
  };

  // Reset
  const handleReset = () => {
    setTotalLandInput('100');
    setAreaUnit('decimal');
    setEstateValueInput('');
    handleLawTypeChange('muslim');
  };

  // Copy Summary
  const handleCopySummary = () => {
    const lawTitle =
      lawType === 'muslim'
        ? isBn
          ? 'মুসলিম উত্তরাধিকার আইন (ফরায়েজ)'
          : 'Muslim Inheritance Law (Faraiz)'
        : isBn
        ? 'হিন্দু আইন (দায়ভাগ)'
        : 'Hindu Law (Dayabhaga)';

    const unitLbl = getAreaUnitLabel(areaUnit, lang);

    let summary = `ভূমি ও আমিন — উত্তরাধিকার বণ্টন প্রতিবেদন\nআইনগত কাঠামো: ${lawTitle}\n`;
    summary += `মোট জমি: ${formatNumberByLang(totalLandNum, lang)} ${unitLbl} (${formatNumberByLang(calculationResult.totalLandDecimal, lang)} শতক / ${formatNumberByLang(calculationResult.totalLandSqFt, lang)} বর্গফুট)\n`;
    if (estateValueNum) {
      summary += `সম্পত্তির আর্থিক মূল্যায়ন: ৳${formatNumberByLang(estateValueNum.toLocaleString(), lang)}\n`;
    }
    summary += `\nওয়ারিশ ও প্রাপ্ত অংশের তালিকা:\n`;

    calculationResult.heirs.forEach((h, idx) => {
      summary += `${idx + 1}. ${h.relation} (${formatNumberByLang(h.count, lang)} জন) [${h.shareDisplay}]:\n`;
      summary += `   - মোট অংশ: ${formatNumberByLang(h.groupDecimal, lang)} শতক | ${formatNumberByLang(h.groupKatha, lang)} কাঠা | ${formatNumberByLang(h.groupAcre, lang)} একর (${formatNumberByLang(h.groupSqFt, lang)} বর্গফুট)\n`;
      if (h.count > 1) {
        summary += `   - মাথাপিছু (জনপ্রতি): ${formatNumberByLang(h.perPersonDecimal, lang)} শতক | ${formatNumberByLang(h.perPersonKatha, lang)} কাঠা (${formatNumberByLang(h.perPersonSqFt, lang)} বর্গফুট)\n`;
      }
      if (h.groupValueBDT) {
        summary += `   - মোট আর্থিক মূল্য: ৳${formatNumberByLang(h.groupValueBDT.toLocaleString(), lang)}${h.count > 1 ? ` (জনপ্রতি: ৳${formatNumberByLang(h.perPersonValueBDT?.toLocaleString() || '', lang)})` : ''}\n`;
      }
      summary += `   - মর্যাদা: ${h.ruleStatus === 'verified_standard_reference' ? 'প্রামাণ্য শাস্ত্রীয় রেফারেন্স' : 'আইনগত ম্যানুয়াল যাচাই আবশ্যক'}\n\n`;
    });

    if (calculationResult.remainingPercent > 0) {
      summary += `অবশিষ্ট অবণ্টিত সম্পত্তি (${formatNumberByLang(calculationResult.remainingPercent, lang)}%): ${formatNumberByLang(calculationResult.remainingDecimal, lang)} শতক (${formatNumberByLang(calculationResult.remainingSqFt, lang)} বর্গফুট)\n`;
    }

    summary += `\n[আইনগত নোটিশ: উত্তরাধিকার হিসাব কোনো আইনগত পরামর্শের বিকল্প নয়। জটিল ফারায়েজ ও চূড়ান্ত বণ্টননামার জন্য বিজ্ঞ আদালত, সাব-রেজিস্ট্রি বা রেজিস্ট্রি আইন অনুসরণ করুন।]`;

    navigator.clipboard.writeText(summary.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save to Calculation History
  const handleSaveToHistory = () => {
    const unitLbl = getAreaUnitLabel(areaUnit, lang);
    const desc = isBn
      ? `উত্তরাধিকার হিসাব (${lawType === 'muslim' ? 'মুসলিম' : 'হিন্দু'}): মোট ${formatNumberByLang(totalLandNum, lang)} ${unitLbl} (${formatNumberByLang(calculationResult.totalLandDecimal, lang)} শতক), ওয়ারিশ: ${formatNumberByLang(heirs.reduce((s, h) => s + h.count, 0), lang)} জন`
      : `Inheritance (${lawType}): Total ${totalLandNum} ${unitLbl} (${calculationResult.totalLandDecimal} Dec), ${heirs.reduce((s, h) => s + h.count, 0)} Heirs`;

    const details: Record<string, string | number> = {
      lawType,
      totalLand: totalLandNum,
      unit: areaUnit,
      allocatedPercent: calculationResult.totalAllocatedPercent,
      remainingPercent: calculationResult.remainingPercent,
      heirCount: heirs.reduce((s, h) => s + h.count, 0),
    };

    if (estateValueNum) {
      details.estateValueBDT = estateValueNum;
    }

    calculationResult.heirs.forEach((h, i) => {
      details[`heir_${i + 1}`] = `${h.relation} (${h.count} pers., ${h.shareDisplay}): ${h.groupDecimal} dec / ${h.groupAcre} acre`;
    });

    saveCalculationToHistory({
      shape: 'polygon',
      unit: 'feet',
      areaSqFt: calculationResult.totalLandSqFt,
      areaSqMeter: roundClean(calculationResult.totalLandSqFt / 10.7639, 2),
      shatangsha: calculationResult.totalLandDecimal,
      katha: calculationResult.totalLandKatha,
      bigha: calculationResult.totalLandBigha,
      acre: calculationResult.totalLandAcre,
      inputDescription: desc,
      shapeNameBn: 'উত্তরাধিকার বণ্টন',
      shapeNameEn: 'Inheritance Distribution',
      details,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div id="inheritance-calculator-root" className="space-y-4">
      {/* Mandatory Statutory Notice */}
      <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-black block text-sm">
            {isBn ? 'আইনগত নোটিশ ও সতর্কীকরণ' : 'Legal Notice & Verification Warning'}
          </span>
          <p className="text-[11px] text-amber-900 leading-relaxed mt-0.5">
            {isBn
              ? 'উত্তরাধিকার বণ্টন আইনগত পরামর্শের বিকল্প নয়। এটি প্রাথমিক তথ্য সংগ্রহ ও আনুপাতিক হিসাবের মডুলার ফ্রেমওয়ার্ক। বাংলাদেশের মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১ ও প্রচলিত ফরায়েজ বা হিন্দু দায়ভাগ বিধিমালার চূড়ান্ত বণ্টনের জন্য সংশ্লিষ্ট সাব-রেজিস্ট্রি অফিস, কাজী বা বিজ্ঞ দেওয়ানি আদালতের প্রামাণ্য প্রত্যয়ন আবশ্যক।'
              : 'Inheritance calculation is not a substitute for legal advice. This is a modular framework for structured heir cataloging. Final title and partition require validation under statutory Bangladeshi succession laws.'}
          </p>
        </div>
      </div>

      {/* Law Selection & Estate Total */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-800" />
              <span>{isBn ? 'উত্তরাধিকার আইন ও এস্টেট বিবরণ' : 'Inheritance Law & Estate'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn
                ? 'আইনগত কাঠামো, মৃত ব্যক্তির মোট জমি এবং ঐচ্ছিক এস্টেট মূল্যায়ন নির্ধারণ করুন'
                : 'Select legal framework, total deceased estate land, and optional valuation'}
            </p>
          </div>

          {/* Muslim / Hindu Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto">
            <button
              onClick={() => handleLawTypeChange('muslim')}
              className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-center transition ${
                lawType === 'muslim'
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {isBn ? 'মুসলিম পারিবারিক আইন (ফরায়েজ)' : 'Muslim Law (Faraiz)'}
            </button>
            <button
              onClick={() => handleLawTypeChange('hindu')}
              className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-center transition ${
                lawType === 'hindu'
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {isBn ? 'হিন্দু আইন (দায়ভাগ)' : 'Hindu Law (Dayabhaga)'}
            </button>
          </div>
        </div>

        {/* Total Estate Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              {isBn ? 'মোট ত্যাজ্য সম্পত্তি / জমি' : 'Total Estate Land'}
            </label>
            <input
              id="inheritance-total-land-input"
              type="number"
              min="0"
              step="any"
              value={totalLandInput}
              onChange={(e) => setTotalLandInput(e.target.value)}
              placeholder="100"
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              {isBn ? 'পরিমাপের একক' : 'Area Unit'}
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['decimal', 'katha', 'bigha', 'acre', 'sqFt', 'sqMeter'] as LandAreaUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setAreaUnit(u)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                    areaUnit === u
                      ? 'bg-emerald-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {getAreaUnitLabel(u, lang)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              {isBn ? 'সম্পত্তির আর্থিক মূল্যায়ন (টাকা - ঐচ্ছিক)' : 'Estate Cash Valuation (BDT - Optional)'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                value={estateValueInput}
                onChange={(e) => setEstateValueInput(e.target.value)}
                placeholder="যেমন: ৫০০০০০০"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 pl-7 focus:outline-none focus:ring-2 focus:ring-emerald-700 shadow-2xs"
              />
              <span className="absolute left-2.5 top-2.5 text-xs font-bold text-slate-400">৳</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {isBn ? 'ওয়ারিশদের টাকার অংশ হিসাবের জন্য' : 'Calculates cash value per heir'}
            </span>
          </div>
        </div>

        {/* Estate Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট শতাংশ' : 'Total Decimal'}</span>
            <span className="text-sm font-black text-emerald-900">
              {formatNumberByLang(calculationResult.totalLandDecimal, lang)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট কাঠা' : 'Total Katha'}</span>
            <span className="text-sm font-black text-blue-900">
              {formatNumberByLang(calculationResult.totalLandKatha, lang)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট বিঘা' : 'Total Bigha'}</span>
            <span className="text-sm font-black text-amber-900">
              {formatNumberByLang(calculationResult.totalLandBigha, lang)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট একর' : 'Total Acre'}</span>
            <span className="text-sm font-black text-purple-900">
              {formatNumberByLang(calculationResult.totalLandAcre, lang)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট বর্গফুট' : 'Total Sq Ft'}</span>
            <span className="text-sm font-black text-slate-800">
              {formatNumberByLang(calculationResult.totalLandSqFt, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* Heirs Entry & Catalog */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-800" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {isBn ? 'ওয়ারিশগণের তালিকা ও হিস্যা কাঠামো' : 'List of Heirs & Share Structure'}
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {isBn ? 'মোট ওয়ারিশ:' : 'Total Heirs:'}{' '}
              {formatNumberByLang(
                heirs.reduce((sum, h) => sum + h.count, 0),
                lang
              )}{' '}
              {isBn ? 'জন' : ''}
            </span>
          </div>
        </div>

        {/* Add Heir Selector Form */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <span className="text-xs font-bold text-slate-800 block">
            {isBn ? 'নতুন ওয়ারিশ বা সম্পর্ক যোগ করুন:' : 'Add Legal Heir / Relative:'}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-7">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {availablePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {isBn ? p.relationBn : p.relationEn} (
                    {p.ruleStatus === 'verified_standard_reference'
                      ? isBn ? 'রেফারেন্স' : 'Standard'
                      : isBn ? 'যাচাই সাপেক্ষ' : 'Verification req.'}
                    )
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newHeirCount}
                  onChange={(e) => setNewHeirCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <span className="text-xs text-slate-500 font-semibold shrink-0">
                  {isBn ? 'জন' : 'pers.'}
                </span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleAddHeirFromPreset}
                className="w-full h-full py-2 px-3 rounded-lg bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBn ? 'যোগ' : 'Add'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Balance & Status Message */}
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            calculationResult.balanceStatus === 'deficit_awl'
              ? 'bg-red-50 border-red-200 text-red-900'
              : calculationResult.balanceStatus === 'surplus_residual'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {calculationResult.balanceStatus === 'deficit_awl' ? (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            ) : calculationResult.balanceStatus === 'surplus_residual' ? (
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            )}
            <span className="font-bold">
              {isBn ? calculationResult.statusMessageBn : calculationResult.statusMessageEn}
            </span>
          </div>

          <span className="font-black text-xs shrink-0">
            {formatNumberByLang(calculationResult.totalAllocatedPercent, lang)}%
          </span>
        </div>

        {/* Heirs Table / Cards */}
        <div className="space-y-3">
          {calculationResult.heirs.map((heir, idx) => {
            const rawHeir = heirs.find((h) => h.id === heir.id);

            return (
              <div
                key={heir.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 transition hover:border-emerald-300"
              >
                {/* Top Row: Index, Title, Badges, Count, and Delete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {formatNumberByLang(idx + 1, lang)}
                    </span>

                    {/* Editable Relation Name */}
                    <input
                      type="text"
                      value={rawHeir?.relation || heir.relation}
                      onChange={(e) => handleUpdateHeir(heir.id, { relation: e.target.value })}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />

                    {/* Category Badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                      {isBn ? heir.categoryLabelBn : heir.categoryLabelEn}
                    </span>

                    {/* Rule Status Badge */}
                    {heir.ruleStatus === 'verified_standard_reference' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <FileCheck className="w-3 h-3" />
                        <span>{isBn ? 'প্রামাণ্য রেফারেন্স' : 'Verified Ref'}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{isBn ? 'আইনগত যাচাই আবশ্যক' : 'Legal Verification Req.'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-between sm:justify-end">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isBn ? 'ওয়ারিশ সংখ্যা:' : 'Count:'}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={heir.count}
                        onChange={(e) =>
                          handleUpdateHeir(heir.id, {
                            count: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-14 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isBn ? 'জন' : ''}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveHeir(heir.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title={isBn ? 'মুছুন' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Heir Share Controls (if user wants to customize fraction/ratio) */}
                <div className="flex items-center gap-2 flex-wrap text-xs bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isBn ? 'বণ্টন পদ্ধতি:' : 'Mode:'}
                  </span>

                  <select
                    value={rawHeir?.allocationMode || 'preset_standard'}
                    onChange={(e) =>
                      handleUpdateHeir(heir.id, {
                        allocationMode: e.target.value as any,
                      })
                    }
                    className="px-2 py-1 rounded bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
                  >
                    <option value="preset_standard">{isBn ? 'ভগ্নাংশ (লব/হর)' : 'Fraction'}</option>
                    <option value="residuary_ratio">{isBn ? 'আসাবা অবশিষ্টাংশ অনুপাত' : 'Residuary Ratio'}</option>
                    <option value="custom_percent">{isBn ? 'কাস্টম শতকরা (%)' : 'Custom Percent'}</option>
                  </select>

                  {/* Mode-specific quick controls */}
                  {(rawHeir?.allocationMode === 'preset_standard' ||
                    rawHeir?.allocationMode === 'custom_fraction') && (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 font-medium">{isBn ? 'অংশ:' : 'Fraction:'}</span>
                      <input
                        type="number"
                        min="0"
                        value={rawHeir?.numerator ?? 1}
                        onChange={(e) =>
                          handleUpdateHeir(heir.id, {
                            numerator: Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className="w-12 px-1 py-0.5 rounded border border-slate-300 text-xs font-black text-center"
                      />
                      <span className="font-bold text-slate-400">/</span>
                      <input
                        type="number"
                        min="1"
                        value={rawHeir?.denominator ?? 8}
                        onChange={(e) =>
                          handleUpdateHeir(heir.id, {
                            denominator: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-12 px-1 py-0.5 rounded border border-slate-300 text-xs font-black text-center"
                      />
                    </div>
                  )}

                  {rawHeir?.allocationMode === 'residuary_ratio' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 font-medium">{isBn ? 'অনুপাত ওজন:' : 'Weight:'}</span>
                      <input
                        type="number"
                        min="1"
                        value={rawHeir?.ratioWeight ?? 1}
                        onChange={(e) =>
                          handleUpdateHeir(heir.id, {
                            ratioWeight: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-12 px-1 py-0.5 rounded border border-slate-300 text-xs font-black text-center"
                      />
                      <span className="text-[10px] text-slate-400">
                        {isBn ? '(যেমন পুত্র ২, কন্যা ১)' : '(e.g. Son 2, Daughter 1)'}
                      </span>
                    </div>
                  )}

                  {rawHeir?.allocationMode === 'custom_percent' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 font-medium">{isBn ? 'শতকরা:' : 'Percent:'}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={rawHeir?.percent ?? 12.5}
                        onChange={(e) =>
                          handleUpdateHeir(heir.id, {
                            percent: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-16 px-1 py-0.5 rounded border border-slate-300 text-xs font-black text-center"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                  )}
                </div>

                {/* Calculated Land & Estate Share Outputs for this Heir */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-center text-xs pt-1 border-t border-slate-200/60">
                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      {isBn ? 'মোট হিস্যা' : 'Group Share'}
                    </span>
                    <span className="font-bold text-emerald-900 line-clamp-1">
                      {heir.shareDisplay}
                    </span>
                  </div>

                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      {isBn ? 'মোট শতক' : 'Total Decimal'}
                    </span>
                    <span className="font-black text-slate-900">
                      {formatNumberByLang(heir.groupDecimal, lang)}
                    </span>
                    {heir.count > 1 && (
                      <span className="text-[9px] text-slate-400 block">
                        ({formatNumberByLang(heir.perPersonDecimal, lang)} {isBn ? 'জনপ্রতি' : 'each'})
                      </span>
                    )}
                  </div>

                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      {isBn ? 'মোট কাঠা' : 'Total Katha'}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatNumberByLang(heir.groupKatha, lang)}
                    </span>
                    {heir.count > 1 && (
                      <span className="text-[9px] text-slate-400 block">
                        ({formatNumberByLang(heir.perPersonKatha, lang)} {isBn ? 'জনপ্রতি' : 'each'})
                      </span>
                    )}
                  </div>

                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      {isBn ? 'মোট একর' : 'Total Acre'}
                    </span>
                    <span className="font-bold text-purple-900">
                      {formatNumberByLang(heir.groupAcre, lang)}
                    </span>
                  </div>

                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      {isBn ? 'মোট বর্গফুট' : 'Total Sq Ft'}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatNumberByLang(heir.groupSqFt, lang)}
                    </span>
                  </div>

                  {/* Optional Cash Value */}
                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      {isBn ? 'মূল্য (টাকা)' : 'Value (BDT)'}
                    </span>
                    <span className="font-black text-emerald-800">
                      {heir.groupValueBDT
                        ? `৳${formatNumberByLang(heir.groupValueBDT.toLocaleString(), lang)}`
                        : '—'}
                    </span>
                    {heir.count > 1 && heir.perPersonValueBDT && (
                      <span className="text-[9px] text-slate-400 block">
                        (৳{formatNumberByLang(heir.perPersonValueBDT.toLocaleString(), lang)} {isBn ? 'জনপ্রতি' : 'each'})
                      </span>
                    )}
                  </div>
                </div>

                {/* Condition note if any */}
                {rawHeir?.note && (
                  <p className="text-[10px] text-slate-500 italic px-1">
                    {rawHeir.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Remaining Land Details Card */}
        {calculationResult.remainingPercent > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-amber-950 block">
                {isBn ? 'অবশিষ্ট অবণ্টিত ত্যাজ্য সম্পত্তি:' : 'Remaining Undistributed Estate:'}
              </span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {isBn
                  ? `${formatNumberByLang(calculationResult.remainingPercent, lang)}% সম্পত্তি এখনো বণ্টন করা হয়নি। ফরায়েজ শাস্ত্রীয় রদ্দ নীতি বা অতিরিক্ত ওয়ারিশের বিধান প্রযোজ্য হতে পারে।`
                  : `${calculationResult.remainingPercent}% estate remains unallocated.`}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-amber-900">
                <span>{formatNumberByLang(calculationResult.remainingDecimal, lang)} {isBn ? 'শতক' : 'Dec'}</span>
                <span>•</span>
                <span>{formatNumberByLang(calculationResult.remainingKatha, lang)} {isBn ? 'কাঠা' : 'Katha'}</span>
                <span>•</span>
                <span>{formatNumberByLang(calculationResult.remainingAcre, lang)} {isBn ? 'একর' : 'Acre'}</span>
                <span>•</span>
                <span>{formatNumberByLang(calculationResult.remainingSqFt, lang)} {isBn ? 'বর্গফুট' : 'sq ft'}</span>
                {calculationResult.remainingValueBDT && (
                  <>
                    <span>•</span>
                    <span>৳{formatNumberByLang(calculationResult.remainingValueBDT.toLocaleString(), lang)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Foundation Notice regarding future verified Bangladesh-specific inheritance rules */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs space-y-1">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-800" />
            <span>{isBn ? 'উন্নত মডুলার স্থাপত্য ও আইনি প্রামাণ্যতা' : 'Modular Architecture & Statutory Ready'}</span>
          </span>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {isBn
              ? 'এই ক্যালকুলেটর কোনো ধারণাপ্রসূত বা অনিশ্চিত আইনগত নিয়ম চাপিয়ে দেয় না। স্পষ্ট কুরআন ও বিধিবদ্ধ রেফারেন্সগুলো স্বয়ংক্রিয় প্রামাণ্য ব্যাজ সহ প্রদর্শিত হয়, এবং জটিল বা বিশেষ পরিস্থিতিগুলোকে ম্যানুয়াল আইনি যাচাই হিসেবে স্পষ্ট চিহ্নিত রাখা হয়েছে যাতে ভবিষ্যতে আইনগত আপডেট অনায়াসে যুক্ত করা যায়।'
              : 'Architecture ensures transparent distinction between verified canonical references and cases requiring statutory civil verification, remaining fully ready for future verified succession rule additions.'}
          </p>
        </div>

        {/* Action Buttons: Reset, Copy, Save */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isBn ? 'রিসেট' : 'Reset'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-emerald-700">{isBn ? 'কপি হয়েছে!' : 'Copied!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isBn ? 'প্রতিবেদন কপি করুন' : 'Copy Summary'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveToHistory}
              disabled={calculationResult.totalLandSqFt <= 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 disabled:opacity-50 text-white text-xs font-bold transition active:scale-95 shadow-2xs"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{isBn ? 'সংরক্ষিত!' : 'Saved!'}</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'হিসাব সংরক্ষণ' : 'Save Calculation'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
