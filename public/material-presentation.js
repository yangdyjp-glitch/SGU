import { detailInfoAttribute } from './detail-hints.js';
import { buildProgramLabels, renderProgramScope } from './program-presentation.js';
import { importedRuleText } from './imported-requirement-model.js';

// These are filing categories, not declarations that documents are equivalent.
// Exact labels, AND conditions, stages, counts and source records stay in variants.
const categories = [
  ['support','特殊支持与健康材料',/残障|特殊支持|特殊安排|合理便利|招生.*支持|招生便利|健康|诊断|结核/],
  ['scholarship','奖学金与费用减免材料',/奖学金|助学金|减免|受灾|优惠|scholarship/i],
  ['credits','编入课程与学分材料',/学分|课程大纲|教学大纲|课时|课次|上课次数|授课次数|当前.*课|在修|修读|课程.*毕业要求|syllab/i],
  ['review','个别资格审查材料',/资格审查|资格.*审查|预备能力审查/],
  ['attendance','在籍与出勤证明',/出勤|出席|在籍|在学|退学|在读证明|日本.*就读.*(?:证明|材料)|日本.*(?:语言|日语|语教育).*记录/],
  ['finance','经费计划与资金证明',/经费|财务|财力|资金|经济|余额|存款|收入|资助|财产/],
  ['fee','申请费与付款凭证',/申请费|报名费|检定费|审查费|支付|付款|缴费|汇款|转账|退款/],
  ['reference','推荐信与评价表',/推荐|评价表|evaluation|reference|recommendation/i],
  ['essay','申请文书与学习计划',/文书|志望|志愿|理由书|申请动机|学习计划|短文|作文|个人陈述|目标陈述|目的陈述|动机与|essay|personal statement|statement of purpose|文章及/i],
  ['language','语言成绩与豁免证明',/英语|日语|语言|日本語|JLPT|TOEFL|IELTS|TOEIC|Cambridge|EIKEN|GTEC|TEAP|CEFR/i],
  ['academic-tests','学术考试成绩',/标准化|标化|学术.*(?:考试|成绩)|国家.*考试|统[一考].*考试|EJU|SAT|ACT|预估成绩|预测成绩/i],
  ['qualification','学历与资格证明',/毕业|预毕业|修了|结业|学历|资格|文凭|证书|教育认证|IB|Abitur|Baccalaur|A[ -]?Level|GCE|HKDSE|同等学力|教育.*证明|学校.*完成/i],
  ['transcript','学业成绩单与评分说明',/成绩|评分|评定|学期报告|调査书|academic record|transcript/i],
  ['school','学校信息与教育经历',/学校.*(?:信息|简介|宣传)|学院.*(?:简介|宣传)|教育经历|教育.*履历|学业背景|school (?:information|report)/i],
  ['identity','身份证件与居留材料',/护照|身份|国籍|在留|居留|签证|COE|住民票|出入境|赴日|入境|日本在留|日本中学生学生证/i],
  ['photo','证件照片',/照片|证件照|彩照|photo/i],
  ['application','申请表与个人信息',/申请表|申请信息|个人资料|个人信息|申请人信息|联系.*信息|网上申请|在线申请|线上申请|网申|履历书|application form|OAS基本/i],
  ['activity','活动、成果与补充证明',/成果|成就|荣誉|活动|奖励|奖项|优势|特长|经历证明|获奖|作品|工作证明|支持材料|支持文件|补充.*(?:材料|证明)|其他材料/i],
  ['video','视频与面试材料',/视频|录制|录像|面试|演示|幻灯片/i],
  ['originals','原件、认证与翻译',/原件|认证副本|译文|翻译|英译|姓名|更名|曾用名|证书原件|正式核验/i],
  ['checklist','材料清单与邮寄文件',/核对表|清单|Checklist|检查表|信封|邮寄标签|准考证/i],
  ['enrollment','入学手续材料',/入学手续|入学材料|录取手续|录取接受|誓约|enrollment request/i]
];

export function materialCategory(material) {
  const label = String(material.label || '未注明材料');
  // Combined records stay combined; no one document is silently dropped.
  if (/学历|毕业|资格/.test(label) && /成绩/.test(label) && !/英语|日语|标准化/.test(label)) return {id:'education-bundle',label:'学历与成绩组合材料'};
  const match = categories.find(([, ,pattern])=>pattern.test(label));
  return match ? {id:match[0],label:match[1]} : {id:'other',label:'项目补充材料'};
}

