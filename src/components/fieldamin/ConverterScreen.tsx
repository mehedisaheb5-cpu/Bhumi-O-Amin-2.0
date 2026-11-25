/**
 * পরিমাপ ক্যালকুলেটর — ডার্ক ফোন-ক্যালকুলেটর স্টাইল (Founder-এর স্ক্রিনশট, ২৬ নভেম্বর ২০২৬)
 *
 * দুই মোড:
 *  - লিংক ক্যালকুলেটর (ডিফল্ট): শুধু দৈর্ঘ্য — লিংক/ফুট/ইঞ্চি/মিটার।
 *    ফলাফল শুধু ২ লাইন — উপরে ইনপুট ("১২০ লিংক"), নিচে বদলানো মান
 *    ("৭৯ ফুট ২ ইঞ্চি")। ইঞ্চি সবসময় পূর্ণ সংখ্যা (২.৪ → ২, ৮.৯ → ৯)।
 *    ধরন (দৈর্ঘ্য/ক্ষেত্রফল) একেবারে বাদ — Founder, ২৬ নভেম্বর ০৩:৩৯।
 *    ক্ষেত্রফল রূপান্তর এই ক্যালকুলেটরে নেই।
 *  - সাধারণ ক্যালকুলেটর: সাধারণ পাটিগণিত (AC, %, ⌫, ÷, ×, −, +, =, .)
 *
 * উপরে: কপি আইকন + "ক্যালকুলেটর" শিরোনাম + ইতিহাস (ঘড়ি) আইকন +
 * মোড সুইচ (Link Calculator ↔ Normal Calculator)।
 * কিপ্যাড পুরো প্রস্থ জুড়ে — কি গোল, সর্বোচ্চ ৭২px (২৬ নভেম্বর ০৩:৩৯,
 * Founder: বোতাম বড় হয়ে গেছে); ছোট ভিউপোর্টে কি আরও ছোট হয় যাতে
 * স্ক্রল না হয়। ফলাফলের ঘর বড় রাখা হয়েছে — ইনপুট ৪০px, ফলাফল ২৮px।
 * নিচের বার (BottomNav) এই স্ক্রিনে লুকানো থাকে — App.tsx দেখুন
 * (isCalculatorScreen)। হেডার থাকে, তাই বের হতে হেডারের লোগো/☰ ব্যবহার করতে হয়।
 *
 * সম্পূর্ণ অফলাইন। সাম্প্রতিক হিসাব ফোনে (localStorage) থাকে।
 * ফন্ট: Noto Serif Bengali (base64, calculator-font.css) — শুধু এই স্ক্রিনে,
 * স্বাভাবিক ওজন (font-normal/medium), সব Bold নয়।
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Clock, Copy, Delete, Table2, X } from 'lucide-react';
import './calculator-font.css';

interface Unit {
  k: string;
  t: string;
  /** দৈর্ঘ্য: ১ একক = কত ফুট */
  f: number;
  s?: string;
}

export const LEN_UNITS: Unit[] = [
  { k: 'link', t: 'লিংক', f: 0.66, s: '১ লিংক = ৭.৯২ ইঞ্চি' },
  { k: 'ft', t: 'ফুট', f: 1 },
  { k: 'in', t: 'ইঞ্চি', f: 1 / 12 },
  { k: 'm', t: 'মিটার', f: 3.28084 },
];
const unitOf = (key: string) => LEN_UNITS.find((u) => u.k === key) ?? LEN_UNITS[0];

/* ---------- সংখ্যা ---------- */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const toBn = (s: string | number) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
const nice = (v: number, d = 3) =>
  toBn(Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d }) : '0');

/** ফুট → ফুট-ইঞ্চি (পূর্ণ ইঞ্চি — নিকটতম পূর্ণ সংখ্যায় রাউন্ড; ২.৪ → ২, ৮.৯ → ৯) */
export function ftIn(ft: number) {
  const totalIn = Math.round(ft * 12);
  const f = Math.floor(totalIn / 12);
  const i = totalIn % 12;
  return { txt: `${toBn(f)} ফুট ${toBn(i)} ইঞ্চি`, short: `${toBn(f)}′ ${toBn(i)}″` };
}

