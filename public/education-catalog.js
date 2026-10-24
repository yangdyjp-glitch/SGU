import {baseQualifications, qualificationTypes, qualificationType, qualificationNameKey, normalizeName} from './education-model.js';

// Catalogue classification is deliberately separate from student facts. These
// aliases locate a complete original path; they never turn a verification rule
// into a shared boolean or replace its AND conditions.
const route=(id,label,fields=[],aliases=[],displayGroup='',shortLabel=label)=>({id,label,pathFields:fields,aliases,group:'education',displayGroup,shortLabel});
export const educationPathTypes=[
  route('standard12','十二年正规学校课程',['verification.regular12YearCourse']),
  route('japanese-secondary','日本高中或中等教育学校毕业',['verification.japanHighSchoolGraduation','verification.japanUpperSecondaryGraduation']),
  route('mext-equivalent','MEXT认定等同课程',['verification.mextEquivalentCondition1']),
  route('overseas-mext','MEXT认定或指定的海外高中相当教育设施',['verification.mextOverseasHighSchoolEquivalent','verification.mextOverseasJapaneseSchool'],['文部科学大臣指定境外高中等同课程','文部科学省认定在外教育设施']),
  route('specialized-secondary','MEXT指定专修学校高等课程',['verification.mextSpecializedTrainingUpperSecondary','verification.mextDesignatedSpecializedTrainingAdvancedCourse','verification.designatedSpecializedUpperSecondary'],['文部科学大臣指定日本专修学校高等课程','指定专修学校高等课程','文部科学省指定专修学校高等课程','完成指定专修学校高等课程','完成文部科学省指定专修学校高等课程']),
  route('japanDesignated12','日本境内MEXT指定国际学校',['verification.mextRecognizedInternationalSchoolInJapan']),
  route('associate-arts','Associate Degree in Arts',['verification.associateArtsScience'],['取得文科或理科副学士学位']),
  route('associate-science','Associate Degree in Science',['verification.associateArtsScience'],['取得文科或理科副学士学位']),
  route('bachelor-two-years','学士授予机构正式学位生学习经历',['verification.bachelorDegreeSeekingFullYears','verification.bachelorInstitutionTwoFullYears','verification.twoFullBachelorYears','verification.twoFullBachelorAcademicYears','verification.bachelorTwoYears','verification.twoCollegeYears'],['学士授予机构正式学位生完成两学年','学士学位课程正式学生完成两完整学年','学士学位授予机构正式学位生两完整学年','学士学位攻读身份两完整学年','授予学士学位机构的正式学位生完成两个完整学年','学士授予机构完成两年','编入须完成大学两年'],'university-education','正式学位生学习年限'),
  route('foreign-university-degree','海外大学／学院学位',['verification.nonJapaneseUniversityDegree'],['非日本大学或学院相关专业学位','非日本大学/学院相关学位'],'university-education','海外大学／学院学位'),
  route('foreign-university-study','海外大学学习经历与学分',['verification.nonJapaneseFourYearUniversity'],['非日本四年制大学两年及62学分','非日本四年制大学两年、62学分'],'university-education','海外大学年限与学分'),
  route('japan-university-study','日本大学学习经历与学分',['verification.japaneseFourYearUniversity'],['日本四年制大学英语项目两年及62学分','日本四年制大学英语项目两年、62学分'],'university-education','日本大学年限与学分'),
  route('national-secondary','所在国正规高中教育',['verification.localNationalSystemHighSchool','verification.nationalSystemHighSchool'],['所在地国家教育体系下的公立或私立高中','所在国国民教育体系的公立或私立高中','所在国国民教育体系下的公立或私立高中'],'secondary-education','所在国正规高中'),
  route('japan-special-needs','日本特别支援学校高中阶段',['verification.japanSpecialNeedsUpperSecondary','verification.japanSpecialNeedsOrKosenThirdYear'],[],'secondary-education','特别支援学校高中阶段'),
  route('japan-kosen-third-year','日本高等专门学校第三学年',['verification.japanTechnicalCollegeThirdYear','verification.japanSpecialNeedsOrKosenThirdYear'],[],'secondary-education','高等专门学校第三学年'),
  route('japan-former-system','日本旧制学校课程',['verification.japanFormerSchoolSystem'],['日本旧制学校等修了'],'secondary-education','日本旧制学校'),
  route('foreign-secondary-equivalent','境外高中相当教育',['verification.japaneseHighSchoolEquivalent'],['来日前取得日本高中同等学历'],'secondary-education','境外高中相当教育'),
  route('japan-recognized-foreign-school','日本境内获认可的国际／外国学校',['verification.accreditedForeignSchoolJapan'],['日本境内正式认可的国际或外国学校毕业'],'secondary-education','境内获认可外国学校'),
  route('preparatory-secondary-alternatives','指定预备教育／日本中等学校（按列明范围）',['verification.preparatoryOrJapaneseSecondary'],['指定预备教育或日本中等学校','指定预科或日本中等学校修了'],'secondary-education','指定预科／中等学校'),
  route('japan-designated-short','日本境内指定外国学校短学制课程',['verification.japanDesignatedShortForeignSchool'],['日本境内外国高中课程：对应不足12年学制'],'mext-schools','境内指定短学制课程'),
  route('mext-listed-program','其他MEXT指定课程／资格（名单核对）',['verification.mextListedSchoolProgram','verification.otherMextDesignatedEligibility'],['文部科学省网站所列学校课程','文部科学省指定网页列示的学校课程','文部科学省网页列明的学校课程','其他文部科学省指定资格'],'mext-schools','其他指定名单课程'),
  {...route('foreign-university-entrance','其他外国大学入学资格',['verification.foreignUniversityAdmissionQualification'],['持外国大学入学资格']),group:'curriculum'},
  route('japan-foreign-system12','日本境内外国学制十二年课程',['verification.foreignSystemSchoolInJapan12'],[],'secondary-education'),
  route('mixed-foreign-secondary','混合学制高中教育（外国高中毕业）',['verification.mixedForeignHighSchool'],[],'secondary-education'),
  route('mixed-japanese-secondary','混合学制高中教育（日本高中毕业）',['verification.mixedJapaneseHighSchool'],[],'secondary-education'),
  route('accelerated-secondary','跳级完成十二年相当教育',['verification.skippedYearsEquivalent12','verification.acceleratedForeignSchoolCompletion'],[],'secondary-education'),
  route('secondary-graduation','高中／中等教育学校毕业（范围按原文）',['verification.highSchoolGraduation'],[],'secondary-education'),
  route('overseas-extended-education','海外累计学校教育（编入资格）',['verification.overseasFourteenYears','verification.outsideJapanSchoolEducationYears','verification.overseas14YearEducation'],[],'university-education','海外累计教育年限'),
  route('junior-college','短期大学毕业',['verification.juniorCollegeGraduation','verification.juniorCollegeGraduationBeforeEnrollment'],[],'university-education'),
  route('technical-college-graduation','日本高等专门学校毕业',['verification.japanTechnicalCollegeGraduation','verification.japanTechnicalCollegeGraduationBeforeEnrollment'],[],'university-education'),
  route('vocational-college-graduation','专门／专修学校毕业（编入资格）',['verification.mextSpecialTrainingSchoolGraduation','verification.mextSpecialTrainingSchoolGraduationBeforeEnrollment'],[],'university-education'),
  route('second-bachelor','学士毕业／第二学士学位申请',['verification.bachelorGraduation','verification.bachelorGraduationBeforeEnrollment','verification.secondBachelorApplicant'],[],'university-education'),
  {...route('former-japan-equivalency','旧大学入学资格检定',['verification.formerUniversityEntranceQualificationExam']),group:'other'},
  {...route('other-equivalent-recognition','其他同等学力认定',['verification.highSchoolEquivalentCertification','verification.article150Qualification','verification.article90Paragraph2Admission']),group:'other'}
];

