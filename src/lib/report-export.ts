/**
 * ধাপ ৭ — রিপোর্ট PNG / PDF এক্সপোর্ট ও শেয়ার।
 *
 * পদ্ধতি (ক্রমে):
 *  ১. SVG foreignObject + এমবেডেড বাংলা ফন্ট (handmapStore-এর প্রমাণিত
 *     embeddedFontCss প্যাটার্ন) — অফলাইনেও বাংলা ঠিক থাকে, কোনো সার্ভার লাগে না।
 *  ২. ব্যর্থ হলে html2canvas (ফলব্যাক, dynamic import — মূল বান্ডেলে আসে না)।
 * PDF: ছবি-ভিত্তিক (PNG পাতা A4 210×297mm-এ বসানো) — বাংলা সবসময় ঠিক থাকে।
 * শেয়ার: HandMapScreen-এর doShare প্যাটার্ন (navigator.share + canShare({files})
 * + ডাউনলোড ফলব্যাক)।
 */
import { jsPDF } from 'jspdf';
import { embeddedFontCss, downloadBlob } from './handmapStore';

export { downloadBlob };

const A4_W_PX = 794;
const A4_H_PX = 1123;

/** রিপোর্টের A4 পাতাগুলো (DOM) — প্রিন্ট এরিয়া থেকে */
export function getReportPageElements(): HTMLElement[] {
  const area = document.getElementById('report-printable-area');
  if (!area) return [];
  return Array.from(area.querySelectorAll<HTMLElement>('.a4-page'));
}

export const reportFileName = (reportNumber: string, ext: 'pdf' | 'png', page?: number) => {
  const base = `report-${(reportNumber || 'report').replace(/[^\p{L}\p{N}-]+/gu, '_')}`;
  return page !== undefined ? `${base}-p${page}.${ext}` : `${base}.${ext}`;
};

/** input/textarea-র লাইভ মান clone-এ বসাই — নইলে সিরিয়ালাইজে খালি দেখায়
 *  (একই পাতার ভেতরে ক্রম মিলিয়ে — দুই পাতার ইনপুট গুলিয়ে যাবে না) */
function inlineFormValues(livePage: HTMLElement, clone: HTMLElement) {
  const live = livePage.querySelectorAll('input, textarea');
  const clones = clone.querySelectorAll('input, textarea');
  live.forEach((el, i) => {
    const c = clones[i] as HTMLInputElement | HTMLTextAreaElement | undefined;
    if (!c) return;
    if (el instanceof HTMLInputElement) c.setAttribute('value', el.value);
    else if (el instanceof HTMLTextAreaElement) c.textContent = el.value;
  });
}

function clonePageForExport(page: HTMLElement): HTMLElement {
  const clone = page.cloneNode(true) as HTMLElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.width = `${A4_W_PX}px`;
  clone.style.height = `${A4_H_PX}px`;
  clone.style.minHeight = `${A4_H_PX}px`;
  clone.style.maxHeight = `${A4_H_PX}px`;
  clone.style.margin = '0';
  (clone.style as CSSStyleDeclaration & { zoom?: string }).zoom = '1';
  clone.style.transform = 'none';
  inlineFormValues(page, clone);
  return clone;
}

async function svgStringForPage(page: HTMLElement): Promise<string> {
  const css = await embeddedFontCss();
  const clone = clonePageForExport(page);
  const html = new XMLSerializer().serializeToString(clone);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_W_PX}" height="${A4_H_PX}" viewBox="0 0 ${A4_W_PX} ${A4_H_PX}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css} *{font-family:'Noto Sans Bengali',sans-serif !important;}</style>${html}</div></foreignObject></svg>`;
}

function svgToPng(svg: string, scale: number): Promise<Blob> {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = A4_W_PX * scale;
        c.height = A4_H_PX * scale;
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('ক্যানভাস হয়নি');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? ok(b) : bad(new Error('PNG হয়নি'))), 'image/png');
      } catch (e) {
        URL.revokeObjectURL(url);
        bad(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      bad(new Error('ছবি তৈরি হয়নি'));
    };
    img.src = url;
  });
}

/** এক পাতা → PNG (foreignObject; ব্যর্থ হলে html2canvas) */
export async function pageToPng(page: HTMLElement, scale = 2): Promise<Blob> {
  try {
    const svg = await svgStringForPage(page);
    // ফন্ট লোডের জন্য এক মুহূর্ত (হ্যান্ড ম্যাপের মতো)
    await new Promise((r) => setTimeout(r, 80));
    return await svgToPng(svg, scale);
  } catch (e) {
    // ফলব্যাক: html2canvas
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(page, { scale, backgroundColor: '#ffffff', logging: false });
    const blob = await new Promise<Blob>((ok, bad) =>
      canvas.toBlob((b) => (b ? ok(b) : bad(new Error('PNG হয়নি'))), 'image/png')
    );
    return blob;
  }
}

/** সব পাতা → PNG তালিকা */
export async function reportPagesToPngs(scale = 2): Promise<Blob[]> {
  const pages = getReportPageElements();
  if (!pages.length) throw new Error('রিপোর্টের পাতা পাওয়া যায়নি');
  const out: Blob[] = [];
  for (const p of pages) out.push(await pageToPng(p, scale));
  return out;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((ok, bad) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = () => bad(fr.error);
    fr.readAsDataURL(blob);
  });

/** সব পাতা → ছবি-ভিত্তিক A4 PDF ফাইল */
export async function reportToPdfBlob(scale = 2): Promise<Blob> {
  const pngs = await reportPagesToPngs(scale);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  for (let i = 0; i < pngs.length; i++) {
    if (i > 0) doc.addPage('a4', 'portrait');
    const dataUrl = await blobToDataUrl(pngs[i]);
    doc.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
  }
  return doc.output('blob');
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'unsupported';

function navCanShare(files: File[]): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  return !!nav.share && !!nav.canShare && nav.canShare({ files });
}

/** ফাইল শেয়ার (Android শেয়ার শিট) — না হলে ডাউনলোড */
export async function shareFiles(files: File[], title: string, text: string): Promise<ShareOutcome> {
  if (navCanShare(files)) {
    try {
      await navigator.share({ files, title, text });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      // নিচে ডাউনলোড ফলব্যাকে যাবে
    }
  }
  for (const f of files) downloadBlob(f, f.name);
  return 'downloaded';
}

/** WhatsApp-এ PDF পাঠানো: ফাইল শেয়ার যায় এমন ফোনে শেয়ার শিট (WhatsApp বাছা যায়),
 *  না গেলে wa.me লিংকে লেখা + রিপোর্ট লিংক খোলে (ফাইলে সংযুক্ত করা যায় না)। */
export async function sharePdfViaWhatsApp(
  pdfBlob: Blob,
  fileName: string,
  text: string,
  reportUrl: string
): Promise<ShareOutcome> {
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
  if (navCanShare([file])) {
    try {
      await navigator.share({ files: [file], title: 'ভূমি সার্ভে রিপোর্ট', text });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  // ফাইল সংযুক্ত করা যায় না — PDF ফোনে সেভ করে দিই, যাতে হাতে সংযুক্ত করা যায়
  downloadBlob(pdfBlob, fileName);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${reportUrl}`)}`, '_blank');
  return 'unsupported';
}
