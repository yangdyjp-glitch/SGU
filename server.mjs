import http from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, join, sep } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { db,dataDir,now,transaction,event,getPrograms,getProgram,listStudents,getStudent,saveStudent,saveProgram,passwordHash,passwordVerify,newSession,sessionUser,hashToken,getDocuments,saveDocument } from './lib/store.mjs';
import { matchAll,checkCombination,validateProgram,validDate } from './lib/engine.mjs';
import { parseQuery,queryPrograms,parseStudentText } from './lib/query.mjs';
import { interpretQuery,llmEnabled } from './lib/llm.mjs';
import { parseDocument,isIngestBusy } from './lib/ingest.mjs';
const root=resolve('public');const port=Number(process.env.PORT||3210),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const fail=(message,status=400,extra={})=>{throw Object.assign(new Error(message),{status,...extra});};
function send(res,status,obj,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(obj));}
async function readBody(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>35*1024*1024)fail('文件或请求过大，最大25MB文件',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail('请求不是有效JSON');}}
const userCount=()=>db.prepare('SELECT count(*) AS n FROM users').get().n;
for(const doc of getDocuments())if(doc.status==='parsing'){doc.status='error';doc.error='服务曾在解析期间重启，请点击重试；原始文件已保留。';saveDocument(doc);}
const attempts=new Map();
function rateLimit(req){const key=req.socket.remoteAddress,now=Date.now();let bucket=attempts.get(key);if(!bucket||now-bucket.start>600000){bucket={start:now,count:0};attempts.set(key,bucket);}if(++bucket.count>30)fail('尝试次数较多，请10分钟后重试',429);}
function safeUser(u){return {id:u.id,name:u.name,login:u.login};}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 try{
  const url=new URL(req.url,'http://localhost');const path=url.pathname;const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sgu_session='))?.slice(12);const user=sessionUser(token);const actor=user?user.name+' ('+user.login+')':'';
  if(path.startsWith('/api/')){
   const isWrite=!['GET','HEAD'].includes(req.method);
   if(isWrite){if(!String(req.headers['content-type']).startsWith('application/json')||req.headers['x-sgu-request']!=='1')fail('无效请求来源',403);const expected=process.env.APP_ORIGIN||`http://${req.headers.host}`;if(req.headers.origin&&req.headers.origin!==expected)fail('不允许跨站请求',403);if(user&&!path.startsWith('/api/auth/')&&req.headers['x-csrf-token']!==user.csrf)fail('会话验证失败，请刷新页面',403);}
   const body=isWrite?await readBody(req):null;
   if(path==='/api/auth/state'&&req.method==='GET')return send(res,200,{setup:userCount()===0,user:user?safeUser(user):null,csrf:user?.csrf});
   if(path==='/api/auth/register'&&req.method==='POST'){
    rateLimit(req);if(typeof body.name!=='string'||!body.name.trim()||body.name.length>40||!/^[a-zA-Z0-9_.@-]{3,80}$/.test(body.login||'')||typeof body.password!=='string'||body.password.length<10||body.password.length>200)fail('请填写姓名、有效账号和至少10位密码');
    const created=transaction(()=>{if(userCount()>0&&body.invite!==db.prepare("SELECT value FROM meta WHERE key='invite'").get().value)fail('团队邀请码不正确',403);const u={id:randomUUID(),name:body.name.trim(),login:body.login.toLowerCase()};if(db.prepare('SELECT id FROM users WHERE login=?').get(u.login))fail('账号已存在');db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(u.id,u.name,u.login,passwordHash(body.password),now());event('account',u.name,u.name,{action:'加入团队'});return u;});
    const sess=newSession(created.id);return send(res,201,{user:created,csrf:sess.csrf},{'Set-Cookie':`sgu_session=${sess.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`});
   }
   if(path==='/api/auth/login'&&req.method==='POST'){
    rateLimit(req);const u=db.prepare('SELECT * FROM users WHERE login=?').get(String(body.login||'').toLowerCase());if(!u||!passwordVerify(String(body.password||''),u.password))fail('账号或密码不正确',401);const sess=newSession(u.id);return send(res,200,{user:safeUser(u),csrf:sess.csrf},{'Set-Cookie':`sgu_session=${sess.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`});
   }
   if(!user)fail('请先登录',401);
   if(path==='/api/auth/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(hashToken(token));return send(res,200,{ok:true},{'Set-Cookie':'sgu_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
   if(path==='/api/bootstrap'&&req.method==='GET')return send(res,200,{user:safeUser(user),csrf:user.csrf,students:listStudents(),programs:getPrograms(),documents:getDocuments().map(({text,...d})=>d),revision:db.prepare("SELECT value FROM meta WHERE key='revision'").get()?.value,capabilities:{model:llmEnabled(),mineru:Boolean(process.env.MINERU_BIN)},team:db.prepare('SELECT id,name,login FROM users').all()});
   if(path==='/api/revision'&&req.method==='GET')return send(res,200,{revision:db.prepare("SELECT value FROM meta WHERE key='revision'").get()?.value});
   if(path==='/api/team'&&req.method==='GET')return send(res,200,{users:db.prepare('SELECT id,name,login FROM users').all(),invite:db.prepare("SELECT value FROM meta WHERE key='invite'").get().value});
   if(path==='/api/students'&&req.method==='POST'){
    const s=body.student;if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>80)fail('请填写学生姓名');if(s.birthDate&&!validDate(s.birthDate)||s.graduationDate&&!validDate(s.graduationDate))fail('学生日期格式无效');
    if(s.intake&&!/^20\d{2}-(04|09)$/.test(s.intake))fail('入学期格式无效');if(s.exams&&!Array.isArray(s.exams)||s.exams?.length>30)fail('成绩列表无效');
    for(const e of s.exams||[]){if(e.date&&!validDate(e.date)||e.availableDate&&!validDate(e.availableDate)||e.date&&e.availableDate&&e.availableDate<e.date)fail('考试或出分日期无效');for(const k of ['score','reading','listening','writing','speaking'])if(e[k]!==undefined&&e[k]!==null&&(!Number.isFinite(e[k])||e[k]<0))fail('成绩必须是非负数字');}
    if(s.id&&!/^[a-zA-Z0-9_-]{1,80}$/.test(s.id))fail('学生编号无效');s.id||=randomUUID();return send(res,200,saveStudent(s,actor,body.expectedRevision));
   }
   if(path==='/api/student-text'&&req.method==='POST')return send(res,200,parseStudentText(String(body.text||'').slice(0,20000)));
   if(path==='/api/match'&&req.method==='POST'){
    const student=getStudent(body.studentId);if(!student)fail('学生不存在',404);const programs=getPrograms(),results=matchAll(student,programs,{simulation:Boolean(body.simulation)}),id=randomUUID();const snapshot={id,student,programs,results,actor,createdAt:now(),simulation:Boolean(body.simulation)};db.prepare('INSERT INTO matches VALUES(?,?,?,?,?)').run(id,student.id,JSON.stringify(snapshot),actor,snapshot.createdAt);event('match',student.name,actor,{matchId:id});return send(res,200,snapshot);
   }
   if(path==='/api/matches'&&req.method==='GET'){const id=url.searchParams.get('studentId');return send(res,200,db.prepare('SELECT id,student_id,data,actor,created_at FROM matches ORDER BY created_at DESC LIMIT 200').all().filter(r=>!id||r.student_id===id).map(r=>{const d=JSON.parse(r.data);return {id:r.id,studentId:r.student_id,name:d.student.name,actor:r.actor,createdAt:r.created_at,counts:Object.fromEntries(['pass','conditional','unknown','fail'].map(s=>[s,d.results.filter(x=>x.state===s).length])),simulation:d.simulation};}));}
   if(path.startsWith('/api/matches/')&&req.method==='GET'){const row=db.prepare('SELECT data FROM matches WHERE id=?').get(path.split('/').pop());if(!row)fail('匹配记录不存在',404);return send(res,200,JSON.parse(row.data));}
   if(path==='/api/combination'&&req.method==='POST')return send(res,200,checkCombination(body.selections||[],getPrograms()));
   if(path==='/api/query/interpret'&&req.method==='POST'){const t=String(body.text||'').slice(0,2000);return send(res,200,await interpretQuery(t,parseQuery(t)));}
   if(path==='/api/query'&&req.method==='POST'){if(body.query?.clarification)fail('请先澄清查询条件');if(body.query?.unsupported?.length)return send(res,200,{query:body.query,matched:[],uncertain:[],unsupported:body.query.unsupported,coverage:'当前只覆盖立命馆大学5个项目的已收录申请要求'});return send(res,200,queryPrograms(body.query||{},getPrograms()));}
   if(path==='/api/programs'&&req.method==='POST'){
    const errors=validateProgram(body.program);if(errors.length)fail(errors.join('；'));if(typeof body.note!=='string'||body.note.trim().length<3)fail('请填写修改依据（至少3字）');if(!/^[A-Za-z0-9_-]{2,30}$/.test(body.program.id))fail('项目编号须为字母数字或短横线');return send(res,200,saveProgram(body.program,actor,body.note.trim(),body.expectedVersion));
   }
   if(path==='/api/versions'&&req.method==='GET')return send(res,200,db.prepare('SELECT * FROM versions ORDER BY created_at DESC,version DESC').all().filter(r=>!url.searchParams.get('programId')||r.program_id===url.searchParams.get('programId')).map(r=>({...r,data:JSON.parse(r.data)})));
   if(path==='/api/restore'&&req.method==='POST'){
    const row=db.prepare('SELECT * FROM versions WHERE program_id=? AND version=?').get(body.programId,body.version);if(!row)fail('历史版本不存在',404);const p=JSON.parse(row.data);const errors=validateProgram(p);if(errors.length)fail(errors.join('；'));return send(res,200,saveProgram(p,actor,`回档到v${body.version}：${String(body.note||'恢复已核对版本')}`,body.expectedVersion,body.version));
   }
   if(path==='/api/events'&&req.method==='GET')return send(res,200,db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 200').all().map(r=>({...r,detail:JSON.parse(r.detail)})));
   if(path==='/api/documents'&&req.method==='POST'){
    if(!/\.(pdf|md|txt)$/i.test(body.filename||''))fail('支持PDF、Markdown和TXT');if(typeof body.base64!=='string')fail('未收到文件');const file=Buffer.from(body.base64,'base64');if(file.length>25*1024*1024)fail('文件最大25MB',413);if(extname(body.filename).toLowerCase()==='.pdf'&&!file.subarray(0,1024).includes(Buffer.from('%PDF-')))fail('文件不是有效PDF');
    const id=randomUUID(),storageName=id+extname(body.filename).toLowerCase();await mkdir(join(dataDir,'uploads'),{recursive:true});await writeFile(join(dataDir,'uploads',storageName),file);const doc={id,filename:body.filename.slice(0,200),name:body.filename.slice(0,200),storageName,uploadedBy:actor,uploadedAt:now(),status:'uploaded',size:file.length};saveDocument(doc);event('document',doc.filename,actor,{action:'上传'});return send(res,201,doc);
   }
   if(path.startsWith('/api/documents/')&&path.endsWith('/parse')&&req.method==='POST'){const id=path.split('/')[3],doc=getDocuments().find(d=>d.id===id);if(!doc||doc.builtin)fail('请选择上传文件');if(isIngestBusy())fail('已有文件正在解析，请稍后重试',409);parseDocument(doc,actor).catch(()=>{});return send(res,202,{ok:true});}
   if(path.startsWith('/api/documents/')&&req.method==='GET'){const doc=getDocuments().find(d=>d.id===path.split('/').pop());if(!doc)fail('资料不存在',404);return send(res,200,doc);}
   if(path==='/api/export'&&req.method==='GET')return send(res,200,{exportedAt:now(),programs:getPrograms(),students:listStudents(),versions:db.prepare('SELECT * FROM versions').all(),matches:db.prepare('SELECT * FROM matches').all(),events:db.prepare('SELECT * FROM events').all()},{'Content-Disposition':'attachment; filename="sgu-backup.json"'});
   fail('接口不存在',404);
  }
  if(!['GET','HEAD'].includes(req.method))fail('请求方法不支持',405);
  if(path.startsWith('/sources/')&&!user)fail('请先登录',401);
  if(path.startsWith('/uploads/')){if(!user)fail('请先登录',401);const doc=getDocuments().find(d=>d.id===path.split('/')[2]);if(!doc||doc.builtin)fail('文件不存在',404);const content=await readFile(join(dataDir,'uploads',doc.storageName));res.writeHead(200,{'Content-Type':mime[extname(doc.filename).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});return res.end(content);}
  const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(root+sep))fail('路径无效',403);const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){send(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:e.code==='ENOENT'?'文件不存在':'服务处理失败，请检查服务器日志',current:e.current});if(!e.status&&e.code!=='ENOENT')console.error(e);}
});
server.listen(port,host,()=>console.log(`SGU 工作台已启动: http://${host}:${port}`));
process.on('SIGINT',()=>server.close(()=>{db.close();process.exit(0);}));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
