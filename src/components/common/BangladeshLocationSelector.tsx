import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  ChevronDown,
  Edit3,
  ListFilter,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
} from 'lucide-react';
import { Language } from '../../types';
import {
  LocationSelectionValue,
  SurveyRecordType,
  MouzaMetadataRecord,
} from '../../types/administrative-location';
import {
  getDivisions,
  getDistricts,
  getUpazilas,
  getUnions,
  getMouzas,
  findDistrictByName,
  findUpazilaByName,
  getDistrictById,
  getDivisionById,
} from '../../lib/mouza-database-service';

export interface BangladeshLocationSelectorProps {
  value: LocationSelectionValue;
  onChange: (val: LocationSelectionValue) => void;
  lang?: Language;
  showUnion?: boolean;
  showSurveyType?: boolean;
  showJlInput?: boolean;
  showSheetNumber?: boolean;
  compact?: boolean;
  disabled?: boolean;
  allowManualEntry?: boolean;
  onAdminImportClick?: () => void;
  className?: string;
}

const ALL_SURVEY_TYPES: { id: SurveyRecordType; labelBn: string; labelEn: string }[] = [
  { id: 'CS', labelBn: 'CS (ক্যাডাস্ট্রাল সার্ভে)', labelEn: 'CS (Cadastral Survey)' },
  { id: 'SA', labelBn: 'SA (স্টেট একুইজিশন)', labelEn: 'SA (State Acquisition)' },
  { id: 'RS', labelBn: 'RS (রিভিশনাল সার্ভে)', labelEn: 'RS (Revisional Survey)' },
  { id: 'BS', labelBn: 'BS (বাংলাদেশ সার্ভে)', labelEn: 'BS (Bangladesh Survey)' },
  { id: 'BRS', labelBn: 'BRS (সিটি/বিআরএস)', labelEn: 'BRS (City/BRS)' },
  { id: 'City', labelBn: 'সিটি জরিপ', labelEn: 'City Survey' },
  { id: 'Diara', labelBn: 'দিয়ারা জরিপ', labelEn: 'Diara Survey' },
  { id: 'Other', labelBn: 'অন্যান্য', labelEn: 'Other' },
];

