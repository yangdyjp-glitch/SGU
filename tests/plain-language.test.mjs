import test from 'node:test';
import assert from 'node:assert/strict';
import {conciseText,joinCopy,copyPreview,renderReadableText} from '../public/plain-language.js';
import {renderDetailInfoContent} from '../public/detail-hints.js';
import {buildMaterialInfo,groupMaterials} from '../public/material-presentation.js';
import {buildSchoolView} from '../public/school-detail.js';
import {seedPrograms} from '../lib/seed.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('plain language retains thresholds, deadlines, scope, AND/OR and uncertainty',()=>{
  const text='完整 A-Level 须3科，且数学≥B；仅 AS 不接受。预计取得的资格须按入学节点核对。TOEFL ≥94 或 IELTS ≥6.5；2027-09-21之前取得，不能当天完成。仅限2027年，2028年范围待核实。分数口径见requirements。';
  const simple=conciseText(text);
  for(const fact of ['完整 A-Level 须3科，且数学≥B','仅 AS 不接受','TOEFL ≥94 或 IELTS ≥6.5','2027-09-21之前取得，不能当天完成','仅限2027年，2028年范围待核实'])assert.ok(simple.includes(fact));
  assert.ok(simple.includes('预计取得者须核对取得截止日'));
  assert.ok(simple.includes('计分方式见全部要求'));
  assert.deepEqual(simple.match(/\d+(?:[.-]\d+)*/g),text.match(/\d+(?:[.-]\d+)*/g));
  assert.equal(conciseText('English entry requirements: submit AS and A levels.'),'English entry requirements: submit AS and A levels.');
  assert.equal(conciseText('直送要求见language和languagePolicy；费用另列于requirements；豁免详见waivers。'),'直送要求见语言成绩和成绩有效期与形式；费用另列于全部要求；豁免详见豁免要求。');
  assert.equal(conciseText('原文未说明是否接受，不等于不接受。'),'原文未说明是否接受，不等于不接受。');
});

test('only exact adjacent repeated sentences are removed; optional and mandatory remain distinct',()=>{
  assert.equal(conciseText('须交成绩单。须交成绩单。推荐信选交。推荐信必交2封。'),'须交成绩单。推荐信选交。推荐信必交2封。');
  assert.equal(conciseText('原文未注明。另一轮允许。原文未注明。'),'原文未注明。另一轮允许。原文未注明。');
  assert.equal(joinCopy(['可复用。','可复用','须重新直送。','']),'可复用；须重新直送');
});

test('long descriptions expand at complete clauses and retain full text, without injecting HTML',()=>{
  const text='须提交学校签发的正式成绩单和毕业证明，推荐信由推荐人直接上传，不得由申请人上传。'+('其他要求须向学校核实。'.repeat(12))+'截止：2027-09-21，TOEFL≥94。<img src=x onerror=alert(1)>';
  const simple=conciseText(text),preview=copyPreview(simple,60);
  assert.ok(preview.endsWith('。'));assert.ok(preview.length>=40);
  const html=renderReadableText(text,esc,{limit:60});
  assert.match(html,/data-copy-toggle aria-expanded="false"/);
  assert.ok(html.includes(esc(simple)));assert.ok(!html.includes('<img'));
  assert.ok(!renderReadableText(text,esc,{expandable:false}).includes('data-copy-toggle'));
  assert.equal(copyPreview('A'.repeat(240)), 'A'.repeat(240),'do not cut an unbroken name or link');
});

test('material detail combines metadata but preserves required, optional, conditions and raw records',()=>{
  const rows=[{id:'a',label:'推荐信A',required:true,stage:'申请',note:'须由高中数学教师出具1封。',when:{label:'申请工学院',field:'faculty',op:'eq',value:'工学院'}},{id:'b',label:'推荐信B',required:false,stage:'申请',note:'选交1封，可由物理教师出具。'},{id:'c',label:'推荐信C',required:null,stage:'录取后',note:'是否必交待核实。'}];
  const p={id:'p',name:'工程',code:'ENG',materials:rows},before=JSON.stringify(p),groups=groupMaterials([p]);
  const info=buildMaterialInfo(groups[0],[p],{programTitle:()=>p.name});
  const html=renderDetailInfoContent(info,esc);
  assert.match(html,/符合条件时必交/);assert.match(html,/选交/);assert.match(html,/申请工学院/);assert.match(html,/高中数学教师出具1封/);assert.match(html,/物理教师/);
  assert.match(renderDetailInfoContent(buildMaterialInfo(groups[1],[p],{}),esc),/是否必交待核实/);
  assert.equal(JSON.stringify(p),before);assert.equal(groups.flatMap(g=>g.variants.flatMap(v=>v.records)).length,3);
});

test('equivalent wording shares a school row; dates, scopes and source links remain separate',()=>{
  const base=seedPrograms()[0],make=(id,detail)=>({...structuredClone(base),id,semanticVersion:1,hardConditions:[{label:detail,field:'verification.extra',op:'eq',value:true,source:{sourceId:id,page:1,quote:detail}}],academicTests:{status:'unspecified'},graduationPolicy:{},materials:[],requirements:[],paths:[],waivers:[]});
  const programs=[make('a','跨轮重申不允许'),make('b','跨轮次重申不允许'),make('c','跨轮重申允许'),make('d','2027-01-01截止')];
  const before=JSON.stringify(programs),rows=buildSchoolView(programs).academic;
  assert.equal(rows.length,3);assert.deepEqual(rows[0].programs,['a','b']);assert.equal(rows[0].sources.length,2);
  assert.equal(JSON.stringify(programs),before);
});
