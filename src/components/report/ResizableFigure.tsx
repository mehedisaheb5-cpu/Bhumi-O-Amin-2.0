import React, { useEffect, useRef, useState } from 'react';

/**
 * রিপোর্টের অংকিত চিত্র — শুধু দেখার আকার ও অবস্থান বদলায়।
 * বাহুর মাপ, আকৃতি বা ক্ষেত্রফল কিছুই বদলায় না (পুরো চিত্র একসাথে সমান অনুপাতে ছোট-বড় হয়)।
 *  - চিত্রের যেকোনো কোনা ধরে বাইরে টানলে বড়, ভেতরে ঠেললে ছোট (কোনো আলাদা ফ্রেম নেই)
 *  - চিত্রের ভেতরে ধরে টানলে সরে যায়; দুই আঙুলে চিমটি দিলেও ছোট-বড়
 *  - টানার সময় শুধু CSS transform বদলায় (মসৃণ), আঙুল তুললে সেভ হয়
 *  - প্রিন্ট/PDF-এ কোনার বিন্দু বা নির্দেশনা দেখা যায় না
 */
export interface FigureXform { dx: number; dy: number; s: number }
export const DEFAULT_XFORM: FigureXform = { dx: 0, dy: 0, s: 1 };

const MIN_S = 0.25;
const MAX_S = 4;
const BASE_FIT = 0.86;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function sanitizeXform(v: any): FigureXform {
  if (!v || typeof v !== 'object') return DEFAULT_XFORM;
  const n = (x: any, d: number) => (typeof x === 'number' && isFinite(x) ? x : d);
  return { dx: clamp(n(v.dx, 0), -0.5, 0.5), dy: clamp(n(v.dy, 0), -0.5, 0.5), s: clamp(n(v.s, 1), MIN_S, MAX_S) };
}

/**
 * চিত্রের আকার/অবস্থান আলাদা করে রাখা হয় — রিপোর্ট আইডি ও সার্ভে আইডি দুটো দিয়েই,
 * যাতে খসড়া রিপোর্ট আবার খুললেও (নতুন আইডি হলেও) আগের মতো থাকে।
 */
