import { getDocuments, getPrograms, saveDocument } from './store.mjs';
import { parseDocument, saveDocumentStatus } from './ingest.mjs';
import { openAIConfig } from './openai-config.mjs';
import { extractDocumentRules } from './document-ai.mjs';
import { buildDocumentReview,refreshReviewValidation } from './document-organizer.mjs';

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
  extract=extractDocumentRules, organize=buildDocumentReview, saveProgress=saveDocument, retryDelay=2000 }={}) {
 const queue=new Map();let running=false,activeId=null;
 function enqueue(id,actor,{feedback='',expectedReviewVersion}={}) {
  const doc=documents().find(d=>d.id===id);
  if(!doc||doc.builtin)throw Object.assign(new Error('请选择上传文件'),{status:404});
  if(doc.status==='published')throw Object.assign(new Error('本文件已确认入库；更新要求请上传新文件'),{status:409});
  if(activeId===id||queue.has(id))return doc;
  if(expectedReviewVersion!==undefined&&doc.autoReview?.version!==expectedReviewVersion)throw Object.assign(new Error('整理结果已更新，请重新打开后提交核对意见'),{status:409});
  if(doc.projectDraft){
   if(!emptyManualDraft(doc.projectDraft))throw Object.assign(new Error('此文件已有人工保存的规则，请先完成该草稿；不会覆盖已有修改'),{status:409});
   doc.previousManualDraft=doc.projectDraft;delete doc.projectDraft;
  }
  doc.reviewerFeedback=String(feedback||doc.reviewerFeedback||'').slice(0,12000);
  doc.requestedBy=actor;doc.workflowVersion=2;doc.autoRetryCount=0;doc.organizingProgress=null;saveStatus(doc,'queued',actor);
  queue.set(id,actor);setImmediate(drain);
  return doc;
 }
 async function drain() {
  if(running)return;running=true;
  try { while(queue.size) {
   const [id,actor]=queue.entries().next().value;queue.delete(id);activeId=id;
   const doc=documents().find(d=>d.id===id);if(!doc)continue;
   try {
    if(!doc.text?.trim())await parse(doc,actor);
    if(doc.status==='error')continue;
    const connection=config();
    if(!connection.apiKey){saveStatus(doc,'needs_configuration',actor);continue;}
    saveStatus(doc,'extracting',actor);
    let lastProgress=0;
    const onProgress=progress=>{if(Date.now()-lastProgress<15000)return;lastProgress=Date.now();doc.organizingProgress=progress;doc.statusVersion=(doc.statusVersion||0)+1;saveProgress(doc);};
    const result=await extract(doc,connection,{feedback:doc.reviewerFeedback,onProgress});
    doc.autoReview=organize(result.extracted,doc,programs(),{model:result.model,usage:result.usage});
    doc.organizedAt=new Date().toISOString();
    saveStatus(doc,'review',actor);
   } catch(error) {
    if(error.retryable&&(doc.autoRetryCount||0)<1){doc.autoRetryCount=(doc.autoRetryCount||0)+1;saveStatus(doc,'queued',actor);queue.set(id,actor);await new Promise(resolve=>setTimeout(resolve,retryDelay));}
    else saveStatus(doc,'error',actor,error.message||'自动整理未完成，原文件已保留');
   }
   finally {activeId=null;}
  }} finally {running=false;activeId=null;}
 }
 function resumePending({includeLegacy=false}={}) {
  const ready=Boolean(config().apiKey);
  for(const doc of documents()) {
   if(doc.builtin||doc.projectDraft&&!emptyManualDraft(doc.projectDraft)||doc.status==='published')continue;
   const refreshed=refreshReviewValidation(doc,programs());
   if(refreshed){doc.previousAutoReview=doc.autoReview;doc.autoReview=refreshed;saveStatus(doc,'review','系统');}
   const interrupted=activeDocumentStates.has(doc.status);
   const waiting=doc.status==='needs_configuration'&&ready;
   const legacy=includeLegacy&&!doc.autoReview&&doc.status==='review'&&doc.text;
   const recovered=includeLegacy&&!doc.workflowVersion&&doc.status==='error'&&(/MinerU server_not_running/.test(doc.error||'')||doc.text&&/OpenAI.*超时或中断/.test(doc.error||''));
   if(interrupted||waiting||legacy||recovered)enqueue(doc.id,doc.requestedBy||doc.uploadedBy||'系统');
  }
 }
 return {enqueue,resumePending,isBusy:()=>running||queue.size>0};
}

export const documentWorkflow=createDocumentWorkflow();
