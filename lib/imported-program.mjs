import { documentSchema, schemaFields, validateSchema } from './document-schema.mjs';

export function validateImportedProgram(p,validDate) {
 const errors=validateSchema(schemaFields({...p,doubts:[]}),documentSchema.$defs.program);
 if(errors.length)return ['整理结果结构不完整：'+errors.slice(0,5).join('；')];
 if(!/^[A-Za-z0-9_-]{2,30}$/.test(p.id)||!p.name.trim()||!p.school.trim()||!p.channel.trim()||!Number.isInteger(p.year)||p.year<2000||p.year>2100)errors.push('学校、项目、招生通道、编号或年份无效');
 for(const key of ['paths','waivers','rounds','language','materials','requirements']){
  const ids=p[key].map(r=>r.id);if(ids.some(id=>!id||/[\s:]/.test(id))||new Set(ids).size!==ids.length)errors.push(key+'条目编号缺失或重复');
 }
 for(const r of p.rounds){
  for(const key of ['applyStart','applyEnd','enrollmentDate','final'])if(r[key]!==null&&!validDate(r[key]))errors.push('轮次日期格式无效');
  if(r.applyStart&&r.applyEnd&&r.applyStart>r.applyEnd)errors.push('申请开始日不能晚于截止日');
  if(r.applyEnd&&r.enrollmentDate&&r.applyEnd>=r.enrollmentDate)errors.push('申请截止日须早于入学日');
  if(r.intake&&(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(r.intake)||Number(r.intake.slice(0,4))!==p.year))errors.push('入学期与项目年份不一致');
  for(const key of ['startTime','endTime'])if(r[key]!==null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r[key]))errors.push('申请时刻格式无效');
 }
 const rules=[...p.paths,...p.waivers].flatMap(path=>path.all).concat(p.hardConditions,p.materials.flatMap(m=>m.when?[m.when]:[]));
 for(const r of rules){if(!r.label||!r.field||r.op==='in'&&r.value!==null&&!Array.isArray(r.value)||r.referenceDate!==null&&!validDate(r.referenceDate))errors.push('条件的名称、取值或基准日无效');}
 for(const row of p.language)for(const key of ['score','reading','listening','writing','speaking'])if(row[key]!==null&&(!Number.isFinite(row[key])||row[key]<0))errors.push('考试门槛必须为非负数或未注明');
 if(p.languagePolicy.validYears!==null&&p.languagePolicy.validYears<=0)errors.push('成绩有效年限无效');
 for(const day of [p.languagePolicy.validAfter,p.languagePolicy.validUntil,p.graduationPolicy.deadline])if(day!==null&&!validDate(day))errors.push('有效期或毕业截止日期无效');
 if(p.tuition.status==='published'){
  if(!p.tuition.currency.trim()||!p.tuition.period.trim())errors.push('已公布学费需币种和周期');
  if(p.tuition.amount===null){
   if(!p.tuition.detail.trim()||!p.tuition.source.quote.trim())errors.push('未列统一金额的已公布学费需完整收费说明及原文依据');
  }else if(!Number.isFinite(p.tuition.amount)||p.tuition.amount<0)errors.push('学费金额必须为非负数或未列统一金额');
 }
 return [...new Set(errors)];
}

export function importedGraduationCheck(student,p,round,{validDate,tri}){
 const policy=p.graduationPolicy;
 let state='unknown',reason='毕业时间要求或学生资格取得情况待核实';
 if(policy.required===false){state='pass';reason='文件明确不要求此项';}
 else if(policy.required===true&&validDate(policy.deadline)&&validDate(student.graduationDate)){
  if(student.graduationDate>policy.deadline){state='fail';reason='资格取得日期晚于学校截止日期';}
  else if(student.educationStatus==='completed'){state='pass';reason='已取得资格且日期符合要求';}
  else if(student.educationStatus==='expected'&&policy.allowExpected===true){state='conditional';reason='须在截止日前取得资格并补交证明';}
  else if(student.educationStatus==='expected'&&policy.allowExpected===false){state='fail';reason='该通道不接受预计取得资格';}
 }
 return {label:policy.detail||'资格取得时间要求',state,reason,source:policy.source};
}

