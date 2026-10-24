import { db, transaction, getDocuments, getDocument, getRecoveryDocuments, getPrograms, saveDocument } from './store.mjs';
import { parseDocument, saveDocumentStatus } from './ingest.mjs';
import { openAIConfig } from './openai-config.mjs';
import { extractDocumentRules } from './document-ai.mjs';
import { buildDocumentReview,refreshReviewValidation } from './document-organizer.mjs';
import { cloudPDFEnabled } from './cloud-pdf.mjs';
import { educationImportVocabulary } from '../public/education-catalog.js';

export const activeDocumentStates = new Set(['queued','parsing','extracting']);
export function emptyManualDraft(draft){
 if(!draft||draft.target?.mode!=='create'||draft.program?.id||draft.note?.trim())return false;
 const p=draft.program;
 return ['paths','hardConditions','language','waivers','rounds','materials','requirements'].every(key=>Array.isArray(p[key])&&!p[key].length)
  &&p.tuition?.status==='unspecified'&&p.interview?.status==='unspecified'&&p.academicTests?.status==='unspecified'
  &&p.combination?.parallel==='unspecified'&&p.combination?.reapply==='unspecified'&&!p.languagePolicy?.validYears;
}

// One durable queue serves uploads, retries and restarts. Text extraction is
// reused after model failures; a repeated request cannot start a second job.
export function createDocumentWorkflow({ documents=getDocuments, programs=getPrograms,
  parse=parseDocument, saveStatus=saveDocumentStatus, config=openAIConfig,
  extract=extractDocumentRules, organize=buildDocumentReview, saveProgress=saveDocument, retryDelay=2000,
  document=id=>documents===getDocuments?getDocument(id):Promise.resolve(documents()).then(rows=>rows.find(d=>d.id===id)),
  recoveryDocuments=documents===getDocuments?getRecoveryDocuments:documents,
  withLease=(id,fn)=>db.withLease('document:'+id,fn), mutate=transaction,
  canProcess=doc=>process.env.DOCUMENT_WORKER!=='disabled'&&(db.kind!=='postgres'||parse!==parseDocument||Boolean(doc.text?.trim())||!doc.filename?.toLowerCase().endsWith('.pdf')||cloudPDFEnabled()||Boolean(process.env.MINERU_BIN)) }={}) {
 const queue=new Map();let running=false,activeId=null;
 async function enqueue(id,actor,{feedback='',expectedReviewVersion,resume=false}={}) {
  return mutate(async()=>{
  const doc=await document(id);
  if(!doc||doc.builtin)throw Object.assign(new Error('请选择上传文件'),{status:404});
  if(doc.status==='published')throw Object.assign(new Error('本文件已确认入库；更新要求请上传新文件'),{status:409});
  if(activeId===id||queue.has(id))return doc;
  if(activeDocumentStates.has(doc.status)&&!resume)return doc;
  // Another instance may already be processing it. Scheduling a recovery must
  // not replace its durable status, feedback, retry count or saved progress.
  if(activeDocumentStates.has(doc.status)&&resume){if(canProcess(doc)){queue.set(id,doc.requestedBy||actor);setImmediate(drain);}return doc;}
  if(expectedReviewVersion!==undefined&&doc.autoReview?.version!==expectedReviewVersion)throw Object.assign(new Error('整理结果已更新，请重新打开后提交核对意见'),{status:409});
  if(doc.projectDraft){
   if(!emptyManualDraft(doc.projectDraft))throw Object.assign(new Error('此文件已有人工保存的规则，请先完成该草稿；不会覆盖已有修改'),{status:409});
   doc.previousManualDraft=doc.projectDraft;delete doc.projectDraft;
  }
  doc.reviewerFeedback=String(feedback||doc.reviewerFeedback||'').slice(0,12000);
  if(/单次模型输出上限/.test(doc.error||''))doc.analysis={...doc.analysis,organizationMode:'by-program'};
  doc.requestedBy=actor;doc.workflowVersion=2;doc.autoRetryCount=0;doc.organizingProgress=null;await saveStatus(doc,'queued',actor);
  if(canProcess(doc)){queue.set(id,actor);setImmediate(drain);}
  return doc;
  });
 }
 async function drain() {
  if(running)return;running=true;
  try { while(queue.size) {
   const [id,actor]=queue.entries().next().value;queue.delete(id);activeId=id;
   const lease=await withLease(id,async()=>{
   const doc=await document(id);if(!doc||!activeDocumentStates.has(doc.status)||!canProcess(doc))return;
   let progressSaved=Promise.resolve();
   try {
    if(!doc.text?.trim())await parse(doc,actor);
    if(['error','needs_configuration'].includes(doc.status))return;
    const connection=await config();
    if(!connection.apiKey){await saveStatus(doc,'needs_configuration',actor);return;}
    await saveStatus(doc,'extracting',actor);
    let lastProgress=0;
    const onProgress=progress=>{if(Date.now()-lastProgress<15000)return;lastProgress=Date.now();doc.organizingProgress=progress;doc.statusVersion=(doc.statusVersion||0)+1;const snapshot=structuredClone(doc);progressSaved=progressSaved.then(()=>saveProgress(snapshot));progressSaved.catch(()=>{});};
    const onCheckpoint=async cache=>{doc.analysis={...doc.analysis,organizationMode:'by-program',organization:structuredClone(cache)};doc.statusVersion=(doc.statusVersion||0)+1;const snapshot=structuredClone(doc);progressSaved=progressSaved.then(()=>saveProgress(snapshot));await progressSaved;};
    const result=await extract(doc,connection,{feedback:doc.reviewerFeedback,educationCatalogue:educationImportVocabulary(await programs()),onProgress,onCheckpoint});
    await progressSaved;
    doc.autoReview=organize(result.extracted,doc,await programs(),{model:result.model,usage:result.usage});
    if(doc.analysis?.organization)delete doc.analysis.organization;
    doc.organizedAt=new Date().toISOString();
    await saveStatus(doc,'review',actor);
   } catch(error) {
    await progressSaved.catch(()=>{});
    if(error.retryable&&(doc.autoRetryCount||0)<1){doc.autoRetryCount=(doc.autoRetryCount||0)+1;await saveStatus(doc,'queued',actor);queue.set(id,actor);await new Promise(resolve=>setTimeout(resolve,retryDelay));}
    else await saveStatus(doc,'error',actor,error.message||'自动整理未完成，原文件已保留');
   }
   finally {activeId=null;}
   });
   if(!lease.acquired){queue.set(id,actor);await new Promise(resolve=>setTimeout(resolve,retryDelay));}
  }} catch(error){console.error('Document queue interrupted:',error.code||error.name);if(activeId)queue.set(activeId,'系统');const retry=setTimeout(drain,retryDelay);retry.unref?.();}finally {running=false;activeId=null;}
 }
 async function resumePending({includeLegacy=false}={}) {
  const candidates=(await recoveryDocuments()).filter(doc=>!doc.builtin&&doc.status!=='published'&&(!doc.projectDraft||emptyManualDraft(doc.projectDraft)));
  if(!candidates.length)return;
  const ready=Boolean((await config()).apiKey),currentPrograms=await programs();
  for(const candidate of candidates) {await mutate(async()=>{
   const doc=await document(candidate.id);if(!doc)return;
   if(doc.builtin||doc.projectDraft&&!emptyManualDraft(doc.projectDraft)||doc.status==='published')return;
   const refreshed=doc.status==='review'?refreshReviewValidation(doc,currentPrograms):null;
   if(refreshed){doc.previousAutoReview=doc.autoReview;doc.autoReview=refreshed;await saveStatus(doc,'review','系统');}
   const interrupted=activeDocumentStates.has(doc.status);
   const waiting=doc.status==='needs_configuration'&&ready;
   const legacy=includeLegacy&&!doc.autoReview&&doc.status==='review'&&doc.text;
   const recovered=includeLegacy&&!doc.workflowVersion&&doc.status==='error'&&(/MinerU server_not_running/.test(doc.error||'')||doc.text&&/OpenAI.*超时或中断/.test(doc.error||''));
   if(interrupted||waiting||legacy||recovered)await enqueue(doc.id,doc.requestedBy||doc.uploadedBy||'系统',{resume:interrupted});
  });}
 }
 return {enqueue,resumePending,isBusy:()=>running||queue.size>0};
}

export const documentWorkflow=createDocumentWorkflow();
