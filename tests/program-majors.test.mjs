import test from 'node:test';
import assert from 'node:assert/strict';
import {getProgramMajors,normalizeMajors,majorsFromText,majorsAreInferred,presentProgramMajors,matchesMajors,majorFilterOptions,unspecifiedMajor} from '../public/program-majors.js';
import {renderMajorEditor,gatherMajors,renderMajors} from '../public/program-majors-ui.js';
import {parseQuery,queryPrograms} from '../lib/query.mjs';
import {validateProgram} from '../lib/engine.mjs';
import {documentSchema,schemaFields,validateSchema} from '../lib/document-schema.mjs';
import {schoolYearPrograms,createSchoolOverview} from '../public/school-detail.js';
import {renderAdmissionContent} from '../public/admissions-content.js';
import {buildDocumentReview} from '../lib/document-organizer.mjs';
import {admissionsFixture,admissionsText} from './fixtures/admissions.mjs';
import {seedPrograms} from '../lib/seed.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,icon:()=>'',button:()=>'',evidence:()=>''};

test('legacy classification uses named disciplines, respects explicit values and never reads exam subjects',()=>{
 const legacy={name:'商学部',englishName:'College of Business',requirements:[{detail:'Mathematics, physics, chemistry'}]};
 const before=JSON.stringify(legacy),display=presentProgramMajors(legacy);
 assert.deepEqual(display.majors,['商学与管理']);assert.equal(display.majorsInferred,true);assert.equal(JSON.stringify(legacy),before);
 assert.deepEqual(getProgramMajors({...legacy,majors:[]}),[]);
 assert.deepEqual(getProgramMajors({...legacy,majors:[' Economics ','经济学','金融科技']}),['经济学','金融科技']);
 assert.equal(majorsAreInferred({...legacy,majors:['经济学']}),false);
 assert.deepEqual(getProgramMajors({name:'本科项目',requirements:legacy.requirements}),[]);
 assert.deepEqual(getProgramMajors({name:'社会学院媒体传播学科',englishName:'Department of Media and Communications, Faculty of Sociology',direction:'日语轨道'}),['新闻与传播']);
 assert.deepEqual(getProgramMajors({name:'计算机科学与工程',direction:'计算机与工程'}),['计算机与信息科学']);
 assert.deepEqual(getProgramMajors({name:'经济学部：数字商务与创新',englishName:'Digital Business and Innovation',direction:'DBI'}),['商学与管理']);
});

test('multi-major filters use OR within majors and preserve explicit unknowns and custom values',()=>{
 const p={majors:['经济学','计算机科学']},empty={name:'经济学',majors:[]};
 assert.equal(matchesMajors(p,'Computer Science'),true);
 assert.equal(matchesMajors(p,['法学','经济学']),true);assert.equal(matchesMajors(p,'法学'),false);
 assert.equal(matchesMajors(empty,unspecifiedMajor),true);assert.equal(matchesMajors(empty,'经济学'),false);
 assert.deepEqual(majorFilterOptions([p,empty,{majors:['金融科技']}]),['经济学','计算机与信息科学','金融科技',unspecifiedMajor]);
 assert.deepEqual(normalizeMajors(['','  ','Computer Science','计算机科学']),['计算机与信息科学']);
});

test('cultural studies do not imply chemistry while genuine chemistry disciplines remain searchable',()=>{
 for(const text of ['国际政策文化学科','国際政策文化学科','日本语日本文化学类','日本語・日本文化学類','人文文化学群']){
  assert.deepEqual(majorsFromText(text),text.includes('政策')?['公共政策','文学与语言文化']:['文学与语言文化'],text);
  assert.equal(matchesMajors({direction:text},'化学'),false,text);
 }
 for(const text of ['化学','应用化学科','応用化学科','化学工程','生物化学','Chemistry','Chemical Engineering','文化学科、化学科','化学与文化学']){
  assert.ok(majorsFromText(text).includes('化学'),text);
  assert.equal(matchesMajors({direction:text},'化学'),true,text);
 }
 assert.deepEqual(parseQuery('国际政策文化学专业').majors,['公共政策','文学与语言文化']);
});

