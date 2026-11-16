/**
 * ধাপ ৯ — মালিকের প্রোফাইল (ডিজাইন B: প্রিমিয়াম সবুজ-সোনালি)।
 * design-previews/13-profile.html (B) + DESIGN-SUMMARY.md সারি ১৩।
 * শুধু মালিকের নিজের তথ্য — profileStore ব্যবহার করে (ধাপ ৮-এর সেটিংসের মতোই),
 * নতুন কোনো storage নয়। এই স্ক্রিন lazy-load হয় (App.tsx) — স্টার্টআপ গ্রাফে নেই।
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Camera, Check, Database, Lock, MapPin, Phone } from 'lucide-react';
import { getProfile, saveProfile, useProfile, telHref } from '../../lib/profileStore';
import { resizeImageTo256 } from '../../lib/adminBackup';
import { toBnDigits } from '../../lib/banglaDate';
import { SurveyRecord } from '../../types';
import { initialSurveys } from '../../data/mockData';

interface Props {
  surveys: SurveyRecord[];
  onBack: () => void;
  onOpenCalendar: () => void;
  onOpenAdmin: () => void;
}

/** পুরোনো অ্যাপের নমুনা সার্ভে — হিসাবে গোনা হবে না */
const SAMPLE_IDS = new Set(initialSurveys.map((s) => s.id));
const EN_DIGIT = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

function surveyDay(s: SurveyRecord): Date | null {
  if (typeof s.createdAt === 'number') return new Date(s.createdAt);
  const raw = typeof s.createdAt === 'string' && s.createdAt ? s.createdAt : s.date;
  if (!raw) return null;
  const m = EN_DIGIT(String(raw)).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(EN_DIGIT(String(raw)));
  return isNaN(d.getTime()) ? null : d;
}

