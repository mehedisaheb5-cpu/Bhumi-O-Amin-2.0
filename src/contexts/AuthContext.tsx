import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserProfile,
  UserRole,
  CustomerProfile,
  AminProfile,
  Language,
} from '../types';
import {
  auth,
  db,
  isFirebaseConfigured,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type User,
} from '../lib/firebase';
import { logAuditEvent } from '../lib/auditLog';
import { syncLocalDataToCloud, SyncStats } from '../lib/cloudSync';

// Bootstrapped Admin emails that automatically receive Admin authorization
export const BOOTSTRAP_ADMIN_EMAILS = ['Mehedifeni33@gmail.com', 'admin@bhumi-amin.gov.bd'];

const LOCAL_SESSION_KEY = 'bhumi-amin-auth-session';
const LOCAL_ACCOUNTS_KEY = 'bhumi-amin-local-accounts';

interface LocalAccountRecord {
  user: UserProfile;
  pass?: string;
}

export function buildProfileFromFirebaseUser(fbUser: User): UserProfile {
  const email = fbUser.email || '';
  const isAdmin =
    BOOTSTRAP_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === email.toLowerCase()) ||
    email.toLowerCase() === 'mehedifeni33@gmail.com';

  const name =
    fbUser.displayName ||
    (email ? email.split('@')[0] : '') ||
    'ব্যবহারকারী';

  return {
    id: fbUser.uid,
    name,
    email,
    phone: fbUser.phoneNumber || '',
    role: isAdmin ? 'admin' : 'customer',
    photoUrl: fbUser.photoURL || '',
    status: 'active',
    createdAt: fbUser.metadata?.creationTime || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export interface AuthContextType {
  user: UserProfile | null;
  currentUser: UserProfile | null;
  role: UserRole | null;
  customerProfile: CustomerProfile | null;
  aminProfile: AminProfile | null;
  loading: boolean;
  isCloudActive: boolean;
  cloudStatusMessageBn: string;
  cloudStatusMessageEn: string;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signup: (params: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: UserRole;
    district?: string;
    upazila?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  saveLocalToCloud: () => Promise<SyncStats>;
  // Dev / Demo quick switch for testing roles in prototype/offline fallback mode
  demoSwitchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
      return savedSession ? (JSON.parse(savedSession) as UserProfile) : null;
    } catch {
      return null;
    }
  });
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [aminProfile, setAminProfile] = useState<AminProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCloudActive, setIsCloudActive] = useState<boolean>(isFirebaseConfigured);

  // Initialize and listen to Auth
  useEffect(() => {
    let isMounted = true;

    // Security Migration: Purge any legacy plaintext passwords from localStorage
    try {
      const rawStored = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) {
          let modified = false;
          const sanitized = parsed.map((acc: any) => {
            if (acc && typeof acc === 'object' && 'pass' in acc) {
              modified = true;
              const { pass, ...rest } = acc;
              return rest;
            }
            return acc;
          });
          if (modified) {
            localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(sanitized));
          }
        }
      }
    } catch {
      // Ignore parse errors safely
    }

    if (isFirebaseConfigured && auth) {
      let redirectProcessing = Promise.resolve();

      // 1. Process any Google redirect sign-in result on page restore
      redirectProcessing = getRedirectResult(auth)
        .then((cred) => {
          if (!isMounted) return;
          if (cred?.user) {
            const authProfile = buildProfileFromFirebaseUser(cred.user);
            setCurrentUser(authProfile);
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authProfile));
            setIsCloudActive(true);
            setLoading(false);
          }
        })
        .catch((redirectErr) => {
          console.warn('Firebase getRedirectResult check:', redirectErr);
        });

      // 2. Subscribe to auth state changes from live Firebase Auth instance
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        await redirectProcessing;
        if (!isMounted) return;

        console.log(`[AuthDiagnostic] ${new Date().toISOString()} onAuthStateChanged fired`, {
          fbUser: !!fbUser,
        });
        console.log('[AuthDiagnostic] onAuthStateChanged fired:', {
          firebaseUserExists: Boolean(fbUser),
          uidExists: Boolean(fbUser?.uid),
          emailExists: Boolean(fbUser?.email),
        });

        if (fbUser) {
          const profileData = buildProfileFromFirebaseUser(fbUser);

          // Immediately sync global authenticated user state
          setCurrentUser(profileData);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(profileData));
          setIsCloudActive(true);

          // Non-blocking optional Firestore profile synchronization
          try {
            if (db) {
              const userDocRef = doc(db, 'users', fbUser.uid);
              const userSnap = await getDoc(userDocRef);

              if (userSnap.exists()) {
                const fsData = userSnap.data() as UserProfile;
                const merged: UserProfile = {
                  ...profileData,
                  ...fsData,
                  // Ensure admin role for bootstrapped admin email
                  role: profileData.role === 'admin' ? 'admin' : fsData.role || profileData.role,
                };
                if (isMounted) {
                  setCurrentUser(merged);
                  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(merged));
                }
              } else {
                await setDoc(userDocRef, profileData);
              }

              // Fetch role-specific profile in background
              if (profileData.role === 'customer') {
                const custDocRef = doc(db, 'customerProfiles', fbUser.uid);
                const custSnap = await getDoc(custDocRef);
                if (custSnap.exists() && isMounted) {
                  setCustomerProfile(custSnap.data() as CustomerProfile);
                } else if (isMounted) {
                  const newCust: CustomerProfile = {
                    userId: fbUser.uid,
                    name: profileData.name,
                    email: profileData.email,
                    phone: profileData.phone || '',
                    createdAt: profileData.createdAt,
                    updatedAt: profileData.updatedAt,
                  };
                  await setDoc(custDocRef, newCust);
                  setCustomerProfile(newCust);
                }
              } else if (profileData.role === 'amin') {
                const aminDocRef = doc(db, 'aminProfiles', fbUser.uid);
                const aminSnap = await getDoc(aminDocRef);
                if (aminSnap.exists() && isMounted) {
                  setAminProfile(aminSnap.data() as AminProfile);
                }
              }
            }
          } catch (syncErr) {
            console.warn('Optional Firestore background sync note:', syncErr);
            // User remains logged in with Firebase Auth profileData
          } finally {
            setLoading(false);
          }
        } else {
          // Explicitly signed out in Firebase
          setCurrentUser(null);
          setCustomerProfile(null);
          setAminProfile(null);
          localStorage.removeItem(LOCAL_SESSION_KEY);
          setLoading(false);
        }
      });

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } else {
      // Offline / Local Fallback Mode
      fallbackToLocalSession();
      setLoading(false);
    }
  }, []);

  const fallbackToLocalSession = () => {
    try {
      const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession) as UserProfile;
        setCurrentUser(parsed);
      } else {
        // Logged out / unauthenticated guest state
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const login = async (email: string, pass: string) => {
    setLoading(true);
    if (isFirebaseConfigured && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const authProfile = buildProfileFromFirebaseUser(cred.user);
        setCurrentUser(authProfile);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authProfile));
        setIsCloudActive(true);

        await logAuditEvent({
          actorUserId: cred.user.uid,
          actorRole: authProfile.role,
          action: 'user_logged_in_firebase',
          entityType: 'user',
          entityId: cred.user.uid,
        });
        setLoading(false);
        return { success: true };
      } catch (err: unknown) {
        setLoading(false);
        const errMsg = err instanceof Error ? err.message : 'Login failed';
        return { success: false, error: errMsg };
      }
    } else {
      // Local fallback mode: check against registered accounts in local database
      try {
        const stored = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
        const accounts: LocalAccountRecord[] = stored ? JSON.parse(stored) : [];
        const normalizedEmail = email.trim().toLowerCase();

        const match = accounts.find((a) => a.user.email.toLowerCase() === normalizedEmail);
        if (!match) {
          setLoading(false);
          return {
            success: false,
            error: 'auth/user-not-found',
          };
        }

        if (match.pass && match.pass !== pass) {
          setLoading(false);
          return {
            success: false,
            error: 'auth/wrong-password',
          };
        }

        setCurrentUser(match.user);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(match.user));
        await logAuditEvent({
          actorUserId: match.user.id,
          actorRole: match.user.role,
          action: 'user_logged_in_local_fallback',
          entityType: 'user',
          entityId: match.user.id,
        });

        setLoading(false);
        return { success: true };
      } catch (err: unknown) {
        setLoading(false);
        const errMsg = err instanceof Error ? err.message : 'Login failed';
        return { success: false, error: errMsg };
      }
    }
  };

  const signup = async (params: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: UserRole;
    district?: string;
    upazila?: string;
  }) => {
    setLoading(true);
    const isAdmin =
      BOOTSTRAP_ADMIN_EMAILS.includes(params.email) ||
      params.email.toLowerCase() === 'mehedifeni33@gmail.com';

    // Prevent privilege escalation: only bootstrap emails can be created as admin
    const finalRole: UserRole = isAdmin ? 'admin' : params.role === 'admin' ? 'customer' : params.role;

    if (isFirebaseConfigured && auth && db) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
        const now = new Date().toISOString();
        const profile: UserProfile = {
          id: cred.user.uid,
          name: params.name,
          email: params.email,
          phone: params.phone || '',
          role: finalRole,
          district: params.district || '',
          upazila: params.upazila || '',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, 'users', cred.user.uid), profile);

        if (finalRole === 'customer') {
          await setDoc(doc(db, 'customerProfiles', cred.user.uid), {
            userId: cred.user.uid,
            name: params.name,
            phone: params.phone || '',
            email: params.email,
            district: params.district || '',
            upazila: params.upazila || '',
            createdAt: now,
            updatedAt: now,
          });
        } else if (finalRole === 'amin') {
          await setDoc(doc(db, 'aminProfiles', cred.user.uid), {
            userId: cred.user.uid,
            name: params.name,
            phone: params.phone || '',
            email: params.email,
            district: params.district || '',
            upazila: params.upazila || '',
            experienceYears: 1,
            servicesOffered: ['measurement', 'boundary'],
            verificationStatus: 'pending', // Requires admin verification
            rating: 5.0,
            completedJobsCount: 0,
            createdAt: now,
            updatedAt: now,
          });
        }

        await logAuditEvent({
          actorUserId: cred.user.uid,
          actorRole: finalRole,
          action: 'user_registered_firebase',
          entityType: 'user',
          entityId: cred.user.uid,
          details: `Role: ${finalRole}, Verified: pending`,
        });

        setCurrentUser(profile);
        setLoading(false);
        return { success: true };
      } catch (err: unknown) {
        setLoading(false);
        const errMsg = err instanceof Error ? err.message : 'Sign up failed';
        return { success: false, error: errMsg };
      }
    } else {
      // Local fallback account creation
      try {
        const stored = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
        const accounts: LocalAccountRecord[] = stored ? JSON.parse(stored) : [];
        const normalizedEmail = params.email.trim().toLowerCase();

        if (accounts.some((a) => a.user.email.toLowerCase() === normalizedEmail)) {
          setLoading(false);
          return {
            success: false,
            error: 'auth/email-already-in-use',
          };
        }

        const now = new Date().toISOString();
        const localUser: UserProfile = {
          id: `usr_local_${Date.now()}`,
          name: params.name,
          email: params.email,
          phone: params.phone || '',
          role: finalRole,
          district: params.district || '',
          upazila: params.upazila || '',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };

        // Security Enforcement: Do NOT store plaintext password in browser localStorage
        accounts.push({ user: localUser });
        localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
        setCurrentUser(localUser);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));

        await logAuditEvent({
          actorUserId: localUser.id,
          actorRole: finalRole,
          action: 'user_registered_local_fallback',
          entityType: 'user',
          entityId: localUser.id,
        });

        setLoading(false);
        return { success: true };
      } catch (err: unknown) {
        setLoading(false);
        const errMsg = err instanceof Error ? err.message : 'Sign up failed';
        return { success: false, error: errMsg };
      }
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    if (isFirebaseConfigured && auth) {
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({
          prompt: 'select_account',
        });

        // Use standard Firebase popup flow directly
        const cred = await signInWithPopup(auth, provider);

        // Safe diagnostic logging (Requirement 9: never log tokens, passwords, or secrets)
        console.log('[AuthDiagnostic] signInWithPopup completed:', {
          firebaseUserExists: Boolean(cred?.user),
          uidExists: Boolean(cred?.user?.uid),
          emailExists: Boolean(cred?.user?.email),
        });

        if (cred?.user) {
          const authProfile = buildProfileFromFirebaseUser(cred.user);

          // Synchronize shared AuthContext state immediately
          setCurrentUser(authProfile);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(authProfile));
          setIsCloudActive(true);

          await logAuditEvent({
            actorUserId: cred.user.uid,
            actorRole: authProfile.role,
            action: 'user_logged_in_google',
            entityType: 'user',
            entityId: cred.user.uid,
          });
        }

        setLoading(false);
        return { success: true };
      } catch (err: unknown) {
        setLoading(false);
        const errMsg = err instanceof Error ? err.message : 'Google sign-in failed';
        return { success: false, error: errMsg };
      }
    } else {
      setLoading(false);
      return {
        success: false,
        error: 'auth/configuration-not-found',
      };
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.warn('Firebase logout error:', err);
      }
    }
    if (currentUser) {
      await logAuditEvent({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        action: 'user_logged_out',
        entityType: 'user',
        entityId: currentUser.id,
      });
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    localStorage.removeItem('bhumi-amin-active-role');
    setCurrentUser(null);
    setCustomerProfile(null);
    setAminProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (isFirebaseConfigured && auth) {
      try {
        await sendPasswordResetEmail(auth, email);
        return {
          success: true,
          message: 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।',
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to send reset email';
        return { success: false, error: errMsg };
      }
    } else {
      return {
        success: true,
        message: 'স্থানীয় ডেটা মোডে ডেমো পাসওয়ার্ড রিসেট সফল হয়েছে (কোনো ইমেইল সার্ভার সংযোগ নেই)।',
      };
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser) return;

    // Security: sanitize updates to prevent privilege escalation
    const sanitizedUpdates: Partial<UserProfile> = { ...updates };
    delete sanitizedUpdates.role;
    delete sanitizedUpdates.status;
    delete sanitizedUpdates.id;
    delete sanitizedUpdates.email;

    const updated: UserProfile = {
      ...currentUser,
      ...sanitizedUpdates,
      updatedAt: new Date().toISOString(),
    };
    setCurrentUser(updated);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), sanitizedUpdates);
      } catch (err) {
        console.warn('Failed to update user profile in Firestore:', err);
      }
    } else {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updated));
    }
  };

  const saveLocalToCloud = useCallback(async () => {
    if (!currentUser) {
      return {
        surveysSynced: 0,
        reportsSynced: 0,
        bookingsSynced: 0,
        success: false,
        messageBn: 'অনুগ্রহ করে ক্লাউডে সংরক্ষণের আগে লগইন করুন।',
        messageEn: 'Please log in before saving data to cloud.',
      };
    }
    return await syncLocalDataToCloud(currentUser);
  }, [currentUser]);

  // Demo switch role for development & prototype verification
  const demoSwitchRole = (newRole: UserRole) => {
    // Security enforcement: If user is authenticated via real Firebase, prevent role escalation
    if (isCloudActive && auth?.currentUser) {
      const isActualAdmin =
        auth.currentUser.email?.toLowerCase() === 'mehedifeni33@gmail.com' ||
        currentUser?.role === 'admin';

      if (!isActualAdmin && newRole !== 'customer') {
        console.warn('Security guard: Role escalation prevented for authenticated user account.');
        return;
      }
    }

    const isNowAdmin = newRole === 'admin';
    const updated: UserProfile = {
      id: currentUser ? currentUser.id : `usr_demo_${newRole}`,
      name:
        newRole === 'admin'
          ? 'সুপারভাইজর অ্যাডমিন'
          : newRole === 'amin'
          ? 'মো: রফিকুল ইসলাম (আমিন)'
          : 'জমির মালিক (গ্রাহক)',
      email:
        newRole === 'admin'
          ? 'Mehedifeni33@gmail.com'
          : newRole === 'amin'
          ? 'rafiq.amin@bhumi-amin.com'
          : 'customer@bhumi-amin.com',
      phone: '01711223344',
      role: newRole,
      status: 'active',
      district: 'ঢাকা',
      upazila: 'সাভার',
      createdAt: currentUser ? currentUser.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCurrentUser(updated);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updated));
    // Also sync with marketplace active role key for Phase 7 compatibility
    localStorage.setItem('bhumi-amin-active-role', newRole);
  };

  const cloudStatusMessageBn = isCloudActive
    ? 'ফায়ারবেস ক্লাউড ডাটাবেজ ও অথেনটিকেশন সচল রয়েছে।'
    : 'ক্লাউড সংযোগ বর্তমানে পাওয়া যাচ্ছে না। স্থানীয় ডেটা মোড চালু আছে।';

  const cloudStatusMessageEn = isCloudActive
    ? 'Firebase Cloud Database & Auth active.'
    : 'Cloud connection currently unavailable. Local data mode is active.';

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        currentUser,
        role: currentUser?.role || null,
        customerProfile,
        aminProfile,
        loading,
        isCloudActive,
        cloudStatusMessageBn,
        cloudStatusMessageEn,
        login,
        signup,
        loginWithGoogle,
        logout,
        resetPassword,
        updateUserProfile,
        saveLocalToCloud,
        demoSwitchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
