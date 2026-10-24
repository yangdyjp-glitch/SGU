import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { admissionsFixture,admissionsText } from './fixtures/admissions.mjs';
import { buildDocumentReview } from '../lib/document-organizer.mjs';
import { findProgramAssociation,refreshReviewAssociations } from '../lib/program-association.mjs';
import { renderDocumentReview } from '../public/document-review.js';

process.env.DATA_DIR='.qa/duplicates-'+randomUUID();process.env.DATABASE_URL='';
const store=await import('../lib/store.mjs');
const {confirmDocument}=await import('../lib/document-publish.mjs');
const {getReviewDocument,chooseDocumentAssociation,deleteUploadedDocument}=await import('../lib/document-review-service.mjs');
const {saveFile,loadFile}=await import('../lib/file-store.mjs');
const {mergeDuplicatePrograms}=await import('../lib/program-merge.mjs');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,badge:esc,tag:esc,button:(label,act,extra='')=>`<button data-act="${act}" ${extra}>${label}</button>`,evidence:()=>''};
function draft(suffix,channel='海外英语本科'){
 const fixture=admissionsFixture();fixture.programs=fixture.programs.slice(0,1);fixture.programs[0].school+='-'+suffix;fixture.programs[0].channel=channel;
 const id=randomUUID(),bytes=Buffer.from(admissionsText),doc={id,filename:'admissions.md',name:'admissions.md',storageName:id+'.md',text:admissionsText,status:'review',statusVersion:1,fileHash:createHash('sha256').update(bytes).digest('hex')};
 doc.autoReview=buildDocumentReview(fixture,doc,[]);return {doc,fixture,bytes};
}
async function save(d){await store.saveDocument(d.doc);await saveFile(d.doc.storageName,d.bytes);return d.doc;}
const confirm=(doc,action='create')=>confirmDocument(doc.id,{expectedReviewVersion:doc.autoReview.version,confirmed:true,action},'reviewer');

test('same-project aliases match conservatively, while entry types and years remain separate',()=>{
 const p={id:'first',school:'上智大学',year:2027,name:'国际教养学部',englishName:'Faculty of Liberal Arts',channel:'一年级入学（材料审查）',version:1};
 assert.equal(findProgramAssociation({...p,channel:'一年级入学（First-Year Entry）'},[p]).target.id,'first');
 assert.equal(findProgramAssociation({...p,year:2028},[p]).state,'new');
 assert.equal(findProgramAssociation({...p,channel:'三年级编入（Third-Year Transfer Entry）'},[p]).state,'new');
 assert.equal(findProgramAssociation({...p,channel:'一年级入学（笔试）'},[p]).state,'possible');
 assert.equal(findProgramAssociation({...p,englishName:'FLA'},[p]).state,'possible');
 const law={...p,school:'立教大学',channel:'PEACE Program一般入学申请'};
 assert.equal(findProgramAssociation({...law,channel:'PEACE Program一般入试'},[law]).target.id,law.id);
 const igs={...p,school:'广岛大学',channel:'光辉入试综合型选拔：IGS国外选拔型（11月国外面试选拔，面向国际及日本申请者）'};
 assert.equal(findProgramAssociation({...igs,channel:'光辉入试·综合型选拔IGS国外选拔型（11月国外面试选拔，面向国际及日本申请人）'},[igs]).target.id,igs.id);
 assert.equal(findProgramAssociation(p,[p,{...p,id:'other'}]).state,'possible');
});

test('pending review detects newly published duplicates, updates one existing ID and keeps both sources and history',async()=>{
 const first=await save(draft('race')),second=await save(draft('race'));
 const old=(await confirm(first)).programs[0],count=(await store.getPrograms()).length;
 // This review opened before the other file was confirmed.
 await assert.rejects(()=>confirm(second),/已发现已有项目/);
 const reviewed=await getReviewDocument(second.id),entry=reviewed.autoReview.entries[0];
 assert.equal(entry.mode,'update');assert.equal(entry.program.id,old.id);assert.equal(entry.expectedVersion,1);
 assert.ok(reviewed.duplicateUploads.some(d=>d.id===first.id));assert.equal(refreshReviewAssociations(reviewed,await store.getPrograms()),null);
 const html=renderDocumentReview(reviewed,[],ui);assert.match(html,/发现 1 个已收录项目/);assert.match(html,/文件内容完全相同/);assert.match(html,/更新现有项目（1 个）/);assert.match(html,/删除上传资料/);
 await assert.rejects(()=>confirm(reviewed),/更新现有项目/);
 const result=await confirm(reviewed,'update');assert.equal(result.programs[0].id,old.id);assert.equal(result.programs[0].version,2);assert.equal((await store.getPrograms()).length,count);
 assert.ok(result.programs[0].sourceIds.includes(first.id));assert.ok(result.programs[0].sourceIds.includes(second.id));assert.equal((await store.getProgramVersions(old.id)).length,2);
 assert.doesNotMatch(renderDocumentReview(result.document,[],ui),/delete-document/);
});

