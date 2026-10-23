import { buildProjectView } from './requirement-model.js';
import { renderQualificationMatrix } from './qualification-matrix.js';
import { renderRoundsTable } from './rounds-table.js';
import { renderInfoHint } from './detail-hints.js';
import { renderLanguageScoreTable } from './score-table.js';
import { programLabel, schoolViewGroup, languageRequirementText } from './imported-requirement-model.js';
import { renderStoredRequirements } from './formal-requirements.js';
import { tuitionText } from './tuition.js';

export const schoolHref = name => `#school/${encodeURIComponent(name)}`;
const channelOrder=value=>/一年级|first.year|freshman/i.test(value)?0:/编入|transfer/i.test(value)?2:1;
export function groupSchools(programs) {
  const schools = new Map();
  for (const p of programs) {
    if (!schools.has(p.school)) schools.set(p.school, { name: p.school, programs: [] });
    schools.get(p.school).programs.push(p);
  }
  for (const school of schools.values()) {
    school.programs.sort((a,b)=>channelOrder(a.channel)-channelOrder(b.channel));
    const offerings = new Map();
    for (const p of school.programs) {
      const key = JSON.stringify([programLabel(p), p.name]);
      if (!offerings.has(key)) offerings.set(key, {code:programLabel(p),name:p.name,programs:[]});
      offerings.get(key).programs.push(p);
    }
    const channels=rows=>[...new Set(rows.map(p=>p.channel).filter(Boolean))].sort((a,b)=>channelOrder(a)-channelOrder(b));
    school.offerings=[...offerings.values()].map(group=>({...group,channels:channels(group.programs)}));
    school.channels=[...new Set(school.programs.map(schoolViewGroup).filter(Boolean))];
  }
  return [...schools.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

// Equal text/thresholds can share a row. Program IDs and source evidence remain
// attached to each group, so a single changed threshold immediately splits it.
export function groupRequirements(programs, entries, signature) {
  const groups = new Map();
  for (const p of programs) for (const row of entries(p)) {
    const key = JSON.stringify(signature(row));
    if (!groups.has(key)) groups.set(key, { ...row, programs: [], sources: [] });
    const group = groups.get(key);
    if (!group.programs.includes(p.id)) group.programs.push(p.id);
    group.sources.push(...(row.sources || [row.source]).filter(Boolean));
  }
  return [...groups.values()];
}

export function buildSchoolView(programs) {
  const views = new Map(programs.map(p => [p.id, buildProjectView(p)]));
  const fromView = key => p => views.get(p.id)[key];
  const ruleKey = row => [row.topic, row.detail, row.stage, row.nature];
  return {
    programs,
    academic: groupRequirements(programs, p => views.get(p.id).academic.map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })), ruleKey),
    scores: groupRequirements(programs, p => p.language, row => ['exam', 'version', 'scale', 'score', 'minimumStatus', 'basis', 'reading', 'listening', 'writing', 'speaking', 'note'].map(key => row[key] ?? null)),
    formats: groupRequirements(programs, p => views.get(p.id).languageFormats.map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })).concat(p.semanticVersion===1&&p.languagePolicy.excludedFormats.length?[{topic:'不接受的考试形式',detail:p.languagePolicy.excludedFormats.join('、'),source:p.languagePolicy.source}]:[]), ruleKey),
    waivers: groupRequirements(programs, fromView('waivers'), row => [row.title, row.paragraphs]),
    materials: groupRequirements(programs, fromView('materials'), row => [row.id, row.label, Boolean(row.optional), row.when, row.parts]),
    materialNotes: groupRequirements(programs, p => [{ parts: views.get(p.id).materialNotes, sources: views.get(p.id).materialNoteSources }], row => row.parts),
    post: groupRequirements(programs, p => views.get(p.id).post.map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })), ruleKey),
    selection: groupRequirements(programs, p => [{ ...p.interview }], row => [row.status, row.detail]),
    validity: groupRequirements(programs, p => [{ ...p.languagePolicy, displayDetail:views.get(p.id).languageValidity }], row => [row.validYears, row.validAfter, row.validUntil, row.availabilityRequired, row.allowSuperscore, row.excludedFormats,row.displayDetail]),
    enrollment: groupRequirements(programs, p => p.semanticVersion===1?[{topic:'资格取得节点',detail:views.get(p.id).enrollmentDetail,source:p.graduationPolicy.source}]:(p.requirements || []).filter(row => row.id === 'R002').map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })), ruleKey),
    tuition: groupRequirements(programs, p => [{ ...p.tuition, year: p.year }], row => [row.status, row.amount, row.currency, row.period, row.year,row.detail]),
    combination: groupRequirements(programs, p => [{ ...p.combination }], row => [row.parallel, row.reapply, row.materials, row.referenceReuse])
  };
}

