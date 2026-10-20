import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(new URL('../data/admissions-source.json', import.meta.url), 'utf8'));
export const source = { id: 'aohb27', name: '立命馆大学 2027 AO 英语本科招生手册', filename: 'aohb27.pdf', pages: 23, year: 2027, importedAt: '2026-10-21', notes: '来源为用户提供的手册及已核对分析表；各条目保留手册页码。', url: '/sources/aohb27.pdf' };
export const sourceRows = raw.R;
const names = {GLA:'全球教养学',JDP:'美日联合国际关系',GS:'全球研究',CRPS:'社区与区域政策',ISSE:'信息系统科学与工程'};
const directions = {GLA:'人文与综合',JDP:'国际关系',GS:'国际关系',CRPS:'社会与政策',ISSE:'计算机与工程'};
const ignored = new Set([30,36,68,69,88,89,94,95,96,97,98,99,100,101,102,103,105,106,108,109,113,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135]);
const ref = (id) => { const r=raw.R.find(r=>r.id===id); return {sourceId:source.id,page:r.page,quote:r.evidence,ruleId:id}; };
const atom=(field,op,value,label,ruleId='R003',extra={})=>({field,op,value,label,source:ref(ruleId),...extra});
const complete = atom('educationStatus','in',['completed','expected'],'资格已取得，或预计在入学前取得','R002');
const age=atom('ageAtEnrollment','gte',18,'入学前达到18岁','R009');
const eduPaths=[
 {id:'A',label:'标准12年教育',source:ref('R003'),all:[atom('standard12','eq',true,'标准12年课程或MEXT认定等同课程'),complete]},
 {id:'B',label:'认证国际学校12年课程',source:ref('R004'),all:[atom('international12','eq',true,'完成12年国际学校课程','R004'),atom('accreditation','in',['WASC','NEASC','Cognia','COBIS','CIS','ACSI'],'学校认证符合指定机构','R004'),complete]},
 {id:'C',label:'日本境内MEXT指定国际学校',source:ref('R005'),all:[atom('japanDesignated12','eq',true,'日本境内MEXT认可国际学校12年课程','R005'),complete]},
 {id:'D',label:'IB / A-Level 等完整资格',source:ref('R006'),all:[atom('qualification','in',['IB Diploma','Abitur','Baccalaureate','GCE A-Level','International A-Level','European Baccalaureate'],'持有指定完整资格','R006'),complete]},
 {id:'E',label:'MEXT指定11年课程',source:ref('R007'),all:[atom('designated11','eq',true,'学校及课程已核实属于MEXT指定11年教育','R007'),complete]},
 {id:'F',label:'短学制与指定预备教育',source:ref('R008'),all:[atom('shortSchool','eq',true,'完成少于12年的本国学校教育','R008'),atom('preparatory','eq',true,'完成MEXT指定大学预备课程','R008'),complete]},
 {id:'G',label:'海外12年教育同等学力考试',source:ref('R009'),all:[atom('equivalency','eq',true,'通过GED等12年教育同等学力考试','R009'),age,complete]},
 {id:'H',label:'日本高卒认定',source:ref('R010'),all:[atom('japanEquivalency','eq',true,'通过日本高卒认定考试','R010'),{...age,source:ref('R010')},complete]},
 {id:'I',label:'大学个别资格认定',source:ref('R011'),all:[atom('individualReview','eq',true,'已取得RU个别资格认定，或符合原文明确认可的资格','R011'),{...age,source:ref('R011')},complete]}
];
const sixYearWaiver={id:'six-year',label:'入学日前最近6年仅英语教育',all:[atom('waiver.sixYears','eq',true,'最近6年全部正式教育仅用英语，范围已核对','R027')]};
function materials(id) {
 const shared=[['graduation','毕业／预计毕业证明','R041'],['transcript','学业成绩单','R049'],['english','英语成绩／豁免证明','R017'],['essay','申请文书','R070'],['reference','推荐信','R080'],['identity','护照／替代身份证明','R038'],['photo','证件照片','R079']].map(([key,label,rule])=>({id:key,label,required:true,stage:'申请',source:ref(rule)}));
 shared.find(x=>x.id==='essay').label=`英文申请文书 ${['CRPS','ISSE'].includes(id)?3:1} 篇`;
 shared.find(x=>x.id==='reference').label=`推荐信 ${id==='ISSE'?2:1} 封`;
 shared.find(x=>x.id==='reference').source=ref(id==='ISSE'?'R081':'R080');
 shared.push({id:'residence',label:'在留卡正反面（适用时）',required:true,stage:'申请',when:{field:'inJapanResident',op:'eq',value:true},source:ref('R084')});
 if(id==='ISSE')shared.push({id:'awards',label:'数学／科学／编程奖项',required:false,stage:'申请',source:ref('R087')});
 if(id==='JDP')shared.push({id:'finance',label:'赴美财力证明 CFIS',required:true,stage:'赴AU前',note:'2026–2027学年参考金额71,022 USD；不等于2027学费，后续年份须核实。',source:ref('R107')});
 return shared;
}
export function seedPrograms(){return raw.P.map(p=>{
 const id=p[0];
 const rules=raw.R.filter(r=>r.scope.split(/\s*\/\s*|（/).includes(id)&&!ignored.has(Number(r.id.slice(1))));
 return {id,school:'立命馆大学',name:names[id],englishName:p[1],direction:directions[id],year:2027,channel:'AO Admissions (English Basis)',degree:['GLA','JDP'].includes(id)?'联合／双学位':'学士',partner:id==='GLA'?'澳大利亚国立大学':id==='JDP'?'美国大学（American University）':null,version:1,
 rounds:raw.T.filter(t=>t.project===id).map(t=>({...t,enrollmentDate:t.intake.endsWith('04')?'2027-04-01':'2027-09-26',startTime:'10:00',endTime:'23:00',timezone:'Asia/Tokyo',source:{sourceId:source.id,page:'4,19–20',quote:'Application Period',ruleId:'R031'}})),
 paths:eduPaths.filter(x=>id!=='JDP'||!['F','H'].includes(x.id)),
 hardConditions:id==='JDP'?[atom('japanVocationalOnly','eq',false,'不是仅以専修学校高等课程毕业资格申请','R013')]:[],
 language:raw.L.filter(l=>l.project===id).map(l=>({...l,source:{sourceId:source.id,page:l.page,quote:`${l.exam} ${l.score}`,ruleId:l.id}})),
 languagePolicy:{validYears:2,availabilityRequired:true,allowSuperscore:false,excludedFormats:['home','essentials','online','one-skill','institutional'],source:ref('R016')},
 waivers:id==='GLA'?[
 {id:'ib-english',label:'IB Diploma 全英语教学与考核',all:[atom('qualification','eq','IB Diploma','IB完整文凭资格','R023'),atom('waiver.ibEnglish','eq',true,'IB教学与考核全英语（语言课程例外）','R023')]},
 {id:'group-a',label:'Group A 国籍及高中教育',all:[atom('waiver.groupACitizen','eq',true,'Group A 国籍已按原文名单核对','R021'),atom('waiver.groupAEducation','eq',true,'指定体系认可机构Year 11/12至少1年全英语教育','R021')]}
 ]:id==='JDP'?[
 {id:'jdp-curriculum',label:'指定课程／教育体系4年英语教育',all:[atom('waiver.jdpFourYears','eq',true,'Grade 9–12四年全英语，课程／教育体系已核对','R024'),atom('waiver.noESL','eq',true,'没有修读ESL课程','R024')]}
 ]:[sixYearWaiver],
 australianRestriction:id==='GLA',
 tuition:{status:'unspecified',amount:null,currency:'JPY',period:'学年',year:2027,source:{sourceId:source.id,page:'19–21',quote:'2027 tuition not specified in this handbook',ruleId:'F024'}},
 academicTests:{status:'optional',source:ref('R085')},
 interview:{status:id==='GLA'?'not-required':id==='GS'?'conditional':'required',detail:p[7],source:ref(id==='GLA'?'R090':id==='GS'?'R092':'R091')},
 combination:{parallel:'allowed',reapply:'allowed',referenceReuse:'同一入学年度可复用；ISSE需2封',materials:'每个项目、每轮分别提交材料',source:ref('R032')},
 materials:materials(id),requirements:rules,sourceIds:[source.id],coverage:'本手册所列2027年AO英语本科招生条件',reviewed:true,reviewNote:'根据已完成的135条原文分析及2026-10-21确认范围初始化。'};
});}

