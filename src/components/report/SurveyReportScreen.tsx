import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Printer,
  Save,
  Edit3,
  CheckCircle,
  FileText,
  FolderOpen,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  AlertTriangle,
  Compass,
  PlusCircle,
  Download,
  Info,
  Link2,
  Copy,
} from 'lucide-react';
import { SurveyRecord, SurveyReportRecord, Language, ReportStatus } from '../../types';
import {
  getStoredReports,
  saveStoredReports,
  saveReportRecord,
  deleteReportRecord,
  createReportFromSurvey,
  ensureReportMatchesSurvey,
  validateSurveyForReport,
  generateReportNumber,
} from '../../lib/survey-report-utils';
import { ReportDocumentA4 } from './ReportDocumentA4';
import { ReportEditorModal } from './ReportEditorModal';
import { ReportListView } from './ReportListView';
import { formatNumberByLang } from '../../lib/land-units';
import { printWithNoto } from '../../lib/print-utils';
import { useAuth } from '../../contexts/AuthContext';
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
} from '../../lib/firebase';

interface SurveyReportScreenProps {
  surveys: SurveyRecord[];
  initialSurveyId?: string | null;
  initialReportId?: string | null;
  initialBookingId?: string | null;
  lang: Language;
  onBack: () => void;
  onGoToSurvey: () => void;
}

