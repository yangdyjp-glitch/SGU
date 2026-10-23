import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { exampleStudents } from './fixtures/students.mjs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const base='http://127.0.0.1:3222';
test('authenticated team workflow, version history, conflicts and ingestion',async t=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3222',HOST:'127.0.0.1',DATA_DIR:'.qa/test-'+randomUUID(),MINERU_BIN:'',OPENAI_API_KEY:'',APP_ORIGIN:'',RAILWAY_PUBLIC_DOMAIN:'',COOKIE_SECURE:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
 t.after(async()=>{child.kill();await once(child,'exit').catch(()=>{});});
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('server exited early');})]);
 let cookie='',csrf='';
 async function req(path,body,extra={}){const res=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-SGU-Request':'1','X-CSRF-Token':csrf,Cookie:cookie,Origin:base,...extra},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,headers:res.headers,body:await res.json()};}
 await t.test('no anonymous access',async()=>{assert.equal((await req('/bootstrap')).status,401);assert.equal((await fetch(base+'/sources/aohb27.pdf')).status,401);});
 await t.test('first account needs no name and becomes administrator',async()=>{const r=await req('/auth/register',{login:'reviewer',password:'Review26'});assert.equal(r.status,201);assert.equal(r.body.user.login,'reviewer');assert.equal(r.body.user.role,'admin');assert.equal(r.body.user.name,undefined);cookie=r.headers.get('set-cookie').split(';')[0];csrf=r.body.csrf;assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal((await req('/bootstrap')).body.programs.length,5);});
 await t.test('account-only login accepts eight-character password and rejects wrong credentials',async()=>{assert.equal((await req('/auth/login',{login:'reviewer',password:'Wrong123'})).status,401);const r=await req('/auth/login',{login:'REVIEWER',password:'Review26'});assert.equal(r.status,200);assert.equal(r.body.user.role,'admin');assert.equal(r.body.user.name,undefined);assert.equal((await req('/auth/register',{login:'shortpass',password:'short12'})).status,400);});
 await t.test('joining requires correct invitation and CSRF/origin enforced',async()=>{assert.equal((await req('/auth/register',{login:'reviewer2',password:'Temporary-QA-Only-2026',invite:'wrong'})).status,403);assert.equal((await req('/match',{studentId:'sample-lin'},{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await req('/match',{studentId:'sample-lin'},{Origin:'https://other.example'})).status,403);});
 await t.test('invited accounts stay members and team identity uses only login',async()=>{const team=(await req('/team')).body;const r=await req('/auth/register',{login:'coworker',password:'Member26',invite:team.invite,role:'admin'});assert.equal(r.status,201);assert.equal(r.body.user.role,'member');const users=(await req('/team')).body.users;assert.equal(users.find(u=>u.login==='reviewer').role,'admin');assert.ok(users.every(u=>u.name===undefined));assert.ok((await req('/events')).body.some(e=>e.kind==='account'&&e.actor==='reviewer'&&e.subject==='reviewer'));});
 await t.test('new workspace starts empty; test data is added explicitly',async()=>{assert.equal((await req('/bootstrap')).body.students.length,0);for(const student of exampleStudents()){const r=await req('/students',{student});assert.equal(r.status,200);}});
 let boot=(await req('/bootstrap')).body;
 let originalMatch;
 await t.test('matching stores a student and rule snapshot',async()=>{originalMatch=(await req('/match',{studentId:'sample-lin'})).body;assert.ok(originalMatch.id);assert.equal(originalMatch.results.length,7);assert.ok(originalMatch.results.some(r=>r.state==='conditional'));});
 await t.test('student optimistic lock prevents lost update',async()=>{const s=structuredClone(boot.students[0]);const first=await req('/students',{student:{...s,notes:'第一次修改'},expectedRevision:s.revision});assert.equal(first.status,200);const stale=await req('/students',{student:{...s,notes:'过时修改'},expectedRevision:s.revision});assert.equal(stale.status,409);assert.equal(stale.body.current.notes,'第一次修改');});
 await t.test('rule edits immediately affect queries and old edit conflicts',async()=>{const p=structuredClone(boot.programs.find(p=>p.id==='GLA'));p.tuition={...p.tuition,status:'published',amount:1234567};const saved=await req('/programs',{program:p,expectedVersion:1,note:'接口测试：核对学费原文后修正'});assert.equal(saved.status,200);assert.equal(saved.body.version,2);const answer=await req('/query',{query:{mode:'tuition'}});assert.ok(answer.body.matched.some(x=>x.id==='GLA'&&x.reasons[0].includes('1234567')));const conflict=await req('/programs',{program:p,expectedVersion:1,note:'陈旧版本应被拦截'});assert.equal(conflict.status,409);assert.equal(conflict.body.current.version,2);});
 await t.test('old matches unchanged after version edit; rollback is a new version',async()=>{const snapshot=(await req('/matches/'+originalMatch.id)).body;assert.equal(snapshot.programs.find(p=>p.id==='GLA').tuition.status,'unspecified');assert.equal(snapshot.student.revision,1);const restore=await req('/restore',{programId:'GLA',version:1,expectedVersion:2});assert.equal(restore.body.version,3);assert.equal(restore.body.tuition.status,'unspecified');assert.equal((await req('/versions?programId=GLA')).body.length,3);});
 await t.test('multiple qualifications round-trip, edit without losing legacy facts, and preserve earlier match snapshots',async()=>{
  const fresh={name:'多资格回归',educationVersion:2,qualification:'旧字段完整保留',schoolCountry:'中国',educationYears:12,formalEducation:true,educationStatus:'completed',graduationDate:'2026-06-30',qualifications:[{id:'q1',name:'UK GCE AS and A levels',type:'gce-alevel',level:'as',status:'completed',date:'2026-06-01',awardingBody:'考试机构A'},{id:'q2',name:'IB Diploma',type:'ib',complete:true,status:'expected',date:'2027-03-01'}],accreditations:[{name:'WASC',scope:null},{name:'COBIS',scope:null}],individualReviews:[{programId:'GLA',year:2027,outcome:'pending'}],exams:[],notes:'其他资料保留'};
  const created=await req('/students',{student:fresh});assert.equal(created.status,200);const saved=created.body;
  const loaded=(await req('/bootstrap')).body.students.find(s=>s.id===saved.id);assert.deepEqual(loaded.qualifications,fresh.qualifications);assert.deepEqual(loaded.accreditations,fresh.accreditations);assert.equal(loaded.qualification,fresh.qualification);
  const snapshot=(await req('/match',{studentId:saved.id})).body;assert.ok(snapshot.results[0].generalEducation);
  const edited=await req('/students',{student:{...loaded,qualifications:[{...loaded.qualifications[1],status:'completed',date:'2026-07-01'}]},expectedRevision:loaded.revision});assert.equal(edited.status,200);assert.equal(edited.body.qualifications.length,1);assert.equal(edited.body.notes,fresh.notes);
  const previous=(await req('/matches/'+snapshot.id)).body;assert.deepEqual(previous.student.qualifications,fresh.qualifications);assert.deepEqual((await req('/matches/'+originalMatch.id)).body,originalMatch);
  assert.equal((await req('/students',{student:{...edited.body,educationYears:-5},expectedRevision:edited.body.revision})).status,400);
 });
 await t.test('upload automatically extracts and waits for configuration with synchronized list/detail states',async()=>{
  const upload=await req('/documents',{filename:'test-admissions.txt',base64:Buffer.from('English requirement: TOEFL iBT minimum score 80.\nAnnual tuition is not specified.').toString('base64')});assert.equal(upload.status,201);
  assert.equal(upload.body.status,'queued');
  let doc;for(let i=0;i<50;i++){doc=(await req('/documents/'+upload.body.id)).body;if(!['queued','parsing','extracting'].includes(doc.status))break;await delay(30);}
  assert.equal(doc.status,'needs_configuration');assert.equal(doc.statusVersion,4);assert.ok(doc.suggestions.length>=1);
  const row=(await req('/documents')).body.find(d=>d.id===doc.id);
  assert.equal(row.status,doc.status);assert.equal(row.statusVersion,doc.statusVersion);assert.equal(row.text,undefined);assert.equal(row.hasText,true);
  assert.deepEqual((await req('/events')).body.filter(e=>e.subject===upload.body.filename&&e.detail.status).map(e=>e.detail.status).sort(),['extracting','needs_configuration','parsing','queued']);
  assert.equal((await req('/bootstrap')).body.programs.find(p=>p.id==='GLA').version,3);
 });
 await t.test('failed parsing and retries also publish revisions and replace stale errors',async()=>{
  const upload=(await req('/documents',{filename:'parse-failure.pdf',base64:Buffer.from('%PDF-1.4\nlocal test fixture').toString('base64')})).body;
  for(let attempt=1;attempt<=2;attempt++){
   if(attempt===2){const started=await req('/documents/'+upload.id+'/parse',{});assert.equal(started.status,202);assert.equal(started.body.document.status,'queued');assert.equal(started.body.document.error,null);}
   let doc;for(let i=0;i<50;i++){doc=(await req('/documents/'+upload.id)).body;if(!['queued','parsing','extracting'].includes(doc.status))break;await delay(20);}
   assert.equal(doc.status,'error');assert.match(doc.error,/未配置/);assert.equal(doc.statusVersion,attempt*3);
   const row=(await req('/documents')).body.find(d=>d.id===doc.id);
   assert.equal(row.status,doc.status);assert.equal(row.error,doc.error);assert.equal(row.statusVersion,doc.statusVersion);
  }
  assert.deepEqual((await req('/events')).body.filter(e=>e.subject===upload.filename).map(e=>e.detail.status).filter(Boolean).sort(),['error','error','parsing','parsing','queued','queued']);
 });
 await t.test('audit and backups contain rule and match history',async()=>{assert.ok((await req('/events')).body.some(x=>x.kind==='restore'));const backup=await req('/export');assert.ok(backup.body.matches.length);assert.ok(backup.body.versions.length>5);assert.equal(backup.body.users,undefined);});
 await t.test('new-school documents use isolated drafts and publish only after complete review',async()=>{
  const filename='Waseda-2027.md',text='# Application Guide for AO April Entry (Overseas) 2027\n# WASEDA UNIVERSITY\n# School of International Liberal Studies\nTOEFL iBT is accepted.\nThe first language is Japanese.';
  const uploaded=(await req('/documents',{filename,base64:Buffer.from(text).toString('base64')})).body;
  let reviewed;for(let i=0;i<50;i++){reviewed=(await req('/documents/'+uploaded.id)).body;if(reviewed.status==='needs_configuration')break;await delay(20);}
  assert.equal(reviewed.analysis.school,'早稻田大学');assert.equal(reviewed.analysis.year,2027);assert.ok(reviewed.suggestions.every(s=>!s.fields.includes('年龄')));
  const path='/documents/'+uploaded.id+'/draft';
  assert.equal((await req(path,{target:{school:'早稻田大学',year:2027,mode:'update',programId:'CRPS'}})).status,400);
  const created=await req(path,{target:{school:'早稻田大学',year:2027,mode:'create'}});assert.equal(created.status,200);
  const draft=created.body;assert.deepEqual(draft.program.paths,[]);assert.deepEqual(draft.program.language,[]);
  draft.program.id='WASEDA-SILS';draft.program.name='Test SILS';
  const saved=await req(path,{program:draft.program,note:'草稿测试',expectedDraftVersion:1});assert.equal(saved.body.version,2);
  assert.equal((await req(path,{program:draft.program,expectedDraftVersion:1})).status,409);
  assert.equal((await req('/documents/'+uploaded.id)).body.projectDraft.program.id,'WASEDA-SILS');
  assert.equal((await req('/bootstrap')).body.programs.length,5);
  assert.equal((await req('/programs',{program:draft.program,note:'尚未补全',documentId:uploaded.id,expectedDraftVersion:2})).status,400);
  const complete=structuredClone(boot.programs[0]);complete.id='WASEDA-SILS';complete.school='早稻田大学';complete.name='Test SILS';complete.sourceIds=[uploaded.id];
  const rebase=value=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(key==='sourceId')value[key]=uploaded.id;else rebase(child);}};rebase(complete);
  assert.equal((await req('/programs',{program:complete,note:'已核对完整测试规则',documentId:uploaded.id,expectedDraftVersion:1})).status,409);
  assert.equal((await req('/programs',{program:{...complete,id:'CRPS'},note:'编号冲突测试',documentId:uploaded.id,expectedDraftVersion:2})).status,409);
  const published=await req('/programs',{program:complete,note:'已核对完整测试规则',documentId:uploaded.id,expectedDraftVersion:2});assert.equal(published.status,200);assert.equal(published.body.version,1);
  const after=(await req('/documents/'+uploaded.id)).body;assert.equal(after.projectDraft,undefined);assert.deepEqual(after.linkedPrograms,['WASEDA-SILS']);
  assert.equal((await req('/bootstrap')).body.programs.length,6);
 });
});
