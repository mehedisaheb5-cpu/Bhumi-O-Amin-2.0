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
  calculateHisshaDistribution,
  HisshaOwnerInput,
  HisshaShareMode,
} from '../../lib/hissha-calculations';
import {
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  BookmarkPlus,
  AlertTriangle,
  RotateCcw,
  Percent,
  PieChart,
  Split,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface HisshaCalculatorProps {
  lang: 'bn' | 'en';
}

export const HisshaCalculator: React.FC<HisshaCalculatorProps> = ({ lang }) => {
  const isBn = lang === 'bn';

  // Total Land
  const [totalLandInput, setTotalLandInput] = useState<string>('100');
  const [areaUnit, setAreaUnit] = useState<LandAreaUnit>('decimal');

  // Multiple Owners
  const [owners, setOwners] = useState<HisshaOwnerInput[]>([
    {
      id: '1',
      name: isBn ? 'অংশীদার ১' : 'Owner 1',
      shareMode: 'percent',
      percentStr: '50',
      numeratorStr: '1',
      denominatorStr: '2',
      anaStr: '8',
      gondaStr: '0',
      koraStr: '0',
      krantiStr: '0',
      tilStr: '0',
    },
    {
      id: '2',
      name: isBn ? 'অংশীদার ২' : 'Owner 2',
      shareMode: 'percent',
      percentStr: '50',
      numeratorStr: '1',
      denominatorStr: '2',
      anaStr: '8',
      gondaStr: '0',
      koraStr: '0',
      krantiStr: '0',
      tilStr: '0',
    },
  ]);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Safe numerical calculations
  const totalLandNum = Math.max(0, parseFloat(totalLandInput) || 0);

  // Calculation data via modular engine
  const calculationData = useMemo(() => {
    return calculateHisshaDistribution(totalLandNum, areaUnit, owners, lang);
  }, [totalLandNum, areaUnit, owners, lang]);

  // Handler: Add Owner with auto-suggested remaining share
  const handleAddOwner = (defaultSharePercent?: number) => {
    const nextNum = owners.length + 1;
    const defaultName = isBn ? `অংশীদার ${nextNum}` : `Owner ${nextNum}`;
    const suggestedPct =
      defaultSharePercent !== undefined
        ? defaultSharePercent
        : calculationData.remainingPercent > 0
        ? calculationData.remainingPercent
        : 0;

    const newOwner: HisshaOwnerInput = {
      id: Date.now().toString(),
      name: defaultName,
      shareMode: 'percent',
      percentStr: suggestedPct > 0 ? String(roundClean(suggestedPct, 3)) : '0',
      numeratorStr: '1',
      denominatorStr: '4',
      anaStr: '4',
      gondaStr: '0',
      koraStr: '0',
      krantiStr: '0',
      tilStr: '0',
    };

    setOwners([...owners, newOwner]);
  };

  // Handler: Remove Owner
  const handleRemoveOwner = (id: string) => {
    if (owners.length <= 1) return;
    setOwners(owners.filter((o) => o.id !== id));
  };

  // Handler: Update Owner string fields
  const handleUpdateOwnerField = (
    id: string,
    field: keyof HisshaOwnerInput,
    val: string | HisshaShareMode
  ) => {
    setOwners((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return { ...o, [field]: val };
      })
    );
  };

  // Presets
  const handleApplyPreset = (type: 'equal2' | 'equal3' | 'equal4' | 'traditional16' | 'ratio12') => {
    if (type === 'equal2') {
      setOwners([
        {
          id: '1',
          name: isBn ? 'অংশীদার ১' : 'Owner 1',
          shareMode: 'percent',
          percentStr: '50',
          numeratorStr: '1',
          denominatorStr: '2',
          anaStr: '8',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
        {
          id: '2',
          name: isBn ? 'অংশীদার ২' : 'Owner 2',
          shareMode: 'percent',
          percentStr: '50',
          numeratorStr: '1',
          denominatorStr: '2',
          anaStr: '8',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
      ]);
    } else if (type === 'equal3') {
      setOwners([
        {
          id: '1',
          name: isBn ? 'অংশীদার ১' : 'Owner 1',
          shareMode: 'fraction',
          percentStr: '33.333',
          numeratorStr: '1',
          denominatorStr: '3',
          anaStr: '5',
          gondaStr: '6',
          koraStr: '2',
          krantiStr: '2',
          tilStr: '0',
        },
        {
          id: '2',
          name: isBn ? 'অংশীদার ২' : 'Owner 2',
          shareMode: 'fraction',
          percentStr: '33.333',
          numeratorStr: '1',
          denominatorStr: '3',
          anaStr: '5',
          gondaStr: '6',
          koraStr: '2',
          krantiStr: '2',
          tilStr: '0',
        },
        {
          id: '3',
          name: isBn ? 'অংশীদার ৩' : 'Owner 3',
          shareMode: 'fraction',
          percentStr: '33.334',
          numeratorStr: '1',
          denominatorStr: '3',
          anaStr: '5',
          gondaStr: '6',
          koraStr: '2',
          krantiStr: '2',
          tilStr: '0',
        },
      ]);
    } else if (type === 'equal4') {
      setOwners([
        {
          id: '1',
          name: isBn ? 'অংশীদার ১' : 'Owner 1',
          shareMode: 'percent',
          percentStr: '25',
          numeratorStr: '1',
          denominatorStr: '4',
          anaStr: '4',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
        {
          id: '2',
          name: isBn ? 'অংশীদার ২' : 'Owner 2',
          shareMode: 'percent',
          percentStr: '25',
          numeratorStr: '1',
          denominatorStr: '4',
          anaStr: '4',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
        {
          id: '3',
          name: isBn ? 'অংশীদার ৩' : 'Owner 3',
          shareMode: 'percent',
          percentStr: '25',
          numeratorStr: '1',
          denominatorStr: '4',
          anaStr: '4',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
        {
          id: '4',
          name: isBn ? 'অংশীদার ৪' : 'Owner 4',
          shareMode: 'percent',
          percentStr: '25',
          numeratorStr: '1',
          denominatorStr: '4',
          anaStr: '4',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
      ]);
    } else if (type === 'traditional16') {
      setOwners([
        {
          id: '1',
          name: isBn ? '১ম হিস্যা (৮ আনা)' : '1st Share (8 Ana)',
          shareMode: 'traditional',
          percentStr: '50',
          numeratorStr: '1',
          denominatorStr: '2',
          anaStr: '8',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
        {
          id: '2',
          name: isBn ? '২য় হিস্যা (৪ আনা)' : '2nd Share (4 Ana)',
          shareMode: 'traditional',
          percentStr: '25',
          numeratorStr: '1',
          denominatorStr: '4',
          anaStr: '4',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
        {
          id: '3',
          name: isBn ? '৩য় হিস্যা (৪ আনা)' : '3rd Share (4 Ana)',
          shareMode: 'traditional',
          percentStr: '25',
          numeratorStr: '1',
          denominatorStr: '4',
          anaStr: '4',
          gondaStr: '0',
          koraStr: '0',
          krantiStr: '0',
          tilStr: '0',
        },
      ]);
    } else if (type === 'ratio12') {
      setOwners([
        {
          id: '1',
          name: isBn ? 'অংশীদার ১ (১/৩)' : 'Owner 1 (1/3)',
          shareMode: 'fraction',
          percentStr: '33.33',
          numeratorStr: '1',
          denominatorStr: '3',
          anaStr: '5',
          gondaStr: '6',
          koraStr: '2',
          krantiStr: '2',
          tilStr: '0',
        },
        {
          id: '2',
          name: isBn ? 'অংশীদার ২ (২/৩)' : 'Owner 2 (2/3)',
          shareMode: 'fraction',
          percentStr: '66.67',
          numeratorStr: '2',
          denominatorStr: '3',
          anaStr: '10',
          gondaStr: '13',
          koraStr: '1',
          krantiStr: '1',
          tilStr: '0',
        },
      ]);
    }
  };

  // Reset
  const handleReset = () => {
    setTotalLandInput('100');
    setAreaUnit('decimal');
    setOwners([
      {
        id: '1',
        name: isBn ? 'অংশীদার ১' : 'Owner 1',
        shareMode: 'percent',
        percentStr: '50',
        numeratorStr: '1',
        denominatorStr: '2',
        anaStr: '8',
        gondaStr: '0',
        koraStr: '0',
        krantiStr: '0',
        tilStr: '0',
      },
      {
        id: '2',
        name: isBn ? 'অংশীদার ২' : 'Owner 2',
        shareMode: 'percent',
        percentStr: '50',
        numeratorStr: '1',
        denominatorStr: '2',
        anaStr: '8',
        gondaStr: '0',
        koraStr: '0',
        krantiStr: '0',
        tilStr: '0',
      },
    ]);
  };

  // Copy Summary
  const handleCopySummary = () => {
    const unitLabel = getAreaUnitLabel(areaUnit, lang);
    let text = isBn
      ? `ভূমি ও আমিন — আধুনিক হিস্যা বণ্টন প্রতিবেদন\nমোট জমি: ${formatNumberByLang(totalLandNum, lang)} ${unitLabel} (${formatNumberByLang(calculationData.totalDecimal, lang)} শতক / ${formatNumberByLang(calculationData.totalSqFt, lang)} বর্গফুট)\n\n`
      : `Bhumi O Amin — Advanced Hissha Land Distribution\nTotal Land: ${totalLandNum} ${unitLabel} (${calculationData.totalDecimal} Decimals / ${calculationData.totalSqFt} sq ft)\n\n`;

    calculationData.owners.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name} [অংশ: ${item.shareDescription}]:\n`;
      text += `   - শতাংশ/শতক: ${formatNumberByLang(item.decimal, lang)} শতক\n`;
      text += `   - কাঠা: ${formatNumberByLang(item.katha, lang)} কাঠা\n`;
      text += `   - বিঘা: ${formatNumberByLang(item.bigha, lang)} বিঘা\n`;
      text += `   - একর: ${formatNumberByLang(item.acre, lang)} একর\n`;
      text += `   - বর্গফুট: ${formatNumberByLang(item.sqFt, lang)} বর্গফুট\n\n`;
    });

    if (calculationData.remainingPercent > 0) {
      text += isBn
        ? `অবশিষ্ট অবণ্টিত জমি (${formatNumberByLang(calculationData.remainingPercent, lang)}%):\n   - ${formatNumberByLang(calculationData.remainingDecimal, lang)} শতক | ${formatNumberByLang(calculationData.remainingKatha, lang)} কাঠা | ${formatNumberByLang(calculationData.remainingBigha, lang)} বিঘা | ${formatNumberByLang(calculationData.remainingAcre, lang)} একর (${formatNumberByLang(calculationData.remainingSqFt, lang)} বর্গফুট)\n`
        : `Remaining Undistributed (${calculationData.remainingPercent}%):\n   - ${calculationData.remainingDecimal} Dec | ${calculationData.remainingKatha} Katha | ${calculationData.remainingBigha} Bigha | ${calculationData.remainingAcre} Acre (${calculationData.remainingSqFt} sq ft)\n`;
    }

    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save to History (localStorage)
  const handleSaveToHistory = () => {
    const unitLabel = getAreaUnitLabel(areaUnit, lang);
    const desc = isBn
      ? `হিস্যা বণ্টন: মোট ${formatNumberByLang(totalLandNum, lang)} ${unitLabel} (${formatNumberByLang(calculationData.totalDecimal, lang)} শতক), অংশীদার: ${formatNumberByLang(owners.length, lang)} জন`
      : `Hissha Distribution: Total ${totalLandNum} ${unitLabel} (${calculationData.totalDecimal} Dec), ${owners.length} owners`;

    const details: Record<string, string | number> = {
      totalLand: totalLandNum,
      unit: areaUnit,
      allocatedPercent: calculationData.allocatedPercent,
      remainingPercent: calculationData.remainingPercent,
      ownerCount: owners.length,
    };

    calculationData.owners.forEach((o, i) => {
      details[`owner_${i + 1}`] = `${o.name} (${o.shareDescription}): ${o.decimal} dec / ${o.katha} katha / ${o.acre} acre`;
    });

    saveCalculationToHistory({
      shape: 'polygon',
      unit: 'feet',
      areaSqFt: calculationData.totalSqFt,
      areaSqMeter: roundClean(calculationData.totalSqFt / 10.7639, 2),
      shatangsha: calculationData.totalDecimal,
      katha: calculationData.totalKatha,
      bigha: calculationData.totalBigha,
      acre: calculationData.totalAcre,
      inputDescription: desc,
      shapeNameBn: 'উন্নত হিস্যা বণ্টন',
      shapeNameEn: 'Advanced Hissha Share',
      details,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div id="advanced-hissha-calculator-root" className="space-y-4">
      {/* Header Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-800" />
              <span>{isBn ? 'উন্নত হিস্যা বণ্টন ক্যালকুলেটর' : 'Advanced Hissha Calculator'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn
                ? 'মোট জমি থেকে শতকরা (%), সাধারণ ভগ্নাংশ বা ঐতিহ্যবাহী ১৬ আনা হিসেবে একাধিক অংশীদারের শতক, বর্গফুট, কাঠা, বিঘা ও একর হিসাব'
                : 'Calculate owner shares via percent, fraction, or 16-Ana notation into Decimals, Sq Ft, Katha, Bigha, and Acre'}
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400">
              {isBn ? 'নমুনা:' : 'Presets:'}
            </span>
            <button
              onClick={() => handleApplyPreset('equal2')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 text-[10px] font-bold text-slate-600 border border-slate-200 transition"
            >
              {isBn ? '২ জন (৫০%)' : '2 (50%)'}
            </button>
            <button
              onClick={() => handleApplyPreset('equal3')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 text-[10px] font-bold text-slate-600 border border-slate-200 transition"
            >
              {isBn ? '৩ জন (১/৩)' : '3 (1/3)'}
            </button>
            <button
              onClick={() => handleApplyPreset('equal4')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 text-[10px] font-bold text-slate-600 border border-slate-200 transition"
            >
              {isBn ? '৪ জন (২৫%)' : '4 (25%)'}
            </button>
            <button
              onClick={() => handleApplyPreset('traditional16')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 text-[10px] font-bold text-slate-600 border border-slate-200 transition"
            >
              {isBn ? '১৬ আনা খতিয়ান' : '16-Ana'}
            </button>
            <button
              onClick={() => handleApplyPreset('ratio12')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 text-[10px] font-bold text-slate-600 border border-slate-200 transition"
            >
              {isBn ? '১:২ অনুপাত' : '1:2 Ratio'}
            </button>
          </div>
        </div>

        {/* Total Land Input Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
          <div>
            <label className="block text-xs font-bold text-emerald-950 mb-1">
              {isBn ? 'মোট জমির পরিমাণ' : 'Total Land Amount'}
            </label>
            <input
              id="hissha-total-land-input"
              type="number"
              min="0"
              step="any"
              value={totalLandInput}
              onChange={(e) => setTotalLandInput(e.target.value)}
              placeholder="0"
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-base font-black text-slate-900 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-emerald-950 mb-1">
              {isBn ? 'জমির পরিমাপের একক' : 'Land Area Unit'}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['decimal', 'katha', 'bigha', 'acre', 'sqFt', 'sqMeter'] as LandAreaUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setAreaUnit(u)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                    areaUnit === u
                      ? 'bg-emerald-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-emerald-100 border border-slate-200'
                  }`}
                >
                  {getAreaUnitLabel(u, lang)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Total Land Summary Cards (Decimal, Sq Ft, Katha, Bigha, Acre) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">
              {isBn ? 'মোট শতাংশ / শতক' : 'Total Decimal'}
            </span>
            <span className="text-base font-black text-emerald-900">
              {formatNumberByLang(calculationData.totalDecimal, lang)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">
              {isBn ? 'মোট কাঠা' : 'Total Katha'}
            </span>
            <span className="text-base font-black text-blue-900">
              {formatNumberByLang(calculationData.totalKatha, lang)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">
              {isBn ? 'মোট বিঘা' : 'Total Bigha'}
            </span>
            <span className="text-base font-black text-amber-900">
              {formatNumberByLang(calculationData.totalBigha, lang)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-semibold block">
              {isBn ? 'মোট একর' : 'Total Acre'}
            </span>
            <span className="text-base font-black text-purple-900">
              {formatNumberByLang(calculationData.totalAcre, lang)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-500 font-semibold block">
              {isBn ? 'মোট বর্গফুট' : 'Total Sq Ft'}
            </span>
            <span className="text-base font-black text-slate-800">
              {formatNumberByLang(calculationData.totalSqFt, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* Owner Share Input Rows */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-800" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {isBn ? 'অংশীদার ও হিস্যা বণ্টন তালিকা' : 'Owners & Share Allocation'}
            </h4>
          </div>

          <button
            id="hissha-add-owner-btn"
            onClick={() => handleAddOwner()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition active:scale-95 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBn ? 'অংশীদার যোগ করুন' : 'Add Owner'}</span>
          </button>
        </div>

        {/* Validation Error Banner if allocated > 100% */}
        {calculationData.isExceeded && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm">
                {isBn
                  ? 'সতর্কতা: মোট বণ্টন ১০০% অতিক্রম করেছে!'
                  : 'Warning: Total allocation exceeds 100%!'}
              </span>
              <p className="text-xs text-red-700 mt-0.5">
                {isBn
                  ? `বর্তমান মোট বণ্টন: ${formatNumberByLang(calculationData.allocatedPercent, lang)}% (অতিরিক্ত: ${formatNumberByLang(roundClean(calculationData.allocatedPercent - 100, 3), lang)}% বা ${formatNumberByLang(roundClean((calculationData.totalDecimal * (calculationData.allocatedPercent - 100)) / 100, 3), lang)} শতক জমি)`
                  : `Current total: ${calculationData.allocatedPercent}% (Exceeded by: ${roundClean(calculationData.allocatedPercent - 100, 3)}%)`}
              </p>
            </div>
          </div>
        )}

        {/* Owners List */}
        <div className="space-y-3.5">
          {owners.map((owner, idx) => {
            const calculatedOwner = calculationData.owners[idx];

            return (
              <div
                key={owner.id}
                className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3 transition hover:border-emerald-300"
              >
                {/* Header: Name, Mode Selector, and Delete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {formatNumberByLang(idx + 1, lang)}
                    </span>
                    <input
                      type="text"
                      value={owner.name}
                      onChange={(e) => handleUpdateOwnerField(owner.id, 'name', e.target.value)}
                      placeholder={isBn ? 'অংশীদারের নাম' : 'Owner Name'}
                      className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div className="flex items-center gap-2 justify-between sm:justify-end">
                    {/* Share Mode Selector */}
                    <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/70 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleUpdateOwnerField(owner.id, 'shareMode', 'percent')}
                        className={`px-2 py-1 rounded-md transition ${
                          owner.shareMode === 'percent'
                            ? 'bg-white text-emerald-950 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isBn ? 'শতকরা (%)' : 'Percent'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateOwnerField(owner.id, 'shareMode', 'fraction')}
                        className={`px-2 py-1 rounded-md transition ${
                          owner.shareMode === 'fraction'
                            ? 'bg-white text-emerald-950 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isBn ? 'ভগ্নাংশ (a/b)' : 'Fraction'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateOwnerField(owner.id, 'shareMode', 'traditional')}
                        className={`px-2 py-1 rounded-md transition ${
                          owner.shareMode === 'traditional'
                            ? 'bg-white text-emerald-950 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isBn ? 'আনা-গন্ডা' : '16-Ana'}
                      </button>
                    </div>

                    {owners.length > 1 && (
                      <button
                        onClick={() => handleRemoveOwner(owner.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title={isBn ? 'মুছুন' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Share Input Area based on Mode */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  {/* Mode 1: Percentage */}
                  {owner.shareMode === 'percent' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600 shrink-0">
                        {isBn ? 'অংশ (শতকরা):' : 'Share (%):'}
                      </span>
                      <div className="relative w-36">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={owner.percentStr}
                          onChange={(e) =>
                            handleUpdateOwnerField(owner.id, 'percentStr', e.target.value)
                          }
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-slate-900 text-right pr-6 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                        <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2" />
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {isBn ? '(০ থেকে ১০০%)' : '(0 to 100%)'}
                      </span>
                    </div>
                  )}

                  {/* Mode 2: Fraction (Numerator / Denominator) */}
                  {owner.shareMode === 'fraction' && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600 shrink-0">
                          {isBn ? 'ভগ্নাংশ:' : 'Fraction:'}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={owner.numeratorStr}
                            onChange={(e) =>
                              handleUpdateOwnerField(owner.id, 'numeratorStr', e.target.value)
                            }
                            placeholder="1"
                            className="w-16 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                          <span className="text-slate-400 font-bold">/</span>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={owner.denominatorStr}
                            onChange={(e) =>
                              handleUpdateOwnerField(owner.id, 'denominatorStr', e.target.value)
                            }
                            placeholder="2"
                            className="w-16 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>
                      </div>

                      {/* Quick Fraction Pills */}
                      <div className="flex items-center gap-1 flex-wrap sm:ml-auto">
                        <span className="text-[10px] text-slate-400">{isBn ? 'দ্রুত:' : 'Quick:'}</span>
                        {[
                          { n: '1', d: '2', lbl: '১/২' },
                          { n: '1', d: '3', lbl: '১/৩' },
                          { n: '1', d: '4', lbl: '১/৪' },
                          { n: '1', d: '6', lbl: '১/৬' },
                          { n: '1', d: '8', lbl: '১/৮' },
                          { n: '3', d: '8', lbl: '৩/৮' },
                          { n: '2', d: '3', lbl: '২/৩' },
                        ].map((fr, fIdx) => (
                          <button
                            key={fIdx}
                            type="button"
                            onClick={() => {
                              handleUpdateOwnerField(owner.id, 'numeratorStr', fr.n);
                              handleUpdateOwnerField(owner.id, 'denominatorStr', fr.d);
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 text-[10px] font-bold text-slate-600 border border-slate-200 transition"
                          >
                            {fr.lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mode 3: Traditional 16-Ana (Ana, Gonda, Kora, Kranti, Til) */}
                  {owner.shareMode === 'traditional' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            {isBn ? 'আনা (০-১৬)' : 'Ana (0-16)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="16"
                            value={owner.anaStr}
                            onChange={(e) =>
                              handleUpdateOwnerField(owner.id, 'anaStr', e.target.value)
                            }
                            className="w-full px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            {isBn ? 'গন্ডা (০-১৯)' : 'Gonda (0-19)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="19"
                            value={owner.gondaStr}
                            onChange={(e) =>
                              handleUpdateOwnerField(owner.id, 'gondaStr', e.target.value)
                            }
                            className="w-full px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            {isBn ? 'কড়া (০-৩)' : 'Kora (0-3)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="3"
                            value={owner.koraStr}
                            onChange={(e) =>
                              handleUpdateOwnerField(owner.id, 'koraStr', e.target.value)
                            }
                            className="w-full px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            {isBn ? 'ক্রান্তি (০-২)' : 'Kranti (0-2)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="2"
                            value={owner.krantiStr}
                            onChange={(e) =>
                              handleUpdateOwnerField(owner.id, 'krantiStr', e.target.value)
                            }
                            className="w-full px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            {isBn ? 'তিল (০-১৯)' : 'Til (0-19)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="19"
                            value={owner.tilStr}
                            onChange={(e) =>
                              handleUpdateOwnerField(owner.id, 'tilStr', e.target.value)
                            }
                            className="w-full px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>
                      </div>

                      {/* Quick Ana Presets */}
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <span className="text-[10px] text-slate-400">{isBn ? 'দ্রুত:' : 'Quick:'}</span>
                        {[
                          { a: '8', g: '0', lbl: '৮ আনা (৫০%)' },
                          { a: '4', g: '0', lbl: '৪ আনা (২৫%)' },
                          { a: '2', g: '0', lbl: '২ আনা (১২.৫%)' },
                          { a: '1', g: '0', lbl: '১ আনা' },
                          { a: '0', g: '10', lbl: '১০ গন্ডা' },
                        ].map((pr, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              handleUpdateOwnerField(owner.id, 'anaStr', pr.a);
                              handleUpdateOwnerField(owner.id, 'gondaStr', pr.g);
                              handleUpdateOwnerField(owner.id, 'koraStr', '0');
                              handleUpdateOwnerField(owner.id, 'krantiStr', '0');
                              handleUpdateOwnerField(owner.id, 'tilStr', '0');
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 text-[10px] font-bold text-slate-600 border border-slate-200 transition"
                          >
                            {pr.lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Calculated Outputs for this owner: Decimal, Katha, Bigha, Acre, Sq Ft */}
                {calculatedOwner && (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-center text-xs pt-1 border-t border-slate-200/60">
                    <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-semibold block">
                        {isBn ? 'হিস্যা অংশ' : 'Share'}
                      </span>
                      <span className="font-bold text-emerald-900 line-clamp-1" title={calculatedOwner.shareDescription}>
                        {calculatedOwner.shareDescription}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-semibold block">
                        {isBn ? 'শতাংশ / শতক' : 'Decimal'}
                      </span>
                      <span className="font-black text-slate-900">
                        {formatNumberByLang(calculatedOwner.decimal, lang)}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-semibold block">
                        {isBn ? 'কাঠা' : 'Katha'}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatNumberByLang(calculatedOwner.katha, lang)}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-semibold block">
                        {isBn ? 'বিঘা' : 'Bigha'}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatNumberByLang(calculatedOwner.bigha, lang)}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-semibold block">
                        {isBn ? 'একর' : 'Acre'}
                      </span>
                      <span className="font-bold text-purple-900">
                        {formatNumberByLang(calculatedOwner.acre, lang)}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-white border border-slate-100 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-500 font-semibold block">
                        {isBn ? 'বর্গফুট' : 'Sq. Ft.'}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatNumberByLang(calculatedOwner.sqFt, lang)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress Bar of Allocation */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">
              {isBn ? 'মোট বণ্টন:' : 'Total Allocated:'}{' '}
              {formatNumberByLang(calculationData.allocatedPercent, lang)}%
            </span>
            <span
              className={
                calculationData.isExceeded
                  ? 'text-red-600 font-black'
                  : calculationData.isComplete
                  ? 'text-emerald-700 font-black'
                  : 'text-amber-600 font-semibold'
              }
            >
              {calculationData.isExceeded
                ? isBn
                  ? 'অতিরিক্ত বণ্টন!'
                  : 'Over-allocated!'
                : calculationData.isComplete
                ? isBn
                  ? '১০০% সম্পূর্ণ বণ্টন'
                  : '100% Fully Distributed'
                : isBn
                ? `বাকি: ${formatNumberByLang(calculationData.remainingPercent, lang)}%`
                : `Remaining: ${calculationData.remainingPercent}%`}
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                calculationData.isExceeded
                  ? 'bg-red-500'
                  : calculationData.isComplete
                  ? 'bg-emerald-600'
                  : 'bg-emerald-800'
              }`}
              style={{ width: `${Math.min(100, calculationData.allocatedPercent)}%` }}
            />
          </div>
        </div>

        {/* Remaining Land Details Card */}
        {calculationData.remainingPercent > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-amber-950 block">
                {isBn ? 'অবশিষ্ট অবণ্টিত জমি:' : 'Remaining Undistributed Land:'}
              </span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {isBn
                  ? `${formatNumberByLang(calculationData.remainingPercent, lang)}% জমি এখনো কাউকে বণ্টন করা হয়নি।`
                  : `${calculationData.remainingPercent}% land is currently unallocated.`}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-amber-900">
                <span>{formatNumberByLang(calculationData.remainingDecimal, lang)} {isBn ? 'শতক' : 'Dec'}</span>
                <span>•</span>
                <span>{formatNumberByLang(calculationData.remainingKatha, lang)} {isBn ? 'কাঠা' : 'Katha'}</span>
                <span>•</span>
                <span>{formatNumberByLang(calculationData.remainingAcre, lang)} {isBn ? 'একর' : 'Acre'}</span>
                <span>•</span>
                <span>{formatNumberByLang(calculationData.remainingSqFt, lang)} {isBn ? 'বর্গফুট' : 'sq ft'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleAddOwner(calculationData.remainingPercent)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition active:scale-95 shrink-0 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBn ? 'অবশিষ্ট দিয়ে নতুন অংশীদার যোগ' : 'Add Owner with Remainder'}</span>
            </button>
          </div>
        )}

        {/* Actions Bar */}
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
              disabled={calculationData.totalSqFt <= 0}
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
