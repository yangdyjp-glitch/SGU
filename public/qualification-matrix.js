import { buildProjectView, pathDescription } from './requirement-model.js';
import { renderInfoHint, detailInfoAttribute } from './detail-hints.js';
import { programLabel } from './imported-requirement-model.js';
import { renderProgramScope } from './program-presentation.js';
import { baseQualifications, educationGroups, educationDisplayGroups, normalizeName as normal, qualificationVariant, canonicalAccreditor, commonAccreditors, qualificationHint } from './education-model.js';
import {educationPathTypesFor, educationPathKey, educationLabelKey, qualificationCatalogKey, educationCredentialType, fallbackDisplayGroup, unclassifiedDisplayGroup, extraAccreditorLabel} from './education-catalog.js';
export { baseQualifications } from './education-model.js';

// The shared catalogue names qualifications, not school-specific A/B/C paths.
// Acceptance is derived from each live program's rules; the matching engine
// continues to evaluate every AND condition within every eligible alternative.

const positiveValues = atom => atom.op === 'in' && Array.isArray(atom.value) ? atom.value : atom.op === 'eq' ? [atom.value] : [];
const sameValue = (a, b) => normal(a) === normal(b);
const matchesValue=(item,value)=>item.field==='qualification'?qualificationCatalogKey(value)===item.id||item.values?.some(v=>sameValue(v,value)):item.field==='accreditation'?item.values?.some(v=>canonicalAccreditor(v)===canonicalAccreditor(value)):item.values?.some(v=>sameValue(v,value));
const unique = values => [...new Set(values)];
function groupScopeNotes(cells){
  const groups=new Map();
  for(const cell of cells.filter(cell=>cell.scopeNote)){
    if(!groups.has(cell.scopeNote))groups.set(cell.scopeNote,{text:cell.scopeNote,summary:cell.scopeSummary,programs:[]});
    groups.get(cell.scopeNote).programs.push(cell.programId);
  }
  return [...groups.values()];
}

// Some guides separate general school education from named curriculum entry
// requirements. Include those explicit, sourced requirements in the overview;
// they are NOT new OR paths and must never change student matching rules.
function curriculumRequirements(item, program) {
  if (program.semanticVersion !== 1 || item.field !== 'qualification') return [];
  const aliases = item.values.map(normal);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (program.requirements || []).filter(row => {
    if (!['硬性','附条件'].includes(row.nature) || !/^申请(?:$|阶段$|时$)/.test(row.stage || '') || !row.detail?.trim() || !row.source?.quote?.trim()) return false;
    const headings = row.topic.replace(/^\s*[（(]?[a-z\d]+[)）.、]\s*/i, '').split(/[／/、]/).map(part => normal(part.replace(/(?:体系|课程|学历|文凭|资格|成绩|入学|申请|条件|要求)+$/g, '').trim()));
    if (!aliases.some(alias => headings.includes(alias))) return false;
    const quote = normal(row.source.quote), detail = normal(row.detail);
    if (!aliases.some(alias => quote.includes(alias))) return false;
    return !aliases.some(alias => {
      const name = escape(alias);
      return new RegExp(`(?:不接受|不认可|不适用|未列明|不得|不能|不可)(?:以|凭|使用)?${name}|${name}(?:资格|文凭|体系|课程|申请者|申请人|考生)?(?:不被接受|不能申请|不适用|不符合|isnotaccepted|arenotaccepted|notaccepted|noteligible)`, 'i').test(detail);
    });
  });
}

