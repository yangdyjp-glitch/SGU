import test from 'node:test';
import assert from 'node:assert/strict';
import { seedPrograms } from '../lib/seed.mjs';
import { matchProgram } from '../lib/engine.mjs';
import { validateStudentEducation, educationFacts } from '../lib/education.mjs';
import { qualificationTypes, qualificationType, studentQualifications, studentAccreditations, educationContext, educationReviewContext, commonAccreditors } from '../public/education-model.js';
import { buildQualificationCatalog, buildQualificationRows, buildQualificationDisplayRows, buildQualificationDecisionInfo, renderQualificationMatrix } from '../public/qualification-matrix.js';
import { renderDetailInfoContent } from '../public/detail-hints.js';
import { exampleStudents } from './fixtures/students.mjs';
const source={sourceId:'fixture',page:1,ruleId:'edu-test'};
const atom=(field,value,op=Array.isArray(value)?'in':'eq',label=field)=>({field,value,op,label,source});
const fixture=(rules)=>{const p=structuredClone(seedPrograms()[0]);p.paths=[{id:'path',label:'独立测试路径',all:rules,source}];return p;};
const student=()=>({...structuredClone(exampleStudents()[0]),educationVersion:2,school:'甲校',curriculum:'IB',schoolCountry:'中国',schoolType:'regular',educationYears:12,formalEducation:true,educationStatus:'completed',graduationDate:'2026-06-30',qualifications:[]});
const record=(name,extra={})=>({id:name,type:qualificationType(name)?.id||'other',name,complete:true,status:'completed',date:'2026-06-30',...extra});
const run=(s,p)=>matchProgram(s,p,p.rounds[0]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,icon:()=>'',evidence:()=>''};