// A duration alone does not identify its reference date. Never borrow another
// school's deadline convention when the document leaves that date unspecified.
export function validityAnchor(policy){
 const text=[policy.detail,policy.source?.quote].join(' ');
 const start=/years?[^,.;，。；]{0,80}(?:first day|start|opening)|(?:首日|开始日|开始日期)[^,，。；;]{0,12}(?:两|二|\d+)年|(?:两|二|\d+)年[^,，。；;]{0,30}(?:首日|开始日|开始日期)/i.test(text);
 const end=/years?[^,.;，。；]{0,80}(?:deadline|last day|closing)|(?:截止日|截止日期|最后一天)[^,，。；;]{0,12}(?:两|二|\d+)年|(?:两|二|\d+)年[^,，。；;]{0,30}(?:截止日|截止日期|最后一天)/i.test(text);
 return start===end?null:start?'applyStart':'applyEnd';
}

function formatIsExcluded(exam,excluded){
 return excluded.some(value=>{
  if(value===exam.format)return true;
  const name=String(value),scope=name.match(/TOEFL|IELTS|TOEIC|PTE|Duolingo|Cambridge/i)?.[0];
  if(scope&&!exam.exam.toLowerCase().includes(scope.toLowerCase()))return false;
  const patterns={home:/home edition/i,essentials:/essentials/i,online:/\bonline\b/i,'one-skill':/one[ -]?skill|单科重考/i,institutional:/\bITP\b|\bIP\b|institutional|机构考试/i};
  return patterns[exam.format]?.test(name)||false;
 });
}

export function importedLanguageAttempt(exam,p,round,simulation,{validDate,tri,allState}){
 const policy=p.languagePolicy;
 const out=(state,reason,checks=[])=>({id:exam.id,label:`${exam.exam} · ${exam.score??'未填分数'}`,state,reason,source:policy.source,checks});
 if(exam.status==='target'&&!simulation||exam.status&&!['actual','target'].includes(exam.status))return out('unknown','该成绩尚未实际取得');
 if(formatIsExcluded(exam,policy.excludedFormats))return out('fail','原文明示不接受该考试形式');
 if(exam.superscore&&policy.allowSuperscore!==true){
  const scoped=policy.excludedFormats.filter(name=>/mybest|superscor|拼分/i.test(name));
  const unrelated=scoped.length&&scoped.every(name=>/TOEFL/i.test(name)&&!exam.exam.includes('TOEFL'));
  return out(policy.allowSuperscore===false&&!unrelated?'fail':'unknown','跨次拼分的适用性需按原文核实');
 }
 const forms=p.language.filter(l=>l.exam===exam.exam);
 if(!forms.length)return out('unknown','原文未列出此考试，接受范围待核实');
 const threshold=forms.find(l=>exam.exam!=='TOEFL iBT'||!l.scale||l.scale===exam.scale);
 if(!threshold)return out('unknown','考试计分版本需要核实');
 const checks=[];
 const add=(label,state,reason='')=>checks.push({label,state,reason,source:threshold.source});
 if(!exam.format)add('考试形式','unknown');
 let after=policy.validAfter,until=policy.validUntil;
 const anchor=validityAnchor(policy),reference=anchor&&round[anchor];
 if(policy.validYears&&!after&&validDate(reference)){const day=new Date(reference);day.setUTCFullYear(day.getUTCFullYear()-policy.validYears);after=day.toISOString().slice(0,10);until=until||reference;}
 if(!validDate(exam.date)||!after&&!until||policy.validYears&&!after)add('成绩有效期','unknown','有效期或考试日期待核实');
 else add('成绩有效期',tri((!after||exam.date>=after)&&(!until||exam.date<=until)));
 if(policy.availabilityRequired===true){add('截止前取得成绩',!validDate(exam.availableDate)||!validDate(round.applyEnd)?'unknown':tri(exam.availableDate<=round.applyEnd));}
 else if(policy.availabilityRequired===null)add('成绩提交时限','unknown');
 if(threshold.score===null&&threshold.minimumStatus!=='no-minimum')add('最低分','unknown');
 for(const [key,label] of [['score','总分／指定单项'],['reading','阅读'],['listening','听力'],['writing','写作'],['speaking','口语']])if(typeof threshold[key]==='number')add(`${label} ≥ ${threshold[key]}`,Number.isFinite(exam[key])?tri(exam[key]>=threshold[key]):'unknown');
 if(threshold.minimumStatus==='no-minimum'&&!Number.isFinite(exam.score))add('提交成绩','unknown');
 const state=allState(checks.map(c=>c.state));return out(state,state==='pass'?'符合已核对的考试要求':state==='fail'?'未达到该考试要求':'考试适用条件待核实',checks);
}
