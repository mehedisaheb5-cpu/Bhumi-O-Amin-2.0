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
  /** রিমাইন্ডার: আগের দিন সন্ধ্যা ৭টা (অনুপস্থিত = বন্ধ) */
  remEvening?: boolean;
  /** রিমাইন্ডার: কাজের ১ ঘণ্টা আগে (অনুপস্থিত = চালু — আগের আচরণ) */
  remHour?: boolean;
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

/** কাজের সময়: সকাল ৯টা – বিকেল ৪টা */
export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 16;

/** আজ বুকিং দেওয়া যাবে কি না — বিকেল ৪টা বা তার পরে আর আজকের জন্য নয় */
export function isTodayBookable(now = new Date()): boolean {
  return now.getHours() < WORK_END_HOUR;
}

/** তারিখে বুকিং দেওয়া যাবে কি না — গত তারিখ নয়, আর বিকেল ৪টার পর আজ নয় */
export function isBookableDate(dateStr: string, now = new Date()): boolean {
  const t = todayStr(now);
  if (dateStr < t) return false;
  if (dateStr === t) return isTodayBookable(now);
  return true;
}

/** শুরুর সময় কাজের সময়ের মধ্যে কি না (০৯:০০–১৬:০০, দুই প্রান্তসহ) */
export function isWithinWorkingHours(time: string): boolean {
  const m = timeToMin(time);
  return m >= WORK_START_HOUR * 60 && m <= WORK_END_HOUR * 60;
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

/** আগের দিন সন্ধ্যা ৭টার রিমাইন্ডার চালু কি না (পুরোনো বুকিংয়ে অনুপস্থিত = বন্ধ) */
export function hasEveningReminder(b: WorkBooking): boolean {
  return b.remEvening === true;
}

/** কাজের ১ ঘণ্টা আগের রিমাইন্ডার চালু কি না (পুরোনো বুকিংয়ে অনুপস্থিত = চালু) */
export function hasHourReminder(b: WorkBooking): boolean {
  return b.remHour !== false;
}

/** আগামীকালের যেসব বাকি কাজে সন্ধ্যার রিমাইন্ডার চালু আছে */
export function tomorrowReminders(list: WorkBooking[], now = new Date()): WorkBooking[] {
  const tmr = addDaysStr(toDateStr(now), 1);
  return sortBookings(list).filter((b) => b.date === tmr && b.status === 'todo' && hasEveningReminder(b));
}

/** রিমাইন্ডারের সংক্ষিপ্ত লেখা (বিস্তারিত পাতা / টোস্টের জন্য) */
export function reminderText(b: WorkBooking): string {
  const parts: string[] = [];
  if (hasEveningReminder(b)) parts.push('আগের দিন সন্ধ্যা ৭টা');
  if (hasHourReminder(b)) parts.push('কাজের ১ ঘণ্টা আগে');
  return parts.length ? parts.join(' · ') : 'রিমাইন্ডার বন্ধ';
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

/** একটা বুকিংয়ের .ics ফাইল (ফোনের ক্যালেন্ডারে যোগ করা যায়)।
 * রিমাইন্ডার: সন্ধ্যারটা আগের দিন ১৯:০০-তে নির্দিষ্ট VALARM,
 * ১ ঘণ্টা আগেরটা আপেক্ষিক VALARM — ফোনের ক্যালেন্ডারেই অ্যালার্ম বাজে। */
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
  ];
  if (hasEveningReminder(b)) {
    const eve = addDaysStr(b.date, -1).replace(/-/g, '');
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER;VALUE=DATE-TIME:${eve}T190000`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`আগামীকাল পরিমাপ — ${b.name} (${b.place})`)}`,
      'END:VALARM',
    );
  }
  if (hasHourReminder(b)) {
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`পরিমাপ — ${b.name}`)}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
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
