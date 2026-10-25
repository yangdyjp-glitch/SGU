import { renderLanguageScoreTable } from './score-table.js';
import { renderInfoHint } from './detail-hints.js';
import { tuitionText } from './tuition.js';
import { renderReadableText } from './plain-language.js';
import { renderAcademicScores } from './academic-scores.js';

export const admissionLabels={school:'学校',year:'入学年份',name:'项目名称',channel:'招生方式',paths:'学历资格',hardConditions:'身份与附加条件',language:'语言成绩',languageRequirement:'英语证明要求',waivers:'语言豁免',rounds:'申请轮次',materials:'申请材料',requirements:'全部要求',languagePolicy:'成绩有效期与形式',graduationPolicy:'资格取得时间',academicTests:'学术考试',interview:'选拔方式',tuition:'学费',combination:'同时申请与再次申请',coverage:'整理范围'};
export const sourceUrl=source=>`${source?.sourceId==='aohb27'?'/sources/aohb27.pdf':'/uploads/'+encodeURIComponent(source?.sourceId||'')}${source?.page?'#page='+parseInt(source.page):''}`;
export function sourceLink(source,esc){return source?.sourceId?`<a class="admission-source" href="${sourceUrl(source)}" target="_blank" rel="noopener" title="${esc(source.quote||'打开原文件')}">${source.page?'原文 p.'+esc(source.page):'查看原文'}</a>`:'';}
const setting=value=>value===null||value===undefined||value===''?'未注明':value===true?'是':value===false?'否':String(value);
const policyLabels={'required':'必需','not-required':'明确不要求','optional':'可选','conditional':'按条件要求','unspecified':'未注明','allowed':'允许','forbidden':'不允许'};
const ruleText=r=>{
 const label=r.label||'条件待核实';
 if(typeof r.value==='number'&&!label.includes(String(r.value)))return label+' '+({gte:'≥',lte:'≤',eq:'=',neq:'≠'}[r.op]||'')+' '+r.value;
 if(Array.isArray(r.value)&&!r.value.every(v=>label.includes(v)))return label+'（'+r.value.join(' / ')+'）';
 if(typeof r.value==='string'&&r.value&&!label.includes(r.value))return label+'（'+r.value+'）';
 return label;
};

export function readableAdmissionValue(value){
 if(value===null||value===undefined||value==='')return '未注明';
 if(Array.isArray(value))return value.length?value.map(readableAdmissionValue).join('\n'):'未列出';
 if(typeof value!=='object')return policyLabels[value]||setting(value);
 if(value.all)return value.label+'：'+value.all.map(ruleText).join(' 且 ');
 if(value.exam)return `${value.exam}：${value.score===null?'最低分未注明':'≥ '+value.score}（${value.basis}）`+['reading','listening','writing','speaking'].map((key,i)=>value[key]===null||value[key]===undefined?'':`；${['阅读','听力','写作','口语'][i]} ${value[key]}`).join('')+(value.note?'；'+value.note:'');
 if(Object.hasOwn(value,'applyEnd'))return `${value.intake||'入学期待定'} 第${value.period}轮：${value.applyStart||'待定'} 至 ${value.applyEnd||'待定'}；${value.note||''}`;
 if(value.field)return ruleText(value);
 if(value.qualification&&value.admissionStatus)return `${value.qualification}${value.variant?'（'+value.variant+'）':''}：申请 ${value.admissionText||'未列最低分'}；奖学金 ${value.scholarshipText||'未列成绩门槛'}；${value.conditions||''}`;
 if(value.topic)return `${value.stage||''} ${value.topic}：${value.detail}`;
 if(value.label)return value.label+(value.note?'：'+value.note:'');
 if(Object.hasOwn(value,'amount')&&Object.hasOwn(value,'currency')&&Object.hasOwn(value,'period'))return tuitionText(value);
 return [value.detail,...Object.entries(value).filter(([k])=>!['detail','source','sourceIds','id','page','evidence'].includes(k)).map(([k,v])=>`${admissionLabels[k]||({validYears:'有效年限',validAfter:'有效起日',validUntil:'有效止日',availabilityRequired:'截止前可取得',allowSuperscore:'允许拼分',excludedFormats:'不接受形式',required:'必需',deadline:'截止日期',allowExpected:'接受预计取得',status:'状态',amount:'金额',currency:'币种',period:'周期',parallel:'并申',reapply:'重申',materials:'材料复用',referenceReuse:'推荐信复用'})[k]||k}：${readableAdmissionValue(v)}`)].filter(Boolean).join('；');
}

