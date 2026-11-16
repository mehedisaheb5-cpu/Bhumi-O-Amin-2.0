/**
 * ধাপ ৮ — এডমিন (ডিজাইন A: সরল ও ক্লাসিক, শুধু মেইন কপি)।
 *
 * সবুজ হেডার, সারি-সারি সাদা তালিকা, লেবেলের নিচে ঘর। ভেতরে:
 *  - রিপোর্ট তালিকা: খোঁজা (নাম / দাগ / মৌজা), মুছলে ৫ সেকেন্ডে ফেরত নেওয়া যায়
 *  - সেটিংস: নাম, ফোন, ঠিকানা (profileStore) + লোগো ২৫৬px (IndexedDB) + লাইভ হেডার প্রিভিউ
 *  - নিরাপত্তা: PIN বদলান, স্বয়ংক্রিয় লক ৫ মিনিট
 *  - ব্যাকআপ: JSON export / import (PIN ছাড়া), ৭ দিনের রিমাইন্ডার
 *
 * PIN দিয়ে খোলা থাকে; ৫ মিনিট না চালালে নিজে লক হয়। এডমিন পর্দা React.lazy দিয়ে
 * লোড হয় — স্টার্টআপের module গ্রাফে থাকে না। এই ফাইলটি রিপোর্ট/সার্ভে/মৌজার
 * কোড import করে না (রিপোর্টের তালিকা localStorage থেকে সরাসরি পড়ে)।
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  FileText,
  ImagePlus,
  KeyRound,
  Lock,
  MapPin,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import PinLockScreen from './PinLockScreen';
import { getProfile, saveProfile } from '../../lib/profileStore';
import {
  buildBackup,
  daysSinceBackup,
  downloadBackup,
  importBackup,
  loadAdminLogo,
  removeAdminLogo,
  resizeImageTo256,
  saveAdminLogo,
} from '../../lib/adminBackup';
import { idbGetAll } from '../../lib/faDb';
import { isUnlocked, lockNow, touchUnlocked } from '../../lib/adminPin';

/** survey-report-utils.ts-এর REPORTS_STORAGE_KEY-এর মান — import না করে সরাসরি ব্যবহার (চক্র এড়াতে)। */
const REPORTS_STORAGE_KEY = 'bhumi-amin-reports';
const SURVEYS_KEY = 'bhumi_surveys';
const UNDO_MS = 5000;

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toBn = (n: number | string): string => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
const toEn = (s: string): string =>
  s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

interface AdminReport {
  id: string;
  reportNumber?: string;
  title?: string;
  clientName?: string;
  dagNo?: string;
  mouza?: string;
  reportDate?: string;
  surveyDate?: string;
}

