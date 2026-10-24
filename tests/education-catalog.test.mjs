import test from 'node:test';
import assert from 'node:assert/strict';
import {seedPrograms} from '../lib/seed.mjs';
import {matchProgram} from '../lib/engine.mjs';
import {validateStudentEducation} from '../lib/education.mjs';
import {qualificationType,studentQualifications,educationReviewContext,normalizeName} from '../public/education-model.js';
import {educationImportVocabulary} from '../public/education-catalog.js';
import {buildQualificationCatalog,buildQualificationRows,buildQualificationDisplayRows,buildQualificationDecisionInfo} from '../public/qualification-matrix.js';
import {extractDocumentRules} from '../lib/document-ai.mjs';
import {admissionsFixture,admissionsText} from './fixtures/admissions.mjs';

const source={sourceId:'qualification-fixture',page:'3',quote:'Original admission qualification and all its conditions.'};
const atom=(field,value=true,label=field,op=Array.isArray(value)?'in':'eq')=>({field,value,op,label,source});
const program=(id,paths)=>({...structuredClone(seedPrograms()[0]),...admissionsFixture().programs[0],id,semanticVersion:1,paths:paths.map((path,i)=>({id:'p'+i,source,...path}))});
const credential=(name,extra={})=>({id:'q',name,type:qualificationType(name)?.id||'other',complete:true,status:'completed',date:'2026-06-30',...extra});
const student=name=>({school:'School',schoolCountry:'中国',curriculum:'国际课程',educationYears:12,formalEducation:true,educationStatus:'completed',graduationDate:'2026-06-30',qualifications:[credential(name)]});
const education=(p,s)=>matchProgram(s,p,p.rounds[0]).education.state;

// Spellings actually present in the 2026-10-24 catalogue. They must not create
// one field per spelling, and their original values must remain in each rule.
const aliases={
 ib:['IB','IB完整文凭','International Baccalaureate','International Baccalaureate Full Diploma'],
 abitur:['German Abitur','德国Abitur','Abitur (Germany)'],
 baccalaureate:['法国Baccalaureate Diploma','Baccalauréat (France)','Baccalaureate Diploma','French Baccalauréat (France)'],
 'gce-alevel':['GCE Advanced Level','GCE Advanced Levels','GCE A Levels（须获认可为英国大学入学资格）','General Certificate of Education Advanced Level (GCE A-Level) in U.K.','GCE A level (United Kingdom)'],
 'international-alevel':['International GCE Advanced Level','Cambridge International A Levels','International GCE A Level']
};
test('imported certificate spellings share the existing types and preserve original values and conditions',()=>{
 const programs=Object.entries(aliases).flatMap(([type,names])=>names.map((name,i)=>program(type+i,[{label:name,all:[atom('qualification',name),atom('graduationDate','2027-03-01','本项目截止日','lte')]}])));
 const before=JSON.stringify(programs),catalog=buildQualificationCatalog(programs),rows=buildQualificationRows(programs);
 assert.equal(catalog.filter(r=>r.group==='curriculum').length,8);
 for(const [type,names] of Object.entries(aliases))for(const [i,name] of names.entries()){
  assert.equal(qualificationType(name)?.id,type,name);
  const cell=rows.find(r=>r.id===type).cells.find(c=>c.programId===type+i);
  assert.deepEqual(cell.originals,[name]);assert.deepEqual(cell.pathIds,['p0']);assert.match(cell.descriptions[0],/2027-03-01/);
 }
 assert.equal(JSON.stringify(programs),before);
 assert.ok(!qualificationType('Singapore GCE A-Level'));
 const singapore=program('SG',[{all:[atom('qualification','Singapore GCE A-Level')]}]);
 assert.equal(buildQualificationRows([singapore],programs.concat(singapore)).find(r=>r.id==='gce-alevel').cells[0].accepted,false);
 assert.equal(buildQualificationCatalog([...programs,singapore]).filter(r=>r.group==='curriculum').length,9);
 const singaporeDisplay=buildQualificationDisplayRows([singapore],programs.concat(singapore)).find(r=>r.id==='qualification:singaporegcealevel');
 assert.equal(singaporeDisplay.cells[0].options.length,1,'an unknown national qualification must not inherit the UK full/AS model');
});

