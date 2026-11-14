import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Language, SurveyRecord } from '../../types';
import { toBnDigits } from '../../lib/banglaDate';
import {
  BahuDraft,
  BahuInfo,
  BahuPlotDraft,
  FtIn,
  PlotCalc,
  SQFT_PER_GONDA,
  SYNC_NOTE_KEY,
  SideKey,
  calcDraft,
  cleanNumInput,
  clearDraft,
  commitCompleted,
  syncCanvasIntoDraft,
  fmtFtIn,
  loadDraft,
  newDraft,
  newPlotDraft,
  normDigits,
  plotVertices,
  saveDraft,
} from '../../lib/bahuDraftStore';

interface Props {
  lang: Language;
  onSaveSurvey: (s: SurveyRecord) => void;
  onOpenReport?: (surveyId?: string) => void;
  onOpenDrawing: () => void;
  bookingId?: string;
}

const G = '#065f46';
const bn = (v: string | number) => toBnDigits(v);
const fix = (v: number, d = 2) => bn((Math.round(v * 10 ** d) / 10 ** d).toFixed(d));

const SIDES: { k: Exclude<SideKey, 'd'>; short: string; name: string }[] = [
  { k: 'n', short: 'উ', name: 'উত্তর' },
  { k: 's', short: 'দ', name: 'দক্ষিণ' },
  { k: 'e', short: 'পূ', name: 'পূর্ব' },
  { k: 'w', short: 'প', name: 'পশ্চিম' },
];

/* ============================================================
   লাইভ নকশা — উত্তর উপরে; প্রতিটি বাহুর বাইরে মাপ, মাঝে দাগ ও ক্ষেত্রফল
   ============================================================ */
const BahuSketch: React.FC<{ calc: PlotCalc; title: string }> = ({ calc, title }) => {
  const VW = 340;
  const VH = 250;
  const PAD = 52;
  const v = plotVertices(calc);
  const minX = Math.min(...v.map((p) => p.x));
  const maxX = Math.max(...v.map((p) => p.x));
  const minY = Math.min(...v.map((p) => p.y));
  const maxY = Math.max(...v.map((p) => p.y));
  const sc = Math.min((VW - PAD * 2) / (maxX - minX || 1), (VH - PAD * 2) / (maxY - minY || 1));
  const ox = (VW - (maxX - minX) * sc) / 2;
  const oy = (VH - (maxY - minY) * sc) / 2;
  const P = v.map((p) => ({ x: ox + (p.x - minX) * sc, y: oy + (p.y - minY) * sc }));
  const cx = P.reduce((a, p) => a + p.x, 0) / 4;
  const cy = P.reduce((a, p) => a + p.y, 0) / 4;
  const lens = [calc.feet.n, calc.feet.e, calc.feet.s, calc.feet.w];
  const names = ['উ', 'পূ', 'দ', 'প'];
  const area = calc.record.decimal;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto block" role="img" aria-label="বাহুর নকশা">
      <rect width={VW} height={VH} fill="#fbfdfc" />
      {calc.complete && <polygon points={P.map((p) => `${p.x},${p.y}`).join(' ')} fill="#d1fae5" opacity={0.55} />}
      {P.map((a, k) => {
        const b = P[(k + 1) % 4];
        const has = lens[k] > 0;
        return (
          <line
            key={k}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={has ? G : '#94a3b8'}
            strokeWidth={has ? 3.2 : 2}
            strokeDasharray={has ? undefined : '7 6'}
            strokeLinecap="round"
          />
        );
      })}
      {calc.usedDiagonal && (
        <line x1={P[0].x} y1={P[0].y} x2={P[2].x} y2={P[2].y} stroke="#b45309" strokeWidth={1.8} strokeDasharray="6 5" />
      )}
      {P.map((p, k) => (
        <circle key={`c${k}`} cx={p.x} cy={p.y} r={4} fill="#fff" stroke={G} strokeWidth={2} />
      ))}
      {/* বাহুর মাপ — বাইরের দিকে */}
      {P.map((a, k) => {
        const b = P[(k + 1) % 4];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        let nx = mx - cx;
        let ny = my - cy;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        const off = 22;
        const tx = mx + nx * off;
        const ty = my + ny * off;
        const txt = lens[k] > 0 ? `${names[k]} ${bn(fmtFtIn(lens[k]))}` : `${names[k]} ?`;
        const w = txt.length * 7.4 + 12;
        return (
          <g key={`l${k}`}>
            <rect x={tx - w / 2} y={ty - 12} width={w} height={24} rx={7} fill="#fff" stroke={lens[k] > 0 ? '#a7f3d0' : '#cbd5e1'} />
            <text x={tx} y={ty + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={lens[k] > 0 ? '#064e3b' : '#64748b'}>
              {txt}
            </text>
          </g>
        );
      })}
      {/* মাঝে নাম/দাগ/শতাংশ — সাদা বাক্সে, যাতে দাগের উপর না পড়ে */}
      <rect x={cx - 52} y={cy - 22} width={104} height={44} rx={8} fill="#fff" stroke="#a7f3d0" opacity={0.95} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
        {title}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize={15} fontWeight={800} fill={G}>
        {area !== null && calc.complete ? `${fix(area, 2)} শতাংশ` : 'মাপ দিন'}
      </text>
      {/* উত্তর দিক */}
      <g transform={`translate(${VW - 24},30)`}>
        <polygon points="0,-18 7,4 0,-1 -7,4" fill={G} />
        <text x={0} y={20} textAnchor="middle" fontSize={13} fontWeight={800} fill={G}>
          উ
        </text>
      </g>
    </svg>
  );
};

