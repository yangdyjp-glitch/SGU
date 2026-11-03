import {majorCatalog,getProgramMajors,majorsAreInferred,normalizeMajors,majorFilterOptions,unspecifiedMajor} from './program-majors.js';

export function majorOptions(programs) {
 return [['','全部专业'],...majorFilterOptions(programs).map(v=>[v,v===unspecifiedMajor?'待确认':v])];
}
export function majorQueryOptions(programs,selected=[]) {
 const values=[...new Set([...majorCatalog,...majorFilterOptions(programs),...selected])];
 return [['','全部专业'],...(selected.length>1?[[selected.join('|'),selected.join(' 或 ')]]:[]),...values.map(v=>[v,v===unspecifiedMajor?'待确认':v])];
}
export function renderMajors(program,esc,{note=true}={}) {
 const majors=getProgramMajors(program);
 return `<span class="program-majors"><span class="major-label">专业</span>${majors.length?majors.map(v=>`<span class="tag">${esc(v)}</span>`).join(''):'<span class="muted">待确认</span>'}${note&&majorsAreInferred(program)?'<small class="muted major-inferred">根据已有项目名称／方向归类，待核对</small>':''}</span>`;
}
export function renderMajorEditor(program,esc) {
 const selected=getProgramMajors(program),other=selected.filter(v=>!majorCatalog.includes(v));
 return `<fieldset class="major-editor"><legend>专业（可多选）</legend><p class="muted small">按招生资料选择本项目涵盖的专业；无法确认时不选。${majorsAreInferred(program)?'当前勾选项根据项目名称／方向归类，请核对后保存。':''}</p><div class="major-choices">${majorCatalog.map(v=>`<label><input type="checkbox" name="majorTag" value="${esc(v)}" ${selected.includes(v)?'checked':''}>${esc(v)}</label>`).join('')}</div><label class="major-other">其他专业（多个用逗号分隔）<input name="majorOther" value="${esc(other.join('，'))}"></label></fieldset>`;
}
export function gatherMajors(formData) {
 return normalizeMajors([...formData.getAll('majorTag'),...String(formData.get('majorOther')||'').split(/[,，、;；\n]/)]);
}
