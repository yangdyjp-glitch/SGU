import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

export const columns={
 meta:['key','value'],users:['id','name','login','password','created_at','role'],sessions:['token','user_id','expires_at','csrf'],
 programs:['id','version','data'],versions:['id','program_id','version','data','actor','note','created_at','restored_from'],
 students:['id','revision','data','updated_at','actor'],matches:['id','student_id','data','actor','created_at'],
 events:['id','kind','subject','actor','detail','created_at'],documents:['id','data']
};
const digest=content=>createHash('sha256').update(content).digest('hex');
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const sameData=(a,b)=>equal(JSON.parse(a),JSON.parse(b));
const conflict=(kind,key)=>{throw new Error(`迁移冲突：${kind} ${key}；原数据未覆盖`);};
const keyOf=(table,row)=>table==='meta'?row.key:table==='sessions'?row.token:row.id;

// Read a consistent SQLite snapshot. Credentials stay in private backup files.
export function exportSqlite(directory){
 directory=resolve(directory);const db=new DatabaseSync(join(directory,'sgu.db'),{readOnly:true});
 const snapshot={format:'sgu-migration-v1',createdAt:new Date().toISOString(),tables:{},files:[],settings:{}};
 try{
  db.exec('BEGIN');
  for(const table of Object.keys(columns))snapshot.tables[table]=db.prepare('SELECT * FROM '+table).all();
  const seen=new Set();
  for(const row of snapshot.tables.documents){
   const doc=JSON.parse(row.data);if(doc.builtin)continue;
   for(const name of [doc.storageName,doc.id+'.md']){
    if(!name||!/^[-\w]+\.(pdf|txt|md)$/i.test(name))throw new Error('备份文件名无效');
    if(seen.has(name))continue;seen.add(name);
    const file=join(directory,'uploads',name);
    if(!existsSync(file)){if(name===doc.storageName)throw new Error('原文件缺失：'+name);continue;}
    const content=readFileSync(file);snapshot.files.push({name,base64:content.toString('base64'),sha256:digest(content)});
   }
  }
  if(existsSync(join(directory,'openai.json')))snapshot.settings.openai=JSON.parse(readFileSync(join(directory,'openai.json'),'utf8'));
  db.exec('COMMIT');return snapshot;
 }finally{db.close();}
}

export function validateSnapshot(snapshot){
 if(snapshot?.format!=='sgu-migration-v1')throw new Error('不支持的备份格式');
 for(const table of Object.keys(columns)){
  if(!Array.isArray(snapshot.tables?.[table]))throw new Error('备份缺少表：'+table);
  const seen=new Set();for(const row of snapshot.tables[table]){const key=keyOf(table,row);if(!key||seen.has(key))conflict(table,'重复或缺少编号');seen.add(key);}
 }
 const users=new Set(snapshot.tables.users.map(u=>u.id));
 for(const row of snapshot.tables.sessions)if(!users.has(row.user_id))throw new Error('会话账号缺失');
 const versions=new Map();
 for(const row of snapshot.tables.versions){const key=row.program_id+':'+row.version;if(versions.has(key))conflict('历史版本',key);versions.set(key,row);}
 for(const row of snapshot.tables.programs){const v=versions.get(row.id+':'+row.version);if(!v||!sameData(v.data,row.data))conflict('当前项目与历史版本不一致',row.id);}
 const files=new Map();
 for(const file of snapshot.files||[]){
  if(!/^[-\w]+\.(pdf|txt|md)$/i.test(file.name)||digest(Buffer.from(file.base64,'base64'))!==file.sha256)throw new Error('备份文件校验失败');
  if(files.has(file.name)&&files.get(file.name)!==file.sha256)conflict('原文件',file.name);files.set(file.name,file.sha256);
 }
 for(const row of snapshot.tables.documents){const doc=JSON.parse(row.data);if(!doc.builtin&&!files.has(doc.storageName))throw new Error('备份缺少原文件：'+doc.id);}
 return snapshot;
}

