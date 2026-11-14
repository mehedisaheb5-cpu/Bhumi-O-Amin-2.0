import React from 'react';
import { SavedCalculation } from '../../types';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import { generateShareSummary } from '../../lib/land-calculations';
import { History, Trash2, ArrowUpRight, Copy, Check } from 'lucide-react';

interface CalcHistoryViewProps {
  history: SavedCalculation[];
  lang: 'bn' | 'en';
  onRestore: (item: SavedCalculation) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const CalcHistoryView: React.FC<CalcHistoryViewProps> = ({
  history,
  lang,
  onRestore,
  onDeleteItem,
  onClearAll,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (item: SavedCalculation) => {
    const summary = generateShareSummary(
      item.shape,
      item.inputDescription,
      item.areaSqFt,
      item.perimeterFt,
      lang
    );
    navigator.clipboard.writeText(summary);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div
      id="calculator-history-card"
      className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-800" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {lang === 'bn' ? 'সংরক্ষিত হিসাবের ইতিহাস' : 'Calculation History'}
          </h3>
          {history.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
              {formatNumberByLang(history.length, lang)}
            </span>
          )}
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'সব মুছুন' : 'Clear All'}</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          <p>{lang === 'bn' ? 'এখনো কোনো হিসাব সংরক্ষণ করা হয়নি।' : 'No saved calculations yet.'}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {lang === 'bn'
              ? 'হিসাব সম্পন্ন করে "হিসাব সংরক্ষণ করুন" বাটনে ট্যাপ করুন।'
              : 'Tap "Save Calculation" to record your measurements here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {history.map((item) => {
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-900 text-white text-[10px] font-bold">
                        {lang === 'bn' ? item.shapeNameBn : item.shapeNameEn}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{item.dateStr}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 mt-1">
                      {item.inputDescription}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(item)}
                      title={lang === 'bn' ? 'কপি করুন' : 'Copy'}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 transition"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Restore Button */}
                    <button
                      onClick={() => onRestore(item)}
                      title={lang === 'bn' ? 'ক্যালকুলেটরে ফিরিয়ে আনুন' : 'Load in Calculator'}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete item */}
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Key results pill */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/60 text-[11px]">
                  <span className="font-bold text-emerald-900">
                    {formatNumberByLang(item.shatangsha, lang)} {lang === 'bn' ? 'শতাংশ' : 'Dec'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-blue-900">
                    {formatNumberByLang(item.katha, lang)} {lang === 'bn' ? 'কাঠা' : 'Katha'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-600">
                    {formatNumberByLang(item.areaSqFt, lang)} {lang === 'bn' ? 'বর্গফুট' : 'sq ft'}
                  </span>
                  {item.perimeterFt !== undefined && item.perimeterFt > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">
                        {lang === 'bn' ? 'পরিসীমা:' : 'Perimeter:'}{' '}
                        {formatNumberByLang(roundClean(item.perimeterFt, 1), lang)} ft
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
