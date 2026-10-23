import { saveDocument, event, transaction } from './store.mjs';
import { loadFile, saveFile, materializeFile } from './file-store.mjs';
import { localMineru } from './mineru.mjs';
import { cloudPDFEnabled, extractCloudPDF } from './cloud-pdf.mjs';
import { openAIConfig } from './openai-config.mjs';
import { suggestions } from './document-analysis.mjs';
export { suggestions } from './document-analysis.mjs';
let busy=false;
export const isIngestBusy=()=>busy;
export async function saveDocumentStatus(doc,status,actor,error=null){
 doc.status=status;doc.error=error;doc.statusVersion=(doc.statusVersion||0)+1;doc.statusUpdatedAt=new Date().toISOString();
 if(status==='parsing')doc.parseStartedAt=doc.statusUpdatedAt;
 const action=({queued:'已加入自动整理队列',parsing:'提取原文',extracting:'自动识别并整理规则',needs_configuration:'文件已保留，等待模型配置',review:doc.autoReview?'整理完成，待整体核对':'原文提取完成',error:'处理未完成'})[status]||status;
 await transaction(async()=>{await saveDocument(doc);await event('document',doc.filename,actor,{action,status,statusVersion:doc.statusVersion});});
}
export async function parseDocument(doc,actor){
 if(busy)throw Object.assign(new Error('已有文件正在解析，请稍后重试'),{status:409});busy=true;
 try{
  await saveDocumentStatus(doc,'parsing',actor);
  let text;
  if(/\.(md|txt)$/i.test(doc.filename))text=(await loadFile(doc.storageName)).toString('utf8');
  else if(cloudPDFEnabled()){
   const result=await extractCloudPDF(await materializeFile(doc.storageName),await openAIConfig(),{onProgress:async progress=>{
    doc.organizingProgress=progress;doc.statusVersion=(doc.statusVersion||0)+1;doc.statusUpdatedAt=new Date().toISOString();await transaction(()=>saveDocument(doc));
   }});
   text=result.text;doc.locator=result.locator;doc.extractionWarnings=result.warnings;doc.ocr=result.ocr;
   await saveFile(`${doc.id}.md`,Buffer.from(text,'utf8'));
  }else {
   const payload=await localMineru.parse(await materializeFile(doc.storageName));
   if(!payload.content||typeof payload.content.content!=='string')throw new Error('解析仍未完成，请稍后重试；不会自动使用不完整结果。');
   if(payload.content.truncated||payload.content.next_request)throw new Error('文档超过当前完整读取上限，请拆分文件后上传；未将截断内容标为完整结果。');
   text=payload.content.content;doc.locator={shortId:payload.content.short_id,tier:payload.content.tier,ranges:payload.content.content_ranges};await saveFile(`${doc.id}.md`,Buffer.from(text,'utf8'));
  }
  if(!text.trim())throw new Error('文件没有可读取的文字，请核对原文件');
  doc.text=text;doc.suggestions=suggestions(text,{pdf:/\.pdf$/i.test(doc.filename)});doc.parsedAt=new Date().toISOString();doc.organizingProgress=null;await saveDocumentStatus(doc,'extracting',actor);
 }catch(e){if(e.retryable)throw e;await saveDocumentStatus(doc,e.code==='configuration_required'?'needs_configuration':'error',actor,e.message);}finally{busy=false;}
}
