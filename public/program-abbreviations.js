// Display aliases checked against the uploaded admission guides. These are
// scoped to the school and subject, never inferred from imported code initials.
// Source files/pages and the shared-program exceptions: docs/program-names.md.
const aliases = [
  ['早稻田大学', /Computer Science and Communications? Engineering|计算机科学与通信工程/i, 'CSCE'],
  ['早稻田大学', /Mathematical Sciences|数理科学|数学科学/i, 'MS'],
  ['早稻田大学', /Mechanical Engineering|机械工程/i, 'ME'],
  ['早稻田大学', /Civil and Environmental Engineering|土木与环境工程/i, 'CE'],
  ['早稻田大学', /TAISI/, 'TAISI'],
  ['早稻田大学', /Global Studies in Japanese Cultures|JCulP|日本文化全球研究/i, 'JCulP'],
  ['早稻田大学', /School of International Liberal Studies|国际教养学部/i, 'SILS'],
  ['东京国际大学', /Data Science (?:and|&) AI|数据科学与(?:人工智能|AI)/i, 'DSAI'],
  ['东京国际大学', /Business Economics|商业经济/i, 'BE'],
  ['东京国际大学', /Digital Business (?:and|&) Innovation|数字商业与创新/i, 'DBI'],
  ['东京国际大学', /International Relations|国际关系/i, 'IR'],
  ['东京科学大学', /Global Scientists and Engineers Program|全球科学家与工程师/i, 'GSEP'],
  ['东洋大学', /Global Innovation Studies|全球创新学/i, 'GINOS'],
  ['东洋大学', /Information Networking for Innovation and Design|信息连携/i, 'INIAD'],
  ['中京大学', /Global Liberal Studies|全球教养/i, 'GLS'],
  ['京都大学', /Kyoto iUP|Kyoto University International Undergraduate Program/i, 'Kyoto iUP'],
  ['会津大学', /ICT Global All-English|ICT全球全英语/i, 'ICTG'],
  ['关西学院大学', /School of International Studies|国际学部/i, 'SIS'],
  ['冈山大学', /Discovery Program for Global Learners|全球学习者Discovery/i, 'GDP'],
  ['北海道大学', /Modern Japanese Studies Program|现代日本学/i, 'MJSP'],
  ['北海道大学', /Integrated Science Program|综合科学项目/i, 'ISP'],
  ['同志社大学', /Institute for the Liberal Arts|国际教养学部/i, 'ILA'],
  ['大阪大学', /International Undergraduate Program in Science|国际科学本科/i, 'IUPS'],
  ['大阪大学', /Human Sciences International Undergraduate Degree Program|人间科学国际本科/i, 'HUS'],
  ['广岛大学', /Integrated Global Studies|国际共创/i, 'IGS'],
  ['庆应义塾大学', /Global Information and Governance Academic|GIGA/, 'GIGA'],
  ['庆应义塾大学', /Program in Economics for Alliances,? Research,? and Leadership|PEARL/i, 'PEARL'],
  ['上智大学', /Sophia Program for Sustainable Futures|SPSF/i, 'SPSF'],
  ['上智大学', /Faculty of Liberal Arts|国际教养学部/i, 'FLA'],
  ['明治大学', /School of Global Japanese Studies|国际日本学部/i, 'SGJS'],
  ['明治学院大学', /Global and Transcultural Studies|国际职业学科/i, 'GTS'],
  ['明海大学', /Global Management Major|全球管理/i, 'GMM'],
  ['法政大学', /Institute for Global Economics and Social Sciences|全球经济与社会科学/i, 'IGESS'],
  ['法政大学', /Global and Interdisciplinary Studies|全球与跨学科研究/i, 'GIS'],
  ['法政大学', /Global Business Program|全球商务/i, 'GBP'],
  ['法政大学', /Sustainability Co-creation Programme|可持续共创/i, 'SCOPE'],
  ['立命馆亚洲太平洋大学', /College of International Management|国际经营学部/i, 'APM'],
  ['立命馆亚洲太平洋大学', /College of Asia Pacific Studies|亚太学部/i, 'APS'],
  ['立命馆亚洲太平洋大学', /College of Sustainability and Tourism|可持续发展与观光学部/i, 'ST'],
  ['立命馆大学', /Community and Regional Policy Studies|社区与区域政策/i, 'CRPS'],
  ['立命馆大学', /Global Liberal Arts|全球教养/i, 'GLA'],
  ['立命馆大学', /Global Studies Major|全球研究/i, 'GS'],
  ['立命馆大学', /Information Systems Science and Engineering|信息系统科学与工程/i, 'ISSE'],
  ['立命馆大学', /Joint Degree Program|美日联合/i, 'JDP'],
  ['立教大学', /Global Liberal Arts Program|全球博雅教育/i, 'GLAP'],
  ['筑波大学', /Bachelor[’']s Program in Global Issues|全球议题/i, 'BPGI'],
  ['芝浦工业大学', /Innovative Global Program|创新全球/i, 'IGP']
];

// Known acronyms written in project names or already used in the curated rules.
// FEDPE is the user's existing short label for Soka's two education subjects.
const knownCodes = new Set(['CSCE','MS','ME','CE','TAISI','JCulP','SILS','DSAI','BE','DBI','IR','GSEP','GINOS','INIAD','GLS','ICTG','SIS','GDP','MJSP','ISP','ILA','IUPS','HUS','IGS','GIGA','PEARL','SPSF','FLA','SGJS','GTS','GMM','IGESS','GIS','GBP','SCOPE','APM','APS','ST','GLAP','BPGI','IGP','CRPS','GLA','GS','ISSE','JDP','FEDPE']);
export function programAbbreviation(p) {
  const names = `${p.name || ''} ${p.englishName || ''}`;
  const scoped = aliases.find(([school, subject]) => p.school === school && subject.test(names));
  if (scoped) return scoped[2];
  // Read explicit standalone tokens, not substrings in generated codes such as
  // SCSEME. Degree names (BA/BS), exams and institution initials are excluded.
  const explicit = names.match(/[A-Za-z][A-Za-z0-9-]*/g)?.find(code => knownCodes.has(code));
  if (explicit) return explicit;
  return knownCodes.has(String(p.code || '').trim()) ? String(p.code).trim() : '';
}
