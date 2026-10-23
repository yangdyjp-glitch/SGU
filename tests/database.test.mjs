import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDatabase,initializeDatabase,postgresSql,postgresOptions } from '../lib/database.mjs';
import { mergeSnapshots,importSnapshot,verifySnapshot,columns } from '../lib/database-migration.mjs';

export function fixture(){
 const data=JSON.stringify({id:'P1',version:1,name:'原始资格',paths:[{label:'AS only',requirements:['须完整 A-Level']}]});
 const content=Buffer.from('原文与完整资格要求');
 return {format:'sgu-migration-v1',tables:{...Object.fromEntries(Object.keys(columns).map(k=>[k,[]])),
 meta:[{key:'seeded',value:'1'},{key:'revision',value:'7'},{key:'invite',value:'private-invite'}],
 users:[{id:'u1',name:'admin',login:'admin',password:'retained-hash',created_at:'2026-01-01',role:'admin'}],
 sessions:[{token:'hashed-session',user_id:'u1',expires_at:2000000000000,csrf:'retained-csrf'}],
 programs:[{id:'P1',version:1,data}],versions:[{id:'v1',program_id:'P1',version:1,data,actor:'admin',note:'原始依据',created_at:'2026-01-01',restored_from:null}],
 students:[{id:'s1',revision:1,data:JSON.stringify({id:'s1',revision:1,education:{qualification:'AS',status:'in_progress'}}),updated_at:'2026-01-01',actor:'admin'}],
 matches:[{id:'m1',student_id:'s1',data:'{"result":"unknown","original":"不扩大资格认可"}',actor:'admin',created_at:'2026-01-01'}],
 documents:[{id:'d1',data:JSON.stringify({id:'d1',storageName:'d1.txt',status:'published',linkedPrograms:['P1']})}]},
 files:[{name:'d1.txt',base64:content.toString('base64'),sha256:createHash('sha256').update(content).digest('hex')}],settings:{openai:{apiKey:'test-only-value',model:'test-model'}}};
}

test('PostgreSQL placeholders and TLS retain quoted text and reject unverified peers',()=>{
 assert.equal(postgresSql("SELECT '?' AS name,\"?\" WHERE id=? AND value=?"),"SELECT '?' AS name,\"?\" WHERE id=$1 AND value=$2");
 const options=postgresOptions({DATABASE_URL:'postgresql://user:pass@db.example/db?sslmode=no-verify'});
 assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(new URL(options.connectionString).searchParams.has('sslmode'),false);
});

test('live account wins; compatible newer rules merge; ambiguous rules are rejected',()=>{
 const live=fixture(),local=fixture();local.tables.users[0].id='local-admin';local.tables.users[0].password='local-hash';local.tables.sessions[0].user_id='local-admin';local.tables.sessions[0].token='local-session';
 const next={...local.tables.programs[0],version:2,data:JSON.stringify({id:'P1',version:2,name:'人工修订'})};local.tables.programs[0]=next;
 local.tables.versions.push({...local.tables.versions[0],id:'v2',version:2,data:next.data,note:'修订原因'});
 const {snapshot}=mergeSnapshots(live,local);
 assert.equal(snapshot.tables.users.length,1);assert.equal(snapshot.tables.users[0].password,'retained-hash');assert.equal(snapshot.tables.sessions[1].user_id,'u1');
 assert.equal(snapshot.tables.programs[0].version,2);assert.equal(snapshot.tables.versions.length,2);
 local.tables.versions[0].data='{"id":"P1","version":1,"name":"不同规则"}';
 assert.throws(()=>mergeSnapshots(live,local),/项目版本/);
});

export async function exerciseDatabase(db){
 await initializeDatabase(db);const snapshot=fixture();await importSnapshot(db,snapshot);await importSnapshot(db,snapshot);await verifySnapshot(db,snapshot);
 const exec=db.exec;db.exec=()=>assert.fail('an initialized database must not take DDL locks on restart');
 try{await initializeDatabase(db);}finally{db.exec=exec;}
 assert.equal(Number((await db.prepare('SELECT count(*) n FROM students').get()).n),1);
 await assert.rejects(db.transaction(async()=>{await db.prepare("UPDATE programs SET version=9 WHERE id='P1'").run();throw new Error('rollback');}),/rollback/);
 assert.equal((await db.prepare("SELECT version FROM programs WHERE id='P1'").get()).version,1);
 const change=()=>db.transaction(async()=>{const row=await db.prepare("SELECT revision FROM students WHERE id='s1'").get();if(row.revision!==1)throw new Error('conflict');await new Promise(r=>setTimeout(r,5));await db.prepare("UPDATE students SET revision=2 WHERE id='s1'").run();});
 const concurrent=await Promise.allSettled([change(),change()]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.match(concurrent.find(r=>r.status==='rejected').reason.message,/conflict/);
 // A failed re-import must roll back even rows visited before the conflict.
 const changed=structuredClone(snapshot);changed.tables.meta[1].value='999';
 await assert.rejects(importSnapshot(db,changed),/迁移冲突/);
 assert.equal((await db.prepare("SELECT value FROM meta WHERE key='revision'").get()).value,'7');
 await db.prepare("UPDATE students SET revision=1 WHERE id='s1'").run();await verifySnapshot(db,snapshot);
}

test('SQLite async transactions, merge replay and rollback preserve legacy JSON',async()=>{
 const db=await openDatabase({url:'',filename:':memory:'});try{await exerciseDatabase(db);}finally{await db.close();}
});
