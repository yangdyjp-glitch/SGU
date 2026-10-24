import { qualificationType, qualificationVariant, qualificationNameKey, qualificationAwardingBody, frenchQualificationName, normalizeName, studentQualifications, studentAccreditations, canonicalAccreditor, educationContext, educationReviewContext, educationVerificationFields, studentEducationEvidence } from '../public/education-model.js';

const tri=v=>v===true?'pass':v===false?'fail':'unknown';
const all=states=>states.includes('fail')?'fail':states.includes('unknown')?'unknown':states.includes('conditional')?'conditional':'pass';
const any=states=>states.includes('pass')?'pass':states.includes('conditional')?'conditional':states.includes('unknown')||!states.length?'unknown':'fail';
const get=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const age=(s,date)=>{if(!validDate(s.birthDate)||!validDate(date))return null;const b=s.birthDate.split('-').map(Number),d=date.split('-').map(Number);return d[0]-b[0]-(d[1]<b[1]||d[1]===b[1]&&d[2]<b[2]?1:0);};
const check=(label,state,reason,extra={})=>({label,state,reason,...extra});
const japan=s=>!s.schoolCountry?null:/^(日本|Japan|JP)$/i.test(s.schoolCountry.trim());
const values=rule=>rule.op==='in'?rule.value:rule.op==='eq'?[rule.value]:[];

// Shared facts describe a school/education record. Unmapped verification fields
// remain project-specific; a staff answer for one guide never applies to another.
export const sharedEducationFields=educationVerificationFields;
export function educationFacts(student){
  const facts={...student,verification:{...student.verification},_educationReviewContext:educationReviewContext(student)},e=studentEducationEvidence(student);
  if(japan(student)!==null)e.schoolInJapan=japan(student);
  if(student.schoolType==='japanese-secondary'&&e.schoolInJapan===true)e.japaneseSecondary=true;
  if(student.formalEducation!==undefined)e.formalEducation=student.formalEducation;
  if(student.mextEquivalent!==undefined)e.mextEquivalent=student.mextEquivalent;
  if(Number.isFinite(student.educationYears)){
    facts.shortSchool=student.educationYears<12;
    facts.standard12=student.educationYears>=12?(e.formalEducation??null):false;
    facts.international12=student.educationYears>=12?(e.schoolInJapan===false?e.formalEducation??null:student.schoolType==='international'?true:null):false;
  }
  for(const [field,key] of Object.entries(sharedEducationFields)){
    const prior=get(student,field);
    facts.verification[field.split('.')[1]]=Object.hasOwn(e,key)?e[key]:prior??null;
  }
  facts.educationEvidence=e;
  return facts;
}

