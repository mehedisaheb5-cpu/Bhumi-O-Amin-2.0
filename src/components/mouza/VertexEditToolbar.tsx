import React, { useState } from 'react';
import {
  Edit3,
  Undo2,
  Redo2,
  Magnet,
  RotateCcw,
  CheckCircle2,
  Layers,
  Ruler,
  AlertTriangle,
  Info,
  Maximize2,
  PlusCircle,
  HelpCircle,
  Hand,
} from 'lucide-react';
import { Language } from '../../types';
import { VertexEditMetrics } from '../../lib/vertex-editing';

interface VertexEditToolbarProps {
  isEditMode: boolean;
  tracingInteractionMode: 'draw' | 'pan'; // New
  onTracingInteractionModeChange: (mode: 'draw' | 'pan') => void; // New
  onToggleEditMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isSnapEnabled: boolean;
  onToggleSnap: () => void;
  isEdited: boolean;
  onResetToOriginal: () => void;
  metrics: VertexEditMetrics;
  totalPoints: number;
  lang: Language;
  selectedLayerName?: string;
  availableLayers?: { id: string; name: string; nameBn: string; color: string }[];
  selectedLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
  onSaveEdits?: () => void;
  onFitView?: () => void;
}

export const VertexEditToolbar: React.FC<VertexEditToolbarProps> = ({
  isEditMode,
  tracingInteractionMode, // New
  onTracingInteractionModeChange, // New
  onToggleEditMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isSnapEnabled,
  onToggleSnap,
  isEdited,
  onResetToOriginal,
  metrics,
  totalPoints,
  lang,
  selectedLayerName,
  availableLayers,
  selectedLayerId,
  onSelectLayer,
  onSaveEdits,
  onFitView,
}) => {
  const isBn = lang === 'bn';
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="space-y-2.5">
      {/* Primary Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        {/* Left: Mode Toggle & Layer Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Interaction Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => onTracingInteractionModeChange('draw')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                tracingInteractionMode === 'draw'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isBn ? 'ড্র' : 'Draw'}</span>
            </button>
            <button
              onClick={() => onTracingInteractionModeChange('pan')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                tracingInteractionMode === 'pan'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্যান' : 'Pan'}</span>
            </button>
          </div>

          <button
            onClick={onToggleEditMode}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs ${
              isEditMode
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>
              {isEditMode
                ? isBn
                  ? '✏️ এডিট মোড চালু (ON)'
                  : '✏️ Vertex Edit (ON)'
                : isBn
                ? '✏️ পয়েন্ট এডিট করুন'
                : '✏️ Edit Vertices'}
            </span>
          </button>

          {/* Layer Selector for Pentagraph */}
          {availableLayers && availableLayers.length > 1 && onSelectLayer && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600">
                {isBn ? 'লেয়ার:' : 'Layer:'}
              </span>
              <select
                value={selectedLayerId}
                onChange={(e) => onSelectLayer(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 border-none outline-hidden cursor-pointer"
              >
                {availableLayers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {isBn ? l.nameBn : l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Edited Status Pill */}
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
              isEdited
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {isEdited
              ? isBn
                ? 'সম্পাদিত (Edited)'
                : 'Edited'
              : isBn
              ? 'মূল নকশা (Original)'
              : 'Original'}
          </span>
        </div>

        {/* Right: History & Snapping Controls */}
        <div className="flex items-center gap-1.5">
          {/* Undo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-xl transition ${
              canUndo
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer active:scale-95'
                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
            }`}
            title={isBn ? 'পূর্বাবস্থায় (Undo)' : 'Undo'}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* Redo */}
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-xl transition ${
              canRedo
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer active:scale-95'
                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
            }`}
            title={isBn ? 'পুনরায় (Redo)' : 'Redo'}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {/* Snapping Toggle */}
          <button
            onClick={onToggleSnap}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
              isSnapEnabled
                ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title={
              isBn
                ? isSnapEnabled
                  ? 'স্ন্যাপ সক্রিয় আছে'
                  : 'স্ন্যাপ বন্ধ আছে'
                : 'Toggle Snapping'
            }
          >
            <Magnet className={`w-3.5 h-3.5 ${isSnapEnabled ? 'text-cyan-700' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {isSnapEnabled ? (isBn ? 'স্ন্যাপ অন' : 'Snap ON') : isBn ? 'স্ন্যাপ অফ' : 'Snap OFF'}
            </span>
          </button>

          {/* Fit View Button */}
          {onFitView && (
            <button
              onClick={onFitView}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition"
              title={isBn ? 'পুরো ম্যাপে দেখুন' : 'Fit View'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Reset to Original Button */}
          {isEdited && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer"
              title={isBn ? 'মূল অবস্থায় ফিরিয়ে নিন' : 'Reset to Original'}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">
                {isBn ? 'Original-এ ফিরুন' : 'Reset Original'}
              </span>
            </button>
          )}

          {/* Info/Instructions Helper */}
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition"
            title={isBn ? 'পয়েন্ট এডিটের নিয়মাবলী' : 'Editing Instructions'}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Save Edits button if applicable */}
          {onSaveEdits && isEdited && (
            <button
              onClick={onSaveEdits}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'সংরক্ষণ করুন' : 'Save'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs space-y-2 animate-fadeIn">
          <p className="font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {isBn
                ? 'আপনি কি সমস্ত কাস্টম এডিট বাতিল করে দাগের প্রাথমিক মূল (Original) জ্যামিতিতে ফিরে যেতে চান?'
                : 'Revert all custom vertex changes and restore original geometry?'}
            </span>
          </p>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              onClick={() => {
                setShowResetConfirm(false);
                onResetToOriginal();
              }}
              className="px-3.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 shadow-xs cursor-pointer"
            >
              {isBn ? 'হ্যাঁ, মূল নকশা ফিরিয়ে নিন' : 'Yes, Restore Original'}
            </button>
          </div>
        </div>
      )}

      {/* Editing Instructions Drawer */}
      {showInstructions && (
        <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 text-[11px] space-y-1.5 border border-slate-700 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 font-bold text-white">
            <span className="flex items-center gap-1 text-emerald-400">
              <Info className="w-3.5 h-3.5" />
              <span>{isBn ? 'ভার্টেক্স/পয়েন্ট এডিট নির্দেশিকা' : 'Vertex Editing Guide'}</span>
            </span>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300">
            <li>
              <strong>{isBn ? 'পয়েন্ট সরানো:' : 'Move Vertex:'}</strong>{' '}
              {isBn
                ? 'যেকোনো কোণ বা পয়েন্টে স্পর্শ করে টেনে নতুন অবস্থানে নিন।'
                : 'Touch and drag any corner point to its correct position.'}
            </li>
            <li>
              <strong>{isBn ? 'নতুন পয়েন্ট যোগ:' : 'Add Vertex:'}</strong>{' '}
              {isBn
                ? 'বাঁকা বা আঁকাবাঁকা সীমানার বাহুর মাঝখানের (+) বাটনে ট্যাপ করে নতুন পয়েন্ট যোগ করুন।'
                : 'Tap on (+) midpoint handles on segments to insert new points.'}
            </li>
            <li>
              <strong>{isBn ? 'পয়েন্ট মুছে ফেলা:' : 'Delete Vertex:'}</strong>{' '}
              {isBn
                ? 'যেকোনো পয়েন্ট সিলেক্ট করে "পয়েন্ট মুছুন" চাপুন (কমপক্ষে ৩টি কোণ থাকতে হবে)।'
                : 'Select vertex and tap "Delete Vertex" (min 3 points required).'}
            </li>
            <li>
              <strong>{isBn ? 'স্ন্যাপ ও মাইক্রো-মুভ:' : 'Snap & Micro-move:'}</strong>{' '}
              {isBn
                ? 'কাছের পয়েন্টে মেলাতে স্ন্যাপ চালু রাখুন এবং সূক্ষ্ম পরিবর্তনের জন্য তীর বাটন ব্যবহার করুন।'
                : 'Toggle snapping and use directional nudge buttons for millimeter precision.'}
            </li>
          </ul>
        </div>
      )}

      {/* Dynamic Polygon Measurement Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Area Sq Ft & Decimal */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            {isBn ? 'পরিমাপকৃত ক্ষেত্রফল' : 'Calculated Area'}
          </span>
          <div className="font-extrabold text-slate-900 text-sm">
            {metrics.areaDecimal} <span className="text-xs text-emerald-800">{isBn ? 'শতাংশ' : 'Dec'}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {metrics.areaSqFt.toLocaleString()} {isBn ? 'বর্গফুট' : 'sq ft'}
          </span>
        </div>

        {/* Traditional Units (Katha / Bigha / Acre) */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            {isBn ? 'কাঠা / বিঘা / একর' : 'Katha / Bigha / Acre'}
          </span>
          <div className="font-extrabold text-slate-900 text-xs mt-0.5">
            {metrics.areaKatha} {isBn ? 'কাঠা' : 'katha'} ({metrics.areaBigha} {isBn ? 'বিঘা' : 'bigha'})
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {metrics.areaAcre} {isBn ? 'একর' : 'acre'}
          </span>
        </div>

        {/* Perimeter */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            {isBn ? 'মোট পরিসীমা (আইল)' : 'Total Perimeter'}
          </span>
          <div className="font-extrabold text-slate-900 text-sm">
            {metrics.perimeterFt} <span className="text-xs text-slate-600">{isBn ? 'ফুট' : 'ft'}</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {roundClean(metrics.perimeterFt / 3.28084, 2)} {isBn ? 'মিটার' : 'm'}
          </span>
        </div>

        {/* Vertices & Irregular Boundary Density */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            {isBn ? 'পয়েন্ট / কোণ সংখ্যা' : 'Vertices Count'}
          </span>
          <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
            <span>{totalPoints} {isBn ? 'টি পয়েন্ট' : 'pts'}</span>
            {totalPoints > 4 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800">
                {isBn ? 'অনিয়মিত দাগ' : 'Irregular'}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            {isBn ? 'যেকোনো সংখ্যক পয়েন্ট সমর্থিত' : 'Multi-vertex supported'}
          </span>
        </div>
      </div>
    </div>
  );
};

function roundClean(val: number, decimals: number = 2): number {
  return Number(Math.round(Number(val + 'e' + decimals)) + 'e-' + decimals);
}
