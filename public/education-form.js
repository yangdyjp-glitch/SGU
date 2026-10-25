import { qualificationTypes, qualificationType, studentQualifications, studentAccreditations, educationContext, educationReviewContext, commonAccreditors, renderQualificationHint, baseQualifications, isEducationVerification, educationVerificationFields, studentEducationEvidence } from './education-model.js';
import { buildQualificationCatalog } from './qualification-matrix.js';
import { buildProgramTitles } from './program-presentation.js';

const statuses=[['','待核实'],['studying','在读，未确认取得'],['expected','预计取得'],['completed','已取得']];
const designationFields=[['japanDesignated12','日本境内MEXT指定12年国际学校'],['designated11','MEXT指定十一年课程'],['mextEquivalent','MEXT认定等同课程'],['educationEvidence.mextOverseas','MEXT认定／指定的海外高中相当设施'],['educationEvidence.mextSpecialized','MEXT指定专修学校高等课程'],['educationEvidence.japanForeignShort','在日外国制度非12年高中相当课程'],['educationEvidence.japanForeignDesignated','在日外国制度高中相当设施已获MEXT指定']];
const get=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
const set=(o,path,value)=>{const keys=path.split('.');let x=o;for(const key of keys.slice(0,-1))x=x[key]??={};x[keys.at(-1)]=value;};
const bool=value=>value===''?null:value==='true';
const sharedVerification=new Set(Object.keys(educationVerificationFields));
export function projectEducationRules(p){return [...new Map([...p.paths.flatMap(x=>x.all),...p.hardConditions].filter(r=>isEducationVerification(r)&&!sharedVerification.has(r.field)).map(r=>[r.field,r])).values()];}
export function renderEducationForm(d,programs,ui,selectedProject=''){
  d={...d,educationEvidence:studentEducationEvidence(d)};
  const {esc,field,select,triField,textArea}=ui,q=studentQualifications(d),certs=studentAccreditations(d),catalogue=buildQualificationCatalog(programs);
  const titles=buildProgramTitles(programs),programLabel=p=>titles.get(p.id);
  const f=(label,name,value,type='text',help='')=>field(label,'edu.'+name,value,type,help);
  const sel=(label,name,value,options,help='')=>select(label,'edu.'+name,value,options,help);
  const triF=(label,name,value,help='')=>triField(label,'edu.'+name,value,help);
  const choices=(types)=>`<div class="education-options">${types.map(t=>`<label class="checkbox-label"><input type="checkbox" data-education-choice="${esc(t.id)}" ${q.some(x=>x.type===t.id)?'checked':''}><span>${esc(t.label)}${renderQualificationHint(t,esc)}</span></label>`).join('')}</div>`;
  const records=group=>q.map((record,index)=>({record,index})).filter(({record})=>(qualificationType(record.name)?.group||'curriculum')===group).map(({record:r,index:i})=>{
    const t=qualificationType(r.name),prefix=`qualification.${i}.`,opts=[...new Set([r.name,...t?.values||[]])].filter(Boolean);
    return `<div class="education-credential" data-education-record="${esc(r.id)}"><div class="between"><strong>${esc(t?.label||r.name)}${t?renderQualificationHint(t,esc):''}</strong><button type="button" class="btn sm" data-education-remove="${i}">移除</button></div><div class="education-credential-fields">${sel('原始证书／资格名称',prefix+'name',r.name,opts)}${sel('取得状态',prefix+'status',r.status,statuses)}${f('取得／预计日期',prefix+'date',r.date,'date','留空时沿用上方毕业日期')}${t?.id.endsWith('alevel')?sel('资格阶段',prefix+'level',r.level,[['','待核实'],['full','完整 A-Level'],['as','仅 AS Level']]):triF('完整文凭／毕业资格',prefix+'complete',r.complete)}${f('考试／颁发机构',prefix+'awardingBody',r.awardingBody)}${t?.id==='gce-alevel'?triF('具英国大学入学资格',prefix+'ukUniversityEntrance',r.ukUniversityEntrance):t?.id==='baccalaureate'?f('资格颁发国家',prefix+'credentialCountry',r.credentialCountry):f('实际证书类型（选填）',prefix+'certificateType',r.certificateType)}</div></div>`;
  }).join('');
  const extraQualifications=catalogue.filter(t=>t.field==='qualification'&&!qualificationTypes.some(x=>x.id===t.id));
  const extraCerts=catalogue.filter(t=>t.field==='accreditation'&&t.id!=='accreditation').flatMap(t=>t.values);
  const certNames=[...new Set([...commonAccreditors,...extraCerts,...certs.map(c=>c.name)])];
  const p=programs.find(p=>p.id===selectedProject),storedScope=p?d.projectEducation?.[p.id]:null,scope=storedScope?{...storedScope,version:storedScope.context===educationReviewContext(d)?storedScope.version:0}:null;
  const prepTypes=[...new Set(programs.flatMap(p=>p.paths.flatMap(path=>path.all.filter(a=>a.field==='preparatory'&&a.op==='in').flatMap(a=>a.value))))];
  return `<div class="education-form"><p class="muted small">按实际情况多选。满足任一资格的全部条件后，再核对项目要求；学校信息沿用基本资料。</p>
  <section class="education-category"><h3>学历与教育经历</h3><div class="form-grid">${sel('课程体系','curriculum',d.curriculum,[['','待核实'],'普通高中','IB','A-Level','美国高中','加拿大高中','澳大利亚高中','GED','其他',...[d.curriculum].filter(x=>x&&!['普通高中','IB','A-Level','美国高中','加拿大高中','澳大利亚高中','GED','其他'].includes(x))])}${f('学校所在国家／地区','schoolCountry',d.schoolCountry)}${sel('学校／课程类型','schoolType',d.schoolType,[['','待核实'],['regular','当地正规学校'],['japanese-secondary','日本高中／中等教育学校'],['international','国际学校'],['foreign-system','外国教育制度学校'],['specialized','专修学校高等课程'],['higher','高等教育']])}${f('累计正规学校教育年限','educationYears',d.educationYears,'number')}${triF('课程获所在地正规教育制度认可','formalEducation',d.formalEducation)}${sel('毕业／教育完成状态','educationStatus',d.educationStatus,statuses)}${f('毕业／预计毕业日期','graduationDate',d.graduationDate,'date')}</div>
  ${d.educationVersion!==2&&(d.standard12!==undefined||d.international12!==undefined)?'<p class="education-legacy">已有十二年／国际学校教育记录已保留。未区分的所在地、年限及认定范围须补充核实。</p>':''}
  <details><summary>指定课程与预备教育</summary><div class="form-grid">${designationFields.map(([name,label])=>triF(label,name,get(d,name))).join('')}${triF('完成／预计完成MEXT指定预备教育','preparatory',d.preparatory)}${sel('指定预备教育类别','preparatoryDetail.type',d.preparatoryDetail?.type,[['','待核实'],...new Set([d.preparatoryDetail?.type,...prepTypes].filter(Boolean))])}${sel('预备教育完成状态','preparatoryDetail.status',d.preparatoryDetail?.status,statuses)}${f('预备教育完成／预计日期','preparatoryDetail.date',d.preparatoryDetail?.date,'date')}${triF('仅以日本专修学校高等课程资格申请','japanVocationalOnly',d.japanVocationalOnly)}</div></details>
  <details ${q.some(r=>r.type.startsWith('associate'))?'open':''}><summary>高等教育学历</summary>${choices(qualificationTypes.filter(t=>t.group==='education'))}${records('education')}</details></section>
  <section class="education-category"><h3>课程体系与毕业资格</h3>${choices(qualificationTypes.filter(t=>t.group==='curriculum'))}${records('curriculum')}${extraQualifications.length?`<details><summary>其他已收录的原始资格</summary>${choices(extraQualifications)}</details>`:''}<details><summary>科目与成绩</summary><div class="form-grid">${f('GPA（若有）','academic.gpa',d.academic?.gpa,'number')}${f('GPA满分','academic.scale',d.academic?.scale,'number')}<div class="span2">${textArea('科目、层级与成绩（每行一项）','edu.subjectNotes',d.subjectNotes||'',3)}</div></div></details></section>
  <section class="education-category"><h3>学校认证与其他资格</h3><h4>认证机构${renderQualificationHint(baseQualifications.find(t=>t.id==='accreditation'),esc)}</h4><div class="education-options">${certNames.map(name=>`<label class="checkbox-label"><input type="checkbox" data-education-cert="${esc(name)}" ${certs.some(c=>c.name===name)?'checked':''}>${esc(name)}</label>`).join('')}</div>${certs.map((c,i)=>triF(c.name+'：已核对实际学校、课程与就读期间的认证范围','certification.'+i+'.scope',c.context===educationContext(d)?c.scope:null)).join('')}<p class="muted small">有学校认证，还须满足教育年限、毕业及项目要求。更换学校或课程后，需重新核对认证。</p><details><summary>其他资格认定与大学个别审查</summary><div class="form-grid">${triF('通过海外十二年同等学力考试（如 GED）','equivalency',d.equivalency)}${triF('通过日本高卒认定考试','japanEquivalency',d.japanEquivalency)}${triF('通过外国高中相当教育的同等学力考试','educationEvidence.foreignEquivalency',d.educationEvidence?.foreignEquivalency)}</div>${d.individualReview===true?'<p class="education-legacy">旧档案的个别认定未限定学校和项目，须补录实际认可范围。</p>':''}<div id="education-reviews">${(d.individualReviews||[]).map((r,i)=>`<div class="education-review"><div class="form-grid">${sel('审查项目','review.'+i+'.programId',r.programId,[['','请选择'],...programs.map(p=>[p.id,`${p.school} · ${programLabel(p)} · ${p.year}`])])}${sel('审查结果','review.'+i+'.outcome',r.outcome,[['pending','待核实／审核中'],['approved','已获认可'],['rejected','未获认可']])}${f('结果日期','review.'+i+'.date',r.date,'date')}${f('核对依据与认可范围','review.'+i+'.note',r.note)}</div><button type="button" class="btn sm" data-education-review-remove="${i}">移除此审查记录</button></div>`).join('')}</div><button type="button" class="btn sm" data-education-review-add>添加项目审查记录</button></details>
  <details><summary>项目附加条件核对</summary><p class="muted small">按项目原文核对科目、成绩、学制及适用范围；确认只用于本项目当前规则版本。</p>${sel('选择需要核对的项目','project',p?.id,[['','请选择'],...programs.map(p=>[p.id,`${p.school} · ${programLabel(p)} · ${p.year}`])])}${p?`<div data-education-project="${esc(p.id)}"><div class="form-grid">${projectEducationRules(p).map((r,i)=>typeof r.value==='boolean'?triF(r.label,'projectValue.'+i,scope?.values?.[r.field]):r.op==='in'?sel(r.label,'projectValue.'+i,scope?.values?.[r.field],[['','待核实'],...r.value.map(v=>[String(v),String(v)])]):f(r.label,'projectValue.'+i,scope?.values?.[r.field],typeof r.value==='number'?'number':'text')).join('')}${p.academicTests.status==='required'?triF('本项目要求的学术考试、科目及成绩已全部核对','academicSatisfied',d.academicTests?.[p.id]?.satisfied):''}</div>${textArea('核对依据（原文条款、成绩、证书等）','edu.projectEvidence',scope?.evidence||'',2)}<label class="checkbox-label"><input type="checkbox" name="edu.projectConfirmed" ${scope?.version===p.version?'checked':''}>已核对本项目当前 v${p.version} 的适用要求</label><a href="#program/${esc(p.id)}" target="_blank" rel="noopener">查看完整项目要求</a></div>`:''}</details></section></div>`;
}

