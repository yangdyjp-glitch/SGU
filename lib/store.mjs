import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { seedPrograms, source } from './seed.mjs';
import { openDatabase, initializeDatabase } from './database.mjs';
import { readDocument, readDocumentSummaries, readRecoveryDocuments } from './document-storage.mjs';

export const dataDir=resolve(process.env.DATA_DIR||'.data');
mkdirSync(dataDir,{recursive:true});
export const db=await openDatabase({filename:resolve(dataDir,'sgu.db')});
await initializeDatabase(db);
const parse=row=>row?JSON.parse(row.data):null;
export const now=()=>new Date().toISOString();
export const transaction=fn=>db.transaction(fn);
export async function event(kind,subject,actor,detail){
 return transaction(async()=>{
  await db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(randomUUID(),kind,subject,actor,JSON.stringify(detail),now());
  await db.prepare("INSERT INTO meta VALUES('revision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(meta.value AS INTEGER)+1 AS TEXT)").run();
 });
}
await transaction(async()=>{
 if(await db.prepare("SELECT 1 FROM meta WHERE key='seeded'").get())return;
 // Existing imports must never be replaced by the starter catalogue.
 if(Number((await db.prepare('SELECT count(*) AS n FROM programs').get()).n)===0){
  for(const p of seedPrograms()){
   await db.prepare('INSERT INTO programs VALUES(?,?,?)').run(p.id,1,JSON.stringify(p));
   await db.prepare('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),p.id,1,JSON.stringify(p),'初始资料导入','根据已确认招生分析初始化',now(),null);
  }
  await db.prepare('INSERT INTO documents VALUES(?,?) ON CONFLICT(id) DO NOTHING').run(source.id,JSON.stringify({...source,status:'ready',builtin:true}));
  await event('initialize','规则库','系统',{programs:5});
 }
 await db.prepare("INSERT INTO meta VALUES('seeded','1')").run();
 await db.prepare("INSERT INTO meta VALUES('invite',?) ON CONFLICT(key) DO NOTHING").run(randomBytes(18).toString('base64url'));
});

export const getPrograms=async()=>(await db.prepare('SELECT data FROM programs ORDER BY id').all()).map(parse);
export const getProgram=async id=>parse(await db.prepare('SELECT data FROM programs WHERE id=?').get(id));
export const getStudent=async id=>parse(await db.prepare('SELECT data FROM students WHERE id=?').get(id));
export async function listStudents(){return (await db.prepare('SELECT * FROM students ORDER BY updated_at DESC').all()).map(r=>({...parse(r),updatedAt:r.updated_at,updatedBy:r.actor}));}
export function saveStudent(student,actor,expectedRevision){return transaction(async()=>{
 const old=await getStudent(student.id);
 if(old&&old.revision!==expectedRevision)throw Object.assign(new Error('学生资料已更新，请对比后重新保存'),{status:409,current:old});
 const s={...student,revision:(old?.revision||0)+1};
 await db.prepare('INSERT INTO students VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at,actor=excluded.actor').run(s.id,s.revision,JSON.stringify(s),now(),actor);
 await event('student',s.name,actor,{before:old,after:s});return s;
});}
// Caller owns the transaction, allowing a whole document to publish atomically.
export async function writeProgram(program,actor,note,expectedVersion,restoredFrom=null){
 const old=await getProgram(program.id);
 if(old&&old.version!==expectedVersion)throw Object.assign(new Error('项目已被同事修改，请对比差异后再保存'),{status:409,current:old});
 const p={...program,version:(old?.version||0)+1,reviewed:true};
 await db.prepare('INSERT INTO programs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,data=excluded.data').run(p.id,p.version,JSON.stringify(p));
 await db.prepare('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),p.id,p.version,JSON.stringify(p),actor,note,now(),restoredFrom);
 await event(restoredFrom?'restore':'rule',p.id,actor,{from:old?.version,to:p.version,note,restoredFrom});return p;
}
export function saveProgram(program,actor,note,expectedVersion,restoredFrom=null,sourceDocument=null){return transaction(async()=>{
 const p=await writeProgram(program,actor,note,expectedVersion,restoredFrom);
 if(sourceDocument){sourceDocument.linkedPrograms=[...new Set([...(sourceDocument.linkedPrograms||[]),p.id])];delete sourceDocument.projectDraft;await saveDocument(sourceDocument);}
 return p;
});}
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function passwordVerify(password,hash){try{const [salt,key]=hash.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}catch{return false;}}
export function newSession(userId){return transaction(async()=>{
 const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');
 await db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
 await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hashToken(token),userId,Date.now()+7*86400000,csrf);return {token,csrf};
});}
export const hashToken=t=>createHash('sha256').update(t).digest('hex');
export async function sessionUser(token){if(!token)return null;return db.prepare('SELECT users.id,users.login,users.role,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires_at>?').get(hashToken(token),Date.now());}
export async function saveDocument(doc){await db.prepare('INSERT INTO documents VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(doc.id,JSON.stringify(doc));}
export async function getDocuments(){return (await db.prepare('SELECT data FROM documents').all()).map(parse);}
export const getDocument=id=>readDocument(db,id);
export const getDocumentSummaries=()=>readDocumentSummaries(db);
export const getRecoveryDocuments=()=>readRecoveryDocuments(db);
