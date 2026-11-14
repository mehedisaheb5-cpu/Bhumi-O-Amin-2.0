import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
  type UserCredential,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import {
  getStorage,
  type FirebaseStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  type UploadTask,
  type UploadTaskSnapshot,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentAuth = auth;
  const currentUser = currentAuth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Security Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check for Firebase credentials in env or provisioned applet config
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '';
const rawAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '';
const authDomain = rawAuthDomain || (projectId ? `${projectId}.firebaseapp.com` : '');

const rawDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId;
const firestoreDatabaseId = rawDbId && !rawDbId.startsWith('G-') && rawDbId !== '(default)' ? rawDbId : '(default)';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || (projectId ? `${projectId}.firebasestorage.app` : ''),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || '',
  firestoreDatabaseId,
};

/**
 * ফিল্ড আমিন সংস্করণ: Firebase পুরোপুরি বন্ধ (অফলাইন, একক ব্যবহারকারী)।
 * পুরোনো অ্যাপের Firebase প্রজেক্টে এই কপি কখনো সংযোগ করবে না —
 * env-এ মান থাকলেও না। সব তথ্য ফোনেই থাকে (localStorage / IndexedDB)।
 */
export const FIREBASE_DISABLED = true;

export const isFirebaseConfigured = !FIREBASE_DISABLED && Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

export const isFirebaseStorageConfigured = Boolean(
  isFirebaseConfigured && firebaseConfig.storageBucket
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    // Explicitly configure browserLocalPersistence to prevent session loss
    setPersistence(auth, browserLocalPersistence).catch((persistErr) => {
      console.warn('Firebase setPersistence notice:', persistErr);
    });

    const dbId = firebaseConfig.firestoreDatabaseId;
    db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

    if (firebaseConfig.storageBucket) {
      try {
        storage = getStorage(app);
      } catch (storageErr) {
        console.warn('Firebase Storage initialization failed:', storageErr);
      }
    }

    // Optional connection validation per skill guidelines
    getDocFromServer(doc(db, 'test', 'connection')).catch((err) => {
      if (err instanceof Error && err.message.includes('the client is offline')) {
        console.warn('Firebase client is offline or project pending initialization.');
      }
    });
  } catch (initErr) {
    console.warn('Firebase initialization error, operating in local fallback mode:', initErr);
  }
}

// Helper function to strip undefined values and prepare objects cleanly for Firestore
export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null && !(item instanceof Date)
        ? cleanForFirestore(item)
        : item
    ) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      cleaned[key] = cleanForFirestore(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

export {
  app,
  auth,
  db,
  storage,
  storageRef,
  uploadBytes,
  uploadBytesResumable,
  type UploadTask,
  type UploadTaskSnapshot,
  getDownloadURL,
  deleteObject,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
};

export type { User, UserCredential };
