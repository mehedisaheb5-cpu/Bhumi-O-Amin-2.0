/**
 * ফিল্ড আমিন — হোম: ডিজাইন C + B-এর হিসাব + লাইভ সময়, ইংরেজি ও বাংলা তারিখ, ঋতু
 * (design-previews/01-home.html)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Spline, FileText, ArrowRight, Ruler, PenLine, ChevronRight } from 'lucide-react';
import { SurveyRecord } from '../../types';
import { useProfile } from '../../lib/profileStore';
import { formatNow, toBnDigits } from '../../lib/banglaDate';
import { getStoredReports } from '../../lib/survey-report-utils';
import { initialSurveys } from '../../data/mockData';

interface Props {
  surveys: SurveyRecord[];
  onOpenMeasure: () => void;
  onOpenHandMap: () => void;
  onOpenReports: () => void;
  onOpenSurvey: (surveyId: string) => void;
}

/** পুরোনো অ্যাপের নমুনা সার্ভে — হিসাব ও সাম্প্রতিক তালিকায় গোনা হবে না */
const SAMPLE_IDS = new Set(initialSurveys.map((s) => s.id));

const EN_DIGIT = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

/** সার্ভের দিন (ফোনের সময় অনুযায়ী) */
function surveyDay(s: SurveyRecord): Date | null {
  if (typeof s.createdAt === 'number') return new Date(s.createdAt);
  const raw = typeof s.createdAt === 'string' && s.createdAt ? s.createdAt : s.date;
  if (!raw) return null;
  const m = EN_DIGIT(String(raw)).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(EN_DIGIT(String(raw)));
  return isNaN(d.getTime()) ? null : d;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const SHORT_MONTH = ['জানু.', 'ফেব্রু.', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে.', 'অক্টো.', 'নভে.', 'ডিসে.'];
const shortDate = (d: Date | null) => (d ? `${toBnDigits(d.getDate())} ${SHORT_MONTH[d.getMonth()]}` : '');
const fmtDec = (sqft: number) =>
  toBnDigits((sqft / 435.6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const TONE = [
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
];

export const FieldHomeScreen: React.FC<Props> = ({ surveys, onOpenMeasure, onOpenHandMap, onOpenReports, onOpenSurvey }) => {
  const profile = useProfile();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  const dt = formatNow(now);

  const real = useMemo(() => surveys.filter((s) => !SAMPLE_IDS.has(s.id)), [surveys]);
  const today = now.toDateString();
  const stats = useMemo(() => {
    const n = new Date(today);
    let t = 0;
    let m = 0;
    for (const s of real) {
      const d = surveyDay(s);
      if (!d) continue;
      if (sameDay(d, n)) t++;
      if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()) m++;
    }
    let reports = 0;
    try {
      reports = getStoredReports().length;
    } catch {
      reports = 0;
    }
    return { today: t, month: m, reports };
  }, [real, today]);

  const recent = useMemo(
    () =>
      [...real]
        .map((s) => ({ s, d: surveyDay(s) }))
        .sort((a, b) => (b.d?.getTime() ?? 0) - (a.d?.getTime() ?? 0))
        .slice(0, 3),
    [real]
  );

  return (
    <div id="field-home" className="-mx-3.5 sm:mx-0 -mt-3.5 pb-2 bg-[#eef2f1] min-h-[calc(100dvh-70px)]">
      {/* স্বাগতম */}
      <div className="px-[18px] pt-3 pb-1">
        <small className="text-sm font-semibold text-slate-600">স্বাগতম,</small>
        <h1 className="text-[28px] font-extrabold leading-tight text-slate-900">{profile.name}</h1>
      </div>

      {/* সময় + তারিখ + ঋতু */}
      <div className="flex gap-3 mx-4 mt-2.5 bg-white rounded-[26px] p-3.5 shadow-[0_4px_14px_rgba(15,23,42,.06)]" aria-live="off">
        <div className="shrink-0 w-[104px] rounded-[20px] bg-[#065f46] text-white flex flex-col items-center justify-center py-2 px-1">
          <b className="text-[30px] font-extrabold leading-tight tracking-wide">{dt.time}</b>
          <span className="text-[15px] font-bold text-emerald-200">{dt.period}</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div>
            <small className="block text-xs font-bold text-slate-500 leading-tight">ইংরেজি</small>
            <b className="block text-[15px] font-extrabold text-slate-900 leading-snug">{dt.en}</b>
          </div>
          <div>
            <small className="block text-xs font-bold text-slate-500 leading-tight">বাংলা</small>
            <b className="block text-[15px] font-extrabold text-slate-900 leading-snug">{dt.bn}</b>
          </div>
          <span className="self-start text-[13px] font-bold text-amber-800 bg-amber-100 rounded-full px-2.5 py-px">{dt.season}</span>
        </div>
      </div>

      {/* হিসাব */}
      <div className="grid grid-cols-3 gap-2 mx-4 mt-2.5">
        {[
          { n: stats.today, t: 'আজকের পরিমাপ', c: TONE[0] },
          { n: stats.month, t: 'এই মাসে', c: TONE[1] },
          { n: stats.reports, t: 'মোট রিপোর্ট', c: TONE[2] },
        ].map((x) => (
          <div key={x.t} className="bg-white rounded-[22px] py-2.5 px-1.5 text-center shadow-[0_2px_10px_rgba(15,23,42,.05)]">
            <b className={`inline-flex items-center justify-center min-w-[46px] h-[46px] px-2 rounded-2xl text-2xl font-extrabold ${x.c}`}>
              {toBnDigits(x.n)}
            </b>
            <span className="block text-[13px] font-bold text-slate-700 mt-1 leading-tight">{x.t}</span>
          </div>
        ))}
      </div>

      {/* বড় টাইল */}
      <div className="px-5 pt-4 pb-1.5">
        <b className="text-lg font-extrabold text-slate-900">আজ কী মাপবেন?</b>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-1 pb-3">
        <button
          id="home-tile-measure"
          onClick={onOpenMeasure}
          className="col-span-2 bg-white rounded-[30px] p-[18px] text-left flex items-center gap-3 min-h-[150px] shadow-[0_4px_14px_rgba(15,23,42,.06)] active:scale-[.97] transition"
        >
          <span className="w-[88px] h-[88px] shrink-0 rounded-[28px] bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Compass className="w-12 h-12" />
          </span>
          <span className="min-w-0">
            <b className="block text-xl font-extrabold leading-tight text-slate-900">দখল পরিমাপ</b>
            <span className="block text-sm text-slate-600 mt-0.5">বাহু বা চিত্র এঁকে</span>
          </span>
          <span className="ml-auto w-11 h-11 shrink-0 rounded-full bg-[#065f46] text-white flex items-center justify-center">
            <ArrowRight className="w-[22px] h-[22px]" />
          </span>
        </button>
        <button
          id="home-tile-handmap"
          onClick={onOpenHandMap}
          className="bg-white rounded-[30px] p-[18px] text-left flex flex-col gap-3 min-h-[170px] shadow-[0_4px_14px_rgba(15,23,42,.06)] active:scale-[.97] transition"
        >
          <span className="w-[72px] h-[72px] rounded-3xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <Spline className="w-10 h-10" />
          </span>
          <span>
            <b className="block text-xl font-extrabold leading-tight text-slate-900">হ্যান্ড ম্যাপ</b>
            <span className="block text-sm text-slate-600 mt-0.5">পরিষ্কার স্কেচ</span>
          </span>
        </button>
        <button
          id="home-tile-reports"
          onClick={onOpenReports}
          className="bg-white rounded-[30px] p-[18px] text-left flex flex-col gap-3 min-h-[170px] shadow-[0_4px_14px_rgba(15,23,42,.06)] active:scale-[.97] transition"
        >
          <span className="w-[72px] h-[72px] rounded-3xl bg-violet-100 text-violet-700 flex items-center justify-center">
            <FileText className="w-10 h-10" />
          </span>
          <span>
            <b className="block text-xl font-extrabold leading-tight text-slate-900">রিপোর্ট</b>
            <span className="block text-sm text-slate-600 mt-0.5">PDF · ছবি · শেয়ার</span>
          </span>
        </button>
      </div>

      {/* সাম্প্রতিক */}
      <div className="flex justify-between items-center px-5 pt-2.5 pb-1.5">
        <b className="text-lg font-extrabold text-slate-900">সাম্প্রতিক</b>
        {recent.length > 0 && (
          <button
            onClick={() => onOpenSurvey(recent[0].s.id)}
            className="text-sm font-bold text-[#065f46] min-h-[40px] px-1.5 flex items-center gap-0.5"
          >
            সব দেখুন <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="mx-4 mb-2.5 bg-white rounded-[22px] p-4 text-center">
          <p className="text-base font-semibold text-slate-600">এখনো কোনো পরিমাপ সংরক্ষণ করা হয়নি।</p>
          <button
            onClick={onOpenMeasure}
            className="mt-2.5 min-h-[48px] px-5 rounded-full bg-[#065f46] text-white text-base font-extrabold active:scale-95 transition"
          >
            প্রথম পরিমাপ শুরু করুন
          </button>
        </div>
      ) : (
        recent.map(({ s, d }, i) => {
          const bahu = Array.isArray(s.plots) && s.plots.length > 0;
          const who = s.clientName?.trim() || s.title;
          return (
            <button
              key={s.id}
              onClick={() => onOpenSurvey(s.id)}
              className="flex items-center gap-3 w-[calc(100%-32px)] mx-4 mb-2.5 text-left bg-white rounded-[22px] px-3.5 py-3 min-h-[72px] active:scale-[.98] transition"
            >
              <span className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${TONE[i % 3]}`}>
                {bahu ? <Ruler className="w-6 h-6" /> : <PenLine className="w-6 h-6" />}
              </span>
              <span className="flex-1 min-w-0">
                <b className="block text-base font-bold text-slate-900 truncate">
                  {s.dagNo ? `দাগ ${s.dagNo} · ` : ''}
                  {who}
                </b>
                <span className="block text-[13px] text-slate-600 truncate">
                  {[s.mouza, shortDate(d)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-[15px] font-extrabold text-[#065f46] text-right leading-tight shrink-0">
                {fmtDec(s.areaSqFt || 0)}
                <small className="block text-xs text-slate-500 font-semibold">শতাংশ</small>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
};
