import React, { useEffect, useState } from 'react';
import {
  Map as MapIcon,
  Layers,
  Sparkles,
  ArrowLeft,
  Compass,
  Pencil,
  ArrowRight,
  Upload,
  Eye,
  Layers2,
  CheckCircle2,
  Info,
  Library,
} from 'lucide-react';
import { Language, SurveyRecord } from '../../types';
import { MouzaMapScreen } from '../mouza/MouzaMapScreen';
import { SketchToDrawingScreen } from '../SketchToDrawingScreen';
import { AdminMouzaMapLibrary } from '../mouza/AdminMouzaMapLibrary';

// Clean: 3 features — Demarcation (with Pick/Upload outside) | Pentagraph CS↔BS | Sketch-to-Drawing — Mouza Library removed from main, kept inside Demarcation Pick
export type MapWorkspaceTab = 'demarcation' | 'pentagraph' | 'sketch' | 'mouza_dag' | 'cad_drawing' | 'sketch_ai' | 'map_library';

interface MapsAndDrawingsScreenProps {
  lang: Language;
  surveys: SurveyRecord[];
  initialTab?: MapWorkspaceTab | null;
  initialSurveyId?: string | null;
  initialMouzaMapId?: string | null;
  onSaveSurvey: (survey: SurveyRecord) => void;
  onNavigateToSurvey?: () => void;
  onOpenReport?: (surveyId?: string) => void;
  onBack: () => void;
}

