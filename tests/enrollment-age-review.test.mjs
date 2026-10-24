import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalizeEnrollmentAgeReference} from '../lib/enrollment-age.mjs';
import {validDate,validateProgram,matchProgram} from '../lib/engine.mjs';
import {buildDocumentReview,refreshReviewValidation} from '../lib/document-organizer.mjs';
import {reviewValidationVersion} from '../lib/document-review-version.mjs';
import {renderAutoReview} from '../public/document-auto-review.js';
import {admissionsFixture,admissionsText} from './fixtures/admissions.mjs';

const dates='2027-04-01（4月入学）；2027-09-21（9月入学）';
const quote='Be at least 18 years of age and have passed an official examination';
const rule=()=>({field:'ageAtEnrollment',op:'gte',value:18,label:'在相应入学资格基准日须年满18岁',referenceDate:dates,state:'stated',source:{page:'2',quote}});
const rounds=[{intake:'2027-04',enrollmentDate:'2027-04-01'},{intake:'2027-09',enrollmentDate:'2027-09-21'}];
const doc=()=>({id:'conditional-age-review',filename:'admissions.pdf',status:'review',text:admissionsText+'\n'+quote+'\nThe date of enrollment is April 1, 2027 for April enrollment and September 21, 2027 for September enrollment.'});
function input(){
 const input=admissionsFixture(),base=input.programs[0];
 input.programs=Array.from({length:7},(_,i)=>({...structuredClone(base),name:'项目'+(i+1),englishName:'Program '+(i+1)}));
 const p=input.programs[1];p.paths=[{id:'age',label:'同等学力及年龄',all:[rule()],source:{page:'2',quote}}];
 p.rounds=rounds.map((r,i)=>({...p.rounds[0],...r,id:'round-'+i}));
 p.graduationPolicy.required=false;
 return input;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,button:(label,action,extra)=>`<button data-act="${action}" ${extra}>${label}</button>`};

test('intake-dependent age dates reuse matching round dates while retaining every original date',()=>{
 const r=rule(),source=structuredClone(r.source),original=structuredClone(rounds);
 assert.equal(normalizeEnrollmentAgeReference(r,rounds,validDate),true);
 assert.equal(r.referenceDate,null);assert.ok(r.label.includes(dates));assert.equal(r.value,18);assert.deepEqual(r.source,source);assert.deepEqual(rounds,original);
 assert.equal(normalizeEnrollmentAgeReference(r,rounds,validDate),false);
});

test('fixed, ambiguous, conflicting and incomplete date scopes are never silently replaced',()=>{
 for(const referenceDate of ['2027-03-31','2027-04','2027-04-01 / 2027-09-21','2027-02-30（4月入学）；2027-09-21（9月入学）','2027-03-31（4月入学）；2027-09-20（9月入学）','2027-04-01（4月入学）；2027-04-02（4月入学）']){
  const r={...rule(),referenceDate},original=structuredClone(r);
  assert.equal(normalizeEnrollmentAgeReference(r,rounds,validDate),false,referenceDate);assert.deepEqual(r,original);
 }
 for(const invalidRounds of [[],[rounds[0]],[...rounds,{intake:null,enrollmentDate:null}],[rounds[0],{...rounds[1],enrollmentDate:null}],[rounds[0],{...rounds[1],enrollmentDate:'2027-09-22'}]]){
  const r=rule();assert.equal(normalizeEnrollmentAgeReference(r,invalidRounds,validDate),false);assert.equal(r.referenceDate,dates);
 }
 const r={...rule(),label:''};assert.equal(normalizeEnrollmentAgeReference(r,rounds,validDate),false);
});

