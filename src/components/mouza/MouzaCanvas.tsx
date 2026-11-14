import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  CheckCircle,
  CheckCircle2,
  X,
  Crosshair,
  Layers,
  MapPin,
  Compass,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Info,
  Ruler,
  Tag,
  Target,
  Hand,
  Edit3,
  Trash2,
} from 'lucide-react';
import { DigitizedDagRecord, DigitizedDagPoint, Language, SurveyRecord } from '../../types';
import { LatLngPoint, filterValidPoints } from '../../lib/gps-geometry';
import { InteractiveVertexCanvasOverlay } from './InteractiveVertexCanvasOverlay';
import { SegmentInfo, SnapResult } from '../../lib/vertex-editing';
import { LAND_CONSTANTS } from '../../lib/land-units';
import { calculateDagPolygonArea } from '../../lib/mouza-map';

export interface MouzaMapMetadata {
  title?: string;
  mouza?: string;
  jlNo?: string;
  sheetNo?: string;
  surveyType?: string;
  district?: string;
  upazila?: string;
  scaleText?: string;
}

interface MouzaCanvasProps {
  backgroundImageUrl?: string;
  sourceType?: string;
  digitizedDags: DigitizedDagRecord[];
  selectedDagId: string | null;
  activeDrawingPoints: { x: number; y: number }[];
  isDrawingMode: boolean;
  showGpsOverlay: boolean;
  gpsSurveyPoints?: LatLngPoint[];
  selectedSurvey?: SurveyRecord | null;
  lang: Language;
  onCanvasClick: (pt: { x: number; y: number }) => void;
  onSelectDag: (dagId: string | null) => void;
  scalePixelsPerFoot?: number;
  mapMetadata?: MouzaMapMetadata;
  // Advanced Vertex Editing props
  isVertexEditMode?: boolean;
  activeEditPoints?: DigitizedDagPoint[];
  selectedVertexIndex?: number | null;
  isSnapEnabled?: boolean;
  snapResult?: SnapResult | null;
  segments?: SegmentInfo[];
  onSelectVertex?: (index: number) => void;
  onVertexDrag?: (index: number, newX: number, newY: number) => void;
  onVertexDragEnd?: () => void;
  onAddVertexOnSegment?: (segmentIndex: number, coords: { x: number; y: number }) => void;
  onCenterParcelTrigger?: () => void;
  // Simple Professional Measurement tool props (Phase 20J.2)
  isMeasureMode?: boolean;
  onToggleMeasureMode?: (active: boolean) => void;
  // Phase 3B: Field Boundary Editing
  isFieldBoundaryEditMode?: boolean;
  isDemarcationView?: boolean;
  tracingInteractionMode?: 'draw' | 'pan';
  fitViewTrigger?: number;
}

