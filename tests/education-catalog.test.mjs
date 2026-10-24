import test from 'node:test';
import assert from 'node:assert/strict';
import {seedPrograms} from '../lib/seed.mjs';
import {matchProgram} from '../lib/engine.mjs';
import {validateStudentEducation} from '../lib/education.mjs';
import {qualificationType,studentQualifications,educationReviewContext,educationContext,normalizeName,canonicalAccreditor} from '../public/education-model.js';
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
 ib:['IB','IB完整文凭','International Baccalaureate','International Baccalaureate Full Diploma','Swiss International Baccalaureate','International Baccalaureate（完整IB Diploma）'],
 abitur:['German Abitur','德国Abitur','Abitur (Germany)','Abitur Certificate'],
 baccalaureate:['法国Baccalaureate Diploma','Baccalauréat (France)','Baccalaureate Diploma','French Baccalauréat (France)','Baccalauréat Diploma'],
 'gce-alevel':['GCE Advanced Level','GCE Advanced Levels','GCE A Levels（须获认可为英国大学入学资格）','General Certificate of Education Advanced Level (GCE A-Level) in U.K.','GCE A level (United Kingdom)','GCE Advanced Level (A-Level)','General Certificate of Education (GCE) Advanced Level (A-Level)','General Certificate of Education Advanced Level（GCE A Level）','GCE A Level results'],
 'international-alevel':['International GCE Advanced Level','Cambridge International A Levels','International GCE A Level','International A Level results']
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

