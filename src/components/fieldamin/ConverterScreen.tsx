/**
 * পরিমাপ কনভার্টার — ডিজাইন B + A-এর দ্রুত টেবিল + C-এর সাম্প্রতিক
 * (design-previews/06b-converter.html)
 * সম্পূর্ণ অফলাইন। সাম্প্রতিক হিসাব ফোনে (localStorage) থাকে।
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Delete, Table2, Clock, X } from 'lucide-react';

type Kind = 'len' | 'area';
interface Unit {
  k: string;
  t: string;
  /** দৈর্ঘ্য: ১ একক = কত ফুট; ক্ষেত্রফল: ১ একক = কত বর্গফুট */
  f: number;
  s?: string;
}

/* পুরোনো অ্যাপের land-units.ts-এর মান; কানি/গন্ডা ফেনীর (ব্যবহারকারীর দেওয়া) */
const SQFT_PER_DEC = 435.6;
const KANI_DEC = 39.67; // ১ কানি = ২০ গন্ডা = ৩৯.৬৭ শতাংশ

export const LEN_UNITS: Unit[] = [
  { k: 'link', t: 'লিংক', f: 0.66, s: '১ লিংক = ৭.৯২ ইঞ্চি' },
  { k: 'ft', t: 'ফুট', f: 1 },
  { k: 'in', t: 'ইঞ্চি', f: 1 / 12 },
  { k: 'haat', t: 'হাত', f: 1.5, s: '১ হাত = ১৮ ইঞ্চি' },
  { k: 'yd', t: 'গজ', f: 3 },
  { k: 'm', t: 'মিটার', f: 3.28084 },
  { k: 'chain', t: 'চেইন', f: 66, s: '১ চেইন = ১০০ লিংক = ৬৬ ফুট' },
];
export const AREA_UNITS: Unit[] = [
  { k: 'dec', t: 'শতাংশ', f: SQFT_PER_DEC },
  { k: 'sqft', t: 'বর্গফুট', f: 1 },
  { k: 'katha', t: 'কাঠা', f: 720 },
  { k: 'bigha', t: 'বিঘা', f: 14400 },
  { k: 'acre', t: 'একর', f: 43560 },
  { k: 'kani', t: 'কানি', f: KANI_DEC * SQFT_PER_DEC, s: '১ কানি = ২০ গন্ডা = ৩৯.৬৭ শতাংশ' },
  { k: 'gonda', t: 'গন্ডা', f: (KANI_DEC * SQFT_PER_DEC) / 20, s: '২০ গন্ডা = ১ কানি' },
  { k: 'ojut', t: 'অযুতাংশ', f: 4.356 },
  { k: 'sqm', t: 'বর্গমিটার', f: 10.76391 },
];
const LIST = (k: Kind) => (k === 'len' ? LEN_UNITS : AREA_UNITS);
const unitOf = (k: Kind, key: string) => LIST(k).find((u) => u.k === key) ?? LIST(k)[0];

/* ---------- সংখ্যা ---------- */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const toBn = (s: string | number) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
const nice = (v: number, d = 3) =>
  toBn(Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d }) : '0');

/** ফুট → ফুট-ইঞ্চি (১ ঘর দশমিক ইঞ্চি) */
export function ftIn(ft: number) {
  const tin = Math.round(ft * 12 * 10) / 10;
  let f = Math.floor(tin / 12 + 1e-9);
  let i = Math.round((tin - f * 12) * 10) / 10;
  if (i >= 12) {
    f += 1;
    i = 0;
  }
  return { txt: `${toBn(f)} ফুট ${nice(i, 1)} ইঞ্চি`, short: `${toBn(f)}′ ${nice(i, 1)}″` };
}

/* ---------- সাম্প্রতিক ---------- */
type Hist = [Kind, string, string];
const HIST_KEY = 'fa_converter_recent_v1';
const loadHist = (): Hist[] => {
  try {
    const h = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    return Array.isArray(h) ? h.filter((x) => Array.isArray(x) && x.length === 3).slice(0, 6) : [];
  } catch {
    return [];
  }
};

const QUICK_LEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100];
const QUICK_AREA = [1, 2, 3, 5, 10, 15, 20, 25, 33, 50, 100, 160];

