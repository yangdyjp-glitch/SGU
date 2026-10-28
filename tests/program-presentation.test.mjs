import test from 'node:test';
import assert from 'node:assert/strict';
import { seedPrograms } from '../lib/seed.mjs';
import { programCode, programOriginalTitle, programShortName, programFullName, programTitle, programRequirementName, programEntryLabel, buildProgramNames, buildProgramTitles, buildProgramLabels, renderProgramScope, renderProgramOverviewName } from '../public/program-presentation.js';
import {programAbbreviation} from '../public/program-abbreviations.js';
import { createSchoolOverview } from '../public/school-detail.js';
import { renderProjectDetail } from '../public/project-detail.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,icon:()=>'',button:()=>'',tag:esc,evidence:()=>''};
const make=(id,name,channel='外国留学生本科书面材料选拔（含线上面试）')=>({...structuredClone(seedPrograms()[0]),id,code:'FEDPE',school:'创价大学',year:2027,name,channel});

test('display uses source acronyms and subject names without changing imported identifiers',()=>{
  const rows=[{id:'igs',code:'DIGSISIAS',name:'综合科学部国际共创学科（IGS）'},{id:'gsep',code:'GSEPGDTSES',name:'全球科学家与工程师项目',englishName:'Global Scientists and Engineers Program (GSEP)'},{id:'spsf',code:'SPSFDJFH',name:'文学部新闻学科—SPSF'},{id:'plain',code:'DEECEFSE',name:'理工学院电气电子通信工学科'}];
  const before=JSON.stringify(rows);
  assert.deepEqual(rows.map(programCode),['IGS','GSEP','SPSF','EECE']);
  assert.deepEqual(rows.map(p=>programTitle(p)),['IGS','GSEP','SPSF · 新闻','EECE']);
  assert.ok(programOriginalTitle(rows[3]).includes('DEECEFSE'));
  assert.equal(JSON.stringify(rows),before);
  assert.equal(programTitle({code:'FPMGIGAGP',name:'综合政策学部GIGA项目'}),'GIGA · 综合政策');
  assert.equal(programCode({code:'FLA',name:'国际教养',englishName:'Liberal Arts (BA)'}),'FLA','a degree is not a project acronym');
});

test('official subject abbreviations override generated initials without changing original names',()=>{
  const rows=[
    ['早稻田大学','SFSECSCE','计算机科学与通信工程','Computer Science and Communications Engineering','CSCE'],
    ['早稻田大学','SFSEMS','数理科学','Mathematical Sciences','MS'],
    ['早稻田大学','SCSEME','机械工程','Mechanical Engineering','ME'],
    ['早稻田大学','SCSECEE','土木与环境工程','Civil and Environmental Engineering','CE'],
    ['东京国际大学','DSA','数据科学与AI','Data Science and AI','DSAI'],
    ['会津大学','IGAEPSCSE','ICT全球全英语','ICT Global All-English Program','ICTG'],
    ['冈山大学','DPGL','全球学习者Discovery项目','Discovery Program for Global Learners','GDP'],
    ['大阪大学','HSIUDP','人间科学国际本科项目','Human Sciences International Undergraduate Degree Program','HUS'],
    ['明海大学','SHTMGMM','全球管理','School of Hospitality & Tourism Management, Global Management Major','GMM'],
    ['立命馆亚洲太平洋大学','CIM','国际经营学部','College of International Management','APM'],
    ['立命馆亚洲太平洋大学','CAPS','亚太学部','College of Asia Pacific Studies','APS'],
    ['立命馆亚洲太平洋大学','CST','可持续发展与观光学部','College of Sustainability and Tourism','ST'],
    ['筑波大学','BSPGI','全球议题学士项目','Bachelor’s Program in Global Issues','BPGI']
  ];
  const programs=rows.map(([school,code,name,englishName],i)=>({id:'official-'+i,school,code,name,englishName,year:2027,channel:'一年级申请'})),before=JSON.stringify(programs);
  assert.deepEqual([...buildProgramTitles(programs).values()],rows.map(r=>r[4]));
  assert.deepEqual([...buildProgramLabels(programs).values()],rows.map(r=>r[4]));
  for(const p of programs){const original=programOriginalTitle(p);assert.ok(original.includes(p.name));assert.ok(original.includes(p.englishName));}
  assert.equal(JSON.stringify(programs),before);
  assert.equal(programCode({school:'早稻田大学',code:'SCSEME',name:'化学工程',englishName:'Chemical Engineering'}),'','ME must not be inferred for chemical engineering');
  const other={school:'其他大学',code:'SCSECEE',name:'土木与环境工程',englishName:'Civil and Environmental Engineering'};
  assert.equal(programAbbreviation(other),'','a different school cannot inherit Waseda CE');
  assert.equal(programCode(other),'CEE','display initials may be derived from its own full English subject');
  assert.equal(programTitle({code:'CSS',name:'理学院化学项目'}),'化学','short generated initials are not official acronyms either');
});

