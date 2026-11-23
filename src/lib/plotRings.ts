/**
 * প্লটের রিং খোঁজা + বাহুর মানের লেবেলের জায়গা — ক্যানভাস ও রিপোর্ট দুই জায়গায়
 * একই নিয়মে চলে, যাতে রিপোর্টে ঠিক সেই প্লটগুলোই আসে যা ক্যানভাসে দেখা যায়।
 *
 * রিং = বন্ধ চতুর্ভুজ। বন্টনে কোনো বাহু দুই টুকরোয় ভাগ হলে রিংয়ে ৫–৬টা
 * দাগ হয় — তাই DFS ৪–৬ দাগ পর্যন্ত খোঁজে, আর একই সরলরেখায় থাকা পাশাপাশি
 * দাগগুলো এক বাহুতে জোড়া হয় (মান যোগ হয়)। বন্টনে ভাগ হওয়া প্লটের
 * বাবা-রিং (দুই প্লটের জোড়া) আলাদা প্লট হিসেবে গোনা হয় না।
 */

export type RingSegment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthFt?: number;
  color?: string;
};

export type PlotRing = {
  id: string;
  pts: { x: number; y: number }[];
  sidesFt: (number | undefined)[];
  cx: number;
  cy: number;
  color: string;
};

const MAX_EDGES = 6;

