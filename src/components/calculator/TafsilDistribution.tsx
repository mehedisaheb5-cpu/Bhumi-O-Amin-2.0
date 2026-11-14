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
import { printWithNoto } from '../../lib/print-utils';
import {
  calculateTafsilDistribution,
  prepareTafsilReportData,
  TafsilDistributionMode,
  TafsilMetadata,
  TafsilOwnerInput,
} from '../../lib/tafsil-calculations';
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  Check,
  BookmarkPlus,
  AlertTriangle,
  RotateCcw,
  Percent,
  Compass,
  Scale,
  Printer,
  Eye,
  Edit3,
  SlidersHorizontal,
  ArrowRightLeft,
  ShieldAlert,
  Info,
  MapPin,
} from 'lucide-react';
import { LocationSelectionValue } from '../../types/administrative-location';
import { BangladeshLocationSelector } from '../common/BangladeshLocationSelector';
import { ProfessionalServiceDisclaimer } from '../common/ProfessionalServiceDisclaimer';

interface TafsilDistributionProps {
  lang: 'bn' | 'en';
}

export const TafsilDistribution: React.FC<TafsilDistributionProps> = ({ lang }) => {
  const isBn = lang === 'bn';

  // Mode: Proportional or Manual
  const [distributionMode, setDistributionMode] = useState<TafsilDistributionMode>('proportional');

  // View Mode: Edit View vs A4 Printable Draft Preview
  const [viewMode, setViewMode] = useState<'edit' | 'report'>('edit');

  // Total Land Area & Unit
  const [totalLandInput, setTotalLandInput] = useState<string>('50');
  const [areaUnit, setAreaUnit] = useState<LandAreaUnit>('decimal');

  // Tafsil Legal Metadata Fields
  const [metadata, setMetadata] = useState<TafsilMetadata>({
    district: '',
    upazila: '',
    union: '',
    mouza: '',
    jlNo: '',
    dagNo: '',
    khatianNo: '',
    landClass: isBn ? 'নাল জমি' : 'Agricultural / Nal',
    generalNotes: '',
  });

  // Multiple Owners List
  const [owners, setOwners] = useState<TafsilOwnerInput[]>([
    {
      id: '1',
      name: isBn ? 'মোঃ রহিম উল্লাহ' : 'Md. Rahim Ullah',
      relationOrFather: isBn ? 'পিতা: মৃত আবদুল করিম' : 'Father: Late Abdul Karim',
      shareType: 'percent',
      requestedPercent: '60',
      numeratorStr: '3',
      denominatorStr: '5',
      manualDecimalStr: '30',
      allottedSide: isBn ? 'উত্তর পার্শ্ব (রাস্তা সংলগ্ন)' : 'North side (Road facing)',
      notes: '',
    },
    {
      id: '2',
      name: isBn ? 'মোছাঃ ফাতেমা বেগম' : 'Mst. Fatema Begum',
      relationOrFather: isBn ? 'স্বামী: মোঃ রহিম উল্লাহ' : 'Husband: Md. Rahim Ullah',
      shareType: 'percent',
      requestedPercent: '40',
      numeratorStr: '2',
      denominatorStr: '5',
      manualDecimalStr: '20',
      allottedSide: isBn ? 'দক্ষিণ পার্শ্ব (পুকুর পাড়)' : 'South side (Pond side)',
      notes: '',
    },
  ]);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Parse numerical input
  const totalLandNum = Math.max(0, parseFloat(totalLandInput) || 0);

  // Distribution calculation
  const distributionResult = useMemo(() => {
    return calculateTafsilDistribution(
      distributionMode,
      totalLandNum,
      areaUnit,
      metadata,
      owners,
      lang
    );
  }, [distributionMode, totalLandNum, areaUnit, metadata, owners, lang]);

  // Report A4 Structure
  const reportA4 = useMemo(() => {
    return prepareTafsilReportData(distributionResult, lang);
  }, [distributionResult, lang]);

  // Handler: Update metadata
  const handleUpdateMetadata = (field: keyof TafsilMetadata, val: string) => {
    setMetadata((prev) => ({ ...prev, [field]: val }));
  };

  // Handler: Add Owner
  const handleAddOwner = () => {
    const nextNum = owners.length + 1;
    const remainingPct = distributionResult.remainingPercent > 0 ? distributionResult.remainingPercent : 0;
    const remainingDec = distributionResult.remainingDecimal > 0 ? distributionResult.remainingDecimal : 0;

    const newOwner: TafsilOwnerInput = {
      id: Date.now().toString(),
      name: isBn ? `অংশীদার ${nextNum}` : `Owner ${nextNum}`,
      relationOrFather: '',
      shareType: 'percent',
      requestedPercent: remainingPct > 0 ? String(roundClean(remainingPct, 2)) : '0',
      numeratorStr: '1',
      denominatorStr: '4',
      manualDecimalStr: remainingDec > 0 ? String(roundClean(remainingDec, 2)) : '0',
      allottedSide: '',
      notes: '',
    };

    setOwners([...owners, newOwner]);
  };

  // Handler: Remove Owner
  const handleRemoveOwner = (id: string) => {
    if (owners.length <= 1) return;
    setOwners(owners.filter((o) => o.id !== id));
  };

  // Handler: Update Owner field
  const handleUpdateOwner = (id: string, updates: Partial<TafsilOwnerInput>) => {
    setOwners((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return { ...o, ...updates };
      })
    );
  };

  // Quick Action: Auto-balance / Normalize to 100%
  const handleAutoBalance = () => {
    const totalReq = owners.reduce((sum, o) => {
      const p = parseFloat(o.requestedPercent) || 0;
      return sum + p;
    }, 0);

    if (totalReq <= 0) return;

    setOwners((prev) =>
      prev.map((o) => {
        const p = parseFloat(o.requestedPercent) || 0;
        const normalized = roundClean((p / totalReq) * 100, 3);
        const dec = roundClean((distributionResult.totalDecimal * normalized) / 100, 3);
        return {
          ...o,
          requestedPercent: String(normalized),
          manualDecimalStr: String(dec),
        };
      })
    );
  };

  // Quick Action: Add Owner with remaining land
  const handleAddRemainderOwner = () => {
    if (distributionResult.remainingDecimal <= 0) return;
    const nextNum = owners.length + 1;
    const newOwner: TafsilOwnerInput = {
      id: Date.now().toString(),
      name: isBn ? `অবশিষ্ট অংশীদার ${nextNum}` : `Remainder Owner ${nextNum}`,
      relationOrFather: '',
      shareType: 'percent',
      requestedPercent: String(roundClean(distributionResult.remainingPercent, 2)),
      numeratorStr: '1',
      denominatorStr: '1',
      manualDecimalStr: String(roundClean(distributionResult.remainingDecimal, 2)),
      allottedSide: '',
      notes: isBn ? 'অবশিষ্ট জমি বণ্টন' : 'Remaining land allocation',
    };
    setOwners([...owners, newOwner]);
  };

  // Reset
  const handleReset = () => {
    setTotalLandInput('50');
    setAreaUnit('decimal');
    setDistributionMode('proportional');
    setMetadata({
      district: '',
      upazila: '',
      union: '',
      mouza: '',
      jlNo: '',
      dagNo: '',
      khatianNo: '',
      landClass: isBn ? 'নাল জমি' : 'Agricultural / Nal',
      generalNotes: '',
    });
    setOwners([
      {
        id: '1',
        name: isBn ? 'মোঃ রহিম উল্লাহ' : 'Md. Rahim Ullah',
        relationOrFather: isBn ? 'পিতা: মৃত আবদুল করিম' : 'Father: Late Abdul Karim',
        shareType: 'percent',
        requestedPercent: '60',
        numeratorStr: '3',
        denominatorStr: '5',
        manualDecimalStr: '30',
        allottedSide: isBn ? 'উত্তর পার্শ্ব (রাস্তা সংলগ্ন)' : 'North side (Road facing)',
        notes: '',
      },
      {
        id: '2',
        name: isBn ? 'মোছাঃ ফাতেমা বেগম' : 'Mst. Fatema Begum',
        relationOrFather: isBn ? 'স্বামী: মোঃ রহিম উল্লাহ' : 'Husband: Md. Rahim Ullah',
        shareType: 'percent',
        requestedPercent: '40',
        numeratorStr: '2',
        denominatorStr: '5',
        manualDecimalStr: '20',
        allottedSide: isBn ? 'দক্ষিণ পার্শ্ব (পুকুর পাড়)' : 'South side (Pond side)',
        notes: '',
      },
    ]);
  };

  // Copy Summary
  const handleCopySummary = () => {
    const unitLbl = getAreaUnitLabel(areaUnit, lang);
    let text = isBn
      ? `ভূমি ও আমিন — আধুনিক তফসিল ও জমি ভাগ-বণ্টন খসড়া\n[ডিজিটাল খসড়া ও হিসাব — আইনগত দলিল নয়]\n\n`
      : `Bhumi O Amin — Advanced Tafsil & Land Distribution Draft\n[DIGITAL DRAFT / CALCULATION — Not a legal deed]\n\n`;

    // Tafsil Information
    text += `${isBn ? '--- তফসিল বিবরণী ---' : '--- Tafsil Details ---'}\n`;
    if (metadata.district) text += `${isBn ? 'জেলা' : 'District'}: ${metadata.district} | `;
    if (metadata.upazila) text += `${isBn ? 'উপজেলা' : 'Upazila'}: ${metadata.upazila} | `;
    if (metadata.union) text += `${isBn ? 'ইউনিয়ন' : 'Union'}: ${metadata.union} | `;
    if (metadata.mouza) text += `${isBn ? 'মৌজা' : 'Mouza'}: ${metadata.mouza}\n`;
    if (metadata.jlNo) text += `${isBn ? 'জে.এল. নং' : 'J.L. No'}: ${metadata.jlNo} | `;
    if (metadata.khatianNo) text += `${isBn ? 'খতিয়ান নং' : 'Khatian'}: ${metadata.khatianNo} | `;
    if (metadata.dagNo) text += `${isBn ? 'দাগ নং' : 'Dag No'}: ${metadata.dagNo} | `;
    if (metadata.landClass) text += `${isBn ? 'শ্রেণি' : 'Class'}: ${metadata.landClass}\n`;

    text += `${isBn ? 'মোট জমি' : 'Total Land'}: ${formatNumberByLang(totalLandNum, lang)} ${unitLbl} (${formatNumberByLang(distributionResult.totalDecimal, lang)} শতক / ${formatNumberByLang(distributionResult.totalSqFt, lang)} বর্গফুট)\n\n`;

    // Distribution
    text += `${isBn ? '--- অংশীদার ও জমি বণ্টন বিবরণী ---' : '--- Land Distribution by Owner ---'}\n`;
    distributionResult.owners.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name}${item.relationOrFather ? ` (${item.relationOrFather})` : ''}\n`;
      text += `   - হিস্যা/অংশ: ${item.requestedFractionStr} ➔ বণ্টিত: ${formatNumberByLang(item.allocatedPercent, lang)}%\n`;
      text += `   - শতাংশ/শতক: ${formatNumberByLang(item.allocatedDecimal, lang)} শতক\n`;
      text += `   - কাঠা: ${formatNumberByLang(item.allocatedKatha, lang)} কাঠা\n`;
      text += `   - বিঘা: ${formatNumberByLang(item.allocatedBigha, lang)} বিঘা\n`;
      text += `   - একর: ${formatNumberByLang(item.allocatedAcre, lang)} একর\n`;
      text += `   - বর্গফুট: ${formatNumberByLang(item.allocatedSqFt, lang)} বর্গফুট\n`;
      if (item.allottedSide) {
        text += `   - নির্ধারিত দিক/চৌহদ্দি: ${item.allottedSide}\n`;
      }
      if (item.hasVariance) {
        text += `   - ব্যবধান (অনুরোধ বনাম বণ্টন): ${formatNumberByLang(item.varianceDecimal, lang)} শতক\n`;
      }
      text += `\n`;
    });

    if (distributionResult.remainingDecimal > 0) {
      text += isBn
        ? `অবশিষ্ট অবণ্টিত জমি (${formatNumberByLang(distributionResult.remainingPercent, lang)}%): ${formatNumberByLang(distributionResult.remainingDecimal, lang)} শতক (${formatNumberByLang(distributionResult.remainingSqFt, lang)} বর্গফুট)\n\n`
        : `Remaining Unallocated (${distributionResult.remainingPercent}%): ${distributionResult.remainingDecimal} Decimals (${distributionResult.remainingSqFt} sq ft)\n\n`;
    }

    if (metadata.generalNotes) {
      text += `${isBn ? 'সাধারণ মন্তব্য' : 'Remarks'}: ${metadata.generalNotes}\n\n`;
    }

    text += isBn
      ? `[সতর্কতা: ডিজিটাল খসড়া ও হিসাব — এটি প্রাথমিক পরিকল্পনা ও আনুপাতিক হিসাবের জন্য প্রস্তুতকৃত। কোনো দেওয়ানি বিরোধ বা আইনগত দলিল হিসেবে গণ্য হবে না। সাব-রেজিস্ট্রি অফিসে বৈধ বণ্টননামা দলিলের মাধ্যমে রেজিস্ট্রি আবশ্যক।]`
      : `[Disclaimer: DIGITAL DRAFT / CALCULATION — Prepared for indicative survey distribution only. Not a legally registered partition deed.]`;

    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save to Calculation History
  const handleSaveToHistory = () => {
    const unitLbl = getAreaUnitLabel(areaUnit, lang);
    const desc = isBn
      ? `তফসিল বণ্টন: মৌজা ${metadata.mouza || '—'}, দাগ ${metadata.dagNo || '—'}, খতিয়ান ${metadata.khatianNo || '—'} (${formatNumberByLang(totalLandNum, lang)} ${unitLbl}), অংশীদার: ${formatNumberByLang(owners.length, lang)} জন`
      : `Tafsil Distribution: Mouza ${metadata.mouza || '—'}, Dag ${metadata.dagNo || '—'}, Khatian ${metadata.khatianNo || '—'} (${totalLandNum} ${unitLbl}), ${owners.length} owners`;

    const details: Record<string, string | number> = {
      district: metadata.district,
      upazila: metadata.upazila,
      union: metadata.union,
      mouza: metadata.mouza,
      jlNo: metadata.jlNo,
      dagNo: metadata.dagNo,
      khatianNo: metadata.khatianNo,
      landClass: metadata.landClass,
      mode: distributionMode,
      totalLand: totalLandNum,
      unit: areaUnit,
      allocatedDecimal: distributionResult.totalAllocatedDecimal,
      remainingDecimal: distributionResult.remainingDecimal,
      isBalanced: distributionResult.isBalanced ? 'yes' : 'no',
    };

    distributionResult.owners.forEach((o, i) => {
      details[`owner_${i + 1}`] = `${o.name}: ${o.allocatedDecimal} dec (${o.allocatedPercent}%) - ${o.allottedSide || 'চৌহদ্দি অনির্ধারিত'}`;
    });

    saveCalculationToHistory({
      shape: 'polygon',
      unit: 'feet',
      areaSqFt: distributionResult.totalSqFt,
      areaSqMeter: roundClean(distributionResult.totalSqFt / 10.7639, 2),
      shatangsha: distributionResult.totalDecimal,
      katha: distributionResult.totalKatha,
      bigha: distributionResult.totalBigha,
      acre: distributionResult.totalAcre,
      inputDescription: desc,
      shapeNameBn: 'উন্নত তফসিল বণ্টন',
      shapeNameEn: 'Advanced Tafsil Distribution',
      details,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div id="advanced-tafsil-distribution-root" className="space-y-4">
      {/* Professional Service Disclaimer & Legal Assurance */}
      <ProfessionalServiceDisclaimer lang={lang} variant="full" />

      {/* Main Mode & View Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        {/* Proportional vs Manual Distribution Mode */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 shrink-0">
            {isBn ? 'বণ্টন পদ্ধতি:' : 'Mode:'}
          </span>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setDistributionMode('proportional')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                distributionMode === 'proportional'
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isBn ? 'স্বয়ংক্রিয় আনুপাতিক' : 'Proportional'}</span>
            </button>
            <button
              onClick={() => setDistributionMode('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                distributionMode === 'manual'
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{isBn ? 'ম্যানুয়াল সমন্বয়' : 'Manual Adjustment'}</span>
            </button>
          </div>
        </div>

        {/* Edit View vs A4 Report Draft Toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 shrink-0">
            {isBn ? 'দৃশ্যপট:' : 'View:'}
          </span>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === 'edit'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isBn ? 'সম্পাদনা মোড' : 'Edit Mode'}</span>
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === 'report'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isBn ? 'A4 ড্রাফট রিপোর্ট ভিউ' : 'A4 Report Preview'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* EDIT MODE CONTENT */}
      {viewMode === 'edit' && (
        <div className="space-y-4">
          {/* Tafsil & Plot Information Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-4 h-4 text-emerald-800" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isBn ? 'তফসিল ও জমির আইনগত বিবরণী' : 'Tafsil & Statutory Land Details'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isBn
                    ? 'জেলা, উপজেলা, ইউনিয়ন, মৌজা, জে.এল., খতিয়ান, দাগ নং ও জমির শ্রেণি পূরণ করুন'
                    : 'Enter District, Upazila, Union, Mouza, J.L., Khatian, Dag and land classification'}
                </p>
              </div>
            </div>

            {/* Total Land Input Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {isBn ? 'মোট জমির পরিমাণ' : 'Total Land Amount'}
                </label>
                <input
                  id="tafsil-total-land-input"
                  type="number"
                  min="0"
                  step="any"
                  value={totalLandInput}
                  onChange={(e) => setTotalLandInput(e.target.value)}
                  placeholder="50"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {isBn ? 'জমির পরিমাপের একক' : 'Area Unit'}
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
            </div>

            {/* Total Land Summary Units (Decimal, Katha, Bigha, Acre, Sq Ft) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট শতাংশ/শতক' : 'Total Decimal'}</span>
                <span className="text-sm font-black text-emerald-950">
                  {formatNumberByLang(distributionResult.totalDecimal, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট কাঠা' : 'Total Katha'}</span>
                <span className="text-sm font-black text-blue-900">
                  {formatNumberByLang(distributionResult.totalKatha, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট বিঘা' : 'Total Bigha'}</span>
                <span className="text-sm font-black text-amber-900">
                  {formatNumberByLang(distributionResult.totalBigha, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট একর' : 'Total Acre'}</span>
                <span className="text-sm font-black text-purple-900">
                  {formatNumberByLang(distributionResult.totalAcre, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট বর্গফুট' : 'Total Sq Ft'}</span>
                <span className="text-sm font-black text-slate-800">
                  {formatNumberByLang(distributionResult.totalSqFt, lang)}
                </span>
              </div>
            </div>

            {/* Standard Bangladeshi Tafsil Registry Fields */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-800" />
                  <span>{isBn ? 'তফসিল বিবরণ (দাগ, খতিয়ান ও অবস্থান):' : 'Tafsil Coordinates & Record Identifiers:'}</span>
                </span>
                <span className="text-[10px] text-emerald-800 font-semibold">
                  {isBn ? 'স্বয়ংক্রিয় ক্যাসকেড' : 'Auto Cascade'}
                </span>
              </div>

              {/* Automated Cascading Location Selector */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <BangladeshLocationSelector
                  value={{
                    districtNameBn: metadata.district,
                    upazilaNameBn: metadata.upazila,
                    mouzaNameBn: metadata.mouza,
                    jlNo: metadata.jlNo,
                  }}
                  onChange={(val) => {
                    setMetadata((prev) => ({
                      ...prev,
                      district: val.districtNameBn || '',
                      upazila: val.upazilaNameBn || '',
                      mouza: val.mouzaNameBn || '',
                      jlNo: val.jlNo || '',
                    }));
                  }}
                  lang={lang}
                  showJlInput={true}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isBn ? 'ইউনিয়ন / পৌরসভা' : 'Union / Municipality'}
                  </label>
                  <input
                    type="text"
                    value={metadata.union}
                    onChange={(e) => handleUpdateMetadata('union', e.target.value)}
                    placeholder={isBn ? 'উদা: বাড্ডা' : 'e.g. Badda'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isBn ? 'খতিয়ান নং (Khatian)' : 'Khatian No.'}
                  </label>
                  <input
                    type="text"
                    value={metadata.khatianNo}
                    onChange={(e) => handleUpdateMetadata('khatianNo', e.target.value)}
                    placeholder={isBn ? 'সিএস/এসএ/আরএস/বিএস' : 'CS/SA/RS/BS'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isBn ? 'দাগ নং (Dag / Plot)' : 'Dag / Plot No.'}
                  </label>
                  <input
                    type="text"
                    value={metadata.dagNo}
                    onChange={(e) => handleUpdateMetadata('dagNo', e.target.value)}
                    placeholder={isBn ? 'দাগ নং উদা: ১০৮' : 'Plot e.g. 108'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isBn ? 'জমির শ্রেণি (Class)' : 'Land Class'}
                  </label>
                  <input
                    type="text"
                    value={metadata.landClass}
                    onChange={(e) => handleUpdateMetadata('landClass', e.target.value)}
                    placeholder={isBn ? 'নাল, ভিটি, বাগান' : 'Nal, Viti, Bagan'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              {/* General Tafsil Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {isBn ? 'সাধারণ চৌহদ্দি বিবরণ ও বিশেষ শর্ত (ঐচ্ছিক):' : 'Boundary Boundaries & General Remarks (Optional):'}
                </label>
                <textarea
                  rows={2}
                  value={metadata.generalNotes}
                  onChange={(e) => handleUpdateMetadata('generalNotes', e.target.value)}
                  placeholder={
                    isBn
                      ? 'উদা: উত্তরে সরকারি রাস্তা, দক্ষিণে খাল, পূর্বে হাজী আব্দুর রাজ্জাকের জমি, পশ্চিমে ওয়াকফ সম্পত্তি।'
                      : 'e.g. North bounded by public road, South by canal, East by Haji Abdur Razzak land.'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>
          </div>

          {/* Owners Distribution Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-800" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {isBn ? 'অংশীদার ও জমি ভাগ-বণ্টন তালিকা' : 'Owners & Partition Breakdown'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {distributionMode === 'proportional'
                      ? isBn
                        ? 'আনুপাতিক মোড: কাঙ্ক্ষিত শতাংশ বা ভগ্নাংশ অনুযায়ী স্বয়ংক্রিয় জমি হিসাব'
                        : 'Proportional Mode: Auto-calculates area from requested share'
                      : isBn
                      ? 'ম্যানুয়াল সমন্বয় মোড: সরাসরি শতক ইনপুট দিন, কাঙ্ক্ষিত বনাম বণ্টিত ব্যবধান দেখুন'
                      : 'Manual Mode: Directly input decimals with variance tracking'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {distributionMode === 'proportional' && distributionResult.excessPercent > 0 && (
                  <button
                    onClick={handleAutoBalance}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition active:scale-95"
                  >
                    {isBn ? '১০০% স্বয়ংক্রিয় সমন্বয়' : 'Auto Balance'}
                  </button>
                )}

                <button
                  id="tafsil-add-owner-btn"
                  onClick={handleAddOwner}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition active:scale-95 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'অংশীদার যোগ করুন' : 'Add Owner'}</span>
                </button>
              </div>
            </div>

            {/* Over-allocation Alert */}
            {distributionResult.isExceeded && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm">
                    {isBn ? 'সতর্কতা: মোট বণ্টন জমির পরিমাণ ছাড়িয়ে গেছে!' : 'Warning: Total allocation exceeds land area!'}
                  </span>
                  <p className="text-xs text-red-700 mt-0.5">
                    {isBn
                      ? `মোট বণ্টিত জমি: ${formatNumberByLang(distributionResult.totalAllocatedDecimal, lang)} শতক (${formatNumberByLang(roundClean(distributionResult.totalAllocatedPercent, 2), lang)}%) | অতিরিক্ত: +${formatNumberByLang(distributionResult.excessDecimal, lang)} শতক (+${formatNumberByLang(distributionResult.excessPercent, lang)}%)`
                      : `Allocated: ${distributionResult.totalAllocatedDecimal} Dec | Exceeded by: +${distributionResult.excessDecimal} Dec (+${distributionResult.excessPercent}%)`}
                  </p>
                </div>
              </div>
            )}

            {/* Owner Rows */}
            <div className="space-y-3.5">
              {distributionResult.owners.map((owner, idx) => {
                const rawOwner = owners.find((o) => o.id === owner.id);

                return (
                  <div
                    key={owner.id}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3 transition hover:border-emerald-300"
                  >
                    {/* Top line: Index, Name, Father's Name, Delete */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {formatNumberByLang(idx + 1, lang)}
                        </span>
                        <input
                          type="text"
                          value={rawOwner?.name || owner.name}
                          onChange={(e) => handleUpdateOwner(owner.id, { name: e.target.value })}
                          placeholder={isBn ? 'অংশীদার / ওয়ারিশের নাম' : 'Owner / Heir Name'}
                          className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                        <input
                          type="text"
                          value={rawOwner?.relationOrFather || ''}
                          onChange={(e) => handleUpdateOwner(owner.id, { relationOrFather: e.target.value })}
                          placeholder={isBn ? 'পিতা/স্বামীর নাম (ঐচ্ছিক)' : 'Father/Husband Name (Optional)'}
                          className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                      </div>

                      {owners.length > 1 && (
                        <button
                          onClick={() => handleRemoveOwner(owner.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition self-end sm:self-center"
                          title={isBn ? 'মুছুন' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Share Configuration & Manual Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200">
                      {/* Share Type Selector */}
                      <div className="sm:col-span-4 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          {isBn ? 'কাঙ্ক্ষিত হিস্যা:' : 'Requested Share:'}
                        </span>

                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleUpdateOwner(owner.id, { shareType: 'percent' })}
                            className={`px-2 py-0.5 rounded-md transition ${
                              rawOwner?.shareType === 'percent'
                                ? 'bg-white text-emerald-950 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateOwner(owner.id, { shareType: 'fraction' })}
                            className={`px-2 py-0.5 rounded-md transition ${
                              rawOwner?.shareType === 'fraction'
                                ? 'bg-white text-emerald-950 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            a/b
                          </button>
                        </div>

                        {/* Input based on Share Type */}
                        {rawOwner?.shareType === 'percent' ? (
                          <div className="relative w-24">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={rawOwner?.requestedPercent || ''}
                              onChange={(e) =>
                                handleUpdateOwner(owner.id, { requestedPercent: e.target.value })
                              }
                              placeholder="0"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-black text-slate-900 text-right pr-5"
                            />
                            <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 top-2" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={rawOwner?.numeratorStr || '1'}
                              onChange={(e) =>
                                handleUpdateOwner(owner.id, { numeratorStr: e.target.value })
                              }
                              placeholder="1"
                              className="w-10 px-1 py-1 rounded border border-slate-300 text-xs font-black text-center"
                            />
                            <span className="font-bold text-slate-400">/</span>
                            <input
                              type="number"
                              min="1"
                              value={rawOwner?.denominatorStr || '4'}
                              onChange={(e) =>
                                handleUpdateOwner(owner.id, { denominatorStr: e.target.value })
                              }
                              placeholder="4"
                              className="w-10 px-1 py-1 rounded border border-slate-300 text-xs font-black text-center"
                            />
                          </div>
                        )}
                      </div>

                      {/* In Manual Mode: Manual Decimal Input */}
                      {distributionMode === 'manual' && (
                        <div className="sm:col-span-3 flex items-center gap-1.5 bg-amber-50/70 p-1.5 rounded-lg border border-amber-200">
                          <span className="text-[11px] font-bold text-amber-950 shrink-0">
                            {isBn ? 'সরাসরি শতক:' : 'Direct Dec:'}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={rawOwner?.manualDecimalStr || ''}
                            onChange={(e) =>
                              handleUpdateOwner(owner.id, { manualDecimalStr: e.target.value })
                            }
                            placeholder="0"
                            className="w-full px-2 py-1 rounded bg-white border border-amber-300 text-xs font-black text-slate-900 text-right"
                          />
                        </div>
                      )}

                      {/* Allotted Side / Boundary Input */}
                      <div className={distributionMode === 'manual' ? 'sm:col-span-5' : 'sm:col-span-8'}>
                        <input
                          type="text"
                          value={rawOwner?.allottedSide || ''}
                          onChange={(e) =>
                            handleUpdateOwner(owner.id, { allottedSide: e.target.value })
                          }
                          placeholder={
                            isBn
                              ? 'নির্ধারিত দিক/চৌহদ্দি (উদা: উত্তর পার্শ্ব, রাস্তা সংলগ্ন)'
                              : 'Allocated side/border (e.g. North side, road facing)'
                          }
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Calculated Land Area Breakdown (Decimal, Katha, Bigha, Acre, Sq Ft) */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-center text-xs pt-1 border-t border-slate-200/60">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {isBn ? 'বণ্টিত অংশ' : 'Share'}
                        </span>
                        <span className="font-bold text-emerald-900">
                          {formatNumberByLang(owner.allocatedPercent, lang)}%
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {isBn ? 'শতাংশ / শতক' : 'Decimal'}
                        </span>
                        <span className="font-black text-slate-900">
                          {formatNumberByLang(owner.allocatedDecimal, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {isBn ? 'কাঠা' : 'Katha'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatNumberByLang(owner.allocatedKatha, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {isBn ? 'বিঘা' : 'Bigha'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatNumberByLang(owner.allocatedBigha, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {isBn ? 'একর' : 'Acre'}
                        </span>
                        <span className="font-bold text-purple-900">
                          {formatNumberByLang(owner.allocatedAcre, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {isBn ? 'বর্গফুট' : 'Sq Ft'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatNumberByLang(owner.allocatedSqFt, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Comparison note in Manual mode if there is variance */}
                    {owner.hasVariance && (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                        <span>
                          {isBn ? 'কাঙ্ক্ষিত হিস্যা:' : 'Requested:'} {owner.requestedFractionStr} ({formatNumberByLang(owner.requestedDecimal, lang)} শতক)
                        </span>
                        <span className="font-bold">
                          {isBn ? 'ব্যবধান:' : 'Variance:'} {owner.varianceDecimal > 0 ? '+' : ''}{formatNumberByLang(owner.varianceDecimal, lang)} শতক ({owner.variancePercent > 0 ? '+' : ''}{formatNumberByLang(owner.variancePercent, lang)}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total Allocated Progress & Balance status */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">
                  {isBn ? 'মোট বণ্টিত জমি:' : 'Total Allocated:'}{' '}
                  {formatNumberByLang(distributionResult.totalAllocatedDecimal, lang)} {isBn ? 'শতক' : 'Dec'} (
                  {formatNumberByLang(roundClean(distributionResult.totalAllocatedPercent, 2), lang)}%)
                </span>
                <span
                  className={
                    distributionResult.isExceeded
                      ? 'text-red-600 font-black'
                      : distributionResult.isBalanced
                      ? 'text-emerald-700 font-black'
                      : 'text-amber-600 font-semibold'
                  }
                >
                  {distributionResult.isExceeded
                    ? isBn
                      ? 'অতিরিক্ত বণ্টন!'
                      : 'Over-allocated!'
                    : distributionResult.isBalanced
                    ? isBn
                      ? '১০০% সম্পূর্ণ বণ্টন'
                      : '100% Fully Distributed'
                    : isBn
                    ? `বাকি: ${formatNumberByLang(distributionResult.remainingDecimal, lang)} শতক (${formatNumberByLang(distributionResult.remainingPercent, lang)}%)`
                    : `Remaining: ${distributionResult.remainingDecimal} Dec (${distributionResult.remainingPercent}%)`}
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    distributionResult.isExceeded
                      ? 'bg-red-500'
                      : distributionResult.isBalanced
                      ? 'bg-emerald-600'
                      : 'bg-emerald-800'
                  }`}
                  style={{ width: `${Math.min(100, distributionResult.totalAllocatedPercent)}%` }}
                />
              </div>
            </div>

            {/* Remaining Balance Details Card */}
            {distributionResult.remainingDecimal > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-amber-950 block">
                    {isBn ? 'অবশিষ্ট অবণ্টিত জমি:' : 'Remaining Unallocated Land:'}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-amber-900">
                    <span>{formatNumberByLang(distributionResult.remainingDecimal, lang)} {isBn ? 'শতক' : 'Dec'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(distributionResult.remainingKatha, lang)} {isBn ? 'কাঠা' : 'Katha'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(distributionResult.remainingBigha, lang)} {isBn ? 'বিঘা' : 'Bigha'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(distributionResult.remainingAcre, lang)} {isBn ? 'একর' : 'Acre'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(distributionResult.remainingSqFt, lang)} {isBn ? 'বর্গফুট' : 'sq ft'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddRemainderOwner}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition active:scale-95 shrink-0 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'অবশিষ্ট দিয়ে নতুন অংশীদার যোগ' : 'Add Remainder Owner'}</span>
                </button>
              </div>
            )}

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
                      <span>{isBn ? 'অনুলিপি কপি করুন' : 'Copy Summary'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSaveToHistory}
                  disabled={distributionResult.totalSqFt <= 0 || distributionResult.isExceeded}
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
      )}

      {/* A4 PRINTABLE REPORT VIEW */}
      {viewMode === 'report' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-800" />
              <span>{isBn ? 'A4 প্রফেশনাল রিপোর্ট / ড্রাফট ভিউ' : 'A4 Report / Draft Preview'}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={printWithNoto}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900 text-white text-xs font-bold hover:bg-emerald-950 transition active:scale-95 shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isBn ? 'প্রিন্ট / PDF করুন' : 'Print / Save PDF'}</span>
              </button>
              <button
                onClick={() => setViewMode('edit')}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                {isBn ? 'সম্পাদনায় ফিরুন' : 'Back to Edit'}
              </button>
            </div>
          </div>

          {/* Clean A4 Printable Sheet Container */}
          <div className="p-6 sm:p-10 rounded-2xl bg-white border border-slate-300 shadow-sm max-w-4xl mx-auto space-y-6 text-slate-900 font-sans print:shadow-none print:border-none print:p-0">
            {/* Document Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                {isBn ? 'ডিজিটাল ভূমি জরিপ ও খসড়া বণ্টননামা' : 'Digital Land Survey & Partition Draft'}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
                {isBn ? 'যৌথ জমি ভাগ-বণ্টন ও তফসিল খসড়া পত্র' : 'Land Partition & Tafsil Schedule Draft'}
              </h2>
              <div className="inline-block px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider mt-1">
                {isBn ? 'ডিজিটাল খসড়া ও হিসাব — আইনগত দলিল নয়' : 'Digital Draft / Calculation — Not a Legal Deed'}
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                {isBn ? 'প্রস্তুতের তারিখ:' : 'Prepared on:'} {reportA4.generatedAt}
              </p>
            </div>

            {/* Tafsil Details Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                {isBn ? '১. জমির তফসিল বিবরণী (Property Description)' : '1. Property Tafsil Details'}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'জেলা' : 'District'}</span>
                  <span className="font-bold text-slate-900">{metadata.district || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'উপজেলা / থানা' : 'Upazila'}</span>
                  <span className="font-bold text-slate-900">{metadata.upazila || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'ইউনিয়ন' : 'Union'}</span>
                  <span className="font-bold text-slate-900">{metadata.union || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'মৌজা' : 'Mouza'}</span>
                  <span className="font-bold text-slate-900">{metadata.mouza || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'জে.এল. নং' : 'J.L. No.'}</span>
                  <span className="font-bold text-slate-900">{metadata.jlNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'খতিয়ান নং' : 'Khatian No.'}</span>
                  <span className="font-bold text-slate-900">{metadata.khatianNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'দাগ নং' : 'Dag No.'}</span>
                  <span className="font-bold text-slate-900">{metadata.dagNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'জমির শ্রেণি' : 'Land Class'}</span>
                  <span className="font-bold text-slate-900">{metadata.landClass || '—'}</span>
                </div>
              </div>

              {/* Total Land Metrics */}
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-emerald-950">
                  {isBn ? 'মোট ভূমির পরিমাণ:' : 'Total Land Area:'}{' '}
                  {formatNumberByLang(distributionResult.totalDecimal, lang)} {isBn ? 'শতক / শতাংশ' : 'Decimals'}
                </span>
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-[11px]">
                  <span>{formatNumberByLang(distributionResult.totalKatha, lang)} {isBn ? 'কাঠা' : 'Katha'}</span>
                  <span>•</span>
                  <span>{formatNumberByLang(distributionResult.totalBigha, lang)} {isBn ? 'বিঘা' : 'Bigha'}</span>
                  <span>•</span>
                  <span>{formatNumberByLang(distributionResult.totalAcre, lang)} {isBn ? 'একর' : 'Acre'}</span>
                  <span>•</span>
                  <span>{formatNumberByLang(distributionResult.totalSqFt, lang)} {isBn ? 'বর্গফুট' : 'sq ft'}</span>
                </div>
              </div>
            </div>

            {/* Partition Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                {isBn ? '২. অংশীদারগণের মধ্যে জমি ভাগ-বণ্টন বিবরণী' : '2. Land Allocation Schedule'}
              </h4>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2 border-r border-slate-200 text-center w-8">#</th>
                      <th className="p-2 border-r border-slate-200">{isBn ? 'অংশীদারের নাম ও বিবরণ' : 'Owner / Heir Details'}</th>
                      <th className="p-2 border-r border-slate-200 text-center">{isBn ? 'নির্ধারিত হিস্যা' : 'Share (%)'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'শতাংশ (শতক)' : 'Decimal'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'কাঠা' : 'Katha'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'বর্গফুট' : 'Sq Ft'}</th>
                      <th className="p-2">{isBn ? 'নির্ধারিত দিক / চৌহদ্দি' : 'Allotted Boundary'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {distributionResult.owners.map((o, idx) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="p-2 border-r border-slate-200 text-center font-bold">{formatNumberByLang(idx + 1, lang)}</td>
                        <td className="p-2 border-r border-slate-200">
                          <span className="font-bold text-slate-900 block">{o.name}</span>
                          {o.relationOrFather && <span className="text-[10px] text-slate-500 block">{o.relationOrFather}</span>}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold text-emerald-900">
                          {formatNumberByLang(o.allocatedPercent, lang)}%
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-black text-slate-950">
                          {formatNumberByLang(o.allocatedDecimal, lang)}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-semibold text-slate-800">
                          {formatNumberByLang(o.allocatedKatha, lang)}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right text-slate-700">
                          {formatNumberByLang(o.allocatedSqFt, lang)}
                        </td>
                        <td className="p-2 text-slate-800">
                          {o.allottedSide || (isBn ? 'চৌহদ্দি সমভাবে বণ্টিত' : 'Equally distributed')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={2} className="p-2 border-r border-slate-200 text-right font-black">
                        {isBn ? 'মোট বণ্টিত জমি:' : 'Total Allocated:'}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-black text-emerald-900">
                        {formatNumberByLang(roundClean(distributionResult.totalAllocatedPercent, 2), lang)}%
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-black text-slate-950">
                        {formatNumberByLang(distributionResult.totalAllocatedDecimal, lang)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right">
                        {formatNumberByLang(distributionResult.owners.reduce((s, o) => s + o.allocatedKatha, 0), lang)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right">
                        {formatNumberByLang(distributionResult.totalAllocatedSqFt, lang)}
                      </td>
                      <td className="p-2 text-[11px] font-medium text-slate-500">
                        {distributionResult.isBalanced
                          ? isBn ? '১০০% সম্পূর্ণ বণ্টন' : '100% Fully Distributed'
                          : isBn ? `অবশিষ্ট: ${formatNumberByLang(distributionResult.remainingDecimal, lang)} শতক` : `Remaining: ${distributionResult.remainingDecimal} Dec`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* General Remarks */}
            {metadata.generalNotes && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block mb-0.5">{isBn ? 'চৌহদ্দি ও বিশেষ বিবরণ:' : 'Remarks:'}</span>
                <p className="text-slate-700 leading-relaxed">{metadata.generalNotes}</p>
              </div>
            )}

            {/* Signatures Slot */}
            <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
              <div className="space-y-1">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <span className="font-bold text-slate-800 block">{isBn ? 'পক্ষগণের স্বাক্ষর' : 'Parties Signature'}</span>
                <span className="text-[10px] text-slate-400">{isBn ? '(অংশীদার / ওয়ারিশগণ)' : '(Owners / Heirs)'}</span>
              </div>
              <div className="space-y-1">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <span className="font-bold text-slate-800 block">{isBn ? 'সাক্ষীগণের স্বাক্ষর' : 'Witness Signature'}</span>
                <span className="text-[10px] text-slate-400">{isBn ? '(স্থানীয় গণ্যমান্য ব্যক্তি)' : '(Local Witnesses)'}</span>
              </div>
              <div className="space-y-1">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <span className="font-bold text-slate-800 block">{isBn ? 'পরিমাপকারী আমিনের স্বাক্ষর' : 'Surveyor Signature'}</span>
                <span className="text-[10px] text-slate-400">{isBn ? 'তারিখ ও সিলমোহর' : 'Date & Seal'}</span>
              </div>
            </div>

            {/* Statutory Disclaimer in Report */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 leading-relaxed">
              <strong>{isBn ? 'আইনগত সংবিধি:' : 'Legal Notice:'}</strong>{' '}
              {reportA4.disclaimerBn}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