test('umbrella acronyms retain distinct subjects even in a single-project result',()=>{
  const programs=[
    {...make('policy','综合政策学部GIGA项目'),school:'庆应义塾大学',code:'FPMGIGAGP'},
    {...make('environment','环境信息学部GIGA项目'),school:'庆应义塾大学',code:'FEISGIGAGP'},
    {...make('physics','理学部国际科学本科项目—物理'),school:'大阪大学',code:'IUPSIDPSS'},
    {...make('chemistry','理学部国际科学本科项目—化学'),school:'大阪大学',code:'IUPSIDCSS'}
  ];
  const expected=['GIGA · 综合政策','GIGA · 环境信息','IUPS · 物理','IUPS · 化学'];
  assert.deepEqual([...buildProgramTitles(programs).values()],expected);
  assert.deepEqual(programs.map(p=>buildProgramTitles([p]).get(p.id)),expected);
  assert.deepEqual(programs.map(p=>programTitle(p)),expected);
  const subjects=['综合政策','环境信息','物理','化学'];
  assert.deepEqual([...buildProgramLabels(programs).values()],subjects);
  assert.deepEqual(programs.map(p=>programRequirementName(p)),subjects);
  const scope=renderProgramScope(programs.slice(0,3).map(p=>p.id),programs,ui);
  assert.match(scope,/<details class="program-scope">/);
  for(const subject of subjects.slice(0,3))assert.ok(scope.includes(`<strong>${subject}</strong>`));
  assert.doesNotMatch(scope,/<strong>(?:GIGA|IUPS) ·/);
});

test('same-code education subjects get concise, distinct names everywhere without editing source records',()=>{
  const programs=[make('primary','教育学院・初等教育学科'),make('psychology','教育学院・心理与教育学科')],original=JSON.stringify(programs);
  const expected=['FEDPE · 初等教育','FEDPE · 心理教育'];
  assert.deepEqual([...buildProgramTitles(programs).values()],expected);
  assert.deepEqual([...buildProgramLabels(programs).values()],['初等教育','心理教育']);
  const view=createSchoolOverview('创价大学',programs,{...ui,deferSections:true});
  for(let i=0;i<programs.length;i++) {
    const p=programs[i];
    assert.ok(view.html.includes('data-program-short>FEDPE</strong>'));
    assert.ok(view.html.includes(`data-program-full>${programFullName(p)}</span>`));
    assert.ok(view.html.includes(`data-compare="${p.id}"`));
    const detail=renderProjectDetail(p,{...ui,allPrograms:programs});
    assert.ok(detail.includes(`<h1>${expected[i]}</h1>`));
    assert.ok(detail.includes(`title="${esc(programOriginalTitle(p))}"><span class="program-label-part">${['初等教育','心理教育'][i]}</span></a>`));
    assert.ok(detail.includes(`<dd>${p.name}</dd>`));
    assert.ok(detail.includes(`<dd>${p.channel}</dd>`));
  }
  const scope=renderProgramScope([programs[0].id],programs,ui);
  assert.match(scope,/>初等教育<\/a>/);
  assert.equal(JSON.stringify(programs),original);
});

