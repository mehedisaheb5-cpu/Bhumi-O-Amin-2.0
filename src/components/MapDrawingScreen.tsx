import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Layers,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info,
  ShieldCheck,
  FileText,
  Download,
  Share2,
} from 'lucide-react';
import { Language, SurveyRecord, SurveyPoint, DrawingAnnotation } from '../types';
import {
  LatLngPoint,
  filterValidPoints,
  calculatePolygonArea,
  calculatePolygonSegments,
  GpsAreaResult,
  GpsPolygonSegment,
} from '../lib/gps-geometry';
import {
  getStoredGpsPoints,
  saveGpsPointsToStorage,
  relabelGpsPoints,
} from '../lib/gps-utils';
import { GpsPoint } from '../lib/gps-types';
import { projectGpsPointsToLocal, ProjectedDrawingPoint } from '../lib/survey-drawing';
import { DrawingCanvas, DrawingTheme, DrawingToolType } from './drawing/DrawingCanvas';
import { DrawingToolbar } from './drawing/DrawingToolbar';
import { DrawingAreaSummary } from './drawing/DrawingAreaSummary';
import { DrawingPointInspector } from './drawing/DrawingPointInspector';
import { DrawingLandMetadata, LandSurveyMetadata } from './drawing/DrawingLandMetadata';
import { DrawingCoordinateTable } from './drawing/DrawingCoordinateTable';

interface MapDrawingScreenProps {
  lang: Language;
  surveys: SurveyRecord[];
  onSaveSurvey: (survey: SurveyRecord) => void;
  onNavigateToSurvey?: () => void;
  onOpenMouzaMap?: () => void;
  initialSurveyId?: string | null;
}

