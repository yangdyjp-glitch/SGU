import { conciseText, renderReadableText, joinCopy } from './plain-language.js';

export function renderInfoHint(label, parts, esc) {
  if (!parts?.length) return '';
  return `<button type="button" class="info-hint" data-act="detail-info" data-info="${esc(JSON.stringify({ label, parts }))}" aria-label="查看${esc(label)}说明" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>`;
}

// Long school matrices resolve detailed evidence on interaction, rather than
// repeating the same source quotations in hundreds of HTML attributes.
export function detailInfoAttribute(getInfo, ui) {
  return ui.registerInfo ? `data-info-key="${ui.esc(ui.registerInfo(getInfo))}"` : `data-info="${ui.esc(JSON.stringify(getInfo()))}"`;
}

// Ordinary hints retain their text layout; qualification hints show each
// underlying type and its evidence without turning an unknown into a rejection.
export function renderDetailInfoContent(info, esc, evidence = () => '') {
  const refs = sources => [...new Map((sources || []).filter(Boolean).map(source => [JSON.stringify(source), source])).values()].map(evidence).join(' ');
  const paragraph = text => renderReadableText(text, esc, {limit:220});
  const heading = text => esc(conciseText(text));
  const distinctParts = parts => [...new Map((parts || []).filter(part=>part.text).map(part=>[JSON.stringify([part.title,conciseText(part.text)]),part])).values()];
  const materialParts = row => {
    const parts=distinctParts(row.parts);
    const metadata=parts.filter(part=>['适用阶段','提交要求'].includes(part.title));
    const details=parts.filter(part=>!metadata.includes(part));
    const facts=metadata.filter(part=>part.title!=='提交要求'||conciseText(part.text)!==row.status);
    return `${facts.length?`<p class="material-facts">${esc(joinCopy(facts.map(part=>part.text),' · '))}</p>`:''}${details.map(part=>`<div class="hint-part">${part.title?`<b>${heading(part.title)}</b>`:''}<p>${part.raw?esc(part.text).replace(/\n/g,'<br>'):paragraph(part.text)}</p></div>`).join('')}`;
  };
  const states = { accepted: '可申请', excluded: '不接受', unknown: '需核实' };
  const parts = (info.parts || []).map(part => {
    if (part.materialVariants) return `<div class="material-variant-list">${part.programChoices.length>1?`<label class="material-project-filter">项目<select data-material-project-filter><option value="">全部适用项目（${part.programChoices.length}）</option>${part.programChoices.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></label>`:''}${part.materialVariants.map(row=>`<details class="material-variant" data-material-programs="${esc(JSON.stringify(row.programs))}" ${part.materialVariants.length===1?'open':''}><summary><span title="${esc(row.label)}">${heading(row.label)}</span><small>${esc(row.status)}${part.programChoices.length>1?' · '+row.programs.length+' 个项目':''}</small></summary><div>${part.programChoices.length>1?`<p class="material-variant-scope">适用：${esc(part.programChoices.filter(p=>row.programs.includes(p.id)).map(p=>p.title).join(' / '))}</p>`:''}${materialParts(row)}<div class="material-variant-sources">${refs(row.sources)}</div></div></details>`).join('')}</div>`;
    if (part.rows) return `<section class="qualification-decision-section">${part.title ? `<h3>${esc(part.title)}</h3>` : ''}<table class="qualification-decision-table"><thead><tr><th scope="col">资格类型</th><th scope="col">结论</th><th scope="col">条件与依据</th></tr></thead><tbody>${part.rows.map(row => {
      const state = Object.hasOwn(states, row.state) ? row.state : 'unknown';
      const notes = distinctParts(row.notes).map(note => `<div class="hint-part">${note.title ? `<b>${heading(note.title)}</b>` : ''}<p>${paragraph(note.text)}</p></div>`).join('');
      return `<tr><th scope="row">${esc(row.label)}</th><td><span class="qualification-decision-status ${state}">${states[state]}</span></td><td><p>${paragraph(row.text)}</p>${refs(row.sources)}${notes ? `<details class="qualification-explanation"><summary>补充依据</summary>${notes}</details>` : ''}</td></tr>`;
    }).join('')}</tbody></table></section>`;
    if (part.collapsed) return `<details class="qualification-explanation"><summary>${esc(part.title || '补充说明')}</summary><p>${paragraph(part.text)}</p></details>`;
    return `<div class="hint-part">${part.title ? `<b>${heading(part.title)}</b>` : ''}<p>${paragraph(part.text)}</p></div>`;
  }).join('');
  return `<strong>${esc(info.label)}</strong>${parts}`;
}
