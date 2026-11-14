import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  Download,
  Trash2,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { Language } from '../../types';
import {
  MouzaImportValidationResult,
  MouzaMetadataRecord,
} from '../../types/administrative-location';
import {
  validateAndImportMouzaData,
  saveImportedMouzas,
  getImportedMouzas,
  clearImportedMouzas,
  getSampleCsvTemplate,
  getSampleJsonTemplate,
} from '../../lib/mouza-database-service';

interface MouzaDataImportModalProps {
  lang?: Language;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const MouzaDataImportModal: React.FC<MouzaDataImportModalProps> = ({
  lang = 'bn',
  onClose,
  onImportComplete,
}) => {
  const isBn = lang === 'bn';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'import' | 'existing'>('import');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<MouzaImportValidationResult | null>(
    null
  );
  const [isSuccessMessage, setIsSuccessMessage] = useState<string | null>(null);

  // Existing records state
  const [existingRecords, setExistingRecords] = useState<MouzaMetadataRecord[]>(() =>
    getImportedMouzas()
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      setFormat('json');
    } else {
      setFormat('csv');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      // Auto run validation
      const res = validateAndImportMouzaData(content, ext === 'json' ? 'json' : 'csv');
      setValidationResult(res);
      setIsSuccessMessage(null);
    };
    reader.readAsText(file);
  };

  const handleValidateClick = () => {
    if (!rawText.trim()) {
      alert(isBn ? 'ফাইল নির্বাচন করুন অথবা টেক্সট পেস্ট করুন' : 'Select a file or paste content');
      return;
    }
    const res = validateAndImportMouzaData(rawText, format);
    setValidationResult(res);
    setIsSuccessMessage(null);
  };

