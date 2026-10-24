import { renderDocumentBadge, documentStatusKey } from './document-status.js';
import { renderAutoReview } from './document-auto-review.js';

const schoolAliases = new Map([
  ['waseda university', '早稻田大学'], ['早稲田大学', '早稻田大学'],
  ['ritsumeikan university', '立命馆大学'], ['立命館大学', '立命馆大学'],
  ['sophia university','上智大学'], ['tohoku university','东北大学'], ['東北大学','东北大学'],
  ['hiroshima university','广岛大学'], ['広島大学','广岛大学'], ['rikkyo university','立教大学']
]);
export function normalizeSchool(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  return schoolAliases.get(name.toLowerCase()) || name;
}
export function matchingDocumentPrograms(programs, school, year) {
  if (!school || !year) return [];
  return programs.filter(p => normalizeSchool(p.school) === normalizeSchool(school) && p.year === Number(year));
}
export function blankDocumentProgram(scope, sourceId) {
  const source = () => ({ sourceId, page: '', quote: '' });
  return {
    id: '', name: scope.englishName || '', englishName: scope.englishName || '',
    school: normalizeSchool(scope.school), year: Number(scope.year), channel: scope.channel || '',
    direction: '', degree: '', partner: null, version: 0, reviewed: false, reviewNote: '',
    paths: [], rounds: [], language: [], waivers: [], materials: [], hardConditions: [], requirements: [],
    languagePolicy: { validYears: null, availabilityRequired: null, allowSuperscore: null, excludedFormats: [], source: source() },
    tuition: { status: 'unspecified', amount: null, currency: '', period: '', year: Number(scope.year), source: source() },
    interview: { status: 'unspecified', detail: '', source: source() },
    academicTests: { status: 'unspecified', source: source() },
    combination: { parallel: 'unspecified', reapply: 'unspecified', materials: '', referenceReuse: '', source: source() },
    sourceIds: [sourceId], coverage: ''
  };
}
export const documentUrl = id => id === 'aohb27' ? '/sources/aohb27.pdf' : '/uploads/' + encodeURIComponent(id);

export function renderDocumentStatus(d, ui) {
  const { esc, button } = ui;
  const progress={queued:d.autoRetryCount?'连接中断后已自动安排重试，原文和已保存内容均保留。':'已加入处理队列，轮到后会自动开始。',parsing:d.organizingProgress?.phase==='pdf'?`正在识别第 ${d.organizingProgress.page} / ${d.organizingProgress.pages} 页，完成后自动整理规则。`:'正在提取原文，完成后会自动识别项目并整理规则。',extracting:d.organizingProgress?.phase==='writing'?'正在逐步接收整理结果，完整检查后将显示疑点。':'正在识别学校、年份、项目及完整申请要求，并检查疑点。'}[d.status];
  const retry=['error','uploaded'].includes(d.status)||d.status==='review'&&!d.autoReview&&!d.hasReview&&!d.projectDraft;
 const removable=!d.builtin&&!d.linkedPrograms?.length&&['review','error','uploaded','needs_configuration'].includes(d.status);
 return `<div class="document-state"><div class="between wrap section"><div>${renderDocumentBadge(d,ui)} <a class="link" href="${documentUrl(d.id)}" target="_blank" rel="noopener">查看原文件</a></div><div class="flex wrap">${button('刷新状态','document',`data-id="${esc(d.id)}"`,'sm')}${retry?button(d.status==='error'?'重试自动整理':'自动整理','parse-document',`data-id="${esc(d.id)}"`,'primary sm'):''}${removable?button('删除上传资料','delete-document',`data-id="${esc(d.id)}" data-status-version="${d.statusVersion||0}"`,'sm danger'):''}</div></div>
    ${d.status === 'error' && d.error ? `<div class="error-box">${esc(d.error)}</div>` : ''}${progress?`<div class="note">${progress} 结果会自动更新，可以关闭窗口继续工作。</div>`:''}</div>`;
}

export function renderDocumentReview(d, programs, ui) {
  const { esc, badge, button, field, select, tag, empty } = ui;
  if(!d.projectDraft)return `<div class="document-review" data-document-id="${esc(d.id)}" data-content-status="${esc(documentStatusKey(d))}"><div class="document-steps"><span>1. 上传文件</span><strong>2. 核对高亮疑点</strong><span>3. 整体确认入库</span></div>${renderDocumentStatus(d,ui)}<div class="document-content">${renderAutoReview(d,ui)}${d.text?`<details><summary>查看完整提取原文</summary><pre class="document-extracted-text">${esc(d.text)}</pre></details>`:''}</div></div>`;
  const scope = d.reviewScope || d.analysis || {};
  const candidates = matchingDocumentPrograms(programs, scope.school, scope.year);
  const draft = d.projectDraft;
  const association = draft ? `<section class="document-association section"><h3>项目草稿 · ${esc(draft.target.school)} · ${esc(draft.target.year)}</h3><p class="muted small">${draft.target.mode === 'create' ? '新建项目' : '更新 ' + esc(draft.target.programId)} · 草稿不参与查询和匹配</p>${button('继续整理草稿', 'resume-document-draft', `data-id="${esc(d.id)}"`, 'primary sm')}</section>` : `<form id="document-target-form" class="document-association section" data-id="${esc(d.id)}">
    <h3>确认资料归属</h3><p class="muted small">根据封面识别，开始整理前请核对学校和入学年份。</p>
    <div class="form-grid">${field('所属学校', 'document-school', scope.school || '')}${field('入学年份', 'document-year', scope.year || '', 'number')}${select('处理方式', 'document-mode', 'create', [['create', '新建项目草稿'], ['update', '更新已有项目']])}<div id="document-project-choice" hidden>${select('同校、同年份项目', 'document-project', '', [['', '请选择项目'], ...candidates.map(p => [p.id, p.id + ' · ' + p.name + ' · ' + p.channel])])}</div></div>
    <p id="document-target-note" class="feedback-line">新项目从空白规则开始，核对后再发布。</p><button class="btn primary sm" type="submit">开始整理</button></form>`;
  return `<div class="document-review" data-document-id="${esc(d.id)}" data-content-status="${esc(documentStatusKey(d))}">${renderDocumentStatus(d,ui)}<div class="document-content">
    ${d.status === 'review' && d.text ? association : ''}
    ${d.suggestions?.length ? `<div class="note section">以下为原文定位建议。请逐项核对适用范围、条件和例外，再整理为项目规则。</div>${d.suggestions.map(s => `<div class="requirement"><div class="flex wrap">${s.fields.map(tag).join('')}${s.page ? `<a class="link small" href="${documentUrl(d.id)}#page=${s.page}" target="_blank" rel="noopener">PDF 第 ${s.page} 页</a>` : `<span class="muted small">提取文本第 ${s.line} 行 · 页码待确认</span>`}</div><p>${esc(s.text)}</p></div>`).join('')}` : d.status === 'review' ? empty('没有发现已识别的字段关键词', '可直接阅读提取文本，人工整理项目规则。') : ''}
    ${d.text ? `<details><summary>完整提取文本</summary><pre class="document-extracted-text">${esc(d.text)}</pre></details>` : ''}</div></div>`;
}