export const ConverterScreen: React.FC = () => {
  const [kind, setKind] = useState<Kind>('len');
  const [from, setFrom] = useState('link');
  const [to, setTo] = useState('ftin');
  const [v, setV] = useState('10');
  const [hist, setHist] = useState<Hist[]>(loadHist);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const histTimer = useRef<number | undefined>(undefined);

  const say = (m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1800);
  };

  useEffect(() => {
    localStorage.setItem(HIST_KEY, JSON.stringify(hist));
  }, [hist]);
  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(histTimer.current);
    },
    []
  );

  // বাছাই করা চিপ সারির বাইরে চলে গেলে দেখা যায় এমন জায়গায় আনা
  const fromRow = useRef<HTMLDivElement>(null);
  const toRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (const row of [fromRow.current, toRow.current]) {
      const el = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (row && el) {
        const left = el.offsetLeft - row.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
        row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
    }
  }, [kind, from, to]);

  const num = parseFloat(v) || 0;
  const u = unitOf(kind, from);
  const base = num * u.f; // ফুট বা বর্গফুট

  const result = useMemo(() => {
    if (to === 'ftin') return { main: ftIn(base).txt, sub: `মোট ${nice(base)} ফুট` };
    const t = unitOf(kind, to);
    const sub =
      kind === 'len'
        ? `= ${ftIn(base).short}`
        : to === 'sqft'
        ? `= ${nice(base / SQFT_PER_DEC, 4)} শতাংশ`
        : `= ${nice(base, 1)} বর্গফুট`;
    return { main: `${nice(base / t.f, 4)} ${t.t}`, sub };
  }, [base, kind, to]);

  const pushHist = (k: Kind, f: string, val: string) => {
    if (!(parseFloat(val) > 0)) return;
    const rec: Hist = [k, f, val];
    setHist((h) => [rec, ...h.filter((x) => x.join() !== rec.join())].slice(0, 6));
  };
  /** টাইপ থামার ১.৬ সেকেন্ড পর সাম্প্রতিকে যোগ */
  const scheduleHist = (k: Kind, f: string, val: string) => {
    window.clearTimeout(histTimer.current);
    histTimer.current = window.setTimeout(() => pushHist(k, f, val), 1600);
  };

  const switchKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setFrom(k === 'len' ? 'link' : 'dec');
    setTo(k === 'len' ? 'ftin' : 'sqft');
    setV(k === 'len' ? '10' : '1');
  };

  const pickFrom = (key: string) => {
    pushHist(kind, from, v);
    setFrom(key);
    if (to === key) setTo(kind === 'len' ? 'ftin' : key === 'sqft' ? 'dec' : 'sqft');
  };

  const press = (key: string) => {
    let next = v;
    let f = from;
    if (key === 'del') next = v.slice(0, -1);
    else if (key === 'C') next = '';
    else if (key.startsWith('q')) {
      next = key.slice(1);
      f = kind === 'len' ? 'link' : 'dec';
      setFrom(f);
      if (to === f) setTo(kind === 'len' ? 'ftin' : 'sqft');
      pushHist(kind, f, next);
    } else if (key === '.') {
      if (!v.includes('.')) next = (v || '0') + '.';
    } else if (v.replace('.', '').length < 9) next = (v === '0' ? '' : v) + key;
    setV(next);
    if (!key.startsWith('q')) scheduleHist(kind, f, next);
  };

  const swap = () => {
    if (to === 'ftin') {
      setFrom('ft');
      setV(String(+base.toFixed(3)));
      setTo('link');
    } else {
      const nf = to;
      setFrom(nf);
      setV(String(+(base / unitOf(kind, nf).f).toFixed(4)));
      setTo(from);
    }
    say('উল্টে দেওয়া হলো');
  };

  const copyResult = async () => {
    const txt = `${toBn(v || '0')} ${u.t} = ${result.main}`;
    try {
      await navigator.clipboard.writeText(txt);
      say('ফলাফল কপি হলো');
    } catch {
      say(txt);
    }
  };

  const histText = ([k, f, val]: Hist) => {
    const uu = unitOf(k, f);
    const b = (parseFloat(val) || 0) * uu.f;
    return {
      a: `${toBn(val)} ${uu.t} →`,
      b:
        k === 'len'
          ? ftIn(b).short
          : f === 'dec'
          ? `${nice(b, 1)} বর্গফুট`
          : `${nice(b / SQFT_PER_DEC, 2)} শতাংশ`,
    };
  };

  const toList: Unit[] = (kind === 'len' ? [{ k: 'ftin', t: 'ফুট-ইঞ্চি', f: 1 }] : []).concat(
    LIST(kind).filter((x) => x.k !== from)
  );
  const keys = ['7', '8', '9', 'del', '4', '5', '6', 'C', '1', '2', '3', 'q10', '.', '0', '00', 'q100'];
  const qUnit = kind === 'len' ? 'লিংক' : 'শতাংশ';

  const chip = (on: boolean, gold = false) =>
    `shrink-0 min-h-[44px] px-3.5 rounded-full border-[1.5px] text-[15px] font-bold transition active:scale-95 ${
      on
        ? gold
          ? 'bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 border-transparent'
          : 'bg-[#065f46] text-amber-200 border-[#065f46]'
        : 'bg-white border-slate-300 text-slate-700'
    }`;

  return (
    <div id="converter-screen" className="-mx-3.5 sm:mx-0 -mt-3.5 pb-[100px] bg-[#f1f5f2] min-h-[calc(100dvh-70px)] flex flex-col">
      {/* দৈর্ঘ্য / ক্ষেত্রফল */}
      <div className="flex bg-white border-b-[1.5px] border-slate-300" role="tablist">
        {(
          [
            ['len', 'দৈর্ঘ্য (বাহু)'],
            ['area', 'ক্ষেত্রফল (জমি)'],
          ] as Array<[Kind, string]>
        ).map(([k, t]) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => switchKind(k)}
            className={`flex-1 min-h-[52px] text-base font-bold border-b-[3px] ${
              kind === k ? 'text-[#065f46] border-[#065f46]' : 'text-slate-600 border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* বড় ডিসপ্লে */}
      <div className="relative mx-3 mt-2.5 bg-[#065f46] rounded-3xl px-4 pt-3 pb-3.5 text-white shadow-[0_10px_24px_rgba(6,95,70,.25)]">
        <button
          onClick={swap}
          aria-label="উল্টান"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-amber-600 text-amber-950 flex items-center justify-center shadow-md active:scale-95 transition"
        >
          <ArrowUpDown className="w-6 h-6" />
        </button>
        <div className="flex items-baseline justify-end gap-1.5 min-h-[44px] pl-14">
          <strong className="text-[34px] font-extrabold leading-tight tracking-wide break-all">{v ? toBn(v) : '০'}</strong>
          <span className="w-[3px] h-[30px] bg-amber-400 self-center animate-pulse" aria-hidden="true" />
          <span className="text-[17px] font-bold text-emerald-200">{u.t}</span>
        </div>
        <div className="h-[1.5px] bg-amber-200/35 my-1.5 ml-14" />
        <button onClick={copyResult} className="block w-full text-right pl-14" aria-label="ফলাফল কপি করুন">
          <b className="block text-[28px] font-extrabold text-amber-200 leading-tight">{result.main}</b>
          <small className="text-sm font-bold text-emerald-200">{result.sub}</small>
        </button>
      </div>
      {u.s && <p className="px-4 pt-1.5 text-sm font-semibold text-slate-600">{u.s}</p>}

      {/* থেকে / কিসে */}
      <div className="flex items-center gap-1.5 pt-2 pl-3">
        <span className="shrink-0 w-[38px] text-sm font-extrabold text-[#065f46] leading-tight">থেকে</span>
        <div ref={fromRow} className="flex gap-1.5 overflow-x-auto pr-3 pb-0.5 no-scrollbar">
          {LIST(kind).map((x) => (
            <button key={x.k} onClick={() => pickFrom(x.k)} className={chip(x.k === from)} aria-pressed={x.k === from}>
              {x.t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-2 pl-3">
        <span className="shrink-0 w-[38px] text-sm font-extrabold text-[#065f46] leading-tight">কিসে</span>
        <div ref={toRow} className="flex gap-1.5 overflow-x-auto pr-3 pb-0.5 no-scrollbar">
          {toList.map((x) => (
            <button key={x.k} onClick={() => setTo(x.k)} className={chip(x.k === to, true)} aria-pressed={x.k === to}>
              {x.t}
            </button>
          ))}
        </div>
      </div>

      {/* দ্রুত টেবিল + সাম্প্রতিক */}
      <div className="flex gap-1.5 px-3 pt-2.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSheet(true)}
          className="shrink-0 min-h-[44px] px-3 rounded-2xl bg-[#065f46] text-amber-200 text-sm font-bold flex items-center gap-1.5 active:scale-95 transition"
        >
          <Table2 className="w-[18px] h-[18px]" />
          দ্রুত টেবিল
        </button>
        {hist.map((h, i) => {
          const t = histText(h);
          return (
            <button
              key={h.join() + i}
              onClick={() => {
                setKind(h[0]);
                setFrom(h[1]);
                setV(h[2]);
                setTo(h[0] === 'len' ? 'ftin' : h[1] === 'sqft' ? 'dec' : 'sqft');
              }}
              className="shrink-0 min-h-[44px] px-3 rounded-2xl bg-white border-[1.5px] border-dashed border-slate-400 text-sm font-bold text-slate-700 flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition"
            >
              <Clock className="w-[18px] h-[18px] text-[#065f46]" />
              {t.a} <b className="text-[#065f46]">{t.b}</b>
            </button>
          );
        })}
      </div>

      {/* নিজস্ব কী-প্যাড (ফোনের কীবোর্ড লাগে না) */}
      <div className="mt-auto grid grid-cols-4 gap-[7px] px-3 pt-2.5">
        {keys.map((k) =>
          k === 'del' ? (
            <button key={k} onClick={() => press(k)} aria-label="একটা মুছুন" className="h-[52px] rounded-2xl bg-emerald-50 text-[#065f46] shadow-[0_2px_4px_rgba(15,23,42,.08)] flex items-center justify-center active:scale-95 transition">
              <Delete className="w-[26px] h-[26px]" />
            </button>
          ) : k === 'C' ? (
            <button key={k} onClick={() => press(k)} className="h-[52px] rounded-2xl bg-red-50 text-red-600 text-[17px] font-extrabold shadow-[0_2px_4px_rgba(15,23,42,.08)] active:scale-95 transition">
              মুছুন
            </button>
          ) : k.startsWith('q') ? (
            <button key={k} onClick={() => press(k)} className="h-[52px] rounded-2xl bg-amber-50 text-amber-800 text-[15px] font-extrabold shadow-[0_2px_4px_rgba(15,23,42,.08)] leading-tight active:scale-95 transition">
              {toBn(k.slice(1))} {qUnit}
            </button>
          ) : (
            <button key={k} onClick={() => press(k)} className="h-[52px] rounded-2xl bg-white text-slate-900 text-2xl font-extrabold shadow-[0_2px_4px_rgba(15,23,42,.08)] active:scale-95 transition">
              {toBn(k)}
            </button>
          )
        )}
      </div>

      {/* দ্রুত টেবিল শিট */}
      <div
        aria-hidden="true"
        onClick={() => setSheet(false)}
        className={`fixed inset-0 z-[55] bg-slate-900/45 transition-opacity ${sheet ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        role="dialog"
        aria-label="দ্রুত টেবিল"
        inert={!sheet}
        className={`fixed left-0 right-0 bottom-0 z-[56] max-h-[84dvh] overflow-y-auto bg-white rounded-t-3xl px-4 pt-2.5 pb-6 transition-transform duration-200 max-w-md mx-auto ${
          sheet ? 'translate-y-0' : 'translate-y-[105%]'
        }`}
      >
        <div className="w-11 h-[5px] rounded bg-slate-300 mx-auto mb-2.5" />
        <div className="flex items-center gap-2 mb-1">
          <b className="flex-1 text-lg font-extrabold text-[#065f46]">
            দ্রুত টেবিল: {kind === 'len' ? 'লিংক → ফুট-ইঞ্চি' : 'শতাংশ → বর্গফুট'}
          </b>
          <button onClick={() => setSheet(false)} aria-label="বন্ধ" className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="w-[22px] h-[22px]" />
          </button>
        </div>
        <p className="text-sm text-slate-500 font-semibold mb-2">যেকোনো সারিতে চাপলে ওপরের ডিসপ্লেতে বসে যাবে</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(kind === 'len' ? QUICK_LEN : QUICK_AREA).map((n) => (
            <button
              key={n}
              onClick={() => {
                const f = kind === 'len' ? 'link' : 'dec';
                setFrom(f);
                setV(String(n));
                if (to === f) setTo(kind === 'len' ? 'ftin' : 'sqft');
                pushHist(kind, f, String(n));
                setSheet(false);
              }}
              className="min-h-[52px] rounded-2xl bg-slate-100 flex items-center justify-between px-3 text-[15px] font-bold active:bg-emerald-50"
            >
              <span>
                {toBn(n)} {qUnit}
              </span>
              <b className="text-[#065f46] font-extrabold">
                {kind === 'len' ? ftIn(n * 0.66).short : nice(n * SQFT_PER_DEC, 1)}
              </b>
            </button>
          ))}
        </div>
      </div>

      {/* ছোট বার্তা */}
      <div
        role="status"
        className={`fixed left-1/2 bottom-28 -translate-x-1/2 z-[57] bg-slate-900 text-white text-[15px] font-semibold px-4 py-2.5 rounded-2xl max-w-[88vw] text-center transition-all ${
          toast ? 'opacity-100' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        {toast}
      </div>
    </div>
  );
};