export function gatherEducation(form,d,programs){
  const values=new FormData(form),records=studentQualifications(d).map(q=>({...q})),certs=studentAccreditations(d).map(c=>({...c})),reviews=structuredClone(d.individualReviews||[]);
  const triFields=new Set(['formalEducation','japanVocationalOnly','preparatory','equivalency','japanEquivalency',...designationFields.map(([k])=>k)]);
  for(const [raw,value] of values){
    if(!raw.startsWith('edu.'))continue;const name=raw.slice(4),v=String(value).trim();
    if(name.startsWith('qualification.')){const [,i,key]=name.split('.');if(records[i])records[i][key]=['complete','ukUniversityEntrance'].includes(key)?bool(v):v;}
    else if(name.startsWith('certification.')){const i=Number(name.split('.')[1]);if(certs[i]){certs[i].scope=bool(v);certs[i].context=educationContext({...d,schoolCountry:values.get('edu.schoolCountry'),curriculum:values.get('edu.curriculum'),schoolType:values.get('edu.schoolType'),educationYears:values.get('edu.educationYears')===''?null:Number(values.get('edu.educationYears'))});}}
    else if(name.startsWith('review.')){const [,i,key]=name.split('.');if(reviews[i])reviews[i][key]=v;}
    else if(['project','projectEvidence','projectConfirmed','academicSatisfied'].includes(name)||name.startsWith('projectValue.'))continue;
    else set(d,name,triFields.has(name)||name.startsWith('educationEvidence.')?bool(v):['educationYears','academic.gpa','academic.scale'].includes(name)?v===''?null:Number(v):v);
  }
  const p=programs.find(p=>p.id===form.querySelector('[data-education-project]')?.dataset.educationProject);
  if(p){
    const scoped={...d.projectEducation?.[p.id],values:{...d.projectEducation?.[p.id]?.values},evidence:String(values.get('edu.projectEvidence')||'').trim()};
    scoped.version=values.has('edu.projectConfirmed')?p.version:0;
    projectEducationRules(p).forEach((r,i)=>{const v=values.get('edu.projectValue.'+i);scoped.values[r.field]=v===null||v===''?null:typeof r.value==='boolean'?bool(v):typeof r.value==='number'?Number(v):r.op==='in'?r.value.find(x=>String(x)===v):String(v);});
    (d.projectEducation??={})[p.id]=scoped;
    if(p.academicTests.status==='required')(d.academicTests??={})[p.id]={...d.academicTests?.[p.id],satisfied:scoped.version===p.version&&scoped.evidence?bool(values.get('edu.academicSatisfied')||''):null};
  }
  reviews.forEach(r=>{const p=programs.find(p=>p.id===r.programId);if(p)r.year=p.year;});
  d.educationVersion=2;d.qualifications=records;d.accreditations=certs;d.individualReviews=reviews;
  if(d.preparatoryDetail&&!Object.values(d.preparatoryDetail).some(Boolean))delete d.preparatoryDetail;
  if(p&&values.has('edu.projectConfirmed'))d.projectEducation[p.id].context=educationReviewContext(d);
  return d;
}

