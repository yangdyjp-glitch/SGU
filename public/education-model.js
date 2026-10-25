// One catalogue for student entry, every school/project view and the matcher.
// Aliases group display names; original rule values and predicates stay intact.
export const educationGroups = [
  {id:'education',label:'学历与教育经历'},
  {id:'curriculum',label:'课程体系与毕业资格'},
  {id:'other',label:'学校认证与其他资格'}
];
export const commonAccreditors = ['WASC','NEASC','Cognia','COBIS','CIS','ACSI'];
export const educationVerificationFields={
  'verification.japaneseSecondaryGraduation':'japaneseSecondary',
  'verification.japaneseUpperSecondaryGraduation':'japaneseSecondary',
  'verification.mextRecognizedOverseasSchool':'mextOverseas',
  'verification.mextRecognizedOverseasUpperSecondary':'mextOverseas',
  'verification.designatedSpecializedTrainingCourse':'mextSpecialized',
  'verification.japanForeignNon12Secondary':'japanForeignShort',
  'verification.japanDesignatedInternationalSchool':'japanForeignDesignated',
  'verification.foreignUpperSecondaryEquivalency':'foreignEquivalency',
  'verification.mextEquivalentAcademicQualification':'mextEquivalent',
  'verification.formalNationalSchoolSystem':'formalEducation',
  'verification.regularSchoolEducation':'formalEducation',
  'verification.schoolEducationInJapan':'schoolInJapan'
};
export function studentEducationEvidence(s){
  const e={...s.educationEvidence};
  for(const [field,key] of Object.entries(educationVerificationFields)){
    if(Object.hasOwn(e,key))continue;
    const raw=Object.entries(educationVerificationFields).filter(([,k])=>k===key).map(([f])=>s.verification?.[f.split('.')[1]]).filter(v=>typeof v==='boolean');
    if(raw.length)e[key]=new Set(raw).size===1?raw[0]:null;
  }
  return e;
}
export const normalizeName = value => String(value??'').normalize('NFKC').toLowerCase().replace(/[\s_–—-]/g,'');
const diploma=(id,label,values,group='curriculum')=>({id,label,field:'qualification',values,group,subgroup:group==='education'?'高等教育学历':undefined});
const education=(id,label,fields)=>({id,label,field:fields[0],fields,group:'education'});
export const qualificationTypes = [
  diploma('ib','IB Diploma',['IB Diploma','International Baccalaureate Diploma','International Baccalaureate Full Diploma','International Baccalaureate','IB','IB完整文凭','Swiss International Baccalaureate','International Baccalaureate（完整IB Diploma）']),
  diploma('gce-alevel','UK GCE A-Level',['GCE A-Level','GCE A-levels','GCE Advanced Level','GCE Advanced Levels','General Certificate of Education Advanced Level','General Certificate of Education Advanced Level (GCE A-Level) in U.K.','GCE A level (United Kingdom)','UK GCE A-Level','UK GCE AS and A levels','GCE AS Level','UK GCE AS Level','GCE A-Level（具英国大学入学资格）','GCE A Levels（须获认可为英国大学入学资格）','GCE Advanced Level (A-Level)','General Certificate of Education (GCE) Advanced Level (A-Level)','General Certificate of Education Advanced Level（GCE A Level）','GCE A Level results']),
  diploma('international-alevel','International A-Level',['International A-Level','International A-Levels','International General Certificate of Education Advanced Level','International AS and A levels','International AS Level','International GCE A-Level','International GCE Advanced Level','Cambridge International A Levels','Cambridge International AS and A Levels','Pearson Edexcel International A Levels','International A Level results']),
  diploma('abitur','Abitur',['Abitur','German Abitur','德国Abitur','Abitur (Germany)','Abitur Certificate']),
  diploma('baccalaureate','French Baccalaureate',['Baccalaureate','Baccalauréat','French Baccalaureate','French Baccalauréat','Baccalauréat (France)','French Baccalauréat (France)','Baccalaureate Diploma','法国Baccalaureate Diploma','Baccalauréat Diploma']),
  diploma('european-baccalaureate','European Baccalaureate',['European Baccalaureate','European Baccalaureate Diploma']),
  diploma('ossd','OSSD',['OSSD','Ontario Secondary School Diploma']),
  diploma('dse','HKDSE',['DSE','HKDSE','Hong Kong Diploma of Secondary Education','Hong Kong Secondary School (High School) Diploma']),
  diploma('associate-arts','Associate Degree in Arts',['Associate Degree in Arts','Associate of Arts'],'education'),
  diploma('associate-science','Associate Degree in Science',['Associate Degree in Science','Associate of Science'],'education')
];
export const baseQualifications = [
  education('standard12','十二年正规学校课程',['standard12','verification.regularSchoolEducation']),
  {...education('mext-equivalent','MEXT认定等同课程',['mextEquivalent','verification.mextEquivalentAcademicQualification']),mext:true},
  education('japanese-secondary','日本高中或中等教育学校毕业',['verification.japaneseSecondaryGraduation','verification.japaneseUpperSecondaryGraduation']),
  education('international12','日本以外12年正规学校教育',['international12']),
  education('japanDesignated12','日本境内MEXT指定国际学校',['japanDesignated12']),
  education('overseas-mext','MEXT认定或指定的海外高中相当教育设施',['verification.mextRecognizedOverseasSchool','verification.mextRecognizedOverseasUpperSecondary']),
  education('designated11','MEXT指定十一年课程',['designated11']),
  education('preparatory','短学制／外国高中相当课程＋指定预备教育',['shortSchool','preparatory']),
  education('japan-foreign-preparatory','在日外国教育制度非12年高中相当课程＋指定预备教育',['verification.japanForeignNon12Secondary','verification.japanDesignatedInternationalSchool']),
  education('specialized-secondary','MEXT指定专修学校高等课程',['verification.designatedSpecializedTrainingCourse']),
  ...qualificationTypes.filter(t=>t.group==='education'),
  ...qualificationTypes.filter(t=>t.group==='curriculum'),
  {id:'accreditation',label:'认证机构',field:'accreditation',values:[...commonAccreditors,'Cognia（含NCA CASI、NWAC、SACS CASI）'],group:'other',subgroup:'学校认证机构'},
  {id:'equivalency',label:'GED／海外十二年同等学力考试',field:'equivalency',group:'other',subgroup:'其他资格认定'},
  {id:'japanEquivalency',label:'日本高卒认定考试',field:'japanEquivalency',group:'other',subgroup:'其他资格认定'},
  {id:'individualReview',label:'大学个别资格认定',field:'individualReview',group:'other',subgroup:'其他资格认定'},
  {id:'equivalency-preparatory',label:'外国高中同等学力考试＋指定预备教育',field:'verification.foreignUpperSecondaryEquivalency',group:'other',subgroup:'其他资格认定'}
];
// Presentation groups reference the original catalogue; they never replace
// qualification types, student facts, or the conditions of an admission path.
export const educationDisplayGroups = [
  {id:'secondary-education',label:'高中教育与预备教育',members:[
    {id:'standard12',shortLabel:'十二年正规教育'},
    {id:'japanese-secondary',shortLabel:'日本高中'},
    {id:'international12',shortLabel:'海外12年教育'},
    {id:'preparatory',shortLabel:'高中相当＋指定预科'},
    {id:'japan-foreign-preparatory',shortLabel:'在日非12年＋指定预科'}
  ],summary:'教育经历分别核对；预备教育路径须同时满足前置课程、指定预备教育及完成期限。'},
  {id:'mext-schools',label:'MEXT认定／指定课程',members:[
    {id:'mext-equivalent',shortLabel:'等同课程'},
    {id:'japanDesignated12',shortLabel:'境内指定国际学校'},
    {id:'overseas-mext',shortLabel:'海外高中相当设施'},
    {id:'designated11',shortLabel:'指定11年课程'},
    {id:'specialized-secondary',shortLabel:'专修学校高等课程'}
  ],summary:'须核实指定范围、课程完成及取得期限。'},
  {id:'associate-degree',label:'副学士（Arts／Science）',members:[
    {id:'associate-arts',shortLabel:'Arts'},
    {id:'associate-science',shortLabel:'Science'}
  ],summary:'须核对学位类型、授予机构及完成时间。'}
];
// Only spelling/explicit aliases are equivalent. A country, issuing body or
// AS stage is never discarded by fuzzy substring matching.
export const qualificationNameKey=value=>normalizeName(value).normalize('NFD').replace(/\p{M}/gu,'').replace(/[.。]/g,'').replace(/levels/g,'level');
export function qualificationType(name){return qualificationTypes.find(t=>t.id===name||t.values.some(v=>qualificationNameKey(v)===qualificationNameKey(name)));}
export function qualificationVariant(name){
  const type=qualificationType(name);
  if(!type)return qualificationNameKey(name);
  if(type.id.endsWith('alevel'))return /AS\s*(?:and|&)\s*A/i.test(name)?'as-and-a':/\bAS\s*[- ]?Level/i.test(name)?'as':/英国大学入学资格/.test(name)?'uk-entry':/\bresults\b/i.test(name)?'results':'full';
  return type.id;
}
export function qualificationAwardingBody(name){return /\bCambridge\b/i.test(name)?'Cambridge':/\b(?:Pearson|Edexcel)\b/i.test(name)?'Pearson Edexcel':'';}
export const frenchQualificationName=name=>/French|France|法国/i.test(name);
const accreditorNames={WASC:'Western Association of Schools and Colleges',NEASC:'New England Association of Schools and Colleges',CIS:'Council of International Schools',ACSI:'Association of Christian Schools International',COBIS:'Council of British International Schools'};
export function canonicalAccreditor(name){
  if(/^Cognia\s*[（(]/i.test(name))return 'Cognia';
  return commonAccreditors.find(n=>[n,...(accreditorNames[n]?[accreditorNames[n],`${accreditorNames[n]} (${n})`]:[])].some(v=>normalizeName(v)===normalizeName(name)))||name;
}
export function studentQualifications(student){
  if(Array.isArray(student.qualifications))return student.qualifications.map((q,i)=>({...q,id:q.id||`qualification-${i}`,type:qualificationType(q.name)?.id||q.type||'other'}));
  if(!student.qualification)return [];
  const type=qualificationType(student.qualification);
  const variant=qualificationVariant(student.qualification);
  return [{id:'legacy-qualification',type:type?.id||'other',name:student.qualification,status:student.educationStatus||'',date:student.graduationDate||'',level:type?.id.endsWith('alevel')?(['as-and-a','results'].includes(variant)?'unknown':variant==='as'?'as':'full'):'',complete:type&&!['ib','internationalbaccalaureate','swissinternationalbaccalaureate'].includes(normalizeName(student.qualification))?true:null,legacy:true}];
}
export function studentAccreditations(student){
  return Array.isArray(student.accreditations)?student.accreditations:student.accreditation?[{name:student.accreditation,scope:null,legacy:true}]:[];
}
export function educationContext(student){return JSON.stringify([student.school||'',student.curriculum||'',student.schoolCountry||'',student.educationYears??null,student.schoolType||'']);}
export function educationReviewContext(s){return JSON.stringify([educationContext(s),s.educationStatus||'',s.graduationDate||'',studentQualifications(s),studentAccreditations(s),s.educationEvidence||{},s.formalEducation??null,s.mextEquivalent??null,s.japanDesignated12??null,s.designated11??null,s.preparatory??null,s.preparatoryDetail||null,s.equivalency??null,s.japanEquivalency??null,s.individualReviews||[],s.academic||{},s.subjectNotes||'']);}
export function qualificationSummary(student){return studentQualifications(student).map(q=>qualificationType(q.name)?.label||q.name).filter((x,i,a)=>a.indexOf(x)===i).join(' / ');}
export const isEducationVerification=rule=>rule.field?.startsWith('verification.')&&!['verification.englishRequirement','verification.nonJapaneseNationalityAndPassport','verification.strongProgramMotivation'].includes(rule.field);
export function qualificationHint(item){
  if(item.members?.length)return [{text:'满足任一类型的全部条件即可。未说明是否接受的类型，需向学校核实。'}];
  if(item.id==='accreditation')return [{text:'包含：'+commonAccreditors.join('、')+'。学校认证须覆盖学生实际学校、课程和就读期间，并同时符合教育年限及完成要求。COBIS 等机构的具体认证资格须核实，会员身份不等于认证。'}];
  if(item.values?.length>1)return [{text:'包含名称：'+item.values.join('；')+'。'},...(item.id.endsWith('alevel')?[{text:'完整 A-Level、仅 AS 和预计取得的要求不同；须核对本项目认可的资格、考试机构、科目、分数和取得日期。'}]:[{text:'须核对实际证书、颁发机构、取得状态及项目要求。'}])];
  return [];
}
export function renderQualificationHint(item,esc,scopeParts=[]){
  const parts=[...scopeParts,...qualificationHint(item)];if(!parts.length)return '';
  return `<button type="button" class="info-hint qualification-hint" data-act="detail-info" data-info="${esc(JSON.stringify({label:item.label,parts}))}" aria-label="查看${esc(item.label)}包含的资格及适用范围" aria-haspopup="dialog"><span aria-hidden="true">!</span></button>`;
}
