// Display vocabulary only. Full names, source codes and admissions rules stay
// on their original records. English initials below are display abbreviations,
// not a claim that the university officially uses them.
const shortNames = new Map(Object.entries({
  '政治与经济':'政治经济', '法律与政治':'法律政治', '心理与教育':'心理教育',
  '生命科学与技术':'生科技术', '信息系统科学':'信息系统',
  '人文社会科学':'人文社科', '横滨苏格拉底':'苏格拉底',
  '会计与金融':'会计金融', '食品生命科学':'食品生科',
  '都市环境设计':'都市环设', '生物医学工程':'生医工程',
  '信息科学与艺术':'信息艺术', '国际文化交流':'文化交流',
  '食品系统数据科学':'食品数据', '健康体育科学':'健康体育',
  '全球多样性':'全球多元', '应用生物科学':'应用生物',
  '全球商业与经济':'全球商经', '机械电气系统工程':'机电系统',
  '国际商务法（全球）':'国际商法', '全球政治经济学':'全球政经',
  '数字绿色技术':'数字绿技', '跨学科工程学':'跨科工程',
  '农业生物资源科学':'农生资源', '国际社会研究':'国际社科',
  '汽车工程（机械工程）':'汽车机械',
  '生物科学（应用生物科学）':'应用生物',
  'Japan-Expert · 医疗保健':'医疗保健',
  'Japan-Expert · 日语教师培养':'日语师范',
  'Japan-Expert · 农业科学':'农业科学',
  'Japan-Expert · 日本艺术与设计':'日艺设计',
  '本科项目（专业未注明）':'专业未明'
}));
const displayCodes = new Map(Object.entries({
  '电气电子通信工程':'EECE',
  '全球领导力异文化交流':'ICGL',
  '亚洲中的日本文化研究':'JACS',
  '汽车工程（电气、电子及信息工程）':'AE-EEIE'
}));
const hanLength = text => (text.match(/\p{Script=Han}/gu)||[]).length;

function englishInitials(value) {
  let subject=String(value||'').trim();
  // Take the subject, not the enclosing faculty or an imported opaque code.
  subject=subject.replace(/^(?:Faculty|School|College) of [^,]+,\s*(?=(?:Department|Division) of)/i,'');
  subject=subject.replace(/^.*?\s[—–]\s/,'').replace(/,?\s*(?:Faculty|School|College) of .*$/i,'');
  subject=subject.replace(/^(?:Department|Division) of\s+/i,'').replace(/\([^)]*\)/g,'');
  const stop=new Set(['a','an','and','of','in','the','for','to','with','on','program','programme','course','undergraduate','degree','bachelor','bachelors','department','division','faculty','school','college','b','s']);
  const words=subject.match(/[A-Za-z]+/g)?.filter(word=>!stop.has(word.toLowerCase()))||[];
  if(words.length<2)return '';
  const code=words.map(word=>/^[A-Z]{2,4}$/.test(word)?word:word[0].toUpperCase()).join('');
  return code.length>=2&&code.length<=12?code:'';
}

export function compactSubject(p, fullName) {
  // The user specified EBS. Its full source spelling is retained independently.
  if(p.school==='京都先端科学大学'&&/环境与生物资源科学|Environmental and (?:Bioresource|Biological Resources) Sciences/i.test(fullName+' '+(p.englishName||'')))return {label:'EBS',abbreviation:'EBS'};
  // Stable distinctions even when a search/result contains just one faculty.
  if(p.school==='名古屋大学') {
    const original=(p.name||'')+' '+(p.englishName||'');
    if(fullName==='化学'&&/工学院|School of Engineering/i.test(original))return {label:'化学（工）',abbreviation:''};
    if(fullName==='化学'&&/理学院|School of Science/i.test(original))return {label:'化学（理）',abbreviation:''};
    if(fullName==='社会科学'&&/法学院|School of Law/i.test(original))return {label:'社科（法）',abbreviation:''};
    if(fullName==='社会科学'&&/经济学院|School of Economics/i.test(original))return {label:'社科（经）',abbreviation:''};
  }
  if(shortNames.has(fullName))return {label:shortNames.get(fullName),abbreviation:''};
  if(displayCodes.has(fullName))return {label:displayCodes.get(fullName),abbreviation:displayCodes.get(fullName)};
  // Common four-character subjects do not need an institution suffix. Keep
  // shorter faculty-only names (商学院/法学院) understandable as they are.
  const withoutFaculty=fullName.replace(/(?:学院|学部)$/,'');
  if(hanLength(fullName)>4&&hanLength(withoutFaculty)<=4)return {label:withoutFaculty,abbreviation:''};
  const withoutConnectors=fullName.replace(/[与及]/g,'');
  if(hanLength(fullName)>4&&hanLength(withoutConnectors)<=4)return {label:withoutConnectors,abbreviation:''};
  if(hanLength(fullName)>4) {
    const code=englishInitials(p.englishName);
    if(code)return {label:code,abbreviation:code};
  }
  // Unknown records without an English name must remain readable. Never cut
  // arbitrary characters or invent a translation just to meet the width goal.
  return {label:fullName,abbreviation:''};
}
