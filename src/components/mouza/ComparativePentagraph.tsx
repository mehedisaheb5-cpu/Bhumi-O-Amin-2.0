import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  Sliders,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Scale,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Compass,
  ArrowRight,
  Info,
  ShieldCheck,
  Move,
  MousePointer,
  PenTool,
  Ruler,
  Square,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Minus,
  FolderOpen,
  Upload,
  ArrowLeft,
  FileDown,
} from 'lucide-react';
import {
  Language,
  MouzaMapRecord,
  DigitizedDagRecord,
  SurveyRecord,
  ComparativePentagraphProject,
  PentagraphLayerConfig,
  PentagraphComparisonMetrics,
  UploadedMapFile,
  DigitizedDagPoint,
  LayerEditedGeometry,
} from '../../types';
import {
  calculateDagPolygonArea,
  calculatePolygonCentroid,
  calculatePentagraphMetrics,
  savePentagraphProject,
  getStoredPentagraphProjects,
  resolveMouzaMapFileUrl,
  finalizePentagraphProject,
} from '../../lib/mouza-map';
import { filterValidPoints, LatLngPoint } from '../../lib/gps-geometry';
import {
  getStoredMapFiles,
  saveMapFile,
  getStoredMapFileWithContent,
} from '../../lib/pentagraph-files';
import { PentagraphPdfViewer } from './PentagraphPdfViewer';
import { PentagraphFileLibraryModal } from './PentagraphFileLibraryModal';
import { ProfessionalServiceDisclaimer } from '../common/ProfessionalServiceDisclaimer';
import { ScannedMapCatalogModal } from './ScannedMapCatalogModal';
import { VertexEditToolbar } from './VertexEditToolbar';
import { VertexEditInspector } from './VertexEditInspector';
import { InteractiveVertexCanvasOverlay } from './InteractiveVertexCanvasOverlay';
import {
  ComparativeDemarcationReportModal,
  DemarcationReportData,
} from './ComparativeDemarcationReportModal';
import {
  calculatePolygonMetrics,
  calculateSegmentInfos,
  findSnapPoint,
  insertVertexAtSegment,
  deleteVertexAtIndex,
  nudgeVertex,
  arePointsDifferent,
  SnapResult,
} from '../../lib/vertex-editing';
import { LAND_CONSTANTS, formatNumberByLang, roundClean } from '../../lib/land-units';
import { useAuth } from '../../contexts/AuthContext';
import { isFirebaseConfigured, db, collection, query, where, onSnapshot } from '../../lib/firebase';

interface ComparativePentagraphProps {
  lang: Language;
  currentMap: MouzaMapRecord | null;
  selectedDag: DigitizedDagRecord | null;
  surveys: SurveyRecord[];
  activeGpsPoints: LatLngPoint[];
  onOpenReport?: (surveyId?: string) => void;
  onSelectDag?: (dagId: string) => void;
  onOpenProject?: (project: ComparativePentagraphProject) => void;
}

