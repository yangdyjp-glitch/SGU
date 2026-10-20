// Presentation only: the matching engine keeps the complete, versioned rules.
const numbers = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `R${String(from + i).padStart(3, '0')}`);
const firstSentence = text => String(text || '').split('。')[0] + (text ? '。' : '');
const englishList = values => values.length > 1 ? `${values.slice(0, -1).join(', ')} or ${values.at(-1)}` : values[0] || '';
const rowSource = (p, row) => row.source || { sourceId: p.sourceIds?.[0] || 'aohb27', page: row.page, quote: row.evidence, ruleId: row.id };
const pathClarifications = {
  japanDesignated12: '完成日本境内外国人学校12年课程；学校须获MEXT认可为等同海外高中',
  preparatory: '完成MEXT认可的日本大学预备教育课程',
  equivalency: '通过证明具备海外标准12年教育同等学力的考试（如GED）',
  japanEquivalency: '通过MEXT的高等学校卒業程度認定試験',
  individualReview: '经RU按学业背景及其他资格认定具备高中毕业或以上学力'
};

export function pathDescription(path) {
  return path.all.filter(c => c.field !== 'educationStatus').map(c => {
    if (c.field === 'accreditation' && Array.isArray(c.value)) return `学校须经指定机构认证 (${englishList(c.value)})`;
    if (c.field === 'ageAtEnrollment') return `入学前须年满${c.value}岁`;
    if (c.op === 'eq' && c.value === true && path.source?.sourceId === 'aohb27' && pathClarifications[c.field]) return pathClarifications[c.field];
    if (c.op === 'in' && Array.isArray(c.value)) return `${c.label}（${c.value.join(' / ')}）`;
    if (c.op === 'gte') return `${c.label} ≥ ${c.value}`;
    if (c.op === 'eq' && typeof c.value === 'string' && !c.label.includes(c.value)) return `${c.label}：${c.value}`;
    return c.label;
  }).join('；') + '。';
}