export function buildQualificationCatalog(programs) {
  const result = baseQualifications.map(item => ({ ...item, ...(item.values?{values:[...item.values]}:{}) }));
  const coveredFields = new Set([...result.flatMap(item => item.fields||[item.field]), 'educationStatus', 'ageAtEnrollment', 'shortSchool']);
  for (const p of programs) for (const path of p.paths || []) for (const atom of path.all || []) {
    if (['qualification', 'accreditation'].includes(atom.field)) {
      for (const value of positiveValues(atom).filter(value => typeof value === 'string')) {
        const route=atom.field==='qualification'&&educationCredentialType(value);
        if(route){
          let item=result.find(row=>row.id===route.id);
          if(!item){item={...route};result.push(item);}
          item.qualificationValues=unique([...(item.qualificationValues||[]),value]);
          continue;
        }
        const label=atom.field==='accreditation'?extraAccreditorLabel(value):value;
        const existing=result.find(item=>item.field===atom.field&&(matchesValue(item,value)||atom.field==='accreditation'&&item.id===`accreditation:${normal(label)}`));
        if(existing){if(!existing.values.includes(value))existing.values.push(value);}
        else result.push({ id: atom.field==='qualification'?qualificationCatalogKey(value):`${atom.field}:${normal(label)}`, label, field: atom.field, values: [value],group:atom.field==='accreditation'?'other':'curriculum',subgroup:atom.field==='accreditation'?'其他认证机构':'其他原始资格' });
      }
    } else if (!atom.field.startsWith('verification.') && !coveredFields.has(atom.field) && atom.op === 'eq' && atom.value === true) {
      result.push({ id: `condition:${atom.field}`, label: atom.label || atom.field, field: atom.field,group:'education' });
      coveredFields.add(atom.field);
    }
  }
  const pathKeys=new Map();
  for(const p of [...programs].sort((a,b)=>a.id.localeCompare(b.id)))for(const path of p.paths||[]){
    if(result.some(item=>matchingAtoms(item,path,p).length))continue;
    let types=educationPathTypesFor(path);
    if(!types.length){
      const known=result.find(item=>[item.label,...item.values||[],...item.originalLabels||[]].some(name=>educationLabelKey(name)===educationLabelKey(path.label)));
      types=[known||pathKeys.get(educationPathKey(path))||{id:'path:'+normal(path.label||path.id),label:path.label||'其他原始资格',group:'education',subgroup:'其他原始教育路径'}];
    }
    for(const type of types){
      let item=result.find(row=>row.id===type.id);
      if(!item){item={...type};result.push(item);}
      ((item.localPaths??={})[p.id]??=[]).push(path.id);
      item.originalLabels=unique([...(item.originalLabels||[]),path.label].filter(Boolean));
      pathKeys.set(educationPathKey(path),item);
    }
  }
  return result.map(item=>{
    const displayGroup=fallbackDisplayGroup(item);
    return displayGroup?{...item,displayGroup,needsClassification:true}:item;
  });
}

function matchingAtoms(item, path, program) {
  const direct=(path.all || []).filter(atom => {
    if(atom.field==='qualification'&&item.qualificationValues?.some(name=>positiveValues(atom).some(value=>sameValue(name,value))))return true;
    if (!(item.fields||[item.field]).includes(atom.field)&&!(item.mext&&atom.field==='standard12')) return false;
    if (item.values) return positiveValues(atom).some(value => matchesValue(item,value));
    if (atom.op !== 'eq' || atom.value !== true) return false;
    if (item.mext&&atom.field==='standard12') {
      const requirement = program.requirements?.find(row => row.id === atom.source?.ruleId);
      const text=[atom.label, atom.source?.quote, requirement?.detail].filter(Boolean).join(' ');
      return /MEXT|文部科学省/i.test(text)&&(program.semanticVersion!==1||/等同|equivalent/i.test(text));
    }
    return true;
  });
  return direct.length?direct:item.localPaths?.[program.id]?.includes(path.id)?[path]:[];
}

function describe(item, path, matching) {
  if(path.imported){
    if(!item.values)return path.displayDescription;
    return pathDescription({...path,all:path.all.map(atom=>matching.includes(atom)?{...atom,value:positiveValues(atom).filter(value=>matchesValue(item,value))}:atom)});
  }
  if (!item.values) return path.displayDescription;
  // Remove only the alternatives already named by this row, retaining all other conditions.
  const remainder = { ...path, all: path.all.filter(atom => !matching.includes(atom)) };
  const detail = pathDescription(remainder);
  return (item.field === 'qualification' ? '须持有完整资格；' : '') + (detail !== '。' ? detail : '预计取得的资格须按入学节点核对。');
}