test('first-year, second/third-year and language labels use the same short vocabulary',()=>{
  for(const [raw,want] of [
    ['一年级入学（材料审查）','申请'],['First-Year Entry','申请'],['材料审查型一年级入学','申请'],
    ['国际申请者在线入试Type A（英语轨道，一年级）','申请 · 英'],
    ['国际申请者在线入试Type B（日语轨道，一年级）','申请 · 日'],
    ['国际申请者在线转入入试（二年级）','二年编入'],['二年级编入／转入','二年编入'],
    ['国际申请者在线编入／转入入试（三年级）','三年编入'],['3rd-year Transfer','三年编入'],
    ['Second-year Transfer','二年编入'],['二、三年级编入','二、三年编入'],['Second- and Third-Year Transfer','二、三年编入'],
    ['国际申请者三年级编入（英语基准／日语基准）','三年编入 · 英／日'],
    ['未知年级的编入申请','编入'],['Type A一年级申请','申请 · Type A'],
    ['MEXT奖学金通道（本文仅含双申说明及GPA附录）','MEXT奖学金 · 附录'],
    ['General（一般类）','一般签证'],['Visa-based（留学签证类）','留学签证'],
    ['General','一般签证'],['General (一般类)','一般签证'],['Visa-based','留学签证'],
    ['留学签证类','留学签证'],['一般签证类别','一般签证'],
    ['一般选拔（General Selection）','申请'],['General Selection','申请 · 一般'],
    ['一年级申请（留学签证类，英语轨道）','英 · 留学签证'],
    ['三年级编入（留学签证类）','三年编入 · 留学签证'],
    ['外国留学生入学考试B方式','申请 · B方式'],
    ['国际科学特别入试（含日语研修及预备教育）','申请'],
    ['Kyoto iUP统一招生：材料审查及英语线上面试','申请'],
    ['其他待核实类别','其他待核实类别'],['','申请类型未注明']
  ]) assert.equal(programEntryLabel({channel:raw}),want,raw);
});

test('full overview names retain subjects, specializations and unspecified status',()=>{
  for(const [raw,want] of [
    ['外国留学生本科书面材料选拔（含线上面试） · 教育学院 · 初等教育学科','初等教育'],
    ['理工学院应用化学科','应用化学'],['理学部生物科学科','生物科学'],
    ['理工学院电气电子通信工学科','电气电子通信工程'],
    ['国际地域学院地域发展学科地域发展课程','地域发展'],
    ['医学群医疗科学类国际学生医学科学项目','医学科学'],
    ['理工学群跨学科工程学学士项目','跨学科工程学'],
    ['生命环境科学跨学科项目—农业生物资源科学学院','农业生物资源科学'],
    ['国际日本学部国际日本学科本科英语通道','国际日本'],
    ['法学部国际商务法学科全球项目','国际商务法（全球）'],
    ['工学院汽车工程项目（机械工程课程）','汽车工程（机械工程）'],
    ['教养学部本科一年级','教养学部'],['商学院','商学院'],
    ['全球教养学院全球教养学科RU-ANU专业','全球教养（RU-ANU）'],
    ['本科项目（原文未注明具体学院或专业）','本科项目（专业未注明）'],
    ['国际本科项目（Kyoto iUP）','国际本科项目'],['特别项目（范围待核实）','特别（范围待核实）'],
    ['没有学院层级的独特专业名称','没有学院层级的独特专业名称']
  ]) assert.equal(programFullName({name:raw}),want,raw);
  assert.equal(programTitle({code:'项目',name:'商学院'}),'商学院');
});

test('faculty, entry, language and selection distinctions survive display-name collisions',()=>{
  const chemistry=[{...make('engineering','工学院化学项目'),code:'CSE',school:'名古屋大学'}, {...make('science','理学院化学项目'),code:'CSS',school:'名古屋大学'}];
  assert.deepEqual([...buildProgramNames(chemistry).values()],['化学（工）','化学（理）']);
  const modes=['一年级申请Type A（英语）','一年级申请Type B（日语）','二年级转入','三年级编入／转入'];
  const programs=modes.map((c,i)=>make('mode-'+i,'教育学院・初等教育学科',c));
  assert.equal(new Set(buildProgramTitles(programs).values()).size,4);
  assert.equal(new Set(buildProgramLabels(programs).values()).size,4);
  assert.equal(new Set(buildProgramTitles(programs,{contextual:false}).values()).size,1,'entry column already differentiates these rows');
  // Type letters must reappear if the language is identical and the original
  // types are the only available evidence distinguishing two separate records.
  const sameLanguage=[make('a','教育学院・初等教育学科','一年级申请Type A（英语）'),make('b','教育学院・初等教育学科','一年级申请Type B（英语）')];
  assert.equal(new Set(buildProgramTitles(sameLanguage,{contextual:false}).values()).size,2);
  assert.equal(new Set(buildProgramLabels(sameLanguage).values()).size,2);
  const differentYears=[programs[0],{...programs[0],id:'next-year',year:2028}];
  assert.equal(new Set(buildProgramLabels(differentYears).values()).size,2);
  const sharedSubject=[{...make('spsf','教育学部教育学科—SPSF'),code:'SPSF'},{...make('fedpe','教育学部教育学科'),code:'FEDPE'}];
  assert.deepEqual([...buildProgramLabels(sharedSubject).values()],['教育 · SPSF','教育 · FEDPE'],'different umbrella programs must remain distinct when the subject is identical');
});