export function exampleStudents(){return [
 {id:'sample-lin',name:'林同学',isExample:true,nationalities:['中国'],birthDate:'2008-06-12',residence:'中国',inJapanResident:false,australianDomestic:false,otherNationality:true,intake:'2027-09',direction:'',budget:null,qualification:'IB Diploma',educationStatus:'expected',graduationDate:'2027-06-30',standard12:true,japanVocationalOnly:false,school:'示例国际高中',curriculum:'IB',waiver:{ibEnglish:true,sixYears:false},exams:[{id:'sample-exam-1',exam:'IELTS Academic Module',score:6.5,reading:6.5,listening:7,writing:6,speaking:6,scale:'IELTS',date:'2026-08-18',availableDate:'2026-08-25',format:'center',status:'actual'}],materials:{transcript:'ready',identity:'ready',photo:'todo',essay:'todo',reference:'todo',graduation:'todo',english:'ready'},candidates:[],notes:'虚构示例，用于了解预计毕业与英语豁免。'},
 {id:'sample-chen',name:'陈同学',isExample:true,nationalities:['中国'],birthDate:'2008-03-06',residence:'中国',inJapanResident:false,australianDomestic:false,intake:'2027-04',direction:'计算机与工程',qualification:'普通高中',educationStatus:'completed',graduationDate:'2026-06-30',standard12:true,japanVocationalOnly:false,school:'示例普通高中',curriculum:'普通高中',waiver:{sixYears:false,ibEnglish:false,jdpFourYears:false},exams:[{id:'sample-exam-2',exam:'TOEFL iBT',score:4,reading:4,listening:4,writing:4,speaking:3.5,scale:'1–6',date:'2026-07-12',availableDate:'2026-07-20',format:'center',status:'actual'}],materials:{identity:'ready',transcript:'ready'},candidates:[],notes:'虚构示例：资格与申请窗口分别显示。'},
 {id:'sample-wang',name:'王同学',isExample:true,nationalities:['中国'],intake:'2027-09',school:'待补充',curriculum:'A-Level',qualification:'International A-Level',educationStatus:'expected',graduationDate:'2027-08-15',standard12:null,waiver:{},exams:[],materials:{},candidates:[],notes:'虚构示例，用于查看信息不足时的结果。'}
];}