export function buildQualificationRows(programs, allPrograms = programs) {
  const views = new Map(programs.map(p => [p.id, buildProjectView(p)]));
  const catalogue=buildQualificationCatalog(allPrograms);
  const certifications=catalogue.filter(item=>item.field==='accreditation');
  // Each certification row keeps the entire path, including its twelve-year
  // and deadline conditions. Remove only those paths from the summary, since
  // the same program can also have an independent overseas-education path.
  const visiblePaths=(item,p)=>views.get(p.id).paths.filter(path=>matchingAtoms(item,path,p).length&&
    (!['international12','standard12'].includes(item.id)||!certifications.some(certification=>matchingAtoms(certification,path,p).length))&&
    (item.id!=='preparatory'||!path.all.some(a=>['verification.foreignUpperSecondaryEquivalency','verification.japanForeignNon12Secondary','verification.japanDesignatedInternationalSchool'].includes(a.field))));
  const rows = catalogue.map(item => {
    const cells = programs.map(p => {
      const paths = visiblePaths(item,p);
      const requirements = curriculumRequirements(item,p);
      const descriptions = paths.map(path => describe(item, path, matchingAtoms(item, path, p)));
      const additional = requirements.filter(row => !descriptions.some(text => text.includes(row.detail)));
      descriptions.push(...additional.map(row => row.detail + ' 另须满足本项目基本学历、身份及其他适用条件。'));
      const exclusion = p.requirements?.find(row => row.id === 'R013' && p.sourceIds?.includes('aohb27'));
      const explicitlyExcluded = exclusion && ['preparatory', 'japanEquivalency', 'specialized-secondary'].includes(item.id);
      const accepted=!item.needsClassification&&(paths.some(path=>path.all?.length&&path.all.every(atom=>atom.value!==null&&atom.state!=='unspecified'))||requirements.length>0);
      const originals=[...new Set(paths.flatMap(path=>matchingAtoms(item,path,p).flatMap(positiveValues)).filter(v=>typeof v==='string'&&(!item.values||matchesValue(item,v))))];
      let scopeNote='',scopeSummary='';
      if(accepted&&item.id==='accreditation'){
        const recognized=commonAccreditors.filter(v=>originals.some(name=>canonicalAccreditor(name)===v));
        const missing=commonAccreditors.filter(v=>!recognized.includes(v));
        if(missing.length){
          scopeNote=`仅明确列明：${recognized.join('、')||'范围待核实'}；${missing.join('、')}未列明或不适用，须另行核实。`;
          scopeSummary=`列明 ${recognized.join('、')||'范围待核实'}；其余待核实`;
        }
      }else if(accepted&&['gce-alevel','international-alevel'].includes(item.id)){
        const variants=new Set(originals.map(qualificationVariant));
        const resultsOnly=variants.size===1&&variants.has('results');
        scopeNote=resultsOnly?'原文仅列明 A-Level results，完整资格、科目成绩及 AS 适用范围须按本项目核实。':variants.has('as-and-a')||variants.has('as')?'列明 AS 相关资格；须结合本项目科目、分数及完整路径核对，不等于完整 A-Level。':'仅列明完整 A-Level；仅 AS 未列明为此路径可接受资格。';
        scopeSummary=resultsOnly?'成绩表述，资格范围待核实':variants.has('as-and-a')||variants.has('as')?'仅 AS 须核对科目与成绩':'完整 A-Level；仅 AS 未列明';
        if(variants.has('uk-entry')){
          scopeNote+=' 含“具英国大学入学资格”的限定，须另核资格效力。';
          scopeSummary+='；须具英国大学入学资格';
        }
      }else if(accepted&&item.id==='baccalaureate'&&originals.length){
        scopeNote='原文列明：'+originals.join('、')+'；本组限法国大学入学资格，其他同名证书不能据此认定。';
        scopeSummary='限法国大学入学资格';
      }
      return { programId: p.id, accepted, reason: accepted ? '明确列明，须满足附加条件' : explicitlyExcluded ? '手册明确不适用' : paths.length ? '原文已保留，资格归类或条件待核实' : '手册未列明',
        needsClassification:Boolean(item.needsClassification),excluded:Boolean(explicitlyExcluded),exclusionText:explicitlyExcluded?'本项目明确不接受'+item.label+'作为申请资格。':'',
        exclusionSources:explicitlyExcluded?[exclusion.source||{sourceId:'aohb27',page:exclusion.page,quote:exclusion.evidence,ruleId:exclusion.id}]:[],
        originals,partial:Boolean(scopeNote),scopeNote,scopeSummary,
        alternatives:paths.map((path,index)=>({label:path.label,resolved:path.all?.length>0&&path.all.every(atom=>atom.value!==null&&atom.state!=='unspecified'),values:matchingAtoms(item,path,p).flatMap(positiveValues),text:descriptions[index],notes:path.backgroundNotes||[],sources:(path.sources||[path.source]).filter(Boolean)})).concat(additional.map(row=>({requirement:true,values:[],text:row.detail+' 另须满足本项目基本学历、身份及其他适用条件。',notes:[],sources:[row.source]}))),
        pathIds: paths.map(path => path.id), requirementIds:requirements.map(row=>row.id), descriptions, backgroundNotes: [...paths.map(path => path.backgroundNotes),...additional.map(()=>[])],
        sources: [...paths.flatMap(path => path.sources || [path.source]),...requirements.map(row=>row.source)].filter(Boolean) };
    });
    const groups = new Map();
    for (const cell of cells) for (const [index, text] of cell.descriptions.entries()) {
      const backgroundNotes = cell.backgroundNotes[index];
      const key = JSON.stringify([text, backgroundNotes]);
      if (!groups.has(key)) groups.set(key, { text, backgroundNotes, programs: [], sources: [] });
      const group = groups.get(key); if (!group.programs.includes(cell.programId)) group.programs.push(cell.programId); group.sources.push(...cell.sources);
    }
    // Merge only identical full restrictions, keeping different program scopes separate.
    return { ...item, cells, conditions: [...groups.values()], scopes:groupScopeNotes(cells) };
  });
  return rows;
}

