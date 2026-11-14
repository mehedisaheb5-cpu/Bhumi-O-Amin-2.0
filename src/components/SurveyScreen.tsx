import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  AlertTriangle,
  FolderOpen,
  MapPin,
  ShieldAlert,
  Info,
  Layers,
  Plus,
  X,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Ruler,
  Calendar,
  Crosshair,
  Maximize2,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { Language, SurveyRecord, SurveyPoint, SurveyDrawing, PlotMeta } from '../types';
import { PlotMeasurementWorkspace } from './survey/PlotMeasurementWorkspace';
import { DrawingCanvas } from './survey/DrawingCanvas';
import { SideMeasureWizard } from './fieldamin/SideMeasureWizard';
import {
  BAHU_SURVEY_PREFIX,
  SYNC_NOTE_KEY,
  commitCompleted,
  draftFromSurvey,
  handoffToCanvas,
  loadDraft,
  saveDraft,
  syncCanvasIntoDraft,
} from '../lib/bahuDraftStore';
import { toBnDigits } from '../lib/banglaDate';

/** পুরনো বাহুভিত্তিক স্ক্রিন (PlotMeasurementWorkspace) — লুকানো, মুছিনি */
const SHOW_LEGACY_BAHU = false;
/** GPS জরিপ — ফিল্ড আমিন সংস্করণে লুকানো */
const SHOW_GPS = false;
import { translations } from '../data/translations';
import { CurrentGpsPosition, GPSStatus, GpsPoint } from '../lib/gps-types';
import {
  clearGpsPointsFromStorage,
  formatCoordinate,
  formatTime,
  getPointLabel,
  getStoredGpsPoints,
  relabelGpsPoints,
  saveGpsPointsToStorage,
} from '../lib/gps-utils';
import {
  calculatePolygonArea,
  calculatePolygonSegments,
  calculateAccuracyStats,
  getMapReadySurveyData,
  GpsAreaResult,
  GpsAccuracyStats,
  GpsPolygonSegment,
  MapReadySurveyData,
  EARTH_RADIUS_METERS,
} from '../lib/gps-geometry';
import {
  calculateLandUnits,
  formatNumberByLang,
  roundClean,
  LAND_CONSTANTS,
} from '../lib/land-units';
import { GpsLiveCard } from './survey/GpsLiveCard';
import { GpsLiveMap } from './survey/GpsLiveMap';
import { GoogleMapsParcelView } from './survey/GoogleMapsParcelView';
import { GpsPointTable } from './survey/GpsPointTable';
import { GpsSegmentList } from './survey/GpsSegmentList';
import { GpsMeasurementResults } from './survey/GpsMeasurementResults';

import { getStoredBookings } from '../lib/marketplaceStorage';

interface SurveyScreenProps {
  lang: Language;
  surveys: SurveyRecord[];
  onSaveSurvey: (survey: SurveyRecord) => void;
  onOpenMapDrawing?: (surveyId?: string) => void;
  onOpenReport?: (surveyId?: string) => void;
  onOpenHandMap?: (surveyId: string) => void;
  onOpenMouzaMap?: (surveyId?: string) => void;
  bookingId?: string | null;
  initialSurveyId?: string | null;
}