export function renderAdmissionContent(p,ui,issues=[]){
 const {esc}=ui;
 const marked=path=>issues.some(i=>i.path===path||i.path?.startsWith(path+'/')||path.startsWith(i.path+'/'))?' admission-doubt':'';
 const source=s=>sourceLink(s,esc);
 const copy=value=>renderReadableText(value,esc,{expandable:false});
 const section=(key,title,body)=>`<section class="admission-section${Array.isArray(p[key])?(issues.some(i=>i.path==='/'+key)?' admission-doubt':''):marked('/'+key)}" data-admission-section="${key}"><h4>${title}</h4>${body}</section>`;
 const lines=(rows,key,render)=>rows.length?rows.map((row,i)=>`<div class="admission-line${marked('/'+key+'/'+i)}">${render(row)} ${source(row.source)}</div>`).join(''):'<p class="muted small">原文未列明</p>';
 const paths=lines(p.paths,'paths',row=>`<strong>${esc(row.label)}</strong><span>${row.all.length?row.all.map(r=>`${copy(ruleText(r))}${r.referenceDate?`（基准日 ${esc(r.referenceDate)}）`:''}`).join('；且 '):'具体条件待核实'}</span>`);
 const scoreUI={...ui,evidence:source,scoreRowClass:(_row,i)=>marked('/language/'+i)};
 const language=section('language','语言考试',`<p class="muted small">英语证明：${esc(policyLabels[p.languageRequirement])}。总分及已列出的单项须同时满足；未注明不等于不要求。</p>${p.language.length?renderLanguageScoreTable(p.language,scoreUI):'<p class="muted small">未列出考试门槛</p>'}`);
 const policy=(key)=>{
  const value=key==='academicTests'?Object.fromEntries(Object.entries(p[key]||{}).filter(([k])=>!['scoreDetails','scholarshipGrades','scoreReview'].includes(k))):p[key],detail=value?.detail;
  // Keep every field available for review without printing a long explanation
  // and the same policy fields as one unreadable sentence.
  const body=detail?`${copy(detail)}${Object.keys(value).some(k=>!['detail','source'].includes(k))?`<details class="policy-facts" ${marked('/'+key)?'open':''}><summary>补充信息</summary><p>${copy(readableAdmissionValue({...value,detail:undefined}))}</p></details>`:''}`:copy(readableAdmissionValue(value));
  const scores=key==='academicTests'&&(p[key]?.scoreDetails?.length||p[key]?.scholarshipGrades?.length)?renderAcademicScores([p],{...ui,evidence:source,academicRowClass:row=>marked('/academicTests/scoreDetails/'+p.academicTests.scoreDetails.findIndex(r=>r.id===row.id))}):'';
  return section(key,admissionLabels[key],`<div>${body} ${source(value?.source)}</div>${scores}`);
 };
 const waivers=section('waivers','语言豁免',lines(p.waivers,'waivers',row=>`<strong>${esc(row.label)}</strong>${renderInfoHint(row.label,row.all.map(r=>({text:ruleText(r)+(r.referenceDate?'；基准日 '+r.referenceDate:'')})),esc)}`));
 const rounds=section('rounds','申请轮次',p.rounds.length?`<div class="table-wrap"><table class="admission-rounds"><thead><tr><th>入学期 / 轮次</th><th>申请开始</th><th>申请截止</th><th>入学日期</th><th>初筛 / 面试 / 结果</th><th>备注</th></tr></thead><tbody>${p.rounds.map((r,i)=>`<tr class="${marked('/rounds/'+i)}"><td>${esc(r.intake||'待确定')} · 第${esc(r.period)}轮</td><td>${esc(r.applyStart||'待确定')} ${esc(r.startTime||'')}</td><td>${esc(r.applyEnd||'待确定')} ${esc(r.endTime||'')}</td><td>${esc(r.enrollmentDate||'待确定')}</td><td>${[r.first,r.interview,r.final].map(v=>esc(v||'未注明')).join(' / ')}</td><td>${esc([r.timezone,r.note].filter(Boolean).join('；'))} ${source(r.source)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted small">未列出申请轮次，暂不生成轮次匹配。</p>');
 const materials=section('materials','申请材料',lines(p.materials,'materials',m=>`<strong>${esc(m.label)}</strong><span>${esc(m.stage)} · ${m.required===true?'必需':m.required===false?'选交':'必要性待核实'}${m.when?'；适用条件：'+esc(ruleText(m.when)):''}${m.note?'；'+copy(m.note):''}</span>`));
 const requirements=section('requirements','完整招生条款',lines(p.requirements,'requirements',r=>`<strong>${esc(r.stage)} · ${esc(r.topic)}</strong><span>${copy(r.detail)} <small class="muted">${esc(r.nature)}</small></span>`));
 return `<div class="admission-content">${section('paths','学历资格（任选一条，条内条件同时满足）',paths)}${section('hardConditions','身份与附加条件',lines(p.hardConditions,'hardConditions',r=>copy(ruleText(r))))}${policy('graduationPolicy')}${language}${policy('languagePolicy')}${waivers}${materials}${rounds}${policy('academicTests')}${policy('interview')}${policy('tuition')}${policy('combination')}${requirements}${p.coverage?`<p class="muted small">整理范围：${esc(p.coverage)}</p>`:''}</div>`;
}
