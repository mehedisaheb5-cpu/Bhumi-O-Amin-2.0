import React, { useMemo } from 'react';
import { LatLngPoint, GpsPolygonSegment, calculatePolygonSegments } from '../../lib/gps-geometry';
import {
  projectGpsPointsToLocal,
  ProjectedDrawingPoint,
  calculateDynamicScaleBar,
} from '../../lib/survey-drawing';
import { Language } from '../../types';
import { formatNumberByLang } from '../../lib/land-units';

interface ReportDrawingViewProps {
  points: LatLngPoint[];
  segments?: GpsPolygonSegment[];
  lang: Language;
  className?: string;
  width?: number;
  height?: number;
}

export const ReportDrawingView: React.FC<ReportDrawingViewProps> = ({
  points,
  segments: providedSegments,
  lang,
  className = '',
  width = 680,
  height = 360,
}) => {
  const isBn = lang === 'bn';

  // Project real GPS points to local metric plane
  const projection = useMemo(() => {
    return projectGpsPointsToLocal(points);
  }, [points]);

  // Segments for boundary dimensions
  const segments = useMemo(() => {
    if (providedSegments && providedSegments.length > 0) return providedSegments;
    if (points.length >= 2) {
      return calculatePolygonSegments(points);
    }
    return [];
  }, [points, providedSegments]);

  // Coordinate mapping to SVG canvas space
  const { toScreen, scaleInfo, centerMeters } = useMemo(() => {
    const { bounds } = projection;
    const padding = 54; // Padding in px
    const availW = Math.max(100, width - padding * 2);
    const availH = Math.max(100, height - padding * 2);

    const spanX = Math.max(bounds.widthMeters, 1);
    const spanY = Math.max(bounds.heightMeters, 1);

    const scaleX = availW / spanX;
    const scaleY = availH / spanY;
    const pxPerMeter = Math.min(scaleX, scaleY) * 0.88;

    const centerX = width / 2;
    const centerY = height / 2;

    const toScreen = (pt: { xMeters: number; yMeters: number }) => {
      // Y is inverted in SVG (North + is up)
      const xM = Number.isFinite(pt.xMeters) ? pt.xMeters : 0;
      const yM = Number.isFinite(pt.yMeters) ? pt.yMeters : 0;
      const cXM = Number.isFinite(bounds.centerXMeters) ? bounds.centerXMeters : 0;
      const cYM = Number.isFinite(bounds.centerYMeters) ? bounds.centerYMeters : 0;
      const sx = centerX + (xM - cXM) * pxPerMeter;
      const sy = centerY - (yM - cYM) * pxPerMeter;
      return {
        sx: Number.isFinite(sx) ? sx : centerX,
        sy: Number.isFinite(sy) ? sy : centerY,
      };
    };

    const scaleBar = calculateDynamicScaleBar(pxPerMeter);
    const barWidthPx = Number.isFinite(scaleBar.pixelWidth) && scaleBar.pixelWidth > 0 ? scaleBar.pixelWidth : 80;
    const scaleDistanceFeet = Number.isFinite(scaleBar.distanceFt) ? scaleBar.distanceFt : 10;
    const scaleDistanceMeters = Number.isFinite(scaleBar.distanceM) ? scaleBar.distanceM : 3;

    return {
      toScreen,
      scaleInfo: {
        ...scaleBar,
        barWidthPx,
        pixelWidth: barWidthPx,
        scaleDistanceFeet,
        scaleDistanceMeters,
        pxPerMeter,
      },
      centerMeters: {
        x: bounds.centerXMeters,
        y: bounds.centerYMeters,
      },
    };
  }, [projection, width, height]);

  // Polygon path string
  const polygonPointsString = useMemo(() => {
    if (projection.points.length < 3) return '';
    return projection.points
      .map((pt) => {
        const { sx, sy } = toScreen(pt);
        return `${sx.toFixed(1)},${sy.toFixed(1)}`;
      })
      .join(' ');
  }, [projection.points, toScreen]);

  if (projection.points.length === 0) {
    return (
      <div
        className={`w-full flex items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 ${className}`}
        style={{ height }}
      >
        <span>{isBn ? 'ড্রয়িংয়ের জন্য কোনো বৈধ পয়েন্ট নেই' : 'No valid points for drawing'}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-white border border-slate-300 rounded-xl select-none ${className}`}
      style={{ height }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block font-sans"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle Cadastral Grid Pattern */}
          <pattern id="report-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path
              d="M 36 0 L 0 0 0 36"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="0.75"
              strokeDasharray="2,3"
            />
          </pattern>

          {/* Dimension Arrow Marker */}
          <marker
            id="report-dim-arrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#047857" />
          </marker>
        </defs>

        {/* 1. Cadastral Grid Background */}
        <rect width={width} height={height} fill="url(#report-grid)" />

        {/* 2. Boundary Closed Polygon (when 3+ points) */}
        {projection.points.length >= 3 && (
          <polygon
            points={polygonPointsString}
            fill="#ecfdf5"
            fillOpacity="0.75"
            stroke="#047857"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Line connection when only 2 points */}
        {projection.points.length === 2 && (
          <line
            x1={toScreen(projection.points[0]).sx}
            y1={toScreen(projection.points[0]).sy}
            x2={toScreen(projection.points[1]).sx}
            y2={toScreen(projection.points[1]).sy}
            stroke="#047857"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* 3. Dimension Lines & Distance Labels on Each Segment */}
        {segments.map((seg, idx) => {
          if (idx >= projection.points.length) return null;
          const fromPt = projection.points[seg.fromIndex];
          const toPt = projection.points[seg.toIndex];
          if (!fromPt || !toPt) return null;

          const p1 = toScreen(fromPt);
          const p2 = toScreen(toPt);

          // Segment midpoint
          const midX = (p1.sx + p2.sx) / 2;
          const midY = (p1.sy + p2.sy) / 2;

          // Normal offset to place label cleanly away from line
          const dx = p2.sx - p1.sx;
          const dy = p2.sy - p1.sy;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const offsetDist = 14;
          const labelX = midX + nx * offsetDist;
          const labelY = midY + ny * offsetDist;

          // Formatted text
          const safeDistFt = Number.isFinite(seg.distanceFeet) ? seg.distanceFeet : 0;
          const safeDistM = Number.isFinite(seg.distanceMeters) ? seg.distanceMeters : 0;
          const distFt = safeDistFt.toFixed(1);
          const distM = safeDistM.toFixed(1);
          const labelText = isBn
            ? `${formatNumberByLang(distFt, 'bn')} ফুট (${formatNumberByLang(distM, 'bn')} মি.)`
            : `${distFt} ft (${distM} m)`;

          return (
            <g key={`seg-dim-${idx}`}>
              {/* Subtle offset dimension tick */}
              <line
                x1={midX}
                y1={midY}
                x2={labelX}
                y2={labelY}
                stroke="#047857"
                strokeWidth="0.75"
                strokeDasharray="1.5,1.5"
                opacity="0.6"
              />
              {/* Badge Background for high legibility */}
              <rect
                x={labelX - 44}
                y={labelY - 9}
                width="88"
                height="18"
                rx="5"
                fill="#ffffff"
                stroke="#047857"
                strokeWidth="0.9"
                opacity="0.95"
              />
              {/* Text */}
              <text
                x={labelX}
                y={labelY + 3.5}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#064e3b"
              >
                {labelText}
              </text>
            </g>
          );
        })}

        {/* 4. Sequential Survey Point Badges (A, B, C, D...) */}
        {projection.points.map((pt, idx) => {
          const { sx, sy } = toScreen(pt);
          const label = pt.label || String.fromCharCode(65 + idx);

          return (
            <g key={`pt-badge-${pt.id || idx}`}>
              {/* Accuracy halo circle if accuracy exists */}
              {pt.accuracy && pt.accuracy > 0 && (
                <circle
                  cx={sx}
                  cy={sy}
                  r={Math.min(18, Math.max(8, pt.accuracy * (scaleInfo.pxPerMeter || 1)))}
                  fill="#10b981"
                  fillOpacity="0.12"
                  stroke="#10b981"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                />
              )}

              {/* Point Pillar Marker */}
              <circle cx={sx} cy={sy} r="9" fill="#ffffff" stroke="#064e3b" strokeWidth="2" />
              <circle cx={sx} cy={sy} r="6.5" fill="#064e3b" />

              {/* Label inside marker */}
              <text
                x={sx}
                y={sy + 3}
                textAnchor="middle"
                fontSize="8"
                fontWeight="900"
                fill="#ffffff"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* 5. True North Indicator Rose (Top-Right) */}
        <g transform={`translate(${width - 44}, 36)`}>
          <circle cx="0" cy="0" r="17" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          {/* North arrow pointer (North is directly UP in our projection) */}
          <polygon points="0,-13 4,-2 0,0 -4,-2" fill="#b91c1c" />
          <polygon points="0,13 4,2 0,0 -4,2" fill="#475569" />
          <text
            x="0"
            y="-15"
            textAnchor="middle"
            fontSize="9"
            fontWeight="900"
            fill="#b91c1c"
          >
            N
          </text>
        </g>

        {/* 6. Dynamic Scale Indicator (Bottom-Left) */}
        <g transform={`translate(16, ${height - 24})`}>
          <rect
            x="-4"
            y="-14"
            width={scaleInfo.barWidthPx + 60}
            height="22"
            rx="4"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="0.75"
            opacity="0.95"
          />
          {/* Scale line */}
          <line
            x1="0"
            y1="0"
            x2={scaleInfo.barWidthPx}
            y2="0"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Ticks */}
          <line x1="0" y1="-3" x2="0" y2="3" stroke="#0f172a" strokeWidth="1.5" />
          <line
            x1={scaleInfo.barWidthPx / 2}
            y1="-2.5"
            x2={scaleInfo.barWidthPx / 2}
            y2="2.5"
            stroke="#0f172a"
            strokeWidth="1"
          />
          <line
            x1={scaleInfo.barWidthPx}
            y1="-3"
            x2={scaleInfo.barWidthPx}
            y2="3"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
          {/* Labels */}
          <text x="0" y="-5" fontSize="8" fontWeight="700" fill="#0f172a">
            0
          </text>
          <text
            x={scaleInfo.barWidthPx}
            y="-5"
            textAnchor="end"
            fontSize="8"
            fontWeight="700"
            fill="#0f172a"
          >
            {isBn
              ? `${formatNumberByLang(scaleInfo.scaleDistanceFeet, 'bn')} ফুট`
              : `${scaleInfo.scaleDistanceFeet} ft`}
          </text>
          <text
            x={scaleInfo.barWidthPx + 8}
            y="2"
            fontSize="7.5"
            fontWeight="600"
            fill="#64748b"
          >
            ({isBn ? `${formatNumberByLang(scaleInfo.scaleDistanceMeters, 'bn')} মি.` : `${scaleInfo.scaleDistanceMeters}m`})
          </text>
        </g>

        {/* 7. Subtitle / Cadastral Type Tag (Top-Left) */}
        <g transform="translate(14, 20)">
          <rect
            x="0"
            y="0"
            width="190"
            height="18"
            rx="4"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="0.75"
            opacity="0.95"
          />
          <circle cx="8" cy="9" r="3" fill="#047857" />
          <text x="16" y="12.5" fontSize="8.5" fontWeight="700" fill="#0f172a">
            {isBn ? 'GPS জরিপ • ডিজিটাল সীমানা নকশা' : 'GPS Survey • Digital Cadastral Plot'}
          </text>
        </g>
      </svg>
    </div>
  );
};
