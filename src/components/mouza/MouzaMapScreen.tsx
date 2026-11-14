import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Map as MapIcon,
  Layers,
  Upload,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  Scale,
  MapPin,
  FileText,
  Compass,
  ArrowLeft,
  AlertTriangle,
  Info,
  ShieldCheck,
  Check,
  Share2,
  Download,
  Printer,
  ChevronRight,
  Database,
  FolderArchive,
  Ruler,
  Target,
  MoreHorizontal,
  FolderOpen,
  Save,
} from 'lucide-react';
import {
  Language,
  MouzaMapRecord,
  DigitizedDagRecord,
  DigitizedDagPoint,
  SurveyRecord,
  ComparativePentagraphProject,
} from '../../types';
import {
  getStoredMouzaMaps,
  saveMouzaMapToStorage,
  deleteMouzaMapFromStorage,
  calculateDagPolygonArea,
  resolveMouzaMapFileUrl,
  savePentagraphProject,
  calculatePentagraphMetrics,
  calculatePolygonCentroid,
} from '../../lib/mouza-map';
import { getStoredGpsPoints } from '../../lib/gps-utils';
import { printWithNoto } from '../../lib/print-utils';
import { GpsPoint } from '../../lib/gps-types';
import { getStoredMapFileWithContent } from '../../lib/pentagraph-files';
import { MouzaCanvas, MouzaMapMetadata } from './MouzaCanvas';
import { MouzaImportModal } from './MouzaImportModal';
import { DagVerificationCard } from './DagVerificationCard';
import { ComparativePentagraph } from './ComparativePentagraph';
import { MapJointWorkspace } from './MapJointWorkspace';
import { AdvancedVerificationView } from './AdvancedVerificationView';
import { VertexEditToolbar } from './VertexEditToolbar';
import { VertexEditInspector } from './VertexEditInspector';
import { DagMeasurementWorkspace } from './DagMeasurementWorkspace';
import { ProfessionalServiceDisclaimer } from '../common/ProfessionalServiceDisclaimer';
import { ScannedMapCatalogModal } from './ScannedMapCatalogModal';
import { MouzaDataImportModal } from '../admin/MouzaDataImportModal';
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
import { formatNumberByLang, roundClean } from '../../lib/land-units';

export type MouzaWorkflowTab =
  | 'map'
  | 'dag_select'
  | 'measurement'
  | 'pentagraph'
  | 'report'
  | 'map_joint'
  | 'advanced_verification';

interface MouzaMapScreenProps {
  lang: Language;
  surveys: SurveyRecord[];
  onBack: () => void;
  onNavigateToSurvey?: () => void;
  onOpenMapDrawing?: (surveyId?: string) => void;
  onOpenReport?: (surveyId?: string) => void;
  initialMouzaMapId?: string | null;
  hideBackButton?: boolean;
}

const FIELD_BOUNDARY_STORAGE_KEY = 'bhumi_field_boundary_state';

