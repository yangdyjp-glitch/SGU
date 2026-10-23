import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDir, saveDocument, event, transaction } from './store.mjs';
import { localMineru } from './mineru.mjs';
import { suggestions } from './document-analysis.mjs';
export { suggestions } from './document-analysis.mjs';
let busy=false;
export const isIngestBusy=()=>busy;
export function saveDocumentStatus(doc,status,actor,error=null){
 doc.status=status;doc.error=error;doc.statusVersion=(doc.statusVersion||0)+1;doc.statusUpdatedAt=new Date().toISOString();
 if(status==='parsing')doc.parseStartedAt=doc.statusUpdatedAt;
 const action=({queued:'已加入自动整理队列',parsing:'提取原文',extracting:'自动识别并整理规则',needs_configuration:'原文已保留，等待模型配置',review:doc.autoReview?'整理完成，待整体核对':'原文提取完成',error:'处理未完成'})[status]||status;
 transaction(()=>{saveDocument(doc);event('document',doc.filename,actor,{action,status,statusVersion:doc.statusVersion});});
}
export async function parseDocument(doc,actor){
 if(busy)throw Object.assign(new Error('已有文件正在解析，请稍后重试'),{status:409});busy=true;
 try{
  saveDocumentStatus(doc,'parsing',actor);
  let text;
  if(/\.(md|txt)$/i.test(doc.filename))text=await readFile(join(dataDir,'uploads',doc.storageName),'utf8');
  else {
   const output=join(dataDir,'uploads',`${doc.id}.md`);
   const payload=await localMineru.parse(join(dataDir,'uploads',doc.storageName));
   if(!payload.content||typeof payload.content.content!=='string')throw new Error('解析仍未完成，请稍后重试；不会自动使用不完整结果。');
   if(payload.content.truncated||payload.content.next_request)throw new Error('文档超过当前完整读取上限，请拆分文件后上传；未将截断内容标为完整结果。');
   text=payload.content.content;doc.locator={shortId:payload.content.short_id,tier:payload.content.tier,ranges:payload.content.content_ranges};await writeFile(output,text,'utf8');
  }
  if(!text.trim())throw new Error('文件没有可读取的文字，请核对原文件');
  doc.text=text;doc.suggestions=suggestions(text,{pdf:/\.pdf$/i.test(doc.filename)});doc.parsedAt=new Date().toISOString();saveDocumentStatus(doc,'extracting',actor);
 }catch(e){saveDocumentStatus(doc,'error',actor,e.message);}finally{busy=false;}
}
