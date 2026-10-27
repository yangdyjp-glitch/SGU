import test from 'node:test';
import assert from 'node:assert/strict';
import {academicScoreRows,groupAcademicScores,buildAcademicScoreTable,academicScoreDisplay,renderAcademicScores} from '../public/academic-scores.js';
import {renderDetailInfoContent} from '../public/detail-hints.js';
import {academicScoreTypes,buildAcademicScoreCatalog} from '../public/academic-score-catalog.js';
import {createSchoolOverview} from '../public/school-detail.js';
import {renderProjectDetail} from '../public/project-detail.js';
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
 for(const s of ['≥28／45','≥35／45','36／42','EE＋TOK ≥2','2023 年及以前','2024 年起','参考成绩','最低分','奖学金分'])assert.ok(html.includes(s),s);
 assert.equal(groupAcademicScores([p]).length,4);
});
test('school grouping requires matching conditions, scholarships and qualification system, not just a shared numeric score',()=>{
 const a=project('A'),b=project('B'),c=project('C',[row({conditions:'数学 HL ≥5'})]),d=project('D',[row({scholarshipText:'≥38／45'})]),e=project('E',[row({qualification:'Singapore A-Level'})]);
 const grouped=groupAcademicScores([a,b,c,d,e]);assert.equal(grouped.length,4);assert.deepEqual(grouped[0].programs,['A','B']);
 assert.equal(grouped.find(r=>r.qualification==='Singapore A-Level').programs[0],'E');
});
test('absent numeric thresholds display concise copy while stored statuses remain unknown',()=>{
 const old={id:'old',name:'旧项目',academicTests:{status:'optional'}};
 assert.deepEqual(validateAcademicScores(old),[]);assert.match(renderAcademicScores([old],ui),/无要求/);
 const p=project('A',[row({admissionStatus:'unspecified',admissionText:'未列总分／等级下限',scholarshipStatus:'unspecified',scholarshipText:'已核对资料未列本课程的奖学金分数线'})]),before=JSON.stringify(p),info=[];
 const html=renderAcademicScores([p],{...ui,registerInfo:fn=>(info.push(fn),String(info.length))});
 assert.match(html,/无要求/);assert.doesNotMatch(html,/未列总分|已核对资料未列|资料未列最低分/);
 assert.ok(info[0]().parts.some(p=>p.text.includes('未列总分')));assert.equal(JSON.stringify(p),before);
 for(const admissionStatus of ['unspecified','no-minimum','reference'])assert.equal(academicScoreDisplay(row({admissionStatus}),'admission'),'无要求');
 assert.equal(academicScoreDisplay(row({scholarshipStatus:'holistic'}),'scholarship'),'无要求');
 assert.equal(academicScoreDisplay(row({admissionStatus:'not-accepted'}),'admission'),'不适用');
 assert.equal(academicScoreDisplay(row({admissionStatus:'conditional',admissionText:'以录取通知为准'}),'admission'),'以录取通知为准');
});
test('score validation rejects malformed, duplicate and unsupported entries without crashing',()=>{
 assert.deepEqual(validateAcademicScores(project('A')),[]);
 for(const bad of [row({source:{page:'2',quote:''}}),row({admissionText:''}),row({qualification:12}),row({scholarshipStatus:'guaranteed'}),row({admissionText:33}),row({id:3}),row({references:{}}),row({references:[{}]}),row({requirementIds:{}})])assert.ok(validateAcademicScores(project('A',[bad])).length);
 assert.ok(validateAcademicScores(project('A',[row(),row()])).length);
 assert.ok(validateAcademicScores({academicTests:{scoreDetails:{}}}).length);
});
test('evidence is escaped; unsafe external links do not render and large hints can be deferred',()=>{
 const info=[],p=project('A',[row({qualification:'IB <script>alert(1)</script>',source:{...source,url:'javascript:alert(1)'},conditions:'<img onerror="bad">'})]);
 const html=renderAcademicScores([p],{...ui,registerInfo:fn=>(info.push(fn),String(info.length))});
 assert.doesNotMatch(html,/<script|<img|href="javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/data-info-key=/);assert.doesNotMatch(html,/data-info=/);assert.equal(info.length,1);assert.ok(info[0]().parts.some(p=>p.text===source.quote));
 const details=renderDetailInfoContent(info[0](),esc,ui.evidence);assert.doesNotMatch(details,/<script|<img|href="javascript:/);assert.match(details,/test-guide/);
 const externalInfo=[];renderAcademicScores([project('B',[row({source:{url:'https://university.example/requirements',page:null,quote:'Requirements'}})])],{...ui,registerInfo:fn=>(externalInfo.push(fn),'source')});assert.match(renderDetailInfoContent(externalInfo[0](),esc,ui.evidence),/href="https:\/\/university.example\/requirements"/);
});
test('new extraction and existing review refresh retain both score rows, per-row doubts and legacy compatibility',()=>{
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

test('every project gets the same ordered score terms without borrowing another project’s thresholds or evidence',()=>{
 const a=project('A',[row({qualification:'AP',admissionText:'3 科各 ≥4',scholarshipText:'3 科各 ≥5'})]),b=project('B',[]),legacy={id:'legacy',academicTests:{status:'optional'}};
 const programs=[a,b,legacy],before=JSON.stringify(programs),tables=programs.map(p=>buildAcademicScoreTable([p],programs));
 assert.equal(academicScoreTypes.length,20);
 for(const table of tables)assert.deepEqual(table.map(({type})=>type.id),academicScoreTypes.map(type=>type.id));
 const ap=table=>table.find(section=>section.type.id==='ap').rows;
 assert.equal(ap(tables[0])[0].admissionText,'3 科各 ≥4');
 assert.equal(ap(tables[0])[0].scholarshipText,'3 科各 ≥5');
 for(const table of tables.slice(1)){assert.equal(ap(table)[0].placeholder,true);assert.deepEqual(ap(table)[0].sources,[]);assert.equal(ap(table)[0].admissionStatus,'unspecified');assert.equal(ap(table)[0].admissionText,undefined);}
 assert.equal(ap(tables[1])[0].unreviewed,false);assert.equal(ap(tables[2])[0].unreviewed,true);
 const html=renderAcademicScores([b],{...ui,allPrograms:programs});
 assert.match(html,/data-academic-score="AP" class="academic-score-unlisted"/);assert.match(html,/无要求/);assert.doesNotMatch(html,/3 科各|test-guide|不作为本项考试/);
 assert.equal(JSON.stringify(programs),before);
});

test('score matrix uses the qualification table project order and keeps each project’s own evidence',()=>{
 const a=project('A'),b=project('B',[row({source:{...source,sourceId:'second-guide'}})]),c=project('C',[]),info=[];
 const html=renderAcademicScores([b,c,a],{...ui,programLabel:p=>'项目 '+p.id,registerInfo:fn=>(info.push(fn),String(info.length))});
 assert.deepEqual([...html.matchAll(/data-academic-score-program="([^"]+)"/g)].map(m=>m[1]),['B','C','A']);
 const ib=html.match(/<tbody data-academic-score-type="ib">(.*?)<\/tbody>/s)[1];
 assert.deepEqual([...ib.matchAll(/data-score-kind="([^"]+)"/g)].map(m=>m[1]),['admission','scholarship']);
 for(const rowHtml of ib.split('<tr ').slice(1))assert.deepEqual([...rowHtml.matchAll(/data-score-program="([^"]+)"/g)].map(m=>m[1]),['B','C','A']);
 assert.equal(info.length,2);
 assert.deepEqual(info.map(get=>[get().label,get().parts.flatMap(part=>part.sources||[]).map(s=>s.sourceId)]),[['项目 B · IB Diploma',['second-guide']],['项目 A · IB Diploma',['test-guide']]]);
 assert.equal((ib.match(/class="academic-score-kind">最低分/g)||[]).length,1);
 assert.equal((ib.match(/class="academic-score-kind">奖学金分/g)||[]).length,1);
});

test('a shared school table keeps missing score terms attached to only the projects missing them',()=>{
 const a=project('A',[row({qualification:'AP'})]),b=project('B'),c=project('C',[]);
 const table=buildAcademicScoreTable([a,b,c]);
 const ap=table.find(section=>section.type.id==='ap').rows;
 assert.equal(ap.length,2);assert.deepEqual(ap[0].programs,['A']);assert.deepEqual(ap[1].programs,['B','C']);
 const ib=table.find(section=>section.type.id==='ib').rows;
 assert.deepEqual(ib[0].programs,['B']);assert.deepEqual(ib[1].programs,['A','C']);
 for(const section of table)assert.deepEqual(new Set(section.rows.flatMap(row=>row.programs)),new Set(['A','B','C']));
});

test('shared score aliases preserve AS, awarding bodies, years and distinct diploma systems',()=>{
 const p=project('A',[
  row({id:'full',qualification:'GCE A-Level',admissionText:'AAA'}),
  row({id:'as',qualification:'UK GCE AS Level',admissionText:'仅按 AS 条件核对'}),
  row({id:'sg',qualification:'Singapore GCE A-Level',admissionText:'H2 三科'}),
  row({id:'ap',qualification:'Advanced Placement (AP)',admissionText:'各科 ≥4'}),
  row({id:'ossd',qualification:'Ontario Secondary School Diploma',admissionText:'六科平均 80%'}),
  row({id:'canada',qualification:'加拿大高中文凭',admissionText:'各省条件另核对'})
 ]),before=JSON.stringify(p),table=buildAcademicScoreTable([p]);
 const uk=table.find(section=>section.type.id==='gce-alevel').rows;
 assert.equal(uk.length,2);assert.deepEqual(uk.map(r=>r.originalQualification),['GCE A-Level','UK GCE AS Level']);
 assert.equal(table.find(section=>section.type.id==='singapore-alevel').rows[0].admissionText,'H2 三科');
 const catalog=buildAcademicScoreCatalog([p]);assert.equal(catalog.length,20);
 const html=renderAcademicScores([p],ui);for(const value of ['UK GCE AS Level','AAA','H2 三科','六科平均 80%','各省条件另核对'])assert.ok(html.includes(value));
 assert.equal(JSON.stringify(p),before);
});

test('a newly recorded score type joins the global catalog in both school and standalone project views',()=>{
 const seed=seedPrograms()[0],a={...structuredClone(seed),...project('A'),school:'学校甲'},b={...structuredClone(seed),...project('B',[row({qualification:'独立考试 Z'})]),school:'学校乙'};
 const all=[a,b],types=buildAcademicScoreCatalog(all);assert.equal(types.length,21);assert.equal(types.at(-1).label,'独立考试 Z');
 for(const p of all)assert.deepEqual(buildAcademicScoreTable([p],all).map(({type})=>type.id),types.map(type=>type.id));
 const view=createSchoolOverview(a.school,all,{...ui,button:()=>'',deferSections:true});
 for(const html of [view.renderSection('academic'),renderProjectDetail(a,{...ui,button:()=>'',allPrograms:all})])assert.match(html,/data-academic-score="独立考试 Z" class="academic-score-unlisted"/);
});
