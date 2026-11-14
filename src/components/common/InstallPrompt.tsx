import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Language } from '../../types';

interface Props { lang: Language; }

export const InstallPrompt: React.FC<Props> = ({ lang }) => {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isBn = lang === 'bn';

  useEffect(() => {
    // Already installed? (standalone display)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) return;
    if (localStorage.getItem('bhumi_install_dismissed_v1') === '1') return;

    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBefore as any);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore as any);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || dismissed || !deferred) return null;

  const handleInstall = async () => {
    try {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === 'accepted') {
        setVisible(false);
      }
      setDeferred(null);
    } catch {}
  };
  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('bhumi_install_dismissed_v1', '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-3 right-3 z-50 sm:left-auto sm:right-4 sm:max-w-sm animate-fadeIn">
      <div className="rounded-2xl bg-emerald-950 text-white shadow-2xl border border-emerald-800 p-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black leading-tight">
            {isBn ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
          </p>
          <p className="text-xs text-emerald-100/90 leading-snug mt-0.5">
            {isBn ? 'হোম স্ক্রিনে যোগ করুন — অফলাইনেও খুলবে, দ্রুত কাজ করবে।' : 'Add to Home Screen — works offline, opens faster.'}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 rounded-xl bg-amber-400 text-emerald-950 text-xs font-black flex items-center gap-1.5 hover:bg-amber-300 active:scale-95 transition"
            >
              <Download className="w-4 h-4" />
              <span>{isBn ? 'ইনস্টল' : 'Install'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
            >
              {isBn ? 'পরে' : 'Later'}
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-white/10 text-emerald-200">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