// These fields are catalogue aliases, not interchangeable student facts. Keep
// every original predicate, including years, credits, language and deadlines.
const pathFieldAliases={
  'japanese-secondary':['verification.japaneseHighSchoolGraduation','verification.japaneseSecondaryGraduation','verification.japaneseUpperSecondaryGraduation'],
  'japan-special-needs':['verification.specialNeedsUpperSecondaryGraduation','verification.japaneseSpecialSchoolQualification'],
  'japan-kosen-third-year':['verification.collegeOfTechnologyThirdYearCompletion','verification.kosenThirdYear','verification.japaneseSpecialSchoolQualification'],
  'overseas-mext':['verification.designatedOverseasJapaneseSchoolGraduation','verification.overseasJapaneseSchool','verification.mextRecognizedOverseasCourse','verification.mextRecognizedOverseasHighSchool','verification.mextCertifiedForeignUpperSecondaryCourse'],
  'specialized-secondary':['verification.designatedSpecializedTrainingUpperSecondaryCompletion','verification.vocationalAdvancedCourse'],
  'japanDesignated12':['verification.designatedInternationalSchoolJapanCompleted'],
  'mext-listed-program':['verification.mextEquivalentQualification','verification.mextDesignatedEquivalent'],
  'foreign-university-degree':['verification.fourYearLifeScienceDegreeOutsideJapan','verification.threeYearLifeScienceDegreeOutsideJapan'],
  'foreign-university-study':['verification.overseasUniversityTwoYears','verification.currentlyEnrolledOutsideJapanFourYearLifeScienceUniversity','verification.overseasBachelorStudyYears','verification.bachelorStudyYearsOutsideJapan','verification.overseasUniversityEnrollmentYears','verification.outsideJapanUniversityEnrollmentYears','verification.foreignUniversityEnrollment2Years','verification.overseasUniversityEnrollment','verification.foreignUniversityEnrollment','verification.overseasBachelorStudyYearsBeforeEnrollment'],
  'japan-university-study':['verification.japanBachelorStudyYears','verification.bachelorStudyYearsWithinJapan','verification.japanBachelorStudyYearsBeforeEnrollment'],
  'foreign-university-entrance':['verification.otherInternationalUniversityEligibility','verification.internationalUniversityEntranceQualification','verification.otherInternationalEntranceQualification','verification.otherInternationalUniversityEntranceQualification','verification.otherInternationalUniversityQualification','verification.recognizedForeignUniversityEntryQualification','verification.foreignUniversityEntranceQualification','verification.overseasUniversityEntranceQualification']
};
for(const type of educationPathTypes)type.pathFields.push(...pathFieldAliases[type.id]||[]);
const credentialRoutes={
  'japanese-secondary':['日本高中或其他中等教育学校毕业资格'],
  'foreign-university-entrance':['文部科学大臣指定的外国大学入学资格'],
  'other-equivalent-recognition':['其他同等资格']
};
export function educationCredentialType(name){return educationPathTypes.find(type=>credentialRoutes[type.id]?.some(value=>educationLabelKey(value)===educationLabelKey(name)));}

