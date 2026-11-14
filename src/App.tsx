/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Language, NavTab, SurveyRecord } from './types';
import { initialSurveys } from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { HomeScreen } from './components/HomeScreen';
import { LandMeasureSelectionScreen } from './components/measurement/LandMeasureSelectionScreen';
import { StandardLandMeasurement } from './components/measurement/StandardLandMeasurement';
import { SurveyScreen } from './components/SurveyScreen';
import { MapsAndDrawingsScreen, MapWorkspaceTab } from './components/maps/MapsAndDrawingsScreen';
import { LandCalculatorScreen } from './components/LandCalculatorScreen';
import { SurveyReportScreen } from './components/report/SurveyReportScreen';
import { MouzaRateScreen } from './components/rates/MouzaRateScreen';
import { AminServicesScreen } from './components/AminServicesScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ChatModal } from './components/ChatModal';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { InstallPrompt } from './components/common/InstallPrompt';
import { enqueue, syncQueue } from './lib/offlineQueue';
import {
  isFirebaseConfigured,
  db,
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  cleanForFirestore,
} from './lib/firebase';

// P1 Mobile: 5 tabs — home | possession (দখল) | maps (মৌজা ম্যাপ) | reports | profile (এডমিন)
export type AppScreenId =
  | 'home'
  | 'measure_root'
  | 'measure_practical'
  | 'measure_standard'
  | 'measure_possession'
  | 'possession'
  | 'maps_and_drawings'
  | 'khatian'
  | 'inheritance'
  | 'dalil'
  | 'reports'
  | 'mouza_rates'
  | 'services'
  | 'profile';

export interface AppScreenState {
  screenId: AppScreenId;
  surveyId?: string | null;
  bookingId?: string | null;
  reportId?: string | null;
  mouzaMapId?: string | null;
  mapsTab?: MapWorkspaceTab;
  khatianSubTab?: 'khatian' | 'hissha' | 'ana_gonda' | 'tafsil' | 'inheritance';
}