export function groupMaterials(programs, entries = p => p.materials || []) {
  const groups = new Map();
  for (const program of programs) for (const row of entries(program)) {
    const category = materialCategory(row);
    const phase = /录取后|入学前|入学后|入学手续|录取手续|录取接受/.test(row.stage || row.label || '') && !/申请/.test(row.stage || '') ? 'after' : 'application';
    const key = category.id + ':' + phase;
    if (!groups.has(key)) groups.set(key,{...category,id:key,phase,programs:[],variants:[],recordCount:0});
    const group = groups.get(key);
    if (!group.programs.includes(program.id)) group.programs.push(program.id);
    group.recordCount++;
    // Only record IDs and evidence locations are excluded. Different wording,
    // quantities, conditions, submission stages or mandatory status stay distinct.
    const {id,source,sources,...content} = row;
    const signature = JSON.stringify(content);
    let variant = group.variants.find(item=>item.signature===signature);
    if (!variant) { variant={...row,signature,programs:[],sources:[],records:[]}; group.variants.push(variant); }
    if (!variant.programs.includes(program.id)) variant.programs.push(program.id);
    variant.sources.push(...(sources || [source]).filter(Boolean));
    variant.records.push({programId:program.id,material:row});
  }
  const order = ['application','photo','identity','qualification','education-bundle','transcript','academic-tests','language','essay','reference','school','attendance','credits','review','finance','fee','scholarship','activity','video','originals','checklist','support','enrollment','other'];
  return [...groups.values()].sort((a,b)=>(a.phase==='after')-(b.phase==='after') || order.indexOf(a.id.split(':')[0])-order.indexOf(b.id.split(':')[0]));
}

export function buildMaterialInfo(group, programs, ui) {
  const labels = ui.programLabel ? null : buildProgramLabels(programs);
  const title = ui.programLabel || (p=>labels.get(p.id));
  const selected = programs.filter(p=>group.programs.includes(p.id));
  const partsFor = row => {
    const parts = row.parts?.length ? [...row.parts] : [{title:'适用阶段',text:row.stage||'原文未注明'},{title:row.note?'提交说明':'原文',text:row.note||row.source?.quote||'请核对原文',raw:!row.note&&Boolean(row.source?.quote)}];
    if(row.when && !parts.some(part=>part.title==='适用条件'))parts.unshift({title:'适用条件',text:(Array.isArray(row.when)?row.when:[row.when]).map(importedRuleText).join('；且 ')});
    return parts;
  };
  return {label:group.label,parts:[
    {text:'展开查看文件、份数和提交条件；同类材料不代表可以互相替代。'},
    {materialVariants:group.variants.map(row=>({
      label:row.label,
      programs:row.programs,
      status:row.required===false || row.optional===true ? '选交' : row.required===true ? '符合条件时必交' : '是否必交待核实',
      parts:partsFor(row),
      sources:row.sources
    })),programChoices:selected.map(p=>({id:p.id,title:title(p)}))}
  ]};
}

export function renderMaterialCatalog(groups, programs, ui) {
  const {esc}=ui;
  const scope = ids => renderProgramScope(ids,programs,ui);
  const rows = phase => groups.filter(group=>group.phase===phase).map(group=>{
    const info=()=>buildMaterialInfo(group,programs,ui);
    const optional=group.variants.every(row=>row.required===false || row.optional===true);
    return `<tr data-material-group="${esc(group.id)}"><th scope="row"><button type="button" class="info-hint material-group-button" data-act="detail-info" ${detailInfoAttribute(info,ui)} aria-label="查看${esc(group.label)}的各项目提交要求" aria-haspopup="dialog">${esc(group.label)} <span aria-hidden="true">!</span></button></th><td><span class="material-group-note${optional?' optional':''}">${optional?'选交 · ':''}${group.variants.length>1?`${group.variants.length} 条具体要求`:'查看提交要求'}</span></td>${programs.length>1?`<td>${scope(group.programs)}</td>`:''}</tr>`;
  }).join('');
  const table = phase => `<div class="table-wrap"><table class="material-catalog"><colgroup><col class="material-category-column"><col>${programs.length>1?'<col class="material-scope-column">':''}</colgroup><thead><tr><th>材料类别</th><th>提交要求</th>${programs.length>1?'<th>适用项目</th>':''}</tr></thead><tbody>${rows(phase)}</tbody></table></div>`;
  return (groups.some(g=>g.phase==='application')?table('application'):'<p class="material-catalog-empty">未单独列明申请阶段材料。</p>') + (groups.some(g=>g.phase==='after')?`<details class="material-later"><summary>录取与入学阶段材料（${groups.filter(g=>g.phase==='after').length} 类）</summary>${table('after')}</details>`:'');
}