export const MouzaMapScreen: React.FC<MouzaMapScreenProps> = ({
  lang,
  surveys,
  onBack,
  onNavigateToSurvey,
  onOpenMapDrawing,
  onOpenReport,
  initialMouzaMapId,
  hideBackButton = false,
}) => {
  const isBn = lang === 'bn';

  // 1. Mobile-First 5-Step Workflow Tabs
  const [activeTab, setActiveTab] = useState<MouzaWorkflowTab>('map');
  const [showMoreToolsMenu, setShowMoreToolsMenu] = useState<boolean>(false);

  // Mouza Maps State
  const [mouzaMaps, setMouzaMaps] = useState<MouzaMapRecord[]>(() => getStoredMouzaMaps());
  const [selectedMapId, setSelectedMapId] = useState<string>(
    initialMouzaMapId || (mouzaMaps[0]?.id ?? '')
  );

  // Active GPS Points from local storage
  const [activeGpsPoints, setActiveGpsPoints] = useState<GpsPoint[]>(() => getStoredGpsPoints());

  useEffect(() => {
    const handleStorage = () => {
      setActiveGpsPoints(getStoredGpsPoints());
      setMouzaMaps(getStoredMouzaMaps());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Current selected Mouza Map
  const currentMap = useMemo(() => {
    return mouzaMaps.find((m) => m.id === selectedMapId) || mouzaMaps[0] || null;
  }, [selectedMapId, mouzaMaps]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const filteredMaps = useMemo(() => {
    if (!searchQuery.trim()) return mouzaMaps;
    const q = searchQuery.toLowerCase();
    return mouzaMaps.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.mouza.toLowerCase().includes(q) ||
        m.district.toLowerCase().includes(q) ||
        m.jlNo.toLowerCase().includes(q) ||
        m.digitizedDags.some((d) => d.dagNo.toLowerCase().includes(q))
    );
  }, [mouzaMaps, searchQuery]);

  // Selected Dag within current map
  const [selectedDagId, setSelectedDagId] = useState<string | null>(null);

  useEffect(() => {
    if (currentMap?.digitizedDags?.length) {
      setSelectedDagId(currentMap.digitizedDags[0].id);
    } else {
      setSelectedDagId(null);
    }
  }, [selectedMapId, currentMap]);

  const selectedDag = useMemo(() => {
    if (!currentMap || !selectedDagId) return null;
    return currentMap.digitizedDags.find((d) => d.id === selectedDagId) || null;
  }, [currentMap, selectedDagId]);

  // Advanced Vertex Editing State
  const [isVertexEditMode, setIsVertexEditMode] = useState<boolean>(false);
  const [tracingInteractionMode, setTracingInteractionMode] = useState<'draw' | 'pan'>('draw'); // New mode state
  // Phase 3B: Field Boundary Editing
  const [isFieldBoundaryEditMode, setIsFieldBoundaryEditMode] = useState<boolean>(false);
  const [isDemarcationView, setIsDemarcationView] = useState<boolean>(false);
  const [fieldBoundaryPoints, setFieldBoundaryPoints] = useState<DigitizedDagPoint[]>([]);
  // Simple Professional Measurement Tool State (Phase 20J.2)
  const [isCanvasMeasureMode, setIsCanvasMeasureMode] = useState<boolean>(false);
  const [activeEditPoints, setActiveEditPoints] = useState<DigitizedDagPoint[]>([]);
  const [originalPoints, setOriginalPoints] = useState<DigitizedDagPoint[]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [isSnapEnabled, setIsSnapEnabled] = useState<boolean>(true);
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const [vertexUndoStack, setVertexUndoStack] = useState<DigitizedDagPoint[][]>([]);
  const [vertexRedoStack, setVertexRedoStack] = useState<DigitizedDagPoint[][]>([]);

  const [resolvedCanvasBgUrl, setResolvedCanvasBgUrl] = useState<string | undefined>(undefined);

  // Asynchronously resolve background URL using unified map resolver (IndexedDB, direct URL, or Cadastral Sheet)
  useEffect(() => {
    let active = true;
    if (!currentMap) {
      setResolvedCanvasBgUrl(undefined);
      return;
    }

    resolveMouzaMapFileUrl(currentMap).then((url) => {
      if (active) {
        setResolvedCanvasBgUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [currentMap?.id, currentMap?.fileDataUrl]);

  // Synchronize activeEditPoints with selectedDag or Field Boundary
  useEffect(() => {
    if (isFieldBoundaryEditMode) {
      setActiveEditPoints(fieldBoundaryPoints);
      setOriginalPoints(fieldBoundaryPoints); // Or original if preserved
      setIsVertexEditMode(true);
    } else if (selectedDag && selectedDag.points) {
      const formatted = selectedDag.points.map((p, idx) => ({
        ...p,
        sourceType: p.sourceType || 'digitized',
        label: p.label || `P${idx + 1}`,
      }));
      setActiveEditPoints(formatted);
      setOriginalPoints(selectedDag.originalPoints || formatted);
      setVertexUndoStack([]);
      setVertexRedoStack([]);
      setSelectedVertexIndex(null);
    } else {
      setActiveEditPoints([]);
      setOriginalPoints([]);
      setIsVertexEditMode(false);
      setSelectedVertexIndex(null);
    }
  }, [selectedDagId, selectedDag, isFieldBoundaryEditMode, fieldBoundaryPoints]);

  // Load Field Boundary on DAG select
  useEffect(() => {
    if (!selectedDagId) return;
    const raw = localStorage.getItem(FIELD_BOUNDARY_STORAGE_KEY);
    if (raw) {
      try {
        const all = JSON.parse(raw);
        if (all[selectedDagId]) {
          setFieldBoundaryPoints(all[selectedDagId]);
        } else {
          setFieldBoundaryPoints([]);
        }
      } catch (e) {
        console.error("Malformed field boundary data", e);
        setFieldBoundaryPoints([]);
      }
    } else {
      setFieldBoundaryPoints([]);
    }
  }, [selectedDagId]);

  // Persist Field Boundary with debounce
  useEffect(() => {
    if (!isFieldBoundaryEditMode || !selectedDagId) return;
    const timer = setTimeout(() => {
      const raw = localStorage.getItem(FIELD_BOUNDARY_STORAGE_KEY);
      let all: any = {};
      try {
        if (raw) all = JSON.parse(raw);
      } catch (e) {
        console.error("Malformed field boundary data", e);
      }
      all[selectedDagId] = activeEditPoints;
      localStorage.setItem(FIELD_BOUNDARY_STORAGE_KEY, JSON.stringify(all));
    }, 500);
    return () => clearTimeout(timer);
  }, [activeEditPoints, isFieldBoundaryEditMode, selectedDagId]);

  const scale = currentMap?.scalePixelsPerFoot || 1.2;

  const currentMetrics = useMemo(() => {
    if (activeEditPoints.length < 3) {
      return {
        areaSqFt: selectedDag?.areaSqFt || 0,
        areaDecimal: selectedDag?.areaDecimal || 0,
        areaKatha: selectedDag?.areaKatha || 0,
        areaBigha: selectedDag?.areaBigha || 0,
        areaAcre: roundClean((selectedDag?.areaSqFt || 0) / 43560, 4),
        perimeterFt: selectedDag?.perimeterFt || 0,
      };
    }
    return calculatePolygonMetrics(activeEditPoints, scale);
  }, [activeEditPoints, scale, selectedDag]);

  const currentSegments = useMemo(() => {
    return calculateSegmentInfos(activeEditPoints, scale);
  }, [activeEditPoints, scale]);

  const isCurrentDagEdited = useMemo(() => {
    return arePointsDifferent(activeEditPoints, originalPoints);
  }, [activeEditPoints, originalPoints]);

  // Comparison & Demarcation Variance
  const demarcationVariance = useMemo(() => {
    const dagPointsForMetrics = selectedDag?.points || [];
    const dagMetrics = calculatePolygonMetrics(dagPointsForMetrics, scale);
    const surveyMetrics = calculatePolygonMetrics(fieldBoundaryPoints, scale);
    const dagCentroid = calculatePolygonCentroid(dagPointsForMetrics);
    const surveyCentroid = calculatePolygonCentroid(fieldBoundaryPoints);

    return calculatePentagraphMetrics(
      dagMetrics.areaSqFt,
      surveyMetrics.areaSqFt,
      dagMetrics.perimeterFt,
      surveyMetrics.perimeterFt,
      dagCentroid,
      surveyCentroid,
      scale
    );
  }, [selectedDag, fieldBoundaryPoints, scale]);

  const handleSavePentagraphProject = () => {
    if (!currentMap || !selectedDag) return;
    const project: ComparativePentagraphProject = {
      id: `proj-${Date.now()}`,
      title: `${isBn ? 'ডিমারকেশন' : 'Demarcation'} - ${currentMap.mouza} (${selectedDag.dagNo})`,
      mouzaMapId: currentMap.id,
      dagId: selectedDag.id,
      layers: [],
      metrics: {
        mapAreaSqFt: demarcationVariance.mapAreaSqFt,
        mapAreaDecimal: demarcationVariance.mapAreaDecimal,
        gpsAreaSqFt: demarcationVariance.gpsAreaSqFt,
        gpsAreaDecimal: demarcationVariance.gpsAreaDecimal,
        diffSqFt: demarcationVariance.diffSqFt,
        diffDecimal: demarcationVariance.diffDecimal,
        percentageVariance: demarcationVariance.percentageVariance,
        perimeterMapFt: demarcationVariance.perimeterMapFt,
        perimeterGpsFt: demarcationVariance.perimeterGpsFt,
        perimeterDiffFt: demarcationVariance.perimeterDiffFt,
        centroidDisplacementFt: demarcationVariance.centroidDisplacementFt,
        displacementDirectionEn: demarcationVariance.displacementDirectionEn,
        displacementDirectionBn: demarcationVariance.displacementDirectionBn,
        matchGrade: demarcationVariance.matchGrade,
      },
      demarcationSurveyedPoints: fieldBoundaryPoints,
      demarcationReferencePoints: selectedDag.points,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    savePentagraphProject(project);
    setNotificationMsg(isBn ? 'প্রজেক্ট সংরক্ষিত হয়েছে!' : 'Project saved successfully!');
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const pushVertexUndo = () => {
    setVertexUndoStack((prev) => [...prev, activeEditPoints]);
    setVertexRedoStack([]);
  };

  const handleVertexUndo = () => {
    if (vertexUndoStack.length === 0) return;
    const prev = vertexUndoStack[vertexUndoStack.length - 1];
    setVertexUndoStack((s) => s.slice(0, -1));
    setVertexRedoStack((s) => [...s, activeEditPoints]);
    setActiveEditPoints(prev);
  };

  const handleVertexRedo = () => {
    if (vertexRedoStack.length === 0) return;
    const next = vertexRedoStack[vertexRedoStack.length - 1];
    setVertexRedoStack((s) => s.slice(0, -1));
    setVertexUndoStack((s) => [...s, activeEditPoints]);
    setActiveEditPoints(next);
  };

  const handlePointDrag = (index: number, newX: number, newY: number) => {
    let tx = newX;
    let ty = newY;
    if (isSnapEnabled) {
      const snap = findSnapPoint(newX, newY, activeEditPoints, index, 14);
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

    setActiveEditPoints((prev) =>
      prev.map((pt, i) =>
        i === index
          ? {
              ...pt,
              x: Math.round(tx),
              y: Math.round(ty),
              sourceType: pt.sourceType === 'gps' ? 'gps' : 'manual',
            }
          : pt
      )
    );
  };

  const handlePointDragEnd = () => {
    pushVertexUndo();
    setSnapResult(null);
  };

  const handleAddVertexOnSegment = (segIdx: number, coords: { x: number; y: number }) => {
    pushVertexUndo();
    const updated = insertVertexAtSegment(activeEditPoints, segIdx, coords, 'manual');
    setActiveEditPoints(updated);
    setSelectedVertexIndex(segIdx + 1);
    setNotificationMsg(
      isBn ? 'নতুন পয়েন্ট সফলভাবে যুক্ত হয়েছে!' : 'New vertex added successfully!'
    );
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleDeleteVertex = () => {
    if (selectedVertexIndex === null) return;
    if (activeEditPoints.length <= 3) {
      alert(
        isBn
          ? 'বহুভুজ সীমানা বজায় রাখতে কমপক্ষে ৩টি পয়েন্ট প্রয়োজন।'
          : 'At least 3 vertices required.'
      );
      return;
    }
    if (!window.confirm(isBn ? 'আপনি কি নিশ্চিত এই পয়েন্টটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this vertex?')) return;
    pushVertexUndo();
    const { success, updatedPoints } = deleteVertexAtIndex(activeEditPoints, selectedVertexIndex);
    if (success) {
      setActiveEditPoints(updatedPoints);
      setSelectedVertexIndex(null);
      setNotificationMsg(isBn ? 'পয়েন্ট মুছে ফেলা হয়েছে।' : 'Vertex removed.');
      setTimeout(() => setNotificationMsg(null), 3000);
    }
  };

  const handleNudge = (dx: number, dy: number) => {
    if (selectedVertexIndex === null) return;
    pushVertexUndo();
    const updated = nudgeVertex(activeEditPoints, selectedVertexIndex, dx, dy);
    setActiveEditPoints(updated);
  };

  const handleResetToOriginal = () => {
    if (!window.confirm(isBn ? 'আপনি কি নিশ্চিত? এটি আপনার সব বর্তমান পরিবর্তন মুছে ফেলবে।' : 'Are you sure? This will discard all your current changes.')) return;
    pushVertexUndo();
    setActiveEditPoints([...originalPoints]);
    setNotificationMsg(
      isBn ? 'মূল (Original) জ্যামিতি পুনঃস্থাপন করা হয়েছে!' : 'Original geometry restored!'
    );
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleSaveDagEdits = () => {
    if (isFieldBoundaryEditMode) {
      setFieldBoundaryPoints(activeEditPoints);
      setNotificationMsg(isBn ? 'ফিল্ড সীমানা সংরক্ষিত হয়েছে!' : 'Field boundary saved!');
      setTimeout(() => setNotificationMsg(null), 4000);
      return;
    }
    if (!currentMap || !selectedDag) return;
    const updatedDag: DigitizedDagRecord = {
      ...selectedDag,
      points: activeEditPoints,
      originalPoints: originalPoints,
      isEdited: arePointsDifferent(activeEditPoints, originalPoints),
      areaSqFt: currentMetrics.areaSqFt,
      areaDecimal: currentMetrics.areaDecimal,
      areaKatha: currentMetrics.areaKatha,
      areaBigha: currentMetrics.areaBigha,
      perimeterFt: currentMetrics.perimeterFt,
      updatedAt: Date.now(),
    };

    const updatedMap: MouzaMapRecord = {
      ...currentMap,
      digitizedDags: currentMap.digitizedDags.map((d) => (d.id === updatedDag.id ? updatedDag : d)),
      updatedAt: Date.now(),
    };

    saveMouzaMapToStorage(updatedMap);
    setMouzaMaps(getStoredMouzaMaps());

    setNotificationMsg(
      isBn
        ? `দাগ নং ${updatedDag.dagNo}-এর পয়েন্ট এডিট ও নতুন পরিমাপ সফলভাবে সংরক্ষিত হয়েছে!`
        : `Dag #${updatedDag.dagNo} vertex edits and recalculated measurements saved successfully!`
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Digitization State
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [activeDrawingPoints, setActiveDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [newDagNo, setNewDagNo] = useState<string>('');
  const [newDagNotes, setNewDagNotes] = useState<string>('');
  const [showSaveDagDialog, setShowSaveDagDialog] = useState<boolean>(false);

  // GPS Overlay state
  const [showGpsOverlay, setShowGpsOverlay] = useState<boolean>(true);
  const [selectedGpsSurveyKey, setSelectedGpsSurveyKey] = useState<string>('active_gps');

  const activeGpsSurveyRecord = useMemo(() => {
    if (selectedGpsSurveyKey === 'active_gps') return null;
    return surveys.find((s) => s.id === selectedGpsSurveyKey) || null;
  }, [selectedGpsSurveyKey, surveys]);

  const currentGpsPoints = useMemo(() => {
    if (selectedGpsSurveyKey === 'active_gps') {
      return activeGpsPoints;
    }
    if (activeGpsSurveyRecord) {
      return activeGpsSurveyRecord.points.map((p) => ({
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        label: p.label || p.name,
      }));
    }
    return [];
  }, [selectedGpsSurveyKey, activeGpsPoints, activeGpsSurveyRecord]);

  const activeGpsAreaSqFt = useMemo(() => {
    if (activeGpsSurveyRecord) return activeGpsSurveyRecord.areaSqFt;
    if (activeGpsPoints.length >= 3) return 6534;
    return 0;
  }, [activeGpsSurveyRecord, activeGpsPoints]);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [showDataImportModal, setShowDataImportModal] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [fitViewTrigger, setFitViewTrigger] = useState<number>(0);

  // Canvas Click Handler in Drawing Mode
  const handleCanvasClick = (pt: { x: number; y: number }) => {
    if (!isDrawingMode || tracingInteractionMode === 'pan') return;
    setActiveDrawingPoints((prev) => [...prev, pt]);
  };

  // Complete / Close Polygon
  const handleCompleteDrawing = () => {
    if (activeDrawingPoints.length < 3) {
      alert(
        isBn
          ? 'দাগের সীমানা তৈরি করতে কমপক্ষে ৩টি কোণ (Vertices) প্রয়োজন।'
          : 'At least 3 corner points are required to form a dag boundary.'
      );
      return;
    }
    setNewDagNo(currentMap?.defaultDagNo || `${(currentMap?.digitizedDags?.length || 0) + 314}`);
    setShowSaveDagDialog(true);
  };

  // Save new Digitized Dag
  const handleSaveDag = () => {
    if (!currentMap) return;
    if (!newDagNo.trim()) {
      alert(isBn ? 'অনুগ্রহ করে দাগ নম্বর লিখুন' : 'Please enter plot/dag number');
      return;
    }

    const scale = currentMap.scalePixelsPerFoot || 1.2;
    const area = calculateDagPolygonArea(activeDrawingPoints, scale);

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const randomColor = colors[(currentMap.digitizedDags?.length || 0) % colors.length];

    const newDag: DigitizedDagRecord = {
      id: `dag-${Date.now()}`,
      dagNo: newDagNo.trim(),
      mouzaMapId: currentMap.id,
      points: activeDrawingPoints.map((p, idx) => ({
        id: `p-${idx}`,
        x: p.x,
        y: p.y,
        sourceType: 'digitized',
        label: `P${idx + 1}`,
      })),
      areaSqFt: area.areaSqFt,
      areaDecimal: area.areaDecimal,
      areaKatha: area.areaKatha,
      areaBigha: area.areaBigha,
      perimeterFt: area.perimeterFt,
      notes: newDagNotes.trim() || undefined,
      color: randomColor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedMap: MouzaMapRecord = {
      ...currentMap,
      digitizedDags: [...(currentMap.digitizedDags || []), newDag],
      updatedAt: Date.now(),
    };

    saveMouzaMapToStorage(updatedMap);
    setMouzaMaps(getStoredMouzaMaps());
    setSelectedDagId(newDag.id);
    setIsDrawingMode(false);
    setActiveDrawingPoints([]);
    setShowSaveDagDialog(false);

    setNotificationMsg(
      isBn ? `নতুন দাগ ${newDag.dagNo} সফলভাবে যুক্ত হয়েছে!` : `Plot #${newDag.dagNo} saved successfully!`
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Delete Dag
  const handleDeleteDag = (dagId: string) => {
    if (!currentMap) return;
    if (
      window.confirm(
        isBn
          ? 'আপনি কি নিশ্চিত এই ডিজিটাইজড দাগটি মুছে ফেলতে চান?'
          : 'Are you sure you want to delete this digitized plot?'
      )
    ) {
      const updatedMap: MouzaMapRecord = {
        ...currentMap,
        digitizedDags: currentMap.digitizedDags.filter((d) => d.id !== dagId),
        updatedAt: Date.now(),
      };
      saveMouzaMapToStorage(updatedMap);
      setMouzaMaps(getStoredMouzaMaps());
      setSelectedDagId(null);
    }
  };

  // Import Complete Handler
  const handleImportComplete = (record: MouzaMapRecord) => {
    saveMouzaMapToStorage(record);
    const updated = getStoredMouzaMaps();
    setMouzaMaps(updated);
    setSelectedMapId(record.id);
    setShowImportModal(false);

    setNotificationMsg(
      isBn ? 'নতুন মৌজা ম্যাপ সফলভাবে সংরক্ষিত হয়েছে!' : 'New Mouza map imported successfully!'
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const canvasDags = useMemo(() => {
    const dags = [...(currentMap?.digitizedDags || [])];
    if (isFieldBoundaryEditMode && fieldBoundaryPoints.length > 0) {
      dags.push({
        id: 'field-boundary',
        dagNo: 'Field',
        mouzaMapId: currentMap?.id || '',
        points: fieldBoundaryPoints,
        color: '#f59e0b',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return dags;
  }, [currentMap, isFieldBoundaryEditMode, fieldBoundaryPoints]);

  // Map Metadata for Canvas
  const canvasMetadata: MouzaMapMetadata = useMemo(() => {
    if (!currentMap) return {};
    return {
      title: currentMap.title,
      mouza: currentMap.mouza,
      jlNo: currentMap.jlNo,
      sheetNo: '০১',
      surveyType: 'RS / CS',
      district: currentMap.district,
      upazila: currentMap.upazila,
      scaleText: '১৬" = ১ মাইল',
    };
  }, [currentMap]);

  const handleOpenRestoredProject = (project: ComparativePentagraphProject) => {
    // 1. Select the DAG
    if (onNavigateToSurvey) onNavigateToSurvey(); // Fallback if onSelectDag is not passed
    // 2. Restore Field Boundary
    setFieldBoundaryPoints(project.demarcationSurveyedPoints || []);
    // 3. Enable Demarcation View
    setIsFieldBoundaryEditMode(true);
    setIsDemarcationView(true);
    setNotificationMsg(isBn ? 'ডিমারকেশন প্রজেক্ট সফলভাবে পুনরুদ্ধার হয়েছে!' : 'Demarcation project restored!');
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleCenterOnSelectedParcel = () => {
    setFitViewTrigger((prev) => prev + 1);
  };

  return (
    <div id="mouza-map-screen" className="space-y-3 pb-12 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Bar: Navigation, Map Title, Import & More Tools */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
        {!hideBackButton && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBn ? 'হোম' : 'Home'}</span>
          </button>
        )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                {currentMap?.title || (isBn ? 'মৌজা নকশা ও দাগ' : 'Mouza & Dag Workspace')}
              </h2>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                {isBn ? 'টাচ-ফ্রেন্ডলি' : 'Touch Workspace'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {currentMap?.mouza && `${isBn ? 'মৌজা: ' : 'M: '}${currentMap.mouza}, `}
              {currentMap?.jlNo && `${isBn ? 'জে.এল: ' : 'JL: '}${currentMap.jlNo}, `}
              {currentMap?.district && `${isBn ? 'জেলা: ' : 'D: '}${currentMap.district}`}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-800" />
            <span>{isBn ? 'ম্যাপ আপলোড' : 'Upload'}</span>
          </button>

          {!isDrawingMode ? (
            <button
              onClick={() => {
                setActiveTab('map');
                setIsDrawingMode(true);
                setActiveDrawingPoints([]);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'নতুন দাগ আঁকুন' : 'Trace Dag'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCompleteDrawing}
                disabled={activeDrawingPoints.length < 3}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isBn ? 'সমাপ্ত' : 'Finish'}</span>
              </button>
              <button
                onClick={() => {
                  setIsDrawingMode(false);
                  setActiveDrawingPoints([]);
                }}
                className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          )}

          {/* More Tools Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowMoreToolsMenu(!showMoreToolsMenu)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title={isBn ? 'আরও টুলস' : 'More Tools'}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMoreToolsMenu && (
              <div className="absolute right-0 top-10 z-40 w-48 p-2 rounded-2xl bg-white border border-slate-200 shadow-xl space-y-1 text-xs font-bold animate-fadeIn">
                <button
                  onClick={() => {
                    setActiveTab('map_joint');
                    setShowMoreToolsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                >
                  <MapIcon className="w-3.5 h-3.5 text-emerald-800" />
                  <span>{isBn ? 'ম্যাপ জয়েন্ট' : 'Map Joint'}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('advanced_verification');
                    setShowMoreToolsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                >
                  <Scale className="w-3.5 h-3.5 text-indigo-700" />
                  <span>{isBn ? 'উন্নত ৩-মুখী যাচাই' : 'Advanced Verification'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowCatalogModal(true);
                    setShowMoreToolsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isBn ? 'নকশা ক্যাটালগ' : 'Map Catalog'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowDataImportModal(true);
                    setShowMoreToolsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                >
                  <Database className="w-3.5 h-3.5 text-emerald-800" />
                  <span>{isBn ? 'মৌজা ডেটাবেস' : 'Mouza Database'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. Primary 5-Step Workflow Tabs (Requirement 1: Mobile-First Tabs) */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto shadow-2xs">
        {/* Tab 1: ম্যাপ (Map) */}
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap flex-1 sm:flex-initial ${
            activeTab === 'map'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>১. {isBn ? 'ম্যাপ' : 'Map'}</span>
        </button>

        {/* Tab 2: দাগ নির্বাচন (Dag Selection) */}
        <button
          onClick={() => setActiveTab('dag_select')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap flex-1 sm:flex-initial ${
            activeTab === 'dag_select'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>২. {isBn ? 'দাগ নির্বাচন' : 'Dags'}</span>
          {currentMap?.digitizedDags && currentMap.digitizedDags.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'dag_select' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {currentMap.digitizedDags.length}
            </span>
          )}
        </button>

        {/* Tab 3: পরিমাপ (Measurement) */}
        <button
          onClick={() => setActiveTab('measurement')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap flex-1 sm:flex-initial ${
            activeTab === 'measurement'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>৩. {isBn ? 'পরিমাপ' : 'Measure'}</span>
        </button>

        {/* Tab 4: তুলনামূলক পেন্টাগ্রাফ (Comparative Pentagraph) */}
        <button
          onClick={() => setActiveTab('pentagraph')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap flex-1 sm:flex-initial ${
            activeTab === 'pentagraph'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>৪. {isBn ? 'তুলনামূলক নকশা ও সীমানা' : 'Demarcation & Pentagraph'}</span>
        </button>

        {/* Tab 5: রিপোর্ট (Report) */}
        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap flex-1 sm:flex-initial ${
            activeTab === 'report'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>৫. {isBn ? 'রিপোর্ট' : 'Report'}</span>
        </button>
      </div>

      {/* Professional Service Disclaimer & Quality Assurance */}
      <ProfessionalServiceDisclaimer lang={lang} variant="card" showVerificationBadges={true} collapsible={true} />

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: ম্যাপ (Full Interactive Cadastral Canvas) */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'map' && (
        <div className="space-y-3">
          {/* Quick Bar: Select Sheet + Edit Mode Toggle */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">{isBn ? 'মৌজা নকশা:' : 'Sheet:'}</span>
              <select
                value={selectedMapId}
                onChange={(e) => setSelectedMapId(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 max-w-[200px] truncate"
              >
                {filteredMaps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.mouza})
                  </option>
                ))}
              </select>

              {/* Simple Professional Measurement Tool Button ("মাপুন") */}
              <button
                type="button"
                onClick={() => setIsCanvasMeasureMode(!isCanvasMeasureMode)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition active:scale-95 cursor-pointer ${
                  isCanvasMeasureMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300 shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
                title={isBn ? 'নকশায় দূরত্ব ও ক্ষেত্রফল পরিমাপ (ফুট / লিঙ্ক)' : 'Measure on Map (Feet / Link)'}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>
                  {isCanvasMeasureMode
                    ? (isBn ? 'মাপুন (চালু)' : 'Measure (ON)')
                    : (isBn ? 'মাপুন' : 'Measure')}
                </span>
              </button>
            </div>

            {selectedDag && !isDrawingMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsDemarcationView(!isDemarcationView);
                    if (!isDemarcationView && !isFieldBoundaryEditMode) {
                        setFieldBoundaryPoints(selectedDag?.points || []);
                        setIsFieldBoundaryEditMode(true);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition active:scale-95 ${
                    isDemarcationView
                      ? 'bg-sky-600 hover:bg-sky-700 text-white ring-2 ring-sky-300'
                      : 'bg-sky-100 hover:bg-sky-200 text-sky-900'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>
                    {isDemarcationView
                      ? (isBn ? '❌ ডিমারকেশন ভিউ বন্ধ' : '❌ Stop Demarcation')
                      : (isBn ? '⚖️ ডিমারকেশন ভিউ' : '⚖️ Demarcation View')}
                  </span>
                </button>
                <button
                  onClick={() => setIsVertexEditMode(!isVertexEditMode)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition active:scale-95 ${
                    isVertexEditMode
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>
                    {isVertexEditMode
                      ? (isBn ? '✏️ এডিট মোড (চালু)' : '✏️ Edit Mode (ON)')
                      : (isBn ? 'সীমানা এডিট করুন' : 'Edit Boundary')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('pentagraph')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 font-bold transition active:scale-95 cursor-pointer shadow-2xs"
                  title={isBn ? 'দাগের সীমানা ও দখল তুলনা করুন' : 'Compare Dag & Occupied Boundary'}
                >
                  <Compass className="w-3.5 h-3.5 text-purple-700" />
                  <span>{isBn ? 'তুলনা/সীমানা' : 'Compare / Demarcate'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('measurement')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-bold transition"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>{isBn ? 'পরিমাপ দেখুন' : 'Measurements'}</span>
                </button>
              </div>
            )}
          </div>

              {/* Comparison Metrics UI */}
        {selectedDag && (isFieldBoundaryEditMode || isDemarcationView) && fieldBoundaryPoints.length > 0 && (
          <div className="p-3 mt-2 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Compass className="w-4 h-4" />
              <span>{isBn ? 'তুলনামূলক সীমানা পার্থক্য' : 'Boundary Comparison'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>{isBn ? 'ক্ষেত্রফল পার্থক্য:' : 'Area Diff:'} {demarcationVariance.areaDiffDecimal} {isBn ? 'শতাংশ' : 'Dec'}</div>
              <div>{isBn ? 'পরিসীমা পার্থক্য:' : 'Perimeter Diff:'} {demarcationVariance.perimDiffLk} {isBn ? 'লিঙ্ক' : 'lk'}</div>
              <div className="col-span-2">{isBn ? 'কেন্দ্রের বিচ্যুতি:' : 'Centroid Offset:'} {demarcationVariance.centroidOffsetLk} {isBn ? 'লিঙ্ক' : 'lk'} ({demarcationVariance.displacementDirectionBn})</div>
            </div>
            <button
              onClick={handleSavePentagraphProject}
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্রজেক্ট সেভ করুন' : 'Save Project'}</span>
            </button>
          </div>
        )}

        {/* Vertex Edit Control Toolbar for selected Dag or Field Boundary */}
          {(selectedDag || isFieldBoundaryEditMode) && isVertexEditMode && !isDrawingMode && (
            <VertexEditToolbar
              isEditMode={isVertexEditMode}
              tracingInteractionMode={tracingInteractionMode}
              onTracingInteractionModeChange={setTracingInteractionMode}
              onToggleEditMode={() => setIsVertexEditMode(!isVertexEditMode)}
              canUndo={vertexUndoStack.length > 0}
              canRedo={vertexRedoStack.length > 0}
              onUndo={handleVertexUndo}
              onRedo={handleVertexRedo}
              isSnapEnabled={isSnapEnabled}
              onToggleSnap={() => setIsSnapEnabled(!isSnapEnabled)}
              isEdited={isCurrentDagEdited}
              onResetToOriginal={handleResetToOriginal}
              metrics={currentMetrics}
              totalPoints={activeEditPoints.length}
              lang={lang}
              onSaveEdits={handleSaveDagEdits}
              onFitView={handleCenterOnSelectedParcel}
            />
          )}

          {/* Canvas Component */}
          <MouzaCanvas
            backgroundImageUrl={resolvedCanvasBgUrl || currentMap?.fileDataUrl}
            sourceType={currentMap?.sourceType}
            digitizedDags={canvasDags}
            selectedDagId={selectedDagId}
            isFieldBoundaryEditMode={isFieldBoundaryEditMode}
            isDemarcationView={isDemarcationView}
            tracingInteractionMode={tracingInteractionMode}
            fitViewTrigger={fitViewTrigger}
            activeDrawingPoints={activeDrawingPoints}
            isDrawingMode={isDrawingMode}
            showGpsOverlay={showGpsOverlay}
            gpsSurveyPoints={currentGpsPoints}
            selectedSurvey={activeGpsSurveyRecord}
            lang={lang}
            onCanvasClick={handleCanvasClick}
            onSelectDag={(dagId) => setSelectedDagId(dagId)}
            scalePixelsPerFoot={currentMap?.scalePixelsPerFoot || 1.2}
            mapMetadata={canvasMetadata}
            isVertexEditMode={isVertexEditMode}
            activeEditPoints={activeEditPoints}
            selectedVertexIndex={selectedVertexIndex}
            isSnapEnabled={isSnapEnabled}
            snapResult={snapResult}
            segments={currentSegments}
            onSelectVertex={(idx) => setSelectedVertexIndex(idx)}
            onVertexDrag={handlePointDrag}
            onVertexDragEnd={handlePointDragEnd}
            onAddVertexOnSegment={handleAddVertexOnSegment}
            isMeasureMode={isCanvasMeasureMode}
            onToggleMeasureMode={setIsCanvasMeasureMode}
          />

          {/* Precision Vertex Inspector when a vertex is tapped */}
          {isVertexEditMode && selectedVertexIndex !== null && activeEditPoints[selectedVertexIndex] && (
            <VertexEditInspector
              point={activeEditPoints[selectedVertexIndex]}
              pointIndex={selectedVertexIndex}
              totalPoints={activeEditPoints.length}
              prevSegment={
                currentSegments[
                  (selectedVertexIndex - 1 + activeEditPoints.length) % activeEditPoints.length
                ]
              }
              nextSegment={currentSegments[selectedVertexIndex % activeEditPoints.length]}
              lang={lang}
              onNudge={handleNudge}
              onDelete={handleDeleteVertex}
              onClose={() => setSelectedVertexIndex(null)}
            />
          )}

          {/* Floating Quick Dag Card on Bottom of Canvas */}
          {selectedDag && (
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedDag.color || '#10b981' }}
                />
                <div>
                  <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
                    <span>{isBn ? `দাগ নং ${selectedDag.dagNo}` : `Plot #${selectedDag.dagNo}`}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                      {currentMetrics.areaDecimal} {isBn ? 'শতাংশ' : 'Dec'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {currentMetrics.areaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'} • {isBn ? 'পরিসীমা' : 'Perimeter'} {currentMetrics.perimeterFt} {isBn ? 'ফুট' : 'ft'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('measurement')}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-900 transition"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>{isBn ? 'পরিমাপ বিস্তারিত' : 'Measure Details'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('pentagraph')}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 transition"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{isBn ? 'পেন্টাগ্রাফ তুলনা' : 'Pentagraph'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: দাগ নির্বাচন (Dag Selection & Tracing) */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'dag_select' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Left Column: Search & Dag List */}
          <div className="md:col-span-1 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Layers className="w-4 h-4 text-emerald-800" />
                <span>{isBn ? 'ডিজিটাইজড দাগ তালিকা' : 'Digitized Dags'}</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {currentMap?.digitizedDags?.length || 0} {isBn ? 'টি দাগ' : 'dags'}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'দাগ নম্বর খুঁজুন...' : 'Search plot number...'}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
              />
            </div>

            {/* Dags List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {(!currentMap?.digitizedDags || currentMap.digitizedDags.length === 0) ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-2">
                  <p>{isBn ? 'এই মৌজায় কোনো ডিজিটাইজড দাগ নেই।' : 'No digitized dags yet.'}</p>
                  <button
                    onClick={() => {
                      setActiveTab('map');
                      setIsDrawingMode(true);
                      setActiveDrawingPoints([]);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 text-white font-bold text-xs shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isBn ? 'নতুন দাগ ট্রেস করুন' : 'Trace New Dag'}</span>
                  </button>
                </div>
              ) : (
                currentMap.digitizedDags.map((dag) => {
                  const isSelected = selectedDagId === dag.id;
                  return (
                    <div
                      key={dag.id}
                      onClick={() => setSelectedDagId(dag.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-500 shadow-2xs ring-1 ring-emerald-400'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: dag.color || '#10b981' }}
                          />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {isBn ? `দাগ নং ${dag.dagNo}` : `Plot #${dag.dagNo}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          {dag.areaDecimal} {isBn ? 'শতক' : 'Dec'} • {dag.areaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDagId(dag.id);
                            setActiveTab('measurement');
                          }}
                          className="p-1 rounded-lg text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 transition"
                          title={isBn ? 'পরিমাপ দেখুন' : 'Measurements'}
                        >
                          <Ruler className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDagId(dag.id);
                            setActiveTab('pentagraph');
                          }}
                          className="p-1 rounded-lg text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 transition"
                          title={isBn ? 'তুলনামূলক পেন্টাগ্রাফ' : 'Pentagraph'}
                        >
                          <Compass className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDag(dag.id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title={isBn ? 'দাগ মুছুন' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right 2 Columns: Selected Dag Inspector & Field Verification Card */}
          <div className="md:col-span-2 space-y-3">
            {selectedDag ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                      {isBn ? 'নির্বাচিত দাগের তথ্য' : 'Selected Plot'}
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-0.5">
                      {isBn ? `দাগ নং ${selectedDag.dagNo}` : `Plot #${selectedDag.dagNo}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isBn
                        ? `মোট ${selectedDag.points?.length || 0}টি শীর্ষবিন্দু দ্বারা সীমাবদ্ধ বহুভুজ ক্ষেত্র`
                        : `Polygon bounded by ${selectedDag.points?.length || 0} corner points`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveTab('map');
                        setIsVertexEditMode(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-xs hover:bg-amber-400 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{isBn ? 'পয়েন্ট এডিট' : 'Edit Vertices'}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('measurement')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-800 text-white font-bold text-xs shadow-xs hover:bg-emerald-900 transition"
                    >
                      <Ruler className="w-3.5 h-3.5" />
                      <span>{isBn ? 'পরিমাপ দেখুন' : 'Measurements'}</span>
                    </button>
                  </div>
                </div>

                <DagVerificationCard
                  dag={selectedDag}
                  gpsSurvey={activeGpsSurveyRecord}
                  activeGpsAreaSqFt={activeGpsAreaSqFt}
                  lang={lang}
                  onOpenPentagraph={() => setActiveTab('pentagraph')}
                  onOpenAdvancedVerification={() => setActiveTab('advanced_verification')}
                />
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700">
                  {isBn ? 'বাম থেকে একটি দাগ নির্বাচন করুন' : 'Select a plot from the left list'}
                </p>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'অথবা উপরে "নতুন দাগ আঁকুন" বাটনে ক্লিক করে নকশায় নতুন সীমানা ট্রেস করুন।'
                    : 'Or click "Trace Dag" to create a new boundary polygon.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: পরিমাপ (Comprehensive Dag Measurement Workspace) */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'measurement' && (
        <DagMeasurementWorkspace
          currentMap={currentMap}
          selectedDag={selectedDag}
          activeEditPoints={activeEditPoints}
          currentMetrics={currentMetrics}
          currentSegments={currentSegments}
          scale={scale}
          lang={lang}
          isEdited={isCurrentDagEdited}
          onSaveEdits={handleSaveDagEdits}
          onOpenReport={onOpenReport}
          onSwitchToCanvas={() => setActiveTab('map')}
          onSwitchToDagSelect={() => setActiveTab('dag_select')}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 4: তুলনামূলক পেন্টাগ্রাফ (Comparative Pentagraph) */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'pentagraph' && (
        <ComparativePentagraph
          lang={lang}
          currentMap={currentMap}
          selectedDag={selectedDag}
          surveys={surveys}
          activeGpsPoints={activeGpsPoints}
          onOpenReport={onOpenReport}
          onSelectDag={(dagId) => setSelectedDagId(dagId)}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 5: রিপোর্ট (Survey & Dag Report Card Preview) */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'report' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                  {isBn ? 'সার্ভে ও ক্যাডাস্ট্রাল সারসংক্ষেপ রিপোর্ট' : 'Survey Summary Report'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {currentMap?.title || (isBn ? 'মৌজা নকশা ও দাগ পরিমাপ' : 'Mouza Survey Report')}
                </h3>
                <p className="text-xs text-slate-500">
                  {isBn ? 'জরিপকারী ও আমিনের প্রত্যয়ন ও ডিজিটাল পরিমাপ প্রতিবেদন' : 'Digital land verification summary'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={printWithNoto}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                </button>

                {onOpenReport && (
                  <button
                    onClick={() => onOpenReport(activeGpsSurveyRecord?.id || selectedDag?.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isBn ? 'এ৪ পূর্ণাঙ্গ সার্ভে রিপোর্ট' : 'Open Full A4 Report'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cadastral Land Sheet Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">{isBn ? 'মৌজা' : 'Mouza'}</span>
                <span className="font-bold text-slate-900 text-sm">{currentMap?.mouza || 'চকবস্তা'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">{isBn ? 'জে.এল. নং' : 'J.L. No'}</span>
                <span className="font-bold text-slate-900 text-sm">{currentMap?.jlNo || '০৮'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">{isBn ? 'দাগ নম্বর' : 'Plot / Dag'}</span>
                <span className="font-bold text-emerald-800 text-sm">{selectedDag ? selectedDag.dagNo : '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">{isBn ? 'উপজেলা ও জেলা' : 'Location'}</span>
                <span className="font-bold text-slate-900 text-sm">{currentMap?.upazila || currentMap?.district || 'ঢাকা'}</span>
              </div>
            </div>

            {/* Calculated Area Table */}
            {selectedDag && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  {isBn ? 'পরিমাপকৃত ক্ষেত্রফলের বিবরণ (Area Breakdown)' : 'Area Measurements'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">{isBn ? 'শতাংশ / শতক' : 'Decimal'}</span>
                    <strong className="text-sm font-black text-emerald-900">{currentMetrics.areaDecimal}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">{isBn ? 'বর্গফুট' : 'Sq. Feet'}</span>
                    <strong className="text-sm font-black text-slate-900">{currentMetrics.areaSqFt}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">{isBn ? 'কাঠা' : 'Katha'}</span>
                    <strong className="text-sm font-black text-slate-900">{currentMetrics.areaKatha}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">{isBn ? 'বিঘা' : 'Bigha'}</span>
                    <strong className="text-sm font-black text-slate-900">{currentMetrics.areaBigha}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">{isBn ? 'একর' : 'Acre'}</span>
                    <strong className="text-sm font-black text-slate-900">{currentMetrics.areaAcre}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Side Lengths Breakdown */}
            {selectedDag && currentSegments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800">
                  {isBn ? 'বহুভুজ সীমানা বাহু পরিমাপ' : 'Boundary Segment Dimensions'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {currentSegments.map((seg, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                      <span className="text-slate-600 font-bold">{isBn ? `বাহু ${idx + 1}` : `Side ${idx + 1}`}:</span>
                      <strong className="text-slate-900">{seg.lengthFt} {isBn ? 'ফুট' : 'ft'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Sub-Workspaces: Map Joint */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'map_joint' && (
        <MapJointWorkspace
          lang={lang}
          allMaps={mouzaMaps}
          currentMap={currentMap}
          onOpenPentagraph={() => setActiveTab('pentagraph')}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Sub-Workspaces: Advanced Verification */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'advanced_verification' && (
        <AdvancedVerificationView
          lang={lang}
          selectedDag={selectedDag}
          surveys={surveys}
          activeGpsPointsCount={activeGpsPoints.length}
          activeGpsAreaSqFt={activeGpsAreaSqFt}
          onOpenReport={onOpenReport}
          onSwitchToPentagraph={() => setActiveTab('pentagraph')}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Save Dag Dialog Modal */}
      {/* -------------------------------------------------------------------- */}
      {showSaveDagDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'ডিজিটাইজড দাগ সংরক্ষণ' : 'Save Digitized Dag'}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'দাগ নম্বর (Plot / Dag No.) *' : 'Plot / Dag No. *'}
                </label>
                <input
                  type="text"
                  value={newDagNo}
                  onChange={(e) => setNewDagNo(e.target.value)}
                  placeholder={isBn ? 'উদা: ৩১২' : 'e.g. 312'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'মন্তব্য বা জমির বিবরণ' : 'Notes / Description'}
                </label>
                <textarea
                  value={newDagNotes}
                  onChange={(e) => setNewDagNotes(e.target.value)}
                  rows={2}
                  placeholder={isBn ? 'জমির অবস্থান, সীমানা বিবরণ ইত্যাদি...' : 'Plot details, boundary notes...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                {isBn
                  ? `মোট ${activeDrawingPoints.length}টি কোণ চিহ্নিত হয়েছে। সংরক্ষণ করলে স্বয়ংক্রিয়ভাবে ক্ষেত্রফল নির্ণয় হবে।`
                  : `${activeDrawingPoints.length} corners marked. Area will be computed on save.`}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveDagDialog(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveDag}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition active:scale-95"
              >
                {isBn ? 'সংরক্ষণ করুন' : 'Save Dag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Mouza Sheet Modal */}
      {showImportModal && (
        <MouzaImportModal
          lang={lang}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
          initialLocation={
            currentMap
              ? {
                  districtNameBn: currentMap.district,
                  upazilaNameBn: currentMap.upazila,
                  mouzaNameBn: currentMap.mouza,
                  jlNo: currentMap.jlNo,
                }
              : undefined
          }
        />
      )}

      {/* Scanned Mouza Map Catalog Modal */}
      {showCatalogModal && (
        <ScannedMapCatalogModal
          lang={lang}
          onClose={() => setShowCatalogModal(false)}
          onSelectMap={(catRecord) => {
            setShowCatalogModal(false);
            const existing = mouzaMaps.find(
              (m) => m.mouza === catRecord.mouzaNameBn && m.jlNo === catRecord.jlNo
            );
            if (existing) {
              setSelectedMapId(existing.id);
            } else {
              const newRec: MouzaMapRecord = {
                id: `cat-${catRecord.id}`,
                title: catRecord.mapTitle,
                district: catRecord.districtNameBn || (catRecord as any).district || 'ঢাকা',
                upazila: catRecord.upazilaNameBn || (catRecord as any).upazila || catRecord.mouzaNameBn,
                mouza: catRecord.mouzaNameBn,
                jlNo: catRecord.jlNo,
                sourceType:
                  catRecord.fileType === 'pdf' || catRecord.originalFileName?.toLowerCase().endsWith('.pdf')
                    ? 'pdf'
                    : 'image',
                fileName: catRecord.originalFileName,
                fileDataUrl: catRecord.fileReference || catRecord.storageUrl || (catRecord as any).fileRef,
                scalePixelsPerFoot: catRecord.scalePixelsPerFoot || 1.2,
                digitizedDags: [],
                notes: `${catRecord.surveyType} সার্ভে নকশা ক্যাটালগ রেকর্ড`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              saveMouzaMapToStorage(newRec);
              setMouzaMaps(getStoredMouzaMaps());
              setSelectedMapId(newRec.id);
            }
          }}
        />
      )}

      {/* Admin Mouza Dataset Import & Management Modal */}
      {showDataImportModal && (
        <MouzaDataImportModal
          lang={lang}
          onClose={() => setShowDataImportModal(false)}
        />
      )}
    </div>
  );
};
