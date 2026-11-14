import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Ruler,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Save,
  FileText,
  Bookmark,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Split,
  MapPin,
  Copy,
  Share2,
  Link2,
} from 'lucide-react';
import {
  Language,
  SurveyPlotRecord,
  SurveyRecord,
  AdditionalSideMeasurement,
  LengthUnit,
} from '../../types';
import {
  createDefaultPlotRecord,
  recalculatePlot,
  toFeet,
  fromFeet,
  roundVal,
  convertPlotsToSurveyPoints,
  SQFT_PER_DECIMAL,
  SQFT_PER_KATHA,
} from '../../lib/plot-measure-utils';
import { formatNumberByLang, convertToFeet, convertFeetToUnit, getUnitLabel } from '../../lib/land-units';
import { PlotAutomaticDrawing } from './PlotAutomaticDrawing';

import { getStoredBookings } from '../../lib/marketplaceStorage';

interface PlotMeasurementWorkspaceProps {
  lang: Language;
  surveys: SurveyRecord[];
  onSaveSurvey: (survey: SurveyRecord) => void;
  onOpenReport?: (surveyId?: string) => void;
  onOpenMapDrawing?: (surveyId?: string) => void;
  bookingId?: string | null;
}

const STORAGE_KEY = 'bhumi_possession_plots_v1';

