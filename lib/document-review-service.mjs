import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { db, transaction, getDocument, getDocumentSummaries, getPrograms, saveDocument, now, event } from './store.mjs';
import { refreshReviewAssociations, findProgramAssociation } from './program-association.mjs';
import { deleteFile } from './file-store.mjs';
import { refreshReviewValidation } from './document-organizer.mjs';

const reject=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
let builtinHash;
async function duplicateUploads(doc){
 const [summaries,files]=await Promise.all([getDocumentSummaries(),db.kind==='postgres'?db.prepare('SELECT name,sha256 FROM files').all():[]]);
 const hashes=new Map(files.map(f=>[f.name,f.sha256]));
 const hash=doc.fileHash||hashes.get(doc.storageName);
 if(!hash)return [];
 if(!builtinHash)builtinHash=readFile('public/sources/aohb27.pdf').then(bytes=>createHash('sha256').update(bytes).digest('hex')).catch(()=>null);
 const seedHash=await builtinHash;
 return summaries.filter(d=>d.id!==doc.id&&(d.fileHash||hashes.get(d.storageName)||(d.id==='aohb27'?seedHash:null))===hash)
  .map(d=>({id:d.id,name:d.name||d.filename,status:d.status}));
}
export async function saveRefreshedReview(doc,programs,actor='系统'){
 const revalidated=refreshReviewValidation(doc,programs),updated=revalidated||refreshReviewAssociations(doc,programs);
 if(!updated)return false;
 if(revalidated)doc.previousAutoReview=doc.autoReview;
 doc.autoReview=updated;doc.statusVersion=(doc.statusVersion||0)+1;doc.statusUpdatedAt=now();
 await saveDocument(doc);
 await event('document',doc.filename,actor,{action:revalidated?'更新待确认资料校验':'核对已有项目关联',reviewVersion:updated.version});
 return true;
}
export async function getReviewDocument(id){
 let doc=await getDocument(id);if(!doc)reject('资料不存在',404);
 if(doc.status==='review'&&doc.autoReview){
  const programs=await getPrograms();
  if(refreshReviewValidation(doc,programs)||refreshReviewAssociations(doc,programs)){
   // Only a real update takes the shared write lock. Re-read inside it so a
   // concurrent confirmation, correction or association choice cannot be lost.
   doc=await transaction(async()=>{
    const current=await getDocument(id);if(!current)reject('资料不存在',404);
    if(current.status==='review'&&current.autoReview)await saveRefreshedReview(current,await getPrograms());
    return current;
   });
  }
  if(doc.status==='review')doc.duplicateUploads=await duplicateUploads(doc);
 }
 return doc;
}
export function chooseDocumentAssociation(id,body,actor){return transaction(async()=>{
 const doc=await getDocument(id);
 if(!doc||doc.builtin)reject('资料不存在',404);
 if(doc.status!=='review'||doc.autoReview?.version!==body.expectedReviewVersion)reject('整理结果已更新，请刷新后核对归属');
 const entry=doc.autoReview.entries[body.entryIndex];
 if(!Number.isInteger(body.entryIndex)||!entry)reject('请选择有效项目',400);
 const programs=await getPrograms(),found=findProgramAssociation(entry.proposedIdentity||entry.program,programs);
 if(body.targetId){
  if(!found.candidates.some(p=>p.id===body.targetId))reject('只能选择同校、同年份且招生类别相容的项目',400);
  entry.associationChoice={targetId:body.targetId};
 }else{
  if(found.state==='matched')reject('已有相同项目，请选择更新现有项目');
  const reason=String(body.independentReason||'').trim();
  if(reason.length<3||reason.length>1000)reject('请说明这是独立项目的依据（3至1000字）',400);
  entry.associationChoice={independentReason:reason};
 }
 await saveRefreshedReview(doc,programs,actor);return doc;
});}

export function deleteUploadedDocument(id,body,actor){return transaction(async()=>{
 const doc=await getDocument(id);if(!doc||doc.builtin)reject('请选择尚未入库的上传资料',404);
 if((doc.statusVersion||0)!==body.expectedStatusVersion)reject('资料状态已更新，请刷新后再删除');
 if(!['review','error','uploaded','needs_configuration'].includes(doc.status))reject(doc.status==='published'?'资料已入库，须保留规则引用及历史原文':'资料正在处理，请等待完成后再删除');
 if(doc.linkedPrograms?.length)reject('资料已关联正式项目，须保留原文');
 // Include old versions and matching snapshots, not just the current catalogue.
 for(const table of ['programs','versions','matches','documents']){
  const reference=await db.prepare(`SELECT 1 AS found FROM ${table} WHERE data LIKE ?${table==='documents'?' AND id<>?':''} LIMIT 1`).get('%'+id+'%',...(table==='documents'?[id]:[]));
  if(reference)reject('资料仍被项目、历史版本或其他草稿引用，不能删除原文');
 }
 await db.prepare('DELETE FROM documents WHERE id=?').run(id);
 if(doc.storageName)await deleteFile(doc.storageName);
 await event('document',doc.filename,actor,{action:'删除未入库的上传资料',documentId:id,filename:doc.filename,fileHash:doc.fileHash||null});
 return {deleted:true,id};
});}
