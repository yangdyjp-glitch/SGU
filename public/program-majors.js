// Shared by the catalogue, queries and document import. These labels describe
// areas of study, never entrance-exam subjects or eligibility requirements.
const definitions = [
 ['经济学', /经济|経済|\beconomics\b/i, ['Economics']],
 ['商学与管理', /商科|商学|商学院|经营|経営|商务|商业|管理|会计|金融|市场营销|ビジネス|\bbusiness\b|\bmanagement\b|\baccounting\b|\bfinance\b/i, ['商科','商学','经营学','工商管理','Business','Business Administration','Management']],
 ['法学', /法学|法律|\blaw\b|\blegal\b/i, ['Law']],
 ['政治学', /政治|\bpolitic(?:s|al science)\b/i, ['Political Science']],
 ['国际关系', /国际关系|国際関係|\binternational relations\b/i, ['International Relations']],
 ['公共政策', /政策|治理|\bpolicy\b|\bgovernance\b/i, ['政策科学','Policy Science','Public Policy']],
 ['社会学与社会科学', /社会学|社会科学|社会研究|社会共生|人文社会|社会与文化|\bsociology\b|\bsocial (?:sciences?|studies)\b/i, ['社会学','社会科学','Sociology','Social Sciences']],
 ['社会福利', /社会福祉|社会福利|社会工作|\bsocial (?:welfare|work)\b/i, ['Social Welfare']],
 ['心理学', /心理|\bpsychology\b/i, ['Psychology']],
 ['教育学', /教育学|教育学院|教育学部|教师培养|\bteacher training\b|\beducation(?:al)? studies\b/i, ['Education']],
 ['文学与语言文化', /文学|语言|語学|日本语|日本語|外国语|外國語|文化|人文学|哲学|伦理学|\bhumanities\b|\bliterature\b|\blinguistics\b|\bcultural studies\b/i, ['文学','语言学','人文学','Humanities','Literature']],
 ['新闻与传播', /新闻|新闻学|新聞|媒体|传媒|传播|\bjournalism\b|\bmedia\b/i, ['新闻学','传播学','Journalism','Media Studies']],
 ['国际与区域研究', /区域研究|地域发展|地域創生|国际研究|国际学部|国际学科|国际综合|国际共创|国际创新|全球研究|全球议题|亚太学|日本研究|现代日本学|\b(?:global|international|regional|japan|japanese|asia pacific) (?:studies|issues)\b|\bregional development\b/i, ['国际研究','区域研究','日本研究','Global Studies','International Studies']],
 ['综合教养', /教养|教養|博雅|通识|文理综合|\bliberal (?:arts|studies)\b/i, ['博雅教育','国际教养','Liberal Arts']],
 ['计算机与信息科学', /计算机|信息科学|信息工程|信息理工|信息系统|信息协作|情報|\bcomputer\b|\binformatics\b|\binformation (?:science|engineering|systems|networking)\b|\bict\b/i, ['计算机','计算机科学','信息科学','Computer Science','Information Science','CS']],
 ['数据科学与人工智能', /数据科学|人工智能|データサイエンス|\bdata science\b|\bartificial intelligence\b|\bai\b/i, ['数据科学','人工智能','Data Science','AI']],
 ['数学', /数学|数理|\bmathematics\b|\bmathematical\b/i, ['Mathematics']],
 ['物理学', /物理|\bphysics\b|\bphysical science\b/i, ['物理','Physics']],
 // 文化学科／文化学类 describe cultural studies, not chemistry.
 ['化学', /(?<!文)化学|\bchemistry\b|\bchemical\b/i, ['Chemistry']],
 ['材料科学', /材料|\bmaterials science\b/i, ['Materials Science']],
 ['生物与生命科学', /生物|生命科学|生命理工|\bbiology\b|\bbiological\b|\blife sciences?\b|\bbiosciences?\b/i, ['生物学','生命科学','Biology','Life Sciences']],
 ['地球科学', /地球|地学|地質|\bgeoscience\b|\bearth science\b|\bgeology\b/i, ['Geoscience','Earth Science']],
 ['机械与汽车工程', /机械|機械|汽车工程|\bmechanical\b|\bautomotive\b/i, ['机械工程','汽车工程','Mechanical Engineering']],
 ['电气电子与通信工程', /电气|电机|电子|電気|電子|通信工|\belectrical\b|\belectronic\b|\bcommunications? engineering\b/i, ['电气工程','电子工程','通信工程','Electrical Engineering']],
 ['土木工程', /土木|\bcivil engineering\b/i, ['Civil Engineering']],
 ['建筑学', /建筑|建築|\barchitecture\b/i, ['Architecture']],
 ['环境与可持续发展', /环境|環境|可持续|持続可能|\benvironmental\b|\bsustainability\b/i, ['环境科学','可持续发展','Environmental Science','Sustainability']],
 ['农业与食品科学', /农学|农业|農学|農業|食品|森林|\bagricultur|\bfood science\b|\bforestry\b/i, ['农学','食品科学','Agriculture']],
 ['医学与健康科学', /医学|医疗|护理|看護|健康|保健|\bhealth(?:care)?\b|\bnursing\b|\bmedical\b/i, ['医学','护理学','健康科学','Nursing']],
 ['药学', /药学|药科|薬学|薬科|\bpharmacy\b|\bpharmaceutical\b/i, ['Pharmacy']],
 ['体育科学', /体育|スポーツ|\bsport(?:s)?\b/i, ['体育学','Sports Science']],
 ['艺术与设计', /艺术|美术|艺术.*设计|芸術|美術|\b(?:fine|visual) arts\b|\bart and design\b/i, ['艺术','艺术设计','Art and Design']],
 ['旅游与酒店管理', /旅游|观光|観光|酒店|\btourism\b|\bhospitality\b/i, ['旅游管理','酒店管理','Tourism']],
 ['综合理学', /综合科学|国际科学|国際総合理学|\bintegrated science\b|\bintegrated arts and sciences\b|\bintegrated science program\b/i, ['理学','Science']],
 ['综合工学', /综合工程|工学部|工学院|工学科学|工程与应用科学|绿色工程|绿色技术|機能創造|机能创造|\bengineering\b|\bgreen technology\b/i, ['工学','工程','Engineering']]
];

