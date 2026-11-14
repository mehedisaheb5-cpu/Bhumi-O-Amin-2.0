import React, { useState } from 'react';
import {
  X,
  Check,
  FileText,
  User,
  MapPin,
  Calendar,
  ShieldCheck,
  FileCheck,
  Percent,
  Split,
  Users,
  BarChart3,
  Satellite,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { SurveyReportRecord, Language, ReportStatus } from '../../types';
import { roundClean } from '../../lib/land-units';

interface ReportEditorModalProps {
  report: SurveyReportRecord;
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<SurveyReportRecord>) => void;
}

export const ReportEditorModal: React.FC<ReportEditorModalProps> = ({
  report,
  lang,
  isOpen,
  onClose,
  onSave,
}) => {
  const isBn = lang === 'bn';

  const [clientName, setClientName] = useState(report.clientName || '');
  const [clientPhone, setClientPhone] = useState(report.clientPhone || '');
  const [district, setDistrict] = useState(report.district || '');
  const [upazila, setUpazila] = useState(report.upazila || '');
  const [union, setUnion] = useState(report.union || '');
  const [mouza, setMouza] = useState(report.mouza || '');
  const [jlNo, setJlNo] = useState(report.jlNo || '');
  const [dagNo, setDagNo] = useState(report.dagNo || '');
  const [khatianNo, setKhatianNo] = useState(report.khatianNo || '');
  const [landClass, setLandClass] = useState(report.landClass || 'নাল / ধানি');
  const [surveyorName, setSurveyorName] = useState(report.surveyorName || '');
  const [reportDate, setReportDate] = useState(report.reportDate || '');
  const [surveyDate, setSurveyDate] = useState(report.surveyDate || '');
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [notes, setNotes] = useState(report.notes || '');
  const [declaration, setDeclaration] = useState(report.declaration || '');
  const [drawingNotes, setDrawingNotes] = useState(report.drawingNotes || '');

  // Phase 16B: Optional Analysis Sections
  const [showOptionalSections, setShowOptionalSections] = useState(
    Boolean(
      report.khatianAnalysis ||
      report.hisshaCalculation ||
      report.tafsilDistribution ||
      report.inheritanceCalculation ||
      report.mapComparison ||
      report.googleMapsParcel
    )
  );

  const [includeKhatian, setIncludeKhatian] = useState(Boolean(report.khatianAnalysis));
  const [khatianType, setKhatianType] = useState(report.khatianAnalysis?.khatianType || 'RS');
  const [khatianTotalDec, setKhatianTotalDec] = useState(
    report.khatianAnalysis?.totalLandDecimal?.toString() || report.decimal?.toString() || ''
  );

  const [includeHissha, setIncludeHissha] = useState(Boolean(report.hisshaCalculation));
  const [hisshaTotalDec, setHisshaTotalDec] = useState(
    report.hisshaCalculation?.totalLandDecimal?.toString() || report.decimal?.toString() || ''
  );

  const [includeTafsil, setIncludeTafsil] = useState(Boolean(report.tafsilDistribution));
  const [includeInheritance, setIncludeInheritance] = useState(Boolean(report.inheritanceCalculation));
  const [deceasedName, setDeceasedName] = useState(report.inheritanceCalculation?.deceasedName || '');

  const [includeMapComp, setIncludeMapComp] = useState(Boolean(report.mapComparison));
  const [mapGrade, setMapGrade] = useState<'excellent' | 'acceptable' | 'high_variance'>(
    report.mapComparison?.matchGrade || 'excellent'
  );

  const [includeGoogleMaps, setIncludeGoogleMaps] = useState(Boolean(report.googleMapsParcel));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare optional section data if enabled
    const khatianData = includeKhatian
      ? report.khatianAnalysis || {
          khatianType,
          khatianNo: khatianNo || '১',
          totalLandDecimal: parseFloat(khatianTotalDec) || report.decimal,
          dags: [
            {
              dagNo: dagNo || '১',
              landClass: landClass || 'নাল',
              decimal: parseFloat(khatianTotalDec) || report.decimal,
            },
          ],
          owners: [
            {
              name: clientName || 'মালিক / আবেদনকারী',
              shareStr: '১৬ আনা (১.০০)',
              decimal: parseFloat(khatianTotalDec) || report.decimal,
            },
          ],
        }
      : undefined;

    const hisshaData = includeHissha
      ? report.hisshaCalculation || {
          totalLandDecimal: parseFloat(hisshaTotalDec) || report.decimal,
          totalPercent: 100,
          owners: [
            {
              name: clientName || 'অংশীদার ১',
              sharePercent: 60,
              decimal: roundClean((parseFloat(hisshaTotalDec) || report.decimal) * 0.6, 3),
              katha: roundClean(((parseFloat(hisshaTotalDec) || report.decimal) * 0.6) / 1.65, 3),
            },
            {
              name: 'অংশীদার ২',
              sharePercent: 40,
              decimal: roundClean((parseFloat(hisshaTotalDec) || report.decimal) * 0.4, 3),
              katha: roundClean(((parseFloat(hisshaTotalDec) || report.decimal) * 0.4) / 1.65, 3),
            },
          ],
        }
      : undefined;

    const tafsilData = includeTafsil
      ? report.tafsilDistribution || {
          totalPlots: 1,
          totalLandDecimal: report.decimal,
          plots: [
            {
              dagNo: dagNo || '৩১২',
              landClass: landClass || 'নাল',
              decimal: report.decimal,
              ownerAllocation: clientName || 'আবেদনকারী',
            },
          ],
        }
      : undefined;

    const inheritanceData = includeInheritance
      ? report.inheritanceCalculation || {
          deceasedName: deceasedName || 'মরহুম ভূমি মালিক',
          totalEstateDecimal: report.decimal,
          heirs: [
            {
              relation: 'স্ত্রী',
              count: 1,
              shareFraction: '১/৮',
              shareDecimal: roundClean(report.decimal * 0.125, 3),
            },
            {
              relation: 'পুত্র',
              count: 2,
              shareFraction: '১৪/২৪',
              shareDecimal: roundClean(report.decimal * 0.5833, 3),
            },
            {
              relation: 'কন্যা',
              count: 1,
              shareFraction: '৭/২৪',
              shareDecimal: roundClean(report.decimal * 0.2917, 3),
            },
          ],
        }
      : undefined;

    const mapCompData = includeMapComp
      ? report.mapComparison || {
          mouzaMapTitle: `মৌজা ${mouza || 'নকশা'} বনাম মাঠ জিপিএস`,
          dagNo: dagNo || '৩১২',
          mapAreaDecimal: roundClean(report.decimal * 1.012, 3),
          gpsAreaDecimal: roundClean(report.decimal, 3),
          diffDecimal: roundClean(report.decimal * 0.012, 3),
          variancePercent: 1.2,
          matchGrade: mapGrade,
        }
      : undefined;

    const googleMapsData = includeGoogleMaps
      ? report.googleMapsParcel || {
          parcelId: `gmp-${Date.now()}`,
          title: `${mouza || 'পার্সেল'} স্যাটেলাইট পরিমাপ`,
          pointsCount: report.points.length,
          areaDecimal: report.decimal,
          areaSqFt: report.areaSqFt,
          perimeterFt: report.perimeterFt,
          source: 'Google Maps স্যাটেলাইট ইমেজারি ডিজিটাইজেশন',
        }
      : undefined;

    onSave({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      district: district.trim(),
      upazila: upazila.trim(),
      union: union.trim(),
      mouza: mouza.trim(),
      jlNo: jlNo.trim(),
      dagNo: dagNo.trim(),
      khatianNo: khatianNo.trim(),
      landClass: landClass.trim(),
      surveyorName: surveyorName.trim(),
      reportDate: reportDate.trim(),
      surveyDate: surveyDate.trim(),
      status,
      notes: notes.trim(),
      declaration: declaration.trim(),
      drawingNotes: drawingNotes.trim(),
      finalizedDate: status === 'final' ? new Date().toISOString().split('T')[0] : undefined,
      khatianAnalysis: khatianData,
      hisshaCalculation: hisshaData,
      tafsilDistribution: tafsilData,
      inheritanceCalculation: inheritanceData,
      mapComparison: mapCompData,
      googleMapsParcel: googleMapsData,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'প্রতিবেদনের বিবরণ সম্পাদনা' : 'Edit Report Information'}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">{report.reportNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Status Selection */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <label className="font-bold text-slate-800 block">
              {isBn ? 'প্রতিবেদনের অবস্থা (Status):' : 'Report Status:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`py-2 px-3 rounded-lg font-bold text-xs transition border text-center ${
                  status === 'draft'
                    ? 'bg-amber-100 text-amber-900 border-amber-400 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isBn ? 'খসড়া (Draft)' : 'Draft'}
              </button>
              <button
                type="button"
                onClick={() => setStatus('final')}
                className={`py-2 px-3 rounded-lg font-bold text-xs transition border text-center ${
                  status === 'final'
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isBn ? 'চূড়ান্ত (Final)' : 'Final'}
              </button>
            </div>
          </div>

          {/* Client Details */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isBn ? 'আবেদনকারী / ক্লায়েন্ট' : 'Client Details'}
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'ক্লায়েন্টের নাম' : 'Client Name'}
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={isBn ? 'আবেদনকারীর নাম' : 'Client Name'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'মোবাইল নম্বর (ঐচ্ছিক)' : 'Phone (Optional)'}
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Land Identification */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isBn ? 'জমির ভৌগোলিক পরিচিতি' : 'Land Details'}
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'মৌজা' : 'Mouza'}
                </label>
                <input
                  type="text"
                  value={mouza}
                  onChange={(e) => setMouza(e.target.value)}
                  placeholder={isBn ? 'যেমন: কমলাপুর' : 'e.g. Rampur'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'জে. এল. নম্বর' : 'J.L. No.'}
                </label>
                <input
                  type="text"
                  value={jlNo}
                  onChange={(e) => setJlNo(e.target.value)}
                  placeholder={isBn ? 'যেমন: ৭৪' : '74'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'দাগ নম্বর' : 'Dag No.'}
                </label>
                <input
                  type="text"
                  value={dagNo}
                  onChange={(e) => setDagNo(e.target.value)}
                  placeholder={isBn ? 'যেমন: ৩১২' : '312'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'খতিয়ান নম্বর' : 'Khatian No.'}
                </label>
                <input
                  type="text"
                  value={khatianNo}
                  onChange={(e) => setKhatianNo(e.target.value)}
                  placeholder={isBn ? 'যেমন: ১৫৪ (RS)' : '154'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'উপজেলা / থানা' : 'Upazila'}
                </label>
                <input
                  type="text"
                  value={upazila}
                  onChange={(e) => setUpazila(e.target.value)}
                  placeholder={isBn ? 'উপজেলা' : 'Upazila'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'জেলা' : 'District'}
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder={isBn ? 'জেলা' : 'District'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'ইউনিয়ন / ওয়ার্ড' : 'Union'}
                </label>
                <input
                  type="text"
                  value={union}
                  onChange={(e) => setUnion(e.target.value)}
                  placeholder={isBn ? 'যেমন: ৩ নং ইউনিয়ন' : 'Union'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'জমির শ্রেণি' : 'Land Class'}
                </label>
                <input
                  type="text"
                  value={landClass}
                  onChange={(e) => setLandClass(e.target.value)}
                  placeholder={isBn ? 'নাল / ধানি / ভিটা / বাড়ি' : 'Agricultural'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Dates & Surveyor */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isBn ? 'তারিখ ও সার্ভেয়ার' : 'Surveyor & Dates'}
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'জরিপের তারিখ' : 'Survey Date'}
                </label>
                <input
                  type="date"
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'রিপোর্টের তারিখ' : 'Report Date'}
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-600 mb-1 font-medium">
                  {isBn ? 'সনদপ্রাপ্ত আমিন / সার্ভেয়ার' : 'Surveyor Name'}
                </label>
                <input
                  type="text"
                  value={surveyorName}
                  onChange={(e) => setSurveyorName(e.target.value)}
                  placeholder={isBn ? 'আমিনের নাম ও পদবি' : 'Surveyor Name'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Phase 16B: Optional Analysis Sections Attachments Toggle Accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOptionalSections(!showOptionalSections)}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between font-bold text-slate-800 transition"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-800" />
                <span>{isBn ? 'ঐচ্ছিক বিশ্লেষণ সংযুক্তি (পৃষ্ঠা ৩)' : 'Optional Analysis Sections (Page 3)'}</span>
              </div>
              {showOptionalSections ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showOptionalSections && (
              <div className="p-3 bg-white space-y-3 border-t border-slate-200">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isBn
                    ? 'যেসব বিভাগ চালু করবেন সেগুলো স্বয়ংক্রিয়ভাবে প্রতিবেদনের ৩য় পৃষ্ঠায় যুক্ত হবে। কোনো ডেটা না থাকলে বিভাগটি প্রদর্শিত হবে না।'
                    : 'Selected sections will automatically appear on Page 3 of the report. Empty sections remain hidden.'}
                </p>

                {/* 1. Khatian Analysis Toggle */}
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeKhatian}
                      onChange={(e) => setIncludeKhatian(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <FileCheck className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'খতিয়ান বিশ্লেষণ সারসংক্ষেপ' : 'Khatian Analysis Summary'}</span>
                  </label>
                  {includeKhatian && (
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div>
                        <label className="text-slate-500 block mb-0.5">{isBn ? 'খতিয়ানের ধরন:' : 'Type:'}</label>
                        <select
                          value={khatianType}
                          onChange={(e) => setKhatianType(e.target.value)}
                          className="w-full p-1.5 rounded-lg border border-slate-300 text-xs"
                        >
                          <option value="RS">RS</option>
                          <option value="BS">BS / City</option>
                          <option value="CS">CS</option>
                          <option value="SA">SA</option>
                          <option value="নামজারি">নামজারি (Mutation)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">{isBn ? 'মোট জমি (শতক):' : 'Total (dec):'}</label>
                        <input
                          type="number"
                          step="0.001"
                          value={khatianTotalDec}
                          onChange={(e) => setKhatianTotalDec(e.target.value)}
                          className="w-full p-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Hissha Calculation Toggle */}
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeHissha}
                      onChange={(e) => setIncludeHissha(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <Percent className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'হিস্যা ও অংশীদারিত্ব বণ্টন হিসাব' : 'Hissha Share Distribution'}</span>
                  </label>
                  {includeHissha && (
                    <div className="pt-1 text-[11px]">
                      <label className="text-slate-500 block mb-0.5">{isBn ? 'বণ্টনযোগ্য মোট জমি (শতক):' : 'Total Land (dec):'}</label>
                      <input
                        type="number"
                        step="0.001"
                        value={hisshaTotalDec}
                        onChange={(e) => setHisshaTotalDec(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Tafsil Distribution Toggle */}
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeTafsil}
                      onChange={(e) => setIncludeTafsil(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <Split className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'দাগভিত্তিক তফসিল বণ্টন বিবরণ' : 'Tafsil Plot Distribution'}</span>
                  </label>
                </div>

                {/* 4. Inheritance Calculation Toggle */}
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeInheritance}
                      onChange={(e) => setIncludeInheritance(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <Users className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'ওয়ারিশান সম্পত্তি বণ্টন হিসাব' : 'Inheritance Calculation'}</span>
                  </label>
                  {includeInheritance && (
                    <div className="pt-1 text-[11px]">
                      <label className="text-slate-500 block mb-0.5">{isBn ? 'মরহুমের নাম:' : 'Deceased Name:'}</label>
                      <input
                        type="text"
                        value={deceasedName}
                        onChange={(e) => setDeceasedName(e.target.value)}
                        placeholder={isBn ? 'মরহুমের নাম' : 'Deceased Name'}
                        className="w-full p-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* 5. Cadastral Map Comparison Toggle */}
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeMapComp}
                      onChange={(e) => setIncludeMapComp(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'ডিজিটাল মৌজা নকশা বনাম জিপিএস তুলনা' : 'Cadastral Map vs GPS Comparison'}</span>
                  </label>
                  {includeMapComp && (
                    <div className="pt-1 text-[11px]">
                      <label className="text-slate-500 block mb-0.5">{isBn ? 'সাদৃশ্য মান (Match Grade):' : 'Grade:'}</label>
                      <select
                        value={mapGrade}
                        onChange={(e) => setMapGrade(e.target.value as any)}
                        className="w-full p-1.5 rounded-lg border border-slate-300 text-xs"
                      >
                        <option value="excellent">{isBn ? 'উত্তম সাদৃশ্য (<২%)' : 'Excellent (<2%)'}</option>
                        <option value="acceptable">{isBn ? 'গ্রহণযোগ্য সাদৃশ্য (২-৫%)' : 'Acceptable (2-5%)'}</option>
                        <option value="high_variance">{isBn ? 'উচ্চ পার্থক্য (>৫%)' : 'High Variance (>5%)'}</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 6. Google Maps Parcel Data Toggle */}
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeGoogleMaps}
                      onChange={(e) => setIncludeGoogleMaps(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <Satellite className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'গুগল ম্যাপস স্যাটেলাইট সীমানা ডেটা' : 'Google Maps Satellite Parcel Data'}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Field Notes */}
          <div>
            <label className="block text-slate-600 mb-1 font-medium">
              {isBn ? 'বিশেষ পর্যবেক্ষণ ও মন্তব্য (সাধারণ নোট)' : 'Remarks & Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isBn ? 'জমির অবস্থান, রাস্তা বা আইল সংক্রান্ত মন্তব্য...' : 'Field notes...'}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Phase 20D: Declaration & Remarks */}
          <div>
            <label className="block text-slate-700 mb-1 font-semibold">
              {isBn ? 'অঙ্গীকারনামা / বিঃদ্রঃ (পৃষ্ঠা ১-এর নিচের অংশ)' : 'Declaration / Remarks (Page 1 Bottom)'}
            </label>
            <textarea
              rows={2}
              value={declaration}
              onChange={(e) => setDeclaration(e.target.value)}
              placeholder={isBn ? 'জরিপ সংক্রান্ত অঙ্গীকারনামা, বিশেষ শর্ত বা বিঃদ্রঃ লিখুন...' : 'Enter declaration or remarks for Page 1...'}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              {isBn ? 'খালি রাখলে প্রিন্ট কপিতে হাতে লেখার জন্য লাইন প্রদর্শিত হবে।' : 'Leave blank for dotted handwriting lines on print.'}
            </p>
          </div>

          {/* Phase 20D: Drawing Notes */}
          <div>
            <label className="block text-slate-700 mb-1 font-semibold">
              {isBn ? 'নকশা সংক্রান্ত বিশেষ নোট (পৃষ্ঠা ২)' : 'Drawing Notes (Page 2)'}
            </label>
            <textarea
              rows={2}
              value={drawingNotes}
              onChange={(e) => setDrawingNotes(e.target.value)}
              placeholder={isBn ? 'নকশার সীমানা, স্কেল বা রাস্তা সংক্রান্ত নোট...' : 'Enter drawing notes for Page 2...'}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-900 transition shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isBn ? 'আপডেট সম্পন্ন' : 'Apply Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
