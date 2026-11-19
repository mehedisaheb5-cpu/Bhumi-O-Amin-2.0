/**
 * ধাপ ৯ — কাজের ক্যালেন্ডার (ডিজাইন B: প্রিমিয়াম সবুজ-সোনালি)।
 * design-previews/13-profile.html (B) + DESIGN-SUMMARY.md সারি ১৩ ও ১০ (B + C)।
 * বুকিং IndexedDB-তে থাকে (src/lib/workBookings.ts)। এই স্ক্রিন lazy-load হয়
 * (App.tsx) — স্টার্টআপ গ্রাফে নেই।
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  BOOKING_TYPES,
  WorkBooking,
  addDaysStr,
  bookingsOn,
  calcStats,
  deleteBooking,
  downloadIcs,
  dueAmount,
  findClash,
  getAllBookings,
  hasEveningReminder,
  hasHourReminder,
  isValidPhone,
  newBookingId,
  nextBooking,
  reminderText,
  saveBooking,
  timeToMin,
  todayStr,
  toDateStr,
  tomorrowReminders,
  weekStartStr,
} from '../../lib/workBookings';
import { toBnDigits } from '../../lib/banglaDate';
import { telHref } from '../../lib/profileStore';

type View = 'week' | 'agenda' | 'month';

const WEEKDAYS = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র'];
const MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
const SHORT_MONTH = ['জানু.', 'ফেব্রু.', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে.', 'অক্টো.', 'নভে.', 'ডিসে.'];

const taka = (n: number) => `৳${toBnDigits(n.toLocaleString('en-US'))}`;

function parseDate(s: string): Date {
  return new Date(`${s}T12:00:00`);
}

function fmtDay(s: string): string {
  const d = parseDate(s);
  return `${WEEKDAYS[(d.getDay() + 1) % 7]}বার, ${toBnDigits(d.getDate())} ${SHORT_MONTH[d.getMonth()]}`;
}

function relDay(s: string, today: string): string {
  if (s === today) return 'আজ';
  if (s === addDaysStr(today, 1)) return 'আগামীকাল';
  if (s === addDaysStr(today, -1)) return 'গতকাল';
  return fmtDay(s);
}

function timeLabel(t: string): string {
  const h = Math.floor(timeToMin(t) / 60);
  const m = timeToMin(t) % 60;
  const part = h < 4 ? 'রাত' : h < 12 ? 'সকাল' : h < 16 ? 'দুপুর' : h < 18 ? 'বিকেল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${toBnDigits(h12)}:${toBnDigits(String(m).padStart(2, '0'))} ${part}`;
}

function untilTxt(b: WorkBooking, now: Date): string {
  const start = new Date(`${b.date}T${b.time}:00`).getTime();
  const diff = Math.round((start - now.getTime()) / 60000);
  if (diff < 0) return 'সময় পেরিয়ে গেছে';
  if (diff < 60) return `${toBnDigits(diff)} মিনিট পর`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${toBnDigits(h)} ঘণ্টা পর`;
  return `${toBnDigits(Math.floor(h / 24))} দিন পর`;
}

const STATUS_PILL: Record<WorkBooking['status'], { t: string; c: string }> = {
  todo: { t: 'বাকি', c: 'bg-amber-100 text-amber-800' },
  done: { t: 'সম্পন্ন', c: 'bg-emerald-100 text-emerald-800' },
  cancelled: { t: 'বাতিল', c: 'bg-slate-200 text-slate-600' },
};

interface FormState {
  id?: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  place: string;
  address: string;
  mouza: string;
  dag: string;
  type: string;
  fee: string;
  advance: string;
  note: string;
  /** রিমাইন্ডার: আগের দিন সন্ধ্যা ৭টা */
  remEvening: boolean;
  /** রিমাইন্ডার: কাজের ১ ঘণ্টা আগে */
  remHour: boolean;
}

const emptyForm = (date: string): FormState => ({
  date,
  time: '10:00',
  name: '',
  phone: '',
  place: '',
  address: '',
  mouza: '',
  dag: '',
  type: BOOKING_TYPES[0],
  fee: '',
  advance: '',
  note: '',
  remEvening: true,
  remHour: true,
});

