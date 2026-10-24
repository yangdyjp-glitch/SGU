import test from 'node:test';
import assert from 'node:assert/strict';
import {seedPrograms} from '../lib/seed.mjs';
import {buildProgramLabels,programEntryLabel,programEntryGroup,renderProgramScope} from '../public/program-presentation.js';
import {createSchoolOverview,schoolYearPrograms,groupSchools,buildSchoolView} from '../public/school-detail.js';
import {buildQualificationDisplayRows,groupDecisionOptions,buildQualificationDecisionInfo} from '../public/qualification-matrix.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,icon:()=>'',button:(label,act)=>`<button data-act="${act}">${label}</button>`,tag:esc,evidence:s=>s?`<button data-source="${esc(JSON.stringify(s))}">原文</button>`:''};
const many=()=>Array.from({length:12},(_,i)=>({...structuredClone(seedPrograms()[0]),id:'project-'+i,code:'STUDIES',name:i<6?'同名学部':'不同学部'+i,channel:i%2?'国际申请者在线编入／转入入试（三年级）':'国际申请者在线入试Type A（英语轨道，一年级）'}));

test('each school/year defaults to application projects and switches the complete overview without changing records',()=>{
 const programs=many(),next={...structuredClone(programs[0]),id:'next',year:2028},before=JSON.stringify(programs);
 const selected=schoolYearPrograms(programs[0].school,[...programs,next],{year:2027,channel:programs[0].channel});
 assert.equal(selected.programs.length,6);assert.deepEqual(new Set(selected.programs.map(p=>p.id)),new Set(programs.filter(p=>programEntryGroup(p)==='application').map(p=>p.id)));
 assert.deepEqual(selected.counts,{application:6,transfer:6});
 const view=createSchoolOverview(programs[0].school,[...programs,next],{...ui,deferSections:true},{year:2027});
 assert.equal((view.html.match(/data-compare=/g)||[]).length,6);
 assert.doesNotMatch(view.html,/data-school-channel|data-school-score=|data-stored-requirement=/);
 for(const p of programs)assert.equal(view.html.includes(`href="#program/${p.id}"`),programEntryGroup(p)==='application');
 const transfer=createSchoolOverview(programs[0].school,[...programs,next],{...ui,deferSections:true},{year:2027,entryGroup:'transfer'});
 assert.equal(transfer.programs.length,6);assert.match(transfer.html,/data-entry-group="transfer"/);
 for(const p of programs)assert.equal(transfer.html.includes(`href="#program/${p.id}"`),programEntryGroup(p)==='transfer');
 const empty=createSchoolOverview(programs[0].school,[...programs,next],ui,{year:2028,entryGroup:'transfer'});
 assert.match(empty.html,/2028 年尚未收录编入项目/);assert.match(empty.html,/data-school-entry="application"/);
 assert.equal(empty.renderSection('academic'),'');assert.doesNotMatch(empty.html,/data-compare=|资格须/);
 assert.ok(!view.html.includes('href="#program/next"'));
 assert.equal(JSON.stringify(programs),before);
 assert.ok(groupSchools(programs)[0].offerings.some(p=>p.entry.includes('三年编入')));
});

test('context labels distinguish entry year, Type and language without renaming stored programs',()=>{
 const programs=many(),labels=buildProgramLabels(programs);
 assert.equal(new Set(labels.values()).size,12);
 assert.equal(programEntryLabel(programs[0]),'申请 · 英');
 assert.equal(programEntryLabel(programs[1]),'三年编入');
 assert.equal(programEntryLabel({channel:'二、三年级编入'}),'二、三年编入');
 const raw='MEXT奖学金通道（本文仅含双申说明及GPA附录）';
 assert.equal(programEntryLabel({channel:raw}),'MEXT奖学金 · 附录');
 const fla=[{id:'a',code:'FLA',school:'上智大学',channel:'一年级入学'},{id:'b',code:'FLA',school:'上智大学',channel:'三年级编入'}];
 assert.deepEqual([...buildProgramLabels(fla).values()],['FLA · 申请','FLA · 三年编入']);
 const scope=renderProgramScope(programs.map(p=>p.id),programs,{...ui,programLabel:p=>labels.get(p.id)});
 assert.match(scope,/<summary>全部 12 个项目<\/summary>/);
 for(const p of programs)assert.ok(scope.includes(`href="#program/${p.id}"`));
});