const decisionLabels={accepted:'可申请',excluded:'不接受',unknown:'需核实'};
const recognition=cell=>cell.accepted?(cell.excluded?'unknown':'accepted'):cell.excluded?'excluded':'unknown';
function alternativeText(alternatives){
  const paths=alternatives.filter(row=>!row.requirement),requirements=alternatives.filter(row=>row.requirement);
  const describe=row=>row.label?row.label+'：'+row.text:row.text;
  const pathText=paths.length>1?'满足以下任一完整资格路径：\n'+paths.map((row,index)=>(index+1)+'. '+describe(row)).join('\n'):paths[0]?describe(paths[0]):'';
  const requiredText=requirements.map(row=>row.text).join('\n');
  return [pathText,requiredText&&(pathText?'另须核对本项目所列要求：\n':'')+requiredText].filter(Boolean).join('\n');
}
function qualificationOptions(item,cell){
  const state=recognition(cell);
  const details=cell.alternatives.length?(cell.needsClassification?'尚未归入标准类型，请按原文核实；不据此自动判为符合。\n':'')+alternativeText(cell.alternatives):cell.exclusionText||'手册未明确列明此资格是否可用，需向学校核实，不能据此判为不接受。';
  const sourceList=[...cell.sources,...cell.exclusionSources];
  const option=(id,label,shortLabel,optionState=state,detail=details)=>({id,label,shortLabel,state:optionState,detail,sources:sourceList,notes:cell.backgroundNotes.flat()});
  if(cell.accepted&&cell.excluded)return [option(item.id,item.label,item.label,'unknown','收录的认可路径与排除条款冲突，须核对原文。\n'+details+'\n'+cell.exclusionText)];
  if(item.id==='accreditation')return commonAccreditors.map(name=>{
    const alternatives=cell.alternatives.filter(alternative=>alternative.values.some(original=>canonicalAccreditor(original)===name)),listed=alternatives.some(alternative=>alternative.resolved);
    const unspecified=cell.alternatives.filter(alternative=>!alternative.values.length);
    const detail=alternatives.length?(listed?'':'原文条件尚未完整，须核实。\n')+alternativeText(alternatives):'手册未在结构化条件中明确列明'+name+'；需核实本项目是否接受其具体认证范围。不能由其他机构获认可推定本机构也可用。';
    return {...option(name,name,name,listed?'accepted':'unknown',detail+(unspecified.length?'\n未分解到具体机构的原文要求：\n'+alternativeText(unspecified):'')),sources:[...alternatives,...unspecified].flatMap(alternative=>alternative.sources),notes:[...alternatives,...unspecified].flatMap(alternative=>alternative.notes)};
  });
  if(['gce-alevel','international-alevel'].includes(item.id)){
    const variants=new Set(cell.alternatives.filter(alternative=>alternative.resolved).flatMap(alternative=>alternative.values.map(qualificationVariant)));
    const full=cell.accepted&&[...variants].some(v=>['full','uk-entry','as-and-a'].includes(v));
    const asListed=variants.has('as-and-a')||variants.has('as');
    return [option('full','完整 A-Level','完整 A-Level',full?'accepted':cell.accepted?'unknown':state,details+(variants.has('uk-entry')?' 须核对原文“具英国大学入学资格”的限定。':'')),
      option('as','仅 AS Level','仅 AS',variants.has('as')?'accepted':full&&!asListed?'excluded':'unknown',full&&!asListed?'本项要求完整 A-Level；仅 AS 不能单独满足本项资格，仍可另核其他申请路径。':asListed?'原文列明 AS 相关资格，仍须核对科目、成绩及完整路径要求。\n'+alternativeText(cell.alternatives.filter(alternative=>alternative.values.some(value=>['as','as-and-a'].includes(qualificationVariant(value))))):'手册未明确仅 AS 是否可用，须核实，不能按完整 A-Level 自动认可。')];
  }
  return [option(item.id,item.id==='baccalaureate'?'法国完整 Baccalaureate':item.label,item.id==='baccalaureate'?'法国完整资格':item.label)];
}
function withQualificationOptions(row){return {...row,cells:row.cells.map(cell=>({...cell,options:qualificationOptions(row,cell)}))};}

