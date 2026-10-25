import test from 'node:test';
import assert from 'node:assert/strict';
import {academicScoreRows,groupAcademicScores,renderAcademicScores} from '../public/academic-scores.js';
import {validateAcademicScores} from '../lib/academic-scores.mjs';
import {schemaFields,validateSchema,documentSchema} from '../lib/document-schema.mjs';
import {buildDocumentReview,refreshReviewValidation} from '../lib/document-organizer.mjs';
import {renderAdmissionContent} from '../public/admissions-content.js';
import {admissionsFixture,admissionsText} from './fixtures/admissions.mjs';
import {seedPrograms} from '../lib/seed.mjs';
import {matchProgram} from '../lib/engine.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,evidence:s=>s?.sourceId?`<a href="/uploads/${esc(s.sourceId)}#page=${esc(s.page)}">原文</a>`:'',icon:()=>'',badge:esc,tag:esc};
const source={sourceId:'test-guide',page:'2',quote:'Full diploma: 28; scholarship: 35.'};
const row=(more={})=>({id:'ib',qualification:'IB Diploma',variant:'',admissionStatus:'minimum',admissionText:'≥28／45',scholarshipStatus:'minimum',scholarshipText:'≥35／45',scholarshipName:'入学奖学金',conditions:'须完整文凭；英语科目与最终成绩另须满足。',source,...more});
const project=(id,rows=[row()])=>({id,school:'测试学校',year:2027,name:id,requirements:[],academicTests:{status:'required',detail:'学术成绩需核实',source,scoreDetails:rows,scholarshipGrades:[]}});

test('academic scores preserve denominators, examination years and scholarship thresholds separately',()=>{
 const p=project('A',[row(),row({id:'ib-reference',admissionStatus:'reference',admissionText:'36／42，另 EE＋TOK ≥2',scholarshipStatus:'unspecified',scholarshipText:'未列门槛'}),row({id:'dse-old',qualification:'HKDSE',variant:'2023 年及以前',admissionText:'最佳5科 ≥18',scholarshipText:'最佳5科 ≥22'}),row({id:'dse-new',qualification:'HKDSE',variant:'2024 年起',admissionText:'最佳4科 ≥14',scholarshipText:'最佳4科 ≥17'})]);
 assert.equal(academicScoreRows(p).length,4);const html=renderAcademicScores([p],ui);
 for(const s of ['≥28／45','≥35／45','36／42','EE＋TOK ≥2','2023 年及以前','2024 年起','参考成绩','申请最低成绩','奖学金成绩'])assert.ok(html.includes(s),s);
 assert.equal(groupAcademicScores([p]).length,4);
});
test('school grouping requires matching conditions, scholarships and qualification system, not just a shared numeric score',()=>{
 const a=project('A'),b=project('B'),c=project('C',[row({conditions:'数学 HL ≥5'})]),d=project('D',[row({scholarshipText:'≥38／45'})]),e=project('E',[row({qualification:'Singapore A-Level'})]);
 const grouped=groupAcademicScores([a,b,c,d,e]);assert.equal(grouped.length,4);assert.deepEqual(grouped[0].programs,['A','B']);
 assert.equal(grouped.find(r=>r.qualification==='Singapore A-Level').programs[0],'E');
});
test('legacy and unpublished scores never appear as zero, guaranteed acceptance, or an inferred no-minimum',()=>{
 const old={id:'old',name:'旧项目',academicTests:{status:'optional'}};
 assert.deepEqual(validateAcademicScores(old),[]);assert.match(renderAcademicScores([old],ui),/尚未专项整理/);
 const html=renderAcademicScores([project('A',[row({admissionStatus:'unspecified',admissionText:'',scholarshipStatus:'unspecified',scholarshipText:''})])],ui);
 assert.match(html,/资料未列最低分/);assert.doesNotMatch(html,/明确不设最低分/);assert.match(html,/不等于零分/);
});
test('score validation rejects malformed, duplicate and unsupported entries without crashing',()=>{
 assert.deepEqual(validateAcademicScores(project('A')),[]);
 for(const bad of [row({source:{page:'2',quote:''}}),row({admissionText:''}),row({qualification:12}),row({scholarshipStatus:'guaranteed'}),row({admissionText:33})])assert.ok(validateAcademicScores(project('A',[bad])).length);
 assert.ok(validateAcademicScores(project('A',[row(),row()])).length);
 assert.ok(validateAcademicScores({academicTests:{scoreDetails:{}}}).length);
});
test('evidence is escaped; unsafe external links do not render and large hints can be deferred',()=>{
 const info=[],p=project('A',[row({qualification:'IB <script>alert(1)</script>',source:{...source,url:'javascript:alert(1)'},conditions:'<img onerror="bad">'})]);
 const html=renderAcademicScores([p],{...ui,registerInfo:fn=>(info.push(fn),String(info.length))});
 assert.doesNotMatch(html,/<script|<img|href="javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/data-info-key=/);assert.doesNotMatch(html,/data-info=/);assert.equal(info.length,1);assert.ok(info[0]().parts.some(p=>p.text===source.quote));
 const external=renderAcademicScores([project('B',[row({source:{url:'https://university.example/requirements',page:null,quote:'Requirements'}})])],ui);assert.match(external,/href="https:\/\/university.example\/requirements"/);
});
test('new extraction and existing review refresh retain two score columns, per-row doubts and legacy compatibility',()=>{
 const data=admissionsFixture(),doc={id:'test-guide',filename:'guide.pdf',text:admissionsText+'\nFull diploma: 28; scholarship: 35.'};
 data.programs[0].academicTests.scoreDetails=[{...row(),source:{page:'2',quote:source.quote}}];
 assert.deepEqual(validateSchema(data),[]);
 const review=buildDocumentReview(data,doc,[]),p=review.entries[0].program;
 assert.equal(p.academicTests.scoreDetails[0].source.sourceId,doc.id);
 const html=renderAdmissionContent(p,ui,[{path:'/academicTests/scoreDetails/0'}]);assert.match(html,/data-academic-score="IB Diploma" class=" admission-doubt"/);assert.match(html,/≥35／45/);assert.doesNotMatch(html,/\[object Object\]/);
 const legacy=admissionsFixture().programs[0];delete legacy.academicTests.scoreDetails;delete legacy.academicTests.scholarshipGrades;
 assert.deepEqual(validateSchema(schemaFields(legacy),documentSchema.$defs.program),[]);
 doc.autoReview={...review,validationVersion:'previous'};doc.status='review';assert.equal(refreshReviewValidation(doc,[]).entries[0].program.academicTests.scoreDetails[0].admissionText,'≥28／45');
});
test('scholarship renewal GPA remains separate; extra score descriptions do not change existing eligibility decisions',()=>{
 const p=seedPrograms()[0],s={standard12:true,educationStatus:'completed',graduationDate:'2026-06-01',ageAtEnrollment:19};
 const baseline=matchProgram(s,p,p.rounds[0]);p.academicTests={...p.academicTests,scoreDetails:[row({admissionStatus:'reference',admissionText:'40／42'})],scholarshipGrades:[{id:'renewal',name:'续领奖学金',stage:'入学后／续领',status:'minimum',text:'GPA ≥2.5',conditions:'入学后的年度审核',source}]};
 const current=matchProgram(s,p,p.rounds[0]);delete current.computedAt;delete baseline.computedAt;assert.deepEqual(current,baseline);
 const html=renderAcademicScores([p],ui);assert.match(html,/入学后／续领/);assert.match(html,/GPA ≥2.5/);assert.match(html,/其他奖学金成绩要求/);
});
