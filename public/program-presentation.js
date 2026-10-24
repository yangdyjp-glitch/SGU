// Presentation only: channel, IDs and admission rules remain on each record.
const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
export const programCode = p => /^(?:项目|本科项目|未注明|待确认)$/.test(clean(p.code)) ? '' : clean(p.code) || (/^[A-Z][A-Z0-9-]{1,14}$/.test(p.id || '') ? p.id : '');
export const programOriginalTitle = p => [...new Set([p.code, p.name, p.channel].map(clean).filter(Boolean))].join(' · ');

export function programEntryLabel(program) {
  const raw = clean(program.channel);
  if (!raw) return '申请类型未注明';
  if (/奖学金|scholarship/i.test(raw)) return [/MEXT/i.test(raw) ? 'MEXT奖学金' : '奖学金', /附录|仅含/.test(raw) ? '附录' : ''].filter(Boolean).join(' · ');
  let entry = '申请';
  if (/编入|转入|transfer/i.test(raw)) {
    const second = /(?:二|2)(?:年级|年)|(?:second|2nd)[ -]?year/i.test(raw), third = /(?:三|3)(?:年级|年)|(?:third|3rd)[ -]?year/i.test(raw);
    const both = second && third || /(?:二|2)[、和及／/・](?:三|3)|second.*third/i.test(raw);
    entry = (both ? '二、三年' : third ? '三年' : second ? '二年' : '') + '编入';
  } else if (!/申请|入学|入试|招生|选拔|新生|一年|1年|通道|材料审查|留学生|自己推荐|admission|entry|examination|selection|first.year|freshman|general|visa.based|term\s*\w+|Winter AO/i.test(raw)) return raw;
  // Type letters alone do not establish a language. Both bases must remain
  // visible when a single record accepts English and Japanese applications.
  const languages = [/英语(?=轨道|基准|授课|通道|本科|使用者|\s*(?:[）),，、／/]|$))|English(?:[ -](?:Track|Basis|Language|Speaker|Taught)|\s*[）),，]|$)/i.test(raw) ? '英' : '', /(?:日语|日本語)(?=轨道|基准|授课|通道|本科|\s*(?:[）),，、／/]|$))|Japanese(?:[ -](?:Track|Basis|Language|Speaker|Taught)|\s*[）),，]|$)/i.test(raw) ? '日' : ''].filter(Boolean).join('／');
  const type = languages ? '' : raw.match(/Type\s*[A-Z]\b/i)?.[0].replace(/Type\s*/i, 'Type ') || '';
  const mode = /visa.based|留学签证/i.test(raw) ? '留学签证' : /自费|私费/.test(raw) ? '自费' : raw.match(/[A-Z]方式/i)?.[0] || (/两阶段/.test(raw) ? '两阶段' : /^General(?:（|\s|$)/i.test(raw) ? '一般' : '');
  return [entry, languages, type, mode].filter(Boolean).join(' · ');
}

export function programShortName(p) {
  const raw = clean(p.name || p.englishName);
  if (!raw) return '';
  if (/^本科项目[（(]原文未注明具体学院或专业[）)]$/.test(raw)) return '本科项目（专业未注明）';
  if (/^国际本科项目[（(]Kyoto iUP[）)]$/.test(raw)) return 'Kyoto iUP';
  let name = raw.replace(/^(?:外国留学生本科书面材料选拔|国际申请者在线入试)(?:[（(][^）)]*[）)])?\s*[·・:：]\s*/, '');
  name = name.replace(/[（(](?:ISP|IGS|IGP|JCulP|GLAP|IGESS|GIS|SCOPE)[）)]/g, '').replace(/本科英语通道$/, '').replace(/本科一年级$/, '');
  // Drop faculty hierarchy only when an actual subject follows it. A faculty
  // without a named subject (e.g. 商学院) remains a meaningful project name.
  const hierarchy = name.match(/^([^（(）)]+?(?:学院|学部|学群))(.+)$/);
  if(hierarchy && (/^[·・\s:：—-]/.test(hierarchy[2]) || /(?:学科|项目|课程|专业|专攻|学士|本科|—SPSF)(?:[（(].*[）)])?$/.test(hierarchy[2]))) name=hierarchy[2].replace(/^[·・\s:：—-]+/,'');
  name = name.replace(/^[（(]ILA[）)]/, '');
  name = name.replace(/—SPSF$/, '');
  const subject = name.match(/^(.+?)学科(.+)$/);
  if (subject && !subject[1].endsWith('跨') && !subject[2].startsWith('学')) {
    name = /^[A-Z\d-]+(?:专攻|专业)$/.test(subject[2]) ? `${subject[1]}（${subject[2].replace(/专攻|专业$/, '')}）` : subject[2] === '全球项目' ? `${subject[1]}（全球）` : subject[2];
  }
  // The part after these separators is a specialization, not another route.
  if (/^.*?跨学科项目—/.test(name)) name = name.replace(/^.*?跨学科项目—/, '').replace(/学院$/, '');
  name = name.replace(/^.*?(?:国际科学本科项目|Japan-Expert学士项目)—/, m => m.startsWith('Japan-Expert') ? 'Japan-Expert · ' : '');
  name = name.replace(/^Gateway College[:：]\s*/, '');
  name = name.replace(/^跨学科理工学系/, '').replace(/^(?:医学群)?医疗科学类国际学生/, '').replace(/国际本科项目$/, '');
  name = name.replace(/工学科$/, '工程').replace(/(科学|化学)科$/, '$1');
  name = name.replace(/(?:本科项目|学士项目|本科课程|国际课程|学科|专攻|专业|课程|方向|学士|项目|本科)+$/, '');
  name = name.replace(/项目[（(]([^）)]+?)(?:课程)?[）)]$/, '（$1）');
  name = name.replace(/^[·・:：\s]+|[·・:：\s]+$/g, '');
  return name || raw;
}

