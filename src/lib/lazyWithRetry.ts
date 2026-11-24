/**
 * lazyWithRetry — React.lazy-র জন্য নিরাপদ dynamic import।
 *
 * সমস্যা: নতুন ভার্সন মার্জের পর ফোনের PWA ক্যাশে পুরোনো index.html/chunk
 * থেকে গেলে প্রথমবার ক্যালেন্ডার/অ্যাডমিন/প্রোফাইল খুলতে
 * "Failed to fetch dynamically imported module" ভেঙে যেত (২৪ নভেম্বর
 * ব্রাউজার-চেকে প্রথমবার ক্যালেন্ডার ভেঙেছিল, রিলোডে চলেছিল)।
 *
 * পদ্ধতি: (১) import ব্যর্থ হলে একবার আবার চেষ্টা (নেটওয়ার্কের হালকা গোলমাল);
 * (২) দ্বিতীয়বারও ব্যর্থ হলে — এক সেশনে একবারই — সার্ভিস ওয়ার্কার
 * আনরেজিস্টার + সব ক্যাশ মুছে রিলোড, যাতে নতুন বান্ডেল আসে;
 * (৩) তারপরও ব্যর্থ হলে ErrorBoundary-কে ভুলটা জানানো হয়।
 * রিলোডের লুপ যেন না হয়, sessionStorage-এ একবারের চিহ্ন রাখা হয়।
 */
import { ComponentType, lazy } from 'react';

const RECOVER_KEY = 'fa-chunk-recover-v1';

async function clearAppCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys().catch(() => []);
      await Promise.all(names.map((n) => caches.delete(n).catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
}

/** chunk লোডের ভুল কিনা — ErrorBoundary-তেও একই শনাক্তকরণ ব্যবহার হয় */
export const isChunkLoadError = (err: unknown): boolean => {
  const m = err instanceof Error ? err.message : String(err ?? '');
  return /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|dynamically imported/i.test(m);
};

/** ক্যাশ পরিষ্কার করে একবার রিলোড (আগে থেকে চেষ্টা করা হয়ে থাকলে false) */
export async function recoverFromStaleCache(): Promise<boolean> {
  try {
    if (sessionStorage.getItem(RECOVER_KEY)) return false;
    sessionStorage.setItem(RECOVER_KEY, '1');
  } catch {
    return false;
  }
  await clearAppCaches();
  window.location.reload();
  return true;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (firstErr) {
      try {
        return await factory();
      } catch (secondErr) {
        // দুইবারই ব্যর্থ — পুরোনো chunk; একবার ক্যাশ-পরিষ্কার রিলোড
        try {
          if (await recoverFromStaleCache()) {
            // রিলোড হচ্ছে — React যেন অপেক্ষা করে
            return new Promise<never>(() => {});
          }
        } catch {
          /* ignore */
        }
        throw secondErr;
      }
    }
  });
}