export function findPlotRings(segments: RingSegment[]): PlotRing[] {
  const key = (p: { x: number; y: number }) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const adj = new Map<string, RingSegment[]>();
  for (const sg of segments) {
    for (const pt of [
      { x: sg.x1, y: sg.y1 },
      { x: sg.x2, y: sg.y2 },
    ]) {
      const k = key(pt);
      const a = adj.get(k) || [];
      a.push(sg);
      adj.set(k, a);
    }
  }
  const seen = new Set<string>();
  const out: PlotRing[] = [];

  /** একই সরলরেখায় থাকা পাশাপাশি দাগ জোড়া দিয়ে ৪ বাহু বানানো যায় কি না দেখা */
  const tryRecord = (segIds: string[], sides: (number | undefined)[], pts: { x: number; y: number }[]) => {
    const n = segIds.length;
    const dirs: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      dirs.push({ x: b.x - a.x, y: b.y - a.y });
    }
    const colinear = (i: number, j: number) => {
      const d1 = dirs[i];
      const d2 = dirs[j];
      const l1 = Math.hypot(d1.x, d1.y);
      const l2 = Math.hypot(d2.x, d2.y);
      if (l1 === 0 || l2 === 0) return false;
      const cross = (d1.x * d2.y - d1.y * d2.x) / (l1 * l2);
      const dot = (d1.x * d2.x + d1.y * d2.y) / (l1 * l2);
      return Math.abs(cross) < 0.02 && dot > 0;
    };
    // একই দিকে চলা পাশাপাশি দাগ এক গ্রুপে
    const groups: { start: number; len: number }[] = [];
    let gStart = 0;
    for (let i = 1; i < n; i++) {
      if (!colinear(i - 1, i)) {
        groups.push({ start: gStart, len: i - gStart });
        gStart = i;
      }
    }
    groups.push({ start: gStart, len: n - gStart });
    // রিংয়ের শেষ-প্রথম গ্রুপও একই রেখায় হতে পারে (জোড়া লাগা)
    if (groups.length > 1 && colinear(groups[groups.length - 1].start, groups[0].start)) {
      const last = groups.pop()!;
      groups[0].start = last.start;
      groups[0].len += last.len;
    }
    if (groups.length !== 4) return;
    const corners = groups.map((g) => pts[g.start % n]);
    const mergedSides = groups.map((g) => {
      let sum = 0;
      for (let k = 0; k < g.len; k++) {
        const v = sides[(g.start + k) % n];
        if (typeof v !== 'number' || v <= 0) return undefined;
        sum += v;
      }
      return Math.round(sum * 1000) / 1000;
    });
    const pid = segIds.slice().sort().join('|');
    if (seen.has(pid)) return;
    seen.add(pid);
    const cx = corners.reduce((a, q) => a + q.x, 0) / corners.length;
    const cy = corners.reduce((a, q) => a + q.y, 0) / corners.length;
    const first = segments.find((s) => s.id === segIds[0]);
    out.push({ id: pid, pts: corners, sidesFt: mergedSides, cx, cy, color: first?.color || '#065f46' });
  };

  for (const start of segments) {
    for (const dir of [0, 1] as const) {
      const startPt = dir === 0 ? { x: start.x1, y: start.y1 } : { x: start.x2, y: start.y2 };
      const firstPt = dir === 0 ? { x: start.x2, y: start.y2 } : { x: start.x1, y: start.y1 };
      const startKey = key(startPt);
      const dfs = (
        curKey: string,
        prev: RingSegment,
        segIds: string[],
        sides: (number | undefined)[],
        pts: { x: number; y: number }[]
      ) => {
        if (curKey === startKey) {
          if (segIds.length >= 4) tryRecord(segIds, sides, pts);
          return;
        }
        if (segIds.length >= MAX_EDGES) return;
        for (const nxt of adj.get(curKey) || []) {
          if (nxt === prev) continue;
          if (segIds.includes(nxt.id)) continue;
          const a = key({ x: nxt.x1, y: nxt.y1 });
          const b = key({ x: nxt.x2, y: nxt.y2 });
          if (a !== curKey && b !== curKey) continue;
          const to = a === curKey ? b : a;
          const apt = a === curKey ? { x: nxt.x2, y: nxt.y2 } : { x: nxt.x1, y: nxt.y1 };
          if (to === startKey && segIds.length < 3) continue; // ৪ দাগের কমে রিং হয় না
          if (to !== startKey && segIds.length >= MAX_EDGES - 1) continue; // ৬ দাগের বেশি নয়
          dfs(to, nxt, [...segIds, nxt.id], [...sides, nxt.lengthFt], [...pts, apt]);
        }
      };
      dfs(key(firstPt), start, [start.id], [start.lengthFt], [startPt, firstPt]);
    }
  }

  // বাবা-রিং বাদ: যে রিংয়ের ভেতরে আরেকটা রিংয়ের কেন্দ্র আছে, সেটা দুই প্লটের
  // জোড়া (বন্টনের আগের বড় প্লট) — আলাদা প্লট নয়।
  const shoelace = (pts: { x: number; y: number }[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  };
  const inside = (x: number, y: number, pts: { x: number; y: number }[]) => {
    let ok = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      const inter = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
      if (inter) ok = !ok;
    }
    return ok;
  };
  return out.filter((r) => {
    const aR = shoelace(r.pts);
    return !out.some((s) => s !== r && shoelace(s.pts) < aR - 1e-6 && inside(s.cx, s.cy, r.pts));
  });
}

/* ---------------- বাহুর মানের লেবেল: জড়াজড়ি না হয় ----------------
   সরু প্লটে (যেমন ৪ ফুট চওড়া দাগ ২) দুই বাহুর লেবেল এক জায়গায় পড়ে
   একটা আরেকটার নিচে চাপা পড়ে — তাই লেবেল বসানোর আগে জায়গা ঠিক করা হয়:
   ১) দাগের নিজের পাশে, ২) না হলে দাগের উল্টো পাশে (প্লটের বাইরে),
   ৩) না হলে যেটার সাথে জড়াচ্ছে সেটাকে উল্টো পাশে সরিয়ে,
   ৪) না হলে দাগ বরাবর ওপরে/নিচে সরিয়ে। */

export type LabelItem = {
  id: string;
  mx: number; // দাগের মাঝখান
  my: number;
  ox: number; // স্বাভাবিক অফসেট (দাগের লম্ব দিকে)
  oy: number;
  ux: number; // দাগ বরাবর একক ভেক্টর
  uy: number;
  tw: number; // লেবেলের চওড়া/উঁচু (পিক্সেল-একক)
  th: number;
};

