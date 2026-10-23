import { applicationWindow } from './engine.mjs';
import { hasTuitionAmount, tuitionText } from '../public/tuition.js';
// Intent parsing never makes eligibility decisions. Queries only read reviewed rules.
export function parseQuery(text){
 const query={text,intake:null,exam:null,maxScore:null,academic:'any',interview:'any',direction:null,tuition:null,program:null,mode:'filter',clarification:null,unsupported:[]};
 const normalized=text.toLowerCase();
 const year=text.match(/20\d{2}/)?.[0];const month=/(9月|九月|秋季|秋入学)/.test(text)?'09':/(4月|四月|春季|春入学)/.test(text)?'04':null;
 if(year&&month)query.intake=`${year}-${month}`;else if(month)query.intake=`2027-${month}`;else if(year)query.year=Number(year);
 const exams=[[/托福|toefl/i,'TOEFL iBT'],[/雅思|ielts/i,'IELTS Academic Module'],[/多邻国|duolingo|\bdet\b/i,'Duolingo English Test'],[/托业|toeic/i,'TOEIC L&R'],[/\bpte\b/i,'PTE Academic']];
 for(const [rx,name] of exams)if(rx.test(text)){query.exam=name;const m=text.match(new RegExp('(?:'+rx.source+')(?:[^0-9]{0,8})([0-9]+(?:\\.[0-9]+)?)','i'));if(m&&Number(m[1])<2000)query.maxScore=Number(m[1]);break;}
 if(/只有|仅有|只用|只凭|仅凭/.test(text)&&query.exam&&!/不需要|不用|无需|不必/.test(text))query.clarification='“只有语言成绩”指哪一种条件？';
 if(/(不需要|不用|无需|不必|没有|无).{0,10}(SAT|ACT|学术考试|标化)/i.test(text))query.academic='not-required';
 if(/(不需要|不用|无需|无|不).{0,3}面试/.test(text))query.interview='not-required';else if(/面试/.test(text))query.mode='interview';
 if(/计算机|信息|工程|编程/.test(text))query.direction='计算机与工程';else if(/国际关系/.test(text))query.direction='国际关系';else if(/政策|社区/.test(text))query.direction='社会与政策';
 if(/学费|费用|预算/.test(text)){query.mode='tuition';const m=text.match(/(\d+(?:\.\d+)?)(万)?\s*(日元|JPY)/i);if(m)query.tuition=Number(m[1])*(m[2]?10000:1);}
 for(const id of ['GLA','JDP','CRPS','ISSE','GS'])if(new RegExp(`\\b${id}\\b`,'i').test(text))query.program=id;
 if(/豁免|免语言|免托福/.test(text))query.mode='waiver';
 if(/推荐信/.test(text))query.mode='reference';else if(/文书/.test(text))query.mode='essay';else if(/年龄|18岁|未成年/.test(text))query.mode='age';
 if(/正在申请|开放|截止|还能申请/.test(text))query.openOnly=true;
 const supported=query.exam||query.program||query.direction||query.mode!=='filter'||query.intake||query.year||query.academic!=='any'||query.interview!=='any'||query.openOnly||/全部|所有|项目|立命馆|学校/.test(text);
 if(!supported||/录取率|录取概率|排名|住宿|奖学金|庆应|早稻田|东京大学/.test(text))query.unsupported.push('问题包含当前规则库未覆盖的内容。请限定为已收录项目的申请要求。');
 if(/(?:SAT|ACT|GPA|IB)\s*(?:总分|成绩|分数)?\s*\d|A[- ]?Level.{0,5}(?:A\*|AAA|AAB)|(?:不需要|无需|不用).{0,3}(?:推荐信|文书)|国籍|签证|居留/.test(text))query.unsupported.push('此问题含当前自动检索尚未支持的精细条件，请在学生匹配或项目详情逐项核对；未自动忽略这些条件。');
 return query;
}
export function queryPrograms(query,programs,now=new Date()){
 const matched=[],uncertain=[];
 for(const p of programs){
  if(query.program&&p.id!==query.program||query.direction&&p.direction!==query.direction||query.year&&p.year!==query.year)continue;
  const rounds=p.rounds.filter(r=>!query.intake||r.intake===query.intake);if(query.intake&&!rounds.length)continue;
  const reasons=[],sources=[];let unknown=false;
  if(query.openOnly){const windows=rounds.map(r=>applicationWindow(r,now));if(!windows.some(w=>w.status==='open')){if(!windows.length||windows.some(w=>w.status==='unknown')){unknown=true;reasons.push('申请时间待核实');}else continue;}}
  let tests=p.language.filter(x=>!query.exam||x.exam===query.exam);
  if(query.exam){if(!tests.length)continue;if(query.maxScore!==null&&query.maxScore!==undefined){tests=tests.filter(l=>(l.exam!=='TOEFL iBT'||(query.maxScore<=6?l.scale==='1–6':l.scale==='0–120'))&&(typeof l.score!=='number'||l.score<=query.maxScore));if(!tests.length)continue;if(!tests.some(l=>typeof l.score==='number'||l.minimumStatus==='no-minimum'))unknown=true;}reasons.push(tests.map(l=>`${l.exam}${l.exam==='TOEFL iBT'?`（${l.scale}）`:''} ${typeof l.score==='number'?'≥ '+l.score:l.minimumStatus==='no-minimum'?'不设最低分':'最低分未注明'}`).join('；'));sources.push(...tests.map(l=>l.source));}
  if(query.academic==='not-required'){if(p.academicTests.status==='required')continue;if(!['optional','not-required'].includes(p.academicTests.status))unknown=true;reasons.push(p.academicTests.status==='optional'?'SAT／ACT等学术考试为可选材料':p.academicTests.status==='not-required'?'明确不要求学术考试':'学术考试要求未注明');sources.push(p.academicTests.source);}
  if(query.interview==='not-required'){if(p.interview.status==='required'||p.interview.status==='conditional')continue;if(p.interview.status!=='not-required')unknown=true;}
  const budgetSpecified=query.tuition!==null&&query.tuition!==undefined;
  if(query.mode==='tuition'||budgetSpecified){
   const comparable=p.tuition.status==='published'&&hasTuitionAmount(p.tuition)&&p.tuition.currency==='JPY'&&p.tuition.period==='学年';
   if(budgetSpecified&&comparable&&p.tuition.amount>query.tuition)continue;
   reasons.push(tuitionText(p.tuition,p.year));
   if(p.tuition.status!=='published'||budgetSpecified&&!comparable){unknown=true;reasons.push('须核实适用收费标准、币种和周期，无法直接按年度预算筛选');}
   sources.push(p.tuition.source);
  }
  if(query.mode==='waiver'){reasons.push(...p.waivers.map(w=>w.label));sources.push(...p.waivers.flatMap(w=>w.all.map(c=>c.source)));}
  if(query.mode==='reference'||query.mode==='essay'){const rows=p.requirements.filter(r=>query.mode==='reference'?/推荐/.test(r.topic):/文书/.test(r.topic));reasons.push(...rows.map(r=>r.detail));sources.push(...rows.map(r=>r.source||({sourceId:p.sourceIds?.[0],page:r.page,ruleId:r.id,quote:r.evidence})));}
  if(query.mode==='age'){if(p.semanticVersion===1){const rows=[...p.paths.flatMap(path=>path.all),...p.hardConditions].filter(r=>r.field==='ageAtEnrollment');if(rows.length){reasons.push(...rows.map(r=>r.label+(r.referenceDate?'；基准日 '+r.referenceDate:'')));sources.push(...rows.map(r=>r.source));}else{unknown=true;reasons.push('未找到可确认的年龄要求，请核对完整资格路径');}}else{reasons.push('18岁限制仅适用于G／H／I路径；其他学历路径不能自动套用。');sources.push({sourceId:p.sourceIds?.[0],page:5,ruleId:'R009–R011'});}}
  if(query.mode==='interview'||!reasons.length){reasons.push(p.interview.detail);sources.push(p.interview.source);}
  (unknown?uncertain:matched).push({id:p.id,name:p.name,school:p.school,version:p.version,reasons,sources,rounds:rounds.map(r=>({intake:r.intake,period:r.period,end:r.applyEnd})),note:'仍须满足学历路径及其他适用条件；成绩有效期、单项和考试形式需结合学生核对。'});
 }
 return {query,matched,uncertain,coverage:`已收录 ${programs.length} 个项目，${[...new Set(programs.map(p=>p.school))].join('、')}，${[...new Set(programs.map(p=>p.year))].join('、')}年度`,answeredAt:now.toISOString()};
}
export function parseStudentText(text){
 const fields={},notes=[];
 const name=text.match(/(?:姓名[:：]?\s*)([\u4e00-\u9fa5A-Za-z·]{2,20})/);if(name)fields.name=name[1];
 if(/中国籍|中国国籍/.test(text))fields.nationalities=['中国'];
 const birth=text.match(/(?:出生|生日)[:：]?\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);if(birth)fields.birthDate=`${birth[1]}-${birth[2].padStart(2,'0')}-${birth[3].padStart(2,'0')}`;
 const graduate=text.match(/(20\d{2})[年\/-](\d{1,2})月?(?:毕业|预计毕业)/);if(graduate){fields.graduationDate=`${graduate[1]}-${graduate[2].padStart(2,'0')}-01`;notes.push('只识别到毕业月份，日期暂填当月1日，必须核对具体日期。');}
 if(/已毕业/.test(text))fields.educationStatus='completed';else if(/预计|预毕业/.test(text))fields.educationStatus='expected';else if(/在读/.test(text))fields.educationStatus='studying';
 if(/IB\s*Diploma|IB文凭/i.test(text)){fields.qualification='IB Diploma';fields.curriculum='IB';}else if(/A[- ]?Level/i.test(text)){fields.curriculum='A-Level';notes.push('A-Level考试局及GCE／International版本须手工选择。');}else if(/普通高中|普高/.test(text)){fields.qualification='普通高中';fields.curriculum='普通高中';}
 const q=parseQuery(text);if(q.intake)fields.intake=q.intake;if(q.exam&&q.maxScore!==null)fields.exams=[{id:crypto.randomUUID(),exam:q.exam,score:q.maxScore,status:'actual'}];
 if(!Object.keys(fields).length)notes.push('未能可靠识别，请使用下方表单录入。');
 notes.push('仅整理明确写出的信息；12年学制、国籍身份、考试日期、版本、单项和豁免条件须员工核对。');
 return {fields,notes,mode:'local'};
}
