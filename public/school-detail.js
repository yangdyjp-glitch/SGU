import { buildProjectView } from './requirement-model.js';
import { renderQualificationMatrix } from './qualification-matrix.js';
import { renderRoundsTable } from './rounds-table.js';
import { renderInfoHint } from './detail-hints.js';
import { renderLanguageScoreTable } from './score-table.js';
import { programLabel, schoolViewGroup, languageRequirementText } from './imported-requirement-model.js';
import { renderStoredRequirements } from './formal-requirements.js';
import { tuitionText } from './tuition.js';
import { buildProgramLabels, buildProgramTitles, buildProgramNames, programCode, programEntryLabel, programEntryGroup, entryGroupLabel, programOriginalTitle, programFullName, renderProgramOverviewName, renderProgramScope } from './program-presentation.js';
import { groupMaterials, renderMaterialCatalog } from './material-presentation.js';
import { conciseText, renderReadableText, joinCopy } from './plain-language.js';

export const schoolHref = name => `#school/${encodeURIComponent(name)}`;
const channelOrder=value=>/一年级|first.year|freshman/i.test(value)?0:/编入|转入|transfer/i.test(value)?2:1;
export function groupSchools(programs) {
  const schools = new Map();
  for (const p of programs) {
    if (!schools.has(p.school)) schools.set(p.school, { name: p.school, programs: [] });
    schools.get(p.school).programs.push(p);
  }
  for (const school of schools.values()) {
    school.programs.sort((a,b)=>channelOrder(a.channel)-channelOrder(b.channel));
    const offerings = new Map();
    const names=buildProgramNames(school.programs),titles=buildProgramTitles(school.programs,{contextual:false});
    for (const p of school.programs) {
      const key = JSON.stringify([p.code, p.name, p.channel]);
      if (!offerings.has(key)) {
        const name=names.get(p.id),code=programCode(p);
        offerings.set(key,{code,name,title:titles.get(p.id),programs:[]});
      }
      offerings.get(key).programs.push(p);
    }
    const channels=rows=>[...new Set(rows.map(p=>p.channel).filter(Boolean))].sort((a,b)=>channelOrder(a)-channelOrder(b));
    school.offerings=[...offerings.values()].map(group=>({...group,entry:programEntryLabel(group.programs[0]),channels:channels(group.programs)}));
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
  const ruleKey = row => [conciseText(row.topic), conciseText(row.detail), row.stage, row.nature];
  return {
    programs,
    academic: groupRequirements(programs, p => views.get(p.id).academic.map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })), ruleKey),
    scores: groupRequirements(programs, p => p.language, row => ['exam', 'version', 'scale', 'score', 'minimumStatus', 'basis', 'reading', 'listening', 'writing', 'speaking', 'note'].map(key => row[key] ?? null)),
    languageRequirements: groupRequirements(programs, p=>[{topic:'英语证明要求',detail:p.semanticVersion===1?languageRequirementText(p):'每个项目任选其接受的一种；总分及单项同时满足。',source:p.languagePolicy.source}],ruleKey),
    formats: groupRequirements(programs, p => views.get(p.id).languageFormats.map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })).concat(p.semanticVersion===1&&p.languagePolicy.excludedFormats.length?[{topic:'不接受的考试形式',detail:p.languagePolicy.excludedFormats.join('、'),source:p.languagePolicy.source}]:[]), ruleKey),
    waivers: groupRequirements(programs, fromView('waivers'), row => [row.title, row.paragraphs]),
    materials: groupRequirements(programs, fromView('materials'), row => [row.id, row.label, Boolean(row.optional), row.when, row.parts]),
    materialGroups: groupMaterials(programs, fromView('materials')),
    materialNotes: groupRequirements(programs, p => [{ parts: views.get(p.id).materialNotes, sources: views.get(p.id).materialNoteSources }], row => row.parts),
    post: groupRequirements(programs, p => views.get(p.id).post.map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })), ruleKey),
    selection: groupRequirements(programs, p => [{ ...p.interview }], row => [row.status, row.detail]),
    validity: groupRequirements(programs, p => [{ ...p.languagePolicy, displayDetail:views.get(p.id).languageValidity }], row => [row.validYears, row.validAfter, row.validUntil, row.availabilityRequired, row.allowSuperscore, row.excludedFormats,row.displayDetail]),
    enrollment: groupRequirements(programs, p => p.semanticVersion===1?[{topic:'资格取得时间',detail:views.get(p.id).enrollmentDetail,source:p.graduationPolicy.source}]:(p.requirements || []).filter(row => row.id === 'R002').map(row => ({ ...row, source: views.get(p.id).sourceFor(row) })), ruleKey),
    tuition: groupRequirements(programs, p => [{ ...p.tuition, year: p.year }], row => [row.status, row.amount, row.currency, row.period, row.year,row.detail]),
    combination: groupRequirements(programs, p => [{ ...p.combination }], row => [row.parallel, row.reapply, row.materials, row.referenceReuse])
  };
}