export function layoutSideLabels(
  items: LabelItem[],
  bounds: { w: number; h: number }
): Map<string, { cx: number; cy: number }> {
  type Placed = LabelItem & { cx: number; cy: number };
  const placed: Placed[] = [];
  const out = new Map<string, { cx: number; cy: number }>();
  const clamp = (cx: number, cy: number, tw: number, th: number) => ({
    cx: Math.max(tw / 2 + 2, Math.min(bounds.w - tw / 2 - 2, cx)),
    cy: Math.max(th / 2 + 2, Math.min(bounds.h - th / 2 - 2, cy)),
  });
  const overlaps = (a: { cx: number; cy: number; tw: number; th: number }, b: { cx: number; cy: number; tw: number; th: number }) =>
    Math.abs(a.cx - b.cx) < (a.tw + b.tw) / 2 + 2 && Math.abs(a.cy - b.cy) < (a.th + b.th) / 2 + 2;
  const box = (c: { cx: number; cy: number }, tw: number, th: number) => ({ cx: c.cx, cy: c.cy, tw, th });
  const cleanVs = (cand: { cx: number; cy: number; tw: number; th: number }, skipId?: string) =>
    !placed.some((p) => p.id !== skipId && overlaps(cand, p));

  for (const it of items) {
    const base = clamp(it.mx + it.ox, it.my + it.oy, it.tw, it.th);
    const flipped = clamp(it.mx - it.ox, it.my - it.oy, it.tw, it.th);
    let chosen: { cx: number; cy: number } | null = null;
    // ১) নিজের পাশে
    if (cleanVs(box(base, it.tw, it.th))) chosen = base;
    // ২) দাগের উল্টো পাশে (সরু প্লটে বাইরে চলে যায়)
    else if (cleanVs(box(flipped, it.tw, it.th))) chosen = flipped;
    else {
      // ৩) যেটার সাথে জড়াচ্ছে, সেটাকে উল্টো পাশে সরিয়ে নিজে নিজের পাশে থাকা
      const conflict = placed.find((p) => overlaps(box(base, it.tw, it.th), p));
      if (conflict) {
        const cFlip = clamp(conflict.mx - conflict.ox, conflict.my - conflict.oy, conflict.tw, conflict.th);
        const cFlipBox = box(cFlip, conflict.tw, conflict.th);
        if (
          !overlaps(box(base, it.tw, it.th), cFlipBox) &&
          cleanVs(cFlipBox, conflict.id)
        ) {
          conflict.cx = cFlip.cx;
          conflict.cy = cFlip.cy;
          out.set(conflict.id, { cx: cFlip.cx, cy: cFlip.cy });
          chosen = base;
        }
      }
      // ৪) দাগ বরাবর ওপরে/নিচে সরিয়ে
      if (!chosen) {
        for (let k = 1; k <= 4 && !chosen; k++) {
          const d = (it.th + 6) * k;
          for (const sgn of [1, -1]) {
            const c = clamp(base.cx + it.ux * d * sgn, base.cy + it.uy * d * sgn, it.tw, it.th);
            if (cleanVs(box(c, it.tw, it.th))) {
              chosen = c;
              break;
            }
            const cf = clamp(flipped.cx + it.ux * d * sgn, flipped.cy + it.uy * d * sgn, it.tw, it.th);
            if (cleanVs(box(cf, it.tw, it.th))) {
              chosen = cf;
              break;
            }
          }
        }
      }
      // ৫) আর কোনো উপায় নেই — নিজের পাশেই থাকবে
      if (!chosen) chosen = base;
    }
    placed.push({ ...it, cx: chosen.cx, cy: chosen.cy });
    out.set(it.id, { cx: chosen.cx, cy: chosen.cy });
  }
  return out;
}
