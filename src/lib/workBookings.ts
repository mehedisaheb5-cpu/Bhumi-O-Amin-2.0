/**
 * ধাপ ৯ — কাজের ক্যালেন্ডারের বুকিং (IndexedDB `fa-bhumi` / `bookings`)।
 * সম্পূর্ণ অফলাইন, শুধু এই ফোনে থাকে। এই ফাইল শুধু faDb import করে —
 * কোনো কম্পোনেন্ট import করে না, তাই স্টার্টআপের module গ্রাফে ঢুকলেও চক্র হয় না।
 * IndexedDB না থাকলে (যেমন jsdom পরীক্ষা) সব ফাংশন খালি ফলাফল দেয়, throw করে না।
 */

import { idbDelete, idbGetAll, idbPut } from './faDb';

export interface WorkBooking {
  id: string;
  /** তারিখ: YYYY-MM-DD (ফোনের স্থানীয় তারিখ) */
  date: string;
  /** সময়: HH:MM (24 ঘণ্টা) */
  time: string;
  /** ক্লায়েন্টের নাম */
  name: string;
  /** মোবাইল: 01 + ৯ সংখ্যা */
  phone: string;
  /** দিনের কাজের জায়গা */
  place: string;
  /** ক্লায়েন্টের ঠিকানা */
  address: string;
  mouza?: string;
  dag?: string;
  /** কাজের ধরন: দখল পরিমাপ / বাটোয়ারা / সীমানা / খতিয়ান যাচাই / অন্যান্য */
  type: string;
  /** মোট ফি (টাকা) */
  fee: number;
  /** অগ্রিম পাওয়া (টাকা) */
  advance: number;
  note?: string;
  status: 'todo' | 'done' | 'cancelled';
  createdAt: number;
}

export const BOOKING_TYPES = ['দখল পরিমাপ', 'বাটোয়ারা', 'সীমানা', 'খতিয়ান যাচাই', 'অন্যান্য'];

/** স্থানীয় তারিখ → YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayStr(now = new Date()): string {
  return toDateStr(now);
}

export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** বাংলাদেশের সপ্তাহ শনিবার থেকে শুরু */
export function weekStartStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return addDaysStr(dateStr, -((d.getDay() + 1) % 7));
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

export function isValidPhone(phone: string): boolean {
  return /^01\d{9}$/.test(phone.trim());
}

export function newBookingId(): string {
  return `wb_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function sortBookings(list: WorkBooking[]): WorkBooking[] {
  return [...list].sort((a, b) =>
    a.date === b.date ? timeToMin(a.time) - timeToMin(b.time) : a.date < b.date ? -1 : 1,
  );
}

export async function getAllBookings(): Promise<WorkBooking[]> {
  try {
    const all = await idbGetAll<WorkBooking>('bookings');
    return sortBookings(all || []);
  } catch {
    return [];
  }
}

export async function saveBooking(b: WorkBooking): Promise<void> {
  await idbPut('bookings', b as unknown as { id: string } & Record<string, unknown>);
}

export async function deleteBooking(id: string): Promise<void> {
  try {
    await idbDelete('bookings', id);
  } catch {
    /* মুছতে না পারলে চুপচাপ — তালিকা আবার লোড হবে */
  }
}

export function bookingsOn(list: WorkBooking[], dateStr: string): WorkBooking[] {
  return list.filter((b) => b.date === dateStr && b.status !== 'cancelled');
}

export function isActive(b: WorkBooking): boolean {
  return b.status !== 'cancelled';
}

/** ৯০ মিনিটের মধ্যে আরেকটি বুকিং থাকলে সেটা ফেরত দেয় (সংঘর্ষের সতর্কতা)। */
export function findClash(
  list: WorkBooking[],
  date: string,
  time: string,
  excludeId?: string,
): WorkBooking | undefined {
  const t = timeToMin(time);
  return list.find(
    (b) =>
      b.id !== excludeId &&
      b.date === date &&
      b.status !== 'cancelled' &&
      Math.abs(timeToMin(b.time) - t) < 90,
  );
}

export function dueAmount(b: WorkBooking): number {
  return b.status === 'done' || b.status === 'cancelled' ? 0 : Math.max(0, (b.fee || 0) - (b.advance || 0));
}

export function calcStats(list: WorkBooking[], now = new Date()): { today: number; week: number; due: number } {
  const t = toDateStr(now);
  const ws = weekStartStr(t);
  const we = addDaysStr(ws, 6);
  let today = 0;
  let week = 0;
  let due = 0;
  for (const b of list) {
    if (!isActive(b)) continue;
    if (b.date === t) today++;
    if (b.date >= ws && b.date <= we) week++;
    due += dueAmount(b);
  }
  return { today, week, due };
}

/** এখন থেকে সবচেয়ে কাছের বাকি কাজ */
export function nextBooking(list: WorkBooking[], now = new Date()): WorkBooking | undefined {
  const t = toDateStr(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  return sortBookings(list).find(
    (b) => b.status === 'todo' && (b.date > t || (b.date === t && timeToMin(b.time) >= mins)),
  );
}

/** একটা বুকিংয়ের .ics ফাইল (ফোনের ক্যালেন্ডারে যোগ করা যায়, ১ ঘণ্টা আগে রিমাইন্ডার)। */
export function bookingToIcs(b: WorkBooking): string {
  const d = b.date.replace(/-/g, '');
  const startMin = timeToMin(b.time);
  const endMin = startMin + 90;
  const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`;
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bhumi O Amin//Work Booking//BN',
    'BEGIN:VEVENT',
    `UID:${b.id}@bhumi-o-amin`,
    `DTSTAMP:${d}T${hhmm(startMin)}`,
    `DTSTART:${d}T${hhmm(startMin)}`,
    `DTEND:${d}T${hhmm(endMin)}`,
    `SUMMARY:${esc(`জমি পরিমাপ — ${b.name} (${b.place})`)}`,
    `DESCRIPTION:${esc(
      [`ক্লায়েন্ট: ${b.name}`, `ফোন: ${b.phone}`, `ঠিকানা: ${b.address}`, b.mouza ? `মৌজা: ${b.mouza}` : '', b.dag ? `দাগ: ${b.dag}` : '', `ধরন: ${b.type}`, `ফি: ${b.fee} টাকা, অগ্রিম: ${b.advance} টাকা`, b.note ? `নোট: ${b.note}` : ''].filter(Boolean).join('\n'),
    )}`,
    `LOCATION:${esc(b.place)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`পরিমাপ — ${b.name}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function downloadIcs(b: WorkBooking): void {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bookingToIcs(b)], { type: 'text/calendar' }));
    a.download = `booking-${b.date}-${b.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    /* ডাউনলোড না হলে চুপচাপ — টোস্টে জানানো হয় কলারের কাজ */
  }
}
