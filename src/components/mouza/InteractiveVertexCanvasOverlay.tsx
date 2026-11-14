import React, { useRef } from 'react';
import { DigitizedDagPoint, Language, VertexPointType } from '../../types';
import { SegmentInfo, SnapResult } from '../../lib/vertex-editing';

interface InteractiveVertexCanvasOverlayProps {
  points: DigitizedDagPoint[];
  selectedPointIndex: number | null;
  segments: SegmentInfo[];
  zoom: number;
  isEditMode: boolean;
  isSnapEnabled: boolean;
  snapResult?: SnapResult | null;
  lang: Language;
  polygonColor?: string;
  onSelectPoint: (index: number) => void;
  onPointDrag: (index: number, newX: number, newY: number) => void;
  onPointDragEnd: () => void;
  onAddPointOnSegment: (segmentIndex: number, coords: { x: number; y: number }) => void;
}

export const InteractiveVertexCanvasOverlay: React.FC<InteractiveVertexCanvasOverlayProps> = ({
  points,
  selectedPointIndex,
  segments,
  zoom,
  isEditMode,
  isSnapEnabled,
  snapResult,
  lang,
  polygonColor = '#10b981',
  onSelectPoint,
  onPointDrag,
  onPointDragEnd,
  onAddPointOnSegment,
}) => {
  const isBn = lang === 'bn';
  const draggingIndexRef = useRef<number | null>(null);

  if (!points || points.length === 0) return null;

  // Render SVG polygon path data
  const pathData =
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
    (points.length >= 3 ? ' Z' : '');

  // Helper for vertex icon by type
  const renderPointIcon = (
    p: DigitizedDagPoint,
    idx: number,
    isSelected: boolean
  ) => {
    const type: VertexPointType = p.sourceType || 'digitized';
    const radius = isSelected ? 6.5 / zoom : 5 / zoom;

    // 1. GPS Point: Diamond
    if (type === 'gps') {
      const dSize = isSelected ? 8 / zoom : 6 / zoom;
      return (
        <polygon
          points={`
            ${p.x},${p.y - dSize} 
            ${p.x + dSize},${p.y} 
            ${p.x},${p.y + dSize} 
            ${p.x - dSize},${p.y}
          `}
          fill={isSelected ? '#38bdf8' : '#06b6d4'}
          stroke="#ffffff"
          strokeWidth={1.8 / zoom}
        />
      );
    }

    // 2. Manually added/edited point: Circle with inner dot
    if (type === 'manual') {
      return (
        <g>
          <circle
            cx={p.x}
            cy={p.y}
            r={radius}
            fill={isSelected ? '#f59e0b' : '#d97706'}
            stroke="#ffffff"
            strokeWidth={1.8 / zoom}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={radius * 0.4}
            fill="#ffffff"
          />
        </g>
      );
    }

    // 3. Control point: Target circle with cross
    if (type === 'control') {
      return (
        <g>
          <circle
            cx={p.x}
            cy={p.y}
            r={radius + 1.5 / zoom}
            fill="none"
            stroke="#818cf8"
            strokeWidth={1.5 / zoom}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={radius * 0.6}
            fill="#6366f1"
            stroke="#ffffff"
            strokeWidth={1 / zoom}
          />
        </g>
      );
    }

    // 4. Default digitized vertex: Emerald circle
    return (
      <circle
        cx={p.x}
        cy={p.y}
        r={radius}
        fill={isSelected ? '#10b981' : '#059669'}
        stroke="#ffffff"
        strokeWidth={1.8 / zoom}
      />
    );
  };

  return (
    <g className="select-none">
      {/* 1. Main Boundary Polygon Surface */}
      <path
        d={pathData}
        fill={polygonColor}
        fillOpacity={isEditMode ? 0.22 : 0.16}
        stroke={polygonColor}
        strokeWidth={(isEditMode ? 2.8 : 2) / zoom}
        strokeDasharray={isEditMode ? `${6 / zoom}, ${3 / zoom}` : undefined}
      />

      {/* 2. Boundary Segment Dimensions (Side lengths in feet) */}
      {segments.map((seg) => (
        <g key={`seg-lbl-${seg.index}`}>
          {/* Subtle line indicator */}
          <line
            x1={points[seg.fromIndex].x}
            y1={points[seg.fromIndex].y}
            x2={points[seg.toIndex].x}
            y2={points[seg.toIndex].y}
            stroke={polygonColor}
            strokeWidth={1.5 / zoom}
            opacity={0.4}
          />

          {/* Segment distance badge */}
          <g transform={`translate(${seg.midX}, ${seg.midY})`}>
            <rect
              x={-16 / zoom}
              y={-8 / zoom}
              width={32 / zoom}
              height={14 / zoom}
              rx={4 / zoom}
              fill="#0f172a"
              fillOpacity={0.88}
              stroke="#334155"
              strokeWidth={0.8 / zoom}
            />
            <text
              x={0}
              y={2 / zoom}
              textAnchor="middle"
              fill="#f1f5f9"
              fontSize={8.5 / zoom}
              fontWeight="bold"
              fontFamily="monospace"
              pointerEvents="none"
            >
              {seg.lengthFt}′
            </text>
          </g>

          {/* 3. Midpoint "➕" Handle to Add Vertex (Only in Edit Mode) */}
          {isEditMode && (
            <g
              transform={`translate(${seg.midX}, ${seg.midY})`}
              className="cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                onAddPointOnSegment(seg.index, { x: seg.midX, y: seg.midY });
              }}
            >
              {/* Invisible touch hitbox */}
              <circle
                cx={0}
                cy={0}
                r={16 / zoom}
                fill="transparent"
              />
              {/* Visible Add Button */}
              <circle
                cx={0}
                cy={0}
                r={6 / zoom}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={1.2 / zoom}
                className="transition-transform group-hover:scale-125"
              />
              {/* Plus icon lines */}
              <line
                x1={-3 / zoom}
                y1={0}
                x2={3 / zoom}
                y2={0}
                stroke="#ffffff"
                strokeWidth={1.2 / zoom}
                pointerEvents="none"
              />
              <line
                x1={0}
                y1={-3 / zoom}
                x2={0}
                y2={3 / zoom}
                stroke="#ffffff"
                strokeWidth={1.2 / zoom}
                pointerEvents="none"
              />
            </g>
          )}
        </g>
      ))}

      {/* 4. Active Snap Visual Indicator */}
      {isSnapEnabled && snapResult?.isSnapped && (
        <g>
          <circle
            cx={snapResult.x}
            cy={snapResult.y}
            r={12 / zoom}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={2 / zoom}
            strokeDasharray={`${3 / zoom}, ${2 / zoom}`}
            className="animate-pulse"
          />
          <circle
            cx={snapResult.x}
            cy={snapResult.y}
            r={3 / zoom}
            fill="#06b6d4"
          />
        </g>
      )}

      {/* 5. Interactive Vertex Handles */}
      {points.map((pt, idx) => {
        const isSelected = selectedPointIndex === idx;

        return (
          <g
            key={pt.id || `vtx-${idx}`}
            className="group cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              // Critical: Stop propagation to prevent background map pan!
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              draggingIndexRef.current = idx;
              onSelectPoint(idx);
            }}
            onPointerMove={(e) => {
              if (draggingIndexRef.current !== idx) return;
              e.stopPropagation();

              // Transform client position to SVG local coordinates
              const svgElement = e.currentTarget.ownerSVGElement;
              if (!svgElement) return;

              const ctm = svgElement.getScreenCTM();
              if (!ctm) return;

              const svgPoint = svgElement.createSVGPoint();
              svgPoint.x = e.clientX;
              svgPoint.y = e.clientY;
              const localPt = svgPoint.matrixTransform(ctm.inverse());

              onPointDrag(idx, localPt.x, localPt.y);
            }}
            onPointerUp={(e) => {
              if (draggingIndexRef.current === idx) {
                e.stopPropagation();
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch (err) {
                  // Ignore
                }
                draggingIndexRef.current = null;
                onPointDragEnd();
              }
            }}
            onPointerCancel={(e) => {
              if (draggingIndexRef.current === idx) {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch (err) {
                  // Ignore
                }
                draggingIndexRef.current = null;
                onPointDragEnd();
              }
            }}
          >
            {/* Invisible Large Touch Target for Android Mobile (min 44px equivalent) */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={25 / zoom}
              fill="transparent"
              className="cursor-grab active:cursor-grabbing"
            />

            {/* Selected Pulsing Halo */}
            {isSelected && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={14 / zoom}
                fill="none"
                stroke={isEditMode ? '#f59e0b' : '#38bdf8'}
                strokeWidth={2 / zoom}
                strokeDasharray={`${3 / zoom}, ${2 / zoom}`}
              />
            )}

            {/* Visible Colored Point Icon */}
            {renderPointIcon(pt, idx, isSelected)}

            {/* Vertex Number/Label */}
            <text
              x={pt.x + 8 / zoom}
              y={pt.y - 7 / zoom}
              fill={isSelected ? '#fde047' : '#ffffff'}
              fontSize={10 / zoom}
              fontWeight="bold"
              filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.9))"
              pointerEvents="none"
            >
              {pt.label || `V${idx + 1}`}
            </text>
          </g>
        );
      })}
    </g>
  );
};