  const handleConfirmImport = () => {
    if (!validationResult || validationResult.records.length === 0) return;

    saveImportedMouzas(validationResult.records);
    setExistingRecords(getImportedMouzas());
    setIsSuccessMessage(
      isBn
        ? `সফলভাবে ${validationResult.records.length}টি মৌজা রেকর্ড ডেটাবেসে যুক্ত হয়েছে!`
        : `Successfully imported ${validationResult.records.length} mouza records!`
    );
    setValidationResult(null);
    setRawText('');
    setFileName(null);
    if (onImportComplete) onImportComplete();
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        isBn
          ? 'আপনি কি নিশ্চিত যে সকল আমদানিকৃত মৌজা রেকর্ড মুছে ফেলতে চান?'
          : 'Are you sure you want to clear all imported mouza records?'
      )
    ) {
      clearImportedMouzas();
      setExistingRecords([]);
      setIsSuccessMessage(
        isBn ? 'সকল আমদানিকৃত রেকর্ড মুছে ফেলা হয়েছে' : 'All imported records cleared'
      );
      if (onImportComplete) onImportComplete();
    }
  };

  const handleDownloadSample = (sampleType: 'csv' | 'json') => {
    const content = sampleType === 'csv' ? getSampleCsvTemplate() : getSampleJsonTemplate();
    const mime = sampleType === 'csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mouza_metadata_template.${sampleType}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-emerald-100/90 text-emerald-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {isBn ? 'মৌজা মেটাডেটা ইমপোর্ট ও ডেটাবেস' : 'Mouza Metadata Import & Database'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'প্রশাসনিক মৌজা ডেটাসেট যুক্ত ও পরিচালনা (CSV / JSON)'
                  : 'Manage administrative mouza dataset (CSV / JSON)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-100 text-xs font-bold">
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-2 border-b-2 transition ${
              activeTab === 'import'
                ? 'border-emerald-800 text-emerald-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {isBn ? 'নতুন ডেটাসেট ইমপোর্ট' : 'Import Dataset'}
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            className={`pb-2.5 px-2 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'existing'
                ? 'border-emerald-800 text-emerald-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span>{isBn ? 'বিদ্যমান আমদানিকৃত মৌজা' : 'Imported Records'}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">
              {existingRecords.length}
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Important Security Notice */}
          <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-[11px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                {isBn ? 'সরকারি তথ্য সততা নির্দেশিকা:' : 'Government Data Integrity Guideline:'}
              </span>
              <span>
                {isBn
                  ? 'বর্তমানে কোনো ভেরিফায়েড সরকারি সোর্স বা গেজেটেড মৌজা রেকর্ড না থাকলে কৃত্রিম বা অনুমানভিত্তিক বাল্ক ডেটা ইমপোর্ট করবেন না। কেবল নির্ভরযোগ্য জরিপ রেকর্ড ও যাচাইকৃত জেএল নম্বর ব্যবহার করুন।'
                  : 'Do not fabricate bulk government data without verified gazetted sources. Only import authenticated land survey records with genuine JL numbers.'}
              </span>
            </div>
          </div>

          {activeTab === 'import' ? (
            <div className="space-y-3.5">
              {/* Format selection and templates */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">{isBn ? 'ফরম্যাট:' : 'Format:'}</span>
                  <label className="flex items-center gap-1 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="mouza_format"
                      checked={format === 'csv'}
                      onChange={() => setFormat('csv')}
                      className="text-emerald-800 focus:ring-emerald-700"
                    />
                    <span>CSV</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-medium ml-2">
                    <input
                      type="radio"
                      name="mouza_format"
                      checked={format === 'json'}
                      onChange={() => setFormat('json')}
                      className="text-emerald-800 focus:ring-emerald-700"
                    />
                    <span>JSON</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    onClick={() => handleDownloadSample('csv')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>নমুনা CSV</span>
                  </button>
                  <button
                    onClick={() => handleDownloadSample('json')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>নমুনা JSON</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40 transition cursor-pointer flex flex-col items-center justify-center text-center space-y-1.5"
              >
                <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-800">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800">
                  {fileName || (isBn ? 'মৌজা ডেটাসেট ফাইল আপলোড করুন' : 'Upload Mouza Dataset File')}
                </div>
                <div className="text-[11px] text-slate-500">
                  {isBn ? '.CSV অথবা .JSON ফাইল নির্বাচন করুন' : 'Select .CSV or .JSON file'}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Textarea for manual paste */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'অথবা সরাসরি পেস্ট করুন:' : 'Or paste content directly:'}
                </label>
                <textarea
                  rows={4}
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    setValidationResult(null);
                  }}
                  placeholder={
                    format === 'csv'
                      ? 'district,upazila,mouza,jlNo,surveyType\nঢাকা,সাভার,সাভার,২৪,RS'
                      : '[\n  {\n    "districtNameBn": "ঢাকা",\n    "upazilaNameBn": "সাভার",\n    "mouzaNameBn": "সাভার",\n    "jlNo": "২৪",\n    "surveyType": "RS"\n  }\n]'
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-[11px] focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              {/* Validation Action */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleValidateClick}
                  disabled={!rawText.trim()}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition disabled:opacity-50"
                >
                  {isBn ? 'যাচাই করুন (Validate)' : 'Validate Records'}
                </button>
              </div>

              {/* Validation Results Display */}
              {validationResult && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-fade-in">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>{isBn ? 'যাচাইয়ের ফলাফল:' : 'Validation Summary:'}</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      মোট সারি: {validationResult.total}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                      <div className="font-extrabold text-sm text-emerald-800">
                        {validationResult.imported}
                      </div>
                      <div className="text-[10px]">{isBn ? 'সঠিক রেকর্ড' : 'Valid'}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                      <div className="font-extrabold text-sm text-amber-800">
                        {validationResult.duplicates}
                      </div>
                      <div className="text-[10px]">{isBn ? 'ডুপ্লিকেট বাদ' : 'Duplicates'}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                      <div className="font-extrabold text-sm text-rose-800">
                        {validationResult.rejected}
                      </div>
                      <div className="text-[10px]">{isBn ? 'ত্রুটিযুক্ত' : 'Rejected'}</div>
                    </div>
                  </div>

                  {validationResult.errors.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-[11px] space-y-1 max-h-32 overflow-y-auto">
                      <span className="font-bold block">
                        {isBn ? 'শনাক্তকৃত ত্রুটিসমূহ:' : 'Identified Errors:'}
                      </span>
                      {validationResult.errors.map((err, idx) => (
                        <div key={idx}>• {err}</div>
                      ))}
                    </div>
                  )}

                  {validationResult.records.length > 0 && (
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isBn
                          ? `${validationResult.records.length}টি রেকর্ড ডেটাবেসে সেভ করুন`
                          : `Confirm & Save ${validationResult.records.length} Records`}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {isSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                  <span>{isSuccessMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* Existing Records Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  {isBn
                    ? `মোট আমদানিকৃত রেকর্ড: ${existingRecords.length}টি`
                    : `Total Imported: ${existingRecords.length}`}
                </span>
                {existingRecords.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'সব মুছুন' : 'Clear All'}</span>
                  </button>
                )}
              </div>

              {existingRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  {isBn
                    ? 'এখনো কোনো অতিরিক্ত মৌজা রেকর্ড আমদানি করা হয়নি।'
                    : 'No imported records found.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  {existingRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-2.5 bg-white hover:bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {rec.mouzaNameBn} (জে.এল. {rec.jlNo})
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {rec.districtNameBn} &gt; {rec.upazilaNameBn} | {rec.surveyType}
                          {rec.sheetNumber ? ` | শীট ${rec.sheetNumber}` : ''}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                        {rec.source}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition text-xs"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
