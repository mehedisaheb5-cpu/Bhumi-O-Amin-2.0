import React, { useState, useRef, useEffect, useMemo, PointerEvent } from 'react';
import { DrawingSegment, Language, PlotMeta } from '../../types';
import notoBengaliFontUrl from '../../assets/fonts/NotoSansBengali-Bengali.woff2?url';
import notoLatinFontUrl from '../../assets/fonts/NotoSansBengali-Latin.woff2?url';

/* ---------- fixed canvas ---------- */
const W = 400;            // logical width; height is derived from the real box so 1 unit is square
const CORNER_PX = 20;     // screen px: exact corner-to-corner join (tight, so it never "jumps far")
const EDGE_PX = 12;       // screen px: landing on the body of an existing line
const HIT_PX = 18;        // screen px around a line that counts as "tapped the line" (was 30: it stole presses inside a plot)
const END_PX = 16;        // screen px around an endpoint handle
const HANDLE_R = 6;       // endpoint dot radius (canvas units) — small so it hides nothing
const MIN_LEN_PX = 16;    // shorter than this is a tap, not a new line
const MIN_MOVE = 9;       // screen px before a press becomes a drag
const ANGLE_STEP = 45;
const ANGLE_TOL = 10;

const STORAGE_KEY = 'bhumi_possession_drawing_v1';

const COLORS = ['#065f46', '#b45309', '#1d4ed8', '#7e22ce', '#be123c', '#0f766e', '#4d7c0f', '#334155'];

type Menu = { kind: 'len'; id: string } | { kind: 'label'; id: string } | { kind: 'plot'; id: string } | null;
type Plot = { id: string; pts: { x:number; y:number }[]; sidesFt:(number|undefined)[]; cx:number; cy:number; color:string };
type Seg = DrawingSegment & { color?: string };

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

