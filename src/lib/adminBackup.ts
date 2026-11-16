/**
 * ধাপ ৮ — ব্যাকআপ (JSON export / import) + লোগো (২৫৬px, IndexedDB)।
 *
 * ব্যাকআপে PIN কখনো যায় না — PIN-এর key গুলো export ও import দুটোতেই বাদ যায়।
 * শুধু faDb import করে (faDb কোনো অ্যাপ-কোড import করে না) — তাই স্টার্টআপের
 * module গ্রাফে কোনো চক্র তৈরি হয় না।
 */
import { idbDelete, idbGet, idbGetAll, idbPut } from './faDb';

export const LAST_BACKUP_KEY = 'fa_admin_last_backup_v1';
export const BACKUP_APP = 'bhumi-o-amin';
export const BACKUP_VERSION = 1;

/** ব্যাকআপ থেকে বাদ যাওয়া key — PIN কোনোভাবেই ফাইলে যাবে না। */
const PIN_KEYS = new Set(['fa_admin_pin_v1', 'fa_admin_pin_lock_v1']);

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string; // ISO তারিখ
  localStorage: Record<string, string>;
  indexedDB: { handmaps: unknown[]; kv: unknown[] };
}

export function getLastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  } catch {
    return null;
  }
}

function setLastBackupAt(ts: number): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(ts));
  } catch {
    /* উপেক্ষা */
  }
}

/** শেষ ব্যাকআপের পর কত দিন — কখনো না নিলে null। */
export function daysSinceBackup(): number | null {
  const last = getLastBackupAt();
  if (last === null) return null;
  return Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
}

export async function buildBackup(): Promise<BackupFile> {
  const ls: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || PIN_KEYS.has(k)) continue;
    const v = localStorage.getItem(k);
    if (v !== null) ls[k] = v;
  }
  const handmaps = await idbGetAll('handmaps').catch(() => [] as unknown[]);
  const kv = await idbGetAll('kv').catch(() => [] as unknown[]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    localStorage: ls,
    indexedDB: { handmaps, kv },
  };
}

/** JSON ফাইল ডাউনলোড করে; সফল হলে "শেষ ব্যাকআপ"-এর তারিখ বসায়। */
export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `bhumi-o-amin-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setLastBackupAt(Date.now());
}

export interface ImportResult {
  localKeys: number;
  handmaps: number;
  kv: number;
}

/** ব্যাকআপ ফাইলের লেখা থেকে ডেটা ফেরত আনে (PIN কখনো ফেরত আসে না)। */
export async function importBackup(text: string): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('ফাইলটি সঠিক JSON নয়');
  }
  const b = data as Partial<BackupFile>;
  if (
    !b ||
    b.app !== BACKUP_APP ||
    b.version !== BACKUP_VERSION ||
    typeof b.localStorage !== 'object' ||
    b.localStorage === null ||
    typeof b.indexedDB !== 'object' ||
    b.indexedDB === null
  ) {
    throw new Error('এটি ভূমি ও আমিন-এর ব্যাকআপ ফাইল নয়');
  }
  let localKeys = 0;
  for (const [k, v] of Object.entries(b.localStorage)) {
    if (PIN_KEYS.has(k) || typeof v !== 'string') continue;
    try {
      localStorage.setItem(k, v);
      localKeys++;
    } catch {
      /* ভরা স্টোরেজ হলে বাকিগুলোও চেষ্টা করি */
    }
  }
  let handmaps = 0;
  let kv = 0;
  for (const rec of b.indexedDB.handmaps ?? []) {
    if (rec && typeof rec === 'object' && 'id' in rec) {
      await idbPut('handmaps', rec as { id: string } & Record<string, unknown>);
      handmaps++;
    }
  }
  for (const rec of b.indexedDB.kv ?? []) {
    if (rec && typeof rec === 'object' && 'id' in rec) {
      await idbPut('kv', rec as { id: string } & Record<string, unknown>);
      kv++;
    }
  }
  return { localKeys, handmaps, kv };
}

/* ---------------- লোগো (২৫৬px, IndexedDB kv) ---------------- */

export const LOGO_KV_ID = 'admin-logo';

export async function loadAdminLogo(): Promise<string | null> {
  try {
    const rec = (await idbGet('kv', LOGO_KV_ID)) as { id: string; value?: unknown } | undefined;
    return typeof rec?.value === 'string' ? rec.value : null;
  } catch {
    return null;
  }
}

export async function saveAdminLogo(dataUrl: string): Promise<void> {
  await idbPut('kv', { id: LOGO_KV_ID, value: dataUrl, updatedAt: Date.now() });
}

export async function removeAdminLogo(): Promise<void> {
  await idbDelete('kv', LOGO_KV_ID);
}

/** ছবিকে সবচেয়ে বড় দিক ২৫৬px-এ ছোট করে PNG data URL দেয়। */
export function resizeImageTo256(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('ক্যানভাস খোলা যায়নি'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('ছবিটি খোলা যায়নি'));
    };
    img.src = url;
  });
}
