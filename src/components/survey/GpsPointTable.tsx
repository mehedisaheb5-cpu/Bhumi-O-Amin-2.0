import React, { useState } from 'react';
import { GpsPoint } from '../../lib/gps-types';
import {
  formatCoordinate,
  formatTime,
  getAccuracyColorClass,
  getAccuracyLevel,
} from '../../lib/gps-utils';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import { MapPin, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GpsPointTableProps {
  points: GpsPoint[];
  lang: 'bn' | 'en';
  onDeletePoint: (id: string) => void;
  onClearAll: () => void;
}

export const GpsPointTable: React.FC<GpsPointTableProps> = ({
  points,
  lang,
  onDeletePoint,
  onClearAll,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div
      id="gps-point-list-card"
      className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-800" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {lang === 'bn' ? 'সংগৃহীত জিপিএস পয়েন্ট' : 'Collected GPS Points'}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
            {formatNumberByLang(points.length, lang)}
          </span>
        </div>

        {points.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'সব পয়েন্ট মুছুন' : 'Clear All'}</span>
          </button>
        )}
      </div>

      {/* Confirmation Modal for Clearing all points */}
      {showClearConfirm && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-2 animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {lang === 'bn' ? 'সব পয়েন্ট মুছে ফেলতে চান?' : 'Clear all points?'}
              </p>
              <p className="text-[11px] text-rose-800 mt-0.5">
                {lang === 'bn'
                  ? 'বর্তমান জরিপের সকল চিহ্নিত জিপিএস পয়েন্ট মুছে যাবে। আপনি কি নিশ্চিত?'
                  : 'All recorded coordinates in this session will be permanently deleted.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              onClick={() => {
                onClearAll();
                setShowClearConfirm(false);
              }}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700"
            >
              {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete All'}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {points.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs space-y-1">
          <p className="font-semibold text-slate-600">
            {lang === 'bn' ? 'এখনো কোনো পয়েন্ট নেওয়া হয়নি।' : 'No GPS points collected yet.'}
          </p>
          <p className="text-[11px] text-slate-400">
            {lang === 'bn'
              ? 'মাঠের সীমানা কোণায় দাঁড়িয়ে "পয়েন্ট নিন" বাটনে ট্যাপ করুন।'
              : 'Stand at a boundary corner and tap "Take Point" to record real coordinates.'}
          </p>
        </div>
      ) : (
        /* Mobile-Friendly Table / List */
        <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
          {points.map((pt, idx) => {
            const accLevel = getAccuracyLevel(pt.accuracy);
            const accClass = getAccuracyColorClass(accLevel);

            return (
              <div
                key={pt.id}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between gap-2"
              >
                {/* Left: Point Label Badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-emerald-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {pt.label}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-mono font-bold text-slate-900 truncate">
                        {formatCoordinate(pt.latitude, 'lat')}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono font-bold text-slate-900 truncate">
                        {formatCoordinate(pt.longitude, 'lng')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[10px]">
                      <span
                        className={`px-1.5 py-0.2 rounded border font-semibold ${accClass}`}
                      >
                        ±{formatNumberByLang(roundClean(pt.accuracy, 1), lang)} m
                      </span>
                      <span className="text-slate-400">{pt.timeStr}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Delete button */}
                <button
                  onClick={() => onDeletePoint(pt.id)}
                  title={lang === 'bn' ? 'পয়েন্ট মুছুন' : 'Delete point'}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0 active:scale-90"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
