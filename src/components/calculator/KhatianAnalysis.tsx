import React, { useState, useMemo } from 'react';
import { LandAreaUnit } from '../../types';
import {
  calculateLandUnits,
  formatNumberByLang,
  getAreaUnitLabel,
  roundClean,
} from '../../lib/land-units';
import { saveCalculationToHistory } from '../../lib/land-calculations';
import { printWithNoto } from '../../lib/print-utils';
import {
  analyzeKhatian,
  prepareKhatianReportData,
  KhatianMetadata,
  KhatianType,
  KhatianDagInput,
  KhatianOwnerInput,
} from '../../lib/khatian-calculations';
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
  Layers,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { LocationSelectionValue } from '../../types/administrative-location';
import { BangladeshLocationSelector } from '../common/BangladeshLocationSelector';

interface KhatianAnalysisProps {
  lang: 'bn' | 'en';
}

export const KhatianAnalysis: React.FC<KhatianAnalysisProps> = ({ lang }) => {
  const isBn = lang === 'bn';

  // Active View Mode: Edit/Analysis vs A4 Report Preview
  const [viewMode, setViewMode] = useState<'edit' | 'report'>('edit');

  // Sub-view in Edit Mode: 'owners' or 'dags'
  const [tableTab, setTableTab] = useState<'owners' | 'dags'>('owners');

  // Khatian Metadata State
  const [metadata, setMetadata] = useState<KhatianMetadata>({
    district: '',
    upazila: '',
    union: '',
    mouza: '',
    jlNo: '',
    khatianNo: '',
    khatianType: 'RS',
    notes: '',
  });

  // Multiple Dags under this Khatian
  const [dags, setDags] = useState<KhatianDagInput[]>([
    {
      id: 'dag_1',
      dagNo: '১০৫',
      landClass: isBn ? 'নাল' : 'Nal',
      landAmount: '35',
      unit: 'decimal',
    },
    {
      id: 'dag_2',
      dagNo: '১০৮',
      landClass: isBn ? 'ভিটি' : 'Viti',
      landAmount: '15',
      unit: 'decimal',
    },
  ]);

  // Multiple Owners under this Khatian
  const [owners, setOwners] = useState<KhatianOwnerInput[]>([
    {
      id: 'owner_1',
      name: isBn ? 'মোঃ আবুল কালাম' : 'Md. Abul Kalam',
      relationOrFather: isBn ? 'পিতা: মৃত শামসুল হক' : 'Father: Late Shamsul Haque',
      shareType: 'percent',
      percentStr: '60',
      numeratorStr: '3',
      denominatorStr: '5',
      manualLandStr: '30',
      manualUnit: 'decimal',
      assignedDagIds: ['all'],
      notes: isBn ? 'পৈত্রিক ওয়ারিশ সূত্রে' : 'Paternal inheritance',
    },
    {
      id: 'owner_2',
      name: isBn ? 'মোছাঃ জাহানারা বেগম' : 'Mst. Jahanara Begum',
      relationOrFather: isBn ? 'স্বামী: মোঃ আবুল কালাম' : 'Husband: Md. Abul Kalam',
      shareType: 'percent',
      percentStr: '40',
      numeratorStr: '2',
      denominatorStr: '5',
      manualLandStr: '20',
      manualUnit: 'decimal',
      assignedDagIds: ['all'],
      notes: isBn ? 'খরিদ সূত্রে অংশীদার' : 'Purchased share',
    },
  ]);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Compute analysis
  const analysisResult = useMemo(() => {
    return analyzeKhatian(metadata, dags, owners, lang);
  }, [metadata, dags, owners, lang]);

  // Prepare A4 report data
  const reportA4 = useMemo(() => {
    return prepareKhatianReportData(analysisResult, lang);
  }, [analysisResult, lang]);

  // Metadata update handler
  const handleUpdateMetadata = (field: keyof KhatianMetadata, val: string) => {
    setMetadata((prev) => ({ ...prev, [field]: val }));
  };

  // Add Dag
  const handleAddDag = () => {
    const nextNum = dags.length + 1;
    const newDag: KhatianDagInput = {
      id: `dag_${Date.now()}`,
      dagNo: String(100 + nextNum * 10),
      landClass: isBn ? 'নাল' : 'Nal',
      landAmount: '10',
      unit: 'decimal',
    };
    setDags([...dags, newDag]);
  };

  // Remove Dag
  const handleRemoveDag = (id: string) => {
    if (dags.length <= 1) return;
    setDags(dags.filter((d) => d.id !== id));
  };

  // Update Dag
  const handleUpdateDag = (id: string, updates: Partial<KhatianDagInput>) => {
    setDags((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        return { ...d, ...updates };
      })
    );
  };

  // Add Owner
  const handleAddOwner = () => {
    const nextNum = owners.length + 1;
    const remainingPct = analysisResult.remainingPercent > 0 ? analysisResult.remainingPercent : 0;
    const remainingDec = analysisResult.remainingDecimal > 0 ? analysisResult.remainingDecimal : 0;

    const newOwner: KhatianOwnerInput = {
      id: `owner_${Date.now()}`,
      name: isBn ? `অংশীদার ${nextNum}` : `Owner ${nextNum}`,
      relationOrFather: '',
      shareType: 'percent',
      percentStr: remainingPct > 0 ? String(roundClean(remainingPct, 2)) : '0',
      numeratorStr: '1',
      denominatorStr: '4',
      manualLandStr: remainingDec > 0 ? String(roundClean(remainingDec, 2)) : '0',
      manualUnit: 'decimal',
      assignedDagIds: ['all'],
      notes: '',
    };
    setOwners([...owners, newOwner]);
  };

  // Remove Owner
  const handleRemoveOwner = (id: string) => {
    if (owners.length <= 1) return;
    setOwners(owners.filter((o) => o.id !== id));
  };

  // Update Owner
  const handleUpdateOwner = (id: string, updates: Partial<KhatianOwnerInput>) => {
    setOwners((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return { ...o, ...updates };
      })
    );
  };

  // Toggle assigned dag for an owner
  const handleToggleOwnerDag = (ownerId: string, dagId: string) => {
    setOwners((prev) =>
      prev.map((o) => {
        if (o.id !== ownerId) return o;

        let current = o.assignedDagIds || ['all'];
        if (dagId === 'all') {
          return { ...o, assignedDagIds: ['all'] };
        }

        // If currently 'all', replace with all actual dag ids except dagId if unchecking, or just dagId
        if (current.includes('all')) {
          current = [dagId];
        } else if (current.includes(dagId)) {
          current = current.filter((id) => id !== dagId);
          if (current.length === 0) current = ['all'];
        } else {
          current = [...current, dagId];
          if (current.length === dags.length) current = ['all'];
        }

        return { ...o, assignedDagIds: current };
      })
    );
  };

  // Auto-balance shares to 100%
  const handleAutoBalance = () => {
    const totalP = owners.reduce((sum, o) => {
      const p = parseFloat(o.percentStr) || 0;
      return sum + p;
    }, 0);

    if (totalP <= 0) return;

    setOwners((prev) =>
      prev.map((o) => {
        const p = parseFloat(o.percentStr) || 0;
        const normalized = roundClean((p / totalP) * 100, 3);
        const dec = roundClean((analysisResult.totalKhatianDecimal * normalized) / 100, 3);
        return {
          ...o,
          percentStr: String(normalized),
          manualLandStr: String(dec),
        };
      })
    );
  };

  // Add owner with remaining share
  const handleAddRemainderOwner = () => {
    if (analysisResult.remainingDecimal <= 0) return;
    const nextNum = owners.length + 1;
    const newOwner: KhatianOwnerInput = {
      id: `owner_${Date.now()}`,
      name: isBn ? `অবশিষ্ট অংশীদার ${nextNum}` : `Remainder Owner ${nextNum}`,
      relationOrFather: '',
      shareType: 'percent',
      percentStr: String(roundClean(analysisResult.remainingPercent, 2)),
      numeratorStr: '1',
      denominatorStr: '1',
      manualLandStr: String(roundClean(analysisResult.remainingDecimal, 2)),
      manualUnit: 'decimal',
      assignedDagIds: ['all'],
      notes: isBn ? 'অবশিষ্ট অবণ্টিত অংশ' : 'Remaining unallocated share',
    };
    setOwners([...owners, newOwner]);
  };

  // Reset form
  const handleReset = () => {
    setMetadata({
      district: '',
      upazila: '',
      union: '',
      mouza: '',
      jlNo: '',
      khatianNo: '',
      khatianType: 'RS',
      notes: '',
    });
    setDags([
      {
        id: 'dag_1',
        dagNo: '১০৫',
        landClass: isBn ? 'নাল' : 'Nal',
        landAmount: '35',
        unit: 'decimal',
      },
      {
        id: 'dag_2',
        dagNo: '১০৮',
        landClass: isBn ? 'ভিটি' : 'Viti',
        landAmount: '15',
        unit: 'decimal',
      },
    ]);
    setOwners([
      {
        id: 'owner_1',
        name: isBn ? 'মোঃ আবুল কালাম' : 'Md. Abul Kalam',
        relationOrFather: isBn ? 'পিতা: মৃত শামসুল হক' : 'Father: Late Shamsul Haque',
        shareType: 'percent',
        percentStr: '60',
        numeratorStr: '3',
        denominatorStr: '5',
        manualLandStr: '30',
        manualUnit: 'decimal',
        assignedDagIds: ['all'],
        notes: isBn ? 'পৈত্রিক ওয়ারিশ সূত্রে' : 'Paternal inheritance',
      },
      {
        id: 'owner_2',
        name: isBn ? 'মোছাঃ জাহানারা বেগম' : 'Mst. Jahanara Begum',
        relationOrFather: isBn ? 'স্বামী: মোঃ আবুল কালাম' : 'Husband: Md. Abul Kalam',
        shareType: 'percent',
        percentStr: '40',
        numeratorStr: '2',
        denominatorStr: '5',
        manualLandStr: '20',
        manualUnit: 'decimal',
        assignedDagIds: ['all'],
        notes: isBn ? 'খরিদ সূত্রে অংশীদার' : 'Purchased share',
      },
    ]);
  };

  // Copy Summary
  const handleCopySummary = () => {
    let text = isBn
      ? `ভূমি ও আমিন — আধুনিক খতিয়ান বিশ্লেষণ ও মালিকানা প্রতিবেদন\n[ডিজিটাল বিশ্লেষণ / ব্যবহারকারী প্রদত্ত তথ্য ভিত্তিক — কোনো সরকারি স্বত্ব প্রমাণ নয়]\n\n`
      : `Bhumi O Amin — Advanced Khatian Analysis & Ownership Report\n[DIGITAL ANALYSIS / USER-PROVIDED DATA — Not legal proof]\n\n`;

    text += `${isBn ? '--- খতিয়ান পরিচিতি ---' : '--- Khatian Identification ---'}\n`;
    text += `${isBn ? 'খতিয়ান নং' : 'Khatian No'}: ${metadata.khatianNo || '—'} (${metadata.khatianType} ${isBn ? 'জরিপ' : 'Survey'})\n`;
    if (metadata.mouza) text += `${isBn ? 'মৌজা' : 'Mouza'}: ${metadata.mouza} | `;
    if (metadata.jlNo) text += `${isBn ? 'জে.এল. নং' : 'J.L. No'}: ${metadata.jlNo} | `;
    if (metadata.union) text += `${isBn ? 'ইউনিয়ন' : 'Union'}: ${metadata.union}\n`;
    if (metadata.upazila) text += `${isBn ? 'উপজেলা' : 'Upazila'}: ${metadata.upazila} | `;
    if (metadata.district) text += `${isBn ? 'জেলা' : 'District'}: ${metadata.district}\n`;

    text += `\n${isBn ? 'মোট রেকর্ডকৃত জমি' : 'Total Recorded Land'}: ${formatNumberByLang(analysisResult.totalKhatianDecimal, lang)} শতক (${formatNumberByLang(analysisResult.totalKhatianKatha, lang)} কাঠা / ${formatNumberByLang(analysisResult.totalKhatianSqFt, lang)} বর্গফুট)\n\n`;

    text += `${isBn ? '--- দাগভিত্তিক বিবরণ ---' : '--- Dag-wise Breakdown ---'}\n`;
    analysisResult.dags.forEach((d, i) => {
      text += `${i + 1}. দাগ নং: ${d.dagNo} [শ্রেণি: ${d.landClass}] ➔ ${formatNumberByLang(d.decimal, lang)} শতক (${formatNumberByLang(d.allocatedPercent, lang)}% বণ্টিত)\n`;
    });

    text += `\n${isBn ? '--- মালিকভিত্তিক হিস্যা ও জমির বণ্টন ---' : '--- Owner-wise Share & Allocation ---'}\n`;
    analysisResult.owners.forEach((o, i) => {
      text += `${i + 1}. ${o.name}${o.relationOrFather ? ` (${o.relationOrFather})` : ''}\n`;
      text += `   - হিস্যা/অংশ: ${o.shareDisplayStr}\n`;
      text += `   - মোট জমি: ${formatNumberByLang(o.totalDecimal, lang)} শতক | ${formatNumberByLang(o.totalKatha, lang)} কাঠা | ${formatNumberByLang(o.totalBigha, lang)} বিঘা | ${formatNumberByLang(o.totalSqFt, lang)} বর্গফুট\n`;
      text += `   - সংশ্লিষ্ট দাগ: ${o.assignedDagLabels.join(', ') || (isBn ? 'সকল দাগ' : 'All Dags')}\n`;
      if (o.notes) text += `   - মন্তব্য: ${o.notes}\n`;
      text += `\n`;
    });

    if (analysisResult.remainingDecimal > 0) {
      text += isBn
        ? `অবশিষ্ট অবণ্টিত জমি (${formatNumberByLang(analysisResult.remainingPercent, lang)}%): ${formatNumberByLang(analysisResult.remainingDecimal, lang)} শতক (${formatNumberByLang(analysisResult.remainingSqFt, lang)} বর্গফুট)\n\n`
        : `Remaining Unallocated (${analysisResult.remainingPercent}%): ${analysisResult.remainingDecimal} Decimals\n\n`;
    }

    if (metadata.notes) {
      text += `${isBn ? 'বিশেষ মন্তব্য' : 'Remarks'}: ${metadata.notes}\n\n`;
    }

    text += isBn
      ? `[সতর্কতা: ডিজিটাল বিশ্লেষণ / ব্যবহারকারী প্রদত্ত তথ্য ভিত্তিক — এটি কোনো সরকারি স্বত্ব প্রমাণ বা সাব-রেজিস্ট্রির চূড়ান্ত রেকর্ড নয়। স্বত্ব প্রমাণের জন্য সহকারী কমিশনার (ভূমি) বা সাব-রেজিস্ট্রি অফিসের মূল রেকর্ড যাচাই আবশ্যক।]`
      : `[Disclaimer: DIGITAL ANALYSIS / USER-PROVIDED DATA — Not official legal proof of land title.]`;

    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save to Calculation History
  const handleSaveToHistory = () => {
    const desc = isBn
      ? `খতিয়ান বিশ্লেষণ: খতিয়ান ${metadata.khatianNo || '—'} (${metadata.khatianType}), মৌজা ${metadata.mouza || '—'}, মোট জমি: ${formatNumberByLang(analysisResult.totalKhatianDecimal, lang)} শতক, দাগ: ${formatNumberByLang(dags.length, lang)}টি, মালিক: ${formatNumberByLang(owners.length, lang)} জন`
      : `Khatian Analysis: Khatian ${metadata.khatianNo || '—'} (${metadata.khatianType}), Mouza ${metadata.mouza || '—'}, Total: ${analysisResult.totalKhatianDecimal} Dec, Dags: ${dags.length}, Owners: ${owners.length}`;

    const details: Record<string, string | number> = {
      district: metadata.district,
      upazila: metadata.upazila,
      union: metadata.union,
      mouza: metadata.mouza,
      jlNo: metadata.jlNo,
      khatianNo: metadata.khatianNo,
      khatianType: metadata.khatianType,
      totalKhatianDecimal: analysisResult.totalKhatianDecimal,
      totalAllocatedDecimal: analysisResult.totalAllocatedDecimal,
      remainingDecimal: analysisResult.remainingDecimal,
      isFullyBalanced: analysisResult.isFullyBalanced ? 'yes' : 'no',
      dagCount: dags.length,
      ownerCount: owners.length,
    };

    analysisResult.owners.forEach((o, i) => {
      details[`owner_${i + 1}`] = `${o.name}: ${o.totalDecimal} dec (${o.sharePercent}%)`;
    });

    saveCalculationToHistory({
      shape: 'polygon',
      unit: 'feet',
      areaSqFt: analysisResult.totalKhatianSqFt,
      areaSqMeter: roundClean(analysisResult.totalKhatianSqFt / 10.7639, 2),
      shatangsha: analysisResult.totalKhatianDecimal,
      katha: analysisResult.totalKhatianKatha,
      bigha: analysisResult.totalKhatianBigha,
      acre: analysisResult.totalKhatianAcre,
      inputDescription: desc,
      shapeNameBn: 'খতিয়ান বিশ্লেষণ ও মালিকানা রিপোর্ট',
      shapeNameEn: 'Khatian Analysis & Ownership Report',
      details,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div id="khatian-analysis-root" className="space-y-4">
      {/* Prominent Legal Disclaimer Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-black block text-sm">
            {isBn
              ? 'ডিজিটাল বিশ্লেষণ / ব্যবহারকারী প্রদত্ত তথ্য ভিত্তিক (DIGITAL ANALYSIS / USER-PROVIDED DATA)'
              : 'DIGITAL ANALYSIS / USER-PROVIDED DATA'}
          </span>
          <p className="text-[11px] text-amber-900 leading-relaxed mt-0.5">
            {isBn
              ? 'সতর্কতা: এটি ব্যবহারকারী প্রদত্ত খতিয়ান ও দাগের তথ্যের ওপর ভিত্তি করে প্রস্তুতকৃত ডিজিটাল বিশ্লেষণ ও গাণিতিক হিসাব। এটি কোনো সরকারি স্বত্ব প্রমাণ বা আদালতের চূড়ান্ত রায় নয়। স্বত্ব প্রমাণের জন্য সহকারী কমিশনার (ভূমি) বা সাব-রেজিস্ট্রি অফিসের মূল সরকারি রেকর্ড ও পর্চা যাচাই আবশ্যক।'
              : 'Disclaimer: This analysis is based on user-provided survey data for calculation and validation purposes. It does not constitute official legal proof of land title.'}
          </p>
        </div>
      </div>

      {/* Main Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-800" />
          <div>
            <h3 className="text-xs font-bold text-slate-900">
              {isBn ? 'খতিয়ান বিশ্লেষণ ও মালিকানা ক্যালকুলেটর' : 'Khatian Analysis & Ownership Report'}
            </h3>
            <span className="text-[10px] text-slate-500">
              {isBn ? 'দাগভিত্তিক মোট জমি, অংশীদারদের হিস্যা ও অসঙ্গতি যাচাই' : 'Dag-wise total land, owner shares & discrepancy analysis'}
            </span>
          </div>
        </div>

        {/* View Mode Toggle: Edit/Analysis vs A4 Printable Draft Preview */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-start sm:self-center">
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              viewMode === 'edit'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isBn ? 'সম্পাদনা ও বিশ্লেষণ' : 'Edit & Analysis'}</span>
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
            <span>{isBn ? 'A4 প্রফেশনাল রিপোর্ট' : 'A4 Report Preview'}</span>
          </button>
        </div>
      </div>

      {/* EDIT & ANALYSIS MODE */}
      {viewMode === 'edit' && (
        <div className="space-y-4">
          {/* Section 1: Khatian Identification Metadata */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4 text-emerald-800" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {isBn ? '১. খতিয়ান পরিচিতি ও আইনগত তথ্য' : '1. Khatian Registry Details'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {isBn ? 'জেলা, উপজেলা, ইউনিয়ন, মৌজা, খতিয়ান নং ও খতিয়ানের ধরন পূরণ করুন' : 'Enter District, Upazila, Union, Mouza, Khatian No & Type'}
                </p>
              </div>
            </div>

            {/* Administrative Location & Cascading Selector */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800">
                  {isBn ? 'প্রশাসনিক অবস্থান ও জরিপ' : 'Administrative Location & Survey'}
                </span>
                <span className="text-[10px] text-emerald-800 font-semibold">
                  {isBn ? 'স্বয়ংক্রিয় ক্যাসকেড' : 'Auto Cascade'}
                </span>
              </div>
              <BangladeshLocationSelector
                value={{
                  districtNameBn: metadata.district,
                  upazilaNameBn: metadata.upazila,
                  mouzaNameBn: metadata.mouza,
                  jlNo: metadata.jlNo,
                  surveyType: (metadata.khatianType as any) || 'RS',
                }}
                onChange={(val) => {
                  setMetadata((prev) => ({
                    ...prev,
                    district: val.districtNameBn || '',
                    upazila: val.upazilaNameBn || '',
                    mouza: val.mouzaNameBn || '',
                    jlNo: val.jlNo || '',
                    khatianType: (val.surveyType as KhatianType) || prev.khatianType,
                  }));
                }}
                lang={lang}
                showSurveyType={true}
                showJlInput={true}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                  {isBn ? 'খতিয়ান নং (Khatian No) *' : 'Khatian No. *'}
                </label>
                <input
                  id="khatian-no-input"
                  type="text"
                  value={metadata.khatianNo}
                  onChange={(e) => handleUpdateMetadata('khatianNo', e.target.value)}
                  placeholder="৪৫২"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {isBn ? 'মন্তব্য (Optional Notes)' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={metadata.notes}
                  onChange={(e) => handleUpdateMetadata('notes', e.target.value)}
                  placeholder={isBn ? 'উদা: সাবেক রেকর্ড নং' : 'e.g. Former record'}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dag-wise Land Management */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-800" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {isBn ? '২. খতিয়ানভুক্ত দাগ ও জমির পরিমাণ' : '2. Dags & Plot Areas in Khatian'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isBn ? 'একই খতিয়ানের অধীন একাধিক দাগ ও শ্রেণি যুক্ত করুন' : 'Add multiple dags and land classifications under this Khatian'}
                  </p>
                </div>
              </div>

              <button
                id="khatian-add-dag-btn"
                onClick={handleAddDag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition active:scale-95 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBn ? 'নতুন দাগ যোগ' : 'Add Dag'}</span>
              </button>
            </div>

            {/* List of Dags */}
            <div className="space-y-2.5">
              {dags.map((dag, idx) => (
                <div
                  key={dag.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {formatNumberByLang(idx + 1, lang)}
                    </span>

                    <div className="w-28">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">{isBn ? 'দাগ নং' : 'Dag No'}</label>
                      <input
                        type="text"
                        value={dag.dagNo}
                        onChange={(e) => handleUpdateDag(dag.id, { dagNo: e.target.value })}
                        placeholder="১০৫"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                    </div>

                    <div className="w-32">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">{isBn ? 'জমির শ্রেণি' : 'Land Class'}</label>
                      <input
                        type="text"
                        value={dag.landClass}
                        onChange={(e) => handleUpdateDag(dag.id, { landClass: e.target.value })}
                        placeholder={isBn ? 'নাল, ভিটি, বাড়ি' : 'Nal, Viti'}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                    </div>

                    <div className="w-32">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">{isBn ? 'জমির পরিমাণ' : 'Land Amount'}</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={dag.landAmount}
                        onChange={(e) => handleUpdateDag(dag.id, { landAmount: e.target.value })}
                        placeholder="35"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-black text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                    </div>

                    <div className="w-28">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">{isBn ? 'পরিমাপ একক' : 'Unit'}</label>
                      <select
                        value={dag.unit}
                        onChange={(e) => handleUpdateDag(dag.id, { unit: e.target.value as LandAreaUnit })}
                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800"
                      >
                        <option value="decimal">{isBn ? 'শতাংশ/শতক' : 'Decimal'}</option>
                        <option value="katha">{isBn ? 'কাঠা' : 'Katha'}</option>
                        <option value="bigha">{isBn ? 'বিঘা' : 'Bigha'}</option>
                        <option value="acre">{isBn ? 'একর' : 'Acre'}</option>
                        <option value="sqFt">{isBn ? 'বর্গফুট' : 'Sq Ft'}</option>
                        <option value="sqMeter">{isBn ? 'বর্গমিটার' : 'Sq Meter'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Calculated preview */}
                    <div className="text-right px-2 py-1 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-semibold">{isBn ? 'রূপান্তরিত শতক' : 'Calculated Dec'}</span>
                      <span className="text-xs font-black text-emerald-950">
                        {formatNumberByLang(
                          roundClean(
                            analysisResult.dags.find((d) => d.id === dag.id)?.decimal || 0,
                            2
                          ),
                          lang
                        )}{' '}
                        {isBn ? 'শতক' : 'Dec'}
                      </span>
                    </div>

                    {dags.length > 1 && (
                      <button
                        onClick={() => handleRemoveDag(dag.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title={isBn ? 'মুছুন' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Khatian Land Summary Bar across all Dags */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs pt-1 border-t border-slate-100">
              <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'খতিয়ানের মোট শতক' : 'Total Decimals'}</span>
                <span className="text-sm font-black text-emerald-950">
                  {formatNumberByLang(analysisResult.totalKhatianDecimal, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'খতিয়ানের মোট কাঠা' : 'Total Katha'}</span>
                <span className="text-sm font-black text-blue-900">
                  {formatNumberByLang(analysisResult.totalKhatianKatha, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'খতিয়ানের মোট বিঘা' : 'Total Bigha'}</span>
                <span className="text-sm font-black text-amber-900">
                  {formatNumberByLang(analysisResult.totalKhatianBigha, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'খতিয়ানের মোট একর' : 'Total Acre'}</span>
                <span className="text-sm font-black text-purple-900">
                  {formatNumberByLang(analysisResult.totalKhatianAcre, lang)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'মোট বর্গফুট' : 'Total Sq Ft'}</span>
                <span className="text-sm font-black text-slate-800">
                  {formatNumberByLang(analysisResult.totalKhatianSqFt, lang)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Owner Management & Share Allocation */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-800" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {isBn ? '৩. অংশীদার/মালিকগণের তালিকা ও হিস্যা নির্ধারণ' : '3. Owners & Share Allocation'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isBn
                      ? 'মালিকের নাম, পিতা/স্বামীর নাম, হিস্যা (শতাংশ/ভগ্নাংশ) ও প্রযোজ্য দাগ নির্দিষ্ট করুন'
                      : 'Specify owner name, father/husband name, share fraction or percentage, and assigned dags'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {analysisResult.excessPercent > 0 && (
                  <button
                    onClick={handleAutoBalance}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition active:scale-95"
                  >
                    {isBn ? '১০০% স্বয়ংক্রিয় সমন্বয়' : 'Auto Balance'}
                  </button>
                )}

                <button
                  id="khatian-add-owner-btn"
                  onClick={handleAddOwner}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition active:scale-95 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'অংশীদার যোগ' : 'Add Owner'}</span>
                </button>
              </div>
            </div>

            {/* Inconsistency Banners */}
            {analysisResult.inconsistencies.length > 0 && (
              <div className="space-y-2">
                {analysisResult.inconsistencies.map((err) => (
                  <div
                    key={err.id}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      err.type === 'danger'
                        ? 'bg-red-50 border-red-200 text-red-950'
                        : err.type === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-blue-50 border-blue-200 text-blue-950'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        err.type === 'danger'
                          ? 'text-red-600'
                          : err.type === 'warning'
                          ? 'text-amber-600'
                          : 'text-blue-600'
                      }`}
                    />
                    <div>
                      <span className="font-bold block">
                        {isBn ? err.titleBn : err.titleEn}
                      </span>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        {isBn ? err.messageBn : err.messageEn}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Owner Rows */}
            <div className="space-y-3.5">
              {analysisResult.owners.map((owner, idx) => {
                const rawOwner = owners.find((o) => o.id === owner.id);

                return (
                  <div
                    key={owner.id}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3 hover:border-emerald-300 transition"
                  >
                    {/* Top: Index, Name, Father's Name, Delete */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {formatNumberByLang(idx + 1, lang)}
                        </span>
                        <input
                          type="text"
                          value={rawOwner?.name || owner.name}
                          onChange={(e) => handleUpdateOwner(owner.id, { name: e.target.value })}
                          placeholder={isBn ? 'মালিক / ওয়ারিশের নাম' : 'Owner Name'}
                          className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                        <input
                          type="text"
                          value={rawOwner?.relationOrFather || ''}
                          onChange={(e) =>
                            handleUpdateOwner(owner.id, { relationOrFather: e.target.value })
                          }
                          placeholder={isBn ? 'পিতা/স্বামীর নাম' : 'Father/Husband Name'}
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

                    {/* Middle: Share Configuration & Dag Assignment */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200">
                      {/* Share Type & Input */}
                      <div className="sm:col-span-6 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          {isBn ? 'হিস্যা নির্ধারণ:' : 'Share:'}
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
                          <button
                            type="button"
                            onClick={() => handleUpdateOwner(owner.id, { shareType: 'manual_land' })}
                            className={`px-2 py-0.5 rounded-md transition ${
                              rawOwner?.shareType === 'manual_land'
                                ? 'bg-white text-emerald-950 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {isBn ? 'জমি' : 'Land'}
                          </button>
                        </div>

                        {/* Input Value */}
                        {rawOwner?.shareType === 'percent' && (
                          <div className="relative w-28">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={rawOwner?.percentStr || ''}
                              onChange={(e) =>
                                handleUpdateOwner(owner.id, { percentStr: e.target.value })
                              }
                              placeholder="0"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-black text-slate-900 text-right pr-5"
                            />
                            <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 top-2" />
                          </div>
                        )}

                        {rawOwner?.shareType === 'fraction' && (
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

                        {rawOwner?.shareType === 'manual_land' && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={rawOwner?.manualLandStr || ''}
                              onChange={(e) =>
                                handleUpdateOwner(owner.id, { manualLandStr: e.target.value })
                              }
                              placeholder="0"
                              className="w-20 px-2 py-1 rounded border border-slate-300 text-xs font-black text-right"
                            />
                            <select
                              value={rawOwner?.manualUnit || 'decimal'}
                              onChange={(e) =>
                                handleUpdateOwner(owner.id, { manualUnit: e.target.value as LandAreaUnit })
                              }
                              className="px-1 py-1 rounded border border-slate-300 text-[11px] font-bold"
                            >
                              <option value="decimal">{isBn ? 'শতক' : 'Dec'}</option>
                              <option value="katha">{isBn ? 'কাঠা' : 'Katha'}</option>
                              <option value="bigha">{isBn ? 'বিঘা' : 'Bigha'}</option>
                              <option value="acre">{isBn ? 'একর' : 'Acre'}</option>
                              <option value="sqFt">{isBn ? 'বর্গফুট' : 'Sq Ft'}</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Dag Assignment Selector */}
                      <div className="sm:col-span-6 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          {isBn ? 'প্রযোজ্য দাগ:' : 'Assigned Dags:'}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleToggleOwnerDag(owner.id, 'all')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                              rawOwner?.assignedDagIds.includes('all') ||
                              rawOwner?.assignedDagIds.length === 0
                                ? 'bg-emerald-900 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isBn ? 'সকল দাগ' : 'All Dags'}
                          </button>

                          {dags.map((d) => {
                            const isSelected =
                              rawOwner?.assignedDagIds.includes('all') ||
                              rawOwner?.assignedDagIds.includes(d.id);

                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => handleToggleOwnerDag(owner.id, d.id)}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                                  isSelected
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                দাগ {d.dagNo}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Calculated Land Area Breakdown across assigned dags */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-center text-xs pt-1 border-t border-slate-200/60">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'হিস্যা' : 'Share'}</span>
                        <span className="font-bold text-emerald-900">{owner.shareDisplayStr}</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'শতাংশ/শতক' : 'Decimal'}</span>
                        <span className="font-black text-slate-950">
                          {formatNumberByLang(owner.totalDecimal, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'কাঠা' : 'Katha'}</span>
                        <span className="font-bold text-slate-900">
                          {formatNumberByLang(owner.totalKatha, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'বিঘা' : 'Bigha'}</span>
                        <span className="font-bold text-slate-900">
                          {formatNumberByLang(owner.totalBigha, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'একর' : 'Acre'}</span>
                        <span className="font-bold text-purple-900">
                          {formatNumberByLang(owner.totalAcre, lang)}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-500 font-semibold block">{isBn ? 'বর্গফুট' : 'Sq Ft'}</span>
                        <span className="font-bold text-slate-900">
                          {formatNumberByLang(owner.totalSqFt, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Per-dag breakdown if multiple dags */}
                    {owner.dagBreakdown.length > 1 && (
                      <div className="p-2 rounded-lg bg-slate-100/70 text-[11px] text-slate-700 flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{isBn ? 'দাগভিত্তিক অংশ:' : 'Dag Breakdown:'}</span>
                        {owner.dagBreakdown.map((b) => (
                          <span key={b.dagId} className="px-2 py-0.5 rounded bg-white border border-slate-200">
                            দাগ {b.dagNo}: <strong className="text-slate-900">{formatNumberByLang(b.decimal, lang)} শতক</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total Allocated Progress & Balance */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">
                  {isBn ? 'খতিয়ানের মোট বণ্টিত জমি:' : 'Total Allocated Land:'}{' '}
                  {formatNumberByLang(analysisResult.totalAllocatedDecimal, lang)} {isBn ? 'শতক' : 'Dec'} (
                  {formatNumberByLang(roundClean(analysisResult.totalAllocatedPercent, 2), lang)}%)
                </span>
                <span
                  className={
                    analysisResult.isOverAllocated
                      ? 'text-red-600 font-black'
                      : analysisResult.isFullyBalanced
                      ? 'text-emerald-700 font-black'
                      : 'text-amber-600 font-semibold'
                  }
                >
                  {analysisResult.isOverAllocated
                    ? isBn
                      ? 'অতিরিক্ত জমি বণ্টন!'
                      : 'Over-allocated!'
                    : analysisResult.isFullyBalanced
                    ? isBn
                      ? '১০০% সম্পূর্ণ বণ্টন'
                      : '100% Fully Distributed'
                    : isBn
                    ? `বাকি: ${formatNumberByLang(analysisResult.remainingDecimal, lang)} শতক (${formatNumberByLang(analysisResult.remainingPercent, lang)}%)`
                    : `Remaining: ${analysisResult.remainingDecimal} Dec (${analysisResult.remainingPercent}%)`}
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    analysisResult.isOverAllocated
                      ? 'bg-red-500'
                      : analysisResult.isFullyBalanced
                      ? 'bg-emerald-600'
                      : 'bg-emerald-800'
                  }`}
                  style={{ width: `${Math.min(100, analysisResult.totalAllocatedPercent)}%` }}
                />
              </div>
            </div>

            {/* Remaining Balance Details Card */}
            {analysisResult.remainingDecimal > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-amber-950 block">
                    {isBn ? 'অবশিষ্ট অবণ্টিত খতিয়ান জমি:' : 'Remaining Unallocated Land:'}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-amber-900 flex-wrap">
                    <span>{formatNumberByLang(analysisResult.remainingDecimal, lang)} {isBn ? 'শতক' : 'Dec'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(analysisResult.remainingKatha, lang)} {isBn ? 'কাঠা' : 'Katha'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(analysisResult.remainingBigha, lang)} {isBn ? 'বিঘা' : 'Bigha'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(analysisResult.remainingAcre, lang)} {isBn ? 'একর' : 'Acre'}</span>
                    <span>•</span>
                    <span>{formatNumberByLang(analysisResult.remainingSqFt, lang)} {isBn ? 'বর্গফুট' : 'sq ft'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddRemainderOwner}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition active:scale-95 shrink-0 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'অবশিষ্ট জমি দিয়ে নতুন অংশীদার' : 'Add Remainder Owner'}</span>
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
                  disabled={analysisResult.totalKhatianSqFt <= 0 || analysisResult.isOverAllocated}
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

          {/* Section 4: Tabular Analysis (Owner-wise vs Dag-wise) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-800" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {isBn ? '৪. বিশ্লেষণমূলক সারণি' : '4. Analytical Schedules'}
                </h4>
              </div>

              {/* Sub-tab: Owners Table vs Dag Table */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setTableTab('owners')}
                  className={`px-3 py-1 rounded-lg transition ${
                    tableTab === 'owners'
                      ? 'bg-white text-emerald-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isBn ? 'মালিকভিত্তিক সারণি' : 'Owner-wise Table'}
                </button>
                <button
                  onClick={() => setTableTab('dags')}
                  className={`px-3 py-1 rounded-lg transition ${
                    tableTab === 'dags'
                      ? 'bg-white text-emerald-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isBn ? 'দাগভিত্তিক সারণি' : 'Dag-wise Table'}
                </button>
              </div>
            </div>

            {/* Owner-wise Table */}
            {tableTab === 'owners' && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5 border-r border-slate-200 text-center w-8">#</th>
                      <th className="p-2.5 border-r border-slate-200">{isBn ? 'মালিকের নাম ও পরিচয়' : 'Owner Name & Father'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-center">{isBn ? 'হিস্যা' : 'Share'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">{isBn ? 'শতাংশ (শতক)' : 'Decimal'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">{isBn ? 'কাঠা' : 'Katha'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">{isBn ? 'বিঘা' : 'Bigha'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">{isBn ? 'বর্গফুট' : 'Sq Ft'}</th>
                      <th className="p-2.5">{isBn ? 'প্রযোজ্য দাগ' : 'Assigned Dags'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analysisResult.owners.map((o, idx) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 border-r border-slate-200 text-center font-bold">{formatNumberByLang(idx + 1, lang)}</td>
                        <td className="p-2.5 border-r border-slate-200">
                          <span className="font-bold text-slate-900 block">{o.name}</span>
                          {o.relationOrFather && <span className="text-[10px] text-slate-500 block">{o.relationOrFather}</span>}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-center font-bold text-emerald-900">
                          {o.shareDisplayStr}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-right font-black text-slate-950">
                          {formatNumberByLang(o.totalDecimal, lang)}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-right font-semibold text-slate-800">
                          {formatNumberByLang(o.totalKatha, lang)}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-right font-semibold text-slate-800">
                          {formatNumberByLang(o.totalBigha, lang)}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-right text-slate-700">
                          {formatNumberByLang(o.totalSqFt, lang)}
                        </td>
                        <td className="p-2.5 text-slate-800 font-medium text-[11px]">
                          {o.assignedDagLabels.join(', ') || (isBn ? 'সকল দাগ' : 'All Dags')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={2} className="p-2.5 border-r border-slate-200 text-right font-black">
                        {isBn ? 'মোট বণ্টিত:' : 'Total Allocated:'}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-black text-emerald-900">
                        {formatNumberByLang(roundClean(analysisResult.totalAllocatedPercent, 2), lang)}%
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right font-black text-slate-950">
                        {formatNumberByLang(analysisResult.totalAllocatedDecimal, lang)}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right">
                        {formatNumberByLang(analysisResult.owners.reduce((s, o) => s + o.totalKatha, 0), lang)}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right">
                        {formatNumberByLang(analysisResult.owners.reduce((s, o) => s + o.totalBigha, 0), lang)}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right">
                        {formatNumberByLang(analysisResult.totalAllocatedSqFt, lang)}
                      </td>
                      <td className="p-2.5 text-[11px] font-medium text-slate-500">
                        {analysisResult.isFullyBalanced
                          ? isBn ? '১০০% সম্পূর্ণ বণ্টন' : '100% Balanced'
                          : isBn ? `অবশিষ্ট: ${formatNumberByLang(analysisResult.remainingDecimal, lang)} শতক` : `Remainder: ${analysisResult.remainingDecimal} Dec`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Dag-wise Table */}
            {tableTab === 'dags' && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5 border-r border-slate-200 text-center w-8">#</th>
                      <th className="p-2.5 border-r border-slate-200">{isBn ? 'দাগ নং' : 'Dag No'}</th>
                      <th className="p-2.5 border-r border-slate-200">{isBn ? 'জমির শ্রেণি' : 'Class'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">{isBn ? 'মোট শতক' : 'Total Dec'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">{isBn ? 'বণ্টিত শতক' : 'Allocated Dec'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">{isBn ? 'অবশিষ্ট শতক' : 'Remaining Dec'}</th>
                      <th className="p-2.5 border-r border-slate-200 text-center">{isBn ? 'বণ্টন অবস্থা' : 'Status'}</th>
                      <th className="p-2.5">{isBn ? 'অংশীদারগণ' : 'Owners'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analysisResult.dags.map((d, idx) => {
                      const associatedOwners = analysisResult.owners.filter(
                        (o) => o.assignedDagIds.includes('all') || o.assignedDagIds.includes(d.id)
                      );

                      return (
                        <tr key={d.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 border-r border-slate-200 text-center font-bold">{formatNumberByLang(idx + 1, lang)}</td>
                          <td className="p-2.5 border-r border-slate-200 font-black text-slate-900">{d.dagNo}</td>
                          <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-700">{d.landClass}</td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-black text-slate-900">{formatNumberByLang(d.decimal, lang)}</td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-bold text-emerald-900">{formatNumberByLang(d.allocatedDecimal, lang)}</td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-semibold text-slate-600">{formatNumberByLang(d.remainingDecimal, lang)}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center">
                            {d.isOverAllocated ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-black">
                                {isBn ? 'অতিরিক্ত' : 'Exceeded'}
                              </span>
                            ) : d.remainingDecimal === 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                {isBn ? 'সম্পূর্ণ' : 'Complete'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                {isBn ? 'অবশিষ্ট আছে' : 'Remainder'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-800 text-[11px]">
                            {associatedOwners.map((o) => o.name).join(', ') || (isBn ? 'কেউ নেই' : 'None')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* A4 REPORT PREVIEW MODE */}
      {viewMode === 'report' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-800" />
              <span>{isBn ? 'A4 প্রফেশনাল খতিয়ান রিপোর্ট ভিউ' : 'A4 Khatian Report Preview'}</span>
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
            {/* Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
                {isBn ? 'ভূমি রেকর্ড ও জরিপ প্রস্তুতকারী খতিয়ান বিশ্লেষণ' : 'Land Record & Survey Khatian Analysis'}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
                {isBn ? 'ডিজিটাল খতিয়ান বিশ্লেষণ ও মালিকানা খসড়া প্রতিবেদন' : 'Digital Khatian Analysis & Ownership Draft Report'}
              </h2>
              <div className="inline-block px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider mt-1">
                {isBn ? 'ডিজিটাল বিশ্লেষণ / ব্যবহারকারী প্রদত্ত তথ্য ভিত্তিক' : 'DIGITAL ANALYSIS / USER-PROVIDED DATA'}
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                {isBn ? 'প্রতিবেদন তারিখ:' : 'Report Date:'} {reportA4.generatedAt}
              </p>
            </div>

            {/* Khatian Details Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                {isBn ? '১. খতিয়ান পরিচিতি (Khatian Identification)' : '1. Khatian Identification'}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'খতিয়ান নং' : 'Khatian No.'}</span>
                  <span className="font-black text-slate-950">{metadata.khatianNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'খতিয়ানের ধরন' : 'Survey Type'}</span>
                  <span className="font-bold text-slate-900">{metadata.khatianType} {isBn ? 'জরিপ' : 'Survey'}</span>
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
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'ইউনিয়ন' : 'Union'}</span>
                  <span className="font-bold text-slate-900">{metadata.union || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'উপজেলা / থানা' : 'Upazila'}</span>
                  <span className="font-bold text-slate-900">{metadata.upazila || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'জেলা' : 'District'}</span>
                  <span className="font-bold text-slate-900">{metadata.district || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">{isBn ? 'মোট দাগ সংখ্যা' : 'Total Dags'}</span>
                  <span className="font-bold text-slate-900">{formatNumberByLang(dags.length, lang)} {isBn ? 'টি' : ''}</span>
                </div>
              </div>

              {/* Total Land Summary */}
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-emerald-950">
                  {isBn ? 'খতিয়ানের মোট রেকর্ডকৃত জমি:' : 'Total Khatian Land:'}{' '}
                  {formatNumberByLang(analysisResult.totalKhatianDecimal, lang)} {isBn ? 'শতক / শতাংশ' : 'Decimals'}
                </span>
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-[11px]">
                  <span>{formatNumberByLang(analysisResult.totalKhatianKatha, lang)} {isBn ? 'কাঠা' : 'Katha'}</span>
                  <span>•</span>
                  <span>{formatNumberByLang(analysisResult.totalKhatianBigha, lang)} {isBn ? 'বিঘা' : 'Bigha'}</span>
                  <span>•</span>
                  <span>{formatNumberByLang(analysisResult.totalKhatianAcre, lang)} {isBn ? 'একর' : 'Acre'}</span>
                  <span>•</span>
                  <span>{formatNumberByLang(analysisResult.totalKhatianSqFt, lang)} {isBn ? 'বর্গফুট' : 'sq ft'}</span>
                </div>
              </div>
            </div>

            {/* Dags Schedule */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                {isBn ? '২. দাগভিত্তিক জমির পরিমাপ ও বণ্টন বিবরণী' : '2. Dag-wise Land & Partition Schedule'}
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2 border-r border-slate-200 text-center w-8">#</th>
                      <th className="p-2 border-r border-slate-200">{isBn ? 'দাগ নং' : 'Dag No'}</th>
                      <th className="p-2 border-r border-slate-200">{isBn ? 'শ্রেণি' : 'Class'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'মোট শতক' : 'Total Dec'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'কাঠা' : 'Katha'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'বর্গফুট' : 'Sq Ft'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'বণ্টিত শতক' : 'Allocated Dec'}</th>
                      <th className="p-2">{isBn ? 'অবশিষ্ট শতক' : 'Remaining Dec'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analysisResult.dags.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-slate-50/50">
                        <td className="p-2 border-r border-slate-200 text-center font-bold">{formatNumberByLang(idx + 1, lang)}</td>
                        <td className="p-2 border-r border-slate-200 font-black text-slate-900">{d.dagNo}</td>
                        <td className="p-2 border-r border-slate-200 text-slate-700">{d.landClass}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-black text-slate-950">{formatNumberByLang(d.decimal, lang)}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-semibold text-slate-800">{formatNumberByLang(d.katha, lang)}</td>
                        <td className="p-2 border-r border-slate-200 text-right text-slate-700">{formatNumberByLang(d.sqFt, lang)}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-bold text-emerald-900">{formatNumberByLang(d.allocatedDecimal, lang)}</td>
                        <td className="p-2 text-slate-800">{formatNumberByLang(d.remainingDecimal, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Owners Schedule */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                {isBn ? '৩. অংশীদারগণের মালিকানা ও হিস্যা বিবরণী' : '3. Ownership & Share Allocation Schedule'}
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2 border-r border-slate-200 text-center w-8">#</th>
                      <th className="p-2 border-r border-slate-200">{isBn ? 'মালিকের নাম ও পিতা/স্বামী' : 'Owner / Heir Details'}</th>
                      <th className="p-2 border-r border-slate-200 text-center">{isBn ? 'হিস্যা' : 'Share'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'শতাংশ (শতক)' : 'Decimal'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'কাঠা' : 'Katha'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'বিঘা' : 'Bigha'}</th>
                      <th className="p-2 border-r border-slate-200 text-right">{isBn ? 'বর্গফুট' : 'Sq Ft'}</th>
                      <th className="p-2">{isBn ? 'সংশ্লিষ্ট দাগ' : 'Assigned Dags'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analysisResult.owners.map((o, idx) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="p-2 border-r border-slate-200 text-center font-bold">{formatNumberByLang(idx + 1, lang)}</td>
                        <td className="p-2 border-r border-slate-200">
                          <span className="font-bold text-slate-900 block">{o.name}</span>
                          {o.relationOrFather && <span className="text-[10px] text-slate-500 block">{o.relationOrFather}</span>}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold text-emerald-900">{o.shareDisplayStr}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-black text-slate-950">{formatNumberByLang(o.totalDecimal, lang)}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-semibold text-slate-800">{formatNumberByLang(o.totalKatha, lang)}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-semibold text-slate-800">{formatNumberByLang(o.totalBigha, lang)}</td>
                        <td className="p-2 border-r border-slate-200 text-right text-slate-700">{formatNumberByLang(o.totalSqFt, lang)}</td>
                        <td className="p-2 text-slate-800 font-medium text-[11px]">{o.assignedDagLabels.join(', ') || (isBn ? 'সকল দাগ' : 'All Dags')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={2} className="p-2 border-r border-slate-200 text-right font-black">
                        {isBn ? 'মোট বণ্টিত:' : 'Total Allocated:'}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-black text-emerald-900">
                        {formatNumberByLang(roundClean(analysisResult.totalAllocatedPercent, 2), lang)}%
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-black text-slate-950">
                        {formatNumberByLang(analysisResult.totalAllocatedDecimal, lang)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right">
                        {formatNumberByLang(analysisResult.owners.reduce((s, o) => s + o.totalKatha, 0), lang)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right">
                        {formatNumberByLang(analysisResult.owners.reduce((s, o) => s + o.totalBigha, 0), lang)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right">
                        {formatNumberByLang(analysisResult.totalAllocatedSqFt, lang)}
                      </td>
                      <td className="p-2 text-[11px] font-medium text-slate-500">
                        {analysisResult.isFullyBalanced
                          ? isBn ? '১০০% সম্পূর্ণ বণ্টন' : '100% Balanced'
                          : isBn ? `অবশিষ্ট: ${formatNumberByLang(analysisResult.remainingDecimal, lang)} শতক` : `Remainder: ${analysisResult.remainingDecimal} Dec`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Inconsistencies & Remarks */}
            {metadata.notes && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block mb-0.5">{isBn ? 'বিশেষ মন্তব্য / পর্যবেক্ষণ:' : 'Remarks & Observations:'}</span>
                <p className="text-slate-700 leading-relaxed">{metadata.notes}</p>
              </div>
            )}

            {/* Signatures Slot */}
            <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
              <div className="space-y-1">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <span className="font-bold text-slate-800 block">{isBn ? 'অংশীদারগণের স্বাক্ষর' : 'Owners Signatures'}</span>
                <span className="text-[10px] text-slate-400">{isBn ? '(ওয়ারিশ / স্বত্বাধিকারী)' : '(Owners / Heirs)'}</span>
              </div>
              <div className="space-y-1">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <span className="font-bold text-slate-800 block">{isBn ? 'সাক্ষীগণের স্বাক্ষর' : 'Witness Signatures'}</span>
                <span className="text-[10px] text-slate-400">{isBn ? '(স্থানীয় গণ্যমান্য ব্যক্তি)' : '(Local Witnesses)'}</span>
              </div>
              <div className="space-y-1">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <span className="font-bold text-slate-800 block">{isBn ? 'বিশ্লেষণকারী আমিনের স্বাক্ষর' : 'Surveyor / Analyst Signature'}</span>
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
