/**
 * ধাপ ৮ — এডমিন PIN পর্দা (ডিজাইন A: সরল ও ক্লাসিক)।
 *
 * সবুজ হেডার, সাদা কার্ডে তালা + ডট, 👁 দেখানোর বোতাম, নিচে সাদা বর্ডারওয়ালা
 * ইংরেজি সংখ্যার কী-প্যাড। PIN ৪–৬ সংখ্যা; ৫ বার ভুল হলে ৩০ সেকেন্ড বন্ধ।
 * প্রথমবার PIN সেট করার সময় ৮ সংখ্যার রিকভারি কোড একবার দেখানো হয়।
 *
 * শুধু adminPin lib ব্যবহার করে — রিপোর্ট/সার্ভে/মৌজার কোডের সঙ্গে কোনো সম্পর্ক নেই।
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Delete, Eye, EyeOff, Lock } from 'lucide-react';
import {
  AUTO_LOCK_MINUTES,
  LOCK_SECONDS,
  MAX_FAILS,
  RECOVERY_CODE_LEN,
  clearLock,
  hasPin,
  isValidPinFormat,
  isValidRecoveryFormat,
  lockRemainingSeconds,
  markUnlocked,
  setPin,
  verifyPin,
  verifyRecovery,
} from '../../lib/adminPin';

type Mode =
  | 'enter'
  | 'setup-new'
  | 'setup-confirm'
  | 'rec'
  | 'show-recovery'
  | 'change-old'
  | 'change-new'
  | 'change-confirm';

const TITLES: Record<Mode, [string, string]> = {
  enter: ['PIN দিন', 'এডমিন খুলতে আপনার PIN'],
  rec: ['রিকভারি কোড দিন', 'PIN সেট করার সময়ের ৮ সংখ্যার কোড'],
  'setup-new': ['নতুন PIN দিন', '৪ থেকে ৬ সংখ্যা'],
  'setup-confirm': ['আবার একই PIN দিন', 'ভুল এড়াতে দ্বিতীয়বার'],
  'show-recovery': ['রিকভারি কোড', 'এই কোডটি নিরাপদে লিখে রাখুন — হারিয়ে গেলে PIN খোলা যাবে না'],
  'change-old': ['বর্তমান PIN দিন', 'PIN বদলাতে আগে পুরনোটা'],
  'change-new': ['নতুন PIN দিন', '৪ থেকে ৬ সংখ্যা'],
  'change-confirm': ['আবার একই PIN দিন', 'ভুল এড়াতে দ্বিতীয়বার'],
};

const MAIN_LABEL: Record<Mode, string> = {
  enter: 'খুলুন',
  rec: 'যাচাই করুন',
  'setup-new': 'পরের ধাপ',
  'setup-confirm': 'PIN সেট করুন',
  'show-recovery': 'আমি লিখে রেখেছি',
  'change-old': 'পরের ধাপ',
  'change-new': 'পরের ধাপ',
  'change-confirm': 'PIN বদলান',
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toBn = (n: number | string): string => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

interface PinLockScreenProps {
  /** 'enter' = এডমিন খোলার গেট (PIN না থাকলে প্রথমবার সেট করতে বলবে); 'change' = PIN বদলানো। */
  initialMode: 'enter' | 'change';
  /** আনলক হলে ডাকা হয়; changed=true মানে PIN এইমাত্র বদলানো হয়েছে। */
  onUnlocked: (changed: boolean) => void;
  /** পেছনের বোতাম — গেটে হোমে ফেরে, বদলানোতে এডমিনে ফেরে। */
  onCancel: () => void;
}

