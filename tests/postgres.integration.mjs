// Explicit opt-in: never use the application's production schema for tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../lib/database.mjs';
import { exerciseDatabase,fixture } from './database.test.mjs';
import { verifySnapshot } from '../lib/database-migration.mjs';

test('PostgreSQL: persistence, concurrent writes, rollback, files, settings and private schema',{skip:!process.env.SGU_TEST_DATABASE_URL},async()=>{
 const schema='sgu_test_'+randomUUID().replaceAll('-','');
 let first=await openDatabase({url:process.env.SGU_TEST_DATABASE_URL,schema}),second;
 try{
  await exerciseDatabase(first);await first.close();first=null;
  second=await openDatabase({url:process.env.SGU_TEST_DATABASE_URL,schema});await verifySnapshot(second,fixture());
  const rls=await second.prepare('SELECT relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace WHERE nspname=? AND relname=?').get(schema,'users');assert.equal(rls.relrowsecurity,true);
  const roles=await second.prepare("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')").all();
  for(const {rolname} of roles)assert.equal((await second.prepare('SELECT has_schema_privilege(?, ?, ?) AS allowed').get(rolname,schema,'USAGE')).allowed,false);
  let release,entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
  const owner=second.withLease('document:test',async()=>{entered();await hold;});await started;
  const other=await openDatabase({url:process.env.SGU_TEST_DATABASE_URL,schema});
  try{assert.equal((await other.withLease('document:test',()=>assert.fail('duplicate worker'))).acquired,false);release();await owner;assert.equal((await other.withLease('document:test',()=>true)).acquired,true);}finally{release();await other.close();}
 }finally{
  const cleanup=second||first||await openDatabase({url:process.env.SGU_TEST_DATABASE_URL,schema});
  // This exact random schema belongs only to this test invocation.
  await cleanup.exec(`DROP SCHEMA ${schema} CASCADE`);await cleanup.close();
 }
});
