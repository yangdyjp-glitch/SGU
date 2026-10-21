import { buildProjectView } from './requirement-model.js';
import { renderQualificationMatrix } from './qualification-matrix.js';
import { renderRoundsTable } from './rounds-table.js';
export { buildProjectView, pathDescription } from './requirement-model.js';

export function renderProjectDetail(p, ui) {
  const { esc, icon, tag, button, evidence, showSources = false } = ui;
  const view = buildProjectView(p);
  const refs = sources => {
    const seen = new Set();
    return sources.filter(Boolean).filter(s => { const key = JSON.stringify(s); if (seen.has(key)) return false; seen.add(key); return true; }).map(evidence).join(' ');
  };
  const hint = (label, parts) => parts?.length ? `<button type="button" class="info-hint" data-act="detail-info" data-info="${esc(JSON.stringify({ label, parts }))}" aria-label="查看${esc(label)}说明" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>` : '';
  const compactRows = rows => rows.map(r => `<div class="compact-rule"><strong>${esc(r.topic)}</strong><div>${esc(r.detail)} ${evidence(view.sourceFor(r))}</div></div>`).join('');
  const nav = [['academic', '学历与资格'], ['language', '语言成绩'], ['materials', '申请材料'], ['rounds', '申请轮次'], ...(view.post.length ? [['after', '后续要求']] : [])];
  const subscore = value => typeof value === 'number' ? `≥ ${value}` : value === '不适用' ? '—' : value || '未注明';
  const scores = p.language.map(l => `<tr data-score="${esc(l.id)}"><td><strong>${esc(l.exam)}</strong>${l.scale && l.scale !== '未注明' ? `<small class="round-meta">${esc(l.scale)} 分制 · ${esc(l.version)}</small>` : l.version && l.version !== '未注明' ? `<small class="round-meta">${esc(l.version)}</small>` : ''}${l.note ? `<small class="score-note">${esc(l.note)}</small>` : ''} ${evidence(l.source)}</td><td><strong>≥ ${esc(l.score)}</strong><small class="round-meta">${esc(l.basis)}</small></td>${['reading', 'listening', 'writing', 'speaking'].map(k => `<td>${esc(subscore(l[k]))}</td>`).join('')}</tr>`).join('');
  return `<div class="project-detail"><div class="hierarchy-breadcrumb"><a href="#programs">学校与项目</a>${icon('chevron')}<a href="#school/${encodeURIComponent(p.school)}">${esc(p.school)}</a>${icon('chevron')}<span>${esc(p.id)}</span></div>
    <section class="panel section project-heading-panel">
      <div class="program-title"><div><div class="flex wrap">${tag(p.school)}${tag(p.year + ' 入学')}${tag(p.degree)}</div><h1>${esc(p.id)} · ${esc(p.name)}</h1><p class="english">${esc(p.englishName)}</p><p class="muted small">${esc(p.channel)}${p.partner ? ' · 合作院校：' + esc(p.partner) : ''}</p></div><div class="project-actions">${button(icon('edit') + ' 编辑规则', 'edit-program', `data-id="${p.id}"`)}${button('选择学生检查', 'select-student', `data-id="${p.id}"`, 'primary')}</div></div>
      <div class="source-panel detail-section" id="detail-sources"><div class="source-summary"><strong>原文与版本</strong><span>${esc(p.year)} 招生手册 · v${esc(p.version)}</span><span class="source-audience">${esc(view.audience)}</span></div><div class="source-actions"><button type="button" class="source-switch" role="switch" aria-checked="${showSources}" data-act="toggle-sources"><span>显示详细原文链接</span><span class="switch-track" aria-hidden="true"></span></button><a class="btn ghost sm" href="/sources/aohb27.pdf" target="_blank" rel="noopener">完整原文 ${icon('eye')}</a>${button('修改记录', 'program-history', `data-id="${p.id}"`, 'ghost sm')}</div></div>
      <nav class="rule-nav" aria-label="项目要求导航">${nav.map(([key, label]) => `<a href="#program/${p.id}/${key}">${label}</a>`).join('')}</nav>
    </section>
    <section class="panel section detail-section" id="detail-academic"><div class="panel-head"><h2>学历资格与身份</h2><span class="muted small">按持有的学制、认证或文凭查看</span></div>${renderQualificationMatrix([p], ui.allPrograms || [p], ui)}${view.academic.length ? `<div class="panel-body academic-notes">${compactRows(view.academic)}</div>` : ''}</section>
    <section class="panel section detail-section" id="detail-language"><div class="panel-head"><h2>语言考试与豁免</h2><span class="muted small">任选一种 · 所列总分及单项均须满足</span></div><div class="table-wrap"><table class="score-table"><thead><tr><th>考试／版本</th><th>最低分</th><th>阅读</th><th>听力</th><th>写作</th><th>口语</th></tr></thead><tbody>${scores}</tbody></table></div><div class="panel-body"><p class="language-validity">有效期：所选申请截止日前${esc(p.languagePolicy.validYears)}年内参加，且成绩在申请期间可获得。<span class="muted">“未注明”表示手册未列单项门槛；“—”表示不适用。</span> ${evidence(p.languagePolicy.source)}</p><div class="language-formats">${compactRows(view.languageFormats)}</div>${view.waivers.map(w => `<div class="waiver-block"><h3>${esc(w.title)}</h3>${w.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}<div class="source-links">${refs(w.sources)}</div></div>`).join('')}</div></section>
    <section class="panel section detail-section" id="detail-materials"><div class="panel-head"><h2>申请材料 ${hint('材料通用要求', view.materialNotes)}</h2><span class="muted small">停留或点击 ⓘ 查看说明</span><div class="source-links">${refs(view.materialNoteSources)}</div></div><div class="material-grid">${view.materials.map(m => `<div class="material-item"><div class="material-name"><span>${esc(m.label)}${m.optional ? '<small class="material-optional">选交</small>' : ''}</span>${hint(m.label, m.parts)}</div><div class="source-links">${refs(m.sources)}</div></div>`).join('')}</div></section>
    <section class="panel section detail-section" id="detail-rounds"><div class="panel-head"><h2>申请轮次</h2><span class="muted small">均为日本时间</span></div><div class="panel-body rounds-intro"><div><strong>选拔方式</strong><span>${esc(p.interview.detail)}</span>${evidence(p.interview.source)}</div><p>所需学历资格须在对应入学节点前取得；未如期取得将撤销录取。${evidence(view.enrollmentSource)}</p></div>${renderRoundsTable([p], ui, false)}<div class="panel-body rounds-footer"><div class="compact-rule"><strong>学费</strong><div>${p.tuition.status === 'published' ? `${esc(p.tuition.amount)} ${esc(p.tuition.currency)} / ${esc(p.tuition.period)}` : `${esc(p.year)}年度金额未注明。`} ${evidence(p.tuition.source)}</div></div><div class="compact-rule"><strong>併愿与重复申请</strong><div>併愿：${p.combination.parallel === 'allowed' ? '允许' : p.combination.parallel === 'forbidden' ? '不允许' : '未注明'}；跨轮次重申：${p.combination.reapply === 'allowed' ? '允许' : p.combination.reapply === 'forbidden' ? '不允许' : '未注明'}。${esc(p.combination.materials)}。${esc(p.combination.referenceReuse)}。 ${evidence(p.combination.source)}</div></div></div></section>
    ${view.post.length ? `<section class="panel section detail-section" id="detail-after"><div class="panel-head"><h2>后续阶段的相关要求</h2></div><div class="panel-body">${compactRows(view.post)}</div></section>` : ''}
  </div>`;
}


