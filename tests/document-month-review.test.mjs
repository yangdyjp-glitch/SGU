import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { admissionsFixture, admissionsText } from './fixtures/admissions.mjs';
import { buildDocumentReview, refreshReviewValidation } from '../lib/document-organizer.mjs';
import { reviewValidationVersion } from '../lib/document-review-version.mjs';
import { validateProgram, validDate, tri, allState } from '../lib/engine.mjs';
import { importedLanguageAttempt } from '../lib/imported-program.mjs';
import { renderAutoReview } from '../public/document-auto-review.js';
process.env.DATA_DIR='.qa/month-review-'+randomUUID();process.env.DATABASE_URL='';
const store=await import('../lib/store.mjs');
const {getReviewDocument}=await import('../lib/document-review-service.mjs');
const {confirmDocument}=await import('../lib/document-publish.mjs');
const sourceQuote='only the results of tests taken in December 2024 or later will be considered as valid for application.';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,evidence:()=>'',button:(label,act,extra='')=>`<button data-act="${act}" ${extra}>${label}</button>`};
const doc=()=>({id:randomUUID(),filename:'month-source.pdf',status:'review',statusVersion:1,text:admissionsText+'\n'+sourceQuote});
function monthFixture(){const input=admissionsFixture();for(const p of input.programs)Object.assign(p.languagePolicy,{validYears:null,validAfter:'2024-12',detail:'2024年12月或以后参加的考试。',source:{page:'2',quote:sourceQuote}});return input;}

test('month precision is preserved; explicit inclusive months pass and ambiguous boundaries remain unknown',()=>{
 const p=buildDocumentReview(monthFixture(),doc(),[]).entries[0].program;
 const exam={exam:'IELTS Academic Module',format:'center',score:7,reading:7,listening:7,writing:7,speaking:7,availableDate:'2025-01-10'};
 const state=date=>importedLanguageAttempt({...exam,date},p,p.rounds[0],false,{validDate,tri,allState}).checks.find(c=>c.label==='成绩有效期').state;
 assert.deepEqual(validateProgram(p),[]);assert.equal(p.languagePolicy.validAfter,'2024-12');
 for(const [date,expected] of [['2024-11-30','fail'],['2024-12-01','pass'],['2024-12-31','pass'],['2025-01-01','pass'],['2024-12','unknown']])assert.equal(state(date),expected,date);
 p.languagePolicy.validAfter='2024-09';p.languagePolicy.source.quote='Scores must be from exams taken after September 2024.';
 for(const [date,expected] of [['2024-08-31','fail'],['2024-09-01','unknown'],['2024-09-30','unknown'],['2024-10-01','pass']])assert.equal(state(date),expected,date);
 // Generated Chinese detail cannot override a less precise source quote.
 p.languagePolicy.detail='2024年9月起';assert.equal(state('2024-09-15'),'unknown');
 p.languagePolicy.source.quote='Tests from September 2024. September 2024 is not accepted.';assert.equal(state('2024-09-15'),'unknown');
 p.languagePolicy.validAfter=null;p.languagePolicy.validUntil='2024-12';p.languagePolicy.source.quote='Tests taken in December 2024 or earlier.';
 assert.equal(state('2024-12-31'),'pass');assert.equal(state('2025-01-01'),'fail');
 p.languagePolicy.source.quote='Tests must be taken before December 2024.';assert.equal(state('2024-12-01'),'unknown');
 p.languagePolicy.validUntil='2024-12-15';assert.equal(state('2024-12-15'),'pass');assert.equal(state('2024-12-16'),'fail');
 p.languagePolicy.validAfter='2024-13';assert.ok(validateProgram(p).some(e=>/起始日期格式无效/.test(e)));
 p.languagePolicy.validAfter='2024-12';p.graduationPolicy.deadline='2027-02-30';assert.ok(validateProgram(p).some(e=>/毕业截止日期格式无效/.test(e)));
});

