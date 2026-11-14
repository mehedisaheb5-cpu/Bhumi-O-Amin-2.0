/**
 * ফিল্ড আমিন — IndexedDB (বড় ডেটা: হ্যান্ড ম্যাপের ছবি, পরে রিপোর্ট/লোগো/ক্যালেন্ডার)।
 * সম্পূর্ণ অফলাইন, শুধু এই ফোনে থাকে। নতুন store লাগলে DB_VERSION বাড়িয়ে upgrade-এ যোগ করুন।
 */
const DB_NAME = 'fa-bhumi';
const DB_VERSION = 1;
export type StoreName = 'handmaps' | 'kv';
const STORES: StoreName[] = ['handmaps', 'kv'];

let dbp: Promise<IDBDatabase> | null = null;

function openAt(version: number): Promise<IDBDatabase> {
  return new Promise((ok, bad) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => bad(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = (async () => {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB নেই');
    let db = await openAt(DB_VERSION);
    // কোনো কারণে store না থাকলে (ভাঙা/পুরনো DB) ভার্সন বাড়িয়ে তৈরি করি
    if (STORES.some((s) => !db.objectStoreNames.contains(s))) {
      const v = db.version + 1;
      db.close();
      db = await openAt(v);
    }
    db.onversionchange = () => {
      db.close();
      dbp = null;
    };
    return db;
  })().catch((e) => {
    dbp = null;
    throw e;
  });
  return dbp;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((ok, bad) => {
        const t = db.transaction(store, mode);
        const r = fn(t.objectStore(store));
        r.onsuccess = () => ok(r.result);
        r.onerror = () => bad(r.error);
      })
  );
}

export const idbPut = (store: StoreName, value: { id: string } & Record<string, unknown>) =>
  tx(store, 'readwrite', (s) => s.put(value)).then(() => undefined);
export const idbGet = <T = unknown>(store: StoreName, id: string) => tx<T>(store, 'readonly', (s) => s.get(id) as IDBRequest<T>);
export const idbGetAll = <T = unknown>(store: StoreName) => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
export const idbDelete = (store: StoreName, id: string) => tx(store, 'readwrite', (s) => s.delete(id)).then(() => undefined);