export const majorCatalog = definitions.map(([label]) => label);
export const unspecifiedMajor = '__unspecified__';
const aliases = new Map(definitions.flatMap(([label,,names]) => [label,...names].map(name=>[name.normalize('NFKC').trim().toLowerCase(),label])));
export function normalizeMajors(values) {
 if(!Array.isArray(values))return [];
 return [...new Set(values.filter(v=>typeof v==='string').map(v=>v.normalize('NFKC').trim()).filter(Boolean).map(v=>aliases.get(v.toLowerCase())||v))];
}
export function majorsFromText(text) {
 const found=definitions.filter(([,pattern])=>pattern.test(String(text||''))).map(([label])=>label);
 // A named engineering discipline is more specific than its parent faculty.
 return found.includes('综合工学')&&found.some(v=>['计算机与信息科学','机械与汽车工程','电气电子与通信工程','土木工程','建筑学','化学','材料科学','生物与生命科学'].includes(v))?found.filter(v=>v!=='综合工学'):found;
}
export function getProgramMajors(program={}) {
 // An explicit empty list means the editor left the field unconfirmed.
 if(Object.hasOwn(program,'majors'))return normalizeMajors(program.majors);
 const direction=String(program.direction||'');
 const specificDirection=['人文与综合','社会与政策','计算机与工程'].includes(direction)?[]:majorsFromText(direction);
 if(specificDirection.length)return specificDirection;
 const department=String(program.englishName||'').match(/Department of ([^,;—()]+)/i)?.[1];
 const specific=department?majorsFromText(department):[];
 if(specific.length)return specific;
 // A named course can sit inside a broader faculty (e.g. digital business in
 // an economics faculty). Prefer its own English title before the full name.
 const english=majorsFromText(program.englishName);
 return english.length?english:majorsFromText(program.name);
}
export function majorsAreInferred(program={}) {
 return Boolean((!Object.hasOwn(program,'majors')||program.majorsInferred===true)&&getProgramMajors(program).length);
}
export function presentProgramMajors(program) {
 return {...program,majors:getProgramMajors(program),majorsInferred:majorsAreInferred(program)};
}
export function matchesMajors(program,selected=[]) {
 const filters=normalizeMajors(Array.isArray(selected)?selected:[selected]);
 if(!filters.length)return true;
 const majors=getProgramMajors(program);
 return filters.some(value=>value===unspecifiedMajor?!majors.length:majors.includes(value));
}
export function majorFilterOptions(programs) {
 const values=new Set(programs.flatMap(getProgramMajors));
 const known=majorCatalog.filter(v=>values.has(v));
 const custom=[...values].filter(v=>!majorCatalog.includes(v)).sort((a,b)=>a.localeCompare(b,'zh-CN'));
 return [...known,...custom,...(programs.some(p=>!getProgramMajors(p).length)?[unspecifiedMajor]:[])];
}
export function validateMajors(program) {
 if(!Object.hasOwn(program,'majors'))return [];
 if(!Array.isArray(program.majors)||program.majors.length>40||program.majors.some(v=>typeof v!=='string'||!v.trim()||v.length>80||v===unspecifiedMajor))return ['专业须为不超过40项的名称列表，每项1至80字；待确认请留空'];
 if(program.majorsInferred!==undefined&&typeof program.majorsInferred!=='boolean')return ['专业归类状态无效'];
 return [];
}