export default function PinLockScreen({ initialMode, onUnlocked, onCancel }: PinLockScreenProps) {
  const [mode, setMode] = useState<Mode>(() =>
    initialMode === 'change' ? 'change-old' : hasPin() ? 'enter' : 'setup-new',
  );
  const [buf, setBuf] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const [newPin, setNewPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // লকের কাউন্টডাউন — প্রতি সেকেন্ডে আবার আঁকে
  useEffect(() => {
    if (lockUntil <= 0) return;
    const id = window.setInterval(() => {
      setTick(Date.now());
      if (lockRemainingSeconds() <= 0) {
        clearLock();
        setLockUntil(0);
        setErr('');
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const locked = lockUntil > 0 && lockRemainingSeconds() > 0;
  const maxLen = mode === 'rec' ? RECOVERY_CODE_LEN : 6;
  const minLen = mode === 'rec' ? RECOVERY_CODE_LEN : 4;
  const canSubmit = buf.length >= minLen && !busy && !locked;

  const pressDigit = useCallback(
    (d: string) => {
      if (locked || busy) return;
      setErr('');
      setBuf((b) => (b.length < maxLen ? b + d : b));
    },
    [locked, busy, maxLen],
  );

  const backspace = useCallback(() => {
    if (locked || busy) return;
    setBuf((b) => b.slice(0, -1));
  }, [locked, busy]);

  const clearAll = useCallback(() => {
    if (locked || busy) return;
    setBuf('');
    setErr('');
  }, [locked, busy]);

  const failOnce = (failsLeft: number, nextLockedUntil: number) => {
    if (nextLockedUntil > 0) {
      setLockUntil(nextLockedUntil);
      setErr(
        `${toBn(MAX_FAILS)} বার ভুল হয়েছে — ${toBn(LOCK_SECONDS)} সেকেন্ড বন্ধ থাকবে।`,
      );
    } else {
      setErr(`PIN মেলেনি — আর ${toBn(failsLeft)} বার চেষ্টা করা যাবে।`);
    }
    setBuf('');
  };

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr('');
    try {
      if (mode === 'enter' || mode === 'change-old') {
        const r = await verifyPin(buf);
        if (r.ok) {
          if (mode === 'enter') {
            markUnlocked();
            onUnlocked(false);
          } else {
            setMode('change-new');
            setBuf('');
          }
        } else {
          failOnce(r.failsLeft, r.lockedUntil);
        }
      } else if (mode === 'rec') {
        if (!isValidRecoveryFormat(buf)) {
          setErr('রিকভারি কোড ৮ সংখ্যার হয়।');
          setBuf('');
        } else if (await verifyRecovery(buf)) {
          setMode('setup-new');
          setBuf('');
          setErr('');
        } else {
          setErr('কোডটি মেলেনি — আবার চেষ্টা করুন।');
          setBuf('');
        }
      } else if (mode === 'setup-new' || mode === 'change-new') {
        if (!isValidPinFormat(buf)) {
          setErr('PIN ৪ থেকে ৬ সংখ্যার হতে হবে।');
          setBuf('');
        } else {
          setNewPin(buf);
          setMode(mode === 'setup-new' ? 'setup-confirm' : 'change-confirm');
          setBuf('');
        }
      } else if (mode === 'setup-confirm' || mode === 'change-confirm') {
        if (buf !== newPin) {
          setErr('দুটো PIN মিলছে না — আবার দিন।');
          setMode(mode === 'setup-confirm' ? 'setup-new' : 'change-new');
          setNewPin('');
          setBuf('');
        } else {
          const { recoveryCode: code } = await setPin(buf);
          if (mode === 'setup-confirm') {
            setRecoveryCode(code);
            setMode('show-recovery');
            setBuf('');
          } else {
            markUnlocked();
            onUnlocked(true);
          }
        }
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [canSubmit, mode, buf, newPin, onUnlocked]);

  const copyRecovery = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      window.setTimeout(() => mountedRef.current && setCopied(false), 2000);
    } catch {
      setErr('কপি করা যায়নি — কোডটি হাতে লিখে রাখুন।');
    }
  }, [recoveryCode]);

  if (mode === 'show-recovery') {
    return (
      <div className="space-y-3 animate-fadeIn">
        <div className="bg-[#065f46] text-white flex items-center gap-2 px-3 rounded-2xl min-h-[58px]">
          <button
            onClick={onCancel}
            aria-label="ফিরে যান"
            className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black flex-1">এডমিন</h1>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#065f46] border-2 border-emerald-200 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-[#065f46]">রিকভারি কোড</h2>
          <p className="text-[15px] font-semibold text-slate-500">
            PIN ভুলে গেলে এই কোড দিয়ে খোলা যাবে। কোডটি নিরাপদে লিখে রাখুন — এটি আর
            দেখানো হবে না।
          </p>
          <div className="text-3xl font-black tracking-[0.2em] text-slate-900 bg-slate-50 border border-slate-200 rounded-xl py-3">
            {recoveryCode.slice(0, 4)} {recoveryCode.slice(4)}
          </div>
          <button
            onClick={copyRecovery}
            className="inline-flex items-center gap-2 min-h-12 px-5 rounded-xl border-[1.5px] border-slate-300 bg-white text-[15px] font-bold text-[#065f46] active:scale-95"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'কপি হয়েছে' : 'কোড কপি করুন'}
          </button>
          <button
            onClick={() => {
              markUnlocked();
              onUnlocked(false);
            }}
            className="w-full min-h-12 rounded-xl bg-[#065f46] text-white text-base font-bold active:scale-[0.98]"
          >
            আমি লিখে রেখেছি
          </button>
        </div>
      </div>
    );
  }

  const [title, sub] = TITLES[mode];
  const dotsCount = mode === 'rec' ? RECOVERY_CODE_LEN : 6;
  const lockSecs = locked ? lockRemainingSeconds() : 0;
  void tick;

  return (
    <div className="flex flex-col animate-fadeIn">
      {/* সবুজ হেডার */}
      <div className="bg-[#065f46] text-white flex items-center gap-2 px-3 rounded-2xl min-h-[58px]">
        <button
          onClick={onCancel}
          aria-label="ফিরে যান"
          className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black flex-1">এডমিন</h1>
      </div>

      {/* সাদা কার্ড */}
      <div className="bg-white border-x border-b border-slate-200 px-4 pt-4 pb-3 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#065f46] border-2 border-emerald-200 flex items-center justify-center mx-auto mb-2">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-[#065f46]">{title}</h2>
        <p className="text-[15px] font-semibold text-slate-500">{sub}</p>
        <div className="flex items-center justify-center gap-2 mt-3 min-h-[44px]" aria-label="PIN ডট">
          {Array.from({ length: dotsCount }).map((_, i) => {
            const filled = i < buf.length;
            const ch = show && filled ? buf[i] : filled ? '•' : '';
            return (
              <span
                key={i}
                className={`w-11 h-11 rounded-full border-[1.5px] flex items-center justify-center text-xl font-black ${
                  filled ? 'border-[#065f46] bg-emerald-50 text-[#065f46]' : 'border-slate-300 text-slate-400'
                }`}
              >
                {ch}
              </span>
            );
          })}
          <button
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'সংখ্যা লুকান' : 'সংখ্যা দেখান'}
            className="w-11 h-11 rounded-xl border-[1.5px] border-slate-300 inline-flex items-center justify-center text-slate-500 active:scale-95"
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <div className="min-h-[22px] mt-1">
          {locked ? (
            <p className="text-[15px] font-bold text-red-600">
              {toBn(LOCK_SECONDS)} সেকেন্ড বন্ধ আছে — আর {toBn(lockSecs)} সেকেন্ড
            </p>
          ) : (
            err && <p className="text-[15px] font-bold text-red-600">{err}</p>
          )}
        </div>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full min-h-12 rounded-xl bg-[#065f46] text-white text-base font-bold disabled:opacity-40 active:scale-[0.98] mt-1"
        >
          {busy ? 'যাচাই হচ্ছে…' : MAIN_LABEL[mode]}
        </button>
        {(mode === 'enter' || mode === 'change-old') && (
          <button
            onClick={() => {
              setMode('rec');
              setBuf('');
              setErr('');
            }}
            className="text-[15px] font-bold text-[#065f46] underline mt-2 min-h-11 px-3"
          >
            রিকভারি কোড দিয়ে খুলুন
          </button>
        )}
        {mode === 'rec' && (
          <button
            onClick={() => {
              setMode(hasPin() ? 'enter' : 'setup-new');
              setBuf('');
              setErr('');
            }}
            className="text-[15px] font-bold text-[#065f46] underline mt-2 min-h-11 px-3"
          >
            PIN দিয়ে খুলুন
          </button>
        )}
      </div>

      <p className="text-center text-[13px] font-semibold text-slate-500 px-4 pt-2">
        ৫ বার ভুল হলে {toBn(LOCK_SECONDS)} সেকেন্ড বন্ধ · {toBn(AUTO_LOCK_MINUTES)} মিনিট না
        চালালে আবার লক
      </p>

      {/* কী-প্যাড */}
      <div className="mt-auto bg-white border-t-[1.5px] border-slate-300 px-3 pt-3 pb-2 mt-3 rounded-2xl">
        <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              disabled={locked || busy}
              className="min-h-14 rounded-2xl border-[1.5px] border-slate-300 bg-white text-xl font-black text-slate-800 active:bg-emerald-50 disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <button
            onClick={clearAll}
            disabled={locked || busy}
            className="min-h-14 rounded-2xl border-[1.5px] border-slate-300 bg-white text-base font-bold text-[#065f46] active:bg-emerald-50 disabled:opacity-40"
          >
            মুছুন
          </button>
          <button
            onClick={() => pressDigit('0')}
            disabled={locked || busy}
            className="min-h-14 rounded-2xl border-[1.5px] border-slate-300 bg-white text-xl font-black text-slate-800 active:bg-emerald-50 disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={backspace}
            disabled={locked || busy}
            aria-label="একটি সংখ্যা মুছুন"
            className="min-h-14 rounded-2xl border-[1.5px] border-slate-300 bg-white text-[#065f46] active:bg-emerald-50 disabled:opacity-40 flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
