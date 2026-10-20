import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const base='http://127.0.0.1:3222';
test('authenticated team workflow, version history, conflicts and ingestion',async t=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3222',HOST:'127.0.0.1',DATA_DIR:'.qa/test-'+randomUUID()},stdio:['ignore','pipe','pipe'],windowsHide:true});
 t.after(async()=>{child.kill();await once(child,'exit').catch(()=>{});});
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('server exited early');})]);
 let cookie='',csrf='';
 async function req(path,body,extra={}){const res=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-SGU-Request':'1','X-CSRF-Token':csrf,Cookie:cookie,...extra},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,headers:res.headers,body:await res.json()};}
 await t.test('no anonymous access',async()=>{assert.equal((await req('/bootstrap')).status,401);assert.equal((await fetch(base+'/sources/aohb27.pdf')).status,401);});
 await t.test('first employee and isolated session',async()=>{const r=await req('/auth/register',{name:'测试顾问',login:'reviewer',password:'Temporary-QA-Only-2026'});assert.equal(r.status,201);cookie=r.headers.get('set-cookie').split(';')[0];csrf=r.body.csrf;assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal((await req('/bootstrap')).body.programs.length,5);});
 await t.test('joining requires correct invitation and CSRF/origin enforced',async()=>{assert.equal((await req('/auth/register',{name:'测试同事',login:'reviewer2',password:'Temporary-QA-Only-2026',invite:'wrong'})).status,403);assert.equal((await req('/match',{studentId:'sample-lin'},{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await req('/match',{studentId:'sample-lin'},{Origin:'https://other.example'})).status,403);});
 let boot=(await req('/bootstrap')).body;
 let originalMatch;
 await t.test('matching stores a student and rule snapshot',async()=>{originalMatch=(await req('/match',{studentId:'sample-lin'})).body;assert.ok(originalMatch.id);assert.equal(originalMatch.results.length,7);assert.ok(originalMatch.results.some(r=>r.state==='conditional'));});
 await t.test('student optimistic lock prevents lost update',async()=>{const s=structuredClone(boot.students[0]);const first=await req('/students',{student:{...s,notes:'第一次修改'},expectedRevision:s.revision});assert.equal(first.status,200);const stale=await req('/students',{student:{...s,notes:'过时修改'},expectedRevision:s.revision});assert.equal(stale.status,409);assert.equal(stale.body.current.notes,'第一次修改');});
 await t.test('rule edits immediately affect queries and old edit conflicts',async()=>{const p=structuredClone(boot.programs.find(p=>p.id==='GLA'));p.tuition={...p.tuition,status:'published',amount:1234567};const saved=await req('/programs',{program:p,expectedVersion:1,note:'接口测试：核对学费原文后修正'});assert.equal(saved.status,200);assert.equal(saved.body.version,2);const answer=await req('/query',{query:{mode:'tuition'}});assert.ok(answer.body.matched.some(x=>x.id==='GLA'&&x.reasons[0].includes('1234567')));const conflict=await req('/programs',{program:p,expectedVersion:1,note:'陈旧版本应被拦截'});assert.equal(conflict.status,409);assert.equal(conflict.body.current.version,2);});
 await t.test('old matches unchanged after version edit; rollback is a new version',async()=>{const snapshot=(await req('/matches/'+originalMatch.id)).body;assert.equal(snapshot.programs.find(p=>p.id==='GLA').tuition.status,'unspecified');assert.equal(snapshot.student.revision,1);const restore=await req('/restore',{programId:'GLA',version:1,expectedVersion:2});assert.equal(restore.body.version,3);assert.equal(restore.body.tuition.status,'unspecified');assert.equal((await req('/versions?programId=GLA')).body.length,3);});
 await t.test('uploaded extraction stays suggestions until employee saves',async()=>{const upload=await req('/documents',{filename:'test-admissions.txt',base64:Buffer.from('English requirement: TOEFL iBT minimum score 80.\nAnnual tuition is not specified.').toString('base64')});assert.equal(upload.status,201);await req('/documents/'+upload.body.id+'/parse',{});let doc;for(let i=0;i<20;i++){doc=(await req('/documents/'+upload.body.id)).body;if(doc.status!=='parsing')break;await delay(30);}assert.equal(doc.status,'review');assert.ok(doc.suggestions.length>=1);assert.equal((await req('/bootstrap')).body.programs.find(p=>p.id==='GLA').version,3);});
 await t.test('audit and backups contain rule and match history',async()=>{assert.ok((await req('/events')).body.some(x=>x.kind==='restore'));const backup=await req('/export');assert.ok(backup.body.matches.length);assert.ok(backup.body.versions.length>5);assert.equal(backup.body.users,undefined);});
});
