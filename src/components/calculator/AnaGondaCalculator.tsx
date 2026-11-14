import React, { useState, useMemo } from 'react';
import { AnaGondaValue, LandAreaUnit } from '../../types';
import {
  ANA_GONDA_CONSTANTS,
  addAnaGonda,
  anaGondaToShareFraction,
  anaGondaToSqFt,
  anaGondaToTil,
  calculateLandUnits,
  convertAreaToSqFt,
  formatNumberByLang,
  getAreaUnitLabel,
  roundClean,
  sqFtToAnaGonda,
  subtractAnaGonda,
  tilToAnaGonda,
} from '../../lib/land-units';
import { saveCalculationToHistory } from '../../lib/land-calculations';
import {
  Calculator,
  ArrowRightLeft,
  Plus,
  Minus,
  Copy,
  Check,
  BookmarkPlus,
  Info,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface AnaGondaCalculatorProps {
  lang: 'bn' | 'en';
}

type Mode = 'trad_to_area' | 'area_to_trad' | 'arithmetic';

export const AnaGondaCalculator: React.FC<AnaGondaCalculatorProps> = ({ lang }) => {
  const [mode, setMode] = useState<Mode>('trad_to_area');

  // Mode 1: Traditional to Decimal/SqFt
  const [ana1, setAna1] = useState<string>('4');
  const [gonda1, setGonda1] = useState<string>('10');
  const [kora1, setKora1] = useState<string>('2');
  const [kranti1, setKranti1] = useState<string>('1');
  const [til1, setTil1] = useState<string>('10');

  // Total plot context (optional for share calculation)
  const [hasPlotContext, setHasPlotContext] = useState<boolean>(true);
  const [plotAmount, setPlotAmount] = useState<string>('100');
  const [plotUnit, setPlotUnit] = useState<LandAreaUnit>('decimal');

  // Mode 2: Decimal/SqFt to Traditional
  const [inputAreaValue, setInputAreaValue] = useState<string>('10');
  const [inputAreaUnit, setInputAreaUnit] = useState<LandAreaUnit>('decimal');

  // Mode 3: Arithmetic (+ / -)
  const [arithOp, setArithOp] = useState<'+' | '-'>('+');
  const [mathA, setMathA] = useState<AnaGondaValue>({ ana: 4, gonda: 10, kora: 2, kranti: 1, til: 5 });
  const [mathB, setMathB] = useState<AnaGondaValue>({ ana: 2, gonda: 5, kora: 1, kranti: 0, til: 10 });

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Parse Mode 1 traditional input
  const val1: AnaGondaValue = useMemo(() => {
    return {
      ana: Math.max(0, parseInt(ana1) || 0),
      gonda: Math.max(0, parseInt(gonda1) || 0),
      kora: Math.max(0, parseInt(kora1) || 0),
      kranti: Math.max(0, parseInt(kranti1) || 0),
      til: Math.max(0, parseInt(til1) || 0),
    };
  }, [ana1, gonda1, kora1, kranti1, til1]);

  const normVal1 = useMemo(() => {
    const totalTil = anaGondaToTil(val1);
    return tilToAnaGonda(totalTil);
  }, [val1]);

  const shareFraction1 = useMemo(() => anaGondaToShareFraction(val1), [val1]);

  // If in plot context (e.g. 100 decimal khatian share), compute land based on fraction of total land
  // Else compute standard baseline area
  const resultAreaSqFt1 = useMemo(() => {
    if (hasPlotContext) {
      const plotNum = Math.max(0, parseFloat(plotAmount) || 0);
      const plotSqFt = convertAreaToSqFt(plotNum, plotUnit);
      return plotSqFt * shareFraction1;
    } else {
      return anaGondaToSqFt(val1);
    }
  }, [hasPlotContext, plotAmount, plotUnit, shareFraction1, val1]);

  const resultUnits1 = useMemo(() => calculateLandUnits(resultAreaSqFt1), [resultAreaSqFt1]);

  // Parse Mode 2 area input
  const resultTradFromArea: AnaGondaValue = useMemo(() => {
    const areaNum = Math.max(0, parseFloat(inputAreaValue) || 0);
    const sqFt = convertAreaToSqFt(areaNum, inputAreaUnit);
    return sqFtToAnaGonda(sqFt);
  }, [inputAreaValue, inputAreaUnit]);

  // Mode 3 Arithmetic calculation
  const arithResult: AnaGondaValue = useMemo(() => {
    if (arithOp === '+') {
      return addAnaGonda(mathA, mathB);
    } else {
      return subtractAnaGonda(mathA, mathB);
    }
  }, [arithOp, mathA, mathB]);

  const arithResultSqFt = useMemo(() => anaGondaToSqFt(arithResult), [arithResult]);
  const arithResultUnits = useMemo(() => calculateLandUnits(arithResultSqFt), [arithResultSqFt]);

  const handleCopy = (summary: string) => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveResult = () => {
    let sqFt = resultAreaSqFt1;
    let desc = '';
    if (mode === 'trad_to_area') {
      desc = `আনা-গন্ডা রূপান্তর: ${normVal1.ana} আনা ${normVal1.gonda} গন্ডা ${normVal1.kora} কড়া ${normVal1.kranti} ক্রান্তি ${normVal1.til} তিল`;
    } else if (mode === 'area_to_trad') {
      sqFt = convertAreaToSqFt(parseFloat(inputAreaValue) || 0, inputAreaUnit);
      desc = `আনা-গন্ডা নির্ণয়: ${inputAreaValue} ${getAreaUnitLabel(inputAreaUnit, lang)}`;
    } else {
      sqFt = arithResultSqFt;
      desc = `আনা-গন্ডা ${arithOp === '+' ? 'যোগ' : 'বিয়োগ'} হিসাব`;
    }

    const units = calculateLandUnits(sqFt);
    saveCalculationToHistory({
      shape: 'polygon',
      unit: 'feet',
      areaSqFt: sqFt,
      areaSqMeter: units.sqMeter,
      shatangsha: units.shatangsha,
      katha: units.katha,
      bigha: units.bigha,
      acre: units.acre,
      inputDescription: desc,
      shapeNameBn: 'আনা-গন্ডা হিসাব',
      shapeNameEn: 'Ana-Gonda Calculation',
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div id="ana-gonda-calculator-root" className="space-y-4">
      {/* Mode Selector Tabs */}
      <div className="p-1 rounded-2xl bg-slate-200/80 border border-slate-300/80 flex text-xs font-bold gap-1">
        <button
          onClick={() => setMode('trad_to_area')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            mode === 'trad_to_area'
              ? 'bg-white text-emerald-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calculator className="w-3.5 h-3.5 text-emerald-800" />
          <span>{lang === 'bn' ? 'আনা-গন্ডা → শতক/বর্গফুট' : 'Ana-Gonda → Decimal'}</span>
        </button>

        <button
          onClick={() => setMode('area_to_trad')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            mode === 'area_to_trad'
              ? 'bg-white text-emerald-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-800" />
          <span>{lang === 'bn' ? 'শতক/বর্গফুট → আনা-গন্ডা' : 'Decimal → Ana-Gonda'}</span>
        </button>

        <button
          onClick={() => setMode('arithmetic')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            mode === 'arithmetic'
              ? 'bg-white text-emerald-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Plus className="w-3.5 h-3.5 text-emerald-800" />
          <span>{lang === 'bn' ? 'যোগ ও বিয়োগ' : 'Add / Subtract'}</span>
        </button>
      </div>

      {/* MODE 1: TRADITIONAL TO AREA */}
      {mode === 'trad_to_area' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-800" />
              <span>
                {lang === 'bn'
                  ? 'আনা, গন্ডা, কড়া, ক্রান্তি ও তিল থেকে ক্ষেত্রফল'
                  : 'Convert Ana, Gonda, Kora, Kranti & Til to Area'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'bn'
                ? 'সিএস, এসএ বা আরএস খতিয়ানের ১৬ আনা হিস্যা বা আঞ্চলিক মাপ অনুযায়ী শতক ও কাঠা বের করুন'
                : 'Calculate decimal and katha shares from traditional 16-Ana land records'}
            </p>
          </div>

          {/* Plot context toggle */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasPlotContext}
                  onChange={(e) => setHasPlotContext(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-900 focus:ring-emerald-700"
                />
                <span>
                  {lang === 'bn'
                    ? 'খতিয়ান/দাগের মোট জমি উল্লেখ করুন (১৬ আনার প্রেক্ষিতে অংশ)'
                    : 'Specify total plot area (for 16-Ana fraction)'}
                </span>
              </label>
              <span className="text-[10px] text-emerald-800 font-semibold px-2 py-0.5 bg-emerald-100/80 rounded">
                {hasPlotContext ? (lang === 'bn' ? 'খতিয়ান হিস্যা' : 'Khatian Share') : (lang === 'bn' ? 'সরাসরি মান' : 'Direct Area')}
              </span>
            </div>

            {hasPlotContext && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-900 block mb-0.5">
                    {lang === 'bn' ? 'খতিয়ান/দাগের মোট জমি:' : 'Total Plot Area:'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={plotAmount}
                    onChange={(e) => setPlotAmount(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-emerald-900 block mb-0.5">
                    {lang === 'bn' ? 'একক:' : 'Unit:'}
                  </span>
                  <div className="flex bg-white rounded-lg p-0.5 border border-emerald-300 text-xs font-bold">
                    {(['decimal', 'katha', 'bigha', 'acre', 'sqFt'] as LandAreaUnit[]).map((u) => (
                      <button
                        key={u}
                        onClick={() => setPlotUnit(u)}
                        className={`flex-1 py-1 rounded transition text-[11px] ${
                          plotUnit === u
                            ? 'bg-emerald-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {u === 'decimal' ? (lang === 'bn' ? 'শতক' : 'Dec') : u === 'katha' ? (lang === 'bn' ? 'কাঠা' : 'Katha') : u === 'bigha' ? (lang === 'bn' ? 'বিঘা' : 'Bigha') : u === 'acre' ? (lang === 'bn' ? 'একর' : 'Acre') : (lang === 'bn' ? 'ব.ফু.' : 'SqFt')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5 Traditional Unit Inputs */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              {lang === 'bn' ? 'আনা-গন্ডা-কড়া-ক্রান্তি-তিল ইনপুট:' : 'Enter Traditional Units:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 block mb-1">
                  {lang === 'bn' ? 'আনা (Ana)' : 'Ana (0-16)'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="16"
                  value={ana1}
                  onChange={(e) => setAna1(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-center text-sm font-black text-slate-900"
                />
                <span className="text-[10px] text-slate-400 block text-center mt-1">
                  ১৬ আনা = ১ অংশ
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 block mb-1">
                  {lang === 'bn' ? 'গন্ডা (Gonda)' : 'Gonda (0-19)'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="19"
                  value={gonda1}
                  onChange={(e) => setGonda1(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-center text-sm font-black text-slate-900"
                />
                <span className="text-[10px] text-slate-400 block text-center mt-1">
                  ২০ গন্ডা = ১ আনা
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 block mb-1">
                  {lang === 'bn' ? 'কড়া (Kora)' : 'Kora (0-3)'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="3"
                  value={kora1}
                  onChange={(e) => setKora1(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-center text-sm font-black text-slate-900"
                />
                <span className="text-[10px] text-slate-400 block text-center mt-1">
                  ৪ কড়া = ১ গন্ডা
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 block mb-1">
                  {lang === 'bn' ? 'ক্রান্তি (Kranti)' : 'Kranti (0-2)'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="2"
                  value={kranti1}
                  onChange={(e) => setKranti1(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-center text-sm font-black text-slate-900"
                />
                <span className="text-[10px] text-slate-400 block text-center mt-1">
                  ৩ ক্রান্তি = ১ কড়া
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-slate-600 block mb-1">
                  {lang === 'bn' ? 'তিল (Til)' : 'Til (0-19)'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="19"
                  value={til1}
                  onChange={(e) => setTil1(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-center text-sm font-black text-slate-900"
                />
                <span className="text-[10px] text-slate-400 block text-center mt-1">
                  ২০ তিল = ১ ক্রান্তি
                </span>
              </div>
            </div>
          </div>

          {/* Canonical Normalized Badge */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <span className="font-semibold text-slate-600">
              {lang === 'bn' ? 'পরিশুদ্ধ মান (Normalized):' : 'Normalized Value:'}
            </span>
            <span className="font-bold text-emerald-950">
              {formatNumberByLang(normVal1.ana, lang)} আনা,{' '}
              {formatNumberByLang(normVal1.gonda, lang)} গন্ডা,{' '}
              {formatNumberByLang(normVal1.kora, lang)} কড়া,{' '}
              {formatNumberByLang(normVal1.kranti, lang)} ক্রান্তি,{' '}
              {formatNumberByLang(normVal1.til, lang)} তিল
            </span>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-800">
                {lang === 'bn' ? 'শতাংশ / শতক' : 'Decimal'}
              </span>
              <p className="text-xl font-black text-emerald-950 mt-0.5">
                {formatNumberByLang(resultUnits1.shatangsha, lang)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-semibold text-blue-800">
                {lang === 'bn' ? 'কাঠা' : 'Katha'}
              </span>
              <p className="text-xl font-black text-blue-950 mt-0.5">
                {formatNumberByLang(resultUnits1.katha, lang)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-semibold text-amber-900">
                {lang === 'bn' ? 'বিঘা' : 'Bigha'}
              </span>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                {formatNumberByLang(resultUnits1.bigha, lang)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-700">
                {lang === 'bn' ? 'বর্গফুট' : 'Sq. Ft.'}
              </span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {formatNumberByLang(resultUnits1.sqFt, lang)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: AREA TO TRADITIONAL */}
      {mode === 'area_to_trad' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-800" />
              <span>
                {lang === 'bn'
                  ? 'শতক বা বর্গফুট থেকে আনা-গন্ডা নির্ণয়'
                  : 'Convert Decimal / Sq Ft to Traditional Units'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'bn'
                ? 'যেকোনো পরিমাপ লিখুন এবং তা থেকে আনা, গন্ডা, কড়া, ক্রান্তি ও তিলের ভগ্নাংশ দেখুন'
                : 'Enter area measurement to resolve into Ana, Gonda, Kora, Kranti, and Til'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {lang === 'bn' ? 'জমির পরিমাণ' : 'Land Area'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={inputAreaValue}
                onChange={(e) => setInputAreaValue(e.target.value)}
                placeholder="10"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {lang === 'bn' ? 'পরিমাপের একক' : 'Area Unit'}
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['decimal', 'katha', 'bigha', 'acre', 'sqFt', 'sqMeter'] as LandAreaUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setInputAreaUnit(u)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                      inputAreaUnit === u
                        ? 'bg-emerald-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {getAreaUnitLabel(u, lang)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Traditional Result Output Display */}
          <div className="p-4 rounded-2xl bg-emerald-950 text-white border border-emerald-900 space-y-3">
            <span className="text-xs font-semibold text-emerald-300 block">
              {lang === 'bn' ? 'আনা-গন্ডা সমতুল্য মান:' : 'Traditional Equivalent:'}
            </span>

            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-800">
                <span className="text-[10px] text-emerald-300 font-semibold block">আনা (Ana)</span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(resultTradFromArea.ana, lang)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-800">
                <span className="text-[10px] text-emerald-300 font-semibold block">গন্ডা (Gonda)</span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(resultTradFromArea.gonda, lang)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-800">
                <span className="text-[10px] text-emerald-300 font-semibold block">কড়া (Kora)</span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(resultTradFromArea.kora, lang)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-800">
                <span className="text-[10px] text-emerald-300 font-semibold block">ক্রান্তি (Kranti)</span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(resultTradFromArea.kranti, lang)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-800">
                <span className="text-[10px] text-emerald-300 font-semibold block">তিল (Til)</span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(resultTradFromArea.til, lang)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: ARITHMETIC (+ / -) */}
      {mode === 'arithmetic' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-800" />
                <span>
                  {lang === 'bn'
                    ? 'আনা-গন্ডার যোগ ও বিয়োগ'
                    : 'Ana-Gonda Addition & Subtraction'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'bn'
                  ? 'তিল, ক্রান্তি, কড়া, গন্ডা ও আনার সঠিক ক্যারি (যোগ) বা ধার (বিয়োগ) সমাধান'
                  : 'Add or subtract traditional units with accurate carry and borrow'}
              </p>
            </div>

            {/* Operator switch */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-black">
              <button
                onClick={() => setArithOp('+')}
                className={`px-3 py-1 rounded-lg transition ${
                  arithOp === '+' ? 'bg-emerald-900 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                + {lang === 'bn' ? 'যোগ' : 'Add'}
              </button>
              <button
                onClick={() => setArithOp('-')}
                className={`px-3 py-1 rounded-lg transition ${
                  arithOp === '-' ? 'bg-emerald-900 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                - {lang === 'bn' ? 'বিয়োগ' : 'Subtract'}
              </button>
            </div>
          </div>

          {/* Record 1 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              {lang === 'bn' ? '১ম হিস্যা (A):' : 'Record A:'}
            </span>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {(['ana', 'gonda', 'kora', 'kranti', 'til'] as (keyof AnaGondaValue)[]).map((k) => (
                <div key={k}>
                  <span className="text-[10px] text-slate-500 font-semibold block capitalize">
                    {k === 'ana' ? 'আনা' : k === 'gonda' ? 'গন্ডা' : k === 'kora' ? 'কড়া' : k === 'kranti' ? 'ক্রান্তি' : 'তিল'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={mathA[k]}
                    onChange={(e) =>
                      setMathA({ ...mathA, [k]: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full mt-1 px-1 py-1 rounded-lg bg-white border border-slate-300 text-center font-bold"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Operator sign indicator */}
          <div className="flex items-center justify-center">
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center font-black text-base border border-emerald-200 shadow-2xs">
              {arithOp}
            </span>
          </div>

          {/* Record 2 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              {lang === 'bn' ? '২য় হিস্যা (B):' : 'Record B:'}
            </span>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {(['ana', 'gonda', 'kora', 'kranti', 'til'] as (keyof AnaGondaValue)[]).map((k) => (
                <div key={k}>
                  <span className="text-[10px] text-slate-500 font-semibold block capitalize">
                    {k === 'ana' ? 'আনা' : k === 'gonda' ? 'গন্ডা' : k === 'kora' ? 'কড়া' : k === 'kranti' ? 'ক্রান্তি' : 'তিল'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={mathB[k]}
                    onChange={(e) =>
                      setMathB({ ...mathB, [k]: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full mt-1 px-1 py-1 rounded-lg bg-white border border-slate-300 text-center font-bold"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Calculated Output */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{lang === 'bn' ? 'ফলাফল (পরিশুদ্ধ):' : 'Calculated Result:'}</span>
              <span className="text-emerald-400 font-bold">
                ≈ {formatNumberByLang(arithResultUnits.shatangsha, lang)} {lang === 'bn' ? 'শতাংশ' : 'Dec'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">আনা</span>
                <p className="text-xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(arithResult.ana, lang)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">গন্ডা</span>
                <p className="text-xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(arithResult.gonda, lang)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">কড়া</span>
                <p className="text-xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(arithResult.kora, lang)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">ক্রান্তি</span>
                <p className="text-xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(arithResult.kranti, lang)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">তিল</span>
                <p className="text-xl font-black text-amber-400 mt-1">
                  {formatNumberByLang(arithResult.til, lang)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Bangladesh regional warning note */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {lang === 'bn'
            ? 'স্থানীয়/আঞ্চলিক এককের প্রচলন ভিন্ন হতে পারে। প্রযোজ্য রেকর্ড বা স্থানীয় মান যাচাই করুন।'
            : 'Regional unit definitions may vary by locality. Please verify applicable deed records or local survey standards.'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={() => {
            const summary =
              lang === 'bn'
                ? `ভূমি ও আমিন — আনা-গন্ডা হিসাব\nমান: ${normVal1.ana} আনা ${normVal1.gonda} গন্ডা ${normVal1.kora} কড়া ${normVal1.kranti} ক্রান্তি ${normVal1.til} তিল\nশতাংশ: ${resultUnits1.shatangsha} শতক\nবর্গফুট: ${resultUnits1.sqFt} ব.ফু.`
                : `Bhumi O Amin — Ana-Gonda Calculation\nValue: ${normVal1.ana} Ana ${normVal1.gonda} Gonda ${normVal1.kora} Kora ${normVal1.kranti} Kranti ${normVal1.til} Til\nDecimal: ${resultUnits1.shatangsha}\nSq Ft: ${resultUnits1.sqFt}`;
            handleCopy(summary);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 shadow-2xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-emerald-700">{lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!'}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span>{lang === 'bn' ? 'অনুলিপি কপি করুন' : 'Copy Summary'}</span>
            </>
          )}
        </button>

        <button
          onClick={handleSaveResult}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition active:scale-95 shadow-2xs"
        >
          {saved ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-300" />
              <span>{lang === 'bn' ? 'সংরক্ষিত!' : 'Saved!'}</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'হিসাব সংরক্ষণ' : 'Save Calculation'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
