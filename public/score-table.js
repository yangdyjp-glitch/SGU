import { renderInfoHint } from './detail-hints.js';
const specified = value => value && !/未注明|未说明|不适用/.test(value);
const subscore = value => typeof value === 'number' ? `≥ ${value}` : value === '不适用' ? '—' : value || '未注明';
export const minimumScoreText = row => !row?'未列明':typeof row.score==='number'?`≥ ${row.score}`:row.minimumStatus==='no-minimum'?'不设最低分':'未注明';

export function scoreNotes(row) {
  const scale = specified(row.scale) ? `${row.scale}分制` : '';
  const version = specified(row.version) ? row.version : '';
  const shortVersion = version
    .replace(/^考试日早于(\d{4}-\d{2}-\d{2})$/, '考试<$1')
    .replace(/^考试日自(\d{4}-\d{2}-\d{2})起$/, '考试≥$1');
  let note = row.note || '';
  if (note === '总分及4个单项均须满足') note = '总分及单项均达标';
  note = note.replace(/^each communicative skill\s*≥\s*(\d+(?:\.\d+)?)$/, '各单项≥$1');
  if (note === `不能写成SAT总分${row.score}；原文使用EBRW名称`) note = '按EBRW计分，非SAT总分';
  if (note === `不能写成ACT综合分${row.score}`) note = '非ACT综合分';
  return {
    text: [scale, shortVersion, note, row.basis?.length>16?'分数口径见说明':''].filter(Boolean).join('；'),
    full: [scale || row.scale, version, row.note, row.basis?.length>16?'分数口径：'+row.basis:''].filter(Boolean).join('；')
  };
}

// Both detail views share one row layout; score values and their basis remain
// separate from the shortened explanatory wording and the original evidence.
export function renderLanguageScoreTable(rows, ui, applies) {
  const { esc, evidence } = ui;
  const body = rows.map((row,index) => {
    const notes = scoreNotes(row);
    const basis=row.basis?.length>16?(typeof row.score==='number'?'口径见备注':''):row.basis || '口径未注明';
    const sources = [...new Map((row.sources || [row.source]).filter(Boolean).map(source => [JSON.stringify(source), source])).values()];
    return `<tr ${applies ? 'data-school-score' : 'data-score'}="${esc(row.id)}"${ui.scoreRowClass?.(row,index)?` class="${esc(ui.scoreRowClass(row,index))}"`:''}><td class="score-exam"><strong>${esc(row.exam)}</strong></td><td class="score-minimum"><strong>${esc(minimumScoreText(row))}</strong>${basis?`<span class="score-basis">（${esc(basis)}）</span>`:''}</td>${['reading', 'listening', 'writing', 'speaking'].map(key => `<td>${esc(subscore(row[key]))}</td>`).join('')}${applies ? `<td class="score-scope">${applies(row.programs)}</td>` : ''}<td class="score-notes"><span class="score-note-content"><span title="${esc(notes.full)}">${esc(notes.text || '—')}</span>${notes.full.length>50?renderInfoHint(row.exam+' · 完整考试',[{text:notes.full}],esc):''}${sources.map(evidence).join(' ')}</span></td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="score-table language-score-table${applies ? ' school-score-table' : ''}"><colgroup><col class="score-exam-col"><col class="score-minimum-col"><col span="4" class="score-skill-col">${applies?'<col class="score-scope-col">':''}<col></colgroup><thead><tr><th>考试</th><th>最低分</th><th>阅读</th><th>听力</th><th>写作</th><th>口语</th>${applies ? '<th>适用项目</th>' : ''}<th>备注</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