test('Chinese display names use four or fewer characters without truncating the full name',()=>{
  for(const [name,short]of [
    ['政治与经济','政治经济'],['法律与政治','法律政治'],['生命科学与技术','生科技术'],
    ['信息系统科学','信息系统'],['心理与教育','心理教育'],['全球政治经济学','全球政经'],
    ['人文社会科学','人文社科'],['综合政策学院','综合政策'],['食品系统数据科学','食品数据'],
    ['生物医学工程','生医工程'],['农业生物资源科学','农生资源'],['日本研究学院','日本研究']
  ]){
    const p={name,code:'IMPORTED-OPAQUE-CODE'},before=JSON.stringify(p);
    assert.equal(programTitle(p),short,name);assert.equal(programFullName(p),name);
    assert.ok((short.match(/\p{Script=Han}/gu)||[]).length<=4);
    assert.equal(JSON.stringify(p),before);
  }
});

test('overview pairs abbreviations with full names while qualification headings stay short',()=>{
  const programs=[
    {...make('csce','基干理工学部·计算机科学与通信工程'),school:'早稻田大学',code:'SFSECSCE',englishName:'Computer Science and Communications Engineering'},
    {...make('ebs','生物环境科学部环境与生物资源科学学科'),school:'京都先端科学大学',code:'DEBS',englishName:'Faculty of Bioenvironmental Sciences, Department of Environmental and Bioresource Sciences'},
    {...make('life','理工学院・生命科学与技术学科'),code:'DLST',englishName:'Department of Life Science and Technology'}
  ],before=JSON.stringify(programs);
  for(const [p,short,full]of [[programs[0],'CSCE','计算机科学与通信工程'],[programs[1],'EBS','环境与生物资源科学'],[programs[2],'生科技术','生命科学与技术']]){
    const view=createSchoolOverview(p.school,programs,{...ui,deferSections:true});
    assert.ok(view.html.includes(`data-program-short>${short}</strong>`));
    assert.ok(view.html.includes(`data-program-full>${full}</span>`));
    const academic=view.renderSection('academic');
    assert.ok(academic.includes(`title="${esc(programOriginalTitle(p))}"><span class="program-label-part">${short}</span></a>`));
    assert.doesNotMatch(academic,/data-program-full/);
    assert.equal(view.labels.get(p.id),short);
  }
  assert.equal(JSON.stringify(programs),before);
});

test('display initials are separate from official acronyms and use subject words rather than faculty codes',()=>{
  const p={school:'京都先端科学大学',code:'DEBS',name:'生物环境科学部环境与生物资源科学学科',englishName:'Faculty of Bioenvironmental Sciences, Department of Environmental and Bioresource Sciences'};
  assert.equal(programTitle(p),'EBS');assert.equal(programAbbreviation(p),'');
  assert.equal(programCode({...p,englishName:'Environmental and Biological Resources Sciences'}),'EBS');
  const generic={name:'新型环境系统设计研究',code:'RANDOM-CODE',englishName:'Faculty of Engineering, Department of Environmental Systems Design, School of Science'};
  assert.equal(programTitle(generic),'ESD');
  assert.equal(programTitle({...generic,englishName:''}),generic.name,'missing English must not be invented or arbitrary Chinese characters cut');
  assert.equal(programTitle({...generic,englishName:'環境システム設計'}),generic.name);
});

test('compact faculty distinctions remain stable in single results and do not assume an absent faculty',()=>{
  const rows=[['工学院化学项目','化学（工）'],['理学院化学项目','化学（理）'],['法学院社会科学项目','社科（法）'],['经济学院社会科学项目','社科（经）']].map(([name,want],i)=>({p:{id:String(i),school:'名古屋大学',name},want}));
  const titles=buildProgramTitles(rows.map(r=>r.p));
  for(const {p,want}of rows){assert.equal(titles.get(p.id),want);assert.equal(programTitle(p),want);assert.equal(programFullName(p),p.name);}
  assert.equal(programTitle({school:'名古屋大学',name:'化学'}),'化学');
});

test('overview full names avoid duplicate labels and escape source text',()=>{
  assert.doesNotMatch(renderProgramOverviewName({name:'国际经济'},'国际经济',esc),/data-program-full/);
  const p={name:'<img src=x onerror=alert(1)>学科'};
  const html=renderProgramOverviewName(p,'临时名称',esc);
  assert.ok(html.includes('&lt;img'));assert.doesNotMatch(html,/<img/);
});