function qualificationCheck(rule,record){
  if(!record)return {...rule,state:'unknown',reason:'请填写实际持有或预计取得的资格'};
  if(rule.op==='neq'){const positive=qualificationCheck({...rule,op:'eq'},record);return {...positive,op:'neq',state:positive.state==='pass'?'fail':positive.state==='fail'?'pass':'unknown',reason:positive.state==='unknown'?positive.reason:positive.state==='pass'?'命中本项目排除的资格':'未命中本项目排除的完整资格'};}
  if(!['eq','in','neq'].includes(rule.op))return {...rule,state:'unknown',reason:'资格比较关系待核实'};
  const targets=rule.op==='neq'?[rule.value]:values(rule)||[];
  const actualType=qualificationType(record.name)?.id;
  const matches=targets.filter(name=>qualificationNameKey(name)===qualificationNameKey(record.name)||actualType&&qualificationType(name)?.id===actualType);
  const alternatives=matches.map(name=>{
    let state='pass',reason='资格类型对应；继续核对成立条件';
    if(actualType?.endsWith('alevel')){
      const variant=qualificationVariant(name),supportsAS=['as','as-and-a'].includes(variant)&&!/完整|full A|至少.*A.?Level/i.test(rule.label||'');
      if(variant==='results'){state='unknown';reason='原文仅列明 A-Level results，须核对实际证书及本项目要求的科目、成绩和资格范围';}
      else if(!['full','as'].includes(record.level)){state='unknown';reason='须区分完整 A-Level 与仅 AS Level';}
      else if(record.level==='as'&&!supportsAS){state='fail';reason='仅 AS Level 不满足此路径的完整 A-Level 要求';}
      else if(qualificationVariant(record.name)==='as'&&record.level==='full'){state='unknown';reason='原始证书名称为 AS，所填完整 A-Level 阶段存在冲突，须核实';}
      else if(variant==='uk-entry'){state=tri(record.ukUniversityEntrance);reason='须核实是否具备英国大学入学资格';}
      if(state==='pass'&&record.level==='as')reason='原文列明 AS；仍须满足本路径科目、分数及其他条件';
      const requiredBody=qualificationAwardingBody(name),actualBody=record.awardingBody?.trim()?qualificationAwardingBody(record.awardingBody):qualificationAwardingBody(record.name);
      if(state==='pass'&&requiredBody&&requiredBody!==actualBody){state=actualBody?'fail':'unknown';reason='本路径限定'+requiredBody+'颁发的资格，须核对考试机构';}
    }else if(actualType&&record.complete!==true){state=record.complete===false?'fail':'unknown';reason=record.complete===false?'未取得或预计取得完整证书':'需确认是否为完整文凭／毕业资格，单科或课程结业不等同';}
    if(state==='pass'&&actualType==='baccalaureate'&&(record.credentialCountry||!frenchQualificationName(record.name)&&!record.legacy)){state=tri(record.credentialCountry?/^(法国|France|FR)$/i.test(record.credentialCountry):null);reason='须核对实际取得的是法国 Baccalaureate，同名的其他国家证书不能直接替代';}
    return {name,state,reason};
  });
  const state=alternatives.length?any(alternatives.map(a=>a.state)):'fail',reason=alternatives.find(a=>a.state===state)?.reason||'本路径未列明此资格';
  return {...rule,state,actual:record.name,qualificationId:record.id,reason};
}
function accreditationCheck(rule,facts){
  const records=studentAccreditations(facts),wanted=(values(rule)||[]).map(canonicalAccreditor);
  const context=educationContext(facts),attempts=records.map(record=>{
    const recognized=wanted.includes(canonicalAccreditor(record.name));
    const scope=facts.school?.trim()&&facts.curriculum?.trim()&&record.context===context?record.scope:null;
    return check(record.name,recognized?tri(scope):'fail',!recognized?'本项目未列明该认证机构':scope===true?'已核对实际学校、课程及就读期间的认证范围':scope===false?'学校或课程不在认证范围':'须核对实际学校、课程及就读期间的认证范围（会员资格不等于认证）');
  });
  return {...rule,state:any(attempts.map(a=>a.state)),actual:records.map(r=>r.name),reason:attempts.map(a=>a.label+'：'+a.reason).join('；')||'未填写学校认证',attempts};
}
function reviewCheck(rule,facts,program){
  const reviews=(facts.individualReviews||[]).filter(r=>(r.programId===program?.id||program?.mergedProgramIds?.includes(r.programId))&&r.year===program.year);
  const approved=reviews.find(r=>r.outcome==='approved');
  const state=approved?(validDate(approved.date)&&approved.note?.trim()?'pass':'unknown'):reviews.some(r=>r.outcome==='pending')?'unknown':reviews.length&&reviews.every(r=>r.outcome==='rejected')?'fail':facts.individualReview===false?'fail':'unknown';
  return {...rule,state,actual:reviews,reason:state==='pass'?'已取得本项目、本年度的个别审查认可':state==='fail'?'本项目个别审查未获认可':'需本项目、本年度的审查结果、日期和依据；旧的全局标记不能代替'};
}
export function evaluateEducationAtom(rule,facts,program,baseEvaluate){
  if(rule.state==='unspecified'||rule.value===null)return baseEvaluate(rule,facts);
  if(rule.field==='qualification'){
    if(facts._qualificationRecord)return qualificationCheck(rule,facts._qualificationRecord);
    const attempts=studentQualifications(facts).map(q=>qualificationCheck(rule,q));
    const state=rule.op==='neq'?all(attempts.map(a=>a.state)):any(attempts.map(a=>a.state));
    return {...rule,state:attempts.length?state:'unknown',attempts,reason:attempts.map(a=>a.actual+'：'+a.reason).join('；')||'资格未填写'};
  }
  if(rule.field==='accreditation')return accreditationCheck(rule,facts);
  if(rule.field==='individualReview')return reviewCheck(rule,facts,program);
  if(facts._certificationPath&&['international12','standard12'].includes(rule.field))return baseEvaluate(rule,{...facts,[rule.field]:Number.isFinite(facts.educationYears)?facts.educationYears>=12:facts[rule.field]===false?false:null});
  if(rule.field==='preparatory'){
    const detail=facts.preparatoryDetail;
    if(detail){
      if(rule.op==='in'&&!values(rule)?.includes(detail.type))return {...rule,state:detail.type?'fail':'unknown',reason:'须核对原文指定的预备课程类别',actual:detail.type};
      const status=detail.status==='completed'?'pass':detail.status==='expected'?'conditional':detail.status==='not-completed'?'fail':'unknown';
      return {...rule,state:status,actual:detail.type,reason:status==='conditional'?'预备教育尚待完成':status==='pass'?'已完成指定预备教育':'预备教育完成情况待核实'};
    }
    if(rule.op==='in')return {...rule,state:'unknown',reason:'旧档案仅有预备教育标记，须确认原文指定类别及完成日期'};
  }
  if(rule.field==='standard12'&&facts.mextEquivalent===true&&/MEXT|文部科学省/i.test(rule.label||'')&&/等同|equivalent/i.test(rule.label||''))return baseEvaluate(rule,{...facts,standard12:true});
  if(rule.field==='international12'&&!facts._certificationPath&&/日本以外|日本境外|国外|海外|outside Japan/i.test(rule.label||'')){
    const location=japan(facts);
    if(location!==false)return {...rule,state:location===true?'fail':'unknown',reason:'此路径要求日本以外的正规学校教育，须核对学校所在地'};
  }
  if(rule.field==='standard12'&&/在日本|日本国内|日本境内/.test(rule.label||'')&&japan(facts)!==true)return {...rule,state:japan(facts)===false?'fail':'unknown',reason:'此路径限日本境内教育，须核对学校所在地'};
  if(rule.field.startsWith('verification.')&&!sharedEducationFields[rule.field]){
    const scoped=facts.projectEducation?.[program?.id];
    if(scoped?.version!==program?.version||!scoped.evidence?.trim()||scoped.context!==facts._educationReviewContext)return {...rule,state:'unknown',reason:'须按当前学生档案及本项目当前版本核对并记录依据；其他学校、旧档案或旧版本的确认不适用'};
    const actual=scoped.values?.[rule.field];
    return {...baseEvaluate({...rule,field:'_scopedValue'},{_scopedValue:actual}),field:rule.field};
  }
  return baseEvaluate(rule,facts);
}