export const SurveyReportScreen: React.FC<SurveyReportScreenProps> = ({
  surveys,
  initialSurveyId,
  initialReportId,
  initialBookingId,
  lang,
  onBack,
  onGoToSurvey,
}) => {
  const { currentUser } = useAuth();
  const isBn = lang === 'bn';

  // Saved reports list in state
  const [savedReports, setSavedReports] = useState<SurveyReportRecord[]>(() => getStoredReports());

  // Realtime Cloud Listener for Survey Reports (Multi-device synchronization)
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !currentUser?.id) return;

    let q;
    if (currentUser.role === 'admin') {
      q = query(collection(db, 'reports'));
    } else {
      q = query(
        collection(db, 'reports'),
        where('ownerId', '==', currentUser.id)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudReports: SurveyReportRecord[] = [];
          snapshot.forEach((d) => {
            cloudReports.push(d.data() as SurveyReportRecord);
          });
          setSavedReports((prev) => {
            const map = new Map(cloudReports.map((r) => [r.id, r]));
            const merged = prev.map((localR) => {
              if (map.has(localR.id)) {
                const updated = map.get(localR.id)!;
                map.delete(localR.id);
                return updated;
              }
              return localR;
            });
            map.forEach((newR) => merged.unshift(newR));
            saveStoredReports(merged);
            return merged;
          });
        }
      },
      (err) => console.warn('Firestore reports listener notice:', err)
    );

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role]);

  // Active view tab: 'preview' | 'list'
  const [activeTab, setActiveTab] = useState<'preview' | 'list'>(
    initialReportId ? 'preview' : savedReports.length > 0 && !initialSurveyId ? 'list' : 'preview'
  );

  // Selected Survey ID for generating a report
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(() => {
    if (initialSurveyId && surveys.some((s) => s.id === initialSurveyId)) {
      return initialSurveyId;
    }
    if (surveys.length > 0) {
      return surveys[0].id;
    }
    return '';
  });

  // Current active report being previewed / edited
  const [currentReport, setCurrentReport] = useState<SurveyReportRecord | null>(() => {
    // 1. If an initialReportId is provided
    if (initialReportId) {
      const found = getStoredReports().find((r) => r.id === initialReportId);
      if (found) return found;
    }
    // 2. If initialSurveyId or first survey exists
    const surveyToUse = initialSurveyId
      ? surveys.find((s) => s.id === initialSurveyId)
      : surveys[0];

    if (surveyToUse) {
      // Check if a saved report already exists for this survey
      const existing = getStoredReports().find((r) => r.surveyId === surveyToUse.id);
      if (existing) return existing;
      return createReportFromSurvey(surveyToUse);
    }

    return null;
  });

  // অটো-রিজেনারেট (Founder সিদ্ধান্ত ২৪ নভেম্বর ২০২৬ ২২:১৩ — "নিজে থেকে ঠিক করো"):
  // খোলা রিপোর্টের সংখ্যা তার জরিপের বর্তমান সংখ্যার সাথে না মিললে (যেমন পুরোনো
  // রিপোর্টে ০.০০ শতাংশ, জরিপে ১৫ শতাংশ) রিপোর্টটি জরিপ থেকে নতুন করে বানিয়ে
  // দেখানো হয় ও সেভ করা হয় — কিছু চাপতে হয় না। জরিপ না পাওয়া গেলে সেভ করা
  // রিপোর্ট যেমন আছে তেমনই থাকে। useLayoutEffect যাতে পেইন্টের আগেই ঠিক হয়ে
  // যায় (পুরোনো ০.০০ এক ঝলকও না দেখায়)। রিজেনারেট করা রিপোর্টের id একই
  // থাকে, আর দ্বিতীয়বার যাচাইয়ে মিলে যায় বলে লুপ হয় না।
  useLayoutEffect(() => {
    if (!currentReport) return;
    const survey = surveys.find((s) => s.id === currentReport.surveyId);
    const { report, regenerated } = ensureReportMatchesSurvey(currentReport, survey);
    if (regenerated) {
      setCurrentReport(report);
      setSavedReports(getStoredReports());
    }
  }, [currentReport, surveys]);

  // Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Save feedback state
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Screen preview zoom factor for responsive inspection
  // ডিফল্ট '100%' — ফোনে A4 ছোট করে (fit) দেখালে লেখা ~৭-৯px হয়ে পড়া যায় না;
  // ১০০%-এ পাশে স্ক্রল করে পড়া যায়। 'স্ক্রিন ফিট'-এ গেলে আগের মতো ছোট দেখাবে।
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100%'>('100%');

  // Share toast
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Currently selected survey object
  const activeSurvey = useMemo(() => {
    return surveys.find((s) => s.id === selectedSurveyId) || null;
  }, [surveys, selectedSurveyId]);

  // Validation result of the survey
  const validation = useMemo(() => {
    return validateSurveyForReport(activeSurvey);
  }, [activeSurvey]);

  // When selectedSurveyId changes, create or load matching report
  const handleSelectSurveyChange = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    const survey = surveys.find((s) => s.id === surveyId);
    if (!survey) return;

    // Check if there is already a saved report for this survey
    const existing = savedReports.find((r) => r.surveyId === survey.id);
    if (existing) {
      setCurrentReport(existing);
    } else {
      const generated = createReportFromSurvey(survey);
      setCurrentReport(generated);
    }
  };

  // Save report action
  const handleSaveReport = async () => {
    if (!currentReport) return;
    const reportBookingId = currentReport.bookingId || initialBookingId || undefined;
    const reportToStore: SurveyReportRecord = {
      ...currentReport,
      bookingId: reportBookingId,
      ownerId: currentReport.ownerId || currentUser?.id,
      aminId: currentUser?.role === 'amin' ? currentUser.id : currentReport.aminId,
      updatedAt: Date.now(),
    };
    const updatedList = saveReportRecord(reportToStore);
    setSavedReports(updatedList);
    setSaveSuccessMsg(
      isBn
        ? `প্রতিবেদন '${currentReport.reportNumber}' সফলভাবে সংরক্ষিত হয়েছে!`
        : `Report '${currentReport.reportNumber}' saved successfully!`
    );
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3500);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'reports', reportToStore.id), cleanForFirestore(reportToStore));
        if (reportBookingId) {
          await updateDoc(doc(db, 'bookings', reportBookingId), cleanForFirestore({
            linkedReportId: reportToStore.id,
            updatedAt: new Date().toISOString(),
          })).catch((err) => console.warn('Booking linkedReportId update notice:', err));
        }
      } catch (err) {
        console.warn('Firestore report sync note:', err);
      }
    }
  };

  // Toggle Draft / Final Status
  const handleToggleStatus = () => {
    if (!currentReport) return;
    const nextStatus: ReportStatus = currentReport.status === 'draft' ? 'final' : 'draft';
    const updated: SurveyReportRecord = {
      ...currentReport,
      status: nextStatus,
      finalizedDate: nextStatus === 'final' ? new Date().toISOString().split('T')[0] : undefined,
      updatedAt: Date.now(),
    };
    setCurrentReport(updated);
    saveReportRecord(updated);
    setSavedReports(getStoredReports());
  };

  // Handle updates from Editor modal
  const handleEditorSave = (overrides: Partial<SurveyReportRecord>) => {
    if (!currentReport) return;
    const updated: SurveyReportRecord = {
      ...currentReport,
      ...overrides,
      updatedAt: Date.now(),
    };
    setCurrentReport(updated);
    saveReportRecord(updated);
    setSavedReports(getStoredReports());
    setSaveSuccessMsg(
      isBn ? 'প্রতিবেদনের তথ্য হালনাগাদ করা হয়েছে।' : 'Report details updated.'
    );
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Delete report
  const handleDeleteReport = (reportId: string) => {
    const updated = deleteReportRecord(reportId);
    setSavedReports(updated);
    if (currentReport?.id === reportId) {
      if (updated.length > 0) {
        setCurrentReport(updated[0]);
      } else if (surveys.length > 0) {
        setCurrentReport(createReportFromSurvey(surveys[0]));
      } else {
        setCurrentReport(null);
      }
    }
  };

  // Trigger Browser Print / Save to PDF
  const handlePrint = async () => {
    // Auto-save before printing to ensure state is persisted, then wait for the
    // locally bundled Noto Sans Bengali font so the PDF never falls back.
    if (currentReport) {
      saveReportRecord(currentReport);
      setSavedReports(getStoredReports());
    }
    await printWithNoto();
  };

  // Professional Share — Web Share API + clipboard fallback + offline safe
  const handleShare = async () => {
    if (!currentReport) return;
    // Ensure saved
    saveReportRecord(currentReport);
    setSavedReports(getStoredReports());
    const shareUrl = `${window.location.origin}${window.location.pathname}#report/${currentReport.id}`;
    const title = currentReport.reportNumber || (isBn ? 'ভূমি সার্ভে রিপোর্ট' : 'Land Survey Report');
    const text = isBn
      ? `${title} — ${currentReport.mouza || ''} মৌজা, ${currentReport.title || ''} | ভূমি ও আমিন`
      : `${title} — ${currentReport.mouza || ''} Mouza | Bhumi O Amin`;
    // Try native share (with file support check, but we share link)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        setShareMsg(isBn ? 'শেয়ার সম্পন্ন ✓' : 'Shared ✓');
        setTimeout(()=> setShareMsg(null), 2500);
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // user cancelled
        // fall through to clipboard
      }
    }
    // Fallback: clipboard
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMsg(isBn ? 'লিংক কপি হয়েছে — যেকোনো অ্যাপে পেস্ট করুন' : 'Link copied — paste anywhere');
      } else {
        // legacy
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setShareMsg(isBn ? 'লিংক কপি হয়েছে' : 'Link copied');
      }
    } catch {
      prompt(isBn ? 'লিংক কপি করুন:' : 'Copy link:', shareUrl);
      setShareMsg(null);
      return;
    }
    setTimeout(()=> setShareMsg(null), 3000);
  };

  // Handle selecting a report from the list
  const handleSelectFromList = (report: SurveyReportRecord) => {
    setCurrentReport(report);
    setSelectedSurveyId(report.surveyId);
    setActiveTab('preview');
  };

  // Handle edit from list
  const handleEditFromList = (report: SurveyReportRecord) => {
    setCurrentReport(report);
    setSelectedSurveyId(report.surveyId);
    setActiveTab('preview');
    setIsEditorOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 pb-16 font-sans print:bg-white print:p-0 print:pb-0">
      {/* ================================================================== */}
      {/* 1. TOP APPLICATION NAVIGATION & TOOLBAR (HIDDEN IN PRINT)          */}
      {/* ================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-600 hover:text-emerald-900 hover:bg-slate-100 transition active:scale-95 flex items-center gap-1 font-bold text-xs"
              title={isBn ? 'ফিরে যান' : 'Back'}
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
              <span className="hidden sm:inline">{isBn ? 'ফিরে যান' : 'Back'}</span>
            </button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#065f46]" />
                <span>{isBn ? 'সার্ভে রিপোর্ট ও পিডিএফ' : 'Survey Report & PDF'}</span>
              </h1>
              <p className="text-[10px] text-slate-500 hidden sm:block">
                {isBn
                  ? 'A4 প্রিন্ট উপযোগী সরকারি মানসম্মত ডিজিটাল সার্ভে প্রতিবেদন'
                  : 'A4 Printable Digital Cadastral Land Survey Report'}
              </p>
            </div>
          </div>

          {/* Center / Right: Tab Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-white text-[#065f46] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#065f46]" />
              <span>{isBn ? 'রিপোর্ট প্রিভিউ' : 'Preview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-white text-[#065f46] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#065f46]" />
              <span>{isBn ? 'সংরক্ষিত' : 'Saved'}</span>
              {savedReports.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-mono font-bold">
                  {savedReports.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Action Controls Bar (When in Preview Mode) */}
        {activeTab === 'preview' && (
          <div className="bg-slate-50 border-t border-slate-200/90 px-3 sm:px-4 py-2">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
              {/* Survey Selector — পুরো চওড়া, যাতে লম্বা নাম কাটা না যায় */}
              {surveys.length > 0 ? (
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-slate-600 hidden md:inline shrink-0">
                    {isBn ? 'সার্ভে নির্বাচন:' : 'Select Survey:'}
                  </label>
                  <select
                    value={selectedSurveyId}
                    onChange={(e) => handleSelectSurveyChange(e.target.value)}
                    className="py-2 px-2.5 bg-white rounded-xl border border-slate-300 text-[15px] font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#065f46] w-full min-w-0"
                  >
                    {surveys.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || (isBn ? 'সার্ভে' : 'Survey')} {s.mouza ? `(${s.mouza})` : ''} -{' '}
                        {s.date || 'তারিখ নেই'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isBn ? 'কোনো সংরক্ষিত সার্ভে পাওয়া যায়নি।' : 'No saved surveys found.'}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentReport && (
                  <>
                    {/* Edit Metadata */}
                    <button
                      onClick={() => setIsEditorOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>{isBn ? 'তথ্য পরিবর্তন' : 'Edit Info'}</span>
                    </button>

                    {/* Status Toggle (Draft <-> Final) */}
                    <button
                      onClick={handleToggleStatus}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                        currentReport.status === 'final'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                          : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                      }`}
                      title={isBn ? 'স্ট্যাটাস পরিবর্তন করুন' : 'Toggle Status'}
                    >
                      {currentReport.status === 'final' ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-[#065f46]" />
                          <span>{isBn ? 'চূড়ান্ত অনুমোদন' : 'Final Report'}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>{isBn ? 'খসড়া (Draft)' : 'Draft'}</span>
                        </>
                      )}
                    </button>

                    {/* Save Report to localStorage — সবুজ থিম */}
                    <button
                      onClick={handleSaveReport}
                      className="px-3 py-1.5 rounded-xl bg-[#065f46] text-white hover:bg-[#054a37] text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <Save className="w-3.5 h-3.5 text-[#fde68a]" />
                      <span>{isBn ? 'সংরক্ষণ' : 'Save'}</span>
                    </button>

                    {/* Share — Web Share API + clipboard */}
                    <button
                      onClick={handleShare}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                      title={isBn ? 'রিপোর্ট শেয়ার করুন' : 'Share report'}
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-200" />
                      <span>{isBn ? 'শেয়ার' : 'Share'}</span>
                    </button>

                    {/* Print / Save to PDF — সোনালি থিম (একটাই বোতাম; ডকুমেন্টের ভেতরের
                        ডুপ্লিকেট বোতামটি নিচের <style> দিয়ে লুকানো — ReportDocumentA4 ছোঁয়া হয়নি) */}
                    <button
                      onClick={handlePrint}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 hover:from-amber-300 hover:to-amber-600 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-900" />
                      <span>{isBn ? 'প্রিন্ট / PDF' : 'Print / PDF'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Toast Notification */}
        {saveSuccessMsg && (
          <div className="bg-[#065f46] text-white text-[15px] font-semibold py-2 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn shadow-inner">
            <Check className="w-4 h-4 text-[#fde68a]" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
        {/* Share Toast */}
        {shareMsg && (
          <div className="bg-emerald-900 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn shadow-inner">
            <Share2 className="w-4 h-4 text-amber-300" />
            <span>{shareMsg}</span>
          </div>
        )}
      </header>

      {/* ================================================================== */}
      {/* 2. MAIN BODY CONTENT                                               */}
      {/* ================================================================== */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 pt-4 print:max-w-none print:mx-0 print:px-0 print:pt-0">
        {/* TAB 1: SAVED REPORTS LIST */}
        {activeTab === 'list' && (
          <ReportListView
            reports={savedReports}
            lang={lang}
            onSelectReport={handleSelectFromList}
            onEditReport={handleEditFromList}
            onDeleteReport={handleDeleteReport}
            onCreateNewReport={() => {
              if (surveys.length > 0) {
                const s = surveys[0];
                const fresh = createReportFromSurvey(s);
                setCurrentReport(fresh);
                setSelectedSurveyId(s.id);
                setActiveTab('preview');
              } else {
                onGoToSurvey();
              }
            }}
          />
        )}

        {/* TAB 2: A4 REPORT PREVIEW */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            {/* Case 1: No surveys available */}
            {surveys.length === 0 ? (
              <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 mx-auto flex items-center justify-center border border-emerald-100">
                  <Compass className="w-7 h-7 text-emerald-700" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {isBn ? 'রিপোর্ট তৈরির জন্য কোনো সার্ভে নেই' : 'No Surveys Available for Report'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isBn
                      ? 'একটি পূর্ণাঙ্গ এ৪ সাইজ ডিজিটাল রিপোর্ট তৈরি করতে আগে মাঠের জিপিএস পয়েন্ট সংগ্রহ ও সংরক্ষণ করুন।'
                      : 'To generate a printable A4 land survey report, first record and save GPS boundary points.'}
                  </p>
                </div>
                <button
                  onClick={onGoToSurvey}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition shadow-sm active:scale-95"
                >
                  <PlusCircle className="w-4 h-4 text-amber-300" />
                  <span>{isBn ? 'নতুন জিপিএস সার্ভে শুরু করুন' : 'Start New GPS Survey'}</span>
                </button>
              </div>
            ) : !validation.isValid ? (
              /* Case 2: Selected survey has fewer than 3 points */
              <div className="p-6 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                  <span>{isBn ? 'পর্যাপ্ত পয়েন্ট নেই' : 'Insufficient Survey Points'}</span>
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  {isBn ? validation.reasonBn : validation.reasonEn}
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={onGoToSurvey}
                    className="px-4 py-2 rounded-xl bg-amber-800 text-white text-xs font-bold hover:bg-amber-900 transition active:scale-95"
                  >
                    {isBn ? 'সার্ভেতে গিয়ে পয়েন্ট যোগ করুন' : 'Go to Survey to Add Points'}
                  </button>
                </div>
              </div>
            ) : currentReport ? (
              /* Case 3: Valid Survey & Report Ready */
              <div className="space-y-4">
                {/* Print Guidance Note Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs print:hidden">
                  <div className="flex items-center gap-2 text-slate-600 min-w-0 flex-1">
                    <Info className="w-5 h-5 text-emerald-800 shrink-0" />
                    <span className="text-[15px] font-semibold leading-snug">
                      {isBn
                        ? 'পিডিএফ ডাউনলোড করতে উপরের "প্রিন্ট / PDF" বাটনে চাপ দিন এবং ডেস্টিনেশন "Save as PDF" নির্বাচন করুন।'
                        : 'To download as PDF, click "Print / PDF" and select "Save as PDF" as the destination.'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-slate-500">
                    <button
                      onClick={() => setZoomLevel(zoomLevel === 'fit' ? '100%' : 'fit')}
                      className="min-h-[48px] px-4 rounded-xl border-[1.5px] border-[#065f46] text-[15px] font-bold text-[#065f46] hover:bg-emerald-50 transition active:scale-95"
                      title={isBn ? 'জুম পরিবর্তন' : 'Toggle Zoom'}
                    >
                      {zoomLevel === 'fit' ? (isBn ? '১০০% সাইজ' : '100% Size') : (isBn ? 'স্ক্রিন ফিট' : 'Fit Screen')}
                    </button>
                  </div>
                </div>

                {/* ভিউয়ার-স্তরের CSS — ReportDocumentA4.tsx ফাইলে হাত না দিয়ে:
                    ১০০% মোডে A4-কে আসল সাইজে দেখানো (ডকুমেন্ট নিজে ফোনে ছোট করে
                    zoom করে; !important দিয়ে ওভাররাইড), আর ডকুমেন্টের ভেতরের
                    ডুপ্লিকেট "প্রিন্ট / PDF" বোতাম লুকানো (টুলবারেরটাই থাকবে)।
                    সতর্কতা: ১০০% মোডে পাতার নকশার কোণা টেনে ছোট-বড় করলে হিসাব
                    একটু বেশি সরে — নকশা এডিট করতে "স্ক্রিন ফিট"-এ যান। */}
                <style>{`
                  .report-zoom-100 #report-printable-area { zoom: 1 !important; }
                  .report-zoom-100 .report-a4-wrap { overflow-x: auto !important; justify-content: flex-start !important; }
                  #report-printable-area .print-hidden > span > button:first-of-type { display: none !important; }
                `}</style>

                {/* A4 Paper Document Container */}
                <div
                  className={`w-full overflow-x-auto pb-8 print:p-0 print:overflow-visible ${
                    zoomLevel === 'fit' ? 'flex justify-center' : 'report-zoom-100 block'
                  }`}
                >
                  <ReportDocumentA4 report={currentReport} lang={lang} />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Metadata Editor Modal */}
      {currentReport && (
        <ReportEditorModal
          report={currentReport}
          lang={lang}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
};
