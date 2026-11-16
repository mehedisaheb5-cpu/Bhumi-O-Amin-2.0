import React, { useState, useEffect, useMemo } from 'react';
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
  ClipboardCheck,
  Eye,
  Send,
  FileDown,
  ImageDown,
  MessageCircle,
} from 'lucide-react';
import { SurveyRecord, SurveyReportRecord, Language, ReportStatus } from '../../types';
import {
  getStoredReports,
  saveStoredReports,
  saveReportRecord,
  deleteReportRecord,
  createReportFromSurvey,
  validateSurveyForReport,
  generateReportNumber,
} from '../../lib/survey-report-utils';
import { ReportDocumentA4 } from './ReportDocumentA4';
import { ReportEditorModal } from './ReportEditorModal';
import { ReportListView } from './ReportListView';
import { formatNumberByLang } from '../../lib/land-units';
import { printWithNoto } from '../../lib/print-utils';
import { idbGetAll } from '../../lib/faDb';
import {
  reportToPdfBlob,
  reportPagesToPngs,
  shareFiles,
  sharePdfViaWhatsApp,
  reportFileName,
  downloadBlob,
} from '../../lib/report-export';
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
  onGoToHandMap?: (surveyId: string) => void;
}

export const SurveyReportScreen: React.FC<SurveyReportScreenProps> = ({
  surveys,
  initialSurveyId,
  initialReportId,
  initialBookingId,
  lang,
  onBack,
  onGoToSurvey,
  onGoToHandMap,
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

  // Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Save feedback state
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Screen preview zoom factor for responsive inspection
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100%'>('fit');

  // Share toast
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // ধাপ ৭: ৩ ধাপের উইজার্ড — যাচাই → দেখুন → পাঠান (A-এর সিস্টেম, B-এর ডিজাইন)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(initialReportId ? 2 : 1);
  const [busy, setBusy] = useState<'pdf' | 'png' | 'wa' | 'share' | null>(null);
  const [handMapCount, setHandMapCount] = useState(0);

  // এই জরিপের সংরক্ষিত হ্যান্ড ম্যাপ কয়টি (যাচাই তালিকার জন্য)
  useEffect(() => {
    const sid = currentReport?.surveyId;
    if (!sid) { setHandMapCount(0); return; }
    let alive = true;
    idbGetAll<{ surveyId?: string | null }>('handmaps')
      .then((all) => { if (alive) setHandMapCount(all.filter((r) => r.surveyId === sid).length); })
      .catch(() => { if (alive) setHandMapCount(0); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReport?.surveyId, activeTab]);

  const showToast = (msg: string) => {
    setShareMsg(msg);
    setTimeout(() => setShareMsg(null), 3500);
  };

  // Currently selected survey object
  const activeSurvey = useMemo(() => {
    return surveys.find((s) => s.id === selectedSurveyId) || null;
  }, [surveys, selectedSurveyId]);

  // Validation result of the survey
  const validation = useMemo(() => {
    return validateSurveyForReport(activeSurvey);
  }, [activeSurvey]);

  // ধাপ ৭ — যাচাই তালিকা (ধাপ ১)
  const partyOk = !!(currentReport?.clientName && currentReport.clientName !== 'জমি মালিক / আবেদনকারী');
  const checks: Array<{ label: string; detail: string; ok: boolean; onAdd: (() => void) | null }> = currentReport
    ? [
        {
          label: isBn ? 'মৌজা ও দাগ' : 'Mouza & Dag',
          detail: `${currentReport.mouza || '—'} • দাগ ${currentReport.dagNo || '—'}`,
          ok: !!(currentReport.mouza && currentReport.dagNo),
          onAdd: () => setIsEditorOpen(true),
        },
        {
          label: isBn ? 'পক্ষের নাম' : 'Party Name',
          detail: currentReport.clientName || '—',
          ok: partyOk,
          onAdd: () => setIsEditorOpen(true),
        },
        {
          label: isBn ? 'বাহুর মাপ / পরিমাপ' : 'Measurements',
          detail: isBn ? validation.reasonBn : validation.reasonEn,
          ok: validation.isValid,
          onAdd: () => onGoToSurvey(),
        },
        {
          label: isBn ? 'হ্যান্ড ম্যাপ' : 'Hand Map',
          detail: handMapCount > 0 ? (isBn ? `${handMapCount}টি যোগ করা আছে` : `${handMapCount} added`) : (isBn ? 'এখনো যোগ করা হয়নি' : 'Not added yet'),
          ok: handMapCount > 0,
          onAdd: () => {
            const sid = activeSurvey?.id || currentReport.surveyId;
            if (onGoToHandMap && sid) onGoToHandMap(sid);
            else showToast(isBn ? 'হ্যান্ড ম্যাপ স্ক্রিনে গিয়ে "রিপোর্টে যোগ" চাপুন' : 'Open Hand Map and tap "Add to report"');
          },
        },
        {
          label: isBn ? 'স্বাক্ষর ঘর' : 'Signature Box',
          detail: isBn ? 'পাতায় আছে' : 'On the page',
          ok: true,
          onAdd: null,
        },
      ]
    : [];

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

  // ধাপ ৭ — PDF ডাউনলোড (ছবি-ভিত্তিক PDF, বাংলা ঠিক থাকে)
  const handleDownloadPdf = async () => {
    if (!currentReport || busy) return;
    setBusy('pdf');
    try {
      saveReportRecord(currentReport);
      setSavedReports(getStoredReports());
      const blob = await reportToPdfBlob(2);
      downloadBlob(blob, reportFileName(currentReport.reportNumber, 'pdf'));
      showToast(isBn ? 'PDF ডাউনলোড হলো ✓' : 'PDF downloaded ✓');
    } catch {
      showToast(isBn ? 'PDF হয়নি — প্রিন্ট দিয়ে PDF নিন' : 'PDF failed — use Print instead');
    } finally {
      setBusy(null);
    }
  };

  // ধাপ ৭ — PNG ছবি (প্রতি পাতা আলাদা ফাইল)
  const handleDownloadPng = async () => {
    if (!currentReport || busy) return;
    setBusy('png');
    try {
      saveReportRecord(currentReport);
      setSavedReports(getStoredReports());
      const pngs = await reportPagesToPngs(2);
      pngs.forEach((b, i) =>
        downloadBlob(b, reportFileName(currentReport.reportNumber, 'png', pngs.length > 1 ? i + 1 : undefined))
      );
      showToast(isBn ? `ছবি (PNG) ডাউনলোড হলো ✓ (${pngs.length} পাতা)` : `PNG downloaded ✓ (${pngs.length} pages)`);
    } catch {
      showToast(isBn ? 'ছবি হয়নি — প্রিন্ট দিয়ে PDF নিন' : 'PNG failed — use Print instead');
    } finally {
      setBusy(null);
    }
  };

  // ধাপ ৭ — PDF ফাইল অন্য অ্যাপে শেয়ার (Android শেয়ার শিট)
  const handleSharePdfFile = async () => {
    if (!currentReport || busy) return;
    setBusy('share');
    try {
      saveReportRecord(currentReport);
      setSavedReports(getStoredReports());
      const blob = await reportToPdfBlob(2);
      const file = new File([blob], reportFileName(currentReport.reportNumber, 'pdf'), { type: 'application/pdf' });
      const text = isBn
        ? `${currentReport.reportNumber} — ${currentReport.mouza || ''} মৌজা, দাগ ${currentReport.dagNo || '—'} | ভূমি ও আমিন`
        : `${currentReport.reportNumber} — ${currentReport.mouza || ''} Mouza | Bhumi O Amin`;
      const outcome = await shareFiles([file], 'ভূমি সার্ভে রিপোর্ট', text);
      if (outcome === 'shared') showToast(isBn ? 'শেয়ার সম্পন্ন ✓' : 'Shared ✓');
      else if (outcome === 'downloaded') showToast(isBn ? 'শেয়ার হয় না — PDF সেভ হলো' : 'Sharing unavailable — PDF saved');
    } catch {
      showToast(isBn ? 'শেয়ার হয়নি — আবার চেষ্টা করুন' : 'Share failed — try again');
    } finally {
      setBusy(null);
    }
  };

  // ধাপ ৭ — WhatsApp-এ PDF পাঠানো
  const handleWhatsApp = async () => {
    if (!currentReport || busy) return;
    setBusy('wa');
    try {
      saveReportRecord(currentReport);
      setSavedReports(getStoredReports());
      const blob = await reportToPdfBlob(2);
      const text = isBn
        ? `${currentReport.reportNumber} — ${currentReport.mouza || ''} মৌজা, দাগ ${currentReport.dagNo || '—'} | ভূমি ও আমিন`
        : `${currentReport.reportNumber} — ${currentReport.mouza || ''} Mouza | Bhumi O Amin`;
      const shareUrl = `${window.location.origin}${window.location.pathname}#report/${currentReport.id}`;
      const outcome = await sharePdfViaWhatsApp(blob, reportFileName(currentReport.reportNumber, 'pdf'), text, shareUrl);
      if (outcome === 'shared') showToast(isBn ? 'শেয়ার মেনু খুলেছে — WhatsApp বাছুন ✓' : 'Share sheet opened — pick WhatsApp ✓');
      else if (outcome === 'unsupported') showToast(isBn ? 'WhatsApp খুলেছে — PDF ফোনে সেভ হয়েছে, হাতে সংযুক্ত করুন' : 'WhatsApp opened — PDF saved, attach it manually');
    } catch {
      showToast(isBn ? 'WhatsApp-এ পাঠানো যায়নি — আবার চেষ্টা করুন' : 'WhatsApp share failed — try again');
    } finally {
      setBusy(null);
    }
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
                <FileText className="w-4 h-4 text-violet-800" />
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
                  ? 'bg-white text-violet-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-violet-800" />
              <span>{isBn ? 'রিপোর্ট প্রিভিউ' : 'Preview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-white text-violet-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-violet-800" />
              <span>{isBn ? 'সংরক্ষিত' : 'Saved'}</span>
              {savedReports.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-violet-100 text-violet-800 text-[10px] font-mono font-bold">
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
              {/* Survey Selector */}
              {surveys.length > 0 ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600 hidden md:inline">
                    {isBn ? 'সার্ভে নির্বাচন:' : 'Select Survey:'}
                  </label>
                  <select
                    value={selectedSurveyId}
                    onChange={(e) => handleSelectSurveyChange(e.target.value)}
                    className="py-1 px-2.5 bg-white rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-violet-700 max-w-[210px] sm:max-w-xs truncate"
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
                          ? 'bg-violet-50 border-violet-300 text-violet-900 hover:bg-violet-100'
                          : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                      }`}
                      title={isBn ? 'স্ট্যাটাস পরিবর্তন করুন' : 'Toggle Status'}
                    >
                      {currentReport.status === 'final' ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-violet-700" />
                          <span>{isBn ? 'চূড়ান্ত অনুমোদন' : 'Final Report'}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>{isBn ? 'খসড়া (Draft)' : 'Draft'}</span>
                        </>
                      )}
                    </button>

                    {/* Save Report to localStorage */}
                    <button
                      onClick={handleSaveReport}
                      className="px-3 py-1.5 rounded-xl bg-violet-800 text-white hover:bg-violet-900 text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <Save className="w-3.5 h-3.5 text-amber-300" />
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

                    {/* Print / Save to PDF */}
                    <button
                      onClick={handlePrint}
                      className="px-3.5 py-1.5 rounded-xl bg-violet-900 text-white hover:bg-violet-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-300" />
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
          <div className="bg-violet-900 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn shadow-inner">
            <Check className="w-4 h-4 text-amber-300" />
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

        {/* TAB 2: A4 REPORT PREVIEW — ধাপ ৭: যাচাই → দেখুন → পাঠান */}
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
            ) : currentReport ? (
              <>
                {/* ধাপ ৭ — ৩ ধাপের স্টেপার (A-এর সিস্টেম: সরল তালিকা, B-এর ডিজাইন: সবুজ + সোনালি) */}
                <div className="print:hidden bg-white rounded-2xl border border-emerald-900/20 shadow-xs p-2 flex items-center gap-2">
                  {([
                    { n: 1 as const, label: isBn ? 'যাচাই' : 'Verify', icon: <ClipboardCheck className="w-5 h-5" /> },
                    { n: 2 as const, label: isBn ? 'দেখুন' : 'Preview', icon: <Eye className="w-5 h-5" /> },
                    { n: 3 as const, label: isBn ? 'পাঠান' : 'Send', icon: <Send className="w-5 h-5" /> },
                  ]).map((s) => (
                    <button
                      key={s.n}
                      onClick={() => setWizardStep(s.n)}
                      className={`flex-1 min-h-[52px] rounded-xl flex items-center justify-center gap-2 text-[15px] font-black transition active:scale-[0.98] ${
                        wizardStep === s.n
                          ? 'bg-[#065f46] text-white border-2 border-[#f59e0b]'
                          : wizardStep > s.n
                            ? 'bg-emerald-50 text-emerald-900 border-2 border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border-2 border-slate-200'
                      }`}
                    >
                      <span className={wizardStep === s.n ? 'text-[#fde68a]' : ''}>{s.icon}</span>
                      <span>{s.n}. {s.label}</span>
                      {wizardStep > s.n && <span className="text-[#f59e0b]">✓</span>}
                    </button>
                  ))}
                </div>

                {/* ধাপ ১: যাচাই */}
                {wizardStep === 1 && (
                  <div className="print:hidden space-y-3">
                    <div className="bg-white rounded-2xl border border-emerald-900/20 shadow-xs p-4">
                      <h2 className="text-base font-black text-emerald-950 flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-emerald-800" />
                        {isBn ? '১. যাচাই করুন' : '1. Verify'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        {isBn ? 'রিপোর্ট পাঠানোর আগে সব তথ্য ঠিক আছে কি না দেখে নিন।' : 'Check everything before sending the report.'}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {checks.map((c) => (
                          <li key={c.label} className="flex items-center gap-3 min-h-[52px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
                            <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-base font-black ${c.ok ? 'bg-emerald-800 text-white' : 'bg-amber-400 text-amber-950'}`}>
                              {c.ok ? '✓' : '!'}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[15px] font-bold text-slate-800">{c.label}</span>
                              <span className="block text-xs text-slate-500 truncate">{c.detail}</span>
                            </span>
                            {c.ok ? (
                              <span className="text-xs font-bold text-emerald-800 shrink-0">{isBn ? 'ঠিক আছে' : 'OK'}</span>
                            ) : c.onAdd ? (
                              <button
                                onClick={c.onAdd}
                                className="shrink-0 min-h-[48px] px-4 rounded-xl bg-amber-400 text-amber-950 text-[15px] font-black shadow-xs active:scale-95"
                              >
                                {isBn ? 'যোগ করুন' : 'Add'}
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => setWizardStep(2)}
                      className="w-full min-h-[52px] rounded-2xl bg-[#065f46] text-white text-base font-black shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isBn ? 'দেখুন →' : 'Preview →'}
                    </button>
                  </div>
                )}

                {/* ধাপ ২ ও ৩: পরিমাপ ঠিক না থাকলে আগের সতর্কবার্তাই দেখাবে */}
                {wizardStep !== 1 && !validation.isValid && (
                  <div className="p-6 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 space-y-3 shadow-xs print:hidden">
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
                )}

                {/* ধাপ ২: দেখুন (আগের প্রিভিউ, অপরিবর্তিত) */}
                {wizardStep === 2 && validation.isValid && (
                  <div className="space-y-4">
                    {/* Print Guidance Note Bar */}
                    <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-xs print:hidden">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Info className="w-4 h-4 text-emerald-800 shrink-0" />
                        <span className="text-[11px]">
                          {isBn
                            ? 'PDF ডাউনলোড করতে "পাঠান" ধাপে যান, অথবা উপরের "প্রিন্ট / PDF" বাটনে চাপ দিন এবং ডেস্টিনেশন "Save as PDF" নির্বাচন করুন।'
                            : 'To download as PDF, go to the "Send" step, or click "Print / PDF" and select "Save as PDF".'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-slate-500">
                        <button
                          onClick={() => setZoomLevel(zoomLevel === 'fit' ? '100%' : 'fit')}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold hover:bg-slate-50 transition"
                          title={isBn ? 'জুম পরিবর্তন' : 'Toggle Zoom'}
                        >
                          {zoomLevel === 'fit' ? (isBn ? '১০০% সাইজ' : '100% Size') : (isBn ? 'স্ক্রিন ফিট' : 'Fit Screen')}
                        </button>
                      </div>
                    </div>

                    {/* A4 Paper Document Container */}
                    <div
                      className={`w-full overflow-x-auto pb-8 print:p-0 print:overflow-visible ${
                        zoomLevel === 'fit' ? 'flex justify-center' : 'block'
                      }`}
                    >
                      <ReportDocumentA4 report={currentReport} lang={lang} />
                    </div>

                    <button
                      onClick={() => setWizardStep(3)}
                      className="print:hidden w-full min-h-[52px] rounded-2xl bg-[#065f46] text-white text-base font-black shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isBn ? 'পাঠান →' : 'Send →'}
                    </button>
                  </div>
                )}

                {/* ধাপ ৩: পাঠান — ৪টি বড় কার্ড (B-এর ডিজাইন: সবুজ + সোনালি) */}
                {wizardStep === 3 && validation.isValid && (
                  <div className="print:hidden space-y-3">
                    <div className="bg-white rounded-2xl border border-emerald-900/20 shadow-xs p-4">
                      <h2 className="text-base font-black text-emerald-950 flex items-center gap-2">
                        <Send className="w-5 h-5 text-emerald-800" />
                        {isBn ? '৩. পাঠান' : '3. Send'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        {currentReport.reportNumber} • {isBn ? '২ পাতা' : '2 pages'} • {currentReport.mouza || '—'} {isBn ? 'মৌজা' : 'Mouza'}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <button
                          onClick={handleDownloadPdf}
                          disabled={busy !== null}
                          className="min-h-[96px] rounded-2xl bg-[#065f46] text-white p-3 flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-60"
                        >
                          <FileDown className="w-7 h-7 text-[#fde68a]" />
                          <span className="text-[15px] font-black leading-tight">{busy === 'pdf' ? (isBn ? 'তৈরি হচ্ছে…' : 'Working…') : (isBn ? 'PDF ডাউনলোড' : 'Download PDF')}</span>
                          <span className="text-[11px] opacity-80">A4 • {isBn ? 'বাংলা ঠিক থাকবে' : 'Bengali safe'}</span>
                        </button>
                        <button
                          onClick={handleDownloadPng}
                          disabled={busy !== null}
                          className="min-h-[96px] rounded-2xl bg-[#065f46] text-white p-3 flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-60"
                        >
                          <ImageDown className="w-7 h-7 text-[#fde68a]" />
                          <span className="text-[15px] font-black leading-tight">{busy === 'png' ? (isBn ? 'তৈরি হচ্ছে…' : 'Working…') : (isBn ? 'PNG ছবি' : 'PNG Image')}</span>
                          <span className="text-[11px] opacity-80">{isBn ? 'প্রতি পাতা আলাদা' : 'One file per page'}</span>
                        </button>
                        <button
                          onClick={handlePrint}
                          disabled={busy !== null}
                          className="min-h-[96px] rounded-2xl bg-[#065f46] text-white p-3 flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-60"
                        >
                          <Printer className="w-7 h-7 text-[#fde68a]" />
                          <span className="text-[15px] font-black leading-tight">{isBn ? 'প্রিন্ট' : 'Print'}</span>
                          <span className="text-[11px] opacity-80">{isBn ? 'প্রিন্ট / Save as PDF' : 'Print / Save as PDF'}</span>
                        </button>
                        <button
                          onClick={handleWhatsApp}
                          disabled={busy !== null}
                          className="min-h-[96px] rounded-2xl bg-[#065f46] text-white p-3 flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-60"
                        >
                          <MessageCircle className="w-7 h-7 text-[#fde68a]" />
                          <span className="text-[15px] font-black leading-tight">{busy === 'wa' ? (isBn ? 'তৈরি হচ্ছে…' : 'Working…') : 'WhatsApp'}</span>
                          <span className="text-[11px] opacity-80">{isBn ? 'PDF সংযুক্ত করে' : 'With PDF attached'}</span>
                        </button>
                      </div>
                      <button
                        onClick={handleSharePdfFile}
                        disabled={busy !== null}
                        className="mt-3 w-full min-h-[52px] rounded-2xl bg-white border-2 border-[#f59e0b] text-emerald-950 text-[15px] font-black shadow-xs active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <Share2 className="w-5 h-5 text-emerald-800" />
                        {busy === 'share' ? (isBn ? 'তৈরি হচ্ছে…' : 'Working…') : (isBn ? 'অন্য অ্যাপে শেয়ার' : 'Share to other apps')}
                      </button>
                      <p className="text-[11px] text-slate-500 mt-2 text-center">
                        {isBn ? 'PDF ফাইল শেয়ার হবে — WhatsApp, Messenger, Gmail…' : 'Shares the PDF file — WhatsApp, Messenger, Gmail…'}
                      </p>
                    </div>
                    <button
                      onClick={() => setWizardStep(2)}
                      className="w-full min-h-[52px] rounded-2xl bg-white border-2 border-emerald-800 text-emerald-900 text-base font-black shadow-xs active:scale-[0.98]"
                    >
                      {isBn ? '← দেখুন' : '← Preview'}
                    </button>
                  </div>
                )}

                {/* ধাপ ৩-এ এক্সপোর্টের জন্য পাতা DOM-এ থাকতে হয় — পর্দায় লুকানো, প্রিন্টে দেখা যায় */}
                {wizardStep === 3 && validation.isValid && (
                  <div className="step3-hidden-report" style={{ position: 'absolute', left: -10000, top: 0, visibility: 'hidden' }} aria-hidden="true">
                    <ReportDocumentA4 report={currentReport} lang={lang} />
                  </div>
                )}
              </>
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

      {/* ধাপ ৭: ধাপ ৩-এর লুকানো রিপোর্ট — পর্দায় অফ-স্ক্রিন, প্রিন্টে স্বাভাবিক */}
      <style>{`@media print { .step3-hidden-report { position: static !important; left: auto !important; top: auto !important; visibility: visible !important; } }`}</style>
    </div>
  );
};