/* ============================================================
   ইনপুট উপাদান
   ============================================================ */
const Field: React.FC<{
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  id: string;
}> = ({ label, required, value, onChange, error, type = 'text', inputMode, placeholder, id }) => (
  <label htmlFor={id} className="block">
    <span className="block text-[15px] font-bold text-slate-700 mb-1">
      {label}
      {required && <span className="text-rose-600"> *</span>}
    </span>
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-h-[52px] rounded-xl border-2 px-3 text-[17px] font-semibold bg-white outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 ${
        error ? 'border-rose-400' : 'border-slate-300'
      }`}
    />
    {error && <span className="block text-sm font-bold text-rose-700 mt-1">{error}</span>}
  </label>
);

/* ============================================================
   মূল কম্পোনেন্ট
   ============================================================ */
export const SideMeasureWizard: React.FC<Props> = ({ onSaveSurvey, onOpenReport, onOpenDrawing, bookingId }) => {
  // খোলার সময় চিত্র ভিত্তিকে (ক্যানভাসে) করা পরিবর্তন খসড়ায় নিয়ে আসি
  const [initSync] = useState(() => {
    const loaded = loadDraft() || newDraft();
    const r = syncCanvasIntoDraft(loaded);
    if (r.changed) saveDraft(r.draft);
    let note = false;
    try {
      note = sessionStorage.getItem(SYNC_NOTE_KEY) === '1';
      sessionStorage.removeItem(SYNC_NOTE_KEY);
    } catch {
      /* ignore */
    }
    return { draft: r.draft, changed: r.changed || note };
  });
  const [draft, setDraft] = useState<BahuDraft>(initSync.draft);
  const [errors, setErrors] = useState<Partial<Record<keyof BahuInfo, string>>>({});
  const [savedTick, setSavedTick] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    initSync.changed ? 'চিত্র ভিত্তিকে করা পরিবর্তন বাহুর মাপ ও রিপোর্টে নেওয়া হয়েছে ✓' : null
  );
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // সম্পন্ন জরিপ ক্যানভাস থেকে বদলালে সংরক্ষিত জরিপ/রিপোর্টও হালনাগাদ
  useEffect(() => {
    if (initSync.changed && initSync.draft.status === 'completed') commitCompleted(initSync.draft, onSaveSurvey, bookingId);
    if (initSync.changed) {
      const t = window.setTimeout(() => setMsg(null), 4500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // স্বয়ংক্রিয় সংরক্ষণ
  useEffect(() => {
    const t = window.setTimeout(() => {
      saveDraft(draft);
      setSavedTick(true);
    }, 250);
    return () => window.clearTimeout(t);
  }, [draft]);
  useEffect(() => {
    if (!savedTick) return;
    const t = window.setTimeout(() => setSavedTick(false), 1500);
    return () => window.clearTimeout(t);
  }, [savedTick]);

  const totals = useMemo(() => calcDraft(draft), [draft]);
  const activeIdx = Math.max(0, draft.plots.findIndex((p) => p.id === draft.activePlotId));
  const active = draft.plots[activeIdx];
  const activeCalc = totals.calcs[activeIdx];

  const update = (fn: (d: BahuDraft) => BahuDraft, touchesMeasure = true) =>
    setDraft((d) => {
      const n = fn(d);
      return { ...n, status: touchesMeasure && d.status === 'completed' ? 'draft' : n.status, updatedAt: Date.now() };
    });

  const setInfo = (k: keyof BahuInfo, v: string) => {
    update((d) => ({ ...d, info: { ...d.info, [k]: v } }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const setSide = (k: SideKey, part: keyof FtIn, raw: string) => {
    const v = cleanNumInput(raw).slice(0, 7);
    update((d) => ({
      ...d,
      plots: d.plots.map((p) => (p.id === d.activePlotId ? { ...p, [k]: { ...p[k], [part]: v } } : p)),
    }));
  };

  const setPlotDag = (v: string) =>
    update((d) => ({ ...d, plots: d.plots.map((p) => (p.id === d.activePlotId ? { ...p, dagNo: v } : p)) }));

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3200);
  };

  /* ---------- তথ্য পেজ ---------- */
  const submitInfo = () => {
    const i = draft.info;
    const e: Partial<Record<keyof BahuInfo, string>> = {};
    if (!i.clientName.trim()) e.clientName = 'গ্রাহকের নাম লিখুন';
    if (!i.mouza.trim()) e.mouza = 'মৌজার নাম লিখুন';
    if (!i.dagNo.trim()) e.dagNo = 'দাগ নং লিখুন';
    const ph = normDigits(i.phone).replace(/[\s-]/g, '');
    if (ph && !/^(\+?88)?01\d{9}$/.test(ph)) e.phone = 'ফোন নম্বর ঠিক নেই (০১ দিয়ে ১১ সংখ্যা)';
    setErrors(e);
    if (Object.keys(e).length) return;
    update((d) => ({ ...d, infoDone: true }), false);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      inputs.current[0]?.focus();
    }, 60);
  };

  /* ---------- প্লট ---------- */
  const addPlot = () => {
    const p = newPlotDraft();
    update((d) => ({ ...d, plots: [...d.plots, p], activePlotId: p.id }));
    window.setTimeout(() => inputs.current[0]?.focus(), 80);
  };
  const removePlot = () => {
    if (draft.plots.length < 2) return;
    if (!window.confirm(`প্লট ${bn(activeIdx + 1)} মুছে ফেলবেন?`)) return;
    update((d) => {
      const plots = d.plots.filter((p) => p.id !== d.activePlotId);
      return { ...d, plots, activePlotId: plots[Math.max(0, activeIdx - 1)].id };
    });
  };

  /* ---------- নতুন / সম্পন্ন ---------- */
  const startNew = () => {
    const hasWork = draft.status !== 'completed' && (draft.info.clientName || totals.anyComplete);
    if (hasWork && !window.confirm('এই খসড়া মুছে নতুন জরিপ শুরু করবেন?')) return;
    clearDraft();
    setErrors({});
    setDraft(newDraft());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const complete = () => {
    const bad = totals.calcs.findIndex((c) => !c.complete || !c.record.areaSqFt);
    if (bad >= 0) {
      update((d) => ({ ...d, activePlotId: d.plots[bad].id }), false);
      flash(`প্লট ${bn(bad + 1)}-এর ৪ বাহুর মাপ দিন`);
      return;
    }
    // পুরনো খসড়া রিপোর্ট বাদ — নতুন মাপে রিপোর্ট হবে (চূড়ান্ত রিপোর্টে হাত দিই না)
    const survey = commitCompleted(draft, onSaveSurvey, bookingId);
    const done = { ...draft, status: 'completed' as const, updatedAt: Date.now() };
    saveDraft(done);
    setDraft(done);
    if (onOpenReport) onOpenReport(survey.id);
    else flash('সম্পন্ন ✓ — সংরক্ষিত তালিকায় যোগ হয়েছে');
  };

  const goNext = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nx = inputs.current[idx + 1];
      if (nx) nx.focus();
      else (e.target as HTMLInputElement).blur();
    }
  };

  const plotTitle = (i: number) => {
    const dag = draft.plots[i].dagNo.trim() || draft.info.dagNo;
    return `দাগ ${bn(dag || '—')}${draft.plots.length > 1 ? ` · প্লট ${bn(i + 1)}` : ''}`;
  };

  /* ============================== তথ্য পেজ ============================== */
  if (!draft.infoDone) {
    const i = draft.info;
    return (
      <div id="bahu-info-page" className="space-y-3 pb-28">
        <Steps step={1} />
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 space-y-4">
          <h3 className="text-lg font-extrabold text-emerald-900">গ্রাহকের তথ্য</h3>
          <Field id="bi-name" label="গ্রাহকের নাম" required value={i.clientName} onChange={(v) => setInfo('clientName', v)} error={errors.clientName} />
          <Field id="bi-mouza" label="মৌজা" required value={i.mouza} onChange={(v) => setInfo('mouza', v)} error={errors.mouza} />
          <Field id="bi-dag" label="দাগ নং" required value={i.dagNo} onChange={(v) => setInfo('dagNo', v)} error={errors.dagNo} inputMode="numeric" />
          <Field id="bi-phone" label="ফোন" value={i.phone} onChange={(v) => setInfo('phone', v)} error={errors.phone} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="bi-jl" label="জে.এল. নং" value={i.jlNo} onChange={(v) => setInfo('jlNo', v)} inputMode="numeric" />
            <Field id="bi-khatian" label="খতিয়ান নং" value={i.khatianNo} onChange={(v) => setInfo('khatianNo', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="bi-upazila" label="থানা/উপজেলা" value={i.upazila} onChange={(v) => setInfo('upazila', v)} />
            <Field id="bi-district" label="জেলা" value={i.district} onChange={(v) => setInfo('district', v)} />
          </div>
          <Field id="bi-date" label="তারিখ" type="date" value={i.date} onChange={(v) => setInfo('date', v)} />
        </div>
        <button
          id="bahu-info-next"
          onClick={submitInfo}
          className="w-full min-h-[58px] rounded-2xl bg-emerald-800 active:bg-emerald-900 text-white text-lg font-extrabold shadow-md"
        >
          পরবর্তী: বাহুর মাপ →
        </button>
        <AutoSaved show={savedTick} />
      </div>
    );
  }

  /* ============================== বাহু পেজ ============================== */
  const sideRow = (k: SideKey, short: string, name: string, row: number, small = false) => {
    const val = active[k];
    const base = row * 2;
    return (
      <div key={k} className={`flex items-center gap-2.5 py-2.5 ${small ? '' : 'border-b border-slate-100'}`}>
        <span
          className={`shrink-0 rounded-full text-white font-extrabold flex items-center justify-center ${
            small ? 'w-9 h-9 text-base bg-amber-700' : 'w-11 h-11 text-lg'
          }`}
          style={small ? undefined : { background: G }}
        >
          {short}
        </span>
        <span className={`flex-1 min-w-0 font-bold leading-tight ${small ? 'text-[15px] text-slate-700' : 'text-[17px] text-slate-900'}`}>
          {name}
          {small && <span className="block text-[13px] font-semibold text-slate-500">উ-প কোণা → দ-পূ কোণা (ঐচ্ছিক)</span>}
        </span>
        <label className="flex flex-col items-center">
          <input
            ref={(el) => {
              inputs.current[base] = el;
            }}
            id={`bs-${k}-f`}
            inputMode="decimal"
            enterKeyHint="next"
            value={val.f}
            placeholder="০"
            onChange={(e) => setSide(k, 'f', e.target.value)}
            onKeyDown={goNext(base)}
            className={`${small ? 'w-[66px] h-[46px] text-lg' : 'w-[76px] h-[52px] text-xl'} rounded-xl border-2 border-slate-300 text-center font-extrabold bg-white outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100`}
          />
          <span className="text-[13px] font-bold text-slate-600">ফুট</span>
        </label>
        <label className="flex flex-col items-center">
          <input
            ref={(el) => {
              inputs.current[base + 1] = el;
            }}
            id={`bs-${k}-i`}
            inputMode="decimal"
            enterKeyHint={k === 'd' ? 'done' : 'next'}
            value={val.i}
            placeholder="০"
            onChange={(e) => setSide(k, 'i', e.target.value)}
            onKeyDown={goNext(base + 1)}
            className={`${small ? 'w-[56px] h-[46px] text-lg' : 'w-[62px] h-[52px] text-xl'} rounded-xl border-2 border-slate-300 text-center font-extrabold bg-white outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100`}
          />
          <span className="text-[13px] font-bold text-slate-600">ইঞ্চি</span>
        </label>
      </div>
    );
  };

  const c = activeCalc;
  return (
    <div id="bahu-sides-page" className="space-y-3 pb-28">
      {/* ভাঁজ করা গ্রাহকের তথ্য — এক লাইন */}
      <button
        id="bahu-info-collapsed"
        onClick={() => update((d) => ({ ...d, infoDone: false }), false)}
        className="w-full flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 min-h-[48px] text-left"
      >
        <span className="flex-1 min-w-0 truncate text-[15px] font-bold text-emerald-950">
          {draft.info.clientName} · {draft.info.mouza} · দাগ {bn(draft.info.dagNo)}
        </span>
        <span className="shrink-0 text-sm font-extrabold text-emerald-800">✎ তথ্য</span>
      </button>

      {draft.status === 'completed' && (
        <div className="rounded-xl bg-emerald-800 text-white px-3 py-2.5 text-[15px] font-bold flex items-center gap-2">
          <span className="flex-1">✓ এই জরিপ সম্পন্ন — রিপোর্টে আছে</span>
          <button onClick={startNew} className="shrink-0 rounded-lg bg-white text-emerald-900 px-3 min-h-[40px] font-extrabold">
            + নতুন জরিপ
          </button>
        </div>
      )}

      {/* প্লট বাছাই — একাধিক প্লট হলে */}
      {draft.plots.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {draft.plots.map((p, i) => (
            <button
              key={p.id}
              onClick={() => update((d) => ({ ...d, activePlotId: p.id }), false)}
              className={`shrink-0 min-h-[44px] px-3.5 rounded-xl border-2 text-[15px] font-bold ${
                p.id === active.id ? 'bg-emerald-800 border-emerald-800 text-white' : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              প্লট {bn(i + 1)}
              {totals.calcs[i].complete ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      {/* চার বাহু */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs px-3.5 py-1">
        {draft.plots.length > 1 && (
          <div className="flex items-center gap-2 py-2.5 border-b border-slate-100">
            <span className="text-[15px] font-bold text-slate-700 shrink-0">এই প্লটের দাগ</span>
            <input
              value={active.dagNo}
              placeholder={draft.info.dagNo}
              onChange={(e) => setPlotDag(e.target.value)}
              className="flex-1 min-w-0 h-[44px] rounded-xl border-2 border-slate-300 px-3 text-[17px] font-bold outline-none focus:border-emerald-700"
            />
            <button onClick={removePlot} className="shrink-0 h-[44px] px-3 rounded-xl border-2 border-rose-200 text-rose-700 font-bold">
              মুছুন
            </button>
          </div>
        )}
        {SIDES.map((s, row) => sideRow(s.k, s.short, s.name, row))}
        <div className="opacity-95">{sideRow('d', 'ক', 'কর্ণ', 4, true)}</div>
      </div>

      {(c.shapeWarning || c.diagonalWarning) && (
        <div className="rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-900 px-3 py-2.5 text-[15px] font-bold">
          {c.shapeWarning || c.diagonalWarning}
        </div>
      )}

      {/* লাইভ নকশা */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <BahuSketch calc={c} title={plotTitle(activeIdx)} />
      </div>

      {/* ফলাফল */}
      <div id="bahu-result" className="rounded-2xl bg-white border border-slate-200 shadow-xs px-4 py-2">
        <ResRow big label="শতাংশ" value={c.complete && c.record.decimal !== null ? fix(c.record.decimal, 2) : '—'} />
        <ResRow label="বর্গফুট" value={c.complete && c.record.areaSqFt ? fix(c.record.areaSqFt, 0) : '—'} />
        <ResRow label="কাঠা" value={c.complete && c.record.katha !== null ? fix(c.record.katha, 2) : '—'} />
        <ResRow label="গন্ডা" value={c.complete && c.record.areaSqFt ? fix(c.record.areaSqFt / SQFT_PER_GONDA, 2) : '—'} />
        <div className="text-sm font-semibold text-slate-500 py-2">
          {c.complete ? (c.usedDiagonal ? 'কর্ণ দিয়ে নিখুঁত হিসাব' : 'গড় পদ্ধতি: (উ+দ)÷২ × (পূ+প)÷২') : '৪ বাহুর মাপ দিলে ফল দেখাবে'}
        </div>
      </div>

      {draft.plots.length > 1 && (
        <div className="rounded-2xl bg-emerald-900 text-white px-4 py-3 flex items-center justify-between">
          <span className="text-[16px] font-bold">মোট ({bn(draft.plots.length)}টি প্লট)</span>
          <span className="text-2xl font-extrabold">{fix(totals.decimal, 2)} শতাংশ</span>
        </div>
      )}

      <button
        id="bahu-add-plot"
        onClick={addPlot}
        className="w-full min-h-[52px] rounded-2xl border-2 border-dashed border-emerald-700 text-emerald-800 bg-white text-[17px] font-extrabold"
      >
        + আরেকটি প্লট
      </button>

      {msg && <div className="rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 px-3 py-2.5 text-[15px] font-bold">{msg}</div>}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          id="bahu-open-canvas"
          onClick={onOpenDrawing}
          className="min-h-[58px] rounded-2xl border-2 border-emerald-800 text-emerald-900 bg-white text-[16px] font-extrabold leading-tight"
        >
          চিত্র ভিত্তিক-এ
          <br />
          খুলুন
        </button>
        <button
          id="bahu-complete"
          onClick={complete}
          className="min-h-[58px] rounded-2xl bg-emerald-800 active:bg-emerald-900 text-white text-[17px] font-extrabold shadow-md leading-tight"
        >
          ✓ সম্পন্ন
          <br />
          <span className="text-[14px] font-bold opacity-90">রিপোর্ট দেখুন</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <AutoSaved show={savedTick} />
        {draft.status !== 'completed' && (
          <button onClick={startNew} className="text-[15px] font-bold text-slate-500 min-h-[44px] px-2">
            নতুন জরিপ
          </button>
        )}
      </div>
    </div>
  );
};

const ResRow: React.FC<{ label: string; value: string; big?: boolean }> = ({ label, value, big }) => (
  <div className={`flex items-center justify-between border-b border-slate-100 ${big ? 'py-2.5' : 'py-2'}`}>
    <span className={`${big ? 'text-[19px] text-emerald-900' : 'text-[16px] text-slate-700'} font-bold`}>{label}</span>
    <span className={`${big ? 'text-[24px] text-emerald-900' : 'text-[17px] text-slate-900'} font-extrabold`}>{value}</span>
  </div>
);

const AutoSaved: React.FC<{ show: boolean }> = ({ show }) => (
  <span className={`text-sm font-bold transition-opacity ${show ? 'text-emerald-700 opacity-100' : 'text-slate-400 opacity-70'}`}>
    {show ? '✓ সংরক্ষিত হলো' : 'স্বয়ংক্রিয় সংরক্ষণ চালু'}
  </span>
);

const Steps: React.FC<{ step: 1 | 2 }> = ({ step }) => (
  <div className="flex items-center gap-2 text-[15px] font-bold">
    <span className={`px-3 min-h-[36px] rounded-full flex items-center ${step === 1 ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-900'}`}>
      ১ গ্রাহকের তথ্য
    </span>
    <span className="text-slate-400">→</span>
    <span className={`px-3 min-h-[36px] rounded-full flex items-center ${step === 2 ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
      ২ বাহুর মাপ
    </span>
  </div>
);

export type { BahuPlotDraft };
