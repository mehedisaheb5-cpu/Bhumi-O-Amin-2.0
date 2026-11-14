import React from 'react';
import { GpsPolygonSegment } from '../../lib/gps-geometry';
import { Language } from '../../types';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import { Compass, ArrowRight, CornerDownRight, CheckCircle2, Navigation } from 'lucide-react';

interface GpsSegmentListProps {
  segments: GpsPolygonSegment[];
  lang: Language;
  pointCount: number;
}

export const GpsSegmentList: React.FC<GpsSegmentListProps> = ({
  segments,
  lang,
  pointCount,
}) => {
  if (segments.length === 0) {
    return null;
  }

  const isBn = lang === 'bn';

  return (
    <div
      id="gps-segment-measurements"
      className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 animate-fadeIn"
    >
      {/* Title & Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-800" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {isBn ? 'পয়েন্ট-টু-পয়েন্ট দূরত্ব ও দিক' : 'Point-to-Point Measurements'}
          </h3>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
          {formatNumberByLang(segments.length, lang)} {isBn ? 'টি বাহু' : 'segments'}
        </span>
      </div>

      <p className="text-[11px] text-slate-500">
        {pointCount === 2
          ? isBn
            ? '২টি পয়েন্টের মধ্যবর্তী সরলরৈখিক দূরত্ব ও বেয়ারিং কোণ:'
            : 'Linear distance and forward geodetic azimuth between 2 points:'
          : isBn
          ? 'প্রতিটি সংলগ্ন সীমানা বাহুর দৈর্ঘ্য, কম্পাস দিক ও পরিক্রমা সমাপ্তি:'
          : 'Lengths, geodetic bearings, and closing boundary connection:'}
      </p>

      {/* Segments Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {segments.map((seg, idx) => {
          const isClosing = seg.isClosing;

          return (
            <div
              key={`seg-${seg.fromIndex}-${seg.toIndex}-${idx}`}
              className={`p-3 rounded-xl border transition-all ${
                isClosing
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                  : 'bg-slate-50/90 border-slate-200/90 text-slate-800 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                {/* Segment Name Badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                      isClosing
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'bg-slate-800 text-white'
                    }`}
                  >
                    {seg.fromLabel}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                      isClosing
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'bg-slate-800 text-white'
                    }`}
                  >
                    {seg.toLabel}
                  </span>
                  <span className="text-xs font-bold text-slate-900 ml-1">
                    {seg.fromLabel} → {seg.toLabel}
                  </span>
                </div>

                {/* Closing Boundary Badge */}
                {isClosing && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-bold border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                    <span>{isBn ? 'পরিক্রমা সমাপ্তি' : 'Closure to A'}</span>
                  </span>
                )}
              </div>

              {/* Segment Measurements Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                {/* Distance */}
                <div>
                  <span className="text-[10px] font-medium text-slate-500 block">
                    {isBn ? 'দূরত্ব (ফুট ও মিটার)' : 'Distance'}
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {formatNumberByLang(roundClean(seg.distanceFeet, 2), lang)}{' '}
                    <span className="text-[11px] font-normal text-slate-600">
                      {isBn ? 'ফুট' : 'ft'}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    ({formatNumberByLang(roundClean(seg.distanceMeters, 2), lang)}{' '}
                    <span className="text-[10px] font-sans">{isBn ? 'মিটার' : 'm'}</span>)
                  </p>
                </div>

                {/* Bearing & Compass Direction */}
                <div>
                  <span className="text-[10px] font-medium text-slate-500 block">
                    {isBn ? 'বেয়ারিং ও দিক' : 'Bearing & Direction'}
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-emerald-800 shrink-0" />
                    <span>{formatNumberByLang(roundClean(seg.bearingDegrees, 1), lang)}°</span>
                  </p>
                  <p className="text-[11px] text-emerald-800 font-medium truncate">
                    {isBn ? seg.compassDirectionBn : seg.compassDirectionEn}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
