import {majorDefinitions as definitions,majorPhrases,majorTextKey,nonAcademicMajorText} from './major-vocabulary.js';

export const majorCatalog = definitions.map(([label]) => label);
export const unspecifiedMajor = '__unspecified__';
const aliases = new Map(definitions.flatMap(([label,,names]) => [label,...names].map(name=>[majorTextKey(name).toLowerCase(),label])));
export function normalizeMajors(values) {
 if(!Array.isArray(values))return [];
 return [...new Set(values.filter(v=>typeof v==='string').map(v=>v.normalize('NFKC').trim()).filter(Boolean).map(v=>aliases.get(majorTextKey(v).toLowerCase())||v))];
}
const engineeringFields=new Set(['计算机与信息科学','数据科学与人工智能','机械与汽车工程','电气电子与通信工程','土木工程','建筑学','化学','材料科学','生物与生命科学','生物医学工程']);
function ordered(found){
 if(found.has('综合工学')&&[...found].some(v=>engineeringFields.has(v)))found.delete('综合工学');
 return majorCatalog.filter(v=>found.has(v));
}
export function majorsFromText(value) {
 const text=majorTextKey(value).replace(nonAcademicMajorText,m=>' '.repeat(m.length));
 const exact=aliases.get(text.trim().toLowerCase());if(exact)return [exact];
 const candidates=[];
 const collect=(pattern,labels,priority)=>{for(const m of text.matchAll(new RegExp(pattern.source,'giu')))candidates.push({start:m.index,end:m.index+m[0].length,labels:typeof labels==='function'?labels(m[0]):labels,priority});};
 for(const [pattern,labels] of majorPhrases)collect(pattern,labels,1);
 for(const [label,pattern] of definitions)collect(pattern,[label],0);
 for(const label of majorCatalog){let start=text.indexOf(label);while(start!==-1){candidates.push({start,end:start+label.length,labels:[label],priority:1});start=text.indexOf(label,start+label.length);}}
 candidates.sort((a,b)=>b.priority-a.priority||(b.end-b.start)-(a.end-a.start)||a.start-b.start);
 const used=[],found=new Set();
 for(const item of candidates){if(used.some(v=>item.start<v.end&&item.end>v.start))continue;used.push(item);item.labels.forEach(v=>found.add(v));}
 return ordered(found);
}
function specificDepartment(value){
 const text=majorTextKey(value);
 for(const unit of ['Division','Department']){
  const match=text.match(new RegExp('\\b'+unit+' of\\s+(.+?)(?=,\\s*(?:Faculty|School|College|Department|Division)\\b|[;—]|$)','i'));
  if(match)return match[1];
 }
 return null;
}
function directionScope(value){
 return majorTextKey(value).replace(/^[^;；:：、]*?学群(?=[^;；]*?(?:学类|学科|\/))[:：]?/,'').replace(/^[^;；、]*?学科(?=[^;；、]*课程)/,'');
}
export function getProgramMajors(program={}) {
 // Reviewed values and explicit empty lists stay authoritative. Inferred labels
 // are projections, so a vocabulary correction also repairs an old projection.
 if(Object.hasOwn(program,'majors')&&program.majorsInferred!==true)return normalizeMajors(program.majors);
 if(Object.hasOwn(program,'majors')&&Array.isArray(program.majors)&&!program.majors.length)return [];
 const direction=directionScope(program.direction),legacyGroup=['人文与综合','社会与政策','计算机与工程'].includes(direction);
 const found=new Set(legacyGroup?[]:majorsFromText(direction)),department=specificDepartment(program.englishName);
 if(found.size&&/学科[^;；、]*课程/.test(majorTextKey(program.direction)))return ordered(found);
 if(department!==null){
  if(!/学科[^;；、]*课程/.test(majorTextKey(program.direction)))majorsFromText(department).forEach(v=>found.add(v));
  if(found.size)return ordered(found);
  // Do not fall back to an unrelated parent faculty when a department is named.
  return majorsFromText(majorTextKey(program.name).replace(/^.*(?:学院|学部|学群|文学部)[・:：·]?/,''));
 }
 if(found.size===1&&found.has('商学与管理')&&/\b(?:hospitality|tourism)\b/i.test(program.englishName||''))return ['旅游与酒店管理'];
 const english=String(program.englishName||'');
 if(!/\b(?:faculty|school|college) of\b/i.test(english))majorsFromText(english).forEach(v=>found.add(v));
 if(found.size)return ordered(found);
 const fromEnglish=majorsFromText(english);
 return fromEnglish.length?fromEnglish:majorsFromText(program.name);
}
export function majorsAreInferred(program={}) {
 return Boolean((!Object.hasOwn(program,'majors')||program.majorsInferred===true)&&getProgramMajors(program).length);
}
export function presentProgramMajors(program) {
 return {...program,majors:getProgramMajors(program),majorsInferred:majorsAreInferred(program)};
}
export function matchesMajors(program,selected=[]) {
 const filters=normalizeMajors(Array.isArray(selected)?selected:[selected]);
 if(!filters.length)return true;
 const majors=getProgramMajors(program);
 return filters.some(value=>value===unspecifiedMajor?!majors.length:majors.includes(value));
}
export function majorFilterOptions(programs) {
 const values=new Set(programs.flatMap(getProgramMajors));
 const known=majorCatalog.filter(v=>values.has(v));
 const custom=[...values].filter(v=>!majorCatalog.includes(v)).sort((a,b)=>a.localeCompare(b,'zh-CN'));
 return [...known,...custom,...(programs.some(p=>!getProgramMajors(p).length)?[unspecifiedMajor]:[])];
}
export function validateMajors(program) {
 if(!Object.hasOwn(program,'majors'))return [];
 if(!Array.isArray(program.majors)||program.majors.length>40||program.majors.some(v=>typeof v!=='string'||!v.trim()||v.length>80||v===unspecifiedMajor))return ['专业须为不超过40项的名称列表，每项1至80字；待确认请留空'];
 if(program.majorsInferred!==undefined&&typeof program.majorsInferred!=='boolean')return ['专业归类状态无效'];
 return [];
}
