import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { openDatabase,initializeDatabase } from '../lib/database.mjs';
import { exportSqlite,mergeSnapshots,importSnapshot,verifySnapshot } from '../lib/database-migration.mjs';

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes('--online')||!args.includes('--local-dir')||!args.includes('--backup-dir'))throw new Error('请指定 --online 线上备份 --local-dir 本地数据目录 --backup-dir 私有备份目录；默认只预览，--apply 才写入目标数据库');
const backupDir=resolve(option('--backup-dir'));mkdirSync(backupDir,{recursive:true});
const online=JSON.parse(readFileSync(resolve(option('--online')),'utf8')),local=exportSqlite(option('--local-dir'));
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
writeFileSync(join(backupDir,'local-'+stamp+'.json'),JSON.stringify(local),{mode:0o600,flag:'wx'});
const {snapshot,report}=mergeSnapshots(online,local);
writeFileSync(join(backupDir,'merged-'+stamp+'.json'),JSON.stringify(snapshot),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({mode:args.includes('--apply')?'apply':'preview',...report}));
if(args.includes('--apply')){
 if(!process.env.DATABASE_URL?.trim())throw new Error('请先配置目标 DATABASE_URL');
 const db=await openDatabase();
 try{await initializeDatabase(db);await importSnapshot(db,snapshot);await verifySnapshot(db,snapshot);console.log('迁移已提交，记录及原文件逐项核对通过。');}finally{await db.close();}
}