// Compress only the view. Each member keeps its own program status, complete
// requirements and evidence; matching still uses the original paths above.
export function buildQualificationDisplayRows(programs,allPrograms=programs){
  const rows=buildQualificationRows(programs,allPrograms).map(withQualificationOptions),byId=new Map(rows.map(row=>[row.id,row]));
  const displayGroups=[...educationDisplayGroups.map(group=>({...group,members:[...group.members]})),{id:'university-education',label:'大学学习与学位',members:[],summary:'按项目分别核对授予机构、正式学位生身份、学习年限、学分及专业要求。'},{...unclassifiedDisplayGroup,members:[]},{id:'other-credentials',label:'其他原文证书（待归类）',group:'curriculum',members:[],summary:'尚未归入标准类型的原始证书，须核实具体资格、颁发机构及项目认可范围。'}];
  for(const row of rows.filter(row=>row.displayGroup))displayGroups.find(group=>group.id===row.displayGroup)?.members.push({id:row.id,shortLabel:row.shortLabel||row.label});
  const groupsByMember=new Map(displayGroups.flatMap(group=>group.members.map(member=>[member.id,group])));
  const emitted=new Set();
  return rows.flatMap(row=>{
    const group=groupsByMember.get(row.id);
    if(!group)return [row];
    if(emitted.has(group.id))return [];
    emitted.add(group.id);
    const members=group.members.map(member=>({...byId.get(member.id),shortLabel:member.shortLabel}));
    const cells=programs.map((program,index)=>{
      const memberCells=members.map(member=>({...member.cells[index],id:member.id,label:member.label,shortLabel:member.shortLabel}));
      const options=memberCells.map(cell=>({...cell.options[0],id:cell.id,label:cell.label,shortLabel:cell.shortLabel}));
      const general=options.find(option=>option.id==='standard12'&&option.state==='accepted');
      if(general)for(const option of options.filter(option=>['japanese-secondary','international12'].includes(option.id)&&option.state==='unknown')){
        option.detail='未单列此类型；需确认实际课程是否满足本项目的十二年正规教育要求及取得期限。满足时可按“十二年正规学校课程”申请；学校所在地本身不表示被排除。';
        option.sources=general.sources;
      }
      const accepted=memberCells.filter(cell=>cell.accepted),unlisted=memberCells.filter(cell=>!cell.accepted);
      const partial=accepted.length>0&&(unlisted.length>0||accepted.some(cell=>cell.partial));
      const scopeNote=Object.keys(decisionLabels).map(state=>{const selected=options.filter(option=>option.state===state);return selected.length?decisionLabels[state]+'：'+selected.map(option=>option.label).join('；')+'。':'';}).join('');
      return {programId:program.id,accepted:accepted.length>0,partial,scopeNote,
        options,scopeSummary:scopeNote,
        reason:accepted.length?'按所列教育类型分别核对完整条件':memberCells.every(cell=>cell.reason==='手册明确不适用')?'手册明确不适用':'手册未列明或不适用',
        members:memberCells,pathIds:unique(memberCells.flatMap(cell=>cell.pathIds)),
        requirementIds:unique(memberCells.flatMap(cell=>cell.requirementIds)),
        sources:memberCells.flatMap(cell=>cell.sources)};
    });
    const accepted=cells.filter(cell=>cell.accepted),memberDetails=[];
    for(const member of members){
      for(const condition of member.conditions)memberDetails.push({...condition,label:member.label});
      const statuses=new Map();
      for(const cell of member.cells.filter(cell=>!cell.accepted)){
        if(!statuses.has(cell.reason))statuses.set(cell.reason,[]);
        statuses.get(cell.reason).push(cell.programId);
      }
      for(const [text,ids] of statuses)memberDetails.push({label:member.label,text,programs:ids,backgroundNotes:[],sources:[]});
    }
    return [{id:group.id,label:group.label,group:group.group||'education',members,memberDetails,
      values:unique(members.flatMap(member=>[member.label,...member.values||[],...member.qualificationValues||[],...member.originalLabels||[]])),
      cells,scopes:groupScopeNotes(cells),conditions:accepted.length?[{
        text:group.summary,programs:accepted.map(cell=>cell.programId),backgroundNotes:[],sources:accepted.flatMap(cell=>cell.sources)
      }]:[]}];
  });
}

