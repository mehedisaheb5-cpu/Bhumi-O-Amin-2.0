/**
 * বাহুভিত্তিক দখল পরিমাপ — খসড়া (draft) সংরক্ষণ ও রূপান্তর।
 *
 * - খসড়া localStorage-এ থাকে (key: fa_bahu_draft_v1) — অ্যাপ বন্ধ হলেও হারায় না।
 * - "সম্পন্ন" চাপলে খসড়া থেকে SurveyRecord (status: completed) তৈরি হয়।
 * - "চিত্র ভিত্তিক" ট্যাবে গেলে বাহুর নকশা ক্যানভাসের নিজস্ব key-তে
 *   (bhumi_possession_drawing_v1) লেখা হয় — ক্যানভাসের কোড বদলাতে হয় না।
 */
import { DrawingSegment, PlotMeta, SurveyPlotRecord, SurveyRecord } from '../types';
import { computePlotCoordinates, createDefaultPlotRecord, recalculatePlot, validatePlotGeometry } from './plot-measure-utils';
import { getStoredReports, saveStoredReports } from './survey-report-utils';

export const BAHU_DRAFT_KEY = 'fa_bahu_draft_v1';
export const CANVAS_KEY = 'bhumi_possession_drawing_v1';
export const HANDOFF_KEY = 'fa_bahu_handoff_v1';
export const BAHU_SURVEY_PREFIX = 'fa-bahu-';

export type FtIn = { f: string; i: string };
export type SideKey = 'n' | 's' | 'e' | 'w' | 'd';

export interface BahuInfo {
  clientName: string;
  phone: string;
  mouza: string;
  jlNo: string;
  dagNo: string;
  khatianNo: string;
  upazila: string;
  district: string;
  date: string; // YYYY-MM-DD
}

export interface BahuPlotDraft {
  id: string;
  dagNo: string; // খালি = গ্রাহকের তথ্যের দাগ
  n: FtIn;
  s: FtIn;
  e: FtIn;
  w: FtIn;
  d: FtIn;
}

export interface BahuDraft {
  id: string;
  surveyId: string;
  info: BahuInfo;
  infoDone: boolean;
  plots: BahuPlotDraft[];
  activePlotId: string;
  status: 'draft' | 'completed';
  createdAt: number;
  updatedAt: number;
}

const toBn = (n: number | string) => String(n).replace(/[0-9]/g, (c) => '০১২৩৪৫৬৭৮৯'[+c]);
const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emptyFtIn = (): FtIn => ({ f: '', i: '' });

export const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const newPlotDraft = (): BahuPlotDraft => ({
  id: `bp-${rid()}`,
  dagNo: '',
  n: emptyFtIn(),
  s: emptyFtIn(),
  e: emptyFtIn(),
  w: emptyFtIn(),
  d: emptyFtIn(),
});