export function evaluateEducationPaths(student,program,round,{baseEvaluate,graduationCheck,ageAtEnrollment}){
  const shared={...educationFacts(student),ageAtEnrollment};
  const paths=program.paths.map(path=>{
    const qualificationPath=path.all.some(r=>r.field==='qualification'&&r.op!=='neq');
    const records=qualificationPath?studentQualifications(student):[null];
    const attempts=(records.length?records:[null]).map(record=>{
      const facts={...shared,_qualificationRecord:record,_certificationPath:path.all.some(r=>r.field==='accreditation')};
      if(record){facts.educationStatus=record.status||'';facts.graduationDate=record.date||student.graduationDate;}
      const checks=path.all.map(rule=>evaluateEducationAtom(rule,facts,program,baseEvaluate));
      if(facts._certificationPath)checks.push(check('认证学校课程的教育年限',Number.isFinite(student.educationYears)?tri(student.educationYears>=12):'unknown','须核对实际就读课程的十二年教育，不只核对机构名称'));
      if(!checks.length)checks.push(check('学历条件未明确','unknown','请核对原文'));
      if(path.all.some(r=>r.field==='preparatory')){
        const prep=student.preparatoryDetail;
        if(prep){
          checks.push(graduationCheck({...facts,educationStatus:prep.status,graduationDate:prep.date}));
        }else if(student.preparatory===true)checks.push(check('指定预备教育完成时间','unknown','旧档案未记录预备教育完成时间，须核对'));
      }
      checks.push(graduationCheck(facts));
      return {qualificationId:record?.id,qualificationName:record?.name,checks,state:all(checks.map(c=>c.state))};
    });
    const state=any(attempts.map(a=>a.state)),best=attempts.find(a=>a.state===state)||attempts[0];
    return {id:path.id,label:path.label,source:path.source,state,checks:best.checks,attempts,matchedQualifications:attempts.filter(a=>['pass','conditional'].includes(a.state)).map(a=>a.qualificationId).filter(Boolean)};
  });
  return {label:'项目学历资格（任一完整路径，路径内条件同时满足）',state:any(paths.map(p=>p.state)),paths,matchedPathIds:paths.filter(p=>['pass','conditional'].includes(p.state)).map(p=>p.id)};
}

