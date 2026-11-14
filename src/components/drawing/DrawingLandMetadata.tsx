import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, User, MapPin, Calendar, Check } from 'lucide-react';
import { Language } from '../../types';
import { LocationSelectionValue } from '../../types/administrative-location';
import { BangladeshLocationSelector } from '../common/BangladeshLocationSelector';

export interface LandSurveyMetadata {
  clientName: string;
  district: string;
  upazila: string;
  union: string;
  mouza: string;
  jlNo: string;
  dagNo: string;
  khatianNo: string;
  surveyDate: string;
  surveyorName: string;
  notes: string;
}

interface DrawingLandMetadataProps {
  metadata: LandSurveyMetadata;
  lang: Language;
  onChange: (updated: Partial<LandSurveyMetadata>) => void;
}

export const DrawingLandMetadata: React.FC<DrawingLandMetadataProps> = ({
  metadata,
  lang,
  onChange,
}) => {
  const isBn = lang === 'bn';
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const locationValue: LocationSelectionValue = {
    districtNameBn: metadata.district,
    upazilaNameBn: metadata.upazila,
    mouzaNameBn: metadata.mouza,
    jlNo: metadata.jlNo,
  };

  const handleLocationChange = (val: LocationSelectionValue) => {
    onChange({
      district: val.districtNameBn || '',
      upazila: val.upazilaNameBn || '',
      mouza: val.mouzaNameBn || '',
      jlNo: val.jlNo || '',
    });
  };

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
      {/* Header with Accordion Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-800" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              {isBn ? 'ভূমি ও জরিপ বিবরণ (সার্ভে তথ্য)' : 'Land & Survey Information'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {metadata.mouza || metadata.dagNo
                ? `${isBn ? 'মৌজা: ' : 'Mouza: '}${metadata.mouza || '—'} | ${isBn ? 'দাগ: ' : 'Dag: '}${metadata.dagNo || '—'}`
                : isBn
                ? 'মৌজা, দাগ, খতিয়ান ও আমিন বিবরণ যোগ করুন'
                : 'Add mouza, dag, khatian & surveyor details'}
            </p>
          </div>
        </div>
        <button className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Editable Metadata Form */}
      {isOpen && (
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* Client Name */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {isBn ? 'গ্রাহক / জমির মালিকের নাম' : 'Client / Landowner Name'}
            </label>
            <input
              type="text"
              value={metadata.clientName}
              onChange={(e) => onChange({ clientName: e.target.value })}
              placeholder={isBn ? 'উদা: মোঃ রফিকুল ইসলাম' : 'e.g. Md. Rafiqul Islam'}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Automated Bangladesh Location Selector */}
          <div className="sm:col-span-2 lg:col-span-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800">
                {isBn ? 'প্রশাসনিক মৌজা নির্বাচন' : 'Administrative Location Selector'}
              </span>
              <span className="text-[10px] text-emerald-800 font-semibold">
                {isBn ? 'স্বয়ংক্রিয় ক্যাসকেড' : 'Auto Cascade'}
              </span>
            </div>
            <BangladeshLocationSelector
              value={locationValue}
              onChange={handleLocationChange}
              lang={lang}
              showJlInput={true}
            />
          </div>

          {/* Union */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {isBn ? 'ইউনিয়ন / ওয়ার্ড' : 'Union / Ward'}
            </label>
            <input
              type="text"
              value={metadata.union}
              onChange={(e) => onChange({ union: e.target.value })}
              placeholder={isBn ? 'উদা: বিরুলিয়া' : 'e.g. Birulia'}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Dag No. */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {isBn ? 'দাগ নম্বর (Dag No.)' : 'Dag No.'}
            </label>
            <input
              type="text"
              value={metadata.dagNo}
              onChange={(e) => onChange({ dagNo: e.target.value })}
              placeholder={isBn ? 'উদা: ৩১২' : 'e.g. 312'}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Khatian No. */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {isBn ? 'খতিয়ান নম্বর (Khatian No.)' : 'Khatian No.'}
            </label>
            <input
              type="text"
              value={metadata.khatianNo}
              onChange={(e) => onChange({ khatianNo: e.target.value })}
              placeholder={isBn ? 'উদা: ১৫৪ (RS / BS)' : 'e.g. 154 (RS / BS)'}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Survey Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {isBn ? 'জরিপের তারিখ (Survey Date)' : 'Survey Date'}
            </label>
            <input
              type="date"
              value={metadata.surveyDate}
              onChange={(e) => onChange({ surveyDate: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Surveyor / Amin Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {isBn ? 'আমিন / সার্ভেয়ারের নাম' : 'Surveyor / Amin'}
            </label>
            <input
              type="text"
              value={metadata.surveyorName}
              onChange={(e) => onChange({ surveyorName: e.target.value })}
              placeholder={isBn ? 'উদা: আমিন নজরুল ইসলাম' : 'e.g. Amin Nazrul Islam'}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {isBn ? 'বিশেষ মন্তব্য / আইলের বিবরণ' : 'Notes & Boundary Description'}
            </label>
            <textarea
              rows={2}
              value={metadata.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder={
                isBn
                  ? 'উদা: উত্তরের সীমানায় প্রতিবেশী রহমত উল্লাহর জমির আইল রয়েছে।...'
                  : 'e.g. North boundary borders Rahmatullah land ridge...'
              }
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
