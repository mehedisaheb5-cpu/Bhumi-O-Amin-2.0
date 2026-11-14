import React, { useState } from 'react';
import {
  User,
  Compass,
  FileText,
  Globe,
  Settings,
  HelpCircle,
  Info,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Cloud,
  CloudOff,
  LogOut,
  LogIn,
  UploadCloud,
  Shield,
  Briefcase,
  AlertCircle,
  Clock,
  RotateCw,
} from 'lucide-react';
import { Language, SurveyRecord, UserRole } from '../types';
import { translations } from '../data/translations';
import { formatNumberByLang } from '../utils/calculator';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './auth/AuthModal';

interface ProfileScreenProps {
  lang: Language;
  onToggleLang: () => void;
  surveys: SurveyRecord[];
  onSelectSurvey: (survey: SurveyRecord) => void;
  onOpenReport?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  lang,
  onToggleLang,
  surveys,
  onSelectSurvey,
  onOpenReport,
}) => {
  const t = translations[lang].profile;
  const {
    currentUser,
    role,
    isCloudActive,
    cloudStatusMessageBn,
    cloudStatusMessageEn,
    logout,
    saveLocalToCloud,
    demoSwitchRole,
  } = useAuth();

  const [activeModal, setActiveModal] = useState<
    'surveys' | 'reports' | 'settings' | 'help' | 'about' | null
  >(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const [defaultUnit, setDefaultUnit] = useState<'feet' | 'meter' | 'link'>('feet');

  const handleCloudSync = async () => {
    setIsSyncingCloud(true);
    setSyncFeedback(null);
    try {
      const stats = await saveLocalToCloud();
      setSyncFeedback(lang === 'bn' ? stats.messageBn : stats.messageEn);
    } catch {
      setSyncFeedback(
        lang === 'bn'
          ? 'ক্লাউডে সংরক্ষণ করা যায়নি। তবে আপনার পুরোনো ডিভাইসের স্থানীয় ডেটা এখনও এই ডিভাইসে সম্পূর্ণ নিরাপদ ও সংরক্ষিত আছে।'
          : 'Could not sync to cloud. Legacy local data remains safely stored on this device.'
      );
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div id="profile-screen" className="space-y-4 pb-8 animate-fadeIn">
      {/* Title & Auth State Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
        </div>
        {currentUser ? (
          <button
            id="profile-logout-btn"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'লগআউট করুন' : 'Logout'}</span>
          </button>
        ) : (
          <button
            id="profile-login-trigger-btn"
            onClick={() => {
              setAuthInitialMode('login');
              setIsAuthModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 text-white hover:bg-emerald-700 text-xs font-semibold shadow-xs transition"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'লগইন করুন' : 'Log In'}</span>
          </button>
        )}
      </div>

      {/* User Profile Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-800 to-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl shadow-inner border border-amber-400/30 shrink-0">
            {role === 'admin' ? (
              <ShieldCheck className="w-7 h-7 text-amber-400" />
            ) : role === 'amin' ? (
              <Briefcase className="w-7 h-7 text-amber-400" />
            ) : (
              <User className="w-7 h-7 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {currentUser ? currentUser.name : (lang === 'bn' ? 'অতিথি ব্যবহারকারী' : 'Guest Landowner')}
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${
                  role === 'admin'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : role === 'amin'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {role === 'admin'
                  ? (lang === 'bn' ? 'সুপারভাইজর অ্যাডমিন' : 'Admin')
                  : role === 'amin'
                  ? (lang === 'bn' ? 'পেশাদার আমিন' : 'Surveyor / Amin')
                  : (lang === 'bn' ? 'জমির মালিক' : 'Landowner')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentUser ? currentUser.email : (lang === 'bn' ? 'লগইন করা নেই' : 'Not signed in')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {currentUser?.phone ? `মোবাইল: ${currentUser.phone} • ` : ''}
              {currentUser?.district ? `জেলা: ${currentUser.district}, ${currentUser.upazila || ''}` : 'বাংলাদেশ'}
            </p>
          </div>
        </div>

        {!currentUser && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAuthInitialMode('signup');
                setIsAuthModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-700 transition"
            >
              {lang === 'bn' ? 'নতুন একাউন্ট খুলুন' : 'Sign Up'}
            </button>
          </div>
        )}
      </div>

      {/* Cloud & Local Storage Status Banner */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isCloudActive ? (
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <Cloud className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <CloudOff className="w-4 h-4" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-slate-900">
                {isCloudActive
                  ? (lang === 'bn' ? 'ক্লাউড ডাটাবেজ স্ট্যাটাস: সচল' : 'Cloud Database Status: Active')
                  : (lang === 'bn' ? 'ক্লাউড সংযোগ: অফলাইন / লোকাল মোড' : 'Cloud Connection: Local Offline Mode')}
              </p>
              <p className="text-[11px] text-slate-500">
                {lang === 'bn' ? cloudStatusMessageBn : cloudStatusMessageEn}
              </p>
            </div>
          </div>

          {/* Save to Cloud Button */}
          <button
            id="sync-to-cloud-btn"
            onClick={handleCloudSync}
            disabled={isSyncingCloud}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 font-bold text-xs transition active:scale-95 disabled:opacity-50"
          >
            {isSyncingCloud ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{lang === 'bn' ? 'ক্লাউডে সংরক্ষণ করুন' : 'Save to Cloud'}</span>
          </button>
        </div>

        {/* Sync Feedback Message */}
        {syncFeedback && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <p>{syncFeedback}</p>
          </div>
        )}

        {/* Local Storage Guarantee Disclaimer */}
        <p className="text-[11px] text-slate-500 italic">
          {lang === 'bn'
            ? '📌 আপনার পুরোনো ডিভাইসের স্থানীয় ডেটা এখনও এই ডিভাইসে সংরক্ষিত আছে এবং অফলাইনেও নিরাপদে ব্যবহার করা যাবে।'
            : '📌 Your legacy device local data remains safely stored on this device and can be used offline.'}
        </p>
      </div>

      {/* Prototype Verification Role Switcher (Separated from real Auth per Req 5) */}
      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-amber-900 font-bold">
            <Shield className="w-4 h-4 text-amber-700" />
            <span>
              {lang === 'bn'
                ? 'প্রোটোটাইপ রোল সিমুলেটর (Role Simulator)'
                : 'Prototype Role Simulator (Testing Tool)'}
            </span>
          </div>
          <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md font-semibold">
            {isCloudActive && currentUser && currentUser.role !== 'admin'
              ? (lang === 'bn' ? 'লকড একাউন্ট' : 'Role Locked')
              : (lang === 'bn' ? 'অফলাইন টুল' : 'Test Mode')}
          </span>
        </div>

        {isCloudActive && currentUser && currentUser.role !== 'admin' ? (
          <p className="text-[11px] text-amber-800 font-medium">
            {lang === 'bn'
              ? `🔒 আপনার অ্যাকাউন্টটি '${role === 'amin' ? 'আমিন' : 'গ্রাহক'}' হিসেবে যাচাইকৃত। উৎপাদন নিরাপত্তা সুরক্ষার স্বার্থে সক্রিয় অ্যাকাউন্টের ভূমিকা পরিবর্তন সীমাবদ্ধ।`
              : `🔒 Your account is signed in as '${role}'. In accordance with Phase 9 security protocols, role escalation is locked for active accounts.`}
          </p>
        ) : (
          <p className="text-[11px] text-amber-800">
            {lang === 'bn'
              ? 'সরাসরি বিভিন্ন রোলের ইন্টারফেস (Customer, Amin, Admin) পরীক্ষা করতে নিচের যেকোনো রোলে সুইচ করুন:'
              : 'To test different role workflows instantly, switch between roles below:'}
          </p>
        )}

        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            onClick={() => demoSwitchRole('customer')}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
              role === 'customer'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {lang === 'bn' ? 'গ্রাহক (Customer)' : 'Customer'}
          </button>
          <button
            onClick={() => demoSwitchRole('amin')}
            disabled={isCloudActive && !!currentUser && currentUser.role === 'customer'}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
              role === 'amin'
                ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                : isCloudActive && !!currentUser && currentUser.role === 'customer'
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {lang === 'bn' ? 'আমিন (Amin)' : 'Amin / Surveyor'}
          </button>
          <button
            onClick={() => demoSwitchRole('admin')}
            disabled={isCloudActive && !!currentUser && currentUser.role !== 'admin' && currentUser.email?.toLowerCase() !== 'mehedifeni33@gmail.com'}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
              role === 'admin'
                ? 'bg-purple-800 text-white border-purple-900 shadow-xs'
                : isCloudActive && !!currentUser && currentUser.role !== 'admin' && currentUser.email?.toLowerCase() !== 'mehedifeni33@gmail.com'
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {lang === 'bn' ? 'অ্যাডমিন (Admin)' : 'Admin'}
          </button>
        </div>
      </div>

      {/* Menu List of Required Profile Sections */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden text-xs">
        {/* 1. Language Toggle */}
        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-800">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{t.appLanguage}</p>
              <p className="text-[11px] text-slate-500">
                {lang === 'bn' ? 'বর্তমান ভাষা: বাংলা' : 'Current: English'}
              </p>
            </div>
          </div>
          <button
            id="profile-lang-switch"
            onClick={onToggleLang}
            className="px-3 py-1.5 rounded-xl bg-emerald-900 text-white font-bold text-xs hover:bg-emerald-800 transition active:scale-95"
          >
            {lang === 'bn' ? 'English এ যান' : 'Switch to বাংলা'}
          </button>
        </div>

        {/* 2. My Surveys */}
        <button
          id="profile-my-surveys-btn"
          onClick={() => setActiveModal('surveys')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{t.mySurveys}</p>
              <p className="text-[11px] text-slate-500">
                {formatNumberByLang(surveys.length, lang)} {lang === 'bn' ? 'টি সার্ভে সংরক্ষিত' : 'surveys saved'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* 3. My Reports */}
        <button
          id="profile-my-reports-btn"
          onClick={() => {
            if (onOpenReport) {
              onOpenReport();
            } else {
              setActiveModal('reports');
            }
          }}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-800">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{t.myReports}</p>
              <p className="text-[11px] text-slate-500">
                {lang === 'bn' ? 'সার্ভে রিপোর্ট ও এ৪ সাইজ PDF ডাউনলোড' : 'Survey Reports & A4 PDF Download'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* 4. Settings */}
        <button
          id="profile-settings-btn"
          onClick={() => setActiveModal('settings')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{t.settings}</p>
              <p className="text-[11px] text-slate-500">
                {t.defaultUnit}: {defaultUnit === 'feet' ? 'ফুট (Feet)' : defaultUnit === 'meter' ? 'মিটার' : 'লিংক'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* 5. Help & FAQ */}
        <button
          id="profile-help-btn"
          onClick={() => setActiveModal('help')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{t.helpAndFaq}</p>
              <p className="text-[11px] text-slate-500">
                {lang === 'bn' ? 'ব্যবহারবিধি, জমি জরিপ নির্দেশিকা' : 'User guide & FAQs'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* 6. About */}
        <button
          id="profile-about-btn"
          onClick={() => setActiveModal('about')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-800">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{t.aboutApp}</p>
              <p className="text-[11px] text-slate-500">{t.version}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Security Architecture & Disclaimer (Requirement 21) */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200/90 text-[11px] text-slate-600 space-y-1.5">
        <div className="flex items-center gap-1.5 text-slate-800 font-bold">
          <Shield className="w-4 h-4 text-slate-700" />
          <span>{lang === 'bn' ? 'সিকিউরিটি আর্কিটেকচার নীতিমালা' : 'Security Architecture Policy'}</span>
        </div>
        <p className="leading-relaxed">
          {lang === 'bn'
            ? '“LocalStorage is not a secure authentication or authorization mechanism.” ব্রাউজারের লোকাল স্টোরেজ মূলত অফলাইন গতি এবং ক্ষণস্থায়ী ক্যাশিংয়ের জন্য ব্যবহৃত হয়। প্রকৃত ডাটা আইসোলেশন ও রোল নিয়ন্ত্রণ ফায়ারবেস অথেন্টিকেশন, ক্লাউড ফায়ারস্টোর সিকিউরিটি রুলস এবং সার্ভার অথোরাইজেশনের মাধ্যমে সুরক্ষিত থাকে।'
            : '“LocalStorage is not a secure authentication or authorization mechanism.” Real security is derived from Firebase Authentication, Firestore Security Rules, and server-side authorization.'}
        </p>
      </div>

      {/* Development Roadmap Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950 text-white border border-emerald-800/40 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-amber-300">
          <Sparkles className="w-4 h-4" />
          <h4 className="text-xs font-bold uppercase tracking-wider">
            {t.roadmapTitle}
          </h4>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed">
          {t.roadmapDesc}
        </p>
        <div className="pt-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-emerald-800/80 text-emerald-200 border border-emerald-700">
            Phase 1-6: কোর সার্ভে, জিপিএস ও রিপোর্ট (সম্পন্ন)
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-800/80 text-emerald-200 border border-emerald-700">
            Phase 7: আমিন মার্কেটপ্লেস ও বুকিং (সম্পন্ন)
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400/40 font-bold">
            Phase 8: অথেনটিকেশন ও ক্লাউড ফাউন্ডেশন (সচল)
          </span>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        lang={lang}
        initialMode={authInitialMode}
      />

      {/* Modals for profile sections */}

      {/* Modal: My Surveys */}
      {activeModal === 'surveys' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-emerald-100 text-slate-900">
            <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              {t.mySurveys}
            </h3>
            <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {surveys.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelectSurvey(s);
                    setActiveModal(null);
                  }}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/90 transition cursor-pointer text-xs"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{s.title}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                      {formatNumberByLang((s.areaSqFt / 435.6).toFixed(1), lang)} শতাংশ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    মৌজা: {s.mouza} | দাগ: {s.dagNo} | তারিখ: {s.date}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="mt-4 w-full py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: My Reports */}
      {activeModal === 'reports' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-purple-100 text-slate-900">
            <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              {t.myReports}
            </h3>
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <p className="font-semibold text-slate-800">
                {lang === 'bn' ? 'প্রাথমিক রিপোর্ট ড্যাশবোর্ড' : 'Preliminary Reports'}
              </p>
              <p>
                {lang === 'bn'
                  ? 'আপনার সকল সম্পন্ন সার্ভের সারাংশ ও হিসাব ফলাফল এখানে প্রস্তুত রয়েছে। ফেজ ১০ এ প্রাতিষ্ঠানিক পিডিএফ (PDF) ডাউনলোড অপশন সরাসরি যুক্ত হবে।'
                  : 'Survey records are saved locally. Official downloadable PDF survey certificates are slated for Phase 10.'}
              </p>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="mt-4 w-full py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Settings */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-900">
            <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              {t.settings}
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {t.defaultUnit}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['feet', 'meter', 'link'] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setDefaultUnit(u)}
                      className={`py-2 rounded-xl border text-xs font-bold transition ${
                        defaultUnit === u
                          ? 'bg-emerald-900 text-white border-emerald-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {u === 'feet' ? 'ফুট' : u === 'meter' ? 'মিটার' : 'লিংক'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="mt-5 w-full py-2 rounded-xl bg-emerald-900 text-white text-xs font-bold hover:bg-emerald-800"
            >
              {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Help & FAQ */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-amber-200 text-slate-900 max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              {t.helpAndFaq}
            </h3>
            <div className="mt-3 space-y-3 text-xs text-slate-600">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  {lang === 'bn' ? '১. শতাংশ ও কাঠার মধ্যে সম্পর্ক কী?' : '1. Decimal vs Katha?'}
                </h4>
                <p>
                  {lang === 'bn'
                    ? '১ শতাংশ = ৪৩৫.৬ বর্গফুট। ১ কাঠা = ৭২০ বর্গফুট। অর্থাৎ প্রায় ১.৬৫ শতাংশে ১ কাঠা হয়।'
                    : '1 Decimal = 435.6 sq ft. 1 Katha = 720 sq ft. Approximately 1.65 Decimals equal 1 Katha.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  {lang === 'bn' ? '২. মোবাইল জিপিএস কতটুকু নির্ভুল?' : '2. How accurate is phone GPS?'}
                </h4>
                <p>
                  {lang === 'bn'
                    ? 'সাধারণ স্মার্টফোনের জিপিএস সাধারণত ৩-৫ মিটার তারতম্য করতে পারে। তাই এটি প্রাথমিক ধারণার জন্য প্রযোজ্য। আইনি সীমানার জন্য সর্বদা ফিতা/শিকল ও আমিনের সরেজমিন মাপ নিন।'
                    : 'Consumer phone GPS has ~3-5m accuracy. It is designed for preliminary estimation, not legal boundary defense.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  {lang === 'bn' ? '৩. কীভাবে আমিন সেবা পেতে পারি?' : '3. How to get Amin service?'}
                </h4>
                <p>
                  {lang === 'bn'
                    ? 'আমাদের সেবা ট্যাব থেকে "অনুরোধ জমা দিন" চাপুন। আপনার বিস্তারিত জানালে সংশ্লিষ্ট উপজেলার অভিজ্ঞ আমিন আপনার সাথে যোগাযোগ করবেন।'
                    : 'Submit an inquiry from the Services tab to receive dedicated surveyor coordination.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="mt-4 w-full py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: About */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-teal-200 text-slate-900">
            <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              {t.aboutApp}
            </h3>
            <div className="mt-3 text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <p>
                <strong className="text-emerald-950 text-sm">ভূমি ও আমিন</strong> — “জমি বুঝুন, ঝুঁকি কমান।”
              </p>
              <p>
                {lang === 'bn'
                  ? 'এটি বাংলাদেশের গ্রামীণ ও শহুরে জমির মালিক, ক্রেতা, বিক্রেতা ও আমিনদের জন্য একটি সমন্বিত আধুনিক ডিজিটাল প্ল্যাটফর্ম। ভূমি মন্ত্রণালয় ও ভূমি জরিপের প্রমিত সূত্র অনুযায়ী জমি পরিমাপ এবং খতিয়ান সহায়তার জন্য এই প্ল্যাটফর্ম ডিজাইন করা হয়েছে।'
                  : 'A purpose-built digital land surveying and land service Progressive Web App for Bangladesh, empowering landowners with transparency and accurate calculations.'}
              </p>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                {lang === 'bn'
                  ? 'বর্তমান রিলিজ: ফেজ ১ (মৌলিক ও পেশাদার ফ্রন্টএন্ড ভিত্তি, অফলাইন সাপোর্ট, ও পিডব্লিউএ সুবিধা)।'
                  : 'Current Release: Phase 1 (Core Professional Frontend Foundation, Offline PWA).'}
              </div>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="mt-4 w-full py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