test('unclassified uploads stay in one review group; distinct predicates, names and dates remain available',()=>{
 const first=program('first',[{label:'新教育经历',all:[atom('verification.newCredential',true),atom('graduationDate','2027-03-01','春季截止','lte')]}]);
 const same=program('second',[{label:'另一种表述',all:[atom('verification.newCredential',true),atom('graduationDate','2027-09-01','秋季截止','lte')]}]);
 const different=program('third',[{label:'不同证书',all:[atom('verification.otherCredential',true)]}]);
 const rows=buildQualificationRows([first,same,different]),extra=rows.filter(r=>r.id.startsWith('path:'));
 assert.equal(extra.length,2);
 const shared=extra.find(r=>r.cells[0].pathIds.length);assert.deepEqual(shared.cells.map(c=>c.accepted),[false,false,false]);
 assert.deepEqual(shared.cells.map(c=>c.pathIds.length),[1,1,0]);
 assert.match(shared.cells[0].descriptions[0],/2027-03-01/);assert.match(shared.cells[1].descriptions[0],/2027-09-01/);
 const display=buildQualificationDisplayRows([first,same,different]);
 const grouped=display.find(r=>r.id==='unclassified-eligibility');
 assert.equal(grouped.members.length,2);assert.ok(!display.some(r=>r.id.startsWith('path:')));
 assert.ok(grouped.cells.every(c=>c.options.every(o=>o.state==='unknown')));
 const info=buildQualificationDecisionInfo(grouped,[first,same,different]);
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
 for(const name of Object.values(aliases).flat()){
  const s=student(name);s.qualifications[0].type='qualification:'+normalizeName(name);const before=JSON.stringify(s);
  assert.deepEqual(validateStudentEducation(s),[]);assert.equal(studentQualifications(s)[0].type,qualificationType(name).id);assert.equal(JSON.stringify(s),before);
 }
 assert.equal(studentQualifications({qualification:'IB'})[0].complete,null);
 assert.equal(studentQualifications({qualification:'Swiss International Baccalaureate'})[0].complete,null);
 assert.equal(studentQualifications({qualification:'GCE A Level results'})[0].level,'unknown');
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

test('university variants share a display group while credits, years, language and project evidence remain independent',()=>{
 const first=program('university-one',[{label:'海外大学一年（春季）',all:[atom('verification.overseasUniversityEnrollmentYears',1,'海外大学就读至少一年','gte'),atom('verification.credits',30,'取得30学分','gte'),atom('verification.englishCourse',true,'须英语授课')]}]);
 const second=program('university-two',[{label:'非日本四年制大学两年及62学分',all:[atom('verification.foreignUniversityEnrollment2Years',true,'海外大学完成两年'),atom('verification.credits',62,'取得62学分','gte'),atom('graduationDate','2027-03-31','完成截止','lte')]}]);
 const third=program('university-japan',[{label:'日本大学学习满两年',all:[atom('verification.bachelorStudyLocation','Japan','须在日本大学学习'),atom('verification.completedBachelorStudyYears',2,'完成两学年','gte')]}]);
 const programs=[first,second,third],before=JSON.stringify(programs),display=buildQualificationDisplayRows(programs),row=display.find(r=>r.id==='university-education');
 assert.equal(display.filter(r=>r.group==='education').length,4);
 assert.deepEqual(row.cells.map(c=>c.pathIds),[['p0'],['p0'],['p0']]);
 const info=buildQualificationDecisionInfo(row,programs,first.id),details=JSON.stringify(info);
 assert.match(details,/取得30学分/);assert.match(details,/须英语授课/);assert.doesNotMatch(details,/取得62学分/);
 assert.match(JSON.stringify(buildQualificationDecisionInfo(row,programs,second.id)),/62学分.*2027-03-31/);
 const s=student('IB Diploma');assert.equal(education(first,s),'unknown');
 s.projectEducation={[first.id]:{version:first.version,values:{'verification.overseasUniversityEnrollmentYears':1,'verification.credits':30},evidence:'按本项目核对大学成绩单',context:educationReviewContext(s)}};
 assert.equal(education(first,s),'unknown','English-medium requirement must not disappear');
 s.projectEducation[first.id].values['verification.englishCourse']=true;assert.equal(education(first,s),'pass');
 assert.equal(education(second,s),'unknown','same catalogue member is not shared student evidence');
 s.projectEducation[first.id].values['verification.credits']=29;assert.equal(education(first,s),'fail');
 assert.equal(JSON.stringify(programs),before);
});

test('education descriptions misplaced as certificates use the education catalogue without rewriting rule facts',()=>{
 const p=program('secondary',[{label:'高中毕业资格',all:[atom('qualification','日本高中或其他中等教育学校毕业资格'),atom('graduationDate','2027-03-31','毕业截止','lte')]}]);
 const before=JSON.stringify(p),rows=buildQualificationRows([p]),display=buildQualificationDisplayRows([p]);
 assert.equal(display.filter(r=>r.group==='curriculum').length,8);
 const cell=rows.find(r=>r.id==='japanese-secondary').cells[0];
 assert.deepEqual(cell.originals,['日本高中或其他中等教育学校毕业资格']);assert.match(cell.descriptions[0],/2027-03-31/);
 assert.equal(education(p,student('IB Diploma')),'fail');assert.equal(JSON.stringify(p),before);
 assert.ok(!educationImportVocabulary([p]).some(v=>v.classification&&v.label==='日本高中或其他中等教育学校毕业资格'));
});

test('future unknown names cannot expand the main education and curriculum tables per upload',()=>{
 const programs=Array.from({length:12},(_,i)=>program('upload-'+i,[{label:'待核教育经历'+i,all:[atom('verification.unreviewed'+i,true)]},{label:'待核证书'+i,all:[atom('qualification','Unreviewed Diploma '+i)]}]));
 const before=JSON.stringify(programs),display=buildQualificationDisplayRows(programs);
 assert.equal(display.filter(r=>r.group==='education').length,3);
 assert.equal(display.filter(r=>r.group==='curriculum').length,9,'eight core certificates plus one collapsed unclassified group');
 for(const id of ['unclassified-eligibility','other-credentials']){
  const row=display.find(r=>r.id===id);assert.equal(row.members.length,12);
  assert.ok(row.cells.every(c=>c.options.every(o=>o.state==='unknown')));
  assert.ok(JSON.stringify(buildQualificationDecisionInfo(row,programs)).includes('尚未归入标准类型'));
 }
 for(const p of programs){
  assert.deepEqual(buildQualificationDisplayRows([p],programs).map(r=>r.id),display.map(r=>r.id));
  assert.deepEqual(new Set(display.flatMap(r=>r.cells.find(c=>c.programId===p.id).pathIds)),new Set(p.paths.map(path=>path.id)));
 }
 assert.ok(educationImportVocabulary(programs).filter(v=>v.label.startsWith('Unreviewed')).every(v=>v.classification==='unclassified-source-expression'));
 assert.equal(JSON.stringify(programs),before);
});

test('A-Level results aliases do not imply full or AS eligibility, and ambiguous IB legacy records stay unverified',()=>{
 for(const name of ['GCE A Level results','International A Level results']){
  const p=program('results',[{all:[atom('qualification',name)]}]),row=buildQualificationDisplayRows([p]).find(r=>r.id===qualificationType(name).id);
  assert.deepEqual(row.cells[0].options.map(o=>o.state),['unknown','unknown']);assert.match(row.cells[0].scopeNote,/results/);
  for(const level of ['full','as'])assert.equal(education(p,studentQualificationsFixture(name,{level})),'unknown');
 }
 const full=program('full',[{all:[atom('qualification','GCE Advanced Level (A-Level)')]}]);
 assert.equal(education(full,studentQualificationsFixture('UK GCE AS Level',{level:'as'})),'fail');
 const ib=program('ib',[{all:[atom('qualification','Swiss International Baccalaureate')]}]);
 assert.equal(education(ib,studentQualificationsFixture('IB Diploma',{complete:false})),'fail');
 const legacy=student('IB Diploma');delete legacy.qualifications;legacy.qualification='Swiss International Baccalaureate';
 assert.equal(education(ib,legacy),'unknown');
});
function studentQualificationsFixture(name,extra){const s=student(name);Object.assign(s.qualifications[0],extra);return s;}

test('full accreditor names merge only explicit aliases and never bypass school, curriculum or unknown-issuer checks',()=>{
 const wasc='Western Association of Schools and Colleges (WASC)',p=program('school',[{all:[atom('accreditation',[wasc,'Cognia (NCA CASI, NWAC, SACS CASI)','Other Agency']),atom('international12',true)]}]);
 const rows=buildQualificationDisplayRows([p]),catalogue=buildQualificationCatalog([p]);
 assert.equal(catalogue.filter(r=>r.field==='accreditation').length,2);
 assert.equal(canonicalAccreditor(wasc),'WASC');assert.equal(canonicalAccreditor('CIS membership only'),'CIS membership only');
 assert.deepEqual(rows.find(r=>r.id==='accreditation').cells[0].options.filter(o=>o.state==='accepted').map(o=>o.id),['WASC','Cognia']);
 const s=student('IB Diploma');s.accreditations=[{name:'WASC'}];assert.equal(education(p,s),'unknown');
 s.accreditations[0]={name:'WASC',scope:true,context:educationContext(s)};assert.equal(education(p,s),'pass');
 s.school='另一所学校';assert.equal(education(p,s),'unknown');
 s.accreditations[0]={name:'COBIS',scope:true,context:educationContext(s)};assert.equal(education(p,s),'fail');
});

test('unresolved paths retain evidence in decision details without being marked accepted',()=>{
 const unresolved={...atom('verification.scope',null,'指定范围仍待核实'),state:'unspecified'};
 const p=program('pending',[{label:'范围不明确的认证课程',all:[atom('accreditation','WASC'),unresolved]},{label:'A-Level科目待核',all:[atom('qualification','GCE A-Level'),unresolved]}]);
 const rows=buildQualificationDisplayRows([p]);
 for(const id of ['accreditation','gce-alevel']){
  const row=rows.find(r=>r.id===id);assert.ok(row.cells[0].options.every(o=>o.state==='unknown'));
  assert.match(JSON.stringify(buildQualificationDecisionInfo(row,[p])),/指定范围仍待核实/);
 }
});

test('ECIS date descriptions share one institution row without making their matching scopes interchangeable',()=>{
 const early='ECIS（2003年法律分离前认可）',later='ECIS在2003年法律分离前的认可';
 const first=program('ecis-first',[{label:'认证路径一',all:[atom('accreditation',early),atom('international12',true),atom('graduationDate','2027-03-31','本项截止','lte')]}]);
 const second=program('ecis-second',[{label:'认证路径二',all:[atom('accreditation',later),atom('international12',true),atom('graduationDate','2027-09-01','本项截止','lte')]}]);
 const programs=[first,second],before=JSON.stringify(programs),catalogue=buildQualificationCatalog(programs);
 assert.equal(catalogue.filter(r=>r.field==='accreditation').length,2);assert.equal(catalogue.find(r=>r.id==='accreditation:ecis').label,'ECIS');
 const row=buildQualificationDisplayRows(programs).find(r=>r.id==='accreditation:ecis');
 assert.match(JSON.stringify(buildQualificationDecisionInfo(row,programs,first.id)),/2003年法律分离前认可.*2027-03-31/);
 assert.doesNotMatch(JSON.stringify(buildQualificationDecisionInfo(row,programs,first.id)),/2027-09-01/);
 const s=student('IB Diploma');s.accreditations=[{name:'ECIS',scope:true,context:educationContext(s)}];
 assert.equal(education(first,s),'fail','undated evidence cannot inherit an explicitly dated source qualification');
 s.accreditations[0].name=early;assert.equal(education(first,s),'pass');
 assert.equal(education(second,s),'fail','display grouping does not rewrite the raw recognition scope');
 assert.equal(JSON.stringify(programs),before);
});