test('equivalent education route names map to one shared row without changing project predicates',()=>{
 const variants=[
  ['本科两学年甲','学士学位课程正式学生完成两完整学年','verification.bachelorDegreeSeekingFullYears',2,'bachelor-two-years'],
  ['本科两学年乙','学士学位授予机构正式学位生两完整学年','verification.bachelorInstitutionTwoFullYears',true,'bachelor-two-years'],
  ['本科两学年丙','授予学士学位机构的正式学位生完成两个完整学年','verification.twoFullBachelorYears',true,'bachelor-two-years'],
  ['日本高中','日本高中或中等教育学校毕业','verification.japanHighSchoolGraduation',true,'japanese-secondary'],
  ['海外设施','文部科学大臣指定境外高中等同课程','verification.mextOverseasHighSchoolEquivalent',true,'overseas-mext'],
  ['专修一','指定专修学校高等课程','verification.mextDesignatedSpecializedTrainingAdvancedCourse',true,'specialized-secondary'],
  ['专修二','完成文部科学省指定专修学校高等课程','verification.designatedSpecializedUpperSecondary',true,'specialized-secondary'],
  ['国民高中一','①所在地国家教育体系下的公立或私立高中','verification.localNationalSystemHighSchool',true,'national-secondary'],
  ['国民高中二','所在国国民教育体系下的公立或私立高中','verification.nationalSystemHighSchool',true,'national-secondary'],
  ['名单一','④文部科学省网站所列学校课程','verification.mextListedSchoolProgram',true,'mext-listed-program'],
  ['名单二','文部科学省网页列明的学校课程','verification.mextListedSchoolProgram',true,'mext-listed-program']
 ];
 const programs=variants.map(([id,label,field,value],i)=>program(id,[{label,all:[atom(field,value,label),atom('graduationDate',i%2?'2027-03-31':'2027-08-31','实际完成期限','lte')]}])),before=JSON.stringify(programs);
 const raw=buildQualificationRows(programs),display=buildQualificationDisplayRows(programs);
 assert.equal(display.filter(r=>r.group==='education').length,4);
 assert.ok(!raw.some(r=>r.id.startsWith('path:')));
 for(const [id,,field,value,type] of variants){
  const p=programs.find(p=>p.id===id),row=raw.find(r=>r.id===type),cell=row.cells.find(c=>c.programId===id);
  assert.deepEqual(cell.pathIds,['p0']);assert.match(cell.descriptions[0],/2027-/);
  assert.equal(education(p,student('IB Diploma')),'unknown','classification is not evidence of this student satisfying a verification condition');
  const s=student('IB Diploma');s.projectEducation={[id]:{version:p.version,values:{[field]:value},evidence:'Checked source and certificate',context:educationReviewContext(s)}};
  assert.equal(education(p,s),'pass');
 }
 assert.deepEqual(buildQualificationDisplayRows([programs[0]],programs).map(r=>r.id),buildQualificationDisplayRows([programs.at(-1)],programs).map(r=>r.id));
 assert.equal(JSON.stringify(programs),before);
});

test('new unmatched paths compare predicates before adding fields; genuinely different conditions stay distinct',()=>{
 const first=program('first',[{label:'新教育经历',all:[atom('verification.newCredential',true),atom('graduationDate','2027-03-01','春季截止','lte')]}]);
 const same=program('second',[{label:'另一种表述',all:[atom('verification.newCredential',true),atom('graduationDate','2027-09-01','秋季截止','lte')]}]);
 const different=program('third',[{label:'不同证书',all:[atom('verification.otherCredential',true)]}]);
 const rows=buildQualificationRows([first,same,different]),extra=rows.filter(r=>r.id.startsWith('path:'));
 assert.equal(extra.length,2);
 const shared=extra.find(r=>r.cells[0].accepted);assert.deepEqual(shared.cells.map(c=>c.accepted),[true,true,false]);
 assert.match(shared.cells[0].descriptions[0],/2027-03-01/);assert.match(shared.cells[1].descriptions[0],/2027-09-01/);
 const info=buildQualificationDecisionInfo(buildQualificationDisplayRows([first,same,different]).find(r=>r.id===shared.id),[first,same,different]);
 assert.ok(JSON.stringify(info).includes('另一种表述'));
});

