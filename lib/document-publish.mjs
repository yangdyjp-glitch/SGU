import { getDocuments, getProgram, now, transaction, saveDocument, event, writeProgram } from './store.mjs';
import { validateProgram } from './engine.mjs';

const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function confirmDocument(id,body,actor) {
 return transaction(()=>{
  const doc=getDocuments().find(d=>d.id===id),review=doc?.autoReview;
  if(!doc||doc.builtin)reject('资料不存在',404);
  if(!review||review.version!==body.expectedReviewVersion)reject('整理结果已更新，请重新打开后整体确认',409);
  if(body.confirmed!==true)reject('请整体核对后确认入库');
  if(doc.status==='published')return {document:doc,programs:doc.linkedPrograms.map(getProgram),alreadyPublished:true};
  if(doc.status!=='review')reject('请等待自动整理完成后核对',409);
  if(!review.entries.length)reject('这份文件没有可入库的招生项目');
  if(review.entries.some(e=>e.issues.some(i=>i.kind==='blocking')))reject('请先修正高亮的学校、年份、归属或日期问题，再整体确认');
  const ids=new Set();
  for(const entry of review.entries){
   const p=entry.program,current=getProgram(p.id);
   if(ids.has(p.id))reject('本次整理有重复项目，请填写核对意见后重新整理');ids.add(p.id);
   if((current?.version||0)!==entry.expectedVersion)reject('已有项目在核对期间被更新，请重新整理后确认',409);
   const errors=validateProgram(p);if(errors.length)reject(p.name+'：'+errors.join('；'));
  }
  const saved=review.entries.map(entry=>writeProgram({...entry.program,
   verificationNotes:entry.issues.filter(i=>i.kind==='uncertain'),
   reviewNote:'已整体核对文档整理结果；未明确事项继续保留待核实'},actor,
   '整体确认入库：'+doc.filename,entry.expectedVersion));
  doc.linkedPrograms=saved.map(p=>p.id);doc.status='published';doc.error=null;
  doc.statusVersion=(doc.statusVersion||0)+1;doc.statusUpdatedAt=now();
  doc.confirmedAt=now();doc.confirmedBy=actor;doc.confirmedReviewVersion=review.version;
  saveDocument(doc);event('document',doc.filename,actor,{action:'整体确认入库',programs:doc.linkedPrograms,reviewVersion:review.version,status:doc.status,statusVersion:doc.statusVersion});
  return {document:doc,programs:saved,alreadyPublished:false};
 });
}
