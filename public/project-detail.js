import { buildProjectView } from './requirement-model.js';
import { renderQualificationMatrix } from './qualification-matrix.js';
import { renderRoundsTable } from './rounds-table.js';
import { renderInfoHint, renderDetailInfoContent } from './detail-hints.js';
import { renderLanguageScoreTable } from './score-table.js';
import { documentUrl } from './document-review.js';
import { languageRequirementText } from './imported-requirement-model.js';
import { renderStoredRequirements } from './formal-requirements.js';
import { tuitionText } from './tuition.js';
import { buildProgramLabels, buildProgramTitles, programTitle, programEntryLabel, programEntryGroup } from './program-presentation.js';
import { groupMaterials, renderMaterialCatalog } from './material-presentation.js';
import { conciseText, renderReadableText, joinCopy } from './plain-language.js';
import { renderAcademicScores } from './academic-scores.js';
export { buildProjectView, pathDescription } from './requirement-model.js';

export function renderProjectDetail(p, ui) {
  const { esc, icon, tag, button, evidence, showSources = false } = ui;
  const labels=ui.programLabel?null:buildProgramLabels([p]);
  const displayLabel=ui.programLabel||(program=>labels.get(program.id)||programTitle(program));
  const title=ui.programTitle?.(p)||buildProgramTitles(ui.allPrograms||[p]).get(p.id)||programTitle(p);
  const view = buildProjectView(p);
  const sourceLinks = (p.sourceIds || []).map(id => `<a class="btn ghost sm" href="${documentUrl(id)}" target="_blank" rel="noopener">${p.sourceIds.length === 1 ? '完整原文' : esc(ui.documents?.find(d => d.id === id)?.name || id)} ${icon('eye')}</a>`).join('');
  const refs = sources => {
    const seen = new Set();
    return sources.filter(Boolean).filter(s => { const key = JSON.stringify(s); if (seen.has(key)) return false; seen.add(key); return true; }).map(evidence).join(' ');
  };
  const hint = (label, parts) => renderInfoHint(label, parts, esc);
  const copy=value=>renderReadableText(value,esc);
  const compactRows = rows => rows.map(r => `<div class="compact-rule"><strong>${esc(conciseText(r.topic))}</strong><div>${copy(r.detail)} ${evidence(view.sourceFor(r))}</div></div>`).join('');
  const nav = [['academic', '学历与资格'], ['language', '语言成绩'], ['materials', '申请材料'], ['rounds', '申请轮次'], ...(view.post.length ? [['after', '后续要求']] : []),...(p.semanticVersion===1?[['complete','全部要求']]:[])];
  return `<div class="project-detail" data-entry-group="${programEntryGroup(p)}"><div class="hierarchy-breadcrumb"><a href="#programs">学校与项目</a>${icon('chevron')}<a href="#school/${encodeURIComponent(p.school)}">${esc(p.school)}</a>${icon('chevron')}<span>${esc(displayLabel(p))}</span></div>
    <section class="panel section project-heading-panel">
      <div class="program-title"><div><div class="flex wrap">${tag(p.school)}${tag(p.year + ' 入学')}${tag(p.degree)}</div><h1>${esc(title)}</h1><p class="muted small">${esc(programEntryLabel(p))}${p.partner ? ' · 合作院校：' + esc(p.partner) : ''}</p><details class="program-original"><summary>原始名称与招生方式</summary><dl><dt>项目全称</dt><dd>${esc(p.name)}</dd>${p.englishName?`<dt>英文全称</dt><dd>${esc(p.englishName)}</dd>`:''}<dt>招生方式</dt><dd>${esc(p.channel||'未注明')}</dd></dl></details></div><div class="project-actions">${button(icon('edit') + ' 编辑规则', 'edit-program', `data-id="${p.id}"`)}${button('选择学生检查', 'select-student', `data-id="${p.id}"`, 'primary')}</div></div>
      <div class="source-panel detail-section" id="detail-sources"><div class="source-summary"><strong>原文与版本</strong><span>${esc(p.year)} 招生手册 · v${esc(p.version)}</span><span class="source-audience">${esc(view.audience)}</span></div><div class="source-actions"><button type="button" class="source-switch" role="switch" aria-checked="${showSources}" data-act="toggle-sources"><span>显示原文出处</span><span class="switch-track" aria-hidden="true"></span></button>${sourceLinks}${button('修改记录', 'program-history', `data-id="${p.id}"`, 'ghost sm')}</div></div>
      <nav class="rule-nav" aria-label="项目要求导航">${nav.map(([key, label]) => `<a href="#program/${p.id}/${key}">${label}</a>`).join('')}</nav>
    </section>
    <section class="panel section detail-section" id="detail-academic"><div class="panel-head"><h2>学历资格与身份</h2><span class="muted small">按持有的学制、认证或文凭查看</span></div>${renderQualificationMatrix([p], ui.allPrograms || [p], ui)}${renderAcademicScores([p],ui)}${view.academic.length ? `<div class="panel-body academic-notes">${compactRows(view.academic)}</div>` : ''}</section>
    <section class="panel section detail-section" id="detail-language"><div class="panel-head"><div class="language-heading"><h2>语言考试与豁免</h2><span class="score-legend muted small">“未注明”表示原文未列明门槛；“—”表示不适用。</span></div><span class="muted small">${p.semanticVersion===1?esc(languageRequirementText(p)):'任选一种 · 所列总分及单项均须满足'}</span></div>${renderLanguageScoreTable(p.language, ui)}<div class="language-rules-heading"><h3>成绩有效期与考试形式</h3></div><div class="panel-body language-rules-body"><p class="language-validity">有效期：${view.languageValidity?copy(view.languageValidity):`所选申请截止日前${esc(p.languagePolicy.validYears)}年内参加，且成绩在申请期间可获得。`}${p.semanticVersion===1&&p.languagePolicy.excludedFormats.length?` 不接受：${esc(p.languagePolicy.excludedFormats.join('、'))}。`:''} ${evidence(p.languagePolicy.source)}</p><div class="language-formats">${compactRows(view.languageFormats)}</div><div class="waiver-list">${view.waivers.map(w => `<div class="waiver-summary"><div class="waiver-label"><h3>${esc(w.title)}</h3>${hint(w.title, w.paragraphs.map(text => ({ text })))}</div><span class="source-links">${refs(w.sources)}</span></div>`).join('')}</div></div></section>
    <section class="panel section detail-section" id="detail-materials"><div class="panel-head"><h2>申请材料 ${hint('材料通用要求', view.materialNotes)}</h2><span class="muted small">点击材料类别查看完整要求</span><div class="source-links">${refs(view.materialNoteSources)}</div></div>${renderMaterialCatalog(groupMaterials([p],()=>view.materials),[p],ui)}</section>
    <section class="panel section detail-section" id="detail-rounds"><div class="panel-head"><h2>申请轮次</h2><span class="muted small">${p.semanticVersion===1?'按原文标注时区':'均为日本时间'}</span></div><div class="panel-body rounds-intro"><div><strong>选拔方式</strong><span>${copy(p.interview.detail)}</span>${evidence(p.interview.source)}</div><p>${view.enrollmentDetail?copy(view.enrollmentDetail):'须在对应入学日期前取得所需资格；逾期将撤销录取。'}${evidence(view.enrollmentSource)}</p></div>${renderRoundsTable([p], ui, false)}<div class="panel-body rounds-footer"><div class="compact-rule"><strong>学费</strong><div>${copy(tuitionText(p.tuition,p.year))} ${evidence(p.tuition.source)}</div></div><div class="compact-rule"><strong>同时申请与再次申请</strong><div>同时申请多个项目：${p.combination.parallel === 'allowed' ? '允许' : p.combination.parallel === 'forbidden' ? '不允许' : '未注明'}；跨轮次再次申请：${p.combination.reapply === 'allowed' ? '允许' : p.combination.reapply === 'forbidden' ? '不允许' : '未注明'}。${copy(joinCopy([p.combination.materials,p.combination.referenceReuse]))} ${evidence(p.combination.source)}</div></div></div></section>
    ${view.post.length ? `<section class="panel section detail-section" id="detail-after"><div class="panel-head"><h2>录取与入学要求</h2></div><div class="panel-body">${compactRows(view.post)}</div></section>` : ''}
    ${renderStoredRequirements([p],ui)}
  </div>`;
}


