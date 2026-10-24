import { programLabel } from './imported-requirement-model.js';

// Presentation only: channel, IDs and admission rules remain on each record.
export function programEntryLabel(program) {
  const raw = String(program.channel || '').trim();
  if (!raw) return '申请类型未注明';
  // Scholarship appendices and special selection names cannot be inferred to
  // be an ordinary first-year/transfer application from a passing mention.
  if (/奖学金|附录|仅含|Japan-Expert|两阶段/i.test(raw)) return raw;
  let entry = '';
  if (/编入|转入|transfer/i.test(raw)) {
    const years = /二[、和及／/・]三|second.*third/i.test(raw) ? '二、三年级' : /三年级|third.year/i.test(raw) ? '三年级' : /二年级|second.year/i.test(raw) ? '二年级' : '';
    entry = years + (/编入.*转入/.test(raw) ? '编入／转入' : /转入/.test(raw) ? '转入' : '编入');
  } else if (/一年级|first.year|freshman/i.test(raw)) entry = '一年级申请';
  if (!entry) return raw;
  const type = raw.match(/Type\s*[A-Z]/i)?.[0].replace(/Type\s*/i, 'Type ');
  const language = /日语|日本語/.test(raw) ? '日语' : /英语|English/i.test(raw) ? '英语' : '';
  return [entry, type, language].filter(Boolean).join(' · ');
}

export function buildProgramLabels(programs) {
  const labels = new Map(programs.map(p => [p.id, programLabel(p)]));
  const distinguish = suffix => {
    const groups = new Map();
    for (const p of programs) {
      const label = labels.get(p.id);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(p);
    }
    for (const group of groups.values()) if (group.length > 1) {
      for (const p of group) labels.set(p.id, labels.get(p.id) + ' · ' + suffix(p));
    }
  };
  distinguish(programEntryLabel);
  distinguish(p => p.name || p.englishName || p.id);
  distinguish(p => p.channel || '申请类型未注明');
  distinguish(p => `${p.school} ${p.year}`);
  distinguish(p => p.id);
  return labels;
}

export function renderProgramScope(ids, programs, ui) {
  const selected = programs.filter(p => ids.includes(p.id));
  const { esc } = ui, label = ui.programLabel || programLabel;
  if (!selected.length) return '<span class="muted">适用项目待核实</span>';
  const links = selected.map(p => `<a href="#program/${esc(p.id)}" title="${esc(p.name + ' · ' + (p.channel || ''))}">${esc(label(p))}</a>`).join('');
  if (selected.length === programs.length && selected.length <= 8) return `<span class="scope-all">${selected.length === 1 ? esc(label(selected[0])) : `全部 ${selected.length} 项目`}</span>`;
  if (selected.length <= 2 && selected.every(p => label(p).length <= 24)) return `<span class="scope-programs">${links}</span>`;
  const expandedLinks=selected.map(p=>`<a href="#program/${esc(p.id)}"><strong>${esc(label(p))}</strong><span>${esc(p.name)}</span></a>`).join('');
  return `<details class="program-scope"><summary>${selected.length === programs.length ? '全部' : '适用'} ${selected.length} 个项目</summary><div class="scope-programs">${expandedLinks}</div></details>`;
}
