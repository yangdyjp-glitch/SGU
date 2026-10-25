// Read-only presentation helpers. Never use the shortened text as a rule,
// source quotation, saved value, or evidence of acceptance.
const phrases = [
  ['学术标准化考试', '学术考试'],
  ['分数口径', '计分方式'],
  ['有效期计算节点', '有效期起算日'],
  ['资格取得节点', '资格取得时间'],
  ['预计取得的资格须按入学节点核对', '预计取得者须核对取得截止日'],
  ['预计取得须核对入学节点', '预计取得者须核对取得截止日'],
  ['须按入学节点核对', '须核对取得截止日'],
  ['各项具体规则', '各项规则'],
  ['原文未明确列明', '原文未说明'],
  ['手册未明确列明', '手册未说明'],
  ['原文未进一步说明', '原文未说明'],
  ['未进一步说明', '未说明'],
  ['手册未单独列明', '手册未单列'],
  ['按实际适用范围', '按适用范围'],
  ['按适用条件必需', '符合条件时必交'],
  ['必要性待核实', '是否必交待核实'],
  ['跨轮次重申', '跨轮次申请'],
  ['跨轮重申', '跨轮次申请'],
  ['併愿', '同时申请'],
  ['并申', '同时申请'],
  ['完整说明', '详细要求'],
  ['具体成立条件', '所需条件'],
  ['原文条件尚未完整，须核实', '条件不完整，需核实'],
  ['原文已保留，资格归类或条件待核实', '资格类型或条件待核实'],
  ['手册未在结构化条件中明确列明', '手册未明确列出'],
  ['尚未归入标准类型，请按原文核实；不据此自动判为符合', '资格类型待核实，暂不能判定符合'],
  ['须核对原文“具英国大学入学资格”的限定', '须具备英国大学入学资格'],
  ['不据此自动判为符合', '暂不能判定符合'],
  ['按本项目核实', '按本项目要求核实'],
  ['原始路径名称', '原始资格名称'],
  ['前端归组不代表条件相同', '同一类别内的资格要求可能不同']
];
const references = {
  requirements:'全部要求', academicTests:'学术考试要求',
  languagePolicy:'成绩有效期与形式', graduationPolicy:'资格取得要求',
  language:'语言成绩',waivers:'豁免要求',doubts:'待核实事项'
};
const referenceKeys=Object.keys(references).join('|');
const referencePattern=new RegExp('(详见|另见|参见|见(?:本项目)?|按照|按|依|另列于|单列于|列于|另列|完整保留于|保留于)\\s*((?:'+referenceKeys+')(?:(?:及|和|、)(?:'+referenceKeys+'))*)(?=$|[^A-Za-z])','g');

export function conciseText(value) {
  let text=String(value??'').trim();
  for(const [from,to] of phrases)text=text.replaceAll(from,to);
  // Only translate internal cross-references; English quotations and ordinary
  // uses of "requirements" are not subject to a global word substitution.
  text=text.replace(referencePattern,(_,prefix,keys)=>(prefix==='完整保留于'?'见':prefix==='另列'?'另列于':prefix)+keys.replace(new RegExp(referenceKeys,'g'),key=>references[key]));
  text=text.replace(/；且\s+/g,'；且').replace(/。\s*。/g,'。');
  // Remove adjacent exact repeats only, never merge different conditions or
  // remove an exception merely because it shares words with another sentence.
  const sentences=text.match(/[^。\n]+[。\n]*|[。\n]+/g)||[];
  return sentences.filter((part,i)=>!i||part.trim()!==sentences[i-1].trim()).join('');
}

export function joinCopy(parts, separator='；') {
  return [...new Set(parts.filter(value=>value!==null&&value!==undefined&&String(value).trim()).map(value=>conciseText(value).replace(/[。；;\s]+$/,'')))].filter(Boolean).join(separator);
}

// Show complete clauses, never slice a score, date, URL or certificate name.
export function copyPreview(text, limit=180) {
  if(text.length<=limit)return text;
  const clauses=[...text.matchAll(/[。；\n]/g)].map(match=>match.index+1);
  const end=clauses.filter(index=>index>=40&&index<=limit).at(-1);
  return end?text.slice(0,end).trim():text;
}

export function renderReadableText(value, esc, {limit=180, expandable=true}={}) {
  const original=String(value??''),text=conciseText(original),preview=expandable?copyPreview(text,limit):text;
  const html=value=>esc(value).replace(/\n/g,'<br>');
  // The stored text remains available on hover and in the original-rule view.
  const title=text!==original?` title="${esc(original)}"`:'';
  if(preview===text)return title?`<span class="readable-copy"${title}>${html(text)}</span>`:html(text);
  return `<span class="readable-copy"${title}><span data-copy-preview>${html(preview)}…</span><span data-copy-full hidden>${html(text)}</span> <button type="button" class="copy-toggle" data-copy-toggle aria-expanded="false" aria-label="展开完整说明">展开</button></span>`;
}

export function setupReadableCopy(root=document) {
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-copy-toggle]');if(!button)return;
    const box=button.closest('.readable-copy'),expanded=button.getAttribute('aria-expanded')!=='true';
    box.querySelector('[data-copy-preview]').hidden=expanded;
    box.querySelector('[data-copy-full]').hidden=!expanded;
    button.setAttribute('aria-expanded',String(expanded));
    button.setAttribute('aria-label',expanded?'收起说明':'展开完整说明');
    button.textContent=expanded?'收起':'展开';
  });
}
