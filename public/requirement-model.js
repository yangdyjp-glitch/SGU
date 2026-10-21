// Presentation only: the matching engine keeps the complete, versioned rules.
const numbers = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `R${String(from + i).padStart(3, '0')}`);
const firstSentence = text => String(text || '').split('。')[0] + (text ? '。' : '');
const englishList = values => values.length > 1 ? `${values.slice(0, -1).join(', ')} or ${values.at(-1)}` : values[0] || '';
const rowSource = (p, row) => row.source || { sourceId: p.sourceIds?.[0] || 'aohb27', page: row.page, quote: row.evidence, ruleId: row.id };
const pathClarifications = {
  japanDesignated12: '完成日本境内外国人学校12年课程；学校须获MEXT认可为等同海外高中',
  preparatory: '完成MEXT认可的日本大学预备教育课程',
  equivalency: '通过证明具备海外标准12年教育同等学力的考试（如GED）',
  japanEquivalency: '通过MEXT的高等学校卒業程度認定試験',
  individualReview: '经RU按学业背景及其他资格认定具备高中毕业或以上学力'
};

export function pathDescription(path) {
  return path.all.filter(c => c.field !== 'educationStatus').map(c => {
    if (c.field === 'accreditation' && Array.isArray(c.value)) return `学校须经指定机构认证 (${englishList(c.value)})`;
    if (c.field === 'ageAtEnrollment') return `入学前须年满${c.value}岁`;
    if (c.op === 'eq' && c.value === true && path.source?.sourceId === 'aohb27' && pathClarifications[c.field]) return pathClarifications[c.field];
    if (c.op === 'in' && Array.isArray(c.value)) return `${c.label}（${c.value.join(' / ')}）`;
    if (c.op === 'gte') return `${c.label} ≥ ${c.value}`;
    if (c.op === 'eq' && typeof c.value === 'string' && !c.label.includes(c.value)) return `${c.label}：${c.value}`;
    return c.label;
  }).join('；') + '。';
}

