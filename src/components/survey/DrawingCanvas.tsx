import React, { useState, useRef, useEffect, useMemo, PointerEvent } from 'react';
import { DrawingSegment, Language, PlotMeta } from '../../types';
import { findPlotRings, layoutSideLabels, LabelItem } from '../../lib/plotRings';
import notoBengaliFontUrl from '../../assets/fonts/NotoSansBengali-Bengali.woff2?url';
import notoLatinFontUrl from '../../assets/fonts/NotoSansBengali-Latin.woff2?url';

/* ---------- fixed canvas ---------- */
const W = 400;            // logical width; height is derived from the real box so 1 unit is square
// ম্যাগনেটিক স্ন্যাপের সহনশীলতা (২৪ নভেম্বর Founder: কাছাকাছি গেলে মিলতে কষ্ট হতো,
// আটকে যেত — তাই কোনা/কিনারার ধরা-ছোঁয়ার জায়গা বড় করা হলো)
const CORNER_PX = 30;     // screen px: exact corner-to-corner join (was 20)
const EDGE_PX = 18;       // screen px: landing on the body of an existing line (was 12)
const HIT_PX = 18;        // screen px around a line that counts as "tapped the line" (was 30: it stole presses inside a plot)
const END_PX = 22;        // screen px around an endpoint handle (was 16)
const HANDLE_R = 6;       // endpoint dot radius (canvas units) — small so it hides nothing
const MIN_LEN_PX = 16;    // shorter than this is a tap, not a new line
const MIN_MOVE = 9;       // screen px before a press becomes a drag
const ANGLE_STEP = 45;
const ANGLE_TOL = 10;
// নিচে টেনে মোছা (২৫ নভেম্বর Founder: কনফার্ম উইন্ডো বন্ধ করো — দাগ নিচে
// টানলে চুম্বকের মতো মুছার পটিতে বসে মুছে যাবে)
const DELETE_STRIP_H = 56;  // screen px: মুছার পটির উচ্চতা
const DELETE_SNAP_PX = 40;  // screen px: পটির ওপরে এই দূরত্বে গেলেই চুম্বক লাগে

const STORAGE_KEY = 'bhumi_possession_drawing_v1';

const COLORS = ['#065f46', '#b45309', '#1d4ed8', '#7e22ce', '#be123c', '#0f766e', '#4d7c0f', '#334155'];

type Menu = { kind: 'len'; id: string } | { kind: 'label'; id: string } | { kind: 'plot'; id: string } | null;
type Plot = { id: string; pts: { x:number; y:number }[]; sidesFt:(number|undefined)[]; cx:number; cy:number; color:string };
type Seg = DrawingSegment & { color?: string; dashed?: boolean };

/**
 * প্রিভিউ ২০, ঠিক ২ — বন্টন: নতুন দাগের প্রান্ত কোনো পুরনো দাগের গায়ে পড়লে
 * সেই পুরনো দাগটা জোড়ার জায়গায় দুই টুকরোয় ভাগ হয়, যাতে প্রত্যেক টুকরোয়
 * আলাদা করে মান বসানো যায় আর দুটো প্লটের রিং আলাদা হয়।
 * পুরনো দাগের মান থাকলে তা জ্যামিতির অনুপাতে দুই টুকরোয় ভাগ হয়।
 */
export const splitSegsAt = (segs: Seg[], x: number, y: number, skipIds: Set<string>): Seg[] => {
  const out: Seg[] = [];
  let n = 0;
  for (const s of segs) {
    if (skipIds.has(s.id)) { out.push(s); continue; }
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) { out.push(s); continue; }
    const t = ((x - s.x1) * dx + (y - s.y1) * dy) / l2;
    if (t <= 0.05 || t >= 0.95) { out.push(s); continue; }
    const px = s.x1 + t * dx, py = s.y1 + t * dy;
    if (Math.hypot(x - px, y - py) > 2.5) { out.push(s); continue; }
    const d1 = Math.hypot(px - s.x1, py - s.y1), d2 = Math.hypot(s.x2 - px, s.y2 - py);
    const total = d1 + d2;
    let l1 = s.lengthFt, l2ft = s.lengthFt;
    if (s.lengthFt !== undefined && total > 0) {
      l1 = Math.round(((s.lengthFt * d1) / total) * 1000) / 1000;
      l2ft = Math.round((s.lengthFt - l1) * 1000) / 1000;
    }
    const base = `seg-${Date.now()}-${n++}`;
    out.push({ ...s, id: `${base}a`, x2: px, y2: py, lengthFt: l1 });
    out.push({ ...s, id: `${base}b`, x1: px, y1: py, lengthFt: l2ft });
  }
  return out;
};

const ftIn = (ft?: number): string => {
  if (ft === undefined || ft === null || !isFinite(ft)) return '';
  const total = Math.round(Math.abs(ft) * 12);
  const f = Math.floor(total / 12);
  const i = total % 12;
  return `${f}′ ${i}″`;
};
const toFeet = (f: string, i: string): number | undefined => {
  const ff = parseFloat(f || '0');
  const ii = parseFloat(i || '0');
  if (!isFinite(ff) && !isFinite(ii)) return undefined;
  const v = (isFinite(ff) ? ff : 0) + (isFinite(ii) ? ii : 0) / 12;
  return Math.max(0, Math.round(v * 1000) / 1000);
};

