/**
 * হ্যান্ড ম্যাপ — কোন কোন জমির নকশা দেখানো যাবে, তথ্য বদলানো (নাম/দাগ/মৌজা/নোট/চৌহদ্দি),
 * আর ছবি (PNG) তৈরি/সেভ/শেয়ার/রিপোর্টের জন্য রাখা।
 *
 * উৎস:
 *  ১. সংরক্ষিত বাহুভিত্তিক জরিপ (প্রতিটি প্লট আলাদা নকশা)
 *  ২. চলতি বাহুভিত্তিক খসড়া (এখনো "সম্পন্ন" হয়নি)
 *  ৩. চিত্র ভিত্তিক ক্যানভাসে হাতে আঁকা প্লট
 * বদলানো তথ্য ও কলমের ধরন localStorage-এ (fa_handmap_v1); ছবি IndexedDB-তে (faDb → handmaps)।
 */
import { SurveyRecord } from '../types';
import { computePlotCoordinates } from './plot-measure-utils';
import { BAHU_SURVEY_PREFIX, calcDraft, findRings, loadDraft, plotVertices, readCanvas } from './bahuDraftStore';
import { EN_MONTHS_BN, toBnDigits } from './banglaDate';
import { getProfile } from './profileStore';
import { HandMapOptions, HandMapRecord, MAP_H, MAP_W, PAPER, Pt, renderHandMap } from './handmapRender';
import { idbPut } from './faDb';
import notoBengaliFontUrl from '../assets/fonts/NotoSansBengali-Bengali.woff2?url';
import notoLatinFontUrl from '../assets/fonts/NotoSansBengali-Latin.woff2?url';

export type HandMapSource = 'survey' | 'draft' | 'canvas';

export interface HandMapItem {
  rec: HandMapRecord; // বদলানো তথ্যসহ
  base: HandMapRecord; // মূল তথ্য
  source: HandMapSource;
  surveyId?: string;
  typeLabel: string;
  sortKey: number;
}

type Edit = Partial<Pick<HandMapRecord, 'name' | 'dag' | 'mouza' | 'note'>> & { nb?: string[] };
interface Store {
  edits: Record<string, Edit>;
  opts?: HandMapOptions;
}
const KEY = 'fa_handmap_v1';
export const DEFAULT_OPTS: HandMapOptions = { ink: 'pencil', rough: true, hatch: true, chau: true };

function readStore(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object' && s.edits) return s as Store;
  } catch {
    /* ignore */
  }
  return { edits: {} };
}
function writeStore(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export const loadOpts = (): HandMapOptions => ({ ...DEFAULT_OPTS, ...(readStore().opts || {}) });
export const saveOpts = (o: HandMapOptions) => {
  const s = readStore();
  s.opts = o;
  writeStore(s);
};
export function saveEdit(id: string, patch: Edit) {
  const s = readStore();
  s.edits[id] = { ...(s.edits[id] || {}), ...patch };
  writeStore(s);
}

/* ---------------- তারিখ ---------------- */
const normDigits = (s: string) => (s || '').replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c)));
export function bnDate(iso?: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(normDigits(iso || ''));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  return `${toBnDigits(d.getDate())} ${EN_MONTHS_BN[d.getMonth()]} ${toBnDigits(d.getFullYear())}`;
}

/* ---------------- রেকর্ড সংগ্রহ ---------------- */
const avgArea = (len: number[]) =>
  len.length === 4 ? ((len[0] + len[2]) / 2) * ((len[1] + len[3]) / 2) : 0;

function applyEdit(base: HandMapRecord, e?: Edit): HandMapRecord {
  if (!e) return base;
  return {
    ...base,
    name: e.name ?? base.name,
    dag: e.dag ?? base.dag,
    mouza: e.mouza ?? base.mouza,
    note: e.note ?? base.note,
    nb: e.nb ? [0, 1, 2, 3].map((i) => e.nb![i] ?? '') : base.nb,
  };
}