function toForm(b: WorkBooking): FormState {
  return {
    id: b.id,
    date: b.date,
    time: b.time,
    name: b.name,
    phone: b.phone,
    place: b.place,
    address: b.address,
    mouza: b.mouza || '',
    dag: b.dag || '',
    type: b.type,
    fee: String(b.fee || ''),
    advance: String(b.advance || ''),
    note: b.note || '',
    remEvening: hasEveningReminder(b),
    remHour: hasHourReminder(b),
  };
}

export const WorkCalendarScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const today = todayStr();
  const [bookings, setBookings] = useState<WorkBooking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>('week');
  const [sel, setSel] = useState(today);
  const [wk, setWk] = useState(() => weekStartStr(today));
  const [ym, setYm] = useState(today.slice(0, 7));
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<WorkBooking | null>(null);
  const [clash, setClash] = useState<{ cand: WorkBooking; existing: WorkBooking } | null>(null);
  const [deleted, setDeleted] = useState<WorkBooking | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const undoTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getAllBookings().then((all) => {
      if (alive) {
        setBookings(all);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(undoTimer.current);
    },
    [],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2500);
  };

  const stats = useMemo(() => calcStats(bookings), [bookings]);
  const nx = useMemo(() => nextBooking(bookings), [bookings]);
  const selList = useMemo(() => bookingsOn(bookings, sel), [bookings, sel]);
  /** আগামীকালের কাজ — সন্ধ্যার রিমাইন্ডার চালু থাকলে ব্যানার দেখাবে */
  const tmrRem = useMemo(() => tomorrowReminders(bookings), [bookings]);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const pickDate = (d: string) => {
    setSel(d);
    setWk(weekStartStr(d));
    setYm(d.slice(0, 7));
    // বেছে নেওয়া দিনটা স্ট্রিপের মাঝে এনে দিন (jsdom-এ scrollIntoView নেই — গার্ড করা)
    try {
      const el = stripRef.current?.querySelector<HTMLButtonElement>(`[data-day="${d}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    } catch {
      /* স্ক্রল না হলে চুপচাপ — দিন বাছাই এমনিতেই কাজ করে */
    }
  };

  const persist = async (b: WorkBooking) => {
    setBookings((prev) => {
      const next = prev.some((x) => x.id === b.id) ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b];
      return [...next].sort((a, c) =>
        a.date === c.date ? timeToMin(a.time) - timeToMin(c.time) : a.date < c.date ? -1 : 1,
      );
    });
    try {
      await saveBooking(b);
    } catch {
      showToast('সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন');
    }
  };

  const doDelete = (b: WorkBooking) => {
    setBookings((prev) => prev.filter((x) => x.id !== b.id));
    void deleteBooking(b.id);
    setDeleted(b);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setDeleted(null), 5000);
  };

  const undoDelete = () => {
    if (!deleted) return;
    window.clearTimeout(undoTimer.current);
    void persist(deleted);
    setDeleted(null);
    showToast('বুকিং ফেরত আনা হয়েছে');
  };

  const submitForm = (f: FormState) => {
    if (!f.name.trim()) return showToast('ক্লায়েন্টের নাম দিন');
    if (!isValidPhone(f.phone)) return showToast('মোবাইল নম্বর 01 দিয়ে ১১ সংখ্যার হতে হবে');
    if (!f.place.trim()) return showToast('জায়গা দিন');
    if (!f.date || !f.time) return showToast('তারিখ ও সময় দিন');
    const cand: WorkBooking = {
      id: f.id || newBookingId(),
      date: f.date,
      time: f.time,
      name: f.name.trim(),
      phone: f.phone.trim(),
      place: f.place.trim(),
      address: f.address.trim(),
      mouza: f.mouza.trim() || undefined,
      dag: f.dag.trim() || undefined,
      type: f.type,
      fee: parseInt(f.fee, 10) || 0,
      advance: parseInt(f.advance, 10) || 0,
      note: f.note.trim() || undefined,
      remEvening: f.remEvening,
      remHour: f.remHour,
      status: 'todo',
      createdAt: Date.now(),
    };
    const existing = findClash(bookings, cand.date, cand.time, cand.id);
    if (existing) {
      setClash({ cand, existing });
      return;
    }
    void persist(cand).then(() => {
      setForm(null);
      pickDate(cand.date);
      showToast('বুকিং রাখা হয়েছে');
    });
  };

  const confirmClashSave = () => {
    if (!clash) return;
    const cand = clash.cand;
    setClash(null);
    void persist(cand).then(() => {
      setForm(null);
      pickDate(cand.date);
      showToast('বুকিং রাখা হয়েছে');
    });
  };

  const agendaGroups: Array<[string, (b: WorkBooking) => boolean]> = [
    ['আজ', (b) => b.date === today],
    ['আগামীকাল', (b) => b.date === addDaysStr(today, 1)],
    ['এই ৭ দিনে', (b) => b.date > addDaysStr(today, 1) && b.date <= addDaysStr(today, 7)],
    ['পরে', (b) => b.date > addDaysStr(today, 7)],
  ];

  const filtered = useMemo(() => {
    const needle = q.trim();
    const all = bookings.filter((b) => b.status !== 'cancelled');
    if (!needle) return all;
    return all.filter(
      (b) =>
        b.name.includes(needle) ||
        b.phone.includes(needle) ||
        b.place.includes(needle) ||
        (b.mouza || '').includes(needle) ||
        (b.dag || '').includes(needle),
    );
  }, [bookings, q]);

  /** সপ্তাহের স্ট্রিপ: ১৪ দিন, পাশাপাশি স্মুথ স্ক্রল (প্রিভিউ 14, ডিজাইন A) */
  const weekDays = [...Array(14)].map((_, i) => addDaysStr(wk, i));

  const monthCells = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 1) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: Array<{ d: string | null; n: number }> = [];
    for (let i = 0; i < offset; i++) cells.push({ d: null, n: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ d: ds, n: bookingsOn(bookings, ds).length });
    }
    return cells;
  }, [ym, bookings]);

  const shiftMonth = (delta: number) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const now = new Date();

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* B হিরো */}
      <div className="bg-[#065f46] text-white rounded-b-[26px] -mx-3.5 sm:mx-0 -mt-3.5 px-4 pt-3 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="ফিরে যান"
            className="w-12 h-12 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center active:scale-95 transition"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-xl font-extrabold text-white">কাজের শিডিউল</h1>
          <button
            onClick={() => setForm(emptyForm(sel))}
            aria-label="নতুন বুকিং"
            className="w-12 h-12 shrink-0 rounded-2xl bg-[#fde68a] text-[#422006] flex items-center justify-center active:scale-95 transition"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
        {nx ? (
          <button
            onClick={() => setDetail(nx)}
            className="mt-3 w-full text-left bg-[#fde68a] text-[#422006] rounded-[18px] p-3.5 flex items-center gap-3 active:scale-[.99] transition"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-normal opacity-80">
                পরের কাজ · {relDay(nx.date, today)} {timeLabel(nx.time)} ({untilTxt(nx, now)})
              </span>
              <b className="block text-lg font-extrabold leading-tight truncate">{nx.name}</b>
              <span className="block text-sm font-semibold truncate">{nx.place}</span>
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label="কল করুন"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = telHref(nx.phone);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') window.location.href = telHref(nx.phone);
              }}
              className="w-12 h-12 shrink-0 rounded-full bg-[#065f46] text-white flex items-center justify-center"
            >
              <Phone className="w-5 h-5" />
            </span>
          </button>
        ) : (
          <div className="mt-3 bg-white/10 border border-[#fde68a]/45 rounded-[18px] p-3.5 text-center">
            <b className="text-[16px] font-extrabold text-[#fde68a]">সামনে কোনো কাজ নেই</b>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { n: `${toBnDigits(stats.today)}টি`, t: 'আজকের কাজ' },
            { n: `${toBnDigits(stats.week)}টি`, t: 'এই সপ্তাহে' },
            { n: taka(stats.due), t: 'বাকি পাওনা' },
          ].map((x) => (
            <div key={x.t} className="bg-white/10 border border-[#fde68a]/45 rounded-[14px] py-1.5 px-1 text-center">
              <b className="block text-[19px] font-extrabold text-[#fde68a] leading-tight">{x.n}</b>
              <span className="text-sm text-emerald-100">{x.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* রিমাইন্ডার ব্যানার — আগামীকালের কাজ, সন্ধ্যার রিমাইন্ডার চালু (ডিজাইন A: হালকা সবুজ সারি) */}
      {tmrRem.length > 0 && (
        <button
          onClick={() => pickDate(tmrRem[0].date)}
          className="w-full text-left bg-[#f0fdf4] border-[1.5px] border-[#86efac] rounded-2xl p-3 flex items-start gap-2.5 active:scale-[.99] transition"
        >
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#065f46] text-[#fde68a] flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <b className="block text-[16px] font-extrabold text-slate-900">
              আগামীকাল {toBnDigits(tmrRem.length)}টি কাজ — আজ সন্ধ্যা ৭টায় জানানো হবে
            </b>
            <span className="block text-sm font-normal text-slate-600 truncate">
              {tmrRem.map((b) => `${b.name} · ${timeLabel(b.time)}`).join(' · ')}
            </span>
          </span>
        </button>
      )}

      {/* ভিউ বদল */}
      <div className="grid grid-cols-3 gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5">
        {(
          [
            ['week', 'সপ্তাহ'],
            ['agenda', 'তালিকা'],
            ['month', 'মাস'],
          ] as Array<[View, string]>
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`min-h-[48px] rounded-xl text-[16px] font-extrabold transition ${
              view === v ? 'bg-[#065f46] text-white' : 'text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* সপ্তাহ ভিউ — ১৪ দিনের স্ট্রিপ, পাশাপাশি স্মুথ স্ক্রল (প্রিভিউ 14, ডিজাইন A) */}
      {view === 'week' && (
        <>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWk(addDaysStr(wk, -7))}
              aria-label="আগের সপ্তাহ"
              className="w-12 h-12 shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center active:scale-95 transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div
              ref={stripRef}
              className="flex-1 min-w-0 flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {weekDays.map((d) => {
                const c = bookingsOn(bookings, d).length;
                const dd = parseDate(d);
                return (
                  <button
                    key={d}
                    data-day={d}
                    onClick={() => pickDate(d)}
                    className={`shrink-0 w-[54px] snap-center rounded-2xl py-2 px-0.5 text-center min-h-[64px] active:scale-95 transition ${
                      d === sel
                        ? 'bg-[#065f46] text-white'
                        : d === today
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-white border border-slate-200'
                    }`}
                  >
                    <small className="block text-[12px] font-normal">{WEEKDAYS[(dd.getDay() + 1) % 7]}</small>
                    <b className="block text-lg font-bold leading-tight">{toBnDigits(dd.getDate())}</b>
                    {c > 0 && (
                      <i className={`block text-[11px] font-bold not-italic ${d === sel ? 'text-[#fde68a]' : 'text-[#065f46]'}`}>
                        {toBnDigits(c)}টি
                      </i>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setWk(addDaysStr(wk, 7))}
              aria-label="পরের সপ্তাহ"
              className="w-12 h-12 shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center active:scale-95 transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          <DayList dateStr={sel} today={today} list={selList} onOpen={setDetail} onNew={() => setForm(emptyForm(sel))} />
        </>
      )}

      {/* তালিকা ভিউ */}
      {view === 'agenda' && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3.5 min-h-[52px]">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="নাম, ফোন বা জায়গা দিয়ে খুঁজুন"
              className="flex-1 min-w-0 text-[16px] outline-none bg-transparent"
            />
            {q && (
              <button onClick={() => setQ('')} aria-label="খোঁজা মুছুন" className="w-8 h-8 flex items-center justify-center">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </label>
          {agendaGroups.map(([title, fn]) => {
            const L = filtered.filter(fn);
            if (!L.length) return null;
            return (
              <div key={title}>
                <b className="block text-[17px] font-extrabold text-slate-900 px-1 pb-1.5">
                  {title} <em className="not-italic text-sm text-slate-500">· {toBnDigits(L.length)}টি</em>
                </b>
                <div className="space-y-2">
                  {L.map((b) => (
                    <BookingCard key={b.id} b={b} today={today} onOpen={setDetail} />
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-white rounded-[20px] p-5 text-center">
              <p className="text-base font-semibold text-slate-600">
                {q ? 'খোঁজার সঙ্গে মিলে এমন কোনো বুকিং নেই।' : 'কোনো বুকিং নেই।'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* মাস ভিউ */}
      {view === 'month' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-2 py-2">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="আগের মাস"
              className="w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <b className="flex-1 text-center text-lg font-extrabold text-slate-900">
              {MONTHS[parseInt(ym.slice(5), 10) - 1]} {toBnDigits(parseInt(ym.slice(0, 4), 10))}
            </b>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="পরের মাস"
              className="w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-[20px] p-2.5">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[13px] font-extrabold text-slate-500 py-1">
                  {w}
                </div>
              ))}
              {monthCells.map((c, i) =>
                c.d ? (
                  <button
                    key={c.d}
                    onClick={() => pickDate(c.d as string)}
                    className={`min-h-[48px] rounded-xl text-[16px] font-extrabold relative active:scale-95 transition ${
                      c.d === sel ? 'bg-[#065f46] text-white' : c.d === today ? 'bg-amber-100 text-amber-900' : 'text-slate-800'
                    }`}
                  >
                    {toBnDigits(parseDate(c.d).getDate())}
                    {c.n > 0 && (
                      <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                          c.d === sel ? 'bg-[#fde68a]' : 'bg-[#065f46]'
                        }`}
                      />
                    )}
                  </button>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
          </div>
          <DayList dateStr={sel} today={today} list={selList} onOpen={setDetail} onNew={() => setForm(emptyForm(sel))} />
        </div>
      )}

      {/* বড় সোনালি বোতাম */}
      <button
        onClick={() => setForm(emptyForm(sel))}
        className="w-full min-h-[58px] rounded-[18px] bg-gradient-to-r from-[#fde68a] to-[#f59e0b] text-[#422006] text-[17px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
      >
        <Plus className="w-6 h-6" /> নতুন বুকিং
      </button>

      {!loaded && (
        <p className="text-center text-sm font-bold text-slate-500">বুকিং লোড হচ্ছে…</p>
      )}

      {/* বুকিং ফরম (নিচের শিট) */}
      {form && (
        <Sheet onClose={() => setForm(null)} title={form.id ? 'বুকিং সম্পাদনা' : 'নতুন বুকিং'}>
          <BookingForm
            initial={form}
            onCancel={() => setForm(null)}
            onSave={(f) => submitForm({ ...f, id: form.id })}
          />
        </Sheet>
      )}

      {/* বুকিং বিস্তারিত (নিচের শিট) */}
      {detail && (
        <Sheet onClose={() => setDetail(null)} title="বুকিং">
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <b className="block text-xl font-extrabold text-slate-900">{detail.name}</b>
                <span className="block text-[15px] text-slate-600">
                  {fmtDay(detail.date)} · {timeLabel(detail.time)}
                </span>
              </div>
              <span className={`shrink-0 text-sm font-extrabold px-3 py-1.5 rounded-full ${STATUS_PILL[detail.status].c}`}>
                {STATUS_PILL[detail.status].t}
              </span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 space-y-1.5 text-[15px]">
              <Row icon={<MapPin className="w-5 h-5 text-sky-700" />} label="জায়গা" value={detail.place} />
              <Row icon={<Phone className="w-5 h-5 text-emerald-700" />} label="ফোন" value={detail.phone} />
              {detail.address && <Row label="ঠিকানা" value={detail.address} />}
              {detail.mouza && <Row label="মৌজা" value={detail.mouza} />}
              {detail.dag && <Row label="দাগ" value={detail.dag} />}
              <Row label="ধরন" value={detail.type} />
              <Row label="ফি" value={`${taka(detail.fee)} · অগ্রিম ${taka(detail.advance)} · বাকি ${taka(dueAmount(detail))}`} />
              <Row icon={<Bell className="w-5 h-5 text-amber-700" />} label="রিমাইন্ডার" value={reminderText(detail)} />
              {detail.note && <Row label="নোট" value={detail.note} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={telHref(detail.phone)}
                className="min-h-[52px] rounded-2xl bg-[#065f46] text-white text-[16px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
              >
                <Phone className="w-5 h-5" /> কল করুন
              </a>
              <a
                href={`https://wa.me/88${detail.phone.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[52px] rounded-2xl bg-[#25d366] text-white text-[16px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
              >
                <MessageCircle className="w-5 h-5" /> WhatsApp
              </a>
              <button
                onClick={() => {
                  downloadIcs(detail);
                  showToast('ics ফাইল ডাউনলোড হয়েছে — খুললে ফোনের ক্যালেন্ডারে যোগ হবে');
                }}
                className="min-h-[52px] rounded-2xl bg-white border-2 border-[#e9d8a6] text-[16px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
              >
                <CalendarPlus className="w-5 h-5 text-[#065f46]" /> ফোনের ক্যালেন্ডারে
              </button>
              <button
                onClick={() => {
                  setForm(toForm(detail));
                  setDetail(null);
                }}
                className="min-h-[52px] rounded-2xl bg-white border-2 border-slate-200 text-[16px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
              >
                <Pencil className="w-5 h-5" /> সম্পাদনা
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const next: WorkBooking = { ...detail, status: detail.status === 'done' ? 'todo' : 'done' };
                  setDetail(next);
                  void persist(next);
                  showToast(next.status === 'done' ? 'সম্পন্ন হয়েছে' : 'আবার খোলা হয়েছে');
                }}
                className="min-h-[52px] rounded-2xl bg-emerald-100 text-emerald-900 text-[16px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
              >
                <Check className="w-5 h-5" />
                {detail.status === 'done' ? 'আবার খুলুন' : 'সম্পন্ন হয়েছে'}
              </button>
              <button
                onClick={() => {
                  setDetail(null);
                  doDelete(detail);
                  showToast('বুকিং মোছা হয়েছে');
                }}
                className="min-h-[52px] rounded-2xl bg-red-50 text-red-700 text-[16px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
              >
                <Trash2 className="w-5 h-5" /> মুছুন
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {/* সংঘর্ষের সতর্কতা */}
      {clash && (
        <div className="fixed inset-0 z-[80] bg-slate-950/55 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="সময়ের সংঘর্ষ">
          <div className="bg-white w-full max-w-md rounded-[24px] p-5 space-y-3">
            <b className="block text-lg font-extrabold text-amber-800">⚠️ সময়ের সংঘর্ষ</b>
            <p className="text-[15px] text-slate-700 leading-relaxed">
              {fmtDay(clash.cand.date)} {timeLabel(clash.cand.time)}-এর ৯০ মিনিটের মধ্যে আরেকটি বুকিং আছে —{' '}
              <b>{clash.existing.name}</b> ({clash.existing.place}, {timeLabel(clash.existing.time)})।
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={confirmClashSave}
                className="min-h-[52px] rounded-2xl bg-[#065f46] text-white text-[16px] font-extrabold active:scale-[.98] transition"
              >
                তবুও রাখুন
              </button>
              <button
                onClick={() => setClash(null)}
                className="min-h-[52px] rounded-2xl bg-white border-2 border-slate-200 text-[16px] font-extrabold active:scale-[.98] transition"
              >
                সময় বদলান
              </button>
            </div>
          </div>
        </div>
      )}

      {/* মুছে ফেলার ৫ সেকেন্ডের ফেরত + টোস্ট */}
      {(deleted || toast) && (
        <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-[90] w-[92%] max-w-md">
          {deleted ? (
            <div className="bg-slate-900 text-white text-[15px] font-semibold px-4 py-3 rounded-2xl flex items-center gap-3">
              <span className="flex-1">বুকিং মোছা হয়েছে</span>
              <button onClick={undoDelete} className="shrink-0 min-h-[44px] px-4 rounded-xl bg-[#fde68a] text-[#422006] font-extrabold active:scale-95 transition">
                ফেরত আনুন
              </button>
            </div>
          ) : (
            <div
              role="status"
              className="bg-slate-900 text-white text-[15px] font-semibold px-4 py-3 rounded-2xl text-center"
            >
              {toast}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <span className="shrink-0 font-bold text-slate-500">{label}:</span>
      <span className="font-semibold text-slate-900 break-words">{value}</span>
    </div>
  );
}

function DayList({
  dateStr,
  today,
  list,
  onOpen,
  onNew,
}: {
  dateStr: string;
  today: string;
  list: WorkBooking[];
  onOpen: (b: WorkBooking) => void;
  onNew: () => void;
}) {
  return (
    <div>
      <b className="block text-[17px] font-extrabold text-slate-900 px-1 pb-1.5">
        {relDay(dateStr, today)}{' '}
        <em className="not-italic text-sm text-slate-500">· {list.length ? `${toBnDigits(list.length)}টি কাজ` : ''}</em>
      </b>
      {list.length === 0 ? (
        <div className="bg-white rounded-[20px] p-5 text-center">
          <p className="text-base font-semibold text-slate-600">এই দিনে কোনো বুকিং নেই।</p>
          <button
            onClick={onNew}
            className="mt-2.5 min-h-[48px] px-5 rounded-full bg-[#065f46] text-white text-base font-extrabold active:scale-95 transition"
          >
            + এই দিনে বুকিং রাখুন
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <BookingCard key={b.id} b={b} today={today} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

const BookingCard: React.FC<{ b: WorkBooking; today: string; onOpen: (b: WorkBooking) => void }> = ({ b, today, onOpen }) => {
  return (
    <button
      onClick={() => onOpen(b)}
      className="w-full text-left bg-white border border-slate-200 rounded-[20px] p-3.5 flex items-center gap-3 min-h-[76px] active:scale-[.99] transition"
    >
      <span className="shrink-0 w-[62px] text-center">
        <b className="block text-lg font-extrabold text-[#065f46] leading-tight">{timeLabel(b.time).split(' ')[0]}</b>
        <small className="block text-[12px] font-bold text-slate-500">{timeLabel(b.time).split(' ')[1] || ''}</small>
      </span>
      <span className="flex-1 min-w-0">
        <b className="block text-[17px] font-extrabold text-slate-900 truncate">{b.name}</b>
        <span className="block text-sm text-slate-600 truncate">
          {b.place}
          {b.date !== today ? ` · ${fmtDay(b.date)}` : ''}
        </span>
        <span className="block text-[13px] text-slate-500 truncate">
          {b.type}
          {dueAmount(b) > 0 ? ` · বাকি ${taka(dueAmount(b))}` : ' · পাওনা নেই'}
        </span>
      </span>
      <span className={`shrink-0 text-[13px] font-extrabold px-2.5 py-1 rounded-full ${STATUS_PILL[b.status].c}`}>
        {STATUS_PILL[b.status].t}
      </span>
    </button>
  );
};

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[75] bg-slate-950/55 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] max-h-[88dvh] overflow-y-auto p-4 pb-6">
        <div className="flex items-center gap-2 pb-2">
          <b className="flex-1 text-lg font-extrabold text-slate-900">{title}</b>
          <button
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="w-11 h-11 shrink-0 rounded-2xl bg-slate-100 flex items-center justify-center active:scale-95 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BookingForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: FormState;
  onCancel: () => void;
  onSave: (f: FormState) => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block font-bold text-[15px] text-slate-700 mt-2">তারিখ *</span>
          <input
            type="date"
            value={f.date}
            onChange={(e) => set('date', e.target.value)}
            className="block w-full min-h-[52px] border-2 border-slate-200 rounded-xl px-3 text-[16px] mt-1 focus:outline-none focus:border-[#065f46]"
          />
        </label>
        <label className="block">
          <span className="block font-bold text-[15px] text-slate-700 mt-2">সময় *</span>
          <input
            type="time"
            value={f.time}
            onChange={(e) => set('time', e.target.value)}
            className="block w-full min-h-[52px] border-2 border-slate-200 rounded-xl px-3 text-[16px] mt-1 focus:outline-none focus:border-[#065f46]"
          />
        </label>
      </div>
      <F label="ক্লায়েন্টের নাম *" value={f.name} onChange={(v) => set('name', v)} placeholder="যেমন: আব্দুল মালেক" />
      <F label="মোবাইল নম্বর * (01XXXXXXXXX)" value={f.phone} onChange={(v) => set('phone', v)} placeholder="01XXXXXXXXX" inputMode="tel" />
      <F label="জায়গা * (দিনের কাজের জায়গা)" value={f.place} onChange={(v) => set('place', v)} placeholder="যেমন: লেমুয়া বাজার" />
      <F label="ঠিকানা" value={f.address} onChange={(v) => set('address', v)} placeholder="বাড়ি/পাড়া, গ্রাম" />
      <div className="grid grid-cols-2 gap-2">
        <F label="মৌজা" value={f.mouza} onChange={(v) => set('mouza', v)} placeholder="যেমন: লেমুয়া" />
        <F label="দাগ" value={f.dag} onChange={(v) => set('dag', v)} placeholder="যেমন: ৮৭৩" />
      </div>
      <label className="block">
        <span className="block font-bold text-[15px] text-slate-700 mt-2">কাজের ধরন</span>
        <select
          value={f.type}
          onChange={(e) => set('type', e.target.value)}
          className="block w-full min-h-[52px] border-2 border-slate-200 rounded-xl px-3 text-[16px] mt-1 bg-white focus:outline-none focus:border-[#065f46]"
        >
          {BOOKING_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <F label="মোট ফি (টাকা)" value={f.fee} onChange={(v) => set('fee', v.replace(/[^\d]/g, ''))} placeholder="যেমন: ৩০০০" inputMode="numeric" />
        <F label="অগ্রিম (টাকা)" value={f.advance} onChange={(v) => set('advance', v.replace(/[^\d]/g, ''))} placeholder="যেমন: ১০০০" inputMode="numeric" />
      </div>
      <F label="নোট" value={f.note} onChange={(v) => set('note', v)} placeholder="যেমন: সকাল ৯টায় পৌঁছাতে হবে" />
      {/* রিমাইন্ডার — দুটোই একসাথে চালু রাখা যায় (প্রিভিউ 14, ডিজাইন A) */}
      <div className="mt-3 space-y-2">
        <ToggleRow
          checked={f.remEvening}
          onChange={(v) => set('remEvening', v)}
          title="আগের দিন সন্ধ্যা ৭টা"
          sub="আগের দিন সন্ধ্যায় রিমাইন্ডার — ফোনের ক্যালেন্ডারে অ্যালার্ম বসবে"
        />
        <ToggleRow
          checked={f.remHour}
          onChange={(v) => set('remHour', v)}
          title="কাজের ১ ঘণ্টা আগে"
          sub="কাজের ১ ঘণ্টা আগে রিমাইন্ডার — ফোনের ক্যালেন্ডারে অ্যালার্ম বসবে"
        />
      </div>
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mt-3">
        <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-amber-900">
          একই দিনে ৯০ মিনিটের মধ্যে আরেকটি বুকিং থাকলে সতর্ক করা হবে।
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3">
        <button
          onClick={onCancel}
          className="min-h-[56px] rounded-2xl bg-white border-2 border-slate-200 text-[16px] font-extrabold active:scale-[.98] transition"
        >
          বাতিল
        </button>
        <button
          onClick={() => onSave(f)}
          className="min-h-[56px] rounded-2xl bg-[#065f46] text-white text-[16px] font-extrabold active:scale-[.98] transition"
        >
          সংরক্ষণ করুন
        </button>
      </div>
    </div>
  );
}

export default WorkCalendarScreen;

/** টগল সুইচ সহ সাদাসিধে সারি (প্রিভিউ 14, ডিজাইন A-এর rem-row) */
function ToggleRow({
  checked,
  onChange,
  title,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-[1.5px] border-slate-200 rounded-2xl p-3">
      <Bell className="w-5 h-5 text-amber-700 shrink-0" />
      <span className="flex-1 min-w-0">
        <b className="block text-[16px] font-extrabold text-slate-900">{title}</b>
        <span className="block text-sm font-normal text-slate-500">{sub}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-[52px] h-[30px] rounded-full transition ${checked ? 'bg-[#065f46]' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[25px]' : 'left-[3px]'
          }`}
        />
      </button>
    </div>
  );
}

function F({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block">
      <span className="block font-bold text-[15px] text-slate-700 mt-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="block w-full min-h-[52px] border-2 border-slate-200 rounded-xl px-3 py-2 text-[16px] mt-1 focus:outline-none focus:border-[#065f46]"
      />
    </label>
  );
}
