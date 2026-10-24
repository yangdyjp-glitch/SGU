import { createHash } from 'node:crypto';
import { normalizeSchool } from '../public/document-review.js';
import { validDate, validateProgram } from './engine.mjs';
import { validityAnchor } from './imported-program.mjs';
import { schemaFields } from './document-schema.mjs';
import { findProgramAssociation, bindReviewEntry } from './program-association.mjs';

const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\\([\\`*_{}[\]()#+\-.!>|])/g,'$1').replace(/[\s|#*`“”"'‘’]/g,'');
const knownFields=new Set(['standard12','international12','accreditation','japanDesignated12','qualification','designated11','shortSchool','preparatory','equivalency','japanEquivalency','individualReview','educationStatus','graduationDate','ageAtEnrollment','nationalities','inJapanResident','japanVocationalOnly','australianDomestic','waiver.sixYears','waiver.ibEnglish','waiver.groupACitizen','waiver.groupAEducation','waiver.jdpFourYears','waiver.noESL']);
const identity=p=>[normalizeSchool(p.school),p.year,normalize(p.englishName||p.name),normalize(p.channel)].join('|');
export function quotedEvidenceMatches(quote,content){
 const normalized=normalize(quote);
 if(!normalized)return false;
 if(content.includes(normalized))return true;
 const fragments=String(quote).split(/\s*[;；]\s*|\.{3,}|…+/).map(normalize).filter(Boolean);
 return fragments.length>1&&fragments.some(fragment=>fragment.length>=16)&&fragments.every(fragment=>content.includes(fragment));
}
export function buildDocumentReview(extracted,doc,programs,metadata={}){
 const original=normalize(doc.text.replace(/<[^>]+>/g,' '));
 const pageNumbers=[...doc.text.matchAll(/<!--\s*page\s+(\d+)\s+of\s+\d+\s*-->/gi)].map(m=>Number(m[1]));
 const maxPage=Math.max(0,...pageNumbers);
 const pageText=new Map([...doc.text.matchAll(/<!--\s*page\s+(\d+)\s+of\s+\d+\s*-->([\s\S]*?)(?=<!--\s*page\s+\d+\s+of\s+\d+\s*-->|$)/gi)].map(m=>[Number(m[1]),normalize(m[2].replace(/<[^>]+>/g,' '))]));
 const entries=extracted.programs.map((raw,index)=>{
  const p=structuredClone(raw),issues=raw.doubts.map(d=>({...d,source:{...d.source,sourceId:doc.id},kind:'uncertain'}));delete p.doubts;
  const issue=(path,reason,source=null,kind='uncertain')=>{if(!issues.some(i=>i.path===path&&i.reason===reason))issues.push({path,reason,source,kind});};
  p.school=normalizeSchool(p.school);
  const {target:existing}=findProgramAssociation(p,programs);
  p.id=existing?.id||'AI-'+createHash('sha256').update(doc.id+':'+index+':'+identity(p)).digest('hex').slice(0,18);
  p.code=existing?.code||existing?.id||(p.englishName.match(/[A-Za-z]+/g)||[]).filter(word=>!['of','and','the','in','for'].includes(word.toLowerCase())).map(word=>word[0].toUpperCase()).join('').slice(0,10)||'项目';
  p.version=existing?.version||0;p.reviewed=false;p.reviewNote='';p.semanticVersion=1;p.sourceIds=[...new Set([...(existing?.sourceIds||[]),doc.id])];
  for(const key of ['school','name','channel'])if(!p[key]?.trim())issue('/'+key,'缺少'+({school:'学校名称',name:'项目名称',channel:'招生通道'})[key]+'，请填写更正意见后重新整理',null,'blocking');
  if(!Number.isInteger(p.year)||p.year<2000||p.year>2100)issue('/year','入学年份未确定，请填写更正意见后重新整理',null,'blocking');
  function visit(value,path=''){
   if(!value||typeof value!=='object')return;
   if(Array.isArray(value)){value.forEach((item,i)=>visit(item,path+'/'+i));return;}
   if(value.source){
    value.source.sourceId=doc.id;
    const quote=value.source.quote,found=quotedEvidenceMatches(quote,original);
    if(quote&&!found)issue(path,'该条原文引用未能在提取文本中完整定位，请核对原文件',value.source);
    const matches=found?[...pageText].filter(([,text])=>quotedEvidenceMatches(quote,text)).map(([page])=>page):[];
    if(!value.source.page&&matches.length===1)value.source.page=String(matches[0]);
    if(value.source.page){const pages=String(value.source.page).match(/\d+/g)?.map(Number)||[];if(!maxPage||!pages.length||pages.some(page=>page<1||page>maxPage)){if(/\.pdf$/i.test(doc.filename))issue(path,'来源页码未能核实，请打开原文件定位',value.source);value.source.page=null;}else if(found&&!quotedEvidenceMatches(quote,pages.map(page=>pageText.get(page)||'').join(''))){if(matches.length===1)value.source.page=String(matches[0]);else{issue(path,'引用内容与标注页码未能对应，请核对原文件',value.source);value.source.page=null;}}}
    else if(found&&/\.pdf$/i.test(doc.filename))issue(path,'原文页码待确认',value.source);
   }
   if(value.field){
    if(!knownFields.has(value.field)){const custom=value.field.startsWith('verification.');value.field='verification.'+value.field.replace(/^verification\./,'').replace(/[^a-zA-Z0-9_]/g,'_');if(!custom)issue(path,'此条件已完整保留，学生匹配时需要核实相关事实',value.source);}
    if(value.value===null||value.state==='unspecified'){value.state='unspecified';issue(path,'此条件的具体取值未确定',value.source);}
   }
   for(const [key,child] of Object.entries(value))if(key!=='source')visit(child,path+'/'+key);
  }
  visit(p);
  for(const key of ['paths','waivers','language','rounds','materials','requirements']){
   const used=new Set();p[key].forEach((row,i)=>{if(!row.id||/[\s:]/.test(row.id)||used.has(row.id))row.id=key+'-'+(i+1);while(used.has(row.id))row.id+='-x';used.add(row.id);});
  }
  for(const [i,round] of p.rounds.entries()){
   for(const key of ['applyStart','applyEnd','enrollmentDate','final'])if(round[key]&&!validDate(round[key])){round.note+=' '+key+': '+round[key];round[key]=null;issue('/rounds/'+i+'/'+key,'日期没有转换为明确年月日，已保留原文说明',round.source);}
   for(const key of ['applyStart','applyEnd','enrollmentDate'])if(!round[key])issue('/rounds/'+i+'/'+key,'本轮'+({applyStart:'申请开始日期',applyEnd:'申请截止日期',enrollmentDate:'入学日期'})[key]+'待确定',round.source);
   if(round.applyStart&&round.applyEnd&&round.applyStart>round.applyEnd)issue('/rounds/'+i,'申请开始时间晚于截止时间，请更正后入库',round.source,'blocking');
   if(round.intake&&!/^20\d{2}-(0[1-9]|1[0-2])$/.test(round.intake)){round.note+=' 入学期：'+round.intake;round.intake=null;issue('/rounds/'+i+'/intake','入学月份待核实',round.source);}
  }
  if(!p.paths.length)issue('/paths','未找到可完整整理的学历资格路径；学生匹配将保留待核实');
  if(!p.rounds.length)issue('/rounds','文件未列出可确定的申请轮次，入库后可查阅要求，但暂不产生轮次匹配');
  if(p.languageRequirement==='unspecified')issue('/languageRequirement','是否必须提交英语能力证明未确定',p.languagePolicy.source);
  if(p.languageRequirement!=='not-required'&&!p.languagePolicy.validYears&&!p.languagePolicy.validAfter&&!p.languagePolicy.validUntil)issue('/languagePolicy','成绩有效期未确定，匹配时不会擅自套用两年有效期',p.languagePolicy.source);
  if(p.languagePolicy.validYears&&!p.languagePolicy.validAfter&&!validityAnchor(p.languagePolicy))issue('/languagePolicy','有效年限的起算节点未确定，匹配时保留待核实',p.languagePolicy.source);
  p.language.forEach((row,i)=>{if(row.score===null&&row.minimumStatus!=='no-minimum')issue('/language/'+i+'/score',row.exam+'最低分未确定',row.source);
   const numbers=(row.source.quote.match(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g)||[]).map(n=>Number(n.replaceAll(',','')));
   for(const key of ['score','reading','listening','writing','speaking'])if(typeof row[key]==='number'&&!numbers.includes(row[key]))issue('/language/'+i+'/'+key,'该分数未在对应短引中找到，请对照完整表格核实',row.source);
  });
  p.requirements=p.requirements.map(r=>({...r,scope:p.name,page:r.source.page,evidence:r.source.quote}));
  p.tuition.year=p.year;
  if(p.tuition.status==='published'&&p.tuition.amount===null)issue('/tuition','已保留完整收费说明，未归为统一金额；请核对适用类别，预算筛选将保留待核实',p.tuition.source);
  const changes=[];
  if(existing)for(const key of ['paths','language','waivers','rounds','materials','hardConditions','requirements','languagePolicy','graduationPolicy','academicTests','interview','tuition','combination']){
   const before=existing[key],after=p[key];
   const strip=value=>JSON.stringify(value,(key,v)=>['source','sourceIds','page','evidence','id','project'].includes(key)?undefined:v);
   if(strip(before)!==strip(after)){changes.push({field:key,before:before??null,after});issue('/'+key,'与已入库版本不同，请核对本次更新',null,'change');}
  }
  if(extracted.kind==='supplement'&&existing)issue('/coverage','本文件是补充通知，不能直接替换已有完整规则；请先补充完整手册或更正整理范围',null,'blocking');
  for(const error of validateProgram(p))issue(/学费/.test(error)?'/tuition':'/coverage',error+'，请补充核对意见后重新整理',null,'blocking');
  return bindReviewEntry({program:p,mode:existing?'update':'create',expectedVersion:existing?.version||0,issues,changes,modelDoubts:structuredClone(raw.doubts)},index,{...doc,autoReview:{...doc.autoReview,kind:extracted.kind}},programs);
 });
 const doubts=extracted.doubts.map(d=>({...d,source:{...d.source,sourceId:doc.id}}));
 for(const warning of doc.extractionWarnings||[]){
  const reason=`第${warning.page}页识别疑点：${warning.reason}`;
  if(!doubts.some(d=>d.reason===reason))doubts.push({path:'',reason,source:{sourceId:doc.id,page:warning.page,quote:warning.quote}});
 }
 return {version:(doc.autoReview?.version||0)+1,validationVersion:3,kind:extracted.kind,summary:extracted.summary,entries,doubts,createdAt:new Date().toISOString(),...metadata};
}

// Refresh validation only, without a new model call or changing confirmed rules.
// Old reviews predate modelDoubts; remove only our own known diagnostic wording.
export function refreshReviewValidation(doc,programs){
 const review=doc.autoReview;
 if(doc.status!=='review'||!review||review.validationVersion===3)return null;
 const generated=reason=>/^(该条原文引用未能在提取文本中完整定位|引用内容与标注页码未能对应|来源页码未能核实|原文页码待确认|此条件已完整保留，学生匹配时需要核实相关事实|此条件的具体取值未确定|日期没有转换为明确年月日|本轮(?:申请开始日期|申请截止日期|入学日期)待确定|申请开始时间晚于截止时间，请更正后入库|入学月份待核实|未找到可完整整理的学历资格路径|文件未列出可确定的申请轮次|是否必须提交英语能力证明未确定|成绩有效期未确定，匹配时不会擅自套用两年有效期|该分数未在对应短引中找到|与已入库版本不同，请核对本次更新|本文件是补充通知，不能直接替换已有完整规则)/.test(reason)||/最低分未确定$|，请补充核对意见后重新整理$/.test(reason);
 const extracted={kind:review.kind,summary:review.summary,doubts:review.doubts,programs:review.entries.map(entry=>schemaFields({...entry.program,doubts:entry.modelDoubts||entry.issues.filter(issue=>!generated(issue.reason))}))};
 return buildDocumentReview(extracted,doc,programs,{model:review.model,usage:review.usage});
}
