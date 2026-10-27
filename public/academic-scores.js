import { detailInfoAttribute } from './detail-hints.js';
import { renderProgramScope } from './program-presentation.js';
import { academicScoreType, buildAcademicScoreCatalog } from './academic-score-catalog.js';

export const academicScoreStatuses = ['minimum','no-minimum','unspecified','reference','conditional','not-accepted'];
export const scholarshipScoreStatuses = ['minimum','holistic','unspecified','not-applicable'];
const safeUrl = value => { try { const u=new URL(value); return u.protocol==='https:'?u.href:''; } catch { return ''; } };
const unique = rows => [...new Map(rows.filter(Boolean).map(row=>[JSON.stringify(row),row])).values()];

// The review lives inside the existing versioned program, beside academicTests.
// Empty/legacy records remain unknown; neither a diploma's pass mark nor another
// university's threshold can be substituted for this project's stated minimum.
export function academicScoreRows(program) {
  return (program.academicTests?.scoreDetails || []).map(row=>({...row,programs:[program.id],sources:unique([row.source,...(row.references||[])])}));
}
export function groupAcademicScores(programs) {
  const groups=new Map();
  for(const p of programs)for(const row of academicScoreRows(p)){
    const key=JSON.stringify([row.qualification,row.variant,row.admissionStatus,row.admissionText,row.scholarshipStatus,row.scholarshipText,row.scholarshipName,row.conditions]);
    if(!groups.has(key))groups.set(key,{...row,programs:[],sources:[],details:[]});
    const group=groups.get(key);group.programs.push(p.id);group.sources.push(...row.sources);
    for(const id of row.requirementIds||[]){const r=p.requirements?.find(r=>r.id===id);if(r)group.details.push({title:r.topic,text:r.detail,source:r.source});}
  }
  return [...groups.values()].map(row=>({...row,programs:[...new Set(row.programs)],sources:unique(row.sources),details:unique(row.details)}));
}

export function buildAcademicScoreTable(programs,allPrograms=programs) {
  const catalog=buildAcademicScoreCatalog([...allPrograms,...programs]),grouped=groupAcademicScores(programs);
  return catalog.map(type=>{
    const rows=grouped.filter(row=>academicScoreType(row.qualification).id===type.id).map(row=>({...row,originalQualification:row.qualification,qualification:type.label}));
    const covered=new Set(rows.flatMap(row=>row.programs));
    for(const unreviewed of [false,true]) {
      const missing=programs.filter(p=>!covered.has(p.id)&&(!Array.isArray(p.academicTests?.scoreDetails))===unreviewed);
      if(missing.length)rows.push({qualification:type.label,programs:missing.map(p=>p.id),placeholder:true,unreviewed,admissionStatus:'unspecified',scholarshipStatus:'unspecified',sources:[],details:[],conditions:unreviewed?'课程成绩尚未专项整理，请核对项目原文。':'现有资料未列明本项成绩要求，是否接受须核实。'});
    }
    return {type,rows};
  });
}
const admissionLabel={minimum:'最低要求','no-minimum':'明确不设最低分',unspecified:'资料未列最低分',reference:'参考成绩',conditional:'按个别录取条件','not-accepted':'不作为本项考试'};
const scholarshipLabel={minimum:'奖学金门槛',holistic:'综合评审',unspecified:'资料未列门槛','not-applicable':'不适用'};

