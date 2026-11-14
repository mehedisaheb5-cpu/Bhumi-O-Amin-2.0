import React from 'react';
import { MapPin, Clock, Eye } from 'lucide-react';
import { ProjectedDrawingPoint } from '../../lib/survey-drawing';
import { formatCoordinate, formatTime } from '../../lib/gps-utils';
import { Language } from '../../types';

interface DrawingCoordinateTableProps {
  points: ProjectedDrawingPoint[];
  selectedPointId: string | null;
  lang: Language;
  onSelectPoint: (point: ProjectedDrawingPoint) => void;
}

export const DrawingCoordinateTable: React.FC<DrawingCoordinateTableProps> = ({
  points,
  selectedPointId,
  lang,
  onSelectPoint,
}) => {
  const isBn = lang === 'bn';

  if (points.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-800" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            {isBn ? 'বাস্তব GPS স্থানাঙ্ক তালিকা' : 'Real GPS Coordinate Table'}
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {isBn ? `মোট ${points.length}টি পয়েন্ট` : `${points.length} Points Total`}
        </span>
      </div>

      {/* Horizontally scrollable table on mobile (TASK 14) */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse min-w-[480px]">
          <thead>
            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-3">{isBn ? 'পয়েন্ট' : 'Point'}</th>
              <th className="py-2.5 px-3">{isBn ? 'অক্ষাংশ (Latitude)' : 'Latitude'}</th>
              <th className="py-2.5 px-3">{isBn ? 'দ্রাঘিমাংশ (Longitude)' : 'Longitude'}</th>
              <th className="py-2.5 px-3">{isBn ? 'সঠিকতা (Accuracy)' : 'Accuracy'}</th>
              <th className="py-2.5 px-3">{isBn ? 'রেকর্ডের সময়' : 'Time'}</th>
              <th className="py-2.5 px-3 text-right">{isBn ? 'অ্যাকশন' : 'Action'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {points.map((pt) => {
              const isSelected = selectedPointId === pt.id;
              return (
                <tr
                  key={pt.id}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-50/90 font-medium' : 'hover:bg-slate-50/70'
                  }`}
                  onClick={() => onSelectPoint(pt)}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center">
                        {pt.label}
                      </span>
                      <span className="font-bold text-slate-900">P{pt.label}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-800">
                    {formatCoordinate(pt.latitude, 'lat')}
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-800">
                    {formatCoordinate(pt.longitude, 'lng')}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        (pt.accuracy || 99) <= 5
                          ? 'bg-emerald-100 text-emerald-800'
                          : (pt.accuracy || 99) <= 10
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {pt.accuracy !== undefined ? `±${pt.accuracy} m` : 'N/A'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                    {pt.timestamp ? formatTime(pt.timestamp, lang) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPoint(pt);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{isBn ? 'নকশায় দেখুন' : 'Inspect'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
