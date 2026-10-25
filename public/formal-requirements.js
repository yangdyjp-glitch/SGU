import { programLabel } from './imported-requirement-model.js';
import { buildProgramTitles } from './program-presentation.js';
import { conciseText, renderReadableText } from './plain-language.js';

// The concise tables never replace the complete, versioned source clauses.
export function renderStoredRequirements(programs, ui) {
  const imported=programs.filter(p=>p.semanticVersion===1);
  if(!imported.length)return '';
  const {esc,evidence}=ui;
  const titles=ui.programTitle?null:buildProgramTitles(programs), label=ui.programTitle||(p=>titles.get(p.id)||programLabel(p));
  const content = row => `${renderReadableText(row.detail,esc)} <small class="muted">${esc(row.nature)}</small> ${evidence(row.source)}${conciseText(row.detail)!==row.detail?`<details class="copy-original"><summary>原始表述</summary><p>${esc(row.detail)}</p></details>`:''}`;
  return `<section class="panel section detail-section" id="detail-complete"><div class="panel-head"><h2>全部招生要求</h2><span class="muted small">含细则、例外和原文出处</span></div>${imported.map(p=>`<details class="stored-requirements"><summary>${esc(label(p))} · ${p.requirements.length} 条</summary>${p.verificationNotes?.length?`<details class="stored-verification"><summary>仍待核实（${p.verificationNotes.length} 处）</summary><ul>${p.verificationNotes.map(note=>`<li>${renderReadableText(note.reason,esc,{expandable:false})} ${evidence(note.source)}</li>`).join('')}</ul></details>`:''}<div class="table-wrap"><table class="stored-requirement-table"><thead><tr><th>阶段</th><th>事项</th><th>要求</th></tr></thead><tbody>${p.requirements.map(row=>`<tr data-stored-requirement="${esc(p.id+':'+row.id)}"><td>${esc(row.stage)}</td><th scope="row">${esc(conciseText(row.topic))}</th><td>${content(row)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</section>`;
}
