/**
 * হ্যান্ড ম্যাপ — ডিজাইন B (হালকা ঘিয়ে কাগজ, সোনালি ফ্রেম, ৩ রকম কলম, উত্তর তীর, চৌহদ্দি), সবুজ #065f46।
 * নকশা পরিমাপ থেকে স্বয়ংক্রিয়; নাম/দাগ/মৌজা/নোট/চৌহদ্দি বদলানো যায় (নকশার লেখায় ট্যাপ বা "সম্পাদনা")।
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Download, FileText, Pencil, Share2, X } from 'lucide-react';
import { SurveyRecord } from '../../types';
import { HandMapOptions, InkKey, MAP_H, MAP_W, fmtNum, renderHandMap, resetMeasureCache, styleSample, thumbPoints } from '../../lib/handmapRender';
import {
  HandMapItem,
  collectHandMaps,
  downloadBlob,
  fileNameFor,
  handMapPng,
  loadOpts,
  saveEdit,
  saveHandMapForReport,
  saveOpts,
} from '../../lib/handmapStore';
import { toBnDigits } from '../../lib/banglaDate';

interface Props {
  surveys: SurveyRecord[];
  initialSurveyId?: string;
  onGoMeasure: () => void;
  onOpenReport?: (surveyId?: string) => void;
}

const GOLD = '#fde68a';
const PENS: [InkKey, boolean, string][] = [
  ['pencil', true, 'পেন্সিল'],
  ['black', true, 'কালো কালি'],
  ['green', false, 'সোজা নকশা'],
];
const FIELD_T: Record<string, string> = {
  name: 'দখলদারের নাম',
  dag: 'দাগ নম্বর',
  mouza: 'মৌজা',
  note: 'নোট',
  nb0: 'উত্তরে',
  nb1: 'পূর্বে',
  nb2: 'দক্ষিণে',
  nb3: 'পশ্চিমে',
};

export const HandMapScreen: React.FC<Props> = ({ surveys, initialSurveyId, onGoMeasure, onOpenReport }) => {
  const [ver, setVer] = useState(0);
  const [fontTick, setFontTick] = useState(0);
  const items = useMemo(() => collectHandMaps(surveys), [surveys, ver]);
  const [curId, setCurId] = useState<string | null>(() => {
    const first = collectHandMaps(surveys);
    const hit = initialSurveyId ? first.find((x) => x.surveyId === initialSurveyId) : undefined;
    return (hit || first[0])?.rec.id ?? null;
  });
  const [opts, setOpts] = useState<HandMapOptions>(loadOpts);
  const [sheet, setSheet] = useState<null | { focus?: string }>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'share' | 'report'>(null);

  const cur: HandMapItem | undefined = items.find((x) => x.rec.id === curId) || items[0];

  // ফন্ট লোড হলে লেখার মাপ আবার নিই (লেখা যাতে দাগে না পড়ে)
  useEffect(() => {
    const f = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!f) return;
    Promise.all([
      f.load('800 15px "Noto Sans Bengali"', 'হ্যান্ড ম্যাপ ০১২'),
      f.load('700 13px "Noto Sans Bengali"', 'দাগ মৌজা'),
      f.load('600 13px "Noto Sans Bengali"', 'নোট'),
    ])
      .catch(() => undefined)
      .then(() => f.ready)
      .then(() => {
        resetMeasureCache();
        setFontTick((t) => t + 1);
      });
  }, []);

  useEffect(() => saveOpts(opts), [opts]);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 2400);
  };

  const svgMarkup = useMemo(() => (cur ? renderHandMap(cur.rec, opts, 'v') : ''), [cur, opts, fontTick]);

  if (!cur) {
    return (
      <div id="handmap-screen" className="space-y-4 pb-28">
        <div className="rounded-3xl bg-[#065f46] text-white p-5">
          <h2 className="text-xl font-extrabold" style={{ color: GOLD }}>
            হ্যান্ড ম্যাপ
          </h2>
          <p className="text-[15px] mt-1 text-emerald-50">পরিমাপ থেকে হাতে আঁকা ধাঁচের নকশা তৈরি হয়।</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5 text-center space-y-3">
          <p className="text-[17px] font-bold text-slate-800">এখনো কোনো মাপা জমি নেই</p>
          <p className="text-[15px] text-slate-600">দখল পরিমাপে ৪ বাহুর মাপ দিলে বা চিত্র ভিত্তিকে প্লট আঁকলে এখানে নকশা আসবে।</p>
          <button onClick={onGoMeasure} className="w-full min-h-[54px] rounded-2xl bg-emerald-800 text-white text-[17px] font-extrabold">
            দখল পরিমাপ শুরু করুন
          </button>
        </div>
      </div>
    );
  }

  const r = cur.rec;
  const getF = (k: string) => (k.startsWith('nb') ? r.nb[+k[2]] || '' : String((r as unknown as Record<string, string>)[k] ?? ''));
  const setF = (k: string, v: string) => {
    if (k.startsWith('nb')) {
      const nb = [0, 1, 2, 3].map((i) => r.nb[i] || '');
      nb[+k[2]] = v;
      saveEdit(r.id, { nb });
    } else saveEdit(r.id, { [k]: v });
    setVer((x) => x + 1);
  };

  const onMapTap = (e: React.MouseEvent) => {
    const el = (e.target as Element).closest('[data-edit]') as SVGElement | null;
    if (!el) return;
    const k = el.getAttribute('data-edit') || '';
    if (k === 'len' || k === 'area') return flash('মাপ পরিমাপ থেকে আসে — বদলাতে দখল পরিমাপ খুলুন');
    if (k === 'amin') return flash('আমিনের নাম এডমিন সেটিংসে বদলানো যাবে');
    setSheet({ focus: k === 'mouza' ? 'mouza' : k });
  };

  const doSave = async () => {
    setBusy('save');
    try {
      const png = await handMapPng(r, opts);
      downloadBlob(png, fileNameFor(r));
      flash('ছবি (PNG) সেভ হলো ✓');
    } catch {
      flash('ছবি তৈরি হয়নি — আবার চেষ্টা করুন');
    } finally {
      setBusy(null);
    }
  };
  const doShare = async () => {
    setBusy('share');
    try {
      const png = await handMapPng(r, opts);
      const file = new File([png], fileNameFor(r), { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'হ্যান্ড ম্যাপ', text: `${r.name} · দাগ ${r.dag}` });
      } else {
        downloadBlob(png, fileNameFor(r));
        flash('এই ব্রাউজারে শেয়ার হয় না — ছবি সেভ হলো');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') flash('শেয়ার হয়নি — আবার চেষ্টা করুন');
    } finally {
      setBusy(null);
    }
  };
  const doReport = async () => {
    setBusy('report');
    try {
      await saveHandMapForReport(cur, opts);
      flash('নকশা রিপোর্টের জন্য রাখা হলো ✓');
      if (onOpenReport && cur.source === 'survey' && cur.surveyId) window.setTimeout(() => onOpenReport(cur.surveyId), 700);
    } catch {
      flash('রাখা যায়নি — আবার চেষ্টা করুন');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div id="handmap-screen" className="-mx-3.5 sm:mx-0 -mt-3.5 pb-[110px] bg-[#f1f5f2] min-h-[calc(100dvh-70px)]">
      {/* উপরের সবুজ অংশ + রেকর্ড চিপ */}
      <div className="bg-[#065f46] px-3 pt-3 pb-3">
        <h2 className="text-[19px] font-extrabold px-1" style={{ color: GOLD }}>
          হ্যান্ড ম্যাপ
        </h2>
        <div className="flex gap-2 mt-2.5 overflow-x-auto pb-0.5" id="handmap-chips">
          {items.map((it) => {
            const on = it.rec.id === r.id;
            return (
              <button
                key={it.rec.id}
                onClick={() => setCurId(it.rec.id)}
                className={`shrink-0 min-h-[48px] pl-2 pr-3.5 rounded-full border-[1.5px] text-left leading-tight flex items-center gap-2 ${
                  on ? 'border-transparent text-[#422006]' : 'border-amber-300/60 text-emerald-50'
                }`}
                style={on ? { background: 'linear-gradient(135deg,#fde68a,#f59e0b)' } : undefined}
              >
                <svg viewBox="0 0 44 44" className="w-8 h-8 shrink-0">
                  <polygon points={thumbPoints(it.rec.pts)} fill={on ? '#fff7d6' : '#0b7a5b'} stroke={on ? '#422006' : GOLD} strokeWidth={2.5} />
                </svg>
                <span>
                  <span className="block text-[15px] font-bold">{it.rec.name || '—'}</span>
                  <span className="block text-[13px] opacity-90">
                    দাগ {it.rec.dag || '—'} · {it.typeLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* কাগজ — সোনালি ফ্রেম */}
      <div className="m-3 rounded-[22px] p-1.5 shadow-[0_10px_24px_rgba(2,44,34,.18)]" style={{ background: 'linear-gradient(135deg,#fde68a,#b45309)' }}>
        <div className="rounded-[17px] overflow-hidden bg-[#fffdf5]">
          <svg
            id="handmap-svg"
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="w-full h-auto block select-none [&_[data-edit]]:cursor-pointer"
            onClick={onMapTap}
            role="img"
            aria-label={`হ্যান্ড ম্যাপ — ${r.name}, দাগ ${r.dag}`}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </div>
      </div>
      <p className="px-4 -mt-1 text-[14px] font-semibold text-slate-600">নকশার নাম, দাগ, নোট বা চৌহদ্দিতে ট্যাপ করেও বদলানো যায়।</p>

      {/* কলমের ধরন */}
      <div className="text-[15px] font-extrabold text-[#065f46] px-4 pt-3 pb-1.5">কলমের ধরন</div>
      <div className="grid grid-cols-3 gap-2 px-3">
        {PENS.map(([ink, rg, t]) => {
          const on = opts.ink === ink && opts.rough === rg;
          return (
            <button
              key={ink}
              onClick={() => setOpts((o) => ({ ...o, ink, rough: rg }))}
              className={`rounded-[18px] bg-white border-2 pt-2 pb-1.5 px-1 text-[15px] font-extrabold flex flex-col items-center gap-0.5 ${
                on ? 'border-amber-600 bg-amber-50 shadow-[0_0_0_2px_#fde68a]' : 'border-slate-200'
              }`}
            >
              <svg viewBox="0 0 56 30" className="w-14 h-[30px]" dangerouslySetInnerHTML={{ __html: styleSample(rg, ink) }} />
              {t}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 px-3 pt-2.5">
        {(
          [
            ['chau', 'চৌহদ্দি'],
            ['hatch', 'ছায়া রেখা'],
          ] as const
        ).map(([k, t]) => {
          const on = opts[k];
          return (
            <button
              key={k}
              onClick={() => setOpts((o) => ({ ...o, [k]: !o[k] }))}
              className={`flex-1 min-h-[50px] rounded-full border-[1.5px] text-[15px] font-extrabold flex items-center justify-center gap-1.5 ${
                on ? 'bg-[#065f46] border-[#065f46]' : 'bg-white border-slate-300 text-slate-700'
              }`}
              style={on ? { color: GOLD } : undefined}
              aria-pressed={on}
            >
              <Compass className="w-5 h-5" />
              {t} {on ? 'চালু' : 'বন্ধ'}
            </button>
          );
        })}
      </div>

      {/* তথ্য কার্ড */}
      <div className="m-3 bg-white rounded-[22px] p-3.5 shadow-[0_4px_14px_rgba(2,44,34,.08)] flex gap-2.5 items-start">
        <div className="flex-1 min-w-0">
          <b className="block text-[19px] font-extrabold text-slate-900">{r.name || '—'}</b>
          <span className="block text-[15px] text-slate-600 font-semibold">
            দাগ {r.dag || '—'} · {r.mouza || '—'} · {fmtNum(r.sq / 435.6)} শতক
          </span>
          {r.note && <span className="block text-[14px] text-slate-500 mt-1">{r.note}</span>}
        </div>
        <button
          id="handmap-edit"
          onClick={() => setSheet({})}
          className="shrink-0 min-h-[48px] px-3.5 rounded-2xl bg-[#065f46] font-extrabold text-[15px] flex items-center gap-1.5"
          style={{ color: GOLD }}
        >
          <Pencil className="w-5 h-5" />
          সম্পাদনা
        </button>
      </div>

      {/* কাজ */}
      <div className="grid grid-cols-[1fr_1fr_1.25fr] gap-2 px-3">
        <ActBtn id="handmap-save" onClick={doSave} busy={busy === 'save'} icon={<Download className="w-[22px] h-[22px]" />} label="ছবি সেভ" />
        <ActBtn id="handmap-share" onClick={doShare} busy={busy === 'share'} icon={<Share2 className="w-[22px] h-[22px]" />} label="শেয়ার" />
        <ActBtn id="handmap-report" onClick={doReport} busy={busy === 'report'} icon={<FileText className="w-[22px] h-[22px]" />} label="রিপোর্টে যোগ" primary />
      </div>

      {/* তথ্য বদলানোর শিট */}
      {sheet && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" aria-label="বন্ধ" onClick={() => setSheet(null)} />
          <div id="handmap-sheet" className="relative bg-white rounded-t-3xl px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-2" />
            <div className="flex items-center justify-between mb-2">
              <b className="text-[18px] font-extrabold text-slate-900">তথ্য বদলান</b>
              <button onClick={() => setSheet(null)} className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-100" aria-label="বন্ধ">
                <X className="w-6 h-6" />
              </button>
            </div>
            <SheetField k="name" label={FIELD_T.name} value={getF('name')} onChange={setF} autoFocus={sheet.focus === 'name'} />
            <div className="grid grid-cols-2 gap-2.5">
              <SheetField k="dag" label={FIELD_T.dag} value={getF('dag')} onChange={setF} autoFocus={sheet.focus === 'dag'} />
              <SheetField k="mouza" label={FIELD_T.mouza} value={getF('mouza')} onChange={setF} autoFocus={sheet.focus === 'mouza'} />
            </div>
            <SheetField k="note" label={FIELD_T.note} value={getF('note')} onChange={setF} multiline autoFocus={sheet.focus === 'note'} />
            <div className="text-[15px] font-extrabold text-slate-700 mt-1 mb-1.5">চৌহদ্দি (কার জমি / রাস্তা ইত্যাদি)</div>
            <div className="grid grid-cols-2 gap-2.5">
              {['nb0', 'nb2', 'nb1', 'nb3'].map((k) => (
                <SheetField key={k} k={k} label={FIELD_T[k]} value={getF(k)} onChange={setF} autoFocus={sheet.focus === k} />
              ))}
            </div>
            <p className="text-[14px] text-slate-500 font-semibold my-2">বাহুর মাপ ও শতক পরিমাপ থেকে আসে।</p>
            <button onClick={() => setSheet(null)} className="w-full min-h-[54px] rounded-2xl bg-emerald-800 text-white text-[17px] font-extrabold">
              ঠিক আছে
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[96px] z-[80] max-w-[90vw] rounded-2xl bg-slate-900 text-white text-[15px] font-bold px-4 py-3 shadow-lg text-center">
          {toast}
        </div>
      )}
      <span className="sr-only">{toBnDigits(items.length)}টি নকশা</span>
    </div>
  );
};

const ActBtn: React.FC<{ id: string; onClick: () => void; busy: boolean; icon: React.ReactNode; label: string; primary?: boolean }> = ({
  id,
  onClick,
  busy,
  icon,
  label,
  primary,
}) => (
  <button
    id={id}
    onClick={onClick}
    disabled={busy}
    className={`min-h-[58px] rounded-2xl border-[1.5px] font-extrabold text-[15px] flex flex-col items-center justify-center gap-0.5 leading-tight disabled:opacity-60 ${
      primary ? 'border-transparent text-[#422006]' : 'border-[#065f46] text-[#065f46] bg-white'
    }`}
    style={primary ? { background: 'linear-gradient(135deg,#fde68a,#d97706)' } : undefined}
  >
    {icon}
    {busy ? 'হচ্ছে…' : label}
  </button>
);

const SheetField: React.FC<{
  k: string;
  label: string;
  value: string;
  onChange: (k: string, v: string) => void;
  multiline?: boolean;
  autoFocus?: boolean;
}> = ({ k, label, value, onChange, multiline, autoFocus }) => (
  <label className="block mb-2.5">
    <span className="block text-[15px] font-bold text-slate-700 mb-1">{label}</span>
    {multiline ? (
      <textarea
        id={`hm-f-${k}`}
        value={value}
        autoFocus={autoFocus}
        rows={2}
        onChange={(e) => onChange(k, e.target.value)}
        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-[17px] font-semibold outline-none focus:border-emerald-700"
      />
    ) : (
      <input
        id={`hm-f-${k}`}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(k, e.target.value)}
        className="w-full min-h-[50px] rounded-xl border-2 border-slate-300 px-3 text-[17px] font-semibold outline-none focus:border-emerald-700"
      />
    )}
  </label>
);
