import { programLabel } from './imported-requirement-model.js';
const compactEnd = (start, end) => start && end && start.slice(0, 4) === end.slice(0, 4) ? end.slice(5) : end || '待确定';
function interviewDates(value) {
  const dates = String(value || '').split(' / ');
  return dates.length === 2 && dates[0].slice(0, 7) === dates[1].slice(0, 7) ? `${dates[0]}、${dates[1].slice(8)}` : value;
}

export function renderRoundsTable(programs, ui, withPrograms = true) {
  const { esc, evidence } = ui;
  const rows = programs.flatMap(p => p.rounds.map(round => ({ p, round })));
  if(!rows.length)return '<p class="round-time-note">原文未列明申请轮次。</p>';
  const sameTime = rows.every(({ round }) => round.startTime === '10:00' && round.endTime === '23:00' && round.timezone === 'Asia/Tokyo');
  return `<p class="round-time-note">${sameTime ? '日本时间：申请开始日 10:00 开放，截止日 23:00 关闭。' : '申请时间按各轮次标注的时区；日期完整信息可查看单元格提示。'}</p><div class="table-wrap"><table class="rounds-table compact-rounds"><thead><tr>${withPrograms ? '<th>项目</th>' : ''}<th>入学节点</th><th>轮次</th><th>申请期间</th><th>初筛</th><th>面试</th><th>最终结果</th></tr></thead><tbody>${rows.map(({ p, round: r }) => {
    const missing=p.semanticVersion===1?'未注明':'—',interview=r.interview|| (p.interview.status==='not-required'?'不适用':missing);
    return `<tr data-round="${esc(p.id + ':' + r.id)}">${withPrograms ? `<td><a href="#program/${esc(p.id)}">${esc(programLabel(p))}</a></td>` : ''}<td>${esc(r.enrollmentDate || r.intake || '待确定')}</td><td>第${esc(r.period)}轮</td><td title="${esc(`${r.applyStart||'待确定'} ${r.startTime||'时刻未注明'} 至 ${r.applyEnd||'待确定'} ${r.endTime||'时刻未注明'}（${r.timezone||'时区未注明'}）`)}">${esc(r.applyStart||'待确定')} — ${esc(compactEnd(r.applyStart, r.applyEnd))}${!sameTime ? `<span class="round-times"> ${esc(r.startTime||'未注明')} / ${esc(r.endTime||'未注明')} (${esc(r.timezone||'时区未注明')})</span>` : ''}</td><td>${esc(r.first || missing)}</td><td title="${esc(interview)}">${interview==='不适用'?'—':esc(interviewDates(interview))}</td><td><strong>${esc(r.final||missing)}</strong>${r.note ? `<button type="button" class="info-hint" data-act="detail-info" data-info="${esc(JSON.stringify({ label: `${programLabel(p)} 第${r.period}轮选拔说明`, parts: [{ text: r.note }] }))}" aria-label="查看${esc(programLabel(p))}第${esc(r.period)}轮选拔说明" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>` : ''}${evidence(r.source)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