interface Toast {
  msg: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AdminScreenProps {
  onBack: () => void;
  onOpenReport?: (reportId: string) => void;
}

export default function AdminScreen({ onBack, onOpenReport }: AdminScreenProps) {
  const [locked, setLocked] = useState<boolean>(() => !isUnlocked());
  const [changingPin, setChangingPin] = useState(false);
  const [tab, setTab] = useState<'admin' | 'backup'>('admin');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [profile, setProfile] = useState(() => getProfile());
  const [logo, setLogo] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [lastBackupDays, setLastBackupDays] = useState<number | null>(() => daysSinceBackup());
  const [surveyCount, setSurveyCount] = useState(0);
  const [handmapCount, setHandmapCount] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const deletedRef = useRef<{ item: AdminReport; index: number } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const lastTouchRef = useRef(0);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (msg: string, actionLabel?: string, onAction?: () => void, ms = 3000) => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      const hadAction = Boolean(actionLabel);
      setToast({ msg, actionLabel, onAction });
      toastTimer.current = window.setTimeout(() => {
        setToast(null);
        if (hadAction) deletedRef.current = null;
      }, ms);
    },
    [],
  );

  const loadReports = useCallback(() => {
    try {
      const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setReports(Array.isArray(parsed) ? (parsed as AdminReport[]) : []);
    } catch {
      setReports([]);
    }
  }, []);

  const loadCounts = useCallback(() => {
    try {
      const raw = localStorage.getItem(SURVEYS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setSurveyCount(Array.isArray(parsed) ? parsed.length : 0);
    } catch {
      setSurveyCount(0);
    }
    idbGetAll('handmaps')
      .then((all) => setHandmapCount(all.length))
      .catch(() => setHandmapCount(0));
  }, []);

  useEffect(() => {
    loadReports();
    loadCounts();
    loadAdminLogo().then(setLogo).catch(() => setLogo(null));
    setLastBackupDays(daysSinceBackup());
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [loadReports, loadCounts]);

  /* ---------- স্বয়ংক্রিয় লক: ৫ মিনিট না চালালে PIN চাইবে ---------- */
  useEffect(() => {
    if (locked) return;
    const onActivity = () => {
      if (Date.now() - lastTouchRef.current > 10000) {
        lastTouchRef.current = Date.now();
        touchUnlocked();
      }
    };
    const check = () => {
      if (!isUnlocked()) setLocked(true);
    };
    const onVisible = () => {
      if (!document.hidden) check();
    };
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(check, 15000);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [locked]);

  const persistReports = (list: AdminReport[]) => {
    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      showToast('সংরক্ষণ করা যায়নি — ফোনের জায়গা শেষ হতে পারে');
    }
  };

  const handleDelete = (rep: AdminReport) => {
    const idx = reports.findIndex((r) => r.id === rep.id);
    if (idx < 0) return;
    const next = reports.filter((r) => r.id !== rep.id);
    setReports(next);
    persistReports(next);
    deletedRef.current = { item: rep, index: idx };
    showToast(
      'রিপোর্ট মুছে ফেলা হয়েছে',
      'ফেরত নিন',
      () => {
        const d = deletedRef.current;
        if (!d) return;
        setReports((prev) => {
          const restored = [...prev];
          restored.splice(Math.min(d.index, restored.length), 0, d.item);
          persistReports(restored);
          return restored;
        });
        deletedRef.current = null;
        setToast(null);
      },
      UNDO_MS,
    );
  };

  const handleSaveSettings = () => {
    const next = saveProfile({
      name: profile.name.trim() || 'মেহেদী হাসান',
      phone: profile.phone.trim(),
      address: profile.address.trim(),
    });
    setProfile(next);
    showToast('সেটিংস সংরক্ষিত হয়েছে ✓');
  };

  const handleLogoPick = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const dataUrl = await resizeImageTo256(file);
      await saveAdminLogo(dataUrl);
      setLogo(dataUrl);
      showToast('লোগো সংরক্ষিত হয়েছে (২৫৬px) ✓');
    } catch {
      showToast('লোগো পড়া যায়নি — অন্য ছবি চেষ্টা করুন');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    await removeAdminLogo();
    setLogo(null);
    showToast('লোগো সরানো হয়েছে');
  };

  const handleExport = async () => {
    setExportBusy(true);
    try {
      const file = await buildBackup();
      downloadBackup(file);
      setLastBackupDays(daysSinceBackup());
      showToast('ব্যাকআপ ডাউনলোড হয়েছে ✓');
    } catch {
      showToast('ব্যাকআপ নেওয়া যায়নি — আবার চেষ্টা করুন');
    } finally {
      setExportBusy(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportBusy(true);
    try {
      const text = await file.text();
      const r = await importBackup(text);
      showToast(
        `ব্যাকআপ ফেরত নেওয়া হয়েছে — ${toBn(r.localKeys)}টি তথ্য, ${toBn(r.handmaps)}টি হ্যান্ড ম্যাপ`,
        undefined,
        undefined,
        4000,
      );
      loadReports();
      loadCounts();
      loadAdminLogo().then(setLogo).catch(() => setLogo(null));
      setLastBackupDays(daysSinceBackup());
      window.setTimeout(() => window.location.reload(), 1600);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ব্যাকআপ ফেরত নেওয়া যায়নি');
    } finally {
      setImportBusy(false);
    }
  };

  const handleLock = () => {
    lockNow();
    setLocked(true);
  };

  /* ---------- PIN গেট / PIN বদলানো ---------- */
  if (locked) {
    return (
      <PinLockScreen
        initialMode="enter"
        onUnlocked={() => setLocked(false)}
        onCancel={onBack}
      />
    );
  }
  if (changingPin) {
    return (
      <PinLockScreen
        initialMode="change"
        onUnlocked={(changed) => {
          setChangingPin(false);
          setLocked(false);
          if (changed) showToast('PIN বদলে গেছে ✓');
        }}
        onCancel={() => setChangingPin(false)}
      />
    );
  }

  /* ---------- তালিকা ও হিসাব ---------- */
  const q = toEn(query.trim().toLowerCase());
  const filtered = q
    ? reports.filter((r) => {
        const hay = toEn(
          [r.clientName, r.dagNo, r.mouza, r.reportNumber, r.reportDate, r.title]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        );
        return hay.includes(q);
      })
    : reports;

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonth = reports.filter((r) => (r.reportDate || '').startsWith(monthPrefix)).length;
  const backupLabel =
    lastBackupDays === null ? 'কখনো হয়নি' : lastBackupDays === 0 ? 'আজ' : `${toBn(lastBackupDays)} দিন আগে`;
  const backupStale = lastBackupDays === null || lastBackupDays > 7;

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* সবুজ হেডার */}
      <div className="bg-[#065f46] text-white flex items-center gap-2 px-3 rounded-2xl min-h-[58px]">
        <button
          onClick={onBack}
          aria-label="ফিরে যান"
          className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black flex-1">এডমিন</h1>
        <button
          onClick={handleLock}
          aria-label="লক করুন"
          className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95"
        >
          <Lock className="w-6 h-6" />
        </button>
      </div>

      {/* ট্যাব — এডমিন / ব্যাকআপ */}
      <div className="grid grid-cols-2 gap-2 bg-white border border-slate-200 rounded-2xl p-1.5">
        <button
          onClick={() => setTab('admin')}
          className={`min-h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 ${
            tab === 'admin' ? 'bg-[#065f46] text-white' : 'text-slate-600'
          }`}
        >
          <ShieldCheck className="w-5 h-5" /> এডমিন
        </button>
        <button
          onClick={() => setTab('backup')}
          className={`min-h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 ${
            tab === 'backup' ? 'bg-[#065f46] text-white' : 'text-slate-600'
          }`}
        >
          <Download className="w-5 h-5" /> ব্যাকআপ
        </button>
      </div>

      {tab === 'admin' ? (
        <>
          {/* হিসাব */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border-[1.5px] border-slate-300 rounded-2xl p-3 text-center">
              <b className="block text-xl font-black text-[#065f46]">{toBn(reports.length)}</b>
              <span className="text-[13px] font-bold text-slate-500">মোট রিপোর্ট</span>
            </div>
            <div className="bg-white border-[1.5px] border-slate-300 rounded-2xl p-3 text-center">
              <b className="block text-xl font-black text-[#065f46]">{toBn(thisMonth)}</b>
              <span className="text-[13px] font-bold text-slate-500">এই মাসে</span>
            </div>
            <div className="bg-white border-[1.5px] border-slate-300 rounded-2xl p-3 text-center">
              <b className="block text-base font-black text-[#065f46] leading-7">{backupLabel}</b>
              <span className="text-[13px] font-bold text-slate-500">ব্যাকআপ আগে</span>
            </div>
          </div>

          {/* রিপোর্ট তালিকা */}
          <h2 className="text-base font-black text-slate-900 pt-1">রিপোর্ট তালিকা</h2>
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 min-h-12">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="নাম / দাগ / মৌজা লিখে খুঁজুন"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] py-2"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="খোঁজা মুছুন" className="p-1">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-center text-[15px] font-semibold text-slate-500 py-6 px-4">
                {reports.length === 0 ? 'এখনো কোনো রিপোর্ট সংরক্ষিত হয়নি' : 'খুঁজে পাওয়া যায়নি'}
              </p>
            ) : (
              filtered.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 last:border-b-0">
                  <button
                    onClick={() => onOpenReport && onOpenReport(r.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#065f46] shrink-0" />
                      <b className="text-[15px] font-bold text-slate-900 truncate">
                        {r.reportNumber || r.title || 'রিপোর্ট'}
                      </b>
                    </div>
                    <p className="text-sm text-slate-500 truncate pl-5">
                      {(r.clientName || 'নাম নেই') +
                        (r.dagNo ? ` · দাগ ${r.dagNo}` : '') +
                        (r.mouza ? ` · ${r.mouza}` : '')}
                    </p>
                    {(r.reportDate || r.surveyDate) && (
                      <p className="text-[13px] text-slate-400 pl-5">{r.reportDate || r.surveyDate}</p>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    aria-label="রিপোর্ট মুছুন"
                    className="w-11 h-11 rounded-xl border border-red-200 text-red-600 flex items-center justify-center shrink-0 active:scale-95"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* সেটিংস */}
          <h2 className="text-base font-black text-slate-900 pt-1">সেটিংস — নাম, ঠিকানা, ফোন</h2>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div>
              <label htmlFor="admin-name" className="block text-[15px] font-bold text-slate-700 mb-1">
                নাম
              </label>
              <input
                id="admin-name"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full min-h-12 rounded-xl border border-slate-300 px-3 text-[15px] outline-none focus:border-[#065f46]"
              />
            </div>
            <div>
              <label htmlFor="admin-phone" className="block text-[15px] font-bold text-slate-700 mb-1">
                ফোন
              </label>
              <input
                id="admin-phone"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                inputMode="tel"
                className="w-full min-h-12 rounded-xl border border-slate-300 px-3 text-[15px] outline-none focus:border-[#065f46]"
              />
            </div>
            <div>
              <label htmlFor="admin-address" className="block text-[15px] font-bold text-slate-700 mb-1">
                ঠিকানা
              </label>
              <input
                id="admin-address"
                value={profile.address}
                onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                className="w-full min-h-12 rounded-xl border border-slate-300 px-3 text-[15px] outline-none focus:border-[#065f46]"
              />
            </div>
            <div>
              <span className="block text-[15px] font-bold text-slate-700 mb-1">
                লোগো (২৫৬px, IndexedDB-তে থাকবে)
              </span>
              <div className="flex items-center gap-3">
                {logo ? (
                  <img
                    src={logo}
                    alt="লোগো"
                    className="w-14 h-14 rounded-xl border border-slate-300 object-contain bg-white shrink-0"
                  />
                ) : (
                  <span className="w-14 h-14 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-center shrink-0">
                    <ImagePlus className="w-6 h-6 text-slate-400" />
                  </span>
                )}
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoBusy}
                  className="flex-1 min-h-12 rounded-xl border-[1.5px] border-slate-300 text-[15px] font-bold text-[#065f46] active:scale-[0.98] disabled:opacity-50"
                >
                  {logoBusy ? 'ছোট করা হচ্ছে…' : logo ? 'লোগো বদলান' : 'লোগো বসান'}
                </button>
                {logo && (
                  <button
                    onClick={handleRemoveLogo}
                    className="min-h-12 px-3 rounded-xl border border-red-200 text-red-600 text-[15px] font-bold active:scale-95"
                  >
                    সরান
                  </button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void handleLogoPick(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            <div className="border-[1.5px] border-[#065f46] rounded-xl p-3 text-[15px] bg-emerald-50/50">
              <b className="text-[#065f46]">রিপোর্টের হেডারে যেমন দেখাবে:</b>
              <br />
              {profile.name || '—'} · {profile.phone || '—'}
              <br />
              <span className="text-slate-500">{profile.address || '—'}</span>
            </div>
            <button
              onClick={handleSaveSettings}
              className="w-full min-h-12 rounded-xl bg-[#065f46] text-white text-base font-bold active:scale-[0.98]"
            >
              সংরক্ষণ করুন
            </button>
          </div>

          {/* নিরাপত্তা */}
          <h2 className="text-base font-black text-slate-900 pt-1">নিরাপত্তা</h2>
          <div className="space-y-2 pb-2">
            <button
              onClick={() => setChangingPin(true)}
              className="w-full min-h-[60px] rounded-2xl bg-white border-[1.5px] border-slate-300 px-3.5 flex items-center gap-3 text-left active:scale-[0.99]"
            >
              <KeyRound className="w-6 h-6 text-[#065f46] shrink-0" />
              <span className="flex-1">
                <b className="block text-base font-bold text-slate-900">PIN বদলান</b>
                <small className="block text-[13px] font-semibold text-slate-500">
                  ৪–৬ সংখ্যা, শুধু হ্যাশ থাকে
                </small>
              </span>
            </button>
            <div className="w-full min-h-[60px] rounded-2xl bg-white border-[1.5px] border-slate-300 px-3.5 flex items-center gap-3">
              <Clock className="w-6 h-6 text-[#065f46] shrink-0" />
              <span className="flex-1">
                <b className="block text-base font-bold text-slate-900">স্বয়ংক্রিয় লক: ৫ মিনিট</b>
                <small className="block text-[13px] font-semibold text-slate-500">
                  না চালালে নিজে লক হবে
                </small>
              </span>
              <Check className="w-5 h-5 text-[#065f46]" />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ব্যাকআপ */}
          <div
            className={`rounded-2xl p-4 text-[15px] font-bold ${
              backupStale
                ? 'bg-amber-50 border-2 border-dashed border-amber-500 text-amber-900'
                : 'bg-emerald-50 border-2 border-emerald-200 text-emerald-900'
            }`}
          >
            {lastBackupDays === null
              ? 'এখনো ব্যাকআপ নেওয়া হয়নি — এখনই ব্যাকআপ নিন'
              : backupStale
                ? `শেষ ব্যাকআপ ${toBn(lastBackupDays)} দিন আগে — এখনই ব্যাকআপ নিন`
                : `শেষ ব্যাকআপ ${lastBackupDays === 0 ? 'আজ' : `${toBn(lastBackupDays)} দিন আগে`} ✓`}
          </div>
          <button
            onClick={handleExport}
            disabled={exportBusy}
            className="w-full min-h-14 rounded-2xl bg-[#065f46] text-white text-base font-bold flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            {exportBusy ? 'ব্যাকআপ তৈরি হচ্ছে…' : 'ব্যাকআপ নিন (JSON ডাউনলোড)'}
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importBusy}
            className="w-full min-h-[60px] rounded-2xl bg-white border-[1.5px] border-slate-300 px-3.5 flex items-center gap-3 text-left active:scale-[0.99] disabled:opacity-50"
          >
            <Upload className="w-6 h-6 text-[#065f46] shrink-0" />
            <span className="flex-1">
              <b className="block text-base font-bold text-slate-900">
                {importBusy ? 'ফেরত নেওয়া হচ্ছে…' : 'ব্যাকআপ ফাইল থেকে ফেরত নিন'}
              </b>
              <small className="block text-[13px] font-semibold text-slate-500">
                আগের JSON ফাইল বেছে নিন
              </small>
            </span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void handleImportFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <h2 className="text-base font-black text-slate-900 pt-1">এই ব্যাকআপে যা থাকবে</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-100">
              <FileText className="w-5 h-5 text-[#065f46] shrink-0" />
              <span className="flex-1">
                <b className="block text-[15px] font-bold text-slate-900">রিপোর্ট ও পরিমাপ</b>
                <small className="block text-[13px] text-slate-500">সব রিপোর্ট, সংরক্ষিত পরিমাপ</small>
              </span>
              <b className="text-[15px] font-black text-slate-900">
                {toBn(reports.length + surveyCount)}
              </b>
            </div>
            <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-100">
              <MapPin className="w-5 h-5 text-[#065f46] shrink-0" />
              <span className="flex-1">
                <b className="block text-[15px] font-bold text-slate-900">হ্যান্ড ম্যাপ</b>
                <small className="block text-[13px] text-slate-500">আঁকা ম্যাপের ছবি</small>
              </span>
              <b className="text-[15px] font-black text-slate-900">{toBn(handmapCount)}টি</b>
            </div>
            <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-100">
              <Settings className="w-5 h-5 text-[#065f46] shrink-0" />
              <span className="flex-1">
                <b className="block text-[15px] font-bold text-slate-900">সেটিংস</b>
                <small className="block text-[13px] text-slate-500">নাম, ফোন, ঠিকানা, লোগো</small>
              </span>
              <Check className="w-5 h-5 text-[#065f46]" />
            </div>
            <div className="flex items-center gap-3 px-3 py-3">
              <ShieldCheck className="w-5 h-5 text-[#065f46] shrink-0" />
              <span className="flex-1">
                <b className="block text-[15px] font-bold text-slate-900">PIN থাকবে না</b>
                <small className="block text-[13px] text-slate-500">
                  নিরাপত্তার জন্য PIN ব্যাকআপে যায় না
                </small>
              </span>
              <Check className="w-5 h-5 text-[#065f46]" />
            </div>
          </div>
          <p className="text-center text-[13px] font-semibold text-slate-500 pb-2">
            ৭ দিন ব্যাকআপ না নিলে হালকা রিমাইন্ডার আসবে
          </p>
        </>
      )}

      {/* টোস্ট */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-slate-900 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
          <span className="text-[15px] font-bold">{toast.msg}</span>
          {toast.actionLabel && (
            <button
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="text-amber-300 text-[15px] font-black whitespace-nowrap"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
