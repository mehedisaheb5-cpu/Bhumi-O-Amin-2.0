import React from 'react';
import { LandShape, LengthUnit, PolygonPoint } from '../../types';
import { formatNumberByLang, getUnitLabel, roundClean } from '../../lib/land-units';
import { Maximize2 } from 'lucide-react';

interface ShapeVisualizerProps {
  shape: LandShape;
  unit: LengthUnit;
  lang: 'bn' | 'en';
  areaSqFt: number;
  shatangsha: number;
  perimeterFt?: number;
  // Rectangle
  rectLength?: number;
  rectWidth?: number;
  // Triangle
  triangleMode?: 'base_height' | 'three_sides';
  triangleBase?: number;
  triangleHeight?: number;
  triangleSideA?: number;
  triangleSideB?: number;
  triangleSideC?: number;
  // Trapezoid
  trapParallel1?: number;
  trapParallel2?: number;
  trapHeight?: number;
  // Quad Diagonal
  quadSideA?: number;
  quadSideB?: number;
  quadSideC?: number;
  quadSideD?: number;
  quadDiagonal?: number;
  // Polygon
  polygonPoints?: PolygonPoint[];
}

export const ShapeVisualizer: React.FC<ShapeVisualizerProps> = ({
  shape,
  unit,
  lang,
  areaSqFt,
  shatangsha,
  perimeterFt,
  rectLength,
  rectWidth,
  triangleMode,
  triangleBase,
  triangleHeight,
  triangleSideA,
  triangleSideB,
  triangleSideC,
  trapParallel1,
  trapParallel2,
  trapHeight,
  quadSideA,
  quadSideB,
  quadSideC,
  quadSideD,
  quadDiagonal,
  polygonPoints,
}) => {
  const unitLabel = getUnitLabel(unit, lang);

  return (
    <div
      id="calculator-shape-visualizer"
      className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{lang === 'bn' ? 'জ্যামিতিক রূপরেখা ও নকশা' : 'Geometric Plot Outline'}</span>
        </span>
        <span className="text-[11px] font-bold text-amber-300">
          {shape === 'rectangle'
            ? lang === 'bn' ? 'আয়তাকার জমি' : 'Rectangular Plot'
            : shape === 'triangle'
            ? lang === 'bn' ? 'ত্রিভুজাকার জমি' : 'Triangular Plot'
            : shape === 'trapezoid'
            ? lang === 'bn' ? 'ট্রাপিজিয়াম আকৃতির জমি' : 'Trapezoidal Plot'
            : shape === 'quad_diagonal'
            ? lang === 'bn' ? '৪ বাহু ও কর্ণ (বিষমবাহু জমি)' : '4-Sides & Diagonal Plot'
            : lang === 'bn' ? 'বহুভুজ / অনিয়মিত জমি' : 'Polygon / Irregular Plot'}
        </span>
      </div>

      <div className="relative py-2 flex items-center justify-center min-h-[160px]">
        {/* 1. RECTANGLE VISUALIZER */}
        {shape === 'rectangle' && (
          <div className="relative w-56 sm:w-72 h-32 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-950/40 flex flex-col items-center justify-center shadow-inner">
            {/* Top dimension (Length) */}
            <div className="absolute -top-3.5 px-2.5 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-700 text-[10px] font-bold">
              {lang === 'bn' ? 'দৈর্ঘ্য:' : 'L:'} {formatNumberByLang(rectLength ?? 0, lang)} {unitLabel}
            </div>

            {/* Right dimension (Width) */}
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 rotate-90 px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-700 text-[10px] font-bold whitespace-nowrap">
              {lang === 'bn' ? 'প্রস্থ:' : 'W:'} {formatNumberByLang(rectWidth ?? 0, lang)} {unitLabel}
            </div>

            {/* Center Area Details */}
            <span className="text-2xl font-black text-amber-400 tracking-tight">
              {formatNumberByLang(shatangsha, lang)}
            </span>
            <span className="text-xs font-bold text-emerald-200">
              {lang === 'bn' ? 'শতাংশ / শতক' : 'Decimals'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              ({formatNumberByLang(areaSqFt, lang)} {lang === 'bn' ? 'বর্গফুট' : 'Sq. Ft.'})
            </span>
            {perimeterFt !== undefined && perimeterFt > 0 && (
              <span className="text-[9px] text-emerald-400/90 mt-0.5">
                {lang === 'bn' ? 'পরিসীমা:' : 'Perimeter:'} {formatNumberByLang(roundClean(perimeterFt, 1), lang)} ft
              </span>
            )}
          </div>
        )}

        {/* 2. TRIANGLE VISUALIZER */}
        {shape === 'triangle' && (
          <div className="relative flex flex-col items-center justify-center">
            <svg viewBox="0 0 240 130" className="w-56 sm:w-64 h-32 overflow-visible">
              {/* Triangle path */}
              <polygon
                points="30,115 210,115 120,25"
                fill="rgba(6, 78, 59, 0.4)"
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              {/* Dotted height line if base_height mode */}
              {triangleMode === 'base_height' && (
                <line
                  x1="120"
                  y1="25"
                  x2="120"
                  y2="115"
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
            </svg>

            {/* Labels overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-amber-400 mt-4">
                {formatNumberByLang(shatangsha, lang)}
              </span>
              <span className="text-[11px] font-bold text-emerald-200">
                {lang === 'bn' ? 'শতাংশ' : 'Decimals'}
              </span>
              <span className="text-[10px] text-slate-400">
                ({formatNumberByLang(areaSqFt, lang)} {lang === 'bn' ? 'বর্গফুট' : 'sq ft'})
              </span>
            </div>

            {/* Base label bottom */}
            <div className="mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-700">
              {triangleMode === 'base_height'
                ? `${lang === 'bn' ? 'ভূমি:' : 'Base:'} ${formatNumberByLang(triangleBase ?? 0, lang)} ${unitLabel}`
                : `${lang === 'bn' ? 'বাহু গ:' : 'Side C:'} ${formatNumberByLang(triangleSideC ?? 0, lang)} ${unitLabel}`}
            </div>

            {/* Top / height or side indicator */}
            {triangleMode === 'base_height' && triangleHeight !== undefined && (
              <div className="absolute top-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                {lang === 'bn' ? 'উচ্চতা:' : 'Height:'} {formatNumberByLang(triangleHeight, lang)} {unitLabel}
              </div>
            )}
          </div>
        )}

        {/* 3. TRAPEZOID VISUALIZER */}
        {shape === 'trapezoid' && (
          <div className="relative flex flex-col items-center justify-center">
            <svg viewBox="0 0 240 130" className="w-56 sm:w-64 h-32 overflow-visible">
              {/* Trapezoid outline */}
              <polygon
                points="55,25 185,25 220,115 20,115"
                fill="rgba(6, 78, 59, 0.4)"
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              {/* Height line indicator */}
              <line
                x1="80"
                y1="25"
                x2="80"
                y2="115"
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            </svg>

            {/* Top parallel label (a) */}
            <div className="absolute top-0 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-700">
              {lang === 'bn' ? '১ম বাহু:' : 'a:'} {formatNumberByLang(trapParallel1 ?? 0, lang)} {unitLabel}
            </div>

            {/* Center Area details */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-amber-400 mt-2">
                {formatNumberByLang(shatangsha, lang)}
              </span>
              <span className="text-[11px] font-bold text-emerald-200">
                {lang === 'bn' ? 'শতাংশ' : 'Decimals'}
              </span>
              <span className="text-[10px] text-slate-400">
                ({formatNumberByLang(areaSqFt, lang)} {lang === 'bn' ? 'বর্গফুট' : 'sq ft'})
              </span>
            </div>

            {/* Bottom parallel label (b) */}
            <div className="mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-700">
              {lang === 'bn' ? '২য় বাহু:' : 'b:'} {formatNumberByLang(trapParallel2 ?? 0, lang)} {unitLabel}
            </div>

            {/* Height label */}
            {trapHeight !== undefined && (
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                {lang === 'bn' ? 'উচ্চতা:' : 'h:'} {formatNumberByLang(trapHeight, lang)}
              </div>
            )}
          </div>
        )}

        {/* 3B. QUADRILATERAL WITH DIAGONAL (4 SIDES + 1 DIAGONAL) */}
        {shape === 'quad_diagonal' && (
          <div className="relative flex flex-col items-center justify-center">
            <svg viewBox="0 0 240 140" className="w-56 sm:w-64 h-32 overflow-visible">
              {/* Outer 4-sided irregular polygon */}
              <polygon
                points="30,120 210,125 185,25 45,35"
                fill="rgba(6, 78, 59, 0.4)"
                stroke="#34d399"
                strokeWidth="2"
              />
              {/* Diagonal dashed dividing line */}
              <line
                x1="30"
                y1="120"
                x2="185"
                y2="25"
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </svg>

            {/* Area labels overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-amber-400">
                {formatNumberByLang(shatangsha, lang)}
              </span>
              <span className="text-[11px] font-bold text-emerald-200">
                {lang === 'bn' ? 'শতাংশ' : 'Decimals'}
              </span>
              <span className="text-[10px] text-slate-400">
                ({formatNumberByLang(areaSqFt, lang)} {lang === 'bn' ? 'বর্গফুট' : 'sq ft'})
              </span>
            </div>

            {/* Perimeter and diagonal footer */}
            <div className="flex items-center gap-2 mt-1">
              {quadDiagonal !== undefined && quadDiagonal > 0 && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700">
                  {lang === 'bn' ? 'কর্ণ:' : 'Diag:'} {formatNumberByLang(quadDiagonal, lang)} {unitLabel}
                </span>
              )}
              {perimeterFt !== undefined && perimeterFt > 0 && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {lang === 'bn' ? 'পরিসীমা:' : 'Perimeter:'} {formatNumberByLang(roundClean(perimeterFt, 1), lang)} ft
                </span>
              )}
            </div>
          </div>
        )}

        {/* 4. POLYGON / IRREGULAR VISUALIZER */}
        {shape === 'polygon' && polygonPoints && polygonPoints.length >= 3 && (
          <PolygonSvgRenderer
            points={polygonPoints}
            shatangsha={shatangsha}
            areaSqFt={areaSqFt}
            perimeterFt={perimeterFt}
            lang={lang}
          />
        )}
      </div>
    </div>
  );
};

// Specialized SVG Renderer for arbitrary coordinates polygon
const PolygonSvgRenderer: React.FC<{
  points: PolygonPoint[];
  shatangsha: number;
  areaSqFt: number;
  perimeterFt?: number;
  lang: 'bn' | 'en';
}> = ({ points, shatangsha, areaSqFt, perimeterFt, lang }) => {
  // Compute bounding box
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Viewbox coordinates 240 x 140 with 30 padding
  const pad = 30;
  const targetW = 240 - pad * 2;
  const targetH = 140 - pad * 2;

  // Map to SVG coordinates (invert Y for cartesian coordinate feel)
  const mappedPoints = points.map((p) => {
    const normX = (p.x - minX) / rangeX;
    const normY = (p.y - minY) / rangeY;
    const svgX = pad + normX * targetW;
    const svgY = 140 - pad - normY * targetH;
    return {
      label: p.label,
      svgX,
      svgY,
    };
  });

  const polygonPointsStr = mappedPoints.map((p) => `${p.svgX},${p.svgY}`).join(' ');

  return (
    <div className="relative flex flex-col items-center justify-center w-full">
      <svg viewBox="0 0 240 140" className="w-full max-w-[280px] h-36 overflow-visible">
        {/* Filled polygon */}
        <polygon
          points={polygonPointsStr}
          fill="rgba(16, 185, 129, 0.25)"
          stroke="#10b981"
          strokeWidth="2"
        />

        {/* Vertex points & labels */}
        {mappedPoints.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.svgX} cy={p.svgY} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
            <text
              x={p.svgX}
              y={p.svgY - 7}
              fill="#fbbf24"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Area summary badge */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-black text-amber-400 drop-shadow-sm">
          {formatNumberByLang(shatangsha, lang)}
        </span>
        <span className="text-[11px] font-bold text-emerald-200">
          {lang === 'bn' ? 'শতাংশ / শতক' : 'Decimals'}
        </span>
        <span className="text-[10px] text-slate-400">
          ({formatNumberByLang(areaSqFt, lang)} {lang === 'bn' ? 'বর্গফুট' : 'sq ft'})
        </span>
      </div>

      {perimeterFt !== undefined && perimeterFt > 0 && (
        <div className="text-[10px] font-semibold text-emerald-400 mt-1">
          {lang === 'bn' ? 'মোট সীমানা / পরিসীমা:' : 'Perimeter:'}{' '}
          {formatNumberByLang(roundClean(perimeterFt, 1), lang)} ft
        </div>
      )}
    </div>
  );
};