export const ComparativePentagraph: React.FC<ComparativePentagraphProps> = ({
  lang,
  currentMap,
  selectedDag,
  surveys,
  activeGpsPoints,
  onOpenReport,
  onSelectDag,
  onOpenProject,
}) => {
  const isBn = lang === 'bn';
  const { currentUser } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 650,
    height: 460,
  });

  // Pan & Zoom
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selected GPS Survey source
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(
    surveys.length > 0 ? surveys[0].id : 'active_gps'
  );

  // Selected Saved Drawing / Secondary Survey source
  const [selectedDrawingId, setSelectedDrawingId] = useState<string>(
    surveys.length > 1 ? surveys[1].id : ''
  );

  // Notification & Copy state
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>(
    currentMap
      ? `পেন্টাগ্রাফ তুলনা — ${currentMap.mouza} (দাগ ${selectedDag?.dagNo || 'সার্ভে'})`
      : 'পেন্টাগ্রাফ তুলনা প্রকল্প'
  );

  // Selected vertex popover
  const [hoveredVertex, setHoveredVertex] = useState<{
    label: string;
    layer: string;
    x: number;
    y: number;
    lat?: number;
    lng?: number;
  } | null>(null);

  // 4 Visual Layers configuration
  const [layerMouzaSheet, setLayerMouzaSheet] = useState<{
    visible: boolean;
    opacity: number;
  }>({ visible: true, opacity: 0.65 });

  const [layerDigitizedDag, setLayerDigitizedDag] = useState<{
    visible: boolean;
    opacity: number;
    showLabels: boolean;
  }>({ visible: true, opacity: 0.85, showLabels: true });

  const [layerGpsSurvey, setLayerGpsSurvey] = useState<{
    visible: boolean;
    opacity: number;
    showLabels: boolean;
  }>({ visible: true, opacity: 0.9, showLabels: true });

  const [layerSavedDrawing, setLayerSavedDrawing] = useState<{
    visible: boolean;
    opacity: number;
    showLabels: boolean;
  }>({ visible: true, opacity: 0.75, showLabels: false });

  // Phase 20E.1: Sub-view Navigation state ('canvas' | 'files_library' | 'pdf_viewer')
  const [subView, setSubView] = useState<'canvas' | 'files_library' | 'pdf_viewer'>('canvas');
  const [activeViewerFile, setActiveViewerFile] = useState<UploadedMapFile | null>(null);
  const [viewSource, setViewSource] = useState<'canvas' | 'files_library'>('canvas');

  // Selected CS and BS Cadastral Map Files
  const [selectedCsFile, setSelectedCsFile] = useState<UploadedMapFile | null>(() => {
    const files = getStoredMapFiles();
    return files.find((f) => f.category === 'cs_map') || files[0] || null;
  });

  const [selectedBsFile, setSelectedBsFile] = useState<UploadedMapFile | null>(() => {
    const files = getStoredMapFiles();
    return files.find((f) => f.category === 'bs_map') || files[1] || null;
  });

  // B: Simple CS ↔ BS overlay controls + split comparison preview
  const [csBsViewMode, setCsBsViewMode] = useState<'overlay' | 'side-by-side'>('overlay');
  const [csOverlayVisible, setCsOverlayVisible] = useState(true);
  const [bsOverlayVisible, setBsOverlayVisible] = useState(true);
  const [csOverlayOpacity, setCsOverlayOpacity] = useState(0.5);
  const [bsOverlayOpacity, setBsOverlayOpacity] = useState(0.5);
  const [dagSearchQuery, setDagSearchQuery] = useState(selectedDag?.dagNo || '');
  const [isDagSearchOpen, setIsDagSearchOpen] = useState(false);
  const [dagSearchHighlight, setDagSearchHighlight] = useState(false);

  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);

  // Saved Projects List & Selector
  const [savedProjects, setSavedProjects] = useState<ComparativePentagraphProject[]>(() =>
    getStoredPentagraphProjects()
  );
  const [selectedProjectIdToLoad, setSelectedProjectIdToLoad] = useState<string>('');

  useEffect(() => {
    setDagSearchQuery(selectedDag?.dagNo || '');
  }, [selectedDag?.id, selectedDag?.dagNo]);

  // Realtime Cloud Listener for Comparative Pentagraph Projects (Multi-device synchronization)
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !currentUser?.id) return;

    let q;
    if (currentUser.role === 'admin') {
      q = query(collection(db, 'pentagraphProjects'));
    } else {
      q = query(
        collection(db, 'pentagraphProjects'),
        where('ownerId', '==', currentUser.id)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudProjects: ComparativePentagraphProject[] = [];
          snapshot.forEach((docSnap) => {
            cloudProjects.push(docSnap.data() as ComparativePentagraphProject);
          });
          setSavedProjects((prev) => {
            const map = new Map(cloudProjects.map((p) => [p.id, p]));
            const merged = prev.map((localP) => {
              if (map.has(localP.id)) {
                const updated = map.get(localP.id)!;
                map.delete(localP.id);
                return updated;
              }
              return localP;
            });
            map.forEach((newP) => merged.unshift(newP));
            localStorage.setItem('bhumi_pentagraph_projects', JSON.stringify(merged));
            return merged;
          });
        }
      },
      (err) => console.warn('Firestore pentagraphProjects listener notice:', err)
    );

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role]);

  // ---------------------------------------------------------------------------
  // Digital Demarcation (দখল/সীমানা নির্ধারণ) & Pentagraph Tool State (Phase 20J.3)
  // ---------------------------------------------------------------------------
  const [activeTool, setActiveTool] = useState<
    'select' | 'point' | 'move' | 'line' | 'distance' | 'area' | 'note'
  >('select');
  const [unit, setUnit] = useState<'feet' | 'link'>('feet');
  const [showDistances, setShowDistances] = useState<boolean>(true);
  const [showAreaOverlay, setShowAreaOverlay] = useState<boolean>(true);
  const [surveyedPoints, setSurveyedPoints] = useState<DigitizedDagPoint[]>([]);
  const [selectedSurveyedPointIndex, setSelectedSurveyedPointIndex] = useState<number | null>(null);
  const [isDraggingSurveyPoint, setIsDraggingSurveyPoint] = useState<number | null>(null);
  const [demarcationNotes, setDemarcationNotes] = useState<string>(
    'দখল ও সীমানা তুলনামূলক মাঠ নিরীক্ষা সম্পন্ন।'
  );
  const [clientName, setClientName] = useState<string>('');
  const [khatianNo, setKhatianNo] = useState<string>('');
  const [aminName, setAminName] = useState<string>('মেহেদী হাসান বাবু');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [showNoteEditor, setShowNoteEditor] = useState<boolean>(false);
  const [demarcationUndoStack, setDemarcationUndoStack] = useState<
    {
      surveyedPoints: DigitizedDagPoint[];
      referencePoints: DigitizedDagPoint[];
      notes: string;
    }[]
  >([]);
  const [demarcationRedoStack, setDemarcationRedoStack] = useState<
    {
      surveyedPoints: DigitizedDagPoint[];
      referencePoints: DigitizedDagPoint[];
      notes: string;
    }[]
  >([]);

  // Asynchronously resolve background Mouza Map URL (IndexedDB, direct, or Cadastral Sheet generator)
  const [resolvedMouzaBgUrl, setResolvedMouzaBgUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    if (!currentMap) {
      setResolvedMouzaBgUrl(undefined);
      return;
    }

    resolveMouzaMapFileUrl(currentMap).then((url) => {
      if (active) {
        setResolvedMouzaBgUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [currentMap?.id, currentMap?.fileDataUrl]);

  // Asynchronously resolve CS and BS scanned map raster/dataUrls
  const [resolvedCsBgUrl, setResolvedCsBgUrl] = useState<string | undefined>(undefined);
  const [resolvedBsBgUrl, setResolvedBsBgUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (selectedCsFile) {
      setResolvedCsBgUrl(undefined);
      getStoredMapFileWithContent(selectedCsFile.id || selectedCsFile.name).then((full) => {
        if (active && full?.dataUrl) {
          setResolvedCsBgUrl(full.dataUrl);
        }
      });
    } else {
      setResolvedCsBgUrl(undefined);
    }

    if (selectedBsFile) {
      setResolvedBsBgUrl(undefined);
      getStoredMapFileWithContent(selectedBsFile.id || selectedBsFile.name).then((full) => {
        if (active && full?.dataUrl) {
          setResolvedBsBgUrl(full.dataUrl);
        }
      });
    } else {
      setResolvedBsBgUrl(undefined);
    }

    return () => {
      active = false;
    };
  }, [selectedCsFile?.id, selectedCsFile?.name, selectedBsFile?.id, selectedBsFile?.name]);

  // Navigation: Open Files Library
  const openFilesLibrary = () => {
    try {
      window.history.pushState({ pentagraphSubView: 'files_library' }, '');
    } catch (e) {
      // Ignore in restrictive iframe environments
    }
    setSubView('files_library');
  };

  // Navigation: Open PDF / Document Viewer
  const openPdfViewer = (file: UploadedMapFile, source: 'canvas' | 'files_library' = 'canvas') => {
    setActiveViewerFile(file);
    setViewSource(source);
    try {
      window.history.pushState({ pentagraphSubView: 'pdf_viewer', fileId: file.id, source }, '');
    } catch (e) {
      // Ignore
    }
    setSubView('pdf_viewer');
  };

  // Navigation: Return from PDF Viewer
  const handleBackFromViewer = () => {
    if (window.history.state?.pentagraphSubView === 'pdf_viewer') {
      window.history.back();
    } else {
      if (viewSource === 'files_library') {
        setSubView('files_library');
      } else {
        setSubView('canvas');
      }
      setActiveViewerFile(null);
    }
  };

  // Navigation: Return from File Library
  const handleBackFromLibrary = () => {
    if (window.history.state?.pentagraphSubView === 'files_library') {
      window.history.back();
    } else {
      setSubView('canvas');
    }
  };

  // Select CS / BS handlers
  const handleSelectAsCs = (file: UploadedMapFile) => {
    setSelectedCsFile(file);
    setNotificationMsg(
      isBn
        ? `"${file.name}" CS ম্যাপ হিসেবে সফলভাবে নির্বাচিত হয়েছে!`
        : `"${file.name}" selected as CS Map!`
    );
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleSelectAsBs = (file: UploadedMapFile) => {
    setSelectedBsFile(file);
    setNotificationMsg(
      isBn
        ? `"${file.name}" BS ম্যাপ হিসেবে সফলভাবে নির্বাচিত হয়েছে!`
        : `"${file.name}" selected as BS Map!`
    );
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  // Popstate Listener: Android / Browser Back Button Support
  // Flow: PDF Viewer -> Uploaded Files -> Digital Pentagraph -> Previous Parent Screen
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { pentagraphSubView?: string; source?: string } | null;
      if (subView === 'pdf_viewer') {
        if (viewSource === 'files_library' || state?.pentagraphSubView === 'files_library') {
          setSubView('files_library');
        } else {
          setSubView('canvas');
        }
        setActiveViewerFile(null);
      } else if (subView === 'files_library') {
        setSubView('canvas');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [subView, viewSource]);

  // Update container size
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(Math.max(400, height)),
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Touch tracking refs
  const touchStartCoordRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchMovedRef = useRef<boolean>(false);
  const lastTouchTimeRef = useRef<number>(0);
  const mouseMovedRef = useRef<boolean>(false);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseMovedRef.current = false;
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const moveDist = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
    if (moveDist > 4) {
      mouseMovedRef.current = true;
    }

    if (isDraggingSurveyPoint !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const worldX = Math.round((clickX - pan.x) / zoom);
      const worldY = Math.round((clickY - pan.y) / zoom);
      setSurveyedPoints((prev) =>
        prev.map((pt, idx) =>
          idx === isDraggingSurveyPoint ? { ...pt, x: worldX, y: worldY } : pt
        )
      );
      return;
    }

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
    if (isDraggingSurveyPoint !== null) {
      pushDemarcationUndo();
      setIsDraggingSurveyPoint(null);
    }
  };

  // Mouse Wheel Focal Zoom for trackpads & mice
  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const targetZoom = Math.min(5.0, Math.max(0.3, Math.round(zoom * zoomFactor * 100) / 100));

    const worldX = (cursorX - pan.x) / zoom;
    const worldY = (cursorY - pan.y) / zoom;

    const targetPanX = Math.round(cursorX - worldX * targetZoom);
    const targetPanY = Math.round(cursorY - worldY * targetZoom);

    setZoom(targetZoom);
    setPan({ x: targetPanX, y: targetPanY });
  };

  // Touch Gestures for Comparative Pentagraph Canvas (Mobile 1-finger Pan & 2-finger Pinch Zoom)
  const touchStateRef = useRef<{
    isPanning: boolean;
    isPinching: boolean;
    startX: number;
    startY: number;
    initialPan: { x: number; y: number };
    initialDist: number;
    initialZoom: number;
  }>({
    isPanning: false,
    isPinching: false,
    startX: 0,
    startY: 0,
    initialPan: { x: 0, y: 0 },
    initialDist: 0,
    initialZoom: 1,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchMovedRef.current = false;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartCoordRef.current = { x: touch.clientX, y: touch.clientY };
      touchStateRef.current = {
        isPanning: true,
        isPinching: false,
        startX: touch.clientX,
        startY: touch.clientY,
        initialPan: { ...pan },
        initialDist: 0,
        initialZoom: zoom,
      };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStateRef.current = {
        isPanning: false,
        isPinching: true,
        startX: (t1.clientX + t2.clientX) / 2,
        startY: (t1.clientY + t2.clientY) / 2,
        initialPan: { ...pan },
        initialDist: Math.max(dist, 10),
        initialZoom: zoom,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current.isPinching && touchStateRef.current.initialDist > 0) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStateRef.current.initialDist;
      const targetZoom = Math.min(4.5, Math.max(0.3, touchStateRef.current.initialZoom * ratio));
      setZoom(Math.round(targetZoom * 100) / 100);
    } else if (e.touches.length === 1 && touchStateRef.current.isPanning) {
      const touch = e.touches[0];
      const moveDist = Math.hypot(
        touch.clientX - touchStartCoordRef.current.x,
        touch.clientY - touchStartCoordRef.current.y
      );
      if (moveDist > 6) {
        touchMovedRef.current = true;
      }
      const dx = touch.clientX - touchStateRef.current.startX;
      const dy = touch.clientY - touchStateRef.current.startY;
      setPan({
        x: touchStateRef.current.initialPan.x + dx,
        y: touchStateRef.current.initialPan.y + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    if (e.touches.length === 0) {
      // Check for double-tap zoom
      if (!touchMovedRef.current && now - lastTouchTimeRef.current < 280) {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const cursorX = touchStartCoordRef.current.x - rect.left;
          const cursorY = touchStartCoordRef.current.y - rect.top;
          const targetZoom = Math.min(5.0, Math.round(zoom * 1.35 * 100) / 100);
          const worldX = (cursorX - pan.x) / zoom;
          const worldY = (cursorY - pan.y) / zoom;
          const targetPanX = Math.round(cursorX - worldX * targetZoom);
          const targetPanY = Math.round(cursorY - worldY * targetZoom);
          setZoom(targetZoom);
          setPan({ x: targetPanX, y: targetPanY });
        }
        lastTouchTimeRef.current = 0;
      } else {
        lastTouchTimeRef.current = now;
        // Tap to add point on mobile
        if (
          !touchMovedRef.current &&
          (activeTool === 'point' || activeTool === 'line') &&
          containerRef.current
        ) {
          const rect = containerRef.current.getBoundingClientRect();
          const clickX = touchStartCoordRef.current.x - rect.left;
          const clickY = touchStartCoordRef.current.y - rect.top;
          const worldX = Math.round((clickX - pan.x) / zoom);
          const worldY = Math.round((clickY - pan.y) / zoom);
          pushDemarcationUndo();
          const newPt: DigitizedDagPoint = {
            id: `surv-pt-${Date.now()}`,
            x: worldX,
            y: worldY,
            label: `S${surveyedPoints.length + 1}`,
            sourceType: 'manual',
          };
          setSurveyedPoints((prev) => [...prev, newPt]);
          setSelectedSurveyedPointIndex(surveyedPoints.length);
        }
      }
      touchStateRef.current.isPanning = false;
      touchStateRef.current.isPinching = false;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStateRef.current.isPinching = false;
      touchStateRef.current.isPanning = true;
      touchStateRef.current.startX = touch.clientX;
      touchStateRef.current.startY = touch.clientY;
      touchStateRef.current.initialPan = { ...pan };
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, Math.round((z - 0.25) * 100) / 100));
  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Selected GPS Record
  const activeGpsSurvey = useMemo(() => {
    if (selectedSurveyId === 'active_gps') return null;
    return surveys.find((s) => s.id === selectedSurveyId) || null;
  }, [selectedSurveyId, surveys]);

  // Selected Drawing Record
  const activeDrawingSurvey = useMemo(() => {
    if (!selectedDrawingId) return null;
    return surveys.find((s) => s.id === selectedDrawingId) || null;
  }, [selectedDrawingId, surveys]);

  // GPS Survey Points
  const rawGpsPoints = useMemo(() => {
    if (activeGpsSurvey) {
      return activeGpsSurvey.points.map((p) => ({
        latitude: p.lat ?? 0,
        longitude: p.lng ?? 0,
        label: p.label || p.name,
      }));
    }
    return activeGpsPoints;
  }, [activeGpsSurvey, activeGpsPoints]);

  const validGpsPoints = useMemo(() => {
    return filterValidPoints(rawGpsPoints);
  }, [rawGpsPoints]);

  // Scale pixels per foot
  const scale = currentMap?.scalePixelsPerFoot || 1.2;

  // 1. Digitized Dag points & metrics
  const dagPoints = useMemo(() => {
    if (!selectedDag || !selectedDag.points) return [];
    return selectedDag.points;
  }, [selectedDag]);

  const dagSearchMatches = useMemo(() => {
    const digits = '০১২৩৪৫৬৭৮৯';
    const normalize = (value: string) =>
      value.replace(/[০-৯]/g, (digit) => String(digits.indexOf(digit))).trim().toLowerCase();
    const queryText = normalize(dagSearchQuery);
    const allDags = currentMap?.digitizedDags || [];
    return (queryText
      ? allDags.filter((dag) => normalize(dag.dagNo).includes(queryText))
      : allDags
    ).slice(0, 8);
  }, [currentMap?.digitizedDags, dagSearchQuery]);

  const dagCentroid = useMemo(() => {
    if (dagPoints.length === 0) return { x: 200, y: 150 };
    return calculatePolygonCentroid(dagPoints);
  }, [dagPoints]);

  // --------------------------------------------------------------------------
  // Advanced Multi-Layer Vertex Editing State
  // --------------------------------------------------------------------------
  const [isVertexEditMode, setIsVertexEditMode] = useState<boolean>(false);
  const [selectedEditLayerId, setSelectedEditLayerId] = useState<'layer-dag' | 'layer-cs' | 'layer-bs'>('layer-dag');
  const [isSnapEnabled, setIsSnapEnabled] = useState<boolean>(true);
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // Layer 1: Dag layer points
  const [customDagPoints, setCustomDagPoints] = useState<DigitizedDagPoint[]>([]);
  const [originalDagPoints, setOriginalDagPoints] = useState<DigitizedDagPoint[]>([]);
  const [dagUndoStack, setDagUndoStack] = useState<DigitizedDagPoint[][]>([]);
  const [dagRedoStack, setDagRedoStack] = useState<DigitizedDagPoint[][]>([]);

  // Layer 2: CS Map Layer points
  const [customCsPoints, setCustomCsPoints] = useState<DigitizedDagPoint[]>([]);
  const [originalCsPoints, setOriginalCsPoints] = useState<DigitizedDagPoint[]>([]);
  const [csUndoStack, setCsUndoStack] = useState<DigitizedDagPoint[][]>([]);
  const [csRedoStack, setCsRedoStack] = useState<DigitizedDagPoint[][]>([]);

  // Layer 3: BS Map Layer points
  const [customBsPoints, setCustomBsPoints] = useState<DigitizedDagPoint[]>([]);
  const [originalBsPoints, setOriginalBsPoints] = useState<DigitizedDagPoint[]>([]);
  const [bsUndoStack, setBsUndoStack] = useState<DigitizedDagPoint[][]>([]);
  const [bsRedoStack, setBsRedoStack] = useState<DigitizedDagPoint[][]>([]);

  // Initialize/synchronize when selectedDag changes
  useEffect(() => {
    if (selectedDag && selectedDag.points) {
      const formatted = selectedDag.points.map((p, idx) => ({
        ...p,
        sourceType: p.sourceType || 'digitized',
        label: p.label || `D${idx + 1}`,
      }));
      setCustomDagPoints(formatted);
      setOriginalDagPoints(selectedDag.originalPoints || formatted);
      setDagUndoStack([]);
      setDagRedoStack([]);
      setSelectedPointIndex(null);

      // Default CS layer points
      const csPts: DigitizedDagPoint[] = formatted.map((p, i) => ({
        id: `cs-pt-${i}`,
        x: Math.round(p.x - 14),
        y: Math.round(p.y + 10),
        sourceType: 'digitized',
        label: `CS${i + 1}`,
      }));
      setCustomCsPoints(csPts);
      setOriginalCsPoints(csPts);

      // Default BS layer points
      const bsPts: DigitizedDagPoint[] = formatted.map((p, i) => ({
        id: `bs-pt-${i}`,
        x: Math.round(p.x + 10),
        y: Math.round(p.y - 8),
        sourceType: 'digitized',
        label: `BS${i + 1}`,
      }));
      setCustomBsPoints(bsPts);
      setOriginalBsPoints(bsPts);

      // Default Surveyed / Occupied Boundary points (initialized with field offset for immediate comparative view)
      const initialSurv: DigitizedDagPoint[] = formatted.map((p, i) => ({
        id: `surv-pt-${i}`,
        x: Math.round(p.x + (i % 2 === 0 ? 8 : -6)),
        y: Math.round(p.y + (i % 2 === 1 ? 6 : -4)),
        sourceType: 'manual',
        label: `S${i + 1}`,
      }));
      setSurveyedPoints(initialSurv);
    } else {
      setCustomDagPoints([]);
      setOriginalDagPoints([]);
      setCustomCsPoints([]);
      setCustomBsPoints([]);
      setSurveyedPoints([]);
      setIsVertexEditMode(false);
      setSelectedPointIndex(null);
    }
  }, [selectedDag]);

  // ---------------------------------------------------------------------------
  // Digital Demarcation Actions & Geometry Calculations (Phase 20J.3)
  // ---------------------------------------------------------------------------
  const pushDemarcationUndo = useCallback(
    (newSurv = surveyedPoints, newRef = customDagPoints, newNotes = demarcationNotes) => {
      setDemarcationUndoStack((prev) => [
        ...prev,
        {
          surveyedPoints: [...newSurv],
          referencePoints: [...newRef],
          notes: newNotes,
        },
      ]);
      setDemarcationRedoStack([]);
    },
    [surveyedPoints, customDagPoints, demarcationNotes]
  );

  const handleDemarcationUndo = useCallback(() => {
    if (demarcationUndoStack.length === 0) return;
    const prev = demarcationUndoStack[demarcationUndoStack.length - 1];
    setDemarcationUndoStack((s) => s.slice(0, -1));
    setDemarcationRedoStack((s) => [
      ...s,
      {
        surveyedPoints: [...surveyedPoints],
        referencePoints: [...customDagPoints],
        notes: demarcationNotes,
      },
    ]);
    setSurveyedPoints(prev.surveyedPoints);
    setCustomDagPoints(prev.referencePoints);
    setDemarcationNotes(prev.notes);
    setSelectedSurveyedPointIndex(null);
  }, [demarcationUndoStack, surveyedPoints, customDagPoints, demarcationNotes]);

  const handleDemarcationRedo = useCallback(() => {
    if (demarcationRedoStack.length === 0) return;
    const next = demarcationRedoStack[demarcationRedoStack.length - 1];
    setDemarcationRedoStack((s) => s.slice(0, -1));
    setDemarcationUndoStack((s) => [
      ...s,
      {
        surveyedPoints: [...surveyedPoints],
        referencePoints: [...customDagPoints],
        notes: demarcationNotes,
      },
    ]);
    setSurveyedPoints(next.surveyedPoints);
    setCustomDagPoints(next.referencePoints);
    setDemarcationNotes(next.notes);
  }, [demarcationRedoStack, surveyedPoints, customDagPoints, demarcationNotes]);

  // Clone Reference boundary into Surveyed boundary as starting baseline
  const handleCloneReferenceToSurveyed = () => {
    const source = customDagPoints.length > 0 ? customDagPoints : dagPoints;
    if (source.length === 0) return;
    pushDemarcationUndo();
    const cloned: DigitizedDagPoint[] = source.map((p, idx) => ({
      id: `surv-${Date.now()}-${idx}`,
      x: p.x,
      y: p.y,
      sourceType: 'manual',
      label: `S${idx + 1}`,
    }));
    setSurveyedPoints(cloned);
    setNotificationMsg(
      isBn
        ? 'মূল নকশা হতে দখল সীমানার বেসলাইন তৈরি হয়েছে! এখন প্রয়োজনমতো পয়েন্ট মুভ বা যোগ করুন।'
        : 'Copied reference dag to surveyed boundary! You can now adjust points.'
    );
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  // Clear current surveyed comparison
  const handleClearComparison = () => {
    if (surveyedPoints.length === 0) return;
    if (
      window.confirm(
        isBn
          ? 'আপনি কি বর্তমান দখল/মাঠ জরিপ সীমানা মুছে ফেলতে চান? (Undo দিয়ে ফিরিয়ে আনা যাবে)'
          : 'Do you want to clear current surveyed boundary? (Can be undone)'
      )
    ) {
      pushDemarcationUndo();
      setSurveyedPoints([]);
      setSelectedSurveyedPointIndex(null);
      setNotificationMsg(isBn ? 'দখল সীমানা মুছে ফেলা হয়েছে।' : 'Surveyed boundary cleared.');
      setTimeout(() => setNotificationMsg(null), 3000);
    }
  };

  // Add vertex on segment of surveyed boundary
  const handleAddSurveyPointOnSegment = (segIdx: number, coords: { x: number; y: number }) => {
    pushDemarcationUndo();
    const updated = insertVertexAtSegment(surveyedPoints, segIdx, coords, 'manual');
    setSurveyedPoints(updated);
    setSelectedSurveyedPointIndex(segIdx + 1);
  };

  // Delete selected vertex from surveyed boundary
  const handleDeleteSurveyPoint = () => {
    if (selectedSurveyedPointIndex === null) return;
    if (surveyedPoints.length <= 3) {
      alert(
        isBn
          ? 'বহুভুজ সীমানা বজায় রাখতে কমপক্ষে ৩টি পয়েন্ট প্রয়োজন।'
          : 'At least 3 points required for a boundary polygon.'
      );
      return;
    }
    pushDemarcationUndo();
    const { success, updatedPoints } = deleteVertexAtIndex(
      surveyedPoints,
      selectedSurveyedPointIndex
    );
    if (success) {
      setSurveyedPoints(updatedPoints);
      setSelectedSurveyedPointIndex(null);
      setNotificationMsg(isBn ? 'পয়েন্ট মুছে ফেলা হয়েছে।' : 'Point deleted.');
      setTimeout(() => setNotificationMsg(null), 3000);
    }
  };

  // Active Reference points and metrics
  const activeRefPoints = useMemo(() => {
    return customDagPoints.length > 0 ? customDagPoints : dagPoints;
  }, [customDagPoints, dagPoints]);

  const activeRefMetrics = useMemo(() => {
    if (activeRefPoints.length < 3) {
      return {
        areaSqFt: selectedDag?.areaSqFt || 0,
        areaDecimal: selectedDag?.areaDecimal || 0,
        areaKatha: selectedDag?.areaKatha || 0,
        areaBigha: selectedDag?.areaBigha || 0,
        areaAcre: roundClean((selectedDag?.areaSqFt || 0) / 43560, 4),
        perimeterFt: selectedDag?.perimeterFt || 0,
      };
    }
    return calculatePolygonMetrics(activeRefPoints, scale);
  }, [activeRefPoints, scale, selectedDag]);

  // Surveyed boundary segments calculation (Feet / Link)
  const surveyedSegments = useMemo(() => {
    if (surveyedPoints.length < 2) return [];
    const segs: {
      p1: DigitizedDagPoint;
      p2: DigitizedDagPoint;
      midX: number;
      midY: number;
      distFt: number;
      distLk: number;
      label: string;
    }[] = [];
    const count = surveyedPoints.length >= 3 ? surveyedPoints.length : surveyedPoints.length - 1;
    for (let i = 0; i < count; i++) {
      const p1 = surveyedPoints[i];
      const p2 = surveyedPoints[(i + 1) % surveyedPoints.length];
      const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const distFt = distPx / scale;
      const distLk = distFt / LAND_CONSTANTS.FEET_PER_LINK;
      const numStr =
        unit === 'feet'
          ? isBn
            ? formatNumberByLang(distFt.toFixed(1), 'bn')
            : distFt.toFixed(1)
          : isBn
          ? formatNumberByLang(distLk.toFixed(1), 'bn')
          : distLk.toFixed(1);
      const uLabel = unit === 'feet' ? (isBn ? 'ফু.' : 'ft') : isBn ? 'লি.' : 'lk';
      segs.push({
        p1,
        p2,
        midX: (p1.x + p2.x) / 2,
        midY: (p1.y + p2.y) / 2,
        distFt,
        distLk,
        label: `${numStr} ${uLabel}`,
      });
    }
    return segs;
  }, [surveyedPoints, scale, unit, isBn]);

  // Surveyed boundary polygon metrics
  const surveyedMetrics = useMemo(() => {
    if (surveyedPoints.length < 3) {
      return {
        areaSqFt: 0,
        areaDecimal: 0,
        areaKatha: 0,
        areaBigha: 0,
        areaAcre: 0,
        perimeterFt: 0,
      };
    }
    return calculatePolygonMetrics(surveyedPoints, scale);
  }, [surveyedPoints, scale]);

  const surveyedCentroid = useMemo(() => {
    if (surveyedPoints.length === 0) return { x: 200, y: 150 };
    return calculatePolygonCentroid(surveyedPoints);
  }, [surveyedPoints]);

  const surveyedPathData = useMemo(() => {
    if (surveyedPoints.length < 2) return '';
    return (
      surveyedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
      (surveyedPoints.length >= 3 ? ' Z' : '')
    );
  }, [surveyedPoints]);

  // Comparison & Demarcation Variance
  const [comparisonMode, setComparisonMode] = useState<'dag-gps' | 'field-gps'>('dag-gps');

  const demarcationVariance = useMemo(() => {
    // Determine reference points and metrics based on mode
    const isDagMode = comparisonMode === 'dag-gps';
    const refAreaSqFt = isDagMode ? activeRefMetrics.areaSqFt : 0; // Field Boundary is not accessible here
    const refAreaDecimal = isDagMode ? activeRefMetrics.areaDecimal : 0;
    const refPerimFt = isDagMode ? activeRefMetrics.perimeterFt : 0;

    const areaDiffSqFt = Math.abs(surveyedMetrics.areaSqFt - refAreaSqFt);
    const areaDiffDecimal = Math.abs(surveyedMetrics.areaDecimal - refAreaDecimal);
    const perimDiffFt = Math.abs(surveyedMetrics.perimeterFt - refPerimFt);
    const perimDiffLk = perimDiffFt / LAND_CONSTANTS.FEET_PER_LINK;
    const pctVariance = refAreaSqFt > 0 ? (areaDiffSqFt / refAreaSqFt) * 100 : 0;
    
    // Centroid Offset logic (needs adjustment for field boundary centroid)
    const centroidOffsetPx = Math.hypot(
      surveyedCentroid.x - dagCentroid.x,
      surveyedCentroid.y - dagCentroid.y
    );
    const centroidOffsetFt = Math.round((centroidOffsetPx / scale) * 10) / 10;
    const centroidOffsetLk =
      Math.round((centroidOffsetFt / LAND_CONSTANTS.FEET_PER_LINK) * 10) / 10;

    return {
      areaDiffSqFt: Math.round(areaDiffSqFt * 10) / 10,
      areaDiffDecimal: Math.round(areaDiffDecimal * 100) / 100,
      perimDiffFt: Math.round(perimDiffFt * 10) / 10,
      perimDiffLk: Math.round(perimDiffLk * 10) / 10,
      pctVariance: Math.round(pctVariance * 10) / 10,
      centroidOffsetFt,
      centroidOffsetLk,
    };
  }, [comparisonMode, surveyedMetrics, activeRefMetrics, surveyedCentroid, dagCentroid, scale]);

  // Points for currently active editing layer
  const activePointsForEdit = useMemo(() => {
    if (selectedEditLayerId === 'layer-cs') {
      return customCsPoints;
    }
    if (selectedEditLayerId === 'layer-bs') {
      return customBsPoints;
    }
    return customDagPoints.length > 0 ? customDagPoints : dagPoints;
  }, [selectedEditLayerId, customCsPoints, customBsPoints, customDagPoints, dagPoints]);

  const activeOriginalPointsForEdit = useMemo(() => {
    if (selectedEditLayerId === 'layer-cs') {
      return originalCsPoints;
    }
    if (selectedEditLayerId === 'layer-bs') {
      return originalBsPoints;
    }
    return originalDagPoints.length > 0 ? originalDagPoints : dagPoints;
  }, [selectedEditLayerId, originalCsPoints, originalBsPoints, originalDagPoints, dagPoints]);

  const isCurrentLayerEdited = useMemo(() => {
    return arePointsDifferent(activePointsForEdit, activeOriginalPointsForEdit);
  }, [activePointsForEdit, activeOriginalPointsForEdit]);

  const activeLayerMetrics = useMemo(() => {
    if (activePointsForEdit.length < 3) {
      return {
        areaSqFt: 0,
        areaDecimal: 0,
        areaKatha: 0,
        areaBigha: 0,
        areaAcre: 0,
        perimeterFt: 0,
      };
    }
    return calculatePolygonMetrics(activePointsForEdit, scale);
  }, [activePointsForEdit, scale]);

  const activeLayerSegments = useMemo(() => {
    return calculateSegmentInfos(activePointsForEdit, scale);
  }, [activePointsForEdit, scale]);

  const activeEditLayerColor = useMemo(() => {
    if (selectedEditLayerId === 'layer-cs') return '#a855f7'; // Purple
    if (selectedEditLayerId === 'layer-bs') return '#f97316'; // Orange
    return '#10b981'; // Emerald
  }, [selectedEditLayerId]);

  const pushActiveUndo = () => {
    if (selectedEditLayerId === 'layer-cs') {
      setCsUndoStack((s) => [...s, customCsPoints]);
      setCsRedoStack([]);
    } else if (selectedEditLayerId === 'layer-bs') {
      setBsUndoStack((s) => [...s, customBsPoints]);
      setBsRedoStack([]);
    } else {
      setDagUndoStack((s) => [...s, customDagPoints]);
      setDagRedoStack([]);
    }
  };

  const handleActiveUndo = () => {
    if (selectedEditLayerId === 'layer-cs') {
      if (csUndoStack.length === 0) return;
      const prev = csUndoStack[csUndoStack.length - 1];
      setCsUndoStack((s) => s.slice(0, -1));
      setCsRedoStack((s) => [...s, customCsPoints]);
      setCustomCsPoints(prev);
    } else if (selectedEditLayerId === 'layer-bs') {
      if (bsUndoStack.length === 0) return;
      const prev = bsUndoStack[bsUndoStack.length - 1];
      setBsUndoStack((s) => s.slice(0, -1));
      setBsRedoStack((s) => [...s, customBsPoints]);
      setCustomBsPoints(prev);
    } else {
      if (dagUndoStack.length === 0) return;
      const prev = dagUndoStack[dagUndoStack.length - 1];
      setDagUndoStack((s) => s.slice(0, -1));
      setDagRedoStack((s) => [...s, customDagPoints]);
      setCustomDagPoints(prev);
    }
  };

  const handleActiveRedo = () => {
    if (selectedEditLayerId === 'layer-cs') {
      if (csRedoStack.length === 0) return;
      const next = csRedoStack[csRedoStack.length - 1];
      setCsRedoStack((s) => s.slice(0, -1));
      setCsUndoStack((s) => [...s, customCsPoints]);
      setCustomCsPoints(next);
    } else if (selectedEditLayerId === 'layer-bs') {
      if (bsRedoStack.length === 0) return;
      const next = bsRedoStack[bsRedoStack.length - 1];
      setBsRedoStack((s) => s.slice(0, -1));
      setBsUndoStack((s) => [...s, customBsPoints]);
      setCustomBsPoints(next);
    } else {
      if (dagRedoStack.length === 0) return;
      const next = dagRedoStack[dagRedoStack.length - 1];
      setDagRedoStack((s) => s.slice(0, -1));
      setDagUndoStack((s) => [...s, customDagPoints]);
      setCustomDagPoints(next);
    }
  };

  const handlePointDrag = (index: number, newX: number, newY: number) => {
    let tx = newX;
    let ty = newY;
    if (isSnapEnabled) {
      const snap = findSnapPoint(newX, newY, activePointsForEdit, index, 14);
      if (snap.isSnapped) {
        tx = snap.x;
        ty = snap.y;
        setSnapResult(snap);
      } else {
        setSnapResult(null);
      }
    } else {
      setSnapResult(null);
    }

    const updated = activePointsForEdit.map((pt, i) =>
      i === index
        ? { ...pt, x: Math.round(tx), y: Math.round(ty), sourceType: 'manual' as const }
        : pt
    );

    if (selectedEditLayerId === 'layer-cs') setCustomCsPoints(updated);
    else if (selectedEditLayerId === 'layer-bs') setCustomBsPoints(updated);
    else setCustomDagPoints(updated);
  };

  const handlePointDragEnd = () => {
    pushActiveUndo();
    setSnapResult(null);
  };

  const handleAddPointOnSegment = (segIdx: number, coords: { x: number; y: number }) => {
    pushActiveUndo();
    const updated = insertVertexAtSegment(activePointsForEdit, segIdx, coords, 'manual');
    if (selectedEditLayerId === 'layer-cs') setCustomCsPoints(updated);
    else if (selectedEditLayerId === 'layer-bs') setCustomBsPoints(updated);
    else setCustomDagPoints(updated);

    setSelectedPointIndex(segIdx + 1);
    setNotificationMsg(
      isBn ? 'নতুন পয়েন্ট সফলভাবে যুক্ত হয়েছে!' : 'New vertex added successfully!'
    );
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleDeleteVertex = () => {
    if (selectedPointIndex === null) return;
    if (activePointsForEdit.length <= 3) {
      alert(
        isBn
          ? 'বহুভুজ সীমানা বজায় রাখতে কমপক্ষে ৩টি পয়েন্ট প্রয়োজন।'
          : 'At least 3 vertices required.'
      );
      return;
    }
    pushActiveUndo();
    const { success, updatedPoints } = deleteVertexAtIndex(activePointsForEdit, selectedPointIndex);
    if (success) {
      if (selectedEditLayerId === 'layer-cs') setCustomCsPoints(updatedPoints);
      else if (selectedEditLayerId === 'layer-bs') setCustomBsPoints(updatedPoints);
      else setCustomDagPoints(updatedPoints);

      setSelectedPointIndex(null);
      setNotificationMsg(isBn ? 'পয়েন্ট মুছে ফেলা হয়েছে।' : 'Vertex removed.');
      setTimeout(() => setNotificationMsg(null), 3000);
    }
  };

  const handleNudge = (dx: number, dy: number) => {
    if (selectedPointIndex === null) return;
    pushActiveUndo();
    const updated = nudgeVertex(activePointsForEdit, selectedPointIndex, dx, dy);
    if (selectedEditLayerId === 'layer-cs') setCustomCsPoints(updated);
    else if (selectedEditLayerId === 'layer-bs') setCustomBsPoints(updated);
    else setCustomDagPoints(updated);
  };

  const handleActiveReset = () => {
    pushActiveUndo();
    if (selectedEditLayerId === 'layer-cs') setCustomCsPoints([...originalCsPoints]);
    else if (selectedEditLayerId === 'layer-bs') setCustomBsPoints([...originalBsPoints]);
    else setCustomDagPoints([...originalDagPoints]);

    setNotificationMsg(
      isBn ? 'নির্বাচিত লেয়ারের মূল (Original) জ্যামিতি পুনঃস্থাপন করা হয়েছে!' : 'Original geometry restored!'
    );
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // 2. Real GPS points projected to canvas
  const gpsCanvasPoints = useMemo(() => {
    if (validGpsPoints.length < 3) return [];

    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;

    for (const p of validGpsPoints) {
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
    }

    const widthDeg = Math.max(maxLng - minLng, 0.00001);
    const heightDeg = Math.max(maxLat - minLat, 0.00001);

    // Overlay dimension matching canvas scale
    const targetSpan = 220;

    return validGpsPoints.map((p, idx) => {
      const relX = ((p.longitude - minLng) / widthDeg - 0.5) * targetSpan;
      const relY = ((1 - (p.latitude - minLat) / heightDeg) - 0.5) * targetSpan;
      return {
        id: `gps-pt-${idx}`,
        label: p.label || `G${idx + 1}`,
        x: Math.round(dagCentroid.x + relX + 10), // slight offset to demonstrate pentagraph displacement
        y: Math.round(dagCentroid.y + relY - 8),
        lat: p.latitude,
        lng: p.longitude,
      };
    });
  }, [validGpsPoints, dagCentroid]);

  const gpsCentroid = useMemo(() => {
    if (gpsCanvasPoints.length === 0) return { x: 210, y: 142 };
    return calculatePolygonCentroid(gpsCanvasPoints);
  }, [gpsCanvasPoints]);

  const gpsAreaSqFt = useMemo(() => {
    if (activeGpsSurvey) return activeGpsSurvey.areaSqFt;
    if (gpsCanvasPoints.length >= 3) {
      const area = calculateDagPolygonArea(gpsCanvasPoints, scale);
      return area.areaSqFt;
    }
    return 0;
  }, [activeGpsSurvey, gpsCanvasPoints, scale]);

  const gpsPerimeterFt = useMemo(() => {
    if (activeGpsSurvey) return activeGpsSurvey.perimeterFt;
    if (gpsCanvasPoints.length >= 3) {
      const area = calculateDagPolygonArea(gpsCanvasPoints, scale);
      return area.perimeterFt;
    }
    return 0;
  }, [activeGpsSurvey, gpsCanvasPoints, scale]);

  // 3. Saved Drawing canvas points
  const drawingCanvasPoints = useMemo(() => {
    if (!activeDrawingSurvey || activeDrawingSurvey.points.length < 3) return [];
    // Map drawing points around centroid
    return activeDrawingSurvey.points.map((p, idx) => ({
      id: `draw-pt-${idx}`,
      label: p.name || `S${idx + 1}`,
      x: Math.round(dagCentroid.x + (p.x * 0.9 - 10)),
      y: Math.round(dagCentroid.y + (p.y * 0.9 + 5)),
      lat: p.lat,
      lng: p.lng,
    }));
  }, [activeDrawingSurvey, dagCentroid]);

  // Calculate Metrics
  const metrics: PentagraphComparisonMetrics = useMemo(() => {
    const dagArea = selectedDag?.areaSqFt || 0;
    const dagPerimeter = selectedDag?.perimeterFt || 0;
    const drawArea = activeDrawingSurvey ? activeDrawingSurvey.areaSqFt : undefined;

    return calculatePentagraphMetrics(
      dagArea,
      gpsAreaSqFt,
      dagPerimeter,
      gpsPerimeterFt,
      dagCentroid,
      gpsCentroid,
      scale,
      drawArea
    );
  }, [
    selectedDag,
    gpsAreaSqFt,
    gpsPerimeterFt,
    dagCentroid,
    gpsCentroid,
    scale,
    activeDrawingSurvey,
  ]);

  // Fit View to all active layers
  const handleFitView = () => {
    const allPts = [
      ...(customDagPoints.length > 0 ? customDagPoints : dagPoints),
      ...surveyedPoints,
      ...gpsCanvasPoints,
    ];
    if (allPts.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoom(1.05);
      return;
    }
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    allPts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const spanW = Math.max(maxX - minX, 40);
    const spanH = Math.max(maxY - minY, 40);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const targetZoom = Math.min(
      3.2,
      Math.max(0.4, Math.min((dimensions.width - 60) / spanW, (dimensions.height - 60) / spanH))
    );
    const targetPanX = Math.round(dimensions.width / 2 - midX * targetZoom);
    const targetPanY = Math.round(dimensions.height / 2 - midY * targetZoom);

    setZoom(Math.round(targetZoom * 100) / 100);
    setPan({ x: targetPanX, y: targetPanY });
  };

  // Focus a searched dag cleanly without including unrelated GPS/drawing layers.
  const fitPointsToCanvas = (points: { x: number; y: number }[]) => {
    const valid = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (valid.length === 0) return;
    const minX = Math.min(...valid.map((point) => point.x));
    const maxX = Math.max(...valid.map((point) => point.x));
    const minY = Math.min(...valid.map((point) => point.y));
    const maxY = Math.max(...valid.map((point) => point.y));
    const spanW = Math.max(maxX - minX, 32);
    const spanH = Math.max(maxY - minY, 32);
    const targetZoom = Math.min(
      3.2,
      Math.max(0.45, Math.min((dimensions.width - 76) / spanW, (dimensions.height - 76) / spanH))
    );
    setZoom(Math.round(targetZoom * 100) / 100);
    setPan({
      x: Math.round(dimensions.width / 2 - ((minX + maxX) / 2) * targetZoom),
      y: Math.round(dimensions.height / 2 - ((minY + maxY) / 2) * targetZoom),
    });
  };

  const handleSelectDagSearch = (dag: DigitizedDagRecord) => {
    onSelectDag?.(dag.id);
    setDagSearchQuery(dag.dagNo);
    setIsDagSearchOpen(false);
    fitPointsToCanvas(dag.points || []);
    setDagSearchHighlight(true);
    window.setTimeout(() => setDagSearchHighlight(false), 2600);
    setNotificationMsg(isBn ? `দাগ ${dag.dagNo} ফোকাস করা হয়েছে — স্বয়ংক্রিয় জুম` : `Dag ${dag.dagNo} focused — auto-zoomed`);
    window.setTimeout(() => setNotificationMsg(null), 2800);
  };

  const handleConfirmOverlayToDemarcation = () => {
    if (!selectedDag || selectedDag.points.length < 3) {
      setNotificationMsg(isBn ? 'আগে একটি বৈধ দাগ নির্বাচন করুন।' : 'Select a valid dag first.');
      window.setTimeout(() => setNotificationMsg(null), 2600);
      return;
    }
    setCsBsViewMode('overlay');
    handleCloneReferenceToSurveyed();
    fitPointsToCanvas(customDagPoints.length > 0 ? customDagPoints : selectedDag.points);
    window.setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
  };

  // SVG Paths
  const dagPathData = useMemo(() => {
    const pts = customDagPoints.length > 0 ? customDagPoints : dagPoints;
    if (pts.length < 2) return '';
    return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }, [customDagPoints, dagPoints]);

  const csPathData = useMemo(() => {
    if (customCsPoints.length < 2) return '';
    return customCsPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }, [customCsPoints]);

  const bsPathData = useMemo(() => {
    if (customBsPoints.length < 2) return '';
    return customBsPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }, [customBsPoints]);

  const gpsPathData = useMemo(() => {
    if (gpsCanvasPoints.length < 2) return '';
    return (
      gpsCanvasPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    );
  }, [gpsCanvasPoints]);

  const drawingPathData = useMemo(() => {
    if (drawingCanvasPoints.length < 2) return '';
    return (
      drawingCanvasPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
      ' Z'
    );
  }, [drawingCanvasPoints]);

  // Save Project
  const handleSaveProject = () => {
    if (!currentMap) return;

    const layersConfig: PentagraphLayerConfig[] = [
      {
        id: 'layer-mouza',
        type: 'mouza_sheet',
        name: currentMap.title,
        nameBn: 'মৌজা নকশা শিট',
        visible: layerMouzaSheet.visible,
        opacity: layerMouzaSheet.opacity,
        color: '#64748b',
        showLabels: false,
        pointsCount: 0,
        areaSqFt: 0,
        areaDecimal: 0,
        perimeterFt: 0,
      },
      {
        id: 'layer-dag',
        type: 'digitized_dag',
        name: `দাগ নং ${selectedDag?.dagNo || 'N/A'}`,
        nameBn: 'ডিজিটাইজড দাগ সীমানা',
        visible: layerDigitizedDag.visible,
        opacity: layerDigitizedDag.opacity,
        color: '#10b981',
        showLabels: layerDigitizedDag.showLabels,
        pointsCount: customDagPoints.length || dagPoints.length,
        areaSqFt: selectedDag?.areaSqFt || 0,
        areaDecimal: selectedDag?.areaDecimal || 0,
        perimeterFt: selectedDag?.perimeterFt || 0,
      },
      {
        id: 'layer-gps',
        type: 'gps_survey',
        name: activeGpsSurvey ? activeGpsSurvey.title : 'সক্রিয় GPS ফিল্ড সীমানা',
        nameBn: 'বাস্তব GPS ফিল্ড সীমানা',
        visible: layerGpsSurvey.visible,
        opacity: layerGpsSurvey.opacity,
        color: '#06b6d4',
        showLabels: layerGpsSurvey.showLabels,
        pointsCount: gpsCanvasPoints.length,
        areaSqFt: gpsAreaSqFt,
        areaDecimal: metrics.gpsAreaDecimal,
        perimeterFt: gpsPerimeterFt,
      },
      {
        id: 'layer-drawing',
        type: 'saved_drawing',
        name: activeDrawingSurvey ? activeDrawingSurvey.title : 'সংরক্ষিত ডিজিটাল ড্রয়িং',
        nameBn: 'সংরক্ষিত ডিজিটাল ড্রয়িং',
        visible: layerSavedDrawing.visible,
        opacity: layerSavedDrawing.opacity,
        color: '#f59e0b',
        showLabels: layerSavedDrawing.showLabels,
        pointsCount: drawingCanvasPoints.length,
        areaSqFt: activeDrawingSurvey ? activeDrawingSurvey.areaSqFt : 0,
        areaDecimal: metrics.drawingAreaDecimal || 0,
        perimeterFt: activeDrawingSurvey ? activeDrawingSurvey.perimeterFt : 0,
      },
    ];

    const editedGeometries: Record<string, LayerEditedGeometry> = {};

    if (customDagPoints.length > 0) {
      editedGeometries['layer-dag'] = {
        layerId: 'layer-dag',
        points: customDagPoints,
        originalPoints: originalDagPoints,
        isEdited: arePointsDifferent(customDagPoints, originalDagPoints),
        updatedAt: Date.now(),
      };
    }

    if (customCsPoints.length > 0) {
      editedGeometries['layer-cs'] = {
        layerId: 'layer-cs',
        points: customCsPoints,
        originalPoints: originalCsPoints,
        isEdited: arePointsDifferent(customCsPoints, originalCsPoints),
        updatedAt: Date.now(),
      };
    }

    if (customBsPoints.length > 0) {
      editedGeometries['layer-bs'] = {
        layerId: 'layer-bs',
        points: customBsPoints,
        originalPoints: originalBsPoints,
        isEdited: arePointsDifferent(customBsPoints, originalBsPoints),
        updatedAt: Date.now(),
      };
    }

    const project: ComparativePentagraphProject = {
      id: `penta-${Date.now()}`,
      title: projectTitle.trim() || 'পেন্টাগ্রাফ তুলনা প্রকল্প',
      mouzaMapId: currentMap.id,
      dagId: selectedDag?.id,
      surveyId: activeGpsSurvey?.id,
      bookingId: activeGpsSurvey?.bookingId || undefined,
      customerId: activeGpsSurvey?.customerId || undefined,
      aminId: activeGpsSurvey?.aminId || (currentUser?.role === 'amin' ? currentUser.id : undefined),
      ownerId: currentUser?.id,
      status: 'active',
      csFileId: selectedCsFile?.id,
      csFileName: selectedCsFile?.name,
      bsFileId: selectedBsFile?.id,
      bsFileName: selectedBsFile?.name,
      layers: layersConfig,
      metrics,
      editedGeometries,
      demarcationSurveyedPoints: surveyedPoints,
      demarcationReferencePoints: customDagPoints,
      clientName,
      khatianNo,
      unit,
      notes: demarcationNotes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    savePentagraphProject(project);
    setSavedProjects(getStoredPentagraphProjects());

    setNotificationMsg(
      isBn
        ? 'দখল সীমানা ও তুলনামূলক পেন্টাগ্রাফ প্রকল্প সফলভাবে সংরক্ষিত হয়েছে!'
        : 'Demarcation and pentagraph project saved successfully!'
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Load previously saved Pentagraph project
  const handleLoadSavedProject = (projectId: string) => {
    if (!projectId) return;
    const p = savedProjects.find((x) => x.id === projectId);
    if (!p) return;

    if (p.title) setProjectTitle(p.title);
    if (p.dagId && onSelectDag) onSelectDag(p.dagId);

    // Restore selected CS and BS files
    const allFiles = getStoredMapFiles();
    if (p.csFileId || p.csFileName) {
      const foundCs = allFiles.find((f) => f.id === p.csFileId || f.name === p.csFileName);
      if (foundCs) setSelectedCsFile(foundCs);
    }
    if (p.bsFileId || p.bsFileName) {
      const foundBs = allFiles.find((f) => f.id === p.bsFileId || f.name === p.bsFileName);
      if (foundBs) setSelectedBsFile(foundBs);
    }

    // Restore demarcation specific fields
    if (p.demarcationSurveyedPoints && p.demarcationSurveyedPoints.length > 0) {
      setSurveyedPoints(p.demarcationSurveyedPoints);
      if (onOpenProject) {
        onOpenProject(p);
      }
    }
    if (p.demarcationReferencePoints && p.demarcationReferencePoints.length > 0) {
      setCustomDagPoints(p.demarcationReferencePoints);
    }
    if (p.clientName) setClientName(p.clientName);
    if (p.khatianNo) setKhatianNo(p.khatianNo);
    if (p.unit) setUnit(p.unit);
    if (p.notes) setDemarcationNotes(p.notes);
    
    // Lock if finalized
    if (p.status === 'finalized') {
      setIsVertexEditMode(false);
      setNotificationMsg(isBn ? 'এই প্রজেক্টটি চূড়ান্ত করা হয়েছে, আর এডিট করা যাবে না।' : 'This project is finalized and cannot be edited.');
    }

    // Restore edited geometries
    if (p.editedGeometries?.['layer-dag']) {
      setCustomDagPoints(p.editedGeometries['layer-dag'].points);
      setOriginalDagPoints(
        p.editedGeometries['layer-dag'].originalPoints || p.editedGeometries['layer-dag'].points
      );
    }
    if (p.editedGeometries?.['layer-cs']) {
      setCustomCsPoints(p.editedGeometries['layer-cs'].points);
      setOriginalCsPoints(
        p.editedGeometries['layer-cs'].originalPoints || p.editedGeometries['layer-cs'].points
      );
    }
    if (p.editedGeometries?.['layer-bs']) {
      setCustomBsPoints(p.editedGeometries['layer-bs'].points);
      setOriginalBsPoints(
        p.editedGeometries['layer-bs'].originalPoints || p.editedGeometries['layer-bs'].points
      );
    }

    setNotificationMsg(
      isBn
        ? `সংরক্ষিত প্রকল্প "${p.title}" এবং দখল সীমানা ডেটা লোড করা হয়েছে!`
        : `Project "${p.title}" and demarcation data restored!`
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Copy Comparative Summary
  const handleCopySummary = () => {
    const text = isBn
      ? `ভূমি ও আমিন — তুলনামূলক পেন্টাগ্রাফ সারসংক্ষেপ
========================================
মৌজা: ${currentMap?.mouza || '—'} (জে.এল. ${currentMap?.jlNo || '—'})
দাগ নম্বর: ${selectedDag?.dagNo || '—'}
----------------------------------------
১. মৌজা ডিজিটাইজড দাগ:
   • ক্ষেত্রফল: ${metrics.mapAreaDecimal} শতাংশ (${metrics.mapAreaSqFt} বর্গফুট)
   • পরিসীমা: ${metrics.perimeterMapFt} ফুট
   • শীর্ষবিন্দু: ${dagPoints.length}টি

২. বাস্তব GPS ফিল্ড সার্ভে:
   • ক্ষেত্রফল: ${metrics.gpsAreaDecimal} শতাংশ (${metrics.gpsAreaSqFt} বর্গফুট)
   • পরিসীমা: ${metrics.perimeterGpsFt} ফুট
   • শীর্ষবিন্দু: ${gpsCanvasPoints.length}টি

৩. তুলনামূলক ব্যবধান ও বিচ্যুতি:
   • ক্ষেত্রফলের পার্থক্য: ${metrics.diffDecimal} শতাংশ (${metrics.diffSqFt} বর্গফুট)
   • শতকরা পার্থক্য: ${metrics.percentageVariance}%
   • সীমানা কেন্দ্র বিচ্যুতি (Offset): ${metrics.centroidDisplacementFt || 0} ফুট (${metrics.displacementDirectionBn || '—'})
   • গ্রহণযোগ্যতার গ্রেড: ${
        metrics.matchGrade === 'excellent'
          ? 'চমৎকার মিল (Excellent Match)'
          : metrics.matchGrade === 'acceptable'
          ? 'গ্রহণযোগ্য পার্থক্য (Acceptable)'
          : 'উচ্চ পার্থক্য (High Variance)'
      }

[আইনি সতর্কতা]: ডিজিটাল/নির্দেশক তুলনা — এটি কোনো আদালত বা রাজস্ব কর্তৃপক্ষের চূড়ান্ত আইনি সীমানা প্রমাণ নয়।`
      : `Bhumi O Amin — Comparative Pentagraph Summary
========================================
Mouza: ${currentMap?.mouza || '—'} (JL ${currentMap?.jlNo || '—'})
Dag No: ${selectedDag?.dagNo || '—'}
----------------------------------------
1. Map Digitized Dag:
   • Area: ${metrics.mapAreaDecimal} Decimal (${metrics.mapAreaSqFt} sq ft)
   • Perimeter: ${metrics.perimeterMapFt} ft
   • Vertices: ${dagPoints.length} pts

2. Real GPS Field Survey:
   • Area: ${metrics.gpsAreaDecimal} Decimal (${metrics.gpsAreaSqFt} sq ft)
   • Perimeter: ${metrics.perimeterGpsFt} ft
   • Vertices: ${gpsCanvasPoints.length} pts

3. Comparative Variance & Offset:
   • Area Difference: ${metrics.diffDecimal} Decimal (${metrics.diffSqFt} sq ft)
   • Variance: ${metrics.percentageVariance}%
   • Centroid Offset: ${metrics.centroidDisplacementFt || 0} ft (${metrics.displacementDirectionEn || '—'})
   • Status: ${
        metrics.matchGrade === 'excellent'
          ? 'Excellent Match'
          : metrics.matchGrade === 'acceptable'
          ? 'Acceptable'
          : 'High Variance'
      }

[LEGAL NOTICE]: DIGITAL / INDICATIVE COMPARISON — Not conclusive boundary evidence.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Canvas Click (for adding vertices in point/line mode)
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mouseMovedRef.current || isDragging || isDraggingSurveyPoint !== null) return;
    if (activeTool !== 'point' && activeTool !== 'line') return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = Math.round((clickX - pan.x) / zoom);
    const worldY = Math.round((clickY - pan.y) / zoom);

    pushDemarcationUndo();
    const newPt: DigitizedDagPoint = {
      id: `surv-pt-${Date.now()}`,
      x: worldX,
      y: worldY,
      label: `S${surveyedPoints.length + 1}`,
      sourceType: 'manual',
    };
    setSurveyedPoints((prev) => [...prev, newPt]);
    setSelectedSurveyedPointIndex(surveyedPoints.length);
  };

  // Prepared Data for Digital Demarcation PDF Report Modal
  const [activeReportData, setActiveReportData] = useState<DemarcationReportData | null>(null);

  const reportData: DemarcationReportData = useMemo(() => {
    if (activeReportData) return activeReportData;
    return {
      projectTitle:
        projectTitle.trim() ||
        (isBn ? 'দখল ও সীমানা নির্ধারণ তুলনামূলক প্রতিবেদন' : 'Boundary Demarcation Report'),
      clientName: clientName.trim() || undefined,
      mouzaName: currentMap?.mouza || '',
      district: currentMap?.district || '',
      upazila: currentMap?.upazila || '',
      jlNo: currentMap?.jlNo || '',
      sheetNo: currentMap?.sheetNo || '',
      dagNo: selectedDag?.dagNo || 'সার্ভে দাগ',
      khatianNo: khatianNo.trim() || undefined,
      date: new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-US'),
      scaleText: currentMap?.scaleRatio || '১৬ ইঞ্চি = ১ মাইল',
      referenceBoundary: {
        title: isBn
          ? `মৌজা নকশা দাগ নং ${selectedDag?.dagNo || ''}`
          : `Mouza Dag #${selectedDag?.dagNo || ''}`,
        pointsCount: activeRefPoints.length,
        perimeterFt: activeRefMetrics.perimeterFt,
        areaDecimal: activeRefMetrics.areaDecimal,
        areaSqFt: activeRefMetrics.areaSqFt,
      },
      surveyedBoundary: {
        title: isBn ? 'মাঠ দখল / জরিপ সীমানা' : 'Surveyed / Occupied Boundary',
        pointsCount: surveyedPoints.length,
        perimeterFt: surveyedMetrics.perimeterFt,
        areaDecimal: surveyedMetrics.areaDecimal,
        areaSqFt: surveyedMetrics.areaSqFt,
      },
      comparison: {
        areaDifferenceDecimal: demarcationVariance.areaDiffDecimal,
        areaDifferenceSqFt: demarcationVariance.areaDiffSqFt,
        perimeterDifferenceFt: demarcationVariance.perimDiffFt,
        areaChangePercent: demarcationVariance.pctVariance,
        offsetFt: demarcationVariance.centroidOffsetFt,
      },
      referencePoints: activeRefPoints.map((p) => ({ x: p.x, y: p.y })),
      surveyedPoints: surveyedPoints.map((p) => ({ x: p.x, y: p.y })),
      notes: demarcationNotes,
      aminName: aminName,
      unit: unit,
    };
  }, [
    projectTitle,
    clientName,
    currentMap,
    selectedDag,
    khatianNo,
    isBn,
    activeRefPoints,
    activeRefMetrics,
    surveyedPoints,
    surveyedMetrics,
    demarcationVariance,
    demarcationNotes,
    aminName,
    unit,
  ]);

  const renderSheetPreview = (
    label: string,
    file: UploadedMapFile | null,
    imageUrl: string | undefined,
    accentClass: string
  ) => {
    const isPreviewableImage = file?.fileType === 'image' && Boolean(imageUrl);
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className={`px-3 py-2 flex items-center justify-between gap-2 ${accentClass}`}>
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-wide">{label}</div>
            <div className="text-xs font-bold truncate" title={file?.name || ''}>
              {file?.name || (isBn ? 'কোনো নকশা নির্বাচিত নেই' : 'No map selected')}
            </div>
          </div>
          {file && (
            <button type="button" onClick={() => openPdfViewer(file, 'canvas')} className="shrink-0 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-[10px] font-bold text-slate-700">
              {isBn ? 'দেখুন' : 'View'}
            </button>
          )}
        </div>
        <div className="h-40 sm:h-48 bg-slate-50">
          {isPreviewableImage ? (
            <svg viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
              <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="#f8fafc" />
              <image href={imageUrl} x="0" y="0" width={dimensions.width} height={dimensions.height} preserveAspectRatio="xMidYMid meet" />
              {dagPathData && <path d={dagPathData} fill="#10b981" fillOpacity="0.16" stroke="#059669" strokeWidth="2.5" />}
              {dagSearchHighlight && dagPathData && <path d={dagPathData} fill="none" stroke="#facc15" strokeWidth="7" strokeDasharray="10 5" />}
              {selectedDag && dagPathData && <text x={dagCentroid.x} y={dagCentroid.y} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">{isBn ? `দাগ ${selectedDag.dagNo}` : `Dag ${selectedDag.dagNo}`}</text>}
            </svg>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-1 px-4 text-center text-[11px] text-slate-500">
              <span>{file ? (isBn ? 'এই ফাইলের জন্য আলাদা প্রিভিউ নেই' : 'Preview unavailable for this file type') : (isBn ? 'নকশা নির্বাচন করলে এখানে দেখা যাবে' : 'Select a map to preview here')}</span>
              {file?.fileType === 'pdf' && <span className="font-semibold">{isBn ? '“দেখুন” চাপলে PDF খুলবে' : 'Tap View to open the PDF'}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Sub-view returns are kept after all hooks so navigation never changes hook order.
  if (subView === 'pdf_viewer' && activeViewerFile) {
    return (
      <PentagraphPdfViewer
        file={activeViewerFile}
        lang={lang}
        onBack={handleBackFromViewer}
        onSelectAsCs={handleSelectAsCs}
        onSelectAsBs={handleSelectAsBs}
      />
    );
  }

  if (subView === 'files_library') {
    return (
      <PentagraphFileLibraryModal
        lang={lang}
        onBack={handleBackFromLibrary}
        selectedCsFile={selectedCsFile}
        selectedBsFile={selectedBsFile}
        onSelectCsFile={handleSelectAsCs}
        onSelectBsFile={handleSelectAsBs}
        onRemoveCsFile={() => setSelectedCsFile(null)}
        onRemoveBsFile={() => setSelectedBsFile(null)}
        onViewFile={(file) => openPdfViewer(file, 'files_library')}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header with Title & Legal Clarification */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {isBn ? 'দখল/সীমানা নির্ধারণ ও তুলনামূলক পেন্টাগ্রাফ' : 'Demarcation & Comparative Pentagraph'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Phase 20J.3
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'মৌজা নকশার রেফারেন্স সীমানা ও দখল/মাঠ জরিপ সীমানার ডিজিটাল তুলনা ও পরিমাপ — আমিন কর্তৃক যাচাইযোগ্য'
                  : 'Digital boundary demarcation & comparative pentagraph analysis — Surveyor verifiable'}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              title={isBn ? 'ডিজিটাল তুলনামূলক ও পরিমাপ প্রতিবেদন প্রিন্ট / PDF' : 'PDF Demarcation Report'}
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'PDF রিপোর্ট' : 'PDF Report'}</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isBn ? 'অনুলিপি হয়েছে' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isBn ? 'সারসংক্ষেপ কপি' : 'Copy Summary'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'প্রকল্প সংরক্ষণ' : 'Save Project'}</span>
            </button>
          </div>
        </div>

        {/* Professional Service Disclaimer & Legal Assurance */}
        <ProfessionalServiceDisclaimer lang={lang} variant="compact" collapsible={true} />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Cadastral Map Sheets Selection (CS & BS Maps) */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {isBn ? 'মৌজা নকশা শিট নির্বাচন (CS ও BS ম্যাপ)' : 'Cadastral Map Sheet Selection (CS & BS Map)'}
              </h4>
              <p className="text-[10px] text-slate-500">
                {isBn
                  ? 'সিএস ও বিএস মৌজা নকশার নির্ভরযোগ্য স্থায়ী ফাইল নির্বাচন ও তুলনামূলক ওভারলে'
                  : 'Reliable persistent CS & BS cadastral map sheet selection & overlay'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCatalogModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>{isBn ? 'নকশা ক্যাটালগ' : 'Map Catalog'}</span>
            </button>

            <button
              onClick={openFilesLibrary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-800" />
              <span>{isBn ? 'আপলোড করা ফাইল' : 'Uploaded Files'}</span>
            </button>

            <button
              onClick={openFilesLibrary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'ফাইল আপলোড করুন' : 'Upload File'}</span>
            </button>
          </div>
        </div>

        {/* CS and BS Selected Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* CS Map Card */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                  {isBn ? 'CS ম্যাপ:' : 'CS Map:'}
                </span>
                <h5 className="text-xs font-bold text-slate-900 truncate max-w-[240px]" title={selectedCsFile?.name}>
                  {selectedCsFile ? selectedCsFile.name : isBn ? '— কোনো CS নকশা নির্বাচিত নেই —' : '— No CS Map Selected —'}
                </h5>
                {selectedCsFile && (
                  <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                    {selectedCsFile.sizeFormatted} | {selectedCsFile.fileType.toUpperCase()}
                  </span>
                )}
              </div>

              {selectedCsFile && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/90 text-amber-900 shrink-0">
                  CS Sheet
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-xs font-bold">
              {selectedCsFile ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openPdfViewer(selectedCsFile, 'canvas')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition cursor-pointer"
                    >
                      {isBn ? 'দেখুন' : 'View'}
                    </button>
                    <button
                      onClick={openFilesLibrary}
                      className="px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-900 hover:bg-amber-200 transition cursor-pointer"
                    >
                      {isBn ? 'পরিবর্তন করুন' : 'Change'}
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedCsFile(null)}
                    className="text-[11px] text-slate-500 hover:text-rose-600 transition cursor-pointer"
                  >
                    {isBn ? 'মুছে ফেলুন' : 'Remove'}
                  </button>
                </>
              ) : (
                <button
                  onClick={openFilesLibrary}
                  className="w-full py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition text-center cursor-pointer"
                >
                  {isBn ? 'ফাইল নির্বাচন করুন' : 'Select CS File'}
                </button>
              )}
            </div>
          </div>

          {/* BS Map Card */}
          <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200/80 flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-800 block">
                  {isBn ? 'BS ম্যাপ:' : 'BS Map:'}
                </span>
                <h5 className="text-xs font-bold text-slate-900 truncate max-w-[240px]" title={selectedBsFile?.name}>
                  {selectedBsFile ? selectedBsFile.name : isBn ? '— কোনো BS নকশা নির্বাচিত নেই —' : '— No BS Map Selected —'}
                </h5>
                {selectedBsFile && (
                  <span className="text-[10px] text-cyan-700 font-semibold block mt-0.5">
                    {selectedBsFile.sizeFormatted} | {selectedBsFile.fileType.toUpperCase()}
                  </span>
                )}
              </div>

              {selectedBsFile && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-200/90 text-cyan-900 shrink-0">
                  BS Sheet
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-cyan-200/60 text-xs font-bold">
              {selectedBsFile ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openPdfViewer(selectedBsFile, 'canvas')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-100 transition cursor-pointer"
                    >
                      {isBn ? 'দেখুন' : 'View'}
                    </button>
                    <button
                      onClick={openFilesLibrary}
                      className="px-2.5 py-1 rounded-lg bg-cyan-100/90 text-cyan-900 hover:bg-cyan-200 transition cursor-pointer"
                    >
                      {isBn ? 'পরিবর্তন করুন' : 'Change'}
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedBsFile(null)}
                    className="text-[11px] text-slate-500 hover:text-rose-600 transition cursor-pointer"
                  >
                    {isBn ? 'মুছে ফেলুন' : 'Remove'}
                  </button>
                </>
              ) : (
                <button
                  onClick={openFilesLibrary}
                  className="w-full py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 text-xs font-bold transition text-center cursor-pointer"
                >
                  {isBn ? 'ফাইল নির্বাচন করুন' : 'Select BS File'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* B: Clean CS ↔ BS overlay controls and side-by-side compare */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-900">{isBn ? 'CS ↔ BS নকশা তুলনা' : 'CS ↔ BS Map Compare'}</h4>
              <p className="text-[10px] text-slate-500">{isBn ? 'ওভারলে স্বচ্ছতা বদলান, অথবা দুটি নকশা পাশাপাশি দেখুন।' : 'Adjust overlay opacity or view both maps side-by-side.'}</p>
            </div>
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto">
              <button type="button" onClick={() => setCsBsViewMode('overlay')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${csBsViewMode === 'overlay' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'}`}>
                {isBn ? 'ওভারলে' : 'Overlay'}
              </button>
              <button type="button" onClick={() => setCsBsViewMode('side-by-side')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${csBsViewMode === 'side-by-side' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'}`}>
                {isBn ? 'পাশাপাশি' : 'Side by side'}
              </button>
            </div>
          </div>

          {csBsViewMode === 'overlay' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><div className="text-[10px] font-extrabold text-amber-800">CS MAP</div><div className="text-xs font-bold text-slate-800 truncate">{selectedCsFile?.name || (isBn ? 'CS নকশা নেই' : 'No CS map selected')}</div></div>
                  <button type="button" onClick={() => setCsOverlayVisible((visible) => !visible)} disabled={!selectedCsFile || selectedCsFile.fileType !== 'image'} aria-label={isBn ? 'CS ওভারলে দেখান বা লুকান' : 'Toggle CS overlay'} className="shrink-0 p-1.5 rounded-lg bg-white border border-amber-200 text-amber-800 disabled:opacity-40">
                    {csOverlayVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2"><span className="w-10 text-[10px] font-bold text-amber-900">{Math.round(csOverlayOpacity * 100)}%</span><input type="range" min="0" max="1" step="0.01" value={csOverlayOpacity} disabled={!resolvedCsBgUrl || selectedCsFile?.fileType !== 'image'} onChange={(e) => setCsOverlayOpacity(Number(e.target.value))} aria-label={isBn ? 'CS ওভারলে opacity' : 'CS overlay opacity'} className="w-full accent-amber-600" /></div>
              </div>
              <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><div className="text-[10px] font-extrabold text-cyan-800">BS MAP</div><div className="text-xs font-bold text-slate-800 truncate">{selectedBsFile?.name || (isBn ? 'BS নকশা নেই' : 'No BS map selected')}</div></div>
                  <button type="button" onClick={() => setBsOverlayVisible((visible) => !visible)} disabled={!selectedBsFile || selectedBsFile.fileType !== 'image'} aria-label={isBn ? 'BS ওভারলে দেখান বা লুকান' : 'Toggle BS overlay'} className="shrink-0 p-1.5 rounded-lg bg-white border border-cyan-200 text-cyan-800 disabled:opacity-40">
                    {bsOverlayVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2"><span className="w-10 text-[10px] font-bold text-cyan-900">{Math.round(bsOverlayOpacity * 100)}%</span><input type="range" min="0" max="1" step="0.01" value={bsOverlayOpacity} disabled={!resolvedBsBgUrl || selectedBsFile?.fileType !== 'image'} onChange={(e) => setBsOverlayOpacity(Number(e.target.value))} aria-label={isBn ? 'BS ওভারলে opacity' : 'BS overlay opacity'} className="w-full accent-cyan-600" /></div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderSheetPreview(isBn ? 'সি.এস. নকশা' : 'CS Map', selectedCsFile, resolvedCsBgUrl, 'bg-amber-50 text-amber-900')}
              {renderSheetPreview(isBn ? 'বি.এস. নকশা' : 'BS Map', selectedBsFile, resolvedBsBgUrl, 'bg-cyan-50 text-cyan-900')}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-[10px] text-slate-600">{selectedDag ? (isBn ? `দাগ ${selectedDag.dagNo} নির্বাচিত — এর ডিজিটাইজড সীমানা বেসলাইন হিসেবে যাবে (স্ক্যান ছবি নয়)` : `Dag ${selectedDag.dagNo} selected — its digitized boundary will be sent as the baseline (not the scanned image).`) : (isBn ? 'দখল সীমায় বসাতে আগে একটি দাগ নির্বাচন করুন।' : 'Select a dag before sending it to the demarcation canvas.')}</div>
            <button type="button" onClick={handleConfirmOverlayToDemarcation} disabled={!selectedDag || selectedDag.points.length < 3} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isBn ? 'ওভারলে নিশ্চিত → দখল সীমানায় বসান' : 'Confirm → Send to demarcation'}</span>
            </button>
          </div>
        </div>

        {/* Saved Projects Restore Bar */}
        {savedProjects.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">
                {isBn ? 'সংরক্ষিত পেন্টাগ্রাফ প্রকল্প:' : 'Saved Pentagraph Projects:'}
              </span>
              <select
                value={selectedProjectIdToLoad}
                onChange={(e) => {
                  setSelectedProjectIdToLoad(e.target.value);
                  handleLoadSavedProject(e.target.value);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 text-xs"
              >
                <option value="">{isBn ? '— প্রকল্প নির্বাচন করুন —' : '— Select Project —'}</option>
                {savedProjects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.title} ({new Date(proj.updatedAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')})
                  </option>
                ))}
              </select>
              {selectedProjectIdToLoad && (
                <button
                  onClick={() => {
                    const p = savedProjects.find(x => x.id === selectedProjectIdToLoad);
                    if (p) {
                      // Map project to DemarcationReportData
                      const mappedData: DemarcationReportData = {
                        projectTitle: p.title,
                        clientName: p.clientName,
                        mouzaName: currentMap?.mouza || '',
                        dagNo: selectedDag?.dagNo || '—',
                        date: new Date(p.updatedAt).toLocaleDateString(),
                        referenceBoundary: {
                          title: isBn ? 'রেফারেন্স সীমানা' : 'Reference Boundary',
                          pointsCount: p.demarcationReferencePoints?.length || 0,
                          perimeterFt: p.metrics.perimeterMapFt,
                          areaDecimal: p.metrics.mapAreaDecimal,
                          areaSqFt: p.metrics.mapAreaSqFt,
                        },
                        surveyedBoundary: {
                          title: isBn ? 'দখল/জরিপ সীমানা' : 'Surveyed Boundary',
                          pointsCount: p.demarcationSurveyedPoints?.length || 0,
                          perimeterFt: p.metrics.perimeterGpsFt,
                          areaDecimal: p.metrics.gpsAreaDecimal,
                          areaSqFt: p.metrics.gpsAreaSqFt,
                        },
                        comparison: {
                          areaDifferenceDecimal: p.metrics.diffDecimal,
                          areaDifferenceSqFt: p.metrics.diffSqFt,
                          perimeterDifferenceFt: p.metrics.perimeterDiffFt,
                          areaChangePercent: p.metrics.percentageVariance,
                          offsetFt: p.metrics.centroidDisplacementFt,
                        },
                        referencePoints: p.demarcationReferencePoints || [],
                        surveyedPoints: p.demarcationSurveyedPoints || [],
                        unit: p.unit || 'feet',
                      };
                      setActiveReportData(mappedData);
                      setIsReportModalOpen(true);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800"
                >
                  {isBn ? 'রিপোর্ট দেখুন' : 'View Report'}
                </button>
              )}
              {selectedProjectIdToLoad && savedProjects.find(p => p.id === selectedProjectIdToLoad)?.status !== 'finalized' && (
                <button
                  onClick={() => {
                    if (window.confirm(isBn ? 'এই প্রজেক্ট চূড়ান্ত করলে আর এডিট করা যাবে না। নিশ্চিত?' : 'Finalizing project will disable editing. Confirm?')) {
                      finalizePentagraphProject(selectedProjectIdToLoad);
                      setNotificationMsg(isBn ? 'প্রজেক্ট চূড়ান্ত করা হয়েছে।' : 'Project finalized.');
                      setTimeout(() => setNotificationMsg(null), 3000);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700"
                >
                  {isBn ? 'চূড়ান্ত করুন' : 'Finalize'}
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-400">
              {isBn
                ? 'প্রকল্প নির্বাচন করলে সংশ্লিষ্ট CS ও BS নকশা স্বয়ংক্রিয়ভাবে যুক্ত হবে'
                : 'Selecting a project restores linked CS & BS maps'}
            </span>
          </div>
        )}
      </div>

      {notificationMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. Top Controls: Source Selection */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {/* Comparison Mode Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {isBn ? 'তুলনা মোড:' : 'Comparison Mode:'}
          </label>
          <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setComparisonMode('dag-gps')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${comparisonMode === 'dag-gps' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'}`}
            >
              {isBn ? 'দাগ ↔ GPS' : 'DAG ↔ GPS'}
            </button>
            <button
              onClick={() => setComparisonMode('field-gps')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${comparisonMode === 'field-gps' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600'}`}
            >
              {isBn ? 'ফিল্ড ↔ GPS' : 'Field ↔ GPS'}
            </button>
          </div>
        </div>
        
        {/* B: Searchable Dag selector — selection auto-zooms and highlights */}
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {isBn ? '১. দাগ খুঁজুন:' : '1. Search Dag:'}
          </label>
          <input
            type="search"
            value={dagSearchQuery}
            onFocus={() => setIsDagSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setIsDagSearchOpen(false), 180)}
            onChange={(e) => { setDagSearchQuery(e.target.value); setIsDagSearchOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dagSearchMatches[0]) { e.preventDefault(); handleSelectDagSearch(dagSearchMatches[0]); }
              if (e.key === 'Escape') setIsDagSearchOpen(false);
            }}
            placeholder={isBn ? 'দাগ নম্বর লিখে খুঁজুন' : 'Type a dag number'}
            aria-label={isBn ? 'দাগ নম্বর খুঁজুন' : 'Search dag number'}
            aria-expanded={isDagSearchOpen}
            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
          />
          {isDagSearchOpen && (
            <div className="absolute z-40 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {dagSearchMatches.length > 0 ? dagSearchMatches.map((dag) => (
                <button
                  key={dag.id}
                  type="button"
                  onClick={() => handleSelectDagSearch(dag)}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-emerald-50 border-b border-slate-100 last:border-0 ${selectedDag?.id === dag.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'}`}
                >
                  <span className="font-bold">{isBn ? 'দাগ নং ' : 'Dag '}{dag.dagNo}</span>
                  <span className="ml-2 text-slate-500">({formatNumberByLang(dag.areaDecimal, lang)} {isBn ? 'শতক' : 'dec' })</span>
                </button>
              )) : (
                <div className="px-3 py-2 text-xs text-slate-500">{isBn ? 'কোনো দাগ মেলেনি' : 'No matching dag'}</div>
              )}
            </div>
          )}
          {selectedDag && <div className="mt-1 text-[10px] font-semibold text-emerald-800">{isBn ? `নির্বাচিত: দাগ ${selectedDag.dagNo} • ট্যাপে জুম` : `Selected: Dag ${selectedDag.dagNo} • tap to zoom`}</div>}
        </div>

        {/* GPS Survey Source */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {isBn ? '২. GPS ফিল্ড সার্ভে নির্বাচন:' : '2. Real GPS Field Survey:'}
          </label>
          <select
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-cyan-700"
          >
            <option value="active_gps">
              {isBn ? `সক্রিয় GPS (${activeGpsPoints.length} পয়েন্ট)` : `Active GPS (${activeGpsPoints.length} pts)`}
            </option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.dagNo ? `দাগ ${s.dagNo}` : ''})
              </option>
            ))}
          </select>
        </div>

        {/* Saved Drawing / CAD Layer */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {isBn ? '৩. সংরক্ষিত ড্রয়িং / ২য় সার্ভে (ঐচ্ছিক):' : '3. CAD Drawing Layer (Optional):'}
          </label>
          <select
            value={selectedDrawingId}
            onChange={(e) => setSelectedDrawingId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-700"
          >
            <option value="">{isBn ? '— কোনো ড্রয়িং নির্বাচন নেই —' : '— None —'}</option>
            {surveys
              .filter((s) => s.id !== selectedSurveyId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Pentagraph Interactive Canvas + Layer Controls */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Left 3 cols: Canvas Stage */}
        <div className="lg:col-span-3 space-y-2">
          {/* =================================================================== */}
          {/* ESSENTIAL DEMARCATION & PENTAGRAPH TOOLBAR (PHASE 20J.3) */}
          {/* =================================================================== */}
          <div className="p-2 sm:p-2.5 rounded-2xl bg-white border border-slate-200/95 shadow-xs space-y-2">
            {/* Top Row: Primary Mode Buttons (Scrollable on mobile) */}
            <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {/* Tool Group 1: Modes (Select, Point, Move, Line, Distance, Area, Note) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* 1. নির্বাচন (Select) */}
                <button
                  type="button"
                  onClick={() => setActiveTool('select')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    activeTool === 'select'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={isBn ? 'নির্বাচন ও নিরীক্ষা' : 'Select & Inspect'}
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>{isBn ? 'নির্বাচন' : 'Select'}</span>
                </button>

                {/* 2. Point (পয়েন্ট যোগ) */}
                <button
                  type="button"
                  onClick={() => setActiveTool('point')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    activeTool === 'point'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={isBn ? 'নকশায় নতুন পয়েন্ট যোগ করুন' : 'Add Point'}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'পয়েন্ট' : 'Point'}</span>
                </button>

                {/* 3. Move (মুভ / প্যান) */}
                <button
                  type="button"
                  onClick={() => setActiveTool('move')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    activeTool === 'move'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={isBn ? 'ম্যাপ প্যান বা পয়েন্ট ড্র্যাগ করুন' : 'Move / Pan'}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>{isBn ? 'মুভ' : 'Move'}</span>
                </button>

                {/* 4. Line/Boundary (সীমানা অঙ্কন) */}
                <button
                  type="button"
                  onClick={() => setActiveTool('line')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    activeTool === 'line'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={isBn ? 'দখল / মাঠ জরিপ সীমানা আঁকুন' : 'Line / Boundary'}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{isBn ? 'সীমানা' : 'Boundary'}</span>
                </button>

                {/* 5. Distance (দূরত্ব পরিমাপ) */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('distance');
                    setShowDistances(!showDistances);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    showDistances
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={isBn ? 'প্রতিটি বাহুর দূরত্ব পরিমাপ দেখুন' : 'Show Segment Distances'}
                >
                  <Ruler className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isBn ? 'দূরত্ব' : 'Distance'}</span>
                </button>

                {/* 6. Area (ক্ষেত্রফল পরিমাপ) */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('area');
                    setShowAreaOverlay(!showAreaOverlay);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    showAreaOverlay
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={isBn ? 'ক্ষেত্রফল ও পরিসীমা সারসংক্ষেপ' : 'Area & Perimeter'}
                >
                  <Square className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isBn ? 'ক্ষেত্রফল' : 'Area'}</span>
                </button>

                {/* 7. Text/Note (মন্তব্য) */}
                <button
                  type="button"
                  onClick={() => setShowNoteEditor(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer"
                  title={isBn ? 'আমিন মন্তব্য ও ক্লায়েন্ট তথ্য' : 'Text / Note'}
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isBn ? 'নোট' : 'Note'}</span>
                </button>
              </div>

              {/* Tool Group 2: Actions (Undo, Redo, Zoom+, Zoom-, Fit, Clear, Save, PDF) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* 8. Undo */}
                <button
                  type="button"
                  onClick={handleDemarcationUndo}
                  disabled={demarcationUndoStack.length === 0}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-35 transition cursor-pointer"
                  title={isBn ? 'পূর্বাবস্থায় (Undo)' : 'Undo'}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* 9. Redo */}
                <button
                  type="button"
                  onClick={handleDemarcationRedo}
                  disabled={demarcationRedoStack.length === 0}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-35 transition cursor-pointer"
                  title={isBn ? 'পুনরায় (Redo)' : 'Redo'}
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 mx-0.5" />

                {/* 10. Zoom In */}
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title={isBn ? 'জুম ইন' : 'Zoom In'}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {/* 11. Zoom Out */}
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title={isBn ? 'জুম আউট' : 'Zoom Out'}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                {/* 12. Fit to Screen */}
                <button
                  type="button"
                  onClick={handleFitView}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title={isBn ? 'স্ক্রিনে ফিট' : 'Fit to Screen'}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* 13. Clear */}
                <button
                  type="button"
                  onClick={handleClearComparison}
                  disabled={surveyedPoints.length === 0}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-35 transition cursor-pointer"
                  title={isBn ? 'সীমানা পরিষ্কার' : 'Clear'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 mx-0.5" />

                {/* 14. Save */}
                <button
                  type="button"
                  onClick={handleSaveProject}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs"
                  title={isBn ? 'প্রকল্প সংরক্ষণ' : 'Save'}
                >
                  <Save className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">{isBn ? 'সংরক্ষণ' : 'Save'}</span>
                </button>

                {/* 15. PDF Report */}
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                  title={isBn ? 'ডিজিটাল তুলনামূলক ও সীমানা প্রতিবেদন' : 'PDF Report'}
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isBn ? 'PDF রিপোর্ট' : 'PDF Report'}</span>
                </button>
              </div>
            </div>

            {/* Quick Sub-Bar: Quick Actions & Unit Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold text-[11px]">
                  {isBn ? 'একক:' : 'Unit:'}
                </span>
                <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUnit('feet')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      unit === 'feet'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? 'ফুট' : 'Feet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('link')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      unit === 'link'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? 'লিঙ্ক' : 'Link'}
                  </button>
                </div>

                {/* Clone Reference as Baseline button */}
                <button
                  type="button"
                  onClick={handleCloneReferenceToSurveyed}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition cursor-pointer active:scale-95"
                  title={isBn ? 'মূল দাগের সীমানা দখল সীমানায় কপি করে নিন' : 'Clone reference to surveyed'}
                >
                  <Copy className="w-3 h-3 text-emerald-600" />
                  <span>{isBn ? 'মূল নকশা হতে ক্লোন' : 'Clone Reference'}</span>
                </button>

                {/* Toggle Advanced Vertex Editor */}
                {selectedDag && (
                  <button
                    type="button"
                    onClick={() => setIsVertexEditMode(!isVertexEditMode)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                      isVertexEditMode
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{isVertexEditMode ? (isBn ? 'CS/BS এডিটর (চালু)' : 'CS/BS Edit ON') : (isBn ? 'উন্নত CS/BS এডিটর' : 'Advanced CS/BS')}</span>
                  </button>
                )}
              </div>

              {/* Active Points Counter & Indicator */}
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="font-semibold text-slate-700">
                    {isBn ? 'মূল নকশা: ' : 'Ref: '}
                    <strong>{activeRefPoints.length}</strong> {isBn ? 'পয়েন্ট' : 'pts'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span className="font-semibold text-slate-700">
                    {isBn ? 'মাঠ দখল: ' : 'Surveyed: '}
                    <strong>{surveyedPoints.length}</strong> {isBn ? 'পয়েন্ট' : 'pts'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Vertex Edit Control Toolbar for Pentagraph */}
          {selectedDag && (
            <VertexEditToolbar
              isEditMode={isVertexEditMode}
              onToggleEditMode={() => {
                setIsVertexEditMode(!isVertexEditMode);
                setSelectedPointIndex(null);
              }}
              canUndo={
                selectedEditLayerId === 'layer-cs'
                  ? csUndoStack.length > 0
                  : selectedEditLayerId === 'layer-bs'
                  ? bsUndoStack.length > 0
                  : dagUndoStack.length > 0
              }
              canRedo={
                selectedEditLayerId === 'layer-cs'
                  ? csRedoStack.length > 0
                  : selectedEditLayerId === 'layer-bs'
                  ? bsRedoStack.length > 0
                  : dagRedoStack.length > 0
              }
              onUndo={handleActiveUndo}
              onRedo={handleActiveRedo}
              isSnapEnabled={isSnapEnabled}
              onToggleSnap={() => setIsSnapEnabled(!isSnapEnabled)}
              isEdited={isCurrentLayerEdited}
              onResetToOriginal={handleActiveReset}
              metrics={activeLayerMetrics}
              totalPoints={activePointsForEdit.length}
              lang={lang}
              onSaveEdits={handleSaveProject}
              availableLayers={[
                { id: 'layer-dag', name: 'Mouza Dag (Current)', nameBn: 'মৌজা দাগ (বর্তমান)', color: '#10b981' },
                { id: 'layer-cs', name: 'CS Map Layer', nameBn: 'CS ম্যাপ লেয়ার', color: '#a855f7' },
                { id: 'layer-bs', name: 'BS Map Layer', nameBn: 'BS ম্যাপ লেয়ার', color: '#f97316' },
              ]}
              selectedLayerId={selectedEditLayerId}
              onSelectLayer={(id) => {
                setSelectedEditLayerId(id as any);
                setSelectedPointIndex(null);
              }}
            />
          )}

          {/* Canvas Container */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{ touchAction: 'none' }}
            className="relative w-full h-[450px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner select-none cursor-grab active:cursor-grabbing"
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
              className="w-full h-full block"
              onClick={handleSvgClick}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* 1. LAYER: Mouza Sheet Background */}
                {layerMouzaSheet.visible && (resolvedMouzaBgUrl || currentMap?.fileDataUrl) && (
                  <image
                    href={resolvedMouzaBgUrl || currentMap?.fileDataUrl}
                    x={0}
                    y={0}
                    width={dimensions.width}
                    height={dimensions.height}
                    opacity={layerMouzaSheet.opacity}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}

                {/* B: Independent CS/BS overlay layers with live opacity controls */}
                {csBsViewMode === 'overlay' && csOverlayVisible && selectedCsFile?.fileType === 'image' && resolvedCsBgUrl && (
                  <image
                    href={resolvedCsBgUrl}
                    x={0}
                    y={0}
                    width={dimensions.width}
                    height={dimensions.height}
                    opacity={csOverlayOpacity}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}

                {csBsViewMode === 'overlay' && bsOverlayVisible && selectedBsFile?.fileType === 'image' && resolvedBsBgUrl && (
                  <image
                    href={resolvedBsBgUrl}
                    x={0}
                    y={0}
                    width={dimensions.width}
                    height={dimensions.height}
                    opacity={bsOverlayOpacity}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}

                {/* 2. LAYER: Digitized Dag Polygon (Emerald) */}
                {layerDigitizedDag.visible && dagPathData && (
                  <g>
                    {dagSearchHighlight && <path d={dagPathData} fill="none" stroke="#facc15" strokeWidth={8 / zoom} strokeDasharray={`${10 / zoom} ${5 / zoom}`} opacity={0.95} />}
                    <path
                      d={dagPathData}
                      fill="#10b981"
                      fillOpacity={layerDigitizedDag.opacity * 0.25}
                      stroke="#10b981"
                      strokeWidth={2.5 / zoom}
                    />
                    {/* Vertices (Shown when not in vertex edit mode for this layer) */}
                    {!(isVertexEditMode && selectedEditLayerId === 'layer-dag') &&
                      (customDagPoints.length > 0 ? customDagPoints : dagPoints).map((pt, idx) => (
                        <g key={pt.id || idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={4.5 / zoom}
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth={1.5 / zoom}
                            onMouseEnter={() =>
                              setHoveredVertex({
                                label: `D${idx + 1}`,
                                layer: 'মৌজা দাগ (Digitized Dag)',
                                x: pt.x,
                                y: pt.y,
                              })
                            }
                            onMouseLeave={() => setHoveredVertex(null)}
                            className="cursor-pointer hover:scale-125 transition-transform"
                          />
                          {layerDigitizedDag.showLabels && (
                            <text
                              x={pt.x + 6 / zoom}
                              y={pt.y - 6 / zoom}
                              fill="#34d399"
                              fontSize={11 / zoom}
                              fontWeight="bold"
                              filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))"
                            >
                              D{idx + 1}
                            </text>
                          )}
                        </g>
                      ))}
                  </g>
                )}

                {/* 2.5 LAYER: Digital Demarcation — Surveyed / Occupied Boundary (Amber/Gold) */}
                {surveyedPoints.length > 0 && (
                  <g className="select-none">
                    {/* Surveyed Polygon Surface / Path */}
                    {surveyedPathData && (
                      <path
                        d={surveyedPathData}
                        fill="#f59e0b"
                        fillOpacity={0.22}
                        stroke="#d97706"
                        strokeWidth={2.8 / zoom}
                        strokeDasharray={
                          surveyedPoints.length < 3 ? `${6 / zoom}, ${4 / zoom}` : undefined
                        }
                      />
                    )}

                    {/* Segment distances directly on each line */}
                    {showDistances &&
                      surveyedSegments.map((seg, sIdx) => (
                        <g key={`surv-seg-${sIdx}`}>
                          {/* Segment distance badge */}
                          <g transform={`translate(${seg.midX}, ${seg.midY})`}>
                            <rect
                              x={-24 / zoom}
                              y={-9 / zoom}
                              width={48 / zoom}
                              height={16 / zoom}
                              rx={4 / zoom}
                              fill="#0f172a"
                              fillOpacity={0.9}
                              stroke="#f59e0b"
                              strokeWidth={0.9 / zoom}
                            />
                            <text
                              x={0}
                              y={2.5 / zoom}
                              textAnchor="middle"
                              fill="#fde047"
                              fontSize={9.5 / zoom}
                              fontWeight="bold"
                              fontFamily="sans-serif"
                              pointerEvents="none"
                            >
                              {seg.label}
                            </text>
                          </g>

                          {/* Midpoint '+' handle to add point on segment */}
                          {(activeTool === 'point' || activeTool === 'line') && (
                            <g
                              transform={`translate(${seg.midX}, ${seg.midY - 14 / zoom})`}
                              className="cursor-pointer group"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSurveyPointOnSegment(sIdx, { x: seg.midX, y: seg.midY });
                              }}
                            >
                              <circle cx={0} cy={0} r={14 / zoom} fill="transparent" />
                              <circle
                                cx={0}
                                cy={0}
                                r={5.5 / zoom}
                                fill="#f59e0b"
                                stroke="#ffffff"
                                strokeWidth={1.2 / zoom}
                              />
                              <line
                                x1={-3 / zoom}
                                y1={0}
                                x2={3 / zoom}
                                y2={0}
                                stroke="#ffffff"
                                strokeWidth={1.2 / zoom}
                              />
                              <line
                                x1={0}
                                y1={-3 / zoom}
                                x2={0}
                                y2={3 / zoom}
                                stroke="#ffffff"
                                strokeWidth={1.2 / zoom}
                              />
                            </g>
                          )}
                        </g>
                      ))}

                    {/* Surveyed Polygon Area & Perimeter Centroid Badge */}
                    {showAreaOverlay && surveyedPoints.length >= 3 && (
                      <g transform={`translate(${surveyedCentroid.x}, ${surveyedCentroid.y})`}>
                        <rect
                          x={-68 / zoom}
                          y={-20 / zoom}
                          width={136 / zoom}
                          height={40 / zoom}
                          rx={6 / zoom}
                          fill="#1e293b"
                          fillOpacity={0.92}
                          stroke="#f59e0b"
                          strokeWidth={1.2 / zoom}
                        />
                        <text
                          x={0}
                          y={-5 / zoom}
                          textAnchor="middle"
                          fill="#fef08a"
                          fontSize={10 / zoom}
                          fontWeight="bold"
                        >
                          {isBn ? 'দখল: ' : 'Surveyed: '}
                          {formatNumberByLang(surveyedMetrics.areaDecimal.toString(), isBn ? 'bn' : 'en')}{' '}
                          {isBn ? 'শতক' : 'Dec'}
                        </text>
                        <text
                          x={0}
                          y={8 / zoom}
                          textAnchor="middle"
                          fill="#cbd5e1"
                          fontSize={8.5 / zoom}
                        >
                          {unit === 'feet'
                            ? `${formatNumberByLang(surveyedMetrics.perimeterFt.toString(), isBn ? 'bn' : 'en')} ${isBn ? 'ফুট' : 'ft'}`
                            : `${formatNumberByLang((Math.round((surveyedMetrics.perimeterFt / LAND_CONSTANTS.FEET_PER_LINK) * 10) / 10).toString(), isBn ? 'bn' : 'en')} ${isBn ? 'লিঙ্ক' : 'lk'}`}
                        </text>
                        <text
                          x={0}
                          y={16 / zoom}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize={6.5 / zoom}
                        >
                          {isBn ? 'আনুমানিক ক্ষেত্রফল' : 'Approximate Area'}
                        </text>
                      </g>
                    )}

                    {/* Centroid Offset Line between Reference and Surveyed boundary */}
                    {activeRefPoints.length >= 3 && surveyedPoints.length >= 3 && (
                      <g>
                        <line
                          x1={dagCentroid.x}
                          y1={dagCentroid.y}
                          x2={surveyedCentroid.x}
                          y2={surveyedCentroid.y}
                          stroke="#ef4444"
                          strokeWidth={2 / zoom}
                          strokeDasharray={`${4 / zoom}, ${3 / zoom}`}
                        />
                        <circle
                          cx={surveyedCentroid.x}
                          cy={surveyedCentroid.y}
                          r={4.5 / zoom}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={1.5 / zoom}
                        />
                        <circle
                          cx={dagCentroid.x}
                          cy={dagCentroid.y}
                          r={4.5 / zoom}
                          fill="#10b981"
                          stroke="#ffffff"
                          strokeWidth={1.5 / zoom}
                        />
                        <text
                          x={(dagCentroid.x + surveyedCentroid.x) / 2 + 6 / zoom}
                          y={(dagCentroid.y + surveyedCentroid.y) / 2 - 6 / zoom}
                          fill="#ef4444"
                          fontSize={10 / zoom}
                          fontWeight="bold"
                          filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.9))"
                        >
                          Δ{' '}
                          {unit === 'feet'
                            ? `${demarcationVariance.centroidOffsetFt} ft`
                            : `${demarcationVariance.centroidOffsetLk} lk`}
                        </text>
                      </g>
                    )}

                    {/* Surveyed Vertices */}
                    {surveyedPoints.map((pt, idx) => {
                      const isSelected = selectedSurveyedPointIndex === idx;
                      return (
                        <g
                          key={pt.id || `surv-pt-${idx}`}
                          className="cursor-grab active:cursor-grabbing"
                          style={{ touchAction: 'none' }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setIsDraggingSurveyPoint(idx);
                            setSelectedSurveyedPointIndex(idx);
                          }}
                          onPointerMove={(e) => {
                            if (isDraggingSurveyPoint !== idx) return;
                            e.stopPropagation();
                            const svgEl = e.currentTarget.ownerSVGElement;
                            if (!svgEl) return;
                            const ctm = svgEl.getScreenCTM();
                            if (!ctm) return;
                            const svgPoint = svgEl.createSVGPoint();
                            svgPoint.x = e.clientX;
                            svgPoint.y = e.clientY;
                            const localPt = svgPoint.matrixTransform(ctm.inverse());
                            setSurveyedPoints((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? { ...p, x: Math.round(localPt.x), y: Math.round(localPt.y) }
                                  : p
                              )
                            );
                          }}
                          onPointerUp={(e) => {
                            if (isDraggingSurveyPoint === idx) {
                              e.stopPropagation();
                              try {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                              } catch (err) {}
                              setIsDraggingSurveyPoint(null);
                              pushDemarcationUndo();
                            }
                          }}
                          onPointerCancel={(e) => {
                            if (isDraggingSurveyPoint === idx) {
                              try {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                              } catch (err) {}
                              setIsDraggingSurveyPoint(null);
                              pushDemarcationUndo();
                            }
                          }}
                        >
                          {/* Invisible Large Touch Target */}
                          <circle cx={pt.x} cy={pt.y} r={22 / zoom} fill="transparent" />

                          {/* Outer highlight for selected vertex */}
                          {isSelected && (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={9 / zoom}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth={2 / zoom}
                              className="animate-pulse"
                            />
                          )}

                          {/* Visible Point Marker */}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={6 / zoom}
                            fill={isSelected ? '#ef4444' : '#f59e0b'}
                            stroke="#ffffff"
                            strokeWidth={2 / zoom}
                          />

                          {/* Inner center dot */}
                          <circle cx={pt.x} cy={pt.y} r={2.2 / zoom} fill="#ffffff" />

                          {/* Point Label (S1, S2...) */}
                          <text
                            x={pt.x + 8 / zoom}
                            y={pt.y - 8 / zoom}
                            fill="#fef08a"
                            fontSize={11 / zoom}
                            fontWeight="bold"
                            filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.9))"
                          >
                            {pt.label || `S${idx + 1}`}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* 3. LAYER: Real GPS Field Survey Boundary (Cyan) */}
                {layerGpsSurvey.visible && gpsPathData && (
                  <g>
                    <path
                      d={gpsPathData}
                      fill="#06b6d4"
                      fillOpacity={layerGpsSurvey.opacity * 0.25}
                      stroke="#06b6d4"
                      strokeWidth={2.5 / zoom}
                      strokeDasharray={`${6 / zoom}, ${4 / zoom}`}
                    />
                    {/* GPS Vertices */}
                    {gpsCanvasPoints.map((pt, idx) => (
                      <g key={pt.id}>
                        <rect
                          x={pt.x - 4 / zoom}
                          y={pt.y - 4 / zoom}
                          width={8 / zoom}
                          height={8 / zoom}
                          fill="#06b6d4"
                          stroke="#ffffff"
                          strokeWidth={1.5 / zoom}
                          onMouseEnter={() =>
                            setHoveredVertex({
                              label: pt.label,
                              layer: 'বাস্তব GPS সীমানা (Field GPS)',
                              x: pt.x,
                              y: pt.y,
                              lat: pt.lat,
                              lng: pt.lng,
                            })
                          }
                          onMouseLeave={() => setHoveredVertex(null)}
                          className="cursor-pointer"
                        />
                        {layerGpsSurvey.showLabels && (
                          <text
                            x={pt.x + 6 / zoom}
                            y={pt.y + 12 / zoom}
                            fill="#67e8f9"
                            fontSize={11 / zoom}
                            fontWeight="bold"
                            filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                )}

                {/* 4. LAYER: Saved Drawing (Amber) */}
                {layerSavedDrawing.visible && drawingPathData && (
                  <g>
                    <path
                      d={drawingPathData}
                      fill="#f59e0b"
                      fillOpacity={layerSavedDrawing.opacity * 0.2}
                      stroke="#f59e0b"
                      strokeWidth={2 / zoom}
                      strokeDasharray={`${3 / zoom}, ${3 / zoom}`}
                    />
                    {drawingCanvasPoints.map((pt, idx) => (
                      <g key={pt.id}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={3.5 / zoom}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={1 / zoom}
                          onMouseEnter={() =>
                            setHoveredVertex({
                              label: pt.label,
                              layer: 'সংরক্ষিত ড্রয়িং (CAD Drawing)',
                              x: pt.x,
                              y: pt.y,
                            })
                          }
                          onMouseLeave={() => setHoveredVertex(null)}
                        />
                        {layerSavedDrawing.showLabels && (
                          <text
                            x={pt.x + 5 / zoom}
                            y={pt.y - 5 / zoom}
                            fill="#fbbf24"
                            fontSize={10 / zoom}
                            fontWeight="bold"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    ))}
                    {/* CS Map Layer (Purple) */}
                    {(selectedCsFile || customCsPoints.length > 0) && csPathData && (
                      <g>
                        <path
                          d={csPathData}
                          fill="#a855f7"
                          fillOpacity={0.18}
                          stroke="#a855f7"
                          strokeWidth={2 / zoom}
                          strokeDasharray={`${5 / zoom}, ${3 / zoom}`}
                        />
                        {!(isVertexEditMode && selectedEditLayerId === 'layer-cs') &&
                          customCsPoints.map((pt, idx) => (
                            <circle
                              key={pt.id || idx}
                              cx={pt.x}
                              cy={pt.y}
                              r={3.5 / zoom}
                              fill="#a855f7"
                              stroke="#ffffff"
                              strokeWidth={1 / zoom}
                            />
                          ))}
                      </g>
                    )}

                    {/* BS Map Layer (Orange) */}
                    {(selectedBsFile || customBsPoints.length > 0) && bsPathData && (
                      <g>
                        <path
                          d={bsPathData}
                          fill="#f97316"
                          fillOpacity={0.18}
                          stroke="#f97316"
                          strokeWidth={2 / zoom}
                          strokeDasharray={`${6 / zoom}, ${3 / zoom}`}
                        />
                        {!(isVertexEditMode && selectedEditLayerId === 'layer-bs') &&
                          customBsPoints.map((pt, idx) => (
                            <circle
                              key={pt.id || idx}
                              cx={pt.x}
                              cy={pt.y}
                              r={3.5 / zoom}
                              fill="#f97316"
                              stroke="#ffffff"
                              strokeWidth={1 / zoom}
                            />
                          ))}
                      </g>
                    )}

                    {/* Interactive Vertex Editing Overlay */}
                    {isVertexEditMode && activePointsForEdit.length >= 3 && (
                      <InteractiveVertexCanvasOverlay
                        points={activePointsForEdit}
                        selectedPointIndex={selectedPointIndex}
                        segments={activeLayerSegments}
                        zoom={zoom}
                        isEditMode={true}
                        isSnapEnabled={isSnapEnabled}
                        snapResult={snapResult}
                        lang={lang}
                        polygonColor={activeEditLayerColor}
                        onSelectPoint={(idx) => setSelectedPointIndex(idx)}
                        onPointDrag={handlePointDrag}
                        onPointDragEnd={handlePointDragEnd}
                        onAddPointOnSegment={handleAddPointOnSegment}
                      />
                    )}
                  </g>
                )}

                {/* Centroid Displacement Vector Indicator */}
                {layerDigitizedDag.visible && layerGpsSurvey.visible && dagPoints.length >= 3 && (
                  <g opacity={0.9}>
                    {/* Centroid line */}
                    <line
                      x1={dagCentroid.x}
                      y1={dagCentroid.y}
                      x2={gpsCentroid.x}
                      y2={gpsCentroid.y}
                      stroke="#f43f5e"
                      strokeWidth={2 / zoom}
                      strokeDasharray={`${4 / zoom}, ${3 / zoom}`}
                    />
                    {/* Dag Centroid Marker */}
                    <circle
                      cx={dagCentroid.x}
                      cy={dagCentroid.y}
                      r={4 / zoom}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                    />
                    {/* GPS Centroid Marker */}
                    <circle
                      cx={gpsCentroid.x}
                      cy={gpsCentroid.y}
                      r={4 / zoom}
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                    />
                    {/* Offset Label */}
                    <text
                      x={(dagCentroid.x + gpsCentroid.x) / 2 + 6 / zoom}
                      y={(dagCentroid.y + gpsCentroid.y) / 2 - 6 / zoom}
                      fill="#f43f5e"
                      fontSize={11 / zoom}
                      fontWeight="bold"
                      filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.9))"
                    >
                      Δ {metrics.centroidDisplacementFt || 0} ft
                    </text>
                  </g>
                )}
              </g>
            </svg>

            {/* Hovered Vertex Inspector Overlay */}
            {hoveredVertex && (
              <div className="absolute bottom-3 left-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-[11px] shadow-lg backdrop-blur-xs space-y-0.5 pointer-events-none">
                <div className="font-bold text-amber-400">
                  {hoveredVertex.layer} — পয়েন্ট {hoveredVertex.label}
                </div>
                <div>
                  ক্যানভাস স্থানাঙ্ক: X={hoveredVertex.x}, Y={hoveredVertex.y}
                </div>
                {hoveredVertex.lat && hoveredVertex.lng && (
                  <div className="text-cyan-300">
                    GPS: {hoveredVertex.lat.toFixed(6)}°, {hoveredVertex.lng.toFixed(6)}°
                  </div>
                )}
              </div>
            )}

            {/* Quick Canvas Legend */}
            <div className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white text-[10px] space-y-1 backdrop-blur-xs pointer-events-none">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>মৌজা দাগ (Digitized)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>বাস্তব GPS সীমানা</span>
              </div>
              {(selectedCsFile || customCsPoints.length > 0) && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>CS ম্যাপ সীমানা</span>
                </div>
              )}
              {(selectedBsFile || customBsPoints.length > 0) && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span>BS ম্যাপ সীমানা</span>
                </div>
              )}
              {layerSavedDrawing.visible && activeDrawingSurvey && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>সংরক্ষিত ড্রয়িং</span>
                </div>
              )}
            </div>
          </div>

          {/* Surveyed Point Floating Inspector Bar (Touch & Click Friendly) */}
          {selectedSurveyedPointIndex !== null && surveyedPoints[selectedSurveyedPointIndex] && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-300 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block animate-pulse" />
                <span className="font-bold text-xs text-amber-950">
                  {isBn ? 'নির্বাচিত দখল পয়েন্ট: ' : 'Selected Point: '}
                  <strong className="text-amber-800">
                    {surveyedPoints[selectedSurveyedPointIndex].label || `S${selectedSurveyedPointIndex + 1}`}
                  </strong>
                </span>
                <span className="text-[11px] text-amber-900 font-mono bg-white/80 px-2 py-0.5 rounded-md border border-amber-200">
                  X={surveyedPoints[selectedSurveyedPointIndex].x}, Y={surveyedPoints[selectedSurveyedPointIndex].y}
                </span>
              </div>

              {/* Nudge & Action Controls */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-600 font-bold hidden sm:inline">
                  {isBn ? 'সূক্ষ্ম সরান:' : 'Nudge:'}
                </span>
                {/* Up */}
                <button
                  type="button"
                  onClick={() => {
                    pushDemarcationUndo();
                    setSurveyedPoints((prev) =>
                      prev.map((pt, i) =>
                        i === selectedSurveyedPointIndex ? { ...pt, y: pt.y - 2 } : pt
                      )
                    );
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs cursor-pointer shadow-2xs"
                  title="Move Up 2px"
                >
                  ↑
                </button>
                {/* Down */}
                <button
                  type="button"
                  onClick={() => {
                    pushDemarcationUndo();
                    setSurveyedPoints((prev) =>
                      prev.map((pt, i) =>
                        i === selectedSurveyedPointIndex ? { ...pt, y: pt.y + 2 } : pt
                      )
                    );
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs cursor-pointer shadow-2xs"
                  title="Move Down 2px"
                >
                  ↓
                </button>
                {/* Left */}
                <button
                  type="button"
                  onClick={() => {
                    pushDemarcationUndo();
                    setSurveyedPoints((prev) =>
                      prev.map((pt, i) =>
                        i === selectedSurveyedPointIndex ? { ...pt, x: pt.x - 2 } : pt
                      )
                    );
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs cursor-pointer shadow-2xs"
                  title="Move Left 2px"
                >
                  ←
                </button>
                {/* Right */}
                <button
                  type="button"
                  onClick={() => {
                    pushDemarcationUndo();
                    setSurveyedPoints((prev) =>
                      prev.map((pt, i) =>
                        i === selectedSurveyedPointIndex ? { ...pt, x: pt.x + 2 } : pt
                      )
                    );
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs cursor-pointer shadow-2xs"
                  title="Move Right 2px"
                >
                  →
                </button>

                {/* Delete Point */}
                <button
                  type="button"
                  onClick={handleDeleteSurveyPoint}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                  title={isBn ? 'এই পয়েন্টটি মুছুন' : 'Delete this point'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isBn ? 'মুছুন' : 'Delete'}</span>
                </button>

                {/* Close Inspector */}
                <button
                  type="button"
                  onClick={() => setSelectedSurveyedPointIndex(null)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                  title={isBn ? 'বন্ধ করুন' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Precision Vertex Inspector (When a point is selected in Edit Mode) */}
          {isVertexEditMode && selectedPointIndex !== null && activePointsForEdit[selectedPointIndex] && (
            <VertexEditInspector
              point={activePointsForEdit[selectedPointIndex]}
              pointIndex={selectedPointIndex}
              totalPoints={activePointsForEdit.length}
              prevSegment={
                activeLayerSegments[
                  (selectedPointIndex - 1 + activePointsForEdit.length) % activePointsForEdit.length
                ]
              }
              nextSegment={activeLayerSegments[selectedPointIndex % activePointsForEdit.length]}
              lang={lang}
              onNudge={handleNudge}
              onDelete={handleDeleteVertex}
              onClose={() => setSelectedPointIndex(null)}
            />
          )}

          {/* Legal Disclaimer for Indicative Map */}
          {isVertexEditMode && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
              <span>
                {isBn
                  ? 'আইনি নোটিশ: ডিজিটাল/ইন্ডিকেটিভ ম্যাপ — ব্যবহারকারীর প্রদত্ত/ডিজিটাইজ করা তথ্যের ভিত্তিতে প্রস্তুত। এটি কোনো আইনি সীমানা নির্ধারণ নয়।'
                  : 'Legal Disclaimer: Indicative digital map prepared based on user-provided/digitized data. Not a statutory legal boundary determination.'}
              </span>
            </div>
          )}
        </div>

        {/* Right 1 col: Layer Manager & Controls */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sliders className="w-3.5 h-3.5 text-emerald-800" />
                <span>{isBn ? 'লেয়ার কন্ট্রোল প্যানেল' : 'Visual Layers'}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {isBn ? '৪ + CS/BS' : '4 + CS/BS'}
              </span>
            </div>

            {/* Layer 1: Mouza Sheet */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-bold text-slate-800">
                    {isBn ? 'মৌজা নকশা ব্যাকগ্রাউন্ড' : 'Mouza Sheet'}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setLayerMouzaSheet((prev) => ({ ...prev, visible: !prev.visible }))
                  }
                  className="p-1 rounded text-slate-500 hover:text-slate-800"
                >
                  {layerMouzaSheet.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12">
                  {Math.round(layerMouzaSheet.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={layerMouzaSheet.opacity}
                  onChange={(e) =>
                    setLayerMouzaSheet((prev) => ({
                      ...prev,
                      opacity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-slate-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Layer 2: Digitized Dag */}
            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-900">
                    {isBn ? 'ডিজিটাইজড দাগ সীমানা' : 'Digitized Dag'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setLayerDigitizedDag((prev) => ({
                        ...prev,
                        showLabels: !prev.showLabels,
                      }))
                    }
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      layerDigitizedDag.showLabels
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    Pt
                  </button>
                  <button
                    onClick={() =>
                      setLayerDigitizedDag((prev) => ({ ...prev, visible: !prev.visible }))
                    }
                    className="p-1 rounded text-slate-500 hover:text-slate-800"
                  >
                    {layerDigitizedDag.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12">
                  {Math.round(layerDigitizedDag.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={layerDigitizedDag.opacity}
                  onChange={(e) =>
                    setLayerDigitizedDag((prev) => ({
                      ...prev,
                      opacity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-600 h-1.5 bg-emerald-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Layer 3: Real GPS Survey */}
            <div className="p-2.5 rounded-xl bg-cyan-50/60 border border-cyan-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <span className="text-xs font-bold text-slate-900">
                    {isBn ? 'বাস্তব GPS সীমানা' : 'Field GPS Survey'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setLayerGpsSurvey((prev) => ({
                        ...prev,
                        showLabels: !prev.showLabels,
                      }))
                    }
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      layerGpsSurvey.showLabels
                        ? 'bg-cyan-200 text-cyan-900'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    Pt
                  </button>
                  <button
                    onClick={() =>
                      setLayerGpsSurvey((prev) => ({ ...prev, visible: !prev.visible }))
                    }
                    className="p-1 rounded text-slate-500 hover:text-slate-800"
                  >
                    {layerGpsSurvey.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12">
                  {Math.round(layerGpsSurvey.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={layerGpsSurvey.opacity}
                  onChange={(e) =>
                    setLayerGpsSurvey((prev) => ({
                      ...prev,
                      opacity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-600 h-1.5 bg-cyan-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Layer 4: Saved Drawing */}
            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-slate-900">
                    {isBn ? 'সংরক্ষিত CAD ড্রয়িং' : 'CAD Drawing'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setLayerSavedDrawing((prev) => ({
                        ...prev,
                        showLabels: !prev.showLabels,
                      }))
                    }
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      layerSavedDrawing.showLabels
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    Pt
                  </button>
                  <button
                    onClick={() =>
                      setLayerSavedDrawing((prev) => ({ ...prev, visible: !prev.visible }))
                    }
                    className="p-1 rounded text-slate-500 hover:text-slate-800"
                  >
                    {layerSavedDrawing.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12">
                  {Math.round(layerSavedDrawing.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={layerSavedDrawing.opacity}
                  onChange={(e) =>
                    setLayerSavedDrawing((prev) => ({
                      ...prev,
                      opacity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-600 h-1.5 bg-amber-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Centroid Displacement Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-rose-400" />
                {isBn ? 'সীমানা বিচ্যুতি নির্দেশক' : 'Boundary Offset'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                Δ Displacement
              </span>
            </div>
            <div className="text-lg font-extrabold text-white">
              {metrics.centroidDisplacementFt || 0}{' '}
              <span className="text-xs font-semibold text-slate-400">{isBn ? 'ফুট' : 'ft'}</span>
            </div>
            <div className="text-[11px] text-slate-300">
              {isBn ? 'দিক: ' : 'Direction: '}
              <span className="font-bold text-amber-300">
                {isBn ? metrics.displacementDirectionBn || '—' : metrics.displacementDirectionEn || '—'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              {isBn
                ? 'মৌজা নকশার কেন্দ্র ও জিপিএস জরিপের কেন্দ্রের তুলনামূলক অবস্থানিক ব্যবধান।'
                : 'Indicative physical offset between map centroid and GPS centroid.'}
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Digital Demarcation (দখল/সীমানা নির্ধারণ) Comparison Summary (Phase 20J.3) */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/95 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-900 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isBn ? 'দখল ও মৌজা সীমানা তুলনামূলক ফলাফল' : 'Digital Demarcation & Boundary Comparison'}
              </h4>
              <span className="text-[11px] text-slate-500">
                {isBn
                  ? 'ডিজিটাল পরিমাপ/তুলনামূলক ফলাফল — আমিন কর্তৃক যাচাইযোগ্য।'
                  : 'Digital measurement & comparative results — surveyor verifiable.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'PDF প্রতিবেদন প্রিন্ট' : 'Print PDF Report'}</span>
            </button>
          </div>
        </div>

        {/* 4 Detailed Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Reference Dag */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                {isBn
                  ? `মূল নকশা দাগ নং ${selectedDag?.dagNo || 'সার্ভে'}`
                  : `Reference Dag #${selectedDag?.dagNo || 'Survey'}`}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {activeRefPoints.length} {isBn ? 'বিন্দু' : 'pts'}
              </span>
            </div>
            <div className="text-xl font-extrabold text-emerald-950">
              {formatNumberByLang(activeRefMetrics.areaDecimal.toString(), isBn ? 'bn' : 'en')}{' '}
              <span className="text-xs font-semibold text-emerald-800">{isBn ? 'শতক' : 'Dec'}</span>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>
                {formatNumberByLang(activeRefMetrics.areaSqFt.toString(), isBn ? 'bn' : 'en')}{' '}
                {isBn ? 'বর্গফুট' : 'sq ft'}{' '}
                (
                {formatNumberByLang(
                  roundClean(activeRefMetrics.areaSqFt / 720, 2).toString(),
                  isBn ? 'bn' : 'en'
                )}{' '}
                {isBn ? 'কাঠা' : 'katha'})
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {isBn ? 'পরিসীমা: ' : 'Perimeter: '}
                {unit === 'feet'
                  ? `${formatNumberByLang(activeRefMetrics.perimeterFt.toString(), isBn ? 'bn' : 'en')} ${isBn ? 'ফুট' : 'ft'}`
                  : `${formatNumberByLang(roundClean(activeRefMetrics.perimeterFt / LAND_CONSTANTS.FEET_PER_LINK, 1).toString(), isBn ? 'bn' : 'en')} ${isBn ? 'লিঙ্ক' : 'lk'}`}
              </div>
            </div>
          </div>

          {/* 2. Surveyed Boundary */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                {isBn ? 'মাঠ দখল / জরিপ সীমানা' : 'Surveyed / Occupied Boundary'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900">
                {surveyedPoints.length} {isBn ? 'বিন্দু' : 'pts'}
              </span>
            </div>
            <div className="text-xl font-extrabold text-amber-950">
              {formatNumberByLang(surveyedMetrics.areaDecimal.toString(), isBn ? 'bn' : 'en')}{' '}
              <span className="text-xs font-semibold text-amber-800">{isBn ? 'শতক' : 'Dec'}</span>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>
                {formatNumberByLang(surveyedMetrics.areaSqFt.toString(), isBn ? 'bn' : 'en')}{' '}
                {isBn ? 'বর্গফুট' : 'sq ft'}{' '}
                (
                {formatNumberByLang(
                  roundClean(surveyedMetrics.areaSqFt / 720, 2).toString(),
                  isBn ? 'bn' : 'en'
                )}{' '}
                {isBn ? 'কাঠা' : 'katha'})
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {isBn ? 'পরিসীমা: ' : 'Perimeter: '}
                {unit === 'feet'
                  ? `${formatNumberByLang(surveyedMetrics.perimeterFt.toString(), isBn ? 'bn' : 'en')} ${isBn ? 'ফুট' : 'ft'}`
                  : `${formatNumberByLang(roundClean(surveyedMetrics.perimeterFt / LAND_CONSTANTS.FEET_PER_LINK, 1).toString(), isBn ? 'bn' : 'en')} ${isBn ? 'লিঙ্ক' : 'lk'}`}
              </div>
            </div>
          </div>

          {/* 3. Area Variance */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">
                {isBn ? 'ক্ষেত্রফলের ব্যবধান' : 'Area Difference'}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  demarcationVariance.pctVariance <= 3
                    ? 'bg-emerald-100 text-emerald-800'
                    : demarcationVariance.pctVariance <= 8
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {formatNumberByLang(demarcationVariance.pctVariance.toString(), isBn ? 'bn' : 'en')}%{' '}
                {isBn ? 'ব্যবধান' : 'diff'}
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {formatNumberByLang(demarcationVariance.areaDiffDecimal.toString(), isBn ? 'bn' : 'en')}{' '}
              <span className="text-xs font-semibold text-slate-600">{isBn ? 'শতক' : 'Dec'}</span>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>
                {formatNumberByLang(demarcationVariance.areaDiffSqFt.toString(), isBn ? 'bn' : 'en')}{' '}
                {isBn ? 'বর্গফুট' : 'sq ft'}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {surveyedMetrics.areaSqFt >= activeRefMetrics.areaSqFt
                  ? isBn
                    ? '+ দখল বৃদ্ধি পেয়েছে'
                    : '+ Extra occupied'
                  : isBn
                  ? '- মূল দাগ হতে কম দখল'
                  : '- Less than dag'}
              </div>
            </div>
          </div>

          {/* 4. Perimeter & Centroid Offset */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">
                {isBn ? 'পরিসীমা ও কেন্দ্র ব্যবধান' : 'Perimeter & Offset'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800">
                Δ Offset
              </span>
            </div>
            <div className="text-xl font-extrabold text-purple-950">
              {unit === 'feet'
                ? `${formatNumberByLang(demarcationVariance.centroidOffsetFt.toString(), isBn ? 'bn' : 'en')} `
                : `${formatNumberByLang(demarcationVariance.centroidOffsetLk.toString(), isBn ? 'bn' : 'en')} `}
              <span className="text-xs font-semibold text-slate-600">
                {unit === 'feet' ? (isBn ? 'ফুট' : 'ft') : (isBn ? 'লিঙ্ক' : 'lk')}
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>
                {isBn ? 'পরিসীমা পার্থক্য: ' : 'Perim diff: '}
                {unit === 'feet'
                  ? `${formatNumberByLang(demarcationVariance.perimDiffFt.toString(), isBn ? 'bn' : 'en')} ফু.`
                  : `${formatNumberByLang(demarcationVariance.perimDiffLk.toString(), isBn ? 'bn' : 'en')} লি.`}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {isBn ? 'কেন্দ্র স্থানচ্যুতি নির্দেশক' : 'Centroid shift indicator'}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Safety Note & Legal Caution */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-slate-800">
              {isBn ? 'আইনগত ও পেশাগত নিরাপত্তা বিবৃতি:' : 'Legal & Professional Safety Notice:'}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {isBn
                ? 'চূড়ান্ত আইনগত সীমানা নির্ধারণের পরিবর্তে এটি মাঠ জরিপ ও তুলনামূলক সহায়ক প্রতিবেদন। ভূমি সংক্রান্ত চূড়ান্ত সিদ্ধান্তের ক্ষেত্রে সরকারি জরিপ ও সংশ্লিষ্ট কর্তৃপক্ষের প্রত্যয়ন গ্রহণ করুন।'
                : 'This is a field survey and comparative assistance report rather than a final statutory cadastral boundary determination.'}
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Comparative Metrics Summary Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Map Area */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 mb-0.5">
            {isBn ? 'মৌজা দাগ ক্ষেত্রফল' : 'Map Dag Area'}
          </div>
          <div className="text-base sm:text-lg font-extrabold text-emerald-900">
            {metrics.mapAreaDecimal}{' '}
            <span className="text-xs font-semibold text-slate-600">{isBn ? 'শতক' : 'Dec'}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {metrics.mapAreaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
          </div>
        </div>

        {/* GPS Area */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 mb-0.5">
            {isBn ? 'GPS ফিল্ড ক্ষেত্রফল' : 'GPS Field Area'}
          </div>
          <div className="text-base sm:text-lg font-extrabold text-cyan-900">
            {metrics.gpsAreaDecimal}{' '}
            <span className="text-xs font-semibold text-slate-600">{isBn ? 'শতক' : 'Dec'}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {metrics.gpsAreaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
          </div>
        </div>

        {/* Area Variance */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 mb-0.5">
            {isBn ? 'ক্ষেত্রফলের ব্যবধান' : 'Area Variance'}
          </div>
          <div className="text-base sm:text-lg font-extrabold text-amber-900">
            {metrics.diffDecimal}{' '}
            <span className="text-xs font-semibold text-slate-600">{isBn ? 'শতক' : 'Dec'}</span>
          </div>
          <div className="text-[11px] text-amber-700 font-semibold">
            {metrics.percentageVariance}% {isBn ? 'পার্থক্য' : 'variance'}
          </div>
        </div>

        {/* Perimeter Difference */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 mb-0.5">
            {isBn ? 'পরিসীমার তুলনা' : 'Perimeter Diff'}
          </div>
          <div className="text-base sm:text-lg font-extrabold text-slate-900">
            {metrics.perimeterDiffFt}{' '}
            <span className="text-xs font-semibold text-slate-600">{isBn ? 'ফুট' : 'ft'}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            নকশা: {metrics.perimeterMapFt}ft | GPS: {metrics.perimeterGpsFt}ft
          </div>
        </div>
      </div>

      {/* Scanned Map Catalog Modal */}
      {showCatalogModal && (
        <ScannedMapCatalogModal
          lang={lang}
          onClose={() => setShowCatalogModal(false)}
          onSelectMap={async (catRecord) => {
            setShowCatalogModal(false);
            const targetCategory: 'cs_map' | 'bs_map' =
              catRecord.surveyType === 'CS' || catRecord.surveyType === 'SA' ? 'cs_map' : 'bs_map';
            const upFile: UploadedMapFile = {
              id: `cat-${catRecord.id}`,
              name: catRecord.originalFileName || `${catRecord.mapTitle}.png`,
              fileType: 'image',
              mimeType: 'image/png',
              size: 1024 * 350,
              sizeFormatted: '350 KB',
              dataUrl: catRecord.fileReference,
              category: targetCategory,
              uploadedAt: Date.now(),
              notes: `${catRecord.district} - ${catRecord.upazila} - ${catRecord.mouza} (${catRecord.surveyType})`,
            };
            try {
              await saveMapFile(upFile);
            } catch (e) {
              console.warn('Saving catalog map file to IDB:', e);
            }
            if (targetCategory === 'cs_map') {
              setSelectedCsFile(upFile);
            } else {
              setSelectedBsFile(upFile);
            }
          }}
        />
      )}

      {/* 5. Text / Note & Client Info Editor Modal */}
      {showNoteEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-800" />
                <h4 className="font-bold text-slate-900 text-base">
                  {isBn ? 'আমিন মন্তব্য ও প্রকল্প তথ্য' : 'Demarcation Notes & Details'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowNoteEditor(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn ? 'প্রকল্পের শিরোনাম' : 'Project Title'}
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'মালিক / ক্লায়েন্টের নাম' : 'Owner / Client Name'}
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={isBn ? 'যেমন: মোঃ রফিকুল ইসলাম' : 'e.g. John Doe'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'খতিয়ান নম্বর' : 'Khatian No.'}
                  </label>
                  <input
                    type="text"
                    value={khatianNo}
                    onChange={(e) => setKhatianNo(e.target.value)}
                    placeholder={isBn ? 'যেমন: ১২৮' : 'e.g. 128'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn ? 'আমিন / সার্ভেয়ারের নাম' : 'Amin / Surveyor Name'}
                </label>
                <input
                  type="text"
                  value={aminName}
                  onChange={(e) => setAminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isBn ? 'দখল ও সীমানা নির্ধারণ সংক্রান্ত মন্তব্য' : 'Demarcation Field Notes'}
                </label>
                <textarea
                  rows={3}
                  value={demarcationNotes}
                  onChange={(e) => setDemarcationNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-800 resize-none"
                  placeholder={
                    isBn
                      ? 'মাঠ দখলের অবস্থা বা অন্যান্য বিবরণ লিখুন...'
                      : 'Enter field demarcation notes...'
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  pushDemarcationUndo();
                  setShowNoteEditor(false);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                {isBn ? 'সম্পন্ন' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Comparative Demarcation PDF Report Modal */}
      {isReportModalOpen && (
        <ComparativeDemarcationReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          data={reportData}
          lang={lang}
        />
      )}
    </div>
  );
};
