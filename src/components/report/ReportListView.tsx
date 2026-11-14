import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Trash2,
  Eye,
  Edit3,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  User,
  Ruler,
  PlusCircle,
  FolderOpen,
} from 'lucide-react';
import { SurveyReportRecord, Language } from '../../types';
import { formatNumberByLang, roundClean } from '../../lib/land-units';

interface ReportListViewProps {
  reports: SurveyReportRecord[];
  lang: Language;
  onSelectReport: (report: SurveyReportRecord) => void;
  onEditReport: (report: SurveyReportRecord) => void;
  onDeleteReport: (reportId: string) => void;
  onCreateNewReport: () => void;
}

export const ReportListView: React.FC<ReportListViewProps> = ({
  reports,
  lang,
  onSelectReport,
  onEditReport,
  onDeleteReport,
  onCreateNewReport,
}) => {
  const isBn = lang === 'bn';
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) =>
        r.reportNumber.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.mouza && r.mouza.toLowerCase().includes(q)) ||
        (r.dagNo && r.dagNo.toLowerCase().includes(q)) ||
        (r.khatianNo && r.khatianNo.toLowerCase().includes(q))
    );
  }, [reports, searchQuery]);

  const handleDeleteClick = (report: SurveyReportRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      isBn
        ? `আপনি কি নিশ্চিত '${report.reportNumber}' রিপোর্টটি মুছে ফেলতে চান?\n\n(দ্রষ্টব্য: এটি মূল জিপিএস সার্ভে রেকর্ড মুছে ফেলবে না।)`
        : `Are you sure you want to delete report '${report.reportNumber}'?\n\n(Note: This will not delete the underlying GPS survey.)`
    );
    if (confirmed) {
      onDeleteReport(report.id);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-800 text-white flex items-center justify-center">
            <FileText className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isBn ? 'সংরক্ষিত সার্ভে রিপোর্টসমূহ' : 'Saved Survey Reports'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isBn
                ? `মোট ${formatNumberByLang(reports.length, 'bn')}টি রিপোর্ট সংরক্ষিত আছে`
                : `${reports.length} report(s) stored locally`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'রিপোর্ট নং, ক্লায়েন্ট বা দাগ খুঁজুন...' : 'Search reports...'}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-violet-700 focus:outline-hidden"
            />
          </div>

          <button
            onClick={onCreateNewReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-800 text-white text-xs font-bold hover:bg-violet-900 transition active:scale-95 shadow-xs shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">{isBn ? 'নতুন রিপোর্ট' : 'New Report'}</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {reports.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-800 mx-auto flex items-center justify-center border border-violet-100">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-800">
              {isBn ? 'এখনো কোনো রিপোর্ট তৈরি করা হয়নি' : 'No Saved Reports Yet'}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isBn
                ? 'একটি সংরক্ষিত জিপিএস সার্ভে রেকর্ড নির্বাচন করে পূর্ণাঙ্গ এ৪ সাইজ ডিজিটাল রিপোর্ট তৈরি করুন।'
                : 'Select a saved GPS survey to generate a professional A4 PDF survey report.'}
            </p>
          </div>
          <button
            onClick={onCreateNewReport}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-800 text-white text-xs font-bold hover:bg-violet-900 transition active:scale-95 shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-amber-300" />
            <span>{isBn ? 'রিপোর্ট তৈরি করুন' : 'Create First Report'}</span>
          </button>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
          {isBn
            ? `'${searchQuery}' এর সাথে মিল রেখে কোনো রিপোর্ট পাওয়া যায়নি`
            : `No reports found matching '${searchQuery}'`}
        </div>
      ) : (
        /* Report Cards List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredReports.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectReport(item)}
              className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-violet-400/60 hover:shadow-md transition cursor-pointer space-y-3 group"
            >
              {/* Header Strip */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900">
                      {item.reportNumber}
                    </span>
                    {item.status === 'final' ? (
                      <span className="text-[10px] font-bold text-violet-900 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-violet-700" />
                        <span>{isBn ? 'চূড়ান্ত' : 'Final'}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>{isBn ? 'খসড়া' : 'Draft'}</span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-violet-950 mt-1 line-clamp-1">
                    {item.clientName ? `${item.clientName} এর জমি` : item.title}
                  </h4>
                </div>

                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {isBn ? formatNumberByLang(item.reportDate, 'bn') : item.reportDate}
                  </span>
                </span>
              </div>

              {/* Location & Area Details */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/70">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 block">{isBn ? 'অবস্থান' : 'Location'}:</span>
                  <p className="font-bold text-slate-800 truncate">
                    {item.mouza || '—'} {item.dagNo ? `(দাগ: ${item.dagNo})` : ''}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {item.upazila ? `${item.upazila}, ` : ''}{item.district || ''}
                  </p>
                </div>

                <div className="space-y-0.5 text-right">
                  <span className="text-[10px] text-slate-500 block">{isBn ? 'পরিমাপ' : 'Area'}:</span>
                  <p className="font-black text-violet-950 text-sm">
                    {formatNumberByLang(roundClean(item.decimal, 3), lang)}{' '}
                    <span className="text-xs font-medium">{isBn ? 'শতক' : 'dec'}</span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatNumberByLang(roundClean(item.katha, 3), lang)} {isBn ? 'কাঠা' : 'katha'} •{' '}
                    {formatNumberByLang(item.points.length, lang)} {isBn ? 'পয়েন্ট' : 'pts'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReport(item);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-900 hover:bg-violet-100 font-bold transition text-[11px]"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{isBn ? 'প্রিভিউ ও প্রিন্ট' : 'View & Print'}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditReport(item);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold transition text-[11px]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'সম্পাদনা' : 'Edit'}</span>
                  </button>
                </div>

                <button
                  onClick={(e) => handleDeleteClick(item, e)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                  title={isBn ? 'রিপোর্ট মুছুন' : 'Delete Report'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
