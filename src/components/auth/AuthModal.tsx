import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CloudOff,
  Cloud,
  LogOut,
} from 'lucide-react';
import { Language, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  initialMode?: 'login' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  initialMode = 'login',
}) => {
  const {
    currentUser,
    logout,
    login,
    signup,
    loginWithGoogle,
    resetPassword,
    isCloudActive,
    cloudStatusMessageBn,
    cloudStatusMessageEn,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('ঢাকা');
  const [upazila, setUpazila] = useState('সাভার');
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync mode and clear feedback whenever modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsLoading(false);
    }
  }, [isOpen, initialMode]);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Translate Firebase error codes and network failures to clear Bengali and English messages
  const friendlyError = (raw: unknown): string => {
    const text =
      typeof raw === 'string'
        ? raw
        : (raw as Error)?.message || String(raw || '');
    const lower = text.toLowerCase();

    if (
      lower.includes('user-not-found') ||
      lower.includes('invalid-credential') ||
      lower.includes('wrong-password') ||
      lower.includes('invalid-login-credentials')
    ) {
      return lang === 'bn'
        ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে তথ্য যাচাই করে পুনরায় লিখুন।'
        : 'Invalid email or password. Please verify and try again.';
    }
    if (lower.includes('invalid-email')) {
      return lang === 'bn'
        ? 'অনুগ্রহ করে সঠিক ইমেইল এড্রেস লিখুন (যেমন: name@example.com)।'
        : 'Please enter a valid email address.';
    }
    if (lower.includes('email-already-in-use')) {
      return lang === 'bn'
        ? 'এই ইমেইল দিয়ে ইতোমধ্যে একটি অ্যাকাউন্ট রয়েছে। অনুগ্রহ করে লগইন করুন।'
        : 'An account with this email already exists. Please log in.';
    }
    if (lower.includes('weak-password')) {
      return lang === 'bn'
        ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
        : 'Password must be at least 6 characters.';
    }
    if (lower.includes('too-many-requests')) {
      return lang === 'bn'
        ? 'অনেকবার ভুল চেষ্টা করা হয়েছে। সাময়িকভাবে লগইন স্থগিত রয়েছে। কিছুক্ষণ পর চেষ্টা করুন।'
        : 'Access temporarily disabled due to too many failed attempts. Try again later.';
    }
    if (
      lower.includes('network-request-failed') ||
      lower.includes('network error') ||
      lower.includes('offline')
    ) {
      return lang === 'bn'
        ? 'ইন্টারনেট বা নেটওয়ার্ক সংযোগ পাওয়া যাচ্ছে না। দয়া করে আপনার ইন্টারনেট চেক করুন।'
        : 'Network connection failed. Please check your internet connection.';
    }
    if (lower.includes('user-disabled')) {
      return lang === 'bn'
        ? 'এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। সহায়তার জন্য প্রশাসকের সাথে যোগাযোগ করুন।'
        : 'This user account has been disabled.';
    }
    if (lower.includes('configuration-not-found')) {
      return lang === 'bn'
        ? 'ফায়ারবেসে গুগল সাইন-ইন কনফিগারেশন পাওয়া যায়নি (auth/configuration-not-found)। ফায়ারবেস কনসোলে গুগল প্রোভাইডার সক্রিয় করে প্রজেক্ট সাপোর্ট ইমেইল ও অথরাইজড ডোমেইন নির্বাচন করুন।'
        : 'Firebase Google Sign-In configuration error (auth/configuration-not-found). Please ensure Google Sign-In is enabled in Firebase Console with a project support email and authorized domain.';
    }
    if (lower.includes('popup-blocked')) {
      return lang === 'bn'
        ? 'ব্রাউজারের পপআপ ব্লকার উইন্ডোটি আটকে দিয়েছে। অনুগ্রহ করে ব্রাউজারে পপআপ খোলার অনুমতি দিন।'
        : 'Sign-in popup was blocked by browser. Please allow popups for this site.';
    }
    if (lower.includes('popup-closed-by-user')) {
      return lang === 'bn'
        ? 'গুগল সাইন-ইন উইন্ডোটি সম্পন্ন হওয়ার পূর্বেই বন্ধ করা হয়েছে।'
        : 'Google sign-in popup was closed before completing.';
    }
    if (lower.includes('cancelled-popup-request')) {
      return lang === 'bn'
        ? 'পূর্ববর্তী গুগল সাইন-ইন অনুরোধটি বাতিল করা হয়েছে।'
        : 'Previous sign-in request was cancelled.';
    }
    if (lower.includes('unauthorized-domain')) {
      return lang === 'bn'
        ? 'এই ওয়েব ডোমেইনটি ফায়ারবেসের অনুমোদিত ডোমেইন তালিকায় যুক্ত নেই। ফায়ারবেস কনসোলে ডোমেইনটি অথরাইজ করুন।'
        : 'This domain is not authorized for OAuth operations in Firebase Console.';
    }
    if (lower.includes('account-exists-with-different-credential')) {
      return lang === 'bn'
        ? 'এই ইমেইল দিয়ে ইতোমধ্যে অন্য মাধ্যমে অ্যাকাউন্ট রয়েছে। দয়া করে পূর্বের পদ্ধতিতে (যেমন: ইমেইল ও পাসওয়ার্ড) লগইন করুন।'
        : 'An account already exists with the same email using a different sign-in method.';
    }
    if (lower.includes('operation-not-allowed')) {
      return lang === 'bn'
        ? 'ফায়ারবেস কনসোলে এই লগইন পদ্ধতিটি এখনও চালু করা হয়নি।'
        : 'This sign-in provider is not enabled in Firebase Console.';
    }
    return text || (lang === 'bn' ? 'লগইন সম্পন্ন করা যায়নি।' : 'Authentication failed.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic validation
    if (!email.trim()) {
      setErrorMsg(
        lang === 'bn'
          ? 'অনুগ্রহ করে আপনার ইমেইল এড্রেস লিখুন।'
          : 'Please enter your email address.'
      );
      return;
    }

    if (mode !== 'forgot' && !password) {
      setErrorMsg(
        lang === 'bn'
          ? 'অনুগ্রহ করে আপনার পাসওয়ার্ড লিখুন।'
          : 'Please enter your password.'
      );
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email.trim(), password);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(friendlyError(res.error || 'Login failed'));
        }
      } else if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMsg(
            lang === 'bn'
              ? 'অনুগ্রহ করে আপনার পুরো নাম লিখুন।'
              : 'Please enter your full name.'
          );
          setIsLoading(false);
          return;
        }
        const res = await signup({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          role: selectedRole,
          district,
          upazila,
        });
        if (res.success) {
          setSuccessMsg(
            lang === 'bn'
              ? 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!'
              : 'Account created successfully!'
          );
          setTimeout(() => onClose(), 800);
        } else {
          setErrorMsg(friendlyError(res.error || 'Sign up failed'));
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(email.trim());
        if (res.success) {
          setSuccessMsg(
            lang === 'bn'
              ? res.message || 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।'
              : res.message || 'Password reset link sent to your email.'
          );
        } else {
          setErrorMsg(friendlyError(res.error || 'Failed to send reset link'));
        }
      }
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(friendlyError(res.error || 'Google login failed'));
      }
    } catch (err) {
      setErrorMsg(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Authenticated User Profile Modal View (Takes 100% priority when currentUser !== null)
  if (currentUser) {
    const roleLabel =
      currentUser.role === 'admin'
        ? (lang === 'bn' ? 'সুপারভাইজর অ্যাডমিন' : 'Supervisor Admin')
        : currentUser.role === 'amin'
        ? (lang === 'bn' ? 'পেশাদার আমিন' : 'Professional Amin')
        : (lang === 'bn' ? 'জমির মালিক' : 'Landowner');

    const profileModalContent = (
      <div
        id="auth-modal-overlay"
        className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-profile-modal-title"
      >
        <div
          id="auth-profile-modal-dialog"
          className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden relative my-auto flex flex-col max-h-[92vh] animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Ribbon */}
          <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white p-4 sm:p-5 relative shrink-0">
            <button
              id="close-auth-profile-modal-btn"
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="absolute top-3.5 right-3.5 p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition focus:outline-hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold shadow-md shrink-0">
                <Shield className="w-5 h-5 text-slate-900" />
              </div>
              <div className="min-w-0">
                <h3 id="auth-profile-modal-title" className="text-base sm:text-lg font-bold text-white truncate">
                  {lang === 'bn' ? 'ব্যবহারকারী প্রোফাইল ও অ্যাকাউন্ট' : 'User Profile & Account'}
                </h3>
                <p className="text-[11px] text-emerald-200 truncate">
                  {lang === 'bn'
                    ? 'ভূমি ও আমিন — নির্ভরযোগ্য ডিজিটাল জরিপ প্ল্যাটফর্ম'
                    : 'Bhumi O Amin — Trusted Land Survey Platform'}
                </p>
              </div>
            </div>

            {/* Cloud Status Badge */}
            <div className="mt-3 flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px]">
              {isCloudActive ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="text-emerald-100 truncate">
                    {lang === 'bn' ? 'ফায়ারবেস ক্লাউড কানেকশন সচল' : 'Firebase Cloud Auth Active'}
                  </span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-amber-200 truncate">
                    {lang === 'bn'
                      ? 'ক্লাউড সংযোগ নেই • নিরাপদ স্থানীয় ডেটা মোড'
                      : 'Local Offline Mode • Zero Data Loss'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Profile Card Body */}
          <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-slate-900">
              <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{currentUser.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950 uppercase tracking-wider">
                    {roleLabel}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] truncate mt-0.5">{currentUser.email}</p>
                <p className="text-emerald-700 font-medium text-[10px] mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{lang === 'bn' ? 'সফলভাবে লগইন রয়েছে' : 'Successfully authenticated'}</span>
                </p>
              </div>
            </div>

            {/* Profile Info Details */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-700">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60 text-[11px]">
                <span className="text-slate-500">{lang === 'bn' ? 'ভূমিকা (Role):' : 'Role:'}</span>
                <span className="font-bold text-slate-900">{roleLabel}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60 text-[11px]">
                <span className="text-slate-500">{lang === 'bn' ? 'ইমেইল:' : 'Email:'}</span>
                <span className="font-medium text-slate-900 truncate max-w-[200px]">{currentUser.email}</span>
              </div>
              {currentUser.phone && (
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60 text-[11px]">
                  <span className="text-slate-500">{lang === 'bn' ? 'মোবাইল:' : 'Phone:'}</span>
                  <span className="font-medium text-slate-900">{currentUser.phone}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1 text-[11px]">
                <span className="text-slate-500">{lang === 'bn' ? 'অ্যাকাউন্ট স্ট্যাটাস:' : 'Account Status:'}</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {lang === 'bn' ? 'সক্রিয় (Active)' : 'Active'}
                </span>
              </div>
            </div>

            {/* Actions: Sign Out and Close */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                id="modal-logout-btn"
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>{lang === 'bn' ? 'লগআউট করুন' : 'Sign Out'}</span>
              </button>
              <button
                type="button"
                id="modal-close-logged-in-btn"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition active:scale-95"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    if (typeof document !== 'undefined') {
      return createPortal(profileModalContent, document.body);
    }
    return profileModalContent;
  }

  // 2. Unauthenticated User Login/Register Modal
  const modalContent = (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        id="auth-modal-dialog"
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden relative my-auto flex flex-col max-h-[92vh] animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon (Deep Emerald Theme) */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white p-4 sm:p-5 relative shrink-0">
          <button
            id="close-auth-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3.5 right-3.5 p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition focus:outline-hidden"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold shadow-md shrink-0">
              <Shield className="w-5 h-5 text-slate-900" />
            </div>
            <div className="min-w-0">
              <h3 id="auth-modal-title" className="text-base sm:text-lg font-bold text-white truncate">
                {mode === 'login'
                  ? (lang === 'bn' ? 'লগইন করুন' : 'Log In')
                  : mode === 'signup'
                  ? (lang === 'bn' ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'Create an Account')
                  : (lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?')}
              </h3>
              <p className="text-[11px] text-emerald-200 truncate">
                {lang === 'bn'
                  ? 'ভূমি ও আমিন — নির্ভরযোগ্য ডিজিটাল জরিপ প্ল্যাটফর্ম'
                  : 'Bhumi O Amin — Trusted Land Survey Platform'}
              </p>
            </div>
          </div>

          {/* Cloud vs Local Mode Status Badge */}
          <div className="mt-3 flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px]">
            {isCloudActive ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="text-emerald-100 truncate">
                  {lang === 'bn' ? 'ফায়ারবেস ক্লাউড কানেকশন সচল' : 'Firebase Cloud Auth Active'}
                </span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-amber-200 truncate">
                  {lang === 'bn'
                    ? 'ক্লাউড সংযোগ নেই • নিরাপদ স্থানীয় ডেটা মোড'
                    : 'Local Offline Mode • Zero Data Loss'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Success Notification */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <p className="font-semibold text-xs">{successMsg}</p>
            </div>
          )}

          {/* Error Notification */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-xs leading-relaxed">{errorMsg}</p>
                {!isCloudActive && (
                  <p className="text-[10px] text-red-600 mt-1">
                    {lang === 'bn' ? cloudStatusMessageBn : cloudStatusMessageEn}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Signup extra fields */}
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'আপনার পুরো নাম *' : 'Full Name *'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      id="signup-name-input"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: মো: আবুল কাশেম' : 'e.g. Abul Kashem'}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50/50 text-xs text-slate-900"
                    />
                  </div>
                </div>

                {/* Role selection */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'অ্যাকাউন্টের ধরণ (ভূমিকা) *' : 'Account Role *'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="role-customer-btn"
                      onClick={() => setSelectedRole('customer')}
                      className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                        selectedRole === 'customer'
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 font-bold shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <User className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <p className="text-xs">{lang === 'bn' ? 'জমির মালিক' : 'Landowner'}</p>
                        <p className="text-[10px] text-slate-500 font-normal">
                          {lang === 'bn' ? 'গ্রাহক হিসেবে সেবা নিতে' : 'Book Survey Services'}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      id="role-amin-btn"
                      onClick={() => setSelectedRole('amin')}
                      className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                        selectedRole === 'amin'
                          ? 'border-amber-600 bg-amber-50/80 text-amber-900 font-bold shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <p className="text-xs">{lang === 'bn' ? 'পেশাদার আমিন' : 'Surveyor / Amin'}</p>
                        <p className="text-[10px] text-slate-500 font-normal">
                          {lang === 'bn' ? 'মাঠে কাজ ও রিপোর্ট করতে' : 'Provide Survey Services'}
                        </p>
                      </div>
                    </button>
                  </div>
                  {selectedRole === 'amin' && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      {lang === 'bn'
                        ? '★ আমিনের অ্যাকাউন্ট তৈরির পর অ্যাডমিন যাচাইকরণ সাপেক্ষে চূড়ান্ত কাজ অনুমোদন পাবে।'
                        : '★ Surveyor profiles require Admin verification before taking field assignments.'}
                    </p>
                  )}
                </div>

                {/* Phone number */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      id="signup-phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50/50 text-xs text-slate-900"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {lang === 'bn' ? 'জেলা' : 'District'}
                    </label>
                    <input
                      id="signup-district-input"
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50/50 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {lang === 'bn' ? 'উপজেলা' : 'Upazila'}
                    </label>
                    <input
                      id="signup-upazila-input"
                      type="text"
                      value={upazila}
                      onChange={(e) => setUpazila(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50/50 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {lang === 'bn' ? 'ইমেইল এড্রেস *' : 'Email Address *'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50/50 text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Password Field (not shown for forgot password) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    {lang === 'bn' ? 'পাসওয়ার্ড *' : 'Password *'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      id="forgot-password-link-btn"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-emerald-700 hover:text-emerald-900 hover:underline text-[11px] font-medium"
                    >
                      {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="auth-password-input"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50/50 text-xs text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons: Close/Back & Submit */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                id="auth-cancel-btn"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition active:scale-95 text-center flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
              </button>
              <button
                id="auth-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>{lang === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Authenticating...'}</span>
                  </span>
                ) : (
                  <>
                    <span>
                      {mode === 'login' && (lang === 'bn' ? 'লগইন করুন' : 'Log In')}
                      {mode === 'signup' && (lang === 'bn' ? 'রেজিস্ট্রেশন করুন' : 'Complete Sign Up')}
                      {mode === 'forgot' && (lang === 'bn' ? 'রিসেট লিংক পাঠান' : 'Send Reset Link')}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Mode: Forgot Password Back Link */}
          {mode === 'forgot' && (
            <div className="text-center pt-1">
              <button
                type="button"
                id="back-to-login-from-forgot-btn"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-emerald-800 hover:underline text-xs font-semibold"
              >
                {lang === 'bn' ? '← লগইন স্ক্রিনে ফিরে যান' : '← Back to Login'}
              </button>
            </div>
          )}

          {/* Alternative Google Sign In (if cloud active) */}
          {isCloudActive && mode !== 'forgot' && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                id="google-signin-btn"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2.5 transition active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{lang === 'bn' ? 'গুগল দিয়ে প্রবেশ করুন' : 'Sign in with Google'}</span>
              </button>
            </div>
          )}

          {/* Mode Switchers */}
          {mode !== 'forgot' && (
            <div className="text-center pt-2 text-slate-500">
              {mode === 'login' ? (
                <p>
                  {lang === 'bn' ? 'কোনো অ্যাকাউন্ট নেই?' : "Don't have an account?"}{' '}
                  <button
                    type="button"
                    id="switch-to-signup-btn"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                    }}
                    className="font-bold text-emerald-800 hover:underline"
                  >
                    {lang === 'bn' ? 'নতুন অ্যাকাউন্ট খুলুন' : 'Sign up now'}
                  </button>
                </p>
              ) : (
                <p>
                  {lang === 'bn' ? 'ইতোমধ্যে অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    id="switch-to-login-btn"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className="font-bold text-emerald-800 hover:underline"
                  >
                    {lang === 'bn' ? 'লগইন করুন' : 'Log in here'}
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Security Notice */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-600" />
              <span>
                {lang === 'bn' ? 'নিরাপত্তা ও অথেনটিকেশন নোট:' : 'Security & Authentication Note:'}
              </span>
            </p>
            <p>
              {lang === 'bn'
                ? 'প্রকৃত ডাটা নিরাপত্তা ও অ্যাক্সেস কন্ট্রোল ফায়ারবেস অথেনটিকেশন, ফায়ারস্টোর সিকিউরিটি রুলস এবং সার্ভার-সাইড যাচাইকরণের মাধ্যমে পরিচালিত হয়।'
                : 'Account security and role access are safeguarded through Firebase Authentication and Firestore security rules.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