export function buildProjectView(p) {
  const requirements = p.requirements || [];
  const byId = new Map(requirements.map(r => [r.id, r]));
  const rows = ids => ids.map(id => byId.get(id)).filter(Boolean);
  const parts = ids => rows(ids).map(r => ({ title: r.topic, text: r.detail }));
  const sources = ids => rows(ids).map(r => rowSource(p, r));
  const academic = rows(['R012', 'R013', 'R015', 'R085', 'R111']).map(r => ({ ...r, detail: r.id === 'R012' ? r.detail.split('；')[0] + '；学校说明见材料。' : r.detail
    .replace('保留“未注明”，不填写0或解释为不审查学业成绩。', '未注明数值门槛仍会审查学业成绩。')
    .replace('不可把全部职业教育资格一概判定为被排除。', '此项不泛指全部职业教育。')
    .replace('此处的可选学术证据与JDP英语证明路径须分开。', p.id === 'JDP' ? '用SAT／ACT满足英语要求时，仍须达到下列英语单项门槛。' : '') }));
  const paths = p.paths.map(path => {
    let description = pathDescription(path);
    const extra = path.id === 'E' ? byId.get('R007')?.detail.split('。').slice(1).join('。') : path.id === 'I' ? byId.get('R011')?.detail.split('。').slice(1).join('。') : '';
    if (extra) description += extra;
    if (path.id === 'I' && byId.has('R014')) description += byId.get('R014').detail;
    return { ...path, description, sources: [path.source, ...(path.id === 'I' ? sources(['R014']) : [])] };
  });
  const waivers = [];
  if (byId.has('R027')) {
    const condition = byId.get('R027'), proof = byId.get('R067');
    waivers.push({ title: '英语成绩豁免', paragraphs: [condition.detail, proof?.detail.replace(/^须证明最近6年全英语教育；/, '')].filter(Boolean), sources: sources(['R027', 'R067']) });
  }
  if (p.id === 'GLA' && byId.has('R023')) {
    waivers.push({ title: '全英语 IB Diploma 豁免', paragraphs: [firstSentence(byId.get('R023').detail), '申请时尚未取得Diploma者，录取后须在入学前取得，否则撤销录取。证明文件及成绩直送见材料中的IB资格说明。'], sources: sources(['R023', 'R066']) });
  }
  if (p.id === 'JDP' && byId.has('R024')) {
    waivers.push({ title: '四年全英语教育豁免', paragraphs: ['Grade 9–12或等同四年，英语为唯一教学语言，且未修读ESL课程。', '符合其一：①学习美国区域认证课程、IB、CXC或英国课程（美国境内外均可）；②在指定国家／地区或其教育体系学习（学校所在地不限）。国籍本身不替代教育经历；须提交符合豁免标准的证据。', `指定国家／地区：${byId.get('R026')?.detail.replace('保留文件分组。', '') || ''}`], sources: sources(['R024', 'R025', 'R026', 'R066']) });
  }
  for (const waiver of p.waivers || []) {
    if (['six-year', 'ib-english', 'group-a', 'jdp-curriculum'].includes(waiver.id)) continue;
    waivers.push({ title: waiver.label, paragraphs: [pathDescription(waiver)], sources: waiver.all.map(c => c.source).filter(Boolean) });
  }
  const materialRules = {
    identity: ['R038'], graduation: ['R041', 'R042', 'R043'], transcript: numbers(49, 57),
    english: numbers(58, 65), essay: numbers(70, 78), reference: numbers(80, 83),
    photo: ['R079'], residence: ['R084'], awards: ['R087']
  };
  const materials = (p.materials || []).filter(m => !m.stage || m.stage === '申请').map(m => {
    const ids = materialRules[m.id] || [];
    const details = rows(ids).map(r => ({ title: r.topic, text: ['R062', 'R064'].includes(r.id) ? firstSentence(r.detail) : r.id === 'R063' ? r.detail.replace(/610为EBRW单项要求，不是SAT总分。$/, '') : r.detail }));
    if (m.note) details.push({ title: '补充说明', text: m.note });
    if (m.id === 'english') details.push({ title: '申请豁免时', text: '按“语言考试与豁免”中集中列出的条件及证明范围准备。' });
    if (!details.length && m.source?.quote) details.push({ title: '材料说明', text: m.source.quote });
    return { id: m.id, label: m.label, parts: details, sources: ids.length ? sources(ids) : [m.source].filter(Boolean), optional: m.required === false };
  });
  const extraMaterials = [
    ['ib-qualification', 'IB Diploma／预估成绩（适用时）', 'R044'],
    ['alevel-qualification', 'A-Level证书／预估成绩（适用时）', 'R045'],
    ['preparatory-certificate', '预备课程毕业证明（F路径）', 'R046'],
    ['equivalency-certificate', '同等学力考试证明（G路径）', 'R047'],
    ['japan-equivalency-certificate', '日本高卒认定合格证明（H路径）', 'R048']
  ];
  for (const [id, label, rule] of extraMaterials) if (byId.has(rule)) {
    const details = parts([rule]);
    if (rule === 'R044' && p.id === 'GLA') details.push({ title: '申请IB英语豁免', text: 'IB在读者另须提交English Language Test Score Waiver Request Form；录取后、入学前须由IBO直送最终成绩。已取得IB者按上述结果上传及直送要求办理。' });
    materials.push({ id, label, parts: details, sources: sources([rule, ...(rule === 'R044' && p.id === 'GLA' ? ['R066'] : [])]) });
  }
  if (byId.has('R012')) {
    const detail = byId.get('R012').detail.split('；').slice(1).join('；');
    if (detail) materials.push({ id: 'early-graduation', label: '跳级／提前毕业说明（适用时）', parts: [{ title: '学校正式说明', text: detail }], sources: sources(['R012']) });
  }
  if (byId.has('R085')) materials.push({ id: 'academic-exams', label: '学术标准化考试成绩', optional: p.academicTests.status === 'optional', parts: [{ text: '可提交SAT、ACT或国家大学入学考试结果，接受范围见学历资格中的学术考试说明。' }, ...parts(['R086'])], sources: sources(['R085', 'R086']) });
  const languageFormats = rows(['R018', 'R019', 'R020']);
  if (p.id === 'GLA' && byId.has('R062')) languageFormats.push({ ...byId.get('R062'), topic: 'Cambridge范围', detail: '只接受所列C1 Advanced，不接受B2 First和C2 Proficiency。' });
  if (p.id === 'JDP' && byId.has('R064')) languageFormats.push({ ...byId.get('R064'), topic: 'ACT考试形式', detail: '不接受Superscore，须提交指定一次考试成绩。' });
  const post = requirements.filter(r => ['入学后', '赴AU前'].includes(r.stage));
  return { paths, academic, waivers, materials,
    materialNotes: parts(['R035', 'R037', 'R039', 'R040']), materialNoteSources: sources(['R035', 'R037', 'R039', 'R040']),
    languageFormats, post, enrollmentSource: sources(['R002'])[0],
    // Citizenship-only GLA Group A and Australian-domestic exceptions are outside the default CN/JP view.
    audience: '中国籍／日本籍申请人', sourceFor: row => rowSource(p, row) };
}

