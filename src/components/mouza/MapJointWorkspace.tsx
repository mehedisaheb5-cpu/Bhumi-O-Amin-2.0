import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Move,
  RotateCw,
  Sliders,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Crosshair,
  ShieldCheck,
  Info,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import {
  Language,
  MouzaMapRecord,
  MapJointProject,
  MapJointSheetLayer,
  ControlPointPair,
} from '../../types';
import {
  calculateControlPointAlignment,
  saveMapJointProject,
  getStoredMapJointProjects,
} from '../../lib/mouza-map';

interface MapJointWorkspaceProps {
  lang: Language;
  mouzaMaps: MouzaMapRecord[];
  currentMap: MouzaMapRecord | null;
}

export const MapJointWorkspace: React.FC<MapJointWorkspaceProps> = ({
  lang,
  mouzaMaps,
  currentMap,
}) => {
  const isBn = lang === 'bn';
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 650,
    height: 480,
  });

  // Pan & Zoom
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Notifications
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Project Title
  const [projectTitle, setProjectTitle] = useState<string>(
    currentMap
      ? `ম্যাপ জয়েন্ট — ${currentMap.mouza} (শিট ১ ও ২)`
      : 'ম্যাপ জয়েন্ট প্রকল্প'
  );

  // Loaded Sheet Layers
  const [sheetLayers, setSheetLayers] = useState<MapJointSheetLayer[]>(() => {
    if (mouzaMaps.length > 0) {
      const base = mouzaMaps[0];
      const initial: MapJointSheetLayer[] = [
        {
          id: `layer-${base.id}-1`,
          mouzaMapId: base.id,
          title: `${base.mouza} — শিট ১ (বেস)`,
          sourceType: base.sourceType,
          fileDataUrl: base.fileDataUrl,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1.0,
          opacity: 0.9,
          visible: true,
        },
      ];

      if (mouzaMaps.length > 1) {
        const second = mouzaMaps[1];
        initial.push({
          id: `layer-${second.id}-2`,
          mouzaMapId: second.id,
          title: `${second.mouza} — শিট ২ (সংলগ্ন)`,
          sourceType: second.sourceType,
          fileDataUrl: second.fileDataUrl,
          x: 320,
          y: 0,
          rotation: 0,
          scale: 1.0,
          opacity: 0.8,
          visible: true,
        });
      }
      return initial;
    }
    return [];
  });

  // Active layer selected for transform
  const [activeLayerId, setActiveLayerId] = useState<string>(
    sheetLayers.length > 1 ? sheetLayers[1].id : sheetLayers[0]?.id || ''
  );

  // Control Points for manual alignment
  const [controlPoints, setControlPoints] = useState<ControlPointPair[]>([
    {
      id: 'cp-1',
      pointName: 'CP-1 (সীমানা পিলার ১)',
      ptA: { x: 300, y: 150, label: 'পিলার ক' },
      ptB: { x: 320, y: 160, label: 'পিলার খ' },
    },
    {
      id: 'cp-2',
      pointName: 'CP-2 (সীমানা পিলার ২)',
      ptA: { x: 300, y: 320, label: 'পিলার গ' },
      ptB: { x: 318, y: 335, label: 'পিলার ঘ' },
    },
  ]);

  // Mode: 'view' | 'place_cp_a' | 'place_cp_b'
  const [cpPlacingMode, setCpPlacingMode] = useState<{
    targetCpId: string;
    targetSheet: 'ptA' | 'ptB';
  } | null>(null);

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(Math.max(420, height)),
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Active layer object
  const activeLayer = useMemo(() => {
    return sheetLayers.find((l) => l.id === activeLayerId) || null;
  }, [sheetLayers, activeLayerId]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (cpPlacingMode) return;
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, Math.round((z - 0.25) * 100) / 100));
  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Canvas Click for Control Point placement
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!cpPlacingMode || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const canvasX = Math.round((clientX - pan.x) / zoom);
    const canvasY = Math.round((clientY - pan.y) / zoom);

    setControlPoints((prev) =>
      prev.map((cp) => {
        if (cp.id === cpPlacingMode.targetCpId) {
          return {
            ...cp,
            [cpPlacingMode.targetSheet]: {
              x: canvasX,
              y: canvasY,
              label: cpPlacingMode.targetSheet === 'ptA' ? 'ম্যাপ ক' : 'ম্যাপ খ',
            },
          };
        }
        return cp;
      })
    );

    setCpPlacingMode(null);
    setNotificationMsg(
      isBn ? 'নিয়ন্ত্রণ বিন্দু সফলভাবে চিহ্নিত হয়েছে!' : 'Control point placed successfully!'
    );
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Update transform for active layer
  const updateActiveLayerTransform = (updates: Partial<MapJointSheetLayer>) => {
    if (!activeLayerId) return;
    setSheetLayers((prev) =>
      prev.map((layer) => (layer.id === activeLayerId ? { ...layer, ...updates } : layer))
    );
  };

  // Calculate Alignment from Control Points
  const alignmentGuidance = useMemo(() => {
    return calculateControlPointAlignment(controlPoints);
  }, [controlPoints]);

  // Apply Calculated Alignment to Active Layer
  const handleApplyAlignment = () => {
    if (!activeLayer) return;
    updateActiveLayerTransform({
      x: alignmentGuidance.suggestedDx,
      y: alignmentGuidance.suggestedDy,
      rotation: alignmentGuidance.suggestedRotation,
      scale: alignmentGuidance.suggestedScale,
    });

    setNotificationMsg(
      isBn
        ? `প্রান্তিককরণ প্রয়োগ সম্পন্ন (ঘূর্ণন: ${alignmentGuidance.suggestedRotation}°, স্কেল: ${alignmentGuidance.suggestedScale}x)!`
        : `Alignment applied (Rot: ${alignmentGuidance.suggestedRotation}°, Scale: ${alignmentGuidance.suggestedScale}x)!`
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Add sheet from available maps
  const handleAddSheet = (mouzaMapId: string) => {
    const map = mouzaMaps.find((m) => m.id === mouzaMapId);
    if (!map) return;

    const newLayer: MapJointSheetLayer = {
      id: `layer-${map.id}-${Date.now()}`,
      mouzaMapId: map.id,
      title: `${map.mouza} — শিট ${sheetLayers.length + 1}`,
      sourceType: map.sourceType,
      fileDataUrl: map.fileDataUrl,
      x: sheetLayers.length * 150,
      y: 0,
      rotation: 0,
      scale: 1.0,
      opacity: 0.85,
      visible: true,
    };

    setSheetLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  // Remove sheet
  const handleRemoveSheet = (layerId: string) => {
    setSheetLayers((prev) => prev.filter((l) => l.id !== layerId));
    if (activeLayerId === layerId) {
      const remaining = sheetLayers.filter((l) => l.id !== layerId);
      setActiveLayerId(remaining[0]?.id || '');
    }
  };

  // Add Control Point
  const handleAddControlPoint = () => {
    const num = controlPoints.length + 1;
    const newCp: ControlPointPair = {
      id: `cp-${Date.now()}`,
      pointName: `CP-${num} (পিলার ${num})`,
      ptA: { x: 250 + num * 20, y: 150 + num * 30 },
      ptB: { x: 270 + num * 20, y: 160 + num * 30 },
    };
    setControlPoints((prev) => [...prev, newCp]);
  };

  // Save Map Joint Project
  const handleSaveProject = () => {
    const project: MapJointProject = {
      id: `joint-${Date.now()}`,
      title: projectTitle.trim() || 'ম্যাপ জয়েন্ট প্রকল্প',
      layers: sheetLayers,
      controlPoints,
      notes: 'মৌজা শিট ম্যাপ জয়েন্ট ও ম্যানুয়াল নিয়ন্ত্রণ বিন্দু প্রান্তিককরণ।',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveMapJointProject(project);

    setNotificationMsg(
      isBn ? 'ম্যাপ জয়েন্ট প্রকল্প সফলভাবে সংরক্ষিত হয়েছে!' : 'Map joint project saved successfully!'
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header with Title & Legal Clarification */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-900 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {isBn ? 'ম্যাপ জয়েন্ট ও প্রান্তিককরণ ওয়ার্কস্পেস' : 'Map Joint & Alignment Workspace'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                  Phase 12C
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'একাধিক সংলগ্ন মৌজা শিট লোড, ম্যানুয়াল পজিশনিং, ঘূর্ণন এবং ২-৩ নিয়ন্ত্রণ বিন্দু দিয়ে জয়েন্ট'
                  : 'Load adjacent map sheets, manual positioning, rotation, scale and 2-3 control-point alignment'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Save className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'জয়েন্ট সংরক্ষণ' : 'Save Joint'}</span>
            </button>
          </div>
        </div>

        {/* Mandatory Digital / Indicative Disclaimer */}
        <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 flex items-start gap-2.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-extrabold uppercase tracking-wide">
              {isBn ? 'ডিজিটাল / নির্দেশক জয়েন্ট (DIGITAL / INDICATIVE JOINT): ' : 'DIGITAL / INDICATIVE JOINT: '}
            </span>
            {isBn
              ? 'ম্যাপ জয়েন্ট ও নিয়ন্ত্রণ বিন্দু প্রান্তিককরণ একটি নির্দেশক প্রযুক্তিগত টুল। শিটের সংকোচন বা স্ক্যান বিকৃতির কারণে এটি কোনো সরকারি রেকর্ড পরিবর্তন বা চূড়ান্ত আইনি সীমানা নির্ধারণ করে না।'
              : 'Map Joint and control-point alignment is an indicative technical tool. It does NOT constitute legal boundary determination.'}
          </div>
        </div>
      </div>

      {notificationMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. Map Joint Canvas & Transform Controls */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Left 3 cols: Multi-Sheet SVG Canvas */}
        <div className="lg:col-span-3 space-y-2">
          {/* Canvas Toolbar */}
          <div className="flex items-center justify-between px-1 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Move className="w-4 h-4 text-indigo-700" />
              <span>{isBn ? 'জয়েন্ট ক্যানভাস স্টেজ' : 'Joined Canvas Stage'}</span>
              {activeLayer && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {isBn ? 'সম্পাদনায়: ' : 'Active: '}
                  {activeLayer.title}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                title={isBn ? 'জুম ইন' : 'Zoom In'}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                title={isBn ? 'জুম আউট' : 'Zoom Out'}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetView}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                title={isBn ? 'ভিউ রিসেট' : 'Reset View'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Canvas Box */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative w-full h-[470px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner select-none ${
              cpPlacingMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            }`}
          >
            {/* Grid Pattern */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #475569 1px, transparent 1px), linear-gradient(to bottom, #475569 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              onClick={handleCanvasClick}
              className="w-full h-full block"
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Render Each Sheet Layer */}
                {sheetLayers.map((layer) => {
                  if (!layer.visible) return null;
                  const isActive = layer.id === activeLayerId;

                  return (
                    <g
                      key={layer.id}
                      transform={`translate(${layer.x}, ${layer.y}) rotate(${layer.rotation}) scale(${layer.scale})`}
                      opacity={layer.opacity}
                    >
                      {layer.fileDataUrl ? (
                        <image
                          href={layer.fileDataUrl}
                          x={0}
                          y={0}
                          width={480}
                          height={340}
                          preserveAspectRatio="xMidYMid meet"
                        />
                      ) : (
                        <rect
                          x={0}
                          y={0}
                          width={480}
                          height={340}
                          fill="#1e293b"
                          stroke={isActive ? '#6366f1' : '#475569'}
                          strokeWidth={isActive ? 3 : 1}
                        />
                      )}

                      {/* Active Layer Border indicator */}
                      {isActive && (
                        <rect
                          x={-2}
                          y={-2}
                          width={484}
                          height={344}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth={2 / zoom}
                          strokeDasharray={`${6 / zoom}, ${4 / zoom}`}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Render Control Points */}
                {controlPoints.map((cp) => (
                  <g key={cp.id}>
                    {/* CP on Sheet A */}
                    <g
                      transform={`translate(${cp.ptA.x}, ${cp.ptA.y})`}
                      className="cursor-pointer"
                    >
                      <circle
                        r={6 / zoom}
                        fill="#f43f5e"
                        stroke="#ffffff"
                        strokeWidth={2 / zoom}
                      />
                      <text
                        x={9 / zoom}
                        y={4 / zoom}
                        fill="#fda4af"
                        fontSize={11 / zoom}
                        fontWeight="bold"
                        filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.9))"
                      >
                        {cp.pointName} (A)
                      </text>
                    </g>

                    {/* CP on Sheet B */}
                    <g
                      transform={`translate(${cp.ptB.x}, ${cp.ptB.y})`}
                      className="cursor-pointer"
                    >
                      <rect
                        x={-5 / zoom}
                        y={-5 / zoom}
                        width={10 / zoom}
                        height={10 / zoom}
                        fill="#06b6d4"
                        stroke="#ffffff"
                        strokeWidth={2 / zoom}
                      />
                      <text
                        x={9 / zoom}
                        y={4 / zoom}
                        fill="#67e8f9"
                        fontSize={11 / zoom}
                        fontWeight="bold"
                        filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.9))"
                      >
                        {cp.pointName} (B)
                      </text>
                    </g>

                    {/* Alignment Connector line */}
                    <line
                      x1={cp.ptA.x}
                      y1={cp.ptA.y}
                      x2={cp.ptB.x}
                      y2={cp.ptB.y}
                      stroke="#fbbf24"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray={`${4 / zoom}, ${3 / zoom}`}
                    />
                  </g>
                ))}
              </g>
            </svg>

            {/* Placing Mode Banner */}
            {cpPlacingMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-lg animate-pulse flex items-center gap-2">
                <Crosshair className="w-4 h-4" />
                <span>
                  {isBn
                    ? `ক্যানভাসে ক্লিক করে ${cpPlacingMode.targetSheet === 'ptA' ? 'ম্যাপ ক' : 'ম্যাপ খ'}-এর অবস্থান নির্ধারণ করুন`
                    : `Click canvas to place position for ${cpPlacingMode.targetSheet.toUpperCase()}`}
                </span>
                <button
                  onClick={() => setCpPlacingMode(null)}
                  className="ml-2 text-rose-200 hover:text-white underline text-[11px]"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 col: Sheet Management & Transform Controls */}
        <div className="space-y-3">
          {/* Loaded Sheets List */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">
                {isBn ? 'ম্যাপ শিট লেয়ার তালিকা' : 'Loaded Map Sheets'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {sheetLayers.length} Sheets
              </span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {sheetLayers.map((layer) => {
                const isActive = layer.id === activeLayerId;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    className={`p-2 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      isActive
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="truncate pr-1">
                      <span className="block truncate">{layer.title}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        X:{layer.x} Y:{layer.y} Rot:{layer.rotation}°
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          setSheetLayers((prev) =>
                            prev.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l))
                          )
                        }
                        className="p-1 rounded text-slate-500 hover:text-slate-800"
                      >
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      {sheetLayers.length > 1 && (
                        <button
                          onClick={() => handleRemoveSheet(layer.id)}
                          className="p-1 rounded text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Sheet Dropdown */}
            {mouzaMaps.length > sheetLayers.length && (
              <div className="pt-1">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddSheet(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-800 text-xs font-semibold focus:outline-hidden"
                >
                  <option value="">+ {isBn ? 'অন্য শিট যুক্ত করুন...' : 'Add another sheet...'}</option>
                  {mouzaMaps
                    .filter((m) => !sheetLayers.some((sl) => sl.mouzaMapId === m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.mouza} (জে.এল. {m.jlNo})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Active Layer Transform Controls */}
          {activeLayer && (
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">
                  {isBn ? 'পজিশনিং ও ট্রান্সফর্ম' : 'Transform Controls'}
                </span>
                <button
                  onClick={() =>
                    updateActiveLayerTransform({ x: 0, y: 0, rotation: 0, scale: 1.0 })
                  }
                  className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold"
                >
                  {isBn ? 'রিসেট' : 'Reset'}
                </button>
              </div>

              {/* Move X / Y */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>{isBn ? 'পজিশন স্থানান্তর (X, Y)' : 'Move (X, Y)'}</span>
                  <span>
                    X:{activeLayer.x}, Y:{activeLayer.y}
                  </span>
                </div>
                {/* Arrow Nudge Pad */}
                <div className="grid grid-cols-3 gap-1 w-32 mx-auto pt-1">
                  <div />
                  <button
                    onClick={() => updateActiveLayerTransform({ y: activeLayer.y - 10 })}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center"
                  >
                    ▲
                  </button>
                  <div />
                  <button
                    onClick={() => updateActiveLayerTransform({ x: activeLayer.x - 10 })}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => updateActiveLayerTransform({ x: 0, y: 0 })}
                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[9px] font-bold text-center"
                  >
                    0
                  </button>
                  <button
                    onClick={() => updateActiveLayerTransform({ x: activeLayer.x + 10 })}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center"
                  >
                    ▶
                  </button>
                  <div />
                  <button
                    onClick={() => updateActiveLayerTransform({ y: activeLayer.y + 10 })}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center"
                  >
                    ▼
                  </button>
                  <div />
                </div>
              </div>

              {/* Rotation Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>{isBn ? 'ঘূর্ণন (Rotation)' : 'Rotation'}</span>
                  <span>{activeLayer.rotation}°</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateActiveLayerTransform({ rotation: activeLayer.rotation - 1 })}
                    className="p-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    -1°
                  </button>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="0.5"
                    value={activeLayer.rotation}
                    onChange={(e) =>
                      updateActiveLayerTransform({ rotation: parseFloat(e.target.value) })
                    }
                    className="w-full accent-indigo-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() => updateActiveLayerTransform({ rotation: activeLayer.rotation + 1 })}
                    className="p-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    +1°
                  </button>
                </div>
              </div>

              {/* Scale Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>{isBn ? 'স্কেল (Scale)' : 'Scale'}</span>
                  <span>{activeLayer.scale}x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      updateActiveLayerTransform({
                        scale: Math.max(0.1, Math.round((activeLayer.scale - 0.05) * 100) / 100),
                      })
                    }
                    className="p-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    -0.05
                  </button>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.05"
                    value={activeLayer.scale}
                    onChange={(e) =>
                      updateActiveLayerTransform({ scale: parseFloat(e.target.value) })
                    }
                    className="w-full accent-indigo-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      updateActiveLayerTransform({
                        scale: Math.min(4.0, Math.round((activeLayer.scale + 0.05) * 100) / 100),
                      })
                    }
                    className="p-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    +0.05
                  </button>
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>{isBn ? 'স্বচ্ছতা (Opacity)' : 'Opacity'}</span>
                  <span>{Math.round(activeLayer.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={activeLayer.opacity}
                  onChange={(e) =>
                    updateActiveLayerTransform({ opacity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-indigo-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 3. Control Points & Auto-Alignment Guidance */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">
                {isBn ? 'নিয়ন্ত্রণ বিন্দু প্রান্তিককরণ' : 'Control Points (CP)'}
              </span>
              <button
                onClick={handleAddControlPoint}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition"
              >
                + {isBn ? 'পয়েন্ট' : 'Add CP'}
              </button>
            </div>

            {/* CP List */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {controlPoints.map((cp) => (
                <div
                  key={cp.id}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1"
                >
                  <div className="font-bold text-slate-800 flex justify-between">
                    <span>{cp.pointName}</span>
                    <button
                      onClick={() =>
                        setControlPoints((prev) => prev.filter((p) => p.id !== cp.id))
                      }
                      className="text-rose-500 hover:text-rose-700"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <button
                      onClick={() =>
                        setCpPlacingMode({ targetCpId: cp.id, targetSheet: 'ptA' })
                      }
                      className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-800 font-semibold"
                    >
                      ম্যাপ ক ({cp.ptA.x},{cp.ptA.y})
                    </button>
                    <button
                      onClick={() =>
                        setCpPlacingMode({ targetCpId: cp.id, targetSheet: 'ptB' })
                      }
                      className="px-2 py-1 rounded bg-cyan-50 border border-cyan-200 text-cyan-800 font-semibold"
                    >
                      ম্যাপ খ ({cp.ptB.x},{cp.ptB.y})
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Alignment Result Card & Apply Button */}
            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-[11px] space-y-1.5">
              <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                <span>{isBn ? 'প্রান্তিককরণ নির্দেশক' : 'Suggested Alignment'}</span>
              </div>
              <div className="text-slate-600 text-[10px] space-y-0.5">
                <div>
                  DX: {alignmentGuidance.suggestedDx}px | DY: {alignmentGuidance.suggestedDy}px
                </div>
                <div>
                  ঘূর্ণন: {alignmentGuidance.suggestedRotation}° | স্কেল:{' '}
                  {alignmentGuidance.suggestedScale}x
                </div>
              </div>
              <button
                onClick={handleApplyAlignment}
                className="w-full py-1.5 rounded-lg bg-indigo-800 hover:bg-indigo-900 text-white font-bold text-xs shadow-xs transition active:scale-95"
              >
                {isBn ? 'প্রান্তিককরণ প্রয়োগ করুন' : 'Apply Alignment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
