import React from 'react';
import {
  MousePointer,
  MapPin,
  Minus,
  Square,
  Pentagon,
  Type,
  Ruler,
  Trash2,
  Layers,
  Save,
  Palette,
} from 'lucide-react';
import { DrawingTheme, DrawingToolType } from './DrawingCanvas';
import { Language } from '../../types';

interface DrawingToolbarProps {
  activeTool: DrawingToolType;
  theme: DrawingTheme;
  annotationsCount: number;
  isSaving: boolean;
  lang: Language;
  onSelectTool: (tool: DrawingToolType) => void;
  onToggleTheme: () => void;
  onClearAnnotations: () => void;
  onSaveDrawing: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  theme,
  annotationsCount,
  isSaving,
  lang,
  onSelectTool,
  onToggleTheme,
  onClearAnnotations,
  onSaveDrawing,
}) => {
  const isBn = lang === 'bn';

  const tools: Array<{
    id: DrawingToolType;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'select',
      label: isBn ? 'সিলেক্ট' : 'Select',
      icon: <MousePointer className="w-3.5 h-3.5" />,
    },
    {
      id: 'point',
      label: isBn ? 'পয়েন্ট' : 'Point',
      icon: <MapPin className="w-3.5 h-3.5" />,
    },
    {
      id: 'line',
      label: isBn ? 'রেখা' : 'Line',
      icon: <Minus className="w-3.5 h-3.5" />,
    },
    {
      id: 'rectangle',
      label: isBn ? 'আয়ত' : 'Rect',
      icon: <Square className="w-3.5 h-3.5" />,
    },
    {
      id: 'text',
      label: isBn ? 'টেক্সট' : 'Text',
      icon: <Type className="w-3.5 h-3.5" />,
    },
    {
      id: 'dimension',
      label: isBn ? 'পরিমাপ' : 'Dim',
      icon: <Ruler className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-2">
      {/* 1. Drawing Tool Selector */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
        <span className="text-[11px] font-bold text-slate-500 uppercase px-1 hidden sm:inline">
          {isBn ? 'টুলস:' : 'Tools:'}
        </span>
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTool(t.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Utility Actions (Theme switch, Clear annotations, Save Drawing) */}
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Theme Toggle (Blueprint vs Cadastral Light) */}
        <button
          onClick={onToggleTheme}
          title={isBn ? 'নকশা থিম পরিবর্তন (ব্লুপ্রিন্ট / সাদা)' : 'Toggle Blueprint / Light Paper'}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
            theme === 'blueprint'
              ? 'bg-slate-900 text-amber-300 border-slate-700'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {theme === 'blueprint' ? (isBn ? 'ব্লুপ্রিন্ট' : 'Blueprint') : (isBn ? 'সাদা পেপার' : 'White Paper')}
          </span>
        </button>

        {/* Clear Annotations (if any) */}
        {annotationsCount > 0 && (
          <button
            onClick={onClearAnnotations}
            title={isBn ? 'অ্যানোটেশন মুছুন' : 'Clear Annotations'}
            className="p-1.5 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 transition active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Save Drawing Button (TASK 16) */}
        <button
          onClick={onSaveDrawing}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs transition active:scale-95 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5 text-amber-300" />
          <span>{isBn ? 'নকশা সংরক্ষণ করুন' : 'Save Drawing'}</span>
        </button>
      </div>
    </div>
  );
};
