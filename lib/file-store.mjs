import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { db,dataDir } from './store.mjs';

function filePath(name){if(!/^[a-zA-Z0-9_-]+\.(pdf|md|txt)$/i.test(name))throw new Error('无效的文件存储名称');return join(dataDir,'uploads',name);}
export async function saveFile(name,content){
 const path=filePath(name);
 if(db.kind==='postgres')await db.prepare('INSERT INTO files VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET content=excluded.content,sha256=excluded.sha256').run(name,content,createHash('sha256').update(content).digest('hex'));
 else{await mkdir(join(dataDir,'uploads'),{recursive:true});await writeFile(path,content);}
}
export async function loadFile(name){
 const path=filePath(name);
 if(db.kind==='postgres'){
  const row=await db.prepare('SELECT content,sha256 FROM files WHERE name=?').get(name);
  if(row){if(createHash('sha256').update(row.content).digest('hex')!==row.sha256)throw new Error('原文件完整性检查失败');return row.content;}
 }
 return readFile(path);
}
// PDF tools need an input file. In cloud mode this is only a disposable cache.
export async function materializeFile(name){const path=filePath(name);if(db.kind==='postgres'){const content=await loadFile(name);await mkdir(join(dataDir,'uploads'),{recursive:true});await writeFile(path,content);}return path;}