test('one shared catalogue has three dimensions and eight main curricula; aliases retain original values',()=>{
  assert.equal(qualificationTypes.filter(q=>q.group==='curriculum').length,8);
  for(const [name,id] of [['UK GCE AS and A levels','gce-alevel'],['GCE A-Level（具英国大学入学资格）','gce-alevel'],['International GCE A-Level','international-alevel'],['International AS and A levels','international-alevel'],['French Baccalaureate','baccalaureate'],['Baccalauréat','baccalaureate'],['HKDSE','dse']])assert.equal(qualificationType(name)?.id,id,name);
  const a=fixture([atom('qualification','UK GCE AS and A levels')]),b=fixture([atom('qualification','Associate Degree in Arts')]);b.id='TRANSFER';b.channel='三年级编入';
  const all=[a,b],before=JSON.stringify(all);
  assert.deepEqual(buildQualificationRows([a],all).map(r=>[r.id,r.label]),buildQualificationRows([b],all).map(r=>[r.id,r.label]));
  const row=buildQualificationRows([a],all).find(r=>r.id==='gce-alevel');assert.deepEqual(row.cells[0].originals,['UK GCE AS and A levels']);assert.equal(JSON.stringify(all),before);
  const french=buildQualificationRows(seedPrograms()).find(r=>r.id==='baccalaureate');assert.deepEqual(french.cells[0].originals,['Baccalaureate']);assert.doesNotMatch(french.cells[0].scopeNote,/IB Diploma|GCE/);
});
test('six accreditors share one field, partial scope is highlighted, other accreditors have separate universal fields',()=>{
  const p=fixture([atom('accreditation',['WASC','COBIS','Other Agency']),atom('international12',true)]),other=fixture([atom('standard12',true)]);other.id='SECOND';
  const all=[p,other],rows=buildQualificationRows([p],all),common=rows.find(r=>r.id==='accreditation');
  assert.equal(buildQualificationCatalog(all).filter(r=>r.field==='accreditation').length,2);
  assert.equal(common.cells[0].partial,true);assert.match(common.cells[0].scopeNote,/WASC、COBIS/);assert.match(common.cells[0].scopeNote,/NEASC/);
  const exception=rows.find(r=>r.label==='Other Agency');assert.ok(exception.cells[0].accepted);assert.equal(buildQualificationRows([other],all).find(r=>r.id===exception.id).cells[0].accepted,false);
  const html=renderQualificationMatrix([p],all,ui);assert.match(html,/qualification-hint/);assert.match(html,/aria-hidden="true">!<\/span>/);assert.match(html,/qualification-scope-note/);assert.equal((html.match(/data-qualification-group=/g)||[]).length,3);
});
test('education presentation groups are shared across projects and preserve every original path and condition',()=>{
  const a=fixture([atom('qualification','Associate Degree in Arts'),atom('graduationDate','2027-03-31','lte','须于2027年3月31日前取得学位')]);
  const b=fixture([atom('designated11',true)]);b.id='MEXT';
  b.paths.push({id:'university',label:'学士授予机构正式学位生完成两学年',all:[atom('verification.twoFullBachelorAcademicYears',true)],source});
  const all=[a,b],before=JSON.stringify(all),raw=buildQualificationRows(all,all),display=buildQualificationDisplayRows(all,all);
  assert.equal(raw.filter(row=>row.group==='education').length,13);
  assert.equal(display.filter(row=>row.group==='education').length,4);
  assert.deepEqual(buildQualificationDisplayRows([a],all).map(row=>[row.id,row.label]),buildQualificationDisplayRows([b],all).map(row=>[row.id,row.label]));
  for(const row of raw){
    const displayed=display.find(item=>item.id===row.id||item.members?.some(member=>member.id===row.id));
    assert.ok(displayed,row.id);
    for(const cell of row.cells)for(const id of cell.pathIds)assert.ok(displayed.cells.find(item=>item.programId===cell.programId).pathIds.includes(id),`${row.id}/${cell.programId}/${id}`);
    if(displayed.members)assert.deepEqual(displayed.members.find(member=>member.id===row.id).conditions,row.conditions);
  }
  assert.deepEqual(display.filter(row=>row.group!=='education').map(row=>({...row,cells:row.cells.map(({options,...cell})=>cell)})),raw.filter(row=>row.group!=='education'));
  assert.equal(JSON.stringify(all),before);
});
test('grouped degree and MEXT scopes retain partial acceptance, full details and independent matching',()=>{
  const p=fixture([atom('qualification','Associate Degree in Arts'),atom('graduationDate','2027-03-31','lte','须于2027年3月31日前取得学位')]);
  const m=fixture([atom('designated11',true),atom('ageAtEnrollment',18,'gte','入学时年满18岁')]);m.id='MEXT';
  const all=[p,m],rows=buildQualificationDisplayRows(all),degree=rows.find(row=>row.id==='associate-degree'),mext=rows.find(row=>row.id==='mext-schools');
  assert.equal(degree.cells[0].partial,true);
  assert.deepEqual(degree.cells[0].members.map(member=>[member.id,member.accepted]),[['associate-arts',true],['associate-science',false]]);
  assert.equal(degree.cells[1].accepted,false);
  assert.match(degree.cells[0].scopeNote,/可申请：Associate Degree in Arts.*需核实：Associate Degree in Science/);
  assert.match(degree.memberDetails.find(detail=>detail.label==='Associate Degree in Arts'&&detail.programs.includes(p.id)).text,/2027年3月31日/);
  assert.deepEqual(mext.cells[1].members.filter(member=>member.accepted).map(member=>member.id),['designated11']);
  assert.match(mext.memberDetails.find(detail=>detail.label==='MEXT指定十一年课程'&&detail.programs.includes(m.id)).text,/18岁/);
  const html=renderQualificationMatrix([p],all,ui),row=html.match(/<tr data-qualification="associate-degree"[^>]*>([\s\S]*?)<\/tr>/)?.[1];
  assert.match(row,/qualification-hint/);assert.match(row,/qualification-scope-note accepted[^>]*>可：Arts/);
  assert.match(row,/Associate Degree in Science/);assert.match(row,/须于2027年3月31日前取得学位/);
  assert.match(html,/data-qualification-label="[^"]*associate of arts[^"]*associate of science/);
  const s=student();s.qualifications=[record('Associate Degree in Science')];assert.equal(run(s,p).education.state,'fail');
  s.qualifications=[record('Associate Degree in Arts')];assert.equal(run(s,p).education.state,'pass');
  s.graduationDate='2028-06-30';s.qualifications[0].date='2028-06-30';assert.equal(run(s,p).education.state,'fail');
});
test('all named education variants and no named variants have distinct grouped statuses',()=>{
  const p=fixture([atom('standard12',true)]);
  p.paths.push({id:'japan',all:[atom('verification.japaneseSecondaryGraduation',true)],source},{id:'overseas',all:[atom('international12',true)],source});
  p.paths.push({id:'prep',all:[atom('shortSchool',true),atom('preparatory',true)],source},{id:'japan-prep',all:[atom('verification.japanForeignNon12Secondary',true),atom('preparatory',true)],source});
  const other=fixture([atom('qualification','IB Diploma')]);other.id='OTHER';
  const row=buildQualificationDisplayRows([p,other]).find(row=>row.id==='secondary-education');
  assert.equal(row.cells[0].accepted,true);assert.equal(row.cells[0].partial,false);
  assert.deepEqual(row.cells[0].pathIds,['path','japan','overseas','prep','japan-prep']);
  assert.equal(row.cells[1].accepted,false);assert.equal(row.cells[1].partial,false);
});
test('display decisions distinguish listed, explicitly excluded and unknown education types',()=>{
  const programs=seedPrograms(),before=JSON.stringify(programs),rows=buildQualificationDisplayRows(programs);
  const secondary=rows.find(row=>row.id==='secondary-education');
  assert.deepEqual(secondary.cells[0].options.map(option=>[option.id,option.state]),[['standard12','accepted'],['japanese-secondary','unknown'],['international12','unknown'],['preparatory','accepted'],['japan-foreign-preparatory','unknown']]);
  assert.match(secondary.cells[0].options[1].detail,/满足时可按.*十二年正规学校课程.*学校所在地本身不表示被排除/);
  const mext=rows.find(row=>row.id==='mext-schools'),jdp=mext.cells.find(cell=>cell.programId==='JDP');
  assert.equal(jdp.options.find(option=>option.id==='specialized-secondary').state,'excluded');
  assert.equal(jdp.options.find(option=>option.id==='overseas-mext').state,'unknown');
  const rejected=jdp.options.find(option=>option.id==='specialized-secondary');
  assert.ok(rejected.sources.some(source=>source.ruleId==='R013'));
  assert.ok(rows.find(row=>row.id==='ossd').cells.every(cell=>cell.options[0].state==='unknown'));
  const html=renderQualificationMatrix(programs,programs,ui);
  assert.match(html,/qualification-result accepted[^>]*>1项可<\/button>/);
  assert.match(html,/qualification-result unknown[^>]*>待核<\/button>/);
  assert.doesNotMatch(html,/>部分<|未单独列明或不适用/);
  assert.equal(JSON.stringify(programs),before);
});
test('merging education rows preserves each member decision and the full preparatory requirements',()=>{
  const programs=seedPrograms(),rows=buildQualificationDisplayRows(programs);
  assert.ok(!rows.some(row=>['preparatory-education','mext-equivalent'].includes(row.id)));
  const education=rows.find(row=>row.id==='secondary-education'),mext=rows.find(row=>row.id==='mext-schools');
  assert.equal(education.label,'高中教育与预备教育');assert.equal(mext.label,'MEXT认定／指定课程');
  assert.deepEqual(mext.members.map(member=>member.id),['mext-equivalent','japanDesignated12','overseas-mext','designated11','specialized-secondary']);
  const jdp=education.cells.find(cell=>cell.programId==='JDP');
  assert.deepEqual(jdp.options.filter(option=>option.state==='accepted').map(option=>option.id),['standard12']);
  assert.equal(jdp.options.find(option=>option.id==='preparatory').state,'excluded');
  const other=education.cells.find(cell=>cell.programId==='GLA').options.find(option=>option.id==='preparatory');
  assert.match(other.shortLabel,/＋指定预科/);assert.match(other.detail,/少于12年.*MEXT认可.*预备教育/);
  const html=renderQualificationMatrix(programs,programs,ui);
  assert.match(html,/查看高中教育与预备教育的完整附加条件与适用说明/);
  assert.match(html,/高中或以上学力须本校认定；入学前满18岁；申请期开始前3周联系招生办并提交指定咨询页。/);
  assert.match(html,/International Admissions Office/,'original individual review conditions must still be available');
});
test('full A-Level, AS and certification members retain their specific acceptance scope',()=>{
  const full=fixture([atom('qualification','GCE A-Level')]),as=fixture([atom('qualification','UK GCE AS and A levels'),atom('verification.subjectGrades',true)]);as.id='AS';
  const rows=buildQualificationDisplayRows([full,as]),alevel=rows.find(row=>row.id==='gce-alevel');
  assert.deepEqual(alevel.cells.map(cell=>cell.options.map(option=>option.state)),[['accepted','excluded'],['accepted','unknown']]);
  const info=buildQualificationDecisionInfo(alevel,[full,as],as.id);
  assert.ok(info.parts.filter(part=>part.rows).every(part=>part.title==='AS'));
  assert.ok(info.parts.some(part=>part.rows?.some(row=>row.state==='unknown'&&/仅 AS/.test(row.label))));
  const p=fixture([atom('accreditation',['WASC','COBIS']),atom('international12',true),atom('graduationDate','2027-03-31','lte','须于2027-03-31前取得资格')]);
  const certification=buildQualificationDisplayRows([p]).find(row=>row.id==='accreditation').cells[0].options;
  assert.deepEqual(certification.filter(option=>option.state==='accepted').map(option=>option.id),['WASC','COBIS']);
  assert.equal(certification.filter(option=>option.state==='unknown').length,4);
  assert.ok(certification.filter(option=>option.state==='accepted').every(option=>/2027-03-31/.test(option.detail)));
  assert.equal(buildQualificationDisplayRows(seedPrograms()).find(row=>row.id==='baccalaureate').cells[0].options[0].state,'accepted');
});
test('certification-specific conditions and sources do not leak into another member',()=>{
  const p=fixture([atom('accreditation','WASC'),atom('international12',true),atom('graduationDate','2027-03-31','lte','WASC须于2027-03-31前完成')]);
  const otherSource={...source,page:8};
  p.paths.push({id:'cobis',all:[atom('accreditation','COBIS'),atom('international12',true),atom('graduationDate','2026-12-01','lte','COBIS须于2026-12-01前完成')],source:otherSource});
  const options=buildQualificationDisplayRows([p]).find(row=>row.id==='accreditation').cells[0].options;
  assert.match(options.find(option=>option.id==='WASC').detail,/2027-03-31/);
  assert.doesNotMatch(options.find(option=>option.id==='WASC').detail,/2026-12-01/);
  assert.deepEqual(options.find(option=>option.id==='COBIS').sources,[otherSource]);
});
test('curriculum requirements remain additional conditions, not alternative qualification paths',()=>{
  const p=fixture([atom('qualification','HKDSE')]);p.semanticVersion=1;
  p.requirements=[{id:'hkdse-grades',topic:'HKDSE',stage:'申请',nature:'硬性',detail:'HKDSE成绩及科目须满足对应门槛',source:{...source,quote:'HKDSE candidates must meet the subject score requirements.'}}];
  const row=buildQualificationDisplayRows([p]).find(row=>row.id==='dse'),info=buildQualificationDecisionInfo(row,[p]);
  const detail=info.parts.find(part=>part.rows).rows[0].text;
  assert.match(detail,/另须核对本项目所列要求[\s\S]*HKDSE成绩及科目/);
  assert.doesNotMatch(detail,/任一/);assert.equal(row.cells[0].pathIds.length,1);
});
test('conflicting admission evidence stays unknown instead of showing accepted or rejected',()=>{
  const jdp=seedPrograms().find(program=>program.id==='JDP');
  jdp.paths.push({id:'conflict',all:[atom('verification.designatedSpecializedTrainingCourse',true)],source});
  const row=buildQualificationDisplayRows([jdp]).find(row=>row.id==='mext-schools'),option=row.cells[0].options.find(option=>option.id==='specialized-secondary');
  assert.equal(option.state,'unknown');assert.match(option.detail,/冲突/);
  assert.ok(option.sources.some(source=>source.ruleId==='R013'));
});
test('decision details preserve complete conditions, project scope, sources and escaped text',()=>{
  const a=fixture([atom('qualification','Associate Degree in Arts'),atom('graduationDate','2027-03-31','lte','须于2027年3月31日前取得学位')]);
  const b=fixture([atom('qualification','Associate Degree in Arts'),atom('graduationDate','2026-12-01','lte','须于2026年12月1日前取得学位')]);b.id='SECOND';
  const row=buildQualificationDisplayRows([a,b]).find(row=>row.id==='associate-degree'),info=buildQualificationDecisionInfo(row,[a,b]);
  assert.equal(info.parts.filter(part=>part.rows).length,2,'different complete conditions must not merge');
  const first=info.parts.find(part=>part.rows&&part.title===a.id);
  assert.match(first.rows[0].text,/2027年3月31日/);assert.ok(first.rows[0].sources.some(item=>item.ruleId==='edu-test'));
  assert.equal(first.rows[1].status,'需核实');
  const html=renderDetailInfoContent(info,esc,src=>`<a>${esc(src.ruleId)}</a>`);
  assert.match(html,/<th scope="col">结论<\/th>/);assert.match(html,/qualification-decision-status accepted[^>]*>可申请/);assert.match(html,/edu-test/);
  const unsafe=renderDetailInfoContent({label:'<img>',parts:[{title:'<script>',rows:[{label:'<img>',state:'unknown" onclick="bad',text:'<script>bad</script>',sources:[]}]},{title:'<b>',text:'A & B',collapsed:true}]},esc);
  assert.doesNotMatch(unsafe,/<img|<script|onclick=/);assert.match(unsafe,/&lt;script&gt;bad&lt;\/script&gt;/);assert.match(unsafe,/qualification-decision-status unknown/);
  assert.equal(renderDetailInfoContent({label:'材料',parts:[{title:'说明',text:'原有内容'}]},esc),'<strong>材料</strong><div class="hint-part"><b>说明</b><p>原有内容</p></div>');
});
test('AS cannot satisfy full A-Level, explicit AS acceptance still needs the project AND conditions',()=>{
  const s=student();s.qualifications=[record('UK GCE AS and A levels',{level:'as'})];
  let p=fixture([atom('qualification','GCE A-Level')]);assert.equal(run(s,p).education.state,'fail');
  p=fixture([atom('qualification','UK GCE AS and A levels'),atom('verification.subjectGrades',true)]);
  assert.equal(run(s,p).education.state,'unknown');s.projectEducation={[p.id]:{version:p.version,values:{'verification.subjectGrades':true},evidence:'原文科目及成绩均已核对',context:educationReviewContext(s)}};
  assert.equal(run(s,p).education.state,'pass');s.projectEducation[p.id].values['verification.subjectGrades']=false;assert.equal(run(s,p).education.state,'fail');
  s.qualifications[0].level='';assert.equal(run(s,fixture([atom('qualification','GCE A-Level')])).education.state,'unknown');
});
test('additional UK university eligibility restriction is not erased by display normalization',()=>{
  const p=fixture([atom('qualification','GCE A-Level（具英国大学入学资格）')]),s=student();s.qualifications=[record('GCE A-Level',{level:'full'})];
  assert.equal(run(s,p).education.state,'unknown');s.qualifications[0].ukUniversityEntrance=false;assert.equal(run(s,p).education.state,'fail');s.qualifications[0].ukUniversityEntrance=true;assert.equal(run(s,p).education.state,'pass');
});
test('OR paths retain all matches; diploma completion and dates cannot be borrowed across qualifications',()=>{
  const p=fixture([atom('qualification',['IB Diploma','GCE A-Level'])]),s=student();
  s.qualifications=[record('IB Diploma',{status:'expected',date:'2028-06-30'}),record('GCE A-Level',{level:'as',date:'2026-06-30'})];
  assert.equal(run(s,p).education.state,'fail');s.qualifications[0].date='2027-03-01';assert.equal(run(s,p).education.state,'conditional');
  s.qualifications[1].level='full';p.paths.push({id:'regular',label:'十二年',all:[atom('standard12',true)]});
  const r=run(s,p);assert.equal(r.education.state,'pass');assert.deepEqual(r.education.matchedPathIds,['path','regular']);assert.equal(r.education.paths[0].attempts.length,2);assert.equal(r.education.paths[0].attempts[0].state,'conditional');
});
test('studying and partial IB/OSSD/HKDSE qualifications stay unknown or fail until actual full qualifications are established',()=>{
  for(const name of ['IB Diploma','OSSD','HKDSE']){
    const p=fixture([atom('qualification',name)]),s=student();s.qualifications=[record(name,{status:'studying'})];assert.equal(run(s,p).education.state,'unknown',name);
    s.qualifications[0].status='completed';s.qualifications[0].complete=false;assert.equal(run(s,p).education.state,'fail');s.qualifications[0].complete=null;assert.equal(run(s,p).education.state,'unknown');
  }
});
test('certification requires institution/course scope, years and completion; changing school invalidates verification',()=>{
  const p=fixture([atom('accreditation',commonAccreditors),atom('international12',true)]),s=student();s.formalEducation=false;s.schoolType='international';s.accreditations=[{name:'COBIS'}];
  assert.equal(run(s,p).education.state,'unknown');s.accreditations[0]={name:'COBIS',scope:true,context:educationContext(s)};
  // Foreign international schools must not become regular foreign schooling by location alone.
  assert.equal(run(s,p).education.state,'pass');assert.equal(run(s,p).generalEducation.paths.find(p=>p.id==='foreign12').state,'fail');s.international12=true;s.educationYears=undefined;assert.equal(run(s,p).education.state,'unknown');
  s.educationYears=12;s.schoolCountry='日本';s.accreditations[0].context=educationContext(s);assert.equal(run(s,p).education.state,'pass');assert.equal(run(s,p).generalEducation.state,'pass');
  s.school='另一所学校';assert.equal(run(s,p).education.state,'unknown');s.school='甲校';s.educationYears=11;assert.equal(run(s,p).education.state,'fail');
});
test('general admission and project recognition are independent; unspecified new accreditation never grants MEXT eligibility',()=>{
  const p=fixture([atom('accreditation','Other Agency'),atom('international12',true)]),s=student();s.schoolCountry='日本';s.schoolType='international';s.formalEducation=false;s.accreditations=[{name:'Other Agency',scope:true,context:educationContext(s)}];
  const r=run(s,p);assert.equal(r.education.state,'pass');assert.equal(r.generalEducation.state,'unknown');assert.notEqual(r.state,'pass');
  const known=student();known.qualifications=[record('IB Diploma')];const rejected=run(known,fixture([atom('qualification','Abitur')]));assert.equal(rejected.generalEducation.state,'pass');assert.equal(rejected.education.state,'fail');
});
test('individual reviews are project/year scoped; old global flags and pending outcomes never pass',()=>{
  const p=fixture([atom('individualReview',true)]),s=student();s.individualReview=true;assert.equal(run(s,p).education.state,'unknown');
  s.individualReviews=[{programId:p.id,year:p.year,outcome:'pending'}];assert.equal(run(s,p).education.state,'unknown');
  Object.assign(s.individualReviews[0],{outcome:'approved',date:'2026-06-01',note:'本项目本年度审查结果'});assert.equal(run(s,p).education.state,'pass');
  const other=structuredClone(p);other.id='OTHER';assert.equal(run(s,other).education.state,'unknown');s.individualReviews[0].year--;assert.equal(run(s,p).education.state,'unknown');
});
test('scoped academic verification cannot leak to another project or a later rules version',()=>{
  const p=fixture([atom('verification.specialEducation',true)]),s=student();s.verification={specialEducation:true};assert.equal(run(s,p).education.state,'unknown');
  s.projectEducation={[p.id]:{version:p.version,values:{'verification.specialEducation':true},evidence:'核对原始条款',context:educationReviewContext(s)}};assert.equal(run(s,p).education.state,'pass');s.subjectNotes='新增科目成绩';assert.equal(run(s,p).education.state,'unknown');s.subjectNotes='';p.version++;assert.equal(run(s,p).education.state,'unknown');
});
test('preparatory paths need the exact designated category and a separately completed preparatory course',()=>{
  const p=fixture([atom('shortSchool',true),atom('preparatory',['指定类别一','指定类别二'])]),s=student();s.educationYears=11;s.preparatory=true;
  assert.equal(run(s,p).education.state,'unknown');s.preparatoryDetail={type:'指定类别一',status:'completed',date:'2026-07-01'};assert.equal(run(s,p).education.state,'pass');
  s.preparatoryDetail.date='2028-07-01';assert.equal(run(s,p).education.state,'fail');s.preparatoryDetail.type='其他课程';assert.equal(run(s,p).education.state,'fail');
});
test('legacy scalar projection is non-destructive, explicit empty arrays do not resurrect removed credentials',()=>{
  const old={qualification:'UK GCE AS and A levels',educationStatus:'completed',graduationDate:'2026-06-01',accreditation:'WASC',unrelated:{value:7}},before=JSON.stringify(old);
  assert.equal(studentQualifications(old)[0].level,'unknown');assert.equal(studentAccreditations(old)[0].scope,null);assert.equal(JSON.stringify(old),before);
  assert.deepEqual(studentQualifications({...old,qualifications:[]}),[]);assert.deepEqual(studentAccreditations({...old,accreditations:[]}),[]);
  assert.equal(educationFacts({schoolCountry:'日本',educationYears:12,formalEducation:true}).standard12,true);
  assert.equal(educationFacts({educationYears:11,standard12:true}).standard12,false);
});
test('new education data validates numeric years, dates, states and records without accepting malformed lists',()=>{
  const s=student();s.qualifications=[record('IB Diploma')];assert.deepEqual(validateStudentEducation(s),[]);
  assert.ok(validateStudentEducation({...s,educationYears:-1}).length);assert.ok(validateStudentEducation({...s,qualifications:{}}).length);
  assert.ok(validateStudentEducation({...s,qualifications:[record('IB Diploma',{date:'2026-02-30'})]}).length);
  assert.ok(validateStudentEducation({...s,individualReviews:[{outcome:'approved'}]}).length);
  assert.ok(validateStudentEducation({...s,qualifications:[null]}).length);
});
test('French aliases retain the actual issuing country instead of approving every Baccalaureate',()=>{
  const p=fixture([atom('qualification','French Baccalaureate')]),s=student();s.qualifications=[record('Baccalaureate')];
  assert.equal(run(s,p).education.state,'unknown');s.qualifications[0].credentialCountry='其他国家';assert.equal(run(s,p).education.state,'fail');s.qualifications[0].credentialCountry='法国';assert.equal(run(s,p).education.state,'pass');
});
test('shared verification aliases preserve consistent old evidence and flag conflicting old facts',()=>{
  const old={verification:{mextRecognizedOverseasSchool:true,mextRecognizedOverseasUpperSecondary:false}};
  const facts=educationFacts(old);assert.equal(facts.educationEvidence.mextOverseas,null);assert.equal(facts.verification.mextRecognizedOverseasSchool,null);assert.equal(old.verification.mextRecognizedOverseasSchool,true);
  assert.equal(educationFacts({verification:{mextRecognizedOverseasSchool:true}}).educationEvidence.mextOverseas,true);
});