// MEXT's published categories are a separate layer; university-specific clauses
// can narrow acceptance further. Sources are fixed in snapshots for auditability.
export const generalEducationSource={url:'https://www.mext.go.jp/a_menu/koutou/shikaku/07111314.htm',accreditationUrl:'https://www.mext.go.jp/a_menu/koutou/shikaku/07111314/006.htm',checkedAt:'2026-10-23'};
export function generalEligibility(student,program,round,graduationCheck){
  const facts=educationFacts(student),e=facts.educationEvidence,paths=[];
  const add=(id,label,checks)=>paths.push({id,label,checks,state:all(checks.map(c=>c.state)),source:generalEducationSource});
  const fact=(label,value)=>check(label,tri(value),value===true?'已核对':value===false?'已知不满足':'资料待补充／核实');
  const completion=graduationCheck(facts);
  const years=Number.isFinite(student.educationYears)?student.educationYears:null;
  add('japan-secondary','日本高中或中等教育学校毕业',[fact('日本高中／中等教育学校',e.japaneseSecondary),completion]);
  add('foreign12','日本以外正规十二年学校教育',[fact('学校在日本以外',japan(student)===null?null:!japan(student)),fact('当地正规教育及十二年课程',years===null?null:years>=12?student.formalEducation??null:false),completion]);
  add('designated11','MEXT指定十一年以上课程',[fact('MEXT指定课程及适用范围已核对',facts.designated11),fact('日本以外十一年以上教育',japan(student)===null||years===null?null:japan(student)===false&&years>=11),completion]);
  add('japan-designated','日本境内指定十二年外国学校',[fact('MEXT指定学校及课程已核对',facts.japanDesignated12),fact('日本境内十二年课程',japan(student)===null||years===null?null:japan(student)===true&&years>=12),completion]);
  for(const [id,label,value] of [['mext-overseas','MEXT认定的海外高中相当教育设施',e.mextOverseas],['mext-specialized','MEXT指定专修学校高等课程',e.mextSpecialized],['mext-equivalent','MEXT认定等同资格',e.mextEquivalent]])add(id,label,[fact(label,value),completion]);
  for(const q of studentQualifications(student).filter(q=>['ib','gce-alevel','international-alevel','abitur','baccalaureate','european-baccalaureate'].includes(q.type))){
    const full=q.type.endsWith('alevel')?q.level==='full'?true:q.level==='as'?false:null:q.complete;
    const checks=[fact('完整大学入学资格（仅 AS 不适用）',full),graduationCheck({...facts,educationStatus:q.status,graduationDate:q.date||student.graduationDate})];
    if(q.type==='gce-alevel')checks.push(fact('具英国大学入学资格',q.ukUniversityEntrance));
    if(q.type==='baccalaureate'&&(q.credentialCountry||!frenchQualificationName(q.name)&&!q.legacy))checks.push(fact('法国颁发的大学入学资格',q.credentialCountry?/^(法国|France|FR)$/i.test(q.credentialCountry):null));
    add('qualification:'+q.id,qualificationType(q.name)?.label||q.name,checks);
  }
  const certs=studentAccreditations(facts);
  if(certs.length){
    const candidates=certs.map(cert=>{
      const recognized=['WASC','NEASC','Cognia','COBIS','CIS','ACSI'].includes(canonicalAccreditor(cert.name));
      const checks=[fact('实际学校和课程已核对认证范围',facts.school?.trim()&&facts.curriculum?.trim()&&cert.context===educationContext(facts)?cert.scope:null),fact('十二年课程',years===null?null:years>=12),completion];
      if(!recognized)checks.push(check('该认证的一般入学资格效力','unknown','不在已核实的六种机构内，须另核 MEXT 依据；项目列明不等于一般资格认可'));
      return {id:'certification:'+cert.name,label:cert.name,checks,state:all(checks.map(c=>c.state)),source:generalEducationSource};
    });paths.push(...candidates);
  }
  const age18=age(student,round.enrollmentDate);
  for(const [id,label,value] of [['equivalency','海外十二年同等学力考试',facts.equivalency],['japanEquivalency','日本高卒认定考试',facts.japanEquivalency]])add(id,label,[fact(label,value),fact('达到规定年龄',age18===null?null:age18>=18),...(id==='japanEquivalency'?[fact('18岁生日次日开始有效',age18===null?null:round.enrollmentDate.slice(5)!==student.birthDate.slice(5)||age18>18)]:[]),completion]);
  if(facts.preparatory===true||student.preparatoryDetail){
    const prep=student.preparatoryDetail;
    const antecedent=any([tri(facts.shortSchool===true&&japan(student)===false?e.formalEducation:null),tri(e.japanForeignShort),tri(e.foreignEquivalency)]);
    add('preparatory','适用高中相当课程／考试＋指定预备教育',[check('适用的前置教育或同等学力考试',antecedent,'须核对教育所在地、短学制或同等学力考试认可范围'),fact('MEXT指定预备教育',facts.preparatory),completion,prep?graduationCheck({...facts,educationStatus:prep.status,graduationDate:prep.date}):check('预备教育完成状态和日期','unknown','请补充指定预备教育完成情况')]);
  }
  if(student.individualReviews?.length||student.individualReview===true)add('individual','申请大学的个别资格审查',[reviewCheck({field:'individualReview',label:'本项目个别资格审查'},facts,program),fact('年满18岁',age18===null?null:age18>=18)]);
  return {label:'日本大学一般入学资格',state:any(paths.map(p=>p.state)),paths,matchedPathIds:paths.filter(p=>['pass','conditional'].includes(p.state)).map(p=>p.id),source:generalEducationSource};
}