export function setupDetailHints({ esc, showModal, evidence, resolveInfo }) {
  const tooltip = document.createElement('div');
  tooltip.id = 'detail-tooltip'; tooltip.className = 'detail-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true;
  document.body.append(tooltip);
  let active = null, timer;
  const content = info => renderDetailInfoContent(info, esc, evidence);
  const read = button => button.dataset.info ? JSON.parse(button.dataset.info) : resolveInfo?.(button.dataset.infoKey);
  function hide() { clearTimeout(timer); tooltip.hidden = true; active?.removeAttribute('aria-describedby'); active = null; }
  function show(button) {
    clearTimeout(timer); if (active === button && !tooltip.hidden) return;
    hide(); active = button;
    const info = read(button); if(!info){hide();return;}
    tooltip.dataset.entryGroup=button.closest('[data-entry-group]')?.dataset.entryGroup || 'application';
    tooltip.classList.toggle('qualification-tooltip', info.parts.some(part => part.rows));
    tooltip.innerHTML = content(info) + `<small class="hint-footer">${button.closest('#student-form')?'移开或按 Esc 关闭提示':'点击标识可展开完整说明'}</small>`;
    tooltip.style.maxHeight = ''; tooltip.hidden = false; button.setAttribute('aria-describedby', tooltip.id);
    const rect = button.getBoundingClientRect(), width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    const below = innerHeight - rect.bottom - 20, above = rect.top - 20;
    const placeBelow = height <= below || (height > above && below >= above);
    // A long explanation must stay on one side of its trigger so that the
    // pointer can still reach the button to open the complete dialog.
    tooltip.style.maxHeight = `${Math.max(0, Math.min(height, placeBelow ? below : above))}px`;
    tooltip.style.left = `${Math.max(12, Math.min(rect.left - width / 2, innerWidth - width - 12))}px`;
    tooltip.style.top = `${Math.max(12, placeBelow ? rect.bottom + 8 : rect.top - tooltip.offsetHeight - 8)}px`;
  }
  document.addEventListener('pointerover', e => { const button = e.target.closest('.info-hint'); if (button) show(button); else if (tooltip.contains(e.target)) clearTimeout(timer); });
  document.addEventListener('pointerout', e => { if (e.target.closest('.info-hint') || tooltip.contains(e.target)) timer = setTimeout(() => { if (!tooltip.matches(':hover') && !active?.matches(':hover,:focus')) hide(); }, 160); });
  document.addEventListener('focusin', e => { if (e.target.matches('.info-hint')) show(e.target); else if (!tooltip.contains(e.target)) hide(); });
  document.addEventListener('click', e => { const button = e.target.closest('.info-hint'); if (button) { if(button.closest('#student-form')){e.preventDefault();show(button);return;}const info = read(button); hide(); if(info)showModal(info.label, `<div class="material-explanation">${content(info)}</div>`); } else if (!tooltip.contains(e.target)) hide(); });
  document.addEventListener('change', e => {
    if (!e.target.matches('[data-material-project-filter]')) return;
    const selected=e.target.value;
    e.target.closest('.material-variant-list').querySelectorAll('[data-material-programs]').forEach(row=>{
      row.hidden=Boolean(selected)&&!JSON.parse(row.dataset.materialPrograms).includes(selected);
      row.open=Boolean(selected)&&!row.hidden;
      const scope=row.querySelector('.material-variant-scope');if(scope)scope.hidden=Boolean(selected);
    });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('scroll', e => { if (!tooltip.contains(e.target)) hide(); }, true);
  window.addEventListener('hashchange', hide);
  window.addEventListener('resize', hide);
}