export const BangladeshLocationSelector: React.FC<BangladeshLocationSelectorProps> = ({
  value,
  onChange,
  lang = 'bn',
  showUnion = false,
  showSurveyType = true,
  showJlInput = true,
  showSheetNumber = false,
  compact = false,
  disabled = false,
  allowManualEntry = true,
  onAdminImportClick,
  className = '',
}) => {
  const isBn = lang === 'bn';
  const [manualMode, setManualMode] = useState<boolean>(Boolean(value.isCustomMouza));

  // Divisions
  const divisions = useMemo(() => getDivisions(), []);

  // Filtered Districts
  const districts = useMemo(() => {
    return getDistricts(value.divisionId);
  }, [value.divisionId]);

  // Filtered Upazilas
  const upazilas = useMemo(() => {
    return getUpazilas(value.districtId);
  }, [value.districtId]);

  // Filtered Unions (if enabled)
  const unions = useMemo(() => {
    return showUnion ? getUnions(value.upazilaId) : [];
  }, [showUnion, value.upazilaId]);

  // Available Mouzas for selected upazila
  const availableMouzas = useMemo(() => {
    if (!value.upazilaId) return [];
    return getMouzas(value.upazilaId, value.surveyType);
  }, [value.upazilaId, value.surveyType]);

  // Backward compatibility: Auto-resolve Division/District/Upazila IDs if only names were provided
  useEffect(() => {
    if (value.districtNameBn && !value.districtId) {
      const matchDist = findDistrictByName(value.districtNameBn);
      if (matchDist) {
        const matchDiv = getDivisionById(matchDist.divisionId);
        const matchUpz = value.upazilaNameBn
          ? findUpazilaByName(matchDist.id, value.upazilaNameBn)
          : undefined;

        onChange({
          ...value,
          districtId: matchDist.id,
          districtNameBn: matchDist.nameBn,
          divisionId: matchDiv?.id,
          divisionNameBn: matchDiv?.nameBn,
          upazilaId: matchUpz?.id || value.upazilaId,
          upazilaNameBn: matchUpz?.nameBn || value.upazilaNameBn,
        });
      }
    }
  }, [value.districtNameBn, value.districtId, value.upazilaNameBn, onChange, value]);

  // Handle Division Change
  const handleDivisionChange = (newDivId: string) => {
    const div = divisions.find((d) => d.id === newDivId);
    // Check if current district is in this division, otherwise reset child selections
    const isDistrictCompatible = districts.some(
      (d) => d.id === value.districtId && d.divisionId === newDivId
    );

    onChange({
      ...value,
      divisionId: newDivId || undefined,
      divisionNameBn: div?.nameBn || '',
      districtId: isDistrictCompatible ? value.districtId : undefined,
      districtNameBn: isDistrictCompatible ? value.districtNameBn : '',
      upazilaId: isDistrictCompatible ? value.upazilaId : undefined,
      upazilaNameBn: isDistrictCompatible ? value.upazilaNameBn : '',
      unionId: undefined,
      unionNameBn: '',
      mouzaNameBn: isDistrictCompatible ? value.mouzaNameBn : '',
      jlNo: isDistrictCompatible ? value.jlNo : '',
      mouzaRecordId: isDistrictCompatible ? value.mouzaRecordId : undefined,
    });
  };

  // Handle District Change
  const handleDistrictChange = (newDistId: string) => {
    const dist = getDistrictById(newDistId);
    const div = dist ? getDivisionById(dist.divisionId) : undefined;

    onChange({
      ...value,
      districtId: newDistId || undefined,
      districtNameBn: dist?.nameBn || '',
      divisionId: div?.id || value.divisionId,
      divisionNameBn: div?.nameBn || value.divisionNameBn,
      upazilaId: undefined, // Reset Upazila on district change
      upazilaNameBn: '',
      unionId: undefined,
      unionNameBn: '',
      mouzaNameBn: '',
      jlNo: '',
      mouzaRecordId: undefined,
    });
  };

  // Handle Upazila Change
  const handleUpazilaChange = (newUpzId: string) => {
    const upz = upazilas.find((u) => u.id === newUpzId);
    onChange({
      ...value,
      upazilaId: newUpzId || undefined,
      upazilaNameBn: upz?.nameBn || '',
      unionId: undefined,
      unionNameBn: '',
      mouzaNameBn: '',
      jlNo: '',
      mouzaRecordId: undefined,
    });
  };

  // Handle Mouza Record Selection
  const handleMouzaSelect = (recId: string) => {
    if (recId === '__custom__') {
      setManualMode(true);
      onChange({
        ...value,
        isCustomMouza: true,
        mouzaRecordId: undefined,
      });
      return;
    }

    const rec = availableMouzas.find((m) => m.id === recId);
    if (rec) {
      onChange({
        ...value,
        mouzaNameBn: rec.mouzaNameBn,
        mouzaNameEn: rec.mouzaNameEn,
        jlNo: rec.jlNo,
        surveyType: rec.surveyType,
        sheetNumber: rec.sheetNumber || value.sheetNumber,
        mouzaRecordId: rec.id,
        isCustomMouza: false,
      });
    } else {
      onChange({
        ...value,
        mouzaRecordId: undefined,
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. Administrative Cascade: Division, District, Upazila */}
      <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'} gap-2.5`}>
        {/* Division */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-800" />
            <span>{isBn ? 'বিভাগ' : 'Division'}</span>
          </label>
          <div className="relative">
            <select
              value={value.divisionId || ''}
              disabled={disabled}
              onChange={(e) => handleDivisionChange(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-300 text-xs font-medium bg-white text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 focus:outline-hidden disabled:bg-slate-100 cursor-pointer appearance-none min-h-[42px]"
            >
              <option value="">{isBn ? '— বিভাগ নির্বাচন করুন —' : '— Select Division —'}</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {isBn ? d.nameBn : d.nameEn}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* District */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>{isBn ? 'জেলা' : 'District'}</span>
            <span className="text-[10px] text-slate-500 font-normal">
              {districts.length} {isBn ? 'টি জেলা' : 'districts'}
            </span>
          </label>
          <div className="relative">
            <select
              value={value.districtId || ''}
              disabled={disabled}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-300 text-xs font-medium bg-white text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 focus:outline-hidden disabled:bg-slate-100 cursor-pointer appearance-none min-h-[42px]"
            >
              <option value="">{isBn ? '— জেলা নির্বাচন করুন —' : '— Select District —'}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {isBn ? d.nameBn : d.nameEn}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Upazila */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>{isBn ? 'উপজেলা / থানা' : 'Upazila / Thana'}</span>
            {value.districtId && (
              <span className="text-[10px] text-slate-500 font-normal">
                {upazilas.length} {isBn ? 'টি থানা' : 'thanas'}
              </span>
            )}
          </label>
          <div className="relative">
            <select
              value={value.upazilaId || ''}
              disabled={disabled || !value.districtId}
              onChange={(e) => handleUpazilaChange(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-300 text-xs font-medium bg-white text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 focus:outline-hidden disabled:bg-slate-100 cursor-pointer appearance-none min-h-[42px]"
            >
              <option value="">
                {!value.districtId
                  ? isBn
                    ? '— আগে জেলা নির্বাচন করুন —'
                    : '— Select District First —'
                  : isBn
                  ? '— উপজেলা নির্বাচন করুন —'
                  : '— Select Upazila —'}
              </option>
              {upazilas.map((u) => (
                <option key={u.id} value={u.id}>
                  {isBn ? u.nameBn : u.nameEn}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Optional Union Cascade */}
      {showUnion && value.upazilaId && unions.length > 0 && (
        <div className="w-full">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isBn ? 'ইউনিয়ন (ঐচ্ছিক)' : 'Union (Optional)'}
          </label>
          <select
            value={value.unionId || ''}
            disabled={disabled}
            onChange={(e) => {
              const u = unions.find((x) => x.id === e.target.value);
              onChange({ ...value, unionId: e.target.value || undefined, unionNameBn: u?.nameBn });
            }}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden min-h-[42px]"
          >
            <option value="">{isBn ? '— ইউনিয়ন নির্বাচন করুন —' : '— Select Union —'}</option>
            {unions.map((u) => (
              <option key={u.id} value={u.id}>
                {isBn ? u.nameBn : u.nameEn}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Survey Type & Mouza & JL Selection */}
      <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-12'} gap-2.5 items-start`}>
        {/* Survey Type */}
        {showSurveyType && (
          <div className={compact ? 'col-span-1' : 'sm:col-span-4'}>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>{isBn ? 'সার্ভে টাইপ / রেকর্ড' : 'Survey Type'}</span>
              <span className="text-[10px] text-emerald-800 font-semibold uppercase">
                {value.surveyType || 'RS'}
              </span>
            </label>
            <select
              value={value.surveyType || 'RS'}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  surveyType: e.target.value as SurveyRecordType,
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden min-h-[42px] cursor-pointer"
            >
              {ALL_SURVEY_TYPES.map((st) => (
                <option key={st.id} value={st.id}>
                  {isBn ? st.labelBn : st.labelEn}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mouza Dropdown / Manual Input */}
        <div className={compact ? 'col-span-1' : showSurveyType ? 'sm:col-span-5' : 'sm:col-span-8'}>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700">
              {isBn ? 'মৌজা' : 'Mouza'}
            </label>
            {allowManualEntry && (
              <button
                type="button"
                onClick={() => {
                  const nextManual = !manualMode;
                  setManualMode(nextManual);
                  onChange({
                    ...value,
                    isCustomMouza: nextManual,
                    mouzaRecordId: nextManual ? undefined : value.mouzaRecordId,
                  });
                }}
                className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>{manualMode ? (isBn ? 'তালিকা থেকে খুঁজুন' : 'Pick from list') : (isBn ? 'সরাসরি লিখুন' : 'Type custom')}</span>
              </button>
            )}
          </div>

          {!manualMode ? (
            <div className="relative">
              <select
                value={value.mouzaRecordId || ''}
                disabled={disabled || !value.upazilaId}
                onChange={(e) => handleMouzaSelect(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-300 text-xs font-medium bg-white text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 focus:outline-hidden disabled:bg-slate-100 cursor-pointer appearance-none min-h-[42px]"
              >
                <option value="">
                  {!value.upazilaId
                    ? isBn
                      ? '— আগে উপজেলা নির্বাচন করুন —'
                      : '— Select Upazila First —'
                    : availableMouzas.length === 0
                    ? isBn
                      ? '— কোনো ডেটাসেট নেই (সরাসরি লিখুন) —'
                      : '— No Dataset (Type manually) —'
                    : isBn
                    ? '— মৌজা ও জে.এল. নম্বর নির্বাচন করুন —'
                    : '— Select Mouza & JL —'}
                </option>
                {availableMouzas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.mouzaNameBn} (জে.এল. {m.jlNo}) — {m.surveyType}
                    {m.isDemo ? ` [${isBn ? 'নমুনা' : 'Demo'}]` : ''}
                  </option>
                ))}
                {allowManualEntry && (
                  <option value="__custom__">
                    {isBn ? '✍️ তালিকায় নেই? নতুন মৌজা লিখুন...' : '✍️ Not in list? Enter custom...'}
                  </option>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              disabled={disabled}
              value={value.mouzaNameBn || ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  mouzaNameBn: e.target.value,
                  isCustomMouza: true,
                })
              }
              placeholder={isBn ? 'মৌজার নাম লিখুন (উদা: খিলগাঁও)' : 'Enter mouza name'}
              className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/20 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden min-h-[42px]"
            />
          )}
        </div>

        {/* JL Number */}
        {showJlInput && (
          <div className={compact ? 'col-span-1' : 'sm:col-span-3'}>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>{isBn ? 'জে.এল. নং' : 'J.L. No.'}</span>
              {value.jlNo && (
                <span className="text-[10px] text-slate-500 font-normal">
                  JL #{value.jlNo}
                </span>
              )}
            </label>
            <input
              type="text"
              disabled={disabled}
              value={value.jlNo || ''}
              onChange={(e) => onChange({ ...value, jlNo: e.target.value })}
              placeholder={isBn ? 'জে.এল. নং (উদা: ২৮৮)' : 'e.g. 288'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden min-h-[42px]"
            />
          </div>
        )}
      </div>

      {/* Sheet Number (Optional) */}
      {showSheetNumber && (
        <div className="w-full max-w-xs">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isBn ? 'মৌজা নকশা শীট নম্বর' : 'Sheet Number'}
          </label>
          <input
            type="text"
            disabled={disabled}
            value={value.sheetNumber || ''}
            onChange={(e) => onChange({ ...value, sheetNumber: e.target.value })}
            placeholder={isBn ? 'উদা: ০১, ০২' : 'e.g. 01, 02'}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden min-h-[42px]"
          />
        </div>
      )}

      {/* Info notice when dataset is empty or demo */}
      {value.upazilaId && availableMouzas.length === 0 && !manualMode && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px]">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>
              {isBn
                ? `এই উপজেলার (${value.upazilaNameBn || 'নির্বাচিত'}) জন্য বর্তমানে কোনো প্রস্তুতকৃত সরকারি মৌজা ডেটাসেট নেই। আপনি "সরাসরি লিখুন" বাটনে চাপ দিয়ে মৌজার নাম ও জে.এল. লিখতে পারেন।`
                : `No preloaded mouza dataset is available for this upazila. Please use "Type custom" to enter the mouza name and JL number.`}
            </span>
            {onAdminImportClick && (
              <button
                type="button"
                onClick={onAdminImportClick}
                className="block mt-1 font-bold text-emerald-800 hover:underline"
              >
                {isBn ? 'অ্যাডমিন: নতুন মৌজা ডেটাসেট ইমপোর্ট করুন' : 'Admin: Import Mouza Dataset'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