export function buildProjectView(p) {
  const requirements = p.requirements || [];
  const byId = new Map(requirements.map(r => [r.id, r]));
  const rows = ids => ids.map(id => byId.get(id)).filter(Boolean);
  const parts = ids => rows(ids).map(r => ({ title: r.topic, text: r.detail }));
  const sources = ids => rows(ids).map(r => rowSource(p, r));
  const academic = rows(['R012', 'R013', 'R015', 'R085', 'R111']).map(r => ({ ...r, topic: r.id === 'R013' ? '不接受的资格' : r.topic, detail: r.id === 'R012' ? r.detail.split('；')[0] + '；学校说明见材料。' : r.detail
    .replace('保留“未注明”，不填写0或解释为不审查学业成绩。', '未注明数值门槛仍会审查学业成绩。')
    .replace('F路径、H路径', '短学制加MEXT指定预备教育、日本高卒认定考试')
    .replace('不可把全部职业教育资格一概判定为被排除。', '此项不泛指全部职业教育。')
    .replace('此处的可选学术证据与JDP英语证明路径须分开。', p.id === 'JDP' ? '用SAT／ACT满足英语要求时，仍须达到下列英语单项门槛。' : '') }));
  const paths = p.paths.map(path => {
    let description = pathDescription(path);
    const extra = path.id === 'E' ? byId.get('R007')?.detail.split('。').slice(1).join('。') : path.id === 'I' ? byId.get('R011')?.detail.split('。').slice(1).join('。') : '';
    if (extra) description += extra;
    if (path.id === 'I' && byId.has('R014')) description += byId.get('R014').detail;
    return { ...path, description, sources: [path.source, ...(path.id === 'I' ? sources(['R014']) : [])] };
  });
  const waivers = [];
  if (byId.has('R027')) {
    const condition = byId.get('R027'), proof = byId.get('R067');
    waivers.push({ title: '英语成绩豁免', paragraphs: [condition.detail, proof?.detail.replace(/^须证明最近6年全英语教育；/, '')].filter(Boolean), sources: sources(['R027', 'R067']) });
  }
  if (p.id === 'GLA' && byId.has('R023')) {
    waivers.push({ title: '全英语 IB Diploma 豁免', paragraphs: [firstSentence(byId.get('R023').detail), '申请时尚未取得Diploma者，录取后须在入学前取得，否则撤销录取。证明文件及成绩直送见材料中的IB资格说明。'], sources: sources(['R023', 'R066']) });
  }
  if (p.id === 'JDP' && byId.has('R024')) {
    waivers.push({ title: '四年全英语教育豁免', paragraphs: ['Grade 9–12或等同四年，英语为唯一教学语言，且未修读ESL课程。', '符合其一：①学习美国区域认证课程、IB、CXC或英国课程（美国境内外均可）；②在指定国家／地区或其教育体系学习（学校所在地不限）。国籍本身不替代教育经历；须提交符合豁免标准的证据。', `指定国家／地区：${byId.get('R026')?.detail.replace('保留文件分组。', '') || ''}`], sources: sources(['R024', 'R025', 'R026', 'R066']) });
  }
  for (const waiver of p.waivers || []) {
    if (['six-year', 'ib-english', 'group-a', 'jdp-curriculum'].includes(waiver.id)) continue;
    waivers.push({ title: waiver.label, paragraphs: [pathDescription(waiver)], sources: waiver.all.map(c => c.source).filter(Boolean) });
  }
  const materialRules = {
    identity: ['R038'], graduation: ['R041', 'R042', 'R043'], transcript: numbers(49, 57),
    english: numbers(58, 65), essay: numbers(70, 78), reference: numbers(80, 83),
    photo: ['R079'], residence: ['R084'], awards: ['R087']
  };
  const materials = (p.materials || []).filter(m => !m.stage || m.stage === '申请').map(m => {
    const ids = materialRules[m.id] || [];
    const details = rows(ids).map(r => ({ title: r.topic, text: ['R062', 'R064'].includes(r.id) ? firstSentence(r.detail) : r.id === 'R063' ? r.detail.replace(/610为EBRW单项要求，不是SAT总分。$/, '') : r.detail }));
    if (m.note) details.push({ title: '补充说明', text: m.note });
    if (m.id === 'english') details.push({ title: '申请豁免时', text: '按“语言考试与豁免”中集中列出的条件及证明范围准备。' });
    if (!details.length && m.source?.quote) details.push({ title: '材料说明', text: m.source.quote });
    return { id: m.id, label: m.label, parts: details, sources: ids.length ? sources(ids) : [m.source].filter(Boolean), optional: m.required === false, when: m.when };
  });
  const extraMaterials = [
    ['ib-qualification', 'IB Diploma／预估成绩（适用时）', 'R044'],
    ['alevel-qualification', 'A-Level证书／预估成绩（适用时）', 'R045'],
    ['preparatory-certificate', '预备课程毕业证明（适用时）', 'R046'],
    ['equivalency-certificate', '同等学力考试证明（适用时）', 'R047'],
    ['japan-equivalency-certificate', '日本高卒认定合格证明（适用时）', 'R048']
  ];
  for (const [id, label, rule] of extraMaterials) if (byId.has(rule)) {
    const details = parts([rule]);
    if (rule === 'R044' && p.id === 'GLA') details.push({ title: '申请IB英语豁免', text: 'IB在读者另须提交English Language Test Score Waiver Request Form；录取后、入学前须由IBO直送最终成绩。已取得IB者按上述结果上传及直送要求办理。' });
    materials.push({ id, label, parts: details, sources: sources([rule, ...(rule === 'R044' && p.id === 'GLA' ? ['R066'] : [])]) });
  }
  if (byId.has('R012')) {
    const detail = byId.get('R012').detail.split('；').slice(1).join('；');
    if (detail) materials.push({ id: 'early-graduation', label: '跳级／提前毕业说明（适用时）', parts: [{ title: '学校正式说明', text: detail }], sources: sources(['R012']) });
  }
  if (byId.has('R085')) materials.push({ id: 'academic-exams', label: '学术标准化考试成绩', optional: p.academicTests.status === 'optional', parts: [{ text: '可提交SAT、ACT或国家大学入学考试结果，接受范围见学历资格中的学术考试说明。' }, ...parts(['R086'])], sources: sources(['R085', 'R086']) });
  const languageFormats = rows(['R018', 'R019', 'R020']);
  if (p.id === 'GLA' && byId.has('R062')) languageFormats.push({ ...byId.get('R062'), topic: 'Cambridge范围', detail: '只接受所列C1 Advanced，不接受B2 First和C2 Proficiency。' });
  if (p.id === 'JDP' && byId.has('R064')) languageFormats.push({ ...byId.get('R064'), topic: 'ACT考试形式', detail: '不接受Superscore，须提交指定一次考试成绩。' });
  const post = requirements.filter(r => ['入学后', '赴AU前'].includes(r.stage));
  return { paths, academic, waivers, materials,
    materialNotes: parts(['R035', 'R037', 'R039', 'R040']), materialNoteSources: sources(['R035', 'R037', 'R039', 'R040']),
    languageFormats, post, enrollmentSource: sources(['R002'])[0],
    // Citizenship-only GLA Group A and Australian-domestic exceptions are outside the default CN/JP view.
    audience: '中国籍／日本籍申请人', sourceFor: row => rowSource(p, row) };
}