export function renderProjectDetail(p, ui) {
  const { esc, icon, tag, button, evidence, showSources = false } = ui;
  const view = buildProjectView(p);
  const refs = sources => {
    const seen = new Set();
    return sources.filter(Boolean).filter(s => { const key = JSON.stringify(s); if (seen.has(key)) return false; seen.add(key); return true; }).map(evidence).join(' ');
  };
  const hint = (label, parts) => parts?.length ? `<button type="button" class="info-hint" data-act="detail-info" data-info="${esc(JSON.stringify({ label, parts }))}" aria-label="查看${esc(label)}说明" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>` : '';
  const compactRows = rows => rows.map(r => `<div class="compact-rule"><strong>${esc(r.topic)}</strong><div>${esc(r.detail)} ${evidence(view.sourceFor(r))}</div></div>`).join('');
  const pathRows = [];
  for (let i = 0; i < view.paths.length; i += 2) pathRows.push(`<tr>${view.paths.slice(i, i + 2).map(path => `<td data-path="${esc(path.id)}"${i + 1 === view.paths.length ? ' colspan="2"' : ''}><div class="path-heading"><span class="path-letter">${esc(path.id)}</span><strong>${esc(path.label)}</strong></div><p>${esc(path.description)} ${refs(path.sources)}</p></td>`).join('')}</tr>`);
  const nav = [['academic', '学历与资格'], ['language', '语言成绩'], ['materials', '申请材料'], ['rounds', '申请轮次'], ...(view.post.length ? [['after', '后续要求']] : [])];
  const subscore = value => typeof value === 'number' ? `≥ ${value}` : value === '不适用' ? '—' : value || '未注明';
  const scores = p.language.map(l => `<tr data-score="${esc(l.id)}"><td><strong>${esc(l.exam)}</strong>${l.scale && l.scale !== '未注明' ? `<small class="round-meta">${esc(l.scale)} 分制 · ${esc(l.version)}</small>` : l.version && l.version !== '未注明' ? `<small class="round-meta">${esc(l.version)}</small>` : ''}${l.note ? `<small class="score-note">${esc(l.note)}</small>` : ''} ${evidence(l.source)}</td><td><strong>≥ ${esc(l.score)}</strong><small class="round-meta">${esc(l.basis)}</small></td>${['reading', 'listening', 'writing', 'speaking'].map(k => `<td>${esc(subscore(l[k]))}</td>`).join('')}</tr>`).join('');
  const rounds = p.rounds.map(r => `<tr><td><strong>${esc(r.enrollmentDate || r.intake)}</strong><small class="round-meta">入学 · 第${esc(r.period)}轮</small></td><td>${esc(r.applyStart)} ${esc(r.startTime)}<small class="round-meta">至 ${esc(r.applyEnd)} ${esc(r.endTime)}</small></td><td>${r.first ? `<small class="round-meta">初筛 ${esc(r.first)}</small>` : ''}${r.interview && r.interview !== '不适用' ? `<small class="round-meta">面试 ${esc(r.interview)}</small>` : ''}<strong>${esc(r.final)}</strong><small class="round-meta">最终结果</small>${r.note ? hint('选拔结果说明', [{ text: r.note }]) : ''}${evidence(r.source)}</td></tr>`).join('');
  return `<div class="project-detail">
    <section class="panel section project-heading-panel">
      <div class="program-title"><div><div class="flex wrap">${tag(p.school)}${tag(p.year + ' 入学')}${tag(p.degree)}</div><h1>${esc(p.id)} · ${esc(p.name)}</h1><p class="english">${esc(p.englishName)}</p><p class="muted small">${esc(p.channel)}${p.partner ? ' · 合作院校：' + esc(p.partner) : ''}</p></div><div class="project-actions">${button(icon('edit') + ' 编辑规则', 'edit-program', `data-id="${p.id}"`)}${button('选择学生检查', 'select-student', `data-id="${p.id}"`, 'primary')}</div></div>
      <div class="source-panel detail-section" id="detail-sources"><div class="source-summary"><strong>原文与版本</strong><span>${esc(p.year)} 招生手册 · v${esc(p.version)}</span><span class="source-audience">${esc(view.audience)}</span></div><div class="source-actions"><button type="button" class="source-switch" role="switch" aria-checked="${showSources}" data-act="toggle-sources"><span>显示详细原文链接</span><span class="switch-track" aria-hidden="true"></span></button><a class="btn ghost sm" href="/sources/aohb27.pdf" target="_blank" rel="noopener">完整原文 ${icon('eye')}</a>${button('修改记录', 'program-history', `data-id="${p.id}"`, 'ghost sm')}</div></div>
      <nav class="rule-nav" aria-label="项目要求导航">${nav.map(([key, label]) => `<a href="#program/${p.id}/${key}">${label}</a>`).join('')}</nav>
    </section>
    <section class="panel section detail-section" id="detail-academic"><div class="panel-head"><h2>学历资格与身份</h2><span class="muted small">以下路径满足其一</span></div><table class="qualification-table" aria-label="学历资格路径"><tbody>${pathRows.join('')}</tbody></table>${view.academic.length ? `<div class="panel-body academic-notes">${compactRows(view.academic)}</div>` : ''}</section>
    <section class="panel section detail-section" id="detail-language"><div class="panel-head"><h2>语言考试与豁免</h2><span class="muted small">任选一种 · 所列总分及单项均须满足</span></div><div class="table-wrap"><table class="score-table"><thead><tr><th>考试／版本</th><th>最低分</th><th>阅读</th><th>听力</th><th>写作</th><th>口语</th></tr></thead><tbody>${scores}</tbody></table></div><div class="panel-body"><p class="language-validity">有效期：所选申请截止日前${esc(p.languagePolicy.validYears)}年内参加，且成绩在申请期间可获得。<span class="muted">“未注明”表示手册未列单项门槛；“—”表示不适用。</span> ${evidence(p.languagePolicy.source)}</p><div class="language-formats">${compactRows(view.languageFormats)}</div>${view.waivers.map(w => `<div class="waiver-block"><h3>${esc(w.title)}</h3>${w.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}<div class="source-links">${refs(w.sources)}</div></div>`).join('')}</div></section>
    <section class="panel section detail-section" id="detail-materials"><div class="panel-head"><h2>申请材料 ${hint('材料通用要求', view.materialNotes)}</h2><span class="muted small">停留或点击 ⓘ 查看说明</span><div class="source-links">${refs(view.materialNoteSources)}</div></div><div class="material-grid">${view.materials.map(m => `<div class="material-item"><div class="material-name"><span>${esc(m.label)}${m.optional ? '<small class="material-optional">选交</small>' : ''}</span>${hint(m.label, m.parts)}</div><div class="source-links">${refs(m.sources)}</div></div>`).join('')}</div></section>
    <section class="panel section detail-section" id="detail-rounds"><div class="panel-head"><h2>申请轮次</h2><span class="muted small">均为日本时间</span></div><div class="panel-body rounds-intro"><div><strong>选拔方式</strong><span>${esc(p.interview.detail)}</span>${evidence(p.interview.source)}</div><p>所需学历资格须在对应入学节点前取得；未如期取得将撤销录取。${evidence(view.enrollmentSource)}</p></div><div class="table-wrap"><table class="rounds-table"><thead><tr><th>入学节点／轮次</th><th>申请期间</th><th>选拔日期</th></tr></thead><tbody>${rounds}</tbody></table></div><div class="panel-body rounds-footer"><div class="compact-rule"><strong>学费</strong><div>${p.tuition.status === 'published' ? `${esc(p.tuition.amount)} ${esc(p.tuition.currency)} / ${esc(p.tuition.period)}` : `${esc(p.year)}年度金额未注明。`} ${evidence(p.tuition.source)}</div></div><div class="compact-rule"><strong>併愿与重复申请</strong><div>併愿：${p.combination.parallel === 'allowed' ? '允许' : p.combination.parallel === 'forbidden' ? '不允许' : '未注明'}；跨轮次重申：${p.combination.reapply === 'allowed' ? '允许' : p.combination.reapply === 'forbidden' ? '不允许' : '未注明'}。${esc(p.combination.materials)}。${esc(p.combination.referenceReuse)}。 ${evidence(p.combination.source)}</div></div></div></section>
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
