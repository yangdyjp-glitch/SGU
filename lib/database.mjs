import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import pg from 'pg';

// The application's SQL keeps its existing placeholders and JSON payloads.
// Only the driver changes; there is no local replica of a connected database.
export function postgresSql(sql) {
 let index=0;
 return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,token=>token==='?'?'$'+(++index):token);
}

export function postgresOptions(env=process.env) {
 let uri;
 try {uri=new URL(env.DATABASE_URL);} catch {throw new Error('DATABASE_URL 不是有效的数据库连接地址');}
 if(!['postgres:','postgresql:'].includes(uri.protocol))throw new Error('DATABASE_URL 必须是 PostgreSQL 连接地址');
 // pg lets URL ssl parameters replace the TLS object. Always verify the peer.
 for(const name of ['sslmode','sslcert','sslkey','sslrootcert','ssl','uselibpqcompat'])uri.searchParams.delete(name);
 const supabase=uri.hostname.endsWith('.supabase.co')||uri.hostname.endsWith('.pooler.supabase.com');
 const ca=env.DATABASE_CA_FILE?readFileSync(env.DATABASE_CA_FILE,'utf8'):supabase?readFileSync(new URL('./certs/supabase-prod-ca-2021.crt',import.meta.url),'utf8'):undefined;
 return {connectionString:uri.href,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},connectionTimeoutMillis:15000,statement_timeout:30000,idleTimeoutMillis:30000,max:5,application_name:'sgu-workbench'};
}

export async function openDatabase({url=process.env.DATABASE_URL,filename,schema=process.env.DATABASE_SCHEMA||'sgu',env=process.env}={}) {
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(schema))throw new Error('数据库 schema 名称无效');
 const context=new AsyncLocalStorage();
 let raw,pool,tail=Promise.resolve();
 const postgres=Boolean(url?.trim());
 const exclusive=fn=>{const next=tail.then(fn,fn);tail=next.catch(()=>{});return next;};
 if(postgres){
  pool=new pg.Pool({...postgresOptions({...env,DATABASE_URL:url}),options:`-c search_path=${schema}`});
  pool.on('error',error=>console.error('Database connection interrupted:',error.code||'CONNECTION_ERROR'));
  await pool.query('SELECT 1');
 }else{
  raw=new DatabaseSync(filename);
  raw.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 }
 const current=()=>{const state=context.getStore();return state?.active?state:null;};
 async function execute(sql,params=[],mode='all') {
  if(postgres){
   const result=await (current()?.client||pool).query(postgresSql(sql),params);
   return mode==='get'?result.rows[0]:mode==='run'?{changes:result.rowCount}:result.rows;
  }
  const run=()=>raw.prepare(sql)[mode](...params);
  return current()?run():exclusive(run);
 }
 const db={
  kind:postgres?'postgres':'sqlite',schema,raw,
  prepare(sql){return Object.fromEntries(['get','all','run'].map(mode=>[mode,(...params)=>execute(sql,params,mode)]));},
  async exec(sql){if(postgres)return (current()?.client||pool).query(sql);return current()?raw.exec(sql):exclusive(()=>raw.exec(sql));},
  async transaction(fn){
   if(current())return fn();
   const run=async()=>{
    const client=postgres?await pool.connect():null,state={client,active:true};
    try{
     if(postgres){await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['sgu-write:'+schema]);}
     else raw.exec('BEGIN IMMEDIATE');
     const result=await context.run(state,fn);
     if(postgres)await client.query('COMMIT');else raw.exec('COMMIT');
     return result;
    }catch(error){try{if(postgres)await client.query('ROLLBACK');else raw.exec('ROLLBACK');}catch{}throw error;}
    finally{state.active=false;client?.release();}
   };
   return postgres?run():exclusive(run);
  },
  async withLease(name,fn){
   if(!postgres)return {acquired:true,result:await fn()};
   const client=await pool.connect();let acquired=false;
   try{
    acquired=(await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',[schema+':'+name])).rows[0].acquired;
    return acquired?{acquired:true,result:await fn()}:{acquired:false};
   }finally{let discard=false;if(acquired)await client.query('SELECT pg_advisory_unlock(hashtext($1))',[schema+':'+name]).catch(()=>{discard=true;});client.release(discard);}
  },
  async close(){if(postgres)await pool.end();else await exclusive(()=>raw.close());}
 };
 return db;
}

export async function initializeDatabase(db) {
 await db.transaction(async()=>{
  if(db.kind==='postgres'){
   await db.exec(`CREATE SCHEMA IF NOT EXISTS ${db.schema}; REVOKE ALL ON SCHEMA ${db.schema} FROM PUBLIC;`);
  }
  await db.exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,login TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at BIGINT NOT NULL,csrf TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS programs(id TEXT PRIMARY KEY,version INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,program_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL,restored_from INTEGER,UNIQUE(program_id,version));
CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL,actor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,student_id TEXT NOT NULL,data TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,subject TEXT NOT NULL,actor TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files(name TEXT PRIMARY KEY,content ${db.kind==='postgres'?'BYTEA':'BLOB'} NOT NULL,sha256 TEXT NOT NULL);`);
  const columns=db.kind==='postgres'?await db.prepare('SELECT column_name AS name FROM information_schema.columns WHERE table_schema=? AND table_name=?').all(db.schema,'users'):await db.prepare('PRAGMA table_info(users)').all();
  if(!columns.some(column=>column.name==='role'))await db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'; UPDATE users SET role='admin' WHERE id=(SELECT id FROM users ORDER BY created_at,id LIMIT 1);");
  if(db.kind==='postgres'){
   for(const table of ['meta','users','sessions','programs','versions','students','matches','events','documents','settings','files'])await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE ${table} FROM PUBLIC;`);
   const roles=await db.prepare("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')").all();
   for(const {rolname} of roles)await db.exec(`REVOKE ALL ON SCHEMA ${db.schema} FROM ${rolname}; REVOKE ALL ON ALL TABLES IN SCHEMA ${db.schema} FROM ${rolname};`);
  }
 });
}
