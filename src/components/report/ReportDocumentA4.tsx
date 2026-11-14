import React, { useState, useMemo, useEffect } from 'react';
import { SurveyReportRecord, Language, SurveyDrawing, PlotMeta } from '../../types';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import { printWithNoto } from '../../lib/print-utils';

interface Props { report: SurveyReportRecord; lang: Language; }

export const ReportDocumentA4: React.FC<Props> = ({ report, lang }) => {
  const [header, setHeader] = useState({
    mouza: report.mouza || 'শালিখা',
    jlNo: report.jlNo || '১২৩',
    thana: report.upazila || 'শালিখা',
    zilla: report.district || 'মাগুরা',
    union: report.union || 'বুনাগাতী',
    csDag: report.dagNo || '--',
    bsDag: (report as any).bsDag || '৪৫৬, ৪৫৭, ৪৫৮, ৪৫৯',
    date: report.reportDate || '২৯/০৫/২০২৫',
  });
  const uh = (k:string,v:string)=> setHeader(s=> ({...s,[k]:v}));
  const [tagline, setTagline] = useState('সেবা নিন নিশ্চিন্তে থাকুন');
  const [subTagline, setSubTagline] = useState('আপনার জমি, আপনার নিশ্চিন্ততা');
  const [mapTitle, setMapTitle] = useState('জমির নকশা (দাগভিত্তিক)');
  const [northText, setNorthText] = useState('উত্তর দিক উপরে');
  const [features, setFeatures] = useState<string[]>([
    'নির্ভুল জমির মাপ ও নকশা',
    'দাগভিত্তিক তথ্য ও হিসাব',
    'এলাকা (শতাংশ/একর) ক্যালকুলেশন',
    'পিডিএফ রিপোর্ট সংরক্ষণ',
    'সহজ শেয়ার ও প্রিন্ট সুবিধা',
  ]);
  const updateFeature=(i:number,v:string)=> setFeatures(a=> a.map((x,idx)=> idx===i? v : x));
  const [footerLeft, setFooterLeft] = useState('এই নকশা মোবাইল অ্যাপের মাধ্যমে প্রস্তুতকৃত\nতথ্য যাচাই সাপেক্ষে ব্যবহার করুন');
  const [footerMid, setFooterMid] = useState('নির্ভুল মাপ • সঠিক তথ্য • আপনার নিশ্চিন্ততা');
  const [footerRight, setFooterRight] = useState('ভূমি ও আমিন অ্যাপ\nসবসময় আপনার পাশে');

  const [comments, setComments] = useState(report.notes || '');
  const [owners, setOwners] = useState<Array<{name:string,father:string,address:string,deed:string,khatian:string,dag:string,percent:string}>>(
    Array.from({length:4},()=>({name:'',father:'',address:'',deed:'',khatian:'',dag:'',percent:''}))
  );
  const updateOwner=(i:number,patch:any)=> setOwners(v=> v.map((r,idx)=> idx===i? {...r,...patch}:r));
  const [purchase, setPurchase] = useState('');
  const [compromise, setCompromise] = useState('');

  const [drawing, setDrawing] = useState<SurveyDrawing|null>(null);
  const [plotMetas, setPlotMetas] = useState<PlotMeta[]>([]);
  const getEditsKey = () => `bhumi_report_edits_${report.id || 'global'}`;
  useEffect(()=>{
    try{ const raw=localStorage.getItem('bhumi_possession_drawing_v1'); if(raw){ const d=JSON.parse(raw); if(d.segments) { setDrawing(d); if(Array.isArray(d.plots)) setPlotMetas(d.plots);} } }catch{}
    try{
      const EDITS_KEY = getEditsKey();
      let eraw = localStorage.getItem(EDITS_KEY);
      // migrate old global key if per-report not found
      if(!eraw) eraw = localStorage.getItem('bhumi_report_edits_v1');
      if(eraw){ const d=JSON.parse(eraw); if(d.header) setHeader(d.header); if(d.tagline) setTagline(d.tagline); if(d.subTagline) setSubTagline(d.subTagline); if(d.mapTitle) setMapTitle(d.mapTitle); if(d.northText) setNorthText(d.northText); if(Array.isArray(d.features)&&d.features.length) setFeatures(d.features); if(d.footerLeft) setFooterLeft(d.footerLeft); if(d.footerMid) setFooterMid(d.footerMid); if(d.footerRight) setFooterRight(d.footerRight); if(d.comments!==undefined) setComments(d.comments); if(Array.isArray(d.owners)&&d.owners.length===4) setOwners(d.owners); if(d.purchase!==undefined) setPurchase(d.purchase); if(d.compromise!==undefined) setCompromise(d.compromise);} }catch{}
  },[report.id]);
  useEffect(()=>{ try{ const EDITS_KEY=getEditsKey(); localStorage.setItem(EDITS_KEY, JSON.stringify({header, tagline, subTagline, mapTitle, northText, features, footerLeft, footerMid, footerRight, comments, owners, purchase, compromise})); }catch{} },[header, tagline, subTagline, mapTitle, northText, features, footerLeft, footerMid, footerRight, comments, owners, purchase, compromise, report.id]);
  const clearEdits=()=>{ if(confirm('এই রিপোর্টের সব এডিট মুছবেন?')){ localStorage.removeItem(getEditsKey()); location.reload(); } };

  const plots = useMemo(()=>{
    const segs=(drawing?.segments||[]) as any[];
    if(!segs.length) return [];
    const key=(p:any)=>`${Math.round(p.x)},${Math.round(p.y)}`;
    const seen=new Set<string>(); const out:any[]=[]; const adj=new Map<string,any[]>();
    for(const sg of segs) for(const pt of [{x:sg.x1,y:sg.y1},{x:sg.x2,y:sg.y2}]){const k=key(pt); const a=adj.get(k)||[]; a.push(sg); adj.set(k,a);}
    for(const start of segs){
      for(const dir of [0,1] as const){
        const sp=dir===0?{x:start.x1,y:start.y1}:{x:start.x2,y:start.y2};
        const fp=dir===0?{x:start.x2,y:start.y2}:{x:start.x1,y:start.y1};
        const sk=key(sp);
        const dfs=(ck:string, prev:any, ids:string[], sides:any[], pts:any[])=>{
          if(ids.length===4){ if(ck===sk){ const pid=ids.slice().sort().join('|'); if(seen.has(pid)) return; seen.add(pid); const uniq=pts.slice(0,4); const cx=uniq.reduce((a:number,q:any)=>a+q.x,0)/uniq.length; const cy=uniq.reduce((a:number,q:any)=>a+q.y,0)/uniq.length; out.push({id:pid, pts:uniq, sides, cx, cy}); } return; }
          if(ids.length>4) return;
          for(const nxt of (adj.get(ck)||[])){ if(nxt===prev) continue; if(ids.includes(nxt.id)) continue; const a=key({x:nxt.x1,y:nxt.y1}), b=key({x:nxt.x2,y:nxt.y2}); if(a!==ck&&b!==ck) continue; const to=a===ck?b:a; const apt=a===ck?{x:nxt.x2,y:nxt.y2}:{x:nxt.x1,y:nxt.y1}; if(to===sk && ids.length!==3) continue; if(to!==sk && ids.length===3) continue; dfs(to,nxt,[...ids,nxt.id],[...sides,nxt.lengthFt],[...pts,apt]);}
        };
        dfs(key(fp), start, [start.id], [start.lengthFt], [sp,fp]);
      }
    }
    return out;
  },[drawing]);

  const bounds = useMemo(()=>{
    const segs=drawing?.segments||[];
    if(!segs.length) return {minX:0,maxX:400,minY:0,maxY:400};
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const sg of segs as any[]){ minX=Math.min(minX,sg.x1,sg.x2); maxX=Math.max(maxX,sg.x1,sg.x2); minY=Math.min(minY,sg.y1,sg.y2); maxY=Math.max(maxY,sg.y1,sg.y2); }
    const pad=14; return {minX:minX-pad,maxX:maxX+pad,minY:minY-pad,maxY:maxY+pad};
  },[drawing]);

  const tafsils = useMemo(()=>{
    if(plots.length){
      return plots.map((pl:any,idx:number)=>{
        const meta=plotMetas.find(m=> m.id===pl.id);
        const sides=pl.sides.filter((v:any)=> typeof v==='number'&&v>0);
        let dec='—';
        if(sides.length>=4){ const a=pl.sides[0]||0,b=pl.sides[1]||0,c=pl.sides[2]||0,d=pl.sides[3]||0; const sq=((a+c)/2)*((b+d)/2); dec=(sq/435.6).toFixed(2); }
        return {dag: meta?.dagNo || `${342+idx}`, dec, name: meta?.title || `প্লট ${idx+1}`};
      });
    }
    // D: fallback to occupation 4-sides plots if no drawing segments
    if (report.plots && report.plots.length > 0) {
      return report.plots.map((p, idx) => ({
        dag: p.dagNo || `${342+idx}`,
        dec: p.decimal !== null ? p.decimal.toFixed(2) : '—',
        name: p.plotName || `প্লট ${idx+1}`,
      }));
    }
    return [{dag: report.dagNo||'—', dec: formatNumberByLang(roundClean(report.decimal,2),lang), name: report.title}];
  },[plots, plotMetas, report, lang]);
  const totalDec = useMemo(()=> tafsils.reduce((s,t)=> s + (parseFloat(t.dec)||0),0).toFixed(2),[tafsils]);

  const inputStyle: React.CSSProperties = {width:'100%', border:'1px solid #a7f3d0', borderRadius:4, padding:'2px 4px', fontSize:11, background:'rgba(255,255,255,0.9)', MozAppearance:'none' as any, WebkitAppearance:'none' as any, appearance:'none' as any};

  // mobile: auto-zoom to fit viewport so no horizontal scroll (A4 210mm = ~794px) - measured, not guessed
  const [scale, setScale] = useState(1);
  useEffect(()=>{
    const calc=()=>{
      const vw = window.innerWidth;
      // main has px-3.5 (14px*2=28) + report border 2px*2 + safe 8px → 36px total gutter
      // and leave 2% breathing room so right edge never clips
      const available = Math.max(0, vw - 36);
      const a4px = 794;
      const raw = available / a4px;
      const fitted = raw * 0.97; // 3% safety margin
      if(available < a4px) setScale(Math.max(0.30, Math.min(1, fitted)));
      else setScale(1);
    };
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('orientationchange', calc);
    return ()=> { window.removeEventListener('resize', calc); window.removeEventListener('orientationchange', calc); };
  },[]);

  return (
    <div style={{width:'100%', maxWidth:'100vw', overflowX:'hidden', display:'flex', justifyContent:'center'}}>
    <div id="report-printable-area" style={{width:'210mm', maxWidth:'210mm', margin:'0 auto', background:'white', fontFamily:'Noto Sans Bengali, sans-serif', fontSynthesis:'none', zoom: scale as any}}>
      <div className="print-hidden" style={{marginBottom:8, background:'#fffbeb', border:'1px solid #fcd34d', color:'#78350f', fontSize:12, borderRadius:8, padding:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
        <span>✏️ সব ঘর এডিট করুন — অটো-সেভ <span style={{background:'#16a34a', color:'white', padding:'1px 6px', borderRadius:4, fontSize:10}}>✓ চালু</span> রিলোডেও থাকবে</span>
        <span style={{display:'flex', gap:8}}>
          <button onClick={printWithNoto} style={{background:'#14532d', color:'white', padding:'6px 12px', borderRadius:6, fontWeight:700, fontSize:12, border:'none', cursor:'pointer', fontFamily:'Noto Sans Bengali, sans-serif'}}>🖨️ প্রিন্ট / PDF</button>
          <button onClick={clearEdits} style={{background:'white', border:'1px solid #f59e0b', padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer'}}>↺ রিসেট</button>
        </span>
      </div>

      {/* PAGE 1 */}
      <div className="a4-page" style={{width:'210mm', height:'297mm', minHeight:'297mm', maxHeight:'297mm', padding:'4mm', boxSizing:'border-box', border:'2px solid #14532d', background:'white', position:'relative', overflow:'hidden', pageBreakAfter:'always', breakAfter:'page', pageBreakInside:'avoid', breakInside:'avoid', display:'flex', flexDirection:'column'}}>
        {/* corners */}
        <span style={{position:'absolute', top:3, left:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>
        <span style={{position:'absolute', top:3, right:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>
        <span style={{position:'absolute', bottom:3, left:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>
        <span style={{position:'absolute', bottom:3, right:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>
        {/* watermark */}
        <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', opacity:0.04}}><div style={{width:240, height:240, borderRadius:'50%', border:'8px solid #14532d', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#14532d', fontWeight:900, fontSize:24, lineHeight:1.2, textAlign:'center'}}>ভূমি<br/>ও আমিন<br/><span style={{fontSize:10, fontWeight:700}}>সঠিক মাপ • নির্ভুল তথ্য</span></div></div>

        {/* header flex - inline for print reliability */}
        <div style={{display:'flex', gap:'3mm', alignItems:'flex-start', position:'relative', zIndex:1}}>
          {/* left */}
          <div style={{width:'62mm', border:'1px solid #14532d', borderRadius:10, overflow:'hidden', background:'white', flexShrink:0}}>
            <div style={{background:'#14532d', color:'white', fontWeight:900, textAlign:'center', padding:'4px 0', fontSize:13, lineHeight:1}}>ভূমির তথ্য</div>
            <div style={{padding:'6px 7px', background:'#f0fdf4', fontSize:10.5, lineHeight:1.9, borderTop:'1px solid #14532d'}}>
              {[
                ['মৌজা','mouza'],
                ['জে.এল. নং','jlNo'],
                ['থানা','thana'],
                ['জেলা','zilla'],
                ['ইউনিয়ন','union'],
                ['সি.এস. দাগ','csDag'],
                ['বি.এস. দাগ','bsDag'],
                ['তারিখ','date'],
              ].map(([label,key])=> (
                <div key={key} style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
                  <span style={{width:52, flexShrink:0, color:'#334155'}}>{label}</span>
                  <span style={{color:'#94a3b8'}}>:</span>
                  <input value={(header as any)[key]} onChange={e=> uh(key,e.target.value)} style={{...inputStyle, flex:1}} />
                </div>
              ))}
            </div>
          </div>
          {/* center */}
          <div style={{flex:1, textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', paddingTop:2}}>
            <div style={{fontSize:26, fontWeight:900, lineHeight:1, letterSpacing:-0.5}}><span style={{color:'#14532d'}}>ভূমি ও</span> <span style={{color:'#c75a0a'}}>আমিন</span></div>
            <input value={tagline} onChange={e=> setTagline(e.target.value)} style={{marginTop:4, width:'100%', textAlign:'center', fontSize:11, fontWeight:700, color:'#14532d', border:'1px solid #a7f3d0', borderRadius:4, padding:'2px 4px', background:'rgba(255,255,255,0.9)'}} />
            <div style={{marginTop:6, width:108, height:108, borderRadius:'50%', border:'3px solid #14532d', background:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:4, overflow:'hidden'}}>
              <div style={{fontSize:9, fontWeight:900, color:'#14532d', lineHeight:1}}>ভূমি ও আমিন</div>
              <div style={{marginTop:4, display:'flex', alignItems:'center', gap:4}}><div style={{width:54, height:28, border:'2px solid #14532d', background:'white', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:2}}><div style={{position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'18px solid transparent', borderRight:'18px solid transparent', borderBottom:'10px solid #14532d'}}></div><div style={{width:12, height:12, border:'1px solid #14532d', background:'#dcfce7'}}></div><div style={{width:12, height:12, border:'1px solid #14532d', background:'#dcfce7'}}></div></div><div style={{width:18, height:26, background:'#ff8a00', borderRadius:'50% 50% 50% 50% / 60% 60% 40% 40%', border:'2px solid #14532d', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:3}}><span style={{width:7, height:7, background:'white', borderRadius:'50%', display:'block'}}></span></div></div>
              <div style={{marginTop:4, width:'100%', display:'flex', flexDirection:'column', gap:2}}><div style={{height:5, background:'#86efac', borderRadius:99, border:'1px solid #14532d'}}></div><div style={{height:5, background:'#4ade80', borderRadius:99, border:'1px solid #14532d'}}></div><div style={{height:5, background:'#22c55e', borderRadius:99, border:'1px solid #14532d'}}></div></div>
              <div style={{fontSize:7, fontWeight:700, color:'#c75a0a', marginTop:3}}>সঠিক মাপ • নির্ভুল তথ্য</div>
            </div>
            <input value={subTagline} onChange={e=> setSubTagline(e.target.value)} style={{marginTop:8, width:'100%', textAlign:'center', fontSize:9, color:'#475569', border:'1px solid #cbd5e1', borderRadius:4, padding:'2px 4px', background:'rgba(255,255,255,0.9)'}} />
          </div>
          {/* right */}
          <div style={{width:'62mm', border:'1px solid #14532d', borderRadius:10, overflow:'hidden', background:'white', flexShrink:0}}>
            <div style={{background:'#14532d', color:'white', fontWeight:900, textAlign:'center', padding:'4px 0', fontSize:13, lineHeight:1}}>অ্যাপ ফিচারসমূহ</div>
            <div style={{padding:'6px 7px', background:'#f0fdf4', fontSize:10.5, lineHeight:1.2, borderTop:'1px solid #14532d', display:'flex', flexDirection:'column', gap:6}}>
              {features.map((t,i)=> (
                <div key={i} style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:18, height:18, borderRadius:'50%', background:'#14532d', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0}}>✓</span><input value={t} onChange={e=> updateFeature(i,e.target.value)} style={{flex:1, border:'1px solid #bbf7d0', borderRadius:4, padding:'2px 4px', fontSize:10.5, background:'white'}} /></div>
              ))}
            </div>
          </div>
        </div>

        <div style={{marginTop:6, display:'flex', alignItems:'center', gap:10, position:'relative', zIndex:1}}>
          <span style={{flex:1, height:1.5, background:'#14532d'}}></span>
          <span style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
            <input value={mapTitle} onChange={e=> setMapTitle(e.target.value)} style={{fontSize:13, fontWeight:900, color:'#052e16', textAlign:'center', border:'1px solid #bbf7d0', borderRadius:4, padding:'2px 8px', background:'white'}} />
            <input value={northText} onChange={e=> setNorthText(e.target.value)} style={{fontSize:11, fontWeight:700, color:'#475569', textAlign:'center', border:'1px solid #e2e8f0', borderRadius:4, padding:'1px 8px', background:'white'}} />
          </span>
          <span style={{flex:1, height:1.5, background:'#14532d'}}></span>
        </div>

        <div style={{marginTop:6, flex:1, display:'flex', flexDirection:'column', position:'relative', zIndex:1, minHeight:0}}>
          <div style={{flex:1, border:'1px solid #334155', background:'white', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', minHeight:0, height:'165mm'}}>
            <div style={{position:'absolute', top:6, left:'50%', transform:'translateX(-50%)', zIndex:2, display:'flex', flexDirection:'column', alignItems:'center'}}>
              <span style={{fontSize:14, fontWeight:900, lineHeight:1}}>N</span>
              <div style={{width:0, height:0, borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderBottom:'13px solid black', marginTop:-2}}></div>
              <div style={{width:2, height:22, background:'black', marginTop:-1}}></div>
            </div>
            <svg viewBox={`${bounds.minX} ${bounds.minY} ${bounds.maxX-bounds.minX} ${bounds.maxY-bounds.minY}`} preserveAspectRatio="xMidYMid meet" style={{width:'100%', height:'100%', display:'block'}}>
              <rect x={bounds.minX} y={bounds.minY} width={bounds.maxX-bounds.minX} height={bounds.maxY-bounds.minY} fill="white"/>
              {plots.length? plots.map((pl:any,idx:number)=>{
                const ptsStr=pl.pts.map((q:any)=> `${q.x},${q.y}`).join(' ');
                const meta=plotMetas.find(m=> m.id===pl.id);
                return <g key={pl.id}>
                  <polygon points={ptsStr} fill="#f6fef7" stroke="black" strokeWidth={1.2} />
                  {pl.pts.map((pt:any,i:number)=>{
                    const nxt=pl.pts[(i+1)%pl.pts.length];
                    const mx=(pt.x+nxt.x)/2, my=(pt.y+nxt.y)/2;
                    const len=pl.sides[i]; const txt=len? `${Number(len).toFixed(2)}` : '';
                    if(!txt) return null;
                    const ang=Math.atan2(nxt.y-pt.y, nxt.x-pt.x)*180/Math.PI;
                    return <text key={i} x={mx} y={my} fontSize={4.5} fill="#1e3a8a" textAnchor="middle" transform={`rotate(${ang},${mx},${my})`}>{txt}</text>;
                  })}
                  <text x={pl.cx} y={pl.cy-3} fontSize={6.5} fontWeight={800} fill="#991b1b" textAnchor="middle">{meta?.dagNo || `${456+idx}`}</text>
                  <text x={pl.cx} y={pl.cy+5} fontSize={6} fontWeight={700} fill="#b91c1c" textAnchor="middle">{tafsils[idx]?.dec || '—'} শতাংশ</text>
                </g>;
              }) : (drawing?.segments||[]).map((sg:any)=> <line key={sg.id} x1={sg.x1} y1={sg.y1} x2={sg.x2} y2={sg.y2} stroke="black" strokeWidth={0.9}/>)}
            </svg>
            <div style={{position:'absolute', left:6, bottom:6, background:'#f0fdf4', border:'1px solid #14532d', borderRadius:8, padding:'6px 8px', fontSize:9, lineHeight:1.3, minWidth:92}}>
              <div style={{fontWeight:900, textAlign:'center', color:'#14532d'}}>লেজেন্ড</div>
              <div style={{marginTop:4, display:'flex', alignItems:'center', gap:6}}><span style={{width:28, height:2, background:'black', display:'block'}}></span><span>দাগ সীমানা</span></div>
              <div style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:28, textAlign:'center', fontWeight:700, color:'#b91c1c'}}>৪৫৬</span><span>দাগ নম্বর</span></div>
              <div style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:28, textAlign:'center', color:'#1e40af'}}>25.60</span><span>দৈর্ঘ্য (মিটার)</span></div>
            </div>
            <div style={{position:'absolute', right:6, bottom:6, background:'#f0fdf4', border:'1px solid #14532d', borderRadius:8, padding:'6px 10px', textAlign:'center', minWidth:110}}>
              <div style={{fontSize:10, fontWeight:700, color:'#14532d'}}>মোট জমির পরিমাণ</div>
              <div style={{fontSize:13, fontWeight:900, color:'#b91c1c'}}>{totalDec} শতাংশ</div>
            </div>
          </div>
          <div style={{marginTop:4, borderTop:'1px solid #14532d', paddingTop:4, display:'flex', justifyContent:'space-between', gap:6, fontSize:9}}>
            <textarea value={footerLeft} onChange={e=> setFooterLeft(e.target.value)} rows={2} style={{flex:1, fontSize:9, lineHeight:1.3, border:'1px solid #cbd5e1', borderRadius:4, padding:4, background:'white', resize:'none', textAlign:'center'}} />
            <textarea value={footerMid} onChange={e=> setFooterMid(e.target.value)} rows={1} style={{flex:1, fontSize:9, border:'1px solid #cbd5e1', borderRadius:4, padding:4, background:'white', resize:'none', textAlign:'center'}} />
            <textarea value={footerRight} onChange={e=> setFooterRight(e.target.value)} rows={2} style={{flex:1, fontSize:9, lineHeight:1.3, border:'1px solid #cbd5e1', borderRadius:4, padding:4, background:'white', resize:'none', textAlign:'center'}} />
          </div>
          {/* D: QR Verify + Amin Sign — hassle-free 1-click professional */}
          <div style={{marginTop:6, display:'flex', gap:8, alignItems:'center', justifyContent:'space-between', border:'1px solid #14532d', borderRadius:8, padding:'6px 10px', background:'#f8fafc'}}>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <div style={{width:64, height:64, border:'1px solid #14532d', background:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:700, textAlign:'center', lineHeight:1.1, padding:2}}>
                <div style={{width:44, height:44, background:'repeating-linear-gradient(0deg, #111 0 2px, #fff 2px 4px), repeating-linear-gradient(90deg, #111 0 2px, #fff 2px 4px)', border:'1px solid #111', display:'flex', alignItems:'center', justifyContent:'center', fontSize:6, color:'white', textShadow:'0 0 2px black'}}>QR</div>
                <div style={{fontSize:6, marginTop:2, lineHeight:1}}>{report.reportNumber}</div>
              </div>
              <div style={{fontSize:9, lineHeight:1.4}}>
                <div style={{fontWeight:900, color:'#14532d'}}>যাচাই QR</div>
                <div style={{fontSize:8, fontWeight:700}}>{report.reportNumber}</div>
                <div style={{color:'#64748b', fontSize:8}}>{report.reportDate} • bhumi-o-amin.vercel.app/r/{report.id.slice(0,8)}</div>
                <div style={{fontSize:7, color:'#94a3b8'}}>Scan to verify</div>
              </div>
            </div>
            <div style={{textAlign:'center', fontSize:9, minWidth:130}}>
              <div style={{height:28, borderBottom:'1px solid #334155', minWidth:120, marginBottom:4, display:'flex', alignItems:'flex-end', justifyContent:'center', fontSize:8, color:'#334155', fontStyle:'italic'}}>{report.surveyorName || 'মেহেদী হাসান বাবু'}</div>
              <div style={{fontWeight:700, color:'#14532d', fontSize:9}}>আমিন / সার্ভেয়ার স্বাক্ষর</div>
              <div style={{fontSize:7, color:'#64748b'}}>সনদপ্রাপ্ত আমিন • ভূমি ও আমিন</div>
            </div>
          </div>
          <div style={{textAlign:'center', fontSize:9, marginTop:4, fontWeight:500}}>পৃষ্ঠা ১ / ২</div>
        </div>
      </div>

      {/* PAGE 2 */}
      <div className="a4-page" style={{width:'210mm', height:'297mm', minHeight:'297mm', maxHeight:'297mm', padding:'4mm', boxSizing:'border-box', border:'2px solid #14532d', background:'white', position:'relative', overflow:'hidden', pageBreakAfter:'auto', breakAfter:'auto', pageBreakInside:'avoid', breakInside:'avoid', display:'flex', flexDirection:'column'}}>
        <span style={{position:'absolute', top:3, left:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>
        <span style={{position:'absolute', top:3, right:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>
        <span style={{position:'absolute', bottom:3, left:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>
        <span style={{position:'absolute', bottom:3, right:3, width:10, height:10, background:'#14532d', transform:'rotate(45deg)', border:'1px solid white'}}></span>

        <div style={{borderBottom:'2px solid #14532d', paddingBottom:6, textAlign:'center', position:'relative', zIndex:1}}>
          <div style={{fontSize:13, fontWeight:900, color:'#052e16'}}>মালিকগণের বিবরণ</div>
          <div style={{fontSize:9, color:'#64748b'}}>নাম • পিতা • ঠিকানা • দলিল • খতিয়ান • দাগ • শতাংশ — সব ঘর এডিট করুন</div>
        </div>

        <div style={{marginTop:10, position:'relative', zIndex:1}}>
          <table style={{width:'100%', fontSize:11, borderCollapse:'collapse', border:'1px solid #1e293b'}}>
            <thead style={{background:'#14532d', color:'white'}}><tr><th style={{border:'1px solid #334155', padding:'6px 4px'}}>ক্র.</th><th style={{border:'1px solid #334155', padding:'6px 4px'}}>নাম</th><th style={{border:'1px solid #334155', padding:'6px 4px'}}>পিতা</th><th style={{border:'1px solid #334155', padding:'6px 4px'}}>ঠিকানা</th><th style={{border:'1px solid #334155', padding:'6px 4px'}}>দলিল নং</th><th style={{border:'1px solid #334155', padding:'6px 4px'}}>খতিয়ান</th><th style={{border:'1px solid #334155', padding:'6px 4px'}}>দাগ</th><th style={{border:'1px solid #334155', padding:'6px 4px'}}>শতাংশ</th></tr></thead>
            <tbody>
              {owners.map((r,i)=>(
                <tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}><td style={{border:'1px solid #cbd5e1', padding:4, textAlign:'center', fontWeight:700}}>{i+1}</td>
                  <td style={{border:'1px solid #cbd5e1', padding:2}}><input value={r.name} onChange={e=> updateOwner(i,{name:e.target.value})} placeholder="নাম" style={{width:'100%', fontSize:11, padding:2, border:'none', background:'transparent'}}/></td>
                  <td style={{border:'1px solid #cbd5e1', padding:2}}><input value={r.father} onChange={e=> updateOwner(i,{father:e.target.value})} placeholder="পিতা" style={{width:'100%', fontSize:11, padding:2, border:'none', background:'transparent'}}/></td>
                  <td style={{border:'1px solid #cbd5e1', padding:2}}><input value={r.address} onChange={e=> updateOwner(i,{address:e.target.value})} placeholder="ঠিকানা" style={{width:'100%', fontSize:11, padding:2, border:'none', background:'transparent'}}/></td>
                  <td style={{border:'1px solid #cbd5e1', padding:2}}><input value={r.deed} onChange={e=> updateOwner(i,{deed:e.target.value})} placeholder="দলিল" style={{width:'100%', fontSize:11, padding:2, border:'none', background:'transparent'}}/></td>
                  <td style={{border:'1px solid #cbd5e1', padding:2}}><input value={r.khatian} onChange={e=> updateOwner(i,{khatian:e.target.value})} placeholder="খতিয়ান" style={{width:'100%', fontSize:11, padding:2, border:'none', background:'transparent'}}/></td>
                  <td style={{border:'1px solid #cbd5e1', padding:2}}><input value={r.dag} onChange={e=> updateOwner(i,{dag:e.target.value})} placeholder="দাগ" style={{width:'100%', fontSize:11, padding:2, border:'none', background:'transparent'}}/></td>
                  <td style={{border:'1px solid #cbd5e1', padding:2}}><input value={r.percent} onChange={e=> updateOwner(i,{percent:e.target.value})} placeholder="শতাংশ" style={{width:'100%', fontSize:11, padding:2, border:'none', background:'transparent'}}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:10, flex:1, position:'relative', zIndex:1, minHeight:0}}>
          <div style={{border:'1px solid #14532d', borderRadius:8, overflow:'hidden'}}>
            <div style={{background:'#14532d', color:'white', fontSize:11, fontWeight:700, padding:'6px 10px'}}>জমি কেনা-বেচার তথ্য</div>
            <textarea value={purchase} onChange={e=> setPurchase(e.target.value)} placeholder="প্রতি লাইনে একটি তথ্য লিখুন (প্রিন্টে সুন্দর দেখাবে)" style={{width:'100%', minHeight:62, padding:8, fontSize:12, border:'none', lineHeight:1.8, resize:'none'}}/>
          </div>
          <div style={{border:'1px solid #14532d', borderRadius:8, overflow:'hidden'}}>
            <div style={{background:'#14532d', color:'white', fontSize:11, fontWeight:700, padding:'6px 10px'}}>আপোষ মীমাংসার তথ্য</div>
            <textarea value={compromise} onChange={e=> setCompromise(e.target.value)} placeholder="প্রতি লাইনে একটি তথ্য লিখুন" style={{width:'100%', minHeight:62, padding:8, fontSize:12, border:'none', lineHeight:1.8, resize:'none'}}/>
          </div>
          <div style={{border:'1px solid #cbd5e1', borderRadius:8, padding:8}}>
            <div style={{fontSize:11, fontWeight:700}}>মন্তব্য:</div>
            <textarea value={comments} onChange={e=> setComments(e.target.value)} placeholder="মন্তব্য লিখুন..." style={{width:'100%', minHeight:44, fontSize:12, padding:4, border:'1px solid #cbd5e1', borderRadius:4, resize:'none'}}/>
          </div>
        </div>

        <div style={{marginTop:'auto', paddingTop:12, borderTop:'2px solid #14532d', position:'relative', zIndex:1}}>
          <div style={{display:'flex', gap:24, fontSize:11}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:900, color:'#14532d', marginBottom:6, borderBottom:'1px solid #14532d', paddingBottom:4}}>পক্ষগণের স্বাক্ষর</div>
              {[1,2,3,4].map(i=>(
                <div key={i} style={{padding:'10px 0', borderBottom:'1px dotted #94a3b8'}}> {i}. নাম: __________ &nbsp; পিতা: __________ &nbsp; ঠিকানা: __________ </div>
              ))}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:900, color:'#14532d', marginBottom:6, borderBottom:'1px solid #14532d', paddingBottom:4}}>সাক্ষীগণের স্বাক্ষর</div>
              {[1,2,3,4].map(i=>(
                <div key={i} style={{padding:'10px 0', borderBottom:'1px dotted #94a3b8'}}> {i}. নাম: __________ &nbsp; পিতা: __________ &nbsp; ঠিকানা: __________ </div>
              ))}
            </div>
          </div>
          <div style={{marginTop:10, fontSize:8.5, color:'#334155', border:'1px solid #14532d', padding:8, background:'#f0fdf4', borderRadius:6, textAlign:'center'}}>এই প্রতিবেদন আনুমানিক ও সহায়ক। সরকারি সার্ভে / নামজারি / আদালতের জন্য নিবন্ধিত সার্ভেয়ারের যাচাই আবশ্যক।</div>
          <div style={{textAlign:'center', fontSize:9, marginTop:6, fontWeight:500}}>পৃষ্ঠা ২ / ২</div>
        </div>
      </div>

      <style>{`
        @page { size: A4 portrait; margin: 0; }
        html, body { margin:0; padding:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #report-printable-area { width: 210mm; font-family: 'Noto Sans Bengali', sans-serif !important; font-synthesis: none; }
        #report-printable-area * { font-family: 'Noto Sans Bengali', sans-serif !important; font-synthesis: none; }
        .print-hidden { display:flex; }
        @media screen and (max-width: 820px) {
          #report-printable-area { max-width: 100vw; }
        }
        @media print {
          #report-printable-area { zoom: 1 !important; transform: none !important; }
          .print-hidden { display: none !important; }
          .a4-page { box-shadow:none !important; border: 2px solid #14532d !important; }
          input, textarea { -webkit-appearance: none; appearance: none; border: 1px solid transparent !important; background: transparent !important; box-shadow: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
    </div>
  );
};
