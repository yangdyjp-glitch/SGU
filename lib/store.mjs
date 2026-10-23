import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { seedPrograms, source } from './seed.mjs';
export const dataDir=resolve(process.env.DATA_DIR||'.data');mkdirSync(dataDir,{recursive:true});
export const db=new DatabaseSync(resolve(dataDir,'sgu.db'));db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,login TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,csrf TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS programs(id TEXT PRIMARY KEY,version INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,program_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL,restored_from INTEGER,UNIQUE(program_id,version));
CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL,actor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,student_id TEXT NOT NULL,data TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,subject TEXT NOT NULL,actor TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,data TEXT NOT NULL);`);
if(!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='role')){
 db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'; UPDATE users SET role='admin' WHERE id=(SELECT id FROM users ORDER BY created_at,id LIMIT 1);");
}
const parse=row=>row?JSON.parse(row.data):null;
export const now=()=>new Date().toISOString();
export function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
export function event(kind,subject,actor,detail){db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(randomUUID(),kind,subject,actor,JSON.stringify(detail),now());db.prepare("INSERT INTO meta VALUES('revision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)").run();}
if(!db.prepare("SELECT 1 FROM meta WHERE key='seeded'").get())transaction(()=>{
 for(const p of seedPrograms()){db.prepare('INSERT INTO programs VALUES(?,?,?)').run(p.id,1,JSON.stringify(p));db.prepare('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),p.id,1,JSON.stringify(p),'初始资料导入','根据已确认招生分析初始化',now(),null);}
 db.prepare('INSERT INTO documents VALUES(?,?)').run(source.id,JSON.stringify({...source,status:'ready',builtin:true}));
 db.prepare("INSERT INTO meta VALUES('seeded','1')").run();db.prepare("INSERT INTO meta VALUES('invite',?)").run(randomBytes(18).toString('base64url'));event('initialize','规则库','系统',{programs:5});
});
export const getPrograms=()=>db.prepare('SELECT data FROM programs ORDER BY id').all().map(parse);
export const getProgram=id=>parse(db.prepare('SELECT data FROM programs WHERE id=?').get(id));
export const getStudent=id=>parse(db.prepare('SELECT data FROM students WHERE id=?').get(id));
export function listStudents(){return db.prepare('SELECT * FROM students ORDER BY updated_at DESC').all().map(r=>({...parse(r),updatedAt:r.updated_at,updatedBy:r.actor}));}
export function saveStudent(student,actor,expectedRevision){return transaction(()=>{const old=getStudent(student.id);if(old&&old.revision!==expectedRevision)throw Object.assign(new Error('学生资料已更新，请对比后重新保存'),{status:409,current:old});const s={...student,revision:(old?.revision||0)+1};db.prepare('INSERT INTO students VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at,actor=excluded.actor').run(s.id,s.revision,JSON.stringify(s),now(),actor);event('student',s.name,actor,{before:old,after:s});return s;});}
// Caller owns the transaction, allowing a whole document to publish atomically.
export function writeProgram(program,actor,note,expectedVersion,restoredFrom=null){const old=getProgram(program.id);if(old&&old.version!==expectedVersion)throw Object.assign(new Error('项目已被同事修改，请对比差异后再保存'),{status:409,current:old});const p={...program,version:(old?.version||0)+1,reviewed:true};db.prepare('INSERT INTO programs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,data=excluded.data').run(p.id,p.version,JSON.stringify(p));db.prepare('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),p.id,p.version,JSON.stringify(p),actor,note,now(),restoredFrom);event(restoredFrom?'restore':'rule',p.id,actor,{from:old?.version,to:p.version,note,restoredFrom});return p;}
export function saveProgram(program,actor,note,expectedVersion,restoredFrom=null,sourceDocument=null){return transaction(()=>{const p=writeProgram(program,actor,note,expectedVersion,restoredFrom);if(sourceDocument){sourceDocument.linkedPrograms=[...new Set([...(sourceDocument.linkedPrograms||[]),p.id])];delete sourceDocument.projectDraft;saveDocument(sourceDocument);}return p;});}
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function passwordVerify(password,hash){try{const [salt,key]=hash.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}catch{return false;}}
export function newSession(userId){const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hashToken(token),userId,Date.now()+7*86400000,csrf);return {token,csrf};}
export const hashToken=t=>createHash('sha256').update(t).digest('hex');
export function sessionUser(token){if(!token)return null;return db.prepare('SELECT users.id,users.login,users.role,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires_at>?').get(hashToken(token),Date.now());}
export function saveDocument(doc){db.prepare('INSERT INTO documents VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(doc.id,JSON.stringify(doc));}
export function getDocuments(){return db.prepare('SELECT data FROM documents').all().map(parse);}