export const SurveyScreen: React.FC<SurveyScreenProps> = ({
  lang,
  surveys,
  onSaveSurvey,
  onOpenMapDrawing,
  onOpenReport,
  onOpenHandMap,
  onOpenMouzaMap,
  bookingId,
  initialSurveyId,
}) => {
  const t = translations[lang].survey;
  const isBn = lang === 'bn';

  // Find linked booking if bookingId provided
  const linkedBooking = useMemo(() => {
    if (!bookingId) return null;
    return getStoredBookings().find((b) => b.id === bookingId) || null;
  }, [bookingId]);

  // View Switcher: Individual Side Measurements (Plots) vs Real GPS Survey vs Saved Records
  const [savedDrawing, setSavedDrawing] = useState<SurveyDrawing | null>(null);
  const [savedPlots, setSavedPlots] = useState<PlotMeta[]>([]);
  useEffect(()=>{
    try{
      const raw=localStorage.getItem('bhumi_possession_drawing_v1');
      if(raw){ const d=JSON.parse(raw); if(d.segments) { setSavedDrawing(d); if(Array.isArray(d.plots)) setSavedPlots(d.plots); } }
    }catch{}
    const onStorage=(e:StorageEvent)=>{ if(e.key==='bhumi_possession_drawing_v1') try{ const d=JSON.parse(e.newValue||'{}'); setSavedDrawing(d.segments?d:null); setSavedPlots(Array.isArray(d.plots)?d.plots:[]);}catch{} };
    const onFocus=()=>{ try{ const raw=localStorage.getItem('bhumi_possession_drawing_v1'); if(raw){ const d=JSON.parse(raw); setSavedDrawing(d.segments?d:null); setSavedPlots(Array.isArray(d.plots)?d.plots:[]);} else { setSavedDrawing(null); setSavedPlots([]);} }catch{} };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    const id=setInterval(onFocus, 2000);
    return ()=>{ window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); clearInterval(id); };
  },[]);

  const [activeTab, setActiveTab] = useState<'plots_survey' | 'drawing_based' | 'gps_survey' | 'saved_records'>(
    initialSurveyId ? 'saved_records' : 'plots_survey'
  );
  const [wizardKey, setWizardKey] = useState(0);
  const [bahuInfoLine, setBahuInfoLine] = useState<string | null>(null);

  /** চিত্র ভিত্তিক ট্যাব খোলার আগে বাহুর নকশা ক্যানভাসে পাঠাই */
  const openDrawingTab = () => {
    const d = loadDraft();
    handoffToCanvas(d, (m) => window.confirm(m));
    setBahuInfoLine(
      d && d.infoDone
        ? `${d.info.clientName} · ${d.info.mouza} · দাগ ${toBnDigits(d.info.dagNo)}`
        : null
    );
    setActiveTab('drawing_based');
  };

  /** চিত্র ভিত্তিক ছেড়ে গেলে (অন্য ট্যাব / অন্য স্ক্রিন) ক্যানভাসের মাপ খসড়া ও রিপোর্টে নিই */
  const latest = useRef({ onSaveSurvey, bookingId });
  latest.current = { onSaveSurvey, bookingId };
  const syncFromCanvas = () => {
    const d = loadDraft();
    if (!d) return;
    const r = syncCanvasIntoDraft(d);
    if (!r.changed) return;
    saveDraft(r.draft);
    try {
      sessionStorage.setItem(SYNC_NOTE_KEY, '1');
    } catch {
      /* ignore */
    }
    if (r.draft.status === 'completed') commitCompleted(r.draft, latest.current.onSaveSurvey, latest.current.bookingId);
  };
  const prevTab = useRef(activeTab);
  useEffect(() => {
    if (prevTab.current === 'drawing_based' && activeTab !== 'drawing_based') syncFromCanvas();
    prevTab.current = activeTab;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  useEffect(
    () => () => {
      if (prevTab.current === 'drawing_based') syncFromCanvas();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** সংরক্ষিত বাহুভিত্তিক জরিপ আবার খুলে এডিট */
  const editBahuSurvey = (survey: SurveyRecord) => {
    const cur = loadDraft();
    if (cur && cur.surveyId !== survey.id && cur.status !== 'completed' && (cur.info.clientName || cur.infoDone)) {
      if (!window.confirm('একটি অসম্পূর্ণ খসড়া আছে। সেটা বাদ দিয়ে এই জরিপ খুলবেন?')) return;
    }
    saveDraft(draftFromSurvey(survey));
    setWizardKey((k) => k + 1);
    setActiveTab('plots_survey');
  };

  // GPS State
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>('ready');
  const [isWatching, setIsWatching] = useState<boolean>(false);
  const [currentPos, setCurrentPos] = useState<CurrentGpsPosition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [points, setPoints] = useState<GpsPoint[]>([]);

  // Watch ID reference
  const watchIdRef = useRef<number | null>(null);

  // Modal for saving current GPS survey into a named survey record
  const [showSaveRecordModal, setShowSaveRecordModal] = useState<boolean>(false);
  const [surveyTitle, setSurveyTitle] = useState<string>(
    linkedBooking ? `${linkedBooking.serviceNameBn || linkedBooking.serviceNameEn} - দাগ ${linkedBooking.land.dagNo}` : ''
  );
  const [surveyMouza, setSurveyMouza] = useState<string>(linkedBooking?.land.mouza || '');
  const [surveyJl, setSurveyJl] = useState<string>(linkedBooking?.land.jlNo || '');
  const [surveyDag, setSurveyDag] = useState<string>(linkedBooking?.land.dagNo || '');
  const [surveyKhatian, setSurveyKhatian] = useState<string>(linkedBooking?.land.khatianNo || '');

  // Expandable details for saved surveys
  const [expandedSurveyId, setExpandedSurveyId] = useState<string | null>(initialSurveyId || null);

  // Phase 15A: Map Engine Switcher ('osm' for existing Leaflet vs 'google' for Google Maps)
  const [mapEngine, setMapEngine] = useState<'osm' | 'google'>('osm');

  // Load stored GPS points from localStorage on mount
  useEffect(() => {
    const saved = getStoredGpsPoints();
    if (saved && saved.length > 0) {
      setPoints(saved);
    }

    // Cleanup GPS watcher when unmounting
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Save points to localStorage whenever points array changes
  const updatePoints = (newPoints: GpsPoint[]) => {
    setPoints(newPoints);
    saveGpsPointsToStorage(newPoints);
  };

  // ---------------------------------------------------------------------------
  // GPS GEOMETRY COMPUTATIONS (Reactive to real collected points)
  // ---------------------------------------------------------------------------
  const areaResult = useMemo<GpsAreaResult | null>(() => {
    if (points.length < 3) return null;
    return calculatePolygonArea(points);
  }, [points]);

  const segments = useMemo<GpsPolygonSegment[]>(() => {
    if (points.length < 2) return [];
    return calculatePolygonSegments(points);
  }, [points]);

  const accuracyStats = useMemo<GpsAccuracyStats | null>(() => {
    return calculateAccuracyStats(points);
  }, [points]);

  const mapReadyData = useMemo<MapReadySurveyData | null>(() => {
    return getMapReadySurveyData(points);
  }, [points]);

  // ---------------------------------------------------------------------------
  // 1. START GPS (Explicit user action only - no automatic prompt!)
  // ---------------------------------------------------------------------------
  const handleStartGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      setErrorMessage(
        isBn
          ? 'আপনার ব্রাউজার বা ডিভাইসে জিপিএস লোকেশন সমর্থিত নয়।'
          : 'Geolocation is not supported by your device or browser.'
      );
      return;
    }

    setErrorMessage(null);
    setGpsStatus('starting');
    setIsWatching(true);

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    };

    const successCallback = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading, speed, altitude } = pos.coords;

      setCurrentPos({
        latitude,
        longitude,
        accuracy,
        heading: heading ?? null,
        speed: speed ?? null,
        altitude: altitude ?? null,
        timestamp: pos.timestamp,
      });

      setErrorMessage(null);
      if (accuracy > 20) {
        setGpsStatus('weak');
      } else {
        setGpsStatus('active');
      }
    };

    const errorCallback = (err: GeolocationPositionError) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setGpsStatus('denied');
          setErrorMessage(
            isBn
              ? 'GPS অনুমতি দেওয়া হয়নি। অনুগ্রহ করে ব্রাউজার সেটিংসে গিয়ে লোকেশন অন করুন।'
              : 'Location permission was denied. Please allow location access in your browser settings.'
          );
          setIsWatching(false);
          break;
        case err.POSITION_UNAVAILABLE:
          setGpsStatus('unavailable');
          setErrorMessage(
            isBn
              ? 'GPS সিগন্যাল পাওয়া যাচ্ছে না। খোলা আকাশের নিচে অবস্থান করুন।'
              : 'GPS position is unavailable. Please make sure you are in an open outdoor area.'
          );
          break;
        case err.TIMEOUT:
          setGpsStatus('timeout');
          setErrorMessage(
            isBn
              ? 'GPS সংযোগে সময়সীমা অতিক্রান্ত হয়েছে (Timeout)। পুনরায় চেষ্টা করুন।'
              : 'GPS connection timed out. Please retry in an open area.'
          );
          break;
        default:
          setGpsStatus('timeout');
          setErrorMessage(err.message || 'GPS Error');
          break;
      }
    };

    try {
      const id = navigator.geolocation.watchPosition(
        successCallback,
        errorCallback,
        geoOptions
      );
      watchIdRef.current = id;
    } catch (e) {
      setGpsStatus('unavailable');
      setErrorMessage(
        isBn
          ? 'GPS চালু করতে সমস্যা হয়েছে।'
          : 'Failed to initialize GPS tracking.'
      );
      setIsWatching(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. STOP GPS
  // ---------------------------------------------------------------------------
  const handleStopGps = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
    setGpsStatus('ready');
  };

  // ---------------------------------------------------------------------------
  // 3. TAKE REAL GPS POINT
  // ---------------------------------------------------------------------------
  const handleTakePoint = () => {
    if (!currentPos) return;

    const nextIdx = points.length;
    const label = getPointLabel(nextIdx);
    const now = Date.now();

    const newPoint: GpsPoint = {
      id: 'gps_' + now + '_' + Math.random().toString(36).substring(2, 6),
      label,
      latitude: currentPos.latitude,
      longitude: currentPos.longitude,
      accuracy: currentPos.accuracy,
      timestamp: now,
      timeStr: formatTime(now, lang),
    };

    const updated = [...points, newPoint];
    updatePoints(updated);
  };

  // ---------------------------------------------------------------------------
  // 4. DELETE INDIVIDUAL POINT & RE-LABEL
  // ---------------------------------------------------------------------------
  const handleDeletePoint = (id: string) => {
    const filtered = points.filter((p) => p.id !== id);
    const relabeled = relabelGpsPoints(filtered);
    updatePoints(relabeled);
  };

  // ---------------------------------------------------------------------------
  // 5. CLEAR ALL POINTS
  // ---------------------------------------------------------------------------
  const handleClearAll = () => {
    updatePoints([]);
    clearGpsPointsFromStorage();
  };

  // ---------------------------------------------------------------------------
  // 6. SAVE AS FORMAL SURVEY RECORD (TASK 7)
  // Saves actual calculated area, perimeter, and real lat/lng coordinates
  // ---------------------------------------------------------------------------
  const handleSaveAsRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyTitle.trim() || points.length < 3) return;

    const calculatedAreaSqFt = areaResult ? areaResult.areaSqFt : 0;
    const calculatedPerimeterFt = areaResult ? areaResult.perimeterFt : 0;

    // Origin point for mathematical local projection (Point A)
    const originLat = points[0].latitude;
    const originLng = points[0].longitude;
    const cosOriginLat = Math.cos((originLat * Math.PI) / 180);

    // Map segments by fromIndex to extract segment bearing & distance for each point
    const segmentMap = new Map<number, GpsPolygonSegment>();
    segments.forEach((seg) => {
      segmentMap.set(seg.fromIndex, seg);
    });

    const surveyPoints: SurveyPoint[] = points.map((p, idx) => {
      const seg = segmentMap.get(idx);
      // Metric projection relative to Point A (converted to feet for CAD/canvas compatibility)
      const xMeters = (p.longitude - originLng) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosOriginLat;
      const yMeters = (p.latitude - originLat) * (Math.PI / 180) * EARTH_RADIUS_METERS;
      const xFeet = roundClean(xMeters * LAND_CONSTANTS.FEET_PER_METER, 2);
      const yFeet = roundClean(yMeters * LAND_CONSTANTS.FEET_PER_METER, 2);

      return {
        id: p.id,
        name: `${isBn ? 'পয়েন্ট' : 'Point'} ${p.label}`,
        label: p.label,
        lat: p.latitude,
        lng: p.longitude,
        x: xFeet,
        y: yFeet,
        bearing: seg ? seg.bearingDegrees : undefined,
        distance: seg ? seg.distanceFeet : undefined,
        accuracy: p.accuracy,
        timestamp: p.timestamp,
      };
    });

    const avgAccText = accuracyStats ? `±${accuracyStats.averageAccuracy}m` : 'N/A';
    const notes = isBn
      ? `রিয়েল GPS সার্ভে (${formatNumberByLang(points.length, lang)}টি পয়েন্ট, গড় নির্ভুলতা: ${avgAccText})`
      : `Real GPS survey (${points.length} points, avg accuracy: ${avgAccText})`;

    const newRecord: SurveyRecord = {
      id: `srv-gps-${Date.now()}`,
      title: surveyTitle.trim(),
      mouza: surveyMouza.trim() || (isBn ? 'নমুনা মৌজা' : 'Sample Mouza'),
      jlNo: surveyJl.trim() || '১',
      dagNo: surveyDag.trim() || '১০০',
      khatianNo: surveyKhatian.trim() || '১০১',
      date: new Date().toISOString().split('T')[0],
      areaSqFt: roundClean(calculatedAreaSqFt, 2),
      perimeterFt: roundClean(calculatedPerimeterFt, 2),
      status: 'completed',
      points: surveyPoints,
      bookingId: bookingId || undefined,
      customerId: linkedBooking?.customerId,
      clientName: linkedBooking?.customer.name,
      district: linkedBooking?.land.district,
      upazila: linkedBooking?.land.upazila,
      union: linkedBooking?.land.union,
      notes,
    };

    onSaveSurvey(newRecord);
    setShowSaveRecordModal(false);
    setSurveyTitle('');
    setSurveyMouza('');
    setSurveyJl('');
    setSurveyDag('');
    setSurveyKhatian('');
    setActiveTab('saved_records');
  };

  const toggleExpandSurvey = (id: string) => {
    setExpandedSurveyId(expandedSurveyId === id ? null : id);
  };

  const drawingThumbPlots = (()=>{
    if(!savedDrawing || !savedDrawing.segments.length) return [];
    // lightweight polygons calc for saved list (same as canvas but simplified)
    const segs=savedDrawing.segments as any[];
    const key=(p:{x:number;y:number})=>`${Math.round(p.x)},${Math.round(p.y)}`;
    const seen=new Set<string>();
    const out:any[]=[];
    const adj=new Map<string,any[]>();
    for(const sg of segs){ for(const pt of [{x:sg.x1,y:sg.y1},{x:sg.x2,y:sg.y2}]){ const k=key(pt); const a=adj.get(k)||[]; a.push(sg); adj.set(k,a);} }
    for(const start of segs){
      for(const dir of [0,1] as const){
        const sp=dir===0?{x:start.x1,y:start.y1}:{x:start.x2,y:start.y2};
        const fp=dir===0?{x:start.x2,y:start.y2}:{x:start.x1,y:start.y1};
        const sk=key(sp);
        const dfs=(ck:string, prev:any, ids:string[], sides:any[], pts:any[])=>{
          if(ids.length===4){ if(ck===sk){ const pid=ids.slice().sort().join('|'); if(seen.has(pid)) return; seen.add(pid); const uniq=pts.slice(0,4); const cx=uniq.reduce((a:number,q:any)=>a+q.x,0)/uniq.length; const cy=uniq.reduce((a:number,q:any)=>a+q.y,0)/uniq.length; out.push({id:pid, pts:uniq, sides, cx, cy, color:start.color}); } return; }
          if(ids.length>4) return;
          const cand=adj.get(ck)||[];
          for(const nxt of cand){ if(nxt===prev) continue; if(ids.includes(nxt.id)) continue; const a=key({x:nxt.x1,y:nxt.y1}), b=key({x:nxt.x2,y:nxt.y2}); if(a!==ck && b!==ck) continue; const to=a===ck?b:a; const apt=a===ck?{x:nxt.x2,y:nxt.y2}:{x:nxt.x1,y:nxt.y1}; if(to===sk && ids.length!==3) continue; if(to!==sk && ids.length===3) continue; dfs(to,nxt,[...ids,nxt.id],[...sides,nxt.lengthFt],[...pts,apt]); }
        };
        dfs(key(fp), start, [start.id], [start.lengthFt], [sp,fp]);
      }
    }
    return out;
  })();

  const handleLoadSavedToMap = (survey: SurveyRecord) => {
    const geoPoints = survey.points.filter((pt) => pt.lat !== undefined && pt.lng !== undefined);
    if (geoPoints.length === 0) return;

    const loadedPoints: GpsPoint[] = geoPoints.map((pt, idx) => ({
      id: pt.id || `pt-${Date.now()}-${idx}`,
      label: pt.label || getPointLabel(idx),
      latitude: pt.lat!,
      longitude: pt.lng!,
      accuracy: pt.accuracy,
      timestamp: pt.timestamp || Date.now(),
      timeStr: pt.timestamp ? formatTime(pt.timestamp, lang) : undefined,
    }));

    updatePoints(loadedPoints);
    setActiveTab('gps_survey');
  };

  return (
    <div id="gps-survey-screen" className={`${activeTab === 'drawing_based' ? 'space-y-1 pb-1' : 'space-y-4 pb-12'} animate-fadeIn`}>
      {/* Linked Booking Indicator Banner */}
      {linkedBooking && (
        <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-teal-200 text-teal-900 text-[11px]">
              {linkedBooking.id}
            </span>
            <span>
              {isBn
                ? `বুকিংয়ের জন্য পরিমাপ চলছে — গ্রাহক: ${linkedBooking.customer.name}, মৌজা: ${linkedBooking.land.mouza}, দাগ: ${linkedBooking.land.dagNo}`
                : `Surveying for Booking — Client: ${linkedBooking.customer.name}, Mouza: ${linkedBooking.land.mouza}, Dag: ${linkedBooking.land.dagNo}`}
            </span>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
{false && (
        <div>
          <h2 className="text-xl font-bold text-slate-900">{isBn ? 'দখল পরিমাপ' : 'Possession Measurement'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isBn ? 'বাহু মেপে বা চিত্র এঁকে জমির নকশা ও ক্ষেত্রফল নির্ণয় করুন' : 'Measure sides or draw the plot to get the plan and area'}</p>
        </div>
      )}

        {/* View Switcher: Individual Side Measurements (Plots) vs Real GPS Survey vs Saved Records */}
        <div className={`${activeTab === 'drawing_based' ? 'hidden' : 'flex'} w-full bg-slate-100 p-1 rounded-2xl border border-slate-200 text-[15px] font-bold [&>button]:flex-1 [&>button]:min-h-[48px] [&>button]:leading-tight [&>button]:px-1.5`}>
          <button
            onClick={() => setActiveTab('plots_survey')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'plots_survey'
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isBn ? 'বাহুভিত্তিক' : 'Side Measurement'}
          </button>
          <button
            id="tab-drawing-based"
            onClick={openDrawingTab}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'drawing_based'
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isBn ? 'চিত্র ভিত্তিক' : 'Drawing-based'}
          </button>
          {/* GPS tab button hidden */}
          <button
            onClick={() => setActiveTab('saved_records')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'saved_records'
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isBn ? 'সংরক্ষিত' : t.savedSurveys} ({formatNumberByLang(surveys.length, lang)})
          </button>
        </div>
      </div>

      {activeTab === 'plots_survey' ? (
        SHOW_LEGACY_BAHU ? (
          <PlotMeasurementWorkspace
            lang={lang}
            surveys={surveys}
            onSaveSurvey={onSaveSurvey}
            onOpenReport={onOpenReport}
            onOpenMapDrawing={onOpenMapDrawing}
            bookingId={bookingId}
          />
        ) : (
          <SideMeasureWizard
            key={wizardKey}
            lang={lang}
            onSaveSurvey={onSaveSurvey}
            onOpenReport={onOpenReport}
            onOpenDrawing={openDrawingTab}
            bookingId={bookingId}
          />
        )
      ) : activeTab === 'drawing_based' ? (
        <div style={{ ['--fa-canvas-offset' as string]: '3.25rem' } as React.CSSProperties}>
          {/* বাহু থেকে আসা কাজের তথ্য + ফেরার বোতাম (ক্যানভাসের ভেতরে হাত দিইনি) */}
          <div id="drawing-info-strip" className="flex items-center gap-2 h-[2.9rem] mb-1">
            <button
              onClick={() => setActiveTab('plots_survey')}
              className="shrink-0 h-full px-3 rounded-xl bg-emerald-800 text-white text-[15px] font-extrabold"
            >
              ← বাহুভিত্তিক
            </button>
            <div className="flex-1 min-w-0 h-full px-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center">
              <span className="truncate text-[15px] font-bold text-emerald-950">
                {bahuInfoLine || (isBn ? 'চিত্র ভিত্তিক পরিমাপ' : 'Drawing-based')}
              </span>
            </div>
            <button
              onClick={() => setActiveTab('saved_records')}
              className="shrink-0 h-full px-3 rounded-xl bg-white border-2 border-slate-300 text-slate-800 text-[15px] font-bold"
            >
              {isBn ? 'তালিকা' : 'List'}
            </button>
          </div>
          <DrawingCanvas lang={lang} />
        </div>
      ) : activeTab === 'gps_survey' ? (
        <>
          {/* MANDATORY LEGAL DISCLAIMER BANNER (TASK 10) */}
          <div
            id="gps-legal-disclaimer"
            className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-amber-950 text-xs leading-relaxed shadow-2xs"
          >
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-900">
                {isBn ? 'আইনগত ও কারিগরি সতর্কতা:' : 'Legal & Technical Notice:'}
              </span>
              <p className="mt-0.5 text-amber-900/90 font-medium">
                {isBn
                  ? 'মোবাইল GPS-এর পরিমাপ আনুমানিক। এটি survey-grade বা আইনগত সীমানা নির্ধারণের প্রমাণ নয়।'
                  : 'Mobile GPS measurements are approximate. They are not survey-grade or legally binding.'}
              </p>
            </div>
          </div>

          {/* REAL GPS LIVE DASHBOARD */}
          <GpsLiveCard
            gpsStatus={gpsStatus}
            isWatching={isWatching}
            currentPos={currentPos}
            errorMessage={errorMessage}
            pointCount={points.length}
            lang={lang}
            onStartGps={handleStartGps}
            onStopGps={handleStopGps}
            onTakePoint={handleTakePoint}
          />

          {/* MAP ENGINE SWITCHER (PHASE 15A) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-800" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  {isBn ? 'ম্যাপ ডিসপ্লে ইঞ্জিন' : 'Map Display Engine'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {isBn ? 'ওপেনস্ট্রিটম্যাপ অথবা গুগল ম্যাপস নির্বাচন করুন' : 'Choose OpenStreetMap or Google Maps'}
                </span>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-start sm:self-center">
              <button
                type="button"
                onClick={() => setMapEngine('osm')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  mapEngine === 'osm'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isBn ? 'ওপেনস্ট্রিট ম্যাপ' : 'OpenStreetMap'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMapEngine('google')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  mapEngine === 'google'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{isBn ? 'গুগল ম্যাপস' : 'Google Maps'}</span>
              </button>
            </div>
          </div>

          {/* RENDER ACTIVE MAP ENGINE */}
          {mapEngine === 'osm' ? (
            /* PHASE 4: INTERACTIVE LIVE GPS MAP & BOUNDARY VISUALIZATION (OPENSTREETMAP) */
            <GpsLiveMap
              currentPos={currentPos}
              points={points}
              segments={segments}
              areaResult={areaResult}
              accuracyStats={accuracyStats}
              isWatching={isWatching}
              lang={lang}
              onStartGps={handleStartGps}
            />
          ) : (
            /* PHASE 15A: DEDICATED GOOGLE MAPS PARCEL & SURVEY VIEW */
            <GoogleMapsParcelView
              currentPos={currentPos}
              points={points}
              isWatching={isWatching}
              lang={lang}
              onStartGps={handleStartGps}
            />
          )}

          {/* COLLECTED GPS POINTS LIST */}
          <GpsPointTable
            points={points}
            lang={lang}
            onDeletePoint={handleDeletePoint}
            onClearAll={handleClearAll}
          />

          {/* POINT-TO-POINT MEASUREMENT SEGMENTS (TASK 2) */}
          {points.length >= 2 && (
            <GpsSegmentList
              segments={segments}
              lang={lang}
              pointCount={points.length}
            />
          )}

          {/* MEASUREMENT RESULTS CARD (TASK 3, 4, 5, 6, 9) */}
          <GpsMeasurementResults
            points={points}
            areaResult={areaResult}
            accuracyStats={accuracyStats}
            lang={lang}
          />

          {/* SAVE AS FORMAL SURVEY RECORD (TASK 7) */}
          {points.length >= 3 && areaResult && areaResult.isValid && (
            <div
              id="save-survey-action-box"
              className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex items-center justify-between flex-wrap gap-3 shadow-2xs animate-fadeIn"
            >
              <div>
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-emerald-800" />
                  <span>{isBn ? 'সার্ভে রেকর্ড সংরক্ষণ' : 'Save As Formal Survey'}</span>
                </h4>
                <p className="text-[11px] text-emerald-900/90 mt-0.5">
                  {isBn
                    ? `${formatNumberByLang(points.length, lang)}টি রিয়েল GPS পয়েন্ট দিয়ে স্থায়ী খতিয়ান ও দাগ রেকর্ড তৈরি করুন`
                    : `Save real survey record from ${points.length} collected GPS coordinates`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onOpenMapDrawing && (
                  <button
                    onClick={() => onOpenMapDrawing('active_gps')}
                    className="px-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-50 shadow-2xs transition active:scale-95 flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'ডিজিটাল নকশা' : 'Digital Drawing'}</span>
                  </button>
                )}
                {onOpenReport && (
                  <button
                    onClick={() => {
                      if (surveys.length > 0) {
                        onOpenReport(surveys[0].id);
                      } else {
                        setShowSaveRecordModal(true);
                      }
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-50 shadow-2xs transition active:scale-95 flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{isBn ? 'রিপোর্ট ও PDF' : 'Report & PDF'}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowSaveRecordModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-900 text-white text-xs font-bold hover:bg-emerald-950 shadow-xs transition active:scale-95 flex items-center gap-1.5"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{isBn ? 'রেকর্ড সংরক্ষণ করুন' : 'Save Record'}</span>
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* SAVED SURVEY RECORDS TAB (TASK 8) */
        <div id="saved-records-view" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-emerald-800" />
              <span>
                {t.savedSurveys} ({formatNumberByLang(surveys.length, lang)})
              </span>
            </h3>
            {surveys.length > 0 && (
              <button
                onClick={() => setActiveTab(SHOW_GPS ? 'gps_survey' : 'plots_survey')}
                className="text-[15px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 min-h-[44px] px-2"
              >
                <span>{isBn ? '+ নতুন জরিপ' : '+ New Survey'}</span>
              </button>
            )}
          </div>

          {/* Drawing autosave — small thumbnail + per-plot details (simple clean) */}
          {savedDrawing && savedDrawing.segments.length>0 && (
            <div className="p-3 rounded-2xl bg-white border border-emerald-200/80 shadow-xs flex gap-3 items-start">
              <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0">
                <svg viewBox="0 0 400 400" className="w-full h-full">
                  <rect width="400" height="400" fill="#f8fafc" />
                  {savedDrawing.segments.map((sg:any)=>(
                    <line key={sg.id} x1={sg.x1} y1={sg.y1} x2={sg.x2} y2={sg.y2} stroke={sg.color||'#065f46'} strokeWidth={3} strokeLinecap="round" />
                  ))}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{isBn? 'অঙ্কিত ড্রয়িং':'Drawn Plot'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">{drawingThumbPlots.length} {isBn? 'প্লট':'plots'}</span>
                  <span className="text-[10px] text-slate-400">{new Date(savedDrawing.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {drawingThumbPlots.map((pl:any, idx:number)=>{ 
                    const meta=savedPlots.find((m:any)=> m.id===pl.id);
                    const sides=(pl.sides||pl.sidesFt||[]).filter((v:any)=> typeof v==='number' && v>0);
                    let dec='—';
                    if(sides.length>=4){
                      const a=pl.sides[0] as number||0, b=pl.sides[1] as number||0, c=pl.sides[2] as number||0, d=pl.sides[3] as number||0;
                      const sq= sides.length===4 ? ((a+c)/2)*((b+d)/2) : (sides.reduce((x:number,y:number)=>x+y,0)/sides.length)**2;
                      dec=(sq/435.6).toFixed(2);
                    }
                    const name=meta?.title || `${isBn? 'প্লট':'Plot'} ${idx+1}`;
                    const dag=meta?.dagNo ? `দাগ ${meta.dagNo}` : '';
                    return (
                      <div key={pl.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50/70 border border-slate-200/60 rounded-lg px-2 py-1">
                        <span className="font-semibold text-slate-800 truncate">{name} {dag? `• ${dag}`:''}</span>
                        <span className="font-bold text-emerald-800 whitespace-nowrap">{dec} {isBn? 'শতক':'dec'}</span>
                      </div>
                    );
                  })}
                  {drawingThumbPlots.length===0 && (
                    <div className="text-xs text-slate-500">{savedDrawing.segments.length} {isBn? 'দাগ আঁকা আছে':'lines'}</div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={()=> setActiveTab('drawing_based')} className="text-xs font-bold text-emerald-800 hover:underline">{isBn? 'ড্রয়িং এ ফিরুন':'Open Drawing'}</button>
                  <button onClick={()=> { if(confirm(isBn? 'ড্রয়িং মুছবেন?':'Clear drawing?')){ localStorage.removeItem('bhumi_possession_drawing_v1'); setSavedDrawing(null); setSavedPlots([]);} }} className="text-xs text-slate-500 hover:text-rose-600">{isBn? 'মুছুন':'Clear'}</button>
                </div>
              </div>
            </div>
          )}
          {surveys.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-white border border-slate-200/90 p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {isBn ? 'কোনো সংরক্ষিত সার্ভে পাওয়া যায়নি' : 'No saved surveys yet'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {isBn
                    ? 'বাহুভিত্তিক মাপ দিয়ে "সম্পন্ন" চাপলে জরিপ এখানে জমা হবে।'
                    : 'Measure sides and tap "Done" to save a survey here.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab(SHOW_GPS ? 'gps_survey' : 'plots_survey')}
                className="px-5 min-h-[50px] rounded-xl bg-emerald-900 text-white text-[16px] font-bold hover:bg-emerald-950 transition"
              >
                {isBn ? (SHOW_GPS ? 'GPS জরিপ শুরু করুন' : 'বাহু মেপে জরিপ শুরু করুন') : 'Start Survey'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {surveys.map((survey) => {
                const isExpanded = expandedSurveyId === survey.id;
                // Calculate all Bangladesh land units from the saved actual area and perimeter
                const units = calculateLandUnits(survey.areaSqFt, survey.perimeterFt);

                return (
                  <div
                    key={survey.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-400 shadow-xs transition space-y-3"
                  >
                    {/* Title and Top Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                          {survey.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-0.5">
                          <span>
                            {isBn ? 'মৌজা' : 'Mouza'}:{' '}
                            <strong className="text-slate-800">{survey.mouza}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            {isBn ? 'জে.এল.' : 'J.L.'}:{' '}
                            <strong className="text-slate-800">{survey.jlNo}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            {isBn ? 'দাগ' : 'Dag'}:{' '}
                            <strong className="text-slate-800">{survey.dagNo}</strong>
                          </span>
                          {survey.khatianNo && (
                            <>
                              <span>•</span>
                              <span>
                                {isBn ? 'খতিয়ান' : 'Khatian'}:{' '}
                                <strong className="text-slate-800">{survey.khatianNo}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status & Point Count */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {SHOW_GPS ? (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            {formatNumberByLang(survey.points.length, lang)} {isBn ? 'পয়েন্ট' : 'pts'}
                          </span>
                        ) : (
                          <span
                            className={`text-[13px] font-bold px-2.5 py-0.5 rounded-full border ${
                              survey.status === 'draft'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {survey.status === 'draft' ? 'খসড়া' : 'সম্পন্ন ✓'}
                          </span>
                        )}
                        <span className="text-[13px] text-slate-500 font-semibold">
                          {isBn ? toBnDigits(survey.date) : survey.date}
                        </span>
                      </div>
                    </div>

                    {/* Calculated Area and Perimeter Grid (TASK 8) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                      {/* Decimal / Shatangsha */}
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80">
                        <span className="text-[10px] font-bold text-amber-800 block">
                          {isBn ? 'শতাংশ / শতক' : 'Decimal (Shotok)'}
                        </span>
                        <p className="text-sm font-black text-amber-950 mt-0.5">
                          {formatNumberByLang(roundClean(units.shatangsha, 3), lang)}
                        </p>
                      </div>

                      {/* Square Feet */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-600 block">
                          {isBn ? 'বর্গফুট' : 'Sq Feet'}
                        </span>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          {formatNumberByLang(roundClean(units.sqFt, 2), lang)}
                        </p>
                      </div>

                      {/* Katha */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-600 block">
                          {isBn ? 'কাঠা' : 'Katha'}
                        </span>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          {formatNumberByLang(roundClean(units.katha, 3), lang)}
                        </p>
                      </div>

                      {/* Perimeter */}
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950">
                        <span className="text-[10px] font-bold text-emerald-800 block">
                          {isBn ? 'পরিসীমা' : 'Perimeter'}
                        </span>
                        <p className="text-sm font-black text-emerald-950 mt-0.5">
                          {formatNumberByLang(roundClean(survey.perimeterFt, 2), lang)}{' '}
                          <span className="text-[10px] font-normal">{isBn ? 'ফুট' : 'ft'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Notes Box */}
                    {survey.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                        {survey.notes}
                      </p>
                    )}

                    {/* Accordion Toggle for Points List & View on Map Action */}
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpandSurvey(survey.id)}
                          className="text-xs font-semibold text-slate-700 hover:text-emerald-800 flex items-center gap-1 transition"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>{isBn ? 'পয়েন্ট বিবরণ লুকান' : 'Hide Points'}</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>
                                {isBn ? 'পয়েন্ট বিবরণ ও স্থানাঙ্ক দেখুন' : 'View Point Coordinates'}
                              </span>
                            </>
                          )}
                        </button>

                        {survey.points.some((p) => p.lat !== undefined && p.lng !== undefined) && (
                          <button
                            onClick={() => handleLoadSavedToMap(survey)}
                            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95"
                          >
                            <Compass className="w-3 h-3" />
                            <span>{isBn ? 'ম্যাপে দেখুন' : 'View on Map'}</span>
                          </button>
                        )}

                        {onOpenMapDrawing && (
                          <button
                            onClick={() => onOpenMapDrawing(survey.id)}
                            className="text-xs font-bold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95"
                          >
                            <Layers className="w-3 h-3" />
                            <span>{isBn ? 'ডিজিটাল নকশা' : 'Digital Drawing'}</span>
                          </button>
                        )}

                        {survey.id.startsWith(BAHU_SURVEY_PREFIX) && (
                          <button
                            onClick={() => editBahuSurvey(survey)}
                            className="text-[14px] font-bold text-emerald-900 bg-white border-2 border-emerald-700 px-3 min-h-[40px] rounded-lg flex items-center gap-1 transition active:scale-95"
                          >
                            ✎ <span>{isBn ? 'খুলুন / এডিট' : 'Open / Edit'}</span>
                          </button>
                        )}

                        {onOpenHandMap && survey.plots && survey.plots.length > 0 && (
                          <button
                            onClick={() => onOpenHandMap(survey.id)}
                            className="text-[14px] font-bold text-amber-900 bg-amber-50 border-2 border-amber-300 px-3 min-h-[40px] rounded-lg flex items-center gap-1 transition active:scale-95"
                          >
                            ✎ <span>{isBn ? 'হ্যান্ড ম্যাপ' : 'Hand map'}</span>
                          </button>
                        )}

                        {onOpenReport && (
                          <button
                            onClick={() => onOpenReport(survey.id)}
                            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95"
                          >
                            <FileText className="w-3 h-3 text-emerald-800" />
                            <span>{isBn ? 'সার্ভে রিপোর্ট' : 'Report'}</span>
                          </button>
                        )}

                        {onOpenMouzaMap && (
                          <button
                            onClick={() => onOpenMouzaMap(survey.id)}
                            className="text-xs font-bold text-cyan-800 hover:text-cyan-950 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95"
                          >
                            <Layers className="w-3 h-3 text-cyan-800" />
                            <span>{isBn ? 'মৌজা ম্যাপে যাচাই' : 'Verify on Mouza'}</span>
                          </button>
                        )}
                      </div>

                      <span className="text-[11px] font-medium text-slate-400">
                        ID: <span className="font-mono">{survey.id}</span>
                      </span>
                    </div>

                    {/* Expanded Points & Plots List */}
                    {isExpanded && (
                      <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-3 animate-fadeIn text-xs">
                        {/* Plots Breakdown if available */}
                        {survey.plots && survey.plots.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              {isBn ? 'অন্তর্ভুক্ত প্লট ও বাহুভিত্তিক পরিমাপ:' : 'Measured Plots & Side Lengths:'}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {survey.plots.map((plot, pIdx) => (
                                <div
                                  key={plot.id || pIdx}
                                  className="p-2 rounded-xl bg-white border border-slate-200 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between font-bold text-slate-900">
                                    <span>{plot.plotName} (দাগ {plot.dagNo})</span>
                                    <span className="text-emerald-800 font-mono">
                                      {plot.decimal !== null ? `${formatNumberByLang(plot.decimal, lang)} শতক` : 'অনির্ধারিত'}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-600 font-mono">
                                    <span>উ: {formatNumberByLang(roundClean(plot.northSide, 1), lang)} ft</span>
                                    <span>দ: {formatNumberByLang(roundClean(plot.southSide, 1), lang)} ft</span>
                                    <span>পূ: {formatNumberByLang(roundClean(plot.eastSide, 1), lang)} ft</span>
                                    <span>প: {formatNumberByLang(roundClean(plot.westSide, 1), lang)} ft</span>
                                    {plot.diagonal && (
                                      <span className="col-span-2 text-amber-800">
                                        কর্ণ: {formatNumberByLang(roundClean(plot.diagonal, 1), lang)} ft
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          {isBn ? 'সংরক্ষিত পয়েন্টের ভৌগোলিক স্থানাঙ্ক:' : 'Recorded Survey Coordinates:'}
                        </span>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {survey.points.map((pt, pIdx) => (
                            <div
                              key={pt.id || pIdx}
                              className="p-2 rounded-lg bg-white border border-slate-200/70 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-md bg-emerald-900 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                                  {pt.label || pt.name.charAt(pt.name.length - 1) || String.fromCharCode(65 + pIdx)}
                                </span>
                                <div>
                                  <p className="font-bold text-slate-900 text-xs">{pt.name}</p>
                                  {pt.lat !== undefined && pt.lng !== undefined ? (
                                    <p className="text-[11px] font-mono text-slate-600">
                                      {formatCoordinate(pt.lat, 'lat')}, {formatCoordinate(pt.lng, 'lng')}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-slate-400">
                                      x: {pt.x}, y: {pt.y}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right text-[11px]">
                                {pt.distance !== undefined && (
                                  <p className="font-bold text-slate-800">
                                    {formatNumberByLang(roundClean(pt.distance, 2), lang)}{' '}
                                    <span className="text-[10px] text-slate-500">{isBn ? 'ফুট' : 'ft'}</span>
                                  </p>
                                )}
                                {pt.accuracy !== undefined && (
                                  <p className="text-[10px] text-emerald-800 font-mono">
                                    ±{formatNumberByLang(roundClean(pt.accuracy, 1), lang)} m
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save Record Modal */}
      {showSaveRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-emerald-100 text-slate-900 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-emerald-800" />
                <h3 className="text-base font-bold text-slate-900">
                  {isBn ? 'জিপিএস সার্ভে রেকর্ড সংরক্ষণ' : 'Save GPS Survey Record'}
                </h3>
              </div>
              <button
                onClick={() => setShowSaveRecordModal(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview of actual calculated values to be saved */}
            {areaResult && (
              <div className="my-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <p className="font-bold text-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                  <span>
                    {isBn ? 'হিসাবকৃত বাস্তব পরিমাপ অন্তর্ভুক্ত হচ্ছে:' : 'Calculated real values included:'}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">{isBn ? 'ক্ষেত্রফল' : 'Area'}:</span>
                    <strong className="text-emerald-950">
                      {formatNumberByLang(roundClean(areaResult.areaSqFt, 2), lang)} {isBn ? 'বর্গফুট' : 'sq ft'} (
                      {formatNumberByLang(roundClean(areaResult.landUnits.shatangsha, 3), lang)} {isBn ? 'শতক' : 'dec'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{isBn ? 'পরিসীমা' : 'Perimeter'}:</span>
                    <strong className="text-emerald-950">
                      {formatNumberByLang(roundClean(areaResult.perimeterFt, 2), lang)} {isBn ? 'ফুট' : 'ft'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveAsRecord} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t.surveyName} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={isBn ? 'যেমন: বাড়ির ভিটা ও পুকুরপাড়' : 'e.g. Homestead & Pond'}
                  value={surveyTitle}
                  onChange={(e) => setSurveyTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t.mouza}
                  </label>
                  <input
                    type="text"
                    placeholder={isBn ? 'যেমন: রামপুর' : 'e.g. Rampur'}
                    value={surveyMouza}
                    onChange={(e) => setSurveyMouza(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t.jlNo}
                  </label>
                  <input
                    type="text"
                    placeholder={isBn ? 'যেমন: ৭৪' : 'e.g. 74'}
                    value={surveyJl}
                    onChange={(e) => setSurveyJl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t.dagNo}
                  </label>
                  <input
                    type="text"
                    placeholder={isBn ? 'যেমন: ৩১২' : 'e.g. 312'}
                    value={surveyDag}
                    onChange={(e) => setSurveyDag(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t.khatianNo}
                  </label>
                  <input
                    type="text"
                    placeholder={isBn ? 'যেমন: ১৫৪' : 'e.g. 154'}
                    value={surveyKhatian}
                    onChange={(e) => setSurveyKhatian(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveRecordModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-900 font-bold text-white hover:bg-emerald-950 shadow-md transition active:scale-95"
                >
                  {t.saveBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