export function groupDecisionOptions(cells,full=false){
  const groups=new Map();
  for(const cell of cells){
    const key=JSON.stringify(cell.options.map(option=>[option.id,option.label,option.shortLabel,option.state,...(full?[option.detail,option.notes]:[])]));
    if(!groups.has(key))groups.set(key,{programs:[],options:cell.options.map(option=>({...option,sources:[]}))});
    const group=groups.get(key);group.programs.push(cell.programId);
    cell.options.forEach((option,index)=>group.options[index].sources.push(...option.sources));
  }
  return [...groups.values()];
}
function decisionSummaries(cells){
  const options=new Map(),groups=new Map();
  for(const cell of cells)for(const option of cell.options){
    const key=JSON.stringify([option.id,option.state]);
    if(!options.has(key))options.set(key,{option,programs:[]});
    options.get(key).programs.push(cell.programId);
  }
  for(const {option,programs} of options.values()){
    const key=JSON.stringify([option.state,programs]);
    if(!groups.has(key))groups.set(key,{state:option.state,programs,options:[]});
    groups.get(key).options.push(option);
  }
  return [...groups.values()].sort((a,b)=>Object.keys(decisionLabels).indexOf(a.state)-Object.keys(decisionLabels).indexOf(b.state));
}
export function buildQualificationDecisionInfo(row,programs,programId,displayLabel=programLabel){
  const label=id=>displayLabel(programs.find(program=>program.id===id)||{id});
  const cells=programId?row.cells.filter(cell=>cell.programId===programId):row.cells;
  const groups=groupDecisionOptions(cells,true);
  const hints=[...qualificationHint(row),...(row.originalLabels?.length?[{text:'原始路径名称：'+row.originalLabels.join('；')}]:[])];
  return {label:row.label+(programId?' · '+label(programId):''),parts:[
    {text:'下表逐项说明这类资格是否可用。“可申请”仍须满足对应条件、语言及项目其他要求；“需核实”不表示不接受。'},
    ...groups.map(group=>({title:group.programs.map(label).join(' / '),rows:group.options.map(option=>({...option,status:decisionLabels[option.state],text:option.detail}))})),
    ...(hints.length?[{title:'补充说明',text:hints.map(part=>[part.title,part.text].filter(Boolean).join('\n')).join('\n'),collapsed:true}]:[])
  ]};
}
function resultFor(options){
  const accepted=options.filter(option=>option.state==='accepted').length;
  if(accepted)return {state:'accepted',text:accepted<options.length?accepted+'项可':'可'};
  return options.every(option=>option.state==='excluded')?{state:'excluded',text:'否'}:{state:'unknown',text:'待核'};
}