export const PlotMeasurementWorkspace: React.FC<PlotMeasurementWorkspaceProps> = ({
  lang,
  surveys,
  onSaveSurvey,
  onOpenReport,
  onOpenMapDrawing,
  bookingId,
}) => {
  const isBn = lang === 'bn';

  // State: List of plots
  const [plots, setPlots] = useState<SurveyPlotRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SurveyPlotRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => recalculatePlot(p));
        }
      }
    } catch (e) {
      console.error('Failed to load saved plots', e);
    }
    // Default initial single plot
    return [createDefaultPlotRecord(0, '১২৪')];
  });

  // Active plot ID for editing
  const [activePlotId, setActivePlotId] = useState<string>(() => plots[0]?.id || '');

  // Survey Metadata
  const [surveyTitle, setSurveyTitle] = useState<string>('বাস্তব দখল পরিমাপ জরিপ');
  const [mouza, setMouza] = useState<string>('চকবস্তা');
  const [jlNo, setJlNo] = useState<string>('০৮');
  const [khatianNo, setKhatianNo] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [surveyNotes, setSurveyNotes] = useState<string>('');

  // UI state for additional sides collapse
  const [showAdditionalSides, setShowAdditionalSides] = useState<boolean>(false);

  // Mobile Field Workflow Steps: 'start' | 'add_plot' | 'add_points' | 'review' | 'save_draft' | 'finish'
  const [fieldStep, setFieldStep] = useState<
    'start' | 'add_plot' | 'add_points' | 'review' | 'save_draft' | 'finish'
  >('add_points');

  // GPS Accuracy & Status
  const [gpsStatus, setGpsStatus] = useState<{
    loading: boolean;
    accuracy?: number;
    latitude?: number;
    longitude?: number;
    error?: string;
  }>({ loading: false });

  // Save feedback state
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Capture GPS coordinates for the active plot
  const handleCaptureGpsPoint = () => {
    if (!navigator.geolocation) {
      setGpsStatus({ loading: false, error: isBn ? 'আপনার ডিভাইসে GPS সমর্থন নেই' : 'GPS not supported' });
      return;
    }
    setGpsStatus({ loading: true });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = Math.round(pos.coords.accuracy);
        setGpsStatus({
          loading: false,
          accuracy,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setSaveSuccessMsg(
          isBn
            ? `GPS পয়েন্ট সফলভাবে গৃহীত (±${accuracy} মিটার নির্ভুলতা)`
            : `GPS captured (±${accuracy}m accuracy)`
        );
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      },
      (err) => {
        setGpsStatus({
          loading: false,
          error: isBn ? 'GPS অবস্থান পাওয়া যায়নি' : 'Unable to retrieve GPS',
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Explicit Draft Actions
  const handleSaveDraft = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plots));
      setSaveSuccessMsg(
        isBn ? 'ড্রাফট সার্ভে ডিভাইসে নিরাপদে সংরক্ষিত হয়েছে!' : 'Survey draft saved locally!'
      );
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (e) {
      alert(isBn ? 'ড্রাফট সংরক্ষণ ব্যর্থ হয়েছে।' : 'Failed to save draft.');
    }
  };

  const handleReloadDraft = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SurveyPlotRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlots(parsed.map((p) => recalculatePlot(p)));
          setActivePlotId(parsed[0].id);
          setSaveSuccessMsg(
            isBn ? 'সংরক্ষিত ড্রাফট সফলভাবে পুনরায় খোলা হয়েছে!' : 'Draft reloaded successfully!'
          );
          setTimeout(() => setSaveSuccessMsg(null), 3000);
        }
      }
    } catch (e) {
      alert(isBn ? 'ড্রাফট লোড করা যায়নি।' : 'Failed to load draft.');
    }
  };

  // Synchronize plots array to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plots));
    } catch (e) {
      console.error('Failed to store plots', e);
    }
  }, [plots]);

  // Active plot object
  const activePlot = useMemo(() => {
    return plots.find((p) => p.id === activePlotId) || plots[0] || null;
  }, [plots, activePlotId]);

  // Ensure activePlotId remains valid if plots are deleted
  useEffect(() => {
    if (!plots.some((p) => p.id === activePlotId) && plots.length > 0) {
      setActivePlotId(plots[0].id);
    }
  }, [plots, activePlotId]);

  // ---------------------------------------------------------------------------
  // PLOT MANAGEMENT ACTIONS
  // ---------------------------------------------------------------------------

  // Add new plot
  const handleAddPlot = () => {
    const nextOrder = plots.length;
    const defaultDag = activePlot ? `${parseInt(activePlot.dagNo || '100', 10) + 1}` : '১২৫';
    const newPlot = createDefaultPlotRecord(nextOrder, defaultDag);
    setPlots((prev) => [...prev, newPlot]);
    setActivePlotId(newPlot.id);
  };

  // Delete a plot
  const handleDeletePlot = (plotId: string) => {
    if (plots.length <= 1) {
      alert(
        isBn
          ? 'অন্তত একটি প্লট থাকা আবশ্যক। পরিমাপ খালি করতে চাইলে মান ০ করতে পারেন।'
          : 'At least one plot is required.'
      );
      return;
    }
    const confirmDelete = window.confirm(
      isBn ? 'আপনি কি নিশ্চিত যে এই প্লটটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this plot?'
    );
    if (!confirmDelete) return;

    setPlots((prev) => {
      const filtered = prev.filter((p) => p.id !== plotId);
      return filtered.map((p, idx) => ({ ...p, order: idx }));
    });
  };

  // Reorder plots (move up / down)
  const handleMovePlot = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= plots.length) return;

    setPlots((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next.map((p, idx) => ({ ...p, order: idx }));
    });
  };

  // Update active plot fields
  const handleUpdateActivePlot = (updates: Partial<SurveyPlotRecord>) => {
    if (!activePlot) return;
    setPlots((prev) => {
      return prev.map((p) => {
        if (p.id === activePlot.id) {
          const merged = { ...p, ...updates };
          return recalculatePlot(merged);
        }
        return p;
      });
    });
  };

  // T1: Unit Conversion — Feet/Meter/Link/Gaj(Yard)/Haat hassle-free
  const handleToggleUnit = (newUnit: LengthUnit) => {
    if (!activePlot || activePlot.unit === newUnit) return;
    const oldUnit = activePlot.unit;
    const convert = (val: number, from: LengthUnit = oldUnit) => {
      if (!val) return 0;
      const ft = convertToFeet(val, from);
      return roundVal(convertFeetToUnit(ft, newUnit), 2);
    };
    const updatedAdditional = (activePlot.additionalSides || []).map((s) => ({
      ...s,
      unit: newUnit,
      length: convert(s.length, s.unit || oldUnit),
    }));
    handleUpdateActivePlot({
      unit: newUnit,
      northSide: convert(activePlot.northSide),
      southSide: convert(activePlot.southSide),
      eastSide: convert(activePlot.eastSide),
      westSide: convert(activePlot.westSide),
      diagonal: activePlot.diagonal ? convert(activePlot.diagonal) : undefined,
      additionalSides: updatedAdditional,
    });
  };

  // Add Additional Side to Active Plot
  const handleAddAdditionalSide = () => {
    if (!activePlot) return;
    const count = (activePlot.additionalSides || []).length + 1;
    const newSide: AdditionalSideMeasurement = {
      id: `add-side-${Date.now()}`,
      name: isBn ? `অতিরিক্ত সীমানা ${formatNumberByLang(count, lang)}` : `Boundary Side ${count}`,
      length: 0,
      unit: activePlot.unit,
      notes: '',
    };
    handleUpdateActivePlot({
      additionalSides: [...(activePlot.additionalSides || []), newSide],
    });
    setShowAdditionalSides(true);
  };

  // Update an additional side
  const handleUpdateAdditionalSide = (
    sideId: string,
    updates: Partial<AdditionalSideMeasurement>
  ) => {
    if (!activePlot) return;
    const updated = (activePlot.additionalSides || []).map((s) => {
      if (s.id === sideId) return { ...s, ...updates };
      return s;
    });
    handleUpdateActivePlot({ additionalSides: updated });
  };

  // Delete an additional side
  const handleDeleteAdditionalSide = (sideId: string) => {
    if (!activePlot) return;
    const updated = (activePlot.additionalSides || []).filter((s) => s.id !== sideId);
    handleUpdateActivePlot({ additionalSides: updated });
  };

  // A: Hassle-free live helpers — ideal diagonal + quick example (T1–T3)
  const idealDiagonal = useMemo(() => {
    if (!activePlot) return null;
    const n = convertToFeet(activePlot.northSide || 0, activePlot.unit);
    const s = convertToFeet(activePlot.southSide || 0, activePlot.unit);
    const e = convertToFeet(activePlot.eastSide || 0, activePlot.unit);
    const w = convertToFeet(activePlot.westSide || 0, activePlot.unit);
    if (!(n > 0 && s > 0 && e > 0 && w > 0)) return null;
    const acMinFt = Math.max(Math.abs(n - e), Math.abs(s - w)) + 0.5;
    const acMaxFt = Math.min(n + e, s + w) - 0.5;
    const bdMinFt = Math.max(Math.abs(e - s), Math.abs(w - n)) + 0.5;
    const bdMaxFt = Math.min(e + s, w + n) - 0.5;
    if (acMinFt >= acMaxFt || bdMinFt >= bdMaxFt) return null;
    const toUnit = (ft: number) => roundVal(convertFeetToUnit(ft, activePlot.unit), 1);
    const midAc = roundVal((toUnit(acMinFt) + toUnit(acMaxFt)) / 2, 1);
    const midBd = roundVal((toUnit(bdMinFt) + toUnit(bdMaxFt)) / 2, 1);
    return {
      acMin: toUnit(acMinFt),
      acMax: toUnit(acMaxFt),
      bdMin: toUnit(bdMinFt),
      bdMax: toUnit(bdMaxFt),
      midAc,
      midBd,
      unitLabel: getUnitLabel(activePlot.unit, lang).replace(' (ft)','').replace(' (m)','').replace('Feet','ft').replace('Meter','m'),
    };
  }, [activePlot?.northSide, activePlot?.southSide, activePlot?.eastSide, activePlot?.westSide, activePlot?.unit, lang]);

  const handleFillExample = () => {
    if (!activePlot) return;
    if (activePlot.unit === 'meter') {
      handleUpdateActivePlot({ northSide: 18.3, southSide: 18.9, eastSide: 30.5, westSide: 29.9, diagonal: undefined, calculationMethod: 'average' });
    } else if (activePlot.unit === 'link') {
      handleUpdateActivePlot({ northSide: 91, southSide: 94, eastSide: 152, westSide: 148, diagonal: undefined, calculationMethod: 'average' });
    } else if (activePlot.unit === 'yard') {
      handleUpdateActivePlot({ northSide: 20, southSide: 20.7, eastSide: 33.3, westSide: 32.7, diagonal: undefined, calculationMethod: 'average' });
    } else {
      handleUpdateActivePlot({ northSide: 60, southSide: 62, eastSide: 100, westSide: 98, diagonal: undefined, calculationMethod: 'average' });
    }
  };

  // T2: Copy & WhatsApp 1-tap share
  const handleCopyResult = async () => {
    if (!activePlot || activePlot.decimal === null) return;
    const dag = activePlot.dagNo || '—';
    const txt = isBn
      ? `দখল পরিমাপ — দাগ ${dag}: ${formatNumberByLang(activePlot.decimal, lang)} শতাংশ (${formatNumberByLang(activePlot.katha || 0, lang)} কাঠা, ${formatNumberByLang(activePlot.bigha || 0, lang)} বিঘা) • পরিসীমা ${formatNumberByLang(activePlot.perimeterFt, lang)} ফুট • ${formatNumberByLang(activePlot.areaSqFt || 0, lang)} বর্গফুট — ভূমি ও আমিন`
      : `Possession — Dag ${dag}: ${activePlot.decimal} dec (${activePlot.katha} katha, ${activePlot.bigha} bigha) • ${activePlot.perimeterFt} ft • ${activePlot.areaSqFt} sq ft — Bhumi O Amin`;
    try {
      await navigator.clipboard.writeText(txt);
      setSaveSuccessMsg(isBn ? '📋 কপি হয়েছে — পেস্ট করুন!' : '📋 Copied!');
      setTimeout(() => setSaveSuccessMsg(null), 2500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      setSaveSuccessMsg(isBn ? '📋 কপি হয়েছে!' : '📋 Copied!');
      setTimeout(() => setSaveSuccessMsg(null), 2500);
    }
  };
  const handleWhatsAppShare = () => {
    if (!activePlot || activePlot.decimal === null) return;
    const dag = activePlot.dagNo || '—';
    const txt = isBn
      ? `দখল পরিমাপ — দাগ ${dag}: ${formatNumberByLang(activePlot.decimal, lang)} শতাংশ (${formatNumberByLang(activePlot.katha || 0, lang)} কাঠা) • পরিসীমা ${formatNumberByLang(activePlot.perimeterFt, lang)} ফুট • ${formatNumberByLang(activePlot.areaSqFt || 0, lang)} বর্গফুট — ভূমি ও আমিন ${window.location.origin}`
      : `Possession Dag ${dag}: ${activePlot.decimal} dec (${activePlot.katha} katha) • ${activePlot.perimeterFt} ft — Bhumi O Amin ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };
  // T3: tap ideal chip → auto-fill diagonal + switch to exact
  const handleApplyIdealDiagonal = (choice: 'AC' | 'BD') => {
    if (!idealDiagonal) return;
    const mid = choice === 'AC' ? idealDiagonal.midAc : idealDiagonal.midBd;
    handleUpdateActivePlot({ diagonal: mid, diagonalChoice: choice, calculationMethod: 'diagonal' });
  };

  // ---------------------------------------------------------------------------
  // MULTI-PLOT TOTALS COMPUTATION
  // ---------------------------------------------------------------------------
  const multiPlotTotals = useMemo(() => {
    let totalPerimeterFt = 0;
    let totalAreaSqFt = 0;
    let allAreasValid = true;
    let anyAreaValid = false;

    plots.forEach((p) => {
      totalPerimeterFt += p.perimeterFt;
      if (p.areaSqFt !== null && p.areaSqFt > 0) {
        totalAreaSqFt += p.areaSqFt;
        anyAreaValid = true;
      } else {
        allAreasValid = false;
      }
    });

    const totalDecimal = allAreasValid ? roundVal(totalAreaSqFt / SQFT_PER_DECIMAL, 3) : null;
    const totalKatha = allAreasValid ? roundVal(totalAreaSqFt / SQFT_PER_KATHA, 3) : null;

    return {
      count: plots.length,
      totalPerimeterFt: roundVal(totalPerimeterFt, 1),
      totalAreaSqFt: allAreasValid ? roundVal(totalAreaSqFt, 1) : null,
      totalDecimal,
      totalKatha,
      allAreasValid,
      anyAreaValid,
    };
  }, [plots]);

  // ---------------------------------------------------------------------------
  // SAVE ENTIRE MULTI-PLOT SURVEY INTO SURVEYRECORD
  // ---------------------------------------------------------------------------
  const handleSaveAllPlots = () => {
    // Generate standard SurveyPoint[] for compatibility with existing maps & reports
    const generatedPoints = convertPlotsToSurveyPoints(plots);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const surveyId = `survey-plots-${Date.now()}`;
    const primaryDag = plots.map((p) => p.dagNo).filter(Boolean).join(', ') || '১২৪';

    const recordToSave: SurveyRecord = {
      id: surveyId,
      title: surveyTitle || (isBn ? 'বাস্তব দখল পরিমাপ ও বহুখণ্ড প্লট জরিপ' : 'Possession Boundary Survey'),
      mouza: mouza || 'চকবস্তা',
      jlNo: jlNo || '০৮',
      dagNo: primaryDag,
      khatianNo: khatianNo || '',
      date: dateStr,
      areaSqFt: multiPlotTotals.totalAreaSqFt || 0,
      perimeterFt: multiPlotTotals.totalPerimeterFt,
      points: generatedPoints,
      status: 'completed',
      clientName: clientName || '',
      bookingId: bookingId || undefined,
      notes: surveyNotes || (isBn ? 'বাহুভিত্তিক পৃথক পরিমাপকৃত প্লট দখল জরিপ।' : 'Individual side measurement survey.'),
      plots: plots,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onSaveSurvey(recordToSave);

    setSaveSuccessMsg(
      isBn
        ? `সর্বমোট ${formatNumberByLang(plots.length, lang)}টি প্লটের দখল পরিমাপ সফলভাবে সংরক্ষিত হয়েছে!`
        : `Successfully saved ${plots.length} plot measurements to survey records!`
    );

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & MULTI-PLOT BAR */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>{isBn ? 'বাহুভিত্তিক দখল পরিমাপ ও প্লট ব্যবস্থাপনা' : 'Individual Side Measurement Survey'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-200">
                  {isBn ? 'সক্রিয়' : 'Active'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isBn
                  ? 'প্রতিটি প্লটের উত্তর, দক্ষিণ, পূর্ব ও পশ্চিম বাহু পৃথকভাবে মেপে নিখুঁত সীমানা ও নকশা তৈরি করুন'
                  : 'Enter separate measurements for North, South, East, and West sides for each plot'}
              </p>
            </div>
          </div>

          {/* Quick Actions: Add Plot, Draft & Save All */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
            {false && (
              <button
                type="button"
                onClick={handleCaptureGpsPoint}
                disabled={gpsStatus.loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-2xs transition active:scale-95 disabled:opacity-50"
                title={isBn ? 'বর্তমান GPS কো-অর্ডিনেট গ্রহণ করুন' : 'Capture Live GPS'}
              >
                <MapPin className="w-3.5 h-3.5 text-cyan-200" />
                <span>{gpsStatus.loading ? (isBn ? 'GPS খোঁজা হচ্ছে...' : 'Locating...') : isBn ? 'GPS পয়েন্ট' : 'GPS Pt'}</span>
              </button>
            )}

            {false && (
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition active:scale-95"
                title={isBn ? 'ডিভাইসে ড্রাফট সংরক্ষণ করুন' : 'Save draft locally'}
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-700" />
                <span>{isBn ? 'ড্রাফট সেভ' : 'Save Draft'}</span>
              </button>
            )}

            {false && (
              <button
                type="button"
                onClick={handleReloadDraft}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                title={isBn ? 'পূর্বের ড্রাফট লোড করুন' : 'Reload draft'}
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-600" />
                <span>{isBn ? 'ড্রাফট লোড' : 'Load Draft'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAddPlot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্লট +' : 'Plot +'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllPlots}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition active:scale-95"
            >
              <Save className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'সংরক্ষণ' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* GPS Live Accuracy Status Bar */}
        {gpsStatus.accuracy !== undefined && (
          <div className="p-2 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs font-bold flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-600" />
              <span>
                {isBn
                  ? `সক্রিয় GPS কো-অর্ডিনেট: ${gpsStatus.latitude?.toFixed(6)}, ${gpsStatus.longitude?.toFixed(6)}`
                  : `Active GPS: ${gpsStatus.latitude?.toFixed(6)}, ${gpsStatus.longitude?.toFixed(6)}`}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-cyan-200 text-cyan-950 font-mono text-[11px]">
              &plusmn;{gpsStatus.accuracy}m {isBn ? 'নির্ভুলতা' : 'accuracy'}
            </span>
          </div>
        )}

        {/* Mobile Field Workflow Stepper: START SURVEY -> ADD PLOT -> ADD POINTS -> REVIEW -> SAVE DRAFT -> FINISH SURVEY */}
        {false && (
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-max text-[11px] font-bold">
              {[
                { id: 'start', labelBn: '১. জরিপ শুরু', labelEn: '1. Start' },
                { id: 'add_plot', labelBn: '২. প্লট যোগ', labelEn: '2. Add Plot' },
                { id: 'add_points', labelBn: '৩. বাহু/বিন্দু পরিমাপ', labelEn: '3. Points' },
                { id: 'review', labelBn: '৪. যাচাই ও প্রিভিউ', labelEn: '4. Review' },
                { id: 'save_draft', labelBn: '৫. ড্রাফট সংরক্ষণ', labelEn: '5. Draft' },
                { id: 'finish', labelBn: '৬. সার্ভে সম্পন্ন', labelEn: '6. Finish' },
              ].map((step, sIdx, arr) => {
                const isCurrent = fieldStep === step.id;
                return (
                  <React.Fragment key={step.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFieldStep(step.id as any);
                        if (step.id === 'save_draft') handleSaveDraft();
                        if (step.id === 'finish') handleSaveAllPlots();
                      }}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-800 text-white shadow-2xs'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isBn ? step.labelBn : step.labelEn}
                    </button>
                    {sIdx < arr.length - 1 && <span className="text-slate-300 font-normal">&rarr;</span>}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Save Success Toast */}
        {saveSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* PLOT SELECTOR TABS */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-800" />
              <span>{isBn ? 'প্লট তালিকা নির্বাচন করুন:' : 'Select Plot to Measure:'}</span>
              <span className="text-slate-400 font-normal">
                ({formatNumberByLang(plots.length, lang)} {isBn ? 'টি প্লট' : 'plots'})
              </span>
            </span>

            <span className="text-[11px] text-slate-500">
              {isBn ? 'যেকোনো প্লটে ক্লিক করে পরিমাপ সম্পাদনা করুন' : 'Click any plot to edit'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            {plots.map((p, idx) => {
              const isActive = p.id === activePlot?.id;
              const hasDiag = p.diagonal && p.diagonal > 0 && p.isGeometryValid;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePlotId(p.id)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                    isActive
                      ? 'bg-emerald-900 text-white border-emerald-950 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasDiag ? 'bg-emerald-400' : p.northSide > 0 ? 'bg-amber-400' : 'bg-slate-300'
                    }`}
                  />
                  <span>{p.plotName || `${isBn ? 'প্লট ' : 'Plot '}${formatNumberByLang(idx + 1, lang)}`}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      isActive ? 'bg-emerald-950 text-emerald-200' : 'bg-white text-slate-500 border border-slate-200'
                    }`}
                  >
                    {isBn ? 'দাগ ' : 'Dag '} {formatNumberByLang(p.dagNo, lang)}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleAddPlot}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-emerald-400 text-emerald-800 hover:bg-emerald-50 text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্লট +' : 'Plot +'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE PLOT MEASUREMENT PANEL */}
      {activePlot && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT COLUMN: ACTIVE PLOT INPUTS (7 Cols on desktop) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Plot Identification & Controls Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center">
                    {plots.findIndex((p) => p.id === activePlot.id) + 1}
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {isBn ? 'প্লটের পরিচিতি ও একক নির্ধারণ' : 'Plot Identity & Units'}
                  </span>
                </div>

                {/* Plot Order & Delete Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleMovePlot(
                        plots.findIndex((p) => p.id === activePlot.id),
                        'up'
                      )
                    }
                    disabled={plots.findIndex((p) => p.id === activePlot.id) === 0}
                    title={isBn ? 'উপরে সরান' : 'Move Up'}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleMovePlot(
                        plots.findIndex((p) => p.id === activePlot.id),
                        'down'
                      )
                    }
                    disabled={
                      plots.findIndex((p) => p.id === activePlot.id) === plots.length - 1
                    }
                    title={isBn ? 'নিচে সরান' : 'Move Down'}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePlot(activePlot.id)}
                    title={isBn ? 'প্লট মুছুন' : 'Delete Plot'}
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Identification Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'প্লটের নাম / বিবরণ' : 'Plot Name / Label'}
                  </label>
                  <input
                    type="text"
                    value={activePlot.plotName}
                    onChange={(e) => handleUpdateActivePlot({ plotName: e.target.value })}
                    placeholder={isBn ? 'প্লট ০১ (মেইন বাড়ি)' : 'Plot 01'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'দাগ নম্বর (Dag No)' : 'Dag Number'}
                  </label>
                  <input
                    type="text"
                    value={activePlot.dagNo}
                    onChange={(e) => handleUpdateActivePlot({ dagNo: e.target.value })}
                    placeholder="১২৪"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                {/* T1: Unit Pill — Simple Clean: Feet / Meter / Link */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'পরিমাপের একক' : 'Unit'} <span className="font-normal text-slate-400">{isBn ? '(১ ট্যাপে সব বাহু)' : '(1-tap)'}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    {[
                      { id: 'feet', labelBn: 'ফুট', labelEn: 'Feet' },
                      { id: 'meter', labelBn: 'মিটার', labelEn: 'Meter' },
                      { id: 'link', labelBn: 'লিংক', labelEn: 'Link' },
                    ].map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleToggleUnit(u.id as LengthUnit)}
                        className={`py-1.5 rounded-lg transition text-[11px] ${
                          activePlot.unit === u.id
                            ? 'bg-emerald-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                        }`}
                      >
                        {isBn ? u.labelBn : u.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculation Method Switcher */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? 'গণনা পদ্ধতি (Method)' : 'Calculation Method'}
                  </label>
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleUpdateActivePlot({ calculationMethod: 'average' })}
                      className={`flex-1 py-1.5 rounded-lg transition ${
                        (activePlot.calculationMethod || 'average') === 'average'
                          ? 'bg-emerald-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {isBn ? 'গড় পদ্ধতি' : 'Average'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateActivePlot({ calculationMethod: 'diagonal' })}
                      className={`flex-1 py-1.5 rounded-lg transition ${
                        activePlot.calculationMethod === 'diagonal'
                          ? 'bg-emerald-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {isBn ? 'কর্ণ পদ্ধতি' : 'Diagonal'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* A: Hassle-free live result banner — updates instantly as you type 4 sides */}
            <div className={`p-3 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${activePlot.decimal !== null ? (activePlot.isApproximate ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300') : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activePlot.decimal !== null ? (activePlot.isApproximate ? 'bg-amber-600 text-white' : 'bg-emerald-700 text-white') : 'bg-slate-100 text-slate-500'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                    <span>{isBn ? 'লাইভ ফলাফল — ৪ বাহু দিলেই অটো' : 'Live — 4 sides = auto'}</span>
                    {activePlot.decimal !== null && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activePlot.isApproximate ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}`}>{activePlot.isApproximate ? (isBn ? 'গড় পদ্ধতি' : 'Avg') : (isBn ? 'নিখুঁত' : 'Exact')}</span>}
                  </div>
                  <div className="text-[13px] font-black text-slate-900">
                    {activePlot.decimal !== null ? (
                      <span>{formatNumberByLang(activePlot.decimal, lang)} {isBn ? 'শতাংশ' : 'dec'} <span className="text-slate-400 font-normal">•</span> {formatNumberByLang(activePlot.katha || 0, lang)} {isBn ? 'কাঠা' : 'katha'} <span className="text-slate-400 font-normal">•</span> {formatNumberByLang(activePlot.bigha || 0, lang)} {isBn ? 'বিঘা' : 'bigha'}</span>
                    ) : (
                      <span className="text-slate-500 font-bold text-[12px]">{isBn ? '৪ বাহু লিখুন → সাথে সাথে শতাংশ দেখুন' : 'Enter 4 sides → instant decimal'}</span>
                    )}
                  </div>
                  {activePlot.decimal !== null && <div className="text-[11px] text-slate-500">{formatNumberByLang(activePlot.areaSqFt || 0, lang)} {isBn ? 'বর্গফুট' : 'sq ft'} • {formatNumberByLang(activePlot.perimeterFt, lang)} {isBn ? 'ফুট পরিসীমা' : 'ft perimeter'}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-stretch sm:self-auto">
                <button type="button" onClick={handleFillExample} className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white border border-slate-300 text-[11px] font-bold text-slate-700 hover:bg-slate-50"> {isBn ? 'উদাহরণ ভরুন' : 'Fill example'} <span className="text-slate-400 hidden sm:inline">60,62,100,98</span></button>
                {onOpenReport && activePlot.decimal !== null && <button type="button" onClick={() => { handleSaveAllPlots(); onOpenReport(); }} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {isBn ? 'PDF' : 'PDF'}</button>}
              </div>
            </div>

            {/* T2: 1-Tap Share — Simple Clean: Copy only */}
            {activePlot.decimal !== null && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> {isBn ? 'শেয়ার:' : 'Share:'}</span>
                <button type="button" onClick={handleCopyResult} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800"><Copy className="w-3.5 h-3.5" /> {isBn ? 'কপি করুন' : 'Copy'} — {formatNumberByLang(activePlot.decimal, lang)} {isBn ? 'শতাংশ' : 'dec'}</button>
                <span className="text-[10px] text-slate-500">{isBn ? '→ ১-ট্যাপে কপি' : '→ 1-tap copy'}</span>
              </div>
            )}

            {/* T3: Ideal diagonal chips — tap to auto-fill (hassle-free) */}
            {idealDiagonal && (activePlot.calculationMethod || 'average') === 'average' && (
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-black text-sky-900 flex items-center gap-1"><Compass className="w-3.5 h-3.5" /> {isBn ? 'আদর্শ কর্ণ (ট্যাপে বসবে):' : 'Ideal diagonal (tap to fill):'}</span>
                <button type="button" onClick={() => handleApplyIdealDiagonal('AC')} className="bg-white border border-sky-300 hover:bg-sky-600 hover:text-white px-3 py-1 rounded-full font-bold text-sky-900 transition">AC: {formatNumberByLang(idealDiagonal.midAc, lang)} {idealDiagonal.unitLabel} <span className="text-[9px] opacity-70">({formatNumberByLang(idealDiagonal.acMin, lang)}–{formatNumberByLang(idealDiagonal.acMax, lang)})</span> ✓</button>
                <button type="button" onClick={() => handleApplyIdealDiagonal('BD')} className="bg-white border border-sky-300 hover:bg-sky-600 hover:text-white px-3 py-1 rounded-full font-bold text-sky-900 transition">BD: {formatNumberByLang(idealDiagonal.midBd, lang)} {idealDiagonal.unitLabel} <span className="text-[9px] opacity-70">({formatNumberByLang(idealDiagonal.bdMin, lang)}–{formatNumberByLang(idealDiagonal.bdMax, lang)})</span> ✓</button>
                <span className="text-sky-700">{isBn ? '→ নিখুঁত ত্রিভুজ হিসাব' : '→ exact Heron'}</span>
              </div>
            )}
            {idealDiagonal && activePlot.diagonal && activePlot.isGeometryValid === false && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{isBn ? `কর্ণ ${formatNumberByLang(activePlot.diagonal, lang)} ${idealDiagonal.unitLabel} আদর্শ সীমার বাইরে — আদর্শ AC ${formatNumberByLang(idealDiagonal.acMin, lang)}–${formatNumberByLang(idealDiagonal.acMax, lang)} বা BD ${formatNumberByLang(idealDiagonal.bdMin, lang)}–${formatNumberByLang(idealDiagonal.bdMax, lang)} ${idealDiagonal.unitLabel} ব্যবহার করুন।` : `Diagonal ${activePlot.diagonal} ${idealDiagonal.unitLabel} outside ideal AC ${idealDiagonal.acMin}–${idealDiagonal.acMax} / BD ${idealDiagonal.bdMin}–${idealDiagonal.bdMax}.`}</span>
              </div>
            )}

            {/* SEPARATE INPUT CARDS FOR THE 4 CARDINAL SIDES */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-emerald-800" />
                  <span>{isBn ? 'চার বাহুর পৃথক পৃথক পরিমাপ:' : 'Individual 4-Side Measurements:'}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {isBn
                    ? 'প্রতিটি বাহু স্বাধীন (বিপরীত বাহু সমান ধরা হয় না)'
                    : 'Independent inputs (no assumption of equal sides)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. NORTH SIDE (উত্তর বাহু) */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{isBn ? 'উত্তর বাহু (North Side)' : 'North Side'}</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {getUnitLabel(activePlot.unit, lang)}
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={activePlot.northSide || ''}
                      onChange={(e) =>
                        handleUpdateActivePlot({ northSide: parseFloat(e.target.value) || 0 })
                      }
                      placeholder={isBn ? 'যেমন: ৬০.৫' : 'e.g. 60.5'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                      {activePlot.unit === 'meter' ? 'm' : activePlot.unit === 'link' ? 'link' : activePlot.unit === 'yard' ? 'yd' : activePlot.unit === 'haat' ? 'haat' : 'ft'}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={activePlot.northNotes || ''}
                    onChange={(e) => handleUpdateActivePlot({ northNotes: e.target.value })}
                    placeholder={isBn ? 'নোট: উত্তরে রাস্তা / দেওয়াল' : 'Notes: Boundary road'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50/60"
                  />
                </div>

                {/* 2. SOUTH SIDE (দক্ষিণ বাহু) */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                      <span>{isBn ? 'দক্ষিণ বাহু (South Side)' : 'South Side'}</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {getUnitLabel(activePlot.unit, lang)}
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={activePlot.southSide || ''}
                      onChange={(e) =>
                        handleUpdateActivePlot({ southSide: parseFloat(e.target.value) || 0 })
                      }
                      placeholder={isBn ? 'যেমন: ৬২.০' : 'e.g. 62.0'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                      {activePlot.unit === 'meter' ? 'm' : activePlot.unit === 'link' ? 'link' : activePlot.unit === 'yard' ? 'yd' : activePlot.unit === 'haat' ? 'haat' : 'ft'}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={activePlot.southNotes || ''}
                    onChange={(e) => handleUpdateActivePlot({ southNotes: e.target.value })}
                    placeholder={isBn ? 'নোট: দক্ষিণে সীমানা আইল' : 'Notes: Neighbor boundary'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50/60"
                  />
                </div>

                {/* 3. EAST SIDE (পূর্ব বাহু) */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                      <span>{isBn ? 'পূর্ব বাহু (East Side)' : 'East Side'}</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {getUnitLabel(activePlot.unit, lang)}
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={activePlot.eastSide || ''}
                      onChange={(e) =>
                        handleUpdateActivePlot({ eastSide: parseFloat(e.target.value) || 0 })
                      }
                      placeholder={isBn ? 'যেমন: ১০০.০' : 'e.g. 100.0'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                      {activePlot.unit === 'meter' ? 'm' : activePlot.unit === 'link' ? 'link' : activePlot.unit === 'yard' ? 'yd' : activePlot.unit === 'haat' ? 'haat' : 'ft'}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={activePlot.eastNotes || ''}
                    onChange={(e) => handleUpdateActivePlot({ eastNotes: e.target.value })}
                    placeholder={isBn ? 'নোট: পূর্বে পুকুর পাড়' : 'Notes: Pond bank'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50/60"
                  />
                </div>

                {/* 4. WEST SIDE (পশ্চিম বাহু) */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>{isBn ? 'পশ্চিম বাহু (West Side)' : 'West Side'}</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {getUnitLabel(activePlot.unit, lang)}
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={activePlot.westSide || ''}
                      onChange={(e) =>
                        handleUpdateActivePlot({ westSide: parseFloat(e.target.value) || 0 })
                      }
                      placeholder={isBn ? 'যেমন: ৯৮.৫' : 'e.g. 98.5'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                      {activePlot.unit === 'meter' ? 'm' : activePlot.unit === 'link' ? 'link' : activePlot.unit === 'yard' ? 'yd' : activePlot.unit === 'haat' ? 'haat' : 'ft'}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={activePlot.westNotes || ''}
                    onChange={(e) => handleUpdateActivePlot({ westNotes: e.target.value })}
                    placeholder={isBn ? 'নোট: পশ্চিমে বাড়ি' : 'Notes: Residential edge'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50/60"
                  />
                </div>
              </div>
            </div>

            {/* ADDITIONAL SIDES (IRREGULAR PLOTS 5+ SIDES) */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAdditionalSides((prev) => !prev)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-emerald-900"
                >
                  <Split className="w-3.5 h-3.5 text-emerald-800" />
                  <span>
                    {isBn
                      ? 'অনিয়মিত বহুভুজ জমির জন্য অতিরিক্ত বাহু'
                      : 'Additional Sides for Irregular Multi-sided Plots'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                    {formatNumberByLang((activePlot.additionalSides || []).length, lang)}
                  </span>
                  {showAdditionalSides ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleAddAdditionalSide}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-700 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'বাহু যোগ' : 'Add Side'}</span>
                </button>
              </div>

              {showAdditionalSides && (
                <div className="space-y-2 pt-1 border-t border-slate-100 animate-fadeIn">
                  {(activePlot.additionalSides || []).length === 0 ? (
                    <p className="text-xs text-slate-500 py-2 italic text-center">
                      {isBn
                        ? 'কোনো অতিরিক্ত বাহু নেই। ৪টির বেশি সীমানা থাকলে উপরে "বাহু যোগ" ক্লিক করুন।'
                        : 'No additional boundary sides. Click "Add Side" if plot has 5+ sides.'}
                    </p>
                  ) : (
                    activePlot.additionalSides?.map((side, idx) => (
                      <div
                        key={side.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <input
                          type="text"
                          value={side.name}
                          onChange={(e) =>
                            handleUpdateAdditionalSide(side.id, { name: e.target.value })
                          }
                          placeholder={isBn ? 'বাহুর নাম' : 'Side Name'}
                          className="w-full sm:w-1/3 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900"
                        />

                        <div className="relative w-full sm:w-1/3">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={side.length || ''}
                            onChange={(e) =>
                              handleUpdateAdditionalSide(side.id, {
                                length: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder={isBn ? 'দৈর্ঘ্য' : 'Length'}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 pr-8"
                          />
                          <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                            {activePlot.unit === 'meter' ? 'm' : activePlot.unit === 'link' ? 'link' : activePlot.unit === 'yard' ? 'yd' : activePlot.unit === 'haat' ? 'haat' : 'ft'}
                          </span>
                        </div>

                        <input
                          type="text"
                          value={side.notes || ''}
                          onChange={(e) =>
                            handleUpdateAdditionalSide(side.id, { notes: e.target.value })
                          }
                          placeholder={isBn ? 'নোট' : 'Notes'}
                          className="w-full sm:flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600"
                        />

                        <button
                          type="button"
                          onClick={() => handleDeleteAdditionalSide(side.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition self-end sm:self-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* CALCULATION METHOD & MEASUREMENT LOGIC CONTAINER */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-300/90 shadow-2xs space-y-3">
              {(activePlot.calculationMethod || 'average') === 'average' ? (
                // 1. AVERAGE METHOD (DEFAULT & PRIMARY FOR OCCUPATION SURVEY)
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                      <Ruler className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-amber-950">
                          {isBn ? 'গড় পদ্ধতিতে দখল পরিমাপ (মাঠের বাস্তবসম্মত প্রধান পদ্ধতি)' : 'Average Method Occupation Survey (Primary)'}
                        </h3>
                        <span className="px-2 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                          {isBn ? 'প্রধান পদ্ধতি' : 'Primary'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed mt-0.5">
                        {isBn
                          ? 'মাঠের সীমানা প্রাচীর, বাড়ি-ঘর, গাছপালা বা অ্যাক্সেস বাধার কারণে কর্ণ মাপা অসম্ভব হলে বাস্তব দখল নির্ধারণে এই পদ্ধতি প্রধান ও অত্যন্ত কার্যকরী।'
                          : 'Used when field obstacles (walls, buildings, dense trees) prevent diagonal measurement.'}
                      </p>
                    </div>
                  </div>

                  {/* Mandatory Labels & Formula Breakdown */}
                  <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200 space-y-1.5">
                    <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{isBn ? 'গড় পদ্ধতিতে আনুমানিক দখলকৃত জমির পরিমাণ' : 'Approximate Occupied Area by Average Method'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 italic">
                      {isBn
                        ? 'এই হিসাব গড় দৈর্ঘ্য × গড় প্রস্থের ভিত্তিতে প্রস্তুত।'
                        : 'This calculation is prepared on the basis of Average Length × Average Width.'}
                    </div>

                    {/* Step-by-step formula cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-sans block font-bold">
                          {isBn ? 'গড় দৈর্ঘ্য (উত্তর+দক্ষিণ)/২:' : 'Avg Length (N+S)/2:'}
                        </span>
                        <span className="text-slate-900 font-bold text-xs">
                          {activePlot.averageLengthFt
                            ? `${formatNumberByLang(activePlot.averageLengthFt, lang)} ft`
                            : '—'}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-sans block font-bold">
                          {isBn ? 'গড় প্রস্থ (পূর্ব+পশ্চিম)/২:' : 'Avg Width (E+W)/2:'}
                        </span>
                        <span className="text-slate-900 font-bold text-xs">
                          {activePlot.averageWidthFt
                            ? `${formatNumberByLang(activePlot.averageWidthFt, lang)} ft`
                            : '—'}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 font-sans block font-bold">
                          {isBn ? 'আনুমানিক ক্ষেত্রফল:' : 'Approximate Area:'}
                        </span>
                        <span className="text-emerald-950 font-bold text-xs">
                          {activePlot.decimal !== null
                            ? `${formatNumberByLang(activePlot.decimal, lang)} ${isBn ? 'শতক' : 'dec'}`
                            : (isBn ? 'বাহু পূরণ করুন' : 'Enter sides')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Optional Diagonal Entry even in Average Mode */}
                  <div className="pt-1">
                    <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{isBn ? 'ঐচ্ছিক কর্ণ পরিমাপ (যদি মাপা সম্ভব হয়):' : 'Optional Diagonal (if accessible):'}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateActivePlot({ calculationMethod: 'diagonal' })}
                        className="text-[10px] text-emerald-800 hover:underline font-bold"
                      >
                        {isBn ? 'কর্ণ পদ্ধতিতে রূপান্তর করুন →' : 'Switch to Diagonal Method →'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={activePlot.diagonalChoice || 'AC'}
                        onChange={(e) =>
                          handleUpdateActivePlot({ diagonalChoice: e.target.value as 'AC' | 'BD' })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="AC">{isBn ? 'উ-প থেকে দ-পূ কর্ণ (A-C)' : 'A-C Diagonal'}</option>
                        <option value="BD">{isBn ? 'উ-পূ থেকে দ-প কর্ণ (B-D)' : 'B-D Diagonal'}</option>
                      </select>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={activePlot.diagonal || ''}
                          onChange={(e) =>
                            handleUpdateActivePlot({
                              diagonal: parseFloat(e.target.value) || undefined,
                            })
                          }
                          placeholder={isBn ? 'ঐচ্ছিক কর্ণ (যেমন: ১১৪)' : 'Optional diagonal'}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-black text-slate-900 bg-white pr-10"
                        />
                        <span className="absolute right-2.5 top-1.5 text-xs text-slate-400">
                          {activePlot.unit === 'meter' ? 'm' : activePlot.unit === 'link' ? 'link' : activePlot.unit === 'yard' ? 'yd' : activePlot.unit === 'haat' ? 'haat' : 'ft'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // 2. DIAGONAL / TRIANGULATION METHOD
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-slate-900">
                          {isBn
                            ? 'ত্রিকোণমিতিক দ্বিখণ্ডিত ত্রিভুজ পদ্ধতি (কর্ণসহ নিখুঁত পরিমাপ)'
                            : 'Triangulation Method (Heron Formula with Diagonal)'}
                        </h3>
                        <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-950 text-[10px] font-bold">
                          {isBn ? 'নিখুঁত জ্যামিতিক' : 'Exact'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                        {isBn
                          ? 'হেরন সূত্রের দ্বিখণ্ডিত ত্রিভুজ পদ্ধতিতে শতভাগ নিখুঁত ক্ষেত্রফল পাওয়ার জন্য একটি কর্ণ মেপে প্রদান করুন।'
                          : 'Enter one diagonal length to split the quadrilateral into two exact triangles using Heron formula.'}
                      </p>
                    </div>
                  </div>

                  {/* Diagonal Input Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isBn ? 'কর্ণের অভিমুখ' : 'Diagonal Direction'}
                      </label>
                      <select
                        value={activePlot.diagonalChoice || 'AC'}
                        onChange={(e) =>
                          handleUpdateActivePlot({ diagonalChoice: e.target.value as 'AC' | 'BD' })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-white"
                      >
                        <option value="AC">
                          {isBn
                            ? 'উ-প থেকে দ-পূ কর্ণ (A to C Diagonal)'
                            : 'North-West to South-East (A to C)'}
                        </option>
                        <option value="BD">
                          {isBn
                            ? 'উ-পূ থেকে দ-প কর্ণ (B to D Diagonal)'
                            : 'North-East to South-West (B to D)'}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isBn ? 'কর্ণের দৈর্ঘ্য (Diagonal Length)' : 'Diagonal Length'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={activePlot.diagonal || ''}
                          onChange={(e) =>
                            handleUpdateActivePlot({
                              diagonal: parseFloat(e.target.value) || undefined,
                            })
                          }
                          placeholder={isBn ? 'যেমন: ১১৪.২' : 'e.g. 114.2'}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 pr-12 bg-white"
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                          {activePlot.unit === 'meter' ? 'm' : activePlot.unit === 'link' ? 'link' : activePlot.unit === 'yard' ? 'yd' : activePlot.unit === 'haat' ? 'haat' : 'ft'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className="flex items-center justify-between pt-1">
                    {activePlot.diagonal && activePlot.isGeometryValid ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>
                          {isBn
                            ? 'কর্ণ গৃহীত: হেরন সূত্রের দ্বিখণ্ডিত ত্রিভুজ পদ্ধতিতে নিখুঁত ক্ষেত্রফল নির্ধারিত।'
                            : 'Diagonal verified: Exact triangulation area calculated.'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {isBn
                            ? 'উন্নত ত্রিকোণমিতিক পদ্ধতির জন্য সঠিক কর্ণের দৈর্ঘ্য প্রদান করুন অথবা "গড় পদ্ধতি" নির্বাচন করুন।'
                            : 'Enter diagonal measurement for triangulation, or switch back to Average Method.'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: DRAWING & CALCULATIONS (5 Cols on desktop) */}
          <div className="lg:col-span-5 space-y-4">
            {/* AUTOMATIC DRAWING COMPONENT */}
            <PlotAutomaticDrawing plot={activePlot} lang={lang} />

            {/* CALCULATIONS & VALIDATION PANEL */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-emerald-800" />
                  <span>{isBn ? 'প্লট গণনা ও জ্যামিতিক ফলাফল' : 'Calculations & Validation'}</span>
                </span>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {activePlot.plotName}
                </span>
              </div>

              {/* Validation Warning Alert if any */}
              {activePlot.geometryValidationMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-medium leading-relaxed flex items-start gap-2 ${
                    activePlot.isGeometryValid && !activePlot.isGeometryUnderdetermined
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : activePlot.isGeometryValid && activePlot.isGeometryUnderdetermined
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'bg-rose-50 text-rose-900 border border-rose-200'
                  }`}
                >
                  {activePlot.isGeometryValid && !activePlot.isGeometryUnderdetermined ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{activePlot.geometryValidationMessage}</span>
                </div>
              )}

              {/* Calculated Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. PERIMETER */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {isBn ? 'মোট পরিসীমা (Perimeter)' : 'Total Perimeter'}
                  </span>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {formatNumberByLang(activePlot.perimeterFt, lang)}{' '}
                    <span className="text-xs font-normal text-slate-500">{isBn ? 'ফুট' : 'ft'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                    {formatNumberByLang(activePlot.perimeterMeters, lang)} {isBn ? 'মিটার' : 'm'}
                  </span>
                </div>

                {/* 2. AREA IN SATAK / DECIMAL */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-900 block">
                      {isBn ? 'ক্ষেত্রফল (শতক / ডেসিমেল)' : 'Area (Decimal)'}
                    </span>
                    {activePlot.decimal !== null && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        activePlot.isApproximate
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}>
                        {activePlot.isApproximate ? (isBn ? 'গড় পদ্ধতি' : 'Avg') : (isBn ? 'নিখুঁত' : 'Exact')}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-black text-emerald-950 mt-0.5">
                    {activePlot.decimal !== null ? (
                      <>
                        {formatNumberByLang(activePlot.decimal, lang)}{' '}
                        <span className="text-xs font-normal text-emerald-800">{isBn ? 'শতক' : 'dec'}</span>
                      </>
                    ) : (
                      <span className="text-xs text-amber-700 font-bold italic">
                        {isBn ? 'অনির্ধারিত' : 'Underdetermined'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-emerald-800 block mt-0.5">
                    {activePlot.katha !== null ? (
                      <>
                        {formatNumberByLang(activePlot.katha, lang)} {isBn ? 'কাঠা' : 'katha'}
                      </>
                    ) : (
                      isBn ? 'বাহুর মাপ প্রয়োজন' : 'Needs measurements'
                    )}
                  </span>
                </div>

                {/* 3. AREA IN SQ FEET */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {isBn ? 'বর্গফুট (Sq. Feet)' : 'Square Feet'}
                  </span>
                  <div className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                    {activePlot.areaSqFt !== null ? (
                      formatNumberByLang(activePlot.areaSqFt, lang)
                    ) : (
                      '—'
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ১ শতক = ৪৩৫.৬ বর্গফুট
                  </span>
                </div>

                {/* 4. AREA IN SQ METERS */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {isBn ? 'বর্গমিটার (Sq. Meters)' : 'Square Meters'}
                  </span>
                  <div className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                    {activePlot.areaSqMeters !== null ? (
                      formatNumberByLang(activePlot.areaSqMeters, lang)
                    ) : (
                      '—'
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ১ বর্গমিটার = ১০.৭৬ বর্গফুট
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MULTI-PLOT SUMMARY TABLE & OVERALL TOTALS */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-emerald-800" />
              <span>{isBn ? 'বহুখণ্ড প্লট জরিপ সংক্ষিপ্ত বিবরণী' : 'Multi-Plot Survey Summary Table'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn
                ? 'জরিপের অন্তর্ভুক্ত সকল প্লটের মাপ, দাগ নম্বর, পরিসীমা ও ক্ষেত্রফল'
                : 'Summary of all measured plots, dag numbers, boundaries and calculated areas'}
            </p>
          </div>

          {/* Survey Metadata Quick Edit */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={mouza}
              onChange={(e) => setMouza(e.target.value)}
              placeholder={isBn ? 'মৌজা' : 'Mouza'}
              className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-800 font-bold w-24"
            />
            <input
              type="text"
              value={jlNo}
              onChange={(e) => setJlNo(e.target.value)}
              placeholder={isBn ? 'জেএল' : 'JL'}
              className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-800 font-bold w-16"
            />
          </div>
        </div>

        {/* Responsive Table of Plots */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">{isBn ? 'প্লটের নাম' : 'Plot Name'}</th>
                <th className="p-2.5">{isBn ? 'দাগ নং' : 'Dag'}</th>
                <th className="p-2.5">{isBn ? 'পদ্ধতি' : 'Method'}</th>
                <th className="p-2.5">{isBn ? 'উত্তর (ফুট)' : 'North (ft)'}</th>
                <th className="p-2.5">{isBn ? 'দক্ষিণ (ফুট)' : 'South (ft)'}</th>
                <th className="p-2.5">{isBn ? 'পূর্ব (ফুট)' : 'East (ft)'}</th>
                <th className="p-2.5">{isBn ? 'পশ্চিম (ফুট)' : 'West (ft)'}</th>
                <th className="p-2.5">{isBn ? 'কর্ণ (ফুট)' : 'Diag (ft)'}</th>
                <th className="p-2.5">{isBn ? 'পরিসীমা' : 'Perimeter'}</th>
                <th className="p-2.5">{isBn ? 'ক্ষেত্রফল (শতক)' : 'Area (Dec)'}</th>
                <th className="p-2.5 text-center">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plots.map((p, idx) => {
                const isActive = p.id === activePlot?.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setActivePlotId(p.id)}
                    className={`cursor-pointer transition ${
                      isActive ? 'bg-emerald-50/50 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-2.5 text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-700 shrink-0" />
                      <span>{p.plotName}</span>
                    </td>
                    <td className="p-2.5 font-mono">{formatNumberByLang(p.dagNo, lang)}</td>
                    <td className="p-2.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          p.calculationMethod === 'diagonal' && p.diagonal
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {p.calculationMethod === 'diagonal' && p.diagonal
                          ? isBn
                            ? 'কর্ণ'
                            : 'Diag'
                          : isBn
                          ? 'গড়'
                          : 'Avg'}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono">
                      {formatNumberByLang(roundVal(toFeet(p.northSide, p.unit), 1), lang)}
                    </td>
                    <td className="p-2.5 font-mono">
                      {formatNumberByLang(roundVal(toFeet(p.southSide, p.unit), 1), lang)}
                    </td>
                    <td className="p-2.5 font-mono">
                      {formatNumberByLang(roundVal(toFeet(p.eastSide, p.unit), 1), lang)}
                    </td>
                    <td className="p-2.5 font-mono">
                      {formatNumberByLang(roundVal(toFeet(p.westSide, p.unit), 1), lang)}
                    </td>
                    <td className="p-2.5 font-mono">
                      {p.diagonal
                        ? formatNumberByLang(roundVal(toFeet(p.diagonal, p.unit), 1), lang)
                        : isBn
                        ? 'নাই'
                        : 'None'}
                    </td>
                    <td className="p-2.5 font-mono">
                      {formatNumberByLang(p.perimeterFt, lang)} {isBn ? 'ফুট' : 'ft'}
                    </td>
                    <td className="p-2.5">
                      {p.decimal !== null ? (
                        <span className="text-emerald-900 font-bold font-mono">
                          {formatNumberByLang(p.decimal, lang)} {isBn ? 'শতক' : 'dec'}
                        </span>
                      ) : (
                        <span className="text-amber-700 italic text-[11px]">
                          {isBn ? 'অনির্ধারিত' : 'Underdet.'}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePlotId(p.id);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                        >
                          {isBn ? 'সম্পাদনা' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlot(p.id);
                          }}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* GRAND TOTAL ROW */}
        <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-400 block">
              {isBn ? 'সর্বমোট প্লট সংখ্যা ও সামগ্রিক দখল' : 'Total Survey Boundary Aggregate'}
            </span>
            <div className="text-sm font-black text-white mt-0.5">
              {formatNumberByLang(multiPlotTotals.count, lang)} {isBn ? 'টি প্লট' : 'Plots'} |{' '}
              {isBn ? 'মোট পরিসীমা:' : 'Total Perimeter:'}{' '}
              {formatNumberByLang(multiPlotTotals.totalPerimeterFt, lang)} {isBn ? 'ফুট' : 'ft'}
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-xs font-bold text-slate-400 block">
              {isBn ? 'সর্বমোট ক্ষেত্রফল (Grand Total Area)' : 'Total Calculated Area'}
            </span>
            <div className="text-base font-black mt-0.5">
              {multiPlotTotals.allAreasValid && multiPlotTotals.totalDecimal !== null ? (
                <span className="text-emerald-400 font-mono">
                  {formatNumberByLang(multiPlotTotals.totalDecimal, lang)} {isBn ? 'শতক' : 'Dec'} (
                  {formatNumberByLang(multiPlotTotals.totalKatha || 0, lang)} {isBn ? 'কাঠা' : 'Katha'})
                </span>
              ) : (
                <span className="text-amber-400 text-xs font-medium">
                  {isBn
                    ? 'আংশিক অনির্ধারিত (সকল প্লটের কর্ণ পরিমাপ দিন)'
                    : 'Partial (requires diagonal for all plots)'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS: SAVE & GENERATE REPORT — hassle-free prominent */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
          <div className="text-xs text-slate-500">
            {isBn
              ? '৪ বাহু দিলেই অটো হিসাব • সংরক্ষণ করলে A4 রিপোর্টে যুক্ত হবে'
              : '4 sides = auto • Save adds to A4 report'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAllPlots}
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-black shadow-2xs transition active:scale-95"
            >
              <Save className="w-4 h-4 text-amber-300" />
              <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Survey'}</span>
            </button>

            {onOpenReport && (
              <button
                type="button"
                onClick={() => {
                  handleSaveAllPlots();
                  onOpenReport();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 text-xs font-black transition active:scale-95 border-2 border-slate-900"
              >
                <FileText className="w-4 h-4" />
                <span>{isBn ? 'A4 রিপোর্ট PDF' : 'A4 Report PDF'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* A: Mobile sticky save bar — 1-tap hassle-free */}
      <div className="lg:hidden sticky bottom-[64px] z-30 p-3 rounded-2xl bg-white border-2 border-emerald-400 shadow-[0_8px_24px_rgba(0,0,0,.12)] flex items-center justify-between gap-3 mt-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-slate-500">{isBn ? 'সর্বমোট' : 'Total'} • {formatNumberByLang(multiPlotTotals.count, lang)} {isBn ? 'প্লট' : 'plots'}</div>
          <div className="text-[13px] font-black text-emerald-900 truncate">
            {multiPlotTotals.allAreasValid && multiPlotTotals.totalDecimal !== null
              ? `${formatNumberByLang(multiPlotTotals.totalDecimal, lang)} ${isBn ? 'শতাংশ' : 'dec'} • ${formatNumberByLang(multiPlotTotals.totalKatha || 0, lang)} ${isBn ? 'কাঠা' : 'katha'}`
              : (isBn ? '৪ বাহু দিন → অটো' : 'Enter 4 sides → auto')}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button type="button" onClick={handleSaveAllPlots} className="px-3.5 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-black"> {isBn ? 'সেভ' : 'Save'}</button>
          {onOpenReport && <button type="button" onClick={() => { handleSaveAllPlots(); onOpenReport(); }} className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">PDF</button>}
        </div>
      </div>
    </div>
  );
};
