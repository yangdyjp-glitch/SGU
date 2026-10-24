import { createHash } from 'node:crypto';
import { normalizeSchool } from '../public/document-review.js';

const text=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export const programIdentity=p=>[normalizeSchool(p.school),p.year,text(p.englishName||p.name),text(p.channel)].join('|');
const identityFields=p=>Object.fromEntries(['school','year','name','englishName','channel'].map(key=>[key,p[key]]));
function entryType(p){
 const channel=String(p.channel||'').normalize('NFKC');
 if(/三年级.*编入|third[ -]?year.*transfer/i.test(channel))return 'transfer-3';
 if(/二年级.*编入|second[ -]?year.*transfer/i.test(channel))return 'transfer-2';
 if(/编入|transfer/i.test(channel))return 'transfer';
 if(/一年级|first[ -]?year/i.test(channel))return 'first-year';
 return '';
}
function channelKey(value){
 const key=text(value).replaceAll('申请人','申请者').replaceAll('一般入试','一般入学申请');
 // Only these complete labels are aliases. Other selection methods, terms and
 // applicant categories remain distinct and require an explicit review choice.
 if(['一年级入学材料审查','一年级入学firstyearentry','firstyearentry'].includes(key))return 'first-year-documents';
 if(['三年级编入材料审查','三年级编入thirdyeartransferentry','thirdyeartransferentry'].includes(key))return 'third-year-transfer-documents';
 return key;
}
export function findProgramAssociation(proposed,programs){
 const type=entryType(proposed);
 const sameName=p=>text(p.englishName||p.name)===text(proposed.englishName||proposed.name);
 const candidates=programs.filter(p=>!p.mergedInto&&normalizeSchool(p.school)===normalizeSchool(proposed.school)&&p.year===proposed.year
  &&(sameName(p)||Boolean(text(proposed.name)&&text(p.name)===text(proposed.name)))
  &&(!type||!entryType(p)||type===entryType(p)));
 const exact=candidates.filter(p=>sameName(p)&&channelKey(p.channel)===channelKey(proposed.channel));
 const target=exact.length===1?exact[0]:null;
 return {target,candidates,state:target?'matched':candidates.length?'possible':'new',reason:target?(text(target.channel)===text(proposed.channel)?'学校、入学年份、项目和招生类别相同':'学校、入学年份和项目相同；招生类别仅表述不同'):candidates.length?'发现同校、同年份的同名项目，请核对招生类别后选择归属':''};
}
const ruleFields=['paths','language','waivers','rounds','materials','hardConditions','requirements','languagePolicy','graduationPolicy','academicTests','interview','tuition','combination'];
const strip=value=>JSON.stringify(value,(key,v)=>['source','sourceIds','page','evidence','id','project'].includes(key)?undefined:v);
export function bindReviewEntry(entry,index,doc,programs){
 const next=structuredClone(entry),p=next.program;
 next.proposedIdentity||=identityFields(p);
 next.draftProgramId||=entry.mode==='create'&&p.id?p.id:'AI-'+createHash('sha256').update(doc.id+':'+index+':'+programIdentity(next.proposedIdentity)).digest('hex').slice(0,18);
 const found=findProgramAssociation(next.proposedIdentity,programs),choice=next.associationChoice;
 let target=found.target,state=found.state;
 if(choice?.targetId){
  target=found.candidates.find(p=>p.id===choice.targetId||p.mergedProgramIds?.includes(choice.targetId))||null;
  state=target?'matched':'possible';
 }else if(choice?.independentReason&&found.state!=='matched'){target=null;state='new';}
 next.association={state,reason:choice?.targetId&&target?'已核对并选择更新现有项目':found.reason,
  targetId:target?.id||null,candidates:found.candidates.map(p=>({...identityFields(p),id:p.id,version:p.version,code:p.code})),
  ...(choice?.independentReason&&state==='new'?{independentReason:choice.independentReason}:{})};
 next.issues=next.issues.filter(i=>i.kind!=='change'&&i.path!=='/association');
 next.changes=[];
 if(state==='possible')next.issues.push({path:'/association',kind:'blocking',reason:'请先核对本项目与已有项目的关系，选择更新对象或说明为何是独立项目。'});
 if(target){
  p.id=target.id;p.code=target.code||target.id;p.version=target.version;
  p.sourceIds=[...new Set([...(target.sourceIds||[]),...(p.sourceIds||[]),doc.id])];
  for(const key of ruleFields)if(strip(target[key])!==strip(p[key])){
   next.changes.push({field:key,before:target[key]??null,after:p[key]});
   next.issues.push({path:'/'+key,reason:'与已入库版本不同，请核对本次更新',source:null,kind:'change'});
  }
 }else {p.id=next.draftProgramId;p.version=0;}
 next.mode=target?'update':'create';next.expectedVersion=target?.version||0;
 if(doc.autoReview?.kind==='supplement'&&target&&!next.issues.some(i=>i.path==='/coverage'&&i.kind==='blocking'))next.issues.push({path:'/coverage',kind:'blocking',reason:'本文件是补充通知，不能直接替换已有完整规则；请先补充完整手册或更正整理范围'});
 return next;
}
export function refreshReviewAssociations(doc,programs){
 if(doc.status!=='review'||!doc.autoReview)return null;
 const entries=doc.autoReview.entries.map((entry,i)=>bindReviewEntry(entry,i,doc,programs));
 if(JSON.stringify(entries)===JSON.stringify(doc.autoReview.entries))return null;
 return {...doc.autoReview,entries,version:doc.autoReview.version+1,associationVersion:1};
}
