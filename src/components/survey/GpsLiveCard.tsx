import React from 'react';
import { CurrentGpsPosition, GPSStatus } from '../../lib/gps-types';
import {
  formatCoordinate,
  getAccuracyColorClass,
  getAccuracyLevel,
  getAccuracyText,
  getGpsStatusBadgeClass,
  getGpsStatusText,
} from '../../lib/gps-utils';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import {
  Compass,
  Navigation,
  AlertTriangle,
  Play,
  Square,
  MapPin,
  Radio,
} from 'lucide-react';

interface GpsLiveCardProps {
  gpsStatus: GPSStatus;
  isWatching: boolean;
  currentPos: CurrentGpsPosition | null;
  errorMessage: string | null;
  pointCount: number;
  lang: 'bn' | 'en';
  onStartGps: () => void;
  onStopGps: () => void;
  onTakePoint: () => void;
}

export const GpsLiveCard: React.FC<GpsLiveCardProps> = ({
  gpsStatus,
  isWatching,
  currentPos,
  errorMessage,
  pointCount,
  lang,
  onStartGps,
  onStopGps,
  onTakePoint,
}) => {
  const accuracyLevel = currentPos ? getAccuracyLevel(currentPos.accuracy) : 'unknown';
  const accuracyText = getAccuracyText(accuracyLevel, lang);
  const accuracyColorClass = getAccuracyColorClass(accuracyLevel);
  const statusBadgeClass = getGpsStatusBadgeClass(gpsStatus);
  const statusText = getGpsStatusText(gpsStatus, lang);

  return (
    <div
      id="gps-live-dashboard-card"
      className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4"
    >
      {/* Top row: Status & Live indicator */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isWatching && gpsStatus === 'active'
                ? 'bg-emerald-500 animate-ping'
                : isWatching
                ? 'bg-amber-500 animate-pulse'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {lang === 'bn' ? 'GPS অবস্থান ও সিগন্যাল' : 'Live GPS Signal'}
          </span>
        </div>

        {/* Status Badge */}
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${statusBadgeClass}`}
        >
          {statusText}
        </span>
      </div>

      {/* Main Coordinate Display Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Latitude */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {lang === 'bn' ? 'বর্তমান অক্ষাংশ (Latitude)' : 'Current Latitude'}
          </span>
          <p className="text-base sm:text-lg font-mono font-bold text-slate-900 mt-1 truncate">
            {currentPos ? (
              formatCoordinate(currentPos.latitude, 'lat')
            ) : (
              <span className="text-slate-400 font-sans text-sm font-normal">
                {isWatching
                  ? lang === 'bn'
                    ? 'স্থানাঙ্ক খোঁজা হচ্ছে...'
                    : 'Acquiring...'
                  : '—'}
              </span>
            )}
          </p>
        </div>

        {/* Longitude */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {lang === 'bn' ? 'বর্তমান দ্রাঘিমাংশ (Longitude)' : 'Current Longitude'}
          </span>
          <p className="text-base sm:text-lg font-mono font-bold text-slate-900 mt-1 truncate">
            {currentPos ? (
              formatCoordinate(currentPos.longitude, 'lng')
            ) : (
              <span className="text-slate-400 font-sans text-sm font-normal">
                {isWatching
                  ? lang === 'bn'
                    ? 'স্থানাঙ্ক খোঁজা হচ্ছে...'
                    : 'Acquiring...'
                  : '—'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Accuracy & Point Count Info Bar */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {/* Accuracy */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between ${
            currentPos ? accuracyColorClass : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <span className="text-[11px] font-bold">
            {lang === 'bn' ? 'সঠিকতা (Accuracy)' : 'Accuracy'}
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-black font-mono">
              {currentPos
                ? `±${formatNumberByLang(roundClean(currentPos.accuracy, 1), lang)} m`
                : '—'}
            </span>
            {currentPos && (
              <p className="text-[10px] font-bold mt-0.5">
                {accuracyText}
              </p>
            )}
          </div>
        </div>

        {/* Point Count */}
        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-900">
            {lang === 'bn' ? 'সংগৃহীত পয়েন্ট' : 'Collected Points'}
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-950">
              {formatNumberByLang(pointCount, lang)}
            </span>
            <span className="text-[11px] font-bold text-emerald-800">
              {lang === 'bn' ? 'টি পয়েন্ট' : 'points'}
            </span>
          </div>
        </div>
      </div>

      {/* Poor Accuracy Warning Banner */}
      {currentPos && currentPos.accuracy > 20 && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            {lang === 'bn'
              ? 'সতর্কতা: ফোনের GPS সঠিকতা দুর্বল (>২০ মিটার)। খোলা আকাশের নিচে দাঁড়ান এবং পয়েন্ট নেওয়ার আগে সিগন্যাল উন্নত হওয়া পর্যন্ত অপেক্ষা করুন।'
              : 'Warning: GPS accuracy is poor (>20m). Move outdoors under an open sky and wait for accuracy to improve before capturing points.'}
          </p>
        </div>
      )}

      {/* Error / Denied / Timeout Alert Banner */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">
              {lang === 'bn' ? 'GPS ত্রুটি' : 'GPS Notice'}
            </span>
            <p className="leading-relaxed mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
        {!isWatching ? (
          /* Start GPS Button */
          <button
            id="start-gps-btn"
            onClick={onStartGps}
            className="w-full flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white font-bold text-sm shadow-md transition active:scale-98"
          >
            <Compass className="w-5 h-5 text-amber-400" />
            <span>{lang === 'bn' ? 'GPS দিয়ে মাপ শুরু করুন' : 'Start GPS Measurement'}</span>
          </button>
        ) : (
          <>
            {/* Take Point Button */}
            <button
              id="take-gps-point-btn"
              onClick={onTakePoint}
              disabled={!currentPos}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-sm shadow-md transition active:scale-98"
            >
              <MapPin className="w-5 h-5 text-slate-950" />
              <span>{lang === 'bn' ? 'পয়েন্ট নিন' : 'Take Point'}</span>
            </button>

            {/* Stop GPS Button */}
            <button
              id="stop-gps-btn"
              onClick={onStopGps}
              className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm border border-slate-300 transition active:scale-98"
            >
              <Square className="w-4 h-4 text-rose-600" />
              <span>{lang === 'bn' ? 'GPS বন্ধ করুন' : 'Stop GPS'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
