import React, { useState, useMemo } from 'react';
import { Compass, AlertCircle, CheckCircle2, Layers } from 'lucide-react';
import { Language, SurveyPlotRecord } from '../../types';
import { computePlotCoordinates, roundVal } from '../../lib/plot-measure-utils';
import { formatNumberByLang } from '../../lib/land-units';

interface ReportOccupationDrawingViewProps {
  plots: SurveyPlotRecord[];
  lang: Language;
  className?: string;
  height?: number;
}

export const ReportOccupationDrawingView: React.FC<ReportOccupationDrawingViewProps> = ({
  plots,
  lang,
  className = '',
  height = 420,
}) => {
  const isBn = lang === 'bn';
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number>(0);

  const activePlot = plots[selectedPlotIndex] || plots[0];

  // Compute 2D schematic coordinates for active plot
  const plotData = useMemo(() => {
    if (!activePlot) return null;
    const coords = computePlotCoordinates(
      activePlot.northSide,
      activePlot.southSide,
      activePlot.eastSide,
      activePlot.westSide,
      activePlot.unit,
      activePlot.diagonal,
      activePlot.diagonalChoice || 'AC'
    );

    const { vertices, isExact, bounds, diagonalEndpoints } = coords;

    // SVG padding
    const paddingX = Math.max(35, bounds.width * 0.32);
    const paddingY = Math.max(35, bounds.height * 0.32);
    const minViewX = bounds.minX - paddingX;
    const minViewY = bounds.minY - paddingY;
    const viewWidth = bounds.width + paddingX * 2;
    const viewHeight = bounds.height + paddingY * 2;

    const unitLabel = activePlot.unit === 'meter' ? (isBn ? 'মিটার' : 'm') : (isBn ? 'ফুট' : 'ft');

    // Midpoints for side tags
    const midAB = { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };
    const midBC = { x: (vertices[1].x + vertices[2].x) / 2, y: (vertices[1].y + vertices[2].y) / 2 };
    const midCD = { x: (vertices[2].x + vertices[3].x) / 2, y: (vertices[2].y + vertices[3].y) / 2 };
    const midDA = { x: (vertices[3].x + vertices[0].x) / 2, y: (vertices[3].y + vertices[0].y) / 2 };

    const center = {
      x: (vertices[0].x + vertices[1].x + vertices[2].x + vertices[3].x) / 4,
      y: (vertices[0].y + vertices[1].y + vertices[2].y + vertices[3].y) / 4,
    };

    return {
      coords,
      vertices,
      isExact,
      diagonalEndpoints,
      viewBox: `${minViewX} ${minViewY} ${viewWidth} ${viewHeight}`,
      viewWidth,
      unitLabel,
      midAB,
      midBC,
      midCD,
      midDA,
      center,
    };
  }, [activePlot, isBn]);

  if (!plots || plots.length === 0 || !activePlot) {
    return (
      <div className="w-full h-80 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500">
        <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
        <p className="text-sm font-bold text-slate-700">
          {isBn ? 'কোনো প্লট পরিমাপ ডেটা পাওয়া যায়নি' : 'No Plot Measurements Available'}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col w-full h-full bg-slate-950 text-white rounded-xl overflow-hidden shadow-inner ${className}`}>
      {/* Top Header Strip inside Drawing */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs z-10 print:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-800 text-white flex items-center justify-center font-bold text-[10px]">
            <Layers className="w-3 h-3 text-emerald-200" />
          </div>
          <span className="font-bold text-slate-100 text-xs">
            {activePlot.plotName}
          </span>
          {activePlot.dagNo && (
            <span className="bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
              {isBn ? 'দাগ: ' : 'Dag: '} {formatNumberByLang(activePlot.dagNo, lang)}
            </span>
          )}
        </div>

        {/* Multi-plot tab switcher (Hidden in Print) */}
        {plots.length > 1 && (
          <div className="flex items-center gap-1 print:hidden">
            <span className="text-[10px] text-slate-400 mr-1">
              {isBn ? 'প্লট পরিবর্তন:' : 'Plot:'}
            </span>
            {plots.map((p, idx) => (
              <button
                key={p.id || idx}
                type="button"
                onClick={() => setSelectedPlotIndex(idx)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  selectedPlotIndex === idx
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.plotName.replace(/প্লট\s*/g, 'P')}
              </button>
            ))}
          </div>
        )}

        {/* Schematic Status Badge */}
        <div className="flex items-center gap-1.5">
          {plotData?.isExact ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>{isBn ? 'জ্যামিতিকভাবে নির্ধারিত নকশা (কর্ণসহ)' : 'Exact Geometry (With Diagonal)'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[10px] font-bold">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>{isBn ? 'আনুমানিক চিত্র — স্কেল অনুযায়ী নয়' : 'Schematic Drawing — Not to Scale'}</span>
            </span>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className="relative w-full flex items-center justify-center overflow-hidden bg-slate-950"
        style={{ minHeight: `${height - 90}px`, maxHeight: `${height}px` }}
      >
        {/* Subtle Grid Background */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cadGrid)" />
        </svg>

        {/* North Arrow Indicator (Top Right) */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-center bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-lg shadow-sm">
          <div className="w-6 h-6 relative flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-rose-500">
              <path d="M12 2L6 14h5v8h2v-8h5L12 2z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[10px] font-black text-slate-100 font-mono">N</span>
          <span className="text-[8px] text-slate-400 font-sans">{isBn ? 'উত্তর' : 'North'}</span>
        </div>

        {/* Scale/Method Notice (Top Left) */}
        <div className="absolute top-3 left-3 z-10 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg text-[10px] space-y-0.5">
          <div className="text-emerald-400 font-bold">
            {isBn ? 'বাস্তব দখল জরিপ স্কেচ' : 'Occupation Survey Sketch'}
          </div>
          <div className="text-slate-400 font-mono text-[9px]">
            {activePlot.calculationMethod === 'diagonal' && activePlot.diagonal
              ? (isBn ? 'পদ্ধতি: হেরন দ্বিখণ্ডিত ত্রিভুজ' : 'Method: Triangulation')
              : (isBn ? 'পদ্ধতি: গড় পদ্ধতি (গড় দৈর্ঘ্য × গড় প্রস্থ)' : 'Method: Average Method (Avg L × Avg W)')}
          </div>
        </div>

        {/* SVG Drawing */}
        {plotData && (
          <svg
            viewBox={plotData.viewBox}
            className="w-full h-full p-4 select-none max-h-[360px]"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Filled Polygon Boundary */}
            <polygon
              points={plotData.vertices.map((v) => `${v.x},${v.y}`).join(' ')}
              fill="rgba(16, 185, 129, 0.12)"
              stroke="#10b981"
              strokeWidth={Math.max(1.5, plotData.viewWidth * 0.007)}
              strokeLinejoin="round"
            />

            {/* Optional Diagonal Line */}
            {plotData.diagonalEndpoints && activePlot.diagonal && (
              <g>
                <line
                  x1={plotData.diagonalEndpoints.start.x}
                  y1={plotData.diagonalEndpoints.start.y}
                  x2={plotData.diagonalEndpoints.end.x}
                  y2={plotData.diagonalEndpoints.end.y}
                  stroke="#f59e0b"
                  strokeWidth={Math.max(1, plotData.viewWidth * 0.004)}
                  strokeDasharray="4,3"
                />
                {/* Diagonal midpoint badge */}
                <g
                  transform={`translate(${
                    (plotData.diagonalEndpoints.start.x + plotData.diagonalEndpoints.end.x) / 2
                  }, ${
                    (plotData.diagonalEndpoints.start.y + plotData.diagonalEndpoints.end.y) / 2
                  })`}
                >
                  <rect
                    x="-32"
                    y="-9"
                    width="64"
                    height="18"
                    rx="4"
                    fill="#1e293b"
                    stroke="#f59e0b"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    fill="#fbbf24"
                    fontSize={Math.max(8, plotData.viewWidth * 0.024)}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {isBn ? 'কর্ণ: ' : 'Diag: '}
                    {formatNumberByLang(roundVal(activePlot.diagonal, 1), lang)} {plotData.unitLabel}
                  </text>
                </g>
              </g>
            )}

            {/* Center Plot Label & Area Tag */}
            <g transform={`translate(${plotData.center.x}, ${plotData.center.y})`}>
              <rect
                x="-50"
                y="-18"
                width="100"
                height="36"
                rx="6"
                fill="#0f172a"
                stroke="#10b981"
                strokeWidth="1.2"
                className="opacity-95"
              />
              <text
                x="0"
                y="-3"
                fill="#ffffff"
                fontSize={Math.max(9, plotData.viewWidth * 0.026)}
                fontWeight="black"
                textAnchor="middle"
              >
                {activePlot.plotName}
              </text>
              <text
                x="0"
                y="11"
                fill="#34d399"
                fontSize={Math.max(8, plotData.viewWidth * 0.024)}
                fontWeight="bold"
                textAnchor="middle"
              >
                {activePlot.decimal !== null
                  ? `${formatNumberByLang(roundVal(activePlot.decimal, 3), lang)} ${isBn ? 'শতক' : 'dec'}`
                  : (isBn ? 'পরিমাপাধীন' : 'Measuring')}
              </text>
            </g>

            {/* Side 1: North (A to B) */}
            <g transform={`translate(${plotData.midAB.x}, ${plotData.midAB.y - (plotData.viewWidth * 0.05 + 10)})`}>
              <rect
                x="-42"
                y="-9"
                width="84"
                height="18"
                rx="4"
                fill="#0f172a"
                stroke="#f43f5e"
                strokeWidth="1"
              />
              <text
                x="0"
                y="3"
                fill="#ffe4e6"
                fontSize={Math.max(8, plotData.viewWidth * 0.024)}
                fontWeight="bold"
                textAnchor="middle"
              >
                {isBn ? 'উত্তর: ' : 'N: '}
                {formatNumberByLang(roundVal(activePlot.northSide, 1), lang)} {plotData.unitLabel}
              </text>
            </g>

            {/* Side 2: East (B to C) */}
            <g transform={`translate(${plotData.midBC.x + (plotData.viewWidth * 0.06 + 12)}, ${plotData.midBC.y})`}>
              <rect
                x="-42"
                y="-9"
                width="84"
                height="18"
                rx="4"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="1"
              />
              <text
                x="0"
                y="3"
                fill="#e0f2fe"
                fontSize={Math.max(8, plotData.viewWidth * 0.024)}
                fontWeight="bold"
                textAnchor="middle"
              >
                {isBn ? 'পূর্ব: ' : 'E: '}
                {formatNumberByLang(roundVal(activePlot.eastSide, 1), lang)} {plotData.unitLabel}
              </text>
            </g>

            {/* Side 3: South (C to D) */}
            <g transform={`translate(${plotData.midCD.x}, ${plotData.midCD.y + (plotData.viewWidth * 0.05 + 12)})`}>
              <rect
                x="-42"
                y="-9"
                width="84"
                height="18"
                rx="4"
                fill="#0f172a"
                stroke="#94a3b8"
                strokeWidth="1"
              />
              <text
                x="0"
                y="3"
                fill="#f1f5f9"
                fontSize={Math.max(8, plotData.viewWidth * 0.024)}
                fontWeight="bold"
                textAnchor="middle"
              >
                {isBn ? 'দক্ষিণ: ' : 'S: '}
                {formatNumberByLang(roundVal(activePlot.southSide, 1), lang)} {plotData.unitLabel}
              </text>
            </g>

            {/* Side 4: West (D to A) */}
            <g transform={`translate(${plotData.midDA.x - (plotData.viewWidth * 0.06 + 12)}, ${plotData.midDA.y})`}>
              <rect
                x="-42"
                y="-9"
                width="84"
                height="18"
                rx="4"
                fill="#0f172a"
                stroke="#fbbf24"
                strokeWidth="1"
              />
              <text
                x="0"
                y="3"
                fill="#fef3c7"
                fontSize={Math.max(8, plotData.viewWidth * 0.024)}
                fontWeight="bold"
                textAnchor="middle"
              >
                {isBn ? 'পশ্চিম: ' : 'W: '}
                {formatNumberByLang(roundVal(activePlot.westSide, 1), lang)} {plotData.unitLabel}
              </text>
            </g>

            {/* Vertices A, B, C, D */}
            {plotData.vertices.map((v) => (
              <g key={v.label} transform={`translate(${v.x}, ${v.y})`}>
                <circle
                  r={Math.max(3, plotData.viewWidth * 0.012)}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y={-(plotData.viewWidth * 0.016 + 5)}
                  fill="#a7f3d0"
                  fontSize={Math.max(8, plotData.viewWidth * 0.022)}
                  fontWeight="black"
                  textAnchor="middle"
                >
                  {v.label}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Bottom Mandatory Accuracy & Calculation Legend Strip */}
      <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 text-[10px] flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <span className="text-amber-400">●</span>
            <span>
              {isBn
                ? 'গড় পদ্ধতিতে আনুমানিক দখলকৃত জমির পরিমাণ:'
                : 'Approximate Occupied Area by Average Method:'}
            </span>
            <span className="text-emerald-400 font-mono font-bold">
              {activePlot.decimal !== null ? `${formatNumberByLang(activePlot.decimal, lang)} ${isBn ? 'শতক' : 'dec'}` : '—'}
            </span>
            <span className="text-slate-400 font-mono">
              ({activePlot.areaSqFt ? `${formatNumberByLang(activePlot.areaSqFt, lang)} ${isBn ? 'বর্গফুট' : 'sq ft'}` : '—'})
            </span>
          </div>
          <div className="text-[9px] text-slate-400">
            {isBn
              ? 'এই হিসাব গড় দৈর্ঘ্য × গড় প্রস্থের ভিত্তিতে প্রস্তুত। মাঠের বাস্তব সীমানা দখল চিহ্নিত করার জন্য আনুমানিক স্কেচ।'
              : 'Calculation based on Average Length × Average Width. Schematic sketch representing physical occupation.'}
          </div>
        </div>

        <div className="text-right font-mono text-[9px] text-slate-400">
          <div>{isBn ? 'গড় দৈর্ঘ্য:' : 'Avg L:'} {activePlot.averageLengthFt || roundVal((activePlot.northSide + activePlot.southSide) / 2, 1)} ft</div>
          <div>{isBn ? 'গড় প্রস্থ:' : 'Avg W:'} {activePlot.averageWidthFt || roundVal((activePlot.eastSide + activePlot.westSide) / 2, 1)} ft</div>
        </div>
      </div>
    </div>
  );
};
