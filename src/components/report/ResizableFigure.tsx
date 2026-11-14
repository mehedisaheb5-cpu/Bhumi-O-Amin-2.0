import React, { useEffect, useRef, useState } from 'react';

/**
 * রিপোর্টের অংকিত চিত্র — শুধু দেখার আকার ও অবস্থান বদলায়।
 * বাহুর মাপ, আকৃতি বা ক্ষেত্রফল কিছুই বদলায় না (পুরো চিত্র একসাথে সমান অনুপাতে ছোট-বড় হয়)।
 *  - চিত্রে ট্যাপ → নির্বাচন (চার কোনায় হ্যান্ডেল)
 *  - কোনা টানলে/ঠেললে ছোট-বড়, মাঝখান ধরে টানলে সরে, দুই আঙুলে চিমটি দিলেও ছোট-বড়
 *  - প্রিন্ট/PDF-এ হ্যান্ডেল বা দাগ দেখা যায় না
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
  value: FigureXform;
  onChange: (v: FigureXform) => void;
  /** রিপোর্টে প্রয়োগ করা zoom — হ্যান্ডেল যেন ফোনে আঙুলের মাপে থাকে */
  uiScale: number;
  children: React.ReactNode;
}

type Gesture =
  | { mode: 'move'; px: number; py: number; v: FigureXform }
  | { mode: 'resize'; ox: number; oy: number; sx: number; sy: number }
  | { mode: 'pinch'; dist: number; mx: number; my: number; v: FigureXform };