export function renderSchoolDetail(name, allPrograms, ui, filters = {}) {
  const { esc, icon, button, evidence, showSources = false, selectedCompare = new Set() } = ui;
  const schoolPrograms = allPrograms.filter(p => p.school === name);
  const years = [...new Set(schoolPrograms.map(p => p.year))].sort((a, b) => b - a);
  const year = years.includes(Number(filters.year)) ? Number(filters.year) : years[0];
  const channels = [...new Set(schoolPrograms.filter(p => p.year === year).map(schoolViewGroup))].sort((a,b)=>channelOrder(a)-channelOrder(b));
  const channel = channels.includes(filters.channel) ? filters.channel : channels[0];
  const programs = schoolPrograms.filter(p => p.year === year && schoolViewGroup(p) === channel).sort((a,b)=>channelOrder(a.channel)-channelOrder(b.channel));
  if (!programs.length) return '<div class="empty">尚未收录该学校的项目。</div>';
  const view = buildSchoolView(programs);
  const refs = sources => [...new Map(sources.filter(Boolean).map(source => [JSON.stringify(source), source])).values()].map(evidence).join(' ');
  const label=id=>programLabel(programs.find(p=>p.id===id)||{id});
  const applies = ids => ids.length === programs.length ? `<span class="scope-all">${programs.length===1?esc(label(ids[0])):`全部 ${programs.length} 项目`}</span>` : `<span class="scope-programs">${ids.map(id => `<a href="#program/${esc(id)}">${esc(label(id))}</a>`).join('')}${ids.length === 1 ? '<small>单独要求</small>' : ''}</span>`;
  const hint = (label, parts) => renderInfoHint(label, parts, esc);
  const ruleRows = rows => rows.map(row => `<div class="school-rule"><strong>${esc(row.topic || row.title)}</strong><div>${esc(row.detail)} ${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('');
  const nav = [['academic', '学历资格与身份'], ['language', '语言考试与豁免'], ['materials', '申请材料'], ['rounds', '申请轮次'], ...(view.post.length ? [['after', '后续要求']] : []),...(programs.some(p=>p.semanticVersion===1)?[['complete','完整条款']]:[])];
  const sourceIds = [...new Set(programs.flatMap(p => p.sourceIds || []))];
  const documents = sourceIds.map(id => ui.documents?.find(d => d.id === id) || { id, name: id });
  const schoolLink = schoolHref(name);
  return `<div class="school-detail">
    <div class="hierarchy-breadcrumb"><a href="#programs">学校与项目</a>${icon('chevron')}<span>${esc(name)}</span></div>
    <section class="panel section school-heading"><div class="school-title"><div><h1>${esc(name)}</h1><p>${esc(channel)} · 已收录项目申请总览</p></div><div class="school-controls"><label>入学年份<select data-school-year>${years.map(value => `<option value="${value}" ${value === year ? 'selected' : ''}>${value} 年</option>`).join('')}</select></label>${channels.length > 1 ? `<label>招生通道<select data-school-channel>${channels.map(value => `<option value="${esc(value)}" ${value === channel ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>` : ''}${button(icon('compare') + ' 比较所选项目', 'compare-programs', '', 'sm')}</div></div>
      <div class="table-wrap"><table class="school-program-table"><thead><tr><th>项目</th><th>学位／方向</th><th>入学期</th><th>当前版本</th><th>比较</th></tr></thead><tbody>${programs.map(p => `<tr><td><a class="school-project-link" href="#program/${esc(p.id)}"><strong>${esc(programLabel(p))}</strong><span>${esc(p.name)}</span>${icon('chevron')}</a></td><td>${[p.degree,p.direction].filter(Boolean).map(esc).join(' · ')}</td><td>${[...new Set(p.rounds.map(r => r.intake))].map(esc).join(' / ')}</td><td>v${esc(p.version)}</td><td><input type="checkbox" data-compare="${esc(p.id)}" aria-label="比较${esc(p.id)}" ${selectedCompare.has(p.id) ? 'checked' : ''}></td></tr>`).join('')}</tbody></table></div>
      <div class="source-panel"><div class="source-summary"><strong>原文与版本</strong><span>${year} 入学 · ${programs.length} 个项目</span></div><div class="source-actions"><button type="button" class="source-switch" role="switch" aria-checked="${showSources}" data-act="toggle-sources"><span>显示详细原文链接</span><span class="switch-track" aria-hidden="true"></span></button>${documents.map(d => `<a class="btn ghost sm" href="${d.id === 'aohb27' ? '/sources/aohb27.pdf' : '/uploads/' + encodeURIComponent(d.id)}" target="_blank" rel="noopener">${documents.length === 1 ? '完整原文' : esc(d.name)} ${icon('eye')}</a>`).join('')}</div></div>
      <nav class="rule-nav" aria-label="学校要求导航">${nav.map(([key, label]) => `<a href="${schoolLink}/${key}">${label}</a>`).join('')}</nav>
    </section>
    <section class="panel section detail-section" id="detail-academic"><div class="panel-head"><h2>学历资格与身份</h2><span class="muted small">按持有的学制、认证或文凭查看适用项目</span></div>${renderQualificationMatrix(programs, allPrograms, ui)}${view.academic.length ? `<div class="panel-body academic-notes">${ruleRows(view.academic)}</div>` : ''}</section>
    <section class="panel section detail-section" id="detail-language"><div class="panel-head"><div class="language-heading"><h2>语言考试与豁免</h2><span class="score-legend muted small">“未注明”表示原文未列明门槛；“—”表示不适用。</span></div><span class="muted small">${programs.some(p=>p.semanticVersion===1)?esc([...new Set(programs.map(p=>languageRequirementText(p)))].join('；')):'每个项目任选其接受的一种 · 总分及单项同时满足'}</span></div>${renderLanguageScoreTable(view.scores, ui, applies)}<div class="language-rules-heading"><h3>成绩有效期与考试形式</h3></div><div class="panel-body language-rules-body">${view.validity.map(row => `<div class="school-rule"><strong>成绩有效期</strong><div>${row.displayDetail?esc(row.displayDetail):`所选申请截止日前 ${esc(row.validYears)} 年内参加${row.availabilityRequired ? '，且成绩在申请期间可获得' : ''}。`}${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}<div class="language-formats">${ruleRows(view.formats)}</div><div class="waiver-list">${view.waivers.map(row => `<div class="waiver-summary"><div class="waiver-label"><h3>${esc(row.title)}</h3>${hint(row.title + ' · ' + row.programs.map(label).join(' / '), row.paragraphs.map(text => ({ text })))}</div><span class="source-links">${refs(row.sources)}</span><div class="waiver-scope">${applies(row.programs)}</div></div>`).join('')}</div></div></section>
    <section class="panel section detail-section" id="detail-materials"><div class="panel-head"><h2>申请材料</h2><span class="muted small">名称旁 ⓘ 查看完整说明</span></div><div class="table-wrap"><table class="school-material-table"><thead><tr><th>材料</th><th>适用项目</th></tr></thead><tbody>${view.materials.map(row => `<tr><td><span>${esc(row.label)}</span>${row.optional ? '<small class="material-optional">选交</small>' : ''}${hint(row.label + ' · ' + row.programs.map(label).join(' / '), row.parts)}<span class="source-links">${refs(row.sources)}</span></td><td>${applies(row.programs)}</td></tr>`).join('')}</tbody></table></div><div class="material-common-notes">${view.materialNotes.filter(row => row.parts?.length).map(row => `<div><strong>材料通用说明</strong>${hint('材料通用说明 · ' + row.programs.map(label).join(' / '), row.parts)}${applies(row.programs)}<span class="source-links">${refs(row.sources)}</span></div>`).join('')}</div></section>
    <section class="panel section detail-section" id="detail-rounds"><div class="panel-head"><h2>申请轮次</h2><span class="muted small">入学、申请、初筛、面试与结果按行对齐</span></div><div class="panel-body school-rounds-intro">${view.selection.map(row => `<div class="school-rule"><strong>选拔方式</strong><div>${esc(row.detail)} ${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}${view.enrollment.map(row => `<div class="school-rule"><strong>资格取得节点</strong><div>${esc(row.detail)} ${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}</div>${renderRoundsTable(programs, ui)}<div class="panel-body rounds-footer">${view.tuition.map(row => `<div class="school-rule"><strong>学费</strong><div>${esc(tuitionText(row,row.year))}${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}${view.combination.map(row => `<div class="school-rule"><strong>多项目／跨轮申请</strong><div>并申：${row.parallel === 'allowed' ? '允许' : row.parallel === 'forbidden' ? '不允许' : '未注明'}；跨轮重申：${row.reapply === 'allowed' ? '允许' : row.reapply === 'forbidden' ? '不允许' : '未注明'}。${esc(row.materials)}。${esc(row.referenceReuse)}。${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}</div></section>
    ${view.post.length ? `<section class="panel section detail-section" id="detail-after"><div class="panel-head"><h2>后续阶段的相关要求</h2><span class="muted small">按实际适用项目列出</span></div><div class="panel-body">${ruleRows(view.post.map(row => ({ ...row, topic: `${row.stage} · ${row.topic}` })))}</div></section>` : ''}
    ${renderStoredRequirements(programs,ui)}
  </div>`;
}
