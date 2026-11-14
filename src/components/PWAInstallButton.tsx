import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../types';

interface PWAInstallButtonProps {
  lang: Language;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95"
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-full bg-emerald-800/80 text-emerald-100 hover:bg-emerald-700 border border-emerald-600/50 px-3 py-1.5 text-xs font-medium transition active:scale-95"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-300" />
          <span>{lang === 'bn' ? 'হোমস্ক্রিনে যুক্ত' : 'Add to Home'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-900 border border-emerald-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-900 text-amber-400 flex items-center justify-center font-bold text-sm">
                    ভূ
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    {lang === 'bn' ? 'আইফোনে ইনস্টল করুন' : 'Install on iPhone / iPad'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center">
                    ১
                  </span>
                  <p>
                    {lang === 'bn'
                      ? 'সাফারি ব্রাউজারের নিচের শেয়ার বাটনে (Share icon) চাপ দিন।'
                      : 'Tap the Share icon at the bottom of Safari.'}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center">
                    ২
                  </span>
                  <p>
                    {lang === 'bn'
                      ? 'নিচের দিকে স্ক্রোল করে "Add to Home Screen" নির্বাচন করুন।'
                      : 'Scroll down and tap "Add to Home Screen".'}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center">
                    ৩
                  </span>
                  <p>
                    {lang === 'bn'
                      ? 'উপরে "Add" চাপলেই অ্যাপটি মোবাইলের হোমস্ক্রিনে চলে আসবে।'
                      : 'Tap "Add" in the top right to install.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-emerald-900 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 shadow-md transition"
              >
                {lang === 'bn' ? 'বুঝতে পেরেছি' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