// Unclassified source expressions are retained for review, but never promoted
// to a new top-level education/curriculum field just because an upload used it.
export const unclassifiedDisplayGroup={id:'unclassified-eligibility',label:'其他原文资格与条件（待归类）',group:'other',members:[],summary:'原文内容完整保留；尚未归入标准类型，须按本项目核实。'};
export function fallbackDisplayGroup(item){
  if(item.id.startsWith('path:')||item.id.startsWith('condition:'))return unclassifiedDisplayGroup.id;
  if(item.id.startsWith('qualification:')&&item.id!=='qualification:singaporegcealevel')return 'other-credentials';
  return '';
}

export const educationLabelKey=value=>normalizeName(String(value??'').replace(/^\s*(?:[①-⑳]|[A-Z]-[a-z][：:]|基本条件[（(]\d+[）)][：:]|[④①])\s*/u,'')).replace(/[：:，,、/／。；;（）()]/g,'');
const positive=atom=>atom.state!=='unspecified'&&atom.value!==null&&((atom.op==='eq'&&atom.value===true)||(['eq','gte','in'].includes(atom.op)&&atom.value!==false));

export function educationPathTypesFor(path){
  const fields=new Set((path.all||[]).filter(positive).map(a=>a.field));
  const key=educationLabelKey(path.label);
  const typed=educationPathTypes.filter(type=>type.pathFields.some(field=>fields.has(field)));
  if(fields.has('verification.bachelorStudyLocation')&&path.all.some(a=>a.field==='verification.bachelorStudyLocation'&&a.value==='Japan')&&fields.has('verification.completedBachelorStudyYears'))typed.push(educationPathTypes.find(t=>t.id==='japan-university-study'));
  if(fields.has('verification.japaneseEquivalencyExam')||fields.has('verification.upperSecondaryCertificationExam')&&!fields.has('verification.article90Paragraph2Admission'))typed.push(baseQualifications.find(t=>t.id==='japanEquivalency'));
  if(fields.has('verification.accreditedTwelveYearProgram'))typed.push(baseQualifications.find(t=>t.id==='accreditation'));
  if(typed.length)return typed;
  // Labels classify only a path with actual predicates. They never infer new
  // alternatives from incidental words in evidence, notes or an empty heading.
  if(!(path.all||[]).some(positive))return [];
  return educationPathTypes.filter(type=>[type.label,...type.aliases].some(name=>educationLabelKey(name)===key));
}