const faculty = p => clean(p.name).match(/^(.+?(?:学院|学部|学群))/)?.[1] || '';
const groupsBy = (programs, value) => {
  const groups = new Map();
  for (const p of programs) { const key=value(p); if(!groups.has(key))groups.set(key,[]); groups.get(key).push(p); }
  return [...groups.values()];
};

// Two faculties can teach the same subject. Keep their names in that case,
// but do not add the faculty again merely because entry years differ.
export function buildProgramNames(programs) {
  const names = new Map(programs.map(p => [p.id, programShortName(p)]));
  for(const group of groupsBy(programs,p=>JSON.stringify([p.school,names.get(p.id)]))) {
    if(new Set(group.map(faculty)).size>1) for(const p of group) if(faculty(p)) names.set(p.id, `${names.get(p.id)}（${faculty(p)}）`);
  }
  return names;
}

export function programTitle(p, name = programShortName(p)) {
  return [...new Set([programCode(p), name].filter(Boolean))].join(' · ') || clean(p.id) || '项目名称未注明';
}

function distinguishLabels(programs, labels, suffix, scope = () => '') {
  for (const group of groupsBy(programs, p => JSON.stringify([scope(p), labels.get(p.id)]))) {
    if (group.length < 2) continue;
    const values = group.map(suffix);
    // Do not append a repeated shared description that cannot distinguish them.
    if (new Set(values).size < 2) continue;
    group.forEach((p,i) => { if(values[i])labels.set(p.id, labels.get(p.id) + ' · ' + values[i]); });
  }
}

export function buildProgramTitles(programs, { contextual = true } = {}) {
  const names = buildProgramNames(programs), titles = new Map(programs.map(p => [p.id, programTitle(p,names.get(p.id))]));
  const scope = p => JSON.stringify([p.school,p.year,...contextual?[]:[programEntryLabel(p)]]);
  if(contextual)distinguishLabels(programs,titles,programEntryLabel,scope);
  // List rows have a separate entry column; still distinguish any records
  // whose shortened names AND entry labels would otherwise be identical.
  distinguishLabels(programs,titles,p=>clean(p.channel),scope);
  distinguishLabels(programs,titles,p=>clean(p.name),scope);
  distinguishLabels(programs,titles,p=>p.id,scope);
  return titles;
}

export function buildProgramLabels(programs) {
  const names=buildProgramNames(programs), labels=new Map(programs.map(p=>[p.id,programCode(p)||names.get(p.id)||p.id]));
  distinguishLabels(programs, labels, p=>names.get(p.id));
  distinguishLabels(programs, labels, programEntryLabel);
  distinguishLabels(programs, labels, p=>`${p.school} ${p.year}`);
  distinguishLabels(programs, labels, p=>clean(p.channel));
  distinguishLabels(programs, labels, p=>clean(p.name));
  distinguishLabels(programs, labels, p=>p.id);
  return labels;
}

export function renderProgramScope(ids, programs, ui) {
  const selected = programs.filter(p => ids.includes(p.id));
  const { esc } = ui, labels=ui.programLabel?null:buildProgramLabels(programs), label = ui.programLabel || (p=>labels.get(p.id));
  if (!selected.length) return '<span class="muted">适用项目待核实</span>';
  const links = selected.map(p => `<a href="#program/${esc(p.id)}" title="${esc(programOriginalTitle(p))}">${esc(label(p))}</a>`).join('');
  if (selected.length === programs.length && selected.length <= 8) return `<span class="scope-all">${selected.length === 1 ? esc(label(selected[0])) : `全部 ${selected.length} 项目`}</span>`;
  if (selected.length <= 2 && selected.every(p => label(p).length <= 24)) return `<span class="scope-programs">${links}</span>`;
  const titles=ui.programTitle?null:buildProgramTitles(programs), title=ui.programTitle||(p=>titles.get(p.id));
  const expandedLinks=selected.map(p=>`<a href="#program/${esc(p.id)}" title="${esc(programOriginalTitle(p))}"><strong>${esc(title(p))}</strong></a>`).join('');
  return `<details class="program-scope"><summary>${selected.length === programs.length ? '全部' : '适用'} ${selected.length} 个项目</summary><div class="scope-programs">${expandedLinks}</div></details>`;
}