export function setupDetailHints({ esc, showModal }) {
  const tooltip = document.createElement('div');
  tooltip.id = 'detail-tooltip'; tooltip.className = 'detail-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true;
  document.body.append(tooltip);
  let active = null, timer;
  const content = info => `<strong>${esc(info.label)}</strong>${info.parts.map(part => `<div class="hint-part">${part.title ? `<b>${esc(part.title)}</b>` : ''}<p>${esc(part.text)}</p></div>`).join('')}`;
  function hide() { clearTimeout(timer); tooltip.hidden = true; active?.removeAttribute('aria-describedby'); active = null; }
  function show(button) {
    clearTimeout(timer); if (active === button && !tooltip.hidden) return;
    hide(); active = button;
    const info = JSON.parse(button.dataset.info); tooltip.innerHTML = content(info) + '<small class="hint-footer">点击标识可展开完整说明</small>';
    tooltip.hidden = false; button.setAttribute('aria-describedby', tooltip.id);
    const rect = button.getBoundingClientRect(), width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    tooltip.style.left = `${Math.max(12, Math.min(rect.left - width / 2, innerWidth - width - 12))}px`;
    tooltip.style.top = `${Math.max(12, rect.bottom + height + 12 <= innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`;
  }
  document.addEventListener('pointerover', e => { const button = e.target.closest('.info-hint'); if (button) show(button); else if (tooltip.contains(e.target)) clearTimeout(timer); });
  document.addEventListener('pointerout', e => { if (e.target.closest('.info-hint') || tooltip.contains(e.target)) timer = setTimeout(() => { if (!tooltip.matches(':hover') && !active?.matches(':hover,:focus')) hide(); }, 160); });
  document.addEventListener('focusin', e => { if (e.target.matches('.info-hint')) show(e.target); else if (!tooltip.contains(e.target)) hide(); });
  document.addEventListener('click', e => { const button = e.target.closest('.info-hint'); if (button) { const info = JSON.parse(button.dataset.info); hide(); showModal(info.label, `<div class="material-explanation">${content(info)}</div>`); } else if (!tooltip.contains(e.target)) hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('scroll', e => { if (!tooltip.contains(e.target)) hide(); }, true);
  window.addEventListener('hashchange', hide);
}
