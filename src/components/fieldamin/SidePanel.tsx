/**
 * সাইড প্যানেল (☰) — ডিজাইন C (আধুনিক মিনিমাল): design-previews/02-side-panel.html
 * প্রোফাইল কার্ড, সবুজ কল বোতাম, Facebook + ঠিকানা, মেনু।
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, Phone, MapPin, Facebook, Camera, Briefcase, House, Compass, Spline, FileText, Lock } from 'lucide-react';
import { useProfile, telHref } from '../../lib/profileStore';

export type SideMenuId = 'home' | 'possession' | 'handmap' | 'reports' | 'admin';

interface SidePanelProps {
  open: boolean;
  active: SideMenuId | null;
  onClose: () => void;
  onNavigate: (id: SideMenuId) => void;
}

const MENU: Array<{ id: SideMenuId; label: string; icon: React.ReactNode }> = [
  { id: 'home', label: 'হোম', icon: <House className="w-[22px] h-[22px]" /> },
  { id: 'possession', label: 'দখল পরিমাপ', icon: <Compass className="w-[22px] h-[22px]" /> },
  { id: 'handmap', label: 'হ্যান্ড ম্যাপ', icon: <Spline className="w-[22px] h-[22px]" /> },
  { id: 'reports', label: 'রিপোর্ট', icon: <FileText className="w-[22px] h-[22px]" /> },
  { id: 'admin', label: 'এডমিন', icon: <Lock className="w-[22px] h-[22px]" /> },
];

/** ছবি না থাকলে সবুজ গোল আইকন */
const PersonGlyph = () => (
  <svg viewBox="0 0 24 24" className="w-[78%] h-[78%]" aria-hidden="true">
    <circle cx="12" cy="8" r="4.2" fill="currentColor" />
    <path d="M3.5 24c0-5.2 3.8-9 8.5-9s8.5 3.8 8.5 9z" fill="currentColor" />
  </svg>
);