/* ---------- সাম্প্রতিক ---------- */
type Hist = ['len', string, string];
const HIST_KEY = 'fa_converter_recent_v1';
const loadHist = (): Hist[] => {
  try {
    const h = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    // সরানো একক (হাত/গজ/চেইন) আর পুরোনো ক্ষেত্রফলের হিসাব বাদ — না হলে
    // unitOf ফলব্যাক (লিংক) দিয়ে ভুল নাম দেখাত
    return Array.isArray(h)
      ? h
          .filter(
            (x) =>
              Array.isArray(x) &&
              x.length === 3 &&
              x[0] === 'len' &&
              LEN_UNITS.some((u) => u.k === x[1])
          )
          .slice(0, 6)
      : [];
  } catch {
    return [];
  }
};

const QUICK_LEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100];
/** বিজোড় সংখ্যার সাজেশন — ট্যাপ করলে ওই সংখ্যা লিংক হিসেবে বসে */
const SUGGESTIONS = [5, 15, 25, 35];

const LINK_KEYS = ['7', '8', '9', 'del', '4', '5', '6', 'AC', '1', '2', '3', 'swap', '.', '0', '00', 'eq'];
const NORMAL_KEYS = ['AC', '%', '⌫', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', '.', '='];

const OP_SYM: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export const ConverterScreen: React.FC = () => {
  const [mode, setMode] = useState<'link' | 'normal'>('link');
  const [from, setFrom] = useState('link');
  const [to, setTo] = useState('ftin');
  const [v, setV] = useState('10');
  const [hist, setHist] = useState<Hist[]>(loadHist);
  const [sheet, setSheet] = useState<'quick' | 'history' | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const histTimer = useRef<number | undefined>(undefined);

  // সাধারণ ক্যালকুলেটরের স্টেট
  const [nDisplay, setNDisplay] = useState('0');
  const [nAcc, setNAcc] = useState<number | null>(null);
  const [nOp, setNOp] = useState<string | null>(null);
  const [nWaiting, setNWaiting] = useState(false);
  const [nExpr, setNExpr] = useState('');

  const showToast = (m: string) => {
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

  /** কী-প্যাডে যেই কি-তে ট্যাপ হবে ভাইব্রেট করবে (২৪ নভেম্বর Founder) */
  const buzz = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
    } catch {
      /* ভাইব্রেশন সমর্থন নেই — চুপচাপ */
    }
  };

  const num = parseFloat(v) || 0;
  const u = unitOf(from);
  const base = num * u.f; // ফুট

  // ফলাফল — শুধু বদলানো মান; সমীকরণ/মোট লাইন নেই
  const result = useMemo(() => {
    if (!v || isNaN(num)) return { value: '', copy: '' };
    const lhs = `${toBn(v)} ${u.t}`;
    if (to === 'ftin') {
      const conv = ftIn(base);
      return { value: conv.txt, copy: `${lhs} = ${conv.txt}` };
    }
    const t = unitOf(to);
    const val = `${nice(base / t.f, 4)} ${t.t}`;
    return { value: val, copy: `${lhs} = ${val}` };
  }, [base, to, v, u.t, num]);

  const pushHist = (f: string, val: string) => {
    if (!(parseFloat(val) > 0)) return;
    const rec: Hist = ['len', f, val];
    setHist((h) => [rec, ...h.filter((x) => x.join() !== rec.join())].slice(0, 6));
  };
  /** টাইপ থামার ১.৬ সেকেন্ড পর সাম্প্রতিকে যোগ */
  const scheduleHist = (f: string, val: string) => {
    window.clearTimeout(histTimer.current);
    histTimer.current = window.setTimeout(() => pushHist(f, val), 1600);
  };

  const pickFrom = (key: string) => {
    buzz();
    pushHist(from, v);
    setFrom(key);
    if (to === key) setTo('ftin');
  };

  const pickSuggest = (n: number) => {
    buzz();
    setFrom('link');
    setV(String(n));
    pushHist('link', String(n));
  };

  const press = (key: string) => {
    buzz();
    let next = v;
    if (key === 'del') next = v.slice(0, -1);
    else if (key === 'AC') next = '';
    else if (key === 'swap') {
      swap();
      return;
    } else if (key === 'eq') {
      void copyResult();
      return;
    } else if (key === '.') {
      if (!v.includes('.')) next = (v || '0') + '.';
    } else if (key === '00') {
      if (v !== '' && v !== '0' && v.replace('.', '').length < 9) next = v + '00';
    } else if (v.replace('.', '').length < 9) {
      next = (v === '0' ? '' : v) + key;
    }
    setV(next);
    scheduleHist(from, next);
  };

  const swap = () => {
    buzz();
    if (to === 'ftin') {
      setFrom('ft');
      setV(String(+base.toFixed(3)));
      setTo('link');
    } else {
      const nf = to;
      setFrom(nf);
      setV(String(+(base / unitOf(nf).f).toFixed(4)));
      setTo(from);
    }
    showToast('উল্টে দেওয়া হলো');
  };

  const copyResult = async () => {
    buzz();
    const txt = mode === 'link' ? result.copy : toBn(fmtNum(parseFloat(nDisplay)));
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      showToast('ফলাফল কপি হলো');
    } catch {
      showToast(txt);
    }
  };

  const histText = ([, f, val]: Hist) => {
    const uu = unitOf(f);
    const b = (parseFloat(val) || 0) * uu.f;
    return {
      a: `${toBn(val)} ${uu.t} →`,
      b: ftIn(b).short,
    };
  };

  const toList: Unit[] = [{ k: 'ftin', t: 'ফুট-ইঞ্চি', f: 1 }].concat(
    LEN_UNITS.filter((x) => x.k !== from)
  );
  const qUnit = 'লিংক';

  // ---- সাধারণ ক্যালকুলেটর ----
  const fmtNum = (n: number) => {
    if (!isFinite(n) || Number.isNaN(n)) return '0';
    return String(Math.round(n * 1e10) / 1e10);
  };
  const calcOp = (a: number, b: number, op: string) => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b === 0 ? NaN : a / b;
    return b;
  };
  const nDigit = (d: string) => {
    buzz();
    if (nWaiting) {
      setNDisplay(d);
      setNWaiting(false);
    } else {
      setNDisplay((p) => (p === '0' ? d : p.length >= 12 ? p : p + d));
    }
  };
  const nDot = () => {
    buzz();
    if (nWaiting) {
      setNDisplay('0.');
      setNWaiting(false);
    } else if (!nDisplay.includes('.')) {
      setNDisplay((p) => p + '.');
    }
  };
  const nOpPress = (op: string) => {
    buzz();
    const cur = parseFloat(nDisplay);
    let acc = nAcc;
    if (acc !== null && nOp && !nWaiting) {
      const r = calcOp(acc, cur, nOp);
      if (!isFinite(r) || Number.isNaN(r)) {
        showToast('শূন্য দিয়ে ভাগ করা যায় না');
        return;
      }
      acc = r;
    } else {
      acc = cur;
    }
    setNAcc(acc);
    setNOp(op);
    setNWaiting(true);
    setNDisplay(fmtNum(acc));
    setNExpr(`${toBn(fmtNum(acc))} ${OP_SYM[op]}`);
  };
  const nEquals = () => {
    buzz();
    if (nAcc === null || !nOp) return;
    const cur = parseFloat(nDisplay);
    const r = calcOp(nAcc, cur, nOp);
    if (!isFinite(r) || Number.isNaN(r)) {
      showToast('শূন্য দিয়ে ভাগ করা যায় না');
      return;
    }
    setNExpr(`${toBn(fmtNum(nAcc))} ${OP_SYM[nOp]} ${toBn(fmtNum(cur))} =`);
    setNDisplay(fmtNum(r));
    setNAcc(null);
    setNOp(null);
    setNWaiting(true);
  };
  const nPercent = () => {
    buzz();
    setNDisplay(fmtNum(parseFloat(nDisplay) / 100));
  };
  const nNegate = () => {
    buzz();
    if (nDisplay !== '0') setNDisplay((p) => (p.startsWith('-') ? p.slice(1) : `-${p}`));
  };
  const nBack = () => {
    buzz();
    if (nWaiting) return;
    setNDisplay((p) => (p.length <= 1 ? '0' : p.slice(0, -1)));
  };
  const nClear = () => {
    buzz();
    setNDisplay('0');
    setNAcc(null);
    setNOp(null);
    setNWaiting(false);
    setNExpr('');
  };
  const nPress = (k: string) => {
    if (k >= '0' && k <= '9') return nDigit(k);
    if (k === '.') return nDot();
    if (k === 'AC') return nClear();
    if (k === '%') return nPercent();
    if (k === '⌫') return nBack();
    if (k === '±') return nNegate();
    if (k === '=') return nEquals();
    if (k === '÷') return nOpPress('/');
    if (k === '×') return nOpPress('*');
    if (k === '−') return nOpPress('-');
    if (k === '+') return nOpPress('+');
  };

  const chip = (on: boolean) =>
    `shrink-0 min-h-[36px] px-3 rounded-full border text-[14px] font-medium transition active:scale-95 ${
      on ? 'bg-[#065f46] text-amber-200 border-transparent' : 'bg-[#2b2b2b] border-[#3d3d3d] text-[#e5e5e5]'
    }`;

  const keyClass = (k: string, m: 'link' | 'normal') => {
    // কি গোল, সর্বোচ্চ ৭২px (৩৬০px প্রস্থে ২০vw = ৭২); ছোট ভিউপোর্টে
    // (উচ্চতা কম হলে) আরও ছোট হয় যাতে স্ক্রল না হয় — গ্রিড পুরো প্রস্থ
    // জুড়েই থাকে, কি সেলের মাঝখানে বসে (mx-auto)
    const base =
      'mx-auto flex size-[min(82px,20vw,calc((100dvh-330px)/4))] shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95';
    if (k === '=' || k === 'eq') return `${base} bg-[#1e9bd8] text-[32px] font-normal`;
    if (m === 'link') {
      if (k === 'del' || k === 'AC' || k === 'swap') return `${base} bg-[#5c5c5c] text-[24px] font-normal`;
      return `${base} bg-[#2e2e2e] text-[34px] font-normal`;
    }
    if (k === 'AC' || k === '%' || k === '⌫' || k === '±') return `${base} bg-[#5c5c5c] text-[24px] font-normal`;
    if (k === '÷' || k === '×' || k === '−' || k === '+') return `${base} bg-[#6b6b6b] text-[28px] font-normal`;
    return `${base} bg-[#2e2e2e] text-[34px] font-normal`;
  };

  return (
    <div
      id="converter-screen"
      className="relative -mx-3.5 flex min-h-[calc(100dvh-65px)] flex-col bg-black px-3 pb-2 pt-0 text-white sm:-mx-6"
    >
      {/* উপরের সারি: কপি + শিরোনাম + ইতিহাস + মোড সুইচ */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="কপি করুন"
          onClick={copyResult}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2b2b2b] text-white transition-transform active:scale-95"
        >
          <Copy className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-[16px] font-medium">ক্যালকুলেটর</span>
        <button
          type="button"
          aria-label="ইতিহাস"
          onClick={() => {
            buzz();
            setSheet('history');
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2b2b2b] text-white transition-transform active:scale-95"
        >
          <Clock className="h-5 w-5" />
        </button>
        <button
          type="button"
          data-mode-switch
          onClick={() => {
            buzz();
            setMode((m) => (m === 'link' ? 'normal' : 'link'));
          }}
          className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-[#2b2b2b] px-2.5 text-[11px] font-medium text-white transition-transform active:scale-95"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
          {mode === 'link' ? 'Link Calculator' : 'Normal Calculator'}
        </button>
      </div>

      {mode === 'link' ? (
        <>
          {/* ডিসপ্লে — শুধু ২ লাইন: ইনপুট + ফলাফল (কোনো সমীকরণ/মোট লাইন নেই);
              ফলাফলের ঘর বড় রাখা হয়েছে — ইনপুট ৪০px, ফলাফল ২৮px */}
          <div className="mt-1 text-right" data-display>
            <div className="flex min-h-[40px] items-center justify-end gap-1" data-display-input>
              <span className="truncate text-[40px] font-normal leading-none">{v === '' ? '০' : toBn(v)}</span>
              <span className="shrink-0 text-[17px] font-normal text-neutral-400">{u.t}</span>
              <span className="ml-1 inline-block h-[30px] w-[3px] shrink-0 animate-pulse bg-[#1e9bd8]" />
            </div>
            <button
              type="button"
              onClick={copyResult}
              data-display-result
              className="block w-full truncate text-right text-[28px] font-normal leading-none text-amber-200"
              aria-label="ফলাফল কপি করুন"
            >
              {result.value === '' ? '—' : result.value}
            </button>
          </div>

          {/* থেকে/কিসে মাঝারি চিপ (শুধু দৈর্ঘ্য — ধরন বাদ) */}
          <div className="mt-1 rounded-3xl border border-[#2a2a2a] bg-[#141414] p-1">
            <div className="flex items-center gap-1.5">
              <span className="w-[38px] shrink-0 text-[13px] font-medium text-neutral-400">থেকে</span>
              <div className="relative min-w-0 flex-1">
                <div data-row="from" className="flex gap-1.5">
                  {LEN_UNITS.map((x) => (
                    <button key={x.k} onClick={() => pickFrom(x.k)} className={chip(x.k === from)} aria-pressed={x.k === from}>
                      {x.t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="my-0.5 h-px bg-[#2a2a2a]" />
            <div className="flex items-center gap-1.5">
              <span className="w-[38px] shrink-0 text-[13px] font-medium text-neutral-400">কিসে</span>
              <div className="relative min-w-0 flex-1">
                <div data-row="to" className="flex gap-1.5">
                  {toList.map((x) => (
                    <button
                      key={x.k}
                      onClick={() => {
                        buzz();
                        setTo(x.k);
                      }}
                      className={chip(x.k === to)}
                      aria-pressed={x.k === to}
                    >
                      {x.t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* দ্রুত টেবিল + বিজোড় সাজেশন (৫/১৫/২৫/৩৫) */}
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                buzz();
                setSheet('quick');
              }}
              className="flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border border-[#3d3d3d] bg-[#1f1f1f] px-3 text-[13px] font-medium text-[#e5e5e5] transition-transform active:scale-95"
            >
              <Table2 className="h-4 w-4" />
              দ্রুত টেবিল
            </button>
            {SUGGESTIONS.map((n) => (
              <button
                key={n}
                type="button"
                data-suggest={n}
                onClick={() => pickSuggest(n)}
                className="flex min-h-[32px] flex-1 items-center justify-center rounded-full border border-[#3d3d3d] bg-[#1f1f1f] text-[16px] font-medium text-amber-200 transition-transform active:scale-95"
              >
                {toBn(n)}
              </button>
            ))}
          </div>

          {/* কিপ্যাড — গোল, বড় সংখ্যা */}
          <div className="mt-1 grid w-full grid-cols-4 gap-2">
            {LINK_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                data-key={k}
                aria-label={
                  k === 'del' ? 'একটা মুছুন' : k === 'AC' ? 'সব মুছুন' : k === 'swap' ? 'অদলবদল' : k === 'eq' ? 'সমান (কপি)' : k
                }
                onClick={() => press(k)}
                className={keyClass(k, 'link')}
              >
                {k === 'del' ? (
                  <Delete className="h-6 w-6" />
                ) : k === 'swap' ? (
                  <ArrowLeftRight className="h-6 w-6" />
                ) : k === 'eq' ? (
                  '='
                ) : (
                  toBn(k)
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* সাধারণ ক্যালকুলেটর ডিসপ্লে */}
          <div className="mt-2 min-h-[100px] text-right" data-normal-display-wrap>
            <div className="flex min-h-[24px] items-center justify-end text-[16px] font-normal text-neutral-400" data-normal-expr>
              {nExpr || ' '}
            </div>
            <div className="mt-1 truncate text-[40px] font-normal leading-tight" data-normal-display>
              {toBn(nDisplay)}
            </div>
          </div>

          {/* সাধারণ ক্যালকুলেটর কিপ্যাড — স্ক্রিনশটের মতো */}
          <div className="mt-1 grid w-full grid-cols-4 gap-2">
            {NORMAL_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                data-key={k}
                aria-label={k === '⌫' ? 'একটা মুছুন' : k === 'AC' ? 'সব মুছুন' : k}
                onClick={() => nPress(k)}
                className={keyClass(k, 'normal')}
              >
                {k === '⌫' ? <Delete className="h-6 w-6" /> : toBn(k)}
              </button>
            ))}
          </div>
        </>
      )}

      {/* দ্রুত টেবিল শিট (ডার্ক) */}
      {sheet === 'quick' && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-label="দ্রুত টেবিল"
            className="max-h-[84dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#111111] px-4 pb-6 pt-2.5 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2.5 h-[5px] w-11 rounded bg-[#3d3d3d]" />
            <div className="mb-1 flex items-center gap-2">
              <b className="flex-1 text-lg font-medium">দ্রুত টেবিল: লিংক → ফুট-ইঞ্চি</b>
              <button
                type="button"
                aria-label="বন্ধ করুন"
                onClick={() => setSheet(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2b2b2b] text-white"
              >
                <X className="h-[22px] w-[22px]" />
              </button>
            </div>
            <p className="mb-2 text-sm font-medium text-neutral-400">যেকোনো সারিতে চাপলে ওপরের ডিসপ্লেতে বসে যাবে</p>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_LEN.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    buzz();
                    setFrom('link');
                    setV(String(n));
                    if (to === 'link') setTo('ftin');
                    pushHist('link', String(n));
                    setSheet(null);
                  }}
                  className="flex min-h-[52px] items-center justify-between rounded-2xl bg-[#1f1f1f] px-3 text-[15px] font-medium active:bg-[#2b2b2b]"
                >
                  <span>
                    {toBn(n)} {qUnit}
                  </span>
                  <b className="font-medium text-emerald-300">{ftIn(n * 0.66).short}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ইতিহাস শিট — ঘড়ি আইকন থেকে খোলে */}
      {sheet === 'history' && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-label="ইতিহাস"
            className="max-h-[84dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#111111] px-4 pb-6 pt-2.5 text-white"
            onClick={(e) => e.stopPropagation()}
            data-history-sheet
          >
            <div className="mx-auto mb-2.5 h-[5px] w-11 rounded bg-[#3d3d3d]" />
            <div className="mb-3 flex items-center justify-between">
              <b className="text-lg font-medium">ইতিহাস</b>
              <button
                type="button"
                aria-label="বন্ধ করুন"
                onClick={() => setSheet(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2b2b2b] text-white"
              >
                <X className="h-[22px] w-[22px]" />
              </button>
            </div>
            {hist.length === 0 ? (
              <p className="py-6 text-center text-[15px] text-neutral-400">এখনো কোনো হিসাব নেই</p>
            ) : (
              <div className="space-y-1.5">
                {hist.map((h, i) => {
                  const t = histText(h);
                  return (
                    <button
                      key={h.join() + i}
                      type="button"
                      data-history-row
                      onClick={() => {
                        buzz();
                        setFrom(h[1]);
                        setV(h[2]);
                        setTo('ftin');
                        setMode('link');
                        setSheet(null);
                      }}
                      className="flex w-full items-center justify-between rounded-2xl bg-[#1f1f1f] px-3 py-2.5 text-left"
                    >
                      <span className="text-[15px] font-medium">
                        {t.a} <b className="font-medium text-emerald-300">{t.b}</b>
                      </span>
                      <span className="text-[13px] text-neutral-400">আবার</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ছোট বার্তা */}
      <div
        role="status"
        className={`fixed bottom-28 left-1/2 z-[57] max-w-[88vw] -translate-x-1/2 rounded-2xl bg-[#2b2b2b] px-4 py-2.5 text-center text-[15px] font-medium text-white transition-all ${
          toast ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        {toast}
      </div>
    </div>
  );
};
