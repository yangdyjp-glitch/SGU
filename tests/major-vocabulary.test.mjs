import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {majorCatalog,majorsFromText,getProgramMajors,presentProgramMajors,normalizeMajors,matchesMajors} from '../public/program-majors.js';
import {majorPhraseCases} from './fixtures/major-phrases.mjs';
import {parseQuery} from '../lib/query.mjs';
import {interpretQuery} from '../lib/llm.mjs';
const programs=JSON.parse(await fs.readFile(new URL('./fixtures/program-major-audit.json',import.meta.url),'utf8'));

test('every catalogue category has positive, ambiguous and exact query coverage',()=>{
 assert.deepEqual(majorPhraseCases.map(row=>row[0]),majorCatalog);
 for(const label of majorCatalog){assert.deepEqual(majorsFromText(label),[label]);assert.deepEqual(parseQuery(label+'专业，雅思6分').majors,[label]);}
});
for(const [label,positive,negative] of majorPhraseCases)test('phrase boundaries: '+label,()=>{
 for(const text of positive)assert.ok(majorsFromText(text).includes(label),`${text} should include ${label}: ${majorsFromText(text)}`);
 for(const text of negative)assert.ok(!majorsFromText(text).includes(label),`${text} should not include ${label}: ${majorsFromText(text)}`);
});
test('long compounds keep their meaning while independent disciplines remain independent',()=>{
 const cases=[
  ['国际商务法、商务管理',['商学与管理','法学']],
  ['文化学科、化学科',['文学与语言文化','化学']],
  ['天文学、文学',['文学与语言文化','天文学']],
  ['电子商务、电子工程',['商学与管理','电气电子与通信工程']],
  ['Tourism Management and Business Administration',['商学与管理','旅游与酒店管理']],
  ['Biochemistry',['化学','生物与生命科学']],
  ['生物化学',['化学','生物与生命科学']],
  ['Civil and Environmental Engineering',['土木工程','环境与可持续发展']],
  ['Civil and Mechanical Engineering',['机械与汽车工程','土木工程']],
  ['Civil, Electrical, and Environmental Engineering',['电气电子与通信工程','土木工程','环境与可持续发展']],
  ['Global Political Economy',['经济学','政治学']],
  ['Electrical, Electronic and Communications Engineering',['电气电子与通信工程']],
  ['Information Sciences and Arts',['计算机与信息科学','艺术与设计']],
  ['STEM',[]],['理工方向',[]],['本科项目',[]]
 ];
 for(const [text,expected] of cases)assert.deepEqual(majorsFromText(text),expected,text);
 assert.deepEqual(normalizeMajors(['Ｅｃｏｎｏｍｉｃｓ','經濟學','国際関係','金融科技']),['经济学','国际关系','金融科技']);
});
test('all 177 reviewed project titles retain their own academic scope',()=>{
 assert.equal(programs.length,177);
 for(const {expected,...p} of programs){
  const before=JSON.stringify(p);assert.deepEqual(getProgramMajors(p),expected,p.school+' '+p.name);
  assert.deepEqual(getProgramMajors(presentProgramMajors(p)),expected,p.name+' projection');assert.equal(JSON.stringify(p),before);
  for(const major of majorCatalog)assert.equal(matchesMajors(p,major),expected.includes(major),p.name+' / '+major);
 }
});
test('unknown departments do not borrow faculty subjects; specific courses outrank parents',()=>{
 assert.deepEqual(getProgramMajors({name:'经济学院未知学科',englishName:'Department of Unclear Studies, Faculty of Economics'}),[]);
 assert.deepEqual(getProgramMajors({name:'体育信息学院数据课程',englishName:'Faculty of Sports and Information Science',direction:'体育信息学科数据科学课程'}),['数据科学与人工智能']);
 assert.deepEqual(getProgramMajors({name:'本科项目',englishName:'College of Liberal Arts'}),['综合教养']);
 assert.deepEqual(getProgramMajors({name:'本科项目',school:'国际教养大学'}),[]);
 assert.deepEqual(getProgramMajors({name:'本科项目',direction:'数学成绩必须达到90分'}),[]);
 assert.deepEqual(getProgramMajors({name:'商学院',englishName:'College of Business',direction:'数学成绩要求'}),['商学与管理']);
});
test('inferred projections update, but reviewed, custom and explicitly empty tags remain authoritative',()=>{
 const legacy={name:'综合政策学部',direction:'国际政策文化学科',majors:['公共政策','文学与语言文化','化学'],majorsInferred:true};
 assert.deepEqual(getProgramMajors(legacy),['公共政策','文学与语言文化']);
 assert.deepEqual(getProgramMajors({...legacy,majorsInferred:false}),legacy.majors);
 assert.deepEqual(getProgramMajors({...legacy,majors:['金融科技'],majorsInferred:false}),['金融科技']);
 assert.deepEqual(getProgramMajors({...legacy,majors:[]}),[]);
});
test('query contexts keep paperwork, test subjects and unknown majors out of subject filters',()=>{
 for(const question of ['申请材料有哪些','雅思6分的语言要求','需要健康证明的项目','教育背景有什么要求','computer-delivered IELTS 6','语言豁免政策'])assert.deepEqual(parseQuery(question).majors,[],question);
 const mixed=parseQuery('化学专业，数学成绩90分，雅思6分');assert.deepEqual(mixed.majors,['化学']);assert.ok(mixed.unsupported.some(s=>s.includes('考试科目')));
 assert.deepEqual(parseQuery('数学考试要求').majors,[]);
 for(const label of majorCatalog){assert.ok(parseQuery('不想学'+label+'专业').unsupported.some(s=>s.includes('排除')),label);assert.ok(!parseQuery(label+'专业，不需要面试').unsupported.some(s=>s.includes('排除')),label);}
 assert.ok(parseQuery('不明确的未知专业，雅思6分').unsupported.some(s=>s.includes('专业名称无法可靠识别')));
 assert.ok(!parseQuery('全部专业，雅思6分').unsupported.some(s=>s.includes('专业名称无法可靠识别')));
 assert.ok(!parseQuery('雅思6分可以申请哪些专业').unsupported.some(s=>s.includes('专业名称无法可靠识别')));
 assert.deepEqual(parseQuery('化学或综合工学专业').majors,['化学','综合工学']);
 assert.deepEqual(parseQuery('Civil, Electrical, and Environmental Engineering').majors,['电气电子与通信工程','土木工程','环境与可持续发展']);
 assert.ok(parseQuery('经济学或不明确的未知专业').unsupported.some(s=>s.includes('专业名称无法可靠识别')));
});
test('model parsing cannot restore a false major rejected by the shared phrase parser',async()=>{
 const keys=['LLM_BASE_URL','LLM_API_KEY','LLM_MODEL'],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]])),original=globalThis.fetch;
 try{
  Object.assign(process.env,{LLM_BASE_URL:'https://example.invalid/v1',LLM_API_KEY:'isolated-test-only',LLM_MODEL:'fixture'});
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({majors:['材料科学'],unsupported:[]})}}]}),{status:200});
  const q=await interpretQuery('申请材料有哪些',parseQuery('申请材料有哪些'));assert.deepEqual(q.majors,[]);assert.ok(q.unsupported.some(s=>s.includes('完整专业词组')));
  const known=await interpretQuery('化学专业，雅思6分',parseQuery('化学专业，雅思6分'));assert.deepEqual(known.majors,['化学']);
 }finally{globalThis.fetch=original;for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
