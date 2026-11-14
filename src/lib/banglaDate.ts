/**
 * বাংলা তারিখ (বঙ্গাব্দ) — বাংলাদেশের সংশোধিত পঞ্জিকা (২০১৯):
 * ১ বৈশাখ = ১৪ এপ্রিল; বৈশাখ–আশ্বিন ৩১ দিন, কার্তিক–মাঘ ৩০ দিন,
 * ফাল্গুন ২৯ দিন (পরের ইংরেজি বছর অধিবর্ষ হলে ৩০), চৈত্র ৩০ দিন।
 */
export const toBnDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);

export const BN_MONTHS = ['বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'];
export const SEASONS = ['গ্রীষ্মকাল', 'বর্ষাকাল', 'শরৎকাল', 'হেমন্তকাল', 'শীতকাল', 'বসন্তকাল'];
export const EN_MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export const WEEKDAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function banglaDate(date: Date): { d: number; m: number; y: number } {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let gy = day.getFullYear();
  if (day < new Date(gy, 3, 14)) gy -= 1;
  const start = new Date(gy, 3, 14);
  let diff = Math.round((day.getTime() - start.getTime()) / 86400000);
  const lens = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, isLeap(gy + 1) ? 30 : 29, 30];
  let m = 0;
  while (m < 11 && diff >= lens[m]) {
    diff -= lens[m];
    m++;
  }
  return { d: diff + 1, m, y: gy - 593 };
}

/** দিনের অংশ: ভোর / সকাল / দুপুর / বিকেল / সন্ধ্যা / রাত */
export function dayPeriod(h: number): string {
  if (h < 4) return 'রাত';
  if (h < 6) return 'ভোর';
  if (h < 12) return 'সকাল';
  if (h < 15) return 'দুপুর';
  if (h < 18) return 'বিকেল';
  if (h < 20) return 'সন্ধ্যা';
  return 'রাত';
}

export function formatNow(now: Date) {
  const h = now.getHours();
  const b = banglaDate(now);
  return {
    time: toBnDigits(`${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`),
    period: dayPeriod(h),
    en: `${WEEKDAYS_BN[now.getDay()]}, ${toBnDigits(now.getDate())} ${EN_MONTHS_BN[now.getMonth()]} ${toBnDigits(now.getFullYear())}`,
    bn: `${toBnDigits(b.d)} ${BN_MONTHS[b.m]} ${toBnDigits(b.y)} বঙ্গাব্দ`,
    season: SEASONS[Math.floor(b.m / 2)],
  };
}
