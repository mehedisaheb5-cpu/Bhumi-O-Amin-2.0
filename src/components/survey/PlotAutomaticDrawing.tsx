import React, { useState, useMemo } from 'react';
import {
  Compass,
  AlertTriangle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Layers,
} from 'lucide-react';
import { Language, SurveyPlotRecord } from '../../types';
import { computePlotCoordinates, roundVal } from '../../lib/plot-measure-utils';
import { formatNumberByLang } from '../../lib/land-units';

interface PlotAutomaticDrawingProps {
  plot: SurveyPlotRecord;
  lang: Language;
  className?: string;
}

export const PlotAutomaticDrawing: React.FC<PlotAutomaticDrawingProps> = ({
  plot,
  lang,
  className = '',
}) => {
  const isBn = lang === 'bn';
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Compute 2D coordinates for the 4 vertices based on trigonometry / law of cosines
  const { vertices, isExact, diagonalEndpoints, bounds } = useMemo(() => {
    return computePlotCoordinates(
      plot.northSide,
      plot.southSide,
      plot.eastSide,
      plot.westSide,
      plot.unit,
      plot.diagonal,
      plot.diagonalChoice || 'AC'
    );
  }, [
    plot.northSide,
    plot.southSide,
    plot.eastSide,
    plot.westSide,
    plot.unit,
    plot.diagonal,
    plot.diagonalChoice,
  ]);

  // SVG viewBox setup with comfortable padding
  const paddingX = Math.max(40, bounds.width * 0.35);
  const paddingY = Math.max(40, bounds.height * 0.35);
  const minViewX = bounds.minX - paddingX;
  const minViewY = bounds.minY - paddingY;
  const viewWidth = bounds.width + paddingX * 2;
  const viewHeight = bounds.height + paddingY * 2;

  // Zoom handlers
  const handleZoomIn = () => setZoomScale((prev) => Math.min(2.5, prev + 0.25));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(0.6, prev - 0.25));
  const handleResetZoom = () => setZoomScale(1);

  const unitLabel = plot.unit === 'meter' ? (isBn ? 'মি.' : 'm') : (isBn ? 'ফুট' : 'ft');

  // Polygon points string for SVG
  const polygonPointsStr = vertices.map((v) => `${v.x},${v.y}`).join(' ');

  // Midpoints for side labels
  const midAB = { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };
  const midBC = { x: (vertices[1].x + vertices[2].x) / 2, y: (vertices[1].y + vertices[2].y) / 2 };
  const midCD = { x: (vertices[2].x + vertices[3].x) / 2, y: (vertices[2].y + vertices[3].y) / 2 };
  const midDA = { x: (vertices[3].x + vertices[0].x) / 2, y: (vertices[3].y + vertices[0].y) / 2 };

  const hasAnyInput =
    plot.northSide > 0 || plot.southSide > 0 || plot.eastSide > 0 || plot.westSide > 0;

  return (
    <div
      className={`relative flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-md ${className}`}
    >
      {/* Canvas Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800/80 text-white z-10 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-100 tracking-wide">
                {plot.plotName || (isBn ? 'প্লট নকশা' : 'Plot Drawing')}
              </span>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-900/60 text-emerald-300 text-[10px] font-bold font-mono">
                {isBn ? 'দাগ ' : 'Dag '} {formatNumberByLang(plot.dagNo, lang)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              {isBn ? 'অটোমেটিক রিয়েল-টাইম প্লট স্কেচ' : 'Auto Dynamic Plot Sketch'}
            </span>
          </div>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1">
          <button
            type="button"
            onClick={handleZoomOut}
            title={isBn ? 'জুম কমান' : 'Zoom Out'}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono font-bold text-slate-300 px-1">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title={isBn ? 'জুম বাড়ান' : 'Zoom In'}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title={isBn ? 'রিসেট' : 'Reset'}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95 border-l border-slate-800 ml-0.5"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Drawing Viewport */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-950 flex items-center justify-center overflow-hidden select-none">
        {/* Blueprint Grid Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* North Direction Compass Indicator (Fixed Top-Right) */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-center p-1.5 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md backdrop-blur-xs">
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* North Arrow */}
            <div className="w-0 h-0 border-x-4 border-x-transparent border-b-10 border-b-rose-500 absolute top-0.5" />
            <div className="w-0 h-0 border-x-4 border-x-transparent border-t-10 border-t-slate-500 absolute bottom-0.5" />
            <div className="w-1.5 h-1.5 rounded-full bg-white z-10" />
          </div>
          <span className="text-[10px] font-black text-rose-400 mt-0.5 tracking-wider">
            {isBn ? 'উ / N' : 'N'}
          </span>
        </div>

        {/* Geometry Status Banner (Top-Left inside Canvas) */}
        <div className="absolute top-3 left-3 z-10 max-w-[70%]">
          {isExact ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold backdrop-blur-xs shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{isBn ? 'জ্যামিতিকভাবে নির্ধারিত নকশা (কর্ণসহ)' : 'Fully Determined Geometry'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] font-semibold backdrop-blur-xs shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {isBn
                  ? 'গড় পদ্ধতিতে আনুমানিক দখলকৃত জমির পরিমাণ (স্কেচ)'
                  : 'Approximate Occupation Drawing (Average Method)'}
              </span>
            </div>
          )}
        </div>

        {/* Empty State Prompt */}
        {!hasAnyInput && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500 z-10">
            <Compass className="w-10 h-10 text-slate-600 mb-2 animate-pulse" />
            <p className="text-xs font-bold text-slate-300">
              {isBn ? 'বাহুর মাপ দিলে স্বয়ংক্রিয় নকশা তৈরি হবে' : 'Enter side lengths to generate plot drawing'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              {isBn
                ? 'উত্তর, দক্ষিণ, পূর্ব ও পশ্চিম বাহুর দৈর্ঘ্য প্রবেশ করালে রিয়েল-টাইমে সীমানা প্রদর্শিত হবে।'
                : 'Enter North, South, East, and West side measurements to render boundary.'}
            </p>
          </div>
        )}

        {/* SVG Canvas with dynamic transform scaling */}
        <svg
          viewBox={`${minViewX} ${minViewY} ${viewWidth} ${viewHeight}`}
          className="w-full h-full transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoomScale})` }}
        >
          <defs>
            {/* Soft glow for boundary lines */}
            <filter id="plot-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#10b981" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Plot Polygon Area Fill and Outline */}
          <polygon
            points={polygonPointsStr}
            fill="rgba(16, 185, 129, 0.14)"
            stroke="#10b981"
            strokeWidth={viewWidth * 0.008 + 1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#plot-glow)"
          />

          {/* Triangulation Diagonal Line if present */}
          {diagonalEndpoints && (
            <g>
              <line
                x1={diagonalEndpoints.start.x}
                y1={diagonalEndpoints.start.y}
                x2={diagonalEndpoints.end.x}
                y2={diagonalEndpoints.end.y}
                stroke="#f59e0b"
                strokeWidth={viewWidth * 0.006 + 1.2}
                strokeDasharray={`${viewWidth * 0.015 + 4} ${viewWidth * 0.015 + 4}`}
              />
              {/* Diagonal Label Badge at midpoint */}
              <g
                transform={`translate(${
                  (diagonalEndpoints.start.x + diagonalEndpoints.end.x) / 2
                }, ${
                  (diagonalEndpoints.start.y + diagonalEndpoints.end.y) / 2
                })`}
              >
                <rect
                  x="-42"
                  y="-11"
                  width="84"
                  height="22"
                  rx="6"
                  fill="#78350f"
                  stroke="#f59e0b"
                  strokeWidth="1"
                  className="opacity-95"
                />
                <text
                  x="0"
                  y="4"
                  fill="#fef3c7"
                  fontSize={Math.min(12, Math.max(8, viewWidth * 0.03))}
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {isBn ? 'কর্ণ: ' : 'Diag: '}
                  {formatNumberByLang(roundVal(plot.diagonal || 0, 1), lang)} {unitLabel}
                </text>
              </g>
            </g>
          )}

          {/* North Side (AB) Label */}
          <g transform={`translate(${midAB.x}, ${midAB.y - (viewHeight * 0.05 + 10)})`}>
            <rect
              x="-28"
              y="-11"
              width="56"
              height="22"
              rx="6"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="1"
              className="opacity-95"
            />
            <text
              x="0"
              y="4"
              fill="#e0f2fe"
              fontSize={Math.min(12, Math.max(8, viewWidth * 0.03))}
              fontWeight="bold"
              textAnchor="middle"
            >
              {formatNumberByLang(roundVal(plot.northSide, 1), lang)} {unitLabel}
            </text>
          </g>

          {/* South Side (CD) Label */}
          <g transform={`translate(${midCD.x}, ${midCD.y + (viewHeight * 0.05 + 10)})`}>
            <rect
              x="-28"
              y="-11"
              width="56"
              height="22"
              rx="6"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="1"
              className="opacity-95"
            />
            <text
              x="0"
              y="4"
              fill="#e0f2fe"
              fontSize={Math.min(12, Math.max(8, viewWidth * 0.03))}
              fontWeight="bold"
              textAnchor="middle"
            >
              {formatNumberByLang(roundVal(plot.southSide, 1), lang)} {unitLabel}
            </text>
          </g>

          {/* East Side (BC) Label */}
          <g transform={`translate(${midBC.x + (viewWidth * 0.05 + 15)}, ${midBC.y})`}>
            <rect
              x="-28"
              y="-11"
              width="56"
              height="22"
              rx="6"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="1"
              className="opacity-95"
            />
            <text
              x="0"
              y="4"
              fill="#e0f2fe"
              fontSize={Math.min(12, Math.max(8, viewWidth * 0.03))}
              fontWeight="bold"
              textAnchor="middle"
            >
              {formatNumberByLang(roundVal(plot.eastSide, 1), lang)} {unitLabel}
            </text>
          </g>

          {/* West Side (DA) Label */}
          <g transform={`translate(${midDA.x - (viewWidth * 0.05 + 15)}, ${midDA.y})`}>
            <rect
              x="-28"
              y="-11"
              width="56"
              height="22"
              rx="6"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="1"
              className="opacity-95"
            />
            <text
              x="0"
              y="4"
              fill="#e0f2fe"
              fontSize={Math.min(12, Math.max(8, viewWidth * 0.03))}
              fontWeight="bold"
              textAnchor="middle"
            >
              {formatNumberByLang(roundVal(plot.westSide, 1), lang)} {unitLabel}
            </text>
          </g>

          {/* Vertex Pinpoints and Labels (A, B, C, D) */}
          {vertices.map((v) => (
            <g key={v.label} transform={`translate(${v.x}, ${v.y})`}>
              <circle r={viewWidth * 0.015 + 4} fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
              <circle r={viewWidth * 0.007 + 1.5} fill="#064e3b" />
              <text
                x="0"
                y={-(viewWidth * 0.02 + 7)}
                fill="#a7f3d0"
                fontSize={Math.max(9, viewWidth * 0.025)}
                fontWeight="black"
                textAnchor="middle"
              >
                {v.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Bottom Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-950 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">
            {isBn ? 'পরিসীমা:' : 'Perimeter:'}{' '}
            <strong className="text-white font-mono font-bold">
              {formatNumberByLang(plot.perimeterFt, lang)} {isBn ? 'ফুট' : 'ft'}
            </strong>
          </span>

          <span className="text-slate-400 font-medium">
            {isBn ? 'ক্ষেত্রফল:' : 'Area:'}{' '}
            {plot.decimal !== null ? (
              <strong className="text-emerald-400 font-mono font-bold">
                {formatNumberByLang(plot.decimal, lang)} {isBn ? 'শতক' : 'dec'} (
                {formatNumberByLang(plot.areaSqFt || 0, lang)} {isBn ? 'বর্গফুট' : 'sq ft'})
              </strong>
            ) : (
              <span className="text-amber-400 font-medium italic">
                {isBn ? 'অনির্ধারিত (কর্ণ দিন)' : 'Underdetermined (give diagonal)'}
              </span>
            )}
          </span>
        </div>

        <span className="text-[10px] text-slate-500 font-mono">
          {plot.unit === 'meter' ? 'Metric (m)' : 'Standard (ft)'}
        </span>
      </div>
    </div>
  );
};