// A different title for identical predicates is one catalogue field. Deadlines
// and ages remain in the path and are shown for the respective project, not in
// its identity. Values of unknown substantive predicates are NOT discarded.
export function educationPathKey(path){
  const atoms=(path.all||[]).filter(a=>!['graduationDate','educationStatus','ageAtEnrollment'].includes(a.field));
  return atoms.length?JSON.stringify(atoms.map(a=>[a.field,a.op,Array.isArray(a.value)?[...a.value].sort():a.value,a.state==='unspecified']).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))):'label:'+educationLabelKey(path.label);
}

export function qualificationCatalogKey(name){return qualificationType(name)?.id||'qualification:'+qualificationNameKey(name);}

// Institution display identity only. In particular, ECIS recognition before
// a stated year must NOT become interchangeable with undated student evidence.
export function extraAccreditorLabel(name){return /^ECIS(?:$|[\s（(]|在)/i.test(name)?'ECIS':name;}

// Sent as vocabulary, never as evidence of another university's acceptance.
export function educationImportVocabulary(programs=[]){
  const types=[...baseQualifications,...educationPathTypes.filter(t=>!baseQualifications.some(b=>b.id===t.id))];
  const known=new Set(qualificationTypes.map(t=>t.id)),otherCredentials=new Map(),otherPaths=new Map();
  for(const p of programs)for(const path of p.paths||[]){
    for(const a of path.all||[])if(a.field==='qualification'&&['eq','in'].includes(a.op))for(const name of Array.isArray(a.value)?a.value:[a.value]){
      if(typeof name!=='string'||known.has(qualificationCatalogKey(name))||educationCredentialType(name))continue;
      otherCredentials.set(qualificationCatalogKey(name),{label:name,field:'qualification',aliases:[name],classification:'unclassified-source-expression'});
    }
    if(!educationPathTypesFor(path).length&&(path.all||[]).some(a=>a.field.startsWith('verification.')&&positive(a))&&!path.all.some(a=>['qualification','accreditation','standard12','international12','individualReview','equivalency','japanEquivalency','preparatory','designated11','japanDesignated12'].includes(a.field)))otherPaths.set(educationPathKey(path),{label:path.label,fields:path.all.map(a=>a.field),classification:'unclassified-source-expression'});
  }
  return [...types.map(t=>({id:t.id,label:t.label,fields:t.fields||[t.field].filter(Boolean),pathFields:educationPathTypes.find(x=>x.id===t.id)?.pathFields||[],aliases:[...t.values||t.aliases||[],...credentialRoutes[t.id]||[]]})),...otherCredentials.values(),...otherPaths.values()];
}
