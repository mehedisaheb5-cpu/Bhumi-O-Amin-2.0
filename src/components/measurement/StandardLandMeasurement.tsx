import React, { useState, useMemo, useEffect } from 'react';
import {
  Calculator,
  RotateCcw,
  Check,
  Copy,
  Info,
  Layers,
  Square,
  Triangle as TriangleIcon,
  BookmarkPlus,
  Plus,
  Trash2,
  AlertTriangle,
  History,
  Compass,
  Split,
  ArrowLeft,
} from 'lucide-react';
import {
  CalculationResult,
  Language,
  LengthUnit,
  LandShape,
  TriangleCalcMode,
  PolygonPoint,
  SavedCalculation,
} from '../../types';
import { translations } from '../../data/translations';
import {
  calculateLandUnits,
  convertToFeet,
  formatNumberByLang,
  getUnitLabel,
  roundClean,
} from '../../lib/land-units';
import {
  calculateRectangle,
  calculateTriangle,
  calculateTrapezoid,
  calculatePolygon,
  calculateQuadDiagonal,
  generateShareSummary,
  getStoredHistory,
  saveCalculationToHistory,
  deleteHistoryItem,
  clearAllHistory,
  CalculationOutput,
} from '../../lib/land-calculations';
import { ShapeVisualizer } from '../calculator/ShapeVisualizer';
import { CalcHistoryView } from '../calculator/CalcHistoryView';

interface StandardLandMeasurementProps {
  lang: Language;
  onBack?: () => void;
}