export function renderQualificationMatrix(programs, allPrograms, ui) {
  const { esc, evidence } = ui;
  const displayLabel=ui.programLabel||programLabel;
  const label=id=>displayLabel(programs.find(p=>p.id===id)||{id});
  const rows = buildQualificationDisplayRows(programs, allPrograms);
  if (programs.length > 8) return renderCompactQualifications(rows, programs, ui);
  const programWidths=programs.map(program=>Math.min(160,Math.max(56,[...displayLabel(program)].reduce((width,char)=>width+(/[^\u0000-\u007f]/.test(char)?13:8),16))));
  const refs = sources => [...new Map(sources.map(source => [JSON.stringify(source), source])).values()].map(evidence).join(' ');
  const scopePrefix = group => {
    if(group.programs.length===programs.length)return '';
    const others=programs.filter(program=>!group.programs.includes(program.id));
    return (others.length<group.programs.length?'除 '+others.map(program=>label(program.id)).join(' / ')+' 外':group.programs.map(label).join(' / '))+'：';
  };
  const conditionText = (row,group) => {
    if(row.id==='individualReview'&&group.text==='经RU按学业背景及其他资格认定具备高中毕业或以上学力；入学前须年满18岁。申请个别资格审查或不确定是否符合资格时，须在所选申请期开始前3周联系International Admissions Office，通过文件指定咨询页面提交。')return '高中或以上学力须本校认定；入学前满18岁；申请期开始前3周联系招生办并提交指定咨询页。';
    if(!row.scopes.length||group.text!=='须持有完整资格；预计取得的资格须按入学节点核对。')return group.text;
    const fullInSummary=group.programs.every(id=>row.cells.find(cell=>cell.programId===id).scopeSummary.startsWith('完整 A-Level；'));
    return (fullInSummary?'':'完整资格；')+'预计取得须核对入学节点。';
  };
  const infoButton=(getInfo,classes,content,accessible)=>`<button type="button" class="info-hint ${classes}" data-act="detail-info" ${detailInfoAttribute(getInfo,ui)} aria-label="${esc(accessible)}" aria-haspopup="dialog">${content}</button>`;
  const rowHint=row=>infoButton(()=>buildQualificationDecisionInfo(row,programs,undefined,displayLabel),'qualification-hint','<span aria-hidden="true">!</span>','查看'+row.label+'包含的资格及适用范围');
  const resultCell=(row,cell)=>{
    const result=resultFor(cell.options),info=()=>buildQualificationDecisionInfo(row,programs,cell.programId,displayLabel);
    const title=cell.options.map(option=>decisionLabels[option.state]+'：'+option.label).join('；');
    return `<td class="acceptance-cell" title="${esc(title)}">${infoButton(info,'qualification-status qualification-result '+result.state,esc(result.text),label(cell.programId)+'：'+result.text+'，查看各类型结论')}</td>`;
  };
  const conditions = row => {
    const variants=row.cells.some(cell=>cell.options.length>1);
    const decisions=decisionSummaries(row.cells).map(group=>{
      if(!variants&&group.state==='accepted')return '';
      const names=variants?group.options.map(option=>option.shortLabel).join('、'):group.state==='excluded'?'手册明确不接受本项':'手册未明确，需核实是否接受';
      const applies=scopePrefix(group).replace(/：$/,'');
      return `<span class="qualification-decision-summary"><span class="qualification-scope-note ${group.state}">${esc({accepted:'可',excluded:'否',unknown:'待核'}[group.state])}${applies?'（'+esc(applies)+'）':''}：${esc(names)}</span></span>`;
    }).filter(Boolean).join(' ');
    // Group membership and complete AND conditions remain in the decision
    // table. Repeating generic reminders here only lengthens the summary.
    if(row.members)return decisions;
    const groups=row.conditions.map(group=>`<span class="qualification-condition">${!row.members&&scopePrefix(group)?`<strong class="inline-programs">${esc(scopePrefix(group))}</strong>`:''}${esc(conditionText(row,group))}${renderInfoHint(row.label+' · '+group.programs.map(label).join(' / '),group.backgroundNotes,esc)} ${refs(group.sources)}</span>`).join(' ');
    return [decisions,groups].filter(Boolean).join(' ');
  };
  const conditionLine=row=>`<span class="qualification-conditions-line"><span class="qualification-conditions-text">${conditions(row)}</span>${infoButton(()=>buildQualificationDecisionInfo(row,programs,undefined,displayLabel),'qualification-hint qualification-notes-hint','<span aria-hidden="true">!</span>','查看'+row.label+'的完整附加条件与适用说明')}</span>`;
  return `<div class="qualification-tools"><label class="search">${ui.icon('search')}<input data-qualification-search aria-label="搜索学制或资格" placeholder="搜索学制、认证或文凭，如 IB、WASC、DSE"></label><span class="muted small">${rows.length} 项统一资格</span></div>
    <div class="table-wrap"><table class="qualification-matrix" style="--qualification-min-width:${Math.max(680,600+programWidths.reduce((sum,width)=>sum+width,0))}px"><colgroup><col class="qualification-name-column">${programWidths.map(width=>`<col class="qualification-program-column" style="width:${width}px">`).join('')}<col></colgroup><thead><tr><th scope="col">学制／资格</th>${programs.map(p => `<th scope="col" class="acceptance-column"><a href="#program/${esc(p.id)}">${esc(displayLabel(p))}</a></th>`).join('')}<th scope="col">附加条件与适用说明</th></tr></thead>${educationGroups.map(group=>`<tbody data-qualification-group="${group.id}"><tr class="qualification-group-heading"><th colspan="${programs.length+2}">${group.label}</th></tr>${rows.filter(row=>row.group===group.id).map(row => `<tr data-qualification="${esc(row.id)}" data-qualification-label="${esc([row.label,...row.values||[],...row.originalLabels||[]].join(' ').toLowerCase())}"><th scope="row">${esc(row.label)}${rowHint(row)}</th>${row.cells.map(cell=>resultCell(row,cell)).join('')}<td class="qualification-conditions">${conditionLine(row)}</td></tr>`).join('')}</tbody>`).join('')}</table></div>
    <p class="qualification-legend">可：列明可用，仍须满足条件；N项可：组内有N种可用类型，点击查看；否：明确不接受本项；待核：原文未明确或有冲突。未列明不等于不接受，单项不适用也不妨碍通过其他路径申请。</p><p class="qualification-empty hidden">没有找到该学制或资格。</p>`;
}