export const ResizableFigure: React.FC<Props> = ({ aspect, value, onChange, uiScale, children }) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

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

  // বাইরে ট্যাপ করলে নির্বাচন বন্ধ
  useEffect(() => {
    if (!selected) return;
    const h = (e: PointerEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || barRef.current?.contains(t)) return;
      setSelected(false);
    };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [selected]);

  const W = size.w, H = size.h;
  const a = aspect > 0 && isFinite(aspect) ? aspect : 1;
  let bw = W, bh = H;
  if (W > 0 && H > 0) {
    // স্বাভাবিক আকার: ফ্রেমের ৮৬% — কোনার হ্যান্ডেল ও লেজেন্ডের জন্য ফাঁকা জায়গা থাকে
    const FW = W * BASE_FIT, FH = H * BASE_FIT;
    if (a > FW / FH) { bw = FW; bh = FW / a; } else { bh = FH; bw = FH * a; }
  }
  const geom = (v: FigureXform) => {
    const w = bw * v.s, h = bh * v.s;
    const cx = W / 2 + v.dx * W, cy = H / 2 + v.dy * H;
    return { w, h, cx, cy, left: cx - w / 2, top: cy - h / 2 };
  };
  const g = geom(value);

  const toLocal = (e: React.PointerEvent) => {
    const el = layerRef.current!;
    const r = el.getBoundingClientRect();
    const ratio = el.offsetWidth ? r.width / el.offsetWidth : 1;
    return { x: (e.clientX - r.left) / ratio, y: (e.clientY - r.top) / ratio };
  };

  const emit = (cx: number, cy: number, s: number) => {
    if (!W || !H) return;
    onChange({ dx: clamp((cx - W / 2) / W, -0.5, 0.5), dy: clamp((cy - H / 2) / H, -0.5, 0.5), s: clamp(s, MIN_S, MAX_S) });
  };

  const startMoveOrPinch = () => {
    const pts = [...pointers.current.values()];
    const v = valueRef.current;
    if (pts.length >= 2) {
      const [p, q] = pts;
      gesture.current = { mode: 'pinch', dist: Math.hypot(p.x - q.x, p.y - q.y) || 1, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, v };
    } else if (pts.length === 1) {
      gesture.current = { mode: 'move', px: pts[0].x, py: pts[0].y, v };
    } else gesture.current = null;
  };

  const onBoxDown = (e: React.PointerEvent) => {
    if (!selected) return; // প্রথম ট্যাপ শুধু নির্বাচন করে (onClick), পেজ স্ক্রল স্বাভাবিক থাকে
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pointers.current.set(e.pointerId, toLocal(e));
    startMoveOrPinch();
  };

  const onHandleDown = (corner: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const cur = geom(valueRef.current);
    const sx = corner === 1 || corner === 2 ? 1 : -1; // ডান কোনা
    const sy = corner === 2 || corner === 3 ? 1 : -1; // নিচের কোনা
    pointers.current.clear();
    gesture.current = { mode: 'resize', ox: cur.cx - (sx * cur.w) / 2, oy: cur.cy - (sy * cur.h) / 2, sx, sy };
  };

  const onMove = (e: React.PointerEvent) => {
    const gs = gesture.current;
    if (!gs) return;
    const p = toLocal(e);
    if (gs.mode === 'resize') {
      const vx = Math.max(0, (p.x - gs.ox) * gs.sx);
      const vy = Math.max(0, (p.y - gs.oy) * gs.sy);
      const s = clamp((vx * bw + vy * bh) / (bw * bw + bh * bh || 1), MIN_S, MAX_S);
      emit(gs.ox + (gs.sx * bw * s) / 2, gs.oy + (gs.sy * bh * s) / 2, s);
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, p);
    const s0 = geom(gs.v);
    if (gs.mode === 'move') {
      emit(s0.cx + (p.x - gs.px), s0.cy + (p.y - gs.py), gs.v.s);
    } else {
      const [q1, q2] = [...pointers.current.values()];
      if (!q2) return;
      const dist = Math.hypot(q1.x - q2.x, q1.y - q2.y);
      const mx = (q1.x + q2.x) / 2, my = (q1.y + q2.y) / 2;
      emit(s0.cx + (mx - gs.mx), s0.cy + (my - gs.my), gs.v.s * (dist / gs.dist));
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (gesture.current?.mode === 'resize') { gesture.current = null; return; }
    pointers.current.delete(e.pointerId);
    startMoveOrPinch();
  };

  const nudgeScale = (f: number) => {
    const v = valueRef.current;
    const cur = geom(v);
    emit(cur.cx, cur.cy, v.s * f);
  };

  const k = 1 / (uiScale > 0 ? uiScale : 1); // স্ক্রিনের px → রিপোর্টের px
  const hs = 34 * k; // হ্যান্ডেলের ছোঁয়ার জায়গা (~৩৪px স্ক্রিনে)
  const dot = 16 * k;
  const ready = W > 0 && H > 0;
  const btn: React.CSSProperties = {
    minWidth: 38 * k, height: 38 * k, padding: `0 ${9 * k}px`, whiteSpace: 'nowrap', borderRadius: 10 * k, border: `${1.5 * k}px solid #065f46`,
    background: 'white', color: '#065f46', fontWeight: 800, fontSize: 15 * k, cursor: 'pointer', lineHeight: 1,
    fontFamily: 'Noto Sans Bengali, sans-serif',
  };

  return (
    <div ref={layerRef} style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={boxRef}
        id="report-figure"
        data-selected={selected ? '1' : '0'}
        onClick={() => { if (!selected) setSelected(true); }}
        onPointerDown={onBoxDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'absolute',
          left: ready ? g.left : 0, top: ready ? g.top : 0,
          width: ready ? g.w : '100%', height: ready ? g.h : '100%',
          touchAction: selected ? 'none' : 'auto',
          userSelect: 'none', WebkitUserSelect: 'none',
          cursor: selected ? 'move' : 'pointer',
        }}
      >
        {children}
        {selected && (
          <>
            <div className="fa-noprint" style={{ position: 'absolute', inset: 0, border: `${2 * k}px dashed #065f46`, background: 'rgba(6,95,70,0.04)', pointerEvents: 'none' }} />
            {[0, 1, 2, 3].map((c) => (
              <div
                key={c}
                className="fa-noprint"
                data-corner={c}
                onPointerDown={onHandleDown(c)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                style={{
                  position: 'absolute', width: hs, height: hs,
                  left: (c === 1 || c === 2 ? '100%' : 0) as any, top: (c === 2 || c === 3 ? '100%' : 0) as any,
                  transform: 'translate(-50%,-50%)', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: c === 0 || c === 2 ? 'nwse-resize' : 'nesw-resize', zIndex: 3,
                }}
              >
                <span style={{ width: dot, height: dot, borderRadius: '50%', background: '#065f46', border: `${2.5 * k}px solid white`, boxShadow: `0 0 0 ${1 * k}px #065f46`, display: 'block' }} />
              </div>
            ))}
          </>
        )}
      </div>

      {selected ? (
        <div ref={barRef} className="fa-noprint" id="report-figure-bar"
          style={{ position: 'absolute', top: 6 * k, left: 6 * k, zIndex: 5, display: 'flex', gap: 6 * k, alignItems: 'center', background: '#ecfdf5', border: `${1.5 * k}px solid #065f46`, borderRadius: 12 * k, padding: 5 * k, boxShadow: `0 ${2 * k}px ${8 * k}px rgba(0,0,0,0.15)` }}>
          <button type="button" style={btn} onClick={() => nudgeScale(1 / 1.1)} aria-label="ছোট">−</button>
          <button type="button" style={btn} onClick={() => nudgeScale(1.1)} aria-label="বড়">+</button>
          <button type="button" style={btn} onClick={() => onChange(DEFAULT_XFORM)}>শুরুর মাপে</button>
          <button type="button" style={{ ...btn, background: '#065f46', color: 'white' }} onClick={() => setSelected(false)}>✓ ঠিক আছে</button>
        </div>
      ) : (
        <div className="fa-noprint" style={{ position: 'absolute', top: 6 * k, left: 6 * k, zIndex: 5, pointerEvents: 'none', background: 'rgba(236,253,245,0.95)', color: '#065f46', border: `${1 * k}px solid #065f46`, borderRadius: 10 * k, padding: `${4 * k}px ${8 * k}px`, fontSize: 13 * k, fontWeight: 700 }}>
          চিত্রে ট্যাপ করুন: ছোট-বড় / সরান
        </div>
      )}
    </div>
  );
};