test('chemistry with IELTS 6 excludes policy and teacher training, and keeps unknown thresholds uncertain',()=>{
 const seed=seedPrograms()[0],ielts=(score,minimumStatus)=>[{exam:'IELTS Academic Module',score,minimumStatus,source:{page:1}}];
 const programs=[
  {...seed,id:'policy',school:'中央大学',name:'综合政策学院',englishName:'総合政策学部',direction:'政策科学科、国际政策文化学科；只选一个',language:ielts(4.5,'stated')},
  {...seed,id:'teacher',school:'筑波大学',name:'Japan-Expert学士项目—日语教师培养方向',englishName:'Japan-Expert (Bachelor Degree) Program — Japanese Language Teacher Training Course',direction:'人文文化学群日本语日本文化学类／日语教师培养',language:ielts(null,'unspecified')},
  {...seed,id:'chemistry-6',majors:['化学'],language:ielts(6,'stated')},
  {...seed,id:'chemistry-6.5',majors:['化学'],language:ielts(6.5,'stated')},
  {...seed,id:'chemistry-unknown',majors:['化学'],language:ielts(null,'unspecified')},
  {...seed,id:'chemistry-no-minimum',majors:['化学'],language:ielts(null,'no-minimum')},
  {...seed,id:'chemistry-inferred',direction:'应用化学科',language:ielts(6,'stated')}
 ];
 const before=JSON.stringify(programs),query=parseQuery('化学专业，雅思6分能去的项目');
 assert.deepEqual(query.majors,['化学']);assert.equal(query.exam,'IELTS Academic Module');assert.equal(query.maxScore,6);assert.deepEqual(query.unsupported,[]);
 for(const input of [programs,programs.map(presentProgramMajors)]){
  const answer=queryPrograms(query,input);
  assert.deepEqual(answer.matched.map(p=>p.id),['chemistry-6','chemistry-no-minimum']);
  assert.deepEqual(answer.uncertain.map(p=>p.id),['chemistry-unknown','chemistry-inferred']);
  assert.match(answer.uncertain[0].reasons.join(' '),/无法确认 6 分是否达到语言要求/);
  assert.match(answer.uncertain[1].reasons.join(' '),/专业根据已有项目名称／方向归类，待核对/);
  assert.doesNotMatch(answer.matched.flatMap(p=>p.reasons).join(' '),/无法确认/);
 }
 assert.equal(JSON.stringify(programs),before);
});

test('query combines major, intake and score without changing eligibility rules',()=>{
 const p=seedPrograms()[0],legacy={...p,id:'legacy',direction:'经济学'},known={...p,id:'known',majors:['经济学','计算机科学']},other={...p,id:'other',majors:['法学']};
 const before=JSON.stringify([legacy,known,other]),query={majors:['经济学'],intake:p.rounds[0].intake};
 const result=queryPrograms(query,[legacy,known,other]);
 assert.deepEqual(result.matched.map(p=>p.id),['known']);assert.deepEqual(result.uncertain.map(p=>p.id),['legacy']);
 assert.match(result.uncertain[0].reasons.join(' '),/归类，待核对/);
 assert.equal(queryPrograms({...query,intake:'2099-01'},[known]).matched.length,0);
 const exam=p.language[0];assert.equal(queryPrograms({...query,exam:exam.exam,maxScore:0},[known]).matched.length,0);
 assert.equal(JSON.stringify([legacy,known,other]),before);
 const parsed=parseQuery('经济学或计算机专业，2027年9月雅思6.5分');
 assert.deepEqual(parsed.majors,['经济学','计算机与信息科学']);assert.equal(parsed.direction,null);assert.equal(parsed.maxScore,6.5);assert.equal(parsed.intake,'2027-09');assert.deepEqual(parsed.unsupported,[]);
 assert.ok(parseQuery('不想学经济学专业').unsupported.length);
 assert.ok(parseQuery('数学考试要几分').unsupported.length);assert.deepEqual(parseQuery('数学考试要几分').majors,[]);
});

