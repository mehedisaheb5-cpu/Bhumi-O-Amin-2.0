import React, { useEffect, useState } from 'react';
import { WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { Language } from '../types';
import { getQueue, queueLength, syncQueue } from '../lib/offlineQueue';

interface OfflineIndicatorProps {
  lang: Language;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(queueLength());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setPending(queueLength()); };
    const handleOffline = () => setIsOnline(false);
    const onStorage = () => setPending(queueLength());
    const onQueueSynced = () => setPending(queueLength());
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', onStorage);
    window.addEventListener('bhumi:queueSynced' as any, onQueueSynced);
    const id = setInterval(()=> setPending(queueLength()), 2000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bhumi:queueSynced' as any, onQueueSynced);
      clearInterval(id);
    };
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    const r = await syncQueue();
    setPending(r.remaining);
    setSyncing(false);
  };

  if (isOnline && pending===0) return null;

  return (
    <div
      id="offline-indicator"
      className={`fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg sm:left-auto sm:right-6 sm:max-w-sm border animate-pulse ${isOnline ? 'bg-sky-600 text-white border-sky-400/40' : 'bg-amber-600 text-white border-amber-400/40'}`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? <RefreshCw className={`w-4 h-4 ${syncing?'animate-spin':''}`} /> : <WifiOff className="w-4 h-4 text-amber-200" />}
        <span>
          {!isOnline
            ? (lang === 'bn' ? `অফলাইন — ${pending}টি রেকর্ড কিউতে, অনলাইনে এলে অটো সিঙ্ক হবে` : `Offline — ${pending} queued, will auto-sync when online`)
            : pending>0
              ? (lang === 'bn' ? `${pending}টি বাকি — সিঙ্ক করুন` : `${pending} pending — tap to sync`)
              : (lang === 'bn' ? 'অনলাইন' : 'Online')}
        </span>
      </div>
      {isOnline && pending>0 && (
        <button onClick={handleSyncNow} disabled={syncing} className="bg-white text-sky-800 px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-50">
          {syncing ? '...' : (lang==='bn'?'সিঙ্ক':'Sync')}
        </button>
      )}
      {!isOnline && <CloudOff className="w-4 h-4 opacity-70" />}
    </div>
  );
};
