import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionsFixture } from './fixtures/admissions.mjs';
import { seedPrograms } from '../lib/seed.mjs';
import { buildProjectView, renderProjectDetail } from '../public/project-detail.js';
import { buildSchoolView, renderSchoolDetail, groupSchools } from '../public/school-detail.js';
import { programLabel, schoolViewGroup } from '../public/imported-requirement-model.js';
import { buildQualificationCatalog, buildQualificationRows } from '../public/qualification-matrix.js';
import { renderLanguageScoreTable, minimumScoreText } from '../public/score-table.js';
import { matchProgram } from '../lib/engine.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const ui = {esc,icon:()=>'',tag:esc,button:esc,evidence:s=>s?`<button class="evidence-btn" data-source="${esc(JSON.stringify(s))}">原文</button>`:''};
function imported(id='AI-imported',channel='一年级入学（材料审查）') {
  const p = {...admissionsFixture().programs[0], id, code:'FLA', channel, version:1, semanticVersion:1, sourceIds:['imported-document']};
  const bind = value => { if (!value || typeof value!=='object') return; if (value.source) value.source.sourceId='imported-document'; Object.values(value).forEach(bind); };
  bind(p); return p;
}

test('imported schools and projects share compact formal tables while retaining every clause and hint', () => {
  const p=imported();
  p.languagePolicy.detail='成绩须在申请开始日前两年内取得；IELTS接受One Skill Retake。';
  p.languagePolicy.excludedFormats=['TOEFL MyBest','IELTS Online'];
  p.graduationPolicy.detail='预计毕业者须于2027-09-21前取得资格。';
  p.academicTests={status:'required',detail:'必须提交SAT、ACT或IB，不能作为选交处理。',source:p.paths[0].source};
  p.waivers=[{id:'english',label:'最近六年中至少五年以英语授课',all:[{field:'verification.englishStudy',op:'eq',value:true,label:'最近六年中至少五年以英语为主要授课语言，须提交学校证明。',source:p.paths[0].source}],source:p.paths[0].source}];
  p.materials.push({...p.materials[0],id:'diploma',label:'最终毕业证明',stage:'入学前',note:'入学前交原件，不能以预毕业证明替代。'});
  p.requirements.push({id:'after',topic:'入学后学业条件',stage:'入学后',nature:'硬性',detail:'第一学期结束前完成指定课程。',source:p.paths[0].source});
  const before=JSON.stringify(p);
  for (const html of [renderSchoolDetail(p.school,[p],ui),renderProjectDetail(p,{...ui,allPrograms:[p]})]) {
    for (const key of ['qualification-matrix','language-score-table','compact-rounds','source-switch','info-hint','detail-complete']) assert.ok(html.includes(key),key);
    assert.doesNotMatch(html,/class="admission-content"|class="admission-line/);
    assert.match(html,/role="switch" aria-checked="false"/);
    for(const r of p.requirements) assert.ok(html.includes(esc(r.detail)),r.id);
    for(const m of p.materials) assert.ok(html.includes(esc(m.note)),m.id);
    for(const text of [p.languagePolicy.detail,p.graduationPolicy.detail,p.academicTests.detail,p.waivers[0].all[0].label,'TOEFL MyBest','IELTS Online']) assert.ok(html.includes(esc(text)),text);
    assert.match(html,/>FLA</);
    assert.doesNotMatch(html,/2027-09-26|RU/);
  }
  assert.equal(JSON.stringify(p),before,'view adaptation must not mutate stored rules');
});

test('school-specific verification clauses remain local and transfer routes retain every AND condition', () => {
  const p=imported('AI-transfer','三年级编入（材料审查）');
  p.paths=[{id:'two-years',label:'学士授予机构完成两年',all:[
    {field:'verification.bachelorTwoYears',op:'eq',value:true,label:'在授予学士学位的机构完成两个完整学年',source:p.paths[0].source},
    {field:'verification.degreeSeeking',op:'eq',value:true,label:'必须为正式学位生，入学前完成',source:p.paths[0].source}
  ],source:p.paths[0].source}];
  const seed=seedPrograms(),all=[...seed,p];
  assert.ok(!buildQualificationCatalog(all).some(row=>row.field==='verification.bachelorTwoYears'));
  const original=buildQualificationRows(seed,all);
  assert.ok(original.find(row=>/学士授予/.test(row.label)).cells.every(cell=>!cell.accepted));
  const rows=buildQualificationRows([p],all);
  assert.deepEqual(rows.map(r=>r.id),original.map(r=>r.id));
  const transferRow=rows.find(row=>row.cells[0].pathIds.includes('two-years'));
  assert.deepEqual(transferRow.cells[0].pathIds,['two-years']);
  for (const rule of p.paths[0].all) assert.ok(transferRow.conditions[0].text.includes(rule.label));
  assert.ok(!renderSchoolDetail(seed[0].school,all,ui).includes('两个完整学年'));
});

test('imported qualification aliases and local labels do not grant MEXT equivalence or seed age cutoffs', () => {
  const p=imported(),s=p.paths[0].source;
  p.paths=[
    {id:'japanese12',label:'日本认可学校十二年教育',all:[{field:'standard12',op:'eq',value:true,label:'日本文部科学省认可学校的十二年正规教育',source:s}],source:s},
    {id:'overseas12',label:'日本境外十二年以上正规教育',all:[{field:'international12',op:'eq',value:true,label:'完成日本境外十二年以上正规教育',source:s}],source:s},
    {id:'diplomas',label:'完整文凭',all:[{field:'qualification',op:'in',value:['GCE A-levels','International A-Levels','French Baccalauréat'],label:'取得所列完整文凭',source:s}],source:s},
    {id:'individual',label:'个别认定',all:[{field:'individualReview',op:'eq',value:true,label:'须经本校个别认定',source:s},{field:'ageAtEnrollment',op:'gte',value:18,label:'实际入学日年龄',referenceDate:'2027-09-21',source:s}],source:s}
  ];
  const rows=buildQualificationRows([p],seedPrograms().concat(p));
  for (const id of ['standard12','gce-alevel','international-alevel','baccalaureate','individualReview']) assert.equal(rows.find(r=>r.id===id).cells[0].accepted,true,id);
  assert.equal(rows.find(r=>r.id==='mext-equivalent').cells[0].accepted,false);
  assert.equal(rows.find(r=>r.id==='international12').label,'日本以外12年正规学校教育');
  const age=rows.find(r=>r.id==='individualReview').conditions[0].text;
  assert.match(age,/18.*2027-09-21/); assert.doesNotMatch(age,/前一天|RU|09-26/);
  for(const path of p.paths) assert.ok(rows.some(r=>r.cells[0].pathIds.includes(path.id)),path.id);
});

test('an independent overseas-education path does not repeat the certified-school path in the same program', () => {
  const p=imported(),s={...p.paths[0].source,page:'4'},certSource={...s,page:'6'};
  const deadline=source=>({field:'graduationDate',op:'lte',value:'2027-03-31',label:'已完成或预计于2027年3月31日前完成',source});
  const accreditors=['WASC','NEASC','Cognia','COBIS','CIS','ACSI'];
  p.paths=[
    {id:'overseas',label:'日本以外12年正规学校教育',all:[
      {field:'international12',op:'eq',value:true,label:'在日本以外完成12年正规学校教育',source:s},deadline(s)
    ],source:s},
    {id:'certified',label:'六类国际认证学校的12年课程',all:[
      {field:'international12',op:'eq',value:true,label:'完成12年教育课程',source:certSource},
      {field:'accreditation',op:'in',value:accreditors,label:'学校由上述任一机构认证',source:certSource},deadline(certSource)
    ],source:certSource}
  ];
  const before=JSON.stringify(p),all=[...seedPrograms(),p],rows=buildQualificationRows([p],all);
  const overseas=rows.find(r=>r.id==='international12');
  assert.equal(overseas.label,'日本以外12年正规学校教育');
  assert.deepEqual(overseas.cells[0].pathIds,['overseas']);
  assert.equal(overseas.conditions.length,1);
  assert.match(overseas.conditions[0].text,/日本以外完成12年正规学校教育.*2027年3月31日/);
  assert.doesNotMatch(overseas.conditions[0].text,/认证|WASC|ACSI/);
  assert.ok(overseas.conditions[0].sources.every(source=>source.page==='4'));
  for(const name of accreditors){
    const row=rows.find(r=>r.id==='accreditation');
    assert.deepEqual(row.cells[0].pathIds,['certified']);
    assert.match(row.conditions[0].text,/完成12年教育课程.*学校由上述任一机构认证.*2027年3月31日/);
    assert.ok(row.conditions[0].text.includes(name));
    assert.ok(row.conditions[0].sources.every(source=>source.page==='6'));
  }
  for(const html of [renderSchoolDetail(p.school,all,ui),renderProjectDetail(p,{...ui,allPrograms:all})]){
    const row=html.match(/<tr data-qualification="secondary-education"[^>]*>([\s\S]*?)<\/tr>/)?.[1];
    assert.ok(row?.includes(overseas.label));
    assert.match(row,/日本以外完成12年正规学校教育.*2027年3月31日/);
    assert.doesNotMatch(row,/学校由上述任一机构认证|国际学校十二年课程/);
  }
  assert.equal(JSON.stringify(p),before);
});

test('certification deduplication keeps each program scope even when path ids overlap', () => {
  const certified=seedPrograms()[0],independent=imported('AI-overseas'),s=independent.paths[0].source;
  independent.paths=[{id:'B',label:'日本境外十二年以上正规教育',all:[{field:'international12',op:'eq',value:true,label:'完成日本境外十二年以上正规教育',source:s}],source:s}];
  const programs=[certified,independent],rows=buildQualificationRows(programs);
  const overseas=rows.find(r=>r.id==='international12');
  assert.equal(overseas.label,'日本以外12年正规学校教育');
  assert.deepEqual(overseas.cells.map(c=>c.pathIds),[[],['B']]);
  assert.deepEqual(overseas.cells.map(c=>c.accepted),[false,true]);
  assert.deepEqual(overseas.conditions[0].programs,[independent.id]);
  for(const row of rows.filter(r=>r.field==='accreditation'))assert.deepEqual(row.cells.map(c=>c.accepted),[true,false]);
  for(const p of programs)for(const path of p.paths)assert.ok(rows.some(r=>r.cells.some(c=>c.programId===p.id&&c.pathIds.includes(path.id))));
});

test('first-year and transfer projects share one overview while keeping separate qualifications', () => {
  const first=imported('AI-first'),transfer=imported('AI-transfer','三年级编入（材料审查）');
  first.paths[0].all[0].label='一年级专属条件';transfer.paths[0].all[0].label='编入专属条件';
  const all=[transfer,first];
  const initial=renderSchoolDetail(first.school,all,ui);
  assert.match(initial,/一年级专属条件/);assert.match(initial,/编入专属条件/);
  const selected=renderSchoolDetail(first.school,all,ui,{channel:transfer.channel});
  assert.equal(selected,initial,'legacy channel filters must no longer hide projects');
  assert.doesNotMatch(selected,/data-school-channel/);
  assert.match(selected,/FLA · 申请/);assert.match(selected,/FLA · 三年编入/);
  assert.doesNotMatch(renderProjectDetail(first,ui),/编入专属条件/);
  assert.doesNotMatch(renderProjectDetail(transfer,ui),/一年级专属条件/);
});

test('Sophia FLA application and transfer are two visible projects with separate rules and stable identities', () => {
  const first=imported('AI-fla-first'),transfer=imported('AI-fla-transfer','三年级编入（材料审查）');
  for(const p of [first,transfer]){p.school='上智大学';p.name='国际教养学部';p.englishName='Faculty of Liberal Arts';}
  first.paths[0].all[0].label='一年级申请须完成十二年教育';
  transfer.paths=[{...transfer.paths[0],id:'degree',label:'编入须完成大学两年',all:[{...transfer.paths[0].all[0],field:'verification.twoCollegeYears',label:'须完成大学两年且为正式学位生'}]}];
  first.materials[0].note='申请项目专用推荐材料';transfer.materials[0].note='编入项目专用推荐材料';
  transfer.language[0].score=7.5;
  const next=structuredClone(first);next.id='AI-fla-next';next.year=2028;next.paths[0].all[0].label='下一年度专属资格';
  const all=[transfer,next,first],before=JSON.stringify(all),school=groupSchools(all)[0];
  assert.deepEqual(school.offerings.map(p=>[p.code,p.entry]),[['FLA','申请'],['FLA','三年编入']]);
  assert.equal(school.channels.length,1);
  const html=renderSchoolDetail('上智大学',all,ui,{year:2027,channel:transfer.channel});
  assert.doesNotMatch(html,/data-school-channel|下一年度专属资格/);
  assert.ok(html.includes(`href="#program/${first.id}"`));assert.ok(html.includes(`href="#program/${transfer.id}"`));
  assert.equal((html.match(/data-compare=/g)||[]).length,2);
  assert.match(html,/FLA · 申请/);assert.match(html,/FLA · 三年编入/);
  assert.match(html,/一年级申请须完成十二年教育/);assert.match(html,/须完成大学两年且为正式学位生/);
  for(const p of [first,transfer])assert.ok(html.includes(p.materials[0].note));
  const rows=buildQualificationRows([first,transfer],all);
  assert.deepEqual(rows.find(r=>r.id==='standard12').cells.map(c=>c.accepted),[true,false]);
  assert.deepEqual(rows.find(r=>r.localPaths?.[transfer.id]).cells.map(c=>c.accepted),[false,true]);
  const scores=buildSchoolView([first,transfer]).scores;
  assert.deepEqual(scores.find(r=>r.score===6.5).programs,[first.id]);
  assert.deepEqual(scores.find(r=>r.score===7.5).programs,[transfer.id]);
  const firstPage=renderProjectDetail(first,{...ui,allPrograms:all}),transferPage=renderProjectDetail(transfer,{...ui,allPrograms:all});
  assert.match(firstPage,/<h1>FLA · 国际教养学部 · 申请/);assert.doesNotMatch(firstPage,/须完成大学两年且为正式学位生|编入项目专用推荐材料/);
  assert.match(transferPage,/<h1>FLA · 国际教养学部 · 三年编入/);assert.doesNotMatch(transferPage,/一年级申请须完成十二年教育|申请项目专用推荐材料/);
  assert.equal(JSON.stringify(all),before,'project presentation must preserve stored IDs, channels and complete rules');
});

test('FLA presentation names apply only to identified Sophia entry types', () => {
  const p=imported();
  assert.equal(programLabel(p),'FLA');assert.equal(schoolViewGroup(p),p.channel);
  p.school='上智大学';assert.equal(programLabel(p),'FLA 申请');
  p.channel='Third-year Transfer Admissions';assert.equal(programLabel(p),'FLA 三年编入');
  p.channel='其他待核实类别';assert.equal(programLabel(p),'FLA');assert.equal(schoolViewGroup(p),p.channel);
  p.code='FST';p.channel='一年级入学';assert.equal(programLabel(p),'FST');
});

test('Cognia with its named constituent accreditors stays one certification row with the full condition', () => {
  const p=imported(),value='Cognia（含NCA CASI、NWAC、SACS CASI）';
  p.paths=[{id:'certified',label:'获认证的国际学校',all:[{field:'accreditation',op:'in',value:[value],label:'须完成获列明机构认证的课程',source:p.paths[0].source}],source:p.paths[0].source}];
  const all=[...seedPrograms(),p];
  assert.equal(buildQualificationCatalog(all).filter(r=>r.field==='accreditation').length,1);
  const row=buildQualificationRows([p],all).find(r=>r.id==='accreditation');
  assert.equal(row.cells[0].accepted,true);assert.ok(row.conditions[0].text.includes(value));
  assert.equal(row.cells[0].partial,true);assert.match(row.cells[0].scopeNote,/仅明确列明：Cognia/);
});

test('unspecified thresholds remain distinct from no minimum and long explanations survive compact score rows', () => {
  const first=imported('AI-unspecified'),second=imported('AI-no-minimum');
  first.language[0].score=null;first.language[0].minimumStatus='unspecified';
  first.language[0].note='原文没有注明最低分，必须提交有效英语能力证明；院校直送成绩，申请人另上传成绩单。IELTS接受One Skill Retake，具体方式以本校说明为准。';
  first.language[0].basis='英语能力证明，符合本校语言豁免条件的申请人可免交';
  second.language=structuredClone(first.language);second.language[0].minimumStatus='no-minimum';
  const view=buildSchoolView([first,second]);assert.equal(view.scores.length,2);
  const html=renderLanguageScoreTable(view.scores,ui,ids=>ids.join(' / '));
  assert.match(html,/<strong>未注明<\/strong>/);assert.match(html,/<strong>不设最低分<\/strong>/);
  assert.ok(html.includes(esc(first.language[0].note)));assert.ok(html.includes(esc(first.language[0].basis)));
  assert.match(html,/info-hint/);assert.doesNotMatch(html,/<br/);
  assert.equal(minimumScoreText(first.language[0]),'未注明');
  assert.equal(minimumScoreText(second.language[0]),'不设最低分');
  assert.equal(minimumScoreText({score:6.5}),'≥ 6.5');
  assert.equal(minimumScoreText(undefined),'未列明');
});

test('different validity bases and all material stages remain distinct in the shared adapter', () => {
  const first=imported('AI-start'),second=imported('AI-end');
  first.languagePolicy.detail='申请开始日前两年内';second.languagePolicy.detail='申请截止日前两年内';
  first.materials.push({...first.materials[0],id:'after-entry',label:'入学后证明',stage:'入学后',note:'入学后提交，仍属完整要求。'});
  const view=buildSchoolView([first,second]);assert.equal(view.validity.length,2);
  assert.deepEqual(view.validity.map(r=>r.programs),[['AI-start'],['AI-end']]);
  assert.equal(buildProjectView(first).materials.length,first.materials.length);
  assert.ok(view.materials.some(r=>r.id==='after-entry'&&r.parts.some(part=>part.text==='入学后')));
});

test('named HKDSE curriculum requirements appear alongside general eligibility without creating an alternative matching path', () => {
  const programs=['law','intercultural','liberal'].map(id=>imported('AI-'+id));
  const detail='2023年及以前：最佳5科至少18，奖学金22；2024年及以后：最佳4科至少14，奖学金17，公民与社会发展须Attained (A)。均另须TOEFL iBT 94或新量表各项4.5，或IELTS Academic 6.5；不接受MyBest，截止前机构电子直送。须在文凭所属地区实体高中就读至少两个学年并毕业。CAT A：5**=7，5*=6。';
  for(const p of programs){
    const source={...p.paths[0].source,page:'7,8',quote:'For HKDSE Candidates in or before 2023; For HKDSE Candidates in or after 2024; 1) 14, For scholarship: 17; 2) Attained (A)'};
    p.requirements.push({id:'hkdse',topic:'(e) 香港高中／HKDSE体系',stage:'申请',nature:'硬性',detail,source});
    p.hardConditions.push({field:'verification.curriculumEligibility',op:'eq',value:true,label:'须满足指定课程体系及其全部分数与所在地条件',state:'stated',referenceDate:null,source});
  }
  const unrelated=imported('AI-other'),all=[...programs,unrelated],before=JSON.stringify(all);
  const dse=buildQualificationRows(all).find(row=>row.id==='dse');
  assert.deepEqual(dse.cells.map(cell=>cell.accepted),[true,true,true,false]);
  assert.deepEqual(dse.cells[0].pathIds,[]);
  assert.deepEqual(dse.cells[0].requirementIds,['hkdse']);
  assert.ok(dse.conditions[0].text.includes(detail));
  assert.equal(dse.conditions[0].programs.length,3);
  assert.ok(dse.conditions[0].sources.every(source=>source.page==='7,8'));
  const html=renderProjectDetail(programs[0],{...ui,allPrograms:all});
  assert.match(html,/<tr data-qualification="dse"[^>]*>[\s\S]*?qualification-status[^\"]* accepted/);
  assert.ok(html.includes(esc(detail)));
  const result=matchProgram({qualification:'DSE',standard12:true,educationStatus:'completed',graduationDate:'2026-06-01'},programs[0],programs[0].rounds[0]);
  assert.equal(result.hard.find(rule=>rule.field==='verification.curriculumEligibility').state,'unknown');
  assert.equal(JSON.stringify(all),before);
});

test('curriculum headings require affirmative application evidence, not passing mentions, exclusions or post-enrollment clauses', () => {
  const p=imported(),source={...p.paths[0].source,quote:'For HKDSE Candidates'};
  const row={id:'dse',topic:'HKDSE体系',stage:'申请',nature:'硬性',detail:'最佳四科14分，并提交英语成绩。',source};
  const accepted=record=>{p.requirements=[record];return buildQualificationRows([p]).find(r=>r.id==='dse').cells[0].accepted;};
  assert.equal(accepted(row),true);
  for(const overrides of [
    {topic:'其他申请材料',detail:'DSE成绩作为背景举例'},
    {detail:'本项目不接受DSE申请'},
    {detail:'HKDSE is not accepted'},
    {topic:'不接受HKDSE'},
    {stage:'入学后'}, {nature:'说明'}, {nature:'待核实'},
    {source:{...source,quote:''}}, {source:{...source,quote:'An unrelated academic rule'}}
  ])assert.equal(accepted({...row,...overrides}),false,JSON.stringify(overrides));
  p.requirements=[];p.paths[0].all=[{...p.paths[0].all[0],field:'qualification',value:'Hong Kong Secondary School (High School) Diploma'}];
  assert.equal(buildQualificationRows([p]).find(r=>r.id==='dse').cells[0].accepted,true);
  assert.ok(!buildQualificationCatalog([p]).some(r=>r.id.startsWith('qualification:hongkong')));
});
