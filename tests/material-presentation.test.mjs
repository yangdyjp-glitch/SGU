import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMaterials,buildMaterialInfo,renderMaterialCatalog} from '../public/material-presentation.js';
import {renderDetailInfoContent} from '../public/detail-hints.js';
import {seedPrograms} from '../lib/seed.mjs';
import {createSchoolOverview} from '../public/school-detail.js';
import {programEntryGroup} from '../public/program-presentation.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,icon:()=>'',button:esc,evidence:s=>s?`<b>${esc(s.sourceId)} p.${esc(s.page)}</b>`:''};

test('material category grouping preserves every record, mandatory status, condition, stage and source',()=>{
 const source={sourceId:'manual-a',page:3},one={id:'m1',label:'推荐信1封',required:true,stage:'申请',when:{field:'qualification',op:'eq',value:'IB'},note:'由推荐人于3月1日前直送',parts:[{title:'要求',text:'一封，3月1日前直送'}],source};
 const programs=[{id:'a',school:'学校',code:'A',materials:[one,{...one,id:'m2',label:'推荐信B',required:false,note:'另可选交第二封',parts:[{text:'选交第二封'}]}]},
  {id:'b',school:'学校',code:'B',materials:[{...one,id:'different-id',source:{sourceId:'manual-b',page:5}}, {...one,id:'later',label:'推荐信1封',stage:'录取后',note:'录取后交原件',parts:[{text:'录取后交原件'}]}]}];
 const before=JSON.stringify(programs),groups=groupMaterials(programs),apply=groups.find(g=>g.phase==='application');
 assert.equal(groups.length,2);assert.equal(apply.variants.length,2);
 assert.deepEqual(apply.variants[0].programs,['a','b']);assert.equal(apply.variants[0].sources.length,2);
 assert.equal(groups.flatMap(g=>g.variants).flatMap(v=>v.records).length,4);
 assert.equal(groups.find(g=>g.phase==='after').variants[0].stage,'录取后');
 assert.deepEqual(apply.variants[0].when,one.when);
 const html=renderDetailInfoContent(buildMaterialInfo(apply,programs,ui),esc,ui.evidence);
 assert.match(html,/推荐信1封/);assert.match(html,/推荐信B/);assert.match(html,/选交第二封/);assert.match(html,/3月1日前直送/);
 assert.match(html,/manual-a p.3/);assert.match(html,/manual-b p.5/);assert.match(html,/data-material-project-filter/);
 assert.equal(JSON.stringify(programs),before);
});

test('synonymous names become one category but conflicting requirements and unknown names stay readable',()=>{
 const rows=[{id:'one',label:'英语官方成绩证明',required:true,parts:[{text:'TOEFL 80，官方直送'}]},
 {id:'two',label:'英语考试成绩',required:false,parts:[{text:'TOEFL 90，上传副本'}]},
 {id:'custom',label:'新的指定文件X',parts:[{text:'不能丢失的特定文件及份数'}]}];
 const programs=[{id:'a',code:'A',materials:rows}],groups=groupMaterials(programs);
 assert.equal(groups.length,2);assert.equal(groups[0].variants.length,2);
 for(const group of groups){const html=renderDetailInfoContent(buildMaterialInfo(group,programs,ui),esc);for(const row of group.variants){assert.ok(html.includes(row.label));assert.ok(html.includes(row.parts[0].text));}}
 assert.equal((renderMaterialCatalog(groups,programs,ui).match(/data-material-group=/g)||[]).length,2);
});

test('entry switch isolates all requirements, materials, rounds, sources and comparisons',()=>{
 const first=structuredClone(seedPrograms()[0]);first.id='application';first.channel='一年级申请';first.sourceIds=['first-file'];
 const transfer=structuredClone(first);transfer.id='transfer';transfer.channel='二、三年编入';transfer.sourceIds=['transfer-file'];
 first.materials[0].note='申请独有材料';transfer.materials[0].note='编入独有材料';
 first.interview.detail='申请独有选拔';transfer.interview.detail='编入独有选拔';
 const all=[first,transfer],before=JSON.stringify(all);
 for(const [selected,excluded] of [[first,transfer],[transfer,first]]){
  const overview=createSchoolOverview(first.school,all,ui,{entryGroup:programEntryGroup(selected)});
  assert.deepEqual(overview.programs.map(p=>p.id),[selected.id]);
  assert.ok(overview.html.includes(selected.sourceIds[0]));assert.ok(!overview.html.includes('/uploads/'+excluded.sourceIds[0]));
  assert.ok(overview.renderSection('materials').includes(selected.materials[0].note));assert.ok(!overview.renderSection('materials').includes(excluded.materials[0].note));
  assert.ok(overview.renderSection('rounds').includes(selected.interview.detail));assert.ok(!overview.renderSection('rounds').includes(excluded.interview.detail));
  assert.equal((overview.html.match(/data-compare=/g)||[]).length,1);
 }
 assert.equal(JSON.stringify(all),before);
});
