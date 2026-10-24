import { db, transaction, getProgramRecord, writeProgram, getDocument, saveDocument, now, event } from './store.mjs';
import { findProgramAssociation } from './program-association.mjs';

// Explicit maintenance operation, never triggered by an upload or by name alone.
// Original rows/versions remain available; only the active catalogue is folded.
export function mergeDuplicatePrograms(pairs,actor,{beforeWrite=async()=>{}}={}){return transaction(async()=>{
 const planned=[],used=new Set();
 for(const pair of pairs){
  const canonical=await getProgramRecord(pair.canonicalId),duplicate=await getProgramRecord(pair.duplicateId);
  if(duplicate?.mergedInto===pair.canonicalId)continue;
  if(!canonical||!duplicate||canonical.mergedInto||duplicate.mergedInto||canonical.id===duplicate.id)throw new Error('合并对象不存在或已合并');
  if(canonical.version!==pair.expectedCanonicalVersion||duplicate.version!==pair.expectedDuplicateVersion)throw new Error('项目版本已变化，请重新核对后合并');
  if(!findProgramAssociation(duplicate,[canonical]).target)throw new Error('不同学校、年份、项目或招生类别不能合并');
  if(used.has(canonical.id)||used.has(duplicate.id))throw new Error('合并清单有重复编号');used.add(canonical.id);used.add(duplicate.id);
  planned.push({canonical,duplicate});
 }
 const versions=[];for(const id of used)versions.push(...await db.prepare('SELECT * FROM versions WHERE program_id=?').all(id));
 const documentIds=[...new Set(planned.flatMap(({canonical,duplicate})=>[...(canonical.sourceIds||[]),...(duplicate.sourceIds||[])]))];
 const documents=(await Promise.all(documentIds.map(getDocument))).filter(Boolean);
 await beforeWrite({planned,versions,documents,at:now()});
 const saved=[];
 for(const {canonical,duplicate} of planned){
  const mergedProgramIds=[...new Set([...(canonical.mergedProgramIds||[]),duplicate.id,...(duplicate.mergedProgramIds||[])])];
  const content={...duplicate,id:canonical.id,code:canonical.code||canonical.id,sourceIds:[...new Set([...(canonical.sourceIds||[]),...(duplicate.sourceIds||[])])]};
  saved.push(await writeProgram(content,actor,'合并重复项目，采用已确认的新资料；旧项目、原文及全部版本保留',canonical.version,null,{mergedProgramIds}));
  await db.prepare('UPDATE programs SET data=? WHERE id=?').run(JSON.stringify({...duplicate,mergedInto:canonical.id,mergedAt:now()}),duplicate.id);
  for(const doc of documents)if(doc.linkedPrograms?.includes(duplicate.id)){
   doc.linkedPrograms=[...new Set(doc.linkedPrograms.map(id=>id===duplicate.id?canonical.id:id))];
   doc.statusVersion=(doc.statusVersion||0)+1;doc.statusUpdatedAt=now();await saveDocument(doc);
  }
  await event('merge',canonical.id,actor,{action:'合并已确认的重复项目',duplicateId:duplicate.id,canonicalId:canonical.id,retainedVersions:true});
 }
 return saved;
});}