test('school major filter covers year, application and transfer and all matrix sections',()=>{
 const seed=seedPrograms()[0],school='测试大学';
 const ps=[{...seed,school,id:'a',name:'经济项目',majors:['经济学'],channel:'一年级入学'},{...seed,school,id:'b',name:'法律项目',majors:['法学'],channel:'一年级入学'},{...seed,school,id:'c',name:'经济编入',majors:['经济学'],channel:'三年级编入'},{...seed,school,id:'d',name:'旧年度',year:2026,majors:['经济学']}];
 const view=schoolYearPrograms(school,ps,{year:2027,major:'经济学'});
 assert.deepEqual(view.programs.map(p=>p.id),['a']);assert.deepEqual(view.counts,{application:1,transfer:1});
 assert.deepEqual(schoolYearPrograms(school,ps,{year:2027,major:'经济学',entryGroup:'transfer'}).programs.map(p=>p.id),['c']);
 const overview=createSchoolOverview(school,ps,{...ui,deferSections:true},{year:2027,major:'经济学'});
 assert.match(overview.html,/data-school-major/);assert.match(overview.html,/经济项目/);assert.doesNotMatch(overview.html,/法律项目/);
 assert.doesNotMatch(overview.renderSection('language'),/法律项目/);
 const empty=createSchoolOverview(school,ps,{...ui,deferSections:true},{major:'法学',entryGroup:'transfer'});
 assert.match(empty.html,/没有符合所选专业/);assert.match(empty.html,/data-school-major/);
});

test('strict import requires majors, legacy stored rules remain valid, and manual values are validated',()=>{
 const fixture=admissionsFixture();assert.deepEqual(validateSchema(fixture),[]);
 delete fixture.programs[0].majors;assert.ok(validateSchema(fixture).some(e=>e.includes('/majors')));
 assert.deepEqual(validateSchema(schemaFields(fixture.programs[0]),documentSchema.$defs.program),[]);
 const p=seedPrograms()[0];assert.deepEqual(validateProgram(p),[]);
 assert.ok(validateProgram({...p,majors:'经济学'}).some(e=>e.includes('专业')));
 assert.ok(validateProgram({...p,majors:['']}).some(e=>e.includes('专业')));
 assert.deepEqual(validateProgram({...p,majors:['金融科技']}),[]);
});

test('review exposes professional changes with doubt highlighting and manual editing round-trips multi values',()=>{
 const doc={id:'major-review',filename:'example.pdf',text:admissionsText},input=admissionsFixture();
 const original=buildDocumentReview(input,doc,[]).entries[0].program;
 input.programs[0].majors=['经济学','Business'];
 const entry=buildDocumentReview(input,doc,[{...original,version:1}]).entries[0];
 assert.deepEqual(entry.program.majors,['经济学','商学与管理']);assert.ok(entry.changes.some(c=>c.field==='majors'));
 assert.match(renderAdmissionContent(entry.program,ui,[{path:'/majors/0',reason:'核对专业'}]),/admission-doubt/);
 const fd=new FormData();fd.append('majorTag','经济学');fd.append('majorTag','计算机与信息科学');fd.append('majorOther','金融科技，Economics');
 assert.deepEqual(gatherMajors(fd),['经济学','计算机与信息科学','金融科技']);
 assert.deepEqual(gatherMajors(new FormData()),[]);
 const malicious={majors:['<img src=x onerror=alert(1)>']};
 assert.doesNotMatch(renderMajors(malicious,esc),/<img/);assert.doesNotMatch(renderMajorEditor(malicious,esc),/<img/);
});
