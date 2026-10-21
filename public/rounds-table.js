const compactEnd = (start, end) => start?.slice(0, 4) === end?.slice(0, 4) ? end.slice(5) : end;
function interviewDates(value) {
  const dates = String(value || '').split(' / ');
  return dates.length === 2 && dates[0].slice(0, 7) === dates[1].slice(0, 7) ? `${dates[0]}、${dates[1].slice(8)}` : value;
}

export function renderRoundsTable(programs, ui, withPrograms = true) {
  const { esc, evidence } = ui;
  const rows = programs.flatMap(p => p.rounds.map(round => ({ p, round })));
  const sameTime = rows.every(({ round }) => round.startTime === '10:00' && round.endTime === '23:00' && round.timezone === 'Asia/Tokyo');
  return `<p class="round-time-note">${sameTime ? '日本时间：申请开始日 10:00 开放，截止日 23:00 关闭。' : '申请时间按各轮次标注的时区；日期完整信息可查看单元格提示。'}</p><div class="table-wrap"><table class="rounds-table compact-rounds"><thead><tr>${withPrograms ? '<th>项目</th>' : ''}<th>入学节点</th><th>轮次</th><th>申请期间</th><th>初筛</th><th>面试</th><th>最终结果</th></tr></thead><tbody>${rows.map(({ p, round: r }) => `<tr data-round="${esc(p.id + ':' + r.id)}">${withPrograms ? `<td><a href="#program/${esc(p.id)}">${esc(p.id)}</a></td>` : ''}<td>${esc(r.enrollmentDate || r.intake)}</td><td>第${esc(r.period)}轮</td><td title="${esc(`${r.applyStart} ${r.startTime} 至 ${r.applyEnd} ${r.endTime}（${r.timezone}）`)}">${esc(r.applyStart)} — ${esc(compactEnd(r.applyStart, r.applyEnd))}${!sameTime ? `<span class="round-times"> ${esc(r.startTime)} / ${esc(r.endTime)} (${esc(r.timezone)})</span>` : ''}</td><td>${esc(r.first || '—')}</td><td title="${esc(r.interview || '不适用')}">${r.interview && r.interview !== '不适用' ? esc(interviewDates(r.interview)) : '—'}</td><td><strong>${esc(r.final)}</strong>${r.note ? `<button type="button" class="info-hint" data-act="detail-info" data-info="${esc(JSON.stringify({ label: `${p.id} 第${r.period}轮选拔说明`, parts: [{ text: r.note }] }))}" aria-label="查看${esc(p.id)}第${esc(r.period)}轮选拔说明" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>` : ''}${evidence(r.source)}</td></tr>`).join('')}</tbody></table></div>`;
}