export const StandardLandMeasurement: React.FC<StandardLandMeasurementProps> = ({
  lang,
  onBack,
}) => {
  const t = translations[lang].calc;

  // Active shape
  const [activeShape, setActiveShape] = useState<LandShape>('rectangle');
  const [unit, setUnit] = useState<LengthUnit>('feet');

  // Rectangle inputs (default 66 x 66 for verified 10 decimal benchmark)
  const [rectLength, setRectLength] = useState<string>('66');
  const [rectWidth, setRectWidth] = useState<string>('66');

  // Triangle inputs
  const [triangleMode, setTriangleMode] = useState<TriangleCalcMode>('base_height');
  const [triBase, setTriBase] = useState<string>('60');
  const [triHeight, setTriHeight] = useState<string>('40');
  const [triSideA, setTriSideA] = useState<string>('50');
  const [triSideB, setTriSideB] = useState<string>('50');
  const [triSideC, setTriSideC] = useState<string>('60');

  // Trapezoid inputs
  const [trapParallel1, setTrapParallel1] = useState<string>('70');
  const [trapParallel2, setTrapParallel2] = useState<string>('50');
  const [trapHeight, setTrapHeight] = useState<string>('40');
  const [trapSide3, setTrapSide3] = useState<string>('45');
  const [trapSide4, setTrapSide4] = useState<string>('45');

  // Irregular Quadrilateral (4 Sides + 1 Diagonal) inputs
  const [quadSideA, setQuadSideA] = useState<string>('60');
  const [quadSideB, setQuadSideB] = useState<string>('70');
  const [quadSideC, setQuadSideC] = useState<string>('65');
  const [quadSideD, setQuadSideD] = useState<string>('75');
  const [quadDiagonal, setQuadDiagonal] = useState<string>('90');

  // Irregular / Polygon inputs
  const [polyPoints, setPolyPoints] = useState<PolygonPoint[]>([
    { id: '1', label: 'A', x: 0, y: 0 },
    { id: '2', label: 'B', x: 80, y: 0 },
    { id: '3', label: 'C', x: 70, y: 60 },
    { id: '4', label: 'D', x: 10, y: 50 },
  ]);

  // UI state
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<SavedCalculation[]>([]);

  // Load calculation history from localStorage on mount
  useEffect(() => {
    setHistoryList(getStoredHistory());
  }, []);

  // Compute active calculation
  const calcOutput: CalculationOutput = useMemo(() => {
    switch (activeShape) {
      case 'rectangle': {
        const len = parseFloat(rectLength) || 0;
        const wid = parseFloat(rectWidth) || 0;
        return calculateRectangle(len, wid, unit, lang);
      }
      case 'triangle': {
        if (triangleMode === 'base_height') {
          const b = parseFloat(triBase) || 0;
          const h = parseFloat(triHeight) || 0;
          const a = parseFloat(triSideA) || 0;
          const bSide = parseFloat(triSideB) || 0;
          return calculateTriangle(
            'base_height',
            { base: b, height: h, sideA: a > 0 ? a : undefined, sideB: bSide > 0 ? bSide : undefined },
            unit,
            lang
          );
        } else {
          const a = parseFloat(triSideA) || 0;
          const b = parseFloat(triSideB) || 0;
          const c = parseFloat(triSideC) || 0;
          return calculateTriangle('three_sides', { sideA: a, sideB: b, sideC: c }, unit, lang);
        }
      }
      case 'trapezoid': {
        const p1 = parseFloat(trapParallel1) || 0;
        const p2 = parseFloat(trapParallel2) || 0;
        const h = parseFloat(trapHeight) || 0;
        const s3 = parseFloat(trapSide3) || 0;
        const s4 = parseFloat(trapSide4) || 0;
        return calculateTrapezoid(p1, p2, h, s3 > 0 ? s3 : undefined, s4 > 0 ? s4 : undefined, unit, lang);
      }
      case 'quad_diagonal': {
        const a = parseFloat(quadSideA) || 0;
        const b = parseFloat(quadSideB) || 0;
        const c = parseFloat(quadSideC) || 0;
        const d = parseFloat(quadSideD) || 0;
        const diag = parseFloat(quadDiagonal) || 0;
        return calculateQuadDiagonal(a, b, c, d, diag, unit, lang);
      }
      case 'polygon': {
        return calculatePolygon(polyPoints, unit, lang);
      }
      default:
        return calculateRectangle(0, 0, unit, lang);
    }
  }, [
    activeShape,
    unit,
    lang,
    rectLength,
    rectWidth,
    triangleMode,
    triBase,
    triHeight,
    triSideA,
    triSideB,
    triSideC,
    trapParallel1,
    trapParallel2,
    trapHeight,
    trapSide3,
    trapSide4,
    quadSideA,
    quadSideB,
    quadSideC,
    quadSideD,
    quadDiagonal,
    polyPoints,
  ]);

  // Derived land units
  const units: CalculationResult = useMemo(() => {
    return calculateLandUnits(calcOutput.areaSqFt, calcOutput.perimeterFt);
  }, [calcOutput.areaSqFt, calcOutput.perimeterFt]);

  // Copy Summary Handler
  const handleCopySummary = () => {
    if (!calcOutput.isValid) return;

    const summaryText = generateShareSummary(
      activeShape,
      calcOutput.inputDescription,
      calcOutput.areaSqFt,
      calcOutput.perimeterFt,
      lang
    );

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save to localStorage history
  const handleSaveCalculation = () => {
    if (!calcOutput.isValid) return;

    const shapeNameBn: Record<LandShape, string> = {
      rectangle: 'আয়তক্ষেত্র',
      triangle: 'ত্রিভুজ',
      trapezoid: 'ট্রাপিজিয়াম',
      quad_diagonal: '৪ বাহু ও ১ কর্ণ',
      polygon: 'বহুভুজ / অনিয়মিত জমি',
    };

    const shapeNameEn: Record<LandShape, string> = {
      rectangle: 'Rectangle',
      triangle: 'Triangle',
      trapezoid: 'Trapezoid',
      quad_diagonal: '4 Sides & Diagonal',
      polygon: 'Irregular / Polygon',
    };

    const updated = saveCalculationToHistory(
      {
        shape: activeShape,
        shapeNameBn: shapeNameBn[activeShape],
        shapeNameEn: shapeNameEn[activeShape],
        inputDescription: calcOutput.inputDescription,
        unit,
        areaSqFt: units.sqFt,
        areaSqMeter: units.sqMeter,
        shatangsha: units.shatangsha,
        katha: units.katha,
        bigha: units.bigha,
        acre: units.acre,
        perimeterFt: units.perimeterFt,
        perimeterUnitValue: calcOutput.perimeterUnitValue,
        details: calcOutput.details,
      },
      lang
    );

    setHistoryList(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Restore saved calculation into form
  const handleRestoreCalculation = (item: SavedCalculation) => {
    setActiveShape(item.shape);
    setUnit(item.unit);

    if (item.shape === 'rectangle' && item.details) {
      setRectLength(String(item.details.length || '66'));
      setRectWidth(String(item.details.width || '66'));
    } else if (item.shape === 'triangle' && item.details) {
      if (item.details.triangleMode) setTriangleMode(item.details.triangleMode);
      if (item.details.base) setTriBase(String(item.details.base));
      if (item.details.height) setTriHeight(String(item.details.height));
      if (item.details.sideA) setTriSideA(String(item.details.sideA));
      if (item.details.sideB) setTriSideB(String(item.details.sideB));
      if (item.details.sideC) setTriSideC(String(item.details.sideC));
    } else if (item.shape === 'trapezoid' && item.details) {
      setTrapParallel1(String(item.details.parallel1 || '70'));
      setTrapParallel2(String(item.details.parallel2 || '50'));
      setTrapHeight(String(item.details.height || '40'));
      if (item.details.side3) setTrapSide3(String(item.details.side3));
      if (item.details.side4) setTrapSide4(String(item.details.side4));
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete history item
  const handleDeleteHistoryItem = (id: string) => {
    const updated = deleteHistoryItem(id);
    setHistoryList(updated);
  };

  // Clear all history
  const handleClearHistory = () => {
    clearAllHistory();
    setHistoryList([]);
  };

  // Reset inputs for active shape
  const handleReset = () => {
    if (activeShape === 'rectangle') {
      setRectLength('');
      setRectWidth('');
    } else if (activeShape === 'triangle') {
      setTriBase('');
      setTriHeight('');
      setTriSideA('');
      setTriSideB('');
      setTriSideC('');
    } else if (activeShape === 'trapezoid') {
      setTrapParallel1('');
      setTrapParallel2('');
      setTrapHeight('');
      setTrapSide3('');
      setTrapSide4('');
    } else if (activeShape === 'quad_diagonal') {
      setQuadSideA('');
      setQuadSideB('');
      setQuadSideC('');
      setQuadSideD('');
      setQuadDiagonal('');
    } else if (activeShape === 'polygon') {
      setPolyPoints([
        { id: '1', label: 'A', x: 0, y: 0 },
        { id: '2', label: 'B', x: 60, y: 0 },
        { id: '3', label: 'C', x: 50, y: 40 },
      ]);
    }
  };

  // Polygon point operations
  const handleAddPolygonPoint = () => {
    const nextIdx = polyPoints.length;
    const nextLabel = String.fromCharCode(65 + nextIdx); // A, B, C, D, E...
    const lastPoint = polyPoints[polyPoints.length - 1] || { x: 0, y: 0 };
    setPolyPoints([
      ...polyPoints,
      {
        id: String(Date.now()),
        label: nextLabel,
        x: lastPoint.x + 20,
        y: lastPoint.y + 10,
      },
    ]);
  };

  const handleUpdatePolygonPoint = (id: string, field: 'x' | 'y', val: string) => {
    const num = parseFloat(val) || 0;
    setPolyPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: num } : p))
    );
  };

  const handleDeletePolygonPoint = (id: string) => {
    if (polyPoints.length <= 3) return; // Keep at least 3 points
    const filtered = polyPoints.filter((p) => p.id !== id);
    // Relabel points A, B, C...
    const relabeled = filtered.map((p, idx) => ({
      ...p,
      label: String.fromCharCode(65 + idx),
    }));
    setPolyPoints(relabeled);
  };

  const unitLabel = getUnitLabel(unit, lang);

  return (
    <div id="standard-land-measurement" className="space-y-4 pb-12 animate-fadeIn">
      {/* Top Bar with Back button & History */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-2xs transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {lang === 'bn' ? 'সাধারণ জমি পরিমাপ' : 'Standard Land Measurement'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'bn'
                ? 'আয়তক্ষেত্র, ত্রিভুজ, ট্রাপিজিয়াম ও বহুভুজ পরিমাপ'
                : 'Rectangle, Triangle, Trapezoid, and Irregular Polygon Calculator'}
            </p>
          </div>
        </div>

        {/* Toggle History Button */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
            showHistory
              ? 'bg-emerald-900 text-white border-emerald-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'ইতিহাস' : 'History'}</span>
          {historyList.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                showHistory ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {formatNumberByLang(historyList.length, lang)}
            </span>
          )}
        </button>
      </div>

      {/* History Drawer if open */}
      {showHistory && (
        <CalcHistoryView
          history={historyList}
          lang={lang}
          onRestore={handleRestoreCalculation}
          onDeleteItem={handleDeleteHistoryItem}
          onClearAll={handleClearHistory}
        />
      )}

      {/* SHAPE SELECTOR TABS */}
      <div className="p-1.5 rounded-2xl bg-slate-100 border border-slate-200/90 shadow-xs">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 pt-1 pb-1">
          {t.shapeSelection}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1">
          {/* Rectangle */}
          <button
            id="shape-select-rectangle"
            onClick={() => setActiveShape('rectangle')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-semibold text-xs transition-all ${
              activeShape === 'rectangle'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>{t.shapes.rectangle}</span>
          </button>

          {/* Triangle */}
          <button
            id="shape-select-triangle"
            onClick={() => setActiveShape('triangle')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-semibold text-xs transition-all ${
              activeShape === 'triangle'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60'
            }`}
          >
            <TriangleIcon className="w-3.5 h-3.5" />
            <span>{t.shapes.triangle}</span>
          </button>

          {/* Trapezoid */}
          <button
            id="shape-select-trapezoid"
            onClick={() => setActiveShape('trapezoid')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-semibold text-xs transition-all ${
              activeShape === 'trapezoid'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{t.shapes.trapezoid}</span>
          </button>

          {/* 4 Sides & Diagonal */}
          <button
            id="shape-select-quad-diagonal"
            onClick={() => setActiveShape('quad_diagonal')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-semibold text-xs transition-all ${
              activeShape === 'quad_diagonal'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>{t.shapes.quadDiagonal}</span>
          </button>

          {/* Irregular / Polygon */}
          <button
            id="shape-select-polygon"
            onClick={() => setActiveShape('polygon')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-semibold text-xs transition-all ${
              activeShape === 'polygon'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.shapes.polygon}</span>
          </button>
        </div>
      </div>

      {/* INPUT CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        {/* Header with Unit Selector */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-emerald-800" />
            <span>
              {activeShape === 'rectangle'
                ? t.shapes.rectangle
                : activeShape === 'triangle'
                ? t.shapes.triangle
                : activeShape === 'trapezoid'
                ? t.shapes.trapezoid
                : activeShape === 'quad_diagonal'
                ? t.shapes.quadDiagonal
                : t.shapes.polygon}{' '}
              {t.inputSection}
            </span>
          </h3>

          {/* Length Unit Selector */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-semibold text-slate-500 mr-1 hidden sm:inline">
              {t.unitSelect}:
            </label>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              {(['feet', 'link', 'yard', 'meter', 'hath'] as LengthUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2 py-1 rounded-lg transition ${
                    unit === u
                      ? 'bg-white text-emerald-950 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.units[u]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 1. RECTANGLE INPUTS */}
        {activeShape === 'rectangle' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.length} ({unitLabel})
              </label>
              <div className="relative">
                <input
                  id="rect-length-input"
                  type="number"
                  step="any"
                  value={rectLength}
                  onChange={(e) => setRectLength(e.target.value)}
                  placeholder="e.g. 66"
                  className="w-full pl-3 pr-12 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">
                  {unitLabel}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.width} ({unitLabel})
              </label>
              <div className="relative">
                <input
                  id="rect-width-input"
                  type="number"
                  step="any"
                  value={rectWidth}
                  onChange={(e) => setRectWidth(e.target.value)}
                  placeholder="e.g. 66"
                  className="w-full pl-3 pr-12 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">
                  {unitLabel}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2. TRIANGLE INPUTS */}
        {activeShape === 'triangle' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTriangleMode('base_height')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition border ${
                  triangleMode === 'base_height'
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300 shadow-2xs font-bold'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {t.triangleModes.baseHeight}
              </button>
              <button
                type="button"
                onClick={() => setTriangleMode('three_sides')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition border ${
                  triangleMode === 'three_sides'
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300 shadow-2xs font-bold'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {t.triangleModes.threeSides}
              </button>
            </div>

            {triangleMode === 'base_height' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.base} ({unitLabel})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={triBase}
                    onChange={(e) => setTriBase(e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.height} ({unitLabel})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={triHeight}
                    onChange={(e) => setTriHeight(e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.sideA} ({unitLabel})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={triSideA}
                    onChange={(e) => setTriSideA(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.sideB} ({unitLabel})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={triSideB}
                    onChange={(e) => setTriSideB(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.sideC} ({unitLabel})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={triSideC}
                    onChange={(e) => setTriSideC(e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. TRAPEZOID INPUTS */}
        {activeShape === 'trapezoid' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.parallel1} ({unitLabel})
              </label>
              <input
                type="number"
                step="any"
                value={trapParallel1}
                onChange={(e) => setTrapParallel1(e.target.value)}
                placeholder="e.g. 70"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.parallel2} ({unitLabel})
              </label>
              <input
                type="number"
                step="any"
                value={trapParallel2}
                onChange={(e) => setTrapParallel2(e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.height} ({unitLabel})
              </label>
              <input
                type="number"
                step="any"
                value={trapHeight}
                onChange={(e) => setTrapHeight(e.target.value)}
                placeholder="e.g. 40"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 font-medium"
              />
            </div>
          </div>
        )}

        {/* 4. QUADRILATERAL WITH DIAGONAL */}
        {activeShape === 'quad_diagonal' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              {lang === 'bn'
                ? '৪টি বাহুর দৈর্ঘ্য এবং মাঝের যেকোনো ১টি কর্ণের দৈর্ঘ্য দিন (হিরন সূত্র ত্রিভুজ বিভাজন)'
                : 'Provide 4 side lengths and 1 diagonal (Heron formula triangle decomposition)'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  বাহু ১ / A ({unitLabel})
                </label>
                <input
                  type="number"
                  step="any"
                  value={quadSideA}
                  onChange={(e) => setQuadSideA(e.target.value)}
                  placeholder="60"
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  বাহু ২ / B ({unitLabel})
                </label>
                <input
                  type="number"
                  step="any"
                  value={quadSideB}
                  onChange={(e) => setQuadSideB(e.target.value)}
                  placeholder="70"
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  বাহু ৩ / C ({unitLabel})
                </label>
                <input
                  type="number"
                  step="any"
                  value={quadSideC}
                  onChange={(e) => setQuadSideC(e.target.value)}
                  placeholder="65"
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  বাহু ৪ / D ({unitLabel})
                </label>
                <input
                  type="number"
                  step="any"
                  value={quadSideD}
                  onChange={(e) => setQuadSideD(e.target.value)}
                  placeholder="75"
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  কর্ণ / Diag ({unitLabel})
                </label>
                <input
                  type="number"
                  step="any"
                  value={quadDiagonal}
                  onChange={(e) => setQuadDiagonal(e.target.value)}
                  placeholder="90"
                  className="w-full px-2.5 py-1.5 text-sm bg-amber-50 border border-amber-300 rounded-xl font-bold text-amber-950"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. POLYGON / IRREGULAR INPUTS */}
        {activeShape === 'polygon' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                {lang === 'bn' ? 'কোঅর্ডিনেট পয়েন্টসমূহ (X, Y):' : 'Coordinate Points (X, Y):'}
              </span>
              <button
                type="button"
                onClick={handleAddPolygonPoint}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'পয়েন্ট যোগ করুন' : 'Add Point'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {polyPoints.map((pt, idx) => (
                <div key={pt.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="w-6 h-6 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {pt.label}
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 font-bold">X:</span>
                      <input
                        type="number"
                        step="any"
                        value={pt.x}
                        onChange={(e) => handleUpdatePolygonPoint(pt.id, 'x', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 font-bold">Y:</span>
                      <input
                        type="number"
                        step="any"
                        value={pt.y}
                        onChange={(e) => handleUpdatePolygonPoint(pt.id, 'y', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-medium"
                      />
                    </div>
                  </div>
                  {polyPoints.length > 3 && (
                    <button
                      type="button"
                      onClick={() => handleDeletePolygonPoint(pt.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reset and Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.reset}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCalculation}
              disabled={!calcOutput.isValid}
              className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                savedSuccess
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : calcOutput.isValid
                  ? 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
              <span>{savedSuccess ? (lang === 'bn' ? 'সংরক্ষিত!' : 'Saved!') : t.saveToHistory}</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              disabled={!calcOutput.isValid}
              className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                copied
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : calcOutput.isValid
                  ? 'bg-emerald-800 text-white border-emerald-800 hover:bg-emerald-700 shadow-xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : t.shareSummary}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SHAPE VISUALIZER */}
      <ShapeVisualizer
        shape={activeShape}
        details={calcOutput.details}
        areaSqFt={calcOutput.areaSqFt}
        unit={unit}
        lang={lang}
      />

      {/* RESULTS CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {t.resultSection}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {calcOutput.inputDescription}
          </p>
        </div>

        {/* Primary Measurement Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Shatangsha / Decimal */}
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              {t.shatangsha} ({lang === 'bn' ? 'শতাংশ / ডেসিমেল' : 'Decimal'})
            </span>
            <p className="text-xl sm:text-2xl font-black mt-0.5">
              {formatNumberByLang(units.shatangsha, lang)}
            </p>
            <span className="text-[10px] text-emerald-700 font-medium">
              = {formatNumberByLang(roundClean(units.shatangsha * 435.6, 2), lang)} {t.sqFt}
            </span>
          </div>

          {/* Katha */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              {t.katha} ({lang === 'bn' ? 'কাঠা' : 'Katha'})
            </span>
            <p className="text-xl sm:text-2xl font-black mt-0.5">
              {formatNumberByLang(units.katha, lang)}
            </p>
            <span className="text-[10px] text-blue-700 font-medium">
              = {formatNumberByLang(roundClean(units.katha * 720, 2), lang)} {t.sqFt}
            </span>
          </div>

          {/* Bigha */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              {t.bigha} ({lang === 'bn' ? 'বিঘা' : 'Bigha'})
            </span>
            <p className="text-xl sm:text-2xl font-black mt-0.5">
              {formatNumberByLang(units.bigha, lang)}
            </p>
            <span className="text-[10px] text-amber-700 font-medium">
              = ২০ কাঠা (14,400 sq.ft)
            </span>
          </div>

          {/* Acre */}
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
              {t.acre} ({lang === 'bn' ? 'একর' : 'Acre'})
            </span>
            <p className="text-xl sm:text-2xl font-black mt-0.5">
              {formatNumberByLang(units.acre, lang)}
            </p>
            <span className="text-[10px] text-teal-700 font-medium">
              = ১০০ শতাংশ (43,560 sq.ft)
            </span>
          </div>
        </div>

        {/* Standard Units Grid */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 mb-2">
            {lang === 'bn' ? 'ক্ষেত্রফল ও পরিসীমা বিস্তারিত:' : 'Area & Perimeter Breakdown:'}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500">{t.sqFt}:</span>
              <p className="font-bold text-slate-900">{formatNumberByLang(units.sqFt, lang)}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">{t.sqMeter}:</span>
              <p className="font-bold text-slate-900">{formatNumberByLang(units.sqMeter, lang)}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">{t.perimeterFt}:</span>
              <p className="font-bold text-slate-900">{formatNumberByLang(units.perimeterFt, lang)} ft</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">{lang === 'bn' ? 'হাতে ক্ষেত্রফল' : 'Hath Sq'}:</span>
              <p className="font-bold text-slate-900">{formatNumberByLang(roundClean(units.sqFt / 2.25, 2), lang)}</p>
            </div>
          </div>
        </div>

        {/* Traditional Units Grid (Gonda, Kora, Kranti, Til) */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 mb-2">
            {t.traditionalUnits} (আনা, গণ্ডা, কড়া, ক্রান্তি, তিল)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500">গণ্ডা (Gonda)</span>
              <p className="font-bold text-slate-900 mt-0.5">
                {formatNumberByLang(units.gonda || 0, lang)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500">কড়া (Kora)</span>
              <p className="font-bold text-slate-900 mt-0.5">
                {formatNumberByLang(units.kora || 0, lang)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500">ক্রান্তি (Kranti)</span>
              <p className="font-bold text-slate-900 mt-0.5">
                {formatNumberByLang(units.kranti || 0, lang)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500">তিল (Til)</span>
              <p className="font-bold text-slate-900 mt-0.5">
                {formatNumberByLang(units.til || 0, lang)}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 italic">
            {t.regionalNote}
          </p>
        </div>

        {/* Formula Reference Note */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 text-slate-600 text-[11px] leading-relaxed border border-slate-200/80">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>{t.formulaNote}</span>
        </div>
      </div>
    </div>
  );
};