export default function App() {
  const { currentUser } = useAuth();
  // Bengali is the default language as requested
  const [lang, setLang] = useState<Language>('bn');

  // Active Screen State
  const [currentScreen, setCurrentScreen] = useState<AppScreenState>(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#measure' || hash === '#measurement') return { screenId: 'measure_root' };
    if (hash === '#maps' || hash === '#drawing') return { screenId: 'maps_and_drawings' };
    if (hash === '#khatian' || hash === '#calc') return { screenId: 'khatian' };
    if (hash === '#reports' || hash === '#report') return { screenId: 'reports' };
    if (hash === '#rate' || hash === '#rates' || hash === '#mouza-rate') return { screenId: 'mouza_rates' };
    if (hash === '#services' || hash === '#booking') return { screenId: 'services' };
    if (hash === '#profile') return { screenId: 'profile' };
    return { screenId: 'home' };
  });

  // Modal State
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const isNavigatingRef = useRef<boolean>(false);

  // Local state for surveys with localStorage persistence
  const [surveys, setSurveys] = useState<SurveyRecord[]>(() => {
    const saved = localStorage.getItem('bhumi_surveys');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved surveys', e);
      }
    }
    return initialSurveys;
  });

  useEffect(() => {
    localStorage.setItem('bhumi_surveys', JSON.stringify(surveys));
  }, [surveys]);

  // Realtime Cloud Listener for SurveyRecords (Multi-device synchronization)
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !currentUser?.id) return;

    let q;
    if (currentUser.role === 'admin') {
      q = query(collection(db, 'surveyRecords'));
    } else if (currentUser.role === 'amin') {
      q = query(
        collection(db, 'surveyRecords'),
        where('ownerId', '==', currentUser.id)
      );
    } else {
      q = query(
        collection(db, 'surveyRecords'),
        where('ownerId', '==', currentUser.id)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudSurveys: SurveyRecord[] = [];
          snapshot.forEach((d) => {
            cloudSurveys.push(d.data() as SurveyRecord);
          });
          setSurveys((prev) => {
            const cloudMap = new Map(cloudSurveys.map((s) => [s.id, s]));
            const merged = prev.map((localS) => {
              if (cloudMap.has(localS.id)) {
                const updated = cloudMap.get(localS.id)!;
                cloudMap.delete(localS.id);
                return updated;
              }
              return localS;
            });
            cloudMap.forEach((newS) => {
              merged.unshift(newS);
            });
            localStorage.setItem('bhumi_surveys', JSON.stringify(merged));
            return merged;
          });
        }
      },
      (err) => {
        console.warn('Firestore surveyRecords onSnapshot notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role]);

  // Language toggle handler
  const handleToggleLang = () => {
    setLang((prev) => (prev === 'bn' ? 'en' : 'bn'));
  };

  // Survey save & synchronization handler — with Offline Queue (ownerId == auth.uid enforced)
  const handleSaveSurvey = async (newSurvey: SurveyRecord) => {
    const bookingId = newSurvey.bookingId || currentScreen.bookingId || undefined;
    const surveyToStore: SurveyRecord = {
      ...newSurvey,
      bookingId,
      ownerId: newSurvey.ownerId || currentUser?.id,
      aminId: currentUser?.role === 'amin' ? currentUser.id : newSurvey.aminId,
      updatedAt: Date.now(),
    };
    setSurveys((prev) => {
      const idx = prev.findIndex((s) => s.id === surveyToStore.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = surveyToStore;
        return next;
      }
      return [surveyToStore, ...prev];
    });

    if (isFirebaseConfigured && db) {
      const payload = cleanForFirestore(surveyToStore);
      // If offline, queue immediately
      if (!navigator.onLine) {
        enqueue({ collection: 'surveyRecords', docId: surveyToStore.id, data: payload, op: 'set' });
        console.log('[offlineQueue] queued (offline)', surveyToStore.id);
        return;
      }
      try {
        await setDoc(doc(db, 'surveyRecords', surveyToStore.id), payload);
        if (bookingId) {
          await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
            linkedSurveyId: surveyToStore.id,
            updatedAt: new Date().toISOString(),
          })).catch((err) => console.warn('Booking linkedSurveyId update note:', err));
        }
      } catch (err) {
        console.warn('Firestore survey sync note — queuing for retry:', err);
        enqueue({ collection: 'surveyRecords', docId: surveyToStore.id, data: payload, op: 'set' });
      }
    }
  };

  // Auto-sync queued ops when coming online or on mount
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    syncQueue().then(r => { if (r.synced) console.log(`[offlineQueue] initial sync ${r.synced}`); });
    const onQueueSynced = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.synced) console.log('[offlineQueue] synced via event', detail);
    };
    window.addEventListener('bhumi:queueSynced' as any, onQueueSynced);
    return () => window.removeEventListener('bhumi:queueSynced' as any, onQueueSynced);
  }, [currentUser?.id]);

  /**
   * CENTRAL NAVIGATION CONTROLLER WITH BROWSER / ANDROID BACK BUTTON SUPPORT
   * Prevents loops, prevents duplicate history entries, preserves states.
   */
  const navigateTo = useCallback(
    (nextScreen: AppScreenState, replace: boolean = false) => {
      if (
        currentScreen.screenId === nextScreen.screenId &&
        currentScreen.surveyId === nextScreen.surveyId &&
        currentScreen.bookingId === nextScreen.bookingId &&
        currentScreen.reportId === nextScreen.reportId &&
        currentScreen.mapsTab === nextScreen.mapsTab &&
        currentScreen.khatianSubTab === nextScreen.khatianSubTab
      ) {
        // Prevent duplicate history entries
        return;
      }

      isNavigatingRef.current = true;
      if (replace) {
        window.history.replaceState({ screen: nextScreen }, '');
      } else {
        window.history.pushState({ screen: nextScreen }, '');
      }
      setCurrentScreen(nextScreen);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
    },
    [currentScreen]
  );

  /**
   * In-App Back Button Handler (acts identically to hardware Back button)
   */
  const goBack = useCallback(() => {
    if (showChatModal) {
      setShowChatModal(false);
      return;
    }

    if (window.history.state && window.history.state.screen) {
      window.history.back();
    } else {
      // Fallback parent hierarchies
      if (currentScreen.screenId === 'measure_standard' || currentScreen.screenId === 'measure_possession') {
        navigateTo({ screenId: 'measure_practical' }, true);
      } else if (currentScreen.screenId === 'measure_practical') {
        navigateTo({ screenId: 'measure_root' }, true);
      } else {
        navigateTo({ screenId: 'home' }, true);
      }
    }
  }, [showChatModal, currentScreen.screenId, navigateTo]);

  /**
   * Browser / Android Popstate Listener
   */
  useEffect(() => {
    // Ensure initial entry has valid history state
    if (!window.history.state || !window.history.state.screen) {
      window.history.replaceState({ screen: currentScreen }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      // If modal is open, close it first without navigating away
      if (showChatModal) {
        setShowChatModal(false);
        return;
      }

      const state = event.state as { screen?: AppScreenState; modal?: string } | null;
      if (state && state.screen) {
        setCurrentScreen(state.screen);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Returned to baseline session
        setCurrentScreen({ screenId: 'home' });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showChatModal, currentScreen]);

  // Open Chat Modal with history guard so Android back button closes it
  const handleOpenChatModal = () => {
    window.history.pushState({ modal: 'chat', screen: currentScreen }, '');
    setShowChatModal(true);
  };

  const handleCloseChatModal = () => {
    setShowChatModal(false);
    if (window.history.state?.modal === 'chat') {
      window.history.back();
    }
  };

  /**
   * Mapping active screen to BottomNav tab highlight
   */
  const activeNavTab: NavTab = (() => {
    switch (currentScreen.screenId) {
      case 'home':
        return 'home';
      case 'measure_root':
      case 'measure_practical':
      case 'measure_standard':
      case 'measure_possession':
      case 'possession':
        return 'possession';
      case 'maps_and_drawings':
        return 'maps';
      case 'khatian':
      case 'inheritance':
        return 'khatian'; // legacy fallback, but bottom now has no khatian — home cards route there
      case 'reports':
        return 'reports';
      case 'mouza_rates':
      case 'dalil':
        return 'mouza_rates'; // Dalil will later become its own, for P1 keep under dalil
      case 'services':
        return 'services';
      case 'profile':
        return 'profile';
      default:
        return 'home';
    }
  })();

  const handleSelectBottomNavTab = (tab: NavTab) => {
    switch (tab) {
      case 'home':
        navigateTo({ screenId: 'home' });
        break;
      case 'possession':
      case 'measure':
        navigateTo({ screenId: 'possession' });
        break;
      case 'maps':
        // Generic Maps navigation opens the three-feature chooser; contextual links can still target a feature.
        navigateTo({ screenId: 'maps_and_drawings' });
        break;
      case 'reports':
        navigateTo({ screenId: 'reports' });
        break;
      case 'profile':
        navigateTo({ screenId: 'profile' });
        break;
      case 'khatian':
        navigateTo({ screenId: 'khatian', khatianSubTab: 'khatian' });
        break;
      case 'mouza_rates':
      case 'dalil':
        navigateTo({ screenId: 'dalil' as any });
        break;
      case 'services':
        navigateTo({ screenId: 'services' });
        break;
      default:
        navigateTo({ screenId: 'home' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans flex flex-col antialiased selection:bg-emerald-200 selection:text-emerald-950">
      {/* Offline Status Badge */}
      <OfflineIndicator lang={lang} />

      {/* Top Application Bar - Light theme, clicking brand navigates to Home */}
      <Header
        lang={lang}
        onToggleLang={handleToggleLang}
        onOpenChat={handleOpenChatModal}
        onHomeClick={() => navigateTo({ screenId: 'home' })}
        onSelectBooking={(_bookingId) => {
          navigateTo({ screenId: 'services' });
        }}
      />

      {/* Main Content View Area */}
      <ErrorBoundary>
      <main
        className={`flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 ${
          currentScreen.screenId === 'survey' ? 'pt-2 pb-2 overflow-hidden' : 'pt-3.5 pb-24'
        }`}
      >
        {/* 1. HOME SCREEN — P1 Mobile: 5 cards (দখল / ম্যাপ 3 / খতিয়ান / উত্তরাধিকার / দলিল) */}
        {currentScreen.screenId === 'home' && (
          <HomeScreen
            lang={lang}
            onSelectMeasure={() => navigateTo({ screenId: 'possession' })}
            onSelectMapsAndDrawings={() =>
              navigateTo({ screenId: 'maps_and_drawings' })
            }
            onSelectKhatian={() =>
              navigateTo({ screenId: 'khatian', khatianSubTab: 'khatian' })
            }
            onSelectReports={() => navigateTo({ screenId: 'reports' })}
            onSelectMouzaRate={() => navigateTo({ screenId: 'dalil' as any })}
            onSelectInheritance={() => navigateTo({ screenId: 'inheritance' as any })}
            onSelectDalil={() => navigateTo({ screenId: 'dalil' as any })}
            onOpenChat={handleOpenChatModal}
          />
        )}

        {/* P1: দখল পরিমাপ — direct possession (4 bahu + percent auto, no mouza) */}
        {currentScreen.screenId === 'possession' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs transition active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'bn' ? 'দখল পরিমাপ' : 'Possession Measurement'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'bn' ? '৪ বাহু বসালেই শতাংশ অটো — মৌজা ম্যাপ ছাড়া সরাসরি জরিপ' : '4 sides → percent auto — direct survey without Mouza map'}
                </p>
              </div>
            </div>
            <SurveyScreen
              lang={lang}
              surveys={surveys}
              bookingId={currentScreen.bookingId}
              initialSurveyId={currentScreen.surveyId}
              onSaveSurvey={handleSaveSurvey}
              onOpenMapDrawing={(sId) =>
                navigateTo({
                  screenId: 'maps_and_drawings',
                  mapsTab: 'cad_drawing',
                  surveyId: sId,
                  bookingId: currentScreen.bookingId,
                })
              }
              onOpenReport={(sId) =>
                navigateTo({
                  screenId: 'reports',
                  surveyId: sId,
                  bookingId: currentScreen.bookingId,
                })
              }
              onOpenMouzaMap={(sId) =>
                navigateTo({
                  screenId: 'maps_and_drawings',
                  mapsTab: 'mouza_dag',
                  surveyId: sId,
                  bookingId: currentScreen.bookingId,
                })
              }
            />
          </div>
        )}

        {/* 2. জমি মাপুন: ROOT SELECTION (১. মৌজা ম্যাপে ডিজিটাল ডিমার্কেশন, ২. প্র্যাক্টিক্যাল পরিমাপ) */}
        {currentScreen.screenId === 'measure_root' && (
          <LandMeasureSelectionScreen
            lang={lang}
            step="root"
            onBack={goBack}
            onSelectDigitalDemarcation={() =>
              navigateTo({ screenId: 'maps_and_drawings', mapsTab: 'mouza_dag' })
            }
            onSelectPracticalMenu={() => navigateTo({ screenId: 'measure_practical' })}
            onSelectStandardMeasure={() => navigateTo({ screenId: 'measure_standard' })}
            onSelectPossessionMeasure={() => navigateTo({ screenId: 'measure_possession' })}
          />
        )}

        {/* 3. জমি মাপুন: PRACTICAL MEASUREMENT SUB-MENU (১. সাধারণ জমি পরিমাপ, ২. দখল পরিমাপ) */}
        {currentScreen.screenId === 'measure_practical' && (
          <LandMeasureSelectionScreen
            lang={lang}
            step="practical"
            onBack={goBack}
            onSelectDigitalDemarcation={() =>
              navigateTo({ screenId: 'maps_and_drawings', mapsTab: 'cad_drawing' })
            }
            onSelectPracticalMenu={() => {}}
            onSelectStandardMeasure={() => navigateTo({ screenId: 'measure_standard' })}
            onSelectPossessionMeasure={() => navigateTo({ screenId: 'measure_possession' })}
          />
        )}

        {/* 4. জমি মাপুন: সাধারণ জমি পরিমাপ (Standard Land Measurement Calculator) */}
        {currentScreen.screenId === 'measure_standard' && (
          <StandardLandMeasurement lang={lang} onBack={goBack} />
        )}

        {/* 5. জমি মাপুন: দখল পরিমাপ (Field GPS Boundary & Possession Demarcation) */}
        {currentScreen.screenId === 'measure_possession' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs transition active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'bn' ? 'দখল পরিমাপ' : 'Possession Measurement'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'বাহু মেপে বা চিত্র এঁকে জমির নকশা ও ক্ষেত্রফল নির্ণয় করুন'
                    : 'Measure sides or draw the plot to get the plan and area'}
                </p>
              </div>
            </div>

            <SurveyScreen
              lang={lang}
              surveys={surveys}
              bookingId={currentScreen.bookingId}
              initialSurveyId={currentScreen.surveyId}
              onSaveSurvey={handleSaveSurvey}
              onOpenMapDrawing={(sId) =>
                navigateTo({
                  screenId: 'maps_and_drawings',
                  mapsTab: 'cad_drawing',
                  surveyId: sId,
                  bookingId: currentScreen.bookingId,
                })
              }
              onOpenReport={(sId) =>
                navigateTo({
                  screenId: 'reports',
                  surveyId: sId,
                  bookingId: currentScreen.bookingId,
                })
              }
              onOpenMouzaMap={(sId) =>
                navigateTo({
                  screenId: 'maps_and_drawings',
                  mapsTab: 'mouza_dag',
                  surveyId: sId,
                  bookingId: currentScreen.bookingId,
                })
              }
            />
          </div>
        )}

        {/* 6. নকশা ও ম্যাপ (Merged Workspace: Mouza Map & Dag, CAD Drawing, AI Sketch) */}
        {currentScreen.screenId === 'maps_and_drawings' && (
          <MapsAndDrawingsScreen
            lang={lang}
            surveys={surveys}
            initialTab={currentScreen.mapsTab}
            initialSurveyId={currentScreen.surveyId}
            initialMouzaMapId={currentScreen.mouzaMapId}
            onSaveSurvey={handleSaveSurvey}
            onNavigateToSurvey={() => navigateTo({ screenId: 'measure_possession' })}
            onOpenReport={(sId) => navigateTo({ screenId: 'reports', surveyId: sId })}
            onBack={goBack}
          />
        )}

        {/* 7. খতিয়ান বিশ্লেষণ (Focused Khatian Analysis + Integrated Amin AI Consultant) */}
        {currentScreen.screenId === 'khatian' && (
          <div className="space-y-3">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
            </button>
            <LandCalculatorScreen
              lang={lang}
              onOpenChat={handleOpenChatModal}
              initialSubTab={currentScreen.khatianSubTab || 'khatian'}
            />
          </div>
        )}

        {/* 7b. উত্তরাধিকার — Hindu / Muslim (P1 placeholder, P4 full) */}
        {(currentScreen.screenId as string) === 'inheritance' && (
          <div className="space-y-3 animate-fadeIn">
            <button onClick={goBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-pink-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition active:scale-95">
              <ArrowLeft className="w-4 h-4" /><span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
            </button>
            <div className="p-6 rounded-2xl bg-white border border-pink-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-200 flex items-center justify-center mx-auto">⚖️</div>
              <h3 className="font-black text-slate-900">{lang==='bn'?'উত্তরাধিকার — P4 এ আসছে':'Inheritance — Coming in P4'}</h3>
              <p className="text-xs text-slate-500">{lang==='bn'?'হিন্দু / মুসলিম — ওয়ারিশ তালিকা + মোট সম্পত্তি → অটো ভাগ':'Hindu / Muslim — heirs + total property → auto share'}</p>
              <div className="text-xs bg-pink-50 border border-pink-200 rounded-xl p-3">🚧 P1 Mobile: কার্ড OK, ক্যালকুলেটর P4 এ — ভিজুয়াল দেখিয়ে তারপর কোড</div>
            </div>
          </div>
        )}

        {/* 7c. দলিল সেবা — P1: Mouza Rate + Coming Soon */}
        {(currentScreen.screenId as string) === 'dalil' && (
          <div className="space-y-3 animate-fadeIn">
            <button onClick={goBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-orange-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition active:scale-95">
              <ArrowLeft className="w-4 h-4" /><span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
            </button>
            <MouzaRateScreen lang={lang} onBack={goBack} />
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-amber-200 text-center"><div className="text-lg">🚧</div><div className="text-xs font-bold text-amber-900">{lang==='bn'?'রেজিস্ট্রেশন ফি':'Registration Fee'}</div><div className="text-[11px] text-amber-700">{lang==='bn'?'শীঘ্রই আসছে':'Coming soon'}</div></div>
              <div className="p-4 rounded-2xl bg-white border border-amber-200 text-center"><div className="text-lg">📋</div><div className="text-xs font-bold text-amber-900">{lang==='bn'?'নকল উত্তোলন':'Certified Copy'}</div><div className="text-[11px] text-amber-700">{lang==='bn'?'শীঘ্রই আসছে':'Coming soon'}</div></div>
            </div>
          </div>
        )}

        {/* 8. সার্ভে রিপোর্ট (A4 PDF Documentation & Reports) */}
        {currentScreen.screenId === 'reports' && (
          <SurveyReportScreen
            surveys={surveys}
            initialSurveyId={currentScreen.surveyId}
            initialReportId={currentScreen.reportId}
            initialBookingId={currentScreen.bookingId}
            lang={lang}
            onBack={goBack}
            onGoToSurvey={() => navigateTo({ screenId: 'possession' })}
          />
        )}

        {/* 9. মৌজা রেট (legacy) */}
        {currentScreen.screenId === 'mouza_rates' && (
          <MouzaRateScreen lang={lang} onBack={goBack} />
        )}

        {/* 10. মার্কেটপ্লেস ও সেবা (Amin Services & Booking) */}
        {currentScreen.screenId === 'services' && (
          <div className="space-y-3">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
            </button>
            <AminServicesScreen
              lang={lang}
              onOpenReport={(sId, rId) =>
                navigateTo({ screenId: 'reports', surveyId: sId, reportId: rId, bookingId: currentScreen.bookingId })
              }
              onOpenSurvey={(sId, bId) =>
                navigateTo({
                  screenId: 'measure_possession',
                  surveyId: sId,
                  bookingId: bId,
                })
              }
              surveys={surveys}
            />
          </div>
        )}

        {/* 11. ইউজার প্রোফাইল ও সেটিংস (User Profile & Account) */}
        {currentScreen.screenId === 'profile' && (
          <div className="space-y-3">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
            </button>
            <ProfileScreen
              lang={lang}
              onToggleLang={handleToggleLang}
              surveys={surveys}
              onSelectSurvey={(_s) => navigateTo({ screenId: 'measure_possession' })}
              onOpenReport={() => navigateTo({ screenId: 'reports' })}
            />
          </div>
        )}
      </main>
      </ErrorBoundary>

      {/* Simplified Bottom Navigation Bar */}
      <BottomNav
        currentTab={activeNavTab}
        onSelectTab={handleSelectBottomNavTab}
        lang={lang}
      />

      {/* PWA Install Prompt */}
      <InstallPrompt lang={lang} />

      {/* Gemini AI Land Consultant Modal */}
      {showChatModal && (
        <ChatModal lang={lang} onClose={handleCloseChatModal} />
      )}
    </div>
  );
}
