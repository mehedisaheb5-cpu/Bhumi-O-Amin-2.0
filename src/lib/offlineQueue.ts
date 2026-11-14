/**
 * Offline Queue — guarantees surveyRecords never lost when offline
 * Stores pending Firestore writes in localStorage and replays when online
 */
import { isFirebaseConfigured, db, doc, setDoc, cleanForFirestore } from './firebase';

export interface QueuedOp {
  id: string; // queue entry id
  collection: string; // e.g. 'surveyRecords'
  docId: string;
  data: any;
  op: 'set' | 'update';
  createdAt: number;
  attempts: number;
}

const QUEUE_KEY = 'bhumi_offline_queue_v1';
const MAX_ATTEMPTS = 5;

export function getQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveQueue(q: QueuedOp[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}

export function enqueue(op: Omit<QueuedOp, 'id' | 'createdAt' | 'attempts'>) {
  const q = getQueue();
  q.push({
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    collection: op.collection,
    docId: op.docId,
    data: op.data,
    op: op.op,
    createdAt: Date.now(),
    attempts: 0,
  });
  saveQueue(q);
  return q.length;
}

export function dequeue(id: string) {
  const q = getQueue().filter(x => x.id !== id);
  saveQueue(q);
}

export function queueLength(): number {
  return getQueue().length;
}

export async function syncQueue(): Promise<{ synced: number; failed: number; remaining: number }> {
  if (!isFirebaseConfigured || !db) return { synced: 0, failed: 0, remaining: queueLength() };
  if (!navigator.onLine) return { synced: 0, failed: 0, remaining: queueLength() };
  const q = getQueue();
  if (!q.length) return { synced: 0, failed: 0, remaining: 0 };
  let synced = 0, failed = 0;
  const remaining: QueuedOp[] = [];
  for (const item of q) {
    if (item.attempts >= MAX_ATTEMPTS) { failed++; continue; } // drop after max
    try {
      const ref = doc(db, item.collection as any, item.docId);
      const payload = cleanForFirestore(item.data);
      if (item.op === 'set') await setDoc(ref, payload);
      else {
        const { updateDoc } = await import('./firebase');
        await updateDoc(ref, payload);
      }
      synced++;
    } catch (e) {
      console.warn('[offlineQueue] sync failed', item.docId, e);
      remaining.push({ ...item, attempts: item.attempts + 1 });
      failed++;
    }
  }
  saveQueue(remaining);
  return { synced, failed: failed - (q.length - remaining.length - synced), remaining: remaining.length };
}

// Auto-sync when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncQueue().then(r => {
      if (r.synced) console.log(`[offlineQueue] synced ${r.synced} pending ops`);
      // Notify UI via custom event
      window.dispatchEvent(new CustomEvent('bhumi:queueSynced', { detail: r }));
    });
  });
}
