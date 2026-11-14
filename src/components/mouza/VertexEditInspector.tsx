import React, { useState } from 'react';
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Compass,
  CheckCircle2,
  Ruler,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { DigitizedDagPoint, Language, VertexPointType } from '../../types';
import { SegmentInfo } from '../../lib/vertex-editing';

interface VertexEditInspectorProps {
  point: DigitizedDagPoint | null;
  pointIndex: number | null;
  totalPoints: number;
  prevSegment?: SegmentInfo | null;
  nextSegment?: SegmentInfo | null;
  lang: Language;
  onNudge: (dx: number, dy: number) => void;
  onDelete: () => void;
  onClose?: () => void;
}

export const VertexEditInspector: React.FC<VertexEditInspectorProps> = ({
  point,
  pointIndex,
  totalPoints,
  prevSegment,
  nextSegment,
  lang,
  onNudge,
  onDelete,
  onClose,
}) => {
  const isBn = lang === 'bn';
  const [nudgeStep, setNudgeStep] = useState<number>(2);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!point || pointIndex === null) {
    return null;
  }

  const pointType: VertexPointType = point.sourceType || 'digitized';

  const getTypeBadge = (type: VertexPointType) => {
    switch (type) {
      case 'gps':
        return {
          label: isBn ? 'প্রকৃত GPS পয়েন্ট' : 'Real Field GPS Point',
          color: 'bg-cyan-100 text-cyan-900 border-cyan-300',
          dot: 'bg-cyan-500',
        };
      case 'manual':
        return {
          label: isBn ? 'আমিন কর্তৃক এডিট/যুক্ত' : 'Manually Added/Edited',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
        };
      case 'control':
        return {
          label: isBn ? 'কন্ট্রোল বা নিয়ন্ত্রণ পয়েন্ট' : 'Control Reference Point',
          color: 'bg-purple-100 text-purple-900 border-purple-300',
          dot: 'bg-purple-500',
        };
      case 'digitized':
      default:
        return {
          label: isBn ? 'ডিজিটাইজড মৌজা ভার্টেক্স' : 'Digitized Map Vertex',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-500',
        };
    }
  };

  const badge = getTypeBadge(pointType);
  const pointLabel = point.label || `P${pointIndex + 1}`;

  return (
    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-md text-xs space-y-3 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs">
            {pointIndex + 1}
          </div>
          <div>
            <h5 className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>{isBn ? `পয়েন্ট ${pointLabel}` : `Vertex ${pointLabel}`}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({pointIndex + 1} / {totalPoints})
              </span>
            </h5>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          {badge.label}
        </span>
      </div>

      {/* Coordinate Inspector (Precision & GPS Safety Guard) */}
      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            {isBn ? 'লোকাল ড্রয়িং X / Y' : 'Local Canvas X / Y'}
          </span>
          <span className="font-mono font-bold text-slate-800 text-xs">
            X: {Math.round(point.x)}, Y: {Math.round(point.y)}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            {isBn ? 'GPS কোঅর্ডিনেট' : 'GPS Coordinates'}
          </span>
          {point.lat && point.lng && point.sourceType === 'gps' ? (
            <span className="font-mono font-bold text-cyan-700 text-[11px] block truncate" title={`${point.lat}, ${point.lng}`}>
              {point.lat.toFixed(6)}°, {point.lng.toFixed(6)}°
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-medium italic block" title="No fake GPS fabricated">
              {isBn ? '— লোকাল ম্যাপ পয়েন্ট (ফেক GPS নয়) —' : '— Local Map Point —'}
            </span>
          )}
        </div>
      </div>

      {/* Adjacent Boundary Segment Distances */}
      {(prevSegment || nextSegment) && (
        <div className="flex items-center justify-between text-[11px] bg-slate-50/70 p-2 rounded-xl border border-slate-100">
          {prevSegment && (
            <div className="flex items-center gap-1 text-slate-600">
              <Ruler className="w-3 h-3 text-slate-400" />
              <span>
                {isBn ? 'পূর্ববর্তী বাহু:' : 'Prev Side:'}{' '}
                <strong className="text-slate-900 font-mono">{prevSegment.lengthFt}</strong> {isBn ? 'ফুট' : 'ft'}
              </span>
            </div>
          )}

          {nextSegment && (
            <div className="flex items-center gap-1 text-slate-600">
              <Ruler className="w-3 h-3 text-slate-400" />
              <span>
                {isBn ? 'পরবর্তী বাহু:' : 'Next Side:'}{' '}
                <strong className="text-slate-900 font-mono">{nextSegment.lengthFt}</strong> {isBn ? 'ফুট' : 'ft'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Precision Micro-Nudge Controls (Touch-Friendly Fine Adjustment) */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500">
            {isBn ? 'সূক্ষ্ম নাড়াচাড়া (Micro Nudge):' : 'Micro Nudge Adjust:'}
          </span>
          <div className="flex items-center gap-1 text-[10px] font-bold">
            {[1, 2, 5, 10].map((step) => (
              <button
                key={step}
                onClick={() => setNudgeStep(step)}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                  nudgeStep === step
                    ? 'bg-emerald-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {step}px
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => onNudge(-nudgeStep, 0)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition active:scale-95 cursor-pointer"
            title={isBn ? 'বামে সরান' : 'Move Left'}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => onNudge(0, -nudgeStep)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition active:scale-95 cursor-pointer"
              title={isBn ? 'উপরে সরান' : 'Move Up'}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNudge(0, nudgeStep)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition active:scale-95 cursor-pointer"
              title={isBn ? 'নিচে সরান' : 'Move Down'}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => onNudge(nudgeStep, 0)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition active:scale-95 cursor-pointer"
            title={isBn ? 'ডানে সরান' : 'Move Right'}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Delete Vertex Action */}
      <div className="pt-2 border-t border-slate-100">
        {showDeleteConfirm ? (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
            <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isBn
                  ? `আপনি কি নিশ্চিতভাবে পয়েন্ট ${pointLabel} মুছতে চান?`
                  : `Are you sure you want to delete vertex ${pointLabel}?`}
              </span>
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs cursor-pointer"
              >
                {isBn ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (totalPoints <= 3) {
                  alert(
                    isBn
                      ? 'বহুভুজ সীমানা বজায় রাখতে কমপক্ষে ৩টি পয়েন্ট প্রয়োজন।'
                      : 'At least 3 vertices are required to form a polygon.'
                  );
                  return;
                }
                setShowDeleteConfirm(true);
              }}
              disabled={totalPoints <= 3}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                totalPoints <= 3
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBn ? 'পয়েন্ট মুছুন' : 'Delete Vertex'}</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {isBn ? 'প্যানেল বন্ধ' : 'Close'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