const FIG_KEY = 'fa_report_figure_v1';
function readFigMap(): Record<string, FigureXform> {
  try { const m = JSON.parse(localStorage.getItem(FIG_KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; }
}
export function loadFigureXform(reportId?: string, surveyId?: string): FigureXform {
  const m = readFigMap();
  const v = (reportId && m['rep:' + reportId]) || (surveyId && m['srv:' + surveyId]);
  return v ? sanitizeXform(v) : DEFAULT_XFORM;
}
export function saveFigureXform(reportId: string | undefined, surveyId: string | undefined, v: FigureXform) {
  try {
    const m = readFigMap();
    if (reportId) m['rep:' + reportId] = v;
    if (surveyId) m['srv:' + surveyId] = v;
    localStorage.setItem(FIG_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}
export function clearFigureXform(reportId?: string, surveyId?: string) {
  try {
    const m = readFigMap();
    if (reportId) delete m['rep:' + reportId];
    if (surveyId) delete m['srv:' + surveyId];
    localStorage.setItem(FIG_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}

interface Props {
  /** চিত্রের প্রস্থ ÷ উচ্চতা */
  aspect: number;
  /** চিত্রের কোনাগুলো, চিত্রের বাক্সের ভগ্নাংশে (০–১) */
  corners: { x: number; y: number }[];
  value: FigureXform;
  onChange: (v: FigureXform) => void;
  /** রিপোর্টে প্রয়োগ করা zoom — কোনার ছোঁয়ার জায়গা যেন ফোনে আঙুলের মাপে থাকে */
  uiScale: number;
  children: React.ReactNode;
}

type Gesture =
  | { mode: 'move'; px: number; py: number }
  | { mode: 'corner'; d0: number }
  | { mode: 'pinch'; dist: number; mx: number; my: number; ox: number; oy: number; k0: number };

export const ResizableFigure: React.FC<Props> = ({ aspect, corners, value, onChange, uiScale, children }) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  // নির্দেশনা কয়েক সেকেন্ড দেখিয়ে লুকাই — বাহুর মাপের লেখা যেন ঢাকা না পড়ে
  const [hint, setHint] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 5000); return () => window.clearTimeout(t); }, []);
  useEffect(() => { if (busy) setHint(false); }, [busy]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  /** চলমান অঙ্গভঙ্গির অস্থায়ী অবস্থা: সরানো (tx,ty) ও গুণ (k) — বক্সের নিজের মাপে */
  const live = useRef({ tx: 0, ty: 0, k: 1 });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = size.w, H = size.h;
  const a = aspect > 0 && isFinite(aspect) ? aspect : 1;
  let bw = W, bh = H;
  if (W > 0 && H > 0) {
    const FW = W * BASE_FIT, FH = H * BASE_FIT;
    if (a > FW / FH) { bw = FW; bh = FW / a; } else { bh = FH; bw = FH * a; }
  }
  const w = bw * value.s, h = bh * value.s;
  const cx = W / 2 + value.dx * W, cy = H / 2 + value.dy * H;
  const ready = W > 0 && H > 0;

  /** পয়েন্টার → লেয়ারের নিজস্ব px (রিপোর্টের zoom বাদ দিয়ে) */
  const toLocal = (e: { clientX: number; clientY: number }) => {
    const el = layerRef.current!;
    const r = el.getBoundingClientRect();
    const ratio = el.offsetWidth ? r.width / el.offsetWidth : 1;
    return { x: (e.clientX - r.left) / ratio, y: (e.clientY - r.top) / ratio };
  };

  const paint = () => {
    raf.current = null;
    const b = boxRef.current;
    if (!b) return;
    const { tx, ty, k } = live.current;
    b.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
  };
  const schedule = () => { if (raf.current == null) raf.current = requestAnimationFrame(paint); };

  /** চলমান অবস্থা মান হিসেবে সেভ করে transform মুছি */
  const commit = () => {
    const { tx, ty, k } = live.current;
    live.current = { tx: 0, ty: 0, k: 1 };
    if (raf.current != null) { cancelAnimationFrame(raf.current); raf.current = null; }
    if (boxRef.current) boxRef.current.style.transform = '';
    if (!W || !H || (tx === 0 && ty === 0 && k === 1)) return;
    const s = clamp(value.s * k, MIN_S, MAX_S);
    onChange({ dx: clamp((cx + tx - W / 2) / W, -0.5, 0.5), dy: clamp((cy + ty - H / 2) / H, -0.5, 0.5), s });
  };

  const kLimit = (k: number) => clamp(value.s * k, MIN_S, MAX_S) / value.s;

  const begin = () => {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [p, q] = pts;
      const { tx, ty, k } = live.current;
      gesture.current = { mode: 'pinch', dist: Math.hypot(p.x - q.x, p.y - q.y) || 1, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, ox: tx, oy: ty, k0: k };
    } else if (pts.length === 1 && gesture.current?.mode !== 'corner') {
      const { tx, ty } = live.current;
      gesture.current = { mode: 'move', px: pts[0].x - tx, py: pts[0].y - ty };
    }
  };

  const onBoxDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try { boxRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pointers.current.set(e.pointerId, toLocal(e));
    setBusy(true);
    begin();
  };

  const onCornerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { boxRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = toLocal(e);
    pointers.current.set(e.pointerId, p);
    setBusy(true);
    if (pointers.current.size >= 2) { begin(); return; }
    gesture.current = { mode: 'corner', d0: Math.max(8, Math.hypot(p.x - cx, p.y - cy)) };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toLocal(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'corner') {
      // কেন্দ্র থেকে আঙুলের দূরত্বের অনুপাতে পুরো চিত্র ছোট-বড়
      live.current.k = kLimit(Math.hypot(p.x - cx, p.y - cy) / g.d0);
    } else if (g.mode === 'move') {
      live.current.tx = p.x - g.px;
      live.current.ty = p.y - g.py;
    } else {
      const [q1, q2] = [...pointers.current.values()];
      if (!q2) return;
      const dist = Math.hypot(q1.x - q2.x, q1.y - q2.y);
      live.current.k = kLimit(g.k0 * (dist / g.dist));
      live.current.tx = g.ox + ((q1.x + q2.x) / 2 - g.mx);
      live.current.ty = g.oy + ((q1.y + q2.y) / 2 - g.my);
    }
    schedule();
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setBusy(false);
      commit();
    } else {
      gesture.current = null;
      begin();
    }
  };

  const k = 1 / (uiScale > 0 ? uiScale : 1); // স্ক্রিনের px → রিপোর্টের px
  const hit = 44 * k; // কোনার ছোঁয়ার জায়গা (~৪৪px স্ক্রিনে)
  const dot = 12 * k;
  const moved = value.s !== 1 || value.dx !== 0 || value.dy !== 0;

  return (
    <div ref={layerRef} style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={boxRef}
        id="report-figure"
        onPointerDown={onBoxDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'absolute',
          left: ready ? cx - w / 2 : 0, top: ready ? cy - h / 2 : 0,
          width: ready ? w : '100%', height: ready ? h : '100%',
          transformOrigin: 'center center',
          willChange: busy ? 'transform' : undefined,
          touchAction: 'none',
          userSelect: 'none', WebkitUserSelect: 'none',
          cursor: busy ? 'grabbing' : 'grab',
        }}
      >
        {children}
        {ready && corners.map((c, i) => (
          <div
            key={i}
            className="fa-noprint"
            data-corner={i}
            onPointerDown={onCornerDown}
            style={{
              position: 'absolute', width: hit, height: hit,
              left: `${c.x * 100}%`, top: `${c.y * 100}%`,
              transform: "translate(-50%,-50%)",
              touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'nwse-resize', zIndex: 3, borderRadius: '50%',
            }}
          >
            <span style={{ width: dot, height: dot, borderRadius: '50%', background: 'rgba(6,95,70,0.55)', border: `${2 * k}px solid white`, display: 'block' }} />
          </div>
        ))}
      </div>

      <div className="fa-noprint" style={{ position: 'absolute', top: 6 * k, left: 6 * k, zIndex: 5, display: 'flex', gap: 6 * k, alignItems: 'center', pointerEvents: 'none' }}>
        {!moved && hint && (
          <span style={{ background: 'rgba(236,253,245,0.95)', color: '#065f46', border: `${1 * k}px solid #065f46`, borderRadius: 10 * k, padding: `${3 * k}px ${7 * k}px`, fontSize: 11 * k, fontWeight: 700, whiteSpace: 'nowrap' }}>
            কোনা টেনে ছোট-বড় · ভেতরে ধরে সরান
          </span>
        )}
        {moved && (
          <button
            type="button"
            id="report-figure-reset"
            onClick={() => onChange(DEFAULT_XFORM)}
            style={{ pointerEvents: 'auto', minHeight: 34 * k, padding: `0 ${10 * k}px`, borderRadius: 10 * k, border: `${1.5 * k}px solid #065f46`, background: 'white', color: '#065f46', fontWeight: 800, fontSize: 13 * k, whiteSpace: 'nowrap', fontFamily: 'Noto Sans Bengali, sans-serif', cursor: 'pointer' }}
          >
            শুরুর মাপে
          </button>
        )}
      </div>
    </div>
  );
};
