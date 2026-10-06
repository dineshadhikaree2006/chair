'use client';
import { useEffect, useRef, useState } from 'react';
import { demos } from '@/lib/demos';
import { Certificate } from '@/components/Certificate';
import { Confetti } from '@/components/Confetti';
import type { CertificateData } from '@/lib/certificate';
import { fileError, reportSchema, appealResponseSchema, type Report } from '@/lib/report';
const messages = ['Consulting the Department of Sitting…', 'Cross-examining the alleged legs…', 'Misinterpreting the evidence with confidence…'];
type Appeal = { objection: string; response: string; conceded: boolean; failed?: boolean };
const victoryMessage = 'Took you a minute, but welcome to furniture science.';
export default function Home() {
 const [file,setFile]=useState<File|null>(null), [preview,setPreview]=useState(''), [demo,setDemo]=useState<typeof demos[number]|null>(null), [report,setReport]=useState<Report|null>(null), [error,setError]=useState(''), [busy,setBusy]=useState<'inspect'|'appeal'|null>(null), [drag,setDrag]=useState(false), [objection,setObjection]=useState(''), [history,setHistory]=useState<Appeal[]>([]), [step,setStep]=useState(0);
 // Retain failed submissions in the visible debate; only acknowledged turns go back to the server.
 const [conversation, setConversation] = useState<Appeal[]>([]);
 const [caseId,setCaseId]=useState('');
 const [certificate, setCertificate] = useState<CertificateData | null>(null);
 const [pendingObjection, setPendingObjection] = useState('');
 const [detectionUnavailable, setDetectionUnavailable] = useState(false);
 // A synchronous guard makes acceptance atomic even before React renders again.
 const accepted = useRef<CertificateData | null>(null);
 const acceptedPendingTurn = useRef<number | null>(null);
 const pendingTurn = useRef<number | null>(null);
 const certificateSection = useRef<HTMLElement>(null);
 const input=useRef<HTMLInputElement>(null), controller=useRef<AbortController|null>(null), locked=useRef(false), epoch=useRef(0), result=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{ if(!file){setPreview('');return;} const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url); },[file]);
 useEffect(()=>{ if(!busy)return; const id=setInterval(()=>setStep(s=>(s+1)%messages.length),1800);return()=>clearInterval(id); },[busy]);
 useEffect(()=>{if(report)result.current?.focus();},[report]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const certificateId = certificate?.id;
 useEffect(() => {
  if (!certificateId) return;
  const section = certificateSection.current;
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
 }, [certificateId]);
 function acceptInspection(objections: number, pending: number | null = null) {
  if (!report || accepted.current) return;
  const next: CertificateData = {
   id: `BCA-${crypto.randomUUID()}`,
   issuedAt: new Date().toISOString(),
   objections,
   report,
   imageUrl: demo ? '' : preview,
   demo: demo ? { name: demo.name, glyph: demo.glyph } : null,
  };
  accepted.current = next;
  acceptedPendingTurn.current = pending;
  setCertificate(next);
 }
 function surrender() {
  acceptInspection(conversation.length + (pendingTurn.current === null ? 0 : 1), pendingTurn.current);
 }
 function reset(){accepted.current=null;acceptedPendingTurn.current=null;pendingTurn.current=null;setCertificate(null);setPendingObjection('');setDetectionUnavailable(false);if(caseId)void fetch('/api/appeal',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId})}).catch(()=>{});setCaseId('');epoch.current++;controller.current?.abort();locked.current=false;setBusy(null);setFile(null);setDemo(null);setReport(null);setHistory([]);setConversation([]);setObjection('');setError('');if(input.current)input.current.value='';}
 function choose(files: FileList|null){if(!files?.length)return; const selected=files[0];reset();if(files.length>1){setError('One suspect at a time. Choose a single image.');return;} const issue=fileError(selected);if(issue){setError(issue);return;}setFile(selected);}
 async function inspect(){if(!file||locked.current)return;locked.current=true;setBusy('inspect');setError('');const token=epoch.current;const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),55000);try{const data=new FormData();data.append('image',file);const response=await fetch('/api/inspect',{method:'POST',body:data,signal:abort.signal});const body=await response.json();if(!response.ok)throw new Error(body.error||'Inspection failed. Please retry.');if(token===epoch.current){setReport(reportSchema.parse(body.report));setCaseId(body.caseId);}}catch(e){if(token===epoch.current)setError(e instanceof Error&&e.name==='AbortError'?'Inspection timed out. Please retry.':e instanceof Error?e.message:'Inspection failed. Please retry.');}finally{clearTimeout(timeout);if(token===epoch.current){locked.current=false;setBusy(null);}}}
 async function appeal() {
  if (!report || locked.current || !objection.trim() || history.length >= 20) return;
  locked.current = true;
  const submitted = objection.trim();
  const turn = history.length;
  const objectionsBefore = conversation.length;
  pendingTurn.current = turn;
  setPendingObjection(submitted);
  setBusy('appeal');
  setError('');
  const token = epoch.current;
  const abort = new AbortController();
  controller.current = abort;
  const timeout = setTimeout(() => abort.abort(), 55000);
  try {
   const payload = demo
    ? { demoId: demo.id, objection: submitted, turn, history: history.map(({ objection, response }) => ({ objection, response })) }
    : { caseId, objection: submitted, turn };
   const res = await fetch('/api/appeal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: abort.signal,
   });
   const body = await res.json();
   if (!res.ok) throw new Error(body.error || 'The appeal could not be filed. Please retry.');
   const answer = appealResponseSchema.parse(body);
   if (token !== epoch.current) return;
   const entry = { objection: submitted, response: answer.response, conceded: answer.conceded };
   setHistory(h => [...h, entry]);
   setConversation(h => [...h, entry]);
   setObjection('');
   setDetectionUnavailable(answer.concessionDetection === 'unavailable');
   if (answer.conceded) {
    // If the button won a race with this request, correct its pending-turn count
    // using the structured result while retaining the same certificate and celebration.
    if (accepted.current && acceptedPendingTurn.current === turn) {
     const corrected = { ...accepted.current, objections: accepted.current.objections - 1 };
     accepted.current = corrected;
     acceptedPendingTurn.current = null;
     setCertificate(corrected);
    }
    acceptInspection(objectionsBefore);
   }
  } catch (e) {
   if (token === epoch.current) {
    const message = e instanceof Error && e.name === 'AbortError' ? 'Appeal timed out. Please retry.' : e instanceof Error ? e.message : 'Appeal failed. Please retry.';
    setError(message);
    setConversation(h => [...h, { objection: submitted, response: message, conceded: false, failed: true }]);
   }
  } finally {
   clearTimeout(timeout);
   if (token === epoch.current) {
    locked.current = false;
    pendingTurn.current = null;
    acceptedPendingTurn.current = null;
    setPendingObjection('');
    setBusy(null);
   }
  }
 }
 return <><header><a className="brand" href="/" aria-label="Bureau of Chair Affairs home"><span className="seal">B<br/>CA</span><span>BUREAU OF<br/>CHAIR AFFAIRS</span></a><span className="header-note"><i/> DEPARTMENT OF QUESTIONABLE SEATING</span><span className="edition">EST. FIVE MINUTES AGO</span></header>
 <main><div className="intro"><div><div className="eyebrow">OFFICIAL OBJECT INSPECTION · FORM 01-SIT</div><h1>Is this a <span>chair?</span></h1><p>Upload an object. Receive a wildly confident verdict.<br/>Our authority is absolute. Our reasoning is not.</p></div><div className="round-stamp">100%<small>UNQUALIFIED<br/>TO DISAGREE</small></div></div>
 <div className="workspace"><section className="panel specimen"><div className="panel-heading"><span><b>01</b> THE SUSPECT</span><span>VISUAL EVIDENCE</span></div>
 {!file&&!demo?<><div className={`dropzone ${drag?'drag':''}`} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files);}}><div className="upload-icon" aria-hidden="true">↥</div><h2>Submit your suspect.</h2><p>Drop an image here.<br/>Yes, even that thing.</p><button className="primary" onClick={()=>input.current?.click()}>Choose an image <span>↗</span></button><small>JPEG, PNG OR WEBP · UP TO 10 MB</small></div><div className="demo-section"><div className="eyebrow">NO PHOTO? OPEN A SAMPLE CASE.</div><div className="demo-grid">{demos.map(d=><button key={d.id} onClick={()=>{reset();setDemo(d);setReport(d.report);}}><span aria-hidden="true">{d.glyph}</span><strong>{d.name}</strong><small>Scripted demo ↗</small></button>)}</div></div></>:<><div className="evidence-stage">{demo?<div className="sample-card"><span className="eyebrow">SCRIPTED DEMO · TEXT SAMPLE CARD</span><span className="sample-glyph" aria-hidden="true">{demo.glyph}</span><h2>{demo.name}</h2><p>{demo.subtitle}</p><small>No photograph analyzed.</small></div>:<div className="image-wrap"><img src={preview||undefined} alt="Uploaded object submitted for inspection" onError={()=>{setError('This image could not be decoded. Choose a valid JPEG, PNG, or WebP.');setFile(null);}}/>{report?.evidence.map((e,i)=><span className="marker" key={i} style={{left:`${e.x*100}%`,top:`${e.y*100}%`}} title={`${i+1}. ${e.label}`}>{i+1}</span>)}{busy==='inspect'&&<div className="scan"/>}</div>}</div><div className="image-caption"><span>{demo?'EXHIBIT A · SAMPLE CASE':'EXHIBIT A · UPLOADED PHOTO'}</span><span>{report?'INSPECTED ✓':'AWAITING INSPECTION'}</span></div><div className="specimen-actions">{!report&&<button className="primary" disabled={!!busy} onClick={inspect}>{busy?'Inspection in progress…':'Inspect this object'} <span>→</span></button>}<button className="secondary" onClick={reset}>{busy?'Cancel & reset':'Inspect another'} ↺</button></div></>}
 <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload image" onChange={e=>choose(e.target.files)}/><p className="privacy">Photos stay in memory. Real inspections send your image to Gemini.<br/>Demo cases need no API key.</p></section>
 <section className={`panel report ${report?'complete':''}`} aria-label="Inspection report"><div className="panel-heading"><span><b>02</b> THE OFFICIAL FINDINGS</span><span>{demo?'SCRIPTED DEMO':'BCA / SEATING DIVISION'}</span></div>{report?<div className="report-body"><div className="report-meta"><span>{demo?'Scripted demo':'AI inspection'}</span>{certificate&&<span className="conceded-badge">INSPECTION CONCEDED</span>}<span>CASE {demo?`D-${demo.id.toUpperCase()}`:'01-SIT'}</span></div><h2 tabIndex={-1} ref={result} className={`verdict ${report.verdict==='NOT A CHAIR'?'negative':''}`}>{report.verdict}<span>OFFICIALLY {report.verdict==='CHAIR'?'CERTIFIED':'SUSPICIOUS'}</span></h2><div className="classification"><span className="eyebrow">BUREAU CLASSIFICATION</span><h3>{report.classification}</h3><p>{report.explanation}</p></div><div className="confidence"><div><strong>Chair confidence</strong><b>{report.confidence}%</b></div><div className="meter"><span style={{width:`${report.confidence}%`}}/></div><small>Completely fictional. Scientifically indefensible.</small></div><div className="eyebrow">THREE PIECES OF “EVIDENCE”</div><ol className="evidence-list">{report.evidence.map((e,i)=><li key={i}><b>{i+1}</b><div><strong>{e.label}</strong><p>{e.explanation}</p></div></li>)}</ol><div className="appeals"><h3>Disagree? How charming.</h3><p>The bureau accepts appeals. Emotionally, it does not.</p>{conversation.map((h,i)=><div className="appeal-response" key={i}><span className="eyebrow">APPEAL {i+1} · {h.failed?'NOT PROCESSED':h.conceded?'VERDICT ACCEPTED':demo?'SCRIPTED DEMO':'VERDICT UPHELD'}</span><p><strong>You:</strong> {h.objection}</p><p><strong>{h.failed?'Notice:':'Inspector:'}</strong> {h.response}</p></div>)}{pendingObjection&&<div className="appeal-response pending" aria-busy="true"><span className="eyebrow">APPEAL PENDING</span><p><strong>You:</strong> {pendingObjection}</p><p>Consulting the inspector…</p></div>}
 {certificate&&<section className="surrender-result" aria-label="Certificate" data-testid="certificate-section" tabIndex={-1} ref={certificateSection}>
  <p className="victory-message" role="status">{victoryMessage}</p>
  <Confetti key={certificate.id}/>
  <Certificate certificate={certificate} finalizing={acceptedPendingTurn.current !== null && busy === 'appeal'}/>
 </section>}
 <button type="button" className="primary surrender-button" onClick={surrender}>🏳️ Surrender — fine, it’s {report.verdict==='NOT A CHAIR'?'not a chair':'a chair'}.</button>
 {demo&&<p className="demo-chat-note">Sample replies are scripted. Chat concessions use Gemini when configured; the surrender button always works without it.</p>}
 {detectionUnavailable&&<p role="status" className="demo-chat-note">Gemini is not configured for this demo. Use the surrender button to accept the verdict.</p>}
 {history.length<20?<form onSubmit={e=>{e.preventDefault();void appeal();}}><label htmlFor="objection">{certificate?'Still disagree? Keep arguing.':'Your objection'}</label><textarea id="objection" maxLength={500} value={objection} onChange={e=>setObjection(e.target.value)} placeholder="But it’s clearly a sandwich…" disabled={!!busy}/><button className="secondary" disabled={!!busy||!objection.trim()}>{busy==='appeal'?'Stamping your objection…':'Appeal verdict'} ↗</button></form>:<p>The appeals cabinet is full. Inspect another object to open a new case.</p>}</div></div>:<div className="empty-report"><div className="outline-chair" aria-hidden="true"><div/><i/><b/></div><span className="eyebrow">VERDICT PENDING</span><h2>Every object has<br/>something to sit for.</h2><p>Submit a photo or open a sample case.<br/>We’ll take it from there. With undue confidence.</p><div className="rubber-stamp">TRUST THE BUREAU*</div><small>*The bureau has no relevant qualifications.</small></div>}</section></div>
 <div role="status" aria-live="polite" className={busy?'status active':'status'}>{busy&&<>{messages[step]} <small>Just a little bureaucratic theater while you wait.</small></>}</div>{error&&<div className="error" role="alert">{error}</div>}<footer><span>© BUREAU OF CHAIR AFFAIRS</span><strong>For comedy. Not actual seating advice.</strong><span>PLEASE REMAIN SEATED. OR DON’T.</span></footer></main></>;
}
