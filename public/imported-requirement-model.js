// Adapt imported data to the shared school/project presentation. This module
// does not change stored rules or decide a student's eligibility.
import { programEntryLabel } from './program-presentation.js';
function sophiaFlaEntry(p) {
  if(p.school!=='上智大学'||(p.code!=='FLA'&&p.englishName!=='Faculty of Liberal Arts'))return '';
  if(/编入|转入|transfer/i.test(p.channel||''))return programEntryLabel(p);
  if(/一年级|first.year|freshman/i.test(p.channel||''))return '申请';
  return '';
}
// Sophia's two existing records are separate selectable projects. Keep their
// original channels and IDs for source identity, updates and saved matches.
export const programLabel = p => sophiaFlaEntry(p)?`FLA ${sophiaFlaEntry(p)}`:p.code||p.id;
export const schoolViewGroup = p => sophiaFlaEntry(p)?'国际教养学部（FLA）':p.channel;
export function languageRequirementText(p) {
  const requirement = {required:'须提供英语证明'+(p.waivers?.length?'，可按豁免条件免交':''), 'not-required':'明确不要求英语证明', optional:'英语证明选交', conditional:'按适用条件提交英语证明', unspecified:'英语证明必要性未注明'}[p.languageRequirement] || '英语证明必要性未注明';
  return `${requirement}；所列总分及单项均须满足`;
}
export function importedRuleText(rule) {
  const label = rule.label || '条件待核实';
  let text = label;
  if (Array.isArray(rule.value) && !rule.value.every(value => label.includes(value))) text += `（${rule.value.join(' / ')}）`;
  else if (typeof rule.value === 'number' && !label.includes(String(rule.value))) text += ` ${{gte:'≥',lte:'≤',eq:'=',neq:'≠'}[rule.op] || ''} ${rule.value}`;
  else if (typeof rule.value === 'string' && rule.value && !label.includes(rule.value)) text += `（${rule.value}）`;
  if (rule.referenceDate && !text.includes(rule.referenceDate)) text += `（基准日 ${rule.referenceDate}）`;
  return text;
}

export function importedPolicyText(policy, kind) {
  if (!policy) return '原文未注明。';
  if (policy.detail?.trim()) return policy.detail;
  const parts = [];
  if (kind === 'language') {
    if (policy.validYears) parts.push(`成绩有效年限 ${policy.validYears} 年，起算节点以原文为准`);
    if (policy.validAfter) parts.push(`考试日期不早于 ${policy.validAfter}`);
    if (policy.validUntil) parts.push(`考试日期不晚于 ${policy.validUntil}`);
    if (policy.availabilityRequired === true) parts.push('须在规定期限前取得成绩');
    if (policy.allowSuperscore === false) parts.push('不接受跨次拼分，适用考试以原文为准');
    if (policy.excludedFormats?.length) parts.push('不接受：' + policy.excludedFormats.join('、'));
  } else if (kind === 'graduation') {
    if (policy.deadline) parts.push(`资格取得截止：${policy.deadline}`);
    if (policy.allowExpected !== null && policy.allowExpected !== undefined) parts.push(policy.allowExpected ? '接受预计取得资格' : '不接受预计取得资格');
    if (policy.required === false) parts.push('明确不要求此项');
  }
  return parts.join('；') || '原文未注明。';
}

export function buildImportedProjectView(p) {
  const sourceFor = row => row.source || { sourceId:p.sourceIds?.[0], page:row.page, quote:row.evidence };
  const paths = (p.paths || []).map(path => {
    const description = (path.all || []).map(importedRuleText).join('；且 ') || '具体条件待核实';
    return {...path, imported:true, description, displayDescription:description, backgroundNotes:[], sources:[path.source,...path.all.map(rule => rule.source)].filter(Boolean)};
  });
  const academic = (p.hardConditions || []).map(rule => ({topic:'身份与附加条件',detail:importedRuleText(rule),source:rule.source}));
  if (p.academicTests?.detail) academic.push({topic:'学术标准化考试',detail:p.academicTests.detail,source:p.academicTests.source});
  const waivers = (p.waivers || []).map(path => ({title:path.label,paragraphs:path.all.map(importedRuleText),sources:[path.source,...path.all.map(rule => rule.source)].filter(Boolean)}));
  const materials = (p.materials || []).map(material => ({...material,optional:material.required===false,parts:[
    {title:'适用阶段',text:material.stage || '原文未注明'},
    {title:'提交要求',text:material.required===true?'按适用条件必需':material.required===false?'选交':'必要性待核实'},
    ...(material.when?[{title:'适用条件',text:importedRuleText(material.when)}]:[]),
    ...(material.note?[{title:'完整说明',text:material.note}]:[])
  ],sources:[material.source].filter(Boolean)}));
  const post=(p.requirements || []).filter(row=>/录取后|入学后|入学前|赴.+前|在学/.test(row.stage));
  return {paths,academic,waivers,materials,materialNotes:[],materialNoteSources:[],languageFormats:[],post,
    enrollmentSource:p.graduationPolicy?.source,enrollmentDetail:importedPolicyText(p.graduationPolicy,'graduation'),
    languageValidity:importedPolicyText(p.languagePolicy,'language'),allRequirements:p.requirements || [],
    audience:'以本项目要求为准',sourceFor};
}