test('ambiguous association requires a reviewed target or explicit independent-project basis',async()=>{
 const existing=await save(draft('ambiguous','海外入试'));const current=(await confirm(existing)).programs[0];
 const incoming=await save(draft('ambiguous','新渠道'));
 let reviewed=await getReviewDocument(incoming.id);assert.equal(reviewed.autoReview.entries[0].association.state,'possible');
 assert.ok(reviewed.autoReview.entries[0].issues.some(i=>i.path==='/association'&&i.kind==='blocking'));
 await assert.rejects(()=>confirm(reviewed),/归属/);
 await assert.rejects(()=>chooseDocumentAssociation(incoming.id,{expectedReviewVersion:reviewed.autoReview.version,entryIndex:0,targetId:'CRPS'},'test'),/同校/);
 await assert.rejects(()=>chooseDocumentAssociation(incoming.id,{expectedReviewVersion:reviewed.autoReview.version,entryIndex:0},'test'),/依据/);
 reviewed=await chooseDocumentAssociation(incoming.id,{expectedReviewVersion:reviewed.autoReview.version,entryIndex:0,targetId:current.id},'test');
 assert.equal(reviewed.autoReview.entries[0].mode,'update');assert.ok(!reviewed.autoReview.entries[0].issues.some(i=>i.path==='/association'));
 assert.equal((await confirm(reviewed,'update')).programs[0].id,current.id);
 const independent=await save(draft('ambiguous','另一个独立类别'));reviewed=await getReviewDocument(independent.id);
 reviewed=await chooseDocumentAssociation(independent.id,{expectedReviewVersion:reviewed.autoReview.version,entryIndex:0,independentReason:'招生对象和选拔方式不同'},'test');
 assert.equal(reviewed.autoReview.entries[0].mode,'create');assert.equal((await confirm(reviewed)).programs[0].version,1);
});

test('delete removes only an unreferenced inactive upload and protects published or historic sources',async()=>{
 const incoming=await save(draft('deletion')),count=(await store.getPrograms()).length;
 await assert.rejects(()=>deleteUploadedDocument(incoming.id,{expectedStatusVersion:0},'test'),/已更新/);
 await deleteUploadedDocument(incoming.id,{expectedStatusVersion:1},'test');
 assert.equal(await store.getDocument(incoming.id),null);await assert.rejects(()=>loadFile(incoming.storageName),/ENOENT/);assert.equal((await store.getPrograms()).length,count);
 const active=await save(draft('active'));active.status='extracting';await store.saveDocument(active);
 await assert.rejects(()=>deleteUploadedDocument(active.id,{expectedStatusVersion:1},'test'),/处理/);
 const source=await save(draft('referenced'));const snapshot=structuredClone(source.autoReview.entries[0].program);snapshot.version=1;
 await store.db.prepare('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),snapshot.id,1,JSON.stringify(snapshot),'test','history only',store.now(),null);
 await assert.rejects(()=>deleteUploadedDocument(source.id,{expectedStatusVersion:1},'test'),/历史版本/);assert.ok(await loadFile(source.storageName));
});

test('merging confirmed duplicates preserves immutable versions, source links, snapshots and restorable old IDs',async()=>{
 const original=await save(draft('merge','一年级入学（材料审查）')),duplicate=await save(draft('merge','一年级入学（First-Year Entry）'));
 const canonical=(await confirm(original)).programs[0],second=duplicate.autoReview.entries[0].program;
 // Reproduce the legacy bug without the new publication guard.
 const extra=await store.saveProgram(second,'original reviewer','legacy duplicate',0);
 duplicate.status='published';duplicate.linkedPrograms=[extra.id];await store.saveDocument(duplicate);
 await store.saveStudent({id:'keep',name:'保留档案',individualReviews:[{programId:extra.id,year:2027,outcome:'pending'}]},'test');
 const studentBefore=JSON.stringify(await store.getStudent('keep'));
 const historic=(await store.getProgramVersions(extra.id))[0],pairs=[{canonicalId:canonical.id,duplicateId:extra.id,expectedCanonicalVersion:1,expectedDuplicateVersion:1}];let backup;
 const result=await mergeDuplicatePrograms(pairs,'maintainer',{beforeWrite:async value=>{backup=value;}});
 assert.equal(backup.versions.length,2);assert.equal(result.length,1);assert.equal(result[0].id,canonical.id);assert.equal(result[0].version,2);
 assert.ok(!(await store.getPrograms()).some(p=>p.id===extra.id));assert.equal((await store.getProgram(extra.id)).id,canonical.id);
 assert.deepEqual((await store.getDocument(duplicate.id)).linkedPrograms,[canonical.id]);
 assert.deepEqual((await store.getProgramVersions(canonical.id)).find(v=>v.id===historic.id),historic);assert.equal((await store.getProgramVersions(extra.id)).length,3);
 assert.equal(JSON.stringify(await store.getStudent('keep')),studentBefore);
 assert.deepEqual(await mergeDuplicatePrograms(pairs,'maintainer'),[]);
 const restored=await store.saveProgram(historic.data,'test','restore original duplicate history',2,1);
 assert.equal(restored.id,canonical.id);assert.equal(restored.version,3);assert.ok(restored.mergedProgramIds.includes(extra.id));assert.ok(!(await store.getPrograms()).some(p=>p.id===extra.id));
});
