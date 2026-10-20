import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { dataDir, saveDocument, event } from './store.mjs';
let busy=false;
export const isIngestBusy=()=>busy;
export function suggestions(text){
 const keys=[['年龄',/age|18 years|年龄/i],['国籍及签证',/citizen|nationality|visa|resident|国籍|签证/i],['多项目及多轮申请',/multiple|reappl|复用|并申/i],['学费',/tuition|学费/i],['其他证明材料',/passport|photo|award|financ|certificate|证明/i],['语言成绩',/TOEFL|IELTS|PTE|Duolingo|TOEIC/i],['学历路径',/diploma|A.Level|12.year|资格/i]];
 return text.split(/\r?\n/).map((t,i)=>({line:i+1,text:t.trim()})).filter(x=>x.text.length>12).map(x=>({...x,fields:keys.filter(([,rx])=>rx.test(x.text)).map(([k])=>k)})).filter(x=>x.fields.length).slice(0,100);
}
export async function parseDocument(doc,actor){
 if(busy)throw Object.assign(new Error('已有文件正在解析，请稍后重试'),{status:409});busy=true;
 doc.status='parsing';doc.error=null;saveDocument(doc);
 try{
  let text;
  if(/\.(md|txt)$/i.test(doc.filename))text=await readFile(join(dataDir,'uploads',doc.storageName),'utf8');
  else {
   if(!process.env.MINERU_BIN)throw new Error('本机MinerU路径尚未配置。请在.env中设置MINERU_BIN和MINERU_HOME，重启后重试。');
   const output=join(dataDir,'uploads',`${doc.id}.md`);
   const payload=await new Promise((resolve,reject)=>{
    const env={...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'};if(process.env.MINERU_BIN_DIR)env.PATH=process.env.MINERU_BIN_DIR+delimiter+(process.env.PATH||'');
    const child=spawn(process.env.MINERU_BIN,['parse',join(dataDir,'uploads',doc.storageName),'--pages','all','--tier','standard','--wait','180','--limit','1000000','--json'],{windowsHide:true,env,shell:false});let stderr='',stdout='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('解析超过10分钟，可检查本机MinerU服务后重试。'));},600000);
    child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>12*1024*1024){child.kill();reject(new Error('提取内容超过当前处理上限，请拆分文件后上传。'));}});child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-3000);});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);let result;try{result=JSON.parse(stdout);}catch{reject(new Error('MinerU没有返回有效的结构化结果，请检查本机服务。'));return;}if(result.error){reject(new Error(`MinerU ${result.error.code}：${result.error.user_action||result.error.message||'请检查解析服务。'}`));return;}code===0?resolve(result):reject(new Error(`MinerU解析未完成（退出码${code}），请检查本机服务。`));});
   });
   if(!payload.content||typeof payload.content.content!=='string')throw new Error('解析仍未完成，请稍后重试；不会自动使用不完整结果。');
   if(payload.content.truncated||payload.content.next_request)throw new Error('文档超过当前完整读取上限，请拆分文件后上传；未将截断内容标为完整结果。');
   text=payload.content.content;doc.locator={shortId:payload.content.short_id,tier:payload.content.tier,ranges:payload.content.content_ranges};await writeFile(output,text,'utf8');
  }
  doc.status='review';doc.text=text.slice(0,750000);doc.suggestions=suggestions(text);doc.parsedAt=new Date().toISOString();event('document',doc.filename,actor,{action:'已提取，等待员工核对'});
 }catch(e){doc.status='error';doc.error=e.message;}finally{saveDocument(doc);busy=false;}
}
