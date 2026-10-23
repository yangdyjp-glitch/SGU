import { validateImportedProgram, importedGraduationCheck, importedLanguageAttempt } from './imported-program.mjs';
import { educationFacts, evaluateEducationAtom, evaluateEducationPaths, generalEligibility } from './education.mjs';
import { educationReviewContext, isEducationVerification } from '../public/education-model.js';
export const labels={pass:'符合已收录申请条件',conditional:'满足指定条件后可申请',unknown:'待核实候选',fail:'当前不满足'};
export const tri = (v)=>v===true?'pass':v===false?'fail':'unknown';
export const allState = xs=>xs.includes('fail')?'fail':xs.includes('unknown')?'unknown':xs.includes('conditional')?'conditional':'pass';
export const anyState = xs=>xs.includes('pass')?'pass':xs.includes('conditional')?'conditional':xs.includes('unknown')||!xs.length?'unknown':'fail';
export function valueAt(object,path){return path.split('.').reduce((a,k)=>a?.[k],object);}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export function ageAt(birth,date){if(!validDate(birth)||!validDate(date))return null;const [y,m,d]=date.split('-').map(Number),[by,bm,bd]=birth.split('-').map(Number);return y-by-(m<bm||m===bm&&d<bd?1:0);}
export function evaluateAtom(rule,facts){
 const actual=rule.field==='ageAtEnrollment'&&rule.referenceDate?ageAt(facts.birthDate,rule.referenceDate):valueAt(facts,rule.field);let state='unknown';
 if(rule.state==='unspecified'||rule.value===null)return {...rule,state,actual,reason:'学校未注明，需核实'};
 if(actual!==undefined&&actual!==null&&actual!==''){
  if(rule.op==='eq')state=tri(actual===rule.value);
  else if(rule.op==='neq')state=tri(actual!==rule.value);
  else if(rule.op==='in'&&Array.isArray(rule.value))state=tri(rule.value.includes(actual));
  else if(rule.op==='gte')state=typeof actual==='number'&&typeof rule.value==='number'||validDate(actual)&&validDate(rule.value)?tri(actual>=rule.value):'unknown';
  else if(rule.op==='lte')state=typeof actual==='number'&&typeof rule.value==='number'||validDate(actual)&&validDate(rule.value)?tri(actual<=rule.value):'unknown';
  else if(rule.op==='contains')state=tri(Array.isArray(actual)&&actual.includes(rule.value));
 }
 return {...rule,state,actual,reason:state==='unknown'?'学生信息未填写':state==='pass'?'满足条件':'未达到条件'};
}
export function applicationWindow(round,now=new Date()){
 if(!validDate(round.applyStart)||!validDate(round.applyEnd)||round.timezone!==undefined&&!['Asia/Tokyo','JST','UTC+09:00','GMT+09:00'].includes(round.timezone)||round.startTime===null||round.endTime===null)return {status:'unknown',label:'申请时间待核实',start:null,end:null,timezone:round.timezone||null};
 const start=new Date(`${round.applyStart}T${round.startTime||'10:00'}:00+09:00`),end=new Date(`${round.applyEnd}T${round.endTime||'23:00'}:00+09:00`);
 return {status:now<start?'upcoming':now>end?'closed':'open',label:now<start?'尚未开放':now>end?'已截止':'正在开放',start:start.toISOString(),end:end.toISOString(),timezone:'JST'};
}
function languageAttempt(exam,program,round,simulation){
 if(program.semanticVersion===1)return importedLanguageAttempt(exam,program,round,simulation,{validDate,tri,allState});
 const source=program.languagePolicy.source;
 const out=(state,reason,checks=[])=>({id:exam.id,label:`${exam.exam} · ${exam.score??'未填分数'}`,state,reason,source,checks});
 if(exam.status==='target'&&!simulation)return out('unknown','目标成绩仅用于模拟，本次未采用');
 if(exam.status&&!['actual','target'].includes(exam.status))return out('unknown','语言预估成绩未获明确认可');
 if(program.languagePolicy.excludedFormats.includes(exam.format))return out('fail','该考试形式明确不接受');
 if(exam.superscore&&!program.languagePolicy.allowSuperscore)return out('fail','不接受跨次拼分');
 const forms=program.language.filter(l=>l.exam===exam.exam);
 if(!forms.length)return out('fail','不在本项目接受的语言考试列表中');
 if(!validDate(exam.date))return out('unknown','缺少考试日期，无法判断版本与有效期');
 if(!exam.format)return out('unknown','需确认考试形式');
 if(exam.exam==='TOEFL iBT'&&!['0–120','1–6'].includes(exam.scale))return out('unknown','需确认TOEFL计分版本');
 if(exam.exam==='TOEFL iBT'&&((exam.date<'2026-01-21'&&exam.scale!=='0–120')||(exam.date>='2026-01-21'&&exam.scale!=='1–6')))return out('fail','TOEFL考试日期与计分版本不一致，请核对录入');
 const min=new Date(round.applyEnd);min.setUTCFullYear(min.getUTCFullYear()-program.languagePolicy.validYears);
 if(new Date(exam.date)<min||exam.date>round.applyEnd)return out('fail',`考试须在${min.toISOString().slice(0,10)}至${round.applyEnd}之间参加`);
 if(program.languagePolicy.availabilityRequired&&!validDate(exam.availableDate))return out('unknown','需填写成绩可取得日期');
 if(exam.availableDate>round.applyEnd)return out('fail','成绩在本轮申请截止前不可取得');
 const threshold=forms.find(l=>exam.exam!=='TOEFL iBT'||l.scale===exam.scale);
 if(!threshold)return out('unknown','没有对应考试版本的门槛记录');
 const fields=[['score','总分／指定单项'],['reading','阅读'],['listening','听力'],['writing','写作'],['speaking','口语']];
 const checks=fields.filter(([key])=>typeof threshold[key]==='number').map(([key,label])=>({label:`${label} ≥ ${threshold[key]}`,state:exam[key]===null||exam[key]===undefined||exam[key]===''?'unknown':tri(Number(exam[key])>=threshold[key]),actual:exam[key],source:threshold.source}));
 const state=allState(checks.map(c=>c.state));return out(state,state==='pass'?'同一次考试满足总分及适用单项要求':state==='unknown'?'缺少必需的成绩信息':'未达到该考试门槛',checks);
}
export function matchProgram(student,program,round,{now=new Date(),simulation=false}={}){
 const dayBefore=validDate(round.enrollmentDate)?new Date(round.enrollmentDate):null;dayBefore?.setUTCDate(dayBefore.getUTCDate()-1);
 const facts={...educationFacts(student),ageAtEnrollment:ageAt(student.birthDate,program.semanticVersion===1?round.enrollmentDate:dayBefore?.toISOString().slice(0,10))};
 const completion=s=>{const state=!validDate(s.graduationDate)||!validDate(round.enrollmentDate)?'unknown':s.graduationDate>=round.enrollmentDate?'fail':s.educationStatus==='expected'?'conditional':s.educationStatus==='completed'?'pass':'unknown';return {label:`入学前取得资格（${round.enrollmentDate||'入学日待定'}前）`,state,reason:state==='unknown'?'需填写该资格取得状态及日期':state==='conditional'?`预计${s.graduationDate}取得，须入学前兑现`:state==='fail'?'资格取得日期晚于或等于入学日':'资格取得日期符合',source:program.semanticVersion===1?program.graduationPolicy?.source:{sourceId:'aohb27',page:5,ruleId:'R002'}};};
 const graduationCheck=s=>program.semanticVersion===1?importedGraduationCheck(s,program,round,{validDate,tri}):completion(s);
 const education=evaluateEducationPaths(student,program,round,{baseEvaluate:evaluateAtom,graduationCheck,ageAtEnrollment:facts.ageAtEnrollment});
 const paths=education.paths;
 const generalEducation=generalEligibility(student,program,round,completion);
 const academicAtom=r=>evaluateEducationAtom(r,facts,program,evaluateAtom);
 const attempts=(student.exams||[]).filter(e=>simulation||e.status!=='target').map(e=>languageAttempt(e,program,round,simulation));
 const waivers=program.waivers.map(w=>{const checks=w.all.map(r=>r.field==='qualification'?academicAtom(r):evaluateAtom(r,facts));return {id:w.id,label:w.label,checks,state:checks.length?allState(checks.map(c=>c.state)):'unknown',source:w.all[0]?.source};});
 const language={label:'英语证明（考试或豁免）',state:anyState([...attempts,...waivers].map(x=>x.state)),attempts,waivers};
 const hard=program.hardConditions.map(r=>r.field.startsWith('verification.')&&!isEducationVerification(r)?evaluateAtom(r,facts):academicAtom(r));
 if(program.semanticVersion===1){
  if(program.languageRequirement==='not-required')language.state='pass';
  else if(program.languageRequirement==='unspecified')language.state='unknown';
 }
 if(program.academicTests.status==='required'){const scope=student.projectEducation?.[program.id];const confirmed=student.educationVersion===2?scope?.version===program.version&&scope.context===educationReviewContext(student)&&Boolean(scope.evidence?.trim()):true;hard.push({label:'项目要求的学术标准化考试',state:tri(confirmed?student.academicTests?.[program.id]?.satisfied:null),reason:'须逐项目、按当前版本核对学术考试、科目及门槛，未填写不视为满足',source:program.academicTests.source});}
 if(program.academicTests.status==='unspecified')hard.push({label:'学术标准化考试要求',state:'unknown',reason:'学校要求未明确，需核实',source:program.academicTests.source});
 if(program.australianRestriction){
  const nonDomesticNationality=(student.nationalities||[]).some(n=>!['Australia','New Zealand','澳大利亚','新西兰'].includes(n));
  const domestic=student.australianDomestic??((student.nationalities||[]).some(n=>['Australia','澳大利亚'].includes(n))?true:null);
  hard.push({label:'GLA国籍及澳大利亚国内身份渠道',state:domestic===false?'pass':domestic===true?(nonDomesticNationality?'pass':student.nationalities?.length?'fail':'unknown'):'unknown',reason:domestic===true&&nonDomesticNationality?'适用其他国籍例外；须按国际学生身份在ANU就读':domestic===true?'澳大利亚国内身份原则上应经ANU申请':'须确认国籍及澳大利亚国内学生身份',source:{sourceId:'aohb27',page:7,ruleId:'R028/R029'}});
 }
 const state=allState([generalEducation.state,education.state,language.state,...hard.map(x=>x.state)]);
 const best=paths.find(p=>p.state==='pass')||paths.find(p=>p.state==='conditional');
 const missing=[];
 if(!best&&education.state==='unknown')missing.push('学历路径、资格取得日期或路径附加条件待核实');
 if(generalEducation.state==='unknown')missing.push('日本大学一般入学资格：缺少一条完整路径的证明，请展开核对教育年限、资格状态或认证范围');
 if(language.state==='unknown')missing.push('英语考试信息或豁免适用性待核实');
 hard.filter(x=>x.state==='unknown').forEach(x=>missing.push(x.label));
 const materials=program.materials.map(m=>{const applicability=m.when?evaluateAtom(m.when,facts).state:'pass';return {...m,applicability,preparation:student.materials?.[`${program.id}:${m.id}`]||student.materials?.[m.id]||'unknown'};}).filter(m=>m.applicability!=='fail');
 const preferences=[];
 if(student.direction)preferences.push({label:'专业方向',state:student.direction===program.direction?'pass':'fail',reason:program.direction});
 if(student.budget!==null&&student.budget!==undefined&&student.budget!=='')preferences.push({label:'年度学费预算',state:program.tuition.status!=='published'||!Number.isFinite(program.tuition.amount)||program.tuition.currency!==(student.budgetCurrency||'JPY')||program.tuition.period!=='学年'?'unknown':tri(program.tuition.amount<=student.budget),reason:program.tuition.status==='unspecified'?`${program.year}学费未注明`:!Number.isFinite(program.tuition.amount)?'未列统一学费金额，须按收费说明核对适用类别':`按${program.tuition.currency} / ${program.tuition.period}比较；不自动换汇`});
 return {programId:program.id,programName:program.name,version:program.version,roundId:round.id,intake:round.intake,round:round.period,state,label:labels[state],path:best?.id||null,education,generalEducation,language,hard,missing,materials,preferences,window:applicationWindow(round,now),simulation,conditions:state==='conditional'?[`在${round.enrollmentDate}前取得学历资格并完成后补证明`]:[],computedAt:now.toISOString()};
}
export function matchAll(student,programs,options={}){
 return programs.flatMap(p=>p.rounds.filter(r=>!student.intake||r.intake===student.intake).map(r=>matchProgram(student,p,r,options))).sort((a,b)=>['pass','conditional','unknown','fail'].indexOf(a.state)-['pass','conditional','unknown','fail'].indexOf(b.state)||['open','upcoming','closed'].indexOf(a.window.status)-['open','upcoming','closed'].indexOf(b.window.status));
}
export function checkCombination(selections,programs){
 const unique=[...new Set(selections)];
 if(!unique.length)return [];
 const selected=unique.map(key=>{const [id,roundId]=key.split(':');const p=programs.find(x=>x.id===id);const round=p?.rounds.find(r=>r.id===roundId);return p&&round?{p,round}:null;}).filter(Boolean);
 const results=[];
 for(const {p,round} of selected){const same=selected.filter(x=>x.p.id===p.id);const multiple=selected.some(x=>x.p.id!==p.id);if(multiple)results.push({label:`${p.id} 与其他项目并申`,state:p.combination.parallel==='allowed'?'pass':p.combination.parallel==='forbidden'?'fail':'unknown',detail:p.combination.materials,source:p.combination.source});if(same.length>1)results.push({label:`${p.id} 跨轮申请`,state:p.combination.reapply==='allowed'?'pass':p.combination.reapply==='forbidden'?'fail':'unknown',detail:p.combination.referenceReuse,source:p.combination.source});}
 if(selected.some(x=>x.p.id==='ISSE'))results.push({label:'ISSE 推荐信',state:'pass',detail:'需2封推荐信；其他项目的1封不能代替完整要求。'});
 if(selected.length===1)results.push({label:'已选1个项目轮次',state:'pass',detail:'增加候选后，将检查并申及跨轮规则。'});
 return results.filter((r,i,a)=>a.findIndex(x=>x.label===r.label)===i);
}
export function validateProgram(p){
 if(p?.semanticVersion===1)return validateImportedProgram(p,validDate);
 const errors=[];
 if(!p||typeof p!=='object')return ['项目数据无效'];
 for(const key of ['id','name','school','channel'])if(typeof p[key]!=='string'||!p[key].trim())errors.push(`缺少${key}`);
 if(!Number.isInteger(p.year))errors.push('入学年份无效');
 for(const key of ['paths','rounds','language','waivers','materials','hardConditions','requirements'])if(!Array.isArray(p[key]))errors.push(`${key}必须为列表`);
 if(errors.length)return errors;
 if(!p.paths.length||!p.rounds.length)errors.push('至少保留一条学历路径和一个申请轮次');
 const seen=new Set();for(const r of p.rounds){if(seen.has(r.id))errors.push('轮次编号重复');seen.add(r.id);if(!validDate(r.applyStart)||!validDate(r.applyEnd)||!validDate(r.enrollmentDate)||r.applyStart>r.applyEnd||r.applyEnd>=r.enrollmentDate)errors.push(`轮次${r.id}日期无效`);if(!/^\d{4}-(04|09)$/.test(r.intake)||Number(r.intake.slice(0,4))!==p.year)errors.push('入学年份／期与项目不一致');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.endTime))errors.push('开放／截止时刻无效');}
 const check=r=>{if(!r.field||!['eq','neq','in','gte','lte','contains'].includes(r.op)||r.value===undefined||!r.source?.page)errors.push('条件需字段、比较关系、取值与来源页码');if(r.op==='in'&&!Array.isArray(r.value))errors.push('in条件取值必须为数组');};
 for(const path of [...p.paths,...p.waivers]){if(!path.all?.length)errors.push('条件组不能为空');else path.all.forEach(check);}p.hardConditions.forEach(check);
 if(!p.languagePolicy||!Number.isFinite(p.languagePolicy.validYears)||p.languagePolicy.validYears<=0||!Array.isArray(p.languagePolicy.excludedFormats))errors.push('语言有效期或形式规则无效');
 for(const l of p.language)if(!l.exam||typeof l.score!=='number'||l.score<0||!l.source?.page)errors.push('语言考试需名称、非负门槛及来源');
 if(!['optional','not-required','required','unspecified'].includes(p.academicTests?.status)||!p.academicTests?.source?.page)errors.push('学术考试状态或来源无效');
 if(!['not-required','required','conditional','unspecified'].includes(p.interview?.status)||!p.interview?.source?.page||typeof p.interview?.detail!=='string')errors.push('面试状态、说明或来源无效');
 for(const m of p.materials)if(!m.id||!m.label||typeof m.required!=='boolean'||!m.stage||!m.source?.page)errors.push('材料条目需编号、名称、必要性、阶段和来源');
 if(!['unspecified','published'].includes(p.tuition?.status))errors.push('学费需明确公布状态');
 if(p.tuition?.status==='published'&&(!Number.isFinite(p.tuition.amount)||p.tuition.amount<0||!p.tuition.currency||!p.tuition.period))errors.push('已公布学费需非负金额、币种和周期');
 for(const field of ['parallel','reapply'])if(!['allowed','forbidden','unspecified'].includes(p.combination?.[field]))errors.push('并申／重申状态无效');
 return [...new Set(errors)];
}