export function schoolYearPrograms(name, allPrograms, filters = {}) {
  const schoolPrograms = allPrograms.filter(p => p.school === name);
  const years = [...new Set(schoolPrograms.map(p => p.year))].sort((a, b) => b - a);
  const year = years.includes(Number(filters.year)) ? Number(filters.year) : years[0];
  const yearPrograms = schoolPrograms.filter(p => p.year === year).sort((a,b)=>channelOrder(a.channel)-channelOrder(b.channel)||a.name.localeCompare(b.name,'zh-CN')||a.channel.localeCompare(b.channel,'zh-CN'));
  const entryGroup = filters.entryGroup === 'transfer' ? 'transfer' : 'application';
  const counts = { application:0, transfer:0 };
  yearPrograms.forEach(p=>counts[programEntryGroup(p)]++);
  return { years, year, entryGroup, counts, programs:yearPrograms.filter(p=>programEntryGroup(p)===entryGroup) };
}

export function createSchoolOverview(name, allPrograms, ui, filters = {}) {
  const { esc, icon, button, evidence, showSources = false, selectedCompare = new Set() } = ui;
  const { years, year, programs, entryGroup, counts } = schoolYearPrograms(name, allPrograms, filters);
  if (!years.length) return { html:'<div class="empty">尚未收录该学校的项目。</div>', programs, renderSection:()=>'' };
  const groupName = entryGroupLabel(entryGroup);
  const labels = buildProgramLabels(programs);
  const titles = buildProgramTitles(programs), rowTitles=buildProgramTitles(programs,{contextual:false});
  const infoStore = new Map();
  const registerInfo = getInfo => { const key='school-info-'+infoStore.size; infoStore.set(key,getInfo); return key; };
  const resolveInfo = key => { const value=infoStore.get(key); if(typeof value==='function'){const info=value();infoStore.set(key,info);return info;} return value; };
  ui = { ...ui, programLabel:p=>labels.get(p.id)||programLabel(p), programTitle:p=>titles.get(p.id), ...(ui.deferSections?{registerInfo}:{}) };
  const label = id => labels.get(id) || id;
  // Build the full requirement view only when a section is requested.
  let view;
  const refs = sources => [...new Map(sources.filter(Boolean).map(source => [JSON.stringify(source), source])).values()].map(evidence).join(' ');
  const applies = ids => renderProgramScope(ids, programs, ui);
  ui.programScope = applies;
  const hint = (label, parts) => renderInfoHint(label, parts, esc);
  const copy = value => renderReadableText(value,esc);
  const ruleRows = rows => rows.map(row => `<div class="school-rule"><strong>${esc(conciseText(row.topic || row.title))}</strong><div>${copy(row.detail)} ${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('');
  const nav = programs.length ? [['academic', '学历资格与身份'], ['language', '语言考试与豁免'], ['materials', '申请材料'], ['rounds', '申请轮次'], ['after', '后续要求'],...(programs.some(p=>p.semanticVersion===1)?[['complete','全部要求']]:[])] : [];
  const sourceIds = [...new Set(programs.flatMap(p => p.sourceIds || []))];
  const documents = sourceIds.map(id => ui.documents?.find(d => d.id === id) || { id, name: id });
  const schoolLink = schoolHref(name);
  const renderSection = key => {
    if (!nav.some(([id])=>id===key)) return '';
    if (key === 'complete') return renderStoredRequirements(programs,ui);
    view ||= buildSchoolView(programs);
    if (key === 'academic') return `<section class="panel section detail-section" id="detail-academic"><div class="panel-head"><h2>学历资格与身份</h2><span class="muted small">按持有的学制、认证或文凭查看适用项目</span></div>${renderQualificationMatrix(programs, allPrograms, ui)}${view.academic.length ? programs.length>8 ? `<details class="school-academic-notes"><summary>身份与项目附加条件（${view.academic.length} 组）</summary><div>${ruleRows(view.academic)}</div></details>` : `<div class="panel-body academic-notes">${ruleRows(view.academic)}</div>` : ''}</section>`;
    if (key === 'language') return `<section class="panel section detail-section" id="detail-language"><div class="panel-head"><div class="language-heading"><h2>语言考试与豁免</h2><span class="score-legend muted small">“未注明”表示原文未列明门槛；“—”表示不适用。</span></div><span class="muted small">按各项右侧适用项目核对 · 总分及单项同时满足</span></div>${renderLanguageScoreTable(view.scores, ui, applies)}<div class="language-rules-heading"><h3>成绩有效期与考试形式</h3></div><div class="panel-body language-rules-body">${ruleRows(view.languageRequirements)}${view.validity.map(row => `<div class="school-rule"><strong>成绩有效期</strong><div>${row.displayDetail?copy(row.displayDetail):`所选申请截止日前 ${esc(row.validYears)} 年内参加${row.availabilityRequired ? '，且成绩在申请期间可获得' : ''}。`}${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}<div class="language-formats">${ruleRows(view.formats)}</div><div class="waiver-list">${view.waivers.map(row => `<div class="waiver-summary"><div class="waiver-label"><h3>${esc(row.title)}</h3>${hint(row.title + ' · ' + row.programs.map(label).join(' / '), row.paragraphs.map(text => ({ text })))}</div><span class="source-links">${refs(row.sources)}</span><div class="waiver-scope">${applies(row.programs)}</div></div>`).join('')}</div></div></section>`;
    if (key === 'materials') return `<section class="panel section detail-section" id="detail-materials"><div class="panel-head"><h2>申请材料</h2><span class="muted small">同类材料合并为 ${view.materialGroups.length} 类 · 点击查看各项目要求</span></div>${renderMaterialCatalog(view.materialGroups,programs,ui)}<div class="material-common-notes">${view.materialNotes.filter(row => row.parts?.length).map(row => `<div><strong>材料通用说明</strong>${hint('材料通用说明 · ' + row.programs.map(label).join(' / '), row.parts)}${applies(row.programs)}<span class="source-links">${refs(row.sources)}</span></div>`).join('')}</div></section>`;
    if (key === 'rounds') return `<section class="panel section detail-section" id="detail-rounds"><div class="panel-head"><h2>申请轮次</h2><span class="muted small">按项目查看申请和入学时间</span></div><div class="panel-body school-rounds-intro">${view.selection.map(row => `<div class="school-rule"><strong>选拔方式</strong><div>${copy(row.detail)} ${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}${view.enrollment.map(row => `<div class="school-rule"><strong>资格取得时间</strong><div>${copy(row.detail)} ${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}</div>${renderRoundsTable(programs, ui)}<div class="panel-body rounds-footer">${view.tuition.map(row => `<div class="school-rule"><strong>学费</strong><div>${copy(tuitionText(row,row.year))}${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}${view.combination.map(row => `<div class="school-rule"><strong>同时申请与再次申请</strong><div>同时申请多个项目：${row.parallel === 'allowed' ? '允许' : row.parallel === 'forbidden' ? '不允许' : '未注明'}；跨轮次再次申请：${row.reapply === 'allowed' ? '允许' : row.reapply === 'forbidden' ? '不允许' : '未注明'}。${copy(joinCopy([row.materials,row.referenceReuse]))}${refs(row.sources)}</div><div>${applies(row.programs)}</div></div>`).join('')}</div></section>`;
    return `<section class="panel section detail-section" id="detail-after"><div class="panel-head"><h2>录取与入学要求</h2><span class="muted small">按实际适用项目列出</span></div><div class="panel-body">${view.post.length?ruleRows(view.post.map(row => ({ ...row, topic: `${row.stage} · ${row.topic}` }))):'<p class="muted">资料未单列后续要求，请核对原文。</p>'}</div></section>`;
  };
  const placeholders = nav.map(([key,title])=>`<section class="panel section detail-section school-section-placeholder" id="detail-${key}" data-school-section="${key}"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body"><button type="button" class="btn sm" data-load-school-section="${key}">${key==='complete'?'展开全部要求':'查看'+title}</button></div></section>`).join('');
  const sourceLinks = documents.map(d => `<a class="btn ghost sm" href="${d.id === 'aohb27' ? '/sources/aohb27.pdf' : '/uploads/' + encodeURIComponent(d.id)}" target="_blank" rel="noopener">${documents.length === 1 ? '完整原文' : esc(d.name)} ${icon('eye')}</a>`).join('');
  const entrySwitch = `<div class="school-entry-bar"><a class="school-projects-label" href="${schoolLink}" data-school-section-link="projects">项目</a><div class="entry-switch" role="group" aria-label="切换申请项目与编入项目">${['application','transfer'].map(group=>`<button type="button" data-school-entry="${group}" aria-pressed="${group===entryGroup}">${entryGroupLabel(group)} <span>${counts[group]}</span></button>`).join('')}</div></div>`;
  const html = `<div class="school-detail" data-school-name="${esc(name)}" data-school-year-value="${year}" data-entry-group="${entryGroup}">
    <div class="hierarchy-breadcrumb"><a href="#programs">学校与项目</a>${icon('chevron')}<span>${esc(name)}</span></div>
    <section class="panel section school-heading"><div class="school-title"><div><h1>${esc(name)}</h1><p>${year} 入学 · ${groupName} ${programs.length} 个</p></div><div class="school-controls"><label>入学年份<select data-school-year>${years.map(value => `<option value="${value}" ${value === year ? 'selected' : ''}>${value} 年</option>`).join('')}</select></label>${programs.length?button(icon('compare') + ' 比较所选项目 <span data-compare-count>'+programs.filter(p=>selectedCompare.has(p.id)).length+'</span>', 'compare-programs', '', 'sm')+button('清空选择','clear-compare','','ghost sm'):''}</div></div>
    </section>
    <nav class="rule-nav school-overview-nav" aria-label="学校要求导航">${entrySwitch}<div class="school-section-links">${nav.map(([key, title]) => `<a href="${schoolLink}/${key}" data-school-section-link="${key}">${title}</a>`).join('')}</div></nav>
    ${programs.length?`<section class="panel section school-projects" id="detail-projects"><div class="toolbar"><label class="search">${icon('search')}<input data-school-project-search aria-label="搜索本校项目" placeholder="搜索项目、专业或申请类型"></label><span class="muted small" data-school-project-count>全部 ${programs.length} 个${groupName}${programs.length>8?' · 列表内可滚动查看':''}</span></div>
      <div class="table-wrap school-project-scroll ${programs.length>8?'many-projects':''}" tabindex="0" aria-label="本年度全部项目列表"><table class="school-program-table"><thead><tr><th>项目</th><th>申请类型</th><th>入学期</th><th>版本</th><th>比较</th></tr></thead><tbody>${programs.map(p => `<tr data-school-project="${esc([p.name,p.code,p.englishName,p.direction,p.channel,programFullName(p),programEntryLabel(p),rowTitles.get(p.id),label(p.id)].join(' ').toLowerCase())}"><td><a class="school-project-link" href="#program/${esc(p.id)}" title="${esc(programOriginalTitle(p))}">${renderProgramOverviewName(p,rowTitles.get(p.id),esc)}${icon('chevron')}</a></td><td><span class="project-entry" title="${esc(p.channel)}">${esc(programEntryLabel(p))}</span></td><td>${[...new Set(p.rounds.map(r => r.intake))].map(esc).join(' / ')}</td><td>v${esc(p.version)}</td><td><input type="checkbox" data-compare="${esc(p.id)}" aria-label="比较${esc(label(p.id))}" ${selectedCompare.has(p.id) ? 'checked' : ''}></td></tr>`).join('')}</tbody></table></div><p class="school-project-empty hidden">没有找到项目；清空搜索可查看本年度全部项目。</p>
      <div class="source-panel"><div class="source-summary"><strong>原文与版本</strong><span>下方全部内容对应当前 ${programs.length} 个${groupName}。</span></div><div class="source-actions"><button type="button" class="source-switch" role="switch" aria-checked="${showSources}" data-act="toggle-sources"><span>显示原文出处</span><span class="switch-track" aria-hidden="true"></span></button>${documents.length>2?`<details class="school-source-list"><summary>完整原文（${documents.length} 份）</summary><div>${sourceLinks}</div></details>`:sourceLinks}</div></div>
    </section>`:`<section class="panel section" id="detail-projects"><div class="empty"><strong>${year} 年尚未收录${groupName}</strong><p>可切换到${entryGroupLabel(entryGroup==='transfer'?'application':'transfer')}，或查看其他入学年份。</p></div></section>`}
    ${ui.deferSections?placeholders:nav.map(([key])=>renderSection(key)).join('')}
  </div>`;
  return { html, programs, labels, titles, entryGroup, renderSection, resolveInfo };
}

export function renderSchoolDetail(name, allPrograms, ui, filters = {}) {
  return createSchoolOverview(name, allPrograms, ui, filters).html;
}