function storedReportCount(): number {
  try {
    const raw = localStorage.getItem('bhumi-amin-reports');
    if (!raw) return 0;
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

export const OwnerProfileScreen: React.FC<Props> = ({ surveys, onBack, onOpenCalendar, onOpenAdmin }) => {
  const profile = useProfile();
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [area, setArea] = useState(profile.area);
  const [facebookName, setFacebookName] = useState(profile.facebookName);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [toast, setToast] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // এডমিনে বদলালে এই পাতার ঘরগুলোও আপডেট হয়
  useEffect(() => {
    const p = getProfile();
    setName(p.name);
    setTitle(p.title);
    setPhone(p.phone);
    setAddress(p.address);
    setArea(p.area);
    setFacebookName(p.facebookName);
  }, [profile]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(''), 2500);
  };

  const stats = useMemo(() => {
    const real = surveys.filter((s) => !SAMPLE_IDS.has(s.id));
    const now = new Date();
    let month = 0;
    for (const s of real) {
      const d = surveyDay(s);
      if (d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) month++;
    }
    return { total: real.length, reports: storedReportCount(), month };
  }, [surveys]);

  const dirty =
    name !== profile.name ||
    title !== profile.title ||
    phone !== profile.phone ||
    address !== profile.address ||
    area !== profile.area ||
    facebookName !== profile.facebookName;

  const onSave = () => {
    if (!name.trim()) {
      showToast('নাম খালি রাখা যাবে না');
      return;
    }
    if (!/^01\d{9}$/.test(phone.trim())) {
      showToast('মোবাইল নম্বর 01 দিয়ে ১১ সংখ্যার হতে হবে');
      return;
    }
    saveProfile({
      name: name.trim(),
      title: title.trim() || 'আমিন',
      phone: phone.trim(),
      address: address.trim(),
      area: area.trim() || 'ফেনী',
      facebookName: facebookName.trim(),
    });
    showToast('প্রোফাইল সংরক্ষণ হয়েছে');
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageTo256(file);
      saveProfile({ photo: dataUrl });
      showToast('ছবি বদলানো হয়েছে');
    } catch {
      showToast('ছবি বসানো যায়নি — আবার চেষ্টা করুন');
    } finally {
      setPhotoBusy(false);
    }
  };

  const firstLetter = (name.trim() || 'ম')[0];

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* B হিরো: গাঢ় সবুজ, নাম সোনালি */}
      <div className="bg-[#065f46] text-white rounded-b-[26px] -mx-3.5 sm:mx-0 -mt-3.5 px-4 pt-3 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="ফিরে যান"
            className="w-12 h-12 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center active:scale-95 transition"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-xl font-extrabold text-[#fde68a]">আমার প্রোফাইল</h1>
          <button
            onClick={onSave}
            aria-label="সংরক্ষণ করুন"
            className="w-12 h-12 shrink-0 rounded-2xl bg-[#fde68a] text-[#422006] flex items-center justify-center active:scale-95 transition"
          >
            <Check className="w-6 h-6" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="w-[72px] h-[72px] shrink-0 rounded-full bg-gradient-to-br from-[#fde68a] to-[#f59e0b] text-[#422006] text-[30px] font-extrabold flex items-center justify-center border-[3px] border-[#fde68a]/60 overflow-hidden">
            {profile.photo ? (
              <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              firstLetter
            )}
          </span>
          <span className="min-w-0">
            <b className="block text-[21px] font-extrabold leading-tight text-[#fde68a] break-words">{name || profile.name}</b>
            <span className="block text-[15px] text-emerald-100">
              {title || profile.title} · {area || profile.area}
            </span>
            <span className="block text-[15px] text-emerald-100">মোবাইল: {phone || profile.phone}</span>
          </span>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={photoBusy}
            className="ml-auto shrink-0 min-h-[44px] px-3 rounded-xl border-[1.5px] border-[#fde68a]/60 text-[#fde68a] text-sm font-extrabold whitespace-nowrap active:scale-95 transition disabled:opacity-60"
          >
            {photoBusy ? 'ছোট করা হচ্ছে…' : 'ছবি বদলান'}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="ছবি বেছে নিন"
            onChange={(e) => {
              void onPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { n: `${toBnDigits(stats.total)}টি`, t: 'মোট পরিমাপ' },
            { n: `${toBnDigits(stats.reports)}টি`, t: 'মোট রিপোর্ট' },
            { n: `${toBnDigits(stats.month)}টি`, t: 'এই মাসে' },
          ].map((x) => (
            <div
              key={x.t}
              className="bg-white/10 border border-[#fde68a]/45 rounded-[14px] py-1.5 px-1 text-center"
            >
              <b className="block text-[19px] font-extrabold text-[#fde68a] leading-tight">{x.n}</b>
              <span className="text-sm text-emerald-100">{x.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ফরম */}
      <div className="bg-white border-[1.5px] border-[#e9d8a6] rounded-[20px] p-3.5 space-y-1">
        <Field label="নাম" value={name} onChange={setName} placeholder="যেমন: মেহেদী হাসান" />
        <Field label="পদবি" value={title} onChange={setTitle} placeholder="যেমন: আমিন" />
        <Field label="মোবাইল নম্বর" value={phone} onChange={setPhone} placeholder="01XXXXXXXXX" inputMode="tel" />
        <Field label="ঠিকানা" value={address} onChange={setAddress} placeholder="বাজার, থানা, জেলা" />
        <Field label="জেলা" value={area} onChange={setArea} placeholder="যেমন: ফেনী" />
        <Field label="ফেসবুক নাম" value={facebookName} onChange={setFacebookName} placeholder="যেমন: Mehedi Saheb" />
        <button
          onClick={onSave}
          className="w-full min-h-[58px] rounded-[18px] bg-gradient-to-r from-[#fde68a] to-[#f59e0b] text-[#422006] text-[17px] font-extrabold mt-3 active:scale-[.98] transition"
        >
          সংরক্ষণ করুন
        </button>
        {dirty && <p className="text-center text-sm font-bold text-amber-700 pt-1">পরিবর্তন সংরক্ষণ করা হয়নি</p>}
      </div>

      {/* রিপোর্টের হেডারে যেমন দেখাবে */}
      <div>
        <b className="block text-[17px] font-extrabold text-slate-900 px-1 pb-1.5">রিপোর্টের হেডারে যেমন দেখাবে</b>
        <div className="bg-white border-[1.5px] border-[#e9d8a6] rounded-[20px] p-3.5">
          <div className="border-b-2 border-[#065f46] pb-2 flex items-center gap-2">
            <span className="w-10 h-10 rounded-full bg-[#065f46] text-white flex items-center justify-center text-lg font-extrabold shrink-0">
              {firstLetter}
            </span>
            <span className="min-w-0">
              <b className="block text-base font-extrabold text-slate-900 leading-tight truncate">
                {name || profile.name} · {phone || profile.phone}
              </b>
              <span className="block text-[13px] text-slate-600 truncate">{address || profile.address}</span>
            </span>
          </div>
          <p className="text-[13px] text-slate-500 pt-2">নাম, ফোন বা ঠিকানা বদলালে এই প্রিভিউ সঙ্গে সঙ্গে বদলায়।</p>
        </div>
      </div>

      {/* যোগাযোগ + যাওয়ার জায়গা */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={telHref(profile.phone)}
          className="bg-[#065f46] text-white rounded-[20px] p-3.5 flex items-center gap-3 min-h-[64px] active:scale-[.98] transition"
        >
          <Phone className="w-6 h-6 shrink-0" />
          <span>
            <small className="block text-[13px] text-emerald-200 font-semibold">ফোন</small>
            <b className="block text-base font-extrabold leading-tight">{profile.phone}</b>
          </span>
        </a>
        <button
          onClick={onOpenCalendar}
          className="bg-white border-[1.5px] border-[#e9d8a6] rounded-[20px] p-3.5 flex items-center gap-3 min-h-[64px] text-left active:scale-[.98] transition"
        >
          <Calendar className="w-6 h-6 shrink-0 text-[#065f46]" />
          <span>
            <small className="block text-[13px] text-slate-500 font-semibold">কাজের</small>
            <b className="block text-base font-extrabold leading-tight text-slate-900">ক্যালেন্ডার</b>
          </span>
        </button>
      </div>

      {/* নিরাপত্তা ও ব্যাকআপ */}
      <div>
        <b className="block text-[17px] font-extrabold text-slate-900 px-1 pb-1.5">নিরাপত্তা ও ব্যাকআপ</b>
        <div className="bg-white border-[1.5px] border-[#e9d8a6] rounded-[20px] divide-y divide-slate-100">
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-3 w-full min-h-[58px] px-3.5 text-left active:scale-[.99] transition"
          >
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="flex-1 text-[16px] font-bold text-slate-900">PIN বদলান</span>
            <span className="text-slate-400">›</span>
          </button>
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-3 w-full min-h-[58px] px-3.5 text-left active:scale-[.99] transition"
          >
            <Database className="w-5 h-5 text-emerald-700 shrink-0" />
            <span className="flex-1 text-[16px] font-bold text-slate-900">ব্যাকআপ নিন / ফেরত আনুন</span>
            <span className="text-slate-400">›</span>
          </button>
          <div className="flex items-center gap-3 w-full min-h-[58px] px-3.5">
            <MapPin className="w-5 h-5 text-sky-700 shrink-0" />
            <span className="flex-1 text-[16px] font-bold text-slate-900">
              কাজের এলাকা: {area || profile.area}
            </span>
          </div>
        </div>
      </div>

      {/* টোস্ট */}
      <div
        role="status"
        className={`fixed left-1/2 bottom-24 -translate-x-1/2 z-[70] bg-slate-900 text-white text-[15px] font-semibold px-4 py-2.5 rounded-2xl max-w-[80vw] text-center transition-all ${
          toast ? 'opacity-100' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        {toast}
      </div>
    </div>
  );
};

export default OwnerProfileScreen;

function Field({
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
      <span className="block font-bold text-[15px] text-slate-700 mt-2.5">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="block w-full min-h-[52px] border-2 border-[#e9d8a6] rounded-xl px-3 py-2.5 text-[17px] bg-[#fffbeb] text-slate-900 mt-1 focus:outline-none focus:border-[#f59e0b]"
      />
    </label>
  );
}