// Primary is the live service: its accounts, sessions and settings take priority.
// Overlapping rule versions must agree before a newer local version can be added.
export function mergeSnapshots(primary,additional){
 validateSnapshot(primary);validateSnapshot(additional);
 const merged=structuredClone(primary),report={reusedAccounts:0,advancedPrograms:0,addedPrograms:0};
 const userIds=new Map(),users=merged.tables.users;
 for(const user of additional.tables.users){
  const sameLogin=users.find(u=>u.login.toLowerCase()===user.login.toLowerCase()),sameId=users.find(u=>u.id===user.id);
  if(sameId&&sameId.login!==user.login)conflict('账号编号',user.id);
  if(sameLogin){userIds.set(user.id,sameLogin.id);report.reusedAccounts++;}
  else{users.push(structuredClone(user));userIds.set(user.id,user.id);}
 }
 const histories=new Map(merged.tables.versions.map(row=>[row.program_id+':'+row.version,row]));
 for(const row of additional.tables.versions){
  const key=row.program_id+':'+row.version,old=histories.get(key);
  if(old){if(!sameData(old.data,row.data))conflict('项目版本',key);}
  else{if(merged.tables.versions.some(v=>v.id===row.id))conflict('历史编号',row.id);merged.tables.versions.push(structuredClone(row));histories.set(key,row);}
 }
 for(const row of additional.tables.programs){
  const index=merged.tables.programs.findIndex(p=>p.id===row.id),old=merged.tables.programs[index];
  if(!old){merged.tables.programs.push(structuredClone(row));report.addedPrograms++;}
  else if(row.version>old.version){merged.tables.programs[index]=structuredClone(row);report.advancedPrograms++;}
 }
 for(const table of ['sessions','students','matches','events','documents']){
  const rows=merged.tables[table],existing=new Map(rows.map(row=>[keyOf(table,row),row]));
  for(const original of additional.tables[table]){
   const row=structuredClone(original);if(table==='sessions')row.user_id=userIds.get(row.user_id);
   const old=existing.get(keyOf(table,row));
   if(old&&!equal(old,row))conflict(table,table==='sessions'?'已有会话':keyOf(table,row));
   if(!old){rows.push(row);existing.set(keyOf(table,row),row);}
  }
 }
 for(const row of additional.tables.meta){
  const old=merged.tables.meta.find(m=>m.key===row.key);
  if(!old)merged.tables.meta.push(structuredClone(row));
  else if(row.key==='revision')old.value=String(Math.max(Number(old.value)||0,Number(row.value)||0));
 }
 const files=new Map(merged.files.map(file=>[file.name,file]));
 for(const file of additional.files){const old=files.get(file.name);if(old&&old.sha256!==file.sha256)conflict('原文件',file.name);if(!old){merged.files.push(structuredClone(file));files.set(file.name,file);}}
 merged.settings={...additional.settings,...primary.settings};
 merged.createdAt=new Date().toISOString();validateSnapshot(merged);
 return {snapshot:merged,report:{...report,counts:Object.fromEntries(Object.entries(merged.tables).map(([table,rows])=>[table,rows.length])),files:merged.files.length}};
}

// Additive and atomic. Re-running the same backup is safe; an independently
// changed destination causes a rollback instead of overwriting later edits.
export async function importSnapshot(db,snapshot){
 validateSnapshot(snapshot);
 return db.transaction(async()=>{
  for(const table of ['meta','users','sessions','versions','programs','students','matches','events','documents']){
   const names=columns[table];
   for(const row of snapshot.tables[table]){
    const key=names[0],old=await db.prepare(`SELECT * FROM ${table} WHERE ${key}=?`).get(row[key]);
    if(old){
     const comparable=Object.fromEntries(names.map(name=>[name,name==='expires_at'?Number(old[name]):old[name]]));
     if(table==='meta'){if(row.key==='revision'&&Number(row.value)>Number(old.value))await db.prepare('UPDATE meta SET value=? WHERE key=?').run(row.value,row.key);continue;}
     if(table==='programs'&&old.version<row.version){
      const base=snapshot.tables.versions.find(v=>v.program_id===row.id&&v.version===old.version);
      if(!base||!sameData(base.data,old.data))conflict('目标当前版本',row.id);
      await db.prepare('UPDATE programs SET version=?,data=? WHERE id=?').run(row.version,row.data,row.id);continue;
     }
     if(!equal(comparable,row))conflict('目标 '+table,table==='sessions'?'已有会话':row[key]);
    }else await db.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES(${names.map(()=>'?').join(',')})`).run(...names.map(name=>row[name]??null));
   }
  }
  for(const [key,value] of Object.entries(snapshot.settings)){
   const old=await db.prepare('SELECT value FROM settings WHERE key=?').get(key);
   if(old&&!equal(JSON.parse(old.value),value))conflict('服务配置',key);
   if(!old)await db.prepare('INSERT INTO settings VALUES(?,?)').run(key,JSON.stringify(value));
  }
  for(const file of snapshot.files){
   const old=await db.prepare('SELECT sha256 FROM files WHERE name=?').get(file.name);
   if(old&&old.sha256!==file.sha256)conflict('目标原文件',file.name);
   if(!old)await db.prepare('INSERT INTO files VALUES(?,?,?)').run(file.name,Buffer.from(file.base64,'base64'),file.sha256);
  }
 });
}

export async function verifySnapshot(db,snapshot){
 for(const [table,rows] of Object.entries(snapshot.tables)){
  for(const row of rows){const key=columns[table][0],old=await db.prepare(`SELECT * FROM ${table} WHERE ${key}=?`).get(row[key]);
   if(!old)throw new Error('迁移核对缺失：'+table);
   if(table==='meta'){if(row.key==='revision'&&Number(old.value)<Number(row.value))throw new Error('修订号回退');continue;}
   const actual=Object.fromEntries(columns[table].map(name=>[name,name==='expires_at'?Number(old[name]):old[name]]));
   if(!equal(actual,row))throw new Error('迁移核对不一致：'+table);
  }
 }
 for(const file of snapshot.files){const row=await db.prepare('SELECT content,sha256 FROM files WHERE name=?').get(file.name);if(!row||row.sha256!==file.sha256||digest(row.content)!==file.sha256)throw new Error('迁移原文件核对失败');}
 for(const [key,value] of Object.entries(snapshot.settings)){const row=await db.prepare('SELECT value FROM settings WHERE key=?').get(key);if(!row||!equal(JSON.parse(row.value),value))throw new Error('迁移配置核对失败');}
 return true;
}