export function updateEducationForm(event,student,programs){
  const target=event.target.closest('[data-education-choice],[data-education-remove],[data-education-cert],[data-education-review-add],[data-education-review-remove]');
  if(!target)return false;
  const q=studentQualifications(student),certs=studentAccreditations(student);
  if(target.dataset.educationChoice){
    const id=target.dataset.educationChoice,t=buildQualificationCatalog(programs).find(t=>t.id===id);
    student.qualifications=target.checked?[...q,{id:crypto.randomUUID(),type:id,name:t.values[0],status:'',level:'',complete:null}]:q.filter(r=>r.type!==id);
  }else if(target.hasAttribute('data-education-remove'))student.qualifications=q.filter((_,i)=>i!==Number(target.dataset.educationRemove));
  else if(target.dataset.educationCert)student.accreditations=target.checked?[...certs,{name:target.dataset.educationCert,scope:null}]:certs.filter(c=>c.name!==target.dataset.educationCert);
  else if(target.hasAttribute('data-education-review-add'))(student.individualReviews??=[]).push({programId:programs[0]?.id||'',year:programs[0]?.year||2027,outcome:'pending',date:'',note:''});
  else if(target.hasAttribute('data-education-review-remove'))student.individualReviews.splice(Number(target.dataset.educationReviewRemove),1);
  return true;
}