test('seven-project review can be confirmed and matches age separately for April and September',()=>{
 const d=doc(),extracted=input(),original=structuredClone(extracted);
 d.autoReview=buildDocumentReview(extracted,d,[]);
 assert.deepEqual(extracted,original);assert.equal(d.autoReview.entries.length,7);
 assert.ok(d.autoReview.entries.every(e=>!e.issues.some(i=>i.kind==='blocking')));
 const p=d.autoReview.entries[1].program;assert.deepEqual(validateProgram(p),[]);
 assert.doesNotMatch(renderAutoReview(d,ui),/data-act="confirm-document"[^>]*disabled/);
 for(const [birthDate,expected] of [['2009-09-20',['fail','pass']],['2009-09-21',['fail','pass']],['2009-09-22',['fail','fail']],['2009-04-01',['pass','pass']],['',['unknown','unknown']]]){
  const results=p.rounds.map(round=>matchProgram({birthDate},p,round).education.paths[0].checks[0]);
  assert.deepEqual(results.map(r=>r.state),expected,birthDate);
 }
 // An absent round date must stay unknown rather than borrowing the other intake.
 assert.equal(matchProgram({birthDate:'2009-09-20'},p,{...p.rounds[1],enrollmentDate:null}).education.paths[0].checks[0].state,'unknown');
});

test('legacy blocked draft refresh removes only the proven format blocker and preserves history',()=>{
 const d=doc();d.autoReview=buildDocumentReview(input(),d,[]);
 const entry=d.autoReview.entries[1];entry.program.paths[0].all[0]=rule();
 entry.issues.push({path:'/coverage',reason:'条件的名称、取值或基准日无效，请补充核对意见后重新整理',kind:'blocking',source:null});
 d.autoReview.validationVersion=5;
 const original=structuredClone(d),updated=refreshReviewValidation(d,[]);
 assert.deepEqual(d,original);assert.equal(updated.validationVersion,reviewValidationVersion);
 assert.ok(updated.entries.every(e=>!e.issues.some(i=>i.kind==='blocking')));
 assert.equal(updated.entries[1].program.paths[0].all[0].referenceDate,null);
 assert.ok(updated.entries[1].program.paths[0].all[0].label.includes(dates));
 assert.deepEqual(updated.entries[1].program.rounds,original.autoReview.entries[1].program.rounds);
 assert.equal(refreshReviewValidation({...d,status:'published'},[]),null);
});

test('unresolved condition errors identify the exact condition and source instead of generic coverage',()=>{
 const extracted=input(),p=extracted.programs[1];p.paths[0].all[0].referenceDate='2027-03-31（4月入学）；2027-09-20（9月入学）';
 const review=buildDocumentReview(extracted,doc(),[]),entry=review.entries[1];
 const error=entry.issues.find(i=>i.kind==='blocking');assert.equal(error.path,'/paths/0/all/0');assert.match(error.reason,/在相应入学资格基准日须年满18岁/);assert.match(error.reason,/2027-03-31/);assert.equal(error.source.quote,quote);
 assert.match(renderAutoReview({...doc(),autoReview:review},ui),/学历资格：|学历资格<\/strong>/);
 assert.match(renderAutoReview({...doc(),autoReview:review},ui),/data-act="confirm-document"[^>]*disabled/);
 assert.ok(validateProgram(entry.program).length);
});

test('overall confirmation persists all seven normalized projects and preserves age matching on reload',async()=>{
 process.env.DATABASE_URL='';process.env.DATA_DIR='.qa/enrollment-age-unit-'+randomUUID();
 const store=await import('../lib/store.mjs');
 const {confirmDocument}=await import('../lib/document-publish.mjs');
 const d=doc();d.autoReview=buildDocumentReview(input(),d,await store.getPrograms());
 await store.saveDocument(d);
 const result=await confirmDocument(d.id,{expectedReviewVersion:d.autoReview.version,confirmed:true},'test');
 assert.equal(result.programs.length,7);assert.equal(result.document.status,'published');
 const p=await store.getProgram(result.programs[1].id);
 assert.equal(p.paths[0].all[0].referenceDate,null);assert.ok(p.paths[0].all[0].label.includes(dates));
 assert.deepEqual(p.rounds.map(r=>matchProgram({birthDate:'2009-09-20'},p,r).education.paths[0].checks[0].state),['fail','pass']);
 assert.equal((await store.getDocument(d.id)).linkedPrograms.length,7);
});
