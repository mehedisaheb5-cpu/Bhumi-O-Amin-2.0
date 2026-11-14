import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Compass, ZoomIn, ZoomOut, Maximize2, RotateCcw, Info, Crosshair } from 'lucide-react';
import { LatLngPoint, GpsPolygonSegment } from '../../lib/gps-geometry';
import {
  projectGpsPointsToLocal,
  ProjectedDrawingPoint,
  calculateDynamicScaleBar,
} from '../../lib/survey-drawing';
import { DrawingAnnotation, Language } from '../../types';

export type DrawingTheme = 'blueprint' | 'light';
export type DrawingToolType =
  | 'select'
  | 'point'
  | 'line'
  | 'rectangle'
  | 'polygon'
  | 'text'
  | 'dimension';

interface DrawingCanvasProps {
  points: LatLngPoint[];
  segments: GpsPolygonSegment[];
  annotations: DrawingAnnotation[];
  selectedPointId: string | null;
  selectedSegmentIndex: number | null;
  activeTool: DrawingToolType;
  theme: DrawingTheme;
  lang: Language;
  onSelectPoint: (point: ProjectedDrawingPoint | null) => void;
  onSelectSegment: (index: number | null) => void;
  onAddAnnotation: (annotation: DrawingAnnotation) => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  points,
  segments,
  annotations,
  selectedPointId,
  selectedSegmentIndex,
  activeTool,
  theme,
  lang,
  onSelectPoint,
  onSelectSegment,
  onAddAnnotation,
}) => {
  const isBn = lang === 'bn';
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions of canvas in pixels
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 420,
  });

  // Pan and Zoom
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Temporary points for manual annotation drafting
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[]>([]);

  // Update container dimensions with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(Math.max(340, height)),
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. Compute Local Metric Projection from real GPS points
  const projection = useMemo(() => {
    return projectGpsPointsToLocal(points);
  }, [points]);

  const projectedPoints = projection.points;
  const bounds = projection.bounds;

  // 2. Base scale calculation to fit boundary comfortably
  const baseScale = useMemo(() => {
    if (projectedPoints.length === 0) return 10;
    const padding = 65; // px padding
    const availW = Math.max(100, dimensions.width - padding * 2);
    const availH = Math.max(100, dimensions.height - padding * 2);
    const scaleX = availW / Math.max(bounds.widthMeters, 4);
    const scaleY = availH / Math.max(bounds.heightMeters, 4);
    return Math.min(scaleX, scaleY);
  }, [dimensions, bounds, projectedPoints.length]);

  const effectiveScale = baseScale * zoom;

  // Convert local metric coordinates (xMeters, yMeters) to Screen Pixels (x, y)
  // Screen Y is inverted because +Y in local projection is North (Upward)
  const toScreen = useCallback(
    (xMeters: number, yMeters: number): { x: number; y: number } => {
      const centerX = dimensions.width / 2 + pan.x;
      const centerY = dimensions.height / 2 + pan.y;
      return {
        x: centerX + (xMeters - bounds.centerXMeters) * effectiveScale,
        y: centerY - (yMeters - bounds.centerYMeters) * effectiveScale,
      };
    },
    [dimensions, pan, bounds, effectiveScale]
  );

  // Convert screen pixel coordinates to local metric coordinates
  const toMeters = useCallback(
    (screenX: number, screenY: number): { xM: number; yM: number } => {
      const centerX = dimensions.width / 2 + pan.x;
      const centerY = dimensions.height / 2 + pan.y;
      return {
        xM: bounds.centerXMeters + (screenX - centerX) / effectiveScale,
        yM: bounds.centerYMeters - (screenY - centerY) / effectiveScale,
      };
    },
    [dimensions, pan, bounds, effectiveScale]
  );

  // Fit boundary automatically
  const handleFitBoundary = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.3, 15));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.3, 0.15));
  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Scale bar data
  const scaleBar = useMemo(() => {
    return calculateDynamicScaleBar(effectiveScale);
  }, [effectiveScale]);

  // Screen coordinates for survey points
  const screenPoints = useMemo(() => {
    return projectedPoints.map((pt) => ({
      ...pt,
      screen: toScreen(pt.xMeters, pt.yMeters),
    }));
  }, [projectedPoints, toScreen]);

  // Closed boundary polygon path string
  const polygonPath = useMemo(() => {
    if (screenPoints.length < 3) return '';
    return (
      screenPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.screen.x},${p.screen.y}`).join(' ') +
      ' Z'
    );
  }, [screenPoints]);

  // Two points polyline
  const polylinePath = useMemo(() => {
    if (screenPoints.length !== 2) return '';
    return `M ${screenPoints[0].screen.x},${screenPoints[0].screen.y} L ${screenPoints[1].screen.x},${screenPoints[1].screen.y}`;
  }, [screenPoints]);

  // Panning event handlers (Mouse + Touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    // If active tool is an annotation tool, handle drawing rather than pan
    if (activeTool !== 'select') {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { xM, yM } = toMeters(screenX, screenY);

      if (activeTool === 'point') {
        const labelText = prompt(
          isBn ? 'পয়েন্ট নোট বা লেবেল লিখুন:' : 'Enter point annotation label:',
          isBn ? 'নোট' : 'Note'
        );
        if (labelText) {
          onAddAnnotation({
            id: `ann-${Date.now()}`,
            type: 'point',
            x: xM,
            y: yM,
            label: labelText,
            color: '#f59e0b',
            createdAt: Date.now(),
          });
        }
        return;
      }

      if (activeTool === 'text') {
        const textValue = prompt(
          isBn ? 'টেক্সট নোট লিখুন:' : 'Enter text annotation note:',
          isBn ? 'প্লট নোট' : 'Plot Note'
        );
        if (textValue) {
          onAddAnnotation({
            id: `ann-${Date.now()}`,
            type: 'text',
            x: xM,
            y: yM,
            text: textValue,
            color: '#38bdf8',
            createdAt: Date.now(),
          });
        }
        return;
      }

      // Multi-click tools (line, rectangle, dimension)
      if (draftPoints.length === 0) {
        setDraftPoints([{ x: xM, y: yM }]);
      } else {
        const start = draftPoints[0];
        if (activeTool === 'line') {
          onAddAnnotation({
            id: `ann-${Date.now()}`,
            type: 'line',
            x: start.x,
            y: start.y,
            x2: xM,
            y2: yM,
            color: '#a855f7',
            createdAt: Date.now(),
          });
          setDraftPoints([]);
        } else if (activeTool === 'dimension') {
          onAddAnnotation({
            id: `ann-${Date.now()}`,
            type: 'dimension',
            x: start.x,
            y: start.y,
            x2: xM,
            y2: yM,
            color: '#ec4899',
            createdAt: Date.now(),
          });
          setDraftPoints([]);
        } else if (activeTool === 'rectangle') {
          onAddAnnotation({
            id: `ann-${Date.now()}`,
            type: 'rectangle',
            x: start.x,
            y: start.y,
            x2: xM,
            y2: yM,
            color: '#38bdf8',
            createdAt: Date.now(),
          });
          setDraftPoints([]);
        }
      }
      return;
    }

    // Default select/pan mode
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.max(0.15, Math.min(15, z * zoomFactor)));
  };

  // Color palette based on theme
  const isDark = theme === 'blueprint';
  const bgColor = isDark ? '#0b192c' : '#f8fafc';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const gridSubColor = isDark ? '#14233c' : '#f1f5f9';
  const boundaryStroke = isDark ? '#34d399' : '#059669';
  const boundaryFill = isDark ? 'rgba(52, 211, 153, 0.18)' : 'rgba(5, 150, 105, 0.12)';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[380px] sm:h-[480px] rounded-2xl overflow-hidden border shadow-inner select-none transition-colors duration-200"
      style={{
        backgroundColor: bgColor,
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        touchAction: 'none',
      }}
    >
      {/* 1. Zoom and View Controls (Fixed Overlay) */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg">
        <button
          onClick={handleZoomIn}
          title={isBn ? 'বড় করুন' : 'Zoom In'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-100 hover:bg-slate-700/80 active:scale-95 transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title={isBn ? 'ছোট করুন' : 'Zoom Out'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-100 hover:bg-slate-700/80 active:scale-95 transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-700 my-0.5" />
        <button
          onClick={handleFitBoundary}
          title={isBn ? 'সীমানা ফিট' : 'Fit Boundary'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-300 hover:bg-slate-700/80 active:scale-95 transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          title={isBn ? 'রিসেট' : 'Reset View'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-700/80 active:scale-95 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. North Arrow Indicator (Fixed Top-Right Corner) */}
      <div className="absolute top-3 right-3 z-20 pointer-events-none">
        <div
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl backdrop-blur-md shadow-md border ${
            isDark
              ? 'bg-slate-900/85 border-slate-700/80 text-amber-400'
              : 'bg-white/90 border-slate-300 text-emerald-800'
          }`}
        >
          <div className="relative flex flex-col items-center">
            {/* North Arrow Needle */}
            <svg viewBox="0 0 24 28" className="w-5 h-6">
              {/* North tip (Red/Amber) */}
              <polygon points="12,2 7,14 12,11" fill="#ef4444" />
              <polygon points="12,2 17,14 12,11" fill="#b91c1c" />
              {/* South tip */}
              <polygon points="12,26 7,14 12,11" fill="#94a3b8" />
              <polygon points="12,26 17,14 12,11" fill="#64748b" />
              <circle cx="12" cy="11" r="1.5" fill="#ffffff" />
            </svg>
            <span className="text-[10px] font-extrabold tracking-wider leading-none mt-0.5">
              N
            </span>
          </div>
          <div className="text-[10px] font-bold leading-tight pl-1 border-l border-slate-500/30">
            <div>{isBn ? 'উত্তর' : 'North'}</div>
            <div className="text-[8px] font-medium opacity-75">0° True</div>
          </div>
        </div>
      </div>

      {/* 3. Scale Bar Indicator (Fixed Bottom-Left Corner) */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
        <div
          className={`px-2.5 py-1.5 rounded-xl backdrop-blur-md shadow-md border ${
            isDark
              ? 'bg-slate-900/85 border-slate-700/80 text-slate-200'
              : 'bg-white/90 border-slate-300 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[9px] font-bold font-mono text-slate-400 mb-0.5">
            <span>0</span>
            <span>{isBn ? scaleBar.labelBn : scaleBar.labelEn}</span>
          </div>
          {/* Visual scale ruler */}
          <div
            className="h-1.5 border border-amber-400/80 flex"
            style={{ width: `${scaleBar.pixelWidth}px` }}
          >
            <div className="flex-1 bg-amber-400" />
            <div className="flex-1 bg-slate-900/70" />
            <div className="flex-1 bg-amber-400" />
            <div className="flex-1 bg-slate-900/70" />
          </div>
          <div className="text-[8px] text-slate-400 mt-0.5">
            {isBn ? 'জ্যামিতিক স্কেল' : 'Visual Geometry Scale'}
          </div>
        </div>
      </div>

      {/* 4. Active Draft Annotation Indicator */}
      {draftPoints.length > 0 && (
        <div className="absolute top-3 left-3 z-20 bg-amber-500 text-slate-950 font-bold text-xs px-3 py-1 rounded-lg shadow-md animate-pulse">
          {isBn
            ? 'পরবর্তী পয়েন্টে ক্লিক করুন...'
            : 'Click next point to complete annotation...'}
        </div>
      )}

      {/* 5. Main Interactive SVG Vector Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <defs>
          {/* Engineering / Cadastral Grid Pattern */}
          <pattern id="surveyGridSmall" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={gridSubColor} strokeWidth="0.5" />
          </pattern>
          <pattern id="surveyGridLarge" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#surveyGridSmall)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke={gridColor} strokeWidth="1" />
          </pattern>

          {/* Marker definition for line dimensions */}
          <marker
            id="arrowEnd"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#ec4899" />
          </marker>
        </defs>

        {/* Cadastral Grid Background */}
        <rect width="100%" height="100%" fill="url(#surveyGridLarge)" />

        {/* Center Coordinate Axis Lines (Optional Subtle Guides) */}
        <line
          x1={dimensions.width / 2 + pan.x}
          y1="0"
          x2={dimensions.width / 2 + pan.x}
          y2={dimensions.height}
          stroke={gridColor}
          strokeWidth="0.8"
          strokeDasharray="4 4"
        />
        <line
          x1="0"
          y1={dimensions.height / 2 + pan.y}
          x2={dimensions.width}
          y2={dimensions.height / 2 + pan.y}
          stroke={gridColor}
          strokeWidth="0.8"
          strokeDasharray="4 4"
        />

        {/* ------------------------------------------------------------------ */}
        {/* A. CLOSED BOUNDARY POLYGON (>= 3 Points) */}
        {/* ------------------------------------------------------------------ */}
        {screenPoints.length >= 3 && (
          <g id="boundary-polygon-group">
            {/* Filled Polygon */}
            <path
              d={polygonPath}
              fill={boundaryFill}
              stroke={boundaryStroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="transition-all duration-150"
            />
          </g>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* B. POLYLINE (When exactly 2 points: A -> B) */}
        {/* ------------------------------------------------------------------ */}
        {screenPoints.length === 2 && (
          <path
            d={polylinePath}
            fill="none"
            stroke={boundaryStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="5 3"
          />
        )}

        {/* ------------------------------------------------------------------ */}
        {/* C. BOUNDARY SEGMENTS & DIMENSION LINES (TASK 4) */}
        {/* ------------------------------------------------------------------ */}
        {segments.map((seg, idx) => {
          if (idx >= screenPoints.length) return null;
          const fromPt = screenPoints[seg.fromIndex];
          const toPt = screenPoints[seg.toIndex];
          if (!fromPt || !toPt) return null;

          const isSelected = selectedSegmentIndex === idx;
          const midX = (fromPt.screen.x + toPt.screen.x) / 2;
          const midY = (fromPt.screen.y + toPt.screen.y) / 2;

          // Normal vector for label offset so it doesn't overlap the line
          const dx = toPt.screen.x - fromPt.screen.x;
          const dy = toPt.screen.y - fromPt.screen.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const offsetDist = 18;
          // Perpendicular offset
          const offsetX = (-dy / len) * offsetDist;
          const offsetY = (dx / len) * offsetDist;

          const badgeX = midX + offsetX;
          const badgeY = midY + offsetY;

          return (
            <g
              key={`seg-${idx}`}
              className="cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSegment(isSelected ? null : idx);
              }}
            >
              {/* Highlight segment line if selected */}
              {isSelected && (
                <line
                  x1={fromPt.screen.x}
                  y1={fromPt.screen.y}
                  x2={toPt.screen.x}
                  y2={toPt.screen.y}
                  stroke="#f59e0b"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              )}

              {/* Offset Dimension Pill Badge */}
              <g transform={`translate(${badgeX}, ${badgeY})`}>
                <rect
                  x="-42"
                  y="-11"
                  width="84"
                  height="22"
                  rx="6"
                  fill={isSelected ? '#f59e0b' : isDark ? '#0f172a' : '#ffffff'}
                  stroke={isSelected ? '#b45309' : isDark ? '#334155' : '#cbd5e1'}
                  strokeWidth="1.2"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fill={isSelected ? '#0f172a' : isDark ? '#38bdf8' : '#047857'}
                >
                  {seg.distanceFeet} ft ({seg.distanceMeters}m)
                </text>
              </g>
            </g>
          );
        })}

        {/* ------------------------------------------------------------------ */}
        {/* D. MANUAL DRAWING ANNOTATIONS (TASK 10) */}
        {/* ------------------------------------------------------------------ */}
        {annotations.map((ann) => {
          const p1 = toScreen(ann.x, ann.y);
          const p2 = ann.x2 !== undefined && ann.y2 !== undefined ? toScreen(ann.x2, ann.y2) : null;

          if (ann.type === 'point') {
            return (
              <g key={ann.id} transform={`translate(${p1.x}, ${p1.y})`}>
                <circle r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                {ann.label && (
                  <text
                    x="9"
                    y="3"
                    fontSize="9"
                    fontWeight="bold"
                    fill={isDark ? '#fbbf24' : '#b45309'}
                  >
                    {ann.label}
                  </text>
                )}
              </g>
            );
          }

          if (ann.type === 'line' && p2) {
            return (
              <line
                key={ann.id}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={ann.color || '#a855f7'}
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            );
          }

          if (ann.type === 'rectangle' && p2) {
            const rx = Math.min(p1.x, p2.x);
            const ry = Math.min(p1.y, p2.y);
            const rw = Math.abs(p2.x - p1.x);
            const rh = Math.abs(p2.y - p1.y);
            return (
              <rect
                key={ann.id}
                x={rx}
                y={ry}
                width={rw}
                height={rh}
                fill="rgba(56, 189, 248, 0.15)"
                stroke={ann.color || '#38bdf8'}
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            );
          }

          if (ann.type === 'text') {
            return (
              <g key={ann.id} transform={`translate(${p1.x}, ${p1.y})`}>
                <rect
                  x="-4"
                  y="-12"
                  width={(ann.text?.length || 5) * 7 + 10}
                  height="16"
                  rx="4"
                  fill={isDark ? '#0f172a' : '#ffffff'}
                  stroke="#38bdf8"
                  strokeWidth="0.8"
                />
                <text x="2" y="0" fontSize="9" fontWeight="bold" fill="#38bdf8">
                  {ann.text}
                </text>
              </g>
            );
          }

          if (ann.type === 'dimension' && p2) {
            const distM = Math.sqrt((ann.x2! - ann.x) ** 2 + (ann.y2! - ann.y) ** 2);
            const distFt = (distM * 3.28084).toFixed(1);
            return (
              <g key={ann.id}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#ec4899"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                  markerEnd="url(#arrowEnd)"
                />
                <text
                  x={(p1.x + p2.x) / 2}
                  y={(p1.y + p2.y) / 2 - 6}
                  fontSize="9"
                  fontWeight="bold"
                  fill="#ec4899"
                  textAnchor="middle"
                >
                  {distFt} ft
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* ------------------------------------------------------------------ */}
        {/* E. SURVEY POINT MARKERS & LABELS (TASK 3) */}
        {/* ------------------------------------------------------------------ */}
        {screenPoints.map((pt) => {
          const isSelected = selectedPointId === pt.id;

          return (
            <g
              key={pt.id}
              className="cursor-pointer transition-transform duration-100"
              transform={`translate(${pt.screen.x}, ${pt.screen.y})`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPoint(isSelected ? null : pt);
              }}
            >
              {/* Outer Selection Radar Ring */}
              {isSelected && (
                <circle
                  r="18"
                  fill="rgba(245, 158, 11, 0.25)"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  className="animate-pulse"
                />
              )}

              {/* Point Marker Circle */}
              <circle
                r="10"
                fill={isSelected ? '#f59e0b' : '#059669'}
                stroke="#ffffff"
                strokeWidth="2"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
              />

              {/* Sequential Letter (A, B, C, D...) */}
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fontSize="10"
                fontWeight="900"
                fill="#ffffff"
              >
                {pt.label}
              </text>

              {/* Point Coordinate Tooltip Badge */}
              <g transform="translate(13, -12)">
                <rect
                  x="0"
                  y="-8"
                  width="44"
                  height="16"
                  rx="4"
                  fill={isDark ? '#0f172a' : '#ffffff'}
                  stroke={isSelected ? '#f59e0b' : isDark ? '#334155' : '#e2e8f0'}
                  strokeWidth="1"
                  filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
                />
                <text
                  x="4"
                  y="4"
                  fontSize="8.5"
                  fontWeight="bold"
                  fill={isSelected ? '#f59e0b' : textColor}
                >
                  {pt.label} (P{pt.label})
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