function renderCompactQualifications(rows, programs, ui) {
  const { esc } = ui, displayLabel=ui.programLabel||programLabel;
  const applies=ui.programScope||((ids)=>renderProgramScope(ids,programs,ui));
  const hint=(row,cells,accessible)=>`<button type="button" class="info-hint qualification-hint" data-act="detail-info" ${detailInfoAttribute(()=>buildQualificationDecisionInfo({...row,cells},programs,undefined,displayLabel),ui)} aria-label="${esc(accessible)}" aria-haspopup="dialog"><span aria-hidden="true">!</span></button>`;
  const renderRow=row=>{
   const groups=groupDecisionOptions(row.cells,true);
   const counts={accepted:0,excluded:0,unknown:0};
   row.cells.forEach(cell=>counts[resultFor(cell.options).state]++);
   const summary=Object.entries(counts).filter(([,count])=>count).map(([state,count])=>`<span class="qualification-scope-note ${state}">${esc({accepted:'有可用类型',excluded:'明确不接受',unknown:'需核实'}[state])} · ${count} 个项目</span>`).join('');
   const variants=groups.map(group=>{
    const cells=row.cells.filter(cell=>group.programs.includes(cell.programId));
    const summary=group.options.map(option=>`${decisionLabels[option.state]}：${option.shortLabel}；${option.detail}`).join(' ｜ ');
    const listed=group.options.filter(option=>option.state==='accepted').map(option=>option.shortLabel);
    const excluded=group.options.filter(option=>option.state==='excluded').map(option=>option.shortLabel);
    const concise=[listed.length?'可：'+listed.join('、'):'',excluded.length?'否：'+excluded.join('、'):'',group.options.some(option=>option.state==='unknown')?(listed.length||excluded.length?'其余类型':'')+'需核实':''].filter(Boolean).join('；');
    const detail=(group.options.find(option=>option.state==='accepted')||group.options[0])?.detail||'';
    return `<tr><td><div class="qualification-compact-line"><span class="qualification-compact-text" title="${esc(summary)}">${esc(concise)}；${esc(detail)}</span></div></td><td>${applies(group.programs)}</td><td>${hint(row,cells,'查看'+row.label+'这一组项目的完整条件')}</td></tr>`;
   }).join('');
   return `<tr data-qualification="${esc(row.id)}" data-qualification-label="${esc([row.label,...row.values||[],...row.originalLabels||[]].join(' ').toLowerCase())}"><th scope="row">${esc(row.label)}${hint(row,row.cells,'查看'+row.label+'包含的资格及适用范围')}</th><td><details class="qualification-variants"><summary><span>${summary}</span><span class="qualification-expand-label">${groups.length} 组条件与适用项目</span></summary><div class="table-wrap"><table class="qualification-variants-table"><colgroup><col><col class="qualification-overview-scope"><col class="qualification-overview-info"></colgroup><thead><tr><th>附加条件与适用说明</th><th>适用项目</th><th>详情</th></tr></thead><tbody>${variants}</tbody></table></div></details></td></tr>`;
  };
  return `<div class="qualification-tools"><label class="search">${ui.icon('search')}<input data-qualification-search aria-label="搜索学制或资格" placeholder="搜索学制、认证或文凭，如 IB、WASC、DSE"></label><span class="muted small">${rows.length} 项统一资格 · ${programs.length} 个项目</span></div><p class="qualification-legend">展开每项资格查看具体条件和适用项目；“有可用类型”仍须逐项满足完整条件，点击 ! 查看依据。</p><div class="table-wrap"><table class="qualification-overview"><colgroup><col class="qualification-overview-name"><col></colgroup><thead><tr><th>学制／资格</th><th>项目认可情况与附加条件</th></tr></thead>${educationGroups.map(group=>`<tbody data-qualification-group="${group.id}"><tr class="qualification-group-heading"><th colspan="2">${group.label}</th></tr>${rows.filter(row=>row.group===group.id).map(renderRow).join('')}</tbody>`).join('')}</table></div><p class="qualification-legend">可申请仍须满足完整条件；明确不接受与需核实分别列示。不同资格路径之间仍可择一，语言和项目其他要求另行核对。</p><p class="qualification-empty hidden">没有找到该学制或资格。</p>`;
}
