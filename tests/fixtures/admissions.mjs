export const admissionsText=`<!-- page 1 of 2 -->
# Example University — 2027 Admissions
Applicants must complete 12 years of education.
Graduation must be completed by March 31, 2027. Expected graduation is accepted.
IELTS Academic minimum 6.5, each section 6.0. Scores are valid for two years before the application deadline.
Applications open November 1, 2026 and close November 30, 2026 at 23:00 Japan time. Enrollment is April 1, 2027.
<!-- page 2 of 2 -->
Submit two recommendation letters. Translations must be certified.
SAT and ACT are optional. An interview may be required.
The document does not clarify whether superscores are accepted.
`;
export function admissionsFixture(){
 const source=(page,quote)=>({page:String(page),quote});
 const school='示例大学',quote='Applicants must complete 12 years of education.';
 const s=()=>source(1,quote),p={school,year:2027,name:'国际研究',englishName:'International Studies',channel:'海外英语本科',direction:'国际关系',degree:'学士',partner:null,
  paths:[{id:'A',label:'完成十二年教育',all:[{field:'standard12',op:'eq',value:true,label:'完成十二年教育',referenceDate:null,state:'stated',source:s()}],source:s()}],hardConditions:[],
  language:[{id:'ielts',exam:'IELTS Academic Module',scale:'0–9',score:6.5,basis:'总分',reading:6,listening:6,writing:6,speaking:6,minimumStatus:'stated',version:'',note:'总分及单项均达标',source:source(1,'IELTS Academic minimum 6.5, each section 6.0.')}],waivers:[],
  rounds:[{id:'april-1',intake:'2027-04',period:1,applyStart:'2026-11-01',applyEnd:'2026-11-30',enrollmentDate:'2027-04-01',startTime:null,endTime:'23:00',timezone:'Asia/Tokyo',first:null,interview:null,final:null,note:'开始时刻未列明',source:source(1,'Applications open November 1, 2026 and close November 30, 2026 at 23:00 Japan time. Enrollment is April 1, 2027.')}],
  materials:[{id:'recommendation',label:'两封推荐信',required:true,stage:'申请',note:'译文须经认证',when:null,source:source(2,'Submit two recommendation letters. Translations must be certified.')}],
  requirements:[{id:'education',topic:'学历资格',stage:'申请',nature:'硬性',detail:'完成十二年教育；预计毕业者须在2027年3月31日前取得资格。',source:s()},{id:'letters',topic:'推荐信与译文',stage:'申请',nature:'材料',detail:'提交两封推荐信；译文须经认证。',source:source(2,'Submit two recommendation letters. Translations must be certified.')}],
  languageRequirement:'required',languagePolicy:{validYears:2,validAfter:null,validUntil:null,availabilityRequired:true,allowSuperscore:null,excludedFormats:[],detail:'成绩须在申请截止日前两年内取得；拼分政策待核实。',source:source(1,'Scores are valid for two years before the application deadline.')},
  graduationPolicy:{required:true,deadline:'2027-03-31',allowExpected:true,detail:'预计毕业者须在2027年3月31日前完成毕业。',source:source(1,'Graduation must be completed by March 31, 2027. Expected graduation is accepted.')},
  tuition:{status:'unspecified',amount:null,currency:'',period:'',detail:'学费未列明',source:{page:null,quote:''}},
  academicTests:{status:'optional',detail:'SAT和ACT可选',source:source(2,'SAT and ACT are optional.')},interview:{status:'conditional',detail:'必要时面试',source:source(2,'An interview may be required.')},
  combination:{parallel:'unspecified',reapply:'unspecified',materials:'未列明',referenceReuse:'未列明',source:{page:null,quote:''}},coverage:'已整理资格、语言、材料和申请轮次',
  doubts:[{path:'/languagePolicy/allowSuperscore',reason:'是否接受拼分未明确，请核对原文；入库后仍保留待核实。',source:source(2,'The document does not clarify whether superscores are accepted.')}]
 };
 const second=structuredClone(p);second.name='信息科学';second.englishName='Information Science';second.direction='计算机与工程';
 return {kind:'admissions',summary:'识别到同校2027年两个本科项目，完整要求待整体核对。',programs:[p,second],doubts:[]};
}