export const DrawingCanvas: React.FC<{ lang?: Language }> = ({ lang }) => {
  const [segments, setSegments] = useState<Seg[]>([]);
  const [restored, setRestored] = useState(false);
  const [redoStack, setRedoStack] = useState<Seg[]>([]);
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
  const cardDrag = useRef<{ id:string; sx:number; sy:number; ox:number; oy:number; moved:boolean }|null>(null);
  const resizeDrag = useRef<{ id:string; sx:number; sy:number; sw:number; sh:number }|null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const feetRef = useRef<HTMLInputElement>(null);
  const lastSnapRef = useRef(false);
  const toolbarDrag = useRef<{ dx: number; dy: number } | null>(null);
  const press = useRef<
    | { kind: 'none' }
    | { kind: 'create'; sx: number; sy: number; x1: number; y1: number }
    | { kind: 'moveSeg'; id: string; sx: number; sy: number; pts: [number, number, number, number]; moved: boolean }
    | { kind: 'endpoint'; id: string; end: 1 | 2 }
    | { kind: 'corner'; heads: { id: string; end: 1 | 2 }[]; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  >({ kind: 'none' });

  /** walks closed rings — one ring = one plot. Handles shared sides (adjacent plots). Memoized for 60fps */
  const polygonsMemo = useMemo<Plot[]>(() => {
    const key = (p:{x:number;y:number})=>`${Math.round(p.x)},${Math.round(p.y)}`;
    const seen=new Set<string>();
    const out: Plot[]=[];
    const adj=new Map<string,Seg[]>();
    for(const sg of segments){ for(const pt of [{x:sg.x1,y:sg.y1},{x:sg.x2,y:sg.y2}]){ const k=key(pt); const a=adj.get(k)||[]; a.push(sg); adj.set(k,a);} }
    // try every segment as start, both directions, DFS up to 4 edges (quadrilateral plots)
    for(const start of segments){
      for(const dir of [0,1] as const){
        const startPt = dir===0 ? {x:start.x1,y:start.y1} : {x:start.x2,y:start.y2};
        const firstPt = dir===0 ? {x:start.x2,y:start.y2} : {x:start.x1,y:start.y1};
        const startKey=key(startPt);
        const dfs=(curKey:string, prev:Seg, segIds:string[], sides:(number|undefined)[], pts:{x:number;y:number}[])=>{
          if(segIds.length===4){
            if(curKey===startKey){
              const pid=segIds.slice().sort().join('|');
              if(seen.has(pid)) return;
              seen.add(pid);
              const uniq=pts.slice(0,4);
              const cx=uniq.reduce((a,q)=>a+q.x,0)/uniq.length;
              const cy=uniq.reduce((a,q)=>a+q.y,0)/uniq.length;
              out.push({ id:pid, pts: uniq, sidesFt: sides.slice(), cx, cy, color: start.color||'#065f46' });
            }
            return;
          }
          if(segIds.length>4) return;
          const candList=adj.get(curKey)||[];
          for(const nxt of candList){
            if(nxt===prev) continue;
            if(segIds.includes(nxt.id)) continue;
            const a=key({x:nxt.x1,y:nxt.y1}), b=key({x:nxt.x2,y:nxt.y2});
            if(a!==curKey && b!==curKey) continue;
            const to=a===curKey? b: a;
            const apt=a===curKey? {x:nxt.x2,y:nxt.y2}:{x:nxt.x1,y:nxt.y1};
            // prune: if closing early with too few edges, skip
            if(to===startKey && segIds.length!==3) continue;
            if(to!==startKey && segIds.length===3) {
              // last step must close, so if nxt doesn't close, skip
              // allow only if this nxt would close on next step? Actually we need 4 edges, so at segIds 3, nxt is 4th, must close
              if(to!==startKey) continue;
            }
            dfs(to, nxt, [...segIds, nxt.id], [...sides, nxt.lengthFt], [...pts, apt]);
          }
        };
        dfs(key(firstPt), start, [start.id], [start.lengthFt], [startPt, firstPt]);
      }
    }
    // also allow plots that were drawn with extra colinear splits (5-6 edges) – keep those too if no 4-cycle found
    if(out.length===0){
      // fallback: try up to 6 edges with greedy (for irregular plots)
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
  const snapCorner = (x: number, y: number, skipIds?: Set<string>) => {
    let best = { x, y, snapped: false, dist: CORNER_PX * unitsPerPx() };
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
      if (a.snapped) return a;
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

  const vibrate = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(12);
  };

  /* ---------------- mutations ---------------- */
  const addSegment = (s: Omit<Seg, 'id'>) => {
    setSegments((prev) => [...prev, { ...s, id: `seg-${Date.now()}-${prev.length}` }]);
    setRedoStack([]);
  };
  const updateSegment = (id: string, patch: Partial<Seg>) =>
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const deleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setMenu(null);
  };
  const undo = () => {
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
    setSegments([...segments, next]);
    setRedoStack(r);
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

  /* ---------------- pointer flow ---------------- */
  const handleDown = (e: PointerEvent) => {
    if(resizeDrag.current || cardDrag.current) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    // color fill: tapping inside a plot paints it with the active toolbar colour
    const hit=hitPlotAt(p.x, p.y);
    if(hit && !plotMeta(hit.id).completed){
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

    // Line body first (30px), endpoint handles second (16px):
    // otherwise the corner zone steals the drag and a line can never be moved
    // when it is short or when you grab it near its end.
    const seg = findSegment(p.x, p.y);
    const ep = findEndpoint(p.x, p.y);

    const _lockedIds=completedSegIds();
    if (ep && _lockedIds.has(ep.s.id)) { /* locked plot corner - ignore */ } else if (ep && (!seg || ep.s.id === seg.id) && Math.hypot(p.x - (ep.end === 1 ? ep.s.x1 : ep.s.x2), p.y - (ep.end === 1 ? ep.s.y1 : ep.s.y2)) < END_PX * unitsPerPx() * 0.7) {
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
    if (g.kind === 'moveSeg') {
      const _lk2=completedSegIds();
      if(_lk2.has(g.id)){
        if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < MIN_MOVE) return;
        // locked: don't move, but mark moved to avoid opening editor? Actually keep as tap
        return;
      }
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < MIN_MOVE) return;
      g.moved = true;
      const k = unitsPerPx();
      let dx = (e.clientX - g.sx) * k, dy = (e.clientY - g.sy) * k;
      // magnet: whichever head ends up nearest another line's head lands exactly on it,
      // so a moved line can be clicked into a free corner instead of "almost" there
      const heads = [{ x: g.pts[0] + dx, y: g.pts[1] + dy }, { x: g.pts[2] + dx, y: g.pts[3] + dy }];
      let snapTo: { dx: number; dy: number; d: number } | null = null;
      for (const h of heads) {
        for (const o of segments) {
          if (o.id === g.id) continue;
          for (const q of [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }]) {
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
    if (g.kind === 'endpoint' && e) {
      const seg = segments.find((s) => s.id === g.id);
      if (seg) {
        const p = toWorld(e.clientX, e.clientY);
        const fixed = g.end === 1 ? { x: seg.x2, y: seg.y2 } : { x: seg.x1, y: seg.y1 };
        const use = resolvePoint(p.x, p.y, { skipIds: new Set([g.id]), angleFrom: fixed });
        updateSegment(g.id, g.end === 1 ? { x1: use.x, y1: use.y } : { x2: use.x, y2: use.y });
      }
    }
    if (g.kind === 'create' && draft) {
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) >= MIN_LEN_PX * unitsPerPx()) {
        addSegment({ x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2, color: activeColor });
      }
    }
    // tap on a line (no drag) -> straight into the feet/inch input
    if (g.kind === 'moveSeg' && !g.moved) {
      const s2 = segments.find((s) => s.id === g.id);
      if (s2) openLen(s2);
    }
    press.current = { kind: 'none' };
    lastSnapRef.current = false;
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

  const sel = segments.find((s) => s.id === selectedId) || null;

  /* ---------------- render ---------------- */
  return (
    <div className="relative overflow-visible" ref={wrapperRef} onPointerMove={dragging ? tbMove : undefined} onPointerUp={dragging ? tbUp : undefined} onPointerCancel={dragging ? tbUp : undefined}>
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
            className="w-9 h-9 rounded-full bg-emerald-900/80 backdrop-blur text-white shadow-md flex items-center justify-center text-sm touch-none active:scale-95"
            aria-label="টুল"
          >
            ⠿
          </button>
        ) : (
          <div className="rounded-xl bg-white/75 backdrop-blur-md border border-slate-300/80 shadow-lg p-0.5">
            <div className="grid grid-cols-4 gap-0.5 w-[8.6rem] text-[8px] font-semibold leading-none">
              <button onClick={undo} disabled={!segments.length} className="h-7 rounded-lg bg-white/70 text-slate-700 flex flex-col items-center justify-center disabled:opacity-40"><span className="text-[11px]">↶</span></button>
              <button onClick={redo} disabled={!redoStack.length} className="h-7 rounded-lg bg-white/70 text-slate-700 flex flex-col items-center justify-center disabled:opacity-40"><span className="text-[11px]">↷</span></button>
              <button onClick={() => { if (sel) deleteSegment(sel.id); }} disabled={!sel} className="h-7 rounded-lg bg-rose-50/80 text-rose-700 flex flex-col items-center justify-center disabled:opacity-40"><span className="text-[11px]">🗑</span></button>
              <button onClick={printCanvas} className="h-7 rounded-lg bg-sky-50/80 text-sky-900 flex flex-col items-center justify-center" title="প্রিভিউ / প্রিন্ট"><span className="text-[11px]">👁</span></button>

              <button onClick={() => { if (sel) { setLabelInput(sel.label ?? ''); setLabelColor(sel.color || activeColor); setMenu({ kind: 'label', id: sel.id }); } else { setHint('আগে একটা দাগে ট্যাপ করুন, তারপর Aa চাপুন।'); window.setTimeout(() => setHint(null), 3000); } }} className="h-7 rounded-lg bg-sky-50/80 text-sky-900 flex flex-col items-center justify-center disabled:opacity-40"><span className="text-[11px]">Aa</span></button>
              <button onClick={handleComplete} className="h-7 rounded-lg bg-blue-600 text-white flex flex-col items-center justify-center shadow" title="ড্রয়িং কমপ্লিট ✓"><span className="text-[11px]">✓</span></button>
              <div className="h-7 rounded-lg flex items-center justify-center bg-white/70">
                <span className="w-4 h-4 rounded-full border border-white shadow" style={{ background: activeColor }} />
              </div>
              <button
                onClick={() => {
                  if (segments.length && window.confirm('সব দাগ মুছে নতুন করে শুরু করবেন?')) {
                    localStorage.removeItem(STORAGE_KEY);
                    setSegments([]); setRedoStack([]); setSelectedId(null); setMenu(null); setPlotMetas([]);
                  }
                }}
                className="h-7 rounded-lg bg-white/70 text-slate-500 flex flex-col items-center justify-center"
                title="সব মুছে ফেলুন"
              ><span className="text-[10px]">⟳</span></button>

              <div className="col-span-4 grid grid-cols-8 gap-0.5 pt-0.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setActiveColor(c);
                      // recolor the selected line too, and any label on it, so the change is visible at once
                      if (sel) updateSegment(sel.id, { color: c });
                    }}
                    className={`h-4 rounded-full shadow-sm ${activeColor === c ? 'ring-2 ring-slate-900 ring-offset-1' : 'border border-white'}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {hint && (
        <div className="absolute z-30 left-1/2 -translate-x-1/2 bottom-2 w-[92%] max-w-sm rounded-xl bg-slate-900/85 backdrop-blur text-white text-[10px] leading-snug px-2.5 py-1.5 shadow-lg">
          {hint}
        </div>
      )}

      {/* ---------- canvas ---------- */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${viewH}`}
        preserveAspectRatio="none"
        className="w-full bg-white touch-none border border-slate-300 rounded-xl block"
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

        {/* north indicator — on the canvas, top-right */}
        <g>
          <circle cx={W - 22} cy={26} r={14} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1={W - 22} y1={35} x2={W - 22} y2={17} stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" />
          <path d={`M ${W - 26} 21 L ${W - 22} 13 L ${W - 18} 21 Z`} fill="#0f172a" />
          <text x={W - 22} y={31} fontSize="7" textAnchor="middle" fill="#0f172a" fontWeight="700">N</text>
        </g>

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
              strokeWidth={selectedId === s.id ? 4 : 3} strokeLinecap="round" />
            {s.lengthFt !== undefined && (() => {
              // always horizontal (শোয়া), white pill behind so it reads over grid/lines
              const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
              const len = Math.hypot(dx, dy) || 1;
              const ox = (-dy / len) * 11, oy = (dx / len) * 11;
              const txt= ftIn(s.lengthFt);
              const tw= txt.length*6+12, th=13;
              const cx=(s.x1 + s.x2) / 2 + ox, cy=(s.y1 + s.y2) / 2 + oy;
              return (
                <g pointerEvents="none">
                  <rect x={cx - tw/2} y={cy - th/2 + 1} width={tw} height={th} rx={6}
                    fill="#ffffff" fillOpacity={0.96} stroke={s.color || '#065f46'} strokeOpacity={0.18} />
                  <text x={cx} y={cy+3.5} fontSize={10}
                    fill={s.color || '#065f46'} textAnchor="middle" fontWeight="700" style={{ userSelect: 'none' }}>{txt}</text>
                </g>
              );
            })()}
            {s.label && (() => {
              const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
              const len = Math.hypot(dx, dy) || 1;
              const ox = (dy / len) * 13, oy = (-dx / len) * 13;
              const tw= s.label.length*6+12, th=13;
              const cx=(s.x1 + s.x2) / 2 + ox, cy=(s.y1 + s.y2) / 2 + oy;
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

        {tapDot && (
          <circle key={tapDot.id} cx={tapDot.x} cy={tapDot.y} r="10" fill="none" stroke="#f59e0b" strokeWidth="2" pointerEvents="none" opacity="0">
            <animate attributeName="r" from="4" to="16" dur="0.35s" begin="0s" fill="freeze" />
            <animate attributeName="opacity" from="0.85" to="0" dur="0.35s" begin="0s" fill="freeze" />
          </circle>
        )}

        {draft && (
          <>
            <line x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} stroke="#065f46" strokeWidth="3" strokeDasharray="4" strokeLinecap="round" />
            {draft.snapped && <circle cx={draft.x2} cy={draft.y2} r="5" fill="none" stroke="#f59e0b" strokeWidth="2" />}
          </>
        )}
      </svg>

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
              <span className="text-[9px] font-semibold text-slate-500 pl-1">রঙ</span>
              <div className="flex items-center gap-0.5 overflow-x-auto">
                {COLORS.map(c=>(
                  <button key={c} onClick={()=> setPlotMeta(menu.id,{color:c})}
                    className={`w-4 h-4 rounded-full shrink-0 ${(m.color||'')===c?'ring-2 ring-slate-900 ring-offset-1':'border border-white'}`} style={{background:c}}/>
                ))}
              </div>
            </div>
            <div className="text-[9px] text-slate-500 pt-1 leading-snug">ভেতরে ট্যাপ = রঙ · কার্ড টানুন = সরানো</div>
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