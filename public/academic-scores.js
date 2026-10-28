import { detailInfoAttribute } from './detail-hints.js';
import { buildProgramLabels, programOriginalTitle, renderProgramScope, renderProgramLabel } from './program-presentation.js';
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

// Presentation only: unpublished/reference scores must not become hard minima
// or no-minimum rules in the stored program.
export function academicScoreDisplay(row,kind) {
  const status=row[kind+'Status'],text=row[kind+'Text']?.trim();
  if(row.placeholder)return '无要求';
  if(status==='not-accepted')return '不适用';
  if(status==='minimum'||status==='conditional')return text||'待核实';
  return '无要求';
}

export function renderAcademicScores(programs,ui,applies) {
  const {esc}=ui, sections=buildAcademicScoreTable(programs,ui.allPrograms||programs);
  const infoButton=(label,attribute)=>`<button type="button" class="info-hint" data-act="detail-info" ${attribute} aria-label="查看${esc(label)}说明" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>`;
  const hint=(label,parts)=>infoButton(label,detailInfoAttribute(()=>({label,parts}),ui));
  const labels=ui.programLabel?null:buildProgramLabels(programs);
  const displayLabel=ui.programLabel||(p=>labels.get(p.id)||p.name||p.id);
  const projectRows=new Map(programs.map(p=>[p.id,groupAcademicScores([p])]));
  const scope=ids=>applies?applies(ids):renderProgramScope(ids,programs,ui);
  const ref=source=>{
    const url=safeUrl(source?.url);
    return url?`<a href="${esc(url)}" target="_blank" rel="noopener">官方依据</a>`:source?.sourceId?ui.evidence(source):'';
  };
  const body=sections.map(({type,rows})=>{
    const cells=programs.map(p=>{
      const actual=projectRows.get(p.id).filter(row=>academicScoreType(row.qualification).id===type.id).map(row=>({...row,originalQualification:row.qualification,qualification:type.label}));
      return (actual.length?actual:rows.filter(row=>row.placeholder&&row.programs.includes(p.id))).map(row=>{
      const original=row.originalQualification!==row.qualification?row.originalQualification:'';
      const variant=row.variant||(actual.length>1?original:'');
      const label=[displayLabel(p),type.label,variant].filter(Boolean).join(' · ');
      const attribute=row.placeholder?'':detailInfoAttribute(()=>({label,parts:[
        {title:'原始课程名称',text:original},
        {title:'适用范围',text:row.variant},
        {title:'最低分',text:[admissionLabel[row.admissionStatus],row.admissionText].filter(Boolean).join('：')},
        {title:row.scholarshipName||'奖学金分',text:[scholarshipLabel[row.scholarshipStatus],row.scholarshipText].filter(Boolean).join('：')},
        {title:'科目与适用条件',text:row.conditions},...row.details,
        ...row.sources.map(s=>({title:s.url?'官方原文':`原文${s.page?' p.'+s.page:''}`,text:s.quote,sources:[s]}))
      ].filter(part=>part.text||part.sources?.length)}),ui);
      return {row,variant,info:attribute?infoButton(label,attribute):''};
      });
    });
    return `<tbody data-academic-score-type="${esc(type.id)}">${[['admission','最低分'],['scholarship','奖学金分']].map(([kind,label],index)=>`<tr data-score-kind="${kind}"><th scope="row" aria-label="${esc(type.label+' · '+label)}"><div class="academic-score-row-label">${index===0?`<span class="academic-score-course">${esc(type.label)}</span>`:''}<span class="academic-score-kind">${label}</span></div></th>${cells.map((entries,i)=>`<td data-score-program="${esc(programs[i].id)}">${entries.map(({row,variant,info})=>`<div data-academic-score="${esc(type.label)}" class="${row.placeholder?'academic-score-unlisted':ui.academicRowClass?.(row)||''}">${variant?`<small class="academic-score-variant">${esc(variant)}</small>`:''}<div class="academic-score-value"><span class="academic-score-number ${esc(row[kind+'Status']||'unspecified')}">${esc(academicScoreDisplay(row,kind))}</span>${info}</div></div>`).join('')}</td>`).join('')}<td class="academic-score-fill" aria-hidden="true"></td></tr>`).join('')}</tbody>`;
  }).join('');
  const gradeGroups=new Map();
  for(const p of programs)for(const row of p.academicTests?.scholarshipGrades||[]){
    const key=JSON.stringify([row.name,row.stage,row.status,row.text,row.conditions]);
    if(!gradeGroups.has(key))gradeGroups.set(key,{...row,programs:[],sources:[]});
    gradeGroups.get(key).programs.push(p.id);gradeGroups.get(key).sources.push(row.source);
  }
  const grades=[...gradeGroups.values()];
  return `<div class="academic-score-section"><div class="academic-score-heading"><h3>课程成绩与奖学金</h3><p>每项分为最低分、奖学金分；点击 i 查看条件与原文。</p></div><div class="qualification-scroll-frame">${programs.length>1?`<div class="qualification-scroll-tools"><span>${programs.length} 个项目逐列展示 · 左侧字段固定</span><label>左右查看 <input type="range" min="0" max="1000" value="0" data-qualification-scroll aria-label="左右滚动课程成绩项目对照表"></label></div>`:''}<div class="table-wrap qualification-scroll academic-score-scroll" tabindex="0" role="region" aria-label="课程成绩与奖学金项目对照表，可左右滚动"><table class="academic-score-table" style="--matrix-project-count:${programs.length}"><colgroup><col class="academic-score-name-column">${programs.map(()=>'<col class="academic-score-project-column">').join('')}<col></colgroup><thead><tr><th scope="col">课程／毕业资格</th>${programs.map(p=>`<th scope="col" data-academic-score-program="${esc(p.id)}"><a href="#program/${esc(p.id)}" title="${esc(programOriginalTitle(p))}">${renderProgramLabel(displayLabel(p),esc)}</a></th>`).join('')}<th class="academic-score-fill" aria-hidden="true"></th></tr></thead>${body}</table></div></div>${grades.length?`<details class="academic-scholarship-details"><summary>其他奖学金成绩要求（${grades.length} 项）</summary><div class="table-wrap"><table class="academic-scholarship-table"><thead><tr><th>奖学金</th><th>适用阶段</th><th>成绩与评审要求</th>${applies?'<th>适用项目</th>':''}</tr></thead><tbody>${grades.map(row=>`<tr><th scope="row">${esc(row.name)}</th><td>${esc(row.stage)}</td><td><strong>${esc(row.text)}</strong>${hint(row.name,[{title:'条件',text:row.conditions},{title:'原文',text:row.source?.quote}].filter(p=>p.text))}<span class="academic-score-sources">${unique(row.sources).map(ref).join(' ')}</span></td>${applies?`<td>${scope(row.programs)}</td>`:''}</tr>`).join('')}</tbody></table></div></details>`:''}<p class="academic-score-footnote">“无要求”表示资料未列具体分数线；是否接受该资格见上方资格表。奖学金仍须通过评审。</p></div>`;
}
