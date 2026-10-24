import { admissionLabels, renderAdmissionContent, readableAdmissionValue, sourceLink } from './admissions-content.js';

export function renderAutoReview(d,ui){
 const {esc,button}=ui,review=d.autoReview;
 if(d.status==='published')return `<div class="note section"><strong>已整体确认入库</strong><p>${esc(d.confirmedBy)} 已确认 ${d.linkedPrograms.length} 个项目。完整规则、原文出处及版本已保存。</p></div><div class="stack">${review.entries.map(({program:p})=>`<a class="btn" href="#program/${esc(p.id)}" data-act="open-published-program">${esc(p.school)} · ${esc(p.name)}</a>`).join('')}</div>`;
 if(d.status==='needs_configuration')return `<div class="note section">原文件已保留。管理员在<a href="#settings" data-act="open-settings" class="link">团队设置</a>保存 OpenAI 密钥后会自动继续整理，无须重新上传。</div>`;
 if(d.status!=='review'||!review)return '';
 const globalDoubts=review.doubts||[],entries=review.entries;
 const updates=entries.filter(e=>e.mode==='update').length,creates=entries.length-updates;
 const associations=entries.filter(e=>e.association?.state==='possible').length;
 const count=globalDoubts.length+entries.reduce((sum,e)=>sum+e.issues.length,0);
 const blocked=entries.some(e=>e.issues.some(i=>i.kind==='blocking'));
 const doubt=(i,index)=>`<li class="${i.kind==='blocking'?'blocking-doubt':''}"><strong>${esc(admissionLabels[i.path?.split('/')[1]]||'原文核对')}：</strong>${esc(i.reason)}${i.source?.quote?`<blockquote><mark>${esc(i.source.quote)}</mark> ${sourceLink(i.source,esc)}</blockquote>`:sourceLink(i.source,esc)}</li>`;
 const renderIssues=issues=>{
  const groups=new Map(),main=[];
  for(const issue of issues){if(/^(该条原文引用未能|引用内容与标注页码|来源页码未能|原文页码待确认)/.test(issue.reason)){const list=groups.get(issue.reason)||[];list.push(issue);groups.set(issue.reason,list);}else main.push(issue);}
  return main.map(doubt).join('')+[...groups].map(([reason,items])=>items.length===1?doubt(items[0]):`<li><details><summary><strong>${esc(reason)}（${items.length} 处）</strong></summary><ul>${items.map(doubt).join('')}</ul></details></li>`).join('');
 };
 const association=(entry,index)=>{
  if(entry.association?.state==='possible')return `<form class="document-association-choice note warning" data-association-form data-id="${esc(d.id)}" data-version="${review.version}" data-index="${index}"><label><strong>发现可能相同的项目，请核对归属</strong><select name="targetId" required><option value="" disabled selected>请选择更新对象，或确认为独立项目</option>${entry.association.candidates.map(p=>`<option value="${esc(p.id)}">更新：${esc(p.name)} · ${esc(p.channel)} · v${p.version}</option>`).join('')}<option value="new">这是独立项目</option></select></label><label>归属说明（独立项目必填）<input name="independentReason" maxlength="1000" placeholder="例如：适用申请人或选拔方式不同"></label><button class="btn sm" type="submit">确认归属并查看变更</button></form>`;
  if(entry.mode==='update')return `<div class="note section"><strong>将更新现有项目 · v${entry.expectedVersion} → v${entry.expectedVersion+1}</strong><p class="small">${esc(entry.association?.reason||'已找到相同项目')}。确认后保留原项目编号、旧版本及原文。</p></div>`;
  return entry.association?.independentReason?`<p class="muted small">独立项目依据：${esc(entry.association.independentReason)}</p>`:'';
 };
 return `<div class="auto-review-summary section"><div><h3>整理完成 · ${entries.length} 个项目</h3><p>${esc(review.summary)}</p></div><span class="badge ${count?'unknown':'pass'}">${count?count+' 处需留意':'未发现明显疑点'}</span></div>
  ${d.duplicateUploads?.length?`<div class="note warning section"><strong>这份文件已上传过，文件内容完全相同</strong><p>${d.duplicateUploads.map(file=>esc(file.name)).join('；')}</p><p class="small">如不需要再次整理，可删除本次上传；需要采用本次整理结果时，请核对下方变更后更新现有项目。</p></div>`:''}
  ${updates?`<div class="note warning section"><strong>发现 ${updates} 个已收录项目</strong><p>本次将更新 ${updates} 个现有项目${creates?'，另有 '+creates+' 个项目待入库':''}。更新会生成新版本，原有规则及修改记录仍可查看和回档。</p></div>`:''}
  <div class="note ${count?'warning':''} section">${count?'疑点及变更已用黄色标出，请结合原文集中核对。':'请整体浏览整理结果，必要时打开原文核对。'} 无需逐条勾选，最后整体确认即可。确认后仍未明确的条件会保留为“待核实”。</div>
  ${globalDoubts.length?`<section class="doubt-panel section"><h3>文件整体疑点</h3><ul>${globalDoubts.map(doubt).join('')}</ul></section>`:''}
  ${entries.map((entry,index)=>{const p=entry.program;return `<article class="auto-review-program section"><header class="between wrap"><div><h3>${esc(p.school||'学校待确定')} · ${esc(p.name||'项目待确定')}</h3><p class="muted small">${esc(p.year||'年份待确定')} 入学 · ${esc(p.channel||'通道待确定')}</p></div><span class="tag">${entry.association?.state==='possible'?'归属待核对':entry.mode==='update'?'更新已有项目':'新建项目'}</span></header>${association(entry,index)}${entry.issues.length?`<div class="doubt-panel"><ul>${renderIssues(entry.issues)}</ul></div>`:''}${entry.changes.length?`<details class="admission-changes"><summary>查看与已入库版本的变化（${entry.changes.length} 项）</summary>${entry.changes.map(c=>`<div class="admission-change"><h4>${esc(admissionLabels[c.field]||c.field)}</h4><div class="grid2"><div><small class="muted">现有版本</small><pre>${esc(readableAdmissionValue(c.before))}</pre></div><div><small class="muted">本次整理</small><pre>${esc(readableAdmissionValue(c.after))}</pre></div></div></div>`).join('')}</details>`:''}<details class="auto-review-details" ${entries.length===1?'open':''}><summary>完整资格、成绩、材料与申请时间</summary>${renderAdmissionContent(p,ui,entry.issues)}</details></article>`;}).join('')}
  <form id="document-feedback-form" class="section" data-id="${esc(d.id)}" data-version="${review.version}"><label for="document-feedback"><strong>如需修正，填写核对意见</strong></label><textarea id="document-feedback" name="feedback" rows="2" maxlength="12000" placeholder="例如：这里的 2027 年指入学年份；这个条件仅适用于第二申请轮次。">${esc(d.reviewerFeedback||'')}</textarea><button class="btn sm" type="submit">按核对意见重新整理</button></form>
  ${entries.length?`<div class="auto-review-confirm"><div><strong>整体核对后，一次确认全部 ${entries.length} 个项目</strong><p class="muted small">${associations?'请先核对上方项目归属。':blocked?'请先通过核对意见修正上方红色标记的问题，再整体确认。':'将保留完整要求及来源，并记录本次确认人和版本。'}</p></div>${button(updates?(creates?'更新现有项目并入库新项目':'更新现有项目（'+updates+' 个）'):'整体确认并入库（'+entries.length+' 个项目）','confirm-document',`data-id="${esc(d.id)}" data-version="${review.version}" data-action="${updates?'update':'create'}" ${blocked?'disabled':''}`,'primary')}</div>`:'<div class="note">这份文件尚未识别出可入库的招生项目。可以补充核对意见后重新整理。</div>'}`;
}