test('more than eight projects retain separate scrollable columns and complete decision evidence',()=>{
 const option={id:'gce',label:'A-Level',shortLabel:'完整A-Level',state:'accepted',detail:'三门完整A-Level，2027-03-31前取得',notes:[],sources:[{sourceId:'one',page:1}]};
 const cells=[{programId:'a',options:[option]},{programId:'b',options:[{...option,sources:[{sourceId:'two',page:3}]}]},{programId:'c',options:[{...option,detail:'三门完整A-Level，2027-08-31前取得'}]},{programId:'d',options:[{...option,state:'unknown'}]},{programId:'e',options:[{...option,notes:['仅理科适用']}]}];
 const groups=groupDecisionOptions(cells,true);
 assert.equal(groups.length,4);assert.deepEqual(groups[0].programs,['a','b']);assert.equal(groups[0].options[0].sources.length,2);
 const programs=many().map(p=>({...p,channel:'一年级申请'})),before=JSON.stringify(programs),view=createSchoolOverview(programs[0].school,programs,{...ui,deferSections:true});
 const academic=view.renderSection('academic');
 assert.match(academic,/class="qualification-matrix"/);assert.doesNotMatch(academic,/class="qualification-overview"/);
 assert.equal((academic.match(/data-qualification-program=/g)||[]).length,12);
 assert.match(academic,/data-qualification-scroll/);assert.match(academic,/左侧字段固定/);
 for(const p of programs)assert.ok(academic.includes(`data-qualification-program="${p.id}"`));
 const infoKey=academic.match(/data-info-key="([^"]+)"/)[1],info=view.resolveInfo(infoKey);
 assert.ok(info.parts.some(part=>part.rows?.length));assert.equal(view.resolveInfo(infoKey),info,'opened evidence is cached for this overview');
 assert.equal((academic.match(/data-qualification="/g)||[]).length,buildQualificationDisplayRows(programs,programs).length,'large overview keeps one top-level row per shared qualification');
 for(const row of buildQualificationDisplayRows(programs,programs)){
  assert.ok(academic.includes(`data-qualification="${row.id}"`));
  const info=buildQualificationDecisionInfo(row,programs,undefined,p=>view.labels.get(p.id));
  for(const cell of row.cells)for(const option of cell.options)assert.ok(info.parts.some(part=>part.rows?.some(r=>r.id===option.id&&r.state===option.state&&r.text===option.detail)));
 }
 assert.equal(JSON.stringify(programs),before);
 assert.match(view.renderSection('language'),/data-school-score=/);
 assert.equal((view.renderSection('rounds').match(/data-round=/g)||[]).length,programs.reduce((n,p)=>n+p.rounds.length,0));
});

test('different score thresholds, material conditions and deadlines never lose their project scopes',()=>{
 const programs=many().slice(0,2);
 programs[1].language[0].score=99;
 programs[1].materials[0].label='仅编入需提交的证明';
 programs[1].requirements.find(r=>r.id==='R002').detail='资格须于2027-08-31前取得';
 const view=buildSchoolView(programs);
 assert.deepEqual(view.scores.find(r=>r.score===99).programs,[programs[1].id]);
 assert.deepEqual(view.materials.find(r=>r.label==='仅编入需提交的证明').programs,[programs[1].id]);
 assert.deepEqual(view.enrollment.find(r=>r.detail==='资格须于2027-08-31前取得').programs,[programs[1].id]);
 const html=createSchoolOverview(programs[0].school,programs,ui).html;
 assert.match(html,/class="qualification-matrix"/);assert.doesNotMatch(html,/class="qualification-overview"/);
});