export const SidePanel: React.FC<SidePanelProps> = ({ open, active, onClose, onNavigate }) => {
  const p = useProfile();
  const [toast, setToast] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(''), 2000);
  };

  // খোলা থাকলে পেছনের পাতা স্ক্রল হবে না; Esc চাপলে বন্ধ
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(p.address);
      showToast('ঠিকানা কপি হয়েছে');
    } catch {
      showToast(p.address);
    }
  };

  return (
    <>
      {/* পেছনের কালো পর্দা — চাপলে বন্ধ */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-slate-950/55 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        id="side-panel"
        role="dialog"
        aria-modal="true"
        aria-label="সাইড প্যানেল"
        aria-hidden={!open}
        inert={!open}
        className={`fixed top-0 bottom-0 left-0 z-[61] w-[86%] max-w-[360px] bg-[#f4f6f5] rounded-r-[32px] flex flex-col overflow-y-auto overscroll-contain shadow-2xl transition-transform duration-[260ms] ease-out ${
          open ? 'translate-x-0' : '-translate-x-[104%]'
        }`}
      >
        <div className="flex items-center justify-between pt-3.5 pb-1 pl-[18px] pr-3.5">
          <b className="text-[15px] font-extrabold text-slate-600">আমার পরিচিতি</b>
          <button
            ref={closeBtn}
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="w-12 h-12 rounded-2xl bg-white shadow-[0_2px_6px_rgba(15,23,42,.08)] flex items-center justify-center text-slate-800 active:scale-95 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* প্রোফাইল কার্ড */}
        <div className="mx-3.5 mt-2 mb-3 bg-white rounded-[28px] p-4 flex items-center gap-3.5 shadow-[0_4px_14px_rgba(15,23,42,.06)]">
          <div className="relative w-20 h-20 shrink-0 rounded-full bg-gradient-to-b from-emerald-200 to-emerald-400 text-emerald-900">
            <div className="absolute inset-0 rounded-full overflow-hidden flex items-end justify-center">
              {p.photo ? (
                <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <PersonGlyph />
              )}
            </div>
            <button
              onClick={() => showToast('ছবি বদলাতে: এডমিন → সেটিংস')}
              aria-label="ছবি বদলান"
              className="absolute -right-0.5 -bottom-0.5 w-[30px] h-[30px] rounded-full bg-white text-emerald-800 flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,.25)]"
            >
              <Camera className="w-[17px] h-[17px]" />
            </button>
          </div>
          <div className="min-w-0">
            <h2 className="text-[21px] font-extrabold leading-tight text-slate-900 break-words">{p.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[13px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <Briefcase className="w-3.5 h-3.5" />
                {p.title}
              </span>
              <span className="inline-flex items-center gap-1 text-[13px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
                <MapPin className="w-3.5 h-3.5" />
                {p.area}
              </span>
            </div>
          </div>
        </div>

        {/* বড় সবুজ কল বোতাম */}
        <a
          href={telHref(p.phone)}
          className="mx-3.5 mb-2.5 flex items-center gap-3 bg-[#065f46] text-white rounded-[26px] px-4 py-3.5 active:scale-[.97] transition"
        >
          <span className="w-[52px] h-[52px] rounded-[18px] bg-white/15 flex items-center justify-center shrink-0">
            <Phone className="w-7 h-7" />
          </span>
          <span className="min-w-0">
            <small className="block text-[13px] font-semibold text-emerald-200">ফোন</small>
            <b className="block text-[20px] font-extrabold tracking-wide">{p.phone}</b>
          </span>
          <span className="ml-auto text-[15px] font-extrabold bg-white text-[#065f46] px-3.5 py-2 rounded-full">কল</span>
        </a>

        {/* Facebook + ঠিকানা */}
        <div className="grid grid-cols-2 gap-2.5 mx-3.5 mb-3">
          <a
            href={p.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-3xl p-3.5 text-left flex flex-col gap-2 min-h-[120px] shadow-[0_2px_10px_rgba(15,23,42,.05)] active:scale-[.97] transition"
          >
            <span className="w-12 h-12 rounded-2xl bg-[#e7f0fe] text-[#1877f2] flex items-center justify-center">
              <Facebook className="w-[26px] h-[26px]" />
            </span>
            <span>
              <b className="block text-base font-extrabold leading-tight text-slate-900">Facebook</b>
              <small className="block text-[13px] text-slate-600 leading-snug">{p.facebookName}</small>
            </span>
          </a>
          <button
            onClick={copyAddress}
            className="bg-white rounded-3xl p-3.5 text-left flex flex-col gap-2 min-h-[120px] shadow-[0_2px_10px_rgba(15,23,42,.05)] active:scale-[.97] transition"
          >
            <span className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <MapPin className="w-[26px] h-[26px]" />
            </span>
            <span>
              <b className="block text-base font-extrabold leading-tight text-slate-900">ঠিকানা</b>
              <small className="block text-[13px] text-slate-600 leading-snug">{p.address}</small>
            </span>
          </button>
        </div>

        {/* মেনু */}
        <nav className="mx-3.5 mb-3 bg-white rounded-[26px] p-1.5" aria-label="মেনু">
          {MENU.map((m) => {
            const on = active === m.id;
            const lock = m.id === 'admin';
            return (
              <button
                key={m.id}
                id={`side-${m.id}`}
                onClick={() => onNavigate(m.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3.5 w-full min-h-[58px] px-2.5 rounded-[20px] text-[17px] font-bold text-left transition active:scale-[.98] ${
                  on ? 'bg-emerald-100 text-emerald-950' : 'text-slate-900'
                }`}
              >
                <span
                  className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center ${
                    on ? 'bg-[#065f46] text-white' : lock ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {m.icon}
                </span>
                {m.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto text-center text-[13px] text-slate-500 px-3.5 pt-1 pb-4">
          ভূমি ও আমিন · ফিল্ড আমিন সংস্করণ
        </div>

        {/* ছোট বার্তা */}
        <div
          role="status"
          className={`fixed left-1/2 bottom-24 -translate-x-1/2 z-[70] bg-slate-900 text-white text-[15px] font-semibold px-4 py-2.5 rounded-2xl max-w-[80vw] text-center transition-all ${
            toast ? 'opacity-100' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          {toast}
        </div>
      </aside>
    </>
  );
};