export function renderAcademicScores(programs,ui,applies) {
  const {esc}=ui, sections=buildAcademicScoreTable(programs,ui.allPrograms||programs);
  const hint=(label,parts)=>`<button type="button" class="info-hint" data-act="detail-info" ${detailInfoAttribute(()=>({label,parts}),ui)} aria-label="查看${esc(label)}说明" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>`;
  const scope=ids=>applies?applies(ids):renderProgramScope(ids,programs,ui);
  const ref=source=>{
    const url=safeUrl(source?.url);
    return url?`<a href="${esc(url)}" target="_blank" rel="noopener">官方依据</a>`:source?.sourceId?ui.evidence(source):'';
  };
  const cell=(status,text,labels)=>`<span class="academic-score-status ${esc(status)}">${esc(labels[status]||labels.unspecified)}</span>${text?`<strong>${esc(text)}</strong>`:''}`;
  const body=sections.map(({type,rows})=>`<tbody data-academic-score-type="${esc(type.id)}">${rows.map(row=>{
    const original=row.originalQualification!==row.qualification?row.originalQualification:'';
    const variant=[row.variant,original].filter(Boolean).join(' · ');
    const parts=[{title:'原始课程名称',text:original},{title:'申请成绩',text:[admissionLabel[row.admissionStatus],row.admissionText].filter(Boolean).join('：')},{title:row.scholarshipName||'奖学金成绩',text:[scholarshipLabel[row.scholarshipStatus],row.scholarshipText].filter(Boolean).join('：')},{title:'完整适用条件',text:row.conditions},...row.details,...row.sources.filter(s=>s?.quote).map(s=>({title:s.url?'官方原文':`原文${s.page?' p.'+s.page:''}`,text:s.quote}))].filter(p=>p.text);
    const unknown=`<span class="academic-score-status unspecified">${row.unreviewed?'尚未专项整理':'未列明'}</span>`;
    return `<tr data-academic-score="${esc(row.qualification)}" class="${row.placeholder?'academic-score-unlisted':ui.academicRowClass?.(row)||''}"><th scope="row">${esc(row.qualification)}${variant?`<small>${esc(variant)}</small>`:''}</th><td>${row.placeholder?unknown:cell(row.admissionStatus,row.admissionText,admissionLabel)}</td><td>${row.placeholder?unknown:cell(row.scholarshipStatus,row.scholarshipText,scholarshipLabel)}${row.scholarshipName?`<small>${esc(row.scholarshipName)}</small>`:''}</td>${applies?`<td>${scope(row.programs)}</td>`:''}<td class="academic-score-notes"><span>${esc(row.conditions||'完整规定见说明')}</span>${row.placeholder?'':hint(row.qualification+(variant?' · '+variant:''),parts)}${row.sources.length?`<div class="academic-score-sources">${unique(row.sources.map(s=>({sourceId:s.sourceId,page:s.page,url:s.url}))).map(ref).filter(Boolean).join(' ')}</div>`:''}</td></tr>`;
  }).join('')}</tbody>`).join('');
  const gradeGroups=new Map();
  for(const p of programs)for(const row of p.academicTests?.scholarshipGrades||[]){
    const key=JSON.stringify([row.name,row.stage,row.status,row.text,row.conditions]);
    if(!gradeGroups.has(key))gradeGroups.set(key,{...row,programs:[],sources:[]});
    gradeGroups.get(key).programs.push(p.id);gradeGroups.get(key).sources.push(row.source);
  }
  const grades=[...gradeGroups.values()];
  const missing=programs.filter(p=>!Array.isArray(p.academicTests?.scoreDetails));
  return `<div class="academic-score-section"><div class="academic-score-heading"><h3>课程成绩与奖学金</h3><p>${sections.length} 项统一词条 · 分数和条件按项目核对；奖学金仍须通过评审。</p></div><div class="table-wrap"><table class="academic-score-table"><thead><tr><th>课程／毕业资格</th><th>申请最低成绩</th><th>奖学金成绩</th>${applies?'<th>适用项目</th>':''}<th>科目与适用条件</th></tr></thead>${body}</table></div>${missing.length?`<p class="academic-score-empty">以下项目尚未专项整理：${scope(missing.map(p=>p.id))}</p>`:''}${grades.length?`<details class="academic-scholarship-details"><summary>其他奖学金成绩要求（${grades.length} 项）</summary><div class="table-wrap"><table class="academic-scholarship-table"><thead><tr><th>奖学金</th><th>适用阶段</th><th>成绩与评审要求</th>${applies?'<th>适用项目</th>':''}</tr></thead><tbody>${grades.map(row=>`<tr><th scope="row">${esc(row.name)}</th><td>${esc(row.stage)}</td><td><strong>${esc(row.text)}</strong>${hint(row.name,[{title:'条件',text:row.conditions},{title:'原文',text:row.source?.quote}].filter(p=>p.text))}<span class="academic-score-sources">${unique(row.sources).map(ref).join(' ')}</span></td>${applies?`<td>${scope(row.programs)}</td>`:''}</tr>`).join('')}</tbody></table></div></details>`:''}<p class="academic-score-footnote">所有项目使用同一份词条；“未列明”或“资料未列”不等于零分、不要求或不接受。列出某课程不代表接受或可替代必交考试，仍须核对学历、科目、语言及期限，预估成绩须按规定补交最终结果。</p></div>`;
}