// Pentagraph Workspace — CS ↔ BS overlay
const PentagraphWorkspace: React.FC<{ lang: Language; onBack: () => void }> = ({ lang, onBack }) => {
  const isBn = lang === 'bn';
  const [csFile, setCsFile] = useState<string | null>(null);
  const [bsFile, setBsFile] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(60);
  const [dagNo, setDagNo] = useState('');

  const handleCsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCsFile(f.name);
  };
  const handleBsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setBsFile(f.name);
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" /> {isBn ? 'ফিচার' : 'Features'}
        </button>
        <span className="text-[11px] font-bold text-slate-500">{isBn ? 'পেন্টাগ্রাফ' : 'Pentagraph'}</span>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
            <Layers2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-slate-900">{isBn ? 'পেন্টাগ্রাফ — CS ↔ BS' : 'Pentagraph — CS ↔ BS'}</h3>
            <p className="text-[11px] text-slate-500">{isBn ? 'নির্দিষ্ট দাগ ওভারলে • Opacity দিয়ে ম্যাচ' : 'Overlay specific dag • Match with opacity'}</p>
          </div>
        </div>
        <span className="text-[10px] font-bold bg-sky-50 border border-sky-200 text-sky-800 px-2.5 py-1 rounded-full">CS ↔ BS</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed bg-white cursor-pointer hover:border-sky-300 ${csFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${csFile ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800">{isBn ? 'CS ম্যাপ আপলোড' : 'Upload CS Map'}</span>
          <span className="text-[11px] text-slate-500">{csFile || (isBn ? 'JPG / PDF' : 'JPG / PDF')}</span>
          {csFile && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 px-2 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> {csFile}</span>}
          <input type="file" accept="image/*,.pdf" onChange={handleCsUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <label className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed bg-white cursor-pointer hover:border-sky-300 ${bsFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bsFile ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800">{isBn ? 'BS ম্যাপ আপলোড' : 'Upload BS Map'}</span>
          <span className="text-[11px] text-slate-500">{bsFile || (isBn ? 'JPG / PDF' : 'JPG / PDF')}</span>
          {bsFile && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 px-2 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> {bsFile}</span>}
          <input type="file" accept="image/*,.pdf" onChange={handleBsUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2">
        <div className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{isBn ? 'দাগ নং' : 'Dag No'}</div>
        <input value={dagNo} onChange={(e) => setDagNo(e.target.value)} placeholder={isBn ? 'যেমন: ৪৫৬' : 'e.g. 456'} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50/50 focus:outline-none focus:border-sky-300" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5"><Eye className="w-4 h-4 text-sky-700" /> {isBn ? 'ওভারলে প্রিভিউ' : 'Overlay Preview'}</span>
          <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded-full text-slate-600">Opacity {opacity}%</span>
        </div>
        <div className="relative h-[280px] bg-slate-900 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0" style={{ opacity: 1 - opacity / 100 }}>
            <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(45deg, #e0f2fe 0 14px, #bae6fd 14px 28px)', opacity: 0.9 }} />
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-[68%] h-[62%] border-2 border-sky-400 bg-sky-400/10 rounded-sm" /></div>
            <span className="absolute top-2 left-2 bg-white/90 text-sky-800 text-[10px] font-black px-2 py-1 rounded-full border border-sky-200">CS</span>
          </div>
          <div className="absolute inset-0" style={{ opacity: opacity / 100 }}>
            <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(-45deg, #fef3c7 0 14px, #fde68a 14px 28px)', opacity: 0.85 }} />
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-[64%] h-[58%] border-2 border-amber-500 bg-amber-400/10 rounded-sm rotate-[0.8deg]" /></div>
            <span className="absolute top-2 right-2 bg-white/90 text-amber-800 text-[10px] font-black px-2 py-1 rounded-full border border-amber-200">BS</span>
          </div>
          <div className="absolute w-[32%] h-[28%] border-[2.5px] border-emerald-400 bg-emerald-400/15 rounded-sm" style={{ top: '38%', left: '34%' }} />
          {dagNo && <span className="absolute bg-emerald-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full" style={{ top: '36%', left: '50%', transform: 'translateX(-50%)' }}>{dagNo}</span>}
        </div>
        <div className="p-3 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-600">Opacity</span>
            <input type="range" min={0} max={100} value={opacity} onChange={(e) => setOpacity(parseInt(e.target.value))} className="flex-1 accent-sky-600" />
            <span className="text-xs font-black text-sky-800 w-10 text-right">{opacity}%</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{isBn ? 'Slider টেনে CS ও BS মিলিয়ে নিন।' : 'Slide to match CS & BS.'}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 bg-sky-700 hover:bg-sky-800 text-white text-sm font-black py-3.5 rounded-2xl flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> {isBn ? 'ওভারলে নিশ্চিত' : 'Confirm Overlay'}</button>
        <button onClick={onBack} className="px-5 py-3.5 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700">{isBn ? 'পিছনে' : 'Back'}</button>
      </div>
    </div>
  );
};

export const MapsAndDrawingsScreen: React.FC<MapsAndDrawingsScreenProps> = ({
  lang,
  surveys,
  initialTab,
  initialSurveyId,
  initialMouzaMapId,
  onSaveSurvey,
  onNavigateToSurvey,
  onOpenReport,
  onBack,
}) => {
  const isBn = lang === 'bn';

  // Map old tab ids
  const normalizeTab = (t: MapWorkspaceTab): 'demarcation' | 'pentagraph' | 'sketch' | null => {
    if (t === 'pentagraph' || (t as string) === 'cad_drawing') return 'pentagraph';
    if (t === 'sketch' || (t as string) === 'sketch_ai') return 'sketch';
    // mouza_library/map_library/mouza_dag are legacy — now handled inside Demarcation Pick, not standalone
    if ((t as string) === 'mouza_library' || (t as string) === 'map_library' || (t as string) === 'mouza_dag') return 'demarcation';
    if (t === 'demarcation') return 'demarcation';
    return null;
  };

  const [activeTab, setActiveTab] = useState<'demarcation' | 'pentagraph' | 'sketch' | null>(() =>
    initialTab ? normalizeTab(initialTab) : null
  );
  useEffect(() => {
    // Generic Maps entry (no initialTab) shows the feature chooser; contextual deep-links can open a feature.
    setActiveTab(initialTab ? normalizeTab(initialTab) : null);
  }, [initialTab]);

  const [demarcationStep, setDemarcationStep] = useState<'choose' | 'library' | 'canvas'>('choose');
  const [demarcationSelectedMap, setDemarcationSelectedMap] = useState<string | null>(initialMouzaMapId || null);

  // If activeTab is set, show workspace full — cards hidden
  if (activeTab) {
    return (
      <div id="maps-and-drawings-screen" className="space-y-3 pb-14 animate-fadeIn">
        {/* Workspace Header with Back to Features */}
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
          <button onClick={() => setActiveTab(null)} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> {isBn ? 'ফিচার' : 'Features'}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-black text-slate-900 flex items-center gap-2">
              {activeTab === 'demarcation' && <><Pencil className="w-4 h-4 text-emerald-700" /> {isBn ? 'ডিমার্কেশন' : 'Demarcation'}</>}
              {activeTab === 'pentagraph' && <><Layers2 className="w-4 h-4 text-sky-700" /> {isBn ? 'পেন্টাগ্রাফ' : 'Pentagraph'}</>}
              {activeTab === 'sketch' && <><Sparkles className="w-4 h-4 text-amber-600" /> {isBn ? 'স্কেচ-টু-ড্রয়িং' : 'Sketch-to-Drawing'}</>}
            </h2>
            <p className="text-[11px] text-slate-500">
              {activeTab === 'demarcation' && (isBn ? 'মৌজা ড্রপডাউন থেকে নির্বাচন → ক্যানভাস' : 'Select from dropdown → Canvas')}
              {activeTab === 'pentagraph' && (isBn ? 'CS ↔ BS ওভারলে' : 'CS ↔ BS overlay')}
              {activeTab === 'sketch' && (isBn ? 'ছবি → Auto ভেক্টর' : 'Image → Auto vector')}
            </p>
          </div>
          <button onClick={onBack} className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hidden sm:inline">{isBn ? 'হোম' : 'Home'}</button>
        </div>

        {activeTab === 'demarcation' && (
          <>
            {demarcationStep === 'choose' && (
              <div className="space-y-3 animate-fadeIn">
                <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto"><Pencil className="w-6 h-6 text-emerald-700" /></div>
                  <h3 className="text-[14px] font-black text-slate-900 mt-2">{isBn ? 'ডিমার্কেশন শুরু করুন' : 'Start Demarcation'}</h3>
                  <p className="text-[11px] text-slate-500 mt-1">{isBn ? 'মৌজা বাছাই করুন অথবা ম্যাপ আপলোড করুন — তারপর ফুল স্ক্রিন ক্যানভাসে দাগ আঁকুন' : 'Pick mouza or upload map — then draw on full screen canvas'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDemarcationStep('library')} className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-emerald-600 text-white border-2 border-emerald-700 shadow-2xs active:scale-[0.98]">
                    <Library className="w-7 h-7" />
                    <span className="text-[13px] font-black">{isBn ? 'মৌজা বাছাই করুন' : 'Pick Mouza'}</span>
                    <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full">{isBn ? 'লাইব্রেরি থেকে' : 'From library'}</span>
                  </button>
                  <button onClick={() => { const inp = document.createElement('input'); (inp as any).type='file'; (inp as any).accept='image/*,.pdf'; (inp as any).onchange=()=>setDemarcationStep('canvas'); inp.click(); }} className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border-2 border-emerald-300 text-emerald-900 shadow-2xs active:scale-[0.98]">
                    <Upload className="w-7 h-7 text-emerald-700" />
                    <span className="text-[13px] font-black">{isBn ? 'আপলোড করুন' : 'Upload'}</span>
                    <span className="text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">JPG / PDF</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <Info className="w-4 h-4 text-amber-700" />
                  <p className="text-[11px] text-amber-900">{isBn ? 'বাছাই/আপলোডের পর ফুল ভিউ ক্যানভাস খুলবে — সেখানে ডিমার্কেশন, Save ও পেন্টাগ্রাফে যোগ করতে পারবেন।' : 'After pick/upload, full canvas opens — draw, Save and add to Pentagraph.'}</p>
                </div>
              </div>
            )}
            {demarcationStep === 'library' && (
              <div className="space-y-2">
                <button onClick={() => setDemarcationStep('choose')} className="inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> {isBn ? 'ফিরুন' : 'Back'}</button>
                <AdminMouzaMapLibrary lang={lang} onSelectMap={(item: any) => { setDemarcationSelectedMap(item?.id || item); setDemarcationStep('canvas'); }} onSelectForPentagraph={(item: any) => { setDemarcationSelectedMap(item?.id || item); setActiveTab('pentagraph'); }} />
              </div>
            )}
            {demarcationStep === 'canvas' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setDemarcationStep('choose')} className="inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> {isBn ? 'বাছাই' : 'Pick'}</button>
                  <span className="text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full">Full Canvas</span>
                  <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded-full">16&quot;=1 mile</span>
                  <button onClick={() => setActiveTab('pentagraph')} className="ml-auto inline-flex items-center gap-1 text-xs font-black bg-sky-600 text-white px-3 py-2 rounded-xl"><Layers2 className="w-4 h-4" /> {isBn ? 'পেন্টাগ্রাফে যোগ' : 'Add to Pentagraph'}</button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full"><MapIcon className="w-3.5 h-3.5" /> Canvas: fit-to-screen • no scroll • canvas zoom না</span>
                  <span className="text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-full">Done→Auto শতাংশ</span>
                </div>
                <MouzaMapScreen lang={lang} surveys={surveys} initialMouzaMapId={demarcationSelectedMap || initialMouzaMapId} onBack={() => setDemarcationStep('choose')} onNavigateToSurvey={onNavigateToSurvey} onOpenMapDrawing={() => setActiveTab('pentagraph')} onOpenReport={onOpenReport} hideBackButton={true} />
              </div>
            )}
          </>
        )}
        {activeTab === 'pentagraph' && <PentagraphWorkspace lang={lang} onBack={() => setActiveTab(null)} />}
        {activeTab === 'sketch' && (
          <SketchToDrawingScreen
            lang={lang}
            onBack={() => setActiveTab(null)}
            onOpenDigitalDrawing={(survey) => {
              onSaveSurvey(survey);
              setActiveTab('demarcation');
            }}
            onOpenReport={onOpenReport}
            onNavigateToSurvey={onNavigateToSurvey}
          />
        )}
        {/* mouza_library standalone removed — library now only inside Demarcation → Pick Mouza */}
      </div>
    );
  }

  // Main — 4 Cards only (no canvas)
  return (
    <div id="maps-and-drawings-screen" className="space-y-3 pb-14 animate-fadeIn">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-sky-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs">
          <ArrowLeft className="w-4 h-4" /> <span>{isBn ? 'হোম' : 'Home'}</span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[17px] font-black text-slate-900 flex items-center gap-2"><Layers className="w-5 h-5 text-sky-700" /> <span>{isBn ? 'মৌজা ম্যাপ' : 'Mouza Map'}</span><span className="hidden sm:inline text-[10px] font-bold bg-sky-50 border border-sky-200 text-sky-800 px-2 py-0.5 rounded-full">3 FEAT</span></h2>
          <p className="text-[11px] text-slate-500 truncate">{isBn ? '৩টি ফিচার — ডিমার্কেশন • পেন্টাগ্রাফ CS↔BS • স্কেচ-টু-ড্রয়িং' : '3 features — Demarcation • Pentagraph • Sketch'}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black tracking-wider text-slate-500 uppercase">{isBn ? 'ফিচার বেছে নিন' : 'Choose Feature'}</span>
          <span className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">{isBn ? 'Vertical Card • Click এ রঙ বদলায়' : 'Vertical • Click to select'}</span>
        </div>

        {/* 1. Demarcation — with 2 options outside (visible) */}
        <div className="rounded-[20px] border-2 bg-white border-emerald-200 overflow-hidden shadow-2xs">
          <button onClick={() => { setActiveTab('demarcation'); setDemarcationStep('choose'); }} className="w-full text-left flex items-center gap-3 p-3.5 hover:bg-emerald-50/30 transition-all active:scale-[0.99]">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-emerald-600 text-white border-emerald-600"><Pencil className="w-6 h-6" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><span className="text-[13px] font-black text-slate-900">{isBn ? '১. ডিমার্কেশন' : '1. Demarcation'}</span><span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">{isBn ? 'মেইন' : 'MAIN'}</span></div>
              <p className="text-[11px] leading-relaxed text-slate-600 mt-0.5">{isBn ? 'দাগের সীমানা আঁকুন — নিচে ২ অপশন থেকে শুরু করুন' : 'Draw dag boundary — start from 2 options below'}</p>
              <div className="flex items-center gap-1.5 mt-1.5"><span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-emerald-800">16&quot;=1 mile</span><span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600">Canvas fit</span></div>
            </div>
            <div className="w-7 h-7 rounded-full bg-emerald-600 border border-emerald-600 text-white flex items-center justify-center"><ArrowRight className="w-4 h-4" /></div>
          </button>
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-emerald-50/50 border-t border-emerald-100">
            <button onClick={() => { setActiveTab('demarcation'); setDemarcationStep('library'); }} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-emerald-600 text-white border border-emerald-700 shadow-2xs active:scale-[0.98]">
              <Library className="w-5 h-5" />
              <span className="text-[12px] font-black">{isBn ? 'মৌজা বাছাই করুন' : 'Pick Mouza'}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{isBn ? 'লাইব্রেরি' : 'Library'}</span>
            </button>
            <button onClick={() => { setActiveTab('demarcation'); setDemarcationStep('canvas'); const inp = document.createElement('input'); (inp as any).type='file'; (inp as any).accept='image/*,.pdf'; (inp as any).onchange=()=>setDemarcationStep('canvas'); inp.click(); }} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border-2 border-emerald-300 text-emerald-900 shadow-2xs active:scale-[0.98]">
              <Upload className="w-5 h-5 text-emerald-700" />
              <span className="text-[12px] font-black">{isBn ? 'আপলোড করুন' : 'Upload'}</span>
              <span className="text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">JPG / PDF</span>
            </button>
          </div>
        </div>

        {/* 2. Pentagraph */}
        <button onClick={() => setActiveTab('pentagraph')} className="w-full text-left flex items-center gap-3 p-3.5 rounded-[20px] border-2 bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all active:scale-[0.99]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-sky-50 text-sky-700 border-sky-200"><Layers2 className="w-6 h-6" /></div>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-black text-slate-900">{isBn ? '২. পেন্টাগ্রাফ' : '2. Pentagraph'}</span>
            <p className="text-[11px] leading-relaxed text-slate-600 mt-0.5">{isBn ? 'CS থেকে BS নির্দিষ্ট দাগ ওভারলে • Opacity slider দিয়ে নিখুঁত ম্যাচ' : 'CS to BS specific dag overlay • Precise match with opacity slider'}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></div>
        </button>

        {/* 3. Sketch */}
        <button onClick={() => setActiveTab('sketch')} className="w-full text-left flex items-center gap-3 p-3.5 rounded-[20px] border-2 bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all active:scale-[0.99]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-amber-50 text-amber-700 border-amber-200"><Sparkles className="w-6 h-6" /></div>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-black text-slate-900">{isBn ? '৩. স্কেচ-টু-ড্রয়িং' : '3. Sketch-to-Drawing'}</span>
            <p className="text-[11px] leading-relaxed text-slate-600 mt-0.5">{isBn ? 'খাতার নকশা ছবি → Auto ভেক্টর • Manual ft/inch fallback' : 'Paper sketch → Auto vector • Manual ft/inch fallback'}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></div>
        </button>


      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-start gap-2">
        <Info className="w-4 h-4 text-sky-700 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600">{isBn ? 'ডিমার্কেশন এ ক্লিক করলে ভেতরে মৌজা ড্রপডাউন থেকে নির্বাচন করে ক্যানভাসে কাজ করবেন — বাকি ৩টি আলাদা Workspace।' : 'Click Demarcation to select mouza from dropdown inside canvas — others are separate workspaces.'}</p>
      </div>
    </div>
  );
};