test('mapped verification degrees retain non-transfer recognition and all constraints',()=>{
 const transfer=program('transfer',[{label:'取得文科或理科副学士学位',all:[atom('verification.associateArtsScience',true,'Arts或Science学位；入学前完成')]}]);
 const first=program('first',[{label:'完整IB',all:[atom('qualification','IB Diploma')]}]);
 const rows=buildQualificationRows([first,transfer]);
 for(const id of ['associate-arts','associate-science'])assert.deepEqual(rows.find(r=>r.id===id).cells.map(c=>c.accepted),[false,true]);
 assert.equal(education(transfer,student('Associate Degree in Arts')),'unknown');
});

test('synonyms match in the backend without dropping AS, issuer, country, deadline or UK entry restrictions',()=>{
 const ib=program('ib',[{all:[atom('qualification','IB完整文凭')]}]);assert.equal(education(ib,student('International Baccalaureate Full Diploma')),'pass');
 const full=program('full',[{all:[atom('qualification','GCE Advanced Level')]}]);
 const s=student('UK GCE AS Level');s.qualifications[0].level='as';assert.equal(education(full,s),'fail');
 const cambridge=program('cambridge',[{all:[atom('qualification','Cambridge International A Levels')]}]);
 s.qualifications=[credential('International A-Level',{level:'full'})];assert.equal(education(cambridge,s),'unknown');
 s.qualifications[0].awardingBody='缩写待核实';assert.equal(education(cambridge,s),'unknown');
 s.qualifications[0].awardingBody='Pearson Edexcel';assert.equal(education(cambridge,s),'fail');
 s.qualifications[0].awardingBody='Cambridge';assert.equal(education(cambridge,s),'pass');
 s.qualifications[0].date='2028-01-01';assert.equal(education(cambridge,s),'fail');
 const uk=program('uk',[{all:[atom('qualification','GCE A Levels（须获认可为英国大学入学资格）')]}]);
 s.qualifications=[credential('GCE A-Level',{level:'full'})];assert.equal(education(uk,s),'unknown');
 s.qualifications[0].ukUniversityEntrance=true;assert.equal(education(uk,s),'pass');
 const french=program('fr',[{all:[atom('qualification','法国Baccalaureate Diploma')]}]);
 assert.equal(education(french,student('Baccalauréat (France)')),'pass');
 assert.equal(education(french,student('Baccalaureate Diploma')),'unknown');
 const nonFrench=student('French Baccalaureate');nonFrench.qualifications[0].credentialCountry='其他国家';assert.equal(education(french,nonFrench),'fail');
});

test('old dynamic qualification identifiers remain readable and saveable; scalar ambiguity is retained',()=>{
 for(const name of ['IB完整文凭','German Abitur','Cambridge International A Levels']){
  const s=student(name);s.qualifications[0].type='qualification:'+normalizeName(name);const before=JSON.stringify(s);
  assert.deepEqual(validateStudentEducation(s),[]);assert.equal(studentQualifications(s)[0].type,qualificationType(name).id);assert.equal(JSON.stringify(s),before);
 }
 assert.equal(studentQualifications({qualification:'IB'})[0].complete,null);
 assert.equal(studentQualifications({qualification:'UK GCE AS Level'})[0].level,'as');
 const bad=student('IB Diploma');bad.qualifications[0].type='dse';assert.ok(validateStudentEducation(bad).length);
});

test('future model extraction receives the current vocabulary, not another project acceptance rules',async()=>{
 const existing=program('existing',[{label:'新增资格',all:[atom('qualification','New Diploma'),atom('graduationDate','2037-01-01','不得复用其他学校的截止日','lte')]}]);
 const vocabulary=educationImportVocabulary([existing]);
 assert.ok(vocabulary.some(r=>r.id==='ib'&&r.aliases.includes('IB完整文凭')));assert.ok(vocabulary.some(r=>r.label==='New Diploma'));
 const extracted=admissionsFixture();
 await extractDocumentRules({filename:'fixture.pdf',text:admissionsText},{apiKey:'fake-test',model:'test'},{educationCatalogue:vocabulary,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content[0].text);
  assert.deepEqual(input.educationCatalogue,vocabulary);assert.match(body.instructions,/先匹配.*再考虑新增/);assert.doesNotMatch(JSON.stringify(input.educationCatalogue),/2037-01-01|不得复用/);
  return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(extracted)}]}]});
 }});
});