export const MapDrawingScreen: React.FC<MapDrawingScreenProps> = ({
  lang,
  surveys,
  onSaveSurvey,
  onNavigateToSurvey,
  onOpenMouzaMap,
  initialSurveyId,
}) => {
  const isBn = lang === 'bn';

  // Active view tab: 'drawing' (Primary Phase 5 CAD Drawing) | 'ai' (Optional Conceptual Visualizer)
  const [activeTab, setActiveTab] = useState<'drawing' | 'ai'>('drawing');

  // 1. Survey Selection (Active GPS Survey vs Saved Survey)
  // 'active_gps' means live points from localStorage/field survey
  const [selectedSurveyKey, setSelectedSurveyKey] = useState<string>(
    initialSurveyId || 'active_gps'
  );

  // Active GPS Points from local storage
  const [activeGpsPoints, setActiveGpsPoints] = useState<GpsPoint[]>(() => getStoredGpsPoints());

  // Listen for storage updates to keep active GPS survey in sync
  useEffect(() => {
    const handleStorage = () => {
      setActiveGpsPoints(getStoredGpsPoints());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Current survey record if a saved survey is selected
  const currentSavedSurvey = useMemo(() => {
    if (selectedSurveyKey === 'active_gps') return null;
    return surveys.find((s) => s.id === selectedSurveyKey) || null;
  }, [selectedSurveyKey, surveys]);

  // Points to render based on selection
  const rawPoints: LatLngPoint[] = useMemo(() => {
    if (selectedSurveyKey === 'active_gps') {
      return activeGpsPoints.map((p) => ({
        id: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy,
        timestamp: p.timestamp,
        label: p.label,
      }));
    }
    if (currentSavedSurvey) {
      return currentSavedSurvey.points.map((p, idx) => ({
        id: p.id || `pt-${idx}`,
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        accuracy: p.accuracy,
        timestamp: p.timestamp,
        label: p.label || String.fromCharCode(65 + (idx % 26)),
      }));
    }
    return [];
  }, [selectedSurveyKey, activeGpsPoints, currentSavedSurvey]);

  // Filter valid real GPS points
  const validPoints = useMemo(() => {
    return filterValidPoints(rawPoints);
  }, [rawPoints]);

  // 2. Geometry calculations using existing gps-geometry.ts functions
  const areaResult: GpsAreaResult | null = useMemo(() => {
    if (validPoints.length < 3) return null;
    return calculatePolygonArea(validPoints);
  }, [validPoints]);

  const segments: GpsPolygonSegment[] = useMemo(() => {
    if (validPoints.length < 2) return [];
    return calculatePolygonSegments(validPoints);
  }, [validPoints]);

  // Projected drawing points
  const projection = useMemo(() => {
    return projectGpsPointsToLocal(validPoints);
  }, [validPoints]);

  // 3. UI State
  const [theme, setTheme] = useState<DrawingTheme>('blueprint');
  const [activeTool, setActiveTool] = useState<DrawingToolType>('select');
  const [selectedPoint, setSelectedPoint] = useState<ProjectedDrawingPoint | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Annotations
  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>(() => {
    if (currentSavedSurvey?.annotations) return currentSavedSurvey.annotations;
    return [];
  });

  // 4. Survey Metadata State (editable)
  const [metadata, setMetadata] = useState<LandSurveyMetadata>({
    clientName: currentSavedSurvey?.clientName || '',
    district: currentSavedSurvey?.district || '',
    upazila: currentSavedSurvey?.upazila || '',
    union: currentSavedSurvey?.union || '',
    mouza: currentSavedSurvey?.mouza || '',
    jlNo: currentSavedSurvey?.jlNo || '',
    dagNo: currentSavedSurvey?.dagNo || '',
    khatianNo: currentSavedSurvey?.khatianNo || '',
    surveyDate: currentSavedSurvey?.date || new Date().toISOString().split('T')[0],
    surveyorName: currentSavedSurvey?.surveyorName || '',
    notes: currentSavedSurvey?.notes || '',
  });

  // When selected survey changes, update metadata and annotations
  useEffect(() => {
    if (currentSavedSurvey) {
      setMetadata({
        clientName: currentSavedSurvey.clientName || '',
        district: currentSavedSurvey.district || '',
        upazila: currentSavedSurvey.upazila || '',
        union: currentSavedSurvey.union || '',
        mouza: currentSavedSurvey.mouza || '',
        jlNo: currentSavedSurvey.jlNo || '',
        dagNo: currentSavedSurvey.dagNo || '',
        khatianNo: currentSavedSurvey.khatianNo || '',
        surveyDate: currentSavedSurvey.date || new Date().toISOString().split('T')[0],
        surveyorName: currentSavedSurvey.surveyorName || '',
        notes: currentSavedSurvey.notes || '',
      });
      setAnnotations(currentSavedSurvey.annotations || []);
    } else {
      // Active GPS Survey defaults
      setMetadata((prev) => ({
        ...prev,
        surveyDate: new Date().toISOString().split('T')[0],
      }));
      setAnnotations([]);
    }
    setSelectedPoint(null);
    setSelectedSegmentIndex(null);
  }, [currentSavedSurvey]);

  // Handle Point Deletion (TASK 11)
  const handleDeletePoint = (pointId: string) => {
    if (selectedSurveyKey === 'active_gps') {
      const filtered = activeGpsPoints.filter((p) => p.id !== pointId);
      const relabeled = relabelGpsPoints(filtered);
      saveGpsPointsToStorage(relabeled);
      setActiveGpsPoints(relabeled);
    } else if (currentSavedSurvey) {
      const updatedPoints: SurveyPoint[] = currentSavedSurvey.points
        .filter((p) => p.id !== pointId)
        .map((p, idx) => ({
          ...p,
          label: String.fromCharCode(65 + (idx % 26)),
        }));

      const updatedSurvey: SurveyRecord = {
        ...currentSavedSurvey,
        points: updatedPoints,
      };
      onSaveSurvey(updatedSurvey);
    }
  };

  // Handle Save Drawing (TASK 16)
  const handleSaveDrawing = () => {
    setIsSaving(true);

    const surveyId = currentSavedSurvey ? currentSavedSurvey.id : `srv-${Date.now()}`;
    const surveyTitle =
      metadata.mouza || metadata.dagNo
        ? `${metadata.mouza || 'মৌজা'} - দাগ ${metadata.dagNo || 'সার্ভে'}`
        : isBn
        ? `জিপিএস নকশা ${new Date().toLocaleDateString('bn-BD')}`
        : `GPS Drawing ${new Date().toLocaleDateString()}`;

    // Convert valid points to SurveyPoint format
    const surveyPoints: SurveyPoint[] = validPoints.map((pt, idx) => ({
      id: pt.id || `pt-${idx}`,
      name: `পয়েন্ট ${pt.label || String.fromCharCode(65 + (idx % 26))}`,
      label: pt.label || String.fromCharCode(65 + (idx % 26)),
      x: Math.round(pt.longitude * 1000000) % 1000,
      y: Math.round(pt.latitude * 1000000) % 1000,
      latitude: pt.latitude,
      longitude: pt.longitude,
      accuracy: pt.accuracy,
      timestamp: pt.timestamp,
    }));

    const recordToSave: SurveyRecord = {
      id: surveyId,
      title: surveyTitle,
      mouza: metadata.mouza || 'কমলাপুর',
      jlNo: metadata.jlNo || '৭৪',
      dagNo: metadata.dagNo || '৩১২',
      khatianNo: metadata.khatianNo || '',
      date: metadata.surveyDate || new Date().toISOString().split('T')[0],
      areaSqFt: areaResult?.areaSqFt || currentSavedSurvey?.areaSqFt || 0,
      perimeterFt: areaResult?.perimeterFt || currentSavedSurvey?.perimeterFt || 0,
      points: surveyPoints,
      status: 'completed',
      notes: metadata.notes,
      clientName: metadata.clientName,
      district: metadata.district,
      upazila: metadata.upazila,
      union: metadata.union,
      surveyorName: metadata.surveyorName,
      annotations,
    };

    onSaveSurvey(recordToSave);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccessMsg(
        isBn
          ? 'ডিজিটাল নকশা ও তথ্য সফলভাবে সংরক্ষণ করা হয়েছে!'
          : 'Digital survey drawing saved successfully!'
      );
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }, 400);
  };

  // Add manual annotation
  const handleAddAnnotation = (ann: DrawingAnnotation) => {
    setAnnotations((prev) => [...prev, ann]);
    setActiveTool('select');
  };

  // Clear annotations
  const handleClearAnnotations = () => {
    if (
      window.confirm(
        isBn
          ? 'আপনি কি নিশ্চিত সব অ্যানোটেশন মুছে ফেলতে চান?'
          : 'Are you sure you want to clear all annotations?'
      )
    ) {
      setAnnotations([]);
    }
  };

  // AI Visualizer state (preserved from previous phase)
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [generatedAiImage, setGeneratedAiImage] = useState<string | null>(null);

  const handleGenerateAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setTimeout(() => {
      setIsGeneratingAi(false);
      setGeneratedAiImage('/preview-plot.png');
    }, 1500);
  };

  return (
    <div id="digital-survey-drawing-screen" className="space-y-4 pb-12 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header & Mode Switcher */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-2xs">
              <Compass className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isBn ? 'GPS ভিত্তিক ডিজিটাল নকশা' : 'GPS Digital Survey Drawing'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'বাস্তব GPS স্থানাঙ্ক ও জ্যামিতি ভিত্তিক ২ডি ক্যাড ড্রয়িং'
                  : 'Real GPS Coordinate-Based 2D CAD Land Survey Drawing'}
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher: CAD Drawing vs AI Visualizer */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('drawing')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'drawing'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isBn ? 'ডিজিটাল নকশা (CAD)' : 'Digital Drawing (CAD)'}
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'ai'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{isBn ? 'এআই ড্রয়িং' : 'AI Visualizer'}</span>
          </button>
          {onOpenMouzaMap && (
            <button
              onClick={onOpenMouzaMap}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition"
              title={isBn ? 'মৌজা ম্যাপ ও দাগে যান' : 'Go to Mouza Map & Dag'}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isBn ? 'মৌজা ম্যাপ' : 'Mouza Map'}</span>
            </button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Legal Disclaimer Banner (MANDATORY Requirement 15) */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <span className="font-bold">
            {isBn ? 'আইনি সতর্কবার্তা: ' : 'Legal Notice: '}
          </span>
          {isBn
            ? 'এই নকশা মোবাইল GPS ডেটার ভিত্তিতে তৈরি। এটি survey-grade বা আইনগত সীমানা নির্ধারণের প্রমাণ নয়। কেবল মাঠপর্যায়ের প্রাথমিক পরিমাপ ও অনুমানের জন্য ব্যবহারযোগ্য।'
            : 'This drawing is generated from mobile GPS coordinates. It is intended for field visualization and measurement estimation, not as a legal boundary proof.'}
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB A: CAD DIGITAL DRAWING VIEW (Phase 5 Core) */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'drawing' && (
        <div className="space-y-4">
          {/* Survey Source Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Layers className="w-4 h-4 text-emerald-800" />
              <span>{isBn ? 'সার্ভে নির্বাচন করুন:' : 'Select Survey Data:'}</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedSurveyKey}
                onChange={(e) => setSelectedSurveyKey(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
              >
                <option value="active_gps">
                  {isBn
                    ? `বর্তমান সক্রিয় GPS সার্ভে (${activeGpsPoints.length}টি পয়েন্ট)`
                    : `Active GPS Survey (${activeGpsPoints.length} points)`}
                </option>
                {surveys.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.title} ({srv.mouza ? `${srv.mouza} - ` : ''}দাগ {srv.dagNo || '—'})
                  </option>
                ))}
              </select>

              {onNavigateToSurvey && (
                <button
                  onClick={onNavigateToSurvey}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition active:scale-95"
                  title={isBn ? 'GPS ফিল্ড সার্ভেতে যান' : 'Go to GPS Field Survey'}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {isBn ? 'GPS পয়েন্ট তুলুন' : 'Collect Points'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* EMPTY / INSUFFICIENT STATES (Requirement 20) */}
          {validPoints.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800">
                <MapPin className="w-7 h-7 animate-bounce" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  {isBn ? 'কোনো GPS পয়েন্ট পাওয়া যায়নি' : 'No GPS Points Found'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isBn
                    ? 'GPS survey শুরু করে সরজমিনে সীমানার কোণগুলোতে দাঁড়িয়ে পয়েন্ট সংগ্রহ করুন। কেবল ডিভাইস থেকে নেওয়া বাস্তব জিপিএস পয়েন্ট দিয়েই ডিজিটাল নকশা তৈরি হবে।'
                    : 'Start GPS survey and record real boundary corner coordinates in the field. Digital cadastral drawing is generated strictly from real GPS data.'}
                </p>
              </div>

              {onNavigateToSurvey && (
                <button
                  onClick={onNavigateToSurvey}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-md transition active:scale-95"
                >
                  <MapPin className="w-4 h-4 text-amber-300" />
                  <span>{isBn ? 'GPS Survey শুরু করুন' : 'Start GPS Survey'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Notice when points are 1 or 2 */}
              {validPoints.length < 3 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {isBn
                        ? 'নকশা তৈরি করতে কমপক্ষে ৩টি valid point প্রয়োজন।'
                        : 'At least 3 valid points are required to form a closed parcel.'}
                    </span>
                    <span className="text-[11px] text-amber-800">
                      {isBn
                        ? `বর্তমানে ${validPoints.length}টি পয়েন্ট রেকর্ড করা হয়েছে। নিচে পয়েন্ট ও রেখা দেখানো হচ্ছে, আরও পয়েন্ট যোগ করে বহুভুজ সম্পন্ন করুন।`
                        : `Currently ${validPoints.length} point(s) recorded. Add more points to complete the polygon.`}
                    </span>
                  </div>
                </div>
              )}

              {/* Drawing Toolbar (Select, Point, Line, Rect, Dim, Theme, Clear, Save) */}
              <DrawingToolbar
                activeTool={activeTool}
                theme={theme}
                annotationsCount={annotations.length}
                isSaving={isSaving}
                lang={lang}
                onSelectTool={setActiveTool}
                onToggleTheme={() => setTheme(theme === 'blueprint' ? 'light' : 'blueprint')}
                onClearAnnotations={handleClearAnnotations}
                onSaveDrawing={handleSaveDrawing}
              />

              {/* Main Interactive 2D Vector CAD Canvas */}
              <DrawingCanvas
                points={validPoints}
                segments={segments}
                annotations={annotations}
                selectedPointId={selectedPoint?.id || null}
                selectedSegmentIndex={selectedSegmentIndex}
                activeTool={activeTool}
                theme={theme}
                lang={lang}
                onSelectPoint={setSelectedPoint}
                onSelectSegment={setSelectedSegmentIndex}
                onAddAnnotation={handleAddAnnotation}
              />

              {/* Inspector for clicked point or segment */}
              {(selectedPoint || selectedSegmentIndex !== null) && (
                <DrawingPointInspector
                  selectedPoint={selectedPoint}
                  selectedSegment={
                    selectedSegmentIndex !== null ? segments[selectedSegmentIndex] : null
                  }
                  lang={lang}
                  onClose={() => {
                    setSelectedPoint(null);
                    setSelectedSegmentIndex(null);
                  }}
                  onDeletePoint={handleDeletePoint}
                />
              )}

              {/* Professional Area Summary Panel (TASK 8) */}
              <DrawingAreaSummary areaResult={areaResult} lang={lang} />

              {/* Editable Survey Metadata Form (TASK 9) */}
              <DrawingLandMetadata
                metadata={metadata}
                lang={lang}
                onChange={(updated) => setMetadata((prev) => ({ ...prev, ...updated }))}
              />

              {/* Real GPS Coordinate Table (TASK 14) */}
              <DrawingCoordinateTable
                points={projection.points}
                selectedPointId={selectedPoint?.id || null}
                lang={lang}
                onSelectPoint={setSelectedPoint}
              />
            </>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB B: OPTIONAL AI VISUALIZER (Preserved from prior template) */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'ai' && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'এআই ভূমি ও নকশা ভিজ্যুয়ালাইজার' : 'AI Land & Map Visualizer'}
              </h3>
              <p className="text-xs text-slate-500">
                {isBn
                  ? 'আপনার জমির বিবরণ বা মৌজা নকশা রূপরেখার কাল্পনিক দৃশ্য'
                  : 'Conceptual plot layout or mouza sketch visualization'}
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateAi} className="space-y-3">
            <textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={
                isBn
                  ? 'উদাহরণ: নদীর পাশে ৩ বিঘা সবুজ ফসলি জমি ও সীমানা আইলের নকশা...'
                  : 'e.g. 3 bigha agricultural riverside plot layout with boundary ridges...'
              }
              className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={isGeneratingAi || !aiPrompt.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 transition disabled:opacity-50"
            >
              {isGeneratingAi
                ? isBn
                  ? 'তৈরি হচ্ছে...'
                  : 'Generating...'
                : isBn
                ? 'নকশা রূপরেখা তৈরি করুন'
                : 'Generate Concept Illustration'}
            </button>
          </form>

          {generatedAiImage && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <img
                src={generatedAiImage}
                alt="AI Plot"
                className="w-full h-auto object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
