import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { admissionsFixture, admissionsText } from './fixtures/admissions.mjs';
import { buildDocumentReview, refreshReviewValidation } from '../lib/document-organizer.mjs';
import { validateProgram, validDate } from '../lib/engine.mjs';
import { importedGraduationCheck } from '../lib/imported-program.mjs';
import { graduationDeadline } from '../lib/graduation-date.mjs';
import { reviewValidationVersion } from '../lib/document-review-version.mjs';
import { renderAutoReview } from '../public/document-auto-review.js';
process.env.DATA_DIR='.qa/graduation-review-'+randomUUID();process.env.DATABASE_URL='';
const store=await import('../lib/store.mjs');
const {getReviewDocument}=await import('../lib/document-review-service.mjs');
const {confirmDocument}=await import('../lib/document-publish.mjs');
const quote='have completed or are expected to complete their 12 years of formal education by March 2027 at an educational institution overseas.';
function fixture(deadline='2027-03'){
 const input=admissionsFixture();input.programs=input.programs.slice(0,1);
 const p=input.programs[0];p.school='日期精度测试大学';
 Object.assign(p.graduationPolicy,{required:true,deadline,allowExpected:true,detail:'按原文所述期限取得资格',source:{page:'2',quote}});
 const doc={id:randomUUID(),filename:'graduation.pdf',status:'review',statusVersion:1,text:admissionsText+'\n'+quote};
 doc.autoReview=buildDocumentReview(input,doc,[]);return doc;
}
const check=(p,date,status='completed')=>importedGraduationCheck({graduationDate:date,educationStatus:status},p,p.rounds[0],{validDate});

test('month-only graduation deadlines remain publishable without inventing a day',()=>{
 const doc=fixture(),entry=doc.autoReview.entries[0],p=entry.program;
 assert.equal(p.graduationPolicy.deadline,'2027-03');assert.deepEqual(validateProgram(p),[]);
 assert.ok(!entry.issues.some(i=>i.kind==='blocking'));
 assert.ok(entry.issues.some(i=>i.path==='/graduationPolicy/deadline'&&i.kind==='uncertain'&&/月内具体完成时限/.test(i.reason)));
 assert.equal(p.graduationPolicy.source.quote,quote);
 for(const [date,state] of [['2027-02-28','pass'],['2027-03-01','unknown'],['2027-03-31','unknown'],['2027-04-01','fail'],['2027-03','unknown']])assert.equal(check(p,date).state,state,date);
 assert.equal(check(p,'2027-02-28','expected').state,'conditional');
 p.graduationPolicy.allowExpected=false;assert.equal(check(p,'2027-03-01','expected').state,'fail');
});

test('before a named date remains exclusive and ordinary exact deadlines remain inclusive',()=>{
 const p=fixture('2027-09-21之前').autoReview.entries[0].program;
 assert.deepEqual(validateProgram(p),[]);assert.equal(p.graduationPolicy.deadline,'2027-09-21之前');
 for(const [date,state] of [['2027-09-20','pass'],['2027-09-21','fail'],['2027-09-22','fail']])assert.equal(check(p,date).state,state,date);
 p.graduationPolicy.deadline='2027-09-21';assert.equal(check(p,'2027-09-21').state,'pass');
 for(const value of ['2027-13','2027-02-30','2027-02-30之前','2027-09-21或2027-04-01','2027','入学前',''])assert.equal(graduationDeadline(value,validDate),null,value);
 p.graduationPolicy.deadline='2027-02-30';assert.ok(validateProgram(p).includes('毕业截止日期格式无效'));
});

test('old date blockers refresh with original rules and history intact, then confirm and reload safely',async()=>{
 const d=fixture();d.autoReview.validationVersion=6;
 d.autoReview.entries[0].issues.push({path:'/graduationPolicy',kind:'blocking',reason:'毕业截止日期格式无效，请补充核对意见后重新整理'});
 const old=structuredClone(d.autoReview);await store.saveDocument(d);
 const current=await getReviewDocument(d.id);assert.equal(current.autoReview.validationVersion,reviewValidationVersion);
 assert.deepEqual(current.previousAutoReview,old);assert.deepEqual(current.autoReview.entries[0].program,old.entries[0].program);
 assert.ok(!current.autoReview.entries[0].issues.some(i=>i.kind==='blocking'));
 const ui={esc:s=>String(s??''),button:(label,act,extra='')=>`<button data-act="${act}" ${extra}>${label}</button>`};
 assert.doesNotMatch(renderAutoReview(current,ui),/data-act="confirm-document"[^>]*disabled/);
 await assert.rejects(()=>confirmDocument(d.id,{expectedReviewVersion:old.version,confirmed:true},'test'),/已更新/);
 const result=await confirmDocument(d.id,{expectedReviewVersion:current.autoReview.version,confirmed:true},'test');
 const saved=await store.getProgram(result.programs[0].id);
 assert.equal(saved.graduationPolicy.deadline,'2027-03');assert.equal(check(saved,'2027-03-15').state,'unknown');
 assert.equal(refreshReviewValidation({...current,status:'published'},[]),null);
});

test('opening an unchanged pending review does not acquire the shared write transaction',async()=>{
 const d=fixture();await store.saveDocument(d);
 const baseline=await getReviewDocument(d.id);
 const transaction=store.db.transaction;
 store.db.transaction=()=>{throw new Error('Unexpected write transaction during unchanged review read');};
 try{
  const current=await getReviewDocument(d.id);
  assert.deepEqual(current.autoReview,baseline.autoReview);assert.equal(current.statusVersion,baseline.statusVersion);
 }finally{store.db.transaction=transaction;}
});

test('a review refreshed concurrently with publication never overwrites the published document',async()=>{
 const d=fixture();d.autoReview.validationVersion=6;await store.saveDocument(d);
 const published={...d,status:'published',statusVersion:2,linkedPrograms:['published-elsewhere']};
 const transaction=store.db.transaction;let first=true;
 store.db.transaction=async fn=>{
  if(first){first=false;await transaction(()=>store.saveDocument(published));}
  return transaction(fn);
 };
 try{
  assert.deepEqual(await getReviewDocument(d.id),published);
  assert.deepEqual(await store.getDocument(d.id),published);
 }finally{store.db.transaction=transaction;}
});
