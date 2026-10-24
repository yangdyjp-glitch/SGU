import { programLabel } from './imported-requirement-model.js';
import { buildProgramTitles } from './program-presentation.js';

// The concise tables never replace the complete, versioned source clauses.
export function renderStoredRequirements(programs, ui) {
  const imported=programs.filter(p=>p.semanticVersion===1);
  if(!imported.length)return '';
  const {esc,evidence}=ui;
  const titles=ui.programTitle?null:buildProgramTitles(programs), label=ui.programTitle||(p=>titles.get(p.id)||programLabel(p));
  return `<section class="panel section detail-section" id="detail-complete"><div class="panel-head"><h2>完整招生条款</h2><span class="muted small">保留全部细则、例外与原文出处</span></div>${imported.map(p=>`<details class="stored-requirements"><summary>${esc(label(p))} · 全部 ${p.requirements.length} 条要求</summary>${p.verificationNotes?.length?`<details class="stored-verification"><summary>已确认资料中仍待核实的信息（${p.verificationNotes.length} 处）</summary><ul>${p.verificationNotes.map(note=>`<li>${esc(note.reason)} ${evidence(note.source)}</li>`).join('')}</ul></details>`:''}<div class="table-wrap"><table class="stored-requirement-table"><thead><tr><th>阶段</th><th>事项</th><th>完整要求</th></tr></thead><tbody>${p.requirements.map(row=>`<tr data-stored-requirement="${esc(p.id+':'+row.id)}"><td>${esc(row.stage)}</td><th scope="row">${esc(row.topic)}</th><td>${esc(row.detail)} <small class="muted">${esc(row.nature)}</small> ${evidence(row.source)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</section>`;
}
