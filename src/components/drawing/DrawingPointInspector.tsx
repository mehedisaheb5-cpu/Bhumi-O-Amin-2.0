import React, { useState } from 'react';
import {
  MapPin,
  Compass,
  Ruler,
  Clock,
  Trash2,
  X,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { ProjectedDrawingPoint } from '../../lib/survey-drawing';
import { GpsPolygonSegment } from '../../lib/gps-geometry';
import { formatCoordinate, formatTime } from '../../lib/gps-utils';
import { Language } from '../../types';

interface DrawingPointInspectorProps {
  selectedPoint: ProjectedDrawingPoint | null;
  selectedSegment: GpsPolygonSegment | null;
  lang: Language;
  onClose: () => void;
  onDeletePoint: (pointId: string) => void;
}

export const DrawingPointInspector: React.FC<DrawingPointInspectorProps> = ({
  selectedPoint,
  selectedSegment,
  lang,
  onClose,
  onDeletePoint,
}) => {
  const isBn = lang === 'bn';
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

  if (!selectedPoint && !selectedSegment) return null;

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Selected Point Inspector */}
      {/* -------------------------------------------------------------------- */}
      {selectedPoint && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-800 text-white font-black text-xs flex items-center justify-center">
                {selectedPoint.label}
              </div>
              <h4 className="text-xs font-bold text-slate-900">
                {isBn ? `পয়েন্ট বিবরণ: ${selectedPoint.label}` : `Point Details: ${selectedPoint.label}`}
              </h4>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Latitude */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">
                {isBn ? 'অক্ষাংশ (Latitude)' : 'Latitude'}
              </span>
              <span className="font-mono font-bold text-slate-900 text-[11px]">
                {formatCoordinate(selectedPoint.latitude, 'lat')}
              </span>
            </div>

            {/* Longitude */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">
                {isBn ? 'দ্রাঘিমাংশ (Longitude)' : 'Longitude'}
              </span>
              <span className="font-mono font-bold text-slate-900 text-[11px]">
                {formatCoordinate(selectedPoint.longitude, 'lng')}
              </span>
            </div>

            {/* GPS Accuracy */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">
                {isBn ? 'জিপিএস সঠিকতা (Accuracy)' : 'GPS Accuracy'}
              </span>
              <span className="font-semibold text-emerald-800 text-[11px]">
                {selectedPoint.accuracy !== undefined ? `±${selectedPoint.accuracy} m` : 'N/A'}
              </span>
            </div>

            {/* Timestamp */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">
                {isBn ? 'সংগ্রহের সময়' : 'Recorded Time'}
              </span>
              <span className="text-slate-700 text-[11px]">
                {selectedPoint.timestamp ? formatTime(selectedPoint.timestamp, lang) : 'N/A'}
              </span>
            </div>
          </div>

          {/* Delete point action with confirmation (TASK 11) */}
          <div className="pt-2 border-t border-slate-100">
            {!showConfirmDelete ? (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'পয়েন্ট মুছুন' : 'Delete Point'}</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {isBn
                      ? `আপনি কি নিশ্চিত পয়েন্ট ${selectedPoint.label} মুছে ফেলতে চান?`
                      : `Are you sure you want to delete Point ${selectedPoint.label}?`}
                  </span>
                </div>
                <p className="text-[11px] text-rose-700">
                  {isBn
                    ? 'এটি মুছে ফেললে পরবর্তী পয়েন্টগুলো স্বয়ংক্রিয়ভাবে পুনরায় ক্রমানুসারে (A, B, C...) সাজানো হবে।'
                    : 'Deleting this point will re-index remaining points sequentially.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onDeletePoint(selectedPoint.id);
                      setShowConfirmDelete(false);
                      onClose();
                    }}
                    className="px-3 py-1 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-2xs"
                  >
                    {isBn ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. Selected Segment Inspector (TASK 5) */}
      {/* -------------------------------------------------------------------- */}
      {selectedSegment && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">📏</span>
              <h4 className="text-xs font-bold text-slate-900">
                {isBn
                  ? `আইল / বাহু: পয়েন্ট ${selectedSegment.fromLabel} ➔ ${selectedSegment.toLabel}`
                  : `Segment: Point ${selectedSegment.fromLabel} ➔ ${selectedSegment.toLabel}`}
                {selectedSegment.isClosing && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {isBn ? 'সমাপ্তি আইল' : 'Closing Edge'}
                  </span>
                )}
              </h4>
            </div>
            {!selectedPoint && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Distance Feet & Meters */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">
                {isBn ? 'দূরত্ব (ফুট ও মিটার)' : 'Distance'}
              </span>
              <span className="font-bold text-emerald-900 text-sm">
                {selectedSegment.distanceFeet} ft
              </span>
              <span className="text-slate-500 text-[11px] block">
                ({selectedSegment.distanceMeters} m)
              </span>
            </div>

            {/* Bearing & Direction (TASK 5) */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block">
                {isBn ? 'বিয়ারিং / দিক (Bearing)' : 'Bearing & Direction'}
              </span>
              <span className="font-mono font-bold text-amber-900 text-sm">
                {selectedSegment.bearingDegrees}°
              </span>
              <span className="text-slate-700 text-[11px] block font-medium">
                {isBn ? selectedSegment.compassDirectionBn : selectedSegment.compassDirectionEn}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