export function newDraft(): BahuDraft {
  const plot = newPlotDraft();
  const now = Date.now();
  return {
    id: `bd-${rid()}`,
    surveyId: `${BAHU_SURVEY_PREFIX}${now}`,
    info: {
      clientName: '',
      phone: '',
      mouza: '',
      jlNo: '',
      dagNo: '',
      khatianNo: '',
      upazila: '',
      district: 'ফেনী',
      date: todayISO(),
    },
    infoDone: false,
    plots: [plot],
    activePlotId: plot.id,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function loadDraft(): BahuDraft | null {
  try {
    const raw = localStorage.getItem(BAHU_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as BahuDraft;
    if (!d || !Array.isArray(d.plots) || !d.plots.length || !d.info) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(d: BahuDraft) {
  try {
    localStorage.setItem(BAHU_DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* quota / private mode */
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(BAHU_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------- numbers ---------------- */

/** বাংলা অঙ্ক → ইংরেজি, কমা → দশমিক */
export const normDigits = (s: string) =>
  (s || '').replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace(',', '.');

/** ইনপুটে শুধু সংখ্যা ও একটি দশমিক রাখি */
export const cleanNumInput = (s: string) => {
  const t = normDigits(s).replace(/[^0-9.]/g, '');
  const i = t.indexOf('.');
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
};

export function ftInToFeet(v: FtIn | undefined): number {
  if (!v) return 0;
  const f = parseFloat(normDigits(v.f));
  const i = parseFloat(normDigits(v.i));
  const total = (isFinite(f) ? f : 0) + (isFinite(i) ? i : 0) / 12;
  return Math.max(0, Math.round(total * 10000) / 10000);
}

export function feetToFtIn(ft: number | undefined): FtIn {
  if (!ft || !isFinite(ft) || ft <= 0) return emptyFtIn();
  const totalIn = Math.round(ft * 12 * 10) / 10;
  const f = Math.floor(totalIn / 12);
  const i = Math.round((totalIn - f * 12) * 10) / 10;
  return { f: String(f), i: i ? String(i) : '' };
}

/** ৬০.৫ ফুট → "৬০′ ৬″" (বাংলা অঙ্ক নয়; কলার toBnDigits করবে) */
export function fmtFtIn(ft: number): string {
  const total = Math.round(ft * 12);
  const f = Math.floor(total / 12);
  const i = total % 12;
  return i ? `${f}′ ${i}″` : `${f}′`;
}

/* ---------------- calculation ---------------- */

export interface PlotCalc {
  record: SurveyPlotRecord;
  feet: { n: number; s: number; e: number; w: number; d: number };
  complete: boolean; // ৪ বাহু দেওয়া আছে
  usedDiagonal: boolean;
  diagonalWarning: string | null;
  shapeWarning: string | null;
}

export function plotDag(p: BahuPlotDraft, info: BahuInfo) {
  return (p.dagNo || '').trim() || info.dagNo.trim();
}

export function calcPlot(p: BahuPlotDraft, info: BahuInfo, order: number): PlotCalc {
  const feet = { n: ftInToFeet(p.n), s: ftInToFeet(p.s), e: ftInToFeet(p.e), w: ftInToFeet(p.w), d: ftInToFeet(p.d) };
  const complete = feet.n > 0 && feet.s > 0 && feet.e > 0 && feet.w > 0;
  let usedDiagonal = false;
  let diagonalWarning: string | null = null;
  let shapeWarning: string | null = null;

  if (complete) {
    const v = validatePlotGeometry(feet.n, feet.s, feet.e, feet.w, 'feet', feet.d || undefined, 'AC');
    if (feet.d > 0) {
      if (v.isValid && !v.isUnderdetermined) usedDiagonal = true;
      else diagonalWarning = 'এই কর্ণ মাপ বাহুর সাথে মিলছে না — গড় পদ্ধতিতে হিসাব দেখানো হচ্ছে। কর্ণ আবার মেপে দেখুন।';
    }
    const sides = [feet.n, feet.s, feet.e, feet.w];
    const max = Math.max(...sides);
    if (max >= sides.reduce((a, b) => a + b, 0) - max) {
      shapeWarning = 'একটি বাহু বাকি তিনটির যোগফলের চেয়ে বড় — মাপ আবার দেখুন।';
    }
  }

  const dag = plotDag(p, info);
  const base = createDefaultPlotRecord(order, dag || '—');
  const record = recalculatePlot({
    ...base,
    id: p.id,
    plotName: `প্লট ${order + 1}`,
    dagNo: dag,
    khatianNo: info.khatianNo,
    unit: 'feet',
    calculationMethod: usedDiagonal ? 'diagonal' : 'average',
    northSide: feet.n,
    southSide: feet.s,
    eastSide: feet.e,
    westSide: feet.w,
    diagonal: feet.d > 0 ? feet.d : undefined,
    diagonalChoice: 'AC',
    createdAt: base.createdAt,
  });
  return { record, feet, complete, usedDiagonal, diagonalWarning, shapeWarning };
}

export interface DraftTotals {
  calcs: PlotCalc[];
  sqft: number;
  decimal: number;
  allComplete: boolean;
  anyComplete: boolean;
}

export function calcDraft(d: BahuDraft): DraftTotals {
  const calcs = d.plots.map((p, i) => calcPlot(p, d.info, i));
  const sqft = calcs.reduce((a, c) => a + (c.record.areaSqFt || 0), 0);
  return {
    calcs,
    sqft,
    decimal: sqft / 435.6,
    allComplete: calcs.every((c) => c.complete && c.record.areaSqFt),
    anyComplete: calcs.some((c) => c.complete),
  };
}

export const SQFT_PER_GONDA = (39.67 * 435.6) / 20; // ফেনী: ১ কানি = ২০ গন্ডা = ৩৯.৬৭ শতাংশ

/* ---------------- geometry for drawing ---------------- */

/** উত্তর উপরে — A(উ-প) B(উ-পূ) C(দ-পূ) D(দ-প), ফুটে */
export function plotVertices(c: PlotCalc) {
  const { n, s, e, w, d } = c.feet;
  const r = computePlotCoordinates(n, s, e, w, 'feet', c.usedDiagonal ? d : undefined, 'AC');
  return r.vertices.map((v) => ({ x: v.x, y: v.y }));
}

/* ---------------- survey record ---------------- */

export function draftToSurvey(d: BahuDraft, status: 'draft' | 'completed', bookingId?: string): SurveyRecord {
  const t = calcDraft(d);
  const plots = t.calcs.map((c) => c.record);
  const dags = Array.from(new Set(plots.map((p) => p.dagNo).filter(Boolean)));
  const info = d.info;
  const notes = [
    info.phone ? `ফোন: ${info.phone}` : '',
    `বাহুভিত্তিক পরিমাপ — ${toBn(plots.length)}টি প্লট`,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id: d.surveyId,
    title: `${info.clientName || 'গ্রাহক'} — দাগ ${dags.join(', ') || info.dagNo}`,
    mouza: info.mouza,
    jlNo: info.jlNo,
    dagNo: dags.join(', ') || info.dagNo,
    khatianNo: info.khatianNo,
    date: info.date || todayISO(),
    areaSqFt: Math.round(t.sqft * 100) / 100,
    perimeterFt: Math.round(plots.reduce((a, p) => a + (p.perimeterFt || 0), 0) * 100) / 100,
    points: [],
    status,
    notes,
    clientName: info.clientName,
    district: info.district,
    upazila: info.upazila,
    bookingId,
    plots,
    createdAt: d.createdAt,
    updatedAt: Date.now(),
  };
}

export function draftFromSurvey(s: SurveyRecord): BahuDraft {
  const base = newDraft();
  const phone = /ফোন:\s*([^·]+)/.exec(s.notes || '')?.[1]?.trim() || '';
  const firstDag = (s.plots && s.plots[0]?.dagNo) || s.dagNo.split(',')[0]?.trim() || '';
  const plots: BahuPlotDraft[] = (s.plots || []).map((p) => ({
    id: p.id || `bp-${rid()}`,
    dagNo: p.dagNo && p.dagNo !== firstDag ? p.dagNo : '',
    n: feetToFtIn(p.northSide),
    s: feetToFtIn(p.southSide),
    e: feetToFtIn(p.eastSide),
    w: feetToFtIn(p.westSide),
    d: feetToFtIn(p.diagonal),
  }));
  if (!plots.length) plots.push(newPlotDraft());
  return {
    ...base,
    surveyId: s.id,
    info: {
      clientName: s.clientName || '',
      phone,
      mouza: s.mouza || '',
      jlNo: s.jlNo || '',
      dagNo: firstDag,
      khatianNo: s.khatianNo || '',
      upazila: s.upazila || '',
      district: s.district || 'ফেনী',
      date: s.date || todayISO(),
    },
    infoDone: true,
    plots,
    activePlotId: plots[0].id,
    status: s.status === 'draft' ? 'draft' : 'completed',
    createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
  };
}

/* ---------------- canvas handoff ---------------- */

type CanvasSeg = DrawingSegment & { color?: string };

/** বাহুর মাপ থেকে ক্যানভাসের দাগ (W=400 লজিক্যাল প্রস্থ) — সব প্লট একই স্কেলে, পাশাপাশি */
export function buildCanvasDrawing(d: BahuDraft): { segments: CanvasSeg[]; plots: PlotMeta[] } {
  const t = calcDraft(d);
  const ready = t.calcs.map((c, idx) => ({ c, idx })).filter((x) => x.c.complete);
  if (!ready.length) return { segments: [], plots: [] };

  const shapes = ready.map(({ c, idx }) => {
    const v = plotVertices(c);
    const minX = Math.min(...v.map((p) => p.x));
    const minY = Math.min(...v.map((p) => p.y));
    const pts = v.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    const w = Math.max(...pts.map((p) => p.x)) || 1;
    const h = Math.max(...pts.map((p) => p.y)) || 1;
    return { c, idx, pts, w, h };
  });

  // ২ কলামের গ্রিড (১টি প্লট হলে ১ কলাম)
  const cols = shapes.length === 1 ? 1 : 2;
  const rows: (typeof shapes)[] = [];
  for (let i = 0; i < shapes.length; i += cols) rows.push(shapes.slice(i, i + cols));
  const gapFt = Math.max(...shapes.map((s) => Math.max(s.w, s.h))) * 0.18;
  const totalW = Math.max(...rows.map((r) => r.reduce((a, s) => a + s.w, 0) + gapFt * (r.length - 1)));
  const totalH = rows.reduce((a, r) => a + Math.max(...r.map((s) => s.h)), 0) + gapFt * (rows.length - 1);
  const AREA_W = 300;
  const AREA_H = 380;
  const scale = Math.min(AREA_W / totalW, AREA_H / totalH);
  const offX = 50 + (AREA_W - totalW * scale) / 2;
  const offY = 70;

  const segments: CanvasSeg[] = [];
  const plots: PlotMeta[] = [];
  let y = 0;
  for (const row of rows) {
    let x = 0;
    const rowH = Math.max(...row.map((s) => s.h));
    for (const s of row) {
      const P = s.pts.map((p) => ({
        x: Math.round(offX + (x + p.x) * scale),
        y: Math.round(offY + (y + p.y) * scale),
      }));
      const { n, e, s: so, w } = s.c.feet;
      const lens = [n, e, so, w]; // A→B উত্তর, B→C পূর্ব, C→D দক্ষিণ, D→A পশ্চিম
      const ids: string[] = [];
      for (let k = 0; k < 4; k++) {
        const a = P[k];
        const b = P[(k + 1) % 4];
        const id = `bahu-${s.c.record.id}-${k}`;
        ids.push(id);
        segments.push({ id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, lengthFt: Math.round(lens[k] * 1000) / 1000, color: '#065f46' });
      }
      plots.push({
        id: ids.slice().sort().join('|'),
        title: d.info.clientName || `প্লট ${s.idx + 1}`,
        dagNo: s.c.record.dagNo || undefined,
      });
      x += s.w + gapFt;
    }
    y += rowH + gapFt;
  }
  return { segments, plots };
}

const segSig = (segs: { x1: number; y1: number; x2: number; y2: number; lengthFt?: number }[]) =>
  segs.map((s) => `${Math.round(s.x1)},${Math.round(s.y1)},${Math.round(s.x2)},${Math.round(s.y2)},${s.lengthFt ?? ''}`).join(';');

interface Handoff {
  draftId: string;
  sidesSig: string;
  canvasSig: string;
  /** ক্যানভাসে বসানো খসড়া-প্লটের id */
  plotIds?: string[];
  /** ক্যানভাসে হাতে আঁকা নতুন প্লট: ring id → খসড়া-প্লট id */
  ringMap?: Record<string, string>;
  /** ক্যানভাসের হাতে করা পরিবর্তন খসড়ায় নেওয়া হয়েছে */
  fromCanvas?: boolean;
}

const readHandoff = (): Handoff | null => {
  try {
    return JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeHandoff = (h: Handoff) => {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(h));
  } catch {
    /* ignore */
  }
};
export const readCanvas = (): { segments: CanvasSeg[]; plots: PlotMeta[] } => {
  try {
    const raw = localStorage.getItem(CANVAS_KEY);
    if (!raw) return { segments: [], plots: [] };
    const d = JSON.parse(raw);
    return { segments: Array.isArray(d.segments) ? d.segments : [], plots: Array.isArray(d.plots) ? d.plots : [] };
  } catch {
    return { segments: [], plots: [] };
  }
};

/**
 * বাহুর নকশা ক্যানভাসে পাঠাই — ক্যানভাস মাউন্ট হওয়ার আগে ডাকতে হবে।
 * - ক্যানভাস খালি → লিখে দিই
 * - আগে এই খসড়াই পাঠানো হয়েছিল ও মাপ বদলায়নি → কিছু করি না (ক্যানভাসের এডিট থাকে)
 * - মাপ বদলেছে, ক্যানভাসে হাত দেওয়া হয়নি → নতুন করে লিখি
 * - ক্যানভাসে অন্য/এডিট করা ড্রয়িং আছে → confirmFn জিজ্ঞেস করে
 */
export function handoffToCanvas(d: BahuDraft | null, confirmFn: (msg: string) => boolean): 'written' | 'kept' | 'none' {
  if (!d || !d.infoDone) return 'none';
  const built = buildCanvasDrawing(d);
  if (!built.segments.length) return 'none';
  const sidesSig = segSig(built.segments);

  const canvasSegs = readCanvas().segments;
  const prev = readHandoff();
  const curSig = segSig(canvasSegs);

  const write = () => {
    try {
      localStorage.setItem(CANVAS_KEY, JSON.stringify({ segments: built.segments, plots: built.plots, updatedAt: Date.now() }));
    } catch {
      /* ignore */
    }
    writeHandoff({
      draftId: d.id,
      sidesSig,
      canvasSig: sidesSig,
      plotIds: d.plots.filter((_, i) => calcPlot(d.plots[i], d.info, i).complete).map((p) => p.id),
      ringMap: {},
    });
    return 'written' as const;
  };

  if (!canvasSegs.length) return write();
  if (prev && prev.draftId === d.id) {
    if (prev.sidesSig === sidesSig) return 'kept';
    if (prev.canvasSig === curSig && !prev.fromCanvas) return write();
    return confirmFn('বাহুর মাপ বদলেছে। ক্যানভাসে নতুন মাপে নকশা আঁকবেন?\n(ক্যানভাসে হাতে করা পরিবর্তন মুছে যাবে)') ? write() : 'kept';
  }
  if (curSig === sidesSig) return write();
  return confirmFn('ক্যানভাসে আগের একটি ড্রয়িং আছে। এই গ্রাহকের বাহুর নকশা দিয়ে বদলাবেন?\n(না চাপলে আগের ড্রয়িং থাকবে)') ? write() : 'kept';
}

/* ============================================================
   ক্যানভাস → খসড়া (রিপোর্ট): চিত্র ভিত্তিকে করা পরিবর্তন বাহুর মাপে নেওয়া
   ============================================================ */

export type Ring = { id: string; segs: CanvasSeg[]; pts: { x: number; y: number }[] };

/** ক্যানভাসের মতোই ৪-বাহুর বন্ধ রিং খুঁজি (একই key/DFS নিয়ম) */
export function findRings(segments: CanvasSeg[]): Ring[] {
  const key = (p: { x: number; y: number }) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const adj = new Map<string, CanvasSeg[]>();
  for (const sg of segments)
    for (const pt of [{ x: sg.x1, y: sg.y1 }, { x: sg.x2, y: sg.y2 }]) {
      const k = key(pt);
      const a = adj.get(k) || [];
      a.push(sg);
      adj.set(k, a);
    }
  const seen = new Set<string>();
  const out: Ring[] = [];
  for (const start of segments) {
    for (const dir of [0, 1] as const) {
      const sp = dir === 0 ? { x: start.x1, y: start.y1 } : { x: start.x2, y: start.y2 };
      const fp = dir === 0 ? { x: start.x2, y: start.y2 } : { x: start.x1, y: start.y1 };
      const sk = key(sp);
      const dfs = (ck: string, prev: CanvasSeg, segs: CanvasSeg[], pts: { x: number; y: number }[]) => {
        if (segs.length === 4) {
          if (ck !== sk) return;
          const id = segs.map((s) => s.id).sort().join('|');
          if (seen.has(id)) return;
          seen.add(id);
          out.push({ id, segs, pts: pts.slice(0, 4) });
          return;
        }
        for (const nx of adj.get(ck) || []) {
          if (nx === prev || segs.includes(nx)) continue;
          const a = key({ x: nx.x1, y: nx.y1 });
          const b = key({ x: nx.x2, y: nx.y2 });
          if (a !== ck && b !== ck) continue;
          const to = a === ck ? b : a;
          if (to === sk && segs.length !== 3) continue;
          if (to !== sk && segs.length === 3) continue;
          const apt = a === ck ? { x: nx.x2, y: nx.y2 } : { x: nx.x1, y: nx.y1 };
          dfs(to, nx, [...segs, nx], [...pts, apt]);
        }
      };
      dfs(key(fp), start, [start], [sp, fp]);
    }
  }
  return out;
}

/** রিংয়ের ৪ বাহু → উত্তর/পূর্ব/দক্ষিণ/পশ্চিম (স্ক্রিনে উপর = উত্তর) */
function ringSides(r: Ring): { n: number; e: number; s: number; w: number } | null {
  const lens = r.segs.map((s) => s.lengthFt || 0);
  if (lens.some((v) => !(v > 0))) return null;
  const P = r.pts;
  const cx = P.reduce((a, p) => a + p.x, 0) / 4;
  const cy = P.reduce((a, p) => a + p.y, 0) / 4;
  let area2 = 0;
  for (let i = 0; i < 4; i++) {
    const a = P[i];
    const b = P[(i + 1) % 4];
    area2 += a.x * b.y - b.x * a.y;
  }
  const cw = area2 > 0; // y নিচের দিকে, তাই ধনাত্মক = ঘড়ির কাঁটার দিকে
  let north = 0;
  let best = Infinity;
  for (let k = 0; k < 4; k++) {
    const a = P[k];
    const b = P[(k + 1) % 4];
    const ang = Math.atan2((a.y + b.y) / 2 - cy, (a.x + b.x) / 2 - cx);
    const diff = Math.abs(Math.atan2(Math.sin(ang + Math.PI / 2), Math.cos(ang + Math.PI / 2)));
    if (diff < best) {
      best = diff;
      north = k;
    }
  }
  const at = (o: number) => lens[(north + o + 4) % 4];
  return cw ? { n: at(0), e: at(1), s: at(2), w: at(3) } : { n: at(0), e: at(3), s: at(2), w: at(1) };
}

const BAHU_SEG_RX = /^bahu-(.+)-([0-3])$/;
const sameFt = (a: FtIn, ft: number) => Math.abs(ftInToFeet(a) - ft) < 0.005;

/**
 * চিত্র ভিত্তিকে (ক্যানভাস) বাহুর দৈর্ঘ্য/দাগ বদলালে বা নতুন প্লট আঁকলে সেটা খসড়ায় আনি।
 * শুধু তখনই কাজ করে যখন ক্যানভাসের ড্রয়িং এই খসড়া থেকেই পাঠানো হয়েছিল।
 */
export function syncCanvasIntoDraft(d: BahuDraft): { draft: BahuDraft; changed: boolean } {
  const prev = readHandoff();
  if (!prev || prev.draftId !== d.id) return { draft: d, changed: false };
  const canvas = readCanvas();
  if (!canvas.segments.length) return { draft: d, changed: false };

  const rings = findRings(canvas.segments);
  const metaDag = (ringId: string) => (canvas.plots.find((m) => m.id === ringId)?.dagNo || '').trim();
  const ringMap: Record<string, string> = { ...(prev.ringMap || {}) };
  const placed = new Set(prev.plotIds || []);
  let changed = false;

  const plots = d.plots.map((p) => ({ ...p }));
  const matched = new Set<string>();

  for (const r of rings) {
    const sides = ringSides(r);
    if (!sides) continue; // কোনো বাহুর দৈর্ঘ্য নেই — এই রিং বাদ
    // বেশিরভাগ (≥২) দাগ যে বাহু-প্লটের, রিংটা সেই প্লট (একটা দাগ নতুন করে টানলেও মেলে)
    const count: Record<string, number> = {};
    for (const s of r.segs) {
      const m = BAHU_SEG_RX.exec(s.id)?.[1];
      if (m) count[m] = (count[m] || 0) + 1;
    }
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    const pid = top && top[1] >= 2 && !matched.has(top[0]) ? top[0] : ringMap[r.id];
    let p = pid && !matched.has(pid) ? plots.find((x) => x.id === pid) : undefined;
    if (!p) {
      p = newPlotDraft();
      plots.push(p);
      ringMap[r.id] = p.id;
      placed.add(p.id);
      changed = true;
    }
    matched.add(p.id);
    let sideChanged = false;
    for (const k of ['n', 'e', 's', 'w'] as const) {
      if (!sameFt(p[k], sides[k])) {
        p[k] = feetToFtIn(sides[k]);
        sideChanged = true;
      }
    }
    if (sideChanged) {
      p.d = { f: '', i: '' }; // বাহু বদলালে পুরনো কর্ণ আর খাটে না
      changed = true;
    }
    const dag = metaDag(r.id);
    if (dag && dag !== plotDag(p, d.info)) {
      p.dagNo = dag === d.info.dagNo.trim() ? '' : dag;
      changed = true;
    }
  }

  // ক্যানভাসে বসানো প্লট পুরো মুছে ফেলা হলে খসড়া থেকেও বাদ
  const segIds = canvas.segments.map((s) => s.id);
  const stillThere = (pid: string) =>
    segIds.some((id) => id.startsWith(`bahu-${pid}-`)) ||
    Object.entries(ringMap).some(([rid, v]) => v === pid && rid.split('|').some((sid) => segIds.includes(sid)));
  let kept = plots.filter((p) => matched.has(p.id) || !placed.has(p.id) || stillThere(p.id));
  if (kept.length !== plots.length) changed = true;
  if (!kept.length) kept = [newPlotDraft()];

  const next: BahuDraft = changed
    ? {
        ...d,
        plots: kept,
        activePlotId: kept.some((p) => p.id === d.activePlotId) ? d.activePlotId : kept[0].id,
        updatedAt: Date.now(),
      }
    : d;

  writeHandoff({
    draftId: d.id,
    sidesSig: segSig(buildCanvasDrawing(next).segments),
    canvasSig: segSig(canvas.segments),
    plotIds: Array.from(placed),
    ringMap,
    fromCanvas: prev.fromCanvas || changed,
  });
  return { draft: next, changed };
}

/** সম্পন্ন জরিপ সংরক্ষণ + পুরনো খসড়া রিপোর্ট বাদ (নতুন মাপে রিপোর্ট হবে) */
export function commitCompleted(d: BahuDraft, onSave: (s: SurveyRecord) => void, bookingId?: string): SurveyRecord {
  const survey = draftToSurvey(d, 'completed', bookingId);
  try {
    const reps = getStoredReports();
    const keep = reps.filter((r) => !(r.surveyId === survey.id && r.status === 'draft'));
    if (keep.length !== reps.length) saveStoredReports(keep);
  } catch {
    /* ignore */
  }
  onSave(survey);
  return survey;
}

export const SYNC_NOTE_KEY = 'fa_bahu_sync_note';