export const DrawingCanvas: React.FC<{ lang?: Language; printRef?: { current: (() => void) | null } }> = ({ lang, printRef }) => {
  const [segments, setSegments] = useState<Seg[]>([]);
  const [restored, setRestored] = useState(false);
  const [redoStack, setRedoStack] = useState<Seg[]>([]);
  /** মুছে ফেলা দাগ — ↶ ফেরান চাপলে এখান থেকে ফিরে আসে (কনফার্ম উইন্ডোর
      বদলে এটাই সুরক্ষা: ভুলে মুছলে ফেরানেই ফেরত পাওয়া যায়) */
  const [deletedStack, setDeletedStack] = useState<Seg[]>([]);
  /** নিচে টেনে মোছার পটি — দাগ নিচের দিকে টানলেই দেখা যায় */
  const [deleteZone, setDeleteZone] = useState<{ active: boolean; hot: boolean }>({ active: false, hot: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number; snapped: boolean } | null>(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 6, y: 6 });
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lenInput, setLenInput] = useState({ f: '', i: '' });
  const [labelInput, setLabelInput] = useState('');
  const [labelColor, setLabelColor] = useState<string>('#065f46');
  const [activeColor, setActiveColor] = useState('#065f46');   // the colour used for new lines / text / plot fill
  const [hint, setHint] = useState<string | null>(null);
  const [tapDot, setTapDot] = useState<{ x: number; y: number; id: number } | null>(null);
  const [plotMetas, setPlotMetas] = useState<PlotMeta[]>([]);
  const [plotInput, setPlotInput] = useState('');
  const [dagInput, setDagInput] = useState('');
  /** প্রিভিউ ২০, ঠিক ৪ — বিভাজক দাগের টুল: 'solid' সোজা, 'dotted' ডটেড; null = সাধারণ আঁকা */
  const [dividerTool, setDividerTool] = useState<'solid' | 'dotted' | null>(null);
  /** প্রিভিউ ২০, ঠিক ৪ — রঙের প্যালেট বন্ধ থাকে; রঙের আইকনে ট্যাপ করলে খোলে */
  const [colorsOpen, setColorsOpen] = useState(false);
  const cardDrag = useRef<{ id:string; sx:number; sy:number; ox:number; oy:number; moved:boolean }|null>(null);
  const resizeDrag = useRef<{ id:string; sx:number; sy:number; sw:number; sh:number }|null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const feetRef = useRef<HTMLInputElement>(null);
  const lastSnapRef = useRef(false);
  /** মুছার পটি গরম কি না (ছাড়লে মুছবে) — handleUp-এ তাজা মান লাগে */
  const deleteHotRef = useRef(false);
  /** পটিতে ঢোকার সময় একবার ভাইব্রেট — বারবার নয় */
  const deleteSnapRef = useRef(false);
  /** লক দাগ নিচে টানার হিন্ট এক টানে একবারই — প্রতি move-এ টাইমার রিসেট নয় */
  const lockHintShownRef = useRef(false);
  /** লক কোনা টানার সময় কোনাটা এখন কোথায় — চুম্বক যেন কোনাকে তার নিজের
      বর্তমান জায়গাতেই না টানে (জোড়ার দাগগুলো কোনার সাথে সাথে সরে, তাই
      বর্তমান জায়গাটাই সবচেয়ে কাছের লক্ষ্য হয়ে কোনাকে আটকে রাখত) */
  const cornerCurRef = useRef<{ x: number; y: number } | null>(null);
  /** deleteZone state-এর আয়না — প্রতি move-এ অকারণ রি-রেন্ডার ঠেকাতে */
  const deleteZoneRef = useRef({ active: false, hot: false });
  const toolbarDrag = useRef<{ dx: number; dy: number } | null>(null);
  const press = useRef<
    | { kind: 'none' }
    | { kind: 'create'; sx: number; sy: number; x1: number; y1: number }
    | { kind: 'moveSeg'; id: string; sx: number; sy: number; pts: [number, number, number, number]; moved: boolean }
    | { kind: 'endpoint'; id: string; end: 1 | 2 }
    | { kind: 'corner'; heads: { id: string; end: 1 | 2 }[]; sx: number; sy: number; ox: number; oy: number; moved: boolean }
    | { kind: 'plotMove'; plotId: string; sx: number; sy: number; orig: { id: string; x1: number; y1: number; x2: number; y2: number }[]; moved: boolean; lastDx?: number; lastDy?: number }
    | { kind: 'plotCorner'; plotId: string; corner: { x: number; y: number }; opp: { x: number; y: number }; sx: number; sy: number; orig: { id: string; x1: number; y1: number; x2: number; y2: number; len?: number }[]; origAll: { id: string; x1: number; y1: number; x2: number; y2: number; len?: number }[]; pts: { x: number; y: number }[]; moved: boolean }
  >({ kind: 'none' });
  /** প্রিভিউ ২০, ঠিক ৭ — হাতে আনলক করা প্লটের রিং id: অটো-লক যেন আবার লক না করে */
  const unlockedRef = useRef<Set<string>>(new Set());
  /** প্রিভিউ ২০, ঠিক ২ — বন্টনে হারিয়ে যাওয়া সম্পন্ন রিংয়ের নাম/দাগ বড় টুকরোয় দিতে আগের রিংগুলো */
  const prevRingsRef = useRef<{ id: string; segIds: string[]; area: number | null; meta: PlotMeta | undefined }[]>([]);
  const plotMetasRef = useRef<PlotMeta[]>(plotMetas);
  plotMetasRef.current = plotMetas;

  /** walks closed rings — one ring = one plot. Handles shared sides (adjacent plots).
      বাহু ভাগ হলে (বন্টন) রিংয়ে ৫–৬টা দাগ হয় — findPlotRings সেগুলো এক বাহুতে
      জোড়ে; নিচের প্লটের মতো বাহু টুকরো-টুকরো প্লটও ধরা পড়ে। Memoized for 60fps */
  const polygonsMemo = useMemo<Plot[]>(() => {
    const rings = findPlotRings(segments);
    if (rings.length) {
      return rings.map((r) => ({ id: r.id, pts: r.pts, sidesFt: r.sidesFt, cx: r.cx, cy: r.cy, color: r.color }));
    }
    // fallback: greedy walk for irregular plots when no quad found at all
    const key = (p:{x:number;y:number})=>`${Math.round(p.x)},${Math.round(p.y)}`;
    const out: Plot[]=[];
    const adj=new Map<string,Seg[]>();
    for(const sg of segments){ for(const pt of [{x:sg.x1,y:sg.y1},{x:sg.x2,y:sg.y2}]){ const k=key(pt); const a=adj.get(k)||[]; a.push(sg); adj.set(k,a);} }
    const seen2=new Set<string>();
    for(const start of segments){
      const pts:{x:number;y:number}[]=[{x:start.x1,y:start.y1}];
      const sides:(number|undefined)[]=[start.lengthFt];
      const segIds:string[]=[start.id];
      const startKey=key({x:start.x1,y:start.y1});
      let curKey=key({x:start.x2,y:start.y2});
      let prev:Seg=start;
      const usedInWalk=new Set<string>([start.id]);
      pts.push({x:start.x2,y:start.y2});
      let closed=false;
      for(let g=0; g<80; g++){
        if(curKey===startKey){ closed=true; break; }
        const nxt=(adj.get(curKey)||[]).find(sg=> sg!==prev && !usedInWalk.has(sg.id));
        if(!nxt) break;
        const a=key({x:nxt.x1,y:nxt.y1}), b=key({x:nxt.x2,y:nxt.y2});
        const to=a===curKey?b:a;
        const apt=a===curKey?{x:nxt.x2,y:nxt.y2}:{x:nxt.x1,y:nxt.y1};
        segIds.push(nxt.id); sides.push(nxt.lengthFt); usedInWalk.add(nxt.id); prev=nxt; curKey=to;
        if(curKey===startKey){ closed=true; break; }
        pts.push(apt);
      }
      if(!closed || pts.length<4) continue;
      const pid=segIds.slice().sort().join('|');
      if(seen2.has(pid)) continue;
      seen2.add(pid);
      const cx=pts.reduce((a,q)=>a+q.x,0)/pts.length;
      const cy=pts.reduce((a,q)=>a+q.y,0)/pts.length;
      out.push({ id:pid, pts, sidesFt:sides, cx, cy, color:start.color||'#065f46' });
    }
    return out;
  }, [segments]);
  const plotArea=(pl:Plot)=>{
    const sides=pl.sidesFt.filter((v):v is number=> typeof v==='number' && v>0);
    if(sides.length<4) return null;
    // Bangladeshi ami: গড় দৈর্ঘ্য × গড় প্রস্থ — opposite sides averaged
    let sqft:number;
    if(pl.sidesFt.length===4 && sides.length===4){
      const a=pl.sidesFt[0] as number, b=pl.sidesFt[1] as number, c=pl.sidesFt[2] as number, d=pl.sidesFt[3] as number;
      sqft = ((a+c)/2) * ((b+d)/2);
    } else {
      const avg=sides.reduce((a,b)=>a+b,0)/sides.length;
      sqft=avg*avg;
    }
    return { sqft, decimal: sqft/435.6, katha: sqft/720, complete: sides.length===pl.sidesFt.length };
  };
  const plotMeta=(id:string):PlotMeta=> plotMetas.find(m=>m.id===id) || {id};
  const boxSize=(m:PlotMeta, hasName:boolean, hasDag:boolean, hasArea:boolean)=>{
    const baseW=m.bw ?? 76, baseH=m.bh;
    if(baseH) return {w: Math.max(52, Math.min(130, baseW)), h: Math.max(20, Math.min(100, baseH))};
    // auto: small box, percentage always inside
    const nameLines = hasName ? (m.title && m.title.length>14 ? 2 : 1) : 0;
    let h=16;
    if(hasName) h+= nameLines*9;
    if(hasDag) h+= 9;
    if(hasArea) h+= 10;
    if(!hasName && !hasDag && !hasArea) h=16;
    else h+= 10; // padding top+bottom
    return {w: Math.max(52, Math.min(130, baseW)), h: Math.max(20, h)};
  };
  const pointInPolygon=(x:number,y:number, pts:{x:number;y:number}[])=>{
    let inside=false;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){
      const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
      const intersect= ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-9)+xi);
      if(intersect) inside=!inside;
    }
    return inside;
  };
  const hitPlotAt=(x:number,y:number)=>{
    for(const pl of polygonsMemo){
      if(pointInPolygon(x,y, pl.pts)) return pl;
    }
    return null;
  };
  const completedSegIds=()=>{ const st=new Set<string>(); for(const pl of polygonsMemo){ const m=plotMeta(pl.id); if(m.completed){ pl.id.split('|').forEach(a=> st.add(a)); } } return st; };
  const setPlotMeta=(id:string, patch:Partial<PlotMeta>)=>
    setPlotMetas(prev=>{ const i=prev.findIndex(m=>m.id===id); if(i<0) return [...prev,{id,...patch}]; const n=prev.slice(); n[i]={...n[i],...patch}; return n; });

  /* ---------------- autosave (localStorage) ---------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { segments?: Seg[]; plots?: PlotMeta[] };
        if (Array.isArray(data.segments) && data.segments.length) setSegments(data.segments);
        if (Array.isArray(data.plots)) setPlotMetas(data.plots);
      }
    } catch {
      /* corrupt payload -> start clean */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;                       // never overwrite storage before the first load finishes
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ segments, plots: plotMetas, updatedAt: Date.now() }));
    } catch {
      /* quota / private mode -> ignore */
    }
  }, [segments, plotMetas, restored]);

  /* ---------------- প্লট লক + বন্টনে নাম/দাগ (প্রিভিউ ২০, ঠিক ২ ও ৭) ----------------
     - ৪ বাহুর মান বসলে প্লট নিজে থেকে লক হয় (দাগ নম্বর না থাকলে পরের নম্বর বসে)।
     - হাতে আনলক করা প্লট আবার লক হয় না — 🔓 চাপলে আবার লক হয়।
     - বন্টনে সম্পন্ন প্লট ভাগ হলে তার নাম/দাগ/রঙ সবচেয়ে বড় টুকরোয় থাকে। */
  useEffect(() => {
    const metas = plotMetasRef.current;
    const rings = polygonsMemo.map((pl) => ({
      id: pl.id,
      segIds: pl.id.split('|'),
      area: plotArea(pl)?.sqft ?? null,
      meta: metas.find((m) => m.id === pl.id),
    }));
    const prev = prevRingsRef.current;
    const inherit: Record<string, Partial<PlotMeta>> = {};
    for (const old of prev) {
      if (!old.meta?.completed) continue;
      if (rings.some((r) => r.id === old.id)) continue; // রিংটা এখনো আছে
      const kids = rings.filter((r) => r.segIds.some((id) => old.segIds.includes(id)));
      if (!kids.length) continue;
      kids.sort((a, b) => (b.area ?? 0) - (a.area ?? 0));
      const big = kids[0];
      if (!big.meta?.dagNo && !big.meta?.title) {
        inherit[big.id] = { title: old.meta.title, dagNo: old.meta.dagNo, color: old.meta.color };
      }
    }
    const usedDag = new Set(metas.map((m) => m.dagNo).filter(Boolean));
    let nextDag = 1;
    const autoLock: Record<string, Partial<PlotMeta>> = {};
    for (const r of rings) {
      const pl = polygonsMemo.find((p) => p.id === r.id);
      if (!pl) continue;
      const valued = pl.sidesFt.filter((v): v is number => typeof v === 'number' && v > 0).length;
      if (valued < 4) continue;
      if (r.meta?.completed) continue;
      if (unlockedRef.current.has(r.id)) continue;
      let dag = inherit[r.id]?.dagNo || r.meta?.dagNo;
      if (!dag) {
        while (usedDag.has(String(nextDag))) nextDag++;
        dag = String(nextDag);
        usedDag.add(dag);
        nextDag++;
      }
      autoLock[r.id] = { completed: true, dagNo: dag };
    }
    let next = metas;
    if (Object.keys(inherit).length || Object.keys(autoLock).length) {
      const apply = (id: string, patch: Partial<PlotMeta>) => {
        const i = next.findIndex((m) => m.id === id);
        if (i < 0) next = [...next, { id, ...patch }];
        else {
          const n = next.slice();
          n[i] = { ...n[i], ...patch };
          next = n;
        }
      };
      for (const [id, patch] of Object.entries(inherit)) apply(id, patch);
      for (const [id, patch] of Object.entries(autoLock)) apply(id, patch);
      setPlotMetas(next);
      plotMetasRef.current = next;
    }
    prevRingsRef.current = rings.map((r) => ({
      ...r,
      meta: next.find((m) => m.id === r.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygonsMemo]);

  /* ---------------- canvas size ----------------
     The viewBox height follows the real box so one canvas unit is one square
     unit on both axes: no stretching (which made circles oval and some lines
     look thicker), no dead space, and the full height is used. */
  const [viewH, setViewH] = useState(400);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setViewH((W * r.height) / r.width);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------- coords ---------------- */
  /* প্রিভিউ ২০, ঠিক ৫ — ক্যানভাসে আঙুল রাখলে পেজ ওপরে-নিচে স্ক্রল হবে না:
     র‍্যাপারে touch-action:none (ক্লাস) + নন-প্যাসিভ touchmove ব্লক। */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);
  /**
   * Screen -> canvas units via the SVG's own screen matrix. This is exact for
   * any box shape and any zoom level, so the line always starts under the finger.
   * (Hand-rolled r.width/r.height maths silently offset touches — that was the
   * cause of "drawing appears above/below my finger".)
   */
  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  /** canvas units per screen pixel (uniform on both axes by construction) */
  const unitsPerPx = () => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const ctm = svg.getScreenCTM();
    if (!ctm) return 1;
    const sx = Math.abs(ctm.a) || 1;
    const sy = Math.abs(ctm.d) || 1;
    return 1 / Math.max(0.0001, Math.min(sx, sy));
  };

  /* ---------------- snapping ---------------- */
  const snapCorner = (x: number, y: number, skipIds?: Set<string>, radiusPx: number = CORNER_PX) => {
    let best = { x, y, snapped: false, dist: radiusPx * unitsPerPx() };
    for (const s of segments) {
      if (skipIds?.has(s.id)) continue;
      for (const p of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < best.dist) best = { x: p.x, y: p.y, snapped: true, dist: d };
      }
    }
    return best;
  };
  const snapJoin = (x: number, y: number, skipIds?: Set<string>) => {
    const corner = snapCorner(x, y, skipIds);
    if (corner.snapped) return corner;
    let best = { x, y, snapped: false, dist: EDGE_PX * unitsPerPx() };
    for (const s of segments) {
      if (skipIds?.has(s.id)) continue;
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
      if (l2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / l2));
      let px = s.x1 + t * dx, py = s.y1 + t * dy;
      // falling near either end lands exactly ON that head, so the plot closes
      // instead of making a T that looks crossed
      if (t <= 0.12) { px = s.x1; py = s.y1; }
      else if (t >= 0.88) { px = s.x2; py = s.y2; }
      const d = Math.hypot(x - px, y - py);
      if (d < best.dist) best = { x: px, y: py, snapped: true, dist: d };
    }
    return best;
  };
  const snapAngle = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 26 * unitsPerPx()) return { x: to.x, y: to.y, snapped: false };
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const nearest = Math.round(angle / ANGLE_STEP) * ANGLE_STEP;
    if (Math.abs(angle - nearest) > ANGLE_TOL) return { x: to.x, y: to.y, snapped: false };
    const rad = (nearest * Math.PI) / 180;
    return { x: from.x + Math.cos(rad) * len, y: from.y + Math.sin(rad) * len, snapped: true };
  };
  /**
   * ONE magnet order everywhere: head (corner) -> body/head of an edge -> 45°.
   * The 45° magnet used to run BEFORE the join, which is why a line dragged
   * towards a neighbouring head slid past it and crossed the other line.
   * ২৪ নভেম্বর Founder: ৪৫° ম্যাগনেট কোনার সাথে লড়াই করে মিলতে দিত না —
   * তাই ৪৫° লাগতে যাচ্ছে, অথচ কাছাকাছি কোনো কোনা থাকলে কোনাকেই প্রাধান্য দেওয়া হয়।
   */
  const resolvePoint = (
    x: number,
    y: number,
    opts?: { skipIds?: Set<string>; angleFrom?: { x: number; y: number } }
  ) => {
    const corner = snapCorner(x, y, opts?.skipIds);
    if (corner.snapped) return corner;
    const join = snapJoin(x, y, opts?.skipIds);
    if (join.snapped) return join;
    if (opts?.angleFrom) {
      const a = snapAngle(opts.angleFrom, { x, y });
      if (a.snapped) {
        // ৪৫° ম্যাগনেট লাগতে যাচ্ছে — কিন্তু কাছাকাছি (২ গুণ সহনশীলতার ভেতর)
        // কোনো কোনা থাকলে কোনায় বসবে, ম্যাগনেটের রেখায় আটকে থাকবে না
        const near = snapCorner(x, y, opts?.skipIds, CORNER_PX * 2);
        if (near.snapped) return near;
        return a;
      }
    }
    return { x, y, snapped: false };
  };
  const distToSeg = (x: number, y: number, s: Seg) => {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(x - s.x1, y - s.y1);
    let t = ((x - s.x1) * dx + (y - s.y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (s.x1 + t * dx), y - (s.y1 + t * dy));
  };
  const findSegment = (x: number, y: number): Seg | null => {
    let best: Seg | null = null;
    let bestD = HIT_PX * unitsPerPx();
    for (let i=segments.length-1; i>=0; i--) {
      const s=segments[i];
      const d = distToSeg(x, y, s);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  };
  const findEndpoint = (x: number, y: number): { s: Seg; end: 1 | 2 } | null => {
    let best: { s: Seg; end: 1 | 2 } | null = null;
    let bestD = END_PX * unitsPerPx();
    for (const s of segments) {
      const d1 = Math.hypot(x - s.x1, y - s.y1);
      const d2 = Math.hypot(x - s.x2, y - s.y2);
      if (d1 < bestD) { bestD = d1; best = { s, end: 1 }; }
      if (d2 < bestD) { bestD = d2; best = { s, end: 2 }; }
    }
    return best;
  };

  /* ভাইব্রেট: Chrome-এ navigator.vibrate()-এ sticky user activation লাগে —
     টাচে pointerdown-এ সেটা মেলে না, pointerup/click-এ মেলে (আর একবার মিললে
     পেইজ খোলা থাকা পর্যন্ত থাকে)। তাই টানার মাঝখানে (pointermove) ডাকলে
     ফোনে না-ও বাজতে পারে — ছাড়ার সময় (pointerup) ডাকলে নিশ্চিত বাজে।
     স্ন্যাপে বসা/মোছার মতো নিশ্চিত খবরে ২৫ms-এর লম্বা ভাইব্রেট, যাতে
     ১২ms-এর চিকন টিক মিস না হয়। */
  const vibrate = (ms: number | number[] = 12) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  };

  /* ---------------- mutations ---------------- */
  const updateSegment = (id: string, patch: Partial<Seg>) =>
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  /* একটা দাগ মুছুন — লক প্লটের দাগ হলে আনলকের হিন্ট (মান বদলানোর মতোই);
     কনফার্ম উইন্ডো নেই (২৫ নভেম্বর Founder: বারবার একই ওয়ার্নিং বন্ধ করো) —
     সাথে সাথে মুছে যায়; ↶ ফেরান (বা ↷ আবার) চাপলে দাগটা ফিরে আসে।
     প্লটের হিসাব নিজে থেকে বদলায়। */
  const deleteSegment = (id: string) => {
    const seg = segments.find((s) => s.id === id);
    if (!seg) return;
    if (completedSegIds().has(id)) {
      setHint('🔒 প্লট লক আছে — মান বদলাতে প্লটের 🔒 আইকনে ট্যাপ করে আনলক করুন');
      window.setTimeout(() => setHint(null), 3000);
      return;
    }
    setSegments((prev) => prev.filter((s) => s.id !== id));
    vibrate(20); // মোছার নিশ্চিত খবর — 🗑/পটি, দুই পথেই (click/pointerup-এ বাজে)
    setRedoStack((prev) => [...prev, seg]);
    setDeletedStack((prev) => [...prev, seg]);
    setSelectedId((cur) => (cur === id ? null : cur));
    setMenu(null);
  };
  const undo = () => {
    // সবার আগে মুছে ফেলা দাগ ফেরানো — ভুলে মুছলে ↶ চাপলেই ফিরে আসে;
    // একই দাগ যেন ↷-তেও না থাকে (দুইবার ফেরত = নকল দাগ)
    if (deletedStack.length) {
      const stack = [...deletedStack];
      const back = stack.pop()!;
      setDeletedStack(stack);
      setRedoStack((prev) => prev.filter((s) => s.id !== back.id));
      setSegments((prev) => (prev.some((s) => s.id === back.id) ? prev : [...prev, back]));
      return;
    }
    if (!segments.length) return;
    const s = [...segments];
    const last = s.pop()!;
    setRedoStack([...redoStack, last]);
    setSegments(s);
    if (selectedId === last.id) { setSelectedId(null); setMenu(null); }
  };
  const redo = () => {
    if (!redoStack.length) return;
    const r = [...redoStack];
    const next = r.pop()!;
    setRedoStack(r);
    setDeletedStack((prev) => prev.filter((s) => s.id !== next.id));
    setSegments((prev) => (prev.some((s) => s.id === next.id) ? prev : [...prev, next]));
  };

  /** chain of touching lines = one plot */
  const plotIds = (startId: string): string[] => {
    const byId = new Map<string, Seg>(segments.map((sg) => [sg.id, sg] as [string, Seg]));
    const seen = new Set<string>([startId]);
    const queue = [startId];
    const near = (a: Seg, b: Seg) =>
      [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }].some(
        (p) => Math.hypot(p.x - a.x1, p.y - a.y1) <= 6 || Math.hypot(p.x - a.x2, p.y - a.y2) <= 6
      );
    while (queue.length) {
      const cur = byId.get(queue.shift()!);
      if (!cur) continue;
      for (const other of segments) {
        if (seen.has(other.id)) continue;
        if (near(cur, other) || near(other, cur)) { seen.add(other.id); queue.push(other.id); }
      }
    }
    return [...seen];
  };

  const printCanvas = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.removeAttribute('style');
    clone.setAttribute('width', '900');
    clone.setAttribute('height', '900');
    const data = new XMLSerializer().serializeToString(clone);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>ভূমি ও আমিন — নকশা</title>` +
      `<style>@font-face{font-family:'Noto Sans Bengali';font-style:normal;font-weight:100 900;font-display:swap;src:url('${notoBengaliFontUrl}') format('woff2');unicode-range:U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1,U+11DF0-11DF1}@font-face{font-family:'Noto Sans Bengali';font-style:normal;font-weight:100 900;font-display:swap;src:url('${notoLatinFontUrl}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}body{margin:0;font-family:'Noto Sans Bengali',sans-serif}svg{width:100%;height:auto;font-family:'Noto Sans Bengali',sans-serif}.foot{padding:8px 12px;font-size:11px;color:#334155;border-top:1px solid #e2e8f0}</style></head><body>` +
      data +
      `<div class="foot">এই ফলাফল আনুমানিক ও সহায়ক। সরকারি সার্ভে, নামজারি বা আদালতের জন্য নিবন্ধিত সার্ভেয়ার/ভূমি অফিসের যাচাই আবশ্যক।</div>` +
      `<script>window.onload=async()=>{try{await document.fonts.load('400 12px "Noto Sans Bengali"','ভূমি ও আমিন 0123456789');await document.fonts.load('700 12px "Noto Sans Bengali"','দখল প্রতিবেদন');await document.fonts.ready}catch(e){};setTimeout(()=>window.print(),100)}<\\/script></body></html>`
    );
    w.document.close();
  };

  /* প্রিভিউ ২০, ঠিক ৪ — প্রিভিউ (👁) বোতাম এখন ওপরে "✓ সম্পন্ন"-এর পাশে (SurveyScreen);
     সেখান থেকে এই printCanvas-ই চলে — টুলবারে আর 👁 নেই। */
  useEffect(() => {
    if (printRef) printRef.current = printCanvas;
  });

  /* ---------------- প্লট লক টগল (প্রিভিউ ২০, সংযোজন ৭) ---------------- */
  const toggleLock = (id: string) => {
    const m = plotMeta(id);
    if (m.completed) {
      unlockedRef.current.add(id);
      setPlotMeta(id, { completed: false });
      setHint('প্লট আনলক হয়েছে — বাহু সরানো যাবে, মান বদলানো যাবে');
    } else {
      unlockedRef.current.delete(id);
      let dag = m.dagNo;
      if (!dag) {
        const used = new Set(plotMetas.map((x) => x.dagNo).filter(Boolean));
        let n = 1;
        while (used.has(String(n))) n++;
        dag = String(n);
      }
      setPlotMeta(id, { completed: true, dagNo: dag });
      setHint('প্লট লক হয়েছে 🔒 — ভেতরে টেনে পুরো প্লট সরবে, কোনা টেনে ছবি বড়-ছোট হবে (মাপ বদলাবে না)');
    }
    window.setTimeout(() => setHint(null), 3000);
    vibrate();
  };

  /* ---------------- plot card (drag = move, tap = edit) ---------------- */
  const cardDown=(id:string)=>(e:PointerEvent)=>{
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const m=plotMeta(id);
    cardDrag.current={ id, sx:e.clientX, sy:e.clientY, ox: m.dx??0, oy: m.dy??0, moved:false };
  };
  const cardMove=(e:PointerEvent)=>{
    const g=cardDrag.current; if(!g) return;
    if(Math.hypot(e.clientX-g.sx, e.clientY-g.sy)> MIN_MOVE) g.moved=true;
    const k=unitsPerPx();
    let ndx=g.ox + (e.clientX-g.sx)*k, ndy=g.oy + (e.clientY-g.sy)*k;
    // snap to centre when close
    if(Math.hypot(ndx, ndy) < 10) { ndx=0; ndy=0; if(!lastSnapRef.current) vibrate(); lastSnapRef.current=true; } else lastSnapRef.current=false;
    setPlotMeta(g.id,{ dx: ndx, dy: ndy });
  };
  const cardUp=()=>{
    const g=cardDrag.current; cardDrag.current=null;
    if(g && !g.moved){ setPlotInput(plotMeta(g.id).title ?? ''); setDagInput(plotMeta(g.id).dagNo ?? ''); setMenu({kind:'plot', id: g.id}); }
  };
  const resizeDown=(id:string)=>(e:PointerEvent)=>{
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const m=plotMeta(id);
    const hasName=!!(m.title&&m.title.trim()), hasDag=!!m.dagNo, hasArea=!!plotArea(polygonsMemo.find(pp=>pp.id===id) as any);
    const cur=boxSize(m, hasName, hasDag, hasArea);
    resizeDrag.current={ id, sx:e.clientX, sy:e.clientY, sw: cur.w, sh: cur.h };
  };
  const resizeMove=(e:PointerEvent)=>{
    const g=resizeDrag.current; if(!g) return;
    const k=unitsPerPx();
    const dx=(e.clientX-g.sx)*k, dy=(e.clientY-g.sy)*k;
    // drag corner outward: increase both w and h
    let nw=g.sw + dx, nh=g.sh + dy;
    nw=Math.max(56, Math.min(140, nw)); nh=Math.max(22, Math.min(110, nh));
    setPlotMeta(g.id,{ bw: Math.round(nw), bh: Math.round(nh) });
  };
  const resizeUp=()=>{ resizeDrag.current=null; };

  const handleComplete=()=>{
    const pls=polygonsMemo;
    if(!pls.length){ setHint('আগে চার দাগে প্লট বন্ধ করুন।'); window.setTimeout(()=> setHint(null),2500); return; }
    let done=0;
    for(const pl of pls){
      const m=plotMeta(pl.id);
      if(m.completed) continue;
      const area=plotArea(pl);
      // auto dag number if empty: next serial
      let dag=m.dagNo;
      if(!dag){
        const used=new Set(plotMetas.map(x=> x.dagNo).filter(Boolean));
        let n=1; while(used.has(String(n))) n++; dag=String(n);
      }
      setPlotMeta(pl.id,{ completed:true, dagNo: dag });
      done++;
      // persist to report-like hint: area already via plotArea, but we save hint
      if(area) setHint(`প্লট ${dag} সম্পন্ন — ${area.decimal.toFixed(2)} শতক / ${(area.sqft/720).toFixed(2)} কাঠা রিপোর্টে সেভ হলো`);
    }
    if(done) window.setTimeout(()=> setHint(null),3500);
    else { setHint('সব প্লট ইতিমধ্যে সম্পন্ন ✓'); window.setTimeout(()=> setHint(null),2000); }
  };

  /* ---------------- নিচে টেনে মোছা (২৫ নভেম্বর) ----------------
     মুছার পটি ক্যানভাসের নিচে (মোট বারের ঠিক ওপরে) বসে — রেন্ডারে যে
     bottom বসে ঠিক সেটাই এখানে হিসাব করা হয়, যাতে চুম্বকের জায়গা মেলে।
     মোট বার থাকলে পটি তার ওপরে (৪৬px), না থাকলে নিচে (৮px)। */
  const deleteStripGeom = () => {
    const wr = wrapperRef.current?.getBoundingClientRect();
    if (!wr || wr.height <= 0) return null;
    const bottomOff = totalAreas.length > 0 ? 46 : 8;
    const top = wr.bottom - bottomOff - DELETE_STRIP_H;
    return { top, centerY: top + DELETE_STRIP_H / 2 };
  };
  const updateDeleteZone = (active: boolean, hot: boolean) => {
    const cur = deleteZoneRef.current;
    if (cur.active === active && cur.hot === hot) return;
    deleteZoneRef.current = { active, hot };
    setDeleteZone({ active, hot });
  };

  /* লক প্লটের কোনা টানা — বিপরীত কোনাকে কেন্দ্র করে ঘোরা+বড়-ছোট (মাপ
     বদলায় না)। ভাগ করা জোড়া ও সরলরেখার ধারাবাহিক দাগ একসাথে সরে, যাতে
     পাশের প্লটের রিং না ভাঙে (২৪ নভেম্বর রেকর্ডিং: নিচের প্লট আসা-যাওয়া)।
     টানার সময় লক্ষ্য = আঙুলের জায়গা (চুম্বক নেই — চুম্বক কোনাকে জোড়ায়
     আটকে রাখত, আঙুল এগোলে ছিটকে যেত); ছাড়ার সময় (handleUp) কাছের
     জোড়ায় বসে + ভাইব্রেট হয়। */
  const applyPlotCorner = (
    g: { corner: { x: number; y: number }; opp: { x: number; y: number }; origAll: { id: string; x1: number; y1: number; x2: number; y2: number; len?: number }[]; pts: { x: number; y: number }[] },
    target: { x: number; y: number },
  ) => {
    const d0 = Math.hypot(g.corner.x - g.opp.x, g.corner.y - g.opp.y) || 1;
    let s = Math.hypot(target.x - g.opp.x, target.y - g.opp.y) / d0;
    s = Math.max(0.3, Math.min(3, s));
    // কোনা আঙুলের দিকে যায় — বিপরীত কোনাকে কেন্দ্র করে ঘোরা+বড়-ছোট
    // (আগে শুধু বড়-ছোট হতো, তাই আঙুল পাশে গেলে কোনা উল্টো দিকে যেত)
    const ang0 = Math.atan2(g.corner.y - g.opp.y, g.corner.x - g.opp.x);
    const ang1 = Math.atan2(target.y - g.opp.y, target.x - g.opp.x);
    const rot = Math.hypot(target.x - g.opp.x, target.y - g.opp.y) < 1 ? 0 : ang1 - ang0;
    const cos = Math.cos(rot) * s, sin = Math.sin(rot) * s;
    const sc = (q: { x: number; y: number }) => {
      const dx = q.x - g.opp.x, dy = q.y - g.opp.y;
      return { x: g.opp.x + dx * cos - dy * sin, y: g.opp.y + dx * sin + dy * cos };
    };
    const all = g.origAll;
    const key = (pt: { x: number; y: number }) => `${Math.round(pt.x * 100)},${Math.round(pt.y * 100)}`;
    const mapped = new Map<string, { x: number; y: number }>();
    // বীজ: টানা প্লটের ৪ কোনা
    for (const pt of g.pts) mapped.set(key(pt), sc(pt));
    // টানা কোনাটা হুবহু জোড়ার জায়গায় বসবে — rotate/scale-এর ভগ্নাংশ ভুল নয়
    mapped.set(key(g.corner), { x: target.x, y: target.y });
    // টানা প্লটের বাহুর ওপরের জোড়া (মাঝখানের খুঁটি) — বাহু সোজা থাকে
    const sides: [{ x: number; y: number }, { x: number; y: number }][] = [];
    for (let i = 0; i < g.pts.length; i++) sides.push([g.pts[i], g.pts[(i + 1) % g.pts.length]]);
    const onSide = (pt: { x: number; y: number }) => {
      for (const [a, b] of sides) {
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
        let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2;
        if (t < -0.01 || t > 1.01) continue;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy)) < 1) return true;
      }
      return false;
    };
    for (const sg of all) {
      for (const pt of [{ x: sg.x1, y: sg.y1 }, { x: sg.x2, y: sg.y2 }]) {
        const k = key(pt);
        if (!mapped.has(k) && onSide(pt)) mapped.set(k, sc(pt));
      }
    }
    // ধারাবাহিক দাগ: পুরোপুরি সরছে এমন দাগের সাথে একই সরলরেখায়
    // লাগা দাগের অপর প্রান্তও একইভাবে সরে — পুরো সোজা বাহু একসাথে যায়
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 20) {
      changed = false;
      for (const sg of all) {
        const aK = key({ x: sg.x1, y: sg.y1 }), bK = key({ x: sg.x2, y: sg.y2 });
        const aM = mapped.has(aK), bM = mapped.has(bK);
        if (aM === bM) continue;
        const mappedPt = aM ? { x: sg.x1, y: sg.y1 } : { x: sg.x2, y: sg.y2 };
        const unmappedPt = aM ? { x: sg.x2, y: sg.y2 } : { x: sg.x1, y: sg.y1 };
        const unmappedK = aM ? bK : aK;
        let cont = false;
        for (const t of all) {
          if (t === sg) continue;
          const tA = key({ x: t.x1, y: t.y1 }), tB = key({ x: t.x2, y: t.y2 });
          if (!mapped.has(tA) || !mapped.has(tB)) continue;
          if (tA !== key(mappedPt) && tB !== key(mappedPt)) continue;
          const tdx = t.x2 - t.x1, tdy = t.y2 - t.y1, sdx = sg.x2 - sg.x1, sdy = sg.y2 - sg.y1;
          const tl = Math.hypot(tdx, tdy) || 1, sl = Math.hypot(sdx, sdy) || 1;
          const cross = (tdx * sdy - tdy * sdx) / (tl * sl);
          const dot = (tdx * sdx + tdy * sdy) / (tl * sl);
          if (Math.abs(cross) < 0.02 && dot > 0) { cont = true; break; }
        }
        if (cont) { mapped.set(unmappedK, sc(unmappedPt)); changed = true; }
      }
    }
    const byId = new Map<string, { id: string; x1: number; y1: number; x2: number; y2: number; len?: number }>(
      all.map((o) => [o.id, o] as [string, { id: string; x1: number; y1: number; x2: number; y2: number; len?: number }]),
    );
    setSegments((prev) =>
      prev.map((sg) => {
        const o = byId.get(sg.id);
        if (!o) return sg;
        const a = mapped.get(key({ x: o.x1, y: o.y1 }));
        const b = mapped.get(key({ x: o.x2, y: o.y2 }));
        // শুধু ছবির জ্যামিতি বদলায় — বাহুর মান (lengthFt) যেমন আছে তেমনই থাকে,
        // তাই লেবেল/ক্ষেত্রফল/শতক/মোট বার/রিপোর্ট কিছুই বদলায় না
        return { ...sg, x1: a ? a.x : o.x1, y1: a ? a.y : o.y1, x2: b ? b.x : o.x2, y2: b ? b.y : o.y2 };
      })
    );
  };

  /* ---------------- pointer flow ---------------- */
  const handleDown = (e: PointerEvent) => {
    if(resizeDrag.current || cardDrag.current) return;
    lockHintShownRef.current = false;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    // color fill: tapping inside a plot paints it with the active toolbar colour
    // (বিভাজক টুল চালু থাকলে রঙ নয় — বন্টনের দাগ আঁকা হবে)
    const hit=hitPlotAt(p.x, p.y);
    if(!dividerTool && hit && !plotMeta(hit.id).completed){
      // if user has picked a colour (or just wants to confirm), a tap inside fills the plot
      // we treat any interior tap that is NOT on a card as a fill, when the plot colour differs
      // to avoid stealing line drags, only fill if finger is well inside (not near edge)
      const nearEdge= hit.pts.some((_,i)=>{ const a=hit.pts[i], b=hit.pts[(i+1)%hit.pts.length]; const dx=b.x-a.x, dy=b.y-a.y, l2=dx*dx+dy*dy||1; let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2; t=Math.max(0,Math.min(1,t)); return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)) < 10; });
      if(!nearEdge){
        const cur=plotMeta(hit.id).color || hit.color;
        if(cur !== activeColor){
          setPlotMeta(hit.id,{color: activeColor});
          vibrate();
          setTapDot({ x: p.x, y: p.y, id: Date.now() });
          return;
        }
      }
    }
    // show exactly where the finger landed (tap feedback)
    setTapDot({ x: p.x, y: p.y, id: Date.now() });

    // লক (সম্পন্ন) প্লট — প্রিভিউ ২০, ঠিক ৭: ভেতরে টানলে পুরো প্লট সরে,
    // কোনা টানলে ছবি বড়-ছোট হয় (বিপরীত কোনাকে কেন্দ্র করে) — মান বদলায় না।
    // বিভাজক টুল চালু থাকলে এই পথ নয় — বন্টনের দাগ আঁকা হবে।
    if (!dividerTool) {
      const k = unitsPerPx();
      const lockedPlot = polygonsMemo.find((pl) => {
        if (!plotMeta(pl.id).completed) return false;
        if (pointInPolygon(p.x, p.y, pl.pts)) return true;
        return pl.pts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < END_PX * k);
      });
      if (lockedPlot) {
        const cornerPt = lockedPlot.pts.find((q) => Math.hypot(p.x - q.x, p.y - q.y) < END_PX * k);
        const nearEdge = lockedPlot.pts.some((_, i) => {
          const a = lockedPlot.pts[i], b = lockedPlot.pts[(i + 1) % lockedPlot.pts.length];
          const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
          let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
          t = Math.max(0, Math.min(1, t));
          return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) < 10;
        });
        const orig = lockedPlot.id.split('|')
          .map((id) => segments.find((s) => s.id === id))
          .filter((s): s is Seg => !!s)
          .map((s) => ({ id: s.id, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, len: s.lengthFt }));
        if (cornerPt && orig.length) {
          const idx = lockedPlot.pts.indexOf(cornerPt);
          const opp = lockedPlot.pts[(idx + 2) % lockedPlot.pts.length];
          // টান শুরুর পুরো ছবি — ভাগ করা জোড়া ঠিক রাখতে (ঠিক ৪) সব দাগের
          // আসল জায়গা লাগে; pts = টানা প্লটের ৪ কোনা
          const origAll = segments.map((s) => ({ id: s.id, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, len: s.lengthFt }));
          press.current = { kind: 'plotCorner', plotId: lockedPlot.id, corner: cornerPt, opp, sx: e.clientX, sy: e.clientY, orig, origAll, pts: lockedPlot.pts, moved: false };
          cornerCurRef.current = { x: cornerPt.x, y: cornerPt.y };
          setSelectedId(null);
          vibrate();
          return;
        }
        if (!nearEdge && orig.length) {
          // লক প্লটের ভেতরে বাড়তি (অনাথ) দাগে ট্যাপ — প্লট সরানো নয়,
          // দাগটাই বাছাই হবে (মানের ঘর + 🗑 মুছুন খুলবে); লক প্লটের
          // নিজের দাগে ট্যাপ আগের মতোই পুরো প্লট সরায়
          const nearSeg = findSegment(p.x, p.y);
          if (nearSeg && !completedSegIds().has(nearSeg.id)) {
            // নিচের সাধারণ দাগ-পথে যাবে (moveSeg) — এখানে return নয়
          } else {
            press.current = { kind: 'plotMove', plotId: lockedPlot.id, sx: e.clientX, sy: e.clientY, orig, moved: false };
            vibrate();
            return;
          }
        }
      }
    }

    // Line body first (30px), endpoint handles second (16px):
    // otherwise the corner zone steals the drag and a line can never be moved
    // when it is short or when you grab it near its end.
    const seg = findSegment(p.x, p.y);
    const ep = findEndpoint(p.x, p.y);

    // প্রান্তের ধরা-ছোঁয়া ছোট (১১px) — নইলে ছোট দাগের গায়ে ট্যাপ করলেই
    // কোনা ধরে, দাগটা আর সরানো/মোছা যায় না (২৫ নভেম্বর: বাড়তি দাগে
    // টানলেও লাল পটি আসে না); দাগের গায়ের ট্যাপ এখন দাগ সরায় (moveSeg)
    const _lockedIds=completedSegIds();
    if (ep && _lockedIds.has(ep.s.id)) { /* locked plot corner - ignore */ } else if (ep && (!seg || ep.s.id === seg.id) && Math.hypot(p.x - (ep.end === 1 ? ep.s.x1 : ep.s.x2), p.y - (ep.end === 1 ? ep.s.y1 : ep.s.y2)) < END_PX * unitsPerPx() * 0.5) {
      // A corner that is shared by two or more lines = the plot itself.
      // Grabbing it drags the WHOLE plot (so the plot grows/shrinks as one piece).
      press.current = { kind: 'endpoint', id: ep.s.id, end: ep.end };
      setSelectedId(ep.s.id);
      vibrate();
      return;
    }

    const locked=completedSegIds();
    if (seg && locked.has(seg.id)) {
      // locked: still allow length input on tap, but not drag
      press.current={ kind:'moveSeg', id: seg.id, sx: e.clientX, sy: e.clientY, pts: [seg.x1, seg.y1, seg.x2, seg.y2], moved: false };
      setSelectedId(seg.id);
      return;
    }
    if (seg) {
      press.current = { kind: 'moveSeg', id: seg.id, sx: e.clientX, sy: e.clientY, pts: [seg.x1, seg.y1, seg.x2, seg.y2], moved: false };
      setSelectedId(seg.id);
      return;
    }

    if (ep) {
      press.current = { kind: 'endpoint', id: ep.s.id, end: ep.end };
      setSelectedId(ep.s.id);
      vibrate();
      return;
    }

    // if inside a completed (locked) plot, don't create new line inside it
    // (বিভাজক টুল চালু থাকলে বন্টনের দাগ আঁকা যাবে — সেটাই ঠিক ২)
    if (!dividerTool) {
    for(const pl of polygonsMemo){
      const m=plotMeta(pl.id);
      if(!m.completed) continue;
      if(!pointInPolygon(p.x, p.y, pl.pts)) continue;
      let nearEdge=false;
      for(let j=0;j<pl.pts.length;j++){
        const a=pl.pts[j], b=pl.pts[(j+1)%pl.pts.length];
        const dx=b.x-a.x, dy=b.y-a.y, l2=dx*dx+dy*dy||1;
        let t=((p.x-a.x)*dx + (p.y-a.y)*dy)/l2; t=Math.max(0,Math.min(1,t));
        if(Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)) < 8) { nearEdge=true; break; }
      }
      if(!nearEdge){
        setHint('লক প্লটের ভেতরে নতুন দাগ আঁকা যাবে না — বাইরে আঁকুন');
        window.setTimeout(()=> setHint(null),2500);
        return;
      }
    }
    }
    const s = snapCorner(p.x, p.y);
    if (s.snapped) vibrate();
    lastSnapRef.current = s.snapped;
    press.current = { kind: 'create', sx: e.clientX, sy: e.clientY, x1: s.x, y1: s.y };
    setDraft({ x1: s.x, y1: s.y, x2: s.x, y2: s.y, snapped: s.snapped });
    setMenu(null);
    setSelectedId(null);   // a fresh line stays plain until it is tapped
  };

  const handleMove = (e: PointerEvent) => {
    const g = press.current;
    /* প্রিভিউ ২০, ঠিক ৭ — লক প্লট: ভেতরে টানলে পুরো চারবাহুর প্লট একসাথে সরে */
    if (g.kind === 'plotMove') {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < MIN_MOVE) return;
      g.moved = true;
      const k = unitsPerPx();
      const dx = (e.clientX - g.sx) * k, dy = (e.clientY - g.sy) * k;
      // টানার সময় চুম্বক নেই (২৬ নভেম্বর: চুম্বক প্লটকে জোড়ায় আটকে
      // রাখত — আঙুল এগোলে প্লট আটকে থাকত, তারপর ছিটকে যেত; আটকে আটকে
      // যাওয়ার কারণ)। প্লট আঙুলের সাথে হুবহু সরে; ছাড়ার সময় (handleUp)
      // কাছের জোড়ায় বসে + ভাইব্রেট হয়।
      g.lastDx = dx; g.lastDy = dy;
      const byId = new Map<string, { id: string; x1: number; y1: number; x2: number; y2: number; len?: number }>(
        g.orig.map((o) => [o.id, o] as [string, { id: string; x1: number; y1: number; x2: number; y2: number; len?: number }]),
      );
      setSegments((prev) =>
        prev.map((sg) => {
          const o = byId.get(sg.id);
          if (!o) return sg;
          return { ...sg, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
        })
      );
      return;
    }
    /* প্রিভিউ ২০, ঠিক ৭ — লক প্লটের কোনা টানলে বিপরীত কোনাকে কেন্দ্র করে
       পুরো প্লটের ছবি বড়-ছোট হয়; বাহুর মান/ক্ষেত্রফল যেমন ছিল তেমনই থাকে —
       ২৪ নভেম্বর Founder: "মাপ পরিবর্তন হবেনা। ওটা যেভাবে আছে ওভাবে থাকবে।"
       ভাগ করা জোড়া (shared junction): টানা প্লটের কোনা সরলে তার সাথে লাগা
       সরলরেখার ধারাবাহিক দাগগুলোও একসাথে সরে — নইলে পাশের প্লটের বাহু
       বেঁকে রিং ভেঙে যায়, প্লটটি টানার সময় ক্যানভাস/মোট/রিপোর্ট থেকে
       হারিয়ে যায় (২৪ নভেম্বর রেকর্ডিং: নিচের 1.77 শতক প্লট আসা-যাওয়া)।
       টানা প্লটের বাহুর ওপরের জোড়াও (মাঝখানের খুঁটি) একসাথে সরে।
       সব হিসাব টান শুরুর আসল জায়গা (origAll) থেকে — টানে টানে সরে না। */
    if (g.kind === 'plotCorner') {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < MIN_MOVE) return;
      g.moved = true;
      const p = toWorld(e.clientX, e.clientY);
      // টানার সময় চুম্বক নেই — কোনা আঙুলের জায়গায় যায় (২৬ নভেম্বর:
      // চুম্বক কোনাকে জোড়ায় আটকে রাখত, আঙুল এগোলে ছিটকে যেত)। ছাড়ার
      // সময় (handleUp) কাছের জোড়ায় বসে + ভাইব্রেট হয়।
      cornerCurRef.current = { x: p.x, y: p.y };
      applyPlotCorner(g, { x: p.x, y: p.y });
      return;
    }
    if (g.kind === 'moveSeg') {
      const _lk2=completedSegIds();
      if(_lk2.has(g.id)){
        if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < MIN_MOVE) return;
        // লক দাগ নিচে টানলে পটি ওঠে না (মোছা যায় না) — কিন্তু চুপচাপ কিছু না
        // ঘটলে মনে হয় অ্যাপ আটকে গেছে (২৫ নভেম্বর: "নিচে টানলে লাল পটি
        // আসেনা")। তাই একবার লক হিন্ট দেখানো হয় — আনলক করলেই মোছা যাবে।
        if (e.clientY > g.sy + 10 && !lockHintShownRef.current) {
          lockHintShownRef.current = true;
          setHint('🔒 প্লট লক আছে — মুছতে/সরাতে প্লটের 🔒 আইকনে ট্যাপ করে আনলক করুন');
          window.setTimeout(() => setHint(null), 3000);
          vibrate();
        }
        return;
      }
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < MIN_MOVE) return;
      g.moved = true;
      const k = unitsPerPx();
      let dx = (e.clientX - g.sx) * k, dy = (e.clientY - g.sy) * k;
      // magnet: whichever head ends up nearest another line's head lands exactly on it,
      // so a moved line can be clicked into a free corner instead of "almost" there.
      // নিজের আসল কোনা লক্ষ্য নয় — নইলে চুম্বক দাগকে আগের জায়গায় টেনে
      // ধরে রাখে, টানার উল্টো দিকে ঠেলে (২৫ নভেম্বর Founder)।
      const heads = [{ x: g.pts[0] + dx, y: g.pts[1] + dy }, { x: g.pts[2] + dx, y: g.pts[3] + dy }];
      const origHeads = [{ x: g.pts[0], y: g.pts[1] }, { x: g.pts[2], y: g.pts[3] }];
      let snapTo: { dx: number; dy: number; d: number } | null = null;
      for (const h of heads) {
        for (const o of segments) {
          if (o.id === g.id) continue;
          for (const q of [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }]) {
            if (origHeads.some((hh) => Math.hypot(q.x - hh.x, q.y - hh.y) <= 2)) continue;
            const d = Math.hypot(h.x - q.x, h.y - q.y);
            if (d <= EDGE_PX * k && (!snapTo || d < snapTo.d)) {
              snapTo = { dx: dx + (q.x - h.x), dy: dy + (q.y - h.y), d };
            }
          }
        }
      }
      if (snapTo) { dx = snapTo.dx; dy = snapTo.dy; }
      if (snapTo && !lastSnapRef.current) vibrate();
      lastSnapRef.current = !!snapTo;
      // নিচে টেনে মোছা — দাগ নিচের দিকে টানলেই মুছার পটি দেখা যায়;
      // পটির কাছে গেলে দাগ চুম্বকের মতো পটির মাঝখানে বসে (শুধু ছবি সরে,
      // মান বদলায় না); ছাড়লে সাথে সাথে মুছে যায়, উইন্ডো আসে না।
      // লক দাগ এখানে আসেই না — ওপরে লক হলে আগেই ফেরত গেছে।
      const geom = deleteStripGeom();
      const draggingDown = e.clientY > g.sy + 10;
      let hot = false;
      if (geom && draggingDown) {
        hot = e.clientY >= geom.top - DELETE_SNAP_PX;
        if (hot) {
          const targetY = toWorld(e.clientX, geom.centerY).y;
          dy = targetY - (g.pts[1] + g.pts[3]) / 2;
          if (!deleteSnapRef.current) vibrate(20); // পটি গরম হলে ভাইব্রেট — ১২ms ফোনে টের পাওয়া যায় না
          deleteSnapRef.current = true;
        } else {
          deleteSnapRef.current = false;
        }
      } else {
        deleteSnapRef.current = false;
      }
      updateDeleteZone(draggingDown, hot);
      deleteHotRef.current = hot;
      updateSegment(g.id, { x1: g.pts[0] + dx, y1: g.pts[1] + dy, x2: g.pts[2] + dx, y2: g.pts[3] + dy });
      return;
    }
    if (g.kind === 'corner') {
      const _lk=completedSegIds(); if(g.heads.some(h=> _lk.has(h.id))) return;
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < MIN_MOVE) return;
      g.moved = true;
      const p = toWorld(e.clientX, e.clientY);
      // ignore the lines being dragged: their own heads and bodies sit under the
      // finger, and magnetting to them is what made a corner impossible to place
      const use = resolvePoint(p.x, p.y, { skipIds: new Set(g.heads.map((h) => h.id)) });
      if (use.snapped && !lastSnapRef.current) vibrate();
      lastSnapRef.current = use.snapped;
      const ids = new Set(g.heads.map((h) => h.id));
      setSegments((prev) =>
        prev.map((sg) => {
          if (!ids.has(sg.id)) return sg;
          const patch: Partial<Seg> = {};
          for (const h of g.heads) {
            if (h.id !== sg.id) continue;
            if (h.end === 1) { patch.x1 = use.x; patch.y1 = use.y; } else { patch.x2 = use.x; patch.y2 = use.y; }
          }
          return { ...sg, ...patch };
        })
      );
      return;
    }

    if (g.kind === 'endpoint') {
      if(completedSegIds().has(g.id)) return;
      const seg = segments.find((s) => s.id === g.id);
      if (!seg) return;
      const p = toWorld(e.clientX, e.clientY);
      const fixed = g.end === 1 ? { x: seg.x2, y: seg.y2 } : { x: seg.x1, y: seg.y1 };
      const use = resolvePoint(p.x, p.y, { skipIds: new Set([g.id]), angleFrom: fixed });
      if (use.snapped && !lastSnapRef.current) vibrate();
      lastSnapRef.current = use.snapped;
      updateSegment(g.id, g.end === 1 ? { x1: use.x, y1: use.y } : { x2: use.x, y2: use.y });
      return;
    }
    if (g.kind === 'create' && draft) {
      const p = toWorld(e.clientX, e.clientY);
      const moved = Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > MIN_MOVE;
      let use = { x: p.x, y: p.y, snapped: false };
      if (moved) {
        // head first, then edge, 45° only if nothing is near (see resolvePoint)
        use = resolvePoint(p.x, p.y, { angleFrom: { x: g.x1, y: g.y1 } });
      }
      if (use.snapped && !lastSnapRef.current) vibrate();
      lastSnapRef.current = use.snapped;
      setDraft({ x1: g.x1, y1: g.y1, x2: use.x, y2: use.y, snapped: use.snapped });
    }
  };

  const handleUp = (e?: PointerEvent) => {
    const g = press.current;
    // নিচে টেনে মোছা — পটি গরম থাকলে ছাড়লেই দাগ মুছে যায় (উইন্ডো নেই);
    // লক দাগ হলে deleteSegment নিজেই হিন্ট দেয়, মোছে না
    if (g.kind === 'moveSeg' && g.moved && deleteHotRef.current) {
      deleteSegment(g.id);
    }
    // ছাড়ার সময় চুম্বক — টানার সময় প্লট/কোনা আঙুলের সাথে হুবহু যায়
    // (চুম্বক নেই, নইলে আটকে আটকে যেত); ছাড়লেই কাছের জোড়ায় বসে +
    // ভাইব্রেট হয় (pointerup-এ ভাইব্রেট নিশ্চিত — টাচে pointerdown-এ
    // অ্যাক্টিভেশন মেলে না, pointermove-এও মেলে না; pointerup/click-এ মেলে)।
    if (g.kind === 'plotMove' && g.moved) {
      const k = unitsPerPx();
      let dx = g.lastDx ?? 0, dy = g.lastDy ?? 0;
      if (e) { dx = (e.clientX - g.sx) * k; dy = (e.clientY - g.sy) * k; }
      const ownIds = new Set<string>(g.orig.map((o) => o.id));
      const heads: { x: number; y: number }[] = [];
      for (const o of g.orig) { heads.push({ x: o.x1, y: o.y1 }); heads.push({ x: o.x2, y: o.y2 }); }
      let snapTo: { dx: number; dy: number; d: number } | null = null;
      for (const h of heads) {
        const mh = { x: h.x + dx, y: h.y + dy };
        for (const o of segments) {
          if (ownIds.has(o.id)) continue;
          for (const q of [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }]) {
            if (heads.some((hh) => Math.hypot(q.x - hh.x, q.y - hh.y) <= 2)) continue;
            const d = Math.hypot(mh.x - q.x, mh.y - q.y);
            if (d <= CORNER_PX * k && (!snapTo || d < snapTo.d)) {
              snapTo = { dx: dx + (q.x - mh.x), dy: dy + (q.y - mh.y), d };
            }
          }
        }
      }
      if (snapTo) {
        const { dx: sdx, dy: sdy } = snapTo;
        const byId = new Map<string, { id: string; x1: number; y1: number; x2: number; y2: number }>(
          g.orig.map((o) => [o.id, o] as [string, { id: string; x1: number; y1: number; x2: number; y2: number }]),
        );
        setSegments((prev) =>
          prev.map((sg) => {
            const o = byId.get(sg.id);
            if (!o) return sg;
            return { ...sg, x1: o.x1 + sdx, y1: o.y1 + sdy, x2: o.x2 + sdx, y2: o.y2 + sdy };
          })
        );
        vibrate(25);
      }
    }
    if (g.kind === 'plotCorner' && g.moved) {
      const ownIds = new Set<string>(g.orig.map((o) => o.id));
      const curCorner = cornerCurRef.current ?? g.corner;
      let px = curCorner.x, py = curCorner.y;
      if (e) { const p = toWorld(e.clientX, e.clientY); px = p.x; py = p.y; }
      // চুম্বকের লক্ষ্য খোঁজা — কোনার নিজের আসল/বর্তমান জায়গা বাদ: ভাগ করা
      // জোড়া কোনার সাথে সাথে সরে, তাই কোনার বর্তমান জায়গাটাই সবচেয়ে কাছের
      // লক্ষ্য হয়ে স্ন্যাপকে সেখানেই আটকে রাখত (ছাড়ার পরও কোনা জোড়ায়
      // বসত না)। আসল জায়গা/বর্তমান জায়গার ২ এককের ভেতরের প্রান্ত লক্ষ্য নয়।
      let best = { x: px, y: py, snapped: false, dist: CORNER_PX * unitsPerPx() };
      for (const s of segments) {
        if (ownIds.has(s.id)) continue;
        for (const q of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) {
          if (Math.hypot(q.x - g.corner.x, q.y - g.corner.y) <= 2) continue;
          if (Math.hypot(q.x - curCorner.x, q.y - curCorner.y) <= 2) continue;
          const d = Math.hypot(px - q.x, py - q.y);
          if (d < best.dist) best = { x: q.x, y: q.y, snapped: true, dist: d };
        }
      }
      if (best.snapped) {
        applyPlotCorner(g, { x: best.x, y: best.y });
        vibrate(25);
      }
    }
    if (g.kind === 'endpoint' && e) {
      const seg = segments.find((s) => s.id === g.id);
      if (seg) {
        const p = toWorld(e.clientX, e.clientY);
        const fixed = g.end === 1 ? { x: seg.x2, y: seg.y2 } : { x: seg.x1, y: seg.y1 };
        const use = resolvePoint(p.x, p.y, { skipIds: new Set([g.id]), angleFrom: fixed });
        updateSegment(g.id, g.end === 1 ? { x1: use.x, y1: use.y } : { x2: use.x, y2: use.y });
        // প্রান্ত কোনো পুরনো দাগের গায়ে পড়লে সেই দাগটা জোড়ায় ভাগ হয় (বন্টন)
        setSegments((prev) => splitSegsAt(prev, use.x, use.y, new Set([g.id])));
      }
    }
    if (g.kind === 'create' && draft) {
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) >= MIN_LEN_PX * unitsPerPx()) {
        const ns: Seg = {
          id: `seg-${Date.now()}-n`,
          x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2,
          color: activeColor,
          dashed: dividerTool === 'dotted' ? true : undefined,
        };
        setSegments((prev) => {
          // নতুন দাগের দুই প্রান্ত পুরনো দাগের গায়ে পড়লে সেগুলো জোড়ায় ভাগ হয় (বন্টন)
          let next = [...prev, ns];
          next = splitSegsAt(next, ns.x2, ns.y2, new Set([ns.id]));
          next = splitSegsAt(next, ns.x1, ns.y1, new Set([ns.id]));
          return next;
        });
        setRedoStack([]);
        // নতুন দাগ আঁকা মানে আগের মোছা ফেরানোর পালা শেষ — নইলে ↶ চাপলে
        // নতুন দাগ সরার বদলে পুরনো মোছা দাগ ফিরে আসত (ক্রম ঠিক রাখতে)
        setDeletedStack([]);
        if (dividerTool) {
          setDividerTool(null);
          setHint('নতুন প্লট তৈরি হয়েছে — বিভাজক দাগের মান বসান, খুঁটির ডট দেখুন');
          window.setTimeout(() => setHint(null), 3000);
        }
      }
    }
    // tap on a line (no drag) -> straight into the feet/inch input
    // (লক প্লটের দাগে ট্যাপ করলে মানের ঘর নয় — আনলকের হিন্ট)
    if (g.kind === 'moveSeg' && !g.moved) {
      const s2 = segments.find((s) => s.id === g.id);
      if (s2) {
        if (completedSegIds().has(s2.id)) {
          setHint('🔒 প্লট লক আছে — মান বদলাতে প্লটের 🔒 আইকনে ট্যাপ করে আনলক করুন');
          window.setTimeout(() => setHint(null), 3000);
        } else openLen(s2);
      }
    }
    press.current = { kind: 'none' };
    lastSnapRef.current = false;
    lockHintShownRef.current = false;
    cornerCurRef.current = null;
    updateDeleteZone(false, false);
    deleteHotRef.current = false;
    deleteSnapRef.current = false;
    setDraft(null);
    setTapDot(null);          // cleared immediately — no ghost ring left behind
  };

  /* ---------------- toolbar drag ---------------- */
  const tbDown = (e: PointerEvent) => {
    e.stopPropagation();
    toolbarDrag.current = { dx: e.clientX - toolbarPos.x, dy: e.clientY - toolbarPos.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const tbMove = (e: PointerEvent) => {
    if (!toolbarDrag.current || !wrapperRef.current || !toolbarRef.current) return;
    const wr = wrapperRef.current.getBoundingClientRect();
    const tr = toolbarRef.current.getBoundingClientRect();
    setToolbarPos({
      x: Math.max(0, Math.min(e.clientX - toolbarDrag.current.dx, wr.width - tr.width)),
      y: Math.max(0, Math.min(e.clientY - toolbarDrag.current.dy, wr.height - tr.height)),
    });
  };
  const tbUp = () => { toolbarDrag.current = null; setDragging(false); };

  /* ---------------- editors ---------------- */
  const openLen = (s: Seg) => {
    const ft = s.lengthFt ?? 0;
    const f = Math.floor(ft);
    const i = Math.round((ft - f) * 12);
    setLenInput({ f: ft === 0 ? '' : String(f), i: ft === 0 ? '' : String(i) });
    setSelectedId(s.id);
    setMenu({ kind: 'len', id: s.id });
  };
  useEffect(() => {
    if (menu?.kind === 'len') {
      const t = window.setTimeout(() => feetRef.current?.select(), 60);
      return () => window.clearTimeout(t);
    }
  }, [menu]);

  /**
   * Feet/inch entry is a RECORD only: it stores the number and never reshapes the
   * line, so a finished plot stops jumping around while you type.
   */
  const applyLenLive = (id: string, f: string, i: string) => {
    const ft = toFeet(f, i);
    if (ft === undefined || ft <= 0) return;
    updateSegment(id, { lengthFt: ft });
  };

  /* বিভাজক টুল বাছাই — একই টুলে আবার ট্যাপ করলে বন্ধ হয় (টগল) */
  const pickDividerTool = (t: 'solid' | 'dotted') => {
    const next = dividerTool === t ? null : t;
    setDividerTool(next);
    if (next) {
      setHint(`${next === 'solid' ? 'সোজা' : 'ডটেড'} দাগ: প্লটের এক কিনারা থেকে আরেক কিনারায় টানুন`);
      window.setTimeout(() => setHint(null), 3500);
    } else setHint(null);
  };

  const sel = segments.find((s) => s.id === selectedId) || null;

  /* বাহুর মানের লেবেলের জায়গা — সরু প্লটে দুটো লেবেল জড়িয়ে যায় বলে
     layoutSideLabels দিয়ে জায়গা ঠিক করা হয় (উল্টো পাশে / সরিয়ে)।
     প্লটের নাম/শতক কার্ডও (চিপ) বাধা হিসেবে দেওয়া হয় — লেবেল যেন
     কার্ডের ওপর না পড়ে (২৪ নভেম্বর রেকর্ডিং: ভেতরের 23′ 0″ লেবেল
     চিপের গায়ে জড়িয়ে পড়া যেত না)। কার্ড সরালে/বড় করলেও লেবেল সরে। */
  const labelPos = useMemo(() => {
    const items: LabelItem[] = [];
    for (const s of segments) {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
      if (s.lengthFt !== undefined) {
        const txt = ftIn(s.lengthFt);
        // খাড়া বাহুর লেবেল দাগ বরাবর (৯০° ঘোরানো) বসে — তাই জায়গার হিসাবে
        // চওড়া/উঁচু উল্টো: ঘোরানো লেবেলের বাক্স সরু (১৩) কিন্তু লম্বা
        const vertical = Math.abs(dy) > Math.abs(dx);
        const tw = vertical ? 13 : txt.length * 6 + 12;
        const th = vertical ? txt.length * 6 + 12 : 13;
        items.push({ id: `len:${s.id}`, mx, my, ox: (-dy / len) * 11, oy: (dx / len) * 11, ux, uy, tw, th });
      }
      if (s.label) {
        items.push({ id: `txt:${s.id}`, mx, my, ox: (dy / len) * 13, oy: (-dx / len) * 13, ux, uy, tw: s.label.length * 6 + 12, th: 13 });
      }
    }
    // চিপ কার্ডের বাক্স — রেন্ডারে যে (cardX, cardY, w, h) বসে ঠিক সেটাই
    const chips = polygonsMemo
      .filter((poly) => plotMeta(poly.id).style !== 'plain')
      .map((poly) => {
        const meta = plotMeta(poly.id);
        const area = plotArea(poly);
        const hasName = !!(meta.title && meta.title.trim());
        const hasDag = !!(meta.dagNo || area || hasName);
        const hasArea = !!area;
        const { w, h } = boxSize(meta, hasName, hasDag, hasArea);
        return { cx: poly.cx + (meta.dx ?? 0), cy: poly.cy + (meta.dy ?? 0), tw: w, th: h };
      });
    return layoutSideLabels(items, { w: W, h: viewH }, chips);
  }, [segments, viewH, polygonsMemo, plotMetas]);

  /* মোট শতক — হিসাব আছে এমন সব প্লটের যোগফল, মান বদলালে নিজে থেকে বদলায় */
  const totalAreas = polygonsMemo.map((pl) => plotArea(pl)).filter((a): a is NonNullable<ReturnType<typeof plotArea>> => !!a);
  const totalDecimal = totalAreas.reduce((s, a) => s + a.decimal, 0);

  /* ---------------- render ---------------- */
  return (
    <div className="relative overflow-visible touch-none" ref={wrapperRef} style={{ overscrollBehavior: 'none' }} onPointerMove={dragging ? tbMove : undefined} onPointerUp={dragging ? tbUp : undefined} onPointerCancel={dragging ? tbUp : undefined}>
      {/* ---------- small translucent dial ---------- */}
      <div
        ref={toolbarRef}
        className="absolute z-20 select-none"
        style={{ left: toolbarPos.x, top: toolbarPos.y, transformOrigin: 'top left', transform: dragging ? 'scale(1.1)' : 'none' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            onPointerDown={(e) => { e.stopPropagation(); tbDown(e); }}
            className="w-12 h-12 rounded-full bg-emerald-900/80 backdrop-blur text-white shadow-md flex items-center justify-center text-lg touch-none active:scale-95"
            aria-label="টুল"
          >
            ⠿
          </button>
        ) : (
          <div className="rounded-xl bg-white/75 backdrop-blur-md border border-slate-300/80 shadow-lg p-0.5">
            <div className="grid grid-cols-4 gap-0.5 w-[12.5rem] text-[10px] font-semibold leading-none">
              <button onClick={undo} disabled={!segments.length && !deletedStack.length} className="h-11 rounded-lg bg-white/70 text-slate-800 flex flex-col items-center justify-center gap-0.5 disabled:opacity-70 disabled:bg-slate-100"><span className="text-base leading-none">↶</span><span>ফেরান</span></button>
              <button onClick={redo} disabled={!redoStack.length} className="h-11 rounded-lg bg-white/70 text-slate-800 flex flex-col items-center justify-center gap-0.5 disabled:opacity-70 disabled:bg-slate-100"><span className="text-base leading-none">↷</span><span>আবার</span></button>
              <button onClick={() => { if (sel) deleteSegment(sel.id); }} disabled={!sel} className="h-11 rounded-lg bg-rose-50/80 text-rose-700 flex flex-col items-center justify-center gap-0.5 disabled:opacity-70 disabled:bg-slate-100"><span className="text-base leading-none">🗑</span><span>মুছুন</span></button>
              <button
                onClick={() => setOpen(false)}
                className="h-11 rounded-lg bg-slate-800/85 text-white flex flex-col items-center justify-center gap-0.5"
                title="টুলবার বন্ধ করুন"
                aria-label="টুলবার বন্ধ করুন"
              ><span className="text-base leading-none">✕</span><span>বন্ধ</span></button>

              <button onClick={() => { if (sel) { setLabelInput(sel.label ?? ''); setLabelColor(sel.color || activeColor); setMenu({ kind: 'label', id: sel.id }); } else { setHint('আগে একটা দাগে ট্যাপ করুন, তারপর Aa চাপুন।'); window.setTimeout(() => setHint(null), 3000); } }} className="h-11 rounded-lg bg-sky-50/80 text-sky-900 flex flex-col items-center justify-center gap-0.5 disabled:opacity-70"><span className="text-base leading-none">Aa</span><span>লেখা</span></button>
              <button onClick={handleComplete} className="h-11 rounded-lg bg-blue-600 text-white flex flex-col items-center justify-center gap-0.5 shadow" title="ড্রয়িং কমপ্লিট ✓"><span className="text-base leading-none">✓</span><span>সম্পন্ন</span></button>
              <button
                onClick={() => setColorsOpen((v) => !v)}
                className={`h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 ${colorsOpen ? 'bg-emerald-100 ring-1 ring-emerald-700' : 'bg-white/70'}`}
                title="রঙ — ট্যাপ করলে রঙের তালিকা খুলবে"
                aria-label="রঙ"
              >
                <span className="w-6 h-6 rounded-full border border-white shadow" style={{ background: activeColor }} />
                <span>রঙ</span>
              </button>
              <button
                onClick={() => {
                  if (segments.length && window.confirm('সব দাগ মুছে নতুন করে শুরু করবেন?')) {
                    localStorage.removeItem(STORAGE_KEY);
                    setSegments([]); setRedoStack([]); setDeletedStack([]); setSelectedId(null); setMenu(null); setPlotMetas([]);
                  }
                }}
                className="h-11 rounded-lg bg-white/70 text-slate-600 flex flex-col items-center justify-center gap-0.5"
                title="সব মুছে ফেলুন"
              ><span className="text-base leading-none">⟳</span><span>সব মুছুন</span></button>
            </div>

            {/* বিভাজক দাগ — তৈরি প্লটের ওপর টেনে ভাগ করুন (প্রিভিউ ২০, ঠিক ৪) */}
            <div className="grid grid-cols-2 gap-0.5 pt-0.5 text-[10px] font-semibold leading-none">
              <button
                onClick={() => pickDividerTool('solid')}
                className={`h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 ${dividerTool === 'solid' ? 'bg-emerald-700 text-white shadow' : 'bg-white/70 text-slate-700'}`}
                title="সোজা দাগ — তৈরি প্লটের এক কিনারা থেকে আরেক কিনারায় টানুন"
              >
                <span className="block w-[3px] h-[16px] bg-current rounded-full" />
                <span>সোজা দাগ</span>
              </button>
              <button
                onClick={() => pickDividerTool('dotted')}
                className={`h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 ${dividerTool === 'dotted' ? 'bg-emerald-700 text-white shadow' : 'bg-white/70 text-slate-700'}`}
                title="ডটেড দাগ — তৈরি প্লটের এক কিনারা থেকে আরেক কিনারায় টানুন"
              >
                <span className="block w-[3px] h-[16px] border-l-[3px] border-dotted border-current" />
                <span>ডটেড দাগ</span>
              </button>
            </div>

            {/* রঙের তালিকা বন্ধ থাকে; রঙের আইকনে ট্যাপ করলে খোলে */}
            {colorsOpen && (
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setActiveColor(c);
                      // recolor the selected line too, and any label on it, so the change is visible at once
                      if (sel) updateSegment(sel.id, { color: c });
                    }}
                    className={`h-11 rounded-xl flex items-center justify-center ${activeColor === c ? 'ring-2 ring-slate-900 bg-slate-100' : 'bg-white/70'}`}
                    aria-label={c}
                  >
                    <span className="w-6 h-6 rounded-full border border-white shadow-sm" style={{ background: c }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {hint && (
        // মোট বার দেখা গেলে হিন্ট বারটার ওপরে ওঠে — নইলে বার ঢেকে যেত
        <div className={`absolute z-30 left-1/2 -translate-x-1/2 ${totalAreas.length > 0 ? 'bottom-[2.9rem]' : 'bottom-2'} w-[92%] max-w-sm rounded-xl bg-slate-900/85 backdrop-blur text-white text-[10px] leading-snug px-2.5 py-1.5 shadow-lg`}>
          {hint}
        </div>
      )}

      {/* ---------- canvas ---------- */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${viewH}`}
        preserveAspectRatio="none"
        className="w-full bg-white touch-none border border-slate-300 rounded-xl block"
        // svg উচ্চতা: চিত্র ট্যাবে হেডার লুকানো থাকায় অফসেট (৩.৪rem) দিলে svg ~৫১০px হয় —
        // নিচের মোট বারও নেভিগেশনের ওপরে দেখা যায়, আবার পুরো নকশাও ধরে
        style={{ height: 'calc(100dvh - 13.5rem - var(--fa-canvas-offset, 0px))', minHeight: '15rem' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={(e) => handleUp(e)}
        onPointerCancel={(e) => handleUp(e)}
        onPointerLeave={() => setTapDot(null)}
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* north indicator — on the canvas, top-right (৪৮px-এর কাছাকাছি ট্যাপ-আকার) */}
        <g>
          <circle cx={W - 28} cy={32} r={20} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1={W - 28} y1={44} x2={W - 28} y2={20} stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${W - 33} 27 L ${W - 28} 16 L ${W - 23} 27 Z`} fill="#0f172a" />
          <text x={W - 28} y={40} fontSize="10" textAnchor="middle" fill="#0f172a" fontWeight="700">N</text>
        </g>

        {/* খালি ক্যানভাসে নির্দেশনা — আঁকা শুরু হলে নিজে থেকে চলে যায় */}
        {segments.length === 0 && !draft && (
          <g>
            <text x={W / 2} y={viewH / 2 - 8} fontSize="16" textAnchor="middle" fill="#94a3b8" fontWeight="700">প্রথম বিন্দুতে ট্যাপ করুন</text>
            <text x={W / 2} y={viewH / 2 + 14} fontSize="13" textAnchor="middle" fill="#cbd5e1" fontWeight="600">ট্যাপ করে করে প্লটের কোণা বসান</text>
          </g>
        )}

        {polygonsMemo.map((poly)=>{
          const meta=plotMeta(poly.id);
          const area=plotArea(poly);
          const isDone= !!meta.completed;
          const cardX=poly.cx + (meta.dx ?? 0);
          const cardY=poly.cy + (meta.dy ?? 0);
          const rawName=(meta.title||'').trim();
          const nameLines:string[]=[];
          if(rawName){
            const words=rawName.split(/\s+/);
            let cur='';
            for(const wd of words){
              const test=(cur? cur+' '+wd : wd);
              if(test.length>14 && cur){ nameLines.push(cur); cur=wd; if(nameLines.length>=2) { cur = words.slice(words.indexOf(wd)).join(' '); break; } }
              else cur=test;
            }
            if(cur) nameLines.push(cur);
            if(nameLines.length>2){ nameLines[1]=nameLines.slice(1).join(' '); nameLines.length=2; if(nameLines[1].length>16) nameLines[1]=nameLines[1].slice(0,16)+'…'; }
          }
          const hasName=nameLines.length>0;
          const hasArea=!!area;
          const plotIdx = polygonsMemo.findIndex(pp=> pp.id===poly.id) + 1;
          const autoPlot = `প্লট ${plotIdx}`;
          const dagTxt= meta.dagNo ? `দাগ ${meta.dagNo}` : ((hasArea || hasName) ? autoPlot : '');
          const decTxt= area ? `${area.decimal.toFixed(2)} শতক` : ''; 
          const hasDag=!!dagTxt;
          const {w, h}=boxSize(meta, hasName, hasDag, hasArea);
          return (
            <g key={`plot-${poly.id}`}>
              <polygon
                points={poly.pts.map(q=> `${q.x},${q.y}`).join(' ')}
                fill={isDone ? (meta.color || poly.color) : '#e2e8f0'}
                fillOpacity={isDone ? 0.18 : 0.10}
                stroke={isDone ? (meta.color||poly.color) : '#94a3b8'}
                strokeWidth={isDone ? 1.2 : 0.6}
                strokeDasharray={isDone ? '4 3' : undefined}
                pointerEvents="none"
              />
              {/* লক আইকন — ৪ বাহুর মান থাকলে দেখায়; ট্যাপে লক/আনলক (প্রিভিউ ২০, ঠিক ৭) */}
              {poly.sidesFt.filter((v) => typeof v === 'number' && v > 0).length >= 4 && (
                <g
                  onPointerDown={(e) => { e.stopPropagation(); toggleLock(poly.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={cardX} cy={cardY - h / 2 - 12} r={10} fill="#ffffff" stroke={isDone ? '#065f46' : '#94a3b8'} strokeWidth={1.2} />
                  <text x={cardX} y={cardY - h / 2 - 8.5} fontSize={10} textAnchor="middle" pointerEvents="none">{isDone ? '🔒' : '🔓'}</text>
                </g>
              )}
              <g onPointerDown={cardDown(poly.id)} onPointerMove={cardMove} onPointerUp={cardUp} style={{cursor:'move'}}>
                {meta.style!=='plain' && (
                  <rect x={cardX-w/2} y={cardY-h/2} width={w} height={h} rx={5}
                    fill={meta.color || '#ffffff'} fillOpacity={meta.color ? 0.14 : 0.96} stroke={meta.color||'#0f766e'} strokeWidth={0.9} />
                )}
                {hasArea ? (
                  <>
                    {nameLines.map((ln,i)=> (<text key={i} x={cardX} y={cardY - h/2 + 10 + i*9} fontSize={8.5} textAnchor="middle" fontWeight="700" fill={meta.titleColor||'#1e293b'} pointerEvents="none">{ln}</text>))}
                    {hasDag && (<text x={cardX} y={cardY - h/2 + 10 + nameLines.length*9} fontSize={7.5} textAnchor="middle" fontWeight="600" fill="#334155" pointerEvents="none">{dagTxt}</text>)}
                    <text x={cardX} y={cardY + h/2 - 5} fontSize={8.5} textAnchor="middle" fontWeight="700" fill={meta.color||'#0f766e'} pointerEvents="none">{decTxt}</text>
                  </>
                ) : hasName || hasDag ? (
                  <>
                    {nameLines.map((ln,i)=> (<text key={i} x={cardX} y={cardY - h/2 + 10 + i*9} fontSize={8.5} textAnchor="middle" fontWeight="700" fill={meta.titleColor||'#1e293b'} pointerEvents="none">{ln}</text>))}
                    {hasDag && (<text x={cardX} y={cardY - h/2 + 10 + nameLines.length*9} fontSize={7.5} textAnchor="middle" fontWeight="600" fill="#334155" pointerEvents="none">{dagTxt}</text>)}
                    {!hasArea && (<text x={cardX} y={cardY + h/2 - 4} fontSize={6.5} textAnchor="middle" fill="#94a3b8" pointerEvents="none">{'—'}</text>)}
                  </>
                ) : (
                  <text x={cardX} y={cardY+3} fontSize={7} textAnchor="middle" fill="#64748b" pointerEvents="none">{'চার বাহুর দৈর্ঘ্য'}</text>
                )}
                {/* corner handle: drag to resize - large hit area to avoid mistouch */}
                <g onPointerDown={resizeDown(poly.id)} onPointerMove={resizeMove} onPointerUp={resizeUp} style={{cursor:'nwse-resize'}}>
                  <rect x={cardX + w/2 - 12} y={cardY + h/2 - 12} width={22} height={22} rx={4} fill="#ffffff" fillOpacity={0.01} stroke="none" />
                  <rect x={cardX + w/2 - 6} y={cardY + h/2 - 6} width={10} height={10} rx={2} fill="#ffffff" stroke={meta.color||'#0f766e'} strokeWidth={1} />
                  <path d={`M ${cardX + w/2 - 3} ${cardY + h/2 - 1} L ${cardX + w/2 -1} ${cardY + h/2 -3} M ${cardX + w/2 -2} ${cardY + h/2 +1} L ${cardX + w/2 +1} ${cardY + h/2 -2}`} stroke={meta.color||'#0f766e'} strokeWidth={0.9} strokeLinecap="round" fill="none" />
                </g>
              </g>
            </g>
          );
        })}

        {segments.map((s) => (
          <g key={s.id}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke={s.color || '#065f46'}
              strokeWidth={selectedId === s.id ? 4 : 3} strokeLinecap="round"
              strokeDasharray={s.dashed ? '7 6' : undefined} />
            {s.lengthFt !== undefined && (() => {
              // শোয়া বাহুর লেবেল শোয়া, খাড়া বাহুর লেবেল দাগ বরাবর ৯০° ঘোরানো
              // (নিচ থেকে ওপরে পড়া যায়) — সাদা পিল পেছনে, জায়গা layoutSideLabels থেকে
              const txt = ftIn(s.lengthFt);
              const vertical = Math.abs(s.y2 - s.y1) > Math.abs(s.x2 - s.x1);
              const tw = vertical ? 13 : txt.length * 6 + 12, th = vertical ? txt.length * 6 + 12 : 13;
              const lp = labelPos.get(`len:${s.id}`);
              const cx = lp ? lp.cx : (s.x1 + s.x2) / 2;
              const cy = lp ? lp.cy : (s.y1 + s.y2) / 2;
              return (
                <g pointerEvents="none">
                  <rect x={cx - tw/2} y={cy - th/2 + 1} width={tw} height={th} rx={6}
                    fill="#ffffff" fillOpacity={0.96} stroke={s.color || '#065f46'} strokeOpacity={0.18} />
                  <text x={cx} y={cy+3.5} fontSize={10}
                    fill={s.color || '#065f46'} textAnchor="middle" fontWeight="700" style={{ userSelect: 'none' }}
                    transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>{txt}</text>
                </g>
              );
            })()}
            {s.label && (() => {
              const tw= s.label.length*6+12, th=13;
              const lp = labelPos.get(`txt:${s.id}`);
              const cx = lp ? lp.cx : (s.x1 + s.x2) / 2;
              const cy = lp ? lp.cy : (s.y1 + s.y2) / 2;
              return (
                <g pointerEvents="none">
                  <rect x={cx - tw/2} y={cy - th/2 + 1} width={tw} height={th} rx={6}
                    fill="#ffffff" fillOpacity={0.92} stroke={s.color || '#065f46'} strokeOpacity={0.14} />
                  <text x={cx} y={cy+3.5} fontSize={10}
                    fill={s.color || '#065f46'} textAnchor="middle" fontWeight="600" style={{ userSelect: 'none' }}>{s.label}</text>
                </g>
              );
            })()}
          </g>
        ))}

        {/* খুঁটি — প্রতিটি জোড়া/কোনায় ডট (প্রিভিউ ২০, ঠিক ২) */}
        {(() => {
          const seen = new Set<string>();
          const dots: { x: number; y: number }[] = [];
          for (const s of segments) {
            for (const p of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) {
              const k = `${Math.round(p.x)},${Math.round(p.y)}`;
              if (seen.has(k)) continue;
              seen.add(k);
              dots.push(p);
            }
          }
          return dots.map((d, i) => (
            <circle key={`kh-${i}`} cx={d.x} cy={d.y} r={3.5} fill="#065f46" stroke="#ffffff" strokeWidth={1} pointerEvents="none" />
          ));
        })()}

        {tapDot && (
          <circle key={tapDot.id} cx={tapDot.x} cy={tapDot.y} r="10" fill="none" stroke="#f59e0b" strokeWidth="2" pointerEvents="none" opacity="0">
            <animate attributeName="r" from="4" to="16" dur="0.35s" begin="0s" fill="freeze" />
            <animate attributeName="opacity" from="0.85" to="0" dur="0.35s" begin="0s" fill="freeze" />
          </circle>
        )}

        {draft && (
          <>
            <line x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} stroke="#065f46" strokeWidth="3" strokeDasharray={dividerTool === 'dotted' ? '7 6' : '4'} strokeLinecap="round" />
            {draft.snapped && <circle cx={draft.x2} cy={draft.y2} r="5" fill="none" stroke="#f59e0b" strokeWidth="2" />}
          </>
        )}
      </svg>

      {/* ---------- নিচে টেনে মোছার পটি — দাগ নিচে টানলেই দেখা যায় ---------- */}
      {deleteZone.active && (
        <div
          className={`absolute left-2 right-2 z-30 h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg pointer-events-none transition-all ${
            deleteZone.hot
              ? 'bg-red-600 text-white scale-[1.02] ring-2 ring-red-300'
              : 'bg-rose-500/95 text-white'
          }`}
          style={{ bottom: totalAreas.length > 0 ? 46 : 8 }}
        >
          <span className="text-xl leading-none">🗑</span>
          <span className="text-[15px] font-bold">
            {deleteZone.hot ? 'ছেড়ে দিন — দাগটা মুছে যাবে' : 'এখানে ছাড়লে মুছে যাবে'}
          </span>
        </div>
      )}

      {/* ---------- মোট শতক — সব প্লটের যোগফল, মান বদলালে নিজে থেকে বদলায় ---------- */}
      {totalAreas.length > 0 && (
        <div className="mt-1 rounded-lg bg-emerald-900 text-white px-3 py-1.5 flex items-center justify-between shadow">
          <span className="text-[13px] font-semibold">মোট {totalAreas.length}টি প্লট</span>
          <span className="text-[16px] font-bold">{totalDecimal.toFixed(2)} শতক</span>
        </div>
      )}

      {/* ---------- feet / inch input: tiny, translucent, saves as you type ---------- */}
      {menu?.kind === 'len' && sel && (
        <div className="absolute right-1 top-1 z-30 rounded-lg bg-white/70 backdrop-blur border border-slate-300/80 shadow px-1 py-0.5"
             onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5">
            <input
              ref={feetRef}
              inputMode="decimal"
              value={lenInput.f}
              onChange={(e) => { const v = e.target.value; setLenInput({ ...lenInput, f: v }); applyLenLive(sel.id, v, lenInput.i); }}
              onFocus={(e) => e.target.select()}
              placeholder="ফুট"
              className="w-10 h-7 rounded border border-slate-300/80 bg-white/80 px-0.5 text-center text-[12px]"
            />
            <span className="text-[9px] text-slate-500">′</span>
            <input
              inputMode="decimal"
              value={lenInput.i}
              onChange={(e) => { const v = e.target.value; setLenInput({ ...lenInput, i: v }); applyLenLive(sel.id, lenInput.f, v); }}
              onFocus={(e) => e.target.select()}
              placeholder="ইঞ্চি"
              className="w-10 h-7 rounded border border-slate-300/80 bg-white/80 px-0.5 text-center text-[12px]"
            />
            <span className="text-[9px] text-slate-500">″</span>
            <button onClick={() => { applyLenLive(sel.id, lenInput.f, lenInput.i); setMenu(null); }} className="h-7 px-2 rounded bg-blue-600 text-white text-[11px] font-bold shadow" title="মাপ বসান">✓ সম্পন্ন</button>
            {/* বাড়তি/অনাথ দাগ এক ট্যাপে মোছা — লক প্লটের দাগ হলে
               deleteSegment নিজেই আনলকের হিন্ট দেয়, মুছে না */}
            <button onClick={() => { if (sel) deleteSegment(sel.id); }} className="h-7 px-2 rounded bg-rose-600 text-white text-[11px] font-bold shadow" title="এই দাগটা মুছুন">🗑 মুছুন</button>
            <button onClick={() => setMenu(null)} className="w-6 h-7 rounded text-[11px] font-bold text-slate-500">✕</button>
          </div>
        </div>
      )}

      {/* ---------- plot editor ---------- */}
      {menu?.kind==='plot' && (()=>{
        const m=plotMeta(menu.id);
        return (
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 z-40 w-[94%] max-w-xs rounded-xl bg-white/95 backdrop-blur border border-slate-300 shadow-lg p-1.5" onPointerDown={e=> e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <input value={plotInput} onChange={e=> setPlotInput(e.target.value)} placeholder="প্লট / মালিকের নাম" onFocus={e=> e.target.select()} className="flex-1 h-8 rounded-lg border border-slate-300 px-2 text-sm" autoFocus />
              <input value={dagInput} onChange={e=> setDagInput(e.target.value)} placeholder="দাগ নং" onFocus={e=> e.target.select()} className="w-20 h-8 rounded-lg border border-slate-300 px-2 text-sm text-center" />
              <button onClick={()=>{ setPlotMeta(menu.id,{title: plotInput.trim()||undefined, dagNo: dagInput.trim()||undefined}); setMenu(null); }} className="h-8 px-3 rounded-lg bg-emerald-900 text-white text-[11px] font-semibold">সেভ</button>
              <button onClick={()=> setMenu(null)} className="h-8 w-7 rounded-lg bg-slate-100 text-[12px] font-bold text-slate-500">✕</button>
            </div>
            <div className="flex items-center gap-1 pt-1.5">
              <span className="text-[9px] font-semibold text-slate-500">বক্স</span>
              {(['plain','box','solid'] as const).map(st=>(
                <button key={st} onClick={()=> setPlotMeta(menu.id,{style:st})}
                  className={`h-7 px-1.5 rounded-md text-[9px] font-semibold border ${(m.style||'box')===st ? 'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-300'}`}>{st==='plain'?'নেই':st==='box'?'বক্স':'ভরা'}</button>
              ))}
              <span className="text-xs font-semibold text-slate-500 pl-1">রঙ</span>
              <div className="flex items-center gap-0.5 overflow-x-auto">
                {COLORS.map(c=>(
                  <button key={c} onClick={()=> setPlotMeta(menu.id,{color:c})}
                    className={`w-4 h-4 rounded-full shrink-0 ${(m.color||'')===c?'ring-2 ring-slate-900 ring-offset-1':'border border-white'}`} style={{background:c}}/>
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-500 pt-1 leading-snug">ভেতরে ট্যাপ = রঙ · কার্ড টানুন = সরানো</div>
          </div>
        );
      })()}

      {/* ---------- text editor ---------- */}
      {menu?.kind === 'label' && sel && (
        <div className="absolute left-1/2 -translate-x-1/2 top-1.5 z-30 w-[92%] max-w-xs rounded-xl bg-white/92 backdrop-blur border border-slate-300 shadow-lg p-1.5"
             onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <input value={labelInput} onChange={(e) => setLabelInput(e.target.value)} placeholder="নাম / লেখা" className="flex-1 h-8 rounded-lg border border-slate-300 px-2 text-sm" autoFocus />
            <button onClick={() => { updateSegment(sel.id, { label: undefined }); setMenu(null); }} className="h-8 px-2 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-600">মুছুন</button>
            <button onClick={() => { updateSegment(sel.id, { label: labelInput.trim() || undefined, color: labelColor }); setMenu(null); }} className="h-8 px-3 rounded-lg bg-emerald-900 text-white text-[11px] font-semibold">সেভ</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawingCanvas;