import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Layers,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Edit3,
  Trash2,
  Plus,
  Save,
  FileText,
  Eye,
  Sliders,
  Maximize2,
  Info,
  ShieldCheck,
  Check,
  SplitSquareVertical,
  Move,
  FileUp,
  Crosshair,
  MousePointer,
  AlertCircle,
} from 'lucide-react';
import {
  Language,
  SketchRecord,
  SketchDetectionData,
  SketchDigitalDrawing,
  DetectedPoint,
  DetectedLine,
  DetectedDimension,
  DetectedLabel,
  DetectedFeature,
  DetectedNorthArrow,
  SurveyRecord,
  SurveyPoint,
  DrawingAnnotation,
} from '../types';
import {
  getStoredSketches,
  saveSketchRecord,
  deleteSketchRecord,
  convertSketchToSurveyRecord,
  calculateSketchPolygonMetrics,
  defaultVisionProvider,
  SKETCH_LEGAL_DISCLAIMER_BN,
  SKETCH_LEGAL_DISCLAIMER_EN,
} from '../lib/sketch-drawing-service';
import { useAuth } from '../contexts/AuthContext';
import { roundClean, LAND_CONSTANTS } from '../lib/land-units';

interface SketchToDrawingScreenProps {
  lang: Language;
  onBack: () => void;
  onOpenDigitalDrawing?: (surveyRecord: SurveyRecord) => void;
  onOpenReport?: (surveyId: string) => void;
  onNavigateToSurvey?: () => void;
}

type WorkflowStep = 'upload' | 'analyzing' | 'review' | 'saved';
type ViewMode = 'split' | 'overlay' | 'digital_only' | 'sketch_only';

export const SketchToDrawingScreen: React.FC<SketchToDrawingScreenProps> = ({
  lang,
  onBack,
  onOpenDigitalDrawing,
  onOpenReport,
  onNavigateToSurvey,
}) => {
  const isBn = lang === 'bn';
  const { currentUser, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Workflow State
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.65);

  // Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);

  // Saved Sketches List Drawer / View
  const [savedSketches, setSavedSketches] = useState<SketchRecord[]>(() => getStoredSketches());
  const [selectedSketchId, setSelectedSketchId] = useState<string | null>(null);

  // AI & Detection State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'integration_ready' | 'analyzed' | 'not_configured'>('integration_ready');

  // Editable Geometry State (Human Review)
  const [points, setPoints] = useState<DetectedPoint[]>([]);
  const [lines, setLines] = useState<DetectedLine[]>([]);
  const [dimensions, setDimensions] = useState<DetectedDimension[]>([]);
  const [labels, setLabels] = useState<DetectedLabel[]>([]);
  const [northAngle, setNorthAngle] = useState<number>(0);
  const [features, setFeatures] = useState<DetectedFeature[]>([]);

  // Metadata Form
  const [mouza, setMouza] = useState<string>('দক্ষিণ মৌজা');
  const [dagNo, setDagNo] = useState<string>('১২২');
  const [khatianNo, setKhatianNo] = useState<string>('৮৮');
  const [clientName, setClientName] = useState<string>('');
  const [surveyorName, setSurveyorName] = useState<string>(currentUser?.displayName || 'সার্ভেয়ার আমিন');
  const [reviewerNotes, setReviewerNotes] = useState<string>('');
  const [isApproved, setIsApproved] = useState<boolean>(false);

  // Canvas Interaction State
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [activeDraggingPointId, setActiveDraggingPointId] = useState<string | null>(null);
  const [newPointMode, setNewPointMode] = useState<boolean>(false);
  const [canvasScale, setCanvasScale] = useState<number>(1);
  const [reviewWarning, setReviewWarning] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync saved sketches when storage changes
  useEffect(() => {
    const handleSync = () => setSavedSketches(getStoredSketches());
    window.addEventListener('sketch_storage_updated', handleSync);
    return () => window.removeEventListener('sketch_storage_updated', handleSync);
  }, []);

  // Compute live area metrics from current polygon points
  const areaMetrics = useMemo(() => {
    if (points.length < 3) {
      return { areaSqFt: 0, perimeterFt: 0, decimal: 0, katha: 0, bigha: 0 };
    }
    return calculateSketchPolygonMetrics(points, 0.25);
  }, [points]);

  // Provenance & Confidence summary stats
  const provenanceStats = useMemo(() => {
    let aiCount = 0;
    let correctedCount = 0;
    let addedCount = 0;
    let totalConf = 0;
    let confCount = 0;

    const items = [
      ...points.map((p) => ({ prov: p.provenance || 'ai_detected', conf: p.confidence })),
      ...lines.map((l) => ({ prov: l.provenance || 'ai_detected', conf: l.confidence })),
      ...dimensions.map((d) => ({ prov: d.provenance || 'ai_detected', conf: d.confidence })),
      ...labels.map((lb) => ({ prov: lb.provenance || 'ai_detected', conf: lb.confidence })),
    ];

    items.forEach((item) => {
      if (item.prov === 'ai_detected') aiCount++;
      else if (item.prov === 'user_corrected') correctedCount++;
      else if (item.prov === 'user_added') addedCount++;

      if (typeof item.conf === 'number' && item.conf > 0) {
        totalConf += item.conf;
        confCount++;
      }
    });

    const avgConfidence = confCount > 0 ? Math.round((totalConf / confCount) * 100) : 92;

    return {
      aiCount,
      correctedCount,
      addedCount,
      avgConfidence,
      total: items.length,
    };
  }, [points, lines, dimensions, labels]);

  // Handle Image File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    setFileError(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setFileError(
        isBn
          ? 'শুধুমাত্র JPG, JPEG বা PNG ফরম্যাটের খসড়া নকশার ছবি আপলোড করুন।'
          : 'Only JPG, JPEG, or PNG format drawings are supported.'
      );
      return;
    }

    // Limit to 15MB
    if (file.size > 15 * 1024 * 1024) {
      setFileError(
        isBn ? 'ছবির সাইজ ১৫ মেগাবাইটের বেশি হতে পারবে না।' : 'File size must not exceed 15MB.'
      );
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      setImageUrl(result);

      // Extract image dimensions
      const img = new window.Image();
      img.onload = () => {
        setImageMeta({ width: img.width, height: img.height });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Remove / Reset Uploaded Image
  const handleRemoveImage = () => {
    setImageFile(null);
    setImageUrl(null);
    setImageMeta(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setCurrentStep('upload');
  };

  // Initialize Sample Field Sketch for quick demonstration
  const handleLoadSampleSketch = () => {
    // A clean SVG data-url representing a typical Bangladeshi field-book hand-drawn plot
    const sampleSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23faf8f5">
      <rect width="800" height="600" fill="%23fdfbf7"/>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="%23e5e0d8" stroke-width="0.8"/>
      </pattern>
      <rect width="800" height="600" fill="url(%23grid)"/>
      <text x="50" y="50" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23292524">মৌজা: দক্ষিণবাগ, দাগ নং ১২২ (খসড়া ফিল্ড স্কেচ)</text>
      <!-- Pencil Drawn Boundary -->
      <polygon points="180,140 620,160 580,440 220,410" fill="none" stroke="%2344403c" stroke-width="3.5" stroke-dasharray="2,2"/>
      <!-- Pencil Corner Points -->
      <circle cx="180" cy="140" r="6" fill="%231c1917"/>
      <text x="160" y="130" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231c1917">A (উত্তর-পশ্চিম)</text>
      <circle cx="620" cy="160" r="6" fill="%231c1917"/>
      <text x="630" y="155" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231c1917">B (উত্তর-পূর্ব)</text>
      <circle cx="580" cy="440" r="6" fill="%231c1917"/>
      <text x="590" y="460" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231c1917">C (দক্ষিণ-পূর্ব)</text>
      <circle cx="220" cy="410" r="6" fill="%231c1917"/>
      <text x="180" y="435" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231c1917">D (দক্ষিণ-পশ্চিম)</text>
      <!-- Dimension Notes in Bengali -->
      <text x="380" y="135" font-family="sans-serif" font-size="13" fill="%2344403c">উত্তরে: ১১০ ফুট</text>
      <text x="615" y="300" font-family="sans-serif" font-size="13" fill="%2344403c">পূর্বে: ৭৫ ফুট</text>
      <text x="370" y="445" font-family="sans-serif" font-size="13" fill="%2344403c">দক্ষিণে: ১০৫ ফুট</text>
      <text x="145" y="280" font-family="sans-serif" font-size="13" fill="%2344403c">পশ্চিমে: ৮০ ফুট</text>
      <!-- North Arrow Sketch -->
      <line x1="720" y1="120" x2="720" y2="60" stroke="%231c1917" stroke-width="2.5"/>
      <polygon points="720,50 714,65 726,65" fill="%231c1917"/>
      <text x="715" y="45" font-family="sans-serif" font-size="14" font-weight="bold" fill="%231c1917">N</text>
      <!-- Adjoining feature -->
      <rect x="180" y="460" width="400" height="30" fill="%23e7e5e4" stroke="%23a8a29e" stroke-width="1.5"/>
      <text x="340" y="480" font-family="sans-serif" font-size="12" fill="%2357534e">কাঁচা রাস্তা (১০ ফুট)</text>
    </svg>`;

    setImageUrl(sampleSvg);
    setImageMeta({ width: 800, height: 600 });
    setFileError(null);
  };

  // Run AI Analysis Workflow
  const handleAnalyzeSketch = async () => {
    if (!imageUrl) return;

    setIsProcessing(true);
    setCurrentStep('analyzing');
    setAiNotice(null);
    setReviewWarning(null);

    try {
      const res = await defaultVisionProvider.analyzeSketch({
        imageBase64: imageUrl,
        mimeType: imageFile?.type || 'image/png',
        fileName: imageFile?.name || 'sketch.png',
        metadata: { mouza, dagNo, khatianNo },
      });

      if (res.success && res.data) {
        setAiStatus('analyzed');
        // Convert normalized AI vision coords (0-1000) to SVG canvas coordinate space (800x600)
        const mappedPoints: DetectedPoint[] = (res.data.points || []).map((p, idx) => {
          const rawX = typeof p.x === 'number' ? p.x : 400;
          const rawY = typeof p.y === 'number' ? p.y : 300;
          const scaledX = rawX > 800 ? Math.round((rawX / 1000) * 800) : (rawX <= 1 ? Math.round(rawX * 800) : Math.round(rawX));
          const scaledY = rawY > 600 ? Math.round((rawY / 1000) * 600) : (rawY <= 1 ? Math.round(rawY * 600) : Math.round(rawY));
          return {
            ...p,
            id: p.id || `pt-${idx + 1}`,
            name: p.name || String.fromCharCode(65 + (idx % 26)),
            x: scaledX,
            y: scaledY,
            confidence: typeof p.confidence === 'number' ? p.confidence : 0.92,
            provenance: 'ai_detected',
          };
        });

        const mappedLines: DetectedLine[] = (res.data.lines || []).map((l, idx) => ({
          ...l,
          id: l.id || `ln-${idx + 1}`,
          confidence: typeof l.confidence === 'number' ? l.confidence : 0.88,
          provenance: 'ai_detected',
        }));

        const mappedDimensions: DetectedDimension[] = (res.data.dimensions || []).map((d, idx) => ({
          ...d,
          id: d.id || `dim-${idx + 1}`,
          confidence: typeof d.confidence === 'number' ? d.confidence : 0.85,
          provenance: 'ai_detected',
        }));

        const mappedLabels: DetectedLabel[] = (res.data.labels || []).map((lb, idx) => ({
          ...lb,
          id: lb.id || `lbl-${idx + 1}`,
          confidence: typeof lb.confidence === 'number' ? lb.confidence : 0.85,
          provenance: 'ai_detected',
        }));

        const mappedFeatures: DetectedFeature[] = (res.data.features || []).map((f, idx) => ({
          ...f,
          id: f.id || `feat-${idx + 1}`,
          confidence: typeof f.confidence === 'number' ? f.confidence : 0.85,
          provenance: 'ai_detected',
        }));

        setPoints(mappedPoints);
        setLines(mappedLines);
        setDimensions(mappedDimensions);
        setLabels(mappedLabels);
        setFeatures(mappedFeatures);

        if (res.data.northArrow) {
          setNorthAngle(res.data.northArrow.angleDegrees || 0);
        }
        if (res.data.dagNo) setDagNo(res.data.dagNo);
        if (res.data.khatianNo) setKhatianNo(res.data.khatianNo);
        if (res.data.mouza) setMouza(res.data.mouza);
        setAiNotice(res.message);
      } else {
        // Foundation / Integration-Ready Mode:
        // Strictly observe user mandate: "Do NOT invent distances or coordinates."
        setAiStatus(res.status === 'not_configured' ? 'not_configured' : 'integration_ready');
        setAiNotice(
          res.message ||
            (isBn
              ? 'এআই ভিশন কনফিগারেশন আবশ্যক অথবা স্পষ্ট জ্যামিতি সনাক্ত করা যায়নি। কোনো কাল্পনিক পরিমাপ বা স্থানাঙ্ক যোগ না করে ক্যানভাসে সরাসরি ক্লিক বা যোগ করে বাউন্ডারি পয়েন্ট স্থাপন করুন।'
              : 'AI configuration required. Please click or add boundary points on the sketch canvas without fabricated coordinates.')
        );
        // Do not fabricate fake points or distances
        setPoints([]);
        setLines([]);
        setDimensions([]);
        setLabels([]);
        setFeatures([]);
        setNorthAngle(0);
        setNewPointMode(true);
      }

      setCurrentStep('review');
    } catch (err: unknown) {
      console.error('Analysis workflow error:', err);
      setAiStatus('integration_ready');
      setAiNotice(
        isBn
          ? 'এআই ভিশন সার্ভিসটি ভিত্তি মোডে আছে। ক্যানভাসে ক্লিক করে পয়েন্ট চিহ্নিত করুন।'
          : 'AI Vision service is in foundation mode. You can click to plot points directly.'
      );
      setCurrentStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add point at coordinate (e.g. from canvas click or tool button)
  const handleAddPointAtCoord = (x: number, y: number) => {
    const nextCharCode = 65 + (points.length % 26);
    const pointLetter =
      String.fromCharCode(nextCharCode) +
      (points.length >= 26 ? Math.floor(points.length / 26) : '');
    const newPt: DetectedPoint = {
      id: `pt-${Date.now()}`,
      name: pointLetter,
      x: Math.round(x),
      y: Math.round(y),
      confidence: 1,
      provenance: 'user_added',
      sourceDescription: 'আমিন নিজে ক্যানভাসে যুক্ত করেছেন',
    };
    setPoints((prev) => [...prev, newPt]);
    setSelectedPointId(newPt.id);

    // If there were previous points, add a boundary line
    if (points.length >= 1) {
      const prevPt = points[points.length - 1];
      const newLine: DetectedLine = {
        id: `ln-${Date.now()}`,
        fromPointId: prevPt.id,
        toPointId: newPt.id,
        isBoundary: true,
        label: `${prevPt.name}—${newPt.name}`,
        confidence: 1,
        provenance: 'user_added',
        sourceDescription: 'আমিন কর্তৃক যুক্ত বাহু',
      };
      setLines((prev) => [...prev, newLine]);
    }
  };

  // Add a new point to the drawing via tool button
  const handleAddPoint = () => {
    handleAddPointAtCoord(
      350 + (points.length * 20) % 120,
      250 + (points.length * 20) % 120
    );
  };

  // Delete selected point
  const handleDeletePoint = (ptId: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== ptId));
    setLines((prev) => prev.filter((l) => l.fromPointId !== ptId && l.toPointId !== ptId));
    setDimensions((prev) => prev.filter((d) => d.fromPointId !== ptId && d.toPointId !== ptId));
    if (selectedPointId === ptId) setSelectedPointId(null);
  };

  // Update a point position (marks as user_corrected)
  const handleUpdatePointPos = (id: string, x: number, y: number) => {
    setPoints((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              x: Math.max(10, Math.min(790, Math.round(x))),
              y: Math.max(10, Math.min(590, Math.round(y))),
              provenance: p.provenance === 'user_added' ? 'user_added' : 'user_corrected',
              sourceDescription: 'আমিনের ম্যানুয়াল পরিমার্জন',
            }
          : p
      )
    );
  };

  // Update line distance
  const handleUpdateLineDistance = (lineId: string, distFt: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              distanceFt: distFt,
              provenance: l.provenance === 'user_added' ? 'user_added' : 'user_corrected',
            }
          : l
      )
    );
    setDimensions((prev) =>
      prev.map((d) =>
        d.id === lineId || d.fromPointId === lineId
          ? {
              ...d,
              valueFt: distFt,
              provenance: d.provenance === 'user_added' ? 'user_added' : 'user_corrected',
            }
          : d
      )
    );
  };

  // Build the full SketchRecord data object
  const buildCurrentSketchRecord = (approved = isApproved): SketchRecord => {
    const digitalDrawing: SketchDigitalDrawing = {
      points: points.map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        distance: 0,
        label: p.name,
      })),
      annotations: lines.map((l) => ({
        id: l.id,
        type: 'line',
        x: 0,
        y: 0,
        label: l.label || (l.distanceFt ? `${l.distanceFt} ফুট` : ''),
        color: '#059669',
      })),
      areaSqFt: areaMetrics.areaSqFt,
      perimeterFt: areaMetrics.perimeterFt,
      decimal: areaMetrics.decimal,
      katha: areaMetrics.katha,
      bigha: areaMetrics.bigha,
      dagNo,
      khatianNo,
      mouza,
      northArrowAngle: northAngle,
      features,
    };

    const recordId = selectedSketchId || `sk-${Date.now()}`;
    return {
      id: recordId,
      title: `খসড়া স্কেচ — দাগ নং ${dagNo} (${mouza})`,
      originalImageUrl: imageUrl || '',
      fileName: imageFile?.name || 'sketch.png',
      fileSize: imageFile?.size || 0,
      imageDimensions: imageMeta || { width: 800, height: 600 },
      uploadedAt: Date.now(),
      reviewedAt: Date.now(),
      reviewStatus: approved ? 'approved' : 'in_review',
      reviewerName: surveyorName,
      notes: reviewerNotes,
      detectionData: {
        points,
        lines,
        polygon: {
          pointIds: points.map((p) => p.id),
          areaSqFt: areaMetrics.areaSqFt,
          perimeterFt: areaMetrics.perimeterFt,
          decimal: areaMetrics.decimal,
        },
        dimensions,
        labels,
        northArrow: { detected: true, angleDegrees: northAngle },
        features,
        dagNo,
        khatianNo,
        mouza,
        isAiAssisted: aiStatus === 'analyzed',
        confidenceScore: provenanceStats.avgConfidence / 100,
      },
      digitalDrawing,
      surveyRecordId: `survey-from-sketch-${recordId}`,
      metadata: {
        clientName,
        surveyorName,
        mouza,
        dagNo,
        khatianNo,
      },
      aiEngineStatus: aiStatus,
    };
  };

  // Save the reviewed sketch & digital drawing
  const handleSaveSketch = (requireApproval = false) => {
    if (!imageUrl) return;

    if (requireApproval && !isApproved) {
      setReviewWarning(
        isBn
          ? 'মানবিক নিরীক্ষা আবশ্যক: চূড়ান্ত অনুমোদনের পূর্বে "আমি ব্যক্তিগতভাবে এই ডিজিটাল ড্রয়িং এবং পরিমাপ যাচাই করেছি" অপশনটিতে টিক দিন।'
          : 'Human review confirmation is mandatory: Please check the Amin review verification box before final approval.'
      );
      return;
    }

    setReviewWarning(null);
    const newRecord = buildCurrentSketchRecord(isApproved);
    saveSketchRecord(newRecord);
    setSelectedSketchId(newRecord.id);
    setCurrentStep('saved');
  };

  // Convert to Phase 5 Survey Record and Launch Digital Drawing
  const handleLaunchInSurveyCAD = () => {
    if (!imageUrl) return;
    const tempRecord = buildCurrentSketchRecord(isApproved);
    const survey = convertSketchToSurveyRecord(tempRecord);
    if (onOpenDigitalDrawing) {
      onOpenDigitalDrawing(survey);
    }
  };

  // Export to Phase 6 / 7 Survey Report
  const handleOpenInReport = () => {
    if (!imageUrl) return;
    handleSaveSketch(false);
    const tempRecord = buildCurrentSketchRecord(isApproved);
    const survey = convertSketchToSurveyRecord(tempRecord);
    if (onOpenDigitalDrawing) {
      onOpenDigitalDrawing(survey);
    }
    if (onOpenReport) {
      onOpenReport(survey.id);
    }
  };

  // Load a saved sketch for review
  const handleLoadSavedSketch = (s: SketchRecord) => {
    setSelectedSketchId(s.id);
    setImageUrl(s.originalImageUrl);
    setDagNo(s.metadata.dagNo || '');
    setKhatianNo(s.metadata.khatianNo || '');
    setMouza(s.metadata.mouza || '');
    setClientName(s.metadata.clientName || '');
    setSurveyorName(s.reviewerName || '');
    setReviewerNotes(s.notes || '');
    setIsApproved(s.reviewStatus === 'approved');
    setAiStatus(s.aiEngineStatus);

    if (s.detectionData) {
      setPoints(s.detectionData.points || []);
      setLines(s.detectionData.lines || []);
      setDimensions(s.detectionData.dimensions || []);
      setLabels(s.detectionData.labels || []);
      if (s.detectionData.northArrow) {
        setNorthAngle(s.detectionData.northArrow.angleDegrees || 0);
      }
      if (s.detectionData.features) {
        setFeatures(s.detectionData.features);
      }
    }
    setCurrentStep('review');
  };

  return (
    <div id="sketch-to-drawing-container" className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            id="sketch-screen-back-btn"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95"
            title={isBn ? 'ফিরে যান' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5 leading-tight">
              <span className="text-emerald-700">✏️</span>
              <span>{isBn ? 'খাতার নকশা থেকে ডিজিটাল ড্রয়িং' : 'AI Sketch to Digital Drawing'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                Phase 18
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isBn
                ? 'আমিনের হাতে আঁকা ফিল্ড-বুক স্কেচ ছবি আপলোড করুন ও নির্ভুল ডিজিটাল ভেক্টরে রূপান্তর করুন'
                : 'Convert field-book pencil sketches into vector CAD drawings with Amin human review'}
            </p>
          </div>
        </div>

        {/* Saved Sketches counter & quick jump */}
        {savedSketches.length > 0 && currentStep === 'upload' && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isBn ? `${savedSketches.length}টি স্কেচ সংরক্ষিত` : `${savedSketches.length} Saved`}</span>
          </div>
        )}
      </div>

      {/* Legal & Review Notice Banner (Mandatory per spec) */}
      <div
        id="sketch-legal-disclaimer"
        className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5 text-amber-950 shadow-2xs"
      >
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-[12.5px] leading-relaxed">
          <span className="font-bold text-amber-900">
            {isBn ? 'আইনি নোটিশ ও মানবিক নিরীক্ষা বাধ্যবাধকতা:' : 'Legal Notice & Human Review:'}
          </span>{' '}
          {isBn ? SKETCH_LEGAL_DISCLAIMER_BN : SKETCH_LEGAL_DISCLAIMER_EN}
        </div>
      </div>

      {/* Workflow Progress Breadcrumbs */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-xs font-bold">
          <div
            className={`py-2 px-1 rounded-xl transition ${
              currentStep === 'upload'
                ? 'bg-emerald-800 text-white shadow-xs'
                : imageUrl
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            ১. {isBn ? 'ছবি আপলোড' : 'Upload'}
          </div>
          <div
            className={`py-2 px-1 rounded-xl transition ${
              currentStep === 'analyzing'
                ? 'bg-emerald-800 text-white shadow-xs'
                : points.length > 0
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            ২. {isBn ? 'এআই বিশ্লেষণ' : 'Analysis'}
          </div>
          <div
            className={`py-2 px-1 rounded-xl transition ${
              currentStep === 'review'
                ? 'bg-emerald-800 text-white shadow-xs'
                : isApproved
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            ৩. {isBn ? 'আমিন রিভিউ' : 'Review'}
          </div>
          <div
            className={`py-2 px-1 rounded-xl transition ${
              currentStep === 'saved'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            ৪. {isBn ? 'ডিজিটাল সংরক্ষণ' : 'Saved'}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: SKETCH UPLOAD & PREVIEW */}
      {/* ========================================================================= */}
      {currentStep === 'upload' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs">
            {!imageUrl ? (
              /* Empty Upload Dropzone */
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 sm:p-10 text-center bg-emerald-50/30 hover:bg-emerald-50/60 transition flex flex-col items-center justify-center cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform shadow-xs">
                  <FileUp className="w-8 h-8 text-emerald-700" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                  {isBn ? 'হাতে আঁকা নকশার ছবি নির্বাচন বা ড্রপ করুন' : 'Select or Drop Field-Book Sketch'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed mb-4">
                  {isBn
                    ? 'আমিনের ফিল্ড বুকের স্পষ্ট ছবি তুলুন। JPG, JPEG বা PNG ফরম্যাট সমর্থিত (সর্বোচ্চ ১৫ মেগাবাইট)।'
                    : 'Clear photo of field sketch with legible corners & dimensions. Supports JPG, JPEG, PNG (max 15MB).'}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition active:scale-95 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isBn ? 'ফাইল নির্বাচন করুন' : 'Browse Files'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSampleSketch();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs sm:text-sm font-bold transition active:scale-95 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span>{isBn ? 'ডেমো স্কেচ লোড করুন' : 'Load Demo Sketch'}</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              /* Image Uploaded Preview State */
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                        {imageFile?.name || (isBn ? 'হাতে আঁকা নমুনা ফিল্ড স্কেচ' : 'Hand Sketch')}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {imageMeta ? `${imageMeta.width} × ${imageMeta.height} px` : ''}{' '}
                        {imageFile ? `• ${(imageFile.size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 px-3 py-1.5 rounded-xl transition"
                    >
                      {isBn ? 'ছবি পরিবর্তন' : 'Replace'}
                    </button>
                    <button
                      onClick={handleRemoveImage}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isBn ? 'মুছে ফেলুন' : 'Remove'}</span>
                    </button>
                  </div>
                </div>

                {/* Preview Box */}
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center max-h-96">
                  <img
                    src={imageUrl}
                    alt="Uploaded Sketch"
                    className="max-h-96 w-auto object-contain"
                  />
                  <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-md font-medium">
                    {isBn ? 'মূল আপলোডকৃত স্কেচ' : 'Original Sketch Preview'}
                  </div>
                </div>

                {/* Land Identification Context Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBn ? 'মৌজা নাম' : 'Mouza Name'}
                    </label>
                    <input
                      type="text"
                      value={mouza}
                      onChange={(e) => setMouza(e.target.value)}
                      placeholder="মৌজার নাম লিখুন"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBn ? 'দাগ নম্বর' : 'Dag No'}
                    </label>
                    <input
                      type="text"
                      value={dagNo}
                      onChange={(e) => setDagNo(e.target.value)}
                      placeholder="দাগ নং"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBn ? 'খতিয়ান নম্বর' : 'Khatian No'}
                    </label>
                    <input
                      type="text"
                      value={khatianNo}
                      onChange={(e) => setKhatianNo(e.target.value)}
                      placeholder="খতিয়ান নং"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                    />
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    id="analyze-sketch-btn"
                    onClick={handleAnalyzeSketch}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>{isBn ? 'নকশা বিশ্লেষণ ও ভেক্টর রূপান্তর শুরু করুন' : 'Analyze Sketch & Vectorize'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {fileError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          {/* Historical Saved Sketches Section */}
          {savedSketches.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                <span>{isBn ? 'পূর্বে সংরক্ষিত খসড়া স্কেচসমূহ' : 'Saved Sketch History'}</span>
                <span className="text-xs text-slate-500 font-normal">{savedSketches.length} records</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {savedSketches.map((sketch) => (
                  <div
                    key={sketch.id}
                    onClick={() => handleLoadSavedSketch(sketch)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-emerald-600 bg-slate-50/60 hover:bg-white transition cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
                        <img
                          src={sketch.originalImageUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                          {sketch.title}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {sketch.metadata.mouza} • দাগ: {sketch.metadata.dagNo}
                        </p>
                        <span
                          className={`inline-block text-[9.5px] font-bold px-1.5 py-0.2 rounded-sm mt-0.5 ${
                            sketch.reviewStatus === 'approved'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {sketch.reviewStatus === 'approved'
                            ? isBn
                              ? 'অনুমোদিত'
                              : 'Approved'
                            : isBn
                            ? 'রিভিউ প্রতীক্ষিত'
                            : 'In Review'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSketchRecord(sketch.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: PROCESSING & ANALYSIS STATE */}
      {/* ========================================================================= */}
      {currentStep === 'analyzing' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-8 h-8 text-emerald-700 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {isBn ? 'স্কেচ থেকে জ্যামিতিক ডেটা বিশ্লেষণ হচ্ছে...' : 'Analyzing Field Sketch Geometry...'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {isBn
              ? 'বাউন্ডারি কোণা (A, B, C, D), বাহুর দূরত্ব, দাগ নম্বর ও উত্তর দিক স্ক্যান করা হচ্ছে।'
              : 'Scanning corner vertices, line segments, boundaries, labels and north arrow.'}
          </p>
          <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-emerald-600 animate-indeterminate" />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: HUMAN REVIEW & EDIT WORKSPACE (MANDATORY) */}
      {/* ========================================================================= */}
      {(currentStep === 'review' || currentStep === 'saved') && (
        <div className="space-y-4">
          {/* AI Engine Status & Provenance Stats Bar */}
          <div className="space-y-2">
            {aiNotice && (
              <div
                className={`rounded-xl p-3 text-xs flex items-center justify-between border ${
                  aiStatus === 'analyzed'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-emerald-700" />
                  <span>{aiNotice}</span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs">
                  {aiStatus === 'analyzed' ? 'AI Vision Verified' : 'Foundation Mode'}
                </span>
              </div>
            )}

            {/* Legal Disclaimer & Review Requirement Notice */}
            <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-xs flex items-start gap-2.5 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11.5px] leading-relaxed">
                <span className="font-bold text-amber-300">
                  {isBn ? 'বাধ্যতামূলক আমিন নিরীক্ষণ:' : 'Mandatory Amin Review:'}
                </span>{' '}
                {isBn
                  ? 'এআই-ড্রয়িং শুধুমাত্র আপলোডকৃত খসড়া স্কেচ বিশ্লেষণের ওপর ভিত্তি করে তৈরি এবং এতে আমিনের প্রত্যক্ষ পর্যালোচনা আবশ্যক। এটি স্বয়ংক্রিয়ভাবে কোনো চূড়ান্ত আইনি সীমানা দলিল নয়।'
                  : 'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.'}
              </div>
            </div>

            {/* Provenance & Confidence Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-semibold">
                  {isBn ? 'এআই সনাক্তকরণ' : 'AI Detected'}
                </span>
                <span className="font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                  {provenanceStats.aiCount}
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-semibold">
                  {isBn ? 'আমিন পরিমার্জন' : 'User Corrected'}
                </span>
                <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  {provenanceStats.correctedCount}
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-semibold">
                  {isBn ? 'আমিন কর্তৃক যুক্ত' : 'User Added'}
                </span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {provenanceStats.addedCount}
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-semibold">
                  {isBn ? 'নির্ভরযোগ্যতা' : 'Avg Confidence'}
                </span>
                <span className="font-black text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {provenanceStats.avgConfidence}%
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Switcher Toolbar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'split'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                <span>{isBn ? 'পাশাপাশি (Split)' : 'Side-by-Side'}</span>
              </button>
              <button
                onClick={() => setViewMode('overlay')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'overlay'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isBn ? 'ওভারলে ট্রেসিং' : 'Overlay Trace'}</span>
              </button>
              <button
                onClick={() => setViewMode('digital_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'digital_only'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{isBn ? 'ডিজিটাল CAD' : 'Digital CAD'}</span>
              </button>
              <button
                onClick={() => setViewMode('sketch_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'sketch_only'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{isBn ? 'মূল স্কেচ' : 'Original'}</span>
              </button>
            </div>

            {/* If Overlay mode, show opacity slider */}
            {viewMode === 'overlay' && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span>{isBn ? 'স্বচ্ছতা:' : 'Opacity:'}</span>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  className="w-24 accent-emerald-700"
                />
                <span className="text-[11px] text-slate-500">{Math.round(overlayOpacity * 100)}%</span>
              </div>
            )}

            {/* Geometry Tools */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewPointMode(!newPointMode)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                  newPointMode
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={isBn ? 'ক্যানভাসে ক্লিক করে পয়েন্ট আঁকুন' : 'Click canvas to add point'}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{isBn ? (newPointMode ? 'ক্যানভাসে ক্লিক সক্রিয়' : 'ক্লিক করে পয়েন্ট আঁকুন') : 'Plot on Click'}</span>
              </button>
              <button
                onClick={handleAddPoint}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1 transition"
                title={isBn ? 'নতুন পয়েন্ট যোগ করুন' : 'Add Point'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBn ? 'পয়েন্ট যোগ' : 'Add Point'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Canvas Stage */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main Visualizer Area (8 cols on lg) */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-3">
              <div
                className="relative w-full h-[380px] sm:h-[460px] bg-slate-950 rounded-xl overflow-hidden select-none border border-slate-300 touch-none"
                onMouseLeave={() => setActiveDraggingPointId(null)}
              >
                {/* 1. Original Image View or Overlay Base */}
                {(viewMode === 'split' || viewMode === 'overlay' || viewMode === 'sketch_only') && imageUrl && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center ${
                      viewMode === 'split' ? 'w-1/2 border-r border-slate-700' : 'w-full'
                    }`}
                  >
                    <img
                      src={imageUrl}
                      alt="Original Sketch"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                    <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      {isBn ? 'মূল খসড়া নকশা' : 'Original Sketch'}
                    </div>
                  </div>
                )}

                {/* 2. Interactive SVG Digital Vector Layer */}
                {(viewMode === 'split' || viewMode === 'overlay' || viewMode === 'digital_only') && (
                  <div
                    className={`absolute inset-0 ${
                      viewMode === 'split'
                        ? 'left-1/2 w-1/2 bg-slate-900'
                        : viewMode === 'overlay'
                        ? 'w-full'
                        : 'w-full bg-slate-900'
                    }`}
                    style={viewMode === 'overlay' ? { opacity: overlayOpacity } : undefined}
                  >
                    <svg
                      ref={svgRef}
                      viewBox="0 0 800 600"
                      className={`w-full h-full ${newPointMode ? 'cursor-crosshair' : 'cursor-default'}`}
                      onClick={(e) => {
                        if (!svgRef.current) return;
                        const rect = svgRef.current.getBoundingClientRect();
                        const clickX = ((e.clientX - rect.left) / rect.width) * 800;
                        const clickY = ((e.clientY - rect.top) / rect.height) * 600;

                        if (newPointMode) {
                          handleAddPointAtCoord(clickX, clickY);
                        } else if (e.target === e.currentTarget) {
                          setSelectedPointId(null);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!activeDraggingPointId || !svgRef.current) return;
                        const rect = svgRef.current.getBoundingClientRect();
                        const curX = ((e.clientX - rect.left) / rect.width) * 800;
                        const curY = ((e.clientY - rect.top) / rect.height) * 600;
                        handleUpdatePointPos(activeDraggingPointId, curX, curY);
                      }}
                      onMouseUp={() => setActiveDraggingPointId(null)}
                      onTouchMove={(e) => {
                        if (!activeDraggingPointId || !svgRef.current) return;
                        const touch = e.touches[0];
                        const rect = svgRef.current.getBoundingClientRect();
                        const curX = ((touch.clientX - rect.left) / rect.width) * 800;
                        const curY = ((touch.clientY - rect.top) / rect.height) * 600;
                        handleUpdatePointPos(activeDraggingPointId, curX, curY);
                      }}
                      onTouchEnd={() => setActiveDraggingPointId(null)}
                    >
                      {/* Grid Background */}
                      <defs>
                        <pattern id="cadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.8" />
                        </pattern>
                      </defs>
                      <rect width="800" height="600" fill="url(#cadGrid)" />

                      {/* Boundary Polygon Fill */}
                      {points.length >= 3 && (
                        <polygon
                          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="#10b981"
                          fillOpacity="0.2"
                          stroke="#10b981"
                          strokeWidth="2.5"
                        />
                      )}

                      {/* Boundary Lines and Dimensions */}
                      {lines.map((line) => {
                        const ptA = points.find((p) => p.id === line.fromPointId);
                        const ptB = points.find((p) => p.id === line.toPointId);
                        if (!ptA || !ptB) return null;

                        const midX = (ptA.x + ptB.x) / 2;
                        const midY = (ptA.y + ptB.y) / 2;

                        return (
                          <g key={line.id}>
                            <line
                              x1={ptA.x}
                              y1={ptA.y}
                              x2={ptB.x}
                              y2={ptB.y}
                              stroke={line.provenance === 'user_corrected' ? '#f59e0b' : '#059669'}
                              strokeWidth="3"
                              strokeDasharray={line.isBoundary ? undefined : '4,4'}
                            />
                            {/* Dimension Label Tag */}
                            {line.distanceFt && (
                              <g transform={`translate(${midX}, ${midY})`}>
                                <rect
                                  x="-32"
                                  y="-12"
                                  width="64"
                                  height="20"
                                  rx="4"
                                  fill="#0f172a"
                                  stroke={line.provenance === 'user_corrected' ? '#f59e0b' : '#34d399'}
                                  strokeWidth="1"
                                />
                                <text
                                  x="0"
                                  y="2"
                                  fill="#ffffff"
                                  fontSize="10"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                >
                                  {line.distanceFt} ফুট
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}

                      {/* Interactive Vertex Points */}
                      {points.map((pt) => {
                        const isSelected = selectedPointId === pt.id;
                        const isBeingDragged = activeDraggingPointId === pt.id;

                        // Distinct colors based on element provenance:
                        const pointColor =
                          pt.provenance === 'user_added'
                            ? '#34d399' // Green
                            : pt.provenance === 'user_corrected'
                            ? '#f59e0b' // Amber
                            : '#38bdf8'; // Sky blue for AI-detected

                        return (
                          <g
                            key={pt.id}
                            className="cursor-grab active:cursor-grabbing group"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedPointId(pt.id);
                              setActiveDraggingPointId(pt.id);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              setSelectedPointId(pt.id);
                              setActiveDraggingPointId(pt.id);
                            }}
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected || isBeingDragged ? 10 : 7.5}
                              fill={isSelected ? '#f59e0b' : pointColor}
                              stroke="#ffffff"
                              strokeWidth="2.5"
                            />
                            <rect
                              x={pt.x + 10}
                              y={pt.y - 18}
                              width="30"
                              height="18"
                              rx="4"
                              fill="#0f172a"
                              stroke={isSelected ? '#f59e0b' : '#64748b'}
                              strokeWidth="1"
                            />
                            <text
                              x={pt.x + 25}
                              y={pt.y - 6}
                              fill="#ffffff"
                              fontSize="11"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {pt.name}
                            </text>
                          </g>
                        );
                      })}

                      {/* North Arrow CAD Marker */}
                      <g transform={`translate(740, 60) rotate(${northAngle})`}>
                        <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                        <polygon points="0,-18 5,6 0,0 -5,6" fill="#f59e0b" />
                        <text x="0" y="-8" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                          N
                        </text>
                      </g>
                    </svg>

                    <div className="absolute top-2 right-2 bg-slate-900/80 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{isBn ? 'ইন্টারেক্টিভ CAD ক্যানভাস (ড্র্যাগ করুন)' : 'Interactive CAD (Drag to Adjust)'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Area & Dimension Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">
                    {isBn ? 'ক্ষেত্রফল (বর্গফুট)' : 'Area (Sq Ft)'}
                  </span>
                  <span className="text-sm font-black text-slate-900">{areaMetrics.areaSqFt} ব.ফু.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="block text-[10px] text-emerald-700 font-semibold uppercase">
                    {isBn ? 'শতাংশ / শতক' : 'Decimal'}
                  </span>
                  <span className="text-sm font-black text-emerald-900">{areaMetrics.decimal} শতক</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">
                    {isBn ? 'কাঠা' : 'Katha'}
                  </span>
                  <span className="text-sm font-black text-slate-900">{areaMetrics.katha} কাঠা</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">
                    {isBn ? 'পরিসীমা' : 'Perimeter'}
                  </span>
                  <span className="text-sm font-black text-slate-900">{areaMetrics.perimeterFt} ফুট</span>
                </div>
              </div>
            </div>

            {/* Sidebar Controls: Point/Line Inspector & Metadata (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-3">
              {/* Selected Point Inspector */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>{isBn ? 'পয়েন্ট ও বাউন্ডারি নিরীক্ষণ' : 'Point & Boundary Inspector'}</span>
                  {selectedPointId && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                      পয়েন্ট নির্বাচিত
                    </span>
                  )}
                </h4>

                {selectedPointId ? (
                  (() => {
                    const pt = points.find((p) => p.id === selectedPointId);
                    if (!pt) return null;

                    const provLabel =
                      pt.provenance === 'user_added'
                        ? isBn
                          ? 'আমিনের যুক্ত করা'
                          : 'User Added'
                        : pt.provenance === 'user_corrected'
                        ? isBn
                          ? 'আমিনের পরিমার্জিত'
                          : 'User Corrected'
                        : isBn
                        ? 'এআই সনাক্তকৃত'
                        : 'AI Detected';

                    const provBg =
                      pt.provenance === 'user_added'
                        ? 'bg-emerald-100 text-emerald-900'
                        : pt.provenance === 'user_corrected'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-sky-100 text-sky-900';

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-xs">
                              {pt.name}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800">পয়েন্ট {pt.name}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${provBg}`}>
                                  {provLabel}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                X: {pt.x} | Y: {pt.y} • কনফিডেন্স: {Math.round((pt.confidence || 0.9) * 100)}%
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePoint(pt.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                            title={isBn ? 'পয়েন্ট মুছুন' : 'Delete Point'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Adjust Position Sliders / Inputs */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500">X স্থানাঙ্ক</label>
                            <input
                              type="number"
                              value={pt.x}
                              onChange={(e) =>
                                handleUpdatePointPos(pt.id, parseFloat(e.target.value) || 0, pt.y)
                              }
                              className="w-full px-2 py-1 border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500">Y স্থানাঙ্ক</label>
                            <input
                              type="number"
                              value={pt.y}
                              onChange={(e) =>
                                handleUpdatePointPos(pt.id, pt.x, parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1 border rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    {isBn
                      ? 'ক্যানভাসে যেকোনো পয়েন্টে ক্লিক বা ড্র্যাগ করে তার স্থানাঙ্ক ও বাহু পরিমাপ পরিবর্তন করুন।'
                      : 'Click or drag any vertex on the canvas to inspect & fine-tune coordinates.'}
                  </p>
                )}

                {/* Line Segments & Distances list */}
                <div className="border-t border-slate-100 pt-2.5 space-y-1.5 max-h-36 overflow-y-auto">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">
                    {isBn ? 'বাহুর দৈর্ঘ্য (ফুট):' : 'Line Distances (ft):'}
                  </span>
                  {lines.map((line) => {
                    const ptA = points.find((p) => p.id === line.fromPointId);
                    const ptB = points.find((p) => p.id === line.toPointId);
                    if (!ptA || !ptB) return null;
                    return (
                      <div
                        key={line.id}
                        className="flex items-center justify-between text-xs bg-slate-50 p-1.5 rounded-lg"
                      >
                        <span className="font-semibold text-slate-700">
                          {ptA.name} — {ptB.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={line.distanceFt || 0}
                            onChange={(e) =>
                              handleUpdateLineDistance(line.id, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-right font-bold text-slate-800 text-xs"
                          />
                          <span className="text-[10px] text-slate-500">ফুট</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* North Arrow Rotation */}
                <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{isBn ? 'উত্তর দিক কোণ:' : 'North Angle:'}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={northAngle}
                      onChange={(e) => setNorthAngle(parseInt(e.target.value, 10))}
                      className="w-20 accent-amber-600"
                    />
                    <span className="text-xs font-bold text-slate-800">{northAngle}°</span>
                  </div>
                </div>
              </div>

              {/* Amin Approval & Verification Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
                  <span>{isBn ? 'আমিন নিরীক্ষা ও অনুমোদন' : 'Amin Review & Approval'}</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Phase 18
                  </span>
                </h4>

                {/* Verification Warning Prompt if unapproved attempt */}
                {reviewWarning && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{reviewWarning}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'নিরীক্ষক আমিনের নাম' : 'Reviewer Amin Name'}
                  </label>
                  <input
                    type="text"
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200"
                    placeholder={isBn ? 'উদা: মোঃ আরিফুল ইসলাম (আমিন)' : 'Surveyor name'}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'নিরীক্ষা মন্তব্য / ফিল্ড-বুকের রেফারেন্স' : 'Reviewer Notes & Field-Book Ref'}
                  </label>
                  <textarea
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder={
                      isBn
                        ? 'স্কেচ ও সরজমিনের পরিমাপ যাচাই সম্পর্কিত মন্তব্য...'
                        : 'Notes regarding field-book comparison...'
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 h-16 resize-none"
                  />
                </div>

                {/* Mandatory Checkbox for Final Approval */}
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-500 transition">
                  <input
                    type="checkbox"
                    checked={isApproved}
                    onChange={(e) => {
                      setIsApproved(e.target.checked);
                      if (e.target.checked) setReviewWarning(null);
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-700 accent-emerald-700 shrink-0"
                  />
                  <span className="text-xs text-slate-800 font-semibold leading-tight">
                    {isBn
                      ? 'আমি নিজে খসড়া নকশা ও সরজমিন যাচাই করে এই ডিজিটাল ড্রয়িং অনুমোদন করছি।'
                      : 'I personally reviewed and verified this digital drawing against field observations.'}
                  </span>
                </label>

                <div className="pt-2 space-y-2">
                  {/* Primary Final Approval & Save */}
                  <button
                    id="save-sketch-record-btn"
                    onClick={() => handleSaveSketch(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{isBn ? 'চূড়ান্ত অনুমোদন ও সংরক্ষণ' : 'Approve & Save Final'}</span>
                  </button>

                  {/* Secondary Draft Save */}
                  <button
                    onClick={() => handleSaveSketch(false)}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isBn ? 'খসড়া ড্রয়িং সেভ করুন (Save Draft)' : 'Save as Draft'}</span>
                  </button>

                  {/* Integration Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleLaunchInSurveyCAD}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-[11px] transition text-center"
                      title={isBn ? 'ডিজিটাল সার্ভে ড্রয়িং-এ খুলুন' : 'Open in CAD Drawing'}
                    >
                      {isBn ? 'CAD ড্রয়িং-এ খুলুন' : 'Open in CAD'}
                    </button>
                    {onOpenReport && (
                      <button
                        onClick={handleOpenInReport}
                        className="py-2 px-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-bold text-[11px] transition text-center"
                        title={isBn ? 'এ৪ রিপোর্টে যুক্ত করুন' : 'Export to Report'}
                      >
                        {isBn ? 'A4 রিপোর্ট তৈরি' : 'Create Report'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