test('opening an old month review removes the false blocker without a model call or changing original rules',async()=>{
 const d=doc(),input=monthFixture();input.programs.forEach(p=>p.school+='按月日期修复');
 // Reproduce the two spellings extracted for the same Nagoya source condition.
 input.programs[0].languagePolicy.validAfter='2024-12-01';d.autoReview=buildDocumentReview(input,d,[]);d.autoReview.validationVersion=3;
 d.autoReview.entries[1].issues.push({path:'/coverage',kind:'blocking',reason:'有效期或毕业截止日期无效，请补充核对意见后重新整理'});
 const before=structuredClone(d.autoReview);await store.saveDocument(d);
 const current=await getReviewDocument(d.id);assert.equal(current.autoReview.validationVersion,reviewValidationVersion);assert.equal(current.autoReview.version,before.version+1);
 assert.deepEqual(current.previousAutoReview,before);assert.deepEqual(current.autoReview.entries.map(e=>e.program),before.entries.map(e=>e.program));
 assert.ok(current.autoReview.entries.every(e=>!e.issues.some(i=>i.kind==='blocking')));
 assert.doesNotMatch(renderAutoReview(current,ui),/data-act="confirm-document"[^>]*disabled/);
 assert.equal((await getReviewDocument(d.id)).autoReview.version,current.autoReview.version,'repeat reads must not keep rewriting the draft');
 await assert.rejects(()=>confirmDocument(d.id,{expectedReviewVersion:before.version,confirmed:true},'test'),/已更新/);
 await store.saveStudent({id:'month-keep',name:'保留测试档案'},'test');const student=await store.getStudent('month-keep');
 const saved=await confirmDocument(d.id,{expectedReviewVersion:current.autoReview.version,confirmed:true},'test');assert.equal(saved.programs.length,2);
 assert.equal(saved.programs[1].languagePolicy.validAfter,'2024-12');assert.deepEqual(await store.getStudent('month-keep'),student);
 assert.equal(refreshReviewValidation({...d,status:'published'},[]),null);
});

test('an undated supplementary checklist still requires a supported year and shows that reason beside confirmation',async()=>{
 const d=doc(),input=admissionsFixture();input.kind='supplement';input.programs=Array.from({length:4},(_,i)=>({...structuredClone(input.programs[0]),name:'材料清单类别'+i,englishName:'Checklist '+i,year:null,rounds:[],paths:[]}));
 d.autoReview=buildDocumentReview(input,d,[]);await store.saveDocument(d);
 for(const entry of d.autoReview.entries){assert.equal(entry.program.year,null);assert.equal(entry.issues.filter(i=>i.kind==='blocking').length,1);assert.equal(entry.issues.find(i=>i.kind==='blocking').path,'/year');}
 const html=renderAutoReview(d,ui),footer=html.slice(html.indexOf('class="auto-review-confirm'));
 assert.match(footer,/暂不能入库的原因/);assert.match(footer,/未注明适用入学年份/);assert.match(footer,/4 个项目/);assert.match(footer,/data-act="confirm-document"[^>]*disabled/);
 assert.equal((footer.match(/<li>/g)||[]).length,1,'same issue is summarized once across all programs');
 const programs=await store.getPrograms();await assert.rejects(()=>confirmDocument(d.id,{expectedReviewVersion:d.autoReview.version,confirmed:true},'test'),/修正/);assert.deepEqual(await store.getPrograms(),programs);
});

test('validation refresh preserves reviewed project associations and independent-project decisions',()=>{
 const d=doc(),input=monthFixture();input.programs=input.programs.slice(0,1);
 const existing={...buildDocumentReview(input,d,[]).entries[0].program,id:'existing-month',version:2,channel:'原通道'};
 for(const choice of [{targetId:existing.id},{independentReason:'申请对象不同，属于独立类别'}]){
  d.autoReview=buildDocumentReview(input,d,[existing]);const entry=d.autoReview.entries[0];entry.associationChoice=choice;d.autoReview.validationVersion=3;
  const original=JSON.stringify(d),updated=refreshReviewValidation(d,[existing]);assert.equal(JSON.stringify(d),original);assert.deepEqual(updated.entries[0].associationChoice,choice);
  assert.equal(updated.entries[0].mode,choice.targetId?'update':'create');assert.equal(updated.entries[0].program.id,choice.targetId||entry.draftProgramId);assert.ok(!updated.entries[0].issues.some(i=>i.path==='/association'));
 }
});