export function validateStudentEducation(s){
  const errors=[];
  if(s.educationYears!==undefined&&s.educationYears!==null&&(!Number.isFinite(s.educationYears)||s.educationYears<0||s.educationYears>30))errors.push('教育年限须为0至30的数字');
  for(const field of ['qualifications','accreditations','individualReviews'])if(s[field]!==undefined&&(!Array.isArray(s[field])||s[field].length>50))errors.push(field+'列表无效');
  if(errors.length)return errors;
  for(const q of s.qualifications||[]){
    if(!q||typeof q!=='object'){errors.push('资格记录无效');continue;}
    if(!q||typeof q.name!=='string'||!q.name.trim()||q.name.length>300)errors.push('资格原始名称无效');
    if(q.type&&qualificationType(q.name)&&q.type!==qualificationType(q.name).id&&!['other','qualification:'+normalizeName(q.name),'qualification:'+qualificationNameKey(q.name)].includes(q.type))errors.push('资格类型与原始名称不一致');
    if(!['','unknown','studying','expected','completed'].includes(q.status??''))errors.push('资格状态无效');
    if(!['','unknown','full','as'].includes(q.level??''))errors.push('A-Level阶段无效');
    if(q.date&&!validDate(q.date))errors.push('资格取得日期无效');
    if(q.complete!==undefined&&![true,false,null].includes(q.complete)||q.ukUniversityEntrance!==undefined&&![true,false,null].includes(q.ukUniversityEntrance))errors.push('资格完成状态无效');
  }
  if(new Set((s.qualifications||[]).map(q=>q?.id).filter(Boolean)).size!==(s.qualifications||[]).filter(q=>q?.id).length)errors.push('资格记录编号重复');
  for(const cert of s.accreditations||[])if(!cert||typeof cert.name!=='string'||!cert.name.trim()||cert.name.length>300||![true,false,null,undefined].includes(cert.scope))errors.push('学校认证信息无效');
  for(const review of s.individualReviews||[])if(!review||typeof review.programId!=='string'||!Number.isInteger(review.year)||!['pending','approved','rejected'].includes(review.outcome)||review.date&&!validDate(review.date))errors.push('个别资格审查信息无效');
  if(s.preparatoryDetail&&(s.preparatoryDetail.date&&!validDate(s.preparatoryDetail.date)||!['','unknown','studying','expected','completed','not-completed'].includes(s.preparatoryDetail.status??'')))errors.push('预备教育信息无效');
  if(s.projectEducation!==undefined&&(!s.projectEducation||Array.isArray(s.projectEducation)||typeof s.projectEducation!=='object'||Object.keys(s.projectEducation).length>100))errors.push('项目核对信息无效');
  for(const scoped of Object.values(s.projectEducation||{}))if(!scoped||!Number.isInteger(scoped.version)||!scoped.values||typeof scoped.values!=='object'||Array.isArray(scoped.values)||Object.keys(scoped.values).some(k=>!k.startsWith('verification.'))||typeof scoped.evidence!=='string')errors.push('项目核对范围或依据无效');
  return [...new Set(errors)];
}
