/**
 * ধাপ ৮ — এডমিন PIN (একক ব্যবহারকারী, মেইন কপি)।
 *
 * PIN কখনোই সরাসরি সংরক্ষণ করা হয় না — শুধু salt + SHA-256 হ্যাশ (Web Crypto) থাকে।
 * রিকভারি কোডের ক্ষেত্রেও একই নিয়ম। ভুল চেষ্টা ও লকের হিসাব আলাদা key-তে থাকে।
 *
 * এই ফাইলটি অ্যাপের অন্য কোনো কোড import করে না — তাই স্টার্টআপের module গ্রাফে
 * কোনো চক্র (circular chunk) তৈরি করতে পারে না।
 */

const PIN_KEY = 'fa_admin_pin_v1';
const LOCK_KEY = 'fa_admin_pin_lock_v1';
const UNLOCK_KEY = 'fa_admin_unlocked_v1'; // sessionStorage — অ্যাপ বন্ধ হলে মুছে যায়

export const PIN_MIN_LEN = 4;
export const PIN_MAX_LEN = 6;
export const MAX_FAILS = 5;
export const LOCK_SECONDS = 30;
export const AUTO_LOCK_MINUTES = 5;
export const RECOVERY_CODE_LEN = 8;

export interface PinRecord {
  salt: string;
  hash: string;
  recoverySalt: string;
  recoveryHash: string;
  createdAt: number;
  updatedAt: number;
}

interface LockState {
  fails: number;
  lockUntil: number; // epoch ms; 0 = লক নেই
}

function loadPin(): PinRecord | null {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as PinRecord;
    return rec && rec.salt && rec.hash ? rec : null;
  } catch {
    return null;
  }
}

function savePin(rec: PinRecord): void {
  localStorage.setItem(PIN_KEY, JSON.stringify(rec));
}

function loadLock(): LockState {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (raw) {
      const s = JSON.parse(raw) as LockState;
      return { fails: s.fails || 0, lockUntil: s.lockUntil || 0 };
    }
  } catch {
    /* ভাঙা তথ্য হলে নতুন করে শুরু */
  }
  return { fails: 0, lockUntil: 0 };
}

function saveLock(s: LockState): void {
  localStorage.setItem(LOCK_KEY, JSON.stringify(s));
}

/** SHA-256 (Web Crypto)। না থাকলে salt-সহ ফলব্যাক হ্যাশ — PIN কখনো খালি থাকে না। */
async function sha256Hex(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* নিচে ফলব্যাক */
  }
  return fallbackHashHex(text);
}

function fallbackHashHex(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function randomSalt(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** ৮ সংখ্যার ইংরেজি রিকভারি কোড (প্রথম সংখ্যা শূন্য নয়)। */
export function generateRecoveryCode(): string {
  const digits: string[] = [];
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint8Array(RECOVERY_CODE_LEN);
    crypto.getRandomValues(a);
    for (let i = 0; i < RECOVERY_CODE_LEN; i++) {
      digits.push(String(i === 0 ? 1 + (a[i] % 9) : a[i] % 10));
    }
  } else {
    for (let i = 0; i < RECOVERY_CODE_LEN; i++) {
      digits.push(String(i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)));
    }
  }
  return digits.join('');
}

export function hasPin(): boolean {
  return loadPin() !== null;
}

export function isValidPinFormat(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin);
}

export function isValidRecoveryFormat(code: string): boolean {
  return /^[0-9]{8}$/.test(code);
}

/**
 * নতুন PIN বসায় (প্রথমবার বা বদলানোর সময়)। পুরনো রিকভারি কোড বাতিল হয়ে
 * নতুন কোড তৈরি হয় — কোডটি একবারই দেখানো হয়, ফেরত পাওয়া যায় না।
 */
export async function setPin(pin: string): Promise<{ recoveryCode: string }> {
  const prev = loadPin();
  const salt = randomSalt();
  const recoveryCode = generateRecoveryCode();
  const recoverySalt = randomSalt();
  const rec: PinRecord = {
    salt,
    hash: await sha256Hex(`${salt}:${pin}`),
    recoverySalt,
    recoveryHash: await sha256Hex(`${recoverySalt}:${recoveryCode}`),
    createdAt: prev?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  savePin(rec);
  saveLock({ fails: 0, lockUntil: 0 });
  return { recoveryCode };
}

export interface VerifyResult {
  ok: boolean;
  failsLeft: number;
  lockedUntil: number; // epoch ms; 0 = লক নেই
}

export async function verifyPin(pin: string): Promise<VerifyResult> {
  const rec = loadPin();
  if (!rec) return { ok: false, failsLeft: 0, lockedUntil: 0 };
  const lock = loadLock();
  if (lock.lockUntil > Date.now()) {
    return { ok: false, failsLeft: 0, lockedUntil: lock.lockUntil };
  }
  const hash = await sha256Hex(`${rec.salt}:${pin}`);
  if (hash === rec.hash) {
    saveLock({ fails: 0, lockUntil: 0 });
    return { ok: true, failsLeft: MAX_FAILS, lockedUntil: 0 };
  }
  const fails = lock.fails + 1;
  if (fails >= MAX_FAILS) {
    const lockUntil = Date.now() + LOCK_SECONDS * 1000;
    saveLock({ fails: 0, lockUntil });
    return { ok: false, failsLeft: 0, lockedUntil: lockUntil };
  }
  saveLock({ fails, lockUntil: 0 });
  return { ok: false, failsLeft: MAX_FAILS - fails, lockedUntil: 0 };
}

export async function verifyRecovery(code: string): Promise<boolean> {
  const rec = loadPin();
  if (!rec) return false;
  const hash = await sha256Hex(`${rec.recoverySalt}:${code}`);
  if (hash === rec.recoveryHash) {
    saveLock({ fails: 0, lockUntil: 0 });
    return true;
  }
  return false;
}

export function getLockState(): LockState {
  return loadLock();
}

/** লক থাকলে বাকি সেকেন্ড, না থাকলে ০। */
export function lockRemainingSeconds(): number {
  const lock = loadLock();
  if (lock.lockUntil <= Date.now()) return 0;
  return Math.ceil((lock.lockUntil - Date.now()) / 1000);
}

export function clearLock(): void {
  saveLock({ fails: 0, lockUntil: 0 });
}

/** শেষ ৫ মিনিটে আনলক করা থাকলে true (না চালালে আবার PIN চাইবে)। */
export function isUnlocked(): boolean {
  try {
    const raw = sessionStorage.getItem(UNLOCK_KEY);
    if (!raw) return false;
    const { at } = JSON.parse(raw) as { at: number };
    return Date.now() - at < AUTO_LOCK_MINUTES * 60 * 1000;
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    /* sessionStorage না থাকলে আনলক মনে থাকে না — পরেরবার আবার PIN চাইবে */
  }
}

/** চালানো অবস্থায় (টাচ/কি) ৫ মিনিটের ঘড়ি আবার শুরু করে। */
export function touchUnlocked(): void {
  if (isUnlocked()) markUnlocked();
}

export function lockNow(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* উপেক্ষা */
  }
}