export function collectHandMaps(surveys: SurveyRecord[]): HandMapItem[] {
  const store = readStore();
  const amin = getProfile().name;
  const items: HandMapItem[] = [];
  const surveyIds = new Set(surveys.map((s) => s.id));

  // ১. সংরক্ষিত জরিপের প্লট
  for (const s of surveys) {
    const plots = (s.plots || []).filter((p) => p.northSide > 0 && p.southSide > 0 && p.eastSide > 0 && p.westSide > 0);
    plots.forEach((p, i) => {
      const exact = p.calculationMethod === 'diagonal' && p.diagonal ? p.diagonal : undefined;
      const v = computePlotCoordinates(p.northSide, p.southSide, p.eastSide, p.westSide, p.unit || 'feet', exact, p.diagonalChoice || 'AC');
      const pts: Pt[] = v.vertices.map((q) => [q.x, q.y]);
      const id = `${s.id}#${i}`;
      const base: HandMapRecord = {
        id,
        name: s.clientName || '',
        dag: p.dagNo || s.dagNo || '',
        mouza: s.mouza || '',
        note: '',
        nb: ['', '', '', ''],
        pts,
        len: [p.northSide, p.eastSide, p.southSide, p.westSide],
        sq: p.areaSqFt || shoelaceSafe(pts),
        date: bnDate(s.date),
        amin,
      };
      items.push({
        rec: applyEdit(base, store.edits[id]),
        base,
        source: 'survey',
        surveyId: s.id,
        typeLabel: plots.length > 1 ? `বাহুভিত্তিক · প্লট ${toBnDigits(i + 1)}` : 'বাহুভিত্তিক',
        sortKey: Number(s.updatedAt || s.createdAt || 0) || 0,
      });
    });
  }

  // ২. চলতি খসড়া (সংরক্ষিত তালিকায় এখনো নেই)
  const d = loadDraft();
  if (d && d.infoDone && !surveyIds.has(d.surveyId)) {
    const t = calcDraft(d);
    t.calcs.forEach((c, i) => {
      if (!c.complete) return;
      const pts: Pt[] = plotVertices(c).map((q) => [q.x, q.y]);
      const id = `${d.surveyId}#${i}`;
      const base: HandMapRecord = {
        id,
        name: d.info.clientName,
        dag: c.record.dagNo || d.info.dagNo,
        mouza: d.info.mouza,
        note: '',
        nb: ['', '', '', ''],
        pts,
        len: [c.feet.n, c.feet.e, c.feet.s, c.feet.w],
        sq: c.record.areaSqFt || 0,
        date: bnDate(d.info.date),
        amin,
      };
      items.push({
        rec: applyEdit(base, store.edits[id]),
        base,
        source: 'draft',
        surveyId: d.surveyId,
        typeLabel: 'খসড়া (সম্পন্ন হয়নি)',
        sortKey: d.updatedAt,
      });
    });
  }

  // ৩. চিত্র ভিত্তিকে হাতে আঁকা প্লট (বাহু থেকে আসা প্লট বাদ — ওগুলো ওপরে আছে)
  const canvas = readCanvas();
  const rings = findRings(canvas.segments);
  let ci = 0;
  for (const r of rings) {
    if (r.segs.filter((s) => s.id.startsWith('bahu-')).length >= 2) continue;
    const len = r.segs.map((s) => s.lengthFt || 0);
    if (len.some((v) => !(v > 0))) continue;
    ci++;
    const meta = canvas.plots.find((m) => m.id === r.id);
    const pts: Pt[] = r.pts.map((p) => [p.x, p.y]);
    const id = `canvas:${r.id}`;
    const base: HandMapRecord = {
      id,
      name: meta?.title || '',
      dag: meta?.dagNo || '',
      mouza: '',
      note: '',
      nb: ['', '', '', ''],
      pts,
      len,
      sq: avgArea(len),
      date: bnDate(),
      amin,
    };
    items.push({
      rec: applyEdit(base, store.edits[id]),
      base,
      source: 'canvas',
      typeLabel: `চিত্র ভিত্তিক · প্লট ${toBnDigits(ci)}`,
      sortKey: Date.now() - ci,
    });
  }

  return items.sort((a, b) => b.sortKey - a.sortKey);
}

function shoelaceSafe(P: Pt[]) {
  return Math.abs(P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0)) / 2;
}

export const isBahuSurveyId = (id?: string) => !!id && id.startsWith(BAHU_SURVEY_PREFIX);

/* ---------------- ছবি (PNG) ---------------- */
let fontCss: Promise<string> | null = null;
async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((ok, bad) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = () => bad(fr.error);
    fr.readAsDataURL(blob);
  });
}
/** অফলাইনেও ছবিতে বাংলা ঠিক দেখাতে ফন্ট SVG-র ভেতরে বসাই */
function embeddedFontCss(): Promise<string> {
  if (!fontCss) {
    fontCss = (async () => {
      try {
        const [bn, la] = await Promise.all([toDataUrl(notoBengaliFontUrl), toDataUrl(notoLatinFontUrl)]);
        return `@font-face{font-family:'Noto Sans Bengali';font-weight:100 900;src:url(${bn}) format('woff2');unicode-range:U+0951-0952,U+0964-0965,U+0980-09FE,U+200C-200D,U+25CC}@font-face{font-family:'Noto Sans Bengali';font-weight:100 900;src:url(${la}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-2193,U+2212}`;
      } catch {
        fontCss = null;
        return '';
      }
    })();
  }
  return fontCss;
}

export async function handMapSvgString(rec: HandMapRecord, o: HandMapOptions): Promise<string> {
  const css = await embeddedFontCss();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}" viewBox="0 0 ${MAP_W} ${MAP_H}"><style>${css}text{font-family:'Noto Sans Bengali',sans-serif}</style>${renderHandMap(
    rec,
    o,
    'x'
  )}</svg>`;
}

export async function handMapPng(rec: HandMapRecord, o: HandMapOptions, scale = 3): Promise<Blob> {
  const svg = await handMapSvgString(rec, o);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error('ছবি তৈরি হয়নি'));
      img.src = url;
    });
    // ফন্ট লোড হতে এক মুহূর্ত
    await new Promise((r) => setTimeout(r, 60));
    const c = document.createElement('canvas');
    c.width = MAP_W * scale;
    c.height = MAP_H * scale;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('PNG হয়নি'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const fileNameFor = (rec: HandMapRecord) =>
  `handmap-${(rec.dag || 'dag').replace(/[^\p{L}\p{N}-]+/gu, '_')}-${(rec.name || '').replace(/[^\p{L}\p{N}-]+/gu, '_')}.png`;

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** রিপোর্টের জন্য ছবি রাখি (ধাপ ৭-এ রিপোর্ট এটা দেখাবে) */
export async function saveHandMapForReport(item: HandMapItem, o: HandMapOptions): Promise<void> {
  const [png, svg] = await Promise.all([handMapPng(item.rec, o, 2), Promise.resolve(renderHandMap(item.rec, o, 'r'))]);
  await idbPut('handmaps', {
    id: item.rec.id,
    surveyId: item.surveyId || null,
    png,
    svg,
    opts: o,
    rec: item.rec,
    updatedAt: Date.now(),
  });
}