export const MouzaCanvas: React.FC<MouzaCanvasProps> = ({
  backgroundImageUrl,
  sourceType,
  digitizedDags,
  selectedDagId,
  activeDrawingPoints,
  isDrawingMode,
  showGpsOverlay,
  gpsSurveyPoints = [],
  selectedSurvey,
  lang,
  onCanvasClick,
  onSelectDag,
  scalePixelsPerFoot = 1.0,
  mapMetadata,
  isVertexEditMode = false,
  activeEditPoints = [],
  selectedVertexIndex = null,
  isSnapEnabled = true,
  snapResult = null,
  segments = [],
  onSelectVertex,
  onVertexDrag,
  onVertexDragEnd,
  onAddVertexOnSegment,
  isMeasureMode: isMeasureModeProp,
  onToggleMeasureMode,
  isFieldBoundaryEditMode = false,
  isDemarcationView = false,
  tracingInteractionMode = 'draw',
  fitViewTrigger = 0,
}) => {
  const isBn = lang === 'bn';
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 650,
    height: 460,
  });

  // Pan & Zoom State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);

  // Keep refs in sync with state for instantaneous touch event calculations
  panRef.current = pan;
  zoomRef.current = zoom;

  const [isMouseDragging, setIsMouseDragging] = useState<boolean>(false);
  const mouseDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Animation frame request ID to batch high-frequency touch updates into 60fps renders
  const animFrameIdRef = useRef<number | null>(null);

  const scheduleTransform = useCallback((newPanX: number, newPanY: number, newZoom: number) => {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    animFrameIdRef.current = requestAnimationFrame(() => {
      animFrameIdRef.current = null;
      setPan({ x: Math.round(newPanX * 10) / 10, y: Math.round(newPanY * 10) / 10 });
      setZoom(Math.round(newZoom * 1000) / 1000);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  // Prevent browser-level native pinch gesture from interfering with canvas on mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventBrowserPinch = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', preventBrowserPinch, { passive: false });
    return () => {
      el.removeEventListener('touchmove', preventBrowserPinch);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Simple Professional Measurement Tool State (Phase 20J.2)
  // ---------------------------------------------------------------------------
  const [internalMeasureActive, setInternalMeasureActive] = useState<boolean>(false);
  const isMeasureActive = isMeasureModeProp !== undefined ? isMeasureModeProp : internalMeasureActive;
  const setIsMeasureActive = useCallback(
    (active: boolean) => {
      setInternalMeasureActive(active);
      onToggleMeasureMode?.(active);
    },
    [onToggleMeasureMode]
  );

  const [measureUnit, setMeasureUnit] = useState<'feet' | 'link'>('feet');
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const [isMeasureClosed, setIsMeasureClosed] = useState<boolean>(false);
  const [draggingMeasurePointIndex, setDraggingMeasurePointIndex] = useState<number | null>(null);
  const draggingMeasurePointIndexRef = useRef<number | null>(null);

  // Measure touch tap vs drag tracking
  const touchStartCoordRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchMovedRef = useRef<boolean>(false);

  // Helper to convert English digits to Bengali
  const toBengaliNumber = useCallback((num: number | string): string => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
  }, []);

  // Center on Selected Parcel
  const handleCenterOnSelectedParcel = useCallback(() => {
    const targetDag = digitizedDags.find((d) => d.id === selectedDagId);
    if (!targetDag || !targetDag.points || targetDag.points.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    targetDag.points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const parcelWidth = Math.max(maxX - minX, 40);
    const parcelHeight = Math.max(maxY - minY, 40);

    // Compute comfortable zoom to frame parcel nicely
    const targetZoom = Math.min(
      2.5,
      Math.max(
        0.8,
        Math.min(
          (dimensions.width * 0.65) / parcelWidth,
          (dimensions.height * 0.65) / parcelHeight
        )
      )
    );

    const roundedZoom = Math.round(targetZoom * 100) / 100;
    setZoom(roundedZoom);
    setPan({
      x: Math.round(dimensions.width / 2 - centerX * roundedZoom),
      y: Math.round(dimensions.height / 2 - centerY * roundedZoom),
    });
  }, [digitizedDags, selectedDagId, dimensions]);

  useEffect(() => {
    if (fitViewTrigger > 0) {
      handleCenterOnSelectedParcel();
    }
  }, [fitViewTrigger, handleCenterOnSelectedParcel]);

  // Measurement segments calculation
  const measureSegments = useMemo(() => {
    if (measurePoints.length < 2) return [];
    const segs: {
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      midX: number;
      midY: number;
      distFeet: number;
      distLink: number;
      label: string;
    }[] = [];
    const count = isMeasureClosed ? measurePoints.length : measurePoints.length - 1;
    for (let i = 0; i < count; i++) {
      const p1 = measurePoints[i];
      const p2 = measurePoints[(i + 1) % measurePoints.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distPx = Math.hypot(dx, dy);
      const distFeet = distPx / (scalePixelsPerFoot || 1.0);
      const distLink = distFeet / LAND_CONSTANTS.FEET_PER_LINK; // 0.66 ft per link
      const val = measureUnit === 'feet' ? distFeet : distLink;
      const unitLabel = measureUnit === 'feet' ? (isBn ? 'ফু.' : 'ft') : (isBn ? 'লি.' : 'lk');
      const numStr = isBn ? toBengaliNumber(val.toFixed(1)) : val.toFixed(1);
      segs.push({
        p1,
        p2,
        midX: (p1.x + p2.x) / 2,
        midY: (p1.y + p2.y) / 2,
        distFeet,
        distLink,
        label: `${numStr} ${unitLabel}`,
      });
    }
    return segs;
  }, [measurePoints, isMeasureClosed, scalePixelsPerFoot, measureUnit, isBn, toBengaliNumber]);

  // Total Perimeter calculation
  const totalPerimeterFt = useMemo(() => {
    return measureSegments.reduce((sum, s) => sum + s.distFeet, 0);
  }, [measureSegments]);

  const formattedPerimeter = useMemo(() => {
    if (measureSegments.length === 0) return isBn ? '০ ফুট' : '0 ft';
    if (measureUnit === 'feet') {
      const val = totalPerimeterFt.toFixed(1);
      return isBn ? `${toBengaliNumber(val)} ফুট` : `${val} ft`;
    } else {
      const linkVal = (totalPerimeterFt / LAND_CONSTANTS.FEET_PER_LINK).toFixed(1);
      return isBn ? `${toBengaliNumber(linkVal)} লিঙ্ক` : `${linkVal} lk`;
    }
  }, [totalPerimeterFt, measureUnit, isBn, toBengaliNumber, measureSegments.length]);

  // Polygon Area calculation when closed (3+ points)
  const measureAreaResult = useMemo(() => {
    if (!isMeasureClosed || measurePoints.length < 3) return null;
    return calculateDagPolygonArea(measurePoints, scalePixelsPerFoot || 1.0);
  }, [isMeasureClosed, measurePoints, scalePixelsPerFoot]);

  const formattedDecimalArea = useMemo(() => {
    if (!measureAreaResult) return '';
    const decimal = measureAreaResult.areaDecimal;
    const decimalStr = decimal.toFixed(2);
    return isBn ? `${toBengaliNumber(decimalStr)} শতাংশ / শতক` : `${decimalStr} Decimal`;
  }, [measureAreaResult, isBn, toBengaliNumber]);

  const formattedSubArea = useMemo(() => {
    if (!measureAreaResult) return '';
    if (measureUnit === 'feet') {
      const sqFt = Math.round(measureAreaResult.areaSqFt);
      const str = sqFt.toLocaleString('en-US');
      return isBn ? `${toBengaliNumber(str)} বর্গফুট` : `${str} sq ft`;
    } else {
      const sqLink = Math.round(
        measureAreaResult.areaSqFt /
          (LAND_CONSTANTS.FEET_PER_LINK * LAND_CONSTANTS.FEET_PER_LINK)
      );
      const str = sqLink.toLocaleString('en-US');
      return isBn ? `${toBengaliNumber(str)} বর্গলিঙ্ক` : `${str} sq link`;
    }
  }, [measureAreaResult, measureUnit, isBn, toBengaliNumber]);

  // Measurement Action Handlers
  const handleUndoMeasurePoint = () => {
    if (isMeasureClosed) {
      setIsMeasureClosed(false);
    } else if (measurePoints.length > 0) {
      setMeasurePoints((prev) => prev.slice(0, -1));
    }
  };

  const handleToggleClosePolygon = () => {
    if (measurePoints.length >= 3) {
      setIsMeasureClosed((prev) => !prev);
    }
  };

  const handleClearMeasure = () => {
    setMeasurePoints([]);
    setIsMeasureClosed(false);
    setDraggingMeasurePointIndex(null);
    draggingMeasurePointIndexRef.current = null;
  };

  // Enhanced touch gesture tracking for Mobile (Focal-point Pinch to Zoom + Smooth 1-finger Pan)
  const touchStateRef = useRef<{
    isPanning: boolean;
    isPinching: boolean;
    startX: number;
    startY: number;
    initialPan: { x: number; y: number };
    initialDist: number;
    initialZoom: number;
    focalWorldX: number;
    focalWorldY: number;
  }>({
    isPanning: false,
    isPinching: false,
    startX: 0,
    startY: 0,
    initialPan: { x: 0, y: 0 },
    initialDist: 0,
    initialZoom: 1,
    focalWorldX: 0,
    focalWorldY: 0,
  });

  // Visual Display Toggles (Inspired by Professional Cadastral Reference Image)
  const [showDagLabels, setShowDagLabels] = useState<boolean>(true);
  const [showMeasurements, setShowMeasurements] = useState<boolean>(true);
  const [showVertexHandles, setShowVertexHandles] = useState<boolean>(true);
  const [showParcelFill, setShowParcelFill] = useState<boolean>(true);
  const [showNorthCompass, setShowNorthCompass] = useState<boolean>(true);
  const [showMapInfo, setShowMapInfo] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false); // Cadastral paper default: warm light paper
  const [showTogglesMenu, setShowTogglesMenu] = useState<boolean>(false);

  // Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(Math.max(380, height)),
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Mouse Pan & Measurement Drag Handlers
  // ---------------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDrawingMode && e.button === 0 && tracingInteractionMode !== 'pan') return;

    // Check if clicking an existing measurement point to drag
    if (isMeasureActive && e.button === 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      for (let i = 0; i < measurePoints.length; i++) {
        const pt = measurePoints[i];
        const screenX = rect.left + panRef.current.x + pt.x * zoomRef.current;
        const screenY = rect.top + panRef.current.y + pt.y * zoomRef.current;
        if (Math.hypot(e.clientX - screenX, e.clientY - screenY) <= 16) {
          draggingMeasurePointIndexRef.current = i;
          setDraggingMeasurePointIndex(i);
          return;
        }
      }
    }

    if (e.button === 0 || e.button === 1) {
      setIsMouseDragging(true);
      mouseDragStartRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // If dragging a measurement point on desktop
    if (isMeasureActive && draggingMeasurePointIndexRef.current !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const newX = Math.round((clientX - panRef.current.x) / zoomRef.current);
      const newY = Math.round((clientY - panRef.current.y) / zoomRef.current);
      const idx = draggingMeasurePointIndexRef.current;
      setMeasurePoints((prev) => {
        const copy = [...prev];
        if (copy[idx]) copy[idx] = { x: newX, y: newY };
        return copy;
      });
      return;
    }

    if (!isMouseDragging) return;
    const dx = e.clientX - mouseDragStartRef.current.x;
    const dy = e.clientY - mouseDragStartRef.current.y;
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    if (isMeasureActive && draggingMeasurePointIndexRef.current !== null) {
      draggingMeasurePointIndexRef.current = null;
      setDraggingMeasurePointIndex(null);
      return;
    }
    setIsMouseDragging(false);
  };

  // ---------------------------------------------------------------------------
  // Touch Gestures (Mobile Focal-Point Pinch Zoom, Smooth Pan & Measure Drag)
  // ---------------------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDrawingMode && tracingInteractionMode !== 'pan') return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartCoordRef.current = { x: touch.clientX, y: touch.clientY };
      touchMovedRef.current = false;

      // Check if touching an existing measurement point to drag
      if (isMeasureActive && measurePoints.length > 0 && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        for (let i = 0; i < measurePoints.length; i++) {
          const pt = measurePoints[i];
          const screenX = rect.left + panRef.current.x + pt.x * zoomRef.current;
          const screenY = rect.top + panRef.current.y + pt.y * zoomRef.current;
          if (Math.hypot(touch.clientX - screenX, touch.clientY - screenY) <= 24) {
            draggingMeasurePointIndexRef.current = i;
            setDraggingMeasurePointIndex(i);
            return;
          }
        }
      }

      // 1-finger Pan: anchor from current touch position
      touchStateRef.current = {
        isPanning: true,
        isPinching: false,
        startX: touch.clientX,
        startY: touch.clientY,
        initialPan: { ...panRef.current },
        initialDist: 0,
        initialZoom: zoomRef.current,
        focalWorldX: 0,
        focalWorldY: 0,
      };
    } else if (e.touches.length >= 2) {
      draggingMeasurePointIndexRef.current = null;
      setDraggingMeasurePointIndex(null);
      touchMovedRef.current = true;

      // 2-finger Pinch Zoom + Simultaneous Pan
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      // Exact world coordinate beneath the midpoint of the two fingers
      const focalWorldX = (midX - panRef.current.x) / zoomRef.current;
      const focalWorldY = (midY - panRef.current.y) / zoomRef.current;

      touchStateRef.current = {
        isPanning: false,
        isPinching: true,
        startX: midX,
        startY: midY,
        initialPan: { ...panRef.current },
        initialDist: Math.max(dist, 10),
        initialZoom: zoomRef.current,
        focalWorldX,
        focalWorldY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDrawingMode && tracingInteractionMode !== 'pan') return;

    // If dragging a measurement point on mobile
    if (isMeasureActive && draggingMeasurePointIndexRef.current !== null && containerRef.current) {
      const touch = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;
      const newX = Math.round((clientX - panRef.current.x) / zoomRef.current);
      const newY = Math.round((clientY - panRef.current.y) / zoomRef.current);
      const idx = draggingMeasurePointIndexRef.current;
      setMeasurePoints((prev) => {
        const copy = [...prev];
        if (copy[idx]) copy[idx] = { x: newX, y: newY };
        return copy;
      });
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (
        Math.hypot(
          touch.clientX - touchStartCoordRef.current.x,
          touch.clientY - touchStartCoordRef.current.y
        ) > 7
      ) {
        touchMovedRef.current = true;
      }
    }

    if (e.touches.length >= 2 && touchStateRef.current.isPinching && touchStateRef.current.initialDist > 0) {
      // 2-finger pinch with focal-point locking
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const currentMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const currentMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const scaleRatio = dist / touchStateRef.current.initialDist;
      const targetZoom = Math.min(20, Math.max(0.3, touchStateRef.current.initialZoom * scaleRatio));

      // Re-anchor pan so focal coordinate stays directly under the current pinch midpoint
      const targetPanX = currentMidX - touchStateRef.current.focalWorldX * targetZoom;
      const targetPanY = currentMidY - touchStateRef.current.focalWorldY * targetZoom;

      scheduleTransform(targetPanX, targetPanY, targetZoom);
    } else if (e.touches.length === 1 && touchStateRef.current.isPanning) {
      // Smooth 1-finger pan
      const touch = e.touches[0];
      const dx = touch.clientX - touchStateRef.current.startX;
      const dy = touch.clientY - touchStateRef.current.startY;
      const targetPanX = touchStateRef.current.initialPan.x + dx;
      const targetPanY = touchStateRef.current.initialPan.y + dy;

      scheduleTransform(targetPanX, targetPanY, zoomRef.current);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isMeasureActive && draggingMeasurePointIndexRef.current !== null) {
      draggingMeasurePointIndexRef.current = null;
      setDraggingMeasurePointIndex(null);
      return;
    }

    // Tap on map while measuring on mobile touch
    if (
      isMeasureActive &&
      !touchMovedRef.current &&
      e.touches.length === 0 &&
      containerRef.current
    ) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = touchStartCoordRef.current.x - rect.left;
      const clientY = touchStartCoordRef.current.y - rect.top;
      const canvasX = Math.round((clientX - panRef.current.x) / zoomRef.current);
      const canvasY = Math.round((clientY - panRef.current.y) / zoomRef.current);
      setMeasurePoints((prev) => [...prev, { x: canvasX, y: canvasY }]);
    }

    if (e.touches.length === 0) {
      touchStateRef.current.isPanning = false;
      touchStateRef.current.isPinching = false;
    } else if (e.touches.length === 1) {
      // Seamlessly transition from 2-finger pinch to 1-finger pan without position jump
      const touch = e.touches[0];
      touchStateRef.current.isPinching = false;
      touchStateRef.current.isPanning = true;
      touchStateRef.current.startX = touch.clientX;
      touchStateRef.current.startY = touch.clientY;
      touchStateRef.current.initialPan = { ...panRef.current };
    }
  };

  // Mouse Wheel Focal Zoom for trackpads & mice
  const handleWheel = (e: React.WheelEvent) => {
    if (isDrawingMode && tracingInteractionMode !== 'pan') return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const targetZoom = Math.min(20, Math.max(0.3, Math.round(zoomRef.current * zoomFactor * 100) / 100));

    const worldX = (cursorX - panRef.current.x) / zoomRef.current;
    const worldY = (cursorY - panRef.current.y) / zoomRef.current;

    const targetPanX = Math.round(cursorX - worldX * targetZoom);
    const targetPanY = Math.round(cursorY - worldY * targetZoom);

    scheduleTransform(targetPanX, targetPanY, targetZoom);
  };

  // Canvas Click (for adding vertices in drawing mode or measurement points)
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isMeasureActive) {
      if (draggingMeasurePointIndexRef.current !== null) return;
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const canvasX = Math.round((clientX - pan.x) / zoom);
      const canvasY = Math.round((clientY - pan.y) / zoom);
      setMeasurePoints((prev) => [...prev, { x: canvasX, y: canvasY }]);
      return;
    }
    if (!isDrawingMode || !svgRef.current || tracingInteractionMode === 'pan') return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const canvasX = Math.round((clientX - pan.x) / zoom);
    const canvasY = Math.round((clientY - pan.y) / zoom);
    onCanvasClick({ x: canvasX, y: canvasY });
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(20, Math.round((z + 0.25) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.35, Math.round((z - 0.25) * 100) / 100));
  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // GPS Survey Overlay preparation
  const validGpsPoints = useMemo(() => filterValidPoints(gpsSurveyPoints), [gpsSurveyPoints]);

  const gpsOverlayPolygon = useMemo(() => {
    if (!showGpsOverlay || validGpsPoints.length < 3) return null;
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    validGpsPoints.forEach((p) => {
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
    });

    const spanLng = Math.max(maxLng - minLng, 0.00001);
    const spanLat = Math.max(maxLat - minLat, 0.00001);

    const targetW = 220;
    const targetH = 170;
    const offsetX = 100;
    const offsetY = 90;

    const pts = validGpsPoints.map((p) => {
      const relX = ((p.longitude - minLng) / spanLng) * targetW;
      const relY = (1 - (p.latitude - minLat) / spanLat) * targetH;
      return {
        x: Math.round(offsetX + relX),
        y: Math.round(offsetY + relY),
        label: p.label || '',
        lat: p.latitude,
        lng: p.longitude,
      };
    });

    const pathData = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z';
    return { pts, pathData };
  }, [showGpsOverlay, validGpsPoints]);

  // Restrained Pastel Cadastral Parcel Colors (Ref Image Inspiration)
  const pastelColorPalette = [
    { fill: '#dcfce7', stroke: '#15803d', accent: '#16a34a' }, // Soft Emerald / Agriculture
    { fill: '#e0f2fe', stroke: '#0369a1', accent: '#0284c7' }, // Pale Sky / Residential
    { fill: '#fef3c7', stroke: '#b45309', accent: '#d97706' }, // Warm Amber / Commercial
    { fill: '#ede9fe', stroke: '#6d28d9', accent: '#7c3aed' }, // Soft Lavender
    { fill: '#ffe4e6', stroke: '#be123c', accent: '#e11d48' }, // Rose Pastel
    { fill: '#ccfbf1', stroke: '#0f766e', accent: '#0d9488' }, // Mint Teal
  ];

  // Selected Dag object
  const selectedDag = useMemo(() => {
    return digitizedDags.find((d) => d.id === selectedDagId) || null;
  }, [digitizedDags, selectedDagId]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[400px] sm:h-[480px] rounded-2xl overflow-hidden border select-none transition-colors duration-200 ${
        isDarkMode
          ? 'bg-slate-900 border-slate-700/80 shadow-inner'
          : 'bg-[#fcfbfa] border-slate-300/90 shadow-md'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      {/* -------------------------------------------------------------------- */}
      {/* Cadastral Sheet Subtle Grid Pattern */}
      {/* -------------------------------------------------------------------- */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          isDarkMode ? 'opacity-15' : 'opacity-40'
        }`}
        style={{
          backgroundImage: isDarkMode
            ? `
              linear-gradient(to right, #475569 1px, transparent 1px),
              linear-gradient(to bottom, #475569 1px, transparent 1px)
            `
            : `
              linear-gradient(to right, #cbd5e1 1px, transparent 1px),
              linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
            `,
          backgroundSize: '36px 36px',
        }}
      />

      {/* -------------------------------------------------------------------- */}
      {/* Top-Right Floating Controls (Pan, Zoom, Center, Reset, Theme) */}
      {/* -------------------------------------------------------------------- */}
      <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1.5 p-1 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-300/90 dark:border-slate-700 shadow-md">
        <button
          onClick={handleZoomIn}
          className="p-2 text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition active:scale-95"
          title={isBn ? 'জুম বড় করুন (+)' : 'Zoom In (+)'}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition active:scale-95"
          title={isBn ? 'জুম ছোট করুন (-)' : 'Zoom Out (-)'}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        {selectedDag && (
          <button
            onClick={handleCenterOnSelectedParcel}
            className="p-2 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/40 rounded-xl transition active:scale-95"
            title={isBn ? 'দাগের কেন্দ্রে যান' : 'Center on Selected Parcel'}
          >
            <Target className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleResetView}
          className="p-2 text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition active:scale-95"
          title={isBn ? 'রিসেট ভিউ' : 'Fit Map / Reset'}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 text-slate-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition active:scale-95 border-t border-slate-200 dark:border-slate-700"
          title={isDarkMode ? (isBn ? 'লাইট পেপার মোড' : 'Light Paper') : isBn ? 'ডার্ক মোড' : 'Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Top-Left Mode & Layer Status Bar */}
      {/* -------------------------------------------------------------------- */}
      {!isMeasureActive && (
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-110px)]">
          {/* Navigation vs Edit vs Tracing Mode Indicator */}
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold backdrop-blur-md shadow-xs flex items-center gap-1.5 ${
              isDrawingMode
                ? 'bg-amber-500 text-slate-950 border-amber-600'
                : isVertexEditMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/80 dark:text-amber-200 dark:border-amber-700'
                : isDarkMode
                ? 'bg-slate-800/90 text-emerald-400 border-slate-700'
                : 'bg-white/95 text-emerald-800 border-slate-300'
            }`}
          >
            {isDrawingMode ? (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isBn ? 'দাগ অঙ্কন মোড' : 'Tracing Dag'}</span>
              </>
            ) : isVertexEditMode ? (
              <>
                <Edit3 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                <span>{isBn ? 'পয়েন্ট এডিট মোড' : 'Vertex Edit Mode'}</span>
              </>
            ) : (
              <>
                <Hand className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>{isBn ? 'ম্যাপ নেভিগেশন' : 'Map Navigation'}</span>
              </>
            )}
          </div>

          {/* Simple Measurement Tool Button ("মাপুন") */}
          {!isDrawingMode && !isVertexEditMode && (
            <button
              type="button"
              onClick={() => setIsMeasureActive(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title={isBn ? 'নকশায় দূরত্ব ও ক্ষেত্রফল মাপুন' : 'Measure Distance & Area'}
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>{isBn ? 'মাপুন' : 'Measure'}</span>
            </button>
          )}

          {/* GPS Overlay Pill */}
          {showGpsOverlay && (
            <div className="px-2.5 py-1.5 rounded-xl bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-950/90 dark:text-cyan-300 dark:border-cyan-700 text-xs font-bold backdrop-blur-xs shadow-xs flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-cyan-700 dark:text-cyan-400" />
              <span className="hidden sm:inline">{isBn ? 'GPS ফিল্ড সীমানা' : 'GPS Field'}</span>
            </div>
          )}

          {/* Toggles Menu Trigger */}
          <button
            onClick={() => setShowTogglesMenu(!showTogglesMenu)}
            className="px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
            title={isBn ? 'ভিজ্যুয়াল লেয়ার টগল' : 'Layer Display Toggles'}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span className="text-[11px]">{isBn ? 'ভিউ অপশন' : 'Layers'}</span>
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Simple Professional Measurement Floating Control Bar (Phase 20J.2) */}
      {/* -------------------------------------------------------------------- */}
      {isMeasureActive && (
        <div className="absolute top-2.5 left-2.5 right-2.5 z-30 sm:right-auto sm:w-80 p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-amber-400 dark:border-amber-600 shadow-2xl space-y-2 text-xs select-none animate-fadeIn">
          {/* Header: Mode badge + Unit Toggle (Feet / Link) + Close */}
          <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[11px] shadow-2xs">
                <Ruler className="w-3.5 h-3.5" />
                <span>{isBn ? 'মাপুন' : 'Measure'}</span>
              </span>

              {/* Unit Toggle: Feet vs Link */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setMeasureUnit('feet')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    measureUnit === 'feet'
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {isBn ? 'ফুট' : 'Feet'}
                </button>
                <button
                  type="button"
                  onClick={() => setMeasureUnit('link')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    measureUnit === 'link'
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {isBn ? 'লিঙ্ক' : 'Link'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMeasureActive(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={isBn ? 'পরিমাপ মোড বন্ধ করুন' : 'Close measure mode'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons: Undo, Close Polygon, Clear */}
          <div className="flex items-center gap-1.5 font-bold">
            <button
              type="button"
              onClick={handleUndoMeasurePoint}
              disabled={measurePoints.length === 0}
              className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              title={isBn ? 'শেষ পয়েন্ট মুছুন' : 'Undo last point'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBn ? 'আনডু' : 'Undo'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleClosePolygon}
              disabled={measurePoints.length < 3}
              className={`flex-1 py-1.5 px-2 rounded-xl border transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:cursor-not-allowed ${
                isMeasureClosed
                  ? 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                  : measurePoints.length >= 3
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs hover:bg-emerald-800'
                  : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 opacity-40'
              }`}
              title={isBn ? 'বহুভুজ বন্ধ করুন' : 'Close polygon'}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isMeasureClosed
                  ? (isBn ? 'খোলা রাখুন' : 'Reopen')
                  : (isBn ? 'বন্ধ করুন' : 'Close')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleClearMeasure}
              disabled={measurePoints.length === 0}
              className="py-1.5 px-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-40 transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              title={isBn ? 'সব মুছুন' : 'Clear all'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBn ? 'পরিষ্কার' : 'Clear'}</span>
            </button>
          </div>

          {/* Real-time Distance & Area Display */}
          {measurePoints.length >= 1 && (
            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 space-y-1 text-[11px]">
              {measurePoints.length >= 2 ? (
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                  <span>{isBn ? 'মোট পরিসীমা:' : 'Total Perimeter:'}</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {formattedPerimeter}
                  </span>
                </div>
              ) : (
                <p className="text-slate-500 italic text-[10.5px]">
                  {isBn ? 'নকশায় দ্বিতীয় পয়েন্ট স্পর্শ/ক্লিক করুন' : 'Tap a 2nd point to measure length'}
                </p>
              )}

              {isMeasureClosed && measurePoints.length >= 3 && (
                <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                    <span>{isBn ? 'আনুমানিক ক্ষেত্রফল:' : 'Approx Area:'}</span>
                    <span className="font-mono text-emerald-800 dark:text-emerald-300 text-xs">
                      {formattedDecimalArea}
                    </span>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {formattedSubArea}
                  </div>
                </div>
              )}

              {/* Professional Safety Disclaimer */}
              <p className="text-[9px] text-amber-700 dark:text-amber-400 leading-tight italic pt-0.5">
                {isBn
                  ? '⚠️ নকশাভিত্তিক আনুমানিক পরিমাপ — আইনি সীমানা নির্ধারণের দলিল নয়।'
                  : '⚠️ Map-derived indicative measurement — not a legal boundary determination.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Dropdown / Floating Visual Toggles Panel */}
      {/* -------------------------------------------------------------------- */}
      {showTogglesMenu && (
        <div className="absolute top-12 left-2.5 z-30 w-56 p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xl space-y-1.5 text-xs text-slate-800 dark:text-slate-100 animate-fadeIn">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isBn ? 'ম্যাপ ডিসপ্লে টগল' : 'Display Options'}</span>
            </span>
            <button
              onClick={() => setShowTogglesMenu(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? 'দাগ নম্বর লেবেল' : 'Dag Labels'}</span>
            </span>
            <input
              type="checkbox"
              checked={showDagLabels}
              onChange={(e) => setShowDagLabels(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700"
            />
          </label>

          <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Ruler className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? 'বাহুর দৈর্ঘ্য পরিমাপ' : 'Side Lengths'}</span>
            </span>
            <input
              type="checkbox"
              checked={showMeasurements}
              onChange={(e) => setShowMeasurements(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700"
            />
          </label>

          <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? 'কোণ/শীর্ষবিন্দু মার্কার' : 'Vertex Handles'}</span>
            </span>
            <input
              type="checkbox"
              checked={showVertexHandles}
              onChange={(e) => setShowVertexHandles(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700"
            />
          </label>

          <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? 'প্যাস্টেল কালার ফিল' : 'Parcel Color Fill'}</span>
            </span>
            <input
              type="checkbox"
              checked={showParcelFill}
              onChange={(e) => setShowParcelFill(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700"
            />
          </label>

          <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? 'উত্তর কম্পাস' : 'North Compass'}</span>
            </span>
            <input
              type="checkbox"
              checked={showNorthCompass}
              onChange={(e) => setShowNorthCompass(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700"
            />
          </label>

          <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? 'ম্যাপ তথ্য ও লেজেন্ড' : 'Map Info Box'}</span>
            </span>
            <input
              type="checkbox"
              checked={showMapInfo}
              onChange={(e) => setShowMapInfo(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700"
            />
          </label>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* North Compass Rose (Inspired by Cadastral Maps) */}
      {/* -------------------------------------------------------------------- */}
      {showNorthCompass && (
        <div className="absolute top-16 right-3 z-15 pointer-events-none opacity-90 select-none">
          <div className="relative w-12 h-12 flex items-center justify-center">
            {/* Outer Compass Circle */}
            <div className="absolute inset-0 rounded-full border border-slate-400/60 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xs shadow-xs" />
            <svg viewBox="0 0 48 48" className="w-10 h-10">
              {/* Subtle crosshair lines */}
              <line x1="24" y1="6" x2="24" y2="42" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="1,2" />
              <line x1="6" y1="24" x2="42" y2="24" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="1,2" />
              {/* North Arrow Needle */}
              <polygon points="24,7 28,24 24,21 20,24" fill="#dc2626" />
              {/* South Arrow Needle */}
              <polygon points="24,41 28,24 24,27 20,24" fill="#64748b" />
              {/* North 'উ / N' Label */}
              <text x="24" y="5" textAnchor="middle" fill="#dc2626" fontSize="7" fontWeight="bold" fontFamily="sans-serif">
                {isBn ? 'উ' : 'N'}
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Map Sheet Metadata Box (Bottom-Left) */}
      {/* -------------------------------------------------------------------- */}
      {showMapInfo && mapMetadata && (
        <div className="absolute bottom-2.5 left-2.5 z-15 pointer-events-none max-w-[210px] p-2 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-300 dark:border-slate-700 shadow-md text-[10px] text-slate-800 dark:text-slate-200">
          <div className="font-black text-slate-900 dark:text-white truncate">
            {mapMetadata.title || (isBn ? 'মৌজা নকশা' : 'Cadastral Map')}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-slate-600 dark:text-slate-400 mt-0.5">
            {mapMetadata.mouza && (
              <span>
                {isBn ? 'মৌজা: ' : 'M: '}
                <strong className="text-slate-900 dark:text-slate-100">{mapMetadata.mouza}</strong>
              </span>
            )}
            {mapMetadata.jlNo && (
              <span>
                {isBn ? 'জে.এল: ' : 'JL: '}
                <strong className="text-slate-900 dark:text-slate-100">{mapMetadata.jlNo}</strong>
              </span>
            )}
            {mapMetadata.sheetNo && (
              <span>
                {isBn ? 'শীট: ' : 'Sh: '}
                <strong className="text-slate-900 dark:text-slate-100">{mapMetadata.sheetNo}</strong>
              </span>
            )}
          </div>
          <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[9px] text-slate-500">
            <span>{isBn ? '১৬" = ১ মাইল স্কেল' : 'Scale 16" = 1 Mile'}</span>
            <span className="font-mono">{(zoom * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Graphic Scale Bar (Bottom-Right) */}
      {/* -------------------------------------------------------------------- */}
      <div className="absolute bottom-2.5 right-2.5 z-15 pointer-events-none px-2 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs border border-slate-300 dark:border-slate-700 text-[9px] font-mono text-slate-700 dark:text-slate-300 flex flex-col items-end">
        <div className="flex items-center gap-1 font-bold">
          <span>0</span>
          <div
            className="h-1.5 bg-slate-900 dark:bg-slate-200 border border-slate-600 flex"
            style={{ width: `${Math.max(30, Math.min(120, 60 * zoom * scalePixelsPerFoot))}px` }}
          >
            <div className="w-1/2 h-full bg-white dark:bg-slate-900" />
            <div className="w-1/2 h-full bg-slate-900 dark:bg-slate-200" />
          </div>
          <span>{isBn ? '৫০ ফুট' : '50 ft'}</span>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Measurement Mode Instructions Floating Pill (Bottom Center) */}
      {/* -------------------------------------------------------------------- */}
      {isMeasureActive && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-25 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-bold shadow-xl border border-amber-400 flex items-center gap-2 pointer-events-none animate-fadeIn">
          <Ruler className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {measurePoints.length === 0
              ? isBn
                ? 'নকশায় স্পর্শ করে পরিমাপ শুরু করুন'
                : 'Tap on map to begin measuring'
              : measurePoints.length === 1
              ? isBn
                ? 'দূরত্ব দেখতে ২য় বিন্দুতে স্পর্শ করুন'
                : 'Tap 2nd point to see distance'
              : isMeasureClosed
              ? isBn
                ? 'পরিমাপ সম্পন্ন — পয়েন্ট টেনে সমন্বয় করা যাবে'
                : 'Measurement closed — drag points to adjust'
              : isBn
                ? `পয়েন্ট যোগ করতে স্পর্শ করুন (${toBengaliNumber(measurePoints.length)}টি যুক্ত)`
                : `Tap to add points (${measurePoints.length} added)`}
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Drawing Instructions Overlay Pill */}
      {/* -------------------------------------------------------------------- */}
      {isDrawingMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-25 px-4 py-2 rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-xl flex items-center gap-2 pointer-events-none animate-pulse">
          <Crosshair className="w-4 h-4" />
          <span>
            {isBn
              ? `নকশায় স্পর্শ/ক্লিক করে কোণ যোগ করুন (${activeDrawingPoints.length}টি যুক্ত)`
              : `Tap map to drop boundary corners (${activeDrawingPoints.length} added)`}
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SVG Cadastral Workspace */}
      {/* -------------------------------------------------------------------- */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        onClick={handleSvgClick}
        style={{
          cursor: isMeasureActive
            ? draggingMeasurePointIndex !== null
              ? 'grabbing'
              : 'crosshair'
            : isDrawingMode
            ? 'crosshair'
            : isMouseDragging
            ? 'grabbing'
            : 'grab',
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 1. Background Mouza Sheet (Scanned Raster, Vector SVG, or PDF) */}
          {backgroundImageUrl &&
          !backgroundImageUrl.startsWith('data:image') &&
          (sourceType === 'pdf' ||
            backgroundImageUrl.toLowerCase().includes('.pdf') ||
            backgroundImageUrl.startsWith('data:application/pdf')) ? (
            <foreignObject
              x={0}
              y={0}
              width={dimensions.width}
              height={dimensions.height}
              className="pointer-events-none"
            >
              <object
                data={backgroundImageUrl}
                type="application/pdf"
                className="w-full h-full border-none opacity-90 pointer-events-none"
              >
                <iframe
                  src={backgroundImageUrl}
                  className="w-full h-full border-none opacity-90 pointer-events-none"
                  title="PDF Cadastral Sheet"
                />
              </object>
            </foreignObject>
          ) : backgroundImageUrl ? (
            <image
              href={backgroundImageUrl}
              x={0}
              y={0}
              width={dimensions.width}
              height={dimensions.height}
              preserveAspectRatio="xMidYMid meet"
              opacity={isDarkMode ? 0.78 : 0.94}
            />
          ) : null}

          {/* 2. Cadastral Boundary Neatline / Border */}
          <rect
            x={12}
            y={12}
            width={dimensions.width - 24}
            height={dimensions.height - 24}
            fill="none"
            stroke={isDarkMode ? '#334155' : '#cbd5e1'}
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />

          {/* 3. Existing Digitized Dags (Polygons) */}
          {digitizedDags.map((dag, dagIndex) => {
            const isSelected = selectedDagId === dag.id;
            const palette = pastelColorPalette[dagIndex % pastelColorPalette.length];
            const polygonColor = dag.color || palette.stroke;

            // When in Vertex Edit Mode and this dag is selected, render interactive vertex overlay
            if (
              isVertexEditMode &&
              (isSelected || (isFieldBoundaryEditMode && dag.id === 'field-boundary')) &&
              activeEditPoints &&
              activeEditPoints.length >= 3
            ) {
              return (
                <InteractiveVertexCanvasOverlay
                  key={dag.id}
                  points={activeEditPoints}
                  selectedPointIndex={selectedVertexIndex}
                  segments={segments}
                  zoom={zoom}
                  isEditMode={true}
                  isSnapEnabled={isSnapEnabled}
                  snapResult={snapResult}
                  lang={lang}
                  polygonColor={polygonColor}
                  onSelectPoint={onSelectVertex || (() => {})}
                  onPointDrag={onVertexDrag || (() => {})}
                  onPointDragEnd={onVertexDragEnd || (() => {})}
                  onAddPointOnSegment={onAddVertexOnSegment || (() => {})}
                />
              );
            }

            if (!dag.points || dag.points.length < 3) return null;
            
            // Skip path rendering if it's the field boundary being edited (overlay handles it)
            if (dag.id === 'field-boundary' && isVertexEditMode && isFieldBoundaryEditMode) return null;

            const pathData =
              dag.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z';

            // Calculate center for dag number label
            const avgX = dag.points.reduce((sum, p) => sum + p.x, 0) / dag.points.length;
            const avgY = dag.points.reduce((sum, p) => sum + p.y, 0) / dag.points.length;

            return (
              <g
                key={dag.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDrawingMode) onSelectDag(dag.id);
                }}
                className="cursor-pointer group"
              >
                {/* Parcel Boundary Polygon */}
                <path
                  d={pathData}
                  fill={isDemarcationView ? 'transparent' : (showParcelFill ? (isSelected ? '#0284c7' : palette.fill) : 'transparent')}
                  fillOpacity={
                    isDemarcationView
                      ? (dag.id === 'field-boundary' ? 0.2 : 0.05)
                      : (showParcelFill ? (isSelected ? 0.32 : isDarkMode ? 0.35 : 0.55) : 0)
                  }
                  stroke={
                    isDemarcationView
                      ? (dag.id === 'field-boundary' ? '#f59e0b' : '#1e293b')
                      : (isSelected ? '#0284c7' : isDarkMode ? '#f8fafc' : '#1e293b')
                  }
                  strokeWidth={
                    isDemarcationView
                      ? (dag.id === 'field-boundary' ? 3 : 2) / zoom
                      : (isSelected ? 3 : 1.8) / zoom
                  }
                  strokeDasharray={isSelected || (isDemarcationView && dag.id === 'field-boundary') ? `${6 / zoom}, ${3 / zoom}` : undefined}
                  className="transition-all"
                />

                {/* Visible Side Length Measurements on Boundary Segments */}
                {showMeasurements &&
                  dag.points.map((pt, i) => {
                    const nextPt = dag.points[(i + 1) % dag.points.length];
                    const midX = (pt.x + nextPt.x) / 2;
                    const midY = (pt.y + nextPt.y) / 2;
                    const dx = nextPt.x - pt.x;
                    const dy = nextPt.y - pt.y;
                    const lengthPixels = Math.hypot(dx, dy);
                    const lengthFeet = Math.round(lengthPixels / (scalePixelsPerFoot || 1.0));

                    // Show measurement if segment is long enough
                    if (lengthPixels < 18) return null;

                    return (
                      <g key={`seg-m-${dag.id}-${i}`} transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-14 / zoom}
                          y={-7 / zoom}
                          width={28 / zoom}
                          height={14 / zoom}
                          rx={4 / zoom}
                          fill={isDarkMode ? '#0f172a' : '#ffffff'}
                          fillOpacity={0.92}
                          stroke={isSelected ? '#0284c7' : '#94a3b8'}
                          strokeWidth={0.8 / zoom}
                        />
                        <text
                          x={0}
                          y={3 / zoom}
                          textAnchor="middle"
                          fill={isDarkMode ? '#f1f5f9' : '#0f172a'}
                          fontSize={8 / zoom}
                          fontWeight="bold"
                          fontFamily="monospace"
                          pointerEvents="none"
                        >
                          {lengthFeet}′
                        </text>
                      </g>
                    );
                  })}

                {/* Corner Vertex Points (Optional toggle) */}
                {showVertexHandles &&
                  dag.points.map((p, idx) => (
                    <g key={`pt-${dag.id}-${idx}`}>
                      {/* Generous touch target */}
                      <circle cx={p.x} cy={p.y} r={14 / zoom} fill="transparent" />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={(isSelected ? 5 : 3.5) / zoom}
                        fill={isSelected ? '#0284c7' : '#ffffff'}
                        stroke={isSelected ? '#ffffff' : '#0f172a'}
                        strokeWidth={1.5 / zoom}
                      />
                    </g>
                  ))}

                {/* Dag Number Badge (Centered) */}
                {showDagLabels && (
                  <g transform={`translate(${avgX}, ${avgY})`}>
                    <rect
                      x={-24 / zoom}
                      y={-12 / zoom}
                      width={48 / zoom}
                      height={24 / zoom}
                      rx={6 / zoom}
                      fill={isSelected ? '#0369a1' : isDarkMode ? '#0f172a' : '#ffffff'}
                      fillOpacity={0.95}
                      stroke={isSelected ? '#38bdf8' : '#334155'}
                      strokeWidth={1.2 / zoom}
                    />
                    <text
                      x={0}
                      y={4 / zoom}
                      textAnchor="middle"
                      fill={isSelected || isDarkMode ? '#ffffff' : '#0f172a'}
                      fontSize={10.5 / zoom}
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {isBn ? `দাগ ${dag.dagNo}` : `Plot ${dag.dagNo}`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 4. Active Drawing Polygon (In Progress) */}
          {activeDrawingPoints.length > 0 && (
            <g>
              {activeDrawingPoints.length > 1 && (
                <path
                  d={
                    activeDrawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
                    (activeDrawingPoints.length >= 3 ? ' Z' : '')
                  }
                  fill="#f59e0b"
                  fillOpacity={0.18}
                  stroke="#f59e0b"
                  strokeWidth={2.5 / zoom}
                  strokeDasharray={`${5 / zoom}, ${2.5 / zoom}`}
                />
              )}

              {activeDrawingPoints.map((p, idx) => (
                <g key={`draw-pt-${idx}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6 / zoom}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={1.8 / zoom}
                  />
                  <text
                    x={p.x + 8 / zoom}
                    y={p.y + 4 / zoom}
                    fill="#b45309"
                    fontSize={11 / zoom}
                    fontWeight="bold"
                    filter="drop-shadow(0px 1px 2px rgba(255,255,255,0.9))"
                  >
                    P{idx + 1}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* 5. Real GPS Survey Overlay */}
          {gpsOverlayPolygon && (
            <g className="animate-fadeIn">
              <path
                d={gpsOverlayPolygon.pathData}
                fill="#06b6d4"
                fillOpacity={0.22}
                stroke="#0891b2"
                strokeWidth={2.5 / zoom}
                strokeDasharray={`${6 / zoom}, ${3 / zoom}`}
              />
              {gpsOverlayPolygon.pts.map((p, idx) => (
                <g key={`gps-pt-${idx}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={5 / zoom}
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth={1.6 / zoom}
                  />
                  <text
                    x={p.x + 7 / zoom}
                    y={p.y - 7 / zoom}
                    fill="#0e7490"
                    fontSize={10 / zoom}
                    fontWeight="bold"
                    filter="drop-shadow(0px 1px 2px rgba(255,255,255,0.9))"
                  >
                    GPS {p.label || `G${idx + 1}`}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* 6. Simple Professional Measurement Layer (Phase 20J.2) */}
          {measurePoints.length > 0 && (
            <g className="animate-fadeIn">
              {/* Closed Polygon Fill */}
              {isMeasureClosed && measurePoints.length >= 3 && (
                <path
                  d={
                    measurePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
                    ' Z'
                  }
                  fill="#d97706"
                  fillOpacity={isDarkMode ? 0.35 : 0.22}
                  stroke="#b45309"
                  strokeWidth={2 / zoom}
                />
              )}

              {/* Segment Lines between consecutive points */}
              {measureSegments.map((seg, idx) => (
                <g key={`m-seg-line-${idx}`}>
                  <line
                    x1={seg.p1.x}
                    y1={seg.p1.y}
                    x2={seg.p2.x}
                    y2={seg.p2.y}
                    stroke="#d97706"
                    strokeWidth={2.2 / zoom}
                    strokeDasharray={isMeasureClosed ? undefined : `${6 / zoom}, ${3 / zoom}`}
                  />
                  {/* Distance text bubble on the segment */}
                  <g transform={`translate(${seg.midX}, ${seg.midY})`}>
                    <rect
                      x={-20 / zoom}
                      y={-8 / zoom}
                      width={40 / zoom}
                      height={16 / zoom}
                      rx={4 / zoom}
                      fill={isDarkMode ? '#0f172a' : '#ffffff'}
                      fillOpacity={0.96}
                      stroke="#d97706"
                      strokeWidth={1 / zoom}
                      filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.15))"
                    />
                    <text
                      x={0}
                      y={3.5 / zoom}
                      textAnchor="middle"
                      fill={isDarkMode ? '#fbbf24' : '#92400e'}
                      fontSize={8.5 / zoom}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {seg.label}
                    </text>
                  </g>
                </g>
              ))}

              {/* Measurement Points Handles (large touch target for mobile dragging) */}
              {measurePoints.map((p, idx) => {
                const isDragging = draggingMeasurePointIndex === idx;
                return (
                  <g key={`m-pt-${idx}`}>
                    {/* Invisible large touch target */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={18 / zoom}
                      fill="transparent"
                      className="cursor-move"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        draggingMeasurePointIndexRef.current = idx;
                        setDraggingMeasurePointIndex(idx);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        draggingMeasurePointIndexRef.current = idx;
                        setDraggingMeasurePointIndex(idx);
                      }}
                    />
                    {/* Visual Vertex Handle */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={(isDragging ? 7 : 5.5) / zoom}
                      fill={isDragging ? '#ef4444' : '#f59e0b'}
                      stroke="#ffffff"
                      strokeWidth={1.8 / zoom}
                      className="transition-transform"
                    />
                    {/* Point Label: M1, M2... */}
                    <text
                      x={p.x + 8 / zoom}
                      y={p.y - 7 / zoom}
                      fill="#b45309"
                      fontSize={10 / zoom}
                      fontWeight="bold"
                      filter="drop-shadow(0px 1px 2px rgba(255,255,255,0.9))"
                    >
                      M{idx + 1}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
